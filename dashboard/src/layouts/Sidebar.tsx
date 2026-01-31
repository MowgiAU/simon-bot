import React, { useEffect, useState } from 'react';
import { colors, spacing, typography, borderRadius } from '../theme/theme';
import { SidebarStyles } from './SidebarStyles';
import { 
  LayoutDashboard, 
  ScrollText, 
  Type, 
  ShieldAlert, // Import Shield for Moderation
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
} from 'lucide-react';
import logoUrl from '../assets/logo.svg'; 

import { User, Guild } from '../components/AuthProvider';

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  user: User;
  guild: Guild;
  logout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate, user, guild, logout }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = SidebarStyles;
    document.head.appendChild(style);
    
    // Update main content margin based on collapse state
    // This is a bit hacky but works without refactoring the whole Layout structure
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    if (mainContent) {
        mainContent.style.marginLeft = collapsed ? '80px' : '260px';
    }

    return () => {
      document.head.removeChild(style);
    };
  }, [collapsed]);

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
            className={`nav-item ${activeSection === 'logs' ? 'active' : ''}`}
            onClick={() => onNavigate('logs')}
            title={collapsed ? "Audit Logs" : ""}
          >
            <span className="nav-icon"><ScrollText size={20} /></span>
            <span className="nav-label">Audit Logs</span>
          </button>
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Plugins</h3>
          <button
            className={`nav-item ${activeSection === 'moderation' ? 'active' : ''}`}
            onClick={() => onNavigate('moderation')}
            title={collapsed ? "Moderation" : ""}
          >
            <span className="nav-icon"><ShieldAlert size={20} /></span>
            <span className="nav-label">Moderation</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'word-filter-settings' ? 'active' : ''}`}
            onClick={() => onNavigate('word-filter-settings')}
            title={collapsed ? "Word Filter" : ""}
          >
            <span className="nav-icon"><Type size={20} /></span>
            <span className="nav-label">Word Filter</span>
          </button>
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Admin</h3>
          <button
            className={`nav-item ${activeSection === 'plugins' ? 'active' : ''}`}
            onClick={() => onNavigate('plugins')}
            title={collapsed ? "Plugins" : ""}
          >
            <span className="nav-icon"><Settings size={20} /></span>
            <span className="nav-label">Plugins</span>
          </button>           {/* Only show in Staging - checking localhost is easiest or env var */}
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
