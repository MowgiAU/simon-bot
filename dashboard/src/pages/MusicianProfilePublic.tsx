import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
    Swords, Trophy, Flame, UserPlus, UserCheck, Repeat2, Heart, Share2, ListMusic, Clock, Star,
    GripVertical, ChevronUp, ChevronDown, Disc, EyeOff, Users, Crown, Medal, TrendingUp
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
    location?: string | null;
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
    cardBgColor?: string | null;
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
    showH2HRank?: boolean;
    h2hRating?: { elo: number; wins: number; losses: number; matchesPlayed: number } | null;
    featuredFriendIds?: string[];
    headerLayout?: string;
    trackDisplayStyle?: string;
    showGearSection?: boolean;
    showSocialLinks?: boolean;
    showStatsBar?: boolean;
    showFeaturedFriends?: boolean;
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
        _battleEntry?: { battleId: string; battleTitle: string | null; battleSlug: string | null } | null;
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
    const [followingCount, setFollowingCount] = useState(0);
    const [followerProfiles, setFollowerProfiles] = useState<{ userId: string; discordId: string | null; username: string; displayName: string | null; avatar: string | null }[]>([]);
    const [startingChat, setStartingChat] = useState(false);
    const [discographyFilter, setDiscographyFilter] = useState<'all' | 'tracks' | 'reposts' | 'collabs'>('all');
    const [favourites, setFavourites] = useState<Record<string, boolean>>({});
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    // Battle submissions
    const [battleEntries, setBattleEntries] = useState<any[]>([]);

    // Friends (mutual follows)
    const [friends, setFriends] = useState<{ profileId: string; userId: string; username: string; displayName: string | null; avatar: string | null; discordId: string | null }[]>([]);
    const [featuredFriendIds, setFeaturedFriendIds] = useState<string[]>([]);

    // Profile playlists (sidebar)
    const [profilePlaylists, setProfilePlaylists] = useState<any[]>([]);
    const [reorderingPlaylists, setReorderingPlaylists] = useState(false);

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
        try {
            const { data } = await axios.post(`/api/tracks/${trackId}/repost`, {}, { withCredentials: true });
            setReposts(prev => ({ ...prev, [trackId]: data.reposted }));
            // Remove the track from the visible reposts list immediately when un-reposted
            if (!data.reposted) {
                setProfile(prev => prev ? {
                    ...prev,
                    reposts: (prev.reposts || []).filter(t => t.id !== trackId),
                } : prev);
            }
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
        let _rt: ReturnType<typeof setTimeout>;
        const handleResize = () => { clearTimeout(_rt); _rt = setTimeout(() => setIsMobile(window.innerWidth < 1024), 150); };
        window.addEventListener('resize', handleResize);
        return () => { clearTimeout(_rt); window.removeEventListener('resize', handleResize); };
    }, []);

    useEffect(() => {
        if (document.getElementById('marquee-release-style')) return;
        const style = document.createElement('style');
        style.id = 'marquee-release-style';
        style.textContent = '@keyframes marquee-release { from { transform: translateX(0); } to { transform: translateX(-50%); } }';
        document.head.appendChild(style);
    }, []);

    // Inject animation keyframes for enhanced profile styles (keep in sync with ProfileStyles.tsx ANIM_CSS)
    useEffect(() => {
        if (document.getElementById('ps-anim-css')) return;
        const el = document.createElement('style');
        el.id = 'ps-anim-css';
        el.textContent = `
@keyframes ps-shimmer-move { 0% { left: -70%; } 100% { left: 120%; } }
@keyframes ps-pulse        { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes ps-rainbow      { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
@keyframes ps-float        { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
@keyframes ps-glow-pulse   { 0%, 100% { filter: brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0)); } 50% { filter: brightness(1.3) drop-shadow(0 0 10px rgba(255,255,255,0.6)); } }
@keyframes ps-neon-flash   { 0%, 18%, 20%, 50%, 52%, 100% { filter: brightness(1) drop-shadow(0 0 5px rgba(255,255,255,0.8)); } 19%, 51% { filter: brightness(0.75) drop-shadow(0 0 1px rgba(255,255,255,0.15)); } }
@keyframes ps-glitch       { 0%, 85%, 100% { transform: translate(0); filter: none; } 86% { transform: translate(-4px, 1px) skewX(-2deg); filter: brightness(1.4); } 87% { transform: translate(4px, -1px) skewX(2deg); } 89% { transform: translate(-2px, 1px); filter: brightness(1); } 90% { transform: translate(0); } }
.ps-anim-shimmer { position: relative !important; overflow: hidden !important; display: inline-block !important; }
.ps-anim-shimmer::after { content: ''; position: absolute; top: -20%; left: -70%; width: 45%; height: 140%; background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%); animation: ps-shimmer-move 2.2s ease-in-out infinite; pointer-events: none; }
.ps-anim-pulse      { animation: ps-pulse 2s ease-in-out infinite !important; }
.ps-anim-rainbow    { animation: ps-rainbow 4s linear infinite !important; }
.ps-anim-float      { animation: ps-float 3s ease-in-out infinite !important; display: inline-block !important; }
.ps-anim-glow-pulse { animation: ps-glow-pulse 2.5s ease-in-out infinite !important; display: inline-block !important; }
.ps-anim-neon       { animation: ps-neon-flash 4s linear infinite !important; display: inline-block !important; }
.ps-anim-glitch     { animation: ps-glitch 5s linear infinite !important; display: inline-block !important; }
`;
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
            const allTrackIds = [...(data.tracks || []).map((t: any) => t.id), ...(data.reposts || []).map((t: any) => t.id), ...(data.collaborations || []).map((t: any) => t.id)];
            // Fixed-index supplementary fetches — never use .push() here as it
            // shifts indices and breaks destructuring.
            const supplementary: Promise<any>[] = [
                axios.get(`/api/artists/${data.id}/follower-count`).catch(() => null),          // 0
                axios.get(`/api/artists/${data.id}/follow`, { withCredentials: true }).catch(() => null), // 1
                axios.get(`/api/beat-battle/user/${data.userId}/entries`).catch(() => null),   // 2
                allTrackIds.length > 0
                    ? axios.post('/api/tracks/favourites/check', { trackIds: allTrackIds }, { withCredentials: true }).catch(() => null)
                    : Promise.resolve(null),                                                    // 3
                allTrackIds.length > 0
                    ? axios.post('/api/tracks/reposts/check', { trackIds: allTrackIds }, { withCredentials: true }).catch(() => null)
                    : Promise.resolve(null),                                                    // 4
                axios.get(`/api/artists/${data.id}/friends`).catch(() => null),                // 5
            ];
            const [countRes, followRes, entriesRes, favRes, repRes, friendsRes] = await Promise.all(supplementary);
            if (countRes?.data) setFollowerCount(countRes.data.count);
            if (followRes?.data) setIsFollowing(followRes.data.following);
            if (entriesRes?.data) setBattleEntries(entriesRes.data);
            if (favRes?.data) setFavourites(favRes.data);
            if (repRes?.data) setReposts(repRes.data);
            if (friendsRes?.data) {
                setFriends(friendsRes.data.friends || []);
                setFeaturedFriendIds(friendsRes.data.featuredFriendIds || []);
            }

            // Fetch followers + following count independently so index drift can never affect them.
            axios.get(`/api/artists/${data.id}/followers?limit=12`).then(r => {
                if (Array.isArray(r.data)) setFollowerProfiles(r.data);
            }).catch(() => {});
            axios.get(`/api/artists/${data.id}/following-count`).then(r => {
                if (r.data?.count != null) setFollowingCount(r.data.count);
            }).catch(() => {});
            if (data.playlists) setProfilePlaylists(data.playlists);
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
    const H2H_TIERS = [
        { name: 'UNRANKED', min: 0,    color: '#7A8190', icon: <Medal size={13} /> },
        { name: 'BRONZE',   min: 1200, color: '#CD7F32', icon: <Medal size={13} /> },
        { name: 'SILVER',   min: 1300, color: '#C0C0C0', icon: <Medal size={13} /> },
        { name: 'GOLD',     min: 1450, color: '#FFD700', icon: <Trophy size={13} /> },
        { name: 'PLATINUM', min: 1600, color: '#E5E4E2', icon: <Trophy size={13} /> },
        { name: 'DIAMOND',  min: 1750, color: '#5DD4FF', icon: <Crown size={13} /> },
        { name: 'MASTER',   min: 1900, color: '#A855F7', icon: <Crown size={13} /> },
        { name: 'LEGEND',   min: 2100, color: '#FF3D7F', icon: <Flame size={13} /> },
    ];
    const h2hTier = (elo: number) => [...H2H_TIERS].reverse().find(t => elo >= t.min) || H2H_TIERS[0];

    const stats = [
        { label: 'Following', value: (followingCount || 0).toLocaleString() },
        { label: 'Total Streams', value: (profile.totalPlays || 0).toLocaleString() },
        { label: 'Releases', value: ((profile as any)._count?.tracks ?? profile.tracks?.length ?? 0).toLocaleString() },
    ];

    const socials = [
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/>, color: '#ff5500', isHandle: false },
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/>, color: '#1DB954', isHandle: false },
        { key: 'youtubeUrl', label: 'YouTube', icon: <Youtube size={16}/>, color: '#FF0000', isHandle: false },
        { key: 'instagramUrl', label: 'Instagram', icon: <Instagram size={16}/>, color: '#E1306C', isHandle: false },
    ];

    const featuredTrack = profile.featuredTrack ? { ...profile.featuredTrack, username: profile.username, artist: profile.displayName || profile.username, profile: { displayName: profile.displayName, username: profile.username } } : null;
    const featuredPlaylist = profile.featuredPlaylist || null;
    const featuredPlaylistTracks = featuredPlaylist?.tracks?.map(pt => ({ ...pt.track, username: pt.track.profile?.username || profile.username, artist: pt.track.profile?.displayName || pt.track.profile?.username || profile.displayName || profile.username, profile: pt.track.profile || { displayName: profile.displayName, username: profile.username } })) || [];
    
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
            {profile.headerLayout === 'minimal' ? (
                /* ── MINIMAL: slim header bar, no banner ── */
                <div style={{ borderBottom: `1px solid ${isLightCard ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`, backgroundColor: pageBg }}>
                    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '12px 16px' : '16px 24px' }}>
                        {/* Single row — avatar + name + buttons, never wraps */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            {/* Avatar */}
                            <div style={{
                                width: isMobile ? '44px' : '56px', height: isMobile ? '44px' : '56px',
                                borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                                border: profileStyle?.glowColor ? `2px solid ${profileStyle.glowColor}88` : `2px solid ${accent}44`,
                                boxShadow: profileStyle?.glowColor ? `0 0 ${profileStyle.glowIntensity * 3}px ${profileStyle.glowColor}77` : 'none',
                            }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={profile.displayName || profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', backgroundColor: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800 }}>
                                        {profile.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* Name + genre chip (truncates if needed) */}
                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                                    <span
                                        className={profileStyle?.animation && profileStyle.animation !== 'none' ? `ps-anim-${profileStyle.animation}` : undefined}
                                        style={{
                                            fontSize: isMobile ? '15px' : '18px', fontWeight: 800, letterSpacing: '-0.02em',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            ...(profileStyle?.gradient ? { background: profileStyle.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : { color: isLightCard ? '#0F172A' : '#F8FAFC' }),
                                        }}>
                                        {profile.displayName || profile.username}
                                    </span>
                                    {profileStyle?.badgeLabel && !isMobile && (
                                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: `${profileStyle.badgeColor || '#FFD700'}22`, border: `1px solid ${profileStyle.badgeColor || '#FFD700'}55`, color: profileStyle.badgeColor || '#FFD700', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {profileStyle.badgeLabel}
                                        </span>
                                    )}
                                    {profile.primaryGenre && !isMobile && (
                                        <span onClick={() => navigate(`/category/${profile.primaryGenre!.slug}`)} style={{ backgroundColor: `${accent}18`, border: `1px solid ${accent}44`, color: accent, padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {profile.primaryGenre.name}
                                        </span>
                                    )}
                                    {profile.showStatsBar !== false && !isMobile && stats.map((s, i) => (
                                        <span key={i} style={{ fontSize: '11px', color: isLightCard ? '#4A5568' : '#B9C3CE', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            <strong style={{ color: isLightCard ? '#1A202C' : 'white', fontWeight: 700 }}>{s.value}</strong> {s.label}
                                        </span>
                                    ))}
                                </div>
                                {profile.location && !isMobile && (
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: isLightCard ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {profile.location}
                                    </p>
                                )}
                            </div>

                            {/* Action buttons — on mobile: primary action + share only */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                {!isOwnProfile && (
                                    <button onClick={toggleFollow} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 12px' : '6px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', border: isFollowing ? `1px solid ${accent}4D` : 'none', backgroundColor: isFollowing ? 'transparent' : accent, color: isFollowing ? accent : 'white', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                                        {isFollowing ? <><UserCheck size={13} /></> : <><UserPlus size={13} />{!isMobile && ' Follow'}</>}
                                    </button>
                                )}
                                {!isOwnProfile && user && !isMobile && (
                                    <button onClick={startMessage} disabled={startingChat} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: startingChat ? 'default' : 'pointer', border: `1px solid ${accent}4D`, backgroundColor: `${accent}1A`, color: accent, opacity: startingChat ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                        <MessageCircle size={12} /> {startingChat ? 'Opening…' : 'Message'}
                                    </button>
                                )}
                                {(isOwnProfile || isAdmin) && (
                                    <button onClick={() => isOwnProfile ? (onEdit ? onEdit() : navigate('/profile/edit')) : navigate(`/profile/edit?adminTarget=${profile.userId}`)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 12px' : '6px 14px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.5)' : `${accent}4D`}`, backgroundColor: isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.1)' : `${accent}1A`, color: isAdmin && !isOwnProfile ? '#ff9800' : accent, whiteSpace: 'nowrap' }}>
                                        <Edit3 size={12} />{!isMobile && (isAdmin && !isOwnProfile ? ' Edit (Admin)' : ' Edit')}
                                    </button>
                                )}
                                {isOwnProfile && !isMobile && (
                                    <button onClick={() => navigate('/my-tracks')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${accent}4D`, backgroundColor: `${accent}1A`, color: accent, whiteSpace: 'nowrap' }}>
                                        <ListMusic size={12} /> Tracks
                                    </button>
                                )}
                                <button onClick={handleCopyProfileLink} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 12px' : '6px 14px', borderRadius: '999px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'}`, backgroundColor: copied ? 'rgba(76,175,80,0.15)' : (isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'), color: copied ? '#4caf50' : (isLightCard ? '#4A5568' : '#B9C3CE'), whiteSpace: 'nowrap' }}>
                                    {copied ? <Check size={12} /> : <Copy size={12} />}{!isMobile && (copied ? ' Copied!' : ' Share')}
                                </button>
                                {/* Social icons — desktop only; on mobile they appear in the About card */}
                                {!isMobile && profile.showSocialLinks !== false && socials.map(s => {
                                    const url = (profile as any)[s.key];
                                    if (!url) return null;
                                    const inner = (
                                        <div style={{ width: '30px', height: '30px', borderRadius: '999px', backgroundColor: isLightCard ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isLightCard ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            {React.cloneElement(s.icon as React.ReactElement, { size: 13, color: s.color })}
                                        </div>
                                    );
                                    return s.isHandle ? <div key={s.key} title={`${s.label}: ${url}`}>{inner}</div> : <a key={s.key} href={url} target="_blank" rel="noopener noreferrer" title={s.label}>{inner}</a>;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
            <div style={{ position: 'relative', minHeight: isMobile ? '240px' : '380px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
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
                    <div style={{ display: 'flex', flexDirection: (isMobile || profile.headerLayout === 'centered') ? 'column' : 'row', alignItems: (isMobile || profile.headerLayout === 'centered') ? 'center' : 'flex-end', gap: isMobile ? '20px' : '32px', textAlign: profile.headerLayout === 'centered' ? 'center' : undefined }}>
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
                        <div style={{ flex: 1, textAlign: (isMobile || profile.headerLayout === 'centered') ? 'center' : 'left', minWidth: 0 }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>Artist Profile</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: (isMobile || profile.headerLayout === 'centered') ? 'center' : 'flex-start', marginBottom: '8px' }}>
                                <h1 style={{ fontSize: isMobile ? '32px' : '52px', fontWeight: 900, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.05, wordWrap: 'break-word' }}>
                                    <span
                                        className={profileStyle?.animation && profileStyle.animation !== 'none' ? `ps-anim-${profileStyle.animation}` : undefined}
                                        style={profileStyle?.gradient
                                            ? { background: profileStyle.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                                            : undefined
                                        }>
                                        {profile.displayName || profile.username}
                                    </span>
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: (isMobile || profile.headerLayout === 'centered') ? 'center' : 'flex-start', marginBottom: '16px' }}>
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
                                {profile.showStatsBar !== false && <>
                                    <span style={{ color: isLightCard ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)', fontSize: '10px' }}>|</span>
                                    {stats.map((s, i) => (
                                        <span key={i} style={{ fontSize: '12px', color: isLightCard ? '#4A5568' : '#B9C3CE' }}>
                                            <strong style={{ color: isLightCard ? '#1A202C' : 'white', fontWeight: 700 }}>{s.value}</strong> {s.label}
                                        </span>
                                    ))}
                                </>}
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
                                {profile.showSocialLinks !== false && socials.map(s => {
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
            )}

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
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: isLightCard ? 'rgba(0,0,0,0.05)' : '#1A1E2E', borderRadius: '8px', padding: '3px', flexWrap: 'wrap' }}>
                                    {(['all', 'tracks', 'reposts', 'collabs'] as const).filter(tab => tab !== 'collabs' || (profile as any).collaborations?.length > 0).map(tab => (
                                        <button key={tab} onClick={() => setDiscographyFilter(tab)} style={{
                                            padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                            backgroundColor: discographyFilter === tab ? accent : 'transparent',
                                            color: discographyFilter === tab ? 'white' : cardTextSec,
                                        }}>
                                            {tab === 'all' ? `All (${(profile.tracks?.length || 0) + (profile.reposts?.length || 0) + ((profile as any).collaborations?.length || 0)})` :
                                             tab === 'tracks' ? `Tracks (${profile.tracks?.length || 0})` :
                                             tab === 'reposts' ? `Reposts (${profile.reposts?.length || 0})` :
                                             `Collabs (${(profile as any).collaborations?.length || 0})`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(() => {
                                const ownTracks = (profile.tracks || []).map(t => ({ ...t, username: profile.username, _repost: false as const, _repostedAt: null as string | null, _originalArtist: null as any }));
                                const repostedTracks = (profile.reposts || []).map(t => ({ ...t, username: t._originalArtist?.username || profile.username, _repost: true as const }));
                                const collabTracks = ((profile as any).collaborations || []).map((t: any) => ({ ...t, username: t._originalArtist?.username || profile.username }));
                                let filtered = discographyFilter === 'tracks' ? ownTracks
                                             : discographyFilter === 'reposts' ? repostedTracks
                                             : discographyFilter === 'collabs' ? collabTracks
                                             : [...ownTracks, ...repostedTracks, ...collabTracks];
                                filtered.sort((a: any, b: any) => {
                                    const dateA = a._repostedAt || a.createdAt || '';
                                    const dateB = b._repostedAt || b.createdAt || '';
                                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                                });

                                if (filtered.length === 0) return (
                                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${cardBorder}` }}>
                                        <Music size={40} color={cardTextSec} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                        <p style={{ color: cardTextSec, fontSize: '13px', margin: 0 }}>
                                            {discographyFilter === 'reposts' ? 'No reposts yet.' : discographyFilter === 'tracks' ? 'No tracks uploaded yet.' : discographyFilter === 'collabs' ? 'No collaborations yet.' : 'No tracks uploaded yet.'}
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

                                const trackDisplayStyle = profile.trackDisplayStyle || 'list';

                                // ── Cards grid view ──
                                if (trackDisplayStyle === 'cards') return (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '12px' }}>
                                        {filtered.map((track: any) => {
                                            const isCurrentTrack = player.currentTrack?.id === track.id;
                                            const isPlaying = isCurrentTrack && player.isPlaying;
                                            return (
                                                <div key={track.id + (track._repost ? '-r' : '')}
                                                    onClick={() => isCurrentTrack ? togglePlay() : setTrack(track, filtered)}
                                                    style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid ${cardBorder}`, backgroundColor: cardBg, cursor: 'pointer', position: 'relative', aspectRatio: '1/1' }}>
                                                    {track.coverUrl
                                                        ? <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', backgroundColor: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={32} color={accent} /></div>
                                                    }
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '10px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)' }}>{track._repost ? '↺ Repost' : track.playCount >= 1000 ? `${(track.playCount/1000).toFixed(1)}K plays` : `${track.playCount} plays`}</span>
                                                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: isPlaying ? accent : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                {isPlaying ? <Pause size={12} fill={isLightCard ? '#1a1a1a' : '#fff'} color={isLightCard ? '#1a1a1a' : '#fff'} /> : <Play size={12} fill="#1a1a1a" color="#1a1a1a" style={{ marginLeft: '1px' }} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );

                                // ── Compact list view ──
                                if (trackDisplayStyle === 'compact') return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${cardBorder}`, overflow: 'hidden' }}>
                                        {filtered.map((track: any, idx: number) => {
                                            const isCurrentTrack = player.currentTrack?.id === track.id;
                                            const isPlaying = isCurrentTrack && player.isPlaying;
                                            const dur = track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '';
                                            return (
                                                <div key={track.id + (track._repost ? '-r' : '')}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderTop: idx > 0 ? `1px solid ${cardBorder}` : 'none', backgroundColor: isCurrentTrack ? `${accent}12` : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
                                                    onClick={() => isCurrentTrack ? togglePlay() : setTrack(track, filtered)}
                                                    onMouseEnter={e => { if (!isCurrentTrack) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                                                    onMouseLeave={e => { if (!isCurrentTrack) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: isCurrentTrack ? accent : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {isPlaying ? <Pause size={10} fill="white" color="white" /> : <Play size={10} fill={isCurrentTrack ? 'white' : cardTextTer} color={isCurrentTrack ? 'white' : cardTextTer} style={{ marginLeft: '1px' }} />}
                                                    </div>
                                                    {track.coverUrl && <img src={track.coverUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: isCurrentTrack ? accent : cardText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                                                        {track._repost && <div style={{ fontSize: '10px', color: '#DAA520' }}>↺ Repost</div>}
                                                    </div>
                                                    {dur && <span style={{ fontSize: '11px', color: cardTextTer, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dur}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );

                                // ── Default: full list ──
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {filtered.map((track: any) => {
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

                                                    {/* Battle submission banner */}
                                                    {!track._repost && track._battleEntry && (
                                                        <div style={{
                                                            padding: '7px 16px', fontSize: '12px',
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            borderBottom: `1px solid rgba(99,102,241,0.15)`,
                                                            backgroundColor: 'rgba(99,102,241,0.08)',
                                                            color: '#818CF8',
                                                        }}>
                                                            <Swords size={12} />
                                                            <span>Battle Submission</span>
                                                            {track._battleEntry.battleTitle && (
                                                                <>
                                                                    <span style={{ opacity: 0.5 }}>·</span>
                                                                    <a
                                                                        href={`/battles/${track._battleEntry.battleSlug || track._battleEntry.battleId}`}
                                                                        style={{ color: '#818CF8', textDecoration: 'none', fontWeight: 600 }}
                                                                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                                                    >
                                                                        {track._battleEntry.battleTitle}
                                                                    </a>
                                                                </>
                                                            )}
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
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', minWidth: 0 }}>
                                                                <Link to={`/track/${trackArtistUsername}/${track.slug || track.id}`}
                                                                    style={{ color: cardText, textDecoration: 'none', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}
                                                                    onMouseEnter={e => e.currentTarget.style.color = accent}
                                                                    onMouseLeave={e => e.currentTarget.style.color = cardText}>
                                                                    {track.title}
                                                                </Link>
                                                                {isOwnProfile && !track.isPublic && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                                        <EyeOff size={9} /> Private
                                                                    </span>
                                                                )}
                                                            </div>

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
                                                {/* Track thumbnail (cover → avatar fallback). Winner gets a gold ring + 🥇 badge. */}
                                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                                    {entry.coverUrl ? (
                                                        <img
                                                            src={entry.coverUrl.startsWith('http') ? entry.coverUrl : entry.coverUrl}
                                                            alt=""
                                                            style={{
                                                                width: '44px', height: '44px', borderRadius: '8px',
                                                                objectFit: 'cover',
                                                                border: entry.isWinner ? '2px solid #FFD700' : `1px solid ${isLightCard ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'}`,
                                                                boxShadow: entry.isWinner ? '0 0 14px rgba(255,215,0,0.4)' : 'none',
                                                            }}
                                                        />
                                                    ) : entry.avatarUrl ? (
                                                        <img
                                                            src={entry.avatarUrl}
                                                            alt=""
                                                            style={{
                                                                width: '44px', height: '44px', borderRadius: '8px',
                                                                objectFit: 'cover', opacity: 0.85,
                                                                border: entry.isWinner ? '2px solid #FFD700' : `1px solid ${isLightCard ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'}`,
                                                                boxShadow: entry.isWinner ? '0 0 14px rgba(255,215,0,0.4)' : 'none',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '44px', height: '44px', borderRadius: '8px',
                                                            backgroundColor: isLightCard ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: entry.isWinner ? '2px solid #FFD700' : `1px solid ${isLightCard ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'}`,
                                                            boxShadow: entry.isWinner ? '0 0 14px rgba(255,215,0,0.4)' : 'none',
                                                        }}>
                                                            <Swords size={16} color={isLightCard ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'} />
                                                        </div>
                                                    )}
                                                    {entry.isWinner && (
                                                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '14px', lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>🥇</div>
                                                    )}
                                                </div>
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
                                                {entry.battle.status === 'completed' && (
                                                    <div title={`${entry.firstPlaceVotes ?? 0} × 1st · ${entry.secondPlaceVotes ?? 0} × 2nd · ${entry.thirdPlaceVotes ?? 0} × 3rd`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: (entry.points ?? 0) > 0 ? '#FF8C00' : (isLightCard ? '#8A7A60' : colors.textTertiary), fontSize: '13px' }}>
                                                        <Flame size={14} color={(entry.points ?? 0) > 0 ? '#FF8C00' : (isLightCard ? '#8A7A60' : colors.textTertiary)} fill={(entry.points ?? 0) > 0 ? '#FF8C00' : 'none'} />
                                                        <span>{entry.points ?? 0} pts</span>
                                                    </div>
                                                )}
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

                        {/* ── About Card ── */}
                        {(profile.bio || (profile.showSocialLinks !== false && socials.some(s => !!(profile as any)[s.key]))) && (
                        <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${cardBorder}`, overflow: 'hidden', boxShadow: cardShadow }}>
                            <div style={{ borderLeft: `3px solid ${accent}`, padding: '20px 20px 20px 17px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Star size={13} color={accent} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cardTextSec }}>About</span>
                                </div>
                                {profile.bio && (
                                    <p style={{ fontSize: '13px', color: cardTextSec, margin: '0 0 16px', lineHeight: 1.65 }}>{profile.bio}</p>
                                )}
                                {profile.showSocialLinks !== false && socials.some(s => !!(profile as any)[s.key]) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {socials.map(s => {
                                            const url = (profile as any)[s.key];
                                            if (!url) return null;
                                            const inner = (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', backgroundColor: cardInner, border: `1px solid ${cardBorder}`, transition: 'opacity 0.15s' }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                                                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {React.cloneElement(s.icon as React.ReactElement, { color: s.color, size: 13 })}
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: cardText, flex: 1 }}>{s.label}</span>
                                                    {!s.isHandle && <ExternalLink size={11} color={cardTextTer} />}
                                                    {s.isHandle && <span style={{ fontSize: '10px', color: cardTextTer }}>{url}</span>}
                                                </div>
                                            );
                                            return s.isHandle ? <div key={s.key}>{inner}</div> : <a key={s.key} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>;
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {/* ── Playlists & Releases Card ── */}
                        {profilePlaylists.length > 0 && (() => {
                            const isOwner = user?.id === profile.userId;
                            const movePlaylist = async (from: number, to: number) => {
                                const next = [...profilePlaylists];
                                const [item] = next.splice(from, 1);
                                next.splice(to, 0, item);
                                setProfilePlaylists(next);
                                try {
                                    await axios.put('/api/playlists/profile-positions', { playlistIds: next.map((p: any) => p.id) }, { withCredentials: true });
                                } catch { /* non-fatal */ }
                            };
                            return (
                                <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${cardBorder}`, overflow: 'hidden', boxShadow: cardShadow }}>
                                    <div style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <ListMusic size={13} color={accent} />
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cardTextSec }}>Playlists & Releases</span>
                                            </div>
                                            {isOwner && (
                                                <button onClick={() => setReorderingPlaylists(r => !r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: reorderingPlaylists ? accent : cardTextSec, fontSize: '11px', fontWeight: 600, padding: '2px 6px', flexShrink: 0 }}>
                                                    {reorderingPlaylists ? 'Done' : 'Reorder'}
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {profilePlaylists.map((pl: any, i: number) => (
                                                <div key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    {reorderingPlaylists && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                                                            <button disabled={i === 0} onClick={() => movePlaylist(i, i - 1)} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'transparent' : cardTextSec, padding: 0 }}><ChevronUp size={12} /></button>
                                                            <button disabled={i === profilePlaylists.length - 1} onClick={() => movePlaylist(i, i + 1)} style={{ background: 'none', border: 'none', cursor: i === profilePlaylists.length - 1 ? 'default' : 'pointer', color: i === profilePlaylists.length - 1 ? 'transparent' : cardTextSec, padding: 0 }}><ChevronDown size={12} /></button>
                                                        </div>
                                                    )}
                                                    <a href={`/playlists/${pl.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '8px 10px', borderRadius: '10px', backgroundColor: cardInner, border: `1px solid ${cardBorder}`, transition: 'opacity 0.15s', overflow: 'hidden' }}
                                                        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'}
                                                        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}>
                                                        {pl.coverUrl
                                                            ? <img src={pl.coverUrl} alt="" style={{ width: 34, height: 34, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                                                            : <div style={{ width: 34, height: 34, borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                {pl.releaseType ? <Disc size={15} color={accent} /> : <ListMusic size={15} color={cardTextSec} />}
                                                              </div>
                                                        }
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '12px', fontWeight: 600, color: cardText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
                                                            <div style={{ fontSize: '10px', color: cardTextSec, marginTop: '1px' }}>
                                                                {pl.releaseType ? <span style={{ color: accent, fontWeight: 700, textTransform: 'capitalize' }}>{pl.releaseType}</span> : 'Playlist'}
                                                                {' · '}{pl.trackCount} track{pl.trackCount !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Top 8 / Friends Card (replaces Followers card) ── */}
                        {profile.showFeaturedFriends !== false && (() => {
                            const orderedFeatured = featuredFriendIds.length > 0
                                ? featuredFriendIds.map(id => friends.find(f => f.userId === id || f.profileId === id)).filter(Boolean) as typeof friends
                                : friends.slice(0, 8);
                            if (orderedFeatured.length === 0 && followerCount === 0) return null;
                            return (
                                <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${cardBorder}`, overflow: 'hidden', boxShadow: cardShadow }}>
                                    <div style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Users size={13} color={accent} />
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cardTextSec }}>Top 8</span>
                                            </div>
                                            {followerCount > 0 && (
                                                <span style={{ fontSize: '11px', color: cardTextTer }}>
                                                    <span style={{ fontWeight: 700, color: cardTextSec }}>{followerCount.toLocaleString()}</span> followers
                                                </span>
                                            )}
                                        </div>
                                        {orderedFeatured.length > 0 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                {orderedFeatured.slice(0, 8).map(f => {
                                                    const avatarSrc = f.avatar
                                                        ? (f.avatar.startsWith('http') || f.avatar.includes('/') ? f.avatar : `https://cdn.discordapp.com/avatars/${f.discordId || f.userId}/${f.avatar}.png?size=64`)
                                                        : null;
                                                    return (
                                                        <a key={f.profileId} href={`/profile/${f.username}`} title={f.displayName || f.username} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                                            <div style={{ width: '52px', height: '52px', borderRadius: '13px', overflow: 'hidden', border: `2px solid ${accent}44`, flexShrink: 0, backgroundColor: cardInner }}>
                                                                {avatarSrc
                                                                    ? <img src={avatarSrc} alt={f.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: accent, background: `${accent}20` }}>{(f.displayName || f.username)[0].toUpperCase()}</div>}
                                                            </div>
                                                            <span style={{ fontSize: '9px', color: cardTextSec, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '52px' }}>
                                                                {f.displayName || f.username}
                                                            </span>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: '12px', color: cardTextTer, margin: 0, fontStyle: 'italic' }}>No mutual follows yet.</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Gear Rack ── */}
                        {profile.showGearSection !== false && gear.length > 0 && (
                        <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${cardBorder}`, overflow: 'hidden', boxShadow: cardShadow }}>
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(122,140,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Hammer size={13} color="#7A8C37" />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cardTextSec }}>Gear & Tools</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {gear.map((item: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', backgroundColor: cardInner, border: `1px solid ${cardBorder}` }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7A8C37', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: cardText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || String(item)}</div>
                                                {item.category && <div style={{ fontSize: '10px', color: cardTextTer, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '1px' }}>{item.category}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        )}

                        {/* ── Stats Card ── */}
                        {profile.showStatsBar !== false && <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${cardBorder}`, overflow: 'hidden', boxShadow: cardShadow }}>
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Zap size={13} color={accent} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cardTextSec }}>Stats</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {stats.map(s => (
                                        <div key={s.label} style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: cardInner, border: `1px solid ${cardBorder}` }}>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: cardText, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: cardTextTer, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>}

                        {/* ── Arena Rank Card ── */}
                        {profile.showH2HRank && profile.h2hRating && profile.h2hRating.matchesPlayed > 0 && (() => {
                            const rating = profile.h2hRating!;
                            const tier = h2hTier(rating.elo);
                            const winRate = Math.round((rating.wins / rating.matchesPlayed) * 100);
                            return (
                                <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${tier.color}44`, overflow: 'hidden', boxShadow: `0 0 18px ${tier.color}22` }}>
                                    <div style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${tier.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Swords size={13} color={tier.color} />
                                            </div>
                                            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cardTextSec }}>Arena Rank</span>
                                            <a href="/arena" style={{ marginLeft: 'auto', fontSize: '10px', color: tier.color, textDecoration: 'none', opacity: 0.8 }}>View Arena →</a>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                                            <div style={{
                                                width: 56, height: 56, borderRadius: '14px', flexShrink: 0,
                                                background: `linear-gradient(135deg, ${tier.color}44, ${tier.color}22)`,
                                                border: `1px solid ${tier.color}66`,
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: `0 0 14px ${tier.color}33`,
                                            }}>
                                                {React.cloneElement(tier.icon as React.ReactElement, { size: 20, color: tier.color })}
                                                <div style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.08em', color: tier.color, marginTop: '2px' }}>{tier.name}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '36px', fontWeight: 900, color: tier.color, lineHeight: 1, letterSpacing: '-0.02em', textShadow: `0 0 16px ${tier.color}66` }}>
                                                    {rating.elo}
                                                </div>
                                                <div style={{ fontSize: '10px', color: cardTextSec, marginTop: '2px' }}>Elo Rating</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                            {[
                                                { label: 'Wins', value: rating.wins, color: '#34D399' },
                                                { label: 'Losses', value: rating.losses, color: '#F87171' },
                                                { label: 'Win%', value: `${winRate}%`, color: cardText },
                                            ].map(s => (
                                                <div key={s.label} style={{ padding: '10px 10px', borderRadius: '10px', backgroundColor: cardInner, border: `1px solid ${cardBorder}`, textAlign: 'center' }}>
                                                    <div style={{ fontSize: '18px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                                    <div style={{ fontSize: '9px', fontWeight: 600, color: cardTextTer, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                    </div>
                </div>


            </div>

            {/* Back to Edit Button (Owner only) — portalled to document.body so position:fixed
                is relative to the viewport, not the transformed <main> scroll container */}
            {isOwnProfile && createPortal(
                <button
                    onClick={onEdit}
                    style={{
                        position: 'fixed',
                        bottom: isMobile
                            ? (player.currentTrack ? '176px' : '76px')
                            : (player.currentTrack ? '104px' : '24px'),
                        left: '24px',
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
                </button>,
                document.body
            )}

            <div style={{ height: player.currentTrack ? '100px' : '20px' }} />
        </div>
    );
};
