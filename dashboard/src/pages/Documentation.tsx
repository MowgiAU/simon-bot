import React, { useState, useEffect } from 'react';
import { 
  Book, 
  Shield, 
  ShieldAlert, 
  MessageSquare, 
  DollarSign, 
  UserPlus, 
  Terminal, 
  Settings,
  ChevronRight,
  Search,
  ExternalLink,
  HelpCircle,
  Swords,
  FileText,
  Mail,
  MonitorPlay,
  Radio,
  TrendingUp,
  ScrollText,
  Music,
  BarChart,
  Users,
  ShieldOff,
  BookOpen,
  Palette,
} from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  content: string;
  commands?: string[];
  requirements?: string[];
}

const docSections: DocSection[] = [
  {
    id: 'overview',
    title: 'Fuji Studio Overview',
    icon: <Book size={20} />,
    color: colors.primary,
    content: 'Fuji Studio is a modular, high-performance Discord bot designed specifically for music production communities. Every feature runs as an independent plugin that can be enabled, disabled, and role-restricted from the Plugin Management page. The dashboard gives admins and authorised staff full control over configuration, moderation tools, and community features — all in one place.',
    requirements: ['Node.js 18+', 'PostgreSQL via Prisma', 'Discord Bot Token', 'Plugin Management access for admins']
  },
  {
    id: 'moderation',
    title: 'Moderation System',
    icon: <Shield size={20} />,
    color: colors.primary,
    content: 'A comprehensive suite for maintaining community standards. Includes kick, ban (with optional duration for auto-unban), timeout, warnings, and bulk message purge. All actions are logged to the audit trail and generate DM notifications to the affected user. Duration strings support seconds, minutes, hours, days and weeks (e.g. "7d", "24h").',
    commands: ['/kick [user] [reason]', '/ban [user] [reason] [duration]', '/timeout [user] [duration] [reason]', '/warn [user] [reason]', '/purge [amount]', '/modlog [user]'],
    requirements: ['Manage Members permission', 'Kick Members / Ban Members permissions', 'Bot role must be higher than target in role hierarchy']
  },
  {
    id: 'word-filter',
    title: 'Word Filter & Protection',
    icon: <ShieldAlert size={20} />,
    color: colors.highlight,
    content: 'Proactive content filtering with group-based word lists. When a filtered word is detected, the message is deleted and optionally reposted via webhook with the word replaced — preserving the author\'s name and avatar. Supports automatic plural detection (e.g. "lime" also catches "limes"), custom replacement text or emoji per group, and per-group channel/role exclusions.',
    commands: ['/filter add [group] [word]', '/filter remove [group] [word]', '/filter list'],
    requirements: ['Manage Messages permission', 'Webhook permission (for repost mode)']
  },
  {
    id: 'anti-piracy',
    title: 'Anti-Piracy Protection',
    icon: <ShieldOff size={20} />,
    color: colors.warning,
    content: 'Automatically detects and moderates software piracy discussion, with a focus on FL Studio and music production tools. Uses a two-stage approach: fast keyword pre-filtering with 30+ default piracy terms, followed by optional AI classification via OpenAI for ambiguous messages. Configurable actions include warn only, delete, or delete and warn. Supports custom keywords, and channel/role exclusions.',
    requirements: ['OpenAI API key (optional, for AI mode)', 'Manage Messages permission']
  },
  {
    id: 'leveling',
    title: 'Leveling System',
    icon: <TrendingUp size={20} />,
    color: colors.info,
    content: 'High-performance XP and leveling system with multiple earning methods. Users gain XP from messages (with cooldown), voice chat time (tracked every 60 seconds), reactions, and daily login streaks. The XP curve follows 100 × level^1.5 + 400. Includes configurable role rewards that auto-assign at specific levels, sticky roles that persist when members leave and rejoin, and an economy-integrated XP boost purchase.',
    commands: ['/rank [user]', '/leaderboard [type] [page]', '/xp give [user] [amount]', '/xp remove [user] [amount]', '/xp set [user] [level]', '/leveling-sync [user]', '/xpboost'],
    requirements: ['Manage Roles permission (for role rewards)', 'Economy plugin (optional, for /xpboost)']
  },
  {
    id: 'channel-rules',
    title: 'Channel Rules & Gatekeeper',
    icon: <FileText size={20} />,
    color: colors.primary,
    content: 'Advanced per-channel traffic control and content moderation. Define rules per channel to enforce content standards automatically. Supported rule types: block specific file types, block all files, require attachments, minimum/maximum message length, max newlines, regex pattern matching, caps ratio limiting (default 70%), and domain blocking. Each rule supports role exemptions, and an approval queue system allows moderators to review and approve flagged messages via buttons.',
    requirements: ['Manage Messages permission', 'Webhook permission (for approval reposts)']
  },
  {
    id: 'tickets',
    title: 'Ticket Support System',
    icon: <MessageSquare size={20} />,
    color: colors.info,
    content: 'Private support channels for handling user inquiries. Admins configure a category, staff roles, and a transcript log channel, then deploy a ticket creation panel with a button. Users click to open a private ticket channel visible only to them and staff. Supports adding/removing users from tickets, priority levels (low, medium, high), and automatic transcript generation on close.',
    commands: ['/ticket setup [category] [initial_role]', '/ticket staff-add [role]', '/ticket staff-remove [role]', '/ticket panel [channel]', '/ticket transcript-channel [channel]', '/ticket close', '/ticket add [user]', '/ticket remove [user]', '/ticket priority [level]'],
    requirements: ['Manage Channels permission', 'At least one staff role configured']
  },
  {
    id: 'economy',
    title: 'Studio Economy',
    icon: <DollarSign size={20} />,
    color: colors.success,
    content: 'Reward community engagement with a custom server currency. Users earn passively by chatting (with configurable cooldown and minimum message length), and can tip each other via emoji reactions (1 coin per reaction). The economy integrates with the Leveling system — earning bonuses scale at +2% per 5 levels. Includes a server shop where admins can list items with stock tracking, and a wealth leaderboard.',
    commands: ['/wallet [user]', '/wealth', '/market', '/buy [item]'],
    requirements: ['Database connectivity', 'Leveling plugin (optional, for scaled rewards)']
  },
  {
    id: 'welcome-gate',
    title: 'Welcome Gate & Verify',
    icon: <UserPlus size={20} />,
    color: colors.info,
    content: 'Streamlined onboarding with button-triggered verification. New members are auto-assigned an unverified role on join. Clicking the verify button in the welcome channel opens a modal with up to 5 configurable questions. On submission, the unverified role is swapped for the verified role, granting access to the server. Prevents raids and ensures newcomers acknowledge the rules.',
    commands: ['/setup-welcome [channel] [title] [description]'],
    requirements: ['Manage Roles permission', 'Unverified and Verified roles created']
  },
  {
    id: 'production-feedback',
    title: 'Production Feedback',
    icon: <Palette size={20} />,
    color: colors.accent,
    content: 'AI-assisted music production feedback system built around a forum channel. Users spend economy currency to create feedback threads (configurable cost), then post their audio. Other producers submit text feedback which is scored by an AI service for quality. Approved feedback is reposted to the thread via webhook — reviewers earn a configurable currency reward. Includes an approval workflow with accept/deny buttons for moderators.',
    commands: ['/feedback-init'],
    requirements: ['Forum channel configured', 'Economy plugin (for thread cost/rewards)', 'OpenAI API key (for AI scoring)']
  },
  {
    id: 'email-client',
    title: 'Email Client',
    icon: <Mail size={20} />,
    color: colors.highlight,
    content: 'Dashboard-based email management for community communications. Incoming emails are polled every 15 seconds and displayed in the dashboard inbox with full read/unread tracking, search, and compose capabilities. Optionally sends Discord notifications to a configured channel with role mentions when new mail arrives. All email management happens through the dashboard — no slash commands needed.',
    requirements: ['Email routing configured (e.g. Cloudflare Email Workers)', 'Notification channel (optional)']
  },
  {
    id: 'beat-battle',
    title: 'Beat Battles',
    icon: <Swords size={20} />,
    color: colors.warning,
    content: 'Host competitive beat-making contests on the website with Discord integration. Battles progress through lifecycle phases: upcoming → active (submissions open) → voting → completed. Producers submit entries via the website, community members vote, and results are announced in a configurable Discord channel. Supports battle sponsorship, entry archives, and a lifetime leaderboard. Winners are tracked across all battles.',
    commands: ['/battle info', '/battle leaderboard'],
    requirements: ['Announcement channel configured (optional)']
  },
  {
    id: 'featured-content',
    title: 'Featured Content',
    icon: <MonitorPlay size={20} />,
    color: colors.accent,
    content: 'Showcase top community content on the public website\'s discovery page. Admins select which type of content is featured (e.g. featured video, producer spotlight, or community pick). The content type and associated media are configured entirely through the dashboard and displayed prominently on the public-facing site.',
    requirements: ['Admin access to configure']
  },
  {
    id: 'fuji-radio',
    title: 'Fuji FM Radio',
    icon: <Radio size={20} />,
    color: colors.primary,
    content: 'Community radio station with two modes: 24/7 auto-pilot that plays approved tracks from the music library, and a live host/DJ mode where a user takes control of the queue. Listeners earn XP every 60 seconds while tuned in. Features include tipping the currently playing artist with economy currency, liking tracks to add them to favourites, and a track queue system. The radio auto-reconnects on voice connection drops.',
    commands: ['/radio start', '/radio stop', '/radio host', '/radio skip', '/radio queue [track]', '/radio np', '/tip [amount]', '/like', '/nowplaying'],
    requirements: ['Voice channel access', 'Approved tracks in music library', 'Economy plugin (for tipping)']
  },
  {
    id: 'logger',
    title: 'Audit Logs',
    icon: <ScrollText size={20} />,
    color: colors.textSecondary,
    content: 'Centralised logging system that records all moderation and system actions with timestamps, executor info, and targets. Supports historical log importing from popular bots (Dyno, Carl) to consolidate your audit trail. Logs are searchable and filterable in the dashboard by action type, user, and date range. Use the clear command to purge logs in a specific category if needed.',
    commands: ['/logger import [channel] [category]', '/logger clear [category]'],
    requirements: ['Administrator permission (for clear)']
  },
  {
    id: 'musician-profiles',
    title: 'Musician Profiles & Discovery',
    icon: <Music size={20} />,
    color: colors.accent,
    content: 'Full-featured producer profiles with public portfolio pages. Members create profiles with their bio, primary DAW, location, genres, and social links. Profiles are publicly accessible at fujistud.io/profile/{username} and appear in the Artist Discovery page. The dashboard admin view allows moderating profiles, managing featured artists, and reviewing profile content. Track uploads, playlists, and favourites are all tied to the profile system.',
    commands: ['/profile view [user]', '/profile edit'],
    requirements: ['Profile setup completed by user']
  },
  {
    id: 'stats',
    title: 'Server Statistics',
    icon: <BarChart size={20} />,
    color: colors.info,
    content: 'Passive activity tracking that powers the dashboard Overview charts and analytics. Automatically tracks message counts per channel, voice session durations, bans, and member join/leave events. Data is aggregated daily and displayed as historical graphs on the dashboard. Includes member last-active timestamps and auto-scans for existing voice sessions on startup. No user interaction required — runs entirely in the background.',
    requirements: ['Runs automatically — no setup needed']
  },
  {
    id: 'studio-guide',
    title: 'Studio Guide AI',
    icon: <BookOpen size={20} />,
    color: colors.primary,
    content: 'AI-powered assistant that monitors a configured help channel and answers FL Studio, music theory, and production questions using the official manuals and a FAISS vector knowledge base. Only responds when a message is identified as a relevant music production question. Supports image recognition for screenshots. Includes guild-wide pause (for when humans want to answer), per-user opt-out, conversation history tracking (15-minute TTL, 20-message max), and a direct /guide ask command.',
    commands: ['/guide pause [minutes]', '/guide resume', '/guide optout [minutes]', '/guide optin', '/guide ask [question]', '/guide status'],
    requirements: ['OpenAI API key', 'FAISS vector store with FL Studio knowledge', 'Designated help channel']
  },
  {
    id: 'account-management',
    title: 'Account Management',
    icon: <Users size={20} />,
    color: colors.textSecondary,
    content: 'Admin-only dashboard panel for managing user accounts across the platform. View all registered accounts with search and filtering, check account details (Discord link status, email verification, login method, role), and perform administrative actions. Centralises user management for the website and dashboard access system.',
    requirements: ['Admin access required']
  },
];

export const DocumentationPage: React.FC<{ initialSection?: string, onNavigate?: (section: any) => void }> = ({ initialSection, onNavigate }) => {
  const [activeSection, setActiveSection] = useState(initialSection || docSections[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleOpenSettings = () => {
    if (!onNavigate) return;
    
    const settingsMap: any = {
      'overview': 'dashboard',
      'moderation': 'moderation',
      'word-filter': 'word-filter-settings',
      'anti-piracy': 'anti-piracy',
      'leveling': 'leveling',
      'channel-rules': 'channel-rules',
      'tickets': 'tickets',
      'economy': 'economy',
      'welcome-gate': 'welcome-gate',
      'production-feedback': 'feedback',
      'email-client': 'email-client',
      'beat-battle': 'beat-battle',
      'featured-content': 'featured-content',
      'fuji-radio': 'fuji-radio',
      'logger': 'logs',
      'musician-profiles': 'musician-profiles-admin',
      'studio-guide': 'studio-guide',
      'account-management': 'account-management',
    };

    const target = settingsMap[activeSection];
    if (target) {
      onNavigate(target);
    }
  };

  // Handle section changes when navigating from outside
  React.useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const currentSection = docSections.find(s => s.id === activeSection) || docSections[0];

  const filteredSections = docSections.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Book size={32} color={colors.primary} style={{ marginRight: '16px' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: colors.textPrimary }}>Documentation</h1>
          <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '14px' }}>Learn how to configure and use Fuji Studio's powerful plugins.</p>
        </div>
      </div>

      {isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.border}`,
            color: colors.textPrimary, cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            marginBottom: '16px', width: '100%', justifyContent: 'center'
          }}
        >
          <Search size={16} /> {showSidebar ? 'Hide Navigation' : 'Show Navigation'}
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '32px' }}>
        {/* Sidebar */}
        <div style={{ display: isMobile && !showSidebar ? 'none' : 'block' }}>
          <div style={{ 
            position: 'relative',
            marginBottom: '20px'
          }}>
            <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: colors.surface,
                border: '1px solid #3E455633',
                borderRadius: '8px',
                padding: '10px 12px 10px 36px',
                color: colors.textPrimary,
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredSections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: activeSection === s.id ? 'rgba(40, 123, 102, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: activeSection === s.id ? colors.primary : colors.textSecondary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  fontWeight: activeSection === s.id ? 700 : 500
                }}
              >
                <div style={{ color: activeSection === s.id ? colors.primary : colors.textSecondary, opacity: activeSection === s.id ? 1 : 0.6 }}>
                  {s.icon}
                </div>
                <span style={{ flex: 1 }}>{s.title}</span>
                {activeSection === s.id && <ChevronRight size={14} />}
              </button>
            ))}
          </div>

          <div style={{ 
            marginTop: '32px', 
            padding: '20px', 
            background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.4), rgba(26, 30, 46, 0.5))',
            borderRadius: '12px',
            border: '1px solid #3E455622'
          }}>
            <h4 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: '14px' }}>Need extra help?</h4>
            <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '12px' }}>Join our community server to talk with other Fuji Studio users.</p>
            <button style={{ 
              width: '100%', 
              background: colors.info, 
              color: colors.textPrimary, 
              border: 'none', 
              borderRadius: '6px', 
              padding: '8px', 
              fontSize: '12px', 
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <ExternalLink size={14} /> Discord Support
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))',
          borderRadius: '24px',
          border: '1px solid #3E455633',
          padding: isMobile ? '24px' : '40px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              background: `${currentSection.color}15`, 
              borderRadius: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: currentSection.color,
              border: `1px solid ${currentSection.color}25`
            }}>
              {React.cloneElement(currentSection.icon as React.ReactElement, { size: 32 })}
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>{currentSection.title}</h2>
          </div>

          <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: '32px', borderLeft: `4px solid ${currentSection.color}` }}>
             <p style={{ margin: 0, color: colors.textPrimary, fontSize: '14px', lineHeight: '1.6' }}>{currentSection.content}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '32px' }}>
            {currentSection.commands && (
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textPrimary, marginBottom: '16px' }}>
                  <Terminal size={18} color={currentSection.color} /> Available Commands
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentSection.commands.map((cmd, i) => (
                    <code key={i} style={{ 
                      background: colors.background, 
                      padding: '8px 12px', 
                      borderRadius: borderRadius.sm, 
                      color: colors.primary,
                      fontSize: '13px',
                      border: '1px solid #3E455622'
                    }}>
                      {cmd}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {currentSection.requirements && (
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textPrimary, marginBottom: '16px' }}>
                  <HelpCircle size={18} color={currentSection.color} /> Requirements
                </h4>
                <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                  {currentSection.requirements.map((req, i) => (
                    <li key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '10px', 
                      marginBottom: '10px',
                      color: colors.textSecondary,
                      fontSize: '14px'
                    }}>
                      <div style={{ width: '6px', height: '6px', background: currentSection.color, borderRadius: '50%', marginTop: '6px' }} />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={{ 
            marginTop: '48px', 
            padding: '24px', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '16px',
            border: '1px solid #3E455622',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 8px', color: colors.textPrimary }}>Ready to configure?</h4>
            <p style={{ margin: '0 0 24px', color: colors.textSecondary, fontSize: '14px' }}>Head over to the {currentSection.title.split(' ')[0]} settings page to start using these features.</p>
            <button 
              onClick={handleOpenSettings}
              style={{
                background: `linear-gradient(135deg, ${currentSection.color} 0%, ${currentSection.color}dd 100%)`,
                color: colors.textPrimary,
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: `0 4px 15px ${currentSection.color}33`
              }}
            >
              Open {currentSection.title.split(' ')[0]} Settings Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
