import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { Mic, Settings, AlertTriangle, Play, Clock, Users, Shield, Hash, Volume2, Trash2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

const API = import.meta.env.VITE_API_URL || '';

interface VoiceMonitorSettings {
    guildId: string;
    enabled: boolean;
    retentionDays: number;
    monitoredChannelIds: string[];
    excludedRoleIds: string[];
    noticeChannelId: string | null;
    noticeSent: boolean;
}

interface VoiceSegmentSummary {
    id: string;
    userId: string;
    userName: string | null;
    durationMs: number;
    fileSize: number;
    startedAt: string;
    endedAt: string | null;
}

interface VoiceSession {
    id: string;
    guildId: string;
    channelId: string;
    channelName: string | null;
    startedAt: string;
    endedAt: string | null;
    segments: VoiceSegmentSummary[];
    _count: { segments: number; reports: number };
}

interface VoiceSegmentDetail {
    id: string;
    userId: string;
    userName: string | null;
    r2Key: string;
    r2Url: string;
    durationMs: number;
    fileSize: number;
    startedAt: string;
    endedAt: string | null;
}

interface VoiceSessionDetail {
    id: string;
    channelName: string | null;
    startedAt: string;
    endedAt: string | null;
    segments: VoiceSegmentDetail[];
    reports: VoiceReport[];
}

interface VoiceReport {
    id: string;
    sessionId: string | null;
    reporterId: string;
    reporterName: string | null;
    targetId: string | null;
    targetName: string | null;
    reason: string;
    status: string;
    notes: string | null;
    reviewedBy: string | null;
    createdAt: string;
    resolvedAt: string | null;
    session?: { id: string; channelName: string | null; startedAt: string; endedAt: string | null };
}

type Tab = 'sessions' | 'reports' | 'settings';

export function VoiceMonitorPage() {
    const { selectedGuild } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('sessions');
    const [settings, setSettings] = useState<VoiceMonitorSettings | null>(null);
    const [sessions, setSessions] = useState<VoiceSession[]>([]);
    const [sessionsTotal, setSessionsTotal] = useState(0);
    const [sessionsPage, setSessionsPage] = useState(1);
    const [reports, setReports] = useState<VoiceReport[]>([]);
    const [selectedSession, setSelectedSession] = useState<VoiceSessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reportFilter, setReportFilter] = useState<string>('');

    const guildId = selectedGuild?.id;

    const fetchSettings = useCallback(async () => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/settings/${guildId}`, { credentials: 'include' });
            if (res.ok) setSettings(await res.json());
        } catch { /* ignore */ }
    }, [guildId]);

    const fetchSessions = useCallback(async (page = 1) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/sessions/${guildId}?page=${page}&limit=20`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions);
                setSessionsTotal(data.total);
                setSessionsPage(data.page);
            }
        } catch { /* ignore */ }
    }, [guildId]);

    const fetchReports = useCallback(async () => {
        if (!guildId) return;
        const q = reportFilter ? `?status=${reportFilter}` : '';
        try {
            const res = await fetch(`${API}/api/voice-monitor/reports/${guildId}${q}`, { credentials: 'include' });
            if (res.ok) setReports(await res.json());
        } catch { /* ignore */ }
    }, [guildId, reportFilter]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchSettings(), fetchSessions(), fetchReports()]).finally(() => setLoading(false));
    }, [fetchSettings, fetchSessions, fetchReports]);

    const saveSettings = async (updates: Partial<VoiceMonitorSettings>) => {
        if (!guildId) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/voice-monitor/settings/${guildId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });
            if (res.ok) setSettings(await res.json());
        } catch { /* ignore */ }
        setSaving(false);
    };

    const updateReport = async (reportId: string, updates: { status?: string; notes?: string }) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/reports/${guildId}/${reportId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });
            if (res.ok) fetchReports();
        } catch { /* ignore */ }
    };

    const viewSession = async (sessionId: string) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/sessions/${guildId}/${sessionId}`, { credentials: 'include' });
            if (res.ok) setSelectedSession(await res.json());
        } catch { /* ignore */ }
    };

    const deleteSegment = async (segmentId: string) => {
        if (!guildId || !selectedSession) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/segments/${guildId}/${segmentId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                setSelectedSession(prev => prev ? {
                    ...prev,
                    segments: prev.segments.filter(s => s.id !== segmentId),
                } : null);
            }
        } catch { /* ignore */ }
    };

    const formatDuration = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    };

    const formatDate = (d: string) => new Date(d).toLocaleString();

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: colors.textTertiary }}>
                Loading...
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1100px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Mic size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Voice Monitor</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Record and review voice channel audio for moderation</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Voice Monitor records per-user audio in voice channels for moderation purposes. Recordings are stored securely and automatically deleted after the retention period. A one-time notice is posted to your chosen information channel when enabled.
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg }}>
                {(['sessions', 'reports', 'settings'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setSelectedSession(null); }}
                        style={{
                            padding: `${spacing.sm} ${spacing.lg}`,
                            borderRadius: borderRadius.md,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: activeTab === tab ? colors.primary : colors.surfaceLight,
                            color: activeTab === tab ? '#fff' : colors.textSecondary,
                            fontWeight: activeTab === tab ? 600 : 400,
                            fontSize: '14px',
                            textTransform: 'capitalize',
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Sessions Tab */}
            {activeTab === 'sessions' && !selectedSession && (
                <div>
                    {sessions.length === 0 ? (
                        <div style={{ color: colors.textTertiary, textAlign: 'center', padding: '60px 0' }}>
                            <Volume2 size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                            <p>No voice sessions recorded yet.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => viewSession(session.id)}
                                        style={{
                                            backgroundColor: colors.surface,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: borderRadius.md,
                                            padding: spacing.md,
                                            cursor: 'pointer',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.primary)}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                                <Hash size={16} color={colors.textTertiary} />
                                                <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{session.channelName || 'Unknown Channel'}</span>
                                                {!session.endedAt && (
                                                    <span style={{ backgroundColor: colors.success, color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: borderRadius.pill, fontWeight: 600 }}>LIVE</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, color: colors.textSecondary, fontSize: '13px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Users size={14} /> {session._count.segments} segments
                                                </span>
                                                {session._count.reports > 0 && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.warning }}>
                                                        <AlertTriangle size={14} /> {session._count.reports} reports
                                                    </span>
                                                )}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={14} /> {formatDate(session.startedAt)}
                                                </span>
                                            </div>
                                        </div>
                                        {session.segments.length > 0 && (
                                            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                                                {[...new Set(session.segments.map(s => s.userName || s.userId))].map(name => (
                                                    <span key={name} style={{ backgroundColor: colors.surfaceLight, color: colors.textSecondary, fontSize: '12px', padding: '2px 8px', borderRadius: borderRadius.pill }}>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {/* Pagination */}
                            {sessionsTotal > 20 && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
                                    <button
                                        disabled={sessionsPage <= 1}
                                        onClick={() => fetchSessions(sessionsPage - 1)}
                                        style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.surfaceLight, color: colors.textPrimary, cursor: sessionsPage <= 1 ? 'default' : 'pointer', opacity: sessionsPage <= 1 ? 0.5 : 1 }}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ color: colors.textSecondary, padding: spacing.sm }}>
                                        Page {sessionsPage} of {Math.ceil(sessionsTotal / 20)}
                                    </span>
                                    <button
                                        disabled={sessionsPage >= Math.ceil(sessionsTotal / 20)}
                                        onClick={() => fetchSessions(sessionsPage + 1)}
                                        style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.surfaceLight, color: colors.textPrimary, cursor: sessionsPage >= Math.ceil(sessionsTotal / 20) ? 'default' : 'pointer', opacity: sessionsPage >= Math.ceil(sessionsTotal / 20) ? 0.5 : 1 }}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Session Detail View */}
            {activeTab === 'sessions' && selectedSession && (
                <div>
                    <button
                        onClick={() => setSelectedSession(null)}
                        style={{ backgroundColor: 'transparent', border: 'none', color: colors.primary, cursor: 'pointer', padding: 0, marginBottom: spacing.md, fontSize: '14px' }}
                    >
                        ← Back to sessions
                    </button>

                    <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.lg }}>
                        <h2 style={{ margin: '0 0 8px', color: colors.textPrimary }}>
                            #{selectedSession.channelName || 'Unknown Channel'}
                        </h2>
                        <div style={{ color: colors.textSecondary, fontSize: '13px', display: 'flex', gap: spacing.lg }}>
                            <span>Started: {formatDate(selectedSession.startedAt)}</span>
                            {selectedSession.endedAt && <span>Ended: {formatDate(selectedSession.endedAt)}</span>}
                            <span>{selectedSession.segments.length} audio segments</span>
                        </div>
                    </div>

                    {/* Audio Segments */}
                    <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>Audio Segments</h3>
                    {selectedSession.segments.length === 0 ? (
                        <p style={{ color: colors.textTertiary }}>No audio segments in this session.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {selectedSession.segments.map(seg => (
                                <div key={seg.id} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                                        <div>
                                            <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{seg.userName || seg.userId}</span>
                                            <span style={{ color: colors.textTertiary, fontSize: '12px', marginLeft: spacing.sm }}>
                                                {formatDuration(seg.durationMs)} · {formatSize(seg.fileSize)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                            <span style={{ color: colors.textTertiary, fontSize: '12px' }}>
                                                {formatDate(seg.startedAt)}
                                            </span>
                                            <button
                                                onClick={() => { if (confirm('Delete this audio segment? This cannot be undone.')) deleteSegment(seg.id); }}
                                                style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px' }}
                                                title="Delete segment"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <audio
                                        controls
                                        preload="none"
                                        style={{ width: '100%', height: '36px' }}
                                    >
                                        <source src={seg.r2Url} type="audio/ogg" />
                                    </audio>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Reports for this session */}
                    {selectedSession.reports.length > 0 && (
                        <div style={{ marginTop: spacing.lg }}>
                            <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>Reports for this session</h3>
                            {selectedSession.reports.map(report => (
                                <ReportCard key={report.id} report={report} onUpdate={updateReport} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <div>
                    <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
                        {['', 'open', 'reviewed', 'resolved', 'dismissed'].map(f => (
                            <button
                                key={f}
                                onClick={() => setReportFilter(f)}
                                style={{
                                    padding: `${spacing.xs} ${spacing.md}`,
                                    borderRadius: borderRadius.pill,
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: reportFilter === f ? colors.primary : colors.surfaceLight,
                                    color: reportFilter === f ? '#fff' : colors.textSecondary,
                                    fontSize: '13px',
                                }}
                            >
                                {f || 'All'}
                            </button>
                        ))}
                    </div>

                    {reports.length === 0 ? (
                        <div style={{ color: colors.textTertiary, textAlign: 'center', padding: '60px 0' }}>
                            <Shield size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                            <p>No reports found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {reports.map(report => (
                                <ReportCard key={report.id} report={report} onUpdate={updateReport} onViewSession={viewSession} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && settings && (
                <SettingsPanel settings={settings} saving={saving} onSave={saveSettings} />
            )}
        </div>
    );
}

// ─── Report Card Component ───────────────────────────────────────────────

function ReportCard({ report, onUpdate, onViewSession }: {
    report: VoiceReport;
    onUpdate: (id: string, updates: { status?: string; notes?: string }) => void;
    onViewSession?: (sessionId: string) => void;
}) {
    const [notes, setNotes] = useState(report.notes || '');
    const [editing, setEditing] = useState(false);

    const statusColors: Record<string, string> = {
        open: colors.warning,
        reviewed: colors.info,
        resolved: colors.success,
        dismissed: colors.textTertiary,
    };

    return (
        <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: '4px' }}>
                        <span style={{
                            backgroundColor: statusColors[report.status] || colors.textTertiary,
                            color: '#fff',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: borderRadius.pill,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                        }}>
                            {report.status}
                        </span>
                        <span style={{ color: colors.textTertiary, fontSize: '12px' }}>
                            {new Date(report.createdAt).toLocaleString()}
                        </span>
                    </div>
                    <p style={{ margin: '4px 0', color: colors.textPrimary }}>{report.reason}</p>
                    <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                        Reported by: {report.reporterName || report.reporterId}
                        {report.targetName && ` · Target: ${report.targetName}`}
                        {report.session?.channelName && ` · Channel: #${report.session.channelName}`}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: spacing.xs }}>
                    {report.sessionId && onViewSession && (
                        <button
                            onClick={() => onViewSession(report.sessionId!)}
                            style={{ backgroundColor: colors.surfaceLight, border: 'none', borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer', color: colors.primary }}
                            title="View session"
                        >
                            <Eye size={14} />
                        </button>
                    )}
                    {report.status === 'open' && (
                        <>
                            <button
                                onClick={() => onUpdate(report.id, { status: 'resolved' })}
                                style={{ backgroundColor: colors.surfaceLight, border: 'none', borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer', color: colors.success }}
                                title="Resolve"
                            >
                                <CheckCircle size={14} />
                            </button>
                            <button
                                onClick={() => onUpdate(report.id, { status: 'dismissed' })}
                                style={{ backgroundColor: colors.surfaceLight, border: 'none', borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer', color: colors.error }}
                                title="Dismiss"
                            >
                                <XCircle size={14} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Staff Notes */}
            {(report.notes || editing) && (
                <div style={{ marginTop: spacing.sm }}>
                    {editing ? (
                        <div style={{ display: 'flex', gap: spacing.sm }}>
                            <input
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add staff notes..."
                                style={{
                                    flex: 1,
                                    padding: spacing.sm,
                                    borderRadius: borderRadius.sm,
                                    border: `1px solid ${colors.border}`,
                                    backgroundColor: colors.surfaceLight,
                                    color: colors.textPrimary,
                                    fontSize: '13px',
                                }}
                            />
                            <button
                                onClick={() => { onUpdate(report.id, { notes }); setEditing(false); }}
                                style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.sm, border: 'none', backgroundColor: colors.primary, color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                            >
                                Save
                            </button>
                        </div>
                    ) : (
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', fontStyle: 'italic' }}>
                            Note: {report.notes}
                        </p>
                    )}
                </div>
            )}
            {!editing && !report.notes && (
                <button
                    onClick={() => setEditing(true)}
                    style={{ backgroundColor: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: '12px', padding: '4px 0', marginTop: '4px' }}
                >
                    + Add note
                </button>
            )}
        </div>
    );
}

// ─── Settings Panel ──────────────────────────────────────────────────────

function SettingsPanel({ settings, saving, onSave }: {
    settings: VoiceMonitorSettings;
    saving: boolean;
    onSave: (updates: Partial<VoiceMonitorSettings>) => void;
}) {
    const [enabled, setEnabled] = useState(settings.enabled);
    const [retentionDays, setRetentionDays] = useState(settings.retentionDays);
    const [noticeChannelId, setNoticeChannelId] = useState(settings.noticeChannelId || '');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {/* Enable/Disable */}
            <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.lg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, color: colors.textPrimary }}>Voice Monitoring</h3>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                            When enabled, the bot will join voice channels and record per-user audio.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            const newVal = !enabled;
                            setEnabled(newVal);
                            onSave({ enabled: newVal });
                        }}
                        disabled={saving}
                        style={{
                            padding: `${spacing.sm} ${spacing.lg}`,
                            borderRadius: borderRadius.md,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: enabled ? colors.error : colors.success,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '14px',
                        }}
                    >
                        {enabled ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>

            {/* Retention */}
            <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.lg }}>
                <h3 style={{ margin: '0 0 8px', color: colors.textPrimary }}>Retention Period</h3>
                <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                    Recordings older than this will be automatically deleted.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <input
                        type="number"
                        min={1}
                        max={365}
                        value={retentionDays}
                        onChange={e => setRetentionDays(parseInt(e.target.value) || 30)}
                        style={{
                            width: '80px',
                            padding: spacing.sm,
                            borderRadius: borderRadius.sm,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: colors.surfaceLight,
                            color: colors.textPrimary,
                            fontSize: '14px',
                        }}
                    />
                    <span style={{ color: colors.textSecondary }}>days</span>
                    <button
                        onClick={() => onSave({ retentionDays })}
                        disabled={saving}
                        style={{
                            marginLeft: spacing.sm,
                            padding: `${spacing.sm} ${spacing.md}`,
                            borderRadius: borderRadius.sm,
                            border: 'none',
                            backgroundColor: colors.primary,
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '13px',
                        }}
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Notice Channel */}
            <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.lg }}>
                <h3 style={{ margin: '0 0 8px', color: colors.textPrimary }}>Recording Notice Channel</h3>
                <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                    A one-time recording notice will be posted to this channel when monitoring is enabled. Use the <code>/voicemonitor notice</code> command in Discord to set and send this.
                </p>
                <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                    {settings.noticeSent ? (
                        <span style={{ color: colors.success }}>✓ Notice has been sent{settings.noticeChannelId ? ` (Channel: ${settings.noticeChannelId})` : ''}</span>
                    ) : (
                        <span style={{ color: colors.warning }}>Notice not yet sent. Use /voicemonitor notice #channel in Discord.</span>
                    )}
                </div>
            </div>

            {/* Info */}
            <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.lg }}>
                <h3 style={{ margin: '0 0 8px', color: colors.textPrimary }}>How It Works</h3>
                <ul style={{ margin: 0, paddingLeft: '20px', color: colors.textSecondary, fontSize: '13px', lineHeight: 1.8 }}>
                    <li>The bot joins voice channels when non-bot users are present</li>
                    <li>Each user's audio is recorded separately as OGG files</li>
                    <li>Recordings are uploaded to secure cloud storage (R2)</li>
                    <li>When the last non-bot user leaves, the bot disconnects and the session ends</li>
                    <li>Users can report incidents with <code>/voicereport</code></li>
                    <li>Staff can review recordings and manage reports from this dashboard</li>
                    <li>Expired recordings are automatically purged based on retention settings</li>
                </ul>
            </div>
        </div>
    );
}
