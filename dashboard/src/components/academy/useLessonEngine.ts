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
    /** Component IDs to highlight */
    highlightIds: string[];
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

    const highlightIds = useMemo(() => {
        if (!step?.target) return [];
        return [step.target.componentId];
    }, [step]);

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
        { currentStep, totalSteps, step, stepComplete, completedSteps, lessonComplete, highlightIds, showHint },
        { nextStep, prevStep, goToStep, reset },
    ];
}
