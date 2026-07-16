/**
 * Alt F — Arena (/preview/alt_f_arena)
 * Live 1v1 lobby + quick-match + targeted challenge + your active match + activity feed + leaderboard.
 * Reuses the proven ActiveMatchPanel (ready-up → melodics → produce → vote) from HeadToHeadArena.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Swords, Trophy, Crown, Medal, Users, Zap, Target, TrendingUp, Clock, Loader2, Flame,
} from 'lucide-react';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';
import { ActiveMatchPanel, ARENA_CSS, MeData } from './HeadToHeadArena';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const TIERS = [
    { name: 'Unranked', min: 0,    color: '#7A8190' },
    { name: 'Bronze',   min: 1200, color: '#CD7F32' },
    { name: 'Silver',   min: 1300, color: '#C0C0C0' },
    { name: 'Gold',     min: 1450, color: '#FFD700' },
    { name: 'Platinum', min: 1600, color: '#E5E4E2' },
    { name: 'Diamond',  min: 1750, color: '#5DD4FF' },
    { name: 'Master',   min: 1900, color: '#A855F7' },
    { name: 'Legend',   min: 2100, color: '#FF3D7F' },
];
function tierFor(elo: number, played: number) {
    if (played === 0) return TIERS[0];
    return [...TIERS].reverse().find(t => elo >= t.min) || TIERS[0];
}
function fmtWait(s: number) {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
}
function pName(p: any, uid: string) {
    if (p?.anonymous) return 'Mystery Producer';
    return p?.displayName || p?.username || uid.slice(0, 8);
}

interface LobbyEntry { id: string; tier: { name: string; color: string }; productionMinutes: number; genreId: string | null; waitedSeconds: number; isMine: boolean; }
interface LobbySummary { waiting: number; inMatch: number; voting: number; }
interface ActivityEvent { type: 'result' | 'join'; at: string; winner?: string; loser?: string; eloDelta?: number | null; genreName?: string | null; tier?: { name: string; color: string }; productionMinutes?: number; }
interface LeaderRow { rank: number; userId: string; elo: number; wins: number; losses: number; matchesPlayed: number; profile: any; }

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const PROD_OPTIONS = [30, 45, 60, 90, 120];

export const FrontpageAltFArena: React.FC = () => {
    const { player } = usePlayer();

    const [me, setMe] = useState<MeData | null>(null);
    const [loggedIn, setLoggedIn] = useState(true);
    const [meLoaded, setMeLoaded] = useState(false);
    const [lobby, setLobby] = useState<LobbyEntry[]>([]);
    const [summary, setSummary] = useState<LobbySummary>({ waiting: 0, inMatch: 0, voting: 0 });
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [prodMin, setProdMin] = useState(60);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, forceTick] = useState(0);

    // 1s ticker so lobby wait-times count up live
    useEffect(() => { const t = setInterval(() => forceTick(x => x + 1), 1000); return () => clearInterval(t); }, []);

    const reloadMe = useCallback(async () => {
        try {
            const r = await axios.get('/api/head-to-head/me', { withCredentials: true });
            setMe(r.data); setLoggedIn(true);
        } catch (e: any) {
            if (e.response?.status === 401 || e.response?.status === 403) setLoggedIn(false);
        } finally { setMeLoaded(true); }
    }, []);
    const reloadLobby = useCallback(async () => {
        try { const r = await axios.get('/api/head-to-head/lobby'); setLobby(r.data.entries || []); setSummary(r.data.summary || { waiting: 0, inMatch: 0, voting: 0 }); } catch {}
    }, []);
    const reloadActivity = useCallback(async () => {
        try { const r = await axios.get('/api/head-to-head/activity'); setActivity(r.data.events || []); } catch {}
    }, []);

    useEffect(() => {
        reloadMe(); reloadLobby(); reloadActivity();
        axios.get('/api/head-to-head/settings').then(r => { setEnabled(r.data?.enabled ?? null); if (r.data?.defaultProductionMinutes) setProdMin(r.data.defaultProductionMinutes); }).catch(() => {});
        axios.get('/api/head-to-head/leaderboard').then(r => setLeaderboard(r.data || [])).catch(() => {});
    }, [reloadMe, reloadLobby, reloadActivity]);

    // Adaptive poll: fast while actively waiting/matching, slow otherwise.
    useEffect(() => {
        const fast = !!me?.activeMatch && ['queued', 'ready_check', 'melodics_vote'].includes(me.activeMatch.status);
        const t = setInterval(() => { reloadMe(); reloadLobby(); }, fast ? 3000 : 8000);
        const a = setInterval(reloadActivity, 12000);
        return () => { clearInterval(t); clearInterval(a); };
    }, [reloadMe, reloadLobby, reloadActivity, me?.activeMatch?.status]);

    const quickMatch = async () => {
        setBusy(true); setError(null);
        try { await axios.post('/api/head-to-head/queue', { productionMinutes: prodMin }, { withCredentials: true }); }
        catch (e: any) { setError(e.response?.data?.error || 'Failed to join'); }
        setBusy(false); await reloadMe(); await reloadLobby();
    };
    const leaveQueue = async () => {
        setBusy(true);
        try { await axios.post('/api/head-to-head/queue/leave', {}, { withCredentials: true }); } catch {}
        setBusy(false); await reloadMe(); await reloadLobby();
    };
    const challenge = async (targetMatchId: string) => {
        setBusy(true); setError(null);
        try { await axios.post('/api/head-to-head/challenge', { targetMatchId }, { withCredentials: true }); }
        catch (e: any) { setError(e.response?.data?.error || 'Could not challenge'); }
        setBusy(false); await reloadMe(); await reloadLobby();
    };

    const inActiveMatch = !!me?.activeMatch;
    const myTier = me ? tierFor(me.globalRating.elo, me.globalRating.matchesPlayed) : TIERS[0];
    const winRate = me && me.globalRating.matchesPlayed > 0 ? Math.round((me.globalRating.wins / me.globalRating.matchesPlayed) * 100) : 0;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Arena" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Arena' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {/* ── HERO ── */}
                    <section style={{ position: 'relative', minHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0d18 0%, #12102a 45%, #0f131d 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(255,61,127,0.12) 0%, transparent 70%)' }} />
                        <div style={{ position: 'absolute', right: 60, top: 30, opacity: 0.05, transform: 'rotate(-20deg)' }}><Swords size={240} color="#fff" /></div>
                        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', padding: '36px 32px', width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: enabled === false ? 'rgba(154,163,178,0.12)' : 'rgba(255,61,127,0.15)', border: `1px solid ${enabled === false ? 'rgba(154,163,178,0.25)' : 'rgba(255,61,127,0.35)'}`, color: enabled === false ? SUB : '#FF3D7F', padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: enabled === false ? SUB : '#FF3D7F', display: 'inline-block' }} />
                                    {enabled === false ? 'Arena Offline' : 'Arena Live'}
                                </span>
                            </div>
                            <h1 style={{ margin: '0 0 10px', fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>Arena</h1>
                            <p style={{ margin: 0, fontSize: 16, color: SUB, fontWeight: 500, maxWidth: 460 }}>
                                1v1 producer battles. Same sample pack. Blind community vote. Your Elo on the line.
                            </p>
                            {/* Live counters */}
                            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                                {[
                                    { label: 'In the lobby', value: summary.waiting, color: SECONDARY, icon: Users },
                                    { label: 'Battling now', value: summary.inMatch, color: PRIMARY, icon: Swords },
                                    { label: 'Being judged', value: summary.voting, color: TERTIARY, icon: Trophy },
                                ].map(s => {
                                    const Icon = s.icon;
                                    return (
                                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,19,29,0.7)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 16px' }}>
                                            <Icon size={16} color={s.color} />
                                            <div>
                                                <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                                <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{s.label}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 60px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, boxSizing: 'border-box' }}>
                        {/* ── LEFT: play area ── */}
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {!meLoaded ? (
                                <div style={{ ...glass, borderRadius: 18, padding: 48, textAlign: 'center', color: SUB }}><Loader2 size={22} className="h2h-spin" /></div>
                            ) : !loggedIn ? (
                                <div style={{ ...glass, borderRadius: 18, padding: '40px 24px', textAlign: 'center' }}>
                                    <Swords size={38} color={SECONDARY} style={{ opacity: 0.8, marginBottom: 12 }} />
                                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Join the Arena</div>
                                    <p style={{ margin: '0 auto 20px', color: SUB, fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>Sign in to enter the 1v1 queue, battle other producers, and climb the Elo ladder.</p>
                                    <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${TERTIARY}, ${PRIMARY})`, color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                                        <Swords size={16} /> Sign in to compete
                                    </a>
                                </div>
                            ) : inActiveMatch ? (
                                <div>
                                    <div style={{ marginBottom: 4 }}>{ARENA_CSS && <style>{ARENA_CSS}</style>}</div>
                                    <ActiveMatchPanel match={me!.activeMatch!} myUserId={me!.userId} onChange={reloadMe} onLeave={leaveQueue} />
                                </div>
                            ) : (
                                <>
                                    {/* Quick match */}
                                    <div style={{ ...glass, borderRadius: 18, padding: '22px 24px', background: `linear-gradient(135deg, rgba(255,61,127,0.10), rgba(76,215,246,0.05))`, border: '1px solid rgba(255,61,127,0.18)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                            <div>
                                                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 4 }}>Ready to battle?</div>
                                                <p style={{ margin: 0, fontSize: 13, color: SUB }}>Jump in and we'll pair you with a waiting producer — or challenge one below.</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <select value={prodMin} onChange={e => setProdMin(Number(e.target.value))} disabled={busy}
                                                    style={{ padding: '10px 12px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontFamily: FONT, outline: 'none' }}>
                                                    {PROD_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                                                </select>
                                                <button onClick={quickMatch} disabled={busy || enabled === false}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, background: enabled === false ? S_HIGH : `linear-gradient(135deg, #FF3D7F, #A855F7)`, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy || enabled === false ? 'not-allowed' : 'pointer', opacity: busy || enabled === false ? 0.6 : 1, fontFamily: FONT }}>
                                                    {busy ? <Loader2 size={16} className="h2h-spin" /> : <Zap size={16} />} Find a match
                                                </button>
                                            </div>
                                        </div>
                                        {error && <p style={{ margin: '12px 0 0', color: TERTIARY, fontSize: 13 }}>{error}</p>}
                                    </div>

                                    {/* Live lobby */}
                                    <div style={{ ...glass, borderRadius: 18, overflow: 'hidden' }}>
                                        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Users size={15} color={SECONDARY} />
                                            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Live Lobby</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB }}>{summary.waiting} waiting</span>
                                        </div>
                                        {lobby.length === 0 ? (
                                            <div style={{ padding: '36px 20px', textAlign: 'center', color: SUB, fontSize: 13 }}>
                                                No one's waiting yet — <button onClick={quickMatch} disabled={busy || enabled === false} style={{ background: 'none', border: 'none', color: SECONDARY, cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: 13 }}>be the first</button>.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {lobby.map(en => (
                                                    <div key={en.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${DIVIDER}` }}>
                                                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${en.tier.color}18`, border: `1px solid ${en.tier.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Swords size={16} color={en.tier.color} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                                                                {en.isMine ? 'You' : 'Mystery Producer'}
                                                                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: en.tier.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{en.tier.name}</span>
                                                            </div>
                                                            <div style={{ fontSize: 11, color: SUB, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span>{en.productionMinutes} min</span>
                                                                <span>·</span>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> waiting {fmtWait(en.waitedSeconds)}</span>
                                                            </div>
                                                        </div>
                                                        {en.isMine ? (
                                                            <button onClick={leaveQueue} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${TERTIARY}55`, color: TERTIARY, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Leave</button>
                                                        ) : (
                                                            <button onClick={() => challenge(en.id)} disabled={busy || enabled === false} style={{ padding: '7px 16px', borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, ${TERTIARY})`, border: 'none', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 12, fontWeight: 800 }}>Challenge</button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Player stats */}
                                    {me && (
                                        <div style={{ ...glass, borderRadius: 18, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                                            <div style={{ width: 64, height: 64, borderRadius: 14, background: `linear-gradient(135deg, ${myTier.color}cc, ${myTier.color}55)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Trophy size={22} color="#fff" />
                                                <div style={{ fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: '0.08em', marginTop: 2 }}>{myTier.name.toUpperCase()}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 10, color: SUB, letterSpacing: '0.12em', fontWeight: 700 }}>YOUR RATING</div>
                                                <div style={{ fontSize: 38, fontWeight: 900, color: myTier.color, lineHeight: 1 }}>{me.globalRating.elo}</div>
                                            </div>
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
                                                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: PRIMARY }}>{me.globalRating.wins}</div><div style={{ fontSize: 10, color: SUB }}>WINS</div></div>
                                                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: TERTIARY }}>{me.globalRating.losses}</div><div style={{ fontSize: 10, color: SUB }}>LOSSES</div></div>
                                                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: SECONDARY }}>{winRate}%</div><div style={{ fontSize: 10, color: SUB }}>WIN RATE</div></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Activity feed */}
                            <div style={{ ...glass, borderRadius: 18, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Flame size={15} color={PRIMARY} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Live Activity</span>
                                </div>
                                {activity.length === 0 ? (
                                    <div style={{ padding: '28px 20px', textAlign: 'center', color: SUB, fontSize: 13 }}>Quiet in here… start a battle.</div>
                                ) : (
                                    <div>
                                        {activity.map((ev, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: i < activity.length - 1 ? `1px solid ${DIVIDER}` : 'none', fontSize: 13 }}>
                                                {ev.type === 'result' ? (
                                                    <>
                                                        <Trophy size={14} color="#FFD700" style={{ flexShrink: 0 }} />
                                                        <span style={{ color: TEXT }}><strong>{ev.winner}</strong> <span style={{ color: SUB }}>beat</span> {ev.loser}</span>
                                                        {ev.eloDelta != null && <span style={{ marginLeft: 'auto', color: PRIMARY, fontWeight: 700, flexShrink: 0 }}>+{ev.eloDelta}</span>}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Target size={14} color={ev.tier?.color || SECONDARY} style={{ flexShrink: 0 }} />
                                                        <span style={{ color: SUB }}>A <span style={{ color: ev.tier?.color, fontWeight: 700 }}>{ev.tier?.name}</span> producer joined the lobby</span>
                                                        <span style={{ marginLeft: 'auto', color: SUB, fontSize: 11, flexShrink: 0 }}>{ev.productionMinutes}m</span>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── RIGHT: leaderboard ── */}
                        <div>
                            <div style={{ ...glass, borderRadius: 18, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Crown size={15} color="#FFD700" />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Leaderboard</span>
                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB }}>{leaderboard.length}</span>
                                </div>
                                {leaderboard.length === 0 ? (
                                    <div style={{ padding: '32px 20px', textAlign: 'center', color: SUB, fontSize: 13 }}>No ranked players yet.</div>
                                ) : (
                                    <div>
                                        {leaderboard.slice(0, 15).map((r, i) => {
                                            const t = tierFor(r.elo, r.matchesPlayed);
                                            const mc = i < 3 ? MEDAL_COLORS[i] : null;
                                            return (
                                                <div key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: i < Math.min(15, leaderboard.length) - 1 ? `1px solid ${DIVIDER}` : 'none' }}>
                                                    <span style={{ width: 20, textAlign: 'center', fontSize: 12, fontWeight: 800, color: mc || SUB, flexShrink: 0 }}>{r.rank}</span>
                                                    <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${(mc || t.color)}55`, background: S_HIGH }}>
                                                        {r.profile?.avatar ? <img src={r.profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: t.color }}>{pName(r.profile, r.userId).slice(0, 2).toUpperCase()}</div>}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pName(r.profile, r.userId)}</div>
                                                        <div style={{ fontSize: 10, color: SUB }}>{r.wins}W {r.losses}L</div>
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.elo}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Tier ladder */}
                            <div style={{ ...glass, borderRadius: 18, overflow: 'hidden', marginTop: 20 }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={15} color={PRIMARY} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Tiers</span>
                                </div>
                                <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {TIERS.slice(1).map(t => (
                                        <div key={t.name} style={{ background: `${t.color}12`, border: `1px solid ${t.color}30`, borderRadius: 10, padding: '8px 12px' }}>
                                            <div style={{ fontSize: 10, fontWeight: 800, color: t.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.name}</div>
                                            <div style={{ fontSize: 15, fontWeight: 900, color: TEXT }}>{t.min}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } } .h2h-spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    );
};

export default FrontpageAltFArena;
