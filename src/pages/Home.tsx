import { useState, useEffect, useMemo } from 'react';
import { PhaseBanner } from '../components/PhaseBanner';
import { StatsGrid } from '../components/StatsGrid';
import { PartyScoreboard } from '../components/PartyScoreboard';
import { LiveTicker } from '../components/LiveTicker';
import { DivisionMap } from '../components/DivisionMap';
import { AllianceTracker } from '../components/AllianceTracker';
import { ReferendumTracker } from '../components/ReferendumTracker';
import { NewsFeed } from '../components/NewsFeed';
import {
    onElectionSummaryChange,
    onRecentUpdatesChange,
    onReferendumChange,
    onConstituenciesChange
} from '../services/firestore';
import type { ElectionSummary, ElectionUpdate, ReferendumResult, Constituency } from '../types/election';
import { ELECTION } from '../data/constants';
import { CONSTITUENCIES } from '../data/constituencies';
import { PARTIES } from '../data/parties';

import { ContextBanner } from '../components/ContextBanner';
import { MobileFAB } from '../components/MobileFAB';

// Define DivisionStats type locally or import if shared
type DivisionStats = Record<string, { total: number; declared: number; leadingParty: string }>;

// Default summary so stats render immediately instead of eternal skeleton loaders
const DEFAULT_SUMMARY: ElectionSummary = {
    totalSeats: 300,
    seatsDeclared: 0,
    seatsRemaining: 300,
    totalVotesCounted: 0,
    avgTurnout: 0,
    lastUpdated: 0,
    parties: PARTIES.map(p => ({ ...p })),
    leadingParty: '',
    phase: 'pre_voting',
};

export function Home() {
    const [summary, setSummary] = useState<ElectionSummary>(DEFAULT_SUMMARY);
    const [updates, setUpdates] = useState<ElectionUpdate[]>([]);
    const [referendum, setReferendum] = useState<ReferendumResult | undefined>(undefined);
    const [constituencies, setConstituencies] = useState<Constituency[]>(CONSTITUENCIES);

    useEffect(() => {
        const unsubs = [
            onElectionSummaryChange((data) => {
                if (data) setSummary(data);
            }),
            onRecentUpdatesChange(setUpdates),
            onReferendumChange(setReferendum),
            onConstituenciesChange((data) => {
                // Only use Firestore data if it has entries, otherwise keep local fallback
                if (data.length > 0) setConstituencies(data);
            })
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    const divisionStats: DivisionStats = useMemo(() => {
        const stats: DivisionStats = {};
        constituencies.forEach(c => {
            if (!stats[c.division]) {
                stats[c.division] = { total: 0, declared: 0, leadingParty: '' };
            }
            stats[c.division].total++;
            if (c.status === 'declared' || c.status === 'result_confirmed') {
                stats[c.division].declared++;
            }
        });

        // Calculate leading party per division
        constituencies.forEach(c => {
            const winner = c.candidates.find(cd => cd.isWinner || cd.isLeading);
            if (winner && stats[c.division]) {
                // Simple approach: count wins per party per division
                const partyWins: Record<string, number> = {};
                constituencies
                    .filter(cc => cc.division === c.division)
                    .forEach(cc => {
                        const w = cc.candidates.find(cd => cd.isWinner || cd.isLeading);
                        if (w) partyWins[w.party] = (partyWins[w.party] || 0) + 1;
                    });
                const topParty = Object.entries(partyWins).sort((a, b) => b[1] - a[1])[0];
                if (topParty) stats[c.division].leadingParty = topParty[0];
            }
        });

        return stats;
    }, [constituencies]);

    return (
        <div className="page">
            <LiveTicker updates={updates} />

            <div className="app-container">
                <ContextBanner />
                <PhaseBanner phase={summary.phase || 'pre_voting'} />

                <StatsGrid summary={summary} />

                <div className="dashboard-grid">
                    <div className="dashboard-col">
                        <AllianceTracker summary={summary} />
                        <div style={{ height: '20px' }} />
                        <PartyScoreboard
                            parties={summary.parties || []}
                            totalSeats={ELECTION.activeSeats}
                        />
                    </div>

                    <div id="map-view" className="dashboard-col">
                        <div className="card-glass" style={{ padding: '20px', minHeight: '400px' }}>
                            <DivisionMap
                                divisionStats={divisionStats}
                                constituencies={constituencies}
                            />
                        </div>
                        <div style={{ height: '20px' }} />
                        <ReferendumTracker result={referendum} />
                    </div>

                    <div id="news-feed" className="dashboard-col">
                        <NewsFeed />
                    </div>
                </div>
            </div>

            <MobileFAB />
        </div>
    );
}
