import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { colors } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';
import axios from 'axios';
import { Rss, Play, Pause, ChevronDown, UserPlus, Heart, Repeat2, Share2, MessageCircle } from 'lucide-react';

interface FeedTrack {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    playCount: number;
    createdAt: string;
    duration: number;
    waveformPeaks: number[] | null;
    profile: { userId: string; username: string; displayName: string | null; avatar: string | null };
    genres: { genre: { name: string; slug: string } }[];
    _count: { favourites: number; comments: number; reposts: number };
    repostedBy: { username: string; displayName: string | null } | null;
    repostedAt: string | null;
}

// ── Waveform component ──────────────────────────
const Waveform: React.FC<{
    peaks: number[];
    trackId: string;
    isPlaying: boolean;
    progress: number; // 0-1
    onClick: () => void;
    onSeek: (pct: number) => void;
    color?: string;
}> = ({ peaks, isPlaying, progress, onClick, onSeek, color = colors.primary }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState(false);
    const [hoverX, setHoverX] = useState(0);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        if (isPlaying) {
            onSeek(x);
        } else {
            onClick();
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverX((e.clientX - rect.left) / rect.width);
    };

    const barCount = peaks.length;

    return (
        <div
            ref={containerRef}
            onClick={handleClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onMouseMove={handleMouseMove}
            style={{
                width: '100%', height: '60px', cursor: 'pointer', position: 'relative',
                display: 'flex', alignItems: 'center',
            }}
        >
            <svg width="100%" height="60" preserveAspectRatio="none" viewBox={`0 0 ${barCount} 60`}
                style={{ display: 'block' }}
            >
                {peaks.map((peak, i) => {
                    const h = Math.max(2, peak * 50);
                    const y = (60 - h) / 2;
                    const pct = i / barCount;
                    const played = pct < progress;
                    const hovered = hover && pct < hoverX;
                    let fill = 'rgba(255,255,255,0.15)';
                    if (played) fill = color;
                    else if (hovered) fill = 'rgba(255,255,255,0.3)';
                    return <rect key={i} x={i} y={y} width={0.6} height={h} fill={fill} rx={0.2} />;
                })}
            </svg>
        </div>
    );
};

// ── Feed card ─────────────────────────────────
const FeedCard: React.FC<{
    track: FeedTrack;
    allTracks: FeedTrack[];
    isMobile: boolean;
    isFavourited: boolean;
    isReposted: boolean;
    onToggleFavourite: (id: string) => void;
    onToggleRepost: (id: string) => void;
}> = ({ track, allTracks, isMobile, isFavourited, isReposted, onToggleFavourite, onToggleRepost }) => {
    const { setTrack, player, seek } = usePlayer();
    const navigate = useNavigate();
    const isCurrentTrack = player.currentTrack?.id === track.id;
    const isPlaying = isCurrentTrack && player.isPlaying;
    const progress = isCurrentTrack ? (player.currentTime / (player.duration || 1)) : 0;

    const defaultPeaks = useMemo(() => {
        // Generate deterministic fake peaks from track id if no waveform
        const seed = track.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return Array.from({ length: 200 }, (_, i) => {
            const v = Math.sin(i * 0.15 + seed) * 0.3 + Math.sin(i * 0.05 + seed * 2) * 0.2 + 0.4;
            return Math.max(0.05, Math.min(1, v));
        });
    }, [track.id]);

    const peaks = (track.waveformPeaks as number[] | null) || defaultPeaks;

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / 1000;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    const formatCount = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);

    const handlePlayClick = () => {
        setTrack(track, allTracks);
    };

    const handleSeek = (pct: number) => {
        seek(pct * (player.duration || 0));
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/track/${track.profile.username}/${track.slug || track.id}`;
        try {
            await navigator.clipboard.writeText(url);
        } catch {}
    };

    return (
        <div style={{
            backgroundColor: colors.surface,
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
        }}>
            {/* Repost banner */}
            {track.repostedBy && (
                <div style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                    <Repeat2 size={13} />
                    <Link to={`/profile/${track.repostedBy.username}`} style={{ color: colors.textSecondary, textDecoration: 'none', fontWeight: 600 }}
                        onMouseEnter={e => e.currentTarget.style.color = colors.primary}
                        onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}>
                        {track.repostedBy.displayName || track.repostedBy.username}
                    </Link>
                    reposted
                </div>
            )}

            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 0 : '16px',
                padding: isMobile ? 0 : '16px',
            }}>
                {/* Album artwork + play button */}
                <div
                    style={{
                        width: isMobile ? '100%' : '160px',
                        height: isMobile ? '200px' : '160px',
                        minWidth: isMobile ? undefined : '160px',
                        borderRadius: isMobile ? 0 : '6px',
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: '#1A1E2E',
                        cursor: 'pointer',
                    }}
                    onClick={handlePlayClick}
                >
                    {track.coverUrl ? (
                        <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FujiLogo size={48} color={colors.primary} opacity={0.3} />
                        </div>
                    )}
                    {/* Play overlay */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: isPlaying ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isPlaying ? 1 : 0, transition: 'opacity 0.2s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.opacity = '0'; }}
                    >
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '50%',
                            backgroundColor: colors.primary, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                        }}>
                            {isPlaying
                                ? <Pause size={20} fill="white" color="white" />
                                : <Play size={20} fill="white" color="white" style={{ marginLeft: '2px' }} />}
                        </div>
                    </div>
                </div>

                {/* Right section: info + waveform + actions */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '12px' : 0 }}>
                    {/* Header: avatar + artist name + time */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <Link to={`/profile/${track.profile.username}`}>
                                {track.profile.avatar ? (
                                    <img src={track.profile.avatar} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: colors.primary + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: colors.primary, fontWeight: 700 }}>
                                        {(track.profile.displayName || track.profile.username || '?')[0].toUpperCase()}
                                    </div>
                                )}
                            </Link>
                            <Link to={`/profile/${track.profile.username}`} style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}
                                onMouseEnter={e => e.currentTarget.style.color = colors.primary}
                                onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}>
                                {track.profile.displayName || track.profile.username}
                            </Link>
                        </div>
                        <span style={{ color: colors.textTertiary, fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {formatTime(track.repostedAt || track.createdAt)}
                        </span>
                    </div>

                    {/* Track title */}
                    <Link to={`/track/${track.profile.username}/${track.slug || track.id}`}
                        style={{
                            color: colors.textPrimary, textDecoration: 'none', fontSize: '15px',
                            fontWeight: 700, marginBottom: '8px', display: 'block',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = colors.primary}
                        onMouseLeave={e => e.currentTarget.style.color = colors.textPrimary}>
                        {track.title}
                    </Link>

                    {/* Waveform */}
                    <Waveform
                        peaks={peaks}
                        trackId={track.id}
                        isPlaying={isCurrentTrack}
                        progress={progress}
                        onClick={handlePlayClick}
                        onSeek={handleSeek}
                    />

                    {/* Genre tags */}
                    {track.genres.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {track.genres.slice(0, 3).map(g => (
                                <Link key={g.genre.slug} to={`/category/${g.genre.slug}`}
                                    style={{
                                        padding: '2px 8px', borderRadius: '3px', fontSize: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textTertiary,
                                        textDecoration: 'none', fontWeight: 500,
                                    }}>
                                    #{g.genre.name}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Actions bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px',
                        marginTop: '10px', paddingTop: '10px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        {/* Like */}
                        <button
                            onClick={() => onToggleFavourite(track.id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                color: isFavourited ? '#EF4444' : colors.textTertiary,
                                fontSize: '12px', padding: 0, transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => { if (!isFavourited) e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { if (!isFavourited) e.currentTarget.style.color = colors.textTertiary; }}
                        >
                            <Heart size={15} fill={isFavourited ? '#EF4444' : 'none'} />
                            <span>{track._count.favourites || ''}</span>
                        </button>

                        {/* Repost */}
                        <button
                            onClick={() => onToggleRepost(track.id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                color: isReposted ? colors.primary : colors.textTertiary,
                                fontSize: '12px', padding: 0, transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => { if (!isReposted) e.currentTarget.style.color = colors.primary; }}
                            onMouseLeave={e => { if (!isReposted) e.currentTarget.style.color = colors.textTertiary; }}
                        >
                            <Repeat2 size={15} />
                            <span>{track._count.reposts || ''}</span>
                        </button>

                        {/* Share */}
                        <button
                            onClick={handleShare}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                color: colors.textTertiary, fontSize: '12px', padding: 0,
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
                            onMouseLeave={e => e.currentTarget.style.color = colors.textTertiary}
                        >
                            <Share2 size={14} />
                        </button>

                        {/* Comments */}
                        <button
                            onClick={() => navigate(`/track/${track.profile.username}/${track.slug || track.id}`)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                color: colors.textTertiary, fontSize: '12px', padding: 0,
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
                            onMouseLeave={e => e.currentTarget.style.color = colors.textTertiary}
                        >
                            <MessageCircle size={14} />
                            <span>{track._count.comments || ''}</span>
                        </button>

                        {/* Spacer + play count */}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: colors.textTertiary, fontSize: '11px' }}>
                            <Play size={10} fill={colors.textTertiary} />
                            <span>{formatCount(track.playCount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Main feed page ────────────────────────────
export const FeedPage: React.FC = () => {
    const { user } = useAuth();
    const [tracks, setTracks] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [favourites, setFavourites] = useState<Record<string, boolean>>({});
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchFeed = useCallback(async (cursor?: string) => {
        try {
            if (cursor) setLoadingMore(true);
            const params = new URLSearchParams({ limit: '20' });
            if (cursor) params.set('cursor', cursor);
            const { data } = await axios.get(`/api/feed?${params}`, { withCredentials: true });
            const newTracks = data.tracks as FeedTrack[];

            if (cursor) {
                setTracks(prev => [...prev, ...newTracks]);
            } else {
                setTracks(newTracks);
            }
            setHasMore(data.hasMore);
            setNextCursor(data.nextCursor);

            // Batch check favourites and reposts for new tracks
            const ids = newTracks.map((t: FeedTrack) => t.id);
            if (ids.length > 0) {
                const [favRes, repRes] = await Promise.all([
                    axios.post('/api/tracks/favourites/check', { trackIds: ids }, { withCredentials: true }).catch(() => ({ data: {} })),
                    axios.post('/api/tracks/reposts/check', { trackIds: ids }, { withCredentials: true }).catch(() => ({ data: {} })),
                ]);
                setFavourites(prev => ({ ...prev, ...favRes.data }));
                setReposts(prev => ({ ...prev, ...repRes.data }));
            }
        } catch {}
        setLoading(false);
        setLoadingMore(false);
    }, []);

    useEffect(() => {
        if (user) fetchFeed();
    }, [user, fetchFeed]);

    const toggleFavourite = async (trackId: string) => {
        try {
            const { data } = await axios.post(`/api/tracks/${trackId}/favourite`, {}, { withCredentials: true });
            setFavourites(prev => ({ ...prev, [trackId]: data.favourited }));
            setTracks(prev => prev.map(t =>
                t.id === trackId ? { ...t, _count: { ...t._count, favourites: t._count.favourites + (data.favourited ? 1 : -1) } } : t
            ));
        } catch {}
    };

    const toggleRepost = async (trackId: string) => {
        try {
            const { data } = await axios.post(`/api/tracks/${trackId}/repost`, {}, { withCredentials: true });
            setReposts(prev => ({ ...prev, [trackId]: data.reposted }));
            setTracks(prev => prev.map(t =>
                t.id === trackId ? { ...t, _count: { ...t._count, reposts: t._count.reposts + (data.reposted ? 1 : -1) } } : t
            ));
        } catch {}
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
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <Rss size={28} color={colors.primary} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: isMobile ? '1.4rem' : '1.8rem' }}>Your Feed</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '12px' }}>Latest tracks from artists you follow</p>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tracks.map(track => (
                                <FeedCard
                                    key={track.id + (track.repostedAt || '')}
                                    track={track}
                                    allTracks={tracks}
                                    isMobile={isMobile}
                                    isFavourited={!!favourites[track.id]}
                                    isReposted={!!reposts[track.id]}
                                    onToggleFavourite={toggleFavourite}
                                    onToggleRepost={toggleRepost}
                                />
                            ))}
                        </div>
                        {hasMore && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                                <button
                                    onClick={() => fetchFeed(nextCursor || undefined)}
                                    disabled={loadingMore}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '12px 32px', backgroundColor: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
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
