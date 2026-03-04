
import React from 'react';
import { 
    Play, Heart, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Pause
} from 'lucide-react';
import { usePlayer } from './PlayerProvider';
import { colors } from '../theme/theme';

export const GlobalPlayer: React.FC = () => {
    const { player, togglePlay } = usePlayer();

    if (!player.currentTrack) return null;

    return (
        <footer style={{ 
            height: '80px', backgroundColor: '#1A1E2E', borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', 
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
            boxShadow: '0 -10px 25px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={player.currentTrack.cover} alt="Current" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.currentTrack.title}</p>
                    <p style={{ fontSize: '11px', color: '#B9C3CE', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.currentTrack.artist}</p>
                </div>
                <Heart size={18} color="#B9C3CE" style={{ flexShrink: 0 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '40%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Shuffle size={18} color="#B9C3CE" />
                    <SkipBack size={20} color="white" />
                    <button 
                        onClick={togglePlay}
                        style={{ 
                            width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                            transition: 'transform 0.1s'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {player.isPlaying ? <Pause fill="#1A1E2E" size={20} /> : <Play fill="#1A1E2E" size={20} style={{ marginLeft: '2px' }} />}
                    </button>
                    <SkipForward size={20} color="white" />
                    <Repeat size={18} color="#B9C3CE" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '400px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)' }}>0:00</span>
                    <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '999px', position: 'relative' }}>
                        <div style={{ width: '30%', height: '100%', backgroundColor: colors.primary, borderRadius: '999px' }} />
                    </div>
                    <span style={{ fontSize: '10px', color: 'rgba(185, 195, 206, 0.6)' }}>3:45</span>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px', width: '30%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Volume2 size={18} color="#B9C3CE" />
                    <div style={{ width: '96px', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '999px' }}>
                        <div 
                            style={{ 
                                width: `${player.volume * 100}%`, 
                                height: '100%', 
                                backgroundColor: 'rgba(255,255,255,0.4)', 
                                borderRadius: '999px' 
                            }} 
                        />
                    </div>
                </div>
            </div>
        </footer>
    );
};
