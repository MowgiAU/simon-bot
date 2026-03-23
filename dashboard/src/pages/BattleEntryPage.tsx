import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { FujiLogo } from '../components/FujiLogo';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
    Play, Pause, ArrowLeft, Swords, Music, Calendar, Activity, LogIn,
    Share2, Download, Zap, Tag, Clock, FileAudio, List, Layers, Package,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { ArrangementViewer } from '../components/ArrangementViewer';

const API = import.meta.env.VITE_API_URL || '';

interface EntryData {
    id: string;
    userId: string;
    username: string;
    trackTitle: string;
    audioUrl: string;
    coverUrl: string | null;
    avatarUrl: string | null;
    description: string | null;
    projectUrl: string | null;
    duration: number | null;
    voteCount: number;
    bpm: number | null;
    key: string | null;
    artist: string | null;
    trackId: string | null;
    source: string;
    arrangement?: any;
    createdAt: string;
    battle: {
        id: string;
        title: string;
        status: string;
        description: string | null;
        guildId: string;
    };
    track?: {
        id: string;
        title: string;
        slug: string | null;
        url: string;
        coverUrl: string | null;
        description: string | null;
        artist: string | null;
        album: string | null;
        year: number | null;
        bpm: number | null;
        key: string | null;
        duration: number;
        playCount: number;
        allowAudioDownload: boolean;
        allowProjectDownload: boolean;
        projectFileUrl: string | null;
        projectZipUrl: string | null;
        arrangement: any;
        createdAt: string;
        profile: { id: string; username: string; displayName: string | null; userId: string; avatar: string | null };
        genres: Array<{ genre: { id: string; name: string } }>;
    } | null;
}

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    upcoming:  { label: 'UPCOMING',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
    active:    { label: 'OPEN',      color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
    voting:    { label: 'VOTING',    color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
    completed: { label: 'ENDED',     color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ color: colors.primary }}>{icon}</div>
        <div>
            <div style={{ fontSize: '0.7rem', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</div>
        </div>
    </div>
);

export const BattleEntryPage: React.FC = () => {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { player, setTrack, togglePlay } = usePlayer();
    const [entry, setEntry] = useState<EntryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [voted, setVoted] = useState(false);
    const [voting, setVoting] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [flpConfirmOpen, setFlpConfirmOpen] = useState(false);
    const [battleEntries, setBattleEntries] = useState<any[]>([]);
    const [zoom, setZoom] = useState(1);
    const [expandedSamples, setExpandedSamples] = useState(false);
    const currentTimeRef = useRef(0);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 1024);
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

    useEffect(() => {
        if (!entry?.battle.id) return;
        fetch(`${API}/api/beat-battle/battles/${entry.battle.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.entries) setBattleEntries(data.entries.sort((a: any, b: any) => b.voteCount - a.voteCount)); })
            .catch(() => {});
    }, [entry?.battle.id]);

    const t = entry?.track;
    const coverUrl = t?.coverUrl || entry?.coverUrl;
    const resolvedCover = coverUrl ? (coverUrl.startsWith('http') ? coverUrl : `${API}${coverUrl}`) : null;
    const audioUrl = entry ? (entry.audioUrl.startsWith('http') ? entry.audioUrl : `${API}${entry.audioUrl}`) : '';
    const artistName = t?.profile?.displayName || t?.profile?.username || entry?.username || 'Unknown';
    const artistUsername = t?.profile?.username;
    const description = t?.description || entry?.description;
    const duration = t?.duration || entry?.duration || 0;

    const arrangement = t?.arrangement ?? entry?.arrangement;
    const hasArrangement = arrangement && (
        arrangement.tracks?.some((tr: any) => tr.clips.length > 0) || arrangement.projectInfo
    );
    const projectFileUrl = t?.projectFileUrl ?? (entry?.projectUrl ? (entry.projectUrl.startsWith('http') ? entry.projectUrl : `${API}${entry.projectUrl}`) : null);
    const projectZipUrl = t?.projectZipUrl ?? null;
    const allowProjectDownload = t ? (t.allowProjectDownload ?? true) : true;
    const allowAudioDownload = t ? t.allowAudioDownload : false;
    const downloadAudioUrl = t ? t.url : audioUrl;

    const isPlaying = player.currentTrack?.id === entry?.id && player.isPlaying;
    // Update refs silently for ArrangementViewer — no child re-renders
    currentTimeRef.current = player.currentTrack?.id === entry?.id ? (player as any).currentTime ?? 0 : 0;
    isPlayingRef.current = isPlaying;

    const handlePlay = () => {
        if (!entry) return;
        if (player.currentTrack?.id === entry.id) {
            togglePlay();
        } else {
            setTrack({
                id: entry.id,
                title: entry.trackTitle,
                artist: artistName,
                username: artistUsername || entry.username,
                slug: '',
                cover: resolvedCover || entry.avatarUrl || '',
                url: audioUrl,
                entryRoute: `/battles/entry/${entry.id}`,
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
            if (res.ok) {
                const data = await res.json();
                setVoted(data.voted);
                const updated = await fetch(`${API}/api/beat-battle/entries/${entry.id}`);
                if (updated.ok) setEntry(await updated.json());
            }
        } catch {} finally {
            setVoting(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '16px' : spacing.xl }}>

                {/* ═══ HERO SECTION ═══ */}
                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
                    {resolvedCover && (
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${resolvedCover})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(40px) brightness(0.3)', transform: 'scale(1.2)' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(14,18,26,0.92) 0%, rgba(14,18,26,0.75) 100%)' }} />

                    <div style={{ position: 'relative', padding: isMobile ? '20px' : '40px' }}>
                        {/* Battle breadcrumb */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
                            <Link to="/battles" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSecondary, textDecoration: 'none', fontSize: '13px' }}>
                                <ArrowLeft size={14} /> Back to Battles
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Swords size={14} color={colors.primary} />
                                <Link to={`/battles/${entry.battle.id}`} style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, textDecoration: 'none' }}>{entry.battle.title}</Link>
                                {st && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '3px 8px', borderRadius: '5px', color: st.color, backgroundColor: st.bg }}>
                                        {st.label}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Cover + info row */}
                        <div style={{ display: 'flex', gap: isMobile ? '16px' : '32px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-start' }}>
                            {/* Cover art */}
                            <div style={{
                                width: isMobile ? '200px' : '280px', height: isMobile ? '200px' : '280px',
                                borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
                                position: 'relative', cursor: 'pointer',
                            }} onClick={handlePlay}>
                                {resolvedCover ? (
                                    <img src={resolvedCover} alt={entry.trackTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                                        <FujiLogo size={isMobile ? 80 : 120} color={colors.primary} opacity={0.2} />
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    backgroundColor: isPlaying ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: isPlaying ? 1 : 0, transition: 'opacity 0.2s',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.opacity = '0'; }}
                                >
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 24px ${colors.primary}66` }}>
                                        {isPlaying ? <Pause size={28} fill="white" color="white" /> : <Play size={28} fill="white" color="white" style={{ marginLeft: '3px' }} />}
                                    </div>
                                </div>
                            </div>

                            {/* Track info panel */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', textAlign: isMobile ? 'center' : 'left' }}>
                                <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.8rem', margin: '0 0 8px', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
                                    {entry.trackTitle}
                                </h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', color: colors.textSecondary, marginBottom: '16px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    by {artistUsername ? (
                                        <a href={`/profile/${artistUsername}`} style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>{artistName}</a>
                                    ) : (
                                        <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{artistName}</span>
                                    )}
                                </div>

                                {/* Quick metadata badges */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    {(t?.bpm || entry.bpm) && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(242,123,19,0.15)', border: '1px solid rgba(242,123,19,0.3)', fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                                            <Activity size={13} /> {t?.bpm ?? entry.bpm} BPM
                                        </span>
                                    )}
                                    {(t?.key || entry.key) && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', fontSize: '13px', fontWeight: 600, color: '#A78BFA' }}>
                                            <Tag size={13} /> {t?.key ?? entry.key}
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: colors.textSecondary }}>
                                        <Clock size={13} /> {formatDuration(duration)}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: colors.textSecondary }}>
                                        <Calendar size={13} /> {new Date(entry.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Genre tags */}
                                {t?.genres && t.genres.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                        {t.genres.map(g => (
                                            <span key={g.genre.id} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textSecondary, padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                {g.genre.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Stats row */}
                                <div style={{ display: 'flex', gap: isMobile ? '16px' : '24px', marginBottom: '20px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.textSecondary }}>
                                        <span>🔥</span>
                                        <span style={{ fontWeight: 700, color: colors.textPrimary }}>{entry.voteCount}</span> votes
                                    </div>
                                    {t && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.textSecondary }}>
                                            <Play size={14} fill={colors.textSecondary} color={colors.textSecondary} />
                                            <span style={{ fontWeight: 700, color: colors.textPrimary }}>{t.playCount.toLocaleString()}</span> plays
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    <button onClick={handlePlay}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: `0 4px 16px ${colors.primary}44` }}>
                                        {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />} {isPlaying ? 'Pause' : 'Play'}
                                    </button>

                                    {entry.battle.status === 'voting' && (
                                        user ? (
                                            entry.userId !== user.id ? (
                                                <button onClick={handleVote} disabled={voting}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: voted ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)', color: voted ? '#FBBF24' : 'white', border: voted ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: '8px', cursor: voting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px', opacity: voting ? 0.6 : 1 }}>
                                                    🔥 {voted ? 'Voted ✓' : 'Vote'}
                                                </button>
                                            ) : null
                                        ) : (
                                            <a href="/api/auth/discord/login"
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#5865F2', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                                                <LogIn size={16} /> Log in to Vote
                                            </a>
                                        )
                                    )}

                                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied!', 'success'); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                        <Share2 size={15} /> Share
                                    </button>

                                    {t && artistUsername && t.slug && (
                                        <Link to={`/profile/${artistUsername}/${t.slug}`}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: `1px solid ${colors.primary}44`, backgroundColor: `${colors.primary}11`, color: colors.primary, textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>
                                            <Music size={15} /> View Full Track
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description */}
                {description && (
                    <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `4px solid ${colors.primary}`, marginBottom: '24px' }}>
                        <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{description}</p>
                    </div>
                )}

                {/* ═══ FL STUDIO PROJECT SECTION ═══ */}
                {hasArrangement && (
                    <div style={{
                        marginBottom: '24px', borderRadius: '16px', overflow: 'hidden',
                        border: '1px solid rgba(242,123,19,0.2)',
                        background: 'linear-gradient(135deg, rgba(242,123,19,0.06) 0%, rgba(14,18,26,0.95) 50%, rgba(124,58,237,0.04) 100%)',
                    }}>
                        {/* Section header */}
                        <div style={{
                            padding: isMobile ? '16px 20px' : '20px 28px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px',
                                    background: `linear-gradient(135deg, ${colors.primary}, #E65100)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 4px 16px ${colors.primary}44`,
                                }}>
                                    <Layers size={20} color="white" />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>FL Studio Project</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>
                                        {arrangement!.bpm && `${arrangement!.bpm} BPM`}
                                        {arrangement!.bpm && arrangement!.tracks?.length > 0 && ' · '}
                                        {arrangement!.tracks?.filter((tr: any) => tr.clips.length > 0).length > 0 && `${arrangement!.tracks.filter((tr: any) => tr.clips.length > 0).length} tracks`}
                                        {arrangement!.projectInfo?.plugins?.length > 0 && ` · ${arrangement!.projectInfo.plugins.length} plugins`}
                                    </p>
                                </div>
                            </div>

                            {/* Download buttons */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {projectFileUrl && allowProjectDownload && (
                                    <>
                                        <button
                                            onClick={() => setFlpConfirmOpen(true)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${colors.primary}44`, backgroundColor: `${colors.primary}15`, color: colors.primary, cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                                            <Download size={14} /> .flp
                                        </button>
                                        <ConfirmModal
                                            open={flpConfirmOpen}
                                            title="Project File Download"
                                            message={`This project file is for educational display. It does not include the audio samples or VSTs used by the artist. Some files may appear missing upon opening.\n\nContinue with download?`}
                                            confirmLabel="Download"
                                            onConfirm={() => { setFlpConfirmOpen(false); window.open(projectFileUrl, '_blank'); }}
                                            onCancel={() => setFlpConfirmOpen(false)}
                                        />
                                    </>
                                )}
                                {projectZipUrl && allowProjectDownload && (
                                    <a href={projectZipUrl.startsWith('http') ? projectZipUrl : `/api/tracks/${t!.id}/download-zip`}
                                        download={`${entry.trackTitle || 'project'}_loop_package.zip`}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '12px', textDecoration: 'none' }}>
                                        <Package size={14} /> Download Project
                                    </a>
                                )}
                                {allowAudioDownload && (
                                    <button onClick={() => window.open(downloadAudioUrl, '_blank')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                                        <Download size={14} /> Audio
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Plugins & Samples */}
                        {arrangement!.projectInfo && (arrangement!.projectInfo.plugins?.length > 0 || arrangement!.projectInfo.samples?.length > 0) && (
                            <div style={{ padding: isMobile ? '16px 20px' : '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (arrangement!.projectInfo.plugins?.length > 0 && arrangement!.projectInfo.samples?.length > 0 ? '1fr 1fr' : '1fr'), gap: '20px' }}>
                                    {/* Plugins */}
                                    {arrangement!.projectInfo.plugins?.length > 0 && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <Zap size={15} color={colors.primary} />
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Plugins ({arrangement!.projectInfo.plugins.length})
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {arrangement!.projectInfo.plugins.map((plugin: string, i: number) => (
                                                    <span key={i} style={{
                                                        padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                                                        backgroundColor: 'rgba(242,123,19,0.08)', border: '1px solid rgba(242,123,19,0.15)',
                                                        color: '#F0A060',
                                                    }}>{plugin}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Samples */}
                                    {arrangement!.projectInfo.samples?.length > 0 && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <FileAudio size={15} color="#A78BFA" />
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Samples ({arrangement!.projectInfo.samples.length})
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(expandedSamples ? arrangement!.projectInfo.samples : arrangement!.projectInfo.samples.slice(0, 12)).map((sample: string, i: number) => (
                                                    <span key={i} style={{
                                                        padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                                                        backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)',
                                                        color: '#C4A8FF', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>{sample}</span>
                                                ))}
                                            </div>
                                            {arrangement!.projectInfo.samples.length > 12 && (
                                                <button onClick={() => setExpandedSamples(!expandedSamples)}
                                                    style={{ marginTop: '8px', background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                    {expandedSamples ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {arrangement!.projectInfo.samples.length} samples</>}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Arrangement timeline */}
                        {arrangement!.tracks?.some((tr: any) => tr.clips.length > 0) && (
                            <div style={{ padding: isMobile ? '16px 20px' : '20px 28px' }}>
                                <ArrangementViewer
                                    arrangement={arrangement}
                                    duration={duration}
                                    currentTimeRef={currentTimeRef}
                                    isPlayingRef={isPlayingRef}
                                    projectFileUrl={projectFileUrl}
                                    projectZipUrl={projectZipUrl}
                                    trackId={t?.id}
                                    zoom={zoom}
                                    setZoom={setZoom}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Audio download fallback when no FL section but audio download allowed */}
                {!hasArrangement && allowAudioDownload && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                        <button onClick={() => window.open(downloadAudioUrl, '_blank')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                            <Download size={16} /> Download Audio
                        </button>
                    </div>
                )}

                {/* Battle Playlist */}
                {battleEntries.length > 1 && (
                    <div style={{ marginTop: spacing.xl }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: spacing.md }}>
                            <List size={18} color={colors.primary} />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Battle Playlist</h3>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>({battleEntries.length} entries)</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {battleEntries.map((e: any, i: number) => {
                                const isThisEntry = e.id === entry.id;
                                const trackId = `battle-playlist-${e.id}`;
                                const isPlaying = player.currentTrack?.id === trackId && player.isPlaying;
                                const coverSrc = e.coverUrl ? (e.coverUrl.startsWith('http') ? e.coverUrl : `${API}${e.coverUrl}`) : (e.avatarUrl ? (e.avatarUrl.startsWith('http') ? e.avatarUrl : `${API}${e.avatarUrl}`) : null);
                                return (
                                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: isThisEntry ? `${colors.primary}12` : 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: `1px solid ${isThisEntry ? colors.primary + '30' : 'rgba(255,255,255,0.06)'}` }}>
                                        <span style={{ fontSize: '12px', color: colors.textSecondary, width: '20px', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#1A1E2E', overflow: 'hidden', flexShrink: 0 }}>
                                            {coverSrc ? <img src={coverSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={colors.textSecondary} style={{ opacity: 0.3 }} /></div>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Link to={`/battles/entry/${e.id}`} style={{ fontWeight: 600, fontSize: '13px', color: isThisEntry ? colors.primary : colors.textPrimary, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.trackTitle}</Link>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary }}>{e.username}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, flexShrink: 0 }}>🔥 {e.voteCount}</div>
                                        {e.audioUrl && (
                                            <button onClick={() => {
                                                if (player.currentTrack?.id === trackId) { togglePlay(); return; }
                                                setTrack({ id: trackId, title: e.trackTitle, artist: e.username, cover: e.coverUrl || e.avatarUrl || '', url: e.audioUrl.startsWith('http') ? e.audioUrl : `${API}${e.audioUrl}`, entryRoute: `/battles/entry/${e.id}` });
                                            }} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isPlaying ? colors.primary : 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                                                {isPlaying ? <Pause size={13} fill="white" /> : <Play size={13} fill="white" style={{ marginLeft: '1px' }} />}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div style={{ height: player.currentTrack ? '100px' : '20px' }} />
            </div>
        </DiscoveryLayout>
    );
};