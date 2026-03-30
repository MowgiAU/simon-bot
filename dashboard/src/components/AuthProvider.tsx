import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RETURN_TO_KEY = 'fuji_login_return_to';

export interface User {
  id: string;
  username: string;
  discriminator?: string;
  avatar: string;
  _localId?: string;
  _hasPassword?: boolean;
  _email?: string | null;
  _emailVerified?: boolean;
  _totpEnabled?: boolean;
  _loginMethod?: 'email' | 'discord';
  _invited?: boolean;
  _role?: string;
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
  dashboardGuilds: Guild[];
  selectedGuild: Guild | null;
  setSelectedGuild: (guild: Guild) => void;
  permissions: Permissions;
  isGuildMember: boolean;
  loading: boolean;
  hasLocalAccount: boolean;
  hasPassword: boolean;
  email: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
  loginMethod: string | null;
  invited: boolean;
  role: string;
  login: () => void;
  logout: () => void;
  emailLogin: (email: string, password: string, totpCode?: string) => Promise<{ success?: boolean; requiresTwoFactor?: boolean; error?: string; code?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success?: boolean; error?: string }>;
  refreshAccountStatus: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [mutualAdminGuilds, setMutualAdminGuilds] = useState<Guild[]>([]);
  const [mutualStaffGuilds, setMutualStaffGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({ canManagePlugins: false, accessiblePlugins: [] });
  const [isGuildMember, setIsGuildMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLocalAccount, setHasLocalAccount] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  const [role, setRole] = useState('user');

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

  const loadAuthStatus = () => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
          setMutualAdminGuilds(data.mutualAdminGuilds || []);
          setMutualStaffGuilds(data.mutualStaffGuilds || []);
          setIsGuildMember(data.isGuildMember ?? false);
          setHasLocalAccount(!!data.hasLocalAccount);
          setHasPassword(!!data.hasPassword);
          setEmail(data.email || null);
          setEmailVerified(!!data.emailVerified);
          setTotpEnabled(!!data.totpEnabled);
          setLoginMethod(data.loginMethod || null);
          setInvited(!!data.invited);
          setRole(data.role || 'user');
          const allGuilds = [...(data.mutualAdminGuilds || []), ...(data.mutualStaffGuilds || [])];
          if (allGuilds.length > 0) {
             setSelectedGuild(allGuilds[0]);
          }
          const returnTo = localStorage.getItem(RETURN_TO_KEY);
          if (returnTo) {
            localStorage.removeItem(RETURN_TO_KEY);
            navigate(returnTo, { replace: true });
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[AuthProvider] Failed to fetch auth status:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // DEV MODE BYPASS: Only active during local `npm run dev` (Vite development server).
    if (import.meta.env.DEV) {
        setUser({
            id: 'dev_user_id',
            username: 'DevMode',
            discriminator: '0000',
            avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
            _hasPassword: true,
            _email: 'dev@example.com',
            _emailVerified: true,
            _totpEnabled: false,
            _loginMethod: 'discord',
        });
        setMutualAdminGuilds([{ id: 'dev_guild_id', name: 'Dev Community', icon: '' }]);
        setSelectedGuild({ id: 'dev_guild_id', name: 'Dev Community', icon: '' });
        setPermissions({
            canManagePlugins: true,
            accessiblePlugins: ['musician-profile', 'moderation', 'economy', 'roles', 'bot-identity', 'logs', 'welcome-gate', 'ticket-system', 'feedback', 'word-filter']
        });
        setIsGuildMember(true);
        setHasLocalAccount(true);
        setHasPassword(true);
        setEmail('dev@example.com');
        setEmailVerified(true);
        setTotpEnabled(false);
        setLoginMethod('discord');
        setLoading(false);
        return;
    }

    loadAuthStatus();
  }, []);

  const refreshAccountStatus = () => {
    if (!import.meta.env.DEV) loadAuthStatus();
  };

  const login = () => {
    const returnTo = window.location.pathname + window.location.search;
    if (returnTo && returnTo !== '/') {
      localStorage.setItem(RETURN_TO_KEY, returnTo);
    }
    window.location.href = '/api/auth/discord/login';
  };

  const emailLogin = async (loginEmail: string, password: string, totpCode?: string): Promise<{ success?: boolean; requiresTwoFactor?: boolean; error?: string; code?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password, totpCode }),
      });
      const data = await res.json();
      if (data.requiresTwoFactor) return { requiresTwoFactor: true };
      if (!res.ok) return { error: data.error || 'Login failed', code: data.code };
      // Reload auth status after successful login
      loadAuthStatus();
      return { success: true };
    } catch {
      return { error: 'Network error' };
    }
  };

  const register = async (username: string, regEmail: string, password: string): Promise<{ success?: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email: regEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Registration failed' };
      loadAuthStatus();
      return { success: true };
    } catch {
      return { error: 'Network error' };
    }
  };

  const logout = () => {
    window.location.href = '/api/auth/logout';
  };

  // Combined guild list for guild selector (admin + staff)
  const dashboardGuilds = [...mutualAdminGuilds, ...mutualStaffGuilds];

  return (
    <AuthContext.Provider value={{ user, mutualAdminGuilds, dashboardGuilds, selectedGuild, setSelectedGuild, permissions, isGuildMember, loading, hasLocalAccount, hasPassword, email, emailVerified, totpEnabled, loginMethod, invited, role, login, logout, emailLogin, register, refreshAccountStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
