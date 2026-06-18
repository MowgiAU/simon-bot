/**
 * Alt F — Track detail page (/preview/alt_f_track)
 * Mirrors every section of the live TrackPage inside the alt_f shell.
 * Default track: thomas/testing-new-stems-feature (falls back to top weekly chart).
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
import {
    Play, Pause, Heart, Repeat2, Share2, ListPlus, Edit3, Download,
    ChevronDown, ChevronUp, AlignLeft, Layers, Zap, FileAudio,
    Clock, Activity, Tag, Calendar, Music, UserPlus, UserCheck,
    MessageCircle, Package, Youtube, ExternalLink, Swords,
} from 'lucide-react';
import { useChat } from '../components/ChatProvider';

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
    return (<div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '0 0 16px 16px' }}><iframe ref={iframeRef} key={videoId} src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&mute=1&autoplay=0&controls=1&modestbranding=1&rel=0`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>);
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
    const [descExpanded, setDescExpanded] = useState(false);
    const [videoView, setVideoView] = useState<'project' | 'video'>('project');
    const [zoom, setZoom] = useState(5.5);
    const [pluginsSamplesOpen, setPluginsSamplesOpen] = useState(false);
    const [expandedSamples, setExpandedSamples] = useState(false);
    const [activePlugin, setActivePlugin] = useState<{ rawName: string; known: any } | null>(null);
    const [lyricsExpanded, setLyricsExpanded] = useState(true);
    const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
    const [timedComments, setTimedComments] = useState<any[]>([]);
    const [hoveredComment, setHoveredComment] = useState<string | null>(null);

    // Load default track: thomas/testing-new-stems-feature, fallback to top chart
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
                // Timed comments
                try { const tc = await axios.get(`/api/tracks/${t.id}/comments?timed=true`); if (on) setTimedComments((tc.data || []).filter((c: any) => c.trackTimestamp != null)); } catch {}
                // Like / repost state
                try { const [lk, rp] = await Promise.all([axios.get(`/api/tracks/${t.id}/favourite-status`), axios.get(`/api/tracks/${t.id}/repost-status`)]); if (on) { setLiked(lk.data.favourited); setReposted(rp.data.reposted); } } catch {}
                setLoading(false);
            } catch {
                // fallback to top chart track
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

    // Follow state
    useEffect(() => {
        if (!track?.profile?.userId) return;
        axios.get(`/api/artists/${track.profile.userId}/follow`).then(r => setFollowing(r.data.following)).catch(() => {});
    }, [track?.profile?.userId]);

    // Sync active lyric line
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

    // Plugins
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

    const glass: React.CSSProperties = { background: 'rgba(23,27,38,0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${BORDER}` };
    const hasArrangement = track?.arrangement && (track.arrangement.tracks?.some((t: any) => t.clips.length > 0) || track.arrangement.projectInfo);
    const hasVideo = !!track?.youtubeUrl;
    const showProjectSection = hasArrangement || hasVideo;

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Tracks' }, { label: '…' }]} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Loading…</div>
            </main>
        </div>
    );

    if (!track) return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Tracks' }, { label: 'Not found' }]} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Track not found.</div>
            </main>
        </div>
    );

    const hasBothViews = hasArrangement && hasVideo;
    const activeSection = hasBothViews ? videoView : (hasArrangement ? 'project' : 'video');

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Tracks' }, { label: track.title }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    <div style={{ maxWidth: 1140, margin: '0 auto', padding: '32px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* ── HERO ── */}
                        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                            <div style={{ position: 'relative', padding: 32, display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                {/* Blurred bg */}
                                {track.coverUrl && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${track.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(60px) brightness(0.15)', transform: 'scale(1.3)' }} />}
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,22,0.65)' }} />

                                {/* Cover */}
                                <div onClick={() => isPlaying ? togglePlay() : playTrack()} style={{ position: 'relative', width: 220, height: 220, borderRadius: 16, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {track.coverUrl
                                        ? <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1e30' }}><Music size={60} color={`${PRIMARY}55`} /></div>}
                                    <div style={{ position: 'absolute', inset: 0, background: isPlaying ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.4)'}
                                        onMouseLeave={e => { if (!isPlaying) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)'; }}>
                                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 24px ${PRIMARY}66` }}>
                                            {isPlaying ? <Pause size={28} fill="#fff" color="#fff" /> : <Play size={28} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
                                    {/* Battle badges */}
                                    {Array.isArray(track.battles) && track.battles.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                            {track.battles.map((b: any) => (
                                                <Link key={b.entryId} to={`/battles/${b.battleSlug || b.battleId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 9999, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#F97316', fontSize: 12, fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    <Swords size={12} /> {b.battleTitle}
                                                </Link>
                                            ))}
                                        </div>
                                    )}

                                    <h1 style={{ margin: '0 0 8px', fontSize: 40, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.05 }}>{track.title}</h1>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 15, color: SUB, marginBottom: 16 }}>
                                        by <Link to={`/profile/${track.profile.username}`} style={{ color: PRIMARY, textDecoration: 'none', fontWeight: 700 }}>{track.profile.displayName || track.profile.username}</Link>
                                        {(track.collaborators || []).map((c: any) => (
                                            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                                                <Link to={`/profile/${c.profile.username}`} style={{ color: PRIMARY, textDecoration: 'none', fontWeight: 600 }}>{c.profile.displayName || c.profile.username}</Link>
                                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>({c.contribution})</span>
                                            </span>
                                        ))}
                                    </div>

                                    {/* Metadata badges */}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                                        {track.bpm && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}33`, fontSize: 13, fontWeight: 600, color: PRIMARY }}><Activity size={13} /> {track.bpm} BPM</span>}
                                        {track.key && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', fontSize: 13, fontWeight: 600, color: '#A78BFA' }}><Tag size={13} /> {track.key}</span>}
                                        {track.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, color: SUB }}><Clock size={13} /> {fmtDur(track.duration)}</span>}
                                        {track.createdAt && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, color: SUB }}><Calendar size={13} /> {new Date(track.createdAt).toLocaleDateString()}</span>}
                                    </div>

                                    {/* Genre tags */}
                                    {track.genres?.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                            {track.genres.map((g: any) => <span key={g.genre.id} style={{ background: 'rgba(255,255,255,0.06)', color: SUB, padding: '4px 12px', borderRadius: 9999, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}>{g.genre.name}</span>)}
                                        </div>
                                    )}

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: 24, marginBottom: 20, fontSize: 13, color: SUB }}>
                                        {[{ icon: <Play size={14} />, val: fmtNum(track.playCount), lbl: 'plays' }, { icon: <Heart size={14} fill={liked ? TERTIARY : 'none'} color={liked ? TERTIARY : undefined} />, val: fmtNum(likeCount), lbl: 'likes' }, { icon: <Repeat2 size={14} color={reposted ? PRIMARY : undefined} />, val: fmtNum(repostCount), lbl: 'reposts' }].map((s, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{s.icon}<span style={{ fontWeight: 700, color: TEXT }}>{s.val}</span> {s.lbl}</div>
                                        ))}
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button onClick={() => isPlaying ? togglePlay() : playTrack()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: PRIMARY, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: `0 4px 16px ${PRIMARY}44` }}>
                                            {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" />} {isPlaying ? 'Pause' : 'Play'}
                                        </button>
                                        <button onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: liked ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.15)', background: liked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: liked ? '#EF4444' : '#fff' }}>
                                            <Heart size={15} fill={liked ? '#EF4444' : 'none'} color={liked ? '#EF4444' : '#fff'} /> {liked ? 'Liked' : 'Like'}
                                        </button>
                                        <button onClick={handleRepost} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: reposted ? `1px solid ${PRIMARY}` : '1px solid rgba(255,255,255,0.15)', background: reposted ? `${PRIMARY}22` : 'rgba(255,255,255,0.05)', color: reposted ? PRIMARY : '#fff' }}>
                                            <Repeat2 size={15} /> {reposted ? 'Reposted' : 'Repost'}
                                        </button>
                                        <button onClick={() => { navigator.clipboard.writeText(window.location.href); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                            <Share2 size={15} /> Share
                                        </button>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                            <ListPlus size={15} /> Playlist
                                        </button>
                                    </div>

                                    {/* Artist mini-card */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid ${BORDER}` }}>
                                        <Link to={`/profile/${track.profile.username}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: `2px solid ${PRIMARY}44` }}>
                                                {track.profile.avatar ? <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={SUB} /></div>}
                                            </div>
                                        </Link>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Link to={`/profile/${track.profile.username}`} style={{ color: TEXT, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>{track.profile.displayName || track.profile.username}</Link>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button onClick={toggleFollow} style={{ padding: '7px 14px', borderRadius: 9999, border: following ? `1px solid ${PRIMARY}` : 'none', background: following ? 'transparent' : PRIMARY, color: following ? PRIMARY : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                {following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                                            </button>
                                            <button onClick={msgArtist} style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SECONDARY, cursor: 'pointer' }}>
                                                <MessageCircle size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── DESCRIPTION ── */}
                        {track.description && (
                            <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, borderLeft: `4px solid ${PRIMARY}` }}>
                                <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: 14, overflow: 'hidden', maxHeight: descExpanded ? 'none' : 88 }}>{track.description}</p>
                                {track.description.length > 200 && (
                                    <button onClick={() => setDescExpanded(e => !e)} style={{ marginTop: 8, background: 'none', border: 'none', color: PRIMARY, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {descExpanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read more</>}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── WAVEFORM + TIMED COMMENTS ── */}
                        {track.waveformPeaks?.length > 0 && (() => {
                            const peaks: number[] = track.waveformPeaks;
                            return (
                                <div style={{ ...glass, borderRadius: 16 }}>
                                    <div style={{ padding: '16px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Activity size={18} color={PRIMARY} />
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>Waveform</span>
                                            {player.currentTrack?.id === track.id && <span style={{ fontSize: 12, color: SUB }}>{Math.floor(player.currentTime / 60)}:{Math.floor(player.currentTime % 60).toString().padStart(2, '0')} / {fmtDur(track.duration)}</span>}
                                        </div>
                                        {timedComments.length > 0 && <span style={{ fontSize: 11, color: SUB }}>{timedComments.length} timed comment{timedComments.length !== 1 ? 's' : ''}</span>}
                                    </div>
                                    {/* Timed comment avatars */}
                                    <div style={{ position: 'relative', height: 32, margin: '0 24px', overflow: 'visible' }}>
                                        {timedComments.map((tc: any) => {
                                            const pct = (tc.trackTimestamp / (track.duration || 1)) * 100;
                                            const hov = hoveredComment === tc.id;
                                            return (
                                                <div key={tc.id} style={{ position: 'absolute', left: `${pct}%`, bottom: 0, transform: 'translateX(-50%)', zIndex: hov ? 10 : 1 }}
                                                    onMouseEnter={() => setHoveredComment(tc.id)} onMouseLeave={() => setHoveredComment(null)}
                                                    onClick={() => { if (player.currentTrack?.id === track.id) { seek(tc.trackTimestamp); } else { playTrack(); setTimeout(() => seek(tc.trackTimestamp), 200); } }}>
                                                    {hov && (
                                                        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: '#1a1e2e', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', minWidth: 140, maxWidth: 220, marginBottom: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: PRIMARY }}>{Math.floor(tc.trackTimestamp / 60)}:{Math.floor(tc.trackTimestamp % 60).toString().padStart(2, '0')}</span>
                                                                <span style={{ fontSize: 11, fontWeight: 600 }}>{tc.username}</span>
                                                            </div>
                                                            <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1', lineHeight: 1.4, wordBreak: 'break-word' }}>{tc.content.length > 100 ? tc.content.slice(0, 100) + '…' : tc.content}</p>
                                                        </div>
                                                    )}
                                                    {tc.avatarUrl ? <img src={tc.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${hov ? PRIMARY : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer' }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${PRIMARY}22`, border: `2px solid ${hov ? PRIMARY : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: PRIMARY, cursor: 'pointer' }}>{tc.username.charAt(0).toUpperCase()}</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div onClick={handleWaveformClick} style={{ cursor: 'pointer', padding: '0 24px 16px' }}>
                                        <svg width="100%" height="80" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 80`} style={{ display: 'block' }}>
                                            {peaks.map((peak: number, i: number) => {
                                                const h = Math.max(2, peak * 72); const y = (80 - h) / 2;
                                                return <rect key={i} x={i} y={y} width={0.6} height={h} fill={(i / peaks.length) < progress ? PRIMARY : 'rgba(255,255,255,0.15)'} rx={0.2} />;
                                            })}
                                        </svg>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── PROJECT / MUSIC VIDEO ── */}
                        {showProjectSection && (
                            <div style={{ borderRadius: 16, overflow: 'hidden', border: hasVideo && activeSection === 'video' ? '1px solid rgba(255,0,0,0.2)' : `1px solid ${PRIMARY}33`, background: hasVideo && activeSection === 'video' ? 'linear-gradient(135deg, rgba(255,0,0,0.06) 0%, rgba(14,18,26,0.95) 100%)' : `linear-gradient(135deg, ${PRIMARY}0a 0%, rgba(14,18,26,0.95) 50%, rgba(124,58,237,0.04) 100%)` }}>
                                {/* Section header */}
                                <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: hasVideo && activeSection === 'video' ? 'linear-gradient(135deg, #ff0000, #cc0000)' : `linear-gradient(135deg, ${PRIMARY}, #E65100)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: hasVideo && activeSection === 'video' ? '0 4px 16px rgba(255,0,0,0.4)' : `0 4px 16px ${PRIMARY}44` }}>
                                            {hasVideo && activeSection === 'video' ? <Youtube size={20} color="#fff" /> : <Layers size={20} color="#fff" />}
                                        </div>
                                        <div>
                                            {hasVideo && activeSection === 'video' ? (
                                                <><h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Music Video</h2><p style={{ margin: 0, fontSize: 12, color: SUB }}>YouTube · muted, synced to audio</p></>
                                            ) : (
                                                <><h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{track.arrangement?.fileType === 'als' ? 'Ableton Project' : 'FL Studio Project'}</h2>
                                                <p style={{ margin: 0, fontSize: 12, color: SUB }}>{[track.arrangement?.bpm && `${track.arrangement.bpm} BPM`, track.arrangement?.tracks?.filter((t: any) => t.clips.length > 0).length && `${track.arrangement.tracks.filter((t: any) => t.clips.length > 0).length} tracks`, track.arrangement?.projectInfo?.plugins?.length && `${track.arrangement.projectInfo.plugins.length} plugins`].filter(Boolean).join(' · ')}</p></>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {/* View toggle */}
                                        {hasBothViews && (
                                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2 }}>
                                                <button onClick={() => setVideoView('project')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: videoView === 'project' ? `1px solid ${PRIMARY}44` : '1px solid transparent', background: videoView === 'project' ? `${PRIMARY}18` : 'transparent', color: videoView === 'project' ? PRIMARY : SUB, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Layers size={13} /> Project</button>
                                                <button onClick={() => setVideoView('video')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: videoView === 'video' ? '1px solid rgba(255,0,0,0.3)' : '1px solid transparent', background: videoView === 'video' ? 'rgba(255,0,0,0.12)' : 'transparent', color: videoView === 'video' ? '#ff6b6b' : SUB, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Youtube size={13} /> Music Video</button>
                                            </div>
                                        )}
                                        {/* Downloads */}
                                        {track.projectFileUrl && track.allowProjectDownload !== false && (
                                            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1px solid ${PRIMARY}44`, background: `${PRIMARY}15`, color: PRIMARY, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                                                <Download size={14} /> {track.arrangement?.fileType === 'als' ? '.als' : '.flp'}
                                            </button>
                                        )}
                                        {track.projectZipUrl && track.allowProjectDownload !== false && (
                                            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                                                <Package size={14} /> Download Project
                                            </button>
                                        )}
                                        {track.allowAudioDownload && (
                                            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                                                <Download size={14} /> Audio
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Music video */}
                                {hasVideo && activeSection === 'video' && (() => { const vid = extractYouTubeId(track.youtubeUrl!); return vid ? <MemoYouTube videoId={vid} trackId={track.id} player={player} isPlaying={isPlaying} onUserPause={togglePlay} /> : null; })()}

                                {/* Arrangement */}
                                {activeSection === 'project' && hasArrangement && track.arrangement.tracks?.some((t: any) => t.clips.length > 0) && (
                                    <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}` }}>
                                        <MemoArrangement track={track} player={player} isPlaying={isPlaying} zoom={zoom} setZoom={setZoom} />
                                    </div>
                                )}

                                {/* Featured Plugins */}
                                {activeSection === 'project' && matchedPlugins.length > 0 && (
                                    <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                            <Zap size={14} color={PRIMARY} />
                                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: PRIMARY }}>Plugins Used</span>
                                            <span style={{ fontSize: 11, color: SUB }}>({matchedPlugins.length})</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                            {matchedPlugins.map(({ rawName, known }: any) => {
                                                const label = known.displayName || rawName;
                                                return (
                                                    <button key={known.id} onClick={() => setActivePlugin({ rawName, known })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${PRIMARY}25`, cursor: 'pointer', textAlign: 'left' }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: '#0a0d14', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                            {known.imageUrl ? <img src={known.imageUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4, boxSizing: 'border-box' }} /> : <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.2)' }}>{label.slice(0, 2).toUpperCase()}</span>}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{label}</div>
                                                            {known.developer && <div style={{ fontSize: 11, color: SUB, whiteSpace: 'nowrap' }}>{known.developer}</div>}
                                                            {known.category && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: PRIMARY, marginTop: 2 }}>{known.category}</div>}
                                                        </div>
                                                        {known.link && <ExternalLink size={12} color={PRIMARY} style={{ marginLeft: 2, flexShrink: 0, opacity: 0.7 }} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {activePlugin && <PluginModal rawName={activePlugin.rawName} known={activePlugin.known} onClose={() => setActivePlugin(null)} />}

                                {/* Plugins & Samples collapsible */}
                                {activeSection === 'project' && track.arrangement?.projectInfo && (unmatchedPlugins.length > 0 || track.arrangement.projectInfo.samples.length > 0) && (
                                    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
                                        <button onClick={() => setPluginsSamplesOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', background: 'none', border: 'none', cursor: 'pointer', color: SUB }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Zap size={15} color={PRIMARY} />
                                                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    {`Plugins & Samples (${unmatchedPlugins.length} plugins, ${track.arrangement.projectInfo.samples.length} samples)`}
                                                </span>
                                            </div>
                                            {pluginsSamplesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        {pluginsSamplesOpen && (
                                            <div style={{ padding: '0 28px 20px', display: 'grid', gridTemplateColumns: unmatchedPlugins.length > 0 && track.arrangement.projectInfo.samples.length > 0 ? '1fr 1fr' : '1fr', gap: 20 }}>
                                                {unmatchedPlugins.length > 0 && (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Zap size={15} color={PRIMARY} /><span style={{ fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Other Plugins ({unmatchedPlugins.length})</span></div>
                                                        <PluginList plugins={unmatchedPlugins} registry={[]} />
                                                    </div>
                                                )}
                                                {track.arrangement.projectInfo.samples.length > 0 && (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><FileAudio size={15} color="#A78BFA" /><span style={{ fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Samples ({track.arrangement.projectInfo.samples.length})</span></div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {(expandedSamples ? track.arrangement.projectInfo.samples : track.arrangement.projectInfo.samples.slice(0, 12)).map((s: string, i: number) => (
                                                                <span key={i} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#C4A8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{s}</span>
                                                            ))}
                                                        </div>
                                                        {track.arrangement.projectInfo.samples.length > 12 && (
                                                            <button onClick={() => setExpandedSamples(e => !e)} style={{ marginTop: 8, background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                {expandedSamples ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {track.arrangement.projectInfo.samples.length} samples</>}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEMS MIXER ── */}
                        {track.stems?.length > 0 && (
                            <StemsMixer stems={track.stems} trackTitle={track.title} masterDuration={track.duration} playerTrack={track} allowDownload={track.allowStemsDownload ?? true} />
                        )}

                        {/* ── COMMENTS ── */}
                        <CommentSection
                            trackId={track.id}
                            ownerId={track.profile.userId}
                            currentTrackTime={player.currentTrack?.id === track.id ? player.currentTime : null}
                            isCurrentTrack={player.currentTrack?.id === track.id}
                            onCommentPosted={refreshTimedComments}
                            onSeek={(seconds) => { if (player.currentTrack?.id === track.id) { seek(seconds); } else { playTrack(); setTimeout(() => seek(seconds), 200); } }}
                        />

                        {/* ── LYRICS ── */}
                        {(track.lyrics || track.lyricsSync?.length > 0) && (
                            <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <AlignLeft size={18} color={PRIMARY} />
                                        <span style={{ fontWeight: 700, fontSize: 16 }}>Lyrics</span>
                                        {track.lyricsSync?.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 9999, background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, color: PRIMARY }}>Synced</span>}
                                    </div>
                                    <button onClick={() => setLyricsExpanded(e => !e)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                        {lyricsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                                {lyricsExpanded && (
                                    <div style={{ padding: '20px 24px' }}>
                                        {track.lyricsSync?.length > 0 ? (
                                            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                                                {track.lyricsSync.map((cue: any, i: number) => (
                                                    <div key={i} onClick={() => { if (player.currentTrack?.id === track.id) seek(cue.time); else playTrack(); }}
                                                        style={{ padding: '7px 0', cursor: 'pointer', fontSize: activeLyricIdx === i ? 17 : 15, fontWeight: activeLyricIdx === i ? 700 : 400, color: activeLyricIdx === i ? PRIMARY : SUB, transition: 'all 0.25s', lineHeight: 1.5 }}>
                                                        {cue.text || <span style={{ opacity: 0.3 }}>♪</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <pre style={{ margin: 0, color: SUB, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>{track.lyrics}</pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
};
