import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import axios from 'axios';
import { 
    Music, Play, Pause, Zap, Clock, Info, Tag, Calendar, 
    ArrowLeft, Share2, ExternalLink, Layers, FileAudio,
    Edit3, X, Save, Upload
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
}

interface ArrangementTrack {
    id: number;
    name: string;
    clips: ArrangementClip[];
}

interface ProjectInfo {
    plugins: string[];
    samples: string[];
}

interface ArrangementData {
    bpm: number;
    tracks: ArrangementTrack[];
    projectInfo?: ProjectInfo;
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
    const [editForm, setEditForm] = useState({ title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '' });
    const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
    const [editArtworkFile, setEditArtworkFile] = useState<File | null>(null);
    const [editProjectFile, setEditProjectFile] = useState<File | null>(null);

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
        });
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
                        zoom={zoom}
                        setZoom={setZoom}
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
                                                {editProjectFile ? editProjectFile.name : 'Replace project file (FLP)'}
                                                <input type="file" accept=".flp" style={{ display: 'none' }} onChange={e => setEditProjectFile(e.target.files?.[0] || null)} />
                                            </label>
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

const ArrangementViewer: React.FC<{
    arrangement: ArrangementData;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    projectFileUrl: string | null;
    zoom: number;
    setZoom: (v: number) => void;
}> = ({ arrangement, duration, currentTime, projectFileUrl, zoom, setZoom }) => {
    const totalBeats = arrangement.tracks.reduce((max, t) =>
        Math.max(max, ...t.clips.map(c => c.start + c.length), 0), 32
    );
    const bpm = arrangement.bpm || 140;
    const beatsPerSec = bpm / 60;
    const currentBeat = currentTime * beatsPerSec;
    const playheadPct = totalBeats > 0 ? (currentBeat / totalBeats) * 100 : 0;
    const activeTracks = arrangement.tracks.filter(t => t.clips.length > 0);

    // Zoom controls: 1.0 = full width fits in container (with min-width)
    // We'll use a base width of 100% and multiply it by zoom.
    const timelineWidth = `${100 * zoom}%`;

    return (
        <div style={{ marginTop: '40px', maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Music size={20} color={colors.primary} />
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Project Structure</h2>
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
            </div>

            <div style={{ overflowX: 'auto', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0d1117' }}>
                <div style={{ width: timelineWidth, minWidth: '100%', position: 'relative', padding: '16px 0', boxSizing: 'border-box' }}>
                    {/* Beat ruler */}
                    <div style={{ display: 'flex', marginLeft: '140px', marginBottom: '8px', width: 'calc(100% - 140px)' }}>
                        {Array.from({ length: Math.ceil(totalBeats / 4) }, (_, i) => (
                            <div key={i} style={{ flex: `0 0 ${4 / totalBeats * 100}%`, textAlign: 'left', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '3px', paddingBottom: '4px' }}>
                                {i * 4 + 1}
                            </div>
                        ))}
                    </div>

                    {/* Track rows */}
                    {activeTracks.map((t, ti) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', height: '36px', marginBottom: '4px' }}>
                            <div style={{ width: '140px', flexShrink: 0, paddingRight: '12px', fontSize: '0.75rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', position: 'sticky', left: 0, backgroundColor: '#0d1117', zIndex: 5, borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                {t.name}
                            </div>
                            <div style={{ flex: 1, position: 'relative', height: '100%', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                                {t.clips.map((clip) => {
                                    const trackColor = TRACK_COLORS[ti % TRACK_COLORS.length];
                                    return (
                                        <div
                                            key={clip.id}
                                            title={clip.name}
                                            style={{
                                                position: 'absolute',
                                                left: `${(clip.start / totalBeats) * 100}%`,
                                                width: `${(clip.length / totalBeats) * 100}%`,
                                                height: '100%',
                                                backgroundColor: trackColor + '40',
                                                borderRadius: '3px',
                                                border: `1px solid ${trackColor}88`,
                                                boxSizing: 'border-box',
                                                minWidth: '3px',
                                                overflow: 'hidden',
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
                                            {/* Pattern clip: mini piano roll */}
                                            {clip.type === 'pattern' && clip.notes && clip.notes.length > 0 && (
                                                <MiniPianoRoll notes={clip.notes} clipLength={clip.length} color={trackColor} />
                                            )}
                                            {/* Automation clip: curve */}
                                            {clip.type === 'automation' && clip.automationPoints && clip.automationPoints.length > 0 && (
                                                <MiniAutomation points={clip.automationPoints} color={trackColor} />
                                            )}
                                            {/* Audio clip: waveform placeholder */}
                                            {clip.type === 'audio' && (
                                                <MiniWaveform color={trackColor} clipId={clip.id} />
                                            )}
                                        </div>
                                    );
                                })}
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

/** Placeholder waveform for audio clips: deterministic pseudo-random bars */
const MiniWaveform: React.FC<{ color: string; clipId: number | string }> = ({ color, clipId }) => {
    // Generate a deterministic waveform shape from clipId
    const bars = 48;
    const seed = typeof clipId === 'string' ? clipId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : clipId;

    return (
        <svg
            viewBox={`0 0 ${bars} 20`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.6 }}
        >
            {Array.from({ length: bars }, (_, i) => {
                // Simple hash-like amplitude
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
