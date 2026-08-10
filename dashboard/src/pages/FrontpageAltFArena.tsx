/**
 * Alt F — Arena (/preview/alt_f_arena)
 * Live 1v1 lobby + quick-match + targeted challenge + your active match + activity feed + leaderboard.
 * Reuses the proven ActiveMatchPanel (ready-up → melodics → produce → vote) from HeadToHeadArena.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Swords, Trophy, Crown, Medal, Users, Zap, Target, TrendingUp, Clock, Loader2, Flame, History as HistoryIcon, ChevronDown, Filter, Gavel, Award, Headphones,
} from 'lucide-react';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';
import { ActiveMatchPanel, ARENA_CSS, MeData, SubmissionPlayer } from './HeadToHeadArena';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';
const GREENISH = '#57F287'; // "already voted" confirmation

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
interface LobbySummary { waiting: number; readying: number; producing: number; voting: number; }
interface ActivityEvent { type: 'result' | 'join'; at: string; winner?: string; loser?: string; eloDelta?: number | null; genreName?: string | null; tier?: { name: string; color: string }; productionMinutes?: number; }
interface LeaderRow { rank: number; userId: string; elo: number; wins: number; losses: number; matchesPlayed: number; winStreak: number; bestWinStreak: number; profile: any; }
interface GenreOption { id: string; name: string; sampleCount: number; }
interface VotingMatch {
    id: string;
    challengerId: string; opponentId: string | null;
    challengerProfile: any; opponentProfile: any;
    challengerSubmissionUrl: string | null; opponentSubmissionUrl: string | null;
    votingEnd: string | null;
    myVote: string | null;
    genre?: { id: string; name: string } | null;
}
interface HistoryMatch {
    id: string; status: string; genreId: string | null; genreName: string | null; productionMinutes: number;
    outcome: 'win' | 'loss' | 'cancelled'; forfeitReason: string | null;
    opponentProfile: any; eloBefore: number | null; eloAfter: number | null; eloDelta: number | null; completedAt: string;
}
const HISTORY_FILTERS: { key: string; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'win', label: 'Wins' }, { key: 'loss', label: 'Losses' }, { key: 'forfeit', label: 'Forfeits' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const PROD_OPTIONS = [30, 45, 60, 90, 120];

export const FrontpageAltFArena: React.FC = () => {
    const { player } = usePlayer();

    const [me, setMe] = useState<MeData | null>(null);
    const [loggedIn, setLoggedIn] = useState(true);
    const [meLoaded, setMeLoaded] = useState(false);
    const [lobby, setLobby] = useState<LobbyEntry[]>([]);
    const [summary, setSummary] = useState<LobbySummary>({ waiting: 0, readying: 0, producing: 0, voting: 0 });
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
    const [genres, setGenres] = useState<GenreOption[]>([]);
    const [leaderboardGenre, setLeaderboardGenre] = useState('');
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [prodMin, setProdMin] = useState(60);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, forceTick] = useState(0);

    // Judging queue. The bot links members straight here via /arena#vote, so this
    // has to exist on this page — the rebuild dropped the old page's JUDGE tab and
    // left that link pointing at nothing.
    const [voteQueue, setVoteQueue] = useState<VotingMatch[]>([]);
    const [voteBusy, setVoteBusy] = useState<string | null>(null);
    const voteRef = useRef<HTMLDivElement>(null);

    const [history, setHistory] = useState<HistoryMatch[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLoading, setHistoryLoading] = useState(false);

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
        try { const r = await axios.get('/api/head-to-head/lobby'); setLobby(r.data.entries || []); setSummary(r.data.summary || { waiting: 0, readying: 0, producing: 0, voting: 0 }); } catch {}
    }, []);
    const reloadActivity = useCallback(async () => {
        try { const r = await axios.get('/api/head-to-head/activity'); setActivity(r.data.events || []); } catch {}
    }, []);
    const reloadVoteQueue = useCallback(async () => {
        try {
            const r = await axios.get('/api/head-to-head/voting/queue', { withCredentials: true });
            setVoteQueue(r.data?.matches || []);
        } catch { setVoteQueue([]); } // 401 when signed out — the panel prompts to sign in
    }, []);

    const castVote = async (matchId: string, voteFor: string) => {
        setVoteBusy(matchId);
        try {
            await axios.post(`/api/head-to-head/match/${matchId}/vote`, { voteFor }, { withCredentials: true });
            await reloadVoteQueue();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Could not record that vote.');
        } finally { setVoteBusy(null); }
    };

    // /arena#vote comes straight from the Discord announcement — jump to the
    // judging panel once it's on screen rather than dumping people at the top.
    useEffect(() => {
        if (window.location.hash !== '#vote') return;
        const t = setTimeout(() => voteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
        return () => clearTimeout(t);
    }, [voteQueue.length, loggedIn]);

    useEffect(() => {
        reloadMe(); reloadLobby(); reloadActivity(); reloadVoteQueue();
        axios.get('/api/head-to-head/settings').then(r => { setEnabled(r.data?.enabled ?? null); if (r.data?.defaultProductionMinutes) setProdMin(r.data.defaultProductionMinutes); }).catch(() => {});
        axios.get('/api/head-to-head/genres').then(r => setGenres(r.data?.genres || [])).catch(() => {});
    }, [reloadMe, reloadLobby, reloadActivity]);

    // Leaderboard reloads whenever the genre filter changes.
    useEffect(() => {
        const params = leaderboardGenre ? { genreId: leaderboardGenre } : {};
        axios.get('/api/head-to-head/leaderboard', { params }).then(r => setLeaderboard(r.data || [])).catch(() => {});
    }, [leaderboardGenre]);

    const loadHistory = useCallback(async (page: number, result: string, append: boolean) => {
        setHistoryLoading(true);
        try {
            const r = await axios.get('/api/head-to-head/history', { params: { page, result }, withCredentials: true });
            setHistory(prev => append ? [...prev, ...(r.data.matches || [])] : (r.data.matches || []));
            setHistoryTotal(r.data.total || 0);
        } catch { /* not logged in or no history yet */ }
        setHistoryLoading(false);
    }, []);

    useEffect(() => {
        if (!loggedIn || !meLoaded) return;
        setHistoryPage(1);
        loadHistory(1, historyFilter, false);
    }, [loggedIn, meLoaded, historyFilter, loadHistory]);

    // Adaptive poll: fast while actively waiting/matching, slow otherwise.
    useEffect(() => {
        const fast = !!me?.activeMatch && ['queued', 'ready_check', 'melodics_vote'].includes(me.activeMatch.status);
        const t = setInterval(() => { reloadMe(); reloadLobby(); }, fast ? 3000 : 8000);
        const a = setInterval(reloadActivity, 12000);
        const v = setInterval(reloadVoteQueue, 20000);
        return () => { clearInterval(t); clearInterval(a); clearInterval(v); };
    }, [reloadMe, reloadLobby, reloadActivity, reloadVoteQueue, me?.activeMatch?.status]);

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
                                    { label: 'Readying up', value: summary.readying, color: TERTIARY, icon: Clock },
                                    { label: 'In progress', value: summary.producing, color: PRIMARY, icon: Swords },
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
                                                {me.globalRating.winStreak >= 2 && (
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 20, fontWeight: 900, color: '#FF8A3D', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                                                            <Flame size={16} color="#FF8A3D" />{me.globalRating.winStreak}
                                                        </div>
                                                        <div style={{ fontSize: 10, color: SUB }}>STREAK</div>
                                                    </div>
                                                )}
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

                            {/* Match history */}
                            {loggedIn && meLoaded && (
                                <div style={{ ...glass, borderRadius: 18, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <HistoryIcon size={15} color={SECONDARY} />
                                        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Match History</span>
                                        <span style={{ fontSize: 11, color: SUB }}>{historyTotal}</span>
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                            {HISTORY_FILTERS.map(f => (
                                                <button key={f.key} onClick={() => setHistoryFilter(f.key)}
                                                    style={{
                                                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                        border: `1px solid ${historyFilter === f.key ? PRIMARY : BORDER}`,
                                                        background: historyFilter === f.key ? `${PRIMARY}22` : 'transparent',
                                                        color: historyFilter === f.key ? PRIMARY : SUB,
                                                    }}>{f.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {history.length === 0 ? (
                                        <div style={{ padding: '28px 20px', textAlign: 'center', color: SUB, fontSize: 13 }}>
                                            {historyLoading ? <Loader2 size={18} className="h2h-spin" /> : 'No matches yet — get in the queue.'}
                                        </div>
                                    ) : (
                                        <div>
                                            {history.map((m, i) => (
                                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: i < history.length - 1 ? `1px solid ${DIVIDER}` : 'none', fontSize: 13 }}>
                                                    <span style={{
                                                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                                        background: m.outcome === 'win' ? '#4ADE80' : m.outcome === 'loss' ? TERTIARY : SUB,
                                                    }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ color: TEXT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {m.outcome === 'win' ? 'Won' : m.outcome === 'loss' ? 'Lost' : 'Cancelled'} vs {pName(m.opponentProfile, m.opponentProfile?.userId || '')}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: SUB, marginTop: 1 }}>
                                                            {m.genreName || 'Any genre'} · {m.productionMinutes}m{m.status === 'forfeited' ? ' · forfeit' : ''}
                                                        </div>
                                                    </div>
                                                    {m.eloDelta != null && (
                                                        <span style={{ fontWeight: 800, flexShrink: 0, color: m.eloDelta >= 0 ? '#4ADE80' : TERTIARY }}>
                                                            {m.eloDelta >= 0 ? '+' : ''}{m.eloDelta}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {history.length < historyTotal && (
                                                <div style={{ padding: '10px 20px', textAlign: 'center' }}>
                                                    <button onClick={() => { const next = historyPage + 1; setHistoryPage(next); loadHistory(next, historyFilter, true); }}
                                                        disabled={historyLoading}
                                                        style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: SECONDARY, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        {historyLoading ? <Loader2 size={12} className="h2h-spin" /> : <ChevronDown size={12} />} Load more
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <a href="/arena/history" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', color: SECONDARY, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                                See All Battles <HistoryIcon size={13} />
                            </a>

                            {/* ── Judge: vote on finished matches ──
                                Target of /arena#vote, linked from the Discord announcement. */}
                            <div ref={voteRef} id="vote" style={{ ...glass, borderRadius: 18, overflow: 'hidden', scrollMarginTop: 20 }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Gavel size={15} color={SECONDARY} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Judge</span>
                                    {voteQueue.length > 0 && (
                                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#0a0d18', background: SECONDARY, borderRadius: 9999, padding: '2px 8px' }}>
                                            {voteQueue.length} waiting
                                        </span>
                                    )}
                                </div>

                                {!loggedIn ? (
                                    <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                                        <Gavel size={30} color={SECONDARY} style={{ opacity: 0.8, marginBottom: 10 }} />
                                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Sign in to judge</div>
                                        <p style={{ margin: '0 auto 16px', color: SUB, fontSize: 13, maxWidth: 320, lineHeight: 1.6 }}>
                                            Any signed-in member can hear both tracks and vote. Submissions stay anonymous, so it's the music that wins.
                                        </p>
                                        <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`, color: '#0a0d18', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
                                            <Gavel size={15} /> Sign in to vote
                                        </a>
                                    </div>
                                ) : voteQueue.length === 0 ? (
                                    <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                                        <Headphones size={28} color={SUB} style={{ opacity: 0.7, marginBottom: 8 }} />
                                        <p style={{ margin: 0, color: TEXT, fontSize: 13, fontWeight: 600 }}>No matches need judging right now.</p>
                                        <p style={{ margin: '6px 0 0', color: SUB, fontSize: 12 }}>Check back once the current battles finish producing.</p>
                                    </div>
                                ) : (
                                    <div style={{ padding: '14px 20px 18px' }}>
                                        {(() => {
                                            // With several battles queued, an undifferentiated list of
                                            // identical "Mystery Producer A vs B" cards is impossible to
                                            // track. Split by whether you've already voted, so what's left
                                            // to do is obvious, and number/label each battle distinctly.
                                            const todo = voteQueue.filter(m => !m.myVote);
                                            const done = voteQueue.filter(m => !!m.myVote);
                                            return (
                                                <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>
                                                    {todo.length === 0
                                                        ? <>You've judged every open battle. Thanks — results land once enough votes are in.</>
                                                        : <>
                                                            <strong style={{ color: TEXT }}>{todo.length}</strong> {todo.length === 1 ? 'battle needs' : 'battles need'} your vote
                                                            {done.length > 0 && <> · {done.length} already judged</>}
                                                            . Votes are anonymous, and you can't vote on your own match.
                                                        </>}
                                                </div>
                                            );
                                        })()}
                                        {[...voteQueue]
                                            // Unjudged first, then soonest to close — the ones that
                                            // actually need action stay at the top.
                                            .sort((a, b) => {
                                                if (!!a.myVote !== !!b.myVote) return a.myVote ? 1 : -1;
                                                return new Date(a.votingEnd || 0).getTime() - new Date(b.votingEnd || 0).getTime();
                                            })
                                            .map((m, idx) => {
                                            const ends = m.votingEnd ? new Date(m.votingEnd).getTime() - Date.now() : 0;
                                            const mins = Math.max(0, Math.floor(ends / 60000));
                                            const hrs = Math.floor(mins / 60);
                                            const closing = mins <= 0 ? 'Closing soon' : hrs > 0 ? `${hrs}h ${mins % 60}m left` : `${mins}m left`;
                                            const judged = !!m.myVote;
                                            // Letters are scoped per battle so "A" in one card is never
                                            // confused with "A" in another.
                                            const tag = String.fromCharCode(65 + (idx % 26));
                                            const sides = [
                                                { id: m.challengerId, label: `Producer ${tag}1`, url: m.challengerSubmissionUrl, side: 'challenger' as const, color: SECONDARY },
                                                { id: m.opponentId || '', label: `Producer ${tag}2`, url: m.opponentSubmissionUrl, side: 'opponent' as const, color: TERTIARY },
                                            ];
                                            return (
                                                <div key={m.id} style={{
                                                    border: judged ? `1px solid ${BORDER}` : `1px solid ${SECONDARY}44`,
                                                    borderRadius: 14, padding: 14, marginBottom: 12,
                                                    background: judged ? 'rgba(255,255,255,0.015)' : 'rgba(76,215,246,0.04)',
                                                    opacity: judged ? 0.75 : 1,
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 12, fontWeight: 800, color: TEXT }}>
                                                            Battle {idx + 1} of {voteQueue.length}
                                                        </span>
                                                        {m.genre?.name && (
                                                            <span style={{ fontSize: 10.5, fontWeight: 700, color: SECONDARY, background: `${SECONDARY}1e`, border: `1px solid ${SECONDARY}44`, borderRadius: 9999, padding: '2px 8px' }}>
                                                                {m.genre.name}
                                                            </span>
                                                        )}
                                                        {judged && (
                                                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0a0d18', background: GREENISH, borderRadius: 9999, padding: '2px 8px' }}>
                                                                Voted
                                                            </span>
                                                        )}
                                                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: mins > 0 && mins < 15 ? TERTIARY : SUB }}>
                                                            <Clock size={11} /> {closing}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                                                        {sides.map(s => {
                                                            const mine = m.myVote === s.id;
                                                            return (
                                                                <div key={s.side} style={{
                                                                    padding: 12, borderRadius: 12,
                                                                    border: mine ? `2px solid ${s.color}` : `1px solid ${BORDER}`,
                                                                    background: mine ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                                                                }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 8 }}>{s.label}</div>
                                                                    {s.url
                                                                        ? <SubmissionPlayer matchId={m.id} side={s.side} color={s.color} />
                                                                        : <p style={{ color: SUB, fontSize: 12, margin: '0 0 10px' }}>No submission</p>}
                                                                    <button
                                                                        onClick={() => castVote(m.id, s.id)}
                                                                        disabled={mine || !!voteBusy || !s.id}
                                                                        style={{
                                                                            width: '100%', marginTop: 10, padding: '9px 14px', borderRadius: 10, border: 'none',
                                                                            background: mine ? s.color : 'rgba(255,255,255,0.08)',
                                                                            color: mine ? '#0a0d18' : TEXT,
                                                                            fontWeight: 800, fontSize: 12.5,
                                                                            cursor: mine || voteBusy ? 'default' : 'pointer',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                                        }}>
                                                                        <Award size={13} /> {mine ? 'Your vote' : 'Vote'}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                                {genres.length > 0 && (
                                    <div style={{ padding: '10px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Filter size={12} color={SUB} />
                                        <select value={leaderboardGenre} onChange={e => setLeaderboardGenre(e.target.value)}
                                            style={{ flex: 1, padding: '6px 8px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, fontFamily: FONT, outline: 'none' }}>
                                            <option value="">All genres</option>
                                            {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                )}
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
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            {pName(r.profile, r.userId)}
                                                            <span style={{ fontSize: 9, fontWeight: 800, color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{t.name}</span>
                                                        </div>
                                                        <div style={{ fontSize: 10, color: SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span>{r.wins}W {r.losses}L</span>
                                                            {r.winStreak >= 2 && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#FF8A3D', fontWeight: 700 }}>
                                                                    <Flame size={10} color="#FF8A3D" />{r.winStreak}
                                                                </span>
                                                            )}
                                                        </div>
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
