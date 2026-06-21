/**
 * Alt F — Genres (/preview/alt_f_genres, /preview/alt_f_genres/:slug, ?g=slug1,slug2, ?group=id)
 * Genre grid with subreddit-style feeds, multi-select, and saveable genre groups.
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Music, Play, Pause, Search, X, TrendingUp, Users,
    ChevronUp, ChevronDown, MessageCircle, Clock, Flame, Plus, Bell, BellOff,
    FileText, Layers, BookMarked, Trash2, Check, ChevronLeft,
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
    return `hsl(${h % 360},60%,65%)`;
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
    track?: { id: string; title: string; slug: string; coverUrl?: string | null; url?: string; mp3Url?: string | null; duration?: number; waveformPeaks?: number[] | null; profile?: { username: string; displayName?: string | null } } | null;
    userVote: 'up' | 'down' | null;
}
interface GenreGroup {
    id: string; name: string; userId: string; createdAt: string;
    genres: { genre: { id: string; name: string; slug: string } }[];
}

// ── GenrePostCard ──────────────────────────────────────────────────────────────
const GenrePostCard: React.FC<{
    post: GenrePost; onVote: (id: string, type: 'up' | 'down') => void; showGenre?: boolean;
}> = ({ post, onVote, showGenre }) => {
    const { player, setTrack, togglePlay } = usePlayer();
    const [hovered, setHovered] = useState(false);

    const trackUrl = post.track?.mp3Url || post.track?.url;
    const isActiveTrack = player.currentTrack?.id === post.track?.id;
    const isPlaying = isActiveTrack && player.isPlaying;
    const trackProgress = isActiveTrack ? (player.currentTime / (player.duration || post.track?.duration || 1)) : 0;

    const playTrack = () => {
        if (!trackUrl || !post.track) return;
        if (isActiveTrack) { togglePlay(); return; }
        const artist = post.track.profile?.displayName || post.track.profile?.username || post.username;
        setTrack({ id: post.track.id, title: post.track.title, artist, url: trackUrl, coverUrl: post.track.coverUrl || undefined }, []);
    };

    const upColor = post.userVote === 'up' ? PRIMARY : SUB;
    const downColor = post.userVote === 'down' ? TERTIARY : SUB;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ ...glass, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, transition: 'border-color 0.15s', borderColor: hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.1)' }}
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

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/preview/alt_f_genre_post/${post.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.35, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = PRIMARY)}
                        onMouseLeave={e => (e.currentTarget.style.color = TEXT)}>
                        {post.type === 'discussion' && <FileText size={13} color={SECONDARY} style={{ marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />}
                        {post.type === 'track' && <Music size={13} color={PRIMARY} style={{ marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />}
                        {post.title}
                    </p>
                </Link>

                {post.type === 'track' && post.track && (() => {
                    const peaks: number[] = post.track.waveformPeaks || [];
                    const artist = post.track.profile?.displayName || post.track.profile?.username || '';
                    return (
                        <div style={{ borderRadius: 12, overflow: 'hidden', background: S_CONT, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                            <div style={{ display: 'flex' }}>
                                {/* Cover art with play overlay */}
                                <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                                    {post.track.coverUrl
                                        ? <img src={post.track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        : <div style={{ width: '100%', height: '100%', background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={24} color={SUB} /></div>
                                    }
                                    <button onClick={playTrack} style={{ position: 'absolute', inset: 0, background: isPlaying ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.5)', border: 'none', cursor: trackUrl ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: isPlaying ? PRIMARY : 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                                            {isPlaying
                                                ? <Pause size={14} color="#fff" fill="#fff" />
                                                : <Play  size={14} color="#111" fill="#111" style={{ marginLeft: 2 }} />}
                                        </div>
                                    </button>
                                    {isPlaying && <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 2px ${PRIMARY}`, pointerEvents: 'none' }} />}
                                </div>

                                {/* Right: title + waveform */}
                                <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isPlaying ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.track.title}</div>
                                        <div style={{ fontSize: 11, color: SUB, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {artist && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</span>}
                                            {post.track.duration && <span style={{ flexShrink: 0, color: `${SUB}99` }}>{fmtDur(post.track.duration)}</span>}
                                        </div>
                                    </div>
                                    {/* Waveform */}
                                    <div style={{ flex: 1, minHeight: 36, cursor: trackUrl ? 'pointer' : 'default' }} onClick={playTrack}>
                                        {peaks.length > 0 ? (
                                            <svg width="100%" height="36" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 36`} style={{ display: 'block' }}>
                                                {peaks.map((peak, i) => {
                                                    const h = Math.max(2, peak * 28); const y = (36 - h) / 2;
                                                    const played = isActiveTrack && (i / peaks.length) < trackProgress;
                                                    return <rect key={i} x={i} y={y} width={0.7} height={h} fill={played ? PRIMARY : 'rgba(255,255,255,0.18)'} rx={0.3} />;
                                                })}
                                            </svg>
                                        ) : (() => {
                                            let h = 5381;
                                            for (const c of post.track!.id) h = (h * 33 ^ c.charCodeAt(0)) >>> 0;
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

                {post.type === 'discussion' && post.body && (
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: SUB, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                        {post.body}
                    </p>
                )}

                {post.type === 'discussion' && post.imageUrl && (
                    <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover', marginBottom: 8, display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                )}

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
                            <Link to={`/preview/alt_f_genres/${post.genre.slug}`} style={{ color: genreAccent(post.genre.name), fontWeight: 600, textDecoration: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                                {post.genre.name}
                            </Link>
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
const CreatePostModal: React.FC<{
    genreId: string; genreName: string; onClose: () => void; onCreated: (post: GenrePost) => void;
}> = ({ genreId, genreName, onClose, onCreated }) => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!title.trim()) { setErr('Title is required'); return; }
        setSaving(true); setErr('');
        try {
            const r = await axios.post('/api/genre-posts', { genreId, title, body, type: 'discussion' }, { withCredentials: true });
            onCreated(r.data); onClose();
        } catch (e: any) { setErr(e.response?.data?.error || 'Failed to post'); }
        finally { setSaving(false); }
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

// ── Save Group Modal ───────────────────────────────────────────────────────────
const SaveGroupModal: React.FC<{
    genreNames: string[]; onSave: (name: string) => Promise<void>; onClose: () => void;
}> = ({ genreNames, onSave, onClose }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!name.trim()) return;
        setSaving(true);
        await onSave(name.trim());
        setSaving(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ ...glass, borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, fontFamily: FONT }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: TEXT }}>Save Genre Group</h3>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: SUB }}>Includes: {genreNames.join(', ')}</p>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My EDM Mix, Chill Sessions…" autoFocus
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 14 }}>Cancel</button>
                    <button onClick={submit} disabled={saving || !name.trim()} style={{ padding: '9px 18px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, opacity: (saving || !name.trim()) ? 0.6 : 1 }}>
                        {saving ? 'Saving…' : 'Save Group'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const FrontpageAltFGenres: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { player } = usePlayer();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ── Parse URL ─────────────────────────────────────────────────────────────
    const { genreSlug, multiSlugsFromUrl, groupIdFromUrl } = useMemo(() => {
        const pathAfter = location.pathname.replace('/preview/alt_f_genres', '');
        const segments = pathAfter.split('/').filter(Boolean);
        const sp = new URLSearchParams(location.search);
        return {
            genreSlug: segments[0] || null,
            multiSlugsFromUrl: sp.get('g')?.split(',').filter(Boolean) || [],
            groupIdFromUrl: sp.get('group') || null,
        };
    }, [location]);

    // ── Data state ────────────────────────────────────────────────────────────
    const [genres, setGenres] = useState<Genre[]>([]);
    const [genreLoading, setGenreLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [posts, setPosts] = useState<GenrePost[]>([]);
    const [postsLoading, setPostsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [sort, setSort] = useState<'hot' | 'new' | 'top'>('hot');
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'alltime'>('week');
    const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
    const [subLoading, setSubLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [groups, setGroups] = useState<GenreGroup[]>([]);
    const [showSubgenreDropdown, setShowSubgenreDropdown] = useState(false);
    const [selectedSubSlugs, setSelectedSubSlugs] = useState<Set<string>>(new Set());
    const [showSaveGroup, setShowSaveGroup] = useState(false);
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());

    // ── Derived from genres list ──────────────────────────────────────────────
    const allGenres = useMemo(() => {
        const flat: Genre[] = [];
        const walk = (gs: Genre[]) => gs.forEach(g => { flat.push(g); walk(g.children || []); });
        walk(genres);
        return flat;
    }, [genres]);

    const viewMode = useMemo((): 'grid' | 'single' | 'multi' | 'group' => {
        if (groupIdFromUrl) return 'group';
        if (multiSlugsFromUrl.length > 0) return 'multi';
        if (genreSlug) return 'single';
        return 'grid';
    }, [genreSlug, multiSlugsFromUrl, groupIdFromUrl]);

    const activeGenre = useMemo(() =>
        genreSlug ? allGenres.find(g => g.slug === genreSlug) || null : null,
        [allGenres, genreSlug]);

    const activeGroup = useMemo(() =>
        groupIdFromUrl ? groups.find(g => g.id === groupIdFromUrl) || null : null,
        [groups, groupIdFromUrl]);

    const activeGenreIds = useMemo(() => {
        if (viewMode === 'single' && activeGenre) return [activeGenre.id];
        if (viewMode === 'multi') return multiSlugsFromUrl.map(s => allGenres.find(g => g.slug === s)?.id).filter(Boolean) as string[];
        return [];
    }, [viewMode, activeGenre, multiSlugsFromUrl, allGenres]);

    const activeGenreNames = useMemo(() =>
        activeGenreIds.map(id => allGenres.find(g => g.id === id)?.name || '').filter(Boolean),
        [activeGenreIds, allGenres]);

    // Subgenres shown in dropdown (children of active genre, or siblings if active is a child)
    const subgenres = useMemo(() => {
        if (!activeGenre) return [];
        if (activeGenre.children?.length > 0) return activeGenre.children;
        if (activeGenre.parentId) {
            const parent = allGenres.find(g => g.id === activeGenre.parentId);
            return parent?.children || [];
        }
        return [];
    }, [activeGenre, allGenres]);

    const topLevel = useMemo(() => genres.filter(g => !g.parentId), [genres]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return topLevel;
        return topLevel.filter(g => g.name.toLowerCase().includes(q) || (g.children || []).some(c => c.name.toLowerCase().includes(q)));
    }, [topLevel, search]);

    // ── Load data on mount ────────────────────────────────────────────────────
    useEffect(() => {
        axios.get('/api/musician/genres').then(r => { setGenres(arr(r.data)); setGenreLoading(false); }).catch(() => setGenreLoading(false));
        axios.get('/api/genre-subscriptions', { withCredentials: true }).then(r => { setSubscribedIds(new Set(arr(r.data.genreIds))); }).catch(() => {});
        axios.get('/api/genre-groups', { withCredentials: true }).then(r => { setGroups(arr(r.data)); }).catch(() => {});
    }, []);

    // ── Fetch posts on view change ────────────────────────────────────────────
    const fetchPosts = useCallback(async (params: Record<string, string>, cursor?: string) => {
        setPostsLoading(true);
        try {
            const r = await axios.get('/api/genre-posts', { params: { ...params, ...(cursor ? { cursor } : {}) } });
            if (cursor) setPosts(prev => [...prev, ...arr(r.data.posts)]);
            else setPosts(arr(r.data.posts));
            setHasMore(r.data.hasMore);
            setNextCursor(r.data.nextCursor);
        } catch {}
        finally { setPostsLoading(false); }
    }, []);

    const buildParams = useCallback(() => {
        const p: Record<string, string> = { sort };
        if (sort === 'top') p.period = period;
        if (viewMode === 'group' && groupIdFromUrl) { p.groupId = groupIdFromUrl; }
        else if (activeGenreIds.length > 0) { p.genreIds = activeGenreIds.join(','); }
        return p;
    }, [viewMode, groupIdFromUrl, activeGenreIds, sort, period]);

    useEffect(() => {
        if (genres.length === 0) return;
        if (viewMode === 'grid') return;
        if (viewMode === 'group' && !groupIdFromUrl) return;
        if (viewMode !== 'group' && activeGenreIds.length === 0) return;
        setPosts([]);
        setNextCursor(null);
        fetchPosts(buildParams());
        setSelectedSubSlugs(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [genres, viewMode, activeGenreIds.join(','), groupIdFromUrl, sort, period]);

    // ── Close dropdown on outside click ──────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowSubgenreDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleVote = async (postId: string, type: 'up' | 'down') => {
        try {
            const r = await axios.post(`/api/genre-posts/${postId}/vote`, { type }, { withCredentials: true });
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: r.data.score, upvotes: r.data.upvotes, downvotes: r.data.downvotes, userVote: r.data.userVote } : p));
        } catch {}
    };

    const toggleSubscribe = async (genreId?: string) => {
        const id = genreId || activeGenre?.id;
        if (!id) return;
        setSubLoading(true);
        try {
            if (subscribedIds.has(id)) {
                await axios.delete(`/api/genre-subscriptions/${id}`, { withCredentials: true });
                setSubscribedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
            } else {
                await axios.post(`/api/genre-subscriptions/${id}`, {}, { withCredentials: true });
                setSubscribedIds(prev => new Set([...prev, id]));
            }
        } catch {}
        finally { setSubLoading(false); }
    };

    const handleSaveGroup = async (name: string) => {
        try {
            const genreIds = viewMode === 'group'
                ? (activeGroup?.genres.map(g => g.genre.id) || [])
                : activeGenreIds;
            const r = await axios.post('/api/genre-groups', { name, genreIds }, { withCredentials: true });
            setGroups(prev => [...prev, r.data]);
            setShowSaveGroup(false);
        } catch {}
    };

    const handleDeleteGroup = async () => {
        if (!groupIdFromUrl) return;
        try {
            await axios.delete(`/api/genre-groups/${groupIdFromUrl}`, { withCredentials: true });
            setGroups(prev => prev.filter(g => g.id !== groupIdFromUrl));
            navigate('/preview/alt_f_genres');
        } catch {}
    };

    const applySubgenreFilter = () => {
        setShowSubgenreDropdown(false);
        if (!activeGenre) return;
        if (selectedSubSlugs.size === 0) return;
        const slugs = [activeGenre.slug, ...Array.from(selectedSubSlugs)];
        navigate(`/preview/alt_f_genres?g=${slugs.join(',')}`);
    };

    const removeSlugFromMulti = (slug: string) => {
        const newSlugs = multiSlugsFromUrl.filter(s => s !== slug);
        if (newSlugs.length === 0) navigate('/preview/alt_f_genres');
        else if (newSlugs.length === 1) navigate(`/preview/alt_f_genres/${newSlugs[0]}`);
        else navigate(`/preview/alt_f_genres?g=${newSlugs.join(',')}`);
    };

    const viewMultiSelected = () => {
        if (multiSelected.size === 0) return;
        if (multiSelected.size === 1) navigate(`/preview/alt_f_genres/${Array.from(multiSelected)[0]}`);
        else navigate(`/preview/alt_f_genres?g=${Array.from(multiSelected).join(',')}`);
        setMultiSelectMode(false);
        setMultiSelected(new Set());
    };

    // ── Computed view values ──────────────────────────────────────────────────
    const totalTracks = topLevel.reduce((s, g) => s + (g._count?.tracks || 0), 0);
    const totalArtists = topLevel.reduce((s, g) => s + (g._count?.profiles || 0), 0);
    const pb = player.currentTrack ? 90 : 0;
    const isSubscribed = activeGenre ? subscribedIds.has(activeGenre.id) : false;

    const breadcrumb = useMemo(() => {
        if (viewMode === 'grid') return [{ label: 'Genres' }];
        if (viewMode === 'group' && activeGroup) return [{ label: 'Genres', to: '/preview/alt_f_genres' }, { label: activeGroup.name }];
        if (viewMode === 'multi') return [{ label: 'Genres', to: '/preview/alt_f_genres' }, { label: `${activeGenreIds.length} Genres` }];
        if (activeGenre) {
            const crumbs: any[] = [{ label: 'Genres', to: '/preview/alt_f_genres' }];
            if (activeGenre.parentId) {
                const parent = allGenres.find(g => g.id === activeGenre.parentId);
                if (parent) crumbs.push({ label: parent.name, to: `/preview/alt_f_genres/${parent.slug}` });
            }
            crumbs.push({ label: activeGenre.name });
            return crumbs;
        }
        return [{ label: 'Genres', to: '/preview/alt_f_genres' }];
    }, [viewMode, activeGroup, activeGenre, activeGenreIds.length, allGenres]);

    // ── Feed create genre (for modal) ─────────────────────────────────────────
    const createGenreId = viewMode === 'single' ? activeGenre?.id : multiSlugsFromUrl.length > 0 ? allGenres.find(g => g.slug === multiSlugsFromUrl[0])?.id : undefined;
    const createGenreName = viewMode === 'single' ? (activeGenre?.name || 'Genre') : activeGenreNames[0] || 'Genre';

    // ── Common sort bar ───────────────────────────────────────────────────────
    const SortBar = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: S_CONT, borderRadius: 8, padding: 3, border: `1px solid ${BORDER}` }}>
                {(['hot', 'new', 'top'] as const).map(s => (
                    <button key={s} onClick={() => setSort(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, background: sort === s ? PRIMARY : 'none', color: sort === s ? '#fff' : SUB, transition: 'all 0.15s' }}>
                        {s === 'hot' && <Flame size={11} />}{s === 'new' && <Clock size={11} />}{s === 'top' && <TrendingUp size={11} />}
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
        </div>
    );

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={breadcrumb} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: pb }}>

                        {/* ── Hero ── */}
                        <section style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a3a 0%, #1a0a2a 40%, #0f131d 100%)' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.2) 70%, transparent 100%)' }} />
                            {topLevel.slice(0, 8).map((g, i) => (
                                <div key={g.id} style={{ position: 'absolute', width: 1, height: 1, left: `${8 + i * 12}%`, top: `${20 + (i % 3) * 25}%`, boxShadow: `0 0 ${60 + i * 10}px ${28 + i * 6}px ${genreAccent(g.name)}12`, borderRadius: '50%' }} />
                            ))}
                            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 20px', textAlign: 'center', boxSizing: 'border-box' }}>
                                    <h1 style={{ margin: '0 0 6px', fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
                                        {viewMode === 'group' && activeGroup ? activeGroup.name
                                            : viewMode === 'multi' ? `${activeGenreIds.length} Genres`
                                            : viewMode === 'single' && activeGenre ? activeGenre.name
                                            : 'Explore Genres'}
                                    </h1>
                                    <p style={{ margin: '0 0 16px', color: 'rgba(159,166,185,0.85)', fontSize: 13 }}>
                                        {viewMode === 'single' && activeGenre
                                            ? `${fmtNum(activeGenre._count?.tracks)} tracks · ${fmtNum(activeGenre._count?.profiles)} artists · ${fmtNum(activeGenre._count?.subscriptions)} members`
                                            : viewMode === 'group' && activeGroup
                                            ? activeGroup.genres.map(g => g.genre.name).join(' · ')
                                            : viewMode === 'multi'
                                            ? activeGenreNames.join(' · ')
                                            : 'Subscribe to genres and join the community.'}
                                    </p>
                                    {viewMode === 'grid' && (
                                        <div style={{ position: 'relative', width: '100%', maxWidth: 400, margin: '0 auto' }}>
                                            <Search size={15} color={SUB} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search genres…"
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 38px 11px 42px', background: 'rgba(28,31,42,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: TEXT, fontSize: 14, outline: 'none', fontFamily: FONT }} />
                                            {search && (
                                                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}><X size={14} /></button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── Body ── */}
                        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 48px', boxSizing: 'border-box' }}>

                            {viewMode === 'grid' ? (
                                /* ── GENRE GRID ── */
                                <>
                                    {/* My Groups strip */}
                                    {groups.length > 0 && (
                                        <div style={{ marginBottom: 28 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Layers size={12} /> My Groups
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                                                {groups.map(group => {
                                                    const firstGenreName = group.genres[0]?.genre.name || '';
                                                    const accent = firstGenreName ? genreAccent(firstGenreName) : PRIMARY;
                                                    return (
                                                        <Link key={group.id} to={`/preview/alt_f_genres?group=${group.id}`}
                                                            style={{ ...glass, borderRadius: 12, padding: '12px 16px', minWidth: 160, maxWidth: 220, flexShrink: 0, textDecoration: 'none', display: 'block', transition: 'border-color 0.15s', borderColor: 'rgba(255,255,255,0.1)' }}
                                                            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}55`)}
                                                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                                <div style={{ width: 28, height: 28, borderRadius: 6, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    <BookMarked size={13} color={accent} />
                                                                </div>
                                                                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
                                                            </div>
                                                            <div style={{ fontSize: 11, color: SUB, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                                {group.genres.map(g => g.genre.name).join(' · ')}
                                                            </div>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stats + multi-select toggle */}
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
                                                        <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>{s.label}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {multiSelectMode && multiSelected.size > 0 && (
                                                <button onClick={viewMultiSelected}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
                                                    View {multiSelected.size} Genre{multiSelected.size > 1 ? 's' : ''} →
                                                </button>
                                            )}
                                            <button onClick={() => { setMultiSelectMode(m => !m); setMultiSelected(new Set()); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: multiSelectMode ? `${PRIMARY}18` : S_CONT, border: `1px solid ${multiSelectMode ? PRIMARY : BORDER}`, borderRadius: 8, color: multiSelectMode ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                                <Layers size={12} /> {multiSelectMode ? 'Cancel' : 'Multi-select'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Genre grid */}
                                    {genreLoading ? (
                                        <div style={{ textAlign: 'center', padding: '60px 0', color: SUB }}>Loading genres…</div>
                                    ) : filtered.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                            <Search size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No genres found</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                                            {filtered.map(g => {
                                                const accent = genreAccent(g.name);
                                                const bgGrad = genreColor(g.name);
                                                const subbed = subscribedIds.has(g.id);
                                                const isSelected = multiSelected.has(g.slug);
                                                return (
                                                    <Link key={g.id}
                                                        to={`/preview/alt_f_genres/${g.slug}`}
                                                        onClick={multiSelectMode ? (e) => {
                                                            e.preventDefault();
                                                            setMultiSelected(prev => { const s = new Set(prev); if (s.has(g.slug)) s.delete(g.slug); else s.add(g.slug); return s; });
                                                        } : undefined}
                                                        style={{ ...glass, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', transition: 'border-color 0.2s, transform 0.15s', borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.1)' }}
                                                        onMouseEnter={ev => { ev.currentTarget.style.borderColor = isSelected ? PRIMARY : `${accent}55`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                        onMouseLeave={ev => { ev.currentTarget.style.borderColor = isSelected ? PRIMARY : 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
                                                        <div style={{ height: 72, background: bgGrad, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,19,29,0.6) 100%)' }} />
                                                            <Music size={30} color={`${accent}30`} strokeWidth={1.5} />
                                                            <div style={{ position: 'absolute', bottom: 8, left: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Music size={12} color={accent} />
                                                                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{g.name}</span>
                                                            </div>
                                                            {subbed && !multiSelectMode && (
                                                                <div style={{ position: 'absolute', top: 8, right: 10 }}>
                                                                    <span style={{ background: `${PRIMARY}33`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, padding: '2px 7px', borderRadius: 9999, fontSize: 9, fontWeight: 800 }}>JOINED</span>
                                                                </div>
                                                            )}
                                                            {multiSelectMode && (
                                                                <div style={{ position: 'absolute', top: 8, right: 10, width: 20, height: 20, borderRadius: 6, background: isSelected ? PRIMARY : 'rgba(0,0,0,0.5)', border: `2px solid ${isSelected ? PRIMARY : 'rgba(255,255,255,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {isSelected && <Check size={12} color="#fff" />}
                                                                </div>
                                                            )}
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
                                                                <div>
                                                                    <div style={{ fontSize: 15, fontWeight: 900, color: SECONDARY, lineHeight: 1 }}>{fmtNum(g._count?.subscriptions)}</div>
                                                                    <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>Members</div>
                                                                </div>
                                                            </div>
                                                            {g.children.length > 0 && (
                                                                <div style={{ fontSize: 11, color: SUB }}>
                                                                    {g.children.slice(0, 4).map(c => c.name).join(' · ')}{g.children.length > 4 ? ` +${g.children.length - 4}` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* ── FEED VIEW (single / multi / group) ── */
                                <div>
                                    {/* Action bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                                        <Link to="/preview/alt_f_genres"
                                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, textDecoration: 'none', fontSize: 13 }}>
                                            <ChevronLeft size={13} /> Genres
                                        </Link>

                                        <SortBar />

                                        {/* Subgenre dropdown */}
                                        {viewMode === 'single' && subgenres.length > 0 && (
                                            <div ref={dropdownRef} style={{ position: 'relative' }}>
                                                <button onClick={() => setShowSubgenreDropdown(d => !d)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: showSubgenreDropdown ? `${PRIMARY}12` : S_CONT, border: `1px solid ${showSubgenreDropdown ? PRIMARY : BORDER}`, borderRadius: 8, color: showSubgenreDropdown ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, transition: 'all 0.15s' }}>
                                                    Subgenres <ChevronDown size={11} />
                                                </button>
                                                {showSubgenreDropdown && (
                                                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, ...glass, borderRadius: 12, padding: '14px 16px', minWidth: 200 }}>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Filter by subgenre</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            {subgenres.map(sg => {
                                                                const checked = selectedSubSlugs.has(sg.slug);
                                                                return (
                                                                    <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '5px 4px', borderRadius: 6, transition: 'background 0.1s' }}
                                                                        onMouseEnter={e => (e.currentTarget.style.background = S_HIGH)}
                                                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                                                        <div style={{ width: 16, height: 16, borderRadius: 4, background: checked ? PRIMARY : 'none', border: `2px solid ${checked ? PRIMARY : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                                                                            onClick={() => setSelectedSubSlugs(prev => { const s = new Set(prev); if (s.has(sg.slug)) s.delete(sg.slug); else s.add(sg.slug); return s; })}>
                                                                            {checked && <Check size={10} color="#fff" />}
                                                                        </div>
                                                                        <span style={{ fontSize: 13, color: TEXT }}>{sg.name}</span>
                                                                        <span style={{ fontSize: 11, color: SUB, marginLeft: 'auto' }}>{fmtNum(sg._count?.tracks)}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 6 }}>
                                                            <button onClick={() => { setSelectedSubSlugs(new Set()); navigate(`/preview/alt_f_genres/${activeGenre!.slug}`); setShowSubgenreDropdown(false); }}
                                                                style={{ flex: 1, padding: '6px 0', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}>
                                                                All posts
                                                            </button>
                                                            <button onClick={applySubgenreFilter} disabled={selectedSubSlugs.size === 0}
                                                                style={{ flex: 1, padding: '6px 0', background: selectedSubSlugs.size > 0 ? PRIMARY : S_CONT, border: 'none', borderRadius: 6, color: selectedSubSlugs.size > 0 ? '#fff' : SUB, cursor: selectedSubSlugs.size > 0 ? 'pointer' : 'not-allowed', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                                                {selectedSubSlugs.size > 0 ? `Apply (${selectedSubSlugs.size})` : 'Select genres'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Right-side buttons */}
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                            {(viewMode === 'multi' || viewMode === 'group') && (
                                                <button onClick={() => setShowSaveGroup(true)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SECONDARY, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                                    <BookMarked size={12} /> Save Group
                                                </button>
                                            )}
                                            {viewMode !== 'group' && createGenreId && (
                                                <button onClick={() => setShowCreate(true)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
                                                    <Plus size={13} /> Post
                                                </button>
                                            )}
                                            {viewMode === 'single' && activeGenre && (
                                                <button onClick={() => toggleSubscribe()} disabled={subLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: isSubscribed ? S_CONT : `${SECONDARY}18`, border: `1px solid ${isSubscribed ? BORDER : SECONDARY}`, borderRadius: 8, color: isSubscribed ? SUB : SECONDARY, cursor: subLoading ? 'wait' : 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                                    {isSubscribed ? <><BellOff size={13} /> Joined</> : <><Bell size={13} /> Join</>}
                                                </button>
                                            )}
                                            {viewMode === 'group' && (
                                                <button onClick={handleDeleteGroup}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TERTIARY, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                                    <Trash2 size={12} /> Delete Group
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Multi-genre pills (removable) */}
                                    {viewMode === 'multi' && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                                            {multiSlugsFromUrl.map(slug => {
                                                const genre = allGenres.find(g => g.slug === slug);
                                                if (!genre) return null;
                                                const accent = genreAccent(genre.name);
                                                return (
                                                    <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, fontSize: 12, fontWeight: 600 }}>
                                                        <Link to={`/preview/alt_f_genres/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{genre.name}</Link>
                                                        <button onClick={() => removeSlugFromMulti(slug)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, padding: 0, display: 'flex', opacity: 0.7, lineHeight: 0 }}><X size={10} /></button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Group genre pills */}
                                    {viewMode === 'group' && activeGroup && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                                            {activeGroup.genres.map(({ genre }) => {
                                                const accent = genreAccent(genre.name);
                                                return (
                                                    <Link key={genre.id} to={`/preview/alt_f_genres/${genre.slug}`}
                                                        style={{ padding: '4px 10px', borderRadius: 9999, background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                                                        {genre.name}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Post feed */}
                                    {postsLoading && posts.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>Loading posts…</div>
                                    ) : posts.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 18, padding: '60px 24px', textAlign: 'center' }}>
                                            <FileText size={36} color={SUB} style={{ marginBottom: 14 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No posts yet</div>
                                            <div style={{ fontSize: 13, color: SUB, marginBottom: 18 }}>
                                                {viewMode === 'single' ? `Be the first to post in ${activeGenre?.name}.` : 'No posts in these genres yet.'}
                                            </div>
                                            {viewMode === 'single' && activeGenre && createGenreId && (
                                                <button onClick={() => setShowCreate(true)}
                                                    style={{ padding: '9px 20px', background: PRIMARY, border: 'none', borderRadius: 9, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>
                                                    Create First Post
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {posts.map(p => (
                                                <GenrePostCard key={p.id} post={p} onVote={handleVote} showGenre={viewMode !== 'single'} />
                                            ))}
                                            {hasMore && (
                                                <button onClick={() => fetchPosts(buildParams(), nextCursor!)} disabled={postsLoading}
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

            {showCreate && createGenreId && (
                <CreatePostModal
                    genreId={createGenreId}
                    genreName={createGenreName}
                    onClose={() => setShowCreate(false)}
                    onCreated={post => setPosts(prev => [post, ...prev])}
                />
            )}

            {showSaveGroup && (
                <SaveGroupModal
                    genreNames={viewMode === 'group' && activeGroup ? activeGroup.genres.map(g => g.genre.name) : activeGenreNames}
                    onSave={handleSaveGroup}
                    onClose={() => setShowSaveGroup(false)}
                />
            )}
        </div>
    );
};
