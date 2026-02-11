import { fetchElectionResults, fetchDivisionResults, type GeminiResult } from './gemini';
import { calculateTrustScore, shouldAutoPublish } from './verifier';
import {
    updateConstituency,
    addUpdate,
    updateSummary,
    updateSystemStatus,
    getConstituencies,
} from './firestore';
import type { Candidate, ConstituencyStatus, SystemStatus, ElectionSummary } from '../types/election';
import { DIVISIONS } from '../types/election';
import { PARTIES } from '../data/parties';

// ─── Collection Timing ───────────────────────────────────────────

const BST_OFFSET = 6; // UTC+6

function getBSTHour(): number {
    const now = new Date();
    return (now.getUTCHours() + BST_OFFSET) % 24;
}

export function getCollectionPhase(): SystemStatus['collectionPhase'] {
    const hour = getBSTHour();

    if (hour < 7 || (hour === 7 && new Date().getUTCMinutes() < 30)) return 'pre_voting';
    if (hour < 16 || (hour === 16 && new Date().getUTCMinutes() < 30)) return 'voting';
    if (hour < 19) return 'early_results';
    if (hour < 24) return 'peak_results';
    if (hour < 8) return 'late_results';
    return 'cleanup';
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
const declaredSeats = new Set<string>();

export async function startCollection(): Promise<void> {
    if (collectionTimer) {
        console.log('[Collector] Already running');
        return;
    }

    console.log('[Collector] Starting collection engine...');

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
        seatsDeclared: declaredSeats.size, // Sync immediately
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
    console.log(`[Collector] Running cycle (phase: ${phase})`);

    try {
        // Strategy: Alternate between full fetch and division-level fetches
        if (apiCallsToday % 3 === 0) {
            // Every 3rd call: full results fetch
            await fetchAndProcessAll();
        } else {
            // Division-level fetches (2 divisions at a time to save API quota)
            const divisionIdx = (apiCallsToday % 4) * 2;
            const divisions = DIVISIONS.filter((_, i) => i >= divisionIdx && i < divisionIdx + 2);
            for (const div of divisions) {
                await fetchAndProcessDivision(div);
            }
        }

        await updateSystemStatus({
            lastFetchTime: Date.now(),
            nextFetchTime: Date.now() + getIntervalMs(),
            apiCallsToday,
            errorsToday,
            collectionPhase: phase,
            seatsDeclared: declaredSeats.size,
            seatsTotal: 300,
        });

    } catch (error) {
        errorsToday++;
        console.error('[Collector] Cycle error:', error);
    }
}

async function fetchAndProcessAll(): Promise<void> {
    apiCallsToday++;
    const data = await fetchElectionResults();
    if (!data || !data.results.length) return;
    await processResults(data);
}

async function fetchAndProcessDivision(division: string): Promise<void> {
    apiCallsToday++;
    const data = await fetchDivisionResults(division);
    if (!data || !data.results.length) return;
    await processResults(data);
}

async function processResults(data: GeminiResult): Promise<void> {
    const existingConstituencies = await getConstituencies();
    const existingMap = new Map(existingConstituencies.map((c: any) => [c.number, c]));

    for (const result of data.results) {
        try {
            const existing = existingMap.get(result.constituencyNumber) || null;
            const { score } = calculateTrustScore(
                result,
                existing,
                data.sourcesUsed || [],
                data.confidenceLevel || 'medium'
            );

            const candidates: Candidate[] = (result.candidates || []).map(c => ({
                name: c.name,
                party: c.partyId || 'others',
                votes: c.votes || 0,
                isWinner: c.isWinner || false,
                isLeading: c.isLeading || false,
            }));

            const constituencyId = `constituency-${result.constituencyNumber}`;
            const status = (result.status as ConstituencyStatus) || 'counting';

            if (shouldAutoPublish(score)) {
                await updateConstituency(constituencyId, {
                    name: result.constituencyName,
                    number: result.constituencyNumber,
                    division: result.division,
                    district: result.district || '',
                    candidates,
                    status,
                    totalVotes: result.totalVotes || 0,
                    winMargin: result.winMargin || 0,
                    trustScore: score,
                    source: (data.sourcesUsed || []).join(', '),
                });

                if (status === 'declared' || status === 'result_confirmed') {
                    declaredSeats.add(constituencyId);
                }
            }

            // Always add an update entry
            const existingLeader = existing?.candidates.find((c: any) => c.isLeading || c.isWinner);
            const newLeader = candidates.find(c => c.isLeading || c.isWinner);

            const isLeadChange = existingLeader && newLeader && existingLeader.party !== newLeader.party;

            // Safe Access for message formatting
            const winnerInfo = candidates.find(c => c.isWinner || c.isLeading);
            let message = `${result.constituencyName}: Counting in progress`;
            if (status === 'declared' && winnerInfo) {
                message = `${result.constituencyName}: ${winnerInfo.name} (${winnerInfo.party}) wins with ${winnerInfo.votes?.toLocaleString()} votes`;
            } else if (winnerInfo) {
                message = `${result.constituencyName}: ${winnerInfo.name} (${winnerInfo.party}) leading with ${winnerInfo.votes?.toLocaleString()} votes`;
            }

            await addUpdate({
                constituencyId,
                constituencyName: result.constituencyName,
                timestamp: Date.now(),
                type: status === 'declared' ? 'result_declared' :
                    isLeadChange ? 'lead_change' : 'vote_update',
                message,
                trustScore: score,
                source: (data.sourcesUsed || []).join(', '),
                isVerified: shouldAutoPublish(score),
            });

        } catch (error) {
            console.error(`[Collector] Error processing constituency ${result.constituencyNumber}:`, error);
        }
    }

    // Update summary
    await updateElectionSummary();
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
        await fetchAndProcessAll();
        return { success: true, message: 'Fetch completed successfully' };
    } catch (error) {
        return { success: false, message: `Fetch failed: ${error}` };
    }
}

export function getCollectorStats() {
    return {
        apiCallsToday,
        errorsToday,
        declaredSeats: declaredSeats.size,
        phase: getCollectionPhase(),
        isActive: isCollectionActive(),
        interval: getIntervalMs(),
    };
}
