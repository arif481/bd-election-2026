// ─── Election Metadata (Official, Pre-Populated) ────────────────

export const ELECTION = {
    name: '13th National Parliament Election',
    nameBn: '১৩তম জাতীয় সংসদ নির্বাচন',
    country: 'Bangladesh',
    date: '2026-02-12',
    dateFormatted: 'February 12, 2026',
    day: 'Thursday',

    // Timing (BST = UTC+6)
    votingStartUTC: new Date('2026-02-12T01:30:00Z'), // 7:30 AM BST
    votingEndUTC: new Date('2026-02-12T10:30:00Z'),   // 4:30 PM BST

    totalSeats: 300,
    activeSeats: 299,  // Sherpur-3 postponed
    postponedConstituency: 'Sherpur-3',
    postponedReason: 'Death of a candidate',
    reservedWomenSeats: 50,

    totalCandidates: 1981,
    totalParties: 51,
    totalRegisteredVoters: 127_600_000,
    maleVoters: 64_825_361,
    femaleVoters: 62_885_200,
    thirdGenderVoters: 1_232,
    totalPollingCenters: 42_000,
    totalPollingBooths: 247_499,

    // First-ever postal voting for expats
    postalVoting: true,
    postalVoteApp: 'Postal Vote BD',

    // Concurrent referendum
    referendum: {
        name: 'July National Charter Referendum',
        description: 'Constitutional Reform Implementation Order 2025',
        keyReforms: [
            'Term limits on Prime Minister',
            'Bicameral parliament (replacing unicameral)',
            'Reinstating caretaker government system',
            'Abolishing Article 70 (anti-floor crossing)',
            'Enhancing presidential powers',
            'Expanding fundamental rights',
            'Protecting judicial independence',
            'Increasing women\'s political representation',
        ],
        voteType: 'Yes / No on 4 consolidated issues',
        implementationWindow: '180 working days (270 calendar days) if Yes wins',
    },

    // Context
    context: {
        interimGovernment: 'Interim government led by Nobel laureate Muhammad Yunus',
        previousEvent: 'Student-led uprising (July 2024) ousted PM Sheikh Hasina',
        awamiLeagueStatus: 'Banned / suspended — not contesting',
        significance: 'First election since 2024 Monsoon Revolution',
    },
} as const;

// ─── Phase Timing (UTC) ─────────────────────────────────────────

export const PHASE_TIMESTAMPS = {
    votingStart: new Date('2026-02-12T01:30:00Z'),  // 7:30 AM BST
    votingEnd: new Date('2026-02-12T10:30:00Z'),     // 4:30 PM BST
    earlyResults: new Date('2026-02-12T10:30:00Z'),  // 4:30 PM BST
    peakResults: new Date('2026-02-12T13:00:00Z'),   // 7:00 PM BST
    lateResults: new Date('2026-02-12T18:00:00Z'),   // 12:00 AM BST (next day)
    cleanup: new Date('2026-02-13T02:00:00Z'),       // 8:00 AM BST
} as const;
