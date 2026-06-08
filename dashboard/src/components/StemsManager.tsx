import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Trash2, Loader2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Music2 } from 'lucide-react';
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
    const [movingId, setMovingId] = useState<string | null>(null);

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

    const moveStem = async (idx: number, dir: -1 | 1) => {
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= stems.length) return;
        const reordered = [...stems];
        [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
        onChange(reordered);
        setMovingId(reordered[idx].id);
        try {
            await Promise.all(reordered.map((s, i) =>
                axios.patch(`/api/musician/tracks/${trackId}/stems/${s.id}`, { order: i }, { withCredentials: true })
            ));
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to reorder stems', 'error');
        } finally {
            setMovingId(null);
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
                        Listeners can mute, solo and mix them in a synced player on the track page, in the order shown below.
                    </p>

                    {stems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                            {stems.map((stem, idx) => (
                                <div key={stem.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.md,
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button
                                            onClick={() => moveStem(idx, -1)}
                                            disabled={idx === 0 || movingId !== null}
                                            title="Move up"
                                            style={{
                                                width: '20px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                                                color: idx === 0 ? colors.textTertiary : colors.textSecondary,
                                                cursor: idx === 0 || movingId !== null ? 'default' : 'pointer',
                                                opacity: idx === 0 ? 0.4 : 1,
                                            }}
                                        >
                                            <ArrowUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => moveStem(idx, 1)}
                                            disabled={idx === stems.length - 1 || movingId !== null}
                                            title="Move down"
                                            style={{
                                                width: '20px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                                                color: idx === stems.length - 1 ? colors.textTertiary : colors.textSecondary,
                                                cursor: idx === stems.length - 1 || movingId !== null ? 'default' : 'pointer',
                                                opacity: idx === stems.length - 1 ? 0.4 : 1,
                                            }}
                                        >
                                            <ArrowDown size={12} />
                                        </button>
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

                    <label style={{
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                        padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(255,255,255,0.15)', borderRadius: borderRadius.md,
                        color: colors.textSecondary, fontSize: '0.9rem',
                    }}>
                        <Upload size={16} />
                        Add stem audio files (MP3, WAV, FLAC -- multiple allowed)
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

