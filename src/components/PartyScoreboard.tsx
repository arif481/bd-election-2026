import type { Party } from '../types/election';

interface Props {
    parties: Party[];
    totalSeats?: number;
}

export function PartyScoreboard({ parties, totalSeats = 300 }: Props) {
    const isLoading = parties.length === 0;
    const sortedParties = [...parties].sort((a, b) => b.seatsWon - a.seatsWon);

    if (isLoading) {
        return (
            <div className="card-glass scoreboard">
                <div style={{ height: '20px', width: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '16px' }} />
                <div style={{ height: '12px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '20px' }} />
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ height: '32px', width: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                        <div style={{ height: '32px', width: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div id="scoreboard" className="card-glass scoreboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Parliament Composition</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Target: 151
                </span>
            </div>

            {/* Visual Parliament Bar */}
            <div className="parliament-bar">
                {/* Center marker for majority */}
                <div className="majority-marker" style={{ left: '50%' }} />

                {sortedParties.map(party => {
                    const width = (party.seatsWon / totalSeats) * 100;
                    if (width < 0.5) return null; // Hide if too small
                    return (
                        <div
                            key={party.id}
                            className="parliament-segment"
                            style={{
                                width: `${width}%`,
                                backgroundColor: party.color,
                                boxShadow: `0 0 10px ${party.color}40`
                            }}
                            title={`${party.shortName}: ${party.seatsWon}`}
                        />
                    );
                })}
                {/* Remaining empty space */}
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }} />
            </div>

            <div className="party-list">
                {sortedParties.slice(0, 5).map(party => (
                    <div key={party.id} className="party-row">
                        <div className="party-info">
                            <div
                                className="party-dot"
                                style={{ backgroundColor: party.color }}
                            />
                            <div className="party-names">
                                <span className="party-short">{party.shortName}</span>
                                <span className="party-full">{party.name}</span>
                            </div>
                        </div>

                        <div className="party-seats">
                            <span className="seats-won">
                                {party.seatsWon}
                            </span>
                            {party.seatsLeading > 0 && (
                                <span className="seats-leading">
                                    +{party.seatsLeading} Lead
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
        .scoreboard { padding: 16px; }
        .parliament-bar {
            height: 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            display: flex;
            overflow: hidden;
            margin-bottom: 20px;
            position: relative;
        }
        .majority-marker {
            position: absolute;
            top: -4px;
            bottom: -4px;
            width: 2px;
            background: rgba(255,255,255,0.2);
            z-index: 10;
        }
        .parliament-segment {
            height: 100%;
            transition: width 1s ease-in-out;
        }
        .party-list { display: flex; flex-direction: column; gap: 12px; }
        .party-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
        }
        .party-info { display: flex; alignItems: center; gap: 12px; }
        .party-dot { width: 12px; height: 12px; border-radius: 50%; }
        .party-names { display: flex; flex-direction: column; }
        .party-short { font-weight: 700; font-size: 0.9rem; }
        .party-full { font-size: 0.75rem; color: var(--text-secondary); }
        .party-seats { text-align: right; }
        .seats-won { font-weight: 800; font-size: 1.1rem; display: block; }
        .seats-leading { font-size: 0.75rem; color: var(--color-warning); }
      `}</style>
        </div>
    );
}
