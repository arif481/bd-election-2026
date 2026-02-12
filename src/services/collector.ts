import { fetchFromMultipleSources, getAllSourceStates, getActiveSourceCount, getSourceSummary } from './sourceManager';
import { processMultiSourceResults } from './conflictResolver';
import { collectNews, getNewsCollectorStats } from './newsCollector';
import {
    updateSystemStatus,
    getConstituencies,
    updateSummary,
    updateSourceStatuses,
} from './firestore';
import type { ElectionSummary, SystemStatus } from '../types/election';
import { logError } from './errorLogger';
import { PARTIES } from '../data/parties';

// ─── Collection Timing ───────────────────────────────────────────

const BST_OFFSET = 6; // UTC+6

function getBSTHour(): number {
    const now = new Date();
    return (now.getUTCHours() + BST_OFFSET) % 24;
}

export function getCollectionPhase(): SystemStatus['collectionPhase'] {
    const hour = getBSTHour();
    const minutes = new Date().getUTCMinutes();

    if (hour < 7 || (hour === 7 && minutes < 30)) return 'pre_voting';
    if (hour < 16 || (hour === 16 && minutes < 30)) return 'voting';
    if (hour < 19) return 'early_results';
    if (hour < 23) return 'peak_results';
    return 'late_results';
}

export function getIntervalMs(): number {
    const phase = getCollectionPhase();
    switch (phase) {
        case 'pre_voting': return 0;          // OFF
        case 'voting': return 0;              // OFF
        case 'early_results': return 60_000;  // 1 min
        case 'peak_results': return 60_000;   // 1 min
        case 'late_results': return 120_000;  // 2 min
        case 'cleanup': return 600_000;       // 10 min
        case 'completed': return 0;           // OFF
        default: return 0;
    }
}

export function isCollectionActive(): boolean {
    const phase = getCollectionPhase();
    return !['pre_voting', 'voting', 'completed'].includes(phase);
}

// ─── Collection Engine ───────────────────────────────────────────

let collectionTimer: ReturnType<typeof setInterval> | null = null;
let apiCallsToday = 0;
let errorsToday = 0;
let cycleCount = 0;
const declaredSeats = new Set<string>();

export async function startCollection(): Promise<void> {
    if (collectionTimer) {
        console.log('[Collector] Already running');
        return;
    }

    console.log('[Collector] Starting multi-source collection engine...');

    // Initialize declaredSeats from existing data
    const existing = await getConstituencies();
    existing.forEach(c => {
        if (c.status === 'declared' || c.status === 'result_confirmed') {
            declaredSeats.add(c.id);
        }
    });
    console.log(`[Collector] Initialized with ${declaredSeats.size} declared seats`);

    await updateSystemStatus({
        isCollecting: true,
        collectionPhase: getCollectionPhase(),
        lastFetchTime: Date.now(),
        seatsDeclared: declaredSeats.size,
        activeSources: getActiveSourceCount(),
    });

    // Initial fetch
    await runCollectionCycle();

    // Schedule periodic fetches
    scheduleNextFetch();
}

export function stopCollection(): void {
    if (collectionTimer) {
        clearTimeout(collectionTimer);
        collectionTimer = null;
    }
    updateSystemStatus({ isCollecting: false });
    console.log('[Collector] Stopped');
}

function scheduleNextFetch(): void {
    const interval = getIntervalMs();
    if (interval <= 0) {
        console.log('[Collector] Collection not active for current phase');
        // Re-check every minute if we should start
        collectionTimer = setTimeout(() => {
            collectionTimer = null;
            if (isCollectionActive()) {
                startCollection();
            } else {
                scheduleNextFetch();
            }
        }, 60_000);
        return;
    }

    console.log(`[Collector] Next fetch in ${interval / 1000}s`);
    collectionTimer = setTimeout(async () => {
        collectionTimer = null;
        await runCollectionCycle();
        scheduleNextFetch();
    }, interval);
}

async function runCollectionCycle(): Promise<void> {
    const phase = getCollectionPhase();
    cycleCount++;
    console.log(`[Collector] Running cycle #${cycleCount} (phase: ${phase})`);

    try {
        // Strategy: Alternate between result fetching and news collection
        if (cycleCount % 3 === 0) {
            // Every 3rd cycle: collect news automatically
            console.log('[Collector] News collection cycle');
            const newsResult = await collectNews();
            console.log(`[Collector] News: ${newsResult.message}`);
        }

        // Always fetch results from multiple sources (2 sources per cycle, rotating)
        const sourcesToFetch = phase === 'peak_results' ? 3 : 2;
        apiCallsToday += sourcesToFetch;

        const sourceResults = await fetchFromMultipleSources(sourcesToFetch);

        if (sourceResults.length > 0) {
            // Process through conflict resolver
            const processResult = await processMultiSourceResults(sourceResults);
            console.log(`[Collector] Processed: ${processResult.updated} updated, ${processResult.conflicts} conflicts, ${processResult.skipped} skipped`);

            // Update declared seats from processed data
            const latest = await getConstituencies();
            declaredSeats.clear();
            latest.forEach(c => {
                if (c.status === 'declared' || c.status === 'result_confirmed') {
                    declaredSeats.add(c.id);
                }
            });
        }

        // Update election summary
        await updateElectionSummary();

        // Sync source states to Firestore for admin monitoring
        await updateSourceStatuses(getAllSourceStates());

        // Sync system status
        const newsStats = getNewsCollectorStats();
        const sourceSummary = getSourceSummary();

        await updateSystemStatus({
            lastFetchTime: Date.now(),
            nextFetchTime: Date.now() + getIntervalMs(),
            apiCallsToday,
            errorsToday,
            collectionPhase: phase,
            seatsDeclared: declaredSeats.size,
            seatsTotal: 300,
            activeSources: sourceSummary.activeSources,
            totalConflicts: sourceSummary.totalErrors, // Proxy for now
            autoNewsCount: newsStats.totalAutoFetched,
        });

    } catch (error) {
        errorsToday++;
        console.error('[Collector] Cycle error:', error);
        await logError('other', 'Collection cycle failed', String(error));
    }
}

async function updateElectionSummary(): Promise<void> {
    const constituencies = await getConstituencies();

    const partyCounts: Record<string, { won: number; leading: number; votes: number }> = {};
    PARTIES.forEach(p => {
        partyCounts[p.id] = { won: 0, leading: 0, votes: 0 };
    });

    let totalDeclared = 0;
    let totalVotes = 0;
    let totalTurnout = 0;
    let turnoutCount = 0;

    constituencies.forEach(c => {
        if (c.status === 'declared' || c.status === 'result_confirmed') {
            totalDeclared++;
            const winner = c.candidates.find(cd => cd.isWinner);
            if (winner && partyCounts[winner.party]) {
                partyCounts[winner.party].won++;
            }
        } else if (c.status === 'counting') {
            const leader = c.candidates.find(cd => cd.isLeading);
            if (leader && partyCounts[leader.party]) {
                partyCounts[leader.party].leading++;
            }
        }

        c.candidates.forEach(cd => {
            if (partyCounts[cd.party]) {
                partyCounts[cd.party].votes += cd.votes;
            }
            totalVotes += cd.votes;
        });

        if (c.turnoutPercent) {
            totalTurnout += c.turnoutPercent;
            turnoutCount++;
        }
    });

    const partyData = PARTIES.map(p => ({
        ...p,
        seatsWon: partyCounts[p.id]?.won || 0,
        seatsLeading: partyCounts[p.id]?.leading || 0,
        totalVotes: partyCounts[p.id]?.votes || 0,
    }));

    // Find leading party safely
    const leadingPartyVal = partyData.reduce((a, b) =>
        (a.seatsWon + a.seatsLeading) > (b.seatsWon + b.seatsLeading) ? a : b
        , partyData[0]); // Initial value to prevent empty reduce error

    const summary: Partial<ElectionSummary> = {
        totalSeats: 300,
        seatsDeclared: totalDeclared,
        seatsRemaining: 300 - totalDeclared,
        totalVotesCounted: totalVotes,
        avgTurnout: turnoutCount > 0 ? Math.round(totalTurnout / turnoutCount) : 0,
        parties: partyData,
        leadingParty: leadingPartyVal?.id || 'others',
        phase: getCollectionPhase(),
    };

    await updateSummary(summary);
}

// ─── Manual trigger for admin ────────────────────────────────────

export async function manualFetch(): Promise<{ success: boolean; message: string }> {
    try {
        const sourceResults = await fetchFromMultipleSources(3);
        if (sourceResults.length === 0) {
            return { success: false, message: 'No sources returned data' };
        }

        const result = await processMultiSourceResults(sourceResults);
        await updateElectionSummary();
        await updateSourceStatuses(getAllSourceStates());

        return {
            success: true,
            message: `Fetched from ${sourceResults.length} sources: ${result.updated} updated, ${result.conflicts} conflicts, ${result.skipped} skipped`
        };
    } catch (error) {
        return { success: false, message: `Fetch failed: ${error}` };
    }
}

export function getCollectorStats() {
    const sourceSummary = getSourceSummary();
    const newsStats = getNewsCollectorStats();
    return {
        apiCallsToday,
        errorsToday,
        declaredSeats: declaredSeats.size,
        phase: getCollectionPhase(),
        isActive: isCollectionActive(),
        interval: getIntervalMs(),
        cycleCount,
        sources: sourceSummary,
        news: newsStats,
    };
}
