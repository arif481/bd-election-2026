import type { Constituency } from '../types/election';

interface TrustFactors {
    sourceAgreement: number;      // 0-100: multiple sources agree
    crossSourceAgreement: number; // 0-100: cross-source verification
    sourceReliability: number;    // 0-100: how reliable is the source
    dataCompleteness: number;     // 0-100: all fields present
    temporalConsistency: number;  // 0-100: votes only increase
    aiConfidence: number;         // 0-100: AI's own confidence
}

const WEIGHTS = {
    sourceAgreement: 0.25,
    crossSourceAgreement: 0.20,
    sourceReliability: 0.20,
    dataCompleteness: 0.15,
    temporalConsistency: 0.10,
    aiConfidence: 0.10,
};

const RELIABLE_SOURCES = [
    'ec.org.bd',
    'bssnews.net',
    'bdnews24.com',
    'thedailystar.net',
    'prothomalo.com',
    'dhakatribune.com',
    'bbc.com',
    'aljazeera.com',
    'reuters.com',
    'ap.org',
    'ndtv.com',
    'indiatoday.in',
    'newagebd.net',
    'samakal.com',
    'EC / BSS (Official)',
    'The Daily Star',
    'Prothom Alo',
    'Dhaka Tribune',
    'International Media',
    'bdnews24.com',
];

const TRUST_THRESHOLD = 55; // Minimum score for auto-publish

// ─── Calculate Trust Score ───────────────────────────────────────

export function calculateTrustScore(
    incoming: unknown,
    existing: Constituency | null,
    sourcesUsed: string[],
    confidence: string,
): { score: number; factors: TrustFactors } {
    const factors: TrustFactors = {
        sourceAgreement: 0,
        crossSourceAgreement: 0,
        sourceReliability: 0,
        dataCompleteness: 0,
        temporalConsistency: 0,
        aiConfidence: 0,
    };

    // 1. Source Agreement — how many sources provided this data
    const uniqueSources = new Set(sourcesUsed);
    if (uniqueSources.size >= 3) factors.sourceAgreement = 100;
    else if (uniqueSources.size === 2) factors.sourceAgreement = 75;
    else factors.sourceAgreement = 40;

    // 2. Cross-Source Agreement — do multiple named sources agree
    const reliableHits = sourcesUsed.filter(s =>
        RELIABLE_SOURCES.some(rs =>
            s.toLowerCase().includes(rs.toLowerCase()) ||
            rs.toLowerCase().includes(s.toLowerCase())
        )
    );
    if (reliableHits.length >= 3) factors.crossSourceAgreement = 100;
    else if (reliableHits.length === 2) factors.crossSourceAgreement = 80;
    else if (reliableHits.length === 1) factors.crossSourceAgreement = 50;
    else factors.crossSourceAgreement = 20;

    // 3. Source Reliability
    const sourceLower = sourcesUsed.join(' ').toLowerCase();
    if (sourceLower.includes('ec.org.bd') || sourceLower.includes('bssnews') || sourceLower.includes('official')) {
        factors.sourceReliability = 100;
    } else if (sourceLower.includes('bdnews24') || sourceLower.includes('dailystar') || sourceLower.includes('prothomalo')) {
        factors.sourceReliability = 85;
    } else if (sourceLower.includes('bbc') || sourceLower.includes('aljazeera') || sourceLower.includes('reuters')) {
        factors.sourceReliability = 80;
    } else if (sourceLower.includes('ndtv') || sourceLower.includes('indiatoday')) {
        factors.sourceReliability = 70;
    } else {
        factors.sourceReliability = 40;
    }

    // 4. Data Completeness
    const data = incoming as any;
    let completeness = 0;
    if (data.constituencyName) completeness += 20;
    if (data.constituencyNumber) completeness += 20;
    if (data.candidates && data.candidates.length > 0) completeness += 25;
    if (data.totalVotes && data.totalVotes > 0) completeness += 20;
    if (data.status) completeness += 15;
    factors.dataCompleteness = completeness;

    // 5. Temporal Consistency (votes should only increase)
    if (existing && existing.totalVotes > 0) {
        if (data.totalVotes && data.totalVotes >= existing.totalVotes) {
            factors.temporalConsistency = 100;
        } else if (data.totalVotes) {
            const decrease = ((existing.totalVotes - data.totalVotes) / existing.totalVotes) * 100;
            if (decrease < 5) factors.temporalConsistency = 70;
            else if (decrease < 15) factors.temporalConsistency = 30;
            else factors.temporalConsistency = 0;
        } else {
            factors.temporalConsistency = 0;
        }
    } else {
        factors.temporalConsistency = 75; // neutral for first data point
    }

    // 6. AI Confidence
    switch (confidence) {
        case 'high': factors.aiConfidence = 90; break;
        case 'medium': factors.aiConfidence = 60; break;
        case 'low': factors.aiConfidence = 30; break;
        default: factors.aiConfidence = 50;
    }

    // Calculate weighted score
    const score = Math.round(
        factors.sourceAgreement * WEIGHTS.sourceAgreement +
        factors.crossSourceAgreement * WEIGHTS.crossSourceAgreement +
        factors.sourceReliability * WEIGHTS.sourceReliability +
        factors.dataCompleteness * WEIGHTS.dataCompleteness +
        factors.temporalConsistency * WEIGHTS.temporalConsistency +
        factors.aiConfidence * WEIGHTS.aiConfidence
    );

    return { score, factors };
}

// ─── Auto-Publish Decision ───────────────────────────────────────

export function shouldAutoPublish(score: number): boolean {
    return score >= TRUST_THRESHOLD;
}

// ─── Trust Label ─────────────────────────────────────────────────

export function getTrustLabel(score: number): { label: string; color: string } {
    if (score >= 90) return { label: 'Very High', color: '#22c55e' };
    if (score >= 75) return { label: 'High', color: '#84cc16' };
    if (score >= 55) return { label: 'Moderate', color: '#eab308' };
    if (score >= 35) return { label: 'Low', color: '#f97316' };
    return { label: 'Very Low', color: '#ef4444' };
}
