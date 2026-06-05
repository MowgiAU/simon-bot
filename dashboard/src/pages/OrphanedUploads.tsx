import React, { useEffect, useState } from 'react';
import { HardDrive, Trash2, RefreshCw, AlertCircle, Check, ShieldAlert } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';

interface OrphanedFile {
    filename: string;
    sizeMB: number;
    modifiedAt: string;
    risky: boolean;
    riskyReason: string | null;
    uploaderUserId: string | null;
    uploaderUsername: string | null;
}

const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const OrphanedUploads: React.FC = () => {
    const [files, setFiles] = useState<OrphanedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/admin/orphaned-uploads', { withCredentials: true });
            setFiles(data.files || []);
        } catch {
            setMessage({ type: 'error', text: 'Failed to load orphaned files.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (filename: string) => {
        if (!window.confirm(`Delete "${filename}"? The user will need to re-upload.`)) return;
        setDeleting(filename);
        try {
            await axios.delete(`/api/admin/orphaned-uploads/${encodeURIComponent(filename)}`, { withCredentials: true });
            setFiles(f => f.filter(x => x.filename !== filename));
            setMessage({ type: 'success', text: `Deleted ${filename}` });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Delete failed.' });
        } finally {
            setDeleting(null);
        }
    };

    const totalMB = files.reduce((s, f) => s + f.sizeMB, 0).toFixed(1);

    return (
        <div style={{ padding: '24px 32px', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <HardDrive size={32} color={colors.primary} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Orphaned Upload Files</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Audio files on disk with no matching track in the database — safe to delete so users can re-upload.
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: borderRadius.md, background: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.glassBorder}`, color: colors.textSecondary, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {/* Info box */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', marginBottom: '8px' }}>
                    Files written to disk during an upload that failed before the database record was saved — typically a server restart or connection drop mid-upload.
                </p>
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: '12px' }}>
                    <strong style={{ color: '#F59E0B' }}>⚠ Risky</strong> files share a filename stem with an existing track — they may be conversion artefacts from a background job that was interrupted after the file was converted but before the DB was updated. These are almost certainly safe to delete (the track's URL would be broken anyway), but inspect them first.
                </p>
            </div>

            {/* Toast */}
            {message && (
                <div style={{
                    padding: '10px 14px', borderRadius: borderRadius.md, marginBottom: '16px',
                    backgroundColor: message.type === 'success' ? 'rgba(242, 120, 10,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? 'rgba(242, 120, 10,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: message.type === 'success' ? colors.success : colors.error,
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                }}>
                    {message.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: '16px', lineHeight: 1 }}>×</button>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div style={{ color: colors.textSecondary, padding: '40px', textAlign: 'center' }}>Scanning uploads directory...</div>
            ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 40px', backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}` }}>
                    <Check size={40} color={colors.success} style={{ marginBottom: '12px', opacity: 0.7 }} />
                    <p style={{ color: colors.textSecondary, margin: 0 }}>No orphaned files found — all uploads have database records.</p>
                </div>
            ) : (
                <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}`, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.glassBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                            <strong style={{ color: colors.textPrimary }}>{files.length}</strong> file{files.length !== 1 ? 's' : ''} · <strong style={{ color: colors.textPrimary }}>{totalMB} MB</strong>
                            {files.some(f => f.risky) && <span style={{ marginLeft: '10px', color: '#F59E0B', fontWeight: 600 }}>· {files.filter(f => f.risky).length} risky</span>}
                            <span style={{ marginLeft: '10px', color: colors.success, fontWeight: 600 }}>· {files.filter(f => !f.risky).length} safe</span>
                        </span>
                        <span style={{ fontSize: '11px', color: colors.textTertiary }}>Newest first</span>
                    </div>
                    {files.map((file, i) => (
                        <div key={file.filename} style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px 20px',
                            borderBottom: i < files.length - 1 ? `1px solid ${colors.glassBorder}` : 'none',
                            backgroundColor: file.risky ? 'rgba(245,158,11,0.04)' : 'transparent',
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.filename}
                                    </span>
                                    {file.risky && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>
                                            <ShieldAlert size={10} /> RISKY
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textTertiary }}>
                                    {file.sizeMB} MB · {fmt(file.modifiedAt)}
                                    {file.uploaderUsername && (
                                        <span style={{ marginLeft: '6px' }}>
                                            · uploaded by{' '}
                                            <a href={`/profile/${file.uploaderUsername}`} target="_blank" rel="noopener noreferrer"
                                                style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>
                                                {file.uploaderUsername}
                                            </a>
                                            <span style={{ color: colors.textTertiary, fontSize: '10px', marginLeft: '4px' }}>(~5 min window)</span>
                                        </span>
                                    )}
                                    {!file.uploaderUsername && <span style={{ marginLeft: '6px', fontStyle: 'italic' }}>· uploader unknown</span>}
                                    {file.risky && <span style={{ color: '#F59E0B', marginLeft: '6px' }}>· {file.riskyReason}</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(file.filename)}
                                disabled={deleting === file.filename}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '7px 14px', borderRadius: borderRadius.sm,
                                    background: file.risky ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${file.risky ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    color: file.risky ? '#F59E0B' : colors.error,
                                    cursor: deleting === file.filename ? 'not-allowed' : 'pointer',
                                    fontSize: '12px', fontWeight: 600, opacity: deleting === file.filename ? 0.5 : 1,
                                    flexShrink: 0,
                                }}
                            >
                                <Trash2 size={13} />
                                {deleting === file.filename ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
