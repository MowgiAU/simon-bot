import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import { BarChart2, Save, RefreshCw, ToggleLeft, ToggleRight, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceStatSettingsData {
    memberChannelId: string | null;
    memberChannelEnabled: boolean;
    memberLabel: string;
    boostChannelId: string | null;
    boostChannelEnabled: boolean;
    boostLabel: string;
    artistChannelId: string | null;
    artistChannelEnabled: boolean;
    artistLabel: string;
    trackChannelId: string | null;
    trackChannelEnabled: boolean;
    trackLabel: string;
    liveArtistCount?: number;
    liveTrackCount?: number;
}

const DEFAULT_SETTINGS: VoiceStatSettingsData = {
    memberChannelId: null, memberChannelEnabled: false, memberLabel: '👥 Members: {count}',
    boostChannelId: null,  boostChannelEnabled: false,  boostLabel: '✨ Boosts: {count}',
    artistChannelId: null, artistChannelEnabled: false, artistLabel: '🎵 Artists: {count}',
    trackChannelId: null,  trackChannelEnabled: false,  trackLabel: '🎶 Tracks: {count}',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatRowProps {
    label: string;
    emoji: string;
    description: string;
    enabled: boolean;
    channelId: string | null;
    formatLabel: string;
    guildId: string;
    onChange: (patch: Partial<Pick<VoiceStatSettingsData,
        'memberChannelId' | 'memberChannelEnabled' | 'memberLabel' |
        'boostChannelId'  | 'boostChannelEnabled'  | 'boostLabel'  |
        'artistChannelId' | 'artistChannelEnabled' | 'artistLabel' |
        'trackChannelId'  | 'trackChannelEnabled'  | 'trackLabel'>>) => void;
    channelKey: string;
    enabledKey: string;
    labelKey: string;
}

const StatRow: React.FC<StatRowProps> = ({
    label, emoji, description, enabled, channelId, formatLabel, guildId,
    onChange, channelKey, enabledKey, labelKey,
}) => {
    const preview = formatLabel.replace('{count}', '1,234');

    return (
        <div style={{
            background: colors.surface,
            borderRadius: borderRadius.md,
            border: `1px solid ${enabled ? colors.primary + '33' : colors.glassBorder}`,
            padding: spacing.md,
            transition: 'border-color 0.2s',
        }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: enabled ? '16px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>{emoji}</span>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>{label}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>{description}</div>
                    </div>
                </div>
                <button
                    onClick={() => onChange({ [enabledKey]: !enabled } as any)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    title={enabled ? 'Disable' : 'Enable'}
                >
                    {enabled
                        ? <ToggleRight size={32} color={colors.primary} />
                        : <ToggleLeft size={32} color={colors.textTertiary} />}
                </button>
            </div>

            {/* Configuration (visible when enabled) */}
            {enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                            Voice Channel
                        </div>
                        <ChannelSelect
                            guildId={guildId}
                            value={channelId || ''}
                            onChange={(v) => onChange({ [channelKey]: v || null } as any)}
                            channelTypes={[2]}
                            placeholder="Select a voice channel…"
                        />
                        <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '5px' }}>
                            Create a voice channel in Discord first (you can name it anything), then select it here. The bot will rename it automatically.
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                            Label Format <span style={{ color: colors.textTertiary, fontWeight: 400, textTransform: 'none' }}>— use <code style={{ color: colors.primary }}>{'{count}'}</code> for the number</span>
                        </div>
                        <input
                            value={formatLabel}
                            onChange={(e) => onChange({ [labelKey]: e.target.value } as any)}
                            placeholder="e.g. 👥 Members: {count}"
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${colors.glassBorder}`,
                                borderRadius: borderRadius.sm,
                                padding: '9px 12px', color: colors.textPrimary,
                                fontSize: '13px', outline: 'none',
                            }}
                        />
                        <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '5px' }}>
                            Preview: <span style={{ color: colors.primary }}>{preview}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const VoiceStatsPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id || '';

    const [settings, setSettings] = useState<VoiceStatSettingsData>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        fetch(`/api/voice-stats/settings/${guildId}`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setSettings(data))
            .catch(() => showToast('error', 'Failed to load settings'))
            .finally(() => setLoading(false));
    }, [guildId]);

    const patch = (update: Partial<VoiceStatSettingsData>) => {
        setSettings(prev => ({ ...prev, ...update }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/voice-stats/settings/${guildId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error('Save failed');
            showToast('success', 'Settings saved! The bot will update channels within 10 minutes, or click Refresh Now.');
        } catch {
            showToast('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch(`/api/voice-stats/refresh/${guildId}`, {
                method: 'POST', credentials: 'include',
            });
            showToast('success', 'Refresh triggered — channels will update momentarily.');
        } catch {
            showToast('error', 'Failed to trigger refresh');
        } finally {
            setRefreshing(false);
        }
    };

    const STATS = [
        {
            label: 'Member Count', emoji: '👥',
            description: 'Live Discord server member count',
            enabled:    settings.memberChannelEnabled,
            channelId:  settings.memberChannelId,
            formatLabel:settings.memberLabel,
            channelKey: 'memberChannelId', enabledKey: 'memberChannelEnabled', labelKey: 'memberLabel',
        },
        {
            label: 'Nitro Boosts', emoji: '✨',
            description: 'Number of active server boosts',
            enabled:    settings.boostChannelEnabled,
            channelId:  settings.boostChannelId,
            formatLabel:settings.boostLabel,
            channelKey: 'boostChannelId', enabledKey: 'boostChannelEnabled', labelKey: 'boostLabel',
        },
        {
            label: 'Artists',  emoji: '🎵',
            description: `Active musician profiles — currently ${(settings.liveArtistCount ?? 0).toLocaleString()}`,
            enabled:    settings.artistChannelEnabled,
            channelId:  settings.artistChannelId,
            formatLabel:settings.artistLabel,
            channelKey: 'artistChannelId', enabledKey: 'artistChannelEnabled', labelKey: 'artistLabel',
        },
        {
            label: 'Tracks',   emoji: '🎶',
            description: `Public tracks on Fuji Studio — currently ${(settings.liveTrackCount ?? 0).toLocaleString()}`,
            enabled:    settings.trackChannelEnabled,
            channelId:  settings.trackChannelId,
            formatLabel:settings.trackLabel,
            channelKey: 'trackChannelId', enabledKey: 'trackChannelEnabled', labelKey: 'trackLabel',
        },
    ];

    return (
        <div style={{ padding: spacing.lg, maxWidth: '720px' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    background: toast.type === 'success' ? colors.success : colors.error,
                    color: '#fff', padding: '12px 18px', borderRadius: borderRadius.md,
                    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>{toast.msg}</div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <BarChart2 size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', color: colors.textPrimary }}>Voice Stat Channels</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Auto-updating unjoinable voice channels that display live server statistics
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`,
                display: 'flex', gap: '12px', alignItems: 'flex-start',
            }}>
                <Info size={16} color={colors.primary} style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: '1.5' }}>
                    Enable any stat below, select a voice channel, and the bot will automatically rename it
                    with the current count every 10 minutes. Create the channels in Discord first (any name),
                    then select them here. Members can see the channels but cannot join them.
                </p>
            </div>

            {loading ? (
                <div style={{ padding: '40px', color: colors.textSecondary, textAlign: 'center' }}>Loading…</div>
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {STATS.map(s => (
                            <StatRow
                                key={s.labelKey}
                                label={s.label}
                                emoji={s.emoji}
                                description={s.description}
                                enabled={s.enabled}
                                channelId={s.channelId}
                                formatLabel={s.formatLabel}
                                guildId={guildId}
                                onChange={patch as any}
                                channelKey={s.channelKey}
                                enabledKey={s.enabledKey}
                                labelKey={s.labelKey}
                            />
                        ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: colors.primary, border: 'none', borderRadius: borderRadius.sm,
                                padding: '10px 20px', color: '#fff', fontSize: '13px', fontWeight: 600,
                                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                            }}
                        >
                            <Save size={15} />
                            {saving ? 'Saving…' : 'Save Settings'}
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.glassBorder}`,
                                borderRadius: borderRadius.sm, padding: '10px 16px',
                                color: colors.textPrimary, fontSize: '13px', fontWeight: 500,
                                cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.7 : 1,
                            }}
                        >
                            <RefreshCw size={15} />
                            {refreshing ? 'Refreshing…' : 'Refresh Now'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
