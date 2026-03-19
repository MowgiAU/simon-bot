import React, { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';
import axios from 'axios';
import { Play, Pause, Trash2, Camera, Share2, Lock, Globe, Clock, Music, Check } from 'lucide-react';

interface PlaylistTrack {
    id: string;
    position: number;
    track: {
        id: string;
        title: string;
        slug: string | null;
        url: string;
        coverUrl: string | null;
        duration: number | null;
        playCount: number;
        profile: { username: string; displayName: string | null };
    };
}

interface Playlist {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    coverUrl: string | null;
    isPublic: boolean;
    trackCount: number;
    totalPlays: number;
    userId: string;
    createdAt: string;
    updatedAt: string;
    profile?: { username: string; displayName: string | null; avatar: string | null } | null;
    tracks: PlaylistTrack[];
}

const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlaylistPage: React.FC = () => {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { player, setTrack, togglePlay } = usePlayer();
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [copied, setCopied] = useState(false);
    const [coverHovered, setCoverHovered] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (document.querySelector('#playlist-spin-style')) return;
        const style = document.createElement('style');
        style.id = 'playlist-spin-style';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }, []);

    useEffect(() => {
        const parts = pathname.split('/').filter(Boolean);
        const playlistId = parts[1];
        if (!playlistId) return;

        (async () => {
            try {
                const { data } = await axios.get(`/api/playlists/${playlistId}`, { withCredentials: true });
                setPlaylist(data);
                document.title = `${data.name} | Fuji Studio Playlist`;
            } catch (err: any) {
                setError(err.response?.status === 404 ? 'Playlist not found' : err.response?.status === 403 ? 'This playlist is private' : 'Failed to load playlist');
            } finally {
                setLoading(false);
            }
        })();
    }, [pathname]);

    const isOwner = user && playlist && playlist.userId === user.id;

    const playAll = () => {
        if (!playlist || playlist.tracks.length === 0) return;
        const queue = playlist.tracks.sort((a, b) => a.position - b.position).map(pt => ({
            ...pt.track,
            artist: pt.track.profile?.displayName || pt.track.profile?.username || 'Unknown',
            username: pt.track.profile?.username || '',
            cover: pt.track.coverUrl,
        }));
        setTrack(queue[0], queue);
        axios.post(`/api/playlists/${playlist.id}/play`).catch(() => {});
    };

    const removeTrack = async (trackId: string) => {
        if (!playlist) return;
        try {
            await axios.delete(`/api/playlists/${playlist.id}/tracks/${trackId}`, { withCredentials: true });
            setPlaylist(prev => prev ? { ...prev, tracks: prev.tracks.filter(t => t.track.id !== trackId), trackCount: prev.trackCount - 1 } : prev);
        } catch {}
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/playlist/${playlist?.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCoverUpload = async (file: File) => {
        if (!playlist) return;
        setCoverUploading(true);
        try {
            const formData = new FormData();
            formData.append('cover', file);
            const { data } = await axios.post(`/api/playlists/${playlist.id}/cover`, formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPlaylist(prev => prev ? { ...prev, coverUrl: data.coverUrl } : prev);
        } catch {
            // silently fail; UI stays as-is
        } finally {
            setCoverUploading(false);
        }
    };

    if (loading) return <DiscoveryLayout><div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>Loading playlist...</div></DiscoveryLayout>;
    if (error || !playlist) return <DiscoveryLayout><div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: '#EF4444' }}>{error || 'Playlist not found'}</div></DiscoveryLayout>;

    const sortedTracks = [...playlist.tracks].sort((a, b) => a.position - b.position);
    const totalDuration = sortedTracks.reduce((sum, pt) => sum + (pt.track.duration || 0), 0);

    return (
        <DiscoveryLayout>
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1000px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', marginBottom: '32px' }}>
                {/* Cover */}
                    <div
                        style={{ 
                            width: isMobile ? '200px' : '240px', height: isMobile ? '200px' : '240px',
                            borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                            backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.05)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            alignSelf: isMobile ? 'center' : 'flex-start',
                            position: 'relative',
                            cursor: isOwner ? 'pointer' : 'default',
                        }}
                        onClick={() => isOwner && coverInputRef.current?.click()}
                        onMouseEnter={() => isOwner && setCoverHovered(true)}
                        onMouseLeave={() => setCoverHovered(false)}
                    >
                        {playlist.coverUrl ? (
                            <img src={playlist.coverUrl} alt={playlist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${colors.primary}33, ${colors.primaryDark}33)` }}>
                                <Music size={64} color={colors.primary} style={{ opacity: 0.3 }} />
                            </div>
                        )}
                        {isOwner && (coverHovered || coverUploading) && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', gap: '8px',
                                backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
                            }}>
                                {coverUploading ? (
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `3px solid ${colors.primary}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                ) : (
                                    <>
                                        <Camera size={28} color="white" />
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Change Cover</span>
                                    </>
                                )}
                            </div>
                        )}
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleCoverUpload(file);
                                e.target.value = '';
                            }}
                        />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {playlist.isPublic ? <Globe size={14} color="#B9C3CE" /> : <Lock size={14} color="#FBBF24" />}
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {playlist.isPublic ? 'Public Playlist' : 'Private Playlist'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>{playlist.name}</h1>
                        {playlist.description && (
                            <p style={{ color: '#B9C3CE', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.5 }}>{playlist.description}</p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#B9C3CE', flexWrap: 'wrap' }}>
                            {playlist.profile && (
                                <Link to={`/profile/${playlist.profile.username}`} style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                                    {playlist.profile.displayName || playlist.profile.username}
                                </Link>
                            )}
                            <span>{playlist.trackCount} tracks</span>
                            <span>{formatDuration(totalDuration)}</span>
                            <span>{playlist.totalPlays.toLocaleString()} plays</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                            <button
                                onClick={playAll}
                                disabled={playlist.tracks.length === 0}
                                style={{
                                    backgroundColor: colors.primary, color: 'white', border: 'none',
                                    padding: '12px 32px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                                    cursor: playlist.tracks.length > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    boxShadow: `0 4px 15px ${colors.primary}44`, opacity: playlist.tracks.length > 0 ? 1 : 0.5,
                                }}
                            >
                                <Play size={16} fill="white" /> Play All
                            </button>
                            <button
                                onClick={handleCopyLink}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)', color: copied ? '#4caf50' : 'white',
                                    border: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '8px',
                                    fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}
                            >
                                {copied ? <><Check size={14} /> Copied!</> : <><Share2 size={14} /> Share</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Track List */}
                <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px 40px', gap: '12px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        <span>#</span>
                        <span>Title</span>
                        <span style={{ display: isMobile ? 'none' : 'block' }}>Artist</span>
                        <span style={{ textAlign: 'right' }}><Clock size={12} /></span>
                        <span></span>
                    </div>

                    {sortedTracks.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#B9C3CE', fontSize: '13px' }}>
                            No tracks in this playlist yet.
                        </div>
                    ) : (
                        sortedTracks.map((pt, idx) => {
                            const t = pt.track;
                            const isCurrentTrack = player.currentTrack?.id === t.id;
                            return (
                                <div
                                    key={pt.id}
                                    onClick={() => {
                                        const queue = sortedTracks.map(s => ({
                                            ...s.track,
                                            artist: s.track.profile?.displayName || s.track.profile?.username || 'Unknown',
                                            username: s.track.profile?.username || '',
                                            cover: s.track.coverUrl,
                                        }));
                                        if (isCurrentTrack) togglePlay();
                                        else {
                                            setTrack(queue[idx], queue);
                                            axios.post(`/api/playlists/${playlist.id}/play`).catch(() => {});
                                        }
                                    }}
                                    style={{
                                        display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px 40px',
                                        gap: '12px', padding: '10px 20px', alignItems: 'center',
                                        cursor: 'pointer', transition: 'background 0.15s',
                                        backgroundColor: isCurrentTrack ? `${colors.primary}15` : 'transparent',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isCurrentTrack ? `${colors.primary}25` : 'rgba(255,255,255,0.03)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isCurrentTrack ? `${colors.primary}15` : 'transparent'}
                                >
                                    <span style={{ fontSize: '13px', color: isCurrentTrack ? colors.primary : '#B9C3CE', fontWeight: isCurrentTrack ? 'bold' : 'normal' }}>
                                        {isCurrentTrack && player.isPlaying ? <Pause size={14} /> : idx + 1}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#1A1E2E' }}>
                                            {t.coverUrl ? (
                                                <img src={t.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <FujiLogo size={16} color={colors.primary} opacity={0.2} />
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isCurrentTrack ? colors.primary : 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</p>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '12px', color: '#B9C3CE', display: isMobile ? 'none' : 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {t.profile?.displayName || t.profile?.username}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#B9C3CE', textAlign: 'right' }}>{formatDuration(t.duration)}</span>
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        {isOwner && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeTrack(t.id); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B9C3CE', padding: '4px', display: 'flex', opacity: 0.5, transition: 'opacity 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </DiscoveryLayout>
    );
};
