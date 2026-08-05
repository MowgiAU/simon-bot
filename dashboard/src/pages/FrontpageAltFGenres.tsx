/**
 * Alt F — Genres (/genres, /genres/:slug, ?g=slug1,slug2)
 *
 * Genres are tags on tracks, not communities: this page is a browser for them.
 * The grid lists every genre; opening one plays its tracks in the shorts feed —
 * full-screen on phones, framed in the centre column on desktop.
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr, CONTENT_MAX,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import { TrackFeed } from '../components/altshell/trackfeed/TrackFeed';
import { Music, Search, X, TrendingUp, Users } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };

function genreColor(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `linear-gradient(135deg, hsl(${hue},35%,14%) 0%, hsl(${(hue + 50) % 360},45%,18%) 100%)`;
}
function genreAccent(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

interface Genre {
    id: string; name: string; slug: string; parentId: string | null;
    _count: { tracks: number; profiles: number; subscriptions: number };
    children: Genre[];
}

export const FrontpageAltFGenres: React.FC = () => {
    const location = useLocation();
    const bp = useAltBreakpoint();
    const isPhone = bp === 'xs';
    const { player } = usePlayer();

    const { genreSlug, multiSlugs } = useMemo(() => {
        const segments = location.pathname.replace('/genres', '').split('/').filter(Boolean);
        const sp = new URLSearchParams(location.search);
        return {
            genreSlug: segments[0] || null,
            multiSlugs: sp.get('g')?.split(',').filter(Boolean) || [],
        };
    }, [location]);

    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        axios.get('/api/musician/genres')
            .then(r => { setGenres(arr(r.data)); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const allGenres = useMemo(() => {
        const flat: Genre[] = [];
        const walk = (gs: Genre[]) => gs.forEach(g => { flat.push(g); walk(g.children || []); });
        walk(genres);
        return flat;
    }, [genres]);

    const topLevel = useMemo(() => genres.filter(g => !g.parentId), [genres]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return topLevel;
        return topLevel.filter(g => g.name.toLowerCase().includes(q) || (g.children || []).some(c => c.name.toLowerCase().includes(q)));
    }, [topLevel, search]);

    // Slugs come straight from the URL — the feed API resolves them, so the feed
    // never waits on the genre list to load.
    const feedSlugs = multiSlugs.length > 0 ? multiSlugs.join(',') : genreSlug;
    const activeGenre = genreSlug ? allGenres.find(g => g.slug === genreSlug) : null;
    const feedTitle = multiSlugs.length > 1
        ? `${multiSlugs.length} genres`
        : (activeGenre?.name || genreSlug || 'Genres');

    useEffect(() => {
        document.title = feedSlugs ? `${feedTitle} | Fuji Studio` : 'Fuji Studio | Genres';
    }, [feedSlugs, feedTitle]);

    const totalTracks = topLevel.reduce((s, g) => s + (g._count?.tracks || 0), 0);
    const totalArtists = topLevel.reduce((s, g) => s + (g._count?.profiles || 0), 0);
    const pb = player.currentTrack ? 90 : 0;

    // ── A genre opens as a feed of its tracks ─────────────────────────────────
    if (feedSlugs) {
        if (isPhone) {
            return (
                <div style={{ background: '#06080e', color: TEXT, fontFamily: FONT, minHeight: '100vh' }}>
                    <TrackFeed
                        params={{ genre: feedSlugs }}
                        title={feedTitle}
                        backTo="/genres"
                        createLink="/upload"
                        emptyMessage={`No tracks tagged ${feedTitle} yet.`}
                    />
                    <AltSidebar active="Genres" />
                </div>
            );
        }
        return (
            <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
                <AltSidebar active="Genres" />
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <AltHeader breadcrumb={[{ label: 'Genres', to: '/genres' }, { label: feedTitle }]} />
                    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: pb }}>
                            <TrackFeed
                                variant="desktop"
                                params={{ genre: feedSlugs }}
                                emptyMessage={`No tracks tagged ${feedTitle} yet.`}
                            />
                        </div>
                        <AltActivitySidebar />
                    </div>
                </main>
            </div>
        );
    }

    // ── Genre grid ────────────────────────────────────────────────────────────
    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Genres" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Genres' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: pb }}>

                        {/* Hero */}
                        <section style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a3a 0%, #1a0a2a 40%, #0f131d 100%)' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.2) 70%, transparent 100%)' }} />
                            {topLevel.slice(0, 8).map((g, i) => (
                                <div key={g.id} style={{ position: 'absolute', width: 1, height: 1, left: `${8 + i * 12}%`, top: `${20 + (i % 3) * 25}%`, boxShadow: `0 0 ${60 + i * 10}px ${28 + i * 6}px ${genreAccent(g.name)}12`, borderRadius: '50%' }} />
                            ))}
                            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ maxWidth: CONTENT_MAX, width: '100%', padding: '0 32px 20px', textAlign: 'center', boxSizing: 'border-box' }}>
                                    <h1 style={{ margin: '0 0 6px', fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
                                        Explore Genres
                                    </h1>
                                    <p style={{ margin: 0, fontSize: 14, color: SUB }}>
                                        Pick a genre and play everything in it.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '24px 32px 48px', boxSizing: 'border-box' }}>

                            {/* Search */}
                            <div style={{ position: 'relative', marginBottom: 20, maxWidth: 420 }}>
                                <Search size={15} color={SUB} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search genres…"
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 36px', background: 'rgba(15,19,29,0.7)', border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none' }}
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} aria-label="Clear search"
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, display: 'flex' }}>
                                        <X size={15} />
                                    </button>
                                )}
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                                {[
                                    { label: 'Genres', value: topLevel.length, icon: Music, color: PRIMARY },
                                    { label: 'Total Tracks', value: totalTracks, icon: TrendingUp, color: SECONDARY },
                                    { label: 'Artists', value: totalArtists, icon: Users, color: TERTIARY },
                                ].map(s => {
                                    const Icon = s.icon;
                                    return (
                                        <div key={s.label} style={{ ...glass, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon size={13} color={s.color} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 900, color: s.color, lineHeight: 1 }}>{fmtNum(s.value)}</div>
                                                <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{s.label}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Grid */}
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: SUB }}><AltSpinner /></div>
                            ) : filtered.length === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                    <Search size={32} color={SUB} style={{ marginBottom: 12 }} />
                                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No genres found</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                                    {filtered.map(g => {
                                        const accent = genreAccent(g.name);
                                        return (
                                            <Link key={g.id} to={`/genres/${g.slug}`}
                                                style={{ ...glass, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', transition: 'all 0.18s' }}
                                                onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${accent}55`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'none'; }}>
                                                <div style={{ height: 72, background: genreColor(g.name), position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,19,29,0.6) 100%)' }} />
                                                    <Music size={30} color={`${accent}30`} strokeWidth={1.5} />
                                                    <div style={{ position: 'absolute', bottom: 8, left: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Music size={12} color={accent} />
                                                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{g.name}</span>
                                                    </div>
                                                </div>
                                                <div style={{ padding: '12px 14px 14px' }}>
                                                    <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 15, fontWeight: 900, color: accent, lineHeight: 1 }}>{fmtNum(g._count?.tracks)}</div>
                                                            <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Tracks</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 15, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{fmtNum(g._count?.profiles)}</div>
                                                            <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Artists</div>
                                                        </div>
                                                    </div>
                                                    {g.children.length > 0 && (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                            {g.children.slice(0, 5).map(c => {
                                                                const cAccent = genreAccent(c.name);
                                                                return (
                                                                    <Link key={c.id} to={`/genres/${c.slug}`}
                                                                        onClick={e => e.stopPropagation()}
                                                                        style={{ padding: '2px 8px', borderRadius: 9999, background: `${cAccent}15`, border: `1px solid ${cAccent}33`, color: cAccent, fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>
                                                                        {c.name}
                                                                    </Link>
                                                                );
                                                            })}
                                                            {g.children.length > 5 && (
                                                                <span style={{ fontSize: 10, color: SUB, alignSelf: 'center', flexShrink: 0 }}>+{g.children.length - 5} more</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
