import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthProvider';
import { MessageCircle, Send, Search, Plus, Users, Lock, ArrowLeft, X, Minimize2, Maximize2, Trash2, MoreVertical, BellOff, Bell, UserPlus, LogOut } from 'lucide-react';

const C = {
    bg: '#161925', surface: 'rgba(36, 44, 61, 0.95)', surfaceSolid: '#1A1E2E',
    border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.12)',
    primary: '#3BA886', primaryGlow: 'rgba(59,168,134,0.15)',
    text: '#F8FAFC', textSec: '#8B95A5', textTer: '#5C6370',
    error: '#F87171', accent: '#60A5FA',
    bubble: 'rgba(255,255,255,0.05)', bubbleMine: '#3BA886',
};

interface UserResult { userId: string; username: string; displayName: string | null; avatar: string | null; }
interface Conversation { id: string; name: string | null; isGroup: boolean; participants: UserResult[]; lastMessagePreview: string | null; lastMessageAt: string | null; lastMessageSenderId: string | null; unread: number; muted: boolean; createdAt: string; }
interface Message { id: string; senderId: string; content: string | null; deleted: boolean; createdAt: string; editedAt: string | null; }

const avatarUrl = (u: UserResult) => {
    if (u.avatar?.startsWith('http') || u.avatar?.startsWith('/')) return u.avatar;
    if (u.avatar && u.userId) return `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&background=242A3D&color=F8FAFC&size=64`;
};

const formatTime = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMsgTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const MessengerPopup: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [participantMap, setParticipantMap] = useState<Record<string, UserResult>>({});
    const [showNewChat, setShowNewChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [convFilter, setConvFilter] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchConversations = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/messages/conversations', { withCredentials: true });
            setConversations(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchConversations().then(() => setLoading(false));
        }
    }, [isOpen, fetchConversations]);

    // Poll conversations
    useEffect(() => {
        if (!isOpen) return;
        const iv = setInterval(fetchConversations, 5000);
        return () => clearInterval(iv);
    }, [isOpen, fetchConversations]);

    const fetchMessages = useCallback(async (convId: string) => {
        try {
            const { data } = await axios.get(`/api/messages/conversations/${convId}/messages`, { withCredentials: true });
            setMessages(data);
        } catch { /* silent */ }
    }, []);

    const openConversation = async (convId: string) => {
        setActiveConvId(convId);
        setShowNewChat(false);
        setMsgsLoading(true);
        setMessages([]);
        await fetchMessages(convId);
        setMsgsLoading(false);
        axios.put(`/api/messages/conversations/${convId}/read`, {}, { withCredentials: true }).catch(() => {});
        try {
            const { data } = await axios.get(`/api/messages/conversations/${convId}`, { withCredentials: true });
            const map: Record<string, UserResult> = {};
            data.participants.forEach((p: UserResult) => { map[p.userId] = p; });
            setParticipantMap(map);
        } catch {}
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // Poll active conversation
    useEffect(() => {
        if (!isOpen || !activeConvId) return;
        const iv = setInterval(() => fetchMessages(activeConvId), 3000);
        return () => clearInterval(iv);
    }, [isOpen, activeConvId, fetchMessages]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isMinimized]);

    const sendMessage = async () => {
        if (!input.trim() || !activeConvId) return;
        const content = input.trim();
        setInput('');
        const temp: Message = { id: `temp-${Date.now()}`, senderId: user!.id, content, deleted: false, createdAt: new Date().toISOString(), editedAt: null };
        setMessages(prev => [...prev, temp]);
        try {
            await axios.post(`/api/messages/conversations/${activeConvId}/messages`, { content }, { withCredentials: true });
            await fetchMessages(activeConvId);
        } catch { /* silent */ }
    };

    const deleteMessage = async (msgId: string) => {
        if (!activeConvId) return;
        try {
            await axios.delete(`/api/messages/conversations/${activeConvId}/messages/${msgId}`, { withCredentials: true });
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, content: null } : m));
        } catch { /* silent */ }
    };

    // User search for new chat
    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const { data } = await axios.get(`/api/messages/search-users?q=${encodeURIComponent(searchQuery)}`, { withCredentials: true });
                setSearchResults(data);
            } catch { setSearchResults([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const startConversation = async () => {
        if (selectedUsers.length === 0) return;
        try {
            const { data } = await axios.post('/api/messages/conversations', {
                participantIds: selectedUsers.map(u => u.userId),
                isGroup: isGroup || selectedUsers.length > 1,
                name: isGroup ? groupName || undefined : undefined,
            }, { withCredentials: true });
            setShowNewChat(false);
            setSelectedUsers([]);
            setSearchQuery('');
            setGroupName('');
            setIsGroup(false);
            await fetchConversations();
            openConversation(data.id);
        } catch { /* silent */ }
    };

    const toggleMute = async () => {
        if (!activeConvId) return;
        const conv = conversations.find(c => c.id === activeConvId);
        if (!conv) return;
        try {
            await axios.patch(`/api/messages/conversations/${activeConvId}`, { muted: !conv.muted }, { withCredentials: true });
            fetchConversations();
            setShowMenu(false);
        } catch { /* silent */ }
    };

    const leaveGroup = async () => {
        if (!activeConvId) return;
        try {
            await axios.delete(`/api/messages/conversations/${activeConvId}/leave`, { withCredentials: true });
            setActiveConvId(null);
            fetchConversations();
            setShowMenu(false);
        } catch { /* silent */ }
    };

    const activeConv = conversations.find(c => c.id === activeConvId);
    const convDisplayName = (conv: Conversation) => {
        if (conv.isGroup && conv.name) return conv.name;
        if (conv.participants.length > 0) return conv.participants.map(p => p.displayName || p.username).join(', ');
        return 'Conversation';
    };

    const filteredConvos = convFilter
        ? conversations.filter(c => convDisplayName(c).toLowerCase().includes(convFilter.toLowerCase()))
        : conversations;

    if (!isOpen || !user) return null;

    const WIDTH = activeConvId ? 400 : 340;
    const HEIGHT = isMinimized ? 48 : 520;

    return (
        <div style={{
            position: 'fixed', bottom: '24px', right: '24px',
            width: `${WIDTH}px`, height: `${HEIGHT}px`,
            background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.97), rgba(26, 30, 46, 0.99))',
            borderRadius: '16px', border: `1px solid ${C.border}`,
            boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            zIndex: 10000, backdropFilter: 'blur(12px)',
            transition: 'width 0.25s ease, height 0.25s ease',
        }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    {activeConvId && !isMinimized ? (
                        <>
                            <button onClick={() => { setActiveConvId(null); setShowMenu(false); }} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 2, display: 'flex' }}>
                                <ArrowLeft size={16} />
                            </button>
                            {activeConv?.isGroup ? (
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #3BA886, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Users size={11} color="white" />
                                </div>
                            ) : activeConv?.participants[0] ? (
                                <img src={avatarUrl(activeConv.participants[0])} style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} alt="" />
                            ) : null}
                            <span style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeConv ? convDisplayName(activeConv) : ''}
                            </span>
                        </>
                    ) : (
                        <>
                            <Lock size={12} color={C.primary} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Messages</span>
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {activeConvId && !isMinimized && (
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 4, display: 'flex' }}>
                                <MoreVertical size={14} />
                            </button>
                            {showMenu && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 2, background: C.surfaceSolid, border: `1px solid ${C.borderLight}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                    <button onClick={toggleMute} style={{ ...menuBtnStyle }}>{activeConv?.muted ? <><Bell size={12} /> Unmute</> : <><BellOff size={12} /> Mute</>}</button>
                                    {activeConv?.isGroup && (
                                        <button onClick={leaveGroup} style={{ ...menuBtnStyle, color: C.error }}><LogOut size={12} /> Leave</button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 4, display: 'flex' }}>
                        {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                    </button>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* ===== CONVERSATION LIST VIEW ===== */}
                    {!activeConvId && !showNewChat && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Search + New */}
                            <div style={{ padding: '8px 12px', display: 'flex', gap: '6px', borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={12} color={C.textTer} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                                    <input value={convFilter} onChange={e => setConvFilter(e.target.value)} placeholder="Search…"
                                        style={{ width: '100%', padding: '6px 6px 6px 26px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <button onClick={() => setShowNewChat(true)} style={{ background: C.primary, border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="New message">
                                    <Plus size={13} color="white" />
                                </button>
                            </div>
                            {/* List */}
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {loading && <div style={{ padding: 20, textAlign: 'center', color: C.textSec, fontSize: '12px' }}>Loading…</div>}
                                {!loading && filteredConvos.length === 0 && (
                                    <div style={{ padding: '30px 16px', textAlign: 'center', color: C.textTer, fontSize: '12px' }}>
                                        <MessageCircle size={24} style={{ opacity: 0.3, marginBottom: 6 }} /><br />
                                        No conversations yet
                                        <br />
                                        <button onClick={() => setShowNewChat(true)} style={{ marginTop: 8, background: 'none', border: `1px solid ${C.primary}`, color: C.primary, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Start one</button>
                                    </div>
                                )}
                                {filteredConvos.map(conv => (
                                    <div key={conv.id} onClick={() => openConversation(conv.id)}
                                        style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            {conv.isGroup ? (
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3BA886, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Users size={15} color="white" />
                                                </div>
                                            ) : (
                                                <img src={avatarUrl(conv.participants[0] || { userId: '', username: '?', displayName: null, avatar: null })}
                                                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                            )}
                                            {conv.unread > 0 && (
                                                <div style={{ position: 'absolute', top: -2, right: -2, background: C.primary, color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, border: `2px solid ${C.surfaceSolid}` }}>
                                                    {conv.unread > 9 ? '9+' : conv.unread}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
                                                <span style={{ fontWeight: conv.unread > 0 ? 700 : 500, fontSize: '12px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                                    {convDisplayName(conv)}
                                                </span>
                                                <span style={{ fontSize: '9px', color: C.textTer, flexShrink: 0 }}>{conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}</span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: conv.unread > 0 ? C.textSec : C.textTer, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {conv.muted && <BellOff size={9} style={{ marginRight: 3, verticalAlign: 'middle', opacity: 0.5 }} />}
                                                {conv.lastMessagePreview || 'No messages yet'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Open full page link */}
                            <a href="/messages" style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: C.primary, textDecoration: 'none', borderTop: `1px solid ${C.border}`, display: 'block', fontWeight: 600 }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,168,134,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                Open Messages
                            </a>
                        </div>
                    )}

                    {/* ===== NEW CHAT VIEW ===== */}
                    {!activeConvId && showNewChat && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={() => { setShowNewChat(false); setSelectedUsers([]); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 2, display: 'flex' }}>
                                    <ArrowLeft size={14} />
                                </button>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>New Message</span>
                            </div>
                            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: C.textSec, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={isGroup} onChange={e => setIsGroup(e.target.checked)} style={{ accentColor: C.primary }} />
                                    <Users size={12} /> Group Chat
                                </label>
                                {isGroup && (
                                    <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name (optional)"
                                        style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: '11px', outline: 'none' }} />
                                )}
                                {selectedUsers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {selectedUsers.map(u => (
                                            <span key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 3, background: C.primaryGlow, border: `1px solid ${C.primary}33`, borderRadius: 16, padding: '3px 8px 3px 4px', fontSize: '10px', color: C.text }}>
                                                <img src={avatarUrl(u)} style={{ width: 14, height: 14, borderRadius: '50%' }} alt="" />
                                                {u.displayName || u.username}
                                                <button onClick={() => setSelectedUsers(prev => prev.filter(p => p.userId !== u.userId))} style={{ background: 'none', border: 'none', color: C.textTer, cursor: 'pointer', padding: 0, display: 'flex' }}><X size={10} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <Search size={12} color={C.textTer} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users…" autoFocus
                                        style={{ width: '100%', padding: '7px 7px 7px 26px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                                {searchResults.filter(r => !selectedUsers.some(s => s.userId === r.userId)).map(u => (
                                    <div key={u.userId} onClick={() => { setSelectedUsers(prev => [...prev, u]); setSearchQuery(''); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <img src={avatarUrl(u)} style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: 500, color: C.text }}>{u.displayName || u.username}</div>
                                            {u.displayName && <div style={{ fontSize: '10px', color: C.textTer }}>@{u.username}</div>}
                                        </div>
                                    </div>
                                ))}
                                {searchQuery.length >= 2 && searchResults.length === 0 && (
                                    <div style={{ padding: 16, textAlign: 'center', color: C.textTer, fontSize: '11px' }}>No users found</div>
                                )}
                            </div>
                            <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}` }}>
                                <button onClick={startConversation} disabled={selectedUsers.length === 0}
                                    style={{ width: '100%', padding: '8px', background: selectedUsers.length > 0 ? C.primary : 'rgba(255,255,255,0.04)', color: selectedUsers.length > 0 ? 'white' : C.textTer, border: 'none', borderRadius: 6, cursor: selectedUsers.length > 0 ? 'pointer' : 'default', fontWeight: 600, fontSize: '12px' }}>
                                    {isGroup ? 'Create Group' : 'Start Conversation'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== CHAT VIEW ===== */}
                    {activeConvId && (
                        <>
                            {/* Encrypted indicator */}
                            <div style={{ padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '9px', color: C.textTer, background: 'rgba(0,0,0,0.15)' }}>
                                <Lock size={8} /> Encrypted
                                {activeConv?.isGroup && ` · ${(activeConv.participants.length + 1)} members`}
                            </div>
                            {/* Messages */}
                            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '3px', scrollBehavior: 'smooth' }}>
                                {msgsLoading && <div style={{ textAlign: 'center', color: C.textTer, padding: 20, fontSize: '11px' }}>Loading…</div>}
                                {!msgsLoading && messages.length === 0 && (
                                    <div style={{ textAlign: 'center', color: C.textTer, padding: 30, fontSize: '11px' }}>
                                        <Lock size={16} style={{ opacity: 0.3, marginBottom: 6 }} /><br />
                                        Send the first message!
                                    </div>
                                )}
                                {messages.map((msg, i) => {
                                    const isMine = msg.senderId === user!.id;
                                    const sender = participantMap[msg.senderId];
                                    const showAvatar = !isMine && (i === 0 || messages[i - 1].senderId !== msg.senderId);
                                    const showName = activeConv?.isGroup && !isMine && showAvatar;
                                    return (
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: showAvatar ? 6 : 0 }}>
                                            {showName && sender && (
                                                <div style={{ fontSize: '10px', color: C.accent, fontWeight: 600, marginBottom: 1, marginLeft: 28 }}>
                                                    {sender.displayName || sender.username}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                                                {!isMine && showAvatar && sender && (
                                                    <img src={avatarUrl(sender)} style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} alt="" />
                                                )}
                                                {!isMine && !showAvatar && <div style={{ width: 22, flexShrink: 0 }} />}
                                                <div style={{ position: 'relative', maxWidth: '80%' }}
                                                    onMouseEnter={e => { const d = e.currentTarget.querySelector('.msg-del') as HTMLElement; if (d) d.style.opacity = '1'; }}
                                                    onMouseLeave={e => { const d = e.currentTarget.querySelector('.msg-del') as HTMLElement; if (d) d.style.opacity = '0'; }}>
                                                    <div style={{
                                                        padding: '6px 10px', borderRadius: '12px', fontSize: '12px', lineHeight: '1.4', wordBreak: 'break-word',
                                                        background: msg.deleted ? 'transparent' : isMine ? C.bubbleMine : C.bubble,
                                                        color: msg.deleted ? C.textTer : '#FFFFFF',
                                                        fontStyle: msg.deleted ? 'italic' : 'normal',
                                                        border: msg.deleted ? `1px solid ${C.border}` : isMine ? 'none' : `1px solid ${C.border}`,
                                                        borderTopRightRadius: isMine ? '3px' : '12px',
                                                        borderTopLeftRadius: isMine ? '12px' : (showAvatar ? '3px' : '12px'),
                                                    }}>
                                                        {msg.deleted ? 'Deleted' : msg.content}
                                                    </div>
                                                    <div style={{ fontSize: '9px', color: C.textTer, marginTop: 1, textAlign: isMine ? 'right' : 'left', paddingLeft: 2, paddingRight: 2 }}>
                                                        {formatMsgTime(msg.createdAt)}
                                                    </div>
                                                    {isMine && !msg.deleted && (
                                                        <div className="msg-del" style={{ position: 'absolute', top: 2, left: -20, opacity: 0, transition: 'opacity 0.1s' }}>
                                                            <button onClick={() => deleteMessage(msg.id)} style={{ background: 'none', border: 'none', borderRadius: '50%', padding: 2, cursor: 'pointer', color: C.textTer, display: 'flex' }} title="Delete">
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
                            <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                        placeholder="Type a message…"
                                        style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                                    <button onClick={sendMessage} disabled={!input.trim()}
                                        style={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: input.trim() ? C.primary : 'rgba(255,255,255,0.04)', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Send size={13} color={input.trim() ? 'white' : C.textTer} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

const menuBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4,
    color: '#B9C3CE', fontSize: '11px', fontWeight: 500, background: 'none', border: 'none',
    cursor: 'pointer', width: '100%', textAlign: 'left',
};
