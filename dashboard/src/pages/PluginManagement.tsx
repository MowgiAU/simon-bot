import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { Settings, Shield, Power, Users, Lock, ChevronDown, ChevronUp } from 'lucide-react';

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

interface Role {
    id: string;
    name: string;
    color: number;
}

export const PluginManagementPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
    const [settings, setSettings] = useState<PluginSetting[]>([]);
    const [accessRoles, setAccessRoles] = useState<string[]>([]); // roles allowed to login
    
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Expanded state for role configuration per plugin
    const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!selectedGuild) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [metaRes, settingsRes, rolesRes] = await Promise.all([
                    axios.get('/api/plugins/list', { withCredentials: true }),
                    axios.get(`/api/guilds/${selectedGuild.id}/plugins-settings`, { withCredentials: true }),
                    axios.get(`/api/guilds/${selectedGuild.id}/roles`, { withCredentials: true })
                ]);
                
                setPlugins(metaRes.data);
                setSettings(settingsRes.data.plugins);
                setAccessRoles(settingsRes.data.access.allowedRoles);
                setRoles(rolesRes.data
                    .filter((r: any) => r.name !== '@everyone')
                    .sort((a: any, b: any) => b.position - a.position));
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedGuild]);

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

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: colors.textSecondary }}>
            Loading plugins configuration...
        </div>
    );

    return (
        <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1000px', margin: '0 auto' }}>
             <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Settings size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '12px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '32px' }}>Plugin Management </h1>
                </div>
                <div>
                    <p style={{ margin: '0 0 4px', color: colors.textSecondary, fontSize: isMobile ? '14px' : '16px' }}>Enable/Disable features and control who can access them.</p>
                    <p style={{ margin: 0, fontSize: '12px', color: colors.warning }}>
                        Note: Changes to plugin status may take up to 30 seconds to update on the bot.
                    </p>
                </div>
            </div>

            {/* Dashboard Access */}
            <div style={{ background: colors.surface, padding: isMobile ? '16px' : '24px', borderRadius: borderRadius.lg, marginBottom: '24px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: isMobile ? '18px' : '22px' }}>
                    <Lock size={20} /> Dashboard Access
                </h2>
                <p style={{ color: colors.textSecondary, marginBottom: '16px', fontSize: '14px' }}>
                    Select roles that are allowed to login and view this dashboard. 
                    (Admins always have access).
                </p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {roles.map(role => {
                         const isSelected = accessRoles.includes(role.id);
                         return (
                            <div 
                                key={role.id}
                                onClick={() => toggleAccessRole(role.id)}
                                style={{ 
                                    padding: '6px 12px', 
                                    borderRadius: '20px', 
                                    cursor: 'pointer',
                                    backgroundColor: isSelected ? 'rgba(88, 101, 242, 0.2)' : 'rgba(0,0,0,0.2)',
                                    border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '13px',
                                    userSelect: 'none'
                                }}
                            >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }} />
                                {role.name}
                            </div>
                         );
                    })}
                </div>
            </div>

            {/* Plugin List */}
            <div style={{ display: 'grid', gap: '16px' }}>
                {plugins.map(plugin => {
                    const setting = settings.find(s => s.pluginId === plugin.id);
                    const isEnabled = setting ? setting.enabled : true; // Default enabled
                    const isExpanded = expandedPlugin === plugin.id;

                    return (
                        <div key={plugin.id} style={{ background: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
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
                                                color: isEnabled ? colors.primary : '#ccc',
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
                                            backgroundColor: isEnabled ? colors.primary : '#4a4a4a', 
                                            transition: '.4s', borderRadius: '34px' 
                                        }}>
                                            <span style={{ 
                                                position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                                backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
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
                                        {roles.map(role => {
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
                                                        backgroundColor: isSelected ? 'rgba(88, 101, 242, 0.2)' : 'rgba(0,0,0,0.2)',
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
