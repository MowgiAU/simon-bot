import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { User, Music, Share2, Hammer, Save, Plus, X, Globe, Instagram, Youtube, Twitter, Radio, ExternalLink, Copy, Check, ArrowLeft } from 'lucide-react';
import { MusicianProfilePublic } from './MusicianProfilePublic';

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
    twitterUrl: string | null;
    websiteUrl: string | null;
    gearList: string[];
    genres: { id: string; name: string }[];
}

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

export const MusicianProfilePage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Track state
    const [tracks, setTracks] = useState<any[]>([]);
    const [isAddingTrack, setIsAddingTrack] = useState(false);
    const [newTrack, setNewTrack] = useState({ title: '', url: '', coverUrl: '', description: '' });

    // Get the identifier from URL (if any)
    const pathParts = window.location.pathname.split('/');
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
                        if (s.platform === 'twitter') data.twitterUrl = s.url;
                        if (s.platform === 'website') data.websiteUrl = s.url;
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
                if (err.response?.status === 404) {
                    setProfile({
                        bio: '',
                        spotifyUrl: '',
                        soundcloudUrl: '',
                        youtubeUrl: '',
                        instagramUrl: '',
                        twitterUrl: '',
                        websiteUrl: '',
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

    const handleAddTrack = async () => {
        if (!newTrack.title || !newTrack.url || !user) return;
        try {
            await axios.post('/api/musician/tracks', newTrack, { withCredentials: true });
            setNewTrack({ title: '', url: '', coverUrl: '', description: '' });
            setIsAddingTrack(false);
            // Re-fetch profile to get new tracks
            const profileRes = await axios.get(`/api/musician/profile/${user.id}`, { withCredentials: true });
            if (profileRes.data && profileRes.data.tracks) setTracks(profileRes.data.tracks);
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to add track' });
        }
    };

    const handleDeleteTrack = async (trackId: string) => {
        if (!window.confirm('Are you sure you want to delete this track?') || !user) return;
        try {
            await axios.delete(`/api/musician/tracks/${trackId}`, { withCredentials: true });
            setTracks(tracks.filter(t => t.id !== trackId));
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to delete track' });
        }
    };

    if (loading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading profile...</div>;

    const socialsList = [
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/> },
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/> },
        { key: 'youtubeUrl', label: 'YouTube', icon: <Youtube size={16}/> },
        { key: 'instagramUrl', label: 'Instagram', icon: <Instagram size={16}/> },
        { key: 'twitterUrl', label: 'Twitter', icon: <Twitter size={16}/> },
        { key: 'websiteUrl', label: 'External Portfolio', icon: <Globe size={16}/> },
    ];

    if (mode === 'view') {
        const identifier = urlIdentifier || user?.username || user?.id || '';
        const isOwn = !!user && (identifier === user.id || identifier === user.username);
        return (
            <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
                <MusicianProfilePublic 
                    identifier={identifier} 
                    isOwnProfile={isOwn} 
                    onEdit={() => setMode('edit')}
                />
            </div>
        );
    }

    return (
        <div style={{ padding: spacing.lg, maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <ArrowLeft size={24} style={{ marginRight: '16px', cursor: 'pointer', color: colors.textSecondary }} onClick={() => setMode('view')} />
                <User size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Musician Profile</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Customize how you appear in the community networking lists.</p>
                </div>
                {profile?.id && (
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <a 
                            href={profileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                padding: '8px 16px', 
                                borderRadius: borderRadius.md, 
                                color: colors.textPrimary, 
                                textDecoration: 'none', 
                                fontSize: '0.9rem',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <ExternalLink size={16} /> View Profile
                        </a>
                        <button 
                            onClick={handleCopyLink}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                backgroundColor: colors.primary, 
                                padding: '8px 16px', 
                                borderRadius: borderRadius.md, 
                                color: 'white', 
                                border: 'none', 
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Share Profile</>}
                        </button>
                    </div>
                )}
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Your profile is visible to other members using the <code>/profile view</code> command. 
                    Link your socials and list your gear to find collaborators!
                </p>
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
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.md }}>
                            {tracks.length === 0 && (
                                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                                    No tracks uploaded yet. Show off your work!
                                </p>
                            )}
                            {tracks.map(track => (
                                <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md }}>
                                    <div style={{ width: '40px', height: '40px', background: colors.primary, borderRadius: '4px', overflow: 'hidden' }}>
                                        {track.coverUrl ? <img src={track.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={20} style={{ margin: '10px' }} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{track.title}</p>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: colors.textSecondary }}>{track.playCount} plays</p>
                                    </div>
                                    <button onClick={() => handleDeleteTrack(track.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {isAddingTrack ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, background: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.md }}>
                                <input 
                                    type="text" placeholder="Track Title" value={newTrack.title}
                                    onChange={e => setNewTrack({...newTrack, title: e.target.value})}
                                    style={{ backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                />
                                <input 
                                    type="text" placeholder="Audio URL (Dropbox/GDrive direct link)" value={newTrack.url}
                                    onChange={e => setNewTrack({...newTrack, url: e.target.value})}
                                    style={{ backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                />
                                <input 
                                    type="text" placeholder="Cover Image URL (Optional)" value={newTrack.coverUrl}
                                    onChange={e => setNewTrack({...newTrack, coverUrl: e.target.value})}
                                    style={{ backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                />
                                <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                                    <button onClick={handleAddTrack} style={{ flex: 1, padding: '8px', background: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontWeight: 'bold' }}>Add Track</button>
                                    <button onClick={() => setIsAddingTrack(false)} style={{ flex: 1, padding: '8px', background: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer' }}>Cancel</button>
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
                            <Share2 size={20} /> Social Links
                        </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
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
                                    placeholder="https://..."
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
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
    );
};
