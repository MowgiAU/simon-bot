/**
 * The track shorts feed — a full-screen, snap-scrolled column of tracks.
 *
 * Audio runs through the shared PlayerProvider so playback survives navigation
 * and play-counting keeps working; the global player bar is hidden while this is
 * mounted because each slide owns its own transport.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, LayoutGrid, Plus, Music, ChevronsUp, Check } from 'lucide-react';
import { usePlayer } from '../../PlayerProvider';
import { useAuth } from '../../AuthProvider';
import { PRIMARY, SUB, TEXT, BORDER, FONT } from '../AltSidebar';
import { AltSpinner } from '../AltSpinner';
import { MOBILE_NAV_HEIGHT } from '../AltMobileNav';
import { TrackSlide, TimedComment } from './TrackSlide';
import { TrackCommentsSheet } from './TrackCommentsSheet';
import { TrackDetailsSheet } from './TrackDetailsSheet';
import { FeedSkeleton } from './FeedSkeleton';
import { useTrackFeed } from './useTrackFeed';
import { markSeen } from './seen';
import { FeedParams, FeedTrack, artistName, trackAudioUrl } from './types';

const FEED_STYLES = `
@keyframes fujiKenBurns { from{transform:scale(1.04) translate(0,0)} to{transform:scale(1.16) translate(-1.6%,-1.2%)} }
@keyframes fujiBurst    { 0%{transform:scale(.3);opacity:0} 30%{transform:scale(1.1);opacity:1} 70%{transform:scale(1);opacity:1} 100%{transform:scale(1.35);opacity:0} }
@keyframes fujiFlash    { 0%{transform:scale(.7);opacity:0} 30%{transform:scale(1);opacity:1} 100%{transform:scale(1.25);opacity:0} }
@keyframes fujiSpin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes fujiHint     { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-9px);opacity:.95} }
@keyframes fujiSheetIn  { from{transform:translateY(100%)} to{transform:translateY(0)} }
@keyframes fujiFade     { from{opacity:0} to{opacity:1} }
@keyframes fujiShimmer  { from{background-position:180% 0} to{background-position:-80% 0} }
@keyframes fujiCommentIn{ from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
@keyframes fujiToastIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
`;
/* Phones only: the global player bar would cover the feed's own transport.
   On desktop the feed is a column inside the shell, so the bar stays. */
const HIDE_PLAYER_BAR = `[data-global-player="bar"]{display:none!important}`;

interface Props {
    params: FeedParams;
    /** Contextual label shown next to the wordmark (genre, artist, search…). */
    title?: string;
    backTo?: string;
    browseTo?: string;
    createLink?: string;
    /** Filter chips etc. rendered under the title row. */
    headerExtra?: React.ReactNode;
    emptyMessage?: string;
    /**
     * 'mobile' — fixed, full-viewport, immersive (phones).
     * 'desktop' — fills its parent as the centre column between the two
     * sidebars, each track framed phone-shaped.
     */
    variant?: 'mobile' | 'desktop';
}

export const TrackFeed: React.FC<Props> = ({ params, title, backTo, browseTo, createLink, headerExtra, emptyMessage, variant = 'mobile' }) => {
    const desktop = variant === 'desktop';
    const { player, setTrack, togglePlay, seek, mobileNavHidden } = usePlayer();
    const { user, loading: authLoading } = useAuth();

    // Declared before useTrackFeed so the hook can surface failed likes/reposts
    // through the same toast the rest of the feed uses.
    const [toast, setToast] = useState<string | null>(null);
    const flash = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(prev => (prev === msg ? null : prev)), 2200);
    }, []);

    const { tracks, loading, hasMore, loadMore, toggleLike, toggleRepost, toggleFollow, bumpCommentCount } = useTrackFeed(params, flash);

    const scrollerRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [showHint, setShowHint] = useState(true);
    // Mobile browsers block audio until a real gesture — autoplay-on-snap only
    // starts once the user has pressed play here at least once.
    const [unlocked, setUnlocked] = useState(false);
    const [sheet, setSheet] = useState<null | 'comments' | 'details'>(null);
    // Timed comments per track, fetched once for whatever is on screen.
    const [timed, setTimed] = useState<Record<string, TimedComment[]>>({});
    // Tracks a request is already open for — state lands too late to dedupe on.
    const timedRequested = useRef<Set<string>>(new Set());

    const current = tracks[active];
    const isCurrent = !!current && player.currentTrack?.id === current.id;
    const playing = isCurrent && player.isPlaying;
    const duration = isCurrent ? (player.duration || current?.duration || 0) : (current?.duration || 0);
    const currentTime = isCurrent ? player.currentTime : 0;

    const play = useCallback((t: FeedTrack) => {
        const url = trackAudioUrl(t);
        if (!url) return;
        setTrack({
            id: t.id, title: t.title, artist: artistName(t),
            username: t.profile?.username, slug: t.slug || undefined,
            url, coverUrl: t.coverUrl || undefined,
        }, []);
    }, [setTrack]);

    // ── Which slide is centred ────────────────────────────────────────────────
    const onScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const i = Math.round(el.scrollTop / (el.clientHeight || 1));
        setActive(prev => {
            if (prev === i) return prev;
            try { navigator.vibrate?.(6); } catch {} // a tick as each track locks in
            return i;
        });
        if (el.scrollTop > 8) setShowHint(false);
    }, []);

    // ── Don't reopen on the same tracks next time ─────────────────────────────
    useEffect(() => {
        if (!current) return;
        const id = current.id;
        const t = setTimeout(() => markSeen(id), 2500); // only if they actually stayed
        return () => clearTimeout(t);
    }, [current?.id]);

    // ── Timed comments for what's on screen ───────────────────────────────────
    useEffect(() => {
        if (!current || !current.commentCount) return;
        const id = current.id;
        if (timedRequested.current.has(id)) return;
        timedRequested.current.add(id);
        let on = true;
        axios.get('/api/comments', { params: { trackId: id, limit: 50 } })
            .then(r => {
                if (!on) return;
                const list: TimedComment[] = (r.data?.comments || [])
                    .filter((c: any) => c.trackTimestamp != null && !c.deletedAt && !c.hiddenAt)
                    .map((c: any) => ({ id: c.id, username: c.username, avatarUrl: c.avatarUrl, content: c.content, trackTimestamp: c.trackTimestamp }))
                    .sort((a: TimedComment, b: TimedComment) => a.trackTimestamp - b.trackTimestamp);
                setTimed(prev => ({ ...prev, [id]: list }));
            })
            .catch(() => {
                timedRequested.current.delete(id); // let a later pass retry
                if (on) setTimed(prev => ({ ...prev, [id]: [] }));
            });
        return () => { on = false; };
    }, [current?.id, current?.commentCount]);

    // ── Autoplay the centred track ────────────────────────────────────────────
    useEffect(() => {
        if (!unlocked || !current) return;
        if (player.currentTrack?.id !== current.id) play(current);
        else if (!player.isPlaying) togglePlay();
    // Keyed on the slide, not on player state, so a deliberate pause sticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, unlocked, current?.id]);

    // ── Loop, the way a Reel does ─────────────────────────────────────────────
    useEffect(() => {
        if (!isCurrent || player.isPlaying || !duration) return;
        if (player.currentTime > 0 && duration - player.currentTime < 1) {
            seek(0);
            togglePlay();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [player.isPlaying, player.currentTime, duration, isCurrent]);

    // ── Prefetch the next slide so it starts instantly ────────────────────────
    useEffect(() => {
        const next = tracks[active + 1];
        if (!next) return;
        if (next.coverUrl) { const img = new Image(); img.referrerPolicy = 'no-referrer'; img.src = next.coverUrl; }
        const url = trackAudioUrl(next);
        if (url) { const a = new Audio(); a.preload = 'metadata'; a.src = url; }
    }, [active, tracks]);

    // ── Keep the feed stocked ─────────────────────────────────────────────────
    useEffect(() => {
        if (hasMore && !loading && tracks.length > 0 && active >= tracks.length - 4) loadMore();
    }, [active, hasMore, loading, tracks.length, loadMore]);

    // Filters changed underneath us — back to the top.
    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: 0 });
        setActive(0);
    }, [params.genre, params.search, params.artist, params.sort]);

    // Desktop has no swipe — arrows step between tracks, space toggles playback.
    // Deliberately an instant jump: a mandatory snap container cancels
    // scrollTo({behavior:'smooth'}) outright, and animating scrollTop by hand
    // would leave snapping disabled if the frame loop stalls. Wheel and trackpad
    // scrolling still glide, because CSS snap animates those itself.
    const step = useCallback((delta: number) => {
        const el = scrollerRef.current;
        if (!el) return;
        const h = el.clientHeight || 1;
        // Read the position off the element, not off `active` — held or repeated
        // keypresses fire faster than the scroll handler updates React state.
        const from = Math.round(el.scrollTop / h);
        el.scrollTop = Math.max(0, Math.min(el.scrollHeight - h, (from + delta) * h));
    }, []);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') { e.preventDefault(); step(-1); }
        else if (e.key === ' ') {
            e.preventDefault();
            if (current) { setUnlocked(true); if (player.currentTrack?.id === current.id) togglePlay(); else play(current); }
        }
    }, [step, current, player.currentTrack?.id, togglePlay, play]);

    const share = useCallback(async (t: FeedTrack) => {
        const url = t.profile?.username && t.slug
            ? `${window.location.origin}/profile/${t.profile.username}/${t.slug}`
            : window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: t.title, text: `${t.title} by ${artistName(t)}`, url });
            } else if (navigator.clipboard) {
                // No share sheet (desktop, mostly) — copying silently looks broken
                await navigator.clipboard.writeText(url);
                flash('Link copied');
            } else {
                flash('Copying isn’t available here');
            }
        } catch (e: any) {
            // Dismissing the share sheet isn't a failure; anything else is, and
            // saying nothing at all is what made this feel broken in the first place.
            if (e?.name !== 'AbortError') flash('Couldn’t copy the link');
        }
    }, [flash]);

    const handlePlayPause = useCallback((t: FeedTrack) => {
        setUnlocked(true);
        if (player.currentTrack?.id === t.id) togglePlay();
        else play(t);
    }, [player.currentTrack?.id, togglePlay, play]);

    const header = useMemo(() => (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 120,
            padding: 'calc(env(safe-area-inset-top) + 10px) 12px 20px',
            background: 'linear-gradient(to bottom, rgba(6,8,14,0.85) 0%, rgba(6,8,14,0.4) 60%, transparent 100%)',
            pointerEvents: 'none', fontFamily: FONT,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
                {backTo && (
                    <Link to={backTo} aria-label="Back" style={iconBtn}>
                        <ChevronLeft size={19} />
                    </Link>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Link to="/" aria-label="Fuji Studio" style={{ display: 'flex', flexShrink: 0 }}>
                            <img src="/fujitext.svg" alt="Fuji Studio" style={{ height: 17, width: 'auto', display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }} />
                        </Link>
                        {title && (
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'rgba(255,255,255,0.92)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 12px rgba(0,0,0,0.6)', minWidth: 0 }}>
                                {title}
                            </span>
                        )}
                    </div>
                    {tracks.length > 0 && (
                        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                            {active + 1} / {tracks.length}{hasMore ? '+' : ''}
                        </div>
                    )}
                </div>
                {browseTo && <Link to={browseTo} aria-label="Browse" style={iconBtn}><LayoutGrid size={17} /></Link>}
                {/* Signed out is otherwise invisible here until an action quietly
                    fails, which is exactly how people ended up thinking like and
                    repost were broken. Say it up front instead. */}
                {!authLoading && !user
                    ? <Link to="/login" style={{ ...iconBtn, width: 'auto', padding: '0 14px', background: PRIMARY, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.01em' }}>Log in</Link>
                    : createLink && <Link to={createLink} aria-label="Upload" style={{ ...iconBtn, background: PRIMARY }}><Plus size={18} /></Link>}
            </div>
            {headerExtra && <div style={{ marginTop: 10, pointerEvents: 'auto' }}>{headerExtra}</div>}
        </div>
    ), [backTo, browseTo, createLink, title, tracks.length, active, hasMore, headerExtra, user, authLoading]);

    const slideProps = (t: FeedTrack, i: number) => ({
        track: t,
        active: i === active,
        near: Math.abs(i - active) <= 2,
        playing: i === active && playing,
        currentTime: i === active ? currentTime : 0,
        duration: i === active ? duration : (t.duration || 0),
        framed: desktop,
        timedComments: i === active ? timed[t.id] : undefined,
        onPlayPause: () => handlePlayPause(t),
        onSeek: (s: number) => { if (i === active) seek(s); },
        onLike: () => toggleLike(t),
        onRepost: () => toggleRepost(t),
        onFollow: () => toggleFollow(t),
        onComments: () => setSheet('comments'),
        onDetails: () => setSheet('details'),
        onShare: () => share(t),
    });

    return (
        <>
            <style>{desktop ? FEED_STYLES : FEED_STYLES + HIDE_PLAYER_BAR}</style>
            {!desktop && header}
            {desktop && headerExtra && (
                <div style={{ flexShrink: 0, padding: '12px 20px 0', fontFamily: FONT }}>{headerExtra}</div>
            )}

            <div
                ref={scrollerRef}
                onScroll={onScroll}
                tabIndex={desktop ? 0 : undefined}
                onKeyDown={desktop ? onKeyDown : undefined}
                style={desktop ? {
                    flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
                    scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain',
                    background: 'transparent', fontFamily: FONT, outline: 'none',
                } : {
                    position: 'fixed', top: 0, left: 0, right: 0,
                    // Grows into the strip the bottom nav vacates when it auto-hides
                    // on scroll, so artwork fills it instead of leaving a dead gap.
                    bottom: mobileNavHidden ? 0 : `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
                    transition: 'bottom 0.25s ease',
                    overflowY: 'auto', overflowX: 'hidden',
                    scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain',
                    WebkitOverflowScrolling: 'touch', background: '#06080e', fontFamily: FONT,
                }}>

                {loading && tracks.length === 0 ? (
                    desktop ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', boxSizing: 'border-box' }}>
                            <div style={{ height: '100%', aspectRatio: '9 / 16', maxWidth: '100%' }}><FeedSkeleton framed /></div>
                        </div>
                    ) : <div style={{ height: '100%' }}><FeedSkeleton /></div>
                ) : tracks.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
                        <Music size={34} color={SUB} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Nothing to play here yet</div>
                        <div style={{ fontSize: 13, color: SUB, maxWidth: 260 }}>{emptyMessage || 'No tracks matched. Try a different filter.'}</div>
                    </div>
                ) : desktop ? tracks.map((t, i) => (
                    // Each track gets a phone-shaped frame, centred in the column —
                    // the Reels proportions are the point, so don't stretch them.
                    <div key={t.id} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', boxSizing: 'border-box', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
                        <div style={{ height: '100%', aspectRatio: '9 / 16', maxWidth: '100%', position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.55)', border: `1px solid ${BORDER}`, background: '#06080e' }}>
                            <TrackSlide {...slideProps(t, i)} />
                        </div>
                    </div>
                )) : tracks.map((t, i) => (
                    <TrackSlide key={t.id} {...slideProps(t, i)} />
                ))}

                {hasMore && tracks.length > 0 && (
                    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'start' }}>
                        <AltSpinner />
                    </div>
                )}
            </div>

            {/* First-run affordance */}
            {showHint && tracks.length > 1 && !desktop && (
                <div style={{ position: 'fixed', left: 0, right: 0, bottom: MOBILE_NAV_HEIGHT + 58, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#fff', pointerEvents: 'none', zIndex: 5, animation: 'fujiHint 1.9s ease-in-out infinite', textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
                    <ChevronsUp size={20} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', fontFamily: FONT }}>Swipe for more</span>
                </div>
            )}

            {toast && (
                <div style={{
                    position: 'fixed', left: '50%', transform: 'translateX(-50%)',
                    bottom: desktop ? 110 : MOBILE_NAV_HEIGHT + 84, zIndex: 300,
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 9999,
                    background: 'rgba(0,0,0,0.78)', color: '#fff',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    fontFamily: FONT, fontSize: 13, fontWeight: 700,
                    animation: 'fujiToastIn 0.22s ease-out', pointerEvents: 'none',
                }}>
                    <Check size={14} color="#22C55E" /> {toast}
                </div>
            )}

            {current && sheet === 'comments' && (
                <TrackCommentsSheet
                    track={current} open onClose={() => setSheet(null)}
                    currentTime={currentTime}
                    onSeek={s => seek(s)}
                    onPosted={() => bumpCommentCount(current.id)}
                />
            )}
            {current && sheet === 'details' && (
                <TrackDetailsSheet
                    track={current} open onClose={() => setSheet(null)}
                    currentTime={currentTime}
                    onSeek={s => seek(s)}
                    onFollow={() => toggleFollow(current)}
                    onPlayTrack={t => { setUnlocked(true); play(t); }}
                />
            )}
        </>
    );
};

const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
    borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', flexShrink: 0,
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', textDecoration: 'none',
};
