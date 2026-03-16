import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import {
    ArrowLeft, Swords, Play, Pause, Vote, LogIn, ExternalLink,
    Flame, MessageSquare, Trophy, Calendar, Users, Shield, Check,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';
const ACCENT = '#F97316';

const statusConfig: Record<string, { label: string; color: string }> = {
    upcoming:  { label: 'UPCOMING',         color: '#60A5FA' },
    active:    { label: 'SUBMISSIONS OPEN', color: '#34D399' },
    voting:    { label: 'VOTING LIVE',      color: ACCENT },
    completed: { label: 'ENDED',            color: '#6B7280' },
};

function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return '—';
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
    return formatDate(start || end);
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
    description: string | null;
    status: string;
    rules: string | null;
    prizes: { place: string; description: string }[] | null;
    submissionStart: string | null;
    submissionEnd: string | null;
    votingStart: string | null;
    votingEnd: string | null;
    winnerEntryId: string | null;
    discordInviteUrl: string | null;
    sponsor: {
        id: string;
        name: string;
        logoUrl: string | null;
        websiteUrl: string | null;
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
    duration?: number;
    voteCount: number;
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
    const [votingId, setVotingId] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'recent' | 'top'>('recent');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Extract battleId from /battles/:id
    const battleId = pathname.split('/').filter(Boolean)[1];

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!battleId) return;
        setLoading(true);
        fetch(`${API}/api/beat-battle/battles/${battleId}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setBattle(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [battleId]);

    useEffect(() => {
        if (battle) document.title = `${battle.title} | Beat Battle | Fuji Studio`;
    }, [battle]);

    const vote = async (entryId: string) => {
        if (!user) { window.location.href = '/api/auth/discord/login'; return; }
        setVotingId(entryId);
        try {
            const res = await fetch(`${API}/api/beat-battle/entries/${entryId}/vote`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setVotedIds(prev => {
                    const next = new Set(prev);
                    if (data.voted) next.add(entryId); else next.delete(entryId);
                    return next;
                });
                const updated = await fetch(`${API}/api/beat-battle/battles/${battleId}`, { credentials: 'include' });
                if (updated.ok) setBattle(await updated.json());
            }
        } catch {} finally { setVotingId(null); }
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
    const sortedEntries = sortOrder === 'top'
        ? [...entries].sort((a, b) => b.voteCount - a.voteCount)
        : [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const rules = battle.rules
        ? battle.rules.split('\n').map(r => r.trim()).filter(Boolean)
        : [];

    const isLive = battle.status === 'active' || battle.status === 'voting';

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
            note: 'Results posted on Discord',
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
                .hd-entry-card { transition: border-color 0.2s; }
                .hd-entry-card:hover { border-color: rgba(43,140,113,0.4) !important; }
                .hd-sponsor-bar { opacity: 0.55; filter: grayscale(1); transition: all 0.4s; }
                .hd-sponsor-bar:hover { opacity: 1; filter: grayscale(0); }
            `}</style>

            <div style={{ overflowX: 'hidden' }}>

                {/* ── HERO ── */}
                <section style={{ maxWidth: '1160px', margin: '0 auto', padding: isMobile ? '20px 16px 0' : '40px 24px 0' }}>

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

                            {battle.description && (
                                <p style={{ margin: 0, fontSize: isMobile ? '14px' : '16px', color: colors.textSecondary, maxWidth: '520px', lineHeight: 1.7 }}>
                                    {battle.description}
                                </p>
                            )}

                            {/* CTAs */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {battle.status === 'active' && battle.discordInviteUrl && (
                                    <a href={battle.discordInviteUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ backgroundColor: ACCENT, color: '#fff', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
                                        <MessageSquare size={16} /> Enter Battle
                                    </a>
                                )}
                                {battle.status === 'voting' && (
                                    <button onClick={() => document.getElementById('submissions')?.scrollIntoView({ behavior: 'smooth' })}
                                        style={{ backgroundColor: ACCENT, color: '#fff', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
                                        <Vote size={16} /> Vote Now
                                    </button>
                                )}
                                {battle.status === 'upcoming' && battle.discordInviteUrl && (
                                    <a href={battle.discordInviteUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ backgroundColor: 'rgba(96,165,250,0.15)', color: '#60A5FA', padding: '12px 32px', borderRadius: borderRadius.lg, fontWeight: 700, fontSize: '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(96,165,250,0.25)' }}>
                                        <MessageSquare size={16} /> Get Notified
                                    </a>
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
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── TIMELINE ── */}
                <section style={{ maxWidth: '1160px', margin: '0 auto', padding: isMobile ? '32px 16px' : '56px 24px' }}>
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

                {/* ── RULES + PRIZES ── */}
                <section style={{ maxWidth: '1160px', margin: '0 auto', padding: isMobile ? '0 16px 32px' : '0 24px 48px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>

                        {/* Rules card */}
                        <div style={{ backgroundColor: '#242C3D', padding: isMobile ? '20px' : '32px', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Shield size={18} color={colors.primary} />
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.textPrimary }}>Battle Rules</h3>
                            </div>
                            {rules.length > 0 ? (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {rules.map((rule, i) => (
                                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ marginTop: '2px', flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%', backgroundColor: `${colors.primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Check size={10} color={colors.primary} />
                                            </div>
                                            <span style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>{rule}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                                    Rules will be posted when the battle opens. Follow our Discord for updates.
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {battle.prizes.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: `${colors.primary}08`, border: `1px solid ${colors.primary}18`, borderRadius: borderRadius.md }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '20px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>{p.place}</span>
                                            </div>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: colors.primary }}>{p.description}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                                    Prizes to be announced. {battle.discordInviteUrl && (
                                        <a href={battle.discordInviteUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>Join Discord</a>
                                    )} for updates.
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── SPONSOR STRIP ── */}
                {battle.sponsor && (
                    <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '20px 24px', backgroundColor: 'rgba(255,255,255,0.015)' }}>
                        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                            <p style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: colors.textSecondary, marginBottom: '16px' }}>Official Sponsors</p>
                            <div className="hd-sponsor-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                {battle.sponsor.logoUrl && (
                                    <img src={battle.sponsor.logoUrl} alt={battle.sponsor.name} style={{ height: '32px' }} />
                                )}
                                <span style={{ fontWeight: 800, fontSize: '18px', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {battle.sponsor.name}
                                </span>
                                {battle.sponsor.links.map(l => (
                                    <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                                        onClick={() => fetch(`${API}/api/beat-battle/sponsor-links/${l.id}/click`, { method: 'POST' }).catch(() => {})}
                                        style={{ fontSize: '12px', color: colors.primary, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', backgroundColor: `${colors.primary}15`, padding: '5px 10px', borderRadius: '6px', border: `1px solid ${colors.primary}25` }}>
                                        {l.label} <ExternalLink size={11} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── COMMUNITY SUBMISSIONS ── */}
                <section id="submissions" style={{ maxWidth: '1160px', margin: '0 auto', padding: isMobile ? '32px 16px 56px' : '48px 24px 72px' }}>

                    {/* Section header */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '28px' }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>Community Submissions</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Discover and vote for your favourite entries.</p>
                        </div>
                        {entries.length > 0 && (
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

                    {/* Empty state */}
                    {entries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#242C3D', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Swords size={40} color={colors.textSecondary} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: '16px', fontWeight: 600 }}>No submissions yet</p>
                            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px' }}>Be the first to enter this battle.</p>
                            {battle.status === 'active' && battle.discordInviteUrl && (
                                <a href={battle.discordInviteUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '20px', backgroundColor: `${colors.primary}15`, color: colors.primary, textDecoration: 'none', fontSize: '13px', fontWeight: 600, padding: '9px 20px', borderRadius: '8px', border: `1px solid ${colors.primary}25` }}>
                                    <MessageSquare size={14} /> Submit on Discord
                                </a>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {sortedEntries.map((entry, i) => {
                                const hasVoted = votedIds.has(entry.id);
                                const isVoting = votingId === entry.id;
                                const trackId = `battle-entry-${entry.id}`;
                                const isCurrentlyPlaying = player.currentTrack?.id === trackId && player.isPlaying;
                                const bars = waveHeights(entry.id);
                                // Color bars based on play state (first ~45% highlighted when playing)
                                const playedCount = isCurrentlyPlaying ? Math.floor(bars.length * 0.45) : 0;

                                return (
                                    <div key={entry.id} className="hd-entry-card"
                                        style={{
                                            backgroundColor: '#242C3D',
                                            borderRadius: borderRadius.lg,
                                            border: sortOrder === 'top' && i === 0
                                                ? `1px solid ${colors.primary}35`
                                                : '1px solid rgba(255,255,255,0.05)',
                                            overflow: 'hidden',
                                            padding: isMobile ? '16px' : '20px 24px',
                                        }}>
                                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '14px' : '28px' }}>

                                            {/* Cover + title */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: isMobile ? '100%' : '300px', flexShrink: 0 }}>
                                                <div style={{ width: '72px', height: '72px', borderRadius: borderRadius.md, backgroundColor: '#1A1E2E', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                                    {(entry.avatarUrl || entry.coverUrl) ? (
                                                        <img src={entry.avatarUrl || entry.coverUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Swords size={24} color={colors.textSecondary} style={{ opacity: 0.3 }} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {entry.trackTitle}
                                                    </h4>
                                                    <p style={{ margin: '0 0 5px', fontSize: '13px', color: colors.primary, fontWeight: 600 }}>
                                                        @{entry.username}
                                                    </p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <Flame size={11} color={ACCENT} />
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT }}>{entry.voteCount} votes</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Waveform + actions */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', width: isMobile ? '100%' : undefined }}>

                                                {/* Waveform — clickable to play */}
                                                <div
                                                    onClick={() => {
                                                        if (player.currentTrack?.id === trackId) { togglePlay(); return; }
                                                        setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.avatarUrl || entry.coverUrl || '', url: `${API}${entry.audioUrl}` });
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '48px', width: '100%', cursor: 'pointer' }}>
                                                    {bars.map((h, bi) => (
                                                        <div key={bi} style={{
                                                            flex: 1, borderRadius: '2px 2px 0 0',
                                                            height: `${h}%`,
                                                            backgroundColor: bi < playedCount || isCurrentlyPlaying
                                                                ? colors.primary
                                                                : `${colors.primary}28`,
                                                            transition: 'background-color 0.15s',
                                                        }} />
                                                    ))}
                                                </div>

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {entry.audioUrl && (
                                                        <button
                                                            onClick={() => {
                                                                if (player.currentTrack?.id === trackId) { togglePlay(); return; }
                                                                setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.avatarUrl || entry.coverUrl || '', url: `${API}${entry.audioUrl}` });
                                                            }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: colors.textPrimary, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                                            {isCurrentlyPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} fill="currentColor" /> Play</>}
                                                        </button>
                                                    )}
                                                    {battle.status === 'voting' && (
                                                        <button onClick={() => vote(entry.id)} disabled={isVoting}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                                padding: '8px 22px',
                                                                backgroundColor: hasVoted ? `${colors.primary}22` : colors.primary,
                                                                color: hasVoted ? colors.primary : '#fff',
                                                                borderRadius: '8px', border: hasVoted ? `1px solid ${colors.primary}40` : 'none',
                                                                cursor: isVoting ? 'not-allowed' : 'pointer',
                                                                fontSize: '13px', fontWeight: 800, opacity: isVoting ? 0.6 : 1,
                                                                boxShadow: hasVoted ? 'none' : `0 4px 14px ${colors.primary}40`,
                                                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                                            }}>
                                                            <Vote size={14} />
                                                            {hasVoted ? 'Voted ✓' : isVoting ? '…' : 'Vote'}
                                                        </button>
                                                    )}
                                                    {!user && battle.status === 'voting' && (
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
        </DiscoveryLayout>
    );
};
