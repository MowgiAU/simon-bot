import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import {
    Newspaper, BookOpen, Megaphone, GraduationCap,
    Calendar, Eye, ChevronLeft, ChevronRight, Star,
} from 'lucide-react';

interface ArticleCard {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    excerpt: string | null;
    coverImageUrl: string | null;
    authorName: string;
    authorAvatar: string | null;
    authorUserId: string | null;
    category: string;
    tags: string[];
    isFeatured: boolean;
    publishedAt: string | null;
    viewCount: number;
}

interface ApiResponse {
    articles: ArticleCard[];
    total: number;
    page: number;
    totalPages: number;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    news:         { icon: <Newspaper size={12} />,     label: 'News',         color: '#A78BFA' },
    guide:        { icon: <BookOpen size={12} />,      label: 'Guide',        color: '#FBBF24' },
    announcement: { icon: <Megaphone size={12} />,     label: 'Announcement', color: '#F472B6' },
    tutorial:     { icon: <GraduationCap size={12} />, label: 'Tutorial',     color: '#34D399' },
};

const CATEGORIES = [
    { key: '', label: 'All' },
    { key: 'news', label: 'News' },
    { key: 'announcement', label: 'Announcements' },
    { key: 'guide', label: 'Guides' },
    { key: 'tutorial', label: 'Tutorials' },
];

const formatDate = (iso: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatViews = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
};

const readTime = (excerpt: string | null) => {
    const words = (excerpt || '').split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200)) + ' min read';
};

const avatarUrl = (article: ArticleCard) => {
    const av = article.authorAvatar;
    if (!av) return null;
    if (av.startsWith('http') || av.startsWith('/')) return av;
    if (article.authorUserId) return `https://cdn.discordapp.com/avatars/${article.authorUserId}/${av}.png?size=64`;
    return null;
};

// ── Featured card (large, top of page) ───────────────────────────────────────

const FeaturedCard: React.FC<{ article: ArticleCard; isMobile: boolean }> = ({ article, isMobile }) => {
    const cat = CATEGORY_CONFIG[article.category];
    return (
        <Link to={`/article/${article.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
                position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                height: isMobile ? 260 : 400,
                background: article.coverImageUrl ? 'transparent' : '#0d1117',
                cursor: 'pointer',
            }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
                {article.coverImageUrl && (
                    <img src={article.coverImageUrl} alt={article.title}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy" />
                )}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.1) 100%)',
                }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '20px' : '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                            borderRadius: '4px', fontSize: 11, fontWeight: 700,
                            backgroundColor: cat ? cat.color + '22' : 'rgba(255,255,255,0.1)',
                            color: cat ? cat.color : '#fff', border: `1px solid ${cat ? cat.color + '44' : 'rgba(255,255,255,0.2)'}`,
                        }}>
                            {cat?.icon} {cat?.label ?? article.category}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: '4px', fontSize: 11, fontWeight: 700, backgroundColor: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                            <Star size={10} /> Featured
                        </span>
                    </div>
                    <h2 style={{ margin: '0 0 6px', fontSize: isMobile ? '1.2rem' : '1.75rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                        {article.title}
                    </h2>
                    {article.excerpt && !isMobile && (
                        <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {article.excerpt}
                        </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {avatarUrl(article) ? (
                                <img src={avatarUrl(article)!} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: colors.primary + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: colors.primary, fontWeight: 700 }}>
                                    {article.authorName[0]}
                                </div>
                            )}
                            {article.authorName}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={11} /> {formatDate(article.publishedAt)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={11} /> {formatViews(article.viewCount)}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

// ── Regular article card ──────────────────────────────────────────────────────

const ArticleCardItem: React.FC<{ article: ArticleCard }> = ({ article }) => {
    const cat = CATEGORY_CONFIG[article.category];
    return (
        <Link to={`/article/${article.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
                backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: borderRadius.md, overflow: 'hidden', height: '100%',
                display: 'flex', flexDirection: 'column', cursor: 'pointer',
                transition: 'border-color 0.2s, transform 0.2s',
            }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.2)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
            >
                {/* Cover */}
                <div style={{ position: 'relative', height: 180, backgroundColor: '#0a0d14', flexShrink: 0 }}>
                    {article.coverImageUrl ? (
                        <img src={article.coverImageUrl} alt={article.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
                            {cat?.icon ? React.cloneElement(cat.icon as React.ReactElement, { size: 40 }) : <Newspaper size={40} />}
                        </div>
                    )}
                    <div style={{ position: 'absolute', top: 10, left: 10 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                            borderRadius: '4px', fontSize: 11, fontWeight: 700,
                            backgroundColor: cat ? cat.color + '22' : 'rgba(255,255,255,0.1)',
                            color: cat ? cat.color : '#fff', border: `1px solid ${cat ? cat.color + '44' : 'rgba(255,255,255,0.2)'}`,
                            backdropFilter: 'blur(6px)',
                        }}>
                            {cat?.icon} {cat?.label ?? article.category}
                        </span>
                    </div>
                    {article.isFeatured && (
                        <div style={{ position: 'absolute', top: 10, right: 10 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: '4px', fontSize: 10, fontWeight: 700, backgroundColor: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)', backdropFilter: 'blur(6px)' }}>
                                <Star size={9} />
                            </span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {article.title}
                    </h3>
                    {article.excerpt && (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                            {article.excerpt}
                        </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: colors.textTertiary }}>
                            {avatarUrl(article) ? (
                                <img src={avatarUrl(article)!} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: colors.primary + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: colors.primary, fontWeight: 700 }}>
                                    {article.authorName[0]}
                                </div>
                            )}
                            {article.authorName}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: colors.textTertiary }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Eye size={10} /> {formatViews(article.viewCount)}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Calendar size={10} /> {formatDate(article.publishedAt)}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export const ArticlesArchivePage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const initialCategory = params.get('category') || '';
    const initialPage = Math.max(1, parseInt(params.get('page') || '1'));

    const [articles, setArticles] = useState<ArticleCard[]>([]);
    const [featured, setFeatured] = useState<ArticleCard | null>(null);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(initialPage);
    const [category, setCategory] = useState(initialCategory);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const fetchArticles = useCallback(async (pg: number, cat: string) => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(pg), limit: '12' };
            if (cat) params.category = cat;
            const res = await axios.get<ApiResponse>('/api/articles', { params });
            setArticles(res.data.articles);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch {
            setArticles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load featured article once (no category filter, just first featured)
    useEffect(() => {
        axios.get<ApiResponse>('/api/articles', { params: { featured: 'true', limit: '1' } })
            .then(r => setFeatured(r.data.articles[0] ?? null))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchArticles(page, category);
        const qs = new URLSearchParams();
        if (category) qs.set('category', category);
        if (page > 1) qs.set('page', String(page));
        navigate({ search: qs.toString() }, { replace: true });
    }, [page, category, fetchArticles]);

    const handleCategory = (cat: string) => {
        setCategory(cat);
        setPage(1);
    };

    const handlePage = (pg: number) => {
        setPage(pg);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Separate featured from grid to avoid duplicate
    const gridArticles = articles.filter(a => !featured || a.id !== featured.id || category !== '');

    return (
        <DiscoveryLayout>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px 80px' : '40px 24px 80px' }}>

                {/* Header */}
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <Newspaper size={28} color={colors.primary} />
                        <h1 style={{ margin: 0, fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 800 }}>News & Articles</h1>
                    </div>
                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: '0.9rem' }}>
                        Guides, announcements, tutorials and news from the Fuji Studio community.
                    </p>
                </div>

                {/* Featured article — only on page 1, no category filter */}
                {featured && page === 1 && !category && (
                    <div style={{ marginBottom: 40 }}>
                        <FeaturedCard article={featured} isMobile={isMobile} />
                    </div>
                )}

                {/* Category tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
                    {CATEGORIES.map(c => (
                        <button
                            key={c.key}
                            onClick={() => handleCategory(c.key)}
                            style={{
                                padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                                cursor: 'pointer', border: '1px solid',
                                borderColor: category === c.key ? colors.primary : 'rgba(255,255,255,0.1)',
                                backgroundColor: category === c.key ? colors.primary + '22' : 'transparent',
                                color: category === c.key ? colors.primary : colors.textSecondary,
                                transition: 'all 0.15s',
                            }}
                        >
                            {c.label}
                        </button>
                    ))}
                    {total > 0 && (
                        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.8rem', color: colors.textTertiary }}>
                            {total} article{total !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Grid */}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ height: 340, borderRadius: borderRadius.md, backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.5 }} />
                        ))}
                    </div>
                ) : gridArticles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textTertiary }}>
                        <Newspaper size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                        <p style={{ margin: 0, fontSize: '0.95rem' }}>No articles found{category ? ` in "${CATEGORIES.find(c => c.key === category)?.label}"` : ''}.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                        {gridArticles.map(article => (
                            <ArticleCardItem key={article.id} article={article} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                        <button
                            onClick={() => handlePage(page - 1)}
                            disabled={page <= 1}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: page <= 1 ? colors.textTertiary : colors.textSecondary, cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.85rem' }}
                        >
                            <ChevronLeft size={14} /> Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                            let pg: number;
                            if (totalPages <= 7) {
                                pg = i + 1;
                            } else if (page <= 4) {
                                pg = i + 1 <= 5 ? i + 1 : i === 5 ? -1 : totalPages;
                            } else if (page >= totalPages - 3) {
                                pg = i === 0 ? 1 : i === 1 ? -1 : totalPages - (6 - i);
                            } else {
                                pg = i === 0 ? 1 : i === 1 ? -1 : i === 5 ? -2 : i === 6 ? totalPages : page + (i - 3);
                            }
                            if (pg < 0) return <span key={i} style={{ color: colors.textTertiary, fontSize: '0.85rem', padding: '0 4px' }}>…</span>;
                            return (
                                <button
                                    key={pg}
                                    onClick={() => handlePage(pg)}
                                    style={{ width: 34, height: 34, borderRadius: borderRadius.sm, border: '1px solid', borderColor: page === pg ? colors.primary : 'rgba(255,255,255,0.1)', backgroundColor: page === pg ? colors.primary + '22' : 'transparent', color: page === pg ? colors.primary : colors.textSecondary, cursor: 'pointer', fontSize: '0.85rem', fontWeight: page === pg ? 700 : 400 }}
                                >
                                    {pg}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => handlePage(page + 1)}
                            disabled={page >= totalPages}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: page >= totalPages ? colors.textTertiary : colors.textSecondary, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.85rem' }}
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
