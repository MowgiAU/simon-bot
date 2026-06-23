import React, { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { WebsiteSidebar, WebSection } from '../layouts/WebsiteSidebar';
import { colors } from '../theme/theme';
import { ShieldAlert } from 'lucide-react';
import logoUrl from '../assets/logo.svg';

// Reuse the same lazy-loaded page components as AdminDashboard
const PlatformAnalytics       = lazy(() => import('./PlatformAnalytics').then(m => ({ default: m.PlatformAnalytics })));
const FeaturedContentSettings = lazy(() => import('./FeaturedContentSettings').then(m => ({ default: m.FeaturedContentSettings })));
const ArticlesPage            = lazy(() => import('./Articles').then(m => ({ default: m.ArticlesPage })));
const ArticleReviewPage       = lazy(() => import('./ArticleReview').then(m => ({ default: m.ArticleReviewPage })));
const GenresPage              = lazy(() => import('./GenresPage').then(m => ({ default: m.GenresPage })));
const BeatBattlePage          = lazy(() => import('./BeatBattle').then(m => ({ default: m.BeatBattlePage })));
const HeadToHeadAdminPage     = lazy(() => import('./HeadToHead').then(m => ({ default: m.HeadToHeadAdminPage })));
const AccountManagementPage   = lazy(() => import('./AccountManagement').then(m => ({ default: m.AccountManagementPage })));
const MusicianProfileAdmin    = lazy(() => import('./MusicianProfileAdmin').then(m => ({ default: m.MusicianProfileAdmin })));

const PageSpinner: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: colors.textTertiary, fontSize: '13px' }}>
    Loading...
  </div>
);

const WelcomeScreen: React.FC<{ login: () => void }> = ({ login }) => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: colors.background, backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(242, 120, 10, 0.06) 0%, transparent 50%)' }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)', padding: '48px', borderRadius: '20px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', textAlign: 'center', maxWidth: '420px', width: '90%', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '88px', height: '88px', background: 'rgba(242,120,10,0.08)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', border: '1px solid rgba(242,120,10,0.15)' }}>
          <img src={logoUrl} alt="Fuji Studio Logo" style={{ width: '56px', height: '56px', filter: 'brightness(0) invert(1)' }} />
        </div>
        <h1 style={{ color: colors.textPrimary, marginBottom: '10px', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>Fuji Studio</h1>
        <p style={{ color: colors.textSecondary, marginBottom: '36px', fontSize: '15px', lineHeight: 1.5, padding: '0 16px' }}>Website Admin Dashboard</p>
        <button
          onClick={() => navigate('/login')}
          style={{ background: 'linear-gradient(135deg, #F2780A, #C96208)', color: 'white', border: 'none', padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

export const WebsiteAdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<WebSection>('platform-analytics');
  const { user, loading, login, logout, role, impersonating } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: colors.background, color: colors.textSecondary }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <WelcomeScreen login={login} />;
  }

  // Only admin/mod roles can access the website dashboard
  const isAdmin = role === 'admin' || role === 'moderator';
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: colors.background }}>
        <div style={{ textAlign: 'center', padding: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', maxWidth: '480px' }}>
          <ShieldAlert size={48} color={colors.textTertiary} style={{ marginBottom: '16px' }} />
          <h2 style={{ color: colors.textPrimary, marginBottom: '8px' }}>Access Denied</h2>
          <p style={{ color: colors.textSecondary, marginBottom: '24px' }}>You don't have permission to access the website admin dashboard.</p>
          <button onClick={() => window.location.href = '/'} style={{ background: colors.primary, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            Go to Community Site
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'platform-analytics':
        return <PlatformAnalytics />;
      case 'featured-content':
        return <FeaturedContentSettings />;
      case 'articles':
        return <ArticlesPage />;
      case 'article-review':
        return <ArticleReviewPage />;
      case 'genres-admin':
        return <GenresPage />;
      case 'beat-battle':
        return <BeatBattlePage />;
      case 'head-to-head':
        return <HeadToHeadAdminPage />;
      case 'account-management':
        return <AccountManagementPage />;
      case 'musician-profiles-admin':
        return <MusicianProfileAdmin />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <WebsiteSidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        user={user}
        logout={logout}
      />
      <main className="main-content" style={{ transition: 'margin-left 0.3s ease', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 24px', background: 'rgba(15,20,32,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: '52px', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: colors.textSecondary }}>
            {user.profileDisplayName || user.username}
          </span>
          <a href="/account" title="Account Settings" style={{ display: 'flex', width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
            <img
              src={user.profileAvatar || (user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              alt="Account"
            />
          </a>
        </div>

        <div className="main-content-scroll-container">
          <div style={{ padding: '0 16px 24px' }}>
            <Suspense fallback={<PageSpinner />}>
              {renderContent()}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};
