import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { ConfirmModal } from '../components/ConfirmModal';
import { Settings, Plus, X, List, Music, Database, Edit3, Trash2, Star, Search, Tag, ExternalLink, ShieldOff, UserX, UserCheck, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

interface TrackResult {
    id: string;
    title: string;
    slug: string;
    artist: string | null;
    coverUrl: string | null;
    playCount: number;
    profile: { displayName: string | null; username: string };
}

interface DiscoveryConfig {
    featuredTrackId: string | null;
    featuredLabel: string | null;
    featuredTrack: TrackResult | null;
}

export const MusicianProfileAdmin: React.FC = () => {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGenreName, setNewGenreName] = useState('');
    const [newGenreParent, setNewGenreParent] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Discovery settings state
    const [discoveryConfig, setDiscoveryConfig] = useState<DiscoveryConfig>({ featuredTrackId: null, featuredLabel: null, featuredTrack: null });
    const [trackSearch, setTrackSearch] = useState('');
    const [trackResults, setTrackResults] = useState<TrackResult[]>([]);
    const [searchingTracks, setSearchingTracks] = useState(false);
    const [featuredLabel, setFeaturedLabel] = useState('');

    // Admin wipe state
    const [adminSearch, setAdminSearch] = useState('');
    const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
    const [searchingProfiles, setSearchingProfiles] = useState(false);
    const [confirmWipe, setConfirmWipe] = useState<string | null>(null);

    // Moderation state
    const [modSearch, setModSearch] = useState('');
    const [modProfiles, setModProfiles] = useState<any[]>([]);
    const [searchingMod, setSearchingMod] = useState(false);
    const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
    const [profileTracks, setProfileTracks] = useState<Record<string, any[]>>({});
    const [loadingTracks, setLoadingTracks] = useState<string | null>(null);
    const [statusReason, setStatusReason] = useState<Record<string, string>>({});

    // FLP reprocessing state
    const [reprocessing, setReprocessing] = useState(false);

    // Admin track management state
    const [adminTrackSearch, setAdminTrackSearch] = useState('');
    const [adminTracks, setAdminTracks] = useState<TrackResult[]>([]);
    const [searchingAdminTracks, setSearchingAdminTracks] = useState(false);

    useEffect(() => {
        fetchGenres();
        fetchDiscoverySettings();
    }, []);

    const handleSearchProfiles = async (query: string) => {
        setAdminSearch(query);
        if (query.length < 2) { setAdminProfiles([]); return; }
        setSearchingProfiles(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setAdminProfiles(res.data);
        } catch (err) {
            console.error('Failed to search profiles');
        } finally {
            setSearchingProfiles(false);
        }
    };

    const handleWipeProfile = async (id: string) => {
        setSaving(true);
        try {
            await axios.post(`/api/admin/musician/profile/${id}/wipe`, {}, { withCredentials: true });
            setMsg({ type: 'success', text: 'Profile and all associated content wiped successfully.' });
            setConfirmWipe(null);
            setAdminProfiles(adminProfiles.filter(p => p.id !== id));
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to wipe profile' });
        } finally {
            setSaving(false);
        }
    };

    const fetchGenres = async () => {
        try {
            const res = await axios.get('/api/musician/genres', { withCredentials: true });
            // Sort by name for easier navigation
            const sorted = [...res.data].sort((a: Genre, b: Genre) => a.name.localeCompare(b.name));
            setGenres(sorted);
        } catch (err) {
            console.error('Failed to load genres');
        } finally {
            setLoading(false);
        }
    };

    const fetchDiscoverySettings = async () => {
        try {
            const res = await axios.get('/api/discovery/settings', { withCredentials: true });
            setDiscoveryConfig(res.data);
            setFeaturedLabel(res.data.featuredLabel || '');
        } catch (err) {
            console.error('Failed to load discovery settings');
        }
    };

    const handleSearchTracks = async (query: string) => {
        setTrackSearch(query);
        if (query.length < 2) { setTrackResults([]); return; }
        setSearchingTracks(true);
        try {
            const res = await axios.get('/api/discovery/tracks/search', { params: { search: query }, withCredentials: true });
            setTrackResults(res.data);
        } catch (err) {
            console.error('Failed to search tracks');
        } finally {
            setSearchingTracks(false);
        }
    };

    const handleSetFeaturedTrack = async (trackId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredTrackId: trackId, 
                featuredLabel: featuredLabel || null 
            }, { withCredentials: true });
            setMsg({ type: 'success', text: trackId ? 'Featured track updated!' : 'Featured track removed.' });
            fetchDiscoverySettings();
            setTrackSearch('');
            setTrackResults([]);
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Failed to update featured track' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveFeaturedLabel = async () => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredTrackId: discoveryConfig.featuredTrackId, 
                featuredLabel: featuredLabel || null 
            }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Featured label updated!' });
            fetchDiscoverySettings();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update label' });
        } finally {
            setSaving(false);
        }
    };

    const handleReprocessFlps = () => {
        setConfirmDialog({
            title: 'Re-process All Project Files',
            message: 'This will go through all project files on the server and re-run the arrangement parser. It may take a minute and overwrite existing arrangement data. Proceed?',
            onConfirm: async () => {
                setConfirmDialog(null);
                setReprocessing(true);
                setMsg({ type: 'success', text: 'Reprocessing started... Please wait.' });
                try {
                    const res = await axios.post('/api/admin/reprocess-flps', {}, { withCredentials: true });
                    setMsg({ 
                        type: 'success', 
                        text: `Successfully re-processed ${res.data.success} tracks! ${res.data.failed > 0 ? `(${res.data.failed} failed: ${res.data.errors[0] || 'Check logs'})` : ''}` 
                    });
                } catch (err: any) {
                    setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to re-process FLPs' });
                } finally {
                    setReprocessing(false);
                }
            }
        });
    };

    const handleSearchAdminTracks = async (query: string) => {
        setAdminTrackSearch(query);
        if (query.length < 2) { setAdminTracks([]); return; }
        setSearchingAdminTracks(true);
        try {
            const res = await axios.get('/api/admin/tracks', { params: { search: query }, withCredentials: true });
            setAdminTracks(res.data);
        } catch (err) {
            console.error('Failed to search tracks');
        } finally {
            setSearchingAdminTracks(false);
        }
    };

    const handleSearchMod = async (query: string) => {
        setModSearch(query);
        if (query.length < 2) { setModProfiles([]); return; }
        setSearchingMod(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setModProfiles(res.data);
        } catch (err) {
            console.error('Failed to search profiles for moderation');
        } finally {
            setSearchingMod(false);
        }
    };

    const handleToggleProfileTracks = async (profileId: string) => {
        if (expandedProfileId === profileId) {
            setExpandedProfileId(null);
            return;
        }
        setExpandedProfileId(profileId);
        if (profileTracks[profileId]) return;
        setLoadingTracks(profileId);
        try {
            const res = await axios.get(`/api/admin/musician/profiles/${profileId}/tracks`, { withCredentials: true });
            setProfileTracks(prev => ({ ...prev, [profileId]: res.data }));
        } catch (err) {
            console.error('Failed to fetch tracks');
        } finally {
            setLoadingTracks(null);
        }
    };

    const handleSetProfileStatus = async (profileId: string, status: string) => {
        const reason = statusReason[profileId] || '';
        try {
            await axios.patch(`/api/admin/musician/profiles/${profileId}/status`, { status, reason }, { withCredentials: true });
            setModProfiles(prev => prev.map(p => p.id === profileId ? { ...p, status, statusReason: reason } : p));
            setMsg({ type: 'success', text: `Profile status set to "${status}".` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update status' });
        }
    };

    const handleSetTrackStatus = async (profileId: string, trackId: string, status: string) => {
        const reason = statusReason[trackId] || '';
        try {
            await axios.patch(`/api/admin/tracks/${trackId}/status`, { status, reason }, { withCredentials: true });
            setProfileTracks(prev => ({
                ...prev,
                [profileId]: (prev[profileId] || []).map((t: any) => t.id === trackId ? { ...t, status, statusReason: reason } : t)
            }));
            setMsg({ type: 'success', text: `Track status set to "${status}".` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update track status' });
        }
    };

    const handleAddGenre = async () => {
        if (!newGenreName) return;
        setSaving(true);
        try {
            await axios.post('/api/musician/genres', {
                name: newGenreName,
                parentId: newGenreParent || null
            }, { withCredentials: true });
            setNewGenreName('');
            setNewGenreParent('');
            setMsg({ type: 'success', text: 'Genre added successfully!' });
            fetchGenres();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to add genre' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGenre = (id: string) => {
        const genre = genres.find(g => g.id === id);
        setConfirmDialog({
            title: 'Delete Genre',
            message: `Are you sure you want to delete "${genre?.name || 'this genre'}"? This will affect all users with this genre!`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await axios.delete(`/api/musician/genres/${id}`, { withCredentials: true });
                    setMsg({ type: 'success', text: 'Genre deleted.' });
                    fetchGenres();
                } catch (err) {
                    setMsg({ type: 'error', text: 'Failed to delete genre' });
                }
            }
        });
    };

    if (loading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading admin settings...</div>;

    // A "root" genre is any genre that does NOT have a parentId
    const rootGenres = genres.filter(g => !g.parentId);
    // A "sub" genre is any genre that DOES have a parentId
    const allSubGenres = genres.filter(g => !!g.parentId);

    return (
        <>
        <div style={{ padding: isMobile ? '24px 16px' : spacing.lg, maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Settings size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Musician Profiles Configuration</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage global genre libraries and profile settings.</p>
                </div>
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Administrators can manage the list of genres users can pick from. Deleting a genre will remove it from all user profiles.
                </p>
            </div>

            {msg && (
                <div style={{ padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, backgroundColor: msg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', color: msg.type === 'success' ? '#4caf50' : '#f44336' }}>
                    {msg.text}
                </div>
            )}

            {/* Discovery Settings Section */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.xl }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.lg }}>
                    <Star size={20} color={colors.primary} /> Discovery Page Settings
                </h3>
                
                {/* Current Featured Track */}
                <div style={{ marginBottom: spacing.lg }}>
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Featured Track (Hero Section)</label>
                    {discoveryConfig.featuredTrack ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {discoveryConfig.featuredTrack.coverUrl ? (
                                <img src={discoveryConfig.featuredTrack.coverUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={24} color={colors.textSecondary} />
                                </div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{discoveryConfig.featuredTrack.title}</div>
                                <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
                                    by {discoveryConfig.featuredTrack.profile?.displayName || discoveryConfig.featuredTrack.profile?.username}
                                    {' '}&bull; {discoveryConfig.featuredTrack.playCount} plays
                                </div>
                            </div>
                            <button onClick={() => handleSetFeaturedTrack(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginTop: '8px', color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            No featured track set. The hero section will display a placeholder.
                        </div>
                    )}
                </div>

                {/* Search for tracks */}
                <div style={{ marginBottom: spacing.lg }}>
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Search for a track to feature</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={trackSearch}
                            onChange={(e) => handleSearchTracks(e.target.value)}
                            placeholder="Search by track title, artist name..."
                            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none' }}
                        />
                    </div>
                    {trackResults.length > 0 && (
                        <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '240px', overflowY: 'auto' }}>
                            {trackResults.map(track => (
                                <div key={track.id} onClick={() => handleSetFeaturedTrack(track.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    {track.coverUrl ? (
                                        <img src={track.coverUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={colors.textSecondary} /></div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{track.profile?.displayName || track.profile?.username} &bull; {track.playCount} plays</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {searchingTracks && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '8px' }}>Searching...</div>}
                </div>

                {/* Featured Label */}
                <div>
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Hero Section Label (optional)</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <input
                            type="text"
                            value={featuredLabel}
                            onChange={(e) => setFeaturedLabel(e.target.value)}
                            placeholder='e.g. "Track of the Week"'
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none' }}
                        />
                        <button onClick={handleSaveFeaturedLabel} disabled={saving}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            Save
                        </button>
                    </div>
                </div>

                {/* System Maintenance */}
                <div style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.md, fontSize: '1rem', color: colors.textSecondary }}>
                        <Settings size={18} /> System Maintenance
                    </h3>
                    <div className="settings-explanation" style={{ backgroundColor: 'rgba(255,152,0,0.05)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, borderLeft: `4px solid #ff9800` }}>
                        <p style={{ margin: 0, color: colors.textPrimary, fontSize: '0.9rem' }}>
                            Update logic for <b>FLP arrangements</b> (Automation curves, Plugin listing, etc.) has been improved. 
                            Click below to re-process all tracks currently in the database without requiring users to re-upload.
                        </p>
                    </div>
                    <button 
                        onClick={handleReprocessFlps} 
                        disabled={reprocessing}
                        style={{ 
                            backgroundColor: 'transparent', 
                            color: reprocessing ? colors.textSecondary : '#ff9800', 
                            border: `1px solid ${reprocessing ? colors.textSecondary : '#ff9800'}`, 
                            borderRadius: borderRadius.sm, 
                            padding: `${spacing.sm} ${spacing.lg}`, 
                            cursor: reprocessing ? 'default' : 'pointer', 
                            fontWeight: 'bold', 
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {reprocessing ? 'Reprocessing...' : 'Re-process all FLP files'}
                    </button>
                </div>
            </div>

            {/* Admin Track Management */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.xl }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.md }}>
                    <Edit3 size={20} color={colors.primary} /> Track Management
                </h3>
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>
                    Search for any track to view or edit it. You can modify metadata, re-upload files, or fix BPM on the track page.
                </p>
                <div style={{ position: 'relative', marginBottom: spacing.md }}>
                    <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={adminTrackSearch}
                        onChange={(e) => handleSearchAdminTracks(e.target.value)}
                        placeholder="Search tracks by title, artist, or username..."
                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {searchingAdminTracks && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '8px' }}>Searching...</div>}
                {adminTracks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {adminTracks.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.05)' }}>
                                {t.coverUrl ? (
                                    <img src={t.coverUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Music size={18} color={colors.textSecondary} />
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                                        by {t.profile?.displayName || t.profile?.username} &bull; {t.playCount} plays
                                    </div>
                                </div>
                                <a
                                    href={`/track/${t.profile?.username}/${t.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.primary, border: `1px solid ${colors.primary}33`, borderRadius: borderRadius.sm, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    <ExternalLink size={14} /> View & Edit
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Artist Moderation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.xl, border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.md }}>
                    <ShieldOff size={20} color="#ff9800" /> Artist Moderation
                </h3>
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>
                    Suspend or ban artists to hide their profile and all tracks from public view. Suspended accounts can be reinstated at any time. Banned accounts are treated the same but indicated as a permanent action.
                </p>
                <div style={{ position: 'relative', marginBottom: spacing.md }}>
                    <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={modSearch}
                        onChange={(e) => handleSearchMod(e.target.value)}
                        placeholder="Search by username, display name, or Discord ID..."
                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {searchingMod && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '8px' }}>Searching...</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modProfiles.map(p => {
                        const isExpanded = expandedProfileId === p.id;
                        const statusColor = p.status === 'active' ? '#4caf50' : p.status === 'banned' ? '#f44336' : '#ff9800';
                        const statusBg = p.status === 'active' ? 'rgba(76,175,80,0.1)' : p.status === 'banned' ? 'rgba(244,67,54,0.1)' : 'rgba(255,152,0,0.1)';
                        return (
                            <div key={p.id} style={{ border: `1px solid rgba(255,255,255,0.07)`, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                                {/* Profile Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#242C3D', overflow: 'hidden', flexShrink: 0 }}>
                                        {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserX size={16} color={colors.textSecondary} /></div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {p.displayName || p.username}
                                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: statusBg, color: statusColor, textTransform: 'uppercase' }}>{p.status || 'active'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{p._count?.tracks ?? '?'} tracks • @{p.username}</div>
                                        {p.statusReason && <div style={{ fontSize: '0.7rem', color: '#ff9800', marginTop: '2px' }}>Reason: {p.statusReason}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                        {(p.status !== 'active') && (
                                            <button onClick={() => handleSetProfileStatus(p.id, 'active')}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(76,175,80,0.1)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <UserCheck size={13} /> Reinstate
                                            </button>
                                        )}
                                        {(p.status !== 'suspended') && (
                                            <button onClick={() => handleSetProfileStatus(p.id, 'suspended')}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,152,0,0.1)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <ShieldOff size={13} /> Suspend
                                            </button>
                                        )}
                                        {(p.status !== 'banned') && (
                                            <button onClick={() => handleSetProfileStatus(p.id, 'banned')}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.3)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <UserX size={13} /> Ban
                                            </button>
                                        )}
                                        <button onClick={() => handleToggleProfileTracks(p.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Tracks
                                        </button>
                                    </div>
                                </div>
                                {/* Reason Input */}
                                <div style={{ padding: '6px 12px', backgroundColor: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <input
                                        type="text"
                                        placeholder="Optional reason / note for this action..."
                                        value={statusReason[p.id] || ''}
                                        onChange={(e) => setStatusReason(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        style={{ width: '100%', backgroundColor: 'transparent', border: 'none', outline: 'none', color: colors.textSecondary, fontSize: '12px', padding: '2px 0', boxSizing: 'border-box' }}
                                    />
                                </div>
                                {/* Expanded Tracks */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px' }}>
                                        {loadingTracks === p.id && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, padding: '8px 0' }}>Loading tracks...</div>}
                                        {profileTracks[p.id]?.length === 0 && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, padding: '8px 0', fontStyle: 'italic' }}>No tracks.</div>}
                                        {(profileTracks[p.id] || []).map((t: any) => {
                                            const tStatusColor = t.status === 'active' ? '#4caf50' : t.status === 'deleted' ? '#f44336' : '#ff9800';
                                            const tStatusBg = t.status === 'active' ? 'rgba(76,175,80,0.1)' : t.status === 'deleted' ? 'rgba(244,67,54,0.1)' : 'rgba(255,152,0,0.1)';
                                            return (
                                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                    {t.coverUrl ? (
                                                        <img src={t.coverUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                                                    ) : (
                                                        <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Music size={14} color={colors.textSecondary} />
                                                        </div>
                                                    )}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {t.title}
                                                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 99, backgroundColor: tStatusBg, color: tStatusColor, textTransform: 'uppercase', flexShrink: 0 }}>{t.status || 'active'}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: colors.textSecondary }}>{t.playCount} plays</div>
                                                        {t.statusReason && <div style={{ fontSize: '0.7rem', color: '#ff9800' }}>Reason: {t.statusReason}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Reason..."
                                                            value={statusReason[t.id] || ''}
                                                            onChange={(e) => setStatusReason(prev => ({ ...prev, [t.id]: e.target.value }))}
                                                            style={{ width: '100px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', outline: 'none', color: colors.textSecondary, fontSize: '11px', padding: '3px 6px' }}
                                                        />
                                                        {t.status !== 'active' && (
                                                            <button onClick={() => handleSetTrackStatus(p.id, t.id, 'active')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(76,175,80,0.1)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                <UserCheck size={11} /> Reinstate
                                                            </button>
                                                        )}
                                                        {t.status !== 'suspended' && (
                                                            <button onClick={() => handleSetTrackStatus(p.id, t.id, 'suspended')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(255,152,0,0.1)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                <ShieldOff size={11} /> Suspend
                                                            </button>
                                                        )}
                                                        {t.status !== 'deleted' && (
                                                            <button onClick={() => handleSetTrackStatus(p.id, t.id, 'deleted')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                <Trash2 size={11} /> Soft Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.xl }}>
                {/* Genre Library */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <List size={20} /> Current Library
                    </h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
                        {rootGenres.length === 0 && <p style={{ color: colors.textSecondary }}>No genres configured.</p>}
                        
                        {rootGenres.map(parent => (
                            <div key={parent.id} style={{ 
                                marginBottom: spacing.sm, 
                                border: '1px solid rgba(255,255,255,0.05)', 
                                borderRadius: borderRadius.sm,
                                backgroundColor: 'rgba(255,255,255,0.02)'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    fontWeight: 'bold', 
                                    padding: '10px 12px', 
                                    borderBottom: '1px solid rgba(255,255,255,0.05)' 
                                }}>
                                    <span style={{ color: colors.primary }}>{parent.name}</span>
                                    <Trash2 size={16} style={{ cursor: 'pointer', color: '#ff4444', opacity: 0.6 }} onClick={() => handleDeleteGenre(parent.id)} />
                                </div>
                                <div style={{ padding: '4px 0 8px 12px' }}>
                                    {genres.filter(g => g.parentId === parent.id).map(sub => (
                                        <div key={sub.id} style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            padding: '8px 12px', 
                                            fontSize: '0.9rem', 
                                            color: colors.textSecondary,
                                            borderBottom: '1px solid rgba(255,255,255,0.03)'
                                        }}>
                                            <span>• {sub.name}</span>
                                            <Trash2 size={14} style={{ cursor: 'pointer', color: '#ff4444', opacity: 0.4 }} onClick={() => handleDeleteGenre(sub.id)} />
                                        </div>
                                    ))}
                                    {genres.filter(g => g.parentId === parent.id).length === 0 && (
                                        <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: colors.textSecondary, fontStyle: 'italic', opacity: 0.5 }}>
                                            No sub-genres
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Orphans or Deeply Nested (Fallback) */}
                        {allSubGenres.filter(sub => !genres.some(p => p.id === sub.parentId)).length > 0 && (
                            <div style={{ marginTop: spacing.lg }}>
                                <h4 style={{ fontSize: '0.8rem', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Other Categories</h4>
                                {allSubGenres.filter(sub => !genres.some(p => p.id === sub.parentId)).map(sub => (
                                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginBottom: '4px' }}>
                                        <span style={{ color: colors.textSecondary }}>{sub.name} (ID: {sub.parentId})</span>
                                        <Trash2 size={14} style={{ cursor: 'pointer', color: '#ff4444' }} onClick={() => handleDeleteGenre(sub.id)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Add New Genre */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={20} /> Add New Genre
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Genre Name</label>
                            <input 
                                type="text" 
                                value={newGenreName} 
                                onChange={(e) => setNewGenreName(e.target.value)}
                                placeholder="e.g. Future Bass"
                                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, marginTop: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Parent Category (Optional)</label>
                            <select 
                                value={newGenreParent} 
                                onChange={(e) => setNewGenreParent(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    border: 'none', 
                                    borderRadius: borderRadius.sm, 
                                    padding: spacing.sm, 
                                    color: colors.textPrimary, 
                                    marginTop: '4px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>None (Top Level)</option>
                                {rootGenres.map(g => (
                                    <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleAddGenre}
                            disabled={saving || !newGenreName}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: spacing.md, cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {saving ? 'Saving...' : 'Create Genre'}
                        </button>
                    </div>
                </div>

                {/* --- Admin: User Cleanup & Wipe --- */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: '1px solid rgba(255, 68, 68, 0.2)' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444' }}>
                        <Trash2 size={20} /> Wipe Musician Profile
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>
                        Search for a musician to completely delete their profile, all tracks, album artwork, and profile photos. 
                        <strong> This action is irreversible and will be logged.</strong>
                    </p>
                    
                    <div style={{ position: 'relative', marginBottom: spacing.md }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} />
                        <input 
                            type="text" 
                            value={adminSearch} 
                            onChange={(e) => handleSearchProfiles(e.target.value)}
                            placeholder="Search by username, real name, or Discord ID..."
                            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: '10px 10px 10px 40px', color: colors.textPrimary }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {searchingProfiles && <p style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Searching...</p>}
                        {adminProfiles.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#242C3D', overflow: 'hidden' }}>
                                        {p.avatar ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Search size={16} style={{ margin: '8px' }} />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{p.displayName || p.username}</div>
                                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{p._count.tracks} tracks • ID: {p.userId}</div>
                                    </div>
                                </div>
                                
                                {confirmWipe === p.id ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleWipeProfile(p.id)}
                                            style={{ backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            CONFIRM DELETE
                                        </button>
                                        <button 
                                            onClick={() => setConfirmWipe(null)}
                                            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            CANCEL
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setConfirmWipe(p.id)}
                                        style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', border: '1px solid rgba(255, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        WIPE PROFILE
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        <ConfirmModal
            open={!!confirmDialog}
            title={confirmDialog?.title}
            message={confirmDialog?.message || ''}
            confirmLabel="Confirm"
            onConfirm={() => confirmDialog?.onConfirm()}
            onCancel={() => setConfirmDialog(null)}
        />
        </>
    );
};
