import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import axios from 'axios';
import { 
    Music, Play, Pause, Zap, Clock, Info, Tag, Calendar, 
    ArrowLeft, Share2, ExternalLink
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface ArrangementClip {
    id: number;
    name: string;
    start: number;
    length: number;
}

interface ArrangementTrack {
    id: number;
    name: string;
    clips: ArrangementClip[];
}

interface ArrangementData {
    bpm: number;
    tracks: ArrangementTrack[];
}

interface Track {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    description: string | null;
    playCount: number;
    duration: number;
    artist: string | null;
    album: string | null;
    year: number | null;
    bpm: number | null;
    key: string | null;
    createdAt: string;
    arrangement: ArrangementData | null;
    projectFileUrl: string | null;
    profile: {
        id: string;
        username: string;
        displayName: string | null;
        userId: string;
        avatar: string | null;
    };
    genres: Array<{
        genre: {
            id: string;
            name: string;
        }
    }>;
}

export const TrackPage: React.FC = () => {
    const { pathname } = useLocation();
    const [track, setTrackData] = useState<Track | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const { player, setTrack, togglePlay } = usePlayer();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchTrack = async () => {
            const parts = pathname.split('/').filter(Boolean);
            if (parts.length < 3) return;
            const username = parts[1];
            const trackSlug = parts[2];

            setLoading(true);
            try {
                const res = await axios.get(`/api/musician/tracks/${username}/${trackSlug}`, { withCredentials: true });
                setTrackData(res.data);
            } catch (err: any) {
                setError(err.response?.status === 404 ? 'Track not found' : 'Failed to load track');
            } finally {
                setLoading(false);
            }
        };
        fetchTrack();
    }, [pathname]);

    useEffect(() => {
        if (track) {
            document.title = `${track.title} by ${track.profile.displayName || track.profile.username} | Fuji Studio`;
        }
    }, [track]);

    if (loading) return (
        <DiscoveryLayout activeTab="discovery">
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>
                Loading track...
            </div>
        </DiscoveryLayout>
    );

    if (error || !track) return (
        <DiscoveryLayout activeTab="discovery">
            <div style={{ textAlign: 'center', padding: '100px' }}>
                <h2 style={{ color: '#ff4444' }}>{error || 'Track not found'}</h2>
                <div style={{ marginTop: spacing.xl }}>
                    <button onClick={() => window.history.back()} style={{ backgroundColor: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}`, padding: '8px 16px', borderRadius: borderRadius.md, cursor: 'pointer' }}>
                        ← Go Back
                    </button>
                </div>
            </div>
        </DiscoveryLayout>
    );

    const isPlaying = player.currentTrack?.id === track.id && player.isPlaying;
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <DiscoveryLayout activeTab="discovery">
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px' : spacing.xl }}>
                {/* Back Link */}
                <button 
                    onClick={() => window.location.href = `/profile/${track.profile.username}`}
                    style={{ background: 'none', border: 'none', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: spacing.xl, padding: 0 }}
                >
                    <ArrowLeft size={16} /> Back to {track.profile.displayName || track.profile.username}'s Profile
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '400px 1fr', gap: isMobile ? '24px' : '40px' }}>
                    {/* Left: Artwork & Main Action */}
                    <div>
                        <div style={{ 
                            aspectRatio: '1/1', 
                            borderRadius: borderRadius.lg, 
                            overflow: 'hidden', 
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            position: 'relative',
                            width: isMobile ? '100%' : 'auto'
                        }}>
                            {track.coverUrl ? (
                                <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                                    <Music size={isMobile ? 120 : 80} opacity={0.1} />
                                </div>
                            )}
                            
                            <button 
                                onClick={() => player.currentTrack?.id === track.id ? togglePlay() : setTrack(track, [track])}
                                style={{ 
                                    position: 'absolute', bottom: '20px', right: '20px',
                                    width: isMobile ? '56px' : '64px', height: isMobile ? '56px' : '64px', borderRadius: '50%',
                                    backgroundColor: colors.primary, color: 'white',
                                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', boxShadow: `0 4px 20px ${colors.primary}44`,
                                    transition: 'transform 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {isPlaying ? <Pause size={isMobile ? 24 : 32} fill="white" /> : <Play size={isMobile ? 24 : 32} fill="white" style={{ marginLeft: '4px' }} />}
                            </button>
                        </div>

                        {/* Quick Stats Banner */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xl, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Plays</div>
                                <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>{track.playCount.toLocaleString()}</div>
                            </div>
                            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Duration</div>
                                <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>{formatDuration(track.duration)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Info & Metadata */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                        <div>
                            <h1 style={{ fontSize: isMobile ? '2rem' : '3rem', margin: '0 0 8px 0', lineHeight: 1.1 }}>{track.title}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '1.1rem' : '1.25rem', color: colors.textSecondary }}>
                                by <a href={`/profile/${track.profile.username}`} style={{ color: colors.primary, textDecoration: 'none' }}>{track.profile.displayName || track.profile.username}</a>
                            </div>
                        </div>

                        {track.description && (
                            <div style={{ padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, borderLeft: `4px solid ${colors.primary}` }}>
                                <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: isMobile ? '0.9rem' : '1rem' }}>{track.description}</p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: spacing.md }}>
                            {track.artist && <InfoItem icon={<Info size={16}/>} label="Artist" value={track.artist} />}
                            {track.album && <InfoItem icon={<Music size={16}/>} label="Album" value={track.album} />}
                            {track.year && <InfoItem icon={<Calendar size={16}/>} label="Year" value={track.year.toString()} />}
                            {track.bpm && <InfoItem icon={<Zap size={16}/>} label="BPM" value={track.bpm.toString()} />}
                            {track.key && <InfoItem icon={<Tag size={16}/>} label="Key" value={track.key} />}
                            <InfoItem icon={<Clock size={16}/>} label="Released" value={new Date(track.createdAt).toLocaleDateString()} />
                        </div>

                        {track.genres && track.genres.length > 0 && (
                            <div style={{ marginTop: spacing.md }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {track.genres.map(g => (
                                        <span key={g.genre.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {g.genre.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 'auto', display: 'flex', gap: spacing.md }}>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert('Link copied to clipboard!');
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}
                            >
                                <Share2 size={18} /> Share Track
                            </button>
                        </div>
                    </div>
                </div>

                {track.arrangement && track.arrangement.tracks.some(t => t.clips.length > 0) && (
                    <ArrangementViewer
                        arrangement={track.arrangement}
                        duration={track.duration}
                        currentTime={player.currentTrack?.id === track.id ? player.currentTime : 0}
                        isPlaying={isPlaying}
                        projectFileUrl={track.projectFileUrl}
                    />
                )}
            </div>
        </DiscoveryLayout>
    );
};

const TRACK_COLORS = [
    '#7C3AED', '#2563EB', '#059669', '#D97706',
    '#DC2626', '#7C3AED', '#0891B2', '#65A30D',
];

const ArrangementViewer: React.FC<{
    arrangement: ArrangementData;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    projectFileUrl: string | null;
}> = ({ arrangement, duration, currentTime, projectFileUrl }) => {
    const totalBeats = arrangement.tracks.reduce((max, t) =>
        Math.max(max, ...t.clips.map(c => c.start + c.length), 0), 32
    );
    const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const activeTracks = arrangement.tracks.filter(t => t.clips.length > 0);

    return (
        <div style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Music size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Project Structure</h2>
                    <span style={{ fontSize: '0.8rem', color: colors.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {arrangement.bpm} BPM
                    </span>
                </div>
                {projectFileUrl && (
                    <a
                        href={projectFileUrl}
                        download
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.primary, textDecoration: 'none', fontSize: '0.85rem', border: `1px solid ${colors.primary}33`, padding: '6px 12px', borderRadius: borderRadius.sm }}
                    >
                        <ExternalLink size={14} /> Download .flp
                    </a>
                )}
            </div>

            <div style={{ overflowX: 'auto', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0d1117' }}>
                <div style={{ minWidth: '600px', position: 'relative', padding: '16px 16px 16px 0' }}>
                    {/* Beat ruler */}
                    <div style={{ display: 'flex', marginLeft: '140px', marginBottom: '8px' }}>
                        {Array.from({ length: Math.ceil(totalBeats / 4) }, (_, i) => (
                            <div key={i} style={{ flex: '0 0 calc(400% / ' + totalBeats + ')', textAlign: 'left', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '3px', paddingBottom: '4px' }}>
                                {i * 4 + 1}
                            </div>
                        ))}
                    </div>

                    {/* Track rows */}
                    {activeTracks.map((t, ti) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', height: '32px', marginBottom: '4px' }}>
                            <div style={{ width: '140px', flexShrink: 0, paddingRight: '12px', fontSize: '0.75rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                {t.name}
                            </div>
                            <div style={{ flex: 1, position: 'relative', height: '100%', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                                {t.clips.map((clip) => (
                                    <div
                                        key={clip.id}
                                        title={clip.name !== `Clip ${clip.id}` ? clip.name : t.name}
                                        style={{
                                            position: 'absolute',
                                            left: `${(clip.start / totalBeats) * 100}%`,
                                            width: `${(clip.length / totalBeats) * 100}%`,
                                            height: '100%',
                                            backgroundColor: TRACK_COLORS[ti % TRACK_COLORS.length] + 'CC',
                                            borderRadius: '3px',
                                            border: `1px solid ${TRACK_COLORS[ti % TRACK_COLORS.length]}`,
                                            boxSizing: 'border-box',
                                            minWidth: '3px',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Playhead */}
                    {playheadPct > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `calc(140px + (100% - 140px) * ${playheadPct / 100})`,
                            width: '2px',
                            backgroundColor: '#fff',
                            opacity: 0.8,
                            pointerEvents: 'none',
                            zIndex: 10,
                            transition: 'left 0.25s linear',
                        }} />
                    )}
                </div>
            </div>
        </div>
    );
};

const InfoItem: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ color: colors.primary, display: 'flex' }}>{icon}</div>
        <div>
            <div style={{ fontSize: '0.7rem', color: colors.textSecondary, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>{value}</div>
        </div>
    </div>
);
