import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { colors } from '../theme/theme';
import { Search, Music, Zap, User, LogIn, LogOut, Menu, Home, Mic2, ChevronDown, ExternalLink, Edit3, Upload, Swords } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { FujiLogo } from '../components/FujiLogo';

interface DiscoveryLayoutProps {
    children: ReactNode;
    /** Optional sidebar content. If omitted, no sidebar is rendered. */
    sidebar?: ReactNode;
    /** Search value (controlled externally) */
    search?: string;
    /** Search change handler (controlled externally) */
    onSearchChange?: (value: string) => void;
    /** Placeholder for search input */
    searchPlaceholder?: string;
    /** Active nav tab: 'discover' | 'profile' | 'library' | 'live' */
    activeTab?: string;
}

export const DiscoveryLayout: React.FC<DiscoveryLayoutProps> = ({ 
    children, 
    sidebar, 
    search = '', 
    onSearchChange, 
    searchPlaceholder = 'Search artists, genres, equipment...',
    activeTab = 'discover'
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const accountMenuTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const openAccountMenu = () => {
        if (accountMenuTimeout.current) clearTimeout(accountMenuTimeout.current);
        setAccountMenuOpen(true);
    };
    const closeAccountMenu = () => {
        accountMenuTimeout.current = setTimeout(() => setAccountMenuOpen(false), 150);
    };
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user, permissions, mutualAdminGuilds, logout } = useAuth();
    const { player } = usePlayer();

    // Check if user has access to ANY guild's dashboard
    const hasDashboardAccess = permissions.canManagePlugins || mutualAdminGuilds.length > 0;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const navItems = [
        { key: 'discover', label: 'HOME', icon: <Search size={14} />, path: '/' },
        { key: 'artists', label: 'ARTISTS', icon: <User size={14} />, path: '/artists' },
        { key: 'genres', label: 'GENRES', icon: <Zap size={14} />, path: '/genres' },
        { key: 'battles', label: 'BATTLES', icon: <Swords size={14} />, path: '/battles' },
    ];

    const isHomePage = pathname === '/';
    const showSidebar = sidebar && (!isHomePage || isMobile && isSidebarOpen);

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            backgroundColor: '#161925', color: '#F8FAFC', overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* A11Y-07: Skip to main content */}
            <a
                href="#main-content"
                style={{
                    position: 'absolute', top: '-48px', left: '16px', zIndex: 9999,
                    backgroundColor: '#3BA886', color: 'white', padding: '8px 16px',
                    borderRadius: '4px', fontWeight: 600, textDecoration: 'none',
                    transition: 'top 0.15s',
                }}
                onFocus={(e) => { e.currentTarget.style.top = '16px'; }}
                onBlur={(e) => { e.currentTarget.style.top = '-48px'; }}
            >
                Skip to main content
            </a>
            {/* Header */}
            <header style={{
                height: isMobile ? '110px' : '64px', backgroundColor: '#1A1E2E', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 12px' : '0 24px', zIndex: 100,
                flexShrink: 0, gap: isMobile ? '12px' : '0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '32px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                        <FujiLogo size={isMobile ? 32 : 40} color={colors.primary} />
                        <div>
                            <h1 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', letterSpacing: '0.05em' }}>FUJI STUDIO</h1>
                        </div>
                    </Link>
                    {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {sidebar && (
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    style={{
                                        backgroundColor: isSidebarOpen ? `${colors.primary}33` : 'rgba(255,255,255,0.05)',
                                        color: isSidebarOpen ? colors.primary : 'white',
                                        border: 'none', padding: '8px 12px', borderRadius: '8px',
                                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold'
                                    }}
                                >
                                    <Menu size={16} /> {isSidebarOpen ? 'CLOSE' : 'FILTERS'}
                                </button>
                            )}
                            {hasDashboardAccess && (
                                <Link to="/dashboard" style={{ backgroundColor: `${colors.primary}15`, color: colors.primary, padding: '7px', borderRadius: '6px', display: 'flex', textDecoration: 'none' }}>
                                    <Zap size={18} fill={colors.primary} />
                                </Link>
                            )}
                            {user ? (
                                <Link to="/profile" style={{ backgroundColor: pathname === '/profile' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 'bold', textDecoration: 'none' }}>
                                    <User size={15} /> PROFILE
                                </Link>
                            ) : (
                                <a
                                    href="/api/auth/discord/login"
                                    style={{ backgroundColor: colors.primary, color: 'white', padding: '7px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none' }}
                                >
                                    <LogIn size={16} /> LOG IN
                                </a>
                            )}
                        </div>
                    )}
                    {!isMobile && (
                        <nav style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {navItems.map(item => {
                                const navStyle: React.CSSProperties = {
                                    padding: '6px 16px', borderRadius: '4px',
                                    backgroundColor: activeTab === item.key ? `${colors.primary}33` : 'transparent',
                                    color: activeTab === item.key ? colors.primary : '#B9C3CE',
                                    fontSize: '10px', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    opacity: item.comingSoon ? 0.6 : 1,
                                };
                                if (item.comingSoon || !item.path) {
                                    return <span key={item.key} title="Coming Soon" style={{ ...navStyle, textDecoration: 'line-through', cursor: 'not-allowed' }}>{item.icon} {item.label}</span>;
                                }
                                return (
                                    <Link key={item.key} to={item.path} style={{ ...navStyle, textDecoration: 'none', cursor: 'pointer' }}>{item.icon} {item.label}</Link>
                                );
                            })}
                        </nav>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: isMobile ? '100%' : 'auto' }}>
                    {!isMobile && hasDashboardAccess ? (
                        <Link
                            to="/dashboard"
                            style={{
                                backgroundColor: pathname.startsWith('/dashboard') ? `${colors.primary}33` : `${colors.primary}15`,
                                color: colors.primary,
                                border: `1px solid ${colors.primary}33`,
                                padding: '8px 20px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                letterSpacing: '0.05em',
                                textDecoration: 'none',
                            }}
                            title="Admin Dashboard"
                        >
                            <Zap size={14} fill={colors.primary} />
                            DASHBOARD
                        </Link>
                    ) : null}

                    {!isMobile && user ? (
                        <div
                            style={{ position: 'relative' }}
                            onMouseEnter={openAccountMenu}
                            onMouseLeave={closeAccountMenu}
                        >
                            <Link
                                to="/profile/edit"
                                style={{
                                    backgroundColor: pathname.startsWith('/profile') ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s',
                                    letterSpacing: '0.05em',
                                    textDecoration: 'none',
                                }}
                            >
                                <User size={14} />
                                ACCOUNT
                                <ChevronDown size={12} />
                            </Link>
                            {accountMenuOpen && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                    backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', padding: '6px', minWidth: '160px', zIndex: 1000,
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                                    display: 'flex', flexDirection: 'column', gap: '2px'
                                }}
                                    onMouseEnter={openAccountMenu}
                                    onMouseLeave={closeAccountMenu}
                                >
                                    {[user.username].map(uname => (
                                        <React.Fragment key="menu">
                                            <Link to={`/profile/${uname}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}
                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}>
                                                <ExternalLink size={13} /> View Profile
                                            </Link>
                                            <Link to="/profile/edit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}
                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}>
                                                <Edit3 size={13} /> Edit Profile
                                            </Link>
                                            <Link to="/my-tracks" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}
                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}>
                                                <Upload size={13} /> Upload Tracks
                                            </Link>
                                            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
                                            <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#F87171', fontSize: '11px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                                <LogOut size={13} /> Log Out
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}
                    {!user && !isMobile ? (
                        <a
                            href="/api/auth/discord/login"
                            style={{
                                backgroundColor: colors.primary,
                                color: 'white',
                                padding: '8px 20px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                letterSpacing: '0.05em',
                                textDecoration: 'none',
                            }}
                        >
                            <LogIn size={14} />
                            LOG IN
                        </a>
                    ) : null}
                    {onSearchChange && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: isMobile ? 1 : 'none' }}>
                            <Search size={16} color="#B9C3CE" style={{ position: 'absolute', left: '16px' }} />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                aria-label="Search"
                                style={{
                                    width: isMobile ? '100%' : '300px', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '999px', padding: '8px 48px', fontSize: '12px', color: 'white'
                                }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Optional Sidebar (Desktop and Mobile Overlay) */}
                {showSidebar && (
                    <aside style={{ 
                        width: isMobile ? '100%' : '256px', 
                        backgroundColor: '#1A1E2E', 
                        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)', 
                        padding: '24px', 
                        overflowY: 'auto', 
                        flexShrink: 0,
                        display: isMobile ? (isSidebarOpen ? 'block' : 'none') : 'block',
                        position: isMobile ? 'absolute' : 'relative',
                        top: 0, left: 0, bottom: 0, zIndex: 90,
                        boxShadow: isMobile ? '0 10px 25px rgba(0,0,0,0.5)' : 'none'
                    }}>
                        {sidebar}
                        {isMobile && (
                            <button 
                                onClick={() => setIsSidebarOpen(false)}
                                style={{ 
                                    width: '100%', marginTop: '24px', padding: '12px', 
                                    backgroundColor: colors.primary, color: 'white', 
                                    border: 'none', borderRadius: '8px', fontWeight: 'bold' 
                                }}
                            >
                                APPLY FILTERS
                            </button>
                        )}
                    </aside>
                )}

                {/* Main Content */}
                <main
                    id="main-content"
                    tabIndex={-1}
                    style={{ 
                        flex: 1, 
                        overflowY: 'auto', 
                        backgroundColor: '#161925', 
                        paddingBottom: isMobile ? (player.currentTrack ? '168px' : '72px') : (player.currentTrack ? '100px' : '24px'),
                        opacity: isMobile && isSidebarOpen ? 0.3 : 1,
                        filter: isMobile && isSidebarOpen ? 'blur(4px)' : 'none'
                    }}>
                    {children}
                    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>© {new Date().getFullYear()} Fuji Studio</span>
                        <Link to="/terms" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                        >Terms &amp; Privacy</Link>
                        <a href="mailto:legal@fujistud.io" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                        >Contact</a>
                    </footer>
                </main>
            </div>

            {/* Mobile Bottom Nav */}
            {isMobile && (
                <nav style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    height: '60px', backgroundColor: '#1A1E2E',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                    zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)'
                }}>
                    {[
                        { key: 'discover', label: 'Home', icon: <Home size={20} />, path: '/' },
                        { key: 'artists', label: 'Artists', icon: <Mic2 size={20} />, path: '/artists' },
                        { key: 'genres', label: 'Discover', icon: <Zap size={20} />, path: '/genres' },
                        { key: 'profile', label: user ? 'Profile' : 'Log In', icon: user ? <User size={20} /> : <LogIn size={20} />, path: user ? '/profile' : null, action: !user ? () => window.location.href = '/api/auth/discord/login' : undefined },
                    ].map(item => {
                        const isActive = item.path === '/' ? pathname === '/' : item.path ? pathname.startsWith(item.path) : false;
                        const itemStyle: React.CSSProperties = {
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                            color: isActive ? colors.primary : '#9CA3AF',
                            fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em',
                            padding: '6px 12px', minWidth: '60px', textDecoration: 'none',
                        };
                        if (item.action) {
                            return (
                                <a key={item.key} href="/api/auth/discord/login" style={itemStyle}>
                                    {item.icon}
                                    {item.label}
                                </a>
                            );
                        }
                        return (
                            <Link key={item.key} to={item.path!} style={itemStyle}>
                                {item.icon}
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            )}
        </div>
    );
};