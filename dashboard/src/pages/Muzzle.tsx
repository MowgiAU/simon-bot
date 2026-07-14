import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { RoleSelect } from '../components/RoleSelect';
import { ChannelSelect } from '../components/ChannelSelect';
import { VolumeX, Save, ToggleLeft, ToggleRight, Info } from 'lucide-react';

interface MuzzlePageProps { guildId: string; }

const API = import.meta.env.VITE_API_URL || '';

const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 6, fontSize: '0.85rem',
    color: colors.textSecondary, fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: `1px solid rgba(255,255,255,0.1)`,
    borderRadius: borderRadius.md, color: 'white',
    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
};

export const MuzzlePage: React.FC<MuzzlePageProps> = ({ guildId }) => {
    const [enabled, setEnabled]                     = useState(false);
    const [messageLimit, setMessageLimit]           = useState(5);
    const [windowSeconds, setWindowSeconds]         = useState(5);
    const [muzzleDuration, setMuzzleDuration]       = useState(10);
    const [muzzleRoleId, setMuzzleRoleId]           = useState('');
    const [logChannelId, setLogChannelId]           = useState('');
    const [exemptRoleIds, setExemptRoleIds]         = useState<string[]>([]);
    const [loading, setLoading]                     = useState(true);
    const [saving, setSaving]                       = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        axios.get(`${API}/api/muzzle/settings/${guildId}`, { withCredentials: true })
            .then(r => {
                const d = r.data;
                setEnabled(d.enabled ?? false);
                setMessageLimit(d.messageLimit ?? 5);
                setWindowSeconds(d.windowSeconds ?? 5);
                setMuzzleDuration(d.muzzleDurationMinutes ?? 10);
                setMuzzleRoleId(d.muzzleRoleId ?? '');
                setLogChannelId(d.logChannelId ?? '');
                setExemptRoleIds(d.exemptRoleIds ?? []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [guildId]);

    const save = async () => {
        setSaving(true);
        setMsg(null);
        try {
            await axios.put(`${API}/api/muzzle/settings/${guildId}`, {
                enabled, messageLimit, windowSeconds,
                muzzleDurationMinutes: muzzleDuration,
                muzzleRoleId: muzzleRoleId || null,
                logChannelId: logChannelId || null,
                exemptRoleIds,
            }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Settings saved!' });
            setTimeout(() => setMsg(null), 3000);
        } catch {
            setMsg({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const card: React.CSSProperties = {
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    };

    if (loading) return <div style={{ padding: spacing.lg, color: colors.textSecondary }}>Loading…</div>;

    return (
        <div style={{ maxWidth: 720 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                <VolumeX size={32} color={colors.primary} style={{ marginRight: 16 }} />
                <div>
                    <h1 style={{ margin: 0 }}>Muzzle</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Automatically assign a muzzle role to users who spam messages.</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ ...card, borderLeft: `4px solid ${colors.primary}`, marginBottom: spacing.lg }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: 14, lineHeight: 1.6 }}>
                    When a user sends more than <strong>{messageLimit} messages</strong> within <strong>{windowSeconds} seconds</strong>,
                    they are timed out for <strong>{muzzleDuration} minute{muzzleDuration !== 1 ? 's' : ''}</strong> — Discord's native
                    timeout blocks them from sending messages, reacting, and speaking server-wide. The Muzzle role is also applied as a
                    visible marker. Both are removed automatically after the duration expires.
                </p>
            </div>

            {/* Enable toggle */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, color: colors.textPrimary }}>Enable Muzzle</p>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: colors.textSecondary }}>
                            {enabled ? 'Muzzle is active and monitoring messages.' : 'Muzzle is currently disabled.'}
                        </p>
                    </div>
                    <button onClick={() => setEnabled(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {enabled
                            ? <ToggleRight size={40} color={colors.primary} />
                            : <ToggleLeft size={40} color={colors.textTertiary} />
                        }
                    </button>
                </div>
            </div>

            {/* Thresholds */}
            <div style={card}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, color: colors.textPrimary }}>Trigger Thresholds</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <div>
                        <label style={labelStyle}>Messages</label>
                        <input
                            type="number" min={2} max={50} value={messageLimit}
                            onChange={e => setMessageLimit(Math.max(2, parseInt(e.target.value) || 2))}
                            style={inputStyle}
                        />
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: colors.textTertiary }}>Messages sent before muzzle triggers</p>
                    </div>
                    <div>
                        <label style={labelStyle}>Time Window (seconds)</label>
                        <input
                            type="number" min={1} max={60} value={windowSeconds}
                            onChange={e => setWindowSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                            style={inputStyle}
                        />
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: colors.textTertiary }}>Sliding window to count messages in</p>
                    </div>
                    <div>
                        <label style={labelStyle}>Muzzle Duration (minutes)</label>
                        <input
                            type="number" min={1} max={1440} value={muzzleDuration}
                            onChange={e => setMuzzleDuration(Math.max(1, parseInt(e.target.value) || 1))}
                            style={inputStyle}
                        />
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: colors.textTertiary }}>How long the muzzle role is held</p>
                    </div>
                </div>
            </div>

            {/* Role & channel */}
            <div style={card}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, color: colors.textPrimary }}>Configuration</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <label style={labelStyle}>Muzzle Role <span style={{ fontWeight: 400, color: colors.textTertiary }}>(optional)</span></label>
                        <RoleSelect
                            guildId={guildId}
                            value={muzzleRoleId}
                            onChange={v => setMuzzleRoleId(v as string)}
                            placeholder="Select a marker role to apply…"
                        />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: borderRadius.sm }}>
                            <Info size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0, fontSize: 12, color: '#F59E0B', lineHeight: 1.5 }}>
                                Silencing is handled by Discord's timeout, so a role is not required — the bot just needs the
                                <strong> Moderate Members</strong> permission. Optionally pick a <strong>Muzzle</strong> role as a
                                visible marker; if you do, keep it below the bot's role in the hierarchy.
                            </p>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Exempt Roles <span style={{ fontWeight: 400, color: colors.textTertiary }}>(optional)</span></label>
                        <RoleSelect
                            guildId={guildId}
                            value={exemptRoleIds}
                            onChange={v => setExemptRoleIds(Array.isArray(v) ? v : [v as string])}
                            placeholder="Select roles that are never muzzled…"
                            multiple
                        />
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: colors.textTertiary }}>
                            Users with any of these roles are immune to the muzzle (e.g. Mods, VIPs).
                        </p>
                    </div>
                    <div>
                        <label style={labelStyle}>Log Channel <span style={{ fontWeight: 400, color: colors.textTertiary }}>(optional)</span></label>
                        <ChannelSelect
                            guildId={guildId}
                            value={logChannelId}
                            onChange={v => setLogChannelId(v as string)}
                            placeholder="Select a channel for muzzle logs…"
                        />
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: colors.textTertiary }}>
                            When set, an embed is posted here each time a user is muzzled.
                        </p>
                    </div>
                </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                    <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {msg && <span style={{ fontSize: 13, color: msg.type === 'success' ? colors.success : colors.error }}>{msg.text}</span>}
            </div>
        </div>
    );
};
