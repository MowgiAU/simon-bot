/**
 * Alt F — Home (/preview/alt_f)
 * Mirrors the Battles hub layout: carousel hero, top artists (wall of fame),
 * top tracks (community stats), latest news (upcoming arenas), charts (battle history).
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Users, Music, TrendingUp, Play, Pause,
    ChevronLeft, ChevronRight,
    Newspaper, Flame, Award, ExternalLink,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDate = (s?: string) => { if (!s) return ''; return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };

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
    onAction: () => void;
}

export const FrontpageAltF: React.FC = () => {
    const navigate = useNavigate();
    const { player, setTrack, togglePlay } = usePlayer();
    const [loading,      setLoading]      = useState(true);
    const [slideIdx,     setSlideIdx]     = useState(0);
    const [artists,      setArtists]      = useState<any[]>([]);
    const [chartEntries, setChartEntries] = useState<any[]>([]);
    const [articles,     setArticles]     = useState<any[]>([]);
    const [battles,      setBattles]      = useState<any[]>([]);
    const [playlists,    setPlaylists]    = useState<any[]>([]);
    const [newDrops,     setNewDrops]     = useState<any[]>([]);
    const [sponsors,     setSponsors]     = useState<any[]>([]);
    const [sponsorIdx,   setSponsorIdx]   = useState(0);
    const [hovArtist,    setHovArtist]    = useState<string | null>(null);
    const [hovTrack,     setHovTrack]     = useState<string | null>(null);
    const [hovDrop,      setHovDrop]      = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            axios.get('/api/charts/weekly').catch(() => ({ data: null })),
            axios.get('/api/musician/profiles?limit=8&sort=popular').catch(() => ({ data: [] })),
            axios.get('/api/articles?limit=6').catch(() => ({ data: { articles: [] } })),
            axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
            axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
            axios.get('/api/discovery/tracks?sort=newest&limit=12').catch(() => ({ data: { tracks: [] } })),
        ]).then(([cRes, pRes, aRes, bRes, plRes, dRes]) => {
            const chart = Array.isArray(cRes.data) ? cRes.data[0] : cRes.data;
            setChartEntries(chart?.entries || []);
            setArtists(arr(pRes.data).slice(0, 8));
            setArticles((aRes.data?.articles || arr(aRes.data)).slice(0, 6));
            const bBattles = arr(bRes.data);
            setBattles(bBattles);
            setPlaylists(arr(plRes.data));
            setNewDrops((dRes.data?.tracks || arr(dRes.data)).filter((t: any) => t.coverUrl).slice(0, 12));
            // Extract sponsors from battles (inline sponsor field), deduplicate by id
            const seen = new Set<string>();
            const merged: any[] = [];
            for (const b of bBattles) {
                const s = b.sponsor;
                if (s?.id && s.isActive && s.showOnPage && !seen.has(s.id)) {
                    seen.add(s.id);
                    merged.push(s);
                }
            }
            setSponsors(merged);
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
    const topEntry   = chartEntries[0] || null;
    const topTrack   = topEntry?.track || null;
    const topProfile = topEntry?.track?.profile || null;
    const fArtist    = artists.find((a: any) => a.bannerUrl) || artists[0] || null;
    const fBattle    = battles.find((b: any) => b.bannerUrl && (b.status === 'active' || b.status === 'open'))
                     || battles.find((b: any) => b.bannerUrl) || battles[0] || null;
    const fPlaylist  = playlists[0] || null;

    const slides: Slide[] = [];

    if (topTrack) {
        slides.push({
            key: 'track',
            eyebrow: '#1 This Week',
            title: topTrack.title,
            subtitle: topProfile?.displayName || topProfile?.username || 'Unknown Artist',
            bg: topTrack.coverUrl || null,
            stat1Label: 'Plays',  stat1Value: fmtNum(topTrack.playCount),
            stat2Label: 'Chart',  stat2Value: '#1 Trending',
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
            stat1Label: 'Tracks',    stat1Value: fmtNum(fArtist._count?.tracks),
            stat2Label: 'Total Plays', stat2Value: fmtNum(fArtist.totalPlays),
            actionLabel: 'View Profile',
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
            onAction: () => navigate('/preview/alt_f_battles'),
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
            onAction: () => navigate(`/playlist/${fPlaylist.id}`),
        });
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
                    ) : (<>

                        {/* ── CAROUSEL HERO — 480px, full-bleed, centred ── */}
                        {slide && (
                            <section style={{ position: 'relative', width: '100%', height: 480, minHeight: 480, flexShrink: 0, overflow: 'hidden' }}>
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

                                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 40px', textAlign: 'center' }}>
                                    {/* Eyebrow + title + subtitle — centred in the upper portion */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 120 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                                            <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '5px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Flame size={12} fill={PRIMARY} /> {slide.eyebrow}
                                            </span>
                                        </div>
                                        <h1 style={{ margin: '0 0 10px', fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.8)', maxWidth: 700 }}>
                                            {slide.title}
                                        </h1>
                                        <p style={{ margin: 0, maxWidth: 480, color: 'rgba(159,166,185,0.9)', fontSize: 15, lineHeight: 1.65 }}>
                                            {slide.subtitle}
                                        </p>
                                    </div>

                                    {/* Stats pill — pinned 32px from bottom, always same position */}
                                    <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(28,31,42,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(87,66,54,0.35)', borderRadius: 20, padding: '20px 40px' }}>
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
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* ── SPONSOR BANNER ── */}
                        {sponsors.length > 0 && (() => {
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
                                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: PRIMARY, marginBottom: 2 }}>Premium Partner</div>
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

                                            {/* CTA buttons */}
                                            <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                                                {sp.links && sp.links.length > 0
                                                    ? sp.links.map((lnk: any) => (
                                                        <a key={lnk.id} href={lnk.url} target="_blank" rel="noopener noreferrer"
                                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: PRIMARY, color: '#000', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                                            <ExternalLink size={13} />
                                                            {lnk.label}
                                                        </a>
                                                    ))
                                                    : sp.websiteUrl && (
                                                        <a href={sp.websiteUrl} target="_blank" rel="noopener noreferrer"
                                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: PRIMARY, color: '#000', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                                            <ExternalLink size={13} />
                                                            Visit Site
                                                        </a>
                                                    )
                                                }
                                            </div>

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
                        <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                            {/* ── LEFT SIDEBAR ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* ── TOP ARTISTS ── */}
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    {/* Header */}
                                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <Users size={15} color={SECONDARY} />
                                            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Top Artists</span>
                                        </div>
                                        <button onClick={() => navigate('/preview/alt_f_artists')}
                                            style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
                                            View All
                                        </button>
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
                                            <div
                                                key={a.id || a.username}
                                                onClick={() => navigate(`/profile/${a.username}`)}
                                                onMouseEnter={() => setHovArtist(a.username)}
                                                onMouseLeave={() => setHovArtist(null)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < 4 ? `1px solid ${DIVIDER}` : 'none', cursor: 'pointer', background: isHov ? 'rgba(38,42,53,0.55)' : 'transparent', transition: 'background 0.15s' }}
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
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ── TRENDING TRACKS ── */}
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
                            </div>

                            {/* ── RIGHT CONTENT ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                                {/* Latest News */}
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Latest News</h2>
                                        <button onClick={() => navigate('/preview/alt_f_articles')}
                                            style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                                            View All Articles
                                        </button>
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
                                                    onClick={() => navigate('/preview/alt_f_article')}
                                                    style={{ ...glass, borderRadius: 20, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s, transform 0.15s' }}
                                                    onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}
                                                >
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
                                                        {a.category && (
                                                            <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                                                <span style={{ background: 'rgba(15,19,29,0.85)', backdropFilter: 'blur(8px)', border: `1px solid ${SECONDARY}55`, color: SECONDARY, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                                    {a.category}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
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

                                {/* New Drops — 4-column album-art grid */}
                                {newDrops.length > 0 && (
                                    <section>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Drops</h2>
                                            <button onClick={() => navigate('/preview/alt_f_library')}
                                                style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                                                View All Tracks
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
                                            {newDrops.map((t: any) => {
                                                const artist  = t.profile?.displayName || t.profile?.username || t.artist || '';
                                                const playing = isActivePlaying(t.id);
                                                const isHov   = hovDrop === t.id;
                                                return (
                                                    <div
                                                        key={t.id}
                                                        onClick={() => {
                                                            if (!t.url) return;
                                                            if (player.currentTrack?.id === t.id) { togglePlay(); return; }
                                                            const q = newDrops.filter((x: any) => x.url).map((x: any) => ({
                                                                id: x.id, title: x.title,
                                                                artist: x.profile?.displayName || x.profile?.username || x.artist || '',
                                                                url: x.url, coverUrl: x.coverUrl,
                                                            }));
                                                            const idx = q.findIndex(x => x.id === t.id);
                                                            setTrack(q[idx] ?? q[0], q);
                                                        }}
                                                        onMouseEnter={() => setHovDrop(t.id)}
                                                        onMouseLeave={() => setHovDrop(null)}
                                                        style={{ cursor: t.url ? 'pointer' : 'default', minWidth: 0 }}
                                                    >
                                                        {/* Square cover art */}
                                                        <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', borderRadius: 12, overflow: 'hidden', background: S_HIGH, boxShadow: playing ? `0 0 0 2px ${PRIMARY}, 0 8px 24px rgba(0,0,0,0.5)` : '0 4px 16px rgba(0,0,0,0.4)', transition: 'box-shadow 0.2s, transform 0.15s', transform: isHov ? 'translateY(-3px)' : 'translateY(0)' }}>
                                                            {t.coverUrl
                                                                ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: isHov ? 'scale(1.06)' : 'scale(1)' }} />
                                                                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={28} color={SUB} /></div>
                                                            }
                                                            {/* Play overlay */}
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (isHov || playing) ? 1 : 0, transition: 'opacity 0.2s' }}>
                                                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: playing ? PRIMARY : 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                                                                    {playing
                                                                        ? <Pause size={16} color="#fff" fill="#fff" />
                                                                        : <Play  size={16} color="#111" fill="#111" style={{ marginLeft: 2 }} />
                                                                    }
                                                                </div>
                                                            </div>
                                                            {/* BPM badge */}
                                                            {t.bpm && (
                                                                <div style={{ position: 'absolute', bottom: 7, left: 7 }}>
                                                                    <span style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', color: SUB, padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{t.bpm} BPM</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Track info below art */}
                                                        <div style={{ marginTop: 9, paddingLeft: 2 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{t.title}</div>
                                                            {artist && <div style={{ fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{artist}</div>}
                                                        </div>
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
                    </>)}
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
