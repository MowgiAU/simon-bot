
import React from 'react';
import {
    Play, Heart, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Pause, List, X, Repeat2, ChevronUp, ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayer } from './PlayerProvider';
import { colors } from '../theme/theme';
import axios from 'axios';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const GlobalPlayer: React.FC = () => {
    const { player, togglePlay, setVolume, seek, nextTrack, prevTrack, toggleShuffle, setRepeatMode, removeFromQueue, jumpToIndex, setPlaybackRate } = usePlayer();
    const [isFavourited, setIsFavourited] = React.useState(false);
    const [isReposted, setIsReposted] = React.useState(false);
    const [showQueue, setShowQueue] = React.useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = React.useState(false);
    const lastCheckedTrackId = React.useRef<string | null>(null);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024);
    const [isCollapsed, setIsCollapsed] = React.useState(() => localStorage.getItem('player_collapsed') === '1');
    const speedMenuRef = React.useRef<HTMLDivElement>(null);

    const toggleCollapse = () => {
        setIsCollapsed(v => {
            const next = !v;
            localStorage.setItem('player_collapsed', next ? '1' : '0');
            return next;
        });
    };

    // Close speed menu on outside click
    React.useEffect(() => {
        if (!showSpeedMenu) return;
        const handler = (e: MouseEvent) => {
            if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
                setShowSpeedMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSpeedMenu]);

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

    const collapsedHeight = 44;
    const expandedHeight = isMobile ? 100 : 80;
    const playerHeight = isCollapsed ? collapsedHeight : expandedHeight;
    const bottomOffset = isMobile ? 60 : 0;

    const t = player.currentTrack as any;
    const trackSlugOrId = t.slug || t.id || null;
    const titleTo = (t.username && trackSlugOrId) ? `/track/${t.username}/${trackSlugOrId}` : (t.entryRoute || null);
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
                    backgroundColor: 'rgba(22,25,37,0.88)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
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
                backgroundColor: 'rgba(26,30,46,0.75)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                position: 'fixed',
                bottom: bottomOffset,
                left: 0, right: 0,
                zIndex: 1000,
                boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: isCollapsed ? 'row' : isMobile ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'space-between' : isMobile ? 'flex-start' : 'space-between',
                padding: isCollapsed ? '0 16px' : isMobile ? '0' : '0 24px',
                transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}>
                {/* ── Collapsed mini bar ── */}
                {isCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#0f1320', flexShrink: 0 }}>
                            {player.currentTrack.cover
                                ? <img src={player.currentTrack.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={10} color="rgba(255,255,255,0.2)" /></div>
                            }
                        </div>
                        <button onClick={togglePlay} aria-label={player.isPlaying ? 'Pause' : 'Play'}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s' }}
                            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}>
                            {player.isPlaying ? <Pause fill="#1A1E2E" size={12} /> : <Play fill="#1A1E2E" size={12} style={{ marginLeft: '1px' }} />}
                        </button>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {player.currentTrack.title}
                            </p>
                        </div>
                        {/* Progress bar */}
                        <div style={{ width: '120px', height: '3px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', flexShrink: 0, overflow: 'hidden' }}>
                            <div style={{ width: `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%`, height: '100%', backgroundColor: colors.primary, borderRadius: '2px', transition: 'width 0.5s linear' }} />
                        </div>
                        <button onClick={toggleCollapse} aria-label="Expand player"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B9C3CE', padding: '4px', flexShrink: 0, display: 'flex', transition: 'color 0.2s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#B9C3CE')}>
                            <ChevronUp size={16} />
                        </button>
                    </div>
                )}
                {isCollapsed && <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>}
                {!isCollapsed && isMobile ? (
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
                            {/* Mobile speed */}
                            <div ref={speedMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                                <button onClick={() => setShowSpeedMenu(s => !s)} aria-label="Playback speed"
                                    style={{ background: 'none', border: `1px solid ${player.playbackRate !== 1 ? colors.primary + '66' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', cursor: 'pointer', color: player.playbackRate !== 1 ? colors.primary : '#B9C3CE', padding: '2px 5px', fontSize: '10px', fontWeight: 700, minWidth: '32px', textAlign: 'center' }}>
                                    {player.playbackRate === 1 ? '1×' : `${player.playbackRate}×`}
                                </button>
                                {showSpeedMenu && (
                                    <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1010, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
                                        {SPEED_OPTIONS.map(rate => (
                                            <button key={rate} onClick={() => { setPlaybackRate(rate); setShowSpeedMenu(false); }}
                                                style={{ background: player.playbackRate === rate ? `${colors.primary}22` : 'none', border: 'none', cursor: 'pointer', color: player.playbackRate === rate ? colors.primary : '#E2E8F0', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: player.playbackRate === rate ? 700 : 400, textAlign: 'left' }}>
                                                {rate === 1 ? '1× Normal' : `${rate}×`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                ) : !isCollapsed ? (
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

                        {/* Right: Volume + Speed + Queue */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', width: '30%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Volume2 size={18} color="#B9C3CE" aria-hidden="true" />
                                <input type="range" min="0" max="1" step="0.01" value={player.volume} onChange={handleVolumeChange}
                                    aria-label="Volume" aria-valuetext={`${Math.round(player.volume * 100)}%`}
                                    style={{ width: '96px', height: '4px', cursor: 'pointer', accentColor: colors.primary }} />
                            </div>
                            {/* Speed control */}
                            <div ref={speedMenuRef} style={{ position: 'relative' }}>
                                <button onClick={() => setShowSpeedMenu(s => !s)} aria-label="Playback speed"
                                    style={{ background: 'none', border: `1px solid ${player.playbackRate !== 1 ? colors.primary + '66' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', cursor: 'pointer', color: player.playbackRate !== 1 ? colors.primary : '#B9C3CE', padding: '2px 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em', transition: 'all 0.15s', minWidth: '36px', textAlign: 'center' }}>
                                    {player.playbackRate === 1 ? '1×' : `${player.playbackRate}×`}
                                </button>
                                {showSpeedMenu && (
                                    <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1010, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
                                        <p style={{ margin: '0 0 4px', padding: '0 8px', fontSize: '10px', fontWeight: 600, color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Speed</p>
                                        {SPEED_OPTIONS.map(rate => (
                                            <button key={rate} onClick={() => { setPlaybackRate(rate); setShowSpeedMenu(false); }}
                                                style={{ background: player.playbackRate === rate ? `${colors.primary}22` : 'none', border: 'none', cursor: 'pointer', color: player.playbackRate === rate ? colors.primary : '#E2E8F0', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: player.playbackRate === rate ? 700 : 400, textAlign: 'left', transition: 'background 0.1s' }}
                                                onMouseEnter={e => { if (player.playbackRate !== rate) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                                onMouseLeave={e => { if (player.playbackRate !== rate) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                                                {rate === 1 ? '1× Normal' : `${rate}×`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowQueue(q => !q)} aria-label="Toggle queue" aria-pressed={showQueue}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: showQueue ? colors.primary : '#B9C3CE', padding: '4px', transition: 'color 0.2s' }}>
                                <List size={20} />
                            </button>
                            <button onClick={toggleCollapse} aria-label="Collapse player"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B9C3CE', padding: '4px', transition: 'color 0.2s' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#B9C3CE')}>
                                <ChevronDown size={18} />
                            </button>
                        </div>
                    </>
                ) : null}
            </footer>
        </>
    );
};

