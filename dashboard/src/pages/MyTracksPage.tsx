import React, { useEffect, useState, useRef, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import {
    Music, Plus, X, ExternalLink, ArrowLeft, Tag, FileAudio,
    Image as ImageIcon, Edit3, Upload, Trash2, Eye, EyeOff, Clock,
    BarChart3, AlertCircle, Check, Save, AlignLeft, Scale, CheckSquare, Square, Download,
    Users, Search, UserPlus, Mic2, GripVertical, Link as LinkIcon, RefreshCw, Disc
} from 'lucide-react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { ConfirmModal } from '../components/ConfirmModal';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';

const VALID_TITLE_REGEX = /^[a-zA-Z0-9\s\-_.,!()\[\]'"]+$/;

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

const fileZoneDragging: React.CSSProperties = {
    ...fileZone,
    borderColor: colors.primary,
    borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.1)',
    boxShadow: '0 0 0 3px rgba(16,185,129,0.15)',
};

export const MyTracksPage: React.FC = () => {
    const { user, loading: authLoading, isGuildMember } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [tracks, setTracks] = useState<any[]>([]);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ trackId: string; title: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [username, setUsername] = useState('');

    // Auto-open upload form when navigated from the floating upload button (?upload=1)
    const [isAddingTrack, setIsAddingTrack] = useState(
        () => new URLSearchParams(location.search).get('upload') === '1'
    );
    const [tosAgreed, setTosAgreed] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStage, setUploadStage] = useState<'uploading' | 'scanning' | 'converting' | null>(null);
    const [newTrack, setNewTrack] = useState({
        title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '',
        allowAudioDownload: true, allowProjectDownload: true, license: 'all-rights-reserved',
        trackType: 'original',
    });
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [artworkFile, setArtworkFile] = useState<File | null>(null);
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const [selectedTrackGenres, setSelectedTrackGenres] = useState<string[]>([]);
    const [genreSearchTerm, setGenreSearchTerm] = useState('');
    const [addGenreSearchTerm, setAddGenreSearchTerm] = useState('');

    // Lyrics state
    const [newTrackLyrics, setNewTrackLyrics] = useState('');
    const [editingTrackLyrics, setEditingTrackLyrics] = useState('');

    // Drag-and-drop state
    const [dragOver, setDragOver] = useState<'audio' | 'art' | 'project' | null>(null);

    // Artwork preview & crop state
    const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropRect, setCropRect] = useState({ x: 0, y: 0, size: 200 });
    const artworkInputRef = useRef<HTMLInputElement>(null);
    const cropImgRef = useRef<HTMLImageElement>(null);

    // Edit track state
    const [editingTrack, setEditingTrack] = useState<any>(null);

    // Collaborator state
    const [collaborators, setCollaborators] = useState<any[]>([]);
    // Collaborators staged while composing a new upload (not yet saved to DB)
    const [stagedCollabs, setStagedCollabs] = useState<{ profile: any; contribution: string; category: string }[]>([]);
    const [collabSearch, setCollabSearch] = useState('');
    const [collabSearchResults, setCollabSearchResults] = useState<any[]>([]);
    const [collabSearching, setCollabSearching] = useState(false);
    const [newCollabContribution, setNewCollabContribution] = useState('');
    const [newCollabCategory, setNewCollabCategory] = useState('collaboration');
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);

    // Drag-to-reorder state
    const [dragReorderIdx, setDragReorderIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    // Bulk selection state
    const [bulkMode, setBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkSaving, setBulkSaving] = useState(false);

    useEffect(() => {
        let _rt: ReturnType<typeof setTimeout>;
        const onResize = () => { clearTimeout(_rt); _rt = setTimeout(() => setIsMobile(window.innerWidth < 768), 150); };
        window.addEventListener('resize', onResize);
        return () => { clearTimeout(_rt); window.removeEventListener('resize', onResize); };
    }, []);

    // Cached data fetch — staleTime/gcTime set globally in QueryClient.
    // Back-navigation re-uses cache instead of showing a spinner.
    const profileQueryKey = ['musician-profile', user?.id] as const;
    const { data: profileData, error: profileError, isFetching } = useQuery({
        queryKey: profileQueryKey,
        queryFn: async () => {
            const [profileRes, genresRes] = await Promise.all([
                axios.get(`/api/musician/profile/${user!.id}`, { withCredentials: true }),
                axios.get('/api/musician/genres', { withCredentials: true }),
            ]);
            return { profile: profileRes.data, genres: genresRes.data as Genre[] };
        },
        enabled: !!user?.id && !authLoading,
    });

    useEffect(() => {
        if (profileData) {
            if (profileData.profile?.tracks) setTracks(profileData.profile.tracks);
            if (profileData.profile?.username) setUsername(profileData.profile.username);
            setAllGenres(profileData.genres);
            setLoading(false);
        }
    }, [profileData]);

    useEffect(() => {
        if (profileError) {
            if ((profileError as any)?.response?.status === 404) {
                navigate('/profile/setup', { replace: true });
            } else {
                setMessage({ type: 'error', text: 'Failed to load tracks' });
                setLoading(false);
            }
        }
    }, [profileError]);

    useEffect(() => {
        if (!user && !authLoading) window.location.href = '/api/auth/discord/login';
    }, [user, authLoading]);

    useEffect(() => { setLoading(isFetching && !profileData); }, [isFetching, profileData]);

    // Load collaborators when a track is opened for editing
    useEffect(() => {
        if (!editingTrack) { setCollaborators([]); setCollabSearch(''); setCollabSearchResults([]); return; }
        axios.get(`/api/musician/tracks/${editingTrack.id}/collaborators`, { withCredentials: true })
            .then(r => setCollaborators(r.data))
            .catch(() => {});
    }, [editingTrack?.id]);

    // Load pending collab invites on mount
    useEffect(() => {
        if (!user) return;
        axios.get('/api/musician/my-collaborations', { withCredentials: true })
            .then(r => setPendingInvites(r.data))
            .catch(() => {});
    }, [user?.id]);

    // Debounced collab artist search
    useEffect(() => {
        if (collabSearch.trim().length < 2) { setCollabSearchResults([]); return; }
        const t = setTimeout(async () => {
            setCollabSearching(true);
            try {
                const r = await axios.get(`/api/musician/profiles/search?q=${encodeURIComponent(collabSearch)}`, { withCredentials: true });
                setCollabSearchResults(r.data);
            } catch { setCollabSearchResults([]); }
            finally { setCollabSearching(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [collabSearch]);

    const handleAddCollaborator = async (profile: any, isEdit: boolean) => {
        if (!newCollabContribution.trim()) return;
        if (isEdit) {
            // Edit mode — save immediately to DB
            try {
                const r = await axios.post(`/api/musician/tracks/${editingTrack.id}/collaborators`, {
                    profileId: profile.id,
                    contribution: newCollabContribution.trim(),
                    category: newCollabCategory,
                }, { withCredentials: true });
                setCollaborators(prev => [...prev.filter(c => c.profileId !== profile.id), r.data]);
            } catch (e: any) {
                setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to add collaborator' });
            }
        } else {
            // Upload mode — stage locally; will be sent after track is created
            setStagedCollabs(prev => [
                ...prev.filter(c => c.profile.id !== profile.id),
                { profile, contribution: newCollabContribution.trim(), category: newCollabCategory },
            ]);
        }
        setCollabSearch('');
        setCollabSearchResults([]);
        setNewCollabContribution('');
    };

    const handleRemoveCollaborator = async (collaboratorId: string) => {
        if (!editingTrack) return;
        try {
            await axios.delete(`/api/musician/tracks/${editingTrack.id}/collaborators/${collaboratorId}`, { withCredentials: true });
            setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove collaborator' });
        }
    };

    const handleRespondToInvite = async (collab: any, status: 'accepted' | 'rejected') => {
        try {
            await axios.patch(`/api/musician/tracks/${collab.trackId}/collaborators/${collab.id}`, { status }, { withCredentials: true });
            setPendingInvites(prev => prev.map(c => c.id === collab.id ? { ...c, status } : c));
        } catch {
            setMessage({ type: 'error', text: 'Failed to respond to invite' });
        }
    };

    const handleDragEnd = async (reorderedTracks: any[]) => {
        setTracks(reorderedTracks);
        try {
            await axios.put('/api/musician/tracks/positions', { trackIds: reorderedTracks.map(t => t.id) }, { withCredentials: true });
        } catch {
            setMessage({ type: 'error', text: 'Failed to save track order' });
        }
    };

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
        formData.append('license', newTrack.license);
        if (newTrack.trackType) formData.append('trackType', newTrack.trackType);
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
            // Save lyrics separately if provided
            if (newTrackLyrics.trim()) {
                await axios.put(`/api/musician/tracks/${res.data.id}/lyrics`, { lyrics: newTrackLyrics.trim(), lyricsSync: null }, { withCredentials: true }).catch(() => {});
            }
            // Send collab invites for any staged collaborators
            for (const c of stagedCollabs) {
                await axios.post(`/api/musician/tracks/${res.data.id}/collaborators`, {
                    profileId: c.profile.id,
                    contribution: c.contribution,
                    category: c.category,
                }, { withCredentials: true }).catch(() => {});
            }
            setTracks([...tracks, res.data]);
            queryClient.invalidateQueries({ queryKey: profileQueryKey });
            setIsAddingTrack(false);
            setNewTrack({ title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '', allowAudioDownload: true, allowProjectDownload: true, license: 'all-rights-reserved', trackType: 'original' });
            setAudioFile(null); setArtworkFile(null); setProjectFile(null); setArtworkPreviewUrl(null);
            setSelectedTrackGenres([]); setTosAgreed(false); setNewTrackLyrics(''); setStagedCollabs([]);
            setMessage({ type: 'success', text: 'Track uploaded successfully! It may take a minute to appear on your profile.' });
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
        if (trackId === '__bulk__') {
            await bulkDelete();
            return;
        }
        try {
            await axios.delete(`/api/musician/tracks/${trackId}`, { withCredentials: true });
            setTracks(tracks.filter(t => t.id !== trackId));
            queryClient.invalidateQueries({ queryKey: profileQueryKey });
            setMessage({ type: 'success', text: 'Track deleted' });
        } catch (e: any) {
            const serverMsg = e?.response?.data?.error;
            setMessage({ type: 'error', text: serverMsg || 'Failed to delete track' });
        }
    };

    const handleUpdateTrack = async () => {
        if (!editingTrack) return;
        setSaving(true);
        setUploadProgress(0);
        setUploadStage(audioFile ? 'uploading' : 'converting'); // show bar for all saves
        let scanTimer: ReturnType<typeof setTimeout> | null = null;
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
            formData.append('license', editingTrack.license || 'all-rights-reserved');
            formData.append('trackType', editingTrack.trackType || 'original');
            if (editingTrack.customSlug?.trim()) formData.append('slug', editingTrack.customSlug.trim());
            formData.append('genreIds', JSON.stringify(selectedTrackGenres));

            const res = await axios.put(`/api/musician/tracks/${editingTrack.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
                onUploadProgress: audioFile ? (evt) => {
                    if (evt.total) {
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        setUploadProgress(pct);
                        if (pct >= 100) {
                            setUploadStage('scanning');
                            scanTimer = setTimeout(() => setUploadStage('converting'), 4000);
                        }
                    }
                } : undefined,
            });
            // Save lyrics separately
            await axios.put(`/api/musician/tracks/${editingTrack.id}/lyrics`, { lyrics: editingTrackLyrics.trim() || null, lyricsSync: null }, { withCredentials: true }).catch(() => {});
            setTracks(tracks.map(t => t.id === editingTrack.id ? res.data : t));
            queryClient.invalidateQueries({ queryKey: profileQueryKey });
            setEditingTrack(null);
            setAudioFile(null); setArtworkFile(null); setProjectFile(null); setArtworkPreviewUrl(null);
            setSelectedTrackGenres([]); setEditingTrackLyrics('');
            setMessage({ type: 'success', text: 'Track updated successfully!' });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to update track' });
        } finally {
            if (scanTimer) clearTimeout(scanTimer);
            setSaving(false);
            setUploadStage(null);
            setUploadProgress(0);
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

    /* ─── Bulk helpers ─── */
    const toggleSelectAll = () => {
        if (selectedIds.size === tracks.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(tracks.map(t => t.id)));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const bulkSetVisibility = async (isPublic: boolean) => {
        setBulkSaving(true);
        const ids = [...selectedIds];
        try {
            await Promise.all(ids.map(id =>
                axios.patch(`/api/musician/tracks/${id}`, { isPublic }, { withCredentials: true })
            ));
            setTracks(tracks.map(t => ids.includes(t.id) ? { ...t, isPublic } : t));
            setMessage({ type: 'success', text: `${ids.length} track${ids.length !== 1 ? 's' : ''} set to ${isPublic ? 'public' : 'private'}` });
            setSelectedIds(new Set());
            setBulkMode(false);
        } catch {
            setMessage({ type: 'error', text: 'Some tracks failed to update' });
        } finally {
            setBulkSaving(false);
        }
    };

    const bulkSetDownload = async (allowAudioDownload: boolean) => {
        setBulkSaving(true);
        const ids = [...selectedIds];
        try {
            await Promise.all(ids.map(id => {
                const track = tracks.find(t => t.id === id);
                const formData = new FormData();
                formData.append('allowAudioDownload', String(allowAudioDownload));
                formData.append('allowProjectDownload', String(track?.allowProjectDownload ?? true));
                formData.append('title', track?.title || '');
                formData.append('license', track?.license || 'all-rights-reserved');
                formData.append('genreIds', JSON.stringify(track?.genres?.map((g: any) => g.genreId) || []));
                return axios.put(`/api/musician/tracks/${id}`, formData, { withCredentials: true });
            }));
            setTracks(tracks.map(t => ids.includes(t.id) ? { ...t, allowAudioDownload } : t));
            setMessage({ type: 'success', text: `Audio download ${allowAudioDownload ? 'enabled' : 'disabled'} for ${ids.length} track${ids.length !== 1 ? 's' : ''}` });
            setSelectedIds(new Set());
            setBulkMode(false);
        } catch {
            setMessage({ type: 'error', text: 'Some tracks failed to update' });
        } finally {
            setBulkSaving(false);
        }
    };

    const bulkDelete = async () => {
        setBulkSaving(true);
        const ids = [...selectedIds];
        try {
            const results = await Promise.allSettled(ids.map(id =>
                axios.delete(`/api/musician/tracks/${id}`, { withCredentials: true })
            ));
            const deletedIds = ids.filter((_, i) => results[i].status === 'fulfilled');
            const failures = results
                .map((r, i) => ({ r, id: ids[i] }))
                .filter(x => x.r.status === 'rejected') as Array<{ r: PromiseRejectedResult; id: string }>;
            setTracks(tracks.filter(t => !deletedIds.includes(t.id)));
            if (failures.length === 0) {
                setMessage({ type: 'success', text: `${ids.length} track${ids.length !== 1 ? 's' : ''} deleted` });
            } else {
                const firstMsg = (failures[0].r.reason as any)?.response?.data?.error;
                const blockedByBattle = failures.some(f => (f.r.reason as any)?.response?.data?.code === 'TRACK_IN_BATTLE');
                const baseMsg = blockedByBattle
                    ? `${failures.length} track${failures.length !== 1 ? 's' : ''} could not be deleted because they are submitted to a Beat Battle.`
                    : firstMsg || `${failures.length} track${failures.length !== 1 ? 's' : ''} failed to delete.`;
                setMessage({ type: 'error', text: baseMsg });
            }
            setSelectedIds(new Set());
            setBulkMode(false);
        } catch {
            setMessage({ type: 'error', text: 'Some tracks failed to delete' });
        } finally {
            setBulkSaving(false);
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
                    <button onClick={() => window.location.href = '/login'}
                        style={{ backgroundColor: colors.primary, color: 'white', border: 'none', padding: '12px 32px', borderRadius: borderRadius.md, fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >Sign In</button>
                </div>
            </DiscoveryLayout>
        );
    }

    const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
        <option key={`${note} Major`} value={`${note} Major`} style={{ backgroundColor: colors.surface }}>{note} Major</option>,
        <option key={`${note} Minor`} value={`${note} Minor`} style={{ backgroundColor: colors.surface }}>{note} Minor</option>
    ]);

    const renderGenreTagPicker = (selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>, searchVal: string, setSearchVal: React.Dispatch<React.SetStateAction<string>>) => {
        const childGenres = allGenres.filter(g => g.parentId);
        const parentGenres = allGenres.filter(g => !g.parentId);
        const parentsWithChildren = parentGenres.filter(p => childGenres.some(c => c.parentId === p.id));
        const standaloneGenres = parentGenres.filter(p => !childGenres.some(c => c.parentId === p.id));
        const matchesSearch = (g: Genre) => !searchVal || g.name.toLowerCase().includes(searchVal.toLowerCase());

        return (
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
                    {/* Standalone genres (no subcategories) */}
                    {standaloneGenres.filter(g => !selected.includes(g.id) && matchesSearch(g)).map(g => (
                        <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface }}>{g.name}</option>
                    ))}
                    {/* Parent genres with children grouped in optgroups (parent itself selectable) */}
                    {parentsWithChildren.map(parent => {
                        const children = childGenres.filter(c => c.parentId === parent.id && !selected.includes(c.id) && matchesSearch(c));
                        const parentMatch = !selected.includes(parent.id) && matchesSearch(parent);
                        if (children.length === 0 && !parentMatch) return null;
                        return (
                            <optgroup key={parent.id} label={parent.name} style={{ backgroundColor: colors.surface }}>
                                {parentMatch && (
                                    <option value={parent.id} style={{ backgroundColor: colors.surface }}>All {parent.name}</option>
                                )}
                                {children.map(c => (
                                    <option key={c.id} value={c.id} style={{ backgroundColor: colors.surface }}>{c.name}</option>
                                ))}
                            </optgroup>
                        );
                    })}
                </select>
            </div>
        </div>
        );
    };

    /* ─── Artwork helpers ─── */
    const handleArtworkSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: `"${file.name}" is not an image. Please use JPG, PNG, GIF, or WEBP.` });
            return;
        }
        setArtworkFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setArtworkPreviewUrl((e.target?.result as string) ?? null);
        reader.readAsDataURL(file);
    };

    const initCropRect = () => {
        requestAnimationFrame(() => {
            const img = cropImgRef.current;
            if (!img || img.clientWidth === 0) return;
            const w = img.clientWidth;
            const h = img.clientHeight;
            const size = Math.min(w, h);
            setCropRect({ x: (w - size) / 2, y: (h - size) / 2, size });
        });
    };

    const applyCrop = () => {
        const img = cropImgRef.current;
        if (!img || !artworkPreviewUrl) return;
        const scale = img.naturalWidth / img.clientWidth;
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, cropRect.x * scale, cropRect.y * scale, cropRect.size * scale, cropRect.size * scale, 0, 0, 512, 512);
        // Use data URL for preview (avoids blob: CSP issues)
        setArtworkPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
        setShowCropModal(false);
        canvas.toBlob(blob => {
            if (!blob) return;
            setArtworkFile(new File([blob], 'artwork.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    };

    const handleCropMouseDown = (e: React.MouseEvent, corner: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
        e.preventDefault();
        e.stopPropagation();
        const startRect = { ...cropRect };
        const startX = e.clientX;
        const startY = e.clientY;

        const onMouseMove = (me: MouseEvent) => {
            const img = cropImgRef.current;
            if (!img) return;
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;
            const imgW = img.clientWidth;
            const imgH = img.clientHeight;

            if (corner === 'move') {
                setCropRect({
                    size: startRect.size,
                    x: Math.max(0, Math.min(imgW - startRect.size, startRect.x + dx)),
                    y: Math.max(0, Math.min(imgH - startRect.size, startRect.y + dy)),
                });
            } else if (corner === 'se') {
                const newSize = Math.max(50, Math.min(startRect.size + (dx + dy) / 2, Math.min(imgW - startRect.x, imgH - startRect.y)));
                setCropRect({ ...startRect, size: newSize });
            } else if (corner === 'nw') {
                const delta = -(dx + dy) / 2;
                const newSize = Math.max(50, Math.min(startRect.size + delta, Math.min(startRect.x + startRect.size, startRect.y + startRect.size)));
                setCropRect({ size: newSize, x: startRect.x + startRect.size - newSize, y: startRect.y + startRect.size - newSize });
            } else if (corner === 'ne') {
                const delta = (dx - dy) / 2;
                const newSize = Math.max(50, Math.min(startRect.size + delta, Math.min(imgW - startRect.x, startRect.y + startRect.size)));
                setCropRect({ size: newSize, x: startRect.x, y: startRect.y + startRect.size - newSize });
            } else if (corner === 'sw') {
                const delta = (-dx + dy) / 2;
                const newSize = Math.max(50, Math.min(startRect.size + delta, Math.min(startRect.x + startRect.size, imgH - startRect.y)));
                setCropRect({ size: newSize, x: startRect.x + startRect.size - newSize, y: startRect.y });
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

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

                {/* ── Save progress (shown immediately below header when saving) ── */}
                {saving && uploadStage && (
                    <div style={{ marginBottom: '16px', padding: '12px 14px', backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                                {uploadStage === 'uploading' ? `Uploading… ${uploadProgress}%` : uploadStage === 'scanning' ? 'Scanning for viruses…' : 'Saving…'}
                            </span>
                            <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                                {uploadStage === 'uploading' ? 'Transferring' : uploadStage === 'scanning' ? 'A few seconds' : 'Please wait'}
                            </span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', backgroundColor: colors.primary, borderRadius: '2px', transition: 'width 0.3s ease',
                                width: uploadStage === 'uploading' ? `${uploadProgress}%` : '100%',
                                opacity: uploadStage !== 'uploading' ? 0.6 : 1,
                                backgroundImage: uploadStage !== 'uploading' ? 'repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,0.15) 8px,rgba(255,255,255,0.15) 16px)' : 'none',
                                animation: uploadStage !== 'uploading' ? 'stripe-slide 1s linear infinite' : 'none',
                            }} />
                        </div>
                    </div>
                )}

                {/* ── File upload zones ── */}
                {/* Audio spans full width; artwork + project side-by-side below */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    {/* Audio — full width */}
                    <label
                        style={{ ...(dragOver === 'audio' ? fileZoneDragging : audioFile ? fileZoneActive : fileZone), gridColumn: isMobile ? undefined : '1 / -1' }}
                        onDragOver={e => { e.preventDefault(); setDragOver('audio'); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) setAudioFile(f); }}
                    >
                        <div style={{
                            width: '40px', height: '40px', borderRadius: borderRadius.md,
                            backgroundColor: audioFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <FileAudio size={20} color={audioFile || dragOver === 'audio' ? colors.primary : colors.textTertiary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                                {isEdit ? 'Replace Audio' : 'Audio File *'}
                            </div>
                            <div style={{ fontSize: '11px', color: audioFile ? colors.primary : dragOver === 'audio' ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {audioFile ? `${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)` : dragOver === 'audio' ? 'Drop to select' : (isEdit ? 'Drop a file or click to replace — Max 300MB' : 'Drop audio here or click — MP3, WAV, FLAC, OGG · Max 300MB')}
                            </div>
                        </div>
                        <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>

                    {/* Artwork */}
                    {artworkPreviewUrl ? (
                        <div style={{ ...fileZoneActive, alignItems: 'center' }}>
                            <img
                                src={artworkPreviewUrl}
                                alt="Artwork preview"
                                style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: borderRadius.sm, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.primary, marginBottom: '2px' }}>
                                    {isEdit ? 'Artwork ready' : 'Artwork selected'}
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {artworkFile?.name}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button type="button" onClick={() => setShowCropModal(true)}
                                    style={{ padding: '5px 10px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid ${colors.primary}`, color: colors.primary, backgroundColor: 'rgba(16,185,129,0.08)', cursor: 'pointer' }}>
                                    Crop
                                </button>
                                <button type="button" onClick={() => artworkInputRef.current?.click()}
                                    style={{ padding: '5px 10px', fontSize: '12px', borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}`, color: colors.textSecondary, backgroundColor: 'transparent', cursor: 'pointer' }}>
                                    Change
                                </button>
                                <button type="button" onClick={() => { setArtworkFile(null); setArtworkPreviewUrl(null); }}
                                    style={{ padding: '5px 8px', fontSize: '12px', borderRadius: borderRadius.sm, border: `1px solid rgba(239,68,68,0.2)`, color: colors.error, backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <X size={12} />
                                </button>
                            </div>
                            <input ref={artworkInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleArtworkSelect(f); e.target.value = ''; }} style={{ display: 'none' }} />
                        </div>
                    ) : (
                        <label
                            style={dragOver === 'art' ? fileZoneDragging : fileZone}
                            onDragOver={e => { e.preventDefault(); setDragOver('art'); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) handleArtworkSelect(f); }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: borderRadius.md,
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <ImageIcon size={20} color={dragOver === 'art' ? colors.primary : colors.textTertiary} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                                    {isEdit ? 'Replace Art' : 'Artwork'}
                                </div>
                                <div style={{ fontSize: '11px', color: dragOver === 'art' ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {dragOver === 'art' ? 'Drop to select' : (isEdit ? 'Drop or click to replace' : 'Drop image here or click — JPG, PNG, GIF, WEBP')}
                                </div>
                            </div>
                            <input ref={artworkInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleArtworkSelect(f); }} style={{ display: 'none' }} />
                        </label>
                    )}

                    {/* Project file */}
                    <label
                        style={dragOver === 'project' ? fileZoneDragging : projectFile ? fileZoneActive : fileZone}
                        onDragOver={e => { e.preventDefault(); setDragOver('project'); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) setProjectFile(f); }}
                    >
                        <div style={{
                            width: '40px', height: '40px', borderRadius: borderRadius.md,
                            backgroundColor: projectFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <Music size={20} color={projectFile || dragOver === 'project' ? colors.primary : colors.textTertiary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                                {isEdit ? 'Replace Project' : 'Project File'}
                            </div>
                            <div style={{ fontSize: '11px', color: projectFile ? colors.primary : dragOver === 'project' ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {projectFile ? projectFile.name : dragOver === 'project' ? 'Drop to select' : (isEdit ? 'Drop or click to replace' : 'Drop .flp, .als or .zip here or click')}
                            </div>
                        </div>
                        <input type="file" accept=".flp,.als,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>
                </div>

                {!isEdit && (
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
                        <input type="text" placeholder={isEdit ? '' : 'Will use metadata/filename if empty'} value={track.title || ''} onChange={e => setField('title', e.target.value)} style={inputBase} maxLength={100} />
                        {(track.title || '').length > 0 && !VALID_TITLE_REGEX.test(track.title || '') && (
                            <span style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', display: 'block' }}>
                                Title contains unsupported characters (Hieroglyphs, Zalgo, etc.). Please use standard text.
                            </span>
                        )}
                    </div>
                    <div>
                        <span style={label}>Track Type</span>
                        <select value={track.trackType || 'original'} onChange={e => setField('trackType', e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                            <option value="original">Original</option>
                            <option value="remix">Remix</option>
                            <option value="cover">Cover</option>
                        </select>
                    </div>
                    {isEdit && (
                        <div>
                            <span style={label}><LinkIcon size={11} style={{ marginRight: 4 }} />Custom URL</span>
                            <input
                                type="text"
                                placeholder={track.slug || 'auto-generated'}
                                value={track.customSlug ?? track.slug ?? ''}
                                onChange={e => setField('customSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                style={inputBase}
                                maxLength={80}
                            />
                            <span style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px', display: 'block' }}>
                                fujistud.io/track/{username}/{track.customSlug || track.slug || '…'}
                            </span>
                        </div>
                    )}
                    <div>
                        <span style={label}>Artist</span>
                        <input type="text" placeholder="Artist name" value={track.artist || ''} onChange={e => setField('artist', e.target.value)} style={inputBase} maxLength={100} />
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

                {/* ── Lyrics ── */}
                <div style={{ marginBottom: '20px' }}>
                    <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlignLeft size={12} style={{ display: 'inline' }} /> Lyrics
                        <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 400, color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 }}>(optional — publicly visible on the track page)</span>
                    </span>
                    <textarea
                        placeholder={'Verse 1\nYour lyrics here...\n\nChorus\nSing along...'}
                        value={isEdit ? editingTrackLyrics : newTrackLyrics}
                        onChange={e => isEdit ? setEditingTrackLyrics(e.target.value) : setNewTrackLyrics(e.target.value)}
                        style={{ ...inputBase, minHeight: '120px', resize: 'vertical', lineHeight: 1.7 }}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textTertiary }}>
                        You can also sync each line to a timestamp from the track page after uploading.
                    </p>
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

                {/* ── License ── */}
                <div style={{
                    padding: '14px 16px', borderRadius: borderRadius.md,
                    backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <Scale size={14} color={colors.textSecondary} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            License
                        </span>
                    </div>
                    <select value={track.license || 'all-rights-reserved'} onChange={e => setField('license', e.target.value)}
                        style={{ ...inputBase, cursor: 'pointer', maxWidth: '360px' }}>
                        <option value="all-rights-reserved" style={{ backgroundColor: colors.surface }}>All Rights Reserved</option>
                        <option value="cc0" style={{ backgroundColor: colors.surface }}>CC0 — Public Domain</option>
                        <option value="cc-by" style={{ backgroundColor: colors.surface }}>CC BY — Attribution</option>
                        <option value="cc-by-sa" style={{ backgroundColor: colors.surface }}>CC BY-SA — Attribution ShareAlike</option>
                        <option value="cc-by-nc" style={{ backgroundColor: colors.surface }}>CC BY-NC — Attribution NonCommercial</option>
                        <option value="cc-by-nc-sa" style={{ backgroundColor: colors.surface }}>CC BY-NC-SA — Attribution NonCommercial ShareAlike</option>
                        <option value="cc-by-nd" style={{ backgroundColor: colors.surface }}>CC BY-ND — Attribution NoDerivs</option>
                        <option value="cc-by-nc-nd" style={{ backgroundColor: colors.surface }}>CC BY-NC-ND — Attribution NonCommercial NoDerivs</option>
                    </select>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: colors.textTertiary, lineHeight: 1.5 }}>
                        {(track.license || 'all-rights-reserved') === 'all-rights-reserved'
                            ? 'Others cannot use, remix, or share this work without your permission.'
                            : (track.license || '') === 'cc0'
                            ? 'You waive all rights. Anyone can use this work for any purpose.'
                            : 'Learn more at creativecommons.org/licenses'}
                    </p>
                </div>

                {/* ── Genres ── */}
                <div style={{ marginBottom: '20px' }}>
                    {renderGenreTagPicker(
                        selectedTrackGenres, setSelectedTrackGenres,
                        isEdit ? genreSearchTerm : addGenreSearchTerm,
                        isEdit ? setGenreSearchTerm : setAddGenreSearchTerm
                    )}
                </div>

                {/* ── Collaborators ── */}
                {(() => {
                    const activeList = isEdit ? collaborators : stagedCollabs.map((c, i) => ({ id: `staged-${i}`, profileId: c.profile.id, profile: c.profile, contribution: c.contribution, category: c.category, status: 'pending' }));
                    return (
                        <div style={{ padding: '14px 16px', borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                                <Users size={14} color={colors.textSecondary} />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collaborators</span>
                                {!isEdit && <span style={{ fontSize: '11px', color: colors.textTertiary }}>(invites sent after upload)</span>}
                            </div>

                            {/* Current / staged collaborators */}
                            {activeList.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                                    {activeList.map(c => (
                                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {c.profile.avatar
                                                ? <img src={`https://cdn.discordapp.com/avatars/${c.profile.userId}/${c.profile.avatar}.png`} alt="" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                                                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={14} color={colors.textTertiary} /></div>
                                            }
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {c.profile.displayName || c.profile.username}
                                                </div>
                                                <div style={{ fontSize: '11px', color: colors.textTertiary }}>
                                                    {c.contribution} · {c.category.replace(/-/g, ' ')}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '20px', flexShrink: 0,
                                                backgroundColor: c.status === 'accepted' ? 'rgba(16,185,129,0.15)' : c.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                                                color: c.status === 'accepted' ? colors.success : c.status === 'rejected' ? colors.error : colors.textTertiary,
                                            }}>
                                                {isEdit ? c.status : 'queued'}
                                            </span>
                                            <button
                                                onClick={() => isEdit ? handleRemoveCollaborator(c.id) : setStagedCollabs(prev => prev.filter(s => s.profile.id !== c.profileId))}
                                                style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add new collaborator */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: '4px' }}>Contribution</div>
                                        <input
                                            value={newCollabContribution}
                                            onChange={e => setNewCollabContribution(e.target.value)}
                                            placeholder="e.g. vocals, production, guitar…"
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: '4px' }}>Category</div>
                                        <select value={newCollabCategory} onChange={e => setNewCollabCategory(e.target.value)}
                                            style={{ width: '100%', background: colors.surface, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', cursor: 'pointer' }}>
                                            <option value="collaboration">Collaboration</option>
                                            <option value="1v1-battle">1v1 Battle</option>
                                            <option value="feature">Feature</option>
                                            <option value="remix">Remix</option>
                                            <option value="split">Split</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: '4px' }}>Search Artist</div>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                        <input
                                            value={collabSearch}
                                            onChange={e => setCollabSearch(e.target.value)}
                                            placeholder="Search by username…"
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 10px 8px 32px', color: colors.textPrimary, fontSize: '13px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    {collabSearchResults.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: colors.surface, border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.md, marginTop: '4px', overflow: 'hidden' }}>
                                            {collabSearchResults
                                                .filter(p => !activeList.some(c => c.profileId === p.id))
                                                .map(p => (
                                                <button key={p.id} onClick={() => handleAddCollaborator(p, isEdit)}
                                                    disabled={!newCollabContribution.trim()}
                                                    title={!newCollabContribution.trim() ? 'Enter a contribution first' : ''}
                                                    style={{ width: '100%', background: 'none', border: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: newCollabContribution.trim() ? 'pointer' : 'not-allowed', opacity: newCollabContribution.trim() ? 1 : 0.5, textAlign: 'left' }}>
                                                    {p.avatar
                                                        ? <img src={`https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png`} alt="" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                                                        : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={14} color={colors.textTertiary} /></div>
                                                    }
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>{p.displayName || p.username}</div>
                                                        <div style={{ fontSize: '11px', color: colors.textTertiary }}>@{p.username}</div>
                                                    </div>
                                                    <UserPlus size={14} color={colors.primary} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

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
                        disabled={saving || (!isEdit && (!audioFile || !tosAgreed)) || ((track.title || '').length > 0 && !VALID_TITLE_REGEX.test(track.title || ''))}
                        style={{
                            flex: 1, padding: '12px', backgroundColor: colors.primary, color: 'white',
                            border: 'none', borderRadius: borderRadius.md, cursor: (saving || (!isEdit && (!audioFile || !tosAgreed)) || ((track.title || '').length > 0 && !VALID_TITLE_REGEX.test(track.title || ''))) ? 'not-allowed' : 'pointer',
                            fontWeight: 700, fontSize: '14px', opacity: (saving || (!isEdit && (!audioFile || !tosAgreed)) || ((track.title || '').length > 0 && !VALID_TITLE_REGEX.test(track.title || ''))) ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            boxShadow: shadows.glow,
                        }}
                    >
                        {saving
                            ? (uploadStage === 'uploading' ? `Uploading ${uploadProgress}%` : uploadStage === 'scanning' ? 'Scanning…' : 'Saving…')
                            : isEdit ? <><Save size={16} /> Save Changes</> : <><Upload size={16} /> Upload Track</>}
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
    const renderTrackCard = (track: any, idx: number) => {
        const isEditing = editingTrack?.id === track.id;
        const isDragging = dragReorderIdx === idx;
        const isDropTarget = dragOverIdx === idx && dragReorderIdx !== idx;
        const duration = track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '--:--';
        const trackTypeLabel = track.trackType === 'remix' ? 'Remix' : track.trackType === 'cover' ? 'Cover' : null;

        return (
            <div key={track.id}
                draggable={!bulkMode && !editingTrack}
                onDragStart={() => setDragReorderIdx(idx)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragEnd={() => {
                    if (dragReorderIdx !== null && dragOverIdx !== null && dragReorderIdx !== dragOverIdx) {
                        const reordered = [...tracks];
                        const [moved] = reordered.splice(dragReorderIdx, 1);
                        reordered.splice(dragOverIdx, 0, moved);
                        handleDragEnd(reordered);
                    }
                    setDragReorderIdx(null);
                    setDragOverIdx(null);
                }}
                style={{
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.lg,
                    border: `1px solid ${isDropTarget ? colors.primary : isEditing ? colors.primary : colors.glassBorder}`,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s, opacity 0.15s',
                    opacity: isDragging ? 0.4 : 1,
                    outline: isDropTarget ? `2px solid ${colors.primary}` : 'none',
                }}>
                <div style={{ display: 'flex', gap: '16px', padding: '16px', alignItems: 'center' }}>
                    {/* Drag handle */}
                    {!bulkMode && !editingTrack && (
                        <div style={{ cursor: 'grab', color: colors.textTertiary, flexShrink: 0, paddingRight: '4px' }} title="Drag to reorder">
                            <GripVertical size={16} />
                        </div>
                    )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {track.title}
                            </div>
                            {trackTypeLabel && (
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: '4px', flexShrink: 0, backgroundColor: 'rgba(124,58,237,0.15)', color: '#A78BFA', letterSpacing: '0.04em' }}>
                                    {trackTypeLabel}
                                </span>
                            )}
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
                        <a href={`/profile/${username || user?.username}/${track.slug || track.id}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: borderRadius.sm, color: colors.textTertiary, textDecoration: 'none', border: `1px solid ${colors.glassBorder}` }}
                            title="View page">
                            <ExternalLink size={15} />
                        </a>
                        <button onClick={() => { setEditingTrack(track); setIsAddingTrack(false); setSelectedTrackGenres(track.genres?.map((g: any) => g.genreId) || []); setEditingTrackLyrics(track.lyrics || ''); }}
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
                {!isAddingTrack && !editingTrack && tracks.length > 0 && (
                    <button onClick={() => { setBulkMode(m => !m); setSelectedIds(new Set()); }} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px',
                        backgroundColor: bulkMode ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                        color: bulkMode ? colors.primary : colors.textSecondary,
                        border: `1px solid ${bulkMode ? colors.primary + '66' : colors.glassBorder}`,
                        borderRadius: borderRadius.md, cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                    }}>
                        <CheckSquare size={15} /> {bulkMode ? 'Exit Select' : 'Select'}
                    </button>
                )}
                {!isAddingTrack && !editingTrack && !bulkMode && (
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


            {/* ── Upload / Edit form ── */}
            {isAddingTrack && renderTrackForm(false)}
            {editingTrack && renderTrackForm(true)}

            {/* ── Pending collab invites ── */}
            {pendingInvites.filter(c => c.status === 'pending').length > 0 && !editingTrack && !isAddingTrack && (
                <div style={{ ...card, marginBottom: '24px', borderColor: 'rgba(16,185,129,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Mic2 size={16} color={colors.primary} />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: colors.textPrimary }}>Collaboration Invites</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', backgroundColor: 'rgba(16,185,129,0.15)', color: colors.primary }}>
                            {pendingInvites.filter(c => c.status === 'pending').length}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {pendingInvites.filter(c => c.status === 'pending').map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {c.track?.coverUrl
                                    ? <img src={c.track.coverUrl} alt="" style={{ width: 40, height: 40, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                                    : <div style={{ width: 40, height: 40, borderRadius: '6px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Music size={16} color={colors.textTertiary} /></div>
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.track?.title}
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textTertiary }}>
                                        by {c.track?.profile?.displayName || c.track?.profile?.username} · <strong style={{ color: colors.textSecondary }}>{c.contribution}</strong> · {c.category.replace(/-/g, ' ')}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button onClick={() => handleRespondToInvite(c, 'accepted')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(16,185,129,0.15)', color: colors.success }}>
                                        <Check size={12} /> Accept
                                    </button>
                                    <button onClick={() => handleRespondToInvite(c, 'rejected')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(239,68,68,0.1)', color: colors.error }}>
                                        <X size={12} /> Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                    {!isAddingTrack && (
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
                <>
                    {/* ── Bulk toolbar ── */}
                    {bulkMode && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                            padding: '12px 16px', marginBottom: '12px',
                            backgroundColor: 'rgba(16,185,129,0.05)',
                            border: `1px solid ${colors.primary}33`,
                            borderRadius: borderRadius.md,
                        }}>
                            {/* Select all */}
                            <button onClick={toggleSelectAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}`, backgroundColor: 'transparent', color: colors.textSecondary, cursor: 'pointer' }}>
                                {selectedIds.size === tracks.length ? <CheckSquare size={14} color={colors.primary} /> : <Square size={14} />}
                                {selectedIds.size === tracks.length ? 'Deselect All' : 'Select All'}
                            </button>

                            <span style={{ fontSize: '12px', color: colors.textTertiary, marginRight: '4px' }}>
                                {selectedIds.size} selected
                            </span>

                            {selectedIds.size > 0 && (
                                <>
                                    <div style={{ width: '1px', height: '20px', backgroundColor: colors.glassBorder, margin: '0 4px' }} />
                                    {/* Visibility */}
                                    <button onClick={() => bulkSetVisibility(true)} disabled={bulkSaving} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid rgba(16,185,129,0.3)`, backgroundColor: 'rgba(16,185,129,0.08)', color: colors.primary, cursor: bulkSaving ? 'not-allowed' : 'pointer', opacity: bulkSaving ? 0.6 : 1 }}>
                                        <Eye size={13} /> Make Public
                                    </button>
                                    <button onClick={() => bulkSetVisibility(false)} disabled={bulkSaving} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}`, backgroundColor: 'rgba(255,255,255,0.03)', color: colors.textSecondary, cursor: bulkSaving ? 'not-allowed' : 'pointer', opacity: bulkSaving ? 0.6 : 1 }}>
                                        <EyeOff size={13} /> Make Private
                                    </button>
                                    <div style={{ width: '1px', height: '20px', backgroundColor: colors.glassBorder, margin: '0 4px' }} />
                                    {/* Downloads */}
                                    <button onClick={() => bulkSetDownload(true)} disabled={bulkSaving} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid rgba(16,185,129,0.3)`, backgroundColor: 'rgba(16,185,129,0.08)', color: colors.primary, cursor: bulkSaving ? 'not-allowed' : 'pointer', opacity: bulkSaving ? 0.6 : 1 }}>
                                        <Download size={13} /> Enable Downloads
                                    </button>
                                    <button onClick={() => bulkSetDownload(false)} disabled={bulkSaving} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}`, backgroundColor: 'rgba(255,255,255,0.03)', color: colors.textSecondary, cursor: bulkSaving ? 'not-allowed' : 'pointer', opacity: bulkSaving ? 0.6 : 1 }}>
                                        <Download size={13} /> Disable Downloads
                                    </button>
                                    <div style={{ width: '1px', height: '20px', backgroundColor: colors.glassBorder, margin: '0 4px' }} />
                                    {/* Delete */}
                                    <button
                                        onClick={() => setDeleteConfirm({ trackId: '__bulk__', title: `${selectedIds.size} track${selectedIds.size !== 1 ? 's' : ''}` })}
                                        disabled={bulkSaving}
                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid rgba(239,68,68,0.3)`, backgroundColor: 'rgba(239,68,68,0.06)', color: colors.error, cursor: bulkSaving ? 'not-allowed' : 'pointer', opacity: bulkSaving ? 0.6 : 1 }}>
                                        <Trash2 size={13} /> Delete
                                    </button>
                                </>
                            )}
                            {bulkSaving && <span style={{ fontSize: '12px', color: colors.textTertiary, marginLeft: '4px' }}>Saving…</span>}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {tracks.map((track, idx) => {
                            const isSelected = selectedIds.has(track.id);
                            return (
                                <div key={track.id} style={{ position: 'relative' }} onClick={bulkMode ? () => toggleSelect(track.id) : undefined}>
                                    {bulkMode && (
                                        <div style={{
                                            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                                            zIndex: 2, pointerEvents: 'none',
                                        }}>
                                            {isSelected
                                                ? <CheckSquare size={18} color={colors.primary} />
                                                : <Square size={18} color={colors.textTertiary} />
                                            }
                                        </div>
                                    )}
                                    <div style={{ opacity: bulkMode && !isSelected ? 0.55 : 1, transition: 'opacity 0.15s', paddingLeft: bulkMode ? '40px' : '0', cursor: bulkMode ? 'pointer' : 'default', outline: isSelected ? `2px solid ${colors.primary}` : '2px solid transparent', borderRadius: borderRadius.lg }}>
                                        {renderTrackCard(track, idx)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
        </DiscoveryLayout>
        {/* ── Artwork Crop Modal ── */}
        {showCropModal && artworkPreviewUrl && (
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                onClick={() => setShowCropModal(false)}
            >
                <div
                    style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}`, padding: '24px', maxWidth: '580px', width: '100%' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: colors.textPrimary }}>Crop Album Artwork</h3>
                        <button onClick={() => setShowCropModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex', padding: '4px' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.textSecondary }}>
                        Drag to reposition · Drag a corner handle to resize. Output will be saved at 512×512.
                    </p>
                    {/* Image + interactive crop overlay */}
                    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', userSelect: 'none', overflow: 'hidden', borderRadius: borderRadius.md, lineHeight: 0 }}>
                        <img
                            ref={cropImgRef}
                            src={artworkPreviewUrl}
                            alt="Artwork"
                            onLoad={initCropRect}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '400px' }}
                            draggable={false}
                        />
                        {/* Crop box — box-shadow darkens area outside crop */}
                        <div
                            style={{
                                position: 'absolute',
                                left: cropRect.x,
                                top: cropRect.y,
                                width: cropRect.size,
                                height: cropRect.size,
                                border: '2px solid rgba(255,255,255,0.9)',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                                boxSizing: 'border-box',
                                cursor: 'move',
                            }}
                            onMouseDown={e => handleCropMouseDown(e, 'move')}
                        >
                            {/* Rule-of-thirds grid lines */}
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                {[33.33, 66.66].map(p => (
                                    <React.Fragment key={p}>
                                        <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.25)' }} />
                                        <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.25)' }} />
                                    </React.Fragment>
                                ))}
                            </div>
                            {/* Corner resize handles */}
                            {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
                                <div
                                    key={corner}
                                    onMouseDown={e => handleCropMouseDown(e, corner)}
                                    style={{
                                        position: 'absolute', width: 10, height: 10,
                                        backgroundColor: 'white', borderRadius: '2px',
                                        cursor: `${corner}-resize`,
                                        ...(corner === 'nw' && { left: -5, top: -5 }),
                                        ...(corner === 'ne' && { right: -5, top: -5 }),
                                        ...(corner === 'sw' && { left: -5, bottom: -5 }),
                                        ...(corner === 'se' && { right: -5, bottom: -5 }),
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowCropModal(false)}
                            style={{ padding: '9px 18px', fontSize: '14px', borderRadius: borderRadius.md, border: `1px solid ${colors.glassBorder}`, color: colors.textSecondary, backgroundColor: 'transparent', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={applyCrop}
                            style={{ padding: '9px 18px', fontSize: '14px', fontWeight: 700, borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.primary, color: 'white', cursor: 'pointer', boxShadow: shadows.glow }}
                        >
                            Apply Crop
                        </button>
                    </div>
                </div>
            </div>
        )}
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
