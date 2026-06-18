/**
 * Shared left sidebar for the "Alt" desktop redesign (preview).
 * Used on every Alt page — edit here and it applies everywhere.
 * Collapsible — state persisted in localStorage.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../PlayerProvider';
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
    { icon: Home, label: 'Home', to: '/' },
    { icon: Search, label: 'Search', to: '/library' },
    { icon: User, label: 'Artists', to: '/artists' },
    { icon: Newspaper, label: 'News', to: '/articles' },
    { icon: BarChart3, label: 'Charts', to: '/charts' },
    { icon: Swords, label: 'Battles', to: '/battles' },
];

const LS_KEY = 'fuji_left_sidebar_collapsed';

export const AltSidebar: React.FC<{ active?: string }> = ({ active }) => {
    const { player } = usePlayer();
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
    });

    const toggle = () => setCollapsed(c => {
        const next = !c;
        try { localStorage.setItem(LS_KEY, String(next)); } catch {}
        return next;
    });

    useEffect(() => {
        axios.get('/api/playlists/popular').then(r => setPlaylists(arr(r.data).slice(0, 6))).catch(() => {});
    }, []);

    const w = collapsed ? 64 : 256;

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
                            <img src="/fujitext.svg" alt="Fuji Studio" style={{ height: 32, width: 'auto' }} />
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
                            <Link to="/library" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: SUB, fontSize: 14 }}><Library size={20} color={SECONDARY} /> All Tracks</Link>
                            <Link to="/library" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: SUB, fontSize: 14 }}><AudioLines size={20} color={PRIMARY} /> Samples</Link>
                            <Link to="/artists" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: SUB, fontSize: 14 }}><Users size={20} color={TERTIARY} /> Collabs</Link>
                        </div>
                        {playlists.length > 0 && (
                            <div style={{ marginTop: 24, padding: '0 8px' }}>
                                <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, display: 'block', marginBottom: 8 }}>Playlists</span>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {playlists.map((pl: any) => (
                                        <li key={pl.id}><Link to={`/playlist/${pl.id}`} style={{ display: 'block', padding: '4px 8px', color: SUB, fontSize: 14, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name || pl.title}</Link></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                {/* Collapsed library icons */}
                {collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 }}>
                        {[{ Icon: Library, color: SECONDARY, to: '/library' }, { Icon: AudioLines, color: PRIMARY, to: '/library' }, { Icon: Users, color: TERTIARY, to: '/artists' }].map(({ Icon, color, to }, i) => (
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
