import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import {
    Swords, Trophy, Users, Play, Pause, Vote,
    LogIn, ExternalLink, Flame, MessageSquare, Zap, History, Upload
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
    if (!d) return 'â€”';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const MEDAL_GOLD   = '\u{1F947}';
const MEDAL_SILVER = '\u{1F948}';
const MEDAL_BRONZE = '\u{1F949}';
const FIRE         = '\u{1F525}';
const placeEmoji = (i: number) => i === 0 ? MEDAL_GOLD : i === 1 ? MEDAL_SILVER : i === 2 ? MEDAL_BRONZE : `#${i + 1}`;

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
    bannerUrl: string | null;
    requireProjectFile?: boolean;
    sponsor: { id: string; name: string; logoUrl: string | null; websiteUrl: string | null; links: { id: string; label: string; url: string }[] } | null;
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
    const [votingId, setVotingId] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
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
            const [battlesRes, pageSettingsRes, sponsorsRes] = await Promise.all([
                fetch(`${API}/api/beat-battle/battles?guildId=default-guild`),
                fetch(`${API}/api/beat-battle/page-settings?guildId=default-guild`),
                fetch(`${API}/api/beat-battle/sponsors?guildId=default-guild`),
            ]);
            if (!battlesRes.ok) return;
            const data: Battle[] = await battlesRes.json();
            setBattles(data);

            if (pageSettingsRes.ok) {
                const ps = await pageSettingsRes.json();
                if (ps.sponsorSectionTitle) setSponsorSectionTitle(ps.sponsorSectionTitle);
                if (sponsorsRes.ok) setGlobalSponsors(await sponsorsRes.json());

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
                if (sponsorsRes.ok) setGlobalSponsors(await sponsorsRes.json());
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

    // Countdown timer
    useEffect(() => {
        if (!currentBattle) return;
        const target =
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

    // Hall of Fame â€” fetch top 3 completed battles for winner data
    useEffect(() => {
        const completed = battles.filter(b => b.status === 'completed').slice(0, 3);
        if (!completed.length) return;
        Promise.all(
            completed.map(async b => {
                try {
                    const res = await fetch(`${API}/api/beat-battle/battles/${b.id}`);
                    if (!res.ok) return { battle: b, winner: null };
                    const data: Battle = await res.json();
                    const winner = data.entries?.find(e => e.id === data.winnerEntryId) || data.entries?.[0] || null;
                    return { battle: data, winner };
                } catch { return { battle: b, winner: null }; }
            })
        ).then(setHallOfFame);
    }, [battles]);

    const vote = async (entryId: string) => {
        if (!user) { window.location.href = '/api/auth/discord/login'; return; }
        setVotingId(entryId);
        try {
            const res = await fetch(`${API}/api/beat-battle/entries/${entryId}/vote`, { method: 'POST', credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setVotedIds(prev => {
                    const next = new Set(prev);
                    if (data.voted) next.add(entryId); else next.delete(entryId);
                    return next;
                });
                if (currentBattle) {
                    const detail = await fetch(`${API}/api/beat-battle/battles/${currentBattle.id}`, { credentials: 'include' });
                    if (detail.ok) setCurrentBattle(await detail.json());
                }
            }
        } catch {} finally { setVotingId(null); }
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
            <div style={{ overflowX: 'hidden' }}>

                {/* â”€â”€ HERO â”€â”€ */}
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: isMobile ? '16px 16px 0' : '32px 24px 0' }}>
                    {currentBattle ? (
                        <div style={{
                            position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden',
                            backgroundColor: '#242C3D', minHeight: isMobile ? '280px' : '420px',
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
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
                            <div style={{ position: 'relative', zIndex: 2, padding: isMobile ? '24px 20px' : '40px 48px' }}>
                                {/* Status badge */}
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: currentBattle.status === 'voting' ? ACCENT : '#34D399', fontWeight: 700, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
                                    <Flame size={13} />
                                    {currentBattle.status === 'voting' ? 'Voting Live' : currentBattle.status === 'active' ? 'Submissions Open' : 'Coming Soon'}
                                </div>
                                <Link to={`/battles/${currentBattle.id}`} style={{ textDecoration: 'none' }}>
                                    <h2 style={{ margin: '0 0 12px', fontSize: isMobile ? '28px' : '52px', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                                        {currentBattle.title}
                                    </h2>
                                </Link>
                                {currentBattle.description && (
                                    <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.55)', maxWidth: '580px', fontSize: isMobile ? '13px' : '15px', lineHeight: 1.65 }}>
                                        {currentBattle.description}
                                    </p>
                                )}
                                {/* Countdown row */}
                                {countdown && (
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                        {[
                                            { val: countdown.days, label: 'Days' },
                                            { val: countdown.hours, label: 'Hrs' },
                                            { val: countdown.minutes, label: 'Min' },
                                        ].map(({ val, label }) => (
                                            <div key={label} style={{ textAlign: 'center' }}>
                                                <div style={{ width: isMobile ? '48px' : '60px', height: isMobile ? '48px' : '60px', backgroundColor: ACCENT, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '20px' : '24px', fontWeight: 800, color: '#fff' }}>
                                                    {String(val).padStart(2, '0')}
                                                </div>
                                                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'block', marginTop: '4px', letterSpacing: '0.1em' }}>{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* CTA buttons row */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                                    {currentBattle.status === 'active' && user && (
                                        <button onClick={() => setShowSubmitModal(true)}
                                            style={{ backgroundColor: colors.primary, color: '#fff', padding: isMobile ? '11px 22px' : '14px 36px', borderRadius: '8px', fontWeight: 700, fontSize: isMobile ? '13px' : '15px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: `0 8px 24px ${colors.primary}40` }}>
                                            <Upload size={16} /> Submit Entry
                                        </button>
                                    )}
                                    {currentBattle.status === 'active' && !user && (
                                        <a href="/api/auth/discord/login"
                                            style={{ backgroundColor: colors.primary, color: '#fff', padding: isMobile ? '11px 22px' : '14px 36px', borderRadius: '8px', fontWeight: 700, fontSize: isMobile ? '13px' : '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: `0 8px 24px ${colors.primary}40` }}>
                                            <LogIn size={16} /> Log in to Submit
                                        </a>
                                    )}
                                    {currentBattle.status === 'voting' && (
                                        <button onClick={() => document.getElementById('entries-section')?.scrollIntoView({ behavior: 'smooth' })}
                                            style={{ backgroundColor: ACCENT, color: '#fff', padding: isMobile ? '11px 22px' : '14px 36px', borderRadius: '8px', fontWeight: 700, fontSize: isMobile ? '13px' : '15px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
                                            <Vote size={16} /> Vote Now
                                        </button>
                                    )}
                                    {currentBattle.status === 'upcoming' && (
                                        <Link to={`/battles/${currentBattle.id}`}
                                            style={{ backgroundColor: 'rgba(96,165,250,0.15)', color: '#60A5FA', padding: isMobile ? '11px 22px' : '14px 32px', borderRadius: '8px', fontWeight: 700, fontSize: isMobile ? '13px' : '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(96,165,250,0.25)' }}>
                                            <Swords size={16} /> View Details
                                        </Link>
                                    )}
                                    <Link to={`/battles/${currentBattle.id}`}
                                        style={{ color: 'rgba(255,255,255,0.45)', fontSize: isMobile ? '12px' : '13px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: isMobile ? '11px 18px' : '14px 24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '60px 40px', textAlign: 'center', backgroundColor: '#242C3D', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Swords size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <p style={{ color: colors.textSecondary, fontSize: '16px', margin: 0 }}>No active battle right now.</p>
                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: '8px 0 0', opacity: 0.6 }}>Check back soon — new battles are coming!</p>
                        </div>
                    )}
                </div>

                {/* â”€â”€ SPONSOR STRIP â”€â”€ */}
                {/* ─── SPONSORS GRID ─── */}
                {globalSponsors.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '28px 24px', marginTop: '24px', backgroundColor: 'rgba(255,255,255,0.015)' }}>
                        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                            <p style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: colors.textSecondary, marginBottom: '20px' }}>{sponsorSectionTitle}</p>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                {globalSponsors.map(s => {
                                    const href = s.links[0]?.url || s.websiteUrl;
                                    const inner = s.logoUrl
                                        ? <img src={s.logoUrl} alt={s.name} style={{ width: '80px', height: '40px', objectFit: 'contain', opacity: 0.75 }} />
                                        : <span style={{ fontWeight: 800, fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', textAlign: 'center' }}>{s.name.toUpperCase()}</span>;
                                    const boxStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '120px', height: '80px', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' };
                                    return href ? (
                                        <a key={s.id} href={href} target="_blank" rel="noopener noreferrer"
                                            onClick={() => s.links[0] && fetch(`${API}/api/beat-battle/sponsor-links/${s.links[0].id}/click`, { method: 'POST' }).catch(() => {})}
                                            style={{ ...boxStyle, textDecoration: 'none', transition: 'border-color 0.2s' }}
                                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
                                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                                        >{inner}</a>
                                    ) : (
                                        <div key={s.id} style={boxStyle}>{inner}</div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* â”€â”€ MAIN CONTENT â”€â”€ */}
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px' }}>

                    {/* â”€â”€ THREE COLUMNS: Active Battles | How To | Hall of Fame â”€â”€ */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '24px', marginBottom: '48px' }}>

                        {/* Column 1: Active Battles */}
                        <div>
                            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Swords size={16} color={colors.primary} /> Active Battles
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {activeBattles.length === 0 ? (
                                    <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0 }}>No active battles right now.</p>
                                ) : activeBattles.map(b => {
                                    const cfg = statusConfig[b.status] || statusConfig.upcoming;
                                    return (
                                        <Link key={b.id} to={`/battles/${b.id}`} style={{ textDecoration: 'none', display: 'block', backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px', transition: 'border-color 0.2s' }}
                                            onMouseEnter={e => (e.currentTarget.style.borderColor = `${colors.primary}50`)}
                                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                {b.sponsor ? (
                                                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 7px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{b.sponsor.name}</span>
                                                ) : <span />}
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                                            </div>
                                            <h4 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>{b.title}</h4>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary }}>
                                                <Users size={12} /> {b._count?.entries || 0} Participants
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Column 2: How to Participate */}
                        <div>
                            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={16} color={colors.primary} /> How to Participate
                            </h3>
                            <div style={{ backgroundColor: '#242C3D', borderRadius: '10px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
                                <p style={{ margin: '0 0 20px', fontSize: '13px', color: colors.textSecondary, lineHeight: 1.65 }}>
                                    Ready to show your skills? Follow these steps to enter the arena and win big.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {[
                                        { n: 1, title: 'Log In', desc: 'Sign in with your Discord account to access battle submissions and voting.' },
                                        { n: 2, title: 'Submit Your Beat', desc: 'Upload a new track or choose one from your music library right here on the site.' },
                                        { n: 3, title: 'Share & Get Votes', desc: 'Rally your community! The most voted beats advance to win prizes.' },
                                    ].map(({ n, title, desc }) => (
                                        <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: `${colors.primary}18`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary, fontWeight: 700, fontSize: '14px' }}>{n}</div>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>{title}</p>
                                                <p style={{ margin: '3px 0 0', fontSize: '12px', color: colors.textSecondary, lineHeight: 1.5 }}>{desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {(() => {
                                    const activeBattle = currentBattle && (currentBattle.status === 'active' || currentBattle.status === 'voting') ? currentBattle : null;
                                    if (user && activeBattle) {
                                        return (
                                            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                <Link to={`/battles/${activeBattle.id}`}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', backgroundColor: `${colors.primary}12`, color: colors.primary, padding: '10px', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, border: `1px solid ${colors.primary}20` }}>
                                                    <Swords size={14} /> View Active Battle
                                                </Link>
                                            </div>
                                        );
                                    }
                                    if (!user) {
                                        return (
                                            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                <a href="/api/auth/discord/login"
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', backgroundColor: `${colors.primary}12`, color: colors.primary, padding: '10px', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, border: `1px solid ${colors.primary}20` }}>
                                                    <LogIn size={14} /> Log In to Participate
                                                </a>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>

                        {/* Column 3: Hall of Fame */}
                        <div>
                            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trophy size={16} color={ACCENT} /> Hall of Fame
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {hallOfFame.length === 0 ? (
                                    <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0 }}>No past winners yet.</p>
                                ) : hallOfFame.map(({ battle, winner }) => (
                                    <div key={battle.id} style={{ backgroundColor: '#242C3D', borderRadius: '10px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: `2px solid ${colors.primary}35`, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {winner?.avatarUrl
                                                    ? <img src={winner.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <Trophy size={18} color={ACCENT} />}
                                            </div>
                                            <div style={{ position: 'absolute', bottom: '-3px', right: '-5px', backgroundColor: ACCENT, color: '#fff', fontSize: '8px', fontWeight: 700, padding: '2px 5px', borderRadius: '99px', border: '2px solid #242C3D' }}>#1</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{winner?.username || 'â€”'}</h5>
                                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{winner?.trackTitle || battle.title}</p>
                                        </div>
                                        {winner?.audioUrl && (
                                            <button onClick={() => {
                                                const id = `battle-${winner.id}`;
                                                if (player.currentTrack?.id === id) { togglePlay(); return; }
                                                setTrack({ id, title: winner.trackTitle, artist: winner.username, cover: winner.avatarUrl || winner.coverUrl || '', url: `${API}${winner.audioUrl}` });
                                            }} style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${colors.primary}18`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary, flexShrink: 0 }}>
                                                {player.currentTrack?.id === `battle-${winner.id}` && player.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* â”€â”€ ENTRIES / VOTING â”€â”€ */}
                    {currentBattle && (currentBattle.status === 'voting' || currentBattle.status === 'active') && currentBattle.entries && currentBattle.entries.length > 0 && (
                        <section id="entries-section" style={{ marginBottom: '48px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Vote size={16} color={colors.primary} />
                                    {currentBattle.status === 'voting' ? 'Vote for Your Favourite' : 'Submissions'}
                                    <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: 400 }}>{currentBattle.entries.length} entries</span>
                                </h3>
                                {currentBattle.status === 'voting' && !user && (
                                    <a href="/api/auth/discord/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.primary, textDecoration: 'none', backgroundColor: `${colors.primary}15`, padding: '6px 12px', borderRadius: '6px', border: `1px solid ${colors.primary}30` }}>
                                        <LogIn size={13} /> Log in to vote
                                    </a>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                                {currentBattle.entries.map((entry, i) => {
                                    const hasVoted = votedIds.has(entry.id);
                                    const isVoting = votingId === entry.id;
                                    const isPlaying = player.currentTrack?.id === `battle-${entry.id}` && player.isPlaying;
                                    return (
                                        <div key={entry.id} style={{ backgroundColor: '#242C3D', border: i === 0 ? `1px solid ${colors.primary}40` : '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s', cursor: 'pointer' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${colors.primary}55`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = i === 0 ? `${colors.primary}40` : 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        >
                                            {/* Cover Art */}
                                            <div
                                                style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', backgroundColor: '#1A1E2E' }}
                                                onClick={() => {
                                                    if (!entry.audioUrl) return;
                                                    const id = `battle-${entry.id}`;
                                                    if (player.currentTrack?.id === id) { togglePlay(); return; }
                                                    setTrack({ id, title: entry.trackTitle, artist: entry.username, cover: entry.coverUrl || entry.avatarUrl || '', url: entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}` });
                                                }}
                                            >
                                                {entry.coverUrl ? (
                                                    <img src={entry.coverUrl.startsWith('http') ? entry.coverUrl : `${API}${entry.coverUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : entry.avatarUrl ? (
                                                    <img src={entry.avatarUrl.startsWith('http') ? entry.avatarUrl : `${API}${entry.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.5)', transform: 'scale(1.1)' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Music size={32} color={colors.textSecondary} style={{ opacity: 0.2 }} />
                                                    </div>
                                                )}
                                                {/* Play overlay */}
                                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0, transition: 'opacity 0.15s' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={(e) => { if (!isPlaying) e.currentTarget.style.opacity = '0'; }}
                                                >
                                                    {isPlaying ? <Pause size={24} fill="white" color="white" /> : <Play size={24} fill="white" color="white" />}
                                                </div>
                                                {/* Rank badge */}
                                                {i < 3 && (
                                                    <div style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '16px', lineHeight: 1 }}>{placeEmoji(i)}</div>
                                                )}
                                                {/* Vote count */}
                                                <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 800, color: colors.primary, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    {FIRE} {entry.voteCount}
                                                </div>
                                            </div>
                                            {/* Info */}
                                            <div style={{ padding: '12px 14px' }}>
                                                <Link to={`/battles/entry/${entry.id}`} style={{ margin: 0, fontWeight: 700, color: colors.textPrimary, fontSize: '13px', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>{entry.trackTitle}</Link>
                                                <Link to={`/profile/${entry.userId}`} style={{ margin: '3px 0 0', color: colors.textSecondary, fontSize: '11px', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>by {entry.username}</Link>
                                                {currentBattle.status === 'voting' && (
                                                    <button onClick={() => vote(entry.id)} disabled={isVoting} style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: hasVoted ? `${colors.primary}30` : colors.primary, color: hasVoted ? colors.primary : '#fff', fontSize: '11px', fontWeight: 700, opacity: isVoting ? 0.6 : 1 }}>
                                                        <Flame size={12} /> {hasVoted ? 'Voted' : isVoting ? '\u2026' : 'Vote'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* â”€â”€ PAST BATTLES TABLE â”€â”€ */}
                    {pastBattles.length > 0 && (
                        <section>
                            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={16} color={colors.textSecondary} /> Past Battles Archive
                            </h3>
                            <div style={{ backgroundColor: '#242C3D', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                {isMobile ? (
                                    <div>
                                        {pastBattles.map((b, i) => {
                                            const hof = hallOfFame.find(h => h.battle.id === b.id);
                                            return (
                                                <Link key={b.id} to={`/battles/${b.id}`} style={{ display: 'block', padding: '14px 16px', borderBottom: i < pastBattles.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', textDecoration: 'none' }}>
                                                    <p style={{ margin: 0, fontWeight: 600, color: colors.textPrimary, fontSize: '14px' }}>{b.title}</p>
                                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                                                        {formatDate(b.votingEnd)}
                                                        {hof?.winner && <span style={{ color: colors.primary, fontWeight: 700, marginLeft: '8px' }}>{'\u{1F3C6}'} {hof.winner.username}</span>}
                                                        <span style={{ marginLeft: '8px' }}>{b._count?.entries || 0} entries</span>
                                                    </p>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                {['Battle Name', 'Date', 'Winner', 'Entries'].map(h => (
                                                    <th key={h} style={{ padding: '14px 24px', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: colors.textSecondary }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pastBattles.map((b, i) => {
                                                const hof = hallOfFame.find(h => h.battle.id === b.id);
                                                return (
                                                    <tr key={b.id}
                                                        onClick={() => window.location.href = `/battles/${b.id}`}
                                                        style={{ borderBottom: i < pastBattles.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(43,140,113,0.06)')}
                                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                                                        <td style={{ padding: '14px 24px', fontWeight: 600, color: colors.textPrimary }}>{b.title}</td>
                                                        <td style={{ padding: '14px 24px', color: colors.textSecondary }}>{formatDate(b.votingEnd)}</td>
                                                        <td style={{ padding: '14px 24px', fontWeight: 700, color: colors.primary }}>{hof?.winner?.username || '—'}</td>
                                                        <td style={{ padding: '14px 24px', color: colors.textSecondary }}>{b._count?.entries || 0}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
            {currentBattle && <BattleSubmitModal battleId={currentBattle.id} requireProjectFile={currentBattle.requireProjectFile} open={showSubmitModal} onClose={() => setShowSubmitModal(false)} onSubmitted={load} />}
        </DiscoveryLayout>
    );
};

