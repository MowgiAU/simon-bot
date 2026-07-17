/**
 * Alt F — Contact Us / Support page.
 * Public form: name, email, optional Discord, message → POST /api/contact.
 * Prefills name/email when the visitor is logged in.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthProvider';
import { AltSidebar, BG, S_CONT, PRIMARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { LifeBuoy, Mail, User as UserIcon, MessageSquare, Send, CheckCircle2 } from 'lucide-react';

const FrontpageAltFContact: React.FC = () => {
    const { user, email: authEmail } = useAuth();
    const [name, setName] = useState<string>(user?.profileDisplayName || user?.profileUsername || user?.username || '');
    const [email, setEmail] = useState<string>(authEmail || '');
    const [discord, setDiscord] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setError('');
        if (!name.trim()) { setError('Please enter your name.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
        if (message.trim().length < 10) { setError('Please enter a message (at least 10 characters).'); return; }
        setSending(true);
        try {
            await axios.post('/api/contact', { name: name.trim(), email: email.trim(), discord: discord.trim() || undefined, message: message.trim() }, { withCredentials: true });
            setSent(true);
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to send your message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 };
    const field: React.CSSProperties = { width: '100%', padding: '11px 14px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', outline: 'none' };

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Support' }]} />
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '24px 32px 60px', boxSizing: 'border-box' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${PRIMARY}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <LifeBuoy size={26} color={PRIMARY} />
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Contact Us</h1>
                                <p style={{ margin: '4px 0 0', color: SUB, fontSize: 14 }}>Questions, feedback, or an issue? Send us a message and we’ll get back to you.</p>
                            </div>
                        </div>

                        <div style={{ maxWidth: 640, marginTop: 28 }}>
                            {sent ? (
                                <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
                                    <CheckCircle2 size={44} color={PRIMARY} style={{ marginBottom: 14 }} />
                                    <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Message sent</h2>
                                    <p style={{ margin: 0, color: SUB, fontSize: 14 }}>Thanks, {name.split(' ')[0] || 'there'} — we’ve received your message and will reply to <strong style={{ color: TEXT }}>{email}</strong> soon.</p>
                                </div>
                            ) : (
                                <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    <div>
                                        <div style={label}><UserIcon size={14} /> Your name</div>
                                        <input style={field} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Producer" />
                                    </div>
                                    <div>
                                        <div style={label}><Mail size={14} /> Email</div>
                                        <input style={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                                    </div>
                                    <div>
                                        <div style={label}><MessageSquare size={14} /> Discord <span style={{ color: `${SUB}99`, fontWeight: 400 }}>(optional)</span></div>
                                        <input style={field} value={discord} onChange={e => setDiscord(e.target.value)} placeholder="username or ID" />
                                    </div>
                                    <div>
                                        <div style={label}><MessageSquare size={14} /> Message</div>
                                        <textarea style={{ ...field, minHeight: 140, resize: 'vertical' as const }} value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help?" />
                                    </div>

                                    {error && <div style={{ color: '#ff6779', fontSize: 13, fontWeight: 600 }}>{error}</div>}

                                    <button onClick={submit} disabled={sending}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 800, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: FONT }}>
                                        <Send size={16} /> {sending ? 'Sending…' : 'Send message'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FrontpageAltFContact;
