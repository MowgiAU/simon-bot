import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { Mail, Send, Trash2, Settings, ArrowLeft, RefreshCw, Paperclip, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

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
    channelId?: string;
    roleId?: string;
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
    const [replyMode, setReplyMode] = useState(false);
    const [showQuoted, setShowQuoted] = useState(false);
    
    // Reply Form
    const [replyBody, setReplyBody] = useState('');
    const [fromIdentity, setFromIdentity] = useState(''); 

    // Processed body parts
    const { mainBody, quotedBody } = useProcessedBody(selectedEmail?.body);

    useEffect(() => {
        if (view === 'settings') {
            fetchSettings();
        } else {
            fetchEmails(view);
        }
    }, [view]);

    // Reset quoted view when selection changes
    useEffect(() => {
        setShowQuoted(false);
        setReplyMode(false);
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
            setFromIdentity(`${res.data.fromName || 'Simon Bot'} <${res.data.fromEmail || ''}>`);
        } catch (e) {
            console.error(e);
        }
    };

    const saveSettings = async () => {
        try {
            await axios.post('/api/email/settings', settings, { withCredentials: true });
            alert('Settings Saved');
        } catch (e) {
            alert('Error saving settings');
        }
    };

    const handleSelectEmail = async (email: Email) => {
        setSelectedEmail(email);
        setReplyMode(false);
        if (!email.read && email.category === 'inbox') {
            // Mark read
            try {
                await axios.patch(`/api/email/${email.threadId}`, { updates: { read: true } }, { withCredentials: true });
                // Update local
                setEmails(prev => prev.map(e => e.threadId === email.threadId ? { ...e, read: true } : e));
            } catch (e) {}
        }
    };

    const handleSend = async () => {
        if (!selectedEmail && !replyMode) return;
        
        try {
            const email = settings.fromEmail;
            
            await axios.post('/api/email/send', {
                to: selectedEmail ? selectedEmail.fromEmail : '', 
                subject: selectedEmail?.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail?.subject}`,
                body: replyBody,
                replyTo: email
            }, { withCredentials: true });
            
            alert('Sent!');
            setReplyMode(false);
            setReplyBody('');
        } catch (e) {
            alert('Failed to send');
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

    // --- Helpers ---

    function useProcessedBody(html?: string) {
        if (!html) return { mainBody: '', quotedBody: '' };
        
        // Simple heuristic for splitting quoted text
        // 1. Look for <div class="gmail_quote">
        const gmailQuoteIdx = html.indexOf('class="gmail_quote"');
        if (gmailQuoteIdx !== -1) {
            // Find the opening <div before it
            const splitPoint = html.lastIndexOf('<div', gmailQuoteIdx);
            if (splitPoint !== -1) {
                return {
                    mainBody: html.substring(0, splitPoint),
                    quotedBody: html.substring(splitPoint)
                };
            }
        }

        // 2. Look for "On ... wrote:" pattern specific to many clients if gmail_quote not found
        // This is harder in raw HTML without DOM parsing. 
        // We often see <blockquote> tags.
        const blockquoteIdx = html.indexOf('<blockquote');
        if (blockquoteIdx !== -1) {
             return {
                mainBody: html.substring(0, blockquoteIdx),
                quotedBody: html.substring(blockquoteIdx)
            };
        }

        return { mainBody: html, quotedBody: '' };
    }

    // --- Renders ---

    const renderFolder = () => (
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)', backgroundColor: '#fff' }}>
            {/* List - Light/Grey theme for list */}
            <div style={{ width: '350px', borderRight: `1px solid #e5e7eb`, overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                {emails.map(email => {
                    const isSelected = selectedEmail?.threadId === email.threadId;
                    return (
                    <div 
                        key={email.threadId}
                        onClick={() => handleSelectEmail(email)}
                        style={{
                            padding: '12px 16px',
                            borderBottom: `1px solid #e5e7eb`,
                            background: isSelected ? '#e8f0fe' : (email.read ? '#fff' : '#f0f4f8'),
                            cursor: 'pointer',
                            borderLeft: isSelected ? `4px solid ${colors.primary}` : (!email.read ? `4px solid ${colors.primary}` : '4px solid transparent'),
                            transition: 'background 0.2s',
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
                {emails.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#5f6368', fontSize: '14px' }}>
                        No emails in {view}
                    </div>
                )}
            </div>
            
            {/* Detail - Light Mode Reader */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' }}>
                {selectedEmail ? (
                    <>
                        {/* Email Header */}
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid #e5e7eb` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 400, color: '#202124', lineHeight: '1.2' }}>
                                    {selectedEmail.subject}
                                </h2>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        onClick={() => handleDelete(selectedEmail)} 
                                        title="Delete"
                                        style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: '#5f6368', borderRadius: '50%' }}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Avatar placeholder */}
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
                        
                        {/* Email Body */}
                        <div className="email-body-scroll" style={{ flex: 1, padding: '24px', overflowY: 'auto', color: '#222', fontSize: '14px', lineHeight: '1.5' }}>
                             {/* Attachments */}
                             {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                 <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                     {selectedEmail.attachments.map((att, i) => (
                                         <div key={i} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f5f5', fontSize: '13px' }}>
                                             <Paperclip size={14} />
                                             <span style={{ fontWeight: 500 }}>{att.filename}</span>
                                             {/* Download link logic would go here */}
                                         </div>
                                     ))}
                                 </div>
                             )}

                             {/* Main Content */}
                             <div 
                                className="email-content-reset"
                                dangerouslySetInnerHTML={{ __html: mainBody }} 
                                style={{ paddingBottom: '16px' }}
                             />
                             
                             {/* Quoted Content */}
                             {quotedBody && (
                                 <div style={{ marginTop: '16px' }}>
                                     <button 
                                        onClick={() => setShowQuoted(!showQuoted)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', border: '1px solid #dadce0', borderRadius: '4px', background: '#f1f3f4', cursor: 'pointer', color: '#5f6368' }}
                                        title={showQuoted ? "Hide trimmed content" : "Show trimmed content"}
                                     >
                                         <MoreHorizontal size={14} />
                                     </button>
                                     {showQuoted && (
                                         <div 
                                            className="email-content-reset gmail_quote_container"
                                            style={{ marginTop: '16px', borderLeft: '1px solid #ccc', paddingLeft: '8px', color: '#666' }}
                                            dangerouslySetInnerHTML={{ __html: quotedBody }} 
                                         />
                                     )}
                                 </div>
                             )}

                             {/* CSS Reset Injection for Email Content */}
                             <style>{`
                                .email-content-reset a { color: #1a73e8; text-decoration: none; }
                                .email-content-reset a:hover { text-decoration: underline; }
                                .email-content-reset img { max-width: 100%; height: auto; display: block; margin: 8px 0; }
                                .email-content-reset p { margin: 0 0 12px 0; }
                                .email-content-reset blockquote { margin-left: 0; padding-left: 12px; border-left: 1px solid #ccc; color: #666; }
                                .email-body-scroll::-webkit-scrollbar { width: 8px; }
                                .email-body-scroll::-webkit-scrollbar-track { background: transparent; }
                                .email-body-scroll::-webkit-scrollbar-thumb { background-color: #dadce0; borderRadius: 4px; }
                             `}</style>
                        </div>

                        {/* Reply Box */}
                        <div style={{ padding: '16px 24px 24px', borderTop: `1px solid #e5e7eb`, background: '#fff' }}>
                            {replyMode ? (
                                <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                    <div style={{ padding: '8px 12px', background: '#f1f3f4', borderBottom: '1px solid #dadce0', display: 'flex', gap: '4px', fontSize: '13px', color: '#5f6368' }}>
                                        <ArrowLeft size={14} /> <span>Replying to <strong>{selectedEmail.from}</strong></span>
                                    </div>
                                    <textarea 
                                        style={{ width: '100%', height: '150px', background: 'white', color: '#202124', padding: '12px', border: 'none', resize: 'none', outline: 'none', fontFamily: 'Arial, sans-serif' }}
                                        autoFocus
                                        value={replyBody}
                                        onChange={e => setReplyBody(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', alignItems: 'center', background: '#fff' }}>
                                         <button onClick={() => setReplyMode(false)} style={{ background: 'transparent', color: '#5f6368', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Cancel</button>
                                         <button onClick={handleSend} style={{ background: '#1a73e8', color: 'white', padding: '8px 24px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                             Send <Send size={14} /> 
                                         </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setReplyMode(true)} 
                                    style={{ 
                                        border: '1px solid #dadce0', 
                                        borderRadius: '24px', 
                                        background: '#fff', 
                                        color: '#5f6368', 
                                        padding: '10px 24px', 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px',
                                        fontSize: '14px',
                                        fontWeight: 500
                                    }}
                                >
                                    <RefreshCw size={16} /> Reply
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5f6368' }}>
                        <Mail size={48} color="#dadce0" />
                        <p style={{ marginTop: '16px', fontSize: '16px' }}>Select an email to read</p>
                    </div>
                )}
            </div>
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
