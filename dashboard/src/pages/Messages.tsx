import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthProvider';
import { useLocation } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useChat, Conversation, UserResult } from '../components/ChatProvider';
import { MessageCircle, Search, Plus, Users, Lock, ArrowLeft, X } from 'lucide-react';

const C = {
    bg: '#161925', surface: '#1A1E2E', surfaceLight: '#242A3D',
    border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.12)',
    primary: '#D4700A', primaryGlow: 'rgba(59,168,134,0.15)',
    text: '#F8FAFC', textSec: '#8B95A5', textTer: '#5C6370',
};

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

export const MessagesPage: React.FC = () => {
    const { user } = useAuth();
    const { conversations, openChat, startConversation, fetchConversations } = useChat();
    const [showNewChat, setShowNewChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [convFilter, setConvFilter] = useState('');
    const location = useLocation();
    const handledConvParam = React.useRef(false);

    // Handle ?conv= query param to auto-open a chat head
    useEffect(() => {
        if (handledConvParam.current) return;
        const params = new URLSearchParams(location.search);
        const convId = params.get('conv');
        if (convId && conversations.length > 0) {
            handledConvParam.current = true;
            openChat(convId);
        }
    }, [location.search, conversations]);

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

    const handleStartConversation = async () => {
        if (selectedUsers.length === 0) return;
        await startConversation(
            selectedUsers.map(u => u.userId),
            isGroup || selectedUsers.length > 1,
            isGroup ? groupName || undefined : undefined,
        );
        setShowNewChat(false);
        setSelectedUsers([]);
        setSearchQuery('');
        setGroupName('');
        setIsGroup(false);
    };

    const convDisplayName = (conv: Conversation) => {
        if (conv.isGroup && conv.name) return conv.name;
        if (conv.participants.length > 0) return conv.participants.map(p => p.displayName || p.username).join(', ');
        return 'Conversation';
    };

    const filteredConvos = convFilter
        ? conversations.filter(c => convDisplayName(c).toLowerCase().includes(convFilter.toLowerCase()))
        : conversations;

    if (!user) {
        return (
            <DiscoveryLayout activeTab="">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: C.textTer }}>
                    <p>Please sign in to view messages.</p>
                </div>
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout activeTab="">
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Lock size={20} color={C.primary} />
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Messages</h1>
                    </div>
                    <button onClick={() => setShowNewChat(true)} style={{ background: C.primary, color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                        <Plus size={14} /> New
                    </button>
                </div>

                {/* Explanation */}
                <div style={{ backgroundColor: C.surface, padding: '14px 16px', borderRadius: 10, marginBottom: 20, borderLeft: `4px solid ${C.primary}` }}>
                    <p style={{ margin: 0, color: C.textSec, fontSize: 13, lineHeight: 1.5 }}>
                        Your full message history. Click a conversation to open it as a chat window. All messages are end-to-end encrypted.
                    </p>
                </div>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                    <Search size={14} color={C.textTer} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={convFilter} onChange={e => setConvFilter(e.target.value)} placeholder="Search conversations…"
                        style={{ width: '100%', padding: '10px 10px 10px 34px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Conversation List */}
                {filteredConvos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 16px', color: C.textTer }}>
                        <MessageCircle size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ fontSize: 14, margin: 0 }}>No conversations yet</p>
                        <p style={{ fontSize: 12, marginTop: 4, color: C.textTer }}>Start a new message from the button above or from any artist profile.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredConvos.map(conv => (
                            <div key={conv.id} onClick={() => openChat(conv.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', background: C.surface, border: `1px solid ${C.border}`, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary + '55'; e.currentTarget.style.background = C.surfaceLight; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {conv.isGroup ? (
                                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #D4700A, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Users size={18} color="white" />
                                        </div>
                                    ) : (
                                        <img src={avatarUrl(conv.participants[0] || { userId: '', username: '?', displayName: null, avatar: null })}
                                            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                    )}
                                    {conv.unread > 0 && (
                                        <div style={{ position: 'absolute', top: -3, right: -3, background: C.primary, color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, border: `2px solid ${C.surface}` }}>
                                            {conv.unread > 9 ? '9+' : conv.unread}
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                        <span style={{ fontWeight: conv.unread > 0 ? 700 : 500, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {convDisplayName(conv)}
                                        </span>
                                        <span style={{ fontSize: 11, color: C.textTer, flexShrink: 0, marginLeft: 8 }}>{conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: conv.unread > 0 ? C.textSec : C.textTer, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {conv.lastMessagePreview || 'No messages yet'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* New Chat Modal */}
                {showNewChat && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowNewChat(false)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, width: '90%', maxWidth: 420, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${C.borderLight}` }}>
                            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>New Message</span>
                                <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', color: C.textTer, cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
                            </div>
                            <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSec, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={isGroup} onChange={e => setIsGroup(e.target.checked)} style={{ accentColor: C.primary }} />
                                    <Users size={13} /> Group Chat
                                </label>
                                {isGroup && (
                                    <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name (optional)"
                                        style={{ padding: '8px 12px', background: C.surfaceLight, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: 'none' }} />
                                )}
                                {selectedUsers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {selectedUsers.map(u => (
                                            <span key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.primaryGlow, border: `1px solid ${C.primary}33`, borderRadius: 20, padding: '4px 10px 4px 5px', fontSize: 11, color: C.text }}>
                                                <img src={avatarUrl(u)} style={{ width: 16, height: 16, borderRadius: '50%' }} alt="" />
                                                {u.displayName || u.username}
                                                <button onClick={() => setSelectedUsers(prev => prev.filter(p => p.userId !== u.userId))} style={{ background: 'none', border: 'none', color: C.textTer, cursor: 'pointer', padding: 0, display: 'flex' }}><X size={11} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} color={C.textTer} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users…" autoFocus
                                        style={{ width: '100%', padding: '9px 9px 9px 28px', background: C.surfaceLight, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px', maxHeight: 200 }}>
                                {searchResults.filter(r => !selectedUsers.some(s => s.userId === r.userId)).map(u => (
                                    <div key={u.userId} onClick={() => { setSelectedUsers(prev => [...prev, u]); setSearchQuery(''); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <img src={avatarUrl(u)} style={{ width: 32, height: 32, borderRadius: '50%' }} alt="" />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{u.displayName || u.username}</div>
                                            {u.displayName && <div style={{ fontSize: 11, color: C.textTer }}>@{u.username}</div>}
                                        </div>
                                    </div>
                                ))}
                                {searchQuery.length >= 2 && searchResults.length === 0 && (
                                    <div style={{ padding: 20, textAlign: 'center', color: C.textTer, fontSize: 12 }}>No users found</div>
                                )}
                            </div>
                            <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
                                <button onClick={handleStartConversation} disabled={selectedUsers.length === 0}
                                    style={{ width: '100%', padding: '10px', background: selectedUsers.length > 0 ? C.primary : C.surfaceLight, color: selectedUsers.length > 0 ? 'white' : C.textTer, border: 'none', borderRadius: 8, cursor: selectedUsers.length > 0 ? 'pointer' : 'default', fontWeight: 600, fontSize: 13 }}>
                                    {isGroup ? 'Create Group' : 'Start Conversation'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
