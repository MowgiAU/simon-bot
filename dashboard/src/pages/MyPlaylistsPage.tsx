import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import axios from 'axios';
import { Plus, Music, Lock, Globe, Trash2, ListMusic, X } from 'lucide-react';

interface Playlist {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    coverUrl: string | null;
    isPublic: boolean;
    trackCount: number;
    totalPlays: number;
    createdAt: string;
}

export const MyPlaylistsPage: React.FC = () => {
    const { user } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPublic, setNewPublic] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const { data } = await axios.get('/api/my-playlists', { withCredentials: true });
                setPlaylists(data);
            } catch {}
            setLoading(false);
        })();
    }, [user]);

    const createPlaylist = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const { data } = await axios.post('/api/playlists', { name: newName.trim(), description: newDesc.trim() || undefined, isPublic: newPublic }, { withCredentials: true });
            setPlaylists(prev => [data, ...prev]);
            setShowCreate(false);
            setNewName('');
            setNewDesc('');
            setNewPublic(true);
        } catch {}
        setCreating(false);
    };

    const deletePlaylist = async (id: string) => {
        try {
            await axios.delete(`/api/playlists/${id}`, { withCredentials: true });
            setPlaylists(prev => prev.filter(p => p.id !== id));
        } catch {}
    };

    if (!user) {
        return (
            <DiscoveryLayout>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: colors.textSecondary }}>
                    <a href="/api/auth/discord/login" style={{ color: colors.primary }}>Log in</a>&nbsp;to view your playlists
                </div>
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout>
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1300px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <ListMusic size={32} color={colors.primary} />
                        <div>
                            <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>My Playlists</h1>
                            <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Manage your music collections</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{
                            backgroundColor: colors.primary, color: 'white', border: 'none',
                            padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        }}
                    >
                        <Plus size={16} /> New Playlist
                    </button>
                </div>

                {/* Create modal */}
                {showCreate && (
                    <div style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Create New Playlist</h3>
                            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#B9C3CE', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input
                                type="text"
                                placeholder="Playlist name"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                style={{ backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', outline: 'none' }}
                            />
                            <textarea
                                placeholder="Description (optional)"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                rows={2}
                                style={{ backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#B9C3CE', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newPublic} onChange={e => setNewPublic(e.target.checked)} />
                                {newPublic ? <><Globe size={14} /> Public</> : <><Lock size={14} /> Private</>}
                            </label>
                            <button
                                onClick={createPlaylist}
                                disabled={creating || !newName.trim()}
                                style={{
                                    backgroundColor: colors.primary, color: 'white', border: 'none',
                                    padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                                    cursor: creating ? 'not-allowed' : 'pointer', opacity: creating || !newName.trim() ? 0.5 : 1,
                                }}
                            >
                                {creating ? 'Creating...' : 'Create Playlist'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Playlists grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Loading...</div>
                ) : playlists.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
                        <Music size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <p>No playlists yet. Create one to get started!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        {playlists.map(pl => (
                            <div key={pl.id} style={{ backgroundColor: '#242C3D', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${colors.primary}55`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                <Link to={`/playlist/${pl.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#1A1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                        {pl.coverUrl ? (
                                            <img src={pl.coverUrl} alt={pl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Music size={40} color={colors.primary} style={{ opacity: 0.2 }} />
                                        )}
                                        {!pl.isPublic && (
                                            <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '4px' }}>
                                                <Lock size={12} color="#FBBF24" />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '14px' }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#B9C3CE' }}>{pl.trackCount} tracks</p>
                                    </div>
                                </Link>
                                <div style={{ padding: '0 14px 10px', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => deletePlaylist(pl.id)}
                                        title="Delete playlist"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B9C3CE', padding: '4px', opacity: 0.4, transition: 'opacity 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
