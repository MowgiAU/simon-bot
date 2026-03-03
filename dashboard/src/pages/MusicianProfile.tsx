import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { User, Music, Share2, Hammer, Save, Plus, X, Globe, Instagram, Youtube, Twitter, Radio } from 'lucide-react';

interface MusicianProfile {
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
    const { user } = useAuth();
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [profileRes, genresRes] = await Promise.all([
                    axios.get(`/api/musician/profile/${user.id}`, { withCredentials: true }),
                    axios.get('/api/musician/genres', { withCredentials: true })
                ]);
                setProfile(profileRes.data);
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
            const payload = { ...profile, genres: profile.genres.map(g => g.id) };
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

    const addGear = () => {
        if (!profile) return;
        setProfile({ ...profile, gearList: [...profile.gearList, ''] });
    };

    const updateGear = (index: number, value: string) => {
        if (!profile) return;
        const newGear = [...profile.gearList];
        newGear[index] = value;
        setProfile({ ...profile, gearList: newGear });
    };

    const removeGear = (index: number) => {
        if (!profile) return;
        setProfile({ ...profile, gearList: profile.gearList.filter((_, i) => i !== index) });
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

    return (
        <div style={{ padding: spacing.lg, maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <User size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Musician Profile</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Customize how you appear in the community networking lists.</p>
                </div>
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
                            {profile?.genres.map(g => (
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
                            {allGenres.filter(g => !profile?.genres.some(pg => pg.id === g.id)).map(g => (
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
                            {profile?.gearList.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        type="text" 
                                        value={item} 
                                        onChange={(e) => updateGear(idx, e.target.value)}
                                        placeholder="FL Studio 21, Serum, DT 990 Pro..."
                                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary }}
                                    />
                                    <button onClick={() => removeGear(idx)} style={{ backgroundColor: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                                        <X size={18}/>
                                    </button>
                                </div>
                            ))}
                            <button onClick={addGear} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textSecondary, cursor: 'pointer', marginTop: spacing.sm }}>
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
