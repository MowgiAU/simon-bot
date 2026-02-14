import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthProvider';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { Save, Plus, Trash2, Shield, MessageSquare, Mic, Bell, UserPlus, Zap, Award } from 'lucide-react';
import ChannelSelect from '../components/ChannelSelect'; // Assuming this exists based on instructions

const CommunityProgression = () => {
    const { selectedGuild } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('xp'); // xp, rewards, onboarding
    
    const [settings, setSettings] = useState<any>({
        enabled: true,
        xpTextMin: 15,
        xpTextMax: 25,
        xpTextCooldown: 60,
        xpVoicePerTick: 10,
        xpVoiceTickSeconds: 300,
        xpReaction: 5,
        announceLevelUp: true,
        announceChannelId: '',
        onboardingEnabled: false,
        autoRoles: [],
        ignoreBots: true,
        minAccountAgeDays: 0,
        joinDelaySeconds: 0,
        stickyEnabled: true,
        rewards: []
    });

    const [roles, setRoles] = useState<any[]>([]);
    const [newReward, setNewReward] = useState({ level: 5, roleId: '', stackPrevious: false });

    useEffect(() => {
        if (!selectedGuild) return;
        fetchData();
    }, [selectedGuild]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settingsRes, rolesRes] = await Promise.all([
                axios.get(`/api/guilds/${selectedGuild?.id}/levelling`),
                axios.get(`/api/guilds/${selectedGuild?.id}/roles`)
            ]);
            setSettings(settingsRes.data);
            setRoles(rolesRes.data);
        } catch (error) {
            console.error('Failed to fetch progression data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedGuild) return;
        setSaving(true);
        try {
            await axios.patch(`/api/guilds/${selectedGuild.id}/levelling`, settings);
            // Re-fetch to confirm
            const res = await axios.get(`/api/guilds/${selectedGuild.id}/levelling`);
            setSettings(prev => ({ ...prev, ...res.data }));
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save', error);
            alert('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddReward = async () => {
        if (!selectedGuild || !newReward.roleId) return;
        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/levelling/rewards`, newReward);
            fetchData(); // Refresh list
            setNewReward({ level: 5, roleId: '', stackPrevious: false });
        } catch (error) {
            console.error('Failed to add reward', error);
        }
    };

    const handleDeleteReward = async (id: string) => {
        if (!selectedGuild) return;
        try {
            await axios.delete(`/api/guilds/${selectedGuild.id}/levelling/rewards/${id}`);
            setSettings(prev => ({
                ...prev,
                rewards: prev.rewards.filter((r: any) => r.id !== id)
            }));
        } catch (error) {
            console.error('Failed to delete reward', error);
        }
    };

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) return <div style={{ padding: spacing.xl, color: colors.textPrimary }}>Loading...</div>;

    return (
        <div style={{ padding: spacing.xl, maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xl }}>
                <Award size={32} color={colors.primary} style={{ marginRight: spacing.lg }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary, ...typography.h1 }}>Community Progression</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage XP rates, level rewards, and user onboarding.</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm,
                            backgroundColor: colors.primary,
                            color: '#fff',
                            border: 'none',
                            padding: `${spacing.sm} ${spacing.lg}`,
                            borderRadius: borderRadius.md,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: 0, color: colors.textPrimary }}>
                    The progression system tracks user activity (Text, Voice, Reactions) to award XP. 
                    Users gain levels automatically, which can trigger Role Rewards. 
                    The Onboarding module handles what happens when new users join (Auto-roles, Age gating).
                 </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg, borderBottom: `1px solid ${colors.border}` }}>
                {[
                    { id: 'xp', label: 'XP & Levelling', icon: Zap },
                    { id: 'rewards', label: 'Role Rewards', icon: Award },
                    { id: 'onboarding', label: 'Onboarding & Sticky', icon: UserPlus }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm,
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? `3px solid ${colors.primary}` : '3px solid transparent',
                            padding: `${spacing.md} ${spacing.lg}`,
                            color: activeTab === tab.id ? colors.primary : colors.textSecondary,
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                
                {/* XP TAB */}
                {activeTab === 'xp' && (
                    <>
                        <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                            <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <MessageSquare size={20} /> Text XP
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md }}>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Min XP per Message</label>
                                    <input 
                                        type="number" 
                                        value={settings.xpTextMin} 
                                        onChange={e => updateSetting('xpTextMin', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Max XP per Message</label>
                                    <input 
                                        type="number" 
                                        value={settings.xpTextMax} 
                                        onChange={e => updateSetting('xpTextMax', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Cooldown (Seconds)</label>
                                    <input 
                                        type="number" 
                                        value={settings.xpTextCooldown} 
                                        onChange={e => updateSetting('xpTextCooldown', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                            <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <Mic size={20} /> Voice XP
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>XP Amount</label>
                                    <input 
                                        type="number" 
                                        value={settings.xpVoicePerTick} 
                                        onChange={e => updateSetting('xpVoicePerTick', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Interval (Seconds)</label>
                                    <input 
                                        type="number" 
                                        value={settings.xpVoiceTickSeconds} 
                                        onChange={e => updateSetting('xpVoiceTickSeconds', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                            <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <Bell size={20} /> Alerts
                            </h3>
                            <div style={{ marginBottom: spacing.md }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textPrimary, cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={settings.announceLevelUp} 
                                        onChange={e => updateSetting('announceLevelUp', e.target.checked)}
                                    />
                                    Announce Level Ups
                                </label>
                            </div>
                            {settings.announceLevelUp && (
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Announcement Channel (Optional)</label>
                                    <ChannelSelect 
                                        value={settings.announceChannelId || ''}
                                        onChange={(val) => updateSetting('announceChannelId', val)}
                                        placeholder="Current Channel (Default)"
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* REWARDS TAB */}
                {activeTab === 'rewards' && (
                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ color: colors.textPrimary, marginBottom: spacing.lg }}>Level Rewards</h3>
                        
                        {/* Add New */}
                        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-end', marginBottom: spacing.xl, padding: spacing.md, backgroundColor: colors.background, borderRadius: borderRadius.md }}>
                            <div style={{ width: '100px' }}>
                                <label style={{ display: 'block', color: colors.textSecondary, fontSize: '12px', marginBottom: spacing.xs }}>Level</label>
                                <input 
                                    type="number" 
                                    value={newReward.level}
                                    onChange={e => setNewReward({...newReward, level: parseInt(e.target.value)})}
                                    style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: colors.textSecondary, fontSize: '12px', marginBottom: spacing.xs }}>Role Reward</label>
                                <select 
                                    value={newReward.roleId}
                                    onChange={e => setNewReward({...newReward, roleId: e.target.value})}
                                    style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                >
                                    <option value="">Select Role...</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={newReward.stackPrevious}
                                        onChange={e => setNewReward({...newReward, stackPrevious: e.target.checked})}
                                    />
                                    Stack?
                                </label>
                            </div>
                            <button 
                                onClick={handleAddReward}
                                disabled={!newReward.roleId}
                                style={{
                                    backgroundColor: colors.success,
                                    color: '#fff',
                                    border: 'none',
                                    padding: spacing.sm,
                                    borderRadius: borderRadius.sm,
                                    cursor: 'pointer',
                                    height: '38px',
                                    width: '38px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {/* List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {settings.rewards && settings.rewards.length > 0 ? (
                                settings.rewards.sort((a: any, b: any) => a.level - b.level).map((reward: any) => {
                                    const role = roles.find(r => r.id === reward.roleId);
                                    return (
                                        <div key={reward.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.background, borderRadius: borderRadius.md, borderLeft: `4px solid ${role?.color ? `#${role.color.toString(16)}` : colors.primary}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
                                                <div style={{ fontWeight: 'bold', color: colors.textPrimary, minWidth: '80px' }}>Level {reward.level}</div>
                                                <div style={{ color: colors.textSecondary }}>
                                                    Gives: <span style={{ color: colors.textPrimary, fontWeight: 500 }}>{role?.name || 'Unknown Role'}</span>
                                                </div>
                                                {reward.stackPrevious && <span style={{ fontSize: '11px', backgroundColor: colors.surface, padding: '2px 6px', borderRadius: '4px', color: colors.textTertiary }}>Stacks</span>}
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteReward(reward.id)}
                                                style={{ background: 'transparent', border: 'none', color: colors.error, cursor: 'pointer' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.textTertiary }}>No rewards configured yet.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* ONBOARDING TAB */}
                {activeTab === 'onboarding' && (
                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                            <UserPlus size={20} /> Onboarding & Persistence
                        </h3>
                        
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textPrimary, cursor: 'pointer', marginBottom: spacing.sm }}>
                                <input 
                                    type="checkbox" 
                                    checked={settings.onboardingEnabled} 
                                    onChange={e => updateSetting('onboardingEnabled', e.target.checked)}
                                />
                                <strong>Enable Onboarding Module</strong>
                            </label>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textTertiary, paddingLeft: '24px' }}>
                                Automatically assign roles when users join, with optional delays and age checks.
                            </p>
                        </div>

                        {settings.onboardingEnabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg, marginBottom: spacing.xl, paddingLeft: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Min Account Age (Days)</label>
                                    <input 
                                        type="number" 
                                        value={settings.minAccountAgeDays} 
                                        onChange={e => updateSetting('minAccountAgeDays', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>Join Delay (Seconds)</label>
                                    <input 
                                        type="number" 
                                        value={settings.joinDelaySeconds} 
                                        onChange={e => updateSetting('joinDelaySeconds', e.target.value)}
                                        style={{ width: '100%', padding: spacing.sm, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                    />
                                </div>
                            </div>
                        )}

                        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing.lg }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textPrimary, cursor: 'pointer', marginBottom: spacing.sm }}>
                                <input 
                                    type="checkbox" 
                                    checked={settings.stickyEnabled} 
                                    onChange={e => updateSetting('stickyEnabled', e.target.checked)}
                                />
                                <strong>Enable Sticky Roles</strong>
                            </label>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textTertiary, paddingLeft: '24px' }}>
                                If a user leaves and rejoins, the bot will attempt to restore their previous roles.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunityProgression;