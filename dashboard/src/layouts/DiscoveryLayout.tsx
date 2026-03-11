import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors } from '../theme/theme';
import { Search, Music, Zap, User, LogIn, Menu, Home, Mic2, Library } from 'lucide-react';
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
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user, permissions, mutualAdminGuilds } = useAuth();
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
        { key: 'library', label: 'LIBRARY', icon: <Music size={14} color={colors.primary} />, path: '/library' },
        { key: 'live', label: 'LIVE', path: null, comingSoon: true },
    ];

    const isHomePage = pathname === '/';
    const showSidebar = sidebar && (!isHomePage || isMobile && isSidebarOpen);

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            backgroundColor: '#161925', color: '#F8FAFC', overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header */}
            <header style={{
                height: isMobile ? '110px' : '64px', backgroundColor: '#1A1E2E', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 12px' : '0 24px', zIndex: 100,
                flexShrink: 0, gap: isMobile ? '12px' : '0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '32px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                        <FujiLogo size={isMobile ? 32 : 40} color={colors.primary} />
                        <div>
                            <h1 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', letterSpacing: '0.05em' }}>FUJI STUDIO</h1>
                        </div>
                    </div>
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
                                <button onClick={() => navigate('/dashboard')} style={{ backgroundColor: `${colors.primary}15`, color: colors.primary, border: 'none', padding: '7px', borderRadius: '6px', display: 'flex' }}>
                                    <Zap size={18} fill={colors.primary} />
                                </button>
                            )}
                            {user ? (
                                <button onClick={() => navigate('/profile')} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', padding: '7px', borderRadius: '6px', display: 'flex' }}>
                                    <User size={18} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => window.location.href = '/api/auth/discord/login'}
                                    style={{ backgroundColor: colors.primary, color: 'white', border: 'none', padding: '7px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold' }}
                                >
                                    <LogIn size={16} /> LOG IN
                                </button>
                            )}
                        </div>
                    )}
                    {!isMobile && (
                        <nav style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {navItems.map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => item.path && navigate(item.path)}
                                    title={item.comingSoon ? 'Coming Soon' : undefined}
                                    style={{
                                        padding: '6px 16px', borderRadius: '4px',
                                        backgroundColor: activeTab === item.key ? `${colors.primary}33` : 'transparent',
                                        color: activeTab === item.key ? colors.primary : '#B9C3CE',
                                        border: 'none', fontSize: '10px', fontWeight: 'bold',
                                        display: 'flex', alignItems: 'center', gap: '8px', cursor: item.comingSoon ? 'not-allowed' : 'pointer',
                                        textDecoration: item.comingSoon ? 'line-through' : 'none',
                                        opacity: item.comingSoon ? 0.6 : 1
                                    }}
                                >
                                    {item.icon} {item.label}
                                </button>
                            ))}
                        </nav>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: isMobile ? '100%' : 'auto' }}>
                    {!isMobile && hasDashboardAccess ? (
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={{
                                backgroundColor: pathname.startsWith('/dashboard') ? `${colors.primary}33` : `${colors.primary}15`,
                                color: colors.primary,
                                border: `1px solid ${colors.primary}33`,
                                padding: '8px 20px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                letterSpacing: '0.05em'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = `${colors.primary}25`;
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = pathname.startsWith('/dashboard') ? `${colors.primary}33` : `${colors.primary}15`;
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            title="Admin Dashboard"
                        >
                            <Zap size={14} fill={colors.primary} />
                            DASHBOARD
                        </button>
                    ) : null}

                    {user && !isMobile ? (
                        <button
                            onClick={() => navigate('/profile')}
                            style={{
                                backgroundColor: pathname === '/profile' ? `${colors.primary}33` : 'rgba(255,255,255,0.05)',
                                color: pathname === '/profile' ? colors.primary : '#B9C3CE',
                                border: pathname === '/profile' ? `1px solid ${colors.primary}33` : '1px solid rgba(255,255,255,0.05)',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                letterSpacing: '0.05em'
                            }}
                        >
                            <User size={14} />
                            EDIT PROFILE
                        </button>
                    ) : !user && !isMobile ? (
                        <button
                            onClick={() => window.location.href = '/api/auth/discord/login'}
                            style={{
                                backgroundColor: colors.primary,
                                color: 'white',
                                border: 'none',
                                padding: '8px 20px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                letterSpacing: '0.05em'
                            }}
                        >
                            <User size={14} />
                            LOG IN
                        </button>
                    ) : null}
                    {onSearchChange && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: isMobile ? 1 : 'none' }}>
                            <Search size={16} color="#B9C3CE" style={{ position: 'absolute', left: '16px' }} />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                style={{
                                    width: isMobile ? '100%' : '300px', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '999px', padding: '8px 48px', fontSize: '12px', color: 'white', outline: 'none'
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
                <main style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    backgroundColor: '#161925', 
                    paddingBottom: isMobile ? (player.currentTrack ? '168px' : '72px') : (player.currentTrack ? '100px' : '24px'),
                    opacity: isMobile && isSidebarOpen ? 0.3 : 1,
                    filter: isMobile && isSidebarOpen ? 'blur(4px)' : 'none'
                }}>
                    {children}
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
                        { key: 'library', label: 'Library', icon: <Library size={20} />, path: '/library' },
                        { key: 'profile', label: user ? 'Profile' : 'Log In', icon: user ? <User size={20} /> : <LogIn size={20} />, path: user ? '/profile' : null, action: !user ? () => window.location.href = '/api/auth/discord/login' : undefined },
                    ].map(item => {
                        const isActive = item.path === '/' ? pathname === '/' : item.path ? pathname.startsWith(item.path) : false;
                        return (
                            <button
                                key={item.key}
                                onClick={() => item.action ? item.action() : item.path && navigate(item.path)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: isActive ? colors.primary : '#6B7280',
                                    fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em',
                                    padding: '6px 12px', minWidth: '60px'
                                }}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            )}
        </div>
    );
};