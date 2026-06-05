import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { MessageCircle, Search, Users, Trash2, Eye, X, AlertTriangle, Clock, Hash, User } from 'lucide-react';

interface ConvParticipant { userId: string; username: string; displayName: string | null; avatar: string | null; }
interface AdminConversation {
    id: string; name: string | null; isGroup: boolean; createdById: string;
    createdAt: string; updatedAt: string; messageCount: number; participantCount: number;
    participants: ConvParticipant[]; lastMessagePreview: string | null; lastMessageAt: string | null;
}
interface AdminMessage { id: string; senderId: string; content: string | null; deleted: boolean; createdAt: string; }
interface Stats { totalConversations: number; totalMessages: number; activeUsers: number; last24hMessages: number; }

const avatarUrl = (u: ConvParticipant) => {
    if (u.avatar?.startsWith('http') || u.avatar?.startsWith('/')) return u.avatar;
    if (u.avatar && u.userId) return `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&background=242A3D&color=F8FAFC&size=64`;
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const PrivateMessagesPage: React.FC = () => {
    const [conversations, setConversations] = useState<AdminConversation[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedConv, setSelectedConv] = useState<AdminConversation | null>(null);
    const [messages, setMessages] = useState<AdminMessage[]>([]);
    const [senders, setSenders] = useState<Record<string, ConvParticipant>>({});
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [convRes, statsRes] = await Promise.all([
                axios.get('/api/admin/messages/conversations', { withCredentials: true }),
                axios.get('/api/admin/messages/stats', { withCredentials: true }),
            ]);
            setConversations(convRes.data);
            setStats(statsRes.data);
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const viewMessages = async (conv: AdminConversation) => {
        setSelectedConv(conv);
        setMessagesLoading(true);
        try {
            const { data } = await axios.get(`/api/admin/messages/conversations/${conv.id}/messages`, { withCredentials: true });
            setMessages(data.messages);
            setSenders(data.senders);
        } catch { setMessages([]); }
        setMessagesLoading(false);
    };

    const deleteConversation = async (convId: string) => {
        try {
            await axios.delete(`/api/admin/messages/conversations/${convId}`, { withCredentials: true });
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (selectedConv?.id === convId) { setSelectedConv(null); setMessages([]); }
            setDeleteConfirm(null);
        } catch { /* silent */ }
    };

    const deleteMessage = async (convId: string, msgId: string) => {
        try {
            await axios.delete(`/api/admin/messages/conversations/${convId}/messages/${msgId}`, { withCredentials: true });
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, content: null } : m));
        } catch { /* silent */ }
    };

    const convDisplayName = (conv: AdminConversation) => {
        if (conv.isGroup && conv.name) return conv.name;
        return conv.participants.map(p => p.displayName || p.username).join(', ') || 'Conversation';
    };

    const filtered = search
        ? conversations.filter(c => convDisplayName(c).toLowerCase().includes(search.toLowerCase()) || c.id.includes(search))
        : conversations;

    return (
        <div style={{ padding: spacing.lg, maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <MessageCircle size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Private Messages</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Monitor and manage user conversations</p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    This dashboard lets you view all private conversations, monitor message activity, and moderate content. 
                    Messages are encrypted at rest — they are decrypted server-side for admin review only.
                </p>
            </div>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { label: 'Conversations', value: stats.totalConversations, icon: <Hash size={16} /> },
                        { label: 'Messages', value: stats.totalMessages, icon: <MessageCircle size={16} /> },
                        { label: 'Active Users', value: stats.activeUsers, icon: <User size={16} /> },
                        { label: 'Last 24h', value: stats.last24hMessages, icon: <Clock size={16} /> },
                    ].map(s => (
                        <div key={s.label} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ color: colors.primary, opacity: 0.8 }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: colors.textPrimary }}>{s.value.toLocaleString()}</div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 500 }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations by name or ID…"
                    style={{ width: '100%', padding: '10px 10px 10px 36px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '16px', minHeight: '400px' }}>
                {/* Conversation List */}
                <div style={{ flex: selectedConv ? '0 0 420px' : '1', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, fontSize: '12px', fontWeight: 600, color: colors.textSecondary }}>
                        {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '600px' }}>
                        {loading && <div style={{ padding: '40px', textAlign: 'center', color: colors.textTertiary }}>Loading...</div>}
                        {!loading && filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: colors.textTertiary }}>No conversations found</div>}
                        {filtered.map(conv => (
                            <div key={conv.id} style={{
                                padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center',
                                borderBottom: `1px solid ${colors.border}`, transition: 'background 0.1s',
                                backgroundColor: selectedConv?.id === conv.id ? `${colors.primary}15` : 'transparent',
                            }}
                                onMouseEnter={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                                onMouseLeave={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                onClick={() => viewMessages(conv)}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {conv.isGroup ? (
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #D4700A, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Users size={16} color="white" />
                                        </div>
                                    ) : conv.participants[0] ? (
                                        <img src={avatarUrl(conv.participants[0])} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                    ) : (
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2D3348', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textTertiary }}>?</div>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                        <span style={{ fontWeight: 600, fontSize: '13px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {convDisplayName(conv)}
                                        </span>
                                        <span style={{ fontSize: '10px', color: colors.textTertiary, flexShrink: 0 }}>{conv.messageCount} msgs</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {conv.lastMessagePreview || 'No messages'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: 2, display: 'flex', gap: '8px' }}>
                                        <span>{conv.participantCount} members</span>
                                        <span>·</span>
                                        <span>{conv.lastMessageAt ? formatDate(conv.lastMessageAt) : formatDate(conv.createdAt)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm(conv.id); }}
                                        style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 4 }}
                                        title="Delete conversation">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Message Viewer */}
                {selectedConv && (
                    <div style={{ flex: 1, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Viewer Header */}
                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: colors.textPrimary }}>{convDisplayName(selectedConv)}</div>
                                <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: 2 }}>
                                    {selectedConv.isGroup ? 'Group' : 'Direct'} · {selectedConv.messageCount} messages · Created {formatDate(selectedConv.createdAt)}
                                </div>
                            </div>
                            <button onClick={() => { setSelectedConv(null); setMessages([]); }}
                                style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 4, display: 'flex' }}>
                                <X size={16} />
                            </button>
                        </div>
                        {/* Participants */}
                        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {selectedConv.participants.map(p => (
                                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '3px 8px 3px 3px', fontSize: '11px', color: colors.textSecondary }}>
                                    <img src={avatarUrl(p)} style={{ width: 18, height: 18, borderRadius: '50%' }} alt="" />
                                    {p.displayName || p.username}
                                </div>
                            ))}
                        </div>
                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {messagesLoading && <div style={{ textAlign: 'center', color: colors.textTertiary, padding: 20 }}>Loading messages...</div>}
                            {!messagesLoading && messages.length === 0 && <div style={{ textAlign: 'center', color: colors.textTertiary, padding: 20 }}>No messages</div>}
                            {messages.map(msg => {
                                const sender = senders[msg.senderId];
                                return (
                                    <div key={msg.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0' }}>
                                        {sender ? (
                                            <img src={avatarUrl(sender)} style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2 }} alt="" />
                                        ) : (
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2D3348', flexShrink: 0, marginTop: 2 }} />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                <span style={{ fontWeight: 600, fontSize: '12px', color: colors.textPrimary }}>
                                                    {sender ? (sender.displayName || sender.username) : msg.senderId.slice(0, 8)}
                                                </span>
                                                <span style={{ fontSize: '10px', color: colors.textTertiary }}>{formatDate(msg.createdAt)}</span>
                                            </div>
                                            <div style={{
                                                fontSize: '13px', color: msg.deleted ? colors.textTertiary : colors.textPrimary,
                                                fontStyle: msg.deleted ? 'italic' : 'normal',
                                                lineHeight: 1.45, wordBreak: 'break-word',
                                            }}>
                                                {msg.deleted ? '[deleted]' : msg.content}
                                            </div>
                                        </div>
                                        {!msg.deleted && (
                                            <button onClick={() => deleteMessage(selectedConv.id, msg.id)}
                                                style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0, opacity: 0.5, transition: 'opacity 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                                title="Delete message">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
                    onClick={() => setDeleteConfirm(null)}>
                    <div style={{ background: colors.surface, borderRadius: borderRadius.lg, padding: '24px', maxWidth: '400px', width: '90%', border: `1px solid ${colors.border}` }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <AlertTriangle size={24} color="#F87171" />
                            <h3 style={{ margin: 0, color: colors.textPrimary }}>Delete Conversation</h3>
                        </div>
                        <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: 20 }}>
                            This will permanently delete the conversation and all its messages for all participants. This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setDeleteConfirm(null)}
                                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                                Cancel
                            </button>
                            <button onClick={() => deleteConversation(deleteConfirm)}
                                style={{ padding: '8px 16px', background: '#F87171', color: 'white', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
