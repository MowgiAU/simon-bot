import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { ResourceProvider } from "./components/ResourceProvider";
import { PlayerProvider } from "./components/PlayerProvider";
import { GlobalPlayer } from "./components/GlobalPlayer";
import { ToastContainer } from "./components/Toast";
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
import { ProfileEditPage } from "./pages/ProfileEditPage";
import { MyTracksPage } from "./pages/MyTracksPage";
import { ProfileSetupWizard } from "./pages/ProfileSetupWizard";
import { TrackPage } from "./pages/TrackPage";
import { DocumentationPage } from "./pages/Documentation";
import Logs from "./pages/Logs";
import { StagingTest } from "./pages/StagingTest";
import { PluginManagementPage } from "./pages/PluginManagement";
import { ArtistDiscoveryPage } from "./pages/ArtistDiscovery";
import { ArtistDiscoveryV2Page } from "./pages/ArtistDiscoveryV2";
import { ArtistsPage } from "./pages/ArtistsPage";
import { GenresPage } from "./pages/GenresPage";
import { TermsPage } from "./pages/TermsPage";
import { CategoryResultsPage } from "./pages/CategoryResultsPage";
import { FujiStudio } from "./pages/FujiStudio";
import { LibrarySettings } from "./pages/LibrarySettings";import { BeatBattlePage } from './pages/BeatBattle';
import { BattleArchivePage } from './pages/BattleArchive';import { BattlesPage } from './pages/BattlesPage';import { BattleEntryPage } from './pages/BattleEntryPage';import { BattleDetailPage } from './pages/BattleDetailPage';import { ProjectCleanupGuide } from './pages/ProjectCleanupGuide';import { PlaylistPage } from './pages/PlaylistPage';import { MyPlaylistsPage } from './pages/MyPlaylistsPage';import { MyFavouritesPage } from './pages/MyFavouritesPage';import { FeedPage } from './pages/FeedPage';import { ChartsPage } from './pages/ChartsPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { SetupPasswordModal } from './components/SetupPasswordModal';
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
  | "genres-list"
  | "docs"
  | "logs"
  | "staging-test"
  | "plugins"
  | "beat-battle"
  | "battle-archive";

const WelcomeScreen: React.FC<{ login: () => void }> = ({ login }) => (
  <div style={{ 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    height: "100vh", 
    background: colors.background,
    backgroundImage: "radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.06) 0%, transparent 50%)" 
  }}>
    <div style={{ 
      background: "rgba(255, 255, 255, 0.03)",
      backdropFilter: "blur(16px)",
      padding: "48px", 
      borderRadius: "20px", 
      boxShadow: "0 12px 40px rgba(0,0,0,0.5)", 
      textAlign: "center",
      maxWidth: "420px",
      width: "90%",
      border: "1px solid rgba(255, 255, 255, 0.06)",
    }}>
      <div style={{ 
        width: "88px", 
        height: "88px", 
        background: "rgba(16, 185, 129, 0.08)", 
        borderRadius: "20px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        margin: "0 auto 28px",
        border: "1px solid rgba(16, 185, 129, 0.15)"
      }}>
        <img src={logoUrl} alt="Fuji Studio Logo" style={{ width: "56px", height: "56px", filter: "brightness(0) invert(1)" }} />
      </div>
      
      <h1 style={{ 
        color: colors.textPrimary, 
        marginBottom: "10px", 
        fontSize: "28px", 
        fontWeight: 700,
        letterSpacing: "-0.02em"
      }}>
        Fuji Studio
      </h1>
      
      <p style={{ 
        color: colors.textSecondary, 
        marginBottom: "36px",
        fontSize: "15px",
        lineHeight: 1.5,
        padding: "0 16px"
      }}>
        Advanced community management for FL Studio producers
      </p>

      <button 
        onClick={login} 
        style={{ 
          background: "linear-gradient(135deg, #10B981, #059669)", 
          color: "white", 
          border: "none", 
          padding: "14px 28px", 
          fontSize: "15px", 
          fontWeight: 600, 
          borderRadius: "12px", 
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          width: "100%",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)"
        }}
        onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 0 30px rgba(16, 185, 129, 0.3)";
        }}
        onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.2)";
        }}
      >
        Login with Discord
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
        <div style={{ maxWidth: "500px", margin: "100px auto", padding: "40px", borderRadius: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
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
        return <LibrarySettings />;
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
      case "beat-battle":
        return <BeatBattlePage />;
      case "battle-archive":
        return <BattleArchivePage onBack={() => handleNavigate('beat-battle')} />;
      case "genres-list":
        return <GenresPage />;
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
          padding: window.innerWidth > 768 ? "10px 24px" : "8px 12px", 
          background: "rgba(15, 20, 32, 0.8)", 
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          position: "relative",
          zIndex: 100,
          margin: "0",
          borderRadius: 0,
          gap: "8px",
          minHeight: "52px"
        }}>
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
            style={{ 
              display: "flex", 
              background: "rgba(255,255,255,0.04)", 
              border: "1px solid rgba(255,255,255,0.06)", 
              color: "#F8FAFC", 
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
              
              <a
                href="/account"
                title="Account Settings"
                style={{ display: 'flex', width: window.innerWidth > 768 ? "36px" : "28px", height: window.innerWidth > 768 ? "36px" : "28px", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, textDecoration: 'none' }}
              >
                <img src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Account Settings" />
              </a>
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
                padding: "10px 20px",
                color: colors.textSecondary,
                fontSize: "13px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "12px",
                margin: "16px"
            }}>
                <div style={{ 
                    width: "30px", 
                    height: "30px", 
                    borderRadius: "8px", 
                    background: "rgba(16, 185, 129, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.primary
                }}>
                    <Info size={16} />
                </div>
                <div>
                    <span style={{ fontWeight: 600, color: "#F8FAFC", marginRight: "8px" }}>
                        {activeSection === "dashboard" ? "Fuji Studio" : activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace(/-/g, " ")} :
                    </span>
                    Manage your community, configuration, and automation tools.
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

  useEffect(() => {
    const titles: { test: (p: string) => boolean; title: string }[] = [
      { test: p => p.startsWith('/dashboard'), title: 'Fuji Studio | Dashboard' },
      { test: p => p === '/profile/edit',      title: 'Fuji Studio | Edit Profile' },
      { test: p => p === '/profile/setup',     title: 'Fuji Studio | Profile Setup' },
      { test: p => p === '/my-tracks',         title: 'Fuji Studio | My Tracks' },
      { test: p => p === '/artists',           title: 'Fuji Studio | Artists' },
      { test: p => p === '/library',           title: 'Fuji Studio | Library' },
      { test: p => p === '/genres',            title: 'Fuji Studio | Genres' },
      { test: p => p.startsWith('/genres/'),   title: 'Fuji Studio | Genre' },
      { test: p => p.startsWith('/category/'), title: 'Fuji Studio | Category' },
      { test: p => p === '/terms',             title: 'Fuji Studio | Terms & Privacy' },
      { test: p => p.startsWith('/battles/entry/'), title: 'Fuji Studio | Beat Battle Entry' },
      { test: p => p.startsWith('/playlist/'), title: 'Fuji Studio | Playlist' },
      { test: p => p === '/my-favourites', title: 'Fuji Studio | My Favourites' },
      { test: p => p === '/my-playlists', title: 'Fuji Studio | My Playlists' },
      { test: p => p === '/feed', title: 'Fuji Studio | Feed' },
      { test: p => p === '/',                  title: 'Fuji Studio | Discover Music' },
    ];
    const match = titles.find(t => t.test(currentPath));
    // Only set a default title if the page component won't set its own dynamic title
    // (profile/:username and track pages set their own via document.title in effects)
    const isDynamic = currentPath.startsWith('/profile/') && currentPath !== '/profile/edit' && currentPath !== '/profile/setup';
    if (match && !isDynamic) {
      document.title = match.title;
    } else if (!match && !isDynamic) {
      document.title = 'Fuji Studio';
    }
  }, [currentPath]);

  // /dashboard → Full admin dashboard
  if (currentPath.startsWith('/dashboard')) {
    return (
      <ResourceProvider>
        <AdminDashboard />
      </ResourceProvider>
    );
  }

  // /profile/edit → Profile editing page
  if (currentPath === '/profile/edit') {
    return <ProfileEditPage />;
  }

  // /profile/setup → First-time setup wizard
  if (currentPath === '/profile/setup') {
    return <ProfileSetupWizard />;
  }

  // /my-tracks → Track management page
  if (currentPath === '/my-tracks') {
    return <MyTracksPage />;
  }

  // /profile → Musician profile (hub or public view)
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

  // Artist Discovery homepage (V2 is now default)
  if (currentPath === '/' || currentPath === '/v2') {
    return <ArtistDiscoveryV2Page />;
  }

  // /artists → Full artists list
  if (currentPath === '/artists') {
    return <ArtistsPage />;
  }

  // /library → Browse all tracks
  if (currentPath === '/library') {
    return <FujiStudio />;
  }

  // /genres → All Genres page
  if (currentPath === '/genres') {
    return <GenresPage />;
  }

  // /genres/:parentSlug → Sub-genres page
  if (currentPath.startsWith('/genres/')) {
    const parentSlug = currentPath.split('/genres/')[1];
    return <GenresPage parentSlug={parentSlug} />;
  }
  
  // /category/:slug → Filtered tracks page
  if (currentPath.startsWith('/category/')) {
    const slug = currentPath.split('/category/')[1];
    return <CategoryResultsPage slug={slug} />;
  }

  // /terms → Terms of Service & Privacy Policy
  if (currentPath === '/terms') {
    return <TermsPage />;
  }

  // /account → Account settings (password, email verification)
  if (currentPath === '/account') {
    return <AccountSettingsPage />;
  }

  // /verify-email → Redirect from email verification link
  if (currentPath === '/verify-email') {
    return <AccountSettingsPage />;
  }

  // /guides/project-cleanup → FL Studio project cleanup guide
  if (currentPath === '/guides/project-cleanup') {
    return <ProjectCleanupGuide />;
  }

  // /playlist/:id → View a playlist
  if (currentPath.startsWith('/playlist/')) {
    return <PlaylistPage />;
  }

  // /my-favourites → User's favourited tracks
  if (currentPath === '/my-favourites') {
    return <MyFavouritesPage />;
  }

  // /feed → Subscription feed from followed artists
  if (currentPath === '/feed') {
    return <FeedPage />;
  }

  // /my-playlists → User's playlists
  if (currentPath === '/my-playlists') {
    return <MyPlaylistsPage />;
  }

  // /charts → Music charts page
  if (currentPath === '/charts') {
    return <ChartsPage />;
  }

  // /battles/entry/:entryId → Battle entry track page
  if (currentPath.startsWith('/battles/entry/')) {
    return <BattleEntryPage />;
  }

  // /battles/:battleId → Individual battle detail page
  if (currentPath.startsWith('/battles/') && !currentPath.startsWith('/battles/entry/')) {
    return <BattleDetailPage />;
  }

  // /battles → Public Beat Battles page
  if (currentPath === '/battles') {
    return <BattlesPage />;
  }

  return <ArtistDiscoveryV2Page />;
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
          <ToastContainer />
          <SetupPasswordModal />
        </PlayerProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
