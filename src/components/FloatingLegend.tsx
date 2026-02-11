import { useState } from 'react';
import { PARTIES, getPartyColor } from '../data/parties';

export function FloatingLegend() {
    const [expanded, setExpanded] = useState(false);

    // Major parties to show in legend
    const legendParties = ['bnp', 'jamaat', 'jp-ershad', 'islami-andolan'];

    return (
        <div
            className="map-legend card-glass"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            <div className="legend-header">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    LEGEND
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                    {expanded ? '▼' : '▶'}
                </span>
            </div>

            {(expanded || window.innerWidth > 768) && (
                <div className="legend-items">
                    {legendParties.map(id => {
                        const party = PARTIES.find(p => p.id === id);
                        if (!party) return null;
                        return (
                            <div key={id} className="legend-item">
                                <div
                                    className="legend-dot"
                                    style={{ background: getPartyColor(id) }}
                                />
                                <span>{party.shortName}</span>
                            </div>
                        );
                    })}
                    <div className="legend-item">
                        <div className="legend-dot" style={{ background: '#334155' }} />
                        <span>Others/Ind</span>
                    </div>
                </div>
            )}

            <style>{`
                .map-legend {
                    position: absolute;
                    bottom: 20px;
                    left: 20px;
                    padding: 8px 12px;
                    z-index: 10;
                    min-width: 100px;
                    transition: all 0.3s ease;
                }
                .legend-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    margin-bottom: 4px;
                }
                .legend-items {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-top: 8px;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                }
                .legend-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                @media (max-width: 768px) {
                    .map-legend {
                        bottom: 10px;
                        left: 10px;
                    }
                }
            `}</style>
        </div>
    );
}
