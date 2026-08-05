/**
 * Alt F — Home (/preview/alt_f)
 * Mirrors the Battles hub layout: carousel hero, top artists (wall of fame),
 * top tracks (community stats), latest news (upcoming arenas), charts (battle history).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { appendSponsorRef, trackSponsorClick } from '../lib/sponsorUtils';
import {
    Users, Music, TrendingUp, Play, Pause,
    ChevronLeft, ChevronRight,
    Flame, Award, ExternalLink,
    ArrowUp, ArrowDown, MessageSquare, Hash, Clock, Zap,
    Tag, Sparkles, MessageCircle, Share2,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s) return ''; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

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

// Deterministic per-genre / per-flair accent hue — matches the genre pages.
function hueColor(name = '', sat = 62, light = 66) {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},${sat}%,${light}%)`;
}
const genreAccent = (name = '') => hueColor(name, 62, 66);
const flairColor = (name = '') => hueColor(name, 58, 64);

// Rank medal colours — index 0 = #1
const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];
const rankCol = (i: number) => MEDAL[i] ?? SUB;

interface Slide {
    key: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    bg: string | null;
    stat1Label: string; stat1Value: string;
    stat2Label: string; stat2Value: string;
    actionLabel: string;
    href?: string;
    onAction: () => void;
}

export const FrontpageAltF: React.FC = () => {
    const navigate = useNavigate();
    const { player, setTrack, togglePlay } = usePlayer();
    const bp = useAltBreakpoint();
    const isMobileHero = bp === 'xs';
    const isMobile = bp === 'xs';
    const [loading,            setLoading]            = useState(true);
    const [slideIdx,           setSlideIdx]           = useState(0);
    const [featured,           setFeatured]           = useState<any>(null);
    const [artists,            setArtists]            = useState<any[]>([]);
    const [chartEntries,       setChartEntries]       = useState<any[]>([]);
    const [battles,            setBattles]            = useState<any[]>([]);
    const [playlists,          setPlaylists]          = useState<any[]>([]);
    const [sponsors,           setSponsors]           = useState<any[]>([]);
    const [sponsorIdx,         setSponsorIdx]         = useState(0);
    const [hovArtist,          setHovArtist]          = useState<string | null>(null);
    const [hovTrack,           setHovTrack]           = useState<string | null>(null);
    useEffect(() => {
        Promise.all([
            axios.get('/api/charts/weekly').catch(() => ({ data: null })),
            axios.get('/api/musician/profiles?limit=8&sort=popular').catch(() => ({ data: [] })),
            axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
            axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
            axios.get('/api/discovery/settings').catch(() => ({ data: null })),
        ]).then(([cRes, pRes, bRes, plRes, dRes]) => {
            const chart = Array.isArray(cRes.data) ? cRes.data[0] : cRes.data;
            setChartEntries(chart?.entries || []);
            setArtists(arr(pRes.data).slice(0, 8));
            if (dRes.data) {
                setFeatured(dRes.data);
                // Use admin-curated global sponsors from discovery settings
                if (Array.isArray(dRes.data.globalSponsors) && dRes.data.globalSponsors.length > 0) {
                    setSponsors(dRes.data.globalSponsors);
                } else {
                    // Fallback: extract from battles
                    const seen = new Set<string>();
                    const merged: any[] = [];
                    for (const b of arr(bRes.data)) {
                        const s = b.sponsor;
                        if (s?.id && s.isActive && s.showOnPage && !seen.has(s.id)) { seen.add(s.id); merged.push(s); }
                    }
                    setSponsors(merged);
                }
            }
            const bBattles = arr(bRes.data);
            setBattles(bBattles);
            setPlaylists(arr(plRes.data));
            setLoading(false);
        });
    }, []);

    // Auto-advance sponsor carousel
    useEffect(() => {
        if (sponsors.length <= 1) return;
        const id = setInterval(() => setSponsorIdx(i => (i + 1) % sponsors.length), 6000);
        return () => clearInterval(id);
    }, [sponsors.length]);

    // ── Carousel slides ───────────────────────────────────────────────────
    const slides: Slide[] = [];

    if (featured) {
        // Primary featured content (admin-curated)
        if (featured.featuredType === 'track' && featured.featuredTrack) {
            const t = featured.featuredTrack;
            const p = t.profile;
            slides.push({
                key: 'featured-track',
                eyebrow: featured.featuredLabel || 'Featured Track',
                title: t.title,
                subtitle: featured.featuredDescription || p?.displayName || p?.username || 'Unknown Artist',
                bg: t.coverUrl || null,
                stat1Label: 'Plays',  stat1Value: fmtNum(t.playCount),
                stat2Label: 'Genre',  stat2Value: t.genres?.[0]?.genre?.name || 'Producer',
                actionLabel: 'Play Now',
                onAction: () => {
                    if (!t.url) return;
                    setTrack({ id: t.id, title: t.title, artist: p?.displayName || p?.username || '', url: t.url, coverUrl: t.coverUrl }, []);
                },
            });
        } else if (featured.featuredType === 'artist' && featured.featuredArtist) {
            const a = featured.featuredArtist;
            const genre = a.genres?.[0]?.genre?.name || 'Producer';
            slides.push({
                key: 'featured-artist',
                eyebrow: featured.featuredLabel || 'Featured Artist',
                title: a.displayName || a.username,
                subtitle: featured.featuredDescription || genre,
                bg: a.bannerUrl || a.avatar || null,
                stat1Label: 'Tracks',      stat1Value: fmtNum(a._count?.tracks ?? a.tracks?.length),
                stat2Label: 'Total Plays', stat2Value: fmtNum(a.totalPlays),
                actionLabel: 'View Profile',
                href: `/profile/${a.username}`,
                onAction: () => navigate(`/profile/${a.username}`),
            });
        } else if (featured.featuredType === 'playlist' && featured.featuredPlaylist) {
            const pl = featured.featuredPlaylist;
            const cnt = pl._count?.tracks ?? pl.tracks?.length ?? 0;
            slides.push({
                key: 'featured-playlist',
                eyebrow: featured.featuredLabel || 'Featured Playlist',
                title: pl.name || pl.title,
                subtitle: featured.featuredDescription || `${cnt} tracks curated for the community`,
                bg: pl.coverUrl || pl.tracks?.[0]?.track?.coverUrl || null,
                stat1Label: 'Tracks', stat1Value: fmtNum(cnt),
                stat2Label: 'By',     stat2Value: pl.profile?.displayName || pl.profile?.username || 'Community',
                actionLabel: 'Open Playlist',
                href: `/playlist/${pl.id}`,
                onAction: () => navigate(`/playlist/${pl.id}`),
            });
        }

        // Featured battle (independent of featuredType)
        if (featured.featuredBattle) {
            const b = featured.featuredBattle;
            const prize = b.prizePool || (b.prizes?.[0]?.amount ? `$${b.prizes[0].amount}` : null);
            slides.push({
                key: 'featured-battle',
                eyebrow: 'Featured Battle',
                title: b.title,
                subtitle: featured.featuredBattleDescription || (b.status === 'active' ? 'Live Now' : b.status === 'voting' ? 'Voting Open' : 'Beat Battle'),
                bg: b.bannerUrl || b.cardImageUrl || null,
                stat1Label: 'Entries', stat1Value: fmtNum(b._count?.entries),
                stat2Label: 'Prize',   stat2Value: prize || 'Community',
                actionLabel: 'View Battle',
                href: '/battles',
                onAction: () => navigate('/battles'),
            });
        }

        // Featured producer as a slide (if set and not already the primary)
        if (featured.featuredProducer && featured.featuredType !== 'artist') {
            const pr = featured.featuredProducer;
            const genre = pr.genres?.[0]?.genre?.name || 'Producer';
            slides.push({
                key: 'featured-producer',
                eyebrow: 'Featured Producer',
                title: pr.displayName || pr.username,
                subtitle: featured.featuredProducerNote || genre,
                bg: pr.bannerUrl || pr.avatar || null,
                stat1Label: 'Tracks', stat1Value: fmtNum(pr._count?.tracks ?? pr.tracks?.length),
                stat2Label: 'Genre',  stat2Value: genre,
                actionLabel: 'View Profile',
                href: `/profile/${pr.username}`,
                onAction: () => navigate(`/profile/${pr.username}`),
            });
        }
    }

    // Fallback slides — only used when no featured content is configured
    if (slides.length === 0) {
        const topEntry   = chartEntries[0] || null;
        const topTrack   = topEntry?.track || null;
        const topProfile = topEntry?.track?.profile || null;
        const fArtist    = artists.find((a: any) => a.bannerUrl) || artists[0] || null;
        const fBattle    = battles.find((b: any) => b.bannerUrl && (b.status === 'active' || b.status === 'open'))
                         || battles.find((b: any) => b.bannerUrl) || battles[0] || null;
        const fPlaylist  = playlists[0] || null;

        if (topTrack) {
            slides.push({
                key: 'track',
                eyebrow: '#1 This Week',
                title: topTrack.title,
                subtitle: topProfile?.displayName || topProfile?.username || 'Unknown Artist',
                bg: topTrack.coverUrl || null,
                stat1Label: 'Plays', stat1Value: fmtNum(topTrack.playCount),
                stat2Label: 'Chart', stat2Value: '#1 Trending',
                actionLabel: 'Play Now',
                onAction: () => {
                    if (!topTrack.url) return;
                    const q = chartEntries.filter((e: any) => e.track?.url).map((e: any) => ({
                        id: e.track.id, title: e.track.title,
                        artist: e.track.profile?.displayName || e.track.profile?.username || '',
                        url: e.track.url, coverUrl: e.track.coverUrl,
                    }));
                    setTrack(q[0], q);
                },
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
                stat1Label: 'Tracks',      stat1Value: fmtNum(fArtist._count?.tracks),
                stat2Label: 'Total Plays', stat2Value: fmtNum(fArtist.totalPlays),
                actionLabel: 'View Profile',
                href: `/profile/${fArtist.username}`,
                onAction: () => navigate(`/profile/${fArtist.username}`),
            });
        }
        if (fBattle) {
            const prize = fBattle.prizePool || (fBattle.prizes?.[0]?.amount ? `$${fBattle.prizes[0].amount}` : null);
            slides.push({
                key: 'battle',
                eyebrow: 'Featured Battle',
                title: fBattle.title,
                subtitle: fBattle.status === 'active' ? 'Live Now' : fBattle.status === 'voting' ? 'Voting Open' : 'Beat Battle',
                bg: fBattle.bannerUrl || null,
                stat1Label: 'Entries', stat1Value: fmtNum(fBattle._count?.entries),
                stat2Label: 'Prize',   stat2Value: prize || 'Community',
                actionLabel: 'View Battle',
                href: '/battles',
                onAction: () => navigate('/battles'),
            });
        }
        if (fPlaylist) {
            const cnt = fPlaylist.trackCount ?? fPlaylist._count?.tracks ?? fPlaylist.tracks?.length ?? 0;
            slides.push({
                key: 'playlist',
                eyebrow: 'Featured Playlist',
                title: fPlaylist.name || fPlaylist.title,
                subtitle: `${cnt} tracks curated by the community`,
                bg: fPlaylist.coverUrl || fPlaylist.tracks?.[0]?.coverUrl || null,
                stat1Label: 'Tracks', stat1Value: fmtNum(cnt),
                stat2Label: 'Type',   stat2Value: fPlaylist.isPublic === false ? 'Private' : 'Community',
                actionLabel: 'Open Playlist',
                href: `/playlist/${fPlaylist.id}`,
                onAction: () => navigate(`/playlist/${fPlaylist.id}`),
            });
        }
    }

    useEffect(() => {
        if (slides.length <= 1) return;
        const id = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 6000);
        return () => clearInterval(id);
    }, [slides.length]);

    const slide = slides.length ? slides[slideIdx % slides.length] : null;

    const isActivePlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    // ── play a chart track ────────────────────────────────────────────────
    const playChartEntry = (e: any) => {
        const t = e.track;
        if (!t?.url) return;
        if (player.currentTrack?.id === t.id) { togglePlay(); return; }
        const q = chartEntries.filter((x: any) => x.track?.url).map((x: any) => ({
            id: x.track.id, title: x.track.title,
            artist: x.track.profile?.displayName || x.track.profile?.username || '',
            url: x.track.url, coverUrl: x.track.coverUrl,
        }));
        const idx = q.findIndex(x => x.id === t.id);
        setTrack(q[idx] ?? q[0], q);
    };

    // ── TOP ARTISTS (extracted for shared rail section on mobile) ──────────
    const topArtistsSection = (
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Users size={15} color={SECONDARY} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Top Artists</span>
                </div>
                <Link to="/artists"
                    style={{ color: PRIMARY, fontSize: 11, fontWeight: 700, fontFamily: FONT, textDecoration: 'none' }}>
                    View All
                </Link>
            </div>

            {artists.length === 0 ? (
                <div style={{ padding: '28px 18px', textAlign: 'center', color: SUB, fontSize: 13 }}>No artists found.</div>
            ) : artists.slice(0, 5).map((a: any, i: number) => {
                const name     = a.displayName || a.username || 'Artist';
                const genre    = a.genres?.[0]?.genre?.name || a.genres?.[0]?.name || 'Producer';
                const plays    = fmtNum(a.totalPlays || 0);
                const initials = name.slice(0, 2).toUpperCase();
                const rc       = rankCol(i);
                const isHov    = hovArtist === a.username;
                // medal ring: top 3 get a coloured 2px border around avatar
                const ringStyle = i < 3
                    ? { outline: `2px solid ${rc}`, outlineOffset: '2px' }
                    : {};

                return (
                    <Link
                        key={a.id || a.username}
                        to={`/profile/${a.username}`}
                        onMouseEnter={() => setHovArtist(a.username)}
                        onMouseLeave={() => setHovArtist(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < 4 ? `1px solid ${DIVIDER}` : 'none', background: isHov ? 'rgba(38,42,53,0.55)' : 'transparent', transition: 'background 0.15s', textDecoration: 'none', color: 'inherit' }}
                    >
                        {/* Rank badge */}
                        <div style={{ width: 20, flexShrink: 0, textAlign: 'center' }}>
                            {i < 3 ? (
                                <span style={{ fontSize: 14, fontWeight: 900, color: rc, lineHeight: 1 }}>{['🥇','🥈','🥉'][i]}</span>
                            ) : (
                                <span style={{ fontSize: 12, fontWeight: 700, color: SUB }}>{i + 1}</span>
                            )}
                        </div>

                        {/* Avatar */}
                        <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: avatarGradient(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', ...ringStyle }}>
                            {a.avatar
                                ? <img src={a.avatar} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                : initials}
                        </div>

                        {/* Name + genre */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                            <div style={{ fontSize: 11, color: SUB, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{genre}</div>
                        </div>

                        {/* Total plays */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? PRIMARY : TEXT }}>{plays}</div>
                            <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>plays</div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );

    // ── TRENDING TRACKS (extracted for shared rail section on mobile) ──────
    const trendingTracksSection = (
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                <TrendingUp size={13} color={PRIMARY} />
                <span style={{ fontSize: 11, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Trending Tracks</span>
            </div>

            {chartEntries.length === 0 ? (
                <div style={{ padding: '28px 18px', textAlign: 'center', color: SUB, fontSize: 13 }}>No chart data yet.</div>
            ) : chartEntries.slice(0, 5).map((entry: any, i: number) => {
                const t       = entry.track || {};
                const profile = t.profile || {};
                const rc      = rankCol(i);
                const playing = isActivePlaying(t.id);
                const isHov   = hovTrack === t.id;
                const artist  = profile.displayName || profile.username || '';

                return (
                    <div
                        key={t.id || i}
                        onClick={() => playChartEntry(entry)}
                        onMouseEnter={() => setHovTrack(t.id)}
                        onMouseLeave={() => setHovTrack(null)}
                        style={{ display: 'grid', gridTemplateColumns: '22px 40px 1fr 40px', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: i < 4 ? `1px solid ${DIVIDER}` : 'none', cursor: t.url ? 'pointer' : 'default', background: playing ? `${PRIMARY}0d` : isHov ? 'rgba(38,42,53,0.55)' : 'transparent', transition: 'background 0.15s' }}
                    >
                        {/* Rank / play button on hover */}
                        <div style={{ textAlign: 'center', width: 22 }}>
                            {(isHov || playing) && t.url ? (
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: playing ? PRIMARY : 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {playing
                                        ? <Pause size={9} color="#fff" fill="#fff" />
                                        : <Play size={9} color={TEXT} fill={TEXT} />}
                                </div>
                            ) : (
                                <span style={{ fontSize: i < 3 ? 13 : 12, fontWeight: 900, color: rc, lineHeight: 1 }}>
                                    {i + 1}
                                </span>
                            )}
                        </div>

                        {/* Cover art */}
                        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: S_HIGH, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: playing ? `0 0 0 2px ${PRIMARY}` : i < 3 ? `0 0 0 1.5px ${rc}55` : 'none' }}>
                            {t.coverUrl
                                ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                : <Music size={14} color={SUB} />}
                        </div>

                        {/* Title + artist */}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: playing ? 700 : 600, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '—'}</div>
                            {artist && <div style={{ fontSize: 11, color: SUB, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</div>}
                        </div>

                        {/* Play count */}
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? PRIMARY : TEXT }}>{fmtNum(t.playCount)}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

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
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}><AltSpinner /></div>
                    ) : (<>

                        {/* ── CAROUSEL HERO — 480px desktop / 280px mobile, full-bleed, centred ── */}
                        {slide && (
                            <section style={{ position: 'relative', width: '100%', height: isMobileHero ? 280 : 480, minHeight: isMobileHero ? 280 : 480, flexShrink: 0, overflow: 'hidden' }}>
                                {slide.bg
                                    ? <img key={slide.key} src={slide.bg} alt="" referrerPolicy="no-referrer"
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
                                    : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a3a 0%, #1a0a2a 50%, #0f131d 100%)' }} />
                                }
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.45) 50%, transparent 100%)' }} />

                                {slides.length > 1 && (
                                    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6, zIndex: 3 }}>
                                        {slides.map((s, i) => {
                                            const on = i === (slideIdx % slides.length);
                                            return <button key={s.key} onClick={() => setSlideIdx(i)}
                                                style={{ width: on ? 22 : 8, height: 8, borderRadius: 9999, background: on ? PRIMARY : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />;
                                        })}
                                    </div>
                                )}

                                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobileHero ? '0 20px' : '0 40px', textAlign: 'center' }}>
                                    {/* Eyebrow + title + subtitle — centred in the upper portion */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: isMobileHero ? 76 : 120 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isMobileHero ? 10 : 18 }}>
                                            <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: isMobileHero ? '4px 12px' : '5px 16px', borderRadius: 9999, fontSize: isMobileHero ? 9 : 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Flame size={isMobileHero ? 10 : 12} fill={PRIMARY} /> {slide.eyebrow}
                                            </span>
                                        </div>
                                        <h1 style={{ margin: '0 0 8px', fontSize: isMobileHero ? 26 : 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, textShadow: '0 4px 24px rgba(0,0,0,0.8)', maxWidth: isMobileHero ? 320 : 700 }}>
                                            {slide.title}
                                        </h1>
                                        <p style={{
                                            margin: 0, maxWidth: isMobileHero ? 300 : 480, color: 'rgba(159,166,185,0.9)', fontSize: isMobileHero ? 12 : 15, lineHeight: 1.55,
                                            ...(isMobileHero ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
                                        }}>
                                            {slide.subtitle}
                                        </p>
                                    </div>

                                    {/* Stats pill — pinned from bottom, always same position */}
                                    <div style={{ position: 'absolute', bottom: isMobileHero ? 14 : 32, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(28,31,42,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(87,66,54,0.35)', borderRadius: isMobileHero ? 14 : 20, padding: isMobileHero ? '10px 16px' : '20px 40px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobileHero ? '0 12px 0 0' : '0 28px 0 0' }}>
                                                <span style={{ fontSize: isMobileHero ? 8 : 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{slide.stat1Label}</span>
                                                <span style={{ fontSize: isMobileHero ? 14 : 20, fontWeight: 700, color: PRIMARY }}>{slide.stat1Value}</span>
                                            </div>
                                            <div style={{ width: 1, height: isMobileHero ? 30 : 48, background: 'rgba(87,66,54,0.5)' }} />
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobileHero ? '0 12px' : '0 28px' }}>
                                                <span style={{ fontSize: isMobileHero ? 8 : 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{slide.stat2Label}</span>
                                                <span style={{ fontSize: isMobileHero ? 14 : 20, fontWeight: 700, color: TEXT }}>{slide.stat2Value}</span>
                                            </div>
                                            <div style={{ width: 1, height: isMobileHero ? 30 : 48, background: 'rgba(87,66,54,0.5)' }} />
                                            <div style={{ padding: isMobileHero ? '0 0 0 12px' : '0 0 0 28px' }}>
                                                {slide.href ? (
                                                    <Link to={slide.href} style={{ padding: isMobileHero ? '8px 16px' : '14px 36px', borderRadius: isMobileHero ? 8 : 12, background: PRIMARY, color: '#fff', fontWeight: 800, fontSize: isMobileHero ? 12 : 15, boxShadow: `0 0 24px ${PRIMARY}55`, letterSpacing: '-0.01em', fontFamily: FONT, textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                        {slide.actionLabel}
                                                    </Link>
                                                ) : (
                                                    <button onClick={slide.onAction} style={{ padding: isMobileHero ? '8px 16px' : '14px 36px', borderRadius: isMobileHero ? 8 : 12, background: PRIMARY, border: 'none', color: '#fff', fontWeight: 800, fontSize: isMobileHero ? 12 : 15, cursor: 'pointer', boxShadow: `0 0 24px ${PRIMARY}55`, letterSpacing: '-0.01em', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                                                        {slide.actionLabel}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* ── SPONSOR BANNER — hidden on mobile ── */}
                        {!isMobile && sponsors.length > 0 && (() => {
                            const sp = sponsors[sponsorIdx % sponsors.length];
                            return (
                                <section style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px', boxSizing: 'border-box' }}>
                                    <div style={{
                                        ...glass,
                                        borderRadius: 20,
                                        background: `linear-gradient(to right, ${S_CONT}, ${S_HIGH}, ${S_CONT})`,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '20px 28px', flexWrap: 'wrap' }}>
                                            {/* Logo + name */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                                {sp.logoUrl
                                                    ? <img src={sp.logoUrl} alt={sp.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain', background: S_CONT }} />
                                                    : <div style={{ width: 48, height: 48, borderRadius: 10, background: `${PRIMARY}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Award size={22} color={PRIMARY} />
                                                      </div>
                                                }
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: PRIMARY, marginBottom: 2 }}>Official Sponsor</div>
                                                    <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{sp.name}</div>
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div style={{ width: 1, height: 40, background: BORDER, flexShrink: 0 }} />

                                            {/* Description */}
                                            {sp.description && (
                                                <p style={{ margin: 0, color: SUB, fontSize: 13, lineHeight: 1.5, flex: 1, minWidth: 160, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                                                    {sp.description}
                                                </p>
                                            )}

                                            {/* CTA */}
                                            {sp.websiteUrl && (
                                                <a href={appendSponsorRef(sp.websiteUrl, '/')} target="_blank" rel="noopener noreferrer"
                                                    onClick={() => trackSponsorClick(sp.id, 'alt_f')}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: PRIMARY, color: '#000', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                                                    <ExternalLink size={13} />
                                                    Visit Site
                                                </a>
                                            )}

                                            {/* Dot indicators (only when >1 sponsor) */}
                                            {sponsors.length > 1 && (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                                                    {sponsors.map((_: any, i: number) => (
                                                        <button key={i} onClick={() => setSponsorIdx(i)}
                                                            style={{ width: i === sponsorIdx % sponsors.length ? 20 : 6, height: 6, borderRadius: 3, background: i === sponsorIdx % sponsors.length ? PRIMARY : `${SUB}55`, border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s' }} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            );
                        })()}

                        {/* ── BODY GRID ── */}
                        <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', boxSizing: 'border-box' }}>

                            {/* ── RIGHT CONTENT ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                                {!slide && chartEntries.length === 0 && (
                                    <div style={{ padding: 60, textAlign: 'center', color: SUB, fontSize: 14 }}>Nothing to show yet.</div>
                                )}
                            </div>
                        </div>
                    </>)}
                </div>
                <AltActivitySidebar
                    topSlot={<>
{/* ── LEFT SIDEBAR ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {topArtistsSection}
                                {trendingTracksSection}
                            </div>
                </>}
                    railSections={[
                        { key: 'top-artists', label: 'Top Artists', icon: <Users size={20} />, content: topArtistsSection },
                        { key: 'trending', label: 'Trending', icon: <TrendingUp size={20} />, content: trendingTracksSection },
                    ]}
                />
                </div>
            </main>
        </div>
    );
};
