/**
 * State for FL Studio's own (native) plugins that the converter creates.
 *
 * Fruity Slicer — decoded from the Fruity Slicer presets FL ships (FL Mobile/Instruments):
 *   u32 15, f32 loop length in beats, f32 loop tempo, u32 0, u32 0, u32 4, u32 0, u32 4,
 *   (with Auto-fit on — its default — the slices are stretched from the loop tempo to the song's)
 *   u8-length-prefixed sample path, u32 slice count, then per slice:
 *     u8-length-prefixed name (empty), u32 start (sample frames), u32 trigger key, f32 -1, u8 0
 *   then a tail: u8 1, u32 60, u8 0, u32 sample rate, u8 1, 1, 1, u32 0.
 * Slice n plays on key 60 + n (C5 upward), like FL's own slicers.
 */

export const FRUITY_SLICER = 'Fruity Slicer';
export const SLICER_FIRST_KEY = 60;

export interface SlicerSetup {
    samplePath: string;
    sampleRate: number;
    slices: number[];        // start times in seconds
    /** Loop length in beats and seconds: with Auto-fit, slices play at (beats / seconds) → song tempo. */
    beats: number;
    seconds: number;
}

function pstring(s: string): Buffer {
    const body = Buffer.from(s, 'latin1').subarray(0, 255);
    return Buffer.concat([Buffer.from([body.length]), body]);
}

export function fruitySlicerState(s: SlicerSetup): Buffer {
    const beats = s.beats > 0 ? s.beats : 4;
    const bpm = s.seconds > 0 ? (beats / s.seconds) * 60 : 120;

    const head = Buffer.alloc(32);
    head.writeUInt32LE(15, 0);
    head.writeFloatLE(beats, 4);
    head.writeFloatLE(bpm, 8);
    head.writeUInt32LE(4, 20);
    head.writeUInt32LE(4, 28);

    const count = Buffer.alloc(4);
    count.writeUInt32LE(s.slices.length, 0);

    const slices = s.slices.map((sec, i) => {
        const b = Buffer.alloc(14);                  // name length 0, start, key, f32 -1, flag 0
        b.writeUInt32LE(Math.max(0, Math.round(sec * s.sampleRate)), 1);
        b.writeUInt32LE(SLICER_FIRST_KEY + i, 5);
        b.writeFloatLE(-1, 9);
        return b;
    });

    const tail = Buffer.alloc(17);
    tail[0] = 1;
    tail.writeUInt32LE(60, 1);
    tail.writeUInt32LE(s.sampleRate, 6);
    tail[10] = 1; tail[11] = 1; tail[12] = 1;

    return Buffer.concat([head, pstring(s.samplePath.replace(/\//g, '\\')), count, ...slices, tail]);
}
