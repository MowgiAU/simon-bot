import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { Shield, Save, Check, X, AlertTriangle } from 'lucide-react';

interface ModerationSettings {
    id: string;
    guildId: string;
    logChannelId: string | null;
    dmUponAction: boolean;
    permissions: Permission[];
}

interface Permission {
    id: string;
    roleId: string;
    canWarn: boolean;
    canKick: boolean;
    canBan: boolean;
    canTimeout: boolean;
    canPurge: boolean;
    canViewLogs: boolean;
}

interface Role {
    id: string;
    name: string;
    color: number;
}

interface Channel {
    id: string;
    name: string;
}

export const ModerationSettingsPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [settings, setSettings] = useState<ModerationSettings | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Initial Fetch
    useEffect(() => {
        if (!selectedGuild) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                // Parallel fetch
                const [settingsRes, rolesRes, channelsRes] = await Promise.all([
                    axios.get(`/api/guilds/${selectedGuild.id}/moderation`, { withCredentials: true }),
                    axios.get(`/api/guilds/${selectedGuild.id}/roles`, { withCredentials: true }),
                    axios.get(`/api/guilds/${selectedGuild.id}/channels`, { withCredentials: true })
                ]);

                setSettings(settingsRes.data);
                
                // Filter roles (exclude @everyone usually, but maybe keep it for basic perms?)
                // Discord API returns roles sorted by position usually.
                setRoles(rolesRes.data.sort((a: any, b: any) => b.position - a.position));
                setChannels(channelsRes.data);
            } catch (err) {
                console.error(err);
                setMsg({ type: 'error', text: 'Failed to load settings' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedGuild]);

    const saveGeneral = async () => {
        if (!settings || !selectedGuild) return;
        setSaving(true);
        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/moderation`, {
                logChannelId: settings.logChannelId === '' ? null : settings.logChannelId,
                dmUponAction: settings.dmUponAction
            }, { withCredentials: true });
            
            setMsg({ type: 'success', text: 'General settings saved.' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const togglePermission = async (roleId: string, perm: keyof Permission) => {
        if (!selectedGuild) return;
        
        // Optimistic update
        const currentPerms = settings?.permissions.find(p => p.roleId === roleId);
        const newValue = currentPerms ? !currentPerms[perm] : true;
        
        // Clone state for UI update
        const newSettings = { ...settings! };
        const permIndex = newSettings.permissions.findIndex(p => p.roleId === roleId);
        
        if (permIndex >= 0) {
            (newSettings.permissions[permIndex] as any)[perm] = newValue;
        } else {
            // New permission entry
            newSettings.permissions.push({
                id: 'temp',
                roleId,
                canWarn: false, canKick: false, canBan: false, canTimeout: false, canPurge: false, canViewLogs: false,
                [perm]: true
            });
        }
        setSettings(newSettings);

        // API Call
        try {
            const payload = permIndex >= 0 ? newSettings.permissions[permIndex] : newSettings.permissions[newSettings.permissions.length - 1];
            // Don't send the ID if it is temp
            const { id, settingsId, ...cleanPayload } = payload as any;
            
            await axios.post(`/api/guilds/${selectedGuild.id}/moderation/permissions`, {
                roleId,
                permissions: cleanPayload
            }, { withCredentials: true });
        } catch (err) {
            console.error('Failed to save permission');
            setMsg({ type: 'error', text: 'Failed to save permission change.' });
            // Revert? (Complex for now, just alerting user is okay for MVP)
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Shield size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Moderation Settings</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Configure your server's defensive measures.</p>
                </div>
            </div>

            {msg && (
                <div style={{
                    padding: '12px',
                    marginBottom: '20px',
                    borderRadius: borderRadius.md,
                    backgroundColor: msg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: msg.type === 'success' ? '#4caf50' : '#f44336',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    {msg.type === 'success' ? <Check size={18} style={{marginRight:8}}/> : <AlertTriangle size={18} style={{marginRight:8}}/>}
                    {msg.text}
                    <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={18}/></button>
                </div>
            )}

            {/* General Settings */}
            <div style={{ background: colors.surface, padding: '24px', borderRadius: borderRadius.lg, marginBottom: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '12px' }}>General Configuration</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Log Channel</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Where should I post case logs (bans, kicks, etc)?</p>
                        <select 
                            value={settings?.logChannelId || ''} 
                            onChange={(e) => setSettings({ ...settings!, logChannelId: e.target.value })}
                            style={{ 
                                width: '100%', 
                                padding: '10px', 
                                background: colors.background, 
                                border: `1px solid ${colors.border}`, 
                                color: colors.textPrimary,
                                borderRadius: borderRadius.sm 
                            }}
                        >
                            <option value="">-- No Logging --</option>
                            {channels.map(c => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>DM Users</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Send a DM to users explaining why they were moderated?</p>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={settings?.dmUponAction || false}
                                    onChange={(e) => setSettings({ ...settings!, dmUponAction: e.target.checked })}
                                    style={{ opacity: 0, width: 0, height: 0 }} 
                                />
                                <span style={{ 
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                    backgroundColor: settings?.dmUponAction ? colors.primary : '#ccc', 
                                    transition: '.4s', borderRadius: '34px' 
                                }}>
                                    <span style={{ 
                                        position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                        transform: settings?.dmUponAction ? 'translateX(26px)' : 'translateX(0)'
                                    }}/>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '24px', textAlign: 'right' }}>
                    <button 
                        onClick={saveGeneral} 
                        disabled={saving}
                        style={{ 
                            background: colors.primary, 
                            color: 'white', 
                            border: 'none', 
                            padding: '10px 24px', 
                            borderRadius: borderRadius.md, 
                            cursor: 'pointer',
                            opacity: saving ? 0.7 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Role Permissions Matrix */}
            <div style={{ background: colors.surface, padding: '24px', borderRadius: borderRadius.lg }}>
                <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Role Permissions</h2>
                <p style={{ color: colors.textSecondary, marginBottom: '24px' }}>Who is allowed to use moderation commands?</p>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: `2px solid ${colors.border}` }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Role</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Warn</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Timeout</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Kick</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Ban</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Purge</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>View Logs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(role => {
                                const perms = settings?.permissions.find(p => p.roleId === role.id) || {
                                    canWarn: false, canKick: false, canBan: false, canTimeout: false, canPurge: false, canViewLogs: false
                                };
                                
                                return (
                                    <tr key={role.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                        <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ 
                                                width: '12px', height: '12px', borderRadius: '50%', 
                                                backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' 
                                            }} />
                                            <span style={{ fontWeight: 500 }}>{role.name}</span>
                                        </td>
                                        {['canWarn', 'canTimeout', 'canKick', 'canBan', 'canPurge', 'canViewLogs'].map((key) => (
                                            <td key={key} style={{ textAlign: 'center', padding: '12px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={(perms as any)[key]} 
                                                    onChange={() => togglePermission(role.id, key as any)}
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
