import { getTrustLabel } from '../services/verifier';
import type { ReferendumResult } from '../types/election';

interface Props {
    result?: ReferendumResult;
}

export function ReferendumTracker({ result }: Props) {
    if (!result) return null;

    const total = result.totalYesVotes + result.totalNoVotes;
    const yesPercent = total > 0 ? Math.round((result.totalYesVotes / total) * 100) : 0;
    const noPercent = total > 0 ? 100 - yesPercent : 0;
    const trust = getTrustLabel(result.trustScore || 0);

    return (
        <div className="card-glass" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <h3 className="section-title" style={{ margin: 0 }}>🗳️ National Referendum</h3>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>
                        July National Charter
                    </div>
                </div>
                {result.trustScore && result.trustScore > 0 && (
                    <span
                        style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: `${trust.color}15`,
                            color: trust.color,
                            border: `1px solid ${trust.color}40`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {trust.label} Verified
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>YES</span>
                        <span style={{ fontWeight: 700 }}>{yesPercent}%</span>
                    </div>
                    <div className="vote-bar">
                        <div
                            className="vote-bar-fill"
                            style={{
                                width: `${yesPercent}%`,
                                background: 'var(--color-success)',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {result.totalYesVotes.toLocaleString()} votes
                    </div>
                </div>

                <div style={{ width: '1px', height: '40px', background: 'var(--border-color)' }} />

                <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700 }}>{noPercent}%</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>NO</span>
                    </div>
                    <div className="vote-bar" style={{ justifyContent: 'flex-end' }}>
                        <div
                            className="vote-bar-fill"
                            style={{
                                width: `${noPercent}%`,
                                background: 'var(--color-danger)',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {result.totalNoVotes.toLocaleString()} votes
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Key Reforms:</strong> Term limits, bicameral parliament, judicial independence.
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Total Cast: {total.toLocaleString()}
                </div>
            </div>
        </div>
    );
}
