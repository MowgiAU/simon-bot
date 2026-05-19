import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { colors, borderRadius, spacing } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { StyledUsername } from '../components/StyledUsername';
import {
    ArrowLeft, Swords, Play, Pause, Vote, Medal, LogIn, ExternalLink,
    Flame, MessageSquare, Trophy, Calendar, Users, Shield, Check, Upload,
    Download, Music, AlertCircle,
} from 'lucide-react';
import { BattleSubmitModal } from '../components/BattleSubmitModal';
import { flattenBattleEntry } from '../hooks/useBattleEntry';
import { appendSponsorRef, trackSponsorClick, trackPromoLinkClick } from '../lib/sponsorUtils';

const API = import.meta.env.VITE_API_URL || '';
const ACCENT = '#F97316';

// localStorage helpers — keyed per entry ID
const lsVoteKey = (entryId: string) => `fj_vote_${entryId}`;
const lsSetVote = (entryId: string, rank: number | null) => {
    try {
        if (rank === null || rank === 0) localStorage.removeItem(lsVoteKey(entryId));
        else localStorage.setItem(lsVoteKey(entryId), String(rank));
    } catch {}
};
const lsGetVote = (entryId: string): number | null => {
    try {
        const v = localStorage.getItem(lsVoteKey(entryId));
        if (v === '1' || v === '2' || v === '3') return Number(v);
        return null;
    } catch { return null; }
};

const statusConfig: Record<string, { label: string; color: string }> = {
    upcoming:  { label: 'UPCOMING',         color: '#60A5FA' },
    active:    { label: 'SUBMISSIONS OPEN', color: '#34D399' },
    voting:    { label: 'VOTING LIVE',      color: ACCENT },
    completed: { label: 'BATTLE ENDED',     color: '#FFD700' },
};

function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return '—';
    if (start && end) {
        const s = new Date(start);
        const e = new Date(end);
        const sameYear = s.getFullYear() === e.getFullYear();
        const startStr = s.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(sameYear ? {} : { year: 'numeric' }) });
        const endStr = e.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', year: 'numeric' });
        return `${startStr} – ${endStr}`;
    }
    return formatDate(start || end);
}

/** Render text that may contain [label](url) markdown links as React nodes */
function renderWithLinks(text: string): React.ReactNode[] {
    const parts = text.split(/\[([^\]]+)\]\(([^)]+)\)/g);
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 0) {
            if (parts[i]) nodes.push(parts[i]);
        } else if (i % 3 === 1) {
            const label = parts[i];
            const url = parts[i + 1] ?? '';
            if (url.match(/^https?:\/\//)) {
                nodes.push(
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        style={{ color: colors.primary, textDecoration: 'underline' }}>
                        {label}
                    </a>
                );
            } else {
                nodes.push(`[${label}](${url})`);
            }
            i++;
        }
    }
    return nodes;
}

/** Deterministic waveform heights for visual decoration */
function waveHeights(seed: string, count = 32): number[] {
    const heights: number[] = [];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
    for (let i = 0; i < count; i++) {
        h = (h * 1664525 + 1013904223) & 0xffffffff;
        heights.push(15 + Math.abs(h % 85));
    }
    return heights;
}

interface Battle {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    status: string;
    rules: string | null;
    rulesData?: { text: string; links?: { label: string; url: string }[]; samples?: { name: string; url: string }[] }[] | null;
    prizes: { place: string; title?: string; description: string; imageUrl?: string; link?: string }[] | null;
    submissionStart: string | null;
    submissionEnd: string | null;
    votingStart: string | null;
    votingEnd: string | null;
    slug?: string | null;
    winnerEntryId: string | null;
    bannerUrl: string | null;
    requireProjectFile?: boolean;
    suddenDeath?: { active: boolean; entryIds: string[]; start: string | null; end: string | null; durationMinutes: number } | null;
    discordInviteUrl: string | null;
    sponsor: {
        id: string;
        name: string;
        logoUrl: string | null;
        websiteUrl: string | null;
        description: string | null;
        links: { id: string; label: string; url: string }[];
    } | null;
    entries?: Entry[];
    _count?: { entries: number };
    createdAt: string;
}

interface Entry {
    id: string;
    userId: string;
    username: string;
    trackTitle: string;
    audioUrl: string;
    coverUrl: string | null;
    avatarUrl: string | null;
    description?: string | null;
    projectUrl?: string | null;
    duration?: number;
    voteCount: number;
    firstPlaceVotes?: number;
    secondPlaceVotes?: number;
    thirdPlaceVotes?: number;
    source: string;
    createdAt: string;
}

export const BattleDetailPage: React.FC = () => {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { player, setTrack, togglePlay } = usePlayer();

    const [battle, setBattle] = useState<Battle | null>(null);
    const [loading, setLoading] = useState(true);
    const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
    const [myRanks, setMyRanks] = useState<Record<string, number>>({});
    const [votingId, setVotingId] = useState<string | null>(null);
    const [voteNotification, setVoteNotification] = useState<{ message: string } | null>(null);
    const [sortOrder, setSortOrder] = useState<'recent' | 'top'>('recent');
    // Per-page-load shuffle seed: regenerated each time the component mounts
    // so voting entries appear in a fresh random order on every visit/refresh
    // and we don't bias voters toward the first-listed entries.
    const [shuffleSeed] = useState(() => Math.random());
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitToast, setSubmitToast] = useState(false);
    const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; label: string } | null>(null);

    // Rule sample audio player
    const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
    const [playingSampleUrl, setPlayingSampleUrl] = useState<string | null>(null);
    const [sampleIsPlaying, setSampleIsPlaying] = useState(false);

    useEffect(() => {
        const audio = new Audio();
        sampleAudioRef.current = audio;
        const onEnded = () => { setSampleIsPlaying(false); setPlayingSampleUrl(null); };
        audio.addEventListener('ended', onEnded);
        return () => { audio.removeEventListener('ended', onEnded); audio.pause(); };
    }, []);

    const toggleSample = (url: string) => {
        const audio = sampleAudioRef.current;
        if (!audio) return;
        const fullUrl = url.startsWith('http') ? url : `${API}${url}`;
        if (playingSampleUrl === url) {
            if (sampleIsPlaying) { audio.pause(); setSampleIsPlaying(false); }
            else { audio.play(); setSampleIsPlaying(true); }
        } else {
            audio.pause();
            audio.src = fullUrl;
            setPlayingSampleUrl(url);
            audio.play().then(() => setSampleIsPlaying(true)).catch(() => {});
        }
    };

    // Extract battleId from /battles/:id
    const battleId = pathname.split('/').filter(Boolean)[1];

    // Auto-dismiss vote notification
    useEffect(() => {
        if (!voteNotification) return;
        const t = setTimeout(() => setVoteNotification(null), 6000);
        return () => clearTimeout(t);
    }, [voteNotification]);

    // Restore voted state from localStorage + server.
    // Intentionally depends on battleId (not battle?.entries) so the post-vote
    // refresh of `battle` doesn't re-fire this effect and race against the
    // /my-votes fetch, which would clobber the freshly-set highlight.
    useEffect(() => {
        const entries = battle?.entries;
        if (!entries?.length) return;
        const localRanks: Record<string, number> = {};
        entries.forEach((e: any) => { const r = lsGetVote(e.id); if (r) localRanks[e.id] = r; });
        setMyRanks(localRanks);
        setVotedIds(new Set(Object.keys(localRanks)));
        if (!user || !battleId) return;
        const fetchMyVotes = async () => {
            try {
                const res = await fetch(`${API}/api/beat-battle/battles/${battleId}/my-votes`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const serverVotes: { entryId: string; rank: number }[] = Array.isArray(data.votes) ? data.votes : [];
                    const next: Record<string, number> = {};
                    serverVotes.forEach(v => { next[v.entryId] = v.rank; });
                    entries.forEach((e: any) => lsSetVote(e.id, next[e.id] ?? null));
                    setMyRanks(next);
                    setVotedIds(new Set(Object.keys(next)));
                }
            } catch {}
        };
        fetchMyVotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [battleId, battle?.id, user]);

    useEffect(() => {
        let _rt: ReturnType<typeof setTimeout>;
        const onResize = () => { clearTimeout(_rt); _rt = setTimeout(() => setIsMobile(window.innerWidth < 768), 150); };
        window.addEventListener('resize', onResize);
        return () => { clearTimeout(_rt); window.removeEventListener('resize', onResize); };
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!battle) return;
        const target =
            battle.status === 'sudden_death' ? battle.suddenDeath?.end || null :
            battle.status === 'voting'   ? battle.votingEnd :
            battle.status === 'active'   ? battle.submissionEnd :
            battle.status === 'upcoming' ? battle.submissionStart : null;
        const label =
            battle.status === 'sudden_death' ? 'Sudden Death ends in' :
            battle.status === 'voting'   ? 'Voting ends in' :
            battle.status === 'active'   ? 'Submissions close in' :
            battle.status === 'upcoming' ? 'Submissions open in' : '';
        if (!target) { setCountdown(null); return; }
        const update = () => {
            const diff = new Date(target).getTime() - Date.now();
            if (diff <= 0) { setCountdown(null); return; }
            setCountdown({
                days: Math.floor(diff / 86400000),
                hours: Math.floor((diff % 86400000) / 3600000),
                minutes: Math.floor((diff % 3600000) / 60000),
                label,
            });
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [battle]);

    useEffect(() => {
        if (!battleId) return;
        setLoading(true);
        fetch(`${API}/api/beat-battle/battles/${battleId}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                if (Array.isArray(data.entries)) {
                    data.entries = data.entries.map(flattenBattleEntry);
                }
                setBattle(data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [battleId]);

    useEffect(() => {
        if (!battle) return;
        document.title = `${battle.title} | Beat Battle | Fuji Studio`;
        const setMeta = (prop: string, content: string) => {
            let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
            if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
            el.setAttribute('content', content);
        };
        setMeta('og:title', `${battle.title} | Beat Battle`);
        setMeta('og:description', battle.description || 'Join the beat battle on Fuji Studio. Submit your track and win prizes.');
        setMeta('og:image', battle.bannerUrl ? `${API}${battle.bannerUrl}` : 'https://fujistud.io/og-default.png');
        setMeta('og:url', window.location.href);
        setMeta('og:type', 'website');
        setMeta('og:site_name', 'Fuji Studio');
    }, [battle]);

    const forceDownload = async (url: string, filename: string) => {
        try {
            const fullUrl = url.startsWith('http') ? url : `${API}${url}`;
            const res = await fetch(fullUrl);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch {
            const a = document.createElement('a');
            a.href = url.startsWith('http') ? url : `${API}${url}`;
            a.download = filename;
            a.click();
        }
    };

    const castVote = async (entryId: string, rank: 1 | 2 | 3 | null) => {
        if (!user) { window.location.href = '/api/auth/discord/login'; return; }
        setVotingId(entryId);
        try {
            const res = await fetch(`${API}/api/beat-battle/entries/${entryId}/vote`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rank }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const serverVotes: { entryId: string; rank: number }[] = Array.isArray((data as any).votes) ? (data as any).votes : [];
                const next: Record<string, number> = {};
                serverVotes.forEach(v => { next[v.entryId] = v.rank; });
                (battle?.entries || []).forEach((e: any) => lsSetVote(e.id, next[e.id] ?? null));
                setMyRanks(next);
                setVotedIds(new Set(Object.keys(next)));
                setVoteNotification({
                    message: rank === null
                        ? 'Vote removed.'
                        : `🔥 ${rank === 1 ? '+3 points' : rank === 2 ? '+2 points' : '+1 point'} assigned!`,
                });
                // Note: we intentionally do NOT refetch the battle here. Vote counts
                // are hidden during voting (see BattleDetailPage submissions section),
                // and the POST response already returns the user's full vote map for
                // `myRanks`. Refetching risked blanking the entries if the response
                // came back without the `track` join (which falls back to "Untitled"
                // / "Producer" defaults in flattenBattleEntry).
            } else {
                setVoteNotification({ message: (data as any).error || 'Could not cast vote.' });
            }
        } catch {
            setVoteNotification({ message: 'Something went wrong. Please try again.' });
        } finally { setVotingId(null); }
    };
    const vote = (entryId: string) => {
        const current = myRanks[entryId];
        if (!current) return castVote(entryId, 1);
        if (current === 1) return castVote(entryId, null);
        return castVote(entryId, 1);
    };

    if (loading) return (
        <DiscoveryLayout activeTab="battles">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: colors.textSecondary }}>
                Loading battle...
            </div>
        </DiscoveryLayout>
    );

    if (!battle) return (
        <DiscoveryLayout activeTab="battles">
            <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
                <Swords size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <h2 style={{ color: colors.textPrimary, margin: '0 0 8px' }}>Battle not found</h2>
                <Link to="/battles" style={{ color: colors.primary, textDecoration: 'none', fontSize: '14px' }}>
                    ← Back to Battles
                </Link>
            </div>
        </DiscoveryLayout>
    );

    const cfg = statusConfig[battle.status] || statusConfig.upcoming;
    const entries = battle.entries || [];
    const isLive = battle.status === 'active' || battle.status === 'voting';
    const isCompleted = battle.status === 'completed';

    // ── Points-based ranking (rank 1 = 3pts, rank 2 = 2pts, rank 3 = 1pt) ──
    // Tiebreakers: more 1st-place votes, then more 2nd-place votes, then earliest submission.
    const entryPoints = (e: Entry) =>
        (e.firstPlaceVotes || 0) * 3 + (e.secondPlaceVotes || 0) * 2 + (e.thirdPlaceVotes || 0) * 1;
    const cmpByPoints = (a: Entry, b: Entry) => {
        const diff = entryPoints(b) - entryPoints(a);
        if (diff) return diff;
        const aFirst = a.firstPlaceVotes || 0, bFirst = b.firstPlaceVotes || 0;
        if (bFirst !== aFirst) return bFirst - aFirst;
        const aSecond = a.secondPlaceVotes || 0, bSecond = b.secondPlaceVotes || 0;
        if (bSecond !== aSecond) return bSecond - aSecond;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    };

    const sortedEntries = (() => {
        if (sortOrder === 'top' && isCompleted) {
            return [...entries].sort(cmpByPoints);
        }
        // During voting (or sudden death), shuffle entries with a per-mount
        // seed so position bias doesn't influence votes. Order stays stable
        // across re-renders within the same page visit.
        if (battle.status === 'voting' || battle.status === 'sudden_death') {
            // Seeded shuffle: deterministic from shuffleSeed but appears random.
            const seeded = entries.map((e, i) => {
                let h = Math.floor(shuffleSeed * 2_147_483_647) ^ i;
                h = (h * 16807) % 2_147_483_647;
                // Mix in entry id chars for extra spread
                for (let c = 0; c < e.id.length; c++) h = ((h * 31) + e.id.charCodeAt(c)) | 0;
                return { e, k: h };
            });
            seeded.sort((a, b) => a.k - b.k);
            return seeded.map(s => s.e);
        }
        return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    })();

    const rules = battle.rules
        ? battle.rules.split('\n').map(r => r.trim()).filter(Boolean)
        : [];

    // Structured rules (new format) with backward compat for plain-text rules
    const rulesItems: { text: string; links?: { label: string; url: string }[]; samples?: { name: string; url: string }[] }[] =
        (battle.rulesData && (battle.rulesData as any[]).length > 0)
            ? (battle.rulesData as any[])
            : rules.map(text => ({ text }));

    // Podium: top 3 by total points; pin explicit winnerEntryId to #1 if set
    const podiumEntries = isCompleted && entries.length > 0
        ? (() => {
            const sorted = entries.slice().sort(cmpByPoints);
            if (battle.winnerEntryId) {
                const winIdx = sorted.findIndex(e => e.id === battle.winnerEntryId);
                if (winIdx > 0) { const [w] = sorted.splice(winIdx, 1); sorted.unshift(w); }
            }
            return [sorted[0] ?? null, sorted[1] ?? null, sorted[2] ?? null] as const;
        })()
        : [null, null, null] as const;
    const [firstPlace, secondPlace, thirdPlace] = podiumEntries;
    const winnerEntry = firstPlace; // alias used by hero CTA

    const phases = [
        {
            label: 'Submissions Open',
            date: formatDateRange(battle.submissionStart, battle.submissionEnd),
            note: 'Accepting MP3/WAV',
            active: battle.status === 'active',
            done: ['voting', 'completed'].includes(battle.status),
        },
        {
            label: 'Voting Phase',
            date: formatDateRange(battle.votingStart, battle.votingEnd),
            note: 'Community polls open',
            active: battle.status === 'voting',
            done: battle.status === 'completed',
        },
        {
            label: 'Winner Announced',
            date: formatDate(battle.votingEnd),
            note: 'Results posted on the website',
            active: false,
            done: battle.status === 'completed',
        },
    ];

    return (
        <DiscoveryLayout activeTab="battles">
            {/* ping animation */}
            <style>{`
                @keyframes hd-ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
                .hd-ping { animation: hd-ping 1.4s cubic-bezier(0,0,0.2,1) infinite; }

                .hd-entry-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; position: relative; }
                .hd-entry-card:hover { transform: translateY(-2px); border-color: rgba(43,140,113,0.45) !important; box-shadow: 0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(43,140,113,0.08); }
                .hd-entry-card:hover .hd-cover-overlay { opacity: 1; }
                .hd-cover-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25)); opacity: 0; transition: opacity 0.18s ease; cursor: pointer; }
                .hd-cover-overlay-playing { opacity: 1 !important; background: linear-gradient(135deg, rgba(43,140,113,0.55), rgba(0,0,0,0.35)); }
                .hd-cover-play-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.95); color: #0A0E1A; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }

                @keyframes hd-bar-pulse {
                    0%, 100% { transform: scaleY(0.55); }
                    50% { transform: scaleY(1); }
                }
                .hd-wave { display: flex; align-items: center; gap: 2px; height: 56px; width: 100%; cursor: pointer; padding: 0 2px; }
                .hd-bar { flex: 1; min-width: 2px; border-radius: 3px; background: linear-gradient(180deg, rgba(43,140,113,0.35) 0%, rgba(43,140,113,0.18) 100%); transform-origin: center; transition: background 0.15s ease; }
                .hd-wave-playing .hd-bar { background: linear-gradient(180deg, #34D399 0%, rgba(43,140,113,0.7) 100%); animation: hd-bar-pulse 0.9s ease-in-out infinite; }

            `}</style>

            {/* Submission success toast */}
            {submitToast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: colors.primary, color: '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
                    ✓ Entry submitted! It may take a moment to appear in the list.
                    <button onClick={() => setSubmitToast(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>✕</button>
                </div>
            )}

            <div style={{ overflowX: 'hidden' }}>

                {/* ── HERO ── */}
                <section style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '20px 16px 0' : '40px 24px 0' }}>

                    {/* Back */}
                    <Link to="/battles" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: colors.textSecondary, textDecoration: 'none', fontSize: '13px', marginBottom: '28px' }}>
                        <ArrowLeft size={14} /> Back to Battles
                    </Link>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '24px' : '56px', alignItems: 'center' }}>

                        {/* Left: content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* Status badge */}
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '6px 14px', borderRadius: '9999px',
                                backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}35`,
                                color: cfg.color, fontSize: '11px', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.12em', width: 'fit-content',
                            }}>
                                <span style={{ position: 'relative', width: '8px', height: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {isLive && (
                                        <span className="hd-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: cfg.color, opacity: 0.6 }} />
                                    )}
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cfg.color, display: 'block', position: 'relative' }} />
                                </span>
                                {cfg.label}
                            </div>

                            <h1 style={{
                                margin: 0,
                                fontSize: isMobile ? '32px' : '60px',
                                fontWeight: 900,
                                lineHeight: 1.05,
                                letterSpacing: '-0.02em',
                                color: colors.textPrimary,
                            }}>
                                {battle.title}
                            </h1>

                            {battle.subtitle && (
                                <p style={{ margin: 0, fontSize: isMobile ? '14px' : '18px', color: colors.textSecondary, lineHeight: 1.5, fontWeight: 500 }}>
                                    {battle.subtitle}
                                </p>
                            )}

                            {/* Countdown timer */}
                            {countdown && (
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: colors.textSecondary, marginBottom: '8px' }}>
                                        {countdown.label}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {[
                                            { val: countdown.days, label: 'D' },
                                            { val: countdown.hours, label: 'H' },
                                            { val: countdown.minutes, label: 'M' },
                                        ].map(({ val, label }) => (
                                            <div key={label} style={{ textAlign: 'center' }}>
                                                <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.08)',
                                                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '20px', fontWeight: 800, color: '#fff', backdropFilter: 'blur(8px)',
                                                    border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {String(val).padStart(2, '0')}
                                                </div>
                                                <span style={{ fontSize: '8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                                                    fontWeight: 700, display: 'block', marginTop: '3px', letterSpacing: '0.1em' }}>{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CTAs */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {battle.status === 'active' && user && (
                                    <button onClick={() => setShowSubmitModal(true)}
                                        style={{ backgroundColor: ACCENT, color: '#fff', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
                                        <Upload size={16} /> Submit Entry
                                    </button>
                                )}
                                {battle.status === 'active' && !user && (
                                    <a href="/api/auth/discord/login"
                                        style={{ backgroundColor: ACCENT, color: '#fff', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
                                        <LogIn size={16} /> Log in to Submit
                                    </a>
                                )}
                                {battle.status === 'voting' && (
                                    <button onClick={() => document.getElementById('submissions')?.scrollIntoView({ behavior: 'smooth' })}
                                        style={{ backgroundColor: ACCENT, color: '#fff', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
                                        <Vote size={16} /> Vote Now
                                    </button>
                                )}
                                {battle.status === 'upcoming' && (
                                    <span style={{ color: colors.textSecondary, fontSize: '14px', fontWeight: 600, padding: '12px 0' }}>Submissions open soon!</span>
                                )}
                                {isCompleted && winnerEntry && (
                                    <button onClick={() => document.getElementById('winner-spotlight')?.scrollIntoView({ behavior: 'smooth' })}
                                        style={{ backgroundColor: '#FFD700', color: '#1a1a1a', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(255,215,0,0.3)' }}>
                                        <Trophy size={16} /> View Podium
                                    </button>
                                )}
                                {entries.length > 0 && (
                                    <button onClick={() => document.getElementById('submissions')?.scrollIntoView({ behavior: 'smooth' })}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textPrimary, padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        View Entries
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Right: visual card */}
                        {!isMobile && (
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', inset: '-4px', background: `linear-gradient(135deg, ${colors.primary}, ${ACCENT})`, borderRadius: borderRadius.lg, opacity: 0.18, filter: 'blur(20px)', pointerEvents: 'none' }} />
                                <div style={{ position: 'relative', backgroundColor: '#242C3D', borderRadius: borderRadius.lg, overflow: 'hidden', aspectRatio: '16/9', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                                    {battle.bannerUrl ? (
                                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                            <img src={`${API}${battle.bannerUrl}`} alt={battle.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,19,29,0.8) 0%, transparent 60%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '24px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>{cfg.label}</div>
                                                {battle._count && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                                                        <Users size={13} /> {battle._count.entries} participants
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${colors.primary}18 0%, #242C3D 45%, ${ACCENT}12 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '32px' }}>
                                            <Swords size={56} color={colors.primary} style={{ opacity: 0.25 }} />
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>{cfg.label}</div>
                                                <div style={{ fontSize: '20px', fontWeight: 900, color: colors.textPrimary, lineHeight: 1.25 }}>{battle.title}</div>
                                            </div>
                                            {battle._count && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.textSecondary }}>
                                                    <Users size={13} /> {battle._count.entries} participants
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── DESCRIPTION ── */}
                {battle.description && (
                    <section style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '0 16px 32px' : '0 24px 48px' }}>
                        <div style={{
                            backgroundColor: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: borderRadius.lg,
                            padding: isMobile ? '24px 20px' : '36px 40px',
                        }}>
                            <div
                                className="battle-description-prose"
                                dangerouslySetInnerHTML={{ __html: battle.description }}
                                style={{
                                    color: colors.textSecondary,
                                    fontSize: isMobile ? '14px' : '16px',
                                    lineHeight: 1.8,
                                }}
                            />
                        </div>
                    </section>
                )}

                {/* ── TIMELINE ── */}
                <section style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '32px 16px' : '56px 24px' }}>
                    <h2 style={{ margin: '0 0 32px', fontSize: '20px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Calendar size={20} color={colors.primary} /> Battle Details
                    </h2>
                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr' }}>
                        {/* connecting line — desktop */}
                        {!isMobile && (
                            <div style={{ position: 'absolute', top: '7px', left: 0, right: 0, height: '2px', backgroundColor: 'rgba(255,255,255,0.07)', zIndex: 0 }} />
                        )}
                        {phases.map((phase, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'row' : 'column',
                                gap: isMobile ? '0' : '16px',
                                position: 'relative',
                                paddingBottom: isMobile && i < phases.length - 1 ? '28px' : 0,
                                paddingLeft: isMobile ? '32px' : 0,
                            }}>
                                {/* dot */}
                                <div style={{
                                    position: isMobile ? 'absolute' : 'relative',
                                    left: isMobile ? 0 : undefined,
                                    top: isMobile ? '2px' : undefined,
                                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, zIndex: 1,
                                    backgroundColor: phase.done || phase.active ? colors.primary : '#242C3D',
                                    border: `3px solid #1A1E2E`,
                                    boxShadow: phase.active
                                        ? `0 0 0 7px ${colors.primary}20`
                                        : phase.done
                                            ? `0 0 0 7px ${colors.primary}10`
                                            : '0 0 0 7px rgba(255,255,255,0.04)',
                                }} />
                                {/* vertical connector — mobile */}
                                {isMobile && i < phases.length - 1 && (
                                    <div style={{ position: 'absolute', left: '7px', top: '20px', bottom: 0, width: '2px', backgroundColor: 'rgba(255,255,255,0.07)' }} />
                                )}
                                <div style={{ paddingTop: isMobile ? 0 : 0 }}>
                                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px', color: phase.active ? colors.textPrimary : colors.textSecondary }}>{phase.label}</p>
                                    <p style={{ margin: '0 0 6px', fontSize: '13px', color: colors.textSecondary }}>{phase.date}</p>
                                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: phase.active ? colors.primary : 'rgba(255,255,255,0.2)' }}>{phase.note}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── SPONSOR STRIP ── */}
                {battle.sponsor && (
                    <section style={{ position: 'relative', overflow: 'hidden', marginBottom: '48px' }}>
                        {/* Glow backdrop */}
                        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${colors.primary}08 0%, ${colors.primary}14 50%, ${colors.primary}08 100%)`, pointerEvents: 'none' }} />
                        <div style={{ borderTop: `1px solid ${colors.primary}25`, borderBottom: `1px solid ${colors.primary}25`, padding: isMobile ? '28px 16px' : '36px 24px', position: 'relative' }}>
                            <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '20px' : '32px', justifyContent: 'center' }}>
                                    {/* Label */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <div style={{ width: '3px', height: '28px', backgroundColor: colors.primary, borderRadius: '2px' }} />
                                        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: colors.primary }}>Official Sponsor</span>
                                    </div>
                                    {/* Logo + name */}
                                    {battle.sponsor.websiteUrl ? (
                                        <a href={appendSponsorRef(battle.sponsor.websiteUrl, `/battles/${battle.slug || battle.id}`)} target="_blank" rel="noopener noreferrer"
                                            onClick={() => trackSponsorClick(battle.sponsor!.id, `battles/${battle.slug || battle.id}`)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
                                            {battle.sponsor.logoUrl && (
                                                <img src={battle.sponsor.logoUrl} alt={battle.sponsor.name} style={{ height: '40px', objectFit: 'contain' }} />
                                            )}
                                            <span style={{ fontWeight: 800, fontSize: isMobile ? '20px' : '24px', color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                {battle.sponsor.name}
                                            </span>
                                        </a>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            {battle.sponsor.logoUrl && (
                                                <img src={battle.sponsor.logoUrl} alt={battle.sponsor.name} style={{ height: '40px', objectFit: 'contain' }} />
                                            )}
                                            <span style={{ fontWeight: 800, fontSize: isMobile ? '20px' : '24px', color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                {battle.sponsor.name}
                                            </span>
                                        </div>
                                    )}
                                    {/* Links */}
                                    {battle.sponsor.links.length > 0 && (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {battle.sponsor.links.map(l => (
                                                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                                                    onClick={() => trackPromoLinkClick(l.id, `battles/${battle.slug || battle.id}`, API)}
                                                    style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', backgroundColor: colors.primary, padding: '8px 16px', borderRadius: '8px', boxShadow: `0 4px 16px ${colors.primary}40`, transition: 'opacity 0.15s' }}
                                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                                >
                                                    {l.label} <ExternalLink size={12} />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {battle.sponsor.description && (
                                    <p style={{ margin: '16px auto 0', textAlign: 'center', fontSize: '13px', color: colors.textSecondary, maxWidth: '560px', lineHeight: 1.6 }}>
                                        {renderWithLinks(battle.sponsor.description)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── RULES + PRIZES ── */}
                <section style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '24px 16px 32px' : '32px 24px 48px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>

                        {/* Rules card */}
                        <div style={{ backgroundColor: '#242C3D', padding: isMobile ? '20px' : '32px', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Shield size={18} color={colors.primary} />
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.textPrimary }}>Battle Rules</h3>
                            </div>
                            {rulesItems.length > 0 ? (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {rulesItems.map((rule, i) => (
                                        <li key={i}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <div style={{ marginTop: '3px', flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%', backgroundColor: `${colors.primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Check size={10} color={colors.primary} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>{renderWithLinks(rule.text)}</span>
                                                    {/* Inline links */}
                                                    {rule.links && rule.links.filter(l => l.url && l.label).length > 0 && (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}>
                                                            {rule.links.filter(l => l.url && l.label).map((lnk, li) => (
                                                                <a key={li} href={lnk.url.startsWith('http') ? lnk.url : `https://${lnk.url}`} target="_blank" rel="noopener noreferrer"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.primary, border: `1px solid ${colors.primary}30`, padding: '3px 9px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>
                                                                    {lnk.label} <ExternalLink size={10} />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Sample rows */}
                                                    {rule.samples && rule.samples.length > 0 && (
                                                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {rule.samples.map((sample, si) => {
                                                                const isThis = playingSampleUrl === sample.url && sampleIsPlaying;
                                                                const fullUrl = sample.url.startsWith('http') ? sample.url : `${API}${sample.url}`;
                                                                return (
                                                                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${isThis ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`, transition: 'border-color 0.15s' }}>
                                                                        <button onClick={() => toggleSample(sample.url)}
                                                                            style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', backgroundColor: isThis ? colors.primary : 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color 0.15s' }}>
                                                                            {isThis ? <Pause size={10} color="#fff" /> : <Play size={10} fill="#fff" color="#fff" style={{ marginLeft: '1px' }} />}
                                                                        </button>
                                                                        <Music size={12} color={isThis ? colors.primary : colors.textSecondary} style={{ flexShrink: 0 }} />
                                                                        <span style={{ fontSize: '12px', color: isThis ? colors.textPrimary : colors.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.name}</span>
                                                                                                        <button onClick={e => { e.stopPropagation(); forceDownload(sample.url, sample.name); }}
                                                                            style={{ color: colors.textSecondary, background: 'none', border: 'none', display: 'flex', padding: '4px', borderRadius: '4px', cursor: 'pointer' }} title="Download">
                                                                            <Download size={12} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                                    Rules will be posted when the battle opens. Check back soon!
                                </p>
                            )}
                        </div>

                        {/* Prizes card */}
                        <div style={{ backgroundColor: '#242C3D', padding: isMobile ? '20px' : '32px', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Trophy size={18} color={ACCENT} />
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.textPrimary }}>Grand Prizes</h3>
                            </div>
                            {battle.prizes && battle.prizes.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {battle.prizes.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '16px', padding: '16px', backgroundColor: `${colors.primary}08`, border: `1px solid ${colors.primary}18`, borderRadius: borderRadius.md, alignItems: 'flex-start' }}>
                                            {p.imageUrl && (
                                                <img src={p.imageUrl} alt={p.title || p.place} style={{ width: '100px', height: '100px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '18px' }}>{i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : `#${i + 1}`}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.place}</span>
                                                </div>
                                                {p.title && <p style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>{p.title}</p>}
                                                {p.description && <p style={{ margin: 0, fontSize: '13px', color: colors.primary, fontWeight: 600 }}>{p.description}</p>}
                                                {p.link && (
                                                    <a href={p.link} target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12px', color: colors.primary, border: `1px solid ${colors.primary}40`, padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>
                                                        Learn More <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                                    Prizes to be announced. Stay tuned!
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── PODIUM SPOTLIGHT ── */}
                {isCompleted && firstPlace && (
                    <section id="winner-spotlight" style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '0 16px 32px' : '0 24px 48px' }}>
                        {/* Section heading */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,215,0,0.15)', border: '2px solid rgba(255,215,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Trophy size={18} color="#FFD700" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FFD700' }}>Battle Results</h2>
                                <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.textSecondary }}>Final standings for this battle.</p>
                            </div>
                        </div>

                        {/* How votes are tallied */}
                        <div style={{
                            backgroundColor: colors.surface,
                            padding: spacing.md,
                            borderRadius: borderRadius.md,
                            marginBottom: spacing.lg,
                            borderLeft: `4px solid #FFD700`,
                        }}>
                            <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.5 }}>
                                <strong>How votes are tallied:</strong> each voter ranks their top 3 entries.
                                A 1st-place vote is worth <strong>3 pts</strong>, a 2nd-place vote is worth <strong>2 pts</strong>,
                                and a 3rd-place vote is worth <strong>1 pt</strong>. Final standings are sorted by total points,
                                with ties broken by most 1st-place votes, then most 2nd-place votes.
                                If two or more entries tie for 1st place after voting ends, a <strong>sudden-death runoff</strong> is
                                triggered &mdash; voters pick a single winner from the tied entries.
                            </p>
                        </div>

                        {/* Podium cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : secondPlace ? (thirdPlace ? '1fr 1fr 1fr' : '1fr 1fr') : '1fr', gap: '16px' }}>
                            {([
                                { entry: firstPlace,  rank: 1, label: '🥇 1st Place', color: '#FFD700', bg: 'rgba(255,215,0,0.08)',  border: 'rgba(255,215,0,0.35)',  glow: 'rgba(255,215,0,0.2)'  },
                                { entry: secondPlace, rank: 2, label: '🥈 2nd Place', color: '#C0C0C0', bg: 'rgba(192,192,192,0.06)', border: 'rgba(192,192,192,0.3)', glow: 'rgba(192,192,192,0.15)' },
                                { entry: thirdPlace,  rank: 3, label: '🥉 3rd Place', color: '#CD7F32', bg: 'rgba(205,127,50,0.07)',  border: 'rgba(205,127,50,0.3)', glow: 'rgba(205,127,50,0.15)' },
                            ] as const).map(({ entry, rank, label, color, bg, border, glow }) => {
                                if (!entry) return null;
                                const imgSrc = (entry.coverUrl || entry.avatarUrl);
                                const imgUrl = imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${API}${imgSrc}`) : null;
                                return (
                                    <div key={entry.id} style={{
                                        position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden',
                                        backgroundColor: bg, border: `1px solid ${border}`,
                                        boxShadow: rank === 1 ? `0 8px 32px ${glow}` : `0 4px 16px ${glow}`,
                                        padding: isMobile ? '20px 16px' : '24px 28px',
                                    }}>
                                        {/* accent bar */}
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                                        <div style={{ fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px' }}>{label}</div>
                                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                            {imgUrl && (
                                                <div style={{ width: '60px', height: '60px', flexShrink: 0, borderRadius: borderRadius.md, overflow: 'hidden', border: `2px solid ${border}`, boxShadow: `0 0 12px ${glow}` }}>
                                                    <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Link to={(entry as any).trackRoute || `/battles/entry/${entry.id}`} style={{ fontSize: '16px', fontWeight: 800, color: rank === 1 ? color : colors.textPrimary, textDecoration: 'none', lineHeight: 1.2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                                                    {entry.trackTitle}
                                                </Link>
                                                <Link to={`/profile/${entry.userId}`} style={{ fontSize: '13px', color, fontWeight: 600, textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
                                                    <StyledUsername userId={entry.userId} showBadge={false}>@{entry.username}</StyledUsername>
                                                </Link>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                    {isCompleted ? (() => {
                                                        const pts = entryPoints(entry);
                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <Flame size={12} color={ACCENT} />
                                                                <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT }}>{pts} {pts === 1 ? 'pt' : 'pts'}</span>
                                                            </div>
                                                        );
                                                    })() : <span />}
                                                    <Link to={(entry as any).trackRoute || `/battles/entry/${entry.id}`}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: color, color: '#1a1a1a', borderRadius: '8px', fontWeight: 700, fontSize: '12px', textDecoration: 'none', boxShadow: `0 2px 8px ${glow}` }}>
                                                        <Play size={11} fill="#1a1a1a" /> Listen
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── COMMUNITY SUBMISSIONS ── */}
                <section id="submissions" style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '32px 16px 56px' : '48px 24px 72px' }}>

                    {/* Section header */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '28px' }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>Community Submissions</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Discover and vote for your favourite entries.</p>
                        </div>
                        {entries.length > 0 && isCompleted && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {(['recent', 'top'] as const).map(s => (
                                    <button key={s} onClick={() => setSortOrder(s)}
                                        style={{
                                            padding: '7px 16px',
                                            backgroundColor: sortOrder === s ? `${colors.primary}20` : 'transparent',
                                            color: sortOrder === s ? colors.primary : colors.textSecondary,
                                            fontSize: '13px', fontWeight: 700, borderRadius: '8px',
                                            border: sortOrder === s ? `1px solid ${colors.primary}35` : '1px solid transparent',
                                            cursor: 'pointer',
                                        }}>
                                        {s === 'recent' ? 'Recent' : 'Top Voted'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Voting explainer */}
                    {(battle.status === 'voting' || battle.status === 'sudden_death') && entries.length > 0 && (
                        <div style={{ backgroundColor: colors.surface, padding: '16px 18px', borderRadius: borderRadius.md, marginBottom: '20px', borderLeft: `4px solid ${colors.primary}` }}>
                            {battle.status === 'sudden_death' ? (
                                <>
                                    <p style={{ margin: '0 0 6px', color: colors.textPrimary, fontSize: '14px', fontWeight: 700 }}>
                                        ⚡ Sudden Death is live
                                    </p>
                                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>
                                        The leading entries finished level on points. Cast a single vote for the entry you want to win — only the entries below are eligible. Voting closes {battle.suddenDeath?.end ? new Date(battle.suddenDeath.end).toLocaleString() : 'shortly'}.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p style={{ margin: '0 0 6px', color: colors.textPrimary, fontSize: '14px', fontWeight: 700 }}>
                                        🏆 How voting works
                                    </p>
                                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>
                                        Assign <strong>+3 pts</strong> to your favourite beat, <strong>+2 pts</strong> to your second pick, and <strong>+1 pt</strong> to your third. The entry with the most total points wins. Ties are broken by who has more +3 pt votes, then +2 pt votes. If it's still a deadlock, the battle enters <strong>Sudden Death</strong> — a short runoff between only the tied entries.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Empty state */}
                    {entries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#242C3D', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Swords size={40} color={colors.textSecondary} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: '16px', fontWeight: 600 }}>No submissions yet</p>
                            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px' }}>Be the first to enter this battle.</p>
                            {battle.status === 'active' && user && (
                                <button onClick={() => setShowSubmitModal(true)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '20px', backgroundColor: `${colors.primary}15`, color: colors.primary, fontSize: '13px', fontWeight: 600, padding: '9px 20px', borderRadius: '8px', border: `1px solid ${colors.primary}25`, cursor: 'pointer' }}>
                                    <Upload size={14} /> Submit Your Beat
                                </button>
                            )}
                            {battle.status === 'active' && !user && (
                                <a href="/api/auth/discord/login"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '20px', backgroundColor: `${colors.primary}15`, color: colors.primary, textDecoration: 'none', fontSize: '13px', fontWeight: 600, padding: '9px 20px', borderRadius: '8px', border: `1px solid ${colors.primary}25` }}>
                                    <LogIn size={14} /> Log in to Submit
                                </a>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {sortedEntries.map((entry, i) => {
                                const myRank = myRanks[entry.id] || 0;
                                const hasVoted = myRank > 0;
                                const isVoting = votingId === entry.id;
                                const sdActive = battle.status === 'sudden_death';
                                const sdEntries: string[] = battle.suddenDeath?.entryIds || [];
                                const sdEligible = !sdActive || sdEntries.includes(entry.id);
                                const trackId = `battle-entry-${entry.id}`;
                                const isCurrentlyPlaying = player.currentTrack?.id === trackId && player.isPlaying;
                                const bars = waveHeights(entry.id);
                                const isWinner = isCompleted && winnerEntry?.id === entry.id;
                                const podiumIdx = isCompleted ? podiumEntries.findIndex(e => e?.id === entry.id) : -1;
                                const podiumRank = podiumIdx >= 0 ? podiumIdx + 1 : null; // 1 | 2 | 3 | null
                                const rankColor = podiumRank === 1 ? '#FFD700' : podiumRank === 2 ? '#C0C0C0' : podiumRank === 3 ? '#CD7F32' : null;
                                const rankBg    = podiumRank === 1 ? 'rgba(255,215,0,0.05)' : podiumRank === 2 ? 'rgba(192,192,192,0.04)' : podiumRank === 3 ? 'rgba(205,127,50,0.05)' : '#242C3D';
                                const rankBdr   = podiumRank === 1 ? 'rgba(255,215,0,0.35)' : podiumRank === 2 ? 'rgba(192,192,192,0.3)' : podiumRank === 3 ? 'rgba(205,127,50,0.3)' : null;
                                const rankLabel = podiumRank === 1 ? '🥇 1st Place' : podiumRank === 2 ? '🥈 2nd Place' : podiumRank === 3 ? '🥉 3rd Place' : null;

                                return (
                                    <div key={entry.id} className="hd-entry-card"
                                        style={{
                                            backgroundColor: rankBg,
                                            borderRadius: borderRadius.lg,
                                            border: rankBdr
                                                ? `1px solid ${rankBdr}`
                                                : sortOrder === 'top' && i === 0 && !isCompleted
                                                    ? `1px solid ${colors.primary}35`
                                                    : '1px solid rgba(255,255,255,0.05)',
                                            overflow: 'hidden',
                                            padding: isMobile ? '16px' : '20px 24px',
                                        }}>
                                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '14px' : '28px' }}>

                                            {/* Cover + title */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: isMobile ? '100%' : '320px', flexShrink: 0 }}>
                                                <div
                                                    onClick={() => {
                                                        if (player.currentTrack?.id === trackId) { togglePlay(); return; }
                                                        setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`, entryRoute: (entry as any).trackRoute || `/battles/entry/${entry.id}` });
                                                    }}
                                                    style={{ position: 'relative', width: '92px', height: '92px', borderRadius: borderRadius.md, backgroundColor: '#1A1E2E', overflow: 'hidden', flexShrink: 0, boxShadow: rankColor ? `0 0 24px ${rankColor}55, 0 6px 18px rgba(0,0,0,0.45)` : '0 6px 18px rgba(0,0,0,0.4)', border: rankColor ? `2px solid ${rankColor}88` : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                                                    {(entry.coverUrl || entry.avatarUrl) ? (
                                                        <img src={(entry.coverUrl || entry.avatarUrl)!.startsWith('http') ? (entry.coverUrl || entry.avatarUrl)! : `${API}${entry.coverUrl || entry.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${colors.primary}30, ${colors.primary}10)` }}>
                                                            <Swords size={32} color={colors.primary} style={{ opacity: 0.5 }} />
                                                        </div>
                                                    )}
                                                    <div className={`hd-cover-overlay${isCurrentlyPlaying ? ' hd-cover-overlay-playing' : ''}`}>
                                                        <div className="hd-cover-play-icon">
                                                            {isCurrentlyPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />}
                                                        </div>
                                                    </div>
                                                    {isCurrentlyPlaying && (
                                                        <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 7px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '9999px', fontSize: '9px', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#34D399' }} />
                                                            Live
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    {rankLabel && rankColor && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', backgroundColor: `${rankColor}22`, border: `1px solid ${rankColor}55`, borderRadius: '9999px', fontSize: '10px', fontWeight: 700, color: rankColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                                            {rankLabel}
                                                        </div>
                                                    )}
                                                    <Link to={(entry as any).trackRoute || `/battles/entry/${entry.id}`} style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: rankColor ?? colors.textPrimary, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', display: 'block', letterSpacing: '-0.01em' }}>
                                                        {entry.trackTitle}
                                                    </Link>
                                                    <Link to={`/profile/${entry.userId}`} style={{ margin: '0 0 6px', fontSize: '13px', color: colors.primary, fontWeight: 600, textDecoration: 'none', display: 'block' }}>
                                                        <StyledUsername userId={entry.userId} showBadge={false}>@{entry.username}</StyledUsername>
                                                    </Link>
                                                    {isCompleted && (() => {
                                                        const pts = entryPoints(entry);
                                                        return (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', backgroundColor: `${ACCENT}15`, borderRadius: '9999px', border: `1px solid ${ACCENT}30` }}>
                                                                <Flame size={11} color={ACCENT} />
                                                                <span style={{ fontSize: '11px', fontWeight: 700, color: ACCENT }}>{pts} {pts === 1 ? 'pt' : 'pts'}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Waveform + actions */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', width: isMobile ? '100%' : undefined }}>

                                                {/* Waveform — clickable to play */}
                                                <div
                                                    onClick={() => {
                                                        if (player.currentTrack?.id === trackId) { togglePlay(); return; }
                                                        setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`, entryRoute: (entry as any).trackRoute || `/battles/entry/${entry.id}` });
                                                    }}
                                                    className={`hd-wave${isCurrentlyPlaying ? ' hd-wave-playing' : ''}`}>
                                                    {bars.map((h, bi) => (
                                                        <div key={bi} className="hd-bar" style={{
                                                            height: `${h}%`,
                                                            animationDelay: isCurrentlyPlaying ? `${(bi % 8) * 0.07}s` : undefined,
                                                        }} />
                                                    ))}
                                                </div>

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {entry.audioUrl && (
                                                        <button
                                                            onClick={() => {
                                                                if (player.currentTrack?.id === trackId) { togglePlay(); return; }
                                                                setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`, entryRoute: (entry as any).trackRoute || `/battles/entry/${entry.id}` });
                                                            }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: colors.textPrimary, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                                            {isCurrentlyPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} fill="currentColor" /> Play</>}
                                                        </button>
                                                    )}
                                                    {(battle.status === 'voting' || sdActive) && sdEligible && (
                                                        (sdActive ? [1] : [1, 2, 3]).map(r => {
                                                            const isThis = myRank === r;
                                                            const label = sdActive ? 'Vote' : (r === 1 ? '+3 pts' : r === 2 ? '+2 pts' : '+1 pt');
                                                            const medalColor = sdActive ? colors.primary : (r === 1 ? '#FFD700' : r === 2 ? '#C0C0C0' : '#CD7F32');
                                                            // Once this entry has been voted on, selected button is primary green; others go neutral.
                                                            // Before voting, all show their medal-coloured tint.
                                                            const bg = isThis
                                                                ? colors.primary
                                                                : hasVoted ? 'rgba(255,255,255,0.05)' : `${medalColor}1A`;
                                                            const border = isThis
                                                                ? colors.primary
                                                                : hasVoted ? 'rgba(255,255,255,0.1)' : `${medalColor}55`;
                                                            const fg = isThis
                                                                ? '#fff'
                                                                : hasVoted ? colors.textSecondary : medalColor;
                                                            return (
                                                                <button
                                                                    key={r}
                                                                    onClick={() => castVote(entry.id, isThis ? null : (r as 1 | 2 | 3))}
                                                                    disabled={isVoting}
                                                                    title={isThis ? 'Click to remove this vote' : sdActive ? 'Cast your vote' : `Assign ${r === 1 ? 3 : r === 2 ? 2 : 1} point${r === 3 ? '' : 's'} to this entry`}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                                        padding: '8px 16px',
                                                                        backgroundColor: bg,
                                                                        color: fg,
                                                                        borderRadius: '8px',
                                                                        border: `1px solid ${border}`,
                                                                        cursor: isVoting ? 'not-allowed' : 'pointer',
                                                                        fontSize: '13px', fontWeight: 800, opacity: isVoting ? 0.6 : 1,
                                                                        boxShadow: isThis ? `0 4px 14px ${colors.primary}55` : 'none',
                                                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                                                    }}>
                                                                    <Medal size={14} />
                                                                    {label}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                    {sdActive && !sdEligible && (
                                                        <span style={{ fontSize: '12px', color: colors.textSecondary, fontStyle: 'italic', padding: '8px 0' }}>
                                                            Eliminated in sudden death
                                                        </span>
                                                    )}
                                                    {hasVoted && (battle.status === 'voting' || sdActive) && (
                                                        <span style={{ fontSize: '11px', color: colors.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            Your pick · {myRank === 1 ? 3 : myRank === 2 ? 2 : 1} pts
                                                        </span>
                                                    )}
                                                    {(entry.firstPlaceVotes !== undefined || entry.secondPlaceVotes !== undefined || entry.thirdPlaceVotes !== undefined) && (
                                                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: colors.textSecondary, fontWeight: 600, display: 'flex', gap: '8px' }}>
                                                            <span title="1st place votes">🥇 {entry.firstPlaceVotes || 0}</span>
                                                            <span title="2nd place votes">🥈 {entry.secondPlaceVotes || 0}</span>
                                                            <span title="3rd place votes">🥉 {entry.thirdPlaceVotes || 0}</span>
                                                        </span>
                                                    )}
                                                    {!user && (battle.status === 'voting' || sdActive) && (
                                                        <a href="/api/auth/discord/login"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none', fontSize: '12px' }}>
                                                            <LogIn size={12} /> Log in to vote
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
            {voteNotification && createPortal(
                <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, backgroundColor: '#1A1E2E', border: '1px solid rgba(249,115,22,0.35)', borderLeft: '4px solid #F97316', color: '#fff', padding: '14px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '400px', width: 'calc(100vw - 48px)' }}>
                    <AlertCircle size={18} color="#F97316" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, lineHeight: 1.4 }}>{voteNotification.message}</span>
                    <button onClick={() => setVoteNotification(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>✕</button>
                </div>,
                document.body
            )}
            {battle && <BattleSubmitModal battleId={battle.id} requireProjectFile={battle.requireProjectFile} open={showSubmitModal} onClose={() => setShowSubmitModal(false)} onSubmitted={() => {
                setSubmitToast(true);
                setTimeout(() => setSubmitToast(false), 6000);
                setLoading(true);
                fetch(`${API}/api/beat-battle/battles/${battle.slug || battleId}`, { credentials: 'include', cache: 'no-store' })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (!data) return;
                        if (Array.isArray(data.entries)) {
                            data.entries = data.entries.map(flattenBattleEntry);
                        }
                        setBattle(data);
                    })
                    .catch(() => {})
                    .finally(() => setLoading(false));
            }} />}
        </DiscoveryLayout>
    );
};
