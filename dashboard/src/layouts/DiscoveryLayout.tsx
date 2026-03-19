import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { colors } from '../theme/theme';
import { Search, Music, Zap, User, LogIn, LogOut, Menu, Home, Mic2, ChevronDown, ExternalLink, Edit3, Upload, Swords, Heart, ListMusic, X, Rss, BarChart3 } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { FujiLogo } from '../components/FujiLogo';
import { MusicNotificationMenu } from '../components/MusicNotificationMenu';

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
    const [isPieMenuOpen, setIsPieMenuOpen] = useState(false);
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
        { key: 'artists', label: 'ARTISTS', icon: <User size={14} />, path: '/artists' },
        { key: 'genres', label: 'GENRES', icon: <Zap size={14} />, path: '/genres' },
        { key: 'charts', label: 'CHARTS', icon: <BarChart3 size={14} />, path: '/charts' },
        { key: 'battles', label: 'BATTLES', icon: <Swords size={14} />, path: '/battles' },
        { key: 'feed', label: 'FEED', icon: <Rss size={14} />, path: '/feed' },
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
                backgroundColor: '#1A1E2E', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', flexDirection: 'column', zIndex: 100, flexShrink: 0,
            }}>
                {/* Main row */}
                <div style={{
                    height: '56px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: isMobile ? '0 12px' : '0 24px', gap: '12px',
                    position: 'relative',
                }}>
                    {/* Left: logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {isMobile && (
                            <button
                                onClick={() => setIsPieMenuOpen(true)}
                                aria-label="Open navigation"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: '6px', borderRadius: '8px', flexShrink: 0 }}
                            >
                                <Menu size={22} />
                            </button>
                        )}
                        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
                            <FujiLogo size={isMobile ? 28 : 36} color={colors.primary} />
                            {!isMobile && (
                                <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>FUJI STUDIO</h1>
                            )}
                        </Link>
                    </div>
                    {/* Center: nav (desktop only, absolutely centered) */}
                    {!isMobile && (
                        <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', zIndex: 1 }}>
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
                    {/* Right-side actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', flexShrink: 0 }}>
                    {/* Mobile: compact icon buttons */}
                    {isMobile && sidebar && (
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            style={{
                                backgroundColor: isSidebarOpen ? `${colors.primary}33` : 'rgba(255,255,255,0.07)',
                                color: isSidebarOpen ? colors.primary : 'white',
                                border: 'none', padding: '7px 10px', borderRadius: '7px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 'bold',
                            }}
                        >
                            <Menu size={15} /> {isSidebarOpen ? 'CLOSE' : 'FILTERS'}
                        </button>
                    )}
                    {isMobile && hasDashboardAccess && (
                        <Link to="/dashboard" title="Dashboard" style={{ backgroundColor: `${colors.primary}15`, color: colors.primary, padding: '7px', borderRadius: '7px', display: 'flex', textDecoration: 'none' }}>
                            <Zap size={16} fill={colors.primary} />
                        </Link>
                    )}
                    {isMobile && user && (
                        <Link to="/profile" style={{ backgroundColor: pathname.startsWith('/profile') ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 'bold', textDecoration: 'none' }}>
                            <User size={14} /> ME
                        </Link>
                    )}
                    {isMobile && !user && (
                        <a href="/api/auth/discord/login" style={{ backgroundColor: colors.primary, color: 'white', padding: '7px 12px', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 'bold', textDecoration: 'none' }}>
                            Sign Up
                        </a>
                    )}

                    {/* Desktop: full buttons + inline search */}
                    {!isMobile && hasDashboardAccess && (
                        <Link to="/dashboard" title="Admin Dashboard" style={{ backgroundColor: pathname.startsWith('/dashboard') ? `${colors.primary}33` : `${colors.primary}15`, color: colors.primary, border: `1px solid ${colors.primary}33`, padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                            <Zap size={16} fill={colors.primary} />
                        </Link>
                    )}
                    {!isMobile && user && (
                        <>
                        <MusicNotificationMenu />
                        <div style={{ position: 'relative' }} onMouseEnter={openAccountMenu} onMouseLeave={closeAccountMenu}>
                            <Link to="/profile/edit" style={{ backgroundColor: pathname.startsWith('/profile') ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '7px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em', textDecoration: 'none' }}>
                                <User size={14} /> ACCOUNT <ChevronDown size={12} />
                            </Link>
                            {accountMenuOpen && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px', minWidth: '160px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '2px' }}
                                    onMouseEnter={openAccountMenu} onMouseLeave={closeAccountMenu}>
                                    {[user.username].map(uname => (
                                        <React.Fragment key="menu">
                                            <Link to={`/profile/${uname}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}><ExternalLink size={13} /> View Profile</Link>
                                            <Link to="/profile/edit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}><Edit3 size={13} /> Edit Profile</Link>
                                            <Link to="/my-tracks" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}><Upload size={13} /> Upload Tracks</Link>
                                            <Link to="/feed" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}><Rss size={13} /> Feed</Link>
                                            <Link to="/my-favourites" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}><Heart size={13} /> Favourites</Link>
                                            <Link to="/my-playlists" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#B9C3CE', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B9C3CE'; }}><ListMusic size={13} /> Playlists</Link>
                                            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
                                            <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', color: '#F87171', fontSize: '11px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}><LogOut size={13} /> Log Out</button>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                        </>
                    )}
                    {!isMobile && !user && (
                        <>
                            <a href="/api/auth/discord/login" style={{ backgroundColor: colors.primary, color: 'white', padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', boxShadow: `0 0 14px ${colors.primary}55`, letterSpacing: '0.01em' }}>
                                Sign Up
                            </a>
                            <a href="/api/auth/discord/login" style={{ color: '#B9C3CE', padding: '7px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)' }}>
                                <LogIn size={13} /> Log In
                            </a>
                        </>
                    )}
                    {!isMobile && onSearchChange && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={15} color="#B9C3CE" style={{ position: 'absolute', left: '14px' }} />
                            <input type="text" placeholder={searchPlaceholder} value={search} onChange={(e) => onSearchChange(e.target.value)} aria-label="Search"
                                style={{ width: '280px', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '999px', padding: '7px 14px 7px 40px', fontSize: '12px', color: 'white', outline: 'none' }} />
                        </div>
                    )}
                    </div>
                    {/* end right-side actions */}
                </div>
                {/* end main row */}



                {/* Mobile search row */}
                {isMobile && onSearchChange && (
                    <div style={{ padding: '0 12px 10px', display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <Search size={15} color="#B9C3CE" style={{ position: 'absolute', left: '26px' }} />
                        <input type="text" placeholder={searchPlaceholder} value={search} onChange={(e) => onSearchChange(e.target.value)} aria-label="Search"
                            style={{ width: '100%', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '999px', padding: '8px 14px 8px 38px', fontSize: '13px', color: 'white', outline: 'none' }} />
                    </div>
                )}
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
                        { key: 'charts', label: 'Charts', icon: <BarChart3 size={20} />, path: '/charts' },
                        { key: 'feed', label: 'Feed', icon: <Rss size={20} />, path: '/feed' },
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

            {/* Pie Navigation Menu (mobile) */}
            {isPieMenuOpen && (
                <div
                    onClick={() => setIsPieMenuOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 500,
                        backgroundColor: 'rgba(10,13,22,0.92)',
                        backdropFilter: 'blur(14px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <div style={{ position: 'relative', width: '280px', height: '280px' }} onClick={e => e.stopPropagation()}>
                        {/* Center close button */}
                        <button
                            onClick={() => setIsPieMenuOpen(false)}
                            style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '56px', height: '56px', borderRadius: '50%',
                                backgroundColor: '#1A1E2E', border: `2px solid ${colors.primary}55`,
                                color: 'white', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 1,
                            }}
                        >
                            <X size={22} />
                        </button>

                        {/* Nav items at radial positions */}
                        {([
                            { key: 'discover',  label: 'HOME',      icon: <Home size={22} />,       path: '/',             angle: 180 },
                            { key: 'artists',   label: 'ARTISTS',   icon: <User size={22} />,       path: '/artists',      angle: 240 },
                            { key: 'genres',    label: 'GENRES',    icon: <Zap size={22} />,        path: '/genres',       angle: 300 },
                            { key: 'charts',    label: 'CHARTS',    icon: <BarChart3 size={22} />,  path: '/charts',       angle: 0   },
                            { key: 'battles',   label: 'BATTLES',   icon: <Swords size={22} />,     path: '/battles',      angle: 60  },
                            { key: 'feed',      label: 'FEED',      icon: <Rss size={22} />,        path: '/feed',         angle: 120 },
                        ] as { key: string; label: string; icon: React.ReactNode; path: string; angle: number }[]).map(item => {
                            const rad = item.angle * (Math.PI / 180);
                            const r = 110;
                            const x = Math.cos(rad) * r;
                            const y = Math.sin(rad) * r;
                            const isActive = activeTab === item.key;
                            return (
                                <Link
                                    key={item.key}
                                    to={item.path}
                                    onClick={() => setIsPieMenuOpen(false)}
                                    style={{
                                        position: 'absolute', top: '50%', left: '50%',
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                        textDecoration: 'none',
                                    }}
                                >
                                    <div style={{
                                        width: '54px', height: '54px', borderRadius: '50%',
                                        backgroundColor: isActive ? colors.primary : 'rgba(255,255,255,0.07)',
                                        border: `2px solid ${isActive ? colors.primary : 'rgba(255,255,255,0.12)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: isActive ? 'white' : '#B9C3CE',
                                        boxShadow: isActive ? `0 0 20px ${colors.primary}66` : 'none',
                                    }}>
                                        {item.icon}
                                    </div>
                                    <span style={{
                                        fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                                        color: isActive ? colors.primary : '#B9C3CE',
                                        textTransform: 'uppercase',
                                    }}>
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};