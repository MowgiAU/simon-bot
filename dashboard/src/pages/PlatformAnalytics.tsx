import React, { useEffect, useState } from 'react';
import { BarChart2, Download, Users, Monitor, Smartphone, Tablet, TrendingUp, Activity } from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    LineChart,
    Line,
    CartesianGrid,
    Legend,
} from 'recharts';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsOverview {
    apkDownloads: {
        total: number;
        last7Days: number;
        last30Days: number;
        byDay: { date: string; count: number }[];
        uniqueIps: number;
        loggedInCount: number;
    };
    sessions: {
        total: number;
        last7Days: number;
        byPlatform: Record<string, number>;
        avgDurationByPlatform: Record<string, number>;
        byDay: { date: string; desktop?: number; mobile_browser?: number; android_app?: number }[];
    };
    events: {
        topPages: { path: string; count: number }[];
        byType: Record<string, number>;
        last7Days: number;
    };
    users: {
        dau: number;
        wau: number;
        mau: number;
        dauByPlatform: Record<string, number>;
        wauByPlatform: Record<string, number>;
        mauByPlatform: Record<string, number>;
    };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function shortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{
    label: string;
    value: string | number;
    sub?: string;
    icon?: React.ReactNode;
}> = ({ label, value, sub, icon }) => (
    <div style={{
        background: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.xxl,
        boxShadow: shadows.sm,
        border: `1px solid ${colors.border}`,
        flex: '1 1 160px',
        minWidth: 0,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            {icon && <span style={{ color: colors.primary }}>{icon}</span>}
            <span style={{ color: colors.textSecondary, fontSize: typography.small.fontSize }}>{label}</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: colors.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ color: colors.textTertiary, fontSize: typography.small.fontSize, marginTop: spacing.xs }}>{sub}</div>}
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export const PlatformAnalytics: React.FC = () => {
    const [data, setData] = useState<AnalyticsOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/admin/analytics/overview')
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(setData)
            .catch(e => setError(String(e)))
            .finally(() => setLoading(false));
    }, []);

    const containerStyle: React.CSSProperties = {
        padding: spacing.xxl,
        maxWidth: '1200px',
        margin: '0 auto',
    };

    if (loading) {
        return (
            <div style={{ ...containerStyle, color: colors.textSecondary }}>
                Loading...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ ...containerStyle, color: colors.error }}>
                Failed to load analytics: {error}
            </div>
        );
    }

    const totalSessions = data.sessions.total || 1; // avoid div-by-zero
    const totalEvents = Object.values(data.events.byType).reduce((a, b) => a + b, 0) || 1;
    const totalPageViews = data.events.topPages.reduce((a, b) => a + b.count, 0) || 1;

    const platformCards = [
        { key: 'desktop', label: 'Desktop', Icon: Monitor },
        { key: 'mobile_browser', label: 'Mobile Browser', Icon: Smartphone },
        { key: 'android_app', label: 'Android App', Icon: Tablet },
    ];

    return (
        <div style={containerStyle}>
            {/* ── Page Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xxl }}>
                <BarChart2 size={32} color={colors.primary} style={{ marginRight: spacing.lg }} />
                <div>
                    <h1 style={{ margin: 0, ...typography.h1, color: colors.textPrimary }}>Platform Analytics</h1>
                    <p style={{ margin: `4px 0 0`, color: colors.textSecondary }}>Session data, download stats, and user behaviour</p>
                </div>
            </div>

            {/* ── Explanation Block ── */}
            <div style={{
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.xxl,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Analytics are collected from the Fuji Studio web and Android platforms. Sessions are tracked by platform and linked to accounts where users are signed in. IP addresses are stored as one-way SHA-256 hashes only.
                </p>
            </div>

            {/* ── Top Stats Row ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xxl }}>
                <StatCard label="Total Sessions" value={data.sessions.total.toLocaleString()} sub={`${data.sessions.last7Days} last 7 days`} icon={<Activity size={18} />} />
                <StatCard label="APK Downloads" value={data.apkDownloads.total.toLocaleString()} sub={`${data.apkDownloads.last7Days} last 7 days`} icon={<Download size={18} />} />
                <StatCard label="Daily Active Users" value={data.users.dau.toLocaleString()} sub="Last 24 hours" icon={<Users size={18} />} />
                <StatCard label="Monthly Active Users" value={data.users.mau.toLocaleString()} sub={`${data.users.wau} WAU`} icon={<TrendingUp size={18} />} />
            </div>

            {/* ── Platform Breakdown ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg }}>Platform Breakdown</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xxl }}>
                {platformCards.map(({ key, label, Icon }) => {
                    const count = data.sessions.byPlatform[key] ?? 0;
                    const pct = Math.round((count / totalSessions) * 100);
                    const avg = data.sessions.avgDurationByPlatform[key] ?? 0;
                    return (
                        <div key={key} style={{
                            background: colors.surface,
                            borderRadius: borderRadius.lg,
                            padding: spacing.xxl,
                            border: `1px solid ${colors.border}`,
                            flex: '1 1 200px',
                            minWidth: 0,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                                <Icon size={20} color={colors.primary} />
                                <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{label}</span>
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: colors.textPrimary }}>{count.toLocaleString()}</div>
                            <div style={{ color: colors.textSecondary, fontSize: typography.small.fontSize, marginTop: spacing.xs }}>
                                {pct}% of sessions
                            </div>
                            <div style={{ color: colors.textTertiary, fontSize: typography.small.fontSize }}>
                                Avg {fmtDuration(avg)} per session
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── APK Downloads chart ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm }}>APK Downloads — Last 30 Days</h2>
            <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}`, marginBottom: spacing.lg }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.lg }}>
                    <div>
                        <span style={{ color: colors.textSecondary, fontSize: typography.small.fontSize }}>Unique IPs (30d)</span>
                        <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '18px' }}>{data.apkDownloads.uniqueIps}</div>
                    </div>
                    <div>
                        <span style={{ color: colors.textSecondary, fontSize: typography.small.fontSize }}>Logged-in downloads</span>
                        <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '18px' }}>{data.apkDownloads.loggedInCount}</div>
                    </div>
                    <div>
                        <span style={{ color: colors.textSecondary, fontSize: typography.small.fontSize }}>Last 30 days</span>
                        <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '18px' }}>{data.apkDownloads.last30Days}</div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.apkDownloads.byDay.map(d => ({ ...d, date: shortDate(d.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                        <XAxis dataKey="date" tick={{ fill: colors.textTertiary, fontSize: 11 }} />
                        <YAxis tick={{ fill: colors.textTertiary, fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary }} />
                        <Bar dataKey="count" name="Downloads" fill={colors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── APK Recent Downloads table ── */}
            <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}`, marginBottom: spacing.xxl, overflowX: 'auto' }}>
                <h3 style={{ ...typography.h3, color: colors.textPrimary, margin: `0 0 ${spacing.lg}` }}>Downloads by Day</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.small.fontSize }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ textAlign: 'left', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>Date</th>
                            <th style={{ textAlign: 'right', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>Downloads</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...data.apkDownloads.byDay].reverse().map(row => (
                            <tr key={row.date} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary }}>{row.date}</td>
                                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, textAlign: 'right' }}>{row.count}</td>
                            </tr>
                        ))}
                        {data.apkDownloads.byDay.length === 0 && (
                            <tr><td colSpan={2} style={{ padding: spacing.md, color: colors.textTertiary, textAlign: 'center' }}>No downloads recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Sessions over time ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm }}>Sessions Over Time — Last 30 Days</h2>
            <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}`, marginBottom: spacing.xxl }}>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.sessions.byDay.map(d => ({ ...d, date: shortDate(d.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                        <XAxis dataKey="date" tick={{ fill: colors.textTertiary, fontSize: 11 }} />
                        <YAxis tick={{ fill: colors.textTertiary, fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary }} />
                        <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                        <Bar dataKey="desktop" name="Desktop" stackId="a" fill={colors.primary} />
                        <Bar dataKey="mobile_browser" name="Mobile Browser" stackId="a" fill={colors.accent} />
                        <Bar dataKey="android_app" name="Android App" stackId="a" fill={colors.highlight} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Top Pages table ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm }}>Top Pages</h2>
            <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}`, marginBottom: spacing.xxl, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.small.fontSize }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ textAlign: 'left', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>Path</th>
                            <th style={{ textAlign: 'right', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>Views</th>
                            <th style={{ textAlign: 'right', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>% of Page Views</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.events.topPages.map(row => (
                            <tr key={row.path} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontFamily: 'monospace' }}>{row.path}</td>
                                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, textAlign: 'right' }}>{row.count.toLocaleString()}</td>
                                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, textAlign: 'right' }}>{Math.round((row.count / totalPageViews) * 100)}%</td>
                            </tr>
                        ))}
                        {data.events.topPages.length === 0 && (
                            <tr><td colSpan={3} style={{ padding: spacing.md, color: colors.textTertiary, textAlign: 'center' }}>No page views recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Event Breakdown table ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm }}>Event Breakdown</h2>
            <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}`, marginBottom: spacing.xxl, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.small.fontSize }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ textAlign: 'left', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>Event Type</th>
                            <th style={{ textAlign: 'right', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>Count</th>
                            <th style={{ textAlign: 'right', padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(data.events.byType)
                            .sort((a, b) => b[1] - a[1])
                            .map(([type, count]) => (
                                <tr key={type} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                    <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontFamily: 'monospace' }}>{type}</td>
                                    <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, textAlign: 'right' }}>{count.toLocaleString()}</td>
                                    <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, textAlign: 'right' }}>{Math.round((count / totalEvents) * 100)}%</td>
                                </tr>
                            ))}
                        {Object.keys(data.events.byType).length === 0 && (
                            <tr><td colSpan={3} style={{ padding: spacing.md, color: colors.textTertiary, textAlign: 'center' }}>No events recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Active Users ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg }}>Active Users</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xxl }}>
                <StatCard label="DAU" value={data.users.dau.toLocaleString()} sub="Distinct users — last 24h" icon={<Users size={18} />} />
                <StatCard label="WAU" value={data.users.wau.toLocaleString()} sub="Distinct users — last 7 days" icon={<Users size={18} />} />
                <StatCard label="MAU" value={data.users.mau.toLocaleString()} sub="Distinct users — last 30 days" icon={<Users size={18} />} />
            </div>

            {/* ── Active Users by Platform ── */}
            <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm }}>Unique Users by Platform</h2>
            <p style={{ margin: `0 0 ${spacing.lg}`, color: colors.textTertiary, fontSize: typography.small.fontSize }}>
                A user active on multiple platforms is counted once per platform.
            </p>
            <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, border: `1px solid ${colors.border}`, marginBottom: spacing.xxl, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ textAlign: 'left', padding: spacing.sm, color: colors.textSecondary, fontSize: typography.small.fontSize, fontWeight: 600 }}>Platform</th>
                            <th style={{ textAlign: 'right', padding: spacing.sm, color: colors.textSecondary, fontSize: typography.small.fontSize, fontWeight: 600 }}>DAU</th>
                            <th style={{ textAlign: 'right', padding: spacing.sm, color: colors.textSecondary, fontSize: typography.small.fontSize, fontWeight: 600 }}>WAU</th>
                            <th style={{ textAlign: 'right', padding: spacing.sm, color: colors.textSecondary, fontSize: typography.small.fontSize, fontWeight: 600 }}>MAU</th>
                        </tr>
                    </thead>
                    <tbody>
                        {platformCards.map(({ key, label, Icon }) => (
                            <tr key={key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                <td style={{ padding: spacing.sm, color: colors.textPrimary }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                        <Icon size={16} color={colors.primary} />
                                        {label}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right', padding: spacing.sm, color: colors.textPrimary, fontWeight: 600 }}>{(data.users.dauByPlatform[key] ?? 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', padding: spacing.sm, color: colors.textPrimary, fontWeight: 600 }}>{(data.users.wauByPlatform[key] ?? 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', padding: spacing.sm, color: colors.textPrimary, fontWeight: 600 }}>{(data.users.mauByPlatform[key] ?? 0).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
