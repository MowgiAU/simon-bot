import React, { useEffect } from 'react';
import { colors, spacing, typography, borderRadius } from '../theme/theme';
import { SidebarStyles } from './SidebarStyles';


import { User, Guild } from '../components/AuthProvider';

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  user: User;
  guild: Guild;
  logout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate, user, guild, logout }) => {
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = SidebarStyles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">♪</span>
          <h1>Simon Bot</h1>
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary }}>
          <div>Server:</div>
          <div style={{ fontWeight: 600 }}>
            {guild.icon && (
              <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} alt="icon" style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6, verticalAlign: 'middle' }} />
            )}
            {guild.name}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <h3 className="nav-group-title">Main</h3>
          <button
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Overview</span>
          </button>
          
          <button
            className={`nav-item ${activeSection === 'server-stats' ? 'active' : ''}`}
            onClick={() => onNavigate('server-stats')}
          >
            <span className="nav-icon">📈</span>
            <span className="nav-label">Server Stats</span>
          </button>
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Plugins</h3>
          <button
            className={`nav-item ${activeSection === 'word-filter-settings' ? 'active' : ''}`}
            onClick={() => onNavigate('word-filter-settings')}
          >
            <span className="nav-icon">🔤</span>
            <span className="nav-label">Word Filter</span>
          </button>
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Admin</h3>
          <button
            className={`nav-item ${activeSection === 'plugins' ? 'active' : ''}`}
            onClick={() => onNavigate('plugins')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Plugins</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="User" style={{ width: 36, height: 36, borderRadius: 18 }} />
          <div className="user-info">
            <p className="user-name">{user.username}#{user.discriminator}</p>
            <button onClick={logout} style={{ marginTop: 8, fontSize: 14 }}>Logout</button>
          </div>
        </div>
      </div>
    </aside>
  );
};
