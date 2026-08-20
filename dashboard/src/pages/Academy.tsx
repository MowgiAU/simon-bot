/**
 * Academy Admin Page — Lesson creation & management dashboard.
 * Admin-only: create, edit, publish lessons. View completion stats.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import {
    GraduationCap, BookOpen, Plus, CheckCircle2, Edit3, Trash2,
    Eye, EyeOff, ChevronRight, ArrowRight, ExternalLink, Users, Music, X,
} from 'lucide-react';
import type { LessonAsset } from '../components/academy/LessonSchema';

const API = (window as any).__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || '';

interface LessonSummary {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    difficulty: string;
    published: boolean;
    duration: number | null;
    completionCount: number;
    order: number;
}

interface AcademySettings {
    enabled: boolean;
    announcementChannelId: string | null;
    completionRoleId: string | null;
    reputationReward: number;
}

const CATEGORIES = ['basics', 'mixing', 'synthesis', 'arrangement', 'mastering'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

// Fixed slots because they're the channel ids the DAW simulator's default lesson state
// (createDefaultDAWState) always creates — an asset's `name` has to match a channel id for
// the audio engine to actually pick it up. Not derived from a lesson's own content since the
// step editor doesn't exist yet; every lesson today uses this same starting channel set.
const SOUND_SLOTS: { id: string; label: string }[] = [
    { id: 'kick',  label: 'Kick' },
    { id: 'clap',  label: 'Clap' },
    { id: 'hihat', label: 'Hi-Hat' },
    { id: 'snare', label: 'Snare' },
];

interface H2HSampleOption {
    id: string;
    name: string;
    category: string;
    fileUrl: string;
    poolName: string;
}

export const AcademyPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [lessons, setLessons] = useState<LessonSummary[]>([]);
    const [settings, setSettings] = useState<AcademySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // ─── Form state for creating a lesson ───
    const [formTitle, setFormTitle] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formCategory, setFormCategory] = useState('basics');
    const [formDifficulty, setFormDifficulty] = useState('beginner');
    const [formDuration, setFormDuration] = useState(5);
    const [saving, setSaving] = useState(false);

    // ─── "Edit Sounds" modal: assign H2H samples to a lesson's fixed channel slots ───
    const [soundsLesson, setSoundsLesson] = useState<LessonSummary | null>(null);
    const [soundsAssets, setSoundsAssets] = useState<LessonAsset[]>([]);
    const [soundsLoading, setSoundsLoading] = useState(false);
    const [soundsSaving, setSoundsSaving] = useState(false);
    const [h2hSamples, setH2hSamples] = useState<H2HSampleOption[]>([]);

    // Action errors (create/publish/delete/save) need to be visible — a silently swallowed
    // 403 here is exactly what made the broken admin check on the backend look like "the
    // publish button doesn't do anything" instead of an obvious permissions error.
    const [actionError, setActionError] = useState<string | null>(null);
    const showError = (e: any, fallback: string) => {
        setActionError(e?.response?.data?.error || fallback);
        setTimeout(() => setActionError(null), 6000);
    };

    const guildId = selectedGuild?.id;

    useEffect(() => {
        if (!guildId) return;
        (async () => {
            try {
                const [lessonsRes, settingsRes] = await Promise.all([
                    axios.get(`${API}/api/academy/lessons`, { withCredentials: true }),
                    axios.get(`${API}/api/guilds/${guildId}/academy/settings`, { withCredentials: true }).catch(() => ({ data: null })),
                ]);
                setLessons(lessonsRes.data);
                setSettings(settingsRes.data);
            } catch (e) { /* ignore */ }
            finally { setLoading(false); }
        })();
        // H2H sample pools aren't guild-scoped in the UI sense that matters here — just the
        // library to pick lesson sounds from — so this loads once alongside everything else.
        axios.get(`${API}/api/head-to-head/admin/pools`, { withCredentials: true })
            .then(r => {
                const flat: H2HSampleOption[] = (r.data || []).flatMap((pool: any) =>
                    (pool.samples || []).map((s: any) => ({
                        id: s.id, name: s.name, category: s.category, fileUrl: s.fileUrl, poolName: pool.name,
                    })));
                setH2hSamples(flat);
            })
            .catch(() => { /* picker just shows empty if this fails — not fatal to the page */ });
    }, [guildId]);

    const openSoundsEditor = async (lesson: LessonSummary) => {
        setSoundsLesson(lesson);
        setSoundsLoading(true);
        try {
            const res = await axios.get(`${API}/api/academy/lessons/${lesson.id}`, { withCredentials: true });
            setSoundsAssets(Array.isArray(res.data?.assets) ? res.data.assets : []);
        } catch (e) {
            setSoundsAssets([]);
        } finally {
            setSoundsLoading(false);
        }
    };

    const setSlotSample = (slotId: string, sample: H2HSampleOption | null) => {
        setSoundsAssets(prev => {
            const rest = prev.filter(a => a.name !== slotId);
            return sample ? [...rest, { name: slotId, url: sample.fileUrl, type: 'sample' as const }] : rest;
        });
    };

    const saveSounds = async () => {
        if (!soundsLesson) return;
        setSoundsSaving(true);
        try {
            await axios.patch(`${API}/api/academy/admin/lessons/${soundsLesson.id}`, {
                assets: soundsAssets,
            }, { withCredentials: true });
            setSoundsLesson(null);
        } catch (e) { showError(e, 'Failed to save sounds'); }
        finally { setSoundsSaving(false); }
    };

    const handleCreate = async () => {
        if (!formTitle.trim() || !formSlug.trim()) return;
        setSaving(true);
        try {
            const res = await axios.post(`${API}/api/academy/admin/lessons`, {
                title: formTitle, slug: formSlug, description: formDesc,
                category: formCategory, difficulty: formDifficulty,
                duration: formDuration, steps: [], assets: [],
            }, { withCredentials: true });
            setLessons(prev => [...prev, { ...res.data, completionCount: 0 }]);
            setShowCreate(false);
            setFormTitle(''); setFormSlug(''); setFormDesc('');
        } catch (e) { showError(e, 'Failed to create lesson'); }
        finally { setSaving(false); }
    };

    const togglePublish = async (lesson: LessonSummary) => {
        try {
            await axios.patch(`${API}/api/academy/admin/lessons/${lesson.id}`, {
                published: !lesson.published,
            }, { withCredentials: true });
            setLessons(prev => prev.map(l =>
                l.id === lesson.id ? { ...l, published: !l.published } : l
            ));
        } catch (e) { showError(e, 'Failed to update publish status'); }
    };

    const deleteLesson = async (lesson: LessonSummary) => {
        if (!confirm(`Delete "${lesson.title}"?`)) return;
        try {
            await axios.delete(`${API}/api/academy/admin/lessons/${lesson.id}`, { withCredentials: true });
            setLessons(prev => prev.filter(l => l.id !== lesson.id));
        } catch (e) { showError(e, 'Failed to delete lesson'); }
    };

    const updateSettings = async (patch: Partial<AcademySettings>) => {
        if (!guildId) return;
        try {
            const res = await axios.post(`${API}/api/guilds/${guildId}/academy/settings`, patch, { withCredentials: true });
            setSettings(res.data);
        } catch (e) { /* ignore */ }
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <GraduationCap size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Academy Management</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Create and manage interactive FL Studio lessons
                    </p>
                </div>
            </div>

            {actionError && (
                <div style={{
                    backgroundColor: `${colors.error}18`, border: `1px solid ${colors.error}44`,
                    padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
                    color: colors.error, fontSize: '13px',
                }}>
                    {actionError}
                </div>
            )}

            {/* Explanation block */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md,
                borderRadius: borderRadius.md, marginBottom: spacing.lg,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Lessons you create here are shown publicly on the <strong>/learn</strong> page.
                    Users can complete interactive lessons in the DAW simulator.
                    Progress and completion stats appear below.
                </p>
            </div>

            {/* Settings section */}
            {settings && (
                <div style={{
                    background: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.md, padding: spacing.md,
                    marginBottom: spacing.lg,
                }}>
                    <h3 style={{ margin: '0 0 12px', color: colors.textPrimary, fontSize: '14px' }}>Settings</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSecondary, fontSize: '13px' }}>
                            <input type="checkbox" checked={settings.enabled}
                                onChange={e => updateSettings({ enabled: e.target.checked })} />
                            Enabled
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSecondary, fontSize: '13px' }}>
                            Reputation per completion:
                            <input type="number" value={settings.reputationReward} min={0} max={1000}
                                onChange={e => updateSettings({ reputationReward: Number(e.target.value) || 0 })}
                                style={{
                                    width: 60, background: '#1A1A1A', border: `1px solid ${colors.border}`,
                                    borderRadius: '4px', padding: '4px 6px', color: colors.textPrimary,
                                    fontSize: '13px', textAlign: 'center',
                                }} />
                        </label>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>
                    Lessons ({lessons.length})
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <a href="/learn" target="_blank" style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: borderRadius.sm,
                        background: 'transparent', border: `1px solid ${colors.border}`,
                        color: colors.textSecondary, fontSize: '13px', textDecoration: 'none',
                        cursor: 'pointer',
                    }}>
                        <ExternalLink size={14} /> View Public Page
                    </a>
                    <button onClick={() => setShowCreate(!showCreate)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: borderRadius.sm,
                        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
                        border: 'none', color: '#fff', fontSize: '13px',
                        cursor: 'pointer', fontWeight: 600,
                    }}>
                        <Plus size={14} /> Create Lesson
                    </button>
                </div>
            </div>

            {/* Create form */}
            {showCreate && (
                <div style={{
                    background: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.md, padding: spacing.md,
                    marginBottom: spacing.md,
                }}>
                    <h3 style={{ margin: '0 0 12px', color: colors.textPrimary, fontSize: '14px' }}>New Lesson</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Title</label>
                            <input value={formTitle} onChange={e => { setFormTitle(e.target.value); setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }}
                                placeholder="e.g. Your First Beat" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Slug</label>
                            <input value={formSlug} onChange={e => setFormSlug(e.target.value)}
                                placeholder="your-first-beat" style={inputStyle} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>Description</label>
                            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
                                placeholder="What will the student learn?" rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Category</label>
                            <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Difficulty</label>
                            <select value={formDifficulty} onChange={e => setFormDifficulty(e.target.value)} style={inputStyle}>
                                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Duration (min)</label>
                            <input type="number" value={formDuration} onChange={e => setFormDuration(Number(e.target.value) || 5)}
                                min={1} max={60} style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                        <button onClick={() => setShowCreate(false)} style={{
                            padding: '8px 14px', borderRadius: borderRadius.sm,
                            background: 'transparent', border: `1px solid ${colors.border}`,
                            color: colors.textSecondary, fontSize: '13px', cursor: 'pointer',
                        }}>Cancel</button>
                        <button onClick={handleCreate} disabled={saving || !formTitle.trim()} style={{
                            padding: '8px 14px', borderRadius: borderRadius.sm,
                            background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
                            border: 'none', color: '#fff', fontSize: '13px',
                            cursor: 'pointer', fontWeight: 600,
                            opacity: saving || !formTitle.trim() ? 0.5 : 1,
                        }}>
                            {saving ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </div>
            )}

            {/* Lessons table */}
            <div style={{
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, overflow: 'hidden',
            }}>
                {lessons.length === 0 ? (
                    <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.textSecondary }}>
                        No lessons created yet. Click "Create Lesson" to get started.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                                {['Title', 'Category', 'Difficulty', 'Status', 'Completions', 'Actions'].map(h => (
                                    <th key={h} style={{
                                        padding: '10px 12px', textAlign: 'left',
                                        fontSize: '11px', color: colors.textSecondary,
                                        fontWeight: 600, textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lessons.map(lesson => (
                                <tr key={lesson.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ color: colors.textPrimary, fontWeight: 500, fontSize: '13px' }}>
                                            {lesson.title}
                                        </span>
                                        <br />
                                        <span style={{ fontSize: '11px', color: colors.textTertiary }}>/{lesson.slug}</span>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '12px', color: colors.textSecondary, textTransform: 'capitalize' }}>
                                        {lesson.category}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{
                                            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                            color: lesson.difficulty === 'beginner' ? '#6FBF40' : lesson.difficulty === 'intermediate' ? '#E88C3A' : '#E8503A',
                                        }}>
                                            {lesson.difficulty}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            fontSize: '11px',
                                            color: lesson.published ? '#6FBF40' : '#888',
                                        }}>
                                            {lesson.published ? <Eye size={12} /> : <EyeOff size={12} />}
                                            {lesson.published ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textSecondary }}>
                                            <Users size={12} /> {lesson.completionCount}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => openSoundsEditor(lesson)} title="Edit Sounds"
                                                style={actionBtnStyle}>
                                                <Music size={14} />
                                            </button>
                                            <button onClick={() => togglePublish(lesson)} title={lesson.published ? 'Unpublish' : 'Publish'}
                                                style={actionBtnStyle}>
                                                {lesson.published ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                            <button onClick={() => deleteLesson(lesson)} title="Delete"
                                                style={{ ...actionBtnStyle, color: '#E8503A' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Sounds modal */}
            {soundsLesson && (
                <div onClick={() => !soundsSaving && setSoundsLesson(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: spacing.md,
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: colors.surface, border: `1px solid ${colors.border}`,
                        borderRadius: borderRadius.md, padding: spacing.lg, width: '100%', maxWidth: 520,
                        maxHeight: '85vh', overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '16px' }}>Edit Sounds</h3>
                            <button onClick={() => setSoundsLesson(null)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: 4 }}>
                                <X size={16} />
                            </button>
                        </div>
                        <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '12px' }}>
                            {soundsLesson.title} — pick which H2H sample pool file plays for each channel.
                            Leave a slot on "Default sound" to keep the simulator's built-in synth tone.
                        </p>

                        {soundsLoading ? (
                            <p style={{ color: colors.textSecondary, fontSize: '13px' }}>Loading…</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {SOUND_SLOTS.map(slot => {
                                    const current = soundsAssets.find(a => a.name === slot.id);
                                    const currentSample = current ? h2hSamples.find(s => s.fileUrl === current.url) : null;
                                    return (
                                        <div key={slot.id}>
                                            <label style={labelStyle}>{slot.label}</label>
                                            <select
                                                value={current?.url || ''}
                                                onChange={e => {
                                                    const sample = h2hSamples.find(s => s.fileUrl === e.target.value) || null;
                                                    setSlotSample(slot.id, sample);
                                                }}
                                                style={inputStyle}>
                                                <option value="">Default sound (synth)</option>
                                                {h2hSamples.map(s => (
                                                    <option key={s.id} value={s.fileUrl}>
                                                        [{s.category}] {s.name} — {s.poolName}
                                                    </option>
                                                ))}
                                            </select>
                                            {current && (
                                                <audio controls src={current.url} style={{ width: '100%', height: 32, marginTop: '6px' }}>
                                                    {currentSample?.name}
                                                </audio>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                            <button onClick={() => setSoundsLesson(null)} disabled={soundsSaving} style={{
                                padding: '8px 14px', borderRadius: borderRadius.sm,
                                background: 'transparent', border: `1px solid ${colors.border}`,
                                color: colors.textSecondary, fontSize: '13px', cursor: 'pointer',
                            }}>Cancel</button>
                            <button onClick={saveSounds} disabled={soundsSaving || soundsLoading} style={{
                                padding: '8px 14px', borderRadius: borderRadius.sm,
                                background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
                                border: 'none', color: '#fff', fontSize: '13px',
                                cursor: 'pointer', fontWeight: 600,
                                opacity: soundsSaving || soundsLoading ? 0.5 : 1,
                            }}>
                                {soundsSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', color: colors.textSecondary,
    marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: `1px solid ${colors.border}`,
    borderRadius: '4px', padding: '8px 10px', color: colors.textPrimary,
    fontSize: '13px', boxSizing: 'border-box',
};

const actionBtnStyle: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${colors.border}`,
    borderRadius: '4px', padding: '4px 6px', cursor: 'pointer',
    color: colors.textSecondary, display: 'flex', alignItems: 'center',
};
