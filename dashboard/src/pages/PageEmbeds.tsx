import React, { useState, useEffect } from 'react';
import { Globe, Edit2, Trash2, Plus, Save, X, Image, ExternalLink, AlertCircle } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = import.meta.env.VITE_API_URL ?? '';

const KNOWN_PATHS = [
  { path: '/',        label: 'Home / Discover' },
  { path: '/battles', label: 'Beat Battles' },
  { path: '/arena',   label: '1v1 Arena' },
  { path: '/genres',  label: 'Genres' },
  { path: '/artists', label: 'Artists' },
  { path: '/library', label: 'Music Library' },
  { path: '/learn',   label: 'Fuji Academy' },
  { path: '/charts',  label: 'Charts' },
  { path: '/new',     label: 'Latest Releases' },
  { path: '/appeal',  label: 'Support & Appeals' },
];

interface PageEmbed {
  id: string;
  path: string;
  title: string;
  description: string;
  imageUrl: string | null;
  updatedAt: string;
}

interface EditState {
  path: string;
  title: string;
  description: string;
  imageUrl: string;
}

export const PageEmbedsPage: React.FC = () => {
  const [embeds, setEmbeds] = useState<PageEmbed[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPath, setNewPath] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/page-embeds`, { credentials: 'include' });
      if (res.ok) setEmbeds(await res.json());
    } catch { setError('Failed to load embeds.'); }
    finally { setLoading(false); }
  };

  const embedMap = new Map(embeds.map(e => [e.path, e]));

  // Merge known paths + any custom DB entries not in the known list
  const allPaths: { path: string; label: string; custom?: boolean }[] = [
    ...KNOWN_PATHS,
    ...embeds.filter(e => !KNOWN_PATHS.some(k => k.path === e.path)).map(e => ({ path: e.path, label: e.path, custom: true })),
  ];

  const startEdit = (path: string, label: string) => {
    const existing = embedMap.get(path);
    setEditing({
      path,
      title: existing?.title ?? label + ' | Fuji Studio',
      description: existing?.description ?? '',
      imageUrl: existing?.imageUrl ?? '',
    });
    setError('');
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/api/admin/page-embeds`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: editing.path, title: editing.title, description: editing.description, imageUrl: editing.imageUrl }),
      });
      if (!res.ok) { setError('Failed to save.'); return; }
      const saved = await res.json();
      setEmbeds(prev => {
        const next = prev.filter(e => e.path !== saved.path);
        return [...next, saved].sort((a, b) => a.path.localeCompare(b.path));
      });
      setEditing(null);
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const remove = async (path: string) => {
    const encoded = path.replace(/^\//, '');
    await fetch(`${API}/api/admin/page-embeds/${encoded}`, { method: 'DELETE', credentials: 'include' });
    setEmbeds(prev => prev.filter(e => e.path !== path));
  };

  const addCustom = () => {
    if (!newPath.trim()) return;
    const p = newPath.trim().startsWith('/') ? newPath.trim() : `/${newPath.trim()}`;
    setShowAddForm(false);
    setNewPath('');
    startEdit(p, p);
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: spacing.lg,
    padding: `${spacing.md} ${spacing.lg}`,
    borderBottom: `1px solid rgba(255,255,255,0.05)`,
    borderRadius: borderRadius.sm,
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xxl }}>
        <Globe size={32} color={colors.primary} style={{ marginRight: spacing.lg }} />
        <div>
          <h1 style={{ margin: 0 }}>Page Embeds</h1>
          <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
            Customise the title, description and image shown when a link is shared on Discord, Twitter, etc.
          </p>
        </div>
      </div>

      {/* Info block */}
      <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
        <p style={{ margin: 0, color: colors.textPrimary, fontSize: '0.9rem' }}>
          Dynamic pages (artist profiles, tracks, battles, playlists, articles) automatically generate their embeds from real content. The pages below let you customise the embed for static routes and any path not covered by dynamic generation.
        </p>
      </div>

      {/* Page list */}
      <div style={{ background: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.lg }}>
        {/* Column headers */}
        <div style={{ ...rowStyle, background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{ flex: '0 0 140px', fontSize: '0.75rem', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Path</div>
          <div style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current embed</div>
          <div style={{ flex: '0 0 80px' }} />
        </div>

        {loading ? (
          <div style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary, fontSize: '0.85rem' }}>Loading…</div>
        ) : allPaths.map(({ path, label, custom }) => {
          const existing = embedMap.get(path);
          const isEditing = editing?.path === path;

          return (
            <div key={path}>
              {/* Row */}
              {!isEditing && (
                <div style={rowStyle}>
                  <div style={{ flex: '0 0 140px' }}>
                    <code style={{ fontSize: '0.8rem', color: colors.primary, background: 'rgba(242, 120, 10,0.1)', padding: '2px 6px', borderRadius: 4 }}>{path}</code>
                    {custom && <div style={{ fontSize: '0.7rem', color: colors.textTertiary, marginTop: 2 }}>Custom</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {existing ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{existing.title}</div>
                        {existing.description && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{existing.description}</div>}
                        {existing.imageUrl && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: colors.textTertiary, marginTop: 2 }}>
                            <Image size={11} /> Custom image set
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: colors.textTertiary, fontStyle: 'italic' }}>Using default — click Edit to customise</span>
                    )}
                  </div>
                  <div style={{ flex: '0 0 80px', display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
                    <button onClick={() => startEdit(path, label)} title="Edit" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: borderRadius.sm, padding: '6px 10px', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center' }}>
                      <Edit2 size={14} />
                    </button>
                    {existing && custom && (
                      <button onClick={() => remove(path)} title="Delete" style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: borderRadius.sm, padding: '6px 10px', cursor: 'pointer', color: colors.error, display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Inline edit form */}
              {isEditing && editing && (
                <div style={{ padding: spacing.lg, background: 'rgba(242, 120, 10,0.04)', borderTop: `1px solid rgba(242, 120, 10,0.15)`, borderBottom: `1px solid rgba(242, 120, 10,0.15)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                    <code style={{ fontSize: '0.8rem', color: colors.primary, background: 'rgba(242, 120, 10,0.1)', padding: '2px 6px', borderRadius: 4 }}>{editing.path}</code>
                    <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>— editing embed</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg, marginBottom: spacing.lg }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: 600 }}>Title <span style={{ color: colors.error }}>*</span></label>
                      <input
                        value={editing.title}
                        onChange={e => setEditing({ ...editing, title: e.target.value })}
                        placeholder="Page Title | Fuji Studio"
                        style={{ width: '100%', background: colors.background, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', boxSizing: 'border-box' }}
                      />
                      <div style={{ fontSize: '0.7rem', color: colors.textTertiary, marginTop: 4 }}>{editing.title.length}/60 chars recommended</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: 600 }}>Image URL</label>
                      <div style={{ display: 'flex', gap: spacing.sm }}>
                        <input
                          value={editing.imageUrl}
                          onChange={e => setEditing({ ...editing, imageUrl: e.target.value })}
                          placeholder="https://… or leave blank for default"
                          style={{ flex: 1, background: colors.background, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem' }}
                        />
                        {editing.imageUrl && (
                          <a href={editing.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', padding: `${spacing.sm} ${spacing.md}`, background: 'rgba(255,255,255,0.06)', borderRadius: borderRadius.md, color: colors.textSecondary }}>
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: colors.textTertiary, marginTop: 4 }}>Recommended: 1200×630px (1.91:1)</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: spacing.lg }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: 600 }}>Description</label>
                    <textarea
                      value={editing.description}
                      onChange={e => setEditing({ ...editing, description: e.target.value })}
                      placeholder="A short description shown below the title in the embed preview…"
                      rows={2}
                      style={{ width: '100%', background: colors.background, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: '0.7rem', color: colors.textTertiary, marginTop: 4 }}>{editing.description.length}/160 chars recommended</div>
                  </div>

                  {/* Discord embed preview */}
                  <div style={{ marginBottom: spacing.lg }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: spacing.sm }}>Preview</div>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', maxWidth: 400, background: '#2b2d31', borderRadius: 4, borderLeft: `4px solid ${colors.primary}`, padding: '12px 14px', gap: 4 }}>
                      <div style={{ fontSize: '0.75rem', color: '#00b0f4', fontWeight: 600 }}>fujistud.io</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00b0f4' }}>{editing.title || 'Title'}</div>
                      {editing.description && <div style={{ fontSize: '0.85rem', color: '#dbdee1', lineHeight: 1.4 }}>{editing.description.slice(0, 160)}</div>}
                      {editing.imageUrl && <img src={editing.imageUrl} alt="" style={{ marginTop: 8, borderRadius: 4, maxWidth: '100%', maxHeight: 120, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    </div>
                  </div>

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.error, fontSize: '0.85rem', marginBottom: spacing.md }}><AlertCircle size={14} />{error}</div>}

                  <div style={{ display: 'flex', gap: spacing.md }}>
                    <button onClick={save} disabled={saving || !editing.title.trim()} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm} ${spacing.lg}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 700, opacity: saving || !editing.title.trim() ? 0.6 : 1 }}>
                      <Save size={14} />{saving ? 'Saving…' : 'Save Embed'}
                    </button>
                    <button onClick={() => { setEditing(null); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm} ${spacing.lg}`, background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer' }}>
                      <X size={14} />Cancel
                    </button>
                    {existing && (
                      <button onClick={async () => { await remove(path); setEditing(null); }} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm} ${spacing.lg}`, background: 'rgba(239,68,68,0.1)', color: colors.error, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer' }}>
                        <Trash2 size={14} />Reset to default
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add custom path */}
      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm} ${spacing.lg}`, background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: `1px dashed rgba(255,255,255,0.15)`, borderRadius: borderRadius.md, cursor: 'pointer', fontSize: '0.85rem' }}>
          <Plus size={14} />Add custom path
        </button>
      ) : (
        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
          <input
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowAddForm(false); }}
            placeholder="/my-custom-page"
            autoFocus
            style={{ flex: 1, maxWidth: 300, background: colors.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontSize: '0.9rem' }}
          />
          <button onClick={addCustom} style={{ padding: `${spacing.sm} ${spacing.lg}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Add</button>
          <button onClick={() => { setShowAddForm(false); setNewPath(''); }} style={{ padding: `${spacing.sm} ${spacing.md}`, background: 'transparent', color: colors.textSecondary, border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}
    </div>
  );
};
