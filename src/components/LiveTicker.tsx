import type { ElectionUpdate } from '../types/election';
import { getTrustLabel } from '../services/verifier';

interface Props {
    updates: ElectionUpdate[];
}

export function LiveTicker({ updates }: Props) {
    if (!updates.length) {
        return (
            <div className="ticker">
                <div className="ticker-header">
                    <h3 className="section-title" style={{ margin: 0 }}>📡 Live Updates</h3>
                    <div className="live-badge">
                        <span className="live-dot"></span>
                        LIVE
                    </div>
                </div>
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Waiting for results to start flowing...</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                        Results are expected to start coming in after 4:30 PM BST
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="ticker">
            <div className="ticker-header">
                <h3 className="section-title" style={{ margin: 0 }}>📡 Live Updates</h3>
                <div className="live-badge">
                    <span className="live-dot"></span>
                    LIVE
                </div>
            </div>
            <div className="ticker-list">
                {updates.map((update, i) => {
                    const trust = getTrustLabel(update.trustScore);
                    const time = new Date(update.timestamp);
                    const timeStr = time.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    });

                    return (
                        <div key={update.id || i} className="ticker-item">
                            <span className="ticker-time">{timeStr}</span>
                            <span
                                className="ticker-trust"
                                style={{
                                    backgroundColor: `${trust.color}15`,
                                    color: trust.color,
                                    border: `1px solid ${trust.color}40`,
                                }}
                            >
                                {trust.label}
                            </span>
                            <span className="ticker-message">
                                {update.type === 'result_declared' && '🏆 '}
                                {update.type === 'lead_change' && '🔄 '}
                                {update.message}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
