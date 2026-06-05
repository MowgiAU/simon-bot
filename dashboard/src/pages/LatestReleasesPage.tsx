import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, Pause, Sparkles } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { FujiLogo } from '../components/FujiLogo';
import { StyledUsername } from '../components/StyledUsername';

interface TrackInfo {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    playCount: number;
    createdAt?: string;
    profile: {
        userId: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
    };
}

const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'today';
    if (days < 2) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString();
};

export const LatestReleasesPage: React.FC = () => {
    const [tracks, setTracks] = useState<TrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const { setTrack, player, togglePlay } = usePlayer();
    const { currentTrack, isPlaying } = player;

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await axios.get('/api/discovery/tracks', { params: { sort: 'newest', limit: 60 } });
                if (!cancelled) setTracks(res.data?.tracks || []);
            } catch (e) {
                console.error('Failed to load latest releases', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <DiscoveryLayout activeTab="new">
            <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', color: colors.textPrimary }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.lg }}>
                    <Sparkles size={28} color={colors.primary} style={{ marginRight: '14px' }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px' }}>New Releases</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>The freshest tracks dropped on Fuji Studio</p>
                    </div>
                </div>

                {loading && (
                    <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>Loading…</div>
                )}

                {!loading && tracks.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>No tracks yet.</div>
                )}

                {!loading && tracks.length > 0 && (
                    isMobile ? (
                        /* Mobile: compact list rows */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {tracks.map((track, i) => {
                                const playing = currentTrack?.id === track.id && isPlaying;
                                return (
                                    <div
                                        key={track.id}
                                        onClick={() => { if (currentTrack?.id === track.id) togglePlay(); else setTrack(track, tracks); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '10px 12px',
                                            background: playing ? 'rgba(211, 108, 8,0.08)' : 'transparent',
                                            borderRadius: borderRadius.sm,
                                            cursor: 'pointer',
                                            borderLeft: `3px solid ${playing ? colors.primary : 'transparent'}`,
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        {/* Rank */}
                                        <span style={{ width: '20px', textAlign: 'center', fontSize: '11px', color: colors.textTertiary, flexShrink: 0 }}>
                                            {playing ? <Play size={10} fill={colors.primary} color={colors.primary} /> : i + 1}
                                        </span>
                                        {/* Cover */}
                                        <div style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', background: '#1a2234', flexShrink: 0, position: 'relative' }}>
                                            {track.coverUrl
                                                ? <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FujiLogo size={18} color={colors.primary} opacity={0.3} /></div>
                                            }
                                        </div>
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: playing ? colors.primary : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <StyledUsername userId={track.profile.userId} showBadge={false}>{track.profile.displayName || track.profile.username}</StyledUsername>
                                            </p>
                                        </div>
                                        {/* Meta */}
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ margin: 0, fontSize: '10px', color: colors.textTertiary }}>{formatDate(track.createdAt)}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: colors.textTertiary }}>{(track.playCount || 0).toLocaleString()} plays</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Desktop: card grid */
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: spacing.md,
                        }}>
                            {tracks.map(track => {
                                const playing = currentTrack?.id === track.id && isPlaying;
                                return (
                                    <div
                                        key={track.id}
                                        onClick={() => { if (currentTrack?.id === track.id) togglePlay(); else setTrack(track, tracks); }}
                                        style={{
                                            background: colors.surface,
                                            borderRadius: borderRadius.md,
                                            padding: spacing.sm,
                                            cursor: 'pointer',
                                            border: `1px solid ${playing ? colors.primary : 'transparent'}`,
                                            transition: 'border-color 0.15s, transform 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                                    >
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: borderRadius.sm, overflow: 'hidden', background: '#1a2234', marginBottom: spacing.sm }}>
                                            {track.coverUrl
                                                ? <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FujiLogo size={36} color={colors.primary} opacity={0.2} /></div>
                                            }
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: playing ? 1 : 0, transition: 'opacity 0.15s' }}>
                                                {playing
                                                    ? <Pause size={28} fill={colors.primary} color={colors.primary} />
                                                    : <Play size={28} fill="white" color="white" style={{ marginLeft: '3px' }} />
                                                }
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '13px', color: playing ? colors.primary : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            <StyledUsername userId={track.profile.userId} showBadge={false}>{track.profile.displayName || track.profile.username}</StyledUsername>
                                        </div>
                                        <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{formatDate(track.createdAt)}</span>
                                            <span>{(track.playCount || 0).toLocaleString()} plays</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>
        </DiscoveryLayout>
    );
};
