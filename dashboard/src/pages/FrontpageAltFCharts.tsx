/**
 * Alt F — Charts preview (/preview/alt_f_charts)
 * Shared AltSidebar + AltHeader. Full chart table with hero #1 track.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Play, Pause, TrendingUp, TrendingDown, Minus, MoreVertical, Repeat2, Heart, BarChart3,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
function bars(seed: string, n = 40) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }

const PERIODS = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'alltime', label: 'All-time' },
] as const;
type Period = typeof PERIODS[number]['key'];

export const FrontpageAltFCharts: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const navigate = useNavigate();
    const [period, setPeriod] = useState<Period>('weekly');
    const [chart, setChart] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let on = true;
        setLoading(true);
        axios.get(`/api/charts/${period}`).then(r => {
            if (!on) return;
            const data = r.data;
            setChart(Array.isArray(data) ? data[0] : data);
            setLoading(false);
        }).catch(() => { if (on) setLoading(false); });
        return () => { on = false; };
    }, [period]);

    const entries: any[] = chart?.entries || [];
    const hero = entries[0] || null;

    const mkTrack = (e: any) => ({
        id: e.track.id, title: e.track.title, artist: e.track.profile?.displayName || e.track.profile?.username,
        cover: e.track.coverUrl, url: e.track.url, profile: e.track.profile,
    });
    const playAll = () => { if (entries.length) setTrack(mkTrack(entries[0]), entries.map(mkTrack)); };
    const playEntry = (e: any) => setTrack(mkTrack(e), entries.map(mkTrack));
    const playingId = player.currentTrack?.id;

    const DIVIDER = 'rgba(87,66,54,0.25)';
    const glass: React.CSSProperties = { background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' };

    const Trend: React.FC<{ change: number | null }> = ({ change }) => {
        if (change == null) return <span style={{ color: SUB, fontSize: 11 }}>—</span>;
        if (change > 0) return <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}><TrendingUp size={13} /> +{change}</span>;
        if (change < 0) return <span style={{ color: TERTIARY, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}><TrendingDown size={13} /> {change}</span>;
        return <span style={{ color: SUB, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><Minus size={13} /> —</span>;
    };

    const rankColor = (pos: number) => pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : pos <= 10 ? TEXT : SUB;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Charts" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Charts' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {/* Hero — #1 track */}
                    {hero && (
                        <section style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${BG} 0%, #1a0f05 100%)` }} />
                            {hero.track.coverUrl && (
                                <img src={hero.track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />
                            )}
                            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG} 0%, rgba(15,19,29,0.5) 60%, transparent 100%)` }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: 40, display: 'flex', gap: 32, alignItems: 'flex-end', boxSizing: 'border-box' }}>
                                {/* Cover */}
                                <div onClick={() => playEntry(hero)} style={{ width: 140, height: 140, borderRadius: 12, overflow: 'hidden', flexShrink: 0, position: 'relative', background: S_HIGH, cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                                    {hero.track.coverUrl
                                        ? <img src={hero.track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={40} color={SUB} /></div>}
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                                        {playingId === hero.track.id
                                            ? <Pause size={40} fill="#fff" color="#fff" />
                                            : <Play size={40} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />}
                                    </div>
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                        <span style={{ background: PRIMARY, color: '#fff', padding: '3px 12px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>#{hero.position} This Week</span>
                                        <span style={{ background: SECONDARY, color: '#002030', padding: '3px 12px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trending</span>
                                    </div>
                                    <h1 style={{ margin: '0 0 6px', fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.track.title}</h1>
                                    <Link to={`/profile/${hero.track.profile?.username}`} style={{ color: SUB, textDecoration: 'none', fontSize: 18, fontWeight: 600 }}>
                                        {hero.track.profile?.displayName || hero.track.profile?.username}
                                    </Link>
                                    <div style={{ display: 'flex', gap: 24, marginTop: 16, color: SUB, fontSize: 13 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Play size={14} /> {fmtNum(hero.track.playCount)} plays</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Repeat2 size={14} /> {fmtNum(hero.playsInPeriod)} this period</span>
                                    </div>
                                    {/* Mini waveform */}
                                    <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 1.5, marginTop: 14, maxWidth: 500 }}>
                                        {bars(hero.track.id || hero.track.title).map((h, i) => (
                                            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 9999, background: i / 40 < (player.currentTime / (player.duration || 1)) && playingId === hero.track.id ? PRIMARY : 'rgba(242,120,10,0.3)' }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Controls + table */}
                    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24, boxSizing: 'border-box' }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT }}>Global Charts</h2>
                                <p style={{ margin: '4px 0 0', fontSize: 14, color: SUB }}>The most played tracks in the Fuji community.</p>
                            </div>
                            <div style={{ display: 'flex', background: S_CONT, padding: 4, borderRadius: 12, border: `1px solid ${BORDER}`, gap: 2 }}>
                                {PERIODS.map(p => (
                                    <button key={p.key} onClick={() => setPeriod(p.key)}
                                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: period === p.key ? PRIMARY : 'transparent', color: period === p.key ? '#fff' : SUB, transition: 'all 0.2s' }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        {loading ? (
                            <div style={{ padding: 60, textAlign: 'center', color: SUB }}>Loading…</div>
                        ) : entries.length === 0 ? (
                            <div style={{ padding: 60, textAlign: 'center', color: SUB }}>No chart data yet.</div>
                        ) : (
                            <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                {/* Column headers */}
                                <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 160px 100px 100px 100px 48px', gap: 16, padding: '12px 24px', background: 'rgba(38,42,53,0.5)', borderBottom: `1px solid ${DIVIDER}`, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB }}>
                                    <span>Rank</span><span>Track</span><span>Engagement</span><span>Plays</span><span>Period</span><span>Trend</span><span />
                                </div>
                                {entries.map((e: any, idx: number) => {
                                    const on = playingId === e.track.id;
                                    const engagement = Math.min(100, Math.round(((e.playsInPeriod || 0) / Math.max(1, entries[0]?.playsInPeriod || 1)) * 100));
                                    return (
                                        <div key={e.track.id} onClick={() => playEntry(e)}
                                            style={{ display: 'grid', gridTemplateColumns: '56px 1fr 160px 100px 100px 100px 48px', gap: 16, padding: '14px 24px', alignItems: 'center', cursor: 'pointer', background: on ? `${PRIMARY}0a` : idx === 0 ? `${PRIMARY}05` : 'transparent', borderBottom: idx < entries.length - 1 ? `1px solid ${DIVIDER}` : 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={ev => { if (!on) ev.currentTarget.style.background = 'rgba(38,42,53,0.4)'; }}
                                            onMouseLeave={ev => { ev.currentTarget.style.background = on ? `${PRIMARY}0a` : idx === 0 ? `${PRIMARY}05` : 'transparent'; }}>
                                            <span style={{ fontSize: idx < 3 ? 18 : 14, fontWeight: 800, color: rankColor(e.position), fontVariantNumeric: 'tabular-nums', fontStyle: 'italic' }}>{String(e.position).padStart(2, '0')}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                <div style={{ width: idx === 0 ? 52 : 44, height: idx === 0 ? 52 : 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: S_HIGH, position: 'relative' }}>
                                                    {e.track.coverUrl
                                                        ? <img src={e.track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={16} color={SUB} /></div>}
                                                    {on && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pause size={16} fill="#fff" color="#fff" /></div>}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: on ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.track.title}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.track.profile?.displayName || e.track.profile?.username}</p>
                                                </div>
                                            </div>
                                            {/* Engagement bar */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ height: 4, flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 9999, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${engagement}%`, background: idx === 0 ? PRIMARY : SECONDARY, borderRadius: 9999 }} />
                                                </div>
                                                <span style={{ fontSize: 10, color: idx === 0 ? PRIMARY : SECONDARY, fontWeight: 700, flexShrink: 0 }}>{engagement}%</span>
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtNum(e.track.playCount)}</span>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtNum(e.playsInPeriod)}</span>
                                            <Trend change={e.positionChange} />
                                            <button onClick={ev => ev.stopPropagation()} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 4 }}><MoreVertical size={16} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
