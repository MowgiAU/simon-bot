/**
 * Test Frontpage – Alt_D  (editorial alt_b structure × current frontpage data & components)
 * Hidden route: /preview/alt_d
 * Not linked from any nav — access by URL only.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { StyledUsername } from '../components/StyledUsername';
import {
    Play, Pause, Upload, ExternalLink, Heart,
    Swords, Music, Crown, Newspaper, Trophy,
    Timer, Users, ArrowUp, ArrowDown, Minus,
    Flame, Sparkles,
} from 'lucide-react';
import { colors } from '../theme/theme';

const API = import.meta.env.VITE_API_URL || '';
const ACCENT = colors.primary;   // site green

// ── helpers ──────────────────────────────────────────────────────────────────

function avatarUrl(av: string | null, userId: string): string {
    if (!av) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (av.startsWith('http') || av.startsWith('/uploads/')) return av;
    return `https://cdn.discordapp.com/avatars/${userId}/${av}.png?size=256`;
}

function coverSrc(url: string | null): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('/uploads/')) return url;
    return `${API}${url}`;
}

function SmallTrackRow({ track, rank, playing, onPlay }: {
    track: any; rank: number; playing: boolean; onPlay: () => void;
}) {
    const t = track?.track ?? track;
    return (
        <div onClick={onPlay} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: playing ? ACCENT : 'rgba(255,255,255,0.25)', width: 18, textAlign: 'center', flexShrink: 0 }}>{rank}</span>
            <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}>
                {coverSrc(t?.coverUrl) && <img src={coverSrc(t?.coverUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: playing ? ACCENT : '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.title}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.profile?.displayName || t?.profile?.username || t?.artist}</p>
            </div>
            {playing ? <Pause size={13} color={ACCENT} /> : <Play size={13} color="rgba(255,255,255,0.3)" />}
        </div>
    );
}

const CHART_COLORS = [ACCENT, '#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', ACCENT, '#8B5CF6', '#10B981', '#3B82F6', '#F59E0B'];

// ── page ─────────────────────────────────────────────────────────────────────

export const FrontpageEditorialMix: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const { user } = useAuth();
    const [isMobile] = useState(window.innerWidth < 1024);

    // Exact same query as the real frontpage
    const { data: discoveryData } = useQuery({
        queryKey: ['discovery-home'],
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
                artists:      ([...profilesRes.data]).sort((a: any, b: any) => (b.totalPlays || 0) - (a.totalPlays || 0)),
                topTracks:    tracksRes.data,
                weeklyChart:  (chartRes.data?.entries || []),
                featured:     featuredRes.data,
                article:      articleRes.data,
                h2h:          Array.isArray(h2hRes.data) ? h2hRes.data : [],
                globalSponsors: featuredRes.data?.globalSponsors ?? [],
            };
        },
        staleTime: 1000 * 60 * 2,
    });

    const artists     = discoveryData?.artists     ?? [];
    const topTracks   = discoveryData?.topTracks   ?? [];
    const weeklyChart = discoveryData?.weeklyChart ?? [];
    const featured    = discoveryData?.featured    ?? null;
    const article     = discoveryData?.article     ?? null;
    const sponsors    = discoveryData?.globalSponsors ?? [];
    const battle      = featured?.featuredBattle   ?? null;
    const featArtist  = featured?.featuredArtist   ?? null;
    const featTrack   = featured?.featuredTrack    ?? topTracks[0] ?? null;

    function play(t: any) {
        const track = t?.track ?? t;
        const id = track?.id;
        const url = track?.url;
        if (!url) return;
        if (player.currentTrack?.id === id) { togglePlay(); return; }
        const p = track?.profile;
        setTrack({ id, title: track?.title ?? 'Unknown', artist: track?.artist ?? p?.displayName ?? p?.username ?? 'Unknown', username: p?.username ?? '', url, cover: coverSrc(track?.coverUrl ?? null) });
    }

    function isPlaying(t: any) {
        const id = (t?.track ?? t)?.id;
        return player.currentTrack?.id === id && player.isPlaying;
    }

    const battleVotingOver = battle && (battle.status === 'completed' || (battle.votingEnd && new Date(battle.votingEnd) < new Date()));

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <DiscoveryLayout activeTab="home">
            {/* dev badge */}
            <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: ACCENT, color: '#0b0e11', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.1em', pointerEvents: 'none' }}>
                ALT_D — TEST
            </div>

            <div style={{ background: '#0b0e11', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>

                {/* ══ 1. FEATURED BATTLE HERO (current frontpage quality) ══ */}
                <section style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '20px 16px 0' : '32px 24px 0' }}>
                    {battle ? (
                        <div style={{
                            position: 'relative', borderRadius: 20, overflow: 'hidden',
                            backgroundColor: '#1a2030', minHeight: isMobile ? 220 : 320,
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            border: '1px solid rgba(255,255,255,0.06)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                            ...(battle.bannerUrl ? { backgroundImage: `url(${API}${battle.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center top' } : {}),
                        }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,14,17,0.97) 0%, rgba(11,14,17,0.7) 50%, rgba(11,14,17,0.3) 100%)' }} />
                            <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '20px 20px' : '32px 40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    {/* Status */}
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: battleVotingOver ? '#FFD700' : battle.status === 'voting' ? '#FBBF24' : ACCENT, marginBottom: 10 }}>
                                        {battleVotingOver ? <Trophy size={12} /> : <Flame size={12} />}
                                        {battleVotingOver ? 'Ended' : battle.status === 'voting' ? 'Voting Live' : battle.status === 'active' ? 'Submissions Open' : 'Upcoming'}
                                    </div>
                                    <h2 style={{ fontSize: isMobile ? 24 : 40, fontWeight: 900, color: '#fff', margin: '0 0 8px', lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{battle.title}</h2>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {battle._count?.entries ?? 0} entries</span>
                                        {battle.prizes?.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> {battle.prizes.length} prizes</span>}
                                        {battle.sponsor && <span>Sponsored by <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{battle.sponsor.name}</strong></span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {battle.status === 'voting' && (
                                        <Link to={`/battles/${battle.slug || battle.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: '#FBBF24', color: '#1a1a1a', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                                            <Trophy size={14} /> Vote Now
                                        </Link>
                                    )}
                                    {battle.status === 'active' && !user && (
                                        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: ACCENT, color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                                            <Swords size={14} /> Submit a Beat
                                        </Link>
                                    )}
                                    <Link to={`/battles/${battle.slug || battle.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: 'rgba(96,165,250,0.15)', color: '#60A5FA', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(96,165,250,0.25)' }}>
                                        <Swords size={14} /> {battleVotingOver ? 'View Results' : 'View Battle'}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                            No featured battle
                        </div>
                    )}
                </section>

                {/* ══ 2. CTA CARDS (alt_b gradient style) ══════════════════ */}
                <section style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '16px' : '24px 24px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Link to={user ? '/my-tracks' : '/login'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #00F0FF 0%, #8B5CF6 100%)', borderRadius: 18, padding: isMobile ? '24px 20px' : '28px 32px', textDecoration: 'none', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ maxWidth: '60%' }}>
                                <h3 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.1, textTransform: 'uppercase' }}>Upload Your Music</h3>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 16px' }}>Share Your Sound. Get Discovered.</p>
                                <span style={{ background: '#fff', color: '#0b0e11', fontWeight: 700, fontSize: 12, padding: '8px 20px', borderRadius: 999, display: 'inline-block' }}>Upload Now</span>
                            </div>
                            <Upload size={80} color="rgba(255,255,255,0.2)" style={{ position: 'absolute', right: -8, bottom: -8, flexShrink: 0 }} />
                        </Link>
                        <a href="https://discord.gg/fujistudio" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', borderRadius: 18, padding: isMobile ? '24px 20px' : '28px 32px', textDecoration: 'none', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ maxWidth: '60%' }}>
                                <h3 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.1, textTransform: 'uppercase' }}>Join Our Discord</h3>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 16px' }}>Connect with 50,000+ Producers.</p>
                                <span style={{ background: '#fff', color: '#0b0e11', fontWeight: 700, fontSize: 12, padding: '8px 20px', borderRadius: 999, display: 'inline-block' }}>Join Discord</span>
                            </div>
                            <ExternalLink size={80} color="rgba(255,255,255,0.2)" style={{ position: 'absolute', right: -8, bottom: -8, flexShrink: 0 }} />
                        </a>
                    </div>
                </section>

                {/* ══ 3. EDITORIAL GRID — alt_b structure, current frontpage data ══ */}
                <section style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '28px 16px' : '40px 24px' }}>
                    {/* Serif editorial heading */}
                    <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 800, color: '#fff', margin: '0 0 24px', lineHeight: 1.2 }}>
                        Community <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>Highlights</span> &amp; News
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr 240px', gap: 20 }}>

                        {/* ── Left: Trending Tracks (current frontpage data) ── */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 14px' }}>Trending Tracks</p>
                            {/* Featured large cover */}
                            {featTrack && (
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', marginBottom: 10, cursor: 'pointer' }} onClick={() => play(featTrack)}>
                                        {coverSrc(featTrack.coverUrl) && <img src={coverSrc(featTrack.coverUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: isPlaying(featTrack) ? ACCENT : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {isPlaying(featTrack) ? <Pause size={14} color="#fff" /> : <Play size={14} color="#fff" style={{ marginLeft: 2 }} />}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{featTrack.title}</p>
                                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>{featTrack.profile?.displayName || featTrack.profile?.username}</p>
                                        </div>
                                        <Heart size={14} color="#ec4899" fill="#ec4899" />
                                    </div>
                                </div>
                            )}
                            {/* List */}
                            {topTracks.slice(0, 5).map((t: any, i: number) => (
                                <SmallTrackRow key={t.id} track={t} rank={i + 1} playing={isPlaying(t)} onPlay={() => play(t)} />
                            ))}
                        </div>

                        {/* ── Centre: Editorial content ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Hero editorial image */}
                            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', minHeight: isMobile ? 200 : 280, background: '#1a1d28', cursor: 'pointer' }}>
                                {(article?.thumbnailUrl || (featArtist && avatarUrl(featArtist.avatar, featArtist.id))) && (
                                    <img src={article?.thumbnailUrl || avatarUrl(featArtist!.avatar, featArtist!.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, opacity: 0.5 }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,14,17,0.97) 0%, rgba(11,14,17,0.3) 60%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '18px 18px' : '24px 28px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 6px' }}>Community Highlights</p>
                                    <h4 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                                        {article?.title || 'Fuji Studio Community'}
                                    </h4>
                                </div>
                            </div>

                            {/* Two cards below */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* Featured Artist */}
                                {featArtist && (
                                    <Link to={`/profile/${featArtist.username}`} style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Featured Artist</p>
                                        <img src={avatarUrl(featArtist.avatar, featArtist.id)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />
                                        <div>
                                            <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0 }}>{featArtist.displayName || featArtist.username}</p>
                                            {featArtist.primaryGenre && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>{featArtist.primaryGenre.name}</p>}
                                        </div>
                                    </Link>
                                )}

                                {/* Article / News highlight */}
                                <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>News Highlights</p>
                                    <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                        {article?.thumbnailUrl && <img src={article.thumbnailUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />}
                                        <Newspaper size={28} color="rgba(255,255,255,0.2)" style={{ position: 'relative' }} />
                                    </div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.4 }}>{article?.title || 'Latest from Fuji Studio'}</p>
                                    {article?.viewCount !== undefined && <p style={{ fontSize: 11, color: ACCENT, fontWeight: 700, margin: 0 }}>{article.viewCount} views</p>}
                                </div>
                            </div>
                        </div>

                        {/* ── Right: Latest News ── */}
                        <div style={{ background: 'rgba(22,27,34,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>Latest News</p>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {[
                                    { label: 'Battle', title: battle ? `${battle.title} ${battleVotingOver ? '— Ended' : '— Now Live'}` : 'Beat Battles', time: 'Now', to: battle ? `/battles/${battle.slug || battle.id}` : '/battles' },
                                    { label: 'Community', title: article?.title || 'Fuji Studio News', time: 'Latest', to: '/articles' },
                                    { label: 'Artists', title: featArtist ? `Spotlight: ${featArtist.displayName || featArtist.username}` : 'Artist Spotlight', time: 'This Week', to: featArtist ? `/profile/${featArtist.username}` : '/artists' },
                                ].map((item, i) => (
                                    <Link key={i} to={item.to} style={{ padding: '14px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', textDecoration: 'none', display: 'block' }}>
                                        <p style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 5px' }}>{item.time}</p>
                                        <h5 style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 3px', lineHeight: 1.4 }}>{item.title}</h5>
                                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{item.label}</p>
                                    </Link>
                                ))}
                            </div>
                            <Link to="/battles" style={{ display: 'block', padding: '9px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginTop: 14, textDecoration: 'none', letterSpacing: '0.06em' }}>
                                VIEW ALL →
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ══ 4. TOP 10 CHART — alt_b numbered grid, current frontpage data ══ */}
                {weeklyChart.length > 0 && (
                    <section style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '8px 16px 32px' : '8px 24px 48px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h2 style={{ fontSize: isMobile ? 24 : 34, fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                                Top 10 <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>This Week</span>
                            </h2>
                            <Link to="/charts" style={{ fontSize: 13, color: ACCENT, textDecoration: 'none' }}>Full Chart →</Link>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 14 }}>
                            {weeklyChart.slice(0, 10).map((entry: any, i: number) => {
                                const track = entry.track ?? entry;
                                const glowColor = CHART_COLORS[i % CHART_COLORS.length];
                                const playing = isPlaying(track);
                                const change = entry.positionChange;
                                return (
                                    <div key={track.id ?? i} onClick={() => play(track)} style={{ cursor: 'pointer', position: 'relative' }}>
                                        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1', marginBottom: 7 }}>
                                            <div style={{ width: '100%', height: '100%', background: '#1a1d28' }}>
                                                {coverSrc(track.coverUrl) && <img src={coverSrc(track.coverUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                            </div>
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
                                            {/* Large number */}
                                            <span style={{ position: 'absolute', bottom: 2, right: 6, fontSize: 56, fontWeight: 900, lineHeight: 1, color: 'transparent', WebkitTextStroke: `2px ${glowColor}`, textShadow: `0 0 16px ${glowColor}66` }}>
                                                {i + 1}
                                            </span>
                                            {/* Position change badge */}
                                            {change !== null && change !== undefined && (
                                                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, color: change > 0 ? '#34D399' : change < 0 ? '#F87171' : 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: '2px 6px' }}>
                                                    {change > 0 ? <ArrowUp size={9} /> : change < 0 ? <ArrowDown size={9} /> : <Minus size={9} />}
                                                    {Math.abs(change) || '—'}
                                                </div>
                                            )}
                                            {playing && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                                                    <Pause size={24} color="#fff" />
                                                </div>
                                            )}
                                        </div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: playing ? ACCENT : '#fff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</p>
                                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {track.profile?.displayName || track.profile?.username || track.artist || ''}
                                        </p>
                                        {entry.playsInPeriod !== undefined && (
                                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '2px 0 0' }}>{entry.playsInPeriod.toLocaleString()} plays</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ══ 5. DISCOVER ARTISTS (current frontpage avatar grid) ══ */}
                {artists.length > 0 && (
                    <section style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 16px 40px' : '0 24px 56px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#fff', margin: 0, fontStyle: 'italic' }}>
                                Discover <span style={{ color: 'rgba(255,255,255,0.4)' }}>Artists</span>
                            </h2>
                            <Link to="/artists" style={{ fontSize: 13, color: ACCENT, textDecoration: 'none' }}>See All →</Link>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(8, 1fr)', gap: 14 }}>
                            {artists.slice(0, isMobile ? 8 : 8).map((a: any) => (
                                <Link key={a.userId} to={`/profile/${a.username}`} style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: isMobile ? 60 : 72, height: isMobile ? 60 : 72, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.08)' }}>
                                        <img src={avatarUrl(a.avatar, a.userId)} alt={a.displayName || a.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>{a.displayName || a.username}</p>
                                        {a.primaryGenre && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{a.primaryGenre.name}</p>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* ══ 6. SPONSORS (current frontpage) ══ */}
                {sponsors.length > 0 && (
                    <section style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 16px 40px' : '0 24px 56px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '20px 28px' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 16px' }}>Official Partners</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                                {sponsors.map((s: any) => (
                                    <a key={s.id} href={s.websiteUrl ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 16, fontWeight: 700 }}>
                                        {s.logoUrl ? <img src={s.logoUrl} alt={s.name} style={{ height: 24, objectFit: 'contain', filter: 'grayscale(1) brightness(0.7)' }} /> : s.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </DiscoveryLayout>
    );
};
