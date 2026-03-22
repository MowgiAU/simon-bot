import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { 
    User, Music, Share2, Hammer, Save, Plus, X, Instagram, Youtube, 
    MessageCircle, Radio, ExternalLink, Copy, Check, ArrowLeft, Play, AlertCircle,
    Camera, Link as LinkIcon, Disc3, Star
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
    featuredPlaylistId?: string | null;
}

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

/* ─── shared inline styles ─── */
const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    padding: '24px',
};

const sectionTitle: React.CSSProperties = {
    margin: '0 0 16px',
    fontSize: '15px',
    fontWeight: 600,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    letterSpacing: '-0.01em',
};

const label: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: colors.textSecondary,
    marginBottom: '6px',
    display: 'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
};

const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: borderRadius.sm,
    padding: '10px 12px',
    color: colors.textPrimary,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
};

export const ProfileEditPage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [tracks, setTracks] = useState<any[]>([]);
    const [playlists, setPlaylists] = useState<any[]>([]);
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
                try {
                    const playlistsRes = await axios.get('/api/my-playlists', { withCredentials: true });
                    setPlaylists(playlistsRes.data || []);
                } catch { /* playlists unavailable */ }
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
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/>, placeholder: 'https://open.spotify.com/artist/...' },
        { key: 'soundcloudUrl', label: 'SoundCloud', icon: <Music size={16}/>, placeholder: 'https://soundcloud.com/...' },
        { key: 'youtubeUrl', label: 'YouTube', icon: <Youtube size={16}/>, placeholder: 'https://youtube.com/@...' },
        { key: 'instagramUrl', label: 'Instagram', icon: <Instagram size={16}/>, placeholder: 'https://instagram.com/...' },
        { key: 'discordUrl', label: 'Discord', icon: <MessageCircle size={16}/>, placeholder: 'username or user#1234' },
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

    const avatarSrc = profile?.avatar
        ? (profile.avatar.startsWith('http') ? profile.avatar : (profile.avatar.includes('/') ? profile.avatar : `https://cdn.discordapp.com/avatars/${user?.id}/${profile.avatar}.png?size=256`))
        : null;

    return (
        <DiscoveryLayout activeTab="profile">
        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '1100px', margin: '0 auto' }}>

            {/* ── Top bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Link to="/profile" style={{ color: colors.textSecondary, display: 'flex', padding: '6px', borderRadius: borderRadius.sm }}>
                    <ArrowLeft size={20} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', flex: 1 }}>Edit Profile</h1>
                {profile?.id && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                            borderRadius: borderRadius.sm, color: colors.textSecondary, textDecoration: 'none',
                            fontSize: '13px', border: `1px solid ${colors.glassBorder}`,
                        }}>
                            <ExternalLink size={14} />{!isMobile && 'View'}
                        </a>
                        <button onClick={handleCopyLink} style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                            borderRadius: borderRadius.sm, color: 'white', border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            backgroundColor: copied ? colors.success : colors.primary,
                        }}>
                            {copied ? <Check size={14} /> : <Copy size={14} />}{!isMobile && (copied ? 'Copied!' : 'Share')}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Toast ── */}
            {message && (
                <div style={{
                    padding: '12px 16px', borderRadius: borderRadius.md, marginBottom: '20px',
                    backgroundColor: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: message.type === 'success' ? colors.success : colors.error,
                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    {message.type === 'error' && <AlertCircle size={16} />}
                    {message.type === 'success' && <Check size={16} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6 }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ── Two-column layout ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '320px 1fr',
                gap: '24px',
                alignItems: 'start',
            }}>

                {/* ═══ LEFT COLUMN: Identity Card ═══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', ...(isMobile ? {} : { position: 'sticky', top: '24px' }) }}>
                    {/* Avatar card */}
                    <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="Avatar"
                                    style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${colors.primary}`, boxShadow: shadows.glow }}
                                />
                            ) : (
                                <div style={{
                                    width: '120px', height: '120px', borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${colors.surfaceLight}, ${colors.surface})`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `3px dashed rgba(255,255,255,0.1)`,
                                }}>
                                    <User size={48} color={colors.textTertiary} />
                                </div>
                            )}
                            <label style={{
                                position: 'absolute', bottom: '4px', right: '4px',
                                backgroundColor: colors.primary, width: '32px', height: '32px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                                border: `3px solid ${colors.surface}`, boxShadow: shadows.sm,
                            }}>
                                <Camera size={14} color="white" />
                                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} style={{ display: 'none' }} disabled={uploadingAvatar} />
                            </label>
                        </div>

                        {uploadingAvatar && (
                            <div style={{ fontSize: '12px', color: colors.primary, marginBottom: '8px' }}>Uploading...</div>
                        )}

                        <div style={{ fontSize: '18px', fontWeight: 700, color: colors.textPrimary, marginBottom: '4px' }}>
                            {profile?.displayName || profile?.username || 'Your Name'}
                        </div>
                        <div style={{ fontSize: '13px', color: colors.textTertiary, marginBottom: '12px' }}>
                            @{profile?.username || 'username'}
                        </div>

                        {profile?.bio && (
                            <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '0 0 12px', lineHeight: 1.5, maxWidth: '260px' }}>
                                {profile.bio.length > 100 ? profile.bio.slice(0, 100) + '...' : profile.bio}
                            </p>
                        )}

                        {/* Genre pills preview */}
                        {profile?.genres && profile.genres.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                {profile.genres.slice(0, 4).map(g => (
                                    <span key={g.id} style={{
                                        fontSize: '11px', padding: '3px 10px', borderRadius: borderRadius.pill,
                                        backgroundColor: 'rgba(16,185,129,0.12)', color: colors.primary, fontWeight: 500,
                                    }}>
                                        {g.name}
                                    </span>
                                ))}
                                {profile.genres.length > 4 && (
                                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textTertiary }}>
                                        +{profile.genres.length - 4}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick stats */}
                    <div style={{ ...card, padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>{tracks.length}</div>
                            <div style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracks</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>{profile?.gearList?.length || 0}</div>
                            <div style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gear</div>
                        </div>
                    </div>
                </div>

                {/* ═══ RIGHT COLUMN: Editable Sections ═══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* ── Identity ── */}
                    <div style={card}>
                        <div style={sectionTitle}><User size={18} color={colors.primary} /> Identity</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <span style={label}>Artist / Display Name</span>
                                <input
                                    type="text"
                                    value={profile?.displayName || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setProfile(p => p ? {...p, displayName: val || null} : null);
                                        if (val.trim().length > 0) validateArtistName(val.trim());
                                        else setNameError(null);
                                    }}
                                    placeholder="How you want to be known..."
                                    style={{ ...inputBase, ...(nameError ? { borderColor: colors.error } : {}) }}
                                />
                                {validatingName && <span style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px', display: 'block' }}>Checking...</span>}
                                {nameError && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.error, marginTop: '4px' }}>
                                        <AlertCircle size={13} />{nameError}
                                    </div>
                                )}
                                <span style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px', display: 'block' }}>
                                    Leave blank to use your Discord username.
                                </span>
                            </div>

                            <div>
                                <span style={label}>Bio</span>
                                <textarea
                                    value={profile?.bio || ''}
                                    onChange={(e) => setProfile(p => p ? {...p, bio: e.target.value} : null)}
                                    placeholder="Producer, beatmaker, multi-instrumentalist..."
                                    rows={3}
                                    style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Social Links ── */}
                    <div style={card}>
                        <div style={sectionTitle}><LinkIcon size={18} color={colors.accent} /> Social Links</div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                            {socialsList.map(social => (
                                <div key={social.key}>
                                    <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {social.icon} {social.label}
                                    </span>
                                    <input
                                        type="text"
                                        value={(profile as any)?.[social.key] || ''}
                                        onChange={(e) => setProfile(p => p ? {...p, [social.key]: e.target.value} : null)}
                                        placeholder={social.placeholder}
                                        style={inputBase}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Featured Content (Track + Release side-by-side) ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                        {/* Featured Track */}
                        <div style={card}>
                            <div style={sectionTitle}><Star size={18} color={colors.highlight} /> Featured Track</div>
                            <p style={{ fontSize: '12px', color: colors.textTertiary, margin: '0 0 12px' }}>
                                Showcase one track at the top of your profile.
                            </p>
                            <select
                                value={profile?.featuredTrackId || ''}
                                onChange={(e) => setProfile(p => p ? {...p, featuredTrackId: e.target.value || null} : null)}
                                style={{ ...inputBase, cursor: 'pointer' }}
                            >
                                <option value="" style={{ backgroundColor: colors.surface }}>None</option>
                                {tracks.map(t => (
                                    <option key={t.id} value={t.id} style={{ backgroundColor: colors.surface }}>{t.title}</option>
                                ))}
                            </select>
                        </div>

                        {/* Featured Release */}
                        <div style={card}>
                            <div style={sectionTitle}><Disc3 size={18} color={colors.accent} /> Featured Release</div>
                            <p style={{ fontSize: '12px', color: colors.textTertiary, margin: '0 0 12px' }}>
                                Showcase an album, EP, or single.
                            </p>
                            {playlists.filter(p => p.releaseType).length === 0 ? (
                                <div style={{
                                    padding: '14px', borderRadius: borderRadius.sm,
                                    backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                                    fontSize: '12px', color: colors.textTertiary, textAlign: 'center',
                                }}>
                                    No releases yet. Set a Release Type on a playlist first.
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={profile?.featuredPlaylistId || ''}
                                        onChange={(e) => setProfile(p => p ? {...p, featuredPlaylistId: e.target.value || null} : null)}
                                        style={{ ...inputBase, cursor: 'pointer' }}
                                    >
                                        <option value="" style={{ backgroundColor: colors.surface }}>None</option>
                                        {playlists.filter(p => p.releaseType).map((p: any) => (
                                            <option key={p.id} value={p.id} style={{ backgroundColor: colors.surface }}>{p.name} ({p.releaseType?.toUpperCase()})</option>
                                        ))}
                                    </select>
                                    {profile?.featuredPlaylistId && (
                                        <button onClick={() => setProfile(p => p ? {...p, featuredPlaylistId: null} : null)}
                                            style={{ marginTop: '8px', background: 'none', border: 'none', color: colors.error, cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 500 }}>
                                            Clear selection
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Genres ── */}
                    <div style={card}>
                        <div style={sectionTitle}><Music size={18} color={colors.primaryLight} /> Genres</div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', minHeight: '32px' }}>
                            {(!profile?.genres || profile.genres.length === 0) && (
                                <span style={{ fontSize: '12px', color: colors.textTertiary, fontStyle: 'italic' }}>No genres selected yet.</span>
                            )}
                            {profile?.genres?.map(g => (
                                <div key={g.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    backgroundColor: 'rgba(16,185,129,0.12)', padding: '5px 12px',
                                    borderRadius: borderRadius.pill, fontSize: '13px', color: colors.primary, fontWeight: 500,
                                }}>
                                    {g.name}
                                    <X size={13} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeGenre(g.id)} />
                                </div>
                            ))}
                        </div>

                        <select
                            onChange={(e) => {
                                const genre = allGenres.find(g => g.id === e.target.value);
                                if (genre) addGenre(genre);
                                e.target.value = '';
                            }}
                            style={{ ...inputBase, cursor: 'pointer' }}
                        >
                            <option value="" style={{ backgroundColor: colors.surface }}>+ Add a genre...</option>
                            {allGenres.filter(g => !profile?.genres?.some(pg => pg.id === g.id)).map(g => (
                                <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface }}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* ── Gear Rack ── */}
                    <div style={card}>
                        <div style={sectionTitle}><Hammer size={18} color={colors.highlight} /> Gear Rack</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(!profile?.gearList || profile.gearList.length === 0) && (
                                <div style={{
                                    padding: '20px', borderRadius: borderRadius.sm,
                                    backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                                    textAlign: 'center', color: colors.textTertiary, fontSize: '13px',
                                }}>
                                    No gear added yet. Show off your setup!
                                </div>
                            )}
                            {profile?.gearList?.map((item, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', gap: '10px', alignItems: 'center',
                                    padding: '8px 12px', borderRadius: borderRadius.sm,
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <input type="text" value={item.name} onChange={(e) => updateGear(idx, 'name', e.target.value)}
                                        placeholder="e.g. FL Studio 21, Serum, DT 990 Pro..."
                                        style={{ ...inputBase, border: 'none', backgroundColor: 'transparent', padding: '4px 0', flex: 1 }}
                                    />
                                    <select value={item.category} onChange={(e) => updateGear(idx, 'category', e.target.value)}
                                        style={{ ...inputBase, width: 'auto', minWidth: '120px', border: 'none', backgroundColor: 'rgba(255,255,255,0.04)', padding: '6px 8px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                                        {GEAR_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat} style={{ backgroundColor: colors.surface }}>{cat}</option>
                                        ))}
                                    </select>
                                    <button onClick={(e) => removeGear(idx, e)} style={{
                                        background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer',
                                        padding: '4px', borderRadius: borderRadius.sm,
                                    }}>
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}

                            <button onClick={(e) => addGear(e)} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                backgroundColor: 'transparent', border: '1px dashed rgba(255,255,255,0.12)',
                                borderRadius: borderRadius.sm, padding: '10px', color: colors.textSecondary,
                                cursor: 'pointer', fontSize: '13px',
                            }}>
                                <Plus size={15} /> Add Equipment
                            </button>
                        </div>
                    </div>

                    {/* ── Save Button ── */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            backgroundColor: colors.primary, color: 'white', border: 'none',
                            borderRadius: borderRadius.md, padding: '14px 24px',
                            fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1, boxShadow: shadows.glow,
                        }}
                    >
                        {saving ? 'Saving...' : <><Save size={18} /> Save Profile</>}
                    </button>
                </div>
            </div>
        </div>
        </DiscoveryLayout>
    );
};
