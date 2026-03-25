import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { 
    User, Music, Share2, Hammer, Save, Plus, X, Instagram, Youtube, 
    MessageCircle, Radio, ExternalLink, Copy, Check, ArrowLeft, Play, AlertCircle,
    Camera, Link as LinkIcon, Disc3, Star, Link2, Unlink, CheckCircle
} from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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

/* â”€â”€â”€ shared inline styles â”€â”€â”€ */
const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    padding: '24px',
};

const sectionHeader = (accentColor: string): React.CSSProperties => ({
    margin: '0 0 18px',
    fontSize: '14px',
    fontWeight: 700,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    letterSpacing: '-0.01em',
    paddingLeft: '10px',
    borderLeft: `3px solid ${accentColor}`,
});

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
    const { user, loading: authLoading, mutualAdminGuilds } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const adminTargetId = searchParams.get('adminTarget');
    const isAdminMode = !!adminTargetId && (mutualAdminGuilds?.length ?? 0) > 0;
    const effectiveUserId = isAdminMode ? adminTargetId : user?.id;
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [tracks, setTracks] = useState<any[]>([]);
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [validatingName, setValidatingName] = useState(false);

    // Discord linking
    const [discordLinked, setDiscordLinked] = useState(!!user?.id && !user.id.startsWith('local_'));
    const [discordId, setDiscordId] = useState<string | null>(null);
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkMsg, setLinkMsg] = useState('');
    const [linkError, setLinkError] = useState('');

    // Wrapper to mark form as dirty on any profile field change
    const updateProfile = (updater: (p: MusicianProfile) => MusicianProfile) => {
        setProfile(p => p ? updater(p) : null);
        setIsDirty(true);
    };

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Load Discord link status
    useEffect(() => {
        fetch('/api/auth/account', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (data.hasAccount) {
                    setDiscordLinked(!!data.discordLinked);
                    setDiscordId(data.discordId || null);
                }
            })
            .catch(() => {});
    }, []);

    // Handle Discord link callback URL params
    useEffect(() => {
        const linked = searchParams.get('linked');
        if (linked === 'true') { setLinkMsg('Discord account linked successfully!'); setDiscordLinked(true); }
        const linkErr = searchParams.get('linkError');
        if (linkErr === 'already_linked') setLinkError('That Discord account is already linked to another user.');
        else if (linkErr === 'invalid_token') setLinkError('Link session expired. Please try again.');
        else if (linkErr === 'failed') setLinkError('Failed to link Discord account. Please try again.');
    }, []);

    const handleLinkDiscord = () => {
        setLinkLoading(true);
        window.location.href = '/api/auth/discord/link?returnTo=/profile/edit';
    };

    const handleUnlinkDiscord = async () => {
        setLinkError(''); setLinkMsg(''); setLinkLoading(true);
        try {
            const res = await fetch('/api/auth/discord/unlink', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) { setLinkError(data.error || 'Failed to unlink'); return; }
            setDiscordLinked(false); setDiscordId(null);
            setLinkMsg('Discord account unlinked.');
        } catch { setLinkError('Request failed'); }
        finally { setLinkLoading(false); }
    };

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
            if (isAdminMode && (mutualAdminGuilds?.length ?? 0) === 0) {
                setMessage({ type: 'error', text: 'Admin access required.' });
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const [profileRes, genresRes] = await Promise.all([
                    axios.get(`/api/musician/profile/${effectiveUserId}`, { withCredentials: true }),
                    axios.get('/api/musician/genres', { withCredentials: true })
                ]);
                
                const data = profileRes.data;
                const rawGear = (data?.hardware || data?.gearList || []) as string[];
                if (data) data.gearList = rawGear.map((item: string) => { try { return JSON.parse(item); } catch { return { name: item, category: 'Other' }; } });
                if (data && data.tracks) setTracks(data.tracks);
                if (!isAdminMode) {
                    try {
                        const playlistsRes = await axios.get('/api/my-playlists', { withCredentials: true });
                        setPlaylists(playlistsRes.data || []);
                    } catch { /* playlists unavailable */ }
                }
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
                setIsDirty(false);
            } catch (err: any) {
                if (err.response?.status === 404 && !isAdminMode) {
                    navigate('/profile/setup', { replace: true });
                } else if (err.response?.status === 404 && isAdminMode) {
                    setMessage({ type: 'error', text: 'This user does not have a musician profile yet.' });
                } else {
                    setMessage({ type: 'error', text: 'Failed to load profile' });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [effectiveUserId, authLoading]);

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
            const endpoint = isAdminMode
                ? `/api/admin/musician/profile/${effectiveUserId}`
                : `/api/musician/profile/${user.id}`;
            await axios.post(endpoint, payload, { withCredentials: true });
            setMessage({ type: 'success', text: isAdminMode ? 'Profile updated by admin.' : 'Profile updated successfully!' });
            setIsDirty(false);
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
            const endpoint = isAdminMode
                ? `/api/admin/musician/profile/${effectiveUserId}/avatar`
                : `/api/musician/profile/${user.id}/avatar`;
            const res = await axios.post(endpoint, formData, {
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

    const socialPlatforms: Array<{ key: keyof MusicianProfile; label: string; color: string; placeholder: string }> = [
        { key: 'spotifyUrl', label: 'Spotify', color: '#1DB954', placeholder: 'https://open.spotify.com/artist/...' },
        { key: 'soundcloudUrl', label: 'SoundCloud', color: '#FF5500', placeholder: 'https://soundcloud.com/...' },
        { key: 'youtubeUrl', label: 'YouTube', color: '#FF0000', placeholder: 'https://youtube.com/@...' },
        { key: 'instagramUrl', label: 'Instagram', color: '#E1306C', placeholder: 'https://instagram.com/...' },
        { key: 'discordUrl', label: 'Discord', color: '#5865F2', placeholder: 'username or user#1234' },
    ];

    const gearCategoryColors: Record<string, string> = {
        'DAW': 'rgba(16,185,129,0.18)', 'VST / Plugin': 'rgba(6,182,212,0.18)',
        'Monitor': 'rgba(99,102,241,0.18)', 'Synth': 'rgba(245,158,11,0.18)',
        'Keyboard / Controller': 'rgba(245,158,11,0.18)', 'Audio Interface': 'rgba(239,68,68,0.18)',
        'Microphone': 'rgba(16,185,129,0.18)', 'Hardware': 'rgba(99,102,241,0.18)',
        'Headphones': 'rgba(6,182,212,0.18)', 'Other': 'rgba(100,116,139,0.18)',
    };

    return (
        <DiscoveryLayout activeTab="profile">
        {/* Sticky dirty-save bar */}
        {isDirty && (
            <div style={{
                position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 20px',
                background: `linear-gradient(135deg, ${colors.surface}, rgba(17,24,39,0.95))`,
                backdropFilter: 'blur(12px)',
                border: `1px solid rgba(16,185,129,0.35)`,
                borderRadius: borderRadius.pill,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.15), ${shadows.glow}`,
            }}>
                <span style={{ fontSize: '13px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>Unsaved changes</span>
                <button onClick={handleSave} disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 18px',
                        background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
                        color: 'white', border: 'none', borderRadius: borderRadius.pill,
                        fontWeight: 700, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        boxShadow: shadows.glow,
                    }}>
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        )}

        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '1100px', margin: '0 auto', paddingBottom: isDirty ? '80px' : undefined }}>

            {/* ── Top bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                {isAdminMode ? (
                    <button onClick={() => navigate('/dashboard')} style={{ color: colors.textSecondary, display: 'flex', padding: '6px', borderRadius: borderRadius.sm, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                ) : (
                    <Link to="/profile" style={{ color: colors.textSecondary, display: 'flex', padding: '6px', borderRadius: borderRadius.sm }}>
                        <ArrowLeft size={20} />
                    </Link>
                )}
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', flex: 1 }}>
                    {isAdminMode ? `Admin Edit: ${profile?.displayName || profile?.username || adminTargetId}` : 'Edit Profile'}
                </h1>
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

            {/* ── Admin Mode Banner ── */}
            {isAdminMode && (
                <div style={{
                    padding: '12px 16px', borderRadius: borderRadius.md, marginBottom: '20px',
                    backgroundColor: 'rgba(255,152,0,0.1)', color: '#ff9800',
                    border: '1px solid rgba(255,152,0,0.35)',
                    fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    <AlertCircle size={16} />
                    Admin Edit Mode — You are editing another user's profile. All changes will be logged.
                </div>
            )}

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
                gridTemplateColumns: isMobile ? '1fr' : '300px 1fr',
                gap: '24px',
                alignItems: 'start',
            }}>

                {/* ═══ LEFT COLUMN: Identity Preview ═══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', ...(isMobile ? {} : { position: 'sticky', top: '24px' }) }}>

                    {/* Avatar + identity preview card */}
                    <div style={{
                        ...card,
                        background: `linear-gradient(160deg, ${colors.surface} 0%, rgba(16,185,129,0.05) 100%)`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        overflow: 'hidden', position: 'relative',
                    }}>
                        {/* BG orb */}
                        <div style={{
                            position: 'absolute', top: '-40px', right: '-40px', width: '150px', height: '150px',
                            borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 60%)',
                            pointerEvents: 'none',
                        }} />

                        <div style={{ position: 'relative', marginBottom: '16px', zIndex: 1 }}>
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="Avatar"
                                    style={{ width: '108px', height: '108px', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${colors.primary}`, boxShadow: shadows.glowStrong, display: 'block' }}
                                />
                            ) : (
                                <div style={{
                                    width: '108px', height: '108px', borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: shadows.glowStrong,
                                }}>
                                    <User size={44} color="rgba(255,255,255,0.7)" />
                                </div>
                            )}
                            <label style={{
                                position: 'absolute', bottom: '4px', right: '4px',
                                backgroundColor: colors.primary, width: '30px', height: '30px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                                border: `2px solid ${colors.surface}`,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                transition: 'transform 0.15s',
                            }}>
                                <Camera size={13} color="white" />
                                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} style={{ display: 'none' }} disabled={uploadingAvatar} />
                            </label>
                        </div>

                        {uploadingAvatar && (
                            <div style={{ fontSize: '12px', color: colors.primary, marginBottom: '8px' }}>Uploading...</div>
                        )}

                        <div style={{ fontSize: '17px', fontWeight: 800, color: colors.textPrimary, marginBottom: '2px', letterSpacing: '-0.02em' }}>
                            {profile?.displayName || profile?.username || 'Your Name'}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textTertiary, marginBottom: '14px' }}>
                            @{profile?.username || 'username'}
                        </div>

                        {profile?.bio ? (
                            <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '0 0 14px', lineHeight: 1.6, maxWidth: '240px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: borderRadius.md }}>
                                {profile.bio.length > 120 ? profile.bio.slice(0, 120) + '…' : profile.bio}
                            </p>
                        ) : (
                            <p style={{ fontSize: '12px', color: colors.textTertiary, margin: '0 0 14px', fontStyle: 'italic' }}>No bio yet.</p>
                        )}

                        {/* Genre pills preview */}
                        {profile?.genres && profile.genres.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                                {profile.genres.slice(0, 5).map(g => (
                                    <span key={g.id} style={{
                                        fontSize: '11px', padding: '3px 9px', borderRadius: borderRadius.pill,
                                        backgroundColor: 'rgba(16,185,129,0.12)', color: colors.primary, fontWeight: 600,
                                        border: '1px solid rgba(16,185,129,0.2)',
                                    }}>
                                        {g.name}
                                    </span>
                                ))}
                                {profile.genres.length > 5 && (
                                    <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textTertiary }}>
                                        +{profile.genres.length - 5}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats card */}
                    <div style={{ ...card, padding: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', textAlign: 'center' }}>
                            {[
                                { val: tracks.length, label: 'Tracks' },
                                { val: profile?.genres?.length || 0, label: 'Genres' },
                                { val: profile?.gearList?.length || 0, label: 'Gear' },
                            ].map(({ val, label }) => (
                                <div key={label} style={{ padding: '10px 4px' }}>
                                    <div style={{ fontSize: '22px', fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.02em' }}>{val}</div>
                                    <div style={{ fontSize: '10px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Profile link card */}
                    {profile?.id && (
                        <div style={{ ...card, padding: '14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Profile URL</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ flex: 1, fontSize: '12px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    /profile/{profile.username}
                                </span>
                                <button onClick={handleCopyLink} style={{
                                    display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                                    background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: borderRadius.sm, color: copied ? colors.success : colors.textSecondary,
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                }}>
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ RIGHT COLUMN: Edit Sections ═══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* ── Identity ── */}
                    <div style={card}>
                        <div style={sectionHeader(colors.primary)}><User size={15} color={colors.primary} /> Identity</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <span style={label}>Artist / Display Name</span>
                                <input
                                    type="text"
                                    value={profile?.displayName || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        updateProfile(p => ({ ...p, displayName: val || null }));
                                        if (val.trim().length > 0) validateArtistName(val.trim());
                                        else setNameError(null);
                                    }}
                                    placeholder="How you want to be known..."
                                    style={{ ...inputBase, ...(nameError ? { borderColor: colors.error } : {}) }}
                                />
                                {validatingName && <span style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px', display: 'block' }}>Checking name...</span>}
                                {nameError && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.error, marginTop: '4px' }}>
                                        <AlertCircle size={13} />{nameError}
                                    </div>
                                )}
                                <span style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px', display: 'block' }}>Leave blank to use your Discord username.</span>
                            </div>

                            <div>
                                <span style={{ ...label, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Bio</span>
                                    <span style={{ color: colors.textTertiary, fontWeight: 400 }}>{profile?.bio?.length || 0} chars</span>
                                </span>
                                <textarea
                                    value={profile?.bio || ''}
                                    onChange={(e) => updateProfile(p => ({ ...p, bio: e.target.value }))}
                                    placeholder="Producer, beatmaker, multi-instrumentalist..."
                                    rows={3}
                                    style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Social Links ── */}
                    <div style={card}>
                        <div style={sectionHeader(colors.accent)}><LinkIcon size={15} color={colors.accent} /> Social Links</div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                            {socialPlatforms.map(social => (
                                <div key={social.key}>
                                    <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: social.color, display: 'inline-block', boxShadow: `0 0 6px ${social.color}80` }} />
                                        {social.label}
                                    </span>
                                    <input
                                        type="text"
                                        value={(profile as any)?.[social.key] || ''}
                                        onChange={(e) => updateProfile(p => ({ ...p, [social.key]: e.target.value }))}
                                        placeholder={social.placeholder}
                                        style={inputBase}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Featured Content ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                        {/* Featured Track */}
                        <div style={card}>
                            <div style={sectionHeader(colors.highlight)}><Star size={15} color={colors.highlight} /> Featured Track</div>
                            <p style={{ fontSize: '12px', color: colors.textTertiary, margin: '0 0 12px', lineHeight: 1.5 }}>
                                Showcase one track at the top of your profile.
                            </p>
                            <select
                                value={profile?.featuredTrackId || ''}
                                onChange={(e) => updateProfile(p => ({ ...p, featuredTrackId: e.target.value || null }))}
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
                            <div style={sectionHeader(colors.accentDark)}><Disc3 size={15} color={colors.accent} /> Featured Release</div>
                            <p style={{ fontSize: '12px', color: colors.textTertiary, margin: '0 0 12px', lineHeight: 1.5 }}>
                                Showcase an album, EP, or single.
                            </p>
                            {isAdminMode ? (
                                <div style={{ fontSize: '12px', color: colors.textTertiary }}>
                                    {profile?.featuredPlaylistId ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>Currently set (ID: {profile.featuredPlaylistId})</span>
                                            <button onClick={() => updateProfile(p => ({ ...p, featuredPlaylistId: null }))}
                                                style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 500 }}>
                                                Clear
                                            </button>
                                        </div>
                                    ) : (
                                        <span style={{ fontStyle: 'italic' }}>No featured release set.</span>
                                    )}
                                </div>
                            ) : playlists.filter(p => p.releaseType).length === 0 ? (
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
                                        onChange={(e) => updateProfile(p => ({ ...p, featuredPlaylistId: e.target.value || null }))}
                                        style={{ ...inputBase, cursor: 'pointer' }}
                                    >
                                        <option value="" style={{ backgroundColor: colors.surface }}>None</option>
                                        {playlists.filter(p => p.releaseType).map((p: any) => (
                                            <option key={p.id} value={p.id} style={{ backgroundColor: colors.surface }}>{p.name} ({p.releaseType?.toUpperCase()})</option>
                                        ))}
                                    </select>
                                    {profile?.featuredPlaylistId && (
                                        <button onClick={() => updateProfile(p => ({ ...p, featuredPlaylistId: null }))}
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
                        <div style={sectionHeader(colors.primaryLight)}><Music size={15} color={colors.primaryLight} /> Genres</div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '14px', minHeight: '32px' }}>
                            {(!profile?.genres || profile.genres.length === 0) && (
                                <span style={{ fontSize: '12px', color: colors.textTertiary, fontStyle: 'italic' }}>No genres selected yet.</span>
                            )}
                            {profile?.genres?.map(g => (
                                <div key={g.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    backgroundColor: 'rgba(16,185,129,0.10)', padding: '4px 10px 4px 12px',
                                    borderRadius: borderRadius.pill, fontSize: '12px', color: colors.primary, fontWeight: 600,
                                    border: '1px solid rgba(16,185,129,0.2)',
                                }}>
                                    {g.name}
                                    <button type="button" onClick={() => removeGenre(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: '0 0 0 2px', display: 'flex', lineHeight: 1 }}>
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <select
                            onChange={(e) => {
                                const genre = allGenres.find(g => g.id === e.target.value);
                                if (genre) { addGenre(genre); setIsDirty(true); }
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={sectionHeader(colors.highlight)}><Hammer size={15} color={colors.highlight} /> Gear Rack</div>
                            <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textTertiary }}>{profile?.gearList?.length || 0} items</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                    display: 'flex', gap: '8px', alignItems: 'center',
                                    padding: '8px 10px', borderRadius: borderRadius.sm,
                                    backgroundColor: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <input type="text" value={item.name} onChange={(e) => { updateGear(idx, 'name', e.target.value); setIsDirty(true); }}
                                        placeholder="e.g. FL Studio 21, Serum, DT 990 Pro..."
                                        style={{ ...inputBase, border: 'none', backgroundColor: 'transparent', padding: '4px 0', flex: 1 }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        <span style={{
                                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                            backgroundColor: gearCategoryColors[item.category] || 'rgba(100,116,139,0.4)',
                                            outline: '1px solid rgba(255,255,255,0.1)',
                                        }} />
                                        <select value={item.category} onChange={(e) => { updateGear(idx, 'category', e.target.value); setIsDirty(true); }}
                                            style={{ ...inputBase, width: 'auto', minWidth: '110px', border: 'none', backgroundColor: 'rgba(255,255,255,0.04)', padding: '5px 6px', fontSize: '12px', cursor: 'pointer' }}>
                                            {GEAR_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat} style={{ backgroundColor: colors.surface }}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button onClick={(e) => removeGear(idx, e)} style={{
                                        background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer',
                                        padding: '4px', borderRadius: borderRadius.sm, flexShrink: 0,
                                    }}>
                                        <X size={15} />
                                    </button>
                                </div>
                            ))}

                            <button onClick={(e) => { addGear(e); setIsDirty(true); }} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                backgroundColor: 'transparent', border: '1px dashed rgba(255,255,255,0.12)',
                                borderRadius: borderRadius.sm, padding: '10px', color: colors.textSecondary,
                                cursor: 'pointer', fontSize: '13px',
                            }}>
                                <Plus size={15} /> Add Equipment
                            </button>
                        </div>
                    </div>

                    {/* ── Discord Connection ── */}
                    {!isAdminMode && (
                        <div style={card}>
                            <div style={sectionHeader('#5865F2')}>
                                <svg width="15" height="11" viewBox="0 0 71 55" fill="none" style={{ flexShrink: 0 }}>
                                    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527.41542C45.5603.39851 45.468.440769 45.4204.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617.525289C25.5141.443589 25.4218.40133 25.3294.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309-.943561 32.1443.293408 45.3914C.299005 45.4562.335386 45.5182.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.483 44.2898 53.5503 44.3433C53.9057 44.6363 54.278 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.026 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.027 50.6034 51.2443 52.5699 52.5873 54.435C52.6431 54.5139 52.7438 54.5477 52.8362 54.5195C58.6441 52.7249 64.5268 50.0174 70.5997 45.5576C70.6528 45.5182 70.6866 45.459 70.6922 45.3942C72.1307 30.0791 68.1373 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" fill="#5865F2"/>
                                </svg>
                                Discord Connection
                            </div>

                            {discordLinked ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(88,101,242,0.10)', border: '1px solid rgba(88,101,242,0.30)', borderRadius: borderRadius.md, marginBottom: '14px' }}>
                                        <CheckCircle size={16} color="#7289DA" />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: colors.textPrimary }}>Discord account linked</p>
                                            {discordId && <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textTertiary }}>ID: {discordId}</p>}
                                        </div>
                                    </div>
                                    <button onClick={handleUnlinkDiscord} disabled={linkLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'transparent', color: colors.error, border: `1px solid ${colors.error}50`, borderRadius: borderRadius.sm, fontWeight: 600, fontSize: '13px', cursor: linkLoading ? 'wait' : 'pointer' }}>
                                        <Unlink size={13} /> Unlink Discord
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '12px', lineHeight: 1.5 }}>
                                        Link your Discord account to enable guild features and single sign-on.
                                    </p>
                                    <button onClick={handleLinkDiscord} disabled={linkLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: borderRadius.sm, fontWeight: 600, fontSize: '13px', cursor: linkLoading ? 'wait' : 'pointer' }}>
                                        <Link2 size={14} /> Link Discord Account
                                    </button>
                                </div>
                            )}
                            {linkError && <p style={{ color: colors.error, fontSize: '12px', marginTop: '8px' }}>{linkError}</p>}
                            {linkMsg && <p style={{ color: colors.success, fontSize: '12px', marginTop: '8px' }}>{linkMsg}</p>}
                        </div>
                    )}

                    {/* ── Save Button (bottom static fallback) ── */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
                            color: 'white', border: 'none',
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
