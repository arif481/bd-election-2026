import type { ElectionSummary } from '../types/election';
import { ELECTION } from '../data/constants';
import { CountUp } from './CountUp';

interface Props {
    summary: ElectionSummary | null;
}

export function StatsGrid({ summary }: Props) {
    const isLoading = !summary;

    const items = [
        {
            label: 'SEATS DECLARED',
            value: summary?.seatsDeclared ?? 0,
            sub: `/ ${ELECTION.activeSeats}`,
            icon: '🗳️',
            color: 'var(--bd-green)',
            isNumber: true
        },
        {
            label: 'TOTAL VOTES',
            value: (summary?.totalVotesCounted ?? 0),
            sub: `of ${((ELECTION.totalRegisteredVoters ?? 0) / 1000000).toFixed(1)}M`,
            icon: '👥',
            color: 'var(--color-info)',
            formatter: (val: number) => (val / 1000000).toFixed(1) + 'M',
            isNumber: true
        },
        {
            label: 'TURNOUT',
            value: summary?.avgTurnout ?? 0,
            sub: 'National Avg',
            icon: '📊',
            color: 'var(--color-warning)',
            formatter: (val: number) => val.toFixed(1) + '%',
            isNumber: true
        },
        {
            label: 'POLLING CENTERS',
            value: ELECTION.totalPollingCenters,
            sub: 'Reporting Live',
            icon: '🏫',
            color: 'var(--bd-red)',
            formatter: (val: number) => (val / 1000).toFixed(0) + 'K+',
            isNumber: true
        }
    ];

    return (
        <div id="stats-grid" className="stats-grid">
            {items.map((item, i) => (
                <div key={i} className="card-glass stat-card">
                    {isLoading ? (
                        <div className="skeleton-pulse">
                            <div style={{ height: '10px', width: '60%', marginBottom: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                            <div style={{ height: '28px', width: '40%', marginBottom: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                            <div style={{ height: '10px', width: '30%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px' }}>
                                    {item.label}
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: item.color }}>
                                    {item.isNumber ? (
                                        <CountUp
                                            value={item.value as number}
                                            formatter={item.formatter}
                                            duration={2000}
                                        />
                                    ) : item.value}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {item.sub}
                                </div>
                            </div>
                            <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>
                                {item.icon}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
