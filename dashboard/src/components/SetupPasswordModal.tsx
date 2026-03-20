import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, X, ArrowRight } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from './AuthProvider';

/**
 * Shown once after Discord login when the user hasn't set a fallback password.
 * Can be dismissed; the account settings page (/account) is always available later.
 */
export const SetupPasswordModal: React.FC = () => {
    const { user, hasPassword, email, refreshAccountStatus } = useAuth();
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(() => {
        // Persist dismissal in sessionStorage so it doesn't re-appear on every navigation
        return sessionStorage.getItem('pw_prompt_dismissed') === '1';
    });

    // Only show to logged-in users who haven't set a password yet
    if (!user || hasPassword || dismissed || import.meta.env.DEV) return null;

    const handleDismiss = () => {
        sessionStorage.setItem('pw_prompt_dismissed', '1');
        setDismissed(true);
    };

    const handleGoToAccount = () => {
        handleDismiss();
        navigate('/account');
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: 'min(370px, calc(100vw - 32px))',
            background: colors.surface,
            border: `1px solid ${colors.primary}`,
            borderRadius: borderRadius.xl,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            padding: spacing['3xl'],
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.lg,
            animation: 'slideInUp 0.3s ease',
        }}>
            <style>{`
                @keyframes slideInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                <div style={{ width: 36, height: 36, background: `${colors.primary}20`, borderRadius: borderRadius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lock size={18} color={colors.primary} />
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: colors.textPrimary, fontSize: '15px' }}>Set a backup password</p>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px', lineHeight: 1.4 }}>
                        {email
                            ? `Keep access to your account at ${email} even if Discord is unavailable.`
                            : 'Secure your account with a password so you can always get back in.'}
                    </p>
                </div>
                <button
                    onClick={handleDismiss}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: 0, flexShrink: 0 }}
                    aria-label="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                    onClick={handleGoToAccount}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
                        padding: '10px', background: colors.primary, color: '#fff', border: 'none',
                        borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                    }}
                >
                    Set Password <ArrowRight size={14} />
                </button>
                <button
                    onClick={handleDismiss}
                    style={{
                        padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: colors.textSecondary,
                        border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, fontSize: '13px', cursor: 'pointer',
                    }}
                >
                    Later
                </button>
            </div>
        </div>
    );
};
