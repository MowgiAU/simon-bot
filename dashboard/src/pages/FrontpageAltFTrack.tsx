/**
 * Alt F — Track detail page (/preview/alt_f_track)
 * Full-bleed cinematic hero + two-column layout (main content / sidebar).
 * Matches the alt_f design language from Home/Charts/Artist pages.
 */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { CommentSection } from '../components/CommentSection';
import { StemsMixer } from '../components/StemsMixer';
import { ArrangementViewer, usePluginRegistry, matchPlugin, PluginModal, PluginList } from '../components/ArrangementViewer';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { useChat } from '../components/ChatProvider';
import {
    Play, Pause, Heart, Repeat2, Share2, ListPlus, Download,
    ChevronDown, ChevronUp, AlignLeft, Layers, Zap, FileAudio,
    Clock, Activity, Tag, Calendar, Music, UserPlus, UserCheck,
    MessageCircle, Package, Youtube, ExternalLink, Swords,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
function extractYouTubeId(url: string): string | null {
    try { const u = new URL(url); if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null; if (u.hostname.includes('youtube.com')) { const v = u.searchParams.get('v'); if (v) return v; const m = u.pathname.match(/\/embed\/([^/?]+)/); if (m) return m[1]; } } catch {} return null;
}

const MemoArrangement: React.FC<{ track: any; player: any; isPlaying: boolean; zoom: number; setZoom: (v: number) => void }> = React.memo(({ track, player, isPlaying, zoom, setZoom }) => {
    const samplesMap = useMemo(() => Object.fromEntries((track.samples ?? []).map((s: any) => [s.originalFilename.toLowerCase(), s.peaks])), [track.samples]);
    const ctRef = useRef(0); const ipRef = useRef(false);
    ctRef.current = player.currentTrack?.id === track.id ? player.currentTime : 0;
    ipRef.current = isPlaying && player.currentTrack?.id === track.id;
    return <ArrangementViewer arrangement={track.arrangement!} duration={track.duration} currentTimeRef={ctRef} isPlayingRef={ipRef} projectFileUrl={track.projectFileUrl} projectZipUrl={track.projectZipUrl} trackId={track.id} zoom={zoom} setZoom={setZoom} samplesMap={samplesMap} />;
});

const MemoYouTube: React.FC<{ videoId: string; trackId: string; player: any; isPlaying: boolean; onUserPause: () => void }> = React.memo(({ videoId, trackId, player, isPlaying, onUserPause }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const ctRef = useRef(0); const ipRef = useRef(false); const lastSent = useRef<boolean | null>(null); const progRef = useRef(false); const progTimer = useRef<any>(null);
    const isThis = player.currentTrack?.id === trackId;
    ctRef.current = isThis ? player.currentTime : 0; ipRef.current = isPlaying && isThis;
    const cmd = useCallback((fn: string, args: any[] = [], prog = false) => { if (prog) { progRef.current = true; if (progTimer.current) clearTimeout(progTimer.current); progTimer.current = setTimeout(() => { progRef.current = false; }, 600); } iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: fn, args }), '*'); }, []);
    useEffect(() => { const h = (e: MessageEvent) => { if (e.source !== iframeRef.current?.contentWindow) return; let d: any; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; } if (d?.event !== 'onStateChange') return; if (progRef.current) return; if (d.info === 2 && ipRef.current) onUserPause(); }; window.addEventListener('message', h); return () => window.removeEventListener('message', h); }, [onUserPause]);
    useEffect(() => { const t = setInterval(() => { const sp = ipRef.current; if (sp === lastSent.current) return; if (sp) { cmd('seekTo', [ctRef.current, true], true); cmd('playVideo', [], true); } else { cmd('pauseVideo', [], true); } lastSent.current = sp; }, 500); return () => clearInterval(t); }, [cmd]);
    return (<div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 12 }}><iframe ref={iframeRef} key={videoId} src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&mute=1&autoplay=0&controls=1&modestbranding=1&rel=0`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>);
});

export const FrontpageAltFTrack: React.FC = () => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const { user } = useAuth();
    const { startConversation } = useChat();
    const pluginRegistry = usePluginRegistry();

    const [track, setTrackData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [reposted, setReposted] = useState(false);
    const [repostCount, setRepostCount] = useState(0);
    const [following, setFollowing] = useState(false);
    const [videoView, setVideoView] = useState<'project' | 'video'>('project');
    const [zoom, setZoom] = useState(5.5);
    const [pluginsSamplesOpen, setPluginsSamplesOpen] = useState(false);
    const [expandedSamples, setExpandedSamples] = useState(false);
    const [activePlugin, setActivePlugin] = useState<{ rawName: string; known: any } | null>(null);
    const [lyricsExpanded, setLyricsExpanded] = useState(true);
    const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
    const [timedComments, setTimedComments] = useState<any[]>([]);
    const [hoveredComment, setHoveredComment] = useState<string | null>(null);
    const [descExpanded, setDescExpanded] = useState(false);

    useEffect(() => {
        let on = true;
        const load = async () => {
            try {
                const r = await axios.get('/api/musician/tracks/thomas/testing-new-stems-feature', { withCredentials: true });
                if (!on) return;
                const t = r.data;
                setTrackData(t);
                setLikeCount(t.likeCount || 0);
                setRepostCount(t.repostCount || 0);
                try { const tc = await axios.get(`/api/tracks/${t.id}/comments?timed=true`); if (on) setTimedComments((tc.data || []).filter((c: any) => c.trackTimestamp != null)); } catch {}
                try { const [lk, rp] = await Promise.all([axios.get(`/api/tracks/${t.id}/favourite-status`), axios.get(`/api/tracks/${t.id}/repost-status`)]); if (on) { setLiked(lk.data.favourited); setReposted(rp.data.reposted); } } catch {}
                setLoading(false);
            } catch {
                try {
                    const r2 = await axios.get('/api/charts/weekly');
                    const entries = Array.isArray(r2.data) ? r2.data[0]?.entries : r2.data?.entries;
                    const slug = entries?.[0]?.track?.slug || entries?.[0]?.track?.id;
                    const uname = entries?.[0]?.track?.profile?.username;
                    if (slug && uname) {
                        const r3 = await axios.get(`/api/musician/tracks/${uname}/${slug}`, { withCredentials: true });
                        if (on) { setTrackData(r3.data); setLikeCount(r3.data.likeCount || 0); setRepostCount(r3.data.repostCount || 0); }
                    }
                } catch {}
                if (on) setLoading(false);
            }
        };
        load();
        return () => { on = false; };
    }, []);

    useEffect(() => {
        if (!track?.profile?.userId) return;
        axios.get(`/api/artists/${track.profile.userId}/follow`).then(r => setFollowing(r.data.following)).catch(() => {});
    }, [track?.profile?.userId]);

    useEffect(() => {
        if (!track?.lyricsSync?.length) return;
        const t = player.currentTrack?.id === track.id ? player.currentTime : -1;
        if (t < 0) { setActiveLyricIdx(-1); return; }
        let idx = -1;
        for (let i = track.lyricsSync.length - 1; i >= 0; i--) {
            if (t >= track.lyricsSync[i].time) { idx = i; break; }
        }
        setActiveLyricIdx(idx);
    }, [player.currentTime, track, player.currentTrack?.id]);

    const isPlaying = player.currentTrack?.id === track?.id && player.isPlaying;
    const progress = track ? (player.currentTrack?.id === track.id ? player.currentTime / (player.duration || track.duration || 1) : 0) : 0;

    const playTrack = () => { if (track) setTrack(track, [track]); };
    const toggleLike = () => { setLiked(l => !l); setLikeCount(n => liked ? n - 1 : n + 1); if (track?.id) axios.post(`/api/tracks/${track.id}/favourite`).catch(() => {}); };
    const handleRepost = () => { setReposted(r => !r); setRepostCount(n => reposted ? n - 1 : n + 1); if (track?.id) axios.post(`/api/tracks/${track.id}/repost`).catch(() => {}); };
    const toggleFollow = () => { setFollowing(f => !f); if (track?.profile?.userId) axios.post(`/api/artists/${track.profile.userId}/follow`).catch(() => {}); };
    const msgArtist = async () => { if (!track?.profile?.userId) return; try { await startConversation(track.profile.userId); } catch {} };
    const refreshTimedComments = async () => { if (!track?.id) return; try { const r = await axios.get(`/api/tracks/${track.id}/comments?timed=true`); setTimedComments((r.data || []).filter((c: any) => c.trackTimestamp != null)); } catch {} };

    const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        if (player.currentTrack?.id === track?.id) { seek(pct * (player.duration || track.duration || 0)); }
        else { playTrack(); setTimeout(() => seek(pct * (track.duration || 0)), 200); }
    };

    const matchedPlugins = useMemo(() => {
        if (!track?.arrangement?.projectInfo || pluginRegistry.length === 0) return [];
        const seen = new Set<string>();
        return track.arrangement.projectInfo.plugins.reduce((acc: any[], name: string) => {
            const known = matchPlugin(name, pluginRegistry);
            if (known && !seen.has(known.id)) { seen.add(known.id); acc.push({ rawName: name, known }); }
            return acc;
        }, []);
    }, [track, pluginRegistry]);

    const unmatchedPlugins = useMemo(() => {
        if (!track?.arrangement?.projectInfo) return [];
        return pluginRegistry.length > 0
            ? track.arrangement.projectInfo.plugins.filter((n: string) => !matchPlugin(n, pluginRegistry))
            : track.arrangement.projectInfo.plugins;
    }, [track, pluginRegistry]);

    const hasArrangement = track?.arrangement && (track.arrangement.tracks?.some((t: any) => t.clips.length > 0) || track.arrangement.projectInfo);
    const hasVideo = !!track?.youtubeUrl;
    const hasBothViews = hasArrangement && hasVideo;
    const activeSection = hasBothViews ? videoView : (hasArrangement ? 'project' : 'video');

    const shell = (child: React.ReactNode) => (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Tracks' }, { label: track?.title || '…' }]} />
                {child}
            </main>
        </div>
    );

    if (loading) return shell(<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Loading…</div>);
    if (!track) return shell(<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Track not found.</div>);

    return shell(
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

            {/* ── FULL-BLEED HERO ── */}
            <section style={{ position: 'relative', width: '100%', height: 460, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${BG} 0%, #1a0f05 100%)` }} />
                {track.coverUrl && <img src={track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG} 0%, rgba(15,19,29,0.4) 65%, transparent 100%)` }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,19,29,0.9), transparent 70%)' }} />

                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '0 40px 36px', boxSizing: 'border-box', display: 'flex', gap: 28, alignItems: 'flex-end' }}>
                    {/* Cover */}
                    <div onClick={() => isPlaying ? togglePlay() : playTrack()} style={{ width: 160, height: 160, borderRadius: 12, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                        {track.coverUrl
                            ? <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S_HIGH }}><Music size={48} color={`${PRIMARY}55`} /></div>}
                        <div style={{ position: 'absolute', inset: 0, background: isPlaying ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.45)'}
                            onMouseLeave={e => { if (!isPlaying) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)'; }}>
                            <div style={{ width: 52, height: 52, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 24px ${PRIMARY}66` }}>
                                {isPlaying ? <Pause size={24} fill="#fff" color="#fff" /> : <Play size={24} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />}
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                        {Array.isArray(track.battles) && track.battles.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                {track.battles.map((b: any) => (
                                    <span key={b.entryId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#F97316', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        <Swords size={11} /> {b.battleTitle}
                                    </span>
                                ))}
                            </div>
                        )}
                        {track.genres?.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                                {track.genres.map((g: any) => <span key={g.genre.id} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', padding: '2px 10px', borderRadius: 9999, fontSize: 11 }}>{g.genre.name}</span>)}
                            </div>
                        )}
                        <h1 style={{ margin: '0 0 6px', fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 16, color: SUB, marginBottom: 14 }}>
                            by <Link to={`/profile/${track.profile.username}`} style={{ color: PRIMARY, textDecoration: 'none', fontWeight: 700 }}>{track.profile.displayName || track.profile.username}</Link>
                            {(track.collaborators || []).map((c: any) => (
                                <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                                    <Link to={`/profile/${c.profile.username}`} style={{ color: SECONDARY, textDecoration: 'none', fontWeight: 600 }}>{c.profile.displayName || c.profile.username}</Link>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {track.bpm && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 6, background: `${PRIMARY}20`, border: `1px solid ${PRIMARY}40`, fontSize: 13, fontWeight: 600, color: PRIMARY }}><Activity size={12} /> {track.bpm} BPM</span>}
                            {track.key && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 6, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', fontSize: 13, fontWeight: 600, color: '#A78BFA' }}><Tag size={12} /> {track.key}</span>}
                            {track.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, color: SUB }}><Clock size={12} /> {fmtDur(track.duration)}</span>}
                            {track.createdAt && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, color: SUB }}><Calendar size={12} /> {new Date(track.createdAt).toLocaleDateString()}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => isPlaying ? togglePlay() : playTrack()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: PRIMARY, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: `0 0 20px ${PRIMARY}55` }}>
                                {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" />} {isPlaying ? 'Pause' : 'Play'}
                            </button>
                            <button onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9999, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: liked ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.2)', background: liked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)', color: liked ? '#EF4444' : '#fff' }}>
                                <Heart size={15} fill={liked ? '#EF4444' : 'none'} color={liked ? '#EF4444' : '#fff'} /> {fmtNum(likeCount)}
                            </button>
                            <button onClick={handleRepost} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9999, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: reposted ? `1px solid ${PRIMARY}` : '1px solid rgba(255,255,255,0.2)', background: reposted ? `${PRIMARY}22` : 'rgba(255,255,255,0.08)', color: reposted ? PRIMARY : '#fff' }}>
                                <Repeat2 size={15} /> {fmtNum(repostCount)}
                            </button>
                            <button onClick={() => navigator.clipboard.writeText(window.location.href)} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Share2 size={16} />
                            </button>
                            <button style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ListPlus size={16} />
                            </button>
                            <span style={{ color: SUB, fontSize: 13, marginLeft: 4 }}>{fmtNum(track.playCount)} plays</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── TWO-COLUMN BODY ── */}
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 40px', boxSizing: 'border-box', display: 'flex', gap: 32, alignItems: 'flex-start' }}>

                {/* LEFT: main content */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>

                    {/* Waveform */}
                    {track.waveformPeaks?.length > 0 && (() => {
                        const peaks: number[] = track.waveformPeaks;
                        return (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB }}>
                                        Waveform{player.currentTrack?.id === track.id ? ` · ${fmtDur(player.currentTime)} / ${fmtDur(track.duration)}` : ''}
                                    </span>
                                    {timedComments.length > 0 && <span style={{ fontSize: 11, color: SUB }}>{timedComments.length} timed comment{timedComments.length !== 1 ? 's' : ''}</span>}
                                </div>
                                {/* Timed comment dots */}
                                <div style={{ position: 'relative', height: 20, marginBottom: 2 }}>
                                    {timedComments.map((tc: any) => {
                                        const pct = (tc.trackTimestamp / (track.duration || 1)) * 100;
                                        const hov = hoveredComment === tc.id;
                                        return (
                                            <div key={tc.id} style={{ position: 'absolute', left: `${pct}%`, bottom: 0, transform: 'translateX(-50%)', zIndex: hov ? 10 : 1 }}
                                                onMouseEnter={() => setHoveredComment(tc.id)} onMouseLeave={() => setHoveredComment(null)}
                                                onClick={() => { if (player.currentTrack?.id === track.id) seek(tc.trackTimestamp); else { playTrack(); setTimeout(() => seek(tc.trackTimestamp), 200); } }}>
                                                {hov && (
                                                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: '#1a1e2e', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', minWidth: 120, maxWidth: 200, marginBottom: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20 }}>
                                                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: PRIMARY }}>{Math.floor(tc.trackTimestamp / 60)}:{Math.floor(tc.trackTimestamp % 60).toString().padStart(2, '0')} · {tc.username}</p>
                                                        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#CBD5E1', lineHeight: 1.4, wordBreak: 'break-word' }}>{tc.content.length > 80 ? tc.content.slice(0, 80) + '…' : tc.content}</p>
                                                    </div>
                                                )}
                                                {tc.avatarUrl ? <img src={tc.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${hov ? PRIMARY : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer' }} /> : <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${PRIMARY}22`, border: `2px solid ${hov ? PRIMARY : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: PRIMARY, cursor: 'pointer' }}>{tc.username.charAt(0).toUpperCase()}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div onClick={handleWaveformClick} style={{ cursor: 'pointer' }}>
                                    <svg width="100%" height="72" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 72`} style={{ display: 'block' }}>
                                        {peaks.map((peak: number, i: number) => {
                                            const h = Math.max(2, peak * 64); const y = (72 - h) / 2;
                                            return <rect key={i} x={i} y={y} width={0.6} height={h} fill={(i / peaks.length) < progress ? PRIMARY : 'rgba(255,255,255,0.12)'} rx={0.2} />;
                                        })}
                                    </svg>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Project / Music Video */}
                    {(hasArrangement || hasVideo) && (
                        <div style={{ background: 'rgba(28,31,42,0.5)', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 8, background: hasVideo && activeSection === 'video' ? 'linear-gradient(135deg, #ff0000, #cc0000)' : `linear-gradient(135deg, ${PRIMARY}, #E65100)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {hasVideo && activeSection === 'video' ? <Youtube size={17} color="#fff" /> : <Layers size={17} color="#fff" />}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{hasVideo && activeSection === 'video' ? 'Music Video' : `${track.arrangement?.fileType === 'als' ? 'Ableton' : 'FL Studio'} Project`}</h3>
                                        {activeSection === 'project' && track.arrangement?.projectInfo && <p style={{ margin: 0, fontSize: 11, color: SUB }}>{[track.arrangement.bpm && `${track.arrangement.bpm} BPM`, track.arrangement.projectInfo.plugins?.length && `${track.arrangement.projectInfo.plugins.length} plugins`].filter(Boolean).join(' · ')}</p>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {hasBothViews && (
                                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3, gap: 2 }}>
                                            <button onClick={() => setVideoView('project')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: videoView === 'project' ? `1px solid ${PRIMARY}44` : '1px solid transparent', background: videoView === 'project' ? `${PRIMARY}18` : 'transparent', color: videoView === 'project' ? PRIMARY : SUB, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Layers size={12} /> Project</button>
                                            <button onClick={() => setVideoView('video')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: videoView === 'video' ? '1px solid rgba(255,0,0,0.3)' : '1px solid transparent', background: videoView === 'video' ? 'rgba(255,0,0,0.12)' : 'transparent', color: videoView === 'video' ? '#ff6b6b' : SUB, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Youtube size={12} /> Video</button>
                                        </div>
                                    )}
                                    {track.projectFileUrl && track.allowProjectDownload !== false && <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${PRIMARY}44`, background: `${PRIMARY}15`, color: PRIMARY, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}><Download size={12} /> {track.arrangement?.fileType === 'als' ? '.als' : '.flp'}</button>}
                                    {track.projectZipUrl && track.allowProjectDownload !== false && <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}><Package size={12} /> ZIP</button>}
                                </div>
                            </div>
                            {hasVideo && activeSection === 'video' && (() => { const vid = extractYouTubeId(track.youtubeUrl!); return vid ? <MemoYouTube videoId={vid} trackId={track.id} player={player} isPlaying={isPlaying} onUserPause={togglePlay} /> : null; })()}
                            {activeSection === 'project' && hasArrangement && track.arrangement.tracks?.some((t: any) => t.clips.length > 0) && (
                                <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}` }}>
                                    <MemoArrangement track={track} player={player} isPlaying={isPlaying} zoom={zoom} setZoom={setZoom} />
                                </div>
                            )}
                            {activeSection === 'project' && matchedPlugins.length > 0 && (
                                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                        <Zap size={12} color={PRIMARY} />
                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: PRIMARY }}>Plugins Used</span>
                                        <span style={{ fontSize: 11, color: SUB }}>({matchedPlugins.length})</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {matchedPlugins.map(({ rawName, known }: any) => (
                                            <button key={known.id} onClick={() => setActivePlugin({ rawName, known })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${PRIMARY}22`, cursor: 'pointer' }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: '#0a0d14', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {known.imageUrl ? <img src={known.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3, boxSizing: 'border-box' }} /> : <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.2)' }}>{(known.displayName || rawName).slice(0, 2).toUpperCase()}</span>}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{known.displayName || rawName}</div>
                                                    {known.developer && <div style={{ fontSize: 10, color: SUB }}>{known.developer}</div>}
                                                </div>
                                                {known.link && <ExternalLink size={10} color={PRIMARY} style={{ flexShrink: 0, opacity: 0.6 }} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activePlugin && <PluginModal rawName={activePlugin.rawName} known={activePlugin.known} onClose={() => setActivePlugin(null)} />}
                            {activeSection === 'project' && track.arrangement?.projectInfo && (unmatchedPlugins.length > 0 || track.arrangement.projectInfo.samples.length > 0) && (
                                <>
                                    <button onClick={() => setPluginsSamplesOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer', color: SUB }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={12} color={PRIMARY} /> All plugins & samples</span>
                                        {pluginsSamplesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                    {pluginsSamplesOpen && (
                                        <div style={{ padding: '0 18px 16px', display: 'grid', gridTemplateColumns: unmatchedPlugins.length > 0 && track.arrangement.projectInfo.samples.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
                                            {unmatchedPlugins.length > 0 && <div><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Zap size={12} color={PRIMARY} /><span style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Other Plugins</span></div><PluginList plugins={unmatchedPlugins} registry={[]} /></div>}
                                            {track.arrangement.projectInfo.samples.length > 0 && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><FileAudio size={12} color="#A78BFA" /><span style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Samples</span></div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                                        {(expandedSamples ? track.arrangement.projectInfo.samples : track.arrangement.projectInfo.samples.slice(0, 10)).map((s: string, i: number) => (
                                                            <span key={i} style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#C4A8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s}</span>
                                                        ))}
                                                        {track.arrangement.projectInfo.samples.length > 10 && <button onClick={() => setExpandedSamples(e => !e)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontSize: 11 }}>{expandedSamples ? 'Show less' : `+${track.arrangement.projectInfo.samples.length - 10} more`}</button>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Stems */}
                    {track.stems?.length > 0 && (
                        <StemsMixer stems={track.stems} trackTitle={track.title} masterDuration={track.duration} playerTrack={track} allowDownload={track.allowStemsDownload ?? true} />
                    )}

                    {/* Lyrics */}
                    {(track.lyrics || track.lyricsSync?.length > 0) && (
                        <div style={{ background: 'rgba(28,31,42,0.5)', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                            <button onClick={() => setLyricsExpanded(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: TEXT }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlignLeft size={15} color={PRIMARY} />
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>Lyrics</span>
                                    {track.lyricsSync?.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, color: PRIMARY }}>Synced</span>}
                                </div>
                                {lyricsExpanded ? <ChevronUp size={13} color={SUB} /> : <ChevronDown size={13} color={SUB} />}
                            </button>
                            {lyricsExpanded && (
                                <div style={{ padding: '0 18px 18px' }}>
                                    {track.lyricsSync?.length > 0 ? (
                                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                            {track.lyricsSync.map((cue: any, i: number) => (
                                                <div key={i} onClick={() => { if (player.currentTrack?.id === track.id) seek(cue.time); else playTrack(); }}
                                                    style={{ padding: '5px 0', cursor: 'pointer', fontSize: activeLyricIdx === i ? 15 : 13, fontWeight: activeLyricIdx === i ? 700 : 400, color: activeLyricIdx === i ? PRIMARY : SUB, transition: 'all 0.2s', lineHeight: 1.5 }}>
                                                    {cue.text || <span style={{ opacity: 0.3 }}>♪</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <pre style={{ margin: 0, color: SUB, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 13 }}>{track.lyrics}</pre>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT: sidebar */}
                <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Artist card */}
                    <div style={{ background: 'rgba(28,31,42,0.5)', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        {track.profile.avatar && (
                            <div style={{ height: 70, overflow: 'hidden', position: 'relative' }}>
                                <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(14px) brightness(0.35)', transform: 'scale(1.2)' }} />
                            </div>
                        )}
                        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: track.profile.avatar ? -28 : 14 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${BG}`, background: S_HIGH, marginBottom: 8 }}>
                                {track.profile.avatar ? <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={20} color={SUB} /></div>}
                            </div>
                            <Link to={`/profile/${track.profile.username}`} style={{ color: TEXT, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>{track.profile.displayName || track.profile.username}</Link>
                            {track.profile.bio && <p style={{ margin: '5px 0 10px', fontSize: 12, color: SUB, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{track.profile.bio}</p>}
                            <div style={{ display: 'flex', gap: 8, marginTop: 4, width: '100%' }}>
                                <button onClick={toggleFollow} style={{ flex: 1, padding: '7px 0', borderRadius: 9999, border: following ? `1px solid ${PRIMARY}` : 'none', background: following ? 'transparent' : PRIMARY, color: following ? PRIMARY : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                    {following ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
                                </button>
                                <button onClick={msgArtist} style={{ width: 34, height: 34, borderRadius: '50%', background: S_CONT, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SECONDARY, cursor: 'pointer' }}>
                                    <MessageCircle size={13} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {track.description && (
                        <div style={{ padding: '12px 14px', background: 'rgba(28,31,42,0.5)', borderRadius: 12, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${PRIMARY}` }}>
                            <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: 13, overflow: 'hidden', maxHeight: descExpanded ? 'none' : 72 }}>{track.description}</p>
                            {track.description.length > 140 && (
                                <button onClick={() => setDescExpanded(e => !e)} style={{ marginTop: 5, background: 'none', border: 'none', color: PRIMARY, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                    {descExpanded ? 'Show less' : 'Read more'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Comments */}
                    <div style={{ background: 'rgba(28,31,42,0.5)', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>Comments</span>
                        </div>
                        <CommentSection
                            trackId={track.id}
                            ownerId={track.profile.userId}
                            currentTrackTime={player.currentTrack?.id === track.id ? player.currentTime : null}
                            isCurrentTrack={player.currentTrack?.id === track.id}
                            onCommentPosted={refreshTimedComments}
                            onSeek={(seconds) => { if (player.currentTrack?.id === track.id) seek(seconds); else { playTrack(); setTimeout(() => seek(seconds), 200); } }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
