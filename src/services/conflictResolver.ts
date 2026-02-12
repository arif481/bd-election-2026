import type {
    Constituency,
    Candidate,
    ConflictType,
    ConstituencyStatus,
} from '../types/election';
import type { SourceFetchResult } from './sourceManager';
import {
    updateConstituency,
    getConstituencies,
    addConflict,
    addPendingUpdate,
    addAuditEntry,
    addUpdate,
} from './firestore';
import { calculateTrustScore, shouldAutoPublish } from './verifier';

// ─── Configuration ───────────────────────────────────────────────

const VOTE_TOLERANCE_PERCENT = 5; // Within 5% = agreement
const MIN_SOURCES_FOR_DECLARED = 2; // Need 2+ agreeing sources to auto-declare
const STATUS_ORDER: ConstituencyStatus[] = ['not_started', 'counting', 'declared', 'result_confirmed', 'postponed'];

// ─── In-Memory Canonical Cache ───────────────────────────────────

const canonicalCache = new Map<string, Constituency>();
let cacheInitialized = false;

async function ensureCache(): Promise<void> {
    if (cacheInitialized) return;
    const constituencies = await getConstituencies();
    constituencies.forEach(c => canonicalCache.set(c.id, c));
    cacheInitialized = true;
}

export function getCanonical(constituencyId: string): Constituency | undefined {
    return canonicalCache.get(constituencyId);
}

// ─── Multi-Source Result Processing ──────────────────────────────

interface ProcessingResult {
    updated: number;
    conflicts: number;
    skipped: number;
    errors: number;
}

/**
 * Process results from multiple sources, detecting conflicts and
 * building consensus before writing to canonical records.
 */
export async function processMultiSourceResults(
    sourceResults: SourceFetchResult[]
): Promise<ProcessingResult> {
    await ensureCache();

    const stats: ProcessingResult = { updated: 0, conflicts: 0, skipped: 0, errors: 0 };

    // Group results by constituency across all sources
    const byConstituency = new Map<number, Array<{
        sourceId: string;
        sourceName: string;
        sourceTier: number;
        result: SourceFetchResult['results'][0];
        confidenceLevel: string;
        sourcesUsed: string[];
    }>>();

    for (const sourceResult of sourceResults) {
        for (const result of sourceResult.results) {
            const key = result.constituencyNumber;
            if (!byConstituency.has(key)) byConstituency.set(key, []);
            byConstituency.get(key)!.push({
                sourceId: sourceResult.sourceId,
                sourceName: sourceResult.sourceName,
                sourceTier: sourceResult.sourceTier,
                result,
                confidenceLevel: sourceResult.confidenceLevel,
                sourcesUsed: sourceResult.sourcesUsed,
            });
        }
    }

    // Process each constituency
    for (const [constituencyNum, sources] of byConstituency) {
        try {
            const result = await processConstituency(constituencyNum, sources);
            if (result === 'updated') stats.updated++;
            else if (result === 'conflict') stats.conflicts++;
            else stats.skipped++;
        } catch (error) {
            console.error(`[ConflictResolver] Error processing constituency ${constituencyNum}:`, error);
            stats.errors++;
        }
    }

    return stats;
}

type ProcessResult = 'updated' | 'conflict' | 'skipped';

async function processConstituency(
    constituencyNum: number,
    sources: Array<{
        sourceId: string;
        sourceName: string;
        sourceTier: number;
        result: SourceFetchResult['results'][0];
        confidenceLevel: string;
        sourcesUsed: string[];
    }>
): Promise<ProcessResult> {
    const constituencyId = `constituency-${constituencyNum}`;
    const existing = canonicalCache.get(constituencyId) || null;

    // Single source — apply normal trust scoring
    if (sources.length === 1) {
        return await applySingleSource(constituencyId, sources[0], existing);
    }

    // Multiple sources — check for conflicts
    const conflicts = detectConflicts(constituencyId, sources);

    if (conflicts.length === 0) {
        // All sources agree — build consensus and apply
        return await applyConsensus(constituencyId, sources, existing);
    }

    // Has conflicts — resolve or flag
    return await handleConflicts(constituencyId, sources, conflicts, existing);
}

// ─── Single Source Application ───────────────────────────────────

async function applySingleSource(
    constituencyId: string,
    source: {
        sourceId: string;
        sourceName: string;
        sourceTier: number;
        result: SourceFetchResult['results'][0];
        confidenceLevel: string;
        sourcesUsed: string[];
    },
    existing: Constituency | null
): Promise<ProcessResult> {
    const { score } = calculateTrustScore(
        source.result,
        existing,
        source.sourcesUsed,
        source.confidenceLevel
    );

    // Single source cannot auto-declare. Can only update vote counts during counting.
    const status = source.result.status as ConstituencyStatus;
    const effectiveStatus = (status === 'declared' || status === 'result_confirmed')
        && source.sourceTier > 1
        ? 'counting' as ConstituencyStatus // Downgrade to counting if not Tier 1
        : status;

    if (!shouldAutoPublish(score)) {
        // Stage as pending update
        await addPendingUpdate({
            constituencyId,
            constituencyName: source.result.constituencyName,
            source: source.sourceName,
            sourceTier: source.sourceTier,
            data: source.result as unknown as Record<string, unknown>,
            timestamp: Date.now(),
            trustScore: score,
            status: 'pending',
        });
        return 'skipped';
    }

    await writeConstituencyUpdate(constituencyId, source.result, effectiveStatus, score, source.sourceName, existing);
    return 'updated';
}

// ─── Consensus Building ─────────────────────────────────────────

async function applyConsensus(
    constituencyId: string,
    sources: Array<{
        sourceId: string;
        sourceName: string;
        sourceTier: number;
        result: SourceFetchResult['results'][0];
        confidenceLevel: string;
        sourcesUsed: string[];
    }>,
    existing: Constituency | null
): Promise<ProcessResult> {
    // Use highest-tier source as primary, merge vote counts
    const sorted = [...sources].sort((a, b) => a.sourceTier - b.sourceTier);
    const primary = sorted[0];

    // Weighted average of vote counts
    const mergedCandidates = mergeCandidateVotes(sources);

    const allSources = sources.flatMap(s => s.sourcesUsed);
    const { score } = calculateTrustScore(
        primary.result,
        existing,
        allSources,
        'high' // Multi-source agreement = high confidence
    );

    // Boost score for multi-source agreement
    const boostedScore = Math.min(100, score + 10);

    // Can auto-declare if 2+ Tier 1-2 sources agree
    const highTierAgreement = sources.filter(s => s.sourceTier <= 2).length;
    const status = primary.result.status as ConstituencyStatus;
    const effectiveStatus = (status === 'declared' || status === 'result_confirmed')
        && highTierAgreement >= MIN_SOURCES_FOR_DECLARED
        ? status
        : (status === 'declared' ? 'counting' as ConstituencyStatus : status);

    if (!shouldAutoPublish(boostedScore)) {
        return 'skipped';
    }

    const mergedResult = {
        ...primary.result,
        candidates: mergedCandidates,
        totalVotes: mergedCandidates.reduce((s, c) => s + c.votes, 0),
    };

    const sourceNames = sources.map(s => s.sourceName).join(' + ');
    await writeConstituencyUpdate(constituencyId, mergedResult, effectiveStatus, boostedScore, sourceNames, existing);

    // Audit the consensus
    await addAuditEntry({
        constituencyId,
        constituencyName: primary.result.constituencyName,
        action: 'auto_publish',
        source: sourceNames,
        previousData: existing ? { status: existing.status, totalVotes: existing.totalVotes } : undefined,
        newData: { status: effectiveStatus, totalVotes: mergedResult.totalVotes, candidateCount: mergedCandidates.length },
        timestamp: Date.now(),
        trustScore: boostedScore,
    });

    return 'updated';
}

// ─── Conflict Detection ─────────────────────────────────────────

interface DetectedConflict {
    type: ConflictType;
    sourceA: { name: string; tier: number; data: Record<string, unknown> };
    sourceB: { name: string; tier: number; data: Record<string, unknown> };
    severity: 'low' | 'medium' | 'high' | 'critical';
}

function detectConflicts(
    _constituencyId: string,
    sources: Array<{
        sourceId: string;
        sourceName: string;
        sourceTier: number;
        result: SourceFetchResult['results'][0];
    }>
): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];

    for (let i = 0; i < sources.length; i++) {
        for (let j = i + 1; j < sources.length; j++) {
            const a = sources[i];
            const b = sources[j];

            // Check vote mismatch
            if (a.result.totalVotes > 0 && b.result.totalVotes > 0) {
                const diff = Math.abs(a.result.totalVotes - b.result.totalVotes);
                const maxVotes = Math.max(a.result.totalVotes, b.result.totalVotes);
                const percentDiff = (diff / maxVotes) * 100;

                if (percentDiff > VOTE_TOLERANCE_PERCENT) {
                    conflicts.push({
                        type: 'vote_mismatch',
                        sourceA: { name: a.sourceName, tier: a.sourceTier, data: { totalVotes: a.result.totalVotes } },
                        sourceB: { name: b.sourceName, tier: b.sourceTier, data: { totalVotes: b.result.totalVotes } },
                        severity: percentDiff > 20 ? 'critical' : percentDiff > 10 ? 'high' : 'medium',
                    });
                }
            }

            // Check winner disagreement
            const aWinner = a.result.candidates?.find(c => c.isWinner || c.isLeading);
            const bWinner = b.result.candidates?.find(c => c.isWinner || c.isLeading);
            if (aWinner && bWinner && aWinner.partyId !== bWinner.partyId) {
                conflicts.push({
                    type: 'winner_disagreement',
                    sourceA: { name: a.sourceName, tier: a.sourceTier, data: { winner: aWinner.name, party: aWinner.partyId } },
                    sourceB: { name: b.sourceName, tier: b.sourceTier, data: { winner: bWinner.name, party: bWinner.partyId } },
                    severity: 'critical',
                });
            }

            // Check status regression
            const aIdx = STATUS_ORDER.indexOf(a.result.status as ConstituencyStatus);
            const bIdx = STATUS_ORDER.indexOf(b.result.status as ConstituencyStatus);
            if (aIdx >= 0 && bIdx >= 0 && Math.abs(aIdx - bIdx) > 1) {
                conflicts.push({
                    type: 'status_regression',
                    sourceA: { name: a.sourceName, tier: a.sourceTier, data: { status: a.result.status } },
                    sourceB: { name: b.sourceName, tier: b.sourceTier, data: { status: b.result.status } },
                    severity: 'high',
                });
            }
        }
    }

    return conflicts;
}

// ─── Conflict Handling ───────────────────────────────────────────

async function handleConflicts(
    constituencyId: string,
    sources: Array<{
        sourceId: string;
        sourceName: string;
        sourceTier: number;
        result: SourceFetchResult['results'][0];
        confidenceLevel: string;
        sourcesUsed: string[];
    }>,
    conflicts: DetectedConflict[],
    existing: Constituency | null
): Promise<ProcessResult> {
    // For vote mismatches only, use the higher-tier source automatically
    const hasOnlyVoteMismatch = conflicts.every(c => c.type === 'vote_mismatch') &&
        conflicts.every(c => c.severity !== 'critical');

    if (hasOnlyVoteMismatch) {
        // Auto-resolve: prefer higher tier source
        const bestSource = [...sources].sort((a, b) => a.sourceTier - b.sourceTier)[0];
        const allSources = sources.flatMap(s => s.sourcesUsed);
        const { score } = calculateTrustScore(
            bestSource.result, existing, allSources, bestSource.confidenceLevel
        );

        if (shouldAutoPublish(score)) {
            await writeConstituencyUpdate(
                constituencyId, bestSource.result,
                bestSource.result.status as ConstituencyStatus,
                score, bestSource.sourceName + ' (auto-resolved)', existing
            );

            // Log auto-resolved conflicts
            for (const conflict of conflicts) {
                await addConflict({
                    constituencyId,
                    constituencyName: bestSource.result.constituencyName,
                    type: conflict.type,
                    sourceA: { ...conflict.sourceA, timestamp: Date.now() },
                    sourceB: { ...conflict.sourceB, timestamp: Date.now() },
                    severity: conflict.severity,
                    resolvedBy: 'auto_consensus',
                    resolvedAt: Date.now(),
                    resolution: `Auto-resolved: preferred ${bestSource.sourceName} (Tier ${bestSource.sourceTier})`,
                    createdAt: Date.now(),
                });
            }

            return 'updated';
        }
    }

    // Critical conflicts — flag for admin review
    for (const conflict of conflicts) {
        await addConflict({
            constituencyId,
            constituencyName: sources[0].result.constituencyName,
            type: conflict.type,
            sourceA: { ...conflict.sourceA, timestamp: Date.now() },
            sourceB: { ...conflict.sourceB, timestamp: Date.now() },
            severity: conflict.severity,
            resolvedBy: 'pending',
            resolvedAt: 0,
            createdAt: Date.now(),
        });
    }

    // Stage all source data as pending
    for (const source of sources) {
        await addPendingUpdate({
            constituencyId,
            constituencyName: source.result.constituencyName,
            source: source.sourceName,
            sourceTier: source.sourceTier,
            data: source.result as unknown as Record<string, unknown>,
            timestamp: Date.now(),
            trustScore: 50, // Lower trust due to conflict
            status: 'pending',
        });
    }

    return 'conflict';
}

// ─── Candidate Vote Merging ──────────────────────────────────────

function mergeCandidateVotes(
    sources: Array<{
        sourceTier: number;
        result: SourceFetchResult['results'][0];
    }>
): Array<{ name: string; party: string; partyId: string; votes: number; isWinner: boolean; isLeading: boolean }> {
    // Collect all candidates across sources
    const candidateMap = new Map<string, {
        name: string;
        party: string;
        partyId: string;
        voteWeights: Array<{ votes: number; weight: number }>;
        isWinner: boolean;
        isLeading: boolean;
    }>();

    for (const source of sources) {
        const weight = getSourceWeight(source.sourceTier);
        for (const candidate of (source.result.candidates || [])) {
            const key = candidate.partyId || candidate.name.toLowerCase();
            if (!candidateMap.has(key)) {
                candidateMap.set(key, {
                    name: candidate.name,
                    party: candidate.party,
                    partyId: candidate.partyId,
                    voteWeights: [],
                    isWinner: false,
                    isLeading: false,
                });
            }
            const entry = candidateMap.get(key)!;
            entry.voteWeights.push({ votes: candidate.votes, weight });
            if (candidate.isWinner) entry.isWinner = true;
            if (candidate.isLeading) entry.isLeading = true;
        }
    }

    // Calculate weighted average votes
    return Array.from(candidateMap.values()).map(c => {
        const totalWeight = c.voteWeights.reduce((s, v) => s + v.weight, 0);
        const weightedVotes = totalWeight > 0
            ? Math.round(c.voteWeights.reduce((s, v) => s + v.votes * v.weight, 0) / totalWeight)
            : 0;

        return {
            name: c.name,
            party: c.party,
            partyId: c.partyId,
            votes: weightedVotes,
            isWinner: c.isWinner,
            isLeading: c.isLeading,
        };
    }).sort((a, b) => b.votes - a.votes);
}

function getSourceWeight(tier: number): number {
    switch (tier) {
        case 1: return 1.0;  // Official
        case 2: return 0.8;  // Major BD
        case 3: return 0.5;  // International
        case 4: return 1.0;  // Manual (admin)
        default: return 0.5;
    }
}

// ─── Write Constituency Update ───────────────────────────────────

async function writeConstituencyUpdate(
    constituencyId: string,
    result: SourceFetchResult['results'][0],
    status: ConstituencyStatus,
    trustScore: number,
    source: string,
    existing: Constituency | null
): Promise<void> {
    const candidates: Candidate[] = (result.candidates || []).map(c => ({
        name: c.name,
        party: c.partyId || 'others',
        votes: c.votes || 0,
        isWinner: c.isWinner || false,
        isLeading: c.isLeading || false,
    }));

    const updateData: Partial<Constituency> = {
        name: result.constituencyName,
        number: result.constituencyNumber,
        division: result.division,
        district: result.district || '',
        candidates,
        status,
        totalVotes: result.totalVotes || 0,
        winMargin: result.winMargin || 0,
        trustScore,
        source,
    };

    await updateConstituency(constituencyId, updateData);

    // Update cache
    const cached = canonicalCache.get(constituencyId);
    if (cached) {
        Object.assign(cached, updateData, { lastUpdated: Date.now() });
    }

    // Create ticker update
    const winnerInfo = candidates.find(c => c.isWinner || c.isLeading);
    let message = `${result.constituencyName}: Counting in progress`;
    if (status === 'declared' && winnerInfo) {
        message = `${result.constituencyName}: ${winnerInfo.name} (${winnerInfo.party}) wins with ${winnerInfo.votes?.toLocaleString()} votes`;
    } else if (winnerInfo) {
        message = `${result.constituencyName}: ${winnerInfo.name} (${winnerInfo.party}) leading with ${winnerInfo.votes?.toLocaleString()} votes`;
    }

    const existingLeader = existing?.candidates.find(c => c.isLeading || c.isWinner);
    const isLeadChange = existingLeader && winnerInfo && existingLeader.party !== winnerInfo.party;

    await addUpdate({
        constituencyId,
        constituencyName: result.constituencyName,
        timestamp: Date.now(),
        type: status === 'declared' ? 'result_declared' :
            isLeadChange ? 'lead_change' : 'vote_update',
        message,
        trustScore,
        source,
        isVerified: shouldAutoPublish(trustScore),
    });
}

// ─── Admin Override ──────────────────────────────────────────────

export async function adminResolveConflict(
    constituencyId: string,
    resolvedData: Partial<Constituency>,
    // adminNote unused for now

): Promise<void> {
    await updateConstituency(constituencyId, {
        ...resolvedData,
        trustScore: 100,
        source: 'admin_override',
    });

    await addAuditEntry({
        constituencyId,
        constituencyName: resolvedData.name || constituencyId,
        action: 'manual_override',
        source: 'Admin',
        newData: resolvedData as unknown as Record<string, unknown>,
        timestamp: Date.now(),
        trustScore: 100,
    });
}
