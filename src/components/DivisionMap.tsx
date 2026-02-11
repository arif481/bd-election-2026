import { useState } from 'react';
import type { Constituency } from '../types/election';
import { getPartyColor, getPartyShortName } from '../data/parties';
import { FloatingLegend } from './FloatingLegend';

interface Props {
    divisionStats: Record<string, { total: number; declared: number; leadingParty: string }>;
    constituencies: Constituency[];
}

// Simplified Bangladesh division map paths (SVG)
const DIVISION_PATHS: Record<string, { path: string; labelX: number; labelY: number }> = {
    Dhaka: {
        path: 'M 230 220 L 280 190 L 310 210 L 320 260 L 300 310 L 260 320 L 230 290 Z',
        labelX: 270, labelY: 260,
    },
    Chattogram: {
        path: 'M 310 210 L 360 200 L 380 260 L 370 340 L 350 400 L 320 380 L 300 310 L 320 260 Z',
        labelX: 340, labelY: 300,
    },
    Rajshahi: {
        path: 'M 120 160 L 180 140 L 220 160 L 230 220 L 200 240 L 140 230 L 110 200 Z',
        labelX: 170, labelY: 195,
    },
    Rangpur: {
        path: 'M 140 60 L 200 50 L 220 100 L 220 160 L 180 140 L 120 160 L 110 120 Z',
        labelX: 170, labelY: 110,
    },
    Khulna: {
        path: 'M 140 230 L 200 240 L 230 290 L 260 320 L 240 380 L 180 400 L 130 350 L 120 280 Z',
        labelX: 190, labelY: 320,
    },
    Barishal: {
        path: 'M 260 320 L 300 310 L 320 380 L 300 420 L 260 430 L 240 380 Z',
        labelX: 280, labelY: 375,
    },
    Sylhet: {
        path: 'M 280 190 L 320 140 L 380 130 L 400 170 L 360 200 L 310 210 Z',
        labelX: 345, labelY: 170,
    },
    Mymensingh: {
        path: 'M 220 160 L 280 130 L 320 140 L 280 190 L 230 220 Z',
        labelX: 265, labelY: 170,
    },
};

export function DivisionMap({ divisionStats, constituencies }: Props) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; division: string } | null>(null);

    // Calculate dominant party per division
    const divisionParties = new Map<string, string>();
    const divisionObj: Record<string, Record<string, number>> = {};

    constituencies.forEach(c => {
        if (!divisionObj[c.division]) divisionObj[c.division] = {};
        const winner = c.candidates.find(cd => cd.isWinner || cd.isLeading);
        if (winner) {
            divisionObj[c.division][winner.party] = (divisionObj[c.division][winner.party] || 0) + 1;
        }
    });

    Object.entries(divisionObj).forEach(([div, parties]) => {
        const top = Object.entries(parties).sort((a, b) => b[1] - a[1])[0];
        if (top) divisionParties.set(div, top[0]);
    });

    return (
        <div className="card-glass">
            <h3 className="section-title" style={{ marginBottom: '12px' }}>🗺️ Division Map</h3>
            <div className="map-container">
                <svg viewBox="80 30 350 430" className="map-svg">
                    {Object.entries(DIVISION_PATHS).map(([div, { path, labelX, labelY }]) => {
                        const dominantParty = divisionParties.get(div);
                        const fillColor = dominantParty ? getPartyColor(dominantParty) : 'var(--bg-elevated)';
                        const stats = divisionStats[div];

                        return (
                            <g key={div}>
                                <path
                                    d={path}
                                    fill={fillColor}
                                    className="map-division"
                                    opacity={0.75}
                                    onMouseEnter={(e) => {
                                        const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
                                        setTooltip({
                                            x: e.clientX - rect.left,
                                            y: e.clientY - rect.top - 50,
                                            division: div,
                                        });
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                                <text x={labelX} y={labelY} className="map-label" textAnchor="middle">
                                    {div}
                                </text>
                                {stats && (
                                    <text
                                        x={labelX}
                                        y={labelY + 14}
                                        className="map-label"
                                        textAnchor="middle"
                                        style={{ fontSize: '8px', opacity: 0.8 }}
                                    >
                                        {stats.declared}/{stats.total}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {tooltip && (
                    <div
                        className="map-tooltip"
                        style={{ left: tooltip.x, top: tooltip.y }}
                    >
                        <strong>{tooltip.division}</strong>
                        {divisionStats[tooltip.division] && (
                            <>
                                <br />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {divisionStats[tooltip.division].declared} / {divisionStats[tooltip.division].total} declared
                                </span>
                                {divisionParties.get(tooltip.division) && (
                                    <>
                                        <br />
                                        <span style={{ fontSize: '0.75rem' }}>
                                            Leading: {getPartyShortName(divisionParties.get(tooltip.division)!)}
                                        </span>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                <FloatingLegend />
            </div>

            <style>{`
                .map-container { position: relative; width: 100%; }
                .map-svg { width: 100%; height: auto; }
                .map-division { transition: fill 0.3s, opacity 0.3s; cursor: pointer; }
                .map-division:hover { opacity: 1; filter: drop-shadow(0 0 5px rgba(255,255,255,0.3)); }
                .map-label { font-size: 10px; fill: var(--text-primary); pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
                .map-tooltip {
                    position: absolute;
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 8px 12px;
                    border-radius: 6px;
                    pointer-events: none;
                    z-index: 20;
                    transform: translate(-50%, -100%);
                    font-size: 0.8rem;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
}
