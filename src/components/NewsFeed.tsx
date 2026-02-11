import { useState, useEffect } from 'react';
import type { NewsItem } from '../types/election';
import { onNewsUpdate } from '../services/firestore';

export function NewsFeed() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onNewsUpdate((data) => {
            setNews(data);
            setLoading(false);
        });
        return unsub;
    }, []);

    // Placeholder data if emptiness
    const displayNews = news.length > 0 ? news : [];

    return (
        <div id="news-feed" className="card-glass" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="section-title" style={{ margin: 0 }}>📰 Live Updates</h3>
                <span className="live-pulse" style={{ width: '8px', height: '8px' }} />
            </div>

            <div className="news-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                {loading && (
                    // Skeleton Loading
                    [1, 2, 3].map(i => (
                        <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ height: '10px', width: '30%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '8px' }} />
                            <div style={{ height: '16px', width: '80%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '8px' }} />
                            <div style={{ height: '12px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '4px' }} />
                            <div style={{ height: '12px', width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                        </div>
                    ))
                )}

                {!loading && displayNews.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        No updates yet.
                    </div>
                )}

                {!loading && displayNews.length > 0 && displayNews.map((item, i) => (
                    <div key={item.id} className={`news-item ${item.category === 'breaking' ? 'news-breaking' : ''}`} style={{
                        padding: '16px 0',
                        borderBottom: i < displayNews.length - 1 ? '1px solid var(--border-color)' : 'none'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{
                                fontSize: '0.65rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: item.category === 'breaking' ? '#fff' : 'var(--bd-red)',
                                fontWeight: 700,
                                background: item.category === 'breaking' ? 'var(--bd-red)' : 'transparent',
                                padding: item.category === 'breaking' ? '2px 6px' : '0',
                                borderRadius: '4px'
                            }}>
                                {item.category === 'breaking' ? '🚨 BREAKING' : item.category}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <h4 style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            marginBottom: '6px',
                            lineHeight: 1.4,
                            color: item.category === 'breaking' ? '#fff' : 'var(--text-primary)'
                        }}>
                            {item.headline}
                        </h4>
                        <p style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5,
                            marginBottom: '8px'
                        }}>
                            {item.summary}
                        </p>
                        {item.source !== 'System' && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Source: <span style={{ color: 'var(--text-primary)' }}>{item.source}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
