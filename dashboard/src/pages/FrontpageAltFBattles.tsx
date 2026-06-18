/**
 * Alt F — Battles overview page (/preview/alt_f_battles)
 * Featured hero + grid + wall of fame + history.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { Trophy, Users, Clock, Play, Pause, Star, ChevronRight, Flame, Music, Plus } from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
function bars(seed: string, n = 20) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }

function countdown(end?: string | null) {
    if (!end) return null;
    const ms = new Date(end).getTime() - Date.now();
    if (ms <= 0) return 'Ended';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function battleStatus(b: any) {
    const now = Date.now();
    const sub = b.submissionEnd ? new Date(b.submissionEnd).getTime() : 0;
    const vote = b.votingEnd ? new Date(b.votingEnd).getTime() : 0;
    if (sub > now) return { label: 'Live', color: '#4ade80' };
    if (vote > now) return { label: 'Voting', color: SECONDARY };
    return { label: 'Ended', color: SUB };
}

export const FrontpageAltFBattles: React.FC = () => {
    const navigate = useNavigate();
    const { player } = usePlayer();
    const [battles, setBattles] = useState<any[]>([]);
    const [archive, setArchive] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
    const topEntries: any[] = archive.flatMap((b: any) => (b.entries || []).slice(0, 1).map((e: any) => ({ ...e, battleTitle: b.title }))).slice(0, 5);

    const glass: React.CSSProperties = { background: 'rgba(23,27,38,0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${BORDER}` };

    const goToBattle = (b: any) => navigate(`/preview/alt_f_battle`);

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
                            {/* Featured hero */}
                            {featured && (
                                <section style={{ position: 'relative', width: '100%', height: 440, overflow: 'hidden' }}>
                                    {featured.bannerUrl && <img src={featured.bannerUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.28 }} />}
                                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, #0e1a30 0%, #1a0e05 100%)` }} />
                                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG} 0%, transparent 60%)` }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 60px 44px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                                            <span style={{ background: '#4ade8022', border: '1px solid #4ade8055', color: '#4ade80', padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Flame size={12} fill="#4ade80" /> Live Now
                                            </span>
                                            {featured.submissionEnd && (
                                                <span style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: SUB, padding: '4px 14px', borderRadius: 9999, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Clock size={12} /> {countdown(featured.submissionEnd)} to submit
                                                </span>
                                            )}
                                        </div>
                                        <h1 style={{ margin: '0 0 10px', fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>{featured.title}</h1>
                                        {featured.description && <p style={{ margin: '0 auto 20px', maxWidth: 600, color: SUB, fontSize: 15, lineHeight: 1.6 }}>{featured.description.slice(0, 180)}{featured.description.length > 180 ? '…' : ''}</p>}
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 28, color: SUB, fontSize: 14 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Users size={15} /> {fmtNum(featured._count?.entries || 0)} entries</span>
                                            {featured.prizes && <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Trophy size={15} color={PRIMARY} /> <span style={{ color: PRIMARY, fontWeight: 700 }}>{featured.prizes}</span></span>}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                                            <button onClick={() => goToBattle(featured)} style={{ padding: '14px 40px', borderRadius: 9999, background: PRIMARY, border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 0 28px ${PRIMARY}44`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Plus size={18} /> Enter Battle
                                            </button>
                                            <button onClick={() => goToBattle(featured)} style={{ padding: '14px 32px', borderRadius: 9999, background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}`, color: TEXT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Main body */}
                            <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>
                                {/* Left: Wall of fame + stats */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Trophy size={16} color={PRIMARY} />
                                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Wall of Fame</h3>
                                        </div>
                                        {topEntries.length === 0 ? (
                                            <div style={{ padding: 24, textAlign: 'center', color: SUB, fontSize: 13 }}>No past winners yet.</div>
                                        ) : topEntries.map((e: any, i: number) => (
                                            <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < topEntries.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                                <span style={{ fontSize: 16, fontWeight: 900, color: ['#FFD700', '#C0C0C0', '#CD7F32', SUB, SUB][i], fontStyle: 'italic', width: 20, textAlign: 'center' }}>{i + 1}</span>
                                                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                                    {(e.coverUrl || e.track?.coverUrl)
                                                        ? <img src={e.coverUrl || e.track?.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={SUB} /></div>}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title || e.trackTitle || 'Entry'}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.battleTitle}</p>
                                                </div>
                                                <span style={{ fontSize: 11, color: PRIMARY, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}><Star size={11} fill={PRIMARY} /> {e.votes || 0}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Battle stats */}
                                    <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
                                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Community Stats</h3>
                                        {[
                                            { label: 'Total Battles', value: battles.length + archive.length },
                                            { label: 'Active Now', value: battles.filter((b: any) => b.status === 'active' || b.status === 'open').length },
                                            { label: 'Total Entries', value: [...battles, ...archive].reduce((sum: number, b: any) => sum + (b._count?.entries || 0), 0) },
                                        ].map((s, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none', fontSize: 14 }}>
                                                <span style={{ color: SUB }}>{s.label}</span>
                                                <span style={{ color: TEXT, fontWeight: 700 }}>{fmtNum(s.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right: Upcoming + history */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Upcoming / active grid */}
                                    {upcoming.length > 0 && (
                                        <div>
                                            <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700 }}>All Battles</h2>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                                {upcoming.map((b: any) => {
                                                    const st = battleStatus(b);
                                                    const end = b.submissionEnd && new Date(b.submissionEnd).getTime() > Date.now() ? b.submissionEnd : b.votingEnd;
                                                    return (
                                                        <div key={b.id} onClick={() => goToBattle(b)} style={{ ...glass, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s', display: 'flex', flexDirection: 'column' }}>
                                                            <div style={{ height: 140, position: 'relative', background: S_HIGH, flexShrink: 0 }}>
                                                                {b.bannerUrl
                                                                    ? <img src={b.bannerUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1040, #0f2010)' }}><Trophy size={40} color={`${PRIMARY}66`} /></div>}
                                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,14,24,0.7) 0%, transparent 60%)' }} />
                                                                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                                                    <span style={{ background: `${st.color}22`, border: `1px solid ${st.color}55`, color: st.color, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{st.label}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ padding: 16, flex: 1 }}>
                                                                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</h3>
                                                                {b.description && <p style={{ margin: '0 0 12px', fontSize: 12, color: SUB, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.description}</p>}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: SUB }}>
                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {b._count?.entries || 0}</span>
                                                                    {end && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {countdown(end)}</span>}
                                                                    {b.prizes && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: PRIMARY, fontWeight: 700 }}><Trophy size={12} color={PRIMARY} /></span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* History table */}
                                    {archive.length > 0 && (
                                        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Battle History</h3>
                                                <span style={{ fontSize: 12, color: SUB }}>{archive.length} completed</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 40px', gap: 16, padding: '10px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${BORDER}` }}>
                                                <span>Battle</span><span>Winner</span><span>Entries</span><span />
                                            </div>
                                            {archive.slice(0, 10).map((b: any, i: number) => {
                                                const winner = (b.entries || [])[0];
                                                return (
                                                    <div key={b.id} onClick={() => goToBattle(b)} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 40px', gap: 16, padding: '12px 20px', alignItems: 'center', borderBottom: i < Math.min(archive.length, 10) - 1 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
                                                        <div style={{ minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                                                            {b.submissionEnd && <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB }}>{new Date(b.submissionEnd).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</p>}
                                                        </div>
                                                        <span style={{ fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{winner?.profile?.displayName || winner?.profile?.username || '—'}</span>
                                                        <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{b._count?.entries || 0}</span>
                                                        <ChevronRight size={14} color={SUB} />
                                                    </div>
                                                );
                                            })}
                                        </div>
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
