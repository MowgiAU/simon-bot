import React, { useState, useEffect, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import {
    Zap, Plus, Trash2, ToggleLeft, ToggleRight, Save, AlertCircle,
    ChevronDown, ChevronUp, Pencil, Check, X, Code, AtSign,
    Code2, Palette, Eye,
} from 'lucide-react';

// â”€â”€â”€ Embed types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EmbedField { name: string; value: string; inline: boolean; }
interface EmbedData {
    title: string; description: string; url: string; color: string;
    fields: EmbedField[];
    authorName: string; authorIconUrl: string; authorUrl: string;
    footerText: string; footerIconUrl: string;
    thumbnailUrl: string; imageUrl: string;
    timestamp: boolean;
}
const defaultEmbed: EmbedData = {
    title: '', description: '', url: '', color: '#10B981', fields: [],
    authorName: '', authorIconUrl: '', authorUrl: '',
    footerText: '', footerIconUrl: '',
    thumbnailUrl: '', imageUrl: '', timestamp: false,
};

interface AutoResponderRule {
    id: string;
    guildId: string;
    name: string;
    trigger: string;
    triggerType: 'regex' | 'exact' | 'startsWith' | 'contains';
    response: string;
    embedJson: string | null;
    mentionUser: boolean;
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

const RESPONSE_TABS = [
    { key: 'text',  label: 'Text',  icon: Code2 },
    { key: 'embed', label: 'Embed', icon: Palette },
] as const;

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

const sectionTitle = (t: string) => (
    <div style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginTop: '18px', marginBottom: '8px' }}>{t}</div>
);

// â”€â”€â”€ Placeholder insert bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PlaceholderBar: React.FC<{ onInsert: (s: string) => void }> = ({ onInsert }) => {
    const tokens = [
        { label: '{user}',        val: '{user}',        title: '@mention author' },
        { label: '{mention}',     val: '{mention}',     title: '@mention alias' },
        { label: '{username}',    val: '{username}',    title: 'plain username' },
        { label: '{displayname}', val: '{displayname}', title: 'nickname/display name' },
        { label: '{channel}',     val: '{channel}',     title: '#channel mention' },
        { label: '{server}',      val: '{server}',      title: 'server name' },
        { label: '{match1}',      val: '{match1}',      title: 'regex capture group 1' },
    ];
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {tokens.map(t => (
                <button key={t.val} onClick={() => onInsert(t.val)} title={t.title}
                    style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${colors.glassBorder}`, color: colors.textSecondary,
                        fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}>
                    {t.label}
                </button>
            ))}
        </div>
    );
};

// â”€â”€â”€ Embed Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EmbedBuilder: React.FC<{ embed: EmbedData; onChange: (e: EmbedData) => void }> = ({ embed, onChange }) => {
    const upd = (p: Partial<EmbedData>) => onChange({ ...embed, ...p });
    const addField = () => upd({ fields: [...embed.fields, { name: '', value: '', inline: false }] });
    const removeField = (i: number) => upd({ fields: embed.fields.filter((_, idx) => idx !== i) });
    const updateField = (i: number, p: Partial<EmbedField>) => {
        const f = [...embed.fields]; f[i] = { ...f[i], ...p }; upd({ fields: f });
    };
    const inp: React.CSSProperties = { ...inputBase, marginBottom: '8px' };
    return (
        <div>
            {sectionTitle('Body')}
            <input style={inp} value={embed.title} onChange={e => upd({ title: e.target.value })} placeholder="Embed title" />
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '70px', fontFamily: 'inherit' }}
                value={embed.description} onChange={e => upd({ description: e.target.value })}
                placeholder="Description â€” supports markdown and placeholders" />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <input type="color" value={embed.color} onChange={e => upd({ color: e.target.value })}
                    style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
                <input style={{ ...inputBase, width: '110px', marginBottom: 0 }} value={embed.color}
                    onChange={e => upd({ color: e.target.value })} placeholder="#10B981" />
                {['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899'].map(c => (
                    <button key={c} onClick={() => upd({ color: c })}
                        style={{ width: 20, height: 20, borderRadius: '50%', background: c, flexShrink: 0,
                            border: embed.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
            </div>

            {sectionTitle('Author')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={inp} value={embed.authorName} onChange={e => upd({ authorName: e.target.value })} placeholder="Author name" />
                <input style={inp} value={embed.authorUrl} onChange={e => upd({ authorUrl: e.target.value })} placeholder="Author URL" />
            </div>
            <input style={inp} value={embed.authorIconUrl} onChange={e => upd({ authorIconUrl: e.target.value })} placeholder="Author icon URL" />

            {sectionTitle('Images')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={inp} value={embed.thumbnailUrl} onChange={e => upd({ thumbnailUrl: e.target.value })} placeholder="Thumbnail URL" />
                <input style={inp} value={embed.imageUrl} onChange={e => upd({ imageUrl: e.target.value })} placeholder="Large image URL" />
            </div>

            {sectionTitle('Fields')}
            {embed.fields.map((field, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm,
                    padding: '10px', border: `1px solid ${colors.glassBorder}`, marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: colors.textTertiary }}>Field {i + 1}</span>
                        <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, display: 'flex' }}><Trash2 size={13} /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                        <input style={{ ...inputBase, marginBottom: 0 }} value={field.name}
                            onChange={e => updateField(i, { name: e.target.value })} placeholder="Name" />
                        <input style={{ ...inputBase, marginBottom: 0 }} value={field.value}
                            onChange={e => updateField(i, { value: e.target.value })} placeholder="Value" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary, cursor: 'pointer' }}>
                        <input type="checkbox" checked={field.inline} onChange={e => updateField(i, { inline: e.target.checked })} /> Inline
                    </label>
                </div>
            ))}
            {embed.fields.length < 25 && (
                <button onClick={addField} style={{ padding: '6px 14px', borderRadius: borderRadius.sm,
                    backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.glassBorder}`,
                    color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Plus size={12} /> Add Field
                </button>
            )}

            {sectionTitle('Footer')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={inp} value={embed.footerText} onChange={e => upd({ footerText: e.target.value })} placeholder="Footer text" />
                <input style={inp} value={embed.footerIconUrl} onChange={e => upd({ footerIconUrl: e.target.value })} placeholder="Footer icon URL" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary, cursor: 'pointer', marginBottom: '8px' }}>
                <input type="checkbox" checked={embed.timestamp} onChange={e => upd({ timestamp: e.target.checked })} /> Include timestamp
            </label>
        </div>
    );
};

// â”€â”€â”€ Embed Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EmbedPreview: React.FC<{ embed: EmbedData }> = ({ embed }) => {
    const hasContent = embed.title || embed.description || embed.authorName || embed.footerText || embed.fields.length > 0 || embed.imageUrl || embed.thumbnailUrl;
    if (!hasContent) return (
        <div style={{ color: colors.textTertiary, textAlign: 'center', padding: '24px', fontSize: '12px', border: `1px dashed ${colors.glassBorder}`, borderRadius: borderRadius.sm }}>
            Embed preview will appear here
        </div>
    );
    return (
        <div style={{ borderLeft: `4px solid ${embed.color || colors.primary}`, background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '12px 16px', maxWidth: '480px' }}>
            {embed.authorName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    {embed.authorIconUrl && <img src={embed.authorIconUrl} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textPrimary }}>{embed.authorName}</span>
                </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                    {embed.title && <div style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '15px', marginBottom: '4px' }}>{embed.title}</div>}
                    {embed.description && <div style={{ color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{embed.description}</div>}
                    {embed.fields.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '8px' }}>
                            {embed.fields.map((f, i) => (
                                <div key={i} style={{ gridColumn: f.inline ? 'span 1' : '1/-1' }}>
                                    {f.name && <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textPrimary }}>{f.name}</div>}
                                    {f.value && <div style={{ fontSize: '12px', color: colors.textSecondary }}>{f.value}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {embed.thumbnailUrl && <img src={embed.thumbnailUrl} alt="" style={{ width: 70, height: 70, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
            </div>
            {embed.imageUrl && <img src={embed.imageUrl} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: '4px', marginTop: '8px' }} />}
            {(embed.footerText || embed.timestamp) && (
                <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '8px' }}>
                    {embed.footerText}{embed.footerText && embed.timestamp && ' â€¢ '}{embed.timestamp && new Date().toLocaleString()}
                </div>
            )}
        </div>
    );
};

// â”€â”€â”€ Rule Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RuleCardProps {
    rule: AutoResponderRule;
    guildId: string;
    onUpdated: (r: AutoResponderRule) => void;
    onDeleted: (id: string) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, guildId, onUpdated, onDeleted }) => {
    const [expanded, setExpanded] = useState(!rule.trigger);
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(rule.name);
    const [draft, setDraft] = useState<AutoResponderRule>({ ...rule });
    const [embedDraft, setEmbedDraft] = useState<EmbedData>(() => {
        if (rule.embedJson) { try { return { ...defaultEmbed, ...JSON.parse(rule.embedJson) }; } catch {} }
        return { ...defaultEmbed };
    });
    const [responseTab, setResponseTab] = useState<'text' | 'embed'>(rule.embedJson ? 'embed' : 'text');
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [regexError, setRegexError] = useState<string | null>(null);
    const responseRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);
    useEffect(() => {
        setDraft({ ...rule });
        setNameInput(rule.name);
        if (rule.embedJson) {
            try { setEmbedDraft({ ...defaultEmbed, ...JSON.parse(rule.embedJson) }); } catch { setEmbedDraft({ ...defaultEmbed }); }
        } else {
            setEmbedDraft({ ...defaultEmbed });
        }
        setResponseTab(rule.embedJson ? 'embed' : 'text');
        setIsDirty(false);
    }, [rule.id]);

    const update = (patch: Partial<AutoResponderRule>) => {
        setDraft(prev => ({ ...prev, ...patch }));
        setIsDirty(true);
        if (patch.trigger !== undefined || patch.triggerType !== undefined) {
            const type = patch.triggerType ?? draft.triggerType;
            const trigger = patch.trigger ?? draft.trigger;
            if (type === 'regex' && trigger) {
                const sanitized = trigger.replace(/^\(\?[imsxUu-]+\)/g, '');
                try { new RegExp(sanitized); setRegexError(null); } catch (e: any) { setRegexError(e.message); }
            } else { setRegexError(null); }
        }
    };

    const updateEmbed = (e: EmbedData) => { setEmbedDraft(e); setIsDirty(true); };

    const insertPlaceholder = (token: string) => {
        const el = responseRef.current;
        if (!el) { update({ response: draft.response + token }); return; }
        const start = el.selectionStart ?? draft.response.length;
        const end = el.selectionEnd ?? draft.response.length;
        const next = draft.response.slice(0, start) + token + draft.response.slice(end);
        update({ response: next });
        setTimeout(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }, 0);
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
            const hasEmbed = responseTab === 'embed' && (
                embedDraft.title || embedDraft.description || embedDraft.authorName ||
                embedDraft.imageUrl || embedDraft.thumbnailUrl || embedDraft.fields.length > 0 || embedDraft.footerText
            );
            const res = await fetch(`/api/auto-responder/${guildId}/${draft.id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name,
                    trigger: draft.trigger,
                    triggerType: draft.triggerType,
                    response: draft.response,
                    embedJson: hasEmbed ? embedDraft : null,
                    mentionUser: draft.mentionUser,
                    enabled: draft.enabled,
                    allowedChannels: parseChannels(draft.allowedChannels),
                    ignoredChannels: parseChannels(draft.ignoredChannels),
                    cooldownSeconds: draft.cooldownSeconds,
                }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
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
            {/* Header row */}
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
                    <span style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '2px 8px' }}>
                        <Code size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{triggerLabel}
                    </span>
                    {draft.trigger && (
                        <span style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '2px 8px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {draft.trigger}
                        </span>
                    )}
                    {draft.embedJson && (
                        <span style={{ fontSize: '10px', color: colors.primary, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '999px', padding: '2px 8px' }}>
                            embed
                        </span>
                    )}
                    <span style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '2px 8px' }}>
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

                    {/* Trigger */}
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <span style={labelStyle}>Trigger Type</span>
                            <select value={draft.triggerType} onChange={e => update({ triggerType: e.target.value as any })}
                                style={{ ...inputBase, backgroundColor: 'rgba(255,255,255,0.08)', color: colors.textPrimary, cursor: 'pointer' }}>
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

                    {/* Mention user toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}` }}>
                        <AtSign size={16} color={draft.mentionUser ? colors.primary : colors.textTertiary} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>Mention User</div>
                            <div style={{ fontSize: '11px', color: colors.textTertiary }}>Prepend an @mention to the response (alias: use {'{mention}'} in text)</div>
                        </div>
                        <button onClick={() => update({ mentionUser: !draft.mentionUser })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            {draft.mentionUser ? <ToggleRight size={26} color={colors.primary} /> : <ToggleLeft size={26} color={colors.textTertiary} />}
                        </button>
                    </div>

                    {/* Response: Text / Embed tabs */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: borderRadius.sm, padding: '3px', width: 'fit-content' }}>
                            {RESPONSE_TABS.map(({ key, label, icon: Icon }) => (
                                <button key={key} onClick={() => { setResponseTab(key); setIsDirty(true); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                        background: responseTab === key ? colors.primary : 'transparent',
                                        color: responseTab === key ? '#fff' : colors.textSecondary,
                                        fontWeight: 600, fontSize: '12px', transition: 'all .15s' }}>
                                    <Icon size={13} /> {label}
                                </button>
                            ))}
                        </div>

                        {responseTab === 'text' && (
                            <div>
                                <span style={labelStyle}>Response Text (2000 char max)</span>
                                <textarea ref={responseRef} value={draft.response}
                                    onChange={e => update({ response: e.target.value })}
                                    placeholder="Type the bot's response..."
                                    rows={4} maxLength={2000}
                                    style={{ ...inputBase, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit', lineHeight: 1.5 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4px', flexWrap: 'wrap', gap: '6px' }}>
                                    <PlaceholderBar onInsert={insertPlaceholder} />
                                    <span style={{ fontSize: '10px', color: draft.response.length > 1800 ? '#ef4444' : colors.textTertiary, flexShrink: 0 }}>
                                        {draft.response.length}/2000
                                    </span>
                                </div>
                            </div>
                        )}

                        {responseTab === 'embed' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <span style={labelStyle}>Text above embed (optional)</span>
                                    <textarea ref={responseRef} value={draft.response}
                                        onChange={e => update({ response: e.target.value })}
                                        placeholder="Optional text before the embed..."
                                        rows={2} maxLength={2000}
                                        style={{ ...inputBase, resize: 'vertical', minHeight: '50px', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: '6px' }} />
                                    <PlaceholderBar onInsert={insertPlaceholder} />
                                    <EmbedBuilder embed={embedDraft} onChange={updateEmbed} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <Eye size={12} color={colors.textTertiary} />
                                        <span style={labelStyle as React.CSSProperties}>Preview</span>
                                    </div>
                                    {draft.response && (
                                        <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px', padding: '6px 10px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                                            {draft.response}
                                        </div>
                                    )}
                                    <EmbedPreview embed={embedDraft} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Channel filters */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <span style={labelStyle}>Allowed Channels (empty = all)</span>
                            <ChannelSelect
                                guildId={guildId}
                                value={parseChannels(draft.allowedChannels)}
                                onChange={v => { const a = Array.isArray(v) ? v : v ? [v] : []; update({ allowedChannels: a.length ? JSON.stringify(a) : null }); }}
                                placeholder="All channels..."
                                multiple
                            />
                        </div>
                        <div>
                            <span style={labelStyle}>Ignored Channels</span>
                            <ChannelSelect
                                guildId={guildId}
                                value={parseChannels(draft.ignoredChannels)}
                                onChange={v => { const a = Array.isArray(v) ? v : v ? [v] : []; update({ ignoredChannels: a.length ? JSON.stringify(a) : null }); }}
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

                    {/* Footer buttons */}
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

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                setLoading(true); setError(null);
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
        } catch (e: any) { setError(e.message); }
        finally { setCreating(false); }
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1100px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Zap size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Auto Responder</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>YAGPDB-style regex commands â€” matches messages and auto-replies</p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Create rules that automatically respond when a message matches a trigger.
                    Use the <strong>Text</strong> tab for plain replies or the <strong>Embed</strong> tab for rich embeds.
                    Click any <strong>placeholder</strong> button to insert it at your cursor.
                    Enable <strong>Mention User</strong> to prepend an @mention (or use <code style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{'{mention}'}</code> anywhere in text).
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
                        <RuleCard key={r.id} rule={r} guildId={guildId || ''}
                            onUpdated={u => setRules(prev => prev.map(x => x.id === u.id ? u : x))}
                            onDeleted={id => setRules(prev => prev.filter(x => x.id !== id))} />
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

