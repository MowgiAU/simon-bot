/**
 * Alt F — Create Genre Post (/create-post?genreId=xxx)
 * Reddit-style dedicated post creation page with WYSIWYG body, media attachments,
 * extra genre tags (max 2), flair, and community rules sidebar.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { RichTextEditor } from '../components/RichTextEditor';
import {
    Type, Image as ImageIcon, Video, Music, Tag, X, Search, Plus, ChevronLeft,
    AlertCircle, Upload, FileAudio, Loader, CheckCircle,
} from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
};

function genreAccent(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

interface Genre {
    id: string; name: string; slug: string; parentId: string | null;
    children: Genre[];
}
interface Community {
    id: string; name: string; slug: string; description: string | null; icon: string | null;
}

type MediaTab = 'none' | 'image' | 'video' | 'audio';

const RULES = [
    { n: 1, title: 'Be Respectful', body: 'No personal attacks, hate speech, or harassment. Critique the work, not the person.' },
    { n: 2, title: 'Stay On Topic', body: 'Posts should be relevant to the tagged genre(s). Off-topic posts may be removed.' },
    { n: 3, title: 'No Spam', body: 'Don\'t post the same content repeatedly or flood the feed with low-effort posts.' },
    { n: 4, title: 'Credit Your Sources', body: 'If sharing someone else\'s work, credit the original artist.' },
    { n: 5, title: 'Tag Accurately', body: 'Only add extra genres that genuinely fit your post — no genre-spamming.' },
];

export const FrontpageAltFCreatePost: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const sp = new URLSearchParams(location.search);
    const initialGenreId = sp.get('genreId') || '';
    const isCommunityKind = sp.get('kind') === 'community';
    const communityIdParam = sp.get('communityId') || '';

    const [genres, setGenres] = useState<Genre[]>([]);
    const [communities, setCommunities] = useState<Community[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [flair, setFlair] = useState('');
    const [mediaTab, setMediaTab] = useState<MediaTab>('none');
    const [imageUrl, setImageUrl] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [audioUrl, setAudioUrl] = useState('');
    const [primaryGenreId, setPrimaryGenreId] = useState(initialGenreId);
    const [extraGenreIds, setExtraGenreIds] = useState<string[]>([]);
    const [genreSearch, setGenreSearch] = useState('');
    const [showGenreSearch, setShowGenreSearch] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const genreSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isCommunityKind) {
            axios.get('/api/communities').then(r => setCommunities(arr(r.data))).catch(() => {});
        } else {
            axios.get('/api/musician/genres').then(r => setGenres(arr(r.data))).catch(() => {});
        }
    }, [isCommunityKind]);

    const activeCommunity = communities.find(c => c.id === communityIdParam) || null;

    // Close genre search on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (genreSearchRef.current && !genreSearchRef.current.contains(e.target as Node)) {
                setShowGenreSearch(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const allFlat = React.useMemo(() => {
        const flat: Genre[] = [];
        const walk = (gs: Genre[]) => gs.forEach(g => { flat.push(g); walk(g.children || []); });
        walk(genres);
        return flat;
    }, [genres]);

    const primaryGenre = allFlat.find(g => g.id === primaryGenreId) || null;

    const filteredGenres = React.useMemo(() => {
        const q = genreSearch.trim().toLowerCase();
        const excluded = new Set([primaryGenreId, ...extraGenreIds]);
        return allFlat.filter(g => !excluded.has(g.id) && (!q || g.name.toLowerCase().includes(q))).slice(0, 12);
    }, [allFlat, genreSearch, primaryGenreId, extraGenreIds]);

    const addExtraGenre = (id: string) => {
        if (extraGenreIds.length >= 2) return;
        setExtraGenreIds(prev => [...prev, id]);
        setGenreSearch('');
        setShowGenreSearch(false);
    };

    const removeExtraGenre = (id: string) => setExtraGenreIds(prev => prev.filter(x => x !== id));

    const uploadMedia = async (file: File, type: 'image' | 'audio') => {
        setUploading(true);
        setUploadProgress(`Uploading ${type}…`);
        try {
            const fd = new FormData();
            const fieldPrefix = isCommunityKind ? 'communityPost' : 'genrePost';
            fd.append(type === 'image' ? `${fieldPrefix}Image` : `${fieldPrefix}Audio`, file);
            const r = await axios.post(isCommunityKind ? '/api/community-posts/upload-media' : '/api/genre-posts/upload-media', fd, { withCredentials: true });
            if (type === 'image') setImageUrl(r.data.url);
            else setAudioUrl(r.data.url);
            setUploadProgress('');
        } catch (e: any) {
            setError(e?.response?.data?.error ?? 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
        if (file.size > 20 * 1024 * 1024) { setError('Image must be under 20MB'); return; }
        uploadMedia(file, 'image');
    };

    const handleAudioFile = (file: File) => {
        if (!file.type.startsWith('audio/')) { setError('Please select an audio file'); return; }
        if (file.size > 100 * 1024 * 1024) { setError('Audio must be under 100MB'); return; }
        uploadMedia(file, 'audio');
    };

    const handleImageUploadForEditor = async (file: File): Promise<string> => {
        const fd = new FormData();
        fd.append(isCommunityKind ? 'communityPostImage' : 'genrePostImage', file);
        const r = await axios.post(isCommunityKind ? '/api/community-posts/upload-media' : '/api/genre-posts/upload-media', fd, { withCredentials: true });
        return r.data.url;
    };

    const submit = async () => {
        setError('');
        if (isCommunityKind) {
            if (!activeCommunity) { setError('Community not found'); return; }
        } else if (!primaryGenreId) { setError('Please select a primary genre'); return; }
        if (!title.trim()) { setError('Title is required'); return; }
        if (title.length > 300) { setError('Title must be 300 characters or fewer'); return; }
        setSubmitting(true);
        try {
            const payload: any = isCommunityKind
                ? { communityId: activeCommunity!.id, title: title.trim(), body: body || undefined, flair: flair.trim() || undefined }
                : { genreId: primaryGenreId, title: title.trim(), body: body || undefined, flair: flair.trim() || undefined, extraGenreIds };
            if (mediaTab === 'image' && imageUrl) payload.imageUrl = imageUrl;
            if (mediaTab === 'video' && videoUrl.trim()) payload.videoUrl = videoUrl.trim();
            if (mediaTab === 'audio' && audioUrl) payload.audioUrl = audioUrl;
            const r = await axios.post(isCommunityKind ? '/api/community-posts' : '/api/genre-posts', payload, { withCredentials: true });
            navigate(`/post/${r.data.id}${isCommunityKind ? '?kind=community' : ''}`);
        } catch (e: any) {
            setError(e?.response?.data?.error ?? 'Failed to post. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const breadcrumb = isCommunityKind
        ? [
            { label: 'Genres', to: '/genres' },
            ...(activeCommunity ? [{ label: activeCommunity.name, to: `/genres/${activeCommunity.slug}?kind=community` }] : []),
            { label: 'Create Post' },
        ]
        : [
            { label: 'Genres', to: '/genres' },
            ...(primaryGenre ? [{ label: primaryGenre.name, to: `/genres/${primaryGenre.slug}` }] : []),
            { label: 'Create Post' },
        ];

    const canPost = !submitting && !uploading && (isCommunityKind ? !!activeCommunity : !!primaryGenreId) && title.trim().length > 0;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={breadcrumb} />

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 24px 64px', boxSizing: 'border-box' }}>

                        {/* Back link */}
                        <Link to={isCommunityKind ? (activeCommunity ? `/genres/${activeCommunity.slug}?kind=community` : '/genres') : (primaryGenre ? `/genres/${primaryGenre.slug}` : '/genres')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: SUB, textDecoration: 'none', marginBottom: 20 }}
                            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                            onMouseLeave={e => (e.currentTarget.style.color = SUB)}>
                            <ChevronLeft size={14} /> Back to {isCommunityKind ? (activeCommunity?.name ?? 'Genres') : (primaryGenre?.name ?? 'Genres')}
                        </Link>

                        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                            {/* ── Left: Form ── */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* Posting in (community mode) */}
                                {isCommunityKind && activeCommunity && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: S_CONT, borderRadius: 10, border: `1px solid ${PRIMARY}44` }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIMARY, flexShrink: 0 }} />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{activeCommunity.icon ? `${activeCommunity.icon} ` : ''}{activeCommunity.name}</span>
                                        <span style={{ fontSize: 11, color: SUB }}>· Community</span>
                                    </div>
                                )}

                                {/* Primary genre selector (if none pre-selected) */}
                                {!isCommunityKind && !initialGenreId && (
                                    <div style={{ ...glass, borderRadius: 14, padding: '16px 18px' }}>
                                        <label style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Primary Genre</label>
                                        <select value={primaryGenreId} onChange={e => setPrimaryGenreId(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: primaryGenreId ? TEXT : SUB, fontSize: 14, fontFamily: FONT, outline: 'none', appearance: 'none' }}>
                                            <option value="">Select a genre…</option>
                                            {allFlat.map(g => <option key={g.id} value={g.id}>{g.parentId ? `  ${g.name}` : g.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {!isCommunityKind && primaryGenre && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: S_CONT, borderRadius: 10, border: `1px solid ${genreAccent(primaryGenre.name)}44` }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: genreAccent(primaryGenre.name), flexShrink: 0 }} />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: genreAccent(primaryGenre.name) }}>{primaryGenre.name}</span>
                                        <span style={{ fontSize: 11, color: SUB }}>· Primary genre</span>
                                    </div>
                                )}

                                {/* Title */}
                                <div style={{ ...glass, borderRadius: 14, padding: '16px 18px' }}>
                                    <label style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Title</label>
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        maxLength={300}
                                        placeholder="An interesting title…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 15, fontFamily: FONT, outline: 'none', fontWeight: 600 }}
                                    />
                                    <div style={{ fontSize: 11, color: title.length > 270 ? TERTIARY : SUB, textAlign: 'right', marginTop: 5 }}>{title.length}/300</div>
                                </div>

                                {/* Flair */}
                                <div style={{ ...glass, borderRadius: 14, padding: '16px 18px' }}>
                                    <label style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                                        Flair <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span>
                                    </label>
                                    <input
                                        value={flair}
                                        onChange={e => setFlair(e.target.value)}
                                        maxLength={50}
                                        placeholder="e.g. Question, Showcase, Tutorial, Feedback…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none' }}
                                    />
                                </div>

                                {/* Media type tabs */}
                                <div style={{ ...glass, borderRadius: 14, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
                                        {([
                                            { id: 'none', label: 'Text', icon: Type },
                                            { id: 'image', label: 'Image', icon: ImageIcon },
                                            { id: 'video', label: 'Video', icon: Video },
                                            { id: 'audio', label: 'Audio', icon: Music },
                                        ] as const).map(({ id, label, icon: Icon }) => (
                                            <button key={id} onClick={() => setMediaTab(id)}
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', border: 'none', borderBottom: `2px solid ${mediaTab === id ? PRIMARY : 'transparent'}`, background: mediaTab === id ? `${PRIMARY}0d` : 'none', color: mediaTab === id ? PRIMARY : SUB, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, transition: 'all 0.15s', marginBottom: -1 }}>
                                                <Icon size={14} /> {label}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ padding: '18px' }}>
                                        {/* Image upload */}
                                        {mediaTab === 'image' && (
                                            <div>
                                                {imageUrl ? (
                                                    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                                                        <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
                                                        <button onClick={() => setImageUrl('')}
                                                            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => imageInputRef.current?.click()}
                                                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                                        onDragLeave={() => setDragOver(false)}
                                                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                                                        style={{ border: `2px dashed ${dragOver ? PRIMARY : BORDER}`, borderRadius: 10, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? `${PRIMARY}08` : 'none', transition: 'all 0.15s' }}>
                                                        {uploading ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                                                <Loader size={24} color={PRIMARY} style={{ animation: 'spin 1s linear infinite' }} />
                                                                <span style={{ fontSize: 13, color: SUB }}>{uploadProgress}</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Upload size={28} color={SUB} style={{ marginBottom: 10 }} />
                                                                <div style={{ fontSize: 14, color: TEXT, fontWeight: 600, marginBottom: 4 }}>Drop an image here or click to browse</div>
                                                                <div style={{ fontSize: 12, color: SUB }}>PNG, JPG, GIF, WebP · Max 20MB</div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />
                                            </div>
                                        )}

                                        {/* Video URL */}
                                        {mediaTab === 'video' && (
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 700, color: SUB, display: 'block', marginBottom: 8 }}>Video URL</label>
                                                <input
                                                    value={videoUrl}
                                                    onChange={e => setVideoUrl(e.target.value)}
                                                    placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
                                                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 14, fontFamily: FONT, outline: 'none', marginBottom: 8 }}
                                                />
                                                {videoUrl && (() => {
                                                    const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                                                    if (ytMatch) return (
                                                        <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', background: S_CONT }}>
                                                            <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title="Preview" />
                                                        </div>
                                                    );
                                                    return <div style={{ fontSize: 12, color: SECONDARY }}>✓ URL saved — will show as video player on post</div>;
                                                })()}
                                            </div>
                                        )}

                                        {/* Audio upload */}
                                        {mediaTab === 'audio' && (
                                            <div>
                                                {audioUrl ? (
                                                    <div style={{ background: S_CONT, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                        <FileAudio size={20} color={SECONDARY} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <audio src={audioUrl} controls style={{ width: '100%', height: 36 }} />
                                                        </div>
                                                        <button onClick={() => setAudioUrl('')}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 0, display: 'flex' }}>
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div onClick={() => audioInputRef.current?.click()}
                                                        style={{ border: `2px dashed ${BORDER}`, borderRadius: 10, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.borderColor = `${PRIMARY}66`)}
                                                        onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                                                        {uploading ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                                                <Loader size={24} color={PRIMARY} style={{ animation: 'spin 1s linear infinite' }} />
                                                                <span style={{ fontSize: 13, color: SUB }}>{uploadProgress}</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <FileAudio size={28} color={SUB} style={{ marginBottom: 10 }} />
                                                                <div style={{ fontSize: 14, color: TEXT, fontWeight: 600, marginBottom: 4 }}>Click to upload audio</div>
                                                                <div style={{ fontSize: 12, color: SUB }}>MP3, WAV, OGG, FLAC · Max 100MB</div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
                                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); e.target.value = ''; }} />
                                            </div>
                                        )}

                                        {/* Body (always shown below media) */}
                                        <div style={{ marginTop: mediaTab !== 'none' ? 16 : 0 }}>
                                            {mediaTab === 'none' && (
                                                <label style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>
                                                    Body <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span>
                                                </label>
                                            )}
                                            {mediaTab !== 'none' && (
                                                <label style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>
                                                    Caption / Description <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span>
                                                </label>
                                            )}
                                            <RichTextEditor
                                                value={body}
                                                onChange={setBody}
                                                onImageUpload={handleImageUploadForEditor}
                                                placeholder="Share your thoughts, tips, or context…"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Extra genre tags */}
                                {!isCommunityKind && (
                                <div style={{ ...glass, borderRadius: 14, padding: '16px 18px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <label style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Tag size={11} /> Also post in
                                        </label>
                                        <span style={{ fontSize: 11, color: extraGenreIds.length >= 2 ? TERTIARY : SUB }}>{extraGenreIds.length}/2 genres</span>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: extraGenreIds.length > 0 ? 10 : 0 }}>
                                        {extraGenreIds.map(id => {
                                            const g = allFlat.find(x => x.id === id);
                                            if (!g) return null;
                                            const accent = genreAccent(g.name);
                                            return (
                                                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, fontSize: 12, fontWeight: 700 }}>
                                                    {g.name}
                                                    <button onClick={() => removeExtraGenre(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, padding: 0, display: 'flex', lineHeight: 0, opacity: 0.8 }}>
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {extraGenreIds.length < 2 && (
                                        <div ref={genreSearchRef} style={{ position: 'relative' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Search size={13} color={SUB} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input
                                                    value={genreSearch}
                                                    onChange={e => { setGenreSearch(e.target.value); setShowGenreSearch(true); }}
                                                    onFocus={() => setShowGenreSearch(true)}
                                                    placeholder="Search genres to add…"
                                                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px 9px 34px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, fontFamily: FONT, outline: 'none' }}
                                                />
                                            </div>
                                            {showGenreSearch && filteredGenres.length > 0 && (
                                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: 'rgba(18,22,34,0.97)', backdropFilter: 'blur(20px)', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                                    {filteredGenres.map(g => {
                                                        const accent = genreAccent(g.name);
                                                        return (
                                                            <button key={g.id} onClick={() => addExtraGenre(g.id)}
                                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: TEXT, fontFamily: FONT, fontSize: 13, textAlign: 'left', transition: 'background 0.1s' }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = S_HIGH)}
                                                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                                                                {g.name}
                                                                {g.parentId && <span style={{ fontSize: 11, color: SUB, marginLeft: 'auto' }}>subgenre</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `${TERTIARY}12`, border: `1px solid ${TERTIARY}44`, borderRadius: 10, color: TERTIARY, fontSize: 13 }}>
                                        <AlertCircle size={14} /> {error}
                                    </div>
                                )}
                            </div>

                            {/* ── Right: Rules + Post button ── */}
                            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* Post button */}
                                <button onClick={submit} disabled={!canPost}
                                    style={{ width: '100%', padding: '13px 0', background: canPost ? PRIMARY : S_CONT, border: `1px solid ${canPost ? PRIMARY : BORDER}`, borderRadius: 10, color: canPost ? '#fff' : SUB, cursor: canPost ? 'pointer' : 'not-allowed', fontFamily: FONT, fontSize: 15, fontWeight: 800, transition: 'all 0.15s', opacity: submitting ? 0.7 : 1, letterSpacing: '0.01em' }}>
                                    {submitting ? 'Posting…' : 'Post'}
                                </button>

                                {/* Community Rules */}
                                <div style={{ ...glass, borderRadius: 14, overflow: 'hidden' }}>
                                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <AlertCircle size={14} color={SECONDARY} />
                                        <span style={{ fontSize: 12, fontWeight: 800, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Community Rules</span>
                                    </div>
                                    <div style={{ padding: '8px 0' }}>
                                        {RULES.map(rule => (
                                            <div key={rule.n} style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}` }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 3, display: 'flex', gap: 7 }}>
                                                    <span style={{ color: PRIMARY, fontWeight: 800, minWidth: 16 }}>{rule.n}.</span>
                                                    {rule.title}
                                                </div>
                                                <div style={{ fontSize: 11, color: SUB, lineHeight: 1.5, paddingLeft: 23 }}>{rule.body}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Tips */}
                                <div style={{ ...glass, borderRadius: 14, padding: '14px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Posting Tips</div>
                                    <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {[
                                            'Use a descriptive title that tells people what to expect.',
                                            'Add a flair to help others find your post.',
                                            'Tag extra genres only if your post genuinely fits them.',
                                            'Images and audio make posts more engaging.',
                                        ].map((tip, i) => (
                                            <li key={i} style={{ fontSize: 11, color: SUB, lineHeight: 1.5 }}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
