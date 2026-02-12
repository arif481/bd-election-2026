
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isAdminAuthenticated(): boolean {
    const hash = sessionStorage.getItem('admin_auth');
    return hash === import.meta.env.VITE_ADMIN_HASH;
}
