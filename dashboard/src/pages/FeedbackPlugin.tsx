import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { ChannelSelect } from '../components/ChannelSelect';
import { showToast } from '../components/Toast';
import { Play, Check, X, AlertTriangle, Settings, RefreshCw, MessageSquare } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

export const FeedbackPluginPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [activeTab, setActiveTab] = useState<'queue' | 'settings'>('queue');
    const [queue, setQueue] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const isMobile = useMobile();

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;

        const fetchData = async () => {
            if (!selectedGuild) return;
            setLoading(true);
            try {
                if (activeTab === 'queue') {
                    const res = await axios.get(`/api/feedback/queue/${selectedGuild.id}`, { withCredentials: true, signal: controller.signal });
                    if (isMounted) setQueue(res.data);
                } else {
                    const res = await axios.get(`/api/feedback/settings/${selectedGuild.id}`, { withCredentials: true, signal: controller.signal });
                    if (isMounted) setSettings(res.data);
                }
            } catch (e) {
                if (!axios.isCancel(e) && isMounted) {
                    console.error(e);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [selectedGuild, activeTab]);

    const handleAction = async (postId: string, action: 'APPROVE' | 'DENY') => {
        try {
            await axios.post(`/api/feedback/action/${selectedGuild?.id}/${postId}`, { action }, { withCredentials: true });
            setQueue(prev => prev.filter(p => p.id !== postId)); // Optimistic update
        } catch (e) {
            showToast('Action failed', 'error');
        }
    };

    const saveSettings = async () => {
        try {
            await axios.post(`/api/feedback/settings/${selectedGuild?.id}`, settings, { withCredentials: true });
            showToast('Settings saved', 'success');
        } catch (e) {
            showToast('Failed to save settings', 'error');
        }
    };

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


    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
             <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '8px' : '0' }}>
                    <MessageSquare size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '28px' }}>Feedback Moderation</h1>
                </div>
                {!isMobile && (
                    <div style={{ marginLeft: '16px' }}>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>AI-assisted moderation queue.</p>
                    </div>
                )}
            </div>
            
            {isMobile && <p style={{ margin: '0 0 16px', color: colors.textSecondary }}>AI-assisted moderation queue.</p>}

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`, border: '1px solid #3E455633' }}>
                 <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '15px' }}>Configure quality thresholds, manage the review queue, and adjust settings for automatic audio upload scanning. Tracks that pass quality checks are sent to the feedback channel.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row' }}>
                <button 
                    onClick={() => setActiveTab('queue')}
                    style={{ 
                        padding: '10px 20px', 
                        background: activeTab === 'queue' ? colors.primary : 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', 
                        color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                    }}
                >
                    <RefreshCw size={18} /> Review Queue ({queue.length})
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    style={{ 
                        padding: '10px 20px', 
                        background: activeTab === 'settings' ? colors.primary : 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', 
                        color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                    }}
                >
                    <Settings size={18} /> Settings
                </button>
            </div>

            {loading && <div style={{ color: colors.textSecondary }}>Loading...</div>}

            {!loading && activeTab === 'queue' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {queue.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', borderRadius: borderRadius.lg, border: '1px solid #3E455633' }}>
                            <Check size={48} color={colors.success} style={{ marginBottom: '16px' }} />
                            <h3>All Caught Up!</h3>
                            <p style={{ color: colors.textSecondary }}>No pending feedback or audio to review.</p>
                        </div>
                    ) : (
                        queue.map(item => (
                            <div key={item.id} style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', borderRadius: borderRadius.lg, overflow: 'hidden', border: '1px solid #3E455633' }}>
                                <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colors.background }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {item.user?.avatar ? (
                                            <img src={`https://cdn.discordapp.com/avatars/${item.userId}/${item.user.avatar}.png`} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                        ) : (
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: colors.primary }} />
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
                                        background: item.aiState === 'UNSURE' ? `${colors.warning}33` : `${colors.success}33`,
                                        color: item.aiState === 'UNSURE' ? colors.warning : colors.success,
                                        border: `1px solid ${item.aiState === 'UNSURE' ? colors.warning : colors.success}`,
                                        fontSize: '12px', fontWeight: 'bold'
                                    }}>
                                        AI: {item.aiState}
                                    </div>
                                </div>
                                <div style={{ padding: '20px' }}>
                                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: '16px', lineHeight: '1.5' }}>{item.content}</div>
                                    
                                    {item.hasAudio && item.audioUrl && (
                                        <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: (!isMobile && item.referenceUrl) ? '1fr 1fr' : '1fr', gap: '12px' }}>
                                            {/* Original Reference (if available) */}
                                            {item.referenceUrl && (
                                                <div style={{ padding: '12px', background: colors.background, borderRadius: borderRadius.md }}>
                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#aaa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#888' }} /> 
                                                        Original / Reference
                                                    </div>
                                                    <audio controls src={item.referenceUrl} style={{ width: '100%' }} />
                                                </div>
                                            )}

                                            {/* New Audio (Pending Review) */}
                                            <div style={{ padding: '12px', background: 'rgba(59, 165, 93, 0.1)', border: '1px solid rgba(59, 165, 93, 0.3)', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: colors.success, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                                                    <Play size={12} /> New Version (Review)
                                                </div>
                                                <audio controls src={item.audioUrl} style={{ width: '100%' }} />
                                                <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '4px' }}>
                                                    Source: Review Channel Proxy
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Thread Context Placeholder - In real app, fetch thread history */}
                                    <div style={{ fontSize: '12px', color: colors.textSecondary, fontStyle: 'italic' }}>
                                        Posted in Thread ID: {item.threadId}
                                    </div>
                                </div>
                                <div style={{ padding: '12px', background: colors.background, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
                                            color: colors.textPrimary, 
                                            borderRadius: borderRadius.sm, cursor: 'pointer',
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
                <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', padding: '24px', borderRadius: borderRadius.lg, border: '1px solid #3E455633' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Configuration</h3>
                    <div style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: colors.surface, borderRadius: borderRadius.md }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>Enable Feedback System</div>
                                <div style={{ fontSize: '13px', color: colors.textSecondary }}>Enforce audio requirements, deduct coins, and reward quality feedback</div>
                            </div>
                            <input type="checkbox"
                                checked={settings.enabled}
                                onChange={e => setSettings({ ...settings, enabled: e.target.checked })}
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Forum Channel</label>
                            <ChannelSelect
                                guildId={selectedGuild?.id || ''}
                                value={settings.forumChannelId || ''}
                                onChange={(val: string) => setSettings({ ...settings, forumChannelId: val })}
                                channelTypes={[15]} // Filter for Forum Channels
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Review Channel</label>
                            <ChannelSelect
                                guildId={selectedGuild?.id || ''}
                                value={settings.reviewChannelId || ''}
                                onChange={(val: string) => setSettings({ ...settings, reviewChannelId: val })}
                                channelTypes={[0]} // Text Channels
                            />
                            <small style={{ color: colors.textSecondary }}>Used to store audio files temporarily for review.</small>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px' }}>Post Cost (Coins)</label>
                                <input 
                                    type="number"
                                    value={settings.threadCost} 
                                    onChange={e => setSettings({...settings, threadCost: Number(e.target.value)})}
                                    style={{ width: '100%', padding: '10px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px' }}>Feedback Reward (Coins)</label>
                                <input 
                                    type="number"
                                    value={settings.currencyReward} 
                                    onChange={e => setSettings({...settings, currencyReward: Number(e.target.value)})}
                                    style={{ width: '100%', padding: '10px', background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, borderRadius: borderRadius.sm }}
                                />
                            </div>
                        </div>

                        <button 
                            onClick={saveSettings}
                            style={{ 
                                marginTop: '20px', padding: '12px', width: isMobile ? '100%' : 'auto',
                                background: colors.primary, color: colors.textPrimary, border: 'none', 
                                borderRadius: borderRadius.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' 
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
