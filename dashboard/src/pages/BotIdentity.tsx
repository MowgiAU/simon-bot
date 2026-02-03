import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { User, Save, Image, Activity } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

export const BotIdentityPage: React.FC = () => {
    const isMobile = useMobile();
    const [settings, setSettings] = useState({
        username: '',
        avatarUrl: '',
        status: 'online',
        activityType: 'PLAYING',
        activityText: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/bot/identity`, { withCredentials: true });
            setSettings(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await axios.post(`/api/bot/identity`, settings, { withCredentials: true });
            alert('Settings saved! It may take up to 30 seconds for the bot to update its presence.');
        } catch (e) {
            alert('Failed to save settings');
        }
    };

    if (loading) return <div style={{ color: colors.textSecondary, padding: '20px' }}>Loading...</div>;

    const inputStyle = {
        width: '100%',
        padding: '10px',
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.sm,
        color: colors.textPrimary,
        marginBottom: '16px'
    };

    const sectionStyle = {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <User size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <div>
                        <h1 style={{ margin: 0 }}>Bot Identity</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Customize how the bot works globally.</p>
                    </div>
                </div>
                <button 
                    onClick={handleSave}
                    style={{ 
                        padding: '10px 20px', 
                        background: colors.primary, 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: borderRadius.md,
                        cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '8px' 
                    }}
                >
                    <Save size={18} /> Save Settings
                </button>
            </div>

            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} /> Presence
                </h3>
                
                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Status</label>
                <select 
                    style={inputStyle} 
                    value={settings.status}
                    onChange={(e) => setSettings({...settings, status: e.target.value})}
                >
                    <option value="online">Online</option>
                    <option value="idle">Idle</option>
                    <option value="dnd">Do Not Disturb</option>
                    <option value="invisible">Invisible</option>
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Activity Type</label>
                        <select 
                            style={inputStyle} 
                            value={settings.activityType}
                            onChange={(e) => setSettings({...settings, activityType: e.target.value})}
                        >
                            <option value="PLAYING">Playing</option>
                            <option value="WATCHING">Watching</option>
                            <option value="LISTENING">Listening</option>
                            <option value="COMPETING">Competing</option>
                            <option value="CUSTOM">Custom Status</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Activity Text</label>
                        <input 
                            style={inputStyle} 
                            value={settings.activityText || ''}
                            onChange={(e) => setSettings({...settings, activityText: e.target.value})}
                            placeholder="e.g. Help | /help"
                        />
                    </div>
                </div>
            </div>

            <div style={sectionStyle}>
                 <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Image size={20} /> Profile
                </h3>
                
                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Username</label>
                <input 
                    style={inputStyle} 
                    value={settings.username || ''}
                    onChange={(e) => setSettings({...settings, username: e.target.value})}
                    placeholder="Global Bot Username (Rate limited!)"
                />
                <p style={{ fontSize: '12px', color: colors.warning }}>Warning: Discord rate limits username changes (2 per hour).</p>

                <br/>

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Avatar URL</label>
                <input 
                    style={inputStyle} 
                    value={settings.avatarUrl || ''}
                    onChange={(e) => setSettings({...settings, avatarUrl: e.target.value})}
                    placeholder="https://example.com/image.png"
                />
                 {settings.avatarUrl && (
                    <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '12px', color: colors.textSecondary }}>Preview:</p>
                        <img src={settings.avatarUrl} alt="Avatar Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                    </div>
                )}
            </div>
        </div>
    );
};
