import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Repeat, Search, X } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { ChannelSelect } from '../components/ChannelSelect';
import { showToast } from '../components/Toast';
import { useMobile } from '../hooks/useMobile';

const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: colors.background,
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
    borderRadius: borderRadius.sm,
    width: '100%',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '14px',
};

const helpStyle: React.CSSProperties = {
    fontSize: '12px',
    color: colors.textSecondary,
    marginTop: '4px',
};

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }> = ({ checked, onChange, label, help }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 16px', background: colors.surface, borderRadius: borderRadius.md, gap: '16px' }}>
        <div>
            <div style={{ fontWeight: 600 }}>{label}</div>
            {help && <div style={helpStyle}>{help}</div>}
        </div>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
    </div>
);

// Minimal user-ID list editor (no search — users paste raw Discord IDs)
const UserIdList: React.FC<{ label: string; help: string; value: string[]; onChange: (v: string[]) => void }> = ({ label, help, value, onChange }) => {
    const [draft, setDraft] = useState('');

    const add = () => {
        const id = draft.trim();
        if (!id || value.includes(id)) { setDraft(''); return; }
        onChange([...value, id]);
        setDraft('');
    };

    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <p style={helpStyle}>{help}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                    placeholder="Paste Discord user ID…"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && add()}
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={add} style={{ padding: '8px 14px', background: colors.primary, border: 'none', color: colors.textPrimary, borderRadius: borderRadius.sm, cursor: 'pointer' }}>
                    Add
                </button>
            </div>
            {value.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {value.map(id => (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: colors.surface, borderRadius: '999px', fontSize: '13px', border: `1px solid ${colors.border}` }}>
                            <span style={{ fontFamily: 'monospace' }}>{id}</span>
                            <X size={12} style={{ cursor: 'pointer', color: colors.textSecondary }} onClick={() => onChange(value.filter(v => v !== id))} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const defaultSettings = {
    enabled: false,
    impersonateUser: true,
    triggerChance: 10,
    minDelaySeconds: 300,
    maxDelaySeconds: 1800,
    lookbackMessages: 50,
    channelIds: [] as string[],
    blacklistUserIds: [] as string[],
    whitelistUserIds: [] as string[],
};

export const EchoPluginPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const isMobile = useMobile();
    const [settings, setSettings] = useState(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!selectedGuild) return;
        setLoading(true);
        axios.get(`/api/echo/settings/${selectedGuild.id}`, { withCredentials: true })
            .then(r => setSettings({ ...defaultSettings, ...r.data }))
            .catch(() => showToast('Failed to load settings', 'error'))
            .finally(() => setLoading(false));
    }, [selectedGuild?.id]);

    const save = async () => {
        if (!selectedGuild) return;
        if (settings.minDelaySeconds > settings.maxDelaySeconds) {
            showToast('Min delay cannot exceed max delay', 'error');
            return;
        }
        setSaving(true);
        try {
            await axios.post(`/api/echo/settings/${selectedGuild.id}`, settings, { withCredentials: true });
            showToast('Settings saved', 'success');
        } catch (e: any) {
            showToast(e?.response?.data?.error ?? 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof typeof defaultSettings, value: any) =>
        setSettings(prev => ({ ...prev, [key]: value }));

    const fmtDelay = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Repeat size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: isMobile ? '22px' : '28px' }}>Message Echo</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Randomly re-posts a recent message in the same channel after a delay</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Each time a message is sent in a watched channel, there is a configurable chance the bot quietly picks a random recent message and schedules it to be re-posted after a random delay — either as itself or impersonating the original author via webhook.
                </p>
            </div>

            {loading ? (
                <div style={{ color: colors.textSecondary }}>Loading…</div>
            ) : (
                <div style={{ display: 'grid', gap: '20px' }}>

                    {/* Master toggle */}
                    <Toggle
                        checked={settings.enabled}
                        onChange={v => set('enabled', v)}
                        label="Enable Message Echo"
                        help="Turn the whole feature on or off without losing your settings"
                    />

                    {/* Impersonate toggle */}
                    <Toggle
                        checked={settings.impersonateUser}
                        onChange={v => set('impersonateUser', v)}
                        label="Impersonate Original Author"
                        help="Uses a webhook to post as the original author (name + avatar). When off, the bot posts the message itself."
                    />

                    {/* Trigger chance */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <label style={labelStyle}>
                            Trigger Chance — <span style={{ color: colors.primary }}>{settings.triggerChance}%</span>
                        </label>
                        <input
                            type="range" min={1} max={100} value={settings.triggerChance}
                            onChange={e => set('triggerChance', Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                        <p style={helpStyle}>Probability that any given message causes an echo to be scheduled. At 10% roughly 1 in 10 messages will trigger one.</p>
                    </div>

                    {/* Delay range */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <label style={{ ...labelStyle, marginBottom: '12px' }}>
                            Delay Range — <span style={{ color: colors.primary }}>{fmtDelay(settings.minDelaySeconds)}</span> to <span style={{ color: colors.primary }}>{fmtDelay(settings.maxDelaySeconds)}</span>
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ ...labelStyle, fontWeight: 400 }}>Min delay (seconds)</label>
                                <input
                                    type="number" min={0} value={settings.minDelaySeconds}
                                    onChange={e => set('minDelaySeconds', Math.max(0, Math.trunc(Number(e.target.value))))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontWeight: 400 }}>Max delay (seconds)</label>
                                <input
                                    type="number" min={0} value={settings.maxDelaySeconds}
                                    onChange={e => set('maxDelaySeconds', Math.max(0, Math.trunc(Number(e.target.value))))}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <p style={helpStyle}>The bot will wait a random duration between these two values before posting the echo. 300 = 5 min, 3600 = 1 hr.</p>
                    </div>

                    {/* Lookback */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <label style={labelStyle}>
                            Lookback Messages — <span style={{ color: colors.primary }}>{settings.lookbackMessages}</span>
                        </label>
                        <input
                            type="range" min={1} max={100} value={settings.lookbackMessages}
                            onChange={e => set('lookbackMessages', Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                        <p style={helpStyle}>How many recent messages to draw from when choosing what to echo. Higher = more variety, lower = more recent context.</p>
                    </div>

                    {/* Channel filter */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <label style={labelStyle}>Channels to Watch</label>
                        <ChannelSelect
                            guildId={selectedGuild?.id || ''}
                            value={settings.channelIds}
                            onChange={v => set('channelIds', Array.isArray(v) ? v : [v])}
                            channelTypes={[0]}
                            multiple
                            placeholder="Leave empty to watch all text channels…"
                        />
                        <p style={helpStyle}>Leave empty to watch every text channel. Select specific channels to restrict where echoes can fire.</p>
                    </div>

                    {/* User lists */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <UserIdList
                            label="Whitelist Users"
                            help="If any IDs are added here, only messages from these users will be eligible for echoing."
                            value={settings.whitelistUserIds}
                            onChange={v => set('whitelistUserIds', v)}
                        />
                    </div>

                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <UserIdList
                            label="Blacklist Users"
                            help="Messages from these users will never be echoed, even if they pass other filters."
                            value={settings.blacklistUserIds}
                            onChange={v => set('blacklistUserIds', v)}
                        />
                    </div>

                    {/* Save */}
                    <button
                        onClick={save}
                        disabled={saving}
                        style={{
                            padding: '12px 24px', background: colors.primary, border: 'none',
                            color: colors.textPrimary, borderRadius: borderRadius.sm,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            fontWeight: 600, fontSize: '15px',
                            width: isMobile ? '100%' : 'auto',
                        }}
                    >
                        {saving ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>
            )}
        </div>
    );
};
