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

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
             <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Settings size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Plugin Management </h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Enable/Disable features and control who can access them.</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.warning }}>
                        Note: Changes to plugin status may take up to 30 seconds to update on the bot.
                    </p>
                </div>
            </div>

            {/* Dashboard Access */}
            <div style={{ background: colors.surface, padding: '24px', borderRadius: borderRadius.lg, marginBottom: '32px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Lock size={20} /> Dashboard Access
                </h2>
                <p style={{ color: colors.textSecondary, marginBottom: '16px' }}>
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
                                    fontSize: '14px'
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
                            <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '18px', fontWeight: 600 }}>{plugin.name}</div>
                                    <div style={{ color: colors.textSecondary, fontSize: '14px' }}>{plugin.description}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isEnabled}
                                            onChange={() => togglePlugin(plugin.id, isEnabled)}
                                            style={{ opacity: 0, width: 0, height: 0 }} 
                                        />
                                        <span style={{ 
                                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                            backgroundColor: isEnabled ? colors.primary : '#ccc', 
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
                                            background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        <Users size={18} />
                                        Permissions
                                        {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Permission Panel */}
                            {isExpanded && (
                                <div style={{ padding: '0 20px 20px 20px', borderTop: `1px solid ${colors.border}`, marginTop: '-5px', paddingTop: '15px' }}>
                                    <div style={{ fontSize: '14px', marginBottom: '10px', color: colors.textSecondary }}>
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
                                                        padding: '4px 10px', 
                                                        borderRadius: '16px', 
                                                        cursor: 'pointer',
                                                        backgroundColor: isSelected ? 'rgba(88, 101, 242, 0.2)' : 'rgba(0,0,0,0.2)',
                                                        border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        fontSize: '13px'
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
