import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Trash2, MessageSquareWarning, Hash, Users } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { ChannelSelect } from '../components/ChannelSelect';

interface AEFSettings {
    enabled: boolean;
    deleteMessage: boolean;
    warnUser: boolean;
    exemptRoleIds: string[];
    exemptChannelIds: string[];
    logChannelId: string;
}

interface Role {
    id: string;
    name: string;
    color: string;
}

const defaultSettings: AEFSettings = {
    enabled: true,
    deleteMessage: true,
    warnUser: true,
    exemptRoleIds: [],
    exemptChannelIds: [],
    logChannelId: '',
};

const toggle: React.CSSProperties = {
    position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={toggle}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
            <span style={{
                position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: borderRadius.pill,
                backgroundColor: checked ? colors.success : colors.secondary,
                transition: '0.2s',
            }}>
                <span style={{
                    position: 'absolute', height: '18px', width: '18px', left: checked ? '23px' : '3px',
                    bottom: '3px', borderRadius: '50%', backgroundColor: '#fff', transition: '0.2s',
                }} />
            </span>
        </label>
    );
}

function ToggleRow({ label, description, checked, onChange }: {
    label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.md} 0` }}>
            <div>
                <div style={{ fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '13px', color: colors.textSecondary }}>{description}</div>
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
    );
}

export const AntiExternalForwardPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [settings, setSettings] = useState<AEFSettings>(defaultSettings);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const load = useCallback(async () => {
        if (!guildId) return;
        setLoading(true);
        try {
            const [settingsRes, rolesRes] = await Promise.all([
                fetch(`/api/anti-external-forward/${guildId}`, { credentials: 'include' }),
                fetch(`/api/roles/${guildId}`, { credentials: 'include' }),
            ]);
            if (settingsRes.ok) setSettings(await settingsRes.json());
            if (rolesRes.ok) setRoles(await rolesRes.json());
        } catch {
            setStatus({ type: 'error', message: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!guildId) return;
        setSaving(true);
        setStatus(null);
        try {
            const res = await fetch(`/api/anti-external-forward/${guildId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error();
            setStatus({ type: 'success', message: 'Settings saved!' });
        } catch {
            setStatus({ type: 'error', message: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const patch = (p: Partial<AEFSettings>) => setSettings(s => ({ ...s, ...p }));

    const toggleRole = (id: string) => {
        patch({
            exemptRoleIds: settings.exemptRoleIds.includes(id)
                ? settings.exemptRoleIds.filter(r => r !== id)
                : [...settings.exemptRoleIds, id],
        });
    };

    const toggleChannel = (id: string) => {
        patch({
            exemptChannelIds: settings.exemptChannelIds.includes(id)
                ? settings.exemptChannelIds.filter(c => c !== id)
                : [...settings.exemptChannelIds, id],
        });
    };

    const card: React.CSSProperties = {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.xxl,
        marginBottom: spacing.xxl,
        border: `1px solid ${colors.border}`,
    };

    const sectionTitle = (text: string) => (
        <h3 style={{ margin: `0 0 ${spacing.lg} 0`, fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>{text}</h3>
    );

    if (loading) return <div style={{ padding: spacing.xxl, color: colors.textSecondary }}>Loading...</div>;

    return (
        <div style={{ padding: spacing.xxl, maxWidth: '800px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xxl }}>
                <ShieldAlert size={32} color={colors.primary} style={{ marginRight: spacing.lg }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.textPrimary }}>Anti-External Forward</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Block forwarded messages from other servers.</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.xxl, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    When enabled, any message forwarded from another server (or a DM) is automatically deleted.
                    Internal forwards (within this server) are always allowed.
                </p>
            </div>

            {/* Enable / disable */}
            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: colors.textPrimary }}>Plugin Enabled</div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '2px' }}>Turn on monitoring for external forwards.</div>
                    </div>
                    <Toggle checked={settings.enabled} onChange={v => patch({ enabled: v })} />
                </div>
            </div>

            {/* Enforcement */}
            <div style={card}>
                {sectionTitle('Enforcement Actions')}
                <div style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <ToggleRow
                        label="Delete Message"
                        description="Automatically remove the forwarded content."
                        checked={settings.deleteMessage}
                        onChange={v => patch({ deleteMessage: v })}
                    />
                </div>
                <ToggleRow
                    label="Warn User"
                    description="Send a temporary warning message in the channel (auto-deletes after 5s)."
                    checked={settings.warnUser}
                    onChange={v => patch({ warnUser: v })}
                />
            </div>

            {/* Exempt Roles */}
            <div style={card}>
                {sectionTitle('Exempt Roles')}
                <p style={{ margin: `0 0 ${spacing.lg} 0`, fontSize: '13px', color: colors.textSecondary }}>
                    Members with any of these roles can forward freely.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                    {roles.filter(r => r.name !== '@everyone').map(r => {
                        const selected = settings.exemptRoleIds.includes(r.id);
                        return (
                            <button key={r.id} onClick={() => toggleRole(r.id)} style={{
                                padding: '5px 12px', borderRadius: borderRadius.pill, fontSize: '13px', cursor: 'pointer',
                                border: `1px solid ${selected ? colors.primary : colors.border}`,
                                backgroundColor: selected ? `${colors.primary}22` : colors.background,
                                color: selected ? colors.primary : colors.textSecondary,
                                transition: '0.15s',
                            }}>
                                {r.name}
                            </button>
                        );
                    })}
                    {roles.filter(r => r.name !== '@everyone').length === 0 && (
                        <span style={{ color: colors.textTertiary, fontSize: '13px' }}>No roles found.</span>
                    )}
                </div>
                {settings.exemptRoleIds.length > 0 && (
                    <div style={{ marginTop: spacing.md, fontSize: '13px', color: colors.textSecondary }}>
                        {settings.exemptRoleIds.length} role{settings.exemptRoleIds.length > 1 ? 's' : ''} exempt
                        <button onClick={() => patch({ exemptRoleIds: [] })} style={{
                            marginLeft: spacing.sm, background: 'none', border: 'none',
                            color: colors.error, cursor: 'pointer', fontSize: '12px',
                        }}>Clear</button>
                    </div>
                )}
            </div>

            {/* Exempt Channels */}
            <div style={card}>
                {sectionTitle('Exempt Channels')}
                <p style={{ margin: `0 0 ${spacing.lg} 0`, fontSize: '13px', color: colors.textSecondary }}>
                    External forwarding is allowed in these channels.
                </p>
                <ChannelSelect
                    guildId={guildId || ''}
                    value={settings.exemptChannelIds[0] || ''}
                    onChange={() => {}}
                    placeholder="Select channels..."
                />
                <p style={{ margin: `${spacing.sm} 0 ${spacing.md} 0`, fontSize: '12px', color: colors.textTertiary }}>
                    Click channels below to toggle exemption:
                </p>
                <div id="aef-exempt-channels-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                    {/* Channel pills rendered via ChannelToggle below */}
                </div>
                <AEFChannelPills
                    guildId={guildId || ''}
                    selected={settings.exemptChannelIds}
                    onToggle={toggleChannel}
                    onClear={() => patch({ exemptChannelIds: [] })}
                />
            </div>

            {/* Log Channel */}
            <div style={card}>
                {sectionTitle('Audit Log Channel')}
                <p style={{ margin: `0 0 ${spacing.md} 0`, fontSize: '13px', color: colors.textSecondary }}>
                    Log blocked forward attempts to a channel.
                </p>
                <ChannelSelect
                    guildId={guildId || ''}
                    value={settings.logChannelId}
                    onChange={v => patch({ logChannelId: v })}
                    placeholder="No logging"
                />
            </div>

            {/* Status */}
            {status && (
                <div style={{
                    padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg,
                    backgroundColor: status.type === 'success' ? `${colors.success}22` : `${colors.error}22`,
                    border: `1px solid ${status.type === 'success' ? colors.success : colors.error}`,
                    color: status.type === 'success' ? colors.success : colors.error,
                    fontSize: '14px',
                }}>
                    {status.message}
                </div>
            )}

            {/* Save */}
            <button onClick={save} disabled={saving} style={{
                backgroundColor: colors.primary, color: '#fff', border: 'none',
                padding: `${spacing.md} ${spacing.xxl}`, borderRadius: borderRadius.md,
                fontWeight: 600, fontSize: '15px', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1, transition: '0.15s',
            }}>
                {saving ? 'Saving...' : 'Save Settings'}
            </button>
        </div>
    );
};

// Separate component to load + display channel pills with toggle behaviour
function AEFChannelPills({ guildId, selected, onToggle, onClear }: {
    guildId: string;
    selected: string[];
    onToggle: (id: string) => void;
    onClear: () => void;
}) {
    const [channels, setChannels] = useState<{ id: string; name: string; type: number }[]>([]);

    useEffect(() => {
        if (!guildId) return;
        fetch(`/api/channels/${guildId}`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setChannels(Array.isArray(data) ? data.filter((c: any) => c.type === 0 || c.type === 5) : []))
            .catch(() => {});
    }, [guildId]);

    return (
        <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {channels.map(c => {
                    const isSelected = selected.includes(c.id);
                    return (
                        <button key={c.id} onClick={() => onToggle(c.id)} style={{
                            padding: '4px 10px', borderRadius: borderRadius.pill, fontSize: '13px', cursor: 'pointer',
                            border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                            backgroundColor: isSelected ? `${colors.primary}22` : colors.background,
                            color: isSelected ? colors.primary : colors.textSecondary,
                            transition: '0.15s',
                        }}>
                            # {c.name}
                        </button>
                    );
                })}
            </div>
            {selected.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: colors.textSecondary }}>
                    {selected.length} channel{selected.length > 1 ? 's' : ''} exempt
                    <button onClick={onClear} style={{
                        marginLeft: '8px', background: 'none', border: 'none',
                        color: colors.error, cursor: 'pointer', fontSize: '12px',
                    }}>Clear</button>
                </div>
            )}
        </>
    );
}
