import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { 
    Music, Plus, X, Globe, ExternalLink, ArrowLeft, Tag, FileAudio,
    Image as ImageIcon, Edit3, Upload
} from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { ConfirmModal } from '../components/ConfirmModal';
import { Link, useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

export const MyTracksPage: React.FC = () => {
    const { user, loading: authLoading, isGuildMember } = useAuth();
    const navigate = useNavigate();
    const [tracks, setTracks] = useState<any[]>([]);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ trackId: string; title: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [username, setUsername] = useState('');

    // Add track state
    const [isAddingTrack, setIsAddingTrack] = useState(false);
    const [tosAgreed, setTosAgreed] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // 0-100 file transfer %
    const [uploadStage, setUploadStage] = useState<'uploading' | 'scanning' | 'converting' | null>(null);
    const [newTrack, setNewTrack] = useState({ 
        title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '',
        allowAudioDownload: true, allowProjectDownload: true
    });
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [artworkFile, setArtworkFile] = useState<File | null>(null);
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const [selectedTrackGenres, setSelectedTrackGenres] = useState<string[]>([]);
    const [genreSearchTerm, setGenreSearchTerm] = useState('');
    const [addGenreSearchTerm, setAddGenreSearchTerm] = useState('');

    // Edit track state
    const [editingTrack, setEditingTrack] = useState<any>(null);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                if (!authLoading) window.location.href = '/api/auth/discord/login';
                return;
            }
            setLoading(true);
            try {
                const [profileRes, genresRes] = await Promise.all([
                    axios.get(`/api/musician/profile/${user.id}`, { withCredentials: true }),
                    axios.get('/api/musician/genres', { withCredentials: true })
                ]);
                const data = profileRes.data;
                if (data?.tracks) setTracks(data.tracks);
                if (data?.username) setUsername(data.username);
                setAllGenres(genresRes.data);
            } catch (err: any) {
                if (err.response?.status === 404) {
                    navigate('/profile/setup', { replace: true });
                } else {
                    setMessage({ type: 'error', text: 'Failed to load tracks' });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.id, authLoading]);

    const handleAddTrack = async () => {
        if (!audioFile) {
            setMessage({ type: 'error', text: 'Please select an audio file' });
            return;
        }
        if (audioFile.size > 300 * 1024 * 1024) {
            setMessage({ type: 'error', text: `File "${audioFile.name}" is ${(audioFile.size / 1024 / 1024).toFixed(1)}MB — max allowed is 300MB.` });
            return;
        }

        const formData = new FormData();
        formData.append('audio', audioFile);
        if (artworkFile) formData.append('artwork', artworkFile);
        if (projectFile) formData.append('project', projectFile);
        if (newTrack.title) formData.append('title', newTrack.title);
        if (newTrack.description) formData.append('description', newTrack.description);
        if (newTrack.artist) formData.append('artist', newTrack.artist);
        if (newTrack.album) formData.append('album', newTrack.album);
        if (newTrack.year) formData.append('year', newTrack.year);
        if (newTrack.bpm) formData.append('bpm', newTrack.bpm);
        if (newTrack.key) formData.append('key', newTrack.key);
        formData.append('allowAudioDownload', String(newTrack.allowAudioDownload));
        formData.append('allowProjectDownload', String(newTrack.allowProjectDownload));
        if (selectedTrackGenres.length > 0) formData.append('genreIds', JSON.stringify(selectedTrackGenres));

        setSaving(true);
        setUploadProgress(0);
        setUploadStage('uploading');
        let scanTimer: ReturnType<typeof setTimeout> | null = null;
        try {
            const res = await axios.post('/api/musician/tracks', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
                onUploadProgress: (evt) => {
                    if (evt.total) {
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        setUploadProgress(pct);
                        if (pct >= 100) {
                            setUploadStage('scanning');
                            // After ~4s advance to "converting" stage label
                            scanTimer = setTimeout(() => setUploadStage('converting'), 4000);
                        }
                    }
                },
            });
            setTracks([...tracks, res.data]);
            setIsAddingTrack(false);
            setNewTrack({ title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '', allowAudioDownload: true, allowProjectDownload: true });
            setAudioFile(null); setArtworkFile(null); setProjectFile(null);
            setSelectedTrackGenres([]); setTosAgreed(false);
            setMessage({ type: 'success', text: 'Track uploaded successfully!' });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || e.message || 'Failed to upload track.' });
        } finally {
            if (scanTimer) clearTimeout(scanTimer);
            setSaving(false);
            setUploadStage(null);
            setUploadProgress(0);
        }
    };

    const handleDeleteTrack = async (trackId: string) => {
        const track = tracks.find(t => t.id === trackId);
        setDeleteConfirm({ trackId, title: track?.title || 'this track' });
    };

    const confirmDeleteTrack = async (trackId: string) => {
        setDeleteConfirm(null);
        try {
            await axios.delete(`/api/musician/tracks/${trackId}`, { withCredentials: true });
            setTracks(tracks.filter(t => t.id !== trackId));
            setMessage({ type: 'success', text: 'Track deleted' });
        } catch {
            setMessage({ type: 'error', text: 'Failed to delete track' });
        }
    };

    const handleUpdateTrack = async () => {
        if (!editingTrack) return;
        setSaving(true);
        try {
            const formData = new FormData();
            if (audioFile) formData.append('audio', audioFile);
            if (artworkFile) formData.append('artwork', artworkFile);
            if (projectFile) formData.append('project', projectFile);
            formData.append('title', editingTrack.title || '');
            formData.append('description', editingTrack.description || '');
            formData.append('artist', editingTrack.artist || '');
            formData.append('album', editingTrack.album || '');
            formData.append('year', editingTrack.year || '');
            formData.append('bpm', editingTrack.bpm || '');
            formData.append('key', editingTrack.key || '');
            formData.append('allowAudioDownload', String(editingTrack.allowAudioDownload ?? true));
            formData.append('allowProjectDownload', String(editingTrack.allowProjectDownload ?? true));
            formData.append('genreIds', JSON.stringify(selectedTrackGenres));

            const res = await axios.put(`/api/musician/tracks/${editingTrack.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            setTracks(tracks.map(t => t.id === editingTrack.id ? res.data : t));
            setEditingTrack(null);
            setAudioFile(null); setArtworkFile(null); setProjectFile(null);
            setSelectedTrackGenres([]);
            setMessage({ type: 'success', text: 'Track updated successfully!' });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to update track' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStream = async (track: any) => {
        try {
            const res = await axios.patch(`/api/musician/tracks/${track.id}`, { isPublic: !track.isPublic }, { withCredentials: true });
            setTracks(tracks.map(t => t.id === track.id ? res.data : t));
        } catch {
            setMessage({ type: 'error', text: 'Failed to update track visibility' });
        }
    };

    if (loading || authLoading) return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading tracks...</div>
        </DiscoveryLayout>
    );

    if (!user) {
        return (
            <DiscoveryLayout activeTab="profile">
                <div style={{ textAlign: 'center', padding: '100px', color: colors.textPrimary }}>
                    <User size={64} color={colors.primary} style={{ marginBottom: spacing.xl, opacity: 0.5 }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Authentication Required</h2>
                    <p style={{ color: colors.textSecondary, marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                        You need to be logged in to manage your tracks.
                    </p>
                    <button onClick={() => window.location.href = '/api/auth/discord/login'}
                        style={{ backgroundColor: colors.primary, color: 'white', border: 'none', padding: '12px 32px', borderRadius: borderRadius.md, fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >Login with Discord</button>
                </div>
            </DiscoveryLayout>
        );
    }

    const inputStyle = { width: '100%', boxSizing: 'border-box' as const, backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary };

    const renderGenreTagPicker = (selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>, searchVal: string, setSearchVal: React.Dispatch<React.SetStateAction<string>>) => (
        <div style={{ marginTop: spacing.sm }}>
            <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={14} /> Genre Tags
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                {selected.map(gId => {
                    const genre = allGenres.find(g => g.id === gId);
                    return genre ? (
                        <span key={gId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: colors.primary, padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', color: 'white' }}>
                            {genre.name}
                            <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelected(prev => prev.filter(id => id !== gId))} />
                        </span>
                    ) : null;
                })}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input type="text" placeholder="Search genres..." value={searchVal} onChange={e => setSearchVal(e.target.value)}
                    style={{ flex: 1, backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 12px', color: 'white', fontSize: '0.85rem' }} />
                <select value="" onChange={e => { if (e.target.value && !selected.includes(e.target.value)) { setSelected(prev => [...prev, e.target.value]); setSearchVal(''); } }}
                    style={{ flex: 1, boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}>
                    <option value="" style={{ color: 'white', backgroundColor: '#1A1E2E' }}>Add a genre tag...</option>
                    {allGenres.filter(g => !selected.includes(g.id)).filter(g => g.name.toLowerCase().includes(searchVal.toLowerCase())).map(g => (
                        <option key={g.id} value={g.id} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{g.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
        <option key={`${note} Major`} value={`${note} Major`} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{note} Major</option>,
        <option key={`${note} Minor`} value={`${note} Minor`} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{note} Minor</option>
    ]);

    return (
        <>
        <DiscoveryLayout activeTab="profile">
        <div style={{ padding: spacing.lg, maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <Link to="/profile" style={{ color: colors.textSecondary, display: 'flex' }}>
                    <ArrowLeft size={24} />
                </Link>
                <Upload size={32} color={colors.primary} style={{ marginRight: '4px' }} />
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <h1 style={{ margin: 0 }}>My Tracks</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Upload, manage, and organize your music.</p>
                </div>
            </div>

            {message && (
                <div style={{ 
                    padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
                    backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: message.type === 'success' ? '#4caf50' : '#f44336',
                    border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`
                }}>{message.text}</div>
            )}

            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={20} /> My Tracks ({tracks.length})
                </h3>
                
                {/* Track List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.md }}>
                    {tracks.length === 0 && (
                        <p style={{ color: colors.textSecondary, fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                            No tracks uploaded yet. Show off your work!
                        </p>
                    )}
                    {tracks.map(track => (
                        <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm }}>
                            {track.coverUrl ? (
                                <img src={track.coverUrl} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={20} color={colors.textSecondary} />
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{track.title}</div>
                                <div style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{track.playCount || 0} plays • {track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
                                    {track.slug && (
                                        <a href={`/profile/${username || user?.username}/${track.slug}`} target="_blank" rel="noopener noreferrer"
                                            style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', color: colors.textSecondary, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            View Page <ExternalLink size={10} />
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => { setEditingTrack(track); setIsAddingTrack(false); setSelectedTrackGenres(track.genres?.map((g: any) => g.genreId) || []); }}
                                    style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', display: 'flex' }} title="Edit Track">
                                    <Edit3 size={18} />
                                </button>
                                <button onClick={() => handleToggleStream(track)}
                                    style={{ background: 'none', border: 'none', color: track.isPublic ? colors.primary : colors.textSecondary, cursor: 'pointer', display: 'flex' }} title={track.isPublic ? "Public" : "Private"}>
                                    <Globe size={18} />
                                </button>
                                <button onClick={() => handleDeleteTrack(track.id)} aria-label={`Delete track: ${track.title}`}
                                    style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', display: 'flex' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Edit Track Form */}
                {editingTrack ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.sm }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Editing: {editingTrack.title}</div>
                            <button onClick={() => setEditingTrack(null)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={18}/></button>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px' }}>Replace Audio (Optional)</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer', color: audioFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem' }}>
                            <FileAudio size={18} color={audioFile ? colors.primary : colors.textSecondary} />
                            {audioFile ? audioFile.name : 'Keep existing or choose new file...'}
                            <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                        </label>
                        
                        <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', marginTop: '8px' }}>Replace Artwork (Optional)</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer', color: artworkFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem' }}>
                            <ImageIcon size={18} color={artworkFile ? colors.primary : colors.textSecondary} />
                            {artworkFile ? artworkFile.name : 'Keep existing or choose new image...'}
                            <input type="file" accept="image/*" onChange={e => setArtworkFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginTop: spacing.sm }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Track Title</label>
                                <input type="text" value={editingTrack.title || ''} onChange={e => setEditingTrack({...editingTrack, title: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Artist</label>
                                <input type="text" value={editingTrack.artist || ''} onChange={e => setEditingTrack({...editingTrack, artist: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Album</label>
                                <input type="text" value={editingTrack.album || ''} onChange={e => setEditingTrack({...editingTrack, album: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>BPM</label>
                                <input type="number" value={editingTrack.bpm || ''} onChange={e => setEditingTrack({...editingTrack, bpm: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Key</label>
                                <select value={editingTrack.key || ''} onChange={e => setEditingTrack({...editingTrack, key: e.target.value})} style={inputStyle}>
                                    <option value="" style={{ color: 'white', backgroundColor: '#1A1E2E' }}>Select key...</option>
                                    {keyOptions}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: colors.textSecondary }}>Download Settings</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input type="checkbox" checked={editingTrack.allowAudioDownload ?? true} onChange={e => setEditingTrack({...editingTrack, allowAudioDownload: e.target.checked})} />
                                    Allow users to download audio file
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input type="checkbox" checked={editingTrack.allowProjectDownload ?? true} onChange={e => setEditingTrack({...editingTrack, allowProjectDownload: e.target.checked})} />
                                    Allow users to download .flp project & ZIP loop package
                                </label>
                            </div>
                        </div>

                        {renderGenreTagPicker(selectedTrackGenres, setSelectedTrackGenres, genreSearchTerm, setGenreSearchTerm)}

                        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                            <button onClick={handleUpdateTrack} disabled={saving}
                                style={{ flex: 1, padding: '10px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={() => { setEditingTrack(null); setSelectedTrackGenres([]); }}
                                style={{ flex: 1, padding: '10px', background: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>

                ) : isAddingTrack ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.sm }}>
                        {/* Audio File */}
                        <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px' }}>Audio File (MP3/WAV/etc) *</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer', color: audioFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                            <FileAudio size={18} color={audioFile ? colors.primary : colors.textSecondary} />
                            {audioFile ? `${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)` : 'Choose audio file...'}
                            <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                        </label>
                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary, paddingLeft: '2px' }}>Supported: MP3, WAV, FLAC, OGG, AAC &mdash; max 300MB. Large WAV files will be auto-converted to 320kbps MP3.</div>
                        
                        {/* Artwork */}
                        <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', marginTop: '8px' }}>Artwork (Optional)</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer', color: artworkFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                            <ImageIcon size={18} color={artworkFile ? colors.primary : colors.textSecondary} />
                            {artworkFile ? artworkFile.name : 'Choose artwork image...'}
                            <input type="file" accept="image/*" onChange={e => setArtworkFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                        </label>

                        {/* FL Studio Project */}
                        <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', marginTop: '8px' }}>FL Studio Project (Optional)</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${projectFile ? colors.primary : 'rgba(255,255,255,0.1)'}`, borderRadius: borderRadius.sm, cursor: 'pointer', color: projectFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                            <Music size={18} color={projectFile ? colors.primary : colors.textSecondary} />
                            {projectFile ? projectFile.name : 'Attach .flp project or .zip bundle...'}
                            <input type="file" accept=".flp,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                        </label>
                        {projectFile?.name.endsWith('.zip') && (
                            <p style={{ margin: '4px 0 0 2px', fontSize: '0.78rem', color: colors.textSecondary }}>
                                ZIP bundles are processed server-side to extract real waveforms from your samples.
                            </p>
                        )}

                        {/* Track Metadata */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginTop: spacing.sm }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Track Title</label>
                                <input type="text" placeholder="Will use metadata/filename if empty" value={newTrack.title} onChange={e => setNewTrack({...newTrack, title: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Artist</label>
                                <input type="text" placeholder="Artist name" value={newTrack.artist} onChange={e => setNewTrack({...newTrack, artist: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Album</label>
                                <input type="text" placeholder="Album / EP name" value={newTrack.album} onChange={e => setNewTrack({...newTrack, album: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Year</label>
                                <input type="number" placeholder="2025" value={newTrack.year} onChange={e => setNewTrack({...newTrack, year: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>BPM</label>
                                <input type="number" placeholder="120" value={newTrack.bpm} onChange={e => setNewTrack({...newTrack, bpm: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Key</label>
                                <select value={newTrack.key} onChange={e => setNewTrack({...newTrack, key: e.target.value})} style={inputStyle}>
                                    <option value="">Select key...</option>
                                    {keyOptions}
                                </select>
                            </div>
                        </div>

                        {/* Download Permissions */}
                        <div style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: colors.textSecondary }}>Download Permissions</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input type="checkbox" checked={newTrack.allowAudioDownload} onChange={e => setNewTrack({...newTrack, allowAudioDownload: e.target.checked})} />
                                    Public: Allow Audio Download
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input type="checkbox" checked={newTrack.allowProjectDownload} onChange={e => setNewTrack({...newTrack, allowProjectDownload: e.target.checked})} />
                                    Allow .flp project & ZIP loop package download
                                </label>
                            </div>
                        </div>

                        {/* Description */}
                        <div style={{ marginTop: spacing.sm }}>
                            <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Description</label>
                            <textarea placeholder="Notes about this track..." value={newTrack.description} onChange={e => setNewTrack({...newTrack, description: e.target.value})}
                                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, minHeight: '60px', resize: 'vertical' }} />
                        </div>

                        {renderGenreTagPicker(selectedTrackGenres, setSelectedTrackGenres, addGenreSearchTerm, setAddGenreSearchTerm)}

                        {/* ToS Agreement */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.07)', marginTop: spacing.sm }}>
                            <input type="checkbox" id="tos-agree" checked={tosAgreed} onChange={e => setTosAgreed(e.target.checked)}
                                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: colors.primary }} />
                            <label htmlFor="tos-agree" style={{ fontSize: '13px', color: colors.textSecondary, cursor: 'pointer', lineHeight: 1.5 }}>
                                I confirm I own or have the rights to all audio and content in this upload, and I agree to the{' '}
                                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'underline' }}>
                                    Terms of Service &amp; Privacy Policy
                                </a>.
                            </label>
                        </div>

                        {/* Upload progress */}
                        {saving && uploadStage && (
                            <div style={{ marginTop: spacing.sm, padding: '12px', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: borderRadius.sm }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.primary }}>
                                        {uploadStage === 'uploading' && `Uploading… ${uploadProgress}%`}
                                        {uploadStage === 'scanning' && '🔍 Scanning for viruses…'}
                                        {uploadStage === 'converting' && '⚙️ Converting & processing…'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                                        {uploadStage === 'uploading' ? 'Transferring file to server' : uploadStage === 'scanning' ? 'Takes a few seconds' : 'Audio conversion + waveform extraction'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        backgroundColor: colors.primary,
                                        borderRadius: '3px',
                                        transition: 'width 0.3s ease',
                                        width: uploadStage === 'uploading' ? `${uploadProgress}%`
                                            : uploadStage === 'scanning' ? '100%'
                                            : '100%',
                                        opacity: uploadStage !== 'uploading' ? 0.6 : 1,
                                        backgroundImage: uploadStage !== 'uploading' ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)' : 'none',
                                        animation: uploadStage !== 'uploading' ? 'stripe-slide 1s linear infinite' : 'none',
                                    }} />
                                </div>
                                <style>{`@keyframes stripe-slide { 0% { background-position: 0 0; } 100% { background-position: 32px 0; } }`}</style>
                            </div>
                        )}

                        {/* Submit */}
                        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                            <button onClick={handleAddTrack} disabled={saving || !audioFile || !tosAgreed}
                                style={{ flex: 1, padding: '10px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, cursor: (saving || !audioFile || !tosAgreed) ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: (saving || !audioFile || !tosAgreed) ? 0.7 : 1 }}>
                                {saving ? '...' : 'Upload Track'}
                            </button>
                            <button onClick={() => { setIsAddingTrack(false); setSelectedTrackGenres([]); setAddGenreSearchTerm(''); setTosAgreed(false); }}
                                style={{ flex: 1, padding: '10px', background: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                ) : !isGuildMember ? (
                    <div style={{ padding: '20px', backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: borderRadius.sm, textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px', color: colors.textPrimary, fontWeight: 600 }}>Discord Server Membership Required</p>
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>You must be a member of our Discord server to upload tracks.</p>
                        <a href="https://discord.gg/flstudio" target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', backgroundColor: '#5865F2', color: 'white', borderRadius: borderRadius.sm, textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>
                            Join Discord Server
                        </a>
                    </div>
                ) : (
                    <button onClick={() => setIsAddingTrack(true)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textSecondary, cursor: 'pointer' }}>
                        <Plus size={16}/> Add Track
                    </button>
                )}
            </div>
        </div>
        </DiscoveryLayout>
        <ConfirmModal
            open={!!deleteConfirm}
            title="Delete Track"
            message={`Are you sure you want to delete "${deleteConfirm?.title}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            onConfirm={() => deleteConfirm && confirmDeleteTrack(deleteConfirm.trackId)}
            onCancel={() => setDeleteConfirm(null)}
        />
        </>
    );
};
