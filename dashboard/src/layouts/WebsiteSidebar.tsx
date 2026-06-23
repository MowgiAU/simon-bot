import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme/theme';
import { SidebarStyles } from './SidebarStyles';
import {
  BarChart3,
  Sparkles,
  Newspaper,
  ClipboardCheck,
  Hash,
  Swords,
  Zap,
  Users,
  Music,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { AnimatedWrapper } from '../components/AnimatedWrapper';
import logoUrl from '../assets/logo.svg';

export type WebSection =
  | 'platform-analytics'
  | 'featured-content'
  | 'articles'
  | 'article-review'
  | 'genres-admin'
  | 'beat-battle'
  | 'head-to-head'
  | 'account-management'
  | 'musician-profiles-admin';

const GROUPS_KEY = 'fuji_web_sidebar_groups';
function loadGroupState(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); } catch { return {}; }
}

interface NavGroupProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  children: React.ReactNode;
}

const NavGroup: React.FC<NavGroupProps> = ({ id, label, icon, collapsed: sidebarCollapsed, children }) => {
  const [open, setOpen] = useState(() => {
    const saved = loadGroupState();
    return saved[id] !== undefined ? saved[id] : true;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      const saved = loadGroupState();
      localStorage.setItem(GROUPS_KEY, JSON.stringify({ ...saved, [id]: next }));
    } catch {}
  };
  return (
    <div className="nav-group">
      <h3
        className="nav-group-title"
        onClick={toggle}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {icon}
          {!sidebarCollapsed && label}
        </span>
        {!sidebarCollapsed && (
          <ChevronDown size={12} style={{ opacity: 0.4, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
        )}
      </h3>
      {open && children}
    </div>
  );
};

interface WebsiteSidebarProps {
  activeSection: WebSection;
  onNavigate: (section: WebSection) => void;
  user: any;
  logout: () => void;
  topOffset?: number;
}

export const WebsiteSidebar: React.FC<WebsiteSidebarProps> = ({ activeSection, onNavigate, user, logout, topOffset = 0 }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = SidebarStyles;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={topOffset ? { top: topOffset } : {}}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo" onClick={() => !collapsed && onNavigate('platform-analytics')} style={{ cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={logoUrl} alt="Logo" style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }} />
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Fuji Studio
              </div>
              <div style={{ color: colors.textTertiary, fontSize: '11px', fontWeight: 500 }}>Website Admin</div>
            </div>
          )}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">

        {/* Analytics */}
        <NavGroup id="analytics" label="Overview" icon={<BarChart3 size={14} style={{ marginRight: collapsed ? 0 : 6, color: colors.textTertiary }} />} collapsed={collapsed}>
          <button className={`nav-item ${activeSection === 'platform-analytics' ? 'active' : ''}`} onClick={() => onNavigate('platform-analytics')} title={collapsed ? 'Platform Analytics' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={BarChart3} size={20} /></span>
            <span className="nav-label">Platform Analytics</span>
          </button>
        </NavGroup>

        {/* Content */}
        <NavGroup id="content" label="Content" icon={<Globe size={14} style={{ marginRight: collapsed ? 0 : 6, color: colors.textTertiary }} />} collapsed={collapsed}>
          <button className={`nav-item ${activeSection === 'featured-content' ? 'active' : ''}`} onClick={() => onNavigate('featured-content')} title={collapsed ? 'Featured Content' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Sparkles} size={20} /></span>
            <span className="nav-label">Featured Content</span>
          </button>
          <button className={`nav-item ${activeSection === 'articles' ? 'active' : ''}`} onClick={() => onNavigate('articles')} title={collapsed ? 'Articles' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Newspaper} size={20} /></span>
            <span className="nav-label">Articles</span>
          </button>
          <button className={`nav-item ${activeSection === 'article-review' ? 'active' : ''}`} onClick={() => onNavigate('article-review')} title={collapsed ? 'Article Review' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={ClipboardCheck} size={20} /></span>
            <span className="nav-label">Article Review</span>
          </button>
        </NavGroup>

        {/* Community */}
        <NavGroup id="community" label="Community" icon={<Swords size={14} style={{ marginRight: collapsed ? 0 : 6, color: colors.textTertiary }} />} collapsed={collapsed}>
          <button className={`nav-item ${activeSection === 'genres-admin' ? 'active' : ''}`} onClick={() => onNavigate('genres-admin')} title={collapsed ? 'Genres' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Hash} size={20} /></span>
            <span className="nav-label">Genres</span>
          </button>
          <button className={`nav-item ${activeSection === 'beat-battle' ? 'active' : ''}`} onClick={() => onNavigate('beat-battle')} title={collapsed ? 'Beat Battles' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Swords} size={20} /></span>
            <span className="nav-label">Beat Battles</span>
          </button>
          <button className={`nav-item ${activeSection === 'head-to-head' ? 'active' : ''}`} onClick={() => onNavigate('head-to-head')} title={collapsed ? 'Head to Head' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Zap} size={20} /></span>
            <span className="nav-label">Head to Head</span>
          </button>
        </NavGroup>

        {/* Users */}
        <NavGroup id="users" label="Users" icon={<Users size={14} style={{ marginRight: collapsed ? 0 : 6, color: colors.textTertiary }} />} collapsed={collapsed}>
          <button className={`nav-item ${activeSection === 'account-management' ? 'active' : ''}`} onClick={() => onNavigate('account-management')} title={collapsed ? 'Account Management' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Users} size={20} /></span>
            <span className="nav-label">Account Management</span>
          </button>
          <button className={`nav-item ${activeSection === 'musician-profiles-admin' ? 'active' : ''}`} onClick={() => onNavigate('musician-profiles-admin')} title={collapsed ? 'Musician Profiles' : ''}>
            <span className="nav-icon"><AnimatedWrapper icon={Music} size={20} /></span>
            <span className="nav-label">Musician Profiles</span>
          </button>
        </NavGroup>

        {/* External links */}
        {!collapsed && (
          <div className="nav-group">
            <h3 className="nav-group-title"><span style={{ display: 'flex', alignItems: 'center' }}><ExternalLink size={14} style={{ marginRight: 6, color: colors.textTertiary }} />Links</span></h3>
            <button className="nav-item" onClick={() => navigate('/')} title="Community Site">
              <span className="nav-icon"><Globe size={20} /></span>
              <span className="nav-label">Community Site ↗</span>
            </button>
            <button className="nav-item" onClick={() => { window.location.href = 'https://bot.fujistud.io'; }} title="Bot Dashboard">
              <span className="nav-icon"><ExternalLink size={20} /></span>
              <span className="nav-label">Bot Dashboard ↗</span>
            </button>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="sidebar-user">
        {user && (
          <>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={user.profileAvatar || (user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                alt="Avatar"
              />
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.profileDisplayName || user.username}
                </div>
                <div style={{ fontSize: '11px', color: colors.textTertiary }}>Website Admin</div>
              </div>
            )}
            <button onClick={logout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.color = colors.error)} onMouseLeave={e => (e.currentTarget.style.color = colors.textTertiary)}>
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
