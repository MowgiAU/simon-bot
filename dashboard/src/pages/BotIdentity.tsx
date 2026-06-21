import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius, spacing } from '../theme/theme';
import { showToast } from '../components/Toast';
import { User, Save, Image, Activity, Radio } from 'lucide-react';
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
    const [radioSettings, setRadioSettings] = useState({
        username: '',
        avatarUrl: '',
        status: 'online',
        activityType: 'PLAYING',
        activityText: '',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [mainRes, radioRes] = await Promise.all([
                axios.get('/api/bot/identity', { withCredentials: true }),
                axios.get('/api/bot/simon-identity', { withCredentials: true }),
            ]);
            setSettings(mainRes.data);
            setRadioSettings({
                username: radioRes.data.username || '',
                avatarUrl: radioRes.data.avatarUrl || '',
                status: radioRes.data.status || 'online',
                activityType: radioRes.data.activityType || 'PLAYING',
                activityText: radioRes.data.activityText || '',
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await axios.post('/api/bot/identity', settings, { withCredentials: true });
            showToast('Settings saved! Status updates take ~30 seconds. Username/Avatar may take minutes to appear in Discord — reload Discord (Ctrl+R) to check.', 'success');
        } catch (e) {
            showToast('Failed to save settings', 'error');
        }
    };

    const handleRadioSave = async () => {
        try {
            await axios.post('/api/bot/simon-identity', radioSettings, { withCredentials: true });
            showToast('Simon Bot identity saved! Changes apply within 30 seconds.', 'success');
        } catch (e) {
            showToast('Failed to save radio bot settings', 'error');
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
        marginBottom: '16px',
        boxSizing: 'border-box' as const,
    };

    const sectionStyle = {
        background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))',
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        border: '1px solid #3E455633'
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>

            {/* ── Main Bot ── */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <User size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <div>
                        <h1 style={{ margin: 0 }}>Bot Identity</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Customize how the bot appears globally.</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    style={{ padding: '10px 20px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Save size={18} /> Save Main Bot
                </button>
            </div>

            <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>Configure the main bot's Discord username, avatar, and presence status. Changes to username and avatar may take a few minutes to reflect in Discord.</p>
            </div>

            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} /> Presence
                </h3>

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Status</label>
                <select style={inputStyle} value={settings.status} onChange={(e) => setSettings({ ...settings, status: e.target.value })}>
                    <option value="online">Online</option>
                    <option value="idle">Idle</option>
                    <option value="dnd">Do Not Disturb</option>
                    <option value="invisible">Invisible</option>
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Activity Type</label>
                        <select style={inputStyle} value={settings.activityType} onChange={(e) => setSettings({ ...settings, activityType: e.target.value })}>
                            <option value="PLAYING">Playing</option>
                            <option value="WATCHING">Watching</option>
                            <option value="LISTENING">Listening</option>
                            <option value="COMPETING">Competing</option>
                            <option value="CUSTOM">Custom Status</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Activity Text</label>
                        <input style={inputStyle} value={settings.activityText || ''} onChange={(e) => setSettings({ ...settings, activityText: e.target.value })} placeholder="e.g. Help | /help" />
                    </div>
                </div>
            </div>

            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Image size={20} /> Profile
                </h3>

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Username</label>
                <input style={inputStyle} value={settings.username || ''} onChange={(e) => setSettings({ ...settings, username: e.target.value })} placeholder="Global Bot Username (Rate limited!)" />
                <p style={{ fontSize: '12px', color: colors.warning }}>Warning: Discord rate limits username changes (2 per hour).</p>

                <br />

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Avatar URL</label>
                <input style={inputStyle} value={settings.avatarUrl || ''} onChange={(e) => setSettings({ ...settings, avatarUrl: e.target.value })} placeholder="https://example.com/image.png" />
                {settings.avatarUrl && (
                    <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '12px', color: colors.textSecondary }}>Preview:</p>
                        <img src={settings.avatarUrl} alt="Avatar Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                    </div>
                )}
            </div>

            {/* ── Simon Bot (Secondary) ── */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', justifyContent: 'space-between', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Radio size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <div>
                        <h2 style={{ margin: 0 }}>Simon Bot</h2>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Secondary bot used for auto-responder and messaging. ID: 1319457675645419530</p>
                    </div>
                </div>
                <button
                    onClick={handleRadioSave}
                    style={{ padding: '10px 20px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Save size={18} /> Save Simon Bot
                </button>
            </div>

            <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>Simon Bot handles auto-responses and bot messaging. Configure its presence and profile independently. Changes take effect within 30 seconds.</p>
            </div>

            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} /> Presence
                </h3>

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Status</label>
                <select style={inputStyle} value={radioSettings.status} onChange={(e) => setRadioSettings({ ...radioSettings, status: e.target.value })}>
                    <option value="online">Online</option>
                    <option value="idle">Idle</option>
                    <option value="dnd">Do Not Disturb</option>
                    <option value="invisible">Invisible</option>
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Activity Type</label>
                        <select style={inputStyle} value={radioSettings.activityType} onChange={(e) => setRadioSettings({ ...radioSettings, activityType: e.target.value })}>
                            <option value="PLAYING">Playing</option>
                            <option value="WATCHING">Watching</option>
                            <option value="LISTENING">Listening</option>
                            <option value="COMPETING">Competing</option>
                            <option value="CUSTOM">Custom Status</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Activity Text</label>
                        <input style={inputStyle} value={radioSettings.activityText} onChange={(e) => setRadioSettings({ ...radioSettings, activityText: e.target.value })} placeholder="e.g. Answering questions" />
                    </div>
                </div>
            </div>

            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Image size={20} /> Profile
                </h3>

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Username</label>
                <input style={inputStyle} value={radioSettings.username} onChange={(e) => setRadioSettings({ ...radioSettings, username: e.target.value })} placeholder="Simon Bot Username (Rate limited!)" />
                <p style={{ fontSize: '12px', color: colors.warning }}>Warning: Discord rate limits username changes (2 per hour).</p>

                <br />

                <label style={{ display: 'block', marginBottom: '8px', color: colors.textSecondary }}>Avatar URL</label>
                <input style={inputStyle} value={radioSettings.avatarUrl} onChange={(e) => setRadioSettings({ ...radioSettings, avatarUrl: e.target.value })} placeholder="https://example.com/image.png" />
                {radioSettings.avatarUrl && (
                    <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '12px', color: colors.textSecondary }}>Preview:</p>
                        <img src={radioSettings.avatarUrl} alt="Simon Bot Avatar Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                    </div>
                )}
            </div>

        </div>
    );
};
