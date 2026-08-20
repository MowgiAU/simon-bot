/**
 * useLessonEngine — React hook powering the interactive lesson loop.
 *
 * Observes DAW state, validates against current step requirements,
 * manages step progression, and produces highlight data for the UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDAWStore } from './DAWStore';
import { LessonSchema, LessonStep, checkTarget } from './LessonSchema';

export interface LessonEngineState {
    /** Current step index */
    currentStep: number;
    /** Total steps in the lesson */
    totalSteps: number;
    /** Current step definition */
    step: LessonStep | null;
    /** Whether the current step's target has been met */
    stepComplete: boolean;
    /** Completed step indices */
    completedSteps: number[];
    /** Is the entire lesson complete? */
    lessonComplete: boolean;
    /** Channel to emphasize (whole row), or null for none */
    highlightChannelId: string | null;
    /** Specific step within highlightChannelId still outstanding, or null to just emphasize the row */
    highlightStepIndex: number | null;
    /** data-academy-id of the element the instruction bubble should point at */
    pointerId: string | null;
    /** Show hint? */
    showHint: boolean;
}

export interface LessonEngineActions {
    /** Advance to the next step (only works if current is complete or has no target) */
    nextStep: () => void;
    /** Go back one step */
    prevStep: () => void;
    /** Jump to a specific step */
    goToStep: (step: number) => void;
    /** Reset the lesson to step 0 */
    reset: () => void;
}

export function useLessonEngine(lesson: LessonSchema | null): [LessonEngineState, LessonEngineActions] {
    const dawState = useDAWStore(s => s.state);
    const loadState = useDAWStore(s => s.loadState);

    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);
    const [showHint, setShowHint] = useState(false);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const autoAdvanceRef = useRef<ReturnType<typeof setTimeout>>();

    const steps = lesson?.steps ?? [];
    const step = steps[currentStep] ?? null;
    const totalSteps = steps.length;

    // Check if current step target is satisfied
    const stepComplete = useMemo(() => {
        if (!step) return false;
        if (!step.target && !step.requireTransport) return true; // Pure instruction step
        if (step.requireTransport) {
            return step.requireTransport === 'play' ? dawState.transport.playing : !dawState.transport.playing;
        }
        if (step.target) {
            return checkTarget(dawState, step.target);
        }
        return false;
    }, [step, dawState]);

    // Auto-complete tracking: mark step done when target met
    useEffect(() => {
        if (stepComplete && !completedSteps.includes(currentStep)) {
            setCompletedSteps(prev => [...prev, currentStep]);
        }
    }, [stepComplete, currentStep, completedSteps]);

    // Hint timer: show hint after 8 seconds on a step
    useEffect(() => {
        setShowHint(false);
        if (step?.hint) {
            hintTimerRef.current = setTimeout(() => setShowHint(true), 8000);
        }
        return () => { clearTimeout(hintTimerRef.current); };
    }, [currentStep, step?.hint]);

    // Auto-advance for non-interactive steps
    useEffect(() => {
        clearTimeout(autoAdvanceRef.current);
        if (step?.autoAdvanceMs && stepComplete) {
            autoAdvanceRef.current = setTimeout(() => {
                if (currentStep < totalSteps - 1) {
                    setCurrentStep(prev => prev + 1);
                }
            }, step.autoAdvanceMs);
        }
        return () => { clearTimeout(autoAdvanceRef.current); };
    }, [step?.autoAdvanceMs, stepComplete, currentStep, totalSteps]);

    // Initialize DAW state when lesson loads
    useEffect(() => {
        if (lesson) {
            loadState(lesson.initState);
            setCurrentStep(0);
            setCompletedSteps([]);
        }
    }, [lesson?.id]);

    // Load any real samples the lesson specifies (e.g. picked from the H2H sample pools in
    // the admin UI) into the audio engine, keyed by channel id. AudioEngine.scheduleStep
    // already prefers a loaded sample buffer over synthesizing one, and falls back to the
    // default oscillator sound for any channel with no matching asset — so this is purely
    // additive and never required for a lesson to work.
    const engine = useDAWStore(s => s.engine);
    useEffect(() => {
        if (!engine || !lesson?.assets?.length) return;
        for (const asset of lesson.assets) {
            if (asset.type !== 'sample' || !asset.url) continue;
            engine.loadSample(asset.name, asset.url).catch(() => {
                // A dead/unreachable URL just means that channel keeps its synth fallback.
            });
        }
    }, [engine, lesson?.id]);

    // Resolve which channel/step to point the instruction bubble at. For a pattern target
    // (channelId + an array expectedValue, i.e. the common "place these steps" case) this finds
    // the FIRST step that doesn't yet match — so the highlight advances one step at a time as
    // the student places each one, rather than showing the whole finished pattern up front.
    const highlightTarget = useMemo((): { channelId: string; stepIndex: number | null } | null => {
        const target = step?.target;
        if (!target?.channelId) return null;
        const channel = dawState.channels.find(c => c.id === target.channelId);
        const actual = channel ? (channel as any)[target.channelField ?? 'steps'] : undefined;
        if (Array.isArray(actual) && Array.isArray(target.expectedValue)) {
            const idx = target.expectedValue.findIndex((v: any, i: number) => v !== actual[i]);
            return { channelId: target.channelId, stepIndex: idx === -1 ? null : idx };
        }
        return { channelId: target.channelId, stepIndex: null };
    }, [step, dawState]);

    const pointerId = useMemo(() => {
        if (!step) return null;
        if (highlightTarget) {
            return highlightTarget.stepIndex != null
                ? `step-${highlightTarget.channelId}-${highlightTarget.stepIndex}`
                : `channel-${highlightTarget.channelId}`;
        }
        if (step.requireTransport) return step.requireTransport === 'play' ? 'transport-play' : 'transport-stop';
        if (step.target?.componentId) return step.target.componentId; // legacy/advanced steps
        return 'daw-titlebar';
    }, [step, highlightTarget]);

    const lessonComplete = totalSteps > 0 && completedSteps.length >= totalSteps;

    const nextStep = useCallback(() => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1);
        }
    }, [currentStep, totalSteps]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    }, [currentStep]);

    const goToStep = useCallback((s: number) => {
        if (s >= 0 && s < totalSteps) setCurrentStep(s);
    }, [totalSteps]);

    const reset = useCallback(() => {
        setCurrentStep(0);
        setCompletedSteps([]);
        if (lesson) loadState(lesson.initState);
    }, [lesson, loadState]);

    return [
        {
            currentStep, totalSteps, step, stepComplete, completedSteps, lessonComplete,
            highlightChannelId: highlightTarget?.channelId ?? null,
            highlightStepIndex: highlightTarget?.stepIndex ?? null,
            pointerId, showHint,
        },
        { nextStep, prevStep, goToStep, reset },
    ];
}
