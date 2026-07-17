import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import logoUrl from '../assets/logo.svg';

type Tab = 'login' | 'register';

export const LoginPage: React.FC = () => {
    const { emailLogin, register, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
    const urlError = searchParams.get('error');

    // Redirect already-authenticated users away from the login page
    React.useEffect(() => {
        if (!authLoading && user) {
            navigate('/', { replace: true });
        }
    }, [authLoading, user]);

    const [tab, setTab] = useState<Tab>(initialTab);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(
        urlError === 'server_error' ? 'Something went wrong during sign in. Please try again.'
        : urlError === 'use_site_account' ? 'Sign in with your Fuji Studio account below. You can connect Discord from account settings afterwards.'
        : urlError === 'discord_no_account' ? 'No Fuji Studio account is linked to that Discord. Create an account below, then link Discord from your settings.'
        : ''
    );
    // Users who previously only logged in with Discord won't have a password yet —
    // when they land here from the old Discord-login flow, point them at a reset.
    const cameFromDiscord = urlError === 'use_site_account' || urlError === 'discord_no_account';
    const [success, setSuccess] = useState('');
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [resendEmail, setResendEmail] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const handleResendVerification = async () => {
        if (!resendEmail) return;
        setResendLoading(true);
        try {
            const res = await fetch('/api/auth/send-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resendEmail }) });
            const data = await res.json();
            if (res.ok) setResendSuccess(true);
            else setError(data.error || 'Failed to resend verification email');
        } catch {
            setError('Failed to resend verification email');
        } finally {
            setResendLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await emailLogin(email, password, requiresTwoFactor ? totpCode : undefined);
            if (result.requiresTwoFactor) {
                setRequiresTwoFactor(true);
                setLoading(false);
                return;
            }
            if (result.error) {
                setError(result.error);
                // If email not verified, show resend option
                if (result.code === 'EMAIL_NOT_VERIFIED') {
                    setShowResendVerification(true);
                    setResendEmail(email);
                }
                setLoading(false);
                return;
            }
            navigate('/');
        } catch {
            setError('Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            const result = await register(username, email, password);
            if (result.error) {
                setError(result.error);
                setLoading(false);
                return;
            }
            setSuccess('Account created! Please check your email and click the verification link before signing in.');
        } catch {
            setError('Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 40px 12px 44px',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        color: colors.textPrimary,
        fontSize: '14px',
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'border-color 0.2s',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '13px',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        fontWeight: 500,
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: colors.background,
            backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(242, 120, 10, 0.06) 0%, transparent 50%)',
            padding: spacing.lg,
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(16px)',
                padding: '40px',
                borderRadius: '20px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                maxWidth: '440px',
                width: '100%',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        width: '72px', height: '72px',
                        background: 'rgba(242, 120, 10, 0.08)',
                        borderRadius: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        border: '1px solid rgba(242, 120, 10, 0.15)',
                    }}>
                        <img src={logoUrl} alt="Fuji Studio" style={{ width: '44px', height: '44px', filter: 'brightness(0) invert(1)' }} />
                    </div>
                    <h1 style={{ color: colors.textPrimary, fontSize: '24px', fontWeight: 700, margin: 0 }}>Fuji Studio</h1>
                    <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '8px 0 0' }}>
                        {tab === 'login' ? 'Sign in to your account' : 'Create your account'}
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', marginBottom: '24px', background: colors.surface, borderRadius: borderRadius.lg, padding: '4px' }}>
                    {(['login', 'register'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError(''); setSuccess(''); setRequiresTwoFactor(false); }}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: tab === t ? colors.primary : 'transparent',
                                color: tab === t ? '#fff' : colors.textSecondary,
                                border: 'none',
                                borderRadius: borderRadius.md,
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {t === 'login' ? 'Sign In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                {/* Discord-migration hint — used to sign in with Discord, no password yet */}
                {cameFromDiscord && tab === 'login' && (
                    <div style={{ background: 'rgba(242,120,10,0.08)', border: `1px solid ${colors.primary}40`, borderRadius: borderRadius.lg, padding: '12px 14px', marginBottom: spacing.lg }}>
                        <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5 }}>
                            Used to sign in with Discord? Accounts now use email &amp; password.{' '}
                            <a href="/forgot-password" style={{ color: colors.primary, fontWeight: 600, textDecoration: 'none' }}>Set your password →</a>
                        </p>
                    </div>
                )}

                {/* Login Form */}
                {tab === 'login' && (
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                        {!requiresTwoFactor ? (
                            <>
                                <div>
                                    <label style={labelStyle}>Email</label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                        <input
                                            type="email"
                                            id="login-email"
                                            name="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            placeholder="you@example.com"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="login-password"
                                            name="password"
                                            autoComplete="current-password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                            placeholder="Enter your password"
                                            style={inputStyle}
                                        />
                                        <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: 0 }}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div style={{ textAlign: 'right', marginTop: spacing.xs }}>
                                        <a href="/forgot-password" style={{ color: colors.primary, fontSize: '13px', textDecoration: 'none' }}>Forgot password?</a>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
                                    <p style={{ color: colors.textSecondary, fontSize: '14px', margin: 0 }}>
                                        Enter the 6-digit code from your authenticator app, or a backup code.
                                    </p>
                                </div>
                                <label style={labelStyle}>Two-Factor Code</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input
                                        type="text"
                                        value={totpCode}
                                        onChange={e => setTotpCode(e.target.value)}
                                        required
                                        placeholder="000000"
                                        autoFocus
                                        maxLength={8}
                                        style={{ ...inputStyle, textAlign: 'center', letterSpacing: '4px', fontSize: '18px' }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setRequiresTwoFactor(false); setTotpCode(''); setError(''); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', marginTop: spacing.md, padding: 0 }}
                                >
                                    <ArrowLeft size={14} /> Back to login
                                </button>
                            </div>
                        )}

                        {error && (
                            <div>
                                <p style={{ color: colors.error, fontSize: '13px', margin: '0 0 8px', textAlign: 'center' }}>{error}</p>
                                {showResendVerification && !resendSuccess && (
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ color: colors.textSecondary, fontSize: '12px', margin: '0 0 8px' }}>Didn't get it? Resend the verification email:</p>
                                        <input value={resendEmail} onChange={e => setResendEmail(e.target.value)} placeholder="Your email" style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
                                        <button onClick={handleResendVerification} disabled={resendLoading} style={{ background: colors.surface, color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: borderRadius.md, padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{resendLoading ? 'Sending...' : 'Resend Verification Email'}</button>
                                    </div>
                                )}
                                {resendSuccess && <p style={{ color: colors.primary, fontSize: '12px', textAlign: 'center', margin: 0 }}>Verification email sent! Check your inbox.</p>}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '13px',
                                background: 'linear-gradient(135deg, #F2780A, #C96208)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: borderRadius.lg,
                                fontWeight: 700,
                                fontSize: '15px',
                                cursor: loading ? 'wait' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading ? 'Signing in...' : requiresTwoFactor ? 'Verify' : 'Sign In'}
                        </button>
                    </form>
                )}

                {/* Register Form */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                        <div>
                            <label style={labelStyle}>Username</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    id="register-username"
                                    name="username"
                                    autoComplete="username"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    placeholder="Choose a username"
                                    minLength={3}
                                    maxLength={30}
                                    style={inputStyle}
                                />
                            </div>
                            <p style={{ color: colors.textTertiary, fontSize: '12px', margin: `${spacing.xs} 0 0` }}>3-30 characters, letters, numbers, hyphens, underscores</p>
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="email"
                                    id="register-email"
                                    name="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="register-password"
                                    name="password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="At least 8 characters"
                                    minLength={8}
                                    style={inputStyle}
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: 0 }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="password"
                                    id="register-confirm-password"
                                    name="confirm-password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Confirm your password"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {error && <p style={{ color: colors.error, fontSize: '13px', margin: 0, textAlign: 'center' }}>{error}</p>}
                        {success && <p style={{ color: colors.success, fontSize: '13px', margin: 0, textAlign: 'center' }}>{success}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '13px',
                                background: 'linear-gradient(135deg, #F2780A, #C96208)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: borderRadius.lg,
                                fontWeight: 700,
                                fontSize: '15px',
                                cursor: loading ? 'wait' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>
                )}


                {/* Back link */}
                <div style={{ textAlign: 'center', marginTop: spacing.xl }}>
                    <a href="/" style={{ color: colors.textTertiary, fontSize: '13px', textDecoration: 'none' }}>
                        Back to home
                    </a>
                </div>
            </div>
        </div>
    );
};
