
import React from 'react';
import {
    Play, Heart, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Pause, List, X, Repeat2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayer } from './PlayerProvider';
import { colors } from '../theme/theme';
import axios from 'axios';

export const GlobalPlayer: React.FC = () => {
    const { player, togglePlay, setVolume, seek, nextTrack, prevTrack, toggleShuffle, setRepeatMode, removeFromQueue, jumpToIndex } = usePlayer();
    const [isFavourited, setIsFavourited] = React.useState(false);
    const [isReposted, setIsReposted] = React.useState(false);
    const [showQueue, setShowQueue] = React.useState(false);
    const lastCheckedTrackId = React.useRef<string | null>(null);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
        if (!player.currentTrack || player.currentTrack.id === lastCheckedTrackId.current) return;
        lastCheckedTrackId.current = player.currentTrack.id ?? null;
        axios.get(`/api/tracks/${player.currentTrack.id}/favourite`, { withCredentials: true })
            .then(res => setIsFavourited(res.data.favourited))
            .catch(() => setIsFavourited(false));
        const trackId = player.currentTrack.id;
        axios.post('/api/tracks/reposts/check', { trackIds: [trackId] }, { withCredentials: true })
            .then((res: any) => setIsReposted(!!res.data[trackId!]))
            .catch(() => setIsReposted(false));
    }, [player.currentTrack?.id]);

    const toggleFavourite = async () => {
        if (!player.currentTrack) return;
        try {
            const { data } = await axios.post(`/api/tracks/${player.currentTrack.id}/favourite`, {}, { withCredentials: true });
            setIsFavourited(data.favourited);
        } catch { /* not logged in */ }
    };

    const toggleRepost = async () => {
        if (!player.currentTrack) return;
        try {
            const { data } = await axios.post(`/api/tracks/${player.currentTrack.id}/repost`, {}, { withCredentials: true });
            setIsReposted(data.reposted);
        } catch { /* not logged in */ }
    };

    if (!player.currentTrack) return null;

    const formatTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return '0:00';
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => seek(parseFloat(e.target.value));
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e.target.value));

    const playerHeight = isMobile ? 100 : 80;
    const bottomOffset = isMobile ? 60 : 0;

    const t = player.currentTrack as any;
    const titleTo = (t.username && t.slug) ? `/track/${t.username}/${t.slug}` : (t.entryRoute || null);
    const artistTo = `/profile/${t.username || t.artist}`;

    return (
        <>
            {/* ── Queue Panel ── */}
            {showQueue && (
                <div style={{
                    position: 'fixed',
                    bottom: playerHeight + bottomOffset,
                    left: 0, right: 0,
                    maxHeight: '55vh',
                    backgroundColor: '#1A1E2E',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    zIndex: 999,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>
                            Queue <span style={{ color: '#B9C3CE', fontWeight: 400 }}>({player.queue.length})</span>
                        </span>
                        <button onClick={() => setShowQueue(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B9C3CE', display: 'flex', padding: '4px' }}>
                            <X size={18} />
                        </button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {player.queue.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: '#B9C3CE', fontSize: '13px' }}>No tracks in queue</div>
                        ) : player.queue.map((qt: any, idx: number) => {
                            const isCurrent = idx === player.currentIndex;
                            return (
                                <div
                                    key={qt.id + idx}
                                    onClick={() => jumpToIndex(idx)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '8px 16px',
                                        backgroundColor: isCurrent ? 'rgba(43,140,113,0.12)' : 'transparent',
                                        cursor: 'pointer',
                                        borderLeft: isCurrent ? `3px solid ${colors.primary}` : '3px solid transparent',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                                >
                                    <span style={{ width: '20px', textAlign: 'center', fontSize: '12px', color: isCurrent ? colors.primary : '#B9C3CE', flexShrink: 0, fontWeight: isCurrent ? 700 : 400 }}>
                                        {isCurrent ? '▶' : idx + 1}
                                    </span>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#0f1320', flexShrink: 0 }}>
                                        {(qt.coverUrl || qt.cover) ? (
                                            <img src={qt.coverUrl || qt.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Play size={14} color="rgba(255,255,255,0.2)" />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'white' : '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {qt.title}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#B9C3CE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {qt.artist || qt.profile?.displayName || qt.profile?.username || 'Unknown'}
                                        </p>
                                    </div>
                                    {!isCurrent && (
                                        <button
                                            onClick={e => { e.stopPropagation(); removeFromQueue(idx); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B9C3CE', display: 'flex', padding: '6px', flexShrink: 0, opacity: 0.5, transition: 'opacity 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Player Bar ── */}
            <footer style={{
                height: `${playerHeight}px`,
                backgroundColor: '#1A1E2E',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                position: 'fixed',
                bottom: bottomOffset,
                left: 0, right: 0,
                zIndex: 1000,
                boxShadow: '0 -10px 25px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: isMobile ? 'flex-start' : 'space-between',
                padding: isMobile ? '0' : '0 24px',
            }}>
                {isMobile ? (
                    /* ── MOBILE: 2-row layout ── */
                    <>
                        {/* Row 1: Cover + title/artist + fav + queue */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px 2px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: '#0f1320', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                {player.currentTrack.cover ? (
                                    <img src={player.currentTrack.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Play size={16} color="rgba(255,255,255,0.2)" />
                                    </div>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {titleTo ? (
                                    <Link to={titleTo} style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {player.currentTrack.title}
                                    </Link>
                                ) : (
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {player.currentTrack.title}
                                    </p>
                                )}
                                <Link to={artistTo} style={{ display: 'block', fontSize: '11px', color: '#B9C3CE', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {player.currentTrack.artist}
                                </Link>
                            </div>
                            <button onClick={toggleFavourite} aria-label={isFavourited ? 'Remove favourite' : 'Add favourite'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFavourited ? '#EF4444' : '#B9C3CE', padding: '6px', flexShrink: 0 }}>
                                <Heart size={18} fill={isFavourited ? '#EF4444' : 'none'} />
                            </button>
                            <button onClick={toggleRepost} aria-label={isReposted ? 'Remove repost' : 'Repost'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isReposted ? colors.primary : '#B9C3CE', padding: '6px', flexShrink: 0 }}>
                                <Repeat2 size={18} />
                            </button>
                            <button onClick={() => setShowQueue(q => !q)} aria-label="Toggle queue" style={{ background: 'none', border: 'none', cursor: 'pointer', color: showQueue ? colors.primary : '#B9C3CE', padding: '6px', flexShrink: 0 }}>
                                <List size={18} />
                            </button>
                        </div>
                        {/* Row 2: Prev / Play / Next + seek + duration */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 10px 16px' }}>
                            <button onClick={prevTrack} aria-label="Previous" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: '4px', flexShrink: 0 }}>
                                <SkipBack size={20} />
                            </button>
                            <button onClick={togglePlay} aria-label={player.isPlaying ? 'Pause' : 'Play'} style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                {player.isPlaying
                                    ? <Pause fill="#1A1E2E" size={16} />
                                    : <Play fill="#1A1E2E" size={16} style={{ marginLeft: '2px' }} />}
                            </button>
                            <button onClick={nextTrack} aria-label="Next" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: '4px', flexShrink: 0 }}>
                                <SkipForward size={20} />
                            </button>
                            <input
                                type="range" min="0" max={player.duration || 100} value={player.currentTime}
                                onChange={handleSeek} aria-label="Seek"
                                style={{ flex: 1, cursor: 'pointer', accentColor: colors.primary, height: '4px' }}
                            />
                            <span style={{ fontSize: '10px', color: '#B9C3CE', flexShrink: 0, width: '34px', textAlign: 'right' }}>
                                {formatTime(player.duration)}
                            </span>
                        </div>
                    </>
                ) : (
                    /* ── DESKTOP: 3-column layout ── */
                    <>
                        {/* Left: Track info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%', minWidth: 0 }}>
                            <div style={{ width: '48px', height: '48px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                                {player.currentTrack.cover ? (
                                    <img src={player.currentTrack.cover} alt={`${player.currentTrack.title} by ${player.currentTrack.artist}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Play size={20} color="rgba(255,255,255,0.2)" />
                                    </div>
                                )}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                {titleTo ? (
                                    <Link to={titleTo}
                                        onMouseEnter={e => (e.currentTarget.style.color = colors.primary)}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'white')}
                                        style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px', transition: 'color 0.2s' }}>
                                        {player.currentTrack.title}
                                    </Link>
                                ) : (
                                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {player.currentTrack.title}
                                    </p>
                                )}
                                <Link to={artistTo}
                                    onMouseEnter={e => (e.currentTarget.style.color = colors.primary)}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#B9C3CE')}
                                    style={{ display: 'block', fontSize: '11px', color: '#B9C3CE', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.2s' }}>
                                    {player.currentTrack.artist}
                                </Link>
                            </div>
                            <button onClick={toggleFavourite} aria-label={isFavourited ? 'Remove favourite' : 'Add favourite'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFavourited ? '#EF4444' : '#B9C3CE', padding: '4px', flexShrink: 0, transition: 'color 0.2s' }}>
                                <Heart size={18} fill={isFavourited ? '#EF4444' : 'none'} />
                            </button>
                            <button onClick={toggleRepost} aria-label={isReposted ? 'Remove repost' : 'Repost'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isReposted ? colors.primary : '#B9C3CE', padding: '4px', flexShrink: 0, transition: 'color 0.2s' }}>
                                <Repeat2 size={18} />
                            </button>
                        </div>

                        {/* Center: Transport + seek */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '40%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                <button onClick={toggleShuffle} aria-pressed={player.isShuffle} aria-label={player.isShuffle ? 'Shuffle on' : 'Shuffle off'}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: player.isShuffle ? colors.primary : '#B9C3CE' }}>
                                    <Shuffle size={18} />
                                </button>
                                <button onClick={prevTrack} aria-label="Previous track"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'white' }}>
                                    <SkipBack size={20} />
                                </button>
                                <button onClick={togglePlay} aria-label={player.isPlaying ? 'Pause' : 'Play'}
                                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'transform 0.1s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                    {player.isPlaying ? <Pause fill="#1A1E2E" size={20} /> : <Play fill="#1A1E2E" size={20} style={{ marginLeft: '2px' }} />}
                                </button>
                                <button onClick={nextTrack} aria-label="Next track"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'white' }}>
                                    <SkipForward size={20} />
                                </button>
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => {
                                            if (player.repeatMode === 'none') setRepeatMode('all');
                                            else if (player.repeatMode === 'all') setRepeatMode('one');
                                            else setRepeatMode('none');
                                        }}
                                        aria-label={player.repeatMode === 'none' ? 'Repeat off' : player.repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
                                        aria-pressed={player.repeatMode !== 'none'}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: player.repeatMode !== 'none' ? colors.primary : '#B9C3CE', position: 'relative' }}>
                                        <Repeat size={18} />
                                        {player.repeatMode === 'one' && (
                                            <span style={{ position: 'absolute', fontSize: '8px', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontWeight: 'bold', color: colors.primary, pointerEvents: 'none' }} aria-hidden="true">1</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '400px' }}>
                                <span style={{ fontSize: '10px', color: 'rgba(185,195,206,0.6)', width: '35px', textAlign: 'right' }}>{formatTime(player.currentTime)}</span>
                                <input type="range" min="0" max={player.duration || 100} value={player.currentTime} onChange={handleSeek} aria-label="Seek"
                                    aria-valuetext={`${formatTime(player.currentTime)} of ${formatTime(player.duration)}`}
                                    style={{ flex: 1, cursor: 'pointer', accentColor: colors.primary, height: '4px' }} />
                                <span style={{ fontSize: '10px', color: 'rgba(185,195,206,0.6)', width: '35px' }}>{formatTime(player.duration)}</span>
                            </div>
                        </div>

                        {/* Right: Volume + Queue */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', width: '30%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Volume2 size={18} color="#B9C3CE" aria-hidden="true" />
                                <input type="range" min="0" max="1" step="0.01" value={player.volume} onChange={handleVolumeChange}
                                    aria-label="Volume" aria-valuetext={`${Math.round(player.volume * 100)}%`}
                                    style={{ width: '96px', height: '4px', cursor: 'pointer', accentColor: colors.primary }} />
                            </div>
                            <button onClick={() => setShowQueue(q => !q)} aria-label="Toggle queue" aria-pressed={showQueue}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: showQueue ? colors.primary : '#B9C3CE', padding: '4px', transition: 'color 0.2s' }}>
                                <List size={20} />
                            </button>
                        </div>
                    </>
                )}
            </footer>
        </>
    );
};

