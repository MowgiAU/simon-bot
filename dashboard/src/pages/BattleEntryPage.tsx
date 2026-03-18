import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { FujiLogo } from '../components/FujiLogo';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
    Play, Pause, ArrowLeft, Swords, Music, User, Calendar, Vote, LogIn,
    Share2, Download, Info, Zap, Tag, Clock, FileAudio, List, X, Layers
} from 'lucide-react';
import { ArrangementViewer, ProjectInfoPanel } from '../components/ArrangementViewer';

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

    const isPlaying = player.currentTrack?.id === entry?.id && player.isPlaying;

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
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px' : spacing.xl }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl, flexWrap: 'wrap', gap: '8px' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '400px 1fr', gap: isMobile ? '24px' : '40px' }}>
                    {/* Left: Artwork + Stats */}
                    <div style={isMobile ? { display: 'flex', gap: '16px', alignItems: 'flex-start' } : {}}>
                        <div style={{ aspectRatio: '1/1', borderRadius: borderRadius.lg, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', width: isMobile ? '120px' : '100%', flexShrink: 0 }}>
                            {resolvedCover ? (
                                <img src={resolvedCover} alt={entry.trackTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                                    <FujiLogo size={isMobile ? 120 : 160} color={colors.primary} opacity={0.2} />
                                </div>
                            )}
                            <button onClick={handlePlay}
                                style={{ position: 'absolute', bottom: '20px', right: '20px', width: isMobile ? '56px' : '64px', height: isMobile ? '56px' : '64px', borderRadius: '50%', backgroundColor: colors.primary, color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 4px 20px ${colors.primary}44`, transition: 'transform 0.2s ease' }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {isPlaying ? <Pause size={isMobile ? 24 : 32} fill="white" /> : <Play size={isMobile ? 24 : 32} fill="white" style={{ marginLeft: '4px' }} />}
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: isMobile ? 0 : spacing.xl, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.05)', flex: isMobile ? 1 : undefined }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Votes</div>
                                <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>{entry.voteCount}</div>
                            </div>
                            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Duration</div>
                                <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>{formatDuration(duration)}</div>
                            </div>
                            {t && (
                                <>
                                    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                                    <div style={{ textAlign: 'center', flex: 1 }}>
                                        <div style={{ color: colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Plays</div>
                                        <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>{t.playCount.toLocaleString()}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Info & Metadata */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                        <div>
                            <h1 style={{ fontSize: isMobile ? '2rem' : '3rem', margin: '0 0 8px 0', lineHeight: 1.1 }}>{entry.trackTitle}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '1.1rem' : '1.25rem', color: colors.textSecondary }}>
                                by {artistUsername ? (
                                    <a href={`/profile/${artistUsername}`} style={{ color: colors.primary, textDecoration: 'none' }}>{artistName}</a>
                                ) : (
                                    <span style={{ color: colors.textPrimary }}>{artistName}</span>
                                )}
                            </div>
                        </div>

                        {description && (
                            <div style={{ padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, borderLeft: `4px solid ${colors.primary}` }}>
                                <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: isMobile ? '0.9rem' : '1rem' }}>{description}</p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: spacing.md }}>
                            {t?.artist && <InfoItem icon={<Info size={16}/>} label="Artist" value={t.artist} />}
                            {t?.album && <InfoItem icon={<Music size={16}/>} label="Album" value={t.album} />}
                            {t?.year && <InfoItem icon={<Calendar size={16}/>} label="Year" value={t.year.toString()} />}
                            {t?.bpm && <InfoItem icon={<Zap size={16}/>} label="BPM" value={t.bpm.toString()} />}
                            {t?.key && <InfoItem icon={<Tag size={16}/>} label="Key" value={t.key} />}
                            <InfoItem icon={<Clock size={16}/>} label="Submitted" value={new Date(entry.createdAt).toLocaleDateString()} />
                        </div>

                        {t?.genres && t.genres.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {t.genres.map(g => (
                                        <span key={g.genre.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {g.genre.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 'auto', display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
                            {entry.battle.status === 'voting' && (
                                user ? (
                                    entry.userId !== user.id && (
                                        <button onClick={handleVote} disabled={voting}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: voted ? 'rgba(251,191,36,0.15)' : colors.primary, color: voted ? '#FBBF24' : 'white', border: voted ? '1px solid rgba(251,191,36,0.3)' : 'none', padding: '10px 20px', borderRadius: borderRadius.md, cursor: voting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: voting ? 0.6 : 1 }}>
                                            <Vote size={18} /> {voted ? 'Voted ✓' : 'Vote'}
                                        </button>
                                    )
                                ) : (
                                    <a href="/api/auth/discord/login" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#5865F2', color: 'white', padding: '10px 20px', borderRadius: borderRadius.md, textDecoration: 'none', fontWeight: 600 }}>
                                        <LogIn size={18} /> Log in to Vote
                                    </a>
                                )
                            )}
                            {t?.allowAudioDownload && (
                                <button onClick={() => window.open(t.url, '_blank')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}>
                                    <Download size={18} /> Download Audio
                                </button>
                            )}
                            {t?.projectFileUrl && (t.allowProjectDownload ?? true) && (
                                <>
                                    <button onClick={() => setFlpConfirmOpen(true)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}>
                                        <Download size={18} /> Download .flp
                                    </button>
                                    <ConfirmModal open={flpConfirmOpen} title="Project File Download"
                                        message={`This project file is for educational display. It does not include the audio samples or VSTs used by the artist.\n\nContinue with download?`}
                                        confirmLabel="Download"
                                        onConfirm={() => { setFlpConfirmOpen(false); window.open(t.projectFileUrl!, '_blank'); }}
                                        onCancel={() => setFlpConfirmOpen(false)} />
                                </>
                            )}
                            {t?.projectZipUrl && (t.allowProjectDownload ?? true) && (
                                <a href={`/api/tracks/${t.id}/download-zip`} download
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
                                    <Download size={18} /> Download Loop ZIP
                                </a>
                            )}
                            <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied to clipboard!', 'success'); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}>
                                <Share2 size={18} /> Share
                            </button>
                            {t && artistUsername && t.slug && (
                                <Link to={`/profile/${artistUsername}/${t.slug}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.primary, border: `1px solid ${colors.primary}33`, padding: '10px 20px', borderRadius: borderRadius.md, textDecoration: 'none', fontWeight: 600 }}>
                                    <Music size={18} /> View Full Track
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* FLP Arrangement Viewer — direct upload */}
                {!t && (entry.arrangement as any)?.tracks?.some((tr: any) => tr.clips.length > 0) && (
                    <ArrangementViewer
                        arrangement={entry.arrangement as any}
                        duration={duration}
                        currentTime={player.currentTrack?.id === entry.id ? (player as any).currentTime ?? 0 : 0}
                        isPlaying={isPlaying}
                        projectFileUrl={entry.projectUrl ? (entry.projectUrl.startsWith('http') ? entry.projectUrl : `${API}${entry.projectUrl}`) : null}
                        zoom={zoom}
                        setZoom={setZoom}
                    />
                )}

                {/* FLP Arrangement Viewer — library track */}
                {t && (t.arrangement as any)?.tracks?.some((tr: any) => tr.clips.length > 0) && (
                    <ArrangementViewer
                        arrangement={t.arrangement as any}
                        duration={duration}
                        currentTime={player.currentTrack?.id === entry.id ? (player as any).currentTime ?? 0 : 0}
                        isPlaying={isPlaying}
                        projectFileUrl={t.projectFileUrl || null}
                        projectZipUrl={t.projectZipUrl}
                        trackId={t.id}
                        zoom={zoom}
                        setZoom={setZoom}
                    />
                )}

                {/* Project Info Panel — direct upload */}
                {!t && (entry.arrangement as any)?.projectInfo &&
                    ((entry.arrangement as any).projectInfo.plugins?.length > 0 || (entry.arrangement as any).projectInfo.samples?.length > 0) && (
                    <ProjectInfoPanel projectInfo={(entry.arrangement as any).projectInfo} />
                )}

                {/* Project Info Panel — library track */}
                {t?.arrangement?.projectInfo &&
                    (t.arrangement.projectInfo.plugins?.length > 0 || t.arrangement.projectInfo.samples?.length > 0) && (
                    <ProjectInfoPanel projectInfo={t.arrangement.projectInfo} />
                )}

                {/* Project Details */}
                {(entry.bpm || entry.key || entry.artist || entry.projectUrl) && !t && (
                    <div style={{ marginTop: spacing.xl, padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: spacing.md }}>
                            <FileAudio size={18} color={colors.primary} />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Project Details</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md, marginBottom: entry.projectUrl ? spacing.md : 0 }}>
                            {entry.artist && <InfoItem icon={<User size={16}/>} label="Artist" value={entry.artist} />}
                            {entry.bpm && <InfoItem icon={<Zap size={16}/>} label="BPM" value={entry.bpm.toString()} />}
                            {entry.key && <InfoItem icon={<Tag size={16}/>} label="Key" value={entry.key} />}
                        </div>
                        {entry.projectUrl && (
                            <a href={entry.projectUrl.startsWith('http') ? entry.projectUrl : `${API}${entry.projectUrl}`} download
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
                                <Download size={18} /> Download Project File
                            </a>
                        )}
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
