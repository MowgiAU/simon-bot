/**
 * Test Frontpage – VHub Variant  (sidebar-hub, deep navy/cyan/magenta palette)
 * Hidden route: /preview/alt_c
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
    Play, Pause, Heart, Upload, ExternalLink,
    Swords, Users, ChevronRight, Plus, Music,
    Crown, Zap,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// VHub palette
const C = {
    bg:       '#15161e',
    bgAlt:    '#1a1b26',
    panel:    '#24283b',
    cyan:     '#7dcfff',
    magenta:  '#bb9af7',
    indigo:   '#7aa2f7',
    text:     '#c0caf5',
    muted:    '#565f89',
    grad1:    'linear-gradient(135deg, #7dcfff, #bb9af7)',
    grad2:    'linear-gradient(135deg, #bb9af7, #7aa2f7)',
    border:   'rgba(255,255,255,0.05)',
};

const ACCENT_CYCLE = [C.cyan, C.magenta, C.indigo, '#fff', C.cyan, C.magenta];

function img(src: string | null): string {
    if (!src) return '';
    if (src.startsWith('http') || src.startsWith('/uploads/')) return src;
    return `${API}${src}`;
}

function avatar(av: string | null, userId: string): string {
    if (!av) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (av.startsWith('http') || av.startsWith('/uploads/')) return av;
    return `https://cdn.discordapp.com/avatars/${userId}/${av}.png?size=128`;
}

export const FrontpageVHub: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const { user } = useAuth();
    const [isMobile] = useState(window.innerWidth < 1024);

    const { data } = useQuery({
        queryKey: ['frontpage-vhub'],
        queryFn: async () => {
            const [profilesRes, chartRes, featuredRes, h2hRes] = await Promise.all([
                axios.get('/api/musician/profiles'),
                axios.get('/api/charts/weekly', { params: { limit: 10 } }),
                axios.get('/api/discovery/settings').catch(() => ({ data: null })),
                axios.get('/api/head-to-head/leaderboard?limit=5').catch(() => ({ data: [] })),
            ]);
            return {
                artists:     profilesRes.data,
                weeklyChart: chartRes.data?.entries ?? [],
                featured:    featuredRes.data,
                h2h:         Array.isArray(h2hRes.data) ? h2hRes.data : [],
            };
        },
        staleTime: 1000 * 60 * 2,
    });

    const weeklyChart = data?.weeklyChart ?? [];
    const artists     = data?.artists     ?? [];
    const featured    = data?.featured    ?? null;
    const h2h         = data?.h2h         ?? [];
    const featuredBattle = featured?.featuredBattle ?? null;

    function play(entry: any) {
        const t   = entry?.track ?? entry;
        const id  = t?.id;
        const url = t?.url;
        if (!url) return;
        if (player.currentTrack?.id === id) { togglePlay(); return; }
        const p = t?.profile;
        setTrack({
            id,
            title:    t?.title    ?? 'Unknown',
            artist:   t?.artist   ?? p?.displayName ?? p?.username ?? 'Unknown',
            username: p?.username ?? '',
            url,
            cover:    img(t?.coverUrl ?? null),
        });
    }

    function isPlaying(entry: any) {
        const id = entry?.id ?? entry?.track?.id;
        return player.currentTrack?.id === id && player.isPlaying;
    }

    // Top 3 and rest for the trending grid
    const top3    = weeklyChart.slice(0, 3);
    const topArtists = [...artists].sort((a: any, b: any) => (b.totalPlays || 0) - (a.totalPlays || 0)).slice(0, 5);

    // ── render ─────────────────────────────────────────────────────────────────
    return (
        <DiscoveryLayout activeTab="home">
            {/* dev badge */}
            <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: C.magenta, color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.1em', pointerEvents: 'none' }}>
                VHUB — TEST
            </div>

            {/* Two-column inner layout: left battle sidebar + right main */}
            <div style={{ display: 'flex', gap: 0, background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'Inter, sans-serif' }}>

                {/* ── Left: Battle Sidebar ────────────────────────────────────── */}
                {!isMobile && (
                    <aside style={{ width: 300, flexShrink: 0, background: 'rgba(36,40,59,0.6)', backdropFilter: 'blur(10px)', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', paddingBottom: 96 }}>
                        {/* Live battles header */}
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ position: 'relative', width: 10, height: 10, display: 'inline-block' }}>
                                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#f87171', opacity: 0.7, animation: 'ping 1.5s infinite' }} />
                                        <span style={{ position: 'relative', display: 'block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                    </span>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Live Battles</span>
                                </div>
                                <Link to="/battles" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, textDecoration: 'none' }}>View All</Link>
                            </div>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* Featured 1v1 battle card */}
                            {(h2h.length >= 2 || featuredBattle) && (
                                <div style={{ margin: 16, background: C.panel, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 12 }}>
                                            <span>{featuredBattle ? 'Featured Battle' : '1v1 Beat Battle'}</span>
                                            {featuredBattle?.status === 'voting' && <span style={{ color: C.cyan }}>Voting Live</span>}
                                        </div>

                                        {h2h.length >= 2 ? (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    {/* Player 1 */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '40%' }}>
                                                        <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.cyan}` }}>
                                                            <img src={avatar(h2h[0].avatar, h2h[0].userId)} alt={h2h[0].username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0 }}>{h2h[0].displayName || h2h[0].username}</p>
                                                            <p style={{ fontSize: 10, color: C.cyan, margin: '2px 0 0' }}>{h2h[0].elo} ELO</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: 16, fontWeight: 900, fontStyle: 'italic', color: 'rgba(255,255,255,0.2)' }}>VS</div>
                                                    {/* Player 2 */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '40%' }}>
                                                        <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.magenta}` }}>
                                                            <img src={avatar(h2h[1].avatar, h2h[1].userId)} alt={h2h[1].username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0 }}>{h2h[1].displayName || h2h[1].username}</p>
                                                            <p style={{ fontSize: 10, color: C.magenta, margin: '2px 0 0' }}>{h2h[1].elo} ELO</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* ELO bar */}
                                                <div style={{ marginTop: 12, display: 'flex', height: 4, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                                                    <div style={{ background: C.cyan, width: `${(h2h[0].elo / (h2h[0].elo + h2h[1].elo)) * 100}%` }} />
                                                    <div style={{ background: C.magenta, flex: 1 }} />
                                                </div>
                                            </>
                                        ) : featuredBattle ? (
                                            <div style={{ padding: '4px 0' }}>
                                                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{featuredBattle.title}</p>
                                                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{featuredBattle._count?.entries ?? 0} entries</p>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Battle list */}
                                    <div style={{ padding: '8px' }}>
                                        {h2h.slice(2, 4).map((p: any, i: number) => (
                                            <Link key={p.userId} to="/arena" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: 10, textDecoration: 'none', marginBottom: 2 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <img src={avatar(p.avatar, p.userId)} alt={p.username} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                                    <div>
                                                        <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0 }}>{p.displayName || p.username}</p>
                                                        <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{p.elo} ELO</p>
                                                    </div>
                                                </div>
                                                <ChevronRight size={12} color={C.muted} />
                                            </Link>
                                        ))}
                                    </div>

                                    <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
                                        <Link to="/arena" style={{ display: 'block', width: '100%', padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 8, textDecoration: 'none' }}>
                                            Start a Battle
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Featured artist section in sidebar */}
                            {featured?.featuredArtist && (
                                <div style={{ margin: '16px 16px 0', padding: 16, background: C.panel, borderRadius: 16, border: `1px solid ${C.border}` }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>Featured Artist</p>
                                    <Link to={`/profile/${featured.featuredArtist.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                                        <img src={avatar(featured.featuredArtist.avatar, featured.featuredArtist.id)} alt={featured.featuredArtist.displayName || featured.featuredArtist.username} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.magenta}` }} />
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{featured.featuredArtist.displayName || featured.featuredArtist.username}</p>
                                            {featured.featuredArtist.primaryGenre && <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{featured.featuredArtist.primaryGenre.name}</p>}
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </aside>
                )}

                {/* ── Right: Main Content ─────────────────────────────────────── */}
                <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '20px 16px' : '32px', display: 'flex', flexDirection: 'column', gap: 40, overflowY: 'auto', paddingBottom: 80 }}>

                    {/* ── CTA banners ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Link to={user ? '/my-tracks' : '/login'} style={{
                            background: C.grad1, borderRadius: 20, padding: isMobile ? '24px 20px' : '28px 32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{ position: 'relative', zIndex: 1, maxWidth: '65%' }}>
                                <h3 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#fff', margin: '0 0 6px', lineHeight: 1.1, textTransform: 'uppercase' }}>UPLOAD YOUR MUSIC</h3>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 18px' }}>Share Your Sound. Get Discovered.</p>
                                <span style={{ background: '#fff', color: '#15161e', fontWeight: 700, fontSize: 12, padding: '8px 22px', borderRadius: 999, display: 'inline-block' }}>UPLOAD NOW</span>
                            </div>
                            <Upload size={72} color="rgba(255,255,255,0.2)" style={{ position: 'absolute', right: -8, bottom: -8, flexShrink: 0 }} />
                        </Link>

                        <a href="https://discord.gg/fujistudio" target="_blank" rel="noopener noreferrer" style={{
                            background: C.grad2, borderRadius: 20, padding: isMobile ? '24px 20px' : '28px 32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{ position: 'relative', zIndex: 1, maxWidth: '65%' }}>
                                <h3 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#fff', margin: '0 0 6px', lineHeight: 1.1, textTransform: 'uppercase' }}>JOIN OUR DISCORD</h3>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 18px' }}>Connect with 50,000+ Producers.</p>
                                <span style={{ background: '#fff', color: '#15161e', fontWeight: 700, fontSize: 12, padding: '8px 22px', borderRadius: 999, display: 'inline-block' }}>JOIN DISCORD</span>
                            </div>
                            <ExternalLink size={72} color="rgba(255,255,255,0.2)" style={{ position: 'absolute', right: -8, bottom: -8, flexShrink: 0 }} />
                        </a>
                    </div>

                    {/* ── Top Trending Sounds ── */}
                    {top3.length > 0 && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                                <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: '#fff', margin: 0, fontStyle: 'italic' }}>
                                    Top <span style={{ color: C.cyan }}>Trending</span> Sounds
                                </h2>
                                <Link to="/charts" style={{ fontSize: 13, color: C.cyan, textDecoration: 'none' }}>View Full Chart →</Link>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gridTemplateRows: 'auto', gap: 16 }}>
                                {/* #1 — large card spanning full height on right side  */}
                                {top3[0] && (() => {
                                    const t = top3[0].track ?? top3[0];
                                    const playing = isPlaying(t);
                                    const coverSrc = img(t.coverUrl);
                                    return (
                                        <div
                                            onClick={() => play(t)}
                                            style={{ gridRow: isMobile ? 'auto' : 'span 2', position: 'relative', borderRadius: 20, overflow: 'hidden', background: C.panel, border: `1px solid ${C.border}`, minHeight: isMobile ? 220 : 340, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                                        >
                                            {coverSrc && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${coverSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.55 }} />}
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #15161e 0%, rgba(21,22,30,0.5) 50%, transparent 100%)' }} />
                                            <div style={{ position: 'absolute', top: 16, left: 20 }}>
                                                <span style={{ fontSize: 72, fontWeight: 900, color: 'transparent', WebkitTextStroke: `2px ${C.cyan}`, textShadow: `0 0 20px rgba(125,207,255,0.4)`, lineHeight: 1 }}>1</span>
                                            </div>
                                            <div style={{ position: 'absolute', top: 16, right: 16 }}>
                                                {playing ? (
                                                    <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '6px 14px', fontSize: 10, fontWeight: 700, color: C.cyan, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <Pause size={10} /> Playing
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div style={{ position: 'relative', zIndex: 1, padding: '0 20px 20px' }}>
                                                <h3 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{t.title}</h3>
                                                <p style={{ fontSize: 14, color: C.text, margin: '0 0 14px' }}>{t.profile?.displayName || t.profile?.username || t.artist || ''}</p>
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    <button onClick={(e) => { e.stopPropagation(); play(t); }} style={{ background: playing ? '#fff' : C.cyan, color: '#15161e', fontWeight: 700, fontSize: 13, padding: '8px 20px', borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {playing ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Play Track</>}
                                                    </button>
                                                    <button style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${C.border}`, color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Heart size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* #2 */}
                                {top3[1] && (() => {
                                    const t = top3[1].track ?? top3[1];
                                    const playing = isPlaying(t);
                                    const coverSrc = img(t.coverUrl);
                                    return (
                                        <div onClick={() => play(t)} style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: C.panel, border: `1px solid ${C.border}`, aspectRatio: '16/9', cursor: 'pointer' }}>
                                            {coverSrc && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${coverSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.45 }} />}
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #15161e 0%, transparent 60%)' }} />
                                            <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                                <span style={{ fontSize: 52, fontWeight: 900, color: 'transparent', WebkitTextStroke: `2px ${C.magenta}`, lineHeight: 1 }}>2</span>
                                            </div>
                                            <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}>
                                                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</h4>
                                                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{t.profile?.displayName || t.profile?.username || ''}</p>
                                            </div>
                                            {playing && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}><Pause size={40} color="#fff" /></div>}
                                        </div>
                                    );
                                })()}

                                {/* #3 */}
                                {top3[2] && (() => {
                                    const t = top3[2].track ?? top3[2];
                                    const playing = isPlaying(t);
                                    const coverSrc = img(t.coverUrl);
                                    return (
                                        <div onClick={() => play(t)} style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: C.panel, border: `1px solid ${C.border}`, aspectRatio: '16/9', cursor: 'pointer' }}>
                                            {coverSrc && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${coverSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.45 }} />}
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #15161e 0%, transparent 60%)' }} />
                                            <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                                <span style={{ fontSize: 52, fontWeight: 900, color: 'transparent', WebkitTextStroke: `2px ${C.indigo}`, lineHeight: 1 }}>3</span>
                                            </div>
                                            <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}>
                                                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</h4>
                                                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{t.profile?.displayName || t.profile?.username || ''}</p>
                                            </div>
                                            {playing && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}><Pause size={40} color="#fff" /></div>}
                                        </div>
                                    );
                                })()}
                            </div>
                        </section>
                    )}

                    {/* ── Discover New Artists ── */}
                    {topArtists.length > 0 && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#fff', margin: 0, fontStyle: 'italic' }}>
                                Discover <span style={{ color: C.magenta }}>New</span> Artists
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 16 }}>
                                {topArtists.map((artist: any, i: number) => (
                                    <Link
                                        key={artist.userId}
                                        to={`/profile/${artist.username}`}
                                        style={{ background: C.panel, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'border-color 0.2s' }}
                                    >
                                        <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: `2px solid transparent`, backgroundClip: 'padding-box' }}>
                                            <img src={avatar(artist.avatar, artist.userId)} alt={artist.displayName || artist.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{artist.displayName || artist.username}</p>
                                            <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{artist.totalPlays?.toLocaleString() ?? '—'} plays</p>
                                        </div>
                                    </Link>
                                ))}
                                {/* View all */}
                                <Link to="/artists" style={{ background: C.panel, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Plus size={24} color={C.muted} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>View All</p>
                                        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>Artists</p>
                                    </div>
                                </Link>
                            </div>
                        </section>
                    )}

                    {/* ── Mini footer ── */}
                    <footer style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: C.muted }}>
                            <Link to="/features" style={{ color: C.muted, textDecoration: 'none' }}>Features</Link>
                            <Link to="/terms" style={{ color: C.muted, textDecoration: 'none' }}>Terms & Privacy</Link>
                        </div>
                        <span style={{ fontSize: 12, color: C.muted }}>© 2026 Fuji Studio</span>
                    </footer>
                </main>
            </div>
        </DiscoveryLayout>
    );
};
