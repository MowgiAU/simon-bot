import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthProvider';
import { useChat, Conversation, UserResult } from './ChatProvider';
import { MessageCircle, Search, Plus, Users, Lock, ArrowLeft, X, BellOff, UserPlus, Archive, ArchiveRestore } from 'lucide-react';

const C = {
    bg: '#161925', surface: 'rgba(36, 44, 61, 0.97)', surfaceSolid: '#1A1E2E',
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

/** Dropdown conversation list — clicking a conversation opens a ChatHead */
export const MessengerPopup: React.FC = () => {
    const { user } = useAuth();
    const { conversations, dropdownOpen, setDropdownOpen, openChat, startConversation, archiveChat } = useChat();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const [showNewChat, setShowNewChat] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [convFilter, setConvFilter] = useState('');
    const [archivedConvos, setArchivedConvos] = useState<Conversation[]>([]);

    // Fetch archived conversations when archive tab is shown
    useEffect(() => {
        if (!showArchived || !dropdownOpen) return;
        axios.get('/api/messages/conversations?archived=true', { withCredentials: true })
            .then(({ data }) => setArchivedConvos(data))
            .catch(() => setArchivedConvos([]));
    }, [showArchived, dropdownOpen]);

    // User search
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

    const unarchiveChat = async (convId: string) => {
        try {
            await axios.patch(`/api/messages/conversations/${convId}`, { archived: false }, { withCredentials: true });
            setArchivedConvos(prev => prev.filter(c => c.id !== convId));
        } catch { /* silent */ }
    };

    const convDisplayName = (conv: Conversation) => {
        if (conv.isGroup && conv.name) return conv.name;
        if (conv.participants.length > 0) return conv.participants.map(p => p.displayName || p.username).join(', ');
        return 'Conversation';
    };

    const activeConvos = showArchived ? archivedConvos : conversations;
    const filteredConvos = convFilter
        ? activeConvos.filter(c => convDisplayName(c).toLowerCase().includes(convFilter.toLowerCase()))
        : activeConvos;

    if (!dropdownOpen || !user) return null;

    return (
        <div style={isMobile ? {
            position: 'fixed', top: '60px', left: '8px', right: '8px', width: 'auto', maxHeight: '75vh',
            background: C.surfaceSolid, borderRadius: '12px',
            border: `1px solid ${C.borderLight}`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            zIndex: 1001,
        } : {
            position: 'absolute', top: '100%', right: 0, marginTop: '6px',
            width: '340px', maxHeight: '480px',
            background: C.surfaceSolid, borderRadius: '12px',
            border: `1px solid ${C.borderLight}`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            zIndex: 1001,
        }}>
            {/* Header */}
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                {showNewChat ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => { setShowNewChat(false); setSelectedUsers([]); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 2, display: 'flex' }}>
                                <ArrowLeft size={15} />
                            </button>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>New Message</span>
                        </div>
                        <button onClick={() => { setShowNewChat(false); setDropdownOpen(false); }} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 2, display: 'flex' }}>
                            <X size={15} />
                        </button>
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Lock size={12} color={C.primary} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{showArchived ? 'Archived' : 'Messages'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => setShowArchived(!showArchived)} style={{ background: showArchived ? C.primaryGlow : 'rgba(255,255,255,0.06)', border: showArchived ? `1px solid ${C.primary}44` : `1px solid ${C.border}`, borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={showArchived ? 'Show active' : 'Show archived'}>
                                <Archive size={13} color={showArchived ? C.primary : C.textSec} />
                            </button>
                            <button onClick={() => setShowNewChat(true)} style={{ background: C.primary, border: 'none', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="New message">
                                <Plus size={13} color="white" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* === CONVERSATION LIST VIEW === */}
            {!showNewChat && (
                <>
                    {/* Search */}
                    <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={11} color={C.textTer} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                            <input value={convFilter} onChange={e => setConvFilter(e.target.value)} placeholder="Search conversations…"
                                style={{ width: '100%', padding: '6px 6px 6px 24px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    {/* List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredConvos.length === 0 && (
                            <div style={{ padding: '28px 16px', textAlign: 'center', color: C.textTer, fontSize: '12px' }}>
                                {showArchived ? <Archive size={22} style={{ opacity: 0.3, marginBottom: 6 }} /> : <MessageCircle size={22} style={{ opacity: 0.3, marginBottom: 6 }} />}<br />
                                {showArchived ? 'No archived conversations' : 'No conversations yet'}
                            </div>
                        )}
                        {filteredConvos.map(conv => (
                            <div key={conv.id} style={{ display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <div onClick={() => { if (showArchived) { unarchiveChat(conv.id); } openChat(conv.id); setDropdownOpen(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {conv.isGroup ? (
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #D4700A, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                        <span style={{ fontWeight: conv.unread > 0 ? 700 : 500, fontSize: '12px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
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
                            {!showArchived && (
                                <button onClick={(e) => { e.stopPropagation(); archiveChat(conv.id); }}
                                    style={{ background: 'none', border: 'none', color: C.textTer, cursor: 'pointer', padding: '4px 8px', display: 'flex', flexShrink: 0, opacity: 0.5, transition: 'opacity 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                    title="Archive">
                                    <Archive size={13} />
                                </button>
                            )}
                            {showArchived && (
                                <button onClick={(e) => { e.stopPropagation(); unarchiveChat(conv.id); }}
                                    style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', padding: '4px 8px', display: 'flex', flexShrink: 0, opacity: 0.6, transition: 'opacity 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                    title="Unarchive">
                                    <ArchiveRestore size={13} />
                                </button>
                            )}
                            </div>
                        ))}
                    </div>
                    {/* Footer */}
                    <a href="/messages" style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: C.primary, textDecoration: 'none', borderTop: `1px solid ${C.border}`, display: 'block', fontWeight: 600, flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,168,134,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        See All Messages
                    </a>
                </>
            )}

            {/* === NEW CHAT VIEW === */}
            {showNewChat && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                            <Search size={11} color={C.textTer} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users…" autoFocus
                                style={{ width: '100%', padding: '7px 7px 7px 24px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
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
                    <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                        <button onClick={handleStartConversation} disabled={selectedUsers.length === 0}
                            style={{ width: '100%', padding: '8px', background: selectedUsers.length > 0 ? C.primary : 'rgba(255,255,255,0.04)', color: selectedUsers.length > 0 ? 'white' : C.textTer, border: 'none', borderRadius: 6, cursor: selectedUsers.length > 0 ? 'pointer' : 'default', fontWeight: 600, fontSize: '12px' }}>
                            {isGroup ? 'Create Group' : 'Start Conversation'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
