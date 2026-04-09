import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { ArticleEmbedHydrator } from '../components/ArticleEmbeds';
import {
    Calendar, Eye, Clock, User, ChevronLeft, Tag,
    Newspaper, BookOpen, Megaphone, GraduationCap, Share2,
} from 'lucide-react';

interface Article {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    content: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    authorName: string;
    authorAvatar: string | null;
    category: string;
    tags: string[];
    publishedAt: string | null;
    viewCount: number;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    news: { icon: <Newspaper size={14} />, label: 'News', color: '#A78BFA' },
    guide: { icon: <BookOpen size={14} />, label: 'Guide', color: '#FBBF24' },
    announcement: { icon: <Megaphone size={14} />, label: 'Announcement', color: '#F472B6' },
    tutorial: { icon: <GraduationCap size={14} />, label: 'Tutorial', color: '#34D399' },
};

export const ArticlePage: React.FC = () => {
    const location = useLocation();
    const slug = location.pathname.split('/article/')[1];
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { setTrack, togglePlay } = usePlayer();
    const contentRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!slug) { setError('Article not found'); setLoading(false); return; }
        const fetchArticle = async () => {
            try {
                const res = await axios.get(`/api/articles/${encodeURIComponent(slug)}`);
                setArticle(res.data);
            } catch {
                setError('Article not found');
            }
            setLoading(false);
        };
        fetchArticle();
    }, [slug]);

    // Wire up social embed clicks (track/profile are now interactive React components)
    useEffect(() => {
        if (!article) return;
        const handler = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('[data-embed-type="social"]') as HTMLElement | null;
            if (!target) return;
            const embedUrl = target.getAttribute('data-embed-url');
            if (embedUrl) {
                e.preventDefault();
                window.open(embedUrl, '_blank', 'noopener,noreferrer');
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [article]);

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: article?.title, url: window.location.href }).catch(() => {});
        } else {
            navigator.clipboard.writeText(window.location.href);
        }
    };

    if (loading) {
        return (
            <DiscoveryLayout activeTab="discover">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: colors.textTertiary }}>
                    Loading article...
                </div>
            </DiscoveryLayout>
        );
    }

    if (error || !article) {
        return (
            <DiscoveryLayout activeTab="discover">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
                    <Newspaper size={48} color={colors.textTertiary} style={{ opacity: 0.3 }} />
                    <h2 style={{ color: colors.textPrimary, margin: 0 }}>Article Not Found</h2>
                    <p style={{ color: colors.textSecondary, margin: 0 }}>This article may have been removed or is not yet published.</p>
                    <Link to="/" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ChevronLeft size={16} /> Back to Discover
                    </Link>
                </div>
            </DiscoveryLayout>
        );
    }

    const catCfg = CATEGORY_CONFIG[article.category] || CATEGORY_CONFIG.news;
    const readTime = Math.max(1, Math.round(article.content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200));

    return (
        <DiscoveryLayout activeTab="discover">
            <article style={{
                maxWidth: '800px', margin: '0 auto',
                padding: isMobile ? '16px' : '32px 24px',
            }}>
                {/* Back link */}
                <Link to="/" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    color: colors.textSecondary, textDecoration: 'none', fontSize: '13px',
                    marginBottom: '20px',
                }}>
                    <ChevronLeft size={14} /> Back to Discover
                </Link>

                {/* Category badge */}
                <div style={{ marginBottom: '12px' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: `${catCfg.color}18`, color: catCfg.color, border: `1px solid ${catCfg.color}30`,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        {catCfg.icon} {catCfg.label}
                    </span>
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: isMobile ? '28px' : '36px', fontWeight: 800, color: colors.textPrimary,
                    lineHeight: 1.2, margin: '0 0 8px', letterSpacing: '-0.02em',
                }}>
                    {article.title}
                </h1>

                {article.subtitle && (
                    <p style={{ fontSize: '18px', color: colors.textSecondary, margin: '0 0 20px', lineHeight: 1.4 }}>
                        {article.subtitle}
                    </p>
                )}

                {/* Meta row */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                    marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {/* Author */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {article.authorAvatar ? (
                            <img src={article.authorAvatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                        ) : (
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '50%', background: colors.surface,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <User size={14} color={colors.textTertiary} />
                            </div>
                        )}
                        <span style={{ fontWeight: 600, fontSize: '13px', color: colors.textPrimary }}>{article.authorName}</span>
                    </div>

                    {article.publishedAt && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textTertiary }}>
                            <Calendar size={12} /> {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textTertiary }}>
                        <Clock size={12} /> {readTime} min read
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textTertiary }}>
                        <Eye size={12} /> {article.viewCount.toLocaleString()} views
                    </span>
                    <button onClick={handleShare} style={{
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                        color: colors.textTertiary, background: 'transparent', border: 'none',
                        cursor: 'pointer', marginLeft: 'auto', padding: 0,
                    }}>
                        <Share2 size={12} /> Share
                    </button>
                </div>

                {/* Cover image */}
                {article.coverImageUrl && (
                    <div style={{
                        marginBottom: '32px', borderRadius: borderRadius.lg, overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <img src={article.coverImageUrl} alt={article.title} style={{
                            width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block',
                        }} />
                    </div>
                )}

                {/* Article content */}
                <div
                    ref={contentRef}
                    className="article-content"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                    style={{
                        color: colors.textPrimary, fontSize: '16px', lineHeight: 1.8,
                        fontFamily: "'Inter', sans-serif",
                    }}
                />

                {/* Hydrate track/profile embeds into interactive components */}
                <ArticleEmbedHydrator contentRef={contentRef} />

                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                    <div style={{
                        display: 'flex', gap: '8px', flexWrap: 'wrap',
                        marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <Tag size={14} color={colors.textTertiary} />
                        {article.tags.map((tag, i) => (
                            <span key={i} style={{
                                padding: '4px 10px', borderRadius: '16px', fontSize: '12px',
                                background: 'rgba(255,255,255,0.04)', color: colors.textSecondary,
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Article styles */}
                <style>{`
                    .article-content h2 {
                        font-size: 24px; font-weight: 700; margin: 32px 0 16px;
                        color: ${colors.textPrimary}; letter-spacing: -0.01em;
                    }
                    .article-content h3 {
                        font-size: 20px; font-weight: 600; margin: 28px 0 12px;
                        color: ${colors.textPrimary};
                    }
                    .article-content p { margin: 12px 0; }
                    .article-content img {
                        max-width: 100%; border-radius: 10px; margin: 20px 0;
                    }
                    .article-content a {
                        color: ${colors.primary}; text-decoration: underline;
                        text-underline-offset: 2px;
                    }
                    .article-content a:hover { opacity: 0.85; }
                    .article-content blockquote {
                        border-left: 3px solid ${colors.primary};
                        margin: 20px 0; padding: 16px 24px;
                        background: rgba(16,185,129,0.06); border-radius: 0 10px 10px 0;
                        color: ${colors.textSecondary}; font-style: italic;
                    }
                    .article-content pre {
                        background: ${colors.surface}; padding: 20px;
                        border-radius: 10px; font-family: 'JetBrains Mono', monospace;
                        font-size: 13px; overflow-x: auto; margin: 20px 0;
                        border: 1px solid rgba(255,255,255,0.06); line-height: 1.5;
                    }
                    .article-content code {
                        background: rgba(255,255,255,0.06); padding: 2px 6px;
                        border-radius: 4px; font-family: 'JetBrains Mono', monospace;
                        font-size: 0.9em;
                    }
                    .article-content pre code { background: transparent; padding: 0; }
                    .article-content hr {
                        border: none; border-top: 1px solid rgba(255,255,255,0.08);
                        margin: 32px 0;
                    }
                    .article-content ul, .article-content ol {
                        padding-left: 28px; margin: 12px 0;
                    }
                    .article-content li { margin: 6px 0; }
                    .article-content .article-embed {
                        transition: border-color 0.15s, transform 0.15s;
                    }
                    .article-content .article-embed:hover {
                        border-color: ${colors.primary} !important;
                    }
                    .article-content .article-video {
                        border-radius: 12px; overflow: hidden;
                    }
                    .article-content .article-video iframe {
                        border-radius: 12px;
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.4; }
                    }
                `}</style>
            </article>
        </DiscoveryLayout>
    );
};
