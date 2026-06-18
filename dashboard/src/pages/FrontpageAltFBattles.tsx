/**
 * Alt F — Battles overview page (/preview/alt_f_battles)
 * Design based on mainbattles.html: centred hero with stats pill, glass cards
 * with shadow + hover borders, battle cards with image tops, wall of fame, history table.
 */
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, S_HIGHEST, PRIMARY, SECONDARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { Trophy, Users, Clock, Star, ChevronRight, Flame, Music, Award, Play } from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const stripHtml = (h: string) => h.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

function countdown(end?: string | null): string | null {
    if (!end) return null;
    const ms = new Date(end).getTime() - Date.now();
    if (ms <= 0) return 'Ended';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (d > 0) return `${d}d ${h}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m ${s}s remaining`;
}

function battleStatus(b: any): { label: string; color: string } {
    const now = Date.now();
    const sub = b.submissionEnd ? new Date(b.submissionEnd).getTime() : 0;
    const vote = b.votingEnd ? new Date(b.votingEnd).getTime() : 0;
    if (sub > now) return { label: 'Live Now', color: '#4ade80' };
    if (vote > now) return { label: 'Voting', color: SECONDARY };
    return { label: 'Ended', color: SUB };
}

function formatPrize(b: any): string | null {
    if (b.prizePool) return String(b.prizePool);
    if (Array.isArray(b.prizes) && b.prizes.length > 0) {
        const first = b.prizes[0];
        if (first.amount) return `$${Number(first.amount).toLocaleString()}`;
        if (first.description) return first.description;
        return `${b.prizes.length} Prize${b.prizes.length > 1 ? 's' : ''}`;
    }
    return null;
}

// Animated waveform bars hook
function useWaveform(n = 10) {
    const [heights, setHeights] = useState(() => Array.from({ length: n }, () => 30 + Math.random() * 70));
    useEffect(() => {
        const id = setInterval(() => setHeights(Array.from({ length: n }, () => 30 + Math.random() * 70)), 400);
        return () => clearInterval(id);
    }, [n]);
    return heights;
}

// Glass card style matching mainbattles.html
const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

export const FrontpageAltFBattles: React.FC = () => {
    const navigate = useNavigate();
    const { player } = usePlayer();
    const [battles, setBattles] = useState<any[]>([]);
    const [archive, setArchive] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const waveHeights = useWaveform(12);

    useEffect(() => {
        Promise.all([
            axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
            axios.get('/api/beat-battle/archive').catch(() => ({ data: [] })),
        ]).then(([bRes, aRes]) => {
            const bData = Array.isArray(bRes.data) ? bRes.data : bRes.data?.battles || [];
            const aData = Array.isArray(aRes.data) ? aRes.data : aRes.data?.battles || [];
            setBattles(bData);
            setArchive(aData);
            setLoading(false);
        });
    }, []);

    const featured = battles.find((b: any) => b.status === 'active' || b.status === 'open') || battles[0];
    const upcoming = battles.filter((b: any) => b.id !== featured?.id);
    const topEntries: any[] = archive
        .flatMap((b: any) => (b.entries || []).slice(0, 1).map((e: any) => ({ ...e, battleTitle: b.title })))
        .slice(0, 5);

    const goToBattle = () => navigate('/preview/alt_f_battle');

    const featuredStatus = featured ? battleStatus(featured) : null;
    const featuredPrize = featured ? formatPrize(featured) : null;
    const featuredDesc = featured?.description ? stripHtml(featured.description) : '';
    const featuredEnd = featured?.submissionEnd && new Date(featured.submissionEnd).getTime() > Date.now()
        ? featured.submissionEnd
        : featured?.votingEnd;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Battles" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Battles' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {loading ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>
                    ) : (
                        <>
                            {/* ── FEATURED BATTLE HERO — centred, 480px tall ── */}
                            {featured && (
                                <section style={{ position: 'relative', width: '100%', height: 480, overflow: 'hidden' }}>
                                    {/* Background */}
                                    {(featured.bannerUrl || featured.release?.coverUrl)
                                        ? <img src={featured.bannerUrl || featured.release.coverUrl} alt="" referrerPolicy="no-referrer"
                                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
                                        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a2242 0%, #2a1040 50%, #1a0f10 100%)' }} />
                                    }
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.4) 50%, transparent 100%)' }} />

                                    {/* Centred content */}
                                    <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 40px', textAlign: 'center' }}>
                                        {/* Badges row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                                            {featuredStatus && (
                                                <span style={{ background: `${featuredStatus.color}22`, border: `1px solid ${featuredStatus.color}55`, color: featuredStatus.color, padding: '5px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Flame size={12} fill={featuredStatus.color} /> {featuredStatus.label}
                                                </span>
                                            )}
                                            {featuredEnd && countdown(featuredEnd) && (
                                                <span style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: SUB, padding: '5px 14px', borderRadius: 9999, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Clock size={11} /> {countdown(featuredEnd)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <h1 style={{ margin: '0 0 14px', fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.8)', maxWidth: 700 }}>
                                            {featured.title}
                                        </h1>

                                        {/* Short description */}
                                        {featuredDesc && (
                                            <p style={{ margin: '0 0 28px', maxWidth: 560, color: 'rgba(159,166,185,0.9)', fontSize: 15, lineHeight: 1.65 }}>
                                                {featuredDesc.slice(0, 180)}{featuredDesc.length > 180 ? '…' : ''}
                                            </p>
                                        )}

                                        {/* Stats pill — Prize Pool | Producers | Join Battle */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(28,31,42,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(87,66,54,0.35)', borderRadius: 20, padding: '20px 40px', marginBottom: 28 }}>
                                            {featuredPrize && (
                                                <>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 0 0' }}>
                                                        <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Prize Pool</span>
                                                        <span style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>{featuredPrize}</span>
                                                    </div>
                                                    <div style={{ width: 1, height: 48, background: 'rgba(87,66,54,0.5)' }} />
                                                </>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px' }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Producers</span>
                                                <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{fmtNum(featured._count?.entries || 0)}</span>
                                            </div>
                                            <div style={{ width: 1, height: 48, background: 'rgba(87,66,54,0.5)' }} />
                                            <div style={{ padding: '0 0 0 28px' }}>
                                                <button onClick={goToBattle} style={{ padding: '14px 36px', borderRadius: 12, background: PRIMARY, border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 0 24px ${PRIMARY}55`, letterSpacing: '-0.01em' }}>
                                                    Join Battle
                                                </button>
                                            </div>
                                        </div>

                                        {/* Animated waveform */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 48, overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
                                                {waveHeights.map((h, i) => (
                                                    <div key={i} style={{ width: 6, height: `${h}%`, background: SECONDARY, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease-in-out', flexShrink: 0 }} />
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', width: 280, fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                <span style={{ color: SECONDARY }}>Waveform Activity</span>
                                                <span>{Math.round(Math.min(100, (featured._count?.entries || 0) / 15))}% Participation</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ── SPONSOR BANNER ── */}
                            {featured?.sponsor && (
                                <section style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px', boxSizing: 'border-box' }}>
                                    <div style={{ ...glass, borderRadius: 20, background: `linear-gradient(to right, ${S_CONT}, ${S_HIGH}, ${S_CONT})`, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '24px 32px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                                                {featured.sponsor.logoUrl
                                                    ? <img src={featured.sponsor.logoUrl} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain', background: '#0a0e18' }} />
                                                    : <div style={{ width: 48, height: 48, borderRadius: 10, background: `${SECONDARY}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Award size={24} color={SECONDARY} /></div>
                                                }
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SECONDARY }}>{featured.sponsor.name}</h3>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Premium Partner</span>
                                                </div>
                                            </div>
                                            <div style={{ width: 1, height: 64, background: DIVIDER, flexShrink: 0 }} />
                                            {featured.sponsor.description && (
                                                <p style={{ margin: 0, flex: 1, fontSize: 14, color: SUB, lineHeight: 1.6, minWidth: 200 }}>{featured.sponsor.description}</p>
                                            )}
                                            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                                                <button style={{ padding: '10px 24px', borderRadius: 10, background: 'transparent', border: `1px solid ${SECONDARY}`, color: SECONDARY, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Learn More</button>
                                                <button style={{ padding: '10px 24px', borderRadius: 10, background: SECONDARY, border: 'none', color: '#001f26', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Shop Deal</button>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ── MAIN BODY: left sidebar + right content ── */}
                            <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                                {/* ── LEFT SIDEBAR ── */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                    {/* Wall of Fame */}
                                    <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Trophy size={16} color="#eab308" />
                                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Wall of Fame</h3>
                                        </div>
                                        {topEntries.length === 0 ? (
                                            <div style={{ padding: 28, textAlign: 'center', color: SUB, fontSize: 13 }}>No past winners yet.</div>
                                        ) : topEntries.map((e: any, i: number) => {
                                            const rankColor = ['#FFD700', '#C0C0C0', '#CD7F32', SUB, SUB][i];
                                            const cover = e.coverUrl || e.track?.coverUrl;
                                            return (
                                                <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < topEntries.length - 1 ? `1px solid ${DIVIDER}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                                    onMouseEnter={e2 => (e2.currentTarget.style.background = 'rgba(38,42,53,0.5)')}
                                                    onMouseLeave={e2 => (e2.currentTarget.style.background = 'transparent')}>
                                                    {/* Cover with hover play */}
                                                    <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: S_HIGH, flexShrink: 0 }} className="wof-cover">
                                                        {cover
                                                            ? <img src={cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={SUB} /></div>}
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                                                            onMouseEnter={ev => { ev.currentTarget.style.opacity = '1'; }} onMouseLeave={ev => { ev.currentTarget.style.opacity = '0'; }}>
                                                            <Play size={20} fill="#fff" color="#fff" />
                                                        </div>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title || e.trackTitle || 'Entry'}</p>
                                                        <p style={{ margin: '3px 0 0', fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.profile?.displayName || e.profile?.username || 'Producer'}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: rankColor }}>#{i + 1}</p>
                                                        <p style={{ margin: '2px 0 0', fontSize: 10, color: SUB, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}><Star size={10} fill={PRIMARY} color={PRIMARY} /> {fmtNum(e.votes || 0)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Community Stats */}
                                    <div style={{ ...glass, borderRadius: 20, padding: 20, borderLeft: `4px solid ${PRIMARY}` }}>
                                        <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Community Stats</h3>
                                        {[
                                            { label: 'Total Battles', value: battles.length + archive.length },
                                            { label: 'Live Now', value: battles.filter((b: any) => b.status === 'active' || b.status === 'open').length },
                                            { label: 'Total Entries', value: [...battles, ...archive].reduce((sum: number, b: any) => sum + (b._count?.entries || 0), 0) },
                                        ].map((s, i) => (
                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '11px 0', borderBottom: i < 2 ? `1px solid ${DIVIDER}` : 'none', fontSize: 14 }}>
                                                <span style={{ color: SUB, fontSize: 13 }}>{s.label}</span>
                                                <span style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>{fmtNum(s.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── RIGHT CONTENT ── */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                                    {/* Upcoming / Active battles grid */}
                                    {upcoming.length > 0 && (
                                        <section>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Upcoming Arenas</h2>
                                                <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600, cursor: 'pointer' }}>View All Schedule</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
                                                {upcoming.map((b: any) => {
                                                    const st = battleStatus(b);
                                                    const prize = formatPrize(b);
                                                    const desc = b.description ? stripHtml(b.description) : '';
                                                    const genres: string[] = (b.genres || []).map((g: any) => typeof g === 'string' ? g : g.name || g.genre?.name).filter(Boolean);
                                                    return (
                                                        <div key={b.id} onClick={goToBattle}
                                                            style={{ ...glass, borderRadius: 20, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)' }}
                                                            onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                            onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
                                                            {/* Image top */}
                                                            <div style={{ height: 128, position: 'relative', background: S_HIGH, flexShrink: 0, overflow: 'hidden' }}>
                                                                {b.bannerUrl
                                                                    ? <img src={b.bannerUrl} alt="" referrerPolicy="no-referrer"
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                                                                        onMouseEnter={ev => (ev.currentTarget.style.transform = 'scale(1.08)')}
                                                                        onMouseLeave={ev => (ev.currentTarget.style.transform = 'scale(1)')} />
                                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1040, #0f2010)' }}>
                                                                        <Trophy size={36} color={`${PRIMARY}55`} />
                                                                    </div>}
                                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,0.65) 0%, transparent 60%)' }} />
                                                                {/* Status badge */}
                                                                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                                                    <span style={{ background: 'rgba(15,19,29,0.85)', backdropFilter: 'blur(8px)', border: `1px solid ${st.color}55`, color: st.color, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</span>
                                                                </div>
                                                            </div>
                                                            {/* Body */}
                                                            <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</h3>
                                                                {/* Genre tags */}
                                                                {genres.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                                                                        {genres.slice(0, 3).map((g: string, gi: number) => (
                                                                            <span key={gi} style={{ padding: '2px 8px', borderRadius: 4, background: gi === 0 ? `${SECONDARY}20` : 'rgba(255,255,255,0.05)', border: gi === 0 ? `1px solid ${SECONDARY}40` : '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: gi === 0 ? SECONDARY : SUB, fontWeight: 600 }}>{g}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {!genres.length && desc && (
                                                                    <p style={{ margin: '0 0 10px', fontSize: 12, color: SUB, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{desc}</p>
                                                                )}
                                                                {/* Footer */}
                                                                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${DIVIDER}`, fontSize: 12 }}>
                                                                    <span style={{ color: SUB, display: 'flex', alignItems: 'center', gap: 5 }}><Users size={12} /> {fmtNum(b._count?.entries || 0)} Entries</span>
                                                                    {prize && <span style={{ color: PRIMARY, fontWeight: 700 }}>{prize}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}

                                    {/* Battle History table */}
                                    {archive.length > 0 && (
                                        <section>
                                            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Battle History</h2>
                                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                                {/* Table header */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 100px 48px', padding: '12px 24px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}` }}>
                                                    <span>Event Name</span>
                                                    <span>Winner</span>
                                                    <span>Entries</span>
                                                    <span />
                                                </div>
                                                {archive.slice(0, 12).map((b: any, i: number) => {
                                                    const winner = (b.entries || [])[0];
                                                    const winnerName = winner?.profile?.displayName || winner?.profile?.username || '—';
                                                    const initials = winnerName !== '—' ? winnerName.slice(0, 2).toUpperCase() : '—';
                                                    const winnerColor = [PRIMARY, SECONDARY, '#A78BFA'][i % 3];
                                                    const prize = formatPrize(b);
                                                    return (
                                                        <div key={b.id} onClick={goToBattle}
                                                            style={{ display: 'grid', gridTemplateColumns: '1fr 180px 100px 48px', padding: '14px 24px', alignItems: 'center', borderBottom: i < Math.min(archive.length, 12) - 1 ? `1px solid ${DIVIDER}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                                            onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(38,42,53,0.4)')}
                                                            onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                                                            {/* Battle name + date */}
                                                            <div style={{ minWidth: 0 }}>
                                                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                                                                {b.submissionEnd && <p style={{ margin: '3px 0 0', fontSize: 11, color: SUB }}>{new Date(b.submissionEnd).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                                                            </div>
                                                            {/* Winner */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${winnerColor}22`, border: `1px solid ${winnerColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: winnerColor }}>{initials}</div>
                                                                <span style={{ fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{winnerName}</span>
                                                            </div>
                                                            {/* Prize or entries */}
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: prize ? PRIMARY : TEXT }}>{prize || fmtNum(b._count?.entries || 0)}</span>
                                                            <ChevronRight size={15} color={SUB} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}

                                    {battles.length === 0 && archive.length === 0 && (
                                        <div style={{ padding: 60, textAlign: 'center', color: SUB, fontSize: 14 }}>No battles found.</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};
