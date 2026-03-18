import React, { useState, useEffect, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { X, Upload, Music, Check, Loader2, Library, FileArchive, Image } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

interface LibraryTrack {
    id: string;
    title: string;
    url: string;
    coverUrl: string | null;
    duration: number | null;
    artist: string;
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
    const [tab, setTab] = useState<Tab>('upload');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Upload tab
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string>('');
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const audioRef = useRef<HTMLInputElement>(null);
    const coverRef = useRef<HTMLInputElement>(null);
    const projectRef = useRef<HTMLInputElement>(null);

    // Library tab
    const [tracks, setTracks] = useState<LibraryTrack[]>([]);
    const [tracksLoading, setTracksLoading] = useState(false);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

    useEffect(() => {
        if (open && tab === 'library') fetchTracks();
    }, [open, tab]);

    useEffect(() => {
        if (open) {
            setError('');
            setSubmitting(false);
        }
    }, [open]);

    const handleCoverChange = (file: File | null) => {
        setCoverFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setCoverPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setCoverPreview('');
        }
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

        try {
            if (tab === 'library') {
                if (!selectedTrackId) { setError('Select a track from your library.'); setSubmitting(false); return; }
                const res = await fetch(`${API}/api/beat-battle/battles/${battleId}/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ trackId: selectedTrackId, title: tracks.find(t => t.id === selectedTrackId)?.title || 'Untitled' }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Submission failed');
                }
            } else {
                if (!audioFile) { setError('Please select an audio file.'); setSubmitting(false); return; }
                if (!title.trim()) { setError('Please enter a track title.'); setSubmitting(false); return; }
                if (requireProjectFile && !projectFile) { setError('This battle requires a project file (.flp or .zip).'); setSubmitting(false); return; }
                const formData = new FormData();
                formData.append('audio', audioFile);
                formData.append('title', title.trim());
                if (description.trim()) formData.append('description', description.trim());
                if (coverFile) formData.append('cover', coverFile);
                if (projectFile) formData.append('project', projectFile);

                const res = await fetch(`${API}/api/beat-battle/battles/${battleId}/submit`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Submission failed');
                }
            }
            onSubmitted();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally { setSubmitting(false); }
    };

    if (!open) return null;

    const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
    const modalStyle: React.CSSProperties = { backgroundColor: colors.surface, borderRadius: '14px', width: '100%', maxWidth: '560px', maxHeight: '85vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' };
    const labelStyle: React.CSSProperties = { display: 'block', color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '6px' };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px', fontWeight: 700 }}>Submit Your Beat</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', padding: '12px 24px 0', gap: '8px' }}>
                    {([['upload', Upload, 'Upload New'] as const, ['library', Library, 'My Library'] as const]).map(([key, Icon, label]) => (
                        <button key={key} onClick={() => setTab(key)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: borderRadius.md, border: tab === key ? `1px solid ${colors.primary}` : '1px solid rgba(255,255,255,0.08)', backgroundColor: tab === key ? `${colors.primary}15` : 'transparent', color: tab === key ? colors.primary : colors.textSecondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px 24px' }}>
                    {error && (
                        <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: borderRadius.md, color: colors.error, fontSize: '13px', marginBottom: '16px' }}>
                            {error}
                        </div>
                    )}

                    {tab === 'upload' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Cover Art Preview + Title side by side */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                {/* Cover Art Thumbnail */}
                                <div style={{ flexShrink: 0 }}>
                                    <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverChange(e.target.files?.[0] || null)} />
                                    <button
                                        onClick={() => coverRef.current?.click()}
                                        style={{ width: '80px', height: '80px', borderRadius: '10px', border: `2px dashed ${coverPreview ? 'transparent' : 'rgba(255,255,255,0.15)'}`, backgroundColor: coverPreview ? 'transparent' : 'rgba(255,255,255,0.04)', cursor: 'pointer', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {coverPreview ? (
                                            <img src={coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ textAlign: 'center' }}>
                                                <Image size={20} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                                <p style={{ margin: '4px 0 0', fontSize: '9px', color: colors.textSecondary, opacity: 0.6 }}>Cover</p>
                                            </div>
                                        )}
                                    </button>
                                </div>
                                {/* Title + Description */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div>
                                        <label style={labelStyle}>Track Title *</label>
                                        <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="My Beat" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Description</label>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: '48px', resize: 'vertical', fontFamily: 'inherit' }}
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Tell us about this beat..."
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Audio File */}
                            <div>
                                <label style={labelStyle}>Audio File * (MP3, WAV, FLAC)</label>
                                <input ref={audioRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                                <button onClick={() => audioRef.current?.click()} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: audioFile ? colors.textPrimary : colors.textSecondary }}>
                                    <Music size={14} /> {audioFile ? audioFile.name : 'Choose audio file...'}
                                </button>
                            </div>

                            {/* Project File */}
                            <div>
                                <label style={labelStyle}>Project File (.flp, .zip){requireProjectFile ? ' *' : ''}</label>
                                <input ref={projectRef} type="file" accept=".flp,.zip" style={{ display: 'none' }} onChange={e => setProjectFile(e.target.files?.[0] || null)} />
                                <button onClick={() => projectRef.current?.click()} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: projectFile ? colors.textPrimary : colors.textSecondary }}>
                                    <FileArchive size={14} /> {projectFile ? projectFile.name : requireProjectFile ? 'Choose project file (required)...' : 'Choose project file (optional)...'}
                                </button>
                                {requireProjectFile && (
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.warning || '#F97316' }}>This battle requires a project file upload.</p>
                                )}
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
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
                        </div>
                    )}

                    {/* Submit button */}
                    <button onClick={handleSubmit} disabled={submitting}
                        style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Entry'}
                    </button>
                </div>
            </div>
        </div>
    );
};
