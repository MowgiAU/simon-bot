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
  Mail,
  Ticket,
  FileText,
  Music,
  Compass,
  Layout,
} from 'lucide-react';
import { AnimatedWrapper } from '../components/AnimatedWrapper';
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
        <div className="logo" onClick={() => !collapsed && onNavigate('dashboard')}>
          <div style={{ 
            width: 42, 
            height: 42, 
            background: '#2B8D70', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <img src={logoUrl} alt="Fuji Studio" style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="logo-text" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ 
                fontSize: '20px', 
                fontWeight: 800, 
                color: '#FFFFFF', 
                margin: 0, 
                lineHeight: 1,
                letterSpacing: '0.5px'
            }}>Fuji Studio</h1>
            <span style={{ 
                fontSize: '10px', 
                fontWeight: 700, 
                color: '#8A92A0', 
                letterSpacing: '1px',
                textTransform: 'uppercase'
            }}>Discord Admin</span>
          </div>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-group">
          <h3 className="nav-group-title">Discovery</h3>
          <button
            className="nav-item"
            onClick={() => window.location.href = '/'}
            title={collapsed ? "Artist Discovery" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={Compass} size={20} /></span>
            <span className="nav-label">Artist Discovery</span>
          </button>
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">General</h3>
          <button
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
            title={collapsed ? "Overview" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={LayoutDashboard} size={20} /></span>
            <span className="nav-label">Overview</span>
          </button>

          <button
            className={`nav-item ${activeSection === 'bot-identity' ? 'active' : ''}`}
            onClick={() => onNavigate('bot-identity')}
            title={collapsed ? "Bot Identity" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={UserIcon} size={20} /></span>
            <span className="nav-label">Bot Identity</span>
          </button>

          {(permissions.accessiblePlugins.includes('logger') || permissions.accessiblePlugins.includes('moderation')) && (
          <button
            className={`nav-item ${activeSection === 'logs' ? 'active' : ''}`}
            onClick={() => onNavigate('logs')}
            title={collapsed ? "Audit Logs" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={ScrollText} size={20} /></span>
            <span className="nav-label">Audit Logs</span>
          </button>
          )}
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Plugins</h3>

          {permissions.accessiblePlugins.includes('email-client') && (
            <button
                className={`nav-item ${activeSection === 'email-client' ? 'active' : ''}`}
                onClick={() => onNavigate('email-client')}
                title={collapsed ? "Email Client" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={Mail} size={20} /></span>
                <span className="nav-label">Email Client</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('tickets') && (
            <button
                className={`nav-item ${activeSection === 'tickets' ? 'active' : ''}`}
                onClick={() => onNavigate('tickets')}
                title={collapsed ? "Ticket System" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={Ticket} size={20} /></span>
                <span className="nav-label">Ticket System</span>
            </button>
          )}
          
          {permissions.accessiblePlugins.includes('word-filter') && (
            <button
                className={`nav-item ${activeSection === 'word-filter-settings' ? 'active' : ''}`}
                onClick={() => onNavigate('word-filter-settings')}
                title={collapsed ? "Word Filter" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={Type} size={20} /></span>
                <span className="nav-label">Word Filter</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('moderation') && (
          <button
            className={`nav-item ${activeSection === 'moderation' ? 'active' : ''}`}
            onClick={() => onNavigate('moderation')}
            title={collapsed ? "Moderation" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={ShieldAlert} size={20} /></span>
            <span className="nav-label">Moderation</span>
          </button>
          )}

          {(permissions.accessiblePlugins.includes('channel-rules') || permissions.accessiblePlugins.includes('moderation')) && (
            <button
                className={`nav-item ${activeSection === 'channel-rules' ? 'active' : ''}`}
                onClick={() => onNavigate('channel-rules')}
                title={collapsed ? "Channel Gatekeeper" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={FileText} size={20} /></span>
                <span className="nav-label">Channel Rules</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('welcome-gate') && (
            <button
              className={`nav-item ${activeSection === 'welcome-gate' ? 'active' : ''}`}
              onClick={() => onNavigate('welcome-gate')}
              title={collapsed ? "Welcome Gate" : ""}
            >
              <span className="nav-icon"><AnimatedWrapper icon={Shield} size={20} /></span>
              <span className="nav-label">Welcome Gate</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('economy') && (
          <button
            className={`nav-item ${activeSection === 'economy' ? 'active' : ''}`}
            onClick={() => onNavigate('economy')}
            title={collapsed ? "Economy" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={Coins} size={20} /></span>
            <span className="nav-label">Economy</span>
          </button>
          )}

          {permissions.accessiblePlugins.includes('fuji-studio') && (
            <button
                className={`nav-item ${activeSection === 'library' ? 'active' : ''}`}
                onClick={() => onNavigate('library')}
                title={collapsed ? "Library" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={Music} size={20} /></span>
                <span className="nav-label">Library</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('project-viewer') && (
            <button
                className={`nav-item ${activeSection === 'project-viewer' ? 'active' : ''}`}
                onClick={() => onNavigate('project-viewer')}
                title={collapsed ? "Project Viewer" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={Layout} size={20} /></span>
                <span className="nav-label">Project Viewer</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('production-feedback') && (
            <button
                className={`nav-item ${activeSection === 'feedback' ? 'active' : ''}`}
                onClick={() => onNavigate('feedback')}
                title={collapsed ? "Feedback" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={MessageSquare} size={20} /></span>
                <span className="nav-label">Feedback</span>
            </button>
          )}

          {permissions.accessiblePlugins.includes('musician-profiles') && (
            <button
                className={`nav-item ${activeSection === 'musician-profiles-admin' ? 'active' : ''}`}
                onClick={() => onNavigate('musician-profiles-admin')}
                title={collapsed ? "Profiles Config" : ""}
            >
                <span className="nav-icon"><AnimatedWrapper icon={Settings} size={20} /></span>
                <span className="nav-label">Profiles Config</span>
            </button>
          )}
        </div>

        <div className="nav-group">
          <h3 className="nav-group-title">Management</h3>
          {permissions.canManagePlugins && (
          <button
            className={`nav-item ${activeSection === 'plugins' ? 'active' : ''}`}
            onClick={() => onNavigate('plugins')}
            title={collapsed ? "Admin Panel" : ""}
          >
            <span className="nav-icon"><AnimatedWrapper icon={Settings} size={18} /></span>
            <span className="nav-label">Admin Panel</span>
          </button>
          )}
          <button
            className="nav-item"
            onClick={logout}
            title={collapsed ? "Logout" : ""}
            style={{ color: '#ff4444' }}
          >
            <span className="nav-icon"><LogOut size={18} /></span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </div>

      <div className="sidebar-footer">
         <button className="collapse-sidebar-btn" onClick={() => setCollapsed(!collapsed)} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#B9C3CE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse Sidebar</>}
         </button>
      </div>
    </aside>
  );
};
