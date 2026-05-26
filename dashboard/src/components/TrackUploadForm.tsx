import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
    Upload, X, Tag, FileAudio, Image as ImageIcon, Music, AlignLeft,
    Scale, Save, Crop, AlertCircle,
} from 'lucide-react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';

const API = import.meta.env.VITE_API_URL || '';

interface Genre { id: string; name: string; parentId: string | null; }

interface TrackUploadFormProps {
    /** When set, the upload is tagged as a battle submission and auto-linked
     *  to the battle after the track is created. */
    battleId?: string;
    /** When true, project file (.flp / .zip) is required (battle rule). */
    requireProjectFile?: boolean;
    /** Called with the newly-created track once everything succeeds. */
    onUploaded: (track: any) => void;
    onCancel: () => void;
    /** Optional override for the form heading. */
    titleOverride?: string;
    subtitleOverride?: string;
}

/* ─── shared styles (mirrors MyTracksPage) ─── */
const card: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.glassBorder}`,
    padding: '24px',
};
const label: React.CSSProperties = {
    fontSize: '12px', fontWeight: 500, color: colors.textSecondary,
    marginBottom: '6px', display: 'block',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
};
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box' as const,
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: borderRadius.sm,
    padding: '10px 12px',
    color: colors.textPrimary, fontSize: '14px', outline: 'none',
};
const fileZone: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
};
const fileZoneActive: React.CSSProperties = {
    ...fileZone,
    borderColor: colors.primary, borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.04)',
};
const fileZoneDragging: React.CSSProperties = {
    ...fileZone,
    borderColor: colors.primary, borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.1)',
    boxShadow: '0 0 0 3px rgba(16,185,129,0.15)',
};

const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
    <option key={`${note} Major`} value={`${note} Major`} style={{ backgroundColor: colors.surface }}>{note} Major</option>,
    <option key={`${note} Minor`} value={`${note} Minor`} style={{ backgroundColor: colors.surface }}>{note} Minor</option>,
]);

const VALID_TITLE_REGEX = /^[a-zA-Z0-9\s\-_.,!()\[\]'"]+$/;

export const TrackUploadForm: React.FC<TrackUploadFormProps> = ({
    battleId, requireProjectFile, onUploaded, onCancel, titleOverride, subtitleOverride,
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    /* ─── form state ─── */
    const [newTrack, setNewTrack] = useState({
        title: '', description: '', artist: '', album: '', year: '', bpm: '', key: '',
        isPublic: true, allowAudioDownload: true, allowProjectDownload: true, license: 'all-rights-reserved',
    });
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [artworkFile, setArtworkFile] = useState<File | null>(null);
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);
    const [tosAgreed, setTosAgreed] = useState(false);
    const [lyrics, setLyrics] = useState('');
    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [genreSearch, setGenreSearch] = useState('');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStage, setUploadStage] = useState<'uploading' | 'scanning' | 'converting' | null>(null);

    const [dragOver, setDragOver] = useState<'audio' | 'art' | 'project' | null>(null);
    const artworkInputRef = useRef<HTMLInputElement>(null);

    /* ─── crop ─── */
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropRect, setCropRect] = useState({ x: 0, y: 0, size: 200 });
    const cropImgRef = useRef<HTMLImageElement>(null);

    /* ─── load genres once ─── */
    useEffect(() => {
        axios.get('/api/musician/genres', { withCredentials: true })
            .then(res => setAllGenres(res.data || []))
            .catch(() => setAllGenres([]));
    }, []);

    const setField = (field: string, value: any) => setNewTrack(prev => ({ ...prev, [field]: value }));

    const handleArtworkSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError(`"${file.name}" is not an image. Use JPG, PNG, GIF, or WEBP.`);
            return;
        }
        setArtworkFile(file);
        const reader = new FileReader();
        reader.onload = e => setArtworkPreviewUrl(e.target?.result as string ?? null);
        reader.readAsDataURL(file);
    };

    const initCropRect = () => {
        requestAnimationFrame(() => {
            const img = cropImgRef.current;
            if (!img || img.clientWidth === 0) return;
            const w = img.clientWidth, h = img.clientHeight;
            const size = Math.min(w, h);
            setCropRect({ x: (w - size) / 2, y: (h - size) / 2, size });
        });
    };

    const applyCrop = () => {
        const img = cropImgRef.current;
        if (!img || !artworkPreviewUrl) return;
        const scale = img.naturalWidth / img.clientWidth;
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, cropRect.x * scale, cropRect.y * scale, cropRect.size * scale, cropRect.size * scale, 0, 0, 512, 512);
        setArtworkPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
        setShowCropModal(false);
        canvas.toBlob(blob => {
            if (!blob) return;
            setArtworkFile(new File([blob], 'artwork.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    };

    const handleCropMouseDown = (e: React.MouseEvent, corner: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
        e.preventDefault(); e.stopPropagation();
        const startRect = { ...cropRect };
        const startX = e.clientX, startY = e.clientY;
        const onMove = (me: MouseEvent) => {
            const img = cropImgRef.current; if (!img) return;
            const dx = me.clientX - startX, dy = me.clientY - startY;
            const imgW = img.clientWidth, imgH = img.clientHeight;
            if (corner === 'move') {
                setCropRect({ size: startRect.size, x: Math.max(0, Math.min(imgW - startRect.size, startRect.x + dx)), y: Math.max(0, Math.min(imgH - startRect.size, startRect.y + dy)) });
            } else if (corner === 'se') {
                const s = Math.max(50, Math.min(startRect.size + (dx + dy) / 2, Math.min(imgW - startRect.x, imgH - startRect.y)));
                setCropRect({ ...startRect, size: s });
            } else if (corner === 'nw') {
                const delta = -(dx + dy) / 2;
                const s = Math.max(50, Math.min(startRect.size + delta, Math.min(startRect.x + startRect.size, startRect.y + startRect.size)));
                setCropRect({ size: s, x: startRect.x + startRect.size - s, y: startRect.y + startRect.size - s });
            } else if (corner === 'ne') {
                const delta = (dx - dy) / 2;
                const s = Math.max(50, Math.min(startRect.size + delta, Math.min(imgW - startRect.x, startRect.y + startRect.size)));
                setCropRect({ size: s, x: startRect.x, y: startRect.y + startRect.size - s });
            } else if (corner === 'sw') {
                const delta = (-dx + dy) / 2;
                const s = Math.max(50, Math.min(startRect.size + delta, Math.min(startRect.x + startRect.size, imgH - startRect.y)));
                setCropRect({ size: s, x: startRect.x + startRect.size - s, y: startRect.y });
            }
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    /* ─── genre tag picker (parent-with-children supports the parent itself as a pickable option) ─── */
    const renderGenreTagPicker = () => {
        const childGenres = allGenres.filter(g => g.parentId);
        const parentGenres = allGenres.filter(g => !g.parentId);
        const parentsWithChildren = parentGenres.filter(p => childGenres.some(c => c.parentId === p.id));
        const standaloneGenres = parentGenres.filter(p => !childGenres.some(c => c.parentId === p.id));
        const matchesSearch = (g: Genre) => !genreSearch || g.name.toLowerCase().includes(genreSearch.toLowerCase());
        return (
            <div>
                <span style={label}><Tag size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Genre Tags</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', minHeight: '28px' }}>
                    {selectedGenres.length === 0 && (
                        <span style={{ fontSize: '12px', color: colors.textTertiary, fontStyle: 'italic' }}>No genres selected</span>
                    )}
                    {selectedGenres.map(gId => {
                        const genre = allGenres.find(g => g.id === gId);
                        return genre ? (
                            <span key={gId} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                backgroundColor: 'rgba(16,185,129,0.12)', padding: '3px 10px',
                                borderRadius: borderRadius.pill, fontSize: '12px', color: colors.primary, fontWeight: 500,
                            }}>
                                {genre.name}
                                <X size={11} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setSelectedGenres(prev => prev.filter(id => id !== gId))} />
                            </span>
                        ) : null;
                    })}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Search genres..." value={genreSearch} onChange={e => setGenreSearch(e.target.value)}
                        style={{ ...inputBase, flex: 1 }} />
                    <select value="" onChange={e => { if (e.target.value && !selectedGenres.includes(e.target.value)) { setSelectedGenres(prev => [...prev, e.target.value]); setGenreSearch(''); } }}
                        style={{ ...inputBase, flex: 1, cursor: 'pointer' }}>
                        <option value="" style={{ backgroundColor: colors.surface }}>Add genre...</option>
                        {standaloneGenres.filter(g => !selectedGenres.includes(g.id) && matchesSearch(g)).map(g => (
                            <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface }}>{g.name}</option>
                        ))}
                        {parentsWithChildren.map(parent => {
                            const children = childGenres.filter(c => c.parentId === parent.id && !selectedGenres.includes(c.id) && matchesSearch(c));
                            const parentMatch = !selectedGenres.includes(parent.id) && matchesSearch(parent);
                            if (children.length === 0 && !parentMatch) return null;
                            return (
                                <optgroup key={parent.id} label={parent.name} style={{ backgroundColor: colors.surface }}>
                                    {parentMatch && (
                                        <option value={parent.id} style={{ backgroundColor: colors.surface }}>All {parent.name}</option>
                                    )}
                                    {children.map(c => (
                                        <option key={c.id} value={c.id} style={{ backgroundColor: colors.surface }}>{c.name}</option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                </div>
            </div>
        );
    };

    /* ─── submit ─── */
    const handleSubmit = async () => {
        setError('');
        if (!audioFile) { setError('Please select an audio file.'); return; }
        if (audioFile.size > 300 * 1024 * 1024) {
            setError(`File "${audioFile.name}" is ${(audioFile.size / 1024 / 1024).toFixed(1)}MB — max allowed is 300MB.`);
            return;
        }
        if (!tosAgreed) { setError('You must confirm you own the rights to this audio.'); return; }
        if (battleId && requireProjectFile && !projectFile) {
            setError('This battle requires a project file (.flp or .zip).');
            return;
        }

        const formData = new FormData();
        formData.append('audio', audioFile);
        if (artworkFile) formData.append('artwork', artworkFile);
        if (projectFile) formData.append('project', projectFile);
        if (newTrack.title) formData.append('title', newTrack.title);
        if (newTrack.description) formData.append('description', newTrack.description);
        if (newTrack.artist) formData.append('artist', newTrack.artist);
        if (newTrack.album) formData.append('album', newTrack.album);
        if (newTrack.year) formData.append('year', newTrack.year);
        if (newTrack.bpm) formData.append('bpm', newTrack.bpm);
        if (newTrack.key) formData.append('key', newTrack.key);
        formData.append('isPublic', String(newTrack.isPublic));
        formData.append('allowAudioDownload', String(newTrack.allowAudioDownload));
        formData.append('allowProjectDownload', String(newTrack.allowProjectDownload));
        formData.append('license', newTrack.license);
        if (selectedGenres.length > 0) formData.append('genreIds', JSON.stringify(selectedGenres));
        // Tag the upload as a battle submission so the API skips the
        // generic "#new-tracks" Discord announcement (the BeatBattle
        // plugin will announce it in the battles channel instead).
        if (battleId) formData.append('battleId', battleId);

        setSaving(true);
        setUploadProgress(0);
        setUploadStage('uploading');
        let scanTimer: ReturnType<typeof setTimeout> | null = null;
        try {
            const res = await axios.post(`${API}/api/musician/tracks`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
                onUploadProgress: evt => {
                    if (evt.total) {
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        setUploadProgress(pct);
                        if (pct >= 100) {
                            setUploadStage('scanning');
                            scanTimer = setTimeout(() => setUploadStage('converting'), 4000);
                        }
                    }
                },
            });
            if (lyrics.trim()) {
                await axios.put(`${API}/api/musician/tracks/${res.data.id}/lyrics`, { lyrics: lyrics.trim(), lyricsSync: null }, { withCredentials: true }).catch(() => {});
            }
            // If this is a battle submission, link Track → Battle.
            if (battleId) {
                await axios.post(
                    `${API}/api/beat-battle/battles/${battleId}/submit`,
                    { trackId: res.data.id },
                    { withCredentials: true },
                );
            }
            onUploaded(res.data);
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Failed to upload track.');
        } finally {
            if (scanTimer) clearTimeout(scanTimer);
            setSaving(false);
            setUploadStage(null);
            setUploadProgress(0);
        }
    };

    const cornerHandle: React.CSSProperties = { position: 'absolute', width: '14px', height: '14px', backgroundColor: colors.primary, borderRadius: '2px' };

    return (
        <>
        {/* Crop Modal */}
        {showCropModal && artworkPreviewUrl && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div style={{ backgroundColor: colors.surface, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.textPrimary }}>Crop Artwork</h3>
                        <button onClick={() => setShowCropModal(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={20} /></button>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: colors.textSecondary }}>Drag the box to reposition. Drag corners to resize. Output will be 512×512.</p>
                    <div style={{ position: 'relative', display: 'inline-block', userSelect: 'none', width: '100%' }}>
                        <img ref={cropImgRef} src={artworkPreviewUrl} alt="crop" style={{ display: 'block', width: '100%', borderRadius: '8px' }} onLoad={initCropRect} />
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: cropRect.x, top: cropRect.y, width: cropRect.size, height: cropRect.size, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', border: '2px solid ' + colors.primary, pointerEvents: 'none' }} />
                        <div onMouseDown={e => handleCropMouseDown(e, 'move')} style={{ position: 'absolute', left: cropRect.x, top: cropRect.y, width: cropRect.size, height: cropRect.size, cursor: 'move' }} />
                        <div onMouseDown={e => handleCropMouseDown(e, 'nw')} style={{ ...cornerHandle, left: cropRect.x - 7, top: cropRect.y - 7, cursor: 'nw-resize' }} />
                        <div onMouseDown={e => handleCropMouseDown(e, 'ne')} style={{ ...cornerHandle, left: cropRect.x + cropRect.size - 7, top: cropRect.y - 7, cursor: 'ne-resize' }} />
                        <div onMouseDown={e => handleCropMouseDown(e, 'sw')} style={{ ...cornerHandle, left: cropRect.x - 7, top: cropRect.y + cropRect.size - 7, cursor: 'sw-resize' }} />
                        <div onMouseDown={e => handleCropMouseDown(e, 'se')} style={{ ...cornerHandle, left: cropRect.x + cropRect.size - 7, top: cropRect.y + cropRect.size - 7, cursor: 'se-resize' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button onClick={() => setShowCropModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.md, backgroundColor: 'transparent', color: colors.textSecondary, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                        <button onClick={applyCrop} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: borderRadius.md, backgroundColor: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>Apply Crop</button>
                    </div>
                </div>
            </div>
        )}

        <div style={{ ...card, marginBottom: '24px', borderColor: colors.primary, borderWidth: '1px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Upload size={20} color={colors.primary} />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                            {titleOverride || 'Upload New Track'}
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textTertiary }}>
                            {subtitleOverride || (battleId ? 'Submit your beat to the battle' : 'Share your music with the community')}
                        </p>
                    </div>
                </div>
                <button onClick={onCancel}
                    style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: '4px' }}>
                    <X size={20} />
                </button>
            </div>

            {error && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: borderRadius.md, color: colors.error, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {/* File zones */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <label
                    style={{ ...(dragOver === 'audio' ? fileZoneDragging : audioFile ? fileZoneActive : fileZone), gridColumn: isMobile ? undefined : '1 / -1' }}
                    onDragOver={e => { e.preventDefault(); setDragOver('audio'); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) setAudioFile(f); }}
                >
                    <div style={{
                        width: '40px', height: '40px', borderRadius: borderRadius.md,
                        backgroundColor: audioFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <FileAudio size={20} color={audioFile || dragOver === 'audio' ? colors.primary : colors.textTertiary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                            Audio File *
                        </div>
                        <div style={{ fontSize: '11px', color: audioFile ? colors.primary : dragOver === 'audio' ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {audioFile ? `${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)` : dragOver === 'audio' ? 'Drop to select' : 'Drop audio here or click — MP3, WAV, FLAC, OGG · Max 300MB'}
                        </div>
                    </div>
                    <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </label>

                {/* Artwork */}
                {artworkPreviewUrl ? (
                    <div style={{ ...fileZoneActive, alignItems: 'center' }}>
                        <img src={artworkPreviewUrl} alt="Artwork preview"
                            style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: borderRadius.sm, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.primary, marginBottom: '2px' }}>Artwork selected</div>
                            <div style={{ fontSize: '11px', color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artworkFile?.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button type="button" onClick={() => setShowCropModal(true)}
                                style={{ padding: '5px 10px', fontSize: '12px', fontWeight: 600, borderRadius: borderRadius.sm, border: `1px solid ${colors.primary}`, color: colors.primary, backgroundColor: 'rgba(16,185,129,0.08)', cursor: 'pointer' }}>
                                <Crop size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Crop
                            </button>
                            <button type="button" onClick={() => artworkInputRef.current?.click()}
                                style={{ padding: '5px 10px', fontSize: '12px', borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}`, color: colors.textSecondary, backgroundColor: 'transparent', cursor: 'pointer' }}>
                                Change
                            </button>
                            <button type="button" onClick={() => { setArtworkFile(null); setArtworkPreviewUrl(null); }}
                                style={{ padding: '5px 8px', fontSize: '12px', borderRadius: borderRadius.sm, border: `1px solid rgba(239,68,68,0.2)`, color: colors.error, backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <X size={12} />
                            </button>
                        </div>
                        <input ref={artworkInputRef} type="file" accept="image/*"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleArtworkSelect(f); e.target.value = ''; }}
                            style={{ display: 'none' }} />
                    </div>
                ) : (
                    <label
                        style={dragOver === 'art' ? fileZoneDragging : fileZone}
                        onDragOver={e => { e.preventDefault(); setDragOver('art'); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) handleArtworkSelect(f); }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ImageIcon size={20} color={dragOver === 'art' ? colors.primary : colors.textTertiary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>Artwork</div>
                            <div style={{ fontSize: '11px', color: dragOver === 'art' ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {dragOver === 'art' ? 'Drop to select' : 'Drop image here or click — JPG, PNG, GIF, WEBP'}
                            </div>
                        </div>
                        <input ref={artworkInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleArtworkSelect(f); }} style={{ display: 'none' }} />
                    </label>
                )}

                {/* Project file */}
                <label
                    style={dragOver === 'project' ? fileZoneDragging : projectFile ? fileZoneActive : fileZone}
                    onDragOver={e => { e.preventDefault(); setDragOver('project'); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) setProjectFile(f); }}
                >
                    <div style={{ width: '40px', height: '40px', borderRadius: borderRadius.md, backgroundColor: projectFile ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Music size={20} color={projectFile || dragOver === 'project' ? colors.primary : colors.textTertiary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                            FL Studio Project{battleId && requireProjectFile ? ' *' : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: projectFile ? colors.primary : dragOver === 'project' ? colors.primary : colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {projectFile ? projectFile.name : dragOver === 'project' ? 'Drop to select' : 'Drop .flp or .zip here or click'}
                        </div>
                    </div>
                    <input type="file" accept=".flp,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </label>
            </div>

            <p style={{ margin: '-8px 0 16px', fontSize: '11px', color: colors.textTertiary }}>
                Max 300MB. Large WAV files will be auto-converted to 320kbps MP3.
            </p>

            {projectFile?.name.endsWith('.zip') && (
                <p style={{ margin: '-8px 0 16px', fontSize: '11px', color: colors.textTertiary }}>
                    ZIP bundles are processed server-side to extract real waveforms from your samples.
                </p>
            )}

            {/* Metadata grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
                    <span style={label}>Track Title</span>
                    <input type="text" placeholder="Will use metadata/filename if empty" value={newTrack.title} onChange={e => setField('title', e.target.value)} style={inputBase} maxLength={100} />
                    {newTrack.title.length > 0 && !VALID_TITLE_REGEX.test(newTrack.title) && (
                        <span style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', display: 'block' }}>
                            Title contains unsupported characters (Hieroglyphs, Zalgo, etc.). Please use standard text.
                        </span>
                    )}
                </div>
                <div>
                    <span style={label}>Artist</span>
                    <input type="text" placeholder="Artist name" value={newTrack.artist} onChange={e => setField('artist', e.target.value)} style={inputBase} maxLength={100} />
                </div>
                <div>
                    <span style={label}>Album</span>
                    <input type="text" placeholder="Album / EP" value={newTrack.album} onChange={e => setField('album', e.target.value)} style={inputBase} />
                </div>
                <div>
                    <span style={label}>Year</span>
                    <input type="number" placeholder="2025" value={newTrack.year} onChange={e => setField('year', e.target.value)} style={inputBase} />
                </div>
                <div>
                    <span style={label}>BPM</span>
                    <input type="number" placeholder="120" value={newTrack.bpm} onChange={e => setField('bpm', e.target.value)} style={inputBase} />
                </div>
                <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
                    <span style={label}>Key</span>
                    <select value={newTrack.key} onChange={e => setField('key', e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                        <option value="" style={{ backgroundColor: colors.surface }}>Select key...</option>
                        {keyOptions}
                    </select>
                </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
                <span style={label}>Description</span>
                <textarea placeholder="Notes about this track..." value={newTrack.description} onChange={e => setField('description', e.target.value)}
                    style={{ ...inputBase, minHeight: '60px', resize: 'vertical' }} />
            </div>

            {/* Lyrics */}
            <div style={{ marginBottom: '20px' }}>
                <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlignLeft size={12} style={{ display: 'inline' }} /> Lyrics
                    <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 400, color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 }}>(optional — publicly visible on the track page)</span>
                </span>
                <textarea
                    placeholder={'Verse 1\nYour lyrics here...\n\nChorus\nSing along...'}
                    value={lyrics}
                    onChange={e => setLyrics(e.target.value)}
                    style={{ ...inputBase, minHeight: '120px', resize: 'vertical', lineHeight: 1.7 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textTertiary }}>
                    You can also sync each line to a timestamp from the track page after uploading.
                </p>
            </div>

            {/* Download permissions */}
            <div style={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px',
                padding: '14px 16px', borderRadius: borderRadius.md,
                backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '20px',
            }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '110px', paddingTop: '2px' }}>
                    Visibility
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: colors.textPrimary }}>
                    <input type="checkbox" checked={newTrack.isPublic} onChange={e => setField('isPublic', e.target.checked)}
                        style={{ accentColor: colors.primary, width: '16px', height: '16px' }} />
                    Public (visible to everyone)
                </label>
                <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '110px', paddingTop: '2px' }}>
                    Downloads
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: colors.textPrimary }}>
                    <input type="checkbox" checked={newTrack.allowAudioDownload} onChange={e => setField('allowAudioDownload', e.target.checked)}
                        style={{ accentColor: colors.primary, width: '16px', height: '16px' }} />
                    Allow audio download
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: colors.textPrimary }}>
                    <input type="checkbox" checked={newTrack.allowProjectDownload} onChange={e => setField('allowProjectDownload', e.target.checked)}
                        style={{ accentColor: colors.primary, width: '16px', height: '16px' }} />
                    Allow project download
                </label>
            </div>

            {/* License */}
            <div style={{
                padding: '14px 16px', borderRadius: borderRadius.md,
                backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <Scale size={14} color={colors.textSecondary} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>License</span>
                </div>
                <select value={newTrack.license} onChange={e => setField('license', e.target.value)}
                    style={{ ...inputBase, cursor: 'pointer', maxWidth: '360px' }}>
                    <option value="all-rights-reserved" style={{ backgroundColor: colors.surface }}>All Rights Reserved</option>
                    <option value="cc0" style={{ backgroundColor: colors.surface }}>CC0 — Public Domain</option>
                    <option value="cc-by" style={{ backgroundColor: colors.surface }}>CC BY — Attribution</option>
                    <option value="cc-by-sa" style={{ backgroundColor: colors.surface }}>CC BY-SA — Attribution ShareAlike</option>
                    <option value="cc-by-nc" style={{ backgroundColor: colors.surface }}>CC BY-NC — Attribution NonCommercial</option>
                    <option value="cc-by-nc-sa" style={{ backgroundColor: colors.surface }}>CC BY-NC-SA — Attribution NonCommercial ShareAlike</option>
                    <option value="cc-by-nd" style={{ backgroundColor: colors.surface }}>CC BY-ND — Attribution NoDerivs</option>
                    <option value="cc-by-nc-nd" style={{ backgroundColor: colors.surface }}>CC BY-NC-ND — Attribution NonCommercial NoDerivs</option>
                </select>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: colors.textTertiary, lineHeight: 1.5 }}>
                    {newTrack.license === 'all-rights-reserved'
                        ? 'Others cannot use, remix, or share this work without your permission.'
                        : newTrack.license === 'cc0'
                        ? 'You waive all rights. Anyone can use this work for any purpose.'
                        : 'Learn more at creativecommons.org/licenses'}
                </p>
            </div>

            {/* Genres */}
            <div style={{ marginBottom: '20px' }}>
                {renderGenreTagPicker()}
            </div>

            {/* AI music warning */}
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '14px 16px', borderRadius: borderRadius.md,
                backgroundColor: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)',
                marginBottom: '12px',
            }}>
                <AlertCircle size={16} color={colors.error} style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary, lineHeight: 1.6 }}>
                    <strong style={{ color: colors.error }}>AI-generated music is strictly forbidden.</strong>{' '}
                    Uploading music generated by AI tools (Suno, Udio, etc.) will result in the permanent termination of your account.
                    This platform is for human-made music only.
                </p>
            </div>

            {/* ToS */}
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '14px 16px', borderRadius: borderRadius.md,
                backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '20px',
            }}>
                <input type="checkbox" id="tos-agree-tuf" checked={tosAgreed} onChange={e => setTosAgreed(e.target.checked)}
                    style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: colors.primary }} />
                <label htmlFor="tos-agree-tuf" style={{ fontSize: '12px', color: colors.textSecondary, cursor: 'pointer', lineHeight: 1.6 }}>
                    I confirm I own or have the rights to all audio and content in this upload, that this is human-made music, and I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'underline' }}>
                        Terms of Service &amp; Privacy Policy
                    </a>.
                </label>
            </div>

            {/* Upload progress */}
            {saving && uploadStage && (
                <div style={{
                    marginBottom: '20px', padding: '14px 16px',
                    backgroundColor: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.2)`,
                    borderRadius: borderRadius.md,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                            {uploadStage === 'uploading' && `Uploading\u2026 ${uploadProgress}%`}
                            {uploadStage === 'scanning' && 'Scanning for viruses\u2026'}
                            {uploadStage === 'converting' && 'Converting & processing\u2026'}
                        </span>
                        <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                            {uploadStage === 'uploading' ? 'Transferring' : uploadStage === 'scanning' ? 'A few seconds' : 'Audio conversion'}
                        </span>
                    </div>
                    <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', backgroundColor: colors.primary, borderRadius: '2px',
                            transition: 'width 0.3s ease',
                            width: uploadStage === 'uploading' ? `${uploadProgress}%` : '100%',
                            opacity: uploadStage !== 'uploading' ? 0.6 : 1,
                            backgroundImage: uploadStage !== 'uploading' ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)' : 'none',
                            animation: uploadStage !== 'uploading' ? 'stripe-slide 1s linear infinite' : 'none',
                        }} />
                    </div>
                    <style>{`@keyframes stripe-slide { 0% { background-position: 0 0; } 100% { background-position: 32px 0; } }`}</style>
                </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={handleSubmit}
                    disabled={saving || !audioFile || !tosAgreed || (newTrack.title.length > 0 && !VALID_TITLE_REGEX.test(newTrack.title))}
                    style={{
                        flex: 1, padding: '12px', backgroundColor: colors.primary, color: 'white',
                        border: 'none', borderRadius: borderRadius.md,
                        cursor: (saving || !audioFile || !tosAgreed || (newTrack.title.length > 0 && !VALID_TITLE_REGEX.test(newTrack.title))) ? 'not-allowed' : 'pointer',
                        fontWeight: 700, fontSize: '14px',
                        opacity: (saving || !audioFile || !tosAgreed || (newTrack.title.length > 0 && !VALID_TITLE_REGEX.test(newTrack.title))) ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: shadows.glow,
                    }}
                >
                    {saving ? 'Processing...' : <><Upload size={16} /> {battleId ? 'Submit to Battle' : 'Upload Track'}</>}
                </button>
                <button
                    onClick={onCancel}
                    disabled={saving}
                    style={{
                        padding: '12px 24px', backgroundColor: 'transparent', color: colors.textSecondary,
                        border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.md,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
        </>
    );
};
