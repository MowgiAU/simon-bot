/**
 * ArticleRevisions — a "History" button + slide-over panel showing an article's
 * revision snapshots, with preview and restore. Shared by the Writing Studio and
 * the admin Article Review page.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { ArticleEmbedHydrator } from './ArticleEmbeds';
import { History, X, RotateCcw, Loader2 } from 'lucide-react';

interface RevisionMeta { id: string; editorName: string; note: string | null; title: string; createdAt: string; }
interface RevisionFull extends RevisionMeta { subtitle: string | null; excerpt: string | null; content: string; }

const RevisionPreview: React.FC<{ content: string }> = ({ content }) => {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <>
            <div ref={ref} className="article-content" dangerouslySetInnerHTML={{ __html: content }} style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 1.75 }} />
            <ArticleEmbedHydrator contentRef={ref} articleContent={content} />
        </>
    );
};

export const ArticleRevisions: React.FC<{ articleId: string; onRestored?: () => void }> = ({ articleId, onRestored }) => {
    const [open, setOpen] = useState(false);
    const [revisions, setRevisions] = useState<RevisionMeta[]>([]);
    const [canRestore, setCanRestore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<RevisionFull | null>(null);
    const [restoring, setRestoring] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        axios.get(`/api/articles/${articleId}/revisions`, { withCredentials: true })
            .then(r => { setRevisions(r.data.revisions || []); setCanRestore(!!r.data.canRestore); })
            .catch(() => { setRevisions([]); })
            .finally(() => setLoading(false));
    }, [articleId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const view = async (id: string) => {
        try {
            const r = await axios.get(`/api/articles/${articleId}/revisions/${id}`, { withCredentials: true });
            setSelected(r.data);
        } catch { /* ignore */ }
    };

    const restore = async () => {
        if (!selected) return;
        if (!confirm('Restore this version? The current content will be saved as a revision first.')) return;
        setRestoring(true);
        try {
            await axios.post(`/api/articles/${articleId}/revisions/${selected.id}/restore`, {}, { withCredentials: true });
            setSelected(null); setOpen(false);
            onRestored?.();
        } catch (e: any) { alert(e.response?.data?.error || 'Failed to restore'); }
        finally { setRestoring(false); }
    };

    return (
        <>
            <button onClick={() => setOpen(true)} title="Revision history"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <History size={14} /> History
            </button>

            {open && (
                <div onClick={() => { setOpen(false); setSelected(null); }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)' }}>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 100%)', background: colors.surface, borderLeft: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${colors.border}` }}>
                            <History size={18} color={colors.primary} />
                            <span style={{ fontWeight: 700, color: colors.textPrimary, flex: 1 }}>{selected ? 'Revision preview' : 'Revision history'}</span>
                            {selected && <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: 13 }}>← Back</button>}
                            <button onClick={() => { setOpen(false); setSelected(null); }} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
                            {selected ? (
                                <div>
                                    <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 4 }}>{selected.note || 'Revision'} · {selected.editorName} · {new Date(selected.createdAt).toLocaleString()}</div>
                                    <h2 style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, margin: '0 0 4px' }}>{selected.title}</h2>
                                    {selected.subtitle && <p style={{ color: colors.textSecondary, margin: '0 0 16px' }}>{selected.subtitle}</p>}
                                    <RevisionPreview content={selected.content} />
                                    {canRestore && (
                                        <button onClick={restore} disabled={restoring} style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: colors.primary, border: 'none', borderRadius: borderRadius.sm, color: '#fff', cursor: restoring ? 'wait' : 'pointer', fontWeight: 700 }}>
                                            {restoring ? <Loader2 size={15} className="rev-spin" /> : <RotateCcw size={15} />} Restore this version
                                        </button>
                                    )}
                                </div>
                            ) : loading ? (
                                <div style={{ textAlign: 'center', padding: 40, color: colors.textSecondary }}><Loader2 size={18} className="rev-spin" /> Loading…</div>
                            ) : revisions.length === 0 ? (
                                <p style={{ color: colors.textSecondary, textAlign: 'center', padding: 40 }}>No revisions yet. Snapshots are saved when an article is submitted, published, or edited by staff.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {revisions.map(rev => (
                                        <button key={rev.id} onClick={() => view(rev.id)} style={{ textAlign: 'left', padding: 12, background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, cursor: 'pointer' }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{rev.note || 'Revision'}</div>
                                            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{rev.editorName} · {new Date(rev.createdAt).toLocaleString()}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <style>{`.rev-spin { animation: rev-spin 1s linear infinite; } @keyframes rev-spin { to { transform: rotate(360deg); } }
                        .article-content h2 { font-size: 22px; font-weight: 700; margin: 24px 0 12px; }
                        .article-content h3 { font-size: 18px; font-weight: 600; margin: 20px 0 10px; }
                        .article-content p { margin: 10px 0; } .article-content img { max-width: 100%; border-radius: 8px; }
                        .article-content a { color: ${colors.primary}; } .article-content ul, .article-content ol { padding-left: 24px; }
                    `}</style>
                </div>
            )}
        </>
    );
};

export default ArticleRevisions;
