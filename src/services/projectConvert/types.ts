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
    /** Where playback starts in the sample: beats if warped, seconds if not (as Live stores it). */
    sampleOffset: number;
    warped: boolean;
    /** Warped clips: the whole sample's length in beats per its warp markers. */
    sampleBeats?: number;
    /** Warped clips with more than one tempo segment (FL can only stretch evenly). */
    complexWarp?: boolean;
    /** Fade lengths, in the clip's own units (beats if warped, seconds if not), and clip gain (linear). */
    fadeIn: number;
    fadeOut: number;
    gain: number;
    /** Warped clips with Loop on: each pass as { at: beats into the clip, from: sample beat, length }. */
    loopPasses?: { at: number; from: number; length: number }[];
}

export type ConvClip = ConvMidiClip | ConvAudioClip;

export interface ConvSampleRef {
    file: string;            // file name only
    path: string;            // absolute path on the source machine
    relPath: string;         // relative to the source project folder (may be '')
}

/** One sample-playing voice: a Simpler, or one Drum Rack pad. */
/** One sample zone of a multi-sample instrument: which notes and velocities play it. */
export interface ConvZonePart {
    sample: ConvSampleRef;
    name: string;
    keyMin: number; keyMax: number;
    velMin: number; velMax: number;
    rootKey: number;
    sampleStart: number;
    /** Set when Live plays only part of the file (start/end markers moved): frames [start, end). */
    trim?: SampleTrimRange;
}

export interface SampleTrimRange { start: number; end: number }

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
    /** Set when Live plays only part of the file (start/end markers moved): frames [start, end). */
    trim?: SampleTrimRange;
    sampleCount: number;     // >1 = multi-sample instrument collapsed to `sample`
    sampleRate: number;
    /** Slice mode: slice start times in seconds from the start of the file, in order. */
    slices?: number[];
    /** How the slices were derived ('beat' is approximate — see readSlices). */
    sliceStyle?: 'transient' | 'beat' | 'region' | 'manual';
    /** The loop's length in beats per its warp markers (Fruity Slicer's header wants it). */
    sampleBeats?: number;
    /** Slice mode: whether Simpler's Warp was on (slices follow the song tempo) or off (original speed). */
    sliceWarped?: boolean;
    /** The sample's length in seconds. */
    sampleSeconds?: number;
    /** Multi-sample instruments: every active zone (absent when there's only one sample). */
    parts?: ConvZonePart[];
    /** Round-robin across zones that cover the same note (absent = overlapping zones layer). */
    roundRobin?: 'sequential' | 'random';
    /** Drum pads: the effects after the pad's sampler, devices that can't convert, and the chain's level. */
    chain?: ConvChain & { sends: number[] };
}

/** A third-party plugin with its saved state (the plugin's own bytes, identical in every host). */
interface ConvPluginBase {
    name: string;
    kind: 'instrument' | 'effect';
    enabled: boolean;
    /** Live automation-target id → the plugin parameter it drives (VST2: id = index). */
    paramTargets: Record<string, { id: number; name: string }>;
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

/** One of Live's own audio effects (EQ Eight, Compressor…): its device XML, mapped to FL's own effects later. */
export interface ConvLiveEffect {
    format: 'live';
    device: string;          // Live's device tag, e.g. "Eq8"
    name: string;            // what the user sees (their rename, or the device name)
    enabled: boolean;
    xml: any;
}

export type ConvEffect = ConvPlugin | ConvLiveEffect;

/** A chain inside a rack — a drum pad's effects or a Drum Rack return — with its mixer level. */
export interface ConvChain {
    name: string;
    effects: ConvEffect[];
    devices: string[];       // devices that can't convert
    volume: number;          // linear gain
    pan: number;             // -1 … 1
}

export type ConvInstrument =
    | { kind: 'simpler'; device: string; zone: ConvSamplerZone }
    | { kind: 'drumRack'; device: string; pads: ConvSamplerZone[]; otherPads: ConvOtherPad[]; returns: ConvChain[] }
    | { kind: 'plugin'; device: string; plugin: ConvPlugin }
    | { kind: 'layers'; device: string; layers: ConvLayer[] };

/** A Drum Rack pad without a sample (a synth like DS Kick, a Max device…): kept as an empty channel. */
export interface ConvOtherPad { triggerNote: number; name: string; device: string }

/** One chain of a multi-chain Instrument Rack: plays the notes inside its key zone. */
export interface ConvLayer {
    name: string;
    keyMin: number;
    keyMax: number;
    velMin: number;          // the chain's velocity zone
    velMax: number;
    volume: number;          // linear gain of the chain, 1 = 0 dB
    pan: number;             // the chain's pan, -1 … 1
    instrument: Exclude<ConvInstrument, { kind: 'layers' }>;
}

export type ConvAutomationTarget =
    | { kind: 'volume' }                                   // linear gain, 1 = 0 dB
    | { kind: 'pan' }                                      // -1 .. 1
    | { kind: 'send'; index: number }                      // linear gain to return `index`
    | { kind: 'plugin'; plugin: ConvPlugin; param: number; paramName: string }  // 0 .. 1
    | { kind: 'tempo' };                                   // BPM

/** An arrangement automation lane: points in beats (time 0 holds the value from the start). */
export interface ConvAutomation {
    target: ConvAutomationTarget;
    points: { time: number; value: number }[];
}

export interface ConvTrack {
    id: string;              // Live's track Id (group tracks are referenced by it)
    groupId: string | null;  // Id of the group track this track sits in
    sends: number[];         // send level to each return track, linear gain (≈0.0003 = off)
    name: string;
    kind: 'midi' | 'audio' | 'group' | 'return';
    color: string | null;    // '#RRGGBB'
    muted: boolean;
    volume: number;          // linear gain, 1 = 0 dB
    pan: number;             // -1 .. 1
    devices: string[];       // devices that can't be converted, for the report
    instrument: ConvInstrument | null;
    effects: ConvEffect[];   // audio effects on the track (VSTs and Live's own), in chain order
    automation: ConvAutomation[];
    /** Automated parameters that can't be carried over (Ableton devices etc.). */
    otherAutomation: number;
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
    /** The Main (master) track's plugins and other devices. */
    main: { effects: ConvEffect[]; devices: string[] };
    /** Per return track: true if its sends are pre-fader. */
    returnsPre: boolean[];
    tempoAutomation: ConvAutomation | null;
    /** Time-signature changes after the start (the first signature is numerator/denominator). */
    timeSignatures: { time: number; numerator: number; denominator: number }[];
}

export interface ConversionReport {
    source: string;
    target: string;
    stats: { tracks: number; midiClips: number; audioClips: number; notes: number; samples: number };
    converted: string[];     // instruments that came across, e.g. Drum Rack → Sampler channels
    warnings: string[];
}
