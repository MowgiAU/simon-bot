/**
 * Lesson Schema types — JSON-driven lesson definitions.
 *
 * Each lesson has an init_state (starting DAW config) and an array of steps.
 * Steps define instructions, expected user actions, and optional demo animations.
 */
import { DAWState } from './AudioEngine';

export interface LessonAsset {
    name: string;     // Identifier used in the engine (e.g. "kick")
    url: string;      // CDN URL to .wav / .ogg
    type: 'sample' | 'preset';
}

export interface LessonStepTarget {
    /** Which component to highlight — matches data-academy-id attributes */
    componentId: string;
    /** What state property to check (dot path, e.g. "channels.0.steps.0") */
    statePath: string;
    /** Expected value — step is complete when actual matches this */
    expectedValue: any;
    /** Comparison mode */
    compare?: 'eq' | 'gte' | 'lte' | 'range';
    /** For range comparisons */
    rangeMin?: number;
    rangeMax?: number;
}

export interface LessonStep {
    id: number;
    instruction: string;   // Markdown-capable instruction text
    hint?: string;         // Optional extra hint shown after a delay
    target?: LessonStepTarget;
    /** Optional: auto-demo animation (component ID + target value) */
    demo?: { componentId: string; statePath: string; toValue: any; durationMs: number };
    /** Optional: require play/stop action */
    requireTransport?: 'play' | 'stop';
    /** Delay before auto-advancing (ms) — only for non-interactive steps */
    autoAdvanceMs?: number;
}

export interface LessonSchema {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    difficulty: string;
    /** DAW state to initialize the simulator with */
    initState: DAWState;
    /** Ordered lesson steps */
    steps: LessonStep[];
    /** Assets to preload */
    assets: LessonAsset[];
}

// ─── Helper: resolve a dot-path on the DAW state ───

export function getByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null) return undefined;
        const idx = Number(part);
        current = Number.isNaN(idx) ? current[part] : current[idx];
    }
    return current;
}

/** Check if DAW state satisfies a step target */
export function checkTarget(state: DAWState, target: LessonStepTarget): boolean {
    const actual = getByPath(state, target.statePath);
    if (actual === undefined) return false;

    switch (target.compare ?? 'eq') {
        case 'eq':
            return JSON.stringify(actual) === JSON.stringify(target.expectedValue);
        case 'gte':
            return typeof actual === 'number' && actual >= target.expectedValue;
        case 'lte':
            return typeof actual === 'number' && actual <= target.expectedValue;
        case 'range':
            return typeof actual === 'number'
                && actual >= (target.rangeMin ?? -Infinity)
                && actual <= (target.rangeMax ?? Infinity);
        default:
            return false;
    }
}

// ─── Sample "First Beat" lesson ───

import { createDefaultDAWState } from './AudioEngine';

export const FIRST_BEAT_LESSON: LessonSchema = {
    id: 'first-beat',
    slug: 'first-beat',
    title: 'Your First Beat',
    description: 'Learn the basics of FL Studio by creating a simple 4-on-the-floor beat pattern.',
    category: 'basics',
    difficulty: 'beginner',
    initState: createDefaultDAWState(),
    assets: [],
    steps: [
        {
            id: 0,
            instruction: 'Welcome to the Fuji Academy! This is the **Channel Rack** — the heart of FL Studio. Each row is an instrument. Let\'s start by placing a **kick drum** on every beat.',
            autoAdvanceMs: undefined,
        },
        {
            id: 1,
            instruction: 'Click steps **1, 5, 9, and 13** on the **Kick** channel to create a four-on-the-floor pattern.',
            hint: 'These are the first step of each beat group — they\'re slightly brighter.',
            target: {
                componentId: 'step-kick-0',
                statePath: 'channels.0.steps',
                expectedValue: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
                compare: 'eq',
            },
        },
        {
            id: 2,
            instruction: 'Great! Now add a **clap** on beats 2 and 4 (steps **5** and **13**).',
            target: {
                componentId: 'step-clap-4',
                statePath: 'channels.1.steps',
                expectedValue: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
                compare: 'eq',
            },
        },
        {
            id: 3,
            instruction: 'Add **hi-hats** on every other step (steps 1, 3, 5, 7, 9, 11, 13, 15) for a driving rhythm.',
            target: {
                componentId: 'step-hihat-0',
                statePath: 'channels.2.steps',
                expectedValue: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
                compare: 'eq',
            },
        },
        {
            id: 4,
            instruction: 'Now press **Play** to hear your beat!',
            requireTransport: 'play',
        },
        {
            id: 5,
            instruction: 'You did it! You\'ve created your first beat in the Fuji Academy simulator. In a real FL Studio project, you\'d now start adding melodies, bass lines, and effects. Press **Next** to finish.',
            autoAdvanceMs: undefined,
        },
    ],
};
