import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { colors, borderRadius, spacing } from '../theme/theme';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
    Mail, Send, Trash2, Settings, ArrowLeft, RefreshCw, Paperclip, 
    MoreHorizontal, X, Plus, Bold, Italic, Underline, List, Link as LinkIcon 
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

export const EmailClientPage: React.FC<EmailPageProps> = ({ searchParam }) => {
    const isMobile = useMobile();
    const [view, setView] = useState<'inbox' | 'sent' | 'trash' | 'settings'>('inbox');
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [currentThread, setCurrentThread] = useState<Email[]>([]); // New Thread State
    const [settings, setSettings] = useState<EmailSettings>({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [trashConfirm, setTrashConfirm] = useState<Email | null>(null);
    
    // Compose / Reply State
    const [composing, setComposing] = useState(false);
    const [composeData, setComposeData] = useState<{
        to: string;
        subject: string;
        body: string;
        attachments: File[];
        replyToMsg?: Email;
    }>({ to: '', subject: '', body: '', attachments: [] });

    // Helper for Reply Mode in the reading pane (quick reply)
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Processed body parts for reading (for the main/selected email)
    // In thread view, we will just use a simple quote collapse logic component per message
    // const { mainBody, quotedBody } = useProcessedBody(selectedEmail?.body);
    // const [showQuoted, setShowQuoted] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;

        const fetchData = async () => {
            if (view === 'settings') {
                setRefreshing(true);
                try {
                    const res = await axios.get('/api/email/settings', { withCredentials: true, signal: controller.signal });
                    if (isMounted) setSettings(res.data);
                } catch (e) {
                    if (!axios.isCancel(e)) console.error(e);
                } finally {
                    if (isMounted) setRefreshing(false);
                }
            } else {
                setLoading(true);
                setRefreshing(true);
                try {
                    const res = await axios.get(`/api/email/list/${view}`, { withCredentials: true, signal: controller.signal });
                    if (isMounted) setEmails(res.data);
                } catch (e) {
                    if (!axios.isCancel(e)) console.error(e);
                } finally {
                    if (isMounted) {
                        setLoading(false);
                        setRefreshing(false);
                    }
                }
            }
        };

        fetchData();
        const interval = (view !== 'settings') ? setInterval(fetchData, 30000) : null;
        
        return () => {
            isMounted = false;
            controller.abort();
            if (interval) clearInterval(interval);
        };
    }, [view]);

    useEffect(() => {
        if (searchParam && emails.length > 0) {
            const email = emails.find(e => e.threadId === searchParam);
            if (email) {
                setSelectedEmail(email);
            }
        }
    }, [searchParam, emails]);

    // When an email is selected, fetch its full thread
    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;

        if (selectedEmail) {
            const fetchThread = async (subject: string) => {
                try {
                    const res = await axios.get(`/api/email/thread?subject=${encodeURIComponent(subject)}`, { withCredentials: true, signal: controller.signal });
                    if (isMounted) setCurrentThread(res.data);
                } catch(e) {
                    if (!axios.isCancel(e)) {
                        console.error('Failed to fetch thread', e);
                        if (isMounted) setCurrentThread([selectedEmail]);
                    }
                }
            };
            fetchThread(selectedEmail.subject);
            
            // Mark read if needed
            if (!selectedEmail.read && selectedEmail.category === 'inbox') {
                axios.patch(`/api/email/${selectedEmail.threadId}`, { updates: { read: true } }, { withCredentials: true, signal: controller.signal })
                    .then(() => {
                        if (isMounted) setEmails(prev => prev.map(e => e.threadId === selectedEmail.threadId ? { ...e, read: true } : e));
                    })
                    .catch(e => {
                        if (!axios.isCancel(e)) console.error('Failed to mark as read', e);
                    });
            }
        } else {
            setCurrentThread([]);
        }

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [selectedEmail]);

    const fetchEmails = async (category: string) => {
        setLoading(true);
        setRefreshing(true);
        try {
            const res = await axios.get(`/api/email/list/${category}`, { withCredentials: true });
            setEmails(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    const fetchThread = async (subject: string) => {
        try {
            const res = await axios.get(`/api/email/thread?subject=${encodeURIComponent(subject)}`, { withCredentials: true });
            setCurrentThread(res.data);
        } catch(e) {
            console.error('Failed to fetch thread', e);
            // Fallback to just showing the selected email
            if (selectedEmail) setCurrentThread([selectedEmail]);
        }
    };

    const fetchSettings = async () => {
        setRefreshing(true);
        try {
            const res = await axios.get('/api/email/settings', { withCredentials: true });
            setSettings(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    };

    const saveSettings = async () => {
        try {
            await axios.post('/api/email/settings', settings, { withCredentials: true });
            showToast('Settings saved!', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to save settings', 'error');
        }
    };

    const handleSelectEmail = (email: Email) => {
        setSelectedEmail(email);
    };

    // Prepare a reply
    const startReply = () => {
        if (!selectedEmail) return;
        setComposeData({
            to: selectedEmail.fromEmail,
            subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            body: '', // Start empty, maybe quote later
            attachments: [],
            replyToMsg: selectedEmail
        });
        setComposing(true);
    };

    // Prepare a new email
    const startCompose = () => {
        setComposeData({
            to: '',
            subject: '',
            body: '',
            attachments: []
        });
        setComposing(true);
    };

    const handleSend = async () => {
        try {
            const formData = new FormData();
            formData.append('to', composeData.to);
            formData.append('subject', composeData.subject);
            formData.append('body', composeData.body); // Currently HTML from contentEditable
            if (settings.fromEmail) formData.append('replyTo', settings.fromEmail);

            // Handle Threading Headers
            if (composeData.replyToMsg?.messageId) {
                const originalId = composeData.replyToMsg.messageId;
                formData.append('inReplyTo', originalId);
                
                let refs = composeData.replyToMsg.references || '';
                if (Array.isArray(refs)) refs = refs.join(' ');
                
                // Append original ID to references
                const newRefs = refs ? `${refs} ${originalId}` : originalId;
                formData.append('references', newRefs);
            }

            composeData.attachments.forEach(file => {
                formData.append('attachments', file);
            });

            await axios.post('/api/email/send', formData, { 
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            showToast('Email sent!', 'success');
            setComposing(false);
            setComposeData({ to: '', subject: '', body: '', attachments: [] });
            
            // Refresh logic:
            // If we are viewing a thread that matches the subject we just sent, refresh the thread
            if (selectedEmail && normalizeSubject(selectedEmail.subject) === normalizeSubject(composeData.subject)) {
                fetchThread(selectedEmail.subject);
            }
            fetchEmails(view);
        } catch (e: any) {
            const msg = e?.response?.data?.error || 'Failed to send email';
            showToast(msg, 'error');
            console.error(e);
        }
    };

    const normalizeSubject = (s: string) => s.replace(/^(Re|Fwd|FW):\s*/i, '').trim().toLowerCase();

    const handleDelete = async (email: Email) => {
        setTrashConfirm(email);
    };

    const confirmTrash = async (email: Email) => {
        setTrashConfirm(null);
        try {
             await axios.patch(`/api/email/${email.threadId}`, { updates: { category: 'trash' } }, { withCredentials: true });
             fetchEmails(view);
             setSelectedEmail(null);
        } catch (e) {
            showToast('Failed to move email to trash', 'error');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setComposeData(prev => ({
                ...prev,
                attachments: [...prev.attachments, ...Array.from(e.target.files!)]
            }));
        }
    };

    const removeAttachment = (index: number) => {
        setComposeData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
    };

    // --- Helpers ---

    function useProcessedBody(html?: string) {
        if (!html) return { mainBody: '', quotedBody: '' };
        const gmailQuoteIdx = html.indexOf('class="gmail_quote"');
        if (gmailQuoteIdx !== -1) {
            const splitPoint = html.lastIndexOf('<div', gmailQuoteIdx);
            if (splitPoint !== -1) {
                return { mainBody: html.substring(0, splitPoint), quotedBody: html.substring(splitPoint) };
            }
        }
        const blockquoteIdx = html.indexOf('<blockquote');
        if (blockquoteIdx !== -1) {
             return { mainBody: html.substring(0, blockquoteIdx), quotedBody: html.substring(blockquoteIdx) };
        }
        return { mainBody: html, quotedBody: '' };
    }

    // Renders HTML email body in an isolated iframe to prevent style bleed
    const EmailBodyFrame = ({ html }: { html: string }) => {
        const ref = React.useRef<HTMLIFrameElement>(null);
        React.useEffect(() => {
            const iframe = ref.current;
            if (!iframe) return;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;
            const sanitized = DOMPurify.sanitize(html);
            doc.open();
            doc.write(`<!DOCTYPE html><html><head><style>
                body { margin: 0; padding: 0; font-family: sans-serif; font-size: 14px; background: #fff; color: #000; word-break: break-word; }
                a { color: #0066cc; }
                img { max-width: 100%; height: auto; }
            </style></head><body>${sanitized}</body></html>`);
            doc.close();
            // Auto-resize iframe to content height
            const resize = () => {
                if (iframe.contentDocument?.body) {
                    iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
                }
            };
            iframe.onload = resize;
            setTimeout(resize, 100);
        }, [html]);
        return <iframe ref={ref} sandbox="allow-same-origin" style={{ width: '100%', border: 'none', borderRadius: '4px', background: '#fff', minHeight: '40px' }} />;
    };

    // --- Editor Component (Simple) ---
    const EditorToolbar = () => {
        const cmd = (c: string, v?: string) => {
            document.execCommand(c, false, v);
            // Focus callback handled by browser usually
        };
        return (
            <div style={{ display: 'flex', gap: '4px', padding: '8px', background: colors.background, borderBottom: `1px solid ${colors.border}` }}>
                <ToolbarBtn onClick={() => cmd('bold')} icon={<Bold size={16}/>} />
                <ToolbarBtn onClick={() => cmd('italic')} icon={<Italic size={16}/>} />
                <ToolbarBtn onClick={() => cmd('underline')} icon={<Underline size={16}/>} />
                <div style={{ width: 1, background: colors.border, margin: '0 4px' }} />
                <ToolbarBtn onClick={() => cmd('insertUnorderedList')} icon={<List size={16}/>} />
                {/* <ToolbarBtn onClick={() => {
                    const url = prompt('URL:');
                    if(url) cmd('createLink', url);
                }} icon={<LinkIcon size={16}/>} /> */}
            </div>
        );
    };

    const ToolbarBtn = ({ onClick, icon }: any) => (
        <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', borderRadius: '4px', color: colors.textPrimary }} className='hover-bg'>
            {icon}
        </button>
    );

    // --- Callbacks for Thread Render ---
    
    // Renders a single message in the thread
    const ThreadMessage = ({ msg, isLast, startReply }: { msg: Email, isLast: boolean, startReply: () => void }) => {
        const { mainBody, quotedBody } = useProcessedBody(msg.body);
        const [showQuoted, setShowQuoted] = useState(false);
        const [collapsed, setCollapsed] = useState(!isLast); // Collapse all except last by default

        // Expand if clicked
        const toggleCollapse = () => setCollapsed(!collapsed);

        return (
            <div style={{ borderBottom: isLast ? 'none' : `1px solid ${colors.border}`, background: colors.surface }}>
                {/* Header (Clickable for collapse) */}
                <div 
                    onClick={toggleCollapse}
                    style={{ 
                        padding: '16px 24px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px',
                        background: collapsed ? colors.background : colors.surface
                    }}
                >
                     <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600 }}>
                        {msg.from.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                             <span style={{ fontWeight: 700, fontSize: '14px', color: colors.textPrimary }}>{msg.from}</span>
                             <span style={{ fontSize: '12px', color: colors.textSecondary }}>{new Date(msg.date).toLocaleString()}</span>
                         </div>
                         <div style={{ fontSize: '12px', color: colors.textSecondary }}>to {msg.toEmail || 'me'}</div>
                         {collapsed && (
                             <div style={{ marginTop: '4px', color: colors.textSecondary, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 {mainBody.replace(/<[^>]*>?/gm, ' ').substring(0, 100)}...
                             </div>
                         )}
                    </div>
                </div>

                {/* Expanded Body */}
                {!collapsed && (
                    <div className="email-body-scroll" style={{ padding: '0 24px 24px', paddingLeft: '76px', fontSize: '14px', lineHeight: '1.5', color: colors.textPrimary }}>
                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                            {msg.attachments.map((att, i) => {
                                if (!att.path) return null;
                                const ext = att.filename.split('.').pop()?.toLowerCase() || '';
                                const url = `/api/email/attachment/${att.path}`;
                                    
                                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                                    return (
                                        <div key={i} style={{ marginBottom: '16px' }}>
                                            <img src={url} alt={att.filename} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: `1px solid ${colors.border}` }} />
                                        </div>
                                    );
                                }
                                if (['mp3', 'wav', 'ogg'].includes(ext)) {
                                    return (
                                        <div key={i} style={{ marginBottom: '16px', background: colors.background, padding: '12px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                                            <div style={{fontSize: '12px', color: colors.textSecondary, marginBottom: '8px', fontWeight: 500 }}>{att.filename}</div>
                                            <audio controls src={url} style={{ width: '100%' }} />
                                        </div>
                                    );
                                }
                                return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: colors.background, borderRadius: '4px', textDecoration: 'none', color: colors.textPrimary, marginRight: '8px', marginBottom: '8px', fontSize: '13px', border: `1px solid ${colors.border}` }}>
                                        <Paperclip size={14} /> {att.filename}
                                    </a>
                                );
                            })}
                            </div>
                        )}

                        <EmailBodyFrame html={mainBody} />
                        
                        {quotedBody && (
                                <div style={{ marginTop: '16px' }}>
                                    <button 
                                    onClick={() => setShowQuoted(!showQuoted)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', border: `1px solid ${colors.border}`, borderRadius: '4px', background: colors.background, cursor: 'pointer', color: colors.textSecondary }}
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>
                                    {showQuoted && (
                                        <div style={{ marginTop: '16px', borderLeft: `1px solid ${colors.border}`, paddingLeft: '8px' }}><EmailBodyFrame html={quotedBody} /></div>
                                    )}
                                </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // --- Renders ---

    const renderFolder = () => {
    return (
        <div style={{ display: 'flex', height: '100%', backgroundColor: colors.surface, position: 'relative' }}>
            
            {/* Sidebar / List */}
            <div style={{ 
                width: isMobile ? '100%' : '350px', 
                borderRight: `1px solid ${colors.border}`, 
                display: isMobile && selectedEmail ? 'none' : 'flex', 
                flexDirection: 'column', 
                backgroundColor: colors.surface 
            }}>
                {/* Compose Button Area */}
                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    
                    <button 
                        onClick={() => view === 'settings' ? fetchSettings() : fetchEmails(view)}
                        style={{ 
                            background: 'transparent', border: `1px solid ${colors.border}`,
                            borderRadius: '50%', width: '40px', height: '40px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: colors.textSecondary,
                            transition: 'color .2s'
                        }}
                        title="Refresh"
                    >
                        <RefreshCw size={20} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        <style>{`
                            @keyframes spin { 100% { transform: rotate(360deg); } }
                        `}</style>
                    </button>
                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>{emails.length} items</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                {emails.map(email => {
                    const isSelected = selectedEmail?.threadId === email.threadId;
                    return (
                    <div 
                        key={email.threadId}
                        onClick={() => handleSelectEmail(email)}
                        style={{
                            padding: '12px 16px',
                            borderBottom: `1px solid ${colors.border}`,
                            background: isSelected ? colors.background : 'transparent',
                            cursor: 'pointer',
                            borderLeft: isSelected ? `4px solid ${colors.primary}` : '4px solid transparent',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                            <span style={{ fontWeight: !email.read ? 700 : 500, color: colors.textPrimary, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                {view === 'sent' ? `To: ${email.toEmail || email.from}` : email.from}
                            </span>
                            <span style={{ fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                                {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                        <div style={{ fontWeight: !email.read ? 700 : 400, marginBottom: '2px', fontSize: '13px', color: colors.textPrimary }}>
                            {email.subject || '(No Subject)'}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '20px' }}>
                             {email.body.replace(/<[^>]*>?/gm, ' ').substring(0, 100)}
                        </div>
                    </div>
                )})}
                </div>
            </div>
            
            {/* Detail View (Thread) */}
            <div style={{ 
                flex: 1, 
                display: isMobile && !selectedEmail ? 'none' : 'flex', 
                flexDirection: 'column', 
                backgroundColor: colors.surface, 
                overflow: 'hidden' 
            }}>
                {selectedEmail ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: isMobile ? '12px' : '20px 24px', borderBottom: `1px solid ${colors.border}` }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start', marginBottom: '8px', gap: isMobile ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                                    {isMobile && (
                                        <button 
                                            onClick={() => setSelectedEmail(null)}
                                            style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: colors.textPrimary }}
                                        >
                                            <ArrowLeft size={24} />
                                        </button>
                                    )}
                                    <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: 400, color: colors.textPrimary, lineHeight: '1.2', wordBreak: 'break-word', flex: 1 }}>
                                        {selectedEmail.subject}
                                    </h2>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignSelf: isMobile ? 'flex-end' : 'auto' }}>
                                    <button onClick={() => handleDelete(selectedEmail)} title="Delete" style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: colors.textSecondary }}>
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                            {/* Tags or additional header info could go here */}
                        </div>
                        
                        {/* Scrollable Thread Container */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                             {currentThread.map((msg, idx) => (
                                 <ThreadMessage 
                                    key={msg.threadId} 
                                    msg={msg} 
                                    isLast={idx === currentThread.length - 1} 
                                    startReply={startReply}
                                 />
                             ))}

                             <style>{`
                                .email-content-reset a { color: ${colors.primary}; text-decoration: none; }
                                .email-content-reset img { max-width: 100%; height: auto; display: block; margin: 8px 0; }
                                .email-content-reset p { margin: 0 0 12px 0; }
                                .email-content-reset blockquote { margin-left: 0; padding-left: 12px; border-left: 1px solid ${colors.border}; color: ${colors.textSecondary}; }
                                .email-body-scroll::-webkit-scrollbar { width: 8px; }
                                .email-body-scroll::-webkit-scrollbar-thumb { background-color: ${colors.border}; borderRadius: 4px; }
                                .hover-bg:hover { background: ${colors.background} !important; }
                             `}</style>
                        </div>
                        
                        {/* Quick Reply Button (Always visible at bottom of thread) */}
                        <div style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}`, marginBottom: '40px' }}>
                            <button onClick={startReply} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 24px', borderRadius: '20px', border: `1px solid ${colors.border}`, background: colors.surface, color: colors.textSecondary, cursor: 'pointer', fontWeight: 500 }}>
                                <RefreshCw size={16} /> Reply
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textSecondary }}>
                        <Mail size={48} color={colors.textSecondary} />
                        <p style={{ marginTop: '16px' }}>Select an email to read</p>
                    </div>
                )}
            </div>

        </div>
    );
    };

    const settingsInputStyle: React.CSSProperties = {
        width: '100%', padding: '10px', background: colors.background,
        color: colors.textPrimary, border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.sm, fontSize: '14px', boxSizing: 'border-box'
    };

    const renderSettings = () => (
        <div style={{ maxWidth: '100%', height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginTop: 0, color: colors.textPrimary, fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Email Settings</h2>
            
            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '13px', fontWeight: 500 }}>Webhook Secret</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        style={{ ...settingsInputStyle, flex: 1 }}
                        value={settings.webhookSecret || ''}
                        onChange={e => setSettings({...settings, webhookSecret: e.target.value})}
                        placeholder="Paste whsec_ from Resend, or generate a simple secret"
                    />
                    <button onClick={() => setSettings({...settings, webhookSecret: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)})} style={{ background: colors.primary, color: colors.textPrimary, border: 'none', padding: '8px 12px', borderRadius: borderRadius.sm, cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}>Generate</button>
                </div>
                <p style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '6px' }}>
                    For Cloudflare Email Workers: generate a secret here and set the same value as <code>WEBHOOK_SECRET</code> in the Worker env vars.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '13px', fontWeight: 500 }}>Default From Name</label>
                    <input 
                        style={settingsInputStyle}
                        value={settings.fromName || ''}
                        onChange={e => setSettings({...settings, fromName: e.target.value})}
                    />
                </div>
                <div>
                     <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '13px', fontWeight: 500 }}>Default From Email</label>
                    <input 
                        style={settingsInputStyle}
                        value={settings.fromEmail || ''}
                        onChange={e => setSettings({...settings, fromEmail: e.target.value})}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '13px', fontWeight: 500 }}>Discord Channel ID (Alerts)</label>
                    <input 
                        style={settingsInputStyle}
                        value={settings.channelId || ''}
                        onChange={e => setSettings({...settings, channelId: e.target.value})}
                    />
                </div>
                <div>
                     <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary, fontSize: '13px', fontWeight: 500 }}>Notify Role ID</label>
                    <input 
                        style={settingsInputStyle}
                        value={settings.roleId || ''}
                        onChange={e => setSettings({...settings, roleId: e.target.value})}
                    />
                </div>
            </div>

            <button onClick={saveSettings} style={{ background: colors.primary, color: colors.textPrimary, padding: '10px 20px', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                Save Settings
            </button>
            </div>
        </div>
    );

    return (
        <>
        <div style={{ padding: isMobile ? '16px' : '24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
             {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', marginBottom: '16px', gap: isMobile ? '16px' : '0', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Mail size={32} color={colors.primary} />
                    <div>
                        <h1 style={{ margin: 0, color: colors.textPrimary }}>Email Client</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage emails directly from the dashboard.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', alignItems: isMobile ? 'stretch' : 'center', width: isMobile ? '100%' : 'auto' }}>
                     <button 
                        onClick={() => setComposing(true)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '8px 20px', borderRadius: '8px', border: 'none',
                            background: colors.primary, color: colors.textPrimary,
                            cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        <Plus size={18} /> New Email
                    </button>
                    <div style={{ display: 'flex', gap: '4px', background: colors.surface, padding: '4px', borderRadius: '8px', border: `1px solid ${colors.border}`, overflowX: isMobile ? 'auto' : 'visible' }}>
                        {(['inbox', 'sent', 'trash', 'settings'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => { setView(v); setSelectedEmail(null); }}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    background: view === v ? colors.primary : 'transparent',
                                    color: view === v ? colors.textPrimary : colors.textSecondary,
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    flex: isMobile ? 1 : 'none',
                                    justifyContent: 'center'
                                }}
                            >
                                {v === 'inbox' && <Mail size={14} />}
                                {v === 'sent' && <Send size={14} />}
                                {v === 'trash' && <Trash2 size={14} />}
                                {v === 'settings' && <Settings size={14} />}
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, borderLeft: `4px solid ${colors.primary}`, flexShrink: 0 }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>Send and receive emails from the dashboard. Configure webhook settings and notification preferences in the Settings tab.</p>
            </div>

            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                background: colors.surface, 
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden'
            }}>
                {/* Content */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {view === 'settings' ? renderSettings() : renderFolder()}
                </div>
            </div>
        </div>
        {/* Compose Modal - fixed position to avoid overflow clipping */}
        {composing && (
            <div style={{ 
                position: 'fixed', bottom: 0, right: isMobile ? 0 : '24px', 
                width: isMobile ? '100%' : '600px', height: isMobile ? '100%' : '600px', 
                background: colors.surface, borderRadius: isMobile ? 0 : '8px 8px 0 0', 
                boxShadow: '0 0 16px rgba(0,0,0,0.3)', 
                display: 'flex', flexDirection: 'column',
                zIndex: 1000, border: `1px solid ${colors.border}`,
                paddingBottom: '16px'
            }}>
                {/* Header */}
                <div style={{ background: colors.primary, color: colors.textPrimary, padding: '12px 20px', borderRadius: isMobile ? 0 : '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{composeData.subject || 'New Message'}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                       <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', color: colors.textPrimary, cursor: 'pointer' }}><X size={16} /></button>
                    </div>
                </div>
                
                {/* Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <input 
                        placeholder="To" 
                        value={composeData.to}
                        onChange={e => setComposeData({...composeData, to: e.target.value})}
                        style={{ padding: '12px 20px', border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', fontSize: '14px', background: 'transparent', color: colors.textPrimary }}
                    />
                    <input 
                        placeholder="Subject" 
                        value={composeData.subject}
                        onChange={e => setComposeData({...composeData, subject: e.target.value})}
                        style={{ padding: '12px 20px', border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', fontSize: '14px', background: 'transparent', color: colors.textPrimary }}
                    />
                    
                    {/* Attachments List */}
                    {composeData.attachments.length > 0 && (
                        <div style={{ padding: '4px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: colors.background }}>
                            {composeData.attachments.map((f, i) => (
                                <div key={i} style={{ background: colors.surface, border: `1px solid ${colors.border}`, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: colors.textPrimary }}>
                                    {f.name} <button onClick={() => removeAttachment(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: colors.textSecondary }}><X size={12}/></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Toolbar + Editor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ padding: '0 12px' }}>
                            <EditorToolbar />
                        </div>
                        <div 
                            contentEditable
                            onInput={e => setComposeData({...composeData, body: e.currentTarget.innerHTML})}
                            style={{ flex: 1, padding: '24px', outline: 'none', overflowY: 'auto', fontSize: '14px', fontFamily: 'Arial, sans-serif', color: colors.textPrimary, minHeight: '100px' }}
                            data-placeholder="Message body..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleSend}
                            style={{ 
                                background: colors.primary, color: colors.textPrimary, 
                                border: 'none', padding: '8px 24px', 
                                borderRadius: '18px', fontWeight: 600, 
                                cursor: 'pointer', fontSize: '14px' 
                            }}
                        >
                            Send
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '8px' }}
                            title="Attach files"
                            className='hover-bg'
                        >
                            <Paperclip size={20} />
                        </button>
                        <input 
                            type="file" 
                            multiple 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileSelect}
                        />
                    </div>
                    <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        )}
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
