import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    GraduationCap, BookOpen, Play, ChevronLeft, ChevronRight,
    RotateCcw, Trophy, Lightbulb, Music, Zap, Star, Clock,
    CheckCircle2, ArrowRight, Users,
} from 'lucide-react';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';
import { DAWSimulator } from '../components/academy/DAWSimulator';
import { useLessonEngine } from '../components/academy/useLessonEngine';
import { LessonSchema, FIRST_BEAT_LESSON } from '../components/academy/LessonSchema';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';
const ACCENT = '#6FBF40';

const DIFF_COLOR: Record<string, string> = {
    beginner:     '#6FBF40',
    intermediate: '#E88C3A',
    advanced:     '#E8503A',
};

interface LessonSummary {
    id: string; slug: string; title: string; description: string;
    category: string; difficulty: string; duration: number | null; completionCount: number;
}

const PATHS = [
    {
        id: 'basics',
        label: 'Getting Started',
        icon: BookOpen,
        accent: ACCENT,
        desc: 'The essentials — Channel Rack, Pattern blocks, and your first beat.',
        lessons: [
            { title: 'Your First Beat', difficulty: 'beginner', duration: 10, builtin: true },
            { title: 'Understanding the Channel Rack', difficulty: 'beginner', duration: 8, builtin: false },
            { title: 'Patterns vs Arrangements', difficulty: 'beginner', duration: 12, builtin: false },
        ],
    },
    {
        id: 'sound-design',
        label: 'Sound Design',
        icon: Music,
        accent: SECONDARY,
        desc: 'Shape sounds with synths, samplers, and effects.',
        lessons: [
            { title: 'Intro to Harmor', difficulty: 'intermediate', duration: 15, builtin: false },
            { title: 'Sidechain Compression', difficulty: 'intermediate', duration: 10, builtin: false },
            { title: 'Reese Bass from Scratch', difficulty: 'advanced', duration: 20, builtin: false },
        ],
    },
    {
        id: 'mixing',
        label: 'Mixing & Mastering',
        icon: Zap,
        accent: PRIMARY,
        desc: 'Get your tracks sounding professional in the mixer.',
        lessons: [
            { title: 'Gain Staging Basics', difficulty: 'beginner', duration: 8, builtin: false },
            { title: 'EQ Fundamentals', difficulty: 'intermediate', duration: 12, builtin: false },
            { title: 'Mastering Your Track', difficulty: 'advanced', duration: 18, builtin: false },
        ],
    },
    {
        id: 'battle',
        label: 'Battle Skills',
        icon: Trophy,
        accent: TERTIARY,
        desc: 'Produce fast, compete well — skills for the Arena.',
        lessons: [
            { title: 'Beat in 30 Minutes', difficulty: 'intermediate', duration: 30, builtin: false },
            { title: 'Workflow Shortcuts', difficulty: 'beginner', duration: 10, builtin: false },
            { title: 'Mixing Under Pressure', difficulty: 'advanced', duration: 15, builtin: false },
        ],
    },
];

// ─── Lesson Player (inline, restyled for Alt F palette) ───

const AltLessonPlayer: React.FC<{ lesson: LessonSchema; onExit: () => void }> = ({ lesson, onExit }) => {
    const [engine, actions] = useLessonEngine(lesson);
    const { currentStep, totalSteps, step, stepComplete, lessonComplete, highlightIds, showHint } = engine;
    const pct = totalSteps > 0 ? ((currentStep + (stepComplete ? 1 : 0)) / totalSteps) * 100 : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: S_HIGH, border: `1px solid rgba(255,255,255,0.1)`, color: SUB, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: FONT }}>
                    <ChevronLeft size={14} /> Back to Lessons
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: SUB, fontSize: 13 }}>Step {currentStep + 1} / {totalSteps}</span>
                    <button onClick={actions.reset} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: SUB, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
                        <RotateCcw size={13} /> Reset
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT}, #4A8A30)`, borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>

            {/* Instruction card */}
            <div style={{ ...glass, borderRadius: 14, padding: '18px 22px', borderLeft: `3px solid ${ACCENT}` }}>
                <p style={{ margin: 0, color: TEXT, fontSize: 15, lineHeight: 1.65 }}>{step?.instruction}</p>
                {showHint && step?.hint && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(232,140,58,0.08)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8, border: '1px solid rgba(232,140,58,0.2)' }}>
                        <Lightbulb size={16} color="#E88C3A" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: '#E88C3A', fontSize: 13 }}>{step.hint}</span>
                    </div>
                )}
            </div>

            {/* DAW Simulator */}
            <div style={{ ...glass, borderRadius: 14, overflow: 'hidden' }}>
                <DAWSimulator
                    highlightSteps={highlightIds.map(id => {
                        const parts = id.split('-');
                        return { channelId: parts[1] ?? '', stepIndex: Number(parts[2]) || 0 };
                    })}
                />
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={actions.prevStep} disabled={currentStep === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: S_HIGH, border: '1px solid rgba(255,255,255,0.1)', color: currentStep === 0 ? SUB : TEXT, padding: '8px 18px', borderRadius: 8, cursor: currentStep === 0 ? 'default' : 'pointer', fontSize: 13, fontFamily: FONT, opacity: currentStep === 0 ? 0.4 : 1 }}>
                    <ChevronLeft size={14} /> Previous
                </button>

                {lessonComplete ? (
                    <button onClick={onExit}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg, ${ACCENT}, #4A8A30)`, border: 'none', color: '#fff', padding: '10px 28px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONT }}>
                        <Trophy size={16} /> Complete Lesson
                    </button>
                ) : (
                    <button onClick={actions.nextStep} disabled={!stepComplete && !!step?.target}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: stepComplete || !step?.target ? ACCENT : S_HIGH, border: 'none', color: stepComplete || !step?.target ? '#000' : SUB, padding: '8px 22px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: stepComplete || !step?.target ? 'pointer' : 'default', fontFamily: FONT, opacity: !stepComplete && !!step?.target ? 0.5 : 1 }}>
                        Next <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Main page ───

export const FrontpageAltFLearn: React.FC = () => {
    const navigate  = useNavigate();
    const { player } = usePlayer();

    const [activeLesson, setActiveLesson] = useState<LessonSchema | null>(null);
    const [apiLessons,   setApiLessons]   = useState<LessonSummary[]>([]);
    const [hovPath,      setHovPath]      = useState<string | null>(null);
    const [hovLesson,    setHovLesson]    = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/academy/lessons').then(r => setApiLessons(r.data || [])).catch(() => {});
    }, []);

    const startLesson = useCallback(() => {
        setActiveLesson(FIRST_BEAT_LESSON);
    }, []);

    const exitLesson = useCallback(() => {
        setActiveLesson(null);
    }, []);

    const totalAvailable = PATHS.reduce((s, p) => s + p.lessons.length, 0);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Learn' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {activeLesson ? (
                        /* ── LESSON VIEW ── */
                        <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 32px 60px', boxSizing: 'border-box' }}>
                            <AltLessonPlayer lesson={activeLesson} onExit={exitLesson} />
                        </div>
                    ) : (
                        <>
                            {/* ── HERO ── */}
                            <section style={{ position: 'relative', minHeight: 360, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #080e18 0%, #0d1a10 50%, #0f131d 100%)' }} />
                                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 55% at 50% 0%, ${ACCENT}18 0%, transparent 70%)` }} />
                                <div style={{ position: 'absolute', right: 60, top: 40, opacity: 0.04, transform: 'rotate(-10deg)' }}>
                                    <GraduationCap size={300} color="#fff" />
                                </div>

                                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1280, margin: '0 auto', padding: '0 32px', width: '100%', boxSizing: 'border-box' }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 100 }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                            <span style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, color: ACCENT, padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                Fuji Academy
                                            </span>
                                        </div>
                                        <h1 style={{ margin: '0 0 12px', fontSize: 60, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>
                                            Learn
                                        </h1>
                                        <p style={{ margin: 0, fontSize: 17, color: SUB, maxWidth: 480, lineHeight: 1.6 }}>
                                            Interactive FL Studio lessons with a built-in DAW simulator. Learn by doing — no downloads needed.
                                        </p>
                                    </div>

                                    {/* Stats pill */}
                                    <div style={{ position: 'absolute', bottom: 28, left: 32, right: 32 }}>
                                        <div style={{ display: 'inline-flex', gap: 0, background: 'rgba(15,19,29,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                                            {[
                                                { label: 'Learning Paths', value: String(PATHS.length) },
                                                { label: 'Total Lessons', value: String(totalAvailable) },
                                                { label: 'Interactive DAW', value: 'Built-in' },
                                            ].map((s, i) => (
                                                <div key={s.label} style={{ padding: '12px 24px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{s.value}</div>
                                                    <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* ── FEATURED LESSON ── */}
                            <div style={{ maxWidth: 1280, margin: '32px auto 0', padding: '0 32px', boxSizing: 'border-box' }}>
                                <div style={{
                                    ...glass,
                                    borderRadius: 20,
                                    background: `linear-gradient(135deg, ${ACCENT}14 0%, rgba(74,138,48,0.06) 100%)`,
                                    border: `1px solid ${ACCENT}30`,
                                    overflow: 'hidden',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '28px 36px', flexWrap: 'wrap' }}>
                                        <div style={{ width: 56, height: 56, borderRadius: 16, background: `${ACCENT}20`, border: `1px solid ${ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Play size={26} color={ACCENT} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 200 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: ACCENT, background: `${ACCENT}18`, padding: '3px 8px', borderRadius: 6 }}>Beginner</span>
                                                <span style={{ fontSize: 11, color: SUB }}>~10 min · Interactive</span>
                                            </div>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Your First Beat</div>
                                            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.55 }}>
                                                Learn the basics of FL Studio by creating a 4-on-the-floor beat pattern — step by step, right in the browser.
                                            </p>
                                        </div>
                                        <button
                                            onClick={startLesson}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 12, background: ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>
                                            <Play size={17} /> Start Lesson
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ── LEARNING PATHS GRID ── */}
                            <div style={{ maxWidth: 1280, margin: '32px auto 0', padding: '0 32px 60px', boxSizing: 'border-box' }}>
                                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: TEXT }}>Learning Paths</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                                    {PATHS.map(path => {
                                        const Icon = path.icon;
                                        const isHov = hovPath === path.id;
                                        return (
                                            <div key={path.id}
                                                onMouseEnter={() => setHovPath(path.id)}
                                                onMouseLeave={() => setHovPath(null)}
                                                style={{
                                                    ...glass,
                                                    borderRadius: 20,
                                                    overflow: 'hidden',
                                                    border: `1px solid ${isHov ? path.accent + '44' : 'rgba(255,255,255,0.08)'}`,
                                                    transition: 'border-color 0.2s, transform 0.15s',
                                                    transform: isHov ? 'translateY(-2px)' : 'none',
                                                }}>
                                                {/* Path header */}
                                                <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${path.accent}18`, border: `1px solid ${path.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <Icon size={20} color={path.accent} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{path.label}</div>
                                                        <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{path.desc}</div>
                                                    </div>
                                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB, flexShrink: 0 }}>{path.lessons.length} lessons</span>
                                                </div>

                                                {/* Lesson list */}
                                                <div>
                                                    {path.lessons.map((lesson, li) => {
                                                        const lKey = `${path.id}-${li}`;
                                                        const lHov = hovLesson === lKey;
                                                        const dc = DIFF_COLOR[lesson.difficulty] || SUB;
                                                        return (
                                                            <div key={li}
                                                                onClick={lesson.builtin ? startLesson : undefined}
                                                                onMouseEnter={() => setHovLesson(lKey)}
                                                                onMouseLeave={() => setHovLesson(null)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                                    padding: '12px 22px',
                                                                    borderBottom: li < path.lessons.length - 1 ? `1px solid ${DIVIDER}` : 'none',
                                                                    background: lHov ? 'rgba(255,255,255,0.03)' : 'transparent',
                                                                    cursor: lesson.builtin ? 'pointer' : 'default',
                                                                    transition: 'background 0.15s',
                                                                }}>
                                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: lesson.builtin ? `${ACCENT}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${lesson.builtin ? ACCENT + '40' : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    {lesson.builtin
                                                                        ? <Play size={12} color={ACCENT} />
                                                                        : <BookOpen size={12} color={SUB} />
                                                                    }
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 600, color: lesson.builtin ? TEXT : SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        {lesson.title}
                                                                        {!lesson.builtin && <span style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>Soon</span>}
                                                                    </div>
                                                                </div>
                                                                <span style={{ fontSize: 10, color: dc, background: `${dc}15`, padding: '2px 7px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                                                                    {lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                                                                </span>
                                                                <span style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{lesson.duration}m</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};
