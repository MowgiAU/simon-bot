/**
 * Mobile charts view — the Stitch mockup design fed by the real chart data the
 * page already fetches. Rendered only on mobile inside DiscoveryLayout; desktop
 * keeps its existing layout. Reuses usePlayer for playback (no own chrome).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Play, BarChart2, ChevronUp, ChevronDown, Minus, Heart, Repeat2, MoreVertical, Music } from 'lucide-react';

const PRIMARY = '#F2780A';
const CYAN = '#06B6D4';
const SURFACE = 'rgba(17,24,39,0.7)';
const BORDER = 'rgba(255,255,255,0.08)';
const BG = '#0B0F19';
const TEXT = '#F8FAFC';
const SUB = '#94A3B8';

type Period = 'daily' | 'weekly' | 'alltime';

interface ChartEntry {
    position: number;
    prevPosition: number | null;
    positionChange: number | null;
    playsInPeriod: number;
    track: {
        id: string;
        title: string;
        coverUrl: string | null;
        profile: { username: string; displayName: string | null };
    };
}

const PERIODS: { id: Period; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'alltime', label: 'All-time' },
];

const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };

const Movement: React.FC<{ entry: ChartEntry; size?: number }> = ({ entry, size = 14 }) => {
    if (entry.prevPosition == null) return <span style={{ fontSize: 9, fontWeight: 800, color: PRIMARY, letterSpacing: '0.5px' }}>NEW</span>;
    const c = entry.positionChange ?? 0;
    if (c > 0) return <ChevronUp size={size} color="#4ade80" />;
    if (c < 0) return <ChevronDown size={size} color="#EF4444" />;
    return <Minus size={size} color={SUB} style={{ opacity: 0.5 }} />;
};

interface Props {
    entries: ChartEntry[];
    period: Period;
    setPeriod: (p: Period) => void;
    reposts: Record<string, boolean>;
    onPlay: (idx: number) => void;
    onRepost: (trackId: string) => void;
    playingTrackId?: string;
    loading?: boolean;
}

export const ChartsMobile: React.FC<Props> = ({ entries, period, setPeriod, reposts, onPlay, onRepost, playingTrackId, loading }) => {
    const hero = entries[0];
    const rows = entries.slice(1);
    const artistOf = (e: ChartEntry) => e.track.profile.displayName || e.track.profile.username;

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '4px 16px 24px', color: TEXT }}>
            <h1 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, margin: '8px 0 16px' }}>Global Charts</h1>

            {/* Period switcher */}
            <div style={{ ...glass, display: 'flex', borderRadius: 9999, padding: 4, marginBottom: 20 }}>
                {PERIODS.map(p => {
                    const on = p.id === period;
                    return (
                        <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                            flex: 1, padding: '8px 0', borderRadius: 9999, border: 'none', cursor: 'pointer',
                            background: on ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: on ? PRIMARY : SUB, fontWeight: on ? 700 : 500, fontSize: 14,
                        }}>{p.label}</button>
                    );
                })}
            </div>

            {loading && <div style={{ textAlign: 'center', color: SUB, padding: '60px 0' }}>Loading charts…</div>}
            {!loading && entries.length === 0 && <div style={{ textAlign: 'center', color: SUB, padding: '60px 0' }}>No chart data yet — check back soon!</div>}

            {/* #1 hero */}
            {hero && (
                <section onClick={() => onPlay(0)} style={{ ...glass, position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, cursor: 'pointer' }}>
                    {hero.track.coverUrl && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${hero.track.coverUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(28px)', transform: 'scale(1.2)', opacity: 0.5 }} />}
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(11,15,25,0.6), transparent)` }} />
                    <div style={{ position: 'relative', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 260 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 56, fontWeight: 800, color: PRIMARY, textShadow: '0 0 15px rgba(242,120,10,0.7)', lineHeight: 1 }}>1</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(49,53,64,0.8)', borderRadius: 9999, padding: '4px 12px', border: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 600 }}>
                                <Movement entry={hero} /> {hero.prevPosition == null ? '' : (hero.positionChange ?? 0) > 0 ? `UP ${hero.positionChange}` : (hero.positionChange ?? 0) < 0 ? `DOWN ${-(hero.positionChange ?? 0)}` : 'STEADY'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                {hero.track.coverUrl
                                    ? <img src={hero.track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                                    : <div style={{ width: 80, height: 80, borderRadius: 12, background: '#1F2937', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Music size={28} color={SUB} /></div>}
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{hero.track.title}</h3>
                                    <Link to={`/profile/${hero.track.profile.username}`} onClick={e => e.stopPropagation()} style={{ fontSize: 14, color: SUB, textDecoration: 'none' }}>{artistOf(hero)}</Link>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                <span style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(242,120,10,0.6)' }}>
                                    <Play size={28} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...glass, padding: '4px 8px', borderRadius: 6 }}>
                                    <BarChart2 size={12} color={PRIMARY} />
                                    <span style={{ fontSize: 11, color: PRIMARY, fontWeight: 600, textTransform: 'uppercase' }}>{hero.playsInPeriod} Plays</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Ranked rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((e, i) => {
                    const playing = playingTrackId === e.track.id;
                    return (
                        <div key={e.track.id} onClick={() => onPlay(i + 1)} style={{ ...glass, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', outline: playing ? `1px solid ${PRIMARY}` : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <div style={{ width: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 16, fontWeight: 600, color: SUB }}>{e.position}</span>
                                    <Movement entry={e} />
                                </div>
                                {e.track.coverUrl
                                    ? <img src={e.track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                                    : <div style={{ width: 48, height: 48, borderRadius: 8, background: '#1F2937', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Music size={20} color={SUB} /></div>}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: playing ? PRIMARY : TEXT }}>{e.track.title}</h4>
                                    <Link to={`/profile/${e.track.profile.username}`} onClick={ev => ev.stopPropagation()} style={{ fontSize: 12, color: SUB, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{artistOf(e)}</Link>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, paddingLeft: 8 }}>
                                <span style={{ fontSize: 12, color: SUB }}>{e.playsInPeriod}</span>
                                <button aria-label="Repost" onClick={ev => { ev.stopPropagation(); onRepost(e.track.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    <Repeat2 size={20} color={reposts[e.track.id] ? PRIMARY : SUB} />
                                </button>
                                <MoreVertical size={20} color={TEXT} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
