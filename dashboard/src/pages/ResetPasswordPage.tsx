import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import logoUrl from '../assets/logo.svg';

export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Request failed'); return; }
            setSent(true);
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const containerStyle: React.CSSProperties = {
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
        background: colors.background,
        backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.06) 0%, transparent 50%)',
        padding: spacing.lg,
    };
    const cardStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(16px)',
        padding: '40px', borderRadius: '20px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        maxWidth: '440px', width: '100%', border: '1px solid rgba(255, 255, 255, 0.06)',
    };

    if (sent) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={48} color={colors.success} style={{ marginBottom: spacing.lg }} />
                        <h2 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.md}` }}>Check your email</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: 1.6, marginBottom: spacing.xl }}>
                            If an account with that email exists, we've sent a password reset link. Check your inbox (and spam folder).
                        </p>
                        <a href="/login" style={{ color: colors.primary, fontSize: '14px', textDecoration: 'none', fontWeight: 600 }}>
                            Back to login
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        width: '72px', height: '72px', background: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', border: '1px solid rgba(16, 185, 129, 0.15)',
                    }}>
                        <img src={logoUrl} alt="Fuji Studio" style={{ width: '44px', height: '44px', filter: 'brightness(0) invert(1)' }} />
                    </div>
                    <h1 style={{ color: colors.textPrimary, fontSize: '24px', fontWeight: 700, margin: 0 }}>Forgot Password</h1>
                    <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '8px 0 0' }}>
                        Enter your email and we'll send you a reset link
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: 500 }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                style={{
                                    width: '100%', padding: '12px 12px 12px 44px', background: colors.surface,
                                    border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg,
                                    color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                                }}
                            />
                        </div>
                    </div>

                    {error && <p style={{ color: colors.error, fontSize: '13px', margin: 0, textAlign: 'center' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '13px', background: 'linear-gradient(135deg, #10B981, #059669)',
                            color: '#fff', border: 'none', borderRadius: borderRadius.lg,
                            fontWeight: 700, fontSize: '15px', cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: spacing.xl }}>
                    <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, color: colors.textTertiary, fontSize: '13px', textDecoration: 'none' }}>
                        <ArrowLeft size={14} /> Back to login
                    </a>
                </div>
            </div>
        </div>
    );
};

export const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const containerStyle: React.CSSProperties = {
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
        background: colors.background,
        backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.06) 0%, transparent 50%)',
        padding: spacing.lg,
    };
    const cardStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(16px)',
        padding: '40px', borderRadius: '20px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        maxWidth: '440px', width: '100%', border: '1px solid rgba(255, 255, 255, 0.06)',
    };

    if (!token) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ color: colors.error, margin: `0 0 ${spacing.md}` }}>Invalid Link</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.xl }}>This password reset link is invalid. Please request a new one.</p>
                        <a href="/forgot-password" style={{ color: colors.primary, fontSize: '14px', textDecoration: 'none', fontWeight: 600 }}>Request new link</a>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={48} color={colors.success} style={{ marginBottom: spacing.lg }} />
                        <h2 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.md}` }}>Password Reset</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.xl }}>
                            Your password has been reset successfully. You can now sign in.
                        </p>
                        <a href="/login" style={{ color: colors.primary, fontSize: '14px', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
                    </div>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Reset failed'); return; }
            setSuccess(true);
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        width: '72px', height: '72px', background: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', border: '1px solid rgba(16, 185, 129, 0.15)',
                    }}>
                        <img src={logoUrl} alt="Fuji Studio" style={{ width: '44px', height: '44px', filter: 'brightness(0) invert(1)' }} />
                    </div>
                    <h1 style={{ color: colors.textPrimary, fontSize: '24px', fontWeight: 700, margin: 0 }}>Reset Password</h1>
                    <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '8px 0 0' }}>Enter your new password</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: 500 }}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={8}
                                placeholder="At least 8 characters"
                                style={{
                                    width: '100%', padding: '12px 40px 12px 44px', background: colors.surface,
                                    border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg,
                                    color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                                }}
                            />
                            <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: 0 }}>
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: 500 }}>Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Confirm your password"
                                style={{
                                    width: '100%', padding: '12px 12px 12px 44px', background: colors.surface,
                                    border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg,
                                    color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                                }}
                            />
                        </div>
                    </div>

                    {error && <p style={{ color: colors.error, fontSize: '13px', margin: 0, textAlign: 'center' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '13px', background: 'linear-gradient(135deg, #10B981, #059669)',
                            color: '#fff', border: 'none', borderRadius: borderRadius.lg,
                            fontWeight: 700, fontSize: '15px', cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};
