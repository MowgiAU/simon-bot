
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
import { MessageSquare } from 'lucide-react';

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
        background: `linear-gradient(135deg, ${colors.background} 0%, #1a1e2e 100%)`
      }}>
        <div style={{ 
          background: colors.surface, 
          padding: '48px', 
          borderRadius: '16px', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', 
          textAlign: 'center',
          maxWidth: '400px',
          width: '90%',
          border: `1px solid ${colors.border}`
        }}>
          <img src={logoUrl} alt="Fuji Studio Logo" style={{ width: '80px', height: '80px', marginBottom: '16px' }} />
          <h1 style={{ color: colors.textPrimary, marginBottom: '8px' }}>Fuji Studio</h1>
          <p style={{ color: colors.textSecondary, marginBottom: '32px' }}>
            Advanced community management for FL Studio producers
          </p>
          <button 
            onClick={login} 
            style={{ 
              background: '#5865F2', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              fontSize: '16px', 
              fontWeight: 600, 
              borderRadius: '4px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#4752C4'}
            onMouseOut={(e) => e.currentTarget.style.background = '#5865F2'}
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
          padding: '16px 32px', 
          background: colors.background, 
          borderBottom: `1px solid ${colors.border}33`,
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
           <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
            style={{ display: 'none' }} // Assuming handled by Sidebar logic mostly, but keeping for mobile
          >
            ☰
          </button>
          
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
             <UniversalSearch 
                guildId={selectedGuild.id} 
                onNavigate={handleNavigate} 
                accessiblePlugins={permissions.accessiblePlugins} 
             />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button style={{ background: 'transparent', border: 'none', color: '#B9C3CE', cursor: 'pointer' }}><MessageSquare size={20} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#252D3E', padding: '4px 12px 4px 4px', borderRadius: '20px', border: '1px solid #3E455633' }}>
                 <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: colors.primary, display: 'flex', alignItems: 'center', justifyItems: 'center', overflow: 'hidden' }}>
                    <img src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} style={{ width: '100%', height: '100%' }} alt="User" />
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>{user.username}</span>
                    <span style={{ fontSize: '9px', color: '#8A92A0' }}>{permissions.canManagePlugins ? 'Administrator' : 'Moderator'}</span>
                 </div>
              </div>
          </div>
        </div>
        
        <div style={{ padding: '24px 0' }}>
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
