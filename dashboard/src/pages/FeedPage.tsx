import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { colors } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';
import axios from 'axios';
import { Rss, Play, ChevronDown, UserPlus } from 'lucide-react';

interface FeedTrack {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    playCount: number;
    createdAt: string;
    profile: { userId: string; username: string; displayName: string | null; avatar: string | null };
    genres: { genre: { name: string; slug: string } }[];
}

export const FeedPage: React.FC = () => {
    const { user } = useAuth();
    const { setTrack, player } = usePlayer();
    const [tracks, setTracks] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchFeed = useCallback(async (cursor?: string) => {
        try {
            if (cursor) setLoadingMore(true);
            const params = new URLSearchParams({ limit: '30' });
            if (cursor) params.set('cursor', cursor);
            const { data } = await axios.get(`/api/feed?${params}`, { withCredentials: true });
            if (cursor) {
                setTracks(prev => [...prev, ...data.tracks]);
            } else {
                setTracks(data.tracks);
            }
            setHasMore(data.hasMore);
            setNextCursor(data.nextCursor);
        } catch {}
        setLoading(false);
        setLoadingMore(false);
    }, []);

    useEffect(() => {
        if (user) fetchFeed();
    }, [user, fetchFeed]);

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / 1000;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    if (!user) {
        return (
            <DiscoveryLayout>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>
                    <a href="/api/auth/discord/login" style={{ color: colors.primary }}>Log in</a>&nbsp;to view your feed
                </div>
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout>
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <Rss size={32} color={colors.primary} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>Your Feed</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Latest tracks from artists you follow</p>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Loading...</div>
                ) : tracks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
                        <UserPlus size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <p>Your feed is empty. Follow some artists to see their tracks here!</p>
                        <Link to="/artists" style={{ color: colors.primary, fontWeight: 600, textDecoration: 'none' }}>
                            Browse Artists
                        </Link>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                            {tracks.map(track => (
                                <div
                                    key={track.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setTrack(track, tracks)}
                                >
                                    <div
                                        style={{
                                            aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden',
                                            position: 'relative', marginBottom: '12px',
                                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)', backgroundColor: '#1A1E2E',
                                        }}
                                    >
                                        {track.coverUrl ? (
                                            <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FujiLogo size={48} color={colors.primary} opacity={0.3} />
                                            </div>
                                        )}
                                        {/* Play overlay */}
                                        <div
                                            style={{
                                                position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                opacity: player.currentTrack?.id === track.id ? 1 : 0, transition: 'opacity 0.2s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={e => { if (player.currentTrack?.id !== track.id) e.currentTarget.style.opacity = '0'; }}
                                        >
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                                <Play size={24} fill="white" color="white" />
                                            </div>
                                        </div>
                                        {/* Play count */}
                                        <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px 8px', borderRadius: '6px', color: 'white', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Play size={8} fill="white" /> {track.playCount >= 1000 ? (track.playCount / 1000).toFixed(1) + 'K' : track.playCount}
                                        </div>
                                        {/* Time badge */}
                                        <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: '6px', color: '#B9C3CE', fontSize: '10px', fontWeight: 600 }}>
                                            {formatTime(track.createdAt)}
                                        </div>
                                    </div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</h4>
                                    <Link
                                        to={`/profile/${track.profile.username}`}
                                        style={{ margin: 0, fontSize: '12px', color: '#B9C3CE', fontWeight: 600, textDecoration: 'none' }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {track.profile.displayName || track.profile.username}
                                    </Link>
                                </div>
                            ))}
                        </div>
                        {hasMore && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                                <button
                                    onClick={() => fetchFeed(nextCursor || undefined)}
                                    disabled={loadingMore}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '12px 32px', backgroundColor: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                                        color: 'white', cursor: loadingMore ? 'not-allowed' : 'pointer',
                                        fontSize: '14px', fontWeight: 600, opacity: loadingMore ? 0.5 : 1,
                                    }}
                                >
                                    <ChevronDown size={16} /> {loadingMore ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DiscoveryLayout>
    );
};
