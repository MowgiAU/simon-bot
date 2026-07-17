/**
 * Alt F — Article detail (/preview/alt_f_article?slug=SLUG)
 * Full reading view: cover hero, author strip, rich-text content body.
 * No sidebar — reading-focused single-column layout.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArticleEmbedHydrator } from '../components/ArticleEmbeds';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { BookOpen, ChevronLeft, Eye, Clock, Calendar, Tag, Share2, Bookmark } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};

const CAT_COLORS: Record<string, string> = {
    'News': SECONDARY, 'Tutorials': PRIMARY, 'Interviews': '#ff9f43',
    'Tips & Tricks': '#4ade80', 'Releases': TERTIARY, 'Community': '#a29bfe', 'Deep Dives': '#fd79a8',
};
function catColor(cat: string) { return CAT_COLORS[cat] || SUB; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
function fmtNum(n?: number) { n = n || 0; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); }
function readTime(text?: string) { return Math.max(1, Math.ceil((text || '').split(/\s+/).length / 200)); }

interface Article {
    id: string; slug: string; title: string; subtitle?: string; excerpt?: string; content?: string;
    coverImageUrl?: string; authorName?: string; authorAvatar?: string; authorUserId?: string;
    category?: string; tags?: string[]; isFeatured?: boolean; publishedAt?: string; viewCount?: number;
}

export const FrontpageAltFArticle: React.FC = () => {
    const navigate = useNavigate();
    const { player } = usePlayer();
    const slug = new URLSearchParams(window.location.search).get('slug');
    const contentRef = useRef<HTMLDivElement>(null);

    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const [related, setRelated] = useState<Article[]>([]);
    const [saved, setSaved]     = useState(false);
    const [copied, setCopied]   = useState(false);

    // Bookmarks are stored locally for now (no server-side article library yet).
    const SAVED_KEY = 'fuji_saved_articles';
    const readSaved = (): string[] => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } };
    useEffect(() => { if (article?.slug) setSaved(readSaved().includes(article.slug)); }, [article?.slug]);

    const toggleSave = () => {
        if (!article?.slug) return;
        const list = readSaved();
        const next = list.includes(article.slug) ? list.filter(s => s !== article.slug) : [...list, article.slug];
        try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
        setSaved(next.includes(article.slug));
    };

    const shareArticle = async () => {
        if (!article) return;
        const url = `${window.location.origin}/article/${article.slug}`;
        try {
            if (navigator.share) { await navigator.share({ title: article.title, url }); return; }
        } catch { /* user cancelled native share — fall through to copy */ }
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    };

    useEffect(() => {
        if (!slug) {
            // No slug — load the featured or first article
            axios.get('/api/articles/featured/current').then(r => {
                if (r.data?.slug) return fetchArticle(r.data.slug);
                return axios.get('/api/articles', { params: { limit: '1' } }).then(r2 => {
                    const first = r2.data?.articles?.[0];
                    if (first?.slug) return fetchArticle(first.slug);
                    setLoading(false);
                });
            }).catch(() => setLoading(false));
        } else {
            fetchArticle(slug);
        }
    }, [slug]);

    function fetchArticle(s: string) {
        setLoading(true);
        axios.get(`/api/articles/${s}`).then(r => {
            setArticle(r.data);
            setLoading(false);
            // Load related articles from same category
            if (r.data.category) {
                axios.get('/api/articles', { params: { category: r.data.category, limit: '4' } })
                    .then(r2 => setRelated((r2.data?.articles || []).filter((a: Article) => a.slug !== s).slice(0, 3)))
                    .catch(() => {});
            }
        }).catch(() => { setError(true); setLoading(false); });
    }

    const mins = readTime(article?.content || article?.excerpt);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Articles" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Articles', to: '/preview/alt_f_articles' }, { label: article?.title || 'Article' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: SUB, fontSize: 14 }}>
                            <AltSpinner />
                        </div>
                    )}

                    {!loading && !error && !article && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                            <BookOpen size={36} color={SUB} />
                            <div style={{ fontSize: 16, fontWeight: 600 }}>No article to display</div>
                            <div style={{ fontSize: 13, color: SUB }}>No published articles found yet.</div>
                            <button onClick={() => navigate('/preview/alt_f_articles')} style={{ padding: '8px 20px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, cursor: 'pointer', fontSize: 13, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ChevronLeft size={14} /> Back to Articles
                            </button>
                        </div>
                    )}

                    {error && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                            <BookOpen size={36} color={SUB} />
                            <div style={{ fontSize: 16, fontWeight: 600 }}>Article not found</div>
                            <button onClick={() => navigate('/preview/alt_f_articles')} style={{ padding: '8px 20px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, cursor: 'pointer', fontSize: 13, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ChevronLeft size={14} /> Back to Articles
                            </button>
                        </div>
                    )}

                    {article && (
                        <>
                            {/* ── COVER HERO ── */}
                            <section style={{ position: 'relative', width: '100%', height: 460, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                                {article.coverImageUrl
                                    ? <img src={article.coverImageUrl} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${catColor(article.category || '')}1a 0%, #0a0e18 60%)` }} />
                                }
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.85) 40%, rgba(15,19,29,0.4) 100%)' }} />

                                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%', padding: '0 32px 36px', boxSizing: 'border-box' }}>
                                        {/* Back link */}
                                        <button
                                            onClick={() => navigate('/preview/alt_f_articles')}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,19,29,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 8, padding: '6px 12px', color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12, marginBottom: 18 }}
                                        >
                                            <ChevronLeft size={13} /> Articles
                                        </button>

                                        {/* Category + featured badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                            {article.category && (
                                                <span style={{ background: `${catColor(article.category)}22`, border: `1px solid ${catColor(article.category)}55`, color: catColor(article.category), padding: '3px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    {article.category}
                                                </span>
                                            )}
                                            {article.isFeatured && (
                                                <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Featured
                                                </span>
                                            )}
                                        </div>

                                        <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                                            {article.title}
                                        </h1>
                                        {article.subtitle && (
                                            <p style={{ margin: '0 0 20px', fontSize: 17, color: 'rgba(223,226,241,0.75)', lineHeight: 1.5, fontWeight: 400 }}>
                                                {article.subtitle}
                                            </p>
                                        )}

                                        {/* Author + meta strip */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {article.authorAvatar
                                                    ? <img src={article.authorAvatar} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
                                                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: TEXT, border: '2px solid rgba(255,255,255,0.1)' }}>{(article.authorName || 'F')[0]}</div>
                                                }
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{article.authorName || 'Fuji Studio'}</div>
                                                    <div style={{ fontSize: 12, color: 'rgba(154,163,178,0.8)', display: 'flex', gap: 10 }}>
                                                        {article.publishedAt && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} />{fmtDate(article.publishedAt)}</span>}
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{mins} min read</span>
                                                        {(article.viewCount || 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10} />{fmtNum(article.viewCount)} views</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={toggleSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: saved ? `${PRIMARY}22` : 'rgba(28,31,42,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${saved ? `${PRIMARY}66` : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: saved ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: saved ? 700 : 400 }}>
                                                    <Bookmark size={13} fill={saved ? PRIMARY : 'none'} /> {saved ? 'Saved' : 'Save'}
                                                </button>
                                                <button onClick={shareArticle} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(28,31,42,0.7)', backdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 8, color: copied ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}>
                                                    <Share2 size={13} /> {copied ? 'Link copied!' : 'Share'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* ── ARTICLE BODY ── */}
                            <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 32px 64px', boxSizing: 'border-box' }}>
                                {article.content ? (
                                    <div
                                        ref={contentRef}
                                        className="article-content"
                                        dangerouslySetInnerHTML={{ __html: article.content }}
                                        style={{
                                            fontSize: 16, lineHeight: 1.8, color: 'rgba(223,226,241,0.9)',
                                            fontFamily: FONT,
                                        } as React.CSSProperties}
                                    />
                                ) : (
                                    article.excerpt && (
                                        <p style={{ fontSize: 16, lineHeight: 1.8, color: 'rgba(223,226,241,0.9)' }}>{article.excerpt}</p>
                                    )
                                )}

                                <ArticleEmbedHydrator contentRef={contentRef} articleContent={article.content || ''} />

                                <style>{`
                                    .article-content h2 { font-size: 24px; font-weight: 700; margin: 32px 0 16px; color: #dfe2f1; letter-spacing: -0.01em; }
                                    .article-content h3 { font-size: 20px; font-weight: 600; margin: 28px 0 12px; color: #dfe2f1; }
                                    .article-content p { margin: 12px 0; }
                                    .article-content img { max-width: 100%; border-radius: 10px; margin: 20px 0; }
                                    .article-content a { color: ${PRIMARY}; text-decoration: underline; text-underline-offset: 2px; }
                                    .article-content a:hover { opacity: 0.85; }
                                    .article-content blockquote { border-left: 3px solid ${PRIMARY}; margin: 20px 0; padding: 16px 24px; background: ${PRIMARY}0a; border-radius: 0 10px 10px 0; color: ${SUB}; font-style: italic; }
                                    .article-content pre { background: #1c1f2a; padding: 20px; border-radius: 10px; font-family: 'JetBrains Mono', monospace; font-size: 13px; overflow-x: auto; margin: 20px 0; border: 1px solid rgba(255,255,255,0.06); line-height: 1.5; }
                                    .article-content code { background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.9em; }
                                    .article-content pre code { background: transparent; padding: 0; }
                                    .article-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 32px 0; }
                                    .article-content ul, .article-content ol { padding-left: 28px; margin: 12px 0; }
                                    .article-content li { margin: 6px 0; }
                                    .article-content iframe, .article-content .article-video { border-radius: 12px; overflow: hidden; max-width: 100%; margin: 20px 0; }
                                `}</style>

                                {/* Tags */}
                                {article.tags && article.tags.length > 0 && (
                                    <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid rgba(87,66,54,0.25)` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <Tag size={14} color={SUB} />
                                            {article.tags.map(tag => (
                                                <span key={tag} style={{ padding: '4px 12px', background: S_CONT, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 9999, fontSize: 12, color: SUB }}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Author card */}
                                <div style={{ ...glass, borderRadius: 20, padding: '24px 28px', marginTop: 48, display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                                    {article.authorAvatar
                                        ? <img src={article.authorAvatar} referrerPolicy="no-referrer" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                        : <div style={{ width: 56, height: 56, borderRadius: '50%', background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: TEXT, flexShrink: 0 }}>{(article.authorName || 'F')[0]}</div>
                                    }
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: PRIMARY, marginBottom: 4 }}>Written by</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{article.authorName || 'Fuji Studio'}</div>
                                        <div style={{ fontSize: 13, color: SUB, lineHeight: 1.5 }}>Member of the Fuji Studio community.</div>
                                    </div>
                                </div>
                            </div>

                            {/* ── RELATED ARTICLES ── */}
                            {related.length > 0 && (
                                <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px 64px', boxSizing: 'border-box' }}>
                                    <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>More in {article.category}</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                        {related.map(a => (
                                            <div key={a.id} onClick={() => navigate(`/preview/alt_f_article?slug=${a.slug}`)} style={{ ...glass, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = `${PRIMARY}44`}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                            >
                                                <div style={{ height: 100, background: a.coverImageUrl ? 'transparent' : `${catColor(a.category || '')}1a`, overflow: 'hidden' }}>
                                                    {a.coverImageUrl && <img src={a.coverImageUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                                <div style={{ padding: '14px 16px' }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                                                    {a.publishedAt && <div style={{ fontSize: 11, color: SUB }}>{fmtDate(a.publishedAt)}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
