import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Ban, X } from 'lucide-react';
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

// Minimal free-text list editor (raw Discord IDs, or literal command prefixes)
const TextIdList: React.FC<{ label: string; help: string; placeholder: string; value: string[]; onChange: (v: string[]) => void }> = ({ label, help, placeholder, value, onChange }) => {
    const [draft, setDraft] = useState('');

    const add = () => {
        const v = draft.trim();
        if (!v || value.includes(v)) { setDraft(''); return; }
        onChange([...value, v]);
        setDraft('');
    };

    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <p style={helpStyle}>{help}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                    placeholder={placeholder}
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
                    {value.map(v => (
                        <div key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: colors.surface, borderRadius: '999px', fontSize: '13px', border: `1px solid ${colors.border}` }}>
                            <span style={{ fontFamily: 'monospace' }}>{v}</span>
                            <X size={12} style={{ cursor: 'pointer', color: colors.textSecondary }} onClick={() => onChange(value.filter(x => x !== v))} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const defaultSettings = {
    enabled: false,
    guardedChannelIds: [] as string[],
    whitelistedBotIds: [] as string[],
    whitelistedCommandPrefixes: [] as string[],
    deleteMessage: true,
    warnUser: true,
    logChannelId: '',
};

export const CommandGuardPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const isMobile = useMobile();
    const [settings, setSettings] = useState(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!selectedGuild) return;
        setLoading(true);
        axios.get(`/api/command-guard/${selectedGuild.id}`, { withCredentials: true })
            .then(r => setSettings({ ...defaultSettings, ...r.data }))
            .catch(() => showToast('Failed to load settings', 'error'))
            .finally(() => setLoading(false));
    }, [selectedGuild?.id]);

    const save = async () => {
        if (!selectedGuild) return;
        setSaving(true);
        try {
            await axios.post(`/api/command-guard/${selectedGuild.id}`, settings, { withCredentials: true });
            showToast('Settings saved', 'success');
        } catch (e: any) {
            showToast(e?.response?.data?.error ?? 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof typeof defaultSettings, value: any) =>
        setSettings(prev => ({ ...prev, [key]: value }));

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Ban size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: isMobile ? '22px' : '28px' }}>Command Guard</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Lock channels down to Fuji-only commands</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    In the channels you select below, Fuji deletes messages from other bots and human-typed prefix commands (e.g. <code>!play</code>, <code>.skip</code>). Whitelist trusted bots or specific command prefixes to let them through. Note: other bots' <em>slash</em> commands can't be intercepted this way — block those via Discord's Integrations permissions for the channel.
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
                        label="Enable Command Guard"
                        help="Turn the whole feature on or off without losing your settings"
                    />

                    {/* Guarded channels */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <label style={labelStyle}>Guarded Channels</label>
                        <ChannelSelect
                            guildId={selectedGuild?.id || ''}
                            value={settings.guardedChannelIds}
                            onChange={v => set('guardedChannelIds', Array.isArray(v) ? v : [v])}
                            channelTypes={[0]}
                            multiple
                            placeholder="Select channels to lock down…"
                        />
                        <p style={helpStyle}>Other bots' messages and typed prefix commands are deleted in these channels.</p>
                    </div>

                    {/* Enforcement */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md, display: 'grid', gap: '4px' }}>
                        <Toggle
                            checked={settings.deleteMessage}
                            onChange={v => set('deleteMessage', v)}
                            label="Delete Message"
                            help="Automatically remove the offending message."
                        />
                        <Toggle
                            checked={settings.warnUser}
                            onChange={v => set('warnUser', v)}
                            label="Warn User"
                            help="Send a temporary warning to a human who typed a command (auto-deletes after 6s)."
                        />
                    </div>

                    {/* Whitelisted bots */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <TextIdList
                            label="Whitelisted Bots"
                            help="Messages from these bot user IDs are never deleted, even in guarded channels."
                            placeholder="Paste a bot's Discord user ID…"
                            value={settings.whitelistedBotIds}
                            onChange={v => set('whitelistedBotIds', v)}
                        />
                    </div>

                    {/* Whitelisted command prefixes */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <TextIdList
                            label="Whitelisted Command Prefixes"
                            help="Human-typed messages starting with any of these are allowed even though they look like a command (e.g. !poll)."
                            placeholder="e.g. !poll"
                            value={settings.whitelistedCommandPrefixes}
                            onChange={v => set('whitelistedCommandPrefixes', v)}
                        />
                    </div>

                    {/* Log channel */}
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: borderRadius.md }}>
                        <label style={labelStyle}>Audit Log Channel</label>
                        <ChannelSelect
                            guildId={selectedGuild?.id || ''}
                            value={settings.logChannelId}
                            onChange={v => set('logChannelId', Array.isArray(v) ? (v[0] || '') : v)}
                            channelTypes={[0]}
                            placeholder="No logging"
                        />
                        <p style={helpStyle}>Log every blocked message here.</p>
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
