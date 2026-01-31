
import React, { useState } from 'react';
import { Sidebar } from './layouts/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { WordFilterSettings } from './pages/WordFilterSettings';
import Logs from './pages/Logs';
import { colors } from './theme/theme';
import { AuthProvider, useAuth } from './components/AuthProvider';
import logoUrl from './assets/logo.svg';

type Section = 'dashboard' | 'word-filter-settings' | 'plugins' | 'logs';

const AppContent: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, mutualAdminGuilds, selectedGuild, setSelectedGuild, loading, login, logout } = useAuth();

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
      case 'dashboard':
        return <Dashboard guildId={selectedGuild.id} />;
      case 'logs':
        return <Logs guildId={selectedGuild.id} />;
      case 'plugins':
        return (
          <div style={{ padding: '20px', color: colors.textPrimary }}>
            <h2>Plugins</h2>
            <p>Plugin management coming soon</p>
          </div>
        );
      default:
        return null;
    }
  };

  const handleNavigate = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} user={user} guild={selectedGuild} logout={logout} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="main-content">
        <button
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        {renderContent()}
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
