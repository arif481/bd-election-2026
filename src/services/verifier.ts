import type { Constituency } from '../types/election';

interface TrustFactors {
    sourceAgreement: number;    // 0-100: multiple sources agree
    sourceReliability: number;  // 0-100: how reliable is the source
    dataCompleteness: number;   // 0-100: all fields present
    temporalConsistency: number;// 0-100: votes only increase
    aiConfidence: number;       // 0-100: AI's own confidence
}

const WEIGHTS = {
    sourceAgreement: 0.40,
    sourceReliability: 0.25,
    dataCompleteness: 0.15,
    temporalConsistency: 0.10,
    aiConfidence: 0.10,
};

const RELIABLE_SOURCES = [
    'bssnews.net',          // Bangladesh Sangbad Sangstha (official)
    'ec.org.bd',            // Election Commission
    'bdnews24.com',         //  Major news portal
    'thedailystar.net',     // The Daily Star
    'prothomalo.com',       // Prothom Alo
    'dhakatribune.com',     // Dhaka Tribune
    'newagebd.net',         // New Age
    'risingbd.com',         // Rising BD
];

export function calculateTrustScore(
    result: any,
    existingData: Constituency | null,
    sourcesUsed: string[],
    aiConfidence: string,
): { score: number; factors: TrustFactors } {
    const factors: TrustFactors = {
        sourceAgreement: calculateSourceAgreement(sourcesUsed),
        sourceReliability: calculateSourceReliability(sourcesUsed),
        dataCompleteness: calculateDataCompleteness(result),
        temporalConsistency: calculateTemporalConsistency(result, existingData),
        aiConfidence: mapAiConfidence(aiConfidence),
    };

    const score = Math.round(
        factors.sourceAgreement * WEIGHTS.sourceAgreement +
        factors.sourceReliability * WEIGHTS.sourceReliability +
        factors.dataCompleteness * WEIGHTS.dataCompleteness +
        factors.temporalConsistency * WEIGHTS.temporalConsistency +
        factors.aiConfidence * WEIGHTS.aiConfidence
    );

    return { score: Math.min(100, Math.max(0, score)), factors };
}

function calculateSourceAgreement(sources: string[]): number {
    if (sources.length >= 3) return 100;
    if (sources.length === 2) return 70;
    if (sources.length === 1) return 40;
    return 10;
}

function calculateSourceReliability(sources: string[]): number {
    if (!sources.length) return 10;

    const reliableCount = sources.filter(s =>
        RELIABLE_SOURCES.some(rs => s.includes(rs))
    ).length;

    if (reliableCount >= 2) return 100;
    if (reliableCount === 1) return 70;
    return 30;
}

function calculateDataCompleteness(result: any): number {
    let score = 0;
    const fields = ['constituencyNumber', 'constituencyName', 'candidates', 'totalVotes', 'status'];

    fields.forEach(field => {
        if (result[field] !== undefined && result[field] !== null) {
            score += 20;
        }
    });

    // Check candidate data quality
    if (result.candidates && result.candidates.length > 0) {
        const hasVotes = result.candidates.some((c: any) => c.votes > 0);
        const hasParty = result.candidates.every((c: any) => c.party);
        if (hasVotes) score = Math.min(100, score + 10);
        if (hasParty) score = Math.min(100, score + 10);
    }

    return Math.min(100, score);
}

function calculateTemporalConsistency(result: any, existing: Constituency | null): number {
    if (!existing || existing.status === 'not_started') return 80; // No previous data to conflict

    // Votes should only increase
    if (result.totalVotes && existing.totalVotes) {
        if (result.totalVotes < existing.totalVotes * 0.9) {
            return 20; // Suspicious decrease
        }
    }

    // Status should progress forward
    const statusOrder = ['not_started', 'counting', 'declared', 'result_confirmed'];
    const existingIdx = statusOrder.indexOf(existing.status);
    const newIdx = statusOrder.indexOf(result.status);

    if (newIdx < existingIdx) return 30; // Status went backward

    return 90;
}

function mapAiConfidence(confidence: string): number {
    switch (confidence) {
        case 'high': return 90;
        case 'medium': return 60;
        case 'low': return 30;
        default: return 50;
    }
}

// ─── Thresholds ──────────────────────────────────────────────────

export const TRUST_THRESHOLDS = {
    AUTO_PUBLISH: 70,
    SHOW_WITH_WARNING: 50,
    NEEDS_REVIEW: 50,
};

export function shouldAutoPublish(score: number): boolean {
    return score >= TRUST_THRESHOLDS.AUTO_PUBLISH;
}

export function needsReview(score: number): boolean {
    return score < TRUST_THRESHOLDS.NEEDS_REVIEW;
}

export function getTrustLabel(score: number): { label: string; color: string; emoji: string } {
    if (score >= 80) return { label: 'Verified', color: '#4CAF50', emoji: '✅' };
    if (score >= 70) return { label: 'Confident', color: '#8BC34A', emoji: '🟢' };
    if (score >= 50) return { label: 'Unverified', color: '#FF9800', emoji: '⚠️' };
    return { label: 'Low Trust', color: '#F44336', emoji: '🔴' };
}
