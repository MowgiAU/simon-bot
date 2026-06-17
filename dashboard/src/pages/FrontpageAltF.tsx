/**
 * Test Frontpage — Alt F (Stitch "enhanced desktop" / Spotify-style 3-column layout).
 * Hidden route: /preview/alt_f — not linked from any nav; access by URL only.
 *
 * Standalone full-screen layout (own sidebars + player bar; does NOT use
 * DiscoveryLayout). CSP-safe: inline styles + lucide-react, live Fuji data.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    Home, Search, User, Newspaper, BarChart3, Swords, Plus, Library, AudioLines,
    Users, Star, HelpCircle, LogOut, ChevronLeft, ChevronRight, Upload, MessageCircle,
    Bell, Play, Pause, Heart, Shuffle, SkipBack, SkipForward, Repeat, Mic, ListMusic, Volume2, Music,
} from 'lucide-react';

// Palette (from the Stitch desktop mockup)
const BG = '#0f131d', S_LOWEST = '#0a0e18', S_CONT = '#1c1f2a', S_HIGH = '#262a35', S_HIGHEST = '#313540', S_VAR = '#313540';
const PRIMARY = '#F2780A', ACCENT_TXT = '#ffb689', SECONDARY = '#4cd7f6', TERTIARY = '#ff6779';
const TEXT = '#dfe2f1', SUB = '#9aa3b2', BORDER = 'rgba(255,255,255,0.06)';
const FONT = 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

const arr = (d: any): any[] => Array.isArray(d) ? d : (d?.tracks || d?.profiles || d?.battles || d?.entries || d?.playlists || d?.data || []);
const fmt = (s: number) => { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const trackName = (t: any) => t?.profile?.displayName || t?.profile?.username || t?.artist || 'Unknown';

const navItems = [
    { icon: Home, label: 'Home', to: '/', active: true },
    { icon: Search, label: 'Search', to: '/library' },
    { icon: User, label: 'Artists', to: '/artists' },
    { icon: Newspaper, label: 'News', to: '/articles' },
    { icon: BarChart3, label: 'Charts', to: '/charts' },
    { icon: Swords, label: 'Battles', to: '/battles' },
];

export const FrontpageAltF: React.FC = () => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const [data, setData] = useState<{ hero: any; artists: any[]; drops: any[]; battles: any[]; playlists: any[]; activity: any[] } | null>(null);

    useEffect(() => {
        let on = true;
        (async () => {
            const [c, p, d, b, pl] = await Promise.all([
                axios.get('/api/charts/weekly').catch(() => ({ data: null })),
                axios.get('/api/musician/profiles?limit=12').catch(() => ({ data: [] })),
                axios.get('/api/discovery/tracks?limit=12').catch(() => ({ data: [] })),
                axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
                axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
            ]);
            if (!on) return;
            const ch = Array.isArray(c.data) ? c.data[0] : c.data;
            const hero = ch?.entries?.[0]?.track || null;
            const artists = arr(p.data).filter((x: any) => x.avatar).slice(0, 12);
            const drops = arr(d.data).filter((x: any) => x.coverUrl).slice(0, 12);
            const battles = arr(b.data).slice(0, 4);
            const playlists = arr(pl.data).slice(0, 6);
            const activity = arr(d.data).slice(0, 5);
            setData({ hero, artists, drops, battles, playlists, activity });
        })();
        return () => { on = false; };
    }, []);

    const playTrack = (t: any, queue: any[]) => {
        const mk = (x: any) => ({ id: x.id, title: x.title, artist: trackName(x), cover: x.coverUrl, url: x.url, profile: x.profile });
        setTrack(mk(t), queue.map(mk));
    };

    const cur = player.currentTrack;
    const isPlaying = player.isPlaying;
    const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

    const sectionTitle: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: TEXT, margin: 0, cursor: 'pointer' };
    const card: React.CSSProperties = { background: 'rgba(28,31,42,0.4)', padding: 16, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left sidebar */}
                <aside style={{ width: 256, background: S_LOWEST, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/logo.svg" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                        <div>
                            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: PRIMARY, letterSpacing: '-0.01em' }}>Fuji Studio</h1>
                            <p style={{ margin: 0, fontSize: 10, color: SUB }}>Preview · Alt F</p>
                        </div>
                    </div>
                    <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                            {navItems.map(({ icon: Icon, label, to, active }) => (
                                <Link key={label} to={to} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14, color: active ? TEXT : SUB, background: active ? S_CONT : 'transparent' }}>
                                    <Icon size={20} /> {label}
                                </Link>
                            ))}
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
                        {data && data.playlists.length > 0 && (
                            <div style={{ marginTop: 24, padding: '0 8px' }}>
                                <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, display: 'block', marginBottom: 8 }}>Playlists</span>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {data.playlists.map((pl: any) => (
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

                {/* Center */}
                <main style={{ flex: 1, minWidth: 0, position: 'relative', background: BG, overflowY: 'auto' }}>
                    <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: 64, background: 'linear-gradient(to bottom, rgba(15,19,29,0.9), transparent)' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT }}><ChevronLeft size={20} /></span>
                            <span style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, opacity: 0.5 }}><ChevronRight size={20} /></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <Link to="/my-tracks" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', color: BG, fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 9999, textDecoration: 'none' }}><Upload size={18} /> Upload</Link>
                            <span style={{ width: 36, height: 36, borderRadius: '50%', background: S_CONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}><MessageCircle size={20} /></span>
                            <span style={{ width: 36, height: 36, borderRadius: '50%', background: S_CONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}><Bell size={20} /></span>
                        </div>
                    </header>

                    <div style={{ padding: '0 24px 96px', marginTop: -64, paddingTop: 64 }}>
                        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40, paddingTop: 16 }}>
                            {/* Hero */}
                            {data?.hero && (
                                <section style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 360 }}>
                                    {data.hero.coverUrl && <img src={data.hero.coverUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(15,19,29,0.4) 50%, transparent), linear-gradient(to right, rgba(15,19,29,0.8), transparent 60%)` }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, padding: 32, width: '100%' }}>
                                        <span style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(28,31,42,0.8)', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>#1 This Week</span>
                                        <h2 style={{ margin: '0 0 8px', fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05 }}>{trackName(data.hero)}</h2>
                                        <p style={{ margin: '0 0 24px', fontSize: 18, color: SUB }}>Latest: {data.hero.title}</p>
                                        <button onClick={() => playTrack(data.hero, [data.hero])} style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(242,120,10,0.4)' }}><Play size={30} fill="#fff" style={{ marginLeft: 3 }} /></button>
                                    </div>
                                </section>
                            )}

                            {/* Trending Artists */}
                            {data && data.artists.length > 0 && (
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Link to="/artists" style={{ ...sectionTitle, textDecoration: 'none' }}>Trending Artists</Link>
                                        <Link to="/artists" style={{ color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none' }}>Show all</Link>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 20 }}>
                                        {data.artists.map((a: any) => (
                                            <Link key={a.id || a.username} to={`/profile/${a.username}`} style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', textDecoration: 'none', color: TEXT }}>
                                                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', background: S_HIGH }}>
                                                    {a.avatar && <img src={a.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                                <span style={{ fontSize: 16, fontWeight: 700, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.displayName || a.username}</span>
                                                <span style={{ fontSize: 12, color: SUB, marginTop: 4 }}>{a.genres?.[0]?.genre?.name || 'Producer'}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* New Drops */}
                            {data && data.drops.length > 0 && (
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Link to="/new" style={{ ...sectionTitle, textDecoration: 'none' }}>New Drops</Link>
                                        <Link to="/new" style={{ color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none' }}>Show all</Link>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 20 }}>
                                        {data.drops.map((t: any) => (
                                            <div key={t.id} onClick={() => playTrack(t, data.drops)} style={card}>
                                                <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 6, overflow: 'hidden', marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', background: S_HIGH }}>
                                                    <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <span style={{ position: 'absolute', bottom: 8, right: 8, width: 40, height: 40, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}><Play size={22} fill="#fff" color="#fff" style={{ marginLeft: 2 }} /></span>
                                                </div>
                                                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</h4>
                                                <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trackName(t)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            {!data && <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>}
                        </div>
                    </div>
                </main>

                {/* Right sidebar */}
                <aside style={{ width: 288, background: BG, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
                    <div style={{ padding: '24px 16px', borderBottom: `1px solid ${BORDER}` }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Community Activity</h3>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {data && data.battles.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Swords size={20} color={TERTIARY} /><h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Battles</h4></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {data.battles.map((b: any) => {
                                        const live = b.status === 'active' || b.status === 'voting';
                                        return (
                                            <Link key={b.id} to={`/battles/${b.slug || b.id}`} style={{ position: 'relative', overflow: 'hidden', height: 112, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 12, textDecoration: 'none', color: '#fff', background: S_CONT }}>
                                                {b.cardImageUrl && <img src={b.cardImageUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2))' }} />
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: live ? TERTIARY : 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'uppercase' }}>{live ? 'Live' : (b.status === 'completed' ? 'Ended' : 'Upcoming')}</span>
                                                    <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700 }}>{b.title}</p>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {data && data.activity.length > 0 && (
                            <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Recent Activity</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {data.activity.map((t: any) => (
                                        <Link key={t.id} to={`/profile/${t.profile?.username || ''}`} style={{ display: 'flex', gap: 12, textDecoration: 'none', color: TEXT }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH }}>{t.profile?.avatar && <img src={t.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: 13 }}><strong>{trackName(t)}</strong> published a track</p>
                                                <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB, display: 'flex', alignItems: 'center', gap: 4 }}><Music size={12} /> {t.title}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* Bottom player bar */}
            <footer style={{ height: 90, background: S_HIGHEST, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '30%', minWidth: 180 }}>
                    {cur && (
                        <>
                            <div style={{ width: 56, height: 56, borderRadius: 6, overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>{cur.cover && <img src={cur.cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}</div>
                                <div style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(cur as any).artist || ''}</div>
                            </div>
                            <Heart size={20} color={SUB} style={{ flexShrink: 0 }} />
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '40%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 6 }}>
                        <Shuffle size={20} color={SUB} />
                        <SkipBack size={22} fill={TEXT} color={TEXT} />
                        <button onClick={togglePlay} disabled={!cur} style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cur ? 'pointer' : 'default', opacity: cur ? 1 : 0.4 }}>
                            {isPlaying ? <Pause size={20} fill="#000" /> : <Play size={20} fill="#000" style={{ marginLeft: 2 }} />}
                        </button>
                        <SkipForward size={22} fill={TEXT} color={TEXT} />
                        <Repeat size={20} color={SUB} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480 }}>
                        <span style={{ fontSize: 11, color: SUB, minWidth: 35, textAlign: 'right' }}>{fmt(player.currentTime)}</span>
                        <div onClick={(e) => { if (player.duration) { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * player.duration); } }} style={{ height: 4, background: S_VAR, borderRadius: 9999, flex: 1, cursor: 'pointer' }}>
                            <div style={{ height: '100%', width: `${progress * 100}%`, background: PRIMARY, borderRadius: 9999 }} />
                        </div>
                        <span style={{ fontSize: 11, color: SUB, minWidth: 35 }}>{fmt(player.duration)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, width: '30%', minWidth: 180, color: SUB }}>
                    <Mic size={20} /><ListMusic size={20} /><Volume2 size={20} />
                </div>
            </footer>
        </div>
    );
};
