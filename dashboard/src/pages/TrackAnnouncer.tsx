import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import { Radio, Save, ToggleLeft, ToggleRight, Loader, Swords } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

interface TrackAnnouncerSettings {
    id?: string;
    guildId: string;
    enabled: boolean;
    channelId: string | null;
    channelId2: string | null;
}

const DEFAULT: TrackAnnouncerSettings = {
    guildId: '',
    enabled: true,
    channelId: null,
    channelId2: null,
};

export default function TrackAnnouncer() {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id ?? '';

    const [settings, setSettings] = useState<TrackAnnouncerSettings>(DEFAULT);
    const [h2hChannelId, setH2hChannelId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        setError(null);
        Promise.all([
            fetch(`${API}/api/track-announcer/${guildId}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`${API}/api/head-to-head/admin/settings`, { credentials: 'include' }).then(r => r.json()),
        ])
            .then(([trackData, h2hData]) => {
                setSettings({ ...DEFAULT, ...trackData });
                setH2hChannelId(h2hData?.announcementChannelId ?? null);
                setLoading(false);
            })
            .catch(() => {
                setError('Failed to load settings.');
                setLoading(false);
            });
    }, [guildId]);

    const handleSave = async () => {
        if (!guildId) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            await Promise.all([
                fetch(`${API}/api/track-announcer/${guildId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        enabled: settings.enabled,
                        channelId: settings.channelId || null,
                        channelId2: settings.channelId2 || null,
                    }),
                }),
                fetch(`${API}/api/head-to-head/admin/settings`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ announcementChannelId: h2hChannelId || null }),
                }),
            ]);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <Loader size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Radio size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', color: colors.textPrimary }}>Announcers</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Configure Discord channels for automatic track drops, 1v1 battle events, and queue alerts.
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{
                background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))',
                border: '1px solid #3E455633',
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.lg,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, lineHeight: 1.6 }}>
                    The bot automatically posts embeds when members drop new tracks, when a 1v1 battle opens for voting,
                    when a winner is decided, and when a player is in the queue waiting for an opponent.
                </p>
            </div>

            {error && (
                <div style={{
                    background: colors.error + '22',
                    border: `1px solid ${colors.error}55`,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                    color: colors.error,
                }}>
                    {error}
                </div>
            )}

            {/* Settings Card */}
            <div style={{
                background: colors.surface,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.glassBorder}`,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
            }}>
                {/* Enable toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '15px' }}>
                            Enable Track Announcer
                        </div>
                        <div style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '4px' }}>
                            Post an embed whenever a new track is uploaded.
                        </div>
                    </div>
                    <button
                        onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        title={settings.enabled ? 'Disable' : 'Enable'}
                    >
                        {settings.enabled
                            ? <ToggleRight size={36} color={colors.primary} />
                            : <ToggleLeft size={36} color={colors.textTertiary} />}
                    </button>
                </div>

                {/* Primary channel picker */}
                <div>
                    <label style={{ display: 'block', fontWeight: 600, color: colors.textPrimary, fontSize: '15px', marginBottom: '8px' }}>
                        Announcement Channel
                    </label>
                    <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                        The text channel where new track embeds will be posted.
                    </p>
                    <ChannelSelect
                        guildId={guildId}
                        value={settings.channelId ?? ''}
                        onChange={v => setSettings(s => ({ ...s, channelId: (Array.isArray(v) ? v[0] : v) ?? null }))}
                        placeholder="Select a channel..."
                    />
                    {!settings.channelId && settings.enabled && (
                        <p style={{ margin: '8px 0 0', color: colors.warning, fontSize: '12px' }}>
                            ⚠ No channel selected — announcements will be skipped until a channel is configured.
                        </p>
                    )}
                </div>

                {/* Second channel picker (optional) */}
                <div>
                    <label style={{ display: 'block', fontWeight: 600, color: colors.textPrimary, fontSize: '15px', marginBottom: '8px' }}>
                        Second Announcement Channel <span style={{ fontWeight: 400, color: colors.textTertiary, fontSize: '13px' }}>— optional</span>
                    </label>
                    <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                        If set, announcements are posted to both channels simultaneously.
                    </p>
                    <ChannelSelect
                        guildId={guildId}
                        value={settings.channelId2 ?? ''}
                        onChange={v => setSettings(s => ({ ...s, channelId2: (Array.isArray(v) ? v[0] : v) ?? null }))}
                        placeholder="Select a second channel (optional)..."
                    />
                    {settings.channelId2 && (
                        <button
                            onClick={() => setSettings(s => ({ ...s, channelId2: null }))}
                            style={{ marginTop: '8px', background: 'none', border: 'none', color: colors.textTertiary, fontSize: '12px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                            Clear second channel
                        </button>
                    )}
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Swords size={18} color={colors.primary} />
                        <div>
                            <div style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '15px' }}>1v1 Arena Announcements</div>
                            <div style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '2px' }}>
                                Voting-open, winner, and queue-waiting embeds for Head-to-Head battles.
                            </div>
                        </div>
                    </div>
                    <label style={{ display: 'block', fontWeight: 600, color: colors.textPrimary, fontSize: '14px', marginBottom: '8px' }}>
                        Arena Announcement Channel
                    </label>
                    <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                        All 1v1 arena embeds (voting open, winner decided, looking for opponent) post here.
                    </p>
                    <ChannelSelect
                        guildId={guildId}
                        value={h2hChannelId ?? ''}
                        onChange={v => setH2hChannelId((Array.isArray(v) ? v[0] : v) ?? null)}
                        placeholder="Select a channel..."
                    />
                    {h2hChannelId && (
                        <button
                            onClick={() => setH2hChannelId(null)}
                            style={{ marginTop: '8px', background: 'none', border: 'none', color: colors.textTertiary, fontSize: '12px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                            Clear channel
                        </button>
                    )}
                </div>

                {/* Embed preview */}
                <div>
                    <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '15px', marginBottom: '12px' }}>
                        Embed Preview
                    </div>
                    <div style={{
                        background: '#2b2d31',
                        borderRadius: '8px',
                        padding: '16px',
                        borderLeft: '4px solid #2b8c71',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        maxWidth: '440px',
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: '#a3a6aa', marginBottom: '4px' }}>Artist Name</div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#00aff4', marginBottom: '4px' }}>
                                🎵 Track Title Here
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#a3a6aa' }}>Genre</div>
                                    <div style={{ fontSize: '13px', color: '#dcddde' }}>Hip Hop, Electronic</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#a3a6aa' }}>▶ Listen</div>
                                    <div style={{ fontSize: '13px', color: '#00aff4' }}>Open on Fuji Studio</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#72767d', marginTop: '8px' }}>
                                New track on Fuji Studio • Today at 3:45 PM
                            </div>
                        </div>
                        <div style={{
                            width: '80px', height: '80px',
                            borderRadius: '6px',
                            background: `linear-gradient(135deg, ${colors.primary}55, ${colors.accent}55)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '32px',
                        }}>
                            🎨
                        </div>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: colors.textTertiary }}>
                        Artwork thumbnail is shown when the track has cover art uploaded.
                    </p>
                </div>

                {/* Save */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 24px',
                            background: saved ? colors.success : colors.primary,
                            color: '#fff',
                            border: 'none',
                            borderRadius: borderRadius.md,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            fontSize: '14px',
                            opacity: saving ? 0.7 : 1,
                            transition: 'background 0.2s',
                        }}
                    >
                        {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}
