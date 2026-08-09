/**
 * One full-screen track in the shorts feed.
 *
 * Reels grammar: full-bleed artwork that drifts while playing, tap to pause,
 * double-tap to like, a vertical action rail on the right and the artist/track
 * caption bottom-left. The music-specific upgrade over TikTok is the bottom
 * strip: a real waveform you can drag to scrub.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Heart, MessageCircle, Repeat2, Share2, Play, Pause, Music, Plus, Check,
    ChevronsUp, Disc3,
} from 'lucide-react';
import { PRIMARY, SUB, TEXT, S_HIGH, FONT } from '../AltSidebar';
import { FeedTrack, artistName, fmtNum, fmtTime, genreAccent } from './types';

interface Props {
    track: FeedTrack;
    active: boolean;
    /** Within a couple of slides of the viewport — controls image loading. */
    near: boolean;
    playing: boolean;
    currentTime: number;
    duration: number;
    onPlayPause: () => void;
    onSeek: (seconds: number) => void;
    onLike: () => void;
    onRepost: () => void;
    onFollow: () => void;
    onComments: () => void;
    onDetails: () => void;
    onShare: () => void;
    /** Rendered inside a phone-shaped frame (desktop) — the wrapper owns snapping. */
    framed?: boolean;
    /**
     * Pixels to lift the bottom-anchored controls by, clearing the mobile nav.
     * The artwork itself deliberately runs full-bleed underneath it, so when the
     * nav auto-hides on scroll there's artwork behind it rather than a dead gap.
     */
    bottomInset?: number;
    /** Comments pinned to a moment in this track, floated in as the playhead reaches them. */
    timedComments?: TimedComment[];
}

export interface TimedComment {
    id: string;
    username: string;
    avatarUrl?: string | null;
    content: string;
    trackTimestamp: number;
}

/** Window a timed comment stays on screen once the playhead passes it. */
const TIMED_COMMENT_LIFETIME = 5;

export const TrackSlide: React.FC<Props> = ({
    track, active, near, playing, currentTime, duration, framed, timedComments, bottomInset = 0,
    onPlayPause, onSeek, onLike, onRepost, onFollow, onComments, onDetails, onShare,
}) => {
    // env() keeps clear of the home indicator on gesture-nav phones.
    const liftFrom = (px: number) => `calc(${px + bottomInset}px + env(safe-area-inset-bottom))`;
    const lastTap = useRef(0);
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [burst, setBurst] = useState(false);
    const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
    const [dragging, setDragging] = useState(false);
    const [dragRatio, setDragRatio] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);

    const cover = track.coverUrl || null;
    const total = duration || track.duration || 0;
    const ratio = dragging ? dragRatio : (total > 0 ? Math.min(1, Math.max(0, currentTime / total)) : 0);
    const accent = track.genres?.[0] ? genreAccent(track.genres[0].name) : PRIMARY;

    const like = useCallback(() => {
        onLike();
        try { navigator.vibrate?.(18); } catch {}
        setBurst(true);
        setTimeout(() => setBurst(false), 700);
    }, [onLike]);

    // Comments the playhead has just passed — SoundCloud's timed comments, but
    // floated over the artwork the way a live chat overlay would be.
    const liveComments = React.useMemo(() => {
        if (!active || !playing || !timedComments?.length) return [];
        return timedComments
            .filter(c => currentTime >= c.trackTimestamp && currentTime - c.trackTimestamp < TIMED_COMMENT_LIFETIME)
            .slice(-2);
    }, [active, playing, timedComments, currentTime]);

    // Single tap toggles playback, double tap likes — resolve after the
    // double-tap window so one gesture never fires both.
    const handleTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 280) {
            if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
            lastTap.current = 0;
            if (!track.liked) like(); else { setBurst(true); setTimeout(() => setBurst(false), 700); }
            return;
        }
        lastTap.current = now;
        tapTimer.current = setTimeout(() => {
            tapTimer.current = null;
            setFlash(playing ? 'pause' : 'play');
            setTimeout(() => setFlash(null), 420);
            onPlayPause();
        }, 280);
    };

    // ── Scrubber drag ─────────────────────────────────────────────────────────
    const ratioFromEvent = (clientX: number) => {
        const el = barRef.current;
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return Math.min(1, Math.max(0, (clientX - r.left) / (r.width || 1)));
    };
    const onPointerDown = (e: React.PointerEvent) => {
        if (!active || !total) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        setDragRatio(ratioFromEvent(e.clientX));
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging) return;
        setDragRatio(ratioFromEvent(e.clientX));
    };
    const endDrag = (e: React.PointerEvent) => {
        if (!dragging) return;
        const r = ratioFromEvent(e.clientX);
        setDragging(false);
        onSeek(r * total);
    };

    const peaks: number[] = Array.isArray(track.waveformPeaks) ? track.waveformPeaks : [];

    return (
        <section style={{
            position: 'relative', height: '100%', width: '100%',
            ...(framed ? {} : { scrollSnapAlign: 'start', scrollSnapStop: 'always' }),
            overflow: 'hidden', background: '#06080e',
        }}>
            {/* ── Artwork ── */}
            {cover && near ? (
                <>
                    <img src={cover} alt="" aria-hidden referrerPolicy="no-referrer"
                        style={{ position: 'absolute', inset: -30, width: 'calc(100% + 60px)', height: 'calc(100% + 60px)', objectFit: 'cover', filter: 'blur(38px) brightness(0.5) saturate(1.6)' }} />
                    <img src={cover} alt={track.title} referrerPolicy="no-referrer"
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                            animation: playing && active ? 'fujiKenBurns 24s ease-in-out infinite alternate' : undefined,
                            transform: playing && active ? undefined : 'scale(1.04)',
                        }} />
                </>
            ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle at 50% 38%, ${accent}26 0%, #06080e 72%)` }}>
                    <Music size={64} color="rgba(255,255,255,0.12)" />
                </div>
            )}

            {/* Scrims — keep the header and caption legible over any artwork */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(6,8,14,0.72) 0%, rgba(6,8,14,0.12) 26%, rgba(6,8,14,0.10) 46%, rgba(6,8,14,0.80) 82%, rgba(6,8,14,0.96) 100%)' }} />

            {/* ── Tap surface ── */}
            {/* touchAction: 'manipulation' disables the browser's default ~300ms
                tap delay (held to disambiguate from double-tap-to-zoom) so a single
                tap registers immediately instead of sometimes being swallowed right
                after a scroll/swipe gesture. */}
            <div onClick={handleTap} style={{ position: 'absolute', inset: 0, cursor: 'pointer', touchAction: 'manipulation' }} />

            {/* Paused affordance */}
            {!playing && active && !flash && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                    </div>
                </div>
            )}
            {flash && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fujiFlash 0.42s ease-out forwards' }}>
                        {flash === 'play' ? <Play size={36} color="#fff" fill="#fff" style={{ marginLeft: 4 }} /> : <Pause size={36} color="#fff" fill="#fff" />}
                    </div>
                </div>
            )}
            {burst && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Heart size={110} color="#EF4444" fill="#EF4444" style={{ animation: 'fujiBurst 0.7s ease-out forwards', filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.5))' }} />
                </div>
            )}

            {/* ── Action rail ── */}
            <div style={{ position: 'absolute', right: 8, bottom: liftFrom(116), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, zIndex: 3 }}>
                <div style={{ position: 'relative', marginBottom: 6 }}>
                    <Link to={`/profile/${track.profile?.username}`} aria-label={track.profile?.username}
                        style={{ display: 'block', width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: '2px solid #fff' }}>
                        {track.profile?.avatar
                            ? <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: TEXT }}>{track.profile?.username?.[0]?.toUpperCase()}</div>}
                    </Link>
                    <button onClick={onFollow} aria-label={track.following ? 'Following' : 'Follow'}
                        style={{ position: 'absolute', left: '50%', bottom: -9, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', background: track.following ? '#22C55E' : PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, touchAction: 'manipulation' }}>
                        {track.following ? <Check size={12} color="#fff" /> : <Plus size={13} color="#fff" />}
                    </button>
                </div>

                <RailButton onClick={like} label={fmtNum(track.likeCount)}
                    icon={<Heart size={30} color={track.liked ? '#EF4444' : '#fff'} fill={track.liked ? '#EF4444' : 'none'} />} />
                <RailButton onClick={onComments} label={fmtNum(track.commentCount)}
                    icon={<MessageCircle size={29} color="#fff" fill="rgba(255,255,255,0.15)" />} />
                <RailButton onClick={onRepost} label={fmtNum(track.repostCount)}
                    icon={<Repeat2 size={29} color={track.reposted ? '#22C55E' : '#fff'} />} />
                <RailButton onClick={onShare} label="Share" icon={<Share2 size={26} color="#fff" />} />
                <RailButton onClick={onDetails} label="Info" icon={<ChevronsUp size={26} color="#fff" />} />

                {/* Spinning disc — TikTok's record, here it actually is a record */}
                <Link to={`/profile/${track.profile?.username}`} aria-label="Artist"
                    style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: '#14161f', border: '4px solid #23262f', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4, animation: playing && active ? 'fujiSpin 4s linear infinite' : undefined }}>
                    {cover && near
                        ? <img src={cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Disc3 size={20} color={SUB} />}
                </Link>
            </div>

            {/* ── Timed comments floating past ── */}
            {liveComments.length > 0 && (
                <div style={{ position: 'absolute', left: 14, right: 78, bottom: liftFrom(172), display: 'flex', flexDirection: 'column', gap: 6, zIndex: 3, pointerEvents: 'none' }}>
                    {liveComments.map(c => (
                        <div key={c.id} style={{
                            display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
                            maxWidth: '100%', padding: '5px 11px 5px 5px', borderRadius: 9999,
                            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                            animation: 'fujiCommentIn 0.35s cubic-bezier(0.2,0.8,0.2,1)',
                        }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                {c.avatarUrl
                                    ? <img src={c.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: TEXT }}>{c.username?.[0]?.toUpperCase()}</div>}
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{c.username}</span>
                            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.content}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Caption ── */}
            <div style={{ position: 'absolute', left: 14, right: 74, bottom: liftFrom(54), zIndex: 3, fontFamily: FONT }}>
                <Link to={`/profile/${track.profile?.username}`}
                    style={{ display: 'inline-block', fontSize: 14.5, fontWeight: 800, color: '#fff', textDecoration: 'none', textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
                    @{track.profile?.username}
                </Link>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 4, lineHeight: 1.25, textShadow: '0 2px 14px rgba(0,0,0,0.6)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {track.title}
                </div>
                {track.description && (
                    <button onClick={onDetails}
                        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, marginTop: 5, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.82)' }}>
                        <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{track.description}</span>
                        <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>more</span>
                    </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {(track.genres || []).slice(0, 2).map(g => (
                        <Link key={g.id} to={`/genres/${g.slug}`}
                            style={{ padding: '2px 9px', borderRadius: 9999, background: `${genreAccent(g.name)}2e`, border: `1px solid ${genreAccent(g.name)}66`, color: genreAccent(g.name), fontSize: 10.5, fontWeight: 800, textDecoration: 'none' }}>
                            {g.name}
                        </Link>
                    ))}
                    {track.bpm ? <Chip>{track.bpm} BPM</Chip> : null}
                    {track.key ? <Chip>{track.key}</Chip> : null}
                    <Chip>{fmtNum(track.playCount)} plays</Chip>
                </div>
            </div>

            {/* ── Waveform scrubber ── */}
            <div
                ref={barRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{ position: 'absolute', left: 0, right: 0, bottom: liftFrom(0), height: 46, padding: '0 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 4, touchAction: 'none', cursor: active ? 'pointer' : 'default' }}>
                <div style={{ position: 'relative', height: dragging ? 26 : 18, transition: 'height 0.15s' }}>
                    {peaks.length > 0 ? (
                        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 24`} style={{ display: 'block' }}>
                            {peaks.map((p, i) => {
                                const h = Math.max(1.5, p * 22);
                                const played = (i / peaks.length) < ratio;
                                return <rect key={i} x={i} y={(24 - h) / 2} width={0.68} height={h} rx={0.3}
                                    fill={played ? '#fff' : 'rgba(255,255,255,0.32)'} />;
                            })}
                        </svg>
                    ) : (
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, marginTop: -1.5, borderRadius: 9999, background: 'rgba(255,255,255,0.28)' }}>
                            <div style={{ width: `${ratio * 100}%`, height: '100%', borderRadius: 9999, background: '#fff' }} />
                        </div>
                    )}
                    {/* Playhead */}
                    <div style={{ position: 'absolute', top: -3, bottom: -3, left: `${ratio * 100}%`, width: 2, marginLeft: -1, background: PRIMARY, borderRadius: 2, boxShadow: `0 0 8px ${PRIMARY}` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                    <span>{fmtTime(dragging ? dragRatio * total : currentTime)}</span>
                    <span>{fmtTime(total)}</span>
                </div>
            </div>
        </section>
    );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span style={{ padding: '2px 9px', borderRadius: 9999, background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.9)', fontSize: 10.5, fontWeight: 700, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
        {children}
    </span>
);

const RailButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
    <button onClick={onClick}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.65))', touchAction: 'manipulation' }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{label}</span>
    </button>
);
