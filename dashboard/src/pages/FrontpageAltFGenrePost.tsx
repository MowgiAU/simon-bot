/**
 * Alt F — Genre Post Detail (/preview/alt_f_genre_post/:postId)
 * Full post view with voting, comments, and track player.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import {
    ChevronUp, ChevronDown, MessageCircle, Music, Play, Pause, FileText,
    ChevronLeft, Send, ThumbsUp, ThumbsDown,
} from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};

const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return '—'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(d).toLocaleDateString();
};

function genreAccent(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

export const FrontpageAltFGenrePost: React.FC = () => {
    const postId = window.location.pathname.split('/').pop() || '';
    const { player, setTrack, togglePlay } = usePlayer();

    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState<any[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentSort, setCommentSort] = useState<'best' | 'new' | 'old'>('best');
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

    useEffect(() => {
        if (!postId) return;
        setLoading(true);
        axios.get(`/api/genre-posts/${postId}`).then(r => {
            setPost(r.data);
            setLoading(false);
        }).catch(() => setLoading(false));

        setCommentsLoading(true);
        axios.get('/api/comments', { params: { genrePostId: postId } }).then(r => {
            setComments(arr(r.data.comments));
            setCommentsLoading(false);
        }).catch(() => setCommentsLoading(false));
    }, [postId]);

    const handleVote = async (type: 'up' | 'down') => {
        if (!post) return;
        try {
            const r = await axios.post(`/api/genre-posts/${post.id}/vote`, { type }, { withCredentials: true });
            setPost((p: any) => ({ ...p, score: r.data.score, upvotes: r.data.upvotes, downvotes: r.data.downvotes, userVote: r.data.userVote }));
        } catch {}
    };

    const handleCommentLike = async (commentId: string, type: 'like' | 'dislike') => {
        try {
            await axios.post(`/api/comments/${commentId}/react`, { type }, { withCredentials: true });
            setComments(prev => prev.map(c => {
                if (c.id === commentId) {
                    const already = c.userVote === type;
                    const likeCount = type === 'like' ? (already ? c.likeCount - 1 : c.likeCount + 1) : c.likeCount - (c.userVote === 'like' ? 1 : 0);
                    const dislikeCount = type === 'dislike' ? (already ? c.dislikeCount - 1 : c.dislikeCount + 1) : c.dislikeCount - (c.userVote === 'dislike' ? 1 : 0);
                    return { ...c, userVote: already ? null : type, likeCount: Math.max(0, likeCount), dislikeCount: Math.max(0, dislikeCount) };
                }
                return c;
            }));
        } catch {}
    };

    const submitComment = async () => {
        if (!commentText.trim() || !post) return;
        setSubmitting(true);
        try {
            const body: any = { content: commentText, genrePostId: post.id };
            if (replyTo) body.parentId = replyTo.id;
            const r = await axios.post('/api/comments', body, { withCredentials: true });
            const newComment = { ...r.data, likes: [], likeCount: 0, dislikeCount: 0, userVote: null, replies: [] };
            if (replyTo) {
                setComments(prev => prev.map(c => c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), newComment] } : c));
            } else {
                setComments(prev => [newComment, ...prev]);
            }
            setCommentText('');
            setReplyTo(null);
            setPost((p: any) => p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p);
        } catch {}
        finally { setSubmitting(false); }
    };

    const sortedComments = [...comments].sort((a, b) => {
        if (commentSort === 'best') return (b.likeCount - b.dislikeCount) - (a.likeCount - a.dislikeCount);
        if (commentSort === 'new') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const isPlaying = post?.track && player.currentTrack?.id === post.track.id && player.isPlaying;

    const playTrack = () => {
        if (!post?.track?.url) return;
        if (player.currentTrack?.id === post.track.id) { togglePlay(); return; }
        const artist = post.track.profile?.displayName || post.track.profile?.username || post.username;
        setTrack({ id: post.track.id, title: post.track.title, artist, url: post.track.url, coverUrl: post.track.coverUrl || undefined }, []);
    };

    const pb = player.currentTrack ? 90 : 0;

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Loading…</main>
        </div>
    );

    if (!post) return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Post not found.</main>
        </div>
    );

    const accent = post.genre ? genreAccent(post.genre.name) : PRIMARY;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[
                    { label: 'Genres', to: '/preview/alt_f_genres' },
                    ...(post.genre ? [{ label: post.genre.name, to: '/preview/alt_f_genres' }] : []),
                    { label: post.title.length > 40 ? post.title.slice(0, 40) + '…' : post.title },
                ]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: pb }}>
                        <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 24px 60px', boxSizing: 'border-box' }}>

                            {/* Post card */}
                            <div style={{ ...glass, borderRadius: 18, padding: '24px 28px', marginBottom: 24 }}>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    {/* Vote column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 44, paddingTop: 2 }}>
                                        <button onClick={() => handleVote('up')}
                                            style={{ background: post.userVote === 'up' ? `${PRIMARY}18` : 'none', border: `1px solid ${post.userVote === 'up' ? PRIMARY : BORDER}`, borderRadius: 8, cursor: 'pointer', color: post.userVote === 'up' ? PRIMARY : SUB, padding: '6px 8px', display: 'flex', transition: 'all 0.15s' }}>
                                            <ChevronUp size={20} />
                                        </button>
                                        <span style={{ fontSize: 18, fontWeight: 900, color: post.score > 0 ? PRIMARY : post.score < 0 ? TERTIARY : SUB }}>{post.score}</span>
                                        <button onClick={() => handleVote('down')}
                                            style={{ background: post.userVote === 'down' ? `${TERTIARY}18` : 'none', border: `1px solid ${post.userVote === 'down' ? TERTIARY : BORDER}`, borderRadius: 8, cursor: 'pointer', color: post.userVote === 'down' ? TERTIARY : SUB, padding: '6px 8px', display: 'flex', transition: 'all 0.15s' }}>
                                            <ChevronDown size={20} />
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Genre pill + meta */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: SUB }}>
                                            {post.genre && (
                                                <span style={{ background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, padding: '2px 9px', borderRadius: 9999, fontWeight: 700, fontSize: 11 }}>
                                                    {post.genre.name}
                                                </span>
                                            )}
                                            <span>Posted by <strong style={{ color: TEXT }}>{post.username}</strong></span>
                                            <span>·</span>
                                            <span>{timeAgo(post.createdAt)}</span>
                                        </div>

                                        {/* Title */}
                                        <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 900, color: TEXT, lineHeight: 1.3 }}>
                                            {post.type === 'track' && <Music size={18} color={PRIMARY} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
                                            {post.type === 'discussion' && <FileText size={18} color={SECONDARY} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
                                            {post.title}
                                        </h1>

                                        {/* Track player */}
                                        {post.type === 'track' && post.track && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: S_CONT, borderRadius: 14, padding: '14px 18px', marginBottom: 14, border: `1px solid ${BORDER}` }}>
                                                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: S_HIGH, position: 'relative', cursor: post.track.url ? 'pointer' : 'default' }} onClick={playTrack}>
                                                    {post.track.coverUrl
                                                        ? <img src={post.track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={22} color={SUB} /></div>
                                                    }
                                                    {post.track.url && (
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {isPlaying ? <Pause size={20} color="#fff" fill="#fff" /> : <Play size={20} color="#fff" fill="#fff" />}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.track.title}</div>
                                                    {post.track.profile && (
                                                        <div style={{ fontSize: 13, color: SUB, marginTop: 2 }}>by {post.track.profile.displayName || post.track.profile.username}</div>
                                                    )}
                                                    {post.track.duration && (
                                                        <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{fmtDur(post.track.duration)}</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Discussion body */}
                                        {post.type === 'discussion' && post.body && (
                                            <div style={{ fontSize: 15, color: TEXT, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{post.body}</div>
                                        )}

                                        {/* Discussion image */}
                                        {post.type === 'discussion' && post.imageUrl && (
                                            <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 14, display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                                        )}

                                        {/* Footer stats */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: SUB, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MessageCircle size={13} /> {post.commentCount} comments</span>
                                            <span>{post.upvotes} upvotes · {post.downvotes} downvotes</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comment box */}
                            <div style={{ ...glass, borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
                                {replyTo && (
                                    <div style={{ fontSize: 12, color: SECONDARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        Replying to <strong>{replyTo.username}</strong>
                                        <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>× Cancel</button>
                                    </div>
                                )}
                                <textarea
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    placeholder={replyTo ? `Reply to ${replyTo.username}…` : 'Share your thoughts…'}
                                    rows={3}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical', marginBottom: 10 }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={submitComment} disabled={submitting || !commentText.trim()}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: (submitting || !commentText.trim()) ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, opacity: (submitting || !commentText.trim()) ? 0.5 : 1 }}>
                                        <Send size={13} /> {submitting ? 'Posting…' : 'Comment'}
                                    </button>
                                </div>
                            </div>

                            {/* Comments */}
                            <div>
                                {/* Sort tabs */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                    <span style={{ fontSize: 12, color: SUB, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Sort:</span>
                                    {(['best', 'new', 'old'] as const).map(s => (
                                        <button key={s} onClick={() => setCommentSort(s)}
                                            style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${commentSort === s ? PRIMARY : BORDER}`, background: commentSort === s ? `${PRIMARY}18` : 'none', color: commentSort === s ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                    <span style={{ fontSize: 12, color: SUB, marginLeft: 8 }}>{comments.length} comments</span>
                                </div>

                                {commentsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: SUB, fontSize: 14 }}>Loading comments…</div>
                                ) : sortedComments.length === 0 ? (
                                    <div style={{ ...glass, borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
                                        <MessageCircle size={28} color={SUB} style={{ marginBottom: 10 }} />
                                        <div style={{ fontSize: 14, color: SUB }}>No comments yet. Be the first!</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {sortedComments.map(c => (
                                            <CommentCard key={c.id} comment={c} onLike={handleCommentLike} onReply={r => setReplyTo(r)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};

// ── CommentCard ────────────────────────────────────────────────────────────────
const CommentCard: React.FC<{
    comment: any;
    onLike: (id: string, type: 'like' | 'dislike') => void;
    onReply: (r: { id: string; username: string }) => void;
    isReply?: boolean;
}> = ({ comment, onLike, onReply, isReply }) => {
    const [showReplies, setShowReplies] = useState(true);
    if (comment.deletedAt) return null;

    const score = (comment.likeCount || 0) - (comment.dislikeCount || 0);

    return (
        <div style={{ paddingLeft: isReply ? 20 : 0 }}>
            <div style={{ background: isReply ? 'rgba(28,31,42,0.5)' : 'rgba(15,19,29,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                        {comment.avatarUrl && <img src={comment.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{comment.username}</span>
                    <span style={{ fontSize: 11, color: SUB }}>·</span>
                    <span style={{ fontSize: 11, color: SUB }}>{timeAgo(comment.createdAt)}</span>
                </div>

                {/* Content */}
                <p style={{ margin: '0 0 10px', fontSize: 14, color: TEXT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{comment.content}</p>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <button onClick={() => onLike(comment.id, 'like')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: comment.userVote === 'like' ? SECONDARY : SUB, padding: 0, fontFamily: FONT, fontSize: 12 }}>
                        <ThumbsUp size={12} fill={comment.userVote === 'like' ? SECONDARY : 'none'} />
                        {comment.likeCount || 0}
                    </button>
                    <button onClick={() => onLike(comment.id, 'dislike')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: comment.userVote === 'dislike' ? TERTIARY : SUB, padding: 0, fontFamily: FONT, fontSize: 12 }}>
                        <ThumbsDown size={12} fill={comment.userVote === 'dislike' ? TERTIARY : 'none'} />
                        {comment.dislikeCount || 0}
                    </button>
                    <span style={{ color: `${SUB}55` }}>·</span>
                    <span style={{ fontSize: 11, color: score > 0 ? SECONDARY : score < 0 ? TERTIARY : SUB, fontWeight: 600 }}>{score > 0 ? '+' : ''}{score}</span>
                    {!isReply && (
                        <button onClick={() => onReply({ id: comment.id, username: comment.username })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, fontFamily: FONT, fontSize: 12, marginLeft: 4 }}>
                            Reply
                        </button>
                    )}
                </div>
            </div>

            {/* Replies */}
            {!isReply && comment.replies?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                    {!showReplies ? (
                        <button onClick={() => setShowReplies(true)} style={{ background: 'none', border: 'none', color: SECONDARY, cursor: 'pointer', fontFamily: FONT, fontSize: 12, paddingLeft: 20 }}>
                            Show {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: `2px solid ${BORDER}`, marginLeft: 12, paddingLeft: 8 }}>
                            {comment.replies.filter((r: any) => !r.deletedAt).map((r: any) => (
                                <CommentCard key={r.id} comment={r} onLike={onLike} onReply={() => {}} isReply />
                            ))}
                            <button onClick={() => setShowReplies(false)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 11, textAlign: 'left', padding: '2px 0' }}>
                                Hide replies
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
