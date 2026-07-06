/**
 * Alt F — Genre Post Detail (/preview/alt_f_genre_post/:postId)
 * Full post view with voting, comments, track player, share, admin controls.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import { MOBILE_NAV_HEIGHT } from '../components/altshell/AltMobileNav';
import {
    ChevronUp, ChevronDown, MessageCircle, Music, Play, Pause, FileText,
    ChevronLeft, Send, ThumbsUp, ThumbsDown,
    Share2, Pin, EyeOff, Eye, Tag, Layers, Check, X,
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
function flairColor(flair: string): string {
    let h = 5381;
    for (let i = 0; i < flair.length; i++) h = (h * 33 ^ flair.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

interface GenreInfo { id: string; name: string; slug: string; }
interface CrossPostOf { id: string; title: string; username?: string; flair?: string | null; genre?: GenreInfo | null; }

export const FrontpageAltFGenrePost: React.FC = () => {
    const postId = window.location.pathname.split('/').pop() || '';
    const { player, setTrack, togglePlay } = usePlayer();
    const { mutualAdminGuilds } = useAuth();
    const isAdmin = mutualAdminGuilds.length > 0;
    const bp = useAltBreakpoint();
    const isMobile = bp === 'xs';
    const [commentBarFocused, setCommentBarFocused] = useState(false);

    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState<any[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentSort, setCommentSort] = useState<'best' | 'new' | 'old'>('best');
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

    // Share state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareStep, setShareStep] = useState<'menu' | 'crosspost'>('menu');
    const [crossPostGenreId, setCrossPostGenreId] = useState('');
    const [crossPostNote, setCrossPostNote] = useState('');
    const [crossPosting, setCrossPosting] = useState(false);
    const [crossPostDone, setCrossPostDone] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareErr, setShareErr] = useState('');
    const [genres, setGenres] = useState<any[]>([]);

    // Admin hide post state
    const [showHidePostModal, setShowHidePostModal] = useState(false);
    const [hidePostReason, setHidePostReason] = useState('');
    const [hidingPost, setHidingPost] = useState(false);

    // Admin hide comment state
    const [showHideCommentModal, setShowHideCommentModal] = useState<{ commentId: string } | null>(null);
    const [hideCommentReason, setHideCommentReason] = useState('');
    const [hidingComment, setHidingComment] = useState(false);

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

    // Fetch genres for cross-post selector
    useEffect(() => {
        axios.get('/api/musician/genres').then(r => {
            const flat: any[] = [];
            const walk = (gs: any[]) => gs.forEach((g: any) => { flat.push(g); walk(g.children || []); });
            walk(arr(r.data));
            setGenres(flat);
        }).catch(() => {});
    }, []);

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

    // Admin: toggle pin
    const handleTogglePin = async () => {
        if (!post) return;
        try {
            const r = await axios.post(`/api/genre-posts/${post.id}/pin`, {}, { withCredentials: true });
            setPost((p: any) => ({ ...p, pinned: r.data.pinned }));
        } catch {}
    };

    // Admin: hide post
    const handleHidePost = async () => {
        if (!post) return;
        setHidingPost(true);
        try {
            await axios.post(`/api/genre-posts/${post.id}/hide`, { reason: hidePostReason || undefined }, { withCredentials: true });
            setPost((p: any) => ({ ...p, hiddenAt: new Date().toISOString(), hideReason: hidePostReason || null }));
            setShowHidePostModal(false);
            setHidePostReason('');
        } catch {}
        finally { setHidingPost(false); }
    };

    // Admin: restore post
    const handleRestorePost = async () => {
        if (!post) return;
        try {
            await axios.post(`/api/genre-posts/${post.id}/restore`, {}, { withCredentials: true });
            setPost((p: any) => ({ ...p, hiddenAt: null, hideReason: null }));
        } catch {}
    };

    // Admin: hide comment
    const handleHideComment = async () => {
        if (!showHideCommentModal) return;
        setHidingComment(true);
        try {
            await axios.post(`/api/comments/${showHideCommentModal.commentId}/hide`, { reason: hideCommentReason || undefined }, { withCredentials: true });
            const update = (cs: any[]): any[] => cs.map(c => {
                if (c.id === showHideCommentModal.commentId) return { ...c, hiddenAt: new Date().toISOString(), hideReason: hideCommentReason || null };
                if (c.replies?.length) return { ...c, replies: update(c.replies) };
                return c;
            });
            setComments(prev => update(prev));
            setShowHideCommentModal(null);
            setHideCommentReason('');
        } catch {}
        finally { setHidingComment(false); }
    };

    // Admin: restore comment
    const handleRestoreComment = async (commentId: string) => {
        try {
            await axios.post(`/api/comments/${commentId}/restore`, {}, { withCredentials: true });
            const update = (cs: any[]): any[] => cs.map(c => {
                if (c.id === commentId) return { ...c, hiddenAt: null, hideReason: null };
                if (c.replies?.length) return { ...c, replies: update(c.replies) };
                return c;
            });
            setComments(prev => update(prev));
        } catch {}
    };

    // Share: copy link
    const copyLink = () => {
        const url = `${window.location.origin}/preview/alt_f_genre_post/${postId}`;
        navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
    };

    // Share: cross-post
    const submitCrossPost = async () => {
        if (!crossPostGenreId) { setShareErr('Please select a genre'); return; }
        setCrossPosting(true); setShareErr('');
        try {
            await axios.post('/api/genre-posts', {
                genreId: crossPostGenreId,
                crossPostOfId: post.id,
                title: post.title,
                body: crossPostNote || undefined,
                type: 'discussion',
            }, { withCredentials: true });
            setCrossPostDone(true);
        } catch (e: any) { setShareErr(e.response?.data?.error || 'Failed to cross-post'); }
        finally { setCrossPosting(false); }
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
    const crossPostOf: CrossPostOf | null = post.crossPostOf || null;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[
                    { label: 'Genres', to: '/preview/alt_f_genres' },
                    ...(post.genre ? [{ label: post.genre.name, to: `/preview/alt_f_genres/${post.genre.slug}` }] : []),
                    { label: post.title.length > 40 ? post.title.slice(0, 40) + '…' : post.title },
                ]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: pb }}>
                        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 60px', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28, alignItems: 'start' }}>

                            {/* LEFT SIDEBAR */}
                            <div style={{ position: 'sticky', top: 0 }}>
                                {post.genre && (() => {
                                    const sAccent = genreAccent(post.genre.name);
                                    return (
                                        <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
                                            <div style={{ height: 5, background: sAccent }} />
                                            <div style={{ padding: '14px 16px' }}>
                                                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: TEXT }}>{post.genre.name}</h3>
                                                <Link to={`/preview/alt_f_genres/${post.genre.slug}`}
                                                    style={{ display: 'block', width: '100%', padding: '8px 0', background: `${sAccent}18`, border: `1.5px solid ${sAccent}`, borderRadius: 8, color: sAccent, textAlign: 'center', textDecoration: 'none', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}>
                                                    Browse genre
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* RIGHT COLUMN */}
                            <div>

                            {/* Post card */}
                            <div style={isMobile ? { borderBottom: `1px solid ${BORDER}`, padding: '4px 0 16px', marginBottom: 16 } : { ...glass, borderRadius: 18, padding: '24px 28px', marginBottom: 24 }}>
                                {/* Admin: hidden indicator */}
                                {isAdmin && post.hiddenAt && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${TERTIARY}18`, border: `1px solid ${TERTIARY}44`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: TERTIARY }}>
                                        <EyeOff size={13} />
                                        <span><strong>Hidden</strong>{post.hideReason ? ` — "${post.hideReason}"` : ' (silently)'}</span>
                                        <button onClick={handleRestorePost} style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${TERTIARY}`, borderRadius: 6, color: TERTIARY, cursor: 'pointer', fontFamily: FONT, fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Eye size={11} /> Restore
                                        </button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 20 }}>
                                    {/* Vote column — desktop only; mobile shows votes in the bottom action bar */}
                                    {!isMobile && (
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
                                    )}

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Pinned indicator */}
                                        {post.pinned && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SECONDARY, fontWeight: 700, marginBottom: 8 }}>
                                                <Pin size={12} /> Pinned post
                                            </div>
                                        )}

                                        {/* Genre pill + meta */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: SUB, flexWrap: 'wrap' }}>
                                            {post.genre && (
                                                <Link to={`/preview/alt_f_genres/${post.genre.slug}`} style={{ background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, padding: '2px 9px', borderRadius: 9999, fontWeight: 700, fontSize: 11, textDecoration: 'none' }}>
                                                    {post.genre.name}
                                                </Link>
                                            )}
                                            {/* Flair pill */}
                                            {post.flair && (
                                                <Link to={`/preview/alt_f_genres/${post.genre?.slug || ''}?flair=${encodeURIComponent(post.flair)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${flairColor(post.flair)}18`, border: `1px solid ${flairColor(post.flair)}44`, color: flairColor(post.flair), padding: '2px 9px', borderRadius: 9999, fontWeight: 700, fontSize: 11, textDecoration: 'none' }}>
                                                    <Tag size={9} /> {post.flair}
                                                </Link>
                                            )}
                                            <span>Posted by <Link to={`/profile/${post.username}`} style={{ color: TEXT, fontWeight: 700, textDecoration: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                                {post.username}
                                            </Link></span>
                                            <span>·</span>
                                            <span>{timeAgo(post.createdAt)}</span>
                                        </div>

                                        {/* Cross-post origin */}
                                        {crossPostOf && (
                                            <div style={{ padding: '8px 12px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Share2 size={12} color={SUB} style={{ flexShrink: 0 }} />
                                                <span>Cross-posted from{' '}
                                                    <Link to={`/preview/alt_f_genre_post/${crossPostOf.id}`} style={{ color: crossPostOf.genre ? genreAccent(crossPostOf.genre.name) : PRIMARY, fontWeight: 600, textDecoration: 'none' }}>
                                                        {crossPostOf.title.length > 50 ? crossPostOf.title.slice(0, 50) + '…' : crossPostOf.title}
                                                    </Link>
                                                    {crossPostOf.genre && (
                                                        <> in <Link to={`/preview/alt_f_genres/${crossPostOf.genre.slug}`} style={{ color: genreAccent(crossPostOf.genre.name), fontWeight: 600, textDecoration: 'none' }}>{crossPostOf.genre.name}</Link></>
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {/* Title */}
                                        <h1 style={{ margin: '0 0 16px', fontSize: isMobile ? 18 : 22, fontWeight: 900, color: TEXT, lineHeight: 1.3 }}>
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
                                            <div style={{ fontSize: 15, color: TEXT, lineHeight: 1.7, marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: post.body }} />
                                        )}

                                        {/* Discussion image */}
                                        {post.type === 'discussion' && post.imageUrl && (
                                            <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 14, display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                                        )}

                                        {/* Footer stats + actions — Reddit-style bottom action bar on mobile */}
                                        {isMobile && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: S_HIGH, borderRadius: 9999, padding: '4px 6px' }}>
                                                    <button onClick={() => handleVote('up')}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: post.userVote === 'up' ? PRIMARY : SUB }}>
                                                        <ChevronUp size={17} />
                                                    </button>
                                                    <span style={{ fontSize: 13, fontWeight: 800, color: post.score > 0 ? PRIMARY : post.score < 0 ? TERTIARY : TEXT, minWidth: 18, textAlign: 'center' }}>{post.score}</span>
                                                    <button onClick={() => handleVote('down')}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: post.userVote === 'down' ? TERTIARY : SUB }}>
                                                        <ChevronDown size={17} />
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: SUB, fontSize: 12, fontWeight: 700, background: S_HIGH, borderRadius: 9999, padding: '6px 12px' }}>
                                                    <MessageCircle size={14} /> {post.commentCount}
                                                </div>
                                                <button onClick={() => { setShowShareModal(true); setShareStep('menu'); setCrossPostDone(false); setShareErr(''); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: SUB, fontSize: 12, fontWeight: 700, background: S_HIGH, border: 'none', borderRadius: 9999, padding: '6px 12px', cursor: 'pointer' }}>
                                                    <Share2 size={14} />
                                                </button>
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={handleTogglePin}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${post.pinned ? SECONDARY : BORDER}`, borderRadius: 9999, cursor: 'pointer', color: post.pinned ? SECONDARY : SUB, padding: '5px 10px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                                            <Pin size={11} /> {post.pinned ? 'Unpin' : 'Pin'}
                                                        </button>
                                                        {!post.hiddenAt ? (
                                                            <button onClick={() => setShowHidePostModal(true)}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 9999, cursor: 'pointer', color: TERTIARY, padding: '5px 10px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                                                <EyeOff size={11} /> Hide
                                                            </button>
                                                        ) : (
                                                            <button onClick={handleRestorePost}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${TERTIARY}`, borderRadius: 9999, cursor: 'pointer', color: TERTIARY, padding: '5px 10px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                                                <Eye size={11} /> Restore
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {!isMobile && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: SUB, paddingTop: 10, borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MessageCircle size={13} /> {post.commentCount} comments</span>
                                            <span>{post.upvotes} upvotes · {post.downvotes} downvotes</span>
                                            {/* Share button */}
                                            <button onClick={() => { setShowShareModal(true); setShareStep('menu'); setCrossPostDone(false); setShareErr(''); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, fontFamily: FONT, fontSize: 12 }}
                                                onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                                                onMouseLeave={e => (e.currentTarget.style.color = SUB)}>
                                                <Share2 size={12} /> Share
                                            </button>
                                            {/* Admin controls */}
                                            {isAdmin && (
                                                <>
                                                    <button onClick={handleTogglePin}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${post.pinned ? SECONDARY : BORDER}`, borderRadius: 6, cursor: 'pointer', color: post.pinned ? SECONDARY : SUB, padding: '3px 9px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}
                                                        onMouseEnter={e => (e.currentTarget.style.borderColor = SECONDARY)}
                                                        onMouseLeave={e => (e.currentTarget.style.borderColor = post.pinned ? SECONDARY : BORDER)}>
                                                        <Pin size={11} /> {post.pinned ? 'Unpin' : 'Pin'}
                                                    </button>
                                                    {!post.hiddenAt ? (
                                                        <button onClick={() => setShowHidePostModal(true)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer', color: TERTIARY, padding: '3px 9px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                                            <EyeOff size={11} /> Hide Post
                                                        </button>
                                                    ) : (
                                                        <button onClick={handleRestorePost}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${TERTIARY}`, borderRadius: 6, cursor: 'pointer', color: TERTIARY, padding: '3px 9px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                                            <Eye size={11} /> Restore Post
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Comment box — inline on desktop; on mobile it's reachable via the sticky "Add a comment" bar below */}
                            <div style={isMobile ? { display: commentBarFocused ? 'block' : 'none', ...glass, borderRadius: 14, padding: '16px 18px', marginBottom: 24 } : { ...glass, borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
                                {replyTo && (
                                    <div style={{ fontSize: 12, color: SECONDARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        Replying to <strong>{replyTo.username}</strong>
                                        <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>× Cancel</button>
                                    </div>
                                )}
                                <textarea
                                    id="genre-post-comment-textarea"
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    placeholder={replyTo ? `Reply to ${replyTo.username}…` : 'Share your thoughts…'}
                                    rows={3}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical', marginBottom: 10 }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    {isMobile && (
                                        <button onClick={() => setCommentBarFocused(false)}
                                            style={{ padding: '8px 16px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
                                            Cancel
                                        </button>
                                    )}
                                    <button onClick={() => submitComment().then(() => setCommentBarFocused(false))} disabled={submitting || !commentText.trim()}
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
                                            <CommentCard
                                                key={c.id}
                                                comment={c}
                                                onLike={handleCommentLike}
                                                onReply={r => setReplyTo(r)}
                                                isAdmin={isAdmin}
                                                isMobile={isMobile}
                                                onHide={commentId => { setShowHideCommentModal({ commentId }); setHideCommentReason(''); }}
                                                onRestore={handleRestoreComment}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            </div>
                        </div>
                    </div>
                    <AltActivitySidebar />
                </div>
            </main>

            {/* Mobile: sticky "Add a comment" bar (Reddit-style), tap to reveal the comment box above */}
            {isMobile && !commentBarFocused && (
                <button
                    onClick={() => {
                        setCommentBarFocused(true);
                        setTimeout(() => document.getElementById('genre-post-comment-textarea')?.focus(), 50);
                    }}
                    style={{ position: 'fixed', left: 12, right: 80, bottom: MOBILE_NAV_HEIGHT + 12, height: 44, background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9999, color: SUB, fontSize: 13, fontFamily: FONT, display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8, zIndex: 205, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                    <Send size={14} /> {replyTo ? `Reply to ${replyTo.username}…` : 'Add a comment…'}
                </button>
            )}

            {/* Share Modal */}
            {showShareModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                    onClick={() => setShowShareModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ ...glass, borderRadius: 18, padding: 28, width: '100%', maxWidth: 480, fontFamily: FONT }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Share2 size={16} color={PRIMARY} /> Share Post
                            </h3>
                            <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}><X size={16} /></button>
                        </div>

                        {crossPostDone ? (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <Check size={32} color={SECONDARY} style={{ marginBottom: 10 }} />
                                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Cross-posted!</div>
                                <div style={{ fontSize: 13, color: SUB, marginBottom: 18 }}>The post has been shared to the selected genre.</div>
                                <button onClick={() => setShowShareModal(false)} style={{ padding: '9px 20px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>Done</button>
                            </div>
                        ) : shareStep === 'menu' ? (
                            <>
                                <div style={{ fontSize: 13, color: SUB, marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{post.title.length > 50 ? post.title.slice(0, 50) + '…' : post.title}"
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button onClick={copyLink}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: copied ? `${SECONDARY}18` : S_CONT, border: `1px solid ${copied ? SECONDARY : BORDER}`, borderRadius: 10, color: copied ? SECONDARY : TEXT, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}>
                                        <Share2 size={16} color={copied ? SECONDARY : SUB} />
                                        {copied ? 'Link copied!' : 'Copy link'}
                                    </button>
                                    <button onClick={() => setShareStep('crosspost')}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                                        <Layers size={16} color={SUB} />
                                        Cross-post to another genre
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setShareStep('menu')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: SUB, fontFamily: FONT, fontSize: 12, padding: 0, marginBottom: 16 }}>
                                    <ChevronLeft size={13} /> Back
                                </button>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Post to Genre</label>
                                <select value={crossPostGenreId} onChange={e => setCrossPostGenreId(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: crossPostGenreId ? TEXT : SUB, fontSize: 14, fontFamily: FONT, outline: 'none', marginBottom: 16, appearance: 'none' }}>
                                    <option value="">Select a genre…</option>
                                    {genres.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Note <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                <textarea value={crossPostNote} onChange={e => setCrossPostNote(e.target.value)} maxLength={2000} rows={3} placeholder="Add a note for the new community…"
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical', marginBottom: 4 }} />
                                {shareErr && <p style={{ color: TERTIARY, fontSize: 13, margin: '8px 0 0' }}>{shareErr}</p>}
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                    <button onClick={() => setShowShareModal(false)} style={{ padding: '9px 18px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 14 }}>Cancel</button>
                                    <button onClick={submitCrossPost} disabled={crossPosting || !crossPostGenreId}
                                        style={{ padding: '9px 18px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', cursor: (crossPosting || !crossPostGenreId) ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, opacity: (crossPosting || !crossPostGenreId) ? 0.6 : 1 }}>
                                        {crossPosting ? 'Posting…' : 'Cross-post'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Admin: Hide Post Modal */}
            {showHidePostModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                    onClick={() => setShowHidePostModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ ...glass, borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, fontFamily: FONT }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <EyeOff size={16} color={TERTIARY} /> Hide Post
                        </h3>
                        <p style={{ margin: '0 0 18px', fontSize: 13, color: SUB }}>This post will be hidden from regular users. You can restore it at any time.</p>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Reason <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional — leave blank to hide silently)</span></label>
                        <textarea value={hidePostReason} onChange={e => setHidePostReason(e.target.value)} maxLength={300} rows={3} placeholder="e.g. Spam, off-topic, guideline violation…"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical', marginBottom: 16 }} />
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowHidePostModal(false)} style={{ padding: '9px 18px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 14 }}>Cancel</button>
                            <button onClick={handleHidePost} disabled={hidingPost}
                                style={{ padding: '9px 18px', background: TERTIARY, border: 'none', borderRadius: 8, color: '#fff', cursor: hidingPost ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, opacity: hidingPost ? 0.6 : 1 }}>
                                {hidingPost ? 'Hiding…' : hidePostReason ? 'Hide with reason' : 'Hide silently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin: Hide Comment Modal */}
            {showHideCommentModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                    onClick={() => setShowHideCommentModal(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ ...glass, borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, fontFamily: FONT }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <EyeOff size={16} color={TERTIARY} /> Hide Comment
                        </h3>
                        <p style={{ margin: '0 0 18px', fontSize: 13, color: SUB }}>This comment will be hidden from regular users. Only admins will see it.</p>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Reason <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                        <textarea value={hideCommentReason} onChange={e => setHideCommentReason(e.target.value)} maxLength={300} rows={3} placeholder="e.g. Spam, harassment…"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical', marginBottom: 16 }} />
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowHideCommentModal(null)} style={{ padding: '9px 18px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 14 }}>Cancel</button>
                            <button onClick={handleHideComment} disabled={hidingComment}
                                style={{ padding: '9px 18px', background: TERTIARY, border: 'none', borderRadius: 8, color: '#fff', cursor: hidingComment ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, opacity: hidingComment ? 0.6 : 1 }}>
                                {hidingComment ? 'Hiding…' : 'Hide Comment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── CommentCard ────────────────────────────────────────────────────────────────
const CommentCard: React.FC<{
    comment: any;
    onLike: (id: string, type: 'like' | 'dislike') => void;
    onReply: (r: { id: string; username: string }) => void;
    isReply?: boolean;
    isAdmin?: boolean;
    isMobile?: boolean;
    onHide?: (commentId: string) => void;
    onRestore?: (commentId: string) => void;
}> = ({ comment, onLike, onReply, isReply, isAdmin, isMobile, onHide, onRestore }) => {
    const [showReplies, setShowReplies] = useState(true);
    if (comment.deletedAt) return null;

    const isHidden = !!comment.hiddenAt;

    // Non-admins never see hidden comments (filtered server-side, but guard client-side too)
    if (isHidden && !isAdmin) return null;

    const score = (comment.likeCount || 0) - (comment.dislikeCount || 0);

    return (
        <div style={{ paddingLeft: isReply ? 20 : 0 }}>
            <div style={isMobile ? {
                background: isHidden ? `${TERTIARY}0f` : 'none',
                border: isHidden ? `1px solid ${TERTIARY}44` : 'none',
                borderRadius: isHidden ? 10 : 0, padding: isHidden ? '10px 12px' : '8px 0',
            } : {
                background: isHidden ? `rgba(${TERTIARY},0.06)` : isReply ? 'rgba(28,31,42,0.5)' : 'rgba(15,19,29,0.7)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${isHidden ? `${TERTIARY}44` : BORDER}`,
                borderRadius: 12, padding: '12px 16px',
            }}>
                {/* Admin: hidden indicator */}
                {isHidden && isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TERTIARY, marginBottom: 8, fontWeight: 700 }}>
                        <EyeOff size={11} /> Hidden{comment.hideReason ? ` — "${comment.hideReason}"` : ' (silently)'}
                    </div>
                )}

                {isHidden ? (
                    /* Hidden comment shown to admins only */
                    <div style={{ opacity: 0.6 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                {comment.avatarUrl && <img src={comment.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <Link to={`/profile/${comment.username}`} style={{ fontSize: 13, fontWeight: 700, color: TEXT, textDecoration: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                {comment.username}
                            </Link>
                            <span style={{ fontSize: 11, color: SUB }}>·</span>
                            <span style={{ fontSize: 11, color: SUB }}>{timeAgo(comment.createdAt)}</span>
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: 14, color: SUB, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{comment.content}</p>
                        {onRestore && (
                            <button onClick={() => onRestore(comment.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${TERTIARY}`, borderRadius: 6, cursor: 'pointer', color: TERTIARY, padding: '3px 9px', fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                                <Eye size={11} /> Restore
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                {comment.avatarUrl && <img src={comment.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <Link to={`/profile/${comment.username}`} style={{ fontSize: 13, fontWeight: 700, color: TEXT, textDecoration: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                {comment.username}
                            </Link>
                            <span style={{ fontSize: 11, color: SUB }}>·</span>
                            <span style={{ fontSize: 11, color: SUB }}>{timeAgo(comment.createdAt)}</span>
                        </div>

                        {/* Content */}
                        <p style={{ margin: '0 0 10px', fontSize: 14, color: TEXT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{comment.content}</p>

                        {/* Actions */}
                        {isMobile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: S_HIGH, borderRadius: 9999, padding: '2px 4px' }}>
                                    <button onClick={() => onLike(comment.id, 'like')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: comment.userVote === 'like' ? SECONDARY : SUB, padding: 4, display: 'flex' }}>
                                        <ChevronUp size={14} />
                                    </button>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: score > 0 ? SECONDARY : score < 0 ? TERTIARY : TEXT, minWidth: 14, textAlign: 'center' }}>{score}</span>
                                    <button onClick={() => onLike(comment.id, 'dislike')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: comment.userVote === 'dislike' ? TERTIARY : SUB, padding: 4, display: 'flex' }}>
                                        <ChevronDown size={14} />
                                    </button>
                                </div>
                                {!isReply && (
                                    <button onClick={() => onReply({ id: comment.id, username: comment.username })}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: '4px 8px', fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
                                        Reply
                                    </button>
                                )}
                                {isAdmin && onHide && (
                                    <button onClick={() => onHide(comment.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: TERTIARY, padding: '4px 8px', fontFamily: FONT, fontSize: 11 }}>
                                        <EyeOff size={11} /> Hide
                                    </button>
                                )}
                            </div>
                        ) : (
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
                                {/* Admin: hide button */}
                                {isAdmin && onHide && (
                                    <button onClick={() => onHide(comment.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: TERTIARY, padding: 0, fontFamily: FONT, fontSize: 11, marginLeft: 4 }}>
                                        <EyeOff size={11} /> Hide
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
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
                            {comment.replies.filter((r: any) => !r.deletedAt && (!r.hiddenAt || isAdmin)).map((r: any) => (
                                <CommentCard
                                    key={r.id}
                                    comment={r}
                                    onLike={onLike}
                                    onReply={() => {}}
                                    isReply
                                    isAdmin={isAdmin}
                                    isMobile={isMobile}
                                    onHide={onHide}
                                    onRestore={onRestore}
                                />
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
