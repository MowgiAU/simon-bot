import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { ArticleEditor } from './Articles';
import {
    ClipboardCheck, Clock, CheckCircle, XCircle, AlertCircle,
    Edit3, Eye, Star, StarOff, Search, FileText, X, MessageSquare,
    Archive, Trash2, Filter,
} from 'lucide-react';

interface Article {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    content: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    authorUserId: string;
    authorName: string;
    authorAvatar: string | null;
    category: string;
    tags: string[];
    status: string;
    publishedAt: string | null;
    reviewedByUserId: string | null;
    reviewedByName: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
    isFeatured: boolean;
    featuredAt: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    viewCount: number;
    createdAt: string;
    updatedAt: string;
}

const CATEGORIES = [
    { value: 'news', label: 'News', color: '#A78BFA' },
    { value: 'guide', label: 'Guide', color: '#FBBF24' },
    { value: 'announcement', label: 'Announcement', color: '#F472B6' },
    { value: 'tutorial', label: 'Tutorial', color: '#F5A04A' },
];

const STATUSES = [
    { value: 'draft', label: 'Draft', icon: <Edit3 size={12} />, color: colors.textSecondary },
    { value: 'pending', label: 'Pending Review', icon: <Clock size={12} />, color: colors.warning },
    { value: 'published', label: 'Published', icon: <CheckCircle size={12} />, color: colors.success },
    { value: 'rejected', label: 'Rejected', icon: <XCircle size={12} />, color: colors.error },
    { value: 'archived', label: 'Archived', icon: <AlertCircle size={12} />, color: colors.textTertiary },
];

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const cfg = STATUSES.find(s => s.value === status) || STATUSES[0];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
            background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30`,
        }}>
            {cfg.icon} {cfg.label}
        </span>
    );
};

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
    const cfg = CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
    return (
        <span style={{
            display: 'inline-flex', padding: '2px 8px', borderRadius: '12px', fontSize: '10px',
            fontWeight: 700, background: `${cfg.color}18`, color: cfg.color, textTransform: 'uppercase',
            letterSpacing: '0.05em',
        }}>
            {cfg.label}
        </span>
    );
};

// ── REVIEW PANEL (slide-in detail + actions) ──────────────────────────────────
const ReviewPanel: React.FC<{
    article: Article;
    onClose: () => void;
    onAction: () => void;
}> = ({ article, onClose, onAction }) => {
    const [reviewNote, setReviewNote] = useState(article.reviewNote || '');
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const handleStatusChange = async (newStatus: string) => {
        setSaving(true);
        try {
            const data: any = { status: newStatus };
            if (newStatus === 'rejected' && reviewNote.trim()) {
                data.reviewNote = reviewNote;
            }
            await axios.patch(`/api/admin/articles/${article.id}`, data, { withCredentials: true });
            onAction();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to update article');
        }
        setSaving(false);
    };

    const handleToggleFeature = async () => {
        setSaving(true);
        try {
            await axios.patch(`/api/admin/articles/${article.id}/feature`, {
                isFeatured: !article.isFeatured,
            }, { withCredentials: true });
            onAction();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to toggle feature');
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('Permanently delete this article?')) return;
        setSaving(true);
        try {
            await axios.delete(`/api/admin/articles/${article.id}`, { withCredentials: true });
            onAction();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to delete article');
        }
        setSaving(false);
    };

    const handleAdminSave = async (data: any) => {
        setSaving(true);
        try {
            await axios.patch(`/api/admin/articles/${article.id}`, data, { withCredentials: true });
            setEditMode(false);
            onAction();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to save article');
        }
        setSaving(false);
    };

    if (editMode) {
        return (
            <>
                <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '720px',
                    background: colors.background, borderLeft: '1px solid rgba(255,255,255,0.06)',
                    overflowY: 'auto', zIndex: 1000, boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
                    padding: '24px',
                }}>
                    <ArticleEditor
                        article={article}
                        onSave={handleAdminSave}
                        onCancel={() => setEditMode(false)}
                        saving={saving}
                        isAdmin={true}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '480px',
                background: colors.surface, borderLeft: '1px solid rgba(255,255,255,0.06)',
                overflowY: 'auto', zIndex: 1000, boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
                padding: '24px',
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.05)',
                    border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.textSecondary,
                }}><X size={16} /></button>

                {/* Cover */}
                {article.coverImageUrl && (
                    <img src={article.coverImageUrl} alt="" style={{
                        width: '100%', height: '180px', objectFit: 'cover', borderRadius: borderRadius.md, marginBottom: '16px',
                    }} />
                )}

                <h2 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: '18px', paddingRight: '40px' }}>
                    {article.title}
                </h2>
                {article.subtitle && (
                    <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '14px' }}>{article.subtitle}</p>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <StatusBadge status={article.status} />
                    <CategoryBadge category={article.category} />
                    {article.isFeatured && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                            background: '#FBBF2418', color: '#FBBF24', border: '1px solid #FBBF2430',
                        }}>
                            <Star size={10} fill="#FBBF24" /> Featured
                        </span>
                    )}
                </div>

                {/* Meta info */}
                <div style={{ fontSize: '12px', color: colors.textTertiary, marginBottom: '16px', lineHeight: 1.8 }}>
                    <div>Author: <strong style={{ color: colors.textSecondary }}>{article.authorName}</strong></div>
                    <div>Created: {new Date(article.createdAt).toLocaleString()}</div>
                    <div>Updated: {new Date(article.updatedAt).toLocaleString()}</div>
                    {article.publishedAt && <div>Published: {new Date(article.publishedAt).toLocaleString()}</div>}
                    {article.reviewedByName && <div>Reviewed by: {article.reviewedByName} ({article.reviewedAt ? new Date(article.reviewedAt).toLocaleDateString() : ''})</div>}
                    <div>Views: {article.viewCount}</div>
                    {article.tags.length > 0 && (
                        <div style={{ marginTop: '4px' }}>Tags: {article.tags.map(t => (
                            <span key={t} style={{ display: 'inline-block', padding: '1px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', fontSize: '11px', marginRight: '4px' }}>{t}</span>
                        ))}</div>
                    )}
                </div>

                {/* Excerpt */}
                {article.excerpt && (
                    <div style={{
                        padding: '12px', background: colors.background, borderRadius: borderRadius.sm,
                        fontSize: '13px', color: colors.textSecondary, marginBottom: '16px',
                        borderLeft: `3px solid ${colors.primary}30`,
                    }}>
                        {article.excerpt}
                    </div>
                )}

                {/* Content preview */}
                <div style={{
                    padding: '16px', background: colors.background, borderRadius: borderRadius.md,
                    marginBottom: '20px', maxHeight: '300px', overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.04)',
                }}>
                    <div style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: 1.7 }}
                        dangerouslySetInnerHTML={{ __html: article.content }} />
                </div>

                {/* Previous review note */}
                {article.reviewNote && (
                    <div style={{
                        padding: '14px', marginBottom: '16px', borderRadius: borderRadius.md,
                        backgroundColor: article.status === 'rejected' ? `${colors.error}10` : `${colors.primary}10`,
                        border: `1px solid ${article.status === 'rejected' ? colors.error : colors.primary}25`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <MessageSquare size={14} color={article.status === 'rejected' ? colors.error : colors.primary} />
                            <strong style={{ color: article.status === 'rejected' ? colors.error : colors.primary, fontSize: '12px' }}>
                                Previous Review Note
                            </strong>
                        </div>
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {article.reviewNote}
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', marginTop: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Admin Actions
                    </h3>

                    {/* Review note textarea (for rejections / general feedback) */}
                    {['pending', 'draft', 'published'].includes(article.status) && (
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px' }}>
                                Review Note / Feedback
                            </label>
                            <textarea
                                value={reviewNote}
                                onChange={e => setReviewNote(e.target.value)}
                                placeholder="Provide feedback for the author (required for rejection, optional for approval)..."
                                rows={4}
                                maxLength={2000}
                                style={{
                                    width: '100%', padding: '10px 14px', background: colors.background,
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm,
                                    color: colors.textPrimary, fontSize: '13px', outline: 'none', resize: 'vertical',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px', textAlign: 'right' }}>
                                {reviewNote.length}/2000
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Edit */}
                        <button onClick={() => setEditMode(true)} disabled={saving} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: borderRadius.sm, color: colors.textPrimary, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        }}>
                            <Edit3 size={14} /> Edit Article Content
                        </button>

                        {/* Approve & Publish (pending or draft) */}
                        {['pending', 'draft', 'rejected'].includes(article.status) && (
                            <button onClick={() => handleStatusChange('published')} disabled={saving} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: colors.success, border: 'none',
                                borderRadius: borderRadius.sm, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                                opacity: saving ? 0.5 : 1,
                            }}>
                                <CheckCircle size={14} /> Approve &amp; Publish
                            </button>
                        )}

                        {/* Reject (pending) */}
                        {article.status === 'pending' && (
                            <button onClick={() => {
                                if (!reviewNote.trim()) {
                                    alert('Please provide feedback before rejecting the article.');
                                    return;
                                }
                                handleStatusChange('rejected');
                            }} disabled={saving} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: `${colors.error}12`, border: `1px solid ${colors.error}30`,
                                borderRadius: borderRadius.sm, color: colors.error, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                                opacity: saving ? 0.5 : 1,
                            }}>
                                <XCircle size={14} /> Reject with Feedback
                            </button>
                        )}

                        {/* Archive (published) */}
                        {article.status === 'published' && (
                            <button onClick={() => handleStatusChange('archived')} disabled={saving} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                <Archive size={14} /> Archive
                            </button>
                        )}

                        {/* Feature toggle (published only) */}
                        {article.status === 'published' && (
                            <button onClick={handleToggleFeature} disabled={saving} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: article.isFeatured ? '#FBBF2418' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${article.isFeatured ? '#FBBF2430' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: borderRadius.sm, color: article.isFeatured ? '#FBBF24' : colors.textSecondary,
                                cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                {article.isFeatured ? <><StarOff size={14} /> Unfeature</> : <><Star size={14} /> Feature</>}
                            </button>
                        )}

                        {/* View published page */}
                        {article.status === 'published' && (
                            <a href={`/article/${article.slug}`} target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: colors.primary, border: 'none',
                                borderRadius: borderRadius.sm, color: 'white', textDecoration: 'none',
                                fontWeight: 600, fontSize: '13px',
                            }}>
                                <Eye size={14} /> View Published Page
                            </a>
                        )}

                        {/* Delete */}
                        <button onClick={handleDelete} disabled={saving} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '10px', background: `${colors.error}08`, border: `1px solid ${colors.error}20`,
                            borderRadius: borderRadius.sm, color: colors.error, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            marginTop: '8px',
                        }}>
                            <Trash2 size={14} /> Delete Article
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export const ArticleReviewPage: React.FC = () => {
    const { user } = useAuth();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchArticles = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 25 };
            if (filterStatus) params.status = filterStatus;
            if (filterCategory) params.category = filterCategory;
            const res = await axios.get('/api/admin/articles', { params, withCredentials: true });
            setArticles(res.data.articles || []);
            setTotalPages(res.data.totalPages || 1);
        } catch { setArticles([]); }
        setLoading(false);
    }, [page, filterStatus, filterCategory]);

    useEffect(() => { fetchArticles(); }, [fetchArticles]);

    const handleAction = () => {
        setSelectedArticle(null);
        fetchArticles();
    };

    const handleQuickDelete = async (e: React.MouseEvent, article: Article) => {
        e.stopPropagation();
        if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
        setDeletingId(article.id);
        try {
            await axios.delete(`/api/admin/articles/${article.id}`, { withCredentials: true });
            if (selectedArticle?.id === article.id) setSelectedArticle(null);
            fetchArticles();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete article');
        } finally {
            setDeletingId(null);
        }
    };

    // Count by status (simple: just use the current list for display, not a separate request)
    const pendingCount = articles.filter(a => a.status === 'pending').length;

    const filtered = articles.filter(a =>
        !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.authorName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <ClipboardCheck size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Article Review</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Review, approve, reject, and manage submitted articles.
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Articles submitted by community members appear here for review. You can approve and publish them,
                    reject with feedback so authors can revise, or edit the content before publishing. You can also
                    feature published articles for the front page.
                </p>
            </div>

            {/* Status tabs */}
            <div style={{
                display: 'flex', gap: '4px', marginBottom: '16px', overflowX: 'auto',
                padding: '4px', backgroundColor: colors.surface, borderRadius: borderRadius.md,
            }}>
                {[
                    { value: '', label: 'All' },
                    { value: 'pending', label: 'Pending Review' },
                    { value: 'published', label: 'Published' },
                    { value: 'rejected', label: 'Rejected' },
                    { value: 'draft', label: 'Drafts' },
                    { value: 'archived', label: 'Archived' },
                ].map(tab => (
                    <button key={tab.value} onClick={() => { setFilterStatus(tab.value); setPage(1); }} style={{
                        padding: '8px 16px', borderRadius: borderRadius.sm, border: 'none',
                        background: filterStatus === tab.value ? colors.primary : 'transparent',
                        color: filterStatus === tab.value ? 'white' : colors.textSecondary,
                        cursor: 'pointer', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                    }}>
                        {tab.label}
                        {tab.value === 'pending' && filterStatus !== 'pending' && pendingCount > 0 && (
                            <span style={{
                                marginLeft: '6px', padding: '1px 6px', borderRadius: '10px',
                                background: colors.warning, color: 'white', fontSize: '10px', fontWeight: 700,
                            }}>{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Filter bar */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
                padding: '12px 14px', backgroundColor: colors.surface, borderRadius: borderRadius.md,
                alignItems: 'center',
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                    <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by title or author..."
                        style={{
                            width: '100%', padding: '8px 10px 8px 32px', background: colors.background,
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm,
                            color: colors.textPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>
                <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }} style={{
                    padding: '8px 12px', background: colors.background, border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: '13px', outline: 'none', cursor: 'pointer',
                }}>
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
            </div>

            {/* Article List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textTertiary }}>Loading...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textTertiary }}>
                    <FileText size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                    <p>{filterStatus === 'pending' ? 'No articles pending review.' : 'No articles found.'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {filtered.map(article => (
                        <div key={article.id} onClick={() => setSelectedArticle(article)} style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px 16px', background: selectedArticle?.id === article.id ? `${colors.primary}10` : colors.surface,
                            borderRadius: borderRadius.md, cursor: 'pointer',
                            border: selectedArticle?.id === article.id ? `1px solid ${colors.primary}30` : '1px solid rgba(255,255,255,0.04)',
                            transition: 'all 0.15s',
                        }}>
                            {/* Cover thumbnail */}
                            <div style={{
                                width: '52px', height: '52px', borderRadius: borderRadius.sm, overflow: 'hidden',
                                background: colors.background, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {article.coverImageUrl
                                    ? <img src={article.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <FileText size={18} color={colors.textTertiary} style={{ opacity: 0.3 }} />}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '14px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {article.title}
                                    </span>
                                    {article.isFeatured && <Star size={12} fill="#FBBF24" color="#FBBF24" />}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <StatusBadge status={article.status} />
                                    <CategoryBadge category={article.category} />
                                    <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                                        by {article.authorName}
                                    </span>
                                    <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                                        {new Date(article.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Row actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {article.status === 'pending' && (
                                    <div style={{
                                        padding: '6px 12px', borderRadius: borderRadius.sm,
                                        background: `${colors.warning}15`, border: `1px solid ${colors.warning}25`,
                                        fontSize: '11px', fontWeight: 700, color: colors.warning,
                                    }}>
                                        Needs Review
                                    </div>
                                )}
                                <button
                                    onClick={e => handleQuickDelete(e, article)}
                                    disabled={deletingId === article.id}
                                    title="Delete article"
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: 30, height: 30, borderRadius: borderRadius.sm,
                                        background: 'transparent', border: '1px solid transparent',
                                        color: colors.textTertiary, cursor: 'pointer', flexShrink: 0,
                                        transition: 'all 0.15s',
                                        opacity: deletingId === article.id ? 0.4 : 1,
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.color = colors.error;
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = `${colors.error}30`;
                                        (e.currentTarget as HTMLButtonElement).style.background = `${colors.error}10`;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)} style={{
                            width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                            background: p === page ? colors.primary : colors.surface,
                            color: p === page ? 'white' : colors.textSecondary,
                            cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                        }}>{p}</button>
                    ))}
                </div>
            )}

            {/* Review panel */}
            {selectedArticle && (
                <ReviewPanel
                    article={selectedArticle}
                    onClose={() => setSelectedArticle(null)}
                    onAction={handleAction}
                />
            )}
        </div>
    );
};
