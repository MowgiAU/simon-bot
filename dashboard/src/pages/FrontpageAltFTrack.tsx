/**
 * Alt F — Track detail page (/preview/alt_f_track)
 * Layout matches track.html mockup: 8/4 col grid, glass cards, no full-bleed hero.
 * Left col: artist card → cover/video → actions + description → waveform + transport → FL timeline → lyrics
 * Right col: stems mixer → comments
 */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { useChat } from '../components/ChatProvider';
import { CommentSection } from '../components/CommentSection';
import { StemsMixer } from '../components/StemsMixer';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { showToast } from '../components/Toast';
import { ArrangementViewer, usePluginRegistry, matchPlugin, PluginModal, PluginList } from '../components/ArrangementViewer';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar, RailSection } from '../components/altshell/AltActivitySidebar';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import {
    Play, Pause, SkipBack, SkipForward, Heart, Repeat2, Share2, ListPlus, Download,
    ChevronDown, ChevronUp, AlignLeft, Zap, FileAudio,
    Clock, Activity, Tag, Music, UserPlus, UserCheck,
    MessageCircle, Package, ExternalLink, Swords, BadgeCheck, Flag,
    User, FileText,
} from 'lucide-react';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
function extractYouTubeId(url: string): string | null {
    try { const u = new URL(url); if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null; if (u.hostname.includes('youtube.com')) { const v = u.searchParams.get('v'); if (v) return v; const m = u.pathname.match(/\/embed\/([^/?]+)/); if (m) return m[1]; } } catch {} return null;
}

const DIVIDER = 'rgba(87,66,54,0.25)';
const glass: React.CSSProperties = { background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', borderRadius: 16 };

const MemoArrangement: React.FC<{ track: any; player: any; isPlaying: boolean; zoom: number; setZoom: (v: number) => void }> = React.memo(({ track, player, isPlaying, zoom, setZoom }) => {
    const samplesMap = useMemo(() => Object.fromEntries((track.samples ?? []).map((s: any) => [s.originalFilename.toLowerCase(), s.peaks])), [track.samples]);
    const ctRef = useRef(0); const ipRef = useRef(false);
    ctRef.current = player.currentTrack?.id === track.id ? player.currentTime : 0;
    ipRef.current = isPlaying && player.currentTrack?.id === track.id;
    return <ArrangementViewer arrangement={track.arrangement!} duration={track.duration} currentTimeRef={ctRef} isPlayingRef={ipRef} projectFileUrl={track.projectFileUrl} projectZipUrl={track.projectZipUrl} trackId={track.id} zoom={zoom} setZoom={setZoom} samplesMap={samplesMap} />;
});

// NOTE: the official youtube.com/iframe_api script cannot be used here — the site's CSP
// only allows youtube.com in frame-src, not script-src, so loading that script is silently
// blocked by the browser (confirmed in production: window.YT never populated, no iframe was
// ever created). We talk to the embedded iframe directly via postMessage instead, which only
// needs frame-src permission. Verified in production that the postMessage command reaches the
// iframe's contentWindow correctly (intercepted via a Proxy around contentWindow for testing).
// The video is muted and exists purely as a visual companion to the site's audio player —
// it is not an independent playback surface. We drive it one-way (audio state -> video
// seekTo/play/pause commands via postMessage, confirmed reliable in production) and disable
// its own native controls entirely, because listening for events BACK from the embed
// (onStateChange) turned out to be unreliable without the official YT.Player API — which
// this site's CSP blocks from loading (script-src doesn't include youtube.com, only
// frame-src does). Without reliable inbound events, letting users click the video's native
// play/pause silently did nothing to the actual song. Instead, clicks on the video area are
// caught by an overlay and routed straight to the same play/pause used everywhere else on
// the page, exactly like the non-video cover-art fallback below.
const MemoYouTube: React.FC<{ videoId: string; trackId: string; player: any; isPlaying: boolean; onToggle: () => void }> = React.memo(({ videoId, trackId, player, isPlaying, onToggle }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const ctRef = useRef(0); const ipRef = useRef(false); const lastSent = useRef<boolean | null>(null); const lastTimeRef = useRef(0);
    const isThis = player.currentTrack?.id === trackId;
    ctRef.current = isThis ? player.currentTime : 0; ipRef.current = isPlaying && isThis;
    const cmd = (fn: string, args: any[] = []) => { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: fn, args }), '*'); };
    // Every tick: sync play/pause state on transitions, and re-seek the video whenever the
    // audio position jumps by more than natural playback drift (manual scrub/skip), not just
    // on play/pause toggles.
    useEffect(() => { const t = setInterval(() => {
        const sp = ipRef.current; const ct = ctRef.current;
        const jumped = Math.abs(ct - lastTimeRef.current) > 1.5;
        if (sp !== lastSent.current) {
            if (sp) { cmd('seekTo', [ct, true]); cmd('playVideo'); } else { cmd('pauseVideo'); }
            lastSent.current = sp;
        } else if (jumped) {
            cmd('seekTo', [ct, true]);
        }
        lastTimeRef.current = ct;
    }, 500); return () => clearInterval(t); }, []);
    return (
        <>
            <iframe ref={iframeRef} key={videoId}
                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&mute=1&autoplay=0&controls=0&modestbranding=1&rel=0`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            <button onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 0 : 1, transition: 'opacity 0.2s' }}>
                    <Play size={40} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
                </div>
            </button>
        </>
    );
});

export const FrontpageAltFTrack: React.FC = () => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const { user } = useAuth();
    const { startConversation, setDropdownOpen: setMessengerOpen } = useChat();
    const pluginRegistry = usePluginRegistry();
    const bp = useAltBreakpoint();
    const isMobile = bp === 'xs';

    const [track, setTrackData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [reposted, setReposted] = useState(false);
    const [repostCount, setRepostCount] = useState(0);
    const [following, setFollowing] = useState(false);
    const [zoom, setZoom] = useState(5.5);
    // The track endpoint returns only the profile's scalar fields, so follower/track
    // counts aren't included — fetch them from the artist endpoints (as the profile page does).
    const [artistFollowers, setArtistFollowers] = useState<number | null>(null);
    const [artistTrackCount, setArtistTrackCount] = useState<number | null>(null);
    const [pluginsSamplesOpen, setPluginsSamplesOpen] = useState(false);
    const [expandedSamples, setExpandedSamples] = useState(false);
    const [activePlugin, setActivePlugin] = useState<{ rawName: string; known: any } | null>(null);
    const [lyricsExpanded, setLyricsExpanded] = useState(true);
    const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
    const [timedComments, setTimedComments] = useState<any[]>([]);
    const [hoveredComment, setHoveredComment] = useState<string | null>(null);
    const [descExpanded, setDescExpanded] = useState(false);
    const [startingChat, setStartingChat] = useState(false);
    const [playlistModalOpen, setPlaylistModalOpen] = useState(false);

    useEffect(() => {
        let on = true;
        // Resolve the target track from the URL. Live route is /profile/:username/:slug
        // (or /track/:username/:slug); the preview URL falls back to ?u=&slug=, then the demo.
        const resolveTarget = (): { username: string; slug: string } => {
            const m = window.location.pathname.match(/^\/(?:profile|track)\/([^/]+)\/([^/]+)\/?$/);
            if (m) return { username: decodeURIComponent(m[1]), slug: decodeURIComponent(m[2]) };
            const sp = new URLSearchParams(window.location.search);
            const u = sp.get('u') || sp.get('username');
            const s = sp.get('slug') || sp.get('track');
            if (u && s) return { username: u, slug: s };
            return { username: 'thomas', slug: 'testing-new-stems-feature' };
        };
        const load = async () => {
            try {
                const target = resolveTarget();
                const r = await axios.get(`/api/musician/tracks/${encodeURIComponent(target.username)}/${encodeURIComponent(target.slug)}`, { withCredentials: true });
                if (!on) return;
                const t = r.data;
                setTrackData(t);
                setLikeCount(t.likeCount || 0);
                setRepostCount(t.repostCount || 0);
                try { const tc = await axios.get(`/api/tracks/${t.id}/comments?timed=true`); if (on) setTimedComments((tc.data || []).filter((c: any) => c.trackTimestamp != null)); } catch {}
                try { const [lk, rp] = await Promise.all([axios.get(`/api/tracks/${t.id}/favourite`, { withCredentials: true }), axios.get(`/api/tracks/${t.id}/repost`, { withCredentials: true })]); if (on) { setLiked(lk.data.favourited); setReposted(rp.data.reposted); } } catch {}
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
        if (track) {
            const artist = track.profile?.displayName || track.profile?.username || track.artist || 'Unknown';
            document.title = `${track.title || 'Track'} by ${artist} | Fuji Studio`;
        }
    }, [track]);

    useEffect(() => {
        const prof = track?.profile;
        if (!prof?.id) return;
        axios.get(`/api/artists/${prof.id}/follower-count`).then(r => setArtistFollowers(r.data?.count ?? 0)).catch(() => {});
        if (prof.username) {
            axios.get(`/api/musician/profile/${prof.username}`).then(r => {
                setArtistTrackCount((r.data?.tracks || []).filter((t: any) => t.isPublic !== false).length);
            }).catch(() => {});
        }
    }, [track?.profile?.id]);

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
    const togglePlayback = () => isPlaying ? togglePlay() : playTrack();
    const toggleLike = () => {
        if (!user) { showToast('Log in to like tracks', 'info'); return; }
        if (!track?.id) return;
        setLiked(l => !l); setLikeCount(n => liked ? n - 1 : n + 1);
        axios.post(`/api/tracks/${track.id}/favourite`, {}, { withCredentials: true }).catch(() => {
            setLiked(l => !l); setLikeCount(n => liked ? n + 1 : n - 1);
            showToast('Could not like this track — please try again', 'error');
        });
    };
    const handleRepost = () => {
        if (!user) { showToast('Log in to repost tracks', 'info'); return; }
        if (!track?.id) return;
        if (track.profile?.userId === user.id) { showToast("You can't repost your own track", 'info'); return; }
        setReposted(r => !r); setRepostCount(n => reposted ? n - 1 : n + 1);
        axios.post(`/api/tracks/${track.id}/repost`, {}, { withCredentials: true }).catch(() => {
            setReposted(r => !r); setRepostCount(n => reposted ? n + 1 : n - 1);
            showToast('Could not repost this track — please try again', 'error');
        });
    };
    const toggleFollow = () => {
        if (!user) { showToast('Log in to follow artists', 'info'); return; }
        if (!track?.profile?.userId) return;
        setFollowing(f => !f);
        axios.post(`/api/artists/${track.profile.userId}/follow`, {}, { withCredentials: true }).catch(() => {
            setFollowing(f => !f);
            showToast('Could not follow this artist — please try again', 'error');
        });
    };
    const msgArtist = async () => {
        if (!user) { showToast('Log in to message artists', 'info'); return; }
        if (!track?.profile?.userId || startingChat) return;
        setStartingChat(true);
        try {
            const id = await startConversation([track.profile.userId]);
            if (id) setMessengerOpen(true);
            else showToast('Could not start a conversation — please try again', 'error');
        } catch { showToast('Could not start a conversation — please try again', 'error'); }
        finally { setStartingChat(false); }
    };
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
    const youtubeId = track?.youtubeUrl ? extractYouTubeId(track.youtubeUrl) : null;
    const showVideo = !!youtubeId;

    const shell = (child: React.ReactNode, sideExtras?: React.ReactNode, railSectionsParam?: RailSection[]) => (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Tracks' }, { label: track?.title || '…' }]} />
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    {child}
                    <AltActivitySidebar topSlot={sideExtras} showCommunity={!sideExtras} railSections={railSectionsParam} />
                </div>
            </main>
            {track && <AddToPlaylistModal trackId={track.id} open={playlistModalOpen} onClose={() => setPlaylistModalOpen(false)} />}
        </div>
    );

    if (loading) return shell(<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}><AltSpinner /></div>);
    if (!track) return shell(<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Track not found.</div>);

    // Artist card
    const artistSection = (
                    <section style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH, border: '2px solid rgba(255,255,255,0.1)' }}>
                                {track.profile.avatar
                                    ? <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={20} color={SUB} /></div>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <Link to={`/profile/${track.profile.username}`} style={{ color: '#fff', textDecoration: 'none' }}>{track.profile.displayName || track.profile.username}</Link>
                                </h3>
                                {track.profile.isVerified && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}><BadgeCheck size={11} color={PRIMARY} /><span style={{ fontSize: 10, color: PRIMARY, fontWeight: 700 }}>Verified</span></div>}
                            </div>
                        </div>
                        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${DIVIDER}` }}>
                            {[{ val: fmtNum(artistFollowers ?? track.profile.followerCount), lbl: 'Followers' }, { val: fmtNum(track.profile.totalPlays || track.profile.playCount), lbl: 'Plays' }, { val: fmtNum(artistTrackCount ?? ((track.profile.tracks || []).length || track.profile.trackCount)), lbl: 'Tracks' }].map((s, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.val}</div>
                                    <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.lbl}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
                            <button onClick={toggleFollow} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: following ? 'transparent' : PRIMARY, color: following ? PRIMARY : '#fff', border: following ? `1px solid ${PRIMARY}` : 'none', padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                                {following ? <UserCheck size={14} /> : <UserPlus size={14} />} {following ? 'Following' : 'Follow'}
                            </button>
                            <button onClick={msgArtist} disabled={startingChat} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', color: SECONDARY, border: `1px solid ${SECONDARY}`, padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: startingChat ? 'default' : 'pointer', opacity: startingChat ? 0.6 : 1 }}>
                                <MessageCircle size={14} /> Message
                            </button>
                        </div>
                    </section>
    );

    // Track info: actions + metadata + description
    const actionsSection = (
                    <section style={{ ...glass, borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {[
                                { icon: <Heart size={14} fill={liked ? '#EF4444' : 'none'} color={liked ? '#EF4444' : SUB} />, label: fmtNum(likeCount), active: liked, activeColor: '#EF4444', onClick: toggleLike },
                                { icon: <Repeat2 size={14} color={reposted ? PRIMARY : SUB} />, label: fmtNum(repostCount), active: reposted, activeColor: PRIMARY, onClick: handleRepost },
                                { icon: <Share2 size={14} color={SUB} />, label: 'Share', active: false, activeColor: '#fff', onClick: () => {
                                    navigator.clipboard?.writeText(window.location.href)
                                        .then(() => showToast('Link copied to clipboard', 'success'))
                                        .catch(() => showToast('Could not copy link', 'error'));
                                } },
                                { icon: <ListPlus size={14} color={SUB} />, label: 'Playlist', active: false, activeColor: '#fff', onClick: () => {
                                    if (!user) { showToast('Log in to add tracks to a playlist', 'info'); return; }
                                    setPlaylistModalOpen(true);
                                } },
                            ].map((btn, i) => (
                                <button key={i} onClick={btn.onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: btn.active ? btn.activeColor : SUB, transition: 'all 0.15s' }}>
                                    {btn.icon} {btn.label}
                                </button>
                            ))}
                        </div>
                        {Array.isArray(track.battles) && track.battles.length > 0 && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {track.battles.map((b: any) => (
                                    <span key={b.entryId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 9999, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#F97316', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        <Swords size={10} /> {b.battleTitle}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {track.bpm && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 9999, background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}33`, fontSize: 11, fontWeight: 600, color: SECONDARY }}><Activity size={10} /> {track.bpm} BPM</span>}
                            {track.key && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 9999, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', fontSize: 11, fontWeight: 600, color: '#A78BFA' }}><Tag size={10} /> {track.key}</span>}
                            {track.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: SUB }}><Clock size={10} /> {fmtDur(track.duration)}</span>}
                            {(track.genres || []).map((g: any) => <span key={g.genre.id} style={{ padding: '3px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: SUB }}>{g.genre.name}</span>)}
                        </div>
                        {track.description && (
                            <div>
                                <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.7, overflow: 'hidden', maxHeight: descExpanded ? 'none' : 60, whiteSpace: 'pre-wrap' }}>{track.description}</p>
                                {track.description.length > 160 && (
                                    <button onClick={() => setDescExpanded(e => !e)} style={{ marginTop: 4, background: 'none', border: 'none', color: PRIMARY, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                                        {descExpanded ? 'Show less' : 'Read More'}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
    );

    // Lyrics
    const lyricsSection = (track.lyrics || track.lyricsSync?.length > 0) ? (
                        <section style={{ ...glass, borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
                            <button onClick={() => setLyricsExpanded(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: TEXT }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlignLeft size={14} color={PRIMARY} />
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>Lyrics</span>
                                    {track.lyricsSync?.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 9999, background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Synced</span>}
                                </div>
                                {lyricsExpanded ? <ChevronUp size={13} color={SUB} /> : <ChevronDown size={13} color={SUB} />}
                            </button>
                            {lyricsExpanded && (
                                <div style={{ padding: '0 18px 16px' }}>
                                    {track.lyricsSync?.length > 0 ? (
                                        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                                            {track.lyricsSync.map((cue: any, i: number) => (
                                                <div key={i} onClick={() => { if (isThis) seek(cue.time); else playTrack(); }}
                                                    style={{ padding: '5px 0', cursor: 'pointer', fontSize: activeLyricIdx === i ? 14 : 12, fontWeight: activeLyricIdx === i ? 700 : 400, color: activeLyricIdx === i ? PRIMARY : SUB, transition: 'all 0.2s', lineHeight: 1.5 }}>
                                                    {cue.text || <span style={{ opacity: 0.3 }}>♪</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <pre style={{ margin: 0, color: SUB, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 12 }}>{track.lyrics}</pre>
                                    )}
                                </div>
                            )}
                        </section>
    ) : null;

    const trackSide = (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {artistSection}
                    {actionsSection}
                    {lyricsSection}
                </div>
    );

    const railSections: RailSection[] = [
        { key: 'artist', label: 'Artist', icon: <User size={20} />, content: artistSection },
        { key: 'actions', label: 'Actions', icon: <Heart size={20} />, content: actionsSection },
        ...((track.lyrics || track.lyricsSync?.length > 0)
            ? [{ key: 'lyrics', label: 'Lyrics', icon: <FileText size={20} />, content: lyricsSection }]
            : []),
    ];

    return shell(
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px', boxSizing: 'border-box' }}>

                {/* ── RIGHT (1fr): media, waveform, stems, timeline, comments ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Album art / Music video */}
                    <section style={{ ...glass, borderRadius: 20, overflow: 'hidden', position: 'relative', aspectRatio: '16/9' }}>
                        {showVideo
                            ? <MemoYouTube videoId={youtubeId!} trackId={track.id} player={player} isPlaying={isPlaying} onToggle={togglePlayback} />
                            : <>
                                {track.coverUrl && <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,14,24,0.9) 0%, rgba(10,14,24,0.2) 60%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <button onClick={togglePlayback} style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}>
                                        {isPlaying ? <Pause size={40} fill="#fff" color="#fff" /> : <Play size={40} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />}
                                    </button>
                                </div>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 20px', pointerEvents: 'none' }}>
                                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{track.title}</h2>
                                    <p style={{ margin: '4px 0 0', color: PRIMARY, fontWeight: 700, fontSize: 13 }}>{(track.genres || []).map((g: any) => g.genre.name).join(' · ').toUpperCase() || 'OFFICIAL RELEASE'}</p>
                                </div>
                            </>
                        }
                    </section>

                    {/* Waveform — Master Channel with transport */}
                    <section style={{ ...glass, borderRadius: 20, padding: '20px 24px' }}>
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
                                    <button onClick={togglePlayback} style={{ width: 44, height: 44, borderRadius: '50%', background: PRIMARY, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 16px ${PRIMARY}55` }}>
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

                    {/* Mobile: track details + lyrics are inline in the main content here
                        (desktop/tablet show them in the right rail via topSlot instead) */}
                    {isMobile && actionsSection}
                    {isMobile && lyricsSection}

                    {/* Stems Mixer — hidden on mobile */}
                    {!isMobile && track.stems?.length > 0 && (
                        <section style={{ ...glass, borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
                            <StemsMixer stems={track.stems} trackTitle={track.title} masterDuration={track.duration} playerTrack={track} allowDownload={track.allowStemsDownload ?? true} compact />
                        </section>
                    )}

                    {/* 5. FL Project Timeline — hidden on mobile */}
                    {!isMobile && hasArrangement && (
                        <section style={{ ...glass, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(38,42,53,0.5)' }}>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>
                                    {track.arrangement?.fileType === 'als' ? 'Ableton' : 'FL Studio'} Project Timeline
                                </h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {track.projectFileUrl && track.allowProjectDownload !== false && <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: `${PRIMARY}15`, border: `1px solid ${PRIMARY}44`, color: PRIMARY, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}><Download size={11} /> {track.arrangement?.fileType === 'als' ? '.als' : '.flp'}</button>}
                                    {track.projectZipUrl && track.allowProjectDownload !== false && <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: SUB, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}><Package size={11} /> ZIP</button>}
                                </div>
                            </div>
                            {track.arrangement.tracks?.some((t: any) => t.clips.length > 0) && (
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}` }}>
                                    <MemoArrangement track={track} player={player} isPlaying={isPlaying} zoom={zoom} setZoom={setZoom} />
                                </div>
                            )}
                            {/* Matched plugins */}
                            {matchedPlugins.length > 0 && (
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}` }}>
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
                                    <button onClick={() => setPluginsSamplesOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', color: SUB, borderTop: `1px solid ${DIVIDER}` }}>
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
                    {/* overflow: visible (not hidden) — the GIF/emoji picker popups inside
                        CommentSection are absolutely positioned above the input and need to
                        escape this section's bounds, especially when there are few/no
                        comments and the section is short. */}
                    <section style={{ ...glass, overflow: 'visible', padding: '0 20px 20px' }}>
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
            </div>
        </div>,
        trackSide,
        railSections
    );
};
