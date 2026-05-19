import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { StyledUsername } from '../components/StyledUsername';
import {
    Swords, Trophy, Users, Play, Pause, Vote,
    LogIn, ExternalLink, Flame, MessageSquare, Zap, History, Upload, Music, Clock, ChevronRight, AlertCircle
} from 'lucide-react';
import { BattleSubmitModal } from '../components/BattleSubmitModal';
import { flattenBattleEntry } from '../hooks/useBattleEntry';

const API = import.meta.env.VITE_API_URL || '';
const ACCENT = '#F97316';
const GOLD = '#FFD700';

// localStorage helpers — store the user's ranked vote per entry
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
    upcoming:     { label: 'UPCOMING',         color: '#60A5FA' },
    active:       { label: 'SUBMISSIONS OPEN', color: '#34D399' },
    voting:       { label: 'VOTING LIVE',      color: ACCENT },
    sudden_death: { label: 'SUDDEN DEATH',     color: '#F43F5E' },
    completed:    { label: 'ENDED',            color: '#6B7280' },
};

function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const MEDAL_GOLD   = '\u{1F947}';
const MEDAL_SILVER = '\u{1F948}';
const MEDAL_BRONZE = '\u{1F949}';
const FIRE         = '\u{1F525}';
const placeEmoji = (i: number) => i === 0 ? MEDAL_GOLD : i === 1 ? MEDAL_SILVER : i === 2 ? MEDAL_BRONZE : `#${i + 1}`;

interface Battle {
    id: string;
    slug?: string | null;
    title: string;
    description: string | null;
    status: string;
    rules: string | null;
    rulesData?: { text: string; links?: { label: string; url: string }[]; samples?: { name: string; url: string }[] }[] | null;
    prizes: { place: string; title?: string; description: string; imageUrl?: string; link?: string }[] | null;
    submissionStart: string | null;
    submissionEnd: string | null;
    votingStart: string | null;
    votingEnd: string | null;
    winnerEntryId: string | null;
    discordInviteUrl: string | null;
    bannerUrl: string | null;
    requireProjectFile?: boolean;
    sponsor: { id: string; name: string; logoUrl: string | null; websiteUrl: string | null; links: { id: string; label: string; url: string }[] } | null;
    entries?: Entry[];
    _count?: { entries: number };
    createdAt: string;
    suddenDeath?: { active: boolean; entryIds: string[]; start: string | null; end: string | null; durationMinutes: number } | null;
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

interface PublicSponsor {
    id: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    links: { id: string; label: string; url: string }[];
}

export const BattlesPage: React.FC = () => {
    const { user } = useAuth();
    const { player, setTrack, togglePlay } = usePlayer();
    const [battles, setBattles] = useState<Battle[]>([]);
    const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);
    const [loading, setLoading] = useState(true);
    const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
    const [myRanks, setMyRanks] = useState<Record<string, number>>({}); // entryId -> rank (1|2|3)
    const [votingId, setVotingId] = useState<string | null>(null);
    const [voteNotification, setVoteNotification] = useState<{ message: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitToast, setSubmitToast] = useState(false);
    const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number } | null>(null);
    const [hallOfFame, setHallOfFame] = useState<Array<{ battle: Battle; winner: Entry | null }>>([]);
    const [globalSponsors, setGlobalSponsors] = useState<PublicSponsor[]>([]);
    const [sponsorSectionTitle, setSponsorSectionTitle] = useState<string>('Official Partners');

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [battlesRes, pageSettingsRes, sponsorsRes, discoveryRes] = await Promise.all([
                fetch(`${API}/api/beat-battle/battles?guildId=default-guild`),
                fetch(`${API}/api/beat-battle/page-settings?guildId=default-guild`),
                fetch(`${API}/api/beat-battle/sponsors?guildId=default-guild`),
                fetch(`${API}/api/discovery/settings`),
            ]);
            if (!battlesRes.ok) return;
            const data: Battle[] = await battlesRes.json();
            // Flatten entries to legacy shape so existing render code works after the schema slim-down
            const flattened = data.map(b => ({
                ...b,
                entries: Array.isArray((b as any).entries)
                    ? (b as any).entries.map(flattenBattleEntry)
                    : (b as any).entries,
            }));
            setBattles(flattened);

            // Prefer globally-curated sponsors from discovery settings; fall back to showOnPage sponsors
            const discoveryData = discoveryRes.ok ? await discoveryRes.json() : null;
            if (discoveryData?.globalSponsors?.length > 0) {
                setGlobalSponsors(discoveryData.globalSponsors);
                setSponsorSectionTitle(discoveryData.globalSponsorTitle || 'Our Partners');
            } else if (sponsorsRes.ok) {
                setGlobalSponsors(await sponsorsRes.json());
            }

            if (pageSettingsRes.ok) {
                const ps = await pageSettingsRes.json();
                if (ps.sponsorSectionTitle && !discoveryData?.globalSponsors?.length) setSponsorSectionTitle(ps.sponsorSectionTitle);

                const featured = ps.featuredBattleId ? data.find((b: Battle) => b.id === ps.featuredBattleId) : null;
                const active = featured ||
                               data.find(b => b.status === 'voting') ||
                               data.find(b => b.status === 'active') ||
                               data.find(b => b.status === 'upcoming');
                if (active) {
                    const detail = await fetch(`${API}/api/beat-battle/battles/${active.id}`, { credentials: 'include' });
                    if (detail.ok) setCurrentBattle(await detail.json());
                }
            } else {
                const active = data.find(b => b.status === 'voting') ||
                               data.find(b => b.status === 'active') ||
                               data.find(b => b.status === 'upcoming');
                if (active) {
                    const detail = await fetch(`${API}/api/beat-battle/battles/${active.id}`, { credentials: 'include' });
                    if (detail.ok) setCurrentBattle(await detail.json());
                }
            }
        } catch {} finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Restore voted state whenever entries load or change
    useEffect(() => {
        const entries = currentBattle?.entries;
        if (!entries?.length) return;
        // Read each entry's vote rank from localStorage immediately
        const localRanks: Record<string, number> = {};
        entries.forEach(e => {
            const r = lsGetVote(e.id);
            if (r) localRanks[e.id] = r;
        });
        setMyRanks(localRanks);
        setVotedIds(new Set(Object.keys(localRanks)));
        // If logged in, verify against server and write back to localStorage
        if (!user) return;
        const fetchMyVotes = async () => {
            try {
                const res = await fetch(`${API}/api/beat-battle/battles/${currentBattle!.id}/my-votes`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const serverVotes: { entryId: string; rank: number }[] = Array.isArray(data.votes) ? data.votes : [];
                    const next: Record<string, number> = {};
                    serverVotes.forEach(v => { next[v.entryId] = v.rank; });
                    // Write through localStorage (clear ones not in server, set the ones present)
                    entries.forEach(e => lsSetVote(e.id, next[e.id] ?? null));
                    setMyRanks(next);
                    setVotedIds(new Set(Object.keys(next)));
                }
            } catch {}
        };
        fetchMyVotes();
    }, [currentBattle?.entries, user]);

    // Auto-dismiss vote notifications
    useEffect(() => {
        if (!voteNotification) return;
        const t = setTimeout(() => setVoteNotification(null), 6000);
        return () => clearTimeout(t);
    }, [voteNotification]);

    // Countdown timer
    useEffect(() => {
        if (!currentBattle) return;
        const target =
            currentBattle.status === 'sudden_death' ? currentBattle.suddenDeath?.end || null :
            currentBattle.status === 'voting'   ? currentBattle.votingEnd :
            currentBattle.status === 'active'   ? currentBattle.submissionEnd :
            currentBattle.status === 'upcoming' ? currentBattle.submissionStart : null;
        if (!target) return;
        const update = () => {
            const diff = new Date(target).getTime() - Date.now();
            if (diff <= 0) { setCountdown({ days: 0, hours: 0, minutes: 0 }); return; }
            setCountdown({
                days: Math.floor(diff / 86400000),
                hours: Math.floor((diff % 86400000) / 3600000),
                minutes: Math.floor((diff % 3600000) / 60000),
            });
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [currentBattle]);

    // Hall of Fame — fetch top 3 completed battles for winner data
    useEffect(() => {
        const completed = battles.filter(b => b.status === 'completed').slice(0, 3);
        if (!completed.length) return;
        Promise.all(
            completed.map(async b => {
                try {
                    const res = await fetch(`${API}/api/beat-battle/battles/${b.id}`, { credentials: 'include' });
                    if (!res.ok) return { battle: b, winner: null };
                    const data: Battle = await res.json();
                    const raw = (data.winnerEntryId
                        ? data.entries?.find((e: any) => e.id === data.winnerEntryId)
                        : null) || (data.entries as any)?.[0] || null;
                    // API returns entries with nested track/profile — flatten for display
                    const winner = raw ? {
                        id:         raw.id,
                        userId:     raw.userId ?? raw.track?.profile?.userId,
                        username:   raw.track?.profile?.displayName || raw.track?.profile?.username || raw.username || '—',
                        avatarUrl:  raw.track?.profile?.avatar || raw.avatarUrl || null,
                        trackTitle: raw.track?.title || raw.trackTitle || 'Untitled',
                        audioUrl:   raw.track?.url || raw.audioUrl || null,
                        coverUrl:   raw.track?.coverUrl || raw.coverUrl || null,
                    } : null;
                    return { battle: data, winner };
                } catch { return { battle: b, winner: null }; }
            })
        ).then(setHallOfFame);
    }, [battles]);

    // Cast / change / clear a ranked vote.
    // rank=1|2|3 assigns that slot. rank=null clears this entry's vote.
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
                // Sync localStorage with server truth
                (currentBattle?.entries || []).forEach(e => lsSetVote(e.id, next[e.id] ?? null));
                setMyRanks(next);
                setVotedIds(new Set(Object.keys(next)));
                setVoteNotification({
                    message: rank === null
                        ? 'Vote removed.'
                        : `🔥 Marked as your ${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'} place pick!`,
                });
                // Refresh battle entries to update tallies
                if (currentBattle) {
                    fetch(`${API}/api/beat-battle/battles/${currentBattle.id}`, { credentials: 'include' })
                        .then(r => r.ok ? r.json() : null)
                        .then(b => { if (b) setCurrentBattle(b); })
                        .catch(() => {});
                }
            } else {
                setVoteNotification({ message: (data as any).error || 'Could not cast vote.' });
            }
        } catch {
            setVoteNotification({ message: 'Something went wrong. Please try again.' });
        } finally { setVotingId(null); }
    };
    // Back-compat alias used elsewhere in the file
    const vote = (entryId: string) => {
        const current = myRanks[entryId];
        // Default behaviour: if no rank yet, set 1st; if 1st, clear; if 2nd/3rd, leave alone (use the rank menu)
        if (!current) return castVote(entryId, 1);
        if (current === 1) return castVote(entryId, null);
        return castVote(entryId, 1);
    };

    const activeBattles = battles.filter(b => b.status !== 'completed');
    const pastBattles = battles.filter(b => b.status === 'completed');

    if (loading) return (
        <DiscoveryLayout activeTab="battles">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: colors.textSecondary }}>
                Loading battles...
            </div>
        </DiscoveryLayout>
    );

    return (
        <DiscoveryLayout activeTab="battles">
            {voteNotification && createPortal(
                <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, backgroundColor: '#1A1E2E', border: '1px solid rgba(249,115,22,0.35)', borderLeft: '4px solid #F97316', color: '#fff', padding: '14px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '400px', width: 'calc(100vw - 48px)' }}>
                    <AlertCircle size={18} color="#F97316" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, lineHeight: 1.4 }}>{voteNotification.message}</span>
                    <button onClick={() => setVoteNotification(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>✕</button>
                </div>,
                document.body
            )}
            {submitToast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: colors.primary, color: '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
                    ✓ Entry submitted! It may take a moment to appear in the list.
                    <button onClick={() => setSubmitToast(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>✕</button>
                </div>
            )}
            <div style={{ overflowX: 'hidden' }}>

                {/* ── HERO ── */}
                <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '16px 16px 0' : '32px 24px 0' }}>
                    {currentBattle ? (
                        <div style={{
                            position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden',
                            backgroundColor: '#242C3D', minHeight: isMobile ? '240px' : '340px',
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            border: '1px solid #2A3148', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                            ...(currentBattle.bannerUrl ? {
                                backgroundImage: `url(${API}${currentBattle.bannerUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center top',
                            } : currentBattle.entries?.[0]?.coverUrl ? {
                                backgroundImage: `url(${API}${currentBattle.entries[0].coverUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center top',
                            } : {}),
                        }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,19,29,0.97) 0%, rgba(22,25,37,0.75) 50%, rgba(22,25,37,0.35) 100%)', zIndex: 1 }} />
                            <div style={{ position: 'relative', zIndex: 2, padding: isMobile ? '20px 16px' : '32px 40px' }}>
                                {/* Status badge */}
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: currentBattle.status === 'voting' ? ACCENT : '#34D399', fontWeight: 700, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
                                    <Flame size={13} />
                                    {currentBattle.status === 'voting' ? 'Voting Live' : currentBattle.status === 'active' ? 'Submissions Open' : 'Coming Soon'}
                                </div>
                                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <Link to={`/battles/${currentBattle.slug || currentBattle.id}`} style={{ textDecoration: 'none' }}>
                                            <h2 style={{ margin: '0 0 8px', fontSize: isMobile ? '24px' : '44px', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                                                {currentBattle.title}
                                            </h2>
                                        </Link>
                                        {(currentBattle as any).subtitle && (
                                            <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.65)', maxWidth: '520px', fontSize: isMobile ? '13px' : '15px', lineHeight: 1.5, fontWeight: 500 }}>
                                                {(currentBattle as any).subtitle}
                                            </p>
                                        )}
                                        {/* Inline stats */}
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={13} /> {currentBattle._count?.entries || currentBattle.entries?.length || 0} entries</span>
                                            {currentBattle.prizes && currentBattle.prizes.length > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Trophy size={13} /> {currentBattle.prizes.length} prizes</span>
                                            )}
                                            {currentBattle.sponsor && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    Sponsored by <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{currentBattle.sponsor.name}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Right side: countdown + CTA */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: '12px', flexShrink: 0 }}>
                                        {countdown && (
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {[
                                                    { val: countdown.days, label: 'D' },
                                                    { val: countdown.hours, label: 'H' },
                                                    { val: countdown.minutes, label: 'M' },
                                                ].map(({ val, label }) => (
                                                    <div key={label} style={{ textAlign: 'center' }}>
                                                        <div style={{ width: isMobile ? '42px' : '50px', height: isMobile ? '42px' : '50px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '18px' : '20px', fontWeight: 800, color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                            {String(val).padStart(2, '0')}
                                                        </div>
                                                        <span style={{ fontSize: '8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontWeight: 700, display: 'block', marginTop: '3px', letterSpacing: '0.1em' }}>{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {currentBattle.status === 'active' && user && (
                                                <button onClick={() => setShowSubmitModal(true)}
                                                    style={{ backgroundColor: colors.primary, color: '#fff', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: `0 8px 24px ${colors.primary}40` }}>
                                                    <Upload size={14} /> Submit Entry
                                                </button>
                                            )}
                                            {currentBattle.status === 'active' && !user && (
                                                <a href="/api/auth/discord/login"
                                                    style={{ backgroundColor: colors.primary, color: '#fff', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: `0 8px 24px ${colors.primary}40` }}>
                                                    <LogIn size={14} /> Log in to Submit
                                                </a>
                                            )}
                                            {currentBattle.status === 'voting' && (
                                                <button onClick={() => document.getElementById('entries-section')?.scrollIntoView({ behavior: 'smooth' })}
                                                    style={{ backgroundColor: ACCENT, color: '#fff', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
                                                    <Vote size={14} /> Vote Now
                                                </button>
                                            )}
                                            <Link to={`/battles/${currentBattle.slug || currentBattle.id}`}
                                                style={{ backgroundColor: 'rgba(96,165,250,0.15)', color: '#60A5FA', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(96,165,250,0.25)' }}>
                                                <Swords size={14} /> View Details
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '48px 40px', textAlign: 'center', backgroundColor: '#242C3D', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Swords size={40} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p style={{ color: colors.textSecondary, fontSize: '15px', margin: 0 }}>No active battle right now.</p>
                            <p style={{ color: colors.textSecondary, fontSize: '12px', margin: '6px 0 0', opacity: 0.6 }}>Check back soon — new battles are coming!</p>
                        </div>
                    )}
                </div>

                {/* ── SPONSOR STRIP ── */}
                {globalSponsors.length > 0 && (
                    <div style={{ position: 'relative', overflow: 'hidden', marginTop: '20px' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(16,185,129,0.05) 0%, rgba(16,185,129,0.1) 50%, rgba(16,185,129,0.05) 100%)', pointerEvents: 'none' }} />
                        <div style={{ borderTop: '1px solid rgba(16,185,129,0.2)', borderBottom: '1px solid rgba(16,185,129,0.2)', padding: '18px 24px', position: 'relative' }}>
                            <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '2px', height: '20px', backgroundColor: '#10B981', borderRadius: '1px' }} />
                                    <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#10B981' }}>{sponsorSectionTitle}</span>
                                </div>
                                {globalSponsors.map(s => {
                                    const href = s.websiteUrl;
                                    const inner = s.logoUrl
                                        ? <img src={s.logoUrl} alt={s.name} style={{ height: '28px', objectFit: 'contain' }} />
                                        : <span style={{ fontWeight: 800, fontSize: '13px', color: '#fff', letterSpacing: '0.04em' }}>{s.name.toUpperCase()}</span>;
                                    return href ? (
                                        <a key={s.id} href={href} target="_blank" rel="noopener noreferrer"
                                            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', transition: 'all 0.2s' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                        >{inner}</a>
                                    ) : (
                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>{inner}</div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MAIN CONTENT ── */}
                <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 24px' }}>

                    {/* ── TWO-COLUMN: Active Battles + Hall of Fame ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '20px', marginBottom: '32px' }}>

                        {/* Left: Active / Upcoming Battles */}
                        <div>
                            <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                <Swords size={14} color={colors.primary} /> Active Battles
                            </h3>
                            {activeBattles.length === 0 ? (
                                <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0, padding: '20px', backgroundColor: '#242C3D', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>No active battles right now.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {activeBattles.map(b => {
                                        const cfg = statusConfig[b.status] || statusConfig.upcoming;
                                        return (
                                            <Link key={b.id} to={`/battles/${b.slug || b.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'stretch', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s' }}
                                                onMouseEnter={e => (e.currentTarget.style.borderColor = `${colors.primary}50`)}
                                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>
                                                {/* Banner thumbnail */}
                                                {b.bannerUrl && (
                                                    <div style={{ width: isMobile ? '80px' : '140px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                                                        <img src={`${API}${b.bannerUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, #242C3D)' }} />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, padding: isMobile ? '12px 14px' : '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '9px', fontWeight: 700, color: cfg.color, padding: '2px 8px', borderRadius: '999px', backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, letterSpacing: '0.08em' }}>{cfg.label}</span>
                                                        {b.sponsor && (
                                                            b.sponsor.logoUrl
                                                                ? <img src={b.sponsor.logoUrl} alt={b.sponsor.name} style={{ height: '16px', objectFit: 'contain', opacity: 0.6 }} />
                                                                : <span style={{ fontSize: '9px', fontWeight: 600, color: colors.textSecondary, opacity: 0.6 }}>by {b.sponsor.name}</span>
                                                        )}
                                                    </div>
                                                    <h4 style={{ margin: 0, fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: colors.textPrimary }}>{b.title}</h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: colors.textSecondary }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={11} /> {b._count?.entries || 0} entries</span>
                                                        {b.submissionEnd && b.status === 'active' && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> Ends {formatDate(b.submissionEnd)}</span>
                                                        )}
                                                        {b.votingEnd && b.status === 'voting' && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> Voting ends {formatDate(b.votingEnd)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', paddingRight: '16px', color: 'rgba(255,255,255,0.2)' }}>
                                                    <ChevronRight size={18} />
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Hall of Fame */}
                        <div>
                            <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: GOLD, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(255,215,0,0.4)' }}>
                                <Trophy size={14} color={GOLD} /> Hall of Fame
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {hallOfFame.length === 0 ? (
                                    <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0, padding: '20px', backgroundColor: '#242C3D', borderRadius: '10px', border: `1px solid ${GOLD}20` }}>No past winners yet.</p>
                                ) : hallOfFame.map(({ battle, winner }) => (
                                    <Link key={battle.id} to={`/battles/${battle.slug || battle.id}`} style={{ textDecoration: 'none', backgroundColor: 'rgba(255,215,0,0.04)', borderRadius: '10px', padding: '12px 14px', border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', gap: '10px', transition: 'box-shadow 0.2s', boxShadow: `0 0 10px rgba(255,215,0,0.08)` }}
                                        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 18px rgba(255,215,0,0.22)`)}
                                        onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 10px rgba(255,215,0,0.08)`)}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: `2px solid ${GOLD}`, overflow: 'hidden', backgroundColor: 'rgba(255,215,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px rgba(255,215,0,0.3)` }}>
                                                {winner?.avatarUrl
                                                    ? <img src={winner.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <Trophy size={16} color={GOLD} />}
                                            </div>
                                            <div style={{ position: 'absolute', bottom: '-2px', right: '-4px', backgroundColor: GOLD, color: '#000', fontSize: '7px', fontWeight: 700, padding: '1px 4px', borderRadius: '99px', border: '2px solid #1a2030' }}>★</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h5 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: GOLD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 0 8px rgba(255,215,0,0.3)' }}>{winner?.userId ? <StyledUsername userId={winner.userId} showBadge={false}>{winner.username || '—'}</StyledUsername> : (winner?.username || '—')}</h5>
                                            <p style={{ margin: '1px 0 0', fontSize: '10px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>"{winner?.trackTitle || '—'}"</p>
                                            <p style={{ margin: '1px 0 0', fontSize: '9px', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{battle.title}</p>
                                        </div>
                                        {winner?.audioUrl && (
                                            <button onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const id = `battle-${winner.id}`;
                                                if (player.currentTrack?.id === id) { togglePlay(); return; }
                                                setTrack({ id, title: winner.trackTitle, artist: winner.username, cover: winner.avatarUrl || winner.coverUrl || '', url: `${API}${winner.audioUrl}`, entryRoute: (winner as any).trackRoute || `/battles/entry/${winner.id}` });
                                            }} style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${GOLD}18`, border: `1px solid ${GOLD}40`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, flexShrink: 0 }}>
                                                {player.currentTrack?.id === `battle-${winner.id}` && player.isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                            </button>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── ENTRIES / VOTING ── */}
                    {currentBattle && (currentBattle.status === 'voting' || currentBattle.status === 'active' || currentBattle.status === 'sudden_death') && currentBattle.entries && currentBattle.entries.length > 0 && (
                        <section id="entries-section" style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    <Vote size={14} color={colors.primary} />
                                    {currentBattle.status === 'sudden_death'
                                        ? 'Sudden Death — Tie-Breaker Vote'
                                        : currentBattle.status === 'voting' ? 'Rank Your Top 3' : 'Submissions'}
                                    <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>{currentBattle.entries.length} entries</span>
                                </h3>
                                {(currentBattle.status === 'voting' || currentBattle.status === 'sudden_death') && !user && (
                                    <a href="/api/auth/discord/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.primary, textDecoration: 'none', backgroundColor: `${colors.primary}15`, padding: '5px 10px', borderRadius: '6px', border: `1px solid ${colors.primary}30` }}>
                                        <LogIn size={12} /> Log in to vote
                                    </a>
                                )}
                            </div>

                            {/* Voting explainer */}
                            {(currentBattle.status === 'voting' || currentBattle.status === 'sudden_death') && (
                                <div style={{ backgroundColor: colors.surface, padding: '14px 16px', borderRadius: '10px', marginBottom: '14px', borderLeft: `4px solid ${colors.primary}` }}>
                                    {currentBattle.status === 'sudden_death' ? (
                                        <>
                                            <p style={{ margin: '0 0 6px', color: colors.textPrimary, fontSize: '13px', fontWeight: 700 }}>
                                                ⚡ Sudden Death is live
                                            </p>
                                            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
                                                The top entries finished with an identical 1st/2nd/3rd vote distribution. Cast a single vote for the entry you want to win. Voting closes {currentBattle.suddenDeath?.end ? new Date(currentBattle.suddenDeath.end).toLocaleString() : 'shortly'}.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p style={{ margin: '0 0 6px', color: colors.textPrimary, fontSize: '13px', fontWeight: 700 }}>
                                                🏆 How voting works — Lexicographical Positional Scoring
                                            </p>
                                            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
                                                Each voter picks a <strong>1st</strong>, <strong>2nd</strong>, and <strong>3rd</strong> place entry. The winner is whoever has the most 1st-place votes. If two entries tie, we compare their 2nd-place votes, then their 3rd-place votes. Only if all three tiers are perfectly identical does the battle go into <strong>Sudden Death</strong> — a short runoff vote between the tied entries.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {currentBattle.entries.map((entry, i) => {
                                    const myRank = myRanks[entry.id] || 0;
                                    const hasVoted = myRank > 0;
                                    const isVoting = votingId === entry.id;
                                    const isPlaying = player.currentTrack?.id === `battle-${entry.id}` && player.isPlaying;
                                    const sdActive = currentBattle.status === 'sudden_death';
                                    const sdEntries: string[] = currentBattle.suddenDeath?.entryIds || [];
                                    const sdEligible = !sdActive || sdEntries.includes(entry.id);
                                    const handlePlay = () => {
                                        if (!entry.audioUrl) return;
                                        const id = `battle-${entry.id}`;
                                        if (player.currentTrack?.id === id) { togglePlay(); return; }
                                        setTrack({ id, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`, entryRoute: (entry as any).trackRoute || `/battles/entry/${entry.id}` });
                                    };
                                    return (
                                        <div key={entry.id} style={{ backgroundColor: colors.surface, borderRadius: '8px', border: i === 0 ? `1px solid ${colors.primary}40` : '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', transition: 'border-color 0.2s' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${colors.primary}55`; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = i === 0 ? `${colors.primary}40` : 'rgba(255,255,255,0.06)'; }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 0 : '16px', padding: isMobile ? 0 : '16px' }}>
                                                {/* Cover art */}
                                                <div onClick={handlePlay} style={{ width: isMobile ? '100%' : '130px', height: isMobile ? '180px' : '130px', minWidth: isMobile ? undefined : '130px', borderRadius: isMobile ? 0 : '6px', overflow: 'hidden', position: 'relative', backgroundColor: '#1A1E2E', cursor: 'pointer', flexShrink: 0 }}>
                                                    {entry.coverUrl ? (
                                                        <img src={entry.coverUrl.startsWith('http') ? entry.coverUrl : `${API}${entry.coverUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : entry.avatarUrl ? (
                                                        <img src={entry.avatarUrl.startsWith('http') ? entry.avatarUrl : `${API}${entry.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.5)', transform: 'scale(1.1)' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Music size={28} color={colors.textSecondary} style={{ opacity: 0.2 }} />
                                                        </div>
                                                    )}
                                                    {/* Play overlay */}
                                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0, transition: 'opacity 0.15s' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={(e) => { if (!isPlaying) e.currentTarget.style.opacity = '0'; }}
                                                    >
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {isPlaying ? <Pause size={18} fill="white" color="white" /> : <Play size={18} fill="white" color="white" />}
                                                        </div>
                                                    </div>
                                                    {/* Rank badge */}
                                                    {i < 3 && (
                                                        <div style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '15px', lineHeight: 1 }}>{placeEmoji(i)}</div>
                                                    )}
                                                </div>

                                                {/* Right: info */}
                                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '12px' : 0 }}>
                                                    {/* Artist row */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                            <Link to={`/profile/${entry.userId}`} style={{ display: 'flex', flexShrink: 0, textDecoration: 'none' }}>
                                                                {entry.avatarUrl ? (
                                                                    <img src={entry.avatarUrl.startsWith('http') ? entry.avatarUrl : `${API}${entry.avatarUrl}`} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white' }}>
                                                                        {entry.username?.[0]?.toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </Link>
                                                            <Link to={`/profile/${entry.userId}`} style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {entry.username}
                                                            </Link>
                                                        </div>
                                                        {/* Vote fire count */}
                                                        <span style={{ fontSize: '12px', color: colors.primary, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                                            {FIRE} {entry.voteCount}
                                                        </span>
                                                    </div>

                                                    {/* Track title */}
                                                    <Link to={(entry as any).trackRoute || `/battles/entry/${entry.id}`} style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 700, marginBottom: '6px', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                        {entry.trackTitle}
                                                    </Link>

                                                    {/* Description */}
                                                    {entry.description && (
                                                        <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                                                            {entry.description}
                                                        </p>
                                                    )}

                                                    <div style={{ flex: 1 }} />

                                                    {/* Actions bar */}
                                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                        {(currentBattle.status === 'voting' || sdActive) && sdEligible && (
                                                            <>
                                                                {(sdActive ? [1] : [1, 2, 3]).map(r => {
                                                                    const isThis = myRank === r;
                                                                    const label = sdActive ? 'Vote' : (r === 1 ? '1st' : r === 2 ? '2nd' : '3rd');
                                                                    return (
                                                                        <button
                                                                            key={r}
                                                                            onClick={() => castVote(entry.id, isThis ? null : (r as 1 | 2 | 3))}
                                                                            disabled={isVoting}
                                                                            title={isThis ? 'Click to remove this vote' : `Mark as your ${label} place pick`}
                                                                            style={{
                                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                                padding: '5px 10px', borderRadius: '6px',
                                                                                border: `1px solid ${isThis ? colors.primary : 'rgba(255,255,255,0.12)'}`,
                                                                                cursor: 'pointer',
                                                                                backgroundColor: isThis ? colors.primary : 'transparent',
                                                                                color: isThis ? '#fff' : colors.textPrimary,
                                                                                fontSize: '11px', fontWeight: 700, opacity: isVoting ? 0.6 : 1,
                                                                            }}
                                                                        >
                                                                            {isThis ? <Flame size={11} /> : null}
                                                                            {label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                        {sdActive && !sdEligible && (
                                                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontStyle: 'italic' }}>Eliminated in sudden death</span>
                                                        )}
                                                        <Link to={(entry as any).trackRoute || `/battles/entry/${entry.id}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: colors.textSecondary, textDecoration: 'none' }}>
                                                            <ExternalLink size={13} /> View Entry
                                                        </Link>
                                                        {/* Per-rank tally */}
                                                        {(entry.firstPlaceVotes !== undefined || entry.secondPlaceVotes !== undefined || entry.thirdPlaceVotes !== undefined) && (
                                                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: colors.textSecondary, fontWeight: 600, display: 'flex', gap: '6px' }}>
                                                                <span title="1st place votes">🥇 {entry.firstPlaceVotes || 0}</span>
                                                                <span title="2nd place votes">🥈 {entry.secondPlaceVotes || 0}</span>
                                                                <span title="3rd place votes">🥉 {entry.thirdPlaceVotes || 0}</span>
                                                            </span>
                                                        )}
                                                        {hasVoted && (currentBattle.status === 'voting' || sdActive) && (
                                                            <span style={{ fontSize: '10px', color: colors.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Your {myRank === 1 ? '1st' : myRank === 2 ? '2nd' : '3rd'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* ── PAST BATTLES ── */}
                    {pastBattles.length > 0 && (
                        <section>
                            <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                <History size={14} color={colors.textSecondary} /> Past Battles
                            </h3>
                            <div style={{ backgroundColor: '#242C3D', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                {pastBattles.map((b, i) => {
                                    const hof = hallOfFame.find(h => h.battle.id === b.id);
                                    return (
                                        <Link key={b.id} to={`/battles/${b.slug || b.id}`} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: isMobile ? '10px 14px' : '12px 20px',
                                            borderBottom: i < pastBattles.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            textDecoration: 'none', transition: 'background-color 0.15s',
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(43,140,113,0.06)')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                        >
                                            {/* Winner avatar */}
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'rgba(255,215,0,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: hof?.winner ? `2px solid ${GOLD}` : '2px solid rgba(255,255,255,0.08)' }}>
                                                {hof?.winner?.avatarUrl
                                                    ? <img src={hof.winner.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <Trophy size={14} color={hof?.winner ? GOLD : colors.textSecondary} style={{ opacity: hof?.winner ? 1 : 0.4 }} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: colors.textPrimary, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</p>
                                            </div>
                                            {hof?.winner && (
                                                <span style={{ fontSize: '11px', color: GOLD, fontWeight: 700, flexShrink: 0, display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: '4px', textShadow: '0 0 6px rgba(255,215,0,0.4)' }}>
                                                    <Trophy size={11} /> <StyledUsername userId={hof.winner.userId} showBadge={false}>{hof.winner.username}</StyledUsername>
                                                </span>
                                            )}
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, flexShrink: 0, display: isMobile ? 'none' : 'block' }}>{b._count?.entries || 0} entries</span>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, flexShrink: 0 }}>{formatDate(b.votingEnd)}</span>
                                            <ChevronRight size={14} color="rgba(255,255,255,0.15)" style={{ flexShrink: 0 }} />
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            </div>
            {currentBattle && <BattleSubmitModal battleId={currentBattle.id} requireProjectFile={currentBattle.requireProjectFile} open={showSubmitModal} onClose={() => setShowSubmitModal(false)} onSubmitted={() => { setSubmitToast(true); setTimeout(() => setSubmitToast(false), 6000); load(); }} />}
        </DiscoveryLayout>
    );
};

