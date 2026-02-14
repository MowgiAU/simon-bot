import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Switch,
    FormControlLabel,
    TextField,
    Button,
    Grid,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Alert,
    CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';

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
    const { guildId } = useParams<{ guildId: string }>();
    // Removed useTheme, use colors directly

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
        fetchData();
    }, [guildId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [levelRes, onboardingRes, rolesRes] = await Promise.all([
                axios.get(`http://localhost:3001/api/guilds/${guildId}/levelling`),
                axios.get(`http://localhost:3001/api/guilds/${guildId}/onboarding`),
                axios.get(`http://localhost:3001/api/guilds/${guildId}/roles`)
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

    const saveLevelSettings = async () => {
        if (!levelSettings) return;
        try {
            setSaving(true);
            await axios.patch(`http://localhost:3001/api/guilds/${guildId}/levelling`, levelSettings);
        } catch (error) {
            console.error('Failed to save levelling settings', error);
        } finally {
            setSaving(false);
        }
    };

    const saveOnboardingSettings = async () => {
        if (!onboardingSettings) return;
        try {
            setSaving(true);
            await axios.patch(`http://localhost:3001/api/guilds/${guildId}/onboarding`, onboardingSettings);
        } catch (error) {
            console.error('Failed to save onboarding settings', error);
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

    if (loading) return <CircularProgress />;

    return (
        <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
            {/* Header/Explanation Block */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: { xs: 'flex-start', md: 'center' },
                    mb: 3,
                    gap: 2
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {/* You can replace this with an actual icon if available */}
                    <Box sx={{ width: 40, height: 40, bgcolor: colors.primary, borderRadius: '50%', mr: 2 }} />
                    <Typography variant="h4" sx={{ color: colors.primary, m: 0 }}>
                        Community Progression
                    </Typography>
                </Box>
                <Box>
                    <Typography sx={{ color: colors.textSecondary, fontSize: 16, mb: 0.5 }}>
                        Configure XP, leveling, onboarding, and automatic role rewards for your community.
                    </Typography>
                    <Typography sx={{ color: colors.warning, fontSize: 13 }}>
                        Changes may take up to 30 seconds to update on the bot.
                    </Typography>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* Leveling Section */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">XP & Leveling</Typography>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={levelSettings?.enabled || false}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, enabled: e.target.checked} : null)}
                                    />
                                }
                                label="Enabled"
                            />
                        </Box>

                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="XP per Message"
                                    type="number"
                                    value={levelSettings?.xpRateText || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, xpRateText: parseInt(e.target.value)} : null)}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="XP per 5min Voice"
                                    type="number"
                                    value={levelSettings?.xpRateVoice || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, xpRateVoice: parseInt(e.target.value)} : null)}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Cooldown (sec)"
                                    type="number"
                                    value={levelSettings?.cooldownText || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, cooldownText: parseInt(e.target.value)} : null)}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Min. Voice Users"
                                    type="number"
                                    value={levelSettings?.voiceMinUsers || 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, voiceMinUsers: parseInt(e.target.value)} : null)}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 2 }}>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={levelSettings?.announceLevelUp || false}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevelSettings(s => s ? {...s, announceLevelUp: e.target.checked} : null)}
                                    />
                                }
                                label="Announce Level Ups"
                            />
                        </Box>
                        
                        <Button variant="contained" onClick={saveLevelSettings} sx={{ mt: 2 }} disabled={saving}>
                           {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </Paper>

                    <Paper sx={{ p: 3, mt: 3 }}>
                         <Typography variant="h6" gutterBottom>Level Rewards</Typography>
                         <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <TextField
                                label="Level"
                                type="number"
                                size="small"
                                value={newRewardLevel}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRewardLevel(parseInt(e.target.value))}
                                sx={{ width: 100 }}
                            />
                            <TextField
                                select
                                label="Reward Role"
                                size="small"
                                fullWidth
                                value={newRewardRole}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRewardRole(e.target.value)}
                                SelectProps={{ native: true }}
                            >
                                {/* @ts-ignore: native select expects option children */}
                                <option value="">Select Role</option>
                                {roles.map(role => (
                                    // @ts-ignore: native select expects option children
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </TextField>
                            <IconButton onClick={addReward} color="primary" disabled={!newRewardRole}>
                                <AddIcon />
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
                                                 <DeleteIcon />
                                             </IconButton>
                                         </ListItemSecondaryAction>
                                     </ListItem>
                                 );
                             })}
                             {levelSettings?.rewards.length === 0 && (
                                 <Typography color="textSecondary" align="center">No rewards configured</Typography>
                             )}
                         </List>
                    </Paper>
                </Grid>

                {/* Onboarding Section */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Onboarding & Auto-Roles</Typography>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={onboardingSettings?.enabled || false}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOnboardingSettings(s => s ? {...s, enabled: e.target.checked} : null)}
                                    />
                                }
                                label="Enabled"
                            />
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
                    </Paper>

                    <Paper sx={{ p: 3, mt: 3 }}>
                        <Typography variant="h6" gutterBottom>Reaction Roles</Typography>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Reaction roles must be configured via commands or editing specific messages for now.
                            {' '}Use <span style={{ fontFamily: 'monospace', background: '#222', padding: '2px 6px', borderRadius: 4 }}>/reaction-role add [msgId] [emoji] [@role]</span>
                        </Alert>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CommunityProgression;
