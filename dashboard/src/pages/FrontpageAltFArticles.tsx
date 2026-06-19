/**
 * Alt F — Articles archive (/preview/alt_f_articles)
 * Featured hero + category filter sidebar + article card grid.
 * APIs: GET /api/articles (public, paginated), /api/articles/featured/current
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { BookOpen, ChevronRight, Eye, X, Clock, TrendingUp, Tag, Bookmark } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const CATEGORIES = ['News', 'Tutorials', 'Interviews', 'Tips & Tricks', 'Releases', 'Community', 'Deep Dives'];
const CAT_COLORS: Record<string, string> = {
    'News': SECONDARY, 'Tutorials': PRIMARY, 'Interviews': '#ff9f43',
    'Tips & Tricks': '#4ade80', 'Releases': TERTIARY, 'Community': '#a29bfe', 'Deep Dives': '#fd79a8',
};

function catColor(cat: string): string { return CAT_COLORS[cat] || SUB; }
function fmtDate(d: string): string { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function readTime(text?: string): number { return Math.max(1, Math.ceil((text || '').split(/\s+/).length / 200)); }
function fmtNum(n?: number): string { n = n || 0; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); }

interface Article {
    id: string; slug: string; title: string; subtitle?: string; excerpt?: string;
    coverImageUrl?: string; authorName?: string; authorAvatar?: string;
    category?: string; tags?: string[]; isFeatured?: boolean;
    publishedAt?: string; viewCount?: number;
}

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
    const [hovered, setHovered] = useState(false);
    const cat = article.category || 'News';
    const color = catColor(cat);
    const mins = readTime(article.excerpt);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                ...glass, borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
                transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
                borderColor: hovered ? `${PRIMARY}44` : 'rgba(255,255,255,0.1)',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
            }}
        >
            {/* Cover */}
            <div style={{ height: 160, position: 'relative', background: article.coverImageUrl ? 'transparent' : `linear-gradient(135deg, ${color}1a 0%, rgba(15,19,29,0.8) 100%)`, overflow: 'hidden' }}>
                {article.coverImageUrl && (
                    <img src={article.coverImageUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hovered ? 'scale(1.04)' : 'scale(1)' }} />
                )}
                {!article.coverImageUrl && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={40} color={`${color}40`} strokeWidth={1} />
                    </div>
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,0.7) 0%, transparent 60%)' }} />
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                    <span style={{ background: `${color}22`, border: `1px solid ${color}55`, color, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {cat}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: TEXT, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {article.title}
                </h3>
                {article.excerpt && (
                    <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                        {article.excerpt}
                    </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${DIVIDER}`, marginTop: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {article.authorAvatar
                            ? <img src={article.authorAvatar} referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 22, height: 22, borderRadius: '50%', background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: SUB }}>{(article.authorName || 'F')[0]}</div>
                        }
                        <span style={{ fontSize: 12, color: SUB }}>{article.authorName || 'Fuji Studio'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: `${SUB}88`, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} />{mins}m
                        </span>
                        {(article.viewCount || 0) > 0 && (
                            <span style={{ fontSize: 11, color: `${SUB}88`, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Eye size={10} />{fmtNum(article.viewCount)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export const FrontpageAltFArticles: React.FC = () => {
    const { player } = usePlayer();
    const navigate = useNavigate();

    const [featured, setFeatured]       = useState<Article | null>(null);
    const [articles, setArticles]       = useState<Article[]>([]);
    const [total, setTotal]             = useState(0);
    const [page, setPage]               = useState(1);
    const [totalPages, setTotalPages]   = useState(1);
    const [loading, setLoading]         = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Featured article
    useEffect(() => {
        axios.get('/api/articles/featured/current').then(r => { if (r.data) setFeatured(r.data); }).catch(() => {});
    }, []);

    // Load articles list
    useEffect(() => {
        setLoading(true);
        setPage(1);
        const params: Record<string, string> = { limit: '24', page: '1' };
        if (activeCategory) params.category = activeCategory;
        axios.get('/api/articles', { params }).then(r => {
            setArticles(arr(r.data.articles));
            setTotal(r.data.total || 0);
            setTotalPages(r.data.totalPages || 1);
            if (!featured && arr(r.data.articles).length > 0) setFeatured(arr(r.data.articles)[0]);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [activeCategory]);

    const loadMore = () => {
        if (loadingMore || page >= totalPages) return;
        const next = page + 1;
        setLoadingMore(true);
        const params: Record<string, string> = { limit: '24', page: String(next) };
        if (activeCategory) params.category = activeCategory;
        axios.get('/api/articles', { params }).then(r => {
            setArticles(prev => [...prev, ...arr(r.data.articles)]);
            setPage(next);
            setLoadingMore(false);
        }).catch(() => setLoadingMore(false));
    };

    const openArticle = (slug: string) => navigate(`/preview/alt_f_article?slug=${slug}`);

    // Count by category (client-side approximation — just show all known categories)
    const catCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        articles.forEach(a => { if (a.category) counts[a.category] = (counts[a.category] || 0) + 1; });
        return counts;
    }, [articles]);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Articles" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Articles' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── FEATURED HERO ── */}
                    <section style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                        {featured?.coverImageUrl
                            ? <img src={featured.coverImageUrl} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a2a 0%, #1a0a1a 40%, #0f131d 100%)' }} />
                        }
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,19,29,0.97) 35%, rgba(15,19,29,0.6) 65%, rgba(15,19,29,0.3) 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,0.8) 0%, transparent 60%)' }} />

                        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center' }}>
                            <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 40px', boxSizing: 'border-box' }}>
                                {featured ? (
                                    <div style={{ maxWidth: 560 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                            {featured.isFeatured && (
                                                <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Featured
                                                </span>
                                            )}
                                            {featured.category && (
                                                <span style={{ background: `${catColor(featured.category)}18`, border: `1px solid ${catColor(featured.category)}44`, color: catColor(featured.category), padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    {featured.category}
                                                </span>
                                            )}
                                        </div>
                                        <h1 style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.2, textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>
                                            {featured.title}
                                        </h1>
                                        {featured.excerpt && (
                                            <p style={{ margin: '0 0 20px', color: 'rgba(223,226,241,0.75)', fontSize: 15, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {featured.excerpt}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <button
                                                onClick={() => openArticle(featured.slug)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                                            >
                                                Read Article <ChevronRight size={15} />
                                            </button>
                                            {featured.publishedAt && (
                                                <span style={{ fontSize: 13, color: `rgba(154,163,178,0.7)` }}>{fmtDate(featured.publishedAt)}</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-block', marginBottom: 14 }}>
                                            <BookOpen size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />Articles
                                        </span>
                                        <h1 style={{ margin: '0 0 10px', fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
                                            Community Articles
                                        </h1>
                                        <p style={{ margin: 0, color: SUB, fontSize: 16 }}>
                                            Tutorials, news, interviews and deep dives from Fuji Studio.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── BODY GRID ── */}
                    <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                        {/* ── LEFT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Category filter */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Tag size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Categories</h3>
                                    </div>
                                    {activeCategory && (
                                        <button onClick={() => setActiveCategory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: FONT }}>
                                            <X size={11} /> Clear
                                        </button>
                                    )}
                                </div>
                                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {CATEGORIES.map(cat => {
                                        const color = catColor(cat);
                                        const active = activeCategory === cat;
                                        const count = catCounts[cat] || 0;
                                        return (
                                            <button key={cat} onClick={() => setActiveCategory(active ? null : cat)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: active ? `${color}14` : 'transparent', color: active ? color : SUB, fontSize: 13, fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? color : `${color}55` }} />
                                                    {cat}
                                                </div>
                                                {count > 0 && <span style={{ fontSize: 11, color: active ? color : `rgba(154,163,178,0.4)` }}>{count}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Stats card */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Overview</h3>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { label: 'Total Articles', value: String(total), color: TEXT },
                                        { label: 'Categories', value: String(Object.keys(catCounts).length || CATEGORIES.length), color: SECONDARY },
                                        { label: 'Showing', value: activeCategory ? `${articles.length} in "${activeCategory}"` : 'All', color: PRIMARY },
                                    ].map(s => (
                                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 13, color: SUB }}>{s.label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bookmark promo card */}
                            <div style={{ ...glass, borderRadius: 20, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <Bookmark size={16} color={PRIMARY} />
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>Save for Later</span>
                                </div>
                                <p style={{ margin: '0 0 12px', fontSize: 13, color: SUB, lineHeight: 1.5 }}>
                                    Bookmark articles to read at your own pace. Saved to your library.
                                </p>
                                <div style={{ fontSize: 12, color: `${SUB}88` }}>Sign in to use bookmarks</div>
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                                        {activeCategory ? activeCategory : 'Latest Articles'}
                                    </h2>
                                    <span style={{ fontSize: 13, color: SUB }}>{total} article{total !== 1 ? 's' : ''}</span>
                                </div>

                                {loading ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center', color: SUB }}>Loading articles…</div>
                                ) : articles.length === 0 ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                        <BookOpen size={36} color={SUB} style={{ marginBottom: 14 }} />
                                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No articles yet</div>
                                        <div style={{ fontSize: 13, color: SUB }}>Check back soon</div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                                            {articles.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.slug)} />)}
                                        </div>
                                        {page < totalPages && (
                                            <div style={{ textAlign: 'center' }}>
                                                <button onClick={loadMore} disabled={loadingMore} style={{ padding: '11px 32px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                                                    {loadingMore ? 'Loading…' : 'Load more'}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        </div>
                    </div>

                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
