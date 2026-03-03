import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';
import { 
    Music, Share2, Hammer, Globe, Instagram, Youtube, Twitter, Radio, 
    ArrowLeft, Edit3, PlayCircle, Pause, SkipBack, SkipForward, 
    Shuffle, Repeat, Volume2, ExternalLink, Award, Layout, Zap, Search, Heart
} from 'lucide-react';

interface MusicianProfile {
    id: string;
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
    hardware: string[];
    gearList: string[];
    genres: { genre: { name: string } }[];
}

export const MusicianProfilePublic: React.FC<{ identifier: string; onEdit?: () => void; isOwnProfile: boolean }> = ({ identifier, onEdit, isOwnProfile }) => {
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

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
                <a href="/" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 'bold', border: `1px solid ${colors.primary}`, padding: '8px 16px', borderRadius: borderRadius.md }}>← Back Home</a>
            </div>
        </div>
    );

    const gear = profile.gearList || profile.hardware || [];
    const stats = [
        { label: 'Listeners', value: '12.4K' },
        { label: 'Total Streams', value: '1.2M' },
        { label: 'Releases', value: '42' }
    ];

    const socials = [
        { key: 'twitterUrl', label: 'Twitter', icon: <Twitter size={16}/>, color: '#1DA1F2' },
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/>, color: '#ff5500' },
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/>, color: '#1DB954' },
    ];

    const avatarUrl = profile.avatar 
        ? `https://cdn.discordapp.com/avatars/${profile.userId}/${profile.avatar}.png?size=256`
        : null;

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#161925', 
            color: '#F8FAFC',
            padding: '24px',
            maxWidth: '1600px',
            margin: '0 auto',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header / Player Section */}
            <div style={{ 
                backgroundColor: '#242C3D', 
                borderRadius: '12px', 
                overflow: 'hidden', 
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '16px',
                position: 'relative'
            }}>
                <div style={{ 
                    background: 'linear-gradient(90deg, #242C3D 0%, #1A1E2E 100%)',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '32px'
                }}>
                    {/* Track Cover */}
                    <div style={{ position: 'relative', width: '192px', height: '192px', flexShrink: 0 }}>
                        <div style={{ 
                            width: '100%', height: '100%', 
                            borderRadius: '8px', overflow: 'hidden',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                        }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={64} color={colors.primary} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Player Content */}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: '#F27B13', color: 'white', fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Featured Track</span>
                            <span style={{ color: colors.primary, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Layout size={12} /> Now Playing
                            </span>
                        </div>
                        <h2 style={{ fontSize: '36px', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>{profile.displayName || profile.username} - Neon Drift</h2>
                        <p style={{ color: '#B9C3CE', fontSize: '14px', marginBottom: '24px' }}>From the upcoming album "Digital Echoes"</p>
                        
                        {/* Progress Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', maxWidth: '600px' }}>
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: colors.primary }}>02:45</span>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '999px', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '66%', height: '100%', backgroundColor: colors.primary, borderRadius: '999px', boxShadow: `0 0 10px ${colors.primary}88` }} />
                                <div style={{ position: 'absolute', top: '50%', left: '66%', width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            </div>
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#B9C3CE' }}>04:12</span>
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <Shuffle size={18} style={{ cursor: 'pointer', opacity: 0.6 }} />
                                <SkipBack size={20} style={{ cursor: 'pointer' }} />
                                <button 
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    style={{ 
                                        width: '48px', height: '48px', borderRadius: '50%', 
                                        backgroundColor: colors.primary, display: 'flex', 
                                        alignItems: 'center', justifyContent: 'center', 
                                        border: 'none', color: 'white', cursor: 'pointer',
                                        transition: 'transform 0.1s'
                                    }}
                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {isPlaying ? <Pause size={28} fill="white" /> : <PlayCircle size={28} fill="white" />}
                                </button>
                                <SkipForward size={20} style={{ cursor: 'pointer' }} />
                                <Repeat size={18} style={{ cursor: 'pointer', opacity: 0.6 }} />
                            </div>
                            <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Volume2 size={18} style={{ opacity: 0.6 }} />
                                <div style={{ width: '96px', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '999px' }}>
                                    <div style={{ width: '75%', height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '999px' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Up Next (Hidden on small) */}
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', width: '256px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.1em' }}>Up Next</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                <div style={{ width: '40px', height: '40px', backgroundColor: '#1e293b', borderRadius: '4px' }} />
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 'bold', margin: 0 }}>Starlight Path</p>
                                    <p style={{ fontSize: '9px', color: '#B9C3CE', margin: 0 }}>3:42</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', opacity: 0.5 }}>
                                <div style={{ width: '40px', height: '40px', backgroundColor: '#1e293b', borderRadius: '4px' }} />
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 'bold', margin: 0 }}>Deep Blue</p>
                                    <p style={{ fontSize: '9px', color: '#B9C3CE', margin: 0 }}>5:15</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
                
                {/* Artist Info Card */}
                <div style={{ 
                    gridColumn: 'span 12', lgGridColumn: 'span 5',
                    backgroundColor: '#242C3D', padding: '24px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div style={{ 
                            width: '128px', height: '128px', borderRadius: '50%', 
                            border: `4px solid ${colors.primary}33`, padding: '4px', flexShrink: 0
                        }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                                    {profile.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '30px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>{profile.displayName || profile.username}</h2>
                            <p style={{ color: '#B9C3CE', fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>Electronic Artist & Sonic Architect</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {profile.genres.map((g, i) => (
                                    <span key={i} style={{ 
                                        backgroundColor: `${colors.primary}1A`, 
                                        border: `1px solid ${colors.primary}4D`,
                                        color: colors.primary, padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'
                                    }}>{g.genre.name}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                        {stats.map(s => (
                            <div key={s.label}>
                                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{s.label}</p>
                                <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0 0' }}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Socials Card */}
                <div style={{ 
                    gridColumn: 'span 12', mdGridColumn: 'span 6', lgGridColumn: 'span 3',
                    backgroundColor: '#242C3D', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <Globe size={18} color={colors.primary} /> Connect
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {socials.map(s => {
                            const url = (profile as any)[s.key];
                            return (
                                <a key={s.key} href={url || '#'} target="_blank" rel="noopener noreferrer" style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                    padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none', color: 'white'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: `${s.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {React.cloneElement(s.icon as React.ReactElement, { color: s.color })}
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: '500' }}>{s.label}</span>
                                    </div>
                                    <ExternalLink size={14} color="#475569" />
                                </a>
                            );
                        })}
                    </div>
                </div>

                {/* Artist's Toolkit Card */}
                <div style={{ 
                    gridColumn: 'span 12', mdGridColumn: 'span 6', lgGridColumn: 'span 4',
                    backgroundColor: '#242C3D', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <Hammer size={18} color="#7A8C37" /> Artist's Toolkit
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {gear.map((item, i) => (
                            <div key={i} style={{ 
                                padding: '12px', borderRadius: '8px', 
                                backgroundColor: i % 2 === 0 ? 'rgba(89, 49, 25, 0.1)' : 'rgba(122, 140, 55, 0.1)',
                                border: `1px solid ${i % 2 === 0 ? 'rgba(89, 49, 25, 0.3)' : 'rgba(122, 140, 55, 0.3)'}`
                            }}>
                                <p style={{ fontSize: '9px', fontWeight: 'bold', color: i % 2 === 0 ? '#593119' : '#7A8C37', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                                    {i === 0 ? 'Main DAW' : i === 1 ? 'Monitors' : i === 2 ? 'Synths' : 'Interface'}
                                </p>
                                <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', margin: '4px 0 0' }}>{item}</p>
                            </div>
                        ))}
                        {gear.length === 0 && <p style={{ gridColumn: 'span 2', fontSize: '12px', color: '#B9C3CE' }}>No gear listed yet.</p>}
                    </div>
                </div>

                {/* Latest Releases */}
                <div style={{ 
                    gridColumn: 'span 12', backgroundColor: '#242C3D', padding: '32px', 
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Award size={24} color="#F27B13" /> Latest Releases
                            </h3>
                            <p style={{ fontSize: '12px', color: '#B9C3CE', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Explore the newest soundscapes by {profile.username}</p>
                        </div>
                    </div>
                    {/* Simplified Release Row (Placeholder for now) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '24px' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} style={{ cursor: 'pointer' }}>
                                <div style={{ 
                                    aspectRatio: '1/1', borderRadius: '12px', backgroundColor: '#1e293b', 
                                    marginBottom: '12px', overflow: 'hidden', position: 'relative',
                                    border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s'
                                }}>
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
                                        <Music size={48} />
                                    </div>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', opacity: 0 }}>
                                        <PlayCircle size={48} color="white" />
                                    </div>
                                </div>
                                <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>Track Title {i}</p>
                                <p style={{ fontSize: '10px', color: '#B9C3CE', margin: '2px 0 12px' }}>Oct 2023 • EP</p>
                                <button style={{ 
                                    width: '100%', padding: '6px', border: `1px solid ${colors.primary}4D`,
                                    backgroundColor: 'transparent', color: colors.primary, fontSize: '10px',
                                    fontWeight: 'bold', textTransform: 'uppercase', borderRadius: '4px', cursor: 'pointer'
                                }}>Listen Now</button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Back to Edit Button (Floating for owner) */}
            {isOwnProfile && (
                <button 
                    onClick={onEdit}
                    style={{ 
                        position: 'fixed', bottom: '24px', right: '24px', 
                        backgroundColor: colors.primary, color: 'white', padding: '12px 24px', 
                        borderRadius: '999px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', zIndex: 100
                    }}
                >
                    <Edit3 size={18} /> Edit My Profile
                </button>
            )}
        </div>
    );
};
