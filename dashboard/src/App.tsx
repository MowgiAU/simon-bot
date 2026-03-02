
import React, { useState } from 'react';
import { Sidebar } from './layouts/Sidebar';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { UniversalSearch } from './components/UniversalSearch';
import { colors } from './theme/theme';
import logoUrl from './assets/logo.svg';
import { Dashboard } from './pages/Dashboard';
import { WordFilterSettings } from './pages/WordFilterSettings';
import { ModerationSettingsPage } from './pages/ModerationSettings';
import { PluginManagementPage } from './pages/PluginManagement';
import { EconomyPluginPage } from './pages/EconomyPlugin';
import { FeedbackPluginPage } from './pages/FeedbackPlugin';
import { WelcomeGatePluginPage } from './pages/WelcomeGate';
import { BotIdentityPage } from './pages/BotIdentity';
import { EmailClientPage } from './pages/EmailClient';
import { TicketSystemPage } from './pages/TicketSystem';
import { ChannelRules } from './pages/ChannelRules';
import Logs from './pages/Logs';
import { StagingTest } from './pages/StagingTest';
import { MessageSquare, ArrowRight, Info } from 'lucide-react';

type Section = 'dashboard' | 'word-filter-settings' | 'plugins' | 'logs' | 'staging-test' | 'moderation' | 'economy' | 'feedback' | 'welcome-gate' | 'bot-identity' | 'email-client' | 'tickets' | 'channel-rules';

const AppContent: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const { user, mutualAdminGuilds, selectedGuild, setSelectedGuild, permissions, loading, login, logout } = useAuth();

  if (loading) return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: colors.background, 
      color: colors.textSecondary 
    }}>
      Loading...
    </div>
  );

  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        background: colors.background,
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)' // Subtle green glow
      }}>
        <div style={{ 
          background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))',
          padding: '48px', 
          borderRadius: '24px', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', 
          textAlign: 'center',
          maxWidth: '440px',
          width: '90%',
          border: '1px solid #3E455633',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ 
            width: '100px', 
            height: '100px', 
            background: 'rgba(40, 123, 102, 0.1)', 
            borderRadius: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 24px',
            border: '1px solid rgba(40, 123, 102, 0.2)'
          }}>
            <img src={logoUrl} alt="Fuji Studio Logo" style={{ width: '64px', height: '64px' }} />
          </div>
          
          <h1 style={{ 
            color: colors.textPrimary, 
            marginBottom: '12px', 
            fontSize: '32px', 
            fontWeight: 800,
            letterSpacing: '-0.5px'
          }}>
            Fuji Studio
          </h1>
          
          <p style={{ 
            color: colors.textSecondary, 
            marginBottom: '40px',
            fontSize: '16px',
            lineHeight: 1.5,
            padding: '0 20px'
          }}>
            Advanced community management for FL Studio producers
          </p>

          <button 
            onClick={login} 
            style={{ 
              background: 'rgb(40, 123, 102)', 
              color: 'white', 
              border: 'none', 
              padding: '16px 32px', 
              fontSize: '16px', 
              fontWeight: 700, 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 15px rgba(40, 123, 102, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(40, 123, 102, 0.4)';
              e.currentTarget.style.background = 'rgb(45, 138, 115)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(40, 123, 102, 0.3)';
              e.currentTarget.style.background = 'rgb(40, 123, 102)';
            }}
          >
            <span style={{ fontSize: '20px' }}>⚡</span> Login with Discord
          </button>
        </div>
      </div>
    );
  }
  if (mutualAdminGuilds.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <h2>No servers found</h2>
        <p>You must be an admin of a server where Fuji Studio is present.</p>
        <button onClick={logout} style={{ marginTop: 24 }}>Logout</button>
      </div>
    );
  }
  if (!selectedGuild) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Select a server</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {mutualAdminGuilds.map(g => (
            <li key={g.id} style={{ margin: '16px 0' }}>
              <button onClick={() => setSelectedGuild(g)} style={{ fontSize: 18, padding: '10px 24px' }}>
                {g.icon && <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} alt="icon" style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12, verticalAlign: 'middle' }} />}
                {g.name}
              </button>
            </li>
          ))}
        </ul>
        <button onClick={logout} style={{ marginTop: 24 }}>Logout</button>
      </div>
    );
  }

  // Main dashboard UI
  const renderContent = () => {
    switch (activeSection) {
      case 'word-filter-settings':
        return <WordFilterSettings guildId={selectedGuild.id} />;
      case 'moderation':
        return <ModerationSettingsPage />;
      case 'economy':
        return <EconomyPluginPage />;
      case 'feedback':
        return <FeedbackPluginPage />;
      case 'welcome-gate':
        return <WelcomeGatePluginPage />;
      case 'bot-identity':
        return <BotIdentityPage />;
      case 'email-client':
        return <EmailClientPage searchParam={navigationParams?.searchParam} />;
      case 'tickets':
         return <TicketSystemPage guildId={selectedGuild.id} searchParam={navigationParams?.searchParam} />;
      case 'channel-rules':
         return <ChannelRules guildId={selectedGuild.id} />;
      case 'dashboard':
        return <Dashboard 
          guildId={selectedGuild.id} 
          onNavigate={handleNavigate} 
          accessiblePlugins={permissions.accessiblePlugins} 
        />;
      case 'logs':
        return <Logs guildId={selectedGuild.id} searchParam={navigationParams?.searchParam} />;
      case 'staging-test':
        return <StagingTest />;
      case 'plugins':
        return <PluginManagementPage />;
      default:
        return null;
    }
  };

  const handleNavigate = (section: Section, params: any = null) => {
    setActiveSection(section);
    setNavigationParams(params);
    setSidebarOpen(false);
  };

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar 
          activeSection={activeSection} 
          onNavigate={handleNavigate} 
          user={user} 
          guild={selectedGuild} 
          permissions={permissions} 
          logout={logout} 
      />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="main-content">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 24px', 
          background: 'rgb(34,43,61)', 
          borderBottom: '1px solid #1F293A',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          margin: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 24px 0 rgba(0,0,0,0.1)'
        }}>
           <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
            style={{ display: 'none' }} // Assuming handled by Sidebar logic mostly, but keeping for mobile
          >
            ☰
          </button>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
             <UniversalSearch 
                guildId={selectedGuild.id} 
                onNavigate={handleNavigate} 
                accessiblePlugins={permissions.accessiblePlugins} 
             />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <MessageSquare size={20} color={colors.textSecondary} style={{ cursor: 'pointer' }} />
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: colors.highlight, borderRadius: '50%', border: '2px solid #222B3D' }} />
              </div>
              
              <div style={{ width: '1px', height: '24px', background: '#1F293A' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{user.username}</span>
                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>{permissions.canManagePlugins ? 'Administrator' : 'Moderator'}</span>
                 </div>
                 <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: colors.primary, display: 'flex', alignItems: 'center', justifyItems: 'center', overflow: 'hidden', border: '2px solid #1F293A' }}>
                    <img src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} style={{ width: '100%', height: '100%' }} alt="User" />
                 </div>
              </div>
          </div>
        </div>
        
        <div style={{ padding: '0 16px 24px' }}>
            {/* Context Info Bar */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px 24px',
                color: colors.textSecondary,
                fontSize: '13px',
                background: '#253040',
                border: '1px solid #202A3C',
                borderRadius: '8px',
                margin: '16px'
            }}>
                <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px', 
                    background: `${colors.primary}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.primary
                }}>
                    <Info size={18} />
                </div>
                <div>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', marginRight: '8px' }}>
                        {activeSection === 'dashboard' ? 'Fuji Studio' : activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace(/-/g, ' ')} :
                    </span>
                    Manage your community, configuration, and automation tools. Changes sync in real-time.
                </div>
                <div style={{ flex: 1 }} />
                <a href="#" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Documentation <ArrowRight size={14} />
                </a>
            </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
