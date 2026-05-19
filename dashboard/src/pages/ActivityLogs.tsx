import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Activity, Search, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ActivityLog {
    id: string;
    userId: string | null;
    ip: string | null;
    userAgent: string | null;
    action: string;
    targetId: string | null;
    targetType: string | null;
    metadata: Record<string, any> | null;
    createdAt: string;
}

interface LogsResponse {
    logs: ActivityLog[];
    total: number;
    page: number;
    pages: number;
}

const ACTION_COLORS: Record<string, string> = {
    'auth.login':         '#10b981',
    'track.upload':       '#3b82f6',
    'track.edit':         '#6366f1',
    'track.delete':       '#ef4444',
    'track.favourite':    '#f59e0b',
    'track.unfavourite':  '#6b7280',
    'track.repost':       '#8b5cf6',
    'track.unrepost':     '#6b7280',
    'track.download':     '#06b6d4',
    'comment.post':       '#ec4899',
    'comment.delete':     '#ef4444',
    'battle.enter':       '#f97316',
    'battle.vote':        '#84cc16',
    'battle.vote_clear':  '#6b7280',
};

const actionColor = (action: string) => ACTION_COLORS[action] ?? '#9ca3af';

const LIMIT = 50;

export const ActivityLogsPage: React.FC = () => {
    const [data, setData] = useState<LogsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ userId: '', ip: '', action: '', dateFrom: '', dateTo: '' });
    const [applied, setApplied] = useState(filters);
    const [selected, setSelected] = useState<ActivityLog | null>(null);

    const load = useCallback(async (p: number, f: typeof filters) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
            if (f.userId)   params.set('userId',   f.userId.trim());
            if (f.ip)       params.set('ip',       f.ip.trim());
            if (f.action)   params.set('action',   f.action.trim());
            if (f.dateFrom) params.set('dateFrom', f.dateFrom);
            if (f.dateTo)   params.set('dateTo',   f.dateTo);
            const res = await fetch(`/api/admin/activity-logs?${params}`, { credentials: 'include' });
            if (res.ok) setData(await res.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, applied); }, [page, applied, load]);

    const apply = () => { setPage(1); setApplied({ ...filters }); };
    const clear  = () => { const e = { userId: '', ip: '', action: '', dateFrom: '', dateTo: '' }; setFilters(e); setApplied(e); setPage(1); };

    const inputStyle: React.CSSProperties = {
        background: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.md, padding: '8px 10px',
        color: colors.textPrimary, fontSize: '13px', outline: 'none',
    };

    const timeAgo = (iso: string) => {
        const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (s < 60)   return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s/60)}m ago`;
        if (s < 86400) return `${Math.floor(s/3600)}h ago`;
        return new Date(iso).toLocaleDateString();
    };

    return (
        <div style={{ padding: `${spacing['3xl']} ${spacing.lg}`, maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Activity size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Activity Logs</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>User actions logged for security and audit purposes</p>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => load(page, applied)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: '8px 14px', color: colors.textPrimary, cursor: 'pointer', fontSize: '13px' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <input style={inputStyle} placeholder="User ID" value={filters.userId} onChange={e => setFilters(f => ({ ...f, userId: e.target.value }))} />
                    <input style={inputStyle} placeholder="IP address" value={filters.ip} onChange={e => setFilters(f => ({ ...f, ip: e.target.value }))} />
                    <input style={inputStyle} placeholder="Action (e.g. track.upload)" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))} />
                    <input type="date" style={inputStyle} value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} title="From date" />
                    <input type="date" style={inputStyle} value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} title="To date" />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={apply} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: colors.primary, border: 'none', borderRadius: borderRadius.md, padding: '8px 16px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                        <Search size={14} /> Search
                    </button>
                    <button onClick={clear} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: '8px 14px', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px' }}>
                        <X size={14} /> Clear
                    </button>
                    {data && <span style={{ marginLeft: '8px', color: colors.textTertiary, fontSize: '13px', alignSelf: 'center' }}>{data.total.toLocaleString()} results</span>}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: '16px', alignItems: 'start' }}>
                {/* Log table */}
                <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>Loading…</div>
                    ) : !data || data.logs.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>No logs found.</div>
                    ) : (
                        <>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                                        {['Time', 'Action', 'User ID', 'IP', 'Target'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.logs.map(log => (
                                        <tr key={log.id} onClick={() => setSelected(s => s?.id === log.id ? null : log)}
                                            style={{ borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', background: selected?.id === log.id ? `${colors.primary}10` : 'transparent' }}
                                            onMouseEnter={e => { if (selected?.id !== log.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                                            onMouseLeave={e => { if (selected?.id !== log.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: colors.textTertiary, whiteSpace: 'nowrap' }}>{timeAgo(log.createdAt)}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: `${actionColor(log.action)}18`, color: actionColor(log.action), border: `1px solid ${actionColor(log.action)}33` }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: colors.textSecondary, fontFamily: 'monospace', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userId ?? '—'}</td>
                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: colors.textSecondary, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{log.ip ?? '—'}</td>
                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: colors.textTertiary, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.targetType ? `${log.targetType}:${log.targetId?.slice(0, 8)}…` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            {data.pages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '14px', borderTop: `1px solid ${colors.border}` }}>
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ background: 'none', border: 'none', color: page <= 1 ? colors.textTertiary : colors.textPrimary, cursor: page <= 1 ? 'default' : 'pointer' }}>
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>Page {page} of {data.pages}</span>
                                    <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages} style={{ background: 'none', border: 'none', color: page >= data.pages ? colors.textTertiary : colors.textPrimary, cursor: page >= data.pages ? 'default' : 'pointer' }}>
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Detail panel */}
                {selected && (
                    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: '18px', position: 'sticky', top: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, background: `${actionColor(selected.action)}18`, color: actionColor(selected.action), border: `1px solid ${actionColor(selected.action)}33` }}>
                                {selected.action}
                            </span>
                            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        {[
                            { label: 'Log ID',      value: selected.id },
                            { label: 'Timestamp',   value: new Date(selected.createdAt).toLocaleString() },
                            { label: 'User ID',     value: selected.userId ?? '—' },
                            { label: 'IP Address',  value: selected.ip ?? '—' },
                            { label: 'Target Type', value: selected.targetType ?? '—' },
                            { label: 'Target ID',   value: selected.targetId ?? '—' },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</span>
                                <span style={{ fontSize: '13px', color: colors.textPrimary, fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</span>
                            </div>
                        ))}

                        {selected.userAgent && (
                            <div style={{ marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '2px' }}>User Agent</span>
                                <span style={{ fontSize: '11px', color: colors.textSecondary, wordBreak: 'break-all' }}>{selected.userAgent}</span>
                            </div>
                        )}

                        {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                            <div>
                                <span style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Metadata</span>
                                <pre style={{ margin: 0, fontSize: '11px', color: colors.textSecondary, background: colors.background, padding: '10px', borderRadius: borderRadius.sm, overflow: 'auto', maxHeight: '200px' }}>
                                    {JSON.stringify(selected.metadata, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* Quick filter links */}
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {selected.userId && (
                                <button onClick={() => { setFilters(f => ({ ...f, userId: selected.userId! })); setApplied(f => ({ ...f, userId: selected.userId! })); setPage(1); setSelected(null); }}
                                    style={{ background: `${colors.primary}10`, border: `1px solid ${colors.primary}30`, borderRadius: borderRadius.sm, padding: '6px 10px', color: colors.primary, fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                                    Filter by this user
                                </button>
                            )}
                            {selected.ip && (
                                <button onClick={() => { setFilters(f => ({ ...f, ip: selected.ip! })); setApplied(f => ({ ...f, ip: selected.ip! })); setPage(1); setSelected(null); }}
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: borderRadius.sm, padding: '6px 10px', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                                    Filter by this IP
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
