import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FolderOpen, Plus, X, Clock, HardDrive, ChevronRight,
  Trash2, Music, FileAudio,
} from 'lucide-react';

const card: React.CSSProperties = {
  backgroundColor: colors.surface,
  borderRadius: borderRadius.lg,
  border: `1px solid ${colors.glassBorder}`,
  padding: '24px',
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

export const ProjectListPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;
    setLoading(true);
    axios.get('/api/projects', { withCredentials: true })
      .then(r => setProjects(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await axios.post('/api/projects', { name: newName, description: newDescription }, { withCredentials: true });
      setProjects(p => [r.data, ...p]);
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
    } catch (e: any) {
      console.error('Failed to create project', e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this project? All versions will be removed.')) return;
    try {
      await axios.delete(`/api/projects/${projectId}`, { withCredentials: true });
      setProjects(p => p.filter(pr => pr.id !== projectId));
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DiscoveryLayout activeTab="profile">
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.textPrimary }}>
              <FolderOpen size={28} color={colors.primary} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
              Projects
            </h1>
            <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '14px' }}>
              FL Studio project syncing via Fuji Studio Desktop
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: colors.primary, color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: borderRadius.md,
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={18} /> New Project
          </button>
        </div>

        {showCreate && (
          <div style={{ ...card, marginBottom: '24px', borderLeft: `4px solid ${colors.primary}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '16px', fontWeight: 600 }}>Create New Project</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Project Name *
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="My Beat Tape"
                style={inputBase}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Description
              </label>
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                style={{ ...inputBase, resize: 'vertical' as const }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{
                background: newName.trim() ? colors.primary : colors.textTertiary,
                color: '#fff', border: 'none', padding: '10px 24px', borderRadius: borderRadius.md,
                fontSize: '14px', fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: colors.textTertiary }}>Loading projects...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textSecondary }}>
            <FolderOpen size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No projects yet</p>
            <p style={{ fontSize: '13px', color: colors.textTertiary }}>Create a project and sync it with the Fuji Studio Desktop app</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {projects.map(project => {
              const latest = project.versions?.[0];
              const publishedTrack = project.trackLinks?.[0];
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{
                    ...card,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = colors.primary}
                  onMouseOut={e => e.currentTarget.style.borderColor = colors.glassBorder}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: borderRadius.md,
                      background: 'rgba(242, 120, 10,0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Music size={22} color={colors.primary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '15px', marginBottom: '4px' }}>
                        {project.name}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: colors.textTertiary }}>
                        {latest && (
                          <>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> v{latest.versionNumber}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <HardDrive size={12} /> {formatSize(Number(latest.totalSize))}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FileAudio size={12} /> {latest.totalFiles} files
                            </span>
                          </>
                        )}
                        {publishedTrack && (
                          <span style={{ color: colors.primary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Music size={12} /> Published
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(project.id); }}
                      style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: '6px' }}
                      title="Delete project"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DiscoveryLayout>
  );
};
