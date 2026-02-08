import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { 
    Ticket, MessageSquare, Send, CheckCircle, XCircle, AlertTriangle, 
    MoreHorizontal, RefreshCw, Filter, User
} from 'lucide-react';

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
}

export const TicketSystemPage: React.FC<Props> = ({ guildId }) => {
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
            setMessages(res.data);
            scrollToBottom();
        } catch (e) {
            console.error('Failed to fetch messages', e);
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F3F4F6' }}>
            {/* Header */}
            <div style={{ padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e5e7eb', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Ticket size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Ticket System</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value as any)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="all">All</option>
                    </select>
                    <button onClick={fetchTickets} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><RefreshCw size={18}/></button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar List */}
                <div style={{ width: '300px', background: '#fff', borderRight: '1px solid #e5e7eb', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {filteredTickets.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No tickets found</div>
                    )}
                    {filteredTickets.map(ticket => (
                        <div 
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket)}
                            style={{ 
                                padding: '16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                                background: selectedTicket?.id === ticket.id ? '#eff6ff' : '#fff',
                                borderLeft: selectedTicket?.id === ticket.id ? `4px solid ${colors.primary}` : '4px solid transparent'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                                    Ticket #{ticket.channelId.slice(-4)}
                                </span>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {new Date(ticket.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
                                <span style={{ 
                                    padding: '2px 6px', borderRadius: '4px', 
                                    background: ticket.status === 'open' ? '#dcfce7' : '#f3f4f6',
                                    color: ticket.status === 'open' ? '#166534' : '#6b7280'
                                }}>
                                    {ticket.status.toUpperCase()}
                                </span>
                                <span style={{ 
                                    padding: '2px 6px', borderRadius: '4px',
                                    backgroundColor: getPriorityColor(ticket.priority) + '20',
                                    color: getPriorityColor(ticket.priority)
                                }}>
                                    {ticket.priority.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content */}
                {selectedTicket ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                        {/* Ticket Toolbar */}
                        <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px' }}>Conversation</h3>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>Channel ID: {selectedTicket.channelId}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <select 
                                    value={selectedTicket.priority}
                                    onChange={(e) => handleUpdatePriority(e.target.value as any)}
                                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }}
                                >
                                    <option value="low">Low Priority</option>
                                    <option value="medium">Medium Priority</option>
                                    <option value="high">High Priority</option>
                                </select>

                                {selectedTicket.status === 'open' ? (
                                    <button 
                                        onClick={() => handleUpdateStatus('closed')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                    >
                                        <XCircle size={14}/> Close Ticket
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleUpdateStatus('open')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                    >
                                        <CheckCircle size={14}/> Re-open Ticket
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {loadingMessages ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>Loading messages...</div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} style={{ 
                                        display: 'flex', gap: '12px', 
                                        alignSelf: msg.author.bot ? 'flex-start' : 'flex-start', // Messages usually aligned left in tickets
                                        maxWidth: '80%'
                                    }}>
                                        <img 
                                            src={msg.author.avatar ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                                            alt="avatar"
                                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                                        />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{msg.author.username}</span>
                                                <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(msg.timestamp).toLocaleString()}</span>
                                            </div>
                                            <div style={{ 
                                                background: '#fff', padding: '10px 14px', borderRadius: '0 8px 8px 8px', 
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap', fontSize: '14px', color: '#374151',
                                                border: '1px solid #e5e7eb'
                                            }}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Box */}
                        <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
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
                                        flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', 
                                        resize: 'none', height: '80px', outline: 'none', fontFamily: 'inherit'
                                    }}
                                />
                                <button 
                                    onClick={handleReply}
                                    disabled={!replyContent.trim()}
                                    style={{ 
                                        width: '80px', height: '80px', borderRadius: '8px', border: 'none',
                                        background: colors.primary, color: '#fff', cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                    }}
                                >
                                    <Send size={20} />
                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Send</span>
                                </button>
                            </div>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                                Press Enter to send. Shift+Enter for new line.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af' }}>
                        <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p>Select a ticket to view conversation</p>
                    </div>
                )}
            </div>
        </div>
    );
};
