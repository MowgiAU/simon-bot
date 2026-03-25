import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import logoUrl from '../assets/logo.svg';

type Tab = 'login' | 'register';

export const LoginPage: React.FC = () => {
    const { emailLogin, register, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
    const urlError = searchParams.get('error');

    const [tab, setTab] = useState<Tab>(initialTab);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(urlError === 'no_account' ? 'No account is linked to that Discord profile. Please create an account first.' : '');
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
            backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.06) 0%, transparent 50%)',
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
                        background: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
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
                                background: 'linear-gradient(135deg, #10B981, #059669)',
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
                                background: 'linear-gradient(135deg, #10B981, #059669)',
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

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, margin: `${spacing.xl} 0` }}>
                    <div style={{ flex: 1, height: '1px', background: colors.border }} />
                    <span style={{ color: colors.textTertiary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>or</span>
                    <div style={{ flex: 1, height: '1px', background: colors.border }} />
                </div>

                {/* Discord Login */}
                <button
                    onClick={login}
                    style={{
                        width: '100%',
                        padding: '13px',
                        background: '#5865F2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: borderRadius.lg,
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.sm,
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#4752C4'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#5865F2'; }}
                >
                    <svg width="20" height="15" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.4827 44.3433C53.8381 44.6363 54.2103 44.9293 54.5853 45.2082C54.7140 45.304 54.7056 45.5041 54.5765 45.5858C52.7969 46.6197 50.9583 47.4931 49.0245 48.2228C48.8986 48.2707 48.8426 48.4172 48.9042 48.5383C49.9594 50.6034 51.1767 52.5699 52.5196 54.4350C52.5755 54.5139 52.6762 54.5477 52.7686 54.5195C58.5765 52.7249 64.4592 50.0174 70.5321 45.5576C70.5852 45.5182 70.6190 45.4590 70.6246 45.3942C72.1307 30.0791 68.1373 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.2250 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.280 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9370 34.1136 40.9370 30.1693C40.9370 26.2250 43.7636 23.0133 47.3178 23.0133C50.8999 23.0133 53.7545 26.2532 53.6985 30.1693C53.6985 34.1136 50.8999 37.3253 47.3178 37.3253Z" fill="white"/>
                    </svg>
                    Continue with Discord
                </button>

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
