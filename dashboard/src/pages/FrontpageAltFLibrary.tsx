/**
 * Alt F — Library / browse all tracks (/preview/alt_f_library)
 * Wired to the "Search" nav item in AltSidebar.
 * Server-side sort + genre filter; client-side search overlay.
 */
import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { Play, Pause, Search, X, Music, TrendingUp, Clock, SortAsc, Library, Filter } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return '—'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };

const SORTS = [
    { key: 'newest',       label: 'Newest First',  icon: Clock },
    { key: 'plays',        label: 'Most Played',   icon: TrendingUp },
    { key: 'alphabetical', label: 'A – Z',          icon: SortAsc },
    { key: 'oldest',       label: 'Oldest First',  icon: Clock },
] as const;
type SortKey = typeof SORTS[number]['key'];

export const FrontpageAltFLibrary: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const navigate = useNavigate();

    const [tracks, setTracks]         = useState<any[]>([]);
    const [genres, setGenres]         = useState<any[]>([]);
    const [loading, setLoading]       = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [total, setTotal]           = useState(0);

    const [sort, setSort]             = useState<SortKey>('newest');
    const [activeGenre, setActiveGenre] = useState<string | null>(null);
    const [search, setSearch]         = useState('');
    const searchRef                   = useRef<HTMLInputElement>(null);

    // Fetch tracks from server when sort or genre changes
    useEffect(() => {
        let on = true;
        setLoading(true);
        const params: Record<string, string> = { sort, limit: '50' };
        if (activeGenre) params.genre = activeGenre;

        axios.get('/api/discovery/tracks', { params }).then(r => {
            if (!on) return;
            const data = arr(r.data);
            setTracks(data);
            setTotal(data.length);
            setLoading(false);
        }).catch(() => { if (on) { setTracks([]); setLoading(false); } });

        return () => { on = false; };
    }, [sort, activeGenre]);

    // Genres (one-time)
    useEffect(() => {
        axios.get('/api/musician/genres').catch(() => ({ data: [] }))
            .then(r => setGenres(arr(r.data).filter((g: any) => (g._count?.tracks || 0) > 0).slice(0, 35)));
    }, []);

    // Client-side search filter over already-loaded tracks
    const displayed = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tracks;
        return tracks.filter(t =>
            (t.title || '').toLowerCase().includes(q)
            || (t.profile?.displayName || '').toLowerCase().includes(q)
            || (t.profile?.username || '').toLowerCase().includes(q)
            || (t.artist || '').toLowerCase().includes(q)
        );
    }, [tracks, search]);

    const playTrack = (t: any) => {
        if (!t.url) return;
        if (player.currentTrack?.id === t.id) { togglePlay(); return; }
        setTrack({ id: t.id, title: t.title, artist: t.profile?.displayName || t.profile?.username || t.artist || '', url: t.url, coverUrl: t.coverUrl });
    };

    const isPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Search" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Library' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── HERO ── */}
                    <section style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a2a 0%, #1a0a1a 40%, #0f131d 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.2) 60%, transparent 100%)' }} />

                        {/* Floating music note grid — decorative */}
                        {Array.from({ length: 12 }, (_, i) => (
                            <div key={i} style={{ position: 'absolute', width: 1, height: 1, left: `${8 + (i % 6) * 16}%`, top: `${15 + Math.floor(i / 6) * 45}%`, boxShadow: `0 0 ${20 + i * 8}px ${10 + i * 4}px ${i % 3 === 0 ? `${PRIMARY}08` : i % 3 === 1 ? `${SECONDARY}06` : `${TERTIARY}05`}`, borderRadius: '50%' }} />
                        ))}

                        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Library size={11} /> {loading ? '…' : fmtNum(total)} Tracks
                                    </span>
                                </div>
                                <h1 style={{ margin: '0 0 12px', fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>
                                    Music Library
                                </h1>
                                <p style={{ margin: '0 0 28px', color: 'rgba(159,166,185,0.85)', fontSize: 16, maxWidth: 480, lineHeight: 1.6 }}>
                                    Every track on Fuji Studio — search, filter by genre, and discover something new.
                                </p>

                                {/* Search bar */}
                                <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
                                    <Search size={16} color={SUB} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        ref={searchRef}
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search tracks, artists…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '14px 40px 14px 46px', background: 'rgba(28,31,42,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, color: TEXT, fontSize: 15, outline: 'none', fontFamily: FONT }}
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

                    {/* ── BODY GRID ── */}
                    <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                        {/* ── LEFT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Sort card */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Filter size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sort</h3>
                                </div>
                                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {SORTS.map(s => {
                                        const Icon = s.icon;
                                        const active = sort === s.key;
                                        return (
                                            <button key={s.key} onClick={() => setSort(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: active ? `${PRIMARY}18` : 'transparent', color: active ? PRIMARY : SUB, fontSize: 13, fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                                                <Icon size={13} color={active ? PRIMARY : SUB} />
                                                {s.label}
                                                {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: PRIMARY }} />}
                                            </button>
                                        );
                                    })}
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
                                                <X size={11} /> Clear
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 380, overflowY: 'auto' }}>
                                        {genres.map((g: any) => {
                                            const active = activeGenre === g.name;
                                            return (
                                                <button key={g.id} onClick={() => setActiveGenre(active ? null : g.name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: active ? `${SECONDARY}18` : 'transparent', color: active ? SECONDARY : SUB, fontSize: 13, fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                                                    {g.name}
                                                    <span style={{ fontSize: 11, color: active ? SECONDARY : 'rgba(154,163,178,0.4)' }}>{g._count?.tracks || 0}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Stats card */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Overview</h3>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { label: 'Total Tracks', value: fmtNum(total), color: TEXT },
                                        { label: 'Genres', value: String(genres.length), color: SECONDARY },
                                        { label: 'Showing', value: search ? `${displayed.length} results` : (activeGenre ? `${displayed.length} in genre` : 'All'), color: PRIMARY },
                                    ].map(s => (
                                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 13, color: SUB }}>{s.label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                                        {search ? `Results for "${search}"` : activeGenre ? activeGenre : 'All Tracks'}
                                    </h2>
                                    <span style={{ fontSize: 13, color: SUB }}>{displayed.length} track{displayed.length !== 1 ? 's' : ''}</span>
                                </div>

                                {loading ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center', color: SUB }}>Loading tracks…</div>
                                ) : displayed.length === 0 ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                        <Search size={36} color={SUB} style={{ marginBottom: 14 }} />
                                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No tracks found</div>
                                        <div style={{ fontSize: 13, color: SUB }}>Try a different search or genre</div>
                                    </div>
                                ) : (
                                    <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '36px 44px 1fr 130px 56px 60px 68px', gap: 0, padding: '10px 20px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}`, alignItems: 'center' }}>
                                            <div />
                                            <div />
                                            <div>Title</div>
                                            <div>Genre</div>
                                            <div style={{ textAlign: 'center' }}>BPM</div>
                                            <div style={{ textAlign: 'right' }}>Time</div>
                                            <div style={{ textAlign: 'right' }}>Plays</div>
                                        </div>

                                        {/* Track rows */}
                                        {displayed.map((t: any, i: number) => {
                                            const playing = isPlaying(t.id);
                                            const artistName = t.profile?.displayName || t.profile?.username || t.artist || '';
                                            const genreList = (t.genres || []).map((g: any) => g.genre?.name).filter(Boolean).slice(0, 1);
                                            const isLast = i === displayed.length - 1;

                                            return (
                                                <div
                                                    key={t.id}
                                                    style={{ display: 'grid', gridTemplateColumns: '36px 44px 1fr 130px 56px 60px 68px', gap: 0, padding: '10px 20px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`, alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s', background: playing ? `${PRIMARY}08` : 'transparent' }}
                                                    onMouseEnter={ev => { if (!playing) ev.currentTarget.style.background = 'rgba(38,42,53,0.35)'; }}
                                                    onMouseLeave={ev => { if (!playing) ev.currentTarget.style.background = 'transparent'; }}
                                                    onClick={() => navigate('/preview/alt_f_track')}
                                                >
                                                    {/* Play button */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); playTrack(t); }}
                                                            style={{ width: 26, height: 26, borderRadius: '50%', background: playing ? PRIMARY : 'transparent', border: playing ? 'none' : `1px solid rgba(255,255,255,0.15)`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                                        >
                                                            {playing
                                                                ? <Pause size={10} color="#fff" fill="#fff" />
                                                                : <Play size={10} color={SUB} fill={SUB} />
                                                            }
                                                        </button>
                                                    </div>

                                                    {/* Cover art */}
                                                    <div>
                                                        {t.coverUrl
                                                            ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                                                            : <div style={{ width: 36, height: 36, borderRadius: 6, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={SUB} /></div>
                                                        }
                                                    </div>

                                                    {/* Title + artist */}
                                                    <div style={{ minWidth: 0, paddingRight: 12 }}>
                                                        <div style={{ fontSize: 14, fontWeight: playing ? 700 : 600, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{t.title}</div>
                                                        <div style={{ fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artistName}</div>
                                                    </div>

                                                    {/* Genre */}
                                                    <div>
                                                        {genreList.length > 0 && (
                                                            <span style={{ padding: '3px 8px', borderRadius: 4, background: `${SECONDARY}15`, border: `1px solid ${SECONDARY}30`, fontSize: 11, color: SECONDARY, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                {genreList[0]}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* BPM */}
                                                    <div style={{ textAlign: 'center', fontSize: 12, color: t.bpm ? TEXT : SUB, fontWeight: t.bpm ? 600 : 400 }}>
                                                        {t.bpm || '—'}
                                                    </div>

                                                    {/* Duration */}
                                                    <div style={{ textAlign: 'right', fontSize: 12, color: SUB, fontVariantNumeric: 'tabular-nums' }}>
                                                        {fmtDur(t.duration)}
                                                    </div>

                                                    {/* Play count */}
                                                    <div style={{ textAlign: 'right', fontSize: 12, color: SUB }}>
                                                        {fmtNum(t.playCount)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>

                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
