/**
 * LearnPage — Public-facing Academy lesson browser + interactive player.
 * Accessible at /learn (no authentication required).
 * Lessons are displayed publicly; progress tracking requires login.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';
import {
    GraduationCap, BookOpen, Play, CheckCircle2, ChevronRight, ChevronLeft,
    RotateCcw, Trophy, Star, Clock, ArrowRight, Lightbulb, Music,
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

type View = 'browser' | 'lesson';

const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: '#6FBF40',
    intermediate: '#E88C3A',
    advanced: '#E8503A',
};

const DIFFICULTY_LABELS: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

export const LearnPage: React.FC = () => {
    const [view, setView] = useState<View>('browser');
    const [lessons, setLessons] = useState<LessonSummary[]>([]);
    const [activeLesson, setActiveLesson] = useState<LessonSchema | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get(`${API}/api/academy/lessons`);
                setLessons(res.data);
            } catch (e) { /* fallback to built-in */ }
            finally { setLoading(false); }
        })();
    }, []);

    const startLesson = useCallback((_lesson: LessonSummary | null) => {
        setActiveLesson(FIRST_BEAT_LESSON);
        setView('lesson');
    }, []);

    const exitLesson = useCallback(() => {
        setView('browser');
        setActiveLesson(null);
    }, []);

    if (view === 'lesson' && activeLesson) {
        return (
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
                <LessonPlayer lesson={activeLesson} onExit={exitLesson} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
            {/* Hero */}
            <div style={{
                textAlign: 'center', marginBottom: '48px',
            }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'rgba(111, 191, 64, 0.1)', marginBottom: '16px',
                    border: '2px solid rgba(111, 191, 64, 0.2)',
                }}>
                    <GraduationCap size={32} color="#6FBF40" />
                </div>
                <h1 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: '32px', fontWeight: 700 }}>
                    Fuji Academy
                </h1>
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: '16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
                    Learn FL Studio through interactive, hands-on lessons with a built-in DAW simulator.
                    No downloads required.
                </p>
            </div>

            {/* Feature badges */}
            <div style={{
                display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '48px',
                flexWrap: 'wrap',
            }}>
                {[
                    { icon: <Music size={16} />, text: 'Interactive DAW' },
                    { icon: <Play size={16} />, text: 'Step-by-Step Guided' },
                    { icon: <Trophy size={16} />, text: 'Earn Reputation' },
                ].map((badge, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: colors.textSecondary, fontSize: '13px',
                    }}>
                        <span style={{ color: '#6FBF40' }}>{badge.icon}</span>
                        {badge.text}
                    </div>
                ))}
            </div>

            {/* Lessons grid */}
            <h2 style={{
                color: colors.textPrimary, fontSize: '20px', marginBottom: '20px',
                fontWeight: 600,
            }}>
                Available Lessons
            </h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
            }}>
                {/* Built-in demo */}
                <LessonCard
                    title={FIRST_BEAT_LESSON.title}
                    description={FIRST_BEAT_LESSON.description}
                    category={FIRST_BEAT_LESSON.category}
                    difficulty={FIRST_BEAT_LESSON.difficulty}
                    onStart={() => startLesson(null)}
                />

                {lessons.map(lesson => (
                    <LessonCard
                        key={lesson.id}
                        title={lesson.title}
                        description={lesson.description}
                        category={lesson.category}
                        difficulty={lesson.difficulty}
                        duration={lesson.duration}
                        completionCount={lesson.completionCount}
                        onStart={() => startLesson(lesson)}
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Lesson Card ───

const LessonCard: React.FC<{
    title: string; description: string; category: string; difficulty: string;
    duration?: number | null; completionCount?: number; onStart: () => void;
}> = ({ title, description, category, difficulty, duration, completionCount, onStart }) => (
    <div
        onClick={onStart}
        style={{
            background: '#1E1E1E',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '12px',
            cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
        }}
        onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#6FBF40';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        }}
    >
        {/* Difficulty badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: DIFFICULTY_COLORS[difficulty] ?? '#888',
                background: `${DIFFICULTY_COLORS[difficulty] ?? '#888'}15`,
                padding: '3px 8px', borderRadius: '10px',
            }}>
                {DIFFICULTY_LABELS[difficulty] ?? difficulty}
            </span>
            {completionCount != null && completionCount > 0 && (
                <span style={{ fontSize: '11px', color: '#777' }}>
                    {completionCount} completed
                </span>
            )}
        </div>

        <h3 style={{ margin: 0, color: '#E8E8E8', fontSize: '16px', fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: 0, color: '#999', fontSize: '13px', lineHeight: 1.5 }}>{description}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
            {duration && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#777', fontSize: '12px' }}>
                    <Clock size={12} /> ~{duration} min
                </div>
            )}
            <button style={{
                background: 'linear-gradient(135deg, #6FBF40, #4A8A30)',
                border: 'none', color: '#fff',
                padding: '8px 20px', borderRadius: '4px', fontWeight: 600,
                fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                marginLeft: 'auto',
            }}>
                Start <ArrowRight size={14} />
            </button>
        </div>
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
                marginBottom: '16px',
            }}>
                <button onClick={onExit} style={{
                    background: 'transparent', border: '1px solid #444',
                    color: '#AAA', padding: '6px 14px', borderRadius: '4px',
                    cursor: 'pointer', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <ChevronLeft size={14} /> Back to Lessons
                </button>
                <span style={{ color: '#888', fontSize: '13px', fontFamily: 'monospace' }}>
                    Step {currentStep + 1} / {totalSteps}
                </span>
            </div>

            {/* Progress bar */}
            <div style={{
                height: 3, background: '#333', borderRadius: 2,
                marginBottom: '16px', overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%', width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #6FBF40, #4A8A30)',
                    borderRadius: 2, transition: 'width 0.4s ease',
                }} />
            </div>

            {/* Instruction */}
            <div style={{
                background: '#1E1E1E',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '16px 20px',
                marginBottom: '16px',
                borderLeft: '3px solid #6FBF40',
            }}>
                <p style={{ margin: 0, color: '#DDD', fontSize: '15px', lineHeight: 1.6 }}>
                    {step?.instruction}
                </p>
                {showHint && step?.hint && (
                    <div style={{
                        marginTop: '12px', padding: '10px 14px',
                        background: 'rgba(232,140,58,0.08)', borderRadius: '4px',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        border: '1px solid rgba(232,140,58,0.2)',
                    }}>
                        <Lightbulb size={16} color="#E88C3A" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: '#E88C3A', fontSize: '13px' }}>{step.hint}</span>
                    </div>
                )}
            </div>

            {/* DAW Simulator */}
            <DAWSimulator
                highlightSteps={highlightIds.map(id => {
                    const parts = id.split('-');
                    return { channelId: parts[1] ?? '', stepIndex: Number(parts[2]) || 0 };
                })}
            />

            {/* Navigation */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '16px',
            }}>
                <button
                    onClick={actions.prevStep}
                    disabled={currentStep === 0}
                    style={{
                        background: 'transparent', border: '1px solid #444',
                        color: currentStep === 0 ? '#555' : '#AAA',
                        padding: '8px 16px', borderRadius: '4px',
                        cursor: currentStep === 0 ? 'default' : 'pointer',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    <ChevronLeft size={14} /> Previous
                </button>

                <button onClick={actions.reset} style={{
                    background: 'transparent', border: 'none', color: '#777',
                    cursor: 'pointer', fontSize: '12px',
                    display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                    <RotateCcw size={14} /> Reset
                </button>

                {lessonComplete ? (
                    <button onClick={onExit} style={{
                        background: 'linear-gradient(135deg, #6FBF40, #4A8A30)',
                        border: 'none', color: '#fff',
                        padding: '10px 24px', borderRadius: '4px',
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
                                ? 'linear-gradient(135deg, #6FBF40, #4A8A30)'
                                : '#333',
                            border: 'none',
                            color: stepComplete ? '#fff' : '#777',
                            padding: '8px 16px', borderRadius: '4px',
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
