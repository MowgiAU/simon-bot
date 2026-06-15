import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useResources } from '../components/ResourceProvider';
import { useMobile } from '../hooks/useMobile';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';
import axios from 'axios';
import { Shield, Save, Check, X, AlertTriangle, MessageSquare, List, FolderOpen, Ban, UserX } from 'lucide-react';
import { AnimatedWrapper } from '../components/AnimatedWrapper';

interface ModerationSettings {
    id: string;
    guildId: string;
    logChannelId: string | null;
    caseLogForumId: string | null;
    removeAlertRoleId: string | null;
    dmUponAction: boolean;
    kickMessage: string | null;
    banMessage: string | null;
    timeoutMessage: string | null;
    permissions: Permission[];
}

interface BlocklistEntry {
    id: string;
    userId: string;
    username: string | null;
    reason: string | null;
    addedBy: string | null;
    createdAt: string;
}

interface Permission {
    id: string;
    roleId: string;
    canWarn: boolean;
    canKick: boolean;
    canBan: boolean;
    canTimeout: boolean;
    canPurge: boolean;
    canRemove: boolean;
    canViewLogs: boolean;
}

export const ModerationSettingsPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const { channels, roles, loading: resourcesLoading } = useResources();
    const isMobile = useMobile();
    const [settings, setSettings] = useState<ModerationSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    // UI State for Role Permissions
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

    // Currency/XP Blocklist State
    const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
    const [blocklistLoading, setBlocklistLoading] = useState(true);
    const [blockQuery, setBlockQuery] = useState('');
    const [blockResults, setBlockResults] = useState<any[]>([]);
    const [blockReason, setBlockReason] = useState('');
    const [selectedBlockUser, setSelectedBlockUser] = useState<any | null>(null);

    // Initial Fetch
    useEffect(() => {
        if (!selectedGuild) return;
        
        const controller = new AbortController();
        let isMounted = true;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/api/guilds/${selectedGuild.id}/moderation`, { 
                    withCredentials: true, 
                    signal: controller.signal 
                });

                if (isMounted) {
                    setSettings(response.data);
                }
            } catch (err: any) {
                if (axios.isCancel(err) || err.name === 'AbortError' || !isMounted) return;
                console.error('Moderation Load Error:', err);
                const errorText = err.response?.data?.error || err.message || 'Unknown error';
                setMsg({ type: 'error', text: `Failed to load settings: ${errorText}` });
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [selectedGuild?.id]);

    // Set default selected role when roles are loaded
    useEffect(() => {
        if (roles.length > 0 && !selectedRoleId) {
            setSelectedRoleId(roles[0].id);
        }
    }, [roles, selectedRoleId]);

    // Fetch blocklist
    useEffect(() => {
        if (!selectedGuild) return;

        const controller = new AbortController();
        let isMounted = true;

        const fetchBlocklist = async () => {
            setBlocklistLoading(true);
            try {
                const response = await axios.get(`/api/guilds/${selectedGuild.id}/moderation/blocklist`, {
                    withCredentials: true,
                    signal: controller.signal
                });
                if (isMounted) setBlocklist(response.data);
            } catch (err: any) {
                if (axios.isCancel(err) || err.name === 'AbortError' || !isMounted) return;
                console.error('Blocklist Load Error:', err);
            } finally {
                if (isMounted) setBlocklistLoading(false);
            }
        };

        fetchBlocklist();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [selectedGuild?.id]);

    // Debounced user search for the blocklist add form
    useEffect(() => {
        if (!selectedGuild || selectedBlockUser || blockQuery.trim().length < 2) {
            setBlockResults([]);
            return;
        }

        const handle = setTimeout(async () => {
            try {
                const res = await axios.get(`/api/guilds/${selectedGuild.id}/moderation/search-users`, {
                    params: { q: blockQuery },
                    withCredentials: true
                });
                setBlockResults(res.data);
            } catch {
                setBlockResults([]);
            }
        }, 300);

        return () => clearTimeout(handle);
    }, [blockQuery, selectedGuild?.id, selectedBlockUser]);

    if (loading || resourcesLoading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading settings...</div>;

    const saveGeneral = async () => {
        if (!settings || !selectedGuild) return;
        setSaving(true);
        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/moderation`, {
                logChannelId: settings.logChannelId === '' ? null : settings.logChannelId,
                caseLogForumId: settings.caseLogForumId === '' ? null : settings.caseLogForumId,
                removeAlertRoleId: settings.removeAlertRoleId === '' ? null : settings.removeAlertRoleId,
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
        const newValue = currentPerms ? !(currentPerms as any)[perm] : true;

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
                canWarn: false, canKick: false, canBan: false, canTimeout: false, canPurge: false, canRemove: false, canViewLogs: false,
                [perm]: true
            } as any);
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
        }
    };

    const addToBlocklist = async () => {
        if (!selectedBlockUser || !selectedGuild) return;
        try {
            const res = await axios.post(`/api/guilds/${selectedGuild.id}/moderation/blocklist`, {
                userId: selectedBlockUser.id,
                username: selectedBlockUser.username,
                reason: blockReason.trim() || null
            }, { withCredentials: true });

            setBlocklist(prev => [res.data, ...prev.filter(e => e.userId !== res.data.userId)]);
            setSelectedBlockUser(null);
            setBlockQuery('');
            setBlockResults([]);
            setBlockReason('');
        } catch (err) {
            console.error('Failed to add to blocklist', err);
            setMsg({ type: 'error', text: 'Failed to add user to blocklist.' });
        }
    };

    const removeFromBlocklist = async (userId: string) => {
        if (!selectedGuild) return;
        try {
            await axios.delete(`/api/guilds/${selectedGuild.id}/moderation/blocklist/${userId}`, { withCredentials: true });
            setBlocklist(prev => prev.filter(e => e.userId !== userId));
        } catch (err) {
            console.error('Failed to remove from blocklist', err);
            setMsg({ type: 'error', text: 'Failed to remove user from blocklist.' });
        }
    };

    const selectedRole = roles.find(r => r.id === selectedRoleId);
    const selectedRolePerms = settings?.permissions.find(p => p.roleId === selectedRoleId) || {
        canWarn: false, canKick: false, canBan: false, canTimeout: false, canPurge: false, canRemove: false, canViewLogs: false
    };

    const permissionLabels: Record<string, string> = {
        canWarn: 'Warn Members',
        canTimeout: 'Timeout Members',
        canKick: 'Kick Members',
        canBan: 'Ban Members',
        canPurge: 'Purge Messages',
        canRemove: 'Remove Messages (Jr Staff)',
        canViewLogs: 'View Audit Logs'
    };

    return (
        <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '8px' : '0' }}>
                    <AnimatedWrapper icon={Shield} size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '28px' }}>Moderation Settings</h1>
                </div>
                 {!isMobile && (
                    <div style={{ marginLeft: '16px' }}>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Configure basic moderation commands and logging.</p>
                    </div>
                 )}
            </div>
            
            {isMobile && <p style={{ margin: '0 0 16px', color: colors.textSecondary }}>Configure basic moderation commands and logging.</p>}

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '15px' }}>Set up your moderation logs, custom messages for actions (kick, ban, timeout), and configure which roles are allowed to use specific moderation commands.</p>
            </div>

            {msg && (
                <div style={{
                    padding: '12px',
                    marginBottom: '20px',
                    borderRadius: borderRadius.md,
                    backgroundColor: msg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: msg.type === 'success' ? colors.success : colors.error,
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid #3E455633'
                }}>
                    {msg.type === 'success' ? <Check size={18} style={{marginRight:8}}/> : <AlertTriangle size={18} style={{marginRight:8}}/>}
                    {msg.text}
                    <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={18}/></button>
                </div>
            )}

            {/* General Settings */}
            <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg, marginBottom: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '12px' }}>General Configuration</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Log Channel</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Where should I post moderation embeds?</p>
                        <ChannelSelect 
                            guildId={selectedGuild?.id || ''}
                            value={settings?.logChannelId || ''} 
                            onChange={(val) => setSettings({ ...settings!, logChannelId: val as string })}
                            placeholder="-- No Logging --"
                            channelTypes={[0, 15]}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Case File Forum</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Forum channel for per-user case file threads</p>
                        <ChannelSelect 
                            guildId={selectedGuild?.id || ''}
                            value={settings?.caseLogForumId || ''} 
                            onChange={(val) => setSettings({ ...settings!, caseLogForumId: val as string })}
                            placeholder="-- No Case Files --"
                            channelTypes={[15]}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Remove Alert Role</label>
                        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>Role to ping when jr staff uses /remove</p>
                        <RoleSelect 
                            guildId={selectedGuild?.id || ''}
                            value={settings?.removeAlertRoleId || ''} 
                            onChange={(val) => setSettings({ ...settings!, removeAlertRoleId: val as string })}
                            placeholder="-- No Alert Role --"
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', marginTop: '24px' }}>
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
                                    backgroundColor: settings?.dmUponAction ? colors.primary : colors.textTertiary, 
                                    transition: '.4s', borderRadius: '34px' 
                                }}>
                                    <span style={{ 
                                        position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                        backgroundColor: colors.textPrimary, transition: '.4s', borderRadius: '50%',
                                        transform: settings?.dmUponAction ? 'translateX(26px)' : 'translateX(0)'
                                    }}/>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <h3 style={{ margin: '20px 0 10px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AnimatedWrapper icon={MessageSquare} size={16} /> Custom DM Messages
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
                            style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ban Message</label>
                        <input 
                            type="text"
                            placeholder="You were banned from {server} for: {reason}"
                            value={settings?.banMessage || ''}
                            onChange={(e) => setSettings({...settings!, banMessage: e.target.value})}
                            style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Timeout Message</label>
                        <input 
                            type="text"
                            placeholder="You were timed out in {server} for {duration}. Reason: {reason}"
                            value={settings?.timeoutMessage || ''}
                            onChange={(e) => setSettings({...settings!, timeoutMessage: e.target.value})}
                            style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                        />
                    </div>
                </div>

                <div style={{ marginTop: '24px', textAlign: 'right' }}>
                    <button 
                        onClick={saveGeneral} 
                        disabled={saving}
                        style={{ 
                            background: colors.primary, 
                            color: colors.textPrimary, 
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
                        <AnimatedWrapper icon={Save} size={18} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Role Permissions Matrix - Redesigned */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '250px 1fr', gap: '24px' }}>
                
                {/* Left: Role List */}
                <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: '20px', borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AnimatedWrapper icon={List} size={20} /> Roles
                    </h3>
                    {isMobile ? (
                        <select
                            value={selectedRoleId || ''}
                            onChange={(e) => setSelectedRoleId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(0,0,0,0.2)',
                                color: colors.textPrimary,
                                border: `1px solid ${colors.border}`,
                                borderRadius: borderRadius.md,
                                fontSize: '16px',
                                outline: 'none'
                            }}
                        >
                            <option value="" disabled>Select a role...</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
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
                                        display: 'flex', alignItems: 'center', gap: '10px'
                                    }}
                                >
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5', flexShrink: 0 }} />
                                    <span style={{ fontWeight: selectedRoleId === role.id ? 600 : 400 }}>{role.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Permissions */}
                <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg }}>
                    {selectedRole ? (
                        <>
                            <h2 style={{ marginTop: 0, borderBottom: `1px solid ${colors.border}`, paddingBottom: '16px', marginBottom: '24px', wordBreak: 'break-word' }}>
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
                                backgroundColor: (selectedRolePerms as any)[key] ? colors.primary : colors.textTertiary, 
                                                transition: '.4s', borderRadius: '34px' 
                                            }}>
                                                <span style={{ 
                                                    position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                                    backgroundColor: colors.textPrimary, transition: '.4s', borderRadius: '50%',
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

            {/* Currency & XP Blocklist */}
            <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg, marginTop: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AnimatedWrapper icon={Ban} size={20} /> Currency & XP Blocklist
                </h2>

                <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                    <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '15px' }}>
                        Users added here will silently stop earning or receiving currency and XP. They are never notified that they have been added.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ flex: 1.5, position: 'relative' }}>
                        <input
                            placeholder="Search user by name..."
                            value={selectedBlockUser ? `${selectedBlockUser.displayName} (${selectedBlockUser.username})` : blockQuery}
                            onChange={(e) => { setBlockQuery(e.target.value); setSelectedBlockUser(null); }}
                            style={{ width: '100%', padding: '10px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                        />
                        {blockResults.length > 0 && !selectedBlockUser && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, maxHeight: '220px', overflowY: 'auto' }}>
                                {blockResults.map((user) => (
                                    <div
                                        key={user.id}
                                        onClick={() => { setSelectedBlockUser(user); setBlockResults([]); }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {user.avatar ? (
                                            <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} style={{ width: 20, height: 20, borderRadius: 10 }} alt="" />
                                        ) : (
                                            <div style={{ width: 20, height: 20, borderRadius: 10, background: colors.textSecondary }} />
                                        )}
                                        <span>{user.displayName} ({user.username})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <input
                        placeholder="Reason (optional, internal only)"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        style={{ flex: 1, padding: '10px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                    />
                    <button
                        onClick={addToBlocklist}
                        disabled={!selectedBlockUser}
                        style={{
                            background: colors.primary,
                            color: colors.textPrimary,
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: borderRadius.md,
                            cursor: selectedBlockUser ? 'pointer' : 'not-allowed',
                            opacity: selectedBlockUser ? 1 : 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: isMobile ? '100%' : 'auto'
                        }}
                    >
                        <AnimatedWrapper icon={UserX} size={16} /> Add to Blocklist
                    </button>
                </div>

                {blocklistLoading ? (
                    <div style={{ color: colors.textSecondary, padding: spacing.md }}>Loading...</div>
                ) : blocklist.length === 0 ? (
                    <div style={{ color: colors.textSecondary, padding: spacing.md, textAlign: 'center' }}>No users on the blocklist.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {blocklist.map((entry) => (
                            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: colors.background, borderRadius: borderRadius.md, gap: '12px' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{entry.username || entry.userId}</div>
                                    {entry.reason && <div style={{ fontSize: '13px', color: colors.textSecondary, wordBreak: 'break-word' }}>{entry.reason}</div>}
                                    <div style={{ fontSize: '12px', color: colors.textTertiary }}>Added {new Date(entry.createdAt).toLocaleDateString()}</div>
                                </div>
                                <button
                                    onClick={() => removeFromBlocklist(entry.userId)}
                                    title="Remove from blocklist"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, flexShrink: 0, padding: '4px' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
