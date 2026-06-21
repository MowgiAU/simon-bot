/**
 * Alt F — Artists directory (/preview/alt_f_artists)
 * Browse and search all Fuji Studio artists. Genre filters, sort, featured leaderboard.
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, S_HIGHEST,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { Search, Play, Users, Music, TrendingUp, Star, X } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const fmtNum = (n?: number) => {
    n = n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
};

function avatarGradient(username: string): string {
    let h = 5381;
    for (let i = 0; i < username.length; i++) h = (h * 33 ^ username.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `linear-gradient(135deg, hsl(${hue},40%,18%) 0%, hsl(${(hue + 40) % 360},50%,22%) 100%)`;
}

const SORTS = [
    { key: 'popular', label: 'Most Plays' },
    { key: 'newest',  label: 'Newest' },
    { key: 'oldest',  label: 'Oldest' },
] as const;
type SortKey = typeof SORTS[number]['key'];

export const FrontpageAltFArtists: React.FC = () => {
    const { player, setTrack } = usePlayer();

    const [profiles, setProfiles] = useState<any[]>([]);
    const [featured, setFeatured] = useState<any[]>([]);
    const [genres, setGenres] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [sort, setSort] = useState<SortKey>('popular');
    const [activeGenre, setActiveGenre] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let on = true;
        Promise.all([
            axios.get('/api/musician/profiles?sort=popular&limit=200').catch(() => ({ data: [] })),
            axios.get('/api/musician/leaderboards/artists').catch(() => ({ data: [] })),
            axios.get('/api/musician/genres').catch(() => ({ data: [] })),
        ]).then(([pRes, lRes, gRes]) => {
            if (!on) return;
            setProfiles(arr(pRes.data));
            setFeatured(arr(lRes.data).slice(0, 4));
            const gs = arr(gRes.data);
            // Only show genres with at least one profile
            setGenres(gs.filter((g: any) => (g._count?.profiles || 0) > 0).slice(0, 30));
            setLoading(false);
        });
        return () => { on = false; };
    }, []);

    const sorted = useMemo(() => {
        let list = [...profiles];
        if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        else if (sort === 'oldest') list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        else list.sort((a, b) => (b.totalPlays || 0) - (a.totalPlays || 0));
        return list;
    }, [profiles, sort]);

    const filtered = useMemo(() => {
        let list = sorted;
        if (activeGenre) {
            list = list.filter((p: any) =>
                (p.genres || []).some((g: any) => g.genre?.name === activeGenre || g.genre?.slug === activeGenre)
                || p.primaryGenre?.name === activeGenre
            );
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((p: any) =>
                (p.displayName || '').toLowerCase().includes(q)
                || (p.username || '').toLowerCase().includes(q)
                || (p.bio || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [sorted, activeGenre, search]);

    const playTopTrack = (profile: any) => {
        const track = profile.tracks?.[0];
        if (!track) return;
        setTrack({
            id: track.id,
            title: track.title,
            artist: profile.displayName || profile.username,
            url: track.url,
            coverUrl: track.coverUrl || profile.avatar || profile.avatarUrl,
        });
    };

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Artists" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Artists' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── HERO ── */}
                    <section style={{
                        position: 'relative', width: '100%', height: 400,
                        overflow: 'hidden', borderBottom: `1px solid ${BORDER}`,
                    }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1f3a 0%, #1a0a3a 50%, #0f131d 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.3) 60%, transparent 100%)' }} />

                        {/* Decorative floating circles */}
                        {[
                            { size: 300, x: '5%', y: '-30%', color: `${SECONDARY}08` },
                            { size: 200, x: '70%', y: '10%', color: `${PRIMARY}08` },
                            { size: 150, x: '85%', y: '50%', color: `${TERTIARY}06` },
                        ].map((c, i) => (
                            <div key={i} style={{
                                position: 'absolute', width: c.size, height: c.size,
                                left: c.x, top: c.y,
                                borderRadius: '50%',
                                background: c.color,
                                border: `1px solid ${c.color}`,
                                filter: 'blur(1px)',
                            }} />
                        ))}

                        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <span style={{ background: `${SECONDARY}22`, border: `1px solid ${SECONDARY}55`, color: SECONDARY, padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Users size={11} /> {loading ? '…' : fmtNum(profiles.length)} Artists
                                    </span>
                                </div>
                                <h1 style={{ margin: '0 0 12px', fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>
                                    Discover Artists
                                </h1>
                                <p style={{ margin: '0 0 28px', color: 'rgba(159,166,185,0.85)', fontSize: 16, maxWidth: 480, lineHeight: 1.6 }}>
                                    Explore the Fuji Studio community — FL Studio producers from around the world.
                                </p>

                                {/* Search bar */}
                                <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
                                    <Search size={16} color={SUB} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search artists, genres, gear…"
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            padding: '14px 40px 14px 44px',
                                            background: 'rgba(28,31,42,0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                                            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
                                            color: TEXT, fontSize: 14, outline: 'none', fontFamily: FONT,
                                        }}
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}>
                                            <X size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {loading ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading artists…</div>
                    ) : (
                        <>
                        {/* ── BODY GRID ── */}
                        <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                            {/* ── LEFT COLUMN ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* Sort card */}
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <TrendingUp size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sort By</h3>
                                    </div>
                                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {SORTS.map(s => (
                                            <button
                                                key={s.key}
                                                onClick={() => setSort(s.key)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                                    background: sort === s.key ? `${PRIMARY}18` : 'transparent',
                                                    color: sort === s.key ? PRIMARY : SUB,
                                                    fontSize: 13, fontWeight: sort === s.key ? 700 : 400,
                                                    fontFamily: FONT, textAlign: 'left', transition: 'all 0.15s',
                                                }}
                                            >
                                                {s.label}
                                                {sort === s.key && <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY }} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Genre filter card */}
                                {genres.length > 0 && (
                                    <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Music size={14} color={PRIMARY} />
                                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Genre</h3>
                                            </div>
                                            {activeGenre && (
                                                <button onClick={() => setActiveGenre(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: FONT }}>
                                                    <X size={12} /> Clear
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
                                            {genres.map((g: any) => {
                                                const active = activeGenre === g.name;
                                                return (
                                                    <button
                                                        key={g.id}
                                                        onClick={() => setActiveGenre(active ? null : g.name)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                                            background: active ? `${SECONDARY}18` : 'transparent',
                                                            color: active ? SECONDARY : SUB,
                                                            fontSize: 13, fontWeight: active ? 700 : 400,
                                                            fontFamily: FONT, textAlign: 'left', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {g.name}
                                                        <span style={{ fontSize: 11, color: active ? SECONDARY : 'rgba(154,163,178,0.5)' }}>
                                                            {g._count?.profiles || 0}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Stats card */}
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Star size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Overview</h3>
                                    </div>
                                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {[
                                            { label: 'Total Artists', value: fmtNum(profiles.length), color: TEXT },
                                            { label: 'Genres', value: String(genres.length), color: SECONDARY },
                                            { label: 'Showing', value: filtered.length === profiles.length ? 'All' : String(filtered.length), color: PRIMARY },
                                        ].map(stat => (
                                            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 13, color: SUB }}>{stat.label}</span>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>

                            {/* ── RIGHT COLUMN ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                                {/* Featured artists — only show if no filter active */}
                                {featured.length > 0 && !activeGenre && !search && (
                                    <section>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Featured Artists</h2>
                                            <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>Top by plays</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                                            {featured.map((f: any, i: number) => {
                                                const profile = f.profile || f;
                                                const name = profile.displayName || profile.username || f.username;
                                                const username = profile.username || f.username;
                                                const avatar = profile.avatar || profile.avatarUrl || f.avatar || f.avatarUrl;
                                                const banner = profile.bannerUrl || f.bannerUrl;
                                                const plays = profile.totalPlays || f.totalPlays || 0;
                                                const genreList = (profile.genres || f.genres || []).map((g: any) => g.genre?.name || g.name).filter(Boolean).slice(0, 1);
                                                const rankColors = [PRIMARY, SECONDARY, TERTIARY, SUB];
                                                return (
                                                    <Link
                                                        key={profile.id || i}
                                                        to="/preview/alt_f_artist"
                                                        style={{
                                                            ...glass, borderRadius: 20, overflow: 'hidden',
                                                            display: 'flex', flexDirection: 'column',
                                                            transition: 'border-color 0.2s, transform 0.15s',
                                                            textDecoration: 'none', color: 'inherit',
                                                        }}
                                                        onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.borderColor = `${PRIMARY}66`; (ev.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                                                        onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (ev.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                                                    >
                                                        {/* Banner / avatar top */}
                                                        <div style={{ height: 72, position: 'relative', background: banner ? 'transparent' : avatarGradient(username || String(i)) }}>
                                                            {banner && <img src={banner} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />}
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(15,19,29,0.7) 100%)' }} />
                                                            {/* Rank badge */}
                                                            <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                                                <span style={{ background: `${rankColors[i]}22`, border: `1px solid ${rankColors[i]}55`, color: rankColors[i], padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 800 }}>
                                                                    #{i + 1}
                                                                </span>
                                                            </div>
                                                            {/* Avatar */}
                                                            <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)' }}>
                                                                {avatar
                                                                    ? <img src={avatar} referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${BG}`, objectFit: 'cover', display: 'block' }} />
                                                                    : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${BG}`, background: avatarGradient(username || String(i)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>
                                                                        {(name || '?')[0].toUpperCase()}
                                                                    </div>
                                                                }
                                                            </div>
                                                        </div>

                                                        <div style={{ padding: '28px 14px 16px', textAlign: 'center' }}>
                                                            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                                            <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>@{username}</div>
                                                            {genreList.length > 0 && (
                                                                <span style={{ padding: '2px 8px', borderRadius: 4, background: `${SECONDARY}20`, border: `1px solid ${SECONDARY}40`, fontSize: 10, color: SECONDARY, fontWeight: 600 }}>
                                                                    {genreList[0]}
                                                                </span>
                                                            )}
                                                            <div style={{ marginTop: 10, fontSize: 11, color: SUB }}>{fmtNum(plays)} plays</div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* All artists grid */}
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                                            {activeGenre ? activeGenre : search ? 'Search Results' : 'All Artists'}
                                        </h2>
                                        <span style={{ fontSize: 13, color: SUB }}>
                                            {filtered.length} {filtered.length === 1 ? 'artist' : 'artists'}
                                        </span>
                                    </div>

                                    {filtered.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                            <Users size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No artists found</div>
                                            <div style={{ fontSize: 13, color: SUB }}>Try a different search or genre filter</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                            {filtered.map((profile: any) => {
                                                const name = profile.displayName || profile.username;
                                                const genreList = (profile.genres || []).map((g: any) => g.genre?.name).filter(Boolean).slice(0, 2);
                                                const topTrack = profile.tracks?.[0];
                                                const hasTrack = !!topTrack?.url;
                                                return (
                                                    <Link
                                                        key={profile.id}
                                                        to="/preview/alt_f_artist"
                                                        style={{
                                                            ...glass, borderRadius: 20, overflow: 'hidden',
                                                            display: 'flex', flexDirection: 'column',
                                                            transition: 'border-color 0.2s, transform 0.15s',
                                                            textDecoration: 'none', color: 'inherit',
                                                        }}
                                                        onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.borderColor = `${PRIMARY}66`; (ev.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                                                        onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (ev.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                                                    >
                                                        {/* Banner top */}
                                                        <div style={{ height: 68, position: 'relative', background: profile.bannerUrl ? 'transparent' : avatarGradient(profile.username) }}>
                                                            {profile.bannerUrl && (
                                                                <img src={profile.bannerUrl} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                                                            )}
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,19,29,0.8) 100%)' }} />
                                                            {/* Avatar */}
                                                            <div style={{ position: 'absolute', bottom: -18, left: 16 }}>
                                                                {(profile.avatar || profile.avatarUrl)
                                                                    ? <img src={profile.avatar || profile.avatarUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${BG}`, objectFit: 'cover', display: 'block' }} />
                                                                    : <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${BG}`, background: avatarGradient(profile.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>
                                                                        {(name || '?')[0].toUpperCase()}
                                                                    </div>
                                                                }
                                                            </div>
                                                            {/* Play button */}
                                                            {hasTrack && (
                                                                <div style={{ position: 'absolute', bottom: -18, right: 16 }}>
                                                                    <button
                                                                        onClick={e => { e.stopPropagation(); playTopTrack(profile); }}
                                                                        style={{ width: 34, height: 34, borderRadius: '50%', background: PRIMARY, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${PRIMARY}55` }}
                                                                    >
                                                                        <Play size={14} fill="#fff" color="#fff" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Card body */}
                                                        <div style={{ padding: '24px 16px 16px' }}>
                                                            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                                            <div style={{ fontSize: 12, color: SUB, marginBottom: profile.bio ? 6 : 10 }}>@{profile.username}</div>

                                                            {profile.bio && (
                                                                <div style={{ fontSize: 12, color: SUB, lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                    {profile.bio}
                                                                </div>
                                                            )}

                                                            {genreList.length > 0 && (
                                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                                                                    {genreList.map((g: string) => (
                                                                        <span key={g} style={{ padding: '2px 8px', borderRadius: 4, background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}35`, fontSize: 10, color: SECONDARY, fontWeight: 600 }}>{g}</span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: SUB, borderTop: `1px solid ${DIVIDER}`, paddingTop: 10 }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <Play size={11} /> {fmtNum(profile.totalPlays)}
                                                                </span>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <Music size={11} /> {(profile.tracks || []).length} tracks
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

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
