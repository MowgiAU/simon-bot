/**
 * The track shorts feed — a full-screen, snap-scrolled column of tracks.
 *
 * Audio runs through the shared PlayerProvider so playback survives navigation
 * and play-counting keeps working; the global player bar is hidden while this is
 * mounted because each slide owns its own transport.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, LayoutGrid, Plus, Music, ChevronsUp } from 'lucide-react';
import { usePlayer } from '../../PlayerProvider';
import { PRIMARY, SUB, TEXT, FONT } from '../AltSidebar';
import { AltSpinner } from '../AltSpinner';
import { MOBILE_NAV_HEIGHT } from '../AltMobileNav';
import { TrackSlide } from './TrackSlide';
import { TrackCommentsSheet } from './TrackCommentsSheet';
import { TrackDetailsSheet } from './TrackDetailsSheet';
import { useTrackFeed } from './useTrackFeed';
import { FeedParams, FeedTrack, artistName, trackAudioUrl } from './types';

const FEED_STYLES = `
@keyframes fujiKenBurns { from{transform:scale(1.04) translate(0,0)} to{transform:scale(1.16) translate(-1.6%,-1.2%)} }
@keyframes fujiBurst    { 0%{transform:scale(.3);opacity:0} 30%{transform:scale(1.1);opacity:1} 70%{transform:scale(1);opacity:1} 100%{transform:scale(1.35);opacity:0} }
@keyframes fujiFlash    { 0%{transform:scale(.7);opacity:0} 30%{transform:scale(1);opacity:1} 100%{transform:scale(1.25);opacity:0} }
@keyframes fujiSpin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes fujiHint     { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-9px);opacity:.95} }
@keyframes fujiSheetIn  { from{transform:translateY(100%)} to{transform:translateY(0)} }
@keyframes fujiFade     { from{opacity:0} to{opacity:1} }
/* The global player bar would cover the feed's own transport */
[data-global-player="bar"]{display:none!important}
`;

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
}

export const TrackFeed: React.FC<Props> = ({ params, title, backTo, browseTo, createLink, headerExtra, emptyMessage }) => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const { tracks, loading, hasMore, loadMore, toggleLike, toggleRepost, toggleFollow, bumpCommentCount } = useTrackFeed(params);

    const scrollerRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [showHint, setShowHint] = useState(true);
    // Mobile browsers block audio until a real gesture — autoplay-on-snap only
    // starts once the user has pressed play here at least once.
    const [unlocked, setUnlocked] = useState(false);
    const [sheet, setSheet] = useState<null | 'comments' | 'details'>(null);

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
        setActive(prev => (prev === i ? prev : i));
        if (el.scrollTop > 8) setShowHint(false);
    }, []);

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

    const share = useCallback(async (t: FeedTrack) => {
        const url = t.profile?.username && t.slug
            ? `${window.location.origin}/profile/${t.profile.username}/${t.slug}`
            : window.location.href;
        try {
            if (navigator.share) await navigator.share({ title: t.title, text: `${t.title} by ${artistName(t)}`, url });
            else await navigator.clipboard.writeText(url);
        } catch {}
    }, []);

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
                {createLink && <Link to={createLink} aria-label="Upload" style={{ ...iconBtn, background: PRIMARY }}><Plus size={18} /></Link>}
            </div>
            {headerExtra && <div style={{ marginTop: 10, pointerEvents: 'auto' }}>{headerExtra}</div>}
        </div>
    ), [backTo, browseTo, createLink, title, tracks.length, active, hasMore, headerExtra]);

    return (
        <>
            <style>{FEED_STYLES}</style>
            {header}

            <div
                ref={scrollerRef}
                onScroll={onScroll}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0,
                    bottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
                    overflowY: 'auto', overflowX: 'hidden',
                    scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain',
                    WebkitOverflowScrolling: 'touch', background: '#06080e', fontFamily: FONT,
                }}>

                {loading && tracks.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AltSpinner /></div>
                ) : tracks.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
                        <Music size={34} color={SUB} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Nothing to play here yet</div>
                        <div style={{ fontSize: 13, color: SUB, maxWidth: 260 }}>{emptyMessage || 'No tracks matched. Try a different filter.'}</div>
                    </div>
                ) : tracks.map((t, i) => (
                    <TrackSlide
                        key={t.id}
                        track={t}
                        active={i === active}
                        near={Math.abs(i - active) <= 2}
                        playing={i === active && playing}
                        currentTime={i === active ? currentTime : 0}
                        duration={i === active ? duration : (t.duration || 0)}
                        onPlayPause={() => handlePlayPause(t)}
                        onSeek={s => { if (i === active) seek(s); }}
                        onLike={() => toggleLike(t)}
                        onRepost={() => toggleRepost(t)}
                        onFollow={() => toggleFollow(t)}
                        onComments={() => setSheet('comments')}
                        onDetails={() => setSheet('details')}
                        onShare={() => share(t)}
                    />
                ))}

                {hasMore && tracks.length > 0 && (
                    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'start' }}>
                        <AltSpinner />
                    </div>
                )}
            </div>

            {/* First-run affordance */}
            {showHint && tracks.length > 1 && (
                <div style={{ position: 'fixed', left: 0, right: 0, bottom: MOBILE_NAV_HEIGHT + 58, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#fff', pointerEvents: 'none', zIndex: 5, animation: 'fujiHint 1.9s ease-in-out infinite', textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
                    <ChevronsUp size={20} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', fontFamily: FONT }}>Swipe for more</span>
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
