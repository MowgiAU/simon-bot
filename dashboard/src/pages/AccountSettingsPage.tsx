import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCog, Mail, Lock, CheckCircle, XCircle, Send, Eye, EyeOff } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';

export const AccountSettingsPage: React.FC = () => {
    const { user, email, emailVerified, hasPassword, refreshAccountStatus } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setpwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyMsg, setVerifyMsg] = useState('');
    const [verifyError, setVerifyError] = useState('');

    // Handle ?verified=true / ?verified=false from email link redirect
    useEffect(() => {
        const v = searchParams.get('verified');
        if (v === 'true') {
            setVerifyMsg('Your email has been verified successfully!');
            refreshAccountStatus();
        } else if (v === 'false') {
            setVerifyError('Verification link is invalid or expired. Please request a new one.');
        }
    }, []);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setpwError('');
        setPwSuccess('');
        if (newPassword !== confirmPassword) {
            setpwError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setpwError('Password must be at least 8 characters');
            return;
        }
        setPwLoading(true);
        try {
            const endpoint = hasPassword ? '/api/auth/change-password' : '/api/auth/set-password';
            const body: any = { password: newPassword };
            if (hasPassword) {
                body.currentPassword = currentPassword;
                body.newPassword = newPassword;
                delete body.password;
            }
            const res = await fetch(endpoint, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setpwError(data.error || 'Failed to set password'); return; }
            setPwSuccess(hasPassword ? 'Password changed successfully.' : 'Password set! You can now log in with email + password.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            refreshAccountStatus();
        } catch {
            setpwError('Request failed');
        } finally {
            setPwLoading(false);
        }
    };

    const handleSendVerification = async () => {
        setVerifyMsg('');
        setVerifyError('');
        setVerifyLoading(true);
        try {
            const res = await fetch('/api/auth/send-verification', {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) { setVerifyError(data.error || 'Failed to send email'); return; }
            setVerifyMsg(`Verification email sent to ${email}. Check your inbox (and spam folder).`);
        } catch {
            setVerifyError('Request failed');
        } finally {
            setVerifyLoading(false);
        }
    };

    if (!user) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>
                <p>Please log in to manage your account.</p>
                <button onClick={() => navigate('/')} style={{ marginTop: spacing.lg, padding: '10px 20px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}>
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: `${spacing['3xl']} ${spacing.lg}` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <UserCog size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Account Settings</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage your Fuji Studio account and login security</p>
                </div>
            </div>

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xxl, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '14px', lineHeight: '1.5' }}>
                    Your account is linked to your Discord login. Setting a password allows you to log in with your email if Discord is ever unavailable.
                </p>
            </div>

            {/* Email & Verification */}
            <div style={{ background: colors.surface, borderRadius: borderRadius.xl, padding: spacing['3xl'], marginBottom: spacing.xxl, border: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
                    <Mail size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Email Address</h2>
                </div>

                {email ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, background: colors.background, borderRadius: borderRadius.lg, padding: spacing.lg }}>
                            <span style={{ color: colors.textPrimary, fontWeight: 600, flex: 1 }}>{email}</span>
                            {emailVerified ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: colors.success, fontWeight: 600, fontSize: '13px' }}>
                                    <CheckCircle size={16} />
                                    Verified
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: colors.warning, fontWeight: 600, fontSize: '13px' }}>
                                    <XCircle size={16} />
                                    Not verified
                                </div>
                            )}
                        </div>

                        {!emailVerified && (
                            <>
                                <button
                                    onClick={handleSendVerification}
                                    disabled={verifyLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 18px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, cursor: verifyLoading ? 'wait' : 'pointer', fontWeight: 600, fontSize: '14px', opacity: verifyLoading ? 0.7 : 1 }}
                                >
                                    <Send size={14} />
                                    {verifyLoading ? 'Sending...' : 'Send Verification Email'}
                                </button>
                                {verifyError && <p style={{ color: colors.error, fontSize: '13px', marginTop: spacing.sm }}>{verifyError}</p>}
                                {verifyMsg && <p style={{ color: colors.success, fontSize: '13px', marginTop: spacing.sm }}>{verifyMsg}</p>}
                            </>
                        )}

                        {emailVerified && verifyMsg && (
                            <p style={{ color: colors.success, fontSize: '13px', margin: 0 }}>{verifyMsg}</p>
                        )}
                    </>
                ) : (
                    <div style={{ color: colors.textSecondary, fontSize: '14px', padding: spacing.lg, background: colors.background, borderRadius: borderRadius.md }}>
                        No email on file. Make sure your Discord account has a verified email address, then <strong style={{ color: colors.textPrimary }}>log out and log back in</strong> to pull it.
                    </div>
                )}
            </div>

            {/* Password */}
            <div style={{ background: colors.surface, borderRadius: borderRadius.xl, padding: spacing['3xl'], border: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
                    <Lock size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{hasPassword ? 'Change Password' : 'Set a Password'}</h2>
                </div>

                {!email && (
                    <div style={{ color: colors.warning, fontSize: '13px', marginBottom: spacing.lg, background: `${colors.warning}15`, padding: spacing.md, borderRadius: borderRadius.md }}>
                        You need a verified email on file before you can set a password.
                    </div>
                )}

                <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    {hasPassword && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>Current Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '10px 40px 10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' }}
                                />
                                <button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}>
                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                disabled={!email}
                                placeholder="At least 8 characters"
                                style={{ width: '100%', padding: '10px 40px 10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box', opacity: !email ? 0.5 : 1 }}
                            />
                            <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}>
                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs }}>Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            disabled={!email}
                            style={{ width: '100%', padding: '10px 12px', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box', opacity: !email ? 0.5 : 1 }}
                        />
                    </div>

                    {pwError && <p style={{ color: colors.error, fontSize: '13px', margin: 0 }}>{pwError}</p>}
                    {pwSuccess && <p style={{ color: colors.success, fontSize: '13px', margin: 0 }}>{pwSuccess}</p>}

                    <button
                        type="submit"
                        disabled={pwLoading || !email}
                        style={{ padding: '12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '14px', cursor: pwLoading || !email ? 'not-allowed' : 'pointer', opacity: pwLoading || !email ? 0.7 : 1 }}
                    >
                        {pwLoading ? 'Saving...' : hasPassword ? 'Change Password' : 'Set Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};
