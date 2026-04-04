import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
    Edit3, X, Save, Upload, Download, Heart, ListPlus, Repeat2,
    Activity, Package, ChevronDown, ChevronUp, Trash2, AlignLeft, CheckCircle
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { CommentSection } from '../components/CommentSection';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { ArrangementViewer, ArrangementData, ProjectInfo, ArrangementClip, NoteData, AutomationPoint } from '../components/ArrangementViewer';

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
    lyrics: string | null;
    lyricsSync: Array<{ time: number; text: string }> | null;
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

// Wrapper that creates refs for playback state so ArrangementViewer never re-renders during playback
const MemoizedArrangement: React.FC<{
    track: Track;
    player: any;
    isPlaying: boolean;
    zoom: number;
    setZoom: (v: number) => void;
}> = React.memo(({ track, player, isPlaying, zoom, setZoom }) => {
    const samplesMap = useMemo(() =>
        Object.fromEntries((track.samples ?? []).map(s => [s.originalFilename.toLowerCase(), s.peaks])),
        [track.samples]
    );
    const currentTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    // Update refs silently — no child re-renders
    currentTimeRef.current = player.currentTrack?.id === track.id ? player.currentTime : 0;
    isPlayingRef.current = isPlaying && player.currentTrack?.id === track.id;
    return (
        <ArrangementViewer
            arrangement={track.arrangement!}
            duration={track.duration}
            currentTimeRef={currentTimeRef}
            isPlayingRef={isPlayingRef}
            projectFileUrl={track.projectFileUrl}
            projectZipUrl={track.projectZipUrl}
            trackId={track.id}
            zoom={zoom}
            setZoom={setZoom}
            samplesMap={samplesMap}
        />
    );
});

export const TrackPage: React.FC = () => {
    const { pathname } = useLocation();
    const { user, mutualAdminGuilds } = useAuth();
    const [track, setTrackData] = useState<Track | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [zoom, setZoom] = useState(1);
    const { player, setTrack, togglePlay, seek } = usePlayer();

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
    const [isReposted, setIsReposted] = useState(false);
    const [repostCount, setRepostCount] = useState(0);
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);
    const [expandedSamples, setExpandedSamples] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Lyrics state
    const [lyricsEditOpen, setLyricsEditOpen] = useState(false);
    const [lyricsTab, setLyricsTab] = useState<'write' | 'sync'>('write');
    const [lyricsText, setLyricsText] = useState('');
    const [lyricsSync, setLyricsSync] = useState<Array<{ time: number; text: string }>>([]);
    const [lyricsSaving, setLyricsSaving] = useState(false);
    const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLDivElement>(null);
    const lyricsRafRef = useRef<number>(0);

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
                // Load favourite and repost data
                try {
                    const [countRes, favRes, repostCountRes, repostRes] = await Promise.all([
                        axios.get(`/api/tracks/${res.data.id}/favourite-count`),
                        axios.get(`/api/tracks/${res.data.id}/favourite`, { withCredentials: true }),
                        axios.get(`/api/tracks/${res.data.id}/repost-count`),
                        axios.get(`/api/tracks/${res.data.id}/repost`, { withCredentials: true }),
                    ]);
                    setFavouriteCount(countRes.data.count);
                    setIsFavourited(favRes.data.favourited);
                    setRepostCount(repostCountRes.data.count);
                    setIsReposted(repostRes.data.reposted);
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

    const toggleRepost = async () => {
        if (!track || !user) return;
        if (isOwner) { showToast("You can't repost your own track", 'error'); return; }
        try {
            const { data } = await axios.post(`/api/tracks/${track.id}/repost`, {}, { withCredentials: true });
            setIsReposted(data.reposted);
            setRepostCount(prev => data.reposted ? prev + 1 : prev - 1);
            showToast(data.reposted ? 'Reposted!' : 'Removed repost', 'success');
        } catch {
            showToast('Login to repost tracks', 'error');
        }
    };

    const handleDelete = async () => {
        if (!track) return;
        setDeleting(true);
        try {
            const endpoint = isOwner
                ? `/api/musician/tracks/${track.id}`
                : `/api/admin/tracks/${track.id}`;
            await axios.delete(endpoint, { withCredentials: true });
            showToast('Track deleted', 'success');
            window.location.href = `/profile/${track.profile.username}`;
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to delete track', 'error');
            setDeleting(false);
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

    // ── Synced lyrics: RAF loop to find the active line ──────────────────────
    useEffect(() => {
        if (!track?.lyricsSync || !Array.isArray(track.lyricsSync) || track.lyricsSync.length === 0) return;
        const cues = track.lyricsSync as Array<{ time: number; text: string }>;
        const tick = () => {
            const ct = player.currentTrack?.id === track.id ? player.currentTime : -1;
            if (ct >= 0) {
                let idx = -1;
                for (let i = 0; i < cues.length; i++) {
                    if (cues[i].time <= ct) idx = i; else break;
                }
                setActiveLyricIdx(idx);
            }
            lyricsRafRef.current = requestAnimationFrame(tick);
        };
        lyricsRafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(lyricsRafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [track?.lyricsSync, player.currentTrack?.id, track?.id]);

    // Auto-scroll active lyric line into view
    useEffect(() => {
        if (activeLineRef.current && lyricsContainerRef.current) {
            activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeLyricIdx]);

    const openLyricsEdit = () => {
        if (!track) return;
        const rawLines = track.lyricsSync?.length
            ? track.lyricsSync.map((c: { time: number; text: string }) => c.text).join('\n')
            : (track.lyrics || '');
        setLyricsText(rawLines);
        setLyricsSync(track.lyricsSync ? [...track.lyricsSync] : []);
        setLyricsTab('write');
        setLyricsEditOpen(true);
    };

    const handleLyricsTabSwitch = (tab: 'write' | 'sync') => {
        if (tab === 'sync') {
            const lines = lyricsText.split('\n');
            setLyricsSync(prev => lines.map((text, i) => ({
                time: prev[i]?.time ?? 0,
                text,
            })));
        }
        setLyricsTab(tab);
    };

    const tapSyncTime = (idx: number) => {
        const ct = player.currentTrack?.id === track?.id ? player.currentTime : 0;
        setLyricsSync(prev => prev.map((l, i) => i === idx ? { ...l, time: ct } : l));
    };

    const formatSyncTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = (t % 60).toFixed(1).padStart(4, '0');
        return `${m}:${s}`;
    };

    const parseSyncTime = (val: string): number => {
        const match = val.match(/^(\d+):(\d+(?:\.\d+)?)$/);
        if (!match) return 0;
        return parseInt(match[1]) * 60 + parseFloat(match[2]);
    };

    const handleSaveLyrics = async () => {
        if (!track) return;
        setLyricsSaving(true);
        try {
            const hasSync = lyricsSync.length > 0 && lyricsSync.some(c => c.time > 0);
            const payload = {
                lyrics: lyricsText.trim() || null,
                lyricsSync: hasSync ? lyricsSync : null,
            };
            const res = await axios.put(`/api/musician/tracks/${track.id}/lyrics`, payload, { withCredentials: true });
            setTrackData(d => d ? { ...d, lyrics: res.data.lyrics, lyricsSync: res.data.lyricsSync } : d);
            setLyricsEditOpen(false);
            showToast('Lyrics saved!', 'success');
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to save lyrics', 'error');
        } finally {
            setLyricsSaving(false);
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
            <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '16px' : spacing.xl }}>
                {/* ═══ HERO SECTION ═══ */}
                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
                    {/* Blurred background */}
                    {track.coverUrl && (
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${track.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(40px) brightness(0.3)', transform: 'scale(1.2)' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(14,18,26,0.92) 0%, rgba(14,18,26,0.75) 100%)` }} />
                    
                    <div style={{ position: 'relative', padding: isMobile ? '20px' : '40px' }}>
                        {/* Back link */}
                        <button 
                            onClick={() => window.location.href = `/profile/${track.profile.username}`}
                            style={{ background: 'none', border: 'none', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: 0, marginBottom: '24px', fontSize: '13px' }}
                        >
                            <ArrowLeft size={14} /> {track.profile.displayName || track.profile.username}
                        </button>

                        <div style={{ display: 'flex', gap: isMobile ? '16px' : '32px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-start' }}>
                            {/* Cover art */}
                            <div style={{ 
                                width: isMobile ? '200px' : '280px', height: isMobile ? '200px' : '280px', 
                                borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
                                position: 'relative', cursor: 'pointer',
                            }}
                                onClick={() => player.currentTrack?.id === track.id ? togglePlay() : setTrack(track, [track])}
                            >
                                {track.coverUrl ? (
                                    <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

                            {/* Track info */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', textAlign: isMobile ? 'center' : 'left' }}>
                                <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.8rem', margin: '0 0 8px', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{track.title}</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', color: colors.textSecondary, marginBottom: '16px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    by <a href={`/profile/${track.profile.username}`} style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>{track.profile.displayName || track.profile.username}</a>
                                </div>

                                {/* Quick metadata badges */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    {track.bpm && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(242,123,19,0.15)', border: '1px solid rgba(242,123,19,0.3)', fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                                            <Activity size={13} /> {track.bpm} BPM
                                        </span>
                                    )}
                                    {track.key && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', fontSize: '13px', fontWeight: 600, color: '#A78BFA' }}>
                                            <Tag size={13} /> {track.key}
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: colors.textSecondary }}>
                                        <Clock size={13} /> {formatDuration(track.duration)}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: colors.textSecondary }}>
                                        <Calendar size={13} /> {new Date(track.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Genre tags */}
                                {track.genres && track.genres.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                        {track.genres.map(g => (
                                            <span key={g.genre.id} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textSecondary, padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                {g.genre.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Stats row */}
                                <div style={{ display: 'flex', gap: isMobile ? '16px' : '24px', marginBottom: '20px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    {[
                                        { icon: <Play size={14} fill={colors.textSecondary} />, value: track.playCount.toLocaleString(), label: 'plays' },
                                        { icon: <Heart size={14} fill={isFavourited ? '#EF4444' : 'none'} color={isFavourited ? '#EF4444' : colors.textSecondary} />, value: favouriteCount.toLocaleString(), label: 'likes' },
                                        { icon: <Repeat2 size={14} color={isReposted ? colors.primary : colors.textSecondary} />, value: repostCount.toLocaleString(), label: 'reposts' },
                                    ].map((stat, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.textSecondary }}>
                                            {stat.icon}
                                            <span style={{ fontWeight: 700, color: colors.textPrimary }}>{stat.value}</span> {stat.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    <button onClick={() => player.currentTrack?.id === track.id ? togglePlay() : setTrack(track, [track])}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: `0 4px 16px ${colors.primary}44` }}>
                                        {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />} {isPlaying ? 'Pause' : 'Play'}
                                    </button>
                                    <button onClick={toggleFavourite}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', border: isFavourited ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.15)', backgroundColor: isFavourited ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: isFavourited ? '#EF4444' : 'white', transition: 'all 0.2s' }}>
                                        <Heart size={15} fill={isFavourited ? '#EF4444' : 'none'} /> {isFavourited ? 'Liked' : 'Like'}
                                    </button>
                                    {!isOwner && (
                                    <button onClick={toggleRepost}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', border: isReposted ? `1px solid ${colors.primary}` : '1px solid rgba(255,255,255,0.15)', backgroundColor: isReposted ? `${colors.primary}22` : 'rgba(255,255,255,0.05)', color: isReposted ? colors.primary : 'white', transition: 'all 0.2s' }}>
                                        <Repeat2 size={15} /> {isReposted ? 'Reposted' : 'Repost'}
                                    </button>
                                    )}
                                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied!', 'success'); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                        <Share2 size={15} /> Share
                                    </button>
                                    {user && (
                                        <button onClick={() => setShowPlaylistModal(true)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                            <ListPlus size={15} /> Playlist
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={openEditMode}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: `1px solid ${colors.primary}44`, backgroundColor: `${colors.primary}11`, color: colors.primary, cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                            <Edit3 size={15} /> Edit
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => setDeleteConfirmOpen(true)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                            <Trash2 size={15} /> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description */}
                {track.description && (
                    <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `4px solid ${colors.primary}`, marginBottom: '24px' }}>
                        <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{track.description}</p>
                    </div>
                )}

                {/* ═══ FL STUDIO PROJECT SECTION ═══ */}
                {track.arrangement && (track.arrangement.tracks.some(t => t.clips.length > 0) || track.arrangement.projectInfo) && (
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
                                        {track.arrangement.bpm && `${track.arrangement.bpm} BPM`}
                                        {track.arrangement.bpm && track.arrangement.tracks.length > 0 && ' · '}
                                        {track.arrangement.tracks.length > 0 && `${track.arrangement.tracks.filter(t => t.clips.length > 0).length} tracks`}
                                        {track.arrangement.projectInfo && track.arrangement.projectInfo.plugins.length > 0 && ` · ${track.arrangement.projectInfo.plugins.length} plugins`}
                                    </p>
                                </div>
                            </div>

                            {/* Download buttons */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {track.projectFileUrl && (track.allowProjectDownload ?? true) && (
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
                                            onConfirm={() => { setFlpConfirmOpen(false); window.open(track.projectFileUrl!, '_blank'); }}
                                            onCancel={() => setFlpConfirmOpen(false)}
                                        />
                                    </>
                                )}
                                {track.projectZipUrl && (track.allowProjectDownload ?? true) && (
                                    <a href={track.projectZipUrl.startsWith('http') ? track.projectZipUrl : `/api/tracks/${track.id}/download-zip`}
                                        download={`${track.title || 'project'}_loop_package.zip`}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '12px', textDecoration: 'none', cursor: 'pointer' }}>
                                        <Package size={14} /> Download Project
                                    </a>
                                )}
                                {track.allowAudioDownload && (
                                    <button onClick={() => window.open(track.url, '_blank')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                                        <Download size={14} /> Audio
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Plugins & Samples */}
                        {track.arrangement.projectInfo && (track.arrangement.projectInfo.plugins.length > 0 || track.arrangement.projectInfo.samples.length > 0) && (
                            <div style={{ padding: isMobile ? '16px 20px' : '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (track.arrangement.projectInfo.plugins.length > 0 && track.arrangement.projectInfo.samples.length > 0 ? '1fr 1fr' : '1fr'), gap: '20px' }}>
                                    {/* Plugins */}
                                    {track.arrangement.projectInfo.plugins.length > 0 && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <Zap size={15} color={colors.primary} />
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Plugins ({track.arrangement.projectInfo.plugins.length})
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {track.arrangement.projectInfo.plugins.map((plugin, i) => (
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
                                    {track.arrangement.projectInfo.samples.length > 0 && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <FileAudio size={15} color="#A78BFA" />
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Samples ({track.arrangement.projectInfo.samples.length})
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(expandedSamples ? track.arrangement.projectInfo.samples : track.arrangement.projectInfo.samples.slice(0, 12)).map((sample, i) => (
                                                    <span key={i} style={{
                                                        padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                                                        backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)',
                                                        color: '#C4A8FF', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>{sample}</span>
                                                ))}
                                            </div>
                                            {track.arrangement.projectInfo.samples.length > 12 && (
                                                <button onClick={() => setExpandedSamples(!expandedSamples)}
                                                    style={{ marginTop: '8px', background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                    {expandedSamples ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {track.arrangement.projectInfo.samples.length} samples</>}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Arrangement timeline */}
                        {track.arrangement.tracks.some(t => t.clips.length > 0) && (
                            <div style={{ padding: isMobile ? '16px 20px' : '20px 28px' }}>
                                <MemoizedArrangement
                                    track={track}
                                    player={player}
                                    isPlaying={isPlaying}
                                    zoom={zoom}
                                    setZoom={setZoom}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ TRACK DETAILS (no FLP) ═══ */}
                {!track.arrangement && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                        {track.allowAudioDownload && (
                            <button onClick={() => window.open(track.url, '_blank')}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                                <Download size={16} /> Download Audio
                            </button>
                        )}
                    </div>
                )}

                {/* Additional metadata */}
                {(track.artist || track.album || track.year) && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                        {track.artist && <InfoItem icon={<Info size={16}/>} label="Artist" value={track.artist} />}
                        {track.album && <InfoItem icon={<Music size={16}/>} label="Album" value={track.album} />}
                        {track.year && <InfoItem icon={<Calendar size={16}/>} label="Year" value={track.year.toString()} />}
                    </div>
                )}

                {/* Comments */}
                <CommentSection trackId={track.id} ownerId={track.profile.userId} />

                {/* ═══ LYRICS SECTION ═══ */}
                {(track.lyrics || (track.lyricsSync && track.lyricsSync.length > 0) || canEdit) && (
                    <div style={{
                        marginBottom: '24px', borderRadius: '16px', overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                    }}>
                        <div style={{
                            padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <AlignLeft size={18} color={colors.primary} />
                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Lyrics</span>
                                {track.lyricsSync && track.lyricsSync.length > 0 && (
                                    <span style={{
                                        fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                                        borderRadius: '20px', background: `${colors.primary}22`,
                                        border: `1px solid ${colors.primary}44`, color: colors.primary,
                                    }}>Synced</span>
                                )}
                            </div>
                            {canEdit && (
                                <button
                                    onClick={openLyricsEdit}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                                        border: `1px solid ${colors.primary}44`, background: `${colors.primary}11`,
                                        color: colors.primary, fontSize: '13px', fontWeight: 600,
                                    }}
                                >
                                    <Edit3 size={13} /> {track.lyrics || track.lyricsSync ? 'Edit' : 'Add Lyrics'}
                                </button>
                            )}
                        </div>

                        <div style={{ padding: '20px 24px' }}>
                            {!track.lyrics && (!track.lyricsSync || track.lyricsSync.length === 0) && (
                                <p style={{ margin: 0, color: colors.textTertiary, fontSize: '0.9rem', fontStyle: 'italic' }}>
                                    No lyrics added yet.
                                </p>
                            )}

                            {/* Synced lyrics view */}
                            {track.lyricsSync && track.lyricsSync.length > 0 ? (
                                <div
                                    ref={lyricsContainerRef}
                                    style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '8px' }}
                                >
                                    {(track.lyricsSync as Array<{ time: number; text: string }>).map((cue, i) => (
                                        <div
                                            key={i}
                                            ref={i === activeLyricIdx ? activeLineRef : undefined}
                                            onClick={() => {
                                                if (player.currentTrack?.id === track.id) seek(cue.time);
                                                else setTrack(track, [track]);
                                            }}
                                            style={{
                                                padding: '7px 0', cursor: 'pointer',
                                                fontSize: activeLyricIdx === i ? '1.1rem' : '0.95rem',
                                                fontWeight: activeLyricIdx === i ? 700 : 400,
                                                color: activeLyricIdx === i ? colors.primary : colors.textSecondary,
                                                transition: 'all 0.25s ease',
                                                lineHeight: 1.5,
                                                userSelect: 'none' as const,
                                            }}
                                        >
                                            {cue.text || <span style={{ opacity: 0.3 }}>♪</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : track.lyrics ? (
                                <pre style={{
                                    margin: 0, color: colors.textSecondary, fontFamily: 'inherit',
                                    whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.93rem',
                                }}>
                                    {track.lyrics}
                                </pre>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* ═══ LYRICS EDITOR MODAL ═══ */}
                {lyricsEditOpen && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}>
                        <div style={{
                            backgroundColor: colors.surface, borderRadius: borderRadius.lg,
                            border: '1px solid rgba(255,255,255,0.1)',
                            width: '100%', maxWidth: '680px', maxHeight: '90vh',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <AlignLeft size={20} color={colors.primary} />
                                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Edit Lyrics</h2>
                                </div>
                                <button onClick={() => setLyricsEditOpen(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}>
                                    <X size={22} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {(['write', 'sync'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => handleLyricsTabSwitch(t)}
                                        style={{
                                            flex: 1, padding: '12px', border: 'none', cursor: 'pointer',
                                            background: lyricsTab === t ? `${colors.primary}18` : 'transparent',
                                            color: lyricsTab === t ? colors.primary : colors.textSecondary,
                                            fontWeight: lyricsTab === t ? 700 : 400, fontSize: '0.9rem',
                                            borderBottom: lyricsTab === t ? `2px solid ${colors.primary}` : '2px solid transparent',
                                        }}
                                    >
                                        {t === 'write' ? '✏ Write' : '⏱ Sync'}
                                    </button>
                                ))}
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                                {lyricsTab === 'write' && (
                                    <div>
                                        <p style={{ margin: '0 0 12px', fontSize: '13px', color: colors.textSecondary }}>
                                            Paste or type your lyrics. Each line will become a sync-able cue. Switch to the Sync tab to timestamp each line.
                                        </p>
                                        <textarea
                                            value={lyricsText}
                                            onChange={e => setLyricsText(e.target.value)}
                                            placeholder={'Verse 1\nYour lyrics here...\n\nChorus\nSing along...'}
                                            rows={18}
                                            style={{
                                                width: '100%', boxSizing: 'border-box' as const,
                                                backgroundColor: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: borderRadius.md, padding: '14px',
                                                color: colors.textPrimary, fontSize: '14px', lineHeight: 1.7,
                                                resize: 'vertical' as const, fontFamily: 'inherit', outline: 'none',
                                            }}
                                        />
                                    </div>
                                )}

                                {lyricsTab === 'sync' && (
                                    <div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            marginBottom: '12px', padding: '10px 14px',
                                            backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md,
                                            border: '1px solid rgba(255,255,255,0.07)',
                                        }}>
                                            <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                                                Play the track and click <strong style={{ color: colors.textPrimary }}>Tap</strong> on each line at the right moment.
                                            </span>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: colors.primary, minWidth: 60, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>
                                                {formatSyncTime(player.currentTrack?.id === track?.id ? player.currentTime : 0)}
                                            </span>
                                        </div>

                                        {lyricsSync.length === 0 && (
                                            <p style={{ color: colors.textTertiary, fontStyle: 'italic', fontSize: '13px' }}>
                                                No lines yet — go back to Write and add your lyrics first.
                                            </p>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {lyricsSync.map((cue, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={formatSyncTime(cue.time)}
                                                        onChange={e => {
                                                            const t = parseSyncTime(e.target.value);
                                                            if (!isNaN(t)) setLyricsSync(prev => prev.map((l, j) => j === i ? { ...l, time: t } : l));
                                                        }}
                                                        style={{
                                                            width: '72px', flexShrink: 0, textAlign: 'center' as const,
                                                            padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm,
                                                            color: colors.primary, fontSize: '12px', fontFamily: 'monospace', outline: 'none',
                                                        }}
                                                    />
                                                    <span style={{
                                                        flex: 1, fontSize: '14px', color: cue.text ? colors.textPrimary : colors.textTertiary,
                                                        fontStyle: cue.text ? 'normal' : 'italic',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                                                    }}>
                                                        {cue.text || '(empty line)'}
                                                    </span>
                                                    <button
                                                        onClick={() => tapSyncTime(i)}
                                                        style={{
                                                            flexShrink: 0, padding: '5px 12px', borderRadius: borderRadius.sm,
                                                            border: `1px solid ${colors.primary}55`, background: `${colors.primary}18`,
                                                            color: colors.primary, fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                                        }}
                                                    >
                                                        Tap
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setLyricsEditOpen(false)}
                                    style={{ padding: '9px 20px', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: colors.textSecondary, cursor: 'pointer', fontSize: '14px' }}
                                >
                                    Cancel
                                </button>
                                {(track.lyrics || (track.lyricsSync && track.lyricsSync.length > 0)) && (
                                    <button
                                        onClick={async () => {
                                            setLyricsSaving(true);
                                            try {
                                                await axios.put(`/api/musician/tracks/${track.id}/lyrics`, { lyrics: null, lyricsSync: null }, { withCredentials: true });
                                                setTrackData(d => d ? { ...d, lyrics: null, lyricsSync: null } : d);
                                                setLyricsEditOpen(false);
                                                showToast('Lyrics removed', 'success');
                                            } catch { showToast('Failed to remove lyrics', 'error'); }
                                            finally { setLyricsSaving(false); }
                                        }}
                                        style={{ padding: '9px 20px', borderRadius: borderRadius.md, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                        Remove Lyrics
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveLyrics}
                                    disabled={lyricsSaving}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '7px',
                                        padding: '9px 20px', borderRadius: borderRadius.md, border: 'none',
                                        background: colors.primary, color: 'white', cursor: lyricsSaving ? 'not-allowed' : 'pointer',
                                        fontSize: '14px', fontWeight: 700, opacity: lyricsSaving ? 0.7 : 1,
                                    }}
                                >
                                    <CheckCircle size={15} /> {lyricsSaving ? 'Saving…' : 'Save Lyrics'}
                                </button>
                            </div>
                        </div>
                    </div>
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
            <ConfirmModal
                open={deleteConfirmOpen}
                title="Delete Track"
                message={`Are you sure you want to permanently delete "${track?.title}"? This will remove the audio file, artwork, and project file. This cannot be undone.`}
                confirmLabel={deleting ? 'Deleting...' : 'Delete Track'}
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
            />
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

