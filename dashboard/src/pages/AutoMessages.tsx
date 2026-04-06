import React, { useState, useEffect, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import {
    Clock,
    Plus,
    Trash2,
    GripVertical,
    ToggleLeft,
    ToggleRight,
    MessageSquareDashed,
    Save,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Pencil,
    Check,
    X,
} from 'lucide-react';

interface AutoMessageEntry {
    id?: string;
    content: string;
    position: number;
}

interface AutoMessageSchedule {
    id: string;
    guildId: string;
    name: string;
    channelId: string | null;
    intervalMinutes: number;
    enabled: boolean;
    messages: AutoMessageEntry[];
}

const INTERVAL_PRESETS = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hr', value: 60 },
    { label: '2 hr', value: 120 },
    { label: '4 hr', value: 240 },
    { label: '6 hr', value: 360 },
    { label: '12 hr', value: 720 },
    { label: '24 hr', value: 1440 },
];

const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    marginBottom: '16px',
    overflow: 'hidden',
};

const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: borderRadius.sm,
    padding: '9px 12px',
    color: colors.textPrimary,
    fontSize: '14px',
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: colors.textSecondary,
    marginBottom: '6px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};

const intervalLabel = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// ─── Per-schedule editor ────────────────────────────────────────────────────

interface ScheduleCardProps {
    schedule: AutoMessageSchedule;
    guildId: string;
    onUpdated: (s: AutoMessageSchedule) => void;
    onDeleted: (id: string) => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({ schedule, guildId, onUpdated, onDeleted }) => {
    const [expanded, setExpanded] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [draft, setDraft] = useState<AutoMessageSchedule>({ ...schedule, messages: [...schedule.messages] });
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [newContent, setNewContent] = useState('');
    const [nameInput, setNameInput] = useState(schedule.name);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [customInterval, setCustomInterval] = useState('');

    useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

    // Sync from parent if schedule changes externally
    useEffect(() => {
        setDraft({ ...schedule, messages: [...schedule.messages] });
        setNameInput(schedule.name);
        setIsDirty(false);
    }, [schedule.id]);

    const update = (patch: Partial<AutoMessageSchedule>) => {
        setDraft(prev => ({ ...prev, ...patch }));
        setIsDirty(true);
    };

    const addMessage = () => {
        const c = newContent.trim();
        if (!c) return;
        update({ messages: [...draft.messages, { content: c, position: draft.messages.length }] });
        setNewContent('');
    };

    const removeMessage = (idx: number) => {
        update({ messages: draft.messages.filter((_, i) => i !== idx).map((m, i) => ({ ...m, position: i })) });
    };

    const updateMessage = (idx: number, content: string) => {
        const msgs = [...draft.messages];
        msgs[idx] = { ...msgs[idx], content };
        update({ messages: msgs });
    };

    const onDragStart = (i: number) => setDragIdx(i);
    const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIdx(i); };
    const onDrop = (i: number) => {
        if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return; }
        const msgs = [...draft.messages];
        const [moved] = msgs.splice(dragIdx, 1);
        msgs.splice(i, 0, moved);
        update({ messages: msgs.map((m, idx) => ({ ...m, position: idx })) });
        setDragIdx(null); setDragOverIdx(null);
    };

    const saveName = () => {
        const trimmed = nameInput.trim() || 'New Schedule';
        update({ name: trimmed });
        setEditingName(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/auto-messages/${guildId}/${draft.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name,
                    channelId: draft.channelId,
                    intervalMinutes: draft.intervalMinutes,
                    enabled: draft.enabled,
                    messages: draft.messages.map((m, i) => ({ content: m.content, position: i })),
                }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || 'Save failed');
            }
            const updated: AutoMessageSchedule = await res.json();
            onUpdated(updated);
            setIsDirty(false);
            setMsg({ type: 'success', text: 'Saved!' });
        } catch (e: any) {
            setMsg({ type: 'error', text: e.message || 'Failed to save.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete schedule "${draft.name}"? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/auto-messages/${guildId}/${draft.id}`, {
                method: 'DELETE', credentials: 'include',
            });
            if (!res.ok) throw new Error('Delete failed');
            onDeleted(draft.id);
        } catch {
            setMsg({ type: 'error', text: 'Failed to delete.' });
            setDeleting(false);
        }
    };

    // Quick enable/disable without opening editor
    const handleToggle = async () => {
        const nextEnabled = !draft.enabled;
        update({ enabled: nextEnabled });
        // Auto-save just the toggle
        try {
            const res = await fetch(`/api/auto-messages/${guildId}/${draft.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name,
                    channelId: draft.channelId,
                    intervalMinutes: draft.intervalMinutes,
                    enabled: nextEnabled,
                    messages: draft.messages.map((m, i) => ({ content: m.content, position: i })),
                }),
            });
            if (!res.ok) throw new Error();
            const updated: AutoMessageSchedule = await res.json();
            onUpdated(updated);
            setIsDirty(false);
        } catch {
            // revert
            update({ enabled: !nextEnabled });
        }
    };

    return (
        <div style={card}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
                {/* Toggle */}
                <button
                    onClick={e => { e.stopPropagation(); handleToggle(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex' }}
                    title={draft.enabled ? 'Disable' : 'Enable'}
                >
                    {draft.enabled
                        ? <ToggleRight size={30} color={colors.primary} />
                        : <ToggleLeft size={30} color={colors.textTertiary} />}
                </button>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => setExpanded(e => !e)}>
                    {editingName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            <input
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameInput(draft.name); setEditingName(false); } }}
                                autoFocus
                                maxLength={100}
                                style={{ ...inputBase, width: '220px', padding: '5px 9px', fontSize: '14px' }}
                            />
                            <button onClick={saveName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, display: 'flex' }}><Check size={16} /></button>
                            <button onClick={() => { setNameInput(draft.name); setEditingName(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}><X size={16} /></button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {draft.name}
                            </span>
                            <button
                                onClick={e => { e.stopPropagation(); setEditingName(true); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 0, display: 'flex', flexShrink: 0 }}
                                title="Rename"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={() => setExpanded(e => !e)}>
                    <span style={{ fontSize: '11px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.pill, padding: '3px 8px' }}>
                        <Clock size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {intervalLabel(draft.intervalMinutes)}
                    </span>
                    <span style={{ fontSize: '11px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.pill, padding: '3px 8px' }}>
                        {draft.messages.length} msg{draft.messages.length !== 1 ? 's' : ''}
                    </span>
                    {expanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                </div>
            </div>

            {/* Status message */}
            {msg && (
                <div style={{ margin: '0 18px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: msg.type === 'success' ? colors.primary : '#ef4444' }}>
                    <AlertCircle size={13} /> {msg.text}
                </div>
            )}

            {/* Expanded editor */}
            {expanded && (
                <div style={{ borderTop: `1px solid ${colors.glassBorder}`, padding: '20px 18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        {/* Channel */}
                        <div>
                            <span style={labelStyle}>Channel</span>
                            <ChannelSelect
                                guildId={guildId}
                                value={draft.channelId || ''}
                                onChange={v => { const ch = typeof v === 'string' ? v : v[0]; update({ channelId: ch || null }); }}
                                placeholder="Select channel…"
                            />
                        </div>

                        {/* Interval */}
                        <div>
                            <span style={labelStyle}>Interval</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                {INTERVAL_PRESETS.map(p => (
                                    <button key={p.value} onClick={() => { update({ intervalMinutes: p.value }); setCustomInterval(''); }}
                                        style={{ padding: '4px 10px', borderRadius: borderRadius.pill, fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: draft.intervalMinutes === p.value ? colors.primary : 'rgba(255,255,255,0.05)', color: draft.intervalMinutes === p.value ? '#fff' : colors.textSecondary }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <input type="number" min={1} max={10080} value={customInterval} placeholder="Custom (mins)…"
                                onChange={e => { setCustomInterval(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) update({ intervalMinutes: v }); }}
                                style={{ ...inputBase, fontSize: '13px' }} />
                        </div>
                    </div>

                    {/* Messages list */}
                    <span style={labelStyle}>Messages ({draft.messages.length}/50) — cycle in order, drag to reorder</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {draft.messages.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '24px', color: colors.textTertiary, fontSize: '12px', border: `1px dashed ${colors.glassBorder}`, borderRadius: borderRadius.md }}>
                                No messages yet.
                            </div>
                        )}
                        {draft.messages.map((m, idx) => (
                            <div key={idx} draggable
                                onDragStart={() => onDragStart(idx)}
                                onDragOver={e => onDragOver(e, idx)}
                                onDrop={() => onDrop(idx)}
                                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px', borderRadius: borderRadius.sm, backgroundColor: dragOverIdx === idx ? `${colors.primary}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${dragOverIdx === idx ? `${colors.primary}44` : colors.glassBorder}`, opacity: dragIdx === idx ? 0.5 : 1 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, paddingTop: '8px', cursor: 'grab' }}>
                                    <GripVertical size={13} color={colors.textTertiary} />
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: colors.textTertiary, minWidth: '14px', textAlign: 'right' }}>{idx + 1}</span>
                                </div>
                                <textarea value={m.content} onChange={e => updateMessage(idx, e.target.value)}
                                    rows={Math.max(2, m.content.split('\n').length)} maxLength={2000}
                                    style={{ ...inputBase, flex: 1, resize: 'vertical', minHeight: '50px', fontFamily: 'inherit', fontSize: '13px' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0, paddingTop: '6px' }}>
                                    <span style={{ fontSize: '9px', color: m.content.length > 1800 ? '#ef4444' : colors.textTertiary }}>{m.content.length}/2k</span>
                                    <button onClick={() => removeMessage(idx)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: '3px', display: 'flex', borderRadius: '4px' }}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add message */}
                    {draft.messages.length < 50 && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addMessage(); }}
                                placeholder="New message… (Ctrl+Enter to add)" rows={2} maxLength={2000}
                                style={{ ...inputBase, flex: 1, resize: 'vertical', minHeight: '60px', fontFamily: 'inherit', fontSize: '13px' }} />
                            <button onClick={addMessage} disabled={!newContent.trim()}
                                style={{ padding: '8px 14px', borderRadius: borderRadius.sm, backgroundColor: newContent.trim() ? colors.primary : 'rgba(255,255,255,0.05)', color: newContent.trim() ? '#fff' : colors.textTertiary, border: 'none', cursor: newContent.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <Plus size={14} /> Add
                            </button>
                        </div>
                    )}

                    {/* Footer actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <button onClick={handleDelete} disabled={deleting}
                            style={{ padding: '8px 14px', borderRadius: borderRadius.sm, backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: deleting ? 0.6 : 1 }}>
                            <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
                        </button>

                        {isDirty && (
                            <button onClick={handleSave} disabled={saving}
                                style={{ padding: '9px 22px', borderRadius: borderRadius.sm, backgroundColor: colors.primary, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
                                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const AutoMessagesPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [schedules, setSchedules] = useState<AutoMessageSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!guildId) return;
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const controller = abortRef.current;

        const tid = setTimeout(async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/auto-messages/${guildId}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.detail || d.error || `HTTP ${res.status}`);
                }
                const data: AutoMessageSchedule[] = await res.json();
                setSchedules(data);
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message || 'Failed to load schedules.');
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => { clearTimeout(tid); controller.abort(); };
    }, [guildId]);

    const handleCreate = async () => {
        if (!guildId) return;
        setCreating(true);
        try {
            const res = await fetch(`/api/auto-messages/${guildId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Schedule ${schedules.length + 1}` }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.detail || d.error || 'Failed to create');
            }
            const s: AutoMessageSchedule = await res.json();
            setSchedules(prev => [...prev, s]);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdated = (updated: AutoMessageSchedule) =>
        setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));

    const handleDeleted = (id: string) =>
        setSchedules(prev => prev.filter(s => s.id !== id));

    return (
        <div style={{ padding: '32px', maxWidth: '860px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <MessageSquareDashed size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Auto Messages</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Create multiple schedules — each with its own channel, interval, and rotating message list
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Each schedule sends its messages in order to its chosen channel, then loops back to the start.
                    Create as many schedules as you need — for example, tips every hour in #general and announcements every 6 hours in #announcements.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: '12px 16px', marginBottom: '20px', color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: colors.textTertiary, fontSize: '13px' }}>Loading schedules…</div>
            ) : (
                <>
                    {schedules.length === 0 && !error && (
                        <div style={{ textAlign: 'center', padding: '48px 24px', color: colors.textSecondary, fontSize: '14px', backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px dashed ${colors.glassBorder}`, marginBottom: '20px' }}>
                            <MessageSquareDashed size={32} color={colors.textTertiary} style={{ marginBottom: '12px' }} />
                            <div>No schedules yet. Create one to get started.</div>
                        </div>
                    )}

                    {schedules.map(s => (
                        <ScheduleCard
                            key={s.id}
                            schedule={s}
                            guildId={guildId || ''}
                            onUpdated={handleUpdated}
                            onDeleted={handleDeleted}
                        />
                    ))}
                </>
            )}

            {/* Add schedule button */}
            <button onClick={handleCreate} disabled={creating || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: borderRadius.md, backgroundColor: colors.primary, color: '#fff', border: 'none', cursor: creating || loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: creating ? 0.7 : 1 }}>
                <Plus size={16} /> {creating ? 'Creating…' : 'Add Schedule'}
            </button>
        </div>
    );
};

import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import {
    Clock,
    Plus,
    Trash2,
    GripVertical,
    ToggleLeft,
    ToggleRight,
    MessageSquareDashed,
    Save,
    AlertCircle,
} from 'lucide-react';

interface AutoMessageEntry {
    id?: string;
    content: string;
    position: number;
}

interface AutoMessageConfig {
    guildId?: string;
    channelId: string | null;
    intervalMinutes: number;
    enabled: boolean;
    messages: AutoMessageEntry[];
}

const DEFAULT_CONFIG: AutoMessageConfig = {
    channelId: null,
    intervalMinutes: 60,
    enabled: false,
    messages: [],
};

// Interval presets
const INTERVAL_PRESETS = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '4 hours', value: 240 },
    { label: '6 hours', value: 360 },
    { label: '12 hours', value: 720 },
    { label: '24 hours', value: 1440 },
];

const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    padding: '24px',
    marginBottom: '20px',
};

const label: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: '8px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: borderRadius.sm,
    padding: '10px 12px',
    color: colors.textPrimary,
    fontSize: '14px',
    outline: 'none',
};

export const AutoMessagesPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [config, setConfig] = useState<AutoMessageConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [newMsgContent, setNewMsgContent] = useState('');
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [customInterval, setCustomInterval] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Load config
    useEffect(() => {
        if (!guildId) return;
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const controller = abortRef.current;

        const tid = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/auto-messages/${guildId}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('Failed to load');
                const data = await res.json();
                setConfig({
                    guildId: data.guildId,
                    channelId: data.channelId || null,
                    intervalMinutes: data.intervalMinutes || 60,
                    enabled: !!data.enabled,
                    messages: (data.messages || []).map((m: any, i: number) => ({
                        id: m.id,
                        content: m.content,
                        position: m.position ?? i,
                    })),
                });
                setIsDirty(false);
            } catch (e: any) {
                if (e.name !== 'AbortError') setMessage({ type: 'error', text: 'Failed to load config.' });
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => { clearTimeout(tid); controller.abort(); };
    }, [guildId]);

    // Auto-dismiss status message
    useEffect(() => {
        if (!message) return;
        const tid = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(tid);
    }, [message]);

    const update = (patch: Partial<AutoMessageConfig>) => {
        setConfig(prev => ({ ...prev, ...patch }));
        setIsDirty(true);
    };

    const addMessage = () => {
        const content = newMsgContent.trim();
        if (!content) return;
        const next: AutoMessageEntry = { content, position: config.messages.length };
        setConfig(prev => ({ ...prev, messages: [...prev.messages, next] }));
        setNewMsgContent('');
        setIsDirty(true);
    };

    const updateMessage = (idx: number, content: string) => {
        const msgs = [...config.messages];
        msgs[idx] = { ...msgs[idx], content };
        setConfig(prev => ({ ...prev, messages: msgs }));
        setIsDirty(true);
    };

    const removeMessage = (idx: number) => {
        setConfig(prev => ({
            ...prev,
            messages: prev.messages.filter((_, i) => i !== idx).map((m, i) => ({ ...m, position: i })),
        }));
        setIsDirty(true);
    };

    // Drag-to-reorder
    const onDragStart = (idx: number) => setDragIdx(idx);
    const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
    const onDrop = (idx: number) => {
        if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
        const msgs = [...config.messages];
        const [moved] = msgs.splice(dragIdx, 1);
        msgs.splice(idx, 0, moved);
        setConfig(prev => ({ ...prev, messages: msgs.map((m, i) => ({ ...m, position: i })) }));
        setDragIdx(null);
        setDragOverIdx(null);
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!guildId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/auto-messages/${guildId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: config.channelId,
                    intervalMinutes: config.intervalMinutes,
                    enabled: config.enabled,
                    messages: config.messages.map((m, i) => ({ content: m.content, position: i })),
                }),
            });
            if (!res.ok) throw new Error('Save failed');
            const data = await res.json();
            setConfig({
                guildId: data.guildId,
                channelId: data.channelId || null,
                intervalMinutes: data.intervalMinutes || 60,
                enabled: !!data.enabled,
                messages: (data.messages || []).map((m: any, i: number) => ({ id: m.id, content: m.content, position: m.position ?? i })),
            });
            setIsDirty(false);
            setMessage({ type: 'success', text: 'Auto messages saved!' });
        } catch {
            setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const intervalLabel = (mins: number): string => {
        if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
        return `${h}h ${m}m`;
    };

    if (loading) return (
        <div style={{ padding: spacing.xl, color: colors.textSecondary }}>Loading...</div>
    );

    return (
        <div style={{ padding: isMobile ? spacing.md : spacing.xl, maxWidth: '800px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <MessageSquareDashed size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Auto Messages</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Automatically send a rotating list of messages to a channel on a schedule
                    </p>
                </div>
            </div>

            {/* Status message */}
            {message && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    backgroundColor: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? colors.primary : '#ef4444'}44`,
                    borderRadius: borderRadius.md, padding: '12px 16px', marginBottom: '20px',
                    color: message.type === 'success' ? colors.primary : '#ef4444', fontSize: '13px', fontWeight: 600,
                }}>
                    <AlertCircle size={16} />
                    {message.text}
                </div>
            )}

            {/* Explanation */}
            <div className="settings-explanation" style={{
                backgroundColor: colors.surface, padding: spacing.md,
                borderRadius: borderRadius.md, marginBottom: spacing.lg,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Add a list of messages below, pick a channel and an interval, then enable.
                    Fuji Studio will cycle through all messages in order — after the last one it loops back to the first.
                    Messages support standard Discord markdown and mentions.
                </p>
            </div>

            {/* Settings card */}
            <div style={card}>
                <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px', borderLeft: `3px solid ${colors.primary}` }}>
                    <Clock size={15} color={colors.primary} /> Schedule Settings
                </h3>

                {/* Enable toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px 16px', backgroundColor: config.enabled ? `${colors.primary}0F` : 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: `1px solid ${config.enabled ? `${colors.primary}33` : colors.glassBorder}` }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: colors.textPrimary }}>
                            {config.enabled ? 'Active — messages are being sent' : 'Inactive — no messages will be sent'}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                            {config.enabled && config.channelId
                                ? `Sending every ${intervalLabel(config.intervalMinutes)}`
                                : 'Toggle to start sending'}
                        </div>
                    </div>
                    <button
                        onClick={() => update({ enabled: !config.enabled })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                        aria-label={config.enabled ? 'Disable' : 'Enable'}
                    >
                        {config.enabled
                            ? <ToggleRight size={36} color={colors.primary} />
                            : <ToggleLeft size={36} color={colors.textTertiary} />}
                    </button>
                </div>

                {/* Channel */}
                <div style={{ marginBottom: '20px' }}>
                    <span style={label}>Target Channel</span>
                    <ChannelSelect
                        guildId={guildId || ''}
                        value={config.channelId || ''}
                        onChange={v => { const ch = typeof v === 'string' ? v : v[0]; update({ channelId: ch || null }); }}
                        placeholder="Select a channel..."
                    />
                </div>

                {/* Interval */}
                <div>
                    <span style={label}>Interval between messages</span>
                    {/* Preset chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {INTERVAL_PRESETS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => { update({ intervalMinutes: p.value }); setCustomInterval(''); }}
                                style={{
                                    padding: '6px 14px', borderRadius: borderRadius.pill,
                                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                                    backgroundColor: config.intervalMinutes === p.value ? colors.primary : 'rgba(255,255,255,0.05)',
                                    color: config.intervalMinutes === p.value ? '#fff' : colors.textSecondary,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Custom */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="number"
                            min={1}
                            max={10080}
                            value={customInterval}
                            placeholder="Custom (minutes)…"
                            onChange={e => {
                                setCustomInterval(e.target.value);
                                const v = parseInt(e.target.value);
                                if (!isNaN(v) && v >= 1) update({ intervalMinutes: v });
                            }}
                            style={{ ...inputBase, maxWidth: '180px' }}
                        />
                        <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                            {intervalLabel(config.intervalMinutes)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages card */}
            <div style={card}>
                <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px', borderLeft: `3px solid ${colors.accent}` }}>
                    Messages ({config.messages.length}/50)
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: '12px', color: colors.textSecondary }}>
                    Messages cycle in order from top to bottom. Drag to reorder.
                </p>

                {/* Message list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {config.messages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px', color: colors.textTertiary, fontSize: '13px', border: `1px dashed ${colors.glassBorder}`, borderRadius: borderRadius.md }}>
                            No messages yet. Add one below.
                        </div>
                    )}
                    {config.messages.map((msg, idx) => (
                        <div
                            key={idx}
                            draggable
                            onDragStart={() => onDragStart(idx)}
                            onDragOver={e => onDragOver(e, idx)}
                            onDrop={() => onDrop(idx)}
                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                padding: '10px', borderRadius: borderRadius.sm,
                                backgroundColor: dragOverIdx === idx ? `${colors.primary}10` : 'rgba(255,255,255,0.025)',
                                border: `1px solid ${dragOverIdx === idx ? `${colors.primary}44` : colors.glassBorder}`,
                                transition: 'background 0.1s, border-color 0.1s',
                                opacity: dragIdx === idx ? 0.5 : 1,
                            }}
                        >
                            {/* Drag handle + index */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, paddingTop: '8px', cursor: 'grab' }}>
                                <GripVertical size={14} color={colors.textTertiary} />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: colors.textTertiary, minWidth: '16px', textAlign: 'right' }}>
                                    {idx + 1}
                                </span>
                            </div>

                            {/* Content textarea */}
                            <textarea
                                value={msg.content}
                                onChange={e => updateMessage(idx, e.target.value)}
                                rows={msg.content.split('\n').length + 1}
                                maxLength={2000}
                                style={{
                                    ...inputBase,
                                    flex: 1,
                                    resize: 'vertical',
                                    minHeight: '60px',
                                    fontFamily: 'inherit',
                                    lineHeight: 1.5,
                                }}
                            />

                            {/* Character count + delete */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0, paddingTop: '6px' }}>
                                <span style={{ fontSize: '9px', color: msg.content.length > 1800 ? '#ef4444' : colors.textTertiary }}>
                                    {msg.content.length}/2000
                                </span>
                                <button
                                    onClick={() => removeMessage(idx)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: '4px', borderRadius: '4px', display: 'flex' }}
                                    title="Remove message"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add new message */}
                {config.messages.length < 50 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <textarea
                            value={newMsgContent}
                            onChange={e => setNewMsgContent(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addMessage(); }}
                            placeholder="New message… (Ctrl+Enter to add)"
                            rows={3}
                            maxLength={2000}
                            style={{
                                ...inputBase,
                                flex: 1,
                                resize: 'vertical',
                                minHeight: '72px',
                                fontFamily: 'inherit',
                            }}
                        />
                        <button
                            onClick={addMessage}
                            disabled={!newMsgContent.trim()}
                            style={{
                                padding: '10px 16px', borderRadius: borderRadius.sm,
                                backgroundColor: newMsgContent.trim() ? colors.primary : 'rgba(255,255,255,0.05)',
                                color: newMsgContent.trim() ? '#fff' : colors.textTertiary,
                                border: 'none', cursor: newMsgContent.trim() ? 'pointer' : 'not-allowed',
                                fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                                flexShrink: 0, marginTop: '2px',
                            }}
                        >
                            <Plus size={16} /> Add
                        </button>
                    </div>
                )}
            </div>

            {/* Save bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                {isDirty && (
                    <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>You have unsaved changes.</p>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    style={{
                        marginLeft: 'auto',
                        padding: '11px 28px', borderRadius: borderRadius.md,
                        backgroundColor: isDirty ? colors.primary : 'rgba(255,255,255,0.05)',
                        color: isDirty ? '#fff' : colors.textTertiary,
                        border: 'none', cursor: isDirty ? 'pointer' : 'not-allowed',
                        fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    <Save size={16} />
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};
