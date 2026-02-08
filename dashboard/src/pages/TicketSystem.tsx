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
        <div style={{ padding: '24px', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', 
                background: '#fff', 
                borderRadius: '12px', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                overflow: 'hidden'
            }}>
                {/* Plugin Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ 
                                margin: 0, 
                                fontSize: '24px', 
                                fontWeight: '700', 
                                color: '#111827',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <Ticket size={28} color={colors.primary} />
                                Ticket System
                            </h1>
                            <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px', maxWidth: '600px' }}>
                                Manage support tickets, track issues, and view conversation history for both active and archived tickets.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', background: '#fff', padding: '4px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <button 
                                onClick={() => setStatusFilter('open')}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    background: statusFilter === 'open' ? colors.primary : 'transparent',
                                    color: statusFilter === 'open' ? '#fff' : '#6b7280',
                                    cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                                }}
                            >
                                Active Tickets
                            </button>
                            <button 
                                onClick={() => setStatusFilter('closed')}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    background: statusFilter === 'closed' ? colors.primary : 'transparent',
                                    color: statusFilter === 'closed' ? '#fff' : '#6b7280',
                                    cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                                }}
                            >
                                Audit Logs
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar List */}
                    <div style={{ width: '320px', background: '#fcfcfc', borderRight: '1px solid #e5e7eb', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        {filteredTickets.length === 0 && (
                            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                                <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                <p>No {statusFilter} tickets found</p>
                            </div>
                        )}
                        {filteredTickets.map(ticket => (
                            <div 
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                style={{ 
                                    padding: '16px 24px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                                    background: selectedTicket?.id === ticket.id ? '#eff6ff' : '#fff',
                                    borderLeft: selectedTicket?.id === ticket.id ? `4px solid ${colors.primary}` : '4px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '15px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Ticket #{ticket.id.slice(-4)}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
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
                                        <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#e5e7eb', color: '#6b7280', fontSize: '11px', fontWeight: 600 }}>
                                            ARCHIVED
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Content */}
                    {selectedTicket ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                            {/* Ticket Toolbar */}
                            <div style={{ padding: '16px 32px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>Ticket #{selectedTicket.id}</h3>
                                    <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <User size={14} /> Owner: {selectedTicket.ownerId}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <select 
                                        value={selectedTicket.priority}
                                        onChange={(e) => handleUpdatePriority(e.target.value as any)}
                                        disabled={selectedTicket.status === 'closed'}
                                        style={{ 
                                            padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px',
                                            cursor: selectedTicket.status === 'closed' ? 'not-allowed' : 'pointer',
                                            background: '#fff'
                                        }}
                                    >
                                        <option value="low">Low Priority 🟢</option>
                                        <option value="medium">Medium Priority 🟡</option>
                                        <option value="high">High Priority 🔴</option>
                                    </select>

                                    {selectedTicket.status === 'open' ? (
                                        <button 
                                            onClick={() => handleUpdateStatus('closed')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        >
                                            <XCircle size={16}/> Close Ticket
                                        </button>
                                    ) : (
                                        <div style={{ padding: '8px 16px', background: '#f3f4f6', borderRadius: '6px', color: '#6b7280', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CheckCircle size={16} /> Closed {new Date(selectedTicket.closedAt || '').toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {loadingMessages ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ marginBottom: '8px' }} />
                                        <p>Loading conversation history...</p>
                                    </div>
                                ) : (
                                    messages.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No messages found</div>
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
                                                    style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                />
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{msg.author.username}</span>
                                                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                                            {new Date(msg.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ 
                                                        background: '#fff', padding: '12px 16px', borderRadius: '0 12px 12px 12px', 
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap', fontSize: '14px', color: '#374151',
                                                        border: '1px solid #e5e7eb', lineHeight: '1.5'
                                                    }}>
                                                        {msg.content}
                                                    </div>
                                                    {/* Attachments (basic support) */}
                                                    {/* The backend currently might not return nicely formatted attachments for closed tickets yet, 
                                                        but assuming they come in as array of objects in future iteration */}
                                                </div>
                                            </div>
                                        ))
                                    )
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Box (Only for Open Tickets) */}
                            {selectedTicket.status === 'open' && (
                                <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
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
                                                flex: 1, padding: '16px', borderRadius: '12px', border: '1px solid #d1d5db', 
                                                resize: 'none', height: '100px', outline: 'none', fontFamily: 'inherit',
                                                fontSize: '14px', lineHeight: '1.5',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
                                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Press Enter to send, Shift+Enter for new line</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12}/> Replies are sent as the bot</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af', background: '#f9fafb' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                <MessageSquare size={40} style={{ opacity: 0.4 }} />
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Ticket Selected</h3>
                            <p style={{ margin: 0, fontSize: '14px' }}>Select a ticket from the sidebar to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
