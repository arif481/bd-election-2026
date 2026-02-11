import { useState, useEffect, useMemo } from 'react';
import { onSummaryChange, onConstituenciesChange } from '../services/firestore';
import type { ElectionSummary, Constituency } from '../types/election';
import { DIVISIONS } from '../types/election';
import { PARTIES } from '../data/parties';
import { CONSTITUENCIES } from '../data/constituencies';

export function PartyView() {
    const [summary, setSummary] = useState<ElectionSummary | null>(null);
    const [constituencies, setConstituencies] = useState<Constituency[]>(CONSTITUENCIES);

    useEffect(() => {
        const unsubs = [
            onSummaryChange((data) => {
                if (data) setSummary(data);
            }),
            onConstituenciesChange((data) => {
                if (data.length > 0) setConstituencies(data);
            }),
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    // Show all parties from local data, even before counting starts
    const parties = useMemo(() => {
        if (summary?.parties && summary.parties.some(p => p.totalVotes > 0 || p.seatsWon > 0)) {
            // Counting has started — use live data, sorted by performance
            return summary.parties
                .filter(p => p.seatsWon + p.seatsLeading > 0 || p.totalVotes > 0)
                .sort((a, b) => (b.seatsWon + b.seatsLeading) - (a.seatsWon + a.seatsLeading));
        }
        // Pre-voting: show all parties from static data sorted by candidate count
        return PARTIES
            .filter(p => p.totalCandidates > 0)
            .sort((a, b) => b.totalCandidates - a.totalCandidates);
    }, [summary]);

    const partyDivisionBreakdown = useMemo(() => {
        const breakdown: Record<string, Record<string, number>> = {};
        constituencies.forEach(c => {
            const winner = c.candidates.find(cd => cd.isWinner || cd.isLeading);
            if (!winner) return;
            if (!breakdown[winner.party]) breakdown[winner.party] = {};
            breakdown[winner.party][c.division] = (breakdown[winner.party][c.division] || 0) + 1;
        });
        return breakdown;
    }, [constituencies]);

    const totalVotesAll = parties.reduce((s, p) => s + p.totalVotes, 0);
    const hasResults = totalVotesAll > 0;

    return (
        <div className="page">
            <div className="app-container">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
                    🏛️ Party-wise {hasResults ? 'Results' : 'Overview'}
                </h1>
                {!hasResults && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                        Showing {parties.length} parties competing • Results will update live once counting begins
                    </p>
                )}

                {parties.map(party => {
                    const totalSeats = party.seatsWon + party.seatsLeading;
                    const voteShare = totalVotesAll > 0 ? ((party.totalVotes / totalVotesAll) * 100).toFixed(1) : '0';

                    return (
                        <div key={party.id} className="card" style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        backgroundColor: party.color, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '1.2rem'
                                    }}>
                                        {party.symbol}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{party.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{party.shortName}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {hasResults ? (
                                        <>
                                            <div style={{ fontWeight: 800, fontSize: '1.8rem', color: party.color }}>
                                                {totalSeats}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {party.seatsWon}W + {party.seatsLeading}L
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: party.color }}>
                                                {party.totalCandidates}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                Candidates
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                {hasResults ? (
                                    <>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Seats Won</div>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{party.seatsWon}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vote Share</div>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{voteShare}%</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Votes</div>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{party.totalVotes.toLocaleString()}</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Candidates</div>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{party.totalCandidates}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Alliance</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                {party.alliance === 'bnp_alliance' ? 'BNP-led' :
                                                    party.alliance === 'jamaat_alliance' ? '11-Party' :
                                                        party.alliance === 'independent' ? 'Independent' : 'Others'}
                                            </div>
                                        </div>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-warning)' }}>Pre-Voting</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Division breakdown - only shown when results exist */}
                            {partyDivisionBreakdown[party.id] && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {DIVISIONS.map(div => {
                                        const count = partyDivisionBreakdown[party.id]?.[div] || 0;
                                        if (count === 0) return null;
                                        return (
                                            <span key={div} style={{
                                                fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px',
                                                background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                                            }}>
                                                {div}: <strong>{count}</strong>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {parties.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        <p>No parties found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
