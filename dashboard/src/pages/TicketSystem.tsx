import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { 
    Ticket, MessageSquare, Send, CheckCircle, XCircle, AlertTriangle, 
    MoreHorizontal, RefreshCw, Filter, User, ArrowLeft, Settings, List, Save, Shield, Info, History
} from 'lucide-react';
import { useMobile } from '../hooks/useMobile';
import { RoleSelect } from '../components/RoleSelect';
import { ChannelSelect } from '../components/ChannelSelect';

interface TicketData {
    id: string;
    channelId: string;
    guildId: string;
    ownerId: string;
    ownerName?: string;
    status: 'open' | 'closed';
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
    closedAt?: string;
}

interface TicketSettings {
    guildId: string;
    ticketCategoryId: string | null;
    staffRoleIds: string[];
    transcriptChannelId: string | null;
    ticketMessage: string | null;
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
    const [view, setView] = useState<'tickets' | 'settings'>('tickets');
    
    // Ticket List State
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
    const [messages, setMessages] = useState<DiscordMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');

    // Settings State
    const [settings, setSettings] = useState<TicketSettings>({
        guildId,
        ticketCategoryId: null,
        staffRoleIds: [],
        transcriptChannelId: null,
        ticketMessage: "Click the button below to open a ticket"
    });
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        fetchTickets();
        fetchSettings();
        const interval = setInterval(fetchTickets, 30000);
        return () => clearInterval(interval);
    }, [guildId]);

    useEffect(() => {
        if (searchParam && tickets.length > 0) {
            const ticket = tickets.find(t => t.id === searchParam || t.channelId === searchParam);
            if (ticket) {
                setSelectedTicket(ticket);
                setStatusFilter('all');
                setView('tickets');
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

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`/api/tickets/settings/${guildId}`, { withCredentials: true });
            if (res.data) setSettings(res.data);
        } catch (e) {
            console.error('Failed to fetch ticket settings', e);
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

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await axios.post(`/api/tickets/settings/${guildId}`, settings, { withCredentials: true });
            alert('Settings saved successfully!');
        } catch (e) {
            alert('Failed to save settings');
        } finally {
            setSavingSettings(false);
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
        <div style={{ padding: '24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px' }}>
             {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Ticket size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <div>
                        <h1 style={{ margin: 0, color: '#fff' }}>Ticket System</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage support requests and configure ticket automation.</p>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', background: colors.surface, padding: '4px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                    <button 
                        onClick={() => setView('tickets')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', borderRadius: '6px', border: 'none',
                            background: view === 'tickets' ? colors.primary : 'transparent',
                            color: view === 'tickets' ? '#fff' : colors.textSecondary,
                            cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                        }}
                    >
                        <List size={16} /> Tickets
                    </button>
                    <button 
                        onClick={() => setView('settings')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', borderRadius: '6px', border: 'none',
                            background: view === 'settings' ? colors.primary : 'transparent',
                            color: view === 'settings' ? '#fff' : colors.textSecondary,
                            cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                        }}
                    >
                        <Settings size={16} /> Settings
                    </button>
                </div>
            </div>

            {/* Explanation patterns */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: 0, color: colors.textPrimary, fontSize: '14px', lineHeight: '1.5' }}>
                    {view === 'tickets' 
                        ? 'View and manage active support tickets. Deep-link directly to a ticket by searching for its ID or owner.' 
                        : 'Configure staff roles to be pinged, ticket categories, and transcript logging behavior.'}
                 </p>
            </div>

            {view === 'tickets' ? (
                /* Main Tickets Layout */
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
                            <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={() => setStatusFilter('open')}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                                        background: statusFilter === 'open' ? colors.background : 'transparent',
                                        color: statusFilter === 'open' ? colors.primary : colors.textSecondary,
                                        cursor: 'pointer', fontWeight: 600, fontSize: '12px'
                                    }}
                                >
                                    Active
                                </button>
                                <button 
                                    onClick={() => setStatusFilter('closed')}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                                        background: statusFilter === 'closed' ? colors.background : 'transparent',
                                        color: statusFilter === 'closed' ? colors.primary : colors.textSecondary,
                                        cursor: 'pointer', fontWeight: 600, fontSize: '12px'
                                    }}
                                >
                                    Closed
                                </button>
                            </div>
                            
                            {filteredTickets.length === 0 && (
                                <div style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary }}>
                                    <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                    <p>No {statusFilter} tickets</p>
                                </div>
                            )}
                            {filteredTickets.map(ticket => (
                                <div 
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    style={{ 
                                        padding: '16px 24px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer',
                                        background: selectedTicket?.id === ticket.id ? colors.background : 'transparent',
                                        borderLeft: selectedTicket?.id === ticket.id ? `4px solid ${colors.primary}` : '4px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '15px', color: colors.textPrimary }}>
                                            {ticket.ownerName || `Ticket #${ticket.id.slice(-4)}`}
                                        </span>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                                            {formatDate(ticket.createdAt).split(',')[0]}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
                                        <span style={{ 
                                            padding: '2px 8px', borderRadius: '12px',
                                            backgroundColor: getPriorityColor(ticket.priority) + '20',
                                            color: getPriorityColor(ticket.priority),
                                            fontWeight: 700, textTransform: 'uppercase', fontSize: '10px'
                                        }}>
                                            {ticket.priority}
                                        </span>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>#{ticket.id.slice(-4)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Ticket Detail Section */}
                        {selectedTicket ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.background }}>
                                {/* Toolbar */}
                                <div style={{ 
                                    padding: '16px 32px', 
                                    borderBottom: `1px solid ${colors.border}`, 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    background: colors.surface 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {isMobile && (
                                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: colors.textPrimary }}><ArrowLeft size={24} /></button>
                                        )}
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '18px', color: colors.textPrimary }}>{selectedTicket.ownerName || 'User'}</h3>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <User size={12} /> ID: {selectedTicket.ownerId}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <select 
                                            value={selectedTicket.priority}
                                            onChange={(e) => handleUpdatePriority(e.target.value as any)}
                                            style={{ background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, padding: '8px', borderRadius: '6px' }}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                        {selectedTicket.status === 'open' && (
                                            <button 
                                                onClick={() => handleUpdateStatus('closed')}
                                                style={{ background: '#ef444420', color: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Close
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {loadingMessages ? (
                                        <div style={{ textAlign: 'center', padding: '40px' }}><RefreshCw className="animate-spin" /></div>
                                    ) : (
                                        messages.map(msg => (
                                            <div key={msg.id} style={{ display: 'flex', gap: '12px' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: colors.surface }} />
                                                <div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600, color: colors.textPrimary }}>{msg.author.username}</span>
                                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                    <div style={{ background: colors.surface, padding: '10px 14px', borderRadius: '0 12px 12px 12px', marginTop: '4px', fontSize: '14px', color: colors.textPrimary }}>{msg.content}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Reply Box */}
                                {selectedTicket.status === 'open' && (
                                    <div style={{ padding: '24px', background: colors.surface, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px' }}>
                                        <textarea 
                                            value={replyContent}
                                            onChange={e => setReplyContent(e.target.value)}
                                            placeholder="Write a reply..."
                                            style={{ flex: 1, height: '60px', background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '12px', resize: 'none' }}
                                        />
                                        <button onClick={handleReply} style={{ background: colors.primary, color: '#fff', border: 'none', borderRadius: '8px', padding: '0 24px', cursor: 'pointer' }}><Send size={20}/></button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: colors.textSecondary }}>
                                <MessageSquare size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                <p>Select a ticket to begin viewing</p>
                            </div>
                        )}
                </div>
            ) : (
                /* Settings Layout */
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ background: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.border}`, padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                             <Shield size={20} color={colors.primary} />
                             <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Role Management</h2>
                        </div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '12px', fontWeight: 700 }}>STAFF ROLES TO PING</label>
                        <RoleSelect 
                            guildId={guildId} 
                            value={settings.staffRoleIds} 
                            onChange={(val) => setSettings({ ...settings, staffRoleIds: val as string[] })}
                            multiple={true}
                        />
                        <div style={{ marginTop: '20px' }}>
                             <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '12px', fontWeight: 700 }}>TICKET CATEGORY</label>
                             <ChannelSelect 
                                guildId={guildId} 
                                value={settings.ticketCategoryId || ''} 
                                onChange={(val) => setSettings({ ...settings, ticketCategoryId: val as string })}
                                channelTypes={[4]}
                             />
                        </div>
                    </div>

                    <div style={{ background: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.border}`, padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                             <History size={20} color={colors.primary} />
                             <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Automation & Logs</h2>
                        </div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '12px', fontWeight: 700 }}>TRANSCRIPT LOG CHANNEL</label>
                        <ChannelSelect 
                            guildId={guildId} 
                            value={settings.transcriptChannelId || ''} 
                            onChange={(val) => setSettings({ ...settings, transcriptChannelId: val as string })}
                            channelTypes={[0, 5]}
                        />
                        <div style={{ marginTop: '24px' }}>
                             <button 
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                style={{
                                    width: '100%', padding: '14px', background: colors.primary, color: '#fff',
                                    border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                             >
                                 {savingSettings ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                 Save Configuration
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

