/**
 * Mobile redesign preview — Top Charts (Stitch mockup rebuilt as CSP-safe React).
 * Hidden route: /preview/mobile-charts — not linked from any nav.
 * Live data from /api/charts/weekly, with baked-in real values as fallback.
 */
import React from 'react';
import axios from 'axios';
import { Search, Play, BarChart2, Minus, ChevronUp, ChevronDown, Heart, Repeat, MoreVertical, Music } from 'lucide-react';
import { BG, SURFACE, BORDER, PRIMARY, TEXT, SUB, FONT, MobileBottomNav, MiniPlayer, useLive, arr } from './MobilePreviewChrome';

const CDN = 'https://cdn.fujistud.io/tracks';
type Row = { pos: number; change: number; title: string; artist: string; plays: number; cover: string | null };
type Data = { hero: Row; rows: Row[] };

const FALLBACK: Data = {
    hero: { pos: 1, change: 0, title: 'Gotta Love You', artist: 'Logix', plays: 518, cover: `${CDN}/cmpor4ape00q9qn2q67a116oq/artwork/artwork-1779927906748-479692442.webp` },
    rows: [
        { pos: 2, change: 0, title: 'baby audio battle lesssgoooo.wav', artist: 'jakedastardly', plays: 287, cover: `${CDN}/cmpoo3ypp0089nz7ettolbhfe/artwork/artwork-1779922852254-131985767.webp` },
        { pos: 3, change: 0, title: 'Testing new stems feature', artist: 'Thomas', plays: 50, cover: null },
        { pos: 4, change: 0, title: 'Noospheric Entry', artist: 'ELUSiVE', plays: 103, cover: `${CDN}/cmpor2qs200ppqn2q41rs4kae/artwork/artwork-1779927833913-718524149.webp` },
        { pos: 5, change: 0, title: 'Distant Memories', artist: 'ELUSiVE', plays: 39, cover: `${CDN}/cmq79sbza00ra1422mi4m2ihj/artwork/artwork-1781047652298-480549523.webp` },
        { pos: 6, change: 0, title: 'The Unbearable Weight of Being', artist: 'jteoh', plays: 320, cover: `${CDN}/cmpopct3100arqn2qniozfwfw/artwork/artwork-1779924944132-76154227.webp` },
        { pos: 7, change: 0, title: 'PENETRATION PAR ECLAT DE VERRE', artist: 'L3F3L3', plays: 28, cover: `${CDN}/cmq7xo82o008u1002htpwya3v/artwork/artwork-1781100445603-702253603.webp` },
        { pos: 8, change: 0, title: 'Eight Handled Sword Divergent', artist: 'AverageChemical', plays: 22, cover: `${CDN}/cmq6fc2ci008bg57jh7zur6cm/artwork/artwork-1780996504696-901455036.webp` },
    ],
};

const mapEntry = (e: any): Row => ({
    pos: e.position,
    change: e.positionChange ?? 0,
    title: e.track?.title ?? 'Untitled',
    artist: e.track?.profile?.displayName ?? 'Unknown',
    plays: e.track?.playCount ?? 0,
    cover: e.track?.coverUrl ?? null,
});

const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };

const Movement: React.FC<{ change: number; size?: number }> = ({ change, size = 14 }) => {
    if (change > 0) return <ChevronUp size={size} color="#4ade80" />;
    if (change < 0) return <ChevronDown size={size} color="#EF4444" />;
    return <Minus size={size} color={SUB} style={{ opacity: 0.5 }} />;
};

export const MobilePreviewCharts: React.FC = () => {
    const { hero, rows } = useLive<Data>(async () => {
        const r = await axios.get('/api/charts/weekly');
        const ch = Array.isArray(r.data) ? r.data[0] : r.data;
        const entries = ch?.entries ?? [];
        if (!entries.length) return null;
        return { hero: mapEntry(entries[0]), rows: entries.slice(1, 10).map(mapEntry) };
    }, FALLBACK);

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: FONT }}>
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 160px' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: PRIMARY }}>FUJI STUDIO</span>
                    <Search size={22} color={SUB} />
                </header>

                <h1 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, margin: '8px 0 16px' }}>Global Charts</h1>

                <div style={{ ...glass, display: 'flex', borderRadius: 9999, padding: 4, marginBottom: 20 }}>
                    {['Daily', 'Weekly', 'All-time'].map(p => {
                        const on = p === 'Weekly';
                        return <button key={p} style={{ flex: 1, padding: '8px 0', borderRadius: 9999, border: 'none', cursor: 'pointer', background: on ? 'rgba(255,255,255,0.08)' : 'transparent', color: on ? PRIMARY : SUB, fontWeight: on ? 700 : 500, fontSize: 14 }}>{p}</button>;
                    })}
                </div>

                {/* #1 hero */}
                <section style={{ ...glass, position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                    {hero.cover && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${hero.cover}')`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(28px)', transform: 'scale(1.2)', opacity: 0.5 }} />}
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(11,15,25,0.6), transparent)` }} />
                    <div style={{ position: 'relative', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 260 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 56, fontWeight: 800, color: PRIMARY, textShadow: '0 0 15px rgba(242,120,10,0.7)', lineHeight: 1 }}>1</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(49,53,64,0.8)', borderRadius: 9999, padding: '4px 12px', border: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 600 }}>
                                <Movement change={hero.change} /> {hero.change > 0 ? `UP ${hero.change}` : hero.change < 0 ? `DOWN ${-hero.change}` : 'STEADY'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                {hero.cover && <img src={hero.cover} alt="" referrerPolicy="no-referrer" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: `1px solid ${BORDER}`, flexShrink: 0 }} />}
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{hero.title}</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: 14, color: SUB }}>{hero.artist}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                <span style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(242,120,10,0.6)' }}>
                                    <Play size={28} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...glass, padding: '4px 8px', borderRadius: 6 }}>
                                    <BarChart2 size={12} color={PRIMARY} />
                                    <span style={{ fontSize: 11, color: PRIMARY, fontWeight: 600, textTransform: 'uppercase' }}>{hero.plays} Plays</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rows.map(r => (
                        <div key={r.pos} style={{ ...glass, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <div style={{ width: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 16, fontWeight: 600, color: SUB }}>{r.pos}</span>
                                    <Movement change={r.change} />
                                </div>
                                {r.cover
                                    ? <img src={r.cover} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                                    : <div style={{ width: 48, height: 48, borderRadius: 8, background: '#1F2937', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Music size={20} color={SUB} /></div>}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</h4>
                                    <p style={{ margin: 0, fontSize: 12, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.artist}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, paddingLeft: 8 }}>
                                <span style={{ fontSize: 12, color: SUB }}>{r.plays}</span>
                                <Heart size={20} color={SUB} />
                                <Repeat size={20} color={SUB} />
                                <MoreVertical size={20} color={TEXT} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <MiniPlayer title={hero.title} artist={hero.artist} cover={hero.cover || ''} />
            <MobileBottomNav active="charts" />
        </div>
    );
};
