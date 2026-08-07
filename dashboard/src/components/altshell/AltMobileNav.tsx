/**
 * Mobile replacement for AltSidebar (xs breakpoint, <600px) — a bottom tab bar
 * for the 5 most-used destinations, plus a "More" button that opens a full-screen
 * radial pie menu with the complete primary nav. Mirrors the pattern already
 * shipped on the main site (layouts/DiscoveryLayout.tsx: mobile bottom nav + pie menu).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, BarChart3, Swords, Tag, User, Newspaper, Users, Zap, MoreHorizontal } from 'lucide-react';
import { PRIMARY, SUB, BORDER, FONT } from './AltSidebar';
import { RadialPieMenu, PieItem } from './RadialPieMenu';
import { useAuth } from '../AuthProvider';

export const MOBILE_NAV_HEIGHT = 60;

const TABS: { label: string; icon: typeof Home; to: string }[] = [
    { label: 'Home',    icon: Home,      to: '/' },
    { label: 'Search',  icon: Search,    to: '/library' },
    { label: 'Charts',  icon: BarChart3, to: '/charts' },
    { label: 'Battles', icon: Swords,    to: '/battles' },
    { label: 'Genres',  icon: Tag,       to: '/genres' },
];

// Full primary nav for the "More" pie menu — same 8 destinations as the desktop AltSidebar,
// plus "Profile" (linked dynamically to the signed-in user's own profile below).
const PIE_NAV: { key: string; label: string; icon: React.ReactNode; to: string }[] = [
    { key: 'Home',    label: 'Home',    icon: <Home size={20} />,      to: '/' },
    { key: 'Search',  label: 'Search',  icon: <Search size={20} />,    to: '/library' },
    { key: 'Artists', label: 'Artists', icon: <User size={20} />,      to: '/artists' },
    { key: 'News',    label: 'News',    icon: <Newspaper size={20} />, to: '/articles' },
    { key: 'Charts',  label: 'Charts',  icon: <BarChart3 size={20} />, to: '/charts' },
    { key: 'Battles', label: 'Battles', icon: <Swords size={20} />,    to: '/battles' },
    { key: 'Arena',   label: 'Arena',   icon: <Zap size={20} />,       to: '/arena' },
    { key: 'Genres',  label: 'Genres',  icon: <Tag size={20} />,       to: '/genres' },
    { key: 'Collabs', label: 'Collabs', icon: <Users size={20} />,     to: '/collabs' },
];

// How far you have to scroll down before the bar bothers hiding — avoids it
// flickering away from tiny rubber-band/overscroll jitter right at the top.
const HIDE_AFTER_PX = 24;
const DIRECTION_THRESHOLD_PX = 4;
const STOPPED_SCROLLING_MS = 150;

export const AltMobileNav: React.FC<{ active: string }> = ({ active }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pieOpen, setPieOpen] = useState(false);
    const [hidden, setHidden] = useState(false);

    // Real scrolling happens in nested `overflow-y: auto` page containers, not the
    // window, and scroll events don't bubble — so this listens in the capture phase
    // on document, which does see scroll events fired anywhere in the tree, and
    // tracks each scrolling element's last position separately.
    useEffect(() => {
        const lastY = new WeakMap<EventTarget, number>();
        let stopTimer: ReturnType<typeof setTimeout> | null = null;

        const onScroll = (e: Event) => {
            const el = e.target as HTMLElement | Document;
            const y = el instanceof Document
                ? (el.scrollingElement?.scrollTop ?? 0)
                : el.scrollTop;
            const prev = lastY.get(e.target as EventTarget) ?? y;
            const delta = y - prev;
            lastY.set(e.target as EventTarget, y);

            if (delta > DIRECTION_THRESHOLD_PX && y > HIDE_AFTER_PX) {
                setHidden(true);
            } else if (delta < -DIRECTION_THRESHOLD_PX || y <= HIDE_AFTER_PX) {
                setHidden(false);
            }

            if (stopTimer) clearTimeout(stopTimer);
            stopTimer = setTimeout(() => setHidden(false), STOPPED_SCROLLING_MS);
        };

        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => {
            document.removeEventListener('scroll', onScroll, true);
            if (stopTimer) clearTimeout(stopTimer);
        };
    }, []);

    const pieItems: PieItem[] = PIE_NAV.map(n => ({
        key: n.key, label: n.label, icon: n.icon, active: active === n.key,
        onClick: () => navigate(n.to),
    }));
    if (user) {
        pieItems.push({
            key: 'Profile', label: 'Profile', icon: <User size={20} />, active: active === 'Profile',
            onClick: () => navigate(`/profile/${user.profileUsername || user.username}`),
        });
    }

    return (
        <>
            <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: MOBILE_NAV_HEIGHT, background: 'rgba(10,14,24,0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)', fontFamily: FONT, transform: hidden ? 'translateY(100%)' : 'translateY(0)', transition: 'transform 0.25s ease' }}>
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
