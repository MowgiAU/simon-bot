/**
 * Alt F — My Favourites (/preview/alt_f_favourites)
 * Auth-gated list of liked tracks. Sort, play, unfavourite.
 * APIs: GET /api/my-favourites, POST /api/tracks/:id/favourite
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Heart, Play, Pause, Music, Lock, SortAsc,
    TrendingUp, Clock, Search, X,
} from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const fmtDur  = (s?: number | null) => { if (!s || !isFinite(s)) return '—'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const fmtNum  = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type SortKey = 'newest' | 'oldest' | 'plays' | 'az';

const SORTS: { key: SortKey; label: string; icon: React.ElementType }[] = [
    { key: 'newest', label: 'Newest First', icon: Clock },
    { key: 'plays',  label: 'Most Played',  icon: TrendingUp },
    { key: 'az',     label: 'A – Z',        icon: SortAsc },
    { key: 'oldest', label: 'Oldest First', icon: Clock },
];

interface Track {
    id: string; title: string; slug?: string; url: string | null;
    coverUrl: string | null; duration: number | null;
    playCount: number; bpm: number | null; key: string | null;
    createdAt: string; likedAt?: string;
    genres?: { genre: { name: string } }[];
    profile?: { username: string; displayName?: string | null; avatar?: string | null };
}

export const FrontpageAltFFavourites: React.FC = () => {
    const { player, setTrack: playTrack, togglePlay } = usePlayer();
    const { user, loading: authLoading } = useAuth();

    const [tracks,   setTracks]   = useState<Track[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [hoverId,  setHoverId]  = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [search,   setSearch]   = useState('');
    const [sort,     setSort]     = useState<SortKey>('newest');

    const load = useCallback(() => {
        if (!user?.id) return;
        setLoading(true);
        axios.get('/api/my-favourites', { withCredentials: true })
            .then(r => { setTracks(r.data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user?.id]);

    useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

    const unfavourite = async (id: string) => {
        if (removing) return;
        setRemoving(id);
        setTracks(prev => prev.filter(t => t.id !== id));
        try {
            await axios.post(`/api/tracks/${id}/favourite`, {}, { withCredentials: true });
        } catch {
            load();
        } finally { setRemoving(null); }
    };

    const handlePlay = (t: Track) => {
        if (!t.url) return;
        if (player.currentTrack?.id === t.id) { togglePlay(); return; }
        const queue = displayed
            .filter(tr => tr.url)
            .map(tr => ({
                id: tr.id, title: tr.title,
                artist: tr.profile?.displayName || tr.profile?.username || '',
                url: tr.url!, coverUrl: tr.coverUrl,
            }));
        const idx = queue.findIndex(q => q.id === t.id);
        playTrack(queue[idx] ?? queue[0], queue);
    };

    const isPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    const sorted = useMemo(() => {
        const out = [...tracks];
        switch (sort) {
            case 'newest': return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            case 'oldest': return out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            case 'plays':  return out.sort((a, b) => b.playCount - a.playCount);
            case 'az':     return out.sort((a, b) => a.title.localeCompare(b.title));
        }
    }, [tracks, sort]);

    const displayed = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter(t =>
            t.title.toLowerCase().includes(q)
            || (t.profile?.displayName || '').toLowerCase().includes(q)
            || (t.profile?.username || '').toLowerCase().includes(q)
        );
    }, [sorted, search]);

    const totalPlays = tracks.reduce((s, t) => s + t.playCount, 0);

    const topGenre = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const t of tracks) {
            for (const g of t.genres || []) {
                const name = g.genre?.name;
                if (name) counts[name] = (counts[name] || 0) + 1;
            }
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    }, [tracks]);

    if (!authLoading && !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
                <AltSidebar />
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <AltHeader breadcrumb={[{ label: 'Favourites' }]} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <Lock size={36} color={SUB} />
                        <div style={{ fontSize: 16, fontWeight: 600 }}>Sign in to see your liked tracks</div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Favourites' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── HEADER BAND ── */}
                    <section style={{ position: 'relative', borderBottom: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a0a1a 0%, #2a0a0a 40%, #0f131d 100%)' }} />
                        {[...Array(5)].map((_, i) => (
                            <div key={i} style={{ position: 'absolute', width: 1, height: 1, left: `${10 + i * 18}%`, top: '50%', boxShadow: `0 0 ${55 + i * 12}px ${24 + i * 8}px ${i % 2 === 0 ? `${TERTIARY}08` : `${PRIMARY}06`}`, borderRadius: '50%' }} />
                        ))}
                        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '40px 32px 36px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                    <Heart size={28} color={TERTIARY} fill={TERTIARY} />
                                    <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>My Favourites</h1>
                                </div>
                                <p style={{ margin: 0, color: SUB, fontSize: 14 }}>
                                    {loading ? 'Loading…' : `${tracks.length} liked track${tracks.length !== 1 ? 's' : ''} · ${fmtNum(totalPlays)} total plays`}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 20 }}>
                                {[
                                    { label: 'Liked',   value: String(tracks.length), color: TERTIARY  },
                                    { label: 'Plays',   value: fmtNum(totalPlays),    color: PRIMARY   },
                                    { label: 'Top Genre', value: topGenre,            color: SECONDARY },
                                ].map(s => (
                                    <div key={s.label} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: s.label === 'Top Genre' ? 16 : 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── BODY GRID ── */}
                    <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                        {/* ── LEFT ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Sort */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <SortAsc size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sort By</h3>
                                </div>
                                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {SORTS.map(s => {
                                        const Icon = s.icon;
                                        const active = sort === s.key;
                                        return (
                                            <button key={s.key} onClick={() => setSort(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: active ? `${PRIMARY}14` : 'transparent', color: active ? PRIMARY : SUB, fontSize: 13, fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                                                <Icon size={13} color={active ? PRIMARY : SUB} />
                                                {s.label}
                                                {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: PRIMARY }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Overview</h3>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { label: 'Total Liked',  value: String(tracks.length), color: TEXT     },
                                        { label: 'Total Plays',  value: fmtNum(totalPlays),     color: PRIMARY  },
                                        { label: 'Top Genre',    value: topGenre,               color: SECONDARY },
                                        { label: 'Showing',      value: search ? `${displayed.length} results` : 'All', color: SUB },
                                    ].map(s => (
                                        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, color: SUB }}>{s.label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Discover more */}
                            <div style={{ ...glass, borderRadius: 20, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Music size={16} color={PRIMARY} />
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>Discover More</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.5 }}>
                                    Find new tracks to love in the Library or browse by artist.
                                </p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Link to="/preview/alt_f_library" style={{ flex: 1, padding: '9px', background: PRIMARY, borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                                        Library
                                    </Link>
                                    <Link to="/preview/alt_f_artists" style={{ flex: 1, padding: '9px', background: S_CONT, borderRadius: 8, color: TEXT, fontSize: 12, fontWeight: 600, border: `1px solid rgba(255,255,255,0.08)`, textDecoration: 'none', textAlign: 'center' }}>
                                        Artists
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT ── */}
                        <div>
                            {/* Header + search */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: 1 }}>
                                    {search ? `Results for "${search}"` : 'Liked Tracks'}
                                </h2>
                                {/* Search */}
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} color={SUB} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search…"
                                        style={{ padding: '7px 30px 7px 30px', background: 'rgba(28,31,42,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT, width: 180 }}
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}>
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <span style={{ fontSize: 13, color: SUB, whiteSpace: 'nowrap' }}>
                                    {displayed.length} track{displayed.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {loading ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center', color: SUB }}>Loading…</div>
                            ) : displayed.length === 0 && tracks.length === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                    <Heart size={36} color={SUB} style={{ marginBottom: 14 }} />
                                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No liked tracks yet</div>
                                    <div style={{ fontSize: 13, color: SUB, marginBottom: 20 }}>Heart tracks while listening to save them here.</div>
                                    <Link to="/preview/alt_f_library" style={{ padding: '9px 24px', background: PRIMARY, borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                                        Browse Library
                                    </Link>
                                </div>
                            ) : displayed.length === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                    <Search size={32} color={SUB} style={{ marginBottom: 12 }} />
                                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No results</div>
                                    <div style={{ fontSize: 13, color: SUB }}>Try a different search term.</div>
                                </div>
                            ) : (
                                <div style={{ ...glass, borderRadius: 20, overflowX: 'auto' }}>
                                    {/* Table header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '44px 44px 1fr 110px 52px 60px 68px 40px', padding: '10px 20px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}`, alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>#</div>
                                        <div />
                                        <div>Title</div>
                                        <div>Genre</div>
                                        <div style={{ textAlign: 'center' }}>BPM</div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Clock size={10} style={{ verticalAlign: 'middle' }} />
                                        </div>
                                        <div style={{ textAlign: 'right' }}>Plays</div>
                                        <div />
                                    </div>

                                    {displayed.map((t, i) => {
                                        const playing = isPlaying(t.id);
                                        const hovered = hoverId === t.id;
                                        const isLast  = i === displayed.length - 1;
                                        const genre   = t.genres?.[0]?.genre?.name;
                                        const artist  = t.profile?.displayName || t.profile?.username || '';

                                        return (
                                            <div
                                                key={t.id}
                                                onMouseEnter={() => setHoverId(t.id)}
                                                onMouseLeave={() => setHoverId(null)}
                                                style={{ display: 'grid', gridTemplateColumns: '44px 44px 1fr 110px 52px 60px 68px 40px', padding: '10px 20px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`, alignItems: 'center', background: playing ? `${PRIMARY}08` : hovered ? 'rgba(38,42,53,0.35)' : 'transparent', transition: 'background 0.1s' }}
                                            >
                                                {/* Position / play */}
                                                <div style={{ textAlign: 'center' }}>
                                                    {hovered && t.url ? (
                                                        <button onClick={() => handlePlay(t)} style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                            {playing ? <Pause size={14} color={PRIMARY} fill={PRIMARY} /> : <Play size={14} color={TEXT} fill={TEXT} />}
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: 13, color: playing ? PRIMARY : SUB, fontWeight: playing ? 700 : 400 }}>{i + 1}</span>
                                                    )}
                                                </div>

                                                {/* Cover */}
                                                <div onClick={() => handlePlay(t)} style={{ cursor: t.url ? 'pointer' : 'default' }}>
                                                    {t.coverUrl
                                                        ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                                                        : <div style={{ width: 36, height: 36, borderRadius: 6, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={SUB} /></div>
                                                    }
                                                </div>

                                                {/* Title + artist */}
                                                <div style={{ minWidth: 0, paddingRight: 8 }}>
                                                    <div style={{ fontSize: 14, fontWeight: playing ? 700 : 600, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{t.title}</div>
                                                    {artist && <div style={{ fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</div>}
                                                </div>

                                                {/* Genre */}
                                                <div>
                                                    {genre && (
                                                        <span style={{ padding: '3px 7px', borderRadius: 4, background: `${SECONDARY}15`, border: `1px solid ${SECONDARY}30`, fontSize: 10, color: SECONDARY, fontWeight: 600, whiteSpace: 'nowrap' }}>{genre}</span>
                                                    )}
                                                </div>

                                                {/* BPM */}
                                                <div style={{ textAlign: 'center', fontSize: 12, color: t.bpm ? TEXT : `${SUB}66`, fontWeight: t.bpm ? 600 : 400 }}>
                                                    {t.bpm || '—'}
                                                </div>

                                                {/* Duration */}
                                                <div style={{ textAlign: 'right', fontSize: 12, color: SUB, fontVariantNumeric: 'tabular-nums' }}>
                                                    {fmtDur(t.duration)}
                                                </div>

                                                {/* Plays */}
                                                <div style={{ textAlign: 'right', fontSize: 12, color: SUB }}>
                                                    {fmtNum(t.playCount)}
                                                </div>

                                                {/* Unfavourite */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => unfavourite(t.id)}
                                                        title="Remove from favourites"
                                                        disabled={removing === t.id}
                                                        style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: removing === t.id ? 0.4 : 1, transition: 'all 0.15s', color: hovered ? TERTIARY : `${TERTIARY}88` }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = `${TERTIARY}18`; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                                    >
                                                        <Heart size={14} fill={hovered ? TERTIARY : 'none'} color={hovered ? TERTIARY : `${TERTIARY}88`} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
