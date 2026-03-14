import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import {
    Play, Pause, ArrowLeft, Swords, Flame, Music, User, Calendar, Trophy, Vote, LogIn
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

interface EntryData {
    id: string;
    userId: string;
    username: string;
    trackTitle: string;
    audioUrl: string;
    coverUrl: string | null;
    duration: number | null;
    voteCount: number;
    source: string;
    createdAt: string;
    battle: {
        id: string;
        title: string;
        status: string;
        description: string | null;
        guildId: string;
    };
}

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    upcoming:  { label: 'UPCOMING',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
    active:    { label: 'OPEN',      color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
    voting:    { label: 'VOTING',    color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
    completed: { label: 'ENDED',     color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

export const BattleEntryPage: React.FC = () => {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { player, setTrack, togglePlay } = usePlayer();
    const [entry, setEntry] = useState<EntryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [voted, setVoted] = useState(false);
    const [voting, setVoting] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const entryId = pathname.split('/').pop();

    useEffect(() => {
        if (!entryId) return;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API}/api/beat-battle/entries/${entryId}`);
                if (!res.ok) { setError('Entry not found'); return; }
                setEntry(await res.json());
            } catch {
                setError('Failed to load entry');
            } finally {
                setLoading(false);
            }
        })();
    }, [entryId]);

    useEffect(() => {
        if (entry) {
            document.title = `${entry.trackTitle} by ${entry.username} | Beat Battle | Fuji Studio`;
        }
    }, [entry]);

    const isPlaying = player.currentTrack?.id === entry?.id && player.isPlaying;

    const handlePlay = () => {
        if (!entry) return;
        if (player.currentTrack?.id === entry.id) {
            togglePlay();
        } else {
            setTrack({
                id: entry.id,
                title: entry.trackTitle,
                artist: entry.username,
                username: entry.username,
                slug: '',
                cover: entry.coverUrl ? `${API}${entry.coverUrl}` : '',
                url: `${API}${entry.audioUrl}`,
            });
        }
    };

    const handleVote = async () => {
        if (!user || !entry) {
            window.location.href = '/api/auth/discord/login';
            return;
        }
        setVoting(true);
        try {
            const res = await fetch(`${API}/api/beat-battle/entries/${entry.id}/vote`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok || res.status === 409) {
                setVoted(true);
                // Refresh entry data
                const updated = await fetch(`${API}/api/beat-battle/entries/${entry.id}`);
                if (updated.ok) setEntry(await updated.json());
            }
        } catch {} finally {
            setVoting(false);
        }
    };

    if (loading) {
        return (
            <DiscoveryLayout activeTab="battles">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: colors.textSecondary }}>
                    Loading...
                </div>
            </DiscoveryLayout>
        );
    }

    if (error || !entry) {
        return (
            <DiscoveryLayout activeTab="battles">
                <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
                    <Music size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h2 style={{ color: colors.textPrimary, margin: '0 0 8px' }}>{error || 'Entry not found'}</h2>
                    <Link to="/battles" style={{ color: colors.primary, textDecoration: 'none', fontSize: '14px' }}>
                        Back to Battles
                    </Link>
                </div>
            </DiscoveryLayout>
        );
    }

    const st = statusLabel[entry.battle.status];

    return (
        <DiscoveryLayout activeTab="battles">
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>

                {/* Back link */}
                <Link to="/battles" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: colors.textSecondary, textDecoration: 'none', fontSize: '13px', marginBottom: '20px' }}>
                    <ArrowLeft size={14} /> Back to Battles
                </Link>

                {/* Battle context */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <Swords size={16} color={colors.primary} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>{entry.battle.title}</span>
                    {st && (
                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '3px 8px', borderRadius: '5px', color: st.color, backgroundColor: st.bg }}>
                            {st.label}
                        </span>
                    )}
                </div>

                {/* Main card */}
                <div style={{
                    backgroundColor: '#242C3D',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: borderRadius.lg,
                    overflow: 'hidden',
                }}>
                    {/* Cover / accent */}
                    {entry.coverUrl ? (
                        <div style={{ height: '200px', overflow: 'hidden', position: 'relative' }}>
                            <img src={`${API}${entry.coverUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #242C3D 0%, transparent 60%)' }} />
                        </div>
                    ) : (
                        <div style={{ height: '4px', background: `linear-gradient(90deg, ${colors.primary}, #60A5FA)` }} />
                    )}

                    <div style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
                        {/* Title */}
                        <h1 style={{ margin: '0 0 6px', fontSize: isMobile ? '22px' : '28px', fontWeight: 800, color: colors.textPrimary }}>
                            {entry.trackTitle}
                        </h1>

                        {/* Artist + date */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: colors.textSecondary }}>
                                <User size={14} /> {entry.username}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.textSecondary }}>
                                <Calendar size={13} /> {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>

                        {/* Play + Vote row */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            <button
                                onClick={handlePlay}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                    backgroundColor: colors.primary, color: '#fff',
                                    fontSize: '15px', fontWeight: 700,
                                    transition: 'transform 0.15s',
                                }}
                                onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                                onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                {isPlaying ? <Pause size={18} /> : <Play size={18} fill="#fff" />}
                                {isPlaying ? 'Pause' : 'Play'}
                            </button>

                            {entry.battle.status === 'voting' && (
                                user ? (
                                    <button
                                        onClick={handleVote}
                                        disabled={voting || voted}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: voted ? 'default' : 'pointer',
                                            backgroundColor: voted ? `${colors.primary}30` : 'rgba(255,255,255,0.08)',
                                            color: voted ? colors.primary : colors.textPrimary,
                                            fontSize: '15px', fontWeight: 700,
                                            opacity: voting ? 0.6 : 1,
                                        }}
                                    >
                                        <Flame size={16} /> {voted ? 'Voted!' : voting ? '...' : 'Vote'}
                                    </button>
                                ) : (
                                    <a
                                        href="/api/auth/discord/login"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            padding: '12px 28px', borderRadius: '10px', textDecoration: 'none',
                                            backgroundColor: 'rgba(255,255,255,0.08)', color: colors.textSecondary,
                                            fontSize: '14px', fontWeight: 600,
                                        }}
                                    >
                                        <LogIn size={14} /> Log in to vote
                                    </a>
                                )
                            )}
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '24px', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Flame size={16} color={colors.primary} />
                                <div>
                                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: colors.textPrimary }}>{entry.voteCount}</p>
                                    <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>Votes</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trophy size={16} color="#FFD700" />
                                <div>
                                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: colors.textPrimary }}>{entry.source === 'discord' ? 'Discord' : 'Web'}</p>
                                    <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>Submitted via</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* View all entries link */}
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Link to="/battles" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: colors.primary, textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                        <Vote size={15} /> View all entries & vote
                    </Link>
                </div>
            </div>
        </DiscoveryLayout>
    );
};
