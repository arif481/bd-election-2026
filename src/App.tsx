import { useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Constituencies } from './pages/Constituencies';
import { PartyView } from './pages/PartyView';
import { AdminLogin, isAdminAuthenticated } from './pages/AdminLogin';
import { DeveloperCredit } from './components/DeveloperCredit';
import './index.css';

// Lazy load admin to keep public bundle small
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard }))
);

function AdminRoute() {
  const [authed, setAuthed] = useState(isAdminAuthenticated());

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <Suspense fallback={
      <div className="loading-spinner"><div className="spinner" /></div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}

function Nav() {
  const location = useLocation();
  // Hide nav on admin pages to keep it clean
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <nav className="header-nav">
      <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
        Dashboard
      </NavLink>
      <NavLink to="/constituencies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        Constituencies
      </NavLink>
      <NavLink to="/parties" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        Parties
      </NavLink>
    </nav>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="header-content">
            <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="header-brand">
                <div className="header-flag" />
                <div>
                  <div className="header-title">🇧🇩 BD Election <span style={{ color: 'var(--bd-red)' }}>2026</span></div>
                  <div className="header-subtitle">13th National Parliament • Live Results</div>
                </div>
              </div>
            </NavLink>
            <Nav />
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/constituencies" element={<Constituencies />} />
            <Route path="/parties" element={<PartyView />} />
            {/* HIDDEN ADMIN ROUTE */}
            <Route path="/admin-x7k9" element={<AdminRoute />} />
          </Routes>
        </main>

        <DeveloperCredit />
      </div>
    </HashRouter>
  );
}

export default App;
