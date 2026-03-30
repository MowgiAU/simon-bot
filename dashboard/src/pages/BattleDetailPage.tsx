import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import {
    ArrowLeft, Swords, Play, Pause, Vote, LogIn, ExternalLink,
    Flame, MessageSquare, Trophy, Calendar, Users, Shield, Check, Upload,
    Download, Music,
} from 'lucide-react';
import { BattleSubmitModal } from '../components/BattleSubmitModal';

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
    const [showSubmitModal, setShowSubmitModal] = useState(false);

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
        if (!battle) return;
        document.title = `${battle.title} | Beat Battle | Fuji Studio`;
        const setMeta = (prop: string, content: string) => {
            let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
            if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
            el.setAttribute('content', content);
        };
        setMeta('og:title', `${battle.title} | Beat Battle`);
        setMeta('og:description', battle.description || 'Join the beat battle on Fuji Studio — submit your track and win prizes.');
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

    // Structured rules (new format) with backward compat for plain-text rules
    const rulesItems: { text: string; links?: { label: string; url: string }[]; samples?: { name: string; url: string }[] }[] =
        (battle.rulesData && (battle.rulesData as any[]).length > 0)
            ? (battle.rulesData as any[])
            : rules.map(text => ({ text }));

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
                .hd-entry-card { transition: border-color 0.2s; }
                .hd-entry-card:hover { border-color: rgba(43,140,113,0.4) !important; }
                .hd-sponsor-bar { opacity: 0.55; filter: grayscale(1); transition: all 0.4s; }
                .hd-sponsor-bar:hover { opacity: 1; filter: grayscale(0); }
            `}</style>

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

                            {battle.description && (
                                <p style={{ margin: 0, fontSize: isMobile ? '14px' : '16px', color: colors.textSecondary, maxWidth: '520px', lineHeight: 1.7 }}>
                                    {renderWithLinks(battle.description)}
                                </p>
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
                    <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '40px 24px', backgroundColor: 'rgba(255,255,255,0.015)', marginBottom: '48px' }}>
                        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <p style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: colors.textSecondary, margin: 0 }}>Official Sponsor</p>
                            <div className="hd-sponsor-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                {battle.sponsor.logoUrl && (
                                    <img src={battle.sponsor.logoUrl} alt={battle.sponsor.name} style={{ height: '36px' }} />
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
                            {battle.sponsor.description && (
                                <p style={{ margin: 0, textAlign: 'center', fontSize: '13px', color: colors.textSecondary, maxWidth: '560px', lineHeight: 1.6 }}>
                                    {renderWithLinks(battle.sponsor.description)}
                                </p>
                            )}
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
                                        <div key={i} style={{ display: 'flex', gap: '14px', padding: '14px 16px', backgroundColor: `${colors.primary}08`, border: `1px solid ${colors.primary}18`, borderRadius: borderRadius.md, alignItems: 'flex-start' }}>
                                            {p.imageUrl && (
                                                <img src={p.imageUrl} alt={p.title || p.place} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
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

                {/* ── COMMUNITY SUBMISSIONS ── */}
                <section id="submissions" style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '32px 16px 56px' : '48px 24px 72px' }}>

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
                                                    {(entry.coverUrl || entry.avatarUrl) ? (
                                                        <img src={(entry.coverUrl || entry.avatarUrl)!.startsWith('http') ? (entry.coverUrl || entry.avatarUrl)! : `${API}${entry.coverUrl || entry.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Swords size={24} color={colors.textSecondary} style={{ opacity: 0.3 }} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <Link to={`/battles/entry/${entry.id}`} style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', display: 'block' }}>
                                                        {entry.trackTitle}
                                                    </Link>
                                                    <Link to={`/profile/${entry.userId}`} style={{ margin: '0 0 5px', fontSize: '13px', color: colors.primary, fontWeight: 600, textDecoration: 'none', display: 'block' }}>
                                                        @{entry.username}
                                                    </Link>
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
                                                        setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`, entryRoute: `/battles/entry/${entry.id}` });
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
                                                                setTrack({ id: trackId, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`, entryRoute: `/battles/entry/${entry.id}` });
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
            {battle && <BattleSubmitModal battleId={battle.id} requireProjectFile={battle.requireProjectFile} open={showSubmitModal} onClose={() => setShowSubmitModal(false)} onSubmitted={() => {
                setLoading(true);
                fetch(`${API}/api/beat-battle/battles/${battle.slug || battleId}`, { credentials: 'include' })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => { if (data) setBattle(data); })
                    .catch(() => {})
                    .finally(() => setLoading(false));
            }} />}
        </DiscoveryLayout>
    );
};
