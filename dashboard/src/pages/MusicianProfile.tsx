import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
    User, Music, Share2, Hammer, Save, Plus, X, Globe, Instagram, Youtube, 
    MessageCircle, Radio, ExternalLink, Copy, Check, ArrowLeft, Play, Tag, AlertCircle,
    FileAudio, Image as ImageIcon, Edit3
} from 'lucide-react';
import { MusicianProfilePublic } from './MusicianProfilePublic';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { ConfirmModal } from '../components/ConfirmModal';

interface MusicianProfile {
    id?: string;
    userId?: string;
    username?: string;
    displayName?: string | null;
    avatar?: string | null;
    bio: string | null;
    spotifyUrl: string | null;
    soundcloudUrl: string | null;
    youtubeUrl: string | null;
    instagramUrl: string | null;
    discordUrl: string | null;
    gearList: string[];
    genres: { id: string; name: string }[];
    featuredTrackId?: string | null;
}

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

export const MusicianProfilePage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { pathname } = useLocation();
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ trackId: string; title: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Get the identifier from URL (if any)
    const pathParts = pathname.split('/');
    const urlIdentifier = pathParts.length > 2 ? pathParts[2] : null;

    useEffect(() => {
        // If we have an identifier, default to 'view' mode
        if (urlIdentifier) {
            setMode('view');
        } else if (!urlIdentifier && user) {
            setMode('edit');
        } else if (!urlIdentifier && !user && !authLoading) {
            // No identifier and no user = can't do anything, but App.tsx handles login redirect
            setMode('view');
        }
    }, [user?.id, urlIdentifier, authLoading]);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const profileUrl = profile?.username ? `${window.location.origin}/profile/${profile.username}` : '';

    const handleCopyLink = () => {
        if (!profileUrl) return;
        navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Check if we have a username/ID in the URL
                const identifier = urlIdentifier || user?.id;
                
                if (!identifier) {
                    if (!authLoading) setLoading(false);
                    return;
                }

                const [profileRes, genresRes] = await Promise.all([
                    axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true }),
                    axios.get('/api/musician/genres', { withCredentials: true })
                ]);
                
                const data = profileRes.data;
                // Map hardware to gearList for frontend consistency
                if (data && !data.gearList && data.hardware) {
                    data.gearList = data.hardware;
                }
                
                // Set tracks
                if (data && data.tracks) {
                    setTracks(data.tracks);
                }
                
                // Map social array to flat fields for editing
                if (data && data.socials && Array.isArray(data.socials)) {
                    data.socials.forEach((s: any) => {
                        if (s.platform === 'spotify') data.spotifyUrl = s.url;
                        if (s.platform === 'soundcloud') data.soundcloudUrl = s.url;
                        if (s.platform === 'youtube') data.youtubeUrl = s.url;
                        if (s.platform === 'instagram') data.instagramUrl = s.url;
                        if (s.platform === 'discord') data.discordUrl = s.url;
                    });
                }
                
                // Extract genres into simple {id, name} objects for the editor
                if (data && data.genres) {
                    data.genres = data.genres.map((pg: any) => ({
                        id: pg.genreId,
                        name: pg.genre?.name || 'Unknown'
                    }));
                }
                
                setProfile(data);
                setAllGenres(genresRes.data);
            } catch (err: any) {
                // If profile is missing, start fresh for currently logged in user
                if (err.response?.status === 404 && !urlIdentifier) {
                    setProfile({
                        username: user?.username || '',
                        displayName: user?.username || '',
                        bio: '',
                        spotifyUrl: '',
                        soundcloudUrl: '',
                        youtubeUrl: '',
                        instagramUrl: '',
                        discordUrl: '',
                        gearList: [],
                        genres: []
                    });
                    const res = await axios.get('/api/musician/genres', { withCredentials: true });
                    setAllGenres(res.data);
                } else {
                    setMessage({ type: 'error', text: 'Failed to load profile' });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.id]);

    const handleSave = async () => {
        if (!user || !profile) return;
        if (nameError) {
            setMessage({ type: 'error', text: 'Please fix the artist name before saving.' });
            return;
        }
        setSaving(true);
        try {
            const payload = { 
                ...profile, 
                genres: profile.genres?.map(g => typeof g === 'string' ? g : (g.id || (g as any).genreId)).filter(Boolean) || []
            };
            await axios.post(`/api/musician/profile/${user.id}`, payload, { withCredentials: true });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save profile' });
        } finally {
            setSaving(false);
        }
    };

    const validateArtistName = async (name: string) => {
        if (!name || name.trim().length === 0) {
            setNameError(null);
            return;
        }
        setValidatingName(true);
        try {
            const res = await axios.post('/api/musician/validate-name', { name }, { withCredentials: true });
            if (!res.data.valid) {
                setNameError(res.data.reason || 'This name is not allowed.');
            } else {
                setNameError(null);
            }
        } catch {
            setNameError(null);
        } finally {
            setValidatingName(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        if (!user || !profile) return;
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append('avatar', file);
        
        try {
            const res = await axios.post(`/api/musician/profile/${user.id}/avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            setProfile({ ...profile, avatar: res.data.avatar });
            setMessage({ type: 'success', text: 'Profile picture updated!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upload avatar' });
        } finally {
            setUploadingAvatar(false);
            setAvatarFile(null);
        }
    };

    const addGenre = (genre: Genre) => {
        if (!profile || profile.genres.some(g => g.id === genre.id)) return;
        setProfile({ ...profile, genres: [...profile.genres, { id: genre.id, name: genre.name }] });
    };

    const removeGenre = (id: string) => {
        if (!profile) return;
        setProfile({ ...profile, genres: profile.genres.filter(g => g.id !== id) });
    };

    const addGear = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!profile) return;
        setProfile({ ...profile, gearList: [...(profile.gearList || []), ''] });
    };

    const updateGear = (index: number, value: string) => {
        if (!profile) return;
        const newGear = [...(profile.gearList || [])];
        newGear[index] = value;
        setProfile({ ...profile, gearList: newGear });
    };

    const removeGear = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!profile) return;
        setProfile({ ...profile, gearList: (profile.gearList || []).filter((_, i) => i !== index) });
    };

    // Track state
    const [tracks, setTracks] = useState<any[]>([]);
    const [isAddingTrack, setIsAddingTrack] = useState(false);
    const [newTrack, setNewTrack] = useState({ 
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
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [artworkFile, setArtworkFile] = useState<File | null>(null);
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const [selectedTrackGenres, setSelectedTrackGenres] = useState<string[]>([]);
    const [genreSearchTerm, setGenreSearchTerm] = useState('');
    const [addGenreSearchTerm, setAddGenreSearchTerm] = useState('');
    
    // Edit track state
    const [editingTrack, setEditingTrack] = useState<any>(null);
    
    // Avatar state
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    
    // Artist name validation
    const [nameError, setNameError] = useState<string | null>(null);
    const [validatingName, setValidatingName] = useState(false);

    const handleAddTrack = async () => {
        if (!audioFile) {
            setMessage({ type: 'error', text: 'Please select an audio file' });
            return;
        }

        if (audioFile.size > 300 * 1024 * 1024) {
            setMessage({ type: 'error', text: `File "${audioFile.name}" is ${(audioFile.size / 1024 / 1024).toFixed(1)}MB — max allowed is 300MB. Try exporting as MP3 or at a lower bitrate.` });
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
        try {
            const res = await axios.post('/api/musician/tracks', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            setTracks([...tracks, res.data]);
            setIsAddingTrack(false);
            setNewTrack({ title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '' });
            setAudioFile(null);
            setArtworkFile(null);
            setProjectFile(null);
            setSelectedTrackGenres([]);
            setMessage({ type: 'success', text: 'Track uploaded successfully!' });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || e.message || 'Failed to upload track. Please try again.' });
        } finally {
            setSaving(false);
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
        } catch (e: any) {
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
            setAudioFile(null);
            setArtworkFile(null);
            setProjectFile(null);
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
            const res = await axios.patch(`/api/musician/tracks/${track.id}`, { 
                isPublic: !track.isPublic 
            }, { withCredentials: true });
            setTracks(tracks.map(t => t.id === track.id ? res.data : t));
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to update track visibility' });
        }
    };

    if (loading || authLoading) return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading profile...</div>
        </DiscoveryLayout>
    );

    if (!user && !urlIdentifier) {
        return (
            <DiscoveryLayout activeTab="profile">
                <div style={{ textAlign: 'center', padding: '100px', color: colors.textPrimary }}>
                    <User size={64} color={colors.primary} style={{ marginBottom: spacing.xl, opacity: 0.5 }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Authentication Required</h2>
                    <p style={{ color: colors.textSecondary, marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                        You need to be logged in to manage your musician profile and upload tracks.
                    </p>
                    <button 
                        onClick={() => window.location.href = '/api/auth/discord/login'}
                        style={{ 
                            backgroundColor: colors.primary, color: 'white', border: 'none', 
                            padding: '12px 32px', borderRadius: borderRadius.md, fontWeight: 'bold', 
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        Login with Discord
                    </button>
                </div>
            </DiscoveryLayout>
        );
    }

    const socialsList = [
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/> },
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/> },
        { key: 'youtubeUrl', label: 'YouTube', icon: <Youtube size={16}/> },
        { key: 'instagramUrl', label: 'Instagram', icon: <Instagram size={16}/> },
        { key: 'discordUrl', label: 'Discord Username', icon: <MessageCircle size={16}/>, placeholder: 'e.g. username or user#1234' },
    ];

    if (mode === 'view') {
        const identifier = urlIdentifier || user?.username || user?.id || '';
        const isOwn = !!user && (identifier === user.id || identifier === user.username);
        return (
            <DiscoveryLayout activeTab="profile">
                <MusicianProfilePublic 
                    identifier={identifier} 
                    isOwnProfile={isOwn} 
                    onEdit={() => setMode('edit')}
                />
            </DiscoveryLayout>
        );
    }

    return (
        <>
        <DiscoveryLayout activeTab="profile">
        <div style={{ padding: spacing.lg, maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <ArrowLeft size={24} style={{ marginRight: '16px', cursor: 'pointer', color: colors.textSecondary }} onClick={() => setMode('view')} />
                <User size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Musician Profile</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Customize how you appear in the community networking lists.</p>
                </div>
                {profile?.id && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View Profile"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                padding: isMobile ? '8px' : '8px 16px',
                                borderRadius: borderRadius.md,
                                color: colors.textPrimary, textDecoration: 'none',
                                fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.1)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <ExternalLink size={16} />{!isMobile && ' View Profile'}
                        </a>
                        <button
                            onClick={handleCopyLink}
                            title="Share Profile"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: colors.primary,
                                padding: isMobile ? '8px' : '8px 16px',
                                borderRadius: borderRadius.md,
                                color: 'white', border: 'none', cursor: 'pointer',
                                fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap'
                            }}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}{!isMobile && (copied ? ' Copied!' : ' Share Profile')}
                        </button>
                    </div>
                )}
            </div>

            {message && (
                <div style={{ 
                    padding: spacing.md, 
                    borderRadius: borderRadius.md, 
                    marginBottom: spacing.md,
                    backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: message.type === 'success' ? '#4caf50' : '#f44336',
                    border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing.lg }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Music size={20} /> My Tracks
                        </h3>
                        
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
                                                <a 
                                                    href={`/profile/${profile?.username || user?.username}/${track.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', color: colors.textSecondary, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    View Page <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => {
                                                setEditingTrack(track);
                                                setIsAddingTrack(false);
                                                setSelectedTrackGenres(track.genres?.map((g: any) => g.genreId) || []);
                                            }}
                                            style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', display: 'flex' }}
                                            title="Edit Track"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleToggleStream(track)}
                                            style={{ background: 'none', border: 'none', color: track.isPublic ? colors.primary : colors.textSecondary, cursor: 'pointer', display: 'flex' }}
                                            title={track.isPublic ? "Public" : "Private"}
                                        >
                                            <Globe size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteTrack(track.id)} aria-label={`Delete track: ${track.title}`} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', display: 'flex' }}>
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {editingTrack ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.sm }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Editing: {editingTrack.title}</div>
                                    <button onClick={() => setEditingTrack(null)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={18}/></button>
                                </div>

                                <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px' }}>Replace Audio (Optional)</div>
                                <label style={{ 
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: borderRadius.sm, cursor: 'pointer',
                                    color: audioFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem'
                                }}>
                                    <FileAudio size={18} color={audioFile ? colors.primary : colors.textSecondary} />
                                    {audioFile ? audioFile.name : 'Keep existing or choose new file...'}
                                    <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                                </label>
                                
                                <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', marginTop: '8px' }}>Replace Artwork (Optional)</div>
                                <label style={{ 
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: borderRadius.sm, cursor: 'pointer',
                                    color: artworkFile ? colors.textPrimary : colors.textSecondary, fontSize: '0.85rem'
                                }}>
                                    <ImageIcon size={18} color={artworkFile ? colors.primary : colors.textSecondary} />
                                    {artworkFile ? artworkFile.name : 'Keep existing or choose new image...'}
                                    <input type="file" accept="image/*" onChange={e => setArtworkFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginTop: spacing.sm }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Track Title</label>
                                        <input 
                                            type="text" value={editingTrack.title || ''}
                                            onChange={e => setEditingTrack({...editingTrack, title: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Artist</label>
                                        <input 
                                            type="text" value={editingTrack.artist || ''}
                                            onChange={e => setEditingTrack({...editingTrack, artist: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Album</label>
                                        <input 
                                            type="text" value={editingTrack.album || ''}
                                            onChange={e => setEditingTrack({...editingTrack, album: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>BPM</label>
                                        <input 
                                            type="number" value={editingTrack.bpm || ''}
                                            onChange={e => setEditingTrack({...editingTrack, bpm: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Key</label>
                                        <select 
                                            value={editingTrack.key || ''}
                                            onChange={e => setEditingTrack({...editingTrack, key: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        >
                                        <option value="" style={{ color: 'white', backgroundColor: '#1A1E2E' }}>Select key...</option>
                                        {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
                                            <option key={`${note} Major`} value={`${note} Major`} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{note} Major</option>,
                                            <option key={`${note} Minor`} value={`${note} Minor`} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{note} Minor</option>
                                        ])}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: colors.textSecondary }}>Download Settings</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={editingTrack.allowAudioDownload ?? true}
                                            onChange={e => setEditingTrack({...editingTrack, allowAudioDownload: e.target.checked})}
                                        />
                                        Allow users to download audio file
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={editingTrack.allowProjectDownload ?? true}
                                            onChange={e => setEditingTrack({...editingTrack, allowProjectDownload: e.target.checked})}
                                        />
                                        Allow users to download .flp project (if attached)
                                    </label>
                                </div>
                            </div>

                            <div style={{ marginTop: spacing.sm }}>
                                <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Tag size={14} /> Genre Tags
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                                    {selectedTrackGenres.map(gId => {
                                        const genre = allGenres.find(g => g.id === gId);
                                        return genre ? (
                                            <span key={gId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: colors.primary, padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', color: 'white' }}>
                                                {genre.name}
                                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedTrackGenres(prev => prev.filter(id => id !== gId))} />
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <input 
                                        type="text"
                                        placeholder="Search genres..."
                                        value={genreSearchTerm}
                                        onChange={e => setGenreSearchTerm(e.target.value)}
                                        style={{ flex: 1, backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 12px', color: 'white', fontSize: '0.85rem' }}
                                    />
                                    <select
                                        value=""
                                        onChange={e => {
                                            if (e.target.value && !selectedTrackGenres.includes(e.target.value)) {
                                                setSelectedTrackGenres(prev => [...prev, e.target.value]);
                                                setGenreSearchTerm('');
                                            }
                                        }}
                                        style={{ flex: 1, boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                    >
                                        <option value="" style={{ color: 'white', backgroundColor: '#1A1E2E' }}>Add a genre tag...</option>
                                        {allGenres
                                            .filter(g => !selectedTrackGenres.includes(g.id))
                                            .filter(g => g.name.toLowerCase().includes(genreSearchTerm.toLowerCase()))
                                            .map(g => (
                                                <option key={g.id} value={g.id} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{g.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                                    <button 
                                        onClick={handleUpdateTrack} 
                                        disabled={saving}
                                        style={{ flex: 1, padding: '10px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button onClick={() => { setEditingTrack(null); setSelectedTrackGenres([]); }} style={{ flex: 1, padding: '10px', background: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </div>
                        ) : isAddingTrack ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.sm }}>
                                <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px' }}>Audio File (MP3/WAV/etc) *</div>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    padding: '10px 14px', 
                                    backgroundColor: 'rgba(255,255,255,0.03)', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: borderRadius.sm, 
                                    cursor: 'pointer',
                                    color: audioFile ? colors.textPrimary : colors.textSecondary,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}>
                                    <FileAudio size={18} color={audioFile ? colors.primary : colors.textSecondary} />
                                    {audioFile ? `${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)` : 'Choose audio file...'}
                                    <input 
                                        type="file" accept="audio/*"
                                        onChange={e => setAudioFile(e.target.files?.[0] || null)}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                <div style={{ fontSize: '0.75rem', color: colors.textSecondary, paddingLeft: '2px' }}>Supported: MP3, WAV, FLAC, OGG, AAC &mdash; max 300MB. Large WAV files will be auto-converted to 320kbps MP3.</div>
                                
                                <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', marginTop: '8px' }}>Artwork (Optional)</div>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    padding: '10px 14px', 
                                    backgroundColor: 'rgba(255,255,255,0.03)', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: borderRadius.sm, 
                                    cursor: 'pointer',
                                    color: artworkFile ? colors.textPrimary : colors.textSecondary,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}>
                                    <ImageIcon size={18} color={artworkFile ? colors.primary : colors.textSecondary} />
                                    {artworkFile ? artworkFile.name : 'Choose artwork image...'}
                                    <input 
                                        type="file" accept="image/*"
                                        onChange={e => setArtworkFile(e.target.files?.[0] || null)}
                                        style={{ display: 'none' }}
                                    />
                                </label>

                                <div style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', marginTop: '8px' }}>FL Studio Project (Optional)</div>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    padding: '10px 14px', 
                                    backgroundColor: 'rgba(255,255,255,0.03)', 
                                    border: `1px solid ${projectFile ? colors.primary : 'rgba(255,255,255,0.1)'}`, 
                                    borderRadius: borderRadius.sm, 
                                    cursor: 'pointer',
                                    color: projectFile ? colors.textPrimary : colors.textSecondary,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}>
                                    <Music size={18} color={projectFile ? colors.primary : colors.textSecondary} />
                                    {projectFile ? projectFile.name : 'Attach .flp project file...'}
                                    <input 
                                        type="file" accept=".flp"
                                        onChange={e => setProjectFile(e.target.files?.[0] || null)}
                                        style={{ display: 'none' }}
                                    />
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginTop: spacing.sm }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Track Title</label>
                                        <input 
                                            type="text" placeholder="Will use metadata/filename if empty" value={newTrack.title}
                                            onChange={e => setNewTrack({...newTrack, title: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Artist</label>
                                        <input 
                                            type="text" placeholder="Artist name" value={newTrack.artist}
                                            onChange={e => setNewTrack({...newTrack, artist: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Album</label>
                                        <input 
                                            type="text" placeholder="Album / EP name" value={newTrack.album}
                                            onChange={e => setNewTrack({...newTrack, album: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Year</label>
                                        <input 
                                            type="number" placeholder="2025" value={newTrack.year}
                                            onChange={e => setNewTrack({...newTrack, year: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>BPM</label>
                                        <input 
                                            type="number" placeholder="120" value={newTrack.bpm}
                                            onChange={e => setNewTrack({...newTrack, bpm: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Key</label>
                                        <select 
                                            value={newTrack.key}
                                            onChange={e => setNewTrack({...newTrack, key: e.target.value})}
                                            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        >
                                            <option value="">Select key...</option>
                                            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
                                                <option key={`${note} Major`} value={`${note} Major`}>{note} Major</option>,
                                                <option key={`${note} Minor`} value={`${note} Minor`}>{note} Minor</option>
                                            ])}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: colors.textSecondary }}>Download Permissions</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={newTrack.allowAudioDownload}
                                                onChange={e => setNewTrack({...newTrack, allowAudioDownload: e.target.checked})}
                                            />
                                            Public: Allow Audio Download
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={newTrack.allowProjectDownload}
                                                onChange={e => setNewTrack({...newTrack, allowProjectDownload: e.target.checked})}
                                            />
                                            Public: Allow FLP Project Download
                                        </label>
                                    </div>
                                </div>

                                <div style={{ marginTop: spacing.sm }}>
                                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Description</label>
                                    <textarea 
                                        placeholder="Notes about this track..."
                                        value={newTrack.description}
                                        onChange={e => setNewTrack({...newTrack, description: e.target.value})}
                                        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, minHeight: '60px', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ marginTop: spacing.sm }}>
                                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Tag size={14} /> Genre Tags
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                                        {selectedTrackGenres.map(gId => {
                                            const genre = allGenres.find(g => g.id === gId);
                                            return genre ? (
                                                <span key={gId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: colors.primary, padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', color: 'white' }}>
                                                    {genre.name}
                                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedTrackGenres(prev => prev.filter(id => id !== gId))} />
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search genres..."
                                            value={addGenreSearchTerm}
                                            onChange={e => setAddGenreSearchTerm(e.target.value)}
                                            style={{ flex: 1, backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 12px', color: 'white', fontSize: '0.85rem' }}
                                        />
                                        <select
                                            value=""
                                            onChange={e => {
                                                if (e.target.value && !selectedTrackGenres.includes(e.target.value)) {
                                                    setSelectedTrackGenres(prev => [...prev, e.target.value]);
                                                    setAddGenreSearchTerm('');
                                                }
                                            }}
                                            style={{ flex: 1, boxSizing: 'border-box', backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                        >
                                            <option value="" style={{ color: 'white', backgroundColor: '#1A1E2E' }}>Add a genre tag...</option>
                                            {allGenres
                                                .filter(g => !selectedTrackGenres.includes(g.id))
                                                .filter(g => g.name.toLowerCase().includes(addGenreSearchTerm.toLowerCase()))
                                                .map(g => (
                                                    <option key={g.id} value={g.id} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{g.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                                    <button 
                                        onClick={handleAddTrack} 
                                        disabled={saving || !audioFile}
                                        style={{ flex: 1, padding: '10px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, cursor: (saving || !audioFile) ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: (saving || !audioFile) ? 0.7 : 1 }}
                                    >
                                        {saving ? 'Uploading...' : 'Upload Track'}
                                    </button>
                                    <button onClick={() => { setIsAddingTrack(false); setSelectedTrackGenres([]); setAddGenreSearchTerm(''); }} style={{ flex: 1, padding: '10px', background: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setIsAddingTrack(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textSecondary, cursor: 'pointer' }}>
                                <Plus size={16}/> Add Track
                            </button>
                        )}
                    </div>

                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Share2 size={20} /> Profile Details
                        </h3>
                    
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md }}>
                                <div style={{ position: 'relative' }}>
                                    {profile?.avatar ? (
                                        <img 
                                            src={profile.avatar.startsWith('http') ? profile.avatar : (profile.avatar.includes('/') ? profile.avatar : `https://cdn.discordapp.com/avatars/${user?.id}/${profile.avatar}.png?size=256`)} 
                                            alt="Avatar" 
                                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${colors.primary}` }} 
                                        />
                                    ) : (
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px dashed rgba(255,255,255,0.1)` }}>
                                            <User size={32} color={colors.textSecondary} />
                                        </div>
                                    )}
                                    <label style={{ 
                                        position: 'absolute', bottom: 0, right: 0, 
                                        backgroundColor: colors.primary, width: '28px', height: '28px', 
                                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        cursor: uploadingAvatar ? 'not-allowed' : 'pointer', border: `2px solid ${colors.surface}`
                                    }}>
                                        <Plus size={16} color="white" />
                                        <input 
                                            type="file" accept="image/*" 
                                            onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                                            style={{ display: 'none' }}
                                            disabled={uploadingAvatar}
                                        />
                                    </label>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>Profile Picture</label>
                                    <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: 0 }}>
                                        {uploadingAvatar ? 'Uploading... please wait.' : 'Upload a custom artist photo. Supported formats: JPG, PNG, WEBP.'}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Artist / Display Name</label>
                                <input 
                                    type="text"
                                    value={profile?.displayName || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setProfile(p => p ? {...p, displayName: val || null} : null);
                                        if (val.trim().length > 0) {
                                            validateArtistName(val.trim());
                                        } else {
                                            setNameError(null);
                                        }
                                    }}
                                    placeholder="Your public artist name..."
                                    style={{ 
                                        backgroundColor: 'rgba(255,255,255,0.05)', 
                                        border: nameError ? `1px solid ${colors.error || '#ef4444'}` : '1px solid transparent', 
                                        borderRadius: borderRadius.sm, 
                                        padding: spacing.sm, 
                                        color: colors.textPrimary 
                                    }}
                                />
                                {validatingName && (
                                    <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Checking name...</span>
                                )}
                                {nameError && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: colors.error || '#ef4444', marginTop: '2px' }}>
                                        <AlertCircle size={14} />
                                        {nameError}
                                    </div>
                                )}
                                <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>This is how your name appears publicly. Leave blank to use your Discord username.</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Bio (Keep it short!)</label>
                                <textarea 
                                    value={profile?.bio || ''} 
                                    onChange={(e) => setProfile(p => p ? {...p, bio: e.target.value} : null)}
                                    placeholder="Producer / DJ / Multi-instrumentalist..."
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>

                            {socialsList.map(social => (
                                <div key={social.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {social.icon} {social.label}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={(profile as any)?.[social.key] || ''}
                                        onChange={(e) => setProfile(p => p ? {...p, [social.key]: e.target.value} : null)}
                                        placeholder={(social as any).placeholder || 'https://...'}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Play size={20} /> Featured Track
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>Select a track to showcase at the top of your profile.</p>
                        <select 
                            value={profile?.featuredTrackId || ''}
                            onChange={(e) => setProfile(p => p ? {...p, featuredTrackId: e.target.value || null} : null)}
                            style={{ 
                                width: '100%', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: borderRadius.sm, 
                                padding: spacing.sm, 
                                color: 'white',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="" style={{ backgroundColor: '#1A1E2E', color: 'white' }}>No featured track</option>
                            {tracks.map(t => (
                                <option key={t.id} value={t.id} style={{ backgroundColor: '#1A1E2E', color: 'white' }}>
                                    {t.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Music size={20} /> Genres
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: spacing.md }}>
                            {profile?.genres?.map(g => (
                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: colors.primary, padding: '4px 8px', borderRadius: '16px', fontSize: '0.85rem' }}>
                                    {g.name}
                                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeGenre(g.id)} />
                                </div>
                            ))}
                        </div>
                        <select 
                            onChange={(e) => {
                                const genre = allGenres.find(g => g.id === e.target.value);
                                if (genre) addGenre(genre);
                                e.target.value = '';
                            }}
                            style={{ 
                                width: '100%', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                border: 'none', 
                                borderRadius: borderRadius.sm, 
                                padding: spacing.sm, 
                                color: colors.textPrimary,
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="" style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>Add a genre...</option>
                            {allGenres.filter(g => !profile?.genres?.some(pg => pg.id === g.id)).map(g => (
                                <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Hammer size={20} /> Gear Rack
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {profile?.gearList?.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        type="text" 
                                        value={item} 
                                        onChange={(e) => updateGear(idx, e.target.value)}
                                        placeholder="FL Studio 21, Serum, DT 990 Pro..."
                                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                    />
                                    <button onClick={(e) => removeGear(idx, e)} style={{ backgroundColor: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                                        <X size={18}/>
                                    </button>
                                </div>
                            ))}
                            <button onClick={(e) => addGear(e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textSecondary, cursor: 'pointer', marginTop: spacing.sm }}>
                                <Plus size={16}/> Add Equipment
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.md, padding: spacing.md, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: 'auto' }}
                    >
                        {saving ? 'Saving...' : <><Save size={20}/> Save Profile</>}
                    </button>
                </div>
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
