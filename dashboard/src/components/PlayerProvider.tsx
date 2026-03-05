import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import axios from 'axios';

interface PlayerState {
  currentTrack: {
    id?: string;
    title: string;
    artist: string;
    cover: string;
    url?: string;
  } | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}

interface PlayerContextType {
  player: PlayerState;
  setTrack: (track: any) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    volume: 0.75,
    currentTime: 0,
    duration: 0,
  });

  const [audio] = useState(new Audio());
  const hasRecordedPlay = useRef<string | null>(null);

  React.useEffect(() => {
    const updateTime = () => {
      setPlayer(prev => ({ ...prev, currentTime: audio.currentTime }));
      
      // Auto-record play after 10 seconds or 25% of the track, whichever is shorter
      if (player.currentTrack?.id && hasRecordedPlay.current !== player.currentTrack.id) {
        const threshold = Math.min(10, audio.duration * 0.25);
        if (audio.currentTime >= threshold && threshold > 0) {
          hasRecordedPlay.current = player.currentTrack.id;
          axios.post(`/api/musician/tracks/${player.currentTrack.id}/play`, { 
            duration: Math.floor(audio.duration) 
          }, { withCredentials: true }).catch(() => {});
        }
      }
    };
    const updateDuration = () => setPlayer(prev => ({ ...prev, duration: audio.duration }));
    const onEnded = () => setPlayer(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio, player.currentTrack?.id]);

  React.useEffect(() => {
    audio.volume = player.volume;
  }, [player.volume, audio]);

  React.useEffect(() => {
    if (player.isPlaying) {
      audio.play().catch(err => console.error("Playback failed", err));
    } else {
      audio.pause();
    }
  }, [player.isPlaying, audio]);

  const setTrack = (trackData: any) => {
    // Standardize track data
    const newTrack = {
      id: trackData.id,
      title: trackData.title,
      artist: trackData.artist || trackData.profile?.displayName || trackData.profile?.username || 'Unknown Artist',
      cover: trackData.coverUrl || trackData.cover || '',
      url: trackData.url
    };

    if (newTrack.url) {
      // Reset play recording flag for the new track
      hasRecordedPlay.current = null;
      audio.src = newTrack.url;
      setPlayer(prev => ({ ...prev, currentTrack: newTrack, isPlaying: true, currentTime: 0 }));
    }
  };

  const togglePlay = () => {
    if (!player.currentTrack) return;
    setPlayer(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const setVolume = (volume: number) => {
    setPlayer(prev => ({ ...prev, volume }));
  };

  const seek = (time: number) => {
    audio.currentTime = time;
    setPlayer(prev => ({ ...prev, currentTime: time }));
  };

  return (
    <PlayerContext.Provider value={{ player, setTrack, togglePlay, setVolume, seek }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
