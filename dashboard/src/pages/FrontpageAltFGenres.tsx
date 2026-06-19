/**
 * Alt F — Genres (/preview/alt_f_genres)
 * Genre exploration: browse all genres, click to see tracks.
 * APIs: GET /api/musician/genres, GET /api/discovery/tracks?genre=<name>
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { Music, Play, Pause, ChevronLeft, Search, X, TrendingUp, Users } from 'lucide-react';

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

function genreColor(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `linear-gradient(135deg, hsl(${hue},35%,14%) 0%, hsl(${(hue + 50) % 360},45%,18%) 100%)`;
}
function genreAccent(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue},60%,65%)`;
}

interface Genre {
    id: string; name: string; slug: string; parentId: string | null;
    _count: { tracks: number; profiles: number };
    children: Genre[];
}

export const FrontpageAltFGenres: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();

    const [genres,        setGenres]        = useState<Genre[]>([]);
    const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
    const [tracks,        setTracks]        = useState<any[]>([]);
    const [tracksLoading, setTracksLoading] = useState(false);
    const [hoverId,       setHoverId]       = useState<string | null>(null);
    const [genreLoading,  setGenreLoading]  = useState(true);
    const [search,        setSearch]        = useState('');

    useEffect(() => {
        axios.get('/api/musician/genres').then(r => {
            setGenres(arr(r.data));
            setGenreLoading(false);
        }).catch(() => setGenreLoading(false));
    }, []);

    const selectGenre = (g: Genre) => {
        setSelectedGenre(g);
        setTracksLoading(true);
        setTracks([]);
        axios.get('/api/discovery/tracks', { params: { genre: g.name, limit: '200' } })
            .then(r => { setTracks(arr(r.data)); setTracksLoading(false); })
            .catch(() => setTracksLoading(false));
    };

    const clearGenre = () => { setSelectedGenre(null); setTracks([]); };

    const isPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    const playTrack = (t: any) => {
        if (!t.url) return;
        if (player.currentTrack?.id === t.id) { togglePlay(); return; }
        const queue = tracks.filter(tr => tr.url).map(tr => ({
            id: tr.id, title: tr.title,
            artist: tr.profile?.displayName || tr.profile?.username || tr.artist || '',
            url: tr.url, coverUrl: tr.coverUrl,
        }));
        const idx = queue.findIndex(q => q.id === t.id);
        setTrack(queue[idx] ?? queue[0], queue);
    };

    // Only top-level genres for the grid
    const topLevel = useMemo(() => genres.filter(g => !g.parentId), [genres]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return topLevel;
        return topLevel.filter(g =>
            g.name.toLowerCase().includes(q)
            || g.children.some(c => c.name.toLowerCase().includes(q))
        );
    }, [topLevel, search]);

    const totalTracks   = topLevel.reduce((s, g) => s + (g._count?.tracks || 0), 0);
    const totalArtists  = topLevel.reduce((s, g) => s + (g._count?.profiles || 0), 0);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={selectedGenre
                    ? [{ label: 'Genres', to: '/preview/alt_f_genres' }, { label: selectedGenre.name }]
                    : [{ label: 'Genres' }]
                } />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── HERO ── */}
                    <section style={{ position: 'relative', width: '100%', height: 340, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a3a 0%, #1a0a2a 40%, #0f131d 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.2) 70%, transparent 100%)' }} />
                        {/* Coloured genre blobs */}
                        {topLevel.slice(0, 8).map((g, i) => (
                            <div key={g.id} style={{ position: 'absolute', width: 1, height: 1, left: `${8 + i * 12}%`, top: `${20 + (i % 3) * 25}%`, boxShadow: `0 0 ${60 + i * 10}px ${28 + i * 6}px ${genreAccent(g.name)}12`, borderRadius: '50%' }} />
                        ))}
                        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 32px', textAlign: 'center', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                                    <span style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '4px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Music size={11} /> {genreLoading ? '…' : topLevel.length} Genres
                                    </span>
                                </div>
                                <h1 style={{ margin: '0 0 10px', fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>
                                    Explore Genres
                                </h1>
                                <p style={{ margin: '0 0 24px', color: 'rgba(159,166,185,0.85)', fontSize: 15, maxWidth: 400, lineHeight: 1.6, marginLeft: 'auto', marginRight: 'auto' }}>
                                    Dive deep into the sounds that define the Fuji Studio community.
                                </p>
                                {/* Search */}
                                <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
                                    <Search size={15} color={SUB} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search genres…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '13px 38px 13px 42px', background: 'rgba(28,31,42,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: TEXT, fontSize: 14, outline: 'none', fontFamily: FONT }}
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── BODY ── */}
                    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 48px', boxSizing: 'border-box' }}>

                        {/* Stats strip */}
                        {!selectedGenre && (
                            <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
                                {[
                                    { label: 'Genres', value: topLevel.length, icon: Music, color: PRIMARY },
                                    { label: 'Total Tracks', value: totalTracks, icon: TrendingUp, color: SECONDARY },
                                    { label: 'Artists', value: totalArtists, icon: Users, color: TERTIARY },
                                ].map(s => {
                                    const Icon = s.icon;
                                    return (
                                        <div key={s.label} style={{ ...glass, borderRadius: 16, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon size={16} color={s.color} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{fmtNum(s.value)}</div>
                                                <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{s.label}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {selectedGenre ? (
                            /* ── GENRE DETAIL VIEW ── */
                            <div>
                                {/* Back + header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                                    <button onClick={clearGenre} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: S_CONT, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
                                        <ChevronLeft size={14} /> All Genres
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: genreColor(selectedGenre.name), border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Music size={20} color={genreAccent(selectedGenre.name)} />
                                        </div>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{selectedGenre.name}</h2>
                                            <div style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                                                {fmtNum(selectedGenre._count?.tracks)} tracks · {fmtNum(selectedGenre._count?.profiles)} artists
                                            </div>
                                        </div>
                                    </div>
                                    {selectedGenre.children.length > 0 && (
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {selectedGenre.children.map(c => (
                                                <button key={c.id} onClick={() => selectGenre(c)} style={{ padding: '4px 12px', borderRadius: 9999, background: `${genreAccent(c.name)}18`, border: `1px solid ${genreAccent(c.name)}44`, color: genreAccent(c.name), fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {tracksLoading ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center', color: SUB }}>Loading tracks…</div>
                                ) : tracks.length === 0 ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                        <Music size={36} color={SUB} style={{ marginBottom: 14 }} />
                                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No tracks in this genre yet</div>
                                        <div style={{ fontSize: 13, color: SUB }}>Be the first to upload one.</div>
                                    </div>
                                ) : (
                                    <div style={{ ...glass, borderRadius: 20, overflowX: 'auto' }}>
                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '36px 44px 1fr 48px 60px 68px', padding: '10px 20px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}`, alignItems: 'center' }}>
                                            <div />
                                            <div />
                                            <div>Title</div>
                                            <div style={{ textAlign: 'center' }}>BPM</div>
                                            <div style={{ textAlign: 'right' }}>Time</div>
                                            <div style={{ textAlign: 'right' }}>Plays</div>
                                        </div>
                                        {tracks.map((t, i) => {
                                            const playing = isPlaying(t.id);
                                            const hovered = hoverId === t.id;
                                            const isLast  = i === tracks.length - 1;
                                            const artist  = t.profile?.displayName || t.profile?.username || t.artist || '';
                                            return (
                                                <div
                                                    key={t.id}
                                                    onMouseEnter={() => setHoverId(t.id)}
                                                    onMouseLeave={() => setHoverId(null)}
                                                    style={{ display: 'grid', gridTemplateColumns: '36px 44px 1fr 48px 60px 68px', padding: '10px 20px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`, alignItems: 'center', background: playing ? `${PRIMARY}08` : hovered ? 'rgba(38,42,53,0.35)' : 'transparent', transition: 'background 0.1s', cursor: 'pointer' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <button onClick={() => playTrack(t)} style={{ width: 26, height: 26, borderRadius: '50%', background: playing ? PRIMARY : hovered ? 'rgba(255,255,255,0.08)' : 'transparent', border: playing ? 'none' : `1px solid rgba(255,255,255,0.12)`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                                            {playing ? <Pause size={10} color="#fff" fill="#fff" /> : <Play size={10} color={SUB} fill={SUB} />}
                                                        </button>
                                                    </div>
                                                    <div>
                                                        {t.coverUrl
                                                            ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                                                            : <div style={{ width: 36, height: 36, borderRadius: 6, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={SUB} /></div>
                                                        }
                                                    </div>
                                                    <div style={{ minWidth: 0, paddingRight: 12 }}>
                                                        <div style={{ fontSize: 14, fontWeight: playing ? 700 : 600, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{t.title}</div>
                                                        {artist && <div style={{ fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</div>}
                                                    </div>
                                                    <div style={{ textAlign: 'center', fontSize: 12, color: t.bpm ? TEXT : `${SUB}55`, fontWeight: t.bpm ? 600 : 400 }}>{t.bpm || '—'}</div>
                                                    <div style={{ textAlign: 'right', fontSize: 12, color: SUB, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(t.duration)}</div>
                                                    <div style={{ textAlign: 'right', fontSize: 12, color: SUB }}>{fmtNum(t.playCount)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ── GENRE GRID ── */
                            genreLoading ? (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: SUB }}>Loading genres…</div>
                            ) : filtered.length === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                    <Search size={32} color={SUB} style={{ marginBottom: 12 }} />
                                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No genres found</div>
                                    <div style={{ fontSize: 13, color: SUB }}>Try a different search.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                    {filtered.map(g => {
                                        const accent  = genreAccent(g.name);
                                        const bgGrad  = genreColor(g.name);
                                        const tracks  = g._count?.tracks || 0;
                                        const artists = g._count?.profiles || 0;
                                        return (
                                            <div
                                                key={g.id}
                                                onClick={() => selectGenre(g)}
                                                style={{ ...glass, borderRadius: 20, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s, transform 0.15s' }}
                                                onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${accent}55`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                {/* Colour band */}
                                                <div style={{ height: 80, background: bgGrad, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,19,29,0.6) 100%)' }} />
                                                    <Music size={36} color={`${accent}30`} strokeWidth={1.5} />
                                                    <div style={{ position: 'absolute', bottom: 10, left: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Music size={13} color={accent} />
                                                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{g.name}</span>
                                                    </div>
                                                    <div style={{ position: 'absolute', top: 10, right: 12 }}>
                                                        <span style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent, padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 800 }}>
                                                            {fmtNum(tracks)} tracks
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Card body */}
                                                <div style={{ padding: '14px 18px 16px' }}>
                                                    <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                                                        <div>
                                                            <div style={{ fontSize: 18, fontWeight: 900, color: accent, lineHeight: 1 }}>{fmtNum(tracks)}</div>
                                                            <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Tracks</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{fmtNum(artists)}</div>
                                                            <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Artists</div>
                                                        </div>
                                                    </div>
                                                    {/* Sub-genres */}
                                                    {g.children.length > 0 && (
                                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                            {g.children.slice(0, 4).map(c => (
                                                                <span key={c.id} style={{ padding: '2px 8px', borderRadius: 9999, background: `${accent}10`, border: `1px solid ${accent}25`, fontSize: 10, color: `${accent}cc`, fontWeight: 600 }}>
                                                                    {c.name}
                                                                </span>
                                                            ))}
                                                            {g.children.length > 4 && (
                                                                <span style={{ padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: SUB }}>
                                                                    +{g.children.length - 4}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
