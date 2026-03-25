import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCog, Mail, Lock, CheckCircle, XCircle, Send, Eye, EyeOff, Shield, Smartphone, Link2, Unlink, Copy, AlertTriangle, User as UserIcon, AtSign, KeyRound, ScanLine } from 'lucide-react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';

type Tab = 'account' | 'security' | 'connections';

// â”€â”€â”€ Shared element styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    color: colors.textPrimary, fontSize: '14px',
    outline: 'none',
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {children}
    </label>
);

const StatusMsg: React.FC<{ type: 'success' | 'error' | 'warn'; text: string }> = ({ type, text }) => {
    const c = type === 'success' ? colors.success : type === 'error' ? colors.error : colors.warning;
    const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertTriangle;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: `${c}16`, border: `1px solid ${c}35`, borderRadius: borderRadius.md, fontSize: '13px', color: c, marginTop: '12px' }}>
            <Icon size={14} style={{ flexShrink: 0 }} /> {text}
        </div>
    );
};

const PwInput: React.FC<{ value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string; required?: boolean; }> = ({ value, onChange, show, onToggle, placeholder, required }) => (
    <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
            style={{ ...inp, paddingRight: '44px' }} />
        <button type="button" onClick={onToggle} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: 0 }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
    </div>
);

export const AccountSettingsPage: React.FC = () => {
    const { user, email, emailVerified, hasPassword, totpEnabled, refreshAccountStatus } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<Tab>('account');

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setpwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    // Email verification state
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyMsg, setVerifyMsg] = useState('');
    const [verifyError, setVerifyError] = useState('');

    // 2FA state
    const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'verify' | 'backup'>('idle');
    const [twoFASecret, setTwoFASecret] = useState('');
    const [twoFAQR, setTwoFAQR] = useState('');
    const [twoFACode, setTwoFACode] = useState('');
    const [twoFABackupCodes, setTwoFABackupCodes] = useState<string[]>([]);
    const [twoFALoading, setTwoFALoading] = useState(false);
    const [twoFAError, setTwoFAError] = useState('');
    const [disablePassword, setDisablePassword] = useState('');
    const [showDisable, setShowDisable] = useState(false);

    // Username change state
    const [newUsername, setNewUsername] = useState('');
    const [usernamePassword, setUsernamePassword] = useState('');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameSuccess, setUsernameSuccess] = useState('');

    // Email change state
    const [newEmail, setNewEmail] = useState('');
    const [emailChangePassword, setEmailChangePassword] = useState('');
    const [emailChangeLoading, setEmailChangeLoading] = useState(false);
    const [emailChangeError, setEmailChangeError] = useState('');
    const [emailChangeSuccess, setEmailChangeSuccess] = useState('');
    const [pendingEmailChange, setPendingEmailChange] = useState('');

    // Confirm email change token handling
    const [confirmEmailMsg, setConfirmEmailMsg] = useState('');
    const [confirmEmailError, setConfirmEmailError] = useState('');

    // Discord linking state
    const [discordLinked, setDiscordLinked] = useState(false);
    const [discordId, setDiscordId] = useState<string | null>(null);
    const [accountUsername, setAccountUsername] = useState('');
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkMsg, setLinkMsg] = useState('');
    const [linkError, setLinkError] = useState('');
    const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);

    // Load account details
    useEffect(() => {
        fetch('/api/auth/account', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (data.hasAccount) {
                    setDiscordLinked(!!data.discordLinked);
                    setDiscordId(data.discordId || null);
                    setAccountUsername(data.username || '');
                    setBackupCodesRemaining(data.backupCodesRemaining || 0);
                    setPendingEmailChange(data.pendingEmail || '');
                }
            })
            .catch(() => {});
    }, []);

    // Handle URL params
    useEffect(() => {
        const v = searchParams.get('verified');
        if (v === 'true') { setVerifyMsg('Your email has been verified successfully!'); refreshAccountStatus(); }
        else if (v === 'false') { setVerifyError('Verification link is invalid or expired. Please request a new one.'); }

        const linked = searchParams.get('linked');
        if (linked === 'true') { setLinkMsg('Discord account linked successfully!'); setDiscordLinked(true); refreshAccountStatus(); }

        const linkErr = searchParams.get('linkError');
        if (linkErr === 'already_linked') setLinkError('That Discord account is already linked to another user.');
        else if (linkErr === 'invalid_token') setLinkError('Link session expired. Please try again.');
        else if (linkErr === 'failed') setLinkError('Failed to link Discord account. Please try again.');

        const confirmEmailToken = searchParams.get('confirmEmailToken');
        if (confirmEmailToken) {
            fetch('/api/auth/confirm-email-change', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: confirmEmailToken }),
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        setConfirmEmailMsg('Your email address has been updated successfully!');
                        setPendingEmailChange('');
                        refreshAccountStatus();
                    } else {
                        setConfirmEmailError(data.error || 'Email confirmation failed. The link may be expired.');
                    }
                })
                .catch(() => setConfirmEmailError('Request failed. Please try again.'));
        }
    }, []);

    const handleChangeUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameError(''); setUsernameSuccess('');
        setUsernameLoading(true);
        try {
            const res = await fetch('/api/auth/change-username', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newUsername, currentPassword: usernamePassword }),
            });
            const data = await res.json();
            if (!res.ok) { setUsernameError(data.error || 'Failed'); return; }
            setUsernameSuccess(`Username changed to ${data.username}.`);
            setAccountUsername(data.username);
            setNewUsername(''); setUsernamePassword('');
            refreshAccountStatus();
        } catch { setUsernameError('Request failed'); }
        finally { setUsernameLoading(false); }
    };

    const handleChangeEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailChangeError(''); setEmailChangeSuccess('');
        setEmailChangeLoading(true);
        try {
            const res = await fetch('/api/auth/change-email', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newEmail, currentPassword: emailChangePassword }),
            });
            const data = await res.json();
            if (!res.ok) { setEmailChangeError(data.error || 'Failed'); return; }
            setEmailChangeSuccess(`Confirmation email sent to ${newEmail}. Click the link in that email to complete the change.`);
            setPendingEmailChange(newEmail);
            setNewEmail(''); setEmailChangePassword('');
        } catch { setEmailChangeError('Request failed'); }
        finally { setEmailChangeLoading(false); }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setpwError(''); setPwSuccess('');
        if (newPassword !== confirmPassword) { setpwError('Passwords do not match'); return; }
        if (newPassword.length < 8) { setpwError('Password must be at least 8 characters'); return; }
        setPwLoading(true);
        try {
            const body: any = { newPassword };
            if (hasPassword) body.currentPassword = currentPassword;
            const res = await fetch('/api/auth/change-password', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setpwError(data.error || 'Failed'); return; }
            setPwSuccess(hasPassword ? 'Password changed successfully.' : 'Password set! You can now log in with email + password.');
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            refreshAccountStatus();
        } catch { setpwError('Request failed'); }
        finally { setPwLoading(false); }
    };

    const handleSendVerification = async () => {
        setVerifyMsg(''); setVerifyError(''); setVerifyLoading(true);
        try {
            const res = await fetch('/api/auth/send-verification', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) { setVerifyError(data.error || 'Failed'); return; }
            setVerifyMsg(`Verification email sent to ${email}. Check your inbox (and spam folder).`);
        } catch { setVerifyError('Request failed'); }
        finally { setVerifyLoading(false); }
    };

    // 2FA Setup
    const handleSetup2FA = async () => {
        setTwoFAError(''); setTwoFALoading(true);
        try {
            const res = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) { setTwoFAError(data.error || 'Failed'); setTwoFALoading(false); return; }
            setTwoFASecret(data.secret);
            setTwoFAQR(data.qrCode);
            setTwoFAStep('setup');
        } catch { setTwoFAError('Request failed'); }
        finally { setTwoFALoading(false); }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setTwoFAError(''); setTwoFALoading(true);
        try {
            const res = await fetch('/api/auth/2fa/verify', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: twoFACode }),
            });
            const data = await res.json();
            if (!res.ok) { setTwoFAError(data.error || 'Invalid code'); setTwoFALoading(false); return; }
            setTwoFABackupCodes(data.backupCodes);
            setTwoFAStep('backup');
            refreshAccountStatus();
        } catch { setTwoFAError('Request failed'); }
        finally { setTwoFALoading(false); }
    };

    const handleDisable2FA = async () => {
        setTwoFAError(''); setTwoFALoading(true);
        try {
            const res = await fetch('/api/auth/2fa/disable', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: disablePassword }),
            });
            const data = await res.json();
            if (!res.ok) { setTwoFAError(data.error || 'Failed'); setTwoFALoading(false); return; }
            setShowDisable(false); setDisablePassword('');
            setTwoFAStep('idle');
            refreshAccountStatus();
        } catch { setTwoFAError('Request failed'); }
        finally { setTwoFALoading(false); }
    };

    // Discord linking
    const handleLinkDiscord = () => {
        setLinkLoading(true);
        window.location.href = '/api/auth/discord/link';
    };

    const handleUnlinkDiscord = async () => {
        setLinkError(''); setLinkMsg(''); setLinkLoading(true);
        try {
            const res = await fetch('/api/auth/discord/unlink', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) { setLinkError(data.error || 'Failed'); return; }
            setDiscordLinked(false); setDiscordId(null);
            setLinkMsg('Discord account unlinked.');
            refreshAccountStatus();
        } catch { setLinkError('Request failed'); }
        finally { setLinkLoading(false); }
    };

    const copyBackupCodes = () => {
        navigator.clipboard.writeText(twoFABackupCodes.join('\n'));
    };

    if (!user) {
        return (
            <div style={{ minHeight: '100vh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: shadows.glow }}>
                        <UserIcon size={32} color="#fff" />
                    </div>
                    <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>Sign in required</h2>
                    <p style={{ margin: '0 0 24px', color: colors.textSecondary, fontSize: '14px' }}>Please log in to manage your account.</p>
                    <button onClick={() => navigate('/login')} style={{ padding: '11px 28px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: shadows.glow }}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    const card: React.CSSProperties = {
        background: colors.surface,
        borderRadius: borderRadius.xl,
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '28px',
    };

    const sectionDivider: React.CSSProperties = {
        borderTop: '1px solid rgba(255,255,255,0.06)',
        margin: '24px 0',
    };

    // Determine tab from URL hash if present
    const tabs = [
        { id: 'account' as Tab, label: 'Account', icon: <UserIcon size={16} />, dot: !emailVerified ? 'warn' : null },
        { id: 'security' as Tab, label: 'Security', icon: <Shield size={16} />, dot: !totpEnabled ? null : 'ok' },
        { id: 'connections' as Tab, label: 'Connections', icon: <Link2 size={16} />, dot: discordLinked ? 'ok' : null },
    ];

    const tabBtn = (t: typeof tabs[0]): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 20px',
        background: activeTab === t.id ? `${colors.primary}18` : 'transparent',
        border: 'none',
        borderBottom: `2px solid ${activeTab === t.id ? colors.primary : 'transparent'}`,
        borderRadius: '0',
        color: activeTab === t.id ? colors.primary : colors.textSecondary,
        fontWeight: activeTab === t.id ? 700 : 500,
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative' as const,
        whiteSpace: 'nowrap' as const,
    });

    const primaryBtn = (loading?: boolean, disabled?: boolean): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: '11px 20px',
        background: (loading || disabled) ? colors.surfaceLight : `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
        color: (loading || disabled) ? colors.textTertiary : '#fff',
        border: 'none', borderRadius: borderRadius.md,
        fontWeight: 700, fontSize: '14px',
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        boxShadow: (loading || disabled) ? 'none' : shadows.glow,
        transition: 'all 0.15s',
    });

    const ghostBtn = (destructive?: boolean): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 16px',
        background: 'transparent',
        color: destructive ? colors.error : colors.textSecondary,
        border: `1px solid ${destructive ? `${colors.error}50` : 'rgba(255,255,255,0.1)'}`,
        borderRadius: borderRadius.md,
        fontWeight: 600, fontSize: '13px', cursor: 'pointer',
    });

    return (
        <DiscoveryLayout activeTab="account">
            <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px' }}>

                {/* ── HERO HEADER ── */}
                <div style={{
                    background: `linear-gradient(135deg, ${colors.surface} 0%, rgba(16,185,129,0.07) 100%)`,
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: borderRadius.xl,
                    padding: '28px 32px',
                    marginBottom: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Ambient glow orb */}
                    <div style={{
                        position: 'absolute', top: '-60px', right: '-60px',
                        width: '240px', height: '240px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', position: 'relative' }}>
                        {/* Avatar circle with initial */}
                        <div style={{
                            width: '68px', height: '68px', borderRadius: '50%',
                            background: `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '26px', fontWeight: 800, color: '#fff', flexShrink: 0,
                            boxShadow: shadows.glowStrong,
                        }}>
                            {accountUsername ? accountUsername[0].toUpperCase() : <UserIcon size={28} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: colors.textPrimary }}>
                                {accountUsername || 'Your Account'}
                            </h1>
                            {email && (
                                <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>{email}</p>
                            )}
                        </div>

                        {/* Status pill badges */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '5px 11px', borderRadius: borderRadius.pill,
                                background: emailVerified ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                border: `1px solid ${emailVerified ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                fontSize: '12px', fontWeight: 600,
                                color: emailVerified ? colors.success : colors.warning,
                            }}>
                                {emailVerified ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                                {emailVerified ? 'Email verified' : 'Unverified'}
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '5px 11px', borderRadius: borderRadius.pill,
                                background: totpEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                                border: `1px solid ${totpEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.25)'}`,
                                fontSize: '12px', fontWeight: 600,
                                color: totpEnabled ? colors.success : colors.textTertiary,
                            }}>
                                <Shield size={13} /> {totpEnabled ? '2FA active' : '2FA off'}
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '5px 11px', borderRadius: borderRadius.pill,
                                background: discordLinked ? 'rgba(88,101,242,0.15)' : 'rgba(100,116,139,0.12)',
                                border: `1px solid ${discordLinked ? 'rgba(88,101,242,0.4)' : 'rgba(100,116,139,0.25)'}`,
                                fontSize: '12px', fontWeight: 600,
                                color: discordLinked ? '#7289DA' : colors.textTertiary,
                            }}>
                                <Link2 size={13} /> {discordLinked ? 'Discord linked' : 'No Discord'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── URL-param banners ── */}
                {confirmEmailMsg && <StatusMsg type="success" text={confirmEmailMsg} />}
                {confirmEmailError && <StatusMsg type="error" text={confirmEmailError} />}
                {(confirmEmailMsg || confirmEmailError) && <div style={{ height: '16px' }} />}

                {/* ── TAB NAV ── */}
                <div style={{
                    display: 'flex',
                    background: colors.surface,
                    borderRadius: borderRadius.xl,
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '20px',
                    overflow: 'hidden',
                }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={tabBtn(t)}>
                            {t.icon}
                            {t.label}
                            {t.dot === 'warn' && (
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.warning, display: 'inline-block', marginLeft: '2px', boxShadow: `0 0 6px ${colors.warning}` }} />
                            )}
                            {t.dot === 'ok' && (
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.success, display: 'inline-block', marginLeft: '2px', boxShadow: `0 0 6px ${colors.success}` }} />
                            )}
                        </button>
                    ))}
                </div>

                {/* ═══════════════════ ACCOUNT TAB ═══════════════════ */}
                {activeTab === 'account' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* ── Username ── */}
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: borderRadius.md, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserIcon size={17} color={colors.primary} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>Username</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary }}>Your @handle on Fuji Studio</p>
                                </div>
                            </div>

                            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '13px', color: colors.textTertiary }}>Current username</span>
                                <span style={{ flex: 1 }} />
                                <code style={{ fontSize: '14px', fontWeight: 700, color: colors.primary, letterSpacing: '0.01em' }}>@{accountUsername || '—'}</code>
                            </div>

                            <form onSubmit={handleChangeUsername} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <FieldLabel>New Username</FieldLabel>
                                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required
                                        placeholder="3–30 chars · letters, numbers, - or _"
                                        style={inp} />
                                </div>
                                <div>
                                    <FieldLabel>Confirm with password</FieldLabel>
                                    <PwInput value={usernamePassword} onChange={setUsernamePassword} show={false} onToggle={() => {}} required placeholder="Your current password" />
                                </div>
                                {usernameError && <StatusMsg type="error" text={usernameError} />}
                                {usernameSuccess && <StatusMsg type="success" text={usernameSuccess} />}
                                <button type="submit" disabled={usernameLoading} style={primaryBtn(usernameLoading)}>
                                    {usernameLoading ? 'Saving…' : 'Change Username'}
                                </button>
                            </form>
                        </div>

                        {/* ── Email ── */}
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: borderRadius.md, background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Mail size={17} color={colors.accent} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>Email Address</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary }}>Verification and account recovery</p>
                                </div>
                            </div>

                            {email ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, marginBottom: '16px' }}>
                                        <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: colors.textPrimary }}>{email}</span>
                                        {emailVerified ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: colors.success }}>
                                                <CheckCircle size={14} /> Verified
                                            </span>
                                        ) : (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: colors.warning }}>
                                                <AlertTriangle size={14} /> Not verified
                                            </span>
                                        )}
                                    </div>

                                    {!emailVerified && (
                                        <div>
                                            <button onClick={handleSendVerification} disabled={verifyLoading}
                                                style={{ ...primaryBtn(verifyLoading), marginBottom: '0' }}>
                                                <Send size={14} /> {verifyLoading ? 'Sending...' : 'Send Verification Email'}
                                            </button>
                                            {verifyError && <StatusMsg type="error" text={verifyError} />}
                                            {verifyMsg && <StatusMsg type="success" text={verifyMsg} />}
                                        </div>
                                    )}
                                    {emailVerified && verifyMsg && <StatusMsg type="success" text={verifyMsg} />}

                                    <div style={sectionDivider} />

                                    <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Change Email
                                    </h3>

                                    {pendingEmailChange && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: borderRadius.md, marginBottom: '14px', fontSize: '13px', color: colors.warning, lineHeight: 1.5 }}>
                                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                            Pending change to <strong>{pendingEmailChange}</strong> — check that inbox for the confirmation link.
                                        </div>
                                    )}

                                    <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div>
                                            <FieldLabel>New email address</FieldLabel>
                                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="new@example.com" style={inp} />
                                        </div>
                                        <div>
                                            <FieldLabel>Confirm with password</FieldLabel>
                                            <input type="password" value={emailChangePassword} onChange={e => setEmailChangePassword(e.target.value)} required placeholder="Your current password" style={inp} />
                                        </div>
                                        {emailChangeError && <StatusMsg type="error" text={emailChangeError} />}
                                        {emailChangeSuccess && <StatusMsg type="success" text={emailChangeSuccess} />}
                                        <button type="submit" disabled={emailChangeLoading} style={primaryBtn(emailChangeLoading)}>
                                            <Send size={14} /> {emailChangeLoading ? 'Sending…' : 'Send Confirmation Email'}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.md, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                                    No email on file. If you signed in via Discord, make sure your Discord account has a verified email and{' '}
                                    <strong style={{ color: colors.textPrimary }}>log out and back in</strong> to pull it through.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════════════ SECURITY TAB ═══════════════════ */}
                {activeTab === 'security' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* ── Password ── */}
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: borderRadius.md, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <KeyRound size={17} color={colors.highlight} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>
                                        {hasPassword ? 'Change Password' : 'Set a Password'}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary }}>
                                        {hasPassword ? 'Update your login password' : 'Enable email + password login'}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {hasPassword && (
                                    <div>
                                        <FieldLabel>Current password</FieldLabel>
                                        <PwInput value={currentPassword} onChange={setCurrentPassword} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} required />
                                    </div>
                                )}
                                <div>
                                    <FieldLabel>New password</FieldLabel>
                                    <PwInput value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(v => !v)} required placeholder="At least 8 characters" />
                                </div>
                                <div>
                                    <FieldLabel>Confirm new password</FieldLabel>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={inp} />
                                </div>
                                {pwError && <StatusMsg type="error" text={pwError} />}
                                {pwSuccess && <StatusMsg type="success" text={pwSuccess} />}
                                <button type="submit" disabled={pwLoading} style={primaryBtn(pwLoading)}>
                                    {pwLoading ? 'Saving...' : hasPassword ? 'Change Password' : 'Set Password'}
                                </button>
                            </form>
                        </div>

                        {/* ── 2FA ── */}
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: borderRadius.md, background: totpEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ScanLine size={17} color={totpEnabled ? colors.success : colors.textTertiary} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>Two-Factor Authentication</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary }}>
                                        {totpEnabled ? 'Extra layer of login security' : 'Authenticator app required'}
                                    </p>
                                </div>
                                {totpEnabled && (
                                    <div style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: borderRadius.pill, fontSize: '11px', fontWeight: 700, color: colors.success }}>
                                        ACTIVE
                                    </div>
                                )}
                            </div>

                            {twoFAStep === 'idle' && !totpEnabled && (
                                <div>
                                    <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
                                        Add an extra layer of security. You'll need an authenticator app like Google Authenticator, Authy, or 1Password.
                                    </p>
                                    {!hasPassword && (
                                        <StatusMsg type="warn" text="You must set a password before enabling 2FA." />
                                    )}
                                    <div style={{ marginTop: hasPassword ? '0' : '14px' }}>
                                        <button onClick={handleSetup2FA} disabled={twoFALoading || !hasPassword}
                                            style={{ ...primaryBtn(twoFALoading, !hasPassword), marginTop: !hasPassword ? '14px' : '0' }}>
                                            <Smartphone size={15} /> {twoFALoading ? 'Setting up...' : 'Enable 2FA'}
                                        </button>
                                    </div>
                                    {twoFAError && <StatusMsg type="error" text={twoFAError} />}
                                </div>
                            )}

                            {twoFAStep === 'setup' && (
                                <div>
                                    <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
                                        Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
                                    </p>
                                    {twoFAQR && (
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                            <div style={{ padding: '12px', background: '#fff', borderRadius: borderRadius.lg, display: 'inline-block' }}>
                                                <img src={twoFAQR} alt="2FA QR Code" style={{ display: 'block', width: '180px', height: '180px' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, marginBottom: '20px' }}>
                                        <p style={{ color: colors.textTertiary, fontSize: '11px', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manual entry key</p>
                                        <code style={{ color: colors.primary, fontSize: '13px', letterSpacing: '2px', wordBreak: 'break-all' }}>{twoFASecret}</code>
                                    </div>
                                    <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div>
                                            <FieldLabel>Verification code</FieldLabel>
                                            <input type="text" value={twoFACode} onChange={e => setTwoFACode(e.target.value)} required placeholder="000 000" maxLength={6}
                                                style={{ ...inp, fontSize: '22px', textAlign: 'center', letterSpacing: '10px', fontWeight: 700 }} />
                                        </div>
                                        {twoFAError && <StatusMsg type="error" text={twoFAError} />}
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="button" onClick={() => { setTwoFAStep('idle'); setTwoFAError(''); }} style={ghostBtn()}>Cancel</button>
                                            <button type="submit" disabled={twoFALoading} style={{ ...primaryBtn(twoFALoading), flex: 1 }}>
                                                {twoFALoading ? 'Verifying...' : 'Verify & Enable'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {twoFAStep === 'backup' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: borderRadius.md, marginBottom: '20px' }}>
                                        <AlertTriangle size={16} color={colors.warning} style={{ flexShrink: 0, marginTop: '1px' }} />
                                        <div>
                                            <p style={{ margin: '0 0 4px', color: colors.warning, fontWeight: 700, fontSize: '13px' }}>Save your backup codes</p>
                                            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>
                                                Each code can only be used once. Store them somewhere safe — they're your only recovery method if you lose your authenticator.
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.md }}>
                                        {twoFABackupCodes.map((code, i) => (
                                            <code key={i} style={{ fontSize: '13px', fontFamily: 'monospace', padding: '8px 10px', background: colors.surface, borderRadius: borderRadius.sm, textAlign: 'center', color: colors.textPrimary, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                {code}
                                            </code>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={copyBackupCodes} style={ghostBtn()}>
                                            <Copy size={14} /> Copy All
                                        </button>
                                        <button onClick={() => setTwoFAStep('idle')} style={{ ...primaryBtn(), flex: 1 }}>
                                            I've saved them
                                        </button>
                                    </div>
                                </div>
                            )}

                            {twoFAStep === 'idle' && totpEnabled && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: borderRadius.md, marginBottom: '16px' }}>
                                        <CheckCircle size={22} color={colors.success} style={{ flexShrink: 0 }} />
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: colors.success }}>2FA is active</p>
                                            <p style={{ margin: '3px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                                                {backupCodesRemaining} backup code{backupCodesRemaining !== 1 ? 's' : ''} remaining
                                            </p>
                                        </div>
                                    </div>
                                    {!showDisable ? (
                                        <button onClick={() => setShowDisable(true)} style={ghostBtn(true)}>
                                            Disable 2FA
                                        </button>
                                    ) : (
                                        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: borderRadius.md }}>
                                            <p style={{ margin: '0 0 12px', fontSize: '13px', color: colors.textSecondary }}>Enter your password to disable 2FA:</p>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} placeholder="Your password"
                                                    style={{ ...inp, flex: 1 }} />
                                                <button onClick={handleDisable2FA} disabled={twoFALoading || !disablePassword}
                                                    style={{ padding: '11px 16px', background: colors.error, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 700, cursor: twoFALoading ? 'wait' : 'pointer', opacity: twoFALoading || !disablePassword ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                                    {twoFALoading ? '…' : 'Confirm'}
                                                </button>
                                                <button onClick={() => { setShowDisable(false); setDisablePassword(''); setTwoFAError(''); }} style={ghostBtn()}>
                                                    Cancel
                                                </button>
                                            </div>
                                            {twoFAError && <StatusMsg type="error" text={twoFAError} />}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════════════ CONNECTIONS TAB ═══════════════════ */}
                {activeTab === 'connections' && (
                    <div>
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                                {/* Discord wordmark */}
                                <div style={{ width: '44px', height: '44px', borderRadius: borderRadius.md, background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="22" height="17" viewBox="0 0 71 55" fill="none"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309-0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.483 44.2898 53.5503 44.3433C53.9057 44.6363 54.278 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.026 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.027 50.6034 51.2443 52.5699 52.5873 54.435C52.6431 54.5139 52.7438 54.5477 52.8362 54.5195C58.6441 52.7249 64.5268 50.0174 70.5997 45.5576C70.6528 45.5182 70.6866 45.459 70.6922 45.3942C72.1307 30.0791 68.1373 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" fill="white"/></svg>
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>Discord</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary }}>Admin dashboard access & guild permissions</p>
                                </div>
                            </div>

                            {discordLinked ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(88,101,242,0.10)', border: '1px solid rgba(88,101,242,0.35)', borderRadius: borderRadius.md, marginBottom: '16px' }}>
                                        <CheckCircle size={18} color="#7289DA" style={{ flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: colors.textPrimary }}>Discord account linked</p>
                                            {discordId && <p style={{ margin: '3px 0 0', fontSize: '12px', color: colors.textTertiary }}>ID: {discordId}</p>}
                                        </div>
                                    </div>
                                    <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
                                        Your Discord account grants you access to the admin dashboard and server-specific features. Unlinking will remove those guild-based permissions.
                                    </p>
                                    <button onClick={handleUnlinkDiscord} disabled={linkLoading} style={ghostBtn(true)}>
                                        <Unlink size={14} /> {linkLoading ? 'Unlinking...' : 'Unlink Discord'}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
                                        Link your Discord account to unlock the admin dashboard and community features. Your Discord server roles will determine your permissions.
                                    </p>
                                    <button onClick={handleLinkDiscord} disabled={linkLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 700, fontSize: '14px', cursor: linkLoading ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(88,101,242,0.4)' }}>
                                        <Link2 size={16} /> {linkLoading ? 'Redirecting...' : 'Link Discord Account'}
                                    </button>
                                </div>
                            )}

                            {linkError && <StatusMsg type="error" text={linkError} />}
                            {linkMsg && <StatusMsg type="success" text={linkMsg} />}
                        </div>
                    </div>
                )}

            </div>
        </DiscoveryLayout>
    );
};
