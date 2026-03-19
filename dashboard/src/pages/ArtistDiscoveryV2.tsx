import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    Play, Plus, Pause, TrendingUp, Swords,
    Award, Trophy, Users, Timer, ListMusic,
    Star, MonitorPlay
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
        trackCount: number; totalPlays: number;
        profile?: { username: string; displayName: string | null } | null;
        tracks: { track: { id: string; title: string; coverUrl: string | null; url: string; profile: { username: string; displayName: string | null } } }[];
    } | null;
    editorPicks?: TrackInfo[];
    featuredProducer?: ArtistProfile & { tracks: { id: string; title: string; url: string; coverUrl: string | null }[] } | null;
    featuredProducerNote?: string | null;
    featuredTutorialUrl?: string | null;
    featuredTutorialTitle?: string | null;
    featuredTutorialThumbnail?: string | null;
    featuredBattle?: {
        id: string; title: string; status: string;
        bannerUrl: string | null;
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
                setArtists(profilesRes.data);
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
        heroPlaylist.tracks.slice(0, 4).forEach(pt => heroTrackList.push({ title: pt.track.title, artist: pt.track.profile.displayName || pt.track.profile.username, coverUrl: pt.track.coverUrl }));
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
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', position: 'relative', overflow: 'hidden' }}>
                        {heroCover && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroCover})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3, filter: 'blur(14px)', transform: 'scale(1.15)', pointerEvents: 'none' }} />
                        )}
                        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* Top section: cover + track list */}
                            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flex: 1 }}>
                                <div style={{
                                    width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'linear-gradient(45deg, #2d3748, #4a5568)',
                                }}>
                                    {heroCover ? (
                                        <img src={heroCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FujiLogo size={50} color={colors.primary} opacity={0.2} />
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '8px' }}>
                                    {heroTrackList.map((t, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(45deg, #2d3748, #4a5568)' }}>
                                                {t.coverUrl && <img src={t.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                                <div style={{ fontSize: '10px', color: colors.textSecondary }}>{t.artist}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Label + title */}
                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ color: colors.primary, fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{heroLabel}</div>
                                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 2px', lineHeight: 1.2 }}>{heroTitle}</h2>
                                {heroSubtitle && <div style={{ fontSize: '12px', color: colors.textSecondary }}>{heroSubtitle}</div>}
                            </div>

                            {/* Play Now button */}
                            <button
                                onClick={handleHeroPlay}
                                style={{
                                    backgroundColor: colors.primary, color: 'white', padding: '12px', borderRadius: '8px', border: 'none',
                                    fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer',
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    marginTop: 'auto', boxShadow: `0 4px 15px ${colors.primary}44`,
                                }}
                            >
                                {isHeroPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                                {isHeroPlaying ? 'Pause' : 'Play Now'}
                            </button>
                        </div>
                    </div>

                    {/* Battle */}
                    {(() => {
                        const battle = featured?.featuredBattle;
                        const battleDesc = featured?.featuredBattleDescription;
                        return (
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', position: 'relative', overflow: 'hidden' }}>
                        {(battle?.bannerUrl || heroCover) && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${battle?.bannerUrl || heroCover})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18, filter: 'blur(8px)', transform: 'scale(1.1)', pointerEvents: 'none' }} />
                        )}
                        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}><Swords size={16} color={colors.primary} /> Battle</h3>
                            {battle && (
                                <span style={{
                                    background: battle.status === 'voting' ? 'rgba(251,191,36,0.18)' : battle.status === 'active' ? 'rgba(52,211,153,0.18)' : 'rgba(96,165,250,0.18)',
                                    color: battle.status === 'voting' ? '#FBBF24' : battle.status === 'active' ? '#34D399' : '#60A5FA',
                                    padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                                }}>{battle.status === 'voting' ? 'VOTING NOW' : battle.status === 'active' ? 'OPEN' : 'UPCOMING'}</span>
                            )}
                        </div>

                        {battle ? (
                            <>
                                {battle.sponsor && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 600, color: colors.textSecondary, background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                            {battle.sponsor.logoUrl && <img src={battle.sponsor.logoUrl} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain', borderRadius: '2px' }} />}
                                            Sponsored by {battle.sponsor.name}
                                        </span>
                                    </div>
                                )}
                                <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', lineHeight: 1.2 }}>{battle.title}</h2>
                                {battleDesc && (
                                    <p style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.5, marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                        {battleDesc}
                                    </p>
                                )}

                                <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', fontSize: '12px', color: colors.textSecondary }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={13} /> {battle._count?.entries ?? 0} {(battle._count?.entries ?? 0) === 1 ? 'entry' : 'entries'}</span>
                                    {battle.status === 'voting' && battle.votingEnd && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Timer size={13} /> Closes {new Date(battle.votingEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    )}
                                    {battle.status === 'active' && battle.submissionEnd && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Timer size={13} /> Closes {new Date(battle.submissionEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    )}
                                </div>

                                {/* Prizes */}
                                {battle.prizes && battle.prizes.length > 0 && (
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Trophy size={12} color="#FBBF24" /> PRIZES
                                        </div>
                                        {battle.prizes.slice(0, 3).map((p, i) => (
                                            <div key={i} style={{ fontSize: '10px', color: colors.textSecondary, marginBottom: '3px' }}>
                                                <strong style={{ color: colors.textPrimary }}>{p.place}:</strong> {p.title || p.description}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Link
                                    to={`/battles/${battle.id}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        padding: '10px', borderRadius: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
                                        cursor: 'pointer', textAlign: 'center', width: '100%', fontSize: '12px', textDecoration: 'none',
                                        marginTop: 'auto', flexShrink: 0,
                                        background: battle.status === 'voting' ? 'rgba(251,191,36,0.15)' : battle.status === 'active' ? `${colors.primary}20` : 'rgba(255,255,255,0.05)',
                                        color: battle.status === 'voting' ? '#FBBF24' : battle.status === 'active' ? colors.primary : colors.textPrimary,
                                        border: `1px solid ${battle.status === 'voting' ? 'rgba(251,191,36,0.35)' : battle.status === 'active' ? `${colors.primary}35` : 'rgba(255,255,255,0.1)'}`,
                                    }}
                                >
                                    {battle.status === 'voting' ? 'VOTE NOW' : battle.status === 'active' ? 'SUBMIT A BEAT' : 'VIEW BATTLE'}
                                </Link>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Swords size={32} color={colors.textSecondary} style={{ opacity: 0.15 }} />
                                <p style={{ fontSize: '12px', color: colors.textSecondary }}>No battle featured right now.</p>
                                <Link to="/battles" style={{ fontSize: '11px', color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>View archive →</Link>
                            </div>
                        )}
                        </div>
                    </div>
                        );
                    })()}

                    {/* Trending Artists */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px' }}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}><TrendingUp size={16} color={colors.primary} /> Trending Artists</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', flex: 1, alignContent: 'start' }}>
                            {artists.slice(0, 8).map(artist => (
                                <Link key={artist.userId} to={`/profile/${artist.username}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                                    <div style={{
                                        width: '100%', maxWidth: '70px', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden',
                                        margin: '0 auto 4px', border: `2px solid ${colors.primary}44`, background: '#4a5568',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.primary)}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = `${colors.primary}44`)}
                                    >
                                        <img src={getAvatarUrl(artist.avatar, artist.userId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }} />
                                    </div>
                                    <div style={{ fontSize: '10px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.displayName || artist.username}</div>
                                </Link>
                            ))}
                            <Link to="/artists" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                                <div style={{
                                    width: '100%', maxWidth: '70px', aspectRatio: '1', borderRadius: '50%',
                                    margin: '0 auto 4px', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Plus size={18} color={colors.textSecondary} />
                                </div>
                                <div style={{ fontSize: '10px', color: colors.textSecondary }}>Explore</div>
                            </Link>
                        </div>
                    </div>

                    {/* ═══════════════ ROW 2: EDITOR'S PICKS / PLAYLISTS / TUTORIAL ═══════════════ */}

                    {/* Editor's Picks */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '280px' }}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}><Star size={16} color="#FBBF24" /> Editor's Picks</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1 }}>
                            {(featured?.editorPicks && featured.editorPicks.length > 0
                                ? featured.editorPicks.slice(0, 2)
                                : topTracks.slice(0, 2)
                            ).map(track => (
                                <Link key={track.id} to={`/track/${track.profile.username}/${track.slug || track.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', background: '#1B212E', borderRadius: '10px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{
                                        width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px',
                                        background: 'linear-gradient(45deg, #2d3748, #4a5568)', position: 'relative',
                                    }}>
                                        {track.coverUrl ? (
                                            <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FujiLogo size={30} color={colors.primary} opacity={0.2} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                    <div style={{ fontSize: '10px', color: colors.textSecondary }}>{track.profile.displayName || track.profile.username}</div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Popular Playlists */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '280px' }}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}><ListMusic size={16} color={colors.primary} /> Popular Playlists</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1 }}>
                            {popularPlaylists.slice(0, 2).map(playlist => (
                                <Link key={playlist.id} to={`/playlist/${playlist.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', background: '#1B212E', borderRadius: '10px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{
                                        width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px',
                                        background: 'linear-gradient(45deg, #2d3748, #4a5568)', position: 'relative', border: '1px solid rgba(255,255,255,0.05)',
                                    }}>
                                        {playlist.coverUrl ? (
                                            <img src={playlist.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <ListMusic size={30} color={colors.primary} style={{ opacity: 0.2 }} />
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, color: 'white' }}>
                                            {playlist.trackCount} tracks
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playlist.name}</div>
                                    <div style={{ fontSize: '10px', color: colors.textSecondary }}>by {playlist.profile?.displayName || playlist.profile?.username || 'Unknown'}</div>
                                </Link>
                            ))}
                            {popularPlaylists.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: '12px' }}>
                                    No playlists yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Featured Tutorial */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '280px' }}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}><MonitorPlay size={16} color={colors.primary} /> Featured Tutorial</h3>
                        </div>

                        {featured?.featuredTutorialUrl ? (
                            <>
                                <a href={featured.featuredTutorialUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{
                                        flex: 1, borderRadius: '8px', overflow: 'hidden', position: 'relative',
                                        background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: '14px', border: '1px solid rgba(255,255,255,0.05)',
                                    }}>
                                        {getTutorialThumbnail() ? (
                                            <img src={getTutorialThumbnail()!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : null}
                                        <div style={{
                                            position: 'absolute', width: '50px', height: '50px',
                                            background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Play size={24} fill="white" color="white" style={{ marginLeft: '3px' }} />
                                        </div>
                                    </div>
                                </a>
                                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px', lineHeight: 1.3 }}>
                                    {featured.featuredTutorialTitle || 'Watch Tutorial'}
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary }}>Video Tutorial</div>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: colors.textSecondary }}>
                                <MonitorPlay size={32} style={{ opacity: 0.15 }} />
                                <p style={{ fontSize: '12px', margin: 0 }}>No tutorial featured right now</p>
                            </div>
                        )}
                    </div>

                    {/* ═══════════════ FULL-WIDTH: LATEST RELEASES ═══════════════ */}

                    <div style={{ ...panel, gridColumn: isMobile ? undefined : '1 / -1', height: 'auto', padding: '24px' }}>
                        <h2 style={{
                            fontSize: '16px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 18px',
                        }}>
                            <Award size={20} color={colors.primary} /> Latest Releases
                        </h2>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
                            gap: '14px',
                        }}>
                            {topTracks.slice(0, 6).map(track => (
                                <Link key={track.id} to={`/track/${track.profile.username}/${track.slug || track.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div
                                        style={{
                                            background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.05)', transition: 'border-color 0.2s, transform 0.2s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${colors.primary}55`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        <div
                                            style={{
                                                width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px',
                                                position: 'relative', background: 'linear-gradient(45deg, #2d3748, #4a5568)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                            }}
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTrack(track, topTracks); }}
                                        >
                                            {track.coverUrl ? (
                                                <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <FujiLogo size={20} color={colors.primary} opacity={0.25} />
                                                </div>
                                            )}
                                            <div
                                                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s', cursor: 'pointer' }}
                                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                                            >
                                                <Play size={20} fill="white" color="white" />
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary }}>{track.profile.displayName || track.profile.username}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>


                </div>
            </div>
        </DiscoveryLayout>
    );
};
