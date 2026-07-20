/**
 * Alt F — My Tracks (/preview/alt_f_my_tracks)
 * Auth-gated catalog manager: list, play, toggle public/private, delete.
 * APIs: GET /api/musician/profile/:userId, GET /api/users/me/storage,
 *       PATCH /api/musician/tracks/:id, DELETE /api/musician/tracks/:id
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, S_LOWEST,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar, type RailSection } from '../components/altshell/AltActivitySidebar';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { TrackEditModal, type EditableTrack } from '../components/TrackEditModal';
import {
    Music, Play, Pause, Globe, Lock, Trash2, Upload,
    SortAsc, Filter, HardDrive, TrendingUp, Eye, Clock,
    Pencil,
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
const fmtBytes = (b: number) => { if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB'; if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB'; return (b / 1e3).toFixed(0) + ' KB'; };

type SortKey = 'newest' | 'oldest' | 'plays' | 'az';
type FilterKey = 'all' | 'public' | 'private';

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest First' },
    { key: 'plays',  label: 'Most Played'  },
    { key: 'az',     label: 'A – Z'        },
    { key: 'oldest', label: 'Oldest First' },
];

interface Track extends Omit<EditableTrack, 'genres'> {
    id: string; title: string; slug?: string | null; url: string | null;
    coverUrl: string | null; duration: number | null;
    playCount: number; bpm: number | null; key: string | null;
    isPublic: boolean; createdAt: string; position: number;
    genres?: { genre: { id: string; name: string } }[];
}
interface StorageInfo { usedBytes: number; quotaBytes: number; tier: string }

export const FrontpageAltFMyTracks: React.FC = () => {
    const { player, setTrack: playTrack, togglePlay } = usePlayer();
    const { user, loading: authLoading } = useAuth();

    const [tracks,   setTracks]   = useState<Track[]>([]);
    const [storage,  setStorage]  = useState<StorageInfo | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [hoverId,  setHoverId]  = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);

    const [sort,   setSort]   = useState<SortKey>('newest');
    const [filter, setFilter] = useState<FilterKey>('all');

    const [editTrack, setEditTrack] = useState<Track | null>(null);

    const load = useCallback(() => {
        if (!user?.id) return;
        setLoading(true);
        Promise.all([
            axios.get(`/api/musician/profile/${user.id}`, { withCredentials: true }),
            axios.get('/api/users/me/storage', { withCredentials: true }),
        ]).then(([profileRes, storageRes]) => {
            setTracks(profileRes.data?.tracks || []);
            setStorage(storageRes.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [user?.id]);

    useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

    // Deep-link support: ?edit=<trackId> (e.g. from the "Edit Track" link on the track page
    // itself) opens the full edit modal for that track once the list has loaded.
    const appliedDeepLinkRef = useRef(false);
    useEffect(() => {
        if (appliedDeepLinkRef.current || loading || tracks.length === 0) return;
        const editTrackId = new URLSearchParams(window.location.search).get('edit');
        if (!editTrackId) return;
        const target = tracks.find(t => t.id === editTrackId);
        if (target) {
            appliedDeepLinkRef.current = true;
            setEditTrack(target);
            requestAnimationFrame(() => {
                document.getElementById(`track-row-${editTrackId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }
    }, [loading, tracks]);

    const togglePublic = async (track: Track) => {
        if (toggling) return;
        setToggling(track.id);
        const next = !track.isPublic;
        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, isPublic: next } : t));
        try {
            await axios.patch(`/api/musician/tracks/${track.id}`, { isPublic: next }, { withCredentials: true });
        } catch {
            setTracks(prev => prev.map(t => t.id === track.id ? { ...t, isPublic: !next } : t));
        } finally { setToggling(null); }
    };

    const deleteTrack = async (id: string) => {
        try {
            await axios.delete(`/api/musician/tracks/${id}`, { withCredentials: true });
            setTracks(prev => prev.filter(t => t.id !== id));
            setDeleteId(null);
            // Refresh storage
            axios.get('/api/users/me/storage', { withCredentials: true }).then(r => setStorage(r.data)).catch(() => {});
        } catch { }
    };

    const handlePlay = (t: Track) => {
        if (!t.url) return;
        if (player.currentTrack?.id === t.id) { togglePlay(); return; }
        const queue = displayed
            .filter(tr => tr.url)
            .map(tr => ({
                id: tr.id,
                title: tr.title,
                artist: user?.username || 'Me',
                url: tr.url!,
                coverUrl: tr.coverUrl,
            }));
        const idx = queue.findIndex(q => q.id === t.id);
        playTrack(queue[idx] ?? queue[0], queue);
    };

    const isPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    const displayed = useMemo(() => {
        let out = [...tracks];
        if (filter === 'public')  out = out.filter(t => t.isPublic);
        if (filter === 'private') out = out.filter(t => !t.isPublic);
        switch (sort) {
            case 'newest': out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
            case 'oldest': out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
            case 'plays':  out.sort((a, b) => b.playCount - a.playCount); break;
            case 'az':     out.sort((a, b) => a.title.localeCompare(b.title)); break;
        }
        return out;
    }, [tracks, sort, filter]);

    const totalPlays  = tracks.reduce((s, t) => s + t.playCount, 0);
    const publicCount = tracks.filter(t => t.isPublic).length;

    const storagePct  = storage ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100) : 0;
    const storageColor = storagePct > 85 ? TERTIARY : storagePct > 65 ? '#ff9f43' : '#4ade80';

    if (!authLoading && !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
                <AltSidebar active="My Tracks" />
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <AltHeader breadcrumb={[{ label: 'My Tracks' }]} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <Lock size={36} color={SUB} />
                        <div style={{ fontSize: 16, fontWeight: 600 }}>Sign in to manage your tracks</div>
                    </div>
                </main>
            </div>
        );
    }

    // Page controls relocated into the right activity rail.
    const sortCard = (
        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SortAsc size={14} color={PRIMARY} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sort By</h3>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {SORTS.map(s => {
                    const active = sort === s.key;
                    return (
                        <button key={s.key} onClick={() => setSort(s.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: active ? `${PRIMARY}14` : 'transparent', color: active ? PRIMARY : SUB, fontSize: 13, fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                            {s.label}
                            {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY }} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
    const filterCard = (
        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={14} color={PRIMARY} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Filter</h3>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {([['all', 'All Tracks', tracks.length], ['public', 'Public', publicCount], ['private', 'Private', tracks.length - publicCount]] as [FilterKey, string, number][]).map(([key, label, count]) => {
                    const active = filter === key;
                    return (
                        <button key={key} onClick={() => setFilter(key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: active ? `${PRIMARY}14` : 'transparent', color: active ? PRIMARY : SUB, fontSize: 13, fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {key === 'public' ? <Globe size={12} /> : key === 'private' ? <Lock size={12} /> : <Music size={12} />}
                                {label}
                            </div>
                            <span style={{ fontSize: 11, color: active ? PRIMARY : `${SUB}88` }}>{count}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
    const storageCard = (
        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={14} color={PRIMARY} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Storage</h3>
                {storage && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 9999, background: `${PRIMARY}18`, color: PRIMARY }}>
                        {storage.tier}
                    </span>
                )}
            </div>
            <div style={{ padding: '14px 16px' }}>
                {!storage ? (
                    <div style={{ fontSize: 13, color: SUB }}><AltSpinner /></div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: SUB }}>Used</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: storageColor }}>{fmtBytes(storage.usedBytes)} / {fmtBytes(storage.quotaBytes)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: S_HIGH, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${storagePct}%`, borderRadius: 3, background: storageColor, transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: `${SUB}88`, marginTop: 6 }}>{storagePct.toFixed(1)}% used</div>
                    </>
                )}
            </div>
        </div>
    );
    const overviewCard = (
        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} color={PRIMARY} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Overview</h3>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                {[
                    { label: 'Total Tracks',  value: String(tracks.length),             color: TEXT      },
                    { label: 'Total Plays',   value: fmtNum(totalPlays),                color: PRIMARY   },
                    { label: 'Public',        value: String(publicCount),               color: SECONDARY  },
                    { label: 'Private',       value: String(tracks.length - publicCount), color: SUB    },
                ].map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: SUB }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
    const uploadCard = (
        <div style={{ ...glass, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Upload size={16} color={PRIMARY} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Upload a Track</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.5 }}>
                Share your music with the community. Supports audio, artwork, FL Studio project files, and stems.
            </p>
            <a href="/upload" style={{ display: 'block', padding: '10px', background: PRIMARY, borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                Go to Upload →
            </a>
        </div>
    );
    const railTop = (<>{sortCard}{filterCard}{storageCard}{overviewCard}{uploadCard}</>);
    const railSections: RailSection[] = [
        { key: 'sort', label: 'Sort', icon: <SortAsc size={20} />, content: sortCard },
        { key: 'filter', label: 'Filter', icon: <Filter size={20} />, content: filterCard },
        { key: 'storage', label: 'Storage', icon: <HardDrive size={20} />, content: storageCard },
        { key: 'overview', label: 'Overview', icon: <TrendingUp size={20} />, content: overviewCard },
    ];

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="My Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'My Tracks' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── HEADER BAND ── */}
                    <section style={{ position: 'relative', borderBottom: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0f1a0a 0%, #1a1000 40%, #0f131d 100%)' }} />
                        {[...Array(5)].map((_, i) => (
                            <div key={i} style={{ position: 'absolute', width: 1, height: 1, left: `${12 + i * 18}%`, top: '50%', boxShadow: `0 0 ${50 + i * 15}px ${22 + i * 8}px ${i % 3 === 0 ? `${PRIMARY}08` : '#4ade8006'}`, borderRadius: '50%' }} />
                        ))}
                        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '40px 32px 36px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                    <Music size={28} color={PRIMARY} />
                                    <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>My Tracks</h1>
                                </div>
                                <p style={{ margin: 0, color: SUB, fontSize: 14 }}>
                                    {loading ? 'Loading…' : `${tracks.length} track${tracks.length !== 1 ? 's' : ''} · ${fmtNum(totalPlays)} total plays · ${publicCount} public`}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 20 }}>
                                {[
                                    { label: 'Tracks',  value: String(tracks.length), color: TEXT    },
                                    { label: 'Plays',   value: fmtNum(totalPlays),    color: PRIMARY  },
                                    { label: 'Public',  value: String(publicCount),   color: SECONDARY },
                                ].map(s => (
                                    <div key={s.label} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── BODY GRID ── */}
                    <div style={{ maxWidth: CONTENT_MAX, margin: '24px auto 0', padding: '0 32px 40px', boxSizing: 'border-box' }}>


                        {/* ── RIGHT ── */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                                    {filter === 'all' ? 'All Tracks' : filter === 'public' ? 'Public Tracks' : 'Private Tracks'}
                                </h2>
                                <span style={{ fontSize: 13, color: SUB }}>{displayed.length} track{displayed.length !== 1 ? 's' : ''}</span>
                            </div>

                            {loading ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center', color: SUB }}><AltSpinner /></div>
                            ) : displayed.length === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                    <Music size={36} color={SUB} style={{ marginBottom: 14 }} />
                                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                                        {tracks.length === 0 ? 'No tracks yet' : 'No tracks match this filter'}
                                    </div>
                                    <div style={{ fontSize: 13, color: SUB }}>
                                        {tracks.length === 0 ? 'Upload your first track using the button in the sidebar.' : 'Try changing your filter.'}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ ...glass, borderRadius: 20, overflowX: 'auto' }}>
                                    {/* Table header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '40px 44px 1fr 88px 46px 54px 64px 112px', gap: 0, padding: '10px 20px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}`, alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>#</div>
                                        <div />
                                        <div>Title</div>
                                        <div>Genre</div>
                                        <div style={{ textAlign: 'center' }}>BPM</div>
                                        <div style={{ textAlign: 'center' }}>
                                            <Eye size={10} style={{ verticalAlign: 'middle' }} />
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Clock size={10} style={{ verticalAlign: 'middle' }} />
                                        </div>
                                        <div style={{ textAlign: 'right' }}>Actions</div>
                                    </div>

                                    {displayed.map((t, i) => {
                                        const playing = isPlaying(t.id);
                                        const hovered = hoverId === t.id;
                                        const isLast  = i === displayed.length - 1;
                                        const isDel   = deleteId === t.id;
                                        const genre   = t.genres?.[0]?.genre?.name;

                                        return (
                                            <div
                                                key={t.id}
                                                id={`track-row-${t.id}`}
                                                onMouseEnter={() => setHoverId(t.id)}
                                                onMouseLeave={() => setHoverId(null)}
                                                style={{ display: 'grid', gridTemplateColumns: '40px 44px 1fr 88px 46px 54px 64px 112px', gap: 0, padding: '10px 20px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`, alignItems: 'center', background: playing ? `${PRIMARY}08` : hovered ? 'rgba(38,42,53,0.35)' : 'transparent', transition: 'background 0.1s' }}
                                            >
                                                {/* Position / play */}
                                                <div style={{ textAlign: 'center' }}>
                                                    {hovered && t.url && !isDel ? (
                                                        <button onClick={() => handlePlay(t)} style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                            {playing ? <Pause size={14} color={PRIMARY} fill={PRIMARY} /> : <Play size={14} color={TEXT} fill={TEXT} />}
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: 13, color: playing ? PRIMARY : SUB, fontWeight: playing ? 700 : 400 }}>{i + 1}</span>
                                                    )}
                                                </div>

                                                {/* Cover */}
                                                <div onClick={() => !isDel && handlePlay(t)} style={{ cursor: t.url ? 'pointer' : 'default' }}>
                                                    {t.coverUrl
                                                        ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                                                        : <div style={{ width: 36, height: 36, borderRadius: 6, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={SUB} /></div>
                                                    }
                                                </div>

                                                {/* Title cell — shows normal view, edit form, or delete confirm */}
                                                <div style={{ minWidth: 0, paddingRight: 8 }}>
                                                    {isDel ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 13, color: TERTIARY, fontWeight: 600 }}>Delete "{t.title}"?</span>
                                                            <button onClick={() => deleteTrack(t.id)} style={{ padding: '3px 10px', background: TERTIARY, border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Delete</button>
                                                            <button onClick={() => setDeleteId(null)} style={{ padding: '3px 10px', background: S_HIGH, border: 'none', borderRadius: 5, color: SUB, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontSize: 14, fontWeight: playing ? 700 : 600, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{t.title}</div>
                                                            <div style={{ fontSize: 11, color: SUB }}>{fmtDate(t.createdAt)}</div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Genre */}
                                                <div>
                                                    {genre && !isDel && (
                                                        <span style={{ padding: '3px 7px', borderRadius: 4, background: `${SECONDARY}15`, border: `1px solid ${SECONDARY}30`, fontSize: 10, color: SECONDARY, fontWeight: 600, whiteSpace: 'nowrap' }}>{genre}</span>
                                                    )}
                                                </div>

                                                {/* BPM */}
                                                <div style={{ textAlign: 'center', fontSize: 12, color: t.bpm ? TEXT : `${SUB}66`, fontWeight: t.bpm ? 600 : 400 }}>
                                                    {!isDel && (t.bpm || '—')}
                                                </div>

                                                {/* Plays */}
                                                <div style={{ textAlign: 'center', fontSize: 12, color: SUB, fontVariantNumeric: 'tabular-nums' }}>
                                                    {!isDel && fmtNum(t.playCount)}
                                                </div>

                                                {/* Duration */}
                                                <div style={{ textAlign: 'right', fontSize: 12, color: SUB, fontVariantNumeric: 'tabular-nums' }}>
                                                    {!isDel && fmtDur(t.duration)}
                                                </div>

                                                {/* Actions: visibility + edit + delete */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                                    {!isDel ? (
                                                        <>
                                                            {/* Visibility toggle — icon only to save space */}
                                                            <button
                                                                onClick={() => togglePublic(t)}
                                                                disabled={!!toggling}
                                                                title={t.isPublic ? 'Make private' : 'Make public'}
                                                                style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.isPublic ? SECONDARY + '44' : BORDER}`, background: t.isPublic ? `${SECONDARY}12` : 'transparent', color: t.isPublic ? SECONDARY : SUB, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                                                            >
                                                                {t.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditTrack(t)}
                                                                title="Edit track"
                                                                style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${SUB}66`, transition: 'all 0.15s', flexShrink: 0 }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = `${SECONDARY}1a`; e.currentTarget.style.color = SECONDARY; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = `${SUB}66`; }}
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteId(t.id)}
                                                                title="Delete track"
                                                                style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${SUB}66`, transition: 'all 0.15s', flexShrink: 0 }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = `${TERTIARY}1a`; e.currentTarget.style.color = TERTIARY; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = `${SUB}66`; }}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <AltActivitySidebar topSlot={railTop} railSections={railSections} />
                </div>
            </main>
            {editTrack && (
                <TrackEditModal
                    track={editTrack}
                    open={!!editTrack}
                    onClose={() => setEditTrack(null)}
                    onSaved={patch => setTracks(prev => prev.map(t => t.id === editTrack.id ? { ...t, ...patch } : t))}
                />
            )}
        </div>
    );
};
