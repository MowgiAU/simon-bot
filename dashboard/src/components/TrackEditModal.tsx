/**
 * Full track-edit modal — restores the field set the old (pre-Alt-F) editors had
 * (TrackPage.tsx's edit modal / MyTracksPage.tsx's renderTrackForm), styled for
 * the Alt F shell. Saves via three calls, matching what the backend actually
 * accepts per field:
 *   - PATCH /api/musician/tracks/:id (JSON) — title, description, artist, album,
 *     year, bpm, key, isPublic, download permissions, license, trackType, slug,
 *     genreIds. This endpoint handles everything except youtubeUrl and files.
 *   - PUT /api/musician/tracks/:id (multipart) — only sent when youtubeUrl changed
 *     or a replacement file was chosen (both are PUT-only on the backend).
 *   - PUT /api/musician/tracks/:id/lyrics — lyrics have their own endpoint.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Tag, Scale, Save, Loader2, FileAudio, Image as ImageIcon, Music, AlertCircle } from 'lucide-react';
import { BG, S_CONT, PRIMARY, TEXT, SUB, BORDER, FONT } from './altshell/AltSidebar';

interface Genre { id: string; name: string; parentId: string | null }

export interface EditableTrack {
    id: string; title: string; description?: string | null; artist?: string | null; album?: string | null;
    year?: number | null; bpm?: number | null; key?: string | null; isPublic: boolean;
    allowAudioDownload?: boolean; allowProjectDownload?: boolean; allowStemsDownload?: boolean;
    license?: string | null; trackType?: string | null; slug?: string | null;
    youtubeUrl?: string | null; lyrics?: string | null;
    genres?: { genre: { id: string; name: string } }[];
}

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };
const inputBase: React.CSSProperties = { width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT };
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 };
const fieldBlock: React.CSSProperties = { marginBottom: 16 };

const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(note => [
    <option key={`${note} Major`} value={`${note} Major`}>{note} Major</option>,
    <option key={`${note} Minor`} value={`${note} Minor`}>{note} Minor</option>,
]);

export const TrackEditModal: React.FC<{ track: EditableTrack; open: boolean; onClose: () => void; onSaved: (patch: Partial<EditableTrack>) => void }> = ({ track, open, onClose, onSaved }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [artist, setArtist] = useState('');
    const [album, setAlbum] = useState('');
    const [year, setYear] = useState('');
    const [bpm, setBpm] = useState('');
    const [key, setKey] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [allowAudioDownload, setAllowAudioDownload] = useState(true);
    const [allowProjectDownload, setAllowProjectDownload] = useState(true);
    const [allowStemsDownload, setAllowStemsDownload] = useState(true);
    const [license, setLicense] = useState('all-rights-reserved');
    const [trackType, setTrackType] = useState('original');
    const [slug, setSlug] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [initialLyrics, setInitialLyrics] = useState('');
    const [initialYoutubeUrl, setInitialYoutubeUrl] = useState('');

    const [allGenres, setAllGenres] = useState<Genre[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [genreSearch, setGenreSearch] = useState('');

    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [artworkFile, setArtworkFile] = useState<File | null>(null);
    const [projectFile, setProjectFile] = useState<File | null>(null);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setTitle(track.title || '');
        setDescription(track.description || '');
        setArtist(track.artist || '');
        setAlbum(track.album || '');
        setYear(track.year ? String(track.year) : '');
        setBpm(track.bpm ? String(track.bpm) : '');
        setKey(track.key || '');
        setIsPublic(track.isPublic);
        setAllowAudioDownload(track.allowAudioDownload !== false);
        setAllowProjectDownload(track.allowProjectDownload !== false);
        setAllowStemsDownload(track.allowStemsDownload !== false);
        setLicense(track.license || 'all-rights-reserved');
        setTrackType(track.trackType || 'original');
        setSlug(track.slug || '');
        setYoutubeUrl(track.youtubeUrl || '');
        setInitialYoutubeUrl(track.youtubeUrl || '');
        setLyrics(track.lyrics || '');
        setInitialLyrics(track.lyrics || '');
        setSelectedGenres((track.genres || []).map(g => g.genre.id));
        setAudioFile(null); setArtworkFile(null); setProjectFile(null);
        setError(null);
    }, [open, track]);

    useEffect(() => {
        if (!open) return;
        axios.get('/api/musician/genres', { withCredentials: true }).then(r => setAllGenres(r.data || [])).catch(() => setAllGenres([]));
    }, [open]);

    if (!open) return null;

    const handleSave = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) { setError('Title is required.'); return; }
        setSaving(true);
        setError(null);
        try {
            await axios.patch(`/api/musician/tracks/${track.id}`, {
                title: trimmedTitle, description, artist, album, year, bpm, key,
                isPublic, allowAudioDownload, allowProjectDownload, allowStemsDownload,
                license, trackType, slug, genreIds: selectedGenres,
            }, { withCredentials: true });

            const youtubeChanged = youtubeUrl !== initialYoutubeUrl;
            if (youtubeChanged || audioFile || artworkFile || projectFile) {
                const fd = new FormData();
                if (youtubeChanged) fd.append('youtubeUrl', youtubeUrl);
                if (audioFile) fd.append('audio', audioFile);
                if (artworkFile) fd.append('artwork', artworkFile);
                if (projectFile) fd.append('project', projectFile);
                await axios.put(`/api/musician/tracks/${track.id}`, fd, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
            }

            if (lyrics !== initialLyrics) {
                await axios.put(`/api/musician/tracks/${track.id}/lyrics`, { lyrics, lyricsSync: null }, { withCredentials: true });
            }

            onSaved({
                title: trimmedTitle, description, artist, album,
                year: year ? parseInt(year, 10) : null, bpm: bpm ? parseInt(bpm, 10) : null, key,
                isPublic, allowAudioDownload, allowProjectDownload, allowStemsDownload,
                license, trackType, slug, youtubeUrl, lyrics,
                genres: selectedGenres.map(id => ({ genre: { id, name: allGenres.find(g => g.id === id)?.name || '' } })),
            });
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const childGenres = allGenres.filter(g => g.parentId);
    const parentGenres = allGenres.filter(g => !g.parentId);
    const parentsWithChildren = parentGenres.filter(p => childGenres.some(c => c.parentId === p.id));
    const standaloneGenres = parentGenres.filter(p => !childGenres.some(c => c.parentId === p.id));
    const matchesSearch = (g: Genre) => !genreSearch || g.name.toLowerCase().includes(genreSearch.toLowerCase());

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.7)', fontFamily: FONT }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT }}>Edit Track</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16, fontSize: 12, color: '#EF4444' }}>
                            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                        </div>
                    )}

                    <div style={fieldBlock}>
                        <span style={label}>Title *</span>
                        <input value={title} onChange={e => setTitle(e.target.value)} style={inputBase} />
                    </div>

                    <div style={row}>
                        <div><span style={label}>Artist</span><input value={artist} onChange={e => setArtist(e.target.value)} style={inputBase} /></div>
                        <div><span style={label}>Album</span><input value={album} onChange={e => setAlbum(e.target.value)} style={inputBase} /></div>
                    </div>

                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div><span style={label}>Year</span><input value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} style={inputBase} /></div>
                        <div><span style={label}>BPM</span><input value={bpm} onChange={e => setBpm(e.target.value.replace(/\D/g, ''))} style={inputBase} /></div>
                        <div>
                            <span style={label}>Key</span>
                            <select value={key} onChange={e => setKey(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                                <option value="">—</option>
                                {keyOptions}
                            </select>
                        </div>
                    </div>

                    <div style={fieldBlock}>
                        <span style={label}>Description</span>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    <div style={fieldBlock}>
                        <span style={label}><Tag size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Genre Tags</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 26 }}>
                            {selectedGenres.length === 0 && <span style={{ fontSize: 12, color: SUB, fontStyle: 'italic' }}>No genres selected</span>}
                            {selectedGenres.map(gId => {
                                const genre = allGenres.find(g => g.id === gId);
                                return genre ? (
                                    <span key={gId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${PRIMARY}1F`, padding: '3px 10px', borderRadius: 9999, fontSize: 12, color: PRIMARY, fontWeight: 600 }}>
                                        {genre.name}
                                        <X size={11} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setSelectedGenres(prev => prev.filter(id => id !== gId))} />
                                    </span>
                                ) : null;
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input placeholder="Search genres…" value={genreSearch} onChange={e => setGenreSearch(e.target.value)} style={{ ...inputBase, flex: 1 }} />
                            <select value="" onChange={e => { if (e.target.value && !selectedGenres.includes(e.target.value)) { setSelectedGenres(prev => [...prev, e.target.value]); setGenreSearch(''); } }} style={{ ...inputBase, flex: 1, cursor: 'pointer' }}>
                                <option value="">Add genre…</option>
                                {standaloneGenres.filter(g => !selectedGenres.includes(g.id) && matchesSearch(g)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                {parentsWithChildren.map(parent => {
                                    const children = childGenres.filter(c => c.parentId === parent.id && !selectedGenres.includes(c.id) && matchesSearch(c));
                                    const parentMatch = !selectedGenres.includes(parent.id) && matchesSearch(parent);
                                    if (children.length === 0 && !parentMatch) return null;
                                    return (
                                        <optgroup key={parent.id} label={parent.name}>
                                            {parentMatch && <option value={parent.id}>All {parent.name}</option>}
                                            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </optgroup>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    <div style={row}>
                        <div>
                            <span style={label}>Track Type</span>
                            <select value={trackType} onChange={e => setTrackType(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                                <option value="original">Original</option>
                                <option value="remix">Remix</option>
                                <option value="cover">Cover</option>
                            </select>
                        </div>
                        <div>
                            <span style={label}><Scale size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />License</span>
                            <select value={license} onChange={e => setLicense(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                                <option value="all-rights-reserved">All Rights Reserved</option>
                                <option value="cc0">CC0 — Public Domain</option>
                                <option value="cc-by">CC BY — Attribution</option>
                                <option value="cc-by-sa">CC BY-SA — Attribution ShareAlike</option>
                                <option value="cc-by-nc">CC BY-NC — Attribution NonCommercial</option>
                                <option value="cc-by-nc-sa">CC BY-NC-SA — Attribution NonCommercial ShareAlike</option>
                                <option value="cc-by-nd">CC BY-ND — Attribution NoDerivs</option>
                                <option value="cc-by-nc-nd">CC BY-NC-ND — Attribution NonCommercial NoDerivs</option>
                            </select>
                        </div>
                    </div>

                    <div style={fieldBlock}>
                        <span style={label}>Custom URL Slug</span>
                        <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="auto-generated from title if left blank" style={inputBase} />
                    </div>

                    <div style={fieldBlock}>
                        <span style={label}>YouTube Music Video URL</span>
                        <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" style={inputBase} />
                    </div>

                    <div style={fieldBlock}>
                        <span style={label}>Lyrics</span>
                        <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={5} style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    <div style={{ ...fieldBlock, padding: 14, borderRadius: 10, background: S_CONT, border: `1px solid ${BORDER}` }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, cursor: 'pointer', marginBottom: 10 }}>
                            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /> Public
                        </label>
                        <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Download Permissions</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, cursor: 'pointer', marginBottom: 6 }}>
                            <input type="checkbox" checked={allowAudioDownload} onChange={e => setAllowAudioDownload(e.target.checked)} /> Allow Audio Download
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, cursor: 'pointer', marginBottom: 6 }}>
                            <input type="checkbox" checked={allowProjectDownload} onChange={e => setAllowProjectDownload(e.target.checked)} /> Allow Project Download
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
                            <input type="checkbox" checked={allowStemsDownload} onChange={e => setAllowStemsDownload(e.target.checked)} /> Allow Stems Download
                        </label>
                    </div>

                    <div style={fieldBlock}>
                        <span style={label}>Replace Files (optional)</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                { file: audioFile, set: setAudioFile, accept: 'audio/*', icon: <Music size={14} />, text: 'Replace Audio' },
                                { file: artworkFile, set: setArtworkFile, accept: 'image/*', icon: <ImageIcon size={14} />, text: 'Replace Artwork' },
                                { file: projectFile, set: setProjectFile, accept: '.flp,.als,.zip', icon: <FileAudio size={14} />, text: 'Replace Project File' },
                            ].map((f, i) => (
                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: `1px dashed ${BORDER}`, cursor: 'pointer', fontSize: 12, color: f.file ? PRIMARY : SUB }}>
                                    {f.icon} {f.file ? f.file.name : f.text}
                                    <input type="file" accept={f.accept} onChange={e => f.set(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'none', color: SUB, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: FONT }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', cursor: saving ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1, fontFamily: FONT }}>
                        {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
