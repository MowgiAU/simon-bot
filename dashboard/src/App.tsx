import React, { useState, useEffect, Suspense, lazy } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { ResourceProvider } from "./components/ResourceProvider";
import { PlayerProvider } from "./components/PlayerProvider";
import { GlobalPlayer } from "./components/GlobalPlayer";
import { ToastContainer } from "./components/Toast";
import { Sidebar } from "./layouts/Sidebar";
import { colors } from "./theme/theme";
import { Info, ArrowRight } from "lucide-react";
import { AppStyles } from "./AppStyles";
import { ErrorBoundary } from "./components/ErrorBoundary";
import logoUrl from "./assets/logo.svg";

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each import becomes its own JS chunk — users only download what they navigate to.
const Dashboard              = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const WordFilterSettings     = lazy(() => import("./pages/WordFilterSettings").then(m => ({ default: m.WordFilterSettings })));
const ModerationSettingsPage = lazy(() => import("./pages/ModerationSettings").then(m => ({ default: m.ModerationSettingsPage })));
const EconomyPluginPage      = lazy(() => import("./pages/EconomyPlugin").then(m => ({ default: m.EconomyPluginPage })));
const FeedbackPluginPage     = lazy(() => import("./pages/FeedbackPlugin").then(m => ({ default: m.FeedbackPluginPage })));
const WelcomeGatePluginPage  = lazy(() => import("./pages/WelcomeGate").then(m => ({ default: m.WelcomeGatePluginPage })));
const BotIdentityPage        = lazy(() => import("./pages/BotIdentity").then(m => ({ default: m.BotIdentityPage })));
const EmailClientPage        = lazy(() => import("./pages/EmailClient").then(m => ({ default: m.EmailClientPage })));
const TicketSystemPage       = lazy(() => import("./pages/TicketSystem").then(m => ({ default: m.TicketSystemPage })));
const ChannelRules           = lazy(() => import("./pages/ChannelRules").then(m => ({ default: m.ChannelRules })));
const MusicianProfileAdmin   = lazy(() => import("./pages/MusicianProfileAdmin").then(m => ({ default: m.MusicianProfileAdmin })));
const MusicianProfilePage    = lazy(() => import("./pages/MusicianProfile").then(m => ({ default: m.MusicianProfilePage })));
const ProfileEditPage        = lazy(() => import("./pages/ProfileEditPage").then(m => ({ default: m.ProfileEditPage })));
const MyTracksPage           = lazy(() => import("./pages/MyTracksPage").then(m => ({ default: m.MyTracksPage })));
const ProfileSetupWizard     = lazy(() => import("./pages/ProfileSetupWizard").then(m => ({ default: m.ProfileSetupWizard })));
const TrackPage              = lazy(() => import("./pages/TrackPage").then(m => ({ default: m.TrackPage })));
const DocumentationPage      = lazy(() => import("./pages/Documentation").then(m => ({ default: m.DocumentationPage })));
const Logs                   = lazy(() => import("./pages/Logs"));
const StagingTest            = lazy(() => import("./pages/StagingTest").then(m => ({ default: m.StagingTest })));
const PluginManagementPage   = lazy(() => import("./pages/PluginManagement").then(m => ({ default: m.PluginManagementPage })));
const ArtistDiscoveryPage    = lazy(() => import("./pages/ArtistDiscovery").then(m => ({ default: m.ArtistDiscoveryPage })));
const ArtistDiscoveryV2Page  = lazy(() => import("./pages/ArtistDiscoveryV2").then(m => ({ default: m.ArtistDiscoveryV2Page })));
const ArtistsPage            = lazy(() => import("./pages/ArtistsPage").then(m => ({ default: m.ArtistsPage })));
const GenresPage             = lazy(() => import("./pages/GenresPage").then(m => ({ default: m.GenresPage })));
const TermsPage              = lazy(() => import("./pages/TermsPage").then(m => ({ default: m.TermsPage })));
const CategoryResultsPage    = lazy(() => import("./pages/CategoryResultsPage").then(m => ({ default: m.CategoryResultsPage })));
const FujiStudio             = lazy(() => import("./pages/FujiStudio").then(m => ({ default: m.FujiStudio })));
const LibrarySettings        = lazy(() => import("./pages/LibrarySettings").then(m => ({ default: m.LibrarySettings })));
const BeatBattlePage         = lazy(() => import("./pages/BeatBattle").then(m => ({ default: m.BeatBattlePage })));
const BattleArchivePage      = lazy(() => import("./pages/BattleArchive").then(m => ({ default: m.BattleArchivePage })));
const BattlesPage            = lazy(() => import("./pages/BattlesPage").then(m => ({ default: m.BattlesPage })));
const BattleEntryPage        = lazy(() => import("./pages/BattleEntryPage").then(m => ({ default: m.BattleEntryPage })));
const BattleDetailPage       = lazy(() => import("./pages/BattleDetailPage").then(m => ({ default: m.BattleDetailPage })));
const ProjectCleanupGuide    = lazy(() => import("./pages/ProjectCleanupGuide").then(m => ({ default: m.ProjectCleanupGuide })));
const PlaylistPage           = lazy(() => import("./pages/PlaylistPage").then(m => ({ default: m.PlaylistPage })));
const MyPlaylistsPage        = lazy(() => import("./pages/MyPlaylistsPage").then(m => ({ default: m.MyPlaylistsPage })));
const MyFavouritesPage       = lazy(() => import("./pages/MyFavouritesPage").then(m => ({ default: m.MyFavouritesPage })));
const FeedPage               = lazy(() => import("./pages/FeedPage").then(m => ({ default: m.FeedPage })));
const ChartsPage             = lazy(() => import("./pages/ChartsPage").then(m => ({ default: m.ChartsPage })));
const AccountSettingsPage    = lazy(() => import("./pages/AccountSettingsPage").then(m => ({ default: m.AccountSettingsPage })));
const SetupPasswordModal     = lazy(() => import("./components/SetupPasswordModal").then(m => ({ default: m.SetupPasswordModal })));
const UniversalSearch        = lazy(() => import("./components/UniversalSearch").then(m => ({ default: m.UniversalSearch })));
const NotificationMenu       = lazy(() => import("./components/NotificationMenu").then(m => ({ default: m.NotificationMenu })));
const InternalChat           = lazy(() => import("./components/InternalChat").then(m => ({ default: m.InternalChat })));
// ErrorBoundary is imported statically above — NOT lazy. It is the outermost

// Minimal inline spinner used while a lazy chunk loads
const PageSpinner: React.FC = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: colors.textTertiary, fontSize: '13px' }}>
        Loading...
    </div>
);

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

  const renderContent = () => (
    <Suspense fallback={<PageSpinner />}>
    {(() => {
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
    })()}
    </Suspense>
  );

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
             <Suspense fallback={null}>
               <UniversalSearch 
                  guildId={selectedGuild.id} 
                  onNavigate={handleNavigate} 
                  accessiblePlugins={permissions.accessiblePlugins} 
               />
             </Suspense>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <Suspense fallback={null}>
                <NotificationMenu guildId={selectedGuild.id} />
              </Suspense>
              
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
      <Suspense fallback={null}>
        <InternalChat guildId={selectedGuild.id} />
      </Suspense>
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
    return <Suspense fallback={<PageSpinner />}><ProfileEditPage /></Suspense>;
  }

  // /profile/setup → First-time setup wizard
  if (currentPath === '/profile/setup') {
    return <Suspense fallback={<PageSpinner />}><ProfileSetupWizard /></Suspense>;
  }

  // /my-tracks → Track management page
  if (currentPath === '/my-tracks') {
    return <Suspense fallback={<PageSpinner />}><MyTracksPage /></Suspense>;
  }

  // /profile → Musician profile (hub or public view)
  if (currentPath.startsWith('/profile')) {
    // Check if it's /profile/:username/:trackSlug
    const parts = currentPath.split('/').filter(Boolean); // [profile, username, trackSlug?]
    if (parts.length >= 3) {
      return <Suspense fallback={<PageSpinner />}><TrackPage /></Suspense>;
    }
    return <Suspense fallback={<PageSpinner />}><MusicianProfilePage /></Suspense>;
  }

  // /track → Direct track link (alias for /profile/:user/:track)
  if (currentPath.startsWith('/track')) {
    return <Suspense fallback={<PageSpinner />}><TrackPage /></Suspense>;
  }

  // Artist Discovery homepage (V2 is now default)
  if (currentPath === '/' || currentPath === '/v2') {
    return <Suspense fallback={<PageSpinner />}><ArtistDiscoveryV2Page /></Suspense>;
  }

  // /artists → Full artists list
  if (currentPath === '/artists') {
    return <Suspense fallback={<PageSpinner />}><ArtistsPage /></Suspense>;
  }

  // /library → Browse all tracks
  if (currentPath === '/library') {
    return <Suspense fallback={<PageSpinner />}><FujiStudio /></Suspense>;
  }

  // /genres → All Genres page
  if (currentPath === '/genres') {
    return <Suspense fallback={<PageSpinner />}><GenresPage /></Suspense>;
  }

  // /genres/:parentSlug → Sub-genres page
  if (currentPath.startsWith('/genres/')) {
    const parentSlug = currentPath.split('/genres/')[1];
    return <Suspense fallback={<PageSpinner />}><GenresPage parentSlug={parentSlug} /></Suspense>;
  }
  
  // /category/:slug → Filtered tracks page
  if (currentPath.startsWith('/category/')) {
    const slug = currentPath.split('/category/')[1];
    return <Suspense fallback={<PageSpinner />}><CategoryResultsPage slug={slug} /></Suspense>;
  }

  // /terms → Terms of Service & Privacy Policy
  if (currentPath === '/terms') {
    return <Suspense fallback={<PageSpinner />}><TermsPage /></Suspense>;
  }

  // /account → Account settings (password, email verification)
  if (currentPath === '/account') {
    return <Suspense fallback={<PageSpinner />}><AccountSettingsPage /></Suspense>;
  }

  // /verify-email → Redirect from email verification link
  if (currentPath === '/verify-email') {
    return <Suspense fallback={<PageSpinner />}><AccountSettingsPage /></Suspense>;
  }

  // /guides/project-cleanup → FL Studio project cleanup guide
  if (currentPath === '/guides/project-cleanup') {
    return <Suspense fallback={<PageSpinner />}><ProjectCleanupGuide /></Suspense>;
  }

  // /playlist/:id → View a playlist
  if (currentPath.startsWith('/playlist/')) {
    return <Suspense fallback={<PageSpinner />}><PlaylistPage /></Suspense>;
  }

  // /my-favourites → User's favourited tracks
  if (currentPath === '/my-favourites') {
    return <Suspense fallback={<PageSpinner />}><MyFavouritesPage /></Suspense>;
  }

  // /feed → Subscription feed from followed artists
  if (currentPath === '/feed') {
    return <Suspense fallback={<PageSpinner />}><FeedPage /></Suspense>;
  }

  // /my-playlists → User's playlists
  if (currentPath === '/my-playlists') {
    return <Suspense fallback={<PageSpinner />}><MyPlaylistsPage /></Suspense>;
  }

  // /charts → Music charts page
  if (currentPath === '/charts') {
    return <Suspense fallback={<PageSpinner />}><ChartsPage /></Suspense>;
  }

  // /battles/entry/:entryId → Battle entry track page
  if (currentPath.startsWith('/battles/entry/')) {
    return <Suspense fallback={<PageSpinner />}><BattleEntryPage /></Suspense>;
  }

  // /battles/:battleId → Individual battle detail page
  if (currentPath.startsWith('/battles/') && !currentPath.startsWith('/battles/entry/')) {
    return <Suspense fallback={<PageSpinner />}><BattleDetailPage /></Suspense>;
  }

  // /battles → Public Beat Battles page
  if (currentPath === '/battles') {
    return <Suspense fallback={<PageSpinner />}><BattlesPage /></Suspense>;
  }

  return <Suspense fallback={<PageSpinner />}><ArtistDiscoveryV2Page /></Suspense>;
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
          {/* Suspense required: SetupPasswordModal is lazy but has no Suspense boundary */}
          <Suspense fallback={null}><SetupPasswordModal /></Suspense>
        </PlayerProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
