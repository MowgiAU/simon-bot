import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { Swords, Trophy, Clock, CheckCircle, Upload, Loader, Award, Vote, Zap, Flame, Crown, Medal, Target, TrendingUp, Skull, Headphones, Radio, Play, Pause, Download, Package, BookOpen, Users, Sparkles } from 'lucide-react';
import { colors } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';

const API = '';

interface Genre { id: string; name: string; sampleCount: number }
interface Settings {
    enabled: boolean;
    defaultProductionMinutes: number;
    defaultVotingMinutes: number;
    readyUpMinutes: number;
    samplesPerMatch: number;
    minVotesToFinalize: number;
}
interface Profile { userId: string; username: string | null; displayName: string | null; avatar: string | null; anonymous?: boolean }
interface Sample { id: string; name: string; fileUrl: string; fileType: string; category?: string }
interface MatchInfo {
    id: string;
    status: string;
    challengerId: string;
    opponentId: string | null;
    productionMinutes: number;
    votingMinutes: number;
    sampleIds: string[] | null;
    samples?: Sample[];
    challengerReady: boolean;
    opponentReady: boolean;
    readyDeadline: string | null;
    melodicsVoteDeadline: string | null;
    challengerVoteBass:   boolean | null;
    challengerVoteMelody: boolean | null;
    challengerVoteChords: boolean | null;
    opponentVoteBass:     boolean | null;
    opponentVoteMelody:   boolean | null;
    opponentVoteChords:   boolean | null;
    includeBass:   boolean;
    includeMelody: boolean;
    includeChords: boolean;
    producingDeadline: string | null;
    challengerSubmissionUrl: string | null;
    opponentSubmissionUrl: string | null;
    votingEnd: string | null;
    winnerId: string | null;
    loserId: string | null;
    forfeitReason: string | null;
    challengerProfile?: Profile | null;
    opponentProfile?: Profile | null;
    genre?: { name: string } | null;
    challengerEloAfter?: number | null;
    challengerEloBefore?: number | null;
    opponentEloAfter?: number | null;
    opponentEloBefore?: number | null;
}
interface MeData {
    userId: string;
    globalRating: { elo: number; wins: number; losses: number; forfeits: number; matchesPlayed: number };
    genreRatings: { genreId: string; genreName: string; elo: number; wins: number; losses: number }[];
    activeMatch: MatchInfo | null;
    recentMatches: MatchInfo[];
}
interface VotingMatch extends MatchInfo {
    myVote: string | null;
}
interface LeaderRow {
    rank: number;
    userId: string;
    elo: number;
    wins: number;
    losses: number;
    matchesPlayed: number;
    profile: Profile | null;
    genreName: string | null;
}

// ── Gamification: Tiers based on Elo ──
type Tier = { name: string; min: number; color: string; icon: React.ReactNode; glow: string };
// Starting Elo is 1200. Players must EARN their way up - unranked = Bronze.
const TIERS: Tier[] = [
    { name: 'UNRANKED', min: 0,    color: '#7A8190', glow: 'rgba(122,129,144,0.4)', icon: <Medal size={14} /> },
    { name: 'BRONZE',   min: 1200, color: '#CD7F32', glow: 'rgba(205,127,50,0.5)',  icon: <Medal size={14} /> },
    { name: 'SILVER',   min: 1300, color: '#C0C0C0', glow: 'rgba(192,192,192,0.5)', icon: <Medal size={14} /> },
    { name: 'GOLD',     min: 1450, color: '#FFD700', glow: 'rgba(255,215,0,0.6)',   icon: <Trophy size={14} /> },
    { name: 'PLATINUM', min: 1600, color: '#E5E4E2', glow: 'rgba(229,228,226,0.6)', icon: <Trophy size={14} /> },
    { name: 'DIAMOND',  min: 1750, color: '#5DD4FF', glow: 'rgba(93,212,255,0.7)',  icon: <Crown size={14} /> },
    { name: 'MASTER',   min: 1900, color: '#A855F7', glow: 'rgba(168,85,247,0.7)',  icon: <Crown size={14} /> },
    { name: 'LEGEND',   min: 2100, color: '#FF3D7F', glow: 'rgba(255,61,127,0.8)',  icon: <Flame size={14} /> },
];
function tierFor(elo: number): Tier { return [...TIERS].reverse().find(t => elo >= t.min) || TIERS[0]; }
function nextTier(elo: number): Tier | null {
    const idx = TIERS.findIndex(t => elo < t.min);
    return idx === -1 ? null : TIERS[idx];
}

// ── Neon palette ──
const NEON = {
    pink: '#FF3D7F',
    cyan: '#00E5FF',
    purple: '#A855F7',
    yellow: '#FFD700',
    green: '#34D399',
    red: '#F87171',
    bgDeep: '#0A0E1A',
    bgPanel: 'rgba(15,20,35,0.85)',
    border: 'rgba(120,140,200,0.18)',
};

const CATEGORY_COLORS: Record<string, string> = {
    kick:       '#FF3D7F', // pink - punchy
    snare:      '#FFD700', // yellow - sharp
    hat:        '#00E5FF', // cyan - crisp
    percussion: '#34D399', // green - organic
    fx:         '#A855F7', // purple - atmospheric
    bass:       '#5DD4FF', // diamond blue - low end
    melody:     '#FF8A4C', // orange - lead
    chords:     '#E879F9', // magenta - harmony
    other:      '#7A8190',
};

function timeLeft(iso: string | null): { txt: string; urgent: boolean; expired: boolean } {
    if (!iso) return { txt: '-', urgent: false, expired: false };
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return { txt: 'EXPIRED', urgent: true, expired: true };
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const urgent = ms < 300_000;
    if (mins >= 60) return { txt: `${Math.floor(mins / 60)}h ${mins % 60}m`, urgent, expired: false };
    return { txt: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, urgent, expired: false };
}

function profileName(p: Profile | null | undefined, fallbackId: string): string {
    if (p?.anonymous) return 'MYSTERY PRODUCER';
    return p?.displayName || p?.username || fallbackId.slice(0, 8);
}

function Initials({ name }: { name: string }) {
    const i = name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    return <>{i}</>;
}

// ── CSS injected once ──
const ARENA_CSS = `
@keyframes h2h-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.04); } }
@keyframes h2h-glow-pulse { 0%,100% { box-shadow: 0 0 18px var(--glow-c, rgba(0,229,255,0.4)), 0 0 38px var(--glow-c, rgba(0,229,255,0.4)); } 50% { box-shadow: 0 0 28px var(--glow-c, rgba(0,229,255,0.4)), 0 0 60px var(--glow-c, rgba(0,229,255,0.4)); } }
@keyframes h2h-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes h2h-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
@keyframes h2h-flicker { 0%,18%,22%,25%,53%,57%,100% { opacity: 1; } 20%,24%,55% { opacity: 0.4; } }
@keyframes h2h-rise { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes h2h-spin { to { transform: rotate(360deg); } }
@keyframes h2h-bg-pan { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes h2h-clash { 0%,100% { transform: translateX(0) rotate(-45deg); } 50% { transform: translateX(-4px) rotate(-45deg); } }
@keyframes h2h-clash2 { 0%,100% { transform: translateX(0) rotate(135deg); } 50% { transform: translateX(4px) rotate(135deg); } }
@keyframes h2h-spark { 0% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(0.4); } }

.h2h-arena-root { animation: h2h-rise 0.4s ease-out; }
.h2h-pulse { animation: h2h-pulse 1.4s ease-in-out infinite; }
.h2h-glow-card { animation: h2h-glow-pulse 2.6s ease-in-out infinite; }
.h2h-flicker { animation: h2h-flicker 5s linear infinite; }
.h2h-spin { animation: h2h-spin 1s linear infinite; }
.h2h-tab { transition: all 0.18s ease; position: relative; overflow: hidden; }
.h2h-tab:hover { transform: translateY(-2px); }
.h2h-btn-neon { position: relative; transition: all 0.15s ease; cursor: pointer; }
.h2h-btn-neon:not(:disabled):hover { transform: translateY(-2px); filter: brightness(1.15); }
.h2h-btn-neon:not(:disabled):active { transform: translateY(0); }
.h2h-shimmer { background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.18) 50%, transparent 75%); background-size: 200% 100%; animation: h2h-shimmer 2s linear infinite; }
.h2h-scanline { position: absolute; left: 0; right: 0; height: 40%; background: linear-gradient(180deg, transparent, rgba(0,229,255,0.08), transparent); animation: h2h-scan 4s linear infinite; pointer-events: none; }
.h2h-bg-anim { background: linear-gradient(120deg, rgba(255,61,127,0.10), rgba(0,229,255,0.10), rgba(168,85,247,0.10), rgba(255,61,127,0.10)); background-size: 300% 300%; animation: h2h-bg-pan 12s ease infinite; }
.h2h-vs-clash-l { animation: h2h-clash 1.2s ease-in-out infinite; }
.h2h-vs-clash-r { animation: h2h-clash2 1.2s ease-in-out infinite; }
.h2h-spark { animation: h2h-spark 1.2s ease-in-out infinite; }
.h2h-row-hover:hover { background: rgba(255,255,255,0.05) !important; }

@media (max-width: 720px) {
    .h2h-vs-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
    .h2h-vs-divider { display: none !important; }
    .h2h-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .h2h-hero-title { font-size: 28px !important; }
}
`;

// ── Reusable bits ──
const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; className?: string; glowColor?: string }> = ({ children, style, className, glowColor }) => (
    <div className={className} style={{
        background: NEON.bgPanel,
        backdropFilter: 'blur(8px)',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '16px',
        border: `1px solid ${glowColor ? glowColor + '55' : NEON.border}`,
        boxShadow: glowColor ? `0 0 24px ${glowColor}33, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
    }}>{children}</div>
);

const NeonButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string; size?: 'sm' | 'md' | 'lg'; style?: React.CSSProperties }> = ({ onClick, disabled, children, color = NEON.cyan, size = 'md', style }) => {
    const sz = size === 'sm' ? { p: '7px 14px', f: 12 } : size === 'lg' ? { p: '14px 26px', f: 15 } : { p: '10px 20px', f: 13 };
    return (
        <button className="h2h-btn-neon" onClick={onClick} disabled={disabled} style={{
            background: disabled ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${color}cc, ${color}88)`,
            color: disabled ? colors.textSecondary : '#fff',
            border: `1px solid ${disabled ? 'transparent' : color}`,
            padding: sz.p,
            borderRadius: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 800,
            fontSize: sz.f,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: disabled ? 'none' : `0 0 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
            ...style,
        }}>{children}</button>
    );
};

const TierBadge: React.FC<{ elo: number; size?: 'sm' | 'md' }> = ({ elo, size = 'md' }) => {
    const t = tierFor(elo);
    const padding = size === 'sm' ? '3px 8px' : '4px 10px';
    const fs = size === 'sm' ? 10 : 11;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding, borderRadius: 999,
            background: `${t.color}1a`,
            border: `1px solid ${t.color}66`,
            color: t.color,
            fontWeight: 800, fontSize: fs,
            letterSpacing: '0.08em',
            textShadow: `0 0 10px ${t.glow}`,
        }}>{t.icon} {t.name}</span>
    );
};

const Avatar: React.FC<{ profile: Profile | null | undefined; userId: string; size?: number; ring?: string; ringPulse?: boolean }> = ({ profile, userId, size = 48, ring, ringPulse }) => {
    const name = profileName(profile, userId);
    const anon = !!profile?.anonymous;
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            border: ring ? `3px solid ${ring}` : '2px solid rgba(255,255,255,0.08)',
            boxShadow: ring ? `0 0 ${ringPulse ? 22 : 14}px ${ring}88` : 'none',
            background: anon
                ? `linear-gradient(135deg, #1a1f2e, #0a0e1a)`
                : `linear-gradient(135deg, ${NEON.purple}, ${NEON.pink})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: size * 0.36, color: '#fff',
            position: 'relative',
            ...(ringPulse ? { animation: 'h2h-glow-pulse 2s ease-in-out infinite', ['--glow-c' as any]: ring } : {}),
        }}>
            {anon ? (
                <Skull size={size * 0.5} color="rgba(255,255,255,0.65)" style={{ filter: `drop-shadow(0 0 6px ${ring || '#fff'}88)` }} />
            ) : profile?.avatar ? (
                <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <Initials name={name} />
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TABS = ['arena', 'vote', 'leaderboard', 'rules'] as const;
type Tab = typeof VALID_TABS[number];

function hashToTab(hash: string): Tab {
    const slug = hash.replace(/^#/, '');
    return (VALID_TABS as readonly string[]).includes(slug) ? slug as Tab : 'arena';
}

export const HeadToHeadArenaPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const tab: Tab = useMemo(() => hashToTab(location.hash), [location.hash]);
    const setTab = useCallback((t: Tab) => {
        navigate(`/arena#${t}`, { replace: true });
    }, [navigate]);
    const [settings, setSettings] = useState<Settings | null>(null);

    useEffect(() => {
        fetch(`${API}/api/head-to-head/settings`).then(r => r.json()).then(setSettings).catch(() => {});
    }, []);

    return (
        <DiscoveryLayout activeTab="h2h">
            <style>{ARENA_CSS}</style>
            <div className="h2h-arena-root" style={{
                minHeight: 'calc(100vh - 120px)',
                background: `radial-gradient(ellipse at 30% 0%, ${NEON.purple}22 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, ${NEON.pink}1f 0%, transparent 60%), ${NEON.bgDeep}`,
                color: colors.textPrimary,
            }}>
                <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 60px' }}>

                    {/* ─── HERO BANNER ─── */}
                    <div className="h2h-bg-anim" style={{
                        position: 'relative',
                        borderRadius: 18,
                        padding: '28px 24px',
                        marginBottom: 18,
                        border: `1px solid ${NEON.pink}44`,
                        boxShadow: `0 0 40px ${NEON.pink}33, 0 0 80px ${NEON.cyan}22`,
                        overflow: 'hidden',
                    }}>
                        <div className="h2h-scanline" style={{ top: '-40%' }} />
                        <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, background: `radial-gradient(circle, ${NEON.pink}33, transparent 70%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: 14,
                                background: `linear-gradient(135deg, ${NEON.pink}, ${NEON.purple})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 0 24px ${NEON.pink}88, inset 0 0 12px rgba(255,255,255,0.2)`,
                            }}>
                                <Swords size={36} color="#fff" />
                            </div>
                            <div style={{ flex: 1, minWidth: 240 }}>
                                <h1 className="h2h-hero-title" style={{
                                    margin: 0, fontSize: 36, fontWeight: 900,
                                    letterSpacing: '0.04em',
                                    background: `linear-gradient(135deg, ${NEON.pink}, ${NEON.cyan})`,
                                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                    lineHeight: 1.1,
                                }}>1V1 ARENA</h1>
                                <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: '0.05em' }}>
                                    Curated samples · Peer-judged · Elo ranked · Glory awaits
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span className="h2h-flicker" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: `${NEON.green}22`, border: `1px solid ${NEON.green}66`, color: NEON.green, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: NEON.green, boxShadow: `0 0 8px ${NEON.green}` }} /> LIVE
                                </span>
                            </div>
                        </div>
                    </div>

                    {settings && !settings.enabled && (
                        <Panel glowColor={colors.warning}>
                            <p style={{ margin: 0 }}>The Arena is currently closed by an administrator. Check back soon.</p>
                        </Panel>
                    )}

                    {/* ─── TABS ─── */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                        {([
                            ['arena', 'BATTLE', Swords, NEON.pink],
                            ['vote', 'JUDGE', Vote, NEON.cyan],
                            ['leaderboard', 'RANKS', Trophy, NEON.yellow],
                            ['rules', 'HOW IT WORKS', BookOpen, NEON.purple],
                        ] as const).map(([id, label, Icon, color]) => {
                            const active = tab === id;
                            return (
                                <button key={id} className="h2h-tab" onClick={() => setTab(id)} style={{
                                    background: active ? `linear-gradient(135deg, ${color}33, ${color}11)` : 'rgba(255,255,255,0.03)',
                                    color: active ? color : 'rgba(255,255,255,0.55)',
                                    border: `1px solid ${active ? color + '88' : 'rgba(255,255,255,0.08)'}`,
                                    padding: '11px 22px', borderRadius: 10,
                                    cursor: 'pointer', fontWeight: 800, fontSize: 13, letterSpacing: '0.1em',
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    boxShadow: active ? `0 0 16px ${color}55` : 'none',
                                }}><Icon size={16} /> {label}</button>
                            );
                        })}
                    </div>

                    {tab === 'arena' && <ArenaTab settings={settings} />}
                    {tab === 'vote' && <VoteTab />}
                    {tab === 'leaderboard' && <LeaderboardTab />}
                    {tab === 'rules' && <RulesTab settings={settings} />}
                </div>
            </div>
        </DiscoveryLayout>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Arena Tab
// ─────────────────────────────────────────────────────────────────────────────

const ArenaTab: React.FC<{ settings: Settings | null }> = ({ settings }) => {
    const [me, setMe] = useState<MeData | null>(null);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [genreId, setGenreId] = useState<string>('');
    const [prodMin, setProdMin] = useState<number>(60);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(true);

    const reload = useCallback(async () => {
        const [mRes, gRes] = await Promise.all([
            fetch(`${API}/api/head-to-head/me`, { credentials: 'include' }),
            fetch(`${API}/api/head-to-head/genres`),
        ]);
        if (mRes.status === 401 || mRes.status === 403) setIsLoggedIn(false);
        if (mRes.ok) setMe(await mRes.json());
        if (gRes.ok) {
            const data = await gRes.json();
            setGenres(data.genres || []);
        }
        setLoaded(true);
    }, []);

    useEffect(() => { reload(); }, [reload]);
    useEffect(() => {
        // Poll fast (3s) when actively waiting for a match / opponent action; slow (15s) otherwise.
        const fast = !!me?.activeMatch && ['queued', 'ready_check', 'melodics_vote'].includes(me.activeMatch.status);
        const t = setInterval(reload, fast ? 3000 : 15000);
        return () => clearInterval(t);
    }, [reload, me?.activeMatch?.status]);
    useEffect(() => { if (settings) setProdMin(settings.defaultProductionMinutes); }, [settings]);

    const joinQueue = async () => {
        setBusy(true); setError(null);
        const res = await fetch(`${API}/api/head-to-head/queue`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ genreId: genreId || null, productionMinutes: prodMin }),
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            setError(j.error || 'Failed to join queue');
        }
        setBusy(false);
        await reload();
    };

    const leaveQueue = async () => {
        setBusy(true);
        await fetch(`${API}/api/head-to-head/queue/leave`, { method: 'POST', credentials: 'include' });
        setBusy(false);
        await reload();
    };

    if (!loaded) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader className="h2h-spin" size={32} color={NEON.cyan} />
        </div>
    );

    if (!isLoggedIn || !me) return (
        <Panel glowColor={NEON.cyan}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Swords size={40} color={NEON.cyan} style={{ opacity: 0.7, marginBottom: 12 }} />
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    Join the Arena
                </div>
                <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
                    Sign in or create a free account to enter the 1v1 queue, compete against other producers, and climb the leaderboard.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, background: `linear-gradient(135deg, ${NEON.cyan}, ${NEON.purple})`, color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', letterSpacing: '0.04em', boxShadow: `0 0 18px ${NEON.cyan}55` }}>
                        <Swords size={15} /> Sign In to Compete
                    </a>
                    <a href="/login?tab=register" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)' }}>
                        Create Account
                    </a>
                </div>
            </div>
        </Panel>
    );

    const tier = me.globalRating.matchesPlayed === 0 ? TIERS[0] : tierFor(me.globalRating.elo);
    const next = nextTier(me.globalRating.elo);
    const winRate = me.globalRating.matchesPlayed > 0 ? Math.round((me.globalRating.wins / me.globalRating.matchesPlayed) * 100) : 0;

    return (
        <div>
            {/* ─── PLAYER STATS PANEL ─── */}
            <Panel glowColor={tier.color}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: me.genreRatings.length > 0 ? 14 : 0, flexWrap: 'wrap' }}>
                    <div style={{
                        width: 84, height: 84, borderRadius: 16,
                        background: `linear-gradient(135deg, ${tier.color}cc, ${tier.color}66)`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 24px ${tier.glow}, inset 0 0 12px rgba(255,255,255,0.2)`,
                        flexShrink: 0,
                    }}>
                        {React.cloneElement(tier.icon as any, { size: 28, color: '#fff' })}
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#fff', marginTop: 2 }}>{tier.name}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', fontWeight: 700 }}>YOUR RATING</div>
                        <div style={{ fontSize: 48, fontWeight: 900, color: tier.color, lineHeight: 1, textShadow: `0 0 20px ${tier.glow}`, fontVariantNumeric: 'tabular-nums' }}>
                            {me.globalRating.elo}
                        </div>
                        {next && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4, letterSpacing: '0.08em' }}>
                                    {next.min - me.globalRating.elo} TO <span style={{ color: next.color }}>{next.name}</span>
                                </div>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div className="h2h-shimmer" style={{
                                        width: `${Math.max(4, ((me.globalRating.elo - tier.min) / (next.min - tier.min)) * 100)}%`,
                                        height: '100%',
                                        background: `linear-gradient(90deg, ${tier.color}, ${next.color})`,
                                        borderRadius: 999,
                                        boxShadow: `0 0 10px ${tier.color}`,
                                    }} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="h2h-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(70px, 1fr))', gap: 10, minWidth: 240 }}>
                        <StatTile label="WINS"   value={me.globalRating.wins} color={NEON.green} icon={<Trophy size={14} />} />
                        <StatTile label="LOSSES" value={me.globalRating.losses} color={NEON.red} icon={<Skull size={14} />} />
                        <StatTile label="WIN%"   value={`${winRate}%`} color={NEON.cyan} icon={<TrendingUp size={14} />} />
                    </div>
                </div>

                {me.genreRatings.length > 0 && (
                    <div style={{ borderTop: `1px solid ${NEON.border}`, paddingTop: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 8 }}>GENRE RATINGS</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {me.genreRatings.map(g => {
                                const gt = tierFor(g.elo);
                                return (
                                    <span key={g.genreId} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        padding: '6px 12px', borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${gt.color}44`, fontSize: 12,
                                    }}>
                                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{g.genreName}</span>
                                        <strong style={{ color: gt.color, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 8px ${gt.glow}` }}>{g.elo}</strong>
                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{g.wins}W·{g.losses}L</span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Panel>

            {/* ─── ACTIVE MATCH or QUEUE ─── */}
            {me.activeMatch ? (
                <ActiveMatchPanel match={me.activeMatch} myUserId={me.userId} onChange={reload} onLeave={leaveQueue} />
            ) : (
                <Panel glowColor={NEON.cyan}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Target size={20} color={NEON.cyan} />
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '0.06em' }}>FIND A MATCH</h3>
                    </div>
                    {error && (
                        <div style={{ background: `${NEON.red}1a`, border: `1px solid ${NEON.red}66`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: NEON.red, fontSize: 13 }}>
                            {error}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <FieldGroup label="GENRE" icon={<Headphones size={14} color={NEON.purple} />}>
                            <select value={genreId} onChange={e => setGenreId(e.target.value)} style={selectStyle}>
                                <option value="">⚡ Any genre (global pool)</option>
                                {genres.map(g => <option key={g.id} value={g.id}>{g.name} · {g.sampleCount} samples</option>)}
                            </select>
                        </FieldGroup>
                        <FieldGroup label="PRODUCTION TIME" icon={<Clock size={14} color={NEON.yellow} />}>
                            <select value={prodMin} onChange={e => setProdMin(Number(e.target.value))} style={selectStyle}>
                                {[15, 30, 45, 60, 90, 120, 180, 240, 360, 720].map(n => (
                                    <option key={n} value={n}>{n >= 60 ? `${n/60}h${n%60 ? ` ${n%60}m` : ''}` : `${n} min`}</option>
                                ))}
                            </select>
                        </FieldGroup>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', fontWeight: 700 }}>
                            <Zap size={14} color={NEON.cyan} /> SAMPLE PACK
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                            You'll always get one <b style={{ color: '#fff' }}>kick</b>, <b style={{ color: '#fff' }}>snare</b>, <b style={{ color: '#fff' }}>hat</b>, <b style={{ color: '#fff' }}>percussion</b> &amp; <b style={{ color: '#fff' }}>fx</b> sample. Once the match starts, you and your opponent will <b style={{ color: '#fff' }}>both vote</b> on which melodics (bass / melody / chords) to include - you only get the ones you both agree on.
                        </div>
                    </div>

                    <NeonButton onClick={joinQueue} disabled={busy || (settings ? !settings.enabled : false)} color={NEON.pink} size="lg">
                        <Zap size={18} /> ENTER ARENA
                    </NeonButton>
                </Panel>
            )}

            {/* ─── RECENT MATCHES ─── */}
            {me.recentMatches.length > 0 && (
                <Panel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <Radio size={18} color={NEON.purple} />
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.06em' }}>BATTLE HISTORY</h3>
                    </div>
                    <div>
                        {me.recentMatches.map(m => {
                            const won = m.winnerId === me.userId;
                            const isCh = m.challengerId === me.userId;
                            const oppId = isCh ? (m.opponentId || '') : m.challengerId;
                            const oppProf = isCh ? m.opponentProfile : m.challengerProfile;
                            const myEloAfter = isCh ? m.challengerEloAfter : m.opponentEloAfter;
                            const myEloBefore = isCh ? m.challengerEloBefore : m.opponentEloBefore;
                            const delta = (myEloAfter != null && myEloBefore != null) ? (myEloAfter - myEloBefore) : null;
                            const isForfeit = m.status === 'forfeited';
                            return (
                                <div key={m.id} className="h2h-row-hover" style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 12px', borderRadius: 8,
                                    borderLeft: `3px solid ${won ? NEON.green : NEON.red}`,
                                    background: 'rgba(255,255,255,0.02)',
                                    marginBottom: 6,
                                    transition: 'background 0.15s',
                                }}>
                                    <span style={{
                                        width: 40, fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
                                        color: won ? NEON.green : NEON.red,
                                        textShadow: `0 0 8px ${won ? NEON.green : NEON.red}66`,
                                    }}>{won ? 'WIN' : 'LOSS'}</span>
                                    <Avatar profile={oppProf} userId={oppId} size={32} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            vs {profileName(oppProf, oppId)}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                            {m.genre?.name || 'Global'}{isForfeit ? ' · forfeit' : ''}
                                        </div>
                                    </div>
                                    {delta != null && (
                                        <span style={{
                                            fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums',
                                            color: delta >= 0 ? NEON.green : NEON.red,
                                        }}>{delta >= 0 ? '+' : ''}{delta}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}
        </div>
    );
};

const StatTile: React.FC<{ label: string; value: string | number; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}33`,
        borderRadius: 10,
        padding: '10px 12px',
        textAlign: 'center',
    }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, color, marginBottom: 2 }}>{icon}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 10px ${color}55` }}>{value}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', fontWeight: 700, marginTop: 4 }}>{label}</div>
    </div>
);

const FieldGroup: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
    <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', fontWeight: 700 }}>
            {icon} {label}
        </label>
        {children}
    </div>
);

const CategoryToggle: React.FC<{ label: string; on: boolean; onClick: () => void; color: string }> = ({ label, on, onClick, color }) => (
    <button type="button" onClick={onClick} className="h2h-btn-neon" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 999,
        background: on ? `linear-gradient(135deg, ${color}33, ${color}11)` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${on ? color : 'rgba(255,255,255,0.12)'}`,
        color: on ? color : 'rgba(255,255,255,0.45)',
        fontWeight: 800, fontSize: 11, letterSpacing: '0.12em',
        cursor: 'pointer',
        boxShadow: on ? `0 0 12px ${color}44` : 'none',
        textShadow: on ? `0 0 8px ${color}66` : 'none',
    }}>
        <span style={{
            width: 14, height: 14, borderRadius: 4,
            background: on ? color : 'transparent',
            border: `1.5px solid ${on ? color : 'rgba(255,255,255,0.3)'}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontSize: 11, fontWeight: 900,
        }}>{on ? '✓' : ''}</span>
        {label}
    </button>
);

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'rgba(0,0,0,0.4)', color: '#fff',
    border: `1px solid ${NEON.border}`, borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    outline: 'none',
};

// ─────────────────────────────────────────────────────────────────────────────
// Active Match Panel - VS layout
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    queued:        { color: NEON.cyan,   label: 'SEARCHING',     icon: <Target size={14} /> },
    ready_check:   { color: NEON.yellow, label: 'READY UP',      icon: <CheckCircle size={14} /> },
    melodics_vote: { color: NEON.purple, label: 'PICK MELODICS', icon: <Vote size={14} /> },
    producing:     { color: NEON.pink,   label: 'PRODUCING',     icon: <Headphones size={14} /> },
    voting:        { color: NEON.purple, label: 'BEING JUDGED',  icon: <Vote size={14} /> },
    completed:     { color: NEON.green,  label: 'COMPLETE',      icon: <Trophy size={14} /> },
    forfeited:     { color: NEON.red,    label: 'FORFEITED',     icon: <Skull size={14} /> },
};

const ActiveMatchPanel: React.FC<{ match: MatchInfo; myUserId: string; onChange: () => void; onLeave: () => void }> = ({ match, myUserId, onChange, onLeave }) => {
    const [, force] = useState(0);
    useEffect(() => { const t = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(t); }, []);

    const [submitting, setSubmitting] = useState(false);
    const [readying, setReadying] = useState(false);

    const isCh = match.challengerId === myUserId;
    const meReady = isCh ? match.challengerReady : match.opponentReady;
    const oppReady = isCh ? match.opponentReady : match.challengerReady;
    const oppId = isCh ? match.opponentId : match.challengerId;
    const oppProf = isCh ? match.opponentProfile : match.challengerProfile;
    const myProf = isCh ? match.challengerProfile : match.opponentProfile;
    const mySubmitted = isCh ? !!match.challengerSubmissionUrl : !!match.opponentSubmissionUrl;
    const oppSubmitted = isCh ? !!match.opponentSubmissionUrl : !!match.challengerSubmissionUrl;

    const ready = async () => {
        setReadying(true);
        await fetch(`${API}/api/head-to-head/match/${match.id}/ready`, { method: 'POST', credentials: 'include' });
        setReadying(false);
        onChange();
    };

    const submit = async (file: File) => {
        setSubmitting(true);
        const fd = new FormData();
        fd.append('submission', file);
        const res = await fetch(`${API}/api/head-to-head/match/${match.id}/submit`, {
            method: 'POST', credentials: 'include', body: fd,
        });
        setSubmitting(false);
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            alert(j.error || 'Upload failed');
        }
        onChange();
    };

    const [forfeiting, setForfeiting] = useState(false);
    const forfeit = async () => {
        const submittedTrack = mySubmitted;
        const oppHasTrack = oppSubmitted;
        let warn: string;
        if (match.status === 'ready_check' || match.status === 'melodics_vote') {
            warn = 'Forfeit this match? Your opponent will get the win and you\'ll take the L on your record.';
        } else if (oppHasTrack) {
            warn = 'Your opponent already submitted. Forfeiting now hands them the win automatically.';
        } else if (submittedTrack) {
            warn = 'You already submitted a track. Are you sure you want to forfeit and give your opponent the W?';
        } else {
            warn = 'Forfeit this match? Your opponent gets the win automatically.';
        }
        if (!confirm(warn)) return;
        setForfeiting(true);
        const res = await fetch(`${API}/api/head-to-head/match/${match.id}/forfeit`, {
            method: 'POST', credentials: 'include',
        });
        setForfeiting(false);
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            alert(j.error || 'Forfeit failed');
        }
        onChange();
    };

    // Melodics vote actions
    const myMVotes = isCh
        ? { bass: match.challengerVoteBass, melody: match.challengerVoteMelody, chords: match.challengerVoteChords }
        : { bass: match.opponentVoteBass,   melody: match.opponentVoteMelody,   chords: match.opponentVoteChords };
    const oppMVotes = isCh
        ? { bass: match.opponentVoteBass,   melody: match.opponentVoteMelody,   chords: match.opponentVoteChords }
        : { bass: match.challengerVoteBass, melody: match.challengerVoteMelody, chords: match.challengerVoteChords };
    const myMSubmitted = myMVotes.bass !== null && myMVotes.melody !== null && myMVotes.chords !== null;
    const oppMSubmitted = oppMVotes.bass !== null && oppMVotes.melody !== null && oppMVotes.chords !== null;
    const [pendingM, setPendingM] = useState<{ bass: boolean; melody: boolean; chords: boolean } | null>(null);
    const [submittingM, setSubmittingM] = useState(false);
    const draftM = pendingM ?? { bass: !!myMVotes.bass, melody: !!myMVotes.melody, chords: !!myMVotes.chords };
    const submitMelodics = async () => {
        setSubmittingM(true);
        const res = await fetch(`${API}/api/head-to-head/match/${match.id}/melodics-vote`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftM),
        });
        setSubmittingM(false);
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            alert(j.error || 'Vote failed');
        }
        setPendingM(null);
        onChange();
    };

    const meta = STATUS_META[match.status] || { color: NEON.cyan, label: match.status.toUpperCase(), icon: null };
    const deadline = match.status === 'ready_check' ? match.readyDeadline
                   : match.status === 'melodics_vote' ? match.melodicsVoteDeadline
                   : match.status === 'producing' ? match.producingDeadline
                   : match.status === 'voting' ? match.votingEnd
                   : null;
    const tl = timeLeft(deadline);

    return (
        <Panel glowColor={meta.color} className="h2h-glow-card" style={{ ['--glow-c' as any]: `${meta.color}55` }}>
            {/* Status header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px', borderRadius: 999,
                    background: `${meta.color}22`, border: `1px solid ${meta.color}88`,
                    color: meta.color, fontWeight: 800, fontSize: 12, letterSpacing: '0.12em',
                    textShadow: `0 0 10px ${meta.color}66`,
                }}>{meta.icon} {meta.label}</span>
                {deadline && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={14} color={tl.urgent ? NEON.red : 'rgba(255,255,255,0.6)'} />
                        <span className={tl.urgent ? 'h2h-pulse' : ''} style={{
                            fontFamily: 'monospace', fontSize: 22, fontWeight: 800,
                            color: tl.urgent ? NEON.red : '#fff',
                            textShadow: tl.urgent ? `0 0 12px ${NEON.red}` : 'none',
                            fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em',
                        }}>{tl.txt}</span>
                    </div>
                )}
            </div>

            {/* VS layout */}
            <div className="h2h-vs-grid" style={{
                display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                gap: 18, alignItems: 'center', marginBottom: 18,
            }}>
                <FighterCard
                    side="left"
                    name={profileName(myProf, myUserId)}
                    profile={myProf}
                    userId={myUserId}
                    color={NEON.cyan}
                    isYou
                    ready={match.status === 'ready_check' ? meReady : undefined}
                    submitted={match.status === 'producing' ? mySubmitted : undefined}
                />
                <div className="h2h-vs-divider" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                    <div style={{ position: 'relative', width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Swords className="h2h-vs-clash-l" size={40} color={NEON.cyan} style={{ position: 'absolute', filter: `drop-shadow(0 0 8px ${NEON.cyan})` }} />
                        <Swords className="h2h-vs-clash-r" size={40} color={NEON.pink} style={{ position: 'absolute', filter: `drop-shadow(0 0 8px ${NEON.pink})` }} />
                        <div className="h2h-spark" style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: NEON.yellow, boxShadow: `0 0 16px ${NEON.yellow}, 0 0 28px ${NEON.yellow}` }} />
                    </div>
                    <div style={{
                        position: 'absolute', bottom: -8,
                        fontSize: 18, fontWeight: 900, letterSpacing: '0.2em',
                        background: `linear-gradient(135deg, ${NEON.cyan}, ${NEON.pink})`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>VS</div>
                </div>
                <FighterCard
                    side="right"
                    name={oppId ? profileName(oppProf, oppId) : 'WAITING…'}
                    profile={oppProf}
                    userId={oppId || ''}
                    color={NEON.pink}
                    isWaiting={!oppId}
                    ready={match.status === 'ready_check' ? oppReady : undefined}
                    submitted={match.status === 'producing' ? oppSubmitted : undefined}
                />
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', letterSpacing: '0.1em', marginBottom: 16 }}>
                {match.genre?.name || 'GLOBAL'} · {match.productionMinutes} MIN PRODUCTION
            </div>

            {/* Status-specific content */}
            {match.status === 'queued' && (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <Loader className="h2h-spin" size={28} color={NEON.cyan} style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                        Scanning the arena for a worthy challenger…
                    </p>
                    <div style={{ marginTop: 14 }}>
                        <NeonButton onClick={onLeave} color={NEON.red} size="sm">Leave Queue</NeonButton>
                    </div>
                </div>
            )}

            {match.status === 'ready_check' && (
                <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                        Both fighters must lock in. The production timer starts when you both ready up.
                    </p>
                    <NeonButton onClick={ready} disabled={meReady || readying} color={meReady ? NEON.green : NEON.yellow} size="lg">
                        <CheckCircle size={18} /> {meReady ? 'LOCKED IN' : 'READY UP'}
                    </NeonButton>
                </div>
            )}

            {match.status === 'producing' && (
                <div>
                    {match.samples && match.samples.length > 0 && (
                        <SamplePack samples={match.samples} matchId={match.id} />
                    )}
                    <div style={{ textAlign: 'center' }}>
                        <label style={{
                            display: 'inline-flex', alignItems: 'center', gap: 10,
                            background: `linear-gradient(135deg, ${NEON.pink}cc, ${NEON.pink}88)`,
                            color: '#fff', padding: '14px 28px',
                            borderRadius: 10, cursor: submitting ? 'wait' : 'pointer',
                            fontWeight: 800, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase',
                            border: `1px solid ${NEON.pink}`,
                            boxShadow: `0 0 18px ${NEON.pink}66`,
                        }}>
                            <Upload size={18} /> {submitting ? 'Uploading…' : (mySubmitted ? 'Replace Submission' : 'Submit Track')}
                            <input type="file" accept="audio/*" style={{ display: 'none' }}
                                disabled={submitting}
                                onChange={e => e.target.files?.[0] && submit(e.target.files[0])} />
                        </label>
                    </div>

                    {/* Listen to submitted tracks — your own once submitted, opponent's once both have submitted */}
                    {mySubmitted && (() => {
                        const myUrl = isCh ? match.challengerSubmissionUrl : match.opponentSubmissionUrl;
                        const oppUrl = isCh ? match.opponentSubmissionUrl : match.challengerSubmissionUrl;
                        return (
                            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Your submission */}
                                <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${NEON.cyan}44`, borderRadius: 10, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: NEON.cyan, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                        Your Submission
                                    </div>
                                    <audio controls src={`${API}${myUrl!.startsWith('http') ? '' : ''}${myUrl!}`} style={{ width: '100%', accentColor: NEON.cyan }} />
                                </div>
                                {/* Opponent's submission — only shown once they've submitted too */}
                                {oppSubmitted && oppUrl ? (
                                    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${NEON.pink}44`, borderRadius: 10, padding: '12px 16px' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: NEON.pink, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                            Opponent's Submission
                                        </div>
                                        <audio controls src={`${API}${oppUrl.startsWith('http') ? '' : ''}${oppUrl}`} style={{ width: '100%', accentColor: NEON.pink }} />
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '8px 0' }}>
                                        Waiting for opponent to submit their track…
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {match.status === 'voting' && (
                <div style={{ padding: '8px 0' }}>
                    <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center' }}>
                        Submissions locked. Other competitors are casting their votes.
                    </p>
                    {/* Both players can hear each other's tracks while being judged */}
                    {(() => {
                        const myUrl = isCh ? match.challengerSubmissionUrl : match.opponentSubmissionUrl;
                        const oppUrl = isCh ? match.opponentSubmissionUrl : match.challengerSubmissionUrl;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {myUrl && (
                                    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${NEON.cyan}44`, borderRadius: 10, padding: '12px 16px' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: NEON.cyan, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                            Your Track
                                        </div>
                                        <audio controls src={`${myUrl.startsWith('http') ? '' : API}${myUrl}`} style={{ width: '100%', accentColor: NEON.cyan }} />
                                    </div>
                                )}
                                {oppUrl && (
                                    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${NEON.pink}44`, borderRadius: 10, padding: '12px 16px' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: NEON.pink, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                            Opponent's Track
                                        </div>
                                        <audio controls src={`${oppUrl.startsWith('http') ? '' : API}${oppUrl}`} style={{ width: '100%', accentColor: NEON.pink }} />
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {match.status === 'melodics_vote' && (
                <div>
                    {(() => {
                        // A category is "unavailable" when the backend pre-set both players' votes
                        // to false because no samples exist for it in the chosen genre.
                        const unavailable = {
                            bass:   match.challengerVoteBass   === false && match.opponentVoteBass   === false,
                            melody: match.challengerVoteMelody === false && match.opponentVoteMelody === false,
                            chords: match.challengerVoteChords === false && match.opponentVoteChords === false,
                        };
                        const allCats = ([
                            { key: 'bass',   label: 'BASS',   color: CATEGORY_COLORS.bass },
                            { key: 'melody', label: 'MELODY', color: CATEGORY_COLORS.melody },
                            { key: 'chords', label: 'CHORDS', color: CATEGORY_COLORS.chords },
                        ] as const).filter(c => !unavailable[c.key]);
                        if (allCats.length === 0) {
                            return (
                                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }}>
                                    No melodic categories are available for this genre - the match is starting with the standard kit.
                                </p>
                            );
                        }
                        return <>
                            <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center' }}>
                                Both fighters vote - you only get the melodics you <b style={{ color: '#fff' }}>both agree on</b>.
                                You'll always get kick, snare, hat, percussion & fx.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
                                {allCats.map(c => {
                            const my = draftM[c.key];
                            const opp = oppMVotes[c.key];
                            return (
                                <div key={c.key} style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${my ? c.color : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: 10, padding: 12,
                                    boxShadow: my ? `0 0 14px ${c.color}55` : 'none',
                                    transition: 'all 0.15s',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: c.color }}>{c.label}</span>
                                        {oppMSubmitted && (
                                            <span title={`Opponent voted ${opp ? 'YES' : 'NO'}`} style={{
                                                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                                                color: opp ? NEON.green : 'rgba(255,255,255,0.4)',
                                                padding: '2px 6px', borderRadius: 4,
                                                border: `1px solid ${opp ? NEON.green : 'rgba(255,255,255,0.15)'}`,
                                            }}>
                                                OPP {opp ? '✓' : '✗'}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            onClick={() => setPendingM({ ...draftM, [c.key]: true })}
                                            disabled={myMSubmitted || submittingM}
                                            style={{
                                                flex: 1, padding: '8px',
                                                background: my ? `linear-gradient(135deg, ${c.color}, ${c.color}cc)` : 'transparent',
                                                color: my ? '#000' : 'rgba(255,255,255,0.7)',
                                                border: `1px solid ${my ? c.color : 'rgba(255,255,255,0.15)'}`,
                                                borderRadius: 6, cursor: myMSubmitted ? 'not-allowed' : 'pointer',
                                                fontWeight: 800, fontSize: 11, letterSpacing: '0.08em',
                                            }}>YES</button>
                                        <button
                                            onClick={() => setPendingM({ ...draftM, [c.key]: false })}
                                            disabled={myMSubmitted || submittingM}
                                            style={{
                                                flex: 1, padding: '8px',
                                                background: !my ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                color: !my ? '#fff' : 'rgba(255,255,255,0.5)',
                                                border: `1px solid ${!my ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                borderRadius: 6, cursor: myMSubmitted ? 'not-allowed' : 'pointer',
                                                fontWeight: 800, fontSize: 11, letterSpacing: '0.08em',
                                            }}>NO</button>
                                    </div>
                                </div>
                            );
                        })}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <NeonButton onClick={submitMelodics}
                                    disabled={myMSubmitted || submittingM}
                                    color={myMSubmitted ? NEON.green : NEON.purple} size="lg">
                                    <CheckCircle size={18} /> {myMSubmitted ? 'VOTE LOCKED' : (submittingM ? 'LOCKING…' : 'LOCK MY VOTE')}
                                </NeonButton>
                                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>
                                    {myMSubmitted && !oppMSubmitted ? 'Waiting on opponent…'
                                        : !myMSubmitted ? 'Lock your vote before the timer runs out - unsubmitted votes count as NO.'
                                        : 'Both locked in - match is starting…'}
                                </div>
                            </div>
                        </>;
                    })()}
                </div>
            )}

            {/* Forfeit button - available during ready_check / melodics_vote / producing */}
            {(match.status === 'ready_check' || match.status === 'melodics_vote' || match.status === 'producing') && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <button onClick={forfeit} disabled={forfeiting}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'transparent', color: NEON.red,
                            border: `1px solid ${NEON.red}66`,
                            padding: '8px 16px', borderRadius: 8,
                            fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                            cursor: forfeiting ? 'wait' : 'pointer',
                            opacity: forfeiting ? 0.6 : 0.9,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${NEON.red}11`; e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.9'; }}>
                        <Skull size={13} /> {forfeiting ? 'Forfeiting…' : 'Forfeit Match'}
                    </button>
                </div>
            )}
        </Panel>
    );
};

const FighterCard: React.FC<{
    side: 'left' | 'right';
    name: string;
    profile: Profile | null | undefined;
    userId: string;
    color: string;
    isYou?: boolean;
    isWaiting?: boolean;
    ready?: boolean;
    submitted?: boolean;
}> = ({ side, name, profile, userId, color, isYou, isWaiting, ready, submitted }) => (
    <div style={{
        background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, ${color}1a, transparent)`,
        border: `1px solid ${color}55`,
        borderRadius: 12,
        padding: '14px',
        textAlign: side === 'left' ? 'left' : 'right',
        position: 'relative',
        overflow: 'hidden',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: side === 'left' ? 'row' : 'row-reverse' }}>
            <Avatar profile={profile} userId={userId} size={56} ring={color} ringPulse={!isWaiting} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: color, letterSpacing: '0.15em', fontWeight: 800 }}>
                    {isYou ? 'YOU' : isWaiting ? 'OPPONENT' : 'CHALLENGER'}
                </div>
                <div style={{
                    fontWeight: 800, fontSize: 16, color: '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textShadow: `0 0 8px ${color}55`,
                }}>{name}</div>
                {ready != null && (
                    <div style={{ marginTop: 4, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: ready ? NEON.green : 'rgba(255,255,255,0.4)' }}>
                        {ready ? '✓ LOCKED IN' : '○ NOT READY'}
                    </div>
                )}
                {submitted != null && (
                    <div style={{ marginTop: 4, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: submitted ? NEON.green : 'rgba(255,255,255,0.4)' }}>
                        {submitted ? '✓ SUBMITTED' : '○ PENDING'}
                    </div>
                )}
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sample Pack player
// ─────────────────────────────────────────────────────────────────────────────
const SamplePack: React.FC<{ samples: Sample[]; matchId: string }> = ({ samples, matchId }) => {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ id: string; cur: number; dur: number } | null>(null);
    const [zipping, setZipping] = useState(false);
    const [peaksMap, setPeaksMap] = useState<Record<string, number[] | 'loading' | 'failed'>>({});
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const stop = () => {
        const a = audioRef.current;
        if (a) { a.pause(); a.currentTime = 0; }
        setPlayingId(null);
        setProgress(null);
    };

    const play = (s: Sample) => {
        if (playingId === s.id) { stop(); return; }
        const a = audioRef.current;
        if (!a) return;
        a.pause();
        a.src = s.fileUrl;
        a.currentTime = 0;
        a.play().catch(() => {});
        setPlayingId(s.id);
        setProgress({ id: s.id, cur: 0, dur: 0 });
    };

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const onTime = () => setProgress(p => p ? { ...p, cur: a.currentTime, dur: a.duration || 0 } : p);
        const onEnd = () => stop();
        a.addEventListener('timeupdate', onTime);
        a.addEventListener('loadedmetadata', onTime);
        a.addEventListener('ended', onEnd);
        return () => {
            a.removeEventListener('timeupdate', onTime);
            a.removeEventListener('loadedmetadata', onTime);
            a.removeEventListener('ended', onEnd);
        };
    }, []);

    const fmt = (s: number) => {
        if (!isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const proxyUrl = (s: Sample) => `${API}/api/head-to-head/match/${matchId}/sample/${s.id}`;

    // Decode each sample to a peak array for waveform rendering. Runs once per sample.
    useEffect(() => {
        let cancelled = false;
        const ctx = audioCtxRef.current ?? (audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)());
        const PEAK_BARS = 56;
        const decode = async (s: Sample) => {
            setPeaksMap(prev => ({ ...prev, [s.id]: 'loading' }));
            try {
                const r = await fetch(proxyUrl(s), { credentials: 'include' });
                if (!r.ok) throw new Error('fetch failed');
                const buf = await r.arrayBuffer();
                const audio = await ctx.decodeAudioData(buf.slice(0));
                const ch = audio.getChannelData(0);
                const blockSize = Math.max(1, Math.floor(ch.length / PEAK_BARS));
                const peaks: number[] = [];
                let max = 0;
                for (let i = 0; i < PEAK_BARS; i++) {
                    const start = i * blockSize;
                    const end = Math.min(ch.length, start + blockSize);
                    let sum = 0;
                    for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
                    const v = sum / Math.max(1, end - start);
                    peaks.push(v);
                    if (v > max) max = v;
                }
                const norm = max > 0 ? peaks.map(p => p / max) : peaks;
                if (!cancelled) setPeaksMap(prev => ({ ...prev, [s.id]: norm }));
            } catch {
                if (!cancelled) setPeaksMap(prev => ({ ...prev, [s.id]: 'failed' }));
            }
        };
        for (const s of samples) {
            if (peaksMap[s.id] === undefined) decode(s);
        }
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [samples.map(s => s.id).join('|')]);

    const downloadOne = async (s: Sample) => {
        try {
            const r = await fetch(proxyUrl(s), { credentials: 'include' });
            if (!r.ok) throw new Error('fetch failed');
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${s.category || 'sample'}_${s.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // Fallback: hit the proxy directly (it sets Content-Disposition: attachment)
            window.location.href = proxyUrl(s);
        }
    };

    const downloadZip = async () => {
        if (!samples.length) return;
        setZipping(true);
        try {
            const zip = new JSZip();
            const folder = zip.folder(`h2h_pack_${matchId.slice(0, 8)}`)!;
            await Promise.all(samples.map(async s => {
                try {
                    const r = await fetch(proxyUrl(s), { credentials: 'include' });
                    if (!r.ok) return;
                    const buf = await r.arrayBuffer();
                    const cat = (s.category || 'sample').toLowerCase();
                    const safe = s.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    folder.file(`${cat}_${safe}`, buf);
                } catch { /* skip failed */ }
            }));
            folder.file('README.txt',
`Head-to-Head Sample Pack
Match: ${matchId}
Samples: ${samples.length}

Use these in your DAW. Build something fierce.`);
            const out = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(out);
            const a = document.createElement('a');
            a.href = url;
            a.download = `h2h_pack_${matchId.slice(0, 8)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setZipping(false);
        }
    };

    return (
        <div style={{
            marginBottom: 18,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(0,229,255,0.04))',
            border: `1px solid ${NEON.border}`, borderRadius: 12, padding: 14,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, marginBottom: 12, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Headphones size={16} color={NEON.cyan} style={{ filter: `drop-shadow(0 0 6px ${NEON.cyan})` }} />
                    <div style={{ fontSize: 11, color: '#fff', letterSpacing: '0.16em', fontWeight: 800 }}>
                        YOUR WEAPONS
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontWeight: 700 }}>
                        · {samples.length} SAMPLE{samples.length === 1 ? '' : 'S'}
                    </div>
                </div>
                <button onClick={downloadZip} disabled={zipping}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: `linear-gradient(135deg, ${NEON.cyan}33, ${NEON.purple}33)`,
                        color: '#fff', border: `1px solid ${NEON.cyan}88`,
                        padding: '8px 14px', borderRadius: 8,
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: zipping ? 'wait' : 'pointer',
                        boxShadow: `0 0 12px ${NEON.cyan}33`,
                    }}>
                    {zipping ? <Loader size={13} className="h2h-spin" /> : <Package size={13} />}
                    {zipping ? 'Zipping…' : 'Download Pack (.zip)'}
                </button>
            </div>

            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {samples.map(s => {
                    const cat = (s.category || 'other').toLowerCase();
                    const catColor = CATEGORY_COLORS[cat] || NEON.purple;
                    const isPlaying = playingId === s.id;
                    const cur = isPlaying && progress?.id === s.id ? progress.cur : 0;
                    const dur = isPlaying && progress?.id === s.id ? progress.dur : 0;
                    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
                    return (
                        <div key={s.id} style={{
                            background: isPlaying
                                ? `linear-gradient(135deg, ${catColor}22, ${catColor}08)`
                                : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isPlaying ? catColor : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 10, padding: 10,
                            transition: 'all 0.2s',
                            boxShadow: isPlaying ? `0 0 14px ${catColor}55` : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <button onClick={() => play(s)}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: isPlaying
                                            ? `linear-gradient(135deg, ${catColor}, ${catColor}cc)`
                                            : 'rgba(255,255,255,0.06)',
                                        border: `1px solid ${isPlaying ? catColor : 'rgba(255,255,255,0.15)'}`,
                                        color: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: isPlaying ? `0 0 10px ${catColor}` : 'none',
                                        flexShrink: 0,
                                    }}
                                    title={isPlaying ? 'Pause' : 'Play'}>
                                    {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                                        color: catColor, marginBottom: 2,
                                    }}>
                                        {cat.toUpperCase()}
                                    </div>
                                    <div style={{
                                        fontSize: 12, fontWeight: 600, color: '#fff',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }} title={s.name}>{s.name}</div>
                                </div>
                                <button onClick={() => downloadOne(s)}
                                    title="Download this sample"
                                    style={{
                                        width: 30, height: 30, borderRadius: 6,
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                    <Download size={13} />
                                </button>
                            </div>
                            <div
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                    const a = audioRef.current;
                                    if (isPlaying && a && a.duration) {
                                        a.currentTime = ratio * a.duration;
                                    } else {
                                        play(s);
                                    }
                                }}
                                style={{
                                    position: 'relative', height: 38, cursor: 'pointer',
                                    background: 'rgba(0,0,0,0.25)',
                                    borderRadius: 6, overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}
                            >
                                {(() => {
                                    const entry = peaksMap[s.id];
                                    if (entry === 'loading' || entry === undefined) {
                                        return (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)' }}>
                                                ANALYZING…
                                            </div>
                                        );
                                    }
                                    if (entry === 'failed') {
                                        // Fallback: thin progress bar
                                        return (
                                            <div style={{
                                                position: 'absolute', left: 0, top: '50%', height: 2, width: `${pct}%`,
                                                background: catColor, transform: 'translateY(-50%)',
                                                boxShadow: isPlaying ? `0 0 8px ${catColor}` : 'none',
                                            }} />
                                        );
                                    }
                                    const peaks = entry;
                                    return (
                                        <svg width="100%" height="100%" viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" style={{ display: 'block' }}>
                                            {peaks.map((p, i) => {
                                                const h = Math.max(2, p * 92);
                                                const passed = (i / peaks.length) * 100 < pct;
                                                return (
                                                    <rect
                                                        key={i}
                                                        x={i + 0.15}
                                                        y={50 - h / 2}
                                                        width={0.7}
                                                        height={h}
                                                        fill={passed ? catColor : 'rgba(255,255,255,0.22)'}
                                                        style={passed && isPlaying ? { filter: `drop-shadow(0 0 1.5px ${catColor})` } : undefined}
                                                    />
                                                );
                                            })}
                                        </svg>
                                    );
                                })()}
                            </div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                marginTop: 4, fontFamily: 'monospace', fontSize: 10,
                                color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums',
                            }}>
                                <span>{fmt(cur)}</span>
                                <span>{fmt(dur)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Submission player with full waveform (used on the voting page)
// ─────────────────────────────────────────────────────────────────────────────

const SubmissionPlayer: React.FC<{ matchId: string; side: 'challenger' | 'opponent'; color: string }> = ({ matchId, side, color }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [cur, setCur] = useState(0);
    const [dur, setDur] = useState(0);
    const [peaks, setPeaks] = useState<number[] | null | 'failed'>(null);
    const proxyUrl = `${API}/api/head-to-head/match/${matchId}/submission/${side}`;

    useEffect(() => {
        let cancelled = false;
        const PEAK_BARS = 140;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        (async () => {
            try {
                const r = await fetch(proxyUrl, { credentials: 'include' });
                if (!r.ok) throw new Error('fetch failed');
                const buf = await r.arrayBuffer();
                const audio = await ctx.decodeAudioData(buf.slice(0));
                const ch = audio.getChannelData(0);
                const blockSize = Math.max(1, Math.floor(ch.length / PEAK_BARS));
                const out: number[] = [];
                let max = 0;
                for (let i = 0; i < PEAK_BARS; i++) {
                    const start = i * blockSize;
                    const end = Math.min(ch.length, start + blockSize);
                    let sum = 0;
                    for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
                    const v = sum / Math.max(1, end - start);
                    out.push(v);
                    if (v > max) max = v;
                }
                if (!cancelled) setPeaks(max > 0 ? out.map(p => p / max) : out);
            } catch {
                if (!cancelled) setPeaks('failed');
            } finally {
                try { ctx.close(); } catch {}
            }
        })();
        return () => { cancelled = true; };
    }, [proxyUrl]);

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const onTime = () => { setCur(a.currentTime); setDur(a.duration || 0); };
        const onEnd = () => { setPlaying(false); setCur(0); };
        a.addEventListener('timeupdate', onTime);
        a.addEventListener('loadedmetadata', onTime);
        a.addEventListener('ended', onEnd);
        return () => {
            a.removeEventListener('timeupdate', onTime);
            a.removeEventListener('loadedmetadata', onTime);
            a.removeEventListener('ended', onEnd);
        };
    }, []);

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) { a.pause(); setPlaying(false); }
        else { a.play().then(() => setPlaying(true)).catch(() => {}); }
    };

    const fmt = (s: number) => {
        if (!isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <button onClick={toggle}
                    style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: playing ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${playing ? color : 'rgba(255,255,255,0.18)'}`,
                        color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: playing ? `0 0 14px ${color}` : 'none',
                        flexShrink: 0,
                    }}
                    title={playing ? 'Pause' : 'Play'}>
                    {playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
                </button>
                <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                    <span>{fmt(cur)}</span>
                    <span>{fmt(dur)}</span>
                </div>
            </div>
            <div
                onClick={(e) => {
                    const a = audioRef.current;
                    if (!a || !a.duration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    a.currentTime = ratio * a.duration;
                }}
                style={{
                    position: 'relative', height: 64, cursor: 'pointer',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 8, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.05)',
                }}>
                {peaks === null ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)' }}>
                        ANALYZING WAVEFORM…
                    </div>
                ) : peaks === 'failed' ? (
                    <div style={{ position: 'absolute', left: 0, top: '50%', height: 2, width: `${pct}%`, background: color, transform: 'translateY(-50%)', boxShadow: `0 0 8px ${color}` }} />
                ) : (
                    <svg width="100%" height="100%" viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" style={{ display: 'block' }}>
                        {peaks.map((p, i) => {
                            const h = Math.max(2, p * 94);
                            const passed = (i / peaks.length) * 100 < pct;
                            return (
                                <rect
                                    key={i}
                                    x={i + 0.1}
                                    y={50 - h / 2}
                                    width={0.8}
                                    height={h}
                                    fill={passed ? color : 'rgba(255,255,255,0.22)'}
                                    style={passed && playing ? { filter: `drop-shadow(0 0 1.5px ${color})` } : undefined}
                                />
                            );
                        })}
                    </svg>
                )}
            </div>
            <audio ref={audioRef} src={proxyUrl} preload="metadata" />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Vote Tab
// ─────────────────────────────────────────────────────────────────────────────
const VoteTab: React.FC = () => {
    const [data, setData] = useState<{ eligible: boolean; reason?: string; matches: VotingMatch[] } | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(true);
    const [, force] = useState(0);
    useEffect(() => { const t = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(t); }, []);

    const reload = async () => {
        const res = await fetch(`${API}/api/head-to-head/voting/queue`, { credentials: 'include' });
        if (res.status === 401 || res.status === 403) setIsLoggedIn(false);
        if (res.ok) setData(await res.json());
        setLoaded(true);
    };

    useEffect(() => { reload(); }, []);

    const vote = async (matchId: string, voteFor: string) => {
        await fetch(`${API}/api/head-to-head/match/${matchId}/vote`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voteFor }),
        });
        await reload();
    };

    if (!loaded) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader className="h2h-spin" size={32} color={NEON.cyan} />
        </div>
    );

    if (!isLoggedIn) return (
        <Panel glowColor={NEON.cyan}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Vote size={40} color={NEON.cyan} style={{ opacity: 0.7, marginBottom: 12 }} />
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    Sign In to Judge
                </div>
                <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
                    Any logged-in member can listen to both tracks and cast a vote. Your judgement shapes the leaderboard.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, background: `linear-gradient(135deg, ${NEON.cyan}, ${NEON.purple})`, color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', letterSpacing: '0.04em', boxShadow: `0 0 18px ${NEON.cyan}55` }}>
                        <Vote size={15} /> Sign In to Vote
                    </a>
                    <a href="/login?tab=register" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)' }}>
                        Create Account
                    </a>
                </div>
            </div>
        </Panel>
    );
    if (!data || data.matches.length === 0) return (
        <Panel>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Headphones size={36} color={NEON.cyan} style={{ opacity: 0.6, marginBottom: 8 }} />
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>No matches need judges right now.</p>
                <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Check back soon - fresh battles drop constantly.</p>
            </div>
        </Panel>
    );

    return (
        <div>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' }}>
                Vote for the better track. Your vote is anonymous — producers can't see who voted.
            </div>
            {data.matches.map(m => {
                const chName = profileName(m.challengerProfile, m.challengerId);
                const opName = m.opponentId ? profileName(m.opponentProfile, m.opponentId) : '-';
                const tl = timeLeft(m.votingEnd);
                return (
                    <Panel key={m.id} glowColor={NEON.cyan}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `${NEON.purple}22`, border: `1px solid ${NEON.purple}66`, color: NEON.purple, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>
                                    <Headphones size={12} /> {m.genre?.name || 'GLOBAL'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Clock size={12} color={tl.urgent ? NEON.red : 'rgba(255,255,255,0.5)'} />
                                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: tl.urgent ? NEON.red : 'rgba(255,255,255,0.7)' }}>{tl.txt}</span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                            {[
                                { id: m.challengerId, name: chName, profile: m.challengerProfile, url: m.challengerSubmissionUrl, color: NEON.cyan, side: 'challenger' as const },
                                { id: m.opponentId!, name: opName, profile: m.opponentProfile, url: m.opponentSubmissionUrl, color: NEON.pink, side: 'opponent' as const },
                            ].map(side => {
                                const isMine = m.myVote === side.id;
                                return (
                                    <div key={side.id} style={{
                                        background: isMine ? `linear-gradient(135deg, ${side.color}22, ${side.color}11)` : 'rgba(255,255,255,0.03)',
                                        padding: 14, borderRadius: 10,
                                        border: isMine ? `2px solid ${side.color}` : `1px solid ${NEON.border}`,
                                        boxShadow: isMine ? `0 0 18px ${side.color}55` : 'none',
                                        position: 'relative',
                                    }}>
                                        {isMine && (
                                            <span style={{ position: 'absolute', top: 10, right: 10, background: side.color, color: '#000', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 999, letterSpacing: '0.1em' }}>
                                                YOUR PICK
                                            </span>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <Avatar profile={side.profile} userId={side.id} size={40} ring={side.color} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{side.name}</div>
                                            </div>
                                        </div>
                                        {side.url ? (
                                            <SubmissionPlayer matchId={m.id} side={side.side} color={side.color} />
                                        ) : <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 10px' }}>No submission</p>}
                                        <NeonButton onClick={() => vote(m.id, side.id)} disabled={isMine} color={side.color} size="sm" style={{ width: '100%', justifyContent: 'center' }}>
                                            <Award size={14} /> {isMine ? 'Voted' : `Vote ${side.name.split(/\s+/)[0]}`}
                                        </NeonButton>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>
                );
            })}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Rules Tab - explains every phase of a 1v1
// ─────────────────────────────────────────────────────────────────────────────

const RulesTab: React.FC<{ settings: Settings | null }> = ({ settings }) => {
    const ready = settings?.readyUpMinutes ?? 2;
    const prod  = settings?.defaultProductionMinutes ?? 60;
    const vote  = settings?.defaultVotingMinutes ?? 30;
    const minVotes = settings?.minVotesToFinalize ?? 3;

    const phase = (n: number, color: string, Icon: any, title: string, time: string, body: React.ReactNode) => (
        <div style={{
            display: 'grid', gridTemplateColumns: '60px 1fr', gap: 14, alignItems: 'flex-start',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${color}33`,
            borderLeft: `3px solid ${color}`,
            borderRadius: 10, padding: 14,
        }}>
            <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                border: `1px solid ${color}88`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, boxShadow: `0 0 14px ${color}44`,
                position: 'relative',
            }}>
                <Icon size={22} />
                <span style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#000', border: `1px solid ${color}`,
                    color, fontSize: 11, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{n}</span>
            </div>
            <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color }}>{title}</h4>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)' }}>{time}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>{body}</div>
            </div>
        </div>
    );

    const ruleCard = (Icon: any, color: string, title: string, body: React.ReactNode) => (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: 14,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={16} color={color} />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.1em', color: '#fff' }}>{title}</h4>
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>{body}</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Panel glowColor={NEON.purple}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <BookOpen size={26} color={NEON.purple} />
                    <div>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '0.06em' }}>HOW IT WORKS</h3>
                        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                            Two producers. One sample pack. May the best beat win.
                        </p>
                    </div>
                </div>
            </Panel>

            <Panel glowColor={NEON.cyan}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)' }}>THE PHASES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {phase(1, NEON.cyan, Target, 'Queue Up',
                        'Instant',
                        <>Pick a genre (or Global) and how long you want to produce. You'll be matched with the next producer who picks the same combo. The wait is usually seconds.</>)}

                    {phase(2, NEON.yellow, CheckCircle, 'Ready Up',
                        `${ready} min`,
                        <>Both fighters must hit <b style={{ color: '#fff' }}>READY UP</b>. If one of you doesn't lock in, the other one wins by default. If neither readies, the match is cancelled.</>)}

                    {phase(3, NEON.purple, Vote, 'Pick Melodics (Together)',
                        '45 sec',
                        <>You and your opponent each vote <b style={{ color: '#fff' }}>YES/NO</b> on Bass, Melody and Chords. You only get the categories you <b style={{ color: '#fff' }}>both</b> agree on. Kick, snare, hat, percussion and FX are always included. Unsubmitted votes count as NO.</>)}

                    {phase(4, NEON.pink, Headphones, 'Production',
                        `${prod} min`,
                        <>The chosen sample pack drops in your arena. Preview each sample (with full waveforms!) and download them individually or as a zip. Build your beat in the DAW of your choice and upload an audio file before the timer hits zero. The match auto-advances the moment <b style={{ color: '#fff' }}>both</b> tracks are in.</>)}

                    {phase(5, NEON.purple, Award, 'Anonymous Judging',
                        `${vote} min`,
                        <>Both submissions go to the <b style={{ color: '#fff' }}>JUDGE</b> tab. Voters see them as MYSTERY PRODUCER A vs B (no names, no avatars) so it's the music that wins. You need at least <b style={{ color: '#fff' }}>{minVotes} votes</b> for the match to finalize; under-voted matches get a 50% time extension automatically.</>)}

                    {phase(6, NEON.green, Trophy, 'Reveal & Elo',
                        'Final',
                        <>Most votes wins. Tie? Whoever submitted first takes it. Once the match completes, identities are revealed to everyone, Elo is updated, and the result lands in your match history.</>)}
                </div>
            </Panel>

            <Panel glowColor={NEON.yellow}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)' }}>THE RULES</h3>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                    {ruleCard(Sparkles, NEON.cyan, 'Use the Sample Pack',
                        <>The provided samples are the spine of your track. Layer your own sounds on top, but the kit you were dealt should be recognizable in the final beat.</>)}
                    {ruleCard(Users, NEON.purple, 'Stay Anonymous',
                        <>Don't leak your identity in metadata, watermarks, voice tags, or DMs while voting is open. Anonymity protects the integrity of every battle.</>)}
                    {ruleCard(Skull, NEON.red, 'Forfeits Count',
                        <>You can forfeit any time before voting opens. Forfeit while your opponent has submitted = they win. Both no-shows = double forfeit. Forfeits hit your record.</>)}
                    {ruleCard(Vote, NEON.cyan, 'Vote Honest',
                        <>Vote on what you actually hear, not who you think made it. Vote brigading, sock-puppet accounts, or trades will get your votes nuked and your access to the Arena yanked.</>)}
                    {ruleCard(Upload, NEON.pink, 'One Submission',
                        <>You can re-upload to replace your file as many times as you want before the production timer ends. Once it ends, what's on the server is final.</>)}
                    {ruleCard(TrendingUp, NEON.green, 'Elo & Ranks',
                        <>Wins push your Elo up, losses pull it down. The further apart your ratings, the bigger the swing for the underdog. Genre Elos are tracked separately from your Global rating.</>)}
                </div>
            </Panel>

            <Panel glowColor={NEON.pink}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)' }}>QUICK FAQ</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                        ['Can I change my submission?', 'Yes, until the production timer hits zero. Just upload a new file and it overwrites the previous one.'],
                        ['What audio formats are accepted?', 'Standard formats: MP3, WAV, FLAC, OGG. Aim for a clean stereo mix; no need for mastering chains.'],
                        ['What if my opponent disappears?', 'If they don\'t ready up, vote on melodics, or submit before the deadline, you win automatically and they take a forfeit on their record.'],
                        ['Can I vote on my own match?', 'No. Participants cannot vote on their own match, but any other logged-in member can judge.'],
                        ['When are identities revealed?', 'Only after the match reaches a terminal state (completed, forfeited, or cancelled). Until then everyone sees Mystery Producer aliases.'],
                    ].map(([q, a]) => (
                        <div key={q}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: NEON.pink, marginBottom: 4 }}>{q}</div>
                            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>{a}</div>
                        </div>
                    ))}
                </div>
            </Panel>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard Tab
// ─────────────────────────────────────────────────────────────────────────────

const LeaderboardTab: React.FC = () => {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [genreId, setGenreId] = useState<string>('');
    const [rows, setRows] = useState<LeaderRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async (g: string) => {
        setLoading(true);
        const url = g ? `${API}/api/head-to-head/leaderboard?genreId=${g}` : `${API}/api/head-to-head/leaderboard`;
        const res = await fetch(url);
        if (res.ok) setRows(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetch(`${API}/api/head-to-head/genres`).then(r => r.json()).then(d => setGenres(d.genres || []));
        load('');
    }, []);

    useEffect(() => { load(genreId); }, [genreId]);

    const podium = rows.slice(0, 3);
    const rest = rows.slice(3);
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean); // 2-1-3 layout

    return (
        <div>
            <Panel glowColor={NEON.yellow}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Trophy size={22} color={NEON.yellow} />
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>HALL OF CHAMPIONS</h3>
                    </div>
                    <select value={genreId} onChange={e => setGenreId(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: 200 }}>
                        <option value="">⚡ Global Rankings</option>
                        {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <Loader className="h2h-spin" size={28} color={NEON.cyan} />
                    </div>
                ) : rows.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 20 }}>No rankings yet - be the first.</p>
                ) : (
                    <>
                        {/* Podium */}
                        {podium.length > 0 && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${podiumOrder.length}, 1fr)`,
                                gap: 12, marginBottom: 18, alignItems: 'end',
                            }}>
                                {podiumOrder.map(p => {
                                    const isFirst = p.rank === 1;
                                    const isSecond = p.rank === 2;
                                    const podiumColor = isFirst ? NEON.yellow : isSecond ? '#C0C0C0' : '#CD7F32';
                                    const height = isFirst ? 200 : isSecond ? 170 : 150;
                                    return (
                                        <div key={p.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <Avatar profile={p.profile} userId={p.userId} size={isFirst ? 72 : 56} ring={podiumColor} ringPulse={isFirst} />
                                            <div style={{ marginTop: 8, fontWeight: 800, fontSize: 13, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                {profileName(p.profile, p.userId)}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{p.wins}W · {p.losses}L</div>
                                            <div style={{
                                                width: '100%', height,
                                                background: `linear-gradient(180deg, ${podiumColor}cc, ${podiumColor}33)`,
                                                borderRadius: '10px 10px 0 0',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                                                paddingTop: 14,
                                                boxShadow: `0 0 24px ${podiumColor}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
                                                position: 'relative',
                                            }}>
                                                <div style={{ fontSize: isFirst ? 36 : 28, fontWeight: 900, color: '#fff', textShadow: `0 0 14px ${podiumColor}` }}>#{p.rank}</div>
                                                <div style={{ fontSize: isFirst ? 22 : 18, fontWeight: 800, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{p.elo}</div>
                                                <div style={{ marginTop: 6 }}>
                                                    <TierBadge elo={p.elo} size="sm" />
                                                </div>
                                                {isFirst && (
                                                    <Crown size={28} color="#fff" style={{ position: 'absolute', top: -18, filter: `drop-shadow(0 0 8px ${podiumColor})` }} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Rest of leaderboard */}
                        {rest.length > 0 && (
                            <div>
                                {rest.map(r => {
                                    const t = tierFor(r.elo);
                                    return (
                                        <div key={r.userId} className="h2h-row-hover" style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 12px', borderRadius: 8,
                                            background: 'rgba(255,255,255,0.02)',
                                            marginBottom: 4,
                                        }}>
                                            <span style={{ width: 36, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>#{r.rank}</span>
                                            <Avatar profile={r.profile} userId={r.userId} size={36} ring={t.color} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {profileName(r.profile, r.userId)}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{r.wins}W · {r.losses}L · {r.matchesPlayed} battles</div>
                                            </div>
                                            <TierBadge elo={r.elo} size="sm" />
                                            <span style={{ fontSize: 16, fontWeight: 800, color: t.color, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 10px ${t.glow}`, minWidth: 50, textAlign: 'right' }}>
                                                {r.elo}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </Panel>
        </div>
    );
};
