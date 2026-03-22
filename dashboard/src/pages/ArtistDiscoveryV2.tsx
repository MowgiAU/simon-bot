import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    Play, Plus, Pause, TrendingUp, Swords,
    Activity, Trophy, Users, Timer, ListMusic,
    Star, MonitorPlay, Newspaper, BookOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';

interface ArtistProfile {
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    hardware: string[];
    genres: { genre: { name: string } }[];
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
        out.push(18 + (h % 72)); // 18–89 — percentage of container height
    }
    return out;
}

export const ArtistDiscoveryV2Page: React.FC = () => {
    const [artists, setArtists] = useState<ArtistProfile[]>([]);
    const [topTracks, setTopTracks] = useState<TrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [featured, setFeatured] = useState<FeaturedData | null>(null);
    const [popularPlaylists, setPopularPlaylists] = useState<PopularPlaylist[]>([]);
    const { player, setTrack, togglePlay } = usePlayer();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        axios.get('/api/discovery/settings').then(r => setFeatured(r.data)).catch(() => {});
        axios.get('/api/playlists/popular').then(r => setPopularPlaylists(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [profilesRes, tracksRes] = await Promise.all([
                    axios.get('/api/musician/profiles'),
                    axios.get('/api/musician/leaderboards/tracks', { params: { limit: 12 } })
                ]);
                setArtists([...profilesRes.data].sort((a: ArtistProfile, b: ArtistProfile) => (b.totalPlays || 0) - (a.totalPlays || 0)));
                setTopTracks(tracksRes.data);
            } catch (err) {
                console.error('Failed to fetch', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // ── Helpers ──
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
    const heroSubtitle = heroType === 'artist' ? '' : heroType === 'playlist' ? (heroPlaylist?.profile?.displayName || heroPlaylist?.profile?.username || '') : (heroTrack?.profile.displayName || heroTrack?.profile.username || '');

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

    const isHeroPlaying = heroType === 'track' && heroTrack && player.currentTrack?.id === heroTrack.id && player.isPlaying;

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
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: '18px',
                }}>

                    {/* ═══════════════ ROW 1: HERO / BATTLE / ARTISTS ═══════════════ */}

                    {/* Hero/Featured */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '320px' : undefined, position: 'relative', overflow: 'hidden', gridColumn: isMobile ? undefined : 'span 2', padding: 0 }}>
                        {/* Full-bleed background image */}
                        {heroCover && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        )}
                        {/* Dark gradient overlay — heavier on left for text legibility */}
                        <div style={{ position: 'absolute', inset: 0, background: heroCover
                            ? 'linear-gradient(to right, rgba(14,18,26,0.97) 30%, rgba(14,18,26,0.6) 65%, rgba(14,18,26,0.25) 100%), linear-gradient(to top, rgba(14,18,26,0.6) 0%, transparent 50%)'
                            : 'rgba(14,18,26,0.98)'
                        }} />

                        {/* Cover art — floated to the right, vertically centred */}
                        {heroCover && !isMobile && (
                            <div style={{
                                position: 'absolute', right: '32px', top: '50%', transform: 'translateY(-50%)',
                                width: '190px', height: '190px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)',
                            }}>
                                <img src={heroCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}

                        {/* Main content — full height flex column, padded, right side offset to avoid cover art */}
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
                                {featured?.featuredDescription && (
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' as any }}>{featured.featuredDescription}</p>
                                )}
                            </div>

                            {/* Bottom: track strip + play button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
                                {/* Track pills — infinite marquee */}
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
                                {/* Play button */}
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
                            </div>
                        </div>
                    </div>

                    {/* Battle */}
                    {(() => {
                        const battle = featured?.featuredBattle;
                        const battleDesc = featured?.featuredBattleDescription;
                        return (
                    <div style={{ ...panel, padding: 0, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '320px' : undefined, position: 'relative', overflow: 'hidden' }}>
                        {/* Banner image — blurred background */}
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
                        <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', height: '100%', gap: '11px', boxSizing: 'border-box' }}>
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
                                        backgroundColor: battle.status === 'voting' ? 'rgba(251,191,36,0.22)' : battle.status === 'active' ? 'rgba(52,211,153,0.22)' : 'rgba(96,165,250,0.22)',
                                        color: battle.status === 'voting' ? '#FBBF24' : battle.status === 'active' ? '#34D399' : '#60A5FA',
                                        fontSize: '8px', fontWeight: 'bold', borderRadius: '999px', letterSpacing: '0.07em',
                                        backdropFilter: 'blur(6px)',
                                    }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 }} />
                                        {battle.status === 'voting' ? 'VOTING OPEN' : battle.status === 'active' ? 'OPEN' : 'UPCOMING'}
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
                                                style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', display: 'block' }}
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

                                    {/* Prizes — medal style */}
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
                                                color: battle.status === 'voting' ? '#FBBF24' : colors.primary,
                                                backgroundColor: battle.status === 'voting' ? 'rgba(251,191,36,0.18)' : `${colors.primary}25`,
                                                padding: '8px 16px', borderRadius: '8px',
                                                border: `1px solid ${battle.status === 'voting' ? 'rgba(251,191,36,0.4)' : `${colors.primary}45`}`,
                                                backdropFilter: 'blur(6px)',
                                            }}
                                        >
                                            {battle.status === 'voting'
                                                ? <><Trophy size={13} /> Vote Now &rarr;</>
                                                : battle.status === 'active'
                                                ? <><Swords size={13} /> Submit a Beat &rarr;</>
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

                    {/* ═══════════════ ROW 2: TRENDING ARTISTS / PLAYLISTS / TUTORIAL ═══════════════ */}

                    {/* Trending Artist */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '280px', position: 'relative', overflow: 'hidden', padding: 0, border: '1px solid rgba(255,255,255,0.07)' }}>
                        {artists[0] ? (
                            <>
                                {/* Full-bleed blurred background */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    backgroundImage: `url(${getAvatarUrl(artists[0].avatar, artists[0].userId)})`,
                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                    filter: 'blur(32px) brightness(0.35) saturate(1.4)',
                                    transform: 'scale(1.25)',
                                    pointerEvents: 'none',
                                }} />
                                {/* Gradient vignette — darker at bottom */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'linear-gradient(160deg, rgba(14,18,26,0.3) 0%, rgba(14,18,26,0.85) 70%, rgba(14,18,26,0.97) 100%)',
                                    pointerEvents: 'none',
                                }} />
                                {/* Rank badge — top left */}
                                <div style={{
                                    position: 'absolute', top: '14px', left: '14px',
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: '20px', padding: '4px 10px',
                                    backdropFilter: 'blur(8px)',
                                }}>
                                    <TrendingUp size={11} color="#FBBF24" />
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Trending</span>
                                </div>
                                {/* #1 crown — top right */}
                                <div style={{
                                    position: 'absolute', top: '12px', right: '14px',
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 12px rgba(245,158,11,0.4)',
                                }}>
                                    <span style={{ fontSize: '11px', fontWeight: 900, color: 'white' }}>#1</span>
                                </div>

                                {/* Main content */}
                                <Link to={`/profile/${artists[0].username}`} style={{ textDecoration: 'none', color: 'inherit', position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
                                    {/* Avatar — centered with glow ring */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '24px' }}>
                                        <div style={{ position: 'relative' }}>
                                            {/* Outer glow ring */}
                                            <div style={{
                                                position: 'absolute', inset: '-5px',
                                                borderRadius: '50%',
                                                background: `conic-gradient(${colors.primary}, #a78bfa, #FBBF24, ${colors.primary})`,
                                                opacity: 0.7,
                                                animation: undefined,
                                            }} />
                                            <div style={{
                                                position: 'absolute', inset: '-3px',
                                                borderRadius: '50%',
                                                background: 'rgba(14,18,26,0.6)',
                                            }} />
                                            <div style={{
                                                width: '76px', height: '76px', borderRadius: '50%', overflow: 'hidden',
                                                position: 'relative', zIndex: 1,
                                                boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
                                            }}>
                                                <img
                                                    src={getAvatarUrl(artists[0].avatar, artists[0].userId)}
                                                    alt={artists[0].displayName || artists[0].username}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Name + genres */}
                                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                                        <div style={{ fontWeight: 800, fontSize: '16px', color: colors.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: '4px' }}>
                                            {artists[0].displayName || artists[0].username}
                                        </div>
                                        {artists[0].genres?.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '10px' }}>
                                                {artists[0].genres.slice(0, 3).map((g, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        padding: '2px 8px', borderRadius: '20px',
                                                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: colors.textSecondary,
                                                    }}>{g.genre.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Stats + CTA */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)',
                                        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                                        padding: '8px 12px', marginTop: 'auto',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 800, color: colors.primary, lineHeight: 1 }}>
                                                {artists[0].totalPlays >= 1000
                                                    ? `${(artists[0].totalPlays / 1000).toFixed(1)}k`
                                                    : (artists[0].totalPlays || 0).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '9px', color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px' }}>Plays</div>
                                        </div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            padding: '6px 14px', borderRadius: '8px',
                                            background: `${colors.primary}22`, border: `1px solid ${colors.primary}44`,
                                            color: colors.primary, fontSize: '11px', fontWeight: 700,
                                        }}>
                                            View Profile →
                                        </div>
                                    </div>
                                </Link>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px' }}>
                                <TrendingUp size={32} color={colors.textSecondary} style={{ opacity: 0.15 }} />
                                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No artists yet</p>
                            </div>
                        )}
                    </div>

                    {/* Featured Content — 2 cols wide */}
                    {(() => {
                        const contentType = featured?.featuredContentType || 'video';
                        const typeConfig: Record<string, { icon: React.ReactNode; label: string; accentColor: string }> = {
                            video: { icon: <MonitorPlay size={13} />, label: 'Featured Video', accentColor: colors.primary },
                            news:  { icon: <Newspaper size={13} />,   label: 'Featured News',  accentColor: '#A78BFA' },
                            guide: { icon: <BookOpen size={13} />,    label: 'Featured Guide', accentColor: '#FBBF24' },
                        };
                        const tc = typeConfig[contentType] ?? typeConfig.video;
                        return (
                            <div style={{ ...panel, gridColumn: isMobile ? undefined : 'span 2', height: isMobile ? 'auto' : '280px', position: 'relative', overflow: 'hidden', padding: 0, border: '1px solid rgba(255,255,255,0.07)', boxSizing: 'border-box' }}>
                                {/* Blurred thumbnail/accent background */}
                                {contentType === 'video' && (featured?.featuredTutorialThumbnail || getTutorialThumbnail()) && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: `url(${featured?.featuredTutorialThumbnail || getTutorialThumbnail()})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        filter: 'blur(28px) brightness(0.25) saturate(1.2)',
                                        transform: 'scale(1.15)',
                                        pointerEvents: 'none',
                                    }} />
                                )}
                                {contentType !== 'video' && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: `radial-gradient(ellipse at 20% 50%, ${tc.accentColor}12 0%, transparent 60%)`,
                                        pointerEvents: 'none',
                                    }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(14,18,26,0.6) 0%, rgba(14,18,26,0.82) 50%, rgba(14,18,26,0.95) 100%)', pointerEvents: 'none' }} />

                                <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '18px 20px 18px 20px', boxSizing: 'border-box' }}>
                                    {/* Content body */}
                                    {contentType === 'video' ? (
                                        featured?.featuredTutorialUrl ? (
                                            <div style={{ flex: 1, display: 'flex', gap: '20px', minHeight: 0, overflow: 'hidden', alignItems: 'flex-start' }}>
                                                {/* Left col: thumbnail + button */}
                                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', width: isMobile ? '110px' : '200px' }}>
                                                    <div style={{
                                                        width: '100%', aspectRatio: '16/9',
                                                        borderRadius: '10px', overflow: 'hidden', position: 'relative',
                                                        background: '#1f2937', border: '1px solid rgba(255,255,255,0.07)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
                                                    }}>
                                                        {getTutorialThumbnail() && (
                                                            <img src={getTutorialThumbnail()!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                                                        )}
                                                        <div style={{
                                                            position: 'absolute', width: '46px', height: '46px',
                                                            background: 'rgba(0,0,0,0.7)', borderRadius: '50%',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: '1px solid rgba(255,255,255,0.15)',
                                                            backdropFilter: 'blur(4px)',
                                                        }}>
                                                            <Play size={20} fill="white" color="white" style={{ marginLeft: '3px' }} />
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={featured.featuredTutorialUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                            padding: '8px 0', width: '100%',
                                                            background: `${colors.primary}20`, color: colors.primary,
                                                            border: `1px solid ${colors.primary}40`, borderRadius: '8px',
                                                            fontWeight: 700, fontSize: '12px', textDecoration: 'none',
                                                            letterSpacing: '0.03em',
                                                        }}
                                                    >
                                                        <Play size={13} fill={colors.primary} color={colors.primary} /> Watch Now
                                                    </a>
                                                    {/* Author + date */}
                                                    {(featured.featuredTutorialAuthor || featured.featuredTutorialDate) && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                                                            {featured.featuredTutorialAuthor && (
                                                                <div style={{ fontSize: '10px', color: colors.textPrimary, fontWeight: 700, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {featured.featuredTutorialAuthor}
                                                                </div>
                                                            )}
                                                            {featured.featuredTutorialDate && (
                                                                <div style={{ fontSize: '10px', color: colors.textSecondary, textAlign: 'center' }}>
                                                                    {featured.featuredTutorialDate}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Right col: text fills height */}
                                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', paddingBottom: '2px' }}>
                                                    <div style={{ fontWeight: 800, fontSize: '16px', lineHeight: 1.3, color: colors.textPrimary, letterSpacing: '-0.01em', marginBottom: '10px' }}>
                                                        {featured.featuredTutorialTitle || 'Watch Tutorial'}
                                                    </div>
                                                    {featured.featuredTutorialDescription && (
                                                        <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.6, overflow: 'hidden' }}>
                                                            {featured.featuredTutorialDescription}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                <MonitorPlay size={32} color={colors.textSecondary} style={{ opacity: 0.15 }} />
                                                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No video tutorial set</p>
                                            </div>
                                        )
                                    ) : (
                                        /* News / Guide — coming soon */
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '28px' }}>
                                            <div style={{
                                                width: '90px', height: '90px', flexShrink: 0, borderRadius: '18px',
                                                background: `${tc.accentColor}12`,
                                                border: `1px solid ${tc.accentColor}30`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {contentType === 'news'
                                                    ? <Newspaper size={38} color={tc.accentColor} style={{ opacity: 0.6 }} />
                                                    : <BookOpen size={38} color={tc.accentColor} style={{ opacity: 0.6 }} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '16px', fontWeight: 800, color: colors.textPrimary, marginBottom: '8px' }}>
                                                    {contentType === 'news' ? 'Community News' : 'Community Guides'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.6, marginBottom: '12px' }}>
                                                    {contentType === 'news'
                                                        ? 'Curated updates, announcements, and stories from the Fuji Studio community.'
                                                        : 'In-depth tutorials and production guides from experienced FL Studio producers.'}
                                                </div>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                                                    background: `${tc.accentColor}18`, border: `1px solid ${tc.accentColor}35`,
                                                    color: tc.accentColor, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                }}>Coming soon</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ═══════════════ FULL-WIDTH: LATEST RELEASES ═══════════════ */}
                    <div style={{ ...panel, gridColumn: isMobile ? undefined : '1 / -1', padding: 0, overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ padding: '15px 20px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Activity size={15} color={colors.primary} />
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.textPrimary }}>Latest Releases</span>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: colors.textSecondary }}>{Math.min(topTracks.length, 6)} tracks</span>
                        </div>
                        {/* Waveform track list */}
                        <div style={{ padding: '8px 14px 12px' }}>
                            {topTracks.slice(0, 6).map((track, i) => {
                                const isPlaying = player.currentTrack?.id === track.id && player.isPlaying;
                                const wf = generateWaveform(track.id);
                                return (
                                    <div
                                        key={track.id}
                                        className="lr-row"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
                                            padding: '8px 8px', borderRadius: '10px', cursor: 'pointer',
                                            background: isPlaying ? `${colors.primary}0d` : 'transparent',
                                            border: isPlaying ? `1px solid ${colors.primary}22` : '1px solid transparent',
                                            marginBottom: '3px', transition: 'background 0.15s',
                                        }}
                                        onClick={() => { if (player.currentTrack?.id === track.id) togglePlay(); else setTrack(track, topTracks); }}
                                    >
                                        {/* Rank */}
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: i === 0 ? colors.primary : 'rgba(255,255,255,0.22)', width: '14px', textAlign: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>

                                        {/* Cover + play overlay */}
                                        <div style={{ width: isMobile ? '44px' : '52px', height: isMobile ? '44px' : '52px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#1a2234' }}>
                                            {track.coverUrl
                                                ? <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FujiLogo size={16} color={colors.primary} opacity={0.2} /></div>
                                            }
                                            <div
                                                className="lr-cover-overlay"
                                                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0, transition: 'opacity 0.15s' }}
                                            >
                                                {isPlaying
                                                    ? <Pause size={14} fill={colors.primary} color={colors.primary} />
                                                    : <Play size={14} fill="white" color="white" style={{ marginLeft: '2px' }} />
                                                }
                                            </div>
                                        </div>

                                        {/* Title + artist */}
                                        <div style={{ flexShrink: 0, width: isMobile ? '90px' : '150px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '13px', color: isPlaying ? colors.primary : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.profile.displayName || track.profile.username}</div>
                                        </div>

                                        {/* Waveform — main visual element */}
                                        {!isMobile && (
                                            <div style={{ flex: 1, minWidth: 0, height: '42px', display: 'flex', alignItems: 'flex-end', gap: '2px', overflow: 'hidden' }}>
                                                {wf.map((barH, bi) => (
                                                    <div
                                                        key={bi}
                                                        className={isPlaying ? 'wf-anim-bar' : undefined}
                                                        style={{
                                                            flex: 1,
                                                            height: `${barH}%`,
                                                            minWidth: '2px',
                                                            borderRadius: '2px 2px 1px 1px',
                                                            background: isPlaying
                                                                ? `rgba(16,185,129,${0.45 + (barH / 90) * 0.55})`
                                                                : `rgba(255,255,255,${0.07 + (barH / 90) * 0.13})`,
                                                            animationDelay: isPlaying ? `${(bi % 9) * 0.09}s` : undefined,
                                                            transition: 'background 0.4s',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Play count */}
                                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', width: isMobile ? 'auto' : '68px', justifyContent: 'flex-end' }}>
                                            <Play size={9} color={colors.textSecondary} />
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{(track.playCount || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>


                </div>
            </div>
        </DiscoveryLayout>
    );
};
