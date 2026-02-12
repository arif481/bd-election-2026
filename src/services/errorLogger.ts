
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, updateDoc, doc } from 'firebase/firestore';
import { app } from '../lib/firebase';
import type { SystemError } from '../types/election';

const db = getFirestore(app);

const ERRORS_COLLECTION = 'system_errors';

export async function logError(
    type: SystemError['type'],
    message: string,
    details?: string,
    sourceId?: string
): Promise<string> {
    try {
        const errorData: Omit<SystemError, 'id'> = {
            timestamp: Date.now(),
            type,
            message,
            details: details || '',
            status: 'active',
            ...(sourceId ? { sourceId } : {})
        };

        const docRef = await addDoc(collection(db, ERRORS_COLLECTION), errorData);
        console.error(`[SystemError] ${type}: ${message}`, details);
        return docRef.id;
    } catch (e) {
        console.error('Failed to log error to Firestore:', e);
        return '';
    }
}

export async function getActiveErrors(limitCount = 50): Promise<SystemError[]> {
    try {
        const q = query(
            collection(db, ERRORS_COLLECTION),
            where('status', '==', 'active'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SystemError));
    } catch (e) {
        console.error('Failed to fetch active errors:', e);
        return [];
    }
}

export async function resolveError(id: string, resolution: 'resolved' | 'ignored' = 'resolved'): Promise<void> {
    try {
        const docRef = doc(db, ERRORS_COLLECTION, id);
        await updateDoc(docRef, {
            status: resolution,
            resolvedAt: Date.now()
        });
    } catch (e) {
        console.error(`Failed to resolve error ${id}:`, e);
    }
}

export async function clearAllErrors(): Promise<void> {
    try {
        const errors = await getActiveErrors(100);
        const promises = errors.map(e => resolveError(e.id, 'resolved'));
        await Promise.all(promises);
    } catch (e) {
        console.error('Failed to clear errors:', e);
    }
}
