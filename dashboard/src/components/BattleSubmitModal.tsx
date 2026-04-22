import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { X, Upload, Music, Check, Loader2, Library, FileArchive, Image, AlertCircle, Crop } from 'lucide-react';
import { useAuth } from './AuthProvider';

const API = import.meta.env.VITE_API_URL || '';

// ─── File zone styles (matching MyTracksPage) ────────────────────────────────
const fileZone: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
    userSelect: 'none',
};
const fileZoneActive: React.CSSProperties = {
    ...fileZone,
    borderColor: colors.primary,
    borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.04)',
};
const fileZoneDragging: React.CSSProperties = {
    ...fileZone,
    borderColor: colors.primary,
    borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.1)',
    boxShadow: '0 0 0 3px rgba(16,185,129,0.15)',
};

interface LibraryTrack {
    id: string;
    title: string;
    url: string;
    coverUrl: string | null;
    duration: number | null;
    artist: string;
    projectFileUrl: string | null;
}

interface BattleSubmitModalProps {
    battleId: string;
    requireProjectFile?: boolean;
    open: boolean;
    onClose: () => void;
    onSubmitted: () => void;
}

type Tab = 'upload' | 'library';

export const BattleSubmitModal: React.FC<BattleSubmitModalProps> = ({ battleId, requireProjectFile, open, onClose, onSubmitted }) => {
    const { isGuildMember } = useAuth();
    const [tab, setTab] = useState<Tab>('upload');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStage, setUploadStage] = useState<'uploading' | 'scanning' | 'converting' | null>(null);

    // Upload tab
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [artist, setArtist] = useState('');
    const [bpm, setBpm] = useState('');
    const [key, setKey] = useState('');
    const [tosAgreed, setTosAgreed] = useState(false);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string>('');
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const audioRef = useRef<HTMLInputElement>(null);
    const coverRef = useRef<HTMLInputElement>(null);
    const projectRef = useRef<HTMLInputElement>(null);

    // Drag-and-drop
    const [dragOver, setDragOver] = useState<'audio' | 'art' | 'project' | null>(null);

    // Artwork crop
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropRect, setCropRect] = useState({ x: 0, y: 0, size: 200 });
    const cropImgRef = useRef<HTMLImageElement>(null);

    const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
        <option key={`${note} Major`} value={`${note} Major`} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{note} Major</option>,
        <option key={`${note} Minor`} value={`${note} Minor`} style={{ color: 'white', backgroundColor: '#1A1E2E' }}>{note} Minor</option>,
    ]);

    // Library tab
    const [tracks, setTracks] = useState<LibraryTrack[]>([]);
    const [tracksLoading, setTracksLoading] = useState(false);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
    const [libraryDescription, setLibraryDescription] = useState('');

    useEffect(() => {
        if (open && tab === 'library') fetchTracks();
    }, [open, tab]);

    useEffect(() => {
        if (open) {
            setError('');
            setSubmitting(false);
            setUploadProgress(0);
            setUploadStage(null);
        }
    }, [open]);

    const handleCoverSelect = (file: File) => {
        setCoverFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setCoverPreview(e.target?.result as string ?? '');
        reader.readAsDataURL(file);
    };

    const initCropRect = () => {
        requestAnimationFrame(() => {
            const img = cropImgRef.current;
            if (!img || img.clientWidth === 0) return;
            const w = img.clientWidth; const h = img.clientHeight;
            const size = Math.min(w, h);
            setCropRect({ x: (w - size) / 2, y: (h - size) / 2, size });
        });
    };

    const applyCrop = () => {
        const img = cropImgRef.current;
        if (!img || !coverPreview) return;
        const scale = img.naturalWidth / img.clientWidth;
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, cropRect.x * scale, cropRect.y * scale, cropRect.size * scale, cropRect.size * scale, 0, 0, 512, 512);
        setCoverPreview(canvas.toDataURL('image/jpeg', 0.92));
        setShowCropModal(false);
        canvas.toBlob(blob => {
            if (!blob) return;
            setCoverFile(new File([blob], 'artwork.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    };

    const handleCropMouseDown = (e: React.MouseEvent, corner: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
        e.preventDefault(); e.stopPropagation();
        const startRect = { ...cropRect };
        const startX = e.clientX; const startY = e.clientY;
        const onMove = (me: MouseEvent) => {
            const img = cropImgRef.current; if (!img) return;
            const dx = me.clientX - startX; const dy = me.clientY - startY;
            const imgW = img.clientWidth; const imgH = img.clientHeight;
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

    const fetchTracks = async () => {
        setTracksLoading(true);
        try {
            const res = await fetch(`${API}/api/beat-battle/my-tracks`, { credentials: 'include' });
            if (res.ok) setTracks(await res.json());
            else setTracks([]);
        } catch {
            setTracks([]);
        } finally { setTracksLoading(false); }
    };

    const handleSubmit = async () => {
        setError('');
        setSubmitting(true);
        setUploadProgress(0);
        setUploadStage(null);
        let scanTimer: ReturnType<typeof setTimeout> | null = null;

        try {
            let trackId: string;

            if (tab === 'library') {
                if (!selectedTrackId) { setError('Select a track from your library.'); setSubmitting(false); return; }
                const selectedTrack = tracks.find(t => t.id === selectedTrackId);
                const trackHasProject = !!selectedTrack?.projectFileUrl;
                if (requireProjectFile && !trackHasProject) {
                    setError('This battle requires a project file. The selected track has none — add one to your track page first.');
                    setSubmitting(false);
                    return;
                }
                trackId = selectedTrackId;
            } else {
                // Upload tab: first upload as a regular Track to the user's library, then submit it.
                if (!audioFile) { setError('Please select an audio file.'); setSubmitting(false); return; }
                if (!title.trim()) { setError('Please enter a track title.'); setSubmitting(false); return; }
                if (!tosAgreed) { setError('You must confirm you own the rights to this audio.'); setSubmitting(false); return; }
                if (requireProjectFile && !projectFile) { setError('This battle requires a project file (.flp or .zip).'); setSubmitting(false); return; }

                const formData = new FormData();
                formData.append('audio', audioFile);
                formData.append('title', title.trim());
                if (description.trim()) formData.append('description', description.trim());
                if (artist.trim()) formData.append('artist', artist.trim());
                if (bpm) formData.append('bpm', bpm);
                if (key) formData.append('key', key);
                if (coverFile) formData.append('artwork', coverFile);
                if (projectFile) formData.append('project', projectFile);

                setUploadStage('uploading');
                const uploadRes = await axios.post(`${API}/api/musician/tracks`, formData, {
                    withCredentials: true,
                    onUploadProgress: (evt) => {
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
                trackId = uploadRes.data?.id;
                if (!trackId) throw new Error('Upload succeeded but no track id was returned.');
            }

            // Link Track → Battle (the new slim submit endpoint)
            await axios.post(
                `${API}/api/beat-battle/battles/${battleId}/submit`,
                { trackId },
                { withCredentials: true },
            );

            onSubmitted();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Something went wrong');
        } finally {
            if (scanTimer) clearTimeout(scanTimer);
            setSubmitting(false);
            setUploadStage(null);
            setUploadProgress(0);
        }
    };

    if (!open) return null;

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' };
    const labelStyle: React.CSSProperties = { display: 'block', color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '6px' };
    const cornerHandle: React.CSSProperties = { position: 'absolute', width: '14px', height: '14px', backgroundColor: colors.primary, borderRadius: '2px' };

    return (
        <>
        {/* Crop Modal */}
        {showCropModal && coverPreview && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div style={{ backgroundColor: colors.surface, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.textPrimary }}>Crop Artwork</h3>
                        <button onClick={() => setShowCropModal(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={20} /></button>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: colors.textSecondary }}>Drag the box to reposition. Drag corners to resize. Output will be 512×512.</p>
                    <div style={{ position: 'relative', display: 'inline-block', userSelect: 'none', width: '100%' }}>
                        <img ref={cropImgRef} src={coverPreview} alt="crop" style={{ display: 'block', width: '100%', borderRadius: '8px' }} onLoad={initCropRect} />
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

        {/* Main Modal */}
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
            <div style={{ backgroundColor: colors.surface, borderRadius: '14px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

                {/* Hidden file inputs */}
                <input ref={audioRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setAudioFile(f); }} />
                <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverSelect(f); }} />
                <input ref={projectRef} type="file" accept=".flp,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setProjectFile(f); }} />

                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px', fontWeight: 700 }}>Submit Your Beat</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                </div>

                {!isGuildMember ? (
                    <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                        <AlertCircle size={40} color="#FBBF24" style={{ marginBottom: '16px' }} />
                        <h3 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: '16px' }}>Discord Server Membership Required</h3>
                        <p style={{ margin: '0 0 20px', color: colors.textSecondary, fontSize: '14px', lineHeight: 1.6 }}>You must be a member of our Discord server to submit battle entries.</p>
                        <a href="https://discord.gg/flstudio" target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: '#5865F2', color: 'white', borderRadius: borderRadius.md, textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                            Join Discord Server
                        </a>
                        <p style={{ margin: '16px 0 0', color: colors.textSecondary, fontSize: '12px' }}>After joining, log out and back in to refresh your session.</p>
                    </div>
                ) : (<>

                {/* Tab bar */}
                <div style={{ display: 'flex', padding: '12px 24px 0', gap: '8px' }}>
                    {([['upload', Upload, 'Upload New'] as const, ['library', Library, 'My Library'] as const]).map(([k, Icon, lbl]) => (
                        <button key={k} onClick={() => setTab(k)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: borderRadius.md, border: tab === k ? `1px solid ${colors.primary}` : '1px solid rgba(255,255,255,0.08)', backgroundColor: tab === k ? `${colors.primary}15` : 'transparent', color: tab === k ? colors.primary : colors.textSecondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            <Icon size={14} /> {lbl}
                        </button>
                    ))}
                </div>

                <div style={{ padding: '20px 24px 24px' }}>
                    {error && (
                        <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: borderRadius.md, color: colors.error, fontSize: '13px', marginBottom: '16px' }}>
                            {error}
                        </div>
                    )}

                    {tab === 'upload' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Audio drop zone — full width */}
                            <div>
                                <label style={labelStyle}>Audio File * (MP3, WAV, FLAC, OGG…)</label>
                                <label
                                    style={dragOver === 'audio' ? fileZoneDragging : audioFile ? fileZoneActive : fileZone}
                                    onDragOver={e => { e.preventDefault(); setDragOver('audio'); }}
                                    onDragLeave={() => setDragOver(null)}
                                    onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) setAudioFile(f); }}
                                    onClick={() => audioRef.current?.click()}
                                >
                                    <Music size={18} color={audioFile ? colors.primary : colors.textSecondary} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: audioFile ? colors.textPrimary : colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {audioFile ? audioFile.name : 'Drop audio file here or click to browse'}
                                        </p>
                                        {!audioFile && <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textSecondary, opacity: 0.6 }}>MP3, WAV, FLAC, OGG, AIFF · Max 300MB</p>}
                                    </div>
                                    {audioFile && <Check size={16} color={colors.primary} style={{ flexShrink: 0 }} />}
                                </label>
                            </div>

                            {/* Artwork + Project side by side */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Cover Art</label>
                                    <label
                                        style={{ ...(dragOver === 'art' ? fileZoneDragging : coverFile ? fileZoneActive : fileZone), flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90px', padding: '12px', gap: '6px' }}
                                        onDragOver={e => { e.preventDefault(); setDragOver('art'); }}
                                        onDragLeave={() => setDragOver(null)}
                                        onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) handleCoverSelect(f); }}
                                        onClick={() => coverRef.current?.click()}
                                    >
                                        {coverPreview ? (
                                            <>
                                                <img src={coverPreview} alt="" style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover' }} />
                                                <p style={{ margin: 0, fontSize: '10px', color: colors.primary, fontWeight: 600 }}>Click to change</p>
                                            </>
                                        ) : (
                                            <>
                                                <Image size={20} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                                <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary, textAlign: 'center', opacity: 0.6 }}>Drop image or click</p>
                                            </>
                                        )}
                                    </label>
                                    {coverPreview && (
                                        <button onClick={() => { setShowCropModal(true); initCropRect(); }}
                                            style={{ marginTop: '6px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.03)', color: colors.textSecondary, cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                            <Crop size={12} /> Crop Artwork
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <label style={labelStyle}>Project File{requireProjectFile ? ' *' : ''} (.flp, .zip)</label>
                                    <label
                                        style={{ ...(dragOver === 'project' ? fileZoneDragging : projectFile ? fileZoneActive : fileZone), flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90px', padding: '12px', gap: '6px' }}
                                        onDragOver={e => { e.preventDefault(); setDragOver('project'); }}
                                        onDragLeave={() => setDragOver(null)}
                                        onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files?.[0]; if (f) setProjectFile(f); }}
                                        onClick={() => projectRef.current?.click()}
                                    >
                                        {projectFile ? (
                                            <>
                                                <Check size={20} color={colors.primary} />
                                                <p style={{ margin: 0, fontSize: '10px', color: colors.primary, fontWeight: 600, textAlign: 'center', wordBreak: 'break-all' }}>{projectFile.name}</p>
                                            </>
                                        ) : (
                                            <>
                                                <FileArchive size={20} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                                <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary, textAlign: 'center', opacity: 0.6 }}>{requireProjectFile ? 'Required' : 'Optional'}</p>
                                            </>
                                        )}
                                    </label>
                                    {requireProjectFile && !projectFile && (
                                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#F97316' }}>Required for this battle</p>
                                    )}
                                </div>
                            </div>

                            {/* Title + Description */}
                            <div>
                                <label style={labelStyle}>Track Title *</label>
                                <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="My Beat" />
                            </div>
                            <div>
                                <label style={labelStyle}>Description</label>
                                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell us about this beat..." rows={2} />
                            </div>

                            {/* Artist / BPM / Key */}
                            <div>
                                <label style={labelStyle}>Artist / Producer Name</label>
                                <input style={inputStyle} value={artist} onChange={e => setArtist(e.target.value)} placeholder="Your producer name" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>BPM</label>
                                    <input type="number" style={inputStyle} value={bpm} onChange={e => setBpm(e.target.value)} placeholder="140" min={1} max={999} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Key</label>
                                    <select style={inputStyle} value={key} onChange={e => setKey(e.target.value)}>
                                        <option value="" style={{ color: 'white', backgroundColor: '#1A1E2E' }}>Select key...</option>
                                        {keyOptions}
                                    </select>
                                </div>
                            </div>

                            {/* ToS */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.07)' }}>
                                <input type="checkbox" id="battle-tos" checked={tosAgreed} onChange={e => setTosAgreed(e.target.checked)} style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: colors.primary }} />
                                <label htmlFor="battle-tos" style={{ fontSize: '12px', color: colors.textSecondary, cursor: 'pointer', lineHeight: 1.5 }}>
                                    I confirm I own or have the rights to all audio in this submission and agree to the{' '}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'underline' }}>Terms of Service</a>.
                                </label>
                            </div>
                        </div>
                    )}

                    {tab === 'library' && (
                        <div>
                            {tracksLoading ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
                                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                                    <p style={{ margin: '8px 0 0', fontSize: '13px' }}>Loading your tracks...</p>
                                </div>
                            ) : tracks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
                                    <Music size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                    <p style={{ margin: 0, fontSize: '13px' }}>No tracks in your library.</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.6 }}>Upload a track to your profile first, or use the "Upload New" tab.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                                    {tracks.map(t => {
                                        const selected = selectedTrackId === t.id;
                                        return (
                                            <button key={t.id} onClick={() => setSelectedTrackId(selected ? null : t.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: borderRadius.md, border: selected ? `1px solid ${colors.primary}` : '1px solid rgba(255,255,255,0.06)', backgroundColor: selected ? `${colors.primary}12` : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', width: '100%', color: colors.textPrimary }}>
                                                {t.coverUrl ? (
                                                    <img src={t.coverUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                                                ) : (
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Music size={16} color={colors.textSecondary} /></div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textSecondary }}>{t.artist}</p>
                                                </div>
                                                {selected && <Check size={16} color={colors.primary} style={{ flexShrink: 0 }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {!tracksLoading && tracks.length > 0 && (
                                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={labelStyle}>Description</label>
                                        <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} value={libraryDescription} onChange={e => setLibraryDescription(e.target.value)} placeholder="Tell us about this beat..." rows={2} />
                                    </div>
                                    {selectedTrackId && (() => {
                                        const sel = tracks.find(t => t.id === selectedTrackId);
                                        if (sel?.projectFileUrl) {
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: borderRadius.md }}>
                                                    <Check size={15} color="#34D399" style={{ flexShrink: 0 }} />
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#34D399' }}>Project file included</p>
                                                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textSecondary }}>This track already has a project file — no upload needed.</p>
                                                    </div>
                                                </div>
                                            );
                                        } else if (requireProjectFile) {
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: borderRadius.md }}>
                                                    <AlertCircle size={15} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#EF4444' }}>Can't submit this track</p>
                                                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textSecondary }}>This battle requires a project file, but this track doesn't have one. Add it from your track page first.</p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload progress */}
                    {submitting && uploadStage && (
                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(43,140,113,0.08)', border: '1px solid rgba(43,140,113,0.25)', borderRadius: borderRadius.md }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.primary }}>
                                    {uploadStage === 'uploading' ? `Uploading… ${uploadProgress}%` : uploadStage === 'scanning' ? '🔍 Scanning…' : '⚙️ Converting…'}
                                </span>
                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                                    {uploadStage === 'uploading' ? 'Transferring to server' : uploadStage === 'scanning' ? 'Checking for malware' : 'Optimizing audio & artwork'}
                                </span>
                            </div>
                            <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', backgroundColor: colors.primary, borderRadius: '3px', transition: 'width 0.3s ease', width: uploadStage === 'uploading' ? `${uploadProgress}%` : '100%', opacity: uploadStage !== 'uploading' ? 0.6 : 1, backgroundImage: uploadStage !== 'uploading' ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)' : 'none', animation: uploadStage !== 'uploading' ? 'stripe-slide 1s linear infinite' : 'none', backgroundSize: '32px 32px' }} />
                            </div>
                            <style>{`@keyframes stripe-slide { 0% { background-position: 0 0; } 100% { background-position: 32px 0; } }`}</style>
                        </div>
                    )}

                    {/* Submit button */}
                    {(() => {
                        const selTrack = tab === 'library' ? tracks.find(t => t.id === selectedTrackId) : undefined;
                        const libraryBlocked = tab === 'library' && !!selectedTrackId && requireProjectFile && !selTrack?.projectFileUrl;
                        const isDisabled = submitting || (tab === 'upload' && !tosAgreed) || libraryBlocked;
                        return (
                            <button onClick={handleSubmit} disabled={isDisabled}
                                style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Entry'}
                            </button>
                        );
                    })()}
                </div>
                </>)}
            </div>
        </div>
        </>
    );
};
