/**
 * Alt F — Mobile "Shorts" feed (TikTok / YouTube Shorts style) for genre posts.
 *
 * Replaces the Reddit-style card list on phones (<600px) when viewing a genre
 * feed. Every post is a full-screen, snap-scrolled slide; track posts (the ones
 * auto-created from music uploads) get the full immersive treatment — blurred
 * cover backdrop, big artwork, autoplay on snap, waveform scrubber — while
 * discussion posts render as a compact readable slide so the scroll never breaks.
 *
 * Audio goes through the shared PlayerProvider so playback stays consistent with
 * the rest of the site (the global player bar is hidden while this feed is
 * mounted; whatever is playing keeps playing when the user navigates away).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../PlayerProvider';
import { PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, S_CONT, S_HIGH, BORDER, FONT } from './AltSidebar';
import { AltSpinner } from './AltSpinner';
import { MOBILE_NAV_HEIGHT } from './AltMobileNav';
import {
    ChevronUp, ChevronDown, MessageCircle, Share2, Play, Pause, Music,
    FileText, ChevronLeft, Tag, Plus, Flame, Clock, TrendingUp, ChevronsUp,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtTime = (s?: number) => { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 604800) return `${Math.floor(s / 86400)}d`;
    return new Date(d).toLocaleDateString();
};
function genreAccent(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

const SLIDE_STYLES = `
@keyframes fujiShortsBurst { 0%{transform:scale(.4);opacity:0} 35%{transform:scale(1.1);opacity:1} 100%{transform:scale(1.7);opacity:0} }
@keyframes fujiShortsHint  { 0%,100%{transform:translateY(0);opacity:.45} 50%{transform:translateY(-9px);opacity:.95} }
@keyframes fujiShortsPulse { 0%,100%{box-shadow:0 24px 70px rgba(0,0,0,.65), 0 0 0 0 rgba(242,120,10,.34)} 50%{box-shadow:0 24px 70px rgba(0,0,0,.65), 0 0 0 16px rgba(242,120,10,0)} }
@keyframes fujiShortsRise  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
/* The global player bar would sit on top of the immersive feed — hide it while
   this component is mounted (the slide itself owns transport controls). */
[data-global-player="bar"]{display:none!important}
`;

export interface ShortsPost {
    id: string;
    type?: 'discussion' | 'track';
    title: string;
    body?: string | null;
    imageUrl?: string | null;
    score: number;
    commentCount: number;
    createdAt: string;
    username: string;
    avatarUrl?: string | null;
    genre?: { id: string; name: string; slug: string };
    community?: { id: string; name: string; slug: string };
    communityId?: string;
    flair?: string | null;
    userVote: 'up' | 'down' | null;
    track?: {
        id: string; title: string; slug: string; coverUrl?: string | null;
        url?: string; mp3Url?: string | null; duration?: number;
        waveformPeaks?: number[] | null; playCount?: number;
        profile?: { username: string; displayName?: string | null };
    } | null;
}

interface Props {
    posts: ShortsPost[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onVote: (postId: string, type: 'up' | 'down') => void;
    onShare: (post: ShortsPost) => void;
    title: string;
    backTo: string;
    musicOnly: boolean;
    onToggleMusicOnly: (v: boolean) => void;
    sort: 'hot' | 'new' | 'top';
    onSortChange: (s: 'hot' | 'new' | 'top') => void;
    createLink?: string;
}

export const AltShortsFeed: React.FC<Props> = ({
    posts, loading, hasMore, onLoadMore, onVote, onShare,
    title, backTo, musicOnly, onToggleMusicOnly, sort, onSortChange, createLink,
}) => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [showHint, setShowHint] = useState(true);
    // Mobile browsers block audio until a real user gesture. Autoplay-on-snap
    // only kicks in after the user has pressed play once in this session.
    const [unlocked, setUnlocked] = useState(false);
    const [burstId, setBurstId] = useState<string | null>(null);

    const activePost = posts[active];
    const activeTrack = activePost?.type === 'track' ? activePost.track : null;
    const activeTrackUrl = activeTrack?.mp3Url || activeTrack?.url;

    // ── Track which slide is centred ──────────────────────────────────────────
    const onScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const h = el.clientHeight || 1;
        const i = Math.round(el.scrollTop / h);
        setActive(prev => (prev === i ? prev : i));
        if (el.scrollTop > 8) setShowHint(false);
    }, []);

    // ── Infinite scroll — pull the next page well before the user hits the end ─
    useEffect(() => {
        if (hasMore && !loading && posts.length > 0 && active >= posts.length - 3) onLoadMore();
    }, [active, hasMore, loading, posts.length, onLoadMore]);

    // ── Autoplay the centred slide ────────────────────────────────────────────
    useEffect(() => {
        if (!unlocked || !activePost) return;
        if (activeTrack && activeTrackUrl) {
            if (player.currentTrack?.id !== activeTrack.id) {
                setTrack({
                    id: activeTrack.id,
                    title: activeTrack.title,
                    artist: activeTrack.profile?.displayName || activeTrack.profile?.username || activePost.username,
                    username: activeTrack.profile?.username,
                    slug: activeTrack.slug,
                    url: activeTrackUrl,
                    coverUrl: activeTrack.coverUrl || undefined,
                }, []);
            } else if (!player.isPlaying) {
                togglePlay();
            }
        } else if (player.isPlaying) {
            // Scrolled onto a slide with no audio of its own — pause, like Shorts does.
            togglePlay();
        }
    // Intentionally keyed on the slide, not on player state, so a manual pause sticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, unlocked, activePost?.id]);

    // Reset to the top whenever the underlying feed is swapped (sort / filter change).
    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: 0 });
        setActive(0);
    }, [sort, musicOnly]);

    const isPlayingPost = (p: ShortsPost) =>
        !!p.track && player.currentTrack?.id === p.track.id && player.isPlaying;

    const handlePlay = (p: ShortsPost) => {
        const url = p.track?.mp3Url || p.track?.url;
        if (!p.track || !url) return;
        setUnlocked(true);
        if (player.currentTrack?.id === p.track.id) { togglePlay(); return; }
        setTrack({
            id: p.track.id,
            title: p.track.title,
            artist: p.track.profile?.displayName || p.track.profile?.username || p.username,
            username: p.track.profile?.username,
            slug: p.track.slug,
            url,
            coverUrl: p.track.coverUrl || undefined,
        }, []);
    };

    const handleDoubleUpvote = (p: ShortsPost) => {
        if (p.userVote !== 'up') onVote(p.id, 'up');
        setBurstId(p.id);
        setTimeout(() => setBurstId(b => (b === p.id ? null : b)), 700);
    };

    const chip = (on: boolean): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9999,
        border: `1px solid ${on ? PRIMARY : 'rgba(255,255,255,0.16)'}`,
        background: on ? PRIMARY : 'rgba(0,0,0,0.35)',
        color: on ? '#fff' : TEXT, fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
        cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        whiteSpace: 'nowrap',
    });

    const SortIcon = sort === 'hot' ? Flame : sort === 'new' ? Clock : TrendingUp;

    return (
        <>
            <style>{SLIDE_STYLES}</style>

            {/* ── Top overlay: back, feed name, filters ── */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 120,
                padding: 'calc(env(safe-area-inset-top) + 10px) 12px 22px',
                background: 'linear-gradient(to bottom, rgba(6,8,14,0.88) 0%, rgba(6,8,14,0.5) 55%, transparent 100%)',
                pointerEvents: 'none', fontFamily: FONT,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
                    <Link to={backTo} aria-label="Back" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
                        borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', flexShrink: 0,
                        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', textDecoration: 'none',
                    }}>
                        <ChevronLeft size={19} />
                    </Link>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{title}</div>
                        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                            {posts.length > 0 ? `${active + 1} / ${posts.length}${hasMore ? '+' : ''}` : ''}
                        </div>
                    </div>
                    {createLink && (
                        <Link to={createLink} aria-label="New post" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
                            borderRadius: '50%', background: PRIMARY, color: '#fff', flexShrink: 0, textDecoration: 'none',
                        }}>
                            <Plus size={18} />
                        </Link>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, pointerEvents: 'auto' }}>
                    <button onClick={() => onToggleMusicOnly(true)} style={chip(musicOnly)}>
                        <Music size={11} /> Music
                    </button>
                    <button onClick={() => onToggleMusicOnly(false)} style={chip(!musicOnly)}>
                        <FileText size={11} /> All posts
                    </button>
                    <button
                        onClick={() => onSortChange(sort === 'hot' ? 'new' : sort === 'new' ? 'top' : 'hot')}
                        style={{ ...chip(false), marginLeft: 'auto' }}>
                        <SortIcon size={11} color={PRIMARY} /> {sort.charAt(0).toUpperCase() + sort.slice(1)}
                    </button>
                </div>
            </div>

            {/* ── Snap scroller ── */}
            <div
                ref={scrollerRef}
                onScroll={onScroll}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0,
                    bottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
                    overflowY: 'auto', overflowX: 'hidden',
                    scrollSnapType: 'y mandatory',
                    overscrollBehaviorY: 'contain',
                    WebkitOverflowScrolling: 'touch',
                    background: '#06080e',
                    fontFamily: FONT,
                }}>

                {loading && posts.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AltSpinner /></div>
                ) : posts.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
                        <Music size={34} color={SUB} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                            {musicOnly ? 'No music posts here yet' : 'No posts yet'}
                        </div>
                        <div style={{ fontSize: 13, color: SUB, maxWidth: 260 }}>
                            {musicOnly ? 'Switch to "All posts" to see discussions, or be the first to drop a track.' : 'Be the first to post in this community.'}
                        </div>
                        {musicOnly && (
                            <button onClick={() => onToggleMusicOnly(false)} style={{ ...chip(false), padding: '8px 16px', fontSize: 13 }}>
                                <FileText size={13} /> Show all posts
                            </button>
                        )}
                    </div>
                ) : posts.map((p, i) => (
                    <Slide
                        key={p.id}
                        post={p}
                        index={i}
                        active={i === active}
                        near={Math.abs(i - active) <= 2}
                        playing={isPlayingPost(p)}
                        progress={i === active && activeTrack && player.currentTrack?.id === activeTrack.id
                            ? player.currentTime / (player.duration || activeTrack.duration || 1) : 0}
                        currentTime={i === active ? player.currentTime : 0}
                        duration={i === active ? (player.duration || p.track?.duration || 0) : (p.track?.duration || 0)}
                        onPlay={() => handlePlay(p)}
                        onSeek={ratio => seek(ratio * (player.duration || p.track?.duration || 0))}
                        onVote={onVote}
                        onShare={() => onShare(p)}
                        onDoubleUpvote={() => handleDoubleUpvote(p)}
                        burst={burstId === p.id}
                        showHint={i === 0 && showHint && posts.length > 1}
                    />
                ))}

                {hasMore && posts.length > 0 && (
                    <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 13, scrollSnapAlign: 'start' }}>
                        {loading ? <AltSpinner /> : 'Loading more…'}
                    </div>
                )}
            </div>
        </>
    );
};

// ── Slide ─────────────────────────────────────────────────────────────────────
const Slide: React.FC<{
    post: ShortsPost;
    index: number;
    active: boolean;
    near: boolean;
    playing: boolean;
    progress: number;
    currentTime: number;
    duration: number;
    onPlay: () => void;
    onSeek: (ratio: number) => void;
    onVote: (postId: string, type: 'up' | 'down') => void;
    onShare: () => void;
    onDoubleUpvote: () => void;
    burst: boolean;
    showHint: boolean;
}> = ({ post, active, near, playing, progress, currentTime, duration, onPlay, onSeek, onVote, onShare, onDoubleUpvote, burst, showHint }) => {
    const lastTap = useRef(0);
    const isTrack = post.type === 'track' && !!post.track;
    const accent = post.genre ? genreAccent(post.genre.name) : PRIMARY;
    const cover = post.track?.coverUrl || post.imageUrl || null;
    const artist = post.track?.profile?.displayName || post.track?.profile?.username || post.username;
    const postLink = `/post/${post.id}${post.communityId ? '?kind=community' : ''}`;

    const handleTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 300) { lastTap.current = 0; onDoubleUpvote(); return; }
        lastTap.current = now;
        setTimeout(() => { if (lastTap.current && Date.now() - lastTap.current >= 300) { lastTap.current = 0; if (isTrack) onPlay(); } }, 300);
    };

    return (
        <section style={{
            position: 'relative', height: '100%', width: '100%',
            scrollSnapAlign: 'start', scrollSnapStop: 'always',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
            {/* Backdrop */}
            {cover && near ? (
                <img src={cover} alt="" referrerPolicy="no-referrer" aria-hidden
                    style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: 'blur(46px) brightness(0.42) saturate(1.5)', transform: 'scale(1.1)' }} />
            ) : (
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 32%, ${accent}22 0%, #06080e 70%)` }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(6,8,14,0.55) 0%, rgba(6,8,14,0.12) 32%, rgba(6,8,14,0.72) 78%, rgba(6,8,14,0.95) 100%)' }} />

            {/* ── Media area (tap = play / double-tap = upvote) ── */}
            <div
                onClick={handleTap}
                style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '86px 18px 0' }}>

                {isTrack ? (
                    <div style={{ position: 'relative', width: '100%', maxWidth: 330, aspectRatio: '1', borderRadius: 22, overflow: 'hidden', background: S_CONT, animation: playing ? 'fujiShortsPulse 2.6s ease-in-out infinite' : undefined, boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}>
                        {cover && near
                            ? <img src={cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S_HIGH }}><Music size={54} color={SUB} /></div>}

                        {!playing && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(255,255,255,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.55)' }}>
                                    <Play size={28} color="#0b0e16" fill="#0b0e16" style={{ marginLeft: 4 }} />
                                </div>
                            </div>
                        )}
                        {playing && active && (
                            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'flex-end', gap: 3, height: 18, padding: '5px 8px', borderRadius: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                                <Pause size={11} color="#fff" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ width: '100%', maxWidth: 360, borderRadius: 20, padding: '22px 20px', background: 'rgba(15,19,29,0.72)', border: `1px solid ${BORDER}`, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 20px 60px rgba(0,0,0,0.55)', maxHeight: '100%', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: SECONDARY, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <FileText size={12} /> Discussion
                        </div>
                        <Link to={postLink} style={{ textDecoration: 'none' }}>
                            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#fff', lineHeight: 1.3 }}>{post.title}</h2>
                        </Link>
                        {post.imageUrl && near && (
                            <img src={post.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', maxHeight: 190, objectFit: 'cover', borderRadius: 12, marginTop: 12, display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                        {post.body && (
                            <div style={{ marginTop: 10, fontSize: 13.5, color: 'rgba(223,226,241,0.78)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 7, WebkitBoxOrient: 'vertical' as any }}
                                dangerouslySetInnerHTML={{ __html: post.body }} />
                        )}
                        <Link to={postLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 12.5, fontWeight: 700, color: PRIMARY, textDecoration: 'none' }}>
                            <MessageCircle size={13} /> Open discussion
                        </Link>
                    </div>
                )}

                {/* Double-tap upvote burst */}
                {burst && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ width: 96, height: 96, borderRadius: '50%', background: `${PRIMARY}dd`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fujiShortsBurst 0.7s ease-out forwards' }}>
                            <ChevronUp size={54} color="#fff" />
                        </div>
                    </div>
                )}

                {/* First-run swipe hint */}
                {showHint && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#fff', pointerEvents: 'none', animation: 'fujiShortsHint 1.8s ease-in-out infinite' }}>
                        <ChevronsUp size={20} />
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em' }}>Swipe for more</span>
                    </div>
                )}
            </div>

            {/* ── Right action rail ── */}
            <div style={{ position: 'absolute', right: 10, bottom: isTrack ? 148 : 128, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 3 }}>
                <Link to={`/profile/${post.username}`} aria-label={post.username} style={{ display: 'block', width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: '2px solid rgba(255,255,255,0.85)', flexShrink: 0 }}>
                    {post.avatarUrl
                        ? <img src={post.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: TEXT }}>{post.username?.[0]?.toUpperCase()}</div>}
                </Link>

                <RailButton
                    onClick={() => onVote(post.id, 'up')}
                    icon={<ChevronUp size={27} color={post.userVote === 'up' ? PRIMARY : '#fff'} />}
                    label={fmtNum(Math.max(0, post.score))}
                    labelColor={post.userVote === 'up' ? PRIMARY : '#fff'}
                />
                <RailButton
                    onClick={() => onVote(post.id, 'down')}
                    icon={<ChevronDown size={27} color={post.userVote === 'down' ? TERTIARY : '#fff'} />}
                />
                <Link to={postLink} style={{ textDecoration: 'none' }}>
                    <RailButton icon={<MessageCircle size={24} color="#fff" />} label={fmtNum(post.commentCount)} />
                </Link>
                <RailButton onClick={onShare} icon={<Share2 size={23} color="#fff" />} label="Share" />
            </div>

            {/* ── Bottom info + scrubber ── */}
            <div style={{ position: 'relative', zIndex: 2, padding: '0 74px 14px 16px', animation: active ? 'fujiShortsRise 0.35s ease-out' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
                    {post.genre && (
                        <Link to={`/genres/${post.genre.slug}`} style={{ padding: '2px 9px', borderRadius: 9999, background: `${accent}26`, border: `1px solid ${accent}66`, color: accent, fontSize: 10.5, fontWeight: 800, textDecoration: 'none' }}>
                            {post.genre.name}
                        </Link>
                    )}
                    {post.flair && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 9999, background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 10.5, fontWeight: 700 }}>
                            <Tag size={9} /> {post.flair}
                        </span>
                    )}
                    <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>{timeAgo(post.createdAt)}</span>
                </div>

                <Link to={`/profile/${post.username}`} style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', textDecoration: 'none' }}>@{post.username}</Link>

                {isTrack ? (
                    <>
                        <div style={{ fontSize: 16.5, fontWeight: 900, color: '#fff', marginTop: 4, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, textShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>
                            {post.track!.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                            <Music size={11} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</span>
                            {post.track!.playCount != null && <span style={{ color: 'rgba(255,255,255,0.45)' }}>· {fmtNum(post.track!.playCount)} plays</span>}
                        </div>
                        {post.track!.profile?.username && post.track!.slug && (
                            <Link to={`/profile/${post.track!.profile!.username}/${post.track!.slug}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 9, padding: '5px 12px', borderRadius: 9999, background: 'rgba(255,255,255,0.13)', color: '#fff', fontSize: 11.5, fontWeight: 700, textDecoration: 'none', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                                Track page
                            </Link>
                        )}
                    </>
                ) : (
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {post.title}
                    </div>
                )}
            </div>

            {/* Scrubber — only the centred track slide is interactive */}
            {isTrack && (
                <div
                    onClick={e => {
                        if (!active) return;
                        const r = e.currentTarget.getBoundingClientRect();
                        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
                    }}
                    style={{ position: 'relative', zIndex: 2, padding: '8px 16px 12px', cursor: active ? 'pointer' : 'default' }}>
                    <div style={{ height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, height: '100%', background: PRIMARY, borderRadius: 9999 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
                        <span>{fmtTime(active ? currentTime : 0)}</span>
                        <span>{fmtTime(duration)}</span>
                    </div>
                </div>
            )}
        </section>
    );
};

const RailButton: React.FC<{ onClick?: () => void; icon: React.ReactNode; label?: string; labelColor?: string }> = ({ onClick, icon, label, labelColor }) => (
    <button
        onClick={onClick}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default', fontFamily: FONT, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>
        {icon}
        {label && <span style={{ fontSize: 10.5, fontWeight: 800, color: labelColor || '#fff' }}>{label}</span>}
    </button>
);
