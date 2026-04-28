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

export interface MixerInsert {
    id: number;
    label: string;
    volume: number;   // 0–1
    pan: number;      // -1 to 1
    muted: boolean;
    reverbWet: number; // 0–1
    eqLow: number;    // dB gain
    eqMid: number;
    eqHigh: number;
}

export interface TransportState {
    playing: boolean;
    bpm: number;
    currentStep: number;
    swing: number; // 0–1
}

export interface DAWState {
    transport: TransportState;
    channels: ChannelConfig[];
    mixerInserts: MixerInsert[];
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

export function createDefaultMixerInsert(id: number, label: string): MixerInsert {
    return { id, label, volume: 0.8, pan: 0, muted: false, reverbWet: 0, eqLow: 0, eqMid: 0, eqHigh: 0 };
}

export function createDefaultDAWState(): DAWState {
    return {
        transport: { playing: false, bpm: 140, currentStep: 0, swing: 0 },
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
        masterVolume: 0.8,
    };
}

// ---------- Audio Engine ----------

type StepCallback = (step: number) => void;

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private insertNodes: Map<number, { gain: GainNode; pan: StereoPannerNode; reverb: ConvolverNode; reverbGain: GainNode; dryGain: GainNode }> = new Map();
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

            // Signal chain: source -> gain -> pan -> dry/wet split -> master
            pan.connect(dryGain);
            pan.connect(reverb);
            reverb.connect(reverbGain);
            dryGain.connect(this.masterGain);
            reverbGain.connect(this.masterGain);
            gain.connect(pan);

            this.insertNodes.set(insert.id, { gain, pan, reverb, reverbGain, dryGain });
        }
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
        this.state.transport.currentStep = (this.state.transport.currentStep + 1) % 16;
        this._onStep?.(this.state.transport.currentStep);
    }

    private scheduleStep(step: number, time: number): void {
        if (!this.ctx) return;
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
