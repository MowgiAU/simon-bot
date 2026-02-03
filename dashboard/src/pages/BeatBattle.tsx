import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { Music, Settings, Play, Archive, MessageSquare, Trophy, AlertTriangle } from 'lucide-react';

interface BattleConfig {
    announcementChannelId: string;
    submissionChannelId: string;
    archiveCategoryId: string;
    managerRoleId: string;
}

interface Battle {
    id: string;
    title: string;
    number: number;
    status: string;
    startDate: string;
    endDate: string;
    description: string;
    _count: { submissions: number };
}

export const BeatBattlePage: React.FC<{ guildId: string }> = ({ guildId }) => {
    const [activeTab, setActiveTab] = useState<'control' | 'settings'>('control');
    const [config, setConfig] = useState<BattleConfig>({ announcementChannelId: '', submissionChannelId: '', archiveCategoryId: '', managerRoleId: '' });
    const [battle, setBattle] = useState<Battle | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [metadata, setMetadata] = useState({ title: 'New Battle', number: 1, description: '', startDate: '', endDate: '' });

    useEffect(() => {
        fetchData();
    }, [guildId]);

    const fetchData = async () => {
        try {
            const [cfgRes, battleRes] = await Promise.all([
                axios.get(`/api/guilds/${guildId}/beat-battle/config`, { withCredentials: true }),
                axios.get(`/api/guilds/${guildId}/beat-battle/current`, { withCredentials: true })
            ]);
            setConfig(cfgRes.data);
            setBattle(battleRes.data);
            if (battleRes.data) {
                setMetadata({
                    title: battleRes.data.title,
                    number: battleRes.data.number,
                    description: battleRes.data.description || '',
                    startDate: battleRes.data.startDate ? new Date(battleRes.data.startDate).toISOString().split('T')[0] : '',
                    endDate: battleRes.data.endDate ? new Date(battleRes.data.endDate).toISOString().split('T')[0] : ''
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdate = async () => {
        try {
            await axios.post(`/api/guilds/${guildId}/beat-battle/manage`, {
                battleId: battle?.id,
                ...metadata
            }, { withCredentials: true });
            fetchData();
            alert('Saved!');
        } catch (e) {
            alert('Error saving');
        }
    };
    
    const handleConfigSave = async () => {
        try {
            await axios.post(`/api/guilds/${guildId}/beat-battle/config`, config, { withCredentials: true });
            alert('Config Saved!');
        } catch (e) {
            alert('Error saving config');
        }
    };

    const triggerAction = async (action: string) => {
        if (!battle) return;
        if (!confirm(`Are you sure you want to trigger: ${action}?`)) return;
        
        try {
            await axios.post(`/api/guilds/${guildId}/beat-battle/transition`, {
                battleId: battle.id,
                action
            }, { withCredentials: true });
            fetchData(); // Refresh to see new status
        } catch (e) {
            alert('Action failed');
        }
    };

    const buttonStyle = {
        padding: '10px 16px',
        backgroundColor: colors.primary,
        color: 'white',
        border: 'none',
        borderRadius: borderRadius.md,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '8px'
    };
    
    const actionBtnStyle = (disabled: boolean) => ({
        ...buttonStyle,
        backgroundColor: disabled ? colors.background : colors.secondary,
        color: disabled ? colors.textSecondary : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer'
    });

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Music size={32} color={colors.primary} />
                    <h1 style={{ margin: 0 }}>Beat Battle Manager</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setActiveTab('control')} style={{ ...buttonStyle, backgroundColor: activeTab === 'control' ? colors.primary : colors.surface }}>Control</button>
                    <button onClick={() => setActiveTab('settings')} style={{ ...buttonStyle, backgroundColor: activeTab === 'settings' ? colors.primary : colors.surface }}>Settings</button>
                </div>
            </div>

            {activeTab === 'control' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                    <div>
                        {/* Battle Card */}
                        <div style={{ backgroundColor: colors.surface, padding: '24px', borderRadius: borderRadius.md, marginBottom: '24px' }}>
                            <h2 style={{ marginTop: 0 }}>Current Battle: {battle ?  `${battle.title} #${battle.number}` : 'None Active'}</h2>
                            
                            {battle ? (
                                <div>
                                    <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', background: colors.primary, fontSize: '12px' }}>{battle.status}</span>
                                        <span style={{ color: colors.textSecondary }}>{battle._count?.submissions || 0} Submissions</span>
                                    </div>
                                    
                                    <h3 style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px' }}>Sequencer</h3>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {/* SETUP -> ANNOUNCING */}
                                        <button 
                                            onClick={() => triggerAction('ANNOUNCE')}
                                            disabled={battle.status !== 'SETUP' && battle.status !== 'ANNOUNCED'} 
                                            style={actionBtnStyle(battle.status !== 'SETUP' && battle.status !== 'ANNOUNCED')}
                                        >
                                            <MessageSquare size={16} /> 1. Announce
                                        </button>

                                        {/* ANNOUNCED -> OPEN_SUBS */}
                                        <button 
                                            onClick={() => triggerAction('OPEN_SUBS')}
                                            disabled={battle.status !== 'ANNOUNCED' && battle.status !== 'SUBMISSIONS'}
                                            style={actionBtnStyle(battle.status !== 'ANNOUNCED' && battle.status !== 'SUBMISSIONS')}
                                        >
                                            <Play size={16} /> 2. Open Submissions
                                        </button>

                                        {/* OPEN_SUBS -> START_VOTING */}
                                        <button 
                                            onClick={() => triggerAction('START_VOTING')}
                                            disabled={battle.status !== 'SUBMISSIONS'}
                                            style={actionBtnStyle(battle.status !== 'SUBMISSIONS')}
                                        >
                                            <AlertTriangle size={16} /> 3. Start Voting
                                        </button>

                                        {/* VOTING -> END */}
                                        <button 
                                            onClick={() => triggerAction('END')}
                                            disabled={battle.status !== 'VOTING'}
                                            style={actionBtnStyle(battle.status !== 'VOTING')}
                                        >
                                            <Trophy size={16} /> 4. Declare Winners
                                        </button>

                                        {/* ENDED -> ARCHIVE */}
                                        <button 
                                            onClick={() => triggerAction('ARCHIVE')}
                                            disabled={battle.status !== 'ENDED'}
                                            style={actionBtnStyle(battle.status !== 'ENDED')}
                                        >
                                            <Archive size={16} /> 5. Archive
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <p>No active battle found.</p>
                                    <button onClick={handleCreateOrUpdate} style={buttonStyle}>Start New Battle Setup</button>
                                </div>
                            )}
                        </div>

                        {/* Metadata Editor */}
                         <div style={{ backgroundColor: colors.surface, padding: '24px', borderRadius: borderRadius.md }}>
                            <h3 style={{ marginTop: 0 }}>Metadata</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Title</label>
                                    <input 
                                        style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white' }}
                                        value={metadata.title}
                                        onChange={e => setMetadata({...metadata, title: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Battle #</label>
                                    <input 
                                        type="number"
                                        style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white' }}
                                        value={metadata.number}
                                        onChange={e => setMetadata({...metadata, number: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Description / Rules</label>
                            <textarea 
                                style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white', minHeight: '100px' }}
                                value={metadata.description}
                                onChange={e => setMetadata({...metadata, description: e.target.value})}
                            />
                            <div style={{ marginTop: '16px' }}>
                                <button onClick={handleCreateOrUpdate} style={buttonStyle}>Save Metadata</button>
                            </div>
                         </div>
                    </div>
                    
                    {/* Sidebar Info */}
                    <div>
                         <div style={{ backgroundColor: colors.surface, padding: '24px', borderRadius: borderRadius.md }}>
                            <h4>Info</h4>
                            <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
                                Ensure the bot has "Manage Channels" and "Manage Messages" permissions in the submitted channels.
                            </p>
                         </div>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div style={{ maxWidth: '600px', backgroundColor: colors.surface, padding: '24px', borderRadius: borderRadius.md }}>
                    <h3 style={{ marginTop: 0 }}>Guild Configuration</h3>
                    
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px' }}>Announcement Channel ID</label>
                        <input 
                             style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white' }}
                             value={config.announcementChannelId || ''}
                             onChange={e => setConfig({...config, announcementChannelId: e.target.value})}
                             placeholder="Channel ID (123456...)"
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px' }}>Submissions Channel ID</label>
                         <input 
                             style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white' }}
                             value={config.submissionChannelId || ''}
                             onChange={e => setConfig({...config, submissionChannelId: e.target.value})}
                              placeholder="Channel ID (123456...)"
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px' }}>Archive Category ID</label>
                         <input 
                             style={{ width: '100%', padding: '8px', background: colors.background, border: `1px solid ${colors.border}`, color: 'white' }}
                             value={config.archiveCategoryId || ''}
                             onChange={e => setConfig({...config, archiveCategoryId: e.target.value})}
                              placeholder="Category ID (123456...)"
                        />
                    </div>
                    
                    <button onClick={handleConfigSave} style={buttonStyle}>Save Configuration</button>
                </div>
            )}
        </div>
    );
};
