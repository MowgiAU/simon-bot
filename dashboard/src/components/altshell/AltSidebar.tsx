/**
 * Shared left sidebar for the "Alt" desktop redesign (preview).
 * Used on every Alt page — edit here and it applies everywhere.
 * Self-contained: own palette, fetches popular playlists, pads for the
 * global player when a track is playing. CSP-safe (inline styles + lucide).
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../PlayerProvider';
import { Home, Search, User, Newspaper, BarChart3, Swords, Plus, Library, AudioLines, Users, Star, HelpCircle, LogOut } from 'lucide-react';

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

export const AltSidebar: React.FC<{ active?: string }> = ({ active }) => {
    const { player } = usePlayer();
    const [playlists, setPlaylists] = useState<any[]>([]);
    useEffect(() => {
        axios.get('/api/playlists/popular').then(r => setPlaylists(arr(r.data).slice(0, 6))).catch(() => {});
    }, []);

    return (
        <aside style={{ width: 256, background: S_LOWEST, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, fontFamily: FONT, color: TEXT, paddingBottom: player.currentTrack ? 90 : 0 }}>
            <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/fujistudioiconalt.png" alt="Fuji Studio" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: PRIMARY, letterSpacing: '-0.01em' }}>Fuji Studio</h1>
                    <p style={{ margin: 0, fontSize: 10, color: SUB }}>Pro Account</p>
                </div>
            </div>
            <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                    {NAV.map(({ icon: Icon, label, to }) => {
                        const on = active === label;
                        return (
                            <Link key={label} to={to} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14, color: on ? TEXT : SUB, background: on ? S_CONT : 'transparent' }}>
                                <Icon size={20} /> {label}
                            </Link>
                        );
                    })}
                </div>
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
            </nav>
            <div style={{ padding: '16px 12px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: S_CONT }}><Star size={18} color={PRIMARY} /><span style={{ fontSize: 13, fontWeight: 600 }}>Go Premium</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', color: SUB }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><HelpCircle size={18} /> Support</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>Logout <LogOut size={18} /></span>
                </div>
            </div>
        </aside>
    );
};
