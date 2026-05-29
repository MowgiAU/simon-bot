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
import { appendSponsorRef, trackSponsorClick } from '../lib/sponsorUtils';

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
    globalSponsors?: { id: string; name: string; logoUrl: string | null; websiteUrl: string | null; links: { id: string; url: string; label: string }[] }[];
    globalSponsorTitle?: string | null;
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
            const [profilesRes, tracksRes, chartRes, featuredRes, playlistsRes, articleRes, h2hRes, profileCountRes] = await Promise.all([
                axios.get('/api/musician/profiles'),
                axios.get('/api/musician/leaderboards/tracks', { params: { limit: 12 } }),
                axios.get('/api/charts/weekly', { params: { limit: 10 } }),
                axios.get('/api/discovery/settings').catch(() => ({ data: null })),
                axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
                axios.get('/api/articles/featured/current').catch(() => ({ data: null })),
                axios.get('/api/head-to-head/leaderboard?limit=1').catch(() => ({ data: [] })),
                axios.get('/api/musician/profiles/count').catch(() => ({ data: { count: 0 } })),
            ]);
            return {
                artists: ([...profilesRes.data] as ArtistProfile[]).sort((a, b) => (b.totalPlays || 0) - (a.totalPlays || 0)),
                profileCount: (profileCountRes.data?.count || 0) as number,
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

                    {/* ROW 1: BATTLE HERO / FEATURED TRACK */}

                    {/* Battle — big hero card (span 3) */}
                    {(() => {
                        const battle = featured?.featuredBattle;
                        const battleDesc = featured?.featuredBattleDescription;
                        const bgImg = battle?.bannerUrl || battle?.cardImageUrl;
                        const statusColor = battle?.status === 'voting' ? '#FBBF24' : battle?.status === 'active' ? '#34D399' : battle?.status === 'completed' ? '#94A3B8' : '#60A5FA';
                        const statusBg = battle?.status === 'voting' ? 'rgba(251,191,36,0.22)' : battle?.status === 'active' ? 'rgba(52,211,153,0.22)' : battle?.status === 'completed' ? 'rgba(100,116,139,0.22)' : 'rgba(96,165,250,0.22)';
                        const statusLabel = battle?.status === 'voting' ? 'VOTING' : battle?.status === 'active' ? 'LIVE' : battle?.status === 'completed' ? 'ENDED' : 'UPCOMING';
                        return (
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '300px' : undefined, overflow: 'hidden', gridColumn: isMobile ? undefined : 'span 3', padding: 0, position: 'relative' }}>

                        {/* Banner image — top of card, fades into content */}
                        {bgImg && (
                            <>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: isMobile ? '200px' : '240px', backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: isMobile ? '200px' : '240px', background: 'linear-gradient(to bottom, rgba(10,13,24,0.15) 0%, rgba(10,13,24,0.6) 55%, rgba(10,13,24,1) 100%)' }} />
                            </>
                        )}
                        {!bgImg && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(10,13,24,0.98) 0%, ${colors.primary}18 100%)` }} />}
                        <div style={{ position: 'absolute', top: isMobile ? '200px' : '240px', bottom: 0, left: 0, right: 0, background: 'rgba(10,13,24,0.98)' }} />

                        {/* Content */}
                        <div style={{
                            position: 'relative',
                            height: isMobile ? 'auto' : '100%',
                            padding: isMobile ? '16px 20px 20px' : '18px 28px 22px',
                            paddingTop: isMobile && bgImg ? '170px' : undefined,
                            display: 'flex', flexDirection: 'column', justifyContent: isMobile ? 'flex-start' : 'space-between',
                            gap: isMobile ? '12px' : undefined,
                            boxSizing: 'border-box' as const,
                        }}>
                            {/* Status badges when no banner image */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: colors.primary, background: `${colors.primary}25`, padding: '4px 10px', borderRadius: '4px', backdropFilter: 'blur(8px)' }}>
                                    <Swords size={10} />Featured Battle
                                </span>
                                {battle && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', backgroundColor: statusBg, color: statusColor, fontSize: '10px', fontWeight: 700, borderRadius: '999px', letterSpacing: '0.07em', backdropFilter: 'blur(8px)' }}>
                                        <span className={battle.status === 'active' ? 'new-drops-pulse' : undefined} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 }} />
                                        {statusLabel}
                                    </span>
                                )}
                            </div>

                            {battle ? (
                                <div style={{ flex: isMobile ? undefined : 1, display: 'flex', flexDirection: 'column', justifyContent: isMobile ? 'flex-start' : 'flex-end', gap: '8px', paddingBottom: isMobile ? '0' : '8px' }}>
                                    <Link to={`/battles/${battle.id}`} style={{ textDecoration: 'none' }}>
                                        <h2
                                            style={{ fontSize: isMobile ? '22px' : '30px', fontWeight: 900, margin: '0 0 6px', lineHeight: 1.1, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                        >{battle.title}</h2>
                                    </Link>
                                    {battleDesc && (
                                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 8px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{battleDesc}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' as const }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                            <Users size={12} />{battle._count?.entries ?? 0} {(battle._count?.entries ?? 0) === 1 ? 'entry' : 'entries'}
                                        </span>
                                        {battle.status === 'voting' && battle.votingEnd && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#FBBF24' }}>
                                                <Timer size={12} />Voting closes {new Date(battle.votingEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                        {battle.status === 'active' && battle.submissionEnd && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#34D399' }}>
                                                <Timer size={12} />Submissions close {new Date(battle.submissionEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    {battle.prizes && battle.prizes.length > 0 && (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                            {battle.prizes.slice(0, 3).map((p, i) => (
                                                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.07)', borderRadius: '6px', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <span>{i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : '\u{1F949}'}</span>
                                                    {p.title ? <span style={{ color: colors.primary, fontWeight: 700 }}>{p.title}</span> : <span>{p.description}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <Swords size={40} color={colors.textSecondary} style={{ opacity: 0.15, marginBottom: '12px' }} />
                                    <p style={{ fontSize: '16px', color: colors.textSecondary, margin: '0 0 6px' }}>No battle running right now</p>
                                    <Link to="/battles" style={{ fontSize: '13px', color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>View past battles →</Link>
                                </div>
                            )}

                            {battle && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '10px', marginTop: '10px' }}>
                                    {battle.sponsor ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                                            {battle.sponsor.logoUrl && <img src={battle.sponsor.logoUrl} alt="" style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'contain' }} />}
                                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Sponsored by <strong style={{ color: 'white' }}>{battle.sponsor.name}</strong></span>
                                        </div>
                                    ) : <div />}
                                    <Link to={`/battles/${battle.id}`} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                                        fontSize: '13px', fontWeight: 700, textDecoration: 'none', color: 'white',
                                        backgroundColor: battle.status === 'voting' ? '#FBBF24' : battle.status === 'completed' ? 'rgba(100,116,139,0.6)' : colors.primary,
                                        padding: '11px 22px', borderRadius: '8px',
                                        boxShadow: battle.status === 'voting' ? '0 4px 20px rgba(251,191,36,0.4)' : battle.status === 'completed' ? 'none' : `0 4px 20px ${colors.primary}55`,
                                    }}>
                                        {battle.status === 'voting' ? <><Trophy size={14} /> Vote Now</> : battle.status === 'active' ? <><Swords size={14} /> Submit a Beat</> : battle.status === 'completed' ? 'View Results →' : 'View Battle →'}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                        );
                    })()}

                    {/* Featured Track/Artist/Playlist — compact card (span 1) */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '220px' : undefined, position: 'relative', overflow: 'hidden', padding: 0 }}>
                        {heroCover && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: heroCover
                            ? 'linear-gradient(to bottom, rgba(10,13,24,0.3) 0%, rgba(10,13,24,0.5) 35%, rgba(10,13,24,0.96) 100%)'
                            : 'rgba(10,13,24,0.98)'
                        }} />

                        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '18px', boxSizing: 'border-box' as const }}>
                            <div>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: colors.primary, background: `${colors.primary}25`, padding: '4px 10px', borderRadius: '4px', backdropFilter: 'blur(8px)' }}>
                                    {heroType === 'artist' ? <Mic2 size={10} /> : heroType === 'playlist' ? <ListMusic size={10} /> : <Sparkles size={10} />}
                                    {heroLabel}
                                </span>
                            </div>

                            <div>
                                {heroType !== 'track' && heroTrackList.length > 0 && (
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
                                        {heroTrackList.slice(0, 3).map((t, i) => (
                                            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(6px)', borderRadius: '5px', padding: '3px 7px 3px 4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                {t.coverUrl && <div style={{ width: '16px', height: '16px', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}><img src={t.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                                                <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' as const, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.8)' }}>{t.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px', lineHeight: 1.15, color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                    {heroType === 'track' && heroTrack ? (
                                        <Link to={`/track/${heroTrack.profile.username}/${heroTrack.slug || heroTrack.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >{heroTitle}</Link>
                                    ) : heroType === 'artist' && heroArtist ? (
                                        <Link to={`/profile/${heroArtist.username}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >{heroTitle}</Link>
                                    ) : heroType === 'playlist' && heroPlaylist ? (
                                        <Link to={`/playlists/${heroPlaylist.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >{heroTitle}</Link>
                                    ) : heroTitle}
                                </h3>
                                {heroSubtitle && (
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {heroType === 'track' && heroTrack ? (
                                            <Link to={`/profile/${heroTrack.profile.username}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                            >{heroSubtitle}</Link>
                                        ) : heroType === 'playlist' && heroPlaylist?.profile ? (
                                            <Link to={`/profile/${heroPlaylist.profile.username}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                            >{heroSubtitle}</Link>
                                        ) : heroSubtitle}
                                    </div>
                                )}
                                {(() => {
                                    const desc = featured?.featuredDescription
                                        || (heroType === 'artist' ? (heroArtist as any)?.bio : null)
                                        || (heroType === 'track' ? heroTrack?.description : null)
                                        || (heroType === 'playlist' ? heroPlaylist?.description : null);
                                    return desc ? (
                                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.55, margin: '0 0 12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                            {desc}
                                        </p>
                                    ) : null;
                                })()}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {heroType === 'artist' && heroArtist && (
                                        <Link to={`/profile/${heroArtist.username}`} style={{
                                            flex: 1, backgroundColor: colors.primary, color: 'white', padding: '10px 14px',
                                            borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            boxShadow: `0 4px 16px ${colors.primary}50`,
                                        }}>
                                            <Mic2 size={13} /> Explore
                                        </Link>
                                    )}
                                    <button onClick={handleHeroPlay} style={{
                                        flex: 1,
                                        backgroundColor: heroType === 'artist' ? 'rgba(255,255,255,0.1)' : colors.primary,
                                        color: 'white', padding: '10px 14px', borderRadius: '8px',
                                        border: heroType === 'artist' ? '1px solid rgba(255,255,255,0.15)' : 'none',
                                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        boxShadow: heroType === 'artist' ? 'none' : `0 4px 16px ${colors.primary}50`,
                                    }}>
                                        {isHeroPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                                        {isHeroPlaying ? 'Pause' : 'Play'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* ROW 2: 4-card strip */}
                    <div style={{
                        gridColumn: '1 / -1',
                        ...(isMobile ? {
                            display: 'flex' as const,
                            overflowX: 'auto' as const,
                            gap: '12px',
                            paddingBottom: '4px',
                            scrollSnapType: 'x mandatory' as const,
                        } : {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '18px',
                        }),
                    }}>

                        {/* CARD 1: Trending Artist */}
                        {(() => {
                            const trendingArtist = (featured as any)?.trendingArtistOverride ?? artists[0] ?? null;
                            const avatarUrl = trendingArtist ? getAvatarUrl(trendingArtist.avatar, trendingArtist.userId) : '';
                            return (
                                <div style={{
                                    ...panel,
                                    height: '300px',
                                    position: 'relative', overflow: 'hidden', padding: 0,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    ...(isMobile ? { flexShrink: 0, width: '260px', scrollSnapAlign: 'start' as const } : {}),
                                }}>
                                    {trendingArtist ? (
                                        <>
                                            {/* Blurred color wash — full card */}
                                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(28px) brightness(0.18) saturate(2)', transform: 'scale(1.25)', pointerEvents: 'none' }} />
                                            {/* Sharp avatar — top 62% */}
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '62%', backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center top' }} />
                                            {/* Gradient fade — avatar into dark */}
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 28%, rgba(10,13,24,0.55) 48%, rgba(10,13,24,0.97) 68%, rgba(10,13,24,1) 100%)', pointerEvents: 'none' }} />
                                            {/* Rainbow top edge */}
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `conic-gradient(from 90deg at 50% 50%, ${colors.primary}, #a78bfa, #FBBF24, #F472B6, ${colors.primary})`, opacity: 0.85, pointerEvents: 'none' }} />

                                            {/* #1 badge — top-left */}
                                            <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px', background: 'linear-gradient(135deg, #92650a, #FFD700)', boxShadow: '0 4px 14px rgba(255,215,0,0.45)', backdropFilter: 'blur(4px)' }}>
                                                <Crown size={10} color="white" fill="white" />
                                                <span style={{ fontSize: '9px', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>#1</span>
                                            </div>

                                            {/* Bottom content overlay */}
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px 16px', zIndex: 1 }}>
                                                {/* Label */}
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(251,191,36,0.2)', backdropFilter: 'blur(8px)', marginBottom: '6px' }}>
                                                    <TrendingUp size={10} color="#FBBF24" />
                                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.13em', textTransform: 'uppercase' as const }}>Trending Artist</span>
                                                </div>
                                                {/* Name */}
                                                <Link to={`/profile/${trendingArtist.username}`} style={{ textDecoration: 'none' }}>
                                                    <div style={{ fontWeight: 900, fontSize: '20px', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginBottom: '6px' }}
                                                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                                    >
                                                        <StyledUsername userId={trendingArtist.userId}>{trendingArtist.displayName || trendingArtist.username}</StyledUsername>
                                                    </div>
                                                </Link>
                                                {/* Genre pills */}
                                                <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
                                                    {trendingArtist.primaryGenre && (
                                                        <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '20px', background: `${colors.primary}30`, border: `1px solid ${colors.primary}60`, color: colors.primary }}>{trendingArtist.primaryGenre.name}</span>
                                                    )}
                                                    {!trendingArtist.primaryGenre && trendingArtist.genres?.slice(0, 2).map((g: any, i: number) => (
                                                        <span key={i} style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)' }}>{g.genre.name}</span>
                                                    ))}
                                                </div>
                                                {/* Plays + CTA */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                        <span style={{ fontSize: '17px', fontWeight: 900, color: colors.primary, lineHeight: 1, letterSpacing: '-0.02em' }}>
                                                            {trendingArtist.totalPlays >= 1000 ? `${(trendingArtist.totalPlays / 1000).toFixed(1)}k` : (trendingArtist.totalPlays || 0).toLocaleString()}
                                                        </span>
                                                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>plays</span>
                                                    </div>
                                                    <Link to={`/profile/${trendingArtist.username}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '999px', textDecoration: 'none', background: colors.primary, color: 'white', fontSize: '11px', fontWeight: 700, boxShadow: `0 4px 16px ${colors.primary}55` }}>View Profile</Link>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px' }}>
                                            <TrendingUp size={32} color={colors.textSecondary} style={{ opacity: 0.15 }} />
                                            <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No artists yet</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* CARD 2: 1v1 Arena */}
                        <div style={{
                            ...panel,
                            height: '300px',
                            position: 'relative', overflow: 'hidden', padding: 0,
                            border: '1px solid rgba(139,92,246,0.18)',
                            ...(isMobile ? { flexShrink: 0, width: '260px', scrollSnapAlign: 'start' as const } : {}),
                        }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a0f2e 0%, #2a0f3a 35%, #3d0f2e 70%, #2a0f1a 100%)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', top: '-30%', left: '-15%', width: '70%', height: '90%', background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, transparent 65%)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', bottom: '-25%', right: '-10%', width: '60%', height: '85%', background: 'radial-gradient(ellipse, rgba(236,72,153,0.22) 0%, transparent 65%)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)', pointerEvents: 'none' }} />
                            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '18px', boxSizing: 'border-box', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(236,72,153,0.2)', backdropFilter: 'blur(8px)' }}>
                                        <Swords size={10} color="#EC4899" />
                                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#EC4899', letterSpacing: '0.13em', textTransform: 'uppercase' as const }}>1v1 Arena</span>
                                    </div>
                                    <span style={{ fontSize: '8px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', background: 'rgba(52,211,153,0.18)', color: '#34D399', letterSpacing: '0.1em', border: '1px solid rgba(52,211,153,0.3)' }}>NEW</span>
                                </div>
                                <div style={{ fontWeight: 900, fontSize: '24px', color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                                    Producer<br/>vs Producer
                                </div>
                                <p style={{ fontSize: '12px', color: 'rgba(220,220,240,0.65)', margin: 0, lineHeight: 1.5, flex: 1 }}>
                                    Get matched. Build a beat from a sample pack. Anonymous voters pick the winner.
                                </p>
                                {h2hChampion && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.25)' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(251,191,36,0.5)' }}>
                                            {h2hChampion.profile?.avatar
                                                ? <img src={getAvatarUrl(h2hChampion.profile.avatar, h2hChampion.userId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }} />
                                                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: 'white' }}>{(h2hChampion.profile?.displayName || h2hChampion.profile?.username || '?')[0].toUpperCase()}</div>
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '9px', color: '#FBBF24', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Reigning Champ</div>
                                            <div style={{ fontSize: '12px', color: '#fff', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{h2hChampion.profile?.displayName || h2hChampion.profile?.username || 'Anonymous'}</div>
                                        </div>
                                        <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
                                            <div style={{ fontSize: '14px', fontWeight: 900, color: '#FBBF24' }}>{h2hChampion.elo}</div>
                                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>ELO</div>
                                        </div>
                                    </div>
                                )}
                                <Link to="/arena" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px 0', borderRadius: '999px', textDecoration: 'none', background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 4px 16px rgba(139,92,246,0.44)' }}>
                                    <Swords size={13} /> Enter the Arena
                                </Link>
                            </div>
                        </div>

                        {/* CARD 3: Featured Content (compact poster) */}
                        {(() => {
                            const contentType = featured?.featuredContentType || 'video';
                            const typeConfig: Record<string, { icon: React.ReactNode; label: string; accentColor: string }> = {
                                video:   { icon: <MonitorPlay size={12} />, label: 'Featured Video',   accentColor: colors.primary },
                                news:    { icon: <Newspaper size={12} />,   label: 'Featured News',    accentColor: '#A78BFA' },
                                guide:   { icon: <BookOpen size={12} />,    label: 'Featured Guide',   accentColor: '#FBBF24' },
                                article: { icon: <FileText size={12} />,    label: 'Featured Article', accentColor: '#34D399' },
                            };
                            const tc = typeConfig[contentType] ?? typeConfig.video;
                            const thumbnail = contentType === 'video'
                                ? (featured?.featuredTutorialThumbnail || getTutorialThumbnail())
                                : featuredArticle?.coverImageUrl;
                            const title = contentType === 'video'
                                ? (featured?.featuredTutorialTitle || 'Watch Tutorial')
                                : (featuredArticle?.title || '');
                            const description = contentType === 'video'
                                ? (featured?.featuredTutorialDescription || null)
                                : (featuredArticle?.excerpt || null);
                            const href = contentType === 'video'
                                ? (featured?.featuredTutorialUrl ?? null)
                                : (featuredArticle?.slug ? `/article/${featuredArticle.slug}` : null);
                            return (
                                <div style={{
                                    ...panel,
                                    height: '300px',
                                    position: 'relative', overflow: 'hidden', padding: 0,
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    ...(isMobile ? { flexShrink: 0, width: '260px', scrollSnapAlign: 'start' as const } : {}),
                                }}>
                                    {thumbnail && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                                    {!thumbnail && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${tc.accentColor}18 0%, transparent 65%), #0f172a` }} />}
                                    {/* Stronger overlay so text is always legible */}
                                    <div style={{ position: 'absolute', inset: 0, background: thumbnail ? 'linear-gradient(to bottom, rgba(10,13,24,0.35) 0%, rgba(10,13,24,0.65) 38%, rgba(10,13,24,0.97) 68%, rgba(10,13,24,1) 100%)' : 'rgba(10,13,24,0.15)', pointerEvents: 'none' }} />
                                    <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box' }}>
                                        {/* Type label */}
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', background: `${tc.accentColor}25`, backdropFilter: 'blur(8px)', width: 'fit-content' }}>
                                            <span style={{ color: tc.accentColor, display: 'flex', alignItems: 'center' }}>{tc.icon}</span>
                                            <span style={{ fontSize: '9px', fontWeight: 800, color: tc.accentColor, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>{tc.label}</span>
                                        </div>
                                        <div style={{ flex: 1 }} />
                                        {title ? (
                                            <>
                                                <div style={{ fontWeight: 900, fontSize: '15px', color: '#fff', lineHeight: 1.3, marginBottom: description ? '6px' : '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>{title}</div>
                                                {description && (
                                                    <div style={{ fontSize: '11px', color: 'rgba(185,195,210,0.78)', lineHeight: 1.55, marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{description}</div>
                                                )}
                                                {href && (
                                                    contentType === 'video' ? (
                                                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 0', borderRadius: '8px', textDecoration: 'none', background: tc.accentColor, color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: `0 4px 14px ${tc.accentColor}44` }}>
                                                            <ExternalLink size={12} /> Watch Now
                                                        </a>
                                                    ) : (
                                                        <Link to={href} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 0', borderRadius: '8px', textDecoration: 'none', background: tc.accentColor, color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: `0 4px 14px ${tc.accentColor}44` }}>
                                                            Read Article
                                                        </Link>
                                                    )
                                                )}
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center' as const, paddingBottom: '8px' }}>
                                                <p style={{ fontSize: '11px', color: colors.textSecondary, margin: 0 }}>No content set</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* CARD 4: Get Started / Share Your Music */}
                        {(() => {
                            const hasProfile = !!(user?.profileUsername);
                            const isLoggedIn = !!user;
                            let actionConfig: { label: string; sublabel: string; icon: React.ReactNode; link: string; bgGradient: string; accentColor: string; buttonText: string };
                            if (!isLoggedIn) {
                                actionConfig = { label: 'Join Fuji Studio', sublabel: 'Start your music journey', icon: <UserPlus size={18} />, link: '/login', bgGradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', accentColor: '#60A5FA', buttonText: 'Create Account' };
                            } else if (!hasProfile) {
                                actionConfig = { label: 'Artist Profile', sublabel: 'Showcase your music', icon: <UserPlus size={18} />, link: '/profile/setup', bgGradient: 'linear-gradient(135deg, #451a03 0%, #1e1b4b 100%)', accentColor: '#FBBF24', buttonText: 'Start Setup' };
                            } else {
                                actionConfig = { label: 'Share Your Music', sublabel: 'Get discovered', icon: <Upload size={18} />, link: '/my-tracks', bgGradient: 'linear-gradient(135deg, #14532d 0%, #0f172a 100%)', accentColor: '#34D399', buttonText: 'Upload Track' };
                            }
                            return (
                                <div style={{
                                    ...panel,
                                    height: '300px',
                                    position: 'relative', overflow: 'hidden', padding: 0,
                                    border: `1px solid ${actionConfig.accentColor}28`,
                                    boxSizing: 'border-box',
                                    ...(isMobile ? { flexShrink: 0, width: '260px', scrollSnapAlign: 'start' as const } : {}),
                                }}>
                                    <div style={{ position: 'absolute', inset: 0, background: actionConfig.bgGradient, pointerEvents: 'none' }} />
                                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.07, pointerEvents: 'none' }}>
                                        {React.cloneElement(actionConfig.icon as React.ReactElement, { size: 130 })}
                                    </div>
                                    <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: '55%', height: '80%', background: `radial-gradient(ellipse, ${actionConfig.accentColor}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
                                    <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '18px', boxSizing: 'border-box', gap: '10px' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: `${actionConfig.accentColor}18`, border: `1px solid ${actionConfig.accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {React.cloneElement(actionConfig.icon as React.ReactElement, { size: 22, color: actionConfig.accentColor })}
                                        </div>
                                        <div>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', background: `${actionConfig.accentColor}28`, backdropFilter: 'blur(8px)', marginBottom: '6px' }}>
                                                {React.cloneElement(actionConfig.icon as React.ReactElement, { size: 10, color: actionConfig.accentColor })}
                                                <span style={{ fontSize: '9px', fontWeight: 800, color: actionConfig.accentColor, letterSpacing: '0.13em', textTransform: 'uppercase' as const }}>{actionConfig.label}</span>
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: 900, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{actionConfig.sublabel}</div>
                                        </div>
                                        <p style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.55, margin: 0, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                            {!isLoggedIn
                                                ? `Join ${Math.floor((discoveryData?.profileCount || artists.length || 0) / 25) * 25}+ producers already sharing their music.`
                                                : !hasProfile
                                                ? 'Your profile is your stage. Get discovered by listeners and other producers.'
                                                : `${Math.floor((discoveryData?.profileCount || artists.length || 0) / 25) * 25}+ producers in the community — add your music.`}
                                        </p>
                                        <Link to={actionConfig.link} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 0', borderRadius: '999px', textDecoration: 'none', background: actionConfig.accentColor, color: !isLoggedIn ? '#0f172a' : 'white', fontSize: '12px', fontWeight: 700, boxShadow: `0 4px 14px ${actionConfig.accentColor}44` }}>
                                            {isLoggedIn ? <Upload size={12} /> : <LogIn size={12} />}
                                            {actionConfig.buttonText}
                                        </Link>
                                    </div>
                                </div>
                            );
                        })()}

                    </div>

                    {/* Discord Community CTA — full-width strip */}
                    <div style={{
                        gridColumn: isMobile ? undefined : '1 / -1',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: '16px',
                        border: '1px solid rgba(88,101,242,0.3)',
                    }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1e1f3a 0%, #2a1a4a 50%, #1a1f3a 100%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', top: '-40%', left: '-5%', width: '40%', height: '180%', background: 'radial-gradient(ellipse, rgba(88,101,242,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: '-40%', right: '5%', width: '30%', height: '160%', background: 'radial-gradient(ellipse, rgba(114,137,218,0.15) 0%, transparent 65%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: isMobile ? '-10px' : '20px', top: '50%', transform: 'translateY(-50%)', opacity: 0.05, pointerEvents: 'none' }}>
                            <svg width="160" height="120" viewBox="0 0 71 55" fill="white">
                                <path d="M60.1 4.9A58.5 58.5 0 0 0 45.3.7a40.5 40.5 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0A39.1 39.1 0 0 0 25.4.7 58.4 58.4 0 0 0 10.5 4.9C1.5 18.7-1 32.2.3 45.5a58.9 58.9 0 0 0 17.9 9.1 42.5 42.5 0 0 0 3.7-6 38.3 38.3 0 0 1-5.8-2.8c.5-.4 1-.7 1.4-1.1a41.9 41.9 0 0 0 35.8 0c.5.4 1 .8 1.4 1.1a38.4 38.4 0 0 1-5.8 2.8 42.3 42.3 0 0 0 3.7 6 58.7 58.7 0 0 0 17.9-9.1C72 30.2 68.1 16.8 60.1 4.9ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2Z"/>
                            </svg>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', padding: isMobile ? '22px 20px' : '22px 32px', gap: isMobile ? '16px' : '24px', boxSizing: 'border-box' as const }}>
                            <div style={{ flexShrink: 0, width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(88,101,242,0.2)', border: '1px solid rgba(88,101,242,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(88,101,242,0.25)' }}>
                                <svg width="26" height="20" viewBox="0 0 71 55" fill="#5865F2">
                                    <path d="M60.1 4.9A58.5 58.5 0 0 0 45.3.7a40.5 40.5 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0A39.1 39.1 0 0 0 25.4.7 58.4 58.4 0 0 0 10.5 4.9C1.5 18.7-1 32.2.3 45.5a58.9 58.9 0 0 0 17.9 9.1 42.5 42.5 0 0 0 3.7-6 38.3 38.3 0 0 1-5.8-2.8c.5-.4 1-.7 1.4-1.1a41.9 41.9 0 0 0 35.8 0c.5.4 1 .8 1.4 1.1a38.4 38.4 0 0 1-5.8 2.8 42.3 42.3 0 0 0 3.7 6 58.7 58.7 0 0 0 17.9-9.1C72 30.2 68.1 16.8 60.1 4.9ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2Z"/>
                                </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: '#7289DA', letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Community</div>
                                <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 900, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '4px' }}>
                                    Join 50,000+ FL Studio producers on Discord
                                </div>
                                <div style={{ fontSize: '12px', color: 'rgba(185,195,210,0.65)', lineHeight: 1.5 }}>
                                    Share beats, get feedback, enter battles, and connect with the community.
                                </div>
                            </div>
                            <a
                                href="https://discord.gg/flstudio"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    flexShrink: 0,
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    padding: '11px 24px', borderRadius: '999px', textDecoration: 'none',
                                    background: '#5865F2', color: 'white',
                                    fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em',
                                    boxShadow: '0 4px 18px rgba(88,101,242,0.45)',
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                    whiteSpace: 'nowrap' as const,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(88,101,242,0.65)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(88,101,242,0.45)'; }}
                            >
                                <svg width="16" height="12" viewBox="0 0 71 55" fill="white">
                                    <path d="M60.1 4.9A58.5 58.5 0 0 0 45.3.7a40.5 40.5 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0A39.1 39.1 0 0 0 25.4.7 58.4 58.4 0 0 0 10.5 4.9C1.5 18.7-1 32.2.3 45.5a58.9 58.9 0 0 0 17.9 9.1 42.5 42.5 0 0 0 3.7-6 38.3 38.3 0 0 1-5.8-2.8c.5-.4 1-.7 1.4-1.1a41.9 41.9 0 0 0 35.8 0c.5.4 1 .8 1.4 1.1a38.4 38.4 0 0 1-5.8 2.8 42.3 42.3 0 0 0 3.7 6 58.7 58.7 0 0 0 17.9-9.1C72 30.2 68.1 16.8 60.1 4.9ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2Z"/>
                                </svg>
                                Join Discord
                            </a>
                        </div>
                    </div>

               {/* ── Brand Partners Strip ── */}
                    {featured?.globalSponsors && featured.globalSponsors.length > 0 && (
                        <div style={{ gridColumn: isMobile ? undefined : '1 / -1', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
                            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${colors.primary}06 0%, ${colors.primary}10 50%, ${colors.primary}06 100%)`, pointerEvents: 'none' }} />
                            <div style={{ border: `1px solid ${colors.primary}20`, borderRadius: '16px', padding: isMobile ? '16px' : '20px 32px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '20px' : '40px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <div style={{ width: '2px', height: '18px', backgroundColor: colors.primary, borderRadius: '1px' }} />
                                        <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: colors.primary, whiteSpace: 'nowrap' }}>
                                            {featured.globalSponsorTitle || 'Our Partners'}
                                        </span>
                                    </div>
                                    {featured.globalSponsors.map((s: any) => {
                                        const href = appendSponsorRef(s.websiteUrl, '/');
                                        const inner = (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                {s.logoUrl
                                                    ? <img src={s.logoUrl} alt={s.name} style={{ height: '32px', maxWidth: '120px', objectFit: 'contain' }} />
                                                    : <span style={{ fontWeight: 800, fontSize: '14px', color: '#fff', letterSpacing: '0.04em' }}>{s.name}</span>
                                                }
                                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>{s.name}</span>
                                            </div>
                                        );
                                        const wrapStyle: React.CSSProperties = { textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '10px 20px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', transition: 'all 0.2s' };
                                        return href !== '#' ? (
                                            <a key={s.id} href={href} target="_blank" rel="noopener noreferrer"
                                                onClick={() => trackSponsorClick(s.id, 'discover')}
                                                style={wrapStyle}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.11)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
                                            >{inner}</a>
                                        ) : (
                                            <div key={s.id} style={wrapStyle}>{inner}</div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts card */}
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
