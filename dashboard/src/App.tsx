
import React, { useState } from 'react';
import { Sidebar } from './layouts/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { WordFilterSettings } from './pages/WordFilterSettings';
import { Logs } from './pages/Logs';
import { colors } from './theme/theme';
import { AuthProvider, useAuth } from './components/AuthProvider';

type Section = 'dashboard' | 'word-filter-settings' | 'plugins' | 'logs';

const AppContent: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, mutualAdminGuilds, selectedGuild, setSelectedGuild, loading, login, logout } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Simon Bot Dashboard</h2>
        <button onClick={login} style={{ fontSize: 18, padding: '12px 32px', marginTop: 24 }}>Login with Discord</button>
      </div>
    );
  }
  if (mutualAdminGuilds.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <h2>No servers found</h2>
        <p>You must be an admin of a server where Simon Bot is present.</p>
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
