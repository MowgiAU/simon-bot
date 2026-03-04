
import React from 'react';
import { 
    Play, Heart, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Pause
} from 'lucide-react';
import { usePlayer } from './PlayerProvider';
import { colors } from '../theme/theme';

export const GlobalPlayer: React.FC = () => {
    const { player, togglePlay, setVolume, seek } = usePlayer();

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
            height: '80px', backgroundColor: '#1A1E2E', borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', 
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
            boxShadow: '0 -10px 25px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                    {player.currentTrack.cover ? (
                        <img src={player.currentTrack.cover} alt="Current" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={20} color="rgba(255,255,255,0.2)" />
                        </div>
                    )}
                </div>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{player.currentTrack.title}</p>
                    <p style={{ fontSize: '11px', color: '#B9C3CE', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.currentTrack.artist}</p>
                </div>
                <Heart size={18} color="#B9C3CE" style={{ flexShrink: 0, cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '40%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Shuffle size={18} color="#B9C3CE" style={{ cursor: 'pointer' }} />
                    <SkipBack size={20} color="white" style={{ cursor: 'pointer' }} />
                    <button 
                        onClick={togglePlay}
                        style={{ 
                            width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                            transition: 'transform 0.1s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {player.isPlaying ? <Pause fill="#1A1E2E" size={20} /> : <Play fill="#1A1E2E" size={20} style={{ marginLeft: '2px' }} />}
                    </button>
                    <SkipForward size={20} color="white" style={{ cursor: 'pointer' }} />
                    <Repeat size={18} color="#B9C3CE" style={{ cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '400px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)', width: '35px', textAlign: 'right' }}>{formatTime(player.currentTime)}</span>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                            type="range"
                            min="0"
                            max={player.duration || 100}
                            value={player.currentTime}
                            onChange={handleSeek}
                            style={{ 
                                width: '100%', 
                                cursor: 'pointer',
                                accentColor: colors.primary,
                                height: '4px',
                                outline: 'none'
                             }}
                        />
                    </div>
                    <span style={{ fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)', width: '35px' }}>{formatTime(player.duration)}</span>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px', width: '30%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Volume2 size={18} color="#B9C3CE" />
                    <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={player.volume}
                        onChange={handleVolumeChange}
                        style={{ 
                            width: '96px', 
                            height: '4px', 
                            cursor: 'pointer',
                            accentColor: colors.primary
                        }}
                    />
                </div>
            </div>
        </footer>
    );
};
