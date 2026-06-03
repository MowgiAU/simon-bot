import React, { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { SidebarStyles } from './SidebarStyles';
import { 
  LayoutDashboard, 
  ScrollText, 
  Type, 
  ShieldAlert, 
  Shield,
  ShieldOff,
  Coins,
  Settings, 
  User as UserIcon,
  LogOut, 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Mail,
  Ticket,
  FileText,
  Music,
  Swords,
  ExternalLink,
  BookOpen,
  Globe,
  Bot,
  Palette,
  Users,
  TrendingUp,
  Radio,
  Send,
  Sparkles,
  Clock,
  Zap,
  Gift,
  Flag,
  Bug,
  Hammer,
  BarChart2,
  BarChart3,
  ClipboardCheck,
  Megaphone,
  GraduationCap,
  Drum,
  Database,
  Puzzle,
  Activity,
  HardDrive,
  Layers,
  Dices,
} from 'lucide-react';
import { AnimatedWrapper } from '../components/AnimatedWrapper';
import logoUrl from '../assets/logo.svg'; 

import { User, Guild } from '../components/AuthProvider';

const GROUPS_KEY = 'fuji_sidebar_groups';

function loadGroupState(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); } catch { return {}; }
}

interface NavGroupProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean; // sidebar-level collapse
  children: React.ReactNode;
}

const NavGroup: React.FC<NavGroupProps> = ({ id, label, icon, collapsed: sidebarCollapsed, children }) => {
  const [open, setOpen] = useState<boolean>(() => {
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
          <ChevronDown
            size={12}
            style={{ opacity: 0.4, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        )}
      </h3>
      {open && children}
    </div>
  );
};

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  user: User;
  guild: Guild;
  permissions: { canManagePlugins: boolean; accessiblePlugins: string[] };
  logout: () => void;
  topOffset?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate, user, guild, permissions, logout, topOffset = 0 }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Prefetch data on nav-item hover so the section renders instantly on click
  const prefetch = useCallback((section: string) => {
    const guildId = guild?.id;
    if (!guildId) return;
    const opts = { staleTime: 60_000 };
    switch (section) {
      case 'tickets':
        queryClient.prefetchQuery({ queryKey: ['tickets', guildId], queryFn: () => axios.get(`/api/tickets/list/${guildId}`).then(r => r.data), ...opts });
        break;
      case 'moderation':
        queryClient.prefetchQuery({ queryKey: ['moderation-settings', guildId], queryFn: () => axios.get(`/api/moderation/settings/${guildId}`).then(r => r.data), ...opts });
        break;
      case 'logs':
        queryClient.prefetchQuery({ queryKey: ['logs', guildId], queryFn: () => axios.get(`/api/logs/${guildId}?limit=50`).then(r => r.data), ...opts });
        break;
      case 'beat-battle':
        queryClient.prefetchQuery({ queryKey: ['beat-battles', guildId], queryFn: () => axios.get(`/api/beat-battle/battles?guildId=${guildId}&status=active`).then(r => r.data), ...opts });
        break;
    }
  }, [queryClient, guild?.id]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = SidebarStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={topOffset ? { top: topOffset } : {}}>
      <div className="sidebar-header">
        <div className="logo" onClick={() => !collapsed && onNavigate('dashboard')}>
          <div style={{ 
            width: 38, 
            height: 38, 
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
            borderRadius: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)'
          }}>
            <img src={logoUrl} alt="Fuji Studio" style={{ width: 22, height: 22, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="logo-text" style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <h1 style={{ 
                fontSize: '18px', 
                fontWeight: 700, 
                color: colors.textPrimary,
                margin: 0, 
                lineHeight: 1,
                letterSpacing: '-0.01em'
            }}>Fuji Studio</h1>
            <span style={{ 
                fontSize: '10px', 
                fontWeight: 500, 
                color: colors.textTertiary,
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
            }}>Admin Panel</span>
          </div>
        </div>
      </div>

      <div className="sidebar-nav">
        {/* Back to public site */}
        <div style={{ padding: '0 0 12px', marginBottom: '4px' }}>
          <button
            className="nav-item"
            onClick={() => navigate('/')}
            title={collapsed ? "Back to Site" : ""}
            style={{ color: colors.textTertiary, fontSize: '12px' }}
          >
            <span className="nav-icon"><ExternalLink size={16} /></span>
            <span className="nav-label">Back to Site</span>
          </button>
        </div>

        {/* ── Bot ── */}
        <NavGroup id="bot" label="Bot" icon={<Bot size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
          <button className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')} title={collapsed ? "Overview" : ""}>
            <span className="nav-icon"><AnimatedWrapper icon={LayoutDashboard} size={20} /></span>
            <span className="nav-label">Overview</span>
          </button>
          {permissions.accessiblePlugins.includes('moderation') && (
            <button className={`nav-item ${activeSection === 'moderation' ? 'active' : ''}`} onClick={() => onNavigate('moderation')} onMouseEnter={() => prefetch('moderation')} title={collapsed ? "Moderation" : ""}>
              <span className="nav-icon"><AnimatedWrapper icon={ShieldAlert} size={20} /></span>
              <span className="nav-label">Moderation</span>
            </button>
          )}
          {permissions.accessiblePlugins.includes('anti-piracy') && (
            <button className={`nav-item ${activeSection === 'anti-piracy' ? 'active' : ''}`} onClick={() => onNavigate('anti-piracy')} title={collapsed ? "Anti-Piracy" : ""}>
              <span className="nav-icon"><AnimatedWrapper icon={ShieldOff} size={20} /></span>
              <span className="nav-label">Anti-Piracy</span>
            </button>
          )}
          {permissions.accessiblePlugins.includes('pause') && (
            <button className={`nav-item ${activeSection === 'pause' ? 'active' : ''}`} onClick={() => onNavigate('pause')} title={collapsed ? "Pause Command" : ""}>
              <span className="nav-icon"><AnimatedWrapper icon={Hammer} size={20} /></span>
              <span className="nav-label">Pause Command</span>
            </button>
          )}
          {(permissions.accessiblePlugins.includes('logger') || permissions.accessiblePlugins.includes('moderation')) && (
            <button className={`nav-item ${activeSection === 'logs' ? 'active' : ''}`} onClick={() => onNavigate('logs')} onMouseEnter={() => prefetch('logs')} title={collapsed ? "Audit Logs" : ""}>
              <span className="nav-icon"><AnimatedWrapper icon={ScrollText} size={20} /></span>
              <span className="nav-label">Audit Logs</span>
            </button>
          )}
        </NavGroup>

        {/* ── Automation ── */}
        {['welcome-gate', 'auto-messages', 'auto-responder', 'channel-rules', 'spam-guard', 'word-filter', 'email-client', 'tickets'].some(p => permissions.accessiblePlugins.includes(p)) && (
          <NavGroup id="automation" label="Automation" icon={<Zap size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {['welcome-gate', 'auto-messages', 'auto-responder', 'channel-rules', 'spam-guard'].some(p => permissions.accessiblePlugins.includes(p)) && (
              <button className={`nav-item ${activeSection === 'automation' ? 'active' : ''}`} onClick={() => onNavigate('automation')} title={collapsed ? "Automation" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Zap} size={20} /></span>
                <span className="nav-label">Automation</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('word-filter') && (
              <button className={`nav-item ${activeSection === 'word-filter-settings' ? 'active' : ''}`} onClick={() => onNavigate('word-filter-settings')} title={collapsed ? "Word Filter" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Type} size={20} /></span>
                <span className="nav-label">Word Filter</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('email-client') && (
              <button className={`nav-item ${activeSection === 'email-client' ? 'active' : ''}`} onClick={() => onNavigate('email-client')} title={collapsed ? "Email Client" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Mail} size={20} /></span>
                <span className="nav-label">Email Client</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('tickets') && (
              <button className={`nav-item ${activeSection === 'tickets' ? 'active' : ''}`} onClick={() => onNavigate('tickets')} onMouseEnter={() => prefetch('tickets')} title={collapsed ? "Tickets" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Ticket} size={20} /></span>
                <span className="nav-label">Tickets</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Messaging ── */}
        {['bot-identity', 'fuji-radio', 'track-announcer', 'bot-messenger', 'private-messages'].some(p => permissions.accessiblePlugins.includes(p)) && (
          <NavGroup id="messaging" label="Messaging" icon={<Send size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {permissions.accessiblePlugins.includes('bot-identity') && (
              <button className={`nav-item ${activeSection === 'bot-identity' ? 'active' : ''}`} onClick={() => onNavigate('bot-identity')} title={collapsed ? "Bot Identity" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={UserIcon} size={20} /></span>
                <span className="nav-label">Bot Identity</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('fuji-radio') && (
              <button className={`nav-item ${activeSection === 'fuji-radio' ? 'active' : ''}`} onClick={() => onNavigate('fuji-radio')} title={collapsed ? "Fuji FM" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Radio} size={20} /></span>
                <span className="nav-label">Fuji FM</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('track-announcer') && (
              <button className={`nav-item ${activeSection === 'track-announcer' ? 'active' : ''}`} onClick={() => onNavigate('track-announcer')} title={collapsed ? "Track Announcer" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Megaphone} size={20} /></span>
                <span className="nav-label">Track Announcer</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('bot-messenger') && (
              <button className={`nav-item ${activeSection === 'bot-messenger' ? 'active' : ''}`} onClick={() => onNavigate('bot-messenger')} title={collapsed ? "Bot Messenger" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Send} size={20} /></span>
                <span className="nav-label">Bot Messenger</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('private-messages') && (
              <button className={`nav-item ${activeSection === 'private-messages' ? 'active' : ''}`} onClick={() => onNavigate('private-messages')} title={collapsed ? "Private Messages" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={MessageSquare} size={20} /></span>
                <span className="nav-label">Private Messages</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Progression ── */}
        {['leveling', 'economy', 'slots', 'server-boost', 'booster-color', 'voice-stats', 'stats'].some(p => permissions.accessiblePlugins.includes(p)) && (
          <NavGroup id="progression" label="Progression" icon={<TrendingUp size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {['leveling', 'economy'].some(p => permissions.accessiblePlugins.includes(p)) && (
              <button className={`nav-item ${activeSection === 'progression' ? 'active' : ''}`} onClick={() => onNavigate('progression')} title={collapsed ? "Progression" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={TrendingUp} size={20} /></span>
                <span className="nav-label">Progression</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('slots') && (
              <button className={`nav-item ${activeSection === 'slots' ? 'active' : ''}`} onClick={() => onNavigate('slots')} title={collapsed ? "Slot Machine" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Dices} size={20} /></span>
                <span className="nav-label">Slot Machine</span>
              </button>
            )}
            {['server-boost', 'booster-color'].some(p => permissions.accessiblePlugins.includes(p)) && (
              <button className={`nav-item ${activeSection === 'boost' ? 'active' : ''}`} onClick={() => onNavigate('boost')} title={collapsed ? "Boost" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Sparkles} size={20} /></span>
                <span className="nav-label">Boost</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('voice-stats') && (
              <button className={`nav-item ${activeSection === 'voice-stats' ? 'active' : ''}`} onClick={() => onNavigate('voice-stats')} title={collapsed ? "Voice Stats" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={BarChart2} size={20} /></span>
                <span className="nav-label">Voice Stats</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('stats') && (
              <button className={`nav-item ${activeSection === 'stats' ? 'active' : ''}`} onClick={() => onNavigate('stats')} title={collapsed ? "Server Stats" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={BarChart3} size={20} /></span>
                <span className="nav-label">Server Stats</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Community ── */}
        {['academy', 'studio-guide', 'production-feedback'].some(p => permissions.accessiblePlugins.includes(p)) && (
          <NavGroup id="community" label="Community" icon={<GraduationCap size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {permissions.accessiblePlugins.includes('academy') && (
              <button className={`nav-item ${activeSection === 'academy' ? 'active' : ''}`} onClick={() => onNavigate('academy')} title={collapsed ? "Academy" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={GraduationCap} size={20} /></span>
                <span className="nav-label">Academy</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('studio-guide') && (
              <button className={`nav-item ${activeSection === 'studio-guide' ? 'active' : ''}`} onClick={() => onNavigate('studio-guide')} title={collapsed ? "Studio Guide" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={BookOpen} size={20} /></span>
                <span className="nav-label">Studio Guide</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('production-feedback') && (
              <button className={`nav-item ${activeSection === 'feedback' ? 'active' : ''}`} onClick={() => onNavigate('feedback')} title={collapsed ? "Feedback" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={MessageSquare} size={20} /></span>
                <span className="nav-label">Feedback</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Battles ── */}
        {(['beat-battle', 'head-to-head', 'drum-kit'].some(p => permissions.accessiblePlugins.includes(p)) || permissions.canManagePlugins) && (
          <NavGroup id="battles" label="Battles" icon={<Swords size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {permissions.accessiblePlugins.includes('beat-battle') && (
              <button className={`nav-item ${activeSection === 'beat-battle' ? 'active' : ''}`} onClick={() => onNavigate('beat-battle')} onMouseEnter={() => prefetch('beat-battle')} title={collapsed ? "Beat Battles" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Swords} size={20} /></span>
                <span className="nav-label">Beat Battles</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('head-to-head') && (
              <button className={`nav-item ${activeSection === 'head-to-head' ? 'active' : ''}`} onClick={() => onNavigate('head-to-head')} title={collapsed ? "Head-to-Head" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Swords} size={20} /></span>
                <span className="nav-label">Head-to-Head</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('drum-kit') && (
              <button className={`nav-item ${activeSection === 'drum-kit' ? 'active' : ''}`} onClick={() => onNavigate('drum-kit')} title={collapsed ? "Drum Kit Generator" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Drum} size={20} /></span>
                <span className="nav-label">Drum Kit Generator</span>
              </button>
            )}
            {permissions.canManagePlugins && (
              <button className={`nav-item ${activeSection === 'vote-fraud' ? 'active' : ''}`} onClick={() => onNavigate('vote-fraud')} title={collapsed ? "Vote Fraud" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={ShieldAlert} size={20} /></span>
                <span className="nav-label">Vote Fraud</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Content ── */}
        {['articles', 'article-review'].some(p => permissions.accessiblePlugins.includes(p)) && (
          <NavGroup id="content" label="Content" icon={<FileText size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {permissions.accessiblePlugins.includes('articles') && (
              <button className={`nav-item ${activeSection === 'articles' ? 'active' : ''}`} onClick={() => onNavigate('articles')} title={collapsed ? "Articles" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={FileText} size={20} /></span>
                <span className="nav-label">Articles</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('article-review') && (
              <button className={`nav-item ${activeSection === 'article-review' ? 'active' : ''}`} onClick={() => onNavigate('article-review')} title={collapsed ? "Article Review" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={ClipboardCheck} size={20} /></span>
                <span className="nav-label">Article Review</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Discover & Profiles ── */}
        {['musician-profiles', 'profile-styles', 'account-management', 'projects', 'fuji-studio'].some(p => permissions.accessiblePlugins.includes(p)) && (
          <NavGroup id="discover" label="Discover & Profiles" icon={<Globe size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {permissions.accessiblePlugins.includes('musician-profiles') && (
              <button className={`nav-item ${activeSection === 'musician-profiles-admin' ? 'active' : ''}`} onClick={() => onNavigate('musician-profiles-admin')} title={collapsed ? "Discover & Profiles" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Palette} size={20} /></span>
                <span className="nav-label">Discover & Profiles</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('musician-profiles') && (
              <button className={`nav-item ${activeSection === 'plugin-registry' ? 'active' : ''}`} onClick={() => onNavigate('plugin-registry')} title={collapsed ? "Plugin Registry" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Puzzle} size={20} /></span>
                <span className="nav-label">Plugin Registry</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('profile-styles') && (
              <button className={`nav-item ${activeSection === 'profile-styles' ? 'active' : ''}`} onClick={() => onNavigate('profile-styles')} title={collapsed ? "Profile Styles" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Palette} size={20} /></span>
                <span className="nav-label">Profile Styles</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('account-management') && (
              <button className={`nav-item ${activeSection === 'account-management' ? 'active' : ''}`} onClick={() => onNavigate('account-management')} title={collapsed ? "Accounts" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Users} size={20} /></span>
                <span className="nav-label">Accounts</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('projects') && (
              <button className="nav-item" onClick={() => navigate('/projects')} title={collapsed ? "Projects" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Layers} size={20} /></span>
                <span className="nav-label">Projects</span>
              </button>
            )}
            {permissions.accessiblePlugins.includes('fuji-studio') && (
              <button className={`nav-item ${activeSection === 'library' ? 'active' : ''}`} onClick={() => onNavigate('library')} title={collapsed ? "Music Library" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Music} size={20} /></span>
                <span className="nav-label">Music Library</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── Reports ── */}
        {(permissions.accessiblePlugins.includes('reports') || permissions.canManagePlugins) && (
          <NavGroup id="reports" label="Reports" icon={<Flag size={12} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.5 }} />} collapsed={collapsed}>
            {permissions.accessiblePlugins.includes('reports') && (
              <button className={`nav-item ${activeSection === 'reports' ? 'active' : ''}`} onClick={() => onNavigate('reports')} title={collapsed ? "Reports" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Flag} size={20} /></span>
                <span className="nav-label">Reports</span>
              </button>
            )}
            {permissions.canManagePlugins && (
              <button className={`nav-item ${activeSection === 'bug-reports' ? 'active' : ''}`} onClick={() => onNavigate('bug-reports')} title={collapsed ? "Bug Reports" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Bug} size={20} /></span>
                <span className="nav-label">Bug Reports</span>
              </button>
            )}
            {permissions.canManagePlugins && (
              <button className={`nav-item ${activeSection === 'activity-logs' ? 'active' : ''}`} onClick={() => onNavigate('activity-logs')} title={collapsed ? "Activity Logs" : ""}>
                <span className="nav-icon"><AnimatedWrapper icon={Activity} size={20} /></span>
                <span className="nav-label">Activity Logs</span>
              </button>
            )}
          </NavGroup>
        )}

        {/* ── System ── */}
        <NavGroup id="system" label="System" icon={null} collapsed={collapsed}>
          {permissions.canManagePlugins && (
            <button className={`nav-item ${activeSection === 'plugins' ? 'active' : ''}`} onClick={() => onNavigate('plugins')} title={collapsed ? "Plugin Management" : ""}>
              <span className="nav-icon"><AnimatedWrapper icon={Settings} size={18} /></span>
              <span className="nav-label">Plugin Management</span>
            </button>
          )}
          {permissions.canManagePlugins && (
            <button className={`nav-item ${activeSection === 'admin-tools' ? 'active' : ''}`} onClick={() => onNavigate('admin-tools')} title={collapsed ? "Admin Tools" : ""}>
              <span className="nav-icon"><AnimatedWrapper icon={HardDrive} size={18} /></span>
              <span className="nav-label">Admin Tools</span>
            </button>
          )}
          <button className={`nav-item ${activeSection === 'database-management' ? 'active' : ''}`} onClick={() => onNavigate('database-management')} title={collapsed ? "Database Backups" : ""}>
            <span className="nav-icon"><AnimatedWrapper icon={Database} size={18} /></span>
            <span className="nav-label">Database Backups</span>
          </button>
          <button className={`nav-item ${activeSection === 'docs' ? 'active' : ''}`} onClick={() => onNavigate('docs')} title={collapsed ? "Documentation" : ""}>
            <span className="nav-icon"><AnimatedWrapper icon={BookOpen} size={18} /></span>
            <span className="nav-label">Documentation</span>
          </button>
          <button className={`nav-item ${activeSection === 'page-embeds' ? 'active' : ''}`} onClick={() => onNavigate('page-embeds')} title={collapsed ? "Page Embeds" : ""}>
            <span className="nav-icon"><AnimatedWrapper icon={Globe} size={18} /></span>
            <span className="nav-label">Page Embeds</span>
          </button>
          <button className="nav-item" onClick={logout} title={collapsed ? "Logout" : ""} style={{ color: colors.error }}>
            <span className="nav-icon"><LogOut size={18} /></span>
            <span className="nav-label">Logout</span>
          </button>
        </NavGroup>
      </div>

      <div className="sidebar-footer">
         <button className="collapse-sidebar-btn" onClick={() => setCollapsed(!collapsed)} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: colors.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse Sidebar</>}
         </button>
      </div>
    </aside>
  );
};
