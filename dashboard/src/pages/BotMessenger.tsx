import React, { useState, useEffect, useRef, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
    Send,
    MessageSquare,
    Code2,
    Smile,
    Reply,
    X,
    Plus,
    Trash2,
    ChevronDown,
    RefreshCw,
    Image,
    Palette,
    Sticker,
    Eye,
    Upload,
    Loader,
    Hash,
    SmilePlus,
} from 'lucide-react';

const API = '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DiscordMessage {
    id: string;
    content: string;
    author: { id: string; username: string; avatar: string; bot?: boolean; global_name?: string };
    timestamp: string;
    embeds?: any[];
    attachments?: any[];
    referenced_message?: DiscordMessage | null;
    sticker_items?: { id: string; name: string; format_type: number }[];
}

interface DiscordEmoji {
    id: string;
    name: string;
    animated: boolean;
}

interface DiscordSticker {
    id: string;
    name: string;
    description: string;
    format_type: number;
}

interface EmbedField {
    name: string;
    value: string;
    inline: boolean;
}

interface EmbedData {
    title: string;
    description: string;
    url: string;
    color: string;
    fields: EmbedField[];
    authorName: string;
    authorIconUrl: string;
    authorUrl: string;
    footerText: string;
    footerIconUrl: string;
    thumbnailUrl: string;
    imageUrl: string;
    timestamp: boolean;
}

const defaultEmbed: EmbedData = {
    title: '',
    description: '',
    url: '',
    color: '#10B981',
    fields: [],
    authorName: '',
    authorIconUrl: '',
    authorUrl: '',
    footerText: '',
    footerIconUrl: '',
    thumbnailUrl: '',
    imageUrl: '',
    timestamp: false,
};

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
    background: colors.cardBg,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.sm,
    color: colors.textPrimary,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
    background: colors.primary,
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
};

const btnSecondary: React.CSSProperties = {
    background: colors.surfaceLight,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    padding: '8px 16px',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    color: colors.textSecondary,
    fontSize: '13px',
    fontWeight: 500,
};

// ---------------------------------------------------------------------------
// React Picker — compact emoji picker anchored to a message
// ---------------------------------------------------------------------------
const ReactPicker: React.FC<{
    guildId: string;
    onSelect: (emoji: string) => void;
    onClose: () => void;
}> = ({ guildId, onSelect, onClose }) => {
    const [tab, setTab] = useState<'standard' | 'custom'>('standard');
    const [customEmojis, setCustomEmojis] = useState<DiscordEmoji[]>([]);
    const [loadingEmoji, setLoadingEmoji] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    useEffect(() => {
        if (tab === 'custom' && customEmojis.length === 0) {
            setLoadingEmoji(true);
            axios.get(`${API}/api/guilds/${guildId}/emojis`, { withCredentials: true })
                .then(r => setCustomEmojis(r.data))
                .catch(() => {})
                .finally(() => setLoadingEmoji(false));
        }
    }, [tab, guildId]);

    const filtered = customEmojis.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={ref} style={{
            position: 'absolute', bottom: '100%', right: 0, zIndex: 1000,
            background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '420px', marginBottom: '6px',
        }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
                {(['standard', 'custom'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        flex: 1, padding: '8px', background: tab === t ? colors.surfaceLight : 'transparent',
                        color: tab === t ? colors.textPrimary : colors.textTertiary, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                    }}>{t === 'standard' ? 'Standard' : 'Server Emoji'}</button>
                ))}
            </div>
            {tab === 'standard' ? (
                <EmojiPicker onEmojiClick={(e: EmojiClickData) => onSelect(e.emoji)} width="100%" height={420}
                    skinTonesDisabled searchDisabled={false}
                    style={{ '--epr-bg-color': colors.surface, '--epr-category-label-bg-color': colors.surface, '--epr-hover-bg-color': colors.surfaceLight, '--epr-search-input-bg-color': colors.background } as any}
                />
            ) : (
                <div style={{ padding: spacing.sm }}>
                    <input placeholder="Search server emoji..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ ...inputStyle, marginBottom: spacing.sm, fontSize: '12px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
                        {loadingEmoji && <span style={{ gridColumn: '1/-1', textAlign: 'center', color: colors.textTertiary, padding: spacing.md }}>Loading...</span>}
                        {filtered.map(em => (
                            <button key={em.id} onClick={() => onSelect(`<${em.animated ? 'a' : ''}:${em.name}:${em.id}>`)} title={em.name}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceLight)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                <img src={`https://cdn.discordapp.com/emojis/${em.id}.${em.animated ? 'gif' : 'png'}?size=32`}
                                    alt={em.name} style={{ width: 26, height: 26 }} />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Message Feed Component
// ---------------------------------------------------------------------------
const MessageFeed: React.FC<{
    guildId: string;
    channelId: string;
    onReply: (msg: DiscordMessage) => void;
}> = ({ guildId, channelId, onReply }) => {
    const [messages, setMessages] = useState<DiscordMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [reactingTo, setReactingTo] = useState<string | null>(null); // message id with picker open
    const [reactStatus, setReactStatus] = useState<{ id: string; ok: boolean; msg?: string } | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();

    const fetchMessages = useCallback(async () => {
        if (!channelId) return;
        try {
            const res = await axios.get(`${API}/api/bot-messenger/${guildId}/messages/${channelId}?limit=50`, { withCredentials: true });
            setMessages(res.data.reverse());
        } catch { /* ignore */ }
    }, [guildId, channelId]);

    useEffect(() => {
        setMessages([]);
        if (!channelId) return;
        setLoading(true);
        fetchMessages().finally(() => setLoading(false));

        // Auto-refresh every 5s
        intervalRef.current = setInterval(fetchMessages, 5000);
        return () => clearInterval(intervalRef.current);
    }, [channelId, fetchMessages]);

    useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, [messages]);

    const avatarUrl = (author: DiscordMessage['author']) =>
        author.avatar
            ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(author.id) % 5}.png`;

    if (!channelId) return <div style={{ color: colors.textTertiary, padding: spacing.lg, textAlign: 'center' }}>Select a channel to view messages</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <span style={{ color: colors.textSecondary, fontSize: '12px' }}>{messages.length} messages</span>
                <button onClick={() => fetchMessages()} style={{ ...btnSecondary, padding: '4px 10px', fontSize: '12px' }}>
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>
            <div
                ref={feedRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    background: colors.background,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.border}`,
                    padding: spacing.sm,
                }}
            >
                {loading && <div style={{ color: colors.textTertiary, textAlign: 'center', padding: spacing.lg }}>Loading...</div>}
                {!loading && messages.length === 0 && <div style={{ color: colors.textTertiary, textAlign: 'center', padding: spacing.lg }}>No messages</div>}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '8px',
                            borderRadius: borderRadius.sm,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceLight)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <img src={avatarUrl(msg.author)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {msg.referenced_message && (
                                <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Reply size={10} /> replying to <strong>{msg.referenced_message.author.username}</strong>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontWeight: 600, color: msg.author.bot ? colors.accent : colors.textPrimary, fontSize: '14px' }}>
                                    {msg.author.global_name || msg.author.username}
                                    {msg.author.bot && <span style={{ background: colors.accent, color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '3px', marginLeft: '5px', verticalAlign: 'middle' }}>BOT</span>}
                                </span>
                                <span style={{ color: colors.textTertiary, fontSize: '11px' }}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {msg.content && <div style={{ color: colors.textSecondary, fontSize: '14px', marginTop: '2px', wordBreak: 'break-word' }}>{msg.content}</div>}
                            {msg.embeds && msg.embeds.length > 0 && (
                                <div style={{ marginTop: '4px', padding: '6px 10px', borderLeft: `3px solid ${msg.embeds[0].color ? `#${msg.embeds[0].color.toString(16).padStart(6, '0')}` : colors.primary}`, background: 'rgba(0,0,0,0.15)', borderRadius: '4px', fontSize: '13px', color: colors.textSecondary }}>
                                    {msg.embeds[0].title && <div style={{ fontWeight: 600, color: colors.textPrimary }}>{msg.embeds[0].title}</div>}
                                    {msg.embeds[0].description && <div style={{ marginTop: '2px' }}>{msg.embeds[0].description}</div>}
                                </div>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div style={{ marginTop: '4px', fontSize: '12px', color: colors.accent }}>
                                    {msg.attachments.map((a: any) => <div key={a.id}>📎 {a.filename}</div>)}
                                </div>
                            )}
                            {msg.sticker_items && msg.sticker_items.length > 0 && (
                                <div style={{ marginTop: '4px', fontSize: '12px', color: colors.highlight }}>
                                    🏷️ Sticker: {msg.sticker_items[0].name}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', alignSelf: 'flex-start', flexShrink: 0, position: 'relative' }}>
                            <button
                                onClick={() => onReply(msg)}
                                title="Reply"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: '4px' }}
                                onMouseEnter={e => (e.currentTarget.style.color = colors.primary)}
                                onMouseLeave={e => (e.currentTarget.style.color = colors.textTertiary)}
                            >
                                <Reply size={15} />
                            </button>
                            <button
                                onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                                title="Add reaction"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: reactingTo === msg.id ? colors.primary : colors.textTertiary, padding: '4px' }}
                                onMouseEnter={e => (e.currentTarget.style.color = colors.primary)}
                                onMouseLeave={e => (e.currentTarget.style.color = reactingTo === msg.id ? colors.primary : colors.textTertiary)}
                            >
                                <SmilePlus size={15} />
                            </button>
                            {reactingTo === msg.id && (
                                <ReactPicker
                                    guildId={guildId}
                                    onClose={() => setReactingTo(null)}
                                    onSelect={async (emoji) => {
                                        setReactingTo(null);
                                        try {
                                            await axios.post(`${API}/api/bot-messenger/${guildId}/react`, {
                                                channelId,
                                                messageId: msg.id,
                                                emoji,
                                            }, { withCredentials: true });
                                            setReactStatus({ id: msg.id, ok: true });
                                        } catch (err: any) {
                                            const errMsg = err.response?.data?.error || 'Failed';
                                            setReactStatus({ id: msg.id, ok: false, msg: errMsg });
                                        } finally {
                                            setTimeout(() => setReactStatus(null), 2500);
                                        }
                                    }}
                                />
                            )}
                            {reactStatus?.id === msg.id && (
                                <div style={{
                                    position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px',
                                    background: reactStatus.ok ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
                                    color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
                                    whiteSpace: 'nowrap', pointerEvents: 'none',
                                }}>
                                    {reactStatus.ok ? 'Reacted!' : (reactStatus.msg || 'Failed')}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Emoji Picker Wrapper (standard + custom)
// ---------------------------------------------------------------------------
const EmojiPickerPopup: React.FC<{
    guildId: string;
    onSelect: (val: string) => void;
    onClose: () => void;
}> = ({ guildId, onSelect, onClose }) => {
    const [tab, setTab] = useState<'standard' | 'custom'>('standard');
    const [customEmojis, setCustomEmojis] = useState<DiscordEmoji[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    useEffect(() => {
        if (tab === 'custom' && customEmojis.length === 0) {
            setLoading(true);
            axios.get(`${API}/api/guilds/${guildId}/emojis`, { withCredentials: true })
                .then(r => setCustomEmojis(r.data))
                .catch(() => {})
                .finally(() => setLoading(false));
        }
    }, [tab, guildId]);

    const filtered = customEmojis.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={ref} style={{
            position: 'absolute', bottom: '100%', right: 0, zIndex: 1000,
            background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '360px', marginBottom: '8px', overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
                {(['standard', 'custom'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        flex: 1, padding: '10px', background: tab === t ? colors.surfaceLight : 'transparent',
                        color: tab === t ? colors.textPrimary : colors.textTertiary, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    }}>{t === 'standard' ? 'Standard' : 'Server Emoji'}</button>
                ))}
            </div>
            {tab === 'standard' ? (
                <EmojiPicker onEmojiClick={(e: EmojiClickData) => onSelect(e.emoji)} width="100%" height={320}
                    skinTonesDisabled searchDisabled={false}
                    style={{ '--epr-bg-color': colors.surface, '--epr-category-label-bg-color': colors.surface, '--epr-hover-bg-color': colors.surfaceLight, '--epr-search-input-bg-color': colors.background } as any}
                />
            ) : (
                <div style={{ padding: spacing.sm }}>
                    <input placeholder="Search custom emoji..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ ...inputStyle, marginBottom: spacing.sm, fontSize: '13px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
                        {loading && <span style={{ gridColumn: '1/-1', textAlign: 'center', color: colors.textTertiary, padding: spacing.md }}>Loading...</span>}
                        {filtered.map(em => (
                            <button key={em.id} onClick={() => onSelect(`<${em.animated ? 'a' : ''}:${em.name}:${em.id}>`)} title={em.name}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceLight)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                <img src={`https://cdn.discordapp.com/emojis/${em.id}.${em.animated ? 'gif' : 'png'}?size=32`}
                                    alt={em.name} style={{ width: 28, height: 28 }} />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Sticker Picker
// ---------------------------------------------------------------------------
const StickerPicker: React.FC<{
    guildId: string;
    onSelect: (sticker: DiscordSticker) => void;
    onClose: () => void;
}> = ({ guildId, onSelect, onClose }) => {
    const [stickers, setStickers] = useState<DiscordSticker[]>([]);
    const [loading, setLoading] = useState(true);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    useEffect(() => {
        axios.get(`${API}/api/bot-messenger/${guildId}/stickers`, { withCredentials: true })
            .then(r => setStickers(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [guildId]);

    return (
        <div ref={ref} style={{
            position: 'absolute', bottom: '100%', right: 0, zIndex: 1000,
            background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '320px', marginBottom: '8px', padding: spacing.md,
        }}>
            <div style={{ fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.sm, fontSize: '14px' }}>Server Stickers</div>
            {loading ? <div style={{ color: colors.textTertiary, textAlign: 'center' }}>Loading...</div> :
            stickers.length === 0 ? <div style={{ color: colors.textTertiary, textAlign: 'center' }}>No stickers available</div> :
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.sm, maxHeight: '300px', overflowY: 'auto' }}>
                {stickers.map(s => (
                    <button key={s.id} onClick={() => { onSelect(s); onClose(); }}
                        style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.sm, cursor: 'pointer', textAlign: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.primary)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                    >
                        <img src={`https://cdn.discordapp.com/stickers/${s.id}.png?size=100`} alt={s.name}
                            style={{ width: '100%', height: 60, objectFit: 'contain' }} />
                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </button>
                ))}
            </div>}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Channel Mention Insert Button
// ---------------------------------------------------------------------------
const MentionInsertButton: React.FC<{
    guildId: string;
    onInsert: (mention: string) => void;
}> = ({ guildId, onInsert }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                title="Insert channel mention"
                style={{
                    background: open ? colors.primary + '22' : 'transparent',
                    border: `1px solid ${open ? colors.primary : colors.border}`,
                    borderRadius: borderRadius.sm,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    color: open ? colors.primary : colors.textTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all .15s',
                }}
            >
                <Hash size={13} /> #mention
            </button>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    marginTop: '4px',
                    minWidth: '240px',
                }}>
                    <ChannelSelect
                        guildId={guildId}
                        value=""
                        onChange={(v) => {
                            if (v) {
                                onInsert(`<#${v}>`);
                                setOpen(false);
                            }
                        }}
                        channelTypes={[0, 2, 5, 13, 15]}
                        placeholder="Pick channel to mention..."
                    />
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Embed Builder Component
// ---------------------------------------------------------------------------
const EmbedBuilder: React.FC<{
    embed: EmbedData;
    onChange: (e: EmbedData) => void;
    guildId: string;
}> = ({ embed, onChange, guildId }) => {
    const update = (patch: Partial<EmbedData>) => onChange({ ...embed, ...patch });
    const [uploading, setUploading] = useState(false);

    const addField = () => update({ fields: [...embed.fields, { name: '', value: '', inline: false }] });
    const removeField = (i: number) => update({ fields: embed.fields.filter((_, idx) => idx !== i) });
    const updateField = (i: number, patch: Partial<EmbedField>) => {
        const fields = [...embed.fields];
        fields[i] = { ...fields[i], ...patch };
        update({ fields });
    };

    const sectionTitle = (title: string) => (
        <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: spacing.lg, marginBottom: spacing.sm }}>{title}</div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {/* Body */}
            {sectionTitle('Body')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                    <label style={labelStyle}>Title</label>
                    <input style={inputStyle} value={embed.title} onChange={e => update({ title: e.target.value })} placeholder="Embed title" />
                </div>
                <div>
                    <label style={labelStyle}>URL</label>
                    <input style={inputStyle} value={embed.url} onChange={e => update({ url: e.target.value })} placeholder="https://..." />
                </div>
            </div>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={labelStyle}>Description</label>
                    <MentionInsertButton guildId={guildId} onInsert={(m) => update({ description: embed.description + m })} />
                </div>
                <textarea style={textareaStyle} value={embed.description} onChange={e => update({ description: e.target.value })} placeholder="Embed description (supports markdown)" rows={4} />
            </div>
            <div>
                <label style={labelStyle}>Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <input type="color" value={embed.color} onChange={e => update({ color: e.target.value })}
                        style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', background: 'none' }} />
                    <input style={{ ...inputStyle, width: '120px' }} value={embed.color} onChange={e => update({ color: e.target.value })} placeholder="#10B981" />
                    {['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(c => (
                        <button key={c} onClick={() => update({ color: c })}
                            style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: embed.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                    ))}
                </div>
            </div>

            {/* Author */}
            {sectionTitle('Author')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                    <label style={labelStyle}>Author Name</label>
                    <input style={inputStyle} value={embed.authorName} onChange={e => update({ authorName: e.target.value })} placeholder="Author name" />
                </div>
                <div>
                    <label style={labelStyle}>Author URL</label>
                    <input style={inputStyle} value={embed.authorUrl} onChange={e => update({ authorUrl: e.target.value })} placeholder="https://..." />
                </div>
            </div>
            <div>
                <label style={labelStyle}>Author Icon URL</label>
                <input style={inputStyle} value={embed.authorIconUrl} onChange={e => update({ authorIconUrl: e.target.value })} placeholder="https://..." />
            </div>

            {/* Fields */}
            {sectionTitle('Fields')}
            {embed.fields.map((field, i) => (
                <div key={i} style={{ background: colors.background, borderRadius: borderRadius.md, padding: spacing.md, border: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                        <span style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600 }}>Field {i + 1}</span>
                        <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '2px' }}><Trash2 size={14} /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.sm }}>
                        <input style={inputStyle} value={field.name} onChange={e => updateField(i, { name: e.target.value })} placeholder="Field name" />
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input style={{ ...inputStyle, flex: 1 }} value={field.value} onChange={e => updateField(i, { value: e.target.value })} placeholder="Field value" />
                            <MentionInsertButton guildId={guildId} onInsert={(m) => updateField(i, { value: field.value + m })} />
                        </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={field.inline} onChange={e => updateField(i, { inline: e.target.checked })} /> Inline
                    </label>
                </div>
            ))}
            {embed.fields.length < 25 && (
                <button onClick={addField} style={{ ...btnSecondary, alignSelf: 'flex-start' }}><Plus size={14} /> Add Field</button>
            )}

            {/* Images */}
            {sectionTitle('Images')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                    <label style={labelStyle}>Thumbnail URL</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={embed.thumbnailUrl} onChange={e => update({ thumbnailUrl: e.target.value })} placeholder="https://..." />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Image URL</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={embed.imageUrl} onChange={e => update({ imageUrl: e.target.value })} placeholder="https://..." />
                    </div>
                </div>
            </div>
            <div style={{ marginTop: spacing.sm }}>
                <label style={{ ...labelStyle, marginBottom: spacing.sm, display: 'block' }}>Upload Image to CDN</label>
                <p style={{ color: colors.textTertiary, fontSize: '12px', margin: `0 0 ${spacing.sm} 0` }}>
                    Upload an image to auto-fill both Image URL and Thumbnail URL (auto-resized).
                </p>
                <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', background: uploading ? colors.surface : colors.primary + '22',
                    color: uploading ? colors.textTertiary : colors.primary, border: `1px solid ${uploading ? colors.border : colors.primary + '44'}`,
                    borderRadius: borderRadius.md, cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '13px', fontWeight: 600, transition: 'all .15s',
                }}>
                    {uploading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                    {uploading ? 'Uploading...' : 'Choose Image'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                            const form = new FormData();
                            form.append('embedImage', file);
                            const res = await axios.post(`${API}/api/bot-messenger/${guildId}/upload-image`, form);
                            update({ imageUrl: res.data.imageUrl, thumbnailUrl: res.data.thumbnailUrl });
                        } catch (err: any) {
                            alert(err.response?.data?.error || 'Upload failed');
                        } finally {
                            setUploading(false);
                            e.target.value = '';
                        }
                    }} />
                </label>
                {(embed.imageUrl || embed.thumbnailUrl) && (
                    <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' }}>
                        {embed.imageUrl && (
                            <div style={{ position: 'relative' }}>
                                <img src={embed.imageUrl} alt="Image preview" style={{ height: 80, borderRadius: borderRadius.sm, border: `1px solid ${colors.border}` }} />
                                <span style={{ position: 'absolute', top: -6, right: -6, background: colors.error, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => update({ imageUrl: '' })}><X size={10} color="#fff" /></span>
                                <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: '2px', textAlign: 'center' }}>Image</div>
                            </div>
                        )}
                        {embed.thumbnailUrl && (
                            <div style={{ position: 'relative' }}>
                                <img src={embed.thumbnailUrl} alt="Thumb preview" style={{ height: 80, borderRadius: borderRadius.sm, border: `1px solid ${colors.border}` }} />
                                <span style={{ position: 'absolute', top: -6, right: -6, background: colors.error, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => update({ thumbnailUrl: '' })}><X size={10} color="#fff" /></span>
                                <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: '2px', textAlign: 'center' }}>Thumbnail</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            {sectionTitle('Footer')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                    <label style={labelStyle}>Footer Text</label>
                    <input style={inputStyle} value={embed.footerText} onChange={e => update({ footerText: e.target.value })} placeholder="Footer text" />
                </div>
                <div>
                    <label style={labelStyle}>Footer Icon URL</label>
                    <input style={inputStyle} value={embed.footerIconUrl} onChange={e => update({ footerIconUrl: e.target.value })} placeholder="https://..." />
                </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={embed.timestamp} onChange={e => update({ timestamp: e.target.checked })} /> Include Timestamp
            </label>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Embed Preview
// ---------------------------------------------------------------------------
const EmbedPreview: React.FC<{ embed: EmbedData }> = ({ embed }) => {
    const hasContent = embed.title || embed.description || embed.authorName || embed.footerText || embed.fields.length > 0 || embed.imageUrl || embed.thumbnailUrl;
    if (!hasContent) return <div style={{ color: colors.textTertiary, textAlign: 'center', padding: spacing.xl }}>Embed preview will appear here</div>;

    return (
        <div style={{
            borderLeft: `4px solid ${embed.color || colors.primary}`,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            padding: '12px 16px',
            maxWidth: '520px',
        }}>
            {/* Author */}
            {embed.authorName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    {embed.authorIconUrl && <img src={embed.authorIconUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                        {embed.authorUrl ? <a href={embed.authorUrl} style={{ color: colors.textPrimary, textDecoration: 'none' }}>{embed.authorName}</a> : embed.authorName}
                    </span>
                </div>
            )}

            {/* Thumbnail + Body */}
            <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                    {embed.title && (
                        <div style={{ fontWeight: 700, color: embed.url ? colors.accent : colors.textPrimary, fontSize: '16px', marginBottom: '6px' }}>
                            {embed.url ? <a href={embed.url} style={{ color: colors.accent, textDecoration: 'none' }}>{embed.title}</a> : embed.title}
                        </div>
                    )}
                    {embed.description && <div style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: 1.5, marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{embed.description}</div>}

                    {/* Fields */}
                    {embed.fields.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: embed.fields.some(f => f.inline) ? 'repeat(3, 1fr)' : '1fr', gap: '8px', marginBottom: '8px' }}>
                            {embed.fields.map((f, i) => (
                                <div key={i} style={{ gridColumn: f.inline ? 'span 1' : '1 / -1' }}>
                                    {f.name && <div style={{ fontSize: '13px', fontWeight: 700, color: colors.textPrimary, marginBottom: '2px' }}>{f.name}</div>}
                                    {f.value && <div style={{ fontSize: '13px', color: colors.textSecondary }}>{f.value}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {embed.thumbnailUrl && <img src={embed.thumbnailUrl} alt="" style={{ width: 80, height: 80, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
            </div>

            {/* Image */}
            {embed.imageUrl && <img src={embed.imageUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: '4px', marginTop: '8px' }} />}

            {/* Footer */}
            {(embed.footerText || embed.timestamp) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    {embed.footerIconUrl && <img src={embed.footerIconUrl} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />}
                    <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                        {embed.footerText}
                        {embed.footerText && embed.timestamp && ' • '}
                        {embed.timestamp && new Date().toLocaleString()}
                    </span>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export function BotMessengerPage() {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id || '';
    const [tab, setTab] = useState<'send' | 'embed'>('send');

    // Send tab state
    const [channelId, setChannelId] = useState('');
    const [message, setMessage] = useState('');
    const [replyTo, setReplyTo] = useState<DiscordMessage | null>(null);
    const [selectedSticker, setSelectedSticker] = useState<DiscordSticker | null>(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Embed tab state
    const [embedChannelId, setEmbedChannelId] = useState('');
    const [embedContent, setEmbedContent] = useState('');
    const [embed, setEmbed] = useState<EmbedData>({ ...defaultEmbed });
    const [embedReplyTo, setEmbedReplyTo] = useState('');
    const [embedSending, setEmbedSending] = useState(false);
    const [embedStatus, setEmbedStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const clearStatus = () => { setStatus(null); setEmbedStatus(null); };

    const handleSendMessage = async () => {
        if (!channelId) return;
        if (!message.trim() && !selectedSticker) return;
        setSending(true);
        clearStatus();
        try {
            await axios.post(`${API}/api/bot-messenger/${guildId}/send`, {
                channelId,
                content: message.trim() || undefined,
                replyTo: replyTo?.id || undefined,
                stickerId: selectedSticker?.id || undefined,
            }, { withCredentials: true });
            setMessage('');
            setReplyTo(null);
            setSelectedSticker(null);
            setStatus({ type: 'success', text: 'Message sent!' });
            setTimeout(() => setStatus(null), 3000);
        } catch (err: any) {
            setStatus({ type: 'error', text: err.response?.data?.error || 'Failed to send' });
        } finally {
            setSending(false);
        }
    };

    const handleSendEmbed = async () => {
        if (!embedChannelId) return;
        setEmbedSending(true);
        clearStatus();
        try {
            const embedPayload: any = {};
            if (embed.title) embedPayload.title = embed.title;
            if (embed.description) embedPayload.description = embed.description;
            if (embed.url) embedPayload.url = embed.url;
            if (embed.color) embedPayload.color = parseInt(embed.color.replace('#', ''), 16);
            if (embed.authorName) embedPayload.author = { name: embed.authorName, url: embed.authorUrl || undefined, icon_url: embed.authorIconUrl || undefined };
            if (embed.footerText) embedPayload.footer = { text: embed.footerText, icon_url: embed.footerIconUrl || undefined };
            if (embed.thumbnailUrl) embedPayload.thumbnail = { url: embed.thumbnailUrl };
            if (embed.imageUrl) embedPayload.image = { url: embed.imageUrl };
            if (embed.timestamp) embedPayload.timestamp = new Date().toISOString();
            if (embed.fields.length > 0) embedPayload.fields = embed.fields.filter(f => f.name || f.value);

            await axios.post(`${API}/api/bot-messenger/${guildId}/send`, {
                channelId: embedChannelId,
                content: embedContent.trim() || undefined,
                embeds: [embedPayload],
                replyTo: embedReplyTo || undefined,
            }, { withCredentials: true });
            setEmbedStatus({ type: 'success', text: 'Embed sent!' });
            setTimeout(() => setEmbedStatus(null), 3000);
        } catch (err: any) {
            setEmbedStatus({ type: 'error', text: err.response?.data?.error || 'Failed to send embed' });
        } finally {
            setEmbedSending(false);
        }
    };

    if (!guildId) return null;

    return (
        <div style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Send size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Bot Messenger</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Send messages, embeds, and reactions as Fuji Studio</p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Use the <strong>Send Message</strong> tab to send text messages with emoji, stickers, and reply functionality. 
                    Use the <strong>Embed Builder</strong> tab to create rich embeds with titles, descriptions, fields, images, and more — similar to Discohook.
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: spacing.lg, background: colors.surface, borderRadius: borderRadius.md, padding: '4px', width: 'fit-content' }}>
                {([['send', 'Send Message', MessageSquare], ['embed', 'Embed Builder', Code2]] as const).map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setTab(key as any)} style={{
                        padding: '10px 20px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer',
                        background: tab === key ? colors.primary : 'transparent',
                        color: tab === key ? '#fff' : colors.textSecondary,
                        fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
                    }}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* ============== SEND MESSAGE TAB ============== */}
            {tab === 'send' && (
                <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: spacing.lg }}>
                    {/* Left: Composer */}
                    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                        <div>
                            <label style={labelStyle}>Channel</label>
                            <ChannelSelect guildId={guildId} value={channelId} onChange={v => { setChannelId(v as string); setReplyTo(null); }} channelTypes={[0, 5]} placeholder="Select channel..." />
                        </div>

                        {/* Reply indicator */}
                        {replyTo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: colors.background, borderRadius: borderRadius.sm, border: `1px solid ${colors.border}` }}>
                                <Reply size={14} color={colors.primary} />
                                <span style={{ flex: 1, fontSize: '13px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    Replying to <strong style={{ color: colors.textPrimary }}>{replyTo.author.global_name || replyTo.author.username}</strong>: {replyTo.content?.slice(0, 60) || '(embed)'}
                                </span>
                                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 0 }}><X size={14} /></button>
                            </div>
                        )}

                        {/* Sticker indicator */}
                        {selectedSticker && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: colors.background, borderRadius: borderRadius.sm, border: `1px solid ${colors.border}` }}>
                                <Sticker size={14} color={colors.highlight} />
                                <img src={`https://cdn.discordapp.com/stickers/${selectedSticker.id}.png?size=48`} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                <span style={{ flex: 1, fontSize: '13px', color: colors.textSecondary }}>{selectedSticker.name}</span>
                                <button onClick={() => setSelectedSticker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 0 }}><X size={14} /></button>
                            </div>
                        )}

                        {/* Message input */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={labelStyle}>Message</label>
                                <MentionInsertButton guildId={guildId} onInsert={(m) => setMessage(prev => prev + m)} />
                            </div>
                            <textarea
                                style={{ ...textareaStyle, minHeight: '120px' }}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Type your message..."
                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendMessage(); }}
                            />
                        </div>

                        {/* Toolbar */}
                        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', position: 'relative' }}>
                            <button onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }}
                                style={{ ...btnSecondary, padding: '6px 10px' }} title="Emoji">
                                <Smile size={16} />
                            </button>
                            <button onClick={() => { setShowStickers(!showStickers); setShowEmoji(false); }}
                                style={{ ...btnSecondary, padding: '6px 10px' }} title="Stickers">
                                <Sticker size={16} />
                            </button>
                            <div style={{ flex: 1 }} />
                            <button onClick={handleSendMessage} disabled={sending || (!message.trim() && !selectedSticker) || !channelId}
                                style={{ ...btnPrimary, opacity: sending || (!message.trim() && !selectedSticker) || !channelId ? 0.5 : 1 }}>
                                <Send size={16} /> {sending ? 'Sending...' : 'Send'}
                            </button>
                            {showEmoji && <EmojiPickerPopup guildId={guildId} onSelect={val => { setMessage(m => m + val); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} />}
                            {showStickers && <StickerPicker guildId={guildId} onSelect={s => { setSelectedSticker(s); setShowStickers(false); }} onClose={() => setShowStickers(false)} />}
                        </div>

                        {status && (
                            <div style={{ padding: '8px 12px', borderRadius: borderRadius.sm, fontSize: '13px', background: status.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: status.type === 'success' ? colors.success : colors.error }}>
                                {status.text}
                            </div>
                        )}

                        <div style={{ fontSize: '11px', color: colors.textTertiary }}>Ctrl+Enter to send</div>
                    </div>

                    {/* Right: Live Feed */}
                    <div style={cardStyle}>
                        <MessageFeed guildId={guildId} channelId={channelId} onReply={msg => setReplyTo(msg)} />
                    </div>
                </div>
            )}

            {/* ============== EMBED BUILDER TAB ============== */}
            {tab === 'embed' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
                    {/* Left: Builder */}
                    <div style={{ ...cardStyle, maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
                            <Palette size={20} color={colors.primary} />
                            <span style={{ fontWeight: 600, fontSize: '16px', color: colors.textPrimary }}>Embed Builder</span>
                        </div>

                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={labelStyle}>Channel</label>
                            <ChannelSelect guildId={guildId} value={embedChannelId} onChange={v => setEmbedChannelId(v as string)} channelTypes={[0, 5]} placeholder="Select channel..." />
                        </div>

                        <div style={{ marginBottom: spacing.md }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={labelStyle}>Message Content (above embed)</label>
                                <MentionInsertButton guildId={guildId} onInsert={(m) => setEmbedContent(prev => prev + m)} />
                            </div>
                            <textarea style={{ ...textareaStyle, minHeight: '60px' }} value={embedContent} onChange={e => setEmbedContent(e.target.value)} placeholder="Optional text above the embed" />
                        </div>

                        <div style={{ marginBottom: spacing.md }}>
                            <label style={labelStyle}>Reply to Message ID</label>
                            <input style={inputStyle} value={embedReplyTo} onChange={e => setEmbedReplyTo(e.target.value)} placeholder="Message ID (optional)" />
                        </div>

                        <EmbedBuilder embed={embed} onChange={setEmbed} guildId={guildId} />

                        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.lg, alignItems: 'center' }}>
                            <button onClick={handleSendEmbed} disabled={embedSending || !embedChannelId}
                                style={{ ...btnPrimary, opacity: embedSending || !embedChannelId ? 0.5 : 1 }}>
                                <Send size={16} /> {embedSending ? 'Sending...' : 'Send Embed'}
                            </button>
                            <button onClick={() => setEmbed({ ...defaultEmbed })} style={btnSecondary}>
                                <Trash2 size={14} /> Reset
                            </button>
                        </div>

                        {embedStatus && (
                            <div style={{ padding: '8px 12px', borderRadius: borderRadius.sm, fontSize: '13px', marginTop: spacing.sm, background: embedStatus.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: embedStatus.type === 'success' ? colors.success : colors.error }}>
                                {embedStatus.text}
                            </div>
                        )}
                    </div>

                    {/* Right: Preview */}
                    <div style={{ ...cardStyle, position: 'sticky', top: '20px', alignSelf: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
                            <Eye size={20} color={colors.accent} />
                            <span style={{ fontWeight: 600, fontSize: '16px', color: colors.textPrimary }}>Preview</span>
                        </div>

                        {/* Content preview */}
                        {embedContent && (
                            <div style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.md, whiteSpace: 'pre-wrap' }}>{embedContent}</div>
                        )}

                        <EmbedPreview embed={embed} />
                    </div>
                </div>
            )}
        </div>
    );
}
