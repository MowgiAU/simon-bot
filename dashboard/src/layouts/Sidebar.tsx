import React, { useEffect, useState } from 'react';
import { colors, spacing, typography, borderRadius } from '../theme/theme';
import { SidebarStyles } from './SidebarStyles';
import { 
  LayoutDashboard, 
  ScrollText, 
  Type, 
  ShieldAlert, 
  Shield,
  Coins,
  Settings, 
  User as UserIcon,
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  MessageSquare,
  Music,    // New
} from 'lucide-react';
import logoUrl from '../assets/logo.svg'; 

import { User, Guild } from '../components/AuthProvider';

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  user: User;
  guild: Guild;
  permissions: { canManagePlugins: boolean; accessiblePlugins: string[] };
  logout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate, user, guild, permissions, logout }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = SidebarStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
        <div className="logo" onClick={() => !collapsed && onNavigate('dashboard')}>
          <img src={logoUrl} alt="Fuji Studio" style={{ width: 32, height: 32 }} />
          <h1>Fuji Studio</h1>
        </div>
        <div className="server-info" style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary }}>
          <div>Server:</div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            {guild.icon && (
              <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} alt="icon" style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6 }} />
            )}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guild.name}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <h3 className="nav-group-title">Main</h3>
          <button
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
            title={collapsed ? "Overview" : ""}
          >
            <span className="nav-icon"><LayoutDashboard size={20} /></span>
            <span className="nav-label">Overview</span>
          </button>

          <button
            className={`nav-item ${activeSection === 'bot-identity' ? 'active' : ''}`}
            onClick={() => onNavigate('bot-identity')}
            title={collapsed ? "Bot Identity" : ""}
          >
            <span className="nav-icon"><UserIcon size={20} /></span>
            <span className="nav-label">Bot Identity</span>
          </button>

          {(permissions.accessiblePlugins.includes('logger') || permissions.accessiblePlugins.includes('moderation')) && (
          <button
            className={`nav-item ${activeSection === 'logs' ? 'active' : ''}`}
            onClick={() => onNavigate('logs')}
            title={collapsed ? "Audit Logs" : ""}
          >
            <span className="nav-icon"><ScrollText size={20} /></span>
            <span className="nav-label">Audit Logs</span>
          </button>
          )}
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Plugins</h3>

          {permissions.accessiblePlugins.includes('beat-battle') && (
            <button
              className={`nav-item ${activeSection === 'beat-battle' ? 'active' : ''}`}
              onClick={() => onNavigate('beat-battle')}
              title={collapsed ? "Beat Battle" : ""}
            >
              <span className="nav-icon"><Music size={20} /></span>
              <span className="nav-label">Beat Battle</span>
            </button>
          )}
          
          {permissions.accessiblePlugins.includes('word-filter') && (
            <button
                className={`nav-item ${activeSection === 'word-filter-settings' ? 'active' : ''}`}
                onClick={() => onNavigate('word-filter-settings')}
                title={collapsed ? "Word Filter" : ""}
            >
                <span className="nav-icon"><Type size={20} /></span>
                <span className="nav-label">Word Filter</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('moderation') && (
          <button
            className={`nav-item ${activeSection === 'moderation' ? 'active' : ''}`}
            onClick={() => onNavigate('moderation')}
            title={collapsed ? "Moderation" : ""}
          >
            <span className="nav-icon"><ShieldAlert size={20} /></span>
            <span className="nav-label">Moderation</span>
          </button>
          )}

          {permissions.accessiblePlugins.includes('welcome-gate') && (
            <button
              className={`nav-item ${activeSection === 'welcome-gate' ? 'active' : ''}`}
              onClick={() => onNavigate('welcome-gate')}
              title={collapsed ? "Welcome Gate" : ""}
            >
              <span className="nav-icon"><Shield size={20} /></span>
              <span className="nav-label">Welcome Gate</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('economy') && (
          <button
            className={`nav-item ${activeSection === 'economy' ? 'active' : ''}`}
            onClick={() => onNavigate('economy')}
            title={collapsed ? "Economy" : ""}
          >
            <span className="nav-icon"><Coins size={20} /></span>
            <span className="nav-label">Economy</span>
          </button>
          )}

          {permissions.accessiblePlugins.includes('production-feedback') && (
            <button
                className={`nav-item ${activeSection === 'feedback' ? 'active' : ''}`}
                onClick={() => onNavigate('feedback')}
                title={collapsed ? "Feedback" : ""}
            >
                <span className="nav-icon"><MessageSquare size={20} /></span>
                <span className="nav-label">Feedback</span>
            </button>
          )}
        </div>

        <div className="nav-group">
          {permissions.canManagePlugins && (
          <>
          <h3 className="nav-group-title">Admin</h3>
          <button
            className={`nav-item ${activeSection === 'plugins' ? 'active' : ''}`}
            onClick={() => onNavigate('plugins')}
            title={collapsed ? "Plugins" : ""}
          >
            <span className="nav-icon"><Settings size={20} /></span>
            <span className="nav-label">Plugins</span>
          </button>
          </>
          )}
           {/* Only show in Staging - checking localhost is easiest or env var */}
           {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <button
                className={`nav-item ${activeSection === 'staging-test' ? 'active' : ''}`}
                onClick={() => onNavigate('staging-test')}
                style={{ color: colors.warning }}
                title={collapsed ? "Staging Test" : ""}
            >
                <span className="nav-icon"><Settings size={20} /></span>
                <span className="nav-label">Staging Test</span>
            </button>
           )}        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="User" />
          <div className="user-info">
            <p className="user-name">{user.username}</p>
            <button className="logout-btn" onClick={logout}>
              <LogOut size={16} style={{ marginRight: 6 }} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
