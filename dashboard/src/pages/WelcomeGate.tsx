import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthProvider';
import { colors, borderRadius, spacing } from '../theme/theme';
import { Shield, Save, Plus, Trash2 } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

export const WelcomeGatePluginPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const isMobile = useMobile();
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedGuild) return;
        fetchData();
    }, [selectedGuild]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [setRes, roleRes, chanRes] = await Promise.all([
                axios.get(`/api/guilds/${selectedGuild?.id}/welcome`, { withCredentials: true }),
                axios.get(`/api/guilds/${selectedGuild?.id}/roles`, { withCredentials: true }),
                axios.get(`/api/guilds/${selectedGuild?.id}/channels`, { withCredentials: true })
            ]);
            setSettings(setRes.data);
            setRoles(roleRes.data);
            setChannels(chanRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await axios.post(`/api/guilds/${selectedGuild?.id}/welcome`, settings, { withCredentials: true });
            alert('Settings saved!');
        } catch (e) {
            alert('Failed to save settings');
        }
    };

    const addQuestion = () => {
        setSettings({ ...settings, questions: [...(settings.questions || []), ''] });
    };

    const updateQuestion = (index: number, val: string) => {
        const newQ = [...(settings.questions || [])];
        newQ[index] = val;
        setSettings({ ...settings, questions: newQ });
    };

    const removeQuestion = (index: number) => {
        const newQ = [...(settings.questions || [])];
        newQ.splice(index, 1);
        setSettings({ ...settings, questions: newQ });
    };

    if (loading) return <div style={{ color: colors.textSecondary, padding: '20px' }}>Loading...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '0', alignItems: isMobile ? 'flex-start' : 'center' }}>
                <Shield size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Welcome Gate</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Configure verification modal and role gating.</p>
                </div>
                <button 
                    onClick={handleSave}
                    style={{ 
                        marginLeft: isMobile ? '0' : 'auto', 
                        width: isMobile ? '100%' : 'auto',
                        padding: '10px 20px', 
                        background: colors.primary, 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: borderRadius.md,
                        cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                    }}
                >
                    <Save size={18} /> Save Settings
                </button>
            </div>

            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: '0 0 10px', color: colors.textPrimary, fontWeight: 600, fontSize: isMobile ? '14px' : '15px' }}>How it works:</p>
                 <ol style={{ margin: 0, paddingLeft: '20px', color: colors.textSecondary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>
                     <li><strong>Configure Roles:</strong> Select an "Unverified" role (assigned on join) and a "Verified" role (given after approval).</li>
                     <li><strong>Setup Channel:</strong> Select your welcome channel below. Ensure the Unverified role can ONLY see this channel.</li>
                     <li><strong>Create Panel:</strong> Run <code>/setup-welcome</code> in your Discord server's welcome channel to post the "Verify" button.</li>
                     <li><strong>Customize:</strong> Add questions below that users must answer in the modal popup.</li>
                 </ol>
            </div>

            <div style={{ background: colors.surface, padding: '24px', borderRadius: borderRadius.lg, display: 'grid', gap: '24px' }}>
                
                {/* Enable Switch */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>Enable Welcome Gate</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.textSecondary }}>Enforce verification for new members.</p>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                        <input 
                            type="checkbox" 
                            checked={settings.enabled} 
                            onChange={e => setSettings({...settings, enabled: e.target.checked})}
                            style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{ 
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                            backgroundColor: settings.enabled ? colors.primary : '#ccc', 
                            transition: '.4s', borderRadius: '34px' 
                        }}>
                            <span style={{ 
                                position: 'absolute', content: "", height: '16px', width: '16px', left: '4px', bottom: '4px', 
                                backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                transform: settings.enabled ? 'translateX(26px)' : 'translateX(0)'
                            }}/>
                        </span>
                    </label>
                </div>

                {/* Roles */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Unverified Role</label>
                        <select 
                            value={settings.unverifiedRoleId || ''} 
                            onChange={e => setSettings({...settings, unverifiedRoleId: e.target.value})}
                            style={{ width: '100%', padding: '10px', background: colors.background, color: 'white', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md }}
                        >
                            <option value="">Select Role...</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <small style={{ display: 'block', marginTop: '4px', color: colors.textSecondary }}>Assigned on join. Should deny access.</small>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Verified Role</label>
                        <select 
                            value={settings.verifiedRoleId || ''} 
                            onChange={e => setSettings({...settings, verifiedRoleId: e.target.value})}
                            style={{ width: '100%', padding: '10px', background: colors.background, color: 'white', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md }}
                        >
                            <option value="">Select Role...</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <small style={{ display: 'block', marginTop: '4px', color: colors.textSecondary }}>Given after verification. Grants access.</small>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Welcome Channel</label>
                    <select 
                        value={settings.welcomeChannelId || ''} 
                        onChange={e => setSettings({...settings, welcomeChannelId: e.target.value})}
                        style={{ width: '100%', padding: '10px', background: colors.background, color: 'white', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md }}
                    >
                        <option value="">Select Channel...</option>
                        {channels.filter(c => c.type === 0).map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                </div>

                {/* Modal Config */}
                <div>
                     <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Modal Title</label>
                     <input 
                        value={settings.modalTitle || ''}
                        onChange={e => setSettings({...settings, modalTitle: e.target.value})}
                        style={{ width: '100%', padding: '10px', background: colors.background, color: 'white', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md }}
                     />
                </div>

                <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>Verification Questions</h3>
                        <button onClick={addQuestion} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={18} /> Add Question
                        </button>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {(settings.questions || []).map((q: string, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                    value={q}
                                    onChange={e => updateQuestion(i, e.target.value)}
                                    placeholder="Enter question..."
                                    style={{ flex: 1, padding: '10px', background: colors.background, color: 'white', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md }}
                                />
                                <button onClick={() => removeQuestion(i)} style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: colors.error, borderRadius: borderRadius.md, padding: '0 12px', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        {(settings.questions || []).length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontStyle: 'italic' }}>
                                No questions added.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
