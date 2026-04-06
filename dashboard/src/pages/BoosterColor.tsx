import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Sparkles, Save, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

const API = import.meta.env.VITE_API_URL || '';

interface GuildRole { id: string; name: string; color: number; }

interface Settings {
    boosterRoleId: string | null;
    colorRoleIds: string[];
}

export const BoosterColorPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [settings, setSettings] = useState<Settings>({ boosterRoleId: null, colorRoleIds: [] });
    const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newColorRoleId, setNewColorRoleId] = useState('');

    const headers = useCallback(() => ({
        'Content-Type': 'application/json',
        credentials: 'include' as const,
    }), []);

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        Promise.all([
            fetch(`${API}/api/booster-color/settings/${guildId}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`${API}/api/guilds/${guildId}/roles`, { credentials: 'include' }).then(r => r.json()),
        ]).then(([s, roles]) => {
            setSettings(s || { boosterRoleId: null, colorRoleIds: [] });
            if (Array.isArray(roles)) {
                setGuildRoles(roles.filter((r: GuildRole) => r.name !== '@everyone').sort((a: GuildRole, b: GuildRole) => b.color - a.color));
            }
        }).catch(console.error).finally(() => setLoading(false));
    }, [guildId]);

    const save = async () => {
        if (!guildId) return;
        setSaving(true);
        try {
            await fetch(`${API}/api/booster-color/settings/${guildId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const addColorRole = () => {
        if (!newColorRoleId || settings.colorRoleIds.includes(newColorRoleId)) return;
        setSettings(s => ({ ...s, colorRoleIds: [...s.colorRoleIds, newColorRoleId] }));
        setNewColorRoleId('');
    };

    const removeColorRole = (id: string) => {
        setSettings(s => ({ ...s, colorRoleIds: s.colorRoleIds.filter(r => r !== id) }));
    };

    const roleColor = (id: string) => {
        const role = guildRoles.find(r => r.id === id);
        if (!role || role.color === 0) return colors.textSecondary;
        return '#' + role.color.toString(16).padStart(6, '0');
    };

    const roleName = (id: string) => guildRoles.find(r => r.id === id)?.name ?? id;

    if (loading) return <div style={{ padding: spacing.xl, color: colors.textSecondary }}>Loading...</div>;

    return (
        <div style={{ padding: spacing.xl, maxWidth: '720px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Sparkles size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Booster Colour Roles</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Let server boosters pick an exclusive name colour. Auto-removed when they stop boosting.
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Add the Discord roles you want boosters to choose from below. Members use <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>/color</code> to pick.
                    Only one colour role can be active at a time — switching removes the old one automatically.
                    The colour role is stripped as soon as someone stops boosting.
                </p>
            </div>

            {/* Booster Role Override */}
            <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <label style={{ display: 'block', color: colors.textPrimary, fontWeight: 600, marginBottom: 8 }}>
                    Custom Booster Role <span style={{ fontWeight: 400, color: colors.textTertiary }}>(optional)</span>
                </label>
                <p style={{ margin: '0 0 10px', color: colors.textSecondary, fontSize: '13px' }}>
                    By default, the bot checks Discord's native boost status. Set this if your server uses a custom booster role instead.
                </p>
                <select
                    value={settings.boosterRoleId ?? ''}
                    onChange={e => setSettings(s => ({ ...s, boosterRoleId: e.target.value || null }))}
                    style={{
                        width: '100%', background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                        borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: '14px',
                    }}
                >
                    <option value="">— Use Discord's native boost status —</option>
                    {guildRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>

            {/* Color Roles */}
            <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <label style={{ display: 'block', color: colors.textPrimary, fontWeight: 600, marginBottom: 12 }}>
                    Available Colour Roles
                </label>

                {/* Current list */}
                {settings.colorRoleIds.length === 0 ? (
                    <p style={{ color: colors.textTertiary, fontSize: '13px', margin: '0 0 12px' }}>
                        No colour roles added yet.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {settings.colorRoleIds.map(id => (
                            <div key={id} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                                borderRadius: 20, padding: '4px 10px 4px 8px',
                            }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: roleColor(id), display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ color: colors.textPrimary, fontSize: '13px' }}>{roleName(id)}</span>
                                <button
                                    onClick={() => removeColorRole(id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: colors.textTertiary, display: 'flex' }}
                                    title="Remove"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add role */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <select
                        value={newColorRoleId}
                        onChange={e => setNewColorRoleId(e.target.value)}
                        style={{
                            flex: 1, background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                            borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: '14px',
                        }}
                    >
                        <option value="">— Select a role to add —</option>
                        {guildRoles
                            .filter(r => !settings.colorRoleIds.includes(r.id))
                            .map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                    </select>
                    <button
                        onClick={addColorRole}
                        disabled={!newColorRoleId}
                        style={{
                            background: newColorRoleId ? colors.primary : colors.surfaceLight,
                            color: newColorRoleId ? '#fff' : colors.textTertiary,
                            border: 'none', borderRadius: borderRadius.sm, padding: '8px 14px',
                            cursor: newColorRoleId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* Save */}
            <button
                onClick={save}
                disabled={saving}
                style={{
                    background: saved ? '#22c55e' : colors.primary,
                    color: '#fff', border: 'none', borderRadius: borderRadius.sm,
                    padding: '10px 24px', cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px',
                    transition: 'background 0.2s',
                }}
            >
                <Save size={16} />
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
            </button>
        </div>
    );
};
