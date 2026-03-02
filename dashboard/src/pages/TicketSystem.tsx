import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { 
    Ticket, MessageSquare, Send, CheckCircle, XCircle, AlertTriangle, 
    MoreHorizontal, RefreshCw, Filter, User, ArrowLeft 
} from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface TicketData {
    id: string;
    channelId: string;
    guildId: string;
    ownerId: string;
    status: 'open' | 'closed';
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
    closedAt?: string;
}

interface DiscordMessage {
    id: string;
    content: string;
    author: {
        id: string;
        username: string;
        avatar: string | null;
        bot?: boolean;
    };
    timestamp: string;
}

interface Props {
    guildId: string;
    searchParam?: string;
}

export const TicketSystemPage: React.FC<Props> = ({ guildId, searchParam }) => {
    const isMobile = useMobile();
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
    const [messages, setMessages] = useState<DiscordMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    
    // Filter states
    const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');

    useEffect(() => {
        fetchTickets();
        const interval = setInterval(fetchTickets, 30000);
        return () => clearInterval(interval);
    }, [guildId]);

    useEffect(() => {
        if (searchParam && tickets.length > 0) {
            const ticket = tickets.find(t => t.id === searchParam);
            if (ticket) {
                setSelectedTicket(ticket);
                setStatusFilter('all'); // Ensure we can see it regardless of status
            }
        }
    }, [searchParam, tickets]);

    useEffect(() => {
        if (selectedTicket) {
            fetchMessages(selectedTicket.id);
        } else {
            setMessages([]);
        }
    }, [selectedTicket]);

    const fetchTickets = async () => {
        try {
            const res = await axios.get(`/api/tickets/list/${guildId}`, { withCredentials: true });
            setTickets(res.data);
        } catch (e) {
            console.error('Failed to fetch tickets', e);
        }
    };

    const fetchMessages = async (ticketId: string) => {
        setLoadingMessages(true);
        try {
            const res = await axios.get(`/api/tickets/${ticketId}/messages`, { withCredentials: true });
            if (Array.isArray(res.data)) {
                setMessages(res.data);
                scrollToBottom();
            } else {
                setMessages([]);
            }
        } catch (e) {
            console.error('Failed to fetch messages', e);
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleReply = async () => {
        if (!selectedTicket || !replyContent.trim()) return;
        try {
            await axios.post(`/api/tickets/${selectedTicket.id}/reply`, {
                content: replyContent
            }, { withCredentials: true });
            setReplyContent('');
            fetchMessages(selectedTicket.id);
        } catch(e) {
            alert('Failed to send reply');
        }
    };

    const handleUpdateStatus = async (status: 'open' | 'closed') => {
        if (!selectedTicket) return;
        if (!confirm(`Mark ticket as ${status}?`)) return;
        try {
            await axios.patch(`/api/tickets/${selectedTicket.id}`, { status }, { withCredentials: true });
            fetchTickets();
            setSelectedTicket(prev => prev ? ({ ...prev, status }) : null);
        } catch (e) {
            alert('Failed to update status');
        }
    };

    const handleUpdatePriority = async (priority: 'low' | 'medium' | 'high') => {
        if (!selectedTicket) return;
        try {
            await axios.patch(`/api/tickets/${selectedTicket.id}`, { priority }, { withCredentials: true });
            fetchTickets();
            setSelectedTicket(prev => prev ? ({ ...prev, priority }) : null);
        } catch (e) {
            alert('Failed to update priority');
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const filteredTickets = tickets.filter(t => statusFilter === 'all' || t.status === statusFilter);

    // Render Helpers
    const getPriorityColor = (p: string) => {
        switch(p) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleString();

    return (
        <div style={{ padding: '24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
             {/* Header */}
            <div style={{ display: 'flex', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Ticket size={32} color={colors.primary} />
                    <div>
                        <h1 style={{ margin: 0, color: '#fff' }}>Ticket System</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage support tickets and view conversation history.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', background: colors.surface, padding: '4px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                    <button 
                        onClick={() => setStatusFilter('open')}
                        style={{
                            padding: '8px 16px', borderRadius: '6px', border: 'none',
                            background: statusFilter === 'open' ? colors.primary : 'transparent',
                            color: statusFilter === 'open' ? '#fff' : colors.textSecondary,
                            cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                        }}
                    >
                        Active
                    </button>
                    <button 
                        onClick={() => setStatusFilter('closed')}
                        style={{
                            padding: '8px 16px', borderRadius: '6px', border: 'none',
                            background: statusFilter === 'closed' ? colors.primary : 'transparent',
                            color: statusFilter === 'closed' ? '#fff' : colors.textSecondary,
                            cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                        }}
                    >
                        Archive
                    </button>
                </div>
            </div>

            {/* Main Card */}
            <div style={{ 
                display: 'flex', 
                flex: 1,
                background: colors.surface, 
                borderRadius: '12px', 
                border: `1px solid ${colors.border}`,
                overflow: 'hidden'
            }}>
                {/* Sidebar List */}
                <div style={{ 
                    width: isMobile ? '100%' : '320px', 
                    background: colors.surface, 
                    borderRight: isMobile ? 'none' : `1px solid ${colors.border}`, 
                    overflowY: 'auto', 
                    display: isMobile && selectedTicket ? 'none' : 'flex', 
                    flexDirection: 'column' 
                }}>
                        {filteredTickets.length === 0 && (
                            <div style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary }}>
                                <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                <p>No {statusFilter} tickets found</p>
                            </div>
                        )}
                        {filteredTickets.map(ticket => (
                            <div 
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                style={{ 
                                    padding: '16px 24px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer',
                                    background: selectedTicket?.id === ticket.id ? colors.surface : 'transparent',
                                    borderLeft: selectedTicket?.id === ticket.id ? `4px solid ${colors.primary}` : '4px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '15px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Ticket #{ticket.id.slice(-4)}
                                    </span>
                                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                        {formatDate(ticket.createdAt).split(',')[0]}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
                                    <span style={{ 
                                        padding: '2px 8px', borderRadius: '12px',
                                        backgroundColor: getPriorityColor(ticket.priority) + '20',
                                        color: getPriorityColor(ticket.priority),
                                        fontWeight: 600, textTransform: 'uppercase', fontSize: '11px'
                                    }}>
                                        {ticket.priority}
                                    </span>
                                    {ticket.status === 'closed' && (
                                        <span style={{ padding: '2px 8px', borderRadius: '12px', background: colors.background, color: colors.textSecondary, fontSize: '11px', fontWeight: 600 }}>
                                            ARCHIVED
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Content */}
                    {selectedTicket ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.surface }}>
                            {/* Ticket Toolbar */}
                            <div style={{ 
                                padding: isMobile ? '12px' : '16px 32px', 
                                borderBottom: `1px solid ${colors.border}`, 
                                display: 'flex', 
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '12px' : '0', 
                                justifyContent: 'space-between', 
                                alignItems: isMobile ? 'stretch' : 'center', 
                                background: colors.surface 
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {isMobile && (
                                        <button 
                                            onClick={() => setSelectedTicket(null)} 
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: colors.textPrimary }}
                                        >
                                            <ArrowLeft size={24} />
                                        </button>
                                    )}
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>
                                            Ticket #{isMobile ? selectedTicket.id.slice(0, 8) + '...' : selectedTicket.id}
                                        </h3>
                                        <div style={{ fontSize: '13px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <User size={14} /> Owner: {isMobile && selectedTicket.ownerId.length > 10 ? selectedTicket.ownerId.slice(0, 10) + '...' : selectedTicket.ownerId}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <select 
                                        value={selectedTicket.priority}
                                        onChange={(e) => handleUpdatePriority(e.target.value as any)}
                                        disabled={selectedTicket.status === 'closed'}
                                        style={{ 
                                            padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`, fontSize: '13px',
                                            cursor: selectedTicket.status === 'closed' ? 'not-allowed' : 'pointer',
                                            background: colors.background, color: colors.textPrimary
                                        }}
                                    >
                                        <option value="low">Low Priority 🟢</option>
                                        <option value="medium">Medium Priority 🟡</option>
                                        <option value="high">High Priority 🔴</option>
                                    </select>

                                    {selectedTicket.status === 'open' ? (
                                        <button 
                                            onClick={() => handleUpdateStatus('closed')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        >
                                            <XCircle size={16}/> Close Ticket
                                        </button>
                                    ) : (
                                        <div style={{ padding: '8px 16px', background: colors.background, borderRadius: '6px', color: colors.textSecondary, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CheckCircle size={16} /> Closed {new Date(selectedTicket.closedAt || '').toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: colors.background, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {loadingMessages ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ marginBottom: '8px' }} />
                                        <p>Loading conversation history...</p>
                                    </div>
                                ) : (
                                    messages.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>No messages found</div>
                                    ) : (
                                        messages.map(msg => (
                                            <div key={msg.id} style={{ 
                                                display: 'flex', gap: '16px', 
                                                alignSelf: 'flex-start',
                                                maxWidth: '85%'
                                            }}>
                                                <img 
                                                    src={msg.author.avatar ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                                                    alt="avatar"
                                                    style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${colors.surface}` }}
                                                />
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '14px', color: colors.textPrimary }}>{msg.author.username}</span>
                                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                                            {new Date(msg.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ 
                                                        background: colors.surface, padding: '12px 16px', borderRadius: '0 12px 12px 12px', 
                                                        whiteSpace: 'pre-wrap', fontSize: '14px', color: colors.textPrimary,
                                                        border: `1px solid ${colors.border}`, lineHeight: '1.5'
                                                    }}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Box (Only for Open Tickets) */}
                            {selectedTicket.status === 'open' && (
                                <div style={{ padding: '24px 32px', background: colors.surface, borderTop: `1px solid ${colors.border}` }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <textarea
                                            value={replyContent}
                                            onChange={e => setReplyContent(e.target.value)}
                                            placeholder="Type your reply here..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleReply();
                                                }
                                            }}
                                            style={{ 
                                                flex: 1, padding: '16px', borderRadius: '12px', border: `1px solid ${colors.border}`, 
                                                resize: 'none', height: '100px', outline: 'none', fontFamily: 'inherit',
                                                fontSize: '14px', lineHeight: '1.5',
                                                background: colors.background, color: colors.textPrimary
                                            }}
                                        />
                                        <button 
                                            onClick={handleReply}
                                            disabled={!replyContent.trim()}
                                            style={{ 
                                                width: '100px', height: '100px', borderRadius: '12px', border: 'none',
                                                background: colors.primary, color: '#fff', cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                transition: 'transform 0.1s'
                                            }}
                                        >
                                            <Send size={24} />
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>Send</span>
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Press Enter to send, Shift+Enter for new line</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12}/> Replies are sent as the bot</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: isMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: colors.textSecondary, background: colors.background }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                <MessageSquare size={40} style={{ opacity: 0.4 }} />
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', color: colors.textPrimary }}>No Ticket Selected</h3>
                            <p style={{ margin: 0, fontSize: '14px' }}>Select a ticket from the sidebar to view details</p>
                        </div>
                    )}
                </div>
        </div>
    );
};
