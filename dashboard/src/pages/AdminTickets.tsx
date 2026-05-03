import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, UserX, UserCheck, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = import.meta.env.VITE_API_URL ?? '';

interface TicketMessage {
  id: string;
  senderId: string;
  content: string;
  isAdmin: boolean;
  timestamp: string;
}

interface Ticket {
  id: string;
  userId: string;
  status: 'open' | 'closed';
  subject: string;
  createdAt: string;
  messages: TicketMessage[];
}

export const AdminTicketsPage: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [blockStatus, setBlockStatus] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadTickets(); }, [statusFilter]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/api/admin/tickets${params}`, { credentials: 'include' });
      if (res.ok) setTickets(await res.json());
    } catch {
      setError('Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/tickets/${selected.id}/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent }),
      });
      if (!res.ok) { setError('Failed to send reply.'); return; }
      const msg = await res.json();
      const updated = { ...selected, messages: [...selected.messages, msg] };
      setSelected(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      setReplyContent('');
    } catch {
      setError('Failed to send reply.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (ticket: Ticket) => {
    const newStatus = ticket.status === 'open' ? 'closed' : 'open';
    try {
      const res = await fetch(`${API}/api/admin/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = { ...ticket, status: newStatus as 'open' | 'closed' };
        if (selected?.id === ticket.id) setSelected(updated);
        setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
      }
    } catch {
      setError('Failed to update ticket status.');
    }
  };

  const handleBlockToggle = async (userId: string) => {
    try {
      const res = await fetch(`${API}/api/admin/tickets/${userId}/block`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBlockStatus(prev => ({ ...prev, [userId]: data.isTicketBlocked }));
      }
    } catch {
      setError('Failed to update block status.');
    }
  };

  const statusColor = (status: string) =>
    status === 'open' ? colors.success : colors.textTertiary;

  const avatarUrl = (discordId: string) =>
    `https://cdn.discordapp.com/embed/avatars/${Number(discordId) % 5}.png`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xxl }}>
        <MessageSquare size={32} color={colors.primary} style={{ marginRight: spacing.lg }} />
        <div>
          <h1 style={{ margin: 0 }}>Support Tickets</h1>
          <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage and respond to user ban appeals and support requests.</p>
        </div>
      </div>

      {/* Info block */}
      <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
        <p style={{ margin: 0, color: colors.textPrimary }}>Users open these tickets via the appeal form at <strong>fujistud.io/appeal</strong>. Reply here and close when resolved. You can block users from the ticket system using the block button on each ticket.</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg }}>
        {(['open', 'closed', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            style={{
              padding: `${spacing.sm} ${spacing.lg}`, borderRadius: borderRadius.md,
              border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: statusFilter === f ? colors.primary : colors.surface,
              color: statusFilter === f ? '#fff' : colors.textSecondary,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flex: 1, gap: spacing.lg, overflow: 'hidden', minHeight: 0 }}>
        {/* Ticket list */}
        <div style={{ width: 320, minWidth: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.surface, borderRadius: borderRadius.lg }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <p style={{ padding: spacing.lg, color: colors.textSecondary, fontSize: '0.85rem', textAlign: 'center' }}>Loading…</p>
            ) : tickets.length === 0 ? (
              <p style={{ padding: spacing.lg, color: colors.textSecondary, fontSize: '0.85rem', textAlign: 'center' }}>No tickets.</p>
            ) : tickets.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: selected?.id === t.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                  border: 'none', borderBottom: `1px solid rgba(255,255,255,0.04)`,
                  padding: `${spacing.md} ${spacing.lg}`, cursor: 'pointer', color: colors.textPrimary,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.subject}</span>
                  <span style={{ fontSize: '0.7rem', color: statusColor(t.status), fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, marginLeft: 4 }}>{t.status}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textTertiary }}>
                  {`<@${t.userId}>`} · {new Date(t.createdAt).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textTertiary, marginTop: 2 }}>
                  {t.messages.length} message{t.messages.length !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.surface, borderRadius: borderRadius.lg }}>
          {selected ? (
            <>
              {/* Thread header */}
              <div style={{ padding: `${spacing.md} ${spacing.xl}`, borderBottom: `1px solid rgba(255,255,255,0.06)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{selected.subject}</h3>
                  <span style={{ fontSize: '0.75rem', color: colors.textTertiary }}>
                    User: {selected.userId} · #{selected.id.slice(-8)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <button
                    onClick={() => handleBlockToggle(selected.userId)}
                    title={blockStatus[selected.userId] ? 'Unblock from tickets' : 'Block from tickets'}
                    style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, background: blockStatus[selected.userId] ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', color: blockStatus[selected.userId] ? colors.error : colors.textSecondary }}
                  >
                    {blockStatus[selected.userId] ? <UserCheck size={14} /> : <UserX size={14} />}
                    {blockStatus[selected.userId] ? 'Unblock' : 'Block'}
                  </button>
                  <button
                    onClick={() => handleStatusToggle(selected)}
                    style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, background: selected.status === 'open' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: selected.status === 'open' ? colors.error : colors.success }}
                  >
                    {selected.status === 'open' ? <CheckCircle size={14} /> : <Circle size={14} />}
                    {selected.status === 'open' ? 'Close' : 'Reopen'}
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {selected.messages.map(msg => {
                  const isFromAdmin = msg.isAdmin;
                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: spacing.md, flexDirection: isFromAdmin ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                      <img
                        src={avatarUrl(msg.senderId)}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}
                      />
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ marginBottom: 4, fontSize: '0.75rem', color: colors.textTertiary, textAlign: isFromAdmin ? 'right' : 'left' }}>
                          {isFromAdmin ? '🛡 Staff' : `User (${msg.senderId})`}
                          {' · '}
                          {new Date(msg.timestamp).toLocaleString()}
                        </div>
                        <div style={{
                          background: isFromAdmin ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                          padding: `${spacing.sm} ${spacing.md}`,
                          borderRadius: borderRadius.lg,
                          color: colors.textPrimary,
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply */}
              {selected.status === 'open' && (
                <div style={{ padding: spacing.lg, borderTop: `1px solid rgba(255,255,255,0.06)`, display: 'flex', gap: spacing.md, alignItems: 'flex-end' }}>
                  <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                    placeholder="Reply as staff… (Enter to send)"
                    rows={2}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', resize: 'none' }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={submitting || !replyContent.trim()}
                    style={{ padding: spacing.md, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: submitting || !replyContent.trim() ? 0.5 : 1 }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              )}

              {error && (
                <div style={{ padding: `${spacing.sm} ${spacing.lg}`, display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.error, fontSize: '0.85rem' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, color: colors.textSecondary }}>
              <MessageSquare size={48} color={colors.textTertiary} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a ticket to view the thread.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
