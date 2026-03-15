import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import axios from 'axios';
import { FujiLogo } from '../components/FujiLogo';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
    Music, Play, Pause, Zap, Clock, Info, Tag, Calendar, 
    ArrowLeft, Share2, ExternalLink, Layers, FileAudio,
    Edit3, X, Save, Upload, Download
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface NoteData {
    key: number;
    position: number;
    length: number;
    velocity: number;
}

interface AutomationPoint {
    position: number;  // 0-1 normalized
    value: number;     // 0-1
    tension: number;   // -1 to 1
}

interface ArrangementClip {
    id: number;
    name: string;
    start: number;
    length: number;
    type?: 'pattern' | 'audio' | 'automation';
    notes?: NoteData[];
    sampleFileName?: string;
    automationPoints?: AutomationPoint[];
    // Enriched by ProjectZipProcessor when a ZIP bundle was uploaded
    oggUrl?: string;
    peaks?: number[];
    duration?: number;
}

interface ArrangementTrack {
    id: number;
    name: string;
    clips: ArrangementClip[];
    enabled?: boolean;
    group?: number;
}

interface ProjectInfo {
    plugins: string[];
    samples: string[];
}

interface ArrangementData {
    bpm: number;
    tracks: ArrangementTrack[];
    projectInfo?: ProjectInfo;
    markers?: Array<{ position: number; name: string }>;
}

interface TrackSample {
    id: string;
    originalFilename: string;
    oggUrl: string;
    peaks: number[];
    duration: number | null;
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
    projectZipUrl: string | null;
    allowAudioDownload: boolean;
    allowProjectDownload: boolean;
    samples?: TrackSample[];
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
    const { user, mutualAdminGuilds } = useAuth();
    const [track, setTrackData] = useState<Track | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [zoom, setZoom] = useState(1);
    const { player, setTrack, togglePlay } = usePlayer();

    // Edit state
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [editForm, setEditForm] = useState({ 
        title: '', 
        description: '', 
        artist: '', 
        album: '', 
        year: '', 
        bpm: '', 
        key: '',
        allowAudioDownload: true,
        allowProjectDownload: true
    });
    const [selectedTrackGenres, setSelectedTrackGenres] = useState<string[]>([]);
    const [genreSearchTerm, setGenreSearchTerm] = useState('');
    const [allGenres, setAllGenres] = useState<any[]>([]);
    const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
    const [editArtworkFile, setEditArtworkFile] = useState<File | null>(null);
    const [editProjectFile, setEditProjectFile] = useState<File | null>(null);
    const [flpConfirmOpen, setFlpConfirmOpen] = useState(false);

    const isOwner = user && track?.profile?.userId === user.id;
    const isAdmin = mutualAdminGuilds && mutualAdminGuilds.length > 0;
    const canEdit = isOwner || isAdmin;

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
                const [res, genresRes] = await Promise.all([
                    axios.get(`/api/musician/tracks/${username}/${trackSlug}`, { withCredentials: true }),
                    axios.get('/api/musician/genres', { withCredentials: true })
                ]);
                setTrackData(res.data);
                setAllGenres(genresRes.data);
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

    const openEditMode = () => {
        if (!track) return;
        setEditForm({
            title: track.title || '',
            description: track.description || '',
            artist: track.artist || '',
            album: track.album || '',
            year: track.year?.toString() || '',
            bpm: track.bpm?.toString() || '',
            key: track.key || '',
            allowAudioDownload: track.allowAudioDownload ?? true,
            allowProjectDownload: track.allowProjectDownload ?? true,
        });
        setSelectedTrackGenres(track.genres?.map(g => g.genre.id) || []);
        setEditAudioFile(null);
        setEditArtworkFile(null);
        setEditProjectFile(null);
        setEditMsg(null);
        setEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!track) return;
        setSaving(true);
        setEditMsg(null);

        try {
            const formData = new FormData();
            formData.append('title', editForm.title);
            formData.append('description', editForm.description);
            formData.append('artist', editForm.artist);
            formData.append('album', editForm.album);
            formData.append('year', editForm.year);
            formData.append('bpm', editForm.bpm);
            formData.append('key', editForm.key);
            formData.append('allowAudioDownload', String(editForm.allowAudioDownload));
            formData.append('allowProjectDownload', String(editForm.allowProjectDownload));
            formData.append('genreIds', JSON.stringify(selectedTrackGenres));
            if (editAudioFile) formData.append('audio', editAudioFile);
            if (editArtworkFile) formData.append('artwork', editArtworkFile);
            if (editProjectFile) formData.append('project', editProjectFile);

            // Use admin endpoint if not owner
            const endpoint = isOwner 
                ? `/api/musician/tracks/${track.id}` 
                : `/api/admin/tracks/${track.id}`;

            const res = await axios.put(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            
            setTrackData(res.data);
            setEditing(false);
            setEditMsg({ type: 'success', text: 'Track updated successfully!' });
            setTimeout(() => setEditMsg(null), 3000);
        } catch (e: any) {
            setEditMsg({ type: 'error', text: e.response?.data?.error || 'Failed to update track' });
        } finally {
            setSaving(false);
        }
    };

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
                    <div style={isMobile ? { display: 'flex', gap: '16px', alignItems: 'flex-start' } : {}}>
                        <div style={{ 
                            aspectRatio: '1/1', 
                            borderRadius: borderRadius.lg, 
                            overflow: 'hidden', 
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            position: 'relative',
                            width: isMobile ? '120px' : '100%',
                            flexShrink: 0
                        }}>
                            {track.coverUrl ? (
                                <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                                    <FujiLogo size={isMobile ? 120 : 160} color={colors.primary} opacity={0.2} />
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: isMobile ? 0 : spacing.xl, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.05)', flex: isMobile ? 1 : undefined }}>
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
                            <InfoItem icon={<Clock size={16}/>} label="Uploaded" value={new Date(track.createdAt).toLocaleDateString()} />
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

                        <div style={{ marginTop: 'auto', display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
                            {track.allowAudioDownload && (
                                <button 
                                    onClick={() => window.open(track.url, '_blank')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}
                                >
                                    <Download size={18} /> Download Audio
                                </button>
                            )}
                            {track.projectFileUrl && (track.allowProjectDownload ?? true) && (
                                <>
                                    <button
                                        onClick={() => setFlpConfirmOpen(true)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        <Download size={18} /> Download .flp
                                    </button>
                                    <ConfirmModal
                                        open={flpConfirmOpen}
                                        title="Project File Download"
                                        message={`This project file is for educational display. It does not include the audio samples or VSTs used by the artist. Some files may appear missing upon opening.\n\nContinue with download?`}
                                        confirmLabel="Download"
                                        onConfirm={() => { setFlpConfirmOpen(false); window.open(track.projectFileUrl!, '_blank'); }}
                                        onCancel={() => setFlpConfirmOpen(false)}
                                    />
                                </>
                            )}
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    showToast('Link copied to clipboard!', 'success');
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}
                            >
                                <Share2 size={18} /> Share Track
                            </button>
                            {canEdit && (
                                <button 
                                    onClick={openEditMode}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.primary, border: `1px solid ${colors.primary}33`, padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}
                                >
                                    <Edit3 size={18} /> Edit Track
                                </button>
                            )}
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
                        projectZipUrl={track.projectZipUrl}
                        zoom={zoom}
                        setZoom={setZoom}
                        samplesMap={Object.fromEntries(
                            (track.samples ?? []).map(s => [s.originalFilename.toLowerCase(), s.peaks])
                        )}
                    />
                )}

                {track.arrangement?.projectInfo && (
                    (track.arrangement.projectInfo.plugins.length > 0 || track.arrangement.projectInfo.samples.length > 0) && (
                        <ProjectInfoPanel projectInfo={track.arrangement.projectInfo} />
                    )
                )}

                {/* Edit Message Banner */}
                {editMsg && !editing && (
                    <div style={{
                        position: 'fixed', top: '20px', right: '20px', zIndex: 10000,
                        padding: '12px 20px', borderRadius: borderRadius.md,
                        backgroundColor: editMsg.type === 'success' ? '#059669' : '#DC2626',
                        color: 'white', fontWeight: 600, fontSize: '0.9rem',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    }}>
                        {editMsg.text}
                    </div>
                )}

                {/* Edit Modal Overlay */}
                {editing && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}>
                        <div style={{
                            backgroundColor: colors.surface, borderRadius: borderRadius.lg,
                            border: '1px solid rgba(255,255,255,0.1)',
                            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
                            padding: '32px',
                        }}>
                            {/* Modal Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Edit3 size={24} color={colors.primary} />
                                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Edit Track</h2>
                                </div>
                                <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            {editMsg && (
                                <div style={{
                                    padding: '10px 16px', borderRadius: borderRadius.md, marginBottom: '16px',
                                    backgroundColor: editMsg.type === 'success' ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)',
                                    color: editMsg.type === 'success' ? '#34D399' : '#F87171',
                                    border: `1px solid ${editMsg.type === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`,
                                    fontSize: '0.9rem',
                                }}>
                                    {editMsg.text}
                                </div>
                            )}

                            {/* Form Fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Title */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>Title *</label>
                                    <input
                                        type="text" value={editForm.title}
                                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Artist / Album row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>Artist</label>
                                        <input
                                            type="text" value={editForm.artist}
                                            onChange={e => setEditForm(f => ({ ...f, artist: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>Album</label>
                                        <input
                                            type="text" value={editForm.album}
                                            onChange={e => setEditForm(f => ({ ...f, album: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>

                                {/* Year / BPM / Key row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>Year</label>
                                        <input
                                            type="number" value={editForm.year}
                                            onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>BPM</label>
                                        <input
                                            type="number" value={editForm.bpm}
                                            onChange={e => setEditForm(f => ({ ...f, bpm: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>Key</label>
                                        <input
                                            type="text" value={editForm.key} placeholder="e.g. C minor"
                                            onChange={e => setEditForm(f => ({ ...f, key: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>Description</label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                        rows={3}
                                        style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Genre Tags */}
                                <div>
                                    <label style={{ marginBottom: '6px', fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Tag size={14} /> Genre Tags
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                        {selectedTrackGenres.map(gid => {
                                            const g = allGenres.find(ag => ag.id === gid);
                                            return g ? (
                                                <span key={gid} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: colors.primary, color: 'white', padding: '4px 10px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    {g.name}
                                                    <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => setSelectedTrackGenres(prev => prev.filter(id => id !== gid))} />
                                                </span>
                                            ) : null;
                                        })}
                                        {selectedTrackGenres.length === 0 && (
                                            <span style={{ fontSize: '0.85rem', color: colors.textSecondary, fontStyle: 'italic' }}>No genres selected</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <input 
                                            type="text"
                                            placeholder="Search genres..."
                                            value={genreSearchTerm}
                                            onChange={e => setGenreSearchTerm(e.target.value)}
                                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, padding: '10px 14px', color: 'white', fontSize: '0.95rem' }}
                                        />
                                        <select
                                            value=""
                                            onChange={e => {
                                                if (e.target.value && !selectedTrackGenres.includes(e.target.value)) {
                                                    setSelectedTrackGenres(prev => [...prev, e.target.value]);
                                                    setGenreSearchTerm('');
                                                }
                                            }}
                                            style={{ flex: 1, padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: 'white', fontSize: '0.95rem', outline: 'none', cursor: 'pointer' }}
                                        >
                                            <option value="" disabled style={{ backgroundColor: '#1A1E2E', color: 'white' }}>Add genre...</option>
                                            {allGenres
                                                .filter(g => !selectedTrackGenres.includes(g.id))
                                                .filter(g => g.name.toLowerCase().includes(genreSearchTerm.toLowerCase()))
                                                .map(g => (
                                                    <option key={g.id} value={g.id} style={{ backgroundColor: '#1A1E2E', color: 'white' }}>{g.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>

                                {/* Download Settings */}
                                <div style={{ marginTop: '4px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: colors.textSecondary }}>Download Permissions</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={editForm.allowAudioDownload}
                                                onChange={e => setEditForm(f => ({ ...f, allowAudioDownload: e.target.checked }))}
                                            />
                                            Public: Allow Audio Download
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={editForm.allowProjectDownload}
                                                onChange={e => setEditForm(f => ({ ...f, allowProjectDownload: e.target.checked }))}
                                            />
                                            Public: Allow FLP Project Download
                                        </label>
                                    </div>
                                </div>

                                {/* File Uploads */}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '4px' }}>
                                    <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: colors.textSecondary }}>Replace Files (optional)</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* Audio upload */}
                                        <div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: '0.9rem', transition: 'border-color 0.2s' }}>
                                                <Upload size={16} />
                                                {editAudioFile ? editAudioFile.name : 'Replace audio file (MP3, WAV, FLAC)'}
                                                <input type="file" accept=".mp3,.wav,.flac,audio/*" style={{ display: 'none' }} onChange={e => setEditAudioFile(e.target.files?.[0] || null)} />
                                            </label>
                                        </div>
                                        {/* Artwork upload */}
                                        <div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: '0.9rem', transition: 'border-color 0.2s' }}>
                                                <Upload size={16} />
                                                {editArtworkFile ? editArtworkFile.name : 'Replace artwork (JPG, PNG)'}
                                                <input type="file" accept=".jpg,.jpeg,.png,image/*" style={{ display: 'none' }} onChange={e => setEditArtworkFile(e.target.files?.[0] || null)} />
                                            </label>
                                        </div>
                                        {/* Project file upload */}
                                        <div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: '0.9rem', transition: 'border-color 0.2s' }}>
                                                <Upload size={16} />
                                                {editProjectFile ? editProjectFile.name : 'Replace project file (FLP or ZIP bundle)'}
                                                <input type="file" accept=".flp,.zip" style={{ display: 'none' }} onChange={e => setEditProjectFile(e.target.files?.[0] || null)} />
                                            </label>
                                            {editProjectFile?.name.endsWith('.zip') && (
                                                <p style={{ margin: '4px 0 0 4px', fontSize: '0.78rem', color: colors.textSecondary }}>
                                                    ZIP bundles are processed server-side to extract real waveforms. This may take a moment.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        onClick={() => setEditing(false)}
                                        disabled={saving}
                                        style={{ padding: '10px 24px', backgroundColor: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={saving || !editForm.title.trim()}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.md, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem', opacity: saving || !editForm.title.trim() ? 0.5 : 1 }}
                                    >
                                        <Save size={16} />
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};

const TRACK_COLORS = [
    '#7C3AED', '#2563EB', '#059669', '#D97706',
    '#DC2626', '#7C3AED', '#0891B2', '#65A30D',
];

/* ── Note names for piano roll labels ── */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const keyToName = (k: number) => `${NOTE_NAMES[k % 12]}${Math.floor(k / 12) - 2}`;

/** Full Piano Roll Modal – shown when a pattern clip is clicked */
const PianoRollModal: React.FC<{
    clip: ArrangementClip;
    color: string;
    onClose: () => void;
}> = ({ clip, color, onClose }) => {
    const notes = clip.notes ?? [];
    if (!notes.length) return null;

    const keys = notes.map(n => n.key);
    const minKey = Math.max(0, Math.min(...keys) - 2);
    const maxKey = Math.min(131, Math.max(...keys) + 2);
    const keyRange = maxKey - minKey + 1;
    const ROW_H = 14;
    const ROLL_H = keyRange * ROW_H;
    const LABEL_W = 44;

    // Auto-fit: scale so all notes fit in ~820px (interior minus key sidebar)
    const maxPos = Math.max(...notes.map(n => n.position + n.length), clip.length);
    const FIT_WIDTH = 820;
    const autoZoom = Math.max(15, Math.min(80, Math.floor(FIT_WIDTH / Math.max(maxPos, 1))));
    const [zoomPx, setZoomPx] = React.useState(autoZoom);
    const BEAT_W = zoomPx;

    const svgW = Math.max(maxPos * BEAT_W, 240);

    // Which rows are black keys
    const isBlack = (k: number) => [1,3,6,8,10].includes(k % 12);

    // Beat grid lines
    const beatLines = [];
    for (let b = 0; b <= Math.ceil(maxPos); b++) {
        beatLines.push(b);
    }

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: '#0d1117',
                    border: `1px solid ${color}44`,
                    borderRadius: borderRadius.lg,
                    maxWidth: '900px',
                    width: '100%',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color }} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{clip.name}</span>
                        <span style={{ fontSize: '0.75rem', color: colors.textSecondary, backgroundColor: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px' }}>
                            {notes.length} notes · {clip.length.toFixed(1)} beats
                        </span>
                    </div>
                    {/* Zoom controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => setZoomPx(z => Math.max(8, Math.round(z / 1.5)))}
                                style={{ background: 'none', border: 'none', color: zoomPx <= 8 ? colors.textSecondary : colors.textPrimary, cursor: zoomPx <= 8 ? 'default' : 'pointer', padding: '0 6px', fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1 }}
                            >−</button>
                            <span style={{ fontSize: '0.7rem', color: colors.textSecondary, minWidth: '36px', textAlign: 'center' }}>{zoomPx}px/b</span>
                            <button
                                onClick={() => setZoomPx(z => Math.min(200, Math.round(z * 1.5)))}
                                style={{ background: 'none', border: 'none', color: zoomPx >= 200 ? colors.textSecondary : colors.textPrimary, cursor: zoomPx >= 200 ? 'default' : 'pointer', padding: '0 6px', fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1 }}
                            >+</button>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px', display: 'flex' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Piano roll body */}
                <div style={{ display: 'flex', flex: 1, overflow: 'auto', minHeight: 0 }}>
                    {/* Piano keys sidebar */}
                    <div style={{
                        width: `${LABEL_W}px`, flexShrink: 0,
                        backgroundColor: '#0d1117',
                        borderRight: '1px solid rgba(255,255,255,0.07)',
                        position: 'sticky', left: 0, zIndex: 2,
                    }}>
                        {Array.from({ length: keyRange }, (_, i) => {
                            const k = maxKey - i;
                            const black = isBlack(k);
                            const isC = k % 12 === 0;
                            return (
                                <div key={k} style={{
                                    height: `${ROW_H}px`,
                                    backgroundColor: black ? '#1a1f2b' : '#242938',
                                    borderBottom: '1px solid rgba(0,0,0,0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                    paddingRight: '6px',
                                    fontSize: '0.6rem',
                                    color: isC ? '#a78bfa' : (black ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)'),
                                    fontWeight: isC ? 700 : 400,
                                }}>
                                    {isC || black ? keyToName(k) : ''}
                                </div>
                            );
                        })}
                    </div>

                    {/* Note grid */}
                    <div style={{ position: 'relative', flexShrink: 0, width: `${svgW}px`, height: `${ROLL_H}px` }}>
                        {/* Row backgrounds */}
                        {Array.from({ length: keyRange }, (_, i) => {
                            const k = maxKey - i;
                            return (
                                <div key={k} style={{
                                    position: 'absolute', left: 0, right: 0,
                                    top: i * ROW_H, height: ROW_H,
                                    backgroundColor: isBlack(k) ? 'rgba(0,0,0,0.25)' : 'transparent',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                }} />
                            );
                        })}

                        {/* Beat grid lines */}
                        {beatLines.map(b => (
                            <div key={b} style={{
                                position: 'absolute', top: 0, bottom: 0,
                                left: `${b * BEAT_W}px`, width: '1px',
                                backgroundColor: b % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                            }} />
                        ))}

                        {/* Notes */}
                        {notes.map((note, i) => {
                            const rowIdx = maxKey - note.key;
                            if (rowIdx < 0 || rowIdx >= keyRange) return null;
                            const w = Math.max(note.length * BEAT_W - 2, 3);
                            return (
                                <div key={i} style={{
                                    position: 'absolute',
                                    left: `${note.position * BEAT_W + 1}px`,
                                    top: `${rowIdx * ROW_H + 2}px`,
                                    width: `${w}px`,
                                    height: `${ROW_H - 4}px`,
                                    backgroundColor: color,
                                    opacity: 0.4 + (note.velocity / 128) * 0.6,
                                    borderRadius: '2px',
                                    boxShadow: `0 0 4px ${color}88`,
                                }} />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Sample Info Modal – shown when an audio clip is clicked */
const SampleInfoModal: React.FC<{
    clip: ArrangementClip;
    color: string;
    peaks?: number[];
    projectZipUrl?: string | null;
    onClose: () => void;
}> = ({ clip, color, peaks, projectZipUrl, onClose }) => {
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [audioDuration, setAudioDuration] = React.useState<number>(clip.duration ?? 0);

    const hasPeaks = peaks && peaks.length > 0;
    const bars = 120;
    const step = hasPeaks ? peaks!.length / bars : 1;

    // Playhead position in SVG units (0..bars)
    const playheadX = audioDuration > 0 ? (currentTime / audioDuration) * bars : 0;

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (playing) audioRef.current.pause();
        else audioRef.current.play().catch(() => {});
    };

    const seekClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !audioDuration) return;
        const r = e.currentTarget.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        audioRef.current.currentTime = frac * audioDuration;
    };

    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: '#0d1117',
                    border: `1px solid ${color}44`,
                    borderRadius: borderRadius.lg,
                    width: '480px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    backgroundColor: `${color}18`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileAudio size={16} color={color} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{clip.name}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Waveform with playhead */}
                <div style={{ padding: '16px 16px 0' }}>
                    <div
                        onClick={clip.oggUrl ? seekClick : undefined}
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            borderRadius: borderRadius.md,
                            padding: '12px 8px',
                            border: `1px solid ${color}22`,
                            cursor: clip.oggUrl ? 'pointer' : 'default',
                            position: 'relative',
                        }}
                    >
                        <svg viewBox={`0 0 ${bars} 40`} preserveAspectRatio="none" style={{ width: '100%', height: '64px', display: 'block' }}>
                            {hasPeaks
                                ? Array.from({ length: bars }, (_, i) => {
                                    const start = Math.floor(i * step);
                                    const end = Math.min(Math.ceil((i + 1) * step), peaks!.length);
                                    let sum = 0;
                                    for (let j = start; j < end; j++) sum += peaks![j];
                                    const amp = sum / (end - start);
                                    const h = Math.max(amp * 36, 1);
                                    return (
                                        <rect key={i} x={i} y={20 - h / 2} width={0.7} height={h} fill={color} opacity={0.85} />
                                    );
                                })
                                : Array.from({ length: bars }, (_, i) => {
                                    const seed = clip.id;
                                    const amp = (Math.sin(seed * 0.1 + i * 0.7) * 0.4 + 0.5) * (Math.sin(i * 0.3 + seed * 0.05) * 0.3 + 0.7);
                                    const h = Math.max(amp * 36, 1);
                                    return <rect key={i} x={i} y={20 - h / 2} width={0.7} height={h} fill={color} opacity={0.55} />;
                                })
                            }
                            {/* Synced playhead */}
                            {audioDuration > 0 && (
                                <line x1={playheadX} y1={0} x2={playheadX} y2={40}
                                    stroke="white" strokeWidth="0.5" opacity="0.9" />
                            )}
                        </svg>
                        {!hasPeaks && (
                            <div style={{ textAlign: 'center', fontSize: '0.65rem', color: colors.textSecondary, marginTop: '4px' }}>
                                Upload a ZIP bundle to see the real waveform
                            </div>
                        )}
                    </div>
                </div>

                {/* Audio player controls */}
                {clip.oggUrl && (
                    <div style={{ padding: '10px 16px 0' }}>
                        <audio
                            ref={audioRef}
                            src={clip.oggUrl}
                            onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
                            onDurationChange={() => { if (audioRef.current) setAudioDuration(audioRef.current.duration); }}
                            onPlay={() => setPlaying(true)}
                            onPause={() => setPlaying(false)}
                            onEnded={() => { setPlaying(false); setCurrentTime(0); }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Play/pause */}
                            <button
                                onClick={togglePlay}
                                style={{
                                    background: `${color}22`, border: `1px solid ${color}55`,
                                    borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color, flexShrink: 0,
                                }}
                            >
                                {playing ? <Pause size={14} /> : <Play size={14} />}
                            </button>

                            {/* Progress bar */}
                            <div
                                onClick={seekClick}
                                style={{
                                    flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.12)',
                                    borderRadius: 4, cursor: 'pointer', position: 'relative',
                                }}
                            >
                                <div style={{
                                    position: 'absolute', left: 0, top: 0, bottom: 0,
                                    width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%`,
                                    backgroundColor: color, borderRadius: 4,
                                    transition: 'width 0.05s linear',
                                }} />
                            </div>

                            {/* Time */}
                            <span style={{ fontSize: '0.72rem', color: colors.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>
                                {fmtTime(currentTime)} / {fmtTime(audioDuration)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Metadata rows */}
                <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { label: 'File', value: clip.sampleFileName ?? clip.name },
                        { label: 'Clip length', value: `${clip.length.toFixed(2)} beats` },
                        { label: 'Sample duration', value: audioDuration > 0 ? fmtTime(audioDuration) : (clip.duration ? fmtTime(clip.duration) : '—') },
                    ].map(({ label, value }) => (
                        <div key={label} style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '6px 10px',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: borderRadius.sm,
                            fontSize: '0.82rem',
                        }}>
                            <span style={{ color: colors.textSecondary }}>{label}</span>
                            <span style={{ color: colors.textPrimary, fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
                        </div>
                    ))}

                    {/* Download ZIP button */}
                    {projectZipUrl && (
                        <a
                            href={projectZipUrl}
                            download
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                marginTop: '4px', padding: '8px',
                                backgroundColor: `${color}22`, border: `1px solid ${color}44`,
                                borderRadius: borderRadius.md, color, textDecoration: 'none',
                                fontSize: '0.82rem', fontWeight: 600,
                            }}
                        >
                            <Download size={14} /> Download Loop Package
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

const ArrangementViewer: React.FC<{
    arrangement: ArrangementData;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    projectFileUrl: string | null;
    projectZipUrl?: string | null;
    zoom: number;
    setZoom: (v: number) => void;
    /** keyed by lowercase sample basename → real peak array from server */
    samplesMap?: Record<string, number[]>;
}> = ({ arrangement, duration, currentTime, isPlaying, projectFileUrl, projectZipUrl, zoom, setZoom, samplesMap = {} }) => {
    const [selectedClip, setSelectedClip] = React.useState<{ clip: ArrangementClip; color: string } | null>(null);
    // Find the actual project length based ONLY on the clips provided.
    // If the FLP parser included empty tracks up to 501, we filter those out here.
    const lastClipEnd = arrangement.tracks.reduce((max, t) => {
        const trackMax = t.clips.reduce((tm, c) => Math.max(tm, c.start + c.length), 0);
        return Math.max(max, trackMax);
    }, 0);

    // If for some reason lastClipEnd is 0 (unlikely for a valid song), fallback to 32.
    // We strictly use lastClipEnd to trim the "wasted space".
    const totalBeats = lastClipEnd > 0 ? lastClipEnd : 32;
    
    // Include all tracks from the parser (it already filters to relevant ones)
    const activeTracks = arrangement.tracks;
    const markers = arrangement.markers ?? [];
    
    // Build lookup for group depth calculation
    const trackById = new Map(activeTracks.map(t => [t.id, t]));
    
    const bpm = arrangement.bpm || 140;
    const beatsPerSec = bpm / 60;

    // Anchor playhead to actual audio duration rather than BPM alone.
    // This eliminates drift when the FLP's parsed BPM is even slightly off.
    // If the track has a known duration, map audio time linearly to the
    // arrangement's beat span.  Fall back to BPM-only when duration is unknown.
    const minClipStart = activeTracks.reduce((min, t) =>
        t.clips.reduce((tm, c) => Math.min(tm, c.start), min), Infinity);
    const startBeat = isFinite(minClipStart) ? minClipStart : 0;
    const spanBeats = totalBeats - startBeat;

    const playheadBeat = duration > 0 && spanBeats > 0
        ? startBeat + (currentTime / duration) * spanBeats
        : currentTime * beatsPerSec;

    const playheadPct = totalBeats > 0 ? (playheadBeat / totalBeats) * 100 : 0;

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Alt + scroll wheel zoom
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.altKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                setZoom(z => Math.min(10, Math.max(1, z + delta)));
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [setZoom]);

    // Auto-scroll logic: keep the playhead visible when zoomed in
    useEffect(() => {
        if (isPlaying && scrollContainerRef.current && zoom > 1) {
            const container = scrollContainerRef.current;
            const timelineContainerWidth = container.scrollWidth - 140;
            const playheadX = (playheadPct / 100) * timelineContainerWidth + 140;
            const viewportWidth = container.clientWidth;

            // Only auto-scroll when zoomed in enough to have real horizontal scrolling
            if (container.scrollWidth > viewportWidth + 10) {
                const targetScrollLeft = playheadX - (viewportWidth / 2);
                // Clamp to valid range
                const maxScroll = container.scrollWidth - viewportWidth;
                container.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
            }
        }
    }, [playheadPct, isPlaying, zoom]);

    // Zoom controls: 1.0 = full width fits in container (with min-width)
    // We'll use a base width of 100% and multiply it by zoom.
    const timelineWidth = `${100 * zoom}%`;

    return (
        <div style={{ marginTop: '40px', maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Music size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Playlist</h2>
                    <span style={{ fontSize: '0.8rem', color: colors.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {arrangement.bpm} BPM
                    </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Zoom Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button 
                            onClick={() => setZoom(Math.max(1, zoom - 0.5))} 
                            style={{ background: 'none', border: 'none', color: zoom <= 1 ? colors.textSecondary : colors.textPrimary, cursor: zoom <= 1 ? 'default' : 'pointer', padding: '2px 8px', fontSize: '1.2rem', fontWeight: 'bold' }}
                        >-</button>
                        <span style={{ fontSize: '0.75rem', color: colors.textSecondary, minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                        <button 
                            onClick={() => setZoom(Math.min(10, zoom + 0.5))} 
                            style={{ background: 'none', border: 'none', color: zoom >= 10 ? colors.textSecondary : colors.textPrimary, cursor: zoom >= 10 ? 'default' : 'pointer', padding: '2px 8px', fontSize: '1.2rem', fontWeight: 'bold' }}
                        >+</button>
                    </div>


                </div>
            </div>

            <div 
                ref={scrollContainerRef}
                style={{ 
                    overflowX: 'auto', 
                    borderRadius: borderRadius.md, 
                    border: '1px solid rgba(255,255,255,0.08)', 
                    backgroundColor: '#0d1117',
                    scrollBehavior: 'smooth'
                }}
            >
                <div style={{ width: timelineWidth, minWidth: '100%', position: 'relative', paddingTop: '28px', paddingBottom: '16px', boxSizing: 'border-box' }}>
                    {/* Beat ruler */}
                    <div style={{ display: 'flex', marginLeft: '140px', marginBottom: '8px', width: 'calc(100% - 140px)' }}>
                        {(() => {
                            // Unified step calculation
                            // 1 zoom = 100%
                            let barStep = 10;
                            
                            if (zoom < 0.3) barStep = 40;
                            else if (zoom < 0.6) barStep = 20;
                            else if (zoom < 1.5) barStep = 10;
                            else if (zoom < 3) barStep = 4;
                            else if (zoom < 5) barStep = 2;
                            else barStep = 1;
                            
                            const totalBars = Math.ceil(totalBeats / 4);
                            const items = [];
                            for (let bar = 1; bar <= totalBars; bar += barStep) {
                                items.push(
                                    <div key={bar} style={{ 
                                        position: 'absolute',
                                        left: `${((bar - 1) * 4 / totalBeats) * 100}%`,
                                        fontSize: '0.65rem', 
                                        color: 'rgba(255,255,255,0.4)', 
                                        borderLeft: '1px solid rgba(255,255,255,0.15)', 
                                        paddingLeft: '4px', 
                                        paddingBottom: '4px',
                                        boxSizing: 'border-box',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {bar}
                                    </div>
                                );
                            }
                            return <div style={{ position: 'relative', width: '100%', height: '1.2rem' }}>{items}</div>;
                        })()}
                    </div>

                    {/* Track rows */}
                    {activeTracks.map((t, ti) => {
                        const isMuted = t.enabled === false;
                        const isEmpty = t.clips.length === 0;
                        // Calculate group nesting depth
                        let depth = 0;
                        let current = t;
                        const seen = new Set<number>();
                        while ((current.group ?? 0) > 0) {
                            if (seen.has(current.id)) break; // prevent cycles
                            seen.add(current.id);
                            depth++;
                            // group is 1-based track number from FL Studio
                            const parentIdx = current.group! - 1; // convert to 0-based
                            const parent = trackById.get(parentIdx);
                            if (!parent) break;
                            current = parent;
                        }
                        const trackColor = isMuted ? '#6b7280' : TRACK_COLORS[ti % TRACK_COLORS.length];
                        const indentPx = depth * 12;
                        return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', height: isEmpty ? '24px' : '36px', marginBottom: isEmpty ? '2px' : '4px', opacity: isMuted ? 0.45 : 1 }}>
                            <div style={{ 
                                width: '140px', flexShrink: 0,
                                paddingRight: '12px',
                                paddingLeft: `${indentPx}px`,
                                fontSize: isEmpty ? '0.65rem' : '0.75rem', 
                                color: isMuted ? '#6b7280' : (isEmpty ? 'rgba(255,255,255,0.35)' : colors.textSecondary),
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                textAlign: 'right', position: 'sticky', left: 0,
                                backgroundColor: '#0d1117', zIndex: 5,
                                borderRight: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px'
                            }}>
                                {depth > 0 && <span style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>╰</span>}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: isEmpty ? 'italic' : 'normal' }}>{t.name}</span>
                                {isMuted && <span style={{ flexShrink: 0, fontSize: '0.6rem', backgroundColor: 'rgba(255,255,255,0.1)', color: '#9ca3af', padding: '1px 3px', borderRadius: '2px' }}>M</span>}
                            </div>
                            <div style={{ flex: 1, position: 'relative', height: '100%', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                                {t.clips.map((clip) => {
                                    const isClickable = (clip.type === 'pattern' && clip.notes && clip.notes.length > 0) || clip.type === 'audio';
                                    return (
                                        <div
                                            key={clip.id}
                                            title={clip.name}
                                            onClick={isClickable ? (e) => { e.stopPropagation(); setSelectedClip({ clip, color: trackColor }); } : undefined}
                                            style={{
                                                position: 'absolute',
                                                left: `${(clip.start / totalBeats) * 100}%`,
                                                width: `${(clip.length / totalBeats) * 100}%`,
                                                height: '100%',
                                                backgroundColor: trackColor + (isMuted ? '20' : '40'),
                                                borderRadius: '3px',
                                                border: `1px solid ${trackColor}${isMuted ? '44' : '88'}`,
                                                boxSizing: 'border-box',
                                                minWidth: '3px',
                                                overflow: 'hidden',
                                                cursor: isClickable ? 'pointer' : 'default',
                                            }}
                                        >
                                            {/* Clip label */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '1px',
                                                left: '3px',
                                                fontSize: '0.55rem',
                                                color: trackColor,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: 'calc(100% - 6px)',
                                                lineHeight: 1,
                                                fontWeight: 600,
                                                opacity: 0.9,
                                            }}>
                                                {clip.name}
                                            </div>
                                            {clip.type === 'pattern' && clip.notes && clip.notes.length > 0 && (
                                                <MiniPianoRoll notes={clip.notes} clipLength={clip.length} color={trackColor} />
                                            )}
                                            {clip.type === 'automation' && clip.automationPoints && clip.automationPoints.length > 0 && (
                                                <MiniAutomation points={clip.automationPoints} color={trackColor} />
                                            )}
                                            {clip.type === 'audio' && (
                                                <MiniWaveform
                                                    color={trackColor}
                                                    clipId={clip.id}
                                                    peaks={clip.sampleFileName ? samplesMap[clip.sampleFileName.toLowerCase()] : undefined}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        );
                    })}

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

                    {/* Timeline markers */}
                    {markers.map((marker, mi) => {
                        const pct = (marker.position / totalBeats) * 100;
                        return (
                            <div key={mi} style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: `calc(140px + (100% - 140px) * ${pct / 100})`,
                                width: '1px',
                                backgroundColor: '#f59e0b',
                                opacity: 0.7,
                                pointerEvents: 'none',
                                zIndex: 8,
                            }}>
                                {/* Triangle at top */}
                                <div style={{
                                    position: 'absolute',
                                    top: '6px',
                                    left: '-4px',
                                    width: 0,
                                    height: 0,
                                    borderLeft: '4px solid transparent',
                                    borderRight: '4px solid transparent',
                                    borderTop: '6px solid #f59e0b',
                                }} />
                                {/* Marker name label */}
                                <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: '6px',
                                    fontSize: '0.6rem',
                                    color: '#f59e0b',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 600,
                                    pointerEvents: 'none',
                                    textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)',
                                    letterSpacing: '0.02em',
                                    backgroundColor: 'rgba(13,17,23,0.85)',
                                    padding: '1px 4px',
                                    borderRadius: '2px',
                                }}>{marker.name}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Clip inspector modals */}
            {selectedClip && selectedClip.clip.type === 'pattern' && selectedClip.clip.notes && selectedClip.clip.notes.length > 0 && (
                <PianoRollModal
                    clip={selectedClip.clip}
                    color={selectedClip.color}
                    onClose={() => setSelectedClip(null)}
                />
            )}
            {selectedClip && selectedClip.clip.type === 'audio' && (
                <SampleInfoModal
                    clip={selectedClip.clip}
                    color={selectedClip.color}
                    peaks={selectedClip.clip.sampleFileName ? samplesMap[selectedClip.clip.sampleFileName.toLowerCase()] : undefined}
                    projectZipUrl={projectZipUrl}
                    onClose={() => setSelectedClip(null)}
                />
            )}
        </div>
    );
};

/** Mini piano roll: renders note rectangles inside a pattern clip, just like FL Studio's playlist */
const MiniPianoRoll: React.FC<{ notes: NoteData[]; clipLength: number; color: string }> = ({ notes, clipLength, color }) => {
    if (!notes.length) return null;

    // Find key range for vertical scaling
    const keys = notes.map(n => n.key);
    const minKey = Math.min(...keys);
    const maxKey = Math.max(...keys);
    const keyRange = Math.max(maxKey - minKey, 1);

    return (
        <svg
            viewBox={`0 0 ${clipLength} ${keyRange + 1}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.85 }}
        >
            {notes.map((note, i) => (
                <rect
                    key={i}
                    x={note.position}
                    y={maxKey - note.key}
                    width={Math.max(note.length, clipLength * 0.008)}
                    height={0.7}
                    fill={color}
                    opacity={0.5 + (note.velocity / 128) * 0.5}
                    rx={0.1}
                />
            ))}
        </svg>
    );
};

/** Mini automation curve: renders the actual automation shape like FL Studio */
const MiniAutomation: React.FC<{ points: AutomationPoint[]; color: string }> = ({ points, color }) => {
    if (points.length < 2) return null;

    const w = 100;
    const h = 20;
    const pad = 0.5; // small padding so the curve isn't clipped at edges

    // Build SVG path through points with tension-based curves
    const toX = (p: number) => pad + p * (w - pad * 2);
    const toY = (v: number) => h - pad - v * (h - pad * 2); // invert Y

    let path = `M ${toX(points[0].position)} ${toY(points[0].value)}`;

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const x1 = toX(prev.position);
        const y1 = toY(prev.value);
        const x2 = toX(curr.position);
        const y2 = toY(curr.value);

        if (Math.abs(prev.tension) < 0.01) {
            // Linear segment
            path += ` L ${x2} ${y2}`;
        } else {
            // Tension curve: FL Studio uses a power curve, approximate with cubic bezier
            // Positive tension = curve stays near start value then jumps
            // Negative tension = curve jumps then stays near end value
            const t = prev.tension;
            const cx1 = x1 + (x2 - x1) * (0.5 + t * 0.4);
            const cx2 = x2 - (x2 - x1) * (0.5 - t * 0.4);
            path += ` C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
        }
    }

    // Build fill path (close down to bottom)
    const fillPath = path +
        ` L ${toX(points[points.length - 1].position)} ${h}` +
        ` L ${toX(points[0].position)} ${h} Z`;

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.85 }}
        >
            <path d={fillPath} fill={color} opacity={0.15} />
            <path d={path} stroke={color} fill="none" strokeWidth={0.8} opacity={0.9} />
        </svg>
    );
};

/** Waveform for audio clips: uses real peaks from server when available, otherwise falls back to deterministic pseudo-random bars */
const MiniWaveform: React.FC<{ color: string; clipId: number | string; peaks?: number[] }> = ({ color, clipId, peaks }) => {
    if (peaks && peaks.length > 0) {
        // Real waveform: render as a bar chart, downsampled to fit the SVG width
        const bars = 60;
        const step = peaks.length / bars;
        return (
            <svg
                viewBox={`0 0 ${bars} 20`}
                preserveAspectRatio="none"
                style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.75 }}
            >
                {Array.from({ length: bars }, (_, i) => {
                    // Average a slice of the peaks array to get one bar value
                    const start = Math.floor(i * step);
                    const end = Math.min(Math.ceil((i + 1) * step), peaks.length);
                    let sum = 0;
                    for (let j = start; j < end; j++) sum += peaks[j];
                    const amp = sum / (end - start);
                    const h = Math.max(amp * 18, 1);
                    return (
                        <rect
                            key={i}
                            x={i}
                            y={10 - h / 2}
                            width={0.7}
                            height={h}
                            fill={color}
                            opacity={0.8}
                        />
                    );
                })}
            </svg>
        );
    }

    // Placeholder: deterministic pseudo-random bars
    const bars = 48;
    const seed = typeof clipId === 'string' ? clipId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : clipId;

    return (
        <svg
            viewBox={`0 0 ${bars} 20`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.6 }}
        >
            {Array.from({ length: bars }, (_, i) => {
                const amp = (Math.sin(seed * 0.1 + i * 0.7) * 0.4 + 0.5) *
                            (Math.sin(i * 0.3 + seed * 0.05) * 0.3 + 0.7);
                const h = Math.max(amp * 18, 1);
                return (
                    <rect
                        key={i}
                        x={i}
                        y={10 - h / 2}
                        width={0.7}
                        height={h}
                        fill={color}
                        opacity={0.7}
                    />
                );
            })}
        </svg>
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

/** Project info panel: shows plugins and samples used in the project */
const ProjectInfoPanel: React.FC<{ projectInfo: ProjectInfo }> = ({ projectInfo }) => {
    return (
        <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Layers size={20} color={colors.primary} />
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Project Details</h2>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: projectInfo.plugins.length > 0 && projectInfo.samples.length > 0 ? '1fr 1fr' : '1fr',
                gap: '16px',
            }}>
                {projectInfo.plugins.length > 0 && (
                    <div style={{
                        backgroundColor: '#0d1117',
                        borderRadius: borderRadius.md,
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Zap size={16} color={colors.primary} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Plugins ({projectInfo.plugins.length})
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {projectInfo.plugins.map((plugin, i) => (
                                <span key={i} style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    color: '#CBD5E1',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}>
                                    {plugin}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {projectInfo.samples.length > 0 && (
                    <div style={{
                        backgroundColor: '#0d1117',
                        borderRadius: borderRadius.md,
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <FileAudio size={16} color={colors.primary} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Samples ({projectInfo.samples.length})
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {projectInfo.samples.map((sample, i) => (
                                <span key={i} style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    color: '#CBD5E1',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    maxWidth: '300px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {sample}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
