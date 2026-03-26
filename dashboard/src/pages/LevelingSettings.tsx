import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';
import { TrendingUp, Plus, Trash2, Save, Zap } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';
import axios from 'axios';

interface LevelingSettingsData {
    enabled: boolean;
    messageXpEnabled: boolean;
    voiceXpEnabled: boolean;
    reactionXpEnabled: boolean;
    xpMultiplier: number;
    messageXpMin: number;
    messageXpMax: number;
    voiceXpPerMinute: number;
    reactionGivenXp: number;
    reactionReceivedXp: number;
    messageCooldownSec: number;
    levelUpChannelId: string | null;
    blacklistedChannels: string[];
    blacklistedRoles: string[];
    levelUpMessage: string;
    announceRoleReward: boolean;
    // Economy synergy
    economyRewardsEnabled: boolean;
    levelUpCurrencyReward: number;
    milestoneLevels: { level: number; reward: number }[];
    microRewardsEnabled: boolean;
    microRewardAmount: number;
    microRewardReactions: number;
    microRewardVoiceMin: number;
    activityScalingEnabled: boolean;
    xpBoosterEnabled: boolean;
    xpBoosterPrice: number;
    xpBoosterMultiplier: number;
    xpBoosterDurationMin: number;
}

interface RoleReward {
    id?: string;
    level: number;
    roleId: string;
    sticky: boolean;
}

interface LeaderboardEntry {
    userId: string;
    totalXp: number;
    level: number;
    messagesCount: number;
    voiceMinutes: number;
}

const defaultSettings: LevelingSettingsData = {
    enabled: true,
    messageXpEnabled: true,
    voiceXpEnabled: true,
    reactionXpEnabled: true,
    xpMultiplier: 1.0,
    messageXpMin: 15,
    messageXpMax: 25,
    voiceXpPerMinute: 5,
    reactionGivenXp: 5,
    reactionReceivedXp: 3,
    messageCooldownSec: 60,
    levelUpChannelId: null,
    blacklistedChannels: [],
    blacklistedRoles: [],
    levelUpMessage: '🎉 {user} reached **Level {level}**!',
    announceRoleReward: true,
    // Economy synergy
    economyRewardsEnabled: false,
    levelUpCurrencyReward: 50,
    milestoneLevels: [],
    microRewardsEnabled: false,
    microRewardAmount: 5,
    microRewardReactions: 10,
    microRewardVoiceMin: 10,
    activityScalingEnabled: false,
    xpBoosterEnabled: false,
    xpBoosterPrice: 500,
    xpBoosterMultiplier: 1.5,
    xpBoosterDurationMin: 60,
};

const API_BASE = '/api/leveling';

export const LevelingSettings: React.FC = () => {
    const { selectedGuild } = useAuth();
    const isMobile = useMobile();
    const [settings, setSettings] = useState<LevelingSettingsData>(defaultSettings);
    const [roleRewards, setRoleRewards] = useState<RoleReward[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [newRewardLevel, setNewRewardLevel] = useState('');
    const [newRewardRoleId, setNewRewardRoleId] = useState('');
    const [newRewardSticky, setNewRewardSticky] = useState(true);
    const [activeTab, setActiveTab] = useState<'settings' | 'rewards' | 'leaderboard' | 'economy'>('settings');
    const [newMilestoneLevel, setNewMilestoneLevel] = useState('');
    const [newMilestoneReward, setNewMilestoneReward] = useState('');

    const guildId = selectedGuild?.id;

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        Promise.all([
            axios.get(`${API_BASE}/settings/${guildId}`, { withCredentials: true }),
            axios.get(`${API_BASE}/role-rewards/${guildId}`, { withCredentials: true }),
            axios.get(`${API_BASE}/leaderboard/${guildId}?type=xp&page=0`, { withCredentials: true }),
        ])
            .then(([settingsRes, rewardsRes, lbRes]) => {
                const s = settingsRes.data;
                setSettings({
                    enabled: s.enabled,
                    messageXpEnabled: s.messageXpEnabled,
                    voiceXpEnabled: s.voiceXpEnabled,
                    reactionXpEnabled: s.reactionXpEnabled,
                    xpMultiplier: s.xpMultiplier,
                    messageXpMin: s.messageXpMin,
                    messageXpMax: s.messageXpMax,
                    voiceXpPerMinute: s.voiceXpPerMinute,
                    reactionGivenXp: s.reactionGivenXp,
                    reactionReceivedXp: s.reactionReceivedXp,
                    messageCooldownSec: s.messageCooldownSec,
                    levelUpChannelId: s.levelUpChannelId,
                    blacklistedChannels: s.blacklistedChannels || [],
                    blacklistedRoles: s.blacklistedRoles || [],
                    levelUpMessage: s.levelUpMessage,
                    announceRoleReward: s.announceRoleReward,
                    // Economy synergy
                    economyRewardsEnabled: s.economyRewardsEnabled ?? false,
                    levelUpCurrencyReward: s.levelUpCurrencyReward ?? 50,
                    milestoneLevels: (() => { try { return typeof s.milestoneLevels === 'string' ? JSON.parse(s.milestoneLevels) : (s.milestoneLevels || []); } catch { return []; } })(),
                    microRewardsEnabled: s.microRewardsEnabled ?? false,
                    microRewardAmount: s.microRewardAmount ?? 5,
                    microRewardReactions: s.microRewardReactions ?? 10,
                    microRewardVoiceMin: s.microRewardVoiceMin ?? 10,
                    activityScalingEnabled: s.activityScalingEnabled ?? false,
                    xpBoosterEnabled: s.xpBoosterEnabled ?? false,
                    xpBoosterPrice: s.xpBoosterPrice ?? 500,
                    xpBoosterMultiplier: s.xpBoosterMultiplier ?? 1.5,
                    xpBoosterDurationMin: s.xpBoosterDurationMin ?? 60,
                });
                setRoleRewards(rewardsRes.data || []);
                setLeaderboard(lbRes.data?.members || []);
            })
            .catch((err) => console.error('Failed to load leveling settings:', err))
            .finally(() => setLoading(false));
    }, [guildId]);

    const saveSettings = async () => {
        if (!guildId) return;
        setSaving(true);
        setSaveMessage('');
        try {
            await axios.post(`${API_BASE}/settings/${guildId}`, settings, { withCredentials: true });
            setSaveMessage('Settings saved!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            setSaveMessage('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const addRoleReward = async () => {
        if (!guildId || !newRewardLevel || !newRewardRoleId) return;
        const level = parseInt(newRewardLevel);
        if (isNaN(level) || level < 1) return;
        try {
            const res = await axios.post(`${API_BASE}/role-rewards/${guildId}`, {
                level,
                roleId: newRewardRoleId,
                sticky: newRewardSticky,
            }, { withCredentials: true });
            setRoleRewards(prev => {
                const filtered = prev.filter(r => r.level !== level);
                return [...filtered, res.data].sort((a, b) => a.level - b.level);
            });
            setNewRewardLevel('');
            setNewRewardRoleId('');
        } catch (err) {
            console.error('Failed to add role reward:', err);
        }
    };

    const deleteRoleReward = async (level: number) => {
        if (!guildId) return;
        try {
            await axios.delete(`${API_BASE}/role-rewards/${guildId}/${level}`, { withCredentials: true });
            setRoleRewards(prev => prev.filter(r => r.level !== level));
        } catch (err) {
            console.error('Failed to delete role reward:', err);
        }
    };

    if (!selectedGuild) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Select a server first.</div>;
    if (loading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading...</div>;

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: spacing.sm,
        backgroundColor: colors.background,
        color: colors.textPrimary,
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.border}`,
        outline: 'none',
        fontSize: '14px',
    };

    const cardStyle: React.CSSProperties = {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.lg,
        border: `1px solid ${colors.border}`,
    };

    const toggleStyle = (active: boolean): React.CSSProperties => ({
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        backgroundColor: active ? colors.primary : colors.surfaceLight,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
    });

    const toggleDot = (active: boolean): React.CSSProperties => ({
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: '#fff',
        position: 'absolute',
        top: '3px',
        left: active ? '23px' : '3px',
        transition: 'left 0.2s',
    });

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: `${spacing.sm} ${spacing.lg}`,
        backgroundColor: active ? colors.primary : 'transparent',
        color: active ? '#fff' : colors.textSecondary,
        border: `1px solid ${active ? colors.primary : colors.border}`,
        borderRadius: borderRadius.md,
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
    });

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <TrendingUp size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Leveling System</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Configure XP, levels, and role rewards</p>
                </div>
            </div>

            {/* Explanation Block */}
            <div style={{
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.lg,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Members earn XP from messages, voice activity, and reactions. As they level up, they can earn role rewards automatically. Configure XP rates, cooldowns, and blacklisted channels below.
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
                <button style={tabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>Settings</button>
                <button style={tabStyle(activeTab === 'rewards')} onClick={() => setActiveTab('rewards')}>Role Rewards</button>
                <button style={tabStyle(activeTab === 'economy')} onClick={() => setActiveTab('economy')}>Economy Rewards</button>
                <button style={tabStyle(activeTab === 'leaderboard')} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
            </div>

            {activeTab === 'settings' && (
                <>
                    {/* Master Toggle */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: colors.textPrimary }}>Enable Leveling</h3>
                                <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Toggle the entire leveling system on or off</p>
                            </div>
                            <button style={toggleStyle(settings.enabled)} onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}>
                                <div style={toggleDot(settings.enabled)} />
                            </button>
                        </div>
                    </div>

                    {/* XP Sources */}
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>XP Sources</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}>
                            {/* Message XP */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                                    <span style={{ color: colors.textPrimary, fontWeight: 500 }}>Message XP</span>
                                    <button style={toggleStyle(settings.messageXpEnabled)} onClick={() => setSettings(s => ({ ...s, messageXpEnabled: !s.messageXpEnabled }))}>
                                        <div style={toggleDot(settings.messageXpEnabled)} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: spacing.sm }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Min</label>
                                        <input type="number" value={settings.messageXpMin} onChange={e => setSettings(s => ({ ...s, messageXpMin: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Max</label>
                                        <input type="number" value={settings.messageXpMax} onChange={e => setSettings(s => ({ ...s, messageXpMax: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Voice XP */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                                    <span style={{ color: colors.textPrimary, fontWeight: 500 }}>Voice XP</span>
                                    <button style={toggleStyle(settings.voiceXpEnabled)} onClick={() => setSettings(s => ({ ...s, voiceXpEnabled: !s.voiceXpEnabled }))}>
                                        <div style={toggleDot(settings.voiceXpEnabled)} />
                                    </button>
                                </div>
                                <div>
                                    <label style={{ color: colors.textSecondary, fontSize: '12px' }}>XP per minute</label>
                                    <input type="number" value={settings.voiceXpPerMinute} onChange={e => setSettings(s => ({ ...s, voiceXpPerMinute: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                </div>
                            </div>

                            {/* Reaction XP */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                                    <span style={{ color: colors.textPrimary, fontWeight: 500 }}>Reaction XP</span>
                                    <button style={toggleStyle(settings.reactionXpEnabled)} onClick={() => setSettings(s => ({ ...s, reactionXpEnabled: !s.reactionXpEnabled }))}>
                                        <div style={toggleDot(settings.reactionXpEnabled)} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: spacing.sm }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Given</label>
                                        <input type="number" value={settings.reactionGivenXp} onChange={e => setSettings(s => ({ ...s, reactionGivenXp: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Received</label>
                                        <input type="number" value={settings.reactionReceivedXp} onChange={e => setSettings(s => ({ ...s, reactionReceivedXp: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Global Multiplier */}
                            <div>
                                <label style={{ color: colors.textPrimary, fontWeight: 500, display: 'block', marginBottom: spacing.sm }}>XP Multiplier</label>
                                <input type="number" step="0.1" min="0.1" max="10" value={settings.xpMultiplier} onChange={e => setSettings(s => ({ ...s, xpMultiplier: parseFloat(e.target.value) || 1 }))} style={inputStyle} />
                                <span style={{ color: colors.textTertiary, fontSize: '12px' }}>Applied to all XP sources (0.1 - 10x)</span>
                            </div>
                        </div>
                    </div>

                    {/* Anti-Spam */}
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Anti-Spam</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}>
                            <div>
                                <label style={{ color: colors.textPrimary, fontWeight: 500, display: 'block', marginBottom: spacing.sm }}>Message Cooldown (seconds)</label>
                                <input type="number" min="0" max="600" value={settings.messageCooldownSec} onChange={e => setSettings(s => ({ ...s, messageCooldownSec: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                <span style={{ color: colors.textTertiary, fontSize: '12px' }}>Min seconds between earning message XP</span>
                            </div>
                        </div>
                    </div>

                    {/* Channels & Roles */}
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Channels & Roles</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}>
                            <div>
                                <label style={{ color: colors.textPrimary, fontWeight: 500, display: 'block', marginBottom: spacing.sm }}>Level-Up Channel</label>
                                <ChannelSelect
                                    guildId={guildId!}
                                    value={settings.levelUpChannelId || ''}
                                    onChange={(v) => setSettings(s => ({ ...s, levelUpChannelId: (v as string) || null }))}
                                    placeholder="Select channel for level-up messages"
                                />
                            </div>
                            <div>
                                <label style={{ color: colors.textPrimary, fontWeight: 500, display: 'block', marginBottom: spacing.sm }}>Blacklisted Channels</label>
                                <ChannelSelect
                                    guildId={guildId!}
                                    value={settings.blacklistedChannels}
                                    onChange={(v) => setSettings(s => ({ ...s, blacklistedChannels: v as string[] }))}
                                    placeholder="Channels that don't earn XP"
                                    multiple
                                />
                            </div>
                            <div>
                                <label style={{ color: colors.textPrimary, fontWeight: 500, display: 'block', marginBottom: spacing.sm }}>Blacklisted Roles</label>
                                <RoleSelect
                                    guildId={guildId!}
                                    value={settings.blacklistedRoles}
                                    onChange={(v) => setSettings(s => ({ ...s, blacklistedRoles: v as string[] }))}
                                    placeholder="Roles that don't earn XP"
                                    multiple
                                />
                            </div>
                        </div>
                    </div>

                    {/* Level-Up Message */}
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Level-Up Message</h3>
                        <div style={{ marginBottom: spacing.md }}>
                            <textarea
                                value={settings.levelUpMessage}
                                onChange={e => setSettings(s => ({ ...s, levelUpMessage: e.target.value }))}
                                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                                placeholder="🎉 {user} reached **Level {level}**!"
                            />
                            <span style={{ color: colors.textTertiary, fontSize: '12px' }}>
                                Variables: {'{user}'} {'{level}'} {'{username}'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ color: colors.textPrimary, fontWeight: 500 }}>Announce Role Rewards</span>
                                <p style={{ margin: '2px 0 0', color: colors.textTertiary, fontSize: '12px' }}>Show earned roles in the level-up message</p>
                            </div>
                            <button style={toggleStyle(settings.announceRoleReward)} onClick={() => setSettings(s => ({ ...s, announceRoleReward: !s.announceRoleReward }))}>
                                <div style={toggleDot(settings.announceRoleReward)} />
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                        <button
                            onClick={saveSettings}
                            disabled={saving}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.sm,
                                padding: `${spacing.sm} ${spacing.xl}`,
                                backgroundColor: colors.primary,
                                color: '#fff',
                                border: 'none',
                                borderRadius: borderRadius.md,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                        {saveMessage && (
                            <span style={{ color: saveMessage.includes('Failed') ? colors.error : colors.success, fontSize: '14px' }}>
                                {saveMessage}
                            </span>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'rewards' && (
                <>
                    {/* Add Reward */}
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Add Role Reward</h3>
                        <p style={{ color: colors.textSecondary, fontSize: '13px', margin: '0 0 16px' }}>
                            When a member reaches a level, they automatically receive the assigned role. Sticky roles are restored if the member leaves and rejoins.
                        </p>
                        <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ minWidth: '80px' }}>
                                <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Level</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newRewardLevel}
                                    onChange={e => setNewRewardLevel(e.target.value)}
                                    style={{ ...inputStyle, width: '80px' }}
                                    placeholder="5"
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Role</label>
                                <RoleSelect
                                    guildId={guildId!}
                                    value={newRewardRoleId}
                                    onChange={(v) => setNewRewardRoleId(v as string)}
                                    placeholder="Select role"
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <label style={{ color: colors.textSecondary, fontSize: '12px' }}>
                                    <input type="checkbox" checked={newRewardSticky} onChange={e => setNewRewardSticky(e.target.checked)} /> Sticky
                                </label>
                                <button onClick={addRoleReward} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: `${spacing.sm} ${spacing.lg}`,
                                    backgroundColor: colors.primary,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: borderRadius.md,
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                }}>
                                    <Plus size={16} /> Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Rewards List */}
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Current Rewards ({roleRewards.length})</h3>
                        {roleRewards.length === 0 ? (
                            <p style={{ color: colors.textTertiary }}>No role rewards configured yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                                {roleRewards.map((reward) => (
                                    <div
                                        key={reward.level}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: spacing.md,
                                            backgroundColor: colors.background,
                                            borderRadius: borderRadius.md,
                                            border: `1px solid ${colors.border}`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                                            <span style={{
                                                backgroundColor: colors.primaryDark,
                                                color: '#fff',
                                                padding: `2px ${spacing.sm}`,
                                                borderRadius: borderRadius.sm,
                                                fontWeight: 600,
                                                fontSize: '13px',
                                            }}>
                                                Lvl {reward.level}
                                            </span>
                                            <span style={{ color: colors.textPrimary }}>
                                                Role: {reward.roleId}
                                            </span>
                                            {reward.sticky && (
                                                <span style={{
                                                    backgroundColor: colors.accent + '20',
                                                    color: colors.accent,
                                                    padding: `1px ${spacing.sm}`,
                                                    borderRadius: borderRadius.sm,
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                }}>
                                                    Sticky
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => deleteRoleReward(reward.level)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: colors.error,
                                                cursor: 'pointer',
                                                padding: spacing.xs,
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'economy' && (
                <>
                    {/* Economy Rewards Explanation */}
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: spacing.md,
                        borderRadius: borderRadius.md,
                        marginBottom: spacing.lg,
                        borderLeft: `4px solid #FFD700`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                            <Zap size={18} color="#FFD700" />
                            <span style={{ color: colors.textPrimary, fontWeight: 600 }}>Economy × Leveling Integration</span>
                        </div>
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px' }}>
                            Reward members with currency when they level up, hit milestones, or stay active. Members can also buy XP Boosters with their wallet balance. Requires the Economy plugin to be enabled.
                        </p>
                    </div>

                    {/* Master Economy Toggle */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: colors.textPrimary }}>Enable Economy Rewards</h3>
                                <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Award currency for leveling milestones and activities</p>
                            </div>
                            <button style={toggleStyle(settings.economyRewardsEnabled)} onClick={() => setSettings(s => ({ ...s, economyRewardsEnabled: !s.economyRewardsEnabled }))}>
                                <div style={toggleDot(settings.economyRewardsEnabled)} />
                            </button>
                        </div>
                    </div>

                    {settings.economyRewardsEnabled && (
                        <>
                            {/* Level-Up Currency */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Level-Up Bonus</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}>
                                    <div>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Coins per Level-Up</label>
                                        <input type="number" min={0} value={settings.levelUpCurrencyReward} onChange={e => setSettings(s => ({ ...s, levelUpCurrencyReward: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Milestone Jackpots */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Milestone Jackpots</h3>
                                <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: spacing.md }}>Award bonus currency when members reach specific levels.</p>

                                <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: spacing.md }}>
                                    <div style={{ minWidth: '80px' }}>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Level</label>
                                        <input type="number" min={1} value={newMilestoneLevel} onChange={e => setNewMilestoneLevel(e.target.value)} style={{ ...inputStyle, width: '80px' }} placeholder="10" />
                                    </div>
                                    <div style={{ minWidth: '120px' }}>
                                        <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Reward (coins)</label>
                                        <input type="number" min={1} value={newMilestoneReward} onChange={e => setNewMilestoneReward(e.target.value)} style={{ ...inputStyle, width: '120px' }} placeholder="500" />
                                    </div>
                                    <button onClick={() => {
                                        const lvl = parseInt(newMilestoneLevel);
                                        const rwd = parseInt(newMilestoneReward);
                                        if (!lvl || !rwd || lvl < 1 || rwd < 1) return;
                                        setSettings(s => ({
                                            ...s,
                                            milestoneLevels: [...s.milestoneLevels.filter(m => m.level !== lvl), { level: lvl, reward: rwd }].sort((a, b) => a.level - b.level),
                                        }));
                                        setNewMilestoneLevel('');
                                        setNewMilestoneReward('');
                                    }} style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: `${spacing.sm} ${spacing.lg}`,
                                        backgroundColor: colors.primary, color: '#fff',
                                        border: 'none', borderRadius: borderRadius.md,
                                        cursor: 'pointer', fontWeight: 500,
                                    }}>
                                        <Plus size={16} /> Add
                                    </button>
                                </div>

                                {settings.milestoneLevels.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                                        {settings.milestoneLevels.map(m => (
                                            <div key={m.level} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: spacing.md, backgroundColor: colors.background,
                                                borderRadius: borderRadius.md, border: `1px solid ${colors.border}`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                                                    <span style={{ backgroundColor: '#FFD700', color: '#000', padding: `2px ${spacing.sm}`, borderRadius: borderRadius.sm, fontWeight: 600, fontSize: '13px' }}>
                                                        Lvl {m.level}
                                                    </span>
                                                    <span style={{ color: colors.textPrimary }}>{m.reward.toLocaleString()} coins</span>
                                                </div>
                                                <button onClick={() => setSettings(s => ({ ...s, milestoneLevels: s.milestoneLevels.filter(ms => ms.level !== m.level) }))} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', padding: spacing.xs }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Micro-Rewards */}
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: colors.textPrimary }}>Micro-Rewards</h3>
                                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Award small currency amounts for reactions and voice activity</p>
                                    </div>
                                    <button style={toggleStyle(settings.microRewardsEnabled)} onClick={() => setSettings(s => ({ ...s, microRewardsEnabled: !s.microRewardsEnabled }))}>
                                        <div style={toggleDot(settings.microRewardsEnabled)} />
                                    </button>
                                </div>
                                {settings.microRewardsEnabled && (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: spacing.lg }}>
                                        <div>
                                            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Coins per Milestone</label>
                                            <input type="number" min={1} value={settings.microRewardAmount} onChange={e => setSettings(s => ({ ...s, microRewardAmount: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Every N Reactions</label>
                                            <input type="number" min={1} value={settings.microRewardReactions} onChange={e => setSettings(s => ({ ...s, microRewardReactions: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Every N Voice Minutes</label>
                                            <input type="number" min={1} value={settings.microRewardVoiceMin} onChange={e => setSettings(s => ({ ...s, microRewardVoiceMin: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Activity Scaling */}
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: colors.textPrimary }}>Activity Scaling</h3>
                                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Higher-level members earn +2% more Economy coins per 5 levels</p>
                                    </div>
                                    <button style={toggleStyle(settings.activityScalingEnabled)} onClick={() => setSettings(s => ({ ...s, activityScalingEnabled: !s.activityScalingEnabled }))}>
                                        <div style={toggleDot(settings.activityScalingEnabled)} />
                                    </button>
                                </div>
                            </div>

                            {/* XP Booster Shop */}
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: colors.textPrimary }}>XP Booster Shop</h3>
                                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Members can spend coins to buy temporary XP multipliers</p>
                                    </div>
                                    <button style={toggleStyle(settings.xpBoosterEnabled)} onClick={() => setSettings(s => ({ ...s, xpBoosterEnabled: !s.xpBoosterEnabled }))}>
                                        <div style={toggleDot(settings.xpBoosterEnabled)} />
                                    </button>
                                </div>
                                {settings.xpBoosterEnabled && (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: spacing.lg }}>
                                        <div>
                                            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Price (coins)</label>
                                            <input type="number" min={1} value={settings.xpBoosterPrice} onChange={e => setSettings(s => ({ ...s, xpBoosterPrice: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Multiplier (e.g. 1.5x)</label>
                                            <input type="number" min={1.1} max={5} step={0.1} value={settings.xpBoosterMultiplier} onChange={e => setSettings(s => ({ ...s, xpBoosterMultiplier: parseFloat(e.target.value) || 1.5 }))} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Duration (minutes)</label>
                                            <input type="number" min={5} value={settings.xpBoosterDurationMin} onChange={e => setSettings(s => ({ ...s, xpBoosterDurationMin: parseInt(e.target.value) || 60 }))} style={inputStyle} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Save Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                                <button onClick={saveSettings} disabled={saving} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: `${spacing.sm} ${spacing.xl}`,
                                    backgroundColor: saving ? colors.surfaceLight : colors.primary,
                                    color: '#fff', border: 'none', borderRadius: borderRadius.md,
                                    cursor: saving ? 'default' : 'pointer', fontWeight: 600, fontSize: '14px',
                                }}>
                                    <Save size={16} /> {saving ? 'Saving...' : 'Save Economy Settings'}
                                </button>
                                {saveMessage && <span style={{ color: saveMessage.includes('Failed') ? colors.error : colors.success, fontSize: '13px' }}>{saveMessage}</span>}
                            </div>
                        </>
                    )}
                </>
            )}

            {activeTab === 'leaderboard' && (
                <div style={cardStyle}>
                    <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Top Members</h3>
                    {leaderboard.length === 0 ? (
                        <p style={{ color: colors.textTertiary }}>No leveling data yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {leaderboard.map((entry, i) => (
                                <div
                                    key={entry.userId}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: spacing.md,
                                        backgroundColor: colors.background,
                                        borderRadius: borderRadius.md,
                                        border: `1px solid ${colors.border}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                                        <span style={{
                                            color: i < 3 ? colors.highlight : colors.textSecondary,
                                            fontWeight: 700,
                                            minWidth: '30px',
                                        }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                        </span>
                                        <span style={{ color: colors.textPrimary }}>{entry.userId}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: spacing.lg, color: colors.textSecondary, fontSize: '13px' }}>
                                        <span>Lvl {entry.level}</span>
                                        <span>{entry.totalXp.toLocaleString()} XP</span>
                                        <span>{entry.messagesCount.toLocaleString()} msgs</span>
                                        <span>{entry.voiceMinutes.toLocaleString()}m voice</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
