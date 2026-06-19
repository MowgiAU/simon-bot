/**
 * Alt F — Home (/preview/alt_f)
 * Mirrors the Battles hub layout: carousel hero, top artists (wall of fame),
 * top tracks (community stats), latest news (upcoming arenas), charts (battle history).
 */
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Users, Music, TrendingUp, Play, Pause, ChevronLeft, ChevronRight, ChevronRight as Arrow,
    Newspaper, BarChart3, User, Swords, ListMusic, Flame, Star,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDate = (s?: string) => { if (!s) return ''; return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };

function useWaveform(n = 12) {
    const [heights, setHeights] = useState(() => Array.from({ length: n }, () => 30 + Math.random() * 70));
    useEffect(() => {
        const id = setInterval(() => setHeights(Array.from({ length: n }, () => 30 + Math.random() * 70)), 400);
        return () => clearInterval(id);
    }, [n]);
    return heights;
}

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

function avatarGradient(name = '') {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `linear-gradient(135deg, hsl(${h % 360},50%,20%), hsl(${(h + 80) % 360},60%,30%))`;
}

interface Slide {
    key: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    bg: string | null;
    stat1Label: string; stat1Value: string;
    stat2Label: string; stat2Value: string;
    actionLabel: string;
    onAction: () => void;
}

export const FrontpageAltF: React.FC = () => {
    const navigate = useNavigate();
    const { player, setTrack, togglePlay } = usePlayer();
    const waveHeights = useWaveform(12);

    const [loading,       setLoading]       = useState(true);
    const [slideIdx,      setSlideIdx]      = useState(0);
    const [artists,       setArtists]       = useState<any[]>([]);
    const [chartEntries,  setChartEntries]  = useState<any[]>([]);
    const [articles,      setArticles]      = useState<any[]>([]);
    const [battles,       setBattles]       = useState<any[]>([]);
    const [playlists,     setPlaylists]     = useState<any[]>([]);

    useEffect(() => {
        Promise.all([
            axios.get('/api/charts/weekly').catch(() => ({ data: null })),
            axios.get('/api/musician/profiles?limit=8').catch(() => ({ data: [] })),
            axios.get('/api/articles?limit=6').catch(() => ({ data: { articles: [] } })),
            axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
            axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
        ]).then(([cRes, pRes, aRes, bRes, plRes]) => {
            const chart = Array.isArray(cRes.data) ? cRes.data[0] : cRes.data;
            setChartEntries(chart?.entries || []);
            setArtists(arr(pRes.data).slice(0, 8));
            setArticles((aRes.data?.articles || arr(aRes.data)).slice(0, 6));
            setBattles(arr(bRes.data));
            setPlaylists(arr(plRes.data));
            setLoading(false);
        });
    }, []);

    // ── Build carousel slides ──────────────────────────────────────────────
    const topTrack   = chartEntries[0]?.track || null;
    const topProfile = chartEntries[0]?.profile || topTrack?.profile || null;
    const fArtist    = artists.find((a: any) => a.bannerUrl) || artists[0] || null;
    const fBattle    = battles.find((b: any) => b.bannerUrl && (b.status === 'active' || b.status === 'open'))
                     || battles.find((b: any) => b.bannerUrl) || battles[0] || null;
    const fPlaylist  = playlists[0] || null;

    const slides: Slide[] = [];

    if (topTrack) {
        const playTopTrack = () => {
            if (!topTrack.url) return;
            const q = chartEntries.slice(0, 20).filter((e: any) => e.track?.url).map((e: any) => ({
                id: e.track.id, title: e.track.title,
                artist: e.profile?.displayName || e.profile?.username || '',
                url: e.track.url, coverUrl: e.track.coverUrl,
            }));
            setTrack(q[0], q);
        };
        slides.push({
            key: 'track',
            eyebrow: '#1 This Week',
            title: topTrack.title,
            subtitle: topProfile?.displayName || topProfile?.username || 'Unknown Artist',
            bg: topTrack.coverUrl || null,
            stat1Label: 'Plays', stat1Value: fmtNum(topTrack.playCount || chartEntries[0]?.plays),
            stat2Label: 'Chart', stat2Value: '#1 Trending',
            actionLabel: 'Play Now',
            onAction: playTopTrack,
        });
    }

    if (fArtist) {
        const genreName = fArtist.genres?.[0]?.genre?.name || fArtist.genres?.[0]?.name || 'Producer';
        slides.push({
            key: 'artist',
            eyebrow: 'Featured Artist',
            title: fArtist.displayName || fArtist.username,
            subtitle: genreName,
            bg: fArtist.bannerUrl || fArtist.avatar || null,
            stat1Label: 'Tracks',   stat1Value: fmtNum(fArtist._count?.tracks || fArtist.trackCount),
            stat2Label: 'Followers', stat2Value: fmtNum(fArtist._count?.followers || 0),
            actionLabel: 'View Profile',
            onAction: () => navigate(`/profile/${fArtist.username}`),
        });
    }

    if (fBattle) {
        const entries = fBattle._count?.entries || 0;
        const prize   = fBattle.prizePool || (fBattle.prizes?.[0]?.amount ? `$${fBattle.prizes[0].amount}` : null);
        slides.push({
            key: 'battle',
            eyebrow: 'Featured Battle',
            title: fBattle.title,
            subtitle: fBattle.status === 'active' ? 'Live Now' : fBattle.status === 'voting' ? 'Voting Open' : 'Beat Battle',
            bg: fBattle.bannerUrl || fBattle.cardImageUrl || null,
            stat1Label: 'Entries', stat1Value: fmtNum(entries),
            stat2Label: 'Prize',   stat2Value: prize || 'Community',
            actionLabel: 'View Battle',
            onAction: () => navigate('/preview/alt_f_battles'),
        });
    }

    if (fPlaylist) {
        const trackCount = fPlaylist.trackCount ?? fPlaylist._count?.tracks ?? fPlaylist.tracks?.length ?? 0;
        slides.push({
            key: 'playlist',
            eyebrow: 'Featured Playlist',
            title: fPlaylist.name || fPlaylist.title,
            subtitle: `${trackCount} tracks curated by the community`,
            bg: fPlaylist.coverUrl || fPlaylist.tracks?.[0]?.coverUrl || null,
            stat1Label: 'Tracks', stat1Value: fmtNum(trackCount),
            stat2Label: 'Type',   stat2Value: fPlaylist.isPublic === false ? 'Private' : 'Community',
            actionLabel: 'Open Playlist',
            onAction: () => navigate(`/playlist/${fPlaylist.id}`),
        });
    }

    // Auto-advance carousel
    useEffect(() => {
        if (slides.length <= 1) return;
        const id = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 6000);
        return () => clearInterval(id);
    }, [slides.length]);

    const slide = slides.length ? slides[slideIdx % slides.length] : null;

    const isPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    // ── Top artists — rank colours ────────────────────────────────────────
    const rankColor = (i: number) => ['#FFD700', '#C0C0C0', '#CD7F32', SUB, SUB, SUB, SUB, SUB][i] ?? SUB;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Home" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader
                    breadcrumb={[{ label: 'Home' }]}
                    leftSlot={<>
                        <button
                            aria-label="Previous"
                            disabled={slides.length <= 1}
                            onClick={() => setSlideIdx(i => (i - 1 + slides.length) % slides.length)}
                            style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, cursor: slides.length > 1 ? 'pointer' : 'default', opacity: slides.length > 1 ? 1 : 0.4 }}>
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            aria-label="Next"
                            disabled={slides.length <= 1}
                            onClick={() => setSlideIdx(i => (i + 1) % slides.length)}
                            style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, cursor: slides.length > 1 ? 'pointer' : 'default', opacity: slides.length > 1 ? 1 : 0.4 }}>
                            <ChevronRight size={18} />
                        </button>
                    </>}
                />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {loading ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>
                    ) : (
                    <>
                        {/* ── CAROUSEL HERO — 480px, full-bleed, centred ── */}
                        {slide && (
                            <section style={{ position: 'relative', width: '100%', height: 480, overflow: 'hidden' }}>
                                {/* Background */}
                                {slide.bg
                                    ? <img key={slide.key} src={slide.bg} alt="" referrerPolicy="no-referrer"
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
                                    : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a3a 0%, #1a0a2a 50%, #0f131d 100%)' }} />
                                }
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.45) 50%, transparent 100%)' }} />

                                {/* Dot indicators */}
                                {slides.length > 1 && (
                                    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6, zIndex: 3 }}>
                                        {slides.map((s, i) => {
                                            const on = i === (slideIdx % slides.length);
                                            return <button key={s.key} aria-label={s.eyebrow} onClick={() => setSlideIdx(i)}
                                                style={{ width: on ? 22 : 8, height: 8, borderRadius: 9999, background: on ? PRIMARY : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />;
                                        })}
                                    </div>
                                )}

                                {/* Centred content */}
                                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 40px', textAlign: 'center' }}>
                                    {/* Eyebrow badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                                        <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '5px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Flame size={12} fill={PRIMARY} /> {slide.eyebrow}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h1 style={{ margin: '0 0 10px', fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.8)', maxWidth: 700 }}>
                                        {slide.title}
                                    </h1>
                                    <p style={{ margin: '0 0 28px', maxWidth: 480, color: 'rgba(159,166,185,0.9)', fontSize: 15, lineHeight: 1.65 }}>
                                        {slide.subtitle}
                                    </p>

                                    {/* Stats pill */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(28,31,42,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(87,66,54,0.35)', borderRadius: 20, padding: '20px 40px', marginBottom: 28 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 0 0' }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{slide.stat1Label}</span>
                                            <span style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>{slide.stat1Value}</span>
                                        </div>
                                        <div style={{ width: 1, height: 48, background: 'rgba(87,66,54,0.5)' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px' }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{slide.stat2Label}</span>
                                            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{slide.stat2Value}</span>
                                        </div>
                                        <div style={{ width: 1, height: 48, background: 'rgba(87,66,54,0.5)' }} />
                                        <div style={{ padding: '0 0 0 28px' }}>
                                            <button onClick={slide.onAction} style={{ padding: '14px 36px', borderRadius: 12, background: PRIMARY, border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 0 24px ${PRIMARY}55`, letterSpacing: '-0.01em', fontFamily: FONT }}>
                                                {slide.actionLabel}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Waveform */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 48, overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
                                            {waveHeights.map((h, i) => (
                                                <div key={i} style={{ width: 6, height: `${h}%`, background: SECONDARY, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease-in-out', flexShrink: 0 }} />
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: 280, fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            <span style={{ color: SECONDARY }}>Live on Fuji</span>
                                            <span>{fmtNum(chartEntries.length * 100 + artists.length * 50)} Tracks</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* ── MAIN BODY: 280px sidebar + 1fr content ── */}
                        <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                            {/* ── LEFT SIDEBAR ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* Top Artists — Wall of Fame equivalent */}
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Users size={16} color={SECONDARY} />
                                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Top Artists</h3>
                                        </div>
                                        <button onClick={() => navigate('/preview/alt_f_artists')} style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>View All</button>
                                    </div>
                                    {artists.length === 0 ? (
                                        <div style={{ padding: 28, textAlign: 'center', color: SUB, fontSize: 13 }}>No artists found.</div>
                                    ) : artists.slice(0, 5).map((a: any, i: number) => {
                                        const name = a.displayName || a.username || 'Artist';
                                        const genre = a.genres?.[0]?.genre?.name || a.genres?.[0]?.name || 'Producer';
                                        const rc = rankColor(i);
                                        const initials = name.slice(0, 2).toUpperCase();
                                        return (
                                            <div
                                                key={a.id || a.username}
                                                onClick={() => navigate(`/profile/${a.username}`)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < 4 ? `1px solid ${DIVIDER}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(38,42,53,0.5)')}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                                            >
                                                {/* Avatar */}
                                                <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: a.avatar ? 'transparent' : avatarGradient(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                                                    {a.avatar
                                                        ? <img src={a.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : initials}
                                                </div>
                                                {/* Name + genre */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                                                    <p style={{ margin: '3px 0 0', fontSize: 11, color: SUB }}>{genre}</p>
                                                </div>
                                                {/* Rank */}
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: rc }}>#{i + 1}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 10, color: SUB }}>{fmtNum(a._count?.tracks || 0)} tracks</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Top Tracks — Community Stats equivalent */}
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', borderLeft: `4px solid ${PRIMARY}` }}>
                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <TrendingUp size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Trending Tracks</h3>
                                    </div>
                                    {chartEntries.length === 0 ? (
                                        <div style={{ padding: 28, textAlign: 'center', color: SUB, fontSize: 13 }}>No chart data yet.</div>
                                    ) : chartEntries.slice(0, 5).map((entry: any, i: number) => {
                                        const t = entry.track || {};
                                        const profile = entry.profile || t.profile || {};
                                        const rc = rankColor(i);
                                        const playing = isPlaying(t.id);
                                        return (
                                            <div
                                                key={t.id || i}
                                                style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', alignItems: 'center', padding: '11px 16px', borderBottom: i < 4 ? `1px solid ${DIVIDER}` : 'none', fontSize: 14, gap: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(38,42,53,0.4)')}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                                            >
                                                <span style={{ fontWeight: 900, fontSize: 12, color: rc, textAlign: 'center' }}>#{i + 1}</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '—'}</div>
                                                    <div style={{ fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.displayName || profile.username || ''}</div>
                                                </div>
                                                <span style={{ fontSize: 11, color: SUB, textAlign: 'right', flexShrink: 0 }}>{fmtNum(t.playCount || entry.plays)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── RIGHT CONTENT ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                                {/* Latest News — Upcoming Arenas equivalent */}
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Latest News</h2>
                                        <button onClick={() => navigate('/preview/alt_f_articles')} style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>View All Articles</button>
                                    </div>
                                    {articles.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '40px 24px', textAlign: 'center', color: SUB, fontSize: 14 }}>
                                            <Newspaper size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div>No articles published yet.</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
                                            {articles.slice(0, 4).map((a: any) => (
                                                <div
                                                    key={a.id}
                                                    onClick={() => navigate(`/preview/alt_f_article`)}
                                                    style={{ ...glass, borderRadius: 20, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s, transform 0.15s' }}
                                                    onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}
                                                >
                                                    {/* Image top */}
                                                    <div style={{ height: 128, position: 'relative', background: S_HIGH, flexShrink: 0, overflow: 'hidden' }}>
                                                        {a.coverImageUrl
                                                            ? <img src={a.coverImageUrl} alt="" referrerPolicy="no-referrer"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                                                                onMouseEnter={ev => (ev.currentTarget.style.transform = 'scale(1.08)')}
                                                                onMouseLeave={ev => (ev.currentTarget.style.transform = 'scale(1)')} />
                                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a2010, #0a1020)' }}>
                                                                <Newspaper size={36} color={`${PRIMARY}55`} />
                                                            </div>
                                                        }
                                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,0.65) 0%, transparent 60%)' }} />
                                                        {/* Category badge */}
                                                        {a.category && (
                                                            <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                                                <span style={{ background: 'rgba(15,19,29,0.85)', backdropFilter: 'blur(8px)', border: `1px solid ${SECONDARY}55`, color: SECONDARY, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                                    {a.category}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Body */}
                                                    <div style={{ padding: '14px 18px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: TEXT, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                                                            {a.title}
                                                        </h3>
                                                        {a.excerpt && (
                                                            <p style={{ margin: '0 0 12px', fontSize: 12, color: SUB, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', flex: 1 }}>
                                                                {a.excerpt}
                                                            </p>
                                                        )}
                                                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${DIVIDER}`, fontSize: 11, color: SUB }}>
                                                            <span>{a.authorName || 'Fuji Studio'}</span>
                                                            <span>{fmtDate(a.publishedAt)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Charts — Battle History equivalent */}
                                {chartEntries.length > 0 && (
                                    <section>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>This Week's Charts</h2>
                                            <button onClick={() => navigate('/preview/alt_f_charts')} style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>View Full Charts</button>
                                        </div>
                                        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                            {/* Table header */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '48px 44px 1fr 160px 90px 40px', padding: '10px 24px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}`, alignItems: 'center' }}>
                                                <span style={{ textAlign: 'center' }}>Rank</span>
                                                <span />
                                                <span>Track</span>
                                                <span>Artist</span>
                                                <span style={{ textAlign: 'right' }}>Plays</span>
                                                <span />
                                            </div>
                                            {chartEntries.slice(0, 12).map((entry: any, i: number) => {
                                                const t = entry.track || {};
                                                const profile = entry.profile || t.profile || {};
                                                const rc = rankColor(i);
                                                const playing = isPlaying(t.id);
                                                const artistName = profile.displayName || profile.username || '—';
                                                const initials = artistName !== '—' ? artistName.slice(0, 2).toUpperCase() : '—';
                                                const avatarColors = [PRIMARY, SECONDARY, '#A78BFA'];

                                                return (
                                                    <div
                                                        key={t.id || i}
                                                        onClick={() => t.url && setTrack(
                                                            { id: t.id, title: t.title, artist: artistName, url: t.url, coverUrl: t.coverUrl },
                                                            chartEntries.filter((e: any) => e.track?.url).map((e: any) => ({
                                                                id: e.track.id, title: e.track.title,
                                                                artist: (e.profile || e.track.profile)?.displayName || (e.profile || e.track.profile)?.username || '',
                                                                url: e.track.url, coverUrl: e.track.coverUrl,
                                                            }))
                                                        )}
                                                        style={{ display: 'grid', gridTemplateColumns: '48px 44px 1fr 160px 90px 40px', padding: '13px 24px', alignItems: 'center', borderBottom: i < Math.min(chartEntries.length, 12) - 1 ? `1px solid ${DIVIDER}` : 'none', cursor: t.url ? 'pointer' : 'default', transition: 'background 0.15s', background: playing ? `${PRIMARY}08` : 'transparent' }}
                                                        onMouseEnter={ev => { if (!playing) ev.currentTarget.style.background = 'rgba(38,42,53,0.4)'; }}
                                                        onMouseLeave={ev => { if (!playing) ev.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        {/* Rank */}
                                                        <span style={{ textAlign: 'center', fontWeight: 900, fontSize: 14, color: rc }}>#{i + 1}</span>
                                                        {/* Cover */}
                                                        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: S_HIGH, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {t.coverUrl
                                                                ? <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                : <Music size={14} color={SUB} />
                                                            }
                                                        </div>
                                                        {/* Track title */}
                                                        <div style={{ minWidth: 0, paddingRight: 12 }}>
                                                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '—'}</p>
                                                        </div>
                                                        {/* Artist */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${avatarColors[i % 3]}22`, border: `1px solid ${avatarColors[i % 3]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 800, color: avatarColors[i % 3], overflow: 'hidden' }}>
                                                                {profile.avatar
                                                                    ? <img src={profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : initials}
                                                            </div>
                                                            <span style={{ fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artistName}</span>
                                                        </div>
                                                        {/* Plays */}
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? PRIMARY : TEXT, textAlign: 'right' }}>{fmtNum(t.playCount || entry.plays)}</span>
                                                        <Arrow size={15} color={SUB} style={{ justifySelf: 'center' }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {!slide && chartEntries.length === 0 && articles.length === 0 && (
                                    <div style={{ padding: 60, textAlign: 'center', color: SUB, fontSize: 14 }}>Nothing to show yet.</div>
                                )}
                            </div>
                        </div>
                    </>
                    )}
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
