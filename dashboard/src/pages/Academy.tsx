/**
 * Academy Admin Page — Lesson creation & management dashboard.
 * Admin-only: create, edit, publish lessons. View completion stats.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import {
    GraduationCap, BookOpen, Plus, Edit3, Trash2,
    Eye, EyeOff, ExternalLink, Users,
    GripVertical, ChevronLeft, AlertTriangle,
} from 'lucide-react';
import type { LessonAsset, LessonStep } from '../components/academy/LessonSchema';
import { createDefaultChannel, createDefaultDAWState } from '../components/academy/AudioEngine';

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

    // ─── Full lesson editor: channels (reorder/add/remove/sample) + steps ───
    const [editingLesson, setEditingLesson] = useState<LessonSummary | null>(null);
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

    if (editingLesson) {
        return (
            <LessonEditorView
                lesson={editingLesson}
                h2hSamples={h2hSamples}
                onClose={() => setEditingLesson(null)}
            />
        );
    }

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
                                            <button onClick={() => setEditingLesson(lesson)} title="Edit Lesson"
                                                style={actionBtnStyle}>
                                                <Edit3 size={14} />
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

// ─── Full lesson editor: channels + steps, kept in sync ───
//
// Channels are referenced by a stable id (see LessonStepTarget.channelId in LessonSchema.ts) —
// reordering or removing a channel here never desyncs a step's target from the sound it
// actually checks, since the check resolves the channel by id at runtime rather than trusting
// a saved position.

interface EditChannel { id: string; name: string; }

type EditStepType = 'instruction' | 'pattern' | 'transport';

interface EditStep {
    key: string;
    instruction: string;
    hint: string;
    type: EditStepType;
    channelId: string;
    pattern: boolean[];
    requireTransport: 'play' | 'stop';
    advanced: boolean;
    rawTarget: string;
}

let editStepKeySeq = 0;
const newStepKey = () => `s${Date.now()}_${editStepKeySeq++}`;

function genChannelId(name: string, existing: EditChannel[]): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'channel';
    let id = base, n = 1;
    while (existing.some(c => c.id === id)) { id = `${base}${++n}`; }
    return id;
}

function fromLessonStep(step: any): EditStep {
    // A target with a channelId maps cleanly onto the friendly pattern editor. Anything else
    // (legacy positional statePath, demo animations, range/gte/lte compares) falls back to the
    // raw-JSON "Advanced" escape hatch rather than trying to model every shape in the UI.
    const hasSimpleTarget = !step.target || !!step.target.channelId;
    const type: EditStepType = step.target?.channelId ? 'pattern' : step.requireTransport ? 'transport' : 'instruction';
    return {
        key: newStepKey(),
        instruction: step.instruction || '',
        hint: step.hint || '',
        type,
        channelId: step.target?.channelId || '',
        pattern: Array.isArray(step.target?.expectedValue) && step.target.expectedValue.length === 16
            ? step.target.expectedValue : Array(16).fill(false),
        requireTransport: step.requireTransport === 'stop' ? 'stop' : 'play',
        advanced: !hasSimpleTarget,
        rawTarget: hasSimpleTarget ? '' : JSON.stringify(
            { target: step.target, demo: step.demo, autoAdvanceMs: step.autoAdvanceMs }, null, 2,
        ),
    };
}

function toLessonStep(s: EditStep, idx: number): LessonStep {
    const base: any = { id: idx, instruction: s.instruction };
    if (s.hint.trim()) base.hint = s.hint;

    if (s.advanced) {
        try {
            Object.assign(base, JSON.parse(s.rawTarget || '{}'));
            return base;
        } catch {
            // Fall through and save as a plain instruction step rather than losing the save
            // over a JSON typo — the admin can reopen "Advanced" and fix it.
        }
    }
    if (s.type === 'pattern' && s.channelId) {
        base.target = {
            componentId: `step-${s.channelId}-0`,
            statePath: `channels.0.steps`,
            channelId: s.channelId,
            channelField: 'steps',
            expectedValue: s.pattern,
            compare: 'eq',
        };
    } else if (s.type === 'transport') {
        base.requireTransport = s.requireTransport;
    }
    return base;
}

const LessonEditorView: React.FC<{
    lesson: LessonSummary;
    h2hSamples: H2HSampleOption[];
    onClose: () => void;
}> = ({ lesson, h2hSamples, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [channels, setChannels] = useState<EditChannel[]>([]);
    const [assets, setAssets] = useState<LessonAsset[]>([]);
    const [steps, setSteps] = useState<EditStep[]>([]);
    const [newChannelName, setNewChannelName] = useState('');

    const [chDragIdx, setChDragIdx] = useState<number | null>(null);
    const [chDragOverIdx, setChDragOverIdx] = useState<number | null>(null);
    const [stDragIdx, setStDragIdx] = useState<number | null>(null);
    const [stDragOverIdx, setStDragOverIdx] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API}/api/academy/lessons/${lesson.id}`, { withCredentials: true });
                const dbChannels = res.data?.initState?.channels;
                setChannels(Array.isArray(dbChannels) && dbChannels.length
                    ? dbChannels.map((c: any) => ({ id: c.id, name: c.name }))
                    : createDefaultDAWState().channels.map(c => ({ id: c.id, name: c.name })));
                setAssets(Array.isArray(res.data?.assets) ? res.data.assets : []);
                const dbSteps = Array.isArray(res.data?.steps) ? res.data.steps : [];
                setSteps(dbSteps.map(fromLessonStep));
            } catch {
                setChannels(createDefaultDAWState().channels.map(c => ({ id: c.id, name: c.name })));
                setAssets([]);
                setSteps([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [lesson.id]);

    const setChannelSample = (channelId: string, sample: H2HSampleOption | null) => {
        setAssets(prev => {
            const rest = prev.filter(a => a.name !== channelId);
            return sample ? [...rest, { name: channelId, url: sample.fileUrl, type: 'sample' as const }] : rest;
        });
    };

    const addChannel = () => {
        const name = newChannelName.trim();
        if (!name) return;
        const id = genChannelId(name, channels);
        setChannels(prev => [...prev, { id, name }]);
        setNewChannelName('');
    };

    const removeChannel = (id: string) => {
        const affected = steps.filter(s => s.type === 'pattern' && s.channelId === id);
        if (affected.length && !window.confirm(
            `${affected.length} step${affected.length === 1 ? '' : 's'} target this channel and will become instruction-only. Continue?`,
        )) return;
        setChannels(prev => prev.filter(c => c.id !== id));
        setAssets(prev => prev.filter(a => a.name !== id));
        setSteps(prev => prev.map(s => (s.type === 'pattern' && s.channelId === id) ? { ...s, type: 'instruction', channelId: '' } : s));
    };

    const renameChannel = (id: string, name: string) => {
        setChannels(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    };

    const onChDrop = (i: number) => {
        if (chDragIdx === null || chDragIdx === i) { setChDragIdx(null); setChDragOverIdx(null); return; }
        const next = [...channels];
        const [moved] = next.splice(chDragIdx, 1);
        next.splice(i, 0, moved);
        setChannels(next);
        setChDragIdx(null); setChDragOverIdx(null);
    };

    const addStep = () => {
        setSteps(prev => [...prev, {
            key: newStepKey(), instruction: '', hint: '', type: 'instruction',
            channelId: channels[0]?.id || '', pattern: Array(16).fill(false),
            requireTransport: 'play', advanced: false, rawTarget: '',
        }]);
    };

    const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));
    const updateStep = (idx: number, patch: Partial<EditStep>) =>
        setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    const togglePatternCell = (idx: number, cell: number) =>
        setSteps(prev => prev.map((s, i) => i === idx
            ? { ...s, pattern: s.pattern.map((v, ci) => ci === cell ? !v : v) } : s));

    const onStDrop = (i: number) => {
        if (stDragIdx === null || stDragIdx === i) { setStDragIdx(null); setStDragOverIdx(null); return; }
        const next = [...steps];
        const [moved] = next.splice(stDragIdx, 1);
        next.splice(i, 0, moved);
        setSteps(next);
        setStDragIdx(null); setStDragOverIdx(null);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const initState = { ...createDefaultDAWState(), channels: channels.map(c => createDefaultChannel(c.id, c.name)) };
            const lessonSteps = steps.map(toLessonStep);
            await axios.patch(`${API}/api/academy/admin/lessons/${lesson.id}`, {
                steps: lessonSteps, initState, assets,
            }, { withCredentials: true });
            onClose();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to save lesson');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={onClose} style={{ ...actionBtnStyle, padding: '6px 10px' }}>
                        <ChevronLeft size={16} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>{lesson.title}</h1>
                        <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '12px' }}>Channels and steps for /{lesson.slug}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} disabled={saving} style={{
                        padding: '8px 16px', borderRadius: borderRadius.sm,
                        background: 'transparent', border: `1px solid ${colors.border}`,
                        color: colors.textSecondary, fontSize: '13px', cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={save} disabled={saving || loading} style={{
                        padding: '8px 16px', borderRadius: borderRadius.sm,
                        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
                        border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer', opacity: saving || loading ? 0.5 : 1,
                    }}>{saving ? 'Saving…' : 'Save Lesson'}</button>
                </div>
            </div>

            {error && (
                <div style={{
                    backgroundColor: `${colors.error}18`, border: `1px solid ${colors.error}44`,
                    padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
                    color: colors.error, fontSize: '13px',
                }}>{error}</div>
            )}

            {loading ? (
                <p style={{ color: colors.textSecondary, fontSize: '13px' }}>Loading…</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    {/* ─── Channels ─── */}
                    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: '14px' }}>Channels</h3>
                        <p style={{ margin: '0 0 14px', color: colors.textSecondary, fontSize: '12px' }}>
                            Drag to reorder. Removing a channel turns any step targeting it into an instruction-only step
                            rather than leaving a broken check.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            {channels.map((ch, idx) => {
                                const current = assets.find(a => a.name === ch.id);
                                return (
                                    <div key={ch.id} draggable
                                        onDragStart={() => setChDragIdx(idx)}
                                        onDragOver={e => { e.preventDefault(); setChDragOverIdx(idx); }}
                                        onDrop={() => onChDrop(idx)}
                                        onDragEnd={() => { setChDragIdx(null); setChDragOverIdx(null); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                                            borderRadius: borderRadius.sm,
                                            backgroundColor: chDragOverIdx === idx ? `${colors.primary}10` : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${chDragOverIdx === idx ? `${colors.primary}44` : colors.border}`,
                                            opacity: chDragIdx === idx ? 0.5 : 1,
                                        }}>
                                        <span style={{ cursor: 'grab', display: 'flex', flexShrink: 0 }}><GripVertical size={14} color={colors.textTertiary} /></span>
                                        <input value={ch.name} onChange={e => renameChannel(ch.id, e.target.value)}
                                            style={{ ...inputStyle, width: '160px', flexShrink: 0 }} />
                                        <select
                                            value={current?.url || ''}
                                            onChange={e => setChannelSample(ch.id, h2hSamples.find(s => s.fileUrl === e.target.value) || null)}
                                            style={{ ...inputStyle, flex: 1 }}>
                                            <option value="">Default sound (synth)</option>
                                            {h2hSamples.map(s => (
                                                <option key={s.id} value={s.fileUrl}>[{s.category}] {s.name} — {s.poolName}</option>
                                            ))}
                                        </select>
                                        {current && (
                                            <audio controls src={current.url} style={{ height: 30, width: 160, flexShrink: 0 }} />
                                        )}
                                        <button onClick={() => removeChannel(ch.id)} style={{ ...actionBtnStyle, color: '#E8503A', flexShrink: 0 }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                );
                            })}
                            {channels.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '18px', color: colors.textTertiary, fontSize: '12px', border: `1px dashed ${colors.border}`, borderRadius: borderRadius.md }}>
                                    No channels yet.
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addChannel(); }}
                                placeholder="New channel name, e.g. Percussion" style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={addChannel} disabled={!newChannelName.trim()} style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                                borderRadius: borderRadius.sm, background: 'transparent', border: `1px solid ${colors.border}`,
                                color: colors.textPrimary, fontSize: '13px', cursor: 'pointer',
                                opacity: !newChannelName.trim() ? 0.5 : 1,
                            }}><Plus size={14} /> Add Channel</button>
                        </div>
                    </div>

                    {/* ─── Steps ─── */}
                    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: '14px' }}>Steps</h3>
                        <p style={{ margin: '0 0 14px', color: colors.textSecondary, fontSize: '12px' }}>
                            Drag to reorder. Each step is either plain instruction text, a pattern the student must set on a
                            channel, or a "press Play/Stop" checkpoint.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                            {steps.map((s, idx) => (
                                <div key={s.key} draggable
                                    onDragStart={() => setStDragIdx(idx)}
                                    onDragOver={e => { e.preventDefault(); setStDragOverIdx(idx); }}
                                    onDrop={() => onStDrop(idx)}
                                    onDragEnd={() => { setStDragIdx(null); setStDragOverIdx(null); }}
                                    style={{
                                        padding: '12px', borderRadius: borderRadius.sm,
                                        backgroundColor: stDragOverIdx === idx ? `${colors.primary}10` : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${stDragOverIdx === idx ? `${colors.primary}44` : colors.border}`,
                                        opacity: stDragIdx === idx ? 0.5 : 1,
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ cursor: 'grab', display: 'flex', paddingTop: '8px', flexShrink: 0 }}>
                                            <GripVertical size={14} color={colors.textTertiary} />
                                        </span>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: colors.textTertiary, minWidth: '16px', textAlign: 'right', paddingTop: '9px', flexShrink: 0 }}>{idx + 1}</span>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <textarea value={s.instruction} onChange={e => updateStep(idx, { instruction: e.target.value })}
                                                placeholder="Instruction text shown to the student" rows={2}
                                                style={{ ...inputStyle, resize: 'vertical' }} />
                                            <input value={s.hint} onChange={e => updateStep(idx, { hint: e.target.value })}
                                                placeholder="Optional hint (shown after 8s)" style={inputStyle} />

                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <select value={s.advanced ? 'advanced' : s.type}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        if (v === 'advanced') updateStep(idx, { advanced: true, rawTarget: s.rawTarget || '{\n  "target": {}\n}' });
                                                        else updateStep(idx, { advanced: false, type: v as EditStepType });
                                                    }}
                                                    style={{ ...inputStyle, width: '180px' }}>
                                                    <option value="instruction">Instruction only</option>
                                                    <option value="pattern">Set a pattern</option>
                                                    <option value="transport">Require Play or Stop</option>
                                                    <option value="advanced">Advanced (raw JSON)</option>
                                                </select>

                                                {!s.advanced && s.type === 'pattern' && (
                                                    <select value={s.channelId} onChange={e => updateStep(idx, { channelId: e.target.value })}
                                                        style={{ ...inputStyle, width: '160px' }}>
                                                        <option value="">Choose channel…</option>
                                                        {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                )}
                                                {!s.advanced && s.type === 'transport' && (
                                                    <select value={s.requireTransport} onChange={e => updateStep(idx, { requireTransport: e.target.value as 'play' | 'stop' })}
                                                        style={{ ...inputStyle, width: '120px' }}>
                                                        <option value="play">Play</option>
                                                        <option value="stop">Stop</option>
                                                    </select>
                                                )}
                                            </div>

                                            {!s.advanced && s.type === 'pattern' && s.channelId && (
                                                <div style={{ display: 'flex', gap: '3px' }}>
                                                    {s.pattern.map((v, ci) => (
                                                        <button key={ci} onClick={() => togglePatternCell(idx, ci)}
                                                            title={`Step ${ci + 1}`}
                                                            style={{
                                                                width: 20, height: 20, borderRadius: '3px', cursor: 'pointer',
                                                                border: `1px solid ${v ? colors.primary : colors.border}`,
                                                                background: v ? colors.primary : 'transparent',
                                                                padding: 0,
                                                            }} />
                                                    ))}
                                                </div>
                                            )}

                                            {s.advanced && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#E88C3A', fontSize: '11px' }}>
                                                        <AlertTriangle size={12} /> Raw step JSON (target / demo / autoAdvanceMs) — merged onto the step as-is.
                                                    </div>
                                                    <textarea value={s.rawTarget} onChange={e => updateStep(idx, { rawTarget: e.target.value })}
                                                        rows={6} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }} />
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => removeStep(idx)} style={{ ...actionBtnStyle, color: '#E8503A', flexShrink: 0 }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {steps.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '18px', color: colors.textTertiary, fontSize: '12px', border: `1px dashed ${colors.border}`, borderRadius: borderRadius.md }}>
                                    No steps yet.
                                </div>
                            )}
                        </div>
                        <button onClick={addStep} style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                            borderRadius: borderRadius.sm, background: 'transparent', border: `1px solid ${colors.border}`,
                            color: colors.textPrimary, fontSize: '13px', cursor: 'pointer',
                        }}><Plus size={14} /> Add Step</button>
                    </div>
                </div>
            )}
        </div>
    );
};
