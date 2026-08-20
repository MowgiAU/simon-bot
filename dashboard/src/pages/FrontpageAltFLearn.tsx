import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    GraduationCap, BookOpen, Play, ChevronLeft, ChevronRight,
    RotateCcw, Trophy, Music, Zap, Star, Clock,
    CheckCircle2, ArrowRight, Users,
} from 'lucide-react';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';
import { DAWWorkspace } from '../components/academy/DAWWorkspace';
import { LessonBubble } from '../components/academy/LessonBubble';
import { useLessonEngine } from '../components/academy/useLessonEngine';
import { LessonSchema, FIRST_BEAT_LESSON } from '../components/academy/LessonSchema';
import { createDefaultDAWState } from '../components/academy/AudioEngine';

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
    const {
        currentStep, totalSteps, step, stepComplete, lessonComplete,
        highlightChannelId, highlightStepIndex, pointerId, showHint,
    } = engine;
    const pct = totalSteps > 0 ? ((currentStep + (stepComplete ? 1 : 0)) / totalSteps) * 100 : 0;
    // Plain state (set via a callback ref below) rather than a ref object — a ref's `.current`
    // mutating doesn't re-trigger effects, so LessonBubble would only ever get one chance to
    // measure the container and might miss the window where it first becomes available.
    const [dawContainer, setDawContainer] = useState<HTMLDivElement | null>(null);
    // Once a step's actual task (a target or a play/stop requirement) is satisfied, drop the
    // bubble so it stops covering the board right before the student needs to click Next —
    // pure narration steps have no task, so their bubble is the only place to read them and
    // stays up throughout.
    const taskDone = !!(step?.target || step?.requireTransport) && stepComplete;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
            {/* Gentle pulse drawing the eye to whichever button is the actionable "move on" CTA */}
            <style>{`
                @keyframes fujiCtaPulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(111,191,64,0.55); }
                    50% { transform: scale(1.045); box-shadow: 0 0 0 10px rgba(111,191,64,0); }
                }
            `}</style>
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

            {/* DAW Simulator — instructions are a bubble pointing at whatever's relevant below.
                The bubble lives in this OUTER, non-clipping wrapper (not the glass panel itself,
                which needs overflow:hidden for its rounded corners) so it isn't cut off when it
                needs to render above something near the very top of the simulator. */}
            <div ref={setDawContainer} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <DAWWorkspace
                    visibleWindows={lesson.windows}
                    highlightChannelId={taskDone ? null : highlightChannelId}
                    highlightStepIndex={taskDone ? null : highlightStepIndex}
                />
                <LessonBubble
                    container={dawContainer}
                    targetId={pointerId}
                    text={step?.instruction ?? ''}
                    hint={step?.hint}
                    showHint={showHint}
                    hidden={taskDone}
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
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg, ${ACCENT}, #4A8A30)`, border: 'none', color: '#fff', padding: '10px 28px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONT, animation: 'fujiCtaPulse 1.6s ease-in-out infinite' }}>
                        <Trophy size={16} /> Complete Lesson
                    </button>
                ) : (
                    <button onClick={actions.nextStep} disabled={!stepComplete && !!step?.target}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: stepComplete || !step?.target ? ACCENT : S_HIGH, border: 'none', color: stepComplete || !step?.target ? '#000' : SUB, padding: '8px 22px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: stepComplete || !step?.target ? 'pointer' : 'default', fontFamily: FONT, opacity: !stepComplete && !!step?.target ? 0.5 : 1, animation: (stepComplete || !step?.target) ? 'fujiCtaPulse 1.6s ease-in-out infinite' : 'none' }}>
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
    const location  = useLocation();
    const { player } = usePlayer();

    const [activeLesson, setActiveLesson] = useState<LessonSchema | null>(null);
    const [apiLessons,   setApiLessons]   = useState<LessonSummary[]>([]);
    const [hovPath,      setHovPath]      = useState<string | null>(null);
    const [hovLesson,    setHovLesson]    = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/academy/lessons').then(r => setApiLessons(r.data || [])).catch(() => {});
    }, []);

    // slug is whatever follows /learn/ — undefined on the plain /learn browser page.
    const slugFromUrl = location.pathname.split('/').filter(Boolean)[1];

    const startLesson = useCallback((slug: string, opts?: { skipNav?: boolean }) => {
        // The lesson is admin-editable in the dashboard (Academy → Edit Lesson) — channels,
        // steps, and sample assets are all stored on an AcademyLesson row with a matching
        // slug. Fetch the full row and use it verbatim; fall back to the hardcoded
        // FIRST_BEAT_LESSON constant only if the requested slug IS first-beat and its row
        // doesn't exist yet or the request fails, so that one lesson always plays even before
        // its row has ever been seeded. Any other slug just fails quietly back to the list —
        // there's no other built-in lesson to fall back to yet.
        //
        // Deliberately NOT setting a placeholder lesson before this resolves: useLessonEngine
        // only re-initializes the DAW state when `lesson.id` changes, and re-entering the same
        // lesson would keep that id the same between an eager placeholder and the enriched
        // result — so a later setActiveLesson with fresh initState could silently never apply.
        if (!opts?.skipNav) navigate(`/learn/${slug}`);
        axios.get(`/api/academy/lessons/${slug}`)
            .then(r => {
                const db = r.data;
                if (!db) throw new Error('not found');
                const base = slug === FIRST_BEAT_LESSON.slug ? FIRST_BEAT_LESSON : db;
                const steps = Array.isArray(db.steps) && db.steps.length ? db.steps : base.steps;
                const assets = Array.isArray(db.assets) ? db.assets : (base.assets ?? []);
                const initState = db.initState || createDefaultDAWState();
                setActiveLesson({
                    id: db.id, slug: db.slug, title: db.title, description: db.description ?? '',
                    category: db.category, difficulty: db.difficulty,
                    steps, assets, initState,
                });
            })
            .catch(() => {
                if (slug === FIRST_BEAT_LESSON.slug) setActiveLesson(FIRST_BEAT_LESSON);
                else navigate('/learn', { replace: true });
            });
    }, [navigate]);

    // Deep link / refresh: /learn/:slug should start that lesson directly instead of always
    // landing on the list. Also covers the back button returning to a lesson URL.
    useEffect(() => {
        if (slugFromUrl && activeLesson?.slug !== slugFromUrl) {
            startLesson(slugFromUrl, { skipNav: true });
        } else if (!slugFromUrl && activeLesson) {
            // Browser back button went from a lesson URL to the plain list URL.
            setActiveLesson(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slugFromUrl]);

    const exitLesson = useCallback(() => {
        setActiveLesson(null);
        navigate('/learn');
    }, [navigate]);

    const totalAvailable = PATHS.reduce((s, p) => s + p.lessons.length, 0);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Learn' }]} />

                <div style={{
                    flex: 1, minHeight: 0,
                    overflowY: activeLesson ? 'hidden' : 'auto',
                    paddingBottom: player.currentTrack ? 90 : 0,
                }}>

                    {activeLesson ? (
                        /* ── LESSON VIEW ── */
                        <div style={{
                            height: '100%', minHeight: 0, padding: '12px 16px 14px',
                            boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                        }}>
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
                                            onClick={() => startLesson(FIRST_BEAT_LESSON.slug)}
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
                                                                onClick={lesson.builtin ? () => startLesson(FIRST_BEAT_LESSON.slug) : undefined}
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
