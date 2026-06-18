/**
 * Alt F — Track detail page (/preview/alt_f_track)
 * Loads the #1 weekly chart track and renders the full studio player view.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { CommentSection } from '../components/CommentSection';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { Play, Pause, Heart, Repeat2, Share2, ListPlus, MoreHorizontal, UserPlus, UserCheck, MessageCircle, ChevronDown, ChevronUp, Music } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useChat } from '../components/ChatProvider';

const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
function bars(seed: string, n = 120) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }

export const FrontpageAltFTrack: React.FC = () => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const { user } = useAuth();
    const { startConversation } = useChat();

    const [track, setTrackData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [reposted, setReposted] = useState(false);
    const [repostCount, setRepostCount] = useState(0);
    const [following, setFollowing] = useState(false);
    const [startingMsg, setStartingMsg] = useState(false);

    useEffect(() => {
        axios.get('/api/charts/weekly').then(r => {
            const data = r.data;
            const entries = Array.isArray(data) ? data[0]?.entries : data?.entries;
            const t = entries?.[0]?.track;
            if (t) {
                setTrackData(t);
                setLikeCount(t.likeCount || 0);
                setRepostCount(t.repostCount || 0);
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    // Follow state
    useEffect(() => {
        if (!track?.profile?.userId) return;
        axios.get(`/api/artists/${track.profile.userId}/follow`).then(r => setFollowing(r.data.following)).catch(() => {});
    }, [track]);

    const isPlaying = player.currentTrack?.id === track?.id;
    const wavebarCount = 120;
    const waveH = track ? bars(track.id || track.title, wavebarCount) : [];
    const progress = isPlaying ? (player.currentTime / (player.duration || 1)) : 0;

    const play = () => {
        if (!track) return;
        setTrack({ id: track.id, title: track.title, artist: track.profile?.displayName || track.profile?.username, cover: track.coverUrl, url: track.url, profile: track.profile }, []);
    };
    const toggleFollow = () => {
        if (!track?.profile?.userId) return;
        setFollowing(f => !f);
        axios.post(`/api/artists/${track.profile.userId}/follow`).catch(() => {});
    };
    const toggleLike = () => {
        setLiked(l => !l);
        setLikeCount(n => liked ? n - 1 : n + 1);
        if (track?.id) axios.post(`/api/tracks/${track.id}/like`).catch(() => {});
    };
    const handleRepost = () => {
        setReposted(r => !r);
        setRepostCount(n => reposted ? n - 1 : n + 1);
        if (track?.id) axios.post(`/api/tracks/${track.id}/repost`).catch(() => {});
    };
    const msgArtist = async () => {
        if (!track?.profile?.userId || startingMsg) return;
        setStartingMsg(true);
        try { await startConversation(track.profile.userId); } finally { setStartingMsg(false); }
    };

    const glass: React.CSSProperties = { background: 'rgba(23,27,38,0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${BORDER}` };

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Tracks" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Tracks' }, { label: track?.title || '…' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {loading ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>
                    ) : !track ? (
                        <div style={{ padding: 80, textAlign: 'center', color: SUB }}>No track found.</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0, height: '100%' }}>
                            {/* Left column */}
                            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, borderRight: `1px solid ${BORDER}` }}>
                                {/* Artist mini-card */}
                                <div style={{ ...glass, borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <Link to={`/profile/${track.profile?.username}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                                        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: `2px solid ${PRIMARY}44` }}>
                                            {track.profile?.avatar
                                                ? <img src={track.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={24} color={SUB} /></div>}
                                        </div>
                                    </Link>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Link to={`/profile/${track.profile?.username}`} style={{ color: TEXT, textDecoration: 'none', fontWeight: 800, fontSize: 16 }}>
                                            {track.profile?.displayName || track.profile?.username}
                                        </Link>
                                        <div style={{ display: 'flex', gap: 20, marginTop: 4, color: SUB, fontSize: 12 }}>
                                            <span><strong style={{ color: TEXT }}>{fmtNum(track.profile?.followerCount)}</strong> Followers</span>
                                            <span><strong style={{ color: TEXT }}>{fmtNum(track.profile?.totalPlays)}</strong> Plays</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={toggleFollow} style={{ padding: '8px 16px', borderRadius: 9999, border: following ? `1px solid ${PRIMARY}` : 'none', background: following ? 'transparent' : PRIMARY, color: following ? PRIMARY : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {following ? <><UserCheck size={16} />Following</> : <><UserPlus size={16} />Follow</>}
                                        </button>
                                        <button onClick={msgArtist} style={{ width: 36, height: 36, borderRadius: '50%', background: S_CONT, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SECONDARY, cursor: 'pointer' }}>
                                            <MessageCircle size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Cover / video placeholder */}
                                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '16/9', background: S_HIGH, cursor: 'pointer' }} onClick={() => isPlaying ? togglePlay() : play()}>
                                    {track.coverUrl
                                        ? <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, #1a1220, #0f1a2e)` }}><Music size={64} color={SUB} /></div>}
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,14,24,0.8) 0%, transparent 50%)' }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isPlaying ? <Pause size={40} fill="#fff" color="#fff" /> : <Play size={40} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />}
                                        </div>
                                    </div>
                                    <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
                                        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{track.title}</h2>
                                        <p style={{ margin: '4px 0 0', color: PRIMARY, fontWeight: 700, fontSize: 14 }}>#{track.genre || 'Music'}</p>
                                    </div>
                                </div>

                                {/* Action bar */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[
                                        { icon: <Heart size={18} />, label: fmtNum(likeCount), active: liked, color: TERTIARY, onClick: toggleLike },
                                        { icon: <Repeat2 size={18} />, label: fmtNum(repostCount), active: reposted, color: SECONDARY, onClick: handleRepost },
                                        { icon: <Share2 size={18} />, label: 'Share', active: false, color: TEXT, onClick: () => {} },
                                        { icon: <ListPlus size={18} />, label: 'Add to Playlist', active: false, color: TEXT, onClick: () => {} },
                                    ].map((b, i) => (
                                        <button key={i} onClick={b.onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: b.active ? `${b.color}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${b.active ? b.color + '55' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: b.active ? b.color : SUB, cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s' }}>
                                            {b.icon} {b.label}
                                        </button>
                                    ))}
                                    <button style={{ marginLeft: 'auto', padding: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: SUB, cursor: 'pointer' }}><MoreHorizontal size={18} /></button>
                                </div>

                                {/* Description */}
                                {track.description && (
                                    <div style={{ ...glass, borderRadius: 12, padding: 16 }}>
                                        <p style={{ margin: 0, color: SUB, fontSize: 14, lineHeight: 1.7, overflow: 'hidden', maxHeight: expanded ? 'none' : 72 }}>{track.description}</p>
                                        {track.description.length > 200 && (
                                            <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 8, background: 'none', border: 'none', color: PRIMARY, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read more</>}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Waveform player */}
                                <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div>
                                            <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Master Channel</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{track.title}</span>
                                                {track.bpm && <span style={{ padding: '2px 8px', background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}33`, borderRadius: 6, color: SECONDARY, fontSize: 10, fontWeight: 700 }}>{track.bpm} BPM</span>}
                                                {track.key && <span style={{ padding: '2px 8px', background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}33`, borderRadius: 6, color: PRIMARY, fontSize: 10, fontWeight: 700 }}>{track.key}</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 12, fontFamily: 'monospace', color: SECONDARY }}>
                                                {isPlaying ? `${Math.floor(player.currentTime / 60)}:${String(Math.floor(player.currentTime % 60)).padStart(2, '0')}` : '0:00'}
                                                {' / '}
                                                {isPlaying && player.duration ? `${Math.floor(player.duration / 60)}:${String(Math.floor(player.duration % 60)).padStart(2, '0')}` : '—'}
                                            </span>
                                            <button onClick={() => isPlaying ? togglePlay() : play()} style={{ width: 48, height: 48, borderRadius: '50%', background: PRIMARY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 20px ${PRIMARY}66` }}>
                                                {isPlaying ? <Pause size={20} fill="#fff" color="#fff" /> : <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ height: 80, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const pct = (e.clientX - rect.left) / rect.width;
                                        if (player.duration) seek(pct * player.duration);
                                    }}>
                                        {waveH.map((h, i) => (
                                            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 9999, background: i / wavebarCount < progress ? PRIMARY : 'rgba(255,255,255,0.1)', transition: 'background 0.05s' }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right column: Comments */}
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Comments</h3>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    <CommentSection trackId={track.id} isCurrentTrack={isPlaying} currentTrackTime={player.currentTime} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
