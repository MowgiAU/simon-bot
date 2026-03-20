import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { 
    Search, UserSearch, Music
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
            activeTab="artists"
        >
            <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px' }}>
                {/* Page Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        backgroundColor: colors.primary + '15', 
                        borderRadius: '14px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <UserSearch size={26} color={colors.primary} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>
                            {sortBy === 'popular' ? 'Most Popular Artists' : 
                             sortBy === 'alphabetical' ? 'All Artists (A-Z)' : 'Discover Artists'}
                        </h1>
                        <p style={{ margin: '2px 0 0', color: '#B9C3CE', fontSize: '13px' }}>
                            {artists.length} artists found {selectedGenre ? `in ${selectedGenre}` : 'in the community'}
                        </p>
                    </div>
                </div>

                {/* Search bar */}
                <div style={{ position: 'relative', marginBottom: '24px' }}>
                    <Search size={15} color="#B9C3CE" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Search artists..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        aria-label="Search artists"
                        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 16px 10px 40px', fontSize: '13px', color: 'white', outline: 'none' }}
                    />
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
                        gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))', 
                        gap: '14px' 
                    }}>
                        {artists.map((artist, idx) => (
                            <Link 
                                key={artist.userId} 
                                to={`/profile/${artist.username}`} 
                                style={{ 
                                    backgroundColor: '#1E2333', 
                                    borderRadius: '12px', 
                                    padding: '16px 12px', 
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'center',
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    display: 'block',
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.borderColor = colors.primary + '55';
                                    e.currentTarget.style.backgroundColor = '#252B41';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.backgroundColor = '#1E2333';
                                }}
                            >
                                <div style={{ 
                                    width: '64px', 
                                    height: '64px', 
                                    borderRadius: '50%', 
                                    overflow: 'hidden', 
                                    margin: '0 auto 10px',
                                    border: `2px solid ${accentColors[idx % accentColors.length]}33`,
                                }}>
                                    {artist.avatar ? (
                                        <img src={artist.avatar.startsWith('http') || artist.avatar.startsWith('/uploads/') ? artist.avatar : `https://cdn.discordapp.com/avatars/${artist.userId}/${artist.avatar}.png?size=256`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', backgroundColor: accentColors[idx % accentColors.length] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: accentColors[idx % accentColors.length] }}>
                                            {artist.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {artist.displayName || artist.username}
                                </p>
                                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#B9C3CE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    @{artist.username}
                                </p>
                                {artist.genres?.length > 0 && (
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                                        {artist.genres.slice(0, 2).map((g, i) => (
                                            <span key={i} style={{ 
                                                fontSize: '8px', 
                                                fontWeight: 600, 
                                                color: accentColors[(idx + i) % accentColors.length], 
                                                backgroundColor: accentColors[(idx + i) % accentColors.length] + '15', 
                                                padding: '2px 6px', 
                                                borderRadius: '999px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.03em'
                                            }}>
                                                {g.genre.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#B9C3CE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                    <Music size={10} /> {(artist.totalPlays || 0).toLocaleString()} plays
                                </p>
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
