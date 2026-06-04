/**
 * Test Frontpage – Stitch Variant A  (dark neon leaderboard layout)
 * Hidden route: /preview/stitch-a
 * Not linked from any nav — access by URL only.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import {
    Play, Pause, Heart, Folder, Swords, FileText,
    Upload, ExternalLink, Zap, Music, Users,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const NEON  = '#4ade80';
const CYAN  = '#22d3ee';
const CARD  = '#161b22';
const BG    = '#0b0e11';
const GRAD  = 'linear-gradient(90deg, #4ade80 0%, #22d3ee 100%)';

function coverUrl(src: string | null): string {
    if (!src) return '';
    if (src.startsWith('http') || src.startsWith('/uploads/')) return src;
    return `${API}${src}`;
}

function avatarUrl(avatar: string | null, userId: string): string {
    if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (avatar.startsWith('http') || avatar.startsWith('/uploads/')) return avatar;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
}

/** Deterministic waveform heights from a string seed */
function waveHeights(seed: string, bars = 5): number[] {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0;
    return Array.from({ length: bars }, (_, i) => {
        h = (h * 1664525 + 1013904223) >>> 0;
        return 8 + (h % 20);
    });
}

export const FrontpageStitch: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const { user } = useAuth();
    const [isMobile] = useState(window.innerWidth < 1024);

    const { data } = useQuery({
        queryKey: ['frontpage-stitch-a'],
        queryFn: async () => {
            const [tracksRes, chartRes, featuredRes, articleRes] = await Promise.all([
                axios.get('/api/musician/leaderboards/tracks', { params: { limit: 12 } }),
                axios.get('/api/charts/weekly', { params: { limit: 10 } }),
                axios.get('/api/discovery/settings').catch(() => ({ data: null })),
                axios.get('/api/articles/featured/current').catch(() => ({ data: null })),
            ]);
            return {
                topTracks:   tracksRes.data,
                weeklyChart: chartRes.data?.entries ?? [],
                featured:    featuredRes.data,
                article:     articleRes.data,
            };
        },
        staleTime: 1000 * 60 * 2,
    });

    const weeklyChart    = data?.weeklyChart    ?? [];
    const topTracks      = data?.topTracks      ?? [];
    const featured       = data?.featured       ?? null;
    const article        = data?.article        ?? null;
    const featuredBattle = featured?.featuredBattle ?? null;
    const sponsors       = featured?.globalSponsors ?? [];

    // Featured track for the player card: use featuredTrack or #1 weekly
    const playerTrack = (() => {
        if (featured?.featuredTrack) return featured.featuredTrack;
        const top = weeklyChart[0]?.track ?? weeklyChart[0];
        return top ?? topTracks[0] ?? null;
    })();

    function play(t: any) {
        const id  = t?.id  ?? t?.track?.id;
        const url = t?.url ?? t?.track?.url;
        if (!url) return;
        if (player.currentTrack?.id === id) { togglePlay(); return; }
        const p = t?.profile ?? t?.track?.profile;
        setTrack({
            id,
            title:    t?.title    ?? t?.track?.title    ?? 'Unknown',
            artist:   t?.artist   ?? t?.track?.artist   ?? p?.displayName ?? p?.username ?? 'Unknown',
            username: p?.username ?? '',
            url,
            cover:    coverUrl(t?.coverUrl ?? t?.track?.coverUrl ?? null),
        });
    }

    const isPlayingTrack = (t: any) => {
        const id = t?.id ?? t?.track?.id;
        return player.currentTrack?.id === id && player.isPlaying;
    };

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <DiscoveryLayout activeTab="home">
            {/* dev badge */}
            <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: NEON, color: BG, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.1em', pointerEvents: 'none' }}>
                STITCH A — TEST
            </div>

            <div style={{ background: BG, color: '#fff', fontFamily: 'Inter, sans-serif', minHeight: '100vh', padding: isMobile ? '24px 16px' : '32px 24px', display: 'flex', flexDirection: 'column', gap: 48 }}>

                {/* ══ 1. HERO ═══════════════════════════════════════════════════ */}
                <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '8fr 4fr', gap: 24 }}>

                    {/* Main banner — featured battle */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1a2e24 0%, #0e1612 100%)',
                        borderRadius: 24, padding: isMobile ? '32px 24px' : '48px', minHeight: 380,
                        border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                        {/* Glow */}
                        <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'rgba(74,222,128,0.07)', filter: 'blur(80px)', borderRadius: '50%', pointerEvents: 'none' }} />

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                                {featuredBattle?.sponsor?.name ? `${featuredBattle.sponsor.name} Presents` : 'Featured Battle'}
                            </div>
                            <h1 style={{ fontSize: isMobile ? 28 : 44, fontWeight: 800, lineHeight: 1.15, margin: 0 }}>
                                {featuredBattle?.title ?? 'Fuji Studio Beat Battle'}
                            </h1>
                            {featuredBattle && (
                                <p style={{ fontSize: 16, color: '#9ca3af', marginTop: 12, maxWidth: 380 }}>
                                    {featuredBattle.prizes?.[0]?.description ?? featuredBattle.prizes?.[0]?.title ?? 'Compete. Win. Get discovered.'}
                                </p>
                            )}
                        </div>

                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 32, flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <span style={{ fontSize: 13, color: '#9ca3af' }}>
                                    {featuredBattle?._count?.entries ?? 0} entries ·{' '}
                                </span>
                                {featuredBattle && (
                                    <Link to={`/battles/${featuredBattle.id}`} style={{ fontSize: 13, color: NEON, textDecoration: 'underline', fontWeight: 600 }}>
                                        {featuredBattle.status === 'completed' ? 'View Results.' : featuredBattle.status === 'voting' ? 'Vote Now.' : 'View Battle.'}
                                    </Link>
                                )}
                            </div>
                            {featuredBattle && (
                                <Link to={`/battles/${featuredBattle.id}`} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    background: GRAD, color: BG, fontWeight: 700, fontSize: 13,
                                    padding: '10px 22px', borderRadius: 12, textDecoration: 'none',
                                }}>
                                    <Swords size={14} />
                                    {featuredBattle.status === 'voting' ? 'Vote Now' : featuredBattle.status === 'active' ? 'Submit' : 'See Details'}
                                </Link>
                            )}
                        </div>

                        {/* Sponsor circle badge */}
                        {featuredBattle?.sponsor?.name && (
                            <div style={{
                                position: 'absolute', right: isMobile ? 16 : 48, top: '50%', transform: 'translateY(-50%)',
                                width: isMobile ? 80 : 180, height: isMobile ? 80 : 180, borderRadius: '50%',
                                border: `3px solid rgba(34,211,238,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 50px rgba(34,211,238,0.15)',
                            }}>
                                <div style={{ width: '85%', height: '85%', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(34,211,238,0.3), transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: isMobile ? 18 : 40, fontWeight: 900, color: CYAN, fontStyle: 'italic' }}>
                                        {featuredBattle.sponsor.name.slice(0, 2).toUpperCase()}.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Player card — featured track */}
                    {playerTrack && (
                        <div style={{ background: CARD, borderRadius: 24, padding: 24, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                            {/* Cover */}
                            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '1' }}>
                                {coverUrl(playerTrack.coverUrl) ? (
                                    <img src={coverUrl(playerTrack.coverUrl)} alt={playerTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Music size={48} color="rgba(255,255,255,0.1)" />
                                    </div>
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => play(playerTrack)}
                                        style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}
                                    >
                                        {isPlayingTrack(playerTrack)
                                            ? <Pause size={24} color="#fff" />
                                            : <Play size={24} color="#fff" style={{ marginLeft: 3 }} />
                                        }
                                    </button>
                                </div>
                                {/* Waveform decoration */}
                                <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                                    {waveHeights(playerTrack.id ?? 'x').map((h, i) => (
                                        <div key={i} style={{ width: 2, height: h, background: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
                                    ))}
                                </div>
                            </div>

                            {/* Info */}
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{playerTrack.title}</h3>
                                <p style={{ fontSize: 13, color: '#9ca3af', margin: '3px 0 0' }}>
                                    {playerTrack.profile?.displayName || playerTrack.profile?.username || playerTrack.artist || 'Unknown'}
                                </p>
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#6b7280' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Play size={11} fill="currentColor" /> {playerTrack.playCount?.toLocaleString() ?? '—'}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Heart size={11} /> —
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Folder size={11} /> —
                                </span>
                            </div>

                            {/* Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    onClick={() => play(playerTrack)}
                                    style={{ width: 40, height: 40, borderRadius: '50%', background: CYAN, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                >
                                    {isPlayingTrack(playerTrack)
                                        ? <Pause size={18} color={BG} />
                                        : <Play size={18} color={BG} style={{ marginLeft: 2 }} />
                                    }
                                </button>
                                {playerTrack.profile?.username && (
                                    <Link to={`/track/${playerTrack.profile.username}/${playerTrack.slug || playerTrack.id}`}
                                        style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Music size={14} /> Open track
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Pagination dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: -32 }}>
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{ width: i === 0 ? 32 : 8, height: 4, borderRadius: 2, background: i === 0 ? NEON : 'rgba(255,255,255,0.12)' }} />
                    ))}
                </div>

                {/* ══ 2. QUICK ACTIONS GRID ═══════════════════════════════════ */}
                <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
                    {[
                        {
                            icon: <Zap size={28} color={NEON} />,
                            label: '1V1 ARENA',
                            title: 'Producer vs Producer',
                            cta: 'Enter the Arena',
                            to: '/arena',
                            hover: NEON,
                        },
                        {
                            icon: <FileText size={28} color={CYAN} />,
                            label: 'FEATURED ARTICLE',
                            title: article?.title ?? 'Fuji Studio Community',
                            cta: 'Read Article',
                            to: article ? '/articles' : '/articles',
                            hover: CYAN,
                        },
                        {
                            icon: <Users size={28} color="#60a5fa" />,
                            label: 'COMMUNITY',
                            title: 'Join 50,000+ FL Studio producers on Discord',
                            cta: 'Join Discord',
                            href: 'https://discord.gg/fujistudio',
                            hover: '#60a5fa',
                        },
                        {
                            icon: <Upload size={28} color="#d1d5db" />,
                            label: 'SHARE YOUR MUSIC',
                            title: 'Get discovered',
                            cta: 'Upload Track',
                            to: user ? '/my-tracks' : '/login',
                            hover: '#d1d5db',
                        },
                    ].map((card, i) => (
                        card.href ? (
                            <a key={i} href={card.href} target="_blank" rel="noopener noreferrer" style={{
                                background: CARD, padding: 24, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 200,
                                textDecoration: 'none', cursor: 'pointer', transition: 'border-color 0.2s',
                            }}>
                                <div>
                                    {card.icon}
                                    <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '12px 0 4px' }}>{card.label}</p>
                                    <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.35 }}>{card.title}</h4>
                                </div>
                                <div style={{ background: GRAD, color: BG, fontWeight: 700, fontSize: 12, padding: '9px 0', borderRadius: 10, textAlign: 'center' }}>
                                    {card.cta}
                                </div>
                            </a>
                        ) : (
                            <Link key={i} to={card.to!} style={{
                                background: CARD, padding: 24, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 200,
                                textDecoration: 'none', cursor: 'pointer', transition: 'border-color 0.2s',
                            }}>
                                <div>
                                    {card.icon}
                                    <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '12px 0 4px' }}>{card.label}</p>
                                    <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.35 }}>{card.title}</h4>
                                </div>
                                <div style={{ background: GRAD, color: BG, fontWeight: 700, fontSize: 12, padding: '9px 0', borderRadius: 10, textAlign: 'center' }}>
                                    {card.cta}
                                </div>
                            </Link>
                        )
                    ))}
                </section>

                {/* ══ 3. SPONSORS ══════════════════════════════════════════════ */}
                {sponsors.length > 0 && (
                    <section style={{ background: 'rgba(22,27,34,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 24, padding: '28px 32px' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 20px' }}>SPONSORS</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-around', gap: 24, opacity: 0.6 }}>
                            {sponsors.map((s: any) => (
                                <a key={s.id} href={s.websiteUrl ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                    {s.logoUrl
                                        ? <img src={s.logoUrl} alt={s.name} style={{ height: 28, objectFit: 'contain', filter: 'grayscale(1) brightness(1.2)' }} />
                                        : s.name
                                    }
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                {/* ══ 4. TOP 10 LEADERBOARD ════════════════════════════════════ */}
                {weeklyChart.length > 0 && (
                    <section>
                        <h2 style={{ fontSize: isMobile ? 28 : 44, fontWeight: 800, margin: '0 0 28px', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                            TOP 10 THIS WEEK
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px 32px' }}>
                            {weeklyChart.slice(0, 10).map((entry: any, i: number) => {
                                const track   = entry.track ?? entry;
                                const profile = track.profile ?? {};
                                const cover   = coverUrl(track.coverUrl);
                                const playing = isPlayingTrack(track);
                                const waves   = waveHeights(track.id ?? String(i));
                                return (
                                    <div
                                        key={track.id ?? i}
                                        onClick={() => play(track)}
                                        style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'background 0.15s' }}
                                    >
                                        {/* Number */}
                                        <span style={{ fontSize: 42, fontWeight: 900, color: playing ? NEON : 'rgba(74,222,128,0.25)', width: 44, textAlign: 'center', flexShrink: 0, transition: 'color 0.15s', lineHeight: 1 }}>
                                            {i + 1}
                                        </span>

                                        {/* Cover */}
                                        <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }}>
                                            {cover
                                                ? <img src={cover} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={20} color="rgba(255,255,255,0.15)" /></div>
                                            }
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h5 style={{ fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{track.title}</h5>
                                            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {profile.displayName || profile.username || track.artist || 'Unknown'}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 10, color: '#6b7280' }}>
                                                {entry.playsInPeriod !== undefined && <span>{entry.playsInPeriod?.toLocaleString()} plays</span>}
                                                <span style={{ color: NEON, fontWeight: 700 }}># {entry.position ?? i + 1}</span>
                                            </div>
                                        </div>

                                        {/* Waveform decoration */}
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, paddingRight: 8, flexShrink: 0 }}>
                                            {waves.map((h, wi) => (
                                                <div key={wi} style={{ width: 2, height: h, background: playing ? `${NEON}55` : 'rgba(255,255,255,0.1)', borderRadius: 1, transition: 'background 0.15s' }} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </DiscoveryLayout>
    );
};
