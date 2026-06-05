/**
 * Test Frontpage – Alt_E  (Neon/Cyberpunk desktop experience)
 * Hidden route: /preview/alt_e
 * Not linked from any nav — access by URL only.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import {
    Play, Pause, Swords, Trophy, ArrowUp, ArrowDown,
    Minus, Upload, ExternalLink, Music, Zap, Star,
    ChevronRight, Heart, Users,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// ── Neon palette ────────────────────────────────────────────────────────────
const N = {
    bg:       '#10141a',
    surface:  '#1c2026',
    glass:    'rgba(255,255,255,0.03)',
    border:   'rgba(255,255,255,0.1)',
    mint:     '#00e38b',
    mintBright: '#00ff9d',
    magenta:  '#ffaaf6',
    cyan:     '#00daf3',
    text:     '#dfe2eb',
    muted:    'rgba(185,203,188,0.6)',
    outline:  'rgba(132,149,135,0.3)',
};

// ── Waveform component with animation ────────────────────────────────────────
function AnimatedWaveform() {
    const [heights, setHeights] = useState(() =>
        Array.from({ length: 32 }, () => Math.floor(Math.random() * 70) + 30)
    );
    useEffect(() => {
        const id = setInterval(() => {
            setHeights(Array.from({ length: 32 }, () => Math.floor(Math.random() * 70) + 30));
        }, 180);
        return () => clearInterval(id);
    }, []);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
            {heights.map((h, i) => (
                <div key={i} style={{ width: 3, height: `${h}%`, borderRadius: 2, background: h > 60 ? N.mint : `${N.mint}44`, transition: 'height 0.15s ease', flexShrink: 0 }} />
            ))}
        </div>
    );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function imgUrl(src: string | null): string {
    if (!src) return '';
    if (src.startsWith('http') || src.startsWith('/uploads/')) return src;
    return `${API}${src}`;
}

function avatarUrl(av: string | null, userId: string): string {
    if (!av) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (av.startsWith('http') || av.startsWith('/uploads/')) return av;
    return `https://cdn.discordapp.com/avatars/${userId}/${av}.png?size=256`;
}

// ── page ─────────────────────────────────────────────────────────────────────
export const FrontpageNeon: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const { user } = useAuth();
    const [isMobile] = useState(window.innerWidth < 1024);

    const { data } = useQuery({
        queryKey: ['discovery-home'],
        queryFn: async () => {
            const [profilesRes, tracksRes, chartRes, featuredRes, h2hRes] = await Promise.all([
                axios.get('/api/musician/profiles'),
                axios.get('/api/musician/leaderboards/tracks', { params: { limit: 10 } }),
                axios.get('/api/charts/weekly', { params: { limit: 10 } }),
                axios.get('/api/discovery/settings').catch(() => ({ data: null })),
                axios.get('/api/head-to-head/leaderboard?limit=5').catch(() => ({ data: [] })),
            ]);
            return {
                artists:     [...profilesRes.data].sort((a: any, b: any) => (b.totalPlays || 0) - (a.totalPlays || 0)),
                topTracks:   tracksRes.data,
                weeklyChart: chartRes.data?.entries ?? [],
                featured:    featuredRes.data,
                h2h:         Array.isArray(h2hRes.data) ? h2hRes.data : [],
                sponsors:    featuredRes.data?.globalSponsors ?? [],
            };
        },
        staleTime: 1000 * 60 * 2,
    });

    const h2h          = data?.h2h         ?? [];
    const weeklyChart  = data?.weeklyChart  ?? [];
    const topTracks    = data?.topTracks    ?? [];
    const featured     = data?.featured     ?? null;
    const artists      = data?.artists      ?? [];
    const sponsors     = data?.sponsors     ?? [];
    const featArtist   = featured?.featuredArtist ?? (artists[0] ?? null);
    const featTrack    = featured?.featuredTrack ?? topTracks[0] ?? null;
    const battle       = featured?.featuredBattle ?? null;

    function play(t: any) {
        const track = t?.track ?? t;
        const id = track?.id, url = track?.url;
        if (!url) return;
        if (player.currentTrack?.id === id) { togglePlay(); return; }
        const p = track?.profile;
        setTrack({ id, title: track?.title ?? 'Unknown', artist: track?.artist ?? p?.displayName ?? p?.username ?? 'Unknown', username: p?.username ?? '', url, cover: imgUrl(track?.coverUrl ?? null) });
    }

    function isPlaying(t: any) {
        const id = (t?.track ?? t)?.id;
        return player.currentTrack?.id === id && player.isPlaying;
    }

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <DiscoveryLayout activeTab="home">
            {/* dev badge */}
            <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: N.mint, color: N.bg, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.1em', pointerEvents: 'none', fontFamily: 'monospace' }}>
                ALT_E — TEST
            </div>

            <div style={{ background: N.bg, color: N.text, fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>

                {/* ══ 1. HERO — H2H BATTLE or Featured Battle ══════════════════ */}
                <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px' : '48px 48px 32px', position: 'relative' }}>
                    {/* Ambient glow */}
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${N.mint}08, transparent 60%), radial-gradient(ellipse at 70% 50%, ${N.magenta}06, transparent 60%)`, pointerEvents: 'none' }} />

                    <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: N.mint }}>
                            {battle ? 'Featured Battle' : h2h.length >= 2 ? 'Live H2H Battle' : 'Community Battles'}
                        </span>
                        <h1 style={{ fontSize: isMobile ? 28 : 48, fontWeight: 900, letterSpacing: '-0.02em', margin: '8px 0 0', color: N.text, lineHeight: 1.1 }}>
                            {battle ? (battle.title || "").toUpperCase() : h2h.length >= 2 ? `${(h2h[0].displayName || h2h[0].username || "").toUpperCase()} vs ${(h2h[1].displayName || h2h[1].username || "").toUpperCase()}` : 'DRUM_TECH SHOWDOWN'}
                        </h1>
                    </div>

                    {/* VS card */}
                    <div style={{ background: N.glass, backdropFilter: 'blur(12px)', border: `1px solid ${N.border}`, borderRadius: 24, padding: isMobile ? '24px 16px' : '48px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr', gap: isMobile ? 24 : 40, alignItems: 'center' }}>
                            {/* Challenger A */}
                            {h2h.length >= 1 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', inset: -8, border: `1px solid ${N.mint}44`, borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                                        <img src={avatarUrl(h2h[0].avatar, h2h[0].userId)} alt={h2h[0].username} style={{ width: isMobile ? 100 : 160, height: isMobile ? 100 : 160, borderRadius: '50%', border: `3px solid ${N.mint}`, objectFit: 'cover', boxShadow: `0 0 30px ${N.mint}44` }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <h3 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800, color: N.mint, margin: 0, letterSpacing: '-0.01em', fontFamily: 'monospace' }}>{(h2h[0].displayName || h2h[0].username || "").toUpperCase()}</h3>
                                        <p style={{ fontSize: 11, color: N.muted, margin: '4px 0 0', fontFamily: 'monospace', letterSpacing: '0.05em' }}>RANK #{h2h[0].rank ?? 1} • {h2h[0].elo} ELO</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 160, height: 160, borderRadius: '50%', background: N.surface, border: `3px solid ${N.mint}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={40} color={N.mint} style={{ opacity: 0.3 }} /></div>
                                    <h3 style={{ fontSize: 24, fontWeight: 800, color: N.muted, margin: 0, fontFamily: 'monospace' }}>???</h3>
                                </div>
                            )}

                            {/* VS divider */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: isMobile ? 28 : 48, fontWeight: 900, fontStyle: 'italic', color: N.outline }}>VS</span>
                                <div style={{ width: 1, height: isMobile ? 20 : 60, background: `linear-gradient(to bottom, transparent, ${N.outline}, transparent)` }} />
                                <div style={{ background: N.magenta, color: '#fff', padding: '3px 12px', borderRadius: 999, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', animation: 'pulse 1s infinite' }}>LIVE</div>
                            </div>

                            {/* Challenger B */}
                            {h2h.length >= 2 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', inset: -8, border: `1px solid ${N.magenta}44`, borderRadius: '50%', animation: 'pulse 2s 1s infinite' }} />
                                        <img src={avatarUrl(h2h[1].avatar, h2h[1].userId)} alt={h2h[1].username} style={{ width: isMobile ? 100 : 160, height: isMobile ? 100 : 160, borderRadius: '50%', border: `3px solid ${N.magenta}`, objectFit: 'cover', boxShadow: `0 0 30px ${N.magenta}44` }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <h3 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800, color: N.magenta, margin: 0, letterSpacing: '-0.01em', fontFamily: 'monospace' }}>{(h2h[1].displayName || h2h[1].username || "").toUpperCase()}</h3>
                                        <p style={{ fontSize: 11, color: N.muted, margin: '4px 0 0', fontFamily: 'monospace', letterSpacing: '0.05em' }}>RANK #{h2h[1].rank ?? 2} • {h2h[1].elo} ELO</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 160, height: 160, borderRadius: '50%', background: N.surface, border: `3px solid ${N.magenta}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={40} color={N.magenta} style={{ opacity: 0.3 }} /></div>
                                    <h3 style={{ fontSize: 24, fontWeight: 800, color: N.muted, margin: 0, fontFamily: 'monospace' }}>???</h3>
                                </div>
                            )}
                        </div>

                        {/* CTAs */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                            <Link to="/arena" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: N.bg, padding: '12px 32px', borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: `0 0 24px rgba(255,255,255,0.2)`, letterSpacing: '0.02em' }}>
                                <Trophy size={16} /> Vote Now
                            </Link>
                            <Link to="/arena" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.07)', color: N.text, border: `1px solid ${N.border}`, padding: '12px 32px', borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                                <Swords size={16} color={N.magenta} /> View All Battles
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ══ 2. TRACK OF THE DAY ═══════════════════════════════════════ */}
                {featTrack && (
                    <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px 24px' : '0 48px 32px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: isMobile ? 20 : 26, fontWeight: 800, color: N.text, margin: '0 0 16px' }}>
                            <Star size={20} color={N.mint} /> Track of the Day
                        </h2>
                        <div
                            style={{ background: N.glass, backdropFilter: 'blur(12px)', border: `1px solid ${N.border}`, borderRadius: 24, padding: isMobile ? '20px' : '40px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: 32, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                            onClick={() => play(featTrack)}
                        >
                            {/* Decorative music note */}
                            <div style={{ position: 'absolute', top: 0, right: 0, padding: 24, opacity: 0.06, pointerEvents: 'none' }}>
                                <Music size={120} color={N.mint} />
                            </div>

                            {/* Cover */}
                            <div style={{ position: 'relative', flexShrink: 0, width: isMobile ? 140 : 200, height: isMobile ? 140 : 200, borderRadius: 16, overflow: 'hidden', boxShadow: `0 20px 60px rgba(0,0,0,0.5)` }}>
                                {imgUrl(featTrack.coverUrl) ? (
                                    <img src={imgUrl(featTrack.coverUrl)} alt={featTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: N.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={48} color={N.mint} style={{ opacity: 0.3 }} /></div>
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying(featTrack) ? 1 : 0, transition: 'opacity 0.2s' }}>
                                    {isPlaying(featTrack) && <Pause size={40} color="#fff" />}
                                </div>
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <h3 style={{ fontSize: isMobile ? 22 : 36, fontWeight: 900, letterSpacing: '-0.02em', color: N.text, margin: '0 0 4px', fontFamily: 'monospace' }}>
                                        {(featTrack.title || "").toUpperCase()}
                                    </h3>
                                    <p style={{ fontSize: 16, fontWeight: 600, color: N.mint, margin: 0, letterSpacing: '-0.01em' }}>
                                        {featTrack.profile?.displayName || featTrack.profile?.username || featTrack.artist}
                                    </p>
                                </div>
                                <AnimatedWaveform />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 12, fontSize: 12, color: N.muted, fontFamily: 'monospace' }}>
                                    {featTrack.playCount && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Play size={12} /> {featTrack.playCount.toLocaleString()} PLAYS</span>}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Heart size={12} color={N.magenta} /> {(Math.floor(Math.random() * 900) + 100).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Play button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); play(featTrack); }}
                                style={{ width: 56, height: 56, borderRadius: '50%', background: N.mint, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 24px ${N.mint}55`, flexShrink: 0 }}
                            >
                                {isPlaying(featTrack) ? <Pause size={22} color={N.bg} /> : <Play size={22} color={N.bg} style={{ marginLeft: 2 }} />}
                            </button>
                        </div>
                    </section>
                )}

                {/* ══ 3. BENTO — Featured Artist + Top Charts ═══════════════════ */}
                <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px 24px' : '0 48px 32px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '7fr 5fr', gap: 16, alignItems: 'start' }}>

                    {/* Featured Artist */}
                    {featArtist && (
                        <div style={{ background: N.glass, backdropFilter: 'blur(12px)', border: `1px solid ${N.border}`, borderRadius: 24, overflow: 'hidden' }}>
                            <div style={{ position: 'relative', height: isMobile ? 200 : 280, overflow: 'hidden' }}>
                                <img src={avatarUrl(featArtist.avatar, featArtist.id ?? featArtist.userId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'brightness(0.7)' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #10141a 0%, transparent 60%)' }} />
                                <div style={{ position: 'absolute', top: 16, left: 16, background: N.mint, color: N.bg, padding: '3px 12px', borderRadius: 999, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>
                                    FEATURED ARTIST
                                </div>
                            </div>
                            <div style={{ padding: isMobile ? '20px' : '32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <h3 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: N.text, margin: 0, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                                    {(featArtist.displayName || featArtist.username || "").toUpperCase()}
                                </h3>
                                {featArtist.bio && (
                                    <p style={{ fontSize: 14, color: N.muted, margin: 0, lineHeight: 1.7 }}>{featArtist.bio.slice(0, 180)}{featArtist.bio.length > 180 ? '…' : ''}</p>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: N.muted }}>
                                        <Users size={14} /> {featArtist.totalPlays?.toLocaleString() ?? '—'} plays
                                    </div>
                                    <Link to={`/profile/${featArtist.username}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: N.mint, fontWeight: 700, fontSize: 13, textDecoration: 'none', fontFamily: 'monospace' }}>
                                        VIEW PROFILE <ChevronRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Charts */}
                    <div style={{ background: N.glass, backdropFilter: 'blur(12px)', border: `1px solid ${N.border}`, borderRadius: 24, padding: isMobile ? '20px' : '32px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: N.text, margin: 0 }}>Top 10 Charts</h3>
                            <Link to="/charts" style={{ fontFamily: 'monospace', fontSize: 11, color: N.mint, textDecoration: 'none', letterSpacing: '0.05em' }}>VIEW ALL →</Link>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            {weeklyChart.slice(0, 7).map((entry: any, i: number) => {
                                const track = entry.track ?? entry;
                                const playing = isPlaying(track);
                                const change = entry.positionChange;
                                return (
                                    <div
                                        key={track.id ?? i}
                                        onClick={() => play(track)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s', background: playing ? `${N.mint}10` : 'transparent' }}
                                    >
                                        <span style={{ fontFamily: 'monospace', fontSize: 18, fontStyle: 'italic', color: N.outline, width: 32, flexShrink: 0, textAlign: 'center' }}>
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: N.surface }}>
                                            {imgUrl(track.coverUrl) && <img src={imgUrl(track.coverUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: playing ? N.mint : N.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>{track.title}</p>
                                            <p style={{ fontSize: 11, color: N.muted, margin: '1px 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.profile?.displayName || track.profile?.username || ''}</p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            {entry.playsInPeriod && <p style={{ fontSize: 11, color: N.text, margin: 0, fontFamily: 'monospace' }}>{(entry.playsInPeriod / 1000).toFixed(0)}K</p>}
                                            {change !== null && change !== undefined && (
                                                <p style={{ fontSize: 10, color: change > 0 ? N.mint : change < 0 ? '#f87171' : N.muted, margin: '1px 0 0', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontFamily: 'monospace' }}>
                                                    {change > 0 ? <ArrowUp size={9} /> : change < 0 ? <ArrowDown size={9} /> : <Minus size={9} />}
                                                    {Math.abs(change) || '—'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => play(weeklyChart[0]?.track ?? weeklyChart[0])} style={{ marginTop: 20, width: '100%', padding: '12px 0', border: `1px solid ${N.mint}33`, borderRadius: 12, color: N.mint, fontWeight: 700, fontSize: 13, background: 'transparent', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.05em', transition: 'background 0.15s' }}>
                            DISCOVER MORE TRACKS
                        </button>
                    </div>
                </section>

                {/* ══ 4. SPONSORS ═══════════════════════════════════════════════ */}
                {sponsors.length > 0 && (
                    <section style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, background: '#0a0e14', padding: '40px 0', overflow: 'hidden' }}>
                        <p style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 10, color: 'rgba(185,203,188,0.4)', letterSpacing: '0.3em', textTransform: 'uppercase', margin: '0 0 28px' }}>Powered by the Future of Audio</p>
                        <div style={{ display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '0 48px' }}>
                            {sponsors.map((s: any) => (
                                <a key={s.id} href={s.websiteUrl ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.4, textDecoration: 'none', transition: 'opacity 0.2s' }}>
                                    {s.logoUrl ? <img src={s.logoUrl} alt={s.name} style={{ height: 24, objectFit: 'contain', filter: 'grayscale(1) brightness(2)' }} /> : null}
                                    <span style={{ fontSize: 18, fontWeight: 800, color: N.text, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>{(s.name || "").toUpperCase()}</span>
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                {/* ══ 5. CTA ROW ════════════════════════════════════════════════ */}
                <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '32px 48px 64px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                    <Link to={user ? '/my-tracks' : '/login'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${N.mint}22, ${N.cyan}11)`, border: `1px solid ${N.mint}44`, borderRadius: 20, padding: '28px 32px', textDecoration: 'none', overflow: 'hidden', position: 'relative' }}>
                        <div>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em', fontFamily: 'monospace' }}>UPLOAD YOUR TRACK</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 16px' }}>Get discovered in the underground.</p>
                            <span style={{ background: N.mint, color: N.bg, fontWeight: 700, fontSize: 12, padding: '8px 20px', borderRadius: 999, display: 'inline-block', fontFamily: 'monospace', letterSpacing: '0.05em' }}>UPLOAD NOW</span>
                        </div>
                        <Upload size={80} color={`${N.mint}22`} style={{ position: 'absolute', right: -8, bottom: -8, flexShrink: 0 }} />
                    </Link>
                    <a href="https://discord.gg/fujistudio" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${N.magenta}22, #6366f122)`, border: `1px solid ${N.magenta}44`, borderRadius: 20, padding: '28px 32px', textDecoration: 'none', overflow: 'hidden', position: 'relative' }}>
                        <div>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em', fontFamily: 'monospace' }}>JOIN OUR DISCORD</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 16px' }}>50,000+ producers. One community.</p>
                            <span style={{ background: N.magenta, color: N.bg, fontWeight: 700, fontSize: 12, padding: '8px 20px', borderRadius: 999, display: 'inline-block', fontFamily: 'monospace', letterSpacing: '0.05em' }}>JOIN NOW</span>
                        </div>
                        <ExternalLink size={80} color={`${N.magenta}22`} style={{ position: 'absolute', right: -8, bottom: -8, flexShrink: 0 }} />
                    </a>
                </section>

                <style>{`
                    @keyframes pulse {
                        0%, 100% { opacity: 0.4; transform: scale(0.97); }
                        50% { opacity: 0.7; transform: scale(1.03); }
                    }
                `}</style>
            </div>
        </DiscoveryLayout>
    );
};
