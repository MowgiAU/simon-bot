/**
 * Writing Studio — dedicated standalone article authoring surface (/write).
 * Contributors (and staff/admin) write articles here for staff approval.
 * Features: my-articles list, focused editor, autosave, live preview.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ArticleEditorRich } from '../components/ArticleEditorRich';
import { ArticleEmbedHydrator } from '../components/ArticleEmbeds';
import {
    PenSquare, Plus, ChevronLeft, Eye, EyeOff, Clock, CheckCircle, XCircle,
    Edit3, AlertCircle, MessageSquare, Loader2, ExternalLink, Image as ImageIcon, X, Trash2,
} from 'lucide-react';

interface Article {
    id: string; slug: string; title: string; subtitle: string | null; content: string;
    excerpt: string | null; coverImageUrl: string | null; squareThumbnailUrl: string | null;
    category: string; tags: string[] | null; status: string; publishedAt: string | null;
    reviewNote: string | null; reviewedByName: string | null; updatedAt: string;
}

const CATEGORIES = [
    { value: 'news', label: 'News', color: '#A78BFA' },
    { value: 'guide', label: 'Guide', color: '#FBBF24' },
    { value: 'announcement', label: 'Announcement', color: '#F472B6' },
    { value: 'tutorial', label: 'Tutorial', color: '#F5A04A' },
];
const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    draft: { label: 'Draft', icon: <Edit3 size={12} />, color: colors.textSecondary },
    pending: { label: 'Pending Review', icon: <Clock size={12} />, color: colors.warning },
    published: { label: 'Published', icon: <CheckCircle size={12} />, color: colors.success },
    rejected: { label: 'Changes Requested', icon: <XCircle size={12} />, color: colors.error },
    archived: { label: 'Archived', icon: <AlertCircle size={12} />, color: colors.textTertiary },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const m = STATUS_META[status] || STATUS_META.draft;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30` }}>
            {m.icon} {m.label}
        </span>
    );
};

const navigate = (path: string) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };

// ── Live preview pane (reuses the public .article-content styling + embed hydrator) ──
const PreviewPane: React.FC<{ title: string; subtitle: string; cover: string; content: string }> = ({ title, subtitle, cover, content }) => {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 4px 60px' }}>
            {cover && <img src={cover} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12, marginBottom: 24 }} />}
            <h1 style={{ fontSize: 34, fontWeight: 800, color: colors.textPrimary, margin: '0 0 8px', lineHeight: 1.2 }}>{title || 'Untitled article'}</h1>
            {subtitle && <p style={{ fontSize: 18, color: colors.textSecondary, margin: '0 0 24px' }}>{subtitle}</p>}
            <div ref={ref} className="article-content" dangerouslySetInnerHTML={{ __html: content }}
                style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 1.8 }} />
            <ArticleEmbedHydrator contentRef={ref} articleContent={content} />
            <style>{`
                .article-content h2 { font-size: 24px; font-weight: 700; margin: 32px 0 16px; color: ${colors.textPrimary}; }
                .article-content h3 { font-size: 20px; font-weight: 600; margin: 28px 0 12px; color: ${colors.textPrimary}; }
                .article-content p { margin: 12px 0; }
                .article-content img { max-width: 100%; border-radius: 10px; margin: 20px 0; }
                .article-content a { color: ${colors.primary}; text-decoration: underline; text-underline-offset: 2px; }
                .article-content blockquote { border-left: 3px solid ${colors.primary}; margin: 20px 0; padding: 16px 24px; background: rgba(242,120,10,0.06); border-radius: 0 10px 10px 0; color: ${colors.textSecondary}; font-style: italic; }
                .article-content pre { background: ${colors.surface}; padding: 20px; border-radius: 10px; font-family: monospace; font-size: 13px; overflow-x: auto; margin: 20px 0; border: 1px solid rgba(255,255,255,0.06); }
                .article-content code { background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
                .article-content pre code { background: transparent; padding: 0; }
                .article-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 32px 0; }
                .article-content ul, .article-content ol { padding-left: 28px; margin: 12px 0; }
                .article-content li { margin: 6px 0; }
            `}</style>
        </div>
    );
};

// ── Studio editor (create/edit one article) ─────────────────────────────────────
const StudioEditor: React.FC<{ articleId: string | 'new' }> = ({ articleId }) => {
    const [id, setId] = useState<string | null>(articleId === 'new' ? null : articleId);
    const [loading, setLoading] = useState(articleId !== 'new');
    const [status, setStatus] = useState('draft');
    const [reviewNote, setReviewNote] = useState<string | null>(null);
    const [reviewedByName, setReviewedByName] = useState<string | null>(null);
    const [slug, setSlug] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [content, setContent] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [category, setCategory] = useState('news');
    const [coverImageUrl, setCoverImageUrl] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [uploadingCover, setUploadingCover] = useState(false);

    const [preview, setPreview] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const idRef = useRef<string | null>(id);
    const savingRef = useRef(false);
    const dirtyRef = useRef(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadedRef = useRef(false);

    const editable = status === 'draft' || status === 'rejected';

    // Load existing article
    useEffect(() => {
        if (articleId === 'new') { loadedRef.current = true; return; }
        let alive = true;
        axios.get(`/api/my/articles/${articleId}`, { withCredentials: true })
            .then(r => {
                if (!alive) return;
                const a: Article = r.data;
                setId(a.id); idRef.current = a.id;
                setStatus(a.status); setReviewNote(a.reviewNote); setReviewedByName(a.reviewedByName); setSlug(a.slug);
                setTitle(a.title || ''); setSubtitle(a.subtitle || ''); setContent(a.content || '');
                setExcerpt(a.excerpt || ''); setCategory(a.category || 'news'); setCoverImageUrl(a.coverImageUrl || '');
                setTagsInput((a.tags || []).join(', '));
            })
            .catch(() => {})
            .finally(() => { if (alive) { setLoading(false); loadedRef.current = true; } });
        return () => { alive = false; };
    }, [articleId]);

    const buildPayload = (extra?: any) => ({
        title, subtitle: subtitle || null, content, excerpt: excerpt || null,
        coverImageUrl: coverImageUrl || null, category,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        ...extra,
    });

    const persist = useCallback(async (opts?: { status?: string; silent?: boolean }): Promise<Article | null> => {
        if (savingRef.current) return null;
        // Create requires title + content
        if (!idRef.current && (!title.trim() || !content.trim())) return null;
        savingRef.current = true;
        if (!opts?.silent) setSaveState('saving');
        try {
            const payload = buildPayload(opts?.status ? { status: opts.status } : undefined);
            let a: Article;
            if (idRef.current) {
                a = (await axios.patch(`/api/my/articles/${idRef.current}`, payload, { withCredentials: true })).data;
            } else {
                a = (await axios.post('/api/my/articles', payload, { withCredentials: true })).data;
                setId(a.id); idRef.current = a.id;
                window.history.replaceState({}, '', `/write/${a.id}`);
            }
            setStatus(a.status); setSlug(a.slug);
            if (a.status !== 'rejected') { setReviewNote(a.reviewNote); setReviewedByName(a.reviewedByName); }
            dirtyRef.current = false;
            setSaveState('saved'); setLastSavedAt(new Date());
            return a;
        } catch {
            setSaveState('error');
            return null;
        } finally {
            savingRef.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, subtitle, content, excerpt, coverImageUrl, category, tagsInput]);

    // Autosave on change (debounced) — only while editable
    useEffect(() => {
        if (!loadedRef.current || !editable) return;
        dirtyRef.current = true;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { persist({ silent: false }); }, 1500);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, subtitle, content, excerpt, coverImageUrl, category, tagsInput]);

    const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setUploadingCover(true);
        try {
            const fd = new FormData(); fd.append('articleCover', file);
            const r = await axios.post('/api/my/articles/upload-cover', fd, { withCredentials: true });
            setCoverImageUrl(r.data.url);
        } catch { /* silent */ }
        setUploadingCover(false); e.target.value = '';
    };
    const uploadImage = async (file: File): Promise<string> => {
        const fd = new FormData(); fd.append('articleImage', file);
        return (await axios.post('/api/my/articles/upload-image', fd, { withCredentials: true })).data.url;
    };
    const uploadFile = async (file: File, type: 'audio' | 'project' | 'preset') => {
        const fd = new FormData(); fd.append(type === 'audio' ? 'articleAudio' : type === 'project' ? 'articleProject' : 'articlePreset', file);
        return (await axios.post(`/api/my/articles/upload-${type}`, fd, { withCredentials: true })).data;
    };

    const submitForReview = async () => {
        if (!title.trim() || !content.trim()) { alert('A title and some content are required before submitting.'); return; }
        setSubmitting(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const a = await persist({ status: 'pending' });
        setSubmitting(false);
        if (a) navigate('/write');
    };

    if (loading) return <div style={{ padding: 60, textAlign: 'center', color: colors.textSecondary }}><Loader2 size={22} className="spin" /> Loading…</div>;

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' };

    const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? `Saved${lastSavedAt ? ' · ' + lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}` : saveState === 'error' ? 'Save failed' : '';

    return (
        <div style={{ minHeight: '100vh', background: colors.background, color: colors.textPrimary }}>
            {/* Sticky header */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
                <button onClick={() => navigate('/write')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: 13 }}>
                    <ChevronLeft size={16} /> My Articles
                </button>
                <StatusPill status={status} />
                <span style={{ fontSize: 12, color: saveState === 'error' ? colors.error : colors.textTertiary }}>{saveLabel}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setPreview(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: preview ? `${colors.primary}18` : 'transparent', border: `1px solid ${preview ? colors.primary : colors.border}`, borderRadius: borderRadius.sm, color: preview ? colors.primary : colors.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        {preview ? <EyeOff size={14} /> : <Eye size={14} />} {preview ? 'Edit' : 'Preview'}
                    </button>
                    {status === 'published' && slug && (
                        <a href={`/article/${slug}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textSecondary, textDecoration: 'none', fontSize: 13 }}>
                            <ExternalLink size={14} /> View
                        </a>
                    )}
                    {editable && (
                        <button onClick={submitForReview} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: colors.primary, border: 'none', borderRadius: borderRadius.sm, color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>
                            {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />} Submit for Review
                        </button>
                    )}
                </div>
            </div>

            {/* Rejection feedback */}
            {status === 'rejected' && reviewNote && (
                <div style={{ maxWidth: 1100, margin: '16px auto 0', padding: '14px 16px', borderRadius: borderRadius.md, background: `${colors.error}10`, border: `1px solid ${colors.error}30` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <MessageSquare size={15} color={colors.error} />
                        <strong style={{ color: colors.error, fontSize: 13 }}>Changes requested</strong>
                        {reviewedByName && <span style={{ fontSize: 11, color: colors.textTertiary }}>from {reviewedByName}</span>}
                    </div>
                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{reviewNote}</p>
                </div>
            )}

            {!editable && status !== 'published' && (
                <div style={{ maxWidth: 1100, margin: '16px auto 0', padding: '12px 16px', borderRadius: borderRadius.md, background: `${colors.warning}12`, border: `1px solid ${colors.warning}30`, color: colors.textSecondary, fontSize: 13 }}>
                    This article is <strong>{STATUS_META[status]?.label || status}</strong> and can't be edited right now.
                </div>
            )}

            {preview ? (
                <div style={{ padding: '24px 20px' }}><PreviewPane title={title} subtitle={subtitle} cover={coverImageUrl} content={content} /></div>
            ) : (
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 24, alignItems: 'start' }}>
                    {/* Main */}
                    <div style={{ minWidth: 0 }}>
                        <input value={title} onChange={e => setTitle(e.target.value)} disabled={!editable} placeholder="Article title"
                            style={{ width: '100%', padding: '8px 0', background: 'transparent', border: 'none', borderBottom: `1px solid ${colors.border}`, color: colors.textPrimary, fontSize: 30, fontWeight: 800, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />
                        <div style={{ pointerEvents: editable ? 'auto' : 'none', opacity: editable ? 1 : 0.7 }}>
                            <ArticleEditorRich value={content} onChange={setContent} onImageUpload={uploadImage} onFileUpload={uploadFile}
                                placeholder="Start writing… use the toolbar for headings, media, and embeds." />
                        </div>
                    </div>

                    {/* Sidebar details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: colors.surface, borderRadius: borderRadius.md, padding: 16, border: `1px solid ${colors.border}` }}>
                        <div>
                            <label style={labelStyle}>Cover image</label>
                            {coverImageUrl ? (
                                <div style={{ position: 'relative' }}>
                                    <img src={coverImageUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: borderRadius.sm }} />
                                    {editable && <button onClick={() => setCoverImageUrl('')} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#fff', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>}
                                </div>
                            ) : (
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 80, border: `1px dashed ${colors.border}`, borderRadius: borderRadius.sm, cursor: editable ? 'pointer' : 'default', color: colors.textSecondary, fontSize: 13 }}>
                                    {uploadingCover ? <Loader2 size={16} className="spin" /> : <><ImageIcon size={16} /> Upload cover</>}
                                    <input type="file" accept="image/*" disabled={!editable} onChange={handleCover} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>
                        <div>
                            <label style={labelStyle}>Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} disabled={!editable} style={inputStyle}>
                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Subtitle</label>
                            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} disabled={!editable} placeholder="Optional subtitle" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Excerpt</label>
                            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} disabled={!editable} placeholder="Short summary for cards" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Tags</label>
                            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} disabled={!editable} placeholder="comma, separated" style={inputStyle} />
                        </div>
                    </div>
                </div>
            )}
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// ── My-articles list ────────────────────────────────────────────────────────────
const ArticleList: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        axios.get('/api/my/articles', { params: { limit: 100 }, withCredentials: true })
            .then(r => setArticles(r.data.articles || []))
            .catch(() => setArticles([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    const del = async (e: React.MouseEvent, a: Article) => {
        e.stopPropagation();
        if (!confirm(`Delete draft "${a.title}"?`)) return;
        setDeletingId(a.id);
        try { await axios.delete(`/api/my/articles/${a.id}`, { withCredentials: true }); load(); }
        catch (err: any) { alert(err.response?.data?.error || 'Failed to delete'); }
        finally { setDeletingId(null); }
    };

    return (
        <div style={{ minHeight: '100vh', background: colors.background, color: colors.textPrimary }}>
            <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px 60px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    <PenSquare size={30} color={colors.primary} style={{ marginRight: 14 }} />
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Writing Studio</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: 14 }}>Write articles and submit them for staff approval.</p>
                    </div>
                    <button onClick={() => navigate('/write/new')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: colors.primary, border: 'none', borderRadius: borderRadius.md, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                        <Plus size={16} /> New Article
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: colors.textSecondary }}><Loader2 size={20} className="spin" /> Loading…</div>
                ) : articles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', border: `1px dashed ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textSecondary }}>
                        <PenSquare size={34} color={colors.textTertiary} style={{ marginBottom: 12 }} />
                        <p style={{ margin: '0 0 16px' }}>You haven't written anything yet.</p>
                        <button onClick={() => navigate('/write/new')} style={{ padding: '10px 20px', background: colors.primary, border: 'none', borderRadius: borderRadius.md, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Write your first article</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {articles.map(a => (
                            <div key={a.id} onClick={() => navigate(`/write/${a.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: colors.surface, borderRadius: borderRadius.md, border: `1px solid ${colors.border}`, cursor: 'pointer' }}>
                                {a.coverImageUrl
                                    ? <img src={a.coverImageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                                    : <div style={{ width: 56, height: 56, borderRadius: 8, background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ImageIcon size={18} color={colors.textTertiary} /></div>}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || 'Untitled'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        <StatusPill status={a.status} />
                                        <span style={{ fontSize: 12, color: colors.textTertiary }}>Updated {new Date(a.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {a.status === 'draft' && (
                                    <button onClick={e => del(e, a)} disabled={deletingId === a.id} title="Delete draft" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: 6, flexShrink: 0 }}>
                                        {deletingId === a.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// ── Root: access gate + routing between list / editor ───────────────────────────
export const WritingStudio: React.FC = () => {
    const [access, setAccess] = useState<{ canWrite: boolean; isStaff: boolean } | null>(null);
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    useEffect(() => {
        axios.get('/api/me/article-access', { withCredentials: true })
            .then(r => setAccess(r.data))
            .catch(() => setAccess({ canWrite: false, isStaff: false }));
    }, []);

    if (access === null) {
        return <div style={{ minHeight: '100vh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}><Loader2 size={22} className="spin" /></div>;
    }
    if (!access.canWrite) {
        return (
            <div style={{ minHeight: '100vh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ maxWidth: 440, textAlign: 'center', color: colors.textPrimary }}>
                    <PenSquare size={40} color={colors.textTertiary} style={{ marginBottom: 16 }} />
                    <h2 style={{ margin: '0 0 8px' }}>Writer access needed</h2>
                    <p style={{ color: colors.textSecondary, marginBottom: 24 }}>You don't currently have permission to write articles. Ask a staff member for the contributor role to get started.</p>
                    <a href="/" style={{ display: 'inline-block', padding: '10px 22px', background: colors.primary, borderRadius: borderRadius.md, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Back to site</a>
                    <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    const rest = path.replace(/^\/write\/?/, '');
    if (rest === 'new') return <StudioEditor articleId="new" />;
    if (rest) return <StudioEditor key={rest} articleId={rest} />;
    return <ArticleList />;
};

export default WritingStudio;
