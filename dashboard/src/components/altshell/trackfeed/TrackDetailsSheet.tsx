/**
 * Everything the mobile track page shows, one swipe up from the feed:
 * artist, stats, full description, metadata, lyrics (synced when available),
 * downloads, license, video and the artist's other tracks.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
    Activity, AlignLeft, ExternalLink, Music, Package, Download, Youtube,
    UserPlus, UserCheck, Play, Heart, Repeat2, Scale, Clock,
} from 'lucide-react';
import { PRIMARY, SECONDARY, SUB, TEXT, S_CONT, S_HIGH, BORDER, FONT } from '../AltSidebar';
import { BottomSheet } from './BottomSheet';
import { useAuth } from '../../AuthProvider';
import {
    FeedTrack, artistName, fmtNum, fmtTime, genreAccent, trackHref, LICENSE_LABELS,
} from './types';

interface Props {
    track: FeedTrack;
    open: boolean;
    onClose: () => void;
    currentTime: number;
    onSeek: (seconds: number) => void;
    onFollow: () => void;
    onPlayTrack: (t: FeedTrack) => void;
}

export const TrackDetailsSheet: React.FC<Props> = ({ track, open, onClose, currentTime, onSeek, onFollow, onPlayTrack }) => {
    const { user } = useAuth();
    const [more, setMore] = useState<FeedTrack[]>([]);

    useEffect(() => {
        if (!open || !track.profile?.username) return;
        axios.get('/api/tracks/feed', { params: { artist: track.profile.username, limit: 8 } })
            .then(r => setMore((r.data?.tracks || []).filter((t: FeedTrack) => t.id !== track.id).slice(0, 6)))
            .catch(() => setMore([]));
    }, [open, track.profile?.username, track.id]);

    const sync = Array.isArray(track.lyricsSync) ? track.lyricsSync : [];
    const activeLyric = sync.length
        ? sync.reduce((acc, cue, i) => (currentTime >= cue.time ? i : acc), -1)
        : -1;

    const href = trackHref(track);

    return (
        <BottomSheet open={open} onClose={onClose} height="88vh" title="Track details">
            {/* Header */}
            <div style={{ display: 'flex', gap: 13, paddingTop: 4 }}>
                <div style={{ width: 84, height: 84, borderRadius: 12, overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                    {track.coverUrl
                        ? <img src={track.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={26} color={SUB} /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.25 }}>{track.title}</h2>
                    <Link to={`/profile/${track.profile?.username}`} style={{ display: 'block', fontSize: 13, color: SUB, textDecoration: 'none', marginTop: 3 }}>
                        {artistName(track)}
                    </Link>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: SUB }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={10} /> {fmtNum(track.playCount)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={10} /> {fmtNum(track.likeCount)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Repeat2 size={10} /> {fmtNum(track.repostCount)}</span>
                    </div>
                </div>
            </div>

            <button onClick={onFollow}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, border: track.following ? `1px solid ${PRIMARY}` : 'none', background: track.following ? 'transparent' : PRIMARY, color: track.following ? PRIMARY : '#fff' }}>
                {track.following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                {track.following ? 'Following' : `Follow ${track.profile?.username}`}
            </button>

            {/* Metadata */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                {(track.genres || []).map(g => (
                    <Link key={g.id} to={`/genres/${g.slug}`}
                        style={{ padding: '3px 10px', borderRadius: 9999, background: `${genreAccent(g.name)}1f`, border: `1px solid ${genreAccent(g.name)}44`, color: genreAccent(g.name), fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                        {g.name}
                    </Link>
                ))}
                {track.bpm ? <Meta icon={<Activity size={10} />} color={SECONDARY}>{track.bpm} BPM</Meta> : null}
                {track.key ? <Meta color="#A78BFA">{track.key}</Meta> : null}
                {track.duration ? <Meta icon={<Clock size={10} />}>{fmtTime(track.duration)}</Meta> : null}
                <Meta icon={<Scale size={10} />}>{LICENSE_LABELS[track.license || ''] || 'All rights reserved'}</Meta>
            </div>

            {track.description && (
                <p style={{ margin: '14px 0 0', fontSize: 13, color: 'rgba(223,226,241,0.82)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {track.description}
                </p>
            )}

            {/* Lyrics */}
            {(sync.length > 0 || track.lyrics) && (
                <Section icon={<AlignLeft size={13} color={PRIMARY} />} title="Lyrics"
                    badge={sync.length > 0 ? 'Synced' : undefined}>
                    {sync.length > 0 ? (
                        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {sync.map((cue, i) => (
                                <div key={i} onClick={() => onSeek(cue.time)}
                                    style={{ padding: '5px 0', cursor: 'pointer', fontSize: i === activeLyric ? 15 : 13, fontWeight: i === activeLyric ? 700 : 400, color: i === activeLyric ? PRIMARY : SUB, transition: 'all 0.2s', lineHeight: 1.5 }}>
                                    {cue.text || <span style={{ opacity: 0.3 }}>♪</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <pre style={{ margin: 0, color: SUB, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 12.5 }}>{track.lyrics}</pre>
                    )}
                </Section>
            )}

            {/* Downloads + links */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                {track.allowAudioDownload !== false && (
                    <a href={track.mp3Url || track.url} download={`${track.title}.mp3`} style={linkBtn}>
                        <Download size={13} /> Audio
                    </a>
                )}
                {track.projectZipUrl && track.allowProjectDownload !== false && (
                    <a href={user ? `/api/tracks/${track.id}/download-zip` : '/login'}
                        {...(user ? { download: `${track.title || 'project'}_project.zip` } : {})} style={linkBtn}>
                        <Package size={13} /> Project files
                    </a>
                )}
                {track.youtubeUrl && (
                    <a href={track.youtubeUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                        <Youtube size={13} /> Video
                    </a>
                )}
                {href && (
                    <Link to={href} style={linkBtn}>
                        <ExternalLink size={13} /> Full track page
                    </Link>
                )}
            </div>

            {/* More from this artist */}
            {more.length > 0 && (
                <Section title={`More from ${track.profile?.username}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {more.map(t => (
                            <button key={t.id} onClick={() => { onPlayTrack(t); onClose(); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, background: S_CONT, border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: FONT, textAlign: 'left', width: '100%' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 7, overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                    {t.coverUrl
                                        ? <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={15} color={SUB} /></div>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                    <div style={{ fontSize: 11, color: SUB, marginTop: 1 }}>{fmtNum(t.playCount)} plays · {fmtTime(t.duration)}</div>
                                </div>
                                <Play size={15} color={PRIMARY} />
                            </button>
                        ))}
                    </div>
                </Section>
            )}
        </BottomSheet>
    );
};

const linkBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
    border: `1px solid ${BORDER}`, background: S_CONT, color: TEXT,
    fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: FONT,
};

const Meta: React.FC<{ icon?: React.ReactNode; color?: string; children: React.ReactNode }> = ({ icon, color, children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 600, color: color || SUB }}>
        {icon}{children}
    </span>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; badge?: string; children: React.ReactNode }> = ({ title, icon, badge, children }) => (
    <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            {icon}
            <span style={{ fontSize: 12, fontWeight: 800, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
            {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 9999, background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{badge}</span>}
        </div>
        {children}
    </div>
);
