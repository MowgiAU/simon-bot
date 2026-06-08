import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Trash2, Loader2, GripVertical } from 'lucide-react';
import { colors, borderRadius } from '../theme/theme';
import { showToast } from './Toast';
import type { StemData } from './StemsMixer';

/**
 * Owner-facing stems management UI embedded in the track edit modal:
 * upload new stems (with per-file display names), and remove existing ones.
 * Uploads go straight to /api/musician/tracks/:trackId/stems -- they don't
 * wait for the surrounding "Save Changes" form submit.
 */
export const StemsManager: React.FC<{
    trackId: string;
    stems: StemData[];
    onChange: (stems: StemData[]) => void;
}> = ({ trackId, stems, onChange }) => {
    const [pending, setPending] = useState<{ file: File; label: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '4px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: colors.textSecondary }}>Stems</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: colors.textTertiary }}>
                Upload individually-rendered audio for each track in your project (e.g. Drums, Bass, Lead).
                Listeners can mute, solo and mix them in a synced player on the track page.
            </p>

            {stems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    {stems.map(stem => (
                        <div key={stem.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.md,
                        }}>
                            <GripVertical size={14} color={colors.textTertiary} />
                            <span style={{ flex: 1, fontSize: '0.88rem', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {stem.label}
                            </span>
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
    );
};

