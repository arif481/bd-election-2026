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
} from '../services/firestore';
import {
    startCollection,
    stopCollection,
    manualFetch,
    getCollectorStats,
    getCollectionPhase,
} from '../services/collector';
import type { ElectionUpdate, SystemStatus, Candidate } from '../types/election';
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

    useEffect(() => {
        const unsubs = [
            onSystemStatusChange(setStatus),
        ];

        const loadReviews = async () => {
            const reviews = await getPendingReviews();
            setPendingReviews(reviews);
        };
        loadReviews();

        const timer = setInterval(() => {
            setCollectorStats(getCollectorStats());
            loadReviews();
        }, 5000);

        return () => {
            unsubs.forEach(u => u());
            clearInterval(timer);
        };
    }, []);

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

    const handleManualFetch = async () => {
        setLoading(true);
        setFetchMessage('Fetching...');
        const result = await manualFetch();
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
            // Batch in chunks of 100 to stay well under Firestore's 500-doc limit
            for (let i = 0; i < CONSTITUENCIES.length; i += 100) {
                const chunk = CONSTITUENCIES.slice(i, i + 100);
                await batchSeedConstituencies(chunk);
            }

            // Create a complete initial summary
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
                status: manualStatus as any,
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
                category: newsCategory as any,
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

    return (
        <div className="page">
            <div className="app-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>⚙️ Super Admin</h1>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Phase: {getCollectionPhase()} • Full Access Mode
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    {(['monitor', 'manual', 'referendum', 'news'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'monitor' && '🖥️ Monitor'}
                            {tab === 'manual' && '✍️ Manual Entry'}
                            {tab === 'referendum' && '🗳️ Referendum'}
                            {tab === 'news' && '📰 News'}
                        </button>
                    ))}
                </div>

                {/* Status Message */}
                {fetchMessage && (
                    <div style={{
                        fontSize: '0.85rem',
                        padding: '10px 16px',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        background: fetchMessage.startsWith('✅') ? 'rgba(34,197,94,0.1)' :
                            fetchMessage.startsWith('❌') ? 'rgba(239,68,68,0.1)' :
                                'var(--bg-elevated)',
                        color: fetchMessage.startsWith('✅') ? '#22c55e' :
                            fetchMessage.startsWith('❌') ? '#ef4444' :
                                'var(--text-secondary)',
                        border: '1px solid transparent',
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
                                <div className="card-title">API Calls Today</div>
                                <div className="card-value">{collectorStats.apiCallsToday} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 1000</span></div>
                            </div>
                            <div className="card">
                                <div className="card-title">Errors Today</div>
                                <div className="card-value" style={{ color: collectorStats.errorsToday > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                    {collectorStats.errorsToday}
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-title">Seats Declared</div>
                                <div className="card-value">{collectorStats.declaredSeats} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 300</span></div>
                            </div>
                        </div>

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
                            </div>
                        </div>

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
                                                        {trust.emoji} Trust: {review.trustScore}
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
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSeedDatabase}
                                disabled={loading}
                            >
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
                                                style={{ padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit' }}
                                            />
                                            <select
                                                value={c.party}
                                                onChange={e => updateCandidate(i, 'party', e.target.value)}
                                                style={{ padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit' }}
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
                                                style={{ padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit' }}
                                            />
                                            <button
                                                onClick={() => removeCandidate(i)}
                                                disabled={manualCandidates.length <= 2}
                                                style={{
                                                    background: 'transparent', border: 'none', color: manualCandidates.length <= 2 ? 'var(--text-muted)' : 'var(--color-danger)',
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
                                <input
                                    type="number"
                                    value={refYes || ''}
                                    onChange={e => setRefYes(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>❌ NO Votes</label>
                                <input
                                    type="number"
                                    value={refNo || ''}
                                    onChange={e => setRefNo(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>Centers Reported</label>
                                <input
                                    type="number"
                                    value={refCentersReported || ''}
                                    onChange={e => setRefCentersReported(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="admin-form-group" style={{ margin: 0 }}>
                                <label>Total Centers</label>
                                <input
                                    type="number"
                                    value={refTotalCenters || ''}
                                    onChange={e => setRefTotalCenters(parseInt(e.target.value) || 0)}
                                    placeholder="40000"
                                />
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

                        {/* Live Preview */}
                        {(refYes > 0 || refNo > 0) && (
                            <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Preview</div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div>
                                        <span style={{ color: '#22c55e', fontWeight: 700 }}>YES: </span>
                                        {refYes + refNo > 0 ? ((refYes / (refYes + refNo)) * 100).toFixed(1) : 0}%
                                    </div>
                                    <div>
                                        <span style={{ color: '#ef4444', fontWeight: 700 }}>NO: </span>
                                        {refYes + refNo > 0 ? ((refNo / (refYes + refNo)) * 100).toFixed(1) : 0}%
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Total: {(refYes + refNo).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            className="btn btn-success"
                            onClick={handleReferendumUpdate}
                            disabled={loading}
                            style={{ width: '100%' }}
                        >
                            {loading ? 'Updating...' : '📊 Update Referendum Data'}
                        </button>
                    </div>
                )}

                {/* ═══ NEWS TAB ═══ */}
                {activeTab === 'news' && (
                    <div className="card">
                        <h3 className="section-title">📰 News Ticker Control</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Post breaking news or updates to the live feed
                        </p>

                        <div className="admin-form-group">
                            <label>Headline *</label>
                            <input
                                type="text"
                                value={newsHeadline}
                                onChange={e => setNewsHeadline(e.target.value)}
                                placeholder="e.g. BNP takes early lead in Dhaka-5"
                            />
                        </div>

                        <div className="admin-form-group">
                            <label>Summary</label>
                            <textarea
                                value={newsSummary}
                                onChange={e => setNewsSummary(e.target.value)}
                                placeholder="Optional detailed summary..."
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="admin-form-group">
                                <label>Source</label>
                                <input
                                    type="text"
                                    value={newsSource}
                                    onChange={e => setNewsSource(e.target.value)}
                                    placeholder="e.g. BDNews24"
                                />
                            </div>
                            <div className="admin-form-group">
                                <label>Source URL</label>
                                <input
                                    type="url"
                                    value={newsSourceUrl}
                                    onChange={e => setNewsSourceUrl(e.target.value)}
                                    placeholder="https://..."
                                />
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

                        {/* Preview */}
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

                        <button
                            className="btn btn-success"
                            onClick={handleNewsSubmit}
                            disabled={loading || !newsHeadline.trim()}
                            style={{ width: '100%' }}
                        >
                            {loading ? 'Publishing...' : '📨 Publish News Update'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
