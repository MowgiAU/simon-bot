
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, ArrowLeft, ArrowRight, Disc, Music } from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import { FujiLogo } from '../components/FujiLogo';

interface Genre {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    parentId?: string | null;
    children?: Genre[];
    _count?: {
        profiles: number;
        tracks: number;
    };
}

const genreColors = [
    '#2B8C71', '#F27B13', '#A855F7', '#3B82F6', '#EF4444', 
    '#EAB308', '#EC4899', '#06B6D4', '#8B5CF6', '#10B981'
];

export const GenresPage: React.FC<{ parentSlug?: string }> = ({ parentSlug }) => {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [selectedParent, setSelectedParent] = useState<Genre | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                // Fetch all musician genres
                const response = await fetch('/api/musician/genres');
                if (response.ok) {
                    const data = await response.json();
                    setGenres(data);
                    
                    // If we have a parentSlug in URL, find that genre and set it as selected
                    if (parentSlug) {
                        const parent = data.find((g: Genre) => g.slug === parentSlug);
                        if (parent) {
                            setSelectedParent(parent);
                        }
                    } else {
                        setSelectedParent(null);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch genres:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchGenres();
    }, [parentSlug]);

    const mainGenres = genres.filter(g => !g.parentId);
    const displayedGenres = selectedParent 
        ? genres.filter(g => g.parentId === selectedParent.id)
        : mainGenres;

    return (
        <DiscoveryLayout>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
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
                            <LayoutGrid size={32} color={colors.primary} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800 }}>
                                {selectedParent ? selectedParent.name : 'Genre Exploration'}
                            </h1>
                            <p style={{ margin: '4px 0 0', color: '#B9C3CE' }}>
                                {selectedParent 
                                    ? `Exploring sub-genres of ${selectedParent.name}` 
                                    : 'Explore tracks and artists by their signature sounds'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => selectedParent ? navigate('/genres') : navigate('/')} 
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
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.transform = 'translateX(-4px)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.transform = 'translateX(0)';
                        }}
                    >
                        <ArrowLeft size={18} /> {selectedParent ? 'Back to All Genres' : 'Back to Discovery'}
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <Music className="rotating" size={48} color={colors.primary} opacity={0.5} />
                            <p style={{ marginTop: '16px', color: '#B9C3CE' }}>Mapping the soundscape...</p>
                        </div>
                    </div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: '24px' 
                    }}>
                        {displayedGenres.length > 0 ? displayedGenres.map((genre, idx) => (
                            <div 
                                key={genre.id}
                                onClick={() => {
                                    const hasChildren = genres.some(g => g.parentId === genre.id);
                                    if (hasChildren && !selectedParent) {
                                        navigate(`/genres/${genre.slug}`);
                                    } else {
                                        navigate(`/category/${genre.slug}`);
                                    }
                                }}
                                style={{ 
                                    backgroundColor: '#1E2333', 
                                    borderRadius: '20px', 
                                    padding: '24px', 
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden'
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
                                    background: `radial-gradient(circle, ${genreColors[idx % genreColors.length]}11 0%, transparent 70%)`,
                                    pointerEvents: 'none'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ 
                                        width: '48px', 
                                        height: '48px', 
                                        backgroundColor: genreColors[idx % genreColors.length] + '22', 
                                        borderRadius: '12px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: genreColors[idx % genreColors.length],
                                        border: `1px solid ${genreColors[idx % genreColors.length]}33`
                                    }}>
                                        <Disc size={24} />
                                    </div>
                                    <ArrowRight size={18} color="#B9C3CE" style={{ marginTop: '8px' }} />
                                </div>

                                <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>{genre.name}</h3>
                                {genre.description ? (
                                    <p style={{ margin: '0 0 16px', color: '#B9C3CE', fontSize: '13px', lineHeight: 1.5, height: '40px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {genre.description}
                                    </p>
                                ) : (
                                    <div style={{ height: '56px' }}>
                                        {genres.some(g => g.parentId === genre.id) && (
                                            <span style={{ fontSize: '11px', color: colors.primary, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {genres.filter(g => g.parentId === genre.id).length} Sub-genres
                                            </span>
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
                                        <Music size={12} /> <strong>{genre._count?.tracks || 0}</strong> Tracks
                                    </div>
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                    <div style={{ color: '#B9C3CE', fontSize: '12px' }}>
                                        <strong>{genre._count?.profiles || 0}</strong> Artists
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', color: '#B9C3CE' }}>
                                <FujiLogo size={64} opacity={0.1} />
                                <h2 style={{ marginTop: '24px' }}>No genres found.</h2>
                                <p>Start tagging tracks to see genres appear here.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
