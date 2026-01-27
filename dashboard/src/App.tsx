import React, { useState } from 'react';
import { Sidebar } from './layouts/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { WordFilterSettings } from './pages/WordFilterSettings';
import { colors } from './theme/theme';

type Section = 'dashboard' | 'word-filter-settings' | 'plugins';

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case 'word-filter-settings':
        return <WordFilterSettings />;
      case 'dashboard':
        return <Dashboard />;
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
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />
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

export default App;
