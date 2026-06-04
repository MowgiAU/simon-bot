/**
 * Test Frontpage – Editorial Variant B  (Stitch "news focus" layout)
 * Hidden route: /preview/editorial-b
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
    Play, Pause, Upload, Upload as UploadIcon,
    ExternalLink, ChevronLeft, ChevronRight,
    Heart, Swords, Music, Crown, Newspaper,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// Fuji-Studio–flavoured editorial colour palette (matches Stitch design)
const ED = {
    bg:       '#0F111A',
    card:     '#1A1D28',
    cardAlt:  'rgba(31,32,41,0.7)',
    border:   'rgba(255,255,255,0.06)',
    cyan:     '#00F0FF',
    purple:   '#8B5CF6',
    pink:     '#EC4899',
    text:     '#E2E8F0',
    muted:    '#94A3B8',
    green:    '#10B981',
};

const numberGlowColors = [ED.cyan, ED.purple, ED.green, '#3B82F6', '#F59E0B'];

// ── tiny helpers ─────────────────────────────────────────────────────────────

function getAvatarUrl(avatar: string | null, userId: string): string {
    if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (avatar.startsWith('http') || avatar.startsWith('/uploads/')) return avatar;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=256`;
}

function TrackCover({ src, alt, size = 48 }: { src: string | null; alt: string; size?: number }) {
    const fallback = 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="#2a2c38"><rect width="${size}" height="${size}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${size * 0.4}" fill="#555">♫</text></svg>`
    );
    return (
        <img
            src={src ? (src.startsWith('http') || src.startsWith('/uploads/') ? src : `${API}${src}`) : fallback}
            alt={alt}
            style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
            onError={e => { (e.currentTarget as HTMLImageElement).src = fallback; }}
        />
    );
}

// ── main page ─────────────────────────────────────────────────────────────────

export const FrontpageEditorialB: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const { user } = useAuth();
    const [isMobile] = useState(window.innerWidth < 768);

    const { data } = useQuery({
        queryKey: ['frontpage-editorial-b'],
        queryFn: async () => {
            const [profilesRes, tracksRes, chartRes, featuredRes, articleRes, h2hRes] = await Promise.all([
                axios.get('/api/musician/profiles'),
                axios.get('/api/musician/leaderboards/tracks', { params: { limit: 12 } }),
                axios.get('/api/charts/weekly', { params: { limit: 10 } }),
                axios.get('/api/discovery/settings').catch(() => ({ data: null })),
                axios.get('/api/articles/featured/current').catch(() => ({ data: null })),
                axios.get('/api/head-to-head/leaderboard?limit=3').catch(() => ({ data: [] })),
            ]);
            return {
                artists: profilesRes.data,
                topTracks: tracksRes.data,
                weeklyChart: chartRes.data?.entries || [],
                featured: featuredRes.data,
                featuredArticle: articleRes.data,
                h2hLeaderboard: Array.isArray(h2hRes.data) ? h2hRes.data : [],
            };
        },
        staleTime: 1000 * 60 * 2,
    });

    const weeklyChart = data?.weeklyChart ?? [];
    const topTracks   = data?.topTracks   ?? [];
    const featured    = data?.featured    ?? null;
    const artists     = data?.artists     ?? [];
    const article     = data?.featuredArticle ?? null;
    const h2h         = data?.h2hLeaderboard ?? [];
    const featuredBattle = featured?.featuredBattle ?? null;

    const featuredArtist = featured?.featuredArtist ?? (artists.length > 0 ? artists[0] : null);
    const featuredTrack  = featured?.featuredTrack ?? topTracks[0] ?? null;

    function playTrack(t: any) {
        const url = t?.url || t?.track?.url;
        const id  = t?.id  || t?.track?.id;
        if (!url) return;
        if (player.currentTrack?.id === id) { togglePlay(); return; }
        setTrack({
            id,
            title: t?.title || t?.track?.title || 'Unknown',
            artist: t?.artist || t?.track?.artist || t?.profile?.displayName || t?.track?.profile?.displayName || 'Unknown',
            username: t?.profile?.username || t?.track?.profile?.username || '',
            url,
            cover: t?.coverUrl || t?.track?.coverUrl || null,
        });
    }

    // ── layout ────────────────────────────────────────────────────────────────

    return (
        <DiscoveryLayout activeTab="home">
            {/* ── dev badge ── */}
            <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: ED.purple, color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.1em', pointerEvents: 'none' }}>
                ALT_B — TEST
            </div>

            <div style={{ background: ED.bg, color: ED.text, fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>

                {/* ══ 1. HERO — ACTIVE BATTLES / H2H ════════════════════════════ */}
                <section style={{ background: 'radial-gradient(circle at center, rgba(139,92,246,0.12) 0%, rgba(15,17,26,1) 70%)', padding: isMobile ? '32px 16px' : '56px 24px 40px' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: ED.muted, textTransform: 'uppercase', marginBottom: 12 }}>
                            {featuredBattle ? 'Featured Battle' : h2h.length > 0 ? 'Active 1v1 Battles' : 'Beat Battles'}
                        </p>

                        {/* Featured beat battle hero */}
                        {featuredBattle ? (
                            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', maxWidth: 800, margin: '0 auto', boxShadow: `0 20px 60px rgba(139,92,246,0.25)` }}>
                                {featuredBattle.bannerUrl && (
                                    <img src={`${API}${featuredBattle.bannerUrl}`} alt="" style={{ width: '100%', height: isMobile ? 200 : 320, objectFit: 'cover', display: 'block' }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,13,24,0.97) 0%, rgba(10,13,24,0.5) 50%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '20px 20px' : '32px 40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: ED.purple, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                                            {featuredBattle.status === 'voting' ? '🗳 Voting Live' : featuredBattle.status === 'active' ? '🔴 Submissions Open' : featuredBattle.status === 'completed' ? '🏆 Ended' : 'Upcoming'}
                                        </div>
                                        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{featuredBattle.title}</h2>
                                        {featuredBattle._count && <p style={{ fontSize: 13, color: ED.muted, marginTop: 6 }}>{featuredBattle._count.entries} entries</p>}
                                    </div>
                                    <Link to={`/battles/${featuredBattle.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: ED.purple, color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: `0 8px 24px rgba(139,92,246,0.5)`, whiteSpace: 'nowrap' }}>
                                        <Swords size={14} /> {featuredBattle.status === 'voting' ? 'Vote Now' : 'View Battle'}
                                    </Link>
                                </div>
                            </div>
                        ) : h2h.length > 0 ? (
                            /* H2H battle preview */
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 32, flexWrap: 'wrap' }}>
                                {h2h.slice(0, 1).map((champion: any) => (
                                    <div key={champion.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                        <img src={getAvatarUrl(champion.avatar, champion.userId)} alt={champion.username} style={{ width: isMobile ? 100 : 160, height: isMobile ? 100 : 160, borderRadius: 16, objectFit: 'cover', border: `2px solid ${ED.purple}`, boxShadow: `0 0 30px rgba(139,92,246,0.3)` }} />
                                        <div>
                                            <h3 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: '#fff', margin: 0 }}>{champion.displayName || champion.username}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <Crown size={14} color="#FFD700" />
                                                <span style={{ fontSize: 12, color: ED.muted, fontWeight: 600 }}>{champion.elo} ELO</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ fontSize: isMobile ? 28 : 48, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>VS</div>
                                {h2h.slice(1, 2).map((challenger: any) => (
                                    <div key={challenger.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                        <img src={getAvatarUrl(challenger.avatar, challenger.userId)} alt={challenger.username} style={{ width: isMobile ? 100 : 160, height: isMobile ? 100 : 160, borderRadius: 16, objectFit: 'cover', border: `2px solid ${ED.cyan}`, boxShadow: `0 0 30px rgba(0,240,255,0.25)` }} />
                                        <div>
                                            <h3 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: '#fff', margin: 0 }}>{challenger.displayName || challenger.username}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <Crown size={14} color={ED.muted} />
                                                <span style={{ fontSize: 12, color: ED.muted, fontWeight: 600 }}>{challenger.elo} ELO</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '40px 0', color: ED.muted }}>
                                <Swords size={40} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                                <p style={{ margin: 0 }}>No active battles right now.</p>
                            </div>
                        )}

                        {/* H2H nav dots */}
                        {!featuredBattle && h2h.length > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
                                {[0, 1, 2].slice(0, Math.min(h2h.length, 3)).map(i => (
                                    <div key={i} style={{ width: i === 0 ? 24 : 8, height: 4, borderRadius: 2, background: i === 0 ? '#fff' : 'rgba(255,255,255,0.25)' }} />
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* ══ 2. CALL TO ACTIONS ══════════════════════════════════════ */}
                <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                        {/* Upload card */}
                        <Link to={user ? '/my-tracks' : '/login'} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'linear-gradient(135deg, #00F0FF 0%, #8B5CF6 100%)',
                            borderRadius: 20, padding: isMobile ? '24px 20px' : '32px', textDecoration: 'none',
                            transition: 'transform 0.2s', cursor: 'pointer',
                        }}>
                            <div>
                                <h3 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.1, textTransform: 'uppercase' }}>
                                    UPLOAD<br />YOUR MUSIC
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 20px' }}>Share Your Sound. Get Discovered.</p>
                                <span style={{ display: 'inline-block', background: '#fff', color: '#0F111A', padding: '9px 22px', borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
                                    UPLOAD NOW
                                </span>
                            </div>
                            <UploadIcon size={isMobile ? 48 : 80} color="rgba(255,255,255,0.3)" />
                        </Link>

                        {/* Discord card */}
                        {featured?.featuredBattle?.discordInviteUrl || true ? (
                            <a href="https://discord.gg/fujistudio" target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                                borderRadius: 20, padding: isMobile ? '24px 20px' : '32px', textDecoration: 'none',
                                transition: 'transform 0.2s', cursor: 'pointer',
                            }}>
                                <div>
                                    <h3 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.1, textTransform: 'uppercase' }}>
                                        JOIN OUR<br />DISCORD
                                    </h3>
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 20px' }}>Connect with 50,000+ Producers.</p>
                                    <span style={{ display: 'inline-block', background: '#fff', color: '#0F111A', padding: '9px 22px', borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
                                        JOIN DISCORD
                                    </span>
                                </div>
                                <ExternalLink size={isMobile ? 48 : 80} color="rgba(255,255,255,0.3)" />
                            </a>
                        ) : null}
                    </div>
                </section>

                {/* ══ 3. EDITORIAL GRID — Highlights & News ══════════════════ */}
                <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '8px 16px 32px' : '8px 24px 48px' }}>
                    <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 800, color: '#fff', margin: '0 0 28px', fontStyle: 'italic' }}>
                        Community <span style={{ color: ED.muted, fontStyle: 'italic' }}>Highlights</span> & News
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr 260px', gap: 24 }}>

                        {/* ── Left: Trending Tracks ── */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${ED.border}`, borderRadius: 16, padding: 20 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: ED.cyan, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>Trending Tracks</p>

                            {/* Featured large track */}
                            {featuredTrack && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                                        <img
                                            src={featuredTrack.coverUrl ? (featuredTrack.coverUrl.startsWith('http') ? featuredTrack.coverUrl : `${API}${featuredTrack.coverUrl}`) : ''}
                                            alt={featuredTrack.title}
                                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                                        />
                                        <button
                                            onClick={() => playTrack(featuredTrack)}
                                            style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: ED.cyan, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                            {player.currentTrack?.id === featuredTrack.id && player.isPlaying
                                                ? <Pause size={14} fill="#0F111A" color="#0F111A" />
                                                : <Play size={14} fill="#0F111A" color="#0F111A" style={{ marginLeft: 2 }} />
                                            }
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{featuredTrack.title}</h4>
                                            <p style={{ fontSize: 12, color: ED.muted, margin: '2px 0 0' }}>{featuredTrack.profile?.displayName || featuredTrack.profile?.username}</p>
                                        </div>
                                        <Heart size={16} color={ED.pink} fill={ED.pink} style={{ flexShrink: 0, marginTop: 2 }} />
                                    </div>
                                </div>
                            )}

                            {/* List of top tracks */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${ED.border}`, paddingTop: 12 }}>
                                {topTracks.slice(0, 4).map((t: any) => (
                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => playTrack(t)}>
                                        <TrackCover src={t.coverUrl} alt={t.title} size={44} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                                            <p style={{ fontSize: 11, color: ED.muted, margin: '1px 0 0' }}>{t.profile?.displayName || t.profile?.username}</p>
                                        </div>
                                        {player.currentTrack?.id === t.id && player.isPlaying
                                            ? <Pause size={16} color={ED.cyan} />
                                            : <Play size={16} color={ED.muted} />
                                        }
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Centre: Editorial ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Hero editorial image (featured article or article thumbnail) */}
                            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', cursor: 'pointer' }}>
                                <div style={{ width: '100%', height: isMobile ? 220 : 360, background: `linear-gradient(135deg, ${ED.purple}33, ${ED.card})` }}>
                                    {article?.thumbnailUrl && (
                                        <img src={article.thumbnailUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    )}
                                    {!article?.thumbnailUrl && featuredArtist && (
                                        <img src={getAvatarUrl(featuredArtist.avatar, featuredArtist.userId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.6)' }} />
                                    )}
                                </div>
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,13,24,0.97) 0%, rgba(10,13,24,0.2) 55%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '20px 20px' : '28px 32px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: ED.purple, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px' }}>Community Highlights</p>
                                    <h4 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                                        {article?.title || 'Fuji Studio Community'}
                                    </h4>
                                </div>
                            </div>

                            {/* Two-col cards below */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* Featured Artist */}
                                {featuredArtist && (
                                    <Link to={`/profile/${featuredArtist.username}`} style={{ background: ED.card, border: `1px solid ${ED.border}`, borderRadius: 16, padding: 20, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.2s' }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, color: ED.muted, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Featured Artist</p>
                                        <img src={getAvatarUrl(featuredArtist.avatar, featuredArtist.userId)} alt={featuredArtist.displayName || featuredArtist.username} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                            <div>
                                                <h4 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{featuredArtist.displayName || featuredArtist.username}</h4>
                                                {featuredArtist.primaryGenre && <p style={{ fontSize: 12, color: ED.muted, margin: '3px 0 0' }}>{featuredArtist.primaryGenre.name}</p>}
                                            </div>
                                            <Music size={18} color={ED.cyan} />
                                        </div>
                                    </Link>
                                )}

                                {/* News Highlights / article */}
                                <div style={{ background: ED.card, border: `1px solid ${ED.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: ED.muted, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>News Highlights</p>
                                    {article ? (
                                        <>
                                            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', background: '#111' }}>
                                                {article.thumbnailUrl && <img src={article.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />}
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: `1px solid ${ED.cyan}88`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Newspaper size={20} color={ED.cyan} />
                                                    </div>
                                                </div>
                                            </div>
                                            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.4 }}>{article.title}</h4>
                                            {article.viewCount !== undefined && <p style={{ fontSize: 11, color: ED.cyan, fontWeight: 700, margin: 0 }}>{article.viewCount} VIEWS</p>}
                                        </>
                                    ) : (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                            <Newspaper size={40} color={ED.muted} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Right: Latest News ── */}
                        <div style={{ background: 'rgba(26,29,40,0.5)', border: `1px solid ${ED.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: ED.muted, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 20px' }}>Latest News</p>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {/* Placeholder news items — would come from articles API */}
                                {[
                                    { label: 'Community', title: article?.title || 'Fuji Studio Launch Party Recap', time: 'Latest' },
                                    { label: 'Battles', title: featuredBattle ? `${featuredBattle.title} — Now Live` : 'New Battle Coming Soon', time: 'Today' },
                                    { label: 'Artists', title: featuredArtist ? `Spotlight: ${featuredArtist.displayName || featuredArtist.username}` : 'Artist Spotlight', time: 'This Week' },
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '16px 0', borderBottom: i < 2 ? `1px solid ${ED.border}` : 'none' }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, color: ED.purple, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>{item.time}</p>
                                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 4px', lineHeight: 1.4, cursor: 'pointer' }}>{item.title}</h4>
                                        <p style={{ fontSize: 11, color: '#4B5563', margin: 0 }}>{item.label}</p>
                                    </div>
                                ))}
                            </div>
                            <Link to="/battles" style={{ display: 'block', width: '100%', padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ED.muted, border: `1px solid ${ED.border}`, borderRadius: 8, marginTop: 16, textDecoration: 'none', letterSpacing: '0.06em' }}>
                                VIEW ALL NEWS
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ══ 4. TRENDING SOUNDS — numbered chart grid ══════════════ */}
                {weeklyChart.length > 0 && (
                    <section style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '8px 16px 48px' : '8px 24px 64px' }}>
                        <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 800, color: '#fff', margin: '0 0 24px', fontStyle: 'italic' }}>
                            Trending <span style={{ color: ED.muted }}>Sounds</span> &amp; Charts
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 16 }}>
                            {weeklyChart.slice(0, 10).map((entry: any, i: number) => {
                                const track = entry.track || entry;
                                const glowColor = numberGlowColors[i % numberGlowColors.length];
                                const isPlaying = player.currentTrack?.id === (track.id || track.track?.id) && player.isPlaying;
                                return (
                                    <div
                                        key={track.id || i}
                                        onClick={() => playTrack(track)}
                                        style={{ cursor: 'pointer', position: 'relative' }}
                                    >
                                        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1', marginBottom: 8 }}>
                                            <TrackCover src={track.coverUrl} alt={track.title || ''} size={200} />
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)' }} />
                                            {/* Large number */}
                                            <span style={{
                                                position: 'absolute', bottom: 4, right: 8,
                                                fontSize: 64, fontWeight: 900, lineHeight: 1,
                                                color: 'transparent',
                                                WebkitTextStroke: `2px ${glowColor}`,
                                                textShadow: `0 0 20px ${glowColor}88`,
                                            }}>
                                                {i + 1}
                                            </span>
                                            {/* Hover play */}
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0, transition: 'opacity 0.2s' }} className="track-hover-play">
                                                {isPlaying && (
                                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Pause size={18} color="#fff" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {track.title}
                                        </h4>
                                        <p style={{ fontSize: 11, color: ED.muted, margin: 0 }}>
                                            {track.profile?.displayName || track.profile?.username || track.artist || 'Unknown'}
                                        </p>
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
