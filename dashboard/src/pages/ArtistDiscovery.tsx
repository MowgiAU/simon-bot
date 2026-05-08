import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    Play, Plus, Pause, TrendingUp, Swords,
    Activity, Trophy, Users, Timer, ListMusic,
    Star, MonitorPlay, Newspaper, BookOpen, FileText, ExternalLink, Mic2,
    Flame, Crown, ArrowUp, ArrowDown, Minus, Sparkles, Upload, LogIn, UserPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';
import { StyledUsername } from '../components/StyledUsername';

interface ArtistProfile {
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    hardware: string[];
    genres: { genre: { name: string } }[];
    primaryGenre?: { id: string; name: string; slug: string } | null;
    totalPlays: number;
}

interface TrackInfo {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    playCount: number;
    profile: {
        userId: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
    };
    description?: string;
    artist?: string;
    genres?: { genre: { name: string } }[];
}

interface FeaturedData {
    featuredType?: string;
    featuredTrackId: string | null;
    featuredLabel: string | null;
    featuredDescription?: string | null;
    featuredTrack: {
        id: string;
        title: string;
        slug: string | null;
        url: string;
        coverUrl: string | null;
        artist: string | null;
        description: string | null;
        playCount: number;
        profile: { userId: string; username: string; displayName: string | null; avatar: string | null; };
    } | null;
    featuredArtist?: {
        id: string; username: string; displayName: string | null; avatar: string | null; bio: string | null;
        genres: { genre: { name: string } }[];
        tracks: { id: string; title: string; slug: string | null; url: string; coverUrl: string | null }[];
    } | null;
    featuredPlaylist?: {
        id: string; name: string; description: string | null; coverUrl: string | null;
        trackCount: number; totalPlays: number; _count?: { tracks: number };
        profile?: { username: string; displayName: string | null } | null;
        tracks: { track: { id: string; title: string; coverUrl: string | null; url: string; profile: { username: string; displayName: string | null } } }[];
    } | null;
    editorPicks?: TrackInfo[];
    featuredProducer?: ArtistProfile & { tracks: { id: string; title: string; url: string; coverUrl: string | null }[] } | null;
    featuredProducerNote?: string | null;
    featuredContentType?: string | null;
    featuredTutorialUrl?: string | null;
    featuredTutorialTitle?: string | null;
    featuredTutorialDescription?: string | null;
    featuredTutorialThumbnail?: string | null;
    featuredTutorialAuthor?: string | null;
    featuredTutorialDate?: string | null;
    featuredBattle?: {
        id: string; title: string; status: string;
        bannerUrl: string | null;
        cardImageUrl: string | null;
        submissionEnd: string | null; votingEnd: string | null;
        _count?: { entries: number };
        sponsor: { id: string; name: string; logoUrl: string | null } | null;
        prizes: { place: string; title?: string; description: string }[] | null;
    } | null;
    featuredBattleDescription?: string | null;
}

interface PopularPlaylist {
    id: string; name: string; coverUrl: string | null;
    trackCount: number; totalPlays: number;
    profile?: { username: string; displayName: string | null } | null;
    tracks: { track: { coverUrl: string | null } }[];
}

const panel: React.CSSProperties = {
    backgroundColor: '#242C3D',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
};

const panelHeader: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '10px', marginBottom: '14px', flexShrink: 0,
};

const panelTitle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
    color: colors.textPrimary, margin: 0,
};

function getAvatarUrl(avatar: string | null, userId: string): string {
    if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (avatar.startsWith('http') || avatar.startsWith('/uploads/')) return avatar;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=256`;
}

function generateWaveform(seed: string, bars = 32): number[] {
    const out: number[] = [];
    let h = 5381;
    for (let i = 0; i < seed.length; i++) { h = ((Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0); }
    for (let i = 0; i < bars; i++) {
        h = (Math.imul(h ^ (i + 1), 2246822519) + Math.imul(h, 3266489917)) >>> 0;
        out.push(18 + (h % 72)); // 18â€“89 â€” percentage of container height
    }
    return out;
}

export const ArtistDiscoveryPage: React.FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const { player, setTrack, togglePlay } = usePlayer();
    const { user } = useAuth();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Cached queries — navigating back re-uses cache, no spinner
    const { data: discoveryData, isLoading: loading } = useQuery({
        queryKey: ['discovery-home'],
        queryFn: async () => {
            const [profilesRes, tracksRes, chartRes, featuredRes, playlistsRes, articleRes, h2hRes] = await Promise.all([
                axios.get('/api/musician/profiles'),
                axios.get('/api/musician/leaderboards/tracks', { params: { limit: 12 } }),
                axios.get('/api/charts/weekly', { params: { limit: 10 } }),
                axios.get('/api/discovery/settings').catch(() => ({ data: null })),
                axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
                axios.get('/api/articles/featured/current').catch(() => ({ data: null })),
                axios.get('/api/head-to-head/leaderboard?limit=1').catch(() => ({ data: [] })),
            ]);
            return {
                artists: ([...profilesRes.data] as ArtistProfile[]).sort((a, b) => (b.totalPlays || 0) - (a.totalPlays || 0)),
                topTracks: tracksRes.data as TrackInfo[],
                weeklyChart: (chartRes.data?.entries || []) as { position: number; positionChange: number | null; prevPosition: number | null; playsInPeriod: number; track: TrackInfo }[],
                featured: featuredRes.data as FeaturedData | null,
                popularPlaylists: playlistsRes.data as PopularPlaylist[],
                featuredArticle: articleRes.data,
                h2hChampion: Array.isArray(h2hRes.data) && h2hRes.data.length > 0 ? h2hRes.data[0] : null,
            };
        },
    });

    const artists = discoveryData?.artists ?? [];
    const topTracks = discoveryData?.topTracks ?? [];
    const weeklyChart = discoveryData?.weeklyChart ?? [];
    const featured = discoveryData?.featured ?? null;
    const popularPlaylists = discoveryData?.popularPlaylists ?? [];
    const featuredArticle = discoveryData?.featuredArticle ?? null;
    const h2hChampion = discoveryData?.h2hChampion ?? null;

    // â”€â”€ Helpers â”€â”€
    const heroTrack = featured?.featuredTrack;
    const heroPlaylist = featured?.featuredPlaylist;
    const heroArtist = featured?.featuredArtist;
    const heroType = featured?.featuredType || 'track';

    // Get a cover URL for the hero
    const heroCover = heroType === 'track' ? heroTrack?.coverUrl
        : heroType === 'playlist' ? heroPlaylist?.coverUrl
        : heroType === 'artist' ? (heroArtist?.avatar || null)
        : null;

    // Tracks to show in the hero track list (up to 4)
    const heroTrackList: { title: string; artist: string; coverUrl: string | null }[] = [];
    if (heroType === 'playlist' && heroPlaylist?.tracks) {
        heroPlaylist.tracks.slice(0, 6).forEach(pt => heroTrackList.push({ title: pt.track.title, artist: pt.track.profile.displayName || pt.track.profile.username, coverUrl: pt.track.coverUrl }));
    } else if (heroType === 'artist' && heroArtist?.tracks) {
        heroArtist.tracks.slice(0, 4).forEach(t => heroTrackList.push({ title: t.title, artist: heroArtist.displayName || heroArtist.username, coverUrl: t.coverUrl }));
    } else if (heroType === 'track' && heroTrack) {
        heroTrackList.push({ title: heroTrack.title, artist: heroTrack.profile.displayName || heroTrack.profile.username, coverUrl: heroTrack.coverUrl });
        // Fill with top tracks
        topTracks.filter(t => t.id !== heroTrack.id).slice(0, 3).forEach(t => heroTrackList.push({ title: t.title, artist: t.profile.displayName || t.profile.username, coverUrl: t.coverUrl }));
    }

    const heroLabel = featured?.featuredLabel || (heroType === 'artist' ? 'Featured Artist' : heroType === 'playlist' ? 'Hero Playlist' : 'Featured Track');
    const heroTitle = heroType === 'artist' ? (heroArtist?.displayName || heroArtist?.username || '')
        : heroType === 'playlist' ? (heroPlaylist?.name || '')
        : (heroTrack?.title || '');
    const heroSubtitle = heroType === 'artist'
        ? (heroArtist?.genres?.length ? heroArtist.genres.map(g => g.genre.name).join(' Â· ') : '')
        : heroType === 'playlist' ? (heroPlaylist?.profile?.displayName || heroPlaylist?.profile?.username || '') : (heroTrack?.profile.displayName || heroTrack?.profile.username || '');

    const handleHeroPlay = () => {
        if (heroType === 'track' && heroTrack) {
            if (player.currentTrack?.id === heroTrack.id) togglePlay();
            else setTrack(heroTrack as any, [heroTrack as any, ...topTracks]);
        } else if (heroType === 'playlist' && heroPlaylist?.tracks?.length) {
            const tracks = heroPlaylist.tracks.map(pt => pt.track);
            setTrack(tracks[0] as any, tracks as any[]);
        } else if (heroType === 'artist' && heroArtist?.tracks?.length) {
            setTrack(heroArtist.tracks[0] as any, heroArtist.tracks as any[]);
        }
    };

    const isHeroPlaying = (heroType === 'track' && heroTrack && player.currentTrack?.id === heroTrack.id && player.isPlaying)
        || (heroType === 'artist' && heroArtist?.tracks?.length && heroArtist.tracks.some(t => t.id === player.currentTrack?.id) && player.isPlaying)
        || (heroType === 'playlist' && heroPlaylist?.tracks?.length && heroPlaylist.tracks.some(t => t.track.id === player.currentTrack?.id) && player.isPlaying);

    // Get YouTube thumbnail from URL
    const getTutorialThumbnail = (): string | null => {
        if (featured?.featuredTutorialThumbnail) return featured.featuredTutorialThumbnail;
        const url = featured?.featuredTutorialUrl;
        if (!url) return null;
        const match = url.match(new RegExp('(?:youtu\\.be/|youtube\\.com/(?:embed/|v/|watch\\?v=))([^?&]+)'));
        if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
        return null;
    };

    useEffect(() => {
        const id = 'hero-marquee-style';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `
                @keyframes hero-marquee {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .hero-marquee-track {
                    display: flex;
                    gap: 6px;
                    animation: hero-marquee 28s linear infinite;
                    width: max-content;
                }
                .hero-marquee-track:hover { animation-play-state: paused; }
                @keyframes wf-bounce {
                    0%, 100% { transform: scaleY(0.4); }
                    50%  { transform: scaleY(1); }
                }
                .wf-anim-bar { transform-origin: bottom center; animation: wf-bounce 1.1s ease-in-out infinite; }
                .lr-row:hover { background: rgba(255,255,255,0.06) !important; }
                .lr-row:hover .lr-cover-overlay { opacity: 1 !important; }
            `;
            document.head.appendChild(style);
        }
    }, []);

    return (
        <DiscoveryLayout activeTab="discover">
            <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1300px', margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                    gap: '18px',
                }}>

                    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ROW 1: HERO / BATTLE / ARTISTS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

                    {/* Hero/Featured */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '320px' : undefined, position: 'relative', overflow: 'hidden', gridColumn: isMobile ? undefined : 'span 3', padding: 0 }}>
                        {/* Full-bleed background image */}
                        {heroCover && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        )}
                        {/* Dark gradient overlay â€” heavier on left for text legibility */}
                        <div style={{ position: 'absolute', inset: 0, background: heroCover
                            ? 'linear-gradient(to right, rgba(14,18,26,0.97) 30%, rgba(14,18,26,0.6) 65%, rgba(14,18,26,0.25) 100%), linear-gradient(to top, rgba(14,18,26,0.6) 0%, transparent 50%)'
                            : 'rgba(14,18,26,0.98)'
                        }} />

                        {/* Cover art â€” floated to the right, vertically centred */}
                        {heroCover && !isMobile && (
                            <div style={{
                                position: 'absolute', right: '32px', top: '50%', transform: 'translateY(-50%)',
                                width: heroType === 'artist' ? '180px' : '190px',
                                height: heroType === 'artist' ? '180px' : '190px',
                                borderRadius: heroType === 'artist' ? '50%' : '16px',
                                overflow: 'hidden', flexShrink: 0,
                                boxShadow: heroType === 'artist' ? `0 20px 60px rgba(0,0,0,0.7), 0 0 0 3px ${colors.primary}33` : '0 20px 60px rgba(0,0,0,0.7)',
                                border: heroType === 'artist' ? `3px solid ${colors.primary}44` : '1px solid rgba(255,255,255,0.12)',
                            }}>
                                <img src={heroCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}

                        {/* Main content â€” full height flex column, padded, right side offset to avoid cover art */}
                        <div style={{
                            position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            height: '100%', boxSizing: 'border-box',
                            padding: isMobile ? '24px 20px' : '28px 32px',
                            paddingRight: (heroCover && !isMobile) ? '248px' : (isMobile ? '20px' : '32px'),
                        }}>
                            {/* Top: label badge */}
                            <div>
                                <span style={{
                                    display: 'inline-block', fontSize: '10px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.12em',
                                    color: colors.primary, background: `${colors.primary}25`,
                                    padding: '4px 10px', borderRadius: '4px',
                                }}>{heroLabel}</span>
                            </div>

                            {/* Middle: title + subtitle + description */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 0' }}>
                                <h2 style={{ fontSize: isMobile ? '24px' : '34px', fontWeight: 900, margin: '0 0 6px', lineHeight: 1.1, color: '#fff' }}>{heroTitle}</h2>
                                {heroSubtitle && (
                                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginBottom: '10px', fontWeight: 500 }}>{heroSubtitle}</div>
                                )}
                                {heroType === 'artist' && heroArtist?.bio && !featured?.featuredDescription && (
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>{heroArtist.bio}</p>
                                )}
                                {featured?.featuredDescription && (
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' as any }}>{featured.featuredDescription}</p>
                                )}
                            </div>

                            {/* Bottom: track strip + action buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
                                {/* Track pills â€” infinite marquee */}
                                {heroTrackList.length > 0 && (
                                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' } as React.CSSProperties}>
                                    <div className="hero-marquee-track">
                                        {[...heroTrackList, ...heroTrackList].map((t, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(6px)',
                                                borderRadius: '6px', padding: '5px 8px 5px 5px', flexShrink: 0,
                                                border: '1px solid rgba(255,255,255,0.06)',
                                            }}>
                                                {t.coverUrl ? (
                                                    <div style={{ width: '22px', height: '22px', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
                                                        <img src={t.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                ) : (
                                                    <div style={{ width: '22px', height: '22px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                                                )}
                                                <span style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.85)' }}>{t.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                )}
                                {heroType === 'artist' && heroArtist ? (
                                    <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                                        <Link to={`/profile/${heroArtist.username}`} style={{
                                            backgroundColor: colors.primary, color: 'white', padding: '11px 20px',
                                            borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
                                            boxShadow: `0 4px 20px ${colors.primary}55`, textDecoration: 'none',
                                        }}>
                                            <Mic2 size={16} /> Explore Artist
                                        </Link>
                                        {heroArtist.tracks?.length > 0 && (
                                            <button onClick={handleHeroPlay} style={{
                                                backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', padding: '11px 20px',
                                                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px', fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
                                            }}>
                                                {isHeroPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                                                {isHeroPlaying ? 'Pause' : 'Listen'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                <button onClick={handleHeroPlay} style={{
                                    backgroundColor: colors.primary, color: 'white', padding: '11px 20px',
                                    borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
                                    boxShadow: `0 4px 20px ${colors.primary}55`,
                                }}>
                                    {isHeroPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                                    {isHeroPlaying ? 'Pause' : 'Play Now'}
                                </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Battle */}
                    {(() => {
                        const battle = featured?.featuredBattle;
                        const battleDesc = featured?.featuredBattleDescription;
                        return (
                    <div style={{ ...panel, padding: 0, height: 'auto', minHeight: isMobile ? '200px' : '200px', position: 'relative', overflow: 'hidden' }}>
                        {/* Banner image â€” blurred background */}
                        {battle?.bannerUrl && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${battle.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.2, filter: 'blur(8px)', transform: 'scale(1.1)', pointerEvents: 'none' }} />
                        )}
                        {/* Gradient overlay */}
                        <div style={{ position: 'absolute', inset: 0, background: battle?.bannerUrl
                            ? 'rgba(18,22,36,0.55)'
                            : `linear-gradient(135deg, ${colors.primary}28 0%, rgba(90,20,200,0.14) 100%)`,
                            pointerEvents: 'none',
                        }} />

                        {/* Content */}
                        <div style={{ position: 'relative', zIndex: 1, padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', height: '100%', gap: '8px', boxSizing: 'border-box' }}>
                            {/* Top row: header + status badge */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Link to="/battles" style={{ textDecoration: 'none' }}>
                                    <h3 style={{ ...panelTitle, transition: 'color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.color = colors.primary)} onMouseLeave={e => (e.currentTarget.style.color = 'white')}>
                                        <Swords size={14} color={colors.primary} /> BATTLES
                                    </h3>
                                </Link>
                                {battle && (
                                    <span style={{
                                        display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px',
                                        backgroundColor: battle.status === 'voting' ? 'rgba(251,191,36,0.22)' : battle.status === 'active' ? 'rgba(52,211,153,0.22)' : battle.status === 'completed' ? 'rgba(100,116,139,0.22)' : 'rgba(96,165,250,0.22)',
                                        color: battle.status === 'voting' ? '#FBBF24' : battle.status === 'active' ? '#34D399' : battle.status === 'completed' ? '#94A3B8' : '#60A5FA',
                                        fontSize: '8px', fontWeight: 'bold', borderRadius: '999px', letterSpacing: '0.07em',
                                        backdropFilter: 'blur(6px)',
                                    }}>
                                        <span
                                            className={battle.status === 'active' ? 'new-drops-pulse' : undefined}
                                            style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 }}
                                        />
                                        {battle.status === 'voting' ? 'VOTING' : battle.status === 'active' ? 'LIVE' : battle.status === 'completed' ? 'ENDED' : 'UPCOMING'}
                                    </span>
                                )}
                            </div>

                            {battle ? (
                                <>
                                    {/* Title, card image & description */}
                                    <div>
                                        <p style={{ fontSize: '18px', fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{battle.title}</p>
                                        {battle.cardImageUrl && (
                                            <img
                                                src={battle.cardImageUrl}
                                                alt={battle.title}
                                                style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginBottom: '6px', display: 'block' }}
                                            />
                                        )}
                                        {battleDesc && (
                                            <p style={{ fontSize: '11px', color: 'rgba(210,218,226,0.85)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                {battleDesc}
                                            </p>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#D2DAE2' }}>
                                            <Users size={11} style={{ flexShrink: 0 }} />
                                            {battle._count?.entries ?? 0} {(battle._count?.entries ?? 0) === 1 ? 'entry' : 'entries'}
                                        </span>
                                        {battle.status === 'voting' && battle.votingEnd && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FBBF24' }}>
                                                <Timer size={11} style={{ flexShrink: 0 }} />
                                                Closes {new Date(battle.votingEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                        {battle.status === 'active' && battle.submissionEnd && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#34D399' }}>
                                                <Timer size={11} style={{ flexShrink: 0 }} />
                                                Closes {new Date(battle.submissionEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>

                                    {/* Prizes â€” medal style */}
                                    {battle.prizes && battle.prizes.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {battle.prizes.slice(0, 3).map((p, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#D2DAE2' }}>
                                                    <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                                                    <span style={{ fontWeight: 600, color: 'white' }}>{p.place}:</span>
                                                    {p.title && <span style={{ color: colors.primary, fontWeight: 600 }}>{p.title}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Sponsor chip + CTA row */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                        {battle.sponsor ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)' }}>
                                                {battle.sponsor.logoUrl && (
                                                    <img src={battle.sponsor.logoUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'contain' }} />
                                                )}
                                                <span style={{ fontSize: '10px', color: '#B9C3CE' }}>Sponsored by <strong style={{ color: 'white' }}>{battle.sponsor.name}</strong></span>
                                            </div>
                                        ) : <div />}
                                        <Link
                                            to={`/battles/${battle.id}`}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                                                color: battle.status === 'voting' ? '#FBBF24' : battle.status === 'completed' ? '#94A3B8' : colors.primary,
                                                backgroundColor: battle.status === 'voting' ? 'rgba(251,191,36,0.18)' : battle.status === 'completed' ? 'rgba(100,116,139,0.18)' : `${colors.primary}25`,
                                                padding: '8px 16px', borderRadius: '8px',
                                                border: `1px solid ${battle.status === 'voting' ? 'rgba(251,191,36,0.4)' : battle.status === 'completed' ? 'rgba(100,116,139,0.4)' : `${colors.primary}45`}`,
                                                backdropFilter: 'blur(6px)',
                                            }}
                                        >
                                            {battle.status === 'voting'
                                                ? <><Trophy size={13} /> Vote Now &rarr;</>
                                                : battle.status === 'active'
                                                ? <><Swords size={13} /> Submit a Beat &rarr;</>
                                                : battle.status === 'completed'
                                                ? 'View Results →'
                                                : 'View Battle →'}
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0', textAlign: 'center' }}>
                                    <Swords size={28} color={colors.textSecondary} style={{ opacity: 0.2 }} />
                                    <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No battle running right now.</p>
                                    <Link to="/battles" style={{ fontSize: '11px', color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>View archive →</Link>
                                </div>
                            )}
                        </div>
                    </div>
                        );
                    })()}

                    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ROW 2: TRENDING ARTISTS / PLAYLISTS / TUTORIAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

                    {/* Trending Artist */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '260px', position: 'relative', overflow: 'hidden', padding: 0, border: '1px solid rgba(255,255,255,0.07)', gridColumn: isMobile ? undefined : 'span 2' }}>
                        {artists[0] ? (
                            <>
                                {/* Full-bleed blurred background */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    backgroundImage: `url(${getAvatarUrl(artists[0].avatar, artists[0].userId)})`,
                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                    filter: 'blur(40px) brightness(0.2) saturate(1.6)',
                                    transform: 'scale(1.3)', pointerEvents: 'none',
                                }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(14,18,26,0.35) 0%, rgba(14,18,26,0.85) 70%, rgba(14,18,26,0.95) 100%)', pointerEvents: 'none' }} />
                                {/* Accent glow */}
                                <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: '60%', height: '80%', background: `radial-gradient(ellipse, ${colors.primary}15 0%, transparent 70%)`, pointerEvents: 'none' }} />

                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', height: '100%', padding: isMobile ? '16px' : '20px 24px', boxSizing: 'border-box', gap: isMobile ? '14px' : '20px', alignItems: 'center' }}>

                                    {/* Left: avatar with glowing ring */}
                                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', background: `conic-gradient(from 45deg, ${colors.primary}, #a78bfa, #FBBF24, #F472B6, ${colors.primary})`, opacity: 0.7, filter: 'blur(1px)' }} />
                                            <div style={{ position: 'absolute', inset: '-3px', borderRadius: '50%', background: 'rgba(14,18,26,0.8)' }} />
                                            <div style={{ width: isMobile ? '90px' : '110px', height: isMobile ? '90px' : '110px', borderRadius: '50%', overflow: 'hidden', position: 'relative', zIndex: 1, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                                                <img src={getAvatarUrl(artists[0].avatar, artists[0].userId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }} />
                                            </div>
                                            {/* #1 badge */}
                                            <div style={{ position: 'absolute', bottom: '0px', right: '0px', zIndex: 2, width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, color: 'white', border: '3px solid rgba(14,18,26,0.9)', boxShadow: '0 3px 12px rgba(245,158,11,0.6)' }}>#1</div>
                                        </div>
                                    </div>

                                    {/* Right: info */}
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Label */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <TrendingUp size={12} color="#FBBF24" />
                                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Trending Artist</span>
                                        </div>
                                        {/* Name */}
                                        <Link to={`/profile/${artists[0].username}`} style={{ textDecoration: 'none' }}>
                                            <div style={{ fontWeight: 900, fontSize: isMobile ? '18px' : '22px', color: colors.textPrimary, letterSpacing: '-0.03em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <StyledUsername userId={artists[0].userId}>{artists[0].displayName || artists[0].username}</StyledUsername>
                                            </div>
                                        </Link>
                                        {/* Genre pills */}
                                        {(artists[0].primaryGenre || artists[0].genres?.length > 0) && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {artists[0].primaryGenre && (
                                                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 10px', borderRadius: '20px', background: `${colors.primary}22`, border: `1px solid ${colors.primary}55`, color: colors.primary }}>
                                                        {artists[0].primaryGenre.name}
                                                    </span>
                                                )}
                                                {artists[0].genres?.filter(g => g.genre && (!artists[0].primaryGenre || g.genre.name !== artists[0].primaryGenre!.name)).slice(0, 2).map((g, i) => (
                                                    <span key={i} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: colors.textSecondary }}>
                                                        {g.genre.name}
                                                    </span>
                                                ))}
                                                {!artists[0].primaryGenre && artists[0].genres?.slice(0, 3).map((g, i) => (
                                                    <span key={`fb-${i}`} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: colors.textSecondary }}>
                                                        {g.genre.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Bio */}
                                        {artists[0].bio && (
                                            <p style={{ fontSize: '12px', color: 'rgba(185,195,210,0.7)', lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                {artists[0].bio}
                                            </p>
                                        )}
                                        {/* Stats + CTA row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '22px', fontWeight: 900, color: colors.primary, lineHeight: 1, letterSpacing: '-0.02em' }}>
                                                    {artists[0].totalPlays >= 1000 ? `${(artists[0].totalPlays / 1000).toFixed(1)}k` : (artists[0].totalPlays || 0).toLocaleString()}
                                                </span>
                                                <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>plays</span>
                                            </div>
                                            <Link to={`/profile/${artists[0].username}`} style={{
                                                marginLeft: 'auto',
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                padding: '9px 20px', borderRadius: '999px', textDecoration: 'none',
                                                background: colors.primary, color: 'white',
                                                fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em',
                                                boxShadow: `0 4px 16px ${colors.primary}44`,
                                                transition: 'transform 0.15s, box-shadow 0.15s',
                                            }}
                                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${colors.primary}66`; }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 16px ${colors.primary}44`; }}
                                            >
                                                View Profile
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px' }}>
                                <TrendingUp size={32} color={colors.textSecondary} style={{ opacity: 0.15 }} />
                                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No artists yet</p>
                            </div>
                        )}
                    </div>

                    {/* 1v1 Arena â€” Beat Battles head-to-head */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '260px', position: 'relative', overflow: 'hidden', padding: 0, border: '1px solid rgba(139,92,246,0.18)', gridColumn: isMobile ? undefined : 'span 2' }}>
                        {/* Animated diagonal gradient background */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(135deg, #1a0f2e 0%, #2a0f3a 35%, #3d0f2e 70%, #2a0f1a 100%)',
                            pointerEvents: 'none',
                        }} />
                        {/* Purple glow top-left */}
                        <div style={{ position: 'absolute', top: '-30%', left: '-15%', width: '70%', height: '90%', background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, transparent 65%)', pointerEvents: 'none' }} />
                        {/* Pink glow bottom-right */}
                        <div style={{ position: 'absolute', bottom: '-25%', right: '-10%', width: '60%', height: '85%', background: 'radial-gradient(ellipse, rgba(236,72,153,0.22) 0%, transparent 65%)', pointerEvents: 'none' }} />
                        {/* Subtle scan-line texture */}
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)', pointerEvents: 'none' }} />

                        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row', padding: isMobile ? '20px' : '22px 26px', boxSizing: 'border-box', gap: isMobile ? '18px' : '24px', alignItems: isMobile ? 'stretch' : 'center' }}>

                            {/* Left: Branding */}
                            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
                                {/* Label row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Swords size={13} color="#EC4899" />
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#EC4899', letterSpacing: '0.15em', textTransform: 'uppercase' }}>1v1 Arena</span>
                                    <span style={{ fontSize: '8px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(52,211,153,0.18)', color: '#34D399', letterSpacing: '0.1em', border: '1px solid rgba(52,211,153,0.3)' }}>NEW</span>
                                </div>
                                {/* Title */}
                                <div style={{ fontWeight: 900, fontSize: isMobile ? '22px' : '26px', color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                                    Producer vs<br/>Producer
                                </div>
                                {/* Subtitle */}
                                <p style={{ fontSize: '12px', color: 'rgba(220,220,240,0.7)', margin: 0, lineHeight: 1.5, maxWidth: '260px' }}>
                                    Get matched. Get a sample pack. Build a beat. Anonymous voters pick the winner.
                                </p>
                                {/* CTA */}
                                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                    <Link to="/arena" style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '7px', width: 'fit-content',
                                        padding: '9px 20px', borderRadius: '999px', textDecoration: 'none',
                                        background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                                        color: 'white', fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em',
                                        boxShadow: '0 4px 16px rgba(139,92,246,0.44)',
                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(236,72,153,0.55)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,92,246,0.44)'; }}
                                    >
                                        <Swords size={14} /> Enter the Arena
                                    </Link>
                                </div>
                            </div>

                            {/* Right: Reigning champion or VS graphic */}
                            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: isMobile ? 'auto' : '180px' }}>
                                {h2hChampion ? (
                                    <Link to={h2hChampion.profile?.username ? `/profile/${h2hChampion.profile.username}` : '/arena'} style={{ textDecoration: 'none' }}>
                                        <div style={{
                                            position: 'relative', padding: '14px 16px',
                                            borderRadius: '14px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(251,191,36,0.35)',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 0 24px rgba(251,191,36,0.08)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                            minWidth: '160px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <Trophy size={11} color="#FBBF24" />
                                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Reigning Champ</span>
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ position: 'absolute', inset: '-3px', borderRadius: '50%', background: 'conic-gradient(from 90deg, #FBBF24, #EC4899, #8B5CF6, #FBBF24)', opacity: 0.85, filter: 'blur(1px)' }} />
                                                <div style={{ position: 'absolute', inset: '-2px', borderRadius: '50%', background: 'rgba(20,12,30,0.85)' }} />
                                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                                                    {h2hChampion.profile?.avatar ? (
                                                        <img src={getAvatarUrl(h2hChampion.profile.avatar, h2hChampion.userId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '22px' }}>
                                                            {(h2hChampion.profile?.displayName || h2hChampion.profile?.username || '?')[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '13px', color: '#fff', textAlign: 'center', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {h2hChampion.profile?.displayName || h2hChampion.profile?.username || 'Anonymous'}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#FBBF24', lineHeight: 1, letterSpacing: '-0.02em' }}>{h2hChampion.elo}</span>
                                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Elo</span>
                                                <span style={{ fontSize: '10px', color: '#34D399', fontWeight: 700 }}>{h2hChampion.wins}W</span>
                                                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Â·</span>
                                                <span style={{ fontSize: '10px', color: 'rgba(248,113,113,0.85)', fontWeight: 700 }}>{h2hChampion.losses}L</span>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    /* Fallback: stylised arena graphic */
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ position: 'relative', width: '120px', height: '80px' }}>
                                            {/* Left producer */}
                                            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '52px', height: '52px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(99,102,241,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                                <Mic2 size={22} color="white" />
                                            </div>
                                            {/* VS badge */}
                                            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '28px', height: '28px', borderRadius: '50%', background: '#0d0d1a', border: '2px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                                <span style={{ fontSize: '8px', fontWeight: 900, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>VS</span>
                                            </div>
                                            {/* Right producer */}
                                            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: '52px', height: '52px', borderRadius: '12px', background: 'linear-gradient(135deg, #EC4899, #F43F5E)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(236,72,153,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                                <Mic2 size={22} color="white" />
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '10px', color: 'rgba(220,220,255,0.45)', fontWeight: 600, letterSpacing: '0.06em' }}>No matches yet — be first</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Featured Content â€” full width below */}
                    {(() => {
                        const contentType = featured?.featuredContentType || 'video';
                        const typeConfig: Record<string, { icon: React.ReactNode; label: string; accentColor: string }> = {
                            video:   { icon: <MonitorPlay size={13} />, label: 'Featured Video',   accentColor: colors.primary },
                            news:    { icon: <Newspaper size={13} />,   label: 'Featured News',    accentColor: '#A78BFA' },
                            guide:   { icon: <BookOpen size={13} />,    label: 'Featured Guide',   accentColor: '#FBBF24' },
                            article: { icon: <FileText size={13} />,    label: 'Featured Article', accentColor: '#34D399' },
                        };
                        const tc = typeConfig[contentType] ?? typeConfig.video;
                        return (
                            <div style={{ ...panel, gridColumn: isMobile ? undefined : 'span 2', height: isMobile ? 'auto' : '240px', position: 'relative', overflow: 'hidden', padding: 0, border: '1px solid rgba(255,255,255,0.07)', boxSizing: 'border-box' }}>
                                {/* Blurred thumbnail/accent background */}
                                {contentType === 'video' && (featured?.featuredTutorialThumbnail || getTutorialThumbnail()) && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: `url(${featured?.featuredTutorialThumbnail || getTutorialThumbnail()})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        filter: 'blur(40px) brightness(0.2) saturate(1.5)',
                                        transform: 'scale(1.3)',
                                        pointerEvents: 'none',
                                    }} />
                                )}
                                {contentType !== 'video' && featuredArticle?.coverImageUrl && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: `url(${featuredArticle.coverImageUrl})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        filter: 'blur(40px) brightness(0.18) saturate(1.4)',
                                        transform: 'scale(1.3)',
                                        pointerEvents: 'none',
                                    }} />
                                )}
                                {contentType !== 'video' && !featuredArticle?.coverImageUrl && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: `radial-gradient(ellipse at 30% 50%, ${tc.accentColor}18 0%, transparent 65%)`,
                                        pointerEvents: 'none',
                                    }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(14,18,26,0.4) 0%, rgba(14,18,26,0.8) 60%, rgba(14,18,26,0.95) 100%)', pointerEvents: 'none' }} />
                                {/* Accent glow */}
                                <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '70%', background: `radial-gradient(ellipse, ${tc.accentColor}10 0%, transparent 70%)`, pointerEvents: 'none' }} />

                                <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: isMobile ? '20px' : '24px 28px', boxSizing: 'border-box' }}>
                                    {/* Type label */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                                        <span style={{ color: tc.accentColor, display: 'flex', alignItems: 'center' }}>{tc.icon}</span>
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: tc.accentColor, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{tc.label}</span>
                                    </div>

                                    {/* Content body */}
                                    {contentType === 'video' ? (
                                        featured?.featuredTutorialUrl ? (
                                            <div style={{ flex: 1, display: 'flex', gap: isMobile ? '16px' : '24px', minHeight: 0, overflow: 'hidden', alignItems: 'center' }}>
                                                {/* Left: thumbnail with play overlay */}
                                                <a href={featured.featuredTutorialUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, display: 'block', width: isMobile ? '140px' : '220px', textDecoration: 'none' }}>
                                                    <div style={{
                                                        width: '100%', aspectRatio: '16/9',
                                                        borderRadius: '12px', overflow: 'hidden', position: 'relative',
                                                        background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                                        cursor: 'pointer',
                                                    }}>
                                                        {getTutorialThumbnail() && (
                                                            <img src={getTutorialThumbnail()!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, transition: 'transform 0.3s' }} />
                                                        )}
                                                        <div style={{
                                                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'background 0.2s',
                                                        }}>
                                                            <div style={{
                                                                width: '52px', height: '52px',
                                                                background: `${colors.primary}dd`, borderRadius: '50%',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                boxShadow: `0 6px 24px ${colors.primary}55`,
                                                                transition: 'transform 0.2s',
                                                            }}>
                                                                <Play size={22} fill="white" color="white" style={{ marginLeft: '3px' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </a>
                                                {/* Right: text + CTA */}
                                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                                                    <div style={{ fontWeight: 900, fontSize: isMobile ? '16px' : '22px', lineHeight: 1.2, color: colors.textPrimary, letterSpacing: '-0.02em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                        {featured.featuredTutorialTitle || 'Watch Tutorial'}
                                                    </div>
                                                    {featured.featuredTutorialDescription && (
                                                        <div style={{ fontSize: '12px', color: 'rgba(185,195,210,0.7)', lineHeight: 1.7, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                                            {featured.featuredTutorialDescription}
                                                        </div>
                                                    )}
                                                    {/* Author + date */}
                                                    {(featured.featuredTutorialAuthor || featured.featuredTutorialDate) && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            {featured.featuredTutorialAuthor && (
                                                                <span style={{ fontSize: '11px', color: colors.textPrimary, fontWeight: 700 }}>
                                                                    {featured.featuredTutorialAuthor}
                                                                </span>
                                                            )}
                                                            {featured.featuredTutorialAuthor && featured.featuredTutorialDate && (
                                                                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>Â·</span>
                                                            )}
                                                            {featured.featuredTutorialDate && (
                                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                                                                    {featured.featuredTutorialDate}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <a
                                                        href={featured.featuredTutorialUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                            padding: '9px 20px', borderRadius: '999px', width: 'fit-content',
                                                            background: colors.primary, color: 'white',
                                                            fontWeight: 700, fontSize: '12px', textDecoration: 'none',
                                                            letterSpacing: '0.03em',
                                                            boxShadow: `0 4px 16px ${colors.primary}44`,
                                                            transition: 'transform 0.15s, box-shadow 0.15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${colors.primary}66`; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 16px ${colors.primary}44`; }}
                                                    >
                                                        <ExternalLink size={13} /> Watch Now
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                <MonitorPlay size={40} color={colors.textSecondary} style={{ opacity: 0.12 }} />
                                                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No video set</p>
                                            </div>
                                        )
                                    ) : (
                                        /* News / Guide / Article â€” show featured article or fallback */
                                        featuredArticle ? (
                                            <a href={`/article/${featuredArticle.slug}`} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '24px', textDecoration: 'none', color: 'inherit', overflow: 'hidden' }}>
                                                {featuredArticle.coverImageUrl ? (
                                                    <div style={{
                                                        width: isMobile ? '100px' : '160px', height: isMobile ? '100px' : '160px', flexShrink: 0, borderRadius: '14px',
                                                        overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                                                    }}>
                                                        <img src={featuredArticle.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        width: isMobile ? '100px' : '160px', height: isMobile ? '100px' : '160px', flexShrink: 0, borderRadius: '14px',
                                                        background: `${tc.accentColor}12`, border: `1px solid ${tc.accentColor}30`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                                    }}>
                                                        {contentType === 'news'
                                                            ? <Newspaper size={40} color={tc.accentColor} style={{ opacity: 0.5 }} />
                                                            : contentType === 'article'
                                                            ? <FileText size={40} color={tc.accentColor} style={{ opacity: 0.5 }} />
                                                            : <BookOpen size={40} color={tc.accentColor} style={{ opacity: 0.5 }} />}
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                                                    <div style={{ fontSize: isMobile ? '16px' : '22px', fontWeight: 900, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                        {featuredArticle.title}
                                                    </div>
                                                    {featuredArticle.excerpt && (
                                                        <div style={{ fontSize: '12px', color: 'rgba(185,195,210,0.7)', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                                                            {featuredArticle.excerpt}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        {featuredArticle.authorName && (
                                                            <span style={{ fontSize: '11px', color: colors.textPrimary, fontWeight: 700 }}>
                                                                {featuredArticle.authorName}
                                                            </span>
                                                        )}
                                                        {featuredArticle.authorName && featuredArticle.publishedAt && (
                                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>Â·</span>
                                                        )}
                                                        {featuredArticle.publishedAt && (
                                                            <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                                                                {new Date(featuredArticle.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '7px', width: 'fit-content',
                                                            padding: '9px 20px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
                                                            background: tc.accentColor, color: 'white',
                                                            letterSpacing: '0.03em',
                                                            boxShadow: `0 4px 16px ${tc.accentColor}44`,
                                                        }}>Read Article</span>
                                                    </div>
                                                </div>
                                            </a>
                                        ) : (
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '28px', justifyContent: 'center' }}>
                                                <div style={{
                                                    width: '100px', height: '100px', flexShrink: 0, borderRadius: '20px',
                                                    background: `${tc.accentColor}10`,
                                                    border: `1px solid ${tc.accentColor}25`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {contentType === 'news'
                                                        ? <Newspaper size={42} color={tc.accentColor} style={{ opacity: 0.4 }} />
                                                        : contentType === 'article'
                                                        ? <FileText size={42} color={tc.accentColor} style={{ opacity: 0.4 }} />
                                                        : <BookOpen size={42} color={tc.accentColor} style={{ opacity: 0.4 }} />}
                                                </div>
                                                <div style={{ flex: 1, maxWidth: '300px' }}>
                                                    <div style={{ fontSize: '18px', fontWeight: 900, color: colors.textPrimary, marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                                        {contentType === 'news' ? 'Community News' : contentType === 'article' ? 'Featured Article' : 'Community Guides'}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'rgba(185,195,210,0.6)', lineHeight: 1.7, marginBottom: '14px' }}>
                                                        {contentType === 'news'
                                                            ? 'Curated updates, announcements, and stories from the Fuji Studio community.'
                                                            : contentType === 'article'
                                                            ? 'A featured article selected by the community team.'
                                                            : 'In-depth tutorials and production guides from experienced FL Studio producers.'}
                                                    </div>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        padding: '6px 14px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                                                        background: `${tc.accentColor}15`, border: `1px solid ${tc.accentColor}30`,
                                                        color: tc.accentColor, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                    }}>No content yet</span>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Get Started / Upload Action Card */}
                    {(() => {
                        const hasProfile = !!(user?.profileUsername);
                        const isLoggedIn = !!user;

                        let actionConfig: { label: string; sublabel: string; icon: React.ReactNode; link: string; bgGradient: string; accentColor: string; buttonText: string };

                        if (!isLoggedIn) {
                            actionConfig = {
                                label: 'Join Fuji Studio',
                                sublabel: 'Create an account to start your music journey',
                                icon: <UserPlus size={20} />,
                                link: '/login',
                                bgGradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                                accentColor: '#60A5FA',
                                buttonText: 'Create Account'
                            };
                        } else if (!hasProfile) {
                            actionConfig = {
                                label: 'Set Up Artist Profile',
                                sublabel: 'Showcase your music and connect with fans',
                                icon: <UserPlus size={20} />,
                                link: '/profile/setup',
                                bgGradient: 'linear-gradient(135deg, #451a03 0%, #1e1b4b 100%)',
                                accentColor: '#FBBF24',
                                buttonText: 'Start Setup'
                            };
                        } else {
                            actionConfig = {
                                label: 'Share Your Music',
                                sublabel: 'Upload your latest track and get discovered',
                                icon: <Upload size={20} />,
                                link: '/my-tracks',
                                bgGradient: 'linear-gradient(135deg, #14532d 0%, #0f172a 100%)',
                                accentColor: '#34D399',
                                buttonText: 'Upload Track'
                            };
                        }

                        return (
                            <div style={{
                                ...panel,
                                gridColumn: isMobile ? undefined : 'span 2',
                                height: isMobile ? 'auto' : '240px',
                                position: 'relative',
                                overflow: 'hidden',
                                padding: 0,
                                border: `1px solid ${actionConfig.accentColor}28`,
                                boxSizing: 'border-box',
                            }}>
                                {/* Background */}
                                <div style={{ position: 'absolute', inset: 0, background: actionConfig.bgGradient, pointerEvents: 'none' }} />
                                {/* Large icon watermark — top-right */}
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.07, pointerEvents: 'none' }}>
                                    {React.cloneElement(actionConfig.icon as React.ReactElement, { size: 140 })}
                                </div>
                                {/* Glow */}
                                <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: '55%', height: '80%', background: `radial-gradient(ellipse, ${actionConfig.accentColor}18 0%, transparent 70%)`, pointerEvents: 'none' }} />

                                <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', padding: isMobile ? '24px' : '28px 32px', boxSizing: 'border-box', gap: '24px' }}>
                                    {/* Icon badge */}
                                    <div style={{ flexShrink: 0, width: isMobile ? '56px' : '72px', height: isMobile ? '56px' : '72px', borderRadius: '20px', background: `${actionConfig.accentColor}18`, border: `1px solid ${actionConfig.accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 28px ${actionConfig.accentColor}22` }}>
                                        {React.cloneElement(actionConfig.icon as React.ReactElement, { size: isMobile ? 26 : 32, color: actionConfig.accentColor })}
                                    </div>

                                    {/* Text */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: actionConfig.accentColor, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            {actionConfig.label}
                                        </div>
                                        <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 900, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '8px' }}>
                                            {actionConfig.sublabel}
                                        </div>
                                        <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.5, marginBottom: '20px' }}>
                                            {!isLoggedIn
                                                ? `Join ${(artists.length || 0).toLocaleString()}+ producers already sharing their music.`
                                                : !hasProfile
                                                ? 'Your profile is your stage. Get discovered by listeners and other producers.'
                                                : `${(artists.length || 0).toLocaleString()}+ tracks in the library — add yours to the mix.`}
                                        </div>
                                        <Link to={actionConfig.link} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '9px 20px', borderRadius: '999px', textDecoration: 'none',
                                            background: actionConfig.accentColor,
                                            color: !isLoggedIn ? '#0f172a' : 'white',
                                            fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em',
                                            boxShadow: `0 4px 16px ${actionConfig.accentColor}44`,
                                            transition: 'transform 0.15s, box-shadow 0.15s',
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${actionConfig.accentColor}66`; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 16px ${actionConfig.accentColor}44`; }}
                                        >
                                            {isLoggedIn ? <Upload size={13} /> : <LogIn size={13} />}
                                            {actionConfig.buttonText}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* â•â•â•â•â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬ FULL-WIDTH: WEEKLY CHART â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬â•â¬ */}
                    <div style={{
                        gridColumn: isMobile ? undefined : '1 / -1',
                        position: 'relative',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        background: 'linear-gradient(180deg, #11192B 0%, #0B1120 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                    }}>
                        {/* Header strip â€” newspaper masthead vibe */}
                        <div style={{
                            padding: isMobile ? '18px 18px 16px' : '24px 28px 20px',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px',
                            borderBottom: '2px solid rgba(255,255,255,0.06)',
                            position: 'relative',
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.2em' }}>The Charts</span>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.primary, opacity: 0.5 }} />
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Updated weekly</span>
                                </div>
                                <h2 style={{ margin: 0, fontSize: isMobile ? '24px' : '32px', fontWeight: 900, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    Top <span style={{ color: colors.primary }}>10</span> This Week
                                </h2>
                            </div>
                            <Link to="/charts" style={{ fontSize: '11px', color: colors.textPrimary, textDecoration: 'none', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap', flexShrink: 0 }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${colors.primary}15`; e.currentTarget.style.borderColor = `${colors.primary}55`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                            >
                                See All <ExternalLink size={11} />
                            </Link>
                        </div>

                        {/* Empty state */}
                        {weeklyChart.length === 0 && (
                            <div style={{ padding: '48px 24px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>
                                <TrendingUp size={36} color={colors.textSecondary} style={{ opacity: 0.18, marginBottom: '10px' }} />
                                <div>No chart data yet — check back after the first weekly snapshot.</div>
                            </div>
                        )}

                        {weeklyChart.length > 0 && (() => {
                            const trackList = weeklyChart.map(e => e.track);
                            const renderMovement = (entry: typeof weeklyChart[0]) => {
                                const isNew = entry.prevPosition == null;
                                const change = entry.positionChange;
                                if (isNew) return { color: '#22D3EE', bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.4)', icon: <Sparkles size={9} />, label: 'NEW' };
                                if (change != null && change > 0) return { color: '#4ADE80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', icon: <ArrowUp size={10} />, label: `${change}` };
                                if (change != null && change < 0) return { color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', icon: <ArrowDown size={10} />, label: `${Math.abs(change)}` };
                                return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', icon: <Minus size={10} />, label: '' };
                            };

                            return (
                                <div style={{
                                    padding: isMobile ? '16px' : '24px 28px 28px',
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(220px, 1fr))',
                                    gap: isMobile ? '12px' : '18px',
                                }}>
                                    {weeklyChart.map(entry => {
                                        const track = entry.track;
                                        const isPlaying = player.currentTrack?.id === track.id && player.isPlaying;
                                        const isTop = entry.position === 1;
                                        const move = renderMovement(entry);

                                        return (
                                            <div
                                                key={track.id}
                                                onClick={() => { if (player.currentTrack?.id === track.id) togglePlay(); else setTrack(track, trackList); }}
                                                style={{
                                                    position: 'relative',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    background: '#0B1120',
                                                    border: isTop ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                                    boxShadow: isTop ? '0 0 30px rgba(255,215,0,0.12), 0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.25)',
                                                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s, border-color 0.25s',
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                                    if (!isTop) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                                                    e.currentTarget.style.boxShadow = isTop
                                                        ? '0 0 40px rgba(255,215,0,0.2), 0 14px 32px rgba(0,0,0,0.5)'
                                                        : '0 14px 32px rgba(0,0,0,0.4)';
                                                    const overlay = e.currentTarget.querySelector('[data-play-overlay]') as HTMLElement;
                                                    if (overlay) overlay.style.opacity = '1';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.transform = '';
                                                    if (!isTop) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                                    e.currentTarget.style.boxShadow = isTop
                                                        ? '0 0 30px rgba(255,215,0,0.12), 0 8px 24px rgba(0,0,0,0.4)'
                                                        : '0 4px 12px rgba(0,0,0,0.25)';
                                                    const overlay = e.currentTarget.querySelector('[data-play-overlay]') as HTMLElement;
                                                    if (overlay && !isPlaying) overlay.style.opacity = '0';
                                                }}
                                            >
                                                {/* Cover with overlays */}
                                                <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#1a2234' }}>
                                                    {track.coverUrl
                                                        ? <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FujiLogo size={42} color={colors.primary} opacity={0.25} /></div>
                                                    }

                                                    {/* Vignette for legibility */}
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />

                                                    {/* Massive rank number â€” outlined chrome */}
                                                    <div style={{
                                                        position: 'absolute', bottom: '-8px', left: '6px',
                                                        fontSize: isTop ? (isMobile ? '92px' : '120px') : (isMobile ? '76px' : '96px'),
                                                        fontWeight: 900, lineHeight: 1,
                                                        color: 'transparent',
                                                        WebkitTextStroke: isTop ? '2px #FFD700' : '2px rgba(255,255,255,0.85)',
                                                        textShadow: isTop ? '0 4px 24px rgba(255,215,0,0.5)' : '0 4px 18px rgba(0,0,0,0.6)',
                                                        fontStyle: 'italic',
                                                        letterSpacing: '-0.05em',
                                                        pointerEvents: 'none',
                                                        fontFamily: '"SF Pro Display", -apple-system, system-ui, sans-serif',
                                                    }}>{entry.position}</div>

                                                    {/* Movement badge â€” top-right */}
                                                    <div style={{
                                                        position: 'absolute', top: '10px', right: '10px',
                                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                        padding: move.label ? '4px 8px' : '4px 6px',
                                                        borderRadius: '999px',
                                                        background: move.bg,
                                                        border: `1px solid ${move.border}`,
                                                        color: move.color,
                                                        fontSize: '10px',
                                                        fontWeight: 800,
                                                        letterSpacing: '0.05em',
                                                        backdropFilter: 'blur(8px)',
                                                    }}>
                                                        {move.icon}
                                                        {move.label && <span>{move.label}</span>}
                                                    </div>

                                                    {/* Crown for #1 */}
                                                    {isTop && (
                                                        <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '5px 10px', borderRadius: '999px', background: 'linear-gradient(135deg, #B8860B, #FFD700)', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(255,215,0,0.4)' }}>
                                                            <Crown size={11} color="white" fill="white" />
                                                            <span style={{ fontSize: '10px', fontWeight: 900, color: 'white', letterSpacing: '0.08em' }}>TOP</span>
                                                        </div>
                                                    )}

                                                    {/* Play overlay (centered) */}
                                                    <div
                                                        data-play-overlay
                                                        style={{
                                                            position: 'absolute', inset: 0,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            opacity: isPlaying ? 1 : 0,
                                                            transition: 'opacity 0.2s',
                                                            pointerEvents: 'none',
                                                        }}>
                                                        <div style={{
                                                            width: '52px', height: '52px', borderRadius: '50%',
                                                            background: isTop ? '#FFD700' : colors.primary,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            boxShadow: isTop ? '0 8px 22px rgba(255,215,0,0.55)' : `0 8px 22px ${colors.primary}88`,
                                                        }}>
                                                            {isPlaying
                                                                ? <Pause size={20} fill="#0B1120" color="#0B1120" />
                                                                : <Play size={20} fill="#0B1120" color="#0B1120" style={{ marginLeft: '2px' }} />
                                                            }
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Track meta â€” clean strip */}
                                                <div style={{ padding: '12px 14px 14px' }}>
                                                    <div style={{ fontWeight: 800, fontSize: '14px', color: isPlaying ? colors.primary : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>{track.title}</div>
                                                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        <StyledUsername userId={track.profile.userId} showBadge={false}>{track.profile.displayName || track.profile.username}</StyledUsername>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <Flame size={11} color="#FF8C00" fill="#FF8C00" />
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF8C00', fontVariantNumeric: 'tabular-nums' }}>{(entry.playsInPeriod || 0).toLocaleString()}</span>
                                                        <span style={{ fontSize: '10px', color: colors.textTertiary, marginLeft: '2px' }}>plays</span>
                                                        {entry.prevPosition != null && (
                                                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: colors.textTertiary }}>was #{entry.prevPosition}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>


                </div>
            </div>
        </DiscoveryLayout>
    );
};
