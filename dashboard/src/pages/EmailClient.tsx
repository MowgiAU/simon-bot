import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { colors } from '../theme/theme';
import { 
    Mail, Send, Trash2, Settings, ArrowLeft, RefreshCw, Paperclip, 
    MoreHorizontal, X, Plus, Bold, Italic, Underline, List, Link as LinkIcon 
} from 'lucide-react';

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
}

export const EmailClientPage: React.FC = () => {
    const [view, setView] = useState<'inbox' | 'sent' | 'trash' | 'settings'>('inbox');
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [currentThread, setCurrentThread] = useState<Email[]>([]); // New Thread State
    const [settings, setSettings] = useState<EmailSettings>({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
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
        if (view === 'settings') {
            fetchSettings();
        } else {
            fetchEmails(view);
            const interval = setInterval(() => fetchEmails(view), 30000);
            return () => clearInterval(interval);
        }
    }, [view]);

    // When an email is selected, fetch its full thread
    useEffect(() => {
        if (selectedEmail) {
            fetchThread(selectedEmail.subject);
            // Mark read if needed
            if (!selectedEmail.read && selectedEmail.category === 'inbox') {
                axios.patch(`/api/email/${selectedEmail.threadId}`, { updates: { read: true } }, { withCredentials: true })
                    .then(() => setEmails(prev => prev.map(e => e.threadId === selectedEmail.threadId ? { ...e, read: true } : e)));
            }
        } else {
            setCurrentThread([]);
        }
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
            
            alert('Sent!');
            setComposing(false);
            setComposeData({ to: '', subject: '', body: '', attachments: [] });
            
            // Refresh logic:
            // If we are viewing a thread that matches the subject we just sent, refresh the thread
            if (selectedEmail && normalizeSubject(selectedEmail.subject) === normalizeSubject(composeData.subject)) {
                fetchThread(selectedEmail.subject);
            }
            fetchEmails(view);
        } catch (e) {
            alert('Failed to send');
            console.error(e);
        }
    };

    const normalizeSubject = (s: string) => s.replace(/^(Re|Fwd|FW):\s*/i, '').trim().toLowerCase();

    const handleDelete = async (email: Email) => {
        if (!confirm('Move to trash?')) return;
        try {
             await axios.patch(`/api/email/${email.threadId}`, { updates: { category: 'trash' } }, { withCredentials: true });
             fetchEmails(view);
             setSelectedEmail(null);
        } catch (e) {
            alert('Error');
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

    // --- Editor Component (Simple) ---
    const EditorToolbar = () => {
        const cmd = (c: string, v?: string) => {
            document.execCommand(c, false, v);
            // Focus callback handled by browser usually
        };
        return (
            <div style={{ display: 'flex', gap: '4px', padding: '8px', background: '#f0f2f5', borderBottom: '1px solid #ddd' }}>
                <ToolbarBtn onClick={() => cmd('bold')} icon={<Bold size={16}/>} />
                <ToolbarBtn onClick={() => cmd('italic')} icon={<Italic size={16}/>} />
                <ToolbarBtn onClick={() => cmd('underline')} icon={<Underline size={16}/>} />
                <div style={{ width: 1, background: '#ccc', margin: '0 4px' }} />
                <ToolbarBtn onClick={() => cmd('insertUnorderedList')} icon={<List size={16}/>} />
                {/* <ToolbarBtn onClick={() => {
                    const url = prompt('URL:');
                    if(url) cmd('createLink', url);
                }} icon={<LinkIcon size={16}/>} /> */}
            </div>
        );
    };

    const ToolbarBtn = ({ onClick, icon }: any) => (
        <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', borderRadius: '4px', color: '#444' }} className='hover-bg'>
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
            <div style={{ borderBottom: isLast ? 'none' : '1px solid #e5e7eb', background: '#fff' }}>
                {/* Header (Clickable for collapse) */}
                <div 
                    onClick={toggleCollapse}
                    style={{ 
                        padding: '16px 24px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px',
                        background: collapsed ? '#f4f6f8' : '#fff'
                    }}
                >
                     <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600 }}>
                        {msg.from.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                             <span style={{ fontWeight: 700, fontSize: '14px', color: '#202124' }}>{msg.from}</span>
                             <span style={{ fontSize: '12px', color: '#5f6368' }}>{new Date(msg.date).toLocaleString()}</span>
                         </div>
                         <div style={{ fontSize: '12px', color: '#5f6368' }}>to {msg.toEmail || 'me'}</div>
                         {collapsed && (
                             <div style={{ marginTop: '4px', color: '#5f6368', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 {mainBody.replace(/<[^>]*>?/gm, ' ').substring(0, 100)}...
                             </div>
                         )}
                    </div>
                </div>

                {/* Expanded Body */}
                {!collapsed && (
                    <div className="email-body-scroll" style={{ padding: '0 24px 24px', paddingLeft: '76px', fontSize: '14px', lineHeight: '1.5', color: '#222' }}>
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
                                            <img src={url} alt={att.filename} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #eee' }} />
                                        </div>
                                    );
                                }
                                if (['mp3', 'wav', 'ogg'].includes(ext)) {
                                    return (
                                        <div key={i} style={{ marginBottom: '16px', background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
                                            <div style={{fontSize: '12px', color: '#5f6368', marginBottom: '8px', fontWeight: 500 }}>{att.filename}</div>
                                            <audio controls src={url} style={{ width: '100%' }} />
                                        </div>
                                    );
                                }
                                return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '4px', textDecoration: 'none', color: '#333', marginRight: '8px', marginBottom: '8px', fontSize: '13px', border: '1px solid #ddd' }}>
                                        <Paperclip size={14} /> {att.filename}
                                    </a>
                                );
                            })}
                            </div>
                        )}

                        <div className="email-content-reset" dangerouslySetInnerHTML={{ __html: mainBody }} />
                        
                        {quotedBody && (
                                <div style={{ marginTop: '16px' }}>
                                    <button 
                                    onClick={() => setShowQuoted(!showQuoted)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', border: '1px solid #dadce0', borderRadius: '4px', background: '#f1f3f4', cursor: 'pointer', color: '#5f6368' }}
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>
                                    {showQuoted && (
                                        <div className="email-content-reset gmail_quote_container" style={{ marginTop: '16px', borderLeft: '1px solid #ccc', paddingLeft: '8px', color: '#666' }} dangerouslySetInnerHTML={{ __html: quotedBody }} />
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
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)', backgroundColor: '#fff', position: 'relative' }}>
            
            {/* Sidebar / List */}
            <div style={{ width: '350px', borderRight: `1px solid #e5e7eb`, display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
                {/* Compose Button Area */}
                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button 
                        onClick={startCompose}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: '12px', 
                            background: '#c2e7ff', color: '#001d35', 
                            border: 'none', padding: '16px 24px', 
                            borderRadius: '16px', fontSize: '16px', fontWeight: 600, 
                            cursor: 'pointer', width: 'fit-content',
                            transition: 'box-shadow .2s'
                        }}
                    >
                        <Plus size={24} /> Compose
                    </button>
                    
                    <button 
                        onClick={() => view === 'settings' ? fetchSettings() : fetchEmails(view)}
                        style={{ 
                            background: 'transparent', border: '1px solid #e5e7eb',
                            borderRadius: '50%', width: '40px', height: '40px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#5f6368',
                            transition: 'color .2s'
                        }}
                        title="Refresh"
                    >
                        <RefreshCw size={20} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        <style>{`
                            @keyframes spin { 100% { transform: rotate(360deg); } }
                        `}</style>
                    </button>
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
                            borderBottom: `1px solid #e5e7eb`,
                            background: isSelected ? '#e8f0fe' : (email.read ? 'transparent' : '#fff'),
                            cursor: 'pointer',
                            borderLeft: isSelected ? `4px solid ${colors.primary}` : (!email.read ? `4px solid ${colors.primary}` : '4px solid transparent'),
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                            <span style={{ fontWeight: !email.read ? 700 : 500, color: '#202124', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                {view === 'sent' ? `To: ${email.toEmail || email.from}` : email.from}
                            </span>
                            <span style={{ fontSize: '11px', color: '#5f6368', whiteSpace: 'nowrap' }}>
                                {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                        <div style={{ fontWeight: !email.read ? 700 : 400, marginBottom: '2px', fontSize: '13px', color: '#202124' }}>
                            {email.subject || '(No Subject)'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#5f6368', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '20px' }}>
                             {email.body.replace(/<[^>]*>?/gm, ' ').substring(0, 100)}
                        </div>
                    </div>
                )})}
                </div>
            </div>
            
            {/* Detail View (Thread) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' }}>
                {selectedEmail ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid #e5e7eb` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 400, color: '#202124', lineHeight: '1.2' }}>
                                    {selectedEmail.subject}
                                </h2>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleDelete(selectedEmail)} title="Delete" style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: '#5f6368' }}>
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
                                .email-content-reset a { color: #1a73e8; text-decoration: none; }
                                .email-content-reset img { max-width: 100%; height: auto; display: block; margin: 8px 0; }
                                .email-content-reset p { margin: 0 0 12px 0; }
                                .email-content-reset blockquote { margin-left: 0; padding-left: 12px; border-left: 1px solid #ccc; color: #666; }
                                .email-body-scroll::-webkit-scrollbar { width: 8px; }
                                .email-body-scroll::-webkit-scrollbar-thumb { background-color: #dadce0; borderRadius: 4px; }
                                .hover-bg:hover { background: #e0e0e0 !important; }
                             `}</style>
                        </div>
                        
                        {/* Quick Reply Button (Always visible at bottom of thread) */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', marginBottom: '40px' }}>
                            <button onClick={startReply} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 24px', borderRadius: '20px', border: '1px solid #dadce0', background: '#fff', color: '#5f6368', cursor: 'pointer', fontWeight: 500 }}>
                                <RefreshCw size={16} /> Reply
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5f6368' }}>
                        <Mail size={48} color="#dadce0" />
                        <p style={{ marginTop: '16px' }}>Select an email to read</p>
                    </div>
                )}
            </div>

            {/* Compose Modal */}
            {composing && (
                <div style={{ 
                    position: 'absolute', bottom: 0, right: '24px', 
                    width: '600px', height: '600px', 
                    background: '#fff', borderRadius: '8px 8px 0 0', 
                    boxShadow: '0 0 16px rgba(0,0,0,0.15)', 
                    display: 'flex', flexDirection: 'column',
                    zIndex: 100, border: '1px solid #d3d3d3',
                    paddingBottom: '16px' // Added padding for the footer area
                }}>
                    {/* Header */}
                    <div style={{ background: '#404040', color: '#fff', padding: '12px 20px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px' }}>{composeData.subject || 'New Message'}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                    </div>
                    
                    {/* Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <input 
                            placeholder="To" 
                            value={composeData.to}
                            onChange={e => setComposeData({...composeData, to: e.target.value})}
                            style={{ padding: '12px 20px', border: 'none', borderBottom: '1px solid #eee', outline: 'none', fontSize: '14px' }}
                        />
                        <input 
                            placeholder="Subject" 
                            value={composeData.subject}
                            onChange={e => setComposeData({...composeData, subject: e.target.value})}
                            style={{ padding: '12px 20px', border: 'none', borderBottom: '1px solid #eee', outline: 'none', fontSize: '14px' }}
                        />
                        
                        {/* Attachments List */}
                        {composeData.attachments.length > 0 && (
                            <div style={{ padding: '4px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: '#f8f9fa' }}>
                                {composeData.attachments.map((f, i) => (
                                    <div key={i} style={{ background: '#fff', border: '1px solid #ddd', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {f.name} <button onClick={() => removeAttachment(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={12}/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Toolbar + Editor */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '0 12px' }}>
                                <EditorToolbar />
                            </div>
                            <div 
                                contentEditable
                                onInput={e => setComposeData({...composeData, body: e.currentTarget.innerHTML})}
                                style={{ flex: 1, padding: '24px', outline: 'none', overflowY: 'auto', fontSize: '14px', fontFamily: 'Arial, sans-serif' }}
                                data-placeholder="Message body..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={handleSend}
                                style={{ 
                                    background: '#0b57d0', color: '#fff', 
                                    border: 'none', padding: '8px 24px', 
                                    borderRadius: '18px', fontWeight: 600, 
                                    cursor: 'pointer', fontSize: '14px' 
                                }}
                            >
                                Send
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', padding: '8px' }}
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
                        <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368' }}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
    };

    const renderSettings = () => (
        <div style={{ maxWidth: '600px', margin: '24px' }}>
            <h2>Settings</h2>
            
            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Webhook Secret (x-auth-token)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        style={{ flex: 1, padding: '8px', background: colors.background, color: 'white', border: `1px solid ${colors.border}` }}
                        value={settings.webhookSecret || ''}
                        onChange={e => setSettings({...settings, webhookSecret: e.target.value})}
                    />
                    <button onClick={() => setSettings({...settings, webhookSecret: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)})} style={{ background: colors.secondary, color: 'white', border: 'none', padding: '8px' }}>Gen</button>
                </div>
                <p style={{ fontSize: '12px', color: colors.textSecondary }}>
                    Webhook URL: {window.location.origin.replace('3000', '3001')}/api/email/webhook
                </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Resend API Key</label>
                <input 
                    style={{ width: '100%', padding: '8px', background: colors.background, color: 'white', border: `1px solid ${colors.border}` }}
                    value={settings.resendApiKey || ''}
                    onChange={e => setSettings({...settings, resendApiKey: e.target.value})}
                    placeholder="re_1234..."
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Default From Name</label>
                    <input 
                        style={{ width: '100%', padding: '8px', background: colors.background, color: 'white', border: `1px solid ${colors.border}` }}
                        value={settings.fromName || ''}
                        onChange={e => setSettings({...settings, fromName: e.target.value})}
                    />
                </div>
                <div>
                     <label style={{ display: 'block', marginBottom: '8px' }}>Default From Email</label>
                    <input 
                        style={{ width: '100%', padding: '8px', background: colors.background, color: 'white', border: `1px solid ${colors.border}` }}
                        value={settings.fromEmail || ''}
                        onChange={e => setSettings({...settings, fromEmail: e.target.value})}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Discord Channel ID (Alerts)</label>
                    <input 
                        style={{ width: '100%', padding: '8px', background: colors.background, color: 'white', border: `1px solid ${colors.border}` }}
                        value={settings.channelId || ''}
                        onChange={e => setSettings({...settings, channelId: e.target.value})}
                    />
                </div>
                <div>
                     <label style={{ display: 'block', marginBottom: '8px' }}>Notify Role ID</label>
                    <input 
                        style={{ width: '100%', padding: '8px', background: colors.background, color: 'white', border: `1px solid ${colors.border}` }}
                        value={settings.roleId || ''}
                        onChange={e => setSettings({...settings, roleId: e.target.value})}
                    />
                </div>
            </div>

            <button onClick={saveSettings} style={{ background: colors.primary, color: 'white', padding: '10px 20px', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer' }}>
                Save Settings
            </button>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, gap: '24px' }}>
                <h2 style={{ margin: 0 }}>Email Client</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setView('inbox')} style={{ opacity: view === 'inbox' ? 1 : 0.6, background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', gap: '6px' }}><Mail size={18}/> Inbox</button>
                    <button onClick={() => setView('sent')} style={{ opacity: view === 'sent' ? 1 : 0.6, background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', gap: '6px' }}><Send size={18}/> Sent</button>
                    <button onClick={() => setView('trash')} style={{ opacity: view === 'trash' ? 1 : 0.6, background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', gap: '6px' }}><Trash2 size={18}/> Trash</button>
                    <button onClick={() => setView('settings')} style={{ opacity: view === 'settings' ? 1 : 0.6, background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', gap: '6px' }}><Settings size={18}/> Settings</button>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {view === 'settings' ? renderSettings() : renderFolder()}
            </div>
        </div>
    );
};
