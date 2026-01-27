import React from 'react';
import { colors, spacing, typography, borderRadius } from './theme';
import './Sidebar.css';

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">♪</span>
          <h1>Simon Bot</h1>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <h3 className="nav-group-title">Main</h3>
          <button
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Dashboard</span>
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
          <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="User" />
          <div className="user-info">
            <p className="user-name">User</p>
            <p className="user-status">Online</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
