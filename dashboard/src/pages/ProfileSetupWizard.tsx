import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    User, Music, Share2, Hammer, Plus, X, Instagram, Youtube, 
    MessageCircle, Radio, ChevronRight, ChevronLeft, AlertCircle, Sparkles, Check
} from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

const STEPS = [
    { title: 'Welcome', icon: <Sparkles size={20} /> },
    { title: 'Profile', icon: <User size={20} /> },
    { title: 'Genres', icon: <Music size={20} /> },
    { title: 'Socials', icon: <Share2 size={20} /> },
    { title: 'Gear', icon: <Hammer size={20} /> },
];

const GEAR_CATEGORIES = [
    'DAW', 'VST / Plugin', 'Monitor', 'Synth', 'Keyboard / Controller',
    'Audio Interface', 'Microphone', 'Hardware', 'Headphones', 'Other'
];

export const ProfileSetupWizard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Profile fields
    const [displayName, setDisplayName] = useState(user?.username || '');
    const [bio, setBio] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
    const [spotifyUrl, setSpotifyUrl] = useState('');
    const [soundcloudUrl, setSoundcloudUrl] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [instagramUrl, setInstagramUrl] = useState('');
    const [discordUrl, setDiscordUrl] = useState('');
    const [gearList, setGearList] = useState<Array<{name: string; category: string}>>([]);
    const [nameError, setNameError] = useState<string | null>(null);
    const [validatingName, setValidatingName] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    useEffect(() => {
        axios.get('/api/musician/genres', { withCredentials: true })
            .then(res => setAllGenres(res.data)).catch(() => {});
    }, []);

    const validateArtistName = async (name: string) => {
        if (!name || name.trim().length === 0) { setNameError(null); return; }
        setValidatingName(true);
        try {
            const res = await axios.post('/api/musician/validate-name', { name }, { withCredentials: true });
            if (!res.data.valid) setNameError(res.data.reason || 'This name is not allowed.');
            else setNameError(null);
        } catch { setNameError(null); }
        finally { setValidatingName(false); }
    };

    const handleFinish = async () => {
        if (!user) return;
        if (nameError) { setMessage({ type: 'error', text: 'Please fix the artist name before saving.' }); return; }
        setSaving(true);
        try {
            const payload = {
                displayName: displayName || user.username,
                bio,
                spotifyUrl, soundcloudUrl, youtubeUrl, instagramUrl, discordUrl,
                gearList: gearList.filter(g => g.name.trim()).map(g => JSON.stringify(g)),
                genres: selectedGenres.map(g => g.id)
            };
            await axios.post(`/api/musician/profile/${user.id}`, payload, { withCredentials: true });

            // Upload avatar if selected
            if (avatarFile) {
                const formData = new FormData();
                formData.append('avatar', avatarFile);
                await axios.post(`/api/musician/profile/${user.id}/avatar`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    withCredentials: true
                });
            }

            navigate('/profile');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save profile' });
        } finally {
            setSaving(false);
        }
    };

    const canAdvance = () => {
        if (step === 1) return displayName.trim().length > 0 && !nameError;
        return true;
    };

    const nextStep = () => { if (step < STEPS.length - 1 && canAdvance()) setStep(step + 1); };
    const prevStep = () => { if (step > 0) setStep(step - 1); };

    const socialsList = [
        { value: spotifyUrl, set: setSpotifyUrl, label: 'Spotify', icon: <Radio size={16}/>, placeholder: 'https://open.spotify.com/artist/...' },
        { value: soundcloudUrl, set: setSoundcloudUrl, label: 'SoundCloud', icon: <Music size={16}/>, placeholder: 'https://soundcloud.com/...' },
        { value: youtubeUrl, set: setYoutubeUrl, label: 'YouTube', icon: <Youtube size={16}/>, placeholder: 'https://youtube.com/@...' },
        { value: instagramUrl, set: setInstagramUrl, label: 'Instagram', icon: <Instagram size={16}/>, placeholder: 'https://instagram.com/...' },
        { value: discordUrl, set: setDiscordUrl, label: 'Discord', icon: <MessageCircle size={16}/>, placeholder: 'e.g. username or user#1234' },
    ];

    const cardStyle: React.CSSProperties = {
        backgroundColor: colors.surface,
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '560px',
        width: '100%',
        margin: '0 auto',
        border: '1px solid rgba(255,255,255,0.05)',
    };

    const renderStep = () => {
        switch (step) {
            case 0: // Welcome
                return (
                    <div style={cardStyle}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: colors.primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <Sparkles size={40} color={colors.primary} />
                            </div>
                            <h2 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 800 }}>Welcome to Fuji Studio!</h2>
                            <p style={{ color: colors.textSecondary, fontSize: '15px', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto' }}>
                                Let's set up your musician profile. This only takes a minute and helps other producers discover your music.
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                            {[
                                { icon: <User size={18} />, text: 'Choose your artist name & bio' },
                                { icon: <Music size={18} />, text: 'Select your genres' },
                                { icon: <Share2 size={18} />, text: 'Link your social profiles' },
                                { icon: <Hammer size={18} />, text: 'Show off your gear' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ color: colors.primary, flexShrink: 0 }}>{item.icon}</div>
                                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 1: // Profile
                return (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>Your Identity</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '28px' }}>How should other producers know you?</p>

                        {/* Avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
                            <div style={{ position: 'relative' }}>
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${colors.primary}` }} />
                                ) : (
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.1)' }}>
                                        <User size={32} color={colors.textSecondary} />
                                    </div>
                                )}
                                <label style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary, width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `2px solid ${colors.surface}` }}>
                                    <Plus size={16} color="white" />
                                    <input type="file" accept="image/*" onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setAvatarFile(file);
                                            const reader = new FileReader();
                                            reader.onload = ev => setAvatarPreview(ev.target?.result as string);
                                            reader.readAsDataURL(file);
                                        }
                                    }} style={{ display: 'none' }} />
                                </label>
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>Upload a profile picture</p>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: '4px 0 0' }}>JPG, PNG, or WEBP</p>
                            </div>
                        </div>

                        {/* Display Name */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '13px', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Artist Name *</label>
                            <input
                                type="text" value={displayName}
                                onChange={e => { setDisplayName(e.target.value); if (e.target.value.trim().length > 0) validateArtistName(e.target.value.trim()); else setNameError(null); }}
                                placeholder="Your public artist name..."
                                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.05)', border: nameError ? `1px solid ${colors.error || '#ef4444'}` : '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '12px', color: colors.textPrimary, fontSize: '15px' }}
                            />
                            {validatingName && <span style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px', display: 'block' }}>Checking name...</span>}
                            {nameError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.error || '#ef4444', marginTop: '4px' }}>
                                    <AlertCircle size={14} />{nameError}
                                </div>
                            )}
                        </div>

                        {/* Bio */}
                        <div>
                            <label style={{ fontSize: '13px', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Bio</label>
                            <textarea
                                value={bio} onChange={e => setBio(e.target.value)}
                                placeholder="Producer / DJ / Multi-instrumentalist..."
                                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '12px', color: colors.textPrimary, minHeight: '80px', resize: 'vertical', fontSize: '14px' }}
                            />
                        </div>
                    </div>
                );

            case 2: // Genres
                return (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>Your Sound</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '28px' }}>Select the genres that best describe your music. This helps other producers find you.</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                            {selectedGenres.map(g => (
                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: colors.primary, padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                                    {g.name}
                                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => setSelectedGenres(prev => prev.filter(sg => sg.id !== g.id))} />
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                            {allGenres.filter(g => !selectedGenres.some(sg => sg.id === g.id)).map(g => (
                                <button key={g.id} onClick={() => setSelectedGenres(prev => [...prev, g])}
                                    style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', textAlign: 'left' }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = colors.primary + '55'; e.currentTarget.style.color = 'white'; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = colors.textSecondary; }}>
                                    {g.name}
                                </button>
                            ))}
                        </div>
                        {allGenres.length === 0 && <p style={{ color: colors.textSecondary, fontSize: '13px', textAlign: 'center', padding: '20px' }}>No genres available yet.</p>}
                    </div>
                );

            case 3: // Socials
                return (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>Connect Your Socials</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '28px' }}>Link your profiles so fans can find you everywhere. All fields are optional.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {socialsList.map(social => (
                                <div key={social.label}>
                                    <label style={{ fontSize: '13px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                        {social.icon} {social.label}
                                    </label>
                                    <input
                                        type="text" value={social.value} onChange={e => social.set(e.target.value)}
                                        placeholder={social.placeholder}
                                        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '12px', color: colors.textPrimary, fontSize: '14px' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 4: // Gear
                return (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>Your Gear Rack</h2>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '28px' }}>Add each piece of equipment you use and choose its category. This is optional.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {gearList.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="text" value={item.name} onChange={e => { const n = [...gearList]; n[idx] = { ...n[idx], name: e.target.value }; setGearList(n); }}
                                        placeholder="e.g. FL Studio 21, Serum, DT 990 Pro..."
                                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '12px', color: colors.textPrimary, fontSize: '14px' }}
                                    />
                                    <select value={item.category} onChange={e => { const n = [...gearList]; n[idx] = { ...n[idx], category: e.target.value }; setGearList(n); }}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '12px', color: colors.textPrimary, cursor: 'pointer', flexShrink: 0 }}>
                                        {GEAR_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat} style={{ backgroundColor: '#1A1E2E', color: colors.textPrimary }}>{cat}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => setGearList(gearList.filter((_, i) => i !== idx))}
                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => setGearList([...gearList, { name: '', category: 'Other' }])}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px' }}>
                                <Plus size={16} /> Add Equipment
                            </button>
                        </div>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 20px' }}>
                {/* Progress Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px' }}>
                    {STEPS.map((s, i) => (
                        <React.Fragment key={i}>
                            <div
                                onClick={() => { if (i <= step) setStep(i); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 14px', borderRadius: '10px',
                                    backgroundColor: i === step ? colors.primary + '20' : i < step ? colors.primary + '10' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${i === step ? colors.primary + '55' : i < step ? colors.primary + '33' : 'rgba(255,255,255,0.05)'}`,
                                    cursor: i <= step ? 'pointer' : 'default',
                                    transition: 'all 0.2s',
                                    flex: 1, justifyContent: 'center',
                                }}
                            >
                                <div style={{ color: i <= step ? colors.primary : colors.textSecondary, display: 'flex' }}>
                                    {i < step ? <Check size={16} /> : s.icon}
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: i <= step ? 'white' : colors.textSecondary, display: isMobile ? 'none' : 'inline' }}>
                                    {s.title}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div style={{ width: '20px', height: '2px', backgroundColor: i < step ? colors.primary + '55' : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {message && (
                    <div style={{ padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
                        backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                        color: message.type === 'success' ? '#4caf50' : '#f44336',
                        border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`
                    }}>{message.text}</div>
                )}

                {renderStep()}

                {/* Navigation Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', maxWidth: '560px', margin: '24px auto 0' }}>
                    {step > 0 ? (
                        <button onClick={prevStep} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 24px', borderRadius: '12px',
                            backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600
                        }}>
                            <ChevronLeft size={18} /> Back
                        </button>
                    ) : <div />}

                    {step < STEPS.length - 1 ? (
                        <button onClick={nextStep} disabled={!canAdvance()} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 28px', borderRadius: '12px',
                            backgroundColor: canAdvance() ? colors.primary : 'rgba(255,255,255,0.1)',
                            border: 'none', color: 'white', cursor: canAdvance() ? 'pointer' : 'not-allowed',
                            fontSize: '14px', fontWeight: 700, boxShadow: canAdvance() ? `0 4px 15px ${colors.primary}44` : 'none'
                        }}>
                            Continue <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button onClick={handleFinish} disabled={saving} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 32px', borderRadius: '12px',
                            backgroundColor: colors.primary, border: 'none', color: 'white',
                            cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700,
                            boxShadow: `0 4px 15px ${colors.primary}44`
                        }}>
                            {saving ? 'Setting up...' : <><Sparkles size={18} /> Finish Setup</>}
                        </button>
                    )}
                </div>

                {/* Skip link */}
                {step > 0 && step < STEPS.length - 1 && (
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button onClick={nextStep} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
                            Skip this step
                        </button>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
