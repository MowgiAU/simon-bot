/**
 * DAW-neutral project model used by the project converter.
 * All times are in beats (quarter notes) relative to the arrangement start.
 */

export interface ConvNote {
    time: number;      // beats, relative to the clip start
    duration: number;  // beats
    key: number;       // MIDI note number (60 = middle C)
    velocity: number;  // 0-127
}

export interface ConvMidiClip {
    kind: 'midi';
    name: string;
    start: number;     // beats in the arrangement
    length: number;    // beats
    color: string | null;
    muted: boolean;
    notes: ConvNote[]; // already unrolled — loops expanded, trimmed to the clip
}

export interface ConvAudioClip {
    kind: 'audio';
    name: string;
    start: number;
    length: number;
    color: string | null;
    muted: boolean;
    sample: ConvSampleRef;
    sampleOffset: number;    // beats into the sample where playback starts
    warped: boolean;
}

export type ConvClip = ConvMidiClip | ConvAudioClip;

export interface ConvSampleRef {
    file: string;            // file name only
    path: string;            // absolute path on the source machine
    relPath: string;         // relative to the source project folder (may be '')
}

/** One sample-playing voice: a Simpler, or one Drum Rack pad. */
export interface ConvSamplerZone {
    name: string;
    sample: ConvSampleRef;
    /** Drum pad trigger note; null = plays across the whole keyboard (Simpler). */
    triggerNote: number | null;
    /** Note the pad sends into its sampler (drum pads; Simpler uses the played note). */
    sendingNote: number | null;
    rootKey: number;         // note at which the sample plays at original pitch
    transpose: number;       // semitones
    mode: 'classic' | 'oneShot' | 'slice';
    sampleStart: number;     // frames into the sample
    sampleCount: number;     // >1 = multi-sample instrument collapsed to `sample`
}

/** A third-party plugin with its saved state (the plugin's own bytes, identical in every host). */
interface ConvPluginBase {
    name: string;
    kind: 'instrument' | 'effect';
    enabled: boolean;
}

export interface ConvVst3Plugin extends ConvPluginBase {
    format: 'vst3';
    classId: number[];       // the four 32-bit VST3 class-ID fields
    processorState: Buffer;  // component state — the plugin's settings / preset
    controllerState: Buffer; // editor state (may be empty)
}

export interface ConvVst2Plugin extends ConvPluginBase {
    format: 'vst2';
    uniqueId: number;
    vstVersion: number;
    path: string;            // .dll path on the source machine
    chunk?: Buffer;          // the plugin's own chunk, for plugins that save one…
    params?: number[];       // …otherwise its parameter values (0–1)
}

export type ConvPlugin = ConvVst3Plugin | ConvVst2Plugin;

export type ConvInstrument =
    | { kind: 'simpler'; device: string; zone: ConvSamplerZone }
    | { kind: 'drumRack'; device: string; pads: ConvSamplerZone[] }
    | { kind: 'plugin'; device: string; plugin: ConvPlugin };

export interface ConvTrack {
    name: string;
    kind: 'midi' | 'audio' | 'group' | 'return';
    color: string | null;    // '#RRGGBB'
    muted: boolean;
    volume: number;          // linear gain, 1 = 0 dB
    pan: number;             // -1 .. 1
    devices: string[];       // devices that can't be converted, for the report
    instrument: ConvInstrument | null;
    effects: ConvPlugin[];   // VST3 effects on the track, in chain order
    clips: ConvClip[];
}

export interface ConvLocator {
    time: number;
    name: string;
}

export interface ConvProject {
    name: string;
    source: string;          // e.g. "Ableton Live 12.4"
    bpm: number;
    numerator: number;
    denominator: number;
    tracks: ConvTrack[];
    locators: ConvLocator[];
}

export interface ConversionReport {
    source: string;
    target: string;
    stats: { tracks: number; midiClips: number; audioClips: number; notes: number; samples: number };
    converted: string[];     // instruments that came across, e.g. Drum Rack → Sampler channels
    warnings: string[];
}
