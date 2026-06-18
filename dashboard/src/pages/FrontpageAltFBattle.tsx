/**
 * Alt F — Single battle detail page (/preview/alt_f_battle)
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader, BreadcrumbItem } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Play, Pause, Clock, Users, Trophy, Music, Star, Download,
    Tag, ExternalLink, CheckCircle, ChevronRight, Zap,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
function bars(seed: string, n = 30) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

function countdown(end?: string | null) {
    if (!end) return null;
    const ms = new Date(end).getTime() - Date.now();
    if (ms <= 0) return 'Ended';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (d > 0) return `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusBadge(battle: any) {
    const now = Date.now();
    const sub = battle.submissionEnd ? new Date(battle.submissionEnd).getTime() : 0;
    const vote = battle.votingEnd ? new Date(battle.votingEnd).getTime() : 0;
    if (sub > now) return { label: 'Under Way', color: '#4ade80' };
    if (vote > now) return { label: 'Voting', color: SECONDARY };
    return { label: 'Ended', color: SUB };
}

const DIVIDER = 'rgba(87,66,54,0.25)';
const glass: React.CSSProperties = { background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' };

export const FrontpageAltFBattle: React.FC = () => {
    const { player, setTrack } = usePlayer();
    const [battle, setBattle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joined, setJoined] = useState(false);
    const [countdownStr, setCountdownStr] = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/beat-battle/battles/baby-audio-presents').then(r => {
            setBattle(r.data);
            setLoading(false);
        }).catch(() => {
            axios.get('/api/beat-battle/battles').then(r => {
                const list: any[] = Array.isArray(r.data) ? r.data : r.data?.battles || [];
                const active = list.find((b: any) => b.status === 'active' || b.status === 'open' || b.status === 'voting') || list[0];
                if (active?.id) {
                    return axios.get(`/api/beat-battle/battles/${active.slug || active.id}`).then(r2 => { setBattle(r2.data); setLoading(false); });
                }
                setBattle(active); setLoading(false);
            }).catch(() => setLoading(false));
        });
    }, []);

    // Live countdown ticker
    useEffect(() => {
        if (!battle) return;
        const end = battle.submissionEnd && new Date(battle.submissionEnd).getTime() > Date.now()
            ? battle.submissionEnd
            : battle.votingEnd;
        if (!end) return;
        const tick = () => setCountdownStr(countdown(end));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [battle]);

    const playingId = player.currentTrack?.id;
    const status = battle ? statusBadge(battle) : null;
    const entries: any[] = (battle?.entries || []).sort((a: any, b: any) => (b.voteCount || 0) - (a.voteCount || 0));
    const rulesArr: any[] = Array.isArray(battle?.rulesData) ? battle.rulesData : [];
    const rules: string[] = rulesArr.length > 0
        ? rulesArr.map((r: any) => r.text).filter(Boolean)
        : (battle?.rules ? battle.rules.split('\n').filter(Boolean) : []);
    const samples: any[] = rulesArr.flatMap((r: any) => r.samples || []).filter(Boolean);
    const sponsor = battle?.sponsor;
    const shortDescription = battle?.miniDescription || '';
    const fullDescription = battle?.description ? stripHtml(battle.description) : shortDescription;

    const mkTrack = (e: any) => ({ id: e.track?.id || e.id, title: e.track?.title || 'Entry', artist: e.track?.profile?.displayName || e.track?.profile?.username || e.track?.artist || 'Unknown', cover: e.track?.coverUrl, url: e.track?.url, profile: e.track?.profile });
    const playEntry = (e: any) => setTrack(mkTrack(e), entries.map(mkTrack));

    const breadcrumb: BreadcrumbItem[] = [
        { label: 'Battles', to: '/preview/alt_f_battles' },
        { label: battle?.title || '…' },
    ];

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Battles" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={breadcrumb} />
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {loading ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>
                    ) : !battle ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>No battle found.</div>
                    ) : (
                        <>
                            {/* ── HERO ── */}
                            <section style={{ position: 'relative', width: '100%', minHeight: 380, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                {/* Background: banner → release cover → gradient fallback */}
                                {(battle.bannerUrl || battle.release?.coverUrl) ? (
                                    <img src={battle.bannerUrl || battle.release.coverUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
                                ) : (
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a2242 0%, #2a1040 50%, #1a0f10 100%)' }} />
                                )}
                                {/* Gradient overlay so text pops */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,15,25,0.98) 0%, rgba(11,15,25,0.55) 50%, rgba(11,15,25,0.1) 100%)' }} />
                                {/* Content row: text left, join button right */}
                                <div style={{ position: 'relative', zIndex: 2, padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                            {status && <span style={{ background: `${status.color}22`, border: `1px solid ${status.color}55`, color: status.color, padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{status.label}</span>}
                                            {countdownStr && status?.label !== 'Ended' && (
                                                <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Clock size={14} /> Ends in {countdownStr}
                                                </span>
                                            )}
                                        </div>
                                        <h1 style={{ margin: '0 0 10px', fontSize: 46, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05 }}>{battle.title}</h1>
                                        {shortDescription && <p style={{ margin: '0 0 18px', maxWidth: 580, color: 'rgba(223,226,241,0.75)', fontSize: 15, lineHeight: 1.65 }}>{shortDescription}</p>}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: SUB, fontSize: 13 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> {fmtNum(battle._count?.entries || entries.length)} entries</span>
                                            {Array.isArray(battle.prizes) && battle.prizes.length > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} color={PRIMARY} /> <span style={{ color: PRIMARY, fontWeight: 700 }}>{battle.prizes.length} prize{battle.prizes.length !== 1 ? 's' : ''}</span></span>
                                            )}
                                            {sponsor && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} color={SECONDARY} /> <span style={{ color: SECONDARY }}>Sponsored by {sponsor.name}</span></span>}
                                        </div>
                                    </div>
                                    {status?.label !== 'Ended' && (
                                        <button onClick={() => setJoined(j => !j)} style={{ flexShrink: 0, padding: '14px 40px', borderRadius: 14, background: joined ? 'transparent' : PRIMARY, border: joined ? `2px solid ${PRIMARY}` : 'none', color: joined ? PRIMARY : BG, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: joined ? 'none' : `0 0 32px ${PRIMARY}55`, letterSpacing: '0.02em', transition: 'all 0.2s' }}>
                                            {joined ? 'Entry Submitted ✓' : 'Join Battle'}
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* ── BODY GRID ── */}
                            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, boxSizing: 'border-box' }}>

                                {/* ── LEFT SIDEBAR (280px): prizes + timeline + podium ── */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                    {/* Prizes */}
                                    {Array.isArray(battle.prizes) && battle.prizes.length > 0 && (
                                        <div style={{ ...glass, borderRadius: 20, padding: '20px 20px', overflow: 'hidden', position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: -32, right: -32, width: 100, height: 100, background: `${PRIMARY}10`, borderRadius: '50%', filter: 'blur(24px)' }} />
                                            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Trophy size={16} color={PRIMARY} /> Battle Prizes
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                                {(battle.prizes as any[]).map((p: any, i: number) => {
                                                    const placeColor = i === 0 ? PRIMARY : i === 1 ? SECONDARY : TERTIARY;
                                                    return (
                                                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                            <div style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${placeColor}44`, background: `${placeColor}0a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 800, color: placeColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.place || `${i + 1}${['st','nd','rd'][i] || 'th'} Place`}</p>
                                                                {p.title && <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: TEXT }}>{p.title}</p>}
                                                                {p.description && <p style={{ margin: 0, fontSize: 11, color: SUB, lineHeight: 1.4 }}>{p.description}</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div style={{ ...glass, borderRadius: 20, padding: '20px 20px' }}>
                                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Clock size={16} color={SECONDARY} /> Timeline
                                        </h3>
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

                                    {/* Top entries podium */}
                                    {entries.length >= 2 && (
                                        <div style={{ ...glass, borderRadius: 20, padding: '20px 20px' }}>
                                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
                                                {status?.label === 'Ended' ? 'Final Podium' : 'Leading Right Now'}
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {entries.slice(0, 3).map((e: any, i: number) => {
                                                    const placeColor = i === 0 ? PRIMARY : i === 1 ? SECONDARY : TERTIARY;
                                                    const avatar = e.track?.profile?.avatar;
                                                    const userId = e.track?.profile?.userId;
                                                    return (
                                                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: S_HIGH, borderRadius: 12, position: 'relative', overflow: 'hidden', borderLeft: `3px solid ${placeColor}` }}>
                                                            <span style={{ position: 'absolute', right: 8, bottom: -4, fontSize: 28, fontWeight: 900, color: `${placeColor}18`, fontStyle: 'italic', lineHeight: 1 }}>0{i + 1}</span>
                                                            <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: S_CONT, flexShrink: 0 }}>
                                                                {avatar && userId
                                                                    ? <img src={`https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={SUB} /></div>}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.track?.profile?.displayName || e.track?.profile?.username || 'Unknown'}</p>
                                                                <p style={{ margin: '1px 0 0', fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Track: {e.track?.title || 'Untitled'}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <button style={{ width: '100%', marginTop: 14, padding: '8px 0', background: 'none', border: 'none', color: SUB, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                View Full Leaderboard <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    )}

                                </div>

                                {/* ── RIGHT COLUMN (1fr): sponsor + challenge + samples + entries ── */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                    {/* Sponsor card */}
                                    {sponsor && (
                                        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', border: `1px solid ${PRIMARY}22` }}>
                                            {sponsor.logoUrl && (
                                                <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                                                    <img src={sponsor.logoUrl} alt={sponsor.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,31,42,0.95) 0%, transparent 60%)' }} />
                                                    <div style={{ position: 'absolute', top: 12, right: 12, background: `${PRIMARY}22`, backdropFilter: 'blur(8px)', padding: '3px 10px', borderRadius: 9999, border: `1px solid ${PRIMARY}44` }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Official Sponsor</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div style={{ padding: '20px 24px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <h3 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color: PRIMARY, letterSpacing: '-0.01em' }}>{sponsor.name.toUpperCase()}</h3>
                                                        {sponsor.description && <p style={{ margin: '0 0 16px', fontSize: 14, color: SUB, lineHeight: 1.65 }}>{sponsor.description}</p>}
                                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                            {sponsor.websiteUrl && (
                                                                <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, background: PRIMARY, color: BG, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                                                                    Visit Website <ExternalLink size={13} />
                                                                </a>
                                                            )}
                                                            {sponsor.links?.map((l: any, i: number) => (
                                                                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: `1px solid ${BORDER}`, color: TEXT, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                                                                    {l.label}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Challenge + Rules */}
                                    {(fullDescription || rules.length > 0) && (
                                        <section>
                                            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>The Challenge</h2>
                                            <div style={{ ...glass, borderRadius: 20, padding: '20px 24px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: rules.length > 0 && fullDescription ? '1fr 1fr' : '1fr', gap: 28 }}>
                                                    {fullDescription && (
                                                        <div>
                                                            <p style={{ margin: 0, fontSize: 14, color: SUB, lineHeight: 1.7 }}>{fullDescription}</p>
                                                        </div>
                                                    )}
                                                    {rules.length > 0 && (
                                                        <div>
                                                            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB }}>Rules</h3>
                                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                                {rules.map((r: string, i: number) => (
                                                                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                                                                        <CheckCircle size={15} color={SECONDARY} style={{ flexShrink: 0, marginTop: 2 }} />
                                                                        {r}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {/* Sample kit */}
                                    {samples.length > 0 && (
                                        <section>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Download size={18} color={SECONDARY} />
                                                    {battle.release?.name || 'Sample Kit'}
                                                    <span style={{ fontWeight: 400, fontSize: 13, color: SUB }}>({samples.length} files)</span>
                                                </h2>
                                                {battle.release && (
                                                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: PRIMARY, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                                        <Download size={14} /> Download Full Pack
                                                    </button>
                                                )}
                                            </div>
                                        <div style={{ ...glass, borderRadius: 20, padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {samples.map((s: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(38,42,53,0.3)', borderRadius: 12, border: `1px solid ${DIVIDER}`, transition: 'background 0.15s', cursor: 'default' }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Play size={14} color={PRIMARY} style={{ marginLeft: 2 }} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.filename}</p>
                                                            {s.bpm && <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB }}>{s.bpm} BPM{s.key ? ` · ${s.key}` : ''}</p>}
                                                        </div>
                                                        <Download size={14} color={SUB} style={{ flexShrink: 0 }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        </section>
                                    )}

                                    {/* Entries / Submissions */}
                                    <section>
                                    <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Current Submissions</h2>
                                    <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                        <div style={{ padding: '12px 20px', background: 'rgba(38,42,53,0.5)', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, color: SUB }}>{fmtNum(battle._count?.entries || entries.length)} entries</span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <span style={{ padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: S_HIGH, border: `1px solid ${BORDER}`, color: TEXT }}>Hottest</span>
                                                <span style={{ padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: 'transparent', border: `1px solid ${BORDER}`, color: SUB, cursor: 'pointer' }}>Newest</span>
                                            </div>
                                        </div>
                                        {entries.length === 0 ? (
                                            <div style={{ padding: 40, textAlign: 'center', color: SUB, fontSize: 14 }}>No entries yet — be the first!</div>
                                        ) : entries.map((e: any, i: number) => {
                                            const on = playingId === (e.track?.id || e.id);
                                            const trackBars = bars(e.id || e.track?.title || String(i), 28);
                                            const cover = e.track?.coverUrl;
                                            const title = e.track?.title || 'Untitled Entry';
                                            const artist = e.track?.profile?.displayName || e.track?.profile?.username || e.track?.artist || 'Unknown';
                                            return (
                                                <div key={e.id} style={{ padding: '16px 20px', borderBottom: i < entries.length - 1 ? `1px solid ${DIVIDER}` : 'none', background: on ? `${PRIMARY}08` : 'transparent', transition: 'background 0.15s' }}
                                                    onMouseEnter={ev => { if (!on) ev.currentTarget.style.background = 'rgba(38,42,53,0.4)'; }}
                                                    onMouseLeave={ev => { ev.currentTarget.style.background = on ? `${PRIMARY}08` : 'transparent'; }}>
                                                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                        {/* Cover + play */}
                                                        <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: S_HIGH, cursor: 'pointer' }} onClick={() => playEntry(e)}>
                                                            {cover
                                                                ? <img src={cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={22} color={SUB} /></div>}
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: on ? 1 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }} className="entry-hover-overlay">
                                                                {on ? <Pause size={22} fill="#fff" color="#fff" /> : <Play size={22} fill="#fff" color="#fff" />}
                                                            </div>
                                                        </div>

                                                        {/* Info + waveform */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: on ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                                                                    <p style={{ margin: '2px 0 0', fontSize: 12, color: SECONDARY }}>by {artist}</p>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                                                                    <div style={{ textAlign: 'center' }}>
                                                                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PRIMARY }}>{fmtNum(e.voteCount)}</p>
                                                                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Votes</p>
                                                                    </div>
                                                                    <button style={{ width: 40, height: 40, borderRadius: 10, background: PRIMARY, color: BG, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: `0 4px 12px ${PRIMARY}44` }}>
                                                                        <Star size={17} fill={BG} color={BG} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {/* Mini waveform */}
                                                            <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: '1.5px' }}>
                                                                {trackBars.map((h, j) => (
                                                                    <div key={j} style={{ flex: 1, height: `${h}%`, borderRadius: 9999, background: on ? (j / trackBars.length < 0.4 ? PRIMARY : `${PRIMARY}44`) : 'rgba(255,255,255,0.1)' }} />
                                                                ))}
                                                                {on && <div style={{ position: 'relative', marginLeft: -2 }}><div style={{ width: 2, height: 32, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 6px rgba(255,255,255,0.8)', borderRadius: 9999 }} /></div>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    </section>
                                </div>

                            </div>
                        </>
                    )}
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
