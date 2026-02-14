
import React, { useState, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../components/AuthProvider';
import { Trophy, Plus, Trash2 } from 'lucide-react';

interface LevelReward {
    id: string;
    level: number;
    roleId: string;
    stackPrevious: boolean;
}

interface LevellingSettings {
    enabled: boolean;
    xpRateText: number;
    xpRateVoice: number;
    cooldownText: number;
    voiceMinUsers: number;
    announceLevelUp: boolean;
    announceChannelId: string | null;
    rewards: LevelReward[];
}

interface OnboardingSettings {
    enabled: boolean;
    autoRoles: string[];
    delaySeconds: number;
}

interface Role {
    id: string;
    name: string;
    color: number;
}

const CommunityProgression: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [levelSettings, setLevelSettings] = useState<LevellingSettings | null>(null);
    const [onboardingSettings, setOnboardingSettings] = useState<OnboardingSettings | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    
    // New Reward Form
    const [newRewardLevel, setNewRewardLevel] = useState(5);
    const [newRewardRole, setNewRewardRole] = useState('');
    
    // Auto Role Form
    const [newAutoRole, setNewAutoRole] = useState('');

    useEffect(() => {
        if (!guildId) return;
        fetchData();
    }, [guildId]);

    const fetchData = async () => {
        if (!guildId) return;
        try {
            setLoading(true);
            const [levelRes, onboardingRes, rolesRes] = await Promise.all([
                axios.get(`/api/guilds/${guildId}/levelling`),
                axios.get(`/api/guilds/${guildId}/onboarding`),
                axios.get(`/api/guilds/${guildId}/roles`)
            ]);
            setLevelSettings(levelRes.data);
            setOnboardingSettings(onboardingRes.data);
            setRoles(rolesRes.data.sort((a: Role, b: Role) => b.color - a.color));
        } catch (error) {
            console.error('Failed to fetch progression settings', error);
        } finally {
            setLoading(false);
        }
    };

    // Status message for feedback
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Save all settings (used for non-toggle changes)
    const saveLevelSettings = async (settingsOverride?: Partial<LevellingSettings>) => {
        if (!levelSettings) return;
        try {
            setSaving(true);
            const payload = { ...levelSettings, ...settingsOverride };
            await axios.patch(`/api/guilds/${guildId}/levelling`, payload);
            setLevelSettings(payload);
            setMsg({ type: 'success', text: 'Leveling settings updated.' });
        } catch (error) {
            setMsg({ type: 'error', text: 'Failed to update leveling settings.' });
        } finally {
            setSaving(false);
        }
    };

    // Save onboarding settings (used for non-toggle changes)
    const saveOnboardingSettings = async (settingsOverride?: Partial<OnboardingSettings>) => {
        if (!onboardingSettings) return;
        try {
            setSaving(true);
            const payload = { ...onboardingSettings, ...settingsOverride };
            await axios.patch(`/api/guilds/${guildId}/onboarding`, payload);
            setOnboardingSettings(payload);
            setMsg({ type: 'success', text: 'Onboarding settings updated.' });
        } catch (error) {
            setMsg({ type: 'error', text: 'Failed to update onboarding settings.' });
        } finally {
            setSaving(false);
        }
    };

    const addReward = async () => {
        if (!newRewardRole) return;
        try {
            const res = await axios.post(`http://localhost:3001/api/guilds/${guildId}/levelling/rewards`, {
                level: newRewardLevel,
                roleId: newRewardRole,
                stackPrevious: true
            });
            
            if (levelSettings) {
                setLevelSettings({
                    ...levelSettings,
                    rewards: [...levelSettings.rewards, res.data].sort((a, b) => a.level - b.level)
                });
            }
            setNewRewardRole('');
        } catch (error) {
            console.error('Failed to add reward', error);
        }
    };

    const deleteReward = async (id: string) => {
        try {
            await axios.delete(`http://localhost:3001/api/guilds/${guildId}/levelling/rewards/${id}`);
            if (levelSettings) {
                setLevelSettings({
                    ...levelSettings,
                    rewards: levelSettings.rewards.filter(r => r.id !== id)
                });
            }
        } catch (error) {
            console.error('Failed to delete reward', error);
        }
    };

    const toggleAutoRole = async (roleId: string) => {
        if (!onboardingSettings) return;
        const current = onboardingSettings.autoRoles || [];
        const newRoles = current.includes(roleId) 
            ? current.filter(id => id !== roleId)
            : [...current, roleId];
            
        setOnboardingSettings({ ...onboardingSettings, autoRoles: newRoles });
    };

    if (!guildId) return <Typography sx={{ color: colors.textSecondary, mt: 4 }}>Select a server to view progression settings.</Typography>;
    if (loading) return <CircularProgress />;


    return (
        <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
            {msg && (
                <div style={{
                    padding: '12px',
                    marginBottom: '20px',
                    borderRadius: borderRadius.md,
                    backgroundColor: msg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: msg.type === 'success' ? colors.success : colors.error,
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
                </div>
            )}
            {/* Standardized Plugin Header */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '24px' }}>
                <Trophy size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', color: colors.textPrimary }}>Community Progression</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>XP, leveling, onboarding, and automatic role rewards for your community.</p>
                </div>
            </div>
            {/* Standardized Explanation Block */}
            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: '15px' }}>
                    Configure how members earn XP, level up, and receive roles automatically. Onboarding and reaction roles help automate community management. Changes may take up to 30 seconds to update on the bot.
                </p>
            </div>

            <Grid container spacing={3}>
                {/* Leveling Section */}
                <Grid item xs={12} md={6}>
                    <div style={{ background: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.lg }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Trophy size={20} color={colors.primary} />
                                <span style={{ fontWeight: 600, fontSize: '18px', color: colors.textPrimary }}>XP & Leveling</span>
                            </div>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                <input
                                    type="checkbox"
                                    checked={!!levelSettings?.enabled}
                                    onChange={async e => {
                                        const checked = e.target.checked;
                                        setLevelSettings(s => s ? { ...s, enabled: checked } : null);
                                        await saveLevelSettings({ enabled: checked });
                                    }}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: levelSettings?.enabled ? colors.primary : colors.border,
                                    transition: '.4s', borderRadius: '34px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '', height: '16px', width: '16px', left: '4px', bottom: '4px',
                                        backgroundColor: colors.textPrimary, transition: '.4s', borderRadius: '50%',
                                        transform: levelSettings?.enabled ? 'translateX(26px)' : 'translateX(0)'
                                    }} />
                                </span>
                            </label>
                        </div>

                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="XP per Message"
                                    type="number"
                                    value={levelSettings?.xpRateText || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, xpRateText: parseInt(e.target.value)} : null)}
                                    sx={{
                                        '& .MuiInputBase-input': { color: colors.textPrimary },
                                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                                        '& .MuiInputBase-root': { background: 'transparent' },
                                        '& .Mui-disabled': { color: colors.textSecondary }
                                    }}
                                    InputLabelProps={{ style: { color: colors.textSecondary } }}
                                    inputProps={{ style: { color: colors.textPrimary } }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="XP per 5min Voice"
                                    type="number"
                                    value={levelSettings?.xpRateVoice || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, xpRateVoice: parseInt(e.target.value)} : null)}
                                    sx={{
                                        '& .MuiInputBase-input': { color: colors.textPrimary },
                                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                                        '& .MuiInputBase-root': { background: 'transparent' },
                                        '& .Mui-disabled': { color: colors.textSecondary }
                                    }}
                                    InputLabelProps={{ style: { color: colors.textSecondary } }}
                                    inputProps={{ style: { color: colors.textPrimary } }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Cooldown (sec)"
                                    type="number"
                                    value={levelSettings?.cooldownText || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, cooldownText: parseInt(e.target.value)} : null)}
                                    sx={{
                                        '& .MuiInputBase-input': { color: colors.textPrimary },
                                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                                        '& .MuiInputBase-root': { background: 'transparent' },
                                        '& .Mui-disabled': { color: colors.textSecondary }
                                    }}
                                    InputLabelProps={{ style: { color: colors.textSecondary } }}
                                    inputProps={{ style: { color: colors.textPrimary } }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Min. Voice Users"
                                    type="number"
                                    value={levelSettings?.voiceMinUsers || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, voiceMinUsers: parseInt(e.target.value)} : null)}
                                    sx={{
                                        '& .MuiInputBase-input': { color: colors.textPrimary },
                                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                                        '& .MuiInputBase-root': { background: 'transparent' },
                                        '& .Mui-disabled': { color: colors.textSecondary }
                                    }}
                                    InputLabelProps={{ style: { color: colors.textSecondary } }}
                                    inputProps={{ style: { color: colors.textPrimary } }}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 2 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={!!levelSettings?.announceLevelUp}
                                        onChange={async e => {
                                            const checked = e.target.checked;
                                            setLevelSettings(s => s ? { ...s, announceLevelUp: checked } : null);
                                            await saveLevelSettings({ announceLevelUp: checked });
                                        }}
                                        sx={{
                                            '& .MuiSwitch-switchBase.Mui-checked': {
                                                color: colors.primary,
                                            },
                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                backgroundColor: colors.primary,
                                            },
                                        }}
                                    />
                                }
                                label="Announce Level Ups"
                                sx={{ color: colors.textSecondary }}
                            />
                        </Box>
                        
                        <Button variant="contained" onClick={saveLevelSettings} sx={{ mt: 2 }} disabled={saving}>
                           {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>

                    <div style={{ background: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.lg }}>
                         <Typography variant="h6" gutterBottom>Level Rewards</Typography>
                         <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <TextField
                                label="Level"
                                type="number"
                                size="small"
                                value={newRewardLevel}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRewardLevel(parseInt(e.target.value))}
                                sx={{ width: 100,
                                    '& .MuiInputBase-input': { color: colors.textPrimary },
                                    '& .MuiInputLabel-root': { color: colors.textSecondary },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                                    '& .MuiInputBase-root': { background: 'transparent' },
                                    '& .Mui-disabled': { color: colors.textSecondary }
                                }}
                                InputLabelProps={{ style: { color: colors.textSecondary } }}
                                inputProps={{ style: { color: colors.textPrimary } }}
                            />
                            <TextField
                                select
                                label="Reward Role"
                                size="small"
                                fullWidth
                                value={newRewardRole}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRewardRole(e.target.value)}
                                SelectProps={{
                                    native: true,
                                    MenuProps: {
                                        PaperProps: {
                                            style: {
                                                backgroundColor: colors.surface,
                                                color: colors.textPrimary
                                            }
                                        }
                                    }
                                }}
                                InputLabelProps={{ shrink: true, style: { color: colors.textSecondary } }}
                                sx={{ background: colors.background, color: colors.textPrimary,
                                    '& .MuiInputBase-input': { color: colors.textPrimary },
                                    '& .MuiInputLabel-root': { color: colors.textSecondary },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                                    '& .MuiInputBase-root': { background: 'transparent' },
                                    '& .Mui-disabled': { color: colors.textSecondary }
                                }}
                            >
                                <option value="" style={{ color: colors.textSecondary }}>Select Role</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.id} style={{ color: colors.textPrimary }}>{role.name}</option>
                                ))}
                            </TextField>
                            <IconButton onClick={addReward} color="primary" disabled={!newRewardRole}>
                                <Plus size={20} />
                            </IconButton>
                         </Box>

                         <List>
                             {levelSettings?.rewards.map(reward => {
                                 const roleName = roles.find(r => r.id === reward.roleId)?.name || 'Unknown Role';
                                 return (
                                     <ListItem key={reward.id} divider>
                                         <ListItemText 
                                            primary={`Level ${reward.level}`} 
                                            secondary={`Reward: @${roleName}`} 
                                         />
                                         <ListItemSecondaryAction>
                                             <IconButton edge="end" onClick={() => deleteReward(reward.id)}>
                                                 <Trash2 size={20} />
                                             </IconButton>
                                         </ListItemSecondaryAction>
                                     </ListItem>
                                 );
                             })}
                             {levelSettings?.rewards.length === 0 && (
                                 <Typography color="textSecondary" align="center">No rewards configured</Typography>
                             )}
                         </List>
                    </div>
                </Grid>

                {/* Onboarding Section */}
                <Grid item xs={12} md={6}>
                    <div style={{ background: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.lg }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Onboarding & Auto-Roles</Typography>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                <input
                                    type="checkbox"
                                    checked={!!onboardingSettings?.enabled}
                                    onChange={async e => {
                                        const checked = e.target.checked;
                                        setOnboardingSettings(s => s ? { ...s, enabled: checked } : null);
                                        await saveOnboardingSettings({ enabled: checked });
                                    }}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: onboardingSettings?.enabled ? colors.primary : colors.border,
                                    transition: '.4s', borderRadius: '34px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '', height: '16px', width: '16px', left: '4px', bottom: '4px',
                                        backgroundColor: colors.textPrimary, transition: '.4s', borderRadius: '50%',
                                        transform: onboardingSettings?.enabled ? 'translateX(26px)' : 'translateX(0)'
                                    }} />
                                </span>
                            </label>
                        </Box>

                        <TextField
                            fullWidth
                            label="Delay before applying roles (seconds)"
                            type="number"
                            value={onboardingSettings?.delaySeconds || 0}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOnboardingSettings(s => s ? {...s, delaySeconds: parseInt(e.target.value)} : null)}
                            helperText="Useful for anti-raid / membership screening"
                            sx={{ mb: 2 }}
                        />

                        <Typography variant="subtitle2" gutterBottom>Combined Auto-Roles:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {roles.filter(r => r.name !== '@everyone').map(role => {
                                const isSelected = onboardingSettings?.autoRoles?.includes(role.id);
                                return (
                                    <Box 
                                        key={role.id}
                                        onClick={() => toggleAutoRole(role.id)}
                                        sx={{ 
                                            border: `1px solid ${isSelected ? '#4caf50' : '#ccc'}`,
                                            bgcolor: isSelected ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                                            borderRadius: 1,
                                            p: 0.5,
                                            px: 1,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            color: role.color ? `#${role.color.toString(16)}` : 'inherit',
                                            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                                        }}
                                    >
                                        {role.name}
                                    </Box>
                                )
                            })}
                        </Box>

                        <Button variant="contained" onClick={saveOnboardingSettings} disabled={saving}>
                           {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>

                    <div
                        style={{
                            background: colors.surfaceLight,
                            borderLeft: `4px solid ${colors.info}`,
                            padding: spacing.xl,
                            borderRadius: borderRadius.lg,
                            marginTop: spacing.lg,
                            marginBottom: spacing.lg,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.md }}>
                            <svg width="24" height="24" style={{ marginRight: spacing.md }} fill="none" stroke={colors.info} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            <Typography variant="h6" style={{ color: colors.info, margin: 0 }}>Reaction Roles</Typography>
                        </div>
                        <div style={{ color: colors.textPrimary, fontSize: '15px' }}>
                            Reaction roles must be configured via commands or editing specific messages for now.<br />
                            <span style={{ color: colors.textSecondary }}>Use </span>
                            <span style={{ fontFamily: 'monospace', background: colors.surface, color: colors.textPrimary, padding: '2px 8px', borderRadius: borderRadius.sm, fontSize: '14px' }}>/reaction-role add <span style={{ color: colors.textSecondary }}>[msgId]</span> <span style={{ color: colors.textSecondary }}>[emoji]</span> <span style={{ color: colors.textSecondary }}>[@role]</span></span>
                        </div>
                    </div>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CommunityProgression;
