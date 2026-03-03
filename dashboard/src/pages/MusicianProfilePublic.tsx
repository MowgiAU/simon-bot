import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';
import { Music, Share2, Hammer, Globe, Instagram, Youtube, Twitter, Radio, ArrowLeft, Edit3 } from 'lucide-react';

interface MusicianProfile {
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    spotifyUrl: string | null;
    soundcloudUrl: string | null;
    youtubeUrl: string | null;
    instagramUrl: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
    gearList: string[];
    genres: { genre: { name: string } }[];
}

export const MusicianProfilePublic: React.FC<{ identifier: string; onEdit?: () => void; isOwnProfile: boolean }> = ({ identifier, onEdit, isOwnProfile }) => {
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true });
                setProfile(res.data);
            } catch (err: any) {
                setError(err.response?.status === 404 ? 'Profile not found' : 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [identifier]);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>
            Loading profile...
        </div>
    );

    if (error || !profile) return (
        <div style={{ textAlign: 'center', padding: '100px' }}>
            <h2 style={{ color: '#ff4444' }}>{error || 'Profile not found'}</h2>
            <p style={{ color: colors.textSecondary }}>The musician you are looking for hasn't set up their Fuji Studio profile yet.</p>
            <div style={{ marginTop: spacing.xl }}>
                <a href="/" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 'bold' }}>← Back to Fuji Studio</a>
            </div>
        </div>
    );

    const socials = [
        { url: profile.spotifyUrl, icon: <Radio size={18} />, label: 'Spotify' },
        { url: profile.soundcloudUrl, icon: <Music size={18} />, label: 'Soundcloud' },
        { url: profile.youtubeUrl, icon: <Youtube size={18} />, label: 'YouTube' },
        { url: profile.instagramUrl, icon: <Instagram size={18} />, label: 'Instagram' },
        { url: profile.twitterUrl, icon: <Twitter size={18} />, label: 'Twitter' },
        { url: profile.websiteUrl, icon: <Globe size={18} />, label: 'Website' },
    ].filter(s => s.url);

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: spacing.lg }}>
            {/* Header / Banner Area */}
            <div style={{ 
                backgroundColor: colors.surface, 
                borderRadius: borderRadius.lg, 
                overflow: 'hidden', 
                marginBottom: spacing.xl,
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ height: '120px', background: `linear-gradient(45deg, ${colors.primary}44, ${colors.secondary}44)` }} />
                <div style={{ padding: spacing.lg, position: 'relative', marginTop: '-60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ 
                        width: '120px', 
                        height: '120px', 
                        borderRadius: '50%', 
                        border: `4px solid ${colors.surface}`,
                        backgroundColor: colors.background,
                        overflow: 'hidden',
                        marginBottom: spacing.md
                    }}>
                        {profile.avatar ? (
                            <img src={`https://cdn.discordapp.com/avatars/${profile.userId}/${profile.avatar}.png?size=256`} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, color: 'white', fontSize: '2rem' }}>
                                {profile.username.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    
                    <h1 style={{ margin: 0, fontSize: '2rem' }}>{profile.displayName || profile.username}</h1>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 16px' }}>@{profile.username}</p>
                    
                    <div style={{ display: 'flex', gap: spacing.md }}>
                        {socials.map((s, i) => (
                            <a key={i} href={s.url!} target="_blank" rel="noopener noreferrer" style={{ color: colors.textPrimary, opacity: 0.7, transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '1'} onMouseOut={e => e.currentTarget.style.opacity = '0.7'}>
                                {s.icon}
                            </a>
                        ))}
                    </div>

                    {isOwnProfile && (
                        <button 
                            onClick={onEdit}
                            style={{ position: 'absolute', top: '70px', right: '20px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: borderRadius.md, color: colors.textPrimary, cursor: 'pointer' }}
                        >
                            <Edit3 size={16} /> Edit Profile
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing.xl }}>
                <div>
                    <section style={{ marginBottom: spacing.xl }}>
                        <h3 style={{ borderBottom: `2px solid ${colors.primary}`, paddingBottom: '8px', marginBottom: spacing.md }}>About</h3>
                        <p style={{ lineHeight: '1.6', color: colors.textPrimary, whiteSpace: 'pre-wrap' }}>
                            {profile.bio || "This musician hasn't written a bio yet."}
                        </p>
                    </section>

                    <section>
                        <h3 style={{ borderBottom: `2px solid ${colors.primary}`, paddingBottom: '8px', marginBottom: spacing.md }}>Genres</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {profile.genres?.length > 0 ? profile.genres.map((g, i) => (
                                <span key={i} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.9rem' }}>
                                    {g.genre.name}
                                </span>
                            )) : <span style={{ color: colors.textSecondary }}>No genres listed.</span>}
                        </div>
                    </section>
                </div>

                <div>
                    <section style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Hammer size={20} /> Gear Rack
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {profile.gearList?.length > 0 ? profile.gearList.map((item, i) => (
                                <li key={i} style={{ padding: '8px 0', borderBottom: i === profile.gearList.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', color: colors.textPrimary }}>
                                    • {item}
                                </li>
                            )) : <li style={{ color: colors.textSecondary }}>No equipment listed.</li>}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};
