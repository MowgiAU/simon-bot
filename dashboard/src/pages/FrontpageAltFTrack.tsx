/**
 * Alt F — Track detail page (/preview/alt_f_track)
 * Layout matches track.html mockup: 8/4 col grid, glass cards, no full-bleed hero.
 * Left col: artist card → cover/video → actions + description → waveform + transport → FL timeline → lyrics
 * Right col: stems mixer → comments
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
    Play, Pause, SkipBack, SkipForward, Heart, Repeat2, Share2, ListPlus, Download,
    ChevronDown, ChevronUp, AlignLeft, Layers, Zap, FileAudio,
    Clock, Activity, Tag, Music, UserPlus, UserCheck,
    MessageCircle, Package, Youtube, ExternalLink, Swords, BadgeCheck, Flag,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
function extractYouTubeId(url: string): string | null {
    try { const u = new URL(url); if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null; if (u.hostname.includes('youtube.com')) { const v = u.searchParams.get('v'); if (v) return v; const m = u.pathname.match(/\/embed\/([^/?]+)/); if (m) return m[1]; } } catch {} return null;
}

const glass: React.CSSProperties = { background: 'rgba(28,31,42,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 };

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
    return (
        <iframe ref={iframeRef} key={videoId}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&mute=1&autoplay=0&controls=1&modestbranding=1&rel=0`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    );
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
    const [videoView, setVideoView] = useState<'project' | 'video'>('video');
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
        for (let i = track.lyricsSync.length - 1; i >= 0; i--) { if (t >= track.lyricsSync[i].time) { idx = i; break; } }
        setActiveLyricIdx(idx);
    }, [player.currentTime, track, player.currentTrack?.id]);

    const isThis = player.currentTrack?.id === track?.id;
    const isPlaying = isThis && player.isPlaying;
    const progress = track ? (isThis ? player.currentTime / (player.duration || track.duration || 1) : 0) : 0;

    const playTrack = () => { if (track) setTrack(track, [track]); };
    const toggleLike = () => { setLiked(l => !l); setLikeCount(n => liked ? n - 1 : n + 1); if (track?.id) axios.post(`/api/tracks/${track.id}/favourite`).catch(() => {}); };
    const handleRepost = () => { setReposted(r => !r); setRepostCount(n => reposted ? n - 1 : n + 1); if (track?.id) axios.post(`/api/tracks/${track.id}/repost`).catch(() => {}); };
    const toggleFollow = () => { setFollowing(f => !f); if (track?.profile?.userId) axios.post(`/api/artists/${track.profile.userId}/follow`).catch(() => {}); };
    const msgArtist = async () => { if (!track?.profile?.userId) return; try { await startConversation(track.profile.userId); } catch {} };
    const refreshTimedComments = async () => { if (!track?.id) return; try { const r = await axios.get(`/api/tracks/${track.id}/comments?timed=true`); setTimedComments((r.data || []).filter((c: any) => c.trackTimestamp != null)); } catch {} };

    const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        if (isThis) { seek(pct * (player.duration || track.duration || 0)); }
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
        return pluginRegistry.length > 0 ? track.arrangement.projectInfo.plugins.filter((n: string) => !matchPlugin(n, pluginRegistry)) : track.arrangement.projectInfo.plugins;
    }, [track, pluginRegistry]);

    const hasArrangement = !!(track?.arrangement && (track.arrangement.tracks?.some((t: any) => t.clips.length > 0) || track.arrangement.projectInfo));
    const hasVideo = !!track?.youtubeUrl;
    const hasBothViews = hasArrangement && hasVideo;
    // Default to video if available, else project
    const activeSection = hasBothViews ? videoView : (hasVideo ? 'video' : 'project');
    const youtubeId = track?.youtubeUrl ? extractYouTubeId(track.youtubeUrl) : null;

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
            <div style={{ maxWidth: 1680, margin: '0 auto', padding: '24px 32px', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>

                {/* ── LEFT COLUMN ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* 1. Artist mini-card */}
                    <section style={{ ...glass, padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                            {/* Avatar */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)', background: S_HIGH }}>
                                    {track.profile.avatar
                                        ? <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={28} color={SUB} /></div>}
                                </div>
                                {track.profile.isVerified && (
                                    <div style={{ position: 'absolute', bottom: -2, right: -2, background: PRIMARY, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${BG}` }}>
                                        <BadgeCheck size={12} color="#fff" />
                                    </div>
                                )}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#fff' }}>
                                    <Link to={`/profile/${track.profile.username}`} style={{ color: '#fff', textDecoration: 'none' }}>{track.profile.displayName || track.profile.username}</Link>
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {[{ val: fmtNum(track.profile.followerCount), lbl: 'Followers' }, { val: fmtNum(track.profile.totalPlays || track.profile.playCount), lbl: 'Plays' }, { val: fmtNum((track.profile.tracks || []).length || track.profile.trackCount), lbl: 'Tracks' }].map((s, i) => (
                                        <React.Fragment key={i}>
                                            {i > 0 && <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />}
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.val}</div>
                                                <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.lbl}</div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                <button onClick={toggleFollow} style={{ display: 'flex', alignItems: 'center', gap: 7, background: following ? 'transparent' : PRIMARY, color: following ? PRIMARY : '#fff', border: following ? `1px solid ${PRIMARY}` : 'none', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
                                    {following ? <UserCheck size={16} /> : <UserPlus size={16} />} {following ? 'Following' : 'Follow'}
                                </button>
                                <button onClick={msgArtist} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', color: SECONDARY, border: `1px solid ${SECONDARY}`, padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                    <MessageCircle size={16} /> Message
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* 2. Cover / Video — aspect-video */}
                    <section style={{ ...glass, overflow: 'hidden', position: 'relative', aspectRatio: '16/9' }}>
                        {/* Background: cover art or YouTube */}
                        {activeSection === 'video' && youtubeId
                            ? <MemoYouTube videoId={youtubeId} trackId={track.id} player={player} isPlaying={isPlaying} onUserPause={togglePlay} />
                            : <>
                                {track.coverUrl && <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,14,24,0.9) 0%, rgba(10,14,24,0.2) 60%, transparent 100%)' }} />
                                {/* Centered play button */}
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <button onClick={() => isPlaying ? togglePlay() : playTrack()} style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}>
                                        {isPlaying ? <Pause size={40} fill="#fff" color="#fff" /> : <Play size={40} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />}
                                    </button>
                                </div>
                            </>
                        }
                        {/* Title overlay at bottom-left (like mockup) */}
                        {activeSection !== 'video' && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 20px', pointerEvents: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{track.title}</h2>
                                        <p style={{ margin: '4px 0 0', color: PRIMARY, fontWeight: 700, fontSize: 13 }}>{(track.genres || []).map((g: any) => g.genre.name).join(' · ').toUpperCase() || 'OFFICIAL RELEASE'}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {hasBothViews && (
                                            <button onClick={() => setVideoView(v => v === 'video' ? 'project' : 'video')} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, pointerEvents: 'all' }}>
                                                <Youtube size={13} /> Video
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Video mode title */}
                        {activeSection === 'video' && hasBothViews && (
                            <button onClick={() => setVideoView('project')} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, zIndex: 5 }}>
                                <Layers size={13} /> Project
                            </button>
                        )}
                    </section>

                    {/* 3. Action bar + description */}
                    <section style={{ ...glass, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {[
                                    { icon: <Heart size={15} fill={liked ? '#EF4444' : 'none'} color={liked ? '#EF4444' : SUB} />, label: fmtNum(likeCount), active: liked, activeColor: '#EF4444', onClick: toggleLike },
                                    { icon: <Repeat2 size={15} color={reposted ? PRIMARY : SUB} />, label: fmtNum(repostCount), active: reposted, activeColor: PRIMARY, onClick: handleRepost },
                                    { icon: <Share2 size={15} color={SUB} />, label: 'Share', active: false, activeColor: '#fff', onClick: () => navigator.clipboard.writeText(window.location.href) },
                                    { icon: <ListPlus size={15} color={SUB} />, label: 'Add to Playlist', active: false, activeColor: '#fff', onClick: () => {} },
                                ].map((btn, i) => (
                                    <button key={i} onClick={btn.onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: btn.active ? btn.activeColor : SUB, transition: 'all 0.15s' }}>
                                        {btn.icon} {btn.label}
                                    </button>
                                ))}
                            </div>
                            <button style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <Flag size={14} /> Report
                            </button>
                        </div>
                        {/* Battle badges */}
                        {Array.isArray(track.battles) && track.battles.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {track.battles.map((b: any) => (
                                    <span key={b.entryId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 9999, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#F97316', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        <Swords size={12} /> {b.battleTitle}
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* Metadata chips */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {track.bpm && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}33`, fontSize: 12, fontWeight: 600, color: SECONDARY }}><Activity size={11} /> {track.bpm} BPM</span>}
                            {track.key && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', fontSize: 12, fontWeight: 600, color: '#A78BFA' }}><Tag size={11} /> {track.key}</span>}
                            {track.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: SUB }}><Clock size={11} /> {fmtDur(track.duration)}</span>}
                            {(track.genres || []).map((g: any) => <span key={g.genre.id} style={{ padding: '3px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: SUB }}>{g.genre.name}</span>)}
                        </div>
                        {/* Description */}
                        {track.description && (
                            <div>
                                <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.7, overflow: 'hidden', maxHeight: descExpanded ? 'none' : 66, whiteSpace: 'pre-wrap' }}>{track.description}</p>
                                {track.description.length > 160 && (
                                    <button onClick={() => setDescExpanded(e => !e)} style={{ marginTop: 6, background: 'none', border: 'none', color: PRIMARY, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                                        {descExpanded ? 'Show less' : 'Read More'}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>

                    {/* 4. Waveform — Master Channel with transport */}
                    <section style={{ ...glass, padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Master Channel</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{track.title}</span>
                                    {track.bpm && <span style={{ padding: '2px 8px', borderRadius: 6, background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}33`, color: SECONDARY, fontSize: 10, fontWeight: 700 }}>{track.bpm} BPM</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 12, fontFamily: 'monospace', color: SECONDARY }}>{fmtDur(isThis ? player.currentTime : 0)} / {fmtDur(track.duration)}</span>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <button onClick={() => { if (isThis) seek(Math.max(0, player.currentTime - 10)); }} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 6 }}><SkipBack size={18} /></button>
                                    <button onClick={() => isPlaying ? togglePlay() : playTrack()} style={{ width: 44, height: 44, borderRadius: '50%', background: PRIMARY, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 16px ${PRIMARY}55` }}>
                                        {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" style={{ marginLeft: 2 }} />}
                                    </button>
                                    <button onClick={() => { if (isThis) seek(Math.min(player.duration, player.currentTime + 10)); }} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 6 }}><SkipForward size={18} /></button>
                                </div>
                            </div>
                        </div>
                        {/* Timed comment dots */}
                        {timedComments.length > 0 && (
                            <div style={{ position: 'relative', height: 18, marginBottom: 2 }}>
                                {timedComments.map((tc: any) => {
                                    const pct = (tc.trackTimestamp / (track.duration || 1)) * 100;
                                    const hov = hoveredComment === tc.id;
                                    return (
                                        <div key={tc.id} style={{ position: 'absolute', left: `${pct}%`, bottom: 0, transform: 'translateX(-50%)', zIndex: hov ? 10 : 1 }}
                                            onMouseEnter={() => setHoveredComment(tc.id)} onMouseLeave={() => setHoveredComment(null)}
                                            onClick={() => { if (isThis) seek(tc.trackTimestamp); else { playTrack(); setTimeout(() => seek(tc.trackTimestamp), 200); } }}>
                                            {hov && (
                                                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: '#1a1e2e', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 8px', minWidth: 110, maxWidth: 180, marginBottom: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20 }}>
                                                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: PRIMARY }}>{Math.floor(tc.trackTimestamp / 60)}:{Math.floor(tc.trackTimestamp % 60).toString().padStart(2, '0')} · {tc.username}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>{tc.content.slice(0, 70)}{tc.content.length > 70 ? '…' : ''}</p>
                                                </div>
                                            )}
                                            {tc.avatarUrl ? <img src={tc.avatarUrl} alt="" style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${hov ? PRIMARY : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer' }} /> : <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${PRIMARY}22`, border: `2px solid ${hov ? PRIMARY : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: PRIMARY, cursor: 'pointer' }}>{tc.username.charAt(0).toUpperCase()}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {/* Waveform bars */}
                        {track.waveformPeaks?.length > 0 ? (
                            <div onClick={handleWaveformClick} style={{ height: 96, cursor: 'pointer', position: 'relative' }}>
                                {/* Playhead */}
                                {isThis && progress > 0 && (
                                    <div style={{ position: 'absolute', left: `${progress * 100}%`, top: 0, bottom: 0, width: 1, background: '#fff', boxShadow: '0 0 8px #fff', zIndex: 5, pointerEvents: 'none' }} />
                                )}
                                <svg width="100%" height="96" preserveAspectRatio="none" viewBox={`0 0 ${track.waveformPeaks.length} 96`} style={{ display: 'block' }}>
                                    {(track.waveformPeaks as number[]).map((peak: number, i: number) => {
                                        const h = Math.max(2, peak * 80); const y = (96 - h) / 2;
                                        const played = (i / track.waveformPeaks.length) < progress;
                                        return <rect key={i} x={i} y={y} width={0.7} height={h} fill={played ? PRIMARY : 'rgba(255,255,255,0.1)'} rx={0.3} />;
                                    })}
                                </svg>
                            </div>
                        ) : (
                            /* Deterministic bars fallback */
                            <div onClick={handleWaveformClick} style={{ height: 96, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden' }}>
                                {(() => { let h = 5381; for (const c of track.id) h = (h * 33 ^ c.charCodeAt(0)) >>> 0; return Array.from({ length: 140 }, (_, i) => { h = (h * 1664525 + 1013904223) >>> 0; const ht = 10 + (h % 80); return <div key={i} style={{ flex: 1, height: `${ht}%`, borderRadius: 9999, background: (i / 140) < progress ? PRIMARY : 'rgba(255,255,255,0.1)', transition: 'height 0.2s' }} />; }); })()}
                            </div>
                        )}
                    </section>

                    {/* 5. FL Project Timeline */}
                    {hasArrangement && (
                        <section style={{ ...glass, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 20px', borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(23,27,38,0.5)' }}>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>
                                    {track.arrangement?.fileType === 'als' ? 'Ableton' : 'FL Studio'} Project Timeline
                                </h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {track.projectFileUrl && track.allowProjectDownload !== false && <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: `${PRIMARY}15`, border: `1px solid ${PRIMARY}44`, color: PRIMARY, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}><Download size={11} /> {track.arrangement?.fileType === 'als' ? '.als' : '.flp'}</button>}
                                    {track.projectZipUrl && track.allowProjectDownload !== false && <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: SUB, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}><Package size={11} /> ZIP</button>}
                                </div>
                            </div>
                            {track.arrangement.tracks?.some((t: any) => t.clips.length > 0) && (
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                                    <MemoArrangement track={track} player={player} isPlaying={isPlaying} zoom={zoom} setZoom={setZoom} />
                                </div>
                            )}
                            {/* Matched plugins */}
                            {matchedPlugins.length > 0 && (
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                        <Zap size={12} color={PRIMARY} />
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: PRIMARY }}>Plugins Used</span>
                                        <span style={{ fontSize: 10, color: SUB }}>({matchedPlugins.length})</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {matchedPlugins.map(({ rawName, known }: any) => (
                                            <button key={known.id} onClick={() => setActivePlugin({ rawName, known })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 5px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${PRIMARY}20`, cursor: 'pointer' }}>
                                                <div style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', background: '#0a0d14', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {known.imageUrl ? <img src={known.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, boxSizing: 'border-box' }} /> : <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.2)' }}>{(known.displayName || rawName).slice(0, 2).toUpperCase()}</span>}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{known.displayName || rawName}</div>
                                                    {known.developer && <div style={{ fontSize: 9, color: SUB }}>{known.developer}</div>}
                                                </div>
                                                {known.link && <ExternalLink size={9} color={PRIMARY} style={{ flexShrink: 0, opacity: 0.6 }} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activePlugin && <PluginModal rawName={activePlugin.rawName} known={activePlugin.known} onClose={() => setActivePlugin(null)} />}
                            {/* All plugins + samples collapsible */}
                            {(unmatchedPlugins.length > 0 || track.arrangement.projectInfo?.samples?.length > 0) && (
                                <>
                                    <button onClick={() => setPluginsSamplesOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', color: SUB, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={11} color={PRIMARY} /> All plugins & samples</span>
                                        {pluginsSamplesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                    {pluginsSamplesOpen && (
                                        <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: unmatchedPlugins.length > 0 && track.arrangement.projectInfo?.samples?.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
                                            {unmatchedPlugins.length > 0 && <div><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}><Zap size={11} color={PRIMARY} /><span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Other Plugins</span></div><PluginList plugins={unmatchedPlugins} registry={[]} /></div>}
                                            {track.arrangement.projectInfo?.samples?.length > 0 && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}><FileAudio size={11} color="#A78BFA" /><span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Samples</span></div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {(expandedSamples ? track.arrangement.projectInfo.samples : track.arrangement.projectInfo.samples.slice(0, 12)).map((s: string, i: number) => (
                                                            <span key={i} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#C4A8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s}</span>
                                                        ))}
                                                        {track.arrangement.projectInfo.samples.length > 12 && <button onClick={() => setExpandedSamples(e => !e)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontSize: 10 }}>{expandedSamples ? 'Show less' : `+${track.arrangement.projectInfo.samples.length - 12} more`}</button>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {/* 6. Comments */}
                    <section style={{ ...glass, overflow: 'hidden' }}>
                        <CommentSection
                            trackId={track.id}
                            ownerId={track.profile.userId}
                            currentTrackTime={isThis ? player.currentTime : null}
                            isCurrentTrack={isThis}
                            onCommentPosted={refreshTimedComments}
                            onSeek={(seconds) => { if (isThis) seek(seconds); else { playTrack(); setTimeout(() => seek(seconds), 200); } }}
                        />
                    </section>
                </div>

                {/* ── RIGHT COLUMN — sticky, viewport-height ── */}
                <div style={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

                    {/* Stems Mixer */}
                    {track.stems?.length > 0 && (
                        <section style={{ ...glass, overflow: 'hidden', flexShrink: 0 }}>
                            <StemsMixer stems={track.stems} trackTitle={track.title} masterDuration={track.duration} playerTrack={track} allowDownload={track.allowStemsDownload ?? true} compact />
                        </section>
                    )}

                    {/* Lyrics */}
                    {(track.lyrics || track.lyricsSync?.length > 0) && (
                        <section style={{ ...glass, overflow: 'hidden', flexShrink: 0 }}>
                            <button onClick={() => setLyricsExpanded(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', color: TEXT }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlignLeft size={15} color={PRIMARY} />
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>Lyrics</span>
                                    {track.lyricsSync?.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 9999, background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Synced</span>}
                                </div>
                                {lyricsExpanded ? <ChevronUp size={13} color={SUB} /> : <ChevronDown size={13} color={SUB} />}
                            </button>
                            {lyricsExpanded && (
                                <div style={{ padding: '0 20px 20px' }}>
                                    {track.lyricsSync?.length > 0 ? (
                                        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                                            {track.lyricsSync.map((cue: any, i: number) => (
                                                <div key={i} onClick={() => { if (isThis) seek(cue.time); else playTrack(); }}
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
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
