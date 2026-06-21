/**
 * Alt F — My Playlists (/preview/alt_f_my_playlists)
 * Auth-gated: list, create, rename, delete the user's own playlists.
 * APIs: GET /api/my-playlists, POST /api/playlists, PUT/DELETE /api/playlists/:id
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, S_LOWEST,
    PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { ListMusic, Plus, Lock, Globe, Pencil, Trash2, Check, X, Play, Layers, TrendingUp } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

function fmtNum(n?: number) { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

const RELEASE_TYPES = ['', 'album', 'ep', 'single'];
const RELEASE_COLORS: Record<string, string> = { album: '#7C3AED', ep: SECONDARY, single: '#ff9f43' };

interface PlaylistTrack { position: number; track: { id: string; coverUrl: string | null; title: string } }
interface Playlist {
    id: string; name: string; slug: string; description: string | null;
    isPublic: boolean; releaseType: string | null; coverUrl: string | null;
    trackCount: number; totalPlays: number; updatedAt: string; createdAt: string;
    tracks: PlaylistTrack[];
}

function MosaicCover({ playlist, size = 80 }: { playlist: Playlist; size?: number }) {
    const covers = playlist.tracks.map(t => t.track.coverUrl).filter(Boolean).slice(0, 4) as string[];
    if (playlist.coverUrl) {
        return <img src={playlist.coverUrl} referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />;
    }
    if (covers.length === 0) {
        return <div style={{ width: size, height: size, borderRadius: 10, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ListMusic size={size * 0.3} color={SUB} /></div>;
    }
    if (covers.length < 4) {
        return <img src={covers[0]} referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />;
    }
    const half = size / 2;
    return (
        <div style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', flexShrink: 0 }}>
            {covers.slice(0, 4).map((src, i) => <img key={i} src={src} referrerPolicy="no-referrer" style={{ width: half, height: half, objectFit: 'cover' }} />)}
        </div>
    );
}

export const FrontpageAltFMyPlaylists: React.FC = () => {
    const { player } = usePlayer();

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading]     = useState(true);
    const [authError, setAuthError] = useState(false);

    // Create form
    const [newName, setNewName]     = useState('');
    const [newPublic, setNewPublic] = useState(true);
    const [creating, setCreating]   = useState(false);
    const [createError, setCreateError] = useState('');

    // Inline edit state: id -> draft name
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');
    const [saving, setSaving]       = useState(false);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(() => {
        axios.get('/api/my-playlists').then(r => {
            setPlaylists(r.data);
            setLoading(false);
        }).catch(e => {
            if (e.response?.status === 401) setAuthError(true);
            setLoading(false);
        });
    }, []);

    useEffect(() => { load(); }, [load]);

    const createPlaylist = async () => {
        if (!newName.trim() || creating) return;
        setCreating(true);
        setCreateError('');
        try {
            await axios.post('/api/playlists', { name: newName.trim(), isPublic: newPublic });
            setNewName('');
            load();
        } catch (e: any) {
            setCreateError(e.response?.data?.error || 'Failed to create');
        } finally { setCreating(false); }
    };

    const saveEdit = async (id: string) => {
        if (!editDraft.trim() || saving) return;
        setSaving(true);
        try {
            await axios.put(`/api/playlists/${id}`, { name: editDraft.trim() });
            setEditingId(null);
            load();
        } catch { } finally { setSaving(false); }
    };

    const deletePlaylist = async (id: string) => {
        try {
            await axios.delete(`/api/playlists/${id}`);
            setDeletingId(null);
            setPlaylists(prev => prev.filter(p => p.id !== id));
        } catch { }
    };

    const totalTracks = playlists.reduce((s, p) => s + p.trackCount, 0);
    const totalPlays  = playlists.reduce((s, p) => s + (p.totalPlays || 0), 0);
    const publicCount = playlists.filter(p => p.isPublic).length;

    if (authError) {
        return (
            <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
                <AltSidebar active="My Playlists" />
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <AltHeader breadcrumb={[{ label: 'My Playlists' }]} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <Lock size={36} color={SUB} />
                        <div style={{ fontSize: 16, fontWeight: 600 }}>Sign in to manage playlists</div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="My Playlists" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'My Playlists' }]} />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* Compact header band */}
                    <section style={{ position: 'relative', borderBottom: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1a2a 0%, #1a0a2a 60%, #0f131d 100%)' }} />
                        {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} style={{ position: 'absolute', width: 1, height: 1, left: `${15 + i * 14}%`, top: '50%', boxShadow: `0 0 ${40 + i * 20}px ${20 + i * 10}px ${i % 2 === 0 ? `${PRIMARY}07` : `${SECONDARY}05`}`, borderRadius: '50%' }} />
                        ))}
                        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '40px 32px 36px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                    <Layers size={28} color={PRIMARY} />
                                    <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>My Playlists</h1>
                                </div>
                                <p style={{ margin: 0, color: SUB, fontSize: 14 }}>
                                    {loading ? 'Loading…' : `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''} · ${fmtNum(totalTracks)} tracks · ${fmtNum(totalPlays)} plays`}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 20 }}>
                                {[
                                    { label: 'Total', value: String(playlists.length), color: TEXT },
                                    { label: 'Public', value: String(publicCount), color: SECONDARY },
                                    { label: 'Private', value: String(playlists.length - publicCount), color: SUB },
                                ].map(s => (
                                    <div key={s.label} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Body grid */}
                    <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 32px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, boxSizing: 'border-box' }}>

                        {/* LEFT */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Create card */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Plus size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>New Playlist</h3>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <input
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && createPlaylist()}
                                        placeholder="Playlist name…"
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT }}
                                    />
                                    <button
                                        onClick={() => setNewPublic(v => !v)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: newPublic ? `${SECONDARY}12` : `${SUB}0a`, border: `1px solid ${newPublic ? SECONDARY + '44' : BORDER}`, borderRadius: 8, cursor: 'pointer', color: newPublic ? SECONDARY : SUB, fontSize: 13, fontFamily: FONT, transition: 'all 0.15s' }}
                                    >
                                        {newPublic ? <Globe size={13} /> : <Lock size={13} />}
                                        {newPublic ? 'Public' : 'Private'}
                                    </button>
                                    {createError && <div style={{ fontSize: 12, color: TERTIARY }}>{createError}</div>}
                                    <button
                                        onClick={createPlaylist}
                                        disabled={!newName.trim() || creating}
                                        style={{ padding: '10px', background: newName.trim() ? PRIMARY : S_HIGH, border: 'none', borderRadius: 8, color: newName.trim() ? '#fff' : SUB, fontSize: 13, fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default', fontFamily: FONT, transition: 'all 0.15s' }}
                                    >
                                        {creating ? 'Creating…' : 'Create Playlist'}
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={14} color={PRIMARY} />
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Overview</h3>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { label: 'Total Playlists', value: String(playlists.length), color: TEXT },
                                        { label: 'Total Tracks', value: fmtNum(totalTracks), color: SECONDARY },
                                        { label: 'Total Plays', value: fmtNum(totalPlays), color: PRIMARY },
                                    ].map(s => (
                                        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, color: SUB }}>{s.label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div>
                            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Your Playlists</h2>

                            {loading ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center', color: SUB }}>Loading…</div>
                            ) : playlists.length === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
                                    <Layers size={36} color={SUB} style={{ marginBottom: 14 }} />
                                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No playlists yet</div>
                                    <div style={{ fontSize: 13, color: SUB }}>Create your first playlist using the form on the left.</div>
                                </div>
                            ) : (
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    {playlists.map((pl, i) => {
                                        const isLast = i === playlists.length - 1;
                                        const isEditing = editingId === pl.id;
                                        const isDeleting = deletingId === pl.id;

                                        return (
                                            <div
                                                key={pl.id}
                                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}` }}
                                            >
                                                {/* Cover mosaic */}
                                                <Link to={`/preview/alt_f_playlist?id=${pl.id}`} style={{ flexShrink: 0 }}>
                                                    <MosaicCover playlist={pl} size={52} />
                                                </Link>

                                                {/* Info / inline edit */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {isEditing ? (
                                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                            <input
                                                                autoFocus
                                                                value={editDraft}
                                                                onChange={e => setEditDraft(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(pl.id); if (e.key === 'Escape') setEditingId(null); }}
                                                                style={{ flex: 1, padding: '6px 10px', background: S_CONT, border: `1px solid ${PRIMARY}60`, borderRadius: 6, color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT }}
                                                            />
                                                            <button onClick={() => saveEdit(pl.id)} disabled={saving} style={{ background: PRIMARY, border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'flex', color: '#fff' }}><Check size={14} /></button>
                                                            <button onClick={() => setEditingId(null)} style={{ background: S_HIGH, border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'flex', color: SUB }}><X size={14} /></button>
                                                        </div>
                                                    ) : (
                                                        <Link
                                                            to={`/preview/alt_f_playlist?id=${pl.id}`}
                                                            style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none', color: 'inherit' }}
                                                        >
                                                            {pl.name}
                                                        </Link>
                                                    )}
                                                    {!isEditing && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                                                            <span style={{ fontSize: 11, color: SUB }}>{pl.trackCount} tracks</span>
                                                            {pl.totalPlays > 0 && <span style={{ fontSize: 11, color: SUB }}>{fmtNum(pl.totalPlays)} plays</span>}
                                                            {pl.releaseType && (
                                                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 4, background: `${RELEASE_COLORS[pl.releaseType] || SUB}20`, color: RELEASE_COLORS[pl.releaseType] || SUB }}>{pl.releaseType}</span>
                                                            )}
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: pl.isPublic ? SECONDARY : SUB }}>
                                                                {pl.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                                                                {pl.isPublic ? 'Public' : 'Private'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Updated date */}
                                                <div style={{ fontSize: 11, color: `${SUB}88`, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                                                    {!isEditing && !isDeleting && fmtDate(pl.updatedAt)}
                                                </div>

                                                {/* Actions */}
                                                {isDeleting ? (
                                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                        <button onClick={() => deletePlaylist(pl.id)} style={{ padding: '6px 12px', background: TERTIARY, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Delete</button>
                                                        <button onClick={() => setDeletingId(null)} style={{ padding: '6px 10px', background: S_HIGH, border: 'none', borderRadius: 6, color: SUB, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                                                    </div>
                                                ) : !isEditing ? (
                                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                        <Link to={`/preview/alt_f_playlist?id=${pl.id}`} title="Open" style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, transition: 'all 0.1s', textDecoration: 'none' }}
                                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S_HIGH; (e.currentTarget as HTMLElement).style.color = TEXT; }}
                                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = SUB; }}
                                                        ><Play size={13} /></Link>
                                                        <button onClick={() => { setEditingId(pl.id); setEditDraft(pl.name); }} title="Rename" style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, transition: 'all 0.1s' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = S_HIGH; e.currentTarget.style.color = TEXT; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = SUB; }}
                                                        ><Pencil size={13} /></button>
                                                        <button onClick={() => setDeletingId(pl.id)} title="Delete" style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, transition: 'all 0.1s' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = `${TERTIARY}1a`; e.currentTarget.style.color = TERTIARY; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = SUB; }}
                                                        ><Trash2 size={13} /></button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
