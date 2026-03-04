import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { 
    Search, Music, MapPin, Play, Heart, Plus, ChevronLeft, ChevronRight,
    Filter, Radio, Disc, Volume2, SkipBack, SkipForward, Shuffle, Repeat, PlayCircle, Menu, ExternalLink, Zap, Pause
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';

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
    url: string;
    coverUrl: string | null;
    playCount: number;
    profile: {
        userId: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
    };
}

export const ArtistDiscoveryPage: React.FC = () => {
    const [artists, setArtists] = useState<ArtistProfile[]>([]);
    const [topTracks, setTopTracks] = useState<TrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const { player, setTrack, togglePlay, setVolume } = usePlayer();
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchArtists = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            if (selectedGenre) params.genre = selectedGenre;
            
            // Using absolute URL or ensuring the base is correct for the API call
            const apiBase = window.location.origin.includes('localhost') ? '' : window.location.origin;
            const [profilesRes, tracksRes] = await Promise.all([
                axios.get(`${apiBase}/api/musician/profiles`, { params }),
                axios.get(`${apiBase}/api/musician/leaderboards/tracks`, { params: { limit: 10 } })
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

    const genres = ["Electronic", "Ambient", "Lo-Fi", "Techno", "Hip Hop", "Rock", "Experimental"];

    return (
        <div style={{ 
            height: '100vh', display: 'flex', flexDirection: 'column', 
            backgroundColor: '#161925', color: '#F8FAFC', overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header */}
            <header style={{ 
                height: '64px', backgroundColor: '#1A1E2E', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                        <div style={{ 
                            width: '36px', height: '36px', backgroundColor: colors.primary, 
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Music color="white" size={24} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>FUJI STUDIO</h1>
                            <p style={{ margin: 0, fontSize: '9px', color: colors.primary, fontWeight: 'bold', letterSpacing: '0.2em' }}>FAN DISCOVERY</p>
                        </div>
                    </div>
                    {!isMobile && (
                        <nav style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <button style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: `${colors.primary}33`, color: colors.primary, border: 'none', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Search size={14} /> DISCOVER
                            </button>
                            <button style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: 'transparent', color: '#B9C3CE', border: 'none', fontSize: '10px', fontWeight: 'bold' }}>LIBRARY</button>
                            <button style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: 'transparent', color: '#B9C3CE', border: 'none', fontSize: '10px', fontWeight: 'bold' }}>LIVE</button>
                        </nav>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#B9C3CE" style={{ position: 'absolute', left: '16px' }} />
                        <input 
                            type="text" 
                            placeholder="Search artists, genres, equipment..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ 
                                width: isMobile ? '160px' : '300px', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '999px', padding: '8px 48px', fontSize: '12px', color: 'white', outline: 'none'
                            }}
                        />
                    </div>
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Sidebar */}
                {!isMobile && (
                    <aside style={{ width: '256px', backgroundColor: '#1A1E2E', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '24px', overflowY: 'auto' }}>
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '24px' }}>Discovery Filters</h3>
                        <div style={{ marginBottom: '32px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Genre</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {genres.map(g => (
                                    <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '12px', color: selectedGenre === g ? 'white' : '#B9C3CE' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedGenre === g}
                                            onChange={() => setSelectedGenre(selectedGenre === g ? null : g)}
                                            style={{ accentColor: colors.primary }}
                                        />
                                        {g}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Popularity</p>
                            <input type="range" style={{ width: '100%', accentColor: colors.primary }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)', marginTop: '8px' }}>
                                <span>Emerging</span>
                                <span>Established</span>
                            </div>
                        </div>
                    </aside>
                )}

                {/* Main Content */}
                <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#161925', paddingBottom: '100px' }}>
                    {/* Hero Section */}
                    <div style={{ 
                        background: 'linear-gradient(135deg, #242C3D 0%, #1A1E2E 100%)',
                        padding: isMobile ? '32px 20px' : '64px 48px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                        position: 'relative', overflow: 'hidden'
                    }}>
                        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '48px', position: 'relative', zIndex: 1 }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ 
                                    width: isMobile ? '240px' : '280px', height: isMobile ? '240px' : '280px', borderRadius: '16px', overflow: 'hidden',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBL5FtdxpIzBESrl-YM_agqxqNjpXv-iXPbftCjdOEk_OXAK9-4Ii4LWjDLAApQupMvNam2eTbMXdV1H25jJ4gfdliPCbEhzDLhoQICAEEwDJeqQnivHqWEr_22cpHXachO0yu0VbER1Pdp_2Z6iC4ujH5K6QYZPiUN2zhEajhI57WyNyzU5YQfZNrH8EQ7xdkIRLaNXvjh-S-xKORGad4O7V09HN5rW6atsIHS4BiS1j4JtrWOJh6Nflg_9YyF3D0QAI_wOjnH1nvG" alt="Featured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ 
                                    position: 'absolute', bottom: '-16px', right: '-16px', width: '56px', height: '56px',
                                    backgroundColor: colors.primary, borderRadius: '50%', border: '4px solid #1A1E2E',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 15px ${colors.primary}4D`
                                }}>
                                    <Disc color="white" />
                                </div>
                            </div>
                            <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <span style={{ backgroundColor: `${colors.primary}33`, color: colors.primary, padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Now Discovery</span>
                                    <span style={{ color: '#B9C3CE', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Auto-playing Featured Track</span>
                                </div>
                                <h2 style={{ fontSize: isMobile ? '36px' : '56px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '-0.03em' }}>Neon Drift (Club Mix)</h2>
                                <p style={{ fontSize: isMobile ? '18px' : '22px', color: '#B9C3CE', marginBottom: '32px' }}>Featured Artist: <span style={{ color: 'white', fontWeight: 'bold' }}>Mowgi</span></p>
                                <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center', gap: '16px' }}>
                                    <button style={{ 
                                        backgroundColor: '#F27B13', color: 'white', padding: '12px 32px', borderRadius: '12px',
                                        border: 'none', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                                        letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 10px 15px rgba(242, 123, 19, 0.3)'
                                    }}>Support Artist</button>
                                    <button style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Plus />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: isMobile ? '24px' : '48px', maxWidth: '1400px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Disc color={colors.primary} size={20} /> Top Rated Tracks
                            </h3>
                            <button style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>View All</button>
                        </div>

                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))', 
                            gap: isMobile ? '16px' : '24px',
                            marginBottom: '64px'
                        }}>
                            {loading && topTracks.length === 0 ? (
                                Array(5).fill(0).map((_, i) => (
                                    <div key={i} style={{ backgroundColor: '#1A1E2E', height: '260px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }}></div>
                                ))
                            ) : (
                                topTracks.map((track) => (
                                    <div key={track.id} style={{ 
                                        backgroundColor: '#1A1E2E', borderRadius: '12px', padding: '16px', 
                                        border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }} onClick={() => player.currentTrack?.id === track.id ? togglePlay() : setTrack(track)}>
                                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                                            <div style={{ 
                                                width: '100%', aspectRatio: '1/1', borderRadius: '8px', 
                                                backgroundColor: '#242C3D', overflow: 'hidden'
                                            }}>
                                                {track.coverUrl ? (
                                                    <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Music size={48} color="rgba(255,255,255,0.1)" />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ 
                                                position: 'absolute', bottom: '8px', right: '8px', 
                                                backgroundColor: colors.primary, borderRadius: '50%', 
                                                width: '36px', height: '36px', display: 'flex', 
                                                alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                            }}>
                                                {player.currentTrack?.id === track.id && player.isPlaying ? (
                                                    <Pause size={18} fill="white" color="white" />
                                                ) : (
                                                    <Play size={18} fill="white" color="white" style={{ marginLeft: '2px' }} />
                                                )}
                                            </div>
                                        </div>
                                        <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</h4>
                                        <p style={{ fontSize: '12px', color: '#B9C3CE', margin: '0 0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.profile.displayName || track.profile.username}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                            <span style={{ fontSize: '10px', color: colors.primary, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Zap size={10} /> {track.playCount.toLocaleString()} PLAYS
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Trending Section */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Disc color={colors.primary} size={20} /> Trending Artists
                            </h3>
                            <button style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>View All</button>
                        </div>

                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: '16px' 
                        }}>
                            {loading ? (
                                <p>Loading musicians...</p>
                            ) : artists.length === 0 ? (
                                <p>No artists found matching your criteria.</p>
                            ) : (
                                artists.map(artist => (
                                    <div key={artist.userId} className="widget-card" style={{ 
                                        backgroundColor: '#242C3D', padding: '24px', borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
                                    }}>
                                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                                            <div style={{ width: '128px', height: '128px', borderRadius: '50%', overflow: 'hidden', border: '4px solid rgba(255,255,255,0.05)' }}>
                                                {artist.avatar ? (
                                                    <img src={`https://cdn.discordapp.com/avatars/${artist.userId}/${artist.avatar}.png?size=256`} alt={artist.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '32px' }}>
                                                        {artist.username.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <button style={{ 
                                                position: 'absolute', bottom: 0, right: 0, width: '40px', height: '40px',
                                                backgroundColor: colors.primary, borderRadius: '50%', border: 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                            }}>
                                                <Play size={20} fill="white" />
                                            </button>
                                        </div>
                                        <h4 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{artist.displayName || artist.username}</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                                            {artist.genres.slice(0, 2).map((g, i) => (
                                                <span key={i} style={{ backgroundColor: `${colors.primary}1A`, color: colors.primary, padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{g.genre.name}</span>
                                            ))}
                                        </div>
                                        <div style={{ width: '100%', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                            <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', marginBottom: '4px' }}>Main Gear</p>
                                            <p style={{ fontSize: '11px', fontWeight: 'medium', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {artist.hardware?.[0] || 'No gear listed'}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => navigate(`/profile/${artist.username}`)}
                                            style={{ 
                                                marginTop: '24px', width: '100%', padding: '10px', backgroundColor: 'rgba(242, 123, 19, 0.1)',
                                                border: '1px solid rgba(242, 123, 19, 0.3)', color: '#F27B13', fontSize: '10px',
                                                fontWeight: 'bold', textTransform: 'uppercase', borderRadius: '8px', cursor: 'pointer'
                                            }}
                                        >View Profile</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            </div>
            
            <div style={{ height: player.currentTrack ? '80px' : 0 }} />
        </div>
    );
};