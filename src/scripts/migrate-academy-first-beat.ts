/**
 * One-time migration: seed/update the "first-beat" AcademyLesson row's `steps` and
 * `initState` columns with content matching the hardcoded FIRST_BEAT_LESSON constant
 * (dashboard/src/components/academy/LessonSchema.ts), so the lesson becomes fully
 * DB-driven without changing what students actually see.
 *
 * Steps use LessonStepTarget.channelId (not a positional statePath index) so the new
 * Academy admin editor can freely reorder/remove channels without desyncing steps.
 *
 * Usage (from project root):
 *   npx tsx src/scripts/migrate-academy-first-beat.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const db = new PrismaClient();

function defaultChannel(id: string, name: string) {
    return {
        id, name,
        steps: Array(16).fill(false),
        mixerInsert: 0,
        oscVoices: [{ type: 'sine', detune: 0, gain: 1 }],
        baseFreq: 261.63,
        volume: 0.8,
        pan: 0,
        muted: false,
    };
}

const initState = {
    transport: { playing: false, bpm: 140, currentStep: 0, swing: 0 },
    channels: [
        defaultChannel('kick', 'Kick'),
        defaultChannel('clap', 'Clap'),
        defaultChannel('hihat', 'Hi-Hat'),
        defaultChannel('snare', 'Snare'),
    ],
    mixerInserts: [
        { id: 0, label: 'Master', volume: 0.8, pan: 0, muted: false, reverbWet: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
        { id: 1, label: 'Insert 1', volume: 0.8, pan: 0, muted: false, reverbWet: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
        { id: 2, label: 'Insert 2', volume: 0.8, pan: 0, muted: false, reverbWet: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
        { id: 3, label: 'Insert 3', volume: 0.8, pan: 0, muted: false, reverbWet: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
    ],
    masterVolume: 0.8,
};

const steps = [
    {
        id: 0,
        instruction: 'Welcome to the Fuji Academy! This is the **Channel Rack** — the heart of FL Studio. Each row is an instrument. Let\'s start by placing a **kick drum** on every beat.',
    },
    {
        id: 1,
        instruction: 'Click steps **1, 5, 9, and 13** on the **Kick** channel to create a four-on-the-floor pattern.',
        hint: 'These are the first step of each beat group — they\'re slightly brighter.',
        target: {
            componentId: 'step-kick-0',
            statePath: 'channels.0.steps',
            channelId: 'kick',
            channelField: 'steps',
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
            channelField: 'steps',
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
            channelField: 'steps',
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
    },
];

async function main() {
    const existing = await db.academyLesson.findUnique({ where: { slug: 'first-beat' } });
    if (!existing) {
        console.log('ℹ️  No "first-beat" row exists yet — nothing to migrate. It will be created with default content the first time an admin opens it, or seed manually if needed.');
        return;
    }
    await db.academyLesson.update({
        where: { slug: 'first-beat' },
        data: { steps: steps as any, initState: initState as any },
    });
    console.log('✅ Seeded "first-beat" lesson with DB-driven channels + steps.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => db.$disconnect());
