import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Trash2, Loader2, ChevronDown, ChevronRight, GripVertical, Music2 } from 'lucide-react';
import { colors, borderRadius } from '../theme/theme';
import { showToast } from './Toast';
import type { StemData } from './StemsMixer';

/**
 * Owner-facing stems management UI embedded in the track edit modal:
 * upload new stems (with per-file display names), rename, reorder and remove
 * existing ones. Uploads/renames/reorders go straight to
 * /api/musician/tracks/:trackId/stems -- they don't wait for the surrounding
 * "Save Changes" form submit. Display order here is the order listeners will
 * see (and hear) the channels in on the track page mixer.
 */
export const StemsManager: React.FC<{
    trackId: string;
    stems: StemData[];
    onChange: (stems: StemData[]) => void;
}> = ({ trackId, stems, onChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [pending, setPending] = useState<{ file: File; label: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reordering, setReordering] = useState(false);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [fileDragOver, setFileDragOver] = useState(false);

    const handleFiles = (files: FileList | null) => {
        if (!files || !files.length) return;
        const next = Array.from(files).map(file => ({
            file,
            label: file.name.replace(/\.[^.]+$/, ''),
        }));
        setPending(prev => [...prev, ...next]);
    };

    const updateLabel = (idx: number, label: string) => {
        setPending(prev => prev.map((p, i) => i === idx ? { ...p, label } : p));
    };

    const removePending = (idx: number) => {
        setPending(prev => prev.filter((_, i) => i !== idx));
    };

    const upload = async () => {
        if (!pending.length) return;
        setUploading(true);
        try {
            const formData = new FormData();
            pending.forEach(p => formData.append('stems', p.file));
            formData.append('labels', JSON.stringify(pending.map(p => p.label.trim() || p.file.name)));

            const res = await axios.post(`/api/musician/tracks/${trackId}/stems`, formData, { withCredentials: true });
            onChange([...stems, ...(res.data.stems || [])]);
            setPending([]);
            showToast(`Added ${res.data.stems?.length || 0} stem(s)`, 'success');
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to upload stems', 'error');
        } finally {
            setUploading(false);
        }
    };

    const removeStem = async (stemId: string) => {
        setDeletingId(stemId);
        try {
            await axios.delete(`/api/musician/tracks/${trackId}/stems/${stemId}`, { withCredentials: true });
            onChange(stems.filter(s => s.id !== stemId));
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to remove stem', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const renameStem = (stemId: string, label: string) => {
        onChange(stems.map(s => s.id === stemId ? { ...s, label } : s));
    };

    const persistLabel = async (stemId: string, label: string) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        try {
            await axios.patch(`/api/musician/tracks/${trackId}/stems/${stemId}`, { label: trimmed }, { withCredentials: true });
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to rename stem', 'error');
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDrop = async (e: React.DragEvent, toIndex: number) => {
        e.preventDefault();
        const fromIndex = Number(e.dataTransfer.getData('text/plain'));
        setDragOverIndex(null);
        if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;

        const reordered = [...stems];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        onChange(reordered);
        setReordering(true);
        try {
            await Promise.all(reordered.map((s, i) =>
                axios.patch(`/api/musician/tracks/${trackId}/stems/${s.id}`, { order: i }, { withCredentials: true })
            ));
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to reorder stems', 'error');
        } finally {
            setReordering(false);
        }
    };

    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '4px' }}>
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                }}
            >
                {expanded ? <ChevronDown size={18} color={colors.textSecondary} /> : <ChevronRight size={18} color={colors.textSecondary} />}
                <Music2 size={16} color={colors.primary} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: colors.textSecondary }}>
                    Stems {stems.length > 0 ? `(${stems.length})` : ''}
                </h3>
            </button>

            {expanded && (
                <div style={{ marginTop: '12px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: colors.textTertiary }}>
                        Upload individually-rendered audio for each track in your project (e.g. Drums, Bass, Lead).
                        Listeners can mute, solo and mix them in a synced player on the track page. Drag the {'☰'} handle to
                        reorder -- that's the order they'll be shown and played in.
                    </p>

                    {stems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                            {stems.map((stem, idx) => (
                                <div
                                    key={stem.id}
                                    draggable
                                    onDragStart={e => handleDragStart(e, idx)}
                                    onDragOver={e => handleDragOver(e, idx)}
                                    onDragLeave={() => setDragOverIndex(prev => prev === idx ? null : prev)}
                                    onDrop={e => handleDrop(e, idx)}
                                    onDragEnd={() => setDragOverIndex(null)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${dragOverIndex === idx ? colors.primary : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: borderRadius.md,
                                        opacity: reordering ? 0.7 : 1,
                                    }}
                                >
                                    <div title="Drag to reorder" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: colors.textTertiary }}>
                                        <GripVertical size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        value={stem.label}
                                        onChange={e => renameStem(stem.id, e.target.value)}
                                        onBlur={e => persistLabel(stem.id, e.target.value)}
                                        placeholder="Stem name (e.g. Drums)"
                                        style={{
                                            flex: 1, padding: '7px 10px', fontSize: '0.85rem',
                                            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                                            borderRadius: borderRadius.sm, color: colors.textPrimary,
                                        }}
                                    />
                                    <button
                                        onClick={() => removeStem(stem.id)}
                                        disabled={deletingId === stem.id}
                                        title="Remove stem"
                                        style={{
                                            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                                            color: colors.error, cursor: deletingId === stem.id ? 'default' : 'pointer',
                                            opacity: deletingId === stem.id ? 0.5 : 1,
                                        }}
                                    >
                                        {deletingId === stem.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <label
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setFileDragOver(true); }}
                        onDragLeave={() => setFileDragOver(false)}
                        onDrop={e => { e.preventDefault(); setFileDragOver(false); handleFiles(e.dataTransfer.files); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            padding: '10px 14px', backgroundColor: fileDragOver ? 'rgba(242, 120, 10,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px dashed ${fileDragOver ? colors.primary : 'rgba(255,255,255,0.15)'}`, borderRadius: borderRadius.md,
                            color: fileDragOver ? colors.primary : colors.textSecondary, fontSize: '0.9rem',
                        }}
                    >
                        <Upload size={16} />
                        {fileDragOver ? 'Drop to add stems' : 'Add stem audio files (MP3, WAV, FLAC -- multiple allowed)'}
                        <input
                            type="file"
                            multiple
                            accept=".mp3,.wav,.flac,.ogg,.aiff,.aif,audio/*"
                            style={{ display: 'none' }}
                            onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                        />
                    </label>

                    {pending.length > 0 && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pending.map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={p.label}
                                        onChange={e => updateLabel(idx, e.target.value)}
                                        placeholder="Stem name (e.g. Drums)"
                                        style={{
                                            flex: 1, padding: '8px 12px', fontSize: '0.85rem',
                                            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                                            borderRadius: borderRadius.sm, color: colors.textPrimary,
                                        }}
                                    />
                                    <span style={{ fontSize: '0.78rem', color: colors.textTertiary, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.file.name}
                                    </span>
                                    <button
                                        onClick={() => removePending(idx)}
                                        style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={upload}
                                disabled={uploading}
                                style={{
                                    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 18px', backgroundColor: colors.primary, color: 'white',
                                    border: 'none', borderRadius: borderRadius.md, cursor: uploading ? 'not-allowed' : 'pointer',
                                    fontWeight: 600, fontSize: '0.85rem', opacity: uploading ? 0.6 : 1,
                                }}
                            >
                                {uploading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
                                {uploading ? 'Uploading...' : `Upload ${pending.length} stem${pending.length === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

