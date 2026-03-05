import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors } from '../theme/theme';
import { Search, Music, Zap, User } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';

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
        { key: 'discover', label: 'DISCOVER', icon: <Search size={14} />, path: '/' },
        { key: 'library', label: 'LIBRARY', path: null, comingSoon: true },
        { key: 'live', label: 'LIVE', path: null, comingSoon: true },
    ];

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            backgroundColor: '#161925', color: '#F8FAFC', overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header */}
            <header style={{
                height: '64px', backgroundColor: '#1A1E2E', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 100,
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                        <div style={{
                            width: '36px', height: '36px', backgroundColor: colors.primary,
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Music color="white" size={24} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', letterSpacing: '0.05em' }}>FUJI STUDIO</h1>
                        </div>
                    </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {hasDashboardAccess ? (
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

                    {user ? (
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
                            {isMobile ? '' : 'EDIT PROFILE'}
                        </button>
                    ) : (
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
                    )}
                    {onSearchChange && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} color="#B9C3CE" style={{ position: 'absolute', left: '16px' }} />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                style={{
                                    width: isMobile ? '160px' : '300px', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '999px', padding: '8px 48px', fontSize: '12px', color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Optional Sidebar */}
                {sidebar && !isMobile && (
                    <aside style={{ width: '256px', backgroundColor: '#1A1E2E', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '24px', overflowY: 'auto', flexShrink: 0 }}>
                        {sidebar}
                    </aside>
                )}

                {/* Main Content */}
                <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#161925', paddingBottom: player.currentTrack ? '100px' : '24px' }}>
                    {children}
                </main>
            </div>
        </div>
    );
};
