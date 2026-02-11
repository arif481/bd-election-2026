import { useState, useEffect } from 'react';
import {
    onSystemStatusChange,
    getPendingReviews,
    approveUpdate,
} from '../services/firestore';
import {
    startCollection,
    stopCollection,
    manualFetch,
    getCollectorStats,
    getCollectionPhase,
} from '../services/collector';
import type { ElectionUpdate, SystemStatus } from '../types/election';
import { getTrustLabel } from '../services/verifier';

export function AdminDashboard() {
    const [, setStatus] = useState<SystemStatus | null>(null);
    const [pendingReviews, setPendingReviews] = useState<ElectionUpdate[]>([]);
    const [fetchMessage, setFetchMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [collectorStats, setCollectorStats] = useState(getCollectorStats());
    // Tabs: 'monitor' | 'manual' | 'referendum' | 'news'
    const [activeTab, setActiveTab] = useState('monitor');

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
                    <button
                        className={`btn btn-sm ${activeTab === 'monitor' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('monitor')}
                    >
                        🖥️ Monitor
                    </button>
                    <button
                        className={`btn btn-sm ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        ✍️ Manual Entry
                    </button>
                    <button
                        className={`btn btn-sm ${activeTab === 'referendum' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('referendum')}
                    >
                        🗳️ Referendum
                    </button>
                    <button
                        className={`btn btn-sm ${activeTab === 'news' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('news')}
                    >
                        📰 News
                    </button>
                </div>

                {activeTab === 'monitor' && (
                    <>
                        {/* System Status */}
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

                        {/* Controls */}
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
                            {fetchMessage && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-accent)', padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                                    {fetchMessage}
                                </div>
                            )}
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
                                                        {trust.emoji} Trust: {review.trustScore}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(review.id)}>
                                                            Approve
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'manual' && (
                    <div className="card">
                        <h3 className="section-title">✍️ Manual Result Entry</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Manually declare results or update counts. This overrides AI collection.
                        </p>
                        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                            🚧 Manual Entry Forms Coming Soon
                        </div>
                    </div>
                )}

                {activeTab === 'referendum' && (
                    <div className="card">
                        <h3 className="section-title">🗳️ Referendum Control</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Update Live Yes/No counts for the July Charter Referendum.
                        </p>
                        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                            🚧 Referendum Admin Form Coming Soon
                        </div>
                    </div>
                )}

                {activeTab === 'news' && (
                    <div className="card">
                        <h3 className="section-title">📰 News Ticker Control</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Post breaking news or updates to the feed manually.
                        </p>
                        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                            🚧 News Admin Form Coming Soon
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
