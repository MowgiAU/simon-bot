import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { Settings, Plus, X, List, Music, Database, Edit3, Trash2 } from 'lucide-react';

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

export const MusicianProfileAdmin: React.FC = () => {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGenreName, setNewGenreName] = useState('');
    const [newGenreParent, setNewGenreParent] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchGenres();
    }, []);

    const fetchGenres = async () => {
        try {
            const res = await axios.get('/api/musician/genres', { withCredentials: true });
            setGenres(res.data);
        } catch (err) {
            console.error('Failed to load genres');
        } finally {
            setLoading(false);
        }
    };

    const handleAddGenre = async () => {
        if (!newGenreName) return;
        setSaving(true);
        try {
            await axios.post('/api/musician/genres', {
                name: newGenreName,
                parentId: newGenreParent || null
            }, { withCredentials: true });
            setNewGenreName('');
            setNewGenreParent('');
            setMsg({ type: 'success', text: 'Genre added successfully!' });
            fetchGenres();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to add genre' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGenre = async (id: string) => {
        if (!window.confirm('Are you sure? This will affect all users with this genre!')) return;
        try {
            await axios.delete(`/api/musician/genres/${id}`, { withCredentials: true });
            setMsg({ type: 'success', text: 'Genre deleted.' });
            fetchGenres();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to delete genre' });
        }
    };

    if (loading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading admin settings...</div>;

    const rootGenres = genres.filter(g => !g.parentId);

    return (
        <div style={{ padding: spacing.lg, maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Settings size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Musician Profiles Configuration</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage global genre libraries and profile settings.</p>
                </div>
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Administrators can manage the list of genres users can pick from. Deleting a genre will remove it from all user profiles.
                </p>
            </div>

            {msg && (
                <div style={{ padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, backgroundColor: msg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', color: msg.type === 'success' ? '#4caf50' : '#f44336' }}>
                    {msg.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xl }}>
                {/* Genre Library */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <List size={20} /> Current Library
                    </h3>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {rootGenres.length === 0 && <p style={{ color: colors.textSecondary }}>No genres configured.</p>}
                        {rootGenres.map(parent => (
                            <div key={parent.id} style={{ marginBottom: spacing.md }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span>{parent.name}</span>
                                    <Trash2 size={16} style={{ cursor: 'pointer', color: '#ff4444' }} onClick={() => handleDeleteGenre(parent.id)} />
                                </div>
                                <div style={{ paddingLeft: spacing.lg }}>
                                    {genres.filter(g => g.parentId === parent.id).map(sub => (
                                        <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem', color: colors.textSecondary }}>
                                            <span>• {sub.name}</span>
                                            <Trash2 size={14} style={{ cursor: 'pointer', color: 'rgba(255,0,0,0.5)' }} onClick={() => handleDeleteGenre(sub.id)} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add New Genre */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={20} /> Add New Genre
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Genre Name</label>
                            <input 
                                type="text" 
                                value={newGenreName} 
                                onChange={(e) => setNewGenreName(e.target.value)}
                                placeholder="e.g. Future Bass"
                                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, marginTop: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Parent Category (Optional)</label>
                            <select 
                                value={newGenreParent} 
                                onChange={(e) => setNewGenreParent(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    border: 'none', 
                                    borderRadius: borderRadius.sm, 
                                    padding: spacing.sm, 
                                    color: colors.textPrimary, 
                                    marginTop: '4px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>None (Top Level)</option>
                                {rootGenres.map(g => (
                                    <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleAddGenre}
                            disabled={saving || !newGenreName}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: spacing.md, cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {saving ? 'Saving...' : 'Create Genre'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
