/**
 * Fuji DAW Audio Engine
 *
 * Wraps the Web Audio API to provide a transport, channel step-triggering,
 * mixer gain/pan, and built-in effects (reverb, EQ, compressor).
 * No external dependency (Tone.js) — uses raw Web Audio for bundle size.
 */

export interface OscillatorVoice {
    type: OscillatorType;
    detune: number;
    gain: number;
}

export interface ChannelConfig {
    id: string;
    name: string;
    /** 16 steps of boolean on/off */
    steps: boolean[];
    /** Mixer insert index (0 = Master) */
    mixerInsert: number;
    /** Instrument config */
    oscVoices: OscillatorVoice[];
    /** Base frequency (Hz) — overridden by piano roll notes */
    baseFreq: number;
    volume: number;  // 0–1
    pan: number;     // -1 to 1
    muted: boolean;
}

/** Filter shapes offered by Fruity Parametric EQ 2, mapped 1:1 onto Web Audio's
 *  BiquadFilterNode types so a band can drive a real filter node directly. */
export type EQBandType =
    | 'lowshelf' | 'peaking' | 'highshelf'
    | 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface EQBand {
    freq: number;      // Hz, 20–20000
    gain: number;      // dB, -18..+18 (ignored by lowpass/highpass/bandpass/notch)
    q: number;         // 0.1–18 — FL calls this "width"
    type: EQBandType;
    enabled: boolean;
}

export interface MixerInsert {
    id: number;
    label: string;
    volume: number;   // 0–1
    pan: number;      // -1 to 1
    muted: boolean;
    reverbWet: number; // 0–1
    /** 7 bands, matching Fruity Parametric EQ 2 */
    eqBands: EQBand[];
}

export interface TransportState {
    playing: boolean;
    bpm: number;
    /** Step within the current bar, 0–15 — the Channel Rack's pattern position */
    currentStep: number;
    /** Which bar of the playlist is playing, 0-based. The Channel Rack pattern is one
     *  bar long and repeats; the playlist is what gives the song its length. */
    currentBar: number;
    swing: number; // 0–1
}

export interface PlaylistTrack {
    id: number;
    name: string;
    muted: boolean;
}

export interface PlaylistClip {
    id: string;
    track: number;      // index into playlist.tracks
    startBar: number;   // 0-based
    lengthBars: number;
    /** 'pattern' plays the Channel Rack; 'automation' drives a parameter (stage 3) */
    type: 'pattern' | 'automation';
    label?: string;
    /** Muted clips stay on the grid but don't sound — FL's mute tool */
    muted?: boolean;
}

export interface PlaylistState {
    tracks: PlaylistTrack[];
    clips: PlaylistClip[];
    barCount: number;
}

export interface DAWState {
    transport: TransportState;
    channels: ChannelConfig[];
    mixerInserts: MixerInsert[];
    playlist: PlaylistState;
    masterVolume: number;
}

// ---------- Default factories ----------

export function createDefaultChannel(id: string, name: string): ChannelConfig {
    return {
        id, name,
        steps: Array(16).fill(false),
        mixerInsert: 0,
        oscVoices: [{ type: 'sine', detune: 0, gain: 1 }],
        baseFreq: 261.63, // C4
        volume: 0.8,
        pan: 0,
        muted: false,
    };
}

/** Frequencies for the 7 default bands — a log spread across the audible range,
 *  the way Parametric EQ 2 lays its bands out on first open. */
const EQ_DEFAULT_FREQS = [60, 150, 400, 1000, 2500, 6000, 12000];

export function createDefaultEQBands(): EQBand[] {
    return EQ_DEFAULT_FREQS.map((freq, i) => ({
        freq,
        gain: 0,
        q: 1,
        // Outer bands are shelves and the middle five are bells, as in FL.
        type: i === 0 ? 'lowshelf' : i === 6 ? 'highshelf' : 'peaking',
        enabled: true,
    }));
}

export function createDefaultMixerInsert(id: number, label: string): MixerInsert {
    return {
        id, label, volume: 0.8, pan: 0, muted: false, reverbWet: 0,
        eqBands: createDefaultEQBands(),
    };
}

/**
 * Lesson `initState` rows saved before the EQ existed carry inserts with no
 * `eqBands` (and the old, never-wired eqLow/eqMid/eqHigh fields). Backfill
 * defaults on load so an older lesson doesn't crash the filter chain.
 */
export function normalizeMixerInsert(insert: any, idx: number): MixerInsert {
    return {
        ...insert,
        id: insert?.id ?? idx,
        label: insert?.label ?? `Insert ${idx}`,
        eqBands: Array.isArray(insert?.eqBands) && insert.eqBands.length
            ? insert.eqBands
            : createDefaultEQBands(),
    };
}

export const DEFAULT_BAR_COUNT = 8;

export function createDefaultPlaylist(): PlaylistState {
    return {
        barCount: DEFAULT_BAR_COUNT,
        tracks: Array.from({ length: 5 }, (_, i) => ({
            id: i, name: `Track ${i + 1}`, muted: false,
        })),
        // Track 1 is filled with the pattern across every bar, so playback sounds
        // exactly as it did before the playlist existed — removing a block is now a
        // real edit that silences that bar, rather than the blocks being decorative.
        clips: Array.from({ length: DEFAULT_BAR_COUNT }, (_, bar) => ({
            id: `pat-${bar}`,
            track: 0,
            startBar: bar,
            lengthBars: 1,
            type: 'pattern' as const,
            label: 'Pattern 1',
        })),
    };
}

export function normalizeDAWState(state: DAWState): DAWState {
    return {
        ...state,
        // Spread first, then backfill: older saved transports have no currentBar, and
        // defaulting before the spread would just be overwritten by the undefined.
        transport: { ...state.transport, currentBar: state.transport?.currentBar ?? 0 },
        mixerInserts: (state.mixerInserts ?? []).map(normalizeMixerInsert),
        // Lesson initState saved before the playlist existed has no playlist at all
        playlist: state.playlist ?? createDefaultPlaylist(),
    };
}

export function createDefaultDAWState(): DAWState {
    return {
        transport: { playing: false, bpm: 140, currentStep: 0, currentBar: 0, swing: 0 },
        channels: [
            createDefaultChannel('kick', 'Kick'),
            createDefaultChannel('clap', 'Clap'),
            createDefaultChannel('hihat', 'Hi-Hat'),
            createDefaultChannel('snare', 'Snare'),
        ],
        mixerInserts: [
            createDefaultMixerInsert(0, 'Master'),
            createDefaultMixerInsert(1, 'Insert 1'),
            createDefaultMixerInsert(2, 'Insert 2'),
            createDefaultMixerInsert(3, 'Insert 3'),
        ],
        playlist: createDefaultPlaylist(),
        masterVolume: 0.8,
    };
}

// ---------- Audio Engine ----------

/**
 * Push a band's settings onto a real BiquadFilterNode.
 *
 * A disabled band stays in the chain rather than being disconnected — rebuilding
 * the graph on every toggle would click. It's made transparent instead by running
 * as a 0 dB peaking filter, which passes signal through unchanged.
 */
export function applyBandToFilter(band: EQBand, filter: BiquadFilterNode): void {
    if (!band.enabled) {
        filter.type = 'peaking';
        filter.frequency.value = 1000;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return;
    }
    filter.type = band.type;
    filter.frequency.value = Math.max(20, Math.min(20000, band.freq));
    filter.Q.value = Math.max(0.0001, band.q);
    filter.gain.value = band.gain;
}

type StepCallback = (step: number, bar: number) => void;

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private insertNodes: Map<number, {
        gain: GainNode; pan: StereoPannerNode;
        reverb: ConvolverNode; reverbGain: GainNode; dryGain: GainNode;
        /** One BiquadFilterNode per EQ band, chained in series */
        eq: BiquadFilterNode[];
        /** Tapped post-EQ so the plugin's spectrum shows the EQ's effect */
        analyser: AnalyserNode;
    }> = new Map();
    private timerId: number | null = null;
    private nextStepTime = 0;
    private scheduleAheadTime = 0.1; // seconds
    private lookAhead = 25; // ms
    private _onStep: StepCallback | null = null;

    private state: DAWState;
    private sampleBuffers: Map<string, AudioBuffer> = new Map();

    constructor(initialState?: DAWState) {
        this.state = initialState ?? createDefaultDAWState();
    }

    get audioContext(): AudioContext | null {
        return this.ctx;
    }

    /** Must be called from a user gesture */
    async init(): Promise<void> {
        if (this.ctx) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.state.masterVolume;
        this.masterGain.connect(this.ctx.destination);
        await this.buildInsertChain();
    }

    private async buildInsertChain(): Promise<void> {
        if (!this.ctx || !this.masterGain) return;
        // Create a convolver impulse for reverb (simple noise burst)
        const irLength = this.ctx.sampleRate * 1.5;
        const irBuffer = this.ctx.createBuffer(2, irLength, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = irBuffer.getChannelData(ch);
            for (let i = 0; i < irLength; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 2.5);
            }
        }

        for (const insert of this.state.mixerInserts) {
            const gain = this.ctx.createGain();
            gain.gain.value = insert.muted ? 0 : insert.volume;
            const pan = this.ctx.createStereoPanner();
            pan.pan.value = insert.pan;
            const reverb = this.ctx.createConvolver();
            reverb.buffer = irBuffer;
            const reverbGain = this.ctx.createGain();
            reverbGain.gain.value = insert.reverbWet;
            const dryGain = this.ctx.createGain();
            dryGain.gain.value = 1 - insert.reverbWet;

            // One filter per EQ band, chained in series
            const bands = insert.eqBands ?? createDefaultEQBands();
            const eq = bands.map(band => {
                const f = this.ctx!.createBiquadFilter();
                applyBandToFilter(band, f);
                return f;
            });

            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;

            // Signal chain: source -> gain -> [EQ bands] -> pan -> dry/wet split -> master
            // The analyser hangs off the end of the EQ chain as a passive tap (it has
            // no output connected, so it observes without altering the signal).
            let tail: AudioNode = gain;
            for (const f of eq) { tail.connect(f); tail = f; }
            tail.connect(analyser);
            tail.connect(pan);

            pan.connect(dryGain);
            pan.connect(reverb);
            reverb.connect(reverbGain);
            dryGain.connect(this.masterGain);
            reverbGain.connect(this.masterGain);

            this.insertNodes.set(insert.id, { gain, pan, reverb, reverbGain, dryGain, eq, analyser });
        }
    }

    /** The post-EQ analyser for an insert, for the plugin's spectrum display. */
    getAnalyser(insertId: number): AnalyserNode | null {
        return this.insertNodes.get(insertId)?.analyser ?? null;
    }

    /** Load a sample from URL into a named buffer */
    async loadSample(name: string, url: string): Promise<void> {
        if (!this.ctx) await this.init();
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await this.ctx!.decodeAudioData(arrayBuf);
        this.sampleBuffers.set(name, decoded);
    }

    /** Register a callback fired on each step advance */
    onStep(cb: StepCallback): void {
        this._onStep = cb;
    }

    updateState(newState: DAWState): void {
        this.state = newState;
        // Live-update master volume
        if (this.masterGain) {
            this.masterGain.gain.value = newState.masterVolume;
        }
        // Update mixer nodes
        for (const insert of newState.mixerInserts) {
            const nodes = this.insertNodes.get(insert.id);
            if (nodes) {
                nodes.gain.gain.value = insert.muted ? 0 : insert.volume;
                nodes.pan.pan.value = insert.pan;
                nodes.reverbGain.gain.value = insert.reverbWet;
                nodes.dryGain.gain.value = 1 - insert.reverbWet;
                // Live EQ updates — dragging a band point retunes the running filters
                const bands = insert.eqBands ?? [];
                for (let i = 0; i < nodes.eq.length; i++) {
                    if (bands[i]) applyBandToFilter(bands[i], nodes.eq[i]);
                }
            }
        }
    }

    play(): void {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.nextStepTime = this.ctx.currentTime;
        this.scheduler();
    }

    stop(): void {
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    private scheduler(): void {
        if (!this.ctx) return;
        while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleStep(this.state.transport.currentStep, this.nextStepTime);
            this.advanceStep();
        }
        this.timerId = window.setTimeout(() => this.scheduler(), this.lookAhead);
    }

    private advanceStep(): void {
        const secondsPerBeat = 60.0 / this.state.transport.bpm;
        const secondsPer16th = secondsPerBeat / 4;

        // Swing: delay even-numbered 16ths
        let swing = 0;
        if (this.state.transport.currentStep % 2 !== 0) {
            swing = secondsPer16th * this.state.transport.swing * 0.5;
        }

        this.nextStepTime += secondsPer16th + swing;
        const nextStep = (this.state.transport.currentStep + 1) % 16;
        this.state.transport.currentStep = nextStep;
        // A wrap back to step 0 means we've crossed into the next bar; the song loops
        // at the end of the playlist.
        if (nextStep === 0) {
            const bars = this.state.playlist?.barCount ?? DEFAULT_BAR_COUNT;
            this.state.transport.currentBar = (this.state.transport.currentBar + 1) % Math.max(1, bars);
        }
        this._onStep?.(this.state.transport.currentStep, this.state.transport.currentBar);
    }

    /** Is a pattern block placed over this bar on any unmuted track? */
    private patternPlaysAt(bar: number): boolean {
        const pl = this.state.playlist;
        if (!pl) return true;   // no playlist (legacy state) — behave as before
        return pl.clips.some(c =>
            c.type === 'pattern'
            && !c.muted
            && bar >= c.startBar
            && bar < c.startBar + c.lengthBars
            && !(pl.tracks.find(t => t.id === c.track)?.muted),
        );
    }

    private scheduleStep(step: number, time: number): void {
        if (!this.ctx) return;
        // The Channel Rack only sounds on bars the playlist actually has a pattern
        // block over — that's what makes the blocks real rather than decorative.
        if (!this.patternPlaysAt(this.state.transport.currentBar)) return;
        for (const channel of this.state.channels) {
            if (channel.muted || !channel.steps[step]) continue;
            const insertId = channel.mixerInsert;
            const insertNode = this.insertNodes.get(insertId) ?? this.insertNodes.get(0);
            if (!insertNode) continue;

            // Check if we have a sample buffer for this channel
            const sample = this.sampleBuffers.get(channel.id);
            if (sample) {
                const source = this.ctx.createBufferSource();
                source.buffer = sample;
                const chGain = this.ctx.createGain();
                chGain.gain.value = channel.volume;
                source.connect(chGain);
                chGain.connect(insertNode.gain);
                source.start(time);
            } else {
                // Synthesize using oscillators
                for (const voice of channel.oscVoices) {
                    const osc = this.ctx.createOscillator();
                    osc.type = voice.type;
                    osc.frequency.value = channel.baseFreq;
                    osc.detune.value = voice.detune;

                    const envGain = this.ctx.createGain();
                    envGain.gain.setValueAtTime(channel.volume * voice.gain, time);
                    envGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

                    osc.connect(envGain);
                    envGain.connect(insertNode.gain);
                    osc.start(time);
                    osc.stop(time + 0.2);
                }
            }
        }
    }

    dispose(): void {
        this.stop();
        this.ctx?.close();
        this.ctx = null;
        this.insertNodes.clear();
        this.sampleBuffers.clear();
    }
}
