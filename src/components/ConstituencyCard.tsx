import type { Constituency } from '../types/election';
import { getPartyColor, getPartyShortName } from '../data/parties';
import { getTrustLabel } from '../services/verifier';

interface Props {
    constituency: Constituency;
}

export function ConstituencyCard({ constituency: c }: Props) {
    const maxVotes = Math.max(...c.candidates.map(cd => cd.votes), 1);
    const trust = getTrustLabel(c.trustScore || 0);

    return (
        <div className="constituency-card">
            <div className="constituency-header">
                <div>
                    <div className="constituency-name">{c.name}</div>
                    <div className="constituency-number">
                        #{c.number} • {c.division} • {c.district}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {c.trustScore > 0 && c.trustScore < 70 && (
                        <span
                            className="status-badge"
                            style={{
                                background: `${trust.color}15`,
                                color: trust.color,
                                border: `1px solid ${trust.color}40`,
                            }}
                            title={`Trust: ${c.trustScore}%`}
                        >
                            {trust.label}
                        </span>
                    )}
                    <span className={`status-badge status-${c.status}`}>
                        {c.status === 'result_confirmed' ? 'Confirmed' :
                            c.status === 'declared' ? 'Declared' :
                                c.status === 'counting' ? 'Counting' :
                                    c.status === 'postponed' ? 'Postponed' : 'Pending'}
                    </span>
                </div>
            </div>

            <div className="candidate-list">
                {c.candidates.length === 0 ? (
                    <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                        Results not yet available
                    </div>
                ) : (
                    c.candidates.slice(0, 4).map((cd, i) => (
                        <div key={i} className={`candidate-row ${cd.isWinner ? 'winner' : ''}`}>
                            <div
                                className="candidate-party-color"
                                style={{ backgroundColor: getPartyColor(cd.party) }}
                            />
                            <div className="candidate-info">
                                <div className="candidate-name">
                                    {cd.isWinner && '🏆 '}{cd.name}
                                </div>
                                <div className="candidate-party">
                                    {getPartyShortName(cd.party)}
                                </div>
                            </div>
                            <div className="candidate-votes">
                                {cd.votes > 0 ? cd.votes.toLocaleString() : '—'}
                            </div>
                        </div>
                    ))
                )}

                {c.candidates.length > 0 && c.totalVotes > 0 && (
                    <>
                        {c.candidates.slice(0, 3).map((cd, i) => (
                            <div key={`bar-${i}`} className="vote-bar" style={{ marginBottom: '2px' }}>
                                <div
                                    className="vote-bar-fill"
                                    style={{
                                        width: `${(cd.votes / maxVotes) * 100}%`,
                                        backgroundColor: getPartyColor(cd.party),
                                    }}
                                />
                            </div>
                        ))}
                    </>
                )}

                {c.winMargin > 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                        Margin: {c.winMargin.toLocaleString()} votes
                    </div>
                )}
            </div>
        </div>
    );
}
