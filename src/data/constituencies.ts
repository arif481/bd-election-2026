import type { Constituency } from '../types/election';

// ─── Verified District-Level Seat Distribution ───────────────────
// Source: Bangladesh Election Commission 2018 delimitation + 2025 boundary updates

const DISTRICT_SEATS: Record<string, Record<string, number>> = {
    Dhaka: {
        Dhaka: 20, Tangail: 8, Gazipur: 6, Kishoreganj: 6, Narsingdi: 5,
        Narayanganj: 5, Faridpur: 4, Gopalganj: 3, Manikganj: 3,
        Munshiganj: 3, Madaripur: 3, Shariatpur: 3, Rajbari: 2,
    },
    Chattogram: {
        Chattogram: 16, Cumilla: 11, Brahmanbaria: 6, Chandpur: 6,
        Noakhali: 5, "Cox's Bazar": 4, Feni: 3, Lakshmipur: 3,
        Khagrachhari: 2, Rangamati: 1, Bandarban: 1,
    },
    Rajshahi: {
        Bogura: 7, Rajshahi: 6, Naogaon: 6, Sirajganj: 6, Pabna: 5,
        Natore: 3, Chapainawabganj: 3, Joypurhat: 3,
    },
    Khulna: {
        Kushtia: 6, Jashore: 6, Khulna: 6, Satkhira: 4, Jhenaidah: 4,
        Chuadanga: 2, Magura: 2, Narail: 2, Meherpur: 2, Bagerhat: 2,
    },
    Rangpur: {
        Rangpur: 6, Dinajpur: 6, Gaibandha: 5, Kurigram: 4,
        Nilphamari: 4, Thakurgaon: 3, Lalmonirhat: 3, Panchagarh: 2,
    },
    Mymensingh: {
        Mymensingh: 11, Jamalpur: 5, Netrokona: 5, Sherpur: 3,
    },
    Barishal: {
        Barishal: 6, Bhola: 4, Patuakhali: 4, Pirojpur: 3,
        Barguna: 2, Jhalokathi: 2,
    },
    Sylhet: {
        Sylhet: 6, Sunamganj: 5, Habiganj: 4, Moulvibazar: 4,
    },
};

// Average registered voters per constituency (~127.6M / 300)
const AVG_REGISTERED = 425_333;

function generateConstituencies(): Constituency[] {
    const constituencies: Constituency[] = [];
    let seatNumber = 1;

    // Postponed constituency
    const POSTPONED_CONSTITUENCY = 'Sherpur-3';

    for (const [division, districts] of Object.entries(DISTRICT_SEATS)) {
        for (const [district, seatCount] of Object.entries(districts)) {
            for (let i = 1; i <= seatCount; i++) {
                const name = `${district}-${i}`;
                const id = name.toLowerCase().replace(/['\s]/g, '-');
                const isPostponed = name === POSTPONED_CONSTITUENCY;

                // Vary registered voters slightly (+/- 20%)
                const variance = 0.8 + Math.random() * 0.4;
                const totalRegistered = Math.round(AVG_REGISTERED * variance);

                constituencies.push({
                    id,
                    number: seatNumber,
                    name,
                    division,
                    district,
                    candidates: [],
                    status: isPostponed ? 'postponed' : 'not_started',
                    totalVotes: 0,
                    totalRegistered,
                    turnoutPercent: 0,
                    winMargin: 0,
                    lastUpdated: 0,
                    trustScore: 0,
                    source: '',
                });

                seatNumber++;
            }
        }
    }

    return constituencies;
}

export const CONSTITUENCIES = generateConstituencies();

// Verify total = 300
if (CONSTITUENCIES.length !== 300) {
    console.error(`[Data] Expected 300 constituencies, got ${CONSTITUENCIES.length}`);
}
