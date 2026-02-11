import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    query,
    orderBy,
    limit,
    where,
    updateDoc,
    getDocs,
    setDoc,
    getDoc,
    writeBatch
} from 'firebase/firestore';
import { app } from '../lib/firebase';
import type {
    Constituency,
    ElectionUpdate,
    SystemStatus,
    ElectionSummary,
    ReferendumResult,
    NewsItem
} from '../types/election';

const db = getFirestore(app);

// ─── Constituencies ─────────────────────────────────────────────

export async function getConstituencies(): Promise<Constituency[]> {
    const q = query(collection(db, 'constituencies'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Constituency));
}

export function onConstituenciesChange(callback: (data: Constituency[]) => void) {
    const q = query(collection(db, 'constituencies'));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Constituency));
        callback(data);
    });
}

export async function updateConstituency(id: string, data: Partial<Constituency>) {
    const ref = doc(db, 'constituencies', id);
    await updateDoc(ref, {
        ...data,
        lastUpdated: Date.now()
    });
}

export async function batchSeedConstituencies(constituencies: Constituency[]) {
    const batch = writeBatch(db);
    constituencies.forEach(c => {
        const ref = doc(db, 'constituencies', c.id);
        batch.set(ref, c);
    });
    await batch.commit();
}

// ─── Updates / Ticker ───────────────────────────────────────────

export function onRecentUpdatesChange(callback: (data: ElectionUpdate[]) => void) {
    const q = query(
        collection(db, 'updates'),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ElectionUpdate));
        callback(data);
    });
}

export async function addUpdate(update: Omit<ElectionUpdate, 'id'>) {
    const ref = doc(collection(db, 'updates'));
    await setDoc(ref, update);
}

// ─── System Status ──────────────────────────────────────────────

export function onSystemStatusChange(callback: (data: SystemStatus) => void) {
    const ref = doc(db, 'system', 'status');
    return onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as SystemStatus);
        } else {
            // Provide defaults when doc doesn't exist yet
            callback({
                isCollecting: false,
                lastFetchTime: 0,
                nextFetchTime: 0,
                totalApiCalls: 0,
                apiCallsToday: 0,
                errorsToday: 0,
                seatsDeclared: 0,
                seatsTotal: 300,
                collectionPhase: 'pre_voting',
            });
        }
    });
}

export async function updateSystemStatus(status: Partial<SystemStatus>) {
    const ref = doc(db, 'system', 'status');
    await setDoc(ref, status, { merge: true });
}

export async function getSystemStatus(): Promise<SystemStatus | null> {
    const ref = doc(db, 'system', 'status');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as SystemStatus : null;
}

// ─── Election Summary ───────────────────────────────────────────

export function onElectionSummaryChange(callback: (data: ElectionSummary) => void) {
    const ref = doc(db, 'system', 'summary');
    return onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as ElectionSummary);
        }
        // When doc doesn't exist, don't call back — Home.tsx already has a default
    });
}

// Alias for compatibility
export const onSummaryChange = onElectionSummaryChange;

export async function updateSummary(data: Partial<ElectionSummary>) {
    const ref = doc(db, 'system', 'summary');
    await setDoc(ref, {
        ...data,
        lastUpdated: Date.now()
    }, { merge: true });
}

export async function getElectionSummary(): Promise<ElectionSummary | null> {
    const ref = doc(db, 'system', 'summary');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as ElectionSummary : null;
}

// ─── Referendum ─────────────────────────────────────────────────

export function onReferendumChange(callback: (data: ReferendumResult) => void) {
    const ref = doc(db, 'system', 'referendum');
    return onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as ReferendumResult);
        }
        // When doc doesn't exist, leave referendum as undefined — tracker hides itself
    });
}

export async function updateReferendum(data: Partial<ReferendumResult>) {
    const ref = doc(db, 'system', 'referendum');
    await setDoc(ref, {
        ...data,
        lastUpdated: Date.now()
    }, { merge: true });
}

// ─── News ───────────────────────────────────────────────────────

export function onNewsUpdate(callback: (data: NewsItem[]) => void) {
    const q = query(
        collection(db, 'news'),
        orderBy('timestamp', 'desc'),
        limit(20)
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
        callback(data);
    });
}

export async function addNewsItem(item: Omit<NewsItem, 'id'>) {
    const ref = doc(collection(db, 'news'));
    await setDoc(ref, item);
}

// ─── Admin / Reviews ────────────────────────────────────────────

export async function getPendingReviews() {
    const q = query(
        collection(db, 'updates'),
        where('isVerified', '==', false),
        orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ElectionUpdate));
}

export async function approveUpdate(updateId: string) {
    const ref = doc(db, 'updates', updateId);
    await updateDoc(ref, { isVerified: true });
}
