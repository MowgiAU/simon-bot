import React, { useState, useEffect, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import {
    Sparkles, Save, AlertCircle, ToggleLeft, ToggleRight,
    Plus, Trash2, Eye, Palette, Code2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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
    title: '', description: '', url: '', color: '#F59E0B', fields: [],
    authorName: '', authorIconUrl: '', authorUrl: '',
    footerText: '', footerIconUrl: '',
    thumbnailUrl: '', imageUrl: '', timestamp: false,
};

interface BoostSettings {
    guildId?: string;
    enabled: boolean;
    announcementChannelId: string | null;
    messageText: string | null;
    embedJson: string | null;
    reactionEmoji: string | null;
    rewardRoleId: string | null;
}

const RESPONSE_TABS = [
    { key: 'text',  label: 'Text',  icon: Code2 },
    { key: 'embed', label: 'Embed', icon: Palette },
] as const;

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.sm,
    padding: '9px 12px', color: colors.textPrimary, fontSize: '13px', outline: 'none',
};
const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: colors.textSecondary,
    marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em',
};
const sectionTitle = (t: string) => (
    <div style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '18px', marginBottom: '8px' }}>{t}</div>
);

// ─── Placeholder bar ──────────────────────────────────────────────────────────

const PlaceholderBar: React.FC<{ onInsert: (s: string) => void }> = ({ onInsert }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {[
            { label: '{mention}', title: '@mention the booster' },
            { label: '{user}',    title: '@mention alias' },
            { label: '{boostCount}', title: 'current boost count' },
        ].map(t => (
            <button key={t.label} onClick={() => onInsert(t.label)} title={t.title}
                style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${colors.glassBorder}`, color: colors.textSecondary,
                    fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}>
                {t.label}
            </button>
        ))}
    </div>
);

// ─── Embed Builder ────────────────────────────────────────────────────────────

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
                placeholder="Description — supports {mention} {user} {boostCount}" />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <input type="color" value={embed.color} onChange={e => upd({ color: e.target.value })}
                    style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
                <input style={{ ...inputBase, width: '110px', marginBottom: 0 }} value={embed.color}
                    onChange={e => upd({ color: e.target.value })} placeholder="#F59E0B" />
                {['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#EC4899','#FFFFFF'].map(c => (
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

// ─── Embed Preview ────────────────────────────────────────────────────────────

const EmbedPreview: React.FC<{ embed: EmbedData }> = ({ embed }) => {
    const hasContent = embed.title || embed.description || embed.authorName || embed.footerText || embed.fields.length > 0 || embed.imageUrl || embed.thumbnailUrl;
    if (!hasContent) return (
        <div style={{ color: colors.textTertiary, textAlign: 'center', padding: '24px', fontSize: '12px', border: `1px dashed ${colors.glassBorder}`, borderRadius: borderRadius.sm }}>
            Embed preview will appear here
        </div>
    );
    return (
        <div style={{ borderLeft: `4px solid ${embed.color || '#F59E0B'}`, background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '12px 16px' }}>
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
                    {embed.footerText}{embed.footerText && embed.timestamp && ' • '}{embed.timestamp && new Date().toLocaleString()}
                </div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ServerBoostPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [settings, setSettings] = useState<BoostSettings>({
        enabled: true, announcementChannelId: null, messageText: null,
        embedJson: null, reactionEmoji: null, rewardRoleId: null,
    });
    const [embedDraft, setEmbedDraft] = useState<EmbedData>({ ...defaultEmbed });
    const [responseTab, setResponseTab] = useState<'text' | 'embed'>('text');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        fetch(`/api/server-boost/${guildId}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((data: BoostSettings) => {
                setSettings(data);
                if (data.embedJson) {
                    try { setEmbedDraft({ ...defaultEmbed, ...JSON.parse(data.embedJson) }); } catch {}
                    setResponseTab('embed');
                } else {
                    setResponseTab('text');
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [guildId]);

    const update = (patch: Partial<BoostSettings>) => { setSettings(p => ({ ...p, ...patch })); setIsDirty(true); };

    const insertPlaceholder = (token: string) => {
        const el = textRef.current;
        const text = settings.messageText || '';
        if (!el) { update({ messageText: text + token }); return; }
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        update({ messageText: text.slice(0, start) + token + text.slice(end) });
        setTimeout(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }, 0);
    };

    const handleSave = async () => {
        if (!guildId) return;
        setSaving(true);
        try {
            const hasEmbed = responseTab === 'embed' && (
                embedDraft.title || embedDraft.description || embedDraft.authorName ||
                embedDraft.imageUrl || embedDraft.thumbnailUrl || embedDraft.fields.length > 0 || embedDraft.footerText
            );
            const res = await fetch(`/api/server-boost/${guildId}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: settings.enabled,
                    announcementChannelId: settings.announcementChannelId,
                    messageText: settings.messageText,
                    embedJson: hasEmbed ? embedDraft : null,
                    reactionEmoji: settings.reactionEmoji,
                    rewardRoleId: settings.rewardRoleId,
                }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
            const saved = await res.json();
            setSettings(saved);
            setIsDirty(false);
            setMsg({ type: 'success', text: 'Settings saved!' });
        } catch (e: any) {
            setMsg({ type: 'error', text: e.message || 'Save failed.' });
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div style={{ padding: '32px', textAlign: 'center', color: colors.textTertiary }}>Loading...</div>
    );

    return (
        <div style={{ padding: '32px', maxWidth: '1000px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Sparkles size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Server Boost</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Celebrate every boost with a custom announcement, reaction, and role reward
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    When a member boosts the server, Fuji Studio reacts to their Discord boost notification,
                    posts a celebration message in the configured channel, and optionally awards a role.
                    The role is automatically removed when they stop boosting.
                    Use <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{'{mention}'}</code> or{' '}
                    <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{'{boostCount}'}</code> to personalise the message.
                </p>
            </div>

            {msg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: borderRadius.sm, marginBottom: '16px',
                    backgroundColor: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: msg.type === 'success' ? colors.primary : '#ef4444', fontSize: '13px', fontWeight: 600 }}>
                    <AlertCircle size={14} /> {msg.text}
                </div>
            )}

            {/* Enabled toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', backgroundColor: colors.surface, borderRadius: borderRadius.md, border: `1px solid ${colors.glassBorder}`, marginBottom: '16px' }}>
                <button onClick={() => update({ enabled: !settings.enabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    {settings.enabled ? <ToggleRight size={28} color={colors.primary} /> : <ToggleLeft size={28} color={colors.textTertiary} />}
                </button>
                <div>
                    <div style={{ fontWeight: 700, color: colors.textPrimary }}>Plugin Enabled</div>
                    <div style={{ fontSize: '12px', color: colors.textTertiary }}>
                        {settings.enabled ? 'Active — boost events will be handled' : 'Disabled — boost events ignored'}
                    </div>
                </div>
            </div>

            {/* Settings card */}
            <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}`, padding: '20px' }}>

                {/* Announcement channel */}
                <div style={{ marginBottom: '20px' }}>
                    <span style={labelStyle}>Announcement Channel</span>
                    <ChannelSelect guildId={guildId || ''} value={settings.announcementChannelId || ''}
                        onChange={v => update({ announcementChannelId: (Array.isArray(v) ? v[0] : v) || null })}
                        placeholder="Pick a channel..." />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textTertiary }}>
                        The bot will post the celebration message here
                    </p>
                </div>

                {/* Reaction emoji */}
                <div style={{ marginBottom: '20px' }}>
                    <span style={labelStyle}>Reaction Emoji</span>
                    <input value={settings.reactionEmoji || ''} onChange={e => update({ reactionEmoji: e.target.value || null })}
                        placeholder="e.g. ❤️ or a custom emoji name" maxLength={100}
                        style={{ ...inputBase, maxWidth: '260px' }} />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textTertiary }}>
                        React to the boost system message with this emoji. Leave blank to skip.
                    </p>
                </div>

                {/* Reward role */}
                <div style={{ marginBottom: '24px' }}>
                    <span style={labelStyle}>Reward Role ID</span>
                    <input value={settings.rewardRoleId || ''} onChange={e => update({ rewardRoleId: e.target.value || null })}
                        placeholder="Discord Role ID" maxLength={30}
                        style={{ ...inputBase, maxWidth: '260px', fontFamily: 'monospace' }} />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textTertiary }}>
                        Role given to boosters, removed automatically when they stop boosting.
                    </p>
                </div>

                {/* Message / Embed tabs */}
                <div>
                    <span style={labelStyle}>Celebration Message</span>
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
                            <textarea ref={textRef} value={settings.messageText || ''}
                                onChange={e => update({ messageText: e.target.value || null })}
                                placeholder="{mention} just boosted the server! 🎉 We now have {boostCount} boosts!"
                                rows={4} maxLength={2000}
                                style={{ ...inputBase, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit', lineHeight: 1.5 }} />
                            <PlaceholderBar onInsert={insertPlaceholder} />
                        </div>
                    )}

                    {responseTab === 'embed' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <span style={labelStyle}>Text above embed (optional)</span>
                                <textarea ref={textRef} value={settings.messageText || ''}
                                    onChange={e => update({ messageText: e.target.value || null })}
                                    placeholder="Optional text before the embed..."
                                    rows={2} maxLength={2000}
                                    style={{ ...inputBase, resize: 'vertical', minHeight: '48px', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: '6px' }} />
                                <PlaceholderBar onInsert={insertPlaceholder} />
                                <EmbedBuilder embed={embedDraft} onChange={e => { setEmbedDraft(e); setIsDirty(true); }} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <Eye size={12} color={colors.textTertiary} />
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</span>
                                </div>
                                {settings.messageText && (
                                    <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px', padding: '6px 10px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                                        {settings.messageText}
                                    </div>
                                )}
                                <EmbedPreview embed={embedDraft} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save button */}
            {isDirty && (
                <div style={{ marginTop: '20px' }}>
                    <button onClick={handleSave} disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: borderRadius.md, backgroundColor: colors.primary, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: saving ? 0.7 : 1 }}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}
        </div>
    );
};
