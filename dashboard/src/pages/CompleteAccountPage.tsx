import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, CheckCircle, Eye, EyeOff, Shield, ArrowRight, ArrowLeft, Smartphone, Copy, Download, ShieldCheck } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import logoUrl from '../assets/logo.svg';

// ─── Shared styles ──────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    color: colors.textPrimary, fontSize: '14px',
    outline: 'none',
};

const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '13px 20px',
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
    color: '#fff', border: 'none', borderRadius: borderRadius.md,
    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    transition: 'opacity 0.15s',
};

const btnSecondary: React.CSSProperties = {
    width: '100%', padding: '12px 20px',
    background: 'rgba(255,255,255,0.04)',
    color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    fontWeight: 500, fontSize: '14px', cursor: 'pointer',
    transition: 'background 0.15s',
};

const StatusMsg: React.FC<{ type: 'success' | 'error'; text: string }> = ({ type, text }) => {
    const c = type === 'success' ? colors.success : colors.error;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: `${c}16`, border: `1px solid ${c}35`, borderRadius: borderRadius.md, fontSize: '13px', color: c, marginTop: '10px' }}>
            {type === 'success' ? <CheckCircle size={14} /> : null} {text}
        </div>
    );
};

// ─── Step definitions ───────────────────────────────────────────────────────
type StepId = 'email' | 'password' | 'verify' | 'totp' | 'done';

interface StepDef {
    id: StepId;
    label: string;
    icon: React.ReactNode;
    required: boolean;
}

const ALL_STEPS: StepDef[] = [
    { id: 'email', label: 'Email', icon: <Mail size={16} />, required: true },
    { id: 'password', label: 'Password', icon: <Lock size={16} />, required: true },
    { id: 'verify', label: 'Verify Email', icon: <CheckCircle size={16} />, required: true },
    { id: 'totp', label: 'Two-Factor Auth', icon: <Shield size={16} />, required: false },
];

// ─── Component ──────────────────────────────────────────────────────────────
export const CompleteAccountPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, email, emailVerified, hasPassword, totpEnabled, refreshAccountStatus, loginMethod } = useAuth();

    // Determine which steps are needed
    const getActiveSteps = useCallback((): StepDef[] => {
        const steps: StepDef[] = [];
        if (!email) steps.push(ALL_STEPS[0]);       // email
        if (!hasPassword) steps.push(ALL_STEPS[1]);  // password
        if (!emailVerified) steps.push(ALL_STEPS[2]); // verify
        if (!totpEnabled) steps.push(ALL_STEPS[3]);  // totp (optional)
        return steps;
    }, [email, hasPassword, emailVerified, totpEnabled]);

    const [activeSteps, setActiveSteps] = useState<StepDef[]>(getActiveSteps);
    const [currentIdx, setCurrentIdx] = useState(0);

    // Re-check steps when auth state refreshes
    useEffect(() => {
        const newSteps = getActiveSteps();
        setActiveSteps(newSteps);
        // If currently on a step that's now completed, advance
        if (newSteps.length === 0 || (newSteps.length === 1 && newSteps[0].id === 'totp')) {
            // All required steps done
        }
    }, [email, hasPassword, emailVerified, totpEnabled, getActiveSteps]);

    // If nothing to setup, redirect
    useEffect(() => {
        if (user && email && hasPassword && emailVerified) {
            // Only 2FA remaining (optional) — don't force redirect
        }
    }, [user, email, hasPassword, emailVerified]);

    const currentStep = activeSteps[currentIdx] || null;
    const isLastRequired = currentStep && !activeSteps.slice(currentIdx + 1).some(s => s.required);

    const goNext = () => {
        if (currentIdx < activeSteps.length - 1) {
            setCurrentIdx(currentIdx + 1);
        } else {
            finishSetup();
        }
    };

    const finishSetup = () => {
        sessionStorage.setItem('fuji_setup_dismissed', '1');
        refreshAccountStatus();
        navigate('/');
    };

    // ─── Email step state ─────────────────────────────────────────────
    const [emailInput, setEmailInput] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [emailSuccess, setEmailSuccess] = useState('');

    const handleSetEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError(''); setEmailSuccess('');
        const trimmed = emailInput.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setEmailError('Please enter a valid email address');
            return;
        }
        setEmailLoading(true);
        try {
            const res = await fetch('/api/auth/set-email', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) { setEmailError(data.error || 'Failed to set email'); return; }
            setEmailSuccess('Email set! A verification link has been sent.');
            refreshAccountStatus();
            setTimeout(() => goNext(), 1200);
        } catch { setEmailError('Network error. Please try again.'); }
        finally { setEmailLoading(false); }
    };

    // ─── Password step state ──────────────────────────────────────────
    const [pw, setPw] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError(''); setPwSuccess('');
        if (pw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
        if (pw !== pwConfirm) { setPwError('Passwords do not match'); return; }
        setPwLoading(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: pw }),
            });
            const data = await res.json();
            if (!res.ok) { setPwError(data.error || 'Failed to set password'); return; }
            setPwSuccess('Password set successfully!');
            refreshAccountStatus();
            setTimeout(() => goNext(), 1200);
        } catch { setPwError('Network error. Please try again.'); }
        finally { setPwLoading(false); }
    };

    // ─── Verify email step state ──────────────────────────────────────
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifySent, setVerifySent] = useState(false);
    const [verifyError, setVerifyError] = useState('');

    const handleResendVerification = async () => {
        setVerifyError('');
        setVerifyLoading(true);
        try {
            const res = await fetch('/api/auth/send-verification', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) { setVerifyError(data.error || 'Failed to send'); return; }
            setVerifySent(true);
        } catch { setVerifyError('Network error'); }
        finally { setVerifyLoading(false); }
    };

    // Poll for verification
    useEffect(() => {
        if (currentStep?.id !== 'verify') return;
        const interval = setInterval(() => {
            refreshAccountStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, [currentStep?.id, refreshAccountStatus]);

    // Auto-advance when verified
    useEffect(() => {
        if (currentStep?.id === 'verify' && emailVerified) {
            setTimeout(() => goNext(), 800);
        }
    }, [emailVerified, currentStep?.id]);

    // ─── 2FA step state ───────────────────────────────────────────────
    const [tfaStep, setTfaStep] = useState<'prompt' | 'setup' | 'verify' | 'backup'>('prompt');
    const [tfaQR, setTfaQR] = useState('');
    const [tfaSecret, setTfaSecret] = useState('');
    const [tfaCode, setTfaCode] = useState('');
    const [tfaBackupCodes, setTfaBackupCodes] = useState<string[]>([]);
    const [tfaLoading, setTfaLoading] = useState(false);
    const [tfaError, setTfaError] = useState('');

    const handleSetup2FA = async () => {
        setTfaError('');
        setTfaLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) { setTfaError(data.error || 'Failed'); return; }
            setTfaQR(data.qrCode);
            setTfaSecret(data.secret);
            setTfaStep('verify');
        } catch { setTfaError('Network error'); }
        finally { setTfaLoading(false); }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setTfaError('');
        setTfaLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/verify', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: tfaCode }),
            });
            const data = await res.json();
            if (!res.ok) { setTfaError(data.error || 'Invalid code'); return; }
            setTfaBackupCodes(data.backupCodes || []);
            setTfaStep('backup');
            refreshAccountStatus();
        } catch { setTfaError('Network error'); }
        finally { setTfaLoading(false); }
    };

    const downloadBackupCodes = () => {
        const content = `Fuji Studio — Backup Recovery Codes\n${'='.repeat(40)}\n\n${tfaBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nKeep these codes safe. Each can be used once.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'fuji-studio-backup-codes.txt';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ─── Render helpers ───────────────────────────────────────────────
    if (!user) return null;

    // All done (or skipped)
    if (activeSteps.length === 0) {
        return renderShell(
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <ShieldCheck size={48} color={colors.success} style={{ marginBottom: '16px' }} />
                <h2 style={{ color: colors.textPrimary, margin: '0 0 8px' }}>You're all set!</h2>
                <p style={{ color: colors.textSecondary, marginBottom: '24px' }}>Your account is fully configured.</p>
                <button onClick={finishSetup} style={btnPrimary}>
                    Continue to Fuji Studio <ArrowRight size={16} />
                </button>
            </div>
        );
    }

    const renderStepContent = () => {
        if (!currentStep) return null;

        switch (currentStep.id) {
            case 'email':
                return (
                    <form onSubmit={handleSetEmail}>
                        <h2 style={{ color: colors.textPrimary, margin: '0 0 6px', fontSize: '20px' }}>Add Your Email</h2>
                        <p style={{ color: colors.textSecondary, margin: '0 0 20px', fontSize: '14px', lineHeight: 1.5 }}>
                            We'll use this for account recovery and notifications. A verification link will be sent.
                        </p>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Address</label>
                        <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} required placeholder="you@example.com" style={inp} autoFocus />
                        {emailError && <StatusMsg type="error" text={emailError} />}
                        {emailSuccess && <StatusMsg type="success" text={emailSuccess} />}
                        <button type="submit" disabled={emailLoading} style={{ ...btnPrimary, marginTop: '16px', opacity: emailLoading ? 0.6 : 1 }}>
                            {emailLoading ? 'Saving...' : 'Set Email'} <ArrowRight size={16} />
                        </button>
                    </form>
                );

            case 'password':
                return (
                    <form onSubmit={handleSetPassword}>
                        <h2 style={{ color: colors.textPrimary, margin: '0 0 6px', fontSize: '20px' }}>Set a Password</h2>
                        <p style={{ color: colors.textSecondary, margin: '0 0 20px', fontSize: '14px', lineHeight: 1.5 }}>
                            Create a password so you can also sign in with email. Must be at least 8 characters.
                        </p>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Password</label>
                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} required minLength={8} placeholder="8+ characters" style={{ ...inp, paddingRight: '44px' }} autoFocus />
                            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: 0 }}>
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirm Password</label>
                        <input type={showPw ? 'text' : 'password'} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required placeholder="Confirm password" style={inp} />
                        {pwError && <StatusMsg type="error" text={pwError} />}
                        {pwSuccess && <StatusMsg type="success" text={pwSuccess} />}
                        <button type="submit" disabled={pwLoading} style={{ ...btnPrimary, marginTop: '16px', opacity: pwLoading ? 0.6 : 1 }}>
                            {pwLoading ? 'Setting...' : 'Set Password'} <ArrowRight size={16} />
                        </button>
                    </form>
                );

            case 'verify':
                return (
                    <div>
                        <h2 style={{ color: colors.textPrimary, margin: '0 0 6px', fontSize: '20px' }}>Verify Your Email</h2>
                        <p style={{ color: colors.textSecondary, margin: '0 0 20px', fontSize: '14px', lineHeight: 1.5 }}>
                            We sent a verification link to <strong style={{ color: colors.textPrimary }}>{email}</strong>. Click the link in the email to verify.
                        </p>
                        <div style={{ background: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.15)`, borderRadius: borderRadius.md, padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
                            <Mail size={32} color={colors.primary} style={{ marginBottom: '8px' }} />
                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0 }}>
                                {emailVerified ? (
                                    <span style={{ color: colors.success, fontWeight: 600 }}><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Email verified!</span>
                                ) : (
                                    'Waiting for verification...'
                                )}
                            </p>
                        </div>
                        {!emailVerified && (
                            <button onClick={handleResendVerification} disabled={verifyLoading || verifySent} style={{ ...btnSecondary, opacity: verifyLoading ? 0.6 : 1, marginBottom: '8px' }}>
                                {verifySent ? 'Verification email sent!' : verifyLoading ? 'Sending...' : 'Resend Verification Email'}
                            </button>
                        )}
                        {verifyError && <StatusMsg type="error" text={verifyError} />}
                    </div>
                );

            case 'totp':
                if (tfaStep === 'prompt') {
                    return (
                        <div>
                            <h2 style={{ color: colors.textPrimary, margin: '0 0 6px', fontSize: '20px' }}>Two-Factor Authentication</h2>
                            <p style={{ color: colors.textSecondary, margin: '0 0 20px', fontSize: '14px', lineHeight: 1.5 }}>
                                Protect your account with an authenticator app. This step is <strong style={{ color: colors.textPrimary }}>optional</strong> but recommended.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={handleSetup2FA} disabled={tfaLoading} style={{ ...btnPrimary, opacity: tfaLoading ? 0.6 : 1 }}>
                                    <Smartphone size={16} /> {tfaLoading ? 'Loading...' : 'Set Up 2FA'}
                                </button>
                                <button onClick={finishSetup} style={btnSecondary}>
                                    Skip for now
                                </button>
                            </div>
                            {tfaError && <StatusMsg type="error" text={tfaError} />}
                        </div>
                    );
                }
                if (tfaStep === 'verify') {
                    return (
                        <form onSubmit={handleVerify2FA}>
                            <h2 style={{ color: colors.textPrimary, margin: '0 0 6px', fontSize: '20px' }}>Scan QR Code</h2>
                            <p style={{ color: colors.textSecondary, margin: '0 0 16px', fontSize: '14px', lineHeight: 1.5 }}>
                                Scan this with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code.
                            </p>
                            {tfaQR && <img src={tfaQR} alt="2FA QR" style={{ display: 'block', margin: '0 auto 12px', width: '180px', height: '180px', borderRadius: '12px', background: '#fff', padding: '8px' }} />}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: borderRadius.sm, marginBottom: '16px', fontSize: '12px', color: colors.textTertiary, wordBreak: 'break-all' }}>
                                <code style={{ flex: 1 }}>{tfaSecret}</code>
                                <button type="button" onClick={() => navigator.clipboard.writeText(tfaSecret)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: '2px' }}><Copy size={14} /></button>
                            </div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Verification Code</label>
                            <input type="text" inputMode="numeric" maxLength={6} value={tfaCode} onChange={e => setTfaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required style={{ ...inp, textAlign: 'center', letterSpacing: '0.3em', fontSize: '18px' }} autoFocus />
                            {tfaError && <StatusMsg type="error" text={tfaError} />}
                            <button type="submit" disabled={tfaLoading || tfaCode.length !== 6} style={{ ...btnPrimary, marginTop: '16px', opacity: (tfaLoading || tfaCode.length !== 6) ? 0.6 : 1 }}>
                                {tfaLoading ? 'Verifying...' : 'Verify & Enable'}
                            </button>
                        </form>
                    );
                }
                if (tfaStep === 'backup') {
                    return (
                        <div>
                            <h2 style={{ color: colors.success, margin: '0 0 6px', fontSize: '20px' }}>
                                <ShieldCheck size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                2FA Enabled!
                            </h2>
                            <p style={{ color: colors.textSecondary, margin: '0 0 16px', fontSize: '14px', lineHeight: 1.5 }}>
                                Save these backup codes somewhere safe. Each code can be used once if you lose access to your authenticator app.
                            </p>
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, padding: '12px 16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                {tfaBackupCodes.map((code, i) => (
                                    <code key={i} style={{ fontSize: '13px', color: colors.textPrimary, fontFamily: 'monospace' }}>{code}</code>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <button onClick={downloadBackupCodes} style={{ ...btnSecondary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <Download size={14} /> Download
                                </button>
                                <button onClick={() => navigator.clipboard.writeText(tfaBackupCodes.join('\n'))} style={{ ...btnSecondary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <Copy size={14} /> Copy
                                </button>
                            </div>
                            <button onClick={finishSetup} style={btnPrimary}>
                                Continue to Fuji Studio <ArrowRight size={16} />
                            </button>
                        </div>
                    );
                }
                return null;
            default:
                return null;
        }
    };

    return renderShell(
        <>
            {/* Progress bar */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
                {activeSteps.map((step, i) => (
                    <div key={step.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                            width: '100%', height: '3px', borderRadius: '2px',
                            background: i < currentIdx ? colors.primary : i === currentIdx ? colors.primaryLight : 'rgba(255,255,255,0.08)',
                            transition: 'background 0.3s',
                        }} />
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', fontWeight: i === currentIdx ? 600 : 400,
                            color: i <= currentIdx ? colors.textPrimary : colors.textTertiary,
                        }}>
                            {step.icon} {step.label}
                            {!step.required && <span style={{ fontSize: '9px', color: colors.textTertiary }}>(optional)</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Step content */}
            {renderStepContent()}

            {/* Footer nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {currentIdx > 0 ? (
                    <button onClick={() => setCurrentIdx(currentIdx - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: 0 }}>
                        <ArrowLeft size={14} /> Back
                    </button>
                ) : <div />}
                {currentStep?.id !== 'totp' && (
                    <button onClick={finishSetup} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: '13px', padding: 0 }}>
                        I'll do this later
                    </button>
                )}
            </div>
        </>
    );
};

// ─── Shell layout ───────────────────────────────────────────────────────────
function renderShell(children: React.ReactNode) {
    return (
        <div style={{
            minHeight: '100vh',
            background: colors.background,
            backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(16,185,129,0.05) 0%, transparent 50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
        }}>
            <div style={{
                width: '100%', maxWidth: '460px',
                background: 'rgba(17,24,39,0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                padding: '36px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{
                        width: '40px', height: '40px',
                        background: 'rgba(16,185,129,0.08)', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(16,185,129,0.15)',
                    }}>
                        <img src={logoUrl} alt="Fuji" style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.textPrimary }}>Complete Your Account</h1>
                        <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Secure your Fuji Studio account</p>
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}

export default CompleteAccountPage;
