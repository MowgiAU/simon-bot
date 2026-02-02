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

interface Permissions {
  canManagePlugins: boolean;
  accessiblePlugins: string[];
}

interface AuthContextType {
  user: User | null;
  mutualAdminGuilds: Guild[];
  selectedGuild: Guild | null;
  setSelectedGuild: (guild: Guild) => void;
  permissions: Permissions;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [mutualAdminGuilds, setMutualAdminGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({ canManagePlugins: false, accessiblePlugins: [] });
  const [loading, setLoading] = useState(true);

  // Fetch permissions when guild changes
  useEffect(() => {
    if (!selectedGuild) {
        setPermissions({ canManagePlugins: false, accessiblePlugins: [] });
        return;
    }
    fetch(`/api/guilds/${selectedGuild.id}/my-permissions`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            setPermissions({ 
                canManagePlugins: data.canManagePlugins || false, 
                accessiblePlugins: data.accessiblePlugins || [] 
            });
        })
        .catch(err => console.error(err));
  }, [selectedGuild]);

  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
          setMutualAdminGuilds(data.mutualAdminGuilds || []);
          if (data.mutualAdminGuilds && data.mutualAdminGuilds.length > 0) {
              // Prefer user's last choice or first one? For simplicity first one
              // Just picking first one for now
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
    <AuthContext.Provider value={{ user, mutualAdminGuilds, selectedGuild, setSelectedGuild, permissions, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
