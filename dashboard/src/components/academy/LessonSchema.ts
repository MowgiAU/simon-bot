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
    /**
     * What state property to check (dot path, e.g. "channels.0.steps.0").
     * Used as-is for non-channel targets. For channel targets, prefer `channelId` below —
     * it survives channel reordering/removal, whereas a positional index here does not.
     */
    statePath: string;
    /**
     * Stable channel id this target checks (e.g. "kick"), resolved to the channel's *current*
     * index at check time. Takes precedence over `statePath` when both are set — this is what
     * lets an admin freely reorder or remove channels without desyncing every step after the
     * edited one.
     */
    channelId?: string;
    /** Field on the resolved channel to check (defaults to "steps") */
    channelField?: string;
    /**
     * Keep the lesson bubble pointing at the channel name for the whole step, instead of
     * advancing to whichever individual step still doesn't match. Use this when the
     * instruction teaches a whole-row action (e.g. right-click → Fill) rather than
     * click-by-click placement — pointing at individual steps would suggest the wrong
     * technique.
     */
    pointAtChannelOnly?: boolean;
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
    /**
     * data-academy-id of a window to point the bubble at when this step has no `target`
     * (a pure narration step). Without this, narration steps fall back to the shared
     * title bar — fine for "here's the transport", useless for "here's the Channel Rack".
     */
    anchorId?: string;
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
    /**
     * Which DAW windows this lesson opens with. Omitted or empty means all of them —
     * "Your First Beat" only needs the Channel Rack, and showing the whole studio
     * just buries the thing the student is meant to look at.
     */
    windows?: DAWWindowId[];
}

export type DAWWindowId = 'rack' | 'playlist' | 'mixer' | 'piano' | 'eq';

export const DAW_WINDOW_OPTIONS: { id: DAWWindowId; label: string }[] = [
    { id: 'rack', label: 'Channel rack' },
    { id: 'playlist', label: 'Playlist' },
    { id: 'mixer', label: 'Mixer' },
    { id: 'piano', label: 'Piano roll' },
    { id: 'eq', label: 'Parametric EQ 2' },
];

/**
 * data-academy-id values for each DAW window, for pointing a narration step's bubble at
 * a window as a whole. Must match DAWWindow.tsx's own id derivation
 * (`daw-window-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`) for each window title
 * used in DAWWorkspace.tsx, or the bubble silently falls back to the title bar.
 */
export const WINDOW_ANCHOR_OPTIONS: { id: string; label: string }[] = [
    { id: 'daw-window-channel-rack', label: 'Channel rack' },
    { id: 'daw-window-playlist', label: 'Playlist' },
    { id: 'daw-window-mixer', label: 'Mixer' },
    { id: 'daw-window-piano-roll', label: 'Piano roll' },
    { id: 'daw-window-parametric-eq-2', label: 'Parametric EQ 2' },
];

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
    let actual: any;
    if (target.channelId) {
        // Resolve the channel by stable id, not by a pre-baked positional index — this is
        // what makes reordering/removing channels safe (see LessonStepTarget.channelId).
        const channel = state.channels.find(ch => ch.id === target.channelId);
        actual = channel ? getByPath(channel, target.channelField ?? 'steps') : undefined;
    } else {
        actual = getByPath(state, target.statePath);
    }
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
    windows: ['rack'],
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
                channelId: 'kick',
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
                channelId: 'clap',
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
                channelId: 'hihat',
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
