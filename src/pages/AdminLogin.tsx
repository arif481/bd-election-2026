import { useState, type FormEvent } from 'react';

interface Props {
    onLogin: () => void;
}

async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AdminLogin({ onLogin }: Props) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const hash = await hashPassword(password);
        const expectedHash = import.meta.env.VITE_ADMIN_HASH;

        if (hash === expectedHash) {
            sessionStorage.setItem('admin_auth', hash);
            onLogin();
        } else {
            setError('Invalid password');
        }
        setLoading(false);
    };

    return (
        <div className="admin-login">
            <form className="admin-login-card" onSubmit={handleSubmit}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔐</div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Admin Access</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Election Results Management
                    </p>
                </div>

                <input
                    type="password"
                    className="admin-input"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                />

                {error && (
                    <div style={{
                        padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem',
                        background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '12px'
                    }}>
                        {error}
                    </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Verifying...' : 'Login'}
                </button>
            </form>
        </div>
    );
}

export function isAdminAuthenticated(): boolean {
    const hash = sessionStorage.getItem('admin_auth');
    return hash === import.meta.env.VITE_ADMIN_HASH;
}
