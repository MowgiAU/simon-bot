import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from './AuthProvider';
import { showToast } from './Toast';
import {
    MessageCircle, Send, Trash2, Edit3, X, Smile, Image as ImageIcon,
    Search, Loader2, ChevronDown, Reply
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────

interface Comment {
    id: string;
    userId: string;
    username: string;
    avatarUrl: string | null;
    content: string;
    gifUrl: string | null;
    editedAt: string | null;
    createdAt: string;
    parentId?: string | null;
    replies?: Comment[];
}

interface CommentSectionProps {
    trackId?: string;
    profileId?: string;
    /** userId that owns the track/profile (for delete permissions) */
    ownerId?: string;
}

// ─── Default emojis ───────────────────────────────────────────────────────

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
    { name: 'Smileys', emojis: ['😀','😂','🤣','😊','😍','🥰','😎','🤩','😏','😢','😭','😤','🤬','🥺','😱','🤔','🤫','🤭','😴','🤮','🥵','🥶','😈','👻','💀','🤡'] },
    { name: 'Gestures', emojis: ['👍','👎','👏','🙌','🤝','✌️','🤞','🤟','🤘','👊','✊','👋','🫡','💪','🙏','🫶'] },
    { name: 'Music', emojis: ['🎵','🎶','🎤','🎧','🎹','🎸','🥁','🎺','🎷','🪗','🎻','🔊','🔉','🔇','📀','💿'] },
    { name: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💕','💖','💗','💘','💝'] },
    { name: 'Objects', emojis: ['🔥','⭐','💫','✨','⚡','💯','🏆','🥇','🥈','🥉','🎯','🎪','🎭','🎨','🖥️','💻'] },
    { name: 'Flags', emojis: ['🚩','🏁','🏳️‍🌈','🇺🇸','🇬🇧','🇦🇺','🇨🇦','🇩🇪','🇫🇷','🇯🇵','🇰🇷','🇧🇷'] },
];

// ─── GIF Picker ───────────────────────────────────────────────────────────

const GifPicker: React.FC<{ onSelect: (url: string) => void; onClose: () => void }> = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [featured, setFeatured] = useState<any[]>([]);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        // Load featured GIFs on mount
        fetchGifs('');
    }, []);

    const fetchGifs = async (q: string) => {
        setLoading(true);
        try {
            const endpoint = q.trim()
                ? `${API}/api/klipy/search?q=${encodeURIComponent(q.trim())}`
                : `${API}/api/klipy/featured`;
            const res = await axios.get(endpoint, { withCredentials: true });
            const results = res.data?.results || [];
            if (q.trim()) {
                setGifs(results);
            } else {
                setFeatured(results);
                setGifs([]);
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchGifs(val), 400);
    };

    const displayGifs = query.trim() ? gifs : featured;

    return (
        <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            backgroundColor: '#1a1e2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: borderRadius.md, boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            zIndex: 100, maxHeight: '360px', display: 'flex', flexDirection: 'column',
            marginBottom: '8px',
        }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={14} color={colors.textSecondary} />
                <input
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search KLIPY"
                    autoFocus
                    style={{ flex: 1, background: 'none', border: 'none', color: colors.textPrimary, fontSize: '14px', outline: 'none' }}
                />
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                    <X size={16} />
                </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                        <Loader2 size={20} color={colors.textSecondary} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : displayGifs.length === 0 ? (
                    <p style={{ textAlign: 'center', color: colors.textSecondary, fontSize: '13px', padding: '16px' }}>
                        {query ? 'No GIFs found' : 'Loading...'}
                    </p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {displayGifs.map((gif: any, i: number) => {
                            const url = gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url || gif.url;
                            const preview = gif.media_formats?.nanogif?.url || gif.media_formats?.tinygif?.url || url;
                            return (
                                <div key={gif.id || i}
                                    onClick={() => onSelect(url)}
                                    style={{ cursor: 'pointer', borderRadius: '6px', overflow: 'hidden', aspectRatio: '1/1', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                    <img src={preview} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div style={{ padding: '4px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', color: colors.textSecondary, textAlign: 'right' }}>
                Powered by KLIPY
            </div>
        </div>
    );
};

// ─── Emoji Picker ─────────────────────────────────────────────────────────

const EmojiPicker: React.FC<{ onSelect: (emoji: string) => void; onClose: () => void }> = ({ onSelect, onClose }) => {
    const [customEmojis, setCustomEmojis] = useState<any[]>([]);
    const [tab, setTab] = useState<'default' | 'custom'>('default');
    const [search, setSearch] = useState('');

    useEffect(() => {
        axios.get(`${API}/api/discord/emojis`, { withCredentials: true })
            .then(res => { if (res.data?.length) setCustomEmojis(res.data); })
            .catch(() => {});
    }, []);

    return (
        <div style={{
            position: 'absolute', bottom: '100%', left: 0,
            backgroundColor: '#1a1e2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: borderRadius.md, boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            zIndex: 100, width: '320px', maxHeight: '340px', display: 'flex', flexDirection: 'column',
            marginBottom: '8px',
        }}>
            {/* Search + tabs */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <button onClick={() => setTab('default')}
                        style={{ flex: 1, padding: '5px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, backgroundColor: tab === 'default' ? colors.primary : 'transparent', color: tab === 'default' ? 'white' : colors.textSecondary }}>
                        Default
                    </button>
                    {customEmojis.length > 0 && (
                        <button onClick={() => setTab('custom')}
                            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, backgroundColor: tab === 'custom' ? colors.primary : 'transparent', color: tab === 'custom' ? 'white' : colors.textSecondary }}>
                            Server
                        </button>
                    )}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                        <X size={14} />
                    </button>
                </div>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search emojis..."
                    style={{ width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: colors.textPrimary, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                {tab === 'default' ? (
                    EMOJI_CATEGORIES.map(cat => {
                        const filtered = search ? cat.emojis.filter(() => cat.name.toLowerCase().includes(search.toLowerCase())) : cat.emojis;
                        if (search && filtered.length === 0) return null;
                        return (
                            <div key={cat.name}>
                                <div style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', margin: '4px 0 2px', letterSpacing: '0.05em' }}>{cat.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '6px' }}>
                                    {(search ? cat.emojis : cat.emojis).map((em, i) => (
                                        <button key={i} onClick={() => onSelect(em)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '3px', borderRadius: '4px', lineHeight: 1 }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            {em}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {customEmojis
                            .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
                            .map(em => (
                                <button key={em.id} onClick={() => onSelect(`<${em.animated ? 'a' : ''}:${em.name}:${em.id}>`)}
                                    title={`:${em.name}:`}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <img src={em.url} alt={em.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                                </button>
                            ))}
                        {customEmojis.length === 0 && (
                            <p style={{ color: colors.textSecondary, fontSize: '12px' }}>No custom emojis</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Comment Section ──────────────────────────────────────────────────────

export const CommentSection: React.FC<CommentSectionProps> = ({ trackId, profileId, ownerId }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [gifUrl, setGifUrl] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editGifUrl, setEditGifUrl] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [replySending, setReplySending] = useState(false);
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
    const [showReplyEmoji, setShowReplyEmoji] = useState(false);

    const fetchComments = useCallback(async (cursor?: string) => {
        try {
            const params = new URLSearchParams();
            if (trackId) params.set('trackId', trackId);
            if (profileId) params.set('profileId', profileId);
            if (cursor) params.set('cursor', cursor);
            params.set('limit', '30');

            const res = await axios.get(`${API}/api/comments?${params}`, { withCredentials: true });
            if (cursor) {
                setComments(prev => [...prev, ...res.data.comments]);
            } else {
                setComments(res.data.comments);
            }
            setHasMore(res.data.hasMore);
            setNextCursor(res.data.nextCursor);
        } catch {} finally {
            setLoading(false);
        }
    }, [trackId, profileId]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    // Close pickers on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowGifPicker(false);
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSubmit = async () => {
        if ((!content.trim() && !gifUrl) || sending) return;
        setSending(true);
        try {
            const res = await axios.post(`${API}/api/comments`, {
                content: content.trim(),
                gifUrl,
                ...(trackId ? { trackId } : {}),
                ...(profileId ? { profileId } : {}),
            }, { withCredentials: true });
            setComments(prev => [res.data, ...prev]);
            setContent('');
            setGifUrl(null);
        } catch (e: any) {
            const msg = e?.response?.data?.error || 'Failed to post comment';
            showToast(msg, 'error');
        } finally {
            setSending(false);
        }
    };

    const handleEdit = async (commentId: string, parentId?: string) => {
        if (!editContent.trim() && !editGifUrl) return;
        try {
            const res = await axios.put(`${API}/api/comments/${commentId}`, {
                content: editContent.trim(),
                gifUrl: editGifUrl,
            }, { withCredentials: true });
            if (parentId) {
                setComments(prev => prev.map(c => c.id === parentId
                    ? { ...c, replies: (c.replies || []).map(r => r.id === commentId ? res.data : r) }
                    : c));
            } else {
                setComments(prev => prev.map(c => c.id === commentId ? res.data : c));
            }
            setEditingId(null);
        } catch (e: any) {
            showToast(e?.response?.data?.error || 'Failed to update comment', 'error');
        }
    };

    const handleDelete = async (commentId: string, parentId?: string) => {
        try {
            await axios.delete(`${API}/api/comments/${commentId}`, { withCredentials: true });
            if (parentId) {
                setComments(prev => prev.map(c => c.id === parentId
                    ? { ...c, replies: (c.replies || []).filter(r => r.id !== commentId) }
                    : c));
            } else {
                setComments(prev => prev.filter(c => c.id !== commentId));
            }
        } catch (e: any) {
            showToast(e?.response?.data?.error || 'Failed to delete comment', 'error');
        }
    };

    const canDelete = (comment: Comment) => {
        if (!user) return false;
        if (comment.userId === user.id) return true;
        if (ownerId && user.id === ownerId) return true;
        return false;
    };

    const handleReply = async (parentId: string) => {
        if (!replyContent.trim() || replySending) return;
        setReplySending(true);
        try {
            const res = await axios.post(`${API}/api/comments`, {
                content: replyContent.trim(),
                parentId,
            }, { withCredentials: true });
            setComments(prev => prev.map(c => c.id === parentId
                ? { ...c, replies: [...(c.replies || []), res.data] }
                : c));
            setReplyContent('');
            setReplyingTo(null);
            setShowReplyEmoji(false);
            setExpandedReplies(prev => new Set([...prev, parentId]));
        } catch (e: any) {
            showToast(e?.response?.data?.error || 'Failed to post reply', 'error');
        } finally {
            setReplySending(false);
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    // Render Discord custom emoji in text
    const renderContent = (text: string) => {
        const parts = text.split(/(<a?:\w+:\d+>)/g);
        return parts.map((part, i) => {
            const match = part.match(/^<(a?):(\w+):(\d+)>$/);
            if (match) {
                const [, animated, name, id] = match;
                return <img key={i} src={`https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=28`} alt={`:${name}:`} title={`:${name}:`} style={{ width: '20px', height: '20px', verticalAlign: 'middle', margin: '0 1px' }} />;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div style={{ marginTop: spacing.xl }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: spacing.lg }}>
                <MessageCircle size={22} color={colors.primary} />
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Comments</h2>
                <span style={{ fontSize: '0.85rem', color: colors.textSecondary }}>({comments.length}{hasMore ? '+' : ''})</span>
            </div>

            {/* Comment Input */}
            {user ? (
                <div style={{ marginBottom: spacing.lg, position: 'relative' }} ref={pickerRef}>
                    {/* GIF Preview */}
                    {gifUrl && (
                        <div style={{ marginBottom: '8px', position: 'relative', display: 'inline-block' }}>
                            <img src={gifUrl} alt="GIF" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: borderRadius.md }} />
                            <button onClick={() => setGifUrl(null)}
                                style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: colors.error || '#DC2626', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        {user && (
                            <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                                alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1 }}>
                            <textarea
                                ref={inputRef}
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                                placeholder="Write a comment..."
                                rows={1}
                                style={{
                                    width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md,
                                    color: colors.textPrimary, fontSize: '14px', outline: 'none', resize: 'none',
                                    fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '42px',
                                }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                                <button onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: showGifPicker ? colors.primary : colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                                    <ImageIcon size={16} /> GIF
                                </button>
                                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: showEmojiPicker ? colors.primary : colors.textSecondary, display: 'flex' }}>
                                    <Smile size={16} />
                                </button>
                                <div style={{ flex: 1 }} />
                                <button onClick={handleSubmit} disabled={sending || (!content.trim() && !gifUrl)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px',
                                        backgroundColor: colors.primary, color: 'white', border: 'none',
                                        borderRadius: borderRadius.md, cursor: (sending || (!content.trim() && !gifUrl)) ? 'not-allowed' : 'pointer',
                                        fontWeight: 600, fontSize: '13px', opacity: (sending || (!content.trim() && !gifUrl)) ? 0.5 : 1,
                                    }}>
                                    <Send size={14} /> {sending ? 'Sending...' : 'Comment'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pickers */}
                    {showGifPicker && <GifPicker onSelect={(url) => { setGifUrl(url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
                    {showEmojiPicker && <EmojiPicker onSelect={(em) => { setContent(prev => prev + em); }} onClose={() => setShowEmojiPicker(false)} />}
                </div>
            ) : (
                <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.06)', marginBottom: spacing.lg, textAlign: 'center' }}>
                    <a href="/api/auth/discord/login" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                        Log in to leave a comment
                    </a>
                </div>
            )}

            {/* Comment List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: colors.textSecondary }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary, fontSize: '14px' }}>
                    No comments yet. Be the first!
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {comments.map(comment => (
                        <div key={comment.id} style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.04)' }}>
                            {/* Avatar */}
                            <div style={{ flexShrink: 0 }}>
                                {comment.avatarUrl ? (
                                    <img src={comment.avatarUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                                ) : (
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
                                        {comment.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px', color: colors.textPrimary }}>{comment.username}</span>
                                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>{formatTime(comment.createdAt)}</span>
                                    {comment.editedAt && <span style={{ fontSize: '11px', color: colors.textSecondary, fontStyle: 'italic' }}>(edited)</span>}
                                </div>

                                {editingId === comment.id ? (
                                    <div>
                                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                                            style={{ width: '100%', padding: '8px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: colors.textPrimary, fontSize: '13px', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                                            rows={2} />
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                            <button onClick={() => handleEdit(comment.id)}
                                                style={{ padding: '4px 12px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                                                Save
                                            </button>
                                            <button onClick={() => setEditingId(null)}
                                                style={{ padding: '4px 12px', backgroundColor: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {comment.content && (
                                            <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#CBD5E1', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                                {renderContent(comment.content)}
                                            </p>
                                        )}
                                        {comment.gifUrl && (
                                            <img src={comment.gifUrl} alt="GIF" style={{ maxWidth: '250px', maxHeight: '200px', borderRadius: '8px', marginTop: '4px' }} />
                                        )}
                                    </>
                                )}

                                {/* Actions */}
                                {editingId !== comment.id && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                        {user && comment.userId === user.id && (
                                            <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); setEditGifUrl(comment.gifUrl); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                <Edit3 size={12} /> Edit
                                            </button>
                                        )}
                                        {canDelete(comment) && (
                                            <button onClick={() => handleDelete(comment.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        )}
                                        <button onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyContent(''); setShowReplyEmoji(false); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: replyingTo === comment.id ? colors.primary : colors.textSecondary, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                            <Reply size={12} /> Reply
                                        </button>
                                    </div>
                                )}

                                {/* Reply Input */}
                                {user && replyingTo === comment.id && (
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <img src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : ''}
                                            alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, marginTop: '4px', backgroundColor: 'rgba(255,255,255,0.1)', objectFit: 'cover' }} />
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <textarea
                                                autoFocus
                                                value={replyContent}
                                                onChange={e => setReplyContent(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(comment.id); } }}
                                                placeholder={`Reply to @${comment.username}\u2026`}
                                                rows={1}
                                                style={{ width: '100%', padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.primary}40`, borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '5px', alignItems: 'center' }}>
                                                <button onClick={() => setShowReplyEmoji(v => !v)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: showReplyEmoji ? colors.primary : colors.textSecondary, display: 'flex' }}>
                                                    <Smile size={14} />
                                                </button>
                                                <div style={{ flex: 1 }} />
                                                <button onClick={() => { setReplyingTo(null); setReplyContent(''); setShowReplyEmoji(false); }}
                                                    style={{ padding: '4px 10px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: colors.textSecondary, cursor: 'pointer', fontSize: '12px' }}>
                                                    Cancel
                                                </button>
                                                <button onClick={() => handleReply(comment.id)} disabled={replySending || !replyContent.trim()}
                                                    style={{ padding: '4px 12px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '4px', cursor: (replySending || !replyContent.trim()) ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600, opacity: (replySending || !replyContent.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Send size={12} /> {replySending ? '\u2026' : 'Reply'}
                                                </button>
                                            </div>
                                            {showReplyEmoji && (
                                                <EmojiPicker onSelect={em => setReplyContent(prev => prev + em)} onClose={() => setShowReplyEmoji(false)} />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Replies */}
                                {comment.replies && comment.replies.length > 0 && (
                                    <div style={{ marginTop: '10px' }}>
                                        <button onClick={() => setExpandedReplies(prev => { const s = new Set(prev); s.has(comment.id) ? s.delete(comment.id) : s.add(comment.id); return s; })}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}>
                                            <ChevronDown size={13} style={{ transform: expandedReplies.has(comment.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                            {expandedReplies.has(comment.id) ? 'Hide' : `${comment.replies.length}`} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                        </button>
                                        {expandedReplies.has(comment.id) && (
                                            <div style={{ marginTop: '8px', paddingLeft: '14px', borderLeft: `2px solid ${colors.primary}30`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {comment.replies.map(reply => (
                                                    <div key={reply.id} style={{ display: 'flex', gap: '10px' }}>
                                                        <div style={{ flexShrink: 0 }}>
                                                            {reply.avatarUrl ? (
                                                                <img src={reply.avatarUrl} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                                                            ) : (
                                                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                                                                    {reply.username.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                                                <span style={{ fontWeight: 600, fontSize: '13px', color: colors.textPrimary }}>{reply.username}</span>
                                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>{formatTime(reply.createdAt)}</span>
                                                                {reply.editedAt && <span style={{ fontSize: '10px', color: colors.textSecondary, fontStyle: 'italic' }}>(edited)</span>}
                                                            </div>
                                                            {editingId === reply.id ? (
                                                                <div>
                                                                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                                                                        style={{ width: '100%', padding: '7px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: colors.textPrimary, fontSize: '12px', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                                                                        rows={2} />
                                                                    <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                                                                        <button onClick={() => handleEdit(reply.id, comment.id)}
                                                                            style={{ padding: '3px 10px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                                                            Save
                                                                        </button>
                                                                        <button onClick={() => setEditingId(null)}
                                                                            style={{ padding: '3px 10px', backgroundColor: 'transparent', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {reply.content && (
                                                                        <p style={{ margin: '0 0 3px', fontSize: '13px', color: '#CBD5E1', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                                                            {renderContent(reply.content)}
                                                                        </p>
                                                                    )}
                                                                    {reply.gifUrl && (
                                                                        <img src={reply.gifUrl} alt="GIF" style={{ maxWidth: '200px', maxHeight: '160px', borderRadius: '8px', marginTop: '4px' }} />
                                                                    )}
                                                                </>
                                                            )}
                                                            {user && editingId !== reply.id && (
                                                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                                    {reply.userId === user.id && (
                                                                        <button onClick={() => { setEditingId(reply.id); setEditContent(reply.content); setEditGifUrl(reply.gifUrl); }}
                                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                                            <Edit3 size={11} /> Edit
                                                                        </button>
                                                                    )}
                                                                    {canDelete(reply) && (
                                                                        <button onClick={() => handleDelete(reply.id, comment.id)}
                                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                                            <Trash2 size={11} /> Delete
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <button onClick={() => fetchComments(nextCursor || undefined)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.md, color: colors.textSecondary, cursor: 'pointer', fontSize: '13px', width: '100%' }}>
                            <ChevronDown size={14} /> Load More Comments
                        </button>
                    )}
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
