/**
 * Academy Page — Interactive FL Studio learning sandbox.
 * Lesson browser + DAW simulator + guided lesson engine.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import {
    GraduationCap, BookOpen, Play, CheckCircle2, ChevronRight, ChevronLeft,
    RotateCcw, Trophy, Star, Clock, ArrowRight, Lightbulb,
} from 'lucide-react';
import { DAWSimulator } from '../components/academy/DAWSimulator';
import { useLessonEngine } from '../components/academy/useLessonEngine';
import { LessonSchema, FIRST_BEAT_LESSON } from '../components/academy/LessonSchema';

const API = (window as any).__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || '';

interface LessonSummary {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    difficulty: string;
    duration: number | null;
    imageUrl: string | null;
    completionCount: number;
}

interface UserProgress {
    lessonId: string;
    currentStep: number;
    completed: boolean;
    score: number | null;
}

type View = 'browser' | 'lesson';

const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: '#10B981',
    intermediate: '#F59E0B',
    advanced: '#EF4444',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    basics: <Play size={16} />,
    mixing: <BookOpen size={16} />,
    synthesis: <Star size={16} />,
    arrangement: <ChevronRight size={16} />,
};

export const AcademyPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [view, setView] = useState<View>('browser');
    const [lessons, setLessons] = useState<LessonSummary[]>([]);
    const [progress, setProgress] = useState<UserProgress[]>([]);
    const [activeLesson, setActiveLesson] = useState<LessonSchema | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch lessons + progress
    useEffect(() => {
        (async () => {
            try {
                const [lessonsRes, progressRes] = await Promise.all([
                    axios.get(`${API}/api/academy/lessons`, { withCredentials: true }),
                    axios.get(`${API}/api/academy/progress`, { withCredentials: true }).catch(() => ({ data: [] })),
                ]);
                setLessons(lessonsRes.data);
                setProgress(progressRes.data);
            } catch (e) {
                // If API doesn't have lessons yet, show built-in demo
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const startLesson = useCallback((lesson: LessonSummary | null) => {
        // For now, use the built-in "First Beat" demo lesson
        setActiveLesson(FIRST_BEAT_LESSON);
        setView('lesson');
    }, []);

    const exitLesson = useCallback(() => {
        setView('browser');
        setActiveLesson(null);
    }, []);

    if (view === 'lesson' && activeLesson) {
        return <LessonPlayer lesson={activeLesson} onExit={exitLesson} />;
    }

    const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lessonId));
    const totalCompleted = completedIds.size;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <GraduationCap size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Academy</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Learn FL Studio interactively with hands-on lessons
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
                    The Fuji Academy teaches FL Studio fundamentals through an interactive simulator.
                    Work through guided lessons to learn beat-making, mixing, synthesis, and more.
                    Your progress is tracked and earns you reputation on the server.
                </p>
            </div>

            {/* Stats row */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: spacing.md, marginBottom: spacing.lg,
            }}>
                <StatCard icon={<BookOpen size={20} />} label="Available Lessons" value={lessons.length || 1} />
                <StatCard icon={<CheckCircle2 size={20} />} label="Completed" value={totalCompleted} />
                <StatCard icon={<Trophy size={20} />} label="Total Score" value={progress.reduce((s, p) => s + (p.score || 0), 0)} />
            </div>

            {/* Lesson grid */}
            <h2 style={{ color: colors.textPrimary, fontSize: '18px', marginBottom: spacing.md }}>Lessons</h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: spacing.md,
            }}>
                {/* Built-in demo lesson card */}
                <LessonCard
                    title={FIRST_BEAT_LESSON.title}
                    description={FIRST_BEAT_LESSON.description}
                    category={FIRST_BEAT_LESSON.category}
                    difficulty={FIRST_BEAT_LESSON.difficulty}
                    completed={false}
                    onStart={() => startLesson(null)}
                />

                {/* DB-sourced lessons */}
                {lessons.map(lesson => (
                    <LessonCard
                        key={lesson.id}
                        title={lesson.title}
                        description={lesson.description}
                        category={lesson.category}
                        difficulty={lesson.difficulty}
                        completed={completedIds.has(lesson.id)}
                        duration={lesson.duration}
                        onStart={() => startLesson(lesson)}
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Stat Card ───

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
    <div style={{
        background: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.md, padding: spacing.md,
        display: 'flex', alignItems: 'center', gap: '12px',
    }}>
        <div style={{ color: colors.primary }}>{icon}</div>
        <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: colors.textPrimary }}>{value}</div>
            <div style={{ fontSize: '12px', color: colors.textSecondary }}>{label}</div>
        </div>
    </div>
);

// ─── Lesson Card ───

const LessonCard: React.FC<{
    title: string; description: string; category: string; difficulty: string;
    completed: boolean; duration?: number | null; onStart: () => void;
}> = ({ title, description, category, difficulty, completed, duration, onStart }) => (
    <div style={{
        background: colors.surface, border: `1px solid ${completed ? colors.primary + '40' : colors.border}`,
        borderRadius: borderRadius.md, padding: spacing.md,
        display: 'flex', flexDirection: 'column', gap: '12px',
        cursor: 'pointer', transition: 'border-color 0.2s, transform 0.2s',
    }}
        onClick={onStart}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.primary; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = completed ? colors.primary + '40' : colors.border; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: DIFFICULTY_COLORS[difficulty] ?? colors.textSecondary }}>
                    {CATEGORY_ICONS[category] ?? <BookOpen size={16} />}
                </span>
                <span style={{
                    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: DIFFICULTY_COLORS[difficulty] ?? colors.textSecondary,
                }}>{difficulty}</span>
            </div>
            {completed && <CheckCircle2 size={18} color={colors.primary} />}
        </div>
        <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '16px' }}>{title}</h3>
        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>{description}</p>
        {duration && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.textSecondary, fontSize: '12px' }}>
                <Clock size={12} /> ~{duration} min
            </div>
        )}
        <button style={{
            background: completed ? 'transparent' : `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
            border: completed ? `1px solid ${colors.primary}` : 'none',
            color: completed ? colors.primary : '#fff',
            padding: '8px 16px', borderRadius: borderRadius.sm, fontWeight: 600,
            fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            justifyContent: 'center', transition: 'opacity 0.15s',
        }}>
            {completed ? 'Review' : 'Start Lesson'} <ArrowRight size={14} />
        </button>
    </div>
);

// ─── Lesson Player ───

const LessonPlayer: React.FC<{ lesson: LessonSchema; onExit: () => void }> = ({ lesson, onExit }) => {
    const [engine, actions] = useLessonEngine(lesson);
    const { currentStep, totalSteps, step, stepComplete, lessonComplete, highlightIds, showHint } = engine;

    const progressPct = totalSteps > 0 ? ((currentStep + (stepComplete ? 1 : 0)) / totalSteps) * 100 : 0;

    return (
        <div>
            {/* Top bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: spacing.md,
            }}>
                <button onClick={onExit} style={{
                    background: 'transparent', border: `1px solid ${colors.border}`,
                    color: colors.textSecondary, padding: '6px 14px', borderRadius: borderRadius.sm,
                    cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <ChevronLeft size={14} /> Back to Lessons
                </button>
                <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                    Step {currentStep + 1} / {totalSteps}
                </span>
            </div>

            {/* Progress bar */}
            <div style={{
                height: 4, background: colors.border, borderRadius: 2,
                marginBottom: spacing.md, overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%', width: `${progressPct}%`,
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryDark})`,
                    borderRadius: 2, transition: 'width 0.4s ease',
                }} />
            </div>

            {/* Instruction panel */}
            <div style={{
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, padding: spacing.md,
                marginBottom: spacing.md, borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '15px', lineHeight: 1.6 }}>
                    {step?.instruction}
                </p>
                {showHint && step?.hint && (
                    <div style={{
                        marginTop: '12px', padding: '10px 14px',
                        background: 'rgba(245,158,11,0.08)', borderRadius: borderRadius.sm,
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        border: '1px solid rgba(245,158,11,0.2)',
                    }}>
                        <Lightbulb size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: '#F59E0B', fontSize: '13px' }}>{step.hint}</span>
                    </div>
                )}
            </div>

            {/* DAW Simulator */}
            <DAWSimulator
                highlightSteps={highlightIds.map(id => {
                    // parse "step-kick-0" → channelId: "kick", stepIndex: 0
                    const parts = id.split('-');
                    return { channelId: parts[1] ?? '', stepIndex: Number(parts[2]) || 0 };
                })}
            />

            {/* Navigation buttons */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: spacing.md,
            }}>
                <button
                    onClick={actions.prevStep}
                    disabled={currentStep === 0}
                    style={{
                        background: 'transparent', border: `1px solid ${colors.border}`,
                        color: currentStep === 0 ? colors.textSecondary + '40' : colors.textSecondary,
                        padding: '8px 16px', borderRadius: borderRadius.sm, cursor: currentStep === 0 ? 'default' : 'pointer',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    <ChevronLeft size={14} /> Previous
                </button>

                <button onClick={actions.reset} style={{
                    background: 'transparent', border: 'none', color: colors.textSecondary,
                    cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                    <RotateCcw size={14} /> Reset
                </button>

                {lessonComplete ? (
                    <button onClick={onExit} style={{
                        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
                        border: 'none', color: '#fff', padding: '10px 24px', borderRadius: borderRadius.sm,
                        fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <Trophy size={16} /> Complete Lesson
                    </button>
                ) : (
                    <button
                        onClick={actions.nextStep}
                        disabled={!stepComplete && !!step?.target}
                        style={{
                            background: stepComplete
                                ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`
                                : colors.border,
                            border: 'none',
                            color: stepComplete ? '#fff' : colors.textSecondary,
                            padding: '8px 16px', borderRadius: borderRadius.sm,
                            cursor: stepComplete ? 'pointer' : 'default',
                            fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s',
                        }}
                    >
                        Next <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};
