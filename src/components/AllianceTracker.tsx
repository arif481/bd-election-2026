import type { ElectionSummary } from '../types/election';
import { ALLIANCES } from '../data/parties';

interface Props {
    summary: ElectionSummary | null;
}

export function AllianceTracker({ summary }: Props) {
    if (!summary) return null;

    // Calculate alliance totals dynamically from summary.parties
    const allianceStats = ALLIANCES.map(alliance => {
        const partiesInAlliance = summary.parties.filter(p => alliance.partyIds.includes(p.id));
        const won = partiesInAlliance.reduce((sum, p) => sum + p.seatsWon, 0);
        const leading = partiesInAlliance.reduce((sum, p) => sum + p.seatsLeading, 0);
        const total = won + leading;

        return { ...alliance, won, leading, total };
    }).sort((a, b) => b.total - a.total);



    return (
        <div className="card-glass" style={{ padding: '16px' }}>
            <h3 className="section-title" style={{ marginBottom: '16px' }}>🤝 Alliance Standings</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {allianceStats.map(alliance => (
                    <div key={alliance.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alliance.shortName}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Target: {alliance.totalSeats} seats
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: alliance.color }}>
                                    {alliance.total}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    {alliance.won} Won + {alliance.leading} Lead
                                </div>
                            </div>
                        </div>

                        <div className="vote-bar" style={{ height: '8px' }}>
                            <div
                                className="vote-bar-fill"
                                style={{
                                    width: `${(alliance.total / 300) * 100}%`, // Percentage of parliament
                                    backgroundColor: alliance.color,
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Majority needed to form government: <strong>151</strong>
            </div>
        </div>
    );
}
