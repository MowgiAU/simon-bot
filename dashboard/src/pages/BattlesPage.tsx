import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import {
    Swords, Trophy, Calendar, Users, Play, Vote, Gift,
    Building2, Clock, ChevronDown, ChevronUp, LogIn, Award,
    ExternalLink, Flame, ArrowRight, Star, MessageSquare, Hash, Send
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

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
    submissionChannelId?: string | null;
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
    duration?: number;
    voteCount: number;
    source: string;
    createdAt: string;
}

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    upcoming:  { label: 'UPCOMING',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
    active:    { label: 'OPEN',      color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
    voting:    { label: 'VOTING',    color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
    completed: { label: 'ENDED',     color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

const placeEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
const placeColor = (i: number) => i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : colors.textSecondary;

function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

function timeRemaining(d: string | null) {
    if (!d) return null;
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
}

export const BattlesPage: React.FC = () => {
    const { user } = useAuth();
    const [battles, setBattles] = useState<Battle[]>([]);
    const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);
    const [loading, setLoading] = useState(true);
    const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
    const [votingId, setVotingId] = useState<string | null>(null);
    const [expandedArchive, setExpandedArchive] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/beat-battle/battles?guildId=default-guild`);
            if (!res.ok) return;
            const data: Battle[] = await res.json();
            setBattles(data);

            // Fetch full detail for the most prominent active/voting/upcoming battle
            const active = data.find(b => b.status === 'voting') ||
                           data.find(b => b.status === 'active') ||
                           data.find(b => b.status === 'upcoming');
            if (active) {
                const detail = await fetch(`${API}/api/beat-battle/battles/${active.id}`, { credentials: 'include' });
                if (detail.ok) setCurrentBattle(await detail.json());
            }
        } catch {} finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const vote = async (entryId: string) => {
        if (!user) { window.location.href = '/api/auth/discord/login'; return; }
        setVotingId(entryId);
        try {
            const res = await fetch(`${API}/api/beat-battle/entries/${entryId}/vote`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok || res.status === 409) {
                setVotedIds(prev => new Set([...prev, entryId]));
                // Refresh entries vote counts
                if (currentBattle) {
                    const detail = await fetch(`${API}/api/beat-battle/battles/${currentBattle.id}`, { credentials: 'include' });
                    if (detail.ok) setCurrentBattle(await detail.json());
                }
            }
        } catch {} finally { setVotingId(null); }
    };

    const pastBattles = battles.filter(b => b.status === 'completed');

    const card: React.CSSProperties = {
        backgroundColor: '#242C3D',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: borderRadius.lg,
    };

    if (loading) {
        return (
            <DiscoveryLayout activeTab="battles">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: colors.textSecondary }}>
                    Loading battles...
                </div>
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout activeTab="battles">
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>

                {/* Page Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: `${colors.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Swords size={24} color={colors.primary} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: isMobile ? '22px' : '28px', fontWeight: 800, color: colors.textPrimary }}>Beat Battles</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '14px' }}>
                            Community beat competitions — submit on Discord, vote here.
                        </p>
                    </div>
                </div>

                {/* ── CURRENT BATTLE ── */}
                {currentBattle ? (
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ ...card, border: `1px solid ${colors.primary}33`, overflow: 'hidden' }}>
                            {/* Top accent bar */}
                            <div style={{ height: '4px', background: `linear-gradient(90deg, ${colors.primary}, #60A5FA)` }} />

                            <div style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
                                {/* Title row */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <h2 style={{ margin: 0, fontSize: isMobile ? '20px' : '26px', fontWeight: 800, color: colors.textPrimary }}>
                                        {currentBattle.title}
                                    </h2>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
                                        padding: '4px 10px', borderRadius: '6px',
                                        color: statusLabel[currentBattle.status]?.color,
                                        backgroundColor: statusLabel[currentBattle.status]?.bg,
                                    }}>
                                        {statusLabel[currentBattle.status]?.label}
                                    </span>
                                </div>

                                {currentBattle.description && (
                                    <p style={{ margin: '0 0 20px', color: colors.textSecondary, fontSize: '15px', lineHeight: '1.6', maxWidth: '700px' }}>
                                        {currentBattle.description}
                                    </p>
                                )}

                                {/* Meta grid: prizes + timeline */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

                                    {/* Prizes */}
                                    {currentBattle.prizes && currentBattle.prizes.length > 0 && (
                                        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <Gift size={14} color={colors.primary} />
                                                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textSecondary }}>Prizes</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {currentBattle.prizes.map((p, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        <span style={{ fontSize: '16px' }}>{placeEmoji(i)}</span>
                                                        <div>
                                                            <span style={{ fontSize: '12px', fontWeight: 700, color: placeColor(i) }}>{p.place}</span>
                                                            {p.description && <span style={{ fontSize: '13px', color: colors.textPrimary, marginLeft: '6px' }}>— {p.description}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Calendar size={14} color={colors.primary} />
                                            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textSecondary }}>Timeline</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                                            {currentBattle.submissionStart && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: colors.textSecondary }}>Submissions open</span>
                                                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{formatDate(currentBattle.submissionStart)}</span>
                                                </div>
                                            )}
                                            {currentBattle.submissionEnd && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: colors.textSecondary }}>Submissions close</span>
                                                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{formatDate(currentBattle.submissionEnd)}</span>
                                                </div>
                                            )}
                                            {currentBattle.votingStart && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: colors.textSecondary }}>Voting opens</span>
                                                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{formatDate(currentBattle.votingStart)}</span>
                                                </div>
                                            )}
                                            {currentBattle.votingEnd && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: colors.textSecondary }}>Voting ends</span>
                                                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>
                                                        {formatDate(currentBattle.votingEnd)}
                                                        {currentBattle.status === 'voting' && (
                                                            <span style={{ marginLeft: '8px', color: '#FBBF24', fontSize: '11px' }}>
                                                                ({timeRemaining(currentBattle.votingEnd)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Rules */}
                                {currentBattle.rules && (
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', borderLeft: `3px solid ${colors.primary}40` }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, lineHeight: '1.6' }}>
                                            <strong style={{ color: colors.textPrimary }}>Rules: </strong>{currentBattle.rules}
                                        </p>
                                    </div>
                                )}

                                {/* Sponsor */}
                                {currentBattle.sponsor && (
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sponsored by</span>
                                        {currentBattle.sponsor.logoUrl && (
                                            <img src={currentBattle.sponsor.logoUrl} alt={currentBattle.sponsor.name} style={{ height: '24px', borderRadius: '4px' }} />
                                        )}
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: colors.textPrimary }}>{currentBattle.sponsor.name}</span>
                                        {currentBattle.sponsor.links.map(l => (
                                            <a
                                                key={l.id}
                                                href={l.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => fetch(`${API}/api/beat-battle/sponsor-links/${l.id}/click`, { method: 'POST' }).catch(() => {})}
                                                style={{ fontSize: '12px', color: colors.primary, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', backgroundColor: `${colors.primary}15`, padding: '4px 10px', borderRadius: '6px', border: `1px solid ${colors.primary}30` }}
                                            >
                                                {l.label} <ExternalLink size={11} />
                                            </a>
                                        ))}
                                    </div>
                                )}

                                {/* How to participate banner (if submissions open) */}
                                {currentBattle.status === 'active' && (
                                    <div style={{ backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30`, borderRadius: '12px', overflow: 'hidden' }}>
                                        {/* Header */}
                                        <div style={{ backgroundColor: `${colors.primary}18`, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Send size={18} color={colors.primary} />
                                                <span style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '15px' }}>Submissions are open!</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary }}>
                                                <Users size={13} /> {currentBattle._count?.entries || (currentBattle.entries?.length ?? 0)} entries so far
                                            </div>
                                        </div>
                                        {/* Steps */}
                                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${colors.primary}30`, color: colors.primary, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>Join the Discord server</p>
                                                    {currentBattle.discordInviteUrl ? (
                                                        <a href={currentBattle.discordInviteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '12px', color: colors.primary, textDecoration: 'none', backgroundColor: `${colors.primary}15`, padding: '4px 10px', borderRadius: '6px', border: `1px solid ${colors.primary}30` }}>
                                                            <MessageSquare size={12} /> Join Discord <ExternalLink size={10} />
                                                        </a>
                                                    ) : (
                                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>Find the invite link in the community.</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${colors.primary}30`, color: colors.primary, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>Find the submissions channel</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                                                        Look for a channel starting with <strong style={{ color: colors.textPrimary }}>submissions-</strong> in the Beat Battle category.
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${colors.primary}30`, color: colors.primary, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</span>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>Post your beat file</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                                                        Upload your <strong style={{ color: colors.textPrimary }}>MP3 or WAV</strong> file as a message attachment. Include the title of your beat in the message text. One entry per person.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentBattle.status === 'upcoming' && (
                                    <div style={{ backgroundColor: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <div style={{ backgroundColor: 'rgba(96,165,250,0.1)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Clock size={16} color="#60A5FA" />
                                            <span style={{ fontWeight: 700, color: '#93C5FD', fontSize: '15px' }}>Coming soon</span>
                                            {currentBattle.submissionStart && (
                                                <span style={{ fontSize: '12px', color: colors.textSecondary, marginLeft: '4px' }}>
                                                    — submissions open {formatDate(currentBattle.submissionStart)}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ padding: '14px 20px' }}>
                                            <p style={{ margin: '0 0 10px', fontSize: '13px', color: colors.textSecondary }}>
                                                Stay tuned in the Discord server for the announcement.
                                            </p>
                                            {currentBattle.discordInviteUrl && (
                                                <a href={currentBattle.discordInviteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#60A5FA', textDecoration: 'none', backgroundColor: 'rgba(96,165,250,0.1)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(96,165,250,0.25)' }}>
                                                    <MessageSquare size={13} /> Join Discord <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── ENTRIES / VOTING ── */}
                            {(currentBattle.status === 'voting' || currentBattle.status === 'active') && currentBattle.entries && currentBattle.entries.length > 0 && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? '20px 16px' : '24px 32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Vote size={18} color={colors.primary} />
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: colors.textPrimary }}>
                                                {currentBattle.status === 'voting' ? 'Vote for your favourite' : 'Submissions'}
                                            </span>
                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{currentBattle.entries.length} entries</span>
                                        </div>
                                        {currentBattle.status === 'voting' && !user && (
                                            <a href="/api/auth/discord/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.primary, textDecoration: 'none', backgroundColor: `${colors.primary}15`, padding: '6px 12px', borderRadius: '6px', border: `1px solid ${colors.primary}30` }}>
                                                <LogIn size={13} /> Log in to vote
                                            </a>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                                        {currentBattle.entries.map((entry, i) => {
                                            const isWinner = entry.id === currentBattle.winnerEntryId;
                                            const hasVoted = votedIds.has(entry.id);
                                            const isVoting = votingId === entry.id;

                                            return (
                                                <div key={entry.id} style={{
                                                    backgroundColor: i < 3 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)',
                                                    border: i === 0 ? `1px solid ${colors.primary}40` : '1px solid rgba(255,255,255,0.06)',
                                                    borderRadius: '10px',
                                                    padding: '16px',
                                                    position: 'relative',
                                                }}>
                                                    {/* Rank badge */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                        <span style={{ fontSize: '18px' }}>{placeEmoji(i)}</span>
                                                        <span style={{ fontSize: '18px', fontWeight: 800, color: colors.primary }}>🔥 {entry.voteCount}</span>
                                                    </div>

                                                    <p style={{ margin: '0 0 2px', fontWeight: 700, color: colors.textPrimary, fontSize: '14px', lineHeight: '1.3' }}>{entry.trackTitle}</p>
                                                    <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '12px' }}>by {entry.username}</p>

                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {entry.audioUrl && (
                                                            <Link
                                                                to={`/battles/entry/${entry.id}`}
                                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: colors.textSecondary, fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}
                                                            >
                                                                <Play size={13} fill="currentColor" /> Play
                                                            </Link>
                                                        )}
                                                        {currentBattle.status === 'voting' && (
                                                            <button
                                                                onClick={() => vote(entry.id)}
                                                                disabled={isVoting || hasVoted}
                                                                style={{
                                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                                    padding: '8px', borderRadius: '6px', border: 'none', cursor: hasVoted ? 'default' : 'pointer',
                                                                    backgroundColor: hasVoted ? `${colors.primary}30` : colors.primary,
                                                                    color: hasVoted ? colors.primary : '#fff',
                                                                    fontSize: '12px', fontWeight: 700,
                                                                    opacity: isVoting ? 0.6 : 1,
                                                                }}
                                                            >
                                                                <Flame size={13} /> {hasVoted ? 'Voted' : isVoting ? '...' : 'Vote'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    !loading && (
                        <div style={{ ...card, padding: '60px 40px', textAlign: 'center', marginBottom: '48px' }}>
                            <Swords size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <p style={{ color: colors.textSecondary, fontSize: '16px', margin: 0 }}>No active battle right now.</p>
                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: '8px 0 0', opacity: 0.6 }}>Check back soon — battles are announced in Discord.</p>
                        </div>
                    )
                )}

                {/* ── PAST BATTLES ── */}
                {pastBattles.length > 0 && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <Trophy size={18} color="#FFD700" />
                            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textPrimary }}>Past Battles</span>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{pastBattles.length} completed</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {pastBattles.map(b => {
                                const fullBattle = battles.find(x => x.id === b.id) || b;
                                const isExpanded = expandedArchive === b.id;

                                return (
                                    <div key={b.id} style={{ ...card, overflow: 'hidden' }}>
                                        <button
                                            onClick={() => setExpandedArchive(isExpanded ? null : b.id)}
                                            style={{
                                                width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: isMobile ? '16px' : '18px 24px',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                                                <Trophy size={20} color="#FFD700" style={{ flexShrink: 0 }} />
                                                <div style={{ minWidth: 0, textAlign: 'left' }}>
                                                    <p style={{ margin: 0, fontWeight: 700, color: colors.textPrimary, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</p>
                                                    {b.votingEnd && (
                                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>{formatDate(b.votingEnd)}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '12px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <Users size={12} /> {b._count?.entries || 0}
                                                </span>
                                                {b.sponsor && (
                                                    <span style={{ fontSize: '12px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <Building2 size={12} /> {b.sponsor.name}
                                                    </span>
                                                )}
                                                {isExpanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
                                            </div>
                                        </button>

                                        {/* Expanded archive detail — triggers full fetch */}
                                        {isExpanded && <ExpandedBattle battleId={b.id} />}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </DiscoveryLayout>
    );
};

// Lazy-fetch expanded battle detail
const ExpandedBattle: React.FC<{ battleId: string }> = ({ battleId }) => {
    const [battle, setBattle] = useState<Battle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/api/beat-battle/battles/${battleId}`);
                if (res.ok) setBattle(await res.json());
            } catch {} finally { setLoading(false); }
        })();
    }, [battleId]);

    if (loading) return <div style={{ padding: '16px 24px', color: colors.textSecondary, fontSize: '13px' }}>Loading...</div>;
    if (!battle) return null;

    const winner = battle.entries?.find(e => e.id === battle.winnerEntryId) || battle.entries?.[0];
    const top3 = battle.entries?.slice(0, 3) || [];

    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px 20px' }}>
            {battle.description && (
                <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '13px', lineHeight: '1.6' }}>{battle.description}</p>
            )}

            {/* Prizes */}
            {battle.prizes && battle.prizes.length > 0 && (
                <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {battle.prizes.map((p, i) => (
                        <span key={i} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary }}>
                            {placeEmoji(i)} <strong style={{ color: placeColor(i) }}>{p.place}</strong>{p.description ? ` — ${p.description}` : ''}
                        </span>
                    ))}
                </div>
            )}

            {/* Top 3 entries */}
            {top3.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.textSecondary }}>Top Entries</p>
                    {top3.map((entry, i) => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: i === 0 ? 'rgba(255,215,0,0.06)' : 'rgba(0,0,0,0.2)', borderRadius: '8px', border: i === 0 ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '16px' }}>{placeEmoji(i)}</span>
                                <div>
                                    <p style={{ margin: 0, fontWeight: 700, color: colors.textPrimary, fontSize: '13px' }}>{entry.trackTitle}</p>
                                    <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '11px' }}>by {entry.username}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 700, color: colors.primary, fontSize: '13px' }}>🔥 {entry.voteCount}</span>
                                {entry.audioUrl && (
                                    <Link to={`/battles/entry/${entry.id}`} style={{ color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '12px' }}>
                                        <Play size={12} /> Play
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
