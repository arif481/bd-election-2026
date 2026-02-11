import { useState, useEffect, useMemo } from 'react';
import { onConstituenciesChange } from '../services/firestore';
import type { Constituency } from '../types/election';
import { DIVISIONS } from '../types/election';
import { ConstituencyCard } from '../components/ConstituencyCard';

export function Constituencies() {
    const [constituencies, setConstituencies] = useState<Constituency[]>([]);
    const [search, setSearch] = useState('');
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        return onConstituenciesChange(setConstituencies);
    }, []);

    const filtered = useMemo(() => {
        return constituencies
            .filter(c => {
                if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
                    !c.district.toLowerCase().includes(search.toLowerCase())) return false;
                if (divisionFilter !== 'all' && c.division !== divisionFilter) return false;
                if (statusFilter !== 'all' && c.status !== statusFilter) return false;
                return true;
            })
            .sort((a, b) => a.number - b.number);
    }, [constituencies, search, divisionFilter, statusFilter]);

    const countByStatus = useMemo(() => {
        const counts = { declared: 0, counting: 0, not_started: 0, result_confirmed: 0, postponed: 0 };
        constituencies.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
        return counts;
    }, [constituencies]);

    return (
        <div className="page">
            <div className="app-container">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
                    🏛️ All Constituencies
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                    {filtered.length} constituencies shown •
                    {' '}{countByStatus.declared + countByStatus.result_confirmed} declared •
                    {' '}{countByStatus.counting} counting •
                    {' '}{countByStatus.postponed} postponed •
                    {' '}{countByStatus.not_started} pending
                </p>

                <div className="filter-bar">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search constituency or district..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <select
                        className="filter-select"
                        value={divisionFilter}
                        onChange={e => setDivisionFilter(e.target.value)}
                    >
                        <option value="all">All Divisions</option>
                        {DIVISIONS.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="declared">Declared</option>
                        <option value="result_confirmed">Confirmed</option>
                        <option value="counting">Counting</option>
                        <option value="not_started">Not Started</option>
                    </select>
                </div>

                <div className="constituency-grid">
                    {filtered.map(c => (
                        <ConstituencyCard key={c.id} constituency={c} />
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</p>
                        <p>No constituencies match your filters</p>
                    </div>
                )}
            </div>
        </div>
    );
}
