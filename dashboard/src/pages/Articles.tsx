import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { RichTextEditor } from '../components/RichTextEditor';
import {
    FileText, Plus, Edit3, Trash2, Eye, Star, StarOff, Send,
    ChevronLeft, Clock, CheckCircle, XCircle, AlertCircle,
    Search, Filter, Image as ImageIcon, Save, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
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
    { value: 'tutorial', label: 'Tutorial', color: '#34D399' },
];

const STATUSES = [
    { value: 'draft', label: 'Draft', icon: <Edit3 size={12} />, color: colors.textSecondary },
    { value: 'pending', label: 'Pending Review', icon: <Clock size={12} />, color: colors.warning },
    { value: 'published', label: 'Published', icon: <CheckCircle size={12} />, color: colors.success },
    { value: 'rejected', label: 'Rejected', icon: <XCircle size={12} />, color: colors.error },
    { value: 'archived', label: 'Archived', icon: <AlertCircle size={12} />, color: colors.textTertiary },
];

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
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

// ── ARTICLE EDITOR ────────────────────────────────────────────────────────────
const ArticleEditor: React.FC<{
    article: Partial<Article> | null;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}> = ({ article, onSave, onCancel, saving }) => {
    const [title, setTitle] = useState(article?.title || '');
    const [subtitle, setSubtitle] = useState(article?.subtitle || '');
    const [content, setContent] = useState(article?.content || '');
    const [excerpt, setExcerpt] = useState(article?.excerpt || '');
    const [coverImageUrl, setCoverImageUrl] = useState(article?.coverImageUrl || '');
    const [category, setCategory] = useState(article?.category || 'news');
    const [tagsInput, setTagsInput] = useState((article?.tags || []).join(', '));
    const [metaTitle, setMetaTitle] = useState(article?.metaTitle || '');
    const [metaDescription, setMetaDescription] = useState(article?.metaDescription || '');
    const [uploadingCover, setUploadingCover] = useState(false);
    const [showSeo, setShowSeo] = useState(false);

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingCover(true);
        try {
            const formData = new FormData();
            formData.append('articleCover', file);
            const res = await axios.post('/api/admin/articles/upload-cover', formData, { withCredentials: true });
            setCoverImageUrl(res.data.url);
        } catch { /* silent */ }
        setUploadingCover(false);
        e.target.value = '';
    };

    const handleImageUpload = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('articleImage', file);
        const res = await axios.post('/api/admin/articles/upload-image', formData, { withCredentials: true });
        return res.data.url;
    };

    const buildPayload = (status: string) => ({
        title, subtitle: subtitle || null, content, excerpt: excerpt || null,
        coverImageUrl: coverImageUrl || null, category,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        metaTitle: metaTitle || null, metaDescription: metaDescription || null,
        status,
    });

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', background: colors.background,
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm,
        color: colors.textPrimary, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary,
        marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
    };

    return (
        <div>
            {/* Back button */}
            <button onClick={onCancel} style={{
                display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent',
                border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px',
                marginBottom: '20px', padding: 0,
            }}>
                <ChevronLeft size={16} /> Back to Articles
            </button>

            <h2 style={{ margin: '0 0 24px', color: colors.textPrimary }}>
                {article?.id ? 'Edit Article' : 'New Article'}
            </h2>

            {/* Cover Image */}
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Cover Image</label>
                {coverImageUrl ? (
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                        <img src={coverImageUrl} alt="Cover" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: borderRadius.md }} />
                        <button onClick={() => setCoverImageUrl('')} style={{
                            position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)',
                            border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white',
                        }}><X size={14} /></button>
                    </div>
                ) : (
                    <label style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        height: '120px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: borderRadius.md,
                        color: colors.textTertiary, cursor: 'pointer', fontSize: '13px',
                    }}>
                        <ImageIcon size={18} /> {uploadingCover ? 'Uploading...' : 'Click to upload cover image'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
                    </label>
                )}
            </div>

            {/* Title */}
            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title"
                    style={{ ...inputStyle, fontSize: '18px', fontWeight: 700 }} maxLength={200} />
            </div>

            {/* Subtitle */}
            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Subtitle</label>
                <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Optional subtitle"
                    style={inputStyle} maxLength={300} />
            </div>

            {/* Category + Tags row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={labelStyle}>Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>
                <div style={{ flex: 2, minWidth: '200px' }}>
                    <label style={labelStyle}>Tags (comma-separated)</label>
                    <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="fl studio, mixing, tips"
                        style={inputStyle} />
                </div>
            </div>

            {/* Excerpt */}
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Excerpt (preview text for cards)</label>
                <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="A short summary shown on article cards..."
                    rows={3} style={{ ...inputStyle, resize: 'vertical' }} maxLength={500} />
            </div>

            {/* Content Editor */}
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Content *</label>
                <RichTextEditor
                    value={content}
                    onChange={setContent}
                    onImageUpload={handleImageUpload}
                    placeholder="Write your article here... Use the toolbar to add formatting, images, videos, track embeds, and more."
                />
            </div>

            {/* SEO Expandable */}
            <div style={{ marginBottom: '24px' }}>
                <button onClick={() => setShowSeo(!showSeo)} style={{
                    background: 'transparent', border: 'none', color: colors.textSecondary,
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                    {showSeo ? '▾' : '▸'} SEO Settings
                </button>
                {showSeo && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Meta Title</label>
                            <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Custom page title" style={inputStyle} maxLength={120} />
                        </div>
                        <div>
                            <label style={labelStyle}>Meta Description</label>
                            <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="Custom description for search engines" rows={2} style={{ ...inputStyle, resize: 'vertical' }} maxLength={300} />
                        </div>
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <button disabled={saving || !title || !content} onClick={() => onSave(buildPayload('draft'))} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', background: colors.surface, border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: borderRadius.sm, color: colors.textPrimary, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    opacity: saving || !title || !content ? 0.5 : 1,
                }}>
                    <Save size={14} /> Save Draft
                </button>
                <button disabled={saving || !title || !content} onClick={() => onSave(buildPayload('pending'))} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', background: `${colors.warning}20`, border: `1px solid ${colors.warning}40`,
                    borderRadius: borderRadius.sm, color: colors.warning, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    opacity: saving || !title || !content ? 0.5 : 1,
                }}>
                    <Send size={14} /> Submit for Review
                </button>
                <button disabled={saving || !title || !content} onClick={() => onSave(buildPayload('published'))} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', background: colors.primary, border: 'none',
                    borderRadius: borderRadius.sm, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    opacity: saving || !title || !content ? 0.5 : 1,
                }}>
                    <CheckCircle size={14} /> Publish Now
                </button>
                <button onClick={onCancel} style={{
                    padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontSize: '13px',
                    marginLeft: 'auto',
                }}>Cancel</button>
            </div>
        </div>
    );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export const ArticlesPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Editor state
    const [editMode, setEditMode] = useState<'list' | 'create' | 'edit'>('list');
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [saving, setSaving] = useState(false);

    // Detail panel
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

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

    const handleSave = async (data: any) => {
        setSaving(true);
        try {
            if (editingArticle?.id) {
                await axios.patch(`/api/admin/articles/${editingArticle.id}`, data, { withCredentials: true });
            } else {
                await axios.post('/api/admin/articles', data, { withCredentials: true });
            }
            setEditMode('list');
            setEditingArticle(null);
            fetchArticles();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to save article');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this article permanently?')) return;
        try {
            await axios.delete(`/api/admin/articles/${id}`, { withCredentials: true });
            setSelectedArticle(null);
            fetchArticles();
        } catch { alert('Failed to delete article'); }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await axios.patch(`/api/admin/articles/${id}`, { status }, { withCredentials: true });
            fetchArticles();
            if (selectedArticle?.id === id) {
                setSelectedArticle(prev => prev ? { ...prev, status } : null);
            }
        } catch { alert('Failed to update status'); }
    };

    const handleToggleFeature = async (id: string) => {
        try {
            const res = await axios.patch(`/api/admin/articles/${id}/feature`, {}, { withCredentials: true });
            fetchArticles();
            if (selectedArticle?.id === id) {
                setSelectedArticle(res.data);
            }
        } catch { alert('Failed to toggle featured status'); }
    };

    // ── Editor mode ───────────────────────────────────────────────────────
    if (editMode !== 'list') {
        return (
            <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '960px' }}>
                <ArticleEditor
                    article={editingArticle}
                    onSave={handleSave}
                    onCancel={() => { setEditMode('list'); setEditingArticle(null); }}
                    saving={saving}
                />
            </div>
        );
    }

    // ── List mode ─────────────────────────────────────────────────────────
    const filtered = articles.filter(a =>
        !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.authorName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <FileText size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Articles</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Create and manage news articles, guides, and announcements for the front page
                    </p>
                </div>
                <button onClick={() => { setEditMode('create'); setEditingArticle(null); }} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', background: colors.primary, border: 'none',
                    borderRadius: borderRadius.sm, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    flexShrink: 0,
                }}>
                    <Plus size={16} /> New Article
                </button>
            </div>

            {/* Explanation */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px' }}>
                    Articles appear on the front page in the Featured Content section. Use the rich editor to write
                    news, guides, tutorials' and announcements with embedded tracks, profiles, videos, and images.
                    Articles with "Pending Review" status need admin approval before publishing. Featured articles
                    replace the news/guide placeholder on the discover page.
                </p>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
                padding: '12px 14px', backgroundColor: colors.surface, borderRadius: borderRadius.md,
                alignItems: 'center',
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                    <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search articles..."
                        style={{
                            width: '100%', padding: '8px 10px 8px 32px', background: colors.background,
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm,
                            color: colors.textPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{
                    padding: '8px 12px', background: colors.background, border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: '13px', outline: 'none', cursor: 'pointer',
                }}>
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
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
                    <p>No articles found. Click "New Article" to create one.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                width: '56px', height: '56px', borderRadius: borderRadius.sm, overflow: 'hidden',
                                background: colors.background, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {article.coverImageUrl
                                    ? <img src={article.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <FileText size={20} color={colors.textTertiary} style={{ opacity: 0.3 }} />}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '14px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {article.title}
                                    </span>
                                    {article.isFeatured && (
                                        <Star size={12} fill={colors.highlight} color={colors.highlight} />
                                    )}
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
                                    {!isMobile && (
                                        <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                                            <Eye size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                                            {article.viewCount}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button onClick={(e) => { e.stopPropagation(); setEditingArticle(article); setEditMode('edit'); }} title="Edit" style={{
                                    width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                    background: 'rgba(255,255,255,0.04)', color: colors.textSecondary,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}><Edit3 size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(article.id); }} title="Delete" style={{
                                    width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                    background: 'rgba(255,255,255,0.04)', color: colors.error,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}><Trash2 size={14} /></button>
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

            {/* Detail Panel (slide-in from right) */}
            {selectedArticle && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '420px',
                    background: colors.surface, borderLeft: '1px solid rgba(255,255,255,0.06)',
                    overflowY: 'auto', zIndex: 1000, boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
                    padding: '24px',
                }}>
                    <button onClick={() => setSelectedArticle(null)} style={{
                        position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.05)',
                        border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.textSecondary,
                    }}><X size={16} /></button>

                    {/* Cover */}
                    {selectedArticle.coverImageUrl && (
                        <img src={selectedArticle.coverImageUrl} alt="" style={{
                            width: '100%', height: '160px', objectFit: 'cover', borderRadius: borderRadius.md, marginBottom: '16px',
                        }} />
                    )}

                    <h2 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: '18px', paddingRight: '40px' }}>
                        {selectedArticle.title}
                    </h2>
                    {selectedArticle.subtitle && (
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '14px' }}>{selectedArticle.subtitle}</p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <StatusBadge status={selectedArticle.status} />
                        <CategoryBadge category={selectedArticle.category} />
                        {selectedArticle.isFeatured && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                                background: `${colors.highlight}18`, color: colors.highlight, border: `1px solid ${colors.highlight}30`,
                            }}>
                                <Star size={10} fill={colors.highlight} /> Featured
                            </span>
                        )}
                    </div>

                    <div style={{ fontSize: '12px', color: colors.textTertiary, marginBottom: '16px', lineHeight: 1.6 }}>
                        <div>Author: <strong style={{ color: colors.textSecondary }}>{selectedArticle.authorName}</strong></div>
                        <div>Created: {new Date(selectedArticle.createdAt).toLocaleString()}</div>
                        {selectedArticle.publishedAt && <div>Published: {new Date(selectedArticle.publishedAt).toLocaleString()}</div>}
                        {selectedArticle.reviewedByName && <div>Reviewed by: {selectedArticle.reviewedByName}</div>}
                        <div>Views: {selectedArticle.viewCount}</div>
                        <div>Slug: <code style={{ color: colors.primary }}>/article/{selectedArticle.slug}</code></div>
                    </div>

                    {selectedArticle.excerpt && (
                        <div style={{
                            padding: '12px', background: colors.background, borderRadius: borderRadius.sm,
                            fontSize: '13px', color: colors.textSecondary, marginBottom: '16px',
                            borderLeft: `3px solid ${colors.primary}30`,
                        }}>
                            {selectedArticle.excerpt}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button onClick={() => { setEditingArticle(selectedArticle); setEditMode('edit'); setSelectedArticle(null); }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '10px', background: colors.primary, border: 'none',
                            borderRadius: borderRadius.sm, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        }}>
                            <Edit3 size={14} /> Edit Article
                        </button>

                        {/* Status actions */}
                        {selectedArticle.status === 'draft' && (
                            <button onClick={() => handleStatusChange(selectedArticle.id, 'pending')} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: `${colors.warning}15`, border: `1px solid ${colors.warning}30`,
                                borderRadius: borderRadius.sm, color: colors.warning, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                <Send size={14} /> Submit for Review
                            </button>
                        )}
                        {(selectedArticle.status === 'pending' || selectedArticle.status === 'draft') && (
                            <button onClick={() => handleStatusChange(selectedArticle.id, 'published')} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: `${colors.success}15`, border: `1px solid ${colors.success}30`,
                                borderRadius: borderRadius.sm, color: colors.success, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                <CheckCircle size={14} /> Approve & Publish
                            </button>
                        )}
                        {selectedArticle.status === 'pending' && (
                            <button onClick={() => handleStatusChange(selectedArticle.id, 'rejected')} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: `${colors.error}15`, border: `1px solid ${colors.error}30`,
                                borderRadius: borderRadius.sm, color: colors.error, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                <XCircle size={14} /> Reject
                            </button>
                        )}
                        {selectedArticle.status === 'published' && (
                            <button onClick={() => handleStatusChange(selectedArticle.id, 'archived')} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                <AlertCircle size={14} /> Archive
                            </button>
                        )}

                        {/* Feature toggle */}
                        {selectedArticle.status === 'published' && (
                            <button onClick={() => handleToggleFeature(selectedArticle.id)} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: selectedArticle.isFeatured ? `${colors.highlight}15` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${selectedArticle.isFeatured ? colors.highlight + '30' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: borderRadius.sm, color: selectedArticle.isFeatured ? colors.highlight : colors.textSecondary,
                                cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            }}>
                                {selectedArticle.isFeatured ? <><StarOff size={14} /> Remove from Featured</> : <><Star size={14} /> Feature on Front Page</>}
                            </button>
                        )}

                        {/* Preview link */}
                        {selectedArticle.status === 'published' && (
                            <a href={`/article/${selectedArticle.slug}`} target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: borderRadius.sm, color: colors.textSecondary, textDecoration: 'none',
                                fontWeight: 600, fontSize: '13px',
                            }}>
                                <Eye size={14} /> View Published Page
                            </a>
                        )}

                        <button onClick={() => handleDelete(selectedArticle.id)} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '10px', background: `${colors.error}08`, border: `1px solid ${colors.error}20`,
                            borderRadius: borderRadius.sm, color: colors.error, cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            marginTop: '8px',
                        }}>
                            <Trash2 size={14} /> Delete Article
                        </button>
                    </div>
                </div>
            )}
            {/* Overlay for detail panel */}
            {selectedArticle && (
                <div onClick={() => setSelectedArticle(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999,
                }} />
            )}
        </div>
    );
};
