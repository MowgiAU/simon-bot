import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCog, Mail, Lock, CheckCircle, XCircle, Send, Eye, EyeOff, Shield, Smartphone, Link2, Unlink, Copy, AlertTriangle } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';

export const AccountSettingsPage: React.FC = () => {
    const { user, email, emailVerified, hasPassword, totpEnabled, refreshAccountStatus } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

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
    }, []);

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
            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>
                <p>Please log in to manage your account.</p>
                <button onClick={() => navigate('/login')} style={{ marginTop: spacing.lg, padding: '10px 20px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}>
                    Sign In
                </button>
            </div>
        );
    }

    const sectionStyle: React.CSSProperties = {
        background: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing['3xl'], marginBottom: spacing.xxl,
        border: `1px solid ${colors.border}`,
    };
    const sectionHeaderStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl,
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: `${spacing['3xl']} ${spacing.lg}` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <UserCog size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Account Settings</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage your Fuji Studio account, security, and linked services</p>
                </div>
            </div>

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xxl, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '14px', lineHeight: '1.5' }}>
                    {accountUsername && <span>Signed in as <strong>{accountUsername}</strong>. </span>}
                    Manage your email, password, two-factor authentication, and Discord connection.
                </p>
            </div>

            {/* Email & Verification */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Mail size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Email Address</h2>
                </div>
                {email ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, background: colors.background, borderRadius: borderRadius.lg, padding: spacing.lg }}>
                            <span style={{ color: colors.textPrimary, fontWeight: 600, flex: 1 }}>{email}</span>
                            {emailVerified ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: colors.success, fontWeight: 600, fontSize: '13px' }}>
                                    <CheckCircle size={16} /> Verified
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: colors.warning, fontWeight: 600, fontSize: '13px' }}>
                                    <XCircle size={16} /> Not verified
                                </div>
                            )}
                        </div>
                        {!emailVerified && (
                            <>
                                <button onClick={handleSendVerification} disabled={verifyLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 18px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, cursor: verifyLoading ? 'wait' : 'pointer', fontWeight: 600, fontSize: '14px', opacity: verifyLoading ? 0.7 : 1 }}>
                                    <Send size={14} /> {verifyLoading ? 'Sending...' : 'Send Verification Email'}
                                </button>
                                {verifyError && <p style={{ color: colors.error, fontSize: '13px', marginTop: spacing.sm }}>{verifyError}</p>}
                                {verifyMsg && <p style={{ color: colors.success, fontSize: '13px', marginTop: spacing.sm }}>{verifyMsg}</p>}
                            </>
                        )}
                        {emailVerified && verifyMsg && <p style={{ color: colors.success, fontSize: '13px', margin: 0 }}>{verifyMsg}</p>}
                    </>
                ) : (
                    <div style={{ color: colors.textSecondary, fontSize: '14px', padding: spacing.lg, background: colors.background, borderRadius: borderRadius.md }}>
                        No email on file. If you signed in via Discord, make sure your Discord account has a verified email address and <strong style={{ color: colors.textPrimary }}>log out and log back in</strong> to pull it.
                    </div>
                )}
            </div>

            {/* Password */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Lock size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{hasPassword ? 'Change Password' : 'Set a Password'}</h2>
                </div>
                <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    {hasPassword && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>Current Password</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                                    style={{ width: '100%', padding: '10px 40px 10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' }} />
                                <button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}>
                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="At least 8 characters"
                                style={{ width: '100%', padding: '10px 40px 10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' }} />
                            <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}>
                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                            style={{ width: '100%', padding: '10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' }} />
                    </div>
                    {pwError && <p style={{ color: colors.error, fontSize: '13px', margin: 0 }}>{pwError}</p>}
                    {pwSuccess && <p style={{ color: colors.success, fontSize: '13px', margin: 0 }}>{pwSuccess}</p>}
                    <button type="submit" disabled={pwLoading}
                        style={{ padding: '12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '14px', cursor: pwLoading ? 'not-allowed' : 'pointer', opacity: pwLoading ? 0.7 : 1 }}>
                        {pwLoading ? 'Saving...' : hasPassword ? 'Change Password' : 'Set Password'}
                    </button>
                </form>
            </div>

            {/* Two-Factor Authentication */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Shield size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Two-Factor Authentication</h2>
                </div>

                {twoFAStep === 'idle' && !totpEnabled && (
                    <div>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.lg, lineHeight: 1.5 }}>
                            Add an extra layer of security to your account. You'll need an authenticator app like Google Authenticator, Authy, or 1Password.
                        </p>
                        {!hasPassword && (
                            <div style={{ color: colors.warning, fontSize: '13px', marginBottom: spacing.lg, background: `${colors.warning}15`, padding: spacing.md, borderRadius: borderRadius.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <AlertTriangle size={16} /> You must set a password before enabling 2FA.
                            </div>
                        )}
                        <button onClick={handleSetup2FA} disabled={twoFALoading || !hasPassword}
                            style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 18px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, cursor: twoFALoading || !hasPassword ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px', opacity: twoFALoading || !hasPassword ? 0.7 : 1 }}>
                            <Smartphone size={16} /> {twoFALoading ? 'Setting up...' : 'Enable 2FA'}
                        </button>
                        {twoFAError && <p style={{ color: colors.error, fontSize: '13px', marginTop: spacing.sm }}>{twoFAError}</p>}
                    </div>
                )}

                {twoFAStep === 'setup' && (
                    <div>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.lg }}>
                            Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
                        </p>
                        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                            {twoFAQR && <img src={twoFAQR} alt="2FA QR Code" style={{ borderRadius: borderRadius.lg, maxWidth: '200px' }} />}
                        </div>
                        <div style={{ background: colors.background, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xl, wordBreak: 'break-all' }}>
                            <p style={{ color: colors.textTertiary, fontSize: '12px', margin: `0 0 ${spacing.xs}` }}>Manual entry key:</p>
                            <code style={{ color: colors.textPrimary, fontSize: '13px', letterSpacing: '2px' }}>{twoFASecret}</code>
                        </div>
                        <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>Verification Code</label>
                                <input type="text" value={twoFACode} onChange={e => setTwoFACode(e.target.value)} required placeholder="000000" maxLength={6}
                                    style={{ width: '100%', padding: '12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '18px', textAlign: 'center', letterSpacing: '6px', boxSizing: 'border-box' }} />
                            </div>
                            {twoFAError && <p style={{ color: colors.error, fontSize: '13px', margin: 0, textAlign: 'center' }}>{twoFAError}</p>}
                            <div style={{ display: 'flex', gap: spacing.md }}>
                                <button type="button" onClick={() => { setTwoFAStep('idle'); setTwoFAError(''); }}
                                    style={{ flex: 1, padding: '12px', background: colors.surfaceLight, color: colors.textSecondary, border: 'none', borderRadius: borderRadius.lg, fontWeight: 600, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={twoFALoading}
                                    style={{ flex: 1, padding: '12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, fontWeight: 700, cursor: twoFALoading ? 'wait' : 'pointer', opacity: twoFALoading ? 0.7 : 1 }}>
                                    {twoFALoading ? 'Verifying...' : 'Verify & Enable'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {twoFAStep === 'backup' && (
                    <div>
                        <div style={{ background: `${colors.warning}15`, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.xl, border: `1px solid ${colors.warning}33` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                                <AlertTriangle size={18} color={colors.warning} />
                                <strong style={{ color: colors.warning, fontSize: '14px' }}>Save your backup codes</strong>
                            </div>
                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                                Store these codes in a safe place. Each code can only be used once. If you lose access to your authenticator app, these are the only way to recover your account.
                            </p>
                        </div>
                        <div style={{ background: colors.background, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.lg }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                                {twoFABackupCodes.map((code, i) => (
                                    <code key={i} style={{ color: colors.textPrimary, fontSize: '14px', fontFamily: 'monospace', padding: spacing.sm, background: colors.surface, borderRadius: borderRadius.sm, textAlign: 'center' }}>
                                        {code}
                                    </code>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: spacing.md }}>
                            <button onClick={copyBackupCodes}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: '10px', background: colors.surfaceLight, color: colors.textPrimary, border: 'none', borderRadius: borderRadius.lg, fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                <Copy size={14} /> Copy Codes
                            </button>
                            <button onClick={() => setTwoFAStep('idle')}
                                style={{ flex: 1, padding: '10px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                                I've saved them
                            </button>
                        </div>
                    </div>
                )}

                {twoFAStep === 'idle' && totpEnabled && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, background: `${colors.success}10`, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.success}33` }}>
                            <CheckCircle size={20} color={colors.success} />
                            <div>
                                <p style={{ margin: 0, color: colors.success, fontWeight: 600, fontSize: '14px' }}>Two-factor authentication is enabled</p>
                                <p style={{ margin: `${spacing.xs} 0 0`, color: colors.textSecondary, fontSize: '13px' }}>
                                    {backupCodesRemaining} backup code{backupCodesRemaining !== 1 ? 's' : ''} remaining
                                </p>
                            </div>
                        </div>
                        {!showDisable ? (
                            <button onClick={() => setShowDisable(true)}
                                style={{ padding: '10px 18px', background: 'transparent', color: colors.error, border: `1px solid ${colors.error}50`, borderRadius: borderRadius.lg, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                                Disable 2FA
                            </button>
                        ) : (
                            <div style={{ background: `${colors.error}10`, padding: spacing.lg, borderRadius: borderRadius.md, border: `1px solid ${colors.error}33` }}>
                                <p style={{ color: colors.textSecondary, fontSize: '13px', margin: `0 0 ${spacing.md}` }}>Enter your password to confirm:</p>
                                <div style={{ display: 'flex', gap: spacing.md }}>
                                    <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} placeholder="Your password"
                                        style={{ flex: 1, padding: '10px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' }} />
                                    <button onClick={handleDisable2FA} disabled={twoFALoading || !disablePassword}
                                        style={{ padding: '10px 16px', background: colors.error, color: '#fff', border: 'none', borderRadius: borderRadius.lg, fontWeight: 600, cursor: twoFALoading ? 'wait' : 'pointer', opacity: twoFALoading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                                        {twoFALoading ? '...' : 'Confirm'}
                                    </button>
                                    <button onClick={() => { setShowDisable(false); setDisablePassword(''); setTwoFAError(''); }}
                                        style={{ padding: '10px 16px', background: colors.surfaceLight, color: colors.textSecondary, border: 'none', borderRadius: borderRadius.lg, fontWeight: 600, cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                </div>
                                {twoFAError && <p style={{ color: colors.error, fontSize: '13px', marginTop: spacing.sm }}>{twoFAError}</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Discord Connection */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Link2 size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Discord Connection</h2>
                </div>

                {discordLinked ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, background: colors.background, borderRadius: borderRadius.lg, padding: spacing.lg }}>
                            <svg width="24" height="18" viewBox="0 0 71 55" fill="none"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309-0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.483 44.2898 53.5503 44.3433C53.9057 44.6363 54.278 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.026 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.027 50.6034 51.2443 52.5699 52.5873 54.435C52.6431 54.5139 52.7438 54.5477 52.8362 54.5195C58.6441 52.7249 64.5268 50.0174 70.5997 45.5576C70.6528 45.5182 70.6866 45.459 70.6922 45.3942C72.1307 30.0791 68.1373 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" fill="#5865F2"/></svg>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 600, fontSize: '14px' }}>Discord Connected</p>
                                {discordId && <p style={{ margin: `${spacing.xs} 0 0`, color: colors.textTertiary, fontSize: '12px' }}>ID: {discordId}</p>}
                            </div>
                            <CheckCircle size={18} color={colors.success} />
                        </div>
                        <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: spacing.md, lineHeight: 1.5 }}>
                            Your Discord account is linked. This gives you access to the admin dashboard and guild features.
                        </p>
                        <button onClick={handleUnlinkDiscord} disabled={linkLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 18px', background: 'transparent', color: colors.error, border: `1px solid ${colors.error}50`, borderRadius: borderRadius.lg, fontWeight: 600, fontSize: '13px', cursor: linkLoading ? 'wait' : 'pointer' }}>
                            <Unlink size={14} /> Unlink Discord
                        </button>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.lg, lineHeight: 1.5 }}>
                            Link your Discord account to access the admin dashboard and community features. Your Discord roles will be used to determine your permissions.
                        </p>
                        <button onClick={handleLinkDiscord} disabled={linkLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 18px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: borderRadius.lg, fontWeight: 600, fontSize: '14px', cursor: linkLoading ? 'wait' : 'pointer' }}>
                            <Link2 size={16} /> Link Discord Account
                        </button>
                    </div>
                )}
                {linkError && <p style={{ color: colors.error, fontSize: '13px', marginTop: spacing.sm }}>{linkError}</p>}
                {linkMsg && <p style={{ color: colors.success, fontSize: '13px', marginTop: spacing.sm }}>{linkMsg}</p>}
            </div>
        </div>
    );
};
