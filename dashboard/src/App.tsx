import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { ResourceProvider } from "./components/ResourceProvider";
import { PlayerProvider } from "./components/PlayerProvider";
import { GlobalPlayer } from "./components/GlobalPlayer";
import { Sidebar } from "./layouts/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { WordFilterSettings } from "./pages/WordFilterSettings";
import { ModerationSettingsPage } from "./pages/ModerationSettings";
import { EconomyPluginPage } from "./pages/EconomyPlugin";
import { FeedbackPluginPage } from "./pages/FeedbackPlugin";
import { WelcomeGatePluginPage } from "./pages/WelcomeGate";
import { BotIdentityPage } from "./pages/BotIdentity";
import { EmailClientPage } from "./pages/EmailClient";
import { TicketSystemPage } from "./pages/TicketSystem";
import { ChannelRules } from "./pages/ChannelRules";
import { MusicianProfileAdmin } from "./pages/MusicianProfileAdmin";
import { MusicianProfilePage } from "./pages/MusicianProfile";
import { TrackPage } from "./pages/TrackPage";
import { DocumentationPage } from "./pages/Documentation";
import Logs from "./pages/Logs";
import { StagingTest } from "./pages/StagingTest";
import { PluginManagementPage } from "./pages/PluginManagement";
import { ArtistDiscoveryPage } from "./pages/ArtistDiscovery";
import { FujiStudio } from "./pages/FujiStudio";
import { UniversalSearch } from "./components/UniversalSearch";
import { NotificationMenu } from "./components/NotificationMenu";
import { InternalChat } from "./components/InternalChat";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { colors } from "./theme/theme";
import { Info, ArrowRight } from "lucide-react";

import { AppStyles } from "./AppStyles";
import logoUrl from "./assets/logo.svg";

type Section = 
  | "dashboard" 
  | "word-filter-settings" 
  | "moderation" 
  | "economy" 
  | "feedback" 
  | "welcome-gate" 
  | "bot-identity" 
  | "email-client" 
  | "tickets" 
  | "channel-rules" 
  | "musician-profiles-admin"
  | "musician-profiles"
  | "library"
  | "docs"
  | "logs"
  | "staging-test"
  | "plugins";

const WelcomeScreen: React.FC<{ login: () => void }> = ({ login }) => (
  <div style={{ 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    height: "100vh", 
    background: colors.background,
    backgroundImage: "radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)" 
  }}>
    <div style={{ 
      background: "linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))",
      padding: "48px", 
      borderRadius: "24px", 
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)", 
      textAlign: "center",
      maxWidth: "440px",
      width: "90%",
      border: "1px solid #3E455633",
      backdropFilter: "blur(10px)"
    }}>
      <div style={{ 
        width: "100px", 
        height: "100px", 
        background: "rgba(40, 123, 102, 0.1)", 
        borderRadius: "24px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        margin: "0 auto 24px",
        border: "1px solid rgba(40, 123, 102, 0.2)"
      }}>
        <img src={logoUrl} alt="Fuji Studio Logo" style={{ width: "64px", height: "64px", filter: "brightness(0) invert(1)" }} />
      </div>
      
      <h1 style={{ 
        color: colors.textPrimary, 
        marginBottom: "12px", 
        fontSize: "32px", 
        fontWeight: 800,
        letterSpacing: "-0.5px"
      }}>
        Fuji Studio
      </h1>
      
      <p style={{ 
        color: colors.textSecondary, 
        marginBottom: "40px",
        fontSize: "16px",
        lineHeight: 1.5,
        padding: "0 20px"
      }}>
        Advanced community management for FL Studio producers
      </p>

      <button 
        onClick={login} 
        style={{ 
          background: "rgb(40, 123, 102)", 
          color: "white", 
          border: "none", 
          padding: "16px 32px", 
          fontSize: "16px", 
          fontWeight: 700, 
          borderRadius: "12px", 
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          width: "100%",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 4px 15px rgba(40, 123, 102, 0.3)"
        }}
        onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(40, 123, 102, 0.4)";
          e.currentTarget.style.background = "rgb(45, 138, 115)";
        }}
        onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 15px rgba(40, 123, 102, 0.3)";
          e.currentTarget.style.background = "rgb(40, 123, 102)";
        }}
      >
        <span style={{ fontSize: "20px" }}>⚡</span> Login with Discord
      </button>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const navigate = useNavigate();

  const { user, mutualAdminGuilds, selectedGuild, setSelectedGuild, permissions, loading, login, logout } = useAuth();

  if (loading) return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh", 
      backgroundColor: colors.background, 
      color: colors.textSecondary 
    }}>
      Loading...
    </div>
  );

  if (!user) {
    return <WelcomeScreen login={login} />;
  }

  if (mutualAdminGuilds.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", backgroundColor: colors.background, minHeight: "100vh", color: colors.textPrimary }}>
        <div style={{ maxWidth: "500px", margin: "100px auto", padding: "40px", borderRadius: "24px", background: "rgba(34, 43, 61, 0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <h2>No Admin Communities Found</h2>
          <p style={{ color: colors.textSecondary, marginBottom: "24px" }}>You are not an administrator of any Discord servers where Fuji Studio is present.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button 
              onClick={() => navigate("/profile")} 
              style={{ background: colors.primary, color: "white", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
            >
              Go to My Musician Profile
            </button>
            <button 
              onClick={logout} 
              style={{ background: "rgba(255,255,255,0.05)", color: colors.textSecondary, border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer" }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedGuild) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Select a server</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {mutualAdminGuilds.map(g => (
            <li key={g.id} style={{ margin: "16px 0" }}>
              <button onClick={() => setSelectedGuild(g)} style={{ fontSize: 18, padding: "10px 24px" }}>
                {g.icon && <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} alt="icon" style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12, verticalAlign: "middle" }} />}
                {g.name}
              </button>
            </li>
          ))}
        </ul>
        <button onClick={logout} style={{ marginTop: 24 }}>Logout</button>
      </div>
    );
  }

  const handleNavigate = (section: Section, params: any = null) => {
    setActiveSection(section);
    setNavigationParams(params);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    console.log('[App] Rendering Dashboard Content, section:', activeSection);
    switch (activeSection) {
      case "word-filter-settings":
        return <WordFilterSettings guildId={selectedGuild.id} />;
      case "moderation":
        return <ModerationSettingsPage />;
      case "economy":
        return <EconomyPluginPage />;
      case "feedback":
        return <FeedbackPluginPage />;
      case "welcome-gate":
        return <WelcomeGatePluginPage />;
      case "bot-identity":
        return <BotIdentityPage />;
      case "email-client":
        return <EmailClientPage searchParam={navigationParams?.searchParam} />;
      case "tickets":
         return <TicketSystemPage guildId={selectedGuild.id} searchParam={navigationParams?.searchParam} />;
      case "channel-rules":
         return <ChannelRules guildId={selectedGuild.id} />;
      case "musician-profiles-admin":
        return <MusicianProfileAdmin />;
      case "musician-profiles":
        return <MusicianProfilePage />;
      case "library":
        return <FujiStudio />;
      case "docs":
        return <DocumentationPage 
          initialSection={navigationParams?.docSection} 
          onNavigate={handleNavigate} 
        />;
      case "dashboard":
        return <Dashboard 
          guildId={selectedGuild.id} 
          onNavigate={handleNavigate} 
          accessiblePlugins={permissions.accessiblePlugins} 
        />;
      case "logs":
        return <Logs guildId={selectedGuild.id} searchParam={navigationParams?.searchParam} />;
      case "staging-test":
        return <StagingTest />;
      case "plugins":
        return <PluginManagementPage />;
      default:
        return null;
    }
  };

  return (
    <div className={`app ${sidebarOpen ? "sidebar-open" : ""}`}>
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
      <main className="main-content" style={{ 
        transition: "margin-left 0.3s ease",
        height: "100vh",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: window.innerWidth > 768 ? "12px 24px" : "8px 12px", 
          background: "rgb(34,43,61)", 
          borderBottom: "1px solid #1F293A",
          position: "relative",
          zIndex: 100,
          margin: "0",
          borderRadius: 0,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          gap: "8px",
          minHeight: "56px"
        }}>
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
            style={{ 
              display: "flex", 
              background: "rgba(255,255,255,0.05)", 
              border: "1px solid rgba(255,255,255,0.1)", 
              color: "white", 
              padding: "6px", 
              borderRadius: "8px",
              cursor: "pointer",
              marginRight: "4px"
            }} 
          >
            <span style={{ fontSize: "18px" }}>{sidebarOpen ? '✕' : '☰'}</span>
          </button>
          
          <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
             <UniversalSearch 
                guildId={selectedGuild.id} 
                onNavigate={handleNavigate} 
                accessiblePlugins={permissions.accessiblePlugins} 
             />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <NotificationMenu guildId={selectedGuild.id} />
              
              <div style={{ width: window.innerWidth > 768 ? "38px" : "28px", height: window.innerWidth > 768 ? "38px" : "28px", borderRadius: "8px", background: colors.primary, display: "flex", alignItems: "center", justifyItems: "center", overflow: "hidden", border: "1px solid #1F293A", flexShrink: 0 }}>
                <img src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="User" />
              </div>
          </div>
        </div>
        
        <div className="main-content-scroll-container">
          <div style={{ padding: window.innerWidth > 768 ? "0 16px 24px" : "0" }}>
            <div 
              className="info-banner-hide-mobile"
              style={{ 
                display: window.innerWidth > 768 ? "flex" : "none", 
                alignItems: "center", 
                gap: "12px", 
                padding: "12px 24px",
                color: colors.textSecondary,
                fontSize: "13px",
                background: "#253040",
                border: "1px solid #202A3C",
                borderRadius: "8px",
                margin: "16px"
            }}>
                <div style={{ 
                    width: "32px", 
                    height: "32px", 
                    borderRadius: "8px", 
                    background: `${colors.primary}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.primary
                }}>
                    <Info size={18} />
                </div>
                <div>
                    <span style={{ fontWeight: 700, color: "#FFFFFF", marginRight: "8px" }}>
                        {activeSection === "dashboard" ? "Fuji Studio" : activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace(/-/g, " ")} :
                    </span>
                    Manage your community, configuration, and automation tools. Changes sync in real-time.
                </div>
                <div style={{ flex: 1 }} />
                <button 
                  onClick={() => {
                    const docMap: any = {
                      "dashboard": "overview",
                      "moderation": "moderation",
                      "word-filter-settings": "word-filter",
                      "tickets": "tickets",
                      "economy": "economy",
                      "welcome-gate": "welcome-gate"
                    };
                    handleNavigate("docs", { docSection: docMap[activeSection] || "overview" });
                  }} 
                  style={{ background: "none", border: "none", cursor: "pointer", color: colors.primary, fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                >
                    Documentation <ArrowRight size={14} />
                </button>
            </div>

          {renderContent()}
          </div>
        </div>
      </main>
      <InternalChat guildId={selectedGuild.id} />
    </div>
  );
};

/**
 * AppInternal: Pure path-based routing. All providers are already wrapped above,
 * so every hook (useAuth, usePlayer, useResources) is always available.
 */
const AppInternal: React.FC = () => {
  const { pathname: currentPath } = useLocation();

  // /dashboard → Full admin dashboard
  if (currentPath.startsWith('/dashboard')) {
    return (
      <ResourceProvider>
        <AdminDashboard />
      </ResourceProvider>
    );
  }

  // /profile → Musician profile (edit or public view)
  if (currentPath.startsWith('/profile')) {
    // Check if it's /profile/:username/:trackSlug
    const parts = currentPath.split('/').filter(Boolean); // [profile, username, trackSlug?]
    if (parts.length >= 3) {
      return <TrackPage />;
    }
    return <MusicianProfilePage />;
  }

  // /track → Direct track link (alias for /profile/:user/:track)
  if (currentPath.startsWith('/track')) {
    return <TrackPage />;
  }

  // / → Artist Discovery homepage (public, no extra providers needed)
  if (currentPath === '/library') {
    return <FujiStudio />;
  }

  return <ArtistDiscoveryPage />;
};

/**
 * App Root: Wraps the entire app in AuthProvider + PlayerProvider so that
 * useAuth() and usePlayer() are available in EVERY route without crashing.
 * ResourceProvider is only loaded for /dashboard (it fetches guild data).
 */
export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PlayerProvider>
          <AppInternal />
          <GlobalPlayer />
        </PlayerProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
