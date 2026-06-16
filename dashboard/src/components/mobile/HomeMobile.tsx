/**
 * Mobile Home / Discovery view — the Stitch mockup design fed by live Fuji data.
 * Rendered only on mobile inside DiscoveryLayout (which supplies the header,
 * bottom nav and GlobalPlayer); desktop keeps its existing layout.
 */
import React from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Play, PlayCircle, Flame, Users, Music } from 'lucide-react';
import { usePlayer } from '../PlayerProvider';
import { useLive, arr, SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, BG } from '../../pages/MobilePreviewChrome';

type Track = any;
type Featured = { track: Track; sub: string } | null;
type Artist = { name: string; username: string; genre: string; avatar: string | null };
type Battle = { title: string; sub: string; meta: string; img: string; slug: string };
type Data = { featured: Featured; artists: Artist[]; drops: Track[]; battles: Battle[] };

const EMPTY: Data = { featured: null, artists: [], drops: [], battles: [] };
const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };
const sectionTitle: React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: '0 0 14px', color: TEXT };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const artistName = (t: any) => t?.profile?.displayName || t?.profile?.username || t?.artist || 'Unknown';

export const HomeMobile: React.FC = () => {
    const { setTrack } = usePlayer();

    const data = useLive<Data>(async () => {
        const [c, p, d, b] = await Promise.all([
            axios.get('/api/charts/weekly'),
            axios.get('/api/musician/profiles?limit=12'),
            axios.get('/api/discovery/tracks?limit=8'),
            axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
        ]);
        const ch = Array.isArray(c.data) ? c.data[0] : c.data;
        const e0 = ch?.entries?.[0];
        const featured: Featured = e0?.track ? { track: e0.track, sub: `#${e0.position} this week • ${e0.track.playCount ?? e0.playsInPeriod ?? 0} plays` } : null;
        const artists: Artist[] = arr(p.data).filter((x: any) => x.avatar).slice(0, 8)
            .map((x: any) => ({ name: x.displayName || x.username, username: x.username, genre: x.genres?.[0]?.genre?.name ?? '', avatar: x.avatar }));
        const drops: Track[] = arr(d.data).filter((x: any) => x.coverUrl).slice(0, 8);
        const battles: Battle[] = arr(b.data).filter((x: any) => x.cardImageUrl).slice(0, 2)
            .map((x: any) => ({ title: x.title, sub: x.subtitle || x.miniDescription || 'Beat battle', meta: `${x._count?.entries ?? 0} entries • ${cap(x.status || '')}`, img: x.cardImageUrl, slug: x.slug }));
        return { featured, artists, drops, battles };
    }, EMPTY);

    const { featured, artists, drops, battles } = data;
    const loading = !featured && artists.length === 0 && drops.length === 0;

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '4px 16px 24px', color: TEXT }}>
            {loading && <div style={{ textAlign: 'center', color: SUB, padding: '60px 0' }}>Loading…</div>}

            {/* Hero — featured #1 */}
            {featured && (
                <section
                    onClick={() => setTrack(featured.track, [featured.track])}
                    style={{ position: 'relative', height: 380, borderRadius: 16, overflow: 'hidden', marginBottom: 24, cursor: 'pointer' }}
                >
                    {featured.track.coverUrl && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${featured.track.coverUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(11,15,25,0.5), transparent)` }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: 24, boxSizing: 'border-box' }}>
                        <span style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: CYAN }}>Featured this week</span>
                        <h1 style={{ margin: '8px 0 16px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{artistName(featured.track)}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(242,120,10,0.25)', flexShrink: 0 }}>
                                <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
                            </span>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{featured.track.title}</p>
                                <p style={{ margin: 0, fontSize: 14, color: SUB }}>{featured.sub}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Trending Artists */}
            {artists.length > 0 && (
                <section style={{ ...glass, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                        <h2 style={sectionTitle}>Trending Artists</h2>
                        <Link to="/artists" style={{ fontSize: 13, color: CYAN, textDecoration: 'none' }}>View All</Link>
                    </div>
                    <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
                        {artists.map((a, i) => (
                            <Link key={a.username + i} to={`/profile/${a.username}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 96, textDecoration: 'none', color: TEXT }}>
                                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${i === 1 ? PRIMARY : '#F43F5E'}`, marginBottom: 8, boxShadow: i === 1 ? '0 0 15px rgba(242,120,10,0.3)' : 'none' }}>
                                    {a.avatar ? <img src={a.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={24} color={SUB} /></div>}
                                </div>
                                <span style={{ fontSize: 15, fontWeight: 600, maxWidth: 92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                                {a.genre && <span style={{ fontSize: 10, color: CYAN }}>{a.genre}</span>}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* New Drops */}
            {drops.length > 0 && (
                <section style={{ ...glass, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                    <h2 style={sectionTitle}>New Drops</h2>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                        {drops.map((t, i) => (
                            <div key={t.id || i} onClick={() => setTrack(t, drops)} style={{ minWidth: 160, maxWidth: 160, cursor: 'pointer' }}>
                                <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', position: 'relative', marginBottom: 12, border: `1px solid ${BORDER}` }}>
                                    <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.9 }}><PlayCircle size={32} fill={PRIMARY} color="#fff" /></div>
                                </div>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</h3>
                                <p style={{ margin: 0, fontSize: 14, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artistName(t)}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Beat Battles */}
            {battles.length > 0 && (
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Flame size={22} fill={PRIMARY} color={PRIMARY} />
                        <h2 style={{ ...sectionTitle, margin: 0 }}>Beat Battles</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {battles.map((b, i) => (
                            <Link key={b.slug || i} to={b.slug ? `/battles/${b.slug}` : '/battles'} style={{ ...glass, borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'center', textDecoration: 'none', color: TEXT }}>
                                <div style={{ width: 96, height: 96, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `1px solid ${BORDER}` }}>
                                    <img src={b.img} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{b.title}</h3>
                                    <p style={{ margin: '0 0 8px', fontSize: 14, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.sub}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: SUB }}>
                                        <Users size={16} />
                                        <span style={{ fontSize: 13 }}>{b.meta}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};
