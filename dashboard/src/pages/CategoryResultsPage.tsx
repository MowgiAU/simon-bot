
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, ArrowLeft, Disc, Music, Play, TrendingUp, Clock, Filter, Search } from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import { usePlayer } from '../components/PlayerProvider';
import { FujiLogo } from '../components/FujiLogo';
import axios from 'axios';

interface TrackInfo {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    playCount: number;
    createdAt: string;
    profile: {
        userId: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
    };
    genres: { genre: { name: string, slug: string } }[];
}

export const CategoryResultsPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setTrack, player } = usePlayer();

    const [tracks, setTracks] = useState<TrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [genreName, setGenreName] = useState(slug?.charAt(0).toUpperCase() + (slug?.slice(1) || ''));

    useEffect(() => {
        const fetchTracks = async () => {
            setLoading(true);
            try {
                const res = await axios.get('/api/discovery/tracks', {
                    params: {
                        genre: slug,
                        search: searchQuery,
                        sort: sortBy,
                        limit: 50
                    }
                });
                setTracks(res.data.tracks || []);
                
                if (res.data.genre) {
                    setGenreName(res.data.genre.name);
                } else if (!res.data.tracks || res.data.tracks.length === 0) {
                    // Fallback to title-cased slug if nothing returned
                    setGenreName(slug?.charAt(0).toUpperCase() + (slug?.slice(1) || ''));
                }
            } catch (err) {
                console.error('Failed to fetch filtered tracks:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTracks();
    }, [slug, sortBy, searchQuery]);

    const handleSortChange = (newSort: string) => {
        setSortBy(newSort);
        setSearchParams({ sort: newSort, q: searchQuery });
    };

    return (
        <DiscoveryLayout>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
                {/* Header Section */}
                <div style={{ display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', alignItems: window.innerWidth < 768 ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '40px', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ 
                            width: '64px', 
                            height: '64px', 
                            backgroundColor: colors.primary + '15', 
                            borderRadius: '16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: colors.primary
                        }}>
                            <Disc size={36} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.primary, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                                <Music size={14} /> Genre
                            </div>
                            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800 }}>{genreName}</h1>
                        </div>
                    </div>

                    <button 
                        onClick={() => navigate('/genres')} 
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
                            fontWeight: 600
                        }}
                    >
                        <ArrowLeft size={18} /> All Genres
                    </button>
                </div>

                {/* Filters Row */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: window.innerWidth < 768 ? 'column' : 'row',
                    alignItems: 'center', 
                    gap: '16px', 
                    marginBottom: '32px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ flex: 1, position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#B9C3CE' }} />
                        <input 
                            type="text" 
                            placeholder="Find within this genre..." 
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setSearchParams({ sort: sortBy, q: e.target.value });
                            }}
                            style={{ 
                                width: '100%', 
                                backgroundColor: '#1A1E2E', 
                                border: '1px solid rgba(255,255,255,0.05)', 
                                borderRadius: '10px', 
                                padding: '10px 12px 10px 40px', 
                                color: 'white',
                                outline: 'none'
                            }} 
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', width: window.innerWidth < 768 ? '100%' : 'auto' }}>
                        {[
                            { id: 'newest', label: 'Newest', icon: <Clock size={14} /> },
                            { id: 'plays', label: 'Most Popular', icon: <TrendingUp size={14} /> },
                            { id: 'alphabetical', label: 'A-Z', icon: <Filter size={14} /> }
                        ].map(opt => (
                            <button 
                                key={opt.id}
                                onClick={() => handleSortChange(opt.id)}
                                style={{ 
                                    flex: 1,
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: '6px', 
                                    padding: '10px 16px', 
                                    borderRadius: '10px', 
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    backgroundColor: sortBy === opt.id ? colors.primary : 'rgba(255,255,255,0.05)',
                                    color: sortBy === opt.id ? 'white' : '#B9C3CE',
                                    border: 'none',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {opt.icon} {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                        <Music className="rotating" size={48} color={colors.primary} opacity={0.5} />
                    </div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                        gap: '24px' 
                    }}>
                        {tracks.length > 0 ? tracks.map((track) => (
                            <div 
                                key={track.id} 
                                style={{ 
                                    cursor: 'pointer',
                                }}
                                onClick={() => setTrack(track, tracks)}
                                onMouseEnter={(e) => {
                                    const img = e.currentTarget.querySelector('img');
                                    if (img) img.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                    const img = e.currentTarget.querySelector('img');
                                    if (img) img.style.transform = 'scale(1)';
                                }}
                            >
                                <div style={{ 
                                    aspectRatio: '1/1', 
                                    borderRadius: '12px', 
                                    overflow: 'hidden', 
                                    position: 'relative', 
                                    marginBottom: '12px',
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                                    backgroundColor: '#1A1E2E'
                                }}>
                                    {track.coverUrl ? (
                                        <img 
                                            src={track.coverUrl} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} 
                                            alt={track.title} 
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FujiLogo size={48} color={colors.primary} opacity={0.3} />
                                        </div>
                                    )}
                                    
                                    {/* Play Overlay */}
                                    <div style={{ 
                                        position: 'absolute', 
                                        inset: 0, 
                                        backgroundColor: 'rgba(0,0,0,0.4)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        opacity: player.currentTrack?.id === track.id ? 1 : 0,
                                        transition: 'opacity 0.2s'
                                    }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => player.currentTrack?.id !== track.id && (e.currentTarget.style.opacity = '0')}>
                                         <div style={{ 
                                            width: '48px', 
                                            height: '48px', 
                                            borderRadius: '50%', 
                                            backgroundColor: colors.primary, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            transform: 'scale(1)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                         }}>
                                            <Play size={24} fill="white" color="white" />
                                         </div>
                                    </div>
                                    
                                    {/* Play Count Badge */}
                                    <div style={{ 
                                        position: 'absolute', 
                                        bottom: '8px', 
                                        right: '8px', 
                                        backgroundColor: 'rgba(0,0,0,0.6)', 
                                        backdropFilter: 'blur(4px)',
                                        padding: '4px 8px', 
                                        borderRadius: '6px', 
                                        color: 'white', 
                                        fontSize: '10px', 
                                        fontWeight: 800,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <Play size={8} fill="white" /> {(track.playCount / 1000).toFixed(1)}K
                                    </div>
                                </div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</h4>
                                <p style={{ margin: 0, fontSize: '12px', color: '#B9C3CE', fontWeight: 600 }}>{track.profile.displayName || track.profile.username}</p>
                            </div>
                        )) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', color: '#B9C3CE' }}>
                                <FujiLogo size={64} opacity={0.1} />
                                <h3 style={{ marginTop: '24px' }}>No tracks found in this category.</h3>
                                <p>Try adjusting your search or sorting filters.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
