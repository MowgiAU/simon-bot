
import React from 'react';
import { 
    Play, Heart, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Pause
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from './PlayerProvider';
import { colors } from '../theme/theme';
import axios from 'axios';

export const GlobalPlayer: React.FC = () => {
    const { player, togglePlay, setVolume, seek, nextTrack, prevTrack, toggleShuffle, setRepeatMode } = usePlayer();
    const navigate = useNavigate();
    const [isFavourited, setIsFavourited] = React.useState(false);
    const lastCheckedTrackId = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (!player.currentTrack || player.currentTrack.id === lastCheckedTrackId.current) return;
        lastCheckedTrackId.current = player.currentTrack.id;
        axios.get(`/api/tracks/${player.currentTrack.id}/favourite`, { withCredentials: true })
            .then(res => setIsFavourited(res.data.favourited))
            .catch(() => setIsFavourited(false));
    }, [player.currentTrack?.id]);

    const toggleFavourite = async () => {
        if (!player.currentTrack) return;
        try {
            const { data } = await axios.post(`/api/tracks/${player.currentTrack.id}/favourite`, {}, { withCredentials: true });
            setIsFavourited(data.favourited);
        } catch { /* not logged in */ }
    };
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!player.currentTrack) return null;

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        seek(parseFloat(e.target.value));
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    return (
        <footer style={{ 
            height: isMobile ? '96px' : '80px', backgroundColor: '#1A1E2E', borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 24px', 
            position: 'fixed', bottom: isMobile ? '60px' : 0, left: 0, right: 0, zIndex: 1000,
            boxShadow: '0 -10px 25px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px', width: isMobile ? '45%' : '30%', minWidth: 0 }}>
                <div style={{ width: isMobile ? '44px' : '48px', height: isMobile ? '44px' : '48px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                    {player.currentTrack.cover ? (
                        <img src={player.currentTrack.cover} alt={`${player.currentTrack.title} by ${player.currentTrack.artist}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={20} color="rgba(255,255,255,0.2)" />
                        </div>
                    )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    {(() => {
                        const t = player.currentTrack! as any;
                        const titleTo = (t.username && t.slug) ? `/track/${t.username}/${t.slug}` : (t.entryRoute || null);
                        return titleTo ? (
                            <Link
                                to={titleTo}
                                onMouseEnter={(e) => e.currentTarget.style.color = colors.primary}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'white'}
                                style={{ 
                                    fontSize: isMobile ? '13px' : '13px', 
                                    fontWeight: 'bold', 
                                    margin: '0 0 2px 0', 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    color: 'white',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s',
                                    textDecoration: 'none',
                                    display: 'block',
                                }}
                            >
                                {player.currentTrack!.title}
                            </Link>
                        ) : (
                            <p style={{ 
                                fontSize: isMobile ? '13px' : '13px', 
                                fontWeight: 'bold', 
                                margin: '0 0 2px 0', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                color: 'white',
                            }}>
                                {player.currentTrack!.title}
                            </p>
                        );
                    })()}
                    <Link 
                        to={`/profile/${player.currentTrack!.artist}`}
                        onMouseEnter={(e) => e.currentTarget.style.color = colors.primary}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#B9C3CE'}
                        style={{ 
                            fontSize: '11px', 
                            color: '#B9C3CE', 
                            margin: 0, 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            transition: 'color 0.2s',
                            textDecoration: 'none',
                            display: 'block',
                        }}
                    >
                        {player.currentTrack.artist}
                    </Link>
                </div>
                {!isMobile && (
                    <button
                        onClick={toggleFavourite}
                        aria-label={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', flexShrink: 0, color: isFavourited ? '#EF4444' : '#B9C3CE', transition: 'color 0.2s' }}
                    >
                        <Heart size={18} fill={isFavourited ? '#EF4444' : 'none'} />
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: isMobile ? '40%' : '40%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '24px' }}>
                    {!isMobile && (
                        <button
                            onClick={toggleShuffle}
                            aria-label={player.isShuffle ? 'Shuffle on' : 'Shuffle off'}
                            aria-pressed={player.isShuffle}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px', color: player.isShuffle ? colors.primary : '#B9C3CE' }}
                        >
                            <Shuffle size={18} />
                        </button>
                    )}
                    <button
                        onClick={prevTrack}
                        aria-label="Previous track"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px', color: 'white' }}
                    >
                        <SkipBack size={isMobile ? 22 : 20} />
                    </button>
                    <button 
                        onClick={togglePlay}
                        aria-label={player.isPlaying ? 'Pause' : 'Play'}
                        style={{ 
                            width: isMobile ? '40px' : '40px', height: isMobile ? '40px' : '40px', borderRadius: '50%', backgroundColor: 'white', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                            transition: 'transform 0.1s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {player.isPlaying ? <Pause fill="#1A1E2E" size={isMobile ? 22 : 20} /> : <Play fill="#1A1E2E" size={isMobile ? 22 : 20} style={{ marginLeft: '2px' }} />}
                    </button>
                    <button
                        onClick={nextTrack}
                        aria-label="Next track"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px', color: 'white' }}
                    >
                        <SkipForward size={isMobile ? 22 : 20} />
                    </button>
                    {!isMobile && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                                onClick={() => {
                                    if (player.repeatMode === 'none') setRepeatMode('all');
                                    else if (player.repeatMode === 'all') setRepeatMode('one');
                                    else setRepeatMode('none');
                                }}
                                aria-label={
                                    player.repeatMode === 'none' ? 'Repeat off' :
                                    player.repeatMode === 'all' ? 'Repeat all' : 'Repeat one'
                                }
                                aria-pressed={player.repeatMode !== 'none'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px', color: player.repeatMode !== 'none' ? colors.primary : '#B9C3CE', position: 'relative' }}
                            >
                                <Repeat size={18} />
                                {player.repeatMode === 'one' && (
                                    <span style={{ 
                                        position: 'absolute', fontSize: '8px', top: '50%', left: '50%', 
                                        transform: 'translate(-50%, -50%)', fontWeight: 'bold', pointerEvents: 'none',
                                        color: colors.primary
                                    }} aria-hidden="true">1</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: isMobile ? '100%' : '400px' }}>
                    {!isMobile && <span style={{ fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)', width: '35px', textAlign: 'right' }}>{formatTime(player.currentTime)}</span>}
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                            type="range"
                            min="0"
                            max={player.duration || 100}
                            value={player.currentTime}
                            onChange={handleSeek}
                            aria-label="Seek"
                            aria-valuetext={`${formatTime(player.currentTime)} of ${formatTime(player.duration)}`}
                            style={{ 
                                width: '100%', 
                                cursor: 'pointer',
                                accentColor: colors.primary,
                                height: '4px',
                            }}
                        />
                    </div>
                    {!isMobile && <span style={{ fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)', width: '35px' }}>{formatTime(player.duration)}</span>}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px', width: isMobile ? '10%' : '30%' }}>
                {!isMobile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Volume2 size={18} color="#B9C3CE" aria-hidden="true" />
                        <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={player.volume}
                            onChange={handleVolumeChange}
                            aria-label="Volume"
                            aria-valuetext={`${Math.round(player.volume * 100)}%`}
                            style={{ 
                                width: '96px', 
                                height: '4px', 
                                cursor: 'pointer',
                                accentColor: colors.primary
                            }}
                        />
                    </div>
                ) : (
                    <button
                        onClick={toggleShuffle}
                        aria-label={player.isShuffle ? 'Shuffle on' : 'Shuffle off'}
                        aria-pressed={player.isShuffle}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px', color: player.isShuffle ? colors.primary : '#B9C3CE' }}
                    >
                        <Shuffle size={18} />
                    </button>
                )}
            </div>
        </footer>
    );
};

