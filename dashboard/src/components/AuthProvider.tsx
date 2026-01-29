import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
}

export interface Guild {
  id: string;
  name: string;
  icon?: string;
}

interface AuthContextType {
  user: User | null;
  mutualAdminGuilds: Guild[];
  selectedGuild: Guild | null;
  setSelectedGuild: (guild: Guild) => void;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [mutualAdminGuilds, setMutualAdminGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
          setMutualAdminGuilds(data.mutualAdminGuilds || []);
          if (data.mutualAdminGuilds && data.mutualAdminGuilds.length === 1) {
            setSelectedGuild(data.mutualAdminGuilds[0]);
          }
        }
        setLoading(false);
      });
  }, []);

  const login = () => {
    window.location.href = '/api/auth/discord/login';
  };

  const logout = () => {
    window.location.href = '/api/auth/logout';
  };

  return (
    <AuthContext.Provider value={{ user, mutualAdminGuilds, selectedGuild, setSelectedGuild, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
