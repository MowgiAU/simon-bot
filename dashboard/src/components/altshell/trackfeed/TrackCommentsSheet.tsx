/**
 * Comments for the track on screen. Posting captures the current playhead as
 * `trackTimestamp`, so feed comments stay timed the same way track-page ones are.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Send, MessageCircle, Clock } from 'lucide-react';
import { PRIMARY, SUB, TEXT, S_CONT, S_HIGH, BORDER, FONT } from '../AltSidebar';
import { AltSpinner } from '../AltSpinner';
import { BottomSheet } from './BottomSheet';
import { FeedTrack, fmtTime, timeAgo } from './types';
import { useAuth } from '../../AuthProvider';

interface Props {
    track: FeedTrack;
    open: boolean;
    onClose: () => void;
    /** Live playhead, captured on the comment being written. */
    currentTime: number;
    onSeek: (seconds: number) => void;
    onPosted: () => void;
}

export const TrackCommentsSheet: React.FC<Props> = ({ track, open, onClose, currentTime, onSeek, onPosted }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState('');
    const [posting, setPosting] = useState(false);
    const [err, setErr] = useState('');
    const stampRef = useRef(0);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setErr('');
        axios.get('/api/comments', { params: { trackId: track.id, limit: 50 }, withCredentials: true })
            .then(r => setComments(r.data?.comments || []))
            .catch(() => setComments([]))
            .finally(() => setLoading(false));
    }, [open, track.id]);

    // Freeze the timestamp when the user starts typing, not when they hit send —
    // otherwise the comment lands wherever the track drifted to while typing.
    const onChange = (v: string) => {
        if (!text && v) stampRef.current = currentTime;
        setText(v);
    };

    const submit = async () => {
        if (!text.trim() || posting) return;
        setPosting(true);
        setErr('');
        try {
            const r = await axios.post('/api/comments', {
                content: text.trim(),
                trackId: track.id,
                trackTimestamp: Math.floor(stampRef.current),
            }, { withCredentials: true });
            setComments(prev => [{ ...r.data, likeCount: 0, dislikeCount: 0, replies: [] }, ...prev]);
            setText('');
            onPosted();
        } catch (e: any) {
            setErr(e.response?.data?.error || 'Could not post that comment');
        } finally {
            setPosting(false);
        }
    };

    const footer = user ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: 1 }}>
                {text && (
                    <div style={{ fontSize: 10.5, color: SUB, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> posting at {fmtTime(stampRef.current)}
                    </div>
                )}
                <input
                    value={text}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    placeholder="Add a comment…"
                    maxLength={500}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9999, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none' }}
                />
            </div>
            <button onClick={submit} disabled={posting || !text.trim()} aria-label="Post comment"
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (posting || !text.trim()) ? 'not-allowed' : 'pointer', opacity: (posting || !text.trim()) ? 0.5 : 1, flexShrink: 0 }}>
                <Send size={16} />
            </button>
        </div>
    ) : (
        <Link to="/login" style={{ display: 'block', textAlign: 'center', padding: '10px 0', color: PRIMARY, fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
            Log in to comment
        </Link>
    );

    return (
        <BottomSheet open={open} onClose={onClose} height="72vh" footer={footer}
            title={`${track.commentCount} ${track.commentCount === 1 ? 'comment' : 'comments'}`}>
            {err && <div style={{ color: '#EF4444', fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
            {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}><AltSpinner /></div>
            ) : comments.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: SUB }}>
                    <MessageCircle size={30} style={{ marginBottom: 10, opacity: 0.5 }} />
                    <div style={{ fontSize: 13.5 }}>No comments yet — say something.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
                    {comments.filter(c => !c.deletedAt && !c.hiddenAt).map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                {c.avatarUrl
                                    ? <img src={c.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: TEXT }}>{c.username?.[0]?.toUpperCase()}</div>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>{c.username}</span>
                                    <span style={{ fontSize: 10.5, color: SUB }}>{timeAgo(c.createdAt)}</span>
                                    {c.trackTimestamp != null && (
                                        <button onClick={() => onSeek(c.trackTimestamp)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 9999, background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`, color: PRIMARY, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                                            <Clock size={9} /> {fmtTime(c.trackTimestamp)}
                                        </button>
                                    )}
                                </div>
                                <div style={{ fontSize: 13.5, color: 'rgba(223,226,241,0.9)', lineHeight: 1.5, marginTop: 2, wordBreak: 'break-word' }}>{c.content}</div>
                                {c.gifUrl && <img src={c.gifUrl} alt="" style={{ maxWidth: '70%', borderRadius: 10, marginTop: 6, display: 'block' }} />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </BottomSheet>
    );
};
