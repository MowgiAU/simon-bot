import React from 'react';
import { colors } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import logoUrl from '../assets/logo.svg';

export const ComingSoonPage: React.FC = () => {
    const { user, login, logout } = useAuth();

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: colors.background,
            backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
            padding: '20px',
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(16px)',
                padding: '56px 48px',
                borderRadius: '24px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                textAlign: 'center',
                maxWidth: '480px',
                width: '100%',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
                <div style={{
                    width: '96px',
                    height: '96px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 32px',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                }}>
                    <img src={logoUrl} alt="Fuji Studio" style={{ width: '60px', height: '60px', filter: 'brightness(0) invert(1)' }} />
                </div>

                <h1 style={{
                    color: colors.textPrimary,
                    fontSize: '32px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    marginBottom: '12px',
                }}>
                    Coming Soon
                </h1>

                <p style={{
                    color: colors.textSecondary,
                    fontSize: '16px',
                    lineHeight: 1.6,
                    marginBottom: '8px',
                }}>
                    Fuji Studio is currently in <strong style={{ color: colors.primary }}>Private Beta</strong>
                </p>

                <p style={{
                    color: colors.textTertiary,
                    fontSize: '14px',
                    lineHeight: 1.6,
                    marginBottom: '36px',
                    padding: '0 12px',
                }}>
                    We're building the ultimate platform for FL Studio music producers. Access is currently invite-only while we refine the experience.
                </p>

                <div style={{
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.12)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '32px',
                }}>
                    <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                        Join our <a href="https://discord.gg/flstudio" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>Discord community</a> to get updates and early access invites.
                    </p>
                </div>

                {user ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            fontSize: '14px',
                            color: colors.textSecondary,
                        }}>
                            Signed in as <strong style={{ color: colors.textPrimary }}>{user.username}</strong> — you'll be notified when you're invited.
                        </div>
                        <button
                            onClick={logout}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: colors.textSecondary,
                                border: 'none',
                                padding: '12px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={login}
                        style={{
                            background: 'linear-gradient(135deg, #10B981, #059669)',
                            color: 'white',
                            border: 'none',
                            padding: '14px 28px',
                            fontSize: '15px',
                            fontWeight: 600,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            width: '100%',
                            boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
                        }}
                    >
                        Sign In with Discord
                    </button>
                )}
            </div>
        </div>
    );
};
