import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, ChevronLeft, Send, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';

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

export const SupportPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login?next=/appeal');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadTickets();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  useEffect(() => {
    document.title = 'Fuji Studio | Support';
  }, []);

  const loadTickets = async () => {
    setFetchLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/my-tickets`, { credentials: 'include' });
      if (res.status === 403) { setBlocked(true); return; }
      if (res.ok) setTickets(await res.json());
    } catch {
      setError('Failed to load tickets.');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/tickets/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newSubject, message: newMessage }),
      });
      if (res.status === 403) { setBlocked(true); return; }
      if (!res.ok) { setError('Failed to open ticket.'); return; }
      const ticket = await res.json();
      setTickets(prev => [ticket, ...prev]);
      setSelected(ticket);
      setShowNewForm(false);
      setNewSubject('');
      setNewMessage('');
    } catch {
      setError('Failed to open ticket.');
    } finally {
      setSubmitting(false);
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

  const avatarUrl = (discordId: string) =>
    `https://cdn.discordapp.com/embed/avatars/${Number(discordId) % 5}.png`;

  const statusColor = (status: string) =>
    status === 'open' ? colors.success : colors.textTertiary;

  if (loading || fetchLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.background, color: colors.textSecondary }}>
        Loading...
      </div>
    );
  }

  if (blocked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.background }}>
        <div style={{ textAlign: 'center', padding: spacing.xxl, maxWidth: 400 }}>
          <Lock size={48} color={colors.error} style={{ marginBottom: spacing.lg }} />
          <h2 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.md}` }}>Access Revoked</h2>
          <p style={{ color: colors.textSecondary, margin: 0 }}>Your access to the support system has been revoked.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: colors.background, color: colors.textPrimary }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid rgba(255,255,255,0.06)`, padding: `${spacing.lg} ${spacing.xxl}`, display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <MessageSquare size={28} color={colors.primary} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Support / Appeal</h1>
          <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '0.85rem' }}>
            Open a ticket to appeal a moderation action or get help.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', maxHeight: 'calc(100vh - 80px)' }}>
        {/* Ticket list */}
        <div style={{ width: 300, minWidth: 300, borderRight: `1px solid rgba(255,255,255,0.06)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: spacing.md, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
            <button
              onClick={() => { setShowNewForm(true); setSelected(null); }}
              style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, fontWeight: 600 }}
            >
              <Plus size={16} />
              New Ticket
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tickets.length === 0 && !showNewForm && (
              <p style={{ color: colors.textSecondary, padding: spacing.lg, fontSize: '0.85rem', textAlign: 'center' }}>No tickets yet.</p>
            )}
            {tickets.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelected(t); setShowNewForm(false); }}
                style={{
                  width: '100%', textAlign: 'left', background: selected?.id === t.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                  border: 'none', borderBottom: `1px solid rgba(255,255,255,0.04)`, padding: `${spacing.md} ${spacing.lg}`,
                  cursor: 'pointer', color: colors.textPrimary,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.subject}</span>
                  <span style={{ fontSize: '0.7rem', color: statusColor(t.status), textTransform: 'uppercase', fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>{t.status}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textTertiary }}>{new Date(t.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {showNewForm ? (
            <div style={{ padding: spacing.xxl, maxWidth: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl }}>
                <button onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChevronLeft size={16} /> Back
                </button>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Open New Ticket</h2>
              </div>

              {/* Info block */}
              <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '0.9rem' }}>
                  Use this form to appeal a moderation action or request support. Our team will review your ticket and respond as soon as possible.
                </p>
              </div>

              <div style={{ marginBottom: spacing.lg }}>
                <label style={{ display: 'block', color: colors.textSecondary, fontSize: '0.85rem', marginBottom: spacing.sm }}>Subject</label>
                <input
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="e.g. Ban Appeal — [your username]"
                  style={{ width: '100%', background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: spacing.lg }}>
                <label style={{ display: 'block', color: colors.textSecondary, fontSize: '0.85rem', marginBottom: spacing.sm }}>Message</label>
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Describe your situation in detail..."
                  rows={6}
                  style={{ width: '100%', background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.error, marginBottom: spacing.md, fontSize: '0.85rem' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={submitting || !newSubject.trim() || !newMessage.trim()}
                style={{ padding: `${spacing.sm} ${spacing.xl}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: submitting ? 'wait' : 'pointer', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          ) : selected ? (
            <>
              {/* Thread header */}
              <div style={{ padding: `${spacing.md} ${spacing.xxl}`, borderBottom: `1px solid rgba(255,255,255,0.06)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{selected.subject}</h2>
                  <span style={{ fontSize: '0.75rem', color: statusColor(selected.status), textTransform: 'uppercase', fontWeight: 700 }}>{selected.status}</span>
                </div>
                <span style={{ color: colors.textTertiary, fontSize: '0.8rem' }}>#{selected.id.slice(-8)}</span>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: spacing.xxl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {selected.messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: spacing.md, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                      <img
                        src={avatarUrl(msg.senderId)}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: colors.surface }}
                      />
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ marginBottom: 4, fontSize: '0.75rem', color: colors.textTertiary, textAlign: isMe ? 'right' : 'left' }}>
                          {msg.isAdmin ? 'Fuji Studio Staff' : (isMe ? 'You' : 'User')}
                          {' · '}
                          {new Date(msg.timestamp).toLocaleString()}
                        </div>
                        <div style={{
                          background: msg.isAdmin ? 'rgba(16,185,129,0.12)' : isMe ? 'rgba(255,255,255,0.06)' : colors.surface,
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

              {/* Reply input */}
              {selected.status === 'open' ? (
                <div style={{ padding: spacing.lg, borderTop: `1px solid rgba(255,255,255,0.06)`, display: 'flex', gap: spacing.md, alignItems: 'flex-end' }}>
                  <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    style={{ flex: 1, background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', resize: 'none' }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={submitting || !replyContent.trim()}
                    style={{ padding: spacing.md, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: submitting || !replyContent.trim() ? 0.5 : 1 }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              ) : (
                <div style={{ padding: spacing.lg, borderTop: `1px solid rgba(255,255,255,0.06)`, textAlign: 'center', color: colors.textSecondary, fontSize: '0.85rem' }}>
                  This ticket is closed.
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, color: colors.textSecondary }}>
              <MessageSquare size={48} color={colors.textTertiary} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: colors.textPrimary }}>No ticket selected</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Select a ticket on the left or open a new one.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
