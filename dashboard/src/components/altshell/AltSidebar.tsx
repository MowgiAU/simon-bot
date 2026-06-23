/**
 * Shared left sidebar for the "Alt" desktop redesign (preview).
 * Used on every Alt page — edit here and it applies everywhere.
 * Collapsible — state persisted in localStorage.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../PlayerProvider';
import { useAltBreakpoint } from './useAltBreakpoint';
import {
    Home, Search, User, Newspaper, BarChart3, Swords, Plus, Library, AudioLines,
    Users, Star, HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

// Alt desktop palette (exported for reuse by Alt pages)
export const BG = '#0f131d', S_LOWEST = '#0a0e18', S_CONT = '#1c1f2a', S_HIGH = '#262a35', S_HIGHEST = '#313540', S_VAR = '#313540';
export const PRIMARY = '#F2780A', SECONDARY = '#4cd7f6', TERTIARY = '#ff6779';
export const TEXT = '#dfe2f1', SUB = '#9aa3b2', BORDER = 'rgba(255,255,255,0.06)';
export const FONT = 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const arr = (d: any): any[] => Array.isArray(d) ? d : (d?.tracks || d?.profiles || d?.battles || d?.entries || d?.playlists || d?.data || []);

const NAV = [
    { icon: Home, label: 'Home', to: '/preview/alt_f' },
    { icon: Search, label: 'Search', to: '/preview/alt_f_library' },
    { icon: User, label: 'Artists', to: '/preview/alt_f_artists' },
    { icon: Newspaper, label: 'News', to: '/preview/alt_f_articles' },
    { icon: BarChart3, label: 'Charts', to: '/preview/alt_f_charts' },
    { icon: Swords, label: 'Battles', to: '/preview/alt_f_battles' },
];

const LS_KEY = 'fuji_left_sidebar_collapsed';

export const AltSidebar: React.FC<{ active?: string }> = ({ active }) => {
    const { player } = usePlayer();
    const [playlists, setPlaylists] = useState<any[]>([]);
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
  [style*="280px 1fr"],[style*="300px 1fr"]{grid-template-columns:1fr!important}
}
/* ③ Mobile < 550px: 3/2-col → 1-col, tighten padding */
@media (max-width:549px){
  [style*="repeat(3, 1fr)"],[style*="repeat(2, 1fr)"]{grid-template-columns:1fr!important}
  [style*="280px 1fr"],[style*="300px 1fr"]{padding-left:16px!important;padding-right:16px!important}
}
/* ④ Track-table rows — min-width forces overflowX:auto parent to scroll
   rather than cropping columns when viewport is narrow */
@media (max-width:1099px){
  [style*="36px 44px 1fr 130px"]{min-width:640px}
  [style*="40px 44px 1fr 88px"]{min-width:700px}
  [style*="44px 44px 1fr 110px"]{min-width:680px}
  [style*="40px 44px 1fr 120px"]{min-width:600px}
  [style*="36px 44px 1fr 48px"]{min-width:560px}
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
        axios.get('/api/playlists/popular').then(r => setPlaylists(arr(r.data).slice(0, 6))).catch(() => {});
    }, []);

    // xs always icon-rail to prevent overflow
    const w = (collapsed || bp === 'xs') ? 64 : 256;

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
                        return collapsed ? (
                            <Link key={label} to={to} title={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 0', borderRadius: 8, textDecoration: 'none', color: on ? PRIMARY : SUB, background: on ? S_CONT : 'transparent' }}>
                                <Icon size={20} />
                            </Link>
                        ) : (
                            <Link key={label} to={to} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14, color: on ? TEXT : SUB, background: on ? S_CONT : 'transparent' }}>
                                <Icon size={20} /> {label}
                            </Link>
                        );
                    })}
                </div>

                {!collapsed && (
                    <>
                        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Your Library</span>
                            <Plus size={18} color={SUB} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Link to="/preview/alt_f_library" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: SUB, fontSize: 14 }}><Library size={20} color={SECONDARY} /> All Tracks</Link>
                            <Link to="/preview/alt_f_library" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: SUB, fontSize: 14 }}><AudioLines size={20} color={PRIMARY} /> Samples</Link>
                            <Link to="/preview/alt_f_artists" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: SUB, fontSize: 14 }}><Users size={20} color={TERTIARY} /> Collabs</Link>
                        </div>
                        {playlists.length > 0 && (
                            <div style={{ marginTop: 24, padding: '0 8px' }}>
                                <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, display: 'block', marginBottom: 8 }}>Playlists</span>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {playlists.map((pl: any) => (
                                        <li key={pl.id}><Link to={`/preview/alt_f_playlist?id=${pl.id}`} style={{ display: 'block', padding: '4px 8px', color: SUB, fontSize: 14, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name || pl.title}</Link></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                {/* Collapsed library icons */}
                {collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 }}>
                        {[{ Icon: Library, color: SECONDARY, to: '/preview/alt_f_library' }, { Icon: AudioLines, color: PRIMARY, to: '/preview/alt_f_library' }, { Icon: Users, color: TERTIARY, to: '/preview/alt_f_artists' }].map(({ Icon, color, to }, i) => (
                            <Link key={i} to={to} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', borderRadius: 8, textDecoration: 'none', color: SUB }}>
                                <Icon size={18} color={color} />
                            </Link>
                        ))}
                    </div>
                )}
            </nav>

            {/* Footer */}
            {!collapsed ? (
                <div style={{ padding: '16px 12px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: S_CONT, cursor: 'pointer' }}><Star size={18} color={PRIMARY} /><span style={{ fontSize: 13, fontWeight: 600 }}>Go Premium</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', color: SUB }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><HelpCircle size={18} /> Support</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>Logout <LogOut size={18} /></span>
                    </div>
                </div>
            ) : (
                <div style={{ padding: '16px 8px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, background: S_CONT, cursor: 'pointer' }}><Star size={18} color={PRIMARY} /></div>
                    <div style={{ color: SUB, cursor: 'pointer' }}><LogOut size={18} /></div>
                </div>
            )}
        </aside>
    );
};
