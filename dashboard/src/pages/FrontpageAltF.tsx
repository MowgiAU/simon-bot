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
    // Genre feed
    const [genrePosts,         setGenrePosts]         = useState<any[]>([]);
    const [genreFeedSort,      setGenreFeedSort]      = useState<'hot' | 'new' | 'top'>('hot');
    const [genreFeedLoading,   setGenreFeedLoading]   = useState(true);
    const [genreFeedHasMore,   setGenreFeedHasMore]   = useState(false);
    const [genreFeedCursor,    setGenreFeedCursor]    = useState<string | null>(null);
    const [genreHasSubs,       setGenreHasSubs]       = useState(false);
    const [genreVotes,         setGenreVotes]         = useState<Record<string, 'up' | 'down' | null>>({});
    const genreFeedRef = useRef<AbortController | null>(null);

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

    // Genre feed fetch
    const fetchGenreFeed = useCallback(async (sort: 'hot' | 'new' | 'top', cursor?: string | null, append = false) => {
        if (genreFeedRef.current) genreFeedRef.current.abort();
        const ac = new AbortController();
        genreFeedRef.current = ac;
        if (!append) setGenreFeedLoading(true);
        try {
            // Try subscribed first (only on initial load, not sort changes that come after)
            let res = await axios.get('/api/genre-posts', { params: { feed: 'subscribed', sort, limit: 20, ...(cursor ? { cursor } : {}) }, signal: ac.signal });
            let hasSubs = false;
            if (res.data.posts.length > 0 || res.data.hasSubscriptions !== false) {
                hasSubs = true;
            } else {
                // Fallback: show all genres
                res = await axios.get('/api/genre-posts', { params: { feed: 'all', sort, limit: 20, ...(cursor ? { cursor } : {}) }, signal: ac.signal });
            }
            setGenreHasSubs(hasSubs);
            setGenrePosts(prev => {
                if (!append) return res.data.posts;
                const seenTrackIds = new Set(prev.map((p: any) => p.trackId).filter(Boolean));
                return [...prev, ...res.data.posts.filter((p: any) => !p.trackId || !seenTrackIds.has(p.trackId))];
            });
            setGenreFeedHasMore(res.data.hasMore);
            setGenreFeedCursor(res.data.nextCursor);
            // Merge user votes into local vote state
            const voteMap: Record<string, 'up' | 'down' | null> = {};
            for (const p of res.data.posts) voteMap[p.id] = p.userVote;
            setGenreVotes(prev => ({ ...prev, ...voteMap }));
        } catch (e: any) {
            if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
                setGenrePosts([]);
            }
        } finally {
            setGenreFeedLoading(false);
        }
    }, []);

    useEffect(() => { fetchGenreFeed(genreFeedSort, null, false); }, [genreFeedSort, fetchGenreFeed]);

    const handleGenreVote = async (postId: string, type: 'up' | 'down') => {
        const current = genreVotes[postId];
        const newVote = current === type ? null : type;
        setGenreVotes(prev => ({ ...prev, [postId]: newVote }));
        setGenrePosts(prev => prev.map(p => {
            if (p.id !== postId) return p;
            const wasUp = current === 'up'; const wasDown = current === 'down';
            const isUp = newVote === 'up'; const isDown = newVote === 'down';
            const upDelta = (isUp ? 1 : 0) - (wasUp ? 1 : 0);
            const downDelta = (isDown ? 1 : 0) - (wasDown ? 1 : 0);
            return { ...p, upvotes: p.upvotes + upDelta, downvotes: p.downvotes + downDelta, score: p.score + upDelta - downDelta };
        }));
        try {
            if (newVote) await axios.post(`/api/genre-posts/${postId}/vote`, { type: newVote });
        } catch { /* revert on error */ fetchGenreFeed(genreFeedSort, null, false); }
    };

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
                href: '/preview/alt_f_battles',
                onAction: () => navigate('/preview/alt_f_battles'),
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
                href: '/preview/alt_f_battles',
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
                <Link to="/preview/alt_f_artists"
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
                                                <a href={sp.websiteUrl} target="_blank" rel="noopener noreferrer"
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

                                {/* ── GENRE FEED ── */}
                                <section>
                                    <style>{`@keyframes fujiPulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.6); opacity: 0; } }`}</style>
                                    {/* Header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {/* Gradient icon badge */}
                                            <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`, boxShadow: `0 6px 18px ${PRIMARY}55` }}>
                                                {genreHasSubs ? <Sparkles size={19} color="#fff" /> : <Users size={19} color="#fff" />}
                                            </div>
                                            <div>
                                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 9 }}>
                                                    {genreHasSubs ? 'Your Genres' : 'Community Feed'}
                                                    {/* live pulse */}
                                                    <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                                                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#33d17a' }} />
                                                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#33d17a', animation: 'fujiPulse 1.8s ease-out infinite' }} />
                                                    </span>
                                                </h2>
                                                <div style={{ fontSize: 11.5, color: SUB, marginTop: 2 }}>
                                                    {genreHasSubs ? 'Fresh from the genres you follow' : 'What the whole community is posting'}
                                                </div>
                                            </div>
                                        </div>
                                        <Link to="/preview/alt_f_genres"
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, color: PRIMARY, fontSize: 12, fontWeight: 700, textDecoration: 'none', padding: '7px 14px', borderRadius: 9999, background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}33` }}
                                            onMouseEnter={ev => (ev.currentTarget.style.background = `${PRIMARY}26`)}
                                            onMouseLeave={ev => (ev.currentTarget.style.background = `${PRIMARY}14`)}>
                                            <Hash size={12} /> Browse Genres
                                        </Link>
                                    </div>

                                    {/* Sort tabs */}
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                                        {(['hot', 'new', 'top'] as const).map(s => (
                                            <button key={s} onClick={() => setGenreFeedSort(s)}
                                                style={{ padding: '6px 14px', borderRadius: 9999, border: 'none', fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: genreFeedSort === s ? PRIMARY : S_HIGH, color: genreFeedSort === s ? '#fff' : SUB, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                {s === 'hot' && <Flame size={11} />}
                                                {s === 'new' && <Clock size={11} />}
                                                {s === 'top' && <Zap size={11} />}
                                                {s.charAt(0).toUpperCase() + s.slice(1)}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Posts */}
                                    {genreFeedLoading && genrePosts.length === 0 ? (
                                        <div style={{ padding: '40px 0', textAlign: 'center', color: SUB, fontSize: 13 }}><AltSpinner /></div>
                                    ) : genrePosts.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
                                            <Hash size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ color: TEXT, fontWeight: 700, marginBottom: 6 }}>No posts yet</div>
                                            <div style={{ color: SUB, fontSize: 13, marginBottom: 16 }}>Be the first to post in a genre community.</div>
                                            <Link to="/preview/alt_f_genres"
                                                style={{ padding: '8px 20px', background: PRIMARY, color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                                                Explore Genres
                                            </Link>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 8 }}>
                                            {genrePosts.map((post: any, postIdx: number) => {
                                                const voteDir = genreVotes[post.id] ?? post.userVote;
                                                const trackUrl = post.track?.mp3Url || post.track?.url;
                                                const accent = post.genre?.name ? genreAccent(post.genre.name) : PRIMARY;
                                                const isTrending = genreFeedSort === 'hot' && postIdx === 0 && (post.score ?? 0) > 0;
                                                const bodyPreview = !post.track && post.body
                                                    ? String(post.body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                                                    : '';
                                                const timeAgo = (() => {
                                                    const diff = Date.now() - new Date(post.createdAt).getTime();
                                                    const h = Math.floor(diff / 3_600_000);
                                                    if (h < 1) return `${Math.floor(diff / 60_000)}m`;
                                                    if (h < 24) return `${h}h`;
                                                    return `${Math.floor(h / 24)}d`;
                                                })();

                                                // ── Reddit-style flat mobile card: no card chrome, hairline divider,
                                                // compact header row, votes/comments/share as a bottom action bar. ──
                                                if (isMobile) {
                                                    return (
                                                        <div key={post.id} style={{ background: S_CONT, borderRadius: 12, padding: '12px 14px' }}>
                                                            {/* Header row */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                                                <Link to={`/preview/alt_f_genres/${post.genre?.slug}`}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: accent, textDecoration: 'none' }}>
                                                                    <Hash size={11} /> {post.genre?.name}
                                                                </Link>
                                                                <span style={{ fontSize: 11, color: `${SUB}99` }}>·</span>
                                                                <span style={{ fontSize: 11, color: SUB }}>{timeAgo}</span>
                                                                {isTrending && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #ff7a18, #ff3d6e)', padding: '2px 7px', borderRadius: 9999, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                                                                        <Flame size={9} /> Hot
                                                                    </span>
                                                                )}
                                                                {post.flair && (
                                                                    <span style={{ fontSize: 10, fontWeight: 700, color: flairColor(post.flair), background: `${flairColor(post.flair)}18`, padding: '1px 7px', borderRadius: 9999 }}>
                                                                        {post.flair}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Title */}
                                                            <Link to={`/preview/alt_f_genre_post/${post.id}`}
                                                                style={{ display: 'block', fontSize: 15, fontWeight: 700, color: TEXT, textDecoration: 'none', marginBottom: post.track ? 8 : 4, lineHeight: 1.35 }}>
                                                                {post.title}
                                                            </Link>

                                                            {/* Discussion body preview */}
                                                            {bodyPreview && (
                                                                <p style={{ margin: '0 0 8px', fontSize: 13, color: SUB, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                    {bodyPreview}
                                                                </p>
                                                            )}

                                                            {/* Track player — full width */}
                                                            {post.track && (() => {
                                                                const isActiveTrack = player.currentTrack?.id === post.track.id;
                                                                const trackPlaying = isActiveTrack && player.isPlaying;
                                                                const artist = post.track.profile?.displayName || post.track.profile?.username || '';
                                                                const playHandler = () => {
                                                                    if (!trackUrl) return;
                                                                    if (isActiveTrack) { togglePlay(); return; }
                                                                    setTrack({ id: post.track.id, title: post.track.title, artist, username: post.track.profile?.username, slug: post.track.slug, url: trackUrl, coverUrl: post.track.coverUrl }, []);
                                                                };
                                                                return (
                                                                    <div onClick={playHandler} style={{ display: 'flex', alignItems: 'center', gap: 10, background: S_HIGH, borderRadius: 10, padding: 8, marginBottom: 8, cursor: trackUrl ? 'pointer' : 'default' }}>
                                                                        <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                                                                            {post.track.coverUrl
                                                                                ? <img src={post.track.coverUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                                                : <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={SUB} /></div>}
                                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                {trackPlaying ? <Pause size={16} color="#fff" fill="#fff" /> : <Play size={16} color="#fff" fill="#fff" style={{ marginLeft: 1 }} />}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                                            <div style={{ fontSize: 13, fontWeight: 700, color: trackPlaying ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.track.title}</div>
                                                                            {artist && <div style={{ fontSize: 11, color: SUB, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</div>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Bottom action bar — votes / comments / share (Reddit-style) */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: S_HIGH, borderRadius: 9999, padding: '4px 6px' }}>
                                                                    <button onClick={() => handleGenreVote(post.id, 'up')}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: voteDir === 'up' ? PRIMARY : SUB }}>
                                                                        <ArrowUp size={15} fill={voteDir === 'up' ? PRIMARY : 'none'} />
                                                                    </button>
                                                                    <span style={{ fontSize: 12, fontWeight: 800, color: voteDir === 'up' ? PRIMARY : voteDir === 'down' ? SECONDARY : TEXT, minWidth: 16, textAlign: 'center' }}>
                                                                        {post.score ?? 0}
                                                                    </span>
                                                                    <button onClick={() => handleGenreVote(post.id, 'down')}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: voteDir === 'down' ? SECONDARY : SUB }}>
                                                                        <ArrowDown size={15} fill={voteDir === 'down' ? SECONDARY : 'none'} />
                                                                    </button>
                                                                </div>
                                                                <Link to={`/preview/alt_f_genre_post/${post.id}`}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: SUB, fontSize: 12, fontWeight: 700, textDecoration: 'none', background: S_HIGH, borderRadius: 9999, padding: '6px 12px' }}>
                                                                    <MessageSquare size={14} /> {post.commentCount ?? 0}
                                                                </Link>
                                                                <button onClick={() => navigator.share ? navigator.share({ title: post.title, url: `${window.location.origin}/preview/alt_f_genre_post/${post.id}` }).catch(() => {}) : navigator.clipboard.writeText(`${window.location.origin}/preview/alt_f_genre_post/${post.id}`)}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: SUB, fontSize: 12, fontWeight: 700, background: S_HIGH, border: 'none', borderRadius: 9999, padding: '6px 12px', cursor: 'pointer' }}>
                                                                    <Share2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={post.id} style={{ ...glass, borderRadius: 14, display: 'flex', gap: 0, overflow: 'hidden', borderLeft: `3px solid ${accent}`, transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s' }}
                                                        onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${accent}66`; ev.currentTarget.style.borderLeftColor = accent; ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = `0 14px 44px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`; }}
                                                        onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.borderLeftColor = accent; ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = glass.boxShadow as string; }}>

                                                        {/* Vote column */}
                                                        <div style={{ width: 52, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 4, background: `linear-gradient(180deg, ${accent}14, rgba(0,0,0,0.28))` }}>
                                                            <button onClick={() => handleGenreVote(post.id, 'up')}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: voteDir === 'up' ? PRIMARY : SUB, display: 'flex' }}>
                                                                <ArrowUp size={16} fill={voteDir === 'up' ? PRIMARY : 'none'} />
                                                            </button>
                                                            <span style={{ fontSize: 12, fontWeight: 800, color: voteDir === 'up' ? PRIMARY : voteDir === 'down' ? SECONDARY : TEXT, lineHeight: 1 }}>
                                                                {post.score ?? 0}
                                                            </span>
                                                            <button onClick={() => handleGenreVote(post.id, 'down')}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: voteDir === 'down' ? SECONDARY : SUB, display: 'flex' }}>
                                                                <ArrowDown size={16} fill={voteDir === 'down' ? SECONDARY : 'none'} />
                                                            </button>
                                                        </div>

                                                        {/* Main content */}
                                                        <div style={{ flex: 1, minWidth: 0, padding: '12px 16px' }}>
                                                            {/* Meta row */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                                                {isTrending && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #ff7a18, #ff3d6e)', padding: '2px 8px', borderRadius: 9999, letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 3px 10px rgba(255,61,110,0.4)' }}>
                                                                        <Flame size={10} /> Trending
                                                                    </span>
                                                                )}
                                                                <Link to={`/preview/alt_f_genres/${post.genre?.slug}`}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: accent, background: `${accent}1c`, border: `1px solid ${accent}3a`, padding: '2px 9px', borderRadius: 9999, textDecoration: 'none', letterSpacing: '0.02em' }}>
                                                                    <Hash size={10} /> {post.genre?.name}
                                                                </Link>
                                                                {post.flair && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: flairColor(post.flair), background: `${flairColor(post.flair)}18`, border: `1px solid ${flairColor(post.flair)}3a`, padding: '2px 8px', borderRadius: 9999 }}>
                                                                        <Tag size={9} /> {post.flair}
                                                                    </span>
                                                                )}
                                                                <span style={{ fontSize: 11, color: SUB }}>
                                                                    posted by <Link to={`/profile/${post.username}`} style={{ color: TEXT, fontWeight: 700, textDecoration: 'none' }}
                                                                        onMouseEnter={ev => (ev.currentTarget.style.color = accent)}
                                                                        onMouseLeave={ev => (ev.currentTarget.style.color = TEXT)}>{post.username}</Link>
                                                                </span>
                                                                <span style={{ fontSize: 11, color: `${SUB}cc`, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {timeAgo}</span>
                                                            </div>

                                                            {/* Title */}
                                                            <Link to={`/preview/alt_f_genre_post/${post.id}`}
                                                                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, fontWeight: 700, color: TEXT, textDecoration: 'none', marginBottom: post.track ? 10 : 0, lineHeight: 1.4 }}
                                                                onMouseEnter={ev => (ev.currentTarget.style.color = accent)}
                                                                onMouseLeave={ev => (ev.currentTarget.style.color = TEXT)}>
                                                                {!post.track && <MessageCircle size={15} color={accent} style={{ flexShrink: 0, marginTop: 3 }} />}
                                                                <span>{post.title}</span>
                                                            </Link>

                                                            {/* Discussion body preview */}
                                                            {bodyPreview && (
                                                                <p style={{ margin: '6px 0 0', paddingLeft: 12, borderLeft: `2px solid ${accent}44`, fontSize: 12.5, color: SUB, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                    {bodyPreview}
                                                                </p>
                                                            )}

                                                            {/* Track player card */}
                                                            {post.track && (() => {
                                                                const isActiveTrack = player.currentTrack?.id === post.track.id;
                                                                const trackPlaying = isActiveTrack && player.isPlaying;
                                                                const trackProgress = isActiveTrack ? (player.currentTime / (player.duration || post.track.duration || 1)) : 0;
                                                                const artist = post.track.profile?.displayName || post.track.profile?.username || '';
                                                                const peaks: number[] = post.track.waveformPeaks || [];
                                                                const playHandler = () => {
                                                                    if (!trackUrl) return;
                                                                    if (isActiveTrack) { togglePlay(); return; }
                                                                    setTrack({ id: post.track.id, title: post.track.title, artist, username: post.track.profile?.username, slug: post.track.slug, url: trackUrl, coverUrl: post.track.coverUrl }, []);
                                                                };
                                                                return (
                                                                    <div style={{ borderRadius: 12, overflow: 'hidden', background: S_HIGH, border: `1px solid rgba(255,255,255,0.07)`, marginBottom: 4 }}>
                                                                        <div style={{ display: 'flex', gap: 0 }}>
                                                                            {/* Cover art with play overlay */}
                                                                            <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                                                                                {post.track.coverUrl
                                                                                    ? <img src={post.track.coverUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                                                    : <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={24} color={SUB} /></div>
                                                                                }
                                                                                <button onClick={playHandler} style={{ position: 'absolute', inset: 0, background: trackPlaying ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.5)', border: 'none', cursor: trackUrl ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: trackPlaying ? PRIMARY : 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                                                                                        {trackPlaying
                                                                                            ? <Pause size={14} color="#fff" fill="#fff" />
                                                                                            : <Play  size={14} color="#111" fill="#111" style={{ marginLeft: 2 }} />}
                                                                                    </div>
                                                                                </button>
                                                                                {/* Active pulse ring */}
                                                                                {trackPlaying && <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 2px ${PRIMARY}`, pointerEvents: 'none' }} />}
                                                                            </div>

                                                                            {/* Right: title + waveform */}
                                                                            <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                                <div>
                                                                                    <div style={{ fontSize: 13, fontWeight: 700, color: trackPlaying ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.track.title}</div>
                                                                                    <div style={{ fontSize: 11, color: SUB, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</span>
                                                                                        {post.track.duration && <span style={{ flexShrink: 0, color: `${SUB}99` }}>{fmtDur(post.track.duration)}</span>}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Waveform */}
                                                                                <div style={{ flex: 1, minHeight: 36, cursor: trackUrl ? 'pointer' : 'default' }} onClick={playHandler}>
                                                                                    {peaks.length > 0 ? (
                                                                                        <svg width="100%" height="36" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 36`} style={{ display: 'block' }}>
                                                                                            {peaks.map((peak: number, i: number) => {
                                                                                                const h = Math.max(2, peak * 28); const y = (36 - h) / 2;
                                                                                                const played = isActiveTrack && (i / peaks.length) < trackProgress;
                                                                                                return <rect key={i} x={i} y={y} width={0.7} height={h} fill={played ? PRIMARY : 'rgba(255,255,255,0.18)'} rx={0.3} />;
                                                                                            })}
                                                                                        </svg>
                                                                                    ) : (() => {
                                                                                        let h = 5381;
                                                                                        for (const c of post.track.id) h = (h * 33 ^ c.charCodeAt(0)) >>> 0;
                                                                                        return (
                                                                                            <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: '1.5px', overflow: 'hidden' }}>
                                                                                                {Array.from({ length: 80 }, (_, i) => {
                                                                                                    h = (h * 1664525 + 1013904223) >>> 0;
                                                                                                    const ht = 15 + (h % 65);
                                                                                                    const played = isActiveTrack && (i / 80) < trackProgress;
                                                                                                    return <div key={i} style={{ flex: 1, height: `${ht}%`, borderRadius: 9999, background: played ? PRIMARY : 'rgba(255,255,255,0.18)' }} />;
                                                                                                })}
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Footer row */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                                                                <Link to={`/preview/alt_f_genre_post/${post.id}`}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, color: SUB, fontSize: 11, fontWeight: 700, textDecoration: 'none', padding: '5px 11px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.15s' }}
                                                                    onMouseEnter={ev => { ev.currentTarget.style.color = accent; ev.currentTarget.style.borderColor = `${accent}44`; ev.currentTarget.style.background = `${accent}12`; }}
                                                                    onMouseLeave={ev => { ev.currentTarget.style.color = SUB; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                                                                    <MessageSquare size={12} />
                                                                    {post.commentCount ?? 0}
                                                                    <span style={{ color: `${SUB}99`, fontWeight: 500 }}>{(post.commentCount ?? 0) === 1 ? 'reply' : 'replies'}</span>
                                                                </Link>
                                                                <div style={{ flex: 1 }} />
                                                                <Link to={`/preview/alt_f_genre_post/${post.id}`}
                                                                    style={{ fontSize: 11, fontWeight: 700, color: accent, textDecoration: 'none', opacity: 0.85 }}
                                                                    onMouseEnter={ev => (ev.currentTarget.style.opacity = '1')}
                                                                    onMouseLeave={ev => (ev.currentTarget.style.opacity = '0.85')}>
                                                                    Open →
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Load more */}
                                            {genreFeedHasMore && (
                                                <button onClick={() => fetchGenreFeed(genreFeedSort, genreFeedCursor, true)}
                                                    disabled={genreFeedLoading}
                                                    style={{ padding: '10px 24px', borderRadius: 10, background: S_HIGH, border: `1px solid ${BORDER}`, color: TEXT, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: genreFeedLoading ? 0.5 : 1 }}>
                                                    {genreFeedLoading ? 'Loading…' : 'Load more'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Subscribe nudge when showing all genres */}
                                    {!genreHasSubs && genrePosts.length > 0 && (
                                        <div style={{ marginTop: 16, padding: '12px 16px', background: `${PRIMARY}0d`, border: `1px solid ${PRIMARY}33`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                            <span style={{ fontSize: 12, color: SUB }}>Subscribe to genres to see a personalised feed.</span>
                                            <Link to="/preview/alt_f_genres"
                                                style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textDecoration: 'none', flexShrink: 0 }}>
                                                Browse Genres →
                                            </Link>
                                        </div>
                                    )}
                                </section>

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
