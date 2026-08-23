/**
 * Article Analytics — per-article views, time-on-page, and shares.
 *
 * Derived from the site-wide session_events log (the same pipeline that already
 * records a page_view for every route change) rather than a parallel tracking
 * system — see GET /api/admin/analytics/articles in src/api/index.ts.
 */
import React, { useEffect, useState } from 'react';
import { BarChart2, Eye, Users, Clock, Share2, ArrowLeft } from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/theme';

interface ArticleStat {
    id: string; slug: string; title: string; authorName: string;
    status: string; publishedAt: string | null; viewCount: number;
    views: number; uniqueViewers: number; avgDurationSecs: number | null; shares: number;
}

interface ArticleDetail {
    article: { id: string; slug: string; title: string; authorName: string; status: string; publishedAt: string | null; viewCount: number };
    views: number; uniqueViewers: number; avgDurationSecs: number | null;
    shares: number; sharesByMethod: Record<string, number>;
    viewsByDay: { date: string; count: number }[];
}

function fmtDuration(secs: number | null): string {
    if (secs == null) return '—';
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function shortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

const METHOD_LABELS: Record<string, string> = {
    native: 'Share sheet', copy_link: 'Copied link', unknown: 'Unknown',
};

const StatCard: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div style={{
        background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xl,
        boxShadow: shadows.sm, border: `1px solid ${colors.border}`, flex: '1 1 140px', minWidth: 0,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            {icon && <span style={{ color: colors.primary }}>{icon}</span>}
            <span style={{ color: colors.textSecondary, fontSize: typography.small.fontSize }}>{label}</span>
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: colors.textPrimary, lineHeight: 1 }}>{value}</div>
    </div>
);

export const ArticleAnalyticsPage: React.FC = () => {
    const [articles, setArticles] = useState<ArticleStat[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'views' | 'uniqueViewers' | 'avgDurationSecs' | 'shares'>('views');

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<ArticleDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        fetch('/api/admin/analytics/articles')
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(setArticles)
            .catch(e => setError(String(e)))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedId) { setDetail(null); return; }
        setDetailLoading(true);
        fetch(`/api/admin/analytics/articles/${selectedId}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(setDetail)
            .catch(() => setDetail(null))
            .finally(() => setDetailLoading(false));
    }, [selectedId]);

    const containerStyle: React.CSSProperties = { padding: spacing.xxl, maxWidth: '1200px', margin: '0 auto' };

    if (loading) return <div style={{ ...containerStyle, color: colors.textSecondary }}>Loading...</div>;
    if (error || !articles) return <div style={{ ...containerStyle, color: colors.error }}>Failed to load analytics: {error}</div>;

    const sorted = [...articles].sort((a, b) => {
        const av = a[sortBy] ?? -1, bv = b[sortBy] ?? -1;
        return bv - av;
    });

    const totals = articles.reduce((acc, a) => ({
        views: acc.views + a.views, shares: acc.shares + a.shares,
        uniqueViewers: acc.uniqueViewers + a.uniqueViewers,
    }), { views: 0, shares: 0, uniqueViewers: 0 });

    // ── Detail view ──
    if (selectedId) {
        return (
            <div style={containerStyle}>
                <button onClick={() => setSelectedId(null)} style={{
                    display: 'flex', alignItems: 'center', gap: spacing.xs, background: 'none', border: 'none',
                    color: colors.textSecondary, cursor: 'pointer', marginBottom: spacing.lg, fontSize: '13px',
                }}>
                    <ArrowLeft size={14} /> Back to all articles
                </button>

                {detailLoading || !detail ? (
                    <div style={{ color: colors.textSecondary }}>Loading...</div>
                ) : (
                    <>
                        <h1 style={{ margin: 0, ...typography.h1, color: colors.textPrimary }}>{detail.article.title}</h1>
                        <p style={{ margin: '4px 0 24px', color: colors.textSecondary }}>
                            by {detail.article.authorName} · /article/{detail.article.slug}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xxl }}>
                            <StatCard label="Views" value={detail.views.toLocaleString()} icon={<Eye size={16} />} />
                            <StatCard label="Unique Viewers" value={detail.uniqueViewers.toLocaleString()} icon={<Users size={16} />} />
                            <StatCard label="Avg. Time on Page" value={fmtDuration(detail.avgDurationSecs)} icon={<Clock size={16} />} />
                            <StatCard label="Shares" value={detail.shares.toLocaleString()} icon={<Share2 size={16} />} />
                        </div>

                        {detail.shares > 0 && (
                            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.xxl, flexWrap: 'wrap' }}>
                                {Object.entries(detail.sharesByMethod).map(([method, count]) => (
                                    <div key={method} style={{
                                        background: colors.surface, border: `1px solid ${colors.border}`,
                                        borderRadius: borderRadius.md, padding: `${spacing.xs} ${spacing.md}`,
                                        fontSize: '13px', color: colors.textSecondary,
                                    }}>
                                        {METHOD_LABELS[method] || method}: <strong style={{ color: colors.textPrimary }}>{count}</strong>
                                    </div>
                                ))}
                            </div>
                        )}

                        <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm }}>Views — Last 30 Days</h2>
                        <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}` }}>
                            {detail.viewsByDay.length === 0 ? (
                                <p style={{ margin: 0, color: colors.textTertiary, textAlign: 'center', padding: spacing.xl }}>
                                    No views recorded in the last 30 days.
                                </p>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={detail.viewsByDay.map(d => ({ ...d, date: shortDate(d.date) }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                                        <XAxis dataKey="date" stroke={colors.textTertiary} fontSize={12} />
                                        <YAxis stroke={colors.textTertiary} fontSize={12} allowDecimals={false} />
                                        <Tooltip contentStyle={{ background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm }} />
                                        <Line type="monotone" dataKey="count" name="Views" stroke={colors.primary} strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ── List view ──
    return (
        <div style={containerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xxl }}>
                <BarChart2 size={32} color={colors.primary} style={{ marginRight: spacing.lg }} />
                <div>
                    <h1 style={{ margin: 0, ...typography.h1, color: colors.textPrimary }}>Article Analytics</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Views, time on page, and shares per article</p>
                </div>
            </div>

            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.xxl, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Views and time-on-page are recorded automatically whenever someone opens an article — no setup
                    needed per article. Shares are counted when a reader uses the Share button on the article page,
                    whether that opens their device's share sheet or copies the link. Click a row for a 30-day
                    trend and a shares breakdown.
                </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xxl }}>
                <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={<Eye size={16} />} />
                <StatCard label="Total Unique Viewers" value={totals.uniqueViewers.toLocaleString()} icon={<Users size={16} />} />
                <StatCard label="Total Shares" value={totals.shares.toLocaleString()} icon={<Share2 size={16} />} />
            </div>

            {articles.length === 0 ? (
                <p style={{ color: colors.textTertiary }}>No published articles yet.</p>
            ) : (
                <div style={{ background: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 110px 130px 90px',
                        gap: spacing.sm, padding: `${spacing.sm} ${spacing.lg}`,
                        borderBottom: `1px solid ${colors.border}`, fontSize: '12px', color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                        <span>Article</span>
                        {([['views', 'Views'], ['uniqueViewers', 'Viewers'], ['avgDurationSecs', 'Avg. Time'], ['shares', 'Shares']] as const).map(([key, label]) => (
                            <button key={key} onClick={() => setSortBy(key)} style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                color: sortBy === key ? colors.primary : colors.textTertiary,
                                fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                fontWeight: sortBy === key ? 700 : 400, textAlign: 'right',
                            }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {sorted.map(a => (
                        <div key={a.id}
                            onClick={() => setSelectedId(a.id)}
                            style={{
                                display: 'grid', gridTemplateColumns: '1fr 90px 110px 130px 90px',
                                gap: spacing.sm, padding: `${spacing.md} ${spacing.lg}`,
                                borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', alignItems: 'center',
                            }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: colors.textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {a.title}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.textTertiary }}>
                                    {a.authorName} {a.status !== 'published' && <span style={{ color: colors.warning }}> · {a.status}</span>}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', color: colors.textPrimary }}>{a.views.toLocaleString()}</div>
                            <div style={{ textAlign: 'right', color: colors.textSecondary }}>{a.uniqueViewers.toLocaleString()}</div>
                            <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmtDuration(a.avgDurationSecs)}</div>
                            <div style={{ textAlign: 'right', color: colors.textSecondary }}>{a.shares.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
