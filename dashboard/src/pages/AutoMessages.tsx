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
