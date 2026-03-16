import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { 
    Search, UserSearch, ArrowLeft, Music
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';

const accentColors = [
    '#2B8C71', '#F27B13', '#A855F7', '#3B82F6', '#EF4444', 
    '#EAB308', '#EC4899', '#06B6D4', '#8B5CF6', '#10B981'
];

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

interface DiscoveryGenre {
    id: string;
    name: string;
    _count: { profiles: number };
}

export const ArtistsPage: React.FC = () => {
    const [artists, setArtists] = useState<ArtistProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState('newest');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [genres, setGenres] = useState<DiscoveryGenre[]>([]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        axios.get('/api/discovery/genres').then(res => setGenres(res.data)).catch(() => {});
    }, []);

    const fetchArtists = async () => {
        setLoading(true);
        try {
            const params: any = { sort: sortBy };
            if (search) params.search = search;
            if (selectedGenre) params.genre = selectedGenre;
            
            const res = await axios.get('/api/musician/profiles', { params });
            setArtists(res.data);
        } catch (err) {
            console.error('Failed to fetch artists', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchArtists, 300);
        return () => clearTimeout(timer);
    }, [search, selectedGenre, sortBy]);

    const sidebarContent = (
        <>
            <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '24px' }}>Filter Artists</h3>
            
            <div style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Sort By</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { id: 'newest', label: 'Recently Joined' },
                        { id: 'popular', label: 'Most Popular' },
                        { id: 'alphabetical', label: 'A - Z' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSortBy(opt.id)}
                            style={{
                                textAlign: 'left',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                backgroundColor: sortBy === opt.id ? 'rgba(76, 117, 242, 0.1)' : 'transparent',
                                border: 'none',
                                color: sortBy === opt.id ? colors.primary : '#B9C3CE',
                                fontSize: '12px',
                                fontWeight: sortBy === opt.id ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Genre</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            activeTab="artists"
        >
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px' }}>
                {/* Page Header – matches GenresPage */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ 
                            width: '56px', 
                            height: '56px', 
                            backgroundColor: colors.primary + '15', 
                            borderRadius: '16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                        }}>
                            <UserSearch size={32} color={colors.primary} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800 }}>
                                {sortBy === 'popular' ? 'Most Popular Artists' : 
                                 sortBy === 'alphabetical' ? 'All Artists (A-Z)' : 'Discover Artists'}
                            </h1>
                            <p style={{ margin: '4px 0 0', color: '#B9C3CE' }}>
                                {artists.length} artists found {selectedGenre ? `in ${selectedGenre}` : 'in the community'}
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/"
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            backgroundColor: 'rgba(255,255,255,0.05)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            color: 'white', 
                            padding: '10px 20px', 
                            borderRadius: '12px', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                            textDecoration: 'none',
                        }}
                    >
                        <ArrowLeft size={18} /> Back to Discovery
                    </Link>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <Music className="rotating" size={48} color={colors.primary} opacity={0.5} />
                            <p style={{ marginTop: '16px', color: '#B9C3CE' }}>Discovering artists...</p>
                        </div>
                    </div>
                ) : artists.length > 0 ? (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: '24px' 
                    }}>
                        {artists.map((artist, idx) => (
                            <Link 
                                key={artist.userId} 
                                to={`/profile/${artist.username}`} 
                                style={{ 
                                    backgroundColor: '#1E2333', 
                                    borderRadius: '20px', 
                                    padding: '24px', 
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    textAlign: 'left',
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    display: 'block',
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-8px)';
                                    e.currentTarget.style.borderColor = colors.primary + '55';
                                    e.currentTarget.style.backgroundColor = '#252B41';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.backgroundColor = '#1E2333';
                                }}
                            >
                                {/* Decorative Gradient Circle */}
                                <div style={{ 
                                    position: 'absolute', 
                                    top: '-20px', 
                                    right: '-20px', 
                                    width: '100px', 
                                    height: '100px', 
                                    background: `radial-gradient(circle, ${accentColors[idx % accentColors.length]}11 0%, transparent 70%)`,
                                    pointerEvents: 'none'
                                }} />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                    <div style={{ 
                                        width: '56px', 
                                        height: '56px', 
                                        borderRadius: '50%', 
                                        overflow: 'hidden', 
                                        flexShrink: 0,
                                        border: `2px solid ${accentColors[idx % accentColors.length]}44`,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                    }}>
                                        {artist.avatar ? (
                                            <img src={artist.avatar.startsWith('http') || artist.avatar.startsWith('/uploads/') ? artist.avatar : `https://cdn.discordapp.com/avatars/${artist.userId}/${artist.avatar}.png?size=256`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', backgroundColor: accentColors[idx % accentColors.length] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px', color: accentColors[idx % accentColors.length] }}>
                                                {artist.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {artist.displayName || artist.username}
                                        </h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#B9C3CE' }}>
                                            @{artist.username}
                                        </p>
                                    </div>
                                </div>

                                {artist.bio ? (
                                    <p style={{ margin: '0 0 16px', color: '#B9C3CE', fontSize: '13px', lineHeight: 1.5, height: '40px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {artist.bio}
                                    </p>
                                ) : (
                                    <div style={{ height: '56px' }}>
                                        {artist.genres?.length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {artist.genres.slice(0, 3).map((g, i) => (
                                                    <span key={i} style={{ 
                                                        fontSize: '10px', 
                                                        fontWeight: 600, 
                                                        color: accentColors[(idx + i) % accentColors.length], 
                                                        backgroundColor: accentColors[(idx + i) % accentColors.length] + '15', 
                                                        padding: '3px 10px', 
                                                        borderRadius: '999px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.03em'
                                                    }}>
                                                        {g.genre.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    paddingTop: '16px',
                                    marginTop: '8px'
                                }}>
                                    <div style={{ color: '#B9C3CE', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Music size={12} /> <strong>{(artist.totalPlays || 0).toLocaleString()}</strong> Plays
                                    </div>
                                    {artist.genres?.length > 0 && (
                                        <>
                                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                            <div style={{ color: '#B9C3CE', fontSize: '12px' }}>
                                                <strong>{artist.genres.length}</strong> {artist.genres.length === 1 ? 'Genre' : 'Genres'}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', color: '#B9C3CE' }}>
                        <FujiLogo size={64} opacity={0.1} />
                        <h2 style={{ marginTop: '24px' }}>No artists found</h2>
                        <p>Try adjusting your search or filters.</p>
                        <button onClick={() => { setSelectedGenre(null); setSearch(''); setSortBy('newest'); }} style={{ marginTop: '16px', color: colors.primary, background: 'none', border: `1px solid ${colors.primary}4D`, padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Clear Filters</button>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
