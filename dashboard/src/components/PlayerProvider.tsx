import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import axios from 'axios';

interface PlayerState {
  currentTrack: {
    id?: string;
    title: string;
    artist: string;
    username?: string;
    slug?: string;
    cover: string;
    url?: string;
  } | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  queue: any[];
  currentIndex: number;
  isShuffle: boolean;
  repeatMode: 'none' | 'one' | 'all';
}

interface PlayerContextType {
  player: PlayerState;
  setTrack: (track: any, queue?: any[]) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: 'none' | 'one' | 'all') => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    volume: 0.75,
    currentTime: 0,
    duration: 0,
    queue: [],
    currentIndex: -1,
    isShuffle: false,
    repeatMode: 'none',
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
    const onEnded = () => {
      // Logic handled by next() which respects repeat settings
      nextTrack();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio, player.currentTrack?.id, player.currentIndex, player.queue.length, player.repeatMode]);

  React.useEffect(() => {
    audio.volume = player.volume;
  }, [player.volume, audio]);

  React.useEffect(() => {
    if (player.isPlaying) {
      // Only call play() here when resuming a paused track (togglePlay).
      // New track loading calls play() directly in setTrack.
      audio.play().catch(err => console.error("Playback failed", err));
    } else {
      audio.pause();
    }
  }, [player.isPlaying, audio]);

  const setTrack = (trackData: any, newQueue?: any[]) => {
    // Standardize track data
    const newTrack = {
      id: trackData.id,
      title: trackData.title,
      artist: trackData.artist || trackData.profile?.displayName || trackData.profile?.username || 'Unknown Artist',
      username: trackData.profile?.username || trackData.username || '',
      slug: trackData.slug || '',
      cover: trackData.coverUrl || trackData.cover || '',
      url: trackData.url
    };

    if (newTrack.url) {
      // Reset play recording flag for the new track
      hasRecordedPlay.current = null;
      // Set src and call play() directly — cannot rely on the isPlaying effect
      // because if isPlaying is already true the effect won't re-run for the new src.
      audio.src = newTrack.url;
      audio.play().catch(err => console.error('Playback failed', err));
      
      setPlayer(prev => {
        const queue = newQueue || prev.queue;
        const index = queue.findIndex(t => t.id === newTrack.id);
        return { 
          ...prev, 
          currentTrack: newTrack, 
          isPlaying: true, 
          currentTime: 0,
          queue: queue,
          currentIndex: index
        };
      });
    }
  };

  const nextTrack = () => {
    setPlayer(prev => {
      if (prev.repeatMode === 'one' && audio.currentTime >= audio.duration - 1) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return { ...prev, currentTime: 0, isPlaying: true };
      }

      if (prev.queue.length === 0) return { ...prev, isPlaying: false };

      let nextIndex = prev.currentIndex + 1;
      
      if (prev.isShuffle) {
        nextIndex = Math.floor(Math.random() * prev.queue.length);
      }

      if (nextIndex >= prev.queue.length) {
        if (prev.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          return { ...prev, isPlaying: false };
        }
      }

      const nextT = prev.queue[nextIndex];
      hasRecordedPlay.current = null;
      audio.src = nextT.url || nextT.coverUrl;
      audio.play().catch(() => {});
      
      return {
        ...prev,
        currentTrack: {
          id: nextT.id,
          title: nextT.title,
          artist: nextT.artist || nextT.profile?.displayName || nextT.profile?.username || 'Unknown Artist',
          username: nextT.profile?.username || nextT.username || '',
          slug: nextT.slug || '',
          cover: nextT.coverUrl || nextT.cover || '',
          url: nextT.url
        },
        currentIndex: nextIndex,
        isPlaying: true,
        currentTime: 0
      };
    });
  };

  const prevTrack = () => {
    setPlayer(prev => {
      if (prev.queue.length === 0) return prev;
      
      // If we're more than 3 seconds in, just restart the track
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return { ...prev, currentTime: 0 };
      }

      let prevIndex = prev.currentIndex - 1;
      if (prevIndex < 0) {
        if (prev.repeatMode === 'all') {
          prevIndex = prev.queue.length - 1;
        } else {
          prevIndex = 0;
        }
      }

      const prevT = prev.queue[prevIndex];
      hasRecordedPlay.current = null;
      audio.src = prevT.url || prevT.coverUrl;
      audio.play().catch(() => {});

      return {
        ...prev,
        currentTrack: {
          id: prevT.id,
          title: prevT.title,
          artist: prevT.artist || prevT.profile?.displayName || prevT.profile?.username || 'Unknown Artist',
          username: prevT.profile?.username || prevT.username || '',
          slug: prevT.slug || '',
          cover: prevT.coverUrl || prevT.cover || '',
          url: prevT.url
        },
        currentIndex: prevIndex,
        isPlaying: true,
        currentTime: 0
      };
    });
  };

  const toggleShuffle = () => {
    setPlayer(prev => ({ ...prev, isShuffle: !prev.isShuffle }));
  };

  const setRepeatMode = (mode: 'none' | 'one' | 'all') => {
    setPlayer(prev => ({ ...prev, repeatMode: mode }));
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
    <PlayerContext.Provider value={{ 
      player, setTrack, togglePlay, setVolume, seek, 
      nextTrack, prevTrack, toggleShuffle, setRepeatMode 
    }}>
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
