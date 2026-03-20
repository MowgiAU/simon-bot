import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';
import axios from 'axios';
import { Heart, Play, Pause, Repeat2 } from 'lucide-react';

interface FavouriteTrack {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    duration: number | null;
    playCount: number;
    profile: { username: string; displayName: string | null };
}

export const MyFavouritesPage: React.FC = () => {
    const { user } = useAuth();
    const { player, setTrack, togglePlay } = usePlayer();
    const [tracks, setTracks] = useState<FavouriteTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const { data } = await axios.get('/api/my-favourites', { withCredentials: true });
                setTracks(data);
                // Check repost status
                if (data.length > 0) {
                    try {
                        const { data: repostData } = await axios.post('/api/tracks/reposts/check', { trackIds: data.map((t: any) => t.id) }, { withCredentials: true });
                        setReposts(repostData);
                    } catch {}
                }
            } catch {}
            setLoading(false);
        })();
    }, [user]);

    if (!user) {
        return (
            <DiscoveryLayout>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>
                    <a href="/api/auth/discord/login" style={{ color: colors.primary }}>Log in</a>&nbsp;to view your favourites
                </div>
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout>
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1300px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <Heart size={32} color="#EF4444" />
                    <div>
                        <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>My Favourites</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Tracks you've liked</p>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Loading...</div>
                ) : tracks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
                        <Heart size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <p>No favourites yet. Heart a track to save it here!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                        {tracks.map(track => (
                            <Link
                                key={track.id}
                                to={`/track/${track.profile.username}/${track.slug || track.id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div
                                    style={{
                                        backgroundColor: '#242C3D', borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.05)', padding: '14px',
                                        display: 'flex', flexDirection: 'column', gap: '12px',
                                        transition: 'border-color 0.2s, transform 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${colors.primary}55`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <div
                                        style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); player.currentTrack?.id === track.id ? togglePlay() : setTrack(track, tracks); }}
                                    >
                                        {track.coverUrl ? (
                                            <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', backgroundColor: '#1A1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FujiLogo size={20} color={colors.primary} opacity={0.25} />
                                            </div>
                                        )}
                                        <div
                                            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                                        >
                                            {player.currentTrack?.id === track.id && player.isPlaying
                                                ? <Pause size={20} fill="white" color="white" />
                                                : <Play size={20} fill="white" color="white" />}
                                        </div>
                                        {/* Repost button */}
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); axios.post(`/api/tracks/${track.id}/repost`, {}, { withCredentials: true }).then(res => setReposts(prev => ({ ...prev, [track.id]: res.data.reposted }))).catch(() => {}); }}
                                            style={{ position: 'absolute', bottom: '6px', right: '6px', background: reposts[track.id] ? colors.primary : 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', transition: 'all 0.2s', opacity: 0 }}
                                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                            onMouseLeave={e => { if (!reposts[track.id]) e.currentTarget.style.opacity = '0'; }}
                                        >
                                            <Repeat2 size={14} />
                                        </button>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.profile.displayName || track.profile.username}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
