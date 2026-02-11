import { useState } from 'react';

export function MobileFAB() {
    const [open, setOpen] = useState(false);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
            setOpen(false);
        }
    };

    return (
        <>
            {/* Overlay */}
            {open && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
                    onClick={() => setOpen(false)}
                />
            )}

            <div className="mobile-fab-container">
                {open && (
                    <div className="fab-menu">
                        <button onClick={() => scrollTo('stats-grid')} className="fab-item">
                            📊 Stats
                        </button>
                        <button onClick={() => scrollTo('scoreboard')} className="fab-item">
                            🏛️ Seats
                        </button>
                        <button onClick={() => scrollTo('map-view')} className="fab-item">
                            🗺️ Map
                        </button>
                        <button onClick={() => scrollTo('news-feed')} className="fab-item">
                            🔴 News
                        </button>
                    </div>
                )}

                <button
                    className={`fab-main ${open ? 'active' : ''}`}
                    onClick={() => setOpen(!open)}
                >
                    {open ? '✕' : '⚡'}
                </button>
            </div>

            <style>{`
                .mobile-fab-container {
                    position: fixed;
                    bottom: 80px; /* Above nav bar */
                    right: 20px;
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 12px;
                }
                .fab-main {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: var(--bd-red);
                    color: white;
                    border: none;
                    font-size: 1.5rem;
                    box-shadow: 0 4px 12px rgba(244, 42, 65, 0.4);
                    cursor: pointer;
                    transition: transform 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .fab-main:active { padding: 0; } /* Reset padding */
                .fab-main.active { transform: rotate(45deg); background: #334155; }
                
                .fab-menu {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    animation: slideUp 0.2s ease-out;
                }
                .fab-item {
                    background: white;
                    color: #0f172a;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    cursor: pointer;
                    text-align: right;
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (min-width: 769px) {
                    .mobile-fab-container { display: none; }
                }
            `}</style>
        </>
    );
}
