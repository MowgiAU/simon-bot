import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PlayerState {
  currentTrack: {
    title: string;
    artist: string;
    cover: string;
    url?: string;
  } | null;
  isPlaying: boolean;
  volume: number;
}

interface PlayerContextType {
  player: PlayerState;
  setTrack: (track: PlayerState['currentTrack']) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerState>({
    currentTrack: {
      title: 'Neon Drift (Club Mix)',
      artist: 'Mowgi',
      cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBL5FtdxpIzBESrl-YM_agqxqNjpXv-iXPbftCjdOEk_OXAK9-4Ii4LWjDLAApQupMvNam2eTbMXdV1H25jJ4gfdliPCbEhzDLhoQICAEEwDJeqQnivHqWEr_22cpHXachO0yu0VbER1Pdp_2Z6iC4ujH5K6QYZPiUN2zhEajhI57WyNyzU5YQfZNrH8EQ7xdkIRLaNXvjh-S-xKORGad4O7V09HN5rW6atsIHS4BiS1j4JtrWOJh6Nflg_9YyF3D0QAI_wOjnH1nvG'
    },
    isPlaying: false,
    volume: 0.75,
  });

  const setTrack = (track: PlayerState['currentTrack']) => {
    setPlayer(prev => ({ ...prev, currentTrack: track, isPlaying: true }));
  };

  const togglePlay = () => {
    setPlayer(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const setVolume = (volume: number) => {
    setPlayer(prev => ({ ...prev, volume }));
  };

  return (
    <PlayerContext.Provider value={{ player, setTrack, togglePlay, setVolume }}>
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
