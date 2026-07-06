/**
 * Mobile replacement for AltSidebar (xs breakpoint, <600px) — a bottom tab bar
 * for the 5 most-used destinations, plus a "More" button that opens a full-screen
 * radial pie menu with the complete primary nav. Mirrors the pattern already
 * shipped on the main site (layouts/DiscoveryLayout.tsx: mobile bottom nav + pie menu).
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, BarChart3, Swords, Tag, User, Newspaper, Users, MoreHorizontal } from 'lucide-react';
import { PRIMARY, SUB, BORDER, FONT } from './AltSidebar';
import { RadialPieMenu, PieItem } from './RadialPieMenu';

export const MOBILE_NAV_HEIGHT = 60;

const TABS: { label: string; icon: typeof Home; to: string }[] = [
    { label: 'Home',    icon: Home,      to: '/preview/alt_f' },
    { label: 'Search',  icon: Search,    to: '/preview/alt_f_library' },
    { label: 'Charts',  icon: BarChart3, to: '/preview/alt_f_charts' },
    { label: 'Battles', icon: Swords,    to: '/preview/alt_f_battles' },
    { label: 'Genres',  icon: Tag,       to: '/preview/alt_f_genres' },
];

// Full primary nav for the "More" pie menu — same 8 destinations as the desktop AltSidebar.
const PIE_NAV: { key: string; label: string; icon: React.ReactNode; to: string }[] = [
    { key: 'Home',    label: 'Home',    icon: <Home size={20} />,      to: '/preview/alt_f' },
    { key: 'Search',  label: 'Search',  icon: <Search size={20} />,    to: '/preview/alt_f_library' },
    { key: 'Artists', label: 'Artists', icon: <User size={20} />,      to: '/preview/alt_f_artists' },
    { key: 'News',    label: 'News',    icon: <Newspaper size={20} />, to: '/preview/alt_f_articles' },
    { key: 'Charts',  label: 'Charts',  icon: <BarChart3 size={20} />, to: '/preview/alt_f_charts' },
    { key: 'Battles', label: 'Battles', icon: <Swords size={20} />,    to: '/preview/alt_f_battles' },
    { key: 'Genres',  label: 'Genres',  icon: <Tag size={20} />,       to: '/preview/alt_f_genres' },
    { key: 'Collabs', label: 'Collabs', icon: <Users size={20} />,     to: '/preview/alt_f_collabs' },
];

export const AltMobileNav: React.FC<{ active: string }> = ({ active }) => {
    const navigate = useNavigate();
    const [pieOpen, setPieOpen] = useState(false);

    const pieItems: PieItem[] = PIE_NAV.map(n => ({
        key: n.key, label: n.label, icon: n.icon, active: active === n.key,
        onClick: () => navigate(n.to),
    }));

    return (
        <>
            <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: MOBILE_NAV_HEIGHT, background: 'rgba(10,14,24,0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)', fontFamily: FONT }}>
                {TABS.map(({ label, icon: Icon, to }) => {
                    const on = active === label;
                    return (
                        <Link key={label} to={to} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', color: on ? PRIMARY : SUB, minWidth: 44 }}>
                            <Icon size={20} fill={on ? PRIMARY : 'none'} />
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.02em' }}>{label}</span>
                        </Link>
                    );
                })}
                <button onClick={() => setPieOpen(true)} aria-label="More navigation" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: SUB, minWidth: 44 }}>
                    <MoreHorizontal size={20} />
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.02em' }}>More</span>
                </button>
            </nav>

            <RadialPieMenu open={pieOpen} onClose={() => setPieOpen(false)} items={pieItems} />
        </>
    );
};
