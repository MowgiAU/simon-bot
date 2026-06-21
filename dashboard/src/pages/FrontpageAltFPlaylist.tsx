/**
 * Alt F — Playlist detail (/preview/alt_f_playlist?id=PLAYLIST_ID)
 * Full track list for a single playlist — public or owner's private.
 * API: GET /api/playlists/:playlistId
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { Play, Pause, ListMusic, Globe, Lock, Music, ChevronLeft, Shuffle } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const fmtDur = (s?: number | null) => { if (!s || !isFinite(s)) return '—'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const RELEASE_COLORS: Record<string, string> = { album: '#7C3AED', ep: SECONDARY, single: '#ff9f43' };

interface TrackProfile { userId: string; username: string; displayName: string | null; avatar: string | null }
interface Track {
    id: string; title: string; url: string | null; coverUrl: string | null;
    duration: number | null; playCount?: number; bpm?: number | null;
    profile: TrackProfile;
    genres?: { genre: { name: string } }[];
}
interface PlaylistTrack { position: number; track: Track }
interface Playlist {
    id: string; name: string; slug: string; description: string | null;
    isPublic: boolean; releaseType: string | null; coverUrl: string | null;
    trackCount: number; totalPlays: number; updatedAt: string; createdAt: string;
    tracks: PlaylistTrack[];
    profile?: { username: string; displayName: string | null; avatar: string | null; userId: string } | null;
    battle?: { id: string; title: string; slug: string; status: string } | null;
}

function MosaicHero({ playlist }: { playlist: Playlist }) {
    const covers = playlist.tracks.map(t => t.track.coverUrl).filter(Boolean).slice(0, 4) as string[];
    if (playlist.coverUrl) {
        return <img src={playlist.coverUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    if (covers.length === 0) {
        return (
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${PRIMARY}15, ${SECONDARY}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ListMusic size={64} color={`${SUB}60`} strokeWidth={1} />
            </div>
        );
    }
    if (covers.length < 4) {
        return <img src={covers[0]} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    return (
        <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {covers.slice(0, 4).map((src, i) => <img key={i} src={src} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
        </div>
    );
}

export const FrontpageAltFPlaylist: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const id = new URLSearchParams(window.location.search).get('id');

    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(false);
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);

    useEffect(() => {
        if (!id) { setError(true); setLoading(false); return; }
        axios.get(`/api/playlists/${id}`)
            .then(r => { setPlaylist(r.data); setLoading(false); })
            .catch(() => { setError(true); setLoading(false); });
    }, [id]);

    const playTrack = (t: Track) => {
        if (!t.url) return;
        if (player.currentTrack?.id === t.id) { togglePlay(); return; }
        const queue = (playlist?.tracks || [])
            .filter(pt => pt.track.url)
            .map(pt => ({
                id: pt.track.id,
                title: pt.track.title,
                artist: pt.track.profile.displayName || pt.track.profile.username,
                url: pt.track.url!,
                coverUrl: pt.track.coverUrl,
            }));
        const idx = queue.findIndex(q => q.id === t.id);
        setTrack(queue[idx] || queue[0], queue);
    };

    const playAll = () => {
        if (!playlist?.tracks.length) return;
        const first = playlist.tracks[0].track;
        playTrack(first);
    };

    const isPlaying = (id: string) => player.currentTrack?.id === id && player.isPlaying;

    const totalDuration = playlist?.tracks.reduce((s, pt) => s + (pt.track.duration || 0), 0) || 0;
    const totalMins = Math.round(totalDuration / 60);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="My Playlists" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'My Playlists', to: '/preview/alt_f_my_playlists' }, { label: playlist?.name || 'Playlist' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: SUB }}>Loading…</div>
                    )}

                    {error && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                            <ListMusic size={36} color={SUB} />
                            <div style={{ fontSize: 16, fontWeight: 600 }}>Playlist not found</div>
                            <Link to="/preview/alt_f_my_playlists" style={{ padding: '8px 20px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                                <ChevronLeft size={14} /> My Playlists
                            </Link>
                        </div>
                    )}

                    {playlist && (
                        <>
                            {/* HERO */}
                            <section style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                                {/* Background — blurred mosaic */}
                                <div style={{ position: 'absolute', inset: 0, filter: 'blur(40px) brightness(0.3) saturate(1.4)', transform: 'scale(1.2)' }}>
                                    <MosaicHero playlist={playlist} />
                                </div>
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,19,29,0.98) 0%, rgba(15,19,29,0.7) 55%, rgba(15,19,29,0.4) 100%)' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,0.9) 0%, transparent 50%)' }} />

                                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                                    <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', padding: '0 32px 36px', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-end', gap: 28 }}>

                                        {/* Cover art */}
                                        <div style={{ width: 160, height: 160, borderRadius: 16, overflow: 'hidden', flexShrink: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <MosaicHero playlist={playlist} />
                                        </div>

                                        {/* Metadata */}
                                        <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: PRIMARY }}>
                                                    {playlist.releaseType || 'Playlist'}
                                                </span>
                                                {playlist.releaseType && (
                                                    <span style={{ padding: '2px 8px', borderRadius: 4, background: `${RELEASE_COLORS[playlist.releaseType] || PRIMARY}20`, color: RELEASE_COLORS[playlist.releaseType] || PRIMARY, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                        {playlist.releaseType}
                                                    </span>
                                                )}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: playlist.isPublic ? SECONDARY : SUB }}>
                                                    {playlist.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                                                    {playlist.isPublic ? 'Public' : 'Private'}
                                                </span>
                                            </div>

                                            <h1 style={{ margin: '0 0 8px', fontSize: 38, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.1, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {playlist.name}
                                            </h1>

                                            {playlist.description && (
                                                <p style={{ margin: '0 0 10px', fontSize: 14, color: 'rgba(223,226,241,0.65)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {playlist.description}
                                                </p>
                                            )}

                                            {/* Creator + stats */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                                                {playlist.profile && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {playlist.profile.avatar
                                                            ? <img src={playlist.profile.avatar} referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                                                            : <div style={{ width: 22, height: 22, borderRadius: '50%', background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: SUB }}>{(playlist.profile.displayName || playlist.profile.username || 'U')[0]}</div>
                                                        }
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(223,226,241,0.8)' }}>
                                                            {playlist.profile.displayName || playlist.profile.username}
                                                        </span>
                                                    </div>
                                                )}
                                                <span style={{ fontSize: 13, color: SUB }}>{playlist.trackCount} tracks</span>
                                                {totalMins > 0 && <span style={{ fontSize: 13, color: SUB }}>{totalMins} min</span>}
                                                {playlist.totalPlays > 0 && <span style={{ fontSize: 13, color: SUB }}>{fmtNum(playlist.totalPlays)} plays</span>}
                                                <span style={{ fontSize: 13, color: SUB }}>{fmtDate(playlist.updatedAt)}</span>
                                            </div>

                                            {/* Action buttons */}
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <button
                                                    onClick={playAll}
                                                    disabled={!playlist.tracks.some(pt => pt.track.url)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: PRIMARY, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: `0 4px 20px ${PRIMARY}50` }}
                                                >
                                                    <Play size={16} fill="#fff" /> Play All
                                                </button>
                                                <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(28,31,42,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 12, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 14 }}>
                                                    <Shuffle size={15} /> Shuffle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* TRACK LIST */}
                            <div style={{ maxWidth: 1280, margin: '28px auto 0', padding: '0 32px 40px', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tracks</h2>
                                    <span style={{ fontSize: 13, color: SUB }}>{playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}</span>
                                </div>

                                {playlist.tracks.length === 0 ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                        <Music size={36} color={SUB} style={{ marginBottom: 14 }} />
                                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No tracks yet</div>
                                        <div style={{ fontSize: 13, color: SUB }}>Add tracks to this playlist from any track page.</div>
                                    </div>
                                ) : (
                                    <div style={{ ...glass, borderRadius: 20, overflowX: 'auto' }}>
                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '40px 44px 1fr 120px 52px 60px', gap: 0, padding: '10px 20px', background: 'rgba(38,42,53,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SUB, borderBottom: `1px solid ${DIVIDER}`, alignItems: 'center' }}>
                                            <div style={{ textAlign: 'center' }}>#</div>
                                            <div />
                                            <div>Title</div>
                                            <div>Genre</div>
                                            <div style={{ textAlign: 'center' }}>BPM</div>
                                            <div style={{ textAlign: 'right' }}>Time</div>
                                        </div>

                                        {playlist.tracks.map((pt, i) => {
                                            const t = pt.track;
                                            const playing = isPlaying(t.id);
                                            const hovered = hoveredRow === t.id;
                                            const isLast = i === playlist.tracks.length - 1;
                                            const genre = t.genres?.[0]?.genre?.name;
                                            const artistName = t.profile.displayName || t.profile.username;

                                            return (
                                                <div
                                                    key={t.id}
                                                    onMouseEnter={() => setHoveredRow(t.id)}
                                                    onMouseLeave={() => setHoveredRow(null)}
                                                    onClick={() => playTrack(t)}
                                                    style={{ display: 'grid', gridTemplateColumns: '40px 44px 1fr 120px 52px 60px', gap: 0, padding: '10px 20px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`, alignItems: 'center', cursor: t.url ? 'pointer' : 'default', background: playing ? `${PRIMARY}08` : hovered ? 'rgba(38,42,53,0.35)' : 'transparent', transition: 'background 0.1s' }}
                                                >
                                                    {/* Position / play icon */}
                                                    <div style={{ textAlign: 'center', width: 20, margin: '0 auto' }}>
                                                        {hovered && t.url ? (
                                                            <button onClick={e => { e.stopPropagation(); playTrack(t); }} style={{ width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                                {playing ? <Pause size={14} color={PRIMARY} fill={PRIMARY} /> : <Play size={14} color={TEXT} fill={TEXT} />}
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: 13, color: playing ? PRIMARY : SUB, fontWeight: playing ? 700 : 400 }}>{pt.position}</span>
                                                        )}
                                                    </div>

                                                    {/* Cover */}
                                                    <div>
                                                        {t.coverUrl
                                                            ? <img src={t.coverUrl} referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                                                            : <div style={{ width: 36, height: 36, borderRadius: 6, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={SUB} /></div>
                                                        }
                                                    </div>

                                                    {/* Title + artist */}
                                                    <div style={{ minWidth: 0, paddingRight: 12 }}>
                                                        <div style={{ fontSize: 14, fontWeight: playing ? 700 : 600, color: playing ? PRIMARY : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{t.title}</div>
                                                        <div style={{ fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artistName}</div>
                                                    </div>

                                                    {/* Genre */}
                                                    <div>
                                                        {genre && (
                                                            <span style={{ padding: '3px 8px', borderRadius: 4, background: `${SECONDARY}15`, border: `1px solid ${SECONDARY}30`, fontSize: 11, color: SECONDARY, fontWeight: 600, whiteSpace: 'nowrap' }}>{genre}</span>
                                                        )}
                                                    </div>

                                                    {/* BPM */}
                                                    <div style={{ textAlign: 'center', fontSize: 12, color: t.bpm ? TEXT : SUB, fontWeight: t.bpm ? 600 : 400 }}>
                                                        {t.bpm || '—'}
                                                    </div>

                                                    {/* Duration */}
                                                    <div style={{ textAlign: 'right', fontSize: 12, color: SUB, fontVariantNumeric: 'tabular-nums' }}>
                                                        {fmtDur(t.duration)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Battle link */}
                                {playlist.battle && (
                                    <div style={{ ...glass, borderRadius: 16, padding: '16px 20px', marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TERTIARY, flexShrink: 0 }}>Battle</div>
                                        <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{playlist.battle.title}</div>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, background: `${SECONDARY}15`, color: SECONDARY, fontWeight: 700 }}>{playlist.battle.status}</span>
                                        <Link to="/preview/alt_f_battle" style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 14px', color: SUB, fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>View Battle</Link>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
