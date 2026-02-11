export function ContextBanner() {
    return (
        <div className="card-glass context-banner">
            <div className="context-content">
                <div className="context-badge">HISTORICAL CONTEXT</div>
                <h2 className="context-title">Post-2024 Monsoon Revolution Election</h2>
                <p className="context-desc">
                    Following the student-led uprising that ousted the previous regime,
                    this election marks a turning point for Bangladesh's democracy under
                    the Interim Government.
                </p>
            </div>
            <div className="context-visual">
                <div className="bg-shape"></div>
            </div>

            <style>{`
                .context-banner {
                    position: relative;
                    overflow: hidden;
                    padding: 24px;
                    background: linear-gradient(135deg, rgba(0,106,78,0.2) 0%, rgba(244,42,65,0.1) 100%);
                    border: 1px solid rgba(255,255,255,0.1);
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .context-badge {
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    color: var(--color-warning);
                    margin-bottom: 8px;
                    text-transform: uppercase;
                }
                .context-title {
                    font-size: 1.5rem;
                    margin: 0 0 8px 0;
                    font-weight: 800;
                    background: linear-gradient(to right, #fff, #cbd5e1);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .context-desc {
                    margin: 0;
                    font-size: 0.95rem;
                    color: var(--text-secondary);
                    max-width: 600px;
                    line-height: 1.6;
                }
                .bg-shape {
                    position: absolute;
                    right: -50px;
                    top: -50px;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, var(--bd-red) 0%, transparent 70%);
                    opacity: 0.2;
                    filter: blur(40px);
                }
                @media (max-width: 768px) {
                    .context-title { font-size: 1.2rem; }
                    .context-desc { font-size: 0.85rem; }
                }
            `}</style>
        </div>
    );
}
