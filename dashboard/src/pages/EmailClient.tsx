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
    const [settings, setSettings] = useState<EmailSettings>({});
    const [loading, setLoading] = useState(false);
    
    // Compose / Reply State
    // If composing is true, we show the modal.
    const [composing, setComposing] = useState(false);
    const [composeData, setComposeData] = useState<{
        to: string;
        subject: string;
        body: string;
        attachments: File[];
        replyToMsg?: Email; // If set, this is a reply
    }>({ to: '', subject: '', body: '', attachments: [] });

    // Helper for Reply Mode in the reading pane (quick reply)
    // We will now redirect quick reply to the main Compose Modal for consistency/features,
    // OR keep the quick reply simple. User asked for "new email compose ability" with formatting.
    // Let's toggle the full composer even for replies to give them the features.

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Processed body parts for reading
    const { mainBody, quotedBody } = useProcessedBody(selectedEmail?.body);
    const [showQuoted, setShowQuoted] = useState(false);

    useEffect(() => {
        if (view === 'settings') {
            fetchSettings();
        } else {
            fetchEmails(view);
            // Poll for new emails every 30s
            const interval = setInterval(() => fetchEmails(view), 30000);
            return () => clearInterval(interval);
        }
    }, [view]);

    useEffect(() => {
        setShowQuoted(false);
    }, [selectedEmail]);

    const fetchEmails = async (category: string) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/email/list/${category}`, { withCredentials: true });
            setEmails(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/email/settings', { withCredentials: true });
            setSettings(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectEmail = async (email: Email) => {
        setSelectedEmail(email);
        if (!email.read && email.category === 'inbox') {
            try {
                await axios.patch(`/api/email/${email.threadId}`, { updates: { read: true } }, { withCredentials: true });
                setEmails(prev => prev.map(e => e.threadId === email.threadId ? { ...e, read: true } : e));
            } catch (e) {}
        }
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
            fetchEmails(view);
        } catch (e) {
            alert('Failed to send');
            console.error(e);
        }
    };

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

    // --- Renders ---

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)', backgroundColor: '#fff', position: 'relative' }}>
            
            {/* Sidebar / List */}
            <div style={{ width: '350px', borderRight: `1px solid #e5e7eb`, display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
                {/* Compose Button Area */}
                <div style={{ padding: '16px' }}>
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
                                {email.from}
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
            
            {/* Detail View */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' }}>
                {selectedEmail ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid #e5e7eb` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 400, color: '#202124', lineHeight: '1.2' }}>
                                    {selectedEmail.subject}
                                </h2>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleDelete(selectedEmail)} title="Delete" style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: '#5f6368' }}>
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600 }}>
                                    {selectedEmail.from.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#202124' }}>{selectedEmail.from}</span>
                                        <span style={{ fontSize: '12px', color: '#5f6368' }}>&lt;{selectedEmail.fromEmail}&gt;</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#5f6368' }}>
                                        to me <span style={{ margin: '0 4px' }}>•</span> {new Date(selectedEmail.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Body - Added Padding Bottom */}
                        <div className="email-body-scroll" style={{ flex: 1, padding: '24px', paddingBottom: '100px', overflowY: 'auto', color: '#222', fontSize: '14px', lineHeight: '1.5' }}>
                             {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                 <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                     {selectedEmail.attachments.map((att, i) => (
                                         <div key={i} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f5f5', fontSize: '13px' }}>
                                             <Paperclip size={14} />
                                             <span style={{ fontWeight: 500 }}>{att.filename}</span>
                                         </div>
                                     ))}
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
                        
                        {/* Quick Reply Button (if not composing) */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #eee' }}>
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
                    zIndex: 100, border: '1px solid #d3d3d3'
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
