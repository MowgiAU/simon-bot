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
  HelpCircle
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
    content: 'Fuji Studio is a modular, high-performance Discord bot designed specifically for music production communities. It provides advanced tools for moderation, economy, ticket management, and producer-focused utilities.',
    requirements: ['Node.js 18+', 'PostgreSQL', 'Discord Bot Token']
  },
  {
    id: 'moderation',
    title: 'Moderation System',
    icon: <Shield size={20} />,
    color: colors.primary,
    content: 'A robust suite of tools for maintaining community standards. Includes advanced logging, automated warnings, timed silences, and customizable permissions for staff members.',
    commands: ['/ban', '/kick', '/timeout', '/warn', '/purge'],
    requirements: ['Manage Members permission', 'Kick/Ban permissions', 'Bot role must be high in hierarchy']
  },
  {
    id: 'word-filter',
    title: 'Word Filter & Protection',
    icon: <ShieldAlert size={20} />,
    color: colors.highlight,
    content: 'Proactive protection against toxicity, spam, and prohibited content. Group-based filtering allows for nuanced control over different types of content in specific channels.',
    commands: ['/filter add', '/filter remove', '/filter list'],
    requirements: ['Manage Messages permission']
  },
  {
    id: 'tickets',
    title: 'Ticket Support System',
    icon: <MessageSquare size={20} />,
    color: colors.info,
    content: 'Efficient handling of user inquiries through private, loggable support channels. Includes automatic transcripts and customizable category templates.',
    commands: ['/ticket open', '/ticket close', '/ticket add-user'],
    requirements: ['Manage Channels permission', 'Support Role configured']
  },
  {
    id: 'economy',
    title: 'Studio Economy',
    icon: <DollarSign size={20} />,
    color: colors.success,
    content: 'Reward community engagement with custom currency. Users can earn points for activity and spend them on special roles or producer-related items through the shop.',
    commands: ['/balance', '/work', '/shop', '/pay', '/daily'],
    requirements: ['Database connectivity']
  },
  {
    id: 'welcome-gate',
    title: 'Welcome Gate & Verify',
    icon: <UserPlus size={20} />,
    color: colors.info,
    content: 'Streamline onboarding with automated verification and welcome sequences. Prevents raids and ensures newcomers read the rules before joining the general chat.',
    requirements: ['Manage Roles permission']
  }
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
      'tickets': 'tickets',
      'economy': 'economy',
      'welcome-gate': 'welcome-gate'
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
    <div style={{ padding: isMobile ? '24px 16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
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
