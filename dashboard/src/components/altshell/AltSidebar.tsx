/**
 * Shared left sidebar for the "Alt" desktop redesign (preview).
 * Used on every Alt page — edit here and it applies everywhere.
 * Collapsible — state persisted in localStorage.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../PlayerProvider';
import { useAuth } from '../AuthProvider';
import { useAltBreakpoint } from './useAltBreakpoint';
import { AltMobileNav } from './AltMobileNav';
import {
    Home, Search, User, Newspaper, BarChart3, Swords, Tag, Users, Zap,
    HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

// Alt desktop palette (exported for reuse by Alt pages)
export const BG = '#0f131d', S_LOWEST = '#0a0e18', S_CONT = '#1c1f2a', S_HIGH = '#262a35', S_HIGHEST = '#313540', S_VAR = '#313540';
export const PRIMARY = '#F2780A', SECONDARY = '#4cd7f6', TERTIARY = '#ff6779';
export const TEXT = '#dfe2f1', SUB = '#9aa3b2', BORDER = 'rgba(255,255,255,0.06)';
export const FONT = 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
// Shared content container width for every Alt F page (outer container; ~1215px inner after 32px padding).
export const CONTENT_MAX = 1280;
export const arr = (d: any): any[] => Array.isArray(d) ? d : (d?.tracks || d?.profiles || d?.battles || d?.entries || d?.playlists || d?.data || []);

const NAV = [
    { icon: Home,      label: 'Home',    to: '/' },
    { icon: Search,    label: 'Search',  to: '/library' },
    { icon: User,      label: 'Artists', to: '/artists' },
    { icon: Newspaper, label: 'News',    to: '/articles' },
    { icon: BarChart3, label: 'Charts',  to: '/charts' },
    { icon: Swords,    label: 'Battles', to: '/battles' },
    { icon: Zap,       label: 'Arena',   to: '/arena' },
    // Genres + Collabs stay on /preview until their live routes are migrated (later stage).
    { icon: Tag,       label: 'Genres',  to: '/genres' },
    { icon: Users,     label: 'Collabs', to: '/preview/alt_f_collabs' },
];

const LS_KEY = 'fuji_left_sidebar_collapsed';

export const AltSidebar: React.FC<{ active?: string }> = ({ active }) => {
    const { player } = usePlayer();
    const { user, logout } = useAuth();
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [collabStats, setCollabStats] = useState<{ activeProjects: number; pendingRequests: number } | null>(null);
    const bp = useAltBreakpoint();

    const [collapsed, setCollapsed] = useState(() => {
        const narrow = typeof window !== 'undefined' && window.innerWidth < 1100;
        if (narrow) return true;
        try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
    });

    // Auto-collapse on resize to narrow; restore localStorage preference on widen to lg.
    useEffect(() => {
        if (bp !== 'lg') {
            setCollapsed(true);
        } else {
            try { setCollapsed(localStorage.getItem(LS_KEY) === 'true'); } catch {}
        }
    }, [bp]);

    // Inject responsive grid overrides once — attribute selectors target inline styles
    // so no className changes are needed on individual pages.
    useEffect(() => {
        if (document.getElementById('altf-responsive')) return;
        const s = document.createElement('style');
        s.id = 'altf-responsive';
        s.textContent = `
/* ━━ Alt F Responsive Grid (injected by AltSidebar) ━━ */
/* ① Tablet < 1100px: card grids reduce columns */
@media (max-width:1099px){
  [style*="repeat(4, minmax(0, 1fr))"]{grid-template-columns:repeat(2, minmax(0, 1fr))!important}
  [style*="repeat(4, 1fr)"]{grid-template-columns:repeat(2, 1fr)!important}
  [style*="repeat(3, 1fr)"]{grid-template-columns:repeat(2, 1fr)!important}
}
/* ② Small tablet < 900px: body left-sidebar stacks above content */
@media (max-width:899px){
  [style*="280px 1fr"],[style*="300px 1fr"],[style*="260px 1fr"]{grid-template-columns:1fr!important}
}
/* ③ Mobile < 550px: 3/2-col → 1-col, tighten padding */
@media (max-width:549px){
  [style*="repeat(3, 1fr)"],[style*="repeat(2, 1fr)"]{grid-template-columns:1fr!important}
  [style*="280px 1fr"],[style*="300px 1fr"],[style*="260px 1fr"]{padding-left:16px!important;padding-right:16px!important}
}
/* ④ Track-table rows — min-width forces overflowX:auto parent to scroll
   rather than cropping columns when viewport is narrow */
@media (max-width:1099px){
  [style*="36px 44px 1fr 130px"]{min-width:640px}
  [style*="40px 44px 1fr 88px"]{min-width:700px}
  [style*="44px 44px 1fr 110px"]{min-width:680px}
  [style*="40px 44px 1fr 120px"]{min-width:600px}
  [style*="36px 44px 1fr 48px"]{min-width:560px}
}
/* ⑤ Mobile < 600px: the 24-32px page-container gutters used across Alt F pages
   waste ~15-17% of a phone's width. Tighten every observed container-padding
   signature down to a uniform 16px edge margin (matches the ② stack rule above). */
@media (max-width:599px){
  /* Note: the browser normalises a leading "0" to "0px" in the serialised style
     attribute, so these selectors match "0px ..." not the JSX source's "0 ...". */
  [style*="padding: 0px 32px"],[style*="padding: 0px 32px 20px"],[style*="padding: 0px 32px 32px"],
  [style*="padding: 0px 32px 36px"],[style*="padding: 0px 32px 40px"],[style*="padding: 0px 32px 60px"],
  [style*="padding: 0px 32px 64px"],[style*="padding: 10px 32px"],[style*="padding: 11px 32px"],
  [style*="padding: 24px 32px"],[style*="padding: 24px 32px 40px"],[style*="padding: 24px 32px 48px"],
  [style*="padding: 28px 32px"],[style*="padding: 28px 32px 60px"],[style*="padding: 32px 32px 28px"],
  [style*="padding: 40px 32px 36px"],[style*="padding: 40px 32px 60px"],[style*="padding: 48px 32px 64px"],
  [style*="padding: 0px 24px 20px"],[style*="padding: 10px 24px"],[style*="padding: 12px 24px"],
  [style*="padding: 14px 24px"],[style*="padding: 20px 24px"],[style*="padding: 20px 24px 24px"],
  [style*="padding: 24px 24px 64px"],[style*="padding: 40px 24px"],[style*="padding: 48px 24px"],
  [style*="padding: 60px 24px"],[style*="padding: 7px 24px"],[style*="padding: 8px 24px"],
  [style*="padding: 9px 24px"]
  {padding-left:16px!important;padding-right:16px!important}

  /* Uniform padding on centered loading/empty-state blocks ("Loading…", "No X
     found") — safe to tighten since they're just centered text, not shaped UI. */
  [style*="padding: 40px;"],[style*="padding: 60px;"],[style*="padding: 80px;"]
  {padding-left:16px!important;padding-right:16px!important}

  /* Every Alt F page's scrollable content wrapper uses this exact convention
     (verified identical across home/track/charts/battle). It reserves bottom
     clearance for a desktop-docked player only — on mobile it also needs to
     clear the fixed bottom nav (60px) and the content FAB floating above it,
     or the last item in the list sits underneath them. */
  [style*="flex: 1 1 0%; overflow-y: auto; padding-bottom: 0px"]{padding-bottom:150px!important}
  [style*="flex: 1 1 0%; overflow-y: auto; padding-bottom: 90px"]{padding-bottom:230px!important}
}`;
        document.head.appendChild(s);
    }, []);

    const toggle = () => setCollapsed(c => {
        const next = !c;
        // Only persist to localStorage at desktop widths
        if (bp === 'lg') { try { localStorage.setItem(LS_KEY, String(next)); } catch {} }
        return next;
    });

    useEffect(() => {
        if (!user) { setPlaylists([]); return; }
        axios.get('/api/my-playlists').then(r => setPlaylists(arr(r.data).slice(0, 6))).catch(() => {});
    }, [user]);

    // Fetch collab stats when logged in
    useEffect(() => {
        if (!user) { setCollabStats(null); return; }
        axios.get('/api/collab/stats', { withCredentials: true })
            .then(r => setCollabStats(r.data))
            .catch(() => {});
    }, [user]);

    // Mobile (xs, <600px): the icon-rail is too cramped — hand off to the bottom nav instead.
    if (bp === 'xs') {
        return <AltMobileNav active={active || ''} />;
    }

    const w = collapsed ? 64 : 256;

    // Badge counts per nav label
    const collabBadge = collabStats
        ? { projects: collabStats.activeProjects, requests: collabStats.pendingRequests }
        : null;

    return (
        <aside style={{ width: w, minWidth: w, background: S_LOWEST, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, fontFamily: FONT, color: TEXT, paddingBottom: player.currentTrack ? 90 : 0, transition: 'width 0.25s ease, min-width 0.25s ease', overflow: 'hidden' }}>

            {/* Logo / header row */}
            <div style={{ padding: collapsed ? '20px 0' : '20px 16px 20px 20px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10, flexShrink: 0, minHeight: 72 }}>
                {collapsed ? (
                    <button onClick={toggle} title="Expand sidebar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/fujistudioiconalt.png" alt="Fuji Studio" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    </button>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <img src="/fujistudioiconalt.png" alt="Fuji Studio" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
                            <img src="/fujitext.svg" alt="Fuji Studio" style={{ height: 22, width: 'auto' }} />
                        </div>
                        <button onClick={toggle} title="Collapse sidebar" style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.7 }}>
                            <PanelLeftClose size={17} />
                        </button>
                    </>
                )}
            </div>

            {/* Expand button strip — only shown when collapsed */}
            {collapsed && (
                <button onClick={toggle} title="Expand sidebar" style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: '6px 0', display: 'flex', justifyContent: 'center', flexShrink: 0, opacity: 0.6 }}>
                    <PanelLeftOpen size={16} />
                </button>
            )}

            {/* Nav */}
            <nav style={{ flex: 1, padding: collapsed ? '0 8px' : '0 12px', overflowY: 'auto', overflowX: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: collapsed ? 0 : 24 }}>
                    {NAV.map(({ icon: Icon, label, to }) => {
                        const on = active === label;
                        const isCollabs = label === 'Collabs';

                        if (collapsed) {
                            return (
                                <Link key={label} to={to} title={label} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 0', borderRadius: 8, textDecoration: 'none', color: on ? PRIMARY : SUB, background: on ? S_CONT : 'transparent' }}>
                                    <Icon size={20} />
                                    {/* Collapsed dot — pending requests take priority, else active projects */}
                                    {isCollabs && collabBadge && collabBadge.requests > 0 && (
                                        <span style={{ position: 'absolute', top: 7, right: 10, width: 7, height: 7, borderRadius: '50%', background: PRIMARY, boxShadow: `0 0 0 2px ${S_LOWEST}` }} />
                                    )}
                                    {isCollabs && collabBadge && collabBadge.requests === 0 && collabBadge.projects > 0 && (
                                        <span style={{ position: 'absolute', top: 7, right: 10, width: 7, height: 7, borderRadius: '50%', background: SECONDARY, boxShadow: `0 0 0 2px ${S_LOWEST}` }} />
                                    )}
                                </Link>
                            );
                        }

                        return (
                            <Link key={label} to={to} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14, color: on ? TEXT : SUB, background: on ? S_CONT : 'transparent' }}>
                                <Icon size={20} />
                                <span style={{ flex: 1 }}>{label}</span>
                                {/* Expanded badges for Collabs */}
                                {isCollabs && collabBadge && (collabBadge.requests > 0 || collabBadge.projects > 0) && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {collabBadge.projects > 0 && (
                                            <span title={`${collabBadge.projects} active project${collabBadge.projects !== 1 ? 's' : ''}`} style={{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 16, borderRadius: 99, background: `${SECONDARY}30`, color: SECONDARY, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                                                {collabBadge.projects}
                                            </span>
                                        )}
                                        {collabBadge.requests > 0 && (
                                            <span title={`${collabBadge.requests} pending request${collabBadge.requests !== 1 ? 's' : ''}`} style={{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 16, borderRadius: 99, background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                                                {collabBadge.requests}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                {!collapsed && user && playlists.length > 0 && (
                    <div style={{ padding: '0 8px' }}>
                        <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, display: 'block', marginBottom: 8 }}>Your Playlists</span>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {playlists.map((pl: any) => (
                                <li key={pl.id}><Link to={`/playlist/${pl.id}`} style={{ display: 'block', padding: '4px 8px', color: SUB, fontSize: 14, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name || pl.title}</Link></li>
                            ))}
                        </ul>
                    </div>
                )}
            </nav>

            {/* Footer */}
            {!collapsed ? (
                <div style={{ padding: '16px 12px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', color: SUB }}>
                        <Link to="/contact" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: SUB, textDecoration: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = SUB)}>
                            <HelpCircle size={18} /> Support
                        </Link>
                        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: SUB, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: FONT }}
                            onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = SUB)}>
                            Logout <LogOut size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ padding: '16px 8px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    <Link to="/contact" title="Support" style={{ color: SUB, display: 'flex' }}><HelpCircle size={18} /></Link>
                    <button onClick={logout} title="Logout" style={{ color: SUB, cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}><LogOut size={18} /></button>
                </div>
            )}
        </aside>
    );
};
