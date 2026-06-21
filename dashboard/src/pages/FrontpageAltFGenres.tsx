/**
 * Alt F — Genres (/preview/alt_f_genres)
 * Genre grid + subreddit-style post feed per genre.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Music, Play, Pause, ChevronLeft, Search, X, TrendingUp, Users,
    ChevronUp, ChevronDown, MessageCircle, Clock, Flame, Plus, Bell, BellOff,
    FileText, Image as ImageIcon,
} from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return '—'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 604800) return `${Math.floor(s / 86400)}d`;
    return new Date(d).toLocaleDateString();
};

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
    _count: { tracks: number; profiles: number; subscriptions: number };
    children: Genre[];
}

interface GenrePost {
    id: string; type: 'discussion' | 'track'; title: string; body?: string | null;
    imageUrl?: string | null; score: number; upvotes: number; downvotes: number;
    hotScore: number; commentCount: number; createdAt: string;
    userId: string; username: string; avatarUrl?: string | null;
    genreId: string; genre?: { id: string; name: string; slug: string };
    track?: { id: string; title: string; slug: string; coverUrl?: string | null; url?: string; mp3Url?: string | null; duration?: number; profile?: { username: string; displayName?: string | null } } | null;
    userVote: 'up' | 'down' | null;
}

// ── GenrePostCard ──────────────────────────────────────────────────────────────
const GenrePostCard: React.FC<{
    post: GenrePost; onVote: (id: string, type: 'up' | 'down') => void;
    showGenre?: boolean;
}> = ({ post, onVote, showGenre }) => {
    const { player, setTrack, togglePlay } = usePlayer();
    const [hovered, setHovered] = useState(false);

    const isPlaying = player.currentTrack?.id === post.track?.id && player.isPlaying;

    const playTrack = () => {
        if (!post.track?.url) return;
        if (player.currentTrack?.id === post.track.id) { togglePlay(); return; }
        const artist = post.track.profile?.displayName || post.track.profile?.username || post.username;
        setTrack({ id: post.track.id, title: post.track.title, artist, url: post.track.url, coverUrl: post.track.coverUrl || undefined }, []);
    };

    const upColor = post.userVote === 'up' ? PRIMARY : SUB;
    const downColor = post.userVote === 'down' ? TERTIARY : SUB;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ ...glass, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, transition: 'border-color 0.15s', borderColor: hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.1)', cursor: 'default' }}
        >
            {/* Vote column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 36, paddingTop: 2 }}>
                <button onClick={() => onVote(post.id, 'up')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: upColor, padding: 2, display: 'flex', transition: 'color 0.15s' }}>
                    <ChevronUp size={18} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: post.score > 0 ? PRIMARY : post.score < 0 ? TERTIARY : SUB, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{post.score}</span>
                <button onClick={() => onVote(post.id, 'down')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: downColor, padding: 2, display: 'flex', transition: 'color 0.15s' }}>
                    <ChevronDown size={18} />
                </button>
            </div>

            {/* Post content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title */}
                <Link to={`/preview/alt_f_genre_post/${post.id}`} style={{ textDecoration: 'none' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.35, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = PRIMARY)}
                        onMouseLeave={e => (e.currentTarget.style.color = TEXT)}>
                        {post.type === 'discussion' && <FileText size={13} color={SECONDARY} style={{ marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />}
                        {post.type === 'track' && <Music size={13} color={PRIMARY} style={{ marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />}
                        {post.title}
                    </p>
                </Link>

                {/* Track mini-player */}
                {post.type === 'track' && post.track && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: S_CONT, borderRadius: 10, padding: '8px 12px', marginBottom: 8, border: `1px solid ${BORDER}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: S_HIGH, position: 'relative', cursor: post.track.url ? 'pointer' : 'default' }} onClick={playTrack}>
                            {post.track.coverUrl
                                ? <img src={post.track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={SUB} /></div>
                            }
                            {post.track.url && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isPlaying ? <Pause size={14} color="#fff" fill="#fff" /> : <Play size={14} color="#fff" fill="#fff" />}
                                </div>
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.track.title}</div>
                            {post.track.profile && (
                                <div style={{ fontSize: 11, color: SUB, marginTop: 1 }}>{post.track.profile.displayName || post.track.profile.username}</div>
                            )}
                        </div>
                        {post.track.duration && (
                            <span style={{ fontSize: 11, color: SUB, marginLeft: 'auto', flexShrink: 0 }}>{fmtDur(post.track.duration)}</span>
                        )}
                    </div>
                )}

                {/* Discussion body snippet */}
                {post.type === 'discussion' && post.body && (
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: SUB, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                        {post.body}
                    </p>
                )}

                {/* Discussion image */}
                {post.type === 'discussion' && post.imageUrl && (
                    <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover', marginBottom: 8, display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                )}

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: SUB }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                            {post.avatarUrl && <img src={post.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <span style={{ fontWeight: 600, color: TEXT }}>{post.username}</span>
                    </div>
                    <span>·</span>
                    <span>{timeAgo(post.createdAt)}</span>
                    {showGenre && post.genre && (
                        <>
                            <span>·</span>
                            <span style={{ color: genreAccent(post.genre.name), fontWeight: 600 }}>{post.genre.name}</span>
                        </>
                    )}
                    <Link to={`/preview/alt_f_genre_post/${post.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: SUB, textDecoration: 'none', marginLeft: 'auto' }}
                        onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                        onMouseLeave={e => (e.currentTarget.style.color = SUB)}>
                        <MessageCircle size={12} />
                        <span>{post.commentCount} comments</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

// ── Create Post Modal ──────────────────────────────────────────────────────────
const CreatePostModal: React.FC<{ genreId: string; genreName: string; onClose: () => void; onCreated: (post: GenrePost) => void }> = ({ genreId, genreName, onClose, onCreated }) => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!title.trim()) { setErr('Title is required'); return; }
        setSaving(true); setErr('');
        try {
            const r = await axios.post('/api/genre-posts', { genreId, title, body, type: 'discussion' }, { withCredentials: true });
            onCreated(r.data);
            onClose();
        } catch (e: any) {
            setErr(e.response?.data?.error || 'Failed to post');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ ...glass, borderRadius: 18, padding: 28, width: '100%', maxWidth: 560, fontFamily: FONT }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: TEXT }}>New post in {genreName}</h3>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: SUB }}>Start a discussion in this genre community</p>

                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={300} placeholder="An interesting title…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', marginBottom: 4 }} />
                <div style={{ fontSize: 11, color: SUB, textAlign: 'right', marginBottom: 16 }}>{title.length}/300</div>

                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Body <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={10000} rows={5} placeholder="Share your thoughts…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical', marginBottom: 4 }} />
                <div style={{ fontSize: 11, color: SUB, textAlign: 'right', marginBottom: 16 }}>{body.length}/10,000</div>

                {err && <p style={{ color: TERTIARY, fontSize: 13, marginBottom: 12 }}>{err}</p>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 14 }}>Cancel</button>
                    <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Posting…' : 'Post'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const FrontpageAltFGenres: React.FC = () => {
    const { player } = usePlayer();

    // Genre list
    const [genres, setGenres] = useState<Genre[]>([]);
    const [genreLoading, setGenreLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Selected genre / post feed
    const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
    const [posts, setPosts] = useState<GenrePost[]>([]);
    const [postsLoading, setPostsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [sort, setSort] = useState<'hot' | 'new' | 'top'>('hot');
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'alltime'>('week');

    // Subscription
    const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
    const [subLoading, setSubLoading] = useState(false);

    // Create post modal
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        axios.get('/api/musician/genres').then(r => { setGenres(arr(r.data)); setGenreLoading(false); }).catch(() => setGenreLoading(false));
        axios.get('/api/genre-subscriptions', { withCredentials: true }).then(r => {
            setSubscribedIds(new Set(arr(r.data.genreIds)));
        }).catch(() => {});
    }, []);

    const fetchPosts = useCallback(async (genreId: string, s: typeof sort, p: typeof period, cursor?: string) => {
        setPostsLoading(true);
        try {
            const params: any = { genreId, sort: s };
            if (s === 'top') params.period = p;
            if (cursor) params.cursor = cursor;
            const r = await axios.get('/api/genre-posts', { params });
            if (cursor) {
                setPosts(prev => [...prev, ...arr(r.data.posts)]);
            } else {
                setPosts(arr(r.data.posts));
            }
            setHasMore(r.data.hasMore);
            setNextCursor(r.data.nextCursor);
        } catch {}
        finally { setPostsLoading(false); }
    }, []);

    const selectGenre = (g: Genre) => {
        setSelectedGenre(g);
        setPosts([]);
        setSort('hot');
        fetchPosts(g.id, 'hot', period);
    };

    useEffect(() => {
        if (selectedGenre) fetchPosts(selectedGenre.id, sort, period);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sort, period]);

    const handleVote = async (postId: string, type: 'up' | 'down') => {
        try {
            const r = await axios.post(`/api/genre-posts/${postId}/vote`, { type }, { withCredentials: true });
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: r.data.score, upvotes: r.data.upvotes, downvotes: r.data.downvotes, userVote: r.data.userVote } : p));
        } catch {}
    };

    const toggleSubscribe = async () => {
        if (!selectedGenre) return;
        setSubLoading(true);
        try {
            if (subscribedIds.has(selectedGenre.id)) {
                await axios.delete(`/api/genre-subscriptions/${selectedGenre.id}`, { withCredentials: true });
                setSubscribedIds(prev => { const s = new Set(prev); s.delete(selectedGenre.id); return s; });
            } else {
                await axios.post(`/api/genre-subscriptions/${selectedGenre.id}`, {}, { withCredentials: true });
                setSubscribedIds(prev => new Set([...prev, selectedGenre.id]));
            }
        } catch {}
        finally { setSubLoading(false); }
    };

    const topLevel = useMemo(() => genres.filter(g => !g.parentId), [genres]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return topLevel;
        return topLevel.filter(g => g.name.toLowerCase().includes(q) || g.children.some(c => c.name.toLowerCase().includes(q)));
    }, [topLevel, search]);

    const totalTracks = topLevel.reduce((s, g) => s + (g._count?.tracks || 0), 0);
    const totalArtists = topLevel.reduce((s, g) => s + (g._count?.profiles || 0), 0);
    const isSubscribed = selectedGenre ? subscribedIds.has(selectedGenre.id) : false;
    const pb = player.currentTrack ? 90 : 0;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={selectedGenre
                    ? [{ label: 'Genres', to: '/preview/alt_f_genres' }, { label: selectedGenre.name }]
                    : [{ label: 'Genres' }]
                } />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: pb }}>

                        {/* ── HERO ── */}
                        <section style={{ position: 'relative', width: '100%', height: 240, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a3a 0%, #1a0a2a 40%, #0f131d 100%)' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.2) 70%, transparent 100%)' }} />
                            {topLevel.slice(0, 8).map((g, i) => (
                                <div key={g.id} style={{ position: 'absolute', width: 1, height: 1, left: `${8 + i * 12}%`, top: `${20 + (i % 3) * 25}%`, boxShadow: `0 0 ${60 + i * 10}px ${28 + i * 6}px ${genreAccent(g.name)}12`, borderRadius: '50%' }} />
                            ))}
                            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 24px', textAlign: 'center', boxSizing: 'border-box' }}>
                                    <h1 style={{ margin: '0 0 8px', fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
                                        {selectedGenre ? selectedGenre.name : 'Explore Genres'}
                                    </h1>
                                    <p style={{ margin: '0 0 20px', color: 'rgba(159,166,185,0.85)', fontSize: 14 }}>
                                        {selectedGenre
                                            ? `${fmtNum(selectedGenre._count?.tracks)} tracks · ${fmtNum(selectedGenre._count?.profiles)} artists · ${fmtNum(selectedGenre._count?.subscriptions)} members`
                                            : 'Subscribe to genres and join the community.'}
                                    </p>
                                    {!selectedGenre && (
                                        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
                                            <Search size={15} color={SUB} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search genres…"
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 38px 12px 42px', background: 'rgba(28,31,42,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: TEXT, fontSize: 14, outline: 'none', fontFamily: FONT }} />
                                            {search && (
                                                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── BODY ── */}
                        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 48px', boxSizing: 'border-box' }}>

                            {!selectedGenre ? (
                                /* ── GENRE GRID ── */
                                <>
                                    <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                                        {[
                                            { label: 'Genres', value: topLevel.length, icon: Music, color: PRIMARY },
                                            { label: 'Total Tracks', value: totalTracks, icon: TrendingUp, color: SECONDARY },
                                            { label: 'Artists', value: totalArtists, icon: Users, color: TERTIARY },
                                        ].map(s => {
                                            const Icon = s.icon;
                                            return (
                                                <div key={s.label} style={{ ...glass, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Icon size={15} color={s.color} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{fmtNum(s.value)}</div>
                                                        <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {genreLoading ? (
                                        <div style={{ textAlign: 'center', padding: '60px 0', color: SUB }}>Loading genres…</div>
                                    ) : filtered.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                            <Search size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No genres found</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                                            {filtered.map(g => {
                                                const accent = genreAccent(g.name);
                                                const bgGrad = genreColor(g.name);
                                                const subbed = subscribedIds.has(g.id);
                                                return (
                                                    <div key={g.id} onClick={() => selectGenre(g)}
                                                        style={{ ...glass, borderRadius: 18, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s, transform 0.15s' }}
                                                        onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${accent}55`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                        onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
                                                        <div style={{ height: 72, background: bgGrad, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,19,29,0.6) 100%)' }} />
                                                            <Music size={30} color={`${accent}30`} strokeWidth={1.5} />
                                                            <div style={{ position: 'absolute', bottom: 8, left: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Music size={12} color={accent} />
                                                                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{g.name}</span>
                                                            </div>
                                                            {subbed && (
                                                                <div style={{ position: 'absolute', top: 8, right: 10 }}>
                                                                    <span style={{ background: `${PRIMARY}33`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '2px 7px', borderRadius: 9999, fontSize: 9, fontWeight: 800 }}>JOINED</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ padding: '12px 16px 14px' }}>
                                                            <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                                                                <div>
                                                                    <div style={{ fontSize: 16, fontWeight: 900, color: accent, lineHeight: 1 }}>{fmtNum(g._count?.tracks)}</div>
                                                                    <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Tracks</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 16, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{fmtNum(g._count?.profiles)}</div>
                                                                    <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Artists</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 16, fontWeight: 900, color: SECONDARY, lineHeight: 1 }}>{fmtNum(g._count?.subscriptions)}</div>
                                                                    <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Members</div>
                                                                </div>
                                                            </div>
                                                            {g.children.length > 0 && (
                                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                                    {g.children.slice(0, 3).map(c => (
                                                                        <span key={c.id} style={{ padding: '2px 7px', borderRadius: 9999, background: `${accent}10`, border: `1px solid ${accent}25`, fontSize: 10, color: `${accent}cc`, fontWeight: 600 }}>{c.name}</span>
                                                                    ))}
                                                                    {g.children.length > 3 && (
                                                                        <span style={{ padding: '2px 7px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: SUB }}>+{g.children.length - 3}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* ── GENRE DETAIL / POST FEED ── */
                                <div>
                                    {/* Action bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                        <button onClick={() => { setSelectedGenre(null); setPosts([]); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
                                            <ChevronLeft size={13} /> Genres
                                        </button>

                                        {/* Sort tabs */}
                                        <div style={{ display: 'flex', gap: 4, background: S_CONT, borderRadius: 8, padding: 3, border: `1px solid ${BORDER}` }}>
                                            {(['hot', 'new', 'top'] as const).map(s => (
                                                <button key={s} onClick={() => setSort(s)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, background: sort === s ? PRIMARY : 'none', color: sort === s ? '#fff' : SUB, transition: 'all 0.15s' }}>
                                                    {s === 'hot' && <Flame size={11} />}
                                                    {s === 'new' && <Clock size={11} />}
                                                    {s === 'top' && <TrendingUp size={11} />}
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </button>
                                            ))}
                                        </div>

                                        {sort === 'top' && (
                                            <div style={{ display: 'flex', gap: 3 }}>
                                                {(['day', 'week', 'month', 'alltime'] as const).map(p => (
                                                    <button key={p} onClick={() => setPeriod(p)}
                                                        style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${period === p ? PRIMARY : BORDER}`, background: period === p ? `${PRIMARY}18` : 'none', color: period === p ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                                        {p === 'alltime' ? 'All time' : p.charAt(0).toUpperCase() + p.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                            <button onClick={() => setShowCreate(true)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
                                                <Plus size={14} /> Create Post
                                            </button>
                                            <button onClick={toggleSubscribe} disabled={subLoading}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: isSubscribed ? S_CONT : `${SECONDARY}18`, border: `1px solid ${isSubscribed ? BORDER : SECONDARY}`, borderRadius: 8, color: isSubscribed ? SUB : SECONDARY, cursor: subLoading ? 'wait' : 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
                                                {isSubscribed ? <><BellOff size={14} /> Joined</> : <><Bell size={14} /> Join</>}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sub-genre pills */}
                                    {selectedGenre.children.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                                            {selectedGenre.children.map(c => (
                                                <button key={c.id} onClick={() => selectGenre(c)}
                                                    style={{ padding: '4px 12px', borderRadius: 9999, background: `${genreAccent(c.name)}18`, border: `1px solid ${genreAccent(c.name)}44`, color: genreAccent(c.name), fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Post feed */}
                                    {postsLoading && posts.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>Loading posts…</div>
                                    ) : posts.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 18, padding: '60px 24px', textAlign: 'center' }}>
                                            <FileText size={36} color={SUB} style={{ marginBottom: 14 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No posts yet</div>
                                            <div style={{ fontSize: 13, color: SUB, marginBottom: 18 }}>Be the first to post in {selectedGenre.name}.</div>
                                            <button onClick={() => setShowCreate(true)}
                                                style={{ padding: '9px 20px', background: PRIMARY, border: 'none', borderRadius: 9, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>
                                                Create First Post
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {posts.map(p => (
                                                <GenrePostCard key={p.id} post={p} onVote={handleVote} />
                                            ))}
                                            {hasMore && (
                                                <button onClick={() => fetchPosts(selectedGenre.id, sort, period, nextCursor!)} disabled={postsLoading}
                                                    style={{ padding: '11px 0', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, color: SUB, cursor: postsLoading ? 'wait' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                                                    {postsLoading ? 'Loading…' : 'Load more'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <AltActivitySidebar />
                </div>
            </main>

            {showCreate && selectedGenre && (
                <CreatePostModal
                    genreId={selectedGenre.id}
                    genreName={selectedGenre.name}
                    onClose={() => setShowCreate(false)}
                    onCreated={post => setPosts(prev => [post, ...prev])}
                />
            )}
        </div>
    );
};
