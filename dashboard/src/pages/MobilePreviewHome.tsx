/**
 * Mobile redesign preview — Home / Discovery (Stitch mockup rebuilt as CSP-safe React).
 * Hidden route: /preview/mobile-home — not linked from any nav.
 * Live data (charts, profiles, discovery tracks, beat battles) with real fallback.
 */
import React from 'react';
import axios from 'axios';
import { Search, Bell, Mail, Play, PlayCircle, Flame, Users } from 'lucide-react';
import { BG, SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, FONT, MobileBottomNav, MiniPlayer, useLive, arr } from './MobilePreviewChrome';

const TR = 'https://cdn.fujistud.io/tracks';
const PR = 'https://cdn.fujistud.io/profiles';
const BN = 'https://cdn.fujistud.io/battle-banners';
const GOTTA = `${TR}/cmpor4ape00q9qn2q67a116oq/artwork/artwork-1779927906748-479692442.webp`;

type Featured = { artist: string; title: string; cover: string; sub: string };
type Artist = { name: string; genre: string; avatar: string };
type Drop = { title: string; artist: string; cover: string };
type Battle = { title: string; sub: string; meta: string; img: string };
type Data = { featured: Featured; artists: Artist[]; drops: Drop[]; battles: Battle[] };

const FALLBACK: Data = {
    featured: { artist: 'Logix', title: 'Gotta Love You', cover: GOTTA, sub: '#1 this week • 518 plays' },
    artists: [
        { name: 'DotObject', genre: 'Hip-Hop', avatar: `${PR}/cmqg6hwt500f7dwt0vvtdtomz/avatar/avatar-1781586323602-312292758.webp` },
        { name: 'Xeinu', genre: 'Pop', avatar: `${PR}/cmq9aj70r00otcyn3t9dwgp3v/avatar/avatar-1781170092319-103291383.webp` },
        { name: 'R-Tic', genre: 'Trap', avatar: `${PR}/cmqa82oqa019xcyn3em8ur05g/avatar/avatar-1781226175745-635435917.webp` },
        { name: 'Wayofthedarkness', genre: 'Metal', avatar: `${PR}/cmqa453mb011kcyn3c9nb67y6/avatar/avatar-1781219569298-360762421.webp` },
    ],
    drops: [
        { title: 'that is enough 2026 mix', artist: 'DotObject', cover: `${TR}/cmqg7wkb600gbdwt0hi4vppv3/artwork/artwork-1781588686254-575453074.webp` },
        { title: 'Badboy', artist: 'DotObject', cover: `${TR}/cmqg6oiy100fndwt02m9g5s5x/artwork/artwork-1781586631608-151303704.webp` },
        { title: 'ATTACK OF LIGHT', artist: 'Average Chemical', cover: `${TR}/cmqfcux5e009adwt0oenl82xj/artwork/artwork-1781536541155-680351568.webp` },
    ],
    battles: [
        { title: 'Baby Audio Presents', sub: 'Baby Audio Complete Bundle', meta: '28 entries • Completed', img: `${BN}/battleCardImage-1779112857310-953230042.png` },
        { title: 'FujiStud.io Beat Battle #2', sub: 'Community battle', meta: '4 entries • Completed', img: `${BN}/battleCardImage-1776836316394-712616310.png` },
    ],
};

const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };
const sectionTitle: React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: '0 0 14px' };
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export const MobilePreviewHome: React.FC = () => {
    const data = useLive<Data>(async () => {
        const [c, p, d, b] = await Promise.all([
            axios.get('/api/charts/weekly'),
            axios.get('/api/musician/profiles?limit=12'),
            axios.get('/api/discovery/tracks?limit=8'),
            axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
        ]);
        const ch = Array.isArray(c.data) ? c.data[0] : c.data;
        const e0 = ch?.entries?.[0];
        const featured: Featured | null = e0 ? {
            artist: e0.track?.profile?.displayName ?? 'Unknown',
            title: e0.track?.title ?? '',
            cover: e0.track?.coverUrl ?? GOTTA,
            sub: `#${e0.position} this week • ${e0.track?.playCount ?? 0} plays`,
        } : null;
        const artists: Artist[] = arr(p.data).filter((x: any) => x.avatar).slice(0, 8)
            .map((x: any) => ({ name: x.displayName, genre: x.genres?.[0]?.genre?.name ?? '', avatar: x.avatar }));
        const drops: Drop[] = arr(d.data).filter((x: any) => x.coverUrl).slice(0, 6)
            .map((x: any) => ({ title: x.title, artist: x.artist || x.profile?.displayName || '', cover: x.coverUrl }));
        const battles: Battle[] = arr(b.data).filter((x: any) => x.cardImageUrl).slice(0, 2)
            .map((x: any) => ({ title: x.title, sub: x.subtitle || x.miniDescription || 'Beat battle', meta: `${x._count?.entries ?? 0} entries • ${cap(x.status || '')}`, img: x.cardImageUrl }));
        if (!featured) return null;
        return {
            featured,
            artists: artists.length ? artists : FALLBACK.artists,
            drops: drops.length ? drops : FALLBACK.drops,
            battles: battles.length ? battles : FALLBACK.battles,
        };
    }, FALLBACK);

    const { featured, artists, drops, battles } = data;

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: FONT }}>
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 160px' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: PRIMARY }}>FUJI STUDIO</span>
                    <div style={{ display: 'flex', gap: 14, color: SUB }}><Search size={20} /><Bell size={20} /><Mail size={20} /></div>
                </header>

                <section style={{ position: 'relative', height: 380, borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${featured.cover}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(11,15,25,0.5), transparent)` }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: 24, boxSizing: 'border-box' }}>
                        <span style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: CYAN }}>Featured Artist of the Week</span>
                        <h1 style={{ margin: '8px 0 16px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{featured.artist}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(242,120,10,0.25)', flexShrink: 0 }}>
                                <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
                            </span>
                            <div>
                                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{featured.title}</p>
                                <p style={{ margin: 0, fontSize: 14, color: SUB }}>{featured.sub}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section style={{ ...glass, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                        <h2 style={sectionTitle}>Trending Artists</h2>
                        <span style={{ fontSize: 13, color: CYAN }}>View All</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
                        {artists.map((a, i) => (
                            <div key={a.name + i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 96 }}>
                                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${i === 1 ? PRIMARY : '#F43F5E'}`, marginBottom: 8, boxShadow: i === 1 ? '0 0 15px rgba(242,120,10,0.3)' : 'none' }}>
                                    <img src={a.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <span style={{ fontSize: 15, fontWeight: 600, maxWidth: 92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                                {a.genre && <span style={{ fontSize: 10, color: CYAN }}>{a.genre}</span>}
                            </div>
                        ))}
                    </div>
                </section>

                <section style={{ ...glass, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                    <h2 style={sectionTitle}>New Drops</h2>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                        {drops.map((d, i) => (
                            <div key={d.title + i} style={{ minWidth: 160, maxWidth: 160 }}>
                                <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', position: 'relative', marginBottom: 12, border: `1px solid ${BORDER}` }}>
                                    <img src={d.cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.9 }}><PlayCircle size={32} fill={PRIMARY} color="#fff" /></div>
                                </div>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</h3>
                                <p style={{ margin: 0, fontSize: 14, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.artist}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Flame size={22} fill={PRIMARY} color={PRIMARY} />
                        <h2 style={{ ...sectionTitle, margin: 0 }}>Beat Battles</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {battles.map((b, i) => (
                            <div key={b.title + i} style={{ ...glass, borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ width: 96, height: 96, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', border: `1px solid ${BORDER}` }}>
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
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <MiniPlayer title={featured.title} artist={featured.artist} cover={featured.cover} />
            <MobileBottomNav active="home" />
        </div>
    );
};
