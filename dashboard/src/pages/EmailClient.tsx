import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { Mail, Send, Trash2, Settings, ArrowLeft, RefreshCw, Paperclip } from 'lucide-react';

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
    
    // Reply Form
    const [replyBody, setReplyBody] = useState('');
    const [fromIdentity, setFromIdentity] = useState(''); // e.g. "Staff <staff@example.com>"

    useEffect(() => {
        if (view === 'settings') {
            fetchSettings();
        } else {
            fetchEmails(view);
        }
    }, [view]);

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
        if (!selectedEmail && !replyMode) return; // Only reply implemented for now
        
        try {
            // Parse Identity
            // Simplistic: "Name <email>" or just "email"
            let name = settings.fromName;
            let email = settings.fromEmail;
            
            // If user edited the identity string, try to parse it (Optional)
            
            await axios.post('/api/email/send', {
                to: selectedEmail ? selectedEmail.fromEmail : '', // Reply to sender
                subject: selectedEmail?.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail?.subject}`,
                body: replyBody,
                replyTo: email
            }, { withCredentials: true });
            
            alert('Sent!');
            setReplyMode(false);
            setReplyBody('');
            fetchEmails(view); // Refresh to show in Sent? Actually we are in Inbox/Trash usually.
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

    // --- Renders ---

    const renderFolder = () => (
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
            {/* List */}
            <div style={{ width: '350px', borderRight: `1px solid ${colors.border}`, overflowY: 'auto' }}>
                {emails.map(email => (
                    <div 
                        key={email.threadId}
                        onClick={() => handleSelectEmail(email)}
                        style={{
                            padding: '16px',
                            borderBottom: `1px solid ${colors.border}`,
                            background: selectedEmail?.threadId === email.threadId ? colors.surface : 'transparent',
                            cursor: 'pointer',
                            borderLeft: !email.read ? `3px solid ${colors.primary}` : '3px solid transparent'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: !email.read ? 700 : 400, color: 'white' }}>{email.from}</span>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{new Date(email.date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontWeight: !email.read ? 600 : 400, marginBottom: '4px', fontSize: '14px' }}>{email.subject}</div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             {email.body.replace(/<[^>]*>?/gm, '')}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Detail */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedEmail ? (
                    <>
                        <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <h2>{selectedEmail.subject}</h2>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleDelete(selectedEmail)} style={{ background: colors.error, border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', color: 'white' }}><Trash2 size={18} /></button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '14px' }}>
                                <span><strong>From:</strong> {selectedEmail.from} &lt;{selectedEmail.fromEmail}&gt;</span>
                                <span style={{ color: colors.textSecondary }}>{new Date(selectedEmail.date).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                             {/* Safe(ish) HTML Render */}
                             <div dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
                        </div>

                        {/* Reply Box */}
                        <div style={{ padding: '24px', borderTop: `1px solid ${colors.border}`, background: colors.surface }}>
                            {replyMode ? (
                                <div>
                                    <textarea 
                                        style={{ width: '100%', height: '150px', background: colors.background, color: 'white', padding: '12px', borderRadius: borderRadius.md, border: 'none', marginBottom: '12px' }}
                                        placeholder="Write your reply..."
                                        value={replyBody}
                                        onChange={e => setReplyBody(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                         <button onClick={() => setReplyMode(false)} style={{ background: 'transparent', color: colors.textSecondary, border: 'none', cursor: 'pointer' }}>Cancel</button>
                                         <button onClick={handleSend} style={{ background: colors.primary, color: 'white', padding: '8px 16px', borderRadius: borderRadius.md, border: 'none', cursor: 'pointer', display: 'flex', gap: '8px' }}>
                                             <Send size={16} /> Send
                                         </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setReplyMode(true)} style={{ background: colors.secondary, color: 'white', padding: '8px 16px', borderRadius: borderRadius.md, border: 'none', cursor: 'pointer' }}>
                                    Reply
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textSecondary }}>
                        Select an email to view
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
