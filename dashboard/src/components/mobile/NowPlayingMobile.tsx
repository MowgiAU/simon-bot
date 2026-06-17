/**
 * Mobile Track / Now-Playing view — the Stitch mockup design bound to the real
 * track + the shared player. Rendered only on mobile inside DiscoveryLayout.
 * Stems mixer and project/arrangement viewer are desktop-only and omitted here.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ChevronLeft, Share2, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat2, ListPlus, Download } from 'lucide-react';
import { usePlayer } from '../PlayerProvider';
import { SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, waveHeights } from '../../pages/MobilePreviewChrome';

const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

const iconBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: TEXT, cursor: 'pointer', padding: 0 };

export const NowPlayingMobile: React.FC<{ track: any }> = ({ track }) => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const isCurrent = player.currentTrack?.id === track.id;
    const isPlaying = isCurrent && player.isPlaying;
    const duration = (isCurrent && player.duration) || track.duration || 0;
    const elapsed = isCurrent ? player.currentTime : 0;
    const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

    const artist = track.profile?.displayName || track.profile?.username || track.artist || 'Unknown';
    const chips = [track.bpm ? `${track.bpm} BPM` : '', track.key || ''].filter(Boolean);

    const peaks: number[] = Array.isArray(track.waveformPeaks) && track.waveformPeaks.length
        ? track.waveformPeaks
        : waveHeights(track.title || track.id);
    const maxPeak = Math.max(...peaks, 1);
    const bars = peaks.slice(0, 64);
    const playedBars = Math.floor(bars.length * progress);

    const [reposted, setReposted] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    useEffect(() => {
        axios.get(`/api/comments?trackId=${track.id}&limit=20`, { withCredentials: true })
            .then(r => setComments(r.data?.comments || []))
            .catch(() => {});
    }, [track.id]);

    const onPlay = () => { isCurrent ? togglePlay() : setTrack(track, [track]); };
    const onSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (!isCurrent) setTrack(track, [track]);
        if (duration) seek(frac * duration);
    };
    const toggleRepost = () => {
        axios.post(`/api/tracks/${track.id}/repost`, {}, { withCredentials: true })
            .then(r => setReposted(!!r.data?.reposted)).catch(() => {});
    };

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '4px 16px 24px', color: TEXT }}>
            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 16px' }}>
                <Link to={`/profile/${track.profile?.username || ''}`} aria-label="Back" style={{ ...iconBtn, width: 40, height: 40, color: TEXT }}><ChevronLeft size={26} /></Link>
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>Now Playing</span>
                <button aria-label="Share" onClick={() => { try { navigator.share?.({ url: window.location.href, title: track.title }); } catch { /* noop */ } }} style={{ ...iconBtn, width: 40, height: 40 }}><Share2 size={22} /></button>
            </header>

            {/* Cover */}
            <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}`, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', cursor: 'pointer' }} onClick={onPlay}>
                {track.coverUrl
                    ? <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: '#1F2937' }} />}
            </div>

            {/* Title + favourite */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 24 }}>
                <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{track.title}</h2>
                    <Link to={`/profile/${track.profile?.username || ''}`} style={{ display: 'inline-block', marginTop: 4, fontSize: 18, fontWeight: 600, color: CYAN, textDecoration: 'none' }}>{artist}</Link>
                </div>
                <button aria-label="Repost" onClick={toggleRepost} style={{ width: 48, height: 48, borderRadius: '50%', background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Heart size={24} fill={reposted ? PRIMARY : 'none'} color={reposted ? PRIMARY : SUB} />
                </button>
            </div>

            {/* Chips */}
            {chips.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {chips.map(c => <span key={c} style={{ padding: '4px 12px', borderRadius: 6, background: '#111827', color: CYAN, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', border: '1px solid #1E293B' }}>{c}</span>)}
                    {(track.genres || []).slice(0, 2).map((g: any) => <span key={g.genre?.id} style={{ padding: '4px 12px', borderRadius: 9999, background: '#1F2937', color: TEXT, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}` }}>#{g.genre?.name}</span>)}
                </div>
            )}

            {/* Waveform (seekable) */}
            <div style={{ marginTop: 22 }}>
                <div onClick={onSeekClick} style={{ display: 'flex', alignItems: 'center', gap: 2, height: 64, cursor: 'pointer' }}>
                    {bars.map((bh, i) => (
                        <div key={i} style={{
                            flex: 1, height: `${Math.max(8, (bh / maxPeak) * 100)}%`, borderRadius: 2,
                            background: i === playedBars ? '#fff' : i < playedBars ? PRIMARY : 'rgba(6,182,212,0.3)',
                            boxShadow: i === playedBars ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
                        }} />
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, letterSpacing: '0.1em' }}>
                    <span style={{ color: PRIMARY, fontWeight: 500 }}>{fmt(elapsed)}</span>
                    <span style={{ color: SUB }}>{fmt(duration)}</span>
                </div>
            </div>

            {/* Transport */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '20px 0' }}>
                <button aria-label="Shuffle" style={{ ...iconBtn, color: SUB }}><Shuffle size={22} /></button>
                <button aria-label="Restart" onClick={() => seek(0)} style={iconBtn}><SkipBack size={32} fill={TEXT} /></button>
                <button aria-label="Play/Pause" onClick={onPlay} style={{ width: 80, height: 80, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 0 30px rgba(242,120,10,0.4)' }}>
                    {isPlaying ? <Pause size={34} fill="#fff" /> : <Play size={36} fill="#fff" style={{ marginLeft: 4 }} />}
                </button>
                <button aria-label="End" onClick={() => duration && seek(duration - 1)} style={iconBtn}><SkipForward size={32} fill={TEXT} /></button>
                <button aria-label="Repeat" style={{ ...iconBtn, color: SUB }}><Repeat size={22} /></button>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '16px 0', marginTop: 8 }}>
                <button onClick={toggleRepost} style={{ ...iconBtn, flexDirection: 'column', gap: 4, color: reposted ? PRIMARY : SUB }}>
                    <Repeat2 size={22} /><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Repost</span>
                </button>
                <button style={{ ...iconBtn, flexDirection: 'column', gap: 4, color: SUB }}>
                    <ListPlus size={22} /><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Playlist</span>
                </button>
                {track.allowAudioDownload && track.url ? (
                    <a href={track.url} download style={{ ...iconBtn, flexDirection: 'column', gap: 4, color: SUB, textDecoration: 'none' }}>
                        <Download size={22} /><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Download</span>
                    </a>
                ) : (
                    <span style={{ ...iconBtn, flexDirection: 'column', gap: 4, color: 'rgba(148,163,184,0.4)' }}>
                        <Download size={22} /><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Download</span>
                    </span>
                )}
            </div>

            {/* Comments */}
            {comments.length > 0 && (
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Comments</h3>
                    {comments.slice(0, 10).map((c, i) => {
                        const cu = c.user || c.author || c.profile || {};
                        const name = cu.displayName || cu.username || c.username || 'User';
                        const avatar = cu.avatar || c.avatar;
                        const text = c.content || c.text || c.body || '';
                        return (
                            <div key={c.id || i} style={{ display: 'flex', gap: 12, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#1F2937', border: `1px solid ${BORDER}` }}>
                                    {avatar && <img src={avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: CYAN }}>{name}</span>
                                    <p style={{ margin: '2px 0 0', fontSize: 14, color: TEXT, wordBreak: 'break-word' }}>{text}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
