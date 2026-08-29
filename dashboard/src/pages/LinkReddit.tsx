import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { Link2, Loader, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

export const LinkRedditPage: React.FC = () => {
    const { user } = useAuth();

    const [code, setCode] = useState('');
    const [linked, setLinked] = useState<{ redditUsername: string; verifiedAt: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const load = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        try {
            const res = await fetch(`${API}/api/reddit/link/me`, { credentials: 'include' });
            const data = await res.json();
            if (res.ok) setLinked(data.link);
        } catch {
            // A failed status read shouldn't block someone from redeeming a code.
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    const redeem = async () => {
        setSubmitting(true);
        setMsg(null);
        try {
            const res = await fetch(`${API}/api/reddit/link/redeem`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not link that account');
            setMsg({ type: 'success', text: `Linked to u/${data.redditUsername}.` });
            setCode('');
            await load();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.message || 'Could not link that account' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader className="spin" /></div>;
    }

    return (
        <div style={{ padding: spacing.lg, maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Link2 size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Link your Reddit account</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Connect your Reddit identity to Fuji Studio
                    </p>
                </div>
            </div>

            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    In the subreddit, open the moderator menu and choose <strong>Link my Fuji Studio account</strong>.
                    Reddit will show you a short code — paste it below within 15 minutes. We only ever store your
                    Reddit username; no Reddit password or token is involved.
                </p>
            </div>

            {!user ? (
                <p style={{ color: colors.textSecondary }}>Sign in to Fuji Studio first, then come back to this page.</p>
            ) : linked ? (
                <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md }}>
                    <p style={{ margin: 0, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={18} color={colors.success} />
                        Linked to <strong>u/{linked.redditUsername}</strong>
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        Redeeming a new code replaces this link.
                    </p>
                </div>
            ) : null}

            {user && (
                <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.md }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                        Your code
                    </label>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="ABC123"
                        maxLength={12}
                        style={{
                            width: '100%', padding: '11px 14px', borderRadius: borderRadius.sm,
                            border: `1px solid ${colors.border}`, backgroundColor: colors.background,
                            color: colors.textPrimary, fontSize: '18px', letterSpacing: '3px',
                            fontFamily: 'monospace', boxSizing: 'border-box',
                        }}
                    />

                    {msg && (
                        <div style={{
                            marginTop: spacing.md, padding: '10px 14px', borderRadius: borderRadius.sm,
                            backgroundColor: msg.type === 'success' ? `${colors.success}22` : `${colors.error}22`,
                            color: msg.type === 'success' ? colors.success : colors.error, fontSize: '13px',
                        }}>
                            {msg.text}
                        </div>
                    )}

                    <button
                        onClick={redeem}
                        disabled={submitting || code.trim().length < 4}
                        style={{
                            marginTop: spacing.md, width: '100%', padding: '11px',
                            borderRadius: borderRadius.sm, border: 'none',
                            backgroundColor: colors.primary, color: '#fff',
                            fontSize: '14px', fontWeight: 600,
                            cursor: submitting || code.trim().length < 4 ? 'not-allowed' : 'pointer',
                            opacity: submitting || code.trim().length < 4 ? 0.6 : 1,
                        }}
                    >
                        {submitting ? 'Linking…' : 'Link account'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default LinkRedditPage;
