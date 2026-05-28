import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FolderOpen, Clock, HardDrive, FileAudio, ChevronLeft,
  Download, Upload, Music, Check, X, Edit3, Save,
  Globe, Lock, Trash2, FileText, AlertCircle, ExternalLink,
} from 'lucide-react';

const card: React.CSSProperties = {
  backgroundColor: colors.surface,
  borderRadius: borderRadius.lg,
  border: `1px solid ${colors.glassBorder}`,
  padding: '20px',
};

const inputBase: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: borderRadius.sm,
  padding: '10px 12px',
  color: colors.textPrimary,
  fontSize: '14px',
  outline: 'none',
};

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 16px', borderRadius: borderRadius.md,
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: 'none', transition: 'opacity 0.15s',
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Publish state
  const [showPublish, setShowPublish] = useState(false);
  const [publishVersionId, setPublishVersionId] = useState<string | null>(null);
  const [userTracks, setUserTracks] = useState<any[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    if (!user) { setLoading(false); return; }
    try {
      const r = await axios.get(`/api/projects/${projectId}`, { withCredentials: true });
      setProject(r.data);
    } catch (e) {
      console.error('Failed to fetch project', e);
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const r = await axios.put(`/api/projects/${projectId}`, { name: editName, description: editDesc }, { withCredentials: true });
      setProject((prev: any) => ({ ...prev, ...r.data }));
      setEditing(false);
    } catch (e) {
      console.error('Failed to update project', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this project permanently? All versions will be lost.')) return;
    try {
      await axios.delete(`/api/projects/${projectId}`, { withCredentials: true });
      navigate('/projects');
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  };

  const openPublish = async (versionId: string) => {
    setPublishVersionId(versionId);
    setSelectedTrackId('');
    setUserTracks([]);
    setShowPublish(true);
    try {
      const profileRes = await axios.get(`/api/musician/profile/${user!.id}`, { withCredentials: true });
      const tracks = profileRes.data?.tracks || [];
      setUserTracks(tracks.filter((t: any) => !t.deletedAt));
    } catch (e) {
      console.error('Failed to fetch tracks', e);
    }
  };

  const handlePublish = async () => {
    if (!publishVersionId || !selectedTrackId) return;
    setPublishing(true);
    try {
      await axios.post(`/api/projects/${projectId}/publish`, {
        versionId: publishVersionId,
        trackId: selectedTrackId,
      }, { withCredentials: true });
      await fetchProject();
      setShowPublish(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to publish';
      alert(msg);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async (trackId: string) => {
    if (!confirm('Unpublish this project from the track?')) return;
    try {
      await axios.post(`/api/projects/${projectId}/unpublish`, { trackId }, { withCredentials: true });
      await fetchProject();
    } catch (e) {
      console.error('Failed to unpublish', e);
    }
  };

  const handleDownload = async (versionId: string) => {
    try {
      const r = await axios.get(`/api/projects/${projectId}/download/${versionId}`, {
        withCredentials: true,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      const contentDisp = r.headers['content-disposition'] || '';
      const match = contentDisp.match(/filename\*=UTF-8''(.+)/);
      a.download = match ? decodeURIComponent(match[1]) : `project-v${versionId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download version', e);
    }
  };

  if (loading || authLoading) {
    return (
      <DiscoveryLayout activeTab="profile">
        <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textTertiary }}>Loading project...</div>
      </DiscoveryLayout>
    );
  }

  if (!project) {
    return (
      <DiscoveryLayout activeTab="profile">
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <AlertCircle size={48} color={colors.textTertiary} style={{ marginBottom: '16px' }} />
          <p style={{ color: colors.textSecondary }}>Project not found</p>
          <button onClick={() => navigate('/projects')} style={{ ...btn, background: colors.primary, color: '#fff', marginTop: '12px' }}>
            <ChevronLeft size={16} /> Back to Projects
          </button>
        </div>
      </DiscoveryLayout>
    );
  }

  const publishedLink = project.trackLinks?.[0];

  return (
    <DiscoveryLayout activeTab="profile">
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Back + Header */}
        <button
          onClick={() => navigate('/projects')}
          style={{ ...btn, background: 'none', color: colors.textSecondary, marginBottom: '16px', padding: '4px 8px' }}
        >
          <ChevronLeft size={16} /> Back to Projects
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: borderRadius.md,
              background: 'rgba(16,185,129,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FolderOpen size={26} color={colors.primary} />
            </div>
            <div>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inputBase, width: '300px', maxWidth: '100%' }} />
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{ ...inputBase, width: '300px', maxWidth: '100%', resize: 'vertical' }} placeholder="Description..." />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleSave} disabled={saving} style={{ ...btn, background: colors.primary, color: '#fff' }}>
                      <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(false)} style={{ ...btn, background: 'rgba(255,255,255,0.05)', color: colors.textSecondary }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: colors.textPrimary }}>{project.name}</h1>
                  {project.description && (
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>{project.description}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {!editing && (
              <button onClick={() => { setEditName(project.name); setEditDesc(project.description || ''); setEditing(true); }} style={{ ...btn, background: 'rgba(255,255,255,0.05)', color: colors.textSecondary }}>
                <Edit3 size={14} /> Edit
              </button>
            )}
            <button onClick={handleDelete} style={{ ...btn, background: 'rgba(239,68,68,0.1)', color: colors.error }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Published state banner */}
        {publishedLink && (
          <div style={{
            ...card, marginBottom: '24px',
            borderLeft: `4px solid ${colors.primary}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Globe size={20} color={colors.primary} />
              <div>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '14px', fontWeight: 600 }}>
                  Published to track
                </p>
                <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '12px' }}>
                  Version {publishedLink.versionId ? project.versions?.find((v: any) => v.id === publishedLink.versionId)?.versionNumber : ''} — {publishedLink.track?.title || 'Unknown track'}
                </p>
              </div>
            </div>
            <button onClick={() => handleUnpublish(publishedLink.trackId)} style={{ ...btn, background: 'rgba(239,68,68,0.1)', color: colors.error }}>
              <Lock size={14} /> Unpublish
            </button>
          </div>
        )}

        {/* Version History */}
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>
          <Clock size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Version History
        </h2>

        {(!project.versions || project.versions.length === 0) ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
            <Upload size={36} style={{ marginBottom: '12px', opacity: 0.3, color: colors.textTertiary }} />
            <p style={{ color: colors.textSecondary, margin: 0 }}>No versions synced yet</p>
            <p style={{ color: colors.textTertiary, fontSize: '12px', margin: '4px 0 0' }}>
              Use the Fuji Studio Desktop app to sync your FL Studio projects
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {project.versions.map((version: any) => (
              <div key={version.id} style={{ ...card }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: borderRadius.sm,
                      background: 'rgba(16,185,129,0.08)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: colors.primary,
                    }}>
                      v{version.versionNumber}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '14px' }}>
                        Version {version.versionNumber}
                        {version.message && <span style={{ color: colors.textSecondary, fontWeight: 400 }}> — {version.message}</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '2px' }}>
                        {formatDate(version.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '11px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '12px', marginRight: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><FileAudio size={12} /> {version.fileEntries?.length || version.totalFiles} files</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><HardDrive size={12} /> {formatSize(Number(version.totalSize))}</span>
                      {version.isParsed && <span style={{ color: colors.primary }}><Check size={12} /> FLP parsed</span>}
                    </div>
                    <button onClick={() => handleDownload(version.id)} style={{ ...btn, background: 'rgba(255,255,255,0.05)', color: colors.textSecondary }}>
                      <Download size={14} />
                    </button>
                    {(!publishedLink || publishedLink.versionId !== version.id) && (
                      <button onClick={() => openPublish(version.id)} style={{ ...btn, background: 'rgba(16,185,129,0.1)', color: colors.primary }}>
                        <Globe size={14} /> Publish
                      </button>
                    )}
                  </div>
                </div>

                {/* File list */}
                {version.fileEntries && version.fileEntries.length > 0 && (
                  <div style={{
                    marginTop: '8px', padding: '8px 12px',
                    background: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.sm,
                    maxHeight: '120px', overflowY: 'auto',
                  }}>
                    {version.fileEntries.map((entry: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0', fontSize: '12px', color: colors.textTertiary }}>
                        <FileAudio size={12} style={{ flexShrink: 0 }} />
                        <span style={{ color: colors.textSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.filePath}
                        </span>
                        <span>{formatSize(entry.fileSize)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        <h2 style={{ margin: '32px 0 16px', fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>
          <HardDrive size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Storage
        </h2>
        <div style={{ ...card, fontSize: '13px', color: colors.textSecondary }}>
          <p style={{ margin: 0 }}>
            All project files are stored on Cloudflare R2 with content-addressable blob storage.
            Files are deduplicated across versions — unchanged files only exist once in storage.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            Total versions: {project.versions?.length || 0} &middot;
            Created: {formatDate(project.createdAt)} &middot;
            Last sync: {project.versions?.[0] ? formatDate(project.versions[0].createdAt) : 'Never'}
          </p>
        </div>
      </div>

      {/* Publish Modal */}
      {showPublish && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px',
        }}>
          <div style={{
            ...card, maxWidth: '480px', width: '100%',
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '16px', fontWeight: 600 }}>
                <Globe size={18} color={colors.primary} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Publish Version
              </h3>
              <button onClick={() => setShowPublish(false)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(16,185,129,0.06)', borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.primary}` }}>
              <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px' }}>
                Pick one of your tracks to attach this version to. A ZIP containing the project file,
                samples, rendered audio, and metadata will be generated and made available on the
                track page.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attach to track
              </label>
              {userTracks.length === 0 ? (
                <div style={{ padding: '14px', background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.25)`, borderRadius: borderRadius.md, color: colors.warning, fontSize: '13px', display: 'flex', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    You don't have any tracks yet. Upload a track from <strong>My Tracks</strong> first,
                    then return here to attach this project version.
                  </div>
                </div>
              ) : (
                <>
                  <select
                    value={selectedTrackId}
                    onChange={e => setSelectedTrackId(e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.glassBorder}`,
                      borderRadius: borderRadius.sm, padding: '10px 12px', color: colors.textPrimary, fontSize: '14px',
                    }}
                  >
                    <option value="">Select a track…</option>
                    {userTracks.map((t: any) => (
                      <option key={t.id} value={t.id} disabled={!!t.projectZipUrl}>
                        {t.title}{t.projectZipUrl ? ' (already has a project)' : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: colors.textTertiary }}>
                    Tracks that already have a linked project version are disabled. Unpublish the existing
                    link first if you want to replace it.
                  </p>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPublish(false)} style={{ ...btn, background: 'rgba(255,255,255,0.05)', color: colors.textSecondary }}>
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !selectedTrackId}
                style={{ ...btn, background: selectedTrackId ? colors.primary : colors.surfaceLight, color: '#fff', opacity: publishing ? 0.6 : 1, cursor: selectedTrackId ? 'pointer' : 'not-allowed' }}
              >
                {publishing ? 'Publishing…' : <><Globe size={14} /> Publish</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </DiscoveryLayout>
  );
};
