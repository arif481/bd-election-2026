// ─── Core Election Types ────────────────────────────────────────

export interface Candidate {
    name: string;
    party: string;
    votes: number;
    isWinner: boolean;
    isLeading: boolean;
}

export type ConstituencyStatus = 'not_started' | 'counting' | 'declared' | 'result_confirmed' | 'postponed';

export interface Constituency {
    id: string;               // e.g. "dhaka-1"
    number: number;           // 1-300
    name: string;             // e.g. "Dhaka-1"
    division: string;
    district: string;
    candidates: Candidate[];
    status: ConstituencyStatus;
    totalVotes: number;
    totalRegistered: number;
    turnoutPercent: number;
    winMargin: number;
    lastUpdated: number;      // timestamp
    trustScore: number;       // 0-100
    source: string;           // where this data came from
}

export type Alliance = 'bnp_alliance' | 'jamaat_alliance' | 'independent' | 'others';

export interface Party {
    id: string;
    name: string;
    shortName: string;
    symbol: string;
    color: string;
    seatsWon: number;
    seatsLeading: number;
    totalVotes: number;
    totalCandidates: number;
    alliance: Alliance;
}

export interface ElectionUpdate {
    id: string;
    constituencyId: string;
    constituencyName: string;
    timestamp: number;
    type: 'result_declared' | 'vote_update' | 'lead_change' | 'correction' | 'news';
    message: string;
    trustScore: number;
    source: string;
    isVerified: boolean;
}

export interface SystemStatus {
    isCollecting: boolean;
    lastFetchTime: number;
    nextFetchTime: number;
    totalApiCalls: number;
    apiCallsToday: number;
    errorsToday: number;
    seatsDeclared: number;
    seatsTotal: number;
    collectionPhase: CollectionPhase;
    activeSources: number;
    totalConflicts: number;
    resolvedConflicts: number;
    autoNewsCount: number;
}

export type CollectionPhase = 'pre_voting' | 'voting' | 'early_results' | 'peak_results' | 'late_results' | 'cleanup' | 'completed';

export interface ElectionSummary {
    totalSeats: number;
    seatsDeclared: number;
    seatsRemaining: number;
    totalVotesCounted: number;
    avgTurnout: number;
    lastUpdated: number;
    parties: Party[];
    leadingParty: string;
    phase: CollectionPhase;
}

// ─── Referendum ──────────────────────────────────────────────────

export interface ReferendumResult {
    totalYesVotes: number;
    totalNoVotes: number;
    totalVotesCast: number;
    totalEligible: number;
    percentYes: number;
    percentNo: number;
    centersReported: number;
    totalCenters: number;
    lastUpdated: number;
    status: 'not_started' | 'counting' | 'declared';
    trustScore?: number;
}

// ─── News ────────────────────────────────────────────────────────

export interface NewsItem {
    id: string;
    headline: string;
    summary: string;
    source: string;
    sourceUrl: string;
    timestamp: number;
    category: 'breaking' | 'result' | 'analysis' | 'incident' | 'general';
    isVerified: boolean;
}

// ─── Division Data ───────────────────────────────────────────────

export const DIVISIONS = [
    'Barishal', 'Chattogram', 'Dhaka', 'Khulna',
    'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet'
] as const;

export type Division = typeof DIVISIONS[number];

export const DIVISION_SEATS: Record<Division, number> = {
    Dhaka: 71,
    Chattogram: 58,
    Rajshahi: 39,
    Khulna: 36,
    Rangpur: 33,
    Mymensingh: 24,
    Barishal: 21,
    Sylhet: 19,
};

// ─── Multi-Source & Conflict Resolution ─────────────────────────

export type ConflictType = 'vote_mismatch' | 'winner_disagreement' | 'status_regression' | 'candidate_name_mismatch';
export type ConflictResolution = 'auto_consensus' | 'admin_override' | 'pending';

export interface DataConflict {
    id: string;
    constituencyId: string;
    constituencyName: string;
    type: ConflictType;
    sourceA: { name: string; tier: number; data: Record<string, unknown>; timestamp: number };
    sourceB: { name: string; tier: number; data: Record<string, unknown>; timestamp: number };
    severity: 'low' | 'medium' | 'high' | 'critical';
    resolvedBy: ConflictResolution;
    resolvedAt: number;
    resolution?: string;
    createdAt: number;
}

export interface SourceStatus {
    id: string;
    name: string;
    tier: 1 | 2 | 3 | 4;
    lastFetchTime: number;
    lastSuccessTime: number;
    fetchCount: number;
    errorCount: number;
    successCount: number;
    constituenciesReported: number;
    isActive: boolean;
    lastError?: string;
    avgResponseTime: number;
}

export interface AuditEntry {
    id: string;
    constituencyId: string;
    constituencyName: string;
    action: 'create' | 'update' | 'conflict_resolve' | 'manual_override' | 'auto_publish';
    source: string;
    previousData?: Record<string, unknown>;
    newData: Record<string, unknown>;
    timestamp: number;
    trustScore: number;
}

export interface PendingUpdate {
    id: string;
    constituencyId: string;
    constituencyName: string;
    source: string;
    sourceTier: number;
    data: Record<string, unknown>;
    timestamp: number;
    trustScore: number;
    status: 'pending' | 'approved' | 'rejected' | 'merged';
    conflictId?: string;
}

export interface SystemError {
    id: string;
    timestamp: number;
    type: 'source_fetch' | 'parsing' | 'rate_limit' | 'network' | 'validation' | 'other';
    sourceId?: string;
    message: string;
    details?: string;
    status: 'active' | 'resolved' | 'ignored';
    resolvedAt?: number;
}
