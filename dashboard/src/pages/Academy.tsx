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
    Eye, EyeOff, ChevronRight, ArrowRight, ExternalLink, Users,
} from 'lucide-react';

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
        } catch (e) { /* show error */ }
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
        } catch (e) { /* ignore */ }
    };

    const deleteLesson = async (lesson: LessonSummary) => {
        if (!confirm(`Delete "${lesson.title}"?`)) return;
        try {
            await axios.delete(`${API}/api/academy/admin/lessons/${lesson.id}`, { withCredentials: true });
            setLessons(prev => prev.filter(l => l.id !== lesson.id));
        } catch (e) { /* ignore */ }
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
