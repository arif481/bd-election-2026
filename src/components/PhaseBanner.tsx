import { useState, useEffect } from 'react';
import { PHASE_TIMESTAMPS } from '../data/constants';

interface Props {
    phase: string;
}

export function PhaseBanner({ phase }: Props) {
    const [timeLeft, setTimeLeft] = useState('');
    const [targetLabel, setTargetLabel] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            let target: Date | null = null;
            let label = '';

            if (now < PHASE_TIMESTAMPS.votingStart) {
                target = PHASE_TIMESTAMPS.votingStart;
                label = 'Voting Starts In';
            } else if (now < PHASE_TIMESTAMPS.votingEnd) {
                target = PHASE_TIMESTAMPS.votingEnd;
                label = 'Voting Ends In';
            } else if (now < PHASE_TIMESTAMPS.peakResults) {
                target = PHASE_TIMESTAMPS.peakResults;
                label = 'Peak Results In';
            } else {
                target = null;
                label = 'Election Completed';
            }

            setTargetLabel(label);

            if (target) {
                const diff = target.getTime() - now.getTime();
                if (diff > 0) {
                    const h = Math.floor(diff / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    setTimeLeft(`${h}h ${m}m ${s}s`);
                } else {
                    setTimeLeft('00h 00m 00s');
                }
            } else {
                setTimeLeft('');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const phaseLabels: Record<string, string> = {
        pre_voting: '🗳️ PRE-VOTING PREPARATION',
        voting: '🗳️ VOTING IN PROGRESS',
        early_results: '📊 EARLY TRENDS ARRIVING',
        peak_results: '🔥 PEAK RESULT FLOW',
        late_results: '🌔 LATE NIGHT COUNTING',
        cleanup: '🏁 FINALIZING RESULTS',
        completed: '✅ ELECTION COMPLETED'
    };

    const isLive = phase === 'voting' || phase.includes('results');

    return (
        <div className="phase-banner" style={{
            background: isLive ?
                'linear-gradient(90deg, #b91c1c 0%, #7f1d1d 100%)' :
                'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
            borderBottom: isLive ? '2px solid #ef4444' : '1px solid var(--border-color)',
            boxShadow: isLive ? '0 0 20px rgba(220, 38, 38, 0.4)' : 'none'
        }}>
            <div className="phase-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isLive && <span className="live-pulse" style={{ width: '12px', height: '12px' }} />}
                    <h2 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 800,
                        letterSpacing: '1px',
                        textTransform: 'uppercase'
                    }}>
                        {phaseLabels[phase] || phase.replace('_', ' ')}
                    </h2>
                </div>

                {timeLeft && (
                    <div className="countdown-timer">
                        <span style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.7)',
                            fontWeight: 600,
                            marginRight: '8px'
                        }}>
                            {targetLabel}
                        </span>
                        <span style={{
                            fontFamily: 'monospace',
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            background: 'rgba(0,0,0,0.3)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            {timeLeft}
                        </span>
                    </div>
                )}
            </div>

            <style>{`
                .phase-banner {
                    margin: -1px -16px 20px -16px;
                    padding: 16px 24px;
                    color: white;
                    position: sticky;
                    top: 60px; /* Below header */
                    z-index: 40;
                }
                .phase-content {
                    max-width: 1280px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                @media (max-width: 768px) {
                    .phase-content {
                        flex-direction: column;
                        gap: 12px;
                        align-items: flex-start;
                    }
                    .phase-banner {
                        position: relative;
                        top: 0;
                        margin-bottom: 12px;
                    }
                }
            `}</style>
        </div>
    );
}
