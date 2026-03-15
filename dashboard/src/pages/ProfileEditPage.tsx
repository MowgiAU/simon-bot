import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { 
    User, Music, Share2, Hammer, Save, Plus, X, Instagram, Youtube, 
    MessageCircle, Radio, ExternalLink, Copy, Check, ArrowLeft, Play, AlertCircle
} from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { Link, useNavigate } from 'react-router-dom';

const GEAR_CATEGORIES = [
    'DAW', 'VST / Plugin', 'Monitor', 'Synth', 'Keyboard / Controller',
    'Audio Interface', 'Microphone', 'Hardware', 'Headphones', 'Other'
];

interface MusicianProfile {
    id?: string;
    userId?: string;
    username?: string;
    displayName?: string | null;
    avatar?: string | null;
    bio: string | null;
    spotifyUrl: string | null;
    soundcloudUrl: string | null;
    youtubeUrl: string | null;
    instagramUrl: string | null;
    discordUrl: string | null;
    gearList: Array<{name: string; category: string}>;
    genres: { id: string; name: string }[];
    featuredTrackId?: string | null;
}

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

export const ProfileEditPage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [tracks, setTracks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [validatingName, setValidatingName] = useState(false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const profileUrl = profile?.username ? `${window.location.origin}/profile/${profile.username}` : '';

    const handleCopyLink = () => {
        if (!profileUrl) return;
        navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                if (!authLoading) window.location.href = '/api/auth/discord/login';
                return;
            }
            setLoading(true);
            try {
                const [profileRes, genresRes] = await Promise.all([
                    axios.get(`/api/musician/profile/${user.id}`, { withCredentials: true }),
                    axios.get('/api/musician/genres', { withCredentials: true })
                ]);
                
                const data = profileRes.data;
                const rawGear = (data?.hardware || data?.gearList || []) as string[];
                if (data) data.gearList = rawGear.map((item: string) => { try { return JSON.parse(item); } catch { return { name: item, category: 'Other' }; } });
                if (data && data.tracks) setTracks(data.tracks);
                if (data && data.socials && Array.isArray(data.socials)) {
                    data.socials.forEach((s: any) => {
                        if (s.platform === 'spotify') data.spotifyUrl = s.url;
                        if (s.platform === 'soundcloud') data.soundcloudUrl = s.url;
                        if (s.platform === 'youtube') data.youtubeUrl = s.url;
                        if (s.platform === 'instagram') data.instagramUrl = s.url;
                        if (s.platform === 'discord') data.discordUrl = s.url;
                    });
                }
                if (data && data.genres) {
                    data.genres = data.genres.map((pg: any) => ({
                        id: pg.genreId,
                        name: pg.genre?.name || 'Unknown'
                    }));
                }
                
                setProfile(data);
                setAllGenres(genresRes.data);
            } catch (err: any) {
                if (err.response?.status === 404) {
                    navigate('/profile/setup', { replace: true });
                } else {
                    setMessage({ type: 'error', text: 'Failed to load profile' });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.id, authLoading]);

    const handleSave = async () => {
        if (!user || !profile) return;
        if (nameError) {
            setMessage({ type: 'error', text: 'Please fix the artist name before saving.' });
            return;
        }
        setSaving(true);
        try {
            const payload = { 
                ...profile, 
                gearList: (profile.gearList || []).map(g => JSON.stringify(g)),
                genres: profile.genres?.map(g => typeof g === 'string' ? g : (g.id || (g as any).genreId)).filter(Boolean) || []
            };
            await axios.post(`/api/musician/profile/${user.id}`, payload, { withCredentials: true });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save profile' });
        } finally {
            setSaving(false);
        }
    };

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

    const handleAvatarUpload = async (file: File) => {
        if (!user || !profile) return;
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            const res = await axios.post(`/api/musician/profile/${user.id}/avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            setProfile({ ...profile, avatar: res.data.avatar });
            setMessage({ type: 'success', text: 'Profile picture updated!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upload avatar' });
        } finally {
            setUploadingAvatar(false);
            setAvatarFile(null);
        }
    };

    const addGenre = (genre: Genre) => {
        if (!profile || profile.genres.some(g => g.id === genre.id)) return;
        setProfile({ ...profile, genres: [...profile.genres, { id: genre.id, name: genre.name }] });
    };

    const removeGenre = (id: string) => {
        if (!profile) return;
        setProfile({ ...profile, genres: profile.genres.filter(g => g.id !== id) });
    };

    const addGear = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!profile) return;
        setProfile({ ...profile, gearList: [...(profile.gearList || []), { name: '', category: 'Other' }] });
    };

    const updateGear = (index: number, field: 'name' | 'category', value: string) => {
        if (!profile) return;
        const newGear = [...(profile.gearList || [])];
        newGear[index] = { ...newGear[index], [field]: value };
        setProfile({ ...profile, gearList: newGear });
    };

    const removeGear = (index: number, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!profile) return;
        setProfile({ ...profile, gearList: (profile.gearList || []).filter((_, i) => i !== index) });
    };

    const socialsList = [
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/> },
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/> },
        { key: 'youtubeUrl', label: 'YouTube', icon: <Youtube size={16}/> },
        { key: 'instagramUrl', label: 'Instagram', icon: <Instagram size={16}/> },
        { key: 'discordUrl', label: 'Discord Username', icon: <MessageCircle size={16}/>, placeholder: 'e.g. username or user#1234' },
    ];

    if (loading) return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading profile...</div>
        </DiscoveryLayout>
    );

    if (!user) {
        return (
            <DiscoveryLayout activeTab="profile">
                <div style={{ textAlign: 'center', padding: '100px', color: colors.textPrimary }}>
                    <User size={64} color={colors.primary} style={{ marginBottom: spacing.xl, opacity: 0.5 }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Authentication Required</h2>
                    <p style={{ color: colors.textSecondary, marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                        You need to be logged in to manage your musician profile.
                    </p>
                    <button 
                        onClick={() => window.location.href = '/api/auth/discord/login'}
                        style={{ backgroundColor: colors.primary, color: 'white', border: 'none', padding: '12px 32px', borderRadius: borderRadius.md, fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        Login with Discord
                    </button>
                </div>
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout activeTab="profile">
        <div style={{ padding: spacing.lg, maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <Link to="/profile" style={{ color: colors.textSecondary, display: 'flex' }}>
                    <ArrowLeft size={24} />
                </Link>
                <User size={32} color={colors.primary} style={{ marginRight: '4px' }} />
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <h1 style={{ margin: 0 }}>Edit Profile</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Customize how you appear in the community.</p>
                </div>
                {profile?.id && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View Profile" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            backgroundColor: 'rgba(255,255,255,0.05)', padding: isMobile ? '8px' : '8px 16px',
                            borderRadius: borderRadius.md, color: colors.textPrimary, textDecoration: 'none',
                            fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap'
                        }}>
                            <ExternalLink size={16} />{!isMobile && ' View Profile'}
                        </a>
                        <button onClick={handleCopyLink} title="Share Profile" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            backgroundColor: colors.primary, padding: isMobile ? '8px' : '8px 16px',
                            borderRadius: borderRadius.md, color: 'white', border: 'none', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap'
                        }}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}{!isMobile && (copied ? ' Copied!' : ' Share')}
                        </button>
                    </div>
                )}
            </div>

            {message && (
                <div style={{ 
                    padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
                    backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: message.type === 'success' ? '#4caf50' : '#f44336',
                    border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {/* Profile Details */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Share2 size={20} /> Profile Details
                    </h3>
                
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                        {/* Avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md }}>
                            <div style={{ position: 'relative' }}>
                                {profile?.avatar ? (
                                    <img 
                                        src={profile.avatar.startsWith('http') ? profile.avatar : (profile.avatar.includes('/') ? profile.avatar : `https://cdn.discordapp.com/avatars/${user?.id}/${profile.avatar}.png?size=256`)} 
                                        alt="Avatar" 
                                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${colors.primary}` }} 
                                    />
                                ) : (
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px dashed rgba(255,255,255,0.1)` }}>
                                        <User size={32} color={colors.textSecondary} />
                                    </div>
                                )}
                                <label style={{ 
                                    position: 'absolute', bottom: 0, right: 0, 
                                    backgroundColor: colors.primary, width: '28px', height: '28px', 
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    cursor: uploadingAvatar ? 'not-allowed' : 'pointer', border: `2px solid ${colors.surface}`
                                }}>
                                    <Plus size={16} color="white" />
                                    <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} style={{ display: 'none' }} disabled={uploadingAvatar} />
                                </label>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>Profile Picture</label>
                                <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: 0 }}>
                                    {uploadingAvatar ? 'Uploading... please wait.' : 'Upload a custom artist photo. Supported formats: JPG, PNG, WEBP.'}
                                </p>
                            </div>
                        </div>

                        {/* Display Name */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Artist / Display Name</label>
                            <input 
                                type="text"
                                value={profile?.displayName || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setProfile(p => p ? {...p, displayName: val || null} : null);
                                    if (val.trim().length > 0) validateArtistName(val.trim());
                                    else setNameError(null);
                                }}
                                placeholder="Your public artist name..."
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: nameError ? `1px solid ${colors.error || '#ef4444'}` : '1px solid transparent', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                            />
                            {validatingName && <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Checking name...</span>}
                            {nameError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: colors.error || '#ef4444', marginTop: '2px' }}>
                                    <AlertCircle size={14} />{nameError}
                                </div>
                            )}
                            <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>This is how your name appears publicly. Leave blank to use your Discord username.</span>
                        </div>

                        {/* Bio */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Bio (Keep it short!)</label>
                            <textarea 
                                value={profile?.bio || ''} 
                                onChange={(e) => setProfile(p => p ? {...p, bio: e.target.value} : null)}
                                placeholder="Producer / DJ / Multi-instrumentalist..."
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, minHeight: '80px', resize: 'vertical' }}
                            />
                        </div>

                        {/* Socials */}
                        {socialsList.map(social => (
                            <div key={social.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {social.icon} {social.label}
                                </label>
                                <input 
                                    type="text" 
                                    value={(profile as any)?.[social.key] || ''}
                                    onChange={(e) => setProfile(p => p ? {...p, [social.key]: e.target.value} : null)}
                                    placeholder={(social as any).placeholder || 'https://...'}
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Featured Track */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Play size={20} /> Featured Track
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>Select a track to showcase at the top of your profile.</p>
                    <select 
                        value={profile?.featuredTrackId || ''}
                        onChange={(e) => setProfile(p => p ? {...p, featuredTrackId: e.target.value || null} : null)}
                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: 'white', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="" style={{ backgroundColor: '#1A1E2E', color: 'white' }}>No featured track</option>
                        {tracks.map(t => (
                            <option key={t.id} value={t.id} style={{ backgroundColor: '#1A1E2E', color: 'white' }}>{t.title}</option>
                        ))}
                    </select>
                </div>

                {/* Genres */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Music size={20} /> Genres
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: spacing.md }}>
                        {profile?.genres?.map(g => (
                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: colors.primary, padding: '4px 8px', borderRadius: '16px', fontSize: '0.85rem' }}>
                                {g.name}
                                <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeGenre(g.id)} />
                            </div>
                        ))}
                    </div>
                    <select 
                        onChange={(e) => {
                            const genre = allGenres.find(g => g.id === e.target.value);
                            if (genre) addGenre(genre);
                            e.target.value = '';
                        }}
                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="" style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>Add a genre...</option>
                        {allGenres.filter(g => !profile?.genres?.some(pg => pg.id === g.id)).map(g => (
                            <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>{g.name}</option>
                        ))}
                    </select>
                </div>

                {/* Gear Rack */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Hammer size={20} /> Gear Rack
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        {profile?.gearList?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input type="text" value={item.name} onChange={(e) => updateGear(idx, 'name', e.target.value)}
                                    placeholder="e.g. FL Studio 21, Serum, DT 990 Pro..."
                                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                />
                                <select value={item.category} onChange={(e) => updateGear(idx, 'category', e.target.value)}
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, cursor: 'pointer', flexShrink: 0 }}>
                                    {GEAR_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} style={{ backgroundColor: '#1A1E2E', color: colors.textPrimary }}>{cat}</option>
                                    ))}
                                </select>
                                <button onClick={(e) => removeGear(idx, e)} style={{ backgroundColor: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                                    <X size={18}/>
                                </button>
                            </div>
                        ))}
                        <button onClick={(e) => addGear(e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textSecondary, cursor: 'pointer', marginTop: spacing.sm }}>
                            <Plus size={16}/> Add Equipment
                        </button>
                    </div>
                </div>

                {/* Save */}
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.md, padding: spacing.md, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    {saving ? 'Saving...' : <><Save size={20}/> Save Profile</>}
                </button>
            </div>
        </div>
        </DiscoveryLayout>
    );
};
