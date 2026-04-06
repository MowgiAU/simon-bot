import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { showToast } from '../components/Toast';
import { MessageCircle, Send, Search, Plus, Users, Lock, ArrowLeft, MoreVertical, UserPlus, BellOff, Bell, LogOut, Trash2, X, Shield } from 'lucide-react';

const C = {
    bg: '#161925', surface: '#1A1E2E', surfaceLight: '#242A3D',
    border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.12)',
    primary: '#3BA886', primaryGlow: 'rgba(59,168,134,0.15)',
    text: '#F8FAFC', textSec: '#8B95A5', textTer: '#5C6370',
    error: '#F87171', accent: '#60A5FA',
    bubble: '#242A3D', bubbleMine: '#1E3A35',
};

interface UserResult { userId: string; username: string; displayName: string | null; avatar: string | null; }
interface Conversation { id: string; name: string | null; isGroup: boolean; participants: UserResult[]; lastMessagePreview: string | null; lastMessageAt: string | null; lastMessageSenderId: string | null; unread: number; muted: boolean; createdAt: string; }
interface Message { id: string; senderId: string; content: string | null; deleted: boolean; createdAt: string; editedAt: string | null; }

const avatarUrl = (user: UserResult) => {
    if (user.avatar?.startsWith('http') || user.avatar?.startsWith('/')) return user.avatar;
    if (user.avatar && user.userId) return `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.username)}&background=242A3D&color=F8FAFC&size=64`;
};

const formatTime = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMsgTime = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const MessagesPage: React.FC = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [convFilter, setConvFilter] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [addUserSearch, setAddUserSearch] = useState('');
    const [addUserResults, setAddUserResults] = useState<UserResult[]>([]);
    const [showAddUser, setShowAddUser] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [participantMap, setParticipantMap] = useState<Record<string, UserResult>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', h); return () => window.removeEventListener('resize', h);
    }, []);

    const fetchConversations = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/messages/conversations', { withCredentials: true });
            setConversations(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchConversations().then(() => setLoading(false)); }, [fetchConversations]);

    // Poll conversations for new messages
    useEffect(() => {
        const iv = setInterval(fetchConversations, 5000);
        return () => clearInterval(iv);
    }, [fetchConversations]);

    const fetchMessages = useCallback(async (convId: string) => {
        try {
            const { data } = await axios.get(`/api/messages/conversations/${convId}/messages`, { withCredentials: true });
            setMessages(data);
        } catch { showToast('Failed to load messages', 'error'); }
    }, []);

    const openConversation = async (convId: string) => {
        setActiveConvId(convId);
        setMsgsLoading(true);
        setMessages([]);
        await fetchMessages(convId);
        setMsgsLoading(false);
        // Mark as read
        axios.put(`/api/messages/conversations/${convId}/read`, {}, { withCredentials: true }).catch(() => {});
        // Fetch participant details
        try {
            const { data } = await axios.get(`/api/messages/conversations/${convId}`, { withCredentials: true });
            const map: Record<string, UserResult> = {};
            data.participants.forEach((p: UserResult) => { map[p.userId] = p; });
            setParticipantMap(map);
        } catch {}
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // Poll active conversation for new messages
    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (!activeConvId) return;
        pollRef.current = setInterval(() => fetchMessages(activeConvId), 3000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [activeConvId, fetchMessages]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || !activeConvId) return;
        const content = input.trim();
        setInput('');
        // Optimistic add
        const temp: Message = { id: `temp-${Date.now()}`, senderId: user!.id, content, deleted: false, createdAt: new Date().toISOString(), editedAt: null };
        setMessages(prev => [...prev, temp]);
        try {
            await axios.post(`/api/messages/conversations/${activeConvId}/messages`, { content }, { withCredentials: true });
            await fetchMessages(activeConvId);
        } catch { showToast('Failed to send', 'error'); }
    };

    const deleteMessage = async (msgId: string) => {
        if (!activeConvId) return;
        try {
            await axios.delete(`/api/messages/conversations/${activeConvId}/messages/${msgId}`, { withCredentials: true });
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, content: null } : m));
        } catch { showToast('Failed to delete', 'error'); }
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

    // Add user search for group
    useEffect(() => {
        if (addUserSearch.length < 2) { setAddUserResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const { data } = await axios.get(`/api/messages/search-users?q=${encodeURIComponent(addUserSearch)}`, { withCredentials: true });
                setAddUserResults(data);
            } catch { setAddUserResults([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [addUserSearch]);

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
        } catch { showToast('Failed to create conversation', 'error'); }
    };

    const toggleMute = async () => {
        if (!activeConvId) return;
        const conv = conversations.find(c => c.id === activeConvId);
        if (!conv) return;
        try {
            await axios.patch(`/api/messages/conversations/${activeConvId}`, { muted: !conv.muted }, { withCredentials: true });
            fetchConversations();
            setShowMenu(false);
        } catch { showToast('Failed', 'error'); }
    };

    const leaveGroup = async () => {
        if (!activeConvId) return;
        try {
            await axios.delete(`/api/messages/conversations/${activeConvId}/leave`, { withCredentials: true });
            setActiveConvId(null);
            fetchConversations();
            setShowMenu(false);
        } catch { showToast('Failed to leave', 'error'); }
    };

    const addUserToGroup = async (u: UserResult) => {
        if (!activeConvId) return;
        try {
            await axios.post(`/api/messages/conversations/${activeConvId}/participants`, { userIds: [u.userId] }, { withCredentials: true });
            showToast(`Added ${u.displayName || u.username}`, 'success');
            setShowAddUser(false);
            setAddUserSearch('');
        } catch { showToast('Failed to add user', 'error'); }
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

    const showList = !isMobile || !activeConvId;
    const showChat = !isMobile || !!activeConvId;

    if (!user) return <DiscoveryLayout><div style={{ padding: 40, textAlign: 'center', color: C.textSec }}>Please log in to access messages.</div></DiscoveryLayout>;

    return (
        <DiscoveryLayout activeTab="">
            <div style={{ height: 'calc(100vh - 60px)', display: 'flex', overflow: 'hidden', backgroundColor: C.bg }}>
                {/* Conversation List */}
                {showList && (
                    <div style={{ width: isMobile ? '100%' : '340px', minWidth: isMobile ? undefined : '300px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', backgroundColor: C.surface }}>
                        {/* Header */}
                        <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <MessageCircle size={22} color={C.primary} />
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: C.text, flex: 1 }}>Messages</h2>
                            <button onClick={() => setShowNewChat(true)} style={{ background: C.primary, border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="New message">
                                <Plus size={16} color="white" />
                            </button>
                        </div>
                        {/* Search */}
                        <div style={{ padding: '8px 16px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color={C.textTer} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                                <input value={convFilter} onChange={e => setConvFilter(e.target.value)} placeholder="Search conversations…"
                                    style={{ width: '100%', padding: '8px 8px 8px 32px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        {/* Encryption notice */}
                        <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: C.textTer }}>
                            <Lock size={10} /> <span>Messages are encrypted</span>
                        </div>
                        {/* Conversation list */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading && <div style={{ padding: 20, textAlign: 'center', color: C.textSec }}>Loading…</div>}
                            {!loading && filteredConvos.length === 0 && (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textTer }}>
                                    <MessageCircle size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                    <div style={{ fontSize: '13px' }}>No conversations yet</div>
                                    <button onClick={() => setShowNewChat(true)} style={{ marginTop: 12, background: 'none', border: `1px solid ${C.primary}`, color: C.primary, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Start a conversation</button>
                                </div>
                            )}
                            {filteredConvos.map(conv => (
                                <div key={conv.id} onClick={() => openConversation(conv.id)}
                                    style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center',
                                        backgroundColor: conv.id === activeConvId ? C.primaryGlow : 'transparent',
                                        borderLeft: conv.id === activeConvId ? `3px solid ${C.primary}` : '3px solid transparent',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { if (conv.id !== activeConvId) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                                    onMouseLeave={e => { if (conv.id !== activeConvId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    {/* Avatar */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        {conv.isGroup ? (
                                            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #3BA886, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Users size={18} color="white" />
                                            </div>
                                        ) : (
                                            <img src={avatarUrl(conv.participants[0] || { userId: '', username: '?', displayName: null, avatar: null })}
                                                style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                        )}
                                        {conv.unread > 0 && (
                                            <div style={{ position: 'absolute', top: -2, right: -2, background: C.primary, color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, border: `2px solid ${C.surface}` }}>
                                                {conv.unread > 9 ? '9+' : conv.unread}
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                            <span style={{ fontWeight: conv.unread > 0 ? 700 : 500, fontSize: '13px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                                {convDisplayName(conv)}
                                            </span>
                                            <span style={{ fontSize: '10px', color: C.textTer, flexShrink: 0 }}>{conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: conv.unread > 0 ? C.textSec : C.textTer, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {conv.muted && <BellOff size={10} style={{ marginRight: 4, verticalAlign: 'middle', opacity: 0.5 }} />}
                                            {conv.lastMessagePreview || 'No messages yet'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chat Area */}
                {showChat && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.bg }}>
                        {!activeConvId ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: C.textTer }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.primaryGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MessageCircle size={28} color={C.primary} />
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: 500 }}>Select a conversation</div>
                                <div style={{ fontSize: '13px' }}>or start a new one</div>
                            </div>
                        ) : (
                            <>
                                {/* Chat header */}
                                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: C.surface }}>
                                    {isMobile && (
                                        <button onClick={() => setActiveConvId(null)} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: '4px', display: 'flex' }}>
                                            <ArrowLeft size={20} />
                                        </button>
                                    )}
                                    {activeConv && !activeConv.isGroup && activeConv.participants[0] && (
                                        <img src={avatarUrl(activeConv.participants[0])} style={{ width: 34, height: 34, borderRadius: '50%' }} alt="" />
                                    )}
                                    {activeConv?.isGroup && (
                                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #3BA886, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Users size={16} color="white" />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {activeConv ? convDisplayName(activeConv) : ''}
                                        </div>
                                        <div style={{ fontSize: '11px', color: C.textTer, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Shield size={9} /> Encrypted
                                            {activeConv?.isGroup && ` · ${(activeConv.participants.length + 1)} members`}
                                        </div>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 4 }}>
                                            <MoreVertical size={18} />
                                        </button>
                                        {showMenu && (
                                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 8, padding: 6, zIndex: 100, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                                <button onClick={toggleMute} style={{ ...menuBtnStyle }}>{activeConv?.muted ? <><Bell size={13} /> Unmute</> : <><BellOff size={13} /> Mute</>}</button>
                                                {activeConv?.isGroup && (
                                                    <>
                                                        <button onClick={() => { setShowAddUser(true); setShowMenu(false); }} style={{ ...menuBtnStyle }}><UserPlus size={13} /> Add Member</button>
                                                        <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
                                                        <button onClick={leaveGroup} style={{ ...menuBtnStyle, color: C.error }}><LogOut size={13} />Leave Group</button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {msgsLoading && <div style={{ textAlign: 'center', color: C.textTer, padding: 20 }}>Loading…</div>}
                                    {!msgsLoading && messages.length === 0 && (
                                        <div style={{ textAlign: 'center', color: C.textTer, padding: 40, fontSize: '13px' }}>
                                            <Lock size={20} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
                                            Messages are end-to-end encrypted.<br />Send the first message!
                                        </div>
                                    )}
                                    {messages.map((msg, i) => {
                                        const isMine = msg.senderId === user!.id;
                                        const sender = participantMap[msg.senderId];
                                        const showAvatar = !isMine && (i === 0 || messages[i - 1].senderId !== msg.senderId);
                                        const showName = activeConv?.isGroup && !isMine && showAvatar;
                                        return (
                                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: showAvatar ? 8 : 0 }}>
                                                {showName && sender && (
                                                    <div style={{ fontSize: '11px', color: C.accent, fontWeight: 600, marginBottom: 2, marginLeft: 40 }}>
                                                        {sender.displayName || sender.username}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                                    {!isMine && showAvatar && sender && (
                                                        <img src={avatarUrl(sender)} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} alt="" />
                                                    )}
                                                    {!isMine && !showAvatar && <div style={{ width: 28, flexShrink: 0 }} />}
                                                    <div style={{ position: 'relative', maxWidth: isMobile ? '85%' : '60%' }}
                                                        onMouseEnter={e => { const d = e.currentTarget.querySelector('.msg-actions') as HTMLElement; if (d) d.style.opacity = '1'; }}
                                                        onMouseLeave={e => { const d = e.currentTarget.querySelector('.msg-actions') as HTMLElement; if (d) d.style.opacity = '0'; }}
                                                    >
                                                        <div style={{
                                                            padding: '8px 14px', borderRadius: '16px', fontSize: '13.5px', lineHeight: '1.45', wordBreak: 'break-word',
                                                            background: msg.deleted ? 'transparent' : isMine ? C.bubbleMine : C.bubble,
                                                            color: msg.deleted ? C.textTer : C.text,
                                                            fontStyle: msg.deleted ? 'italic' : 'normal',
                                                            border: msg.deleted ? `1px solid ${C.border}` : isMine ? '1px solid rgba(59,168,134,0.2)' : `1px solid ${C.border}`,
                                                            borderTopRightRadius: isMine ? '4px' : '16px',
                                                            borderTopLeftRadius: isMine ? '16px' : (showAvatar ? '4px' : '16px'),
                                                        }}>
                                                            {msg.deleted ? 'Message deleted' : msg.content}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: C.textTer, marginTop: 2, textAlign: isMine ? 'right' : 'left', paddingLeft: 4, paddingRight: 4 }}>
                                                            {formatMsgTime(msg.createdAt)}{msg.editedAt ? ' · edited' : ''}
                                                        </div>
                                                        {isMine && !msg.deleted && (
                                                            <div className="msg-actions" style={{ position: 'absolute', top: 4, left: -28, opacity: 0, transition: 'opacity 0.15s' }}>
                                                                <button onClick={() => deleteMessage(msg.id)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '50%', padding: 4, cursor: 'pointer', color: C.textTer, display: 'flex' }} title="Delete">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                            placeholder="Type a message…"
                                            style={{ flex: 1, padding: '10px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '12px', color: C.text, fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                        <button onClick={sendMessage} disabled={!input.trim()}
                                            style={{ background: input.trim() ? C.primary : C.surfaceLight, border: 'none', borderRadius: '10px', padding: '10px', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                                            <Send size={16} color={input.trim() ? 'white' : C.textTer} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* New Chat Modal */}
                {showNewChat && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowNewChat(false)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: '16px', width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: `1px solid ${C.borderLight}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', color: C.text }}>New Message</h3>
                                <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}><X size={18} /></button>
                            </div>
                            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                                {/* Group toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', color: C.textSec, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={isGroup} onChange={e => setIsGroup(e.target.checked)} style={{ accentColor: C.primary }} />
                                        <Users size={14} /> Group Chat
                                    </label>
                                    {isGroup && (
                                        <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name (optional)" style={{ flex: 1, padding: '6px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: '12px', outline: 'none' }} />
                                    )}
                                </div>
                                {/* Selected users */}
                                {selectedUsers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {selectedUsers.map(u => (
                                            <span key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.primaryGlow, border: `1px solid ${C.primary}33`, borderRadius: 20, padding: '4px 10px 4px 6px', fontSize: '12px', color: C.text }}>
                                                <img src={avatarUrl(u)} style={{ width: 18, height: 18, borderRadius: '50%' }} alt="" />
                                                {u.displayName || u.username}
                                                <button onClick={() => setSelectedUsers(prev => prev.filter(p => p.userId !== u.userId))} style={{ background: 'none', border: 'none', color: C.textTer, cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {/* Search */}
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} color={C.textTer} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users…" autoFocus
                                        style={{ width: '100%', padding: '10px 10px 10px 32px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                {/* Results */}
                                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                    {searchResults.filter(r => !selectedUsers.some(s => s.userId === r.userId)).map(u => (
                                        <div key={u.userId} onClick={() => { setSelectedUsers(prev => [...prev, u]); setSearchQuery(''); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <img src={avatarUrl(u)} style={{ width: 32, height: 32, borderRadius: '50%' }} alt="" />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>{u.displayName || u.username}</div>
                                                {u.displayName && <div style={{ fontSize: '11px', color: C.textTer }}>@{u.username}</div>}
                                            </div>
                                        </div>
                                    ))}
                                    {searchQuery.length >= 2 && searchResults.length === 0 && (
                                        <div style={{ padding: 16, textAlign: 'center', color: C.textTer, fontSize: '13px' }}>No users found</div>
                                    )}
                                </div>
                            </div>
                            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
                                <button onClick={startConversation} disabled={selectedUsers.length === 0}
                                    style={{ width: '100%', padding: '10px', background: selectedUsers.length > 0 ? C.primary : C.surfaceLight, color: selectedUsers.length > 0 ? 'white' : C.textTer, border: 'none', borderRadius: 8, cursor: selectedUsers.length > 0 ? 'pointer' : 'default', fontWeight: 600, fontSize: '13px' }}>
                                    {isGroup ? 'Create Group' : 'Start Conversation'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add User to Group Modal */}
                {showAddUser && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAddUser(false)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: '12px', width: '100%', maxWidth: 380, border: `1px solid ${C.borderLight}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', color: C.text }}>Add Member</h3>
                                <button onClick={() => setShowAddUser(false)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                            <div style={{ padding: 16 }}>
                                <input value={addUserSearch} onChange={e => setAddUserSearch(e.target.value)} placeholder="Search users…" autoFocus
                                    style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {addUserResults.map(u => (
                                        <div key={u.userId} onClick={() => addUserToGroup(u)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, cursor: 'pointer' }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <img src={avatarUrl(u)} style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />
                                            <span style={{ fontSize: '13px', color: C.text }}>{u.displayName || u.username}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};

const menuBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
    color: '#B9C3CE', fontSize: '12px', fontWeight: 500, background: 'none', border: 'none',
    cursor: 'pointer', width: '100%', textAlign: 'left',
};
