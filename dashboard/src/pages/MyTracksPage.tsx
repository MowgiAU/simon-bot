import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import {
    Music, Plus, X, ExternalLink, ArrowLeft, Tag, FileAudio,
    Image as ImageIcon, Edit3, Upload, Trash2, Eye, EyeOff, Clock,
    BarChart3, AlertCircle, Check, Save
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

/* ─── shared styles ─── */
const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    padding: '24px',
};

const label: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: colors.textSecondary,
    marginBottom: '6px',
    display: 'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
};

const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: borderRadius.sm,
    padding: '10px 12px',
    color: colors.textPrimary,
    fontSize: '14px',
    outline: 'none',
};

const fileZone: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
};

const fileZoneActive: React.CSSProperties = {
    ...fileZone,
    borderColor: colors.primary,
    borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.04)',
};

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
    const [uploadProgress, setUploadProgress] = useState(0);
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

    const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
        <option key={`${note} Major`} value={`${note} Major`} style={{ backgroundColor: colors.surface }}>{note} Major</option>,
        <option key={`${note} Minor`} value={`${note} Minor`} style={{ backgroundColor: colors.surface }}>{note} Minor</option>
    ]);

    const renderGenreTagPicker = (selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>, searchVal: string, setSearchVal: React.Dispatch<React.SetStateAction<string>>) => (
        <div>
            <span style={label}><Tag size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Genre Tags</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', minHeight: '28px' }}>
                {selected.length === 0 && (
                    <span style={{ fontSize: '12px', color: colors.textTertiary, fontStyle: 'italic' }}>No genres selected</span>
                )}
                {selected.map(gId => {
                    const genre = allGenres.find(g => g.id === gId);
                    return genre ? (
                        <span key={gId} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            backgroundColor: 'rgba(16,185,129,0.12)', padding: '3px 10px',
                            borderRadius: borderRadius.pill, fontSize: '12px', color: colors.primary, fontWeight: 500,
                        }}>
                            {genre.name}
                            <X size={11} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setSelected(prev => prev.filter(id => id !== gId))} />
                        </span>
                    ) : null;
                })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="Search genres..." value={searchVal} onChange={e => setSearchVal(e.target.value)}
                    style={{ ...inputBase, flex: 1 }} />
                <select value="" onChange={e => { if (e.target.value && !selected.includes(e.target.value)) { setSelected(prev => [...prev, e.target.value]); setSearchVal(''); } }}
                    style={{ ...inputBase, flex: 1, cursor: 'pointer' }}>
                    <option value="" style={{ backgroundColor: colors.surface }}>Add genre...</option>
                    {allGenres.filter(g => !selected.includes(g.id)).filter(g => g.name.toLowerCase().includes(searchVal.toLowerCase())).map(g => (
                        <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface }}>{g.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    /* ─── Upload / Edit form (shared layout) ─── */
    const renderTrackForm = (isEdit: boolean) => {
        const track = isEdit ? editingTrack : newTrack;
        const setField = (field: string, value: any) => {
            if (isEdit) setEditingTrack({ ...editingTrack, [field]: value });
            else setNewTrack({ ...newTrack, [field]: value });
        };

        return (
            <div style={{ ...card, marginBottom: '24px', borderColor: colors.primary, borderWidth: '1px' }}>
                {/* Form header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isEdit ? <Edit3 size={20} color={colors.primary} /> : <Upload size={20} color={colors.primary} />}
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                {isEdit ? `Editing: ${editingTrack?.title}` : 'Upload New Track'}
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textTertiary }}>
                                {isEdit ? 'Update track details and files' : 'Share your music with the community'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { if (isEdit) { setEditingTrack(null); setSelectedTrackGenres([]); } else { setIsAddingTrack(false); setSelectedTrackGenres([]); setAddGenreSearchTerm(''); setTosAgreed(false); } }}
                        style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* ── File upload zones ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    {/* Audio */}
                    <label style={audioFile ? fileZoneActive : fileZone}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: borderRadius.md,
                            backgroundColor: audioFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <FileAudio size={20} color={audioFile ? colors.primary : colors.textTertiary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                                {isEdit ? 'Replace Audio' : 'Audio File *'}
                            </div>
                            <div style={{ fontSize: '11px', color: audioFile ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {audioFile ? `${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)` : (isEdit ? 'Keep existing' : 'MP3, WAV, FLAC, OGG')}
                            </div>
                        </div>
                        <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>

                    {/* Artwork */}
                    <label style={artworkFile ? fileZoneActive : fileZone}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: borderRadius.md,
                            backgroundColor: artworkFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <ImageIcon size={20} color={artworkFile ? colors.primary : colors.textTertiary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                                {isEdit ? 'Replace Art' : 'Artwork'}
                            </div>
                            <div style={{ fontSize: '11px', color: artworkFile ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {artworkFile ? artworkFile.name : (isEdit ? 'Keep existing' : 'JPG, PNG, WEBP')}
                            </div>
                        </div>
                        <input type="file" accept="image/*" onChange={e => setArtworkFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>

                    {/* Project file */}
                    <label style={projectFile ? fileZoneActive : fileZone}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: borderRadius.md,
                            backgroundColor: projectFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <Music size={20} color={projectFile ? colors.primary : colors.textTertiary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                                {isEdit ? 'Replace Project' : 'FL Studio Project'}
                            </div>
                            <div style={{ fontSize: '11px', color: projectFile ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {projectFile ? projectFile.name : (isEdit ? 'Keep existing' : '.flp or .zip bundle')}
                            </div>
                        </div>
                        <input type="file" accept=".flp,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>
                </div>

                {!isEdit && audioFile && (
                    <p style={{ margin: '-8px 0 16px', fontSize: '11px', color: colors.textTertiary }}>
                        Max 300MB. Large WAV files will be auto-converted to 320kbps MP3.
                    </p>
                )}

                {projectFile?.name.endsWith('.zip') && (
                    <p style={{ margin: '-8px 0 16px', fontSize: '11px', color: colors.textTertiary }}>
                        ZIP bundles are processed server-side to extract real waveforms from your samples.
                    </p>
                )}

                {/* ── Metadata grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
                        <span style={label}>Track Title</span>
                        <input type="text" placeholder={isEdit ? '' : 'Will use metadata/filename if empty'} value={track.title || ''} onChange={e => setField('title', e.target.value)} style={inputBase} />
                    </div>
                    <div>
                        <span style={label}>Artist</span>
                        <input type="text" placeholder="Artist name" value={track.artist || ''} onChange={e => setField('artist', e.target.value)} style={inputBase} />
                    </div>
                    <div>
                        <span style={label}>Album</span>
                        <input type="text" placeholder="Album / EP" value={track.album || ''} onChange={e => setField('album', e.target.value)} style={inputBase} />
                    </div>
                    {!isEdit && (
                        <div>
                            <span style={label}>Year</span>
                            <input type="number" placeholder="2025" value={track.year || ''} onChange={e => setField('year', e.target.value)} style={inputBase} />
                        </div>
                    )}
                    <div>
                        <span style={label}>BPM</span>
                        <input type="number" placeholder="120" value={track.bpm || ''} onChange={e => setField('bpm', e.target.value)} style={inputBase} />
                    </div>
                    <div>
                        <span style={label}>Key</span>
                        <select value={track.key || ''} onChange={e => setField('key', e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                            <option value="" style={{ backgroundColor: colors.surface }}>Select key...</option>
                            {keyOptions}
                        </select>
                    </div>
                </div>

                {/* ── Description ── */}
                <div style={{ marginBottom: '20px' }}>
                    <span style={label}>Description</span>
                    <textarea placeholder="Notes about this track..." value={track.description || ''} onChange={e => setField('description', e.target.value)}
                        style={{ ...inputBase, minHeight: '60px', resize: 'vertical' }} />
                </div>

                {/* ── Download permissions ── */}
                <div style={{
                    display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px',
                    padding: '14px 16px', borderRadius: borderRadius.md,
                    backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '20px',
                }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '110px', paddingTop: '2px' }}>
                        Downloads
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: colors.textPrimary }}>
                        <input type="checkbox" checked={track.allowAudioDownload ?? true} onChange={e => setField('allowAudioDownload', e.target.checked)}
                            style={{ accentColor: colors.primary, width: '16px', height: '16px' }} />
                        Allow audio download
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: colors.textPrimary }}>
                        <input type="checkbox" checked={track.allowProjectDownload ?? true} onChange={e => setField('allowProjectDownload', e.target.checked)}
                            style={{ accentColor: colors.primary, width: '16px', height: '16px' }} />
                        Allow project download
                    </label>
                </div>

                {/* ── Genres ── */}
                <div style={{ marginBottom: '20px' }}>
                    {renderGenreTagPicker(
                        selectedTrackGenres, setSelectedTrackGenres,
                        isEdit ? genreSearchTerm : addGenreSearchTerm,
                        isEdit ? setGenreSearchTerm : setAddGenreSearchTerm
                    )}
                </div>

                {/* ── ToS (add only) ── */}
                {!isEdit && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '14px 16px', borderRadius: borderRadius.md,
                        backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        marginBottom: '20px',
                    }}>
                        <input type="checkbox" id="tos-agree" checked={tosAgreed} onChange={e => setTosAgreed(e.target.checked)}
                            style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: colors.primary }} />
                        <label htmlFor="tos-agree" style={{ fontSize: '12px', color: colors.textSecondary, cursor: 'pointer', lineHeight: 1.6 }}>
                            I confirm I own or have the rights to all audio and content in this upload, and I agree to the{' '}
                            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'underline' }}>
                                Terms of Service &amp; Privacy Policy
                            </a>.
                        </label>
                    </div>
                )}

                {/* ── Upload progress ── */}
                {saving && uploadStage && (
                    <div style={{
                        marginBottom: '20px', padding: '14px 16px',
                        backgroundColor: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.2)`,
                        borderRadius: borderRadius.md,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                                {uploadStage === 'uploading' && `Uploading\u2026 ${uploadProgress}%`}
                                {uploadStage === 'scanning' && 'Scanning for viruses\u2026'}
                                {uploadStage === 'converting' && 'Converting & processing\u2026'}
                            </span>
                            <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                                {uploadStage === 'uploading' ? 'Transferring' : uploadStage === 'scanning' ? 'A few seconds' : 'Audio conversion'}
                            </span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', backgroundColor: colors.primary, borderRadius: '2px',
                                transition: 'width 0.3s ease',
                                width: uploadStage === 'uploading' ? `${uploadProgress}%` : '100%',
                                opacity: uploadStage !== 'uploading' ? 0.6 : 1,
                                backgroundImage: uploadStage !== 'uploading' ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)' : 'none',
                                animation: uploadStage !== 'uploading' ? 'stripe-slide 1s linear infinite' : 'none',
                            }} />
                        </div>
                        <style>{`@keyframes stripe-slide { 0% { background-position: 0 0; } 100% { background-position: 32px 0; } }`}</style>
                    </div>
                )}

                {/* ── Action buttons ── */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={isEdit ? handleUpdateTrack : handleAddTrack}
                        disabled={saving || (!isEdit && (!audioFile || !tosAgreed))}
                        style={{
                            flex: 1, padding: '12px', backgroundColor: colors.primary, color: 'white',
                            border: 'none', borderRadius: borderRadius.md, cursor: (saving || (!isEdit && (!audioFile || !tosAgreed))) ? 'not-allowed' : 'pointer',
                            fontWeight: 700, fontSize: '14px', opacity: (saving || (!isEdit && (!audioFile || !tosAgreed))) ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            boxShadow: shadows.glow,
                        }}
                    >
                        {saving ? 'Processing...' : isEdit ? <><Save size={16} /> Save Changes</> : <><Upload size={16} /> Upload Track</>}
                    </button>
                    <button
                        onClick={() => { if (isEdit) { setEditingTrack(null); setSelectedTrackGenres([]); } else { setIsAddingTrack(false); setSelectedTrackGenres([]); setAddGenreSearchTerm(''); setTosAgreed(false); } }}
                        style={{
                            padding: '12px 24px', backgroundColor: 'transparent', color: colors.textSecondary,
                            border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.md, cursor: 'pointer',
                            fontSize: '14px',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    /* ─── Track card component ─── */
    const renderTrackCard = (track: any) => {
        const isEditing = editingTrack?.id === track.id;
        const duration = track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '--:--';

        return (
            <div key={track.id} style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                border: `1px solid ${isEditing ? colors.primary : colors.glassBorder}`,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
            }}>
                <div style={{ display: 'flex', gap: '16px', padding: '16px', alignItems: 'center' }}>
                    {/* Cover art */}
                    <div style={{
                        width: isMobile ? '56px' : '64px', height: isMobile ? '56px' : '64px',
                        borderRadius: borderRadius.md, overflow: 'hidden', flexShrink: 0,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                    }}>
                        {track.coverUrl ? (
                            <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Music size={24} color={colors.textTertiary} />
                            </div>
                        )}
                    </div>

                    {/* Track info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                            {track.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> {duration}
                            </span>
                            <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <BarChart3 size={12} /> {track.playCount || 0} plays
                            </span>
                            <span style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: borderRadius.pill,
                                backgroundColor: track.isPublic ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                                color: track.isPublic ? colors.primary : colors.textTertiary,
                                fontWeight: 500,
                            }}>
                                {track.isPublic ? 'Public' : 'Private'}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {track.slug && (
                            <a href={`/profile/${username || user?.username}/${track.slug}`} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: borderRadius.sm, color: colors.textTertiary, textDecoration: 'none', border: `1px solid ${colors.glassBorder}` }}
                                title="View page">
                                <ExternalLink size={15} />
                            </a>
                        )}
                        <button onClick={() => { setEditingTrack(track); setIsAddingTrack(false); setSelectedTrackGenres(track.genres?.map((g: any) => g.genreId) || []); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: borderRadius.sm, background: 'none', border: `1px solid ${colors.glassBorder}`, color: colors.primary, cursor: 'pointer' }}
                            title="Edit track">
                            <Edit3 size={15} />
                        </button>
                        <button onClick={() => handleToggleStream(track)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: borderRadius.sm, background: 'none', border: `1px solid ${colors.glassBorder}`, color: track.isPublic ? colors.primary : colors.textTertiary, cursor: 'pointer' }}
                            title={track.isPublic ? 'Make private' : 'Make public'}>
                            {track.isPublic ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button onClick={() => handleDeleteTrack(track.id)} aria-label={`Delete track: ${track.title}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: borderRadius.sm, background: 'none', border: `1px solid rgba(239,68,68,0.2)`, color: colors.error, cursor: 'pointer' }}>
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
        <DiscoveryLayout activeTab="profile">
        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '1100px', margin: '0 auto' }}>

            {/* ── Top bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Link to="/profile" style={{ color: colors.textSecondary, display: 'flex', padding: '6px', borderRadius: borderRadius.sm }}>
                    <ArrowLeft size={20} />
                </Link>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>My Tracks</h1>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.textTertiary }}>{tracks.length} track{tracks.length !== 1 ? 's' : ''} uploaded</p>
                </div>
                {isGuildMember && !isAddingTrack && !editingTrack && (
                    <button onClick={() => setIsAddingTrack(true)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                        backgroundColor: colors.primary, color: 'white', border: 'none',
                        borderRadius: borderRadius.md, cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                        boxShadow: shadows.glow,
                    }}>
                        <Plus size={16} /> Upload Track
                    </button>
                )}
            </div>

            {/* ── Toast ── */}
            {message && (
                <div style={{
                    padding: '12px 16px', borderRadius: borderRadius.md, marginBottom: '20px',
                    backgroundColor: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: message.type === 'success' ? colors.success : colors.error,
                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    {message.type === 'error' && <AlertCircle size={16} />}
                    {message.type === 'success' && <Check size={16} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6 }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ── Not a guild member ── */}
            {!isGuildMember && (
                <div style={{
                    ...card, textAlign: 'center', marginBottom: '24px',
                    borderColor: 'rgba(251,191,36,0.2)',
                    backgroundColor: 'rgba(251,191,36,0.04)',
                }}>
                    <p style={{ margin: '0 0 8px', color: colors.textPrimary, fontWeight: 600, fontSize: '15px' }}>Discord Server Membership Required</p>
                    <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '13px' }}>You must be a member of our Discord server to upload tracks.</p>
                    <a href="https://discord.gg/flstudio" target="_blank" rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
                            backgroundColor: '#5865F2', color: 'white', borderRadius: borderRadius.md,
                            textDecoration: 'none', fontWeight: 600, fontSize: '13px',
                        }}>
                        Join Discord Server
                    </a>
                </div>
            )}

            {/* ── Upload / Edit form ── */}
            {isAddingTrack && renderTrackForm(false)}
            {editingTrack && renderTrackForm(true)}

            {/* ── Track library ── */}
            {tracks.length === 0 ? (
                <div style={{
                    ...card, textAlign: 'center', padding: '60px 24px',
                }}>
                    <Music size={48} color={colors.textTertiary} style={{ marginBottom: '16px', opacity: 0.4 }} />
                    <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>No tracks yet</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: colors.textTertiary, maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Upload your first track to start building your portfolio and sharing your music with the community.
                    </p>
                    {isGuildMember && !isAddingTrack && (
                        <button onClick={() => setIsAddingTrack(true)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
                            backgroundColor: colors.primary, color: 'white', border: 'none',
                            borderRadius: borderRadius.md, cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                            boxShadow: shadows.glow,
                        }}>
                            <Upload size={16} /> Upload Your First Track
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tracks.map(track => renderTrackCard(track))}
                </div>
            )}
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
