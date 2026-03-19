import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { 
    Search, Music, MapPin, Play, Heart, Plus, ChevronLeft, ChevronRight,
    Filter, Radio, Disc, Volume2, SkipBack, SkipForward, Shuffle, Repeat, PlayCircle, Menu, ExternalLink, Zap, Pause, TrendingUp, UserSearch, LayoutGrid, Swords, Award,
    Headphones, Mic, Waves, Trophy, Users, Timer, ListMusic
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';

/** 
 * Modular styles following the Fuji Studio design system (Tailwind-like approach in CSS-in-JS)
 */
const styles: any = {
    widgetCard: {
        backgroundColor: '#242C3D',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: borderRadius.lg,
        transition: 'all 0.2s ease',
        height: '100%',
    },
    playerGradient: {
        background: 'linear-gradient(90deg, #242C3D 0%, #1A1E2E 100%)',
    },
    genreTile: {
        position: 'relative',
        overflow: 'hidden',
        aspectRatio: '1 / 1',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        fontSize: '9px',
    },
    headerLabel: {
        fontSize: '10px',
        fontWeight: 'bold',
        color: 'white',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    }
};

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
}

interface DiscoveryGenre {
    id: string;
    name: string;
    _count: { profiles: number };
}

interface FeaturedData {
    featuredType?: string;
    featuredTrackId: string | null;
    featuredLabel: string | null;
    featuredTrack: {
        id: string;
        title: string;
        url: string;
        coverUrl: string | null;
        artist: string | null;
        description: string | null;
        playCount: number;
        profile: {
            userId: string;
            username: string;
            displayName: string | null;
            avatar: string | null;
        };
    } | null;
    featuredArtist?: {
        id: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
        bio: string | null;
        genres: { genre: { name: string } }[];
        tracks: { id: string; title: string; slug: string | null; url: string; coverUrl: string | null }[];
    } | null;
    featuredPlaylist?: {
        id: string;
        name: string;
        description: string | null;
        coverUrl: string | null;
        trackCount: number;
        totalPlays: number;
        profile?: { username: string; displayName: string | null } | null;
        tracks: { track: { id: string; title: string; coverUrl: string | null; url: string; profile: { username: string; displayName: string | null } } }[];
    } | null;
}

interface PopularPlaylist {
    id: string;
    name: string;
    coverUrl: string | null;
    trackCount: number;
    totalPlays: number;
    profile?: { username: string; displayName: string | null } | null;
    tracks: { track: { coverUrl: string | null } }[];
}

const genreColors = [
    '#2B8C71', '#F27B13', '#A855F7', '#3B82F6', '#EF4444', 
    '#EAB308', '#EC4899', '#06B6D4', '#8B5CF6', '#10B981'
];

const genreIcons = [Music, Disc, Radio, Volume2, Headphones, Mic, Waves, Play];

export const ArtistDiscoveryPage: React.FC = () => {
    const [artists, setArtists] = useState<ArtistProfile[]>([]);
    const [topTracks, setTopTracks] = useState<TrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [genres, setGenres] = useState<DiscoveryGenre[]>([]);
    const [featured, setFeatured] = useState<FeaturedData | null>(null);
    const [popularPlaylists, setPopularPlaylists] = useState<PopularPlaylist[]>([]);
    const [currentBattle, setCurrentBattle] = useState<{
        id: string; title: string; status: string;
        description: string | null; bannerUrl: string | null;
        submissionEnd: string | null; votingEnd: string | null;
        _count?: { entries: number };
        sponsor: { id: string; name: string; logoUrl: string | null } | null;
    } | null>(null);
    const { player, setTrack, togglePlay } = usePlayer();
    const navigate = useNavigate();

    const playFullQueue = (startTrack: any, tracks: any[]) => {
        setTrack(startTrack, tracks);
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load genres from DB (only genres used in profiles)
    useEffect(() => {
        axios.get('/api/discovery/genres').then(res => setGenres(res.data)).catch(() => {});
        axios.get('/api/discovery/settings').then(res => setFeatured(res.data)).catch(() => {});
        axios.get('/api/playlists/popular').then(res => setPopularPlaylists(res.data)).catch(() => {});
        // Load current battle for the widget
        fetch('/api/beat-battle/battles?guildId=default-guild')
            .then(r => r.ok ? r.json() : [])
            .then((battles: any[]) => {
                const active = battles.find((b: any) => b.status === 'voting') ||
                               battles.find((b: any) => b.status === 'active') ||
                               battles.find((b: any) => b.status === 'upcoming');
                if (active) setCurrentBattle(active);
            })
            .catch(() => {});
    }, []);

    const fetchArtists = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            if (selectedGenre) params.genre = selectedGenre;
            
            const [profilesRes, tracksRes] = await Promise.all([
                axios.get('/api/musician/profiles', { params }),
                axios.get('/api/musician/leaderboards/tracks', { params: { limit: 12 } })
            ]);
            setArtists(profilesRes.data);
            setTopTracks(tracksRes.data);
        } catch (err) {
            console.error('Failed to fetch artists', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchArtists, 300);
        return () => clearTimeout(timer);
    }, [search, selectedGenre]);

    const sidebarContent = (
        <>
            <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '24px' }}>Discovery Filters</h3>
            <div style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Genre</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {genres.length === 0 && <span style={{ fontSize: '11px', color: '#B9C3CE', fontStyle: 'italic' }}>No genres yet</span>}
                    {genres.map(g => (
                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '12px', color: selectedGenre === g.name ? 'white' : '#B9C3CE' }}>
                            <input 
                                type="checkbox" 
                                checked={selectedGenre === g.name}
                                onChange={() => setSelectedGenre(selectedGenre === g.name ? null : g.name)}
                                style={{ accentColor: colors.primary }}
                            />
                            {g.name}
                            <span style={{ fontSize: '10px', color: 'rgba(185,195,206,0.5)', marginLeft: 'auto' }}>{g._count?.profiles || 0}</span>
                        </label>
                    ))}
                </div>
            </div>
        </>
    );

    return (
        <DiscoveryLayout 
            sidebar={sidebarContent} 
            search={search} 
            onSearchChange={setSearch}
            activeTab="discover"
        >
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1600px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
                    
                    {/* Featured Hero */}
                    <div style={{ ...styles.widgetCard, ...styles.playerGradient, gridColumn: isMobile ? 'span 12' : 'span 8', padding: isMobile ? '20px' : '28px', overflow: 'hidden', position: 'relative' }}>
                        {/* Background blur */}
                        {featured?.featuredTrack?.coverUrl && featured?.featuredType !== 'artist' && featured?.featuredType !== 'playlist' && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featured.featuredTrack.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.08, filter: 'blur(32px)', transform: 'scale(1.15)', pointerEvents: 'none' }} />
                        )}
                        {featured?.featuredType === 'artist' && featured?.featuredArtist?.avatar && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featured.featuredArtist.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.08, filter: 'blur(32px)', transform: 'scale(1.15)', pointerEvents: 'none' }} />
                        )}
                        {featured?.featuredType === 'playlist' && featured?.featuredPlaylist?.coverUrl && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featured.featuredPlaylist.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.08, filter: 'blur(32px)', transform: 'scale(1.15)', pointerEvents: 'none' }} />
                        )}

                        {/* Featured Track (default) */}
                        {(!featured?.featuredType || featured.featuredType === 'track') && featured?.featuredTrack ? (
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '16px' : '22px', height: '100%', position: 'relative' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Link to={`/track/${featured.featuredTrack!.profile.username}/${featured.featuredTrack!.slug || featured.featuredTrack!.id}`} style={{ 
                                    width: isMobile ? '160px' : '200px', height: isMobile ? '160px' : '200px', borderRadius: '12px', overflow: 'hidden',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                                    display: 'block', textDecoration: 'none'
                                }}>
                                    {featured.featuredTrack.coverUrl ? (
                                        <img src={featured.featuredTrack.coverUrl} alt="Featured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#242C3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FujiLogo size={80} color={colors.primary} opacity={0.2} />
                                        </div>
                                    )}
                                </Link>
                            </div>
                            <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <span style={{ backgroundColor: `${colors.accentOrange}`, color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {featured.featuredLabel || 'Featured Track'}
                                    </span>
                                    <span style={{ color: colors.primary, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Zap size={14} /> NOW PLAYING
                                    </span>
                                </div>
                                <Link to={`/track/${featured.featuredTrack!.profile.username}/${featured.featuredTrack!.slug || featured.featuredTrack!.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                <h2 style={{ fontSize: isMobile ? '22px' : '34px', fontWeight: '900', margin: '0 0 6px 0', lineHeight: 1.1, cursor: 'pointer' }}>
                                    {featured.featuredTrack.title}
                                </h2>
                                </Link>
                                <p style={{ fontSize: '13px', color: '#B9C3CE', marginBottom: '18px', lineHeight: 1.4 }}>
                                    {featured.featuredTrack.profile.displayName || featured.featuredTrack.profile.username} • {featured.featuredTrack.description || 'New Sound Release'}
                                </p>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', gap: '16px' }}>
                                    <button onClick={() => player.currentTrack?.id === featured.featuredTrack!.id ? togglePlay() : setTrack(featured.featuredTrack!, [featured.featuredTrack!, ...topTracks])} style={{ 
                                        backgroundColor: colors.primary, color: 'white', padding: '12px 28px', borderRadius: '8px', border: 'none', 
                                        fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', 
                                        boxShadow: `0 4px 15px ${colors.primary}44` 
                                    }}>
                                        {player.currentTrack?.id === featured.featuredTrack.id && player.isPlaying ? <Pause size={16} /> : <Play size={16} fill="white" />}
                                        {player.currentTrack?.id === featured.featuredTrack.id && player.isPlaying ? 'Pause' : 'Play Now'}
                                    </button>
                                    <Link to={`/track/${featured.featuredTrack!.profile.username}/${featured.featuredTrack!.slug || featured.featuredTrack!.id}`} style={{ 
                                        backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: '12px 28px', borderRadius: '8px', 
                                        border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer',
                                        textDecoration: 'none'
                                    }}>Track Info</Link>
                                </div>
                            </div>
                        </div>

                        ) : featured?.featuredType === 'artist' && featured?.featuredArtist ? (
                        /* Featured Artist hero */
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '16px' : '22px', height: '100%', position: 'relative' }}>
                            <div style={{ flexShrink: 0 }}>
                                <Link to={`/profile/${featured.featuredArtist.username}`} style={{
                                    width: isMobile ? '160px' : '200px', height: isMobile ? '160px' : '200px', borderRadius: '50%', overflow: 'hidden',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: `3px solid ${colors.primary}44`, cursor: 'pointer',
                                    display: 'block', textDecoration: 'none'
                                }}>
                                    {featured.featuredArtist.avatar ? (
                                        <img src={featured.featuredArtist.avatar} alt="Featured Artist" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: 'white' }}>
                                            {featured.featuredArtist.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </Link>
                            </div>
                            <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <span style={{ backgroundColor: '#A855F7', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {featured.featuredLabel || 'Featured Artist'}
                                    </span>
                                    <span style={{ color: colors.primary, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Zap size={14} /> SPOTLIGHT
                                    </span>
                                </div>
                                <Link to={`/profile/${featured.featuredArtist.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                    <h2 style={{ fontSize: isMobile ? '22px' : '34px', fontWeight: '900', margin: '0 0 6px 0', lineHeight: 1.1, cursor: 'pointer' }}>
                                        {featured.featuredArtist.displayName || featured.featuredArtist.username}
                                    </h2>
                                </Link>
                                <p style={{ fontSize: '13px', color: '#B9C3CE', marginBottom: '12px', lineHeight: 1.4 }}>
                                    {featured.featuredArtist.bio || 'Discover this artist\'s music'}
                                </p>
                                {featured.featuredArtist.genres?.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                        {featured.featuredArtist.genres.slice(0, 3).map((g, i) => (
                                            <span key={i} style={{ backgroundColor: `${colors.primary}1A`, border: `1px solid ${colors.primary}4D`, color: colors.primary, padding: '3px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{g.genre.name}</span>
                                        ))}
                                    </div>
                                )}
                                <Link to={`/profile/${featured.featuredArtist.username}`} style={{
                                    backgroundColor: colors.primary, color: 'white', padding: '12px 28px', borderRadius: '8px', border: 'none',
                                    fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    boxShadow: `0 4px 15px ${colors.primary}44`, textDecoration: 'none'
                                }}>View Artist</Link>
                            </div>
                        </div>

                        ) : featured?.featuredType === 'playlist' && featured?.featuredPlaylist ? (
                        /* Featured Playlist hero */
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '16px' : '22px', height: '100%', position: 'relative' }}>
                            <div style={{ flexShrink: 0 }}>
                                <Link to={`/playlist/${featured.featuredPlaylist.id}`} style={{
                                    width: isMobile ? '160px' : '200px', height: isMobile ? '160px' : '200px', borderRadius: '12px', overflow: 'hidden',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                                    display: 'block', textDecoration: 'none'
                                }}>
                                    {featured.featuredPlaylist.coverUrl ? (
                                        <img src={featured.featuredPlaylist.coverUrl} alt="Featured Playlist" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#242C3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ListMusic size={80} color={colors.primary} style={{ opacity: 0.2 }} />
                                        </div>
                                    )}
                                </Link>
                            </div>
                            <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <span style={{ backgroundColor: '#3B82F6', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {featured.featuredLabel || 'Featured Playlist'}
                                    </span>
                                    <span style={{ color: colors.primary, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <ListMusic size={14} /> CURATED
                                    </span>
                                </div>
                                <Link to={`/playlist/${featured.featuredPlaylist.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                    <h2 style={{ fontSize: isMobile ? '22px' : '34px', fontWeight: '900', margin: '0 0 6px 0', lineHeight: 1.1, cursor: 'pointer' }}>
                                        {featured.featuredPlaylist.name}
                                    </h2>
                                </Link>
                                <p style={{ fontSize: '13px', color: '#B9C3CE', marginBottom: '18px', lineHeight: 1.4 }}>
                                    {featured.featuredPlaylist.description || `${featured.featuredPlaylist.trackCount} tracks`}
                                    {featured.featuredPlaylist.profile && ` • by ${featured.featuredPlaylist.profile.displayName || featured.featuredPlaylist.profile.username}`}
                                </p>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', gap: '16px' }}>
                                    <Link to={`/playlist/${featured.featuredPlaylist.id}`} style={{
                                        backgroundColor: colors.primary, color: 'white', padding: '12px 28px', borderRadius: '8px', border: 'none',
                                        fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        boxShadow: `0 4px 15px ${colors.primary}44`, textDecoration: 'none'
                                    }}>
                                        <Play size={16} fill="white" /> Play Playlist
                                    </Link>
                                </div>
                            </div>
                        </div>

                        ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#B9C3CE' }}>
                            <Disc size={48} opacity={0.2} style={{ marginBottom: '12px' }} />
                            <p>Loading inspiration...</p>
                        </div>
                        )}
                    </div>

                    {/* Trending Songs */}
                    <div style={{ ...styles.widgetCard, gridColumn: isMobile ? 'span 12' : 'span 4', padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={styles.headerLabel}><TrendingUp size={16} color={colors.accentOrange} /> Trending Songs</h3>
                            <Link to="/library" style={{ fontSize: '10px', fontWeight: 'bold', color: colors.primary, textDecoration: 'none' }}>View All</Link>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {topTracks.slice(0, 5).map((track, idx) => (
                                <div key={track.id} onClick={() => setTrack(track, topTracks)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#B9C3CE', width: '16px' }}>{idx + 1}</span>
                                    <div style={{ width: '40px', height: '40px', backgroundColor: '#1A1E2E', borderRadius: '4px', overflow: 'hidden' }}>
                                        {track.coverUrl ? (
                                            <img src={track.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FujiLogo size={20} color={colors.primary} opacity={0.2} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</p>
                                        <p style={{ fontSize: '10px', color: '#B9C3CE', margin: 0 }}>{track.profile.displayName || track.profile.username}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '11px', fontWeight: 'bold', margin: 0 }}>{track.playCount >= 1000000 ? (track.playCount / 1000000).toFixed(1) + 'M' : track.playCount >= 1000 ? (track.playCount / 1000).toFixed(1) + 'K' : track.playCount.toString()}</p>
                                        <p style={{ fontSize: '8px', color: '#B9C3CE', margin: 0, textTransform: 'uppercase' }}>Plays</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* New Artists */}
                    <div style={{ ...styles.widgetCard, gridColumn: isMobile ? 'span 12' : 'span 4', padding: '24px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={styles.headerLabel}><UserSearch size={16} color={colors.primary} /> Discover Artists</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', alignItems: 'start' }}>
                            {artists.slice(0, 9).map(artist => (
                                <Link key={artist.userId} to={`/profile/${artist.username}`} style={{ textAlign: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'block', minWidth: 0 }}>
                                    <div style={{ aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', marginBottom: '8px', border: '2px solid rgba(255,255,255,0.05)', transition: 'border-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                                        {artist.avatar ? (
                                            <img src={artist.avatar.startsWith('http') || artist.avatar.startsWith('/uploads/') ? artist.avatar : `https://cdn.discordapp.com/avatars/${artist.userId}/${artist.avatar}.png?size=256`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{artist.username.charAt(0).toUpperCase()}</div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '10px', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.displayName || artist.username}</p>
                                </Link>
                            ))}
                            <Link to="/artists" style={{ textAlign: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'block', minWidth: 0 }}>
                                <div style={{ aspectRatio: '1/1', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                    <Plus size={20} color="#B9C3CE" />
                                </div>
                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#B9C3CE', margin: 0 }}>Explore</p>
                            </Link>
                        </div>
                    </div>

                    {/* Genre Exploration */}
                    <div style={{ ...styles.widgetCard, gridColumn: isMobile ? 'span 12' : (isMobile ? 'span 12' : 'span 4'), padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={styles.headerLabel}><LayoutGrid size={16} color={colors.primary} /> GENRES</h3>
                            <Link to="/genres" style={{ fontSize: '10px', fontWeight: 'bold', color: colors.primary, textDecoration: 'none' }}>View All</Link>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {(() => {
                                // Show top genres sorted by profile count; they're already sorted by the API
                                const displayGenres = genres.slice(0, 7);
                                return displayGenres.map((genre, idx) => {
                                    const GenreIcon = genreIcons[idx % genreIcons.length];
                                    return (
                                    <Link 
                                        key={genre.id} 
                                        to={`/category/${genre.slug}`}
                                        style={{ 
                                            ...styles.genreTile, 
                                            backgroundColor: `${genreColors[idx % genreColors.length]}1A`,
                                            color: genreColors[idx % genreColors.length],
                                            border: `1px solid ${genreColors[idx % genreColors.length]}33`,
                                            textDecoration: 'none',
                                        }} 
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }} 
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                    >
                                        <div style={{ position: 'absolute', right: '-6px', bottom: '-6px', opacity: 0.15, filter: 'blur(1.5px)', color: genreColors[idx % genreColors.length], pointerEvents: 'none' }}>
                                            <GenreIcon size={48} />
                                        </div>
                                        <span style={{ position: 'relative', zIndex: 1 }}>{genre.name}</span>
                                    </Link>
                                    );
                                });
                            })()}
                            <Link 
                                to="/genres"
                                style={{ 
                                    ...styles.genreTile, 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    color: '#B9C3CE',
                                    textDecoration: 'none',
                                }} 
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} 
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <span style={{ fontSize: '10px' }}>More...</span>
                            </Link>
                        </div>
                    </div>

                    {/* Beat Battles */}
                    <div style={{ ...styles.widgetCard, gridColumn: isMobile ? 'span 12' : 'span 4', padding: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                        {/* Background — banner or gradient */}
                        {currentBattle?.bannerUrl ? (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${currentBattle.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.2, filter: 'blur(8px)', transform: 'scale(1.1)', pointerEvents: 'none' }} />
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${colors.primary}28 0%, rgba(90,20,200,0.14) 100%)`, pointerEvents: 'none' }} />
                        )}
                        <div style={{ position: 'relative', zIndex: 1, padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '11px' }}>
                            {/* Header row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ ...styles.headerLabel, fontSize: '9px' }}><Swords size={14} color={colors.primary} /> Beat Battles</h3>
                                {currentBattle && (
                                    <span style={{
                                        display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px',
                                        backgroundColor: currentBattle.status === 'voting' ? 'rgba(251,191,36,0.18)' : currentBattle.status === 'active' ? 'rgba(52,211,153,0.18)' : 'rgba(96,165,250,0.18)',
                                        color: currentBattle.status === 'voting' ? '#FBBF24' : currentBattle.status === 'active' ? '#34D399' : '#60A5FA',
                                        fontSize: '8px', fontWeight: 'bold', borderRadius: '999px', letterSpacing: '0.07em',
                                    }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 }} />
                                        {currentBattle.status === 'voting' ? 'VOTING OPEN' : currentBattle.status === 'active' ? 'OPEN' : 'UPCOMING'}
                                    </span>
                                )}
                            </div>

                            {currentBattle ? (
                                <>
                                    {/* Title & description */}
                                    <div>
                                        <p style={{ fontSize: '17px', fontWeight: 800, color: 'white', margin: '0 0 5px', lineHeight: 1.2 }}>{currentBattle.title}</p>
                                        {currentBattle.description && (
                                            <p style={{ fontSize: '11px', color: 'rgba(185,195,206,0.8)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                {currentBattle.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#B9C3CE' }}>
                                            <Users size={11} style={{ flexShrink: 0 }} />
                                            {currentBattle._count?.entries ?? 0} {(currentBattle._count?.entries ?? 0) === 1 ? 'entry' : 'entries'}
                                        </span>
                                        {currentBattle.status === 'voting' && currentBattle.votingEnd && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FBBF24' }}>
                                                <Timer size={11} style={{ flexShrink: 0 }} />
                                                Closes {new Date(currentBattle.votingEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                        {currentBattle.status === 'active' && currentBattle.submissionEnd && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#34D399' }}>
                                                <Timer size={11} style={{ flexShrink: 0 }} />
                                                Closes {new Date(currentBattle.submissionEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>

                                    {/* Sponsor chip */}
                                    {currentBattle.sponsor && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', alignSelf: 'flex-start' }}>
                                            {currentBattle.sponsor.logoUrl && (
                                                <img src={currentBattle.sponsor.logoUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'contain' }} />
                                            )}
                                            <span style={{ fontSize: '10px', color: '#B9C3CE' }}>Sponsored by <strong style={{ color: 'white' }}>{currentBattle.sponsor.name}</strong></span>
                                        </div>
                                    )}

                                    {/* CTA */}
                                    <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
                                        <Link
                                            to={`/battles/${currentBattle.id}`}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                                                color: currentBattle.status === 'voting' ? '#FBBF24' : colors.primary,
                                                backgroundColor: currentBattle.status === 'voting' ? 'rgba(251,191,36,0.15)' : `${colors.primary}20`,
                                                padding: '8px 16px', borderRadius: '8px',
                                                border: `1px solid ${currentBattle.status === 'voting' ? 'rgba(251,191,36,0.35)' : `${colors.primary}35`}`,
                                            }}
                                        >
                                            {currentBattle.status === 'voting'
                                                ? <><Trophy size={13} /> Vote Now &rarr;</>
                                                : currentBattle.status === 'active'
                                                ? <><Swords size={13} /> Submit a Beat &rarr;</>
                                                : 'View Battle →'}
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 0', textAlign: 'center' }}>
                                    <Swords size={28} color={colors.textSecondary} style={{ opacity: 0.2 }} />
                                    <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>No battle running right now.</p>
                                    <Link to="/battles" style={{ fontSize: '11px', color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>View archive →</Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Latest Releases — section header */}
                    <div style={{ gridColumn: 'span 12', display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <Award size={18} color={colors.accentOrange} />
                        <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textPrimary }}>Latest Releases</span>
                            <span style={{ marginLeft: '12px', fontSize: '11px', color: '#B9C3CE', letterSpacing: '0.05em' }}>Freshly uploaded from the community</span>
                        </div>
                    </div>

                    {/* Latest Releases — individual track cards */}
                    {topTracks.map(track => (
                        <Link
                            key={track.id}
                            to={`/track/${track.profile.username}/${track.slug || track.id}`}
                            style={{ gridColumn: isMobile ? 'span 6' : 'span 2', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div
                                style={{ ...styles.widgetCard, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.2s' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${colors.primary}55`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                            >
                                {/* Artwork */}
                                <div
                                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTrack(track, topTracks); }}
                                >
                                    {track.coverUrl ? (
                                        <img src={track.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#1A1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FujiLogo size={20} color={colors.primary} opacity={0.25} />
                                        </div>
                                    )}
                                    <div
                                        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                    >
                                        <Play size={20} fill="white" color="white" />
                                    </div>
                                </div>

                                {/* Text */}
                                <div style={{ width: '100%', minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>{track.title}</p>
                                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.profile.displayName || track.profile.username}</p>
                                    {track.genres?.[0] && (
                                        <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.primary, backgroundColor: `${colors.primary}18`, padding: '2px 7px', borderRadius: '4px' }}>
                                            {track.genres[0].genre.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}

                    {/* Popular Playlists — section header */}
                    {popularPlaylists.length > 0 && (
                        <>
                            <div style={{ gridColumn: 'span 12', display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: '8px' }}>
                                <ListMusic size={18} color={colors.accentOrange} />
                                <div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textPrimary }}>Popular Playlists</span>
                                    <span style={{ marginLeft: '12px', fontSize: '11px', color: '#B9C3CE', letterSpacing: '0.05em' }}>Community curated collections</span>
                                </div>
                            </div>

                            {/* Popular Playlists — cards */}
                            {popularPlaylists.map(playlist => (
                                <Link
                                    key={playlist.id}
                                    to={`/playlist/${playlist.id}`}
                                    style={{ gridColumn: isMobile ? 'span 6' : 'span 2', textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div
                                        style={{ ...styles.widgetCard, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.2s' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${colors.primary}55`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                                    >
                                        {/* Cover */}
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                                            {playlist.coverUrl ? (
                                                <img src={playlist.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', backgroundColor: '#1A1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <ListMusic size={24} color={colors.primary} style={{ opacity: 0.3 }} />
                                                </div>
                                            )}
                                            {/* Track count badge */}
                                            <div style={{ position: 'absolute', bottom: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: 'white', backdropFilter: 'blur(4px)' }}>
                                                {playlist.trackCount} tracks
                                            </div>
                                        </div>

                                        {/* Text */}
                                        <div style={{ width: '100%', minWidth: 0 }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>{playlist.name}</p>
                                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>by {playlist.profile?.displayName || playlist.profile?.username || 'Unknown'}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                <span style={{ fontSize: '10px', color: '#B9C3CE', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <Play size={9} /> {playlist.totalPlays.toLocaleString()} plays
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </>
                    )}

                </div>
            </div>
        </DiscoveryLayout>
    );
};
