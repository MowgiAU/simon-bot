import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { 
    Search, UserSearch
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';

/** 
 * Artist List Styles
 */
const styles: any = {
    widgetCard: {
        backgroundColor: '#242C3D',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: borderRadius.lg,
        transition: 'all 0.2s ease',
        height: '100%',
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
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeResizeListener('resize', handleResize);
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
                        { id: 'alphabetical', label: 'A - Z' },
                        { id: 'oldest', label: 'OG Members' }
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
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1600px', margin: '0 auto' }}>
                <div style={{ ...styles.widgetCard, padding: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <UserSearch size={20} color={colors.primary} /> 
                                {sortBy === 'popular' ? 'Most Popular Artists' : 
                                 sortBy === 'alphabetical' ? 'All Artists (A-Z)' : 
                                 sortBy === 'oldest' ? 'OG Members' : 'Recently Joined Artists'}
                            </h3>
                            <p style={{ fontSize: '11px', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
                                {artists.length} artists found {selectedGenre ? `in ${selectedGenre}` : 'in the community'}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}>Loading artists...</div>
                    ) : artists.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: '32px' }}>
                            {artists.map(artist => (
                                <div 
                                    key={artist.userId} 
                                    onClick={() => navigate(`/profile/${artist.username}`)} 
                                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <div style={{ 
                                        aspectRatio: '1/1', 
                                        borderRadius: '50%', 
                                        overflow: 'hidden', 
                                        marginBottom: '12px', 
                                        border: '3px solid rgba(255,255,255,0.05)', 
                                        transition: 'border-color 0.2s',
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                                    }} onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                                        {artist.avatar ? (
                                            <img src={artist.avatar.startsWith('/uploads/') ? artist.avatar : `https://cdn.discordapp.com/avatars/${artist.userId}/${artist.avatar}.png?size=256`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', color: colors.primary }}>
                                                {artist.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.displayName || artist.username}</p>
                                    <p style={{ fontSize: '10px', color: '#B9C3CE', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {artist.genres?.length > 0 ? artist.genres[0].genre.name : 'Musician'}
                                    </p>
                                    {sortBy === 'popular' && (
                                        <p style={{ fontSize: '10px', color: colors.primary, fontWeight: 'bold', marginTop: '4px' }}>
                                            {(artist.totalPlays || 0).toLocaleString()} Plays
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                            <Search size={48} color="#B9C3CE" opacity={0.2} style={{ marginBottom: '16px' }} />
                            <p style={{ color: '#B9C3CE' }}>No artists found matching your criteria.</p>
                            <button onClick={() => { setSelectedGenre(null); setSearch(''); setSortBy('newest'); }} style={{ marginTop: '16px', color: colors.primary, background: 'none', border: `1px solid ${colors.primary}4D`, padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Clear Filters</button>
                        </div>
                    )}
                </div>
            </div>
        </DiscoveryLayout>
    );
};
