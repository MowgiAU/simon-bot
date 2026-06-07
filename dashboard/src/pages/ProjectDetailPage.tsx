import React, { useState, useEffect, useCallback, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrangementViewer, type ArrangementData } from '../components/ArrangementViewer';
import {
  FolderOpen, ChevronLeft, Music, Check, X, Edit3, Save,
  Trash2, AlertCircle, Upload, Play, Pause, Link, Link2Off,
  Download,
} from 'lucide-react';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const card: React.CSSProperties = {
  backgroundColor: colors.surface,
  borderRadius: borderRadius.lg,
  border: `1px solid ${colors.glassBorder}`,
  padding: '16px',
};

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '7px 14px', borderRadius: borderRadius.md,
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: 'none', transition: 'opacity 0.15s',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 8px', borderRadius: borderRadius.sm,
  fontSize: '11px', fontWeight: 600, cursor: 'pointer',
  background: 'transparent', border: 'none', color: colors.textTertiary,
};

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box' as const,
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: borderRadius.sm, padding: '8px 12px',
  color: colors.textPrimary, fontSize: '14px', outline: 'none',
};

interface Props { projectId?: string; }

export const ProjectDetailPage: React.FC<Props> = ({ projectId }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Publish state
  const [publishingVersionId, setPublishingVersionId] = useState<string | null>(null);
  const [userTracks, setUserTracks] = useState<any[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [zoom, setZoom] = useState(5.5);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const selectedVersion = project?.versions?.find((v: any) => v.id === selectedVersionId) ?? null;

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    if (!user) { setLoading(false); return; }
    try {
      const r = await axios.get(`/api/projects/${projectId}`, { withCredentials: true });
      setProject(r.data);
      setFetchError(null);
    } catch (e: any) {
      setFetchError(e?.response?.status ?? 0);
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Auto-select latest version when project loads
  useEffect(() => {
    if (project?.versions?.length > 0 && !selectedVersionId) {
      setSelectedVersionId(project.versions[0].id);
    }
  }, [project]);

  // Load audio when version changes
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    audioRef.current = null;
    isPlayingRef.current = false;
    currentTimeRef.current = 0;
    setIsPlaying(false);
    setAudioTime(0);
    setAudioDuration(0);
    if (!selectedVersion?.audioUrl) return;
    const audio = new Audio(selectedVersion.audioUrl);
    audio.addEventListener('loadedmetadata', () => setAudioDuration(audio.duration));
    audio.addEventListener('ended', () => { isPlayingRef.current = false; setIsPlaying(false); });
    audioRef.current = audio;
    return () => { audio.pause(); };
  }, [selectedVersion?.id]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
  }, []);

  const animate = useCallback(() => {
    if (audioRef.current && isPlayingRef.current) {
      const t = audioRef.current.currentTime;
      currentTimeRef.current = t;
      setAudioTime(t);
      rafRef.current = requestAnimationFrame(animate);
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      audioRef.current.play();
      isPlayingRef.current = true;
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(animate);
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * audioDuration;
    currentTimeRef.current = audioRef.current.currentTime;
    setAudioTime(audioRef.current.currentTime);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVersionId) return;
    setUploadingAudio(true);
    try {
      const form = new FormData();
      form.append('audio', file);
      await axios.post(`/api/projects/${projectId}/versions/${selectedVersionId}/audio`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      await fetchProject();
    } catch (err) {
      console.error('Audio upload failed', err);
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const removeAudio = async () => {
    if (!selectedVersionId) return;
    try {
      await axios.delete(`/api/projects/${projectId}/versions/${selectedVersionId}/audio`, { withCredentials: true });
      await fetchProject();
    } catch (err) {
      console.error('Failed to remove audio', err);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const r = await axios.put(`/api/projects/${projectId}`, { name: editName, description: editDesc }, { withCredentials: true });
      setProject((p: any) => ({ ...p, ...r.data }));
      setEditing(false);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this project permanently? All versions will be lost.')) return;
    try {
      await axios.delete(`/api/projects/${projectId}`, { withCredentials: true });
      navigate('/projects');
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleDownload = async (versionId: string) => {
    try {
      const r = await axios.get(`/api/projects/${projectId}/download/${versionId}`, {
        withCredentials: true, responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = r.headers['content-disposition'] || '';
      const m = cd.match(/filename\*=UTF-8''(.+)/);
      a.download = m ? decodeURIComponent(m[1]) : `project-v${versionId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const openPublish = async (versionId: string) => {
    setPublishingVersionId(versionId);
    setSelectedTrackId('');
    if (userTracks.length === 0) {
      try {
        const r = await axios.get(`/api/musician/profile/${user!.id}`, { withCredentials: true });
        const tracks = (r.data?.tracks || []).filter((t: any) => !t.deletedAt);
        setUserTracks(tracks);
        if (tracks.length > 0) setSelectedTrackId(tracks[0].id);
      } catch {}
    } else {
      setSelectedTrackId(userTracks[0]?.id ?? '');
    }
  };

  const confirmPublish = async () => {
    if (!publishingVersionId || !selectedTrackId) return;
    setPublishing(true);
    try {
      await axios.post(`/api/projects/${projectId}/publish`, { versionId: publishingVersionId, trackId: selectedTrackId }, { withCredentials: true });
      await fetchProject();
      setPublishingVersionId(null);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async (trackId: string) => {
    if (!confirm('Unpublish this project from the track?')) return;
    try {
      await axios.post(`/api/projects/${projectId}/unpublish`, { trackId }, { withCredentials: true });
      await fetchProject();
    } catch {}
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <DiscoveryLayout activeTab="profile">
        <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textTertiary }}>Loading project...</div>
      </DiscoveryLayout>
    );
  }

  if (!project) {
    const notLoggedIn = !user;
    const isUnauthorized = fetchError === 401 || fetchError === 403;
    return (
      <DiscoveryLayout activeTab="profile">
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <AlertCircle size={48} color={colors.textTertiary} style={{ marginBottom: '16px' }} />
          {notLoggedIn || isUnauthorized ? (
            <>
              <p style={{ color: colors.textSecondary }}>You need to be signed in to view this project.</p>
              <button onClick={() => navigate('/login')} style={{ ...btn, background: colors.primary, color: '#fff', marginTop: '12px' }}>
                Sign in
              </button>
            </>
          ) : (
            <>
              <p style={{ color: colors.textSecondary }}>Project not found</p>
              <button onClick={() => navigate('/projects')} style={{ ...btn, background: colors.primary, color: '#fff', marginTop: '12px' }}>
                <ChevronLeft size={16} /> Back to Projects
              </button>
            </>
          )}
        </div>
      </DiscoveryLayout>
    );
  }

  return (
    <DiscoveryLayout activeTab="profile">
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Back */}
        <button onClick={() => navigate('/projects')} style={{ ...ghostBtn, color: colors.textSecondary, marginBottom: '16px', fontSize: '13px' }}>
          <ChevronLeft size={16} /> Back to Projects
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 400 }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={inputBase} placeholder="Project name" />
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{ ...inputBase, resize: 'vertical' }} placeholder="Description (optional)" />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSave} disabled={saving} style={{ ...btn, background: colors.primary, color: '#fff' }}>
                    <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} style={{ ...btn, background: 'rgba(255,255,255,0.05)', color: colors.textSecondary, border: `1px solid ${colors.glassBorder}` }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: borderRadius.md, background: 'rgba(242, 120, 10,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderOpen size={22} color={colors.primary} />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{project.name}</h1>
                  {project.description && <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: 13 }}>{project.description}</p>}
                </div>
              </div>
            )}
          </div>
          {!editing && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => { setEditing(true); setEditName(project.name); setEditDesc(project.description || ''); }} style={{ ...ghostBtn, fontSize: '12px', color: colors.textSecondary }}>
                <Edit3 size={13} /> Edit
              </button>
              <button onClick={handleDelete} style={{ ...ghostBtn, fontSize: '12px', color: 'rgba(239,68,68,0.7)' }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

          {/* ── Versions sidebar ── */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            <div style={{ ...card, padding: '12px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textSecondary, marginBottom: 10, paddingLeft: 2 }}>
                Versions
              </div>
              {project.versions.length === 0 ? (
                <div style={{ fontSize: 12, color: colors.textTertiary, padding: '8px 4px' }}>No versions yet</div>
              ) : (
                project.versions.map((v: any) => {
                  const isSelected = v.id === selectedVersionId;
                  const publishedLink = v.trackLinks?.[0] ?? null;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVersionId(v.id)}
                      style={{
                        padding: '10px',
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(242, 120, 10,0.08)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(242, 120, 10,0.25)' : 'transparent'}`,
                        marginBottom: 4,
                        transition: 'background 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? colors.primary : colors.textTertiary, background: isSelected ? 'rgba(242, 120, 10,0.12)' : 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: borderRadius.sm }}>
                          v{v.versionNumber}
                        </span>
                        {v.audioUrl && <Music size={10} color={colors.primary} />}
                        {publishedLink && <Check size={10} color={colors.primary} />}
                      </div>
                      <div style={{ fontSize: 12, color: isSelected ? colors.textPrimary : colors.textSecondary, fontWeight: isSelected ? 600 : 400, lineHeight: 1.3 }}>
                        {v.message || `Version ${v.versionNumber}`}
                      </div>
                      <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 3 }}>
                        {formatDate(v.createdAt)}
                      </div>
                      <div style={{ fontSize: 10, color: colors.textTertiary }}>
                        {v.totalFiles} files · {formatBytes(Number(v.totalSize))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Main content ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selectedVersion ? (
              <div style={{ ...card, textAlign: 'center', padding: '60px 20px', color: colors.textTertiary }}>
                Select a version to view
              </div>
            ) : (
              <>
                {/* Arrangement Viewer */}
                {selectedVersion.arrangement ? (
                  <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                    <ArrangementViewer
                      arrangement={selectedVersion.arrangement as ArrangementData}
                      duration={audioDuration}
                      currentTimeRef={currentTimeRef}
                      isPlayingRef={isPlayingRef}
                      projectFileUrl={null}
                      zoom={zoom}
                      setZoom={setZoom}
                    />
                  </div>
                ) : (
                  <div style={{ ...card, marginBottom: 16, textAlign: 'center', padding: '40px 20px' }}>
                    <FolderOpen size={36} color={colors.textTertiary} style={{ marginBottom: 10, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>No arrangement data for this version</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: colors.textTertiary }}>Sync from the desktop app with an FLP file present</p>
                  </div>
                )}

                {/* Audio section */}
                <div style={{ ...card, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: selectedVersion.audioUrl ? 14 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textSecondary }}>
                      Rendered Audio
                    </div>
                    {selectedVersion.audioUrl && (
                      <button onClick={removeAudio} style={{ ...ghostBtn, fontSize: '11px' }}>
                        <X size={11} /> Remove
                      </button>
                    )}
                  </div>

                  {selectedVersion.audioUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={togglePlay} style={{ width: 36, height: 36, borderRadius: '50%', background: colors.primary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isPlaying ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
                      </button>
                      <div
                        onClick={seekTo}
                        style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', overflow: 'hidden' }}
                      >
                        <div style={{ height: '100%', width: `${audioDuration ? (audioTime / audioDuration) * 100 : 0}%`, background: colors.primary, borderRadius: 3, transition: 'width 0.1s linear' }} />
                      </div>
                      <span style={{ fontSize: 11, color: colors.textTertiary, width: 38, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(audioTime)}
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: colors.textTertiary }}>
                        Attach a rendered audio file (MP3 or WAV) to play it alongside the arrangement.
                      </p>
                      <button onClick={() => audioInputRef.current?.click()} disabled={uploadingAudio} style={{ ...btn, background: 'rgba(255,255,255,0.04)', color: colors.textSecondary, border: `1px solid ${colors.glassBorder}` }}>
                        <Upload size={13} /> {uploadingAudio ? 'Uploading...' : 'Attach audio'}
                      </button>
                    </div>
                  )}
                  <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioUpload} />
                </div>

                {/* Version actions */}
                <div style={{ ...card }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textSecondary, marginBottom: 12 }}>
                    Version {selectedVersion.versionNumber} Actions
                  </div>

                  {/* Published badge */}
                  {selectedVersion.trackLinks?.[0] && (
                    <div style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(242, 120, 10,0.08)', border: `1px solid rgba(242, 120, 10,0.2)`, borderRadius: borderRadius.sm, padding: '4px 10px', fontSize: 11, color: colors.primary }}>
                      <Check size={11} /> Published to: <strong>{selectedVersion.trackLinks[0].track.title}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => handleDownload(selectedVersion.id)} style={{ ...btn, background: 'rgba(255,255,255,0.04)', color: colors.textSecondary, border: `1px solid ${colors.glassBorder}`, fontSize: '12px' }}>
                      <Download size={13} /> Download ZIP
                    </button>
                    {!selectedVersion.trackLinks?.[0] ? (
                      <button onClick={() => openPublish(selectedVersion.id)} style={{ ...btn, background: 'rgba(242, 120, 10,0.08)', color: colors.primary, border: `1px solid rgba(242, 120, 10,0.2)`, fontSize: '12px' }}>
                        <Link size={13} /> Publish to track
                      </button>
                    ) : (
                      <button onClick={() => handleUnpublish(selectedVersion.trackLinks[0].trackId)} style={{ ...btn, background: 'rgba(239,68,68,0.06)', color: 'rgba(239,68,68,0.8)', border: `1px solid rgba(239,68,68,0.15)`, fontSize: '12px' }}>
                        <Link2Off size={13} /> Unpublish
                      </button>
                    )}
                  </div>

                  {/* Publish form */}
                  {publishingVersionId === selectedVersion.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.glassBorder}` }}>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: colors.textSecondary }}>Select a track to link this version to:</p>
                      {userTracks.length === 0 ? (
                        <p style={{ fontSize: 12, color: colors.textTertiary }}>No tracks found. Upload a track on fujistud.io first.</p>
                      ) : (
                        <>
                          <select value={selectedTrackId} onChange={e => setSelectedTrackId(e.target.value)} style={{ display: 'block', width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.sm, padding: '7px 10px', color: colors.textPrimary, fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
                            {userTracks.map((t: any) => <option key={t.id} value={t.id} style={{ background: '#1a1a2e' }}>{t.title}{!t.isPublic ? ' (private)' : ''}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={confirmPublish} disabled={publishing || !selectedTrackId} style={{ ...btn, background: colors.primary, color: '#fff', fontSize: '12px' }}>
                              {publishing ? 'Publishing...' : <><Music size={13} /> Confirm</>}
                            </button>
                            <button onClick={() => setPublishingVersionId(null)} style={{ ...btn, background: 'rgba(255,255,255,0.04)', color: colors.textSecondary, border: `1px solid ${colors.glassBorder}`, fontSize: '12px' }}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DiscoveryLayout>
  );
};
