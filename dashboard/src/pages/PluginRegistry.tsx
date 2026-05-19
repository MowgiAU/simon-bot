import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Puzzle, Plus, Edit3, Trash2, Upload, X, ExternalLink, Save, Search } from 'lucide-react';

interface KnownPlugin {
    id: string;
    name: string;
    aliases: string[];
    displayName: string | null;
    imageUrl: string | null;
    link: string | null;
    category: string | null;
    description: string | null;
    isActive: boolean;
}

const CATEGORIES = ['synth', 'effect', 'sampler', 'utility', 'other'];

const empty = (): Partial<KnownPlugin> => ({
    name: '', aliases: [], displayName: '', link: '', category: '', description: '', isActive: true,
});

export const PluginRegistry: React.FC = () => {
    const [plugins, setPlugins] = useState<KnownPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<KnownPlugin | null>(null);
    const [form, setForm] = useState<Partial<KnownPlugin>>(empty());
    const [aliasInput, setAliasInput] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/admin/plugins/registry', { withCredentials: true });
            setPlugins(r.data);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const openNew = () => {
        setEditing(null);
        setForm(empty());
        setAliasInput('');
        setImageFile(null);
        setImagePreview('');
        setShowForm(true);
    };

    const openEdit = (p: KnownPlugin) => {
        setEditing(p);
        setForm({ ...p });
        setAliasInput('');
        setImageFile(null);
        setImagePreview('');
        setShowForm(true);
    };

    const closeForm = () => { setShowForm(false); setEditing(null); setForm(empty()); };

    const handleSave = async () => {
        if (!form.name?.trim()) { setMsg('Name is required'); return; }
        setSaving(true);
        setMsg('');
        try {
            let plugin: KnownPlugin;
            if (editing) {
                const r = await axios.patch(`/api/admin/plugins/registry/${editing.id}`, form, { withCredentials: true });
                plugin = r.data;
            } else {
                const r = await axios.post('/api/admin/plugins/registry', form, { withCredentials: true });
                plugin = r.data;
            }
            if (imageFile) {
                const fd = new FormData();
                fd.append('pluginImage', imageFile);
                await axios.post(`/api/admin/plugins/registry/${plugin.id}/image`, fd, { withCredentials: true });
            }
            await fetch();
            closeForm();
        } catch (e: any) {
            setMsg(e.response?.data?.error || 'Failed to save');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this plugin entry?')) return;
        await axios.delete(`/api/admin/plugins/registry/${id}`, { withCredentials: true });
        fetch();
    };

    const addAlias = () => {
        const a = aliasInput.trim();
        if (!a) return;
        setForm(f => ({ ...f, aliases: [...(f.aliases || []), a] }));
        setAliasInput('');
    };

    const removeAlias = (i: number) => setForm(f => ({ ...f, aliases: (f.aliases || []).filter((_, idx) => idx !== i) }));

    const filtered = plugins.filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(search.toLowerCase())
    );

    const labelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '4px', display: 'block' };
    const inputStyle: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box' };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Puzzle size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Plugin Registry</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Match FL Studio plugins to images and affiliate links shown in project viewers.
                    </p>
                </div>
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Add plugin names exactly as they appear in FL Studio project files. When a user uploads a project, the viewer automatically matches plugin names and shows the image and link you set here. Use <strong>Aliases</strong> to catch alternate spellings (e.g. "Xfer Serum" and "SerumFX" both mapping to Serum).
                </p>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                    <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins..."
                        style={{ ...inputStyle, paddingLeft: '32px' }} />
                </div>
                <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                    <Plus size={14} /> Add Plugin
                </button>
                <span style={{ fontSize: '12px', color: colors.textTertiary, marginLeft: 'auto' }}>{plugins.length} plugins</span>
            </div>

            {/* Plugin grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textTertiary }}>Loading...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textTertiary }}>
                    <Puzzle size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
                    <p>{search ? `No plugins matching "${search}"` : 'No plugins yet. Add your first one.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {filtered.map(p => (
                        <div key={p.id} style={{ backgroundColor: colors.surface, border: `1px solid ${p.isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`, borderRadius: borderRadius.md, padding: '14px', opacity: p.isActive ? 1 : 0.5 }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                {/* Image */}
                                <div style={{ width: 48, height: 48, borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {p.imageUrl
                                        ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <Puzzle size={20} color={colors.textTertiary} style={{ opacity: 0.4 }} />
                                    }
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName || p.name}</div>
                                    <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '1px' }}>{p.name}</div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                        {p.category && (
                                            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', backgroundColor: `${colors.primary}18`, color: colors.primary, fontWeight: 600, textTransform: 'capitalize' }}>{p.category}</span>
                                        )}
                                        {p.link && (
                                            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <ExternalLink size={9} /> Link set
                                            </span>
                                        )}
                                        {(p.aliases?.length || 0) > 0 && (
                                            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textTertiary }}>{p.aliases!.length} alias{p.aliases!.length !== 1 ? 'es' : ''}</span>
                                        )}
                                    </div>
                                </div>
                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button onClick={() => openEdit(p)} title="Edit" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.textSecondary }}>
                                        <Edit3 size={12} />
                                    </button>
                                    <button onClick={() => handleDelete(p.id)} title="Delete" style={{ background: 'none', border: '1px solid rgba(255,0,0,0.15)', borderRadius: '6px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.error }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form modal */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
                    onClick={closeForm}>
                    <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1a1e2e', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: colors.textPrimary }}>{editing ? 'Edit Plugin' : 'Add Plugin'}</h3>
                            <button onClick={closeForm} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Name */}
                            <div>
                                <label style={labelStyle}>Plugin Name * <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(must match exactly as it appears in the FLP file)</span></label>
                                <input style={inputStyle} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Serum, FLEX, Vital" />
                            </div>

                            {/* Display name */}
                            <div>
                                <label style={labelStyle}>Display Name <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(optional cleaner name shown to users)</span></label>
                                <input style={inputStyle} value={form.displayName || ''} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="e.g. Xfer Serum" />
                            </div>

                            {/* Category */}
                            <div>
                                <label style={labelStyle}>Category</label>
                                <select value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    style={{ ...inputStyle, cursor: 'pointer' }}>
                                    <option value="">— Select category —</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                </select>
                            </div>

                            {/* Link */}
                            <div>
                                <label style={labelStyle}>Affiliate / Referral Link</label>
                                <input style={inputStyle} value={form.link || ''} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://xferrecords.com/serum?ref=fujistudio" />
                            </div>

                            {/* Image */}
                            <div>
                                <label style={labelStyle}>Plugin Image (logo or screenshot)</label>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ width: 60, height: 60, borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {(imagePreview || (editing?.imageUrl)) ? (
                                            <img src={imagePreview || editing?.imageUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : <Puzzle size={22} color={colors.textTertiary} style={{ opacity: 0.3 }} />}
                                    </div>
                                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: colors.textSecondary, fontSize: '12px' }}>
                                        <Upload size={13} /> {imageFile ? imageFile.name : 'Upload Image'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
                                        }} />
                                    </label>
                                </div>
                            </div>

                            {/* Aliases */}
                            <div>
                                <label style={labelStyle}>Aliases <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(other names this plugin might appear as in FLP files)</span></label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <input style={{ ...inputStyle, flex: 1 }} value={aliasInput} onChange={e => setAliasInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
                                        placeholder="e.g. SerumFX, Xfer Serum" />
                                    <button onClick={addAlias} style={{ padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>Add</button>
                                </div>
                                {(form.aliases || []).length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {(form.aliases || []).map((a, i) => (
                                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '12px', color: colors.textSecondary }}>
                                                {a}
                                                <button onClick={() => removeAlias(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: 0, lineHeight: 1, display: 'flex' }}><X size={10} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Active toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="checkbox" id="isActive" checked={form.isActive !== false} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} style={{ accentColor: colors.primary }} />
                                <label htmlFor="isActive" style={{ fontSize: '13px', color: colors.textSecondary, cursor: 'pointer' }}>Active (show in project viewer)</label>
                            </div>

                            {msg && <div style={{ fontSize: '12px', color: colors.error, padding: '8px', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: borderRadius.sm }}>{msg}</div>}

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                                <button onClick={closeForm} style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.sm, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', opacity: saving ? 0.7 : 1 }}>
                                    <Save size={14} /> {saving ? 'Saving...' : 'Save Plugin'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
