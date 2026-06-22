/**
 * Alt F — Activity feed (/preview/alt_f_feed)
 * Two tabs: Discover (public activity stream) and Following (auth-gated track feed).
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, S_HIGHEST,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    Play, Pause, Heart, Repeat2, UserPlus, Swords, Music,
    Rss, Users, TrendingUp, ChevronDown, Lock, MessageCircle,
    Flame, Clock, ChevronUp, Home,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };

function timeAgo(date: string): string {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function avatarGradient(seed: string) {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `linear-gradient(135deg, hsl(${hue},40%,20%) 0%, hsl(${(hue + 50) % 360},50%,26%) 100%)`;
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string; size?: number }) {
    const initials = (name || '?')[0].toUpperCase();
    return src
        ? <img src={src} referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }} />
        : <div style={{ width: size, height: size, borderRadius: '50%', background: avatarGradient(name || '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{initials}</div>;
}

const TYPE_ICONS: Record<string, { icon: any; color: string; label: string }> = {
    track_upload:  { icon: Music,          color: PRIMARY,    label: 'New Track'     },
    follow:        { icon: UserPlus,        color: SECONDARY,  label: 'Follow'        },
    battle_entry:  { icon: Swords,          color: TERTIARY,   label: 'Battle Entry'  },
    favourite:     { icon: Heart,           color: '#ff6779',  label: 'Liked'         },
    comment:       { icon: MessageCircle,   color: '#a78bfa',  label: 'Comment'       },
};

const FILTERS = ['All', 'Music', 'Battles', 'Follows', 'Comments'] as const;
type Filter = typeof FILTERS[number];
const TABS = ['Feed', 'Following', 'Discover'] as const;
type Tab = typeof TABS[number];

const filterMatch = (type: string, filter: Filter): boolean => {
    if (filter === 'All') return true;
    if (filter === 'Music') return type === 'track_upload' || type === 'favourite';
    if (filter === 'Battles') return type === 'battle_entry';
    if (filter === 'Follows') return type === 'follow';
    if (filter === 'Comments') return type === 'comment';
    return true;
};

// ── Public activity feed item ──────────────────────────────────────────────

function ActivityCard({ item, onPlay, isPlaying }: { item: any; onPlay: (item: any) => void; isPlaying: boolean }) {
    const meta = TYPE_ICONS[item.type] || TYPE_ICONS.track_upload;
    const Icon = meta.icon;
    const isTrack = item.type === 'track_upload';
    const isFav = item.type === 'favourite';
    const isFollow = item.type === 'follow';
    const isBattle = item.type === 'battle_entry';
    const isComment = item.type === 'comment';
    const hasBody = isTrack || isBattle || isComment;

    const commentTarget = isComment
        ? (item.targetType === 'track' ? item.target?.title : item.targetType === 'profile' ? item.target?.name : 'a battle entry')
        : null;

    return (
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', transition: 'border-color 0.2s' }}>
            {/* Card header row */}
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: hasBody ? `1px solid ${DIVIDER}` : 'none' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar src={item.actorAvatar} name={item.actorName} size={38} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: `${meta.color}22`, border: `1px solid ${meta.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={9} color={meta.color} />
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, color: TEXT }}>{item.actorName}</span>
                        {isTrack && <span style={{ color: SUB }}> released a new track</span>}
                        {isFav && <><span style={{ color: SUB }}> liked </span><span style={{ fontWeight: 700, color: TEXT }}>{item.target?.title}</span></>}
                        {isFollow && <><span style={{ color: SUB }}> followed </span><span style={{ fontWeight: 700, color: SECONDARY }}>{item.target?.name}</span></>}
                        {isBattle && <><span style={{ color: SUB }}> entered a battle with </span><span style={{ fontWeight: 700, color: TEXT }}>{item.target?.title || 'a track'}</span></>}
                        {isComment && <><span style={{ color: SUB }}> commented on </span><span style={{ fontWeight: 700, color: TEXT }}>{commentTarget || 'a post'}</span></>}
                    </div>
                </div>

                {isFollow && item.target?.avatar && (
                    <Avatar src={item.target.avatar} name={item.target.name} size={32} />
                )}

                {(isFav || isBattle) && item.target?.coverUrl && (
                    <img src={item.target.coverUrl} referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}

                <span style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{timeAgo(item.createdAt)}</span>
            </div>

            {/* Track preview body */}
            {isTrack && item.target && (
                <Link
                    to="/preview/alt_f_track"
                    style={{ padding: '12px 20px 14px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}
                >
                    {item.target.coverUrl && (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img src={item.target.coverUrl} referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{item.target.title}</div>
                        <div style={{ fontSize: 12, color: SUB }}>{item.actorName}</div>
                    </div>
                    <button
                        onClick={e => { e.stopPropagation(); onPlay(item); }}
                        style={{ width: 36, height: 36, borderRadius: '50%', background: isPlaying ? `${PRIMARY}22` : PRIMARY, border: isPlaying ? `1px solid ${PRIMARY}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                        {isPlaying ? <Pause size={14} color={PRIMARY} /> : <Play size={14} fill="#fff" color="#fff" />}
                    </button>
                </Link>
            )}

            {/* Battle entry body */}
            {isBattle && item.target && (
                <div style={{ padding: '10px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Swords size={14} color={TERTIARY} />
                    <span style={{ fontSize: 13, color: SUB }}>Submitted to a battle — </span>
                    <Link to="/preview/alt_f_battle" style={{ fontSize: 13, color: TERTIARY, fontWeight: 700, textDecoration: 'none' }}>View Battle →</Link>
                </div>
            )}

            {/* Comment body */}
            {isComment && item.content && (
                <div style={{ padding: '10px 20px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {item.target?.coverUrl && (
                        <img src={item.target.coverUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
                    )}
                    <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.5, fontStyle: 'italic' }}>
                        "{item.content.length > 140 ? item.content.slice(0, 140) + '…' : item.content}"
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Following feed track item ──────────────────────────────────────────────

function TrackFeedCard({ track, onPlay, isPlaying }: { track: any; onPlay: (t: any) => void; isPlaying: boolean }) {
    const genres = (track.genres || []).map((g: any) => g.genre?.name).filter(Boolean).slice(0, 2);
    const isRepost = !!track.repostedBy;

    return (
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', transition: 'border-color 0.2s' }}>
            {isRepost && (
                <div style={{ padding: '8px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: SUB }}>
                    <Repeat2 size={11} /> Reposted {timeAgo(track.repostedAt)}
                </div>
            )}

            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Artist avatar */}
                <Avatar src={track.profile?.avatar} name={track.profile?.displayName || track.profile?.username} size={36} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: SUB, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, color: TEXT }}>{track.profile?.displayName || track.profile?.username}</span>
                        <span> · {timeAgo(track.createdAt)}</span>
                    </div>

                    {/* Track preview */}
                    <Link
                        to="/preview/alt_f_track"
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', textDecoration: 'none', color: 'inherit' }}
                    >
                        {track.coverUrl && (
                            <img src={track.coverUrl} referrerPolicy="no-referrer" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{track.title}</div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {genres.map((g: string) => (
                                    <span key={g} style={{ padding: '2px 7px', borderRadius: 4, background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}30`, fontSize: 10, color: SECONDARY, fontWeight: 600 }}>{g}</span>
                                ))}
                                {track.duration && <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', fontSize: 10, color: SUB }}>{fmtDur(track.duration)}</span>}
                            </div>
                        </div>
                    </Link>

                    {/* Engagement row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 8, borderTop: `1px solid ${DIVIDER}` }}>
                        {[
                            { icon: Play,    val: fmtNum(track.playCount) },
                            { icon: Heart,   val: fmtNum(track._count?.favourites) },
                            { icon: Repeat2, val: fmtNum(track._count?.reposts) },
                        ].map(({ icon: Icon, val }, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SUB }}>
                                <Icon size={12} /> {val}
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => onPlay(track)}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: isPlaying ? `${PRIMARY}22` : PRIMARY, border: isPlaying ? `1px solid ${PRIMARY}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: isPlaying ? 'none' : `0 0 16px ${PRIMARY}44` }}
                >
                    {isPlaying ? <Pause size={15} color={PRIMARY} /> : <Play size={15} fill="#fff" color="#fff" />}
                </button>
            </div>
        </div>
    );
}

// ── Genre post card (for Genres tab) ─────────────────────────────────────
function genreAccent(name: string): string {
    let h = 5381;
    for (const c of name) h = (h * 33 ^ c.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

function GenrePostFeedCard({ post, onVote }: { post: any; onVote: (id: string, t: 'up' | 'down') => void }) {
    const { player, setTrack, togglePlay } = usePlayer();
    const [hov, setHov] = useState(false);
    const isPlaying = post.track && player.currentTrack?.id === post.track.id && player.isPlaying;
    const playTrack = () => {
        if (!post.track?.url) return;
        if (player.currentTrack?.id === post.track.id) { togglePlay(); return; }
        setTrack({ id: post.track.id, title: post.track.title, artist: post.track.profile?.displayName || post.username, url: post.track.url, coverUrl: post.track.coverUrl }, []);
    };
    const accent = post.genre ? genreAccent(post.genre.name) : PRIMARY;
    return (
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ ...glass, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, borderColor: hov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.1)', transition: 'border-color 0.15s' }}>
            {/* Vote */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 36, paddingTop: 2 }}>
                <button onClick={() => onVote(post.id, 'up')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: post.userVote === 'up' ? PRIMARY : SUB, padding: 2, display: 'flex' }}><ChevronUp size={16} /></button>
                <span style={{ fontSize: 12, fontWeight: 700, color: post.score > 0 ? PRIMARY : post.score < 0 ? TERTIARY : SUB }}>{post.score}</span>
                <button onClick={() => onVote(post.id, 'down')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: post.userVote === 'down' ? TERTIARY : SUB, padding: 2, display: 'flex' }}><ChevronDown size={16} /></button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    {post.genre && <span style={{ background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, padding: '1px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>{post.genre.name}</span>}
                    <span style={{ fontSize: 11, color: SUB }}>{post.type === 'track' ? '🎵 Track' : '💬 Discussion'}</span>
                </div>
                <Link to={`/preview/alt_f_genre_post/${post.id}`} style={{ textDecoration: 'none' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: TEXT, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = PRIMARY)} onMouseLeave={e => (e.currentTarget.style.color = TEXT)}>
                        {post.title}
                    </p>
                </Link>
                {post.type === 'track' && post.track && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: S_CONT, borderRadius: 8, padding: '6px 10px', marginBottom: 6, border: `1px solid ${BORDER}` }}>
                        <div style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: S_HIGH, position: 'relative', cursor: post.track.url ? 'pointer' : 'default' }} onClick={playTrack}>
                            {post.track.coverUrl ? <img src={post.track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Music size={12} color={SUB} /></div>}
                            {post.track.url && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isPlaying ? <Pause size={10} color="#fff" fill="#fff" /> : <Play size={10} color="#fff" fill="#fff" />}</div>}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.track.title}</span>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: SUB }}>
                    <span style={{ fontWeight: 600, color: TEXT }}>{post.username}</span>
                    <span>·</span>
                    <span>{timeAgo(post.createdAt)}</span>
                    <Link to={`/preview/alt_f_genre_post/${post.id}`} style={{ display: 'flex', alignItems: 'center', gap: 3, color: SUB, textDecoration: 'none', marginLeft: 'auto' }}>
                        <MessageCircle size={11} /> {post.commentCount}
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────

export const FrontpageAltFFeed: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();

    const [tab, setTab] = useState<Tab>('Feed');
    const [filter, setFilter] = useState<Filter>('All');

    // Discover tab data
    const [publicItems, setPublicItems] = useState<any[]>([]);
    const [publicLoading, setPublicLoading] = useState(true);

    // Following tab data
    const [feedTracks, setFeedTracks] = useState<any[]>([]);
    const [feedLoading, setFeedLoading] = useState(false);
    const [feedHasMore, setFeedHasMore] = useState(false);
    const [feedCursor, setFeedCursor] = useState<string | null>(null);
    const [feedError, setFeedError] = useState<'unauth' | 'empty' | null>(null);

    // Genres tab data
    const [genrePosts, setGenrePosts] = useState<any[]>([]);
    const [genrePostsLoading, setGenrePostsLoading] = useState(false);
    const [genrePostsError, setGenrePostsError] = useState<'unauth' | 'empty' | null>(null);
    const [genreHasMore, setGenreHasMore] = useState(false);
    const [genreCursor, setGenreCursor] = useState<string | null>(null);
    const [genreSort, setGenreSort] = useState<'hot' | 'new' | 'top'>('hot');

    // Trending sidebar
    const [trending, setTrending] = useState<any[]>([]);

    useEffect(() => {
        Promise.all([
            axios.get('/api/activity/public').catch(() => ({ data: [] })),
            axios.get('/api/musician/leaderboards/tracks').catch(() => ({ data: [] })),
        ]).then(([aRes, tRes]) => {
            setPublicItems(Array.isArray(aRes.data) ? aRes.data : []);
            setTrending(arr(tRes.data).slice(0, 5));
            setPublicLoading(false);
        });
    }, []);

    const loadGenreFeed = useCallback(async (sort: 'hot' | 'new' | 'top', cursor?: string | null) => {
        setGenrePostsLoading(true);
        try {
            const r = await axios.get('/api/genre-posts', { params: { feed: 'subscribed', sort, ...(cursor ? { cursor } : {}) }, withCredentials: true });
            if (!cursor) {
                setGenrePosts(arr(r.data.posts));
                setGenrePostsError(r.data.posts.length === 0 ? 'empty' : null);
            } else {
                setGenrePosts(prev => [...prev, ...arr(r.data.posts)]);
            }
            setGenreHasMore(r.data.hasMore);
            setGenreCursor(r.data.nextCursor);
        } catch (e: any) {
            if (e.response?.status === 401) setGenrePostsError('unauth');
            else setGenrePostsError('empty');
        } finally {
            setGenrePostsLoading(false);
        }
    }, []);

    const handleGenreVote = async (postId: string, type: 'up' | 'down') => {
        try {
            const r = await axios.post(`/api/genre-posts/${postId}/vote`, { type }, { withCredentials: true });
            setGenrePosts(prev => prev.map(p => p.id === postId ? { ...p, score: r.data.score, upvotes: r.data.upvotes, downvotes: r.data.downvotes, userVote: r.data.userVote } : p));
        } catch {}
    };

    const loadFollowingFeed = useCallback(async (cursor?: string | null) => {
        setFeedLoading(true);
        try {
            const url = cursor ? `/api/feed?cursor=${cursor}` : '/api/feed';
            const res = await axios.get(url, { withCredentials: true });
            const { tracks = [], hasMore = false, nextCursor = null } = res.data;
            if (!cursor) {
                setFeedTracks(tracks);
                setFeedError(tracks.length === 0 ? 'empty' : null);
            } else {
                setFeedTracks(prev => [...prev, ...tracks]);
            }
            setFeedHasMore(hasMore);
            setFeedCursor(nextCursor);
        } catch (e: any) {
            if (e.response?.status === 401) setFeedError('unauth');
            else setFeedError('empty');
        } finally {
            setFeedLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'Following' && feedTracks.length === 0 && !feedLoading) {
            loadFollowingFeed();
        }
        if (tab === 'Feed' && genrePosts.length === 0 && !genrePostsLoading) {
            loadGenreFeed(genreSort);
        }
    }, [tab]);

    useEffect(() => {
        if (tab === 'Feed') {
            setGenrePosts([]);
            loadGenreFeed(genreSort);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [genreSort]);

    const playTrack = (t: any) => {
        const track = t.target ? t.target : t;
        const url = track.url || null;
        if (!url) return;
        if (player.currentTrack?.id === track.id) {
            togglePlay();
        } else {
            setTrack({ id: track.id, title: track.title, artist: t.actorName || t.profile?.displayName || '', url, coverUrl: track.coverUrl });
        }
    };

    const isCurrentlyPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    const visiblePublic = tab === 'Discover'
        ? publicItems.filter(i => filterMatch(i.type, filter))
        : [];

    const headerSubtitle = tab === 'Feed'
        ? 'Posts from genres you subscribe to'
        : tab === 'Following'
        ? 'Latest music from artists you follow'
        : 'What\'s happening in the Fuji Studio community';

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Feed' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── COMPACT HEADER (no full hero) ── */}
                    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0f1a2a 0%, #1a0f2a 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,19,29,1) 100%)' }} />
                        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '32px 32px 28px', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: PRIMARY, display: 'block', marginBottom: 6 }}>Personal</span>
                                    <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>Your Feed</h1>
                                    <p style={{ margin: 0, color: SUB, fontSize: 14 }}>{headerSubtitle}</p>
                                </div>

                                {/* Tab switcher */}
                                <div style={{ display: 'flex', background: 'rgba(28,31,42,0.8)', backdropFilter: 'blur(12px)', padding: 4, borderRadius: 12, border: `1px solid ${BORDER}`, gap: 2 }}>
                                    {TABS.map(t => (
                                        <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FONT, background: tab === t ? PRIMARY : 'transparent', color: tab === t ? '#fff' : SUB, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {t === 'Feed' && <Home size={13} />}
                                            {t === 'Following' && <Users size={13} />}
                                            {t === 'Discover' && <Rss size={13} />}
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── BODY GRID ── */}
                    <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                        {/* ── LEFT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Subscriptions shortcut — Feed tab */}
                            {tab === 'Feed' && (
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Home size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Your Feed</h3>
                                    </div>
                                    <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.5 }}>Posts and tracks from genres you've subscribed to, sorted by relevance.</p>
                                        <Link to="/preview/alt_f_genres" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}30`, color: PRIMARY, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                                            <Music size={12} /> Manage Genres
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Filter card — only for Discover tab */}
                            {tab === 'Discover' && (
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Rss size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Filter</h3>
                                    </div>
                                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {FILTERS.map(f => {
                                            const meta = f === 'Music' ? TYPE_ICONS.track_upload : f === 'Battles' ? TYPE_ICONS.battle_entry : f === 'Follows' ? TYPE_ICONS.follow : null;
                                            const Icon = meta?.icon;
                                            return (
                                                <button key={f} onClick={() => setFilter(f)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: filter === f ? `${PRIMARY}18` : 'transparent', color: filter === f ? PRIMARY : SUB, fontSize: 13, fontWeight: filter === f ? 700 : 400, textAlign: 'left', transition: 'all 0.15s' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {Icon && <Icon size={13} color={filter === f ? PRIMARY : meta?.color} />}
                                                        {f}
                                                    </div>
                                                    <span style={{ fontSize: 11, color: filter === f ? PRIMARY : 'rgba(154,163,178,0.4)' }}>
                                                        {f === 'All' ? publicItems.length : publicItems.filter(i => filterMatch(i.type, f)).length}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Trending Now */}
                            {trending.length > 0 && (
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <TrendingUp size={14} color={PRIMARY} />
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Trending Now</h3>
                                    </div>
                                    <div style={{ padding: '8px 0' }}>
                                        {trending.map((t: any, i: number) => {
                                            const title = t.title || t.track?.title;
                                            const artist = t.profile?.displayName || t.profile?.username || t.artist;
                                            const cover = t.coverUrl || t.track?.coverUrl;
                                            const trackId = t.id || t.track?.id;
                                            const isPlaying = isCurrentlyPlaying(trackId);
                                            return (
                                                <Link key={trackId || i}
                                                    to="/preview/alt_f_track"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', transition: 'background 0.15s', textDecoration: 'none', color: 'inherit' }}
                                                    onMouseEnter={ev => ((ev.currentTarget as HTMLElement).style.background = 'rgba(38,42,53,0.4)')}
                                                    onMouseLeave={ev => ((ev.currentTarget as HTMLElement).style.background = 'transparent')}
                                                >
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: i < 3 ? PRIMARY : SUB, width: 16, flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
                                                    {cover
                                                        ? <img src={cover} referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                                                        : <div style={{ width: 32, height: 32, borderRadius: 6, background: S_HIGH, flexShrink: 0 }} />
                                                    }
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                                                        <div style={{ fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</div>
                                                    </div>
                                                    {isPlaying && <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY, flexShrink: 0 }} />}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Legend */}
                            {tab === 'Discover' && (
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Activity Types</h3>
                                    </div>
                                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {Object.entries(TYPE_ICONS).map(([type, { icon: Icon, color, label }]) => (
                                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Icon size={12} color={color} />
                                                </div>
                                                <span style={{ fontSize: 12, color: SUB }}>{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                            {/* DISCOVER TAB */}
                            {tab === 'Discover' && (
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Community Activity</h2>
                                        <span style={{ fontSize: 12, color: SUB }}>Last 7 days · {visiblePublic.length} events</span>
                                    </div>

                                    {publicLoading ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center', color: SUB }}>Loading activity…</div>
                                    ) : visiblePublic.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                            <Rss size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No activity yet</div>
                                            <div style={{ fontSize: 13, color: SUB }}>Check back later for community updates</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {visiblePublic.map((item: any, i: number) => (
                                                <ActivityCard
                                                    key={`${item.type}-${item.createdAt}-${i}`}
                                                    item={item}
                                                    onPlay={playTrack}
                                                    isPlaying={isCurrentlyPlaying(item.target?.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* FEED TAB — subscribed genre posts */}
                            {tab === 'Feed' && (
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Your Feed</h2>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {(['hot', 'new', 'top'] as const).map(s => (
                                                <button key={s} onClick={() => setGenreSort(s)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, background: genreSort === s ? PRIMARY : S_CONT, color: genreSort === s ? '#fff' : SUB }}>
                                                    {s === 'hot' && <Flame size={11} />}
                                                    {s === 'new' && <Clock size={11} />}
                                                    {s === 'top' && <TrendingUp size={11} />}
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {genrePostsLoading && genrePosts.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center', color: SUB }}>Loading genre feed…</div>
                                    ) : genrePostsError === 'unauth' ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                            <Lock size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sign in to see your feed</div>
                                            <div style={{ fontSize: 13, color: SUB }}>Subscribe to genres to personalise your feed</div>
                                        </div>
                                    ) : genrePostsError === 'empty' ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                            <Music size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Your feed is empty</div>
                                            <div style={{ fontSize: 13, color: SUB, marginBottom: 20 }}>Subscribe to genres to see their posts here</div>
                                            <Link to="/preview/alt_f_genres" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 10, background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                                Explore Genres
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {genrePosts.map((p: any) => (
                                                    <GenrePostFeedCard key={p.id} post={p} onVote={handleGenreVote} />
                                                ))}
                                            </div>
                                            {genreHasMore && (
                                                <div style={{ marginTop: 16, textAlign: 'center' }}>
                                                    <button onClick={() => loadGenreFeed(genreSort, genreCursor)} disabled={genrePostsLoading}
                                                        style={{ padding: '10px 28px', borderRadius: 10, background: 'transparent', border: `1px solid ${BORDER}`, color: SUB, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <ChevronDown size={14} /> {genrePostsLoading ? 'Loading…' : 'Load more'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>
                            )}

                            {/* FOLLOWING TAB */}
                            {tab === 'Following' && (
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Following</h2>
                                        {feedTracks.length > 0 && <span style={{ fontSize: 12, color: SUB }}>{feedTracks.length} tracks</span>}
                                    </div>

                                    {feedLoading && feedTracks.length === 0 ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center', color: SUB }}>Loading your feed…</div>
                                    ) : feedError === 'unauth' ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                            <Lock size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sign in to see your feed</div>
                                            <div style={{ fontSize: 13, color: SUB, marginBottom: 20 }}>Follow artists to see their latest tracks here</div>
                                            <button style={{ padding: '10px 28px', borderRadius: 10, background: PRIMARY, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                                                Sign In
                                            </button>
                                        </div>
                                    ) : feedError === 'empty' ? (
                                        <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                                            <Users size={32} color={SUB} style={{ marginBottom: 12 }} />
                                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Your feed is empty</div>
                                            <div style={{ fontSize: 13, color: SUB, marginBottom: 20 }}>Follow some artists to see their music here</div>
                                            <Link to="/preview/alt_f_artists" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 10, background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                                Discover Artists
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {feedTracks.map((track: any, i: number) => (
                                                    <TrackFeedCard
                                                        key={track.id || i}
                                                        track={track}
                                                        onPlay={playTrack}
                                                        isPlaying={isCurrentlyPlaying(track.id)}
                                                    />
                                                ))}
                                            </div>

                                            {feedHasMore && (
                                                <div style={{ marginTop: 16, textAlign: 'center' }}>
                                                    <button onClick={() => loadFollowingFeed(feedCursor)} disabled={feedLoading} style={{ padding: '10px 28px', borderRadius: 10, background: 'transparent', border: `1px solid ${BORDER}`, color: SUB, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <ChevronDown size={14} /> {feedLoading ? 'Loading…' : 'Load more'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>
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
