import React, { useState, useEffect } from 'react';
import { colors } from '../theme/theme';
import axios from 'axios';
import { X, Plus, Check, ListMusic, Music } from 'lucide-react';

interface Playlist {
    id: string;
    name: string;
    coverUrl: string | null;
    trackCount: number;
}

interface Props {
    trackId: string;
    open: boolean;
    onClose: () => void;
}

export const AddToPlaylistModal: React.FC<Props> = ({ trackId, open, onClose }) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<string | null>(null);
    const [added, setAdded] = useState<Set<string>>(new Set());
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        axios.get('/api/my-playlists', { withCredentials: true })
            .then(res => setPlaylists(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open]);

    const addToPlaylist = async (playlistId: string) => {
        setAdding(playlistId);
        try {
            await axios.post(`/api/playlists/${playlistId}/tracks`, { trackId }, { withCredentials: true });
            setAdded(prev => new Set(prev).add(playlistId));
        } catch {}
        setAdding(null);
    };

    const createAndAdd = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const { data } = await axios.post('/api/playlists', { name: newName.trim() }, { withCredentials: true });
            await axios.post(`/api/playlists/${data.id}/tracks`, { trackId }, { withCredentials: true });
            setPlaylists(prev => [data, ...prev]);
            setAdded(prev => new Set(prev).add(data.id));
            setNewName('');
        } catch {}
        setCreating(false);
    };

    if (!open) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1A1E2E', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '90%', maxWidth: '400px', maxHeight: '500px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><ListMusic size={18} color={colors.primary} /> Add to Playlist</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#B9C3CE', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
                </div>

                {/* Create new */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="New playlist name..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && createAndAdd()}
                        style={{ flex: 1, backgroundColor: '#242C3D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: 'white', fontSize: '12px', outline: 'none' }}
                    />
                    <button
                        onClick={createAndAdd}
                        disabled={creating || !newName.trim()}
                        style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: creating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 'bold', opacity: creating || !newName.trim() ? 0.5 : 1 }}
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* Playlist list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#B9C3CE', fontSize: '12px' }}>Loading...</div>
                    ) : playlists.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#B9C3CE', fontSize: '12px' }}>No playlists yet. Create one above!</div>
                    ) : (
                        playlists.map(pl => (
                            <button
                                key={pl.id}
                                onClick={() => !added.has(pl.id) && addToPlaylist(pl.id)}
                                disabled={adding === pl.id || added.has(pl.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                                    padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none',
                                    color: 'white', cursor: added.has(pl.id) ? 'default' : 'pointer',
                                    textAlign: 'left', transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => !added.has(pl.id) && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: '#242C3D', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {pl.coverUrl ? <img src={pl.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} color={colors.primary} style={{ opacity: 0.3 }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#B9C3CE' }}>{pl.trackCount} tracks</p>
                                </div>
                                {added.has(pl.id) ? (
                                    <Check size={16} color={colors.primary} />
                                ) : adding === pl.id ? (
                                    <span style={{ fontSize: '10px', color: '#B9C3CE' }}>...</span>
                                ) : (
                                    <Plus size={16} color="#B9C3CE" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
