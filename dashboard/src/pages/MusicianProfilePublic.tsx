import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import axios from 'axios';
import { 
    Music, Share2, Hammer, Globe, Instagram, Youtube, Twitter, Radio, 
    ArrowLeft, Edit3, PlayCircle, Pause, SkipBack, SkipForward, 
    Shuffle, Repeat, Volume2, ExternalLink, Award, Layout, Zap, Search, Heart, Play
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
    totalPlays?: number;
    featuredTrackId?: string | null;
    featuredTrack?: {
        id: string;
        title: string;
        url: string;
        coverUrl: string | null;
        description: string | null;
    };
    tracks?: Array<{
        id: string;
        title: string;
        slug: string | null;
        url: string;
        coverUrl: string | null;
        description: string | null;
        playCount: number;
    }>;
}

export const MusicianProfilePublic: React.FC<{ identifier: string; onEdit?: () => void; isOwnProfile: boolean }> = ({ identifier, onEdit, isOwnProfile }) => {
    const [profile, setProfile] = useState<MusicianProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    
    // Player Context
    const { player, setTrack, togglePlay } = usePlayer();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (profile) {
            document.title = `${profile.displayName || profile.username} | Fuji Studio Artist`;
        } else {
            document.title = 'Artist Discovery | Fuji Studio';
        }
        
        return () => {
            document.title = 'Fuji Studio Dashboard';
        };
    }, [profile]);

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
        { label: 'Listeners', value: '1.2K' },
        { label: 'Total Streams', value: profile.totalPlays?.toLocaleString() || '0' },
        { label: 'Releases', value: profile.tracks?.length.toString() || '0' }
    ];

    const socials = [
        { key: 'twitterUrl', label: 'Twitter', icon: <Twitter size={16}/>, color: '#1DA1F2' },
        { key: 'soundcloudUrl', label: 'Soundcloud', icon: <Music size={16}/>, color: '#ff5500' },
        { key: 'spotifyUrl', label: 'Spotify', icon: <Radio size={16}/>, color: '#1DB954' },
    ];

    const featuredTrack = profile.featuredTrack || (profile.tracks && profile.tracks.length > 0 ? profile.tracks[0] : null);
    
    // Fallback logic for avatar:
    // 1. Custom profile-wide avatar (if it's a full path from /uploads/avatars)
    // 2. Discord avatar (if it's just a hash)
    // 3. First letter of username
    const avatarUrl = profile.avatar 
        ? (profile.avatar.startsWith('/uploads/') ? profile.avatar : `https://cdn.discordapp.com/avatars/${profile.userId}/${profile.avatar}.png?size=256`)
        : null;

    // Track cover should strictly be the track's cover, or a fallback music icon
    const trackCoverUrl = featuredTrack?.coverUrl || null;

    return (
        <div style={{ 
            color: '#F8FAFC',
            padding: isMobile ? '12px' : '24px',
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
                    padding: isMobile ? '20px' : '32px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: isMobile ? '20px' : '32px'
                }}>
                    {/* Track Cover */}
                    <div style={{ 
                        position: 'relative', 
                        width: isMobile ? '100%' : '192px', 
                        height: isMobile ? 'auto' : '192px', 
                        aspectRatio: isMobile ? '1/1' : 'auto',
                        flexShrink: 0 
                    }}>
                        <div style={{ 
                            width: '100%', height: '100%', 
                            borderRadius: '8px', overflow: 'hidden',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                        }}>
                            {trackCoverUrl ? (
                                <img src={trackCoverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Music size={isMobile ? 80 : 64} color={colors.primary} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Player Content */}
                    <div style={{ flex: 1, width: '100%', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ backgroundColor: '#F27B13', color: 'white', fontSize: isMobile ? '8px' : '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Featured Track</span>
                            <span style={{ color: colors.primary, fontSize: isMobile ? '9px' : '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Layout size={12} /> Now Playing
                            </span>
                        </div>
                        <h2 style={{ 
                            fontSize: isMobile ? '20px' : '36px', 
                            fontWeight: '800', 
                            margin: '0 0 4px 0', 
                            letterSpacing: '-0.02em', 
                            lineHeight: 1.2,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                        }}>
                            {profile.displayName || profile.username} - {featuredTrack?.title || 'No track available'}
                        </h2>
                        <p style={{ 
                            color: '#B9C3CE', 
                            fontSize: isMobile ? '13px' : '14px', 
                            marginBottom: isMobile ? '12px' : '24px',
                            lineHeight: 1.4
                        }}>{featuredTrack?.description || 'Listen to this featured track below.'}</p>
                        
                        {/* Progress Bar */}
                        {player.currentTrack?.id === featuredTrack?.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: colors.primary }}>
                                    {Math.floor(player.currentTime/60)}:{(Math.floor(player.currentTime%60)).toString().padStart(2, '0')}
                                </span>
                                <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '999px', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: `${(player.currentTime/player.duration)*100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: '999px', boxShadow: `0 0 10px ${colors.primary}88` }} />
                                    <div style={{ position: 'absolute', top: '50%', left: `${(player.currentTime/player.duration)*100}%`, width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                </div>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#B9C3CE' }}>
                                    {Math.floor(player.duration/60)}:{(Math.floor(player.duration%60)).toString().padStart(2, '0')}
                                </span>
                            </div>
                        ) : (
                            <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '999px', marginBottom: isMobile ? '24px' : '32px' }} />
                        )}

                        {/* Play Button Only */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                            <button 
                                onClick={() => {
                                    if (featuredTrack) {
                                        player.currentTrack?.id === featuredTrack.id 
                                            ? togglePlay() 
                                            : setTrack(featuredTrack, [featuredTrack, ...(profile.tracks || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
                                    }
                                }}
                                style={{ 
                                    padding: isMobile ? '12px 24px' : '12px 32px', borderRadius: '999px', 
                                    backgroundColor: colors.primary, display: 'flex', 
                                    alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    border: 'none', color: 'white', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: isMobile ? '12px' : '14px', textTransform: 'uppercase', letterSpacing: '0.05em',
                                    transition: 'transform 0.1s, background-color 0.2s',
                                    width: isMobile ? '100%' : 'auto',
                                    boxShadow: `0 4px 15px ${colors.primary}44`
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {player.currentTrack?.id === featuredTrack?.id && player.isPlaying ? (
                                    <><Pause size={20} fill="currentColor" /> Pause</>
                                ) : (
                                    <><Play size={20} fill="currentColor" /> Play Featured Track</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* More Tracks (Hidden on mobile) */}
                    {!isMobile && profile.tracks && profile.tracks.length > 1 && (
                        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', width: '256px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.1em' }}>More Tracks</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {profile.tracks.filter(t => t.id !== featuredTrack?.id).slice(0, 2).map(t => (
                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setTrack(t, profile.tracks)}>
                                        <div style={{ width: '40px', height: '40px', backgroundColor: '#1e293b', borderRadius: '4px', backgroundImage: `url(${t.coverUrl})`, backgroundSize: 'cover' }} />
                                        <div>
                                            <p style={{ fontSize: '11px', fontWeight: 'bold', margin: 0, color: player.currentTrack?.id === t.id ? colors.primary : 'white' }}>{t.title}</p>
                                            <p style={{ fontSize: '9px', color: '#B9C3CE', margin: 0 }}>Play Track</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
                
                {/* Artist Info Card */}
                <div style={{ 
                    gridColumn: isMobile ? 'span 12' : 'span 5',
                    backgroundColor: '#242C3D', padding: isMobile ? '20px' : '24px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'center', textAlign: isMobile ? 'center' : 'left', gap: '24px' }}>
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
                            <h2 style={{ fontSize: isMobile ? '26px' : '30px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>{profile.displayName || profile.username}</h2>
                            <p style={{ color: '#B9C3CE', fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>Electronic Artist & Sonic Architect</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start', gap: '8px' }}>
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

                    <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                        {stats.map(s => (
                            <div key={s.label}>
                                <p style={{ fontSize: '8px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{s.label}</p>
                                <p style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 'bold', margin: '4px 0 0' }}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Socials Card */}
                <div style={{ 
                    gridColumn: isMobile ? 'span 12' : 'span 3',
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
                    gridColumn: isMobile ? 'span 12' : 'span 4',
                    backgroundColor: '#242C3D', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <Hammer size={18} color="#7A8C37" /> Artist's Toolkit
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
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
                        {gear.length === 0 && <p style={{ gridColumn: isMobile ? 'auto' : 'span 2', fontSize: '12px', color: '#B9C3CE' }}>No gear listed yet.</p>}
                    </div>
                </div>

                {/* Latest Releases */}
                <div style={{ 
                    gridColumn: 'span 12', backgroundColor: '#242C3D', padding: isMobile ? '20px' : '32px', 
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px'
                }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '32px', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Award size={24} color="#F27B13" /> Latest Releases
                            </h3>
                            <p style={{ fontSize: '12px', color: '#B9C3CE', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Explore the newest soundscapes by {profile.username}</p>
                        </div>
                    </div>
                    {/* Simplified Release Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                        {profile.tracks && profile.tracks.length > 0 ? (
                            profile.tracks.map((track) => {
                                const isPlaying = player.currentTrack?.id === track.id && player.isPlaying;
                                return (
                                    <div key={track.id} style={{ cursor: 'pointer' }}>
                                        <div 
                                            onClick={() => window.location.href = `/profile/${profile.username}/${track.slug || track.id}`}
                                            style={{ 
                                            aspectRatio: '1/1', borderRadius: '12px', backgroundColor: '#1e293b', 
                                            marginBottom: '12px', overflow: 'hidden', position: 'relative',
                                            border: `1px solid ${isPlaying ? colors.primary : 'rgba(255,255,255,0.05)'}`,
                                            transition: 'all 0.2s ease'
                                        }}>
                                            {track.coverUrl ? (
                                                <img src={track.coverUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isPlaying ? 0.6 : 1 }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
                                                    <Music size={isMobile ? 32 : 48} />
                                                </div>
                                            )}
                                            <div style={{ 
                                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                backgroundColor: isPlaying ? 'transparent' : 'rgba(0,0,0,0.4)', 
                                                opacity: isPlaying || isMobile ? 1 : 0,
                                                transition: 'opacity 0.2s ease'
                                            }} onMouseEnter={(e) => {
                                                if (!isPlaying) e.currentTarget.style.opacity = '1';
                                            }} onMouseLeave={(e) => {
                                                if (!isPlaying && !isMobile) e.currentTarget.style.opacity = '0';
                                            }}>
                                                <div 
                                                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        player.currentTrack?.id === track.id ? togglePlay() : setTrack(track, profile.tracks);
                                                    }}
                                                >
                                                    {isPlaying ? (
                                                        <Pause size={isMobile ? 32 : 48} color="white" fill="white" />
                                                    ) : (
                                                        <Play size={isMobile ? 32 : 48} color="white" fill="white" />
                                                    )}
                                                </div>
                                            </div>
                                            {isPlaying && (
                                                <div style={{ position: 'absolute', bottom: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.primary, boxShadow: `0 0 10px ${colors.primary}` }} />
                                            )}
                                        </div>
                                        <p 
                                            onClick={() => window.location.href = `/profile/${profile.username}/${track.slug || track.id}`}
                                            style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isPlaying ? colors.primary : 'white' }}
                                        >
                                            {track.title}
                                        </p>
                                        <p style={{ fontSize: '10px', color: '#B9C3CE', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Zap size={10} /> {track.playCount.toLocaleString()} plays
                                        </p>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '40px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                                <Music size={48} color="#B9C3CE" style={{ opacity: 0.2, marginBottom: '16px' }} />
                                <p style={{ color: '#B9C3CE', fontSize: '14px' }}>No tracks uploaded yet.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Back to Edit Button (Owner only) */}
            {isOwnProfile && (
                <button 
                    onClick={onEdit}
                    style={{ 
                        position: 'fixed', bottom: player.currentTrack ? '104px' : '24px', right: '24px', 
                        backgroundColor: colors.primary, color: 'white', padding: isMobile ? '12px' : '12px 24px', 
                        borderRadius: '999px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', zIndex: 100,
                        transition: 'bottom 0.3s'
                    }}
                >
                    <Edit3 size={18} /> {!isMobile && 'Edit My Profile'}
                </button>
            )}

            <div style={{ height: player.currentTrack ? '100px' : '20px' }} />
        </div>
    );
};
