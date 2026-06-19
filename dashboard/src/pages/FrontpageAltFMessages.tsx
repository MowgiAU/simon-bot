/**
 * Alt F — Private Messages (/preview/alt_f_messages)
 * Full-height split panel: conversation list (left) + chat thread (right).
 * Real API: /api/messages/conversations, /api/messages/conversations/:id/messages
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
    AltSidebar, BG, S_CONT, S_HIGH, S_LOWEST,
    PRIMARY, SECONDARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { MessageSquare, Plus, Search, X, Send, ChevronLeft, Users, Lock, MoreHorizontal, Check, CheckCheck, Smile } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

function timeAgo(date: string): string {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullTime(date: string): string {
    return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(date: string): string {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function avatarGrad(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `linear-gradient(135deg, hsl(${hue},50%,20%) 0%, hsl(${(hue + 50) % 360},60%,28%) 100%)`;
}

interface ConvParticipant { userId: string; username: string; displayName: string | null; avatar: string | null }
interface Conversation {
    id: string; name: string | null; isGroup: boolean;
    participants: ConvParticipant[];
    lastMessagePreview: string | null; lastMessageAt: string | null;
    unread: number; muted: boolean; archived: boolean; createdAt: string;
}
interface Message { id: string; senderId: string; content: string | null; deleted: boolean; createdAt: string; editedAt: string | null }

function Avatar({ src, name, size = 36, online }: { src?: string | null; name: string; size?: number; online?: boolean }) {
    const initials = name.split(/[\s_]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            {src
                ? <img src={src} referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: size, height: size, borderRadius: '50%', background: avatarGrad(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
            }
            {online && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: '#4ade80', border: `2px solid ${BG}` }} />}
        </div>
    );
}

function convDisplayName(conv: Conversation): string {
    if (conv.isGroup) return conv.name || 'Group Chat';
    return conv.participants[0]?.displayName || conv.participants[0]?.username || 'Unknown';
}

function convAvatar(conv: Conversation): { src?: string | null; name: string } {
    if (conv.isGroup) return { name: conv.name || 'Group' };
    const p = conv.participants[0];
    return { src: p?.avatar, name: p?.displayName || p?.username || 'Unknown' };
}

export const FrontpageAltFMessages: React.FC = () => {
    const [convos, setConvos]               = useState<Conversation[]>([]);
    const [convoLoading, setConvoLoading]   = useState(true);
    const [authError, setAuthError]         = useState(false);

    const [activeConv, setActiveConv]       = useState<Conversation | null>(null);
    const [messages, setMessages]           = useState<Message[]>([]);
    const [msgLoading, setMsgLoading]       = useState(false);
    const [myId, setMyId]                   = useState<string | null>(null);

    const [input, setInput]                 = useState('');
    const [sending, setSending]             = useState(false);

    const [convoSearch, setConvoSearch]     = useState('');
    const [showNewDM, setShowNewDM]         = useState(false);
    const [userSearch, setUserSearch]       = useState('');
    const [userResults, setUserResults]     = useState<ConvParticipant[]>([]);
    const [userSearching, setUserSearching] = useState(false);

    const msgBottomRef  = useRef<HTMLDivElement>(null);
    const inputRef      = useRef<HTMLTextAreaElement>(null);
    const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Who am I?
    useEffect(() => {
        axios.get('/api/auth/me').then(r => setMyId(r.data?.id || r.data?.userId || null)).catch(() => {});
    }, []);

    // Load conversations
    const loadConvos = useCallback(() => {
        axios.get('/api/messages/conversations').then(r => {
            setConvos(r.data);
            setConvoLoading(false);
        }).catch(e => {
            if (e.response?.status === 401) setAuthError(true);
            setConvoLoading(false);
        });
    }, []);

    useEffect(() => { loadConvos(); }, [loadConvos]);

    // Load messages for active conversation
    useEffect(() => {
        if (!activeConv) return;
        setMsgLoading(true);
        setMessages([]);
        axios.get(`/api/messages/conversations/${activeConv.id}/messages`, { params: { limit: 50 } }).then(r => {
            setMessages(r.data);
            setMsgLoading(false);
        }).catch(() => setMsgLoading(false));
    }, [activeConv?.id]);

    // Scroll to bottom when messages load
    useEffect(() => {
        msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // User search (debounced)
    useEffect(() => {
        if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
        if (userSearch.trim().length < 2) { setUserResults([]); return; }
        setUserSearching(true);
        userSearchTimer.current = setTimeout(() => {
            axios.get('/api/messages/search-users', { params: { q: userSearch.trim() } })
                .then(r => { setUserResults(r.data); setUserSearching(false); })
                .catch(() => setUserSearching(false));
        }, 300);
    }, [userSearch]);

    const sendMessage = async () => {
        if (!activeConv || !input.trim() || sending) return;
        const text = input.trim();
        setInput('');
        setSending(true);
        // Optimistic
        const optimistic: Message = { id: `opt-${Date.now()}`, senderId: myId || '', content: text, deleted: false, createdAt: new Date().toISOString(), editedAt: null };
        setMessages(prev => [...prev, optimistic]);
        setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        try {
            const r = await axios.post(`/api/messages/conversations/${activeConv.id}/messages`, { content: text });
            setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...optimistic, id: r.data.id } : m));
            // Refresh conversation list (update last preview)
            loadConvos();
        } catch {
            setMessages(prev => prev.filter(m => m.id !== optimistic.id));
            setInput(text);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const startDM = async (userId: string) => {
        try {
            const r = await axios.post('/api/messages/conversations', { participantIds: [userId] });
            const convId = r.data.id;
            await loadConvos();
            // Find the new conv and select it
            const refresh = await axios.get('/api/messages/conversations');
            setConvos(refresh.data);
            const found = refresh.data.find((c: Conversation) => c.id === convId);
            if (found) setActiveConv(found);
            setShowNewDM(false);
            setUserSearch('');
            setUserResults([]);
        } catch {}
    };

    const filteredConvos = convos.filter(c => {
        if (!convoSearch.trim()) return true;
        const q = convoSearch.toLowerCase();
        return convDisplayName(c).toLowerCase().includes(q)
            || (c.lastMessagePreview || '').toLowerCase().includes(q);
    });

    // Group messages by date for separators
    function groupMessages(msgs: Message[]): { type: 'date'; label: string } | { type: 'msg'; msg: Message }[] {
        const result: ({ type: 'date'; label: string } | { type: 'msg'; msg: Message })[] = [];
        let lastDate = '';
        for (const m of msgs) {
            const day = new Date(m.createdAt).toDateString();
            if (day !== lastDate) { result.push({ type: 'date', label: formatDate(m.createdAt) }); lastDate = day; }
            result.push({ type: 'msg', msg: m });
        }
        return result as any;
    }

    if (authError) {
        return (
            <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
                <AltSidebar active="Messages" />
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <AltHeader breadcrumb={[{ label: 'Messages' }]} />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                        <Lock size={40} color={SUB} />
                        <div style={{ fontSize: 18, fontWeight: 700 }}>Sign in to use Messages</div>
                        <div style={{ fontSize: 14, color: SUB }}>Messages are end-to-end encrypted.</div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Messages" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Messages' }]} />

                {/* ── SPLIT PANEL ── */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

                    {/* ── LEFT: Conversation list (280px) ── */}
                    <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: S_LOWEST }}>

                        {/* Panel header */}
                        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${DIVIDER}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <span style={{ fontSize: 15, fontWeight: 800 }}>Messages</span>
                                <button
                                    onClick={() => { setShowNewDM(v => !v); setUserSearch(''); setUserResults([]); }}
                                    title="New message"
                                    style={{ width: 30, height: 30, borderRadius: 8, background: showNewDM ? `${PRIMARY}22` : S_HIGH, border: `1px solid ${showNewDM ? PRIMARY + '55' : BORDER}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                >
                                    {showNewDM ? <X size={14} color={PRIMARY} /> : <Plus size={14} color={SUB} />}
                                </button>
                            </div>

                            {/* Search / new DM input */}
                            {showNewDM ? (
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} color={SUB} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        autoFocus
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                        placeholder="Search artists…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT }}
                                    />
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} color={SUB} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        value={convoSearch}
                                        onChange={e => setConvoSearch(e.target.value)}
                                        placeholder="Search conversations…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* User search results */}
                        {showNewDM && (
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {userSearching && (
                                    <div style={{ padding: '12px 16px', fontSize: 13, color: SUB }}>Searching…</div>
                                )}
                                {!userSearching && userSearch.length >= 2 && userResults.length === 0 && (
                                    <div style={{ padding: '12px 16px', fontSize: 13, color: SUB }}>No artists found</div>
                                )}
                                {!userSearching && userSearch.length < 2 && (
                                    <div style={{ padding: '12px 16px', fontSize: 13, color: SUB }}>Type to search for artists…</div>
                                )}
                                {userResults.map(u => (
                                    <button key={u.userId} onClick={() => startDM(u.userId)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = S_CONT}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Avatar src={u.avatar} name={u.displayName || u.username} size={34} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.displayName || u.username}</div>
                                            <div style={{ fontSize: 11, color: SUB }}>@{u.username}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Conversation list */}
                        {!showNewDM && (
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {convoLoading && (
                                    <div style={{ padding: '16px', fontSize: 13, color: SUB }}>Loading…</div>
                                )}
                                {!convoLoading && filteredConvos.length === 0 && (
                                    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                                        <MessageSquare size={28} color={SUB} style={{ marginBottom: 8 }} />
                                        <div style={{ fontSize: 13, color: SUB }}>{convos.length === 0 ? 'No messages yet' : 'No results'}</div>
                                        {convos.length === 0 && <div style={{ fontSize: 12, color: `${SUB}88`, marginTop: 4 }}>Press + to start a conversation</div>}
                                    </div>
                                )}
                                {filteredConvos.map(conv => {
                                    const { src, name } = convAvatar(conv);
                                    const label = convDisplayName(conv);
                                    const isActive = activeConv?.id === conv.id;
                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => setActiveConv(conv)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', background: isActive ? `${PRIMARY}14` : 'transparent', border: 'none', borderLeft: `3px solid ${isActive ? PRIMARY : 'transparent'}`, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, transition: 'all 0.1s' }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = S_CONT; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <Avatar src={src} name={name} size={38} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                                    <span style={{ fontSize: 13, fontWeight: conv.unread > 0 ? 700 : 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{label}</span>
                                                    <span style={{ fontSize: 11, color: SUB, flexShrink: 0, marginLeft: 4 }}>{conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ''}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                                    <span style={{ fontSize: 12, color: conv.unread > 0 ? TEXT : SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.unread > 0 ? 600 : 400 }}>
                                                        {conv.lastMessagePreview || 'Start a conversation'}
                                                    </span>
                                                    {conv.unread > 0 && (
                                                        <span style={{ background: PRIMARY, color: '#fff', borderRadius: 9999, fontSize: 10, fontWeight: 800, padding: '1px 6px', flexShrink: 0 }}>
                                                            {conv.unread > 99 ? '99+' : conv.unread}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Encryption notice */}
                        <div style={{ padding: '10px 14px', borderTop: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Lock size={11} color={SUB} />
                            <span style={{ fontSize: 11, color: `${SUB}99` }}>End-to-end encrypted</span>
                        </div>
                    </div>

                    {/* ── RIGHT: Chat thread ── */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

                        {!activeConv ? (
                            /* Empty state */
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MessageSquare size={32} color={PRIMARY} />
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>Your messages</div>
                                <div style={{ fontSize: 14, color: SUB, maxWidth: 260, textAlign: 'center', lineHeight: 1.5 }}>
                                    Select a conversation or press&nbsp;
                                    <span style={{ color: PRIMARY, fontWeight: 700 }}>+</span>
                                    &nbsp;to start a new one.
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Chat header */}
                                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, background: `${S_LOWEST}cc`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', flexShrink: 0 }}>
                                    <button
                                        onClick={() => setActiveConv(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex', alignItems: 'center' }}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    {(() => { const { src, name } = convAvatar(activeConv); return <Avatar src={src} name={name} size={36} />; })()}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convDisplayName(activeConv)}</div>
                                        <div style={{ fontSize: 12, color: SUB }}>
                                            {activeConv.isGroup
                                                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} />{activeConv.participants.length + 1} members</span>
                                                : activeConv.participants[0]
                                                    ? `@${activeConv.participants[0].username}`
                                                    : 'Direct Message'
                                            }
                                        </div>
                                    </div>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 4 }}>
                                        <MoreHorizontal size={18} />
                                    </button>
                                </div>

                                {/* Messages area */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                                    {msgLoading && (
                                        <div style={{ textAlign: 'center', color: SUB, fontSize: 13, marginTop: 20 }}>Loading messages…</div>
                                    )}
                                    {!msgLoading && messages.length === 0 && (
                                        <div style={{ textAlign: 'center', marginTop: 40 }}>
                                            {(() => { const { src, name } = convAvatar(activeConv); return <Avatar src={src} name={name} size={56} />; })()}
                                            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{convDisplayName(activeConv)}</div>
                                            <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>This is the beginning of your conversation.</div>
                                        </div>
                                    )}
                                    {groupMessages(messages).map((item, idx) => {
                                        if ((item as any).type === 'date') {
                                            return (
                                                <div key={`date-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px' }}>
                                                    <div style={{ flex: 1, height: 1, background: DIVIDER }} />
                                                    <span style={{ fontSize: 11, color: SUB, fontWeight: 600, flexShrink: 0 }}>{(item as any).label}</span>
                                                    <div style={{ flex: 1, height: 1, background: DIVIDER }} />
                                                </div>
                                            );
                                        }
                                        const m = (item as any).msg as Message;
                                        const isMine = myId ? m.senderId === myId : m.id.startsWith('opt-');
                                        const isOptimistic = m.id.startsWith('opt-');

                                        // Find sender name for group chats
                                        const sender = !isMine ? activeConv.participants.find(p => p.userId === m.senderId) : null;
                                        const senderName = sender?.displayName || sender?.username || '';

                                        return (
                                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                                                {activeConv.isGroup && !isMine && senderName && (
                                                    <span style={{ fontSize: 11, color: SUB, marginBottom: 2, marginLeft: 44 }}>{senderName}</span>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                                                    {!isMine && (
                                                        <Avatar src={sender?.avatar} name={senderName || '?'} size={28} />
                                                    )}
                                                    <div style={{ maxWidth: 480 }}>
                                                        <div style={{
                                                            padding: '9px 14px',
                                                            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                            background: isMine ? PRIMARY : S_CONT,
                                                            border: isMine ? 'none' : `1px solid ${BORDER}`,
                                                            color: m.deleted ? SUB : (isMine ? '#fff' : TEXT),
                                                            fontSize: 14,
                                                            lineHeight: 1.5,
                                                            fontStyle: m.deleted ? 'italic' : 'normal',
                                                            opacity: isOptimistic ? 0.7 : 1,
                                                        }}>
                                                            {m.deleted ? 'This message was deleted' : m.content}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: isMine ? 'flex-end' : 'flex-start', marginTop: 3 }}>
                                                            <span style={{ fontSize: 11, color: `${SUB}99` }}>{fullTime(m.createdAt)}</span>
                                                            {m.editedAt && <span style={{ fontSize: 11, color: `${SUB}88` }}>· edited</span>}
                                                            {isMine && !isOptimistic && <CheckCheck size={12} color={`${SUB}99`} />}
                                                            {isOptimistic && <Check size={12} color={`${SUB}88`} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={msgBottomRef} />
                                </div>

                                {/* Input bar */}
                                <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '10px 14px', transition: 'border-color 0.15s' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = `${PRIMARY}60`}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = BORDER}
                                    >
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex', flexShrink: 0 }}>
                                            <Smile size={18} />
                                        </button>
                                        <textarea
                                            ref={inputRef}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                            placeholder={`Message ${convDisplayName(activeConv)}…`}
                                            rows={1}
                                            style={{ flex: 1, background: 'none', border: 'none', color: TEXT, fontSize: 14, fontFamily: FONT, resize: 'none', outline: 'none', maxHeight: 120, overflowY: 'auto', lineHeight: '22px' }}
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={!input.trim() || sending}
                                            style={{ width: 34, height: 34, borderRadius: 10, background: input.trim() ? PRIMARY : S_HIGH, border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                                        >
                                            <Send size={15} color={input.trim() ? '#fff' : SUB} />
                                        </button>
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: 6 }}>
                                        <span style={{ fontSize: 11, color: `${SUB}66` }}>End-to-end encrypted · Enter to send · Shift+Enter for new line</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
