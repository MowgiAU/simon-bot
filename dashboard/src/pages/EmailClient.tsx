import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { colors, borderRadius, spacing } from '../theme/theme';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
    Mail, Send, Trash2, Settings, ArrowLeft, RefreshCw, Paperclip,
    MoreHorizontal, X, Plus, Bold, Italic, Underline, List, Inbox,
    ChevronLeft, ChevronRight, Circle
} from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface Email {
    threadId: string;
    from: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    date: string;
    category: 'inbox' | 'sent' | 'trash';
    read: boolean;
    messageId?: string;
    references?: string[] | string;
    attachments?: Array<{ filename: string; path: string; }>;
}

interface EmailSettings {
    webhookSecret?: string;
    resendApiKey?: string;
    fromName?: string;
    fromEmail?: string;
    channelId?: string;
    roleId?: string;
}

interface EmailPageProps {
    searchParam?: string;
}

const FOLDERS = [
    { key: 'inbox' as const, label: 'Inbox', icon: <Inbox size={13} /> },
    { key: 'sent'  as const, label: 'Sent',  icon: <Send size={13} /> },
    { key: 'trash' as const, label: 'Trash', icon: <Trash2 size={13} /> },
];

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ── Stable sub-components defined OUTSIDE the parent so they are never
// recreated on each keystroke, which would cause iframes to remount & flicker.

function useProcessedBody(html?: string) {
    if (!html) return { mainBody: '', quotedBody: '' };
    const gmailIdx = html.indexOf('class="gmail_quote"');
    if (gmailIdx !== -1) { const sp = html.lastIndexOf('<div', gmailIdx); if (sp !== -1) return { mainBody: html.substring(0, sp), quotedBody: html.substring(sp) }; }
    const bqIdx = html.indexOf('<blockquote');
    if (bqIdx !== -1) return { mainBody: html.substring(0, bqIdx), quotedBody: html.substring(bqIdx) };
    return { mainBody: html, quotedBody: '' };
}

const EmailBodyFrame: React.FC<{ html: string }> = ({ html }) => {
    const frameRef = React.useRef<HTMLIFrameElement>(null);
    const sanitized = DOMPurify.sanitize(html);
    const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html{margin:0;padding:0}body{margin:0;padding:12px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;word-break:break-word;overflow-x:hidden;background:#fff}a{color:#0066cc}img{max-width:100%;height:auto}p{margin:0 0 10px}blockquote{margin:0 0 10px 16px;padding-left:12px;border-left:3px solid #ccc;color:#555}pre,code{font-family:monospace;font-size:13px;background:#f5f5f5;padding:2px 4px;border-radius:3px}</style></head><body>${sanitized}</body></html>`;
    React.useEffect(() => {
        const frame = frameRef.current; if (!frame) return;
        const onLoad = () => { try { if (frame.contentDocument?.body) frame.style.height = frame.contentDocument.body.scrollHeight + 32 + 'px'; } catch {} };
        frame.addEventListener('load', onLoad);
        return () => frame.removeEventListener('load', onLoad);
    }, [html]);
    return (
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#fff', margin: '4px 0' }}>
            <iframe ref={frameRef} srcDoc={srcdoc} sandbox="allow-same-origin" style={{ width: '100%', border: 'none', display: 'block', minHeight: 60, background: '#fff' }} title="Email content" />
        </div>
    );
};

const EditorToolbar: React.FC = () => {
    const cmd = (c: string) => document.execCommand(c, false, undefined);
    return (
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
            {[{ icon: <Bold size={14}/>, c: 'bold' }, { icon: <Italic size={14}/>, c: 'italic' }, { icon: <Underline size={14}/>, c: 'underline' }, { icon: <List size={14}/>, c: 'insertUnorderedList' }].map(({ icon, c }) => (
                <button key={c} onMouseDown={e => { e.preventDefault(); cmd(c); }} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', borderRadius: 4, color: colors.textSecondary }}>
                    {icon}
                </button>
            ))}
        </div>
    );
};

const ThreadMessage: React.FC<{ msg: Email; isLast: boolean }> = ({ msg, isLast }) => {
    const isMobile = useMobile();
    const { mainBody, quotedBody } = useProcessedBody(msg.body);
    const [showQuoted, setShowQuoted] = useState(false);
    const [collapsed, setCollapsed] = useState(!isLast);
    const avatarSize = isMobile ? 28 : 36;
    const indent = isMobile ? 12 + avatarSize : 68;
    return (
        <div style={{ borderBottom: isLast ? 'none' : `1px solid rgba(255,255,255,0.06)` }}>
            <div onClick={() => setCollapsed(!collapsed)} style={{ padding: isMobile ? '12px' : '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, background: collapsed ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', backgroundColor: colors.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 13 : 15, fontWeight: 700, flexShrink: 0 }}>
                    {msg.from.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: colors.textPrimary }}>{msg.from}</span>
                        <span style={{ fontSize: 11, color: colors.textTertiary, flexShrink: 0 }}>{fmt(msg.date)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>to {msg.toEmail || 'me'}</div>
                    {collapsed && <div style={{ marginTop: 3, color: colors.textSecondary, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mainBody.replace(/<[^>]*>?/gm, ' ').substring(0, 100)}…</div>}
                </div>
            </div>
            {!collapsed && (
                <div style={{ padding: isMobile ? `0 12px 16px ${indent}px` : `0 20px 20px ${indent}px` }}>
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            {msg.attachments.map((att, i) => {
                                if (!att.path) return null;
                                const ext = att.filename.split('.').pop()?.toLowerCase() || '';
                                const url = `/api/email/attachment/${att.path}`;
                                if (['jpg','jpeg','png','gif','webp'].includes(ext))
                                    return <div key={i} style={{ marginBottom: 12 }}><img src={url} alt={att.filename} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} /></div>;
                                if (['mp3','wav','ogg'].includes(ext))
                                    return <div key={i} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}><div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{att.filename}</div><audio controls src={url} style={{ width: '100%' }} /></div>;
                                return <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textDecoration: 'none', color: colors.textSecondary, marginRight: 6, marginBottom: 6, fontSize: 12, border: '1px solid rgba(255,255,255,0.08)' }}><Paperclip size={12} />{att.filename}</a>;
                            })}
                        </div>
                    )}
                    <EmailBodyFrame html={mainBody} />
                    {quotedBody && (
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setShowQuoted(!showQuoted)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: colors.textTertiary }}>
                                <MoreHorizontal size={12} />
                            </button>
                            {showQuoted && <div style={{ marginTop: 10, borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 10 }}><EmailBodyFrame html={quotedBody} /></div>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const EmailClientPage: React.FC<EmailPageProps> = ({ searchParam }) => {
    const isMobile = useMobile();
    const [view, setView] = useState<'inbox' | 'sent' | 'trash' | 'settings'>('inbox');
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [currentThread, setCurrentThread] = useState<Email[]>([]);
    const [settings, setSettings] = useState<EmailSettings>({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [trashConfirm, setTrashConfirm] = useState<Email | null>(null);
    const [filterUnread, setFilterUnread] = useState(false);

    // Compose / Reply State
    const [composing, setComposing] = useState(false);
    const [inlineReplying, setInlineReplying] = useState(false);
    const inlineReplyFileRef = React.useRef<HTMLInputElement>(null);
    const [composeData, setComposeData] = useState<{
        to: string; subject: string; body: string; attachments: File[]; replyToMsg?: Email;
    }>({ to: '', subject: '', body: '', attachments: [] });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        const fetchData = async () => {
            if (view === 'settings') {
                setRefreshing(true);
                try {
                    const res = await axios.get('/api/email/settings', { withCredentials: true, signal: controller.signal });
                    if (isMounted) setSettings(res.data);
                } catch (e) { if (!axios.isCancel(e)) console.error(e); }
                finally { if (isMounted) setRefreshing(false); }
            } else {
                setLoading(true); setRefreshing(true);
                try {
                    const res = await axios.get(`/api/email/list/${view}`, { withCredentials: true, signal: controller.signal });
                    if (isMounted) setEmails(res.data);
                } catch (e) { if (!axios.isCancel(e)) console.error(e); }
                finally { if (isMounted) { setLoading(false); setRefreshing(false); } }
            }
        };
        fetchData();
        const interval = view !== 'settings' ? setInterval(fetchData, 30000) : null;
        return () => { isMounted = false; controller.abort(); if (interval) clearInterval(interval); };
    }, [view]);

    useEffect(() => {
        if (searchParam && emails.length > 0) {
            const email = emails.find(e => e.threadId === searchParam);
            if (email) setSelectedEmail(email);
        }
    }, [searchParam, emails]);

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        if (selectedEmail) {
            axios.get(`/api/email/thread?subject=${encodeURIComponent(selectedEmail.subject)}`, { withCredentials: true, signal: controller.signal })
                .then(res => { if (isMounted) setCurrentThread(res.data); })
                .catch(e => { if (!axios.isCancel(e) && isMounted) setCurrentThread([selectedEmail]); });
            if (!selectedEmail.read && selectedEmail.category === 'inbox') {
                axios.patch(`/api/email/${selectedEmail.threadId}`, { updates: { read: true } }, { withCredentials: true, signal: controller.signal })
                    .then(() => { if (isMounted) setEmails(prev => prev.map(e => e.threadId === selectedEmail.threadId ? { ...e, read: true } : e)); })
                    .catch(() => {});
            }
        } else { setCurrentThread([]); }
        return () => { isMounted = false; controller.abort(); };
    }, [selectedEmail]);

    const fetchEmails = async (category: string) => {
        setLoading(true); setRefreshing(true);
        try {
            const res = await axios.get(`/api/email/list/${category}`, { withCredentials: true });
            setEmails(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    };

    const fetchThread = async (subject: string) => {
        try {
            const res = await axios.get(`/api/email/thread?subject=${encodeURIComponent(subject)}`, { withCredentials: true });
            setCurrentThread(res.data);
        } catch { if (selectedEmail) setCurrentThread([selectedEmail]); }
    };

    const saveSettings = async () => {
        try {
            await axios.post('/api/email/settings', settings, { withCredentials: true });
            showToast('Settings saved!', 'success');
        } catch { showToast('Failed to save settings', 'error'); }
    };

    const startReply = () => {
        if (!selectedEmail) return;
        setInlineReplying(true);
        const lastMsg = currentThread[currentThread.length - 1] || selectedEmail;
        const ownEmail = settings.fromEmail?.toLowerCase();
        const lastInbound = [...currentThread].reverse().find(m => m.fromEmail?.toLowerCase() !== ownEmail && m.category !== 'sent') || selectedEmail;
        setComposeData(prev => ({
            ...prev, to: lastInbound.fromEmail,
            subject: lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`,
            body: '', attachments: [], replyToMsg: lastMsg,
        }));
    };

    const handleSend = async () => {
        try {
            const formData = new FormData();
            formData.append('to', composeData.to);
            formData.append('subject', composeData.subject);
            formData.append('body', composeData.body);
            if (settings.fromEmail) formData.append('replyTo', settings.fromEmail);
            if (composeData.replyToMsg?.messageId) {
                const originalId = composeData.replyToMsg.messageId;
                formData.append('inReplyTo', originalId);
                let refs = composeData.replyToMsg.references || '';
                if (Array.isArray(refs)) refs = refs.join(' ');
                formData.append('references', refs ? `${refs} ${originalId}` : originalId);
            }
            composeData.attachments.forEach(file => formData.append('attachments', file));
            await axios.post('/api/email/send', formData, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
            showToast('Email sent!', 'success');
            setComposing(false); setInlineReplying(false);
            setComposeData({ to: '', subject: '', body: '', attachments: [] });
            if (selectedEmail && normalizeSubject(selectedEmail.subject) === normalizeSubject(composeData.subject)) {
                fetchThread(selectedEmail.subject);
            }
            fetchEmails(view);
        } catch (e: any) {
            showToast(e?.response?.data?.error || 'Failed to send email', 'error');
        }
    };

    const normalizeSubject = (s: string) => s.replace(/^(Re|Fwd|FW):\s*/i, '').trim().toLowerCase();

    const confirmTrash = async (email: Email) => {
        setTrashConfirm(null);
        try {
            await axios.patch(`/api/email/${email.threadId}`, { updates: { category: 'trash' } }, { withCredentials: true });
            fetchEmails(view); setSelectedEmail(null);
        } catch { showToast('Failed to move email to trash', 'error'); }
    };

    const removeAttachment = (index: number) =>
        setComposeData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));

    // --- Sub-components ---

    // --- Derived data ---
    const visibleEmails = view === 'inbox' && filterUnread ? emails.filter(e => !e.read) : emails;
    const unreadCount = emails.filter(e => !e.read && e.category === 'inbox').length;

    // --- Render ---
    const inputStyle: React.CSSProperties = { padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: 13, outline: 'none', cursor: 'pointer' };

    const showList = !isMobile || !selectedEmail;
    const showDetail = !isMobile || !!selectedEmail;

    return (
        <>
        <div style={{ padding: isMobile ? 12 : 24 }}>
            {/* Page header */}
            {!(isMobile && selectedEmail) && (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? 16 : 24 }}>
                    <Mail size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: isMobile ? 10 : 16 }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: isMobile ? 18 : undefined }}>Email Client</h1>
                        {!isMobile && <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Send and receive emails directly from the dashboard</p>}
                    </div>
                </div>
            )}

            {!isMobile && (
                <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                    <p style={{ margin: 0, color: colors.textPrimary }}>Emails arrive via webhook and are stored in the dashboard. Configure the webhook secret and notification settings in the Settings tab.</p>
                </div>
            )}

            {/* Folder tabs + actions */}
            {!(isMobile && selectedEmail) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {FOLDERS.map(f => (
                        <button key={f.key} onClick={() => { setView(f.key); setSelectedEmail(null); setFilterUnread(false); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: borderRadius.sm, border: `1px solid ${view === f.key ? colors.primary : 'rgba(255,255,255,0.1)'}`, background: view === f.key ? `${colors.primary}18` : 'transparent', color: view === f.key ? colors.primary : colors.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {f.icon} {f.label}
                            {f.key === 'inbox' && unreadCount > 0 && <span style={{ marginLeft: 2, padding: '1px 6px', borderRadius: 999, background: colors.primary, color: '#fff', fontSize: 10, fontWeight: 700 }}>{unreadCount}</span>}
                        </button>
                    ))}
                    <button onClick={() => { setView('settings'); setSelectedEmail(null); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: borderRadius.sm, border: `1px solid ${view === 'settings' ? colors.primary : 'rgba(255,255,255,0.1)'}`, background: view === 'settings' ? `${colors.primary}18` : 'transparent', color: view === 'settings' ? colors.primary : colors.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <Settings size={13} /> Settings
                    </button>

                    {view === 'inbox' && (
                        <button onClick={() => setFilterUnread(f => !f)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: borderRadius.sm, border: `1px solid ${filterUnread ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`, background: filterUnread ? 'rgba(59,130,246,0.1)' : 'transparent', color: filterUnread ? '#3b82f6' : colors.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            <Circle size={8} style={{ fill: filterUnread ? '#3b82f6' : 'none' }} /> Unread only
                        </button>
                    )}

                    <div style={{ marginLeft: isMobile ? 0 : 'auto', width: isMobile ? '100%' : undefined, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {view !== 'settings' && <span style={{ fontSize: 13, color: colors.textTertiary }}>{visibleEmails.length} email{visibleEmails.length !== 1 ? 's' : ''}</span>}
                        <button onClick={() => view === 'settings' ? axios.get('/api/email/settings', { withCredentials: true }).then(r => setSettings(r.data)).catch(() => {}) : fetchEmails(view)} style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0 }} title="Refresh">
                            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                        {view !== 'settings' && (
                            <button onClick={() => { setComposing(true); setComposeData({ to: '', subject: '', body: '', attachments: [] }); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: borderRadius.sm, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, marginLeft: isMobile ? 'auto' : undefined }}>
                                <Plus size={14} /> Compose
                            </button>
                        )}
                    </div>
                </div>
            )}

            {view === 'settings' ? (
                /* Settings panel */
                <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? spacing.md : spacing.lg, maxWidth: isMobile ? '100%' : 600 }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>Email Settings</h3>
                    {[
                        { label: 'Webhook Secret', key: 'webhookSecret', placeholder: 'Paste whsec_ from Resend or generate one', hasGenerate: true },
                        { label: 'Default From Name', key: 'fromName', placeholder: 'Fuji Studio' },
                        { label: 'Default From Email', key: 'fromEmail', placeholder: 'hello@fujistud.io' },
                        { label: 'Discord Channel ID (Alerts)', key: 'channelId', placeholder: '' },
                        { label: 'Notify Role ID', key: 'roleId', placeholder: '' },
                    ].map(({ label, key, placeholder, hasGenerate }) => (
                        <div key={key} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input value={(settings as any)[key] || ''} onChange={e => setSettings({ ...settings, [key]: e.target.value })} placeholder={placeholder}
                                    style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: 13, outline: 'none' }} />
                                {hasGenerate && (
                                    <button onClick={() => setSettings({ ...settings, webhookSecret: Math.random().toString(36).slice(2).repeat(3) })} style={{ padding: '7px 12px', borderRadius: borderRadius.sm, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>Generate</button>
                                )}
                            </div>
                        </div>
                    ))}
                    <button onClick={saveSettings} style={{ padding: '9px 20px', borderRadius: borderRadius.md, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Save Settings</button>
                </div>
            ) : (
                /* Email list + detail — same pattern as BugReportsAdmin.
                   On mobile, list and detail are single-pane views (never side by side). */
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* List */}
                    {showList && (
                    <div style={{ flex: isMobile ? '1 1 auto' : (selectedEmail ? '0 0 380px' : '1 1 auto'), width: isMobile ? '100%' : undefined, minWidth: 0 }}>
                        {loading ? (
                            <p style={{ color: colors.textSecondary, textAlign: 'center', padding: 40 }}>Loading…</p>
                        ) : visibleEmails.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: colors.textTertiary }}>
                                <Mail size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                                <p>{filterUnread ? 'No unread emails.' : 'No emails here.'}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {visibleEmails.map(email => {
                                    const isSelected = selectedEmail?.threadId === email.threadId;
                                    const unread = !email.read && email.category === 'inbox';
                                    return (
                                        <div key={email.threadId} onClick={() => setSelectedEmail(email)} style={{ padding: '12px 16px', backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : colors.surface, borderRadius: borderRadius.md, border: `1px solid ${isSelected ? colors.primary : unread ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', transition: 'border-color 0.15s', background: unread && !isSelected ? 'rgba(59,130,246,0.04)' : undefined }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                {unread && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />}
                                                <span style={{ fontWeight: unread ? 700 : 500, color: colors.textPrimary, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {view === 'sent' ? `To: ${email.toEmail || email.from}` : email.from}
                                                </span>
                                                <span style={{ fontSize: 11, color: unread ? '#60a5fa' : colors.textTertiary, flexShrink: 0 }}>{fmtShort(email.date)}</span>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: unread ? 600 : 400, color: unread ? colors.textPrimary : colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                                                {email.subject || '(No Subject)'}
                                            </div>
                                            <div style={{ fontSize: 12, color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {email.body.replace(/<[^>]*>?/gm, ' ').substring(0, 100)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Detail panel */}
                    {showDetail && selectedEmail && (
                        <div style={{ flex: '1 1 auto', width: isMobile ? '100%' : undefined, minWidth: 0, backgroundColor: isMobile ? 'transparent' : colors.surface, borderRadius: isMobile ? 0 : borderRadius.lg, border: isMobile ? 'none' : `1px solid rgba(255,255,255,0.06)`, overflow: 'hidden' }}>
                            {/* Thread header */}
                            <div style={{ padding: isMobile ? '4px 0 12px' : '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                {isMobile && (
                                    <button onClick={() => { setSelectedEmail(null); setInlineReplying(false); }} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', display: 'flex', padding: '4px 4px 4px 0', flexShrink: 0 }}>
                                        <ArrowLeft size={18} />
                                    </button>
                                )}
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.textPrimary, flex: 1, lineHeight: 1.3 }}>{selectedEmail.subject}</h3>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button onClick={() => { setTrashConfirm(selectedEmail); }} title="Move to trash" style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '5px 8px', color: '#f87171', cursor: 'pointer', display: 'flex' }}>
                                        <Trash2 size={14} />
                                    </button>
                                    {!isMobile && (
                                        <button onClick={() => { setSelectedEmail(null); setInlineReplying(false); }} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', display: 'flex', padding: 4 }}>
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Thread messages */}
                            <div style={{ maxHeight: isMobile ? 'none' : 480, overflowY: isMobile ? 'visible' : 'auto' }}>
                                {currentThread.map((msg, idx) => (
                                    <ThreadMessage key={msg.threadId} msg={msg} isLast={idx === currentThread.length - 1} />
                                ))}
                            </div>

                            {/* Reply area */}
                            {inlineReplying ? (
                                <div style={{ margin: 16, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: 12, color: colors.textSecondary }}>Reply to {composeData.to}</span>
                                        <button onClick={() => setInlineReplying(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 0 }}><X size={14} /></button>
                                    </div>
                                    {composeData.attachments.length > 0 && (
                                        <div style={{ padding: '5px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                                            {composeData.attachments.map((f, i) => (
                                                <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: colors.textSecondary }}>
                                                    {f.name} <button onClick={() => removeAttachment(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: colors.textTertiary }}><X size={10}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <EditorToolbar />
                                    <div contentEditable suppressContentEditableWarning
                                        onInput={e => { const html = (e.currentTarget as HTMLElement).innerHTML; setComposeData(prev => ({...prev, body: html})); }}
                                        style={{ padding: '10px 14px', outline: 'none', minHeight: 80, maxHeight: 200, overflowY: 'auto', fontSize: 13, color: colors.textPrimary }} />
                                    <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button onClick={handleSend} style={{ background: colors.primary, color: '#fff', border: 'none', padding: '7px 18px', borderRadius: 999, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Send</button>
                                        <button onClick={() => inlineReplyFileRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: 4 }} title="Attach"><Paperclip size={16} /></button>
                                        <input type="file" multiple ref={inlineReplyFileRef} style={{ display: 'none' }} onChange={e => { if (e.target.files) setComposeData(prev => ({...prev, attachments: [...prev.attachments, ...Array.from(e.target.files!)]})); }} />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '12px 20px' }}>
                                    <button onClick={startReply} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: colors.textSecondary, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                        <RefreshCw size={13} /> Reply
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Compose modal */}
        {composing && (
            <div style={{ position: 'fixed', bottom: 0, right: isMobile ? 0 : 24, width: isMobile ? '100%' : 560, height: isMobile ? '100%' : 560, background: colors.surface, borderRadius: isMobile ? 0 : '10px 10px 0 0', boxShadow: '0 0 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 1000, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ background: colors.primary, color: '#fff', padding: '11px 18px', borderRadius: isMobile ? 0 : '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{composeData.subject || 'New Message'}</span>
                    <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8 }}><X size={16} /></button>
                </div>
                <input placeholder="To" value={composeData.to} onChange={e => setComposeData(p => ({...p, to: e.target.value}))} style={{ padding: '10px 18px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', outline: 'none', fontSize: 13, background: 'transparent', color: colors.textPrimary }} />
                <input placeholder="Subject" value={composeData.subject} onChange={e => setComposeData(p => ({...p, subject: e.target.value}))} style={{ padding: '10px 18px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', outline: 'none', fontSize: 13, background: 'transparent', color: colors.textPrimary }} />
                {composeData.attachments.length > 0 && (
                    <div style={{ padding: '4px 18px', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                        {composeData.attachments.map((f, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: colors.textSecondary }}>
                                {f.name} <button onClick={() => removeAttachment(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: colors.textTertiary }}><X size={10}/></button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <EditorToolbar />
                    <div contentEditable suppressContentEditableWarning onInput={e => { const html = (e.currentTarget as HTMLElement).innerHTML; setComposeData(p => ({...p, body: html})); }} style={{ flex: 1, padding: '14px 18px', outline: 'none', overflowY: 'auto', fontSize: 14, color: colors.textPrimary, minHeight: 80 }} />
                </div>
                <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleSend} style={{ background: colors.primary, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 999, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Send</button>
                        <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: 6 }} title="Attach files"><Paperclip size={18} /></button>
                        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={e => { if (e.target.files) setComposeData(p => ({...p, attachments: [...p.attachments, ...Array.from(e.target.files!)]})); }} />
                    </div>
                    <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary }}><Trash2 size={15} /></button>
                </div>
            </div>
        )}

        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

        <ConfirmModal
            open={!!trashConfirm}
            title="Move to Trash"
            message="Move this email to trash?"
            confirmLabel="Move to Trash"
            danger
            onConfirm={() => trashConfirm && confirmTrash(trashConfirm)}
            onCancel={() => setTrashConfirm(null)}
        />
        </>
    );
};
