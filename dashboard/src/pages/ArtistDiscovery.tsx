import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { 
    Search, Music, MapPin, Play, Heart, Plus, ChevronLeft, ChevronRight,
    Filter, Radio, Disc, Volume2, SkipBack, SkipForward, Shuffle, Repeat, PlayCircle, Menu, ExternalLink, Zap, Pause, TrendingUp, UserSearch, LayoutGrid, RadioTower, Award 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
}

const genreColors = [
    '#2B8C71', '#F27B13', '#A855F7', '#3B82F6', '#EF4444', 
    '#EAB308', '#EC4899', '#06B6D4', '#8B5CF6', '#10B981'
];

export const ArtistDiscoveryPage: React.FC = () => {
    const [artists, setArtists] = useState<ArtistProfile[]>([]);
    const [topTracks, setTopTracks] = useState<TrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [genres, setGenres] = useState<DiscoveryGenre[]>([]);
    const [featured, setFeatured] = useState<FeaturedData | null>(null);
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
                    
                    {/* Featured Track Hero */}
                    <div style={{ ...styles.widgetCard, ...styles.playerGradient, gridColumn: isMobile ? 'span 12' : 'span 8', padding: isMobile ? '24px' : '40px', overflow: 'hidden', position: 'relative' }}>
                        {featured?.featuredTrack ? (
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '32px', height: '100%' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ 
                                    width: isMobile ? '200px' : '240px', height: isMobile ? '200px' : '240px', borderRadius: '12px', overflow: 'hidden',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
                                }} onClick={() => navigate(`/track/${featured.featuredTrack!.profile.username}/${featured.featuredTrack!.slug || featured.featuredTrack!.id}`)}>
                                    {featured.featuredTrack.coverUrl ? (
                                        <img src={featured.featuredTrack.coverUrl} alt="Featured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#242C3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FujiLogo size={80} color={colors.primary} opacity={0.2} />
                                        </div>
                                    )}
                                </div>
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
                                <h2 style={{ fontSize: isMobile ? '28px' : '48px', fontWeight: '900', margin: '0 0 8px 0', lineHeight: 1.1, cursor: 'pointer' }} onClick={() => navigate(`/track/${featured.featuredTrack!.profile.username}/${featured.featuredTrack!.slug || featured.featuredTrack!.id}`)}>
                                    {featured.featuredTrack.title}
                                </h2>
                                <p style={{ fontSize: '16px', color: '#B9C3CE', marginBottom: '24px' }}>
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
                                    <button onClick={() => navigate(`/track/${featured.featuredTrack!.profile.username}/${featured.featuredTrack!.slug || featured.featuredTrack!.id}`)} style={{ 
                                        backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: '12px 28px', borderRadius: '8px', 
                                        border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' 
                                    }}>Track Info</button>
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
                            <button onClick={() => navigate('/library')} style={{ fontSize: '10px', fontWeight: 'bold', color: colors.primary, background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {topTracks.slice(0, 5).map((track, idx) => (
                                <div key={track.id} onClick={() => setTrack(track, topTracks)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {artists.slice(0, 5).map(artist => (
                                <div key={artist.userId} onClick={() => navigate(`/profile/${artist.username}`)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                                    <div style={{ aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', marginBottom: '8px', border: '2px solid rgba(255,255,255,0.05)', transition: 'border-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                                        {artist.avatar ? (
                                            <img src={artist.avatar.startsWith('/uploads/') ? artist.avatar : `https://cdn.discordapp.com/avatars/${artist.userId}/${artist.avatar}.png?size=256`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{artist.username.charAt(0).toUpperCase()}</div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '10px', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.displayName || artist.username}</p>
                                </div>
                            ))}
                            <div onClick={() => navigate('/artists')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                                <div style={{ aspectRatio: '1/1', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                    <Plus size={20} color="#B9C3CE" />
                                </div>
                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#B9C3CE', margin: 0 }}>Explore</p>
                            </div>
                        </div>
                    </div>

                    {/* Genre Exploration */}
                    <div style={{ ...styles.widgetCard, gridColumn: isMobile ? 'span 12' : (isMobile ? 'span 12' : 'span 4'), padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={styles.headerLabel}><LayoutGrid size={16} color={colors.primary} /> Genre Exploration</h3>
                            <button onClick={() => navigate('/genres')} style={{ fontSize: '10px', fontWeight: 'bold', color: colors.primary, background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            {(() => {
                                // Show top 5 genres sorted by profile count; they're already sorted by the API
                                const displayGenres = genres.slice(0, 5);
                                return displayGenres.map((genre, idx) => (
                                    <div 
                                        key={genre.id} 
                                        onClick={() => navigate(`/category/${genre.slug}`)}
                                        style={{ 
                                            ...styles.genreTile, 
                                            backgroundColor: `${genreColors[idx % genreColors.length]}1A`,
                                            color: genreColors[idx % genreColors.length],
                                            border: `1px solid ${genreColors[idx % genreColors.length]}33`
                                        }} 
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }} 
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                    >
                                        {genre.name}
                                    </div>
                                ));
                            })()}
                            <div 
                                onClick={() => navigate('/genres')} 
                                style={{ 
                                    ...styles.genreTile, 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    color: '#B9C3CE'
                                }} 
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} 
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <span style={{ fontSize: '10px' }}>More...</span>
                            </div>
                        </div>
                    </div>

                    {/* Live Streams */}
                    <div style={{ ...styles.widgetCard, gridColumn: isMobile ? 'span 12' : 'span 4', padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={styles.headerLabel}><RadioTower size={16} color="#EF4444" /> Live Streams</h3>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', fontSize: '8px', fontWeight: 'bold', borderRadius: '999px' }}>
                                <span style={{ width: '4px', height: '4px', backgroundColor: '#EF4444', borderRadius: '50%' }}></span> 0 LIVE
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <p style={{ fontSize: '11px', color: '#B9C3CE', margin: 0 }}>No active streams right now.</p>
                                <p style={{ fontSize: '9px', color: 'rgba(185, 195, 206, 0.5)', marginTop: '4px' }}>Check back later for live sessions!</p>
                            </div>
                        </div>
                    </div>

                    {/* Latest Releases Grid */}
                    <div style={{ ...styles.widgetCard, gridColumn: 'span 12', padding: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Award size={20} color={colors.accentOrange} /> Latest Releases
                                </h3>
                                <p style={{ fontSize: '11px', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Freshly uploaded from the Fuji Studio community</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: '24px', alignItems: 'start' }}>
                            {topTracks.map(track => (
                                <div key={track.id} style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', minWidth: 0 }} onClick={() => navigate(`/track/${track.profile.username}/${track.slug || track.id}`)}>
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s', flexShrink: 0 }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                        {track.coverUrl ? (
                                            <img src={track.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', backgroundColor: '#1A1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FujiLogo size={32} color={colors.primary} opacity={0.2} />
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0'} onClick={(e) => { e.stopPropagation(); setTrack(track, topTracks); }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Play size={24} fill="white" />
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</p>
                                    <p style={{ fontSize: '10px', color: '#B9C3CE', margin: '2px 0 12px' }}>{track.profile.displayName || track.profile.username}</p>
                                    <button onClick={(e) => { e.stopPropagation(); navigate(`/track/${track.profile.username}/${track.slug || track.id}`); }} style={{ width: '100%', padding: '6px', border: `1px solid ${colors.primary}4D`, color: colors.primary, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', borderRadius: '6px', background: 'none', cursor: 'pointer' }}>Listen Now</button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </DiscoveryLayout>
    );
};
