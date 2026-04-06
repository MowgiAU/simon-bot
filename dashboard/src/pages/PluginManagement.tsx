import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useResources } from '../components/ResourceProvider';
import { useMobile } from '../hooks/useMobile';
import axios from 'axios';
import { Settings, Shield, Power, Users, Lock, ChevronDown, ChevronUp, UserCheck, Search, X } from 'lucide-react';

interface PluginMetadata {
    id: string;
    name: string;
    description: string;
}

interface PluginSetting {
    guildId: string;
    pluginId: string;
    enabled: boolean;
    allowedRoles: string[];
}

export const PluginManagementPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const { roles, loading: resourcesLoading } = useResources();
    const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
    const [settings, setSettings] = useState<PluginSetting[]>([]);
    const [accessRoles, setAccessRoles] = useState<string[]>([]); // roles allowed to login
    const [betaRoleIds, setBetaRoleIds] = useState<string[]>([]); // roles auto-invited for beta
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Expanded state for role configuration per plugin
    const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
    const [accessDropdownOpen, setAccessDropdownOpen] = useState(false);
    const [betaDropdownOpen, setBetaDropdownOpen] = useState(false);
    const [accessSearch, setAccessSearch] = useState('');
    const [betaSearch, setBetaSearch] = useState('');
    const isMobile = useMobile();

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = () => { setAccessDropdownOpen(false); setBetaDropdownOpen(false); };
        if (accessDropdownOpen || betaDropdownOpen) {
            // Delay to avoid closing immediately on the same click
            const id = setTimeout(() => document.addEventListener('click', handleClick), 0);
            return () => { clearTimeout(id); document.removeEventListener('click', handleClick); };
        }
    }, [accessDropdownOpen, betaDropdownOpen]);

    useEffect(() => {
        if (!selectedGuild) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [metaRes, settingsRes, betaRes] = await Promise.all([
                    axios.get('/api/plugins/list', { withCredentials: true }),
                    axios.get(`/api/guilds/${selectedGuild.id}/plugins-settings`, { withCredentials: true }),
                    axios.get(`/api/guilds/${selectedGuild.id}/beta-access`, { withCredentials: true })
                ]);
                
                setPlugins(metaRes.data);
                setSettings(settingsRes.data.plugins);
                setAccessRoles(settingsRes.data.access.allowedRoles);
                setBetaRoleIds(betaRes.data.betaRoleIds || []);
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedGuild]);

    // Format roles for display (exclude @everyone and sort)
    const filteredRoles = React.useMemo(() => {
        return roles
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position);
    }, [roles]);

    if (loading || resourcesLoading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading...</div>;

    const togglePlugin = async (pluginId: string, currentState: boolean) => {
        if (!selectedGuild) return;
        // Optimistic
        const currentSetting = settings.find(s => s.pluginId === pluginId);
        const newSetting = currentSetting 
            ? { ...currentSetting, enabled: !currentState } 
            : { guildId: selectedGuild.id, pluginId, enabled: !currentState, allowedRoles: [] };
        
        setSettings(prev => [
            ...prev.filter(s => s.pluginId !== pluginId),
            newSetting
        ]);

        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/plugins/${pluginId}`, {
                enabled: newSetting.enabled,
                allowedRoles: newSetting.allowedRoles
            }, { withCredentials: true });
        } catch (e) {
            console.error('Failed to toggle', e);
        }
    };

    const updatePluginRoles = async (pluginId: string, roleId: string) => {
        if (!selectedGuild) return;
        const currentSetting = settings.find(s => s.pluginId === pluginId) || { guildId: selectedGuild.id, pluginId, enabled: true, allowedRoles: [] };
        
        const hasRole = currentSetting.allowedRoles.includes(roleId);
        const newRoles = hasRole 
            ? currentSetting.allowedRoles.filter(id => id !== roleId)
            : [...currentSetting.allowedRoles, roleId];

        const newSetting = { ...currentSetting, allowedRoles: newRoles };
        
        setSettings(prev => [
            ...prev.filter(s => s.pluginId !== pluginId),
            newSetting
        ]);

        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/plugins/${pluginId}`, {
                enabled: newSetting.enabled,
                allowedRoles: newSetting.allowedRoles
            }, { withCredentials: true });
        } catch (e) {
            console.error('Failed to update roles', e);
        }
    };

    const toggleAccessRole = async (roleId: string) => {
        if (!selectedGuild) return;
        
        const hasRole = accessRoles.includes(roleId);
        const newRoles = hasRole
            ? accessRoles.filter(id => id !== roleId)
            : [...accessRoles, roleId];
        
        setAccessRoles(newRoles);
        
        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/access`, {
                allowedRoles: newRoles
            }, { withCredentials: true });
        } catch (e) {
            console.error('Failed to update access', e);
        }
    };

    const toggleBetaRole = async (roleId: string) => {
        if (!selectedGuild) return;
        const hasRole = betaRoleIds.includes(roleId);
        const newRoles = hasRole
            ? betaRoleIds.filter(id => id !== roleId)
            : [...betaRoleIds, roleId];
        setBetaRoleIds(newRoles);
        try {
            await axios.put(`/api/guilds/${selectedGuild.id}/beta-access`, {
                betaRoleIds: newRoles
            }, { withCredentials: true });
        } catch (e) {
            console.error('Failed to update beta roles', e);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: colors.textSecondary }}>
            Loading plugins configuration...
        </div>
    );

    return (
        <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
             <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Settings size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '28px' }}>Plugin Management</h1>
                </div>
                <div>
                    <p style={{ margin: '0 0 4px', color: colors.textSecondary, fontSize: isMobile ? '14px' : '16px' }}>Enable/Disable features and control who can access them.</p>
                    <p style={{ margin: 0, fontSize: '12px', color: colors.warning }}>
                        Note: Changes to plugin status may take up to 30 seconds to update on the bot.
                    </p>
                </div>
            </div>

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>Toggle plugins on or off for this server, assign role-based access, and control who can log in to the dashboard. Changes may take up to 30 seconds to apply.</p>
            </div>

            {/* Dashboard Access */}
            <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg, marginBottom: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: isMobile ? '18px' : '22px' }}>
                    <Lock size={20} /> Dashboard Access
                </h2>
                <p style={{ color: colors.textSecondary, marginBottom: '16px', fontSize: '14px' }}>
                    Select roles that are allowed to login and view this dashboard. 
                    (Admins always have access).
                </p>
                
                {/* Selected role chips */}
                {accessRoles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {accessRoles.map(roleId => {
                            const role = filteredRoles.find(r => r.id === roleId);
                            if (!role) return null;
                            return (
                                <div key={role.id} style={{ padding: '4px 10px', borderRadius: '16px', backgroundColor: `${colors.primary}33`, border: `1px solid ${colors.primary}`, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', userSelect: 'none' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }} />
                                    {role.name}
                                    <button onClick={() => toggleAccessRole(role.id)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 0, display: 'flex', marginLeft: '2px' }}><X size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Dropdown selector */}
                <div style={{ position: 'relative' }}>
                    <div onClick={() => { setAccessDropdownOpen(!accessDropdownOpen); setBetaDropdownOpen(false); }}
                        style={{ padding: '8px 12px', background: colors.background, border: `1px solid ${accessDropdownOpen ? colors.primary : colors.border || '#3E4556'}`, borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: colors.textSecondary, transition: 'border-color 0.15s' }}>
                        <span>Select roles...</span>
                        <ChevronDown size={14} style={{ transform: accessDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </div>
                    {accessDropdownOpen && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: colors.background, border: `1px solid ${colors.border || '#3E4556'}`, borderRadius: borderRadius.md, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50, maxHeight: '240px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '8px', borderBottom: `1px solid ${colors.border || '#3E4556'}` }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={12} color={colors.textTertiary} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                                    <input value={accessSearch} onChange={e => setAccessSearch(e.target.value)} placeholder="Search roles..." autoFocus
                                        style={{ width: '100%', padding: '6px 6px 6px 28px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border || '#3E4556'}`, borderRadius: '6px', color: colors.textPrimary, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: '192px' }}>
                                {filteredRoles.filter(r => r.name.toLowerCase().includes(accessSearch.toLowerCase())).map(role => {
                                    const isSelected = accessRoles.includes(role.id);
                                    return (
                                        <div key={role.id} onClick={() => toggleAccessRole(role.id)}
                                            style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', userSelect: 'none', transition: 'background 0.1s', backgroundColor: isSelected ? `${colors.primary}15` : 'transparent' }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5', flexShrink: 0 }} />
                                            <span style={{ flex: 1 }}>{role.name}</span>
                                            {isSelected && <div style={{ width: 16, height: 16, borderRadius: '4px', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>✓</span></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Beta Access Roles */}
            <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg, marginBottom: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: isMobile ? '18px' : '22px' }}>
                    <UserCheck size={20} /> Beta Access Roles
                </h2>
                <p style={{ color: colors.textSecondary, marginBottom: '16px', fontSize: '14px' }}>
                    Members with these roles will be automatically granted access to the site when they sign in.
                    This only applies during invite-only / beta mode.
                </p>
                
                {/* Selected role chips */}
                {betaRoleIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {betaRoleIds.map(roleId => {
                            const role = filteredRoles.find(r => r.id === roleId);
                            if (!role) return null;
                            return (
                                <div key={role.id} style={{ padding: '4px 10px', borderRadius: '16px', backgroundColor: `${colors.primary}33`, border: `1px solid ${colors.primary}`, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', userSelect: 'none' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }} />
                                    {role.name}
                                    <button onClick={() => toggleBetaRole(role.id)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 0, display: 'flex', marginLeft: '2px' }}><X size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Dropdown selector */}
                <div style={{ position: 'relative' }}>
                    <div onClick={() => { setBetaDropdownOpen(!betaDropdownOpen); setAccessDropdownOpen(false); }}
                        style={{ padding: '8px 12px', background: colors.background, border: `1px solid ${betaDropdownOpen ? colors.primary : colors.border || '#3E4556'}`, borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: colors.textSecondary, transition: 'border-color 0.15s' }}>
                        <span>Select roles...</span>
                        <ChevronDown size={14} style={{ transform: betaDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </div>
                    {betaDropdownOpen && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: colors.background, border: `1px solid ${colors.border || '#3E4556'}`, borderRadius: borderRadius.md, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50, maxHeight: '240px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '8px', borderBottom: `1px solid ${colors.border || '#3E4556'}` }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={12} color={colors.textTertiary} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                                    <input value={betaSearch} onChange={e => setBetaSearch(e.target.value)} placeholder="Search roles..." autoFocus
                                        style={{ width: '100%', padding: '6px 6px 6px 28px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border || '#3E4556'}`, borderRadius: '6px', color: colors.textPrimary, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: '192px' }}>
                                {filteredRoles.filter(r => r.name.toLowerCase().includes(betaSearch.toLowerCase())).map(role => {
                                    const isSelected = betaRoleIds.includes(role.id);
                                    return (
                                        <div key={role.id} onClick={() => toggleBetaRole(role.id)}
                                            style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', userSelect: 'none', transition: 'background 0.1s', backgroundColor: isSelected ? `${colors.primary}15` : 'transparent' }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5', flexShrink: 0 }} />
                                            <span style={{ flex: 1 }}>{role.name}</span>
                                            {isSelected && <div style={{ width: 16, height: 16, borderRadius: '4px', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>✓</span></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                {betaRoleIds.length === 0 && (
                    <p style={{ color: colors.textTertiary, fontSize: '13px', fontStyle: 'italic', marginTop: '12px', marginBottom: 0 }}>No roles selected — only manually invited users and admins can access the site.</p>
                )}
            </div>

            {/* Plugin List */}
            <div style={{ display: 'grid', gap: '16px' }}>
                {plugins.map(plugin => {
                    const setting = settings.find(s => s.pluginId === plugin.id);
                    const isEnabled = setting ? setting.enabled : true; // Default enabled
                    const isExpanded = expandedPlugin === plugin.id;

                    return (
                        <div key={plugin.id} style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', borderRadius: borderRadius.lg, overflow: 'hidden' }}>
                            <div style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? '16px' : '0' }}>
                                <div style={{ marginBottom: isMobile ? '4px' : '0', flex: 1 }}>
                                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {plugin.name}
                                         {/* Status badge for mobile visibility */}
                                         {isMobile && (
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '2px 6px', 
                                                borderRadius: '4px',
                                                backgroundColor: isEnabled ? 'rgba(43, 140, 113, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                                color: isEnabled ? colors.primary : colors.textTertiary,
                                                fontWeight: 'bold'
                                            }}>
                                                {isEnabled ? 'ON' : 'OFF'}
                                            </span>
                                         )}
                                    </div>
                                    <div style={{ color: colors.textSecondary, fontSize: isMobile ? '13px' : '14px', marginTop: '4px' }}>{plugin.description}</div>
                                </div>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: isMobile ? '16px' : '24px', 
                                    width: isMobile ? '100%' : 'auto', 
                                    justifyContent: 'space-between',
                                    borderTop: isMobile ? `1px solid ${colors.border}` : 'none',
                                    paddingTop: isMobile ? '12px' : '0'
                                }}>
                                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', flexShrink: 0 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isEnabled}
                                            onChange={() => togglePlugin(plugin.id, isEnabled)}
                                            style={{ opacity: 0, width: 0, height: 0 }} 
                                        />
                                        <span style={{ 
                                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                            backgroundColor: isEnabled ? colors.primary : colors.textTertiary, 
                                            transition: '.4s', borderRadius: '34px' 
                                        }}>
                                            <span style={{ 
                                                position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                                backgroundColor: colors.textPrimary, transition: '.4s', borderRadius: '50%',
                                                transform: isEnabled ? 'translateX(26px)' : 'translateX(0)'
                                            }}/>
                                        </span>
                                    </label>
                                    
                                    <button 
                                        onClick={() => setExpandedPlugin(isExpanded ? null : plugin.id)}
                                        style={{ 
                                            background: 'rgba(255,255,255,0.05)', 
                                            border: 'none', 
                                            color: colors.textSecondary, 
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <Users size={16} />
                                        {isMobile ? 'Config' : 'Permissions'}
                                        {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Permission Panel */}
                            {isExpanded && (
                                <div style={{ padding: isMobile ? '0 16px 16px' : '0 20px 20px', borderTop: `1px solid ${colors.border}`, marginTop: isMobile ? '0' : '-5px', paddingTop: '15px' }}>
                                    <div style={{ fontSize: '13px', marginBottom: '10px', color: colors.textSecondary }}>
                                        Roles allowed to configure <strong>{plugin.name}</strong>:
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {filteredRoles.map(role => {
                                            const roleList = setting?.allowedRoles || [];
                                            const isSelected = roleList.includes(role.id);
                                            return (
                                                <div 
                                                    key={role.id}
                                                    onClick={() => updatePluginRoles(plugin.id, role.id)}
                                                    style={{ 
                                                        padding: '6px 10px', 
                                                        borderRadius: '16px', 
                                                        cursor: 'pointer',
                                                        backgroundColor: isSelected ? `${colors.primary}33` : colors.background,
                                                        border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        fontSize: '12px',
                                                        userSelect: 'none'
                                                    }}
                                                >
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }} />
                                                    {role.name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
