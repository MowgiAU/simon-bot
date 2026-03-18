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
    Edit3, X, Save, Upload, Download, Heart, ListPlus
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { CommentSection } from '../components/CommentSection';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { ArrangementViewer, ProjectInfoPanel, ArrangementData, ProjectInfo, ArrangementClip, NoteData, AutomationPoint } from '../components/ArrangementViewer';

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
    const [isFavourited, setIsFavourited] = useState(false);
    const [favouriteCount, setFavouriteCount] = useState(0);
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);

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
                // Load favourite data
                try {
                    const countRes = await axios.get(`/api/tracks/${res.data.id}/favourite-count`);
                    setFavouriteCount(countRes.data.count);
                    const favRes = await axios.get(`/api/tracks/${res.data.id}/favourite`, { withCredentials: true });
                    setIsFavourited(favRes.data.favourited);
                } catch { /* not logged in or error */ }
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

    const toggleFavourite = async () => {
        if (!track || !user) return;
        try {
            const { data } = await axios.post(`/api/tracks/${track.id}/favourite`, {}, { withCredentials: true });
            setIsFavourited(data.favourited);
            setFavouriteCount(prev => data.favourited ? prev + 1 : prev - 1);
        } catch {
            showToast('Login to favourite tracks', 'error');
        }
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
                            <button
                                onClick={toggleFavourite}
                                title={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
                                style={{
                                    position: 'absolute', bottom: '20px', left: '20px',
                                    width: isMobile ? '44px' : '48px', height: isMobile ? '44px' : '48px', borderRadius: '50%',
                                    backgroundColor: isFavourited ? '#EF4444' : 'rgba(0,0,0,0.6)',
                                    color: 'white', border: '2px solid rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    backdropFilter: 'blur(8px)',
                                }}
                                onMouseEnter={(e) => { if (!isFavourited) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.7)'; }}
                                onMouseLeave={(e) => { if (!isFavourited) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'; }}
                            >
                                <Heart size={isMobile ? 18 : 22} fill={isFavourited ? 'white' : 'none'} />
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
                            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Favourites</div>
                                <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>{favouriteCount.toLocaleString()}</div>
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
                            {track.projectZipUrl && (track.allowProjectDownload ?? true) && (
                                <a
                                    href={`/api/tracks/${track.id}/download-zip`}
                                    download
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}
                                >
                                    <Download size={18} /> Download Loop ZIP
                                </a>
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
                            {user && (
                                <button 
                                    onClick={() => setShowPlaylistModal(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600 }}
                                >
                                    <ListPlus size={18} /> Add to Playlist
                                </button>
                            )}
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
                        trackId={track.id}
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

                {/* Comments */}
                <CommentSection trackId={track.id} ownerId={track.profile.userId} />

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
                                            Public: Allow .flp project & ZIP loop package download
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
            {track && <AddToPlaylistModal trackId={track.id} open={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} />}
        </DiscoveryLayout>
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

