/**
 * Alt F — Single battle detail page (/preview/alt_f_battle)
 * Loads the most active battle and shows hero, rules, entries.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader, BreadcrumbItem } from '../components/altshell/AltHeader';
import { Play, Pause, Clock, Users, Trophy, ChevronDown, ChevronUp, Music, Star, Download, Tag } from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
function bars(seed: string, n = 40) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }

function countdown(end?: string | null) {
    if (!end) return null;
    const ms = new Date(end).getTime() - Date.now();
    if (ms <= 0) return 'Ended';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
}

function statusBadge(battle: any) {
    const now = Date.now();
    const sub = battle.submissionEnd ? new Date(battle.submissionEnd).getTime() : 0;
    const vote = battle.votingEnd ? new Date(battle.votingEnd).getTime() : 0;
    if (sub > now) return { label: 'Under Way', color: '#4ade80' };
    if (vote > now) return { label: 'Voting', color: SECONDARY };
    return { label: 'Ended', color: SUB };
}

export const FrontpageAltFBattle: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const [battle, setBattle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [rulesOpen, setRulesOpen] = useState(true);
    const [joined, setJoined] = useState(false);

    useEffect(() => {
        axios.get('/api/beat-battle/battles').then(r => {
            const list: any[] = Array.isArray(r.data) ? r.data : r.data?.battles || [];
            const active = list.find((b: any) => b.status === 'active' || b.status === 'open' || b.status === 'voting') || list[0];
            if (active?.id) {
                return axios.get(`/api/beat-battle/battles/${active.slug || active.id}`).then(r2 => {
                    setBattle(r2.data);
                    setLoading(false);
                });
            }
            setBattle(active);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const playingId = player.currentTrack?.id;
    const glass: React.CSSProperties = { background: 'rgba(23,27,38,0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${BORDER}` };

    const status = battle ? statusBadge(battle) : null;
    const entries: any[] = (battle?.entries || []).sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
    const rules: string[] = battle?.rulesData?.rules || (battle?.rules ? battle.rules.split('\n').filter(Boolean) : []);
    const samples: any[] = battle?.rulesData?.samples || [];

    const mkTrack = (e: any) => ({ id: e.id, title: e.title || e.trackTitle || 'Entry', artist: e.profile?.displayName || e.profile?.username || 'Unknown', cover: e.coverUrl || e.track?.coverUrl, url: e.url || e.track?.url, profile: e.profile });
    const playEntry = (e: any) => setTrack(mkTrack(e), entries.map(mkTrack));

    const breadcrumb: BreadcrumbItem[] = [
        { label: 'Battles', to: '/preview/alt_f_battles' },
        { label: battle?.title || '…' },
    ];

    const activeEnd = battle?.submissionEnd && new Date(battle.submissionEnd).getTime() > Date.now()
        ? battle.submissionEnd
        : battle?.votingEnd;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Battles" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={breadcrumb} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {loading ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>
                    ) : !battle ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>No battle found.</div>
                    ) : (
                        <>
                            {/* Hero */}
                            <section style={{ position: 'relative', width: '100%', height: 420, overflow: 'hidden' }}>
                                {battle.bannerUrl && <img src={battle.bannerUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />}
                                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, #0f1a2e 0%, #1a0f05 100%)` }} />
                                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG} 0%, rgba(10,14,24,0.4) 60%, transparent 100%)` }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 48px 40px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                                        {status && <span style={{ background: `${status.color}22`, border: `1px solid ${status.color}55`, color: status.color, padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{status.label}</span>}
                                        {activeEnd && <span style={{ color: SUB, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 9999, border: `1px solid ${BORDER}` }}><Clock size={13} /> {countdown(activeEnd)}</span>}
                                    </div>
                                    <h1 style={{ margin: '0 0 12px', fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>{battle.title}</h1>
                                    {battle.description && <p style={{ margin: '0 auto 20px', maxWidth: 640, color: SUB, fontSize: 15, lineHeight: 1.6 }}>{battle.description}</p>}
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24, color: SUB, fontSize: 13 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} /> {fmtNum(battle._count?.entries || entries.length)} entries</span>
                                        {Array.isArray(battle.prizes) && battle.prizes.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={15} color={PRIMARY} /> <span style={{ color: PRIMARY, fontWeight: 700 }}>{battle.prizes.length} prize{battle.prizes.length !== 1 ? 's' : ''}</span></span>}
                                    </div>
                                    {status?.label !== 'Ended' && (
                                        <button onClick={() => setJoined(j => !j)} style={{ padding: '14px 40px', borderRadius: 9999, background: joined ? 'transparent' : PRIMARY, border: joined ? `2px solid ${PRIMARY}` : 'none', color: joined ? PRIMARY : '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: joined ? 'none' : `0 0 24px ${PRIMARY}44`, letterSpacing: '0.02em' }}>
                                            {joined ? 'Entry Submitted ✓' : 'Join Battle'}
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* Body */}
                            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, boxSizing: 'border-box' }}>
                                {/* Left: rules + entries */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Rules */}
                                    {(rules.length > 0 || battle.description) && (
                                        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                            <button onClick={() => setRulesOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', color: TEXT, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Tag size={18} color={PRIMARY} /> Rules & Guidelines</span>
                                                {rulesOpen ? <ChevronUp size={18} color={SUB} /> : <ChevronDown size={18} color={SUB} />}
                                            </button>
                                            {rulesOpen && (
                                                <div style={{ padding: '0 20px 20px' }}>
                                                    {rules.length > 0 ? (
                                                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                            {rules.map((r: string, i: number) => (
                                                                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14, color: SUB, lineHeight: 1.5 }}>
                                                                    <span style={{ color: PRIMARY, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}.</span>
                                                                    {r}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, color: SUB, fontSize: 14, lineHeight: 1.6 }}>{battle.rules || battle.description}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Entries */}
                                    <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Entries</h3>
                                            <span style={{ fontSize: 13, color: SUB }}>{entries.length} submitted</span>
                                        </div>
                                        {entries.length === 0 ? (
                                            <div style={{ padding: 32, textAlign: 'center', color: SUB, fontSize: 14 }}>No entries yet — be the first!</div>
                                        ) : entries.map((e: any, i: number) => {
                                            const on = playingId === e.id;
                                            return (
                                                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < entries.length - 1 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', background: on ? `${PRIMARY}0a` : 'transparent', transition: 'background 0.15s' }} onClick={() => playEntry(e)}>
                                                    <span style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? [PRIMARY, '#C0C0C0', '#CD7F32'][i] : SUB, width: 24, flexShrink: 0, textAlign: 'center', fontStyle: 'italic' }}>{i + 1}</span>
                                                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: S_HIGH, position: 'relative' }}>
                                                        {(e.coverUrl || e.track?.coverUrl)
                                                            ? <img src={e.coverUrl || e.track?.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={SUB} /></div>}
                                                        {on && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pause size={16} fill="#fff" color="#fff" /></div>}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: on ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title || e.trackTitle || 'Untitled Entry'}</p>
                                                        <p style={{ margin: '2px 0 0', fontSize: 12, color: SUB }}>{e.profile?.displayName || e.profile?.username || 'Unknown'}</p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: SUB, flexShrink: 0 }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Play size={13} /> {fmtNum(e.playCount || e.plays)}</span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Star size={13} color={e.votes ? PRIMARY : undefined} fill={e.votes ? PRIMARY : 'none'} /> {e.votes || 0}</span>
                                                    </div>
                                                    <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 1, width: 60 }}>
                                                        {bars(e.id || e.title, 20).map((h, j) => (
                                                            <div key={j} style={{ flex: 1, height: `${h}%`, borderRadius: 9999, background: on ? PRIMARY : 'rgba(255,255,255,0.1)' }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right: sample kit + prizes */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {/* Sample kit */}
                                    {samples.length > 0 && (
                                        <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
                                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Download size={16} color={SECONDARY} /> Sample Kit</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {samples.map((s: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: S_CONT, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                                                        <Music size={16} color={PRIMARY} style={{ flexShrink: 0 }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.filename}</p>
                                                            {s.bpm && <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB }}>{s.bpm} BPM {s.key ? `· ${s.key}` : ''}</p>}
                                                        </div>
                                                        <Play size={14} color={SUB} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prizes */}
                                    {battle.prizes && Array.isArray(battle.prizes) && battle.prizes.length > 0 && (
                                        <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
                                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={16} color={PRIMARY} /> Prizes</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {(battle.prizes as any[]).map((p: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', gap: 12, padding: 12, background: `${PRIMARY}0a`, border: `1px solid ${PRIMARY}22`, borderRadius: 10, alignItems: 'flex-start' }}>
                                                        {p.imageUrl && <img src={p.imageUrl} alt={p.title || p.place} referrerPolicy="no-referrer" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                <span style={{ fontSize: 14 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                                                                <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.place}</span>
                                                            </div>
                                                            {p.title && <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: TEXT }}>{p.title}</p>}
                                                            {p.description && <p style={{ margin: 0, fontSize: 12, color: PRIMARY, fontWeight: 600 }}>{p.description}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
                                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} color={SECONDARY} /> Timeline</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {[
                                                { label: 'Submissions close', date: battle.submissionEnd },
                                                { label: 'Voting ends', date: battle.votingEnd },
                                            ].filter(t => t.date).map((t, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                                    <span style={{ color: SUB }}>{t.label}</span>
                                                    <span style={{ color: TEXT, fontWeight: 600 }}>{new Date(t.date!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};
