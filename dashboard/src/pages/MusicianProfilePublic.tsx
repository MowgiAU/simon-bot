import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import axios from 'axios';
import { 
    Music, Hammer, Instagram, Youtube, MessageCircle, Radio,
    Edit3, Pause, ExternalLink, Award, Zap, Play, Copy, Check,
    Swords, Trophy, Flame, UserPlus, UserCheck, Repeat2, Heart, Share2
} from 'lucide-react';
import { CommentSection } from '../components/CommentSection';
import { FujiLogo } from '../components/FujiLogo';

interface MusicianProfile {
    id: string;
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    spotifyUrl: string | null;
    soundcloudUrl: string | null;
    youtubeUrl: string | null;
    instagramUrl: string | null;
    discordUrl: string | null;
    hardware: string[];
    gearList: string[];
    genres: { genre: { name: string } }[];
    totalPlays?: number;
    featuredTrackId?: string | null;
    featuredTrack?: {
        id: string;
        title: string;
        url: string;
        coverUrl: string | null;
        description: string | null;
    };
    featuredPlaylistId?: string | null;
    featuredPlaylist?: {
        id: string;
        name: string;
        description: string | null;
        coverUrl: string | null;
        releaseType: string | null;
        tracks: Array<{
            position: number;
            track: { id: string; title: string; url: string; coverUrl: string | null; profile: { username: string; displayName: string | null } };
        }>;
    } | null;
    tracks?: Array<{
        id: string;
        title: string;
        slug: string | null;
        url: string;
        coverUrl: string | null;
        description: string | null;
        playCount: number;
        createdAt?: string;
        waveformPeaks?: number[] | null;
        genres?: { genre: { name: string; slug: string } }[];
        _count?: { favourites: number; reposts: number; comments: number };
    }>;
    reposts?: Array<{
        id: string;
        title: string;
        slug: string | null;
        url: string;
        coverUrl: string | null;
        description: string | null;
        playCount: number;
        createdAt?: string;
        _repost: true;
        _repostedAt: string;
        _originalArtist: { userId: string; username: string; displayName: string | null; avatar: string | null };
        waveformPeaks?: number[] | null;
        genres?: { genre: { name: string; slug: string } }[];
        _count?: { favourites: number; reposts: number; comments: number };
    }>;
}

export const MusicianProfilePublic: React.FC<{ identifier: string; onEdit?: () => void; isOwnProfile: boolean }> = ({ identifier, onEdit, isOwnProfile }) => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [copied, setCopied] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [discographyFilter, setDiscographyFilter] = useState<'all' | 'tracks' | 'reposts'>('all');
    const [favourites, setFavourites] = useState<Record<string, boolean>>({});
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    // Battle submissions
    const [battleEntries, setBattleEntries] = useState<any[]>([]);

    // Player Context
    const { player, setTrack, togglePlay, seek } = usePlayer();

    const toggleFavourite = async (trackId: string) => {
        try {
            const { data } = await axios.post(`/api/tracks/${trackId}/favourite`, {}, { withCredentials: true });
            setFavourites(prev => ({ ...prev, [trackId]: data.favourited }));
        } catch {}
    };

    const toggleRepost = async (trackId: string) => {
        try {
            const { data } = await axios.post(`/api/tracks/${trackId}/repost`, {}, { withCredentials: true });
            setReposts(prev => ({ ...prev, [trackId]: data.reposted }));
        } catch {}
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / 1000;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    const handleCopyProfileLink = () => {
        if (!profile?.username) return;
        navigator.clipboard.writeText(`${window.location.origin}/profile/${profile.username}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleFollow = async () => {
        if (!profile) return;
        try {
            const { data } = await axios.post(`/api/artists/${profile.id}/follow`, {}, { withCredentials: true });
            setIsFollowing(data.following);
            setFollowerCount(prev => data.following ? prev + 1 : prev - 1);
        } catch { /* not logged in */ }
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (document.getElementById('marquee-release-style')) return;
        const style = document.createElement('style');
        style.id = 'marquee-release-style';
        style.textContent = '@keyframes marquee-release { from { transform: translateX(0); } to { transform: translateX(-50%); } }';
        document.head.appendChild(style);
    }, []);

    useEffect(() => {
        if (profile) {
            document.title = `${profile.displayName || profile.username} | Fuji Studio Artist`;
        } else {
            document.title = 'Artist Discovery | Fuji Studio';
        }
        
        return () => {
            document.title = 'Fuji Studio Dashboard';
        };
    }, [profile]);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true });
                const data = res.data;
                // Map socials JSON array to flat fields for display
                if (data && data.socials && Array.isArray(data.socials)) {
                    data.socials.forEach((s: any) => {
                        if (s.platform === 'spotify') data.spotifyUrl = s.url;
                        if (s.platform === 'soundcloud') data.soundcloudUrl = s.url;
                        if (s.platform === 'youtube') data.youtubeUrl = s.url;
                        if (s.platform === 'instagram') data.instagramUrl = s.url;
                        if (s.platform === 'discord') data.discordUrl = s.url;
                    });
                }
                setProfile(data);
                // Load follow data
                try {
                    const countRes = await axios.get(`/api/artists/${data.id}/follower-count`);
                    setFollowerCount(countRes.data.count);
                    const followRes = await axios.get(`/api/artists/${data.id}/follow`, { withCredentials: true });
                    setIsFollowing(followRes.data.following);
                } catch { /* not logged in or error */ }
                // Load favourite/repost status for all tracks
                const allTrackIds = [...(data.tracks || []).map((t: any) => t.id), ...(data.reposts || []).map((t: any) => t.id)];
                if (allTrackIds.length > 0) {
                    try {
                        const [favRes, repRes] = await Promise.all([
                            axios.post('/api/tracks/favourites/check', { trackIds: allTrackIds }, { withCredentials: true }),
                            axios.post('/api/tracks/reposts/check', { trackIds: allTrackIds }, { withCredentials: true }),
                        ]);
                        setFavourites(favRes.data);
                        setReposts(repRes.data);
                    } catch { /* not logged in */ }
                }
            } catch (err: any) {
                setError(err.response?.status === 404 ? 'Profile not found' : 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [identifier]);

    // Fetch battle submissions once profile is loaded
    useEffect(() => {
        if (!profile?.userId) return;
        (async () => {
            try {
                const res = await axios.get(`/api/beat-battle/user/${profile.userId}/entries`);
                setBattleEntries(res.data);
            } catch {}
        })();
    }, [profile?.userId]);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>
            Loading profile...
        </div>
    );

    if (error || !profile) return (
        <div style={{ textAlign: 'center', padding: '100px' }}>
            <h2 style={{ color: '#ff4444' }}>{error || 'Profile not found'}</h2>
            <p style={{ color: colors.textSecondary }}>The musician you are looking for hasn't set up their Fuji Studio profile yet.</p>
            <div style={{ marginTop: spacing.xl }}>
                <a href="/" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 'bold', border: `1px solid ${colors.primary}`, padding: '8px 16px', borderRadius: borderRadius.md }}>← Back Home</a>
            </div>
        </div>
    );

    const gear = (profile.gearList || profile.hardware || []).map((item: string | any) => {
        if (typeof item !== 'string') return item;
        try { return JSON.parse(item); } catch { return { name: item, category: 'Other' }; }
    });
    const stats = [
        { label: 'Followers', value: followerCount.toLocaleString() },
        { label: 'Total Streams', value: profile.totalPlays?.toLocaleString() || '0' },
        { label: 'Releases', value: profile.tracks?.length.toString() || '0' }
    ];

    const socials = [
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/>, color: '#ff5500', isHandle: false },
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/>, color: '#1DB954', isHandle: false },
        { key: 'youtubeUrl', label: 'YouTube', icon: <Youtube size={16}/>, color: '#FF0000', isHandle: false },
        { key: 'instagramUrl', label: 'Instagram', icon: <Instagram size={16}/>, color: '#E1306C', isHandle: false },
        { key: 'discordUrl', label: 'Discord', icon: <MessageCircle size={16}/>, color: '#5865F2', isHandle: true },
    ];

    const featuredTrack = profile.featuredTrack || null;
    const featuredPlaylist = profile.featuredPlaylist || null;
    const featuredPlaylistTracks = featuredPlaylist?.tracks?.map(pt => pt.track) || [];
    
    // Fallback logic for avatar:
    // 1. Custom profile-wide avatar (if it's a full path from /uploads/avatars)
    // 2. Discord avatar (if it's just a hash)
    // 3. First letter of username
    const avatarUrl = profile.avatar 
        ? (profile.avatar.startsWith('http') || profile.avatar.startsWith('/uploads/') ? profile.avatar : `https://cdn.discordapp.com/avatars/${profile.userId}/${profile.avatar}.png?size=256`)
        : null;

    // Track cover should strictly be the track's cover, or a fallback music icon
    const trackCoverUrl = featuredTrack?.coverUrl || null;

    return (
        <div style={{ 
            color: '#F8FAFC',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* ── HERO BANNER ── */}
            <div style={{ position: 'relative', minHeight: isMobile ? '320px' : '380px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                {/* Background — uses featured art or avatar as blurred backdrop */}
                {(trackCoverUrl || featuredPlaylist?.coverUrl || avatarUrl) && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${trackCoverUrl || featuredPlaylist?.coverUrl || avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3, filter: 'blur(60px) saturate(1.8)', transform: 'scale(1.3)', pointerEvents: 'none' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0E121A 0%, rgba(14,18,26,0.85) 40%, rgba(14,18,26,0.4) 100%)', pointerEvents: 'none' }} />

                {/* Hero Content */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '24px 16px' : '48px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-end', gap: isMobile ? '20px' : '32px' }}>
                        {/* Avatar */}
                        <div style={{ width: isMobile ? '140px' : '180px', height: isMobile ? '140px' : '180px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '4px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={profile.displayName || profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 800 }}>
                                    {profile.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left', minWidth: 0 }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>Artist Profile</p>
                            <h1 style={{ fontSize: isMobile ? '32px' : '52px', fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.05, wordWrap: 'break-word' }}>
                                {profile.displayName || profile.username}
                            </h1>
                            {profile.bio && (
                                <p style={{ color: 'rgba(185,195,206,0.8)', fontSize: '14px', margin: '0 0 14px', lineHeight: 1.5, maxWidth: '520px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {profile.bio}
                                </p>
                            )}
                            {/* Genre Chips + Stats inline */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', marginBottom: '16px' }}>
                                {profile.genres.filter((g: any) => g.genre).map((g: any, i: number) => (
                                    <span key={i} onClick={() => navigate(`/category/${g.genre.slug}`)} style={{ backgroundColor: `${colors.primary}1A`, border: `1px solid ${colors.primary}4D`, color: colors.primary, padding: '3px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>{g.genre.name}</span>
                                ))}
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>|</span>
                                {stats.map((s, i) => (
                                    <span key={i} style={{ fontSize: '12px', color: '#B9C3CE' }}>
                                        <strong style={{ color: 'white', fontWeight: 700 }}>{s.value}</strong> {s.label}
                                    </span>
                                ))}
                            </div>
                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                {!isOwnProfile && (
                                    <button onClick={toggleFollow} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', border: isFollowing ? `1px solid ${colors.primary}4D` : 'none', backgroundColor: isFollowing ? 'transparent' : colors.primary, color: isFollowing ? colors.primary : 'white', transition: 'all 0.2s' }}>
                                        {isFollowing ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                                    </button>
                                )}
                                <button onClick={handleCopyProfileLink} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: copied ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)', color: copied ? '#4caf50' : '#B9C3CE', transition: 'all 0.2s' }}>
                                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Share</>}
                                </button>
                                {/* Social Icons inline */}
                                {socials.map(s => {
                                    const url = (profile as any)[s.key];
                                    if (!url) return null;
                                    const inner = (
                                        <div style={{ width: '34px', height: '34px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${s.color}20`; e.currentTarget.style.borderColor = `${s.color}60`; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                                            {React.cloneElement(s.icon as React.ReactElement, { size: 15, color: s.color })}
                                        </div>
                                    );
                                    return s.isHandle ? (
                                        <div key={s.key} title={`${s.label}: ${url}`}>{inner}</div>
                                    ) : (
                                        <a key={s.key} href={url} target="_blank" rel="noopener noreferrer" title={s.label}>{inner}</a>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>

                {/* Featured Release Hero */}
                {featuredPlaylist && (
                <div style={{ 
                    borderRadius: '12px', overflow: 'hidden', 
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '20px',
                    position: 'relative',
                    display: 'flex',
                    background: 'linear-gradient(135deg, #1A1E2E 0%, #242C3D 100%)'
                }}>
                    {featuredPlaylist.coverUrl && (
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featuredPlaylist.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15, filter: 'blur(40px)', transform: 'scale(1.2)', pointerEvents: 'none' }} />
                    )}
                    <div style={{ position: 'relative', width: '100%', padding: isMobile ? '20px' : '28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '16px' : '24px' }}>
                        {/* Cover */}
                        <div style={{ flexShrink: 0, width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
                            {featuredPlaylist.coverUrl ? (
                                <img src={featuredPlaylist.coverUrl} alt={featuredPlaylist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={40} color={colors.primary} />
                                </div>
                            )}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
                            <span style={{ backgroundColor: featuredPlaylist.releaseType === 'album' ? '#7C3AED' : featuredPlaylist.releaseType === 'ep' ? '#0369A1' : featuredPlaylist.releaseType === 'single' ? '#B45309' : colors.primary, color: 'white', fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {featuredPlaylist.releaseType ? `Featured ${featuredPlaylist.releaseType}` : 'Featured Release'}
                            </span>
                            <h3 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, margin: '8px 0 4px', letterSpacing: '-0.01em' }}>{featuredPlaylist.name}</h3>
                            {featuredPlaylist.description && (
                                <p style={{ color: 'rgba(185,195,206,0.7)', fontSize: '12px', margin: '0 0 12px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{featuredPlaylist.description}</p>
                            )}
                            {/* Marquee track pills */}
                            {featuredPlaylistTracks.length > 0 && !isMobile && (
                                <div style={{ overflow: 'hidden', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', gap: '6px', animation: 'marquee-release 20s linear infinite', width: 'max-content' }}>
                                        {[...featuredPlaylistTracks, ...featuredPlaylistTracks].map((t, i) => (
                                            <span key={i} style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: '#B9C3CE', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                {t.title}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Play Button */}
                        <button
                            onClick={() => { if (featuredPlaylistTracks.length > 0) { const first = featuredPlaylistTracks[0]; player.currentTrack?.id === first.id ? togglePlay() : setTrack(first, featuredPlaylistTracks); } }}
                            disabled={featuredPlaylistTracks.length === 0}
                            style={{ padding: '10px 24px', borderRadius: '999px', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', color: 'white', cursor: featuredPlaylistTracks.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: `0 4px 15px ${colors.primary}44`, flexShrink: 0, opacity: featuredPlaylistTracks.length > 0 ? 1 : 0.5 }}
                        >
                            {player.currentTrack?.id === featuredPlaylistTracks[0]?.id && player.isPlaying ? <><Pause size={16} fill="currentColor" /> Pause</> : <><Play size={16} fill="currentColor" /> Play</>}
                        </button>
                    </div>
                </div>
                )}

                {/* Featured Track — Compact Player Bar */}
                {featuredTrack && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px',
                    padding: isMobile ? '14px' : '16px 20px',
                    borderRadius: '12px', backgroundColor: '#242C3D',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '20px',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2A3347'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#242C3D'}
                    onClick={() => featuredTrack && (player.currentTrack?.id === featuredTrack.id ? togglePlay() : setTrack(featuredTrack, [featuredTrack, ...(profile.tracks || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)))}
                >
                    {/* Cover */}
                    <div style={{ width: isMobile ? '48px' : '56px', height: isMobile ? '48px' : '56px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1e293b', flexShrink: 0 }}>
                        {trackCoverUrl ? (
                            <img src={trackCoverUrl} alt={featuredTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={20} color={colors.primary} /></div>
                        )}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#F27B13', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Featured Track</span>
                        <p style={{ margin: '2px 0 0', fontSize: isMobile ? '14px' : '16px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: player.currentTrack?.id === featuredTrack.id ? colors.primary : 'white' }}>
                            {featuredTrack.title}
                        </p>
                        {featuredTrack.description && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#B9C3CE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{featuredTrack.description}</p>}
                    </div>
                    {/* Play / Progress */}
                    {player.currentTrack?.id === featuredTrack.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: colors.primary }}>{Math.floor(player.currentTime/60)}:{(Math.floor(player.currentTime%60)).toString().padStart(2, '0')}</span>
                            <div style={{ width: isMobile ? '60px' : '100px', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '999px', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: `${(player.currentTime/player.duration)*100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: '999px' }} />
                            </div>
                        </div>
                    ) : null}
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${colors.primary}44` }}>
                        {player.currentTrack?.id === featuredTrack.id && player.isPlaying ? <Pause size={18} fill="white" color="white" /> : <Play size={18} fill="white" color="white" style={{ marginLeft: '2px' }} />}
                    </div>
                </div>
                )}

                {/* ── TWO-COLUMN LAYOUT ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '20px' }}>

                    {/* LEFT: Main Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Discography */}
                        <div>
                            {/* Header + Filter Tabs */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Award size={20} color="#F27B13" /> Discography
                                </h3>
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#1A1E2E', borderRadius: '8px', padding: '3px' }}>
                                    {(['all', 'tracks', 'reposts'] as const).map(tab => (
                                        <button key={tab} onClick={() => setDiscographyFilter(tab)} style={{
                                            padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                            backgroundColor: discographyFilter === tab ? colors.primary : 'transparent',
                                            color: discographyFilter === tab ? 'white' : colors.textSecondary,
                                        }}>
                                            {tab === 'all' ? `All (${(profile.tracks?.length || 0) + (profile.reposts?.length || 0)})` :
                                             tab === 'tracks' ? `Tracks (${profile.tracks?.length || 0})` :
                                             `Reposts (${profile.reposts?.length || 0})`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(() => {
                                const ownTracks = (profile.tracks || []).map(t => ({ ...t, _repost: false as const, _repostedAt: null as string | null, _originalArtist: null as any }));
                                const repostedTracks = (profile.reposts || []).map(t => ({ ...t, _repost: true as const }));
                                let filtered = discographyFilter === 'tracks' ? ownTracks
                                             : discographyFilter === 'reposts' ? repostedTracks
                                             : [...ownTracks, ...repostedTracks];
                                filtered.sort((a, b) => {
                                    const dateA = a._repostedAt || a.createdAt || '';
                                    const dateB = b._repostedAt || b.createdAt || '';
                                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                                });

                                if (filtered.length === 0) return (
                                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <Music size={40} color="#B9C3CE" style={{ opacity: 0.2, marginBottom: '12px' }} />
                                        <p style={{ color: '#B9C3CE', fontSize: '13px', margin: 0 }}>
                                            {discographyFilter === 'reposts' ? 'No reposts yet.' : discographyFilter === 'tracks' ? 'No tracks uploaded yet.' : 'No tracks uploaded yet.'}
                                        </p>
                                    </div>
                                );

                                const defaultPeaks = (id: string) => {
                                    const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                                    return Array.from({ length: 120 }, (_, i) => {
                                        const v = Math.sin(i * 0.15 + seed) * 0.3 + Math.sin(i * 0.05 + seed * 2) * 0.2 + 0.4;
                                        return Math.max(0.05, Math.min(1, v));
                                    });
                                };

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {filtered.map(track => {
                                            const isCurrentTrack = player.currentTrack?.id === track.id;
                                            const isPlaying = isCurrentTrack && player.isPlaying;
                                            const progress = isCurrentTrack ? (player.currentTime / (player.duration || 1)) : 0;
                                            const trackArtistUsername = track._repost && track._originalArtist ? track._originalArtist.username : profile.username;
                                            const trackArtistDisplay = track._repost && track._originalArtist
                                                ? (track._originalArtist.displayName || track._originalArtist.username)
                                                : (profile.displayName || profile.username);
                                            const trackArtistAvatar = track._repost && track._originalArtist ? track._originalArtist.avatar : profile.avatar;
                                            const peaks = (track.waveformPeaks as number[] | null) || defaultPeaks(track.id);
                                            const isFav = !!favourites[track.id];
                                            const isRep = !!reposts[track.id];
                                            const counts = track._count || { favourites: 0, reposts: 0, comments: 0 };

                                            const handlePlayClick = () => {
                                                if (isCurrentTrack) togglePlay();
                                                else setTrack(track, filtered);
                                            };

                                            const handleSeek = (pct: number) => {
                                                seek(pct * (player.duration || 0));
                                            };

                                            return (
                                                <div key={track.id + (track._repost ? '-repost' : '')} style={{
                                                    backgroundColor: track._repost ? '#2A2518' : colors.surface,
                                                    borderRadius: '8px',
                                                    border: track._repost ? '1px solid rgba(218,165,32,0.15)' : '1px solid rgba(255,255,255,0.06)',
                                                    overflow: 'hidden',
                                                }}>
                                                    {/* Repost banner */}
                                                    {track._repost && track._originalArtist && (
                                                        <div style={{
                                                            padding: '8px 16px', fontSize: '12px', color: '#DAA520',
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            borderBottom: '1px solid rgba(218,165,32,0.1)',
                                                            backgroundColor: 'rgba(218,165,32,0.06)',
                                                        }}>
                                                            <Repeat2 size={13} />
                                                            <span style={{ color: colors.textSecondary }}>{profile.displayName || profile.username} reposted</span>
                                                        </div>
                                                    )}

                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: isMobile ? 'column' : 'row',
                                                        gap: isMobile ? 0 : '16px',
                                                        padding: isMobile ? 0 : '16px',
                                                    }}>
                                                        {/* Cover art + play button */}
                                                        <div
                                                            style={{
                                                                width: isMobile ? '100%' : '130px',
                                                                height: isMobile ? '180px' : '130px',
                                                                minWidth: isMobile ? undefined : '130px',
                                                                borderRadius: isMobile ? 0 : '6px',
                                                                overflow: 'hidden', position: 'relative',
                                                                backgroundColor: '#1A1E2E', cursor: 'pointer',
                                                            }}
                                                            onClick={handlePlayClick}
                                                        >
                                                            {track.coverUrl ? (
                                                                <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <FujiLogo size={40} color={colors.primary} opacity={0.3} />
                                                                </div>
                                                            )}
                                                            <div style={{
                                                                position: 'absolute', inset: 0,
                                                                backgroundColor: isPlaying ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                opacity: isPlaying ? 1 : 0, transition: 'opacity 0.2s',
                                                            }}
                                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                                onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.opacity = '0'; }}
                                                            >
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                                                                    {isPlaying ? <Pause size={18} fill="white" color="white" /> : <Play size={18} fill="white" color="white" style={{ marginLeft: '2px' }} />}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: info + waveform + actions */}
                                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '12px' : 0 }}>
                                                            {/* Artist + time */}
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                                    <Link to={`/profile/${trackArtistUsername}`}>
                                                                        {trackArtistAvatar ? (
                                                                            <img src={trackArtistAvatar} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                                                                        ) : (
                                                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: colors.primary + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: colors.primary, fontWeight: 700 }}>
                                                                                {(trackArtistDisplay || '?')[0].toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </Link>
                                                                    <Link to={`/profile/${trackArtistUsername}`} style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}
                                                                        onMouseEnter={e => e.currentTarget.style.color = colors.primary}
                                                                        onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}>
                                                                        {trackArtistDisplay}
                                                                    </Link>
                                                                </div>
                                                                <span style={{ color: colors.textTertiary, fontSize: '10px', whiteSpace: 'nowrap' }}>
                                                                    {formatTime(track._repostedAt || track.createdAt || '')}
                                                                </span>
                                                            </div>

                                                            {/* Track title */}
                                                            <Link to={`/track/${trackArtistUsername}/${track.slug || track.id}`}
                                                                style={{ color: colors.textPrimary, textDecoration: 'none', fontSize: '14px', fontWeight: 700, marginBottom: '6px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                onMouseEnter={e => e.currentTarget.style.color = colors.primary}
                                                                onMouseLeave={e => e.currentTarget.style.color = colors.textPrimary}>
                                                                {track.title}
                                                            </Link>

                                                            {/* Waveform */}
                                                            <div
                                                                onClick={(e) => {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    const x = (e.clientX - rect.left) / rect.width;
                                                                    if (isPlaying || progress > 0) handleSeek(x);
                                                                    else handlePlayClick();
                                                                }}
                                                                style={{ width: '100%', height: '48px', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}
                                                            >
                                                                <svg width="100%" height="48" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 48`} style={{ display: 'block' }}>
                                                                    {peaks.map((peak, i) => {
                                                                        const h = Math.max(2, peak * 40);
                                                                        const y = (48 - h) / 2;
                                                                        const pct = i / peaks.length;
                                                                        const played = pct < progress;
                                                                        return <rect key={i} x={i} y={y} width={0.6} height={h} fill={played ? colors.primary : 'rgba(255,255,255,0.15)'} rx={0.2} />;
                                                                    })}
                                                                </svg>
                                                            </div>

                                                            {/* Genre tags */}
                                                            {track.genres && track.genres.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                                    {track.genres.slice(0, 3).map((g: any) => (
                                                                        <Link key={g.genre.slug} to={`/category/${g.genre.slug}`}
                                                                            style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textTertiary, textDecoration: 'none', fontWeight: 500 }}>
                                                                            #{g.genre.name}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Actions bar */}
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
                                                                marginTop: '8px', paddingTop: '8px',
                                                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                                            }}>
                                                                <button onClick={() => toggleFavourite(track.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isFav ? '#EF4444' : colors.textTertiary, fontSize: '12px', padding: 0, transition: 'color 0.2s' }}
                                                                    onMouseEnter={e => { if (!isFav) e.currentTarget.style.color = '#EF4444'; }}
                                                                    onMouseLeave={e => { if (!isFav) e.currentTarget.style.color = colors.textTertiary; }}>
                                                                    <Heart size={14} fill={isFav ? '#EF4444' : 'none'} />
                                                                    <span>{counts.favourites || ''}</span>
                                                                </button>
                                                                <button onClick={() => toggleRepost(track.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isRep ? colors.primary : colors.textTertiary, fontSize: '12px', padding: 0, transition: 'color 0.2s' }}
                                                                    onMouseEnter={e => { if (!isRep) e.currentTarget.style.color = colors.primary; }}
                                                                    onMouseLeave={e => { if (!isRep) e.currentTarget.style.color = colors.textTertiary; }}>
                                                                    <Repeat2 size={14} />
                                                                    <span>{counts.reposts || ''}</span>
                                                                </button>
                                                                <button onClick={() => navigate(`/track/${trackArtistUsername}/${track.slug || track.id}`)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: colors.textTertiary, fontSize: '12px', padding: 0 }}
                                                                    onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
                                                                    onMouseLeave={e => e.currentTarget.style.color = colors.textTertiary}>
                                                                    <MessageCircle size={13} />
                                                                    <span>{counts.comments || ''}</span>
                                                                </button>
                                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: colors.textTertiary, fontSize: '11px' }}>
                                                                    <Play size={10} fill={colors.textTertiary} />
                                                                    <span>{track.playCount >= 1000 ? (track.playCount / 1000).toFixed(1) + 'K' : track.playCount}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Beat Battle History */}
                        {battleEntries.length > 0 && (
                        <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? '20px' : '28px' }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Swords size={20} color={colors.primary} /> Beat Battle History
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {battleEntries.map((entry: any) => (
                                    <div key={entry.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px 14px', backgroundColor: entry.isWinner ? 'rgba(255,215,0,0.06)' : 'rgba(0,0,0,0.2)',
                                        borderRadius: '8px', border: entry.isWinner ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                        flexWrap: 'wrap', gap: '8px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                            {entry.avatarUrl && <img src={entry.avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />}
                                            <div style={{ minWidth: 0 }}>
                                                <Link to={`/battles/entry/${entry.id}`} style={{ margin: 0, fontWeight: 700, color: colors.textPrimary, fontSize: '13px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.trackTitle}</Link>
                                                <p style={{ margin: '1px 0 0', color: colors.textSecondary, fontSize: '11px' }}>{entry.battle.title}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                            {entry.isWinner && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: '#FFD700' }}><Trophy size={13} /> Winner</span>}
                                            {!entry.isWinner && entry.battle.status === 'completed' && <span style={{ fontSize: '11px', color: colors.textSecondary }}>#{entry.placement}/{entry.totalEntries}</span>}
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: colors.primary, fontSize: '12px' }}><Flame size={13} /> {entry.voteCount}</span>
                                            <button
                                                onClick={() => { if (player.currentTrack?.id === `battle-${entry.id}`) { togglePlay(); return; } setTrack({ id: `battle-${entry.id}`, title: entry.trackTitle, artist: profile.username, cover: entry.avatarUrl || entry.coverUrl || '', url: `${entry.audioUrl}` }); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
                                            >
                                                {player.currentTrack?.id === `battle-${entry.id}` && player.isPlaying ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Play</>}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                        {/* Comments */}
                        <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? '20px' : '28px' }}>
                            <CommentSection profileId={profile.id} ownerId={profile.userId} />
                        </div>
                    </div>

                    {/* RIGHT: Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* About Card */}
                        {(profile.bio || socials.some(s => !!(profile as any)[s.key])) && (
                        <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B9C3CE' }}>About</h4>
                            {profile.bio && <p style={{ fontSize: '13px', color: 'rgba(185,195,206,0.85)', margin: '0 0 16px', lineHeight: 1.6 }}>{profile.bio}</p>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {socials.map(s => {
                                    const url = (profile as any)[s.key];
                                    if (!url) return null;
                                    const inner = (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {React.cloneElement(s.icon as React.ReactElement, { color: s.color, size: 14 })}
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'white', flex: 1 }}>{s.label}</span>
                                            {!s.isHandle && <ExternalLink size={12} color="#B9C3CE" />}
                                            {s.isHandle && <span style={{ fontSize: '10px', color: '#94a3b8' }}>{url}</span>}
                                        </div>
                                    );
                                    return s.isHandle ? <div key={s.key}>{inner}</div> : <a key={s.key} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>;
                                })}
                            </div>
                        </div>
                        )}

                        {/* Gear Rack */}
                        {gear.length > 0 && (
                        <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B9C3CE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Hammer size={16} color="#7A8C37" /> Gear & Tools
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {gear.map((item: any, i: number) => (
                                    <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: '#7A8C37', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{item.category || 'Other'}</p>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: '3px 0 0' }}>{item.name || item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                        {/* Quick Stats Card */}
                        <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B9C3CE' }}>Stats</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {stats.map(s => (
                                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#B9C3CE' }}>{s.label}</span>
                                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            {/* Back to Edit Button (Owner only) */}
            {isOwnProfile && (
                <button 
                    onClick={onEdit}
                    style={{ 
                        position: 'fixed', bottom: player.currentTrack ? '104px' : '24px', right: '24px', 
                        backgroundColor: colors.primary, color: 'white', padding: isMobile ? '12px' : '12px 24px', 
                        borderRadius: '999px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', zIndex: 100,
                        transition: 'bottom 0.3s'
                    }}
                >
                    <Edit3 size={18} /> {!isMobile && 'Edit My Profile'}
                </button>
            )}

            <div style={{ height: player.currentTrack ? '100px' : '20px' }} />
        </div>
    );
};
