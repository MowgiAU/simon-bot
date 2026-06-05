import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { usePlayer } from './PlayerProvider';
import { Play, Pause, Music, User as UserIcon, MapPin, ExternalLink, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Track Embed ───────────────────────────────────────────────────────────────
interface TrackData {
    id: string;
    title: string;
    slug: string;
    artist: string;
    url: string;
    coverUrl: string | null;
    duration: number;
    playCount: number;
    bpm: number | null;
    key: string | null;
    waveformPeaks: number[] | null;
    profile: {
        userId: string;
        username: string;
        displayName: string;
        avatar: string | null;
    };
    genres?: { genre: { name: string } }[];
}

const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

const MiniWaveform: React.FC<{ peaks: number[]; progress: number; color: string }> = ({ peaks, progress, color }) => {
    const bars = 40;
    const step = Math.max(1, Math.floor(peaks.length / bars));
    const sampled = Array.from({ length: bars }, (_, i) => peaks[Math.min(i * step, peaks.length - 1)] || 0);
    const max = Math.max(...sampled, 0.01);

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5px', height: '32px', flex: 1 }}>
            {sampled.map((v, i) => {
                const h = Math.max(3, (v / max) * 32);
                const filled = i / bars < progress;
                return (
                    <div
                        key={i}
                        style={{
                            width: '100%',
                            height: `${h}px`,
                            borderRadius: '1px',
                            background: filled ? color : 'rgba(255,255,255,0.12)',
                            transition: 'background 0.1s',
                        }}
                    />
                );
            })}
        </div>
    );
};

export const TrackEmbed: React.FC<{ trackPath: string }> = ({ trackPath }) => {
    const [track, setTrack] = useState<TrackData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { player, setTrack: playTrack, togglePlay } = usePlayer();
    const [hover, setHover] = useState(false);

    const isThisPlaying = player.currentTrack?.id === track?.id && player.isPlaying;
    const isThisLoaded = player.currentTrack?.id === track?.id;
    const progress = isThisLoaded && player.duration > 0 ? player.currentTime / player.duration : 0;

    useEffect(() => {
        // Normalize full URLs (e.g. https://fujistud.io/track/...) to just the path
        let normalized = trackPath;
        try { normalized = new URL(trackPath).pathname; } catch { /* already a path */ }
        const parts = normalized.replace(/^\/track\//, '').split('/');
        if (parts.length < 2) { setError(true); setLoading(false); return; }
        const [username, slug] = parts;
        axios.get(`/api/musician/tracks/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`)
            .then(r => setTrack(r.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [trackPath]);

    const handlePlay = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!track) return;
        if (isThisLoaded) {
            togglePlay();
        } else {
            playTrack(track);
        }
    };

    if (loading) {
        return (
            <div style={{
                background: colors.surface, border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '20px', margin: '20px 0',
                display: 'flex', alignItems: 'center', gap: '16px',
            }}>
                <div style={{ width: 64, height: 64, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
                <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
                    <div style={{ width: '35%', height: 11, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
                </div>
            </div>
        );
    }

    if (error || !track) {
        return (
            <Link to={trackPath} style={{ textDecoration: 'none' }}>
                <div style={{
                    background: colors.surface, border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px', padding: '16px 20px', margin: '20px 0',
                    display: 'flex', alignItems: 'center', gap: '12px', color: colors.textSecondary,
                }}>
                    <Music size={20} />
                    <span style={{ fontSize: '14px' }}>Track embed: {trackPath}</span>
                    <ExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </div>
            </Link>
        );
    }

    const genre = track.genres?.[0]?.genre?.name;

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: `linear-gradient(135deg, ${colors.surface} 0%, rgba(242, 120, 10,0.04) 100%)`,
                border: `1px solid ${hover ? colors.primary + '40' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '14px', padding: '16px', margin: '20px 0',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: hover ? `0 4px 20px rgba(242, 120, 10,0.08)` : 'none',
            }}
        >
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {/* Cover + Play button */}
                <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }} onClick={handlePlay}>
                    {track.coverUrl ? (
                        <img
                            src={track.coverUrl}
                            alt=""
                            style={{ width: 64, height: 64, borderRadius: '10px', objectFit: 'cover', display: 'block' }}
                        />
                    ) : (
                        <div style={{
                            width: 64, height: 64, borderRadius: '10px',
                            background: `linear-gradient(135deg, ${colors.primary}30, ${colors.primary}10)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Music size={24} color={colors.primary} />
                        </div>
                    )}
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '10px',
                        background: 'rgba(0,0,0,0.45)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        opacity: hover || isThisPlaying ? 1 : 0,
                        transition: 'opacity 0.2s',
                    }}>
                        {isThisPlaying
                            ? <Pause size={24} color="white" fill="white" />
                            : <Play size={24} color="white" fill="white" />
                        }
                    </div>
                </div>

                {/* Track info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <Link to={trackPath} style={{
                            color: colors.textPrimary, fontWeight: 700, fontSize: '15px',
                            textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {track.title}
                        </Link>
                    </div>
                    <Link to={`/profile/${track.profile.username}`} style={{
                        color: colors.textSecondary, fontSize: '13px', textDecoration: 'none',
                    }}>
                        {track.profile.displayName || track.profile.username}
                    </Link>

                    {/* Meta pills */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {track.duration > 0 && (
                            <span style={pillStyle}>{formatDuration(track.duration)}</span>
                        )}
                        {track.bpm && <span style={pillStyle}>{track.bpm} BPM</span>}
                        {track.key && <span style={pillStyle}>{track.key}</span>}
                        {genre && <span style={{ ...pillStyle, background: `${colors.primary}15`, color: colors.primary }}>{genre}</span>}
                        {track.playCount > 0 && (
                            <span style={pillStyle}>{track.playCount.toLocaleString()} plays</span>
                        )}
                    </div>
                </div>

                {/* Play button for non-hover (mobile) */}
                <button
                    onClick={handlePlay}
                    style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: colors.primary, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'transform 0.15s',
                        transform: hover ? 'scale(1.05)' : 'scale(1)',
                    }}
                >
                    {isThisPlaying
                        ? <Pause size={18} color="white" fill="white" />
                        : <Play size={18} color="white" fill="white" style={{ marginLeft: 2 }} />
                    }
                </button>
            </div>

            {/* Waveform */}
            {track.waveformPeaks && track.waveformPeaks.length > 0 && (
                <div style={{ marginTop: '12px', padding: '0 4px' }}>
                    <MiniWaveform peaks={track.waveformPeaks} progress={progress} color={colors.primary} />
                </div>
            )}
        </div>
    );
};

const pillStyle: React.CSSProperties = {
    padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
    background: 'rgba(255,255,255,0.06)', color: colors.textTertiary,
    letterSpacing: '0.01em',
};


// ── Profile Embed ─────────────────────────────────────────────────────────────
interface ProfileData {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatar: string | null;
    bannerUrl: string | null;
    bio: string | null;
    location: string | null;
    primaryGenre: string | null;
    totalPlays?: number;
    tracks: { id: string; title: string; coverUrl: string | null }[];
    _count?: { tracks?: number; followers?: number };
    followerCount?: number;
    genres?: { genre: { name: string } }[];
}

function getProfileAvatarUrl(avatar: string | null, userId: string): string {
    if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (avatar.startsWith('http') || avatar.startsWith('/uploads/')) return avatar;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=256`;
}

export const ProfileEmbed: React.FC<{ profilePath: string }> = ({ profilePath }) => {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [hover, setHover] = useState(false);

    useEffect(() => {
        let normalized = profilePath;
        try { normalized = new URL(profilePath).pathname; } catch { /* already a path */ }
        const username = normalized.replace(/^\/profile\//, '').split('/')[0];
        if (!username) { setError(true); setLoading(false); return; }
        axios.get(`/api/musician/profile/${encodeURIComponent(username)}`)
            .then(r => setProfile(r.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [profilePath]);

    if (loading) {
        return (
            <div style={{
                background: colors.surface, border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '20px', margin: '20px 0',
                display: 'flex', alignItems: 'center', gap: '16px',
            }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
                <div style={{ flex: 1 }}>
                    <div style={{ width: '45%', height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
                    <div style={{ width: '30%', height: 11, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <Link to={profilePath} style={{ textDecoration: 'none' }}>
                <div style={{
                    background: colors.surface, border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px', padding: '16px 20px', margin: '20px 0',
                    display: 'flex', alignItems: 'center', gap: '12px', color: colors.textSecondary,
                }}>
                    <UserIcon size={20} />
                    <span style={{ fontSize: '14px' }}>Profile: {profilePath}</span>
                    <ExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </div>
            </Link>
        );
    }

    const trackCount = profile._count?.tracks ?? profile.tracks?.length ?? 0;
    const genre = profile.primaryGenre || profile.genres?.[0]?.genre?.name;
    const secondaryGenres = profile.genres?.filter(g => g.genre.name !== genre).slice(0, 2) || [];
    const avatarUrl = getProfileAvatarUrl(profile.avatar, profile.userId);

    return (
        <Link to={profilePath} style={{ textDecoration: 'none', display: 'block' }}>
            <div
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                    position: 'relative', overflow: 'hidden',
                    borderRadius: '14px', margin: '20px 0',
                    border: `1px solid ${hover ? colors.primary + '40' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: hover ? `0 6px 24px rgba(242, 120, 10,0.1)` : 'none',
                    background: 'linear-gradient(135deg, #1A1E2E 0%, #242C3D 100%)',
                }}
            >
                {/* Blurred avatar backdrop */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${avatarUrl})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(40px) brightness(0.2) saturate(1.5)',
                    transform: 'scale(1.3)', pointerEvents: 'none',
                }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(14,18,26,0.4) 0%, rgba(14,18,26,0.85) 70%, rgba(14,18,26,0.95) 100%)', pointerEvents: 'none' }} />
                {/* Accent glow */}
                <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '70%', background: `radial-gradient(ellipse, ${colors.primary}12 0%, transparent 70%)`, pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', padding: '20px 24px', gap: '20px', alignItems: 'center' }}>
                    {/* Avatar with conic gradient ring */}
                    <div style={{ flexShrink: 0, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '-4px', borderRadius: '50%', background: `conic-gradient(from 45deg, ${colors.primary}, #a78bfa, #FBBF24, #F472B6, ${colors.primary})`, opacity: 0.6, filter: 'blur(1px)' }} />
                        <div style={{ position: 'absolute', inset: '-2px', borderRadius: '50%', background: 'rgba(14,18,26,0.8)' }} />
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', position: 'relative', zIndex: 1, boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}>
                            <img
                                src={avatarUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
                            />
                        </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Name + username */}
                        <div>
                            <div style={{ fontWeight: 900, fontSize: '18px', color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {profile.displayName || profile.username}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '2px' }}>@{profile.username}</div>
                        </div>

                        {/* Genre pills */}
                        {(genre || secondaryGenres.length > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {genre && (
                                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 9px', borderRadius: '20px', background: `${colors.primary}22`, border: `1px solid ${colors.primary}50`, color: colors.primary }}>
                                        {genre}
                                    </span>
                                )}
                                {secondaryGenres.map((g, i) => (
                                    <span key={i} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 9px', borderRadius: '20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: colors.textSecondary }}>
                                        {g.genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Bio */}
                        {profile.bio && (
                            <p style={{ fontSize: '12px', color: 'rgba(185,195,210,0.65)', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                {profile.bio}
                            </p>
                        )}

                        {/* Stats + CTA */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '2px' }}>
                            {typeof profile.totalPlays === 'number' && profile.totalPlays > 0 && (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 900, color: colors.primary, lineHeight: 1 }}>
                                        {profile.totalPlays >= 1000 ? `${(profile.totalPlays / 1000).toFixed(1)}k` : profile.totalPlays.toLocaleString()}
                                    </span>
                                    <span style={{ fontSize: '9px', color: colors.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>plays</span>
                                </div>
                            )}
                            {trackCount > 0 && (
                                <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                                    {trackCount} track{trackCount !== 1 ? 's' : ''}
                                </span>
                            )}
                            {profile.location && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: colors.textTertiary }}>
                                    <MapPin size={10} /> {profile.location}
                                </span>
                            )}
                            <div style={{
                                marginLeft: 'auto',
                                padding: '7px 16px', borderRadius: '999px',
                                background: hover ? colors.primary : `${colors.primary}22`,
                                border: hover ? 'none' : `1px solid ${colors.primary}44`,
                                color: hover ? 'white' : colors.primary,
                                fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em',
                                transition: 'all 0.2s', whiteSpace: 'nowrap',
                                boxShadow: hover ? `0 4px 14px ${colors.primary}44` : 'none',
                            }}>
                                View Profile
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};


// ── Hydrator: replaces static embed divs with interactive React components ───
import { createPortal } from 'react-dom';

export const ArticleEmbedHydrator: React.FC<{ contentRef: React.RefObject<HTMLDivElement | null>; articleContent: string }> = ({ contentRef, articleContent }) => {
    const [embeds, setEmbeds] = useState<{ type: string; url: string; el: HTMLElement }[]>([]);

    useEffect(() => {
        // Small delay to ensure the DOM has been painted with the new content
        const timer = setTimeout(() => {
            if (!contentRef.current) return;
            const nodes = contentRef.current.querySelectorAll('[data-embed-type="track"], [data-embed-type="profile"]');
            const found: { type: string; url: string; el: HTMLElement }[] = [];
            nodes.forEach(n => {
                const el = n as HTMLElement;
                const type = el.getAttribute('data-embed-type')!;
                const url = el.getAttribute('data-embed-url')!;
                if (type && url) found.push({ type, url, el });
            });
            setEmbeds(found);
        }, 0);
        return () => clearTimeout(timer);
    }, [articleContent]);

    return (
        <>
            {embeds.map((embed, i) => {
                const Component = embed.type === 'track' ? TrackEmbed : ProfileEmbed;
                const prop = embed.type === 'track' ? 'trackPath' : 'profilePath';
                return (
                    <EmbedPortal key={`${embed.type}-${embed.url}-${i}`} container={embed.el}>
                        <Component {...{ [prop]: embed.url } as any} />
                    </EmbedPortal>
                );
            })}
        </>
    );
};

// ── Portal: renders React into a wrapper inside the container, hiding originals ──
const EmbedPortal: React.FC<{ container: HTMLElement; children: React.ReactNode }> = ({ container, children }) => {
    const [wrapper] = useState(() => document.createElement('div'));

    useEffect(() => {
        // Hide original static content instead of removing it (prevents React removeChild crash)
        Array.from(container.childNodes).forEach(child => {
            if (child instanceof HTMLElement && child !== wrapper) {
                child.style.display = 'none';
            }
        });
        container.style.cssText = 'margin:0;padding:0;border:none;background:none;';
        container.removeAttribute('contenteditable');

        if (!wrapper.parentNode) {
            container.appendChild(wrapper);
        }

        return () => {
            try {
                if (wrapper.parentNode === container) {
                    container.removeChild(wrapper);
                }
            } catch { /* container may already be detached */ }
        };
    }, [container, wrapper]);

    return createPortal(children, wrapper);
};
