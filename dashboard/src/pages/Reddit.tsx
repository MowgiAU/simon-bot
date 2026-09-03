import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';
import { useAuth } from '../components/AuthProvider';
import {
    MessageSquare, Loader, Plus, Trash2, Play, RotateCw,
    CheckCircle, AlertTriangle, Clock, Send, ExternalLink,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

interface RedditSettings {
    id: string;
    guildId: string;
    enabled: boolean;
    subreddit: string;
    devvitEndpointBase: string | null;
    devvitToken: string | null;
    eventSecret: string | null;
    mirrorChannelId: string | null;
    modAlertChannelId: string | null;
    mirrorFlairs: string[];
    linkedRoleId: string | null;
    lastReconcileAt: string | null;
}

interface ScheduledThread {
    id: string;
    name: string;
    title: string;
    bodyTemplate: string;
    intervalMinutes: number;
    enabled: boolean;
    flairId: string | null;
    flairText: string | null;
    sticky: boolean;
    stickySlot: number;
    unstickyPrevious: boolean;
    lockPrevious: boolean;
    distinguish: boolean;
    nextRunAt: string;
    lastPostedAt: string | null;
    lastPermalink: string | null;
}

interface RedditJob {
    id: string;
    kind: string;
    status: string;
    attempts: number;
    lastError: string | null;
    permalink: string | null;
    scheduledFor: string;
    createdAt: string;
}

interface RedditEventRow {
    id: string;
    kind: string;
    author: string | null;
    title: string | null;
    permalink: string | null;
    flair: string | null;
    mirroredAt: string | null;
    createdAt: string;
}

const INTERVAL_PRESETS = [
    { label: 'Daily', minutes: 1440 },
    { label: 'Weekly', minutes: 10080 },
    { label: 'Fortnightly', minutes: 20160 },
    { label: 'Monthly (28d)', minutes: 40320 },
];

const BLANK_THREAD = {
    name: '',
    title: '',
    bodyTemplate: '',
    intervalMinutes: 10080,
    enabled: true,
    flairId: '',
    flairText: '',
    sticky: false,
    stickySlot: 2,
    unstickyPrevious: true,
    lockPrevious: false,
    distinguish: false,
};

const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
};

const label: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: '8px',
};

const input: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: '14px',
    boxSizing: 'border-box',
};

const button = (variant: 'primary' | 'ghost' | 'danger' = 'primary'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    borderRadius: borderRadius.sm,
    border: variant === 'primary' ? 'none' : `1px solid ${colors.border}`,
    backgroundColor: variant === 'primary' ? colors.primary : 'transparent',
    color: variant === 'danger' ? colors.error : variant === 'primary' ? '#fff' : colors.textSecondary,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
});

const statusColor = (status: string) => {
    if (status === 'done') return colors.success;
    if (status === 'failed') return colors.error;
    if (status === 'claimed') return colors.warning;
    return colors.textSecondary;
};

const formatInterval = (minutes: number) => {
    const preset = INTERVAL_PRESETS.find(p => p.minutes === minutes);
    if (preset) return preset.label;
    if (minutes % 1440 === 0) return `Every ${minutes / 1440} days`;
    if (minutes % 60 === 0) return `Every ${minutes / 60} hours`;
    return `Every ${minutes} minutes`;
};

const formatWhen = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
};

export const RedditPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [settings, setSettings] = useState<RedditSettings | null>(null);
    const [form, setForm] = useState({
        enabled: false,
        subreddit: '',
        devvitEndpointBase: '',
        devvitToken: '',
        eventSecret: '',
        mirrorChannelId: '',
        modAlertChannelId: '',
        mirrorFlairs: '',
        linkedRoleId: '',
    });
    const [threads, setThreads] = useState<ScheduledThread[]>([]);
    const [jobs, setJobs] = useState<RedditJob[]>([]);
    const [events, setEvents] = useState<RedditEventRow[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [editing, setEditing] = useState<(typeof BLANK_THREAD & { id?: string }) | null>(null);
    const [composer, setComposer] = useState<{ title: string; text: string } | null>(null);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 5000);
    };

    const load = useCallback(async () => {
        if (!guildId) return;
        try {
            const [sRes, tRes, jRes, eRes] = await Promise.all([
                fetch(`${API}/api/reddit/${guildId}/settings`, { credentials: 'include' }),
                fetch(`${API}/api/reddit/${guildId}/threads`, { credentials: 'include' }),
                fetch(`${API}/api/reddit/${guildId}/jobs?limit=25`, { credentials: 'include' }),
                fetch(`${API}/api/reddit/${guildId}/events?limit=25`, { credentials: 'include' }),
            ]);

            const s = await sRes.json();
            if (!sRes.ok) throw new Error(s.error || 'Failed to load settings');
            setSettings(s);
            if (s) {
                setForm({
                    enabled: s.enabled,
                    subreddit: s.subreddit ?? '',
                    devvitEndpointBase: s.devvitEndpointBase ?? '',
                    devvitToken: s.devvitToken ?? '',
                    eventSecret: s.eventSecret ?? '',
                    mirrorChannelId: s.mirrorChannelId ?? '',
                    modAlertChannelId: s.modAlertChannelId ?? '',
                    mirrorFlairs: (s.mirrorFlairs ?? []).join(', '),
                    linkedRoleId: s.linkedRoleId ?? '',
                });
            }

            if (tRes.ok) setThreads(await tRes.json());
            if (jRes.ok) setJobs(await jRes.json());
            if (eRes.ok) setEvents(await eRes.json());
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { load(); }, [load]);

    const saveSettings = async () => {
        if (!guildId) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/reddit/${guildId}/settings`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    mirrorFlairs: form.mirrorFlairs.split(',').map(f => f.trim()).filter(Boolean),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            showMsg('success', 'Connection saved.');
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const saveThread = async () => {
        if (!guildId || !editing) return;
        setSaving(true);
        try {
            const isNew = !editing.id;
            const res = await fetch(
                `${API}/api/reddit/${guildId}/threads${isNew ? '' : `/${editing.id}`}`,
                {
                    method: isNew ? 'POST' : 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editing),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save thread');
            showMsg('success', isNew ? 'Recurring thread created.' : 'Recurring thread updated.');
            setEditing(null);
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to save thread');
        } finally {
            setSaving(false);
        }
    };

    const deleteThread = async (id: string) => {
        if (!guildId || !window.confirm('Delete this recurring thread? Posts already on Reddit are unaffected.')) return;
        try {
            const res = await fetch(`${API}/api/reddit/${guildId}/threads/${id}`, {
                method: 'DELETE', credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
            showMsg('success', 'Recurring thread deleted.');
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to delete');
        }
    };

    const runThreadNow = async (id: string) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/reddit/${guildId}/threads/${id}/run-now`, {
                method: 'POST', credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to queue');
            showMsg('success', 'Queued — it will post within a minute.');
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to queue');
        }
    };

    const retryJob = async (id: string) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/reddit/${guildId}/jobs/${id}/retry`, {
                method: 'POST', credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to retry');
            showMsg('success', 'Job requeued.');
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to retry');
        }
    };

    const postNow = async () => {
        if (!guildId || !composer) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/reddit/${guildId}/post`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: 'submit_post', payload: composer }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to queue post');
            showMsg('success', 'Post queued — it goes up within 30 seconds.');
            setComposer(null);
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to queue post');
        } finally {
            setSaving(false);
        }
    };

    if (!guildId) return null;
    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader className="spin" /></div>;
    }

    return (
        <div style={{ padding: spacing.lg, maxWidth: 860 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <MessageSquare size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Reddit Bridge</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Post to your subreddit on a schedule and mirror its activity into Discord
                    </p>
                </div>
            </div>

            <div style={{ ...card, borderLeft: `4px solid ${colors.primary}`, marginBottom: spacing.lg }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    This connects Fuji Studio to a subreddit through a Devvit app that you install as a moderator —
                    there is no Reddit API key involved. Everything posted here goes out as the Devvit app's account,
                    so it needs moderator permissions on the subreddit for stickying and flair to work. Recurring
                    threads are composed below and posted automatically; each run can unsticky and lock the previous
                    week's thread first. Anything the bridge sends is queued, retried on failure, and visible in the
                    job list, so nothing posts twice and nothing fails silently.
                </p>
            </div>

            {msg && (
                <div style={{
                    padding: '10px 14px', borderRadius: borderRadius.sm, marginBottom: spacing.md,
                    backgroundColor: msg.type === 'success' ? `${colors.success}22` : `${colors.error}22`,
                    color: msg.type === 'success' ? colors.success : colors.error, fontSize: '13px',
                }}>
                    {msg.text}
                </div>
            )}

            {/* ── Connection ───────────────────────────────────────────────── */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, flexWrap: 'wrap', gap: spacing.sm }}>
                    <h2 style={{ margin: 0, fontSize: '16px' }}>Connection</h2>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: colors.textSecondary, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={form.enabled}
                            onChange={e => setForm({ ...form, enabled: e.target.checked })}
                        />
                        Bridge enabled
                    </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: spacing.md }}>
                    <div>
                        <label style={label}>Subreddit</label>
                        <input
                            style={input}
                            value={form.subreddit}
                            onChange={e => setForm({ ...form, subreddit: e.target.value })}
                            placeholder="FL_Studio"
                        />
                    </div>
                    <div>
                        <label style={label}>Devvit endpoint base</label>
                        <input
                            style={input}
                            value={form.devvitEndpointBase}
                            onChange={e => setForm({ ...form, devvitEndpointBase: e.target.value })}
                            placeholder="https://fuji-studio-g6wmo1-external.devvit.net"
                        />
                        <p style={{ margin: '6px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                            Format: <code>https://&lt;app-slug&gt;-&lt;subreddit-id&gt;-external.devvit.net</code> — the bare id from the subreddit's about.json (<code>data.id</code>), without the <code>t5_</code> prefix, and no trailing path.
                        </p>
                    </div>
                    <div>
                        <label style={label}>Devvit managed token</label>
                        <input
                            style={input}
                            type="password"
                            value={form.devvitToken}
                            onChange={e => setForm({ ...form, devvitToken: e.target.value })}
                            placeholder="devvit_at_..."
                        />
                    </div>
                </div>

                <div style={{ marginTop: spacing.md, padding: spacing.sm, borderRadius: borderRadius.sm, border: `1px dashed ${colors.border}` }}>
                    <p style={{ margin: `0 0 ${spacing.sm} 0`, fontSize: '12px', color: colors.warning }}>
                        Mirroring is handled inside the Devvit app, which posts to a Discord webhook
                        directly. Reddit's fetch policy does not allow a Devvit app to call a domain its
                        own developer controls, so fujistud.io will never be approved and these three
                        fields do nothing — set the webhook URL, flair filter and comment toggle in the
                        Devvit app's settings instead.
                    </p>

                    <label style={label}>Mirror Reddit posts to</label>
                    <ChannelSelect
                        guildId={guildId}
                        value={form.mirrorChannelId}
                        onChange={v => setForm({ ...form, mirrorChannelId: Array.isArray(v) ? v[0] : v })}
                        placeholder="Select a channel..."
                    />

                    <div style={{ marginTop: spacing.md }}>
                        <label style={label}>Mod alerts to</label>
                        <ChannelSelect
                            guildId={guildId}
                            value={form.modAlertChannelId}
                            onChange={v => setForm({ ...form, modAlertChannelId: Array.isArray(v) ? v[0] : v })}
                            placeholder="Falls back to the mirror channel"
                        />
                    </div>

                    <div style={{ marginTop: spacing.md }}>
                        <label style={label}>Only mirror these flairs</label>
                        <input
                            style={input}
                            value={form.mirrorFlairs}
                            onChange={e => setForm({ ...form, mirrorFlairs: e.target.value })}
                            placeholder="Leave empty to mirror every post"
                        />
                    </div>
                </div>

                <div style={{ marginTop: spacing.md }}>
                    <label style={label}>Role granted on account link</label>
                    <RoleSelect
                        guildId={guildId}
                        value={form.linkedRoleId}
                        onChange={v => setForm({ ...form, linkedRoleId: Array.isArray(v) ? v[0] : v })}
                        placeholder="No role"
                    />
                </div>

                <div style={{ marginTop: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
                    <button style={button()} onClick={saveSettings} disabled={saving}>
                        {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                        Save connection
                    </button>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                        Last reconcile from Devvit: {formatWhen(settings?.lastReconcileAt ?? null)}
                    </span>
                </div>
            </div>

            {/* ── Recurring threads ────────────────────────────────────────── */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                    <h2 style={{ margin: 0, fontSize: '16px' }}>Recurring threads</h2>
                    <button style={button('ghost')} onClick={() => setEditing({ ...BLANK_THREAD })}>
                        <Plus size={14} /> New thread
                    </button>
                </div>

                {threads.length === 0 && !editing && (
                    <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>
                        No recurring threads yet. Feedback Friday and a weekly Q&amp;A are the usual first two.
                    </p>
                )}

                {threads.map(thread => (
                    <div key={thread.id} style={{
                        padding: spacing.sm, borderRadius: borderRadius.sm,
                        border: `1px solid ${colors.border}`, marginBottom: spacing.sm,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        gap: spacing.sm, flexWrap: 'wrap',
                    }}>
                        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>
                                {thread.name}
                                {!thread.enabled && (
                                    <span style={{ marginLeft: '8px', fontSize: '11px', color: colors.textSecondary }}>paused</span>
                                )}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                {formatInterval(thread.intervalMinutes)} · next {formatWhen(thread.nextRunAt)}
                                {thread.sticky && ' · stickied'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {thread.lastPermalink && (
                                <a
                                    href={`https://www.reddit.com${thread.lastPermalink}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ ...button('ghost'), textDecoration: 'none' }}
                                >
                                    <ExternalLink size={14} /> Last post
                                </a>
                            )}
                            <button style={button('ghost')} onClick={() => runThreadNow(thread.id)}>
                                <Play size={14} /> Run now
                            </button>
                            <button
                                style={button('ghost')}
                                onClick={() => setEditing({
                                    id: thread.id,
                                    name: thread.name,
                                    title: thread.title,
                                    bodyTemplate: thread.bodyTemplate,
                                    intervalMinutes: thread.intervalMinutes,
                                    enabled: thread.enabled,
                                    flairId: thread.flairId ?? '',
                                    flairText: thread.flairText ?? '',
                                    sticky: thread.sticky,
                                    stickySlot: thread.stickySlot,
                                    unstickyPrevious: thread.unstickyPrevious,
                                    lockPrevious: thread.lockPrevious,
                                    distinguish: thread.distinguish,
                                })}
                            >
                                Edit
                            </button>
                            <button style={button('danger')} onClick={() => deleteThread(thread.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}

                {editing && (
                    <div style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.sm, border: `1px solid ${colors.primary}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing.md }}>
                            <div>
                                <label style={label}>Name (internal)</label>
                                <input style={input} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Feedback Friday" />
                            </div>
                            <div>
                                <label style={label}>Cadence</label>
                                <select
                                    style={input}
                                    value={editing.intervalMinutes}
                                    onChange={e => setEditing({ ...editing, intervalMinutes: Number(e.target.value) })}
                                >
                                    {INTERVAL_PRESETS.map(p => (
                                        <option key={p.minutes} value={p.minutes}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: spacing.md }}>
                            <label style={label}>Post title</label>
                            <input style={input} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Feedback Friday — week {{week}}" />
                        </div>

                        <div style={{ marginTop: spacing.md }}>
                            <label style={label}>Post body (Markdown)</label>
                            <textarea
                                style={{ ...input, minHeight: '160px', fontFamily: 'monospace', resize: 'vertical' }}
                                value={editing.bodyTemplate}
                                onChange={e => setEditing({ ...editing, bodyTemplate: e.target.value })}
                                placeholder={'Drop a track, leave feedback on two others.\n\nThis week on Fuji Studio:\n{{topTracks}}'}
                            />
                            <p style={{ margin: '6px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                                Placeholders: <code>{'{{date}}'}</code> <code>{'{{week}}'}</code> <code>{'{{prevThreadUrl}}'}</code> <code>{'{{topTracks}}'}</code> <code>{'{{activeBattle}}'}</code>
                            </p>
                        </div>

                        <div style={{ marginTop: spacing.md }}>
                            <label style={label}>Flair text (optional)</label>
                            <input style={input} value={editing.flairText} onChange={e => setEditing({ ...editing, flairText: e.target.value })} placeholder="Weekly Thread" />
                        </div>

                        <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.md, flexWrap: 'wrap', fontSize: '13px', color: colors.textSecondary }}>
                            {([
                                ['enabled', 'Active'],
                                ['sticky', 'Sticky the new post'],
                                ['unstickyPrevious', 'Unsticky the previous one'],
                                ['lockPrevious', 'Lock the previous one'],
                                ['distinguish', 'Distinguish as mod'],
                            ] as const).map(([key, text]) => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editing[key])}
                                        onChange={e => setEditing({ ...editing, [key]: e.target.checked })}
                                    />
                                    {text}
                                </label>
                            ))}
                        </div>

                        <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.sm }}>
                            <button style={button()} onClick={saveThread} disabled={saving}>
                                {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                                {editing.id ? 'Save thread' : 'Create thread'}
                            </button>
                            <button style={button('ghost')} onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Ad-hoc post ──────────────────────────────────────────────── */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: composer ? spacing.md : 0 }}>
                    <h2 style={{ margin: 0, fontSize: '16px' }}>Post something now</h2>
                    {!composer && (
                        <button style={button('ghost')} onClick={() => setComposer({ title: '', text: '' })}>
                            <Send size={14} /> Compose
                        </button>
                    )}
                </div>

                {composer && (
                    <>
                        <label style={label}>Title</label>
                        <input style={input} value={composer.title} onChange={e => setComposer({ ...composer, title: e.target.value })} />
                        <div style={{ marginTop: spacing.md }}>
                            <label style={label}>Body (Markdown)</label>
                            <textarea
                                style={{ ...input, minHeight: '120px', fontFamily: 'monospace', resize: 'vertical' }}
                                value={composer.text}
                                onChange={e => setComposer({ ...composer, text: e.target.value })}
                            />
                        </div>
                        <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.sm }}>
                            <button style={button()} onClick={postNow} disabled={saving || !composer.title.trim()}>
                                {saving ? <Loader size={14} className="spin" /> : <Send size={14} />}
                                Queue post
                            </button>
                            <button style={button('ghost')} onClick={() => setComposer(null)}>Cancel</button>
                        </div>
                    </>
                )}
            </div>

            {/* ── Job queue ────────────────────────────────────────────────── */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                    <h2 style={{ margin: 0, fontSize: '16px' }}>Outbound queue</h2>
                    <button style={button('ghost')} onClick={load}><RotateCw size={14} /> Refresh</button>
                </div>

                {jobs.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Nothing queued yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 520 }}>
                            <thead>
                                <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                                    <th style={{ padding: '6px 8px' }}>Action</th>
                                    <th style={{ padding: '6px 8px' }}>Status</th>
                                    <th style={{ padding: '6px 8px' }}>Attempts</th>
                                    <th style={{ padding: '6px 8px' }}>Queued</th>
                                    <th style={{ padding: '6px 8px' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(job => (
                                    <tr key={job.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                                        <td style={{ padding: '8px', color: colors.textPrimary }}>
                                            {job.kind.replace(/_/g, ' ')}
                                            {job.lastError && (
                                                <div style={{ fontSize: '11px', color: colors.error, marginTop: '2px' }}>
                                                    <AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> {job.lastError}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px', color: statusColor(job.status), fontWeight: 600 }}>{job.status}</td>
                                        <td style={{ padding: '8px', color: colors.textSecondary }}>{job.attempts}</td>
                                        <td style={{ padding: '8px', color: colors.textSecondary }}>{formatWhen(job.createdAt)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>
                                            {job.permalink ? (
                                                <a href={`https://www.reddit.com${job.permalink}`} target="_blank" rel="noreferrer" style={{ color: colors.primary }}>
                                                    <ExternalLink size={14} />
                                                </a>
                                            ) : job.status === 'failed' ? (
                                                <button style={button('ghost')} onClick={() => retryJob(job.id)}>
                                                    <RotateCw size={13} /> Retry
                                                </button>
                                            ) : (
                                                <Clock size={14} color={colors.textSecondary} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Mirrored events ──────────────────────────────────────────── */}
            <div style={card}>
                <h2 style={{ margin: `0 0 ${spacing.md} 0`, fontSize: '16px' }}>Recent subreddit activity</h2>
                {events.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>
                        Nothing here yet — and nothing will arrive while mirroring goes straight from the
                        Devvit app to a Discord webhook. Reddit activity shows up in Discord, not in this
                        feed. This fills in only if the fujistud.io fetch domain is approved.
                    </p>
                ) : (
                    events.map(event => (
                        <div key={event.id} style={{ padding: '8px 0', borderTop: `1px solid ${colors.border}` }}>
                            <div style={{ fontSize: '13px', color: colors.textPrimary }}>
                                {event.permalink ? (
                                    <a href={`https://www.reddit.com${event.permalink}`} target="_blank" rel="noreferrer" style={{ color: colors.textPrimary }}>
                                        {event.title || event.kind}
                                    </a>
                                ) : (event.title || event.kind)}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                {event.author ? `u/${event.author} · ` : ''}{event.kind}
                                {event.flair ? ` · ${event.flair}` : ''} · {formatWhen(event.createdAt)}
                                {event.mirroredAt ? ' · mirrored' : ' · pending'}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RedditPage;
