import React, { useState, useEffect, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import {
    Zap, Plus, Trash2, ToggleLeft, ToggleRight, Save, AlertCircle,
    ChevronDown, ChevronUp, Pencil, Check, X, Code, Hash,
} from 'lucide-react';

interface AutoResponderRule {
    id: string;
    guildId: string;
    name: string;
    trigger: string;
    triggerType: 'regex' | 'exact' | 'startsWith' | 'contains';
    response: string;
    enabled: boolean;
    allowedChannels: string | null;
    ignoredChannels: string | null;
    cooldownSeconds: number;
    matchCount: number;
    lastTriggeredAt: string | null;
}

const TRIGGER_TYPES: { value: string; label: string; desc: string }[] = [
    { value: 'regex', label: 'Regex', desc: 'Regular expression (case-insensitive)' },
    { value: 'exact', label: 'Exact', desc: 'Must match the full message exactly' },
    { value: 'startsWith', label: 'Starts With', desc: 'Message begins with this text' },
    { value: 'contains', label: 'Contains', desc: 'Message includes this text anywhere' },
];

const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    marginBottom: '12px',
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
    fontSize: '13px',
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

// -- Rule card component --

interface RuleCardProps {
    rule: AutoResponderRule;
    guildId: string;
    onUpdated: (r: AutoResponderRule) => void;
    onDeleted: (id: string) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, guildId, onUpdated, onDeleted }) => {
    const [expanded, setExpanded] = useState(!rule.trigger); // auto-expand new empty rules
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(rule.name);
    const [draft, setDraft] = useState<AutoResponderRule>({ ...rule });
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [regexError, setRegexError] = useState<string | null>(null);

    useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);
    useEffect(() => {
        setDraft({ ...rule });
        setNameInput(rule.name);
        setIsDirty(false);
    }, [rule.id]);

    const update = (patch: Partial<AutoResponderRule>) => {
        setDraft(prev => ({ ...prev, ...patch }));
        setIsDirty(true);

        // Live regex validation
        if (patch.trigger !== undefined || patch.triggerType !== undefined) {
            const type = patch.triggerType ?? draft.triggerType;
            const trigger = patch.trigger ?? draft.trigger;
            if (type === 'regex' && trigger) {
                try { new RegExp(trigger); setRegexError(null); } catch (e: any) { setRegexError(e.message); }
            } else {
                setRegexError(null);
            }
        }
    };

    const saveName = () => {
        const trimmed = nameInput.trim() || 'New Rule';
        update({ name: trimmed });
        setEditingName(false);
    };

    const parseChannels = (raw: string | null): string[] => {
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/auto-responder/${guildId}/${draft.id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name,
                    trigger: draft.trigger,
                    triggerType: draft.triggerType,
                    response: draft.response,
                    enabled: draft.enabled,
                    allowedChannels: parseChannels(draft.allowedChannels),
                    ignoredChannels: parseChannels(draft.ignoredChannels),
                    cooldownSeconds: draft.cooldownSeconds,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Save failed');
            }
            const updated: AutoResponderRule = await res.json();
            onUpdated(updated);
            setIsDirty(false);
            setMsg({ type: 'success', text: 'Saved!' });
        } catch (e: any) {
            setMsg({ type: 'error', text: e.message || 'Save failed.' });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete rule "${draft.name}"?`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/auto-responder/${guildId}/${draft.id}`, { method: 'DELETE', credentials: 'include' });
            if (!res.ok) throw new Error();
            onDeleted(draft.id);
        } catch { setMsg({ type: 'error', text: 'Failed to delete.' }); setDeleting(false); }
    };

    const handleToggle = async () => {
        const next = !draft.enabled;
        update({ enabled: next });
        try {
            const res = await fetch(`/api/auto-responder/${guildId}/${draft.id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            });
            if (!res.ok) throw new Error();
            const updated: AutoResponderRule = await res.json();
            onUpdated(updated);
            setIsDirty(false);
        } catch { update({ enabled: !next }); }
    };

    const triggerLabel = TRIGGER_TYPES.find(t => t.value === draft.triggerType)?.label || draft.triggerType;

    return (
        <div style={card}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                <button onClick={e => { e.stopPropagation(); handleToggle(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex' }}
                    title={draft.enabled ? 'Disable' : 'Enable'}>
                    {draft.enabled ? <ToggleRight size={28} color={colors.primary} /> : <ToggleLeft size={28} color={colors.textTertiary} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }} onClick={() => setExpanded(e => !e)}>
                    {editingName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameInput(draft.name); setEditingName(false); } }}
                                autoFocus maxLength={100} style={{ ...inputBase, width: '200px', padding: '4px 8px' }} />
                            <button onClick={saveName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, display: 'flex' }}><Check size={15} /></button>
                            <button onClick={() => { setNameInput(draft.name); setEditingName(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}><X size={15} /></button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.name}</span>
                            <button onClick={e => { e.stopPropagation(); setEditingName(true); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 0, display: 'flex', flexShrink: 0 }}><Pencil size={11} /></button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={() => setExpanded(e => !e)}>
                    <span style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.pill, padding: '2px 8px' }}>
                        <Code size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{triggerLabel}
                    </span>
                    {draft.trigger && (
                        <span style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.pill, padding: '2px 8px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {draft.trigger}
                        </span>
                    )}
                    <span style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.pill, padding: '2px 8px' }}>
                        {draft.matchCount} hit{draft.matchCount !== 1 ? 's' : ''}
                    </span>
                    {expanded ? <ChevronUp size={15} color={colors.textTertiary} /> : <ChevronDown size={15} color={colors.textTertiary} />}
                </div>
            </div>

            {msg && (
                <div style={{ margin: '0 16px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: msg.type === 'success' ? colors.primary : '#ef4444' }}>
                    <AlertCircle size={12} /> {msg.text}
                </div>
            )}

            {/* Editor */}
            {expanded && (
                <div style={{ borderTop: `1px solid ${colors.glassBorder}`, padding: '18px 16px' }}>
                    {/* Trigger type + trigger input */}
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <span style={labelStyle}>Trigger Type</span>
                            <select value={draft.triggerType} onChange={e => update({ triggerType: e.target.value as any })}
                                style={{ ...inputBase, cursor: 'pointer', appearance: 'auto' }}>
                                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <p style={{ margin: '4px 0 0', fontSize: '10px', color: colors.textTertiary }}>
                                {TRIGGER_TYPES.find(t => t.value === draft.triggerType)?.desc}
                            </p>
                        </div>
                        <div>
                            <span style={labelStyle}>Trigger {draft.triggerType === 'regex' ? 'Pattern' : 'Text'}</span>
                            <input value={draft.trigger} onChange={e => update({ trigger: e.target.value })}
                                placeholder={draft.triggerType === 'regex' ? '^!hello\\b(.*)' : 'Type trigger text...'}
                                maxLength={500}
                                style={{ ...inputBase, fontFamily: draft.triggerType === 'regex' ? 'monospace' : 'inherit', borderColor: regexError ? '#ef4444' : colors.glassBorder }} />
                            {regexError && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#ef4444' }}>{regexError}</p>}
                        </div>
                    </div>

                    {/* Response */}
                    <div style={{ marginBottom: '16px' }}>
                        <span style={labelStyle}>Response (2000 char max)</span>
                        <textarea value={draft.response} onChange={e => update({ response: e.target.value })}
                            placeholder="Type the bot's response... Use {user} {username} {displayname} {channel} {server} {match1} etc."
                            rows={4} maxLength={2000}
                            style={{ ...inputBase, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit', lineHeight: 1.5 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <p style={{ margin: 0, fontSize: '10px', color: colors.textTertiary }}>
                                Placeholders: {'{user}'} {'{username}'} {'{displayname}'} {'{channel}'} {'{server}'} {'{match1}'} {'{match2}'} ...
                            </p>
                            <span style={{ fontSize: '10px', color: draft.response.length > 1800 ? '#ef4444' : colors.textTertiary }}>
                                {draft.response.length}/2000
                            </span>
                        </div>
                    </div>

                    {/* Channel filters + cooldown */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <span style={labelStyle}>Allowed Channels (empty = all)</span>
                            <ChannelSelect
                                guildId={guildId}
                                value={parseChannels(draft.allowedChannels)}
                                onChange={v => {
                                    const arr = Array.isArray(v) ? v : v ? [v] : [];
                                    update({ allowedChannels: arr.length ? JSON.stringify(arr) : null });
                                }}
                                placeholder="All channels..."
                                multiple
                            />
                        </div>
                        <div>
                            <span style={labelStyle}>Ignored Channels</span>
                            <ChannelSelect
                                guildId={guildId}
                                value={parseChannels(draft.ignoredChannels)}
                                onChange={v => {
                                    const arr = Array.isArray(v) ? v : v ? [v] : [];
                                    update({ ignoredChannels: arr.length ? JSON.stringify(arr) : null });
                                }}
                                placeholder="None..."
                                multiple
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <span style={labelStyle}>Cooldown (seconds, 0 = none)</span>
                        <input type="number" min={0} max={86400} value={draft.cooldownSeconds}
                            onChange={e => update({ cooldownSeconds: parseInt(e.target.value) || 0 })}
                            style={{ ...inputBase, maxWidth: '160px' }} />
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <button onClick={handleDelete} disabled={deleting}
                            style={{ padding: '7px 14px', borderRadius: borderRadius.sm, backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', opacity: deleting ? 0.6 : 1 }}>
                            <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
                        </button>

                        {isDirty && (
                            <button onClick={handleSave} disabled={saving || !!regexError}
                                style={{ padding: '8px 20px', borderRadius: borderRadius.sm, backgroundColor: regexError ? 'rgba(255,255,255,0.05)' : colors.primary, color: regexError ? colors.textTertiary : '#fff', border: 'none', cursor: saving || regexError ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
                                <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// -- Main page --

export const AutoResponderPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [rules, setRules] = useState<AutoResponderRule[]>([]);
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
                const res = await fetch(`/api/auto-responder/${guildId}`, { credentials: 'include', signal: controller.signal });
                if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || d.error || `HTTP ${res.status}`); }
                setRules(await res.json());
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message || 'Failed to load.');
            } finally { setLoading(false); }
        }, 300);

        return () => { clearTimeout(tid); controller.abort(); };
    }, [guildId]);

    const handleCreate = async () => {
        if (!guildId) return;
        setCreating(true);
        try {
            const res = await fetch(`/api/auto-responder/${guildId}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Rule ${rules.length + 1}` }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || d.error || 'Failed'); }
            const r: AutoResponderRule = await res.json();
            setRules(prev => [...prev, r]);
        } catch (e: any) {
            setError(e.message);
        } finally { setCreating(false); }
    };

    const handleUpdated = (updated: AutoResponderRule) =>
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    const handleDeleted = (id: string) =>
        setRules(prev => prev.filter(r => r.id !== id));

    return (
        <div style={{ padding: '32px', maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Zap size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Auto Responder</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Regex-powered custom commands - matches messages and auto-replies
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Create rules that automatically respond when a message matches a trigger.
                    Supports <strong>Regex</strong>, <strong>Exact</strong>, <strong>Starts With</strong>, and <strong>Contains</strong> matching.
                    Use placeholders like <code style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>{'{{user}}'}</code> or <code style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>{'{{match1}}'}</code> in responses.
                    Only the first matching rule fires per message.
                </p>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: '12px 16px', marginBottom: '16px', color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: colors.textTertiary, fontSize: '13px' }}>Loading rules...</div>
            ) : (
                <>
                    {rules.length === 0 && !error && (
                        <div style={{ textAlign: 'center', padding: '48px 24px', color: colors.textSecondary, fontSize: '14px', backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px dashed ${colors.glassBorder}`, marginBottom: '16px' }}>
                            <Zap size={32} color={colors.textTertiary} style={{ marginBottom: '12px' }} />
                            <div>No rules yet. Create one to get started.</div>
                        </div>
                    )}
                    {rules.map(r => (
                        <RuleCard key={r.id} rule={r} guildId={guildId || ''} onUpdated={handleUpdated} onDeleted={handleDeleted} />
                    ))}
                </>
            )}

            <button onClick={handleCreate} disabled={creating || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: borderRadius.md, backgroundColor: colors.primary, color: '#fff', border: 'none', cursor: creating || loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: creating ? 0.7 : 1, marginTop: '8px' }}>
                <Plus size={16} /> {creating ? 'Creating...' : 'Add Rule'}
            </button>
        </div>
    );
};
