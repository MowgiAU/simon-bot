import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthProvider';
import { useChat, Conversation, Message, UserResult } from './ChatProvider';
import { Send, X, Minimize2, Maximize2, Trash2, Lock, Users, MoreVertical, BellOff, Bell, LogOut } from 'lucide-react';

const C = {
    bg: '#161925', surface: '#1A1E2E', surfaceDark: 'rgba(22, 25, 37, 0.98)',
    border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.12)',
    primary: '#3BA886', primaryGlow: 'rgba(59,168,134,0.15)',
    text: '#F8FAFC', textSec: '#8B95A5', textTer: '#5C6370',
    error: '#F87171', accent: '#60A5FA',
    bubble: 'rgba(255,255,255,0.05)', bubbleMine: '#3BA886',
};

const avatarUrl = (u: UserResult) => {
    if (u.avatar?.startsWith('http') || u.avatar?.startsWith('/')) return u.avatar;
    if (u.avatar && u.userId) return `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&background=242A3D&color=F8FAFC&size=64`;
};

const formatMsgTime = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface ChatHeadProps {
    convId: string;
    index: number; // position index (0 = rightmost)
    minimized: boolean;
}

export const ChatHead: React.FC<ChatHeadProps> = ({ convId, index, minimized }) => {
    const { user } = useAuth();
    const { conversations, closeChat, minimizeChat, restoreChat } = useChat();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [participantMap, setParticipantMap] = useState<Record<string, UserResult>>({});
    const [showMenu, setShowMenu] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const conv = conversations.find(c => c.id === convId);

    const fetchMessages = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/messages/conversations/${convId}/messages`, { withCredentials: true });
            setMessages(data);
        } catch { /* silent */ }
    }, [convId]);

    // Load messages + participants on mount
    useEffect(() => {
        fetchMessages().then(() => setLoading(false));
        axios.put(`/api/messages/conversations/${convId}/read`, {}, { withCredentials: true }).catch(() => {});
        axios.get(`/api/messages/conversations/${convId}`, { withCredentials: true }).then(({ data }) => {
            const map: Record<string, UserResult> = {};
            data.participants.forEach((p: UserResult) => { map[p.userId] = p; });
            setParticipantMap(map);
        }).catch(() => {});
    }, [convId, fetchMessages]);

    // Poll messages
    useEffect(() => {
        if (minimized) return;
        const iv = setInterval(fetchMessages, 3000);
        return () => clearInterval(iv);
    }, [minimized, fetchMessages]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    // Focus input when restored
    useEffect(() => {
        if (!minimized) setTimeout(() => inputRef.current?.focus(), 100);
    }, [minimized]);

    const sendMessage = async () => {
        if (!input.trim()) return;
        const content = input.trim();
        setInput('');
        const temp: Message = { id: `temp-${Date.now()}`, senderId: user!.id, content, deleted: false, createdAt: new Date().toISOString(), editedAt: null };
        setMessages(prev => [...prev, temp]);
        try {
            await axios.post(`/api/messages/conversations/${convId}/messages`, { content }, { withCredentials: true });
            await fetchMessages();
        } catch { /* silent */ }
    };

    const deleteMessage = async (msgId: string) => {
        try {
            await axios.delete(`/api/messages/conversations/${convId}/messages/${msgId}`, { withCredentials: true });
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, content: null } : m));
        } catch { /* silent */ }
    };

    const toggleMute = async () => {
        if (!conv) return;
        try {
            await axios.patch(`/api/messages/conversations/${convId}`, { muted: !conv.muted }, { withCredentials: true });
            setShowMenu(false);
        } catch { /* silent */ }
    };

    const leaveGroup = async () => {
        try {
            await axios.delete(`/api/messages/conversations/${convId}/leave`, { withCredentials: true });
            closeChat(convId);
        } catch { /* silent */ }
    };

    const convDisplayName = (c: Conversation) => {
        if (c.isGroup && c.name) return c.name;
        if (c.participants.length > 0) return c.participants.map(p => p.displayName || p.username).join(', ');
        return 'Chat';
    };

    const displayName = conv ? convDisplayName(conv) : 'Chat';
    const RIGHT_OFFSET = 24;
    const CHAT_WIDTH = 360;
    const CHAT_GAP = 12;
    const rightPos = RIGHT_OFFSET + index * (CHAT_WIDTH + CHAT_GAP);

    if (!user) return null;

    // Minimized: just a small pill
    if (minimized) {
        return (
            <div onClick={() => restoreChat(convId)} style={{
                position: 'fixed', bottom: '24px', right: `${rightPos}px`,
                width: `${CHAT_WIDTH}px`, height: '44px',
                background: 'linear-gradient(135deg, #1E2536, #1A1E2E)', borderRadius: '12px',
                border: `1px solid ${C.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', padding: '0 12px', gap: '10px',
                cursor: 'pointer', zIndex: 9998, transition: 'box-shadow 0.15s',
            }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.5)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'}
            >
                {conv?.isGroup ? (
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #3BA886, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={12} color="white" />
                    </div>
                ) : conv?.participants[0] ? (
                    <img src={avatarUrl(conv.participants[0])} style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} alt="" />
                ) : null}
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                {conv && conv.unread > 0 && (
                    <div style={{ background: C.primary, color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                        {conv.unread > 9 ? '9+' : conv.unread}
                    </div>
                )}
                <button onClick={e => { e.stopPropagation(); closeChat(convId); }} style={{ background: 'none', border: 'none', color: C.textTer, cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
                    <X size={14} />
                </button>
            </div>
        );
    }

    // Full chat head
    return (
        <div style={{
            position: 'fixed', bottom: '24px', right: `${rightPos}px`,
            width: `${CHAT_WIDTH}px`, height: '420px',
            background: 'linear-gradient(160deg, rgba(30, 37, 54, 0.98), rgba(22, 25, 37, 0.99))',
            borderRadius: '14px', border: `1px solid ${C.borderLight}`,
            boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            zIndex: 9998, backdropFilter: 'blur(12px)',
        }}>
            {/* Header */}
            <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, cursor: 'pointer' }}
                onClick={() => minimizeChat(convId)}>
                {conv?.isGroup ? (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #3BA886, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={13} color="white" />
                    </div>
                ) : conv?.participants[0] ? (
                    <img src={avatarUrl(conv.participants[0])} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} alt="" />
                ) : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                    <div style={{ fontSize: '9px', color: C.textTer, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Lock size={7} /> Encrypted{conv?.isGroup ? ` · ${conv.participants.length + 1}` : ''}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowMenu(!showMenu)} style={iconBtn}><MoreVertical size={13} /></button>
                        {showMenu && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 2, background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                <button onClick={toggleMute} style={menuBtn}>{conv?.muted ? <><Bell size={11} /> Unmute</> : <><BellOff size={11} /> Mute</>}</button>
                                {conv?.isGroup && <button onClick={leaveGroup} style={{ ...menuBtn, color: C.error }}><LogOut size={11} /> Leave</button>}
                            </div>
                        )}
                    </div>
                    <button onClick={() => minimizeChat(convId)} style={iconBtn}><Minimize2 size={13} /></button>
                    <button onClick={() => closeChat(convId)} style={iconBtn}><X size={13} /></button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '2px', scrollBehavior: 'smooth' }}>
                {loading && <div style={{ textAlign: 'center', color: C.textTer, padding: 20, fontSize: '11px' }}>Loading…</div>}
                {!loading && messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: C.textTer, padding: 24, fontSize: '11px' }}>
                        <Lock size={14} style={{ opacity: 0.3, marginBottom: 4 }} /><br />Send the first message!
                    </div>
                )}
                {messages.map((msg, i) => {
                    const isMine = msg.senderId === user!.id;
                    const sender = participantMap[msg.senderId];
                    const showAvatar = !isMine && (i === 0 || messages[i - 1].senderId !== msg.senderId);
                    const showName = conv?.isGroup && !isMine && showAvatar;
                    return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: showAvatar ? 4 : 0 }}>
                            {showName && sender && (
                                <div style={{ fontSize: '9px', color: C.accent, fontWeight: 600, marginBottom: 1, marginLeft: 24 }}>{sender.displayName || sender.username}</div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
                                {!isMine && showAvatar && sender && (
                                    <img src={avatarUrl(sender)} style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} alt="" />
                                )}
                                {!isMine && !showAvatar && <div style={{ width: 20, flexShrink: 0 }} />}
                                <div style={{ position: 'relative', maxWidth: '85%' }}
                                    onMouseEnter={e => { const d = e.currentTarget.querySelector('.del-btn') as HTMLElement; if (d) d.style.opacity = '1'; }}
                                    onMouseLeave={e => { const d = e.currentTarget.querySelector('.del-btn') as HTMLElement; if (d) d.style.opacity = '0'; }}>
                                    <div style={{
                                        padding: '5px 9px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.4', wordBreak: 'break-word',
                                        background: msg.deleted ? 'transparent' : isMine ? C.bubbleMine : C.bubble,
                                        color: msg.deleted ? C.textTer : '#FFFFFF',
                                        fontStyle: msg.deleted ? 'italic' : 'normal',
                                        border: msg.deleted ? `1px solid ${C.border}` : isMine ? 'none' : `1px solid ${C.border}`,
                                        borderTopRightRadius: isMine ? '3px' : '10px',
                                        borderTopLeftRadius: isMine ? '10px' : (showAvatar ? '3px' : '10px'),
                                    }}>
                                        {msg.deleted ? 'Deleted' : msg.content}
                                    </div>
                                    <div style={{ fontSize: '8px', color: C.textTer, marginTop: 1, textAlign: isMine ? 'right' : 'left', padding: '0 2px' }}>
                                        {formatMsgTime(msg.createdAt)}
                                    </div>
                                    {isMine && !msg.deleted && (
                                        <div className="del-btn" style={{ position: 'absolute', top: 2, left: -18, opacity: 0, transition: 'opacity 0.1s' }}>
                                            <button onClick={() => deleteMessage(msg.id)} style={{ background: 'none', border: 'none', padding: 1, cursor: 'pointer', color: C.textTer, display: 'flex' }} title="Delete">
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <div style={{ padding: '7px 10px', borderTop: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.1)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Type a message…"
                        style={{ flex: 1, padding: '7px 9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    <button onClick={sendMessage} disabled={!input.trim()}
                        style={{ width: 30, height: 30, borderRadius: '7px', backgroundColor: input.trim() ? C.primary : 'rgba(255,255,255,0.04)', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Send size={12} color={input.trim() ? 'white' : C.textTer} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#8B95A5', cursor: 'pointer', padding: 3, display: 'flex', borderRadius: 4 };
const menuBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 4, color: '#B9C3CE', fontSize: '11px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' };
