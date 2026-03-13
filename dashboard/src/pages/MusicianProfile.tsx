import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    User, Music, Share2, ExternalLink, Copy, Check, Edit3, Plus, ChevronRight, Play
} from 'lucide-react';
import { MusicianProfilePublic } from './MusicianProfilePublic';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';

interface ProfileData {
    id?: string;
    username?: string;
    displayName?: string | null;
    avatar?: string | null;
    bio: string | null;
    genres: { id: string; name: string }[];
    tracks?: any[];
}

export const MusicianProfilePage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<'view' | 'hub'>('view');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [tracks, setTracks] = useState<any[]>([]);

    const pathParts = pathname.split('/');
    const urlIdentifier = pathParts.length > 2 ? pathParts[2] : null;

    useEffect(() => {
        if (urlIdentifier) setMode('view');
        else if (!urlIdentifier && user) setMode('hub');
        else if (!urlIdentifier && !user && !authLoading) setMode('view');
    }, [user?.id, urlIdentifier, authLoading]);

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
            setLoading(true);
            try {
                const identifier = urlIdentifier || user?.id;
                if (!identifier) { if (!authLoading) setLoading(false); return; }
                const res = await axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true });
                const data = res.data;
                if (data && !data.gearList && data.hardware) data.gearList = data.hardware;
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
                    data.genres = data.genres.map((pg: any) => ({ id: pg.genreId, name: pg.genre?.name || 'Unknown' }));
                }
                setProfile(data);
            } catch (err: any) {
                if (err.response?.status === 404 && !urlIdentifier && user) {
                    // First-time user — redirect to setup wizard
                    navigate('/profile/setup', { replace: true });
                    return;
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.id]);

    if (loading || authLoading) return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading profile...</div>
        </DiscoveryLayout>
    );

    if (!user && !urlIdentifier) {
        return (
            <DiscoveryLayout activeTab="profile">
                <div style={{ textAlign: 'center', padding: '100px', color: colors.textPrimary }}>
                    <User size={64} color={colors.primary} style={{ marginBottom: spacing.xl, opacity: 0.5 }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Authentication Required</h2>
                    <p style={{ color: colors.textSecondary, marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                        You need to be logged in to manage your musician profile and upload tracks.
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

    if (mode === 'view') {
        const identifier = urlIdentifier || user?.username || user?.id || '';
        const isOwn = !!user && (identifier === user.id || identifier === user.username);
        return (
            <DiscoveryLayout activeTab="profile">
                <MusicianProfilePublic 
                    identifier={identifier} 
                    isOwnProfile={isOwn} 
                    onEdit={() => navigate('/profile/edit')}
                />
            </DiscoveryLayout>
        );
    }

    // Hub mode — show profile summary with links to Edit Profile and My Tracks
    const totalPlays = tracks.reduce((sum: number, t: any) => sum + (t.playCount || 0), 0);

    const cardStyle: React.CSSProperties = {
        backgroundColor: colors.surface,
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'all 0.2s',
    };

    return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ padding: spacing.lg, maxWidth: '700px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
                    <User size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: '24px' }}>My Profile</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '14px' }}>Manage your profile, tracks, and public presence.</p>
                    </div>
                    {profile?.id && (
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View Profile"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.05)', padding: isMobile ? '8px' : '8px 14px', borderRadius: borderRadius.md, color: colors.textPrimary, textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <ExternalLink size={14} />{!isMobile && 'View'}
                            </a>
                            <button onClick={handleCopyLink} title="Share Profile"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: colors.primary, padding: isMobile ? '8px' : '8px 14px', borderRadius: borderRadius.md, color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                                {copied ? <Check size={14} /> : <Copy size={14} />}{!isMobile && (copied ? 'Copied!' : 'Share')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Profile Summary Card */}
                <div style={{ backgroundColor: colors.surface, borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {profile?.avatar ? (
                            <img src={profile.avatar.startsWith('http') ? profile.avatar : (profile.avatar.includes('/') ? profile.avatar : `https://cdn.discordapp.com/avatars/${user?.id}/${profile.avatar}.png?size=256`)}
                                alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${colors.primary}` }} />
                        ) : (
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.1)' }}>
                                <User size={28} color={colors.textSecondary} />
                            </div>
                        )}
                        <div style={{ flex: 1 }}>
                            <h2 style={{ margin: 0, fontSize: '20px' }}>{profile?.displayName || user?.username}</h2>
                            {profile?.bio && <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>{profile.bio}</p>}
                            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                <span style={{ fontSize: '12px', color: colors.textSecondary }}><strong style={{ color: 'white' }}>{tracks.length}</strong> tracks</span>
                                <span style={{ fontSize: '12px', color: colors.textSecondary }}><strong style={{ color: 'white' }}>{totalPlays}</strong> total plays</span>
                                <span style={{ fontSize: '12px', color: colors.textSecondary }}><strong style={{ color: 'white' }}>{profile?.genres?.length || 0}</strong> genres</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                    <Link to="/profile/edit" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={cardStyle}
                            onMouseOver={e => { e.currentTarget.style.borderColor = colors.primary + '55'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: colors.primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Edit3 size={22} color={colors.primary} />
                                </div>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </div>
                            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Edit Profile</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Update your name, bio, socials, genres, and gear rack.</p>
                        </div>
                    </Link>

                    <Link to="/my-tracks" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={cardStyle}
                            onMouseOver={e => { e.currentTarget.style.borderColor = colors.primary + '55'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: colors.primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={22} color={colors.primary} />
                                </div>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </div>
                            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>My Tracks</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Upload, edit, and manage your music. {tracks.length > 0 ? `${tracks.length} track${tracks.length === 1 ? '' : 's'} uploaded.` : 'No tracks yet.'}</p>
                        </div>
                    </Link>
                </div>

                {/* Recent Tracks Preview */}
                {tracks.length > 0 && (
                    <div style={{ backgroundColor: colors.surface, borderRadius: '16px', padding: '24px', marginTop: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}><Play size={18} /> Recent Tracks</h3>
                            <Link to="/my-tracks" style={{ fontSize: '12px', color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>View All</Link>
                        </div>
                        {tracks.slice(0, 3).map((track: any) => (
                            <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                                {track.coverUrl ? (
                                    <img src={track.coverUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: 36, height: 36, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Music size={16} color={colors.textSecondary} />
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary }}>{track.playCount || 0} plays</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
