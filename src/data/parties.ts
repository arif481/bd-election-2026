import type { Party } from '../types/election';

export const PARTIES: Party[] = [
    {
        id: 'bnp',
        name: 'Bangladesh Nationalist Party',
        shortName: 'BNP',
        symbol: '🌾',
        color: '#E8403A',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 292,
        alliance: 'bnp_alliance',
    },
    {
        id: 'jamaat',
        name: 'Bangladesh Jamaat-e-Islami',
        shortName: 'Jamaat',
        symbol: '⚖️',
        color: '#2E7D32',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 179,
        alliance: 'jamaat_alliance',
    },
    {
        id: 'ncp',
        name: 'National Citizen Party',
        shortName: 'NCP',
        symbol: '🌸',
        color: '#E91E63',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 30,
        alliance: 'jamaat_alliance',
    },
    {
        id: 'islami-andolan',
        name: 'Islami Andolan Bangladesh',
        shortName: 'IAB',
        symbol: '🪭',
        color: '#00695C',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 253,
        alliance: 'independent',
    },
    {
        id: 'jp-ershad',
        name: 'Jatiya Party',
        shortName: 'JP',
        symbol: '🏠',
        color: '#FF9800',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 192,
        alliance: 'independent',
    },
    {
        id: 'gonoforum',
        name: 'Gono Forum',
        shortName: 'GF',
        symbol: '🔔',
        color: '#9C27B0',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 133,
        alliance: 'independent',
    },
    {
        id: 'ldp',
        name: 'Liberal Democratic Party',
        shortName: 'LDP',
        symbol: '🏛️',
        color: '#3F51B5',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 7,
        alliance: 'jamaat_alliance',
    },
    {
        id: 'jasod',
        name: 'Jatiya Samajtantrik Dal',
        shortName: 'JSD',
        symbol: '⭐',
        color: '#F44336',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 0,
        alliance: 'others',
    },
    {
        id: 'workers-party',
        name: 'Workers Party of Bangladesh',
        shortName: 'WPB',
        symbol: '🔨',
        color: '#D32F2F',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 0,
        alliance: 'others',
    },
    {
        id: 'independent',
        name: 'Independent',
        shortName: 'IND',
        symbol: '👤',
        color: '#78909C',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 0,
        alliance: 'independent',
    },
    {
        id: 'others',
        name: 'Others',
        shortName: 'OTH',
        symbol: '📋',
        color: '#607D8B',
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        totalCandidates: 0,
        alliance: 'others',
    },
];

export const PARTY_MAP = new Map(PARTIES.map(p => [p.id, p]));

export function getPartyColor(partyId: string): string {
    return PARTY_MAP.get(partyId)?.color ?? '#607D8B';
}

export function getPartyShortName(partyId: string): string {
    return PARTY_MAP.get(partyId)?.shortName ?? partyId.toUpperCase();
}

export function getPartySymbol(partyId: string): string {
    return PARTY_MAP.get(partyId)?.symbol ?? '📋';
}

// ─── Alliance Data ───────────────────────────────────────────────

export const ALLIANCES = [
    {
        id: 'bnp_alliance',
        name: 'BNP-led 10-Party Alliance',
        shortName: 'BNP Alliance',
        color: '#E8403A',
        leadParty: 'bnp',
        partyIds: ['bnp'],
        totalSeats: 292,
    },
    {
        id: 'jamaat_alliance',
        name: 'Like-minded 11-Party Alliance',
        shortName: 'Jamaat Alliance',
        color: '#2E7D32',
        leadParty: 'jamaat',
        partyIds: ['jamaat', 'ncp', 'ldp'],
        totalSeats: 253,
    },
];
