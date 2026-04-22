import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { useChat } from '../components/ChatProvider';
import axios from 'axios';
import { ReportButton } from '../components/ReportButton';
import { 
    Music, Hammer, Instagram, Youtube, MessageCircle, Radio,
    Edit3, Pause, ExternalLink, Award, Zap, Play, Copy, Check,
    Swords, Trophy, Flame, UserPlus, UserCheck, Repeat2, Heart, Share2, ListMusic, Clock, Star
} from 'lucide-react';
import { CommentSection } from '../components/CommentSection';
import { FujiLogo } from '../components/FujiLogo';

interface MusicianProfile {
    id: string;
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bannerUrl: string | null;
    bio: string | null;
    spotifyUrl: string | null;
    soundcloudUrl: string | null;
    youtubeUrl: string | null;
    instagramUrl: string | null;
    discordUrl: string | null;
    hardware: string[];
    gearList: string[];
    genres: { genre: { id?: string; name: string; slug?: string } }[];
    primaryGenreId?: string | null;
    primaryGenre?: { id: string; name: string; slug: string } | null;
    totalPlays?: number;
    featuredTrackId?: string | null;
    featuredTrack?: {
        id: string;
        title: string;
        slug?: string | null;
        url: string;
        coverUrl: string | null;
        description: string | null;
        duration?: number | null;
        playCount?: number;
        createdAt?: string;
        genres?: { genre: { name: string; slug: string } }[];
        _count?: { favourites: number; comments: number };
    };
    featuredPlaylistId?: string | null;
    accentColor?: string | null;
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

export const MusicianProfilePublic: React.FC<{ identifier: string; onEdit?: () => void; isOwnProfile: boolean; initialProfile?: any }> = ({ identifier, onEdit, isOwnProfile, initialProfile }) => {
    const navigate = useNavigate();
    const { user, mutualAdminGuilds } = useAuth();
    const isAdmin = !!(mutualAdminGuilds && mutualAdminGuilds.length > 0);
    const [profile, setProfile] = useState<MusicianProfile | null>(initialProfile || null);
    const [loading, setLoading] = useState(!initialProfile);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [copied, setCopied] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [startingChat, setStartingChat] = useState(false);
    const [discographyFilter, setDiscographyFilter] = useState<'all' | 'tracks' | 'reposts'>('all');
    const [favourites, setFavourites] = useState<Record<string, boolean>>({});
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    // Battle submissions
    const [battleEntries, setBattleEntries] = useState<any[]>([]);

    // Enhanced profile style
    const [profileStyle, setProfileStyle] = useState<{
        gradient: string | null;
        animation: string;
        glowColor: string | null;
        glowIntensity: number;
        badgeLabel: string | null;
        badgeColor: string | null;
    } | null>(null);

    // Player Context
    const { player, setTrack, togglePlay, seek } = usePlayer();

    const toggleFavourite = async (trackId: string) => {
        try {
            const { data } = await axios.post(`/api/tracks/${trackId}/favourite`, {}, { withCredentials: true });
            setFavourites(prev => ({ ...prev, [trackId]: data.favourited }));
        } catch {}
    };

    const toggleRepost = async (trackId: string) => {
        if (isOwnProfile) return;
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

    const { startConversation: chatStart } = useChat();

    const startMessage = async () => {
        if (!profile || !user || startingChat) return;
        setStartingChat(true);
        try {
            await chatStart([profile.userId], false);
        } catch {
            // User may not be logged in or API error
        } finally {
            setStartingChat(false);
        }
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

    // Inject animation keyframes for enhanced profile styles
    useEffect(() => {
        if (document.getElementById('ps-anim-css')) return;
        const el = document.createElement('style');
        el.id = 'ps-anim-css';
        el.textContent = [
            '@keyframes ps-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }',
            '@keyframes ps-pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }',
            '@keyframes ps-rainbow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }',
            '.ps-anim-shimmer { background-size: 200% auto !important; animation: ps-shimmer 2.4s linear infinite !important; }',
            '.ps-anim-pulse   { animation: ps-pulse 2s ease-in-out infinite !important; }',
            '.ps-anim-rainbow { animation: ps-rainbow 4s linear infinite !important; }',
        ].join('\n');
        document.head.appendChild(el);
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
            let data: any;

            if (initialProfile && (initialProfile.username === identifier || initialProfile.id === identifier)) {
                // Use pre-fetched profile from parent — no duplicate API call
                data = initialProfile;
                // Map socials if needed
                if (data.socials && Array.isArray(data.socials)) {
                    data.socials.forEach((s: any) => {
                        if (s.platform === 'spotify') data.spotifyUrl = s.url;
                        if (s.platform === 'soundcloud') data.soundcloudUrl = s.url;
                        if (s.platform === 'youtube') data.youtubeUrl = s.url;
                        if (s.platform === 'instagram') data.instagramUrl = s.url;
                        if (s.platform === 'discord') data.discordUrl = s.url;
                    });
                }
                setProfile(data);
                setLoading(false);
            } else {
                // No pre-fetched data — fetch from API
                setLoading(true);
                try {
                    const res = await axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true });
                    data = res.data;
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
                    setLoading(false);
                } catch (err: any) {
                    setError(err.response?.status === 404 ? 'Profile not found' : 'Failed to load profile');
                    setLoading(false);
                    return;
                }
            }

            // Load all supplementary data in parallel (non-blocking — page already rendered)
            const allTrackIds = [...(data.tracks || []).map((t: any) => t.id), ...(data.reposts || []).map((t: any) => t.id)];
            const supplementary: Promise<any>[] = [
                axios.get(`/api/artists/${data.id}/follower-count`).catch(() => null),
                axios.get(`/api/artists/${data.id}/follow`, { withCredentials: true }).catch(() => null),
                axios.get(`/api/beat-battle/user/${data.userId}/entries`).catch(() => null),
            ];
            if (allTrackIds.length > 0) {
                supplementary.push(
                    axios.post('/api/tracks/favourites/check', { trackIds: allTrackIds }, { withCredentials: true }).catch(() => null),
                    axios.post('/api/tracks/reposts/check', { trackIds: allTrackIds }, { withCredentials: true }).catch(() => null),
                );
            }
            const [countRes, followRes, entriesRes, favRes, repRes] = await Promise.all(supplementary);
            if (countRes?.data) setFollowerCount(countRes.data.count);
            if (followRes?.data) setIsFollowing(followRes.data.following);
            if (entriesRes?.data) setBattleEntries(entriesRes.data);
            if (favRes?.data) setFavourites(favRes.data);
            if (repRes?.data) setReposts(repRes.data);
        };
        fetchProfile();
    }, [identifier]);

    // Fetch enhanced profile style separately, keyed on userId once profile is loaded
    useEffect(() => {
        if (!profile?.userId) return;
        axios.get(`/api/profile-styles/${profile.userId}`).then(r => {
            setProfileStyle(r.data || null);
        }).catch(() => {});
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
    // Use user-chosen accent colour, falling back to theme primary
    const accent = profile.accentColor || colors.primary;
    // User-chosen card background, falling back to default dark card colour
    const cardBg = profile.cardBgColor || '#242C3D';
    // Determine if the card bg is perceptually light (needs dark text)
    const isLightCard = !!profile.cardBgColor && (() => {
        const hex = profile.cardBgColor!.replace('#', '');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
        const toL = (x:number) => x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;
        return 0.2126*toL(r)+0.7152*toL(g)+0.0722*toL(b) > 0.35;
    })();
    // Card-context responsive colors — flip for light cards
    const cardText    = isLightCard ? '#0F172A' : '#F8FAFC';
    const cardTextSec = isLightCard ? '#475569' : '#B9C3CE';
    const cardTextTer = isLightCard ? '#94A3B8' : 'rgba(185,195,206,0.5)';
    const cardBorder  = isLightCard ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    const cardSubtle  = isLightCard ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.04)';
    const cardWave    = isLightCard ? `${accent}30` : 'rgba(255,255,255,0.15)';
    // Nested inner panel bg (social rows, gear items, etc)
    const cardInner   = isLightCard ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.2)';
    // Soft shadow for cards in light mode (depth instead of borders)
    const cardShadow  = isLightCard ? '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)' : 'none';
    // Page background — blend with dark or light depending on card style
    const pageBg = profile.cardBgColor
        ? isLightCard ? `color-mix(in srgb, ${profile.cardBgColor} 45%, #E2E8F0)` : `color-mix(in srgb, ${profile.cardBgColor} 60%, #0E121A)`
        : '#0E121A';
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
    ];

    const featuredTrack = profile.featuredTrack ? { ...profile.featuredTrack, username: profile.username } : null;
    const featuredPlaylist = profile.featuredPlaylist || null;
    const featuredPlaylistTracks = featuredPlaylist?.tracks?.map(pt => ({ ...pt.track, username: pt.track.profile?.username || profile.username })) || [];
    
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
            color: isLightCard ? '#0F172A' : '#F8FAFC',
            fontFamily: 'Inter, system-ui, sans-serif',
            backgroundColor: pageBg,
            minHeight: '100vh',
        }}>
            {/* ── HERO BANNER ── */}
            <div style={{ position: 'relative', minHeight: isMobile ? '320px' : '380px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                {/* Background — user banner, or featured art/avatar as blurred backdrop */}
                {profile.bannerUrl ? (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${profile.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', pointerEvents: 'none' }} />
                ) : (trackCoverUrl || featuredPlaylist?.coverUrl || avatarUrl) ? (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${trackCoverUrl || featuredPlaylist?.coverUrl || avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3, filter: 'blur(60px) saturate(1.8)', transform: 'scale(1.3)', pointerEvents: 'none' }} />
                ) : null}
                <div style={{ position: 'absolute', inset: 0, background: isLightCard
                    ? (profile.bannerUrl
                        ? `linear-gradient(to top, ${pageBg} 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.25) 100%)`
                        : `linear-gradient(to top, ${pageBg} 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0.5) 100%)`)
                    : (profile.bannerUrl
                        ? `linear-gradient(to top, ${pageBg} 0%, rgba(14,18,26,0.7) 50%, rgba(14,18,26,0.3) 100%)`
                        : `linear-gradient(to top, ${pageBg} 0%, rgba(14,18,26,0.85) 40%, rgba(14,18,26,0.4) 100%)`), pointerEvents: 'none' }} />

                {/* Hero Content */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '24px 16px' : '48px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-end', gap: isMobile ? '20px' : '32px' }}>
                        {/* Avatar */}
                        <div style={{
                            width: isMobile ? '140px' : '180px', height: isMobile ? '140px' : '180px',
                            borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            border: profileStyle?.glowColor
                                ? `4px solid ${profileStyle.glowColor}88`
                                : isLightCard ? '4px solid rgba(255,255,255,0.9)' : '4px solid rgba(255,255,255,0.1)',
                            boxShadow: profileStyle?.glowColor
                                ? `0 0 ${profileStyle.glowIntensity * 5}px ${profileStyle.glowColor}99, 0 20px 50px rgba(0,0,0,0.5)`
                                : isLightCard ? '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' : '0 20px 50px rgba(0,0,0,0.5)',
                        }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={profile.displayName || profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', backgroundColor: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 800 }}>
                                    {profile.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left', minWidth: 0 }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>Artist Profile</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start', marginBottom: '8px' }}>
                                <h1
                                    className={profileStyle?.animation && profileStyle.animation !== 'none' ? `ps-anim-${profileStyle.animation}` : undefined}
                                    style={{
                                        fontSize: isMobile ? '32px' : '52px', fontWeight: 900, margin: 0,
                                        letterSpacing: '-0.03em', lineHeight: 1.05, wordWrap: 'break-word',
                                        ...(profileStyle?.gradient
                                            ? { background: profileStyle.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                                            : {}),
                                    }}>
                                    {profile.displayName || profile.username}
                                </h1>
                                {profileStyle?.badgeLabel && (
                                    <span style={{
                                        fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
                                        backgroundColor: `${profileStyle.badgeColor || '#FFD700'}22`,
                                        border: `1px solid ${profileStyle.badgeColor || '#FFD700'}55`,
                                        color: profileStyle.badgeColor || '#FFD700',
                                        textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                                    }}>
                                        {profileStyle.badgeLabel}
                                    </span>
                                )}
                            </div>
                            {profile.bio && (
                                <p style={{ color: isLightCard ? 'rgba(51,65,85,0.9)' : 'rgba(185,195,206,0.8)', fontSize: '14px', margin: '0 0 14px', lineHeight: 1.5, maxWidth: '520px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {profile.bio}
                                </p>
                            )}
                            {/* Genre Chips + Stats inline */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', marginBottom: '16px' }}>
                                {/* Primary genre — larger, full color */}
                                {profile.primaryGenre && (
                                    <span onClick={() => navigate(`/category/${profile.primaryGenre!.slug}`)} style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}66`, color: accent, padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                                        {profile.primaryGenre.name}
                                    </span>
                                )}
                                {/* Secondary genres — smaller, muted */}
                                {profile.genres.filter((g: any) => g.genre && g.genre.id !== profile.primaryGenreId).map((g: any, i: number) => (
                                    <span key={i} onClick={() => navigate(`/category/${g.genre.slug}`)} style={{ backgroundColor: `${accent}0D`, border: `1px solid ${accent}2A`, color: `${accent}BB`, padding: '3px 9px', borderRadius: '999px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>{g.genre.name}</span>
                                ))}
                                {/* If no primary genre, fall back to showing all genres with original style */}
                                {!profile.primaryGenre && profile.genres.filter((g: any) => g.genre).map((g: any, i: number) => (
                                    <span key={i} onClick={() => navigate(`/category/${g.genre.slug}`)} style={{ backgroundColor: `${accent}1A`, border: `1px solid ${accent}4D`, color: accent, padding: '3px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>{g.genre.name}</span>
                                ))}
                                <span style={{ color: isLightCard ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)', fontSize: '10px' }}>|</span>
                                {stats.map((s, i) => (
                                    <span key={i} style={{ fontSize: '12px', color: isLightCard ? '#4A5568' : '#B9C3CE' }}>
                                        <strong style={{ color: isLightCard ? '#1A202C' : 'white', fontWeight: 700 }}>{s.value}</strong> {s.label}
                                    </span>
                                ))}
                            </div>
                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                {!isOwnProfile && (
                                    <button onClick={toggleFollow} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', border: isFollowing ? `1px solid ${accent}4D` : 'none', backgroundColor: isFollowing ? 'transparent' : accent, color: isFollowing ? accent : 'white', transition: 'all 0.2s' }}>
                                        {isFollowing ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                                    </button>
                                )}
                                {!isOwnProfile && user && (
                                    <button onClick={startMessage} disabled={startingChat} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: startingChat ? 'default' : 'pointer', border: `1px solid ${accent}4D`, backgroundColor: `${accent}1A`, color: accent, transition: 'all 0.2s', opacity: startingChat ? 0.6 : 1 }}>
                                        <MessageCircle size={13} /> {startingChat ? 'Opening…' : 'Message'}
                                    </button>
                                )}
                                {(isOwnProfile || isAdmin) && (
                                    <button
                                        onClick={() => isOwnProfile ? (onEdit ? onEdit() : navigate('/profile/edit')) : navigate(`/profile/edit?adminTarget=${profile.userId}`)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.5)' : `${accent}4D`}`, backgroundColor: isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.1)' : `${accent}1A`, color: isAdmin && !isOwnProfile ? '#ff9800' : accent, transition: 'all 0.2s' }}
                                    >
                                        <Edit3 size={13} /> {isAdmin && !isOwnProfile ? 'Edit Profile (Admin)' : 'Edit Profile'}
                                    </button>
                                )}
                                {isOwnProfile && (
                                    <button
                                        onClick={() => navigate('/my-tracks')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${accent}4D`, backgroundColor: `${accent}1A`, color: accent, transition: 'all 0.2s' }}
                                    >
                                        <ListMusic size={13} /> Manage Tracks
                                    </button>
                                )}
                                <button onClick={handleCopyProfileLink} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'}`, backgroundColor: copied ? 'rgba(76,175,80,0.15)' : (isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'), color: copied ? '#4caf50' : (isLightCard ? '#4A5568' : '#B9C3CE'), transition: 'all 0.2s' }}>
                                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Share</>}
                                </button>
                                {!isOwnProfile && user && profile?.id && (
                                    <ReportButton targetType="profile" targetId={profile.id} style={{ padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'}`, backgroundColor: isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', color: isLightCard ? '#4A5568' : '#B9C3CE' }} />
                                )}
                                {/* Social Icons inline */}
                                {socials.map(s => {
                                    const url = (profile as any)[s.key];
                                    if (!url) return null;
                                    const inner = (
                                        <div style={{ width: '34px', height: '34px', borderRadius: '999px', backgroundColor: isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${s.color}20`; e.currentTarget.style.borderColor = `${s.color}60`; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = isLightCard ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'; }}>
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
                    border: `1px solid ${accent}22`,
                    marginBottom: '20px',
                    position: 'relative',
                    display: 'flex',
                    background: `linear-gradient(135deg, ${cardBg} 0%, color-mix(in srgb, ${cardBg} 80%, #242C3D) 100%)`,
                    color: cardText,
                }}>
                    {featuredPlaylist.coverUrl && (
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featuredPlaylist.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15, filter: 'blur(40px)', transform: 'scale(1.2)', pointerEvents: 'none' }} />
                    )}
                    <div style={{ position: 'relative', width: '100%', padding: isMobile ? '20px' : '28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '16px' : '24px' }}>
                        {/* Cover */}
                        <div style={{ flexShrink: 0, width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px', borderRadius: '8px', overflow: 'hidden', backgroundColor: isLightCard ? 'rgba(0,0,0,0.04)' : '#1e293b', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`, boxShadow: isLightCard ? '0 4px 12px rgba(0,0,0,0.08)' : '0 12px 30px rgba(0,0,0,0.4)' }}>
                            {featuredPlaylist.coverUrl ? (
                                <img src={featuredPlaylist.coverUrl} alt={featuredPlaylist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={40} color={accent} />
                                </div>
                            )}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
                            <span style={{ backgroundColor: featuredPlaylist.releaseType === 'album' ? '#7C3AED' : featuredPlaylist.releaseType === 'ep' ? '#0369A1' : featuredPlaylist.releaseType === 'single' ? '#B45309' : accent, color: 'white', fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {featuredPlaylist.releaseType ? `Featured ${featuredPlaylist.releaseType}` : 'Featured Release'}
                            </span>
                            <h3 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, margin: '8px 0 4px', letterSpacing: '-0.01em' }}>{featuredPlaylist.name}</h3>
                            {featuredPlaylist.description && (
                                <p style={{ color: cardTextSec, fontSize: '12px', margin: '0 0 12px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{featuredPlaylist.description}</p>
                            )}
                            {/* Marquee track pills */}
                            {featuredPlaylistTracks.length > 0 && !isMobile && (
                                <div style={{ overflow: 'hidden', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', gap: '6px', animation: 'marquee-release 20s linear infinite', width: 'max-content' }}>
                                        {[...featuredPlaylistTracks, ...featuredPlaylistTracks].map((t, i) => (
                                            <span key={i} style={{ backgroundColor: cardSubtle, border: `1px solid ${cardBorder}`, borderRadius: '999px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: cardTextSec, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                            style={{ padding: '10px 24px', borderRadius: '999px', backgroundColor: accent, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', color: 'white', cursor: featuredPlaylistTracks.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: `0 4px 15px ${accent}44`, flexShrink: 0, opacity: featuredPlaylistTracks.length > 0 ? 1 : 0.5 }}
                        >
                            {player.currentTrack?.id === featuredPlaylistTracks[0]?.id && player.isPlaying ? <><Pause size={16} fill="currentColor" /> Pause</> : <><Play size={16} fill="currentColor" /> Play</>}
                        </button>
                    </div>
                </div>
                )}

                {/* Featured Track — Hero Card */}
                {featuredTrack && (
                <div style={{
                    borderRadius: '12px', overflow: 'hidden',
                    border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.06)' : `${accent}22`}`,
                    marginBottom: '20px',
                    position: 'relative',
                    background: isLightCard
                        ? `linear-gradient(135deg, ${cardBg} 0%, color-mix(in srgb, ${cardBg} 85%, #ffffff) 100%)`
                        : `linear-gradient(135deg, ${cardBg} 0%, color-mix(in srgb, ${cardBg} 80%, #242C3D) 100%)`,
                    boxShadow: cardShadow,
                    color: cardText,
                }}>
                    {/* Blurred artwork backdrop */}
                    {trackCoverUrl && (
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${trackCoverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18, filter: 'blur(50px) saturate(1.6)', transform: 'scale(1.3)', pointerEvents: 'none' }} />
                    )}
                    <div style={{ position: 'relative', width: '100%', padding: isMobile ? '20px' : '28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? '16px' : '24px' }}>
                        {/* Cover art with play overlay */}
                        <div
                            style={{ flexShrink: 0, width: isMobile ? '140px' : '160px', height: isMobile ? '140px' : '160px', borderRadius: '10px', overflow: 'hidden', backgroundColor: isLightCard ? 'rgba(0,0,0,0.04)' : '#1e293b', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`, boxShadow: isLightCard ? '0 4px 16px rgba(0,0,0,0.1)' : '0 16px 40px rgba(0,0,0,0.5)', cursor: 'pointer', position: 'relative' }}
                            onClick={() => featuredTrack && (player.currentTrack?.id === featuredTrack.id ? togglePlay() : setTrack(featuredTrack, [featuredTrack, ...(profile.tracks || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)))}
                        >
                            {trackCoverUrl ? (
                                <img src={trackCoverUrl} alt={featuredTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={48} color={accent} /></div>
                            )}
                            {/* Play overlay */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: player.currentTrack?.id === featuredTrack.id && player.isPlaying ? (isLightCard ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)') : (isLightCard ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'), transition: 'background 0.2s', opacity: player.currentTrack?.id === featuredTrack.id ? 1 : 0 }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => { if (player.currentTrack?.id !== featuredTrack.id || !player.isPlaying) e.currentTarget.style.opacity = '0'; }}
                            >
                                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px ${accent}66` }}>
                                    {player.currentTrack?.id === featuredTrack.id && player.isPlaying ? <Pause size={22} fill="white" color="white" /> : <Play size={22} fill="white" color="white" style={{ marginLeft: '2px' }} />}
                                </div>
                            </div>
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0, textAlign: isMobile ? 'center' : 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                <Star size={12} color="#F27B13" fill="#F27B13" />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#F27B13', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Featured Track</span>
                            </div>
                            <h3 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: player.currentTrack?.id === featuredTrack.id ? accent : cardText, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {featuredTrack.title}
                            </h3>
                            {featuredTrack.description && (
                                <p style={{ color: cardTextSec, fontSize: '12px', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{featuredTrack.description}</p>
                            )}
                            {/* Genre pills */}
                            {featuredTrack.genres && featuredTrack.genres.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start', marginTop: '2px' }}>
                                    {featuredTrack.genres.slice(0, 3).map((g, i) => (
                                        <Link key={i} to={`/category/${g.genre.slug}`} style={{ backgroundColor: `${accent}1A`, border: `1px solid ${accent}33`, color: accent, padding: '3px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = `${accent}33`}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = `${accent}1A`}
                                        >{g.genre.name}</Link>
                                    ))}
                                </div>
                            )}
                            {/* Stats row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                {typeof featuredTrack.playCount === 'number' && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: cardTextSec }}>
                                        <Play size={11} /> {featuredTrack.playCount.toLocaleString()} plays
                                    </span>
                                )}
                                {featuredTrack._count?.favourites != null && featuredTrack._count.favourites > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: cardTextSec }}>
                                        <Heart size={11} /> {featuredTrack._count.favourites}
                                    </span>
                                )}
                                {featuredTrack._count?.comments != null && featuredTrack._count.comments > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: cardTextSec }}>
                                        <MessageCircle size={11} /> {featuredTrack._count.comments}
                                    </span>
                                )}
                                {featuredTrack.duration != null && featuredTrack.duration > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: cardTextSec }}>
                                        <Clock size={11} /> {Math.floor(featuredTrack.duration / 60)}:{(featuredTrack.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                )}
                            </div>
                            {/* Progress bar when playing */}
                            {player.currentTrack?.id === featuredTrack.id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', maxWidth: isMobile ? '100%' : '320px' }}>
                                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: accent, minWidth: '32px' }}>{Math.floor(player.currentTime / 60)}:{(Math.floor(player.currentTime % 60)).toString().padStart(2, '0')}</span>
                                    <div style={{ flex: 1, height: '4px', backgroundColor: cardWave, borderRadius: '999px', position: 'relative' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: `${(player.currentTime / player.duration) * 100}%`, height: '100%', backgroundColor: accent, borderRadius: '999px', transition: 'width 0.3s linear' }} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(185,195,206,0.5)', minWidth: '32px', textAlign: 'right' }}>{Math.floor(player.duration / 60)}:{(Math.floor(player.duration % 60)).toString().padStart(2, '0')}</span>
                                </div>
                            )}
                        </div>
                        {/* Play button (desktop only — mobile taps the cover) */}
                        {!isMobile && (
                            <button
                                onClick={() => featuredTrack && (player.currentTrack?.id === featuredTrack.id ? togglePlay() : setTrack(featuredTrack, [featuredTrack, ...(profile.tracks || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)))}
                                style={{ padding: '12px 28px', borderRadius: '999px', backgroundColor: accent, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', boxShadow: `0 4px 15px ${accent}44`, flexShrink: 0, alignSelf: 'center', transition: 'transform 0.15s, box-shadow 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 6px 20px ${accent}66`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 4px 15px ${accent}44`; }}
                            >
                                {player.currentTrack?.id === featuredTrack.id && player.isPlaying ? <><Pause size={16} fill="currentColor" /> Pause</> : <><Play size={16} fill="currentColor" /> Play</>}
                            </button>
                        )}
                    </div>
                </div>
                )}

                {/* ── TWO-COLUMN LAYOUT ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '20px' }}>

                    {/* LEFT: Main Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

                        {/* Discography */}
                        <div>
                            {/* Header + Filter Tabs */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', color: cardText }}>
                                    <Award size={20} color="#F27B13" /> Discography
                                </h3>
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: isLightCard ? 'rgba(0,0,0,0.05)' : '#1A1E2E', borderRadius: '8px', padding: '3px' }}>
                                    {(['all', 'tracks', 'reposts'] as const).map(tab => (
                                        <button key={tab} onClick={() => setDiscographyFilter(tab)} style={{
                                            padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                            backgroundColor: discographyFilter === tab ? accent : 'transparent',
                                            color: discographyFilter === tab ? 'white' : cardTextSec,
                                        }}>
                                            {tab === 'all' ? `All (${(profile.tracks?.length || 0) + (profile.reposts?.length || 0)})` :
                                             tab === 'tracks' ? `Tracks (${profile.tracks?.length || 0})` :
                                             `Reposts (${profile.reposts?.length || 0})`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(() => {
                                const ownTracks = (profile.tracks || []).map(t => ({ ...t, username: profile.username, _repost: false as const, _repostedAt: null as string | null, _originalArtist: null as any }));
                                const repostedTracks = (profile.reposts || []).map(t => ({ ...t, username: t._originalArtist?.username || profile.username, _repost: true as const }));
                                let filtered = discographyFilter === 'tracks' ? ownTracks
                                             : discographyFilter === 'reposts' ? repostedTracks
                                             : [...ownTracks, ...repostedTracks];
                                filtered.sort((a, b) => {
                                    const dateA = a._repostedAt || a.createdAt || '';
                                    const dateB = b._repostedAt || b.createdAt || '';
                                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                                });

                                if (filtered.length === 0) return (
                                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${cardBorder}` }}>
                                        <Music size={40} color={cardTextSec} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                        <p style={{ color: cardTextSec, fontSize: '13px', margin: 0 }}>
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
                                            const trackArtistAvatar = (() => {
                                                const raw = track._repost && track._originalArtist ? track._originalArtist.avatar : profile.avatar;
                                                if (!raw) return null;
                                                if (raw.startsWith('http') || raw.startsWith('/uploads/')) return raw;
                                                const uid = track._repost && track._originalArtist ? track._originalArtist.userId : profile.userId;
                                                return `https://cdn.discordapp.com/avatars/${uid}/${raw}.png?size=256`;
                                            })();
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
                                                    backgroundColor: track._repost ? (isLightCard ? `color-mix(in srgb, ${cardBg} 80%, #F5E6C8)` : `color-mix(in srgb, ${cardBg} 80%, #2A2518)`) : cardBg,
                                                    borderRadius: '8px',
                                                    border: track._repost ? '1px solid rgba(218,165,32,0.15)' : `1px solid ${cardBorder}`,
                                                    color: cardText,
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
                                                            <span style={{ color: cardTextSec }}>{profile.displayName || profile.username} reposted</span>
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
                                                                backgroundColor: isLightCard ? 'rgba(0,0,0,0.04)' : '#1A1E2E', cursor: 'pointer',
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
                                                                backgroundColor: isPlaying ? (isLightCard ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)') : (isLightCard ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'),
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                opacity: isPlaying ? 1 : 0, transition: 'opacity 0.2s',
                                                            }}
                                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                                onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.opacity = '0'; }}
                                                            >
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
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
                                                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: accent + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: accent, fontWeight: 700 }}>
                                                                                {(trackArtistDisplay || '?')[0].toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </Link>
                                                                    <Link to={`/profile/${trackArtistUsername}`} style={{ color: cardTextSec, textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}
                                                                        onMouseEnter={e => e.currentTarget.style.color = accent}
                                                                        onMouseLeave={e => e.currentTarget.style.color = cardTextSec}>
                                                                        {trackArtistDisplay}
                                                                    </Link>
                                                                </div>
                                                                <span style={{ color: cardTextTer, fontSize: '10px', whiteSpace: 'nowrap' }}>
                                                                    {formatTime(track._repostedAt || track.createdAt || '')}
                                                                </span>
                                                            </div>

                                                            {/* Track title */}
                                                            <Link to={`/track/${trackArtistUsername}/${track.slug || track.id}`}
                                                                style={{ color: cardText, textDecoration: 'none', fontSize: '14px', fontWeight: 700, marginBottom: '6px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                onMouseEnter={e => e.currentTarget.style.color = accent}
                                                                onMouseLeave={e => e.currentTarget.style.color = cardText}>
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
                                                                        return <rect key={i} x={i} y={y} width={0.6} height={h} fill={played ? accent : cardWave} rx={0.2} />;
                                                                    })}
                                                                </svg>
                                                            </div>

                                                            {/* Genre tags */}
                                                            {track.genres && track.genres.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                                    {track.genres.slice(0, 3).map((g: any) => (
                                                                        <Link key={g.genre.slug} to={`/category/${g.genre.slug}`}
                                                                            style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '10px', backgroundColor: cardSubtle, color: cardTextTer, textDecoration: 'none', fontWeight: 500 }}>
                                                                            #{g.genre.name}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Actions bar */}
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
                                                                marginTop: '8px', paddingTop: '8px',
                                                                borderTop: `1px solid ${cardBorder}`,
                                                            }}>
                                                                <button onClick={() => toggleFavourite(track.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isFav ? '#EF4444' : cardTextTer, fontSize: '12px', padding: 0, transition: 'color 0.2s' }}
                                                                    onMouseEnter={e => { if (!isFav) e.currentTarget.style.color = '#EF4444'; }}
                                                                    onMouseLeave={e => { if (!isFav) e.currentTarget.style.color = cardTextTer; }}>
                                                                    <Heart size={14} fill={isFav ? '#EF4444' : 'none'} />
                                                                    <span>{counts.favourites || ''}</span>
                                                                </button>
                                                                {!isOwnProfile && (
                                                                <button onClick={() => toggleRepost(track.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isRep ? accent : cardTextTer, fontSize: '12px', padding: 0, transition: 'color 0.2s' }}
                                                                    onMouseEnter={e => { if (!isRep) e.currentTarget.style.color = accent; }}
                                                                    onMouseLeave={e => { if (!isRep) e.currentTarget.style.color = cardTextTer; }}>
                                                                    <Repeat2 size={14} />
                                                                    <span>{counts.reposts || ''}</span>
                                                                </button>
                                                                )}
                                                                <button onClick={() => navigate(`/track/${trackArtistUsername}/${track.slug || track.id}`)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: cardTextTer, fontSize: '12px', padding: 0 }}
                                                                    onMouseEnter={e => e.currentTarget.style.color = cardText}
                                                                    onMouseLeave={e => e.currentTarget.style.color = cardTextTer}>
                                                                    <MessageCircle size={13} />
                                                                    <span>{counts.comments || ''}</span>
                                                                </button>
                                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: cardTextTer, fontSize: '11px' }}>
                                                                    <Play size={10} fill={cardTextTer} />
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
                        <div style={{
                            borderRadius: '14px',
                            border: isLightCard ? '1px solid rgba(180,140,0,0.4)' : '1px solid rgba(255,215,0,0.18)',
                            padding: isMobile ? '20px' : '28px',
                            position: 'relative',
                            overflow: 'hidden',
                            background: isLightCard ? 'linear-gradient(145deg, #FAEFD4 0%, #FFF9E9 60%, #EEF4FF 100%)' : 'linear-gradient(145deg, #1C1A10 0%, #252318 60%, #1A1E2E 100%)',
                            boxShadow: isLightCard ? '0 0 60px rgba(180,140,0,0.1), 0 8px 30px rgba(0,0,0,0.12)' : '0 0 60px rgba(255,180,0,0.06), 0 8px 30px rgba(0,0,0,0.4)',
                            color: isLightCard ? '#2D2005' : '#F8FAFC',
                        }}>
                            {/* Subtle diagonal lines overlay */}
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,200,0,0.015) 30px, rgba(255,200,0,0.015) 31px)', pointerEvents: 'none' }} />
                            <div style={{ position: 'relative' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.01em' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #B8860B, #FFD700)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,215,0,0.3)' }}>
                                            <Swords size={20} color="white" />
                                        </div>
                                        Beat Battle History
                                    </h3>
                                    <span style={{ fontSize: '12px', color: isLightCard ? 'rgba(140,100,0,0.9)' : 'rgba(255,215,0,0.6)', fontWeight: 600, letterSpacing: '0.05em' }}>
                                        {battleEntries.filter((e: any) => e.isWinner).length > 0
                                            ? `${battleEntries.filter((e: any) => e.isWinner).length} WIN${battleEntries.filter((e: any) => e.isWinner).length > 1 ? 'S' : ''} · ${battleEntries.length} BATTLES`
                                            : `${battleEntries.length} BATTLE${battleEntries.length > 1 ? 'S' : ''}`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {battleEntries.map((entry: any) => (
                                        <div key={entry.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: entry.isWinner ? '14px 16px' : '12px 14px',
                                            backgroundColor: entry.isWinner ? 'rgba(255,215,0,0.09)' : (isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.25)'),
                                            borderRadius: '10px',
                                            border: entry.isWinner ? '1px solid rgba(255,215,0,0.35)' : `1px solid ${isLightCard ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)'}`,
                                            boxShadow: entry.isWinner ? '0 0 20px rgba(255,215,0,0.1), inset 0 1px 0 rgba(255,215,0,0.1)' : 'none',
                                            flexWrap: 'wrap', gap: '8px',
                                            transition: 'border-color 0.2s',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                {/* Rank icon */}
                                                {entry.isWinner ? (
                                                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'linear-gradient(135deg, #B8860B, #FFD700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(255,215,0,0.4)' }}>
                                                        <Trophy size={18} color="white" fill="white" />
                                                    </div>
                                                ) : entry.avatarUrl ? (
                                                    <img src={entry.avatarUrl} alt="" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, opacity: 0.85 }} />
                                                ) : (
                                                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: isLightCard ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <Swords size={16} color={isLightCard ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'} />
                                                    </div>
                                                )}
                                                <div style={{ minWidth: 0 }}>
                                                    <Link to={entry.trackRoute || `/battles/entry/${entry.id}`} style={{ margin: 0, fontWeight: 700, color: entry.isWinner ? '#FFD700' : (isLightCard ? '#2D2005' : colors.textPrimary), fontSize: '13px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.trackTitle}</Link>
                                                    <Link to={`/battles/${entry.battle.slug || entry.battle.id}`} style={{ margin: '2px 0 0', color: entry.isWinner ? (isLightCard ? 'rgba(140,100,0,0.8)' : 'rgba(255,215,0,0.55)') : (isLightCard ? '#5A4A00' : colors.textSecondary), fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                        <ExternalLink size={9} />{entry.battle.title}
                                                    </Link>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                                {entry.isWinner && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 9px', borderRadius: '999px', backgroundColor: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)' }}>
                                                        <Trophy size={11} fill="#FFD700" /> Winner
                                                    </span>
                                                )}
                                                {!entry.isWinner && entry.battle.status === 'completed' && (
                                                    <span style={{ fontSize: '11px', color: isLightCard ? '#5A4A00' : colors.textSecondary, fontWeight: 600 }}>#{entry.placement}/{entry.totalEntries}</span>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: entry.voteCount > 0 ? '#FF8C00' : (isLightCard ? '#8A7A60' : colors.textTertiary), fontSize: '13px' }}>
                                                    <Flame size={14} color={entry.voteCount > 0 ? '#FF8C00' : (isLightCard ? '#8A7A60' : colors.textTertiary)} fill={entry.voteCount > 0 ? '#FF8C00' : 'none'} />
                                                    <span>{entry.voteCount}</span>
                                                </div>
                                                <button
                                                    onClick={() => { if (player.currentTrack?.id === `battle-${entry.id}`) { togglePlay(); return; } setTrack({ id: `battle-${entry.id}`, title: entry.trackTitle, artist: profile.username, cover: entry.avatarUrl || entry.coverUrl || '', url: `${entry.audioUrl}`, entryRoute: entry.trackRoute || `/battles/entry/${entry.id}` }); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '999px', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)'}`, backgroundColor: isLightCard ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)', color: player.currentTrack?.id === `battle-${entry.id}` && player.isPlaying ? accent : (isLightCard ? '#5A4A00' : colors.textSecondary), cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.color = accent; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = isLightCard ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = isLightCard ? '#5A4A00' : colors.textSecondary; }}
                                                >
                                                    {player.currentTrack?.id === `battle-${entry.id}` && player.isPlaying ? <><Pause size={12} fill="currentColor" /> Pause</> : <><Play size={12} fill="currentColor" /> Play</>}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Comments */}
                        <div style={{ backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${cardBorder}`, padding: isMobile ? '20px' : '28px', color: cardText, boxShadow: cardShadow }}>
                            <CommentSection profileId={profile.id} ownerId={profile.userId} />
                        </div>
                    </div>

                    {/* RIGHT: Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* About Card */}
                        {(profile.bio || socials.some(s => !!(profile as any)[s.key])) && (
                        <div style={{ backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${cardBorder}`, padding: '24px', color: cardText, boxShadow: cardShadow }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: cardTextSec }}>About</h4>
                            {profile.bio && <p style={{ fontSize: '13px', color: cardTextSec, margin: '0 0 16px', lineHeight: 1.6 }}>{profile.bio}</p>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {socials.map(s => {
                                    const url = (profile as any)[s.key];
                                    if (!url) return null;
                                    const inner = (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', backgroundColor: cardInner, border: `1px solid ${cardBorder}` }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {React.cloneElement(s.icon as React.ReactElement, { color: s.color, size: 14 })}
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 500, color: cardText, flex: 1 }}>{s.label}</span>
                                            {!s.isHandle && <ExternalLink size={12} color={cardTextSec} />}
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
                        <div style={{ backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${cardBorder}`, padding: '24px', color: cardText, boxShadow: cardShadow }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: cardTextSec, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Hammer size={16} color="#7A8C37" /> Gear & Tools
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {gear.map((item: any, i: number) => (
                                    <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: cardInner, border: `1px solid ${cardBorder}` }}>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: '#7A8C37', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{item.category || 'Other'}</p>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: cardText, margin: '3px 0 0' }}>{item.name || item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                        {/* Quick Stats Card */}
                        <div style={{ backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${cardBorder}`, padding: '24px', color: cardText, boxShadow: cardShadow }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: cardTextSec }}>Stats</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {stats.map(s => (
                                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: cardTextSec }}>{s.label}</span>
                                        <span style={{ fontSize: '16px', fontWeight: 700, color: cardText }}>{s.value}</span>
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
                        position: 'fixed',
                        bottom: isMobile
                            ? (player.currentTrack ? '176px' : '76px')
                            : (player.currentTrack ? '104px' : '24px'),
                        right: '24px', 
                        backgroundColor: '#111827',
                        color: accent,
                        border: `2px solid ${accent}`,
                        padding: isMobile ? '10px 16px' : '12px 24px', 
                        borderRadius: '999px',
                        boxShadow: `0 0 0 4px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.5)`,
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', zIndex: 200,
                        transition: 'bottom 0.3s',
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <Edit3 size={16} /> {isMobile ? 'Edit' : 'Edit My Profile'}
                </button>
            )}

            <div style={{ height: player.currentTrack ? '100px' : '20px' }} />
        </div>
    );
};
