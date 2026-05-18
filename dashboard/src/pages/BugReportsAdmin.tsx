import React, { useEffect, useState } from 'react';
import { Bug, CheckCircle, Clock, Eye, Search, XCircle, ExternalLink, Monitor, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';

interface BugReport {
    id: string;
    userId: string;
    username: string;
    pageUrl: string;
    description: string;
    errors: any[] | null;
    userAgent: string | null;
    viewport: string | null;
    screenshotUrl: string | null;
    status: 'open' | 'investigating' | 'resolved' | 'closed';
    resolvedByName: string | null;
    resolvedAt: string | null;
    resolutionNote: string | null;
    createdAt: string;
}

const STATUS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    open:          { label: 'Open',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: <Clock size={13} /> },
    investigating: { label: 'Investigating', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: <Eye size={13} /> },
    resolved:      { label: 'Resolved',      color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <CheckCircle size={13} /> },
    closed:        { label: 'Closed',        color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: <XCircle size={13} /> },
};

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const BugReportsAdmin: React.FC = () => {
    const [reports, setReports] = useState<BugReport[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('open');
    const [selected, setSelected] = useState<BugReport | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 25 };
            if (filterStatus) params.status = filterStatus;
            const res = await axios.get('/api/admin/bug-reports', { params, withCredentials: true });
            setReports(res.data.reports);
            setTotal(res.data.total);
            setPages(res.data.pages);
        } catch { setReports([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, filterStatus]);

    const updateStatus = async (id: string, status: string) => {
        setSaving(true);
        try {
            const res = await axios.patch(`/api/admin/bug-reports/${id}`, { status, resolutionNote: note.trim() || null }, { withCredentials: true });
            setReports(prev => prev.map(r => r.id === id ? res.data : r));
            if (selected?.id === id) setSelected(res.data);
            setNote('');
        } catch {}
        setSaving(false);
    };

    const inputStyle: React.CSSProperties = { padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: 13, outline: 'none', cursor: 'pointer' };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                <Bug size={32} color={colors.primary} style={{ marginRight: 16 }} />
                <div>
                    <h1 style={{ margin: 0 }}>Bug Reports</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>User-submitted bug reports from the in-app reporter</p>
                </div>
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>Reports are submitted by logged-in users via the bug button (bottom-left of every page). Each report includes the page URL, browser errors captured at that moment, device info, and an optional screenshot.</p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['open', 'investigating', 'resolved', 'closed', ''].map(s => {
                    const sc = STATUS[s] || { label: 'All', color: colors.textSecondary, bg: 'rgba(255,255,255,0.05)', icon: <Search size={13} /> };
                    return (
                        <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: borderRadius.sm, border: `1px solid ${filterStatus === s ? sc.color : 'rgba(255,255,255,0.1)'}`, background: filterStatus === s ? sc.bg : 'transparent', color: filterStatus === s ? sc.color : colors.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {sc.icon} {s ? sc.label : 'All'}
                        </button>
                    );
                })}
                <span style={{ marginLeft: 'auto', fontSize: 13, color: colors.textTertiary, alignSelf: 'center' }}>{total} report{total !== 1 ? 's' : ''}</span>
            </div>

            <div style={{ display: 'flex', gap: 20, flexDirection: selected ? 'row' : 'column' }}>
                {/* List */}
                <div style={{ flex: selected ? '0 0 420px' : '1 1 auto', minWidth: 0 }}>
                    {loading ? (
                        <p style={{ color: colors.textSecondary, textAlign: 'center', padding: 40 }}>Loading…</p>
                    ) : reports.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: colors.textTertiary }}>
                            <Bug size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <p>No reports found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {reports.map(r => {
                                const sc = STATUS[r.status] || STATUS.open;
                                return (
                                    <div key={r.id} onClick={() => setSelected(r)} style={{ padding: '12px 16px', backgroundColor: selected?.id === r.id ? 'rgba(255,255,255,0.06)' : colors.surface, borderRadius: borderRadius.md, border: `1px solid ${selected?.id === r.id ? colors.primary : colors.glassBorder}`, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.icon}{sc.label}</span>
                                            <span style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>{r.username}</span>
                                            <span style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 'auto' }}>{fmt(r.createdAt)}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                                        <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pageUrl}</div>
                                    </div>
                                );
                            })}
                            {/* Pagination */}
                            {pages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...inputStyle, cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
                                    <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: '30px' }}>{page} / {pages}</span>
                                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ ...inputStyle, cursor: page === pages ? 'default' : 'pointer', opacity: page === pages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                {selected && (
                    <div style={{ flex: '1 1 auto', minWidth: 0, backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}`, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Bug size={16} color={colors.primary} /> Bug Report</h3>
                            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {(() => { const sc = STATUS[selected.status]; return <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.icon}{sc.label}</span>; })()}
                            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: colors.textSecondary }}>{selected.username}</span>
                            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, color: colors.textTertiary, background: 'rgba(255,255,255,0.04)' }}>{fmt(selected.createdAt)}</span>
                        </div>

                        {[
                            { label: 'Page', value: <a href={selected.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, wordBreak: 'break-all' }}>{selected.pageUrl} <ExternalLink size={11} /></a> },
                            { label: 'Viewport', value: <span style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' }}>{selected.viewport || '—'}</span> },
                            { label: 'Browser', value: <span style={{ fontSize: 11, color: colors.textTertiary, wordBreak: 'break-all' }}>{selected.userAgent || '—'}</span> },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                                <div style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: borderRadius.sm }}>{value}</div>
                            </div>
                        ))}

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Description</div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: borderRadius.sm, fontSize: 13, color: colors.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.description}</div>
                        </div>

                        {selected.errors && (selected.errors as any[]).length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Console Errors ({(selected.errors as any[]).length})</div>
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: borderRadius.sm, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {(selected.errors as any[]).map((e: any, i: number) => (
                                        <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#fca5a5', wordBreak: 'break-all' }}>● {e.message}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selected.screenshotUrl && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Screenshot</div>
                                <a href={selected.screenshotUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={selected.screenshotUrl} alt="Screenshot" style={{ width: '100%', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
                                </a>
                            </div>
                        )}

                        {/* Actions */}
                        {(selected.status === 'open' || selected.status === 'investigating') && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 6 }}>Resolution Note (optional)</div>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note about the fix or investigation…" maxLength={2000}
                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: 13, minHeight: 60, resize: 'vertical', outline: 'none', marginBottom: 10 }} />
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {selected.status === 'open' && (
                                        <button onClick={() => updateStatus(selected.id, 'investigating')} disabled={saving} style={{ padding: '7px 14px', borderRadius: borderRadius.sm, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: 12, opacity: saving ? 0.5 : 1 }}>
                                            <Eye size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Investigating
                                        </button>
                                    )}
                                    <button onClick={() => updateStatus(selected.id, 'resolved')} disabled={saving} style={{ padding: '7px 14px', borderRadius: borderRadius.sm, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', fontWeight: 600, fontSize: 12, opacity: saving ? 0.5 : 1 }}>
                                        <CheckCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Resolve
                                    </button>
                                    <button onClick={() => updateStatus(selected.id, 'closed')} disabled={saving} style={{ padding: '7px 14px', borderRadius: borderRadius.sm, border: '1px solid rgba(107,114,128,0.4)', background: 'rgba(107,114,128,0.1)', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: 12, opacity: saving ? 0.5 : 1 }}>
                                        <XCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Close
                                    </button>
                                </div>
                            </div>
                        )}
                        {selected.resolvedAt && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: borderRadius.sm, fontSize: 12, color: colors.textSecondary }}>
                                {selected.status === 'resolved' ? 'Resolved' : 'Closed'} by <strong>{selected.resolvedByName}</strong> on {fmt(selected.resolvedAt)}
                                {selected.resolutionNote && <><br />{selected.resolutionNote}</>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
