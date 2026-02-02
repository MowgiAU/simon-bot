import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { ChannelSelect } from '../components/ChannelSelect';
import { Play, Check, X, AlertTriangle, Settings, RefreshCw, MessageSquare } from 'lucide-react';

export const FeedbackPluginPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [activeTab, setActiveTab] = useState<'queue' | 'settings'>('queue');
    const [queue, setQueue] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        if (!selectedGuild) return;
        setLoading(true);
        try {
            if (activeTab === 'queue') {
                const res = await axios.get(`/api/feedback/queue/${selectedGuild.id}`, { withCredentials: true });
                setQueue(res.data);
            } else {
                const res = await axios.get(`/api/feedback/settings/${selectedGuild.id}`, { withCredentials: true });
                setSettings(res.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedGuild, activeTab]);

    const handleAction = async (postId: string, action: 'APPROVE' | 'DENY') => {
        try {
            await axios.post(`/api/feedback/action/${selectedGuild?.id}/${postId}`, { action }, { withCredentials: true });
            setQueue(prev => prev.filter(p => p.id !== postId)); // Optimistic update
        } catch (e) {
            alert('Action failed');
        }
    };

    const saveSettings = async () => {
        try {
            await axios.post(`/api/feedback/settings/${selectedGuild?.id}`, settings, { withCredentials: true });
            alert('Saved');
        } catch (e) {
            alert('Failed to save');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
             <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ background: colors.primary, padding: '12px', borderRadius: '50%', marginRight: '16px' }}>
                    <MessageSquare size={24} color="white" />
                </div>
                <div>
                    <h1 style={{ margin: 0 }}>Feedback Moderation</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>AI-assisted moderation queue for music production feedback.</p>
                </div>
            </div>

            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: 0, color: colors.textPrimary }}>AI-assisted moderation queue for music production feedback. This system automatically scans feedback for quality and queues audio uploads for manual review.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <button 
                    onClick={() => setActiveTab('queue')}
                    style={{ 
                        padding: '10px 20px', 
                        background: activeTab === 'queue' ? colors.primary : colors.surface, 
                        color: 'white', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <RefreshCw size={18} /> Review Queue ({queue.length})
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    style={{ 
                        padding: '10px 20px', 
                        background: activeTab === 'settings' ? colors.primary : colors.surface, 
                        color: 'white', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Settings size={18} /> Settings
                </button>
            </div>

            {loading && <div style={{ color: colors.textSecondary }}>Loading...</div>}

            {!loading && activeTab === 'queue' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {queue.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', background: colors.surface, borderRadius: borderRadius.lg }}>
                            <Check size={48} color={colors.success} style={{ marginBottom: '16px' }} />
                            <h3>All Caught Up!</h3>
                            <p style={{ color: colors.textSecondary }}>No pending feedback or audio to review.</p>
                        </div>
                    ) : (
                        queue.map(item => (
                            <div key={item.id} style={{ background: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                                <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {item.user?.avatar ? (
                                            <img src={`https://cdn.discordapp.com/avatars/${item.userId}/${item.user.avatar}.png`} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                        ) : (
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#5865F2' }} />
                                        )}
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{item.user?.username || item.userId}</div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                                {new Date(item.createdAt).toLocaleString()} • {item.hasAudio ? 'Audio Attachment' : 'Text Feedback'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ 
                                        padding: '4px 12px', 
                                        borderRadius: '12px', 
                                        background: item.aiState === 'UNSURE' ? '#FFA50033' : '#3BA55D33',
                                        color: item.aiState === 'UNSURE' ? '#FFA500' : '#3BA55D',
                                        border: `1px solid ${item.aiState === 'UNSURE' ? '#FFA500' : '#3BA55D'}`,
                                        fontSize: '12px', fontWeight: 'bold'
                                    }}>
                                        AI: {item.aiState}
                                    </div>
                                </div>
                                <div style={{ padding: '20px' }}>
                                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: '16px', lineHeight: '1.5' }}>{item.content}</div>
                                    
                                    {item.hasAudio && item.audioUrl && (
                                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: colors.textSecondary, fontSize: '12px' }}>
                                                <Play size={14} /> Audio Preview
                                            </div>
                                            <audio controls src={item.audioUrl} style={{ width: '100%' }} />
                                            <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '4px' }}>
                                                Note: URL proxied from review channel.
                                            </div>
                                        </div>
                                    )}

                                    {/* Thread Context Placeholder - In real app, fetch thread history */}
                                    <div style={{ fontSize: '12px', color: colors.textSecondary, fontStyle: 'italic' }}>
                                        Posted in Thread ID: {item.threadId}
                                    </div>
                                </div>
                                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button 
                                        onClick={() => handleAction(item.id, 'DENY')}
                                        style={{ 
                                            padding: '8px 16px', 
                                            background: 'transparent', 
                                            border: `1px solid ${colors.error}`, 
                                            color: colors.error, 
                                            borderRadius: '4px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                    <button 
                                        onClick={() => handleAction(item.id, 'APPROVE')}
                                        style={{ 
                                            padding: '8px 16px', 
                                            background: colors.success, 
                                            border: 'none', 
                                            color: 'white', 
                                            borderRadius: '4px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <Check size={16} /> Approve & {item.hasAudio ? 'Repost' : 'Reward'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {!loading && activeTab === 'settings' && settings && (
                <div style={{ background: colors.surface, padding: '24px', borderRadius: borderRadius.lg }}>
                    <h3>Configuration</h3>
                    <div style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={settings.enabled} onChange={e => setSettings({...settings, enabled: e.target.checked})} />
                            Enable Feedback System
                        </label>
                        
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Forum Channel</label>
                            <ChannelSelect
                                value={settings.forumChannelId || ''}
                                onChange={(val: string) => setSettings({ ...settings, forumChannelId: val })}
                                channelTypes={[15]} // Filter for Forum Channels
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Review Channel</label>
                            <ChannelSelect
                                value={settings.reviewChannelId || ''}
                                onChange={(val: string) => setSettings({ ...settings, reviewChannelId: val })}
                                channelTypes={[0]} // Text Channels
                            />
                            <small style={{ color: colors.textSecondary }}>Used to store audio files temporarily for review.</small>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px' }}>Post Cost (Coins)</label>
                                <input 
                                    type="number"
                                    value={settings.threadCost} 
                                    onChange={e => setSettings({...settings, threadCost: Number(e.target.value)})}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px' }}>Feedback Reward (Coins)</label>
                                <input 
                                    type="number"
                                    value={settings.currencyReward} 
                                    onChange={e => setSettings({...settings, currencyReward: Number(e.target.value)})}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        <button 
                            onClick={saveSettings}
                            style={{ 
                                marginTop: '20px', padding: '12px', 
                                background: colors.primary, color: 'white', border: 'none', 
                                borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' 
                            }}
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
