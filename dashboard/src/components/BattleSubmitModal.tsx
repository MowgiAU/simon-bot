import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { colors, borderRadius } from '../theme/theme';
import { X, Upload, Music, Check, Loader2, Library } from 'lucide-react';
import { TrackUploadForm } from './TrackUploadForm';

const API = import.meta.env.VITE_API_URL || '';

interface LibraryTrack {
    id: string;
    title: string;
    url: string;
    coverUrl: string | null;
    duration: number | null;
    artist: string;
    projectFileUrl: string | null;
    isPublic?: boolean;
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

    const handleLibrarySubmit = async () => {
        setError('');
        if (!selectedTrackId) { setError('Select a track from your library.'); return; }
        const sel = tracks.find(t => t.id === selectedTrackId);
        if (requireProjectFile && !sel?.projectFileUrl) {
            setError('This battle requires a project file. The selected track has none — add one to your track page first.');
            return;
        }
        if (sel && sel.isPublic === false) {
            setError('This track is private. Make it public from your track page (or toggle it from /my-tracks) before submitting it to a battle.');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(
                `${API}/api/beat-battle/battles/${battleId}/submit`,
                { trackId: selectedTrackId },
                { withCredentials: true },
            );
            onSubmitted();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflow: 'auto' }} onClick={onClose}>
            <div style={{ backgroundColor: colors.surface, borderRadius: '14px', width: '100%', maxWidth: tab === 'upload' ? '760px' : '580px', margin: '24px auto', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px', fontWeight: 700 }}>Submit Your Beat</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                </div>

                <>

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
                        <TrackUploadForm
                            battleId={battleId}
                            requireProjectFile={requireProjectFile}
                            titleOverride="Submit Your Beat"
                            subtitleOverride={requireProjectFile ? 'A project file is required for this battle.' : 'Upload an audio file (and optional project file) to enter the battle.'}
                            onUploaded={() => { onSubmitted(); onClose(); }}
                            onCancel={onClose}
                        />
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
                                    {selectedTrackId && (() => {
                                        const sel = tracks.find(t => t.id === selectedTrackId);
                                        if (!sel || sel.isPublic !== false) return null;
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: borderRadius.md }}>
                                                <AlertCircle size={15} color="#F97316" style={{ flexShrink: 0, marginTop: '1px' }} />
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#F97316' }}>This track is private</p>
                                                    <p style={{ margin: '2px 0 8px', fontSize: '11px', color: colors.textSecondary }}>Battle entries must be public so other producers can listen and vote.</p>
                                                    <button
                                                        type="button"
                                                        disabled={submitting}
                                                        onClick={async () => {
                                                            try {
                                                                await axios.patch(`${API}/api/musician/tracks/${sel.id}`, { isPublic: true }, { withCredentials: true });
                                                                setTracks(prev => prev.map(t => t.id === sel.id ? { ...t, isPublic: true } : t));
                                                            } catch (err: any) {
                                                                setError(err.response?.data?.error || 'Could not make track public.');
                                                            }
                                                        }}
                                                        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(249,115,22,0.5)', backgroundColor: 'rgba(249,115,22,0.15)', color: '#F97316', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                                    >Make public</button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {selectedTrackId && (() => {
                                        const sel = tracks.find(t => t.id === selectedTrackId);
                                        if (sel?.projectFileUrl) {
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'rgba(245, 160, 74,0.08)', border: '1px solid rgba(245, 160, 74,0.25)', borderRadius: borderRadius.md }}>
                                                    <Check size={15} color="#F5A04A" style={{ flexShrink: 0 }} />
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#F5A04A' }}>Project file included</p>
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
                            {(() => {
                                const selTrack = tracks.find(t => t.id === selectedTrackId);
                                const blocked = !!selectedTrackId && requireProjectFile && !selTrack?.projectFileUrl;
                                const privateBlocked = !!selTrack && selTrack.isPublic === false;
                                const isDisabled = submitting || !selectedTrackId || blocked || privateBlocked;
                                return (
                                    <button onClick={handleLibrarySubmit} disabled={isDisabled}
                                        style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Entry'}
                                    </button>
                                );
                            })()}
                        </div>
                    )}
                </div>
                </>
            </div>
        </div>
    );
};
