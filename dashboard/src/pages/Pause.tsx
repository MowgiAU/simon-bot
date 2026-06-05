import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Hammer, Save, Plus, X, Check } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

const API = import.meta.env.VITE_API_URL || '';

interface GuildRole { id: string; name: string; color: number; }

const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: borderRadius.sm,
    padding: '9px 12px',
    color: colors.textPrimary,
    fontSize: '13px',
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: colors.textSecondary,
    marginBottom: '6px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};

export const PausePage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([]);
    const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [roleSearch, setRoleSearch] = useState('');
    const [newRoleId, setNewRoleId] = useState('');

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        Promise.all([
            fetch(`${API}/api/pause/settings/${guildId}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`${API}/api/guilds/${guildId}/roles`, { credentials: 'include' }).then(r => r.json()),
        ]).then(([settings, roles]) => {
            setAllowedRoleIds(settings?.allowedRoleIds ?? []);
            if (Array.isArray(roles)) setGuildRoles(roles.filter((r: GuildRole) => r.name !== '@everyone'));
        }).catch(console.error).finally(() => setLoading(false));
    }, [guildId]);

    const save = async () => {
        if (!guildId) return;
        setSaving(true);
        try {
            await fetch(`${API}/api/pause/settings/${guildId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allowedRoleIds }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const addRole = () => {
        if (!newRoleId || allowedRoleIds.includes(newRoleId)) return;
        setAllowedRoleIds(prev => [...prev, newRoleId]);
        setNewRoleId('');
    };

    const removeRole = (id: string) => setAllowedRoleIds(prev => prev.filter(r => r !== id));

    const roleName = (id: string) => guildRoles.find(r => r.id === id)?.name ?? id;
    const roleColor = (id: string) => {
        const role = guildRoles.find(r => r.id === id);
        if (!role || role.color === 0) return colors.textSecondary;
        return '#' + role.color.toString(16).padStart(6, '0');
    };

    if (loading) return <div style={{ padding: spacing.xl, color: colors.textSecondary }}>Loading...</div>;

    return (
        <div style={{ padding: '32px', maxWidth: '720px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Hammer size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Pause Command</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Configure the /pause joke moderation command</p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    <strong>/pause</strong> is a joke command — it sends a fake moderation message (<strong>ban</strong>, <strong>kick</strong>, <strong>timeout</strong>, or <strong>warn</strong>) without actually doing anything to the user.
                    Add roles below that are allowed to use this command. Server admins can always use it regardless.
                </p>
            </div>

            {/* Subcommands preview */}
            <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Command Preview</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {[
                        { sub: 'ban',     emoji: '🔨', label: '/pause ban <user> [reason]' },
                        { sub: 'kick',    emoji: '👢', label: '/pause kick <user> [reason]' },
                        { sub: 'timeout', emoji: '⏰', label: '/pause timeout <user> [reason]' },
                        { sub: 'warn',    emoji: '⚠️', label: '/pause warn <user> [reason]' },
                    ].map(({ emoji, label }) => (
                        <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.sm, padding: '8px 12px', fontSize: '12px', color: colors.textSecondary, fontFamily: 'monospace' }}>
                            {emoji} {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Allowed Roles */}
            <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <span style={labelStyle}>Allowed Roles</span>
                <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '12px' }}>
                    Only members with one of these roles (or Manage Server permission) can use /pause.
                </p>

                {/* Current roles */}
                {allowedRoleIds.length === 0 ? (
                    <p style={{ color: colors.textTertiary, fontSize: '13px', margin: '0 0 12px', fontStyle: 'italic' }}>
                        No roles set — only admins can use this command.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        {allowedRoleIds.map(id => (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.glassBorder}`, borderRadius: '20px', padding: '4px 10px 4px 8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: roleColor(id), display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ color: colors.textPrimary, fontSize: '13px' }}>{roleName(id)}</span>
                                <button onClick={() => removeRole(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: colors.textTertiary, display: 'flex' }}>
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add role */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Search roles..."
                        value={roleSearch}
                        onChange={e => setRoleSearch(e.target.value)}
                        style={{ ...inputBase, maxWidth: '320px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                            value={newRoleId}
                            onChange={e => setNewRoleId(e.target.value)}
                            style={{ ...inputBase, maxWidth: '320px', cursor: 'pointer' }}
                        >
                            <option value="">— Select a role to add —</option>
                            {guildRoles
                                .filter(r => !allowedRoleIds.includes(r.id))
                                .filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()))
                                .map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                        </select>
                        <button
                            onClick={addRole}
                            disabled={!newRoleId}
                            style={{ padding: '8px 14px', borderRadius: borderRadius.sm, backgroundColor: newRoleId ? colors.primary : 'rgba(255,255,255,0.05)', color: newRoleId ? '#fff' : colors.textTertiary, border: 'none', cursor: newRoleId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Save */}
            <button
                onClick={save}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: borderRadius.md, backgroundColor: saved ? '#F2780A' : colors.primary, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: saving ? 0.7 : 1, transition: 'background-color 0.2s' }}>
                {saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}</>}
            </button>
        </div>
    );
};
