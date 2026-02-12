import { useState, useEffect } from 'react';
import {
    onSystemStatusChange,
    getPendingReviews,
    approveUpdate,
    batchSeedConstituencies,
    updateSummary,
    updateConstituency,
    updateReferendum,
    addNewsItem,
    onConflictsChange,
    resolveConflict,
    getAuditLog,
    onSourcesChange,
} from '../services/firestore';
import {
    startCollection,
    stopCollection,
    manualFetch,
    getCollectorStats,
    getCollectionPhase,
} from '../services/collector';
import { collectNews, setAutoNewsEnabled, isAutoNewsEnabled } from '../services/newsCollector';
import { toggleSource, getAllSourceStates } from '../services/sourceManager';
import { getActiveErrors, resolveError } from '../services/errorLogger';
import type { ElectionUpdate, SystemStatus, Candidate, DataConflict, AuditEntry, SourceStatus, ConstituencyStatus, NewsItem, SystemError } from '../types/election';
import { getTrustLabel } from '../services/verifier';
import { CONSTITUENCIES } from '../data/constituencies';
import { PARTIES } from '../data/parties';

export function AdminDashboard() {
    const [, setStatus] = useState<SystemStatus | null>(null);
    const [pendingReviews, setPendingReviews] = useState<ElectionUpdate[]>([]);
    const [fetchMessage, setFetchMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [collectorStats, setCollectorStats] = useState(getCollectorStats());
    const [activeTab, setActiveTab] = useState('monitor');

    // Manual Entry State
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [manualCandidates, setManualCandidates] = useState<Array<{ name: string; party: string; votes: number }>>([
        { name: '', party: 'bnp', votes: 0 },
        { name: '', party: 'al', votes: 0 },
    ]);
    const [manualStatus, setManualStatus] = useState<string>('counting');

    // Referendum State
    const [refYes, setRefYes] = useState(0);
    const [refNo, setRefNo] = useState(0);
    const [refCentersReported, setRefCentersReported] = useState(0);
    const [refTotalCenters, setRefTotalCenters] = useState(40000);
    const [refStatus, setRefStatus] = useState<string>('not_started');

    // News State
    const [newsHeadline, setNewsHeadline] = useState('');
    const [newsSummary, setNewsSummary] = useState('');
    const [newsSource, setNewsSource] = useState('');
    const [newsSourceUrl, setNewsSourceUrl] = useState('');
    const [newsCategory, setNewsCategory] = useState<string>('general');
    const [autoNewsToggle, setAutoNewsToggle] = useState(isAutoNewsEnabled());

    // Sources State
    const [sourcesData, setSourcesData] = useState<SourceStatus[]>([]);

    // Conflicts State
    const [conflicts, setConflicts] = useState<DataConflict[]>([]);

    // Audit State
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [auditFilter, setAuditFilter] = useState('');
    const [systemErrors, setSystemErrors] = useState<SystemError[]>([]);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000); // Update "freshness" reference every minute
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const unsubs = [
            onSystemStatusChange(setStatus),
            onConflictsChange(setConflicts),
            onSourcesChange(setSourcesData),
        ];

        const loadReviews = async () => {
            const reviews = await getPendingReviews();
            setPendingReviews(reviews);
        };
        loadReviews();

        const timer = setInterval(() => {
            setCollectorStats(getCollectorStats());
            loadReviews();
            getActiveErrors().then(setSystemErrors);
        }, 5000);

        return () => {
            unsubs.forEach(u => u());
            clearInterval(timer);
        };
    }, []);

    // Load audit log when tab is opened
    useEffect(() => {
        if (activeTab === 'audit') {
            getAuditLog().then(setAuditLog);
        }
    }, [activeTab]);

    // Also sync local source states
    useEffect(() => {
        if (activeTab === 'sources') {
            setSourcesData(getAllSourceStates());
        }
    }, [activeTab]);

    const handleStart = async () => {
        setLoading(true);
        await startCollection();
        setFetchMessage('Collection engine started');
        setLoading(false);
    };

    const handleStop = () => {
        stopCollection();
        setFetchMessage('Collection engine stopped');
    };

    // Manual Fetch Options
    const [useGeminiForManual, setUseGeminiForManual] = useState(false);

    const handleManualFetch = async () => {
        setLoading(true);
        setFetchMessage(`Fetching from multiple sources (${useGeminiForManual ? 'Gemini' : 'Tavily'})...`);
        const result = await manualFetch(useGeminiForManual);
        setFetchMessage(result.message);
        setLoading(false);
    };

    const handleApprove = async (updateId: string) => {
        await approveUpdate(updateId);
        setPendingReviews(prev => prev.filter(r => r.id !== updateId));
    };

    const handleSeedDatabase = async () => {
        if (!confirm('Are you sure? This will overwrite existing constituency data.')) return;
        setLoading(true);
        setFetchMessage('Seeding constituencies...');
        try {
            for (let i = 0; i < CONSTITUENCIES.length; i += 100) {
                const chunk = CONSTITUENCIES.slice(i, i + 100);
                await batchSeedConstituencies(chunk);
            }

            await updateSummary({
                totalSeats: 300,
                seatsDeclared: 0,
                seatsRemaining: 300,
                totalVotesCounted: 0,
                avgTurnout: 0,
                parties: PARTIES.map(p => ({ ...p })),
                leadingParty: '',
                phase: 'pre_voting',
            });

            setFetchMessage('✅ Database seeded successfully! 300 constituencies + summary created.');
        } catch (e) {
            console.error(e);
            setFetchMessage('❌ Error seeding: ' + e);
        }
        setLoading(false);
    };

    const handleManualEntry = async () => {
        if (!selectedConstituency) {
            setFetchMessage('❌ Please select a constituency');
            return;
        }
        const validCandidates = manualCandidates.filter(c => c.name.trim());
        if (validCandidates.length === 0) {
            setFetchMessage('❌ Please enter at least one candidate');
            return;
        }

        setLoading(true);
        try {
            const totalVotes = validCandidates.reduce((s, c) => s + c.votes, 0);
            const maxVotes = Math.max(...validCandidates.map(c => c.votes));
            const isDeclared = manualStatus === 'declared' || manualStatus === 'result_confirmed';

            const candidates: Candidate[] = validCandidates
                .sort((a, b) => b.votes - a.votes)
                .map((c, i) => ({
                    name: c.name,
                    party: c.party,
                    votes: c.votes,
                    isWinner: isDeclared && i === 0,
                    isLeading: !isDeclared && c.votes === maxVotes && c.votes > 0,
                }));

            const winMargin = candidates.length >= 2 ? candidates[0].votes - candidates[1].votes : 0;

            await updateConstituency(selectedConstituency, {
                candidates,
                status: manualStatus as ConstituencyStatus,
                totalVotes,
                winMargin,
                trustScore: 100,
                source: 'manual_entry',
            });

            setFetchMessage(`✅ Updated constituency: ${selectedConstituency}`);
        } catch (e) {
            console.error(e);
            setFetchMessage('❌ Error: ' + e);
        }
        setLoading(false);
    };

    const handleReferendumUpdate = async () => {
        setLoading(true);
        try {
            const totalVotesCast = refYes + refNo;
            await updateReferendum({
                totalYesVotes: refYes,
                totalNoVotes: refNo,
                totalVotesCast,
                totalEligible: 127_600_000,
                percentYes: totalVotesCast > 0 ? Math.round((refYes / totalVotesCast) * 10000) / 100 : 0,
                percentNo: totalVotesCast > 0 ? Math.round((refNo / totalVotesCast) * 10000) / 100 : 0,
                centersReported: refCentersReported,
                totalCenters: refTotalCenters,
                status: refStatus as any,
                trustScore: 100,
            });
            setFetchMessage('✅ Referendum data updated');
        } catch (e) {
            console.error(e);
            setFetchMessage('❌ Error: ' + e);
        }
        setLoading(false);
    };

    const handleNewsSubmit = async () => {
        if (!newsHeadline.trim()) {
            setFetchMessage('❌ Headline is required');
            return;
        }
        setLoading(true);
        try {
            await addNewsItem({
                headline: newsHeadline,
                summary: newsSummary,
                source: newsSource || 'Admin',
                sourceUrl: newsSourceUrl,
                timestamp: Date.now(),
                category: newsCategory as NewsItem['category'],
                isVerified: true,
            });
            setFetchMessage('✅ News item published');
            setNewsHeadline('');
            setNewsSummary('');
            setNewsSource('');
            setNewsSourceUrl('');
        } catch (e) {
            console.error(e);
            setFetchMessage('❌ Error: ' + e);
        }
        setLoading(false);
    };

    const handleAutoNewsFetch = async () => {
        setLoading(true);
        setFetchMessage('Auto-collecting news...');
        const result = await collectNews();
        setFetchMessage(result.success
            ? `✅ ${result.message}`
            : `❌ ${result.message}`
        );
        setLoading(false);
    };

    const handleToggleAutoNews = () => {
        const next = !autoNewsToggle;
        setAutoNewsToggle(next);
        setAutoNewsEnabled(next);
        setFetchMessage(next ? '✅ Auto-news enabled' : '⚠️ Auto-news disabled');
    };

    const handleResolveConflict = async (conflictId: string, resolution: string) => {
        try {
            await resolveConflict(conflictId, 'admin_override', resolution);
            setFetchMessage(`✅ Conflict resolved: ${resolution}`);
        } catch (e) {
            setFetchMessage(`❌ Error: ${e}`);
        }
    };

    const handleToggleSource = (sourceId: string, active: boolean) => {
        toggleSource(sourceId, active);
        setSourcesData(getAllSourceStates());
        setFetchMessage(`${active ? '✅ Enabled' : '⚠️ Disabled'} source: ${sourceId}`);
    };

    const addCandidate = () => {
        setManualCandidates(prev => [...prev, { name: '', party: 'independent', votes: 0 }]);
    };

    const updateCandidate = (index: number, field: string, value: string | number) => {
        setManualCandidates(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    const removeCandidate = (index: number) => {
        if (manualCandidates.length <= 2) return;
        setManualCandidates(prev => prev.filter((_, i) => i !== index));
    };

    const pendingConflicts = conflicts.filter(c => c.resolvedBy === 'pending');

    const inputStyle = { padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit' };

    return (
        <div className="page">
            <div className="app-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>⚙️ Super Admin</h1>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Phase: {getCollectionPhase()} • {collectorStats.sources?.activeSources || 0} sources active
                            {pendingConflicts.length > 0 && <span style={{ color: '#f97316', marginLeft: '8px' }}>⚠️ {pendingConflicts.length} conflicts</span>}
                        </p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                        sessionStorage.removeItem('admin_auth');
                        window.location.hash = '#/';
                    }}>
                        Logout
                    </button>
                </div>

                {/* Tab Nav */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
                    {([
                        { id: 'monitor', label: '🖥️ Monitor' },
                        { id: 'manual', label: '✍️ Manual' },
                        { id: 'referendum', label: '🗳️ Referendum' },
                        { id: 'news', label: '📰 News' },
                        { id: 'sources', label: '📡 Sources' },
                        { id: 'conflicts', label: `⚔️ Conflicts${pendingConflicts.length > 0 ? ` (${pendingConflicts.length})` : ''}` },
                        { id: 'errors', label: `⚠️ Errors${systemErrors.length > 0 ? ` (${systemErrors.length})` : ''}` },
                        { id: 'audit', label: '📜 Audit' },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Status Message */}
                {fetchMessage && (
                    <div style={{
                        fontSize: '0.85rem', padding: '10px 16px', marginBottom: '16px', borderRadius: '8px',
                        background: fetchMessage.startsWith('✅') ? 'rgba(34,197,94,0.1)' :
                            fetchMessage.startsWith('❌') ? 'rgba(239,68,68,0.1)' :
                                'var(--bg-elevated)',
                        color: fetchMessage.startsWith('✅') ? '#22c55e' :
                            fetchMessage.startsWith('❌') ? '#ef4444' :
                                'var(--text-secondary)',
                    }}>
                        {fetchMessage}
                    </div>
                )}

                {/* ═══ MONITOR TAB ═══ */}
                {activeTab === 'monitor' && (
                    <>
                        <div className="stats-grid" style={{ marginBottom: '20px' }}>
                            <div className="card">
                                <div className="card-title">Engine Status</div>
                                <div className="card-value" style={{
                                    fontSize: '1rem',
                                    color: collectorStats.isActive ? 'var(--color-success)' : 'var(--text-muted)'
                                }}>
                                    {collectorStats.isActive ? '🟢 Active' : '⚪ Dormant'}
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-title">API Calls</div>
                                <div className="card-value">{collectorStats.apiCallsToday} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 1000</span></div>
                            </div>
                            <div className="card">
                                <div className="card-title">Errors</div>
                                <div className="card-value" style={{ color: collectorStats.errorsToday > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                    {collectorStats.errorsToday}
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-title">Seats Declared</div>
                                <div className="card-value">{collectorStats.declaredSeats} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 300</span></div>
                            </div>
                        </div>

                        {/* Multi-Source Health Overview */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h3 className="section-title">📡 Source Health</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                                {sourcesData.length > 0 ? sourcesData.map(s => {
                                    const health = s.errorCount === 0 ? '#22c55e' :
                                        s.errorCount <= 2 ? '#eab308' : '#ef4444';
                                    // Calculate freshness relative to current render time
                                    const freshness = now - s.lastSuccessTime;
                                    const isFresh = freshness < 120_000;
                                    return (
                                        <div key={s.id} style={{
                                            padding: '10px', background: 'var(--bg-elevated)', borderRadius: '8px',
                                            borderLeft: `3px solid ${s.isActive ? health : '#666'}`,
                                        }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '4px' }}>{s.name}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                T{s.tier} • {s.successCount}/{s.fetchCount} OK
                                                {isFresh && <span style={{ color: '#22c55e' }}> • Fresh</span>}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                {s.constituenciesReported} seats reported
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                                        Sources will appear after first collection cycle
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Collection Controls */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h3 className="section-title">🎮 Collection Controls</h3>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <button className="btn btn-success btn-sm" onClick={handleStart} disabled={loading}>
                                    ▶ Start Engine
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={handleStop}>
                                    ⏹ Stop Engine
                                </button>
                                <button className="btn btn-warning btn-sm" onClick={handleManualFetch} disabled={loading}>
                                    🔄 Manual Fetch
                                </button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                        type="checkbox"
                                        checked={useGeminiForManual}
                                        onChange={e => setUseGeminiForManual(e.target.checked)}
                                    />
                                    Force Gemini
                                </label>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Cycle #{collectorStats.cycleCount} • {collectorStats.sources?.totalSources || 0} total sources •
                                Interval: {(collectorStats.interval / 1000).toFixed(0)}s
                            </div>
                        </div>

                        {/* Review Queue */}
                        <div className="card">
                            <h3 className="section-title">📋 Review Queue ({pendingReviews.length})</h3>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {pendingReviews.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No pending reviews 🎉</p>
                                ) : (
                                    pendingReviews.map(review => {
                                        const trust = getTrustLabel(review.trustScore);
                                        return (
                                            <div key={review.id} style={{
                                                padding: '12px', borderBottom: '1px solid var(--border-color)',
                                                display: 'flex', flexDirection: 'column', gap: '8px'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: 700 }}>{review.constituencyName}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {new Date(review.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem' }}>{review.message}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: `${trust.color}15`, color: trust.color }}>
                                                        Trust: {review.trustScore}
                                                    </span>
                                                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(review.id)}>
                                                        Approve
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ═══ MANUAL ENTRY TAB ═══ */}
                {activeTab === 'manual' && (
                    <div className="card">
                        <h3 className="section-title">✍️ Manual Result Entry & Seeding</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Manually declare results or update counts. This overrides AI collection.
                        </p>

                        {/* Emergency Seeding */}
                        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '24px' }}>
                            <h4 style={{ marginTop: 0, fontSize: '0.95rem' }}>🚨 Emergency Database Seeding</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Populates 300 constituencies and initial election summary. Safe to re-run.
                            </p>
                            <button className="btn btn-primary btn-sm" onClick={handleSeedDatabase} disabled={loading}>
                                {loading ? 'Seeding...' : '⚡ Seed Database'}
                            </button>
                        </div>

                        {/* Manual Entry Form */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                            <h4 style={{ marginTop: 0, fontSize: '0.95rem', marginBottom: '16px' }}>📝 Declare / Update Result</h4>

                            <div className="admin-form-group">
                                <label>Constituency</label>
                                <select value={selectedConstituency} onChange={e => setSelectedConstituency(e.target.value)}>
                                    <option value="">Select constituency...</option>
                                    {CONSTITUENCIES.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.division})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="admin-form-group">
                                <label>Status</label>
                                <select value={manualStatus} onChange={e => setManualStatus(e.target.value)}>
                                    <option value="counting">Counting</option>
                                    <option value="declared">Declared</option>
                                    <option value="result_confirmed">Result Confirmed</option>
                                    <option value="postponed">Postponed</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Candidates</label>
                                    <button className="btn btn-ghost btn-sm" onClick={addCandidate} style={{ fontSize: '0.75rem' }}>
                                        + Add Candidate
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {manualCandidates.map((c, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 30px', gap: '8px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                placeholder="Candidate name"
                                                value={c.name}
                                                onChange={e => updateCandidate(i, 'name', e.target.value)}
                                                style={inputStyle}
                                            />
                                            <select
                                                value={c.party}
                                                onChange={e => updateCandidate(i, 'party', e.target.value)}
                                                style={{ ...inputStyle, fontSize: '0.8rem' }}
                                            >
                                                {PARTIES.map(p => (
                                                    <option key={p.id} value={p.id}>{p.shortName}</option>
                                                ))}
                                                <option value="independent">Independent</option>
                                            </select>
                                            <input
                                                type="number"
                                                placeholder="Votes"
                                                value={c.votes || ''}
                                                onChange={e => updateCandidate(i, 'votes', parseInt(e.target.value) || 0)}
                                                style={inputStyle}
                                            />
                                            <button
                                                onClick={() => removeCandidate(i)}
                                                disabled={manualCandidates.length <= 2}
                                                style={{
                                                    background: 'transparent', border: 'none',
                                                    color: manualCandidates.length <= 2 ? 'var(--text-muted)' : 'var(--color-danger)',
                                                    cursor: manualCandidates.length <= 2 ? 'not-allowed' : 'pointer', fontSize: '1rem',
                                                }}
                                                title="Remove candidate"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                className="btn btn-success"
                                onClick={handleManualEntry}
                                disabled={loading || !selectedConstituency}
                                style={{ width: '100%' }}
                            >
                                {loading ? 'Submitting...' : '✅ Submit Result'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ REFERENDUM TAB ═══ */}
                {activeTab === 'referendum' && (
                    <div className="card">
                        <h3 className="section-title">🗳️ Referendum Control</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Update Yes/No counts for the July Charter Referendum
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>✅ YES Votes</label>
                                <input type="number" value={refYes || ''} onChange={e => setRefYes(parseInt(e.target.value) || 0)} placeholder="0" />
                            </div>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>❌ NO Votes</label>
                                <input type="number" value={refNo || ''} onChange={e => setRefNo(parseInt(e.target.value) || 0)} placeholder="0" />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>Centers Reported</label>
                                <input type="number" value={refCentersReported || ''} onChange={e => setRefCentersReported(parseInt(e.target.value) || 0)} placeholder="0" />
                            </div>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>Total Centers</label>
                                <input type="number" value={refTotalCenters || ''} onChange={e => setRefTotalCenters(parseInt(e.target.value) || 0)} placeholder="40000" />
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label>Status</label>
                            <select value={refStatus} onChange={e => setRefStatus(e.target.value)}>
                                <option value="not_started">Not Started</option>
                                <option value="counting">Counting</option>
                                <option value="declared">Declared</option>
                            </select>
                        </div>

                        {(refYes > 0 || refNo > 0) && (
                            <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Preview</div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div><span style={{ color: '#22c55e', fontWeight: 700 }}>YES: </span>{refYes + refNo > 0 ? ((refYes / (refYes + refNo)) * 100).toFixed(1) : 0}%</div>
                                    <div><span style={{ color: '#ef4444', fontWeight: 700 }}>NO: </span>{refYes + refNo > 0 ? ((refNo / (refYes + refNo)) * 100).toFixed(1) : 0}%</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total: {(refYes + refNo).toLocaleString()}</div>
                                </div>
                            </div>
                        )}

                        <button className="btn btn-success" onClick={handleReferendumUpdate} disabled={loading} style={{ width: '100%' }}>
                            {loading ? 'Updating...' : '📊 Update Referendum Data'}
                        </button>
                    </div>
                )}

                {/* ═══ NEWS TAB ═══ */}
                {activeTab === 'news' && (
                    <div className="card">
                        <h3 className="section-title">📰 News Control</h3>

                        {/* Auto-News Controls */}
                        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🤖 Auto-Collect News</span>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        Gemini fetches and categorizes election news automatically
                                    </div>
                                </div>
                                <button
                                    className={`btn btn-sm ${autoNewsToggle ? 'btn-success' : 'btn-ghost'}`}
                                    onClick={handleToggleAutoNews}
                                >
                                    {autoNewsToggle ? '🟢 ON' : '⚪ OFF'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button className="btn btn-primary btn-sm" onClick={handleAutoNewsFetch} disabled={loading}>
                                    🔄 Fetch News Now
                                </button>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {collectorStats.news?.totalAutoFetched || 0} auto-collected •
                                    {collectorStats.news?.seenHeadlines || 0} seen • 2min cooldown
                                </span>
                            </div>
                        </div>

                        {/* Manual News Entry */}
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>✍️ Manual News Entry</h4>

                        <div className="admin-form-group">
                            <label>Headline *</label>
                            <input type="text" value={newsHeadline} onChange={e => setNewsHeadline(e.target.value)} placeholder="e.g. BNP takes early lead in Dhaka-5" />
                        </div>

                        <div className="admin-form-group">
                            <label>Summary</label>
                            <textarea value={newsSummary} onChange={e => setNewsSummary(e.target.value)} placeholder="Optional detailed summary..." />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="admin-form-group">
                                <label>Source</label>
                                <input type="text" value={newsSource} onChange={e => setNewsSource(e.target.value)} placeholder="e.g. BDNews24" />
                            </div>
                            <div className="admin-form-group">
                                <label>Source URL</label>
                                <input type="url" value={newsSourceUrl} onChange={e => setNewsSourceUrl(e.target.value)} placeholder="https://..." />
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label>Category</label>
                            <select value={newsCategory} onChange={e => setNewsCategory(e.target.value)}>
                                <option value="breaking">🔴 Breaking</option>
                                <option value="result">📊 Result</option>
                                <option value="analysis">📈 Analysis</option>
                                <option value="incident">⚠️ Incident</option>
                                <option value="general">📋 General</option>
                            </select>
                        </div>

                        {newsHeadline && (
                            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Preview</div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                    {newsCategory === 'breaking' && <span style={{ color: '#ef4444' }}>🔴 BREAKING: </span>}
                                    {newsHeadline}
                                </div>
                                {newsSummary && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{newsSummary}</div>}
                                {newsSource && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Source: {newsSource}</div>}
                            </div>
                        )}

                        <button className="btn btn-success" onClick={handleNewsSubmit} disabled={loading || !newsHeadline.trim()} style={{ width: '100%' }}>
                            {loading ? 'Publishing...' : '📨 Publish News Update'}
                        </button>
                    </div>
                )}

                {/* ═══ ERRORS TAB ═══ */}
                {activeTab === 'errors' && (
                    <div className="card">
                        <h3 className="section-title">⚠️ System Errors ({systemErrors.length})</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                            Active system errors requiring attention. Resolve them to clear the alert.
                        </p>

                        {systemErrors.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✅</div>
                                No active system errors
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {systemErrors.map(err => (
                                    <div key={err.id} style={{
                                        padding: '16px', borderRadius: '8px',
                                        background: 'var(--bg-elevated)', borderLeft: '4px solid #ef4444'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.9rem' }}>
                                                {err.type.toUpperCase().replace('_', ' ')}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(err.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{err.message}</div>
                                        {err.details && (
                                            <div style={{
                                                fontSize: '0.8rem', color: 'var(--text-secondary)',
                                                background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px',
                                                fontFamily: 'monospace', marginBottom: '12px', whiteSpace: 'pre-wrap'
                                            }}>
                                                {err.details}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button
                                                className="btn btn-sm btn-success"
                                                onClick={async () => {
                                                    await resolveError(err.id, 'resolved');
                                                    setSystemErrors(prev => prev.filter(e => e.id !== err.id));
                                                    setFetchMessage('✅ Error marked as resolved');
                                                }}
                                            >
                                                ✅ Mark Resolved
                                            </button>

                                            {err.sourceId && (
                                                <>
                                                    <button
                                                        className="btn btn-sm btn-warning"
                                                        onClick={async () => {
                                                            toggleSource(err.sourceId!, false);
                                                            setFetchMessage(`⚠️ Disabled source: ${err.sourceId}`);
                                                            setSourcesData(getAllSourceStates());
                                                        }}
                                                    >
                                                        🚫 Disable Source
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={async () => {
                                                            setLoading(true);
                                                            setFetchMessage('Retrying fetch...');
                                                            const result = await manualFetch(); // This retries all, but includes the failed source if active
                                                            setFetchMessage(result.message);
                                                            setLoading(false);
                                                        }}
                                                    >
                                                        🔄 Retry Fetch
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                className="btn btn-sm btn-ghost"
                                                onClick={async () => {
                                                    await resolveError(err.id, 'ignored');
                                                    setSystemErrors(prev => prev.filter(e => e.id !== err.id));
                                                }}
                                            >
                                                🗑️ Ignore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'sources' && (
                    <div className="card">
                        <h3 className="section-title">📡 Data Sources</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                            Live status of all data collection sources. Toggle sources on/off.
                        </p>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Source</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tier</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fetches</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Errors</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Seats</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg Time</th>
                                        <th style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Toggle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sourcesData.map(s => {
                                        const errRate = s.fetchCount > 0 ? ((s.errorCount / s.fetchCount) * 100).toFixed(0) : '0';
                                        const statusColor = !s.isActive ? '#666' :
                                            s.errorCount === 0 ? '#22c55e' :
                                                parseInt(errRate) > 50 ? '#ef4444' : '#eab308';
                                        return (
                                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: s.isActive ? 1 : 0.5 }}>
                                                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{s.name}</td>
                                                <td style={{ padding: '10px 8px' }}>
                                                    <span style={{
                                                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                                        background: s.tier === 1 ? '#22c55e20' : s.tier === 2 ? '#3b82f620' : '#eab30820',
                                                        color: s.tier === 1 ? '#22c55e' : s.tier === 2 ? '#3b82f6' : '#eab308',
                                                    }}>T{s.tier}</span>
                                                </td>
                                                <td style={{ padding: '10px 8px' }}>
                                                    <span style={{ color: statusColor }}>●</span> {s.isActive ? 'Active' : 'Disabled'}
                                                </td>
                                                <td style={{ padding: '10px 8px' }}>{s.successCount}/{s.fetchCount}</td>
                                                <td style={{ padding: '10px 8px', color: s.errorCount > 0 ? '#ef4444' : 'inherit' }}>
                                                    {s.errorCount} ({errRate}%)
                                                </td>
                                                <td style={{ padding: '10px 8px' }}>{s.constituenciesReported}</td>
                                                <td style={{ padding: '10px 8px' }}>
                                                    {s.avgResponseTime > 0 ? `${(s.avgResponseTime / 1000).toFixed(1)}s` : '—'}
                                                </td>
                                                <td style={{ padding: '10px 8px' }}>
                                                    <button
                                                        className={`btn btn-sm ${s.isActive ? 'btn-danger' : 'btn-success'}`}
                                                        onClick={() => handleToggleSource(s.id, !s.isActive)}
                                                        style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                                                    >
                                                        {s.isActive ? 'Disable' : 'Enable'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {sourcesData.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>
                                No source data yet. Start the collection engine to see source health.
                            </p>
                        )}

                        {/* Source Summary */}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>Total: {sourcesData.length}</span>
                            <span>Active: {sourcesData.filter(s => s.isActive).length}</span>
                            <span>Total Fetches: {sourcesData.reduce((s, st) => s + st.fetchCount, 0)}</span>
                            <span>Total Errors: {sourcesData.reduce((s, st) => s + st.errorCount, 0)}</span>
                        </div>
                    </div>
                )}

                {/* ═══ CONFLICTS TAB ═══ */}
                {activeTab === 'conflicts' && (
                    <div className="card">
                        <h3 className="section-title">⚔️ Data Conflicts ({conflicts.length})</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                            When multiple sources disagree, conflicts appear here for admin resolution.
                        </p>

                        {conflicts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
                                <div style={{ fontSize: '0.9rem' }}>No data conflicts</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                    Conflicts will appear when multiple sources report different data for the same constituency
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {conflicts.map(conflict => {
                                    const isPending = conflict.resolvedBy === 'pending';
                                    const severityColor = conflict.severity === 'critical' ? '#ef4444' :
                                        conflict.severity === 'high' ? '#f97316' :
                                            conflict.severity === 'medium' ? '#eab308' : '#22c55e';
                                    return (
                                        <div key={conflict.id} style={{
                                            padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px',
                                            borderLeft: `3px solid ${severityColor}`, opacity: isPending ? 1 : 0.7,
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{conflict.constituencyName}</span>
                                                    <span style={{
                                                        marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700,
                                                        background: `${severityColor}20`, color: severityColor,
                                                    }}>
                                                        {conflict.severity.toUpperCase()} • {conflict.type.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {new Date(conflict.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>

                                            {/* Side-by-side comparison */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                                <div style={{ padding: '8px', background: 'var(--bg-surface)', borderRadius: '6px' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                        📰 {conflict.sourceA.name} (T{conflict.sourceA.tier})
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem' }}>
                                                        {Object.entries(conflict.sourceA.data).map(([k, v]) => (
                                                            <div key={k}>{k}: <strong>{String(v)}</strong></div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ padding: '8px', background: 'var(--bg-surface)', borderRadius: '6px' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                        📰 {conflict.sourceB.name} (T{conflict.sourceB.tier})
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem' }}>
                                                        {Object.entries(conflict.sourceB.data).map(([k, v]) => (
                                                            <div key={k}>{k}: <strong>{String(v)}</strong></div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {isPending ? (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => handleResolveConflict(conflict.id, `Accept Source A: ${conflict.sourceA.name}`)}
                                                        style={{ fontSize: '0.7rem' }}
                                                    >
                                                        Accept {conflict.sourceA.name}
                                                    </button>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleResolveConflict(conflict.id, `Accept Source B: ${conflict.sourceB.name}`)}
                                                        style={{ fontSize: '0.7rem' }}
                                                    >
                                                        Accept {conflict.sourceB.name}
                                                    </button>
                                                    <button
                                                        className="btn btn-warning btn-sm"
                                                        onClick={() => handleResolveConflict(conflict.id, 'Dismissed by admin')}
                                                        style={{ fontSize: '0.7rem' }}
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>
                                                    ✅ Resolved: {conflict.resolution || conflict.resolvedBy}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ AUDIT LOG TAB ═══ */}
                {activeTab === 'audit' && (
                    <div className="card">
                        <h3 className="section-title">📜 Audit Log</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                            Full change history — every update, conflict resolution, and manual override.
                        </p>

                        <div className="admin-form-group" style={{ marginBottom: '16px' }}>
                            <input
                                type="text"
                                placeholder="Filter by constituency name..."
                                value={auditFilter}
                                onChange={e => setAuditFilter(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {auditLog.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
                                    <div>No audit entries yet</div>
                                </div>
                            ) : (
                                auditLog
                                    .filter(a => !auditFilter || a.constituencyName.toLowerCase().includes(auditFilter.toLowerCase()))
                                    .map(entry => {
                                        const actionColor = entry.action === 'manual_override' ? '#f97316' :
                                            entry.action === 'conflict_resolve' ? '#eab308' :
                                                entry.action === 'auto_publish' ? '#22c55e' : '#3b82f6';
                                        const trust = getTrustLabel(entry.trustScore);
                                        return (
                                            <div key={entry.id} style={{
                                                padding: '12px', borderBottom: '1px solid var(--border-color)',
                                                display: 'flex', flexDirection: 'column', gap: '4px',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{entry.constituencyName}</span>
                                                        <span style={{
                                                            padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
                                                            background: `${actionColor}20`, color: actionColor,
                                                        }}>
                                                            {entry.action.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    Source: {entry.source} • Trust: <span style={{ color: trust.color }}>{entry.trustScore}</span>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {JSON.stringify(entry.newData).slice(0, 100)}
                                                    {JSON.stringify(entry.newData).length > 100 && '...'}
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>

                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => getAuditLog().then(setAuditLog)}
                            style={{ marginTop: '12px', width: '100%' }}
                        >
                            🔄 Refresh Audit Log
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
