import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useMobile } from '../hooks/useMobile';
import { ChannelSelect } from '../components/ChannelSelect';
import axios from 'axios';
import { Shield, Save, Check, X, AlertTriangle, MessageSquare, List } from 'lucide-react';

interface ModerationSettings {
    id: string;
    guildId: string;
    logChannelId: string | null;
    dmUponAction: boolean;
    kickMessage: string | null;
    banMessage: string | null;
    timeoutMessage: string | null;
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
    const isMobile = useMobile();
    const [settings, setSettings] = useState<ModerationSettings | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    // UI State for Role Permissions
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

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
                const sortedRoles = rolesRes.data.sort((a: any, b: any) => b.position - a.position);
                setRoles(sortedRoles);
                if (sortedRoles.length > 0) setSelectedRoleId(sortedRoles[0].id);

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
                dmUponAction: settings.dmUponAction,
                kickMessage: settings.kickMessage,
                banMessage: settings.banMessage,
                timeoutMessage: settings.timeoutMessage
            }, { withCredentials: true });
            
            setMsg({ type: 'success', text: 'Settings saved.' });
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

    const selectedRole = roles.find(r => r.id === selectedRoleId);
    const selectedRolePerms = settings?.permissions.find(p => p.roleId === selectedRoleId) || {
        canWarn: false, canKick: false, canBan: false, canTimeout: false, canPurge: false, canViewLogs: false
    };

    const permissionLabels: Record<string, string> = {
        canWarn: 'Warn Members',
        canTimeout: 'Timeout Members',
        canKick: 'Kick Members',
        canBan: 'Ban Members',
        canPurge: 'Purge Messages',
        canViewLogs: 'View Audit Logs'
    };

    return (
        <div style={{ padding: isMobile ? '16px' : '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '8px' : '0' }}>
                    <Shield size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '32px' }}>Moderation Settings</h1>
                </div>
                 {!isMobile && (
                    <div style={{ marginLeft: '16px' }}>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Configure basic moderation commands and logging.</p>
                    </div>
                 )}
            </div>
            
            {isMobile && <p style={{ margin: '0 0 16px', color: colors.textSecondary }}>Configure basic moderation commands and logging.</p>}

            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '15px' }}>Set up your moderation logs, custom messages for actions (kick, ban, timeout), and configure which roles are allowed to use specific moderation commands.</p>
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
            <div style={{ background: colors.surface, padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg, marginBottom: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '12px' }}>General Configuration</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Log Channel</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Where should I post case logs?</p>
                        <ChannelSelect 
                            guildId={selectedGuild?.id || ''}
                            value={settings?.logChannelId || ''} 
                            onChange={(val) => setSettings({ ...settings!, logChannelId: val as string })}
                            placeholder="-- No Logging --"
                            channelTypes={[0, 15]}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>DM Users</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Send DM when moderated?</p>
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

                <h3 style={{ margin: '20px 0 10px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} /> Custom DM Messages
                </h3>
                <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '16px' }}>
                    Variables: <code>{'{server}'}</code>, <code>{'{user}'}</code>, <code>{'{reason}'}</code>, <code>{'{duration}'}</code>
                </p>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <div>
                        <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Kick Message</label>
                        <input 
                            type="text"
                            placeholder="You were kicked from {server} for: {reason}"
                            value={settings?.kickMessage || ''}
                            onChange={(e) => setSettings({...settings!, kickMessage: e.target.value})}
                            style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white', borderRadius: borderRadius.sm }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ban Message</label>
                        <input 
                            type="text"
                            placeholder="You were banned from {server} for: {reason}"
                            value={settings?.banMessage || ''}
                            onChange={(e) => setSettings({...settings!, banMessage: e.target.value})}
                            style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white', borderRadius: borderRadius.sm }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Timeout Message</label>
                        <input 
                            type="text"
                            placeholder="You were timed out in {server} for {duration}. Reason: {reason}"
                            value={settings?.timeoutMessage || ''}
                            onChange={(e) => setSettings({...settings!, timeoutMessage: e.target.value})}
                            style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white', borderRadius: borderRadius.sm }}
                        />
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
                            gap: '8px',
                            width: isMobile ? '100%' : 'auto',
                            justifyContent: 'center'
                        }}
                    >
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Role Permissions Matrix - Redesigned */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '250px 1fr', gap: '24px' }}>
                
                {/* Left: Role List */}
                <div style={{ background: colors.surface, padding: '20px', borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <List size={20} /> Roles
                    </h3>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '8px', maxHeight: isMobile ? 'auto' : '500px', overflowX: isMobile ? 'auto' : 'hidden', overflowY: isMobile ? 'hidden' : 'auto', paddingBottom: isMobile ? '8px' : '0' }}>
                        {roles.map(role => (
                            <div 
                                key={role.id}
                                onClick={() => setSelectedRoleId(role.id)}
                                style={{ 
                                    padding: '10px', 
                                    borderRadius: borderRadius.md, 
                                    cursor: 'pointer',
                                    backgroundColor: selectedRoleId === role.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: selectedRoleId === role.id ? `1px solid ${colors.primary}` : '1px solid transparent',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    whiteSpace: isMobile ? 'nowrap' : 'normal',
                                    minWidth: isMobile ? 'fit-content' : 'auto'
                                }}
                            >
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5', flexShrink: 0 }} />
                                <span style={{ fontWeight: selectedRoleId === role.id ? 600 : 400 }}>{role.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Permissions */}
                <div style={{ background: colors.surface, padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg }}>
                    {selectedRole ? (
                        <>
                            <h2 style={{ marginTop: 0, borderBottom: `1px solid ${colors.border}`, paddingBottom: '16px', marginBottom: '24px' }}>
                                Permissions for <span style={{ color: selectedRole.color ? `#${selectedRole.color.toString(16).padStart(6, '0')}` : 'inherit' }}>{selectedRole.name}</span>
                            </h2>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                                {Object.entries(permissionLabels).map(([key, label]) => (
                                    <div key={key} style={{ 
                                        padding: '16px', 
                                        background: colors.background, 
                                        borderRadius: borderRadius.md,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        minHeight: '56px'
                                    }}>
                                        <span style={{ fontWeight: 500, flex: 1, paddingRight: '12px' }}>{label}</span>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', flexShrink: 0 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={(selectedRolePerms as any)[key]} 
                                                onChange={() => togglePermission(selectedRole.id, key as any)}
                                                style={{ opacity: 0, width: 0, height: 0 }} 
                                            />
                                            <span style={{ 
                                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                                backgroundColor: (selectedRolePerms as any)[key] ? colors.primary : '#ccc', 
                                                transition: '.4s', borderRadius: '34px' 
                                            }}>
                                                <span style={{ 
                                                    position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                                    transform: (selectedRolePerms as any)[key] ? 'translateX(26px)' : 'translateX(0)'
                                                }}/>
                                            </span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: colors.textSecondary }}>
                            Select a role to configure permissions
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};