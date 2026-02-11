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

import { ContextBanner } from '../components/ContextBanner';
import { MobileFAB } from '../components/MobileFAB';

// Define DivisionStats type locally or import if shared
type DivisionStats = Record<string, { total: number; declared: number; leadingParty: string }>;

export function Home() {
    const [summary, setSummary] = useState<ElectionSummary | null>(null);
    const [updates, setUpdates] = useState<ElectionUpdate[]>([]);
    const [referendum, setReferendum] = useState<ReferendumResult | undefined>(undefined);
    const [constituencies, setConstituencies] = useState<Constituency[]>([]);

    useEffect(() => {
        const unsubs = [
            onElectionSummaryChange(setSummary),
            onRecentUpdatesChange(setUpdates),
            onReferendumChange(setReferendum),
            onConstituenciesChange(setConstituencies)
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
        return stats;
    }, [constituencies]);

    return (
        <div className="page">
            <LiveTicker updates={updates} />

            <div className="app-container">
                <ContextBanner />
                <PhaseBanner phase={summary?.phase || 'pre_voting'} />

                <StatsGrid summary={summary} />

                <div className="dashboard-grid">
                    <div className="dashboard-col">
                        <AllianceTracker summary={summary} />
                        <div style={{ height: '20px' }} />
                        <PartyScoreboard
                            parties={summary?.parties || []}
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
