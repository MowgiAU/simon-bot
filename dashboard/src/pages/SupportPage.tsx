import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, ChevronLeft, Send, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = import.meta.env.VITE_API_URL ?? '';

interface Message {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username: string; avatar: string | null; bot?: boolean };
}

interface Ticket {
  id: string;
  channelId: string;
  ownerId: string;
  ownerName?: string | null;
  status: 'open' | 'closed';
  subject?: string | null;
  createdAt: string;
}

const discordAvatarUrl = (id: string, hash: string | null | undefined) => {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64`;
  const idx = Number(BigInt(id) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
};

const SignInGate: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: colors.background, padding: spacing.xxl }}>
    <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
      <MessageSquare size={52} color={colors.primary} style={{ marginBottom: spacing.lg }} />
      <h1 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.md}`, fontSize: '1.5rem' }}>Support & Ban Appeals</h1>
      <p style={{ color: colors.textSecondary, marginBottom: spacing.xxl, lineHeight: 1.6 }}>
        Sign in with your Discord account to open a support ticket or appeal a moderation action. No account creation required.
      </p>
      <a
        href={`${API}/api/auth/appeal/login`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.md,
          padding: `${spacing.md} ${spacing.xxl}`, background: '#5865F2',
          color: '#fff', borderRadius: borderRadius.md, textDecoration: 'none',
          fontWeight: 700, fontSize: '1rem',
        }}
        onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseOut={e => (e.currentTarget.style.opacity = '1')}
      >
        <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
        </svg>
        Sign in with Discord
      </a>
      <p style={{ color: colors.textTertiary, fontSize: '0.8rem', marginTop: spacing.lg }}>
        We only request your username and avatar — no access to your messages or servers.
      </p>
    </div>
  </div>
);

export const SupportPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Fuji Studio | Support'; }, []);

  useEffect(() => {
    if (user) loadTickets();
    else if (!loading) setFetchLoading(false);
  }, [user, loading]);

  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected?.id]);

  // Poll for new messages every 15 seconds on open tickets
  useEffect(() => {
    if (!selected || selected.status !== 'open') return;
    const interval = setInterval(() => {
      fetch(`${API}/api/web-tickets/${selected.id}/messages`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setMessages(data); })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [selected?.id, selected?.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTickets = async () => {
    setFetchLoading(true);
    try {
      const res = await fetch(`${API}/api/web-tickets/my-tickets`, { credentials: 'include' });
      if (res.status === 403) { setBlocked(true); return; }
      if (res.ok) setTickets(await res.json());
    } catch { setError('Failed to load tickets.'); }
    finally { setFetchLoading(false); }
  };

  const loadMessages = async (ticket: Ticket) => {
    setMsgLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`${API}/api/web-tickets/${ticket.id}/messages`, { credentials: 'include' });
      if (res.ok) setMessages(await res.json());
    } catch { /* non-fatal */ }
    finally { setMsgLoading(false); }
  };

  const handleCreate = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${API}/api/web-tickets/create`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newSubject, message: newMessage }),
      });
      if (res.status === 403) { setBlocked(true); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to open ticket.'); return; }
      setTickets(prev => [data, ...prev]);
      setSelected(data);
      setShowNewForm(false);
      setNewSubject(''); setNewMessage('');
    } catch { setError('Failed to open ticket.'); }
    finally { setSubmitting(false); }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selected) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${API}/api/web-tickets/${selected.id}/reply`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent }),
      });
      if (!res.ok) { setError('Failed to send reply.'); return; }
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setReplyContent('');
    } catch { setError('Failed to send reply.'); }
    finally { setSubmitting(false); }
  };

  const statusColor = (s: string) => s === 'open' ? colors.success : colors.textTertiary;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.background, color: colors.textSecondary }}>Loading...</div>;
  if (!user) return <SignInGate />;
  if (blocked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.background }}>
      <div style={{ textAlign: 'center', padding: spacing.xxl, maxWidth: 400 }}>
        <Lock size={48} color={colors.error} style={{ marginBottom: spacing.lg }} />
        <h2 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.md}` }}>Access Revoked</h2>
        <p style={{ color: colors.textSecondary, margin: 0 }}>Your access to the support system has been revoked.</p>
      </div>
    </div>
  );
  if (fetchLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.background, color: colors.textSecondary }}>Loading tickets...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: colors.background, color: colors.textPrimary }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid rgba(255,255,255,0.06)`, padding: `${spacing.lg} ${spacing.xxl}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <MessageSquare size={28} color={colors.primary} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Support / Appeal</h1>
            <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '0.85rem' }}>Appeal a moderation action or get help from our team.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <img src={discordAvatarUrl(user.id, user.avatar)} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          <span style={{ fontSize: '0.85rem', color: colors.textSecondary }}>{(user as any).global_name || user.username}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', maxHeight: 'calc(100vh - 80px)' }}>
        {/* Ticket list */}
        <div style={{ width: 300, minWidth: 300, borderRight: `1px solid rgba(255,255,255,0.06)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: spacing.md, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
            <button onClick={() => { setShowNewForm(true); setSelected(null); }}
              style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, fontWeight: 600 }}>
              <Plus size={16} /> New Ticket
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tickets.length === 0 && !showNewForm && (
              <p style={{ color: colors.textSecondary, padding: spacing.lg, fontSize: '0.85rem', textAlign: 'center' }}>No tickets yet.</p>
            )}
            {tickets.map(t => (
              <button key={t.id} onClick={() => { setSelected(t); setShowNewForm(false); }}
                style={{ width: '100%', textAlign: 'left', background: selected?.id === t.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: `1px solid rgba(255,255,255,0.04)`, padding: `${spacing.md} ${spacing.lg}`, cursor: 'pointer', color: colors.textPrimary }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.subject || t.ownerName || 'Ticket'}</span>
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
              <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '0.9rem' }}>
                  Use this form to appeal a moderation action or request support. A private channel will be created in our Discord server where our team will review and respond.
                </p>
              </div>
              <div style={{ marginBottom: spacing.lg }}>
                <label style={{ display: 'block', color: colors.textSecondary, fontSize: '0.85rem', marginBottom: spacing.sm }}>Subject</label>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. Ban Appeal — [your username]"
                  style={{ width: '100%', background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: spacing.lg }}>
                <label style={{ display: 'block', color: colors.textSecondary, fontSize: '0.85rem', marginBottom: spacing.sm }}>Message</label>
                <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Describe your situation in detail..." rows={6}
                  style={{ width: '100%', background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              {error && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.error, marginBottom: spacing.md, fontSize: '0.85rem' }}><AlertCircle size={14} /> {error}</div>}
              <button onClick={handleCreate} disabled={submitting || !newSubject.trim() || !newMessage.trim()}
                style={{ padding: `${spacing.sm} ${spacing.xl}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: submitting ? 'wait' : 'pointer', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          ) : selected ? (
            <>
              <div style={{ padding: `${spacing.md} ${spacing.xxl}`, borderBottom: `1px solid rgba(255,255,255,0.06)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{selected.subject || 'Ticket'}</h2>
                  <span style={{ fontSize: '0.75rem', color: statusColor(selected.status), textTransform: 'uppercase', fontWeight: 700 }}>{selected.status}</span>
                </div>
                <span style={{ color: colors.textTertiary, fontSize: '0.8rem' }}>#{selected.id.slice(-8)}</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: spacing.xxl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {msgLoading && <p style={{ color: colors.textSecondary, fontSize: '0.85rem', textAlign: 'center' }}>Loading messages…</p>}
                {messages.map(msg => {
                  const isMe = msg.author.id === user.id;
                  const avatarSrc = msg.author.avatar
                    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=64`
                    : discordAvatarUrl(msg.author.id, null);
                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: spacing.md, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                      <img src={avatarSrc} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ marginBottom: 4, fontSize: '0.75rem', color: colors.textTertiary, textAlign: isMe ? 'right' : 'left' }}>
                          {isMe ? ((user as any).global_name || user.username) : (msg.author.bot ? 'Fuji Studio Staff' : msg.author.username)}
                          {' · '}{new Date(msg.timestamp).toLocaleString()}
                        </div>
                        <div style={{ background: isMe ? 'rgba(255,255,255,0.06)' : msg.author.bot ? 'rgba(16,185,129,0.12)' : colors.surface, padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {selected.status === 'open' ? (
                <div style={{ padding: spacing.lg, borderTop: `1px solid rgba(255,255,255,0.06)`, display: 'flex', gap: spacing.md, alignItems: 'flex-end' }}>
                  <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for new line)" rows={2}
                    style={{ flex: 1, background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', resize: 'none' }} />
                  <button onClick={handleReply} disabled={submitting || !replyContent.trim()}
                    style={{ padding: spacing.md, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: submitting || !replyContent.trim() ? 0.5 : 1 }}>
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
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Select a ticket or open a new one.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
