import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthProvider';
import { useChat, Conversation, Message, UserResult } from './ChatProvider';
import { Send, X, Minimize2, Maximize2, Trash2, Lock, Users, MoreVertical, BellOff, Bell, LogOut, Archive } from 'lucide-react';
import { ReportButton } from './ReportButton';

const C = {
    bg: '#161925', surface: '#1A1E2E', surfaceDark: 'rgba(22, 25, 37, 0.98)',
    border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.12)',
    primary: '#D4700A', primaryGlow: 'rgba(59,168,134,0.15)',
    text: '#F8FAFC', textSec: '#8B95A5', textTer: '#5C6370',
    error: '#F87171', accent: '#60A5FA',
    bubble: 'rgba(255,255,255,0.05)', bubbleMine: '#D4700A',
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
    const { conversations, closeChat, minimizeChat, restoreChat, archiveChat } = useChat();
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
    const HEAD_SIZE = 48;
    const HEAD_GAP = 8;

    // Minimized heads stack tightly; expanded windows use full width spacing
    const rightPos = minimized
        ? RIGHT_OFFSET + index * (HEAD_SIZE + HEAD_GAP)
        : RIGHT_OFFSET + index * (CHAT_WIDTH + CHAT_GAP);

    if (!user) return null;

    // Minimized: Facebook-style circular chat head
    if (minimized) {
        return (
            <div onClick={() => restoreChat(convId)} style={{
                position: 'fixed', bottom: '24px', right: `${rightPos}px`,
                width: `${HEAD_SIZE}px`, height: `${HEAD_SIZE}px`,
                borderRadius: '50%', cursor: 'pointer', zIndex: 9998,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: `2px solid ${conv && conv.unread > 0 ? C.primary : C.border}`,
                overflow: 'visible',
            }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.6)'; const cl = e.currentTarget.querySelector('.chat-head-close') as HTMLElement; if (cl) cl.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)'; const cl = e.currentTarget.querySelector('.chat-head-close') as HTMLElement; if (cl) cl.style.opacity = '0'; }}
            >
                {conv?.isGroup ? (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #D4700A, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} color="white" />
                    </div>
                ) : conv?.participants[0] ? (
                    <img src={avatarUrl(conv.participants[0])} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={displayName} />
                ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1E2536', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSec, fontSize: '16px', fontWeight: 700 }}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                )}
                {/* Unread badge */}
                {conv && conv.unread > 0 && (
                    <div style={{
                        position: 'absolute', top: -4, right: -4,
                        background: '#E53E3E', color: 'white', borderRadius: '50%',
                        width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, border: '2px solid #161925',
                    }}>
                        {conv.unread > 9 ? '9+' : conv.unread}
                    </div>
                )}
                {/* Close X on hover — rendered via CSS-in-JS */}
                <div
                    className="chat-head-close"
                    onClick={e => { e.stopPropagation(); closeChat(convId); }}
                    style={{
                        position: 'absolute', top: -6, left: -6,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#2D3348', border: `1px solid ${C.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.15s', cursor: 'pointer',
                    }}
                >
                    <X size={10} color={C.textSec} />
                </div>
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
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #D4700A, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                                <button onClick={() => { archiveChat(convId); setShowMenu(false); }} style={menuBtn}><Archive size={11} /> Archive</button>
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
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: showAvatar ? 4 : 0, width: '100%' }}>
                            {showName && sender && (
                                <div style={{ fontSize: '9px', color: C.accent, fontWeight: 600, marginBottom: 1, marginLeft: 24 }}>{sender.displayName || sender.username}</div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, maxWidth: '100%' }}>
                                {!isMine && showAvatar && sender && (
                                    <img src={avatarUrl(sender)} style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} alt="" />
                                )}
                                {!isMine && !showAvatar && <div style={{ width: 20, flexShrink: 0 }} />}
                                <div style={{ position: 'relative', minWidth: 0, flex: '1 1 auto' }}
                                    onMouseEnter={e => { const d = e.currentTarget.querySelector('.del-btn') as HTMLElement; if (d) d.style.opacity = '1'; }}
                                    onMouseLeave={e => { const d = e.currentTarget.querySelector('.del-btn') as HTMLElement; if (d) d.style.opacity = '0'; }}>
                                    <div style={{
                                        display: 'inline-block', padding: '6px 10px', borderRadius: '10px', fontSize: '13px', lineHeight: '1.4', overflowWrap: 'break-word', wordBreak: 'normal', maxWidth: '100%',
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
                                    {!isMine && !msg.deleted && (
                                        <div className="del-btn" style={{ position: 'absolute', top: 2, right: -18, opacity: 0, transition: 'opacity 0.1s' }}>
                                            <ReportButton targetType="message" targetId={msg.id} iconOnly style={{ padding: 1, fontSize: '10px' }} />
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
