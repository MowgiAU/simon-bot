/**
 * Live's own audio effects → FL Studio's own effects, with matching settings.
 *
 * FL's native effects save a small binary state (event 213). Each layout below was decoded from
 * the presets FL ships and then calibrated by rendering white noise through FL 21 itself
 * (FL64.exe /R) with known settings and measuring the result, so a setting in Live lands on the
 * FL value that sounds the same — not just the same knob position.
 */
import type { ConvLiveEffect } from './types.js';
import type { FlNativeEffect } from './FlVst.js';

/** Live device tags we can convert (the reader keeps these; everything else is reported). */
export const LIVE_EFFECTS = new Set(['Eq8', 'Compressor2', 'GlueCompressor', 'Delay', 'Reverb', 'StereoGain']);

export interface LiveEffectResult {
    /** Empty when the effect does nothing at its settings (a flat EQ, a unity Utility): it's left out. */
    effects: FlNativeEffect[];
    /** Anything about the conversion the user should know (settings FL can't match). */
    notes: string[];
}

// ── Live XML helpers ──────────────────────────────────────────────────────────

function manual(node: any, fallback = 0): number {
    const n = parseFloat(String(node?.Manual?.['@_Value'] ?? ''));
    return Number.isFinite(n) ? n : fallback;
}
function manualBool(node: any, fallback = false): boolean {
    const v = node?.Manual?.['@_Value'];
    return v == null ? fallback : String(v) === 'true';
}

/** Linear interpolation through [x, y] points (x ascending), clamped at the ends. */
function interp(points: [number, number][], x: number): number {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1], [x1, y1] = points[i];
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return points[points.length - 1][1];
}
const flip = (points: [number, number][]): [number, number][] => points.map(([a, b]) => [b, a] as [number, number]).sort((p, q) => p[0] - q[0]);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * FL's volume law — mixer faders, send levels and its plugins' volume knobs, measured by rendering:
 * a control at r (1 = 0 dB) gives gain = (11^r − 1) / 10, so r = 0.5 is −12.7 dB and 1.25 is +5.6 dB.
 * Returns the r for a linear gain.
 */
export const flLevel = (gain: number) => Math.log(10 * Math.max(0, gain) + 1) / Math.log(11);

// ── EQ Eight → Fruity Parametric EQ 2 ─────────────────────────────────────────
//
// State: u32 6, then five arrays of 7 × i32 (one per band): gain (1/100 dB, ±1800), frequency
// (0–65536), bandwidth (0–65536), type, slope; then a second copy of the arrays (FL's compare
// slot) and a fixed tail. Measured in FL 21:
//   frequency   20 Hz × 1000^(x / 65536)  (20 Hz – 20 kHz)
//   type        0 off, 1 low-pass, 2 band-pass, 3 high-pass, 4 notch, 5 low shelf, 6 peak, 7 high shelf
//   slope       cut filters: 0 = 12 dB/oct, -1 = 24, -2 = 36, -3 = 48 (other values crash FL)
//   bandwidth   peaks: the bell's width (below); cuts and shelves: resonance (below)

const PEQ2 = 'Fruity Parametric EQ 2';
const PEQ2_BANDS = 7;
const PEQ2_DEFAULT = Buffer.from(
    '0600000000000000000000000000000000000000000000000000000000000000ab2a00001c4700008e63000000800000' +
    '729c0000e4b8000055d50000bc9c00004463000044630000446300004463000044630000bc9c00000500000006000000' +
    '060000000600000006000000060000000700000000000000000000000000000000000000000000000000000000000000' +
    '0000000000000000000000000000000000000000000000000000000000000000ab2a00001c4700008e63000000800000' +
    '729c0000e4b8000055d50000bc9c00004463000044630000446300004463000044630000bc9c00000500000006000000' +
    '060000000600000006000000060000000700000000000000000000000000000000000000000000000000000000000000' +
    '0000000001000000000000000102000000010000000200000000000000427f0000000100000000000000030000000100' +
    '0000020000000200000002000000',
    'hex',
);
const PEQ2_GAIN = 0, PEQ2_FREQ = 1, PEQ2_BW = 2, PEQ2_TYPE = 3, PEQ2_SLOPE = 4;
const PEQ2_OFF = 0, PEQ2_LOWPASS = 1, PEQ2_HIGHPASS = 3, PEQ2_NOTCH = 4, PEQ2_LOWSHELF = 5, PEQ2_PEAK = 6, PEQ2_HIGHSHELF = 7;

// Bell width: bandwidth value → width in octaves at half the gain (in dB), measured with +12 dB
const PEQ2_PEAK_OCTAVES: [number, number][] = [
    [0, 0.17], [8192, 0.71], [16384, 1.29], [25412, 1.96], [32768, 2.5], [40124, 3.04], [49152, 3.71], [57344, 4.42], [65536, 4.92],
];
// Cut-filter resonance: bandwidth value → level at the cutoff (dB), measured on a 12 dB/oct high-pass.
// A 2-pole filter peaks at 20·log10(Q) there, so Live's Q 0.71 (flat) is -3 dB.
const PEQ2_CUT_RESONANCE: [number, number][] = [
    [0, 15.8], [4096, 14.4], [8192, 12.8], [12288, 11.1], [16384, 9.2], [25412, 4.2], [40124, -6.6], [65536, -23.2],
];

/** EQ Eight band modes → [FL type, FL slope]. */
const EQ8_MODES: Record<number, [number, number]> = {
    0: [PEQ2_HIGHPASS, -3],  // Low Cut 48 dB
    1: [PEQ2_HIGHPASS, 0],   // Low Cut 12 dB
    2: [PEQ2_LOWSHELF, 0],
    3: [PEQ2_PEAK, 0],       // Bell
    4: [PEQ2_NOTCH, 0],
    5: [PEQ2_HIGHSHELF, 0],
    6: [PEQ2_LOWPASS, 0],    // High Cut 12 dB
    7: [PEQ2_LOWPASS, -3],   // High Cut 48 dB
};

interface EqBand { type: number; slope: number; freq: number; gainDb: number; q: number }

/** Bell/notch width for a Q, via the standard (RBJ) relation between Q and bandwidth in octaves. */
function peakBandwidth(q: number): number {
    const octaves = (2 / Math.LN2) * Math.asinh(1 / (2 * Math.max(0.05, q)));
    return interp(flip(PEQ2_PEAK_OCTAVES), octaves);
}
function cutBandwidth(q: number): number {
    return interp(flip(PEQ2_CUT_RESONANCE), 20 * Math.log10(Math.max(0.05, q)));
}

function peq2State(bands: EqBand[]): Buffer {
    const st = Buffer.from(PEQ2_DEFAULT);
    const set = (field: number, band: number, v: number) => st.writeInt32LE(Math.round(v), 4 + (field * PEQ2_BANDS + band) * 4);
    for (let b = 0; b < PEQ2_BANDS; b++) {
        const band = bands[b];
        if (!band) { set(PEQ2_TYPE, b, PEQ2_OFF); continue; }
        const isBell = band.type === PEQ2_PEAK || band.type === PEQ2_NOTCH;
        set(PEQ2_TYPE, b, band.type);
        set(PEQ2_SLOPE, b, band.slope);
        set(PEQ2_FREQ, b, clamp((65536 * Math.log(band.freq / 20)) / Math.log(1000), 0, 65536));
        set(PEQ2_GAIN, b, clamp(band.gainDb * 100, -1800, 1800));
        set(PEQ2_BW, b, clamp(isBell ? peakBandwidth(band.q) : cutBandwidth(band.q), 0, 65536));
    }
    return st;
}

function eq8(d: ConvLiveEffect): LiveEffectResult {
    const notes: string[] = [];
    const scale = manual(d.xml?.Scale, 1);          // Live's gain "Scale" multiplies every band's gain
    const bands: EqBand[] = [];
    for (let i = 0; i < 8; i++) {
        const p = d.xml?.[`Bands.${i}`]?.ParameterA;  // A = stereo mode (B is the other side in L/R, M/S)
        if (!p || !manualBool(p.IsOn)) continue;
        const [type, slope] = EQ8_MODES[Math.round(manual(p.Mode, 3))] ?? EQ8_MODES[3];
        const gainDb = manual(p.Gain) * scale;
        const hasGain = type === PEQ2_PEAK || type === PEQ2_LOWSHELF || type === PEQ2_HIGHSHELF;
        if (hasGain && Math.abs(gainDb) < 0.05) continue;   // a flat bell or shelf does nothing
        bands.push({ type, slope, freq: manual(p.Freq, 1000), gainDb, q: manual(p.Q, 0.7071) });
    }
    if (Math.round(manual(d.xml?.Mode)) !== 0) notes.push('it was in L/R or M/S mode — FL uses its left/mid settings for both sides');
    if (Math.abs(manual(d.xml?.GlobalGain)) >= 0.05) notes.push(`its output gain (${manual(d.xml?.GlobalGain).toFixed(1)} dB) isn't included`);

    // Parametric EQ 2 has 7 bands; an EQ Eight using all 8 becomes two (and one with none, nothing)
    const effects: FlNativeEffect[] = [];
    for (let i = 0; i < bands.length; i += PEQ2_BANDS) {
        effects.push({ format: 'native', name: PEQ2, state: peq2State(bands.slice(i, i + PEQ2_BANDS)) });
    }
    return { effects, notes };
}

// ── Compressor / Glue Compressor → Fruity Compressor ──────────────────────────
//
// State (8 × i32): 2, threshold (dB × 10), ratio (× 10: 10 = 1:1), gain (dB × 10), attack, release,
// type, 1. Measured in FL 21: level detection is peak-based; a 1-pole attack reaches 63% of its
// gain reduction in 0.075 ms per unit and release recovers 63% in 0.254 ms per unit (both linear up
// to 5000); types 0–3 are hard, medium (~6 dB), soft (~12 dB) and vintage knees.

const FRUITY_COMPRESSOR = 'Fruity Compressor';
const COMP_ATTACK_MS_PER_UNIT = 0.075;
const COMP_RELEASE_MS_PER_UNIT = 0.254;
const COMP_TIME_MAX = 5000;
const COMP_KNEE_HARD = 0, COMP_KNEE_MEDIUM = 1, COMP_KNEE_SOFT = 2;

function fruityCompressor(o: { thresholdDb: number; ratio: number; gainDb: number; attackMs: number; releaseMs: number; knee: number }): FlNativeEffect {
    const st = Buffer.alloc(32);
    [
        2,
        clamp(o.thresholdDb * 10, -600, 0),
        clamp(o.ratio * 10, 10, 1000),
        clamp(o.gainDb * 10, -300, 300),
        clamp(o.attackMs / COMP_ATTACK_MS_PER_UNIT, 0, COMP_TIME_MAX),
        clamp(o.releaseMs / COMP_RELEASE_MS_PER_UNIT, 1, COMP_TIME_MAX),
        o.knee,
        1,
    ].forEach((v, i) => st.writeInt32LE(Math.round(v), i * 4));
    return { format: 'native', name: FRUITY_COMPRESSOR, state: st };
}

/** Notes shared by Live's compressors: things Fruity Compressor has no control for. */
function compressorNotes(xml: any, notes: string[]) {
    if (manualBool(xml?.SideChain?.OnOff)) notes.push('it was keyed from another track (sidechain), which Fruity Compressor can\'t do — set that up in FL (e.g. Fruity Limiter\'s sidechain)');
    if (manual(xml?.DryWet, 1) < 0.99) notes.push(`its dry/wet (${Math.round(manual(xml?.DryWet, 1) * 100)}%) isn't included — FL's compressor is fully wet`);
}

// Live's Compressor models: 0 Peak, 1 RMS, 2 Expand. FL detects peaks; an RMS detector reads a steady
// tone 3 dB lower than its peak, so an RMS threshold moves up 3 dB to act at the same point.
const RMS_TO_PEAK_DB = 3;

function compressor2(d: ConvLiveEffect): LiveEffectResult | null {
    const x = d.xml;
    const model = Math.round(manual(x?.Model));
    if (model === 2) return null;                                  // expander: FL's compressor can't expand
    const notes: string[] = [];
    compressorNotes(x, notes);
    if (manualBool(x?.GainCompensation)) notes.push('its automatic makeup gain was on — raise Fruity Compressor\'s Gain to match');
    const knee = manual(x?.Knee, 6);
    return {
        effects: [fruityCompressor({
            thresholdDb: 20 * Math.log10(Math.max(1e-4, manual(x?.Threshold, 1))) + (model === 1 ? RMS_TO_PEAK_DB : 0),
            ratio: manual(x?.Ratio, 4),
            gainDb: manual(x?.Gain),
            attackMs: manual(x?.Attack, 1),
            releaseMs: manual(x?.Release, 30),
            knee: knee < 3 ? COMP_KNEE_HARD : knee < 9 ? COMP_KNEE_MEDIUM : COMP_KNEE_SOFT,
        })],
        notes,
    };
}

// Glue Compressor's stepped controls (index → value)
const GLUE_ATTACK_MS = [0.01, 0.1, 0.3, 1, 3, 10, 30];
const GLUE_RATIO = [2, 4, 10];
const GLUE_RELEASE_MS = [100, 200, 400, 600, 800, 1200, 400];   // the last is Auto (program-dependent)

function glueCompressor(d: ConvLiveEffect): LiveEffectResult {
    const x = d.xml;
    const notes: string[] = [];
    compressorNotes(x, notes);
    const release = Math.round(manual(x?.Release, 1));
    if (release === 6) notes.push('its release was on Auto — FL uses a fixed 400 ms');
    return {
        effects: [fruityCompressor({
            thresholdDb: manual(x?.Threshold),
            ratio: GLUE_RATIO[Math.round(manual(x?.Ratio, 1))] ?? 4,
            gainDb: manual(x?.Makeup),
            attackMs: GLUE_ATTACK_MS[Math.round(manual(x?.Attack, 3))] ?? 1,
            releaseMs: GLUE_RELEASE_MS[release] ?? 200,
            knee: COMP_KNEE_MEDIUM,                                 // the Glue's bus-compressor curve is gently rounded
        })],
        notes,
    };
}

// ── Delay → Fruity Delay 3 ────────────────────────────────────────────────────
//
// State: 27 × i32 (FL's default preset below). Measured in FL 21 with a click and with noise:
//   [2]  stereo mode: 0 mono, 1 stereo, 2 ping-pong      [3]  tempo sync on/off
//   [5]  time — synced: 192 per beat; free: (0.01222 · v + 0.63)³ ms, reaching its 1 s maximum at ~800
//   [14] feedback filter on/off   [16] its type: 0 low-pass, 1 high-pass, 2 band-pass
//   [17] cutoff (table below)     [18] band-pass width (table below)
//   [15] feedback: each repeat is v / 5000 of the one before
//   [24] wet level, [26] dry level: v / 6000 (6000 = 0 dB)

const FRUITY_DELAY_3 = 'Fruity Delay 3';
const DELAY3_DEFAULT = [1, 6000, 1, 1, 0, 192, 3000, 500, 6000, 3000, 0, 0, 0, 0, 1, 3000, 0, 6000, 0, 0, 0, 0, 60000, 6000, 6000, 0, 6000];
const D3_MODE = 2, D3_SYNC = 3, D3_TIME = 5, D3_FILTER_ON = 14, D3_FEEDBACK = 15, D3_FILTER_TYPE = 16, D3_CUTOFF = 17, D3_WIDTH = 18, D3_WET = 24, D3_DRY = 26;
const D3_PING_PONG = 2, D3_BANDPASS = 2;
const D3_TICKS_PER_BEAT = 192;
const D3_LEVEL_FULL = 6000;
const D3_FEEDBACK_UNITY = 5000;
const D3_FREE_MAX_MS = 1000;
// Cutoff value → frequency (Hz), from the low-pass's -3 dB point
const D3_CUTOFF_HZ: [number, number][] = [[1000, 403], [2000, 761], [3000, 1280], [4000, 4974], [5000, 11831], [6000, 20000]];
// Band-pass width value → -3 dB width in octaves
const D3_WIDTH_OCTAVES: [number, number][] = [[0, 6.25], [1000, 5.54], [2000, 4.25], [3000, 3.0], [4000, 2.17], [5000, 1.54], [6000, 1.0]];

// Live's synced delay times, in 16th notes, by index
const DELAY_SIXTEENTHS = [1, 2, 3, 4, 5, 6, 8, 16];

function delay(d: ConvLiveEffect, ctx: LiveEffectContext): LiveEffectResult {
    const x = d.xml;
    const notes: string[] = [];
    const st = [...DELAY3_DEFAULT];

    if (manualBool(x?.DelayLine_SyncL, true)) {
        const sixteenths = DELAY_SIXTEENTHS[Math.round(manual(x?.DelayLine_SyncedSixteenthL, 2))] ?? 3;
        st[D3_SYNC] = 1;
        st[D3_TIME] = (sixteenths * D3_TICKS_PER_BEAT) / 4;
    } else {
        const ms = manual(x?.DelayLine_TimeL, 0.25) * 1000;
        if (ms <= D3_FREE_MAX_MS) {
            st[D3_SYNC] = 0;
            st[D3_TIME] = (Math.cbrt(ms) - 0.63) / 0.01222;
        } else {
            // Beyond the free-running range: the same time as a synced value at the song's tempo
            st[D3_SYNC] = 1;
            st[D3_TIME] = (ms / (60000 / ctx.bpm)) * D3_TICKS_PER_BEAT;
        }
    }
    if (!manualBool(x?.DelayLine_Link, true)) {
        const same = manualBool(x?.DelayLine_SyncL) === manualBool(x?.DelayLine_SyncR)
            && manual(x?.DelayLine_SyncedSixteenthL) === manual(x?.DelayLine_SyncedSixteenthR)
            && Math.abs(manual(x?.DelayLine_TimeL) - manual(x?.DelayLine_TimeR)) < 0.001;
        if (!same) notes.push('its left and right times differed — FL uses the left time for both');
    }
    if (manualBool(x?.DelayLine_PingPong)) st[D3_MODE] = D3_PING_PONG;

    st[D3_FEEDBACK] = clamp(manual(x?.Feedback, 0.5) * D3_FEEDBACK_UNITY, 0, D3_FEEDBACK_UNITY);
    if (manualBool(x?.Freeze)) notes.push('Freeze was on — FL repeats at its full feedback instead');

    if (manualBool(x?.Filter_On)) {
        st[D3_FILTER_ON] = 1;
        st[D3_FILTER_TYPE] = D3_BANDPASS;
        st[D3_CUTOFF] = clamp(interp(flip(D3_CUTOFF_HZ.map(([v, hz]) => [v, Math.log(hz)] as [number, number])), Math.log(manual(x?.Filter_Frequency, 1000))), 1000, 6000);
        st[D3_WIDTH] = clamp(interp(flip(D3_WIDTH_OCTAVES), manual(x?.Filter_Bandwidth, 8)), 0, 6000);
    } else {
        st[D3_FILTER_ON] = 0;
    }
    if (manual(x?.Modulation_AmountTime) > 0 || manual(x?.Modulation_AmountFilter) > 0) notes.push('its modulation isn\'t included');

    // Live's Dry/Wet crossfades the two; on a return track it's usually fully wet
    const mix = clamp(manual(x?.DryWet, 0.5), 0, 1);
    st[D3_WET] = mix * D3_LEVEL_FULL;
    st[D3_DRY] = (1 - mix) * D3_LEVEL_FULL;

    const b = Buffer.alloc(st.length * 4);
    st.forEach((v, i) => b.writeInt32LE(Math.round(v), i * 4));
    return { effects: [{ format: 'native', name: FRUITY_DELAY_3, state: b }], notes };
}

// ── Reverb → Fruity Reeverb 2 ─────────────────────────────────────────────────
//
// State: 13 × i32 + 1 byte. Measured in FL 21 with a click (decay by backward integration) and noise:
//   [0] low cut (Hz)     [1] high cut (× 100 Hz, 0 = off)
//   [2] pre-delay of the tail, tempo-synced: 192 per beat (early reflections aren't delayed)
//   [3] room size 0–100  [5] decay (RT60 table below)
//   [10] dry (curve below), [11] early reflections, [12] wet: v / 128 (128 = 0 dB; FL's default wet is 87)

const FRUITY_REEVERB_2 = 'Fruity Reeverb 2';
const REEVERB2_DEFAULT = Buffer.from('4b000000280000000000000032000000640000000f0000002800000064000000f4010000000000008000000080000000' + '5700000000', 'hex');
const RV_LOW_CUT = 0, RV_HIGH_CUT = 1, RV_PREDELAY = 2, RV_SIZE = 3, RV_DECAY = 5, RV_DRY = 10, RV_EARLY = 11, RV_WET = 12;
const RV_LEVEL_FULL = 128;
const RV_WET_FULL = 87;             // FL's own default wet level — its balanced 100%-wet level
const RV_TICKS_PER_BEAT = 192;
// Decay value → measured RT60 (s)
const RV_DECAY_RT60: [number, number][] = [[1, 0.35], [3, 0.52], [5, 0.74], [8, 1.04], [15, 1.98], [30, 3.83], [60, 7.57], [100, 12.2]];
// The dry level isn't linear: value → dB (the wet and early levels are linear)
const RV_DRY_DB: [number, number][] = [[1, -60], [32, -21.7], [64, -12.7], [96, -6], [128, 0]];

function reverb(d: ConvLiveEffect, ctx: LiveEffectContext): LiveEffectResult {
    const x = d.xml;
    const notes: string[] = [];
    const st = Buffer.from(REEVERB2_DEFAULT);
    const set = (i: number, v: number) => st.writeInt32LE(Math.round(v), i * 4);

    set(RV_DECAY, clamp(interp(flip(RV_DECAY_RT60), manual(x?.DecayTime, 1200) / 1000), 1, 100));
    set(RV_PREDELAY, clamp((manual(x?.PreDelay, 2.5) / (60000 / ctx.bpm)) * RV_TICKS_PER_BEAT, 0, 4 * RV_TICKS_PER_BEAT));
    // Live's room size runs 0.22–500 (100 by default), FL's 0–100 (50): matched on a log scale
    set(RV_SIZE, clamp(50 + (50 / Math.log2(5)) * Math.log2(Math.max(0.22, manual(x?.RoomSize, 100)) / 100), 0, 100));

    // Live filters the reverb's input with a band (centre ± half its width in octaves)
    const centre = manual(x?.BandFreq, 830), halfWidth = manual(x?.BandWidth, 5.85) / 2;
    set(RV_LOW_CUT, manualBool(x?.BandLowOn, true) ? clamp(centre / 2 ** halfWidth, 20, 1000) : 20);
    set(RV_HIGH_CUT, manualBool(x?.BandHighOn, true) ? clamp((centre * 2 ** halfWidth) / 100, 10, 200) : 0);

    const mix = clamp(manual(x?.DryWet, 0.5), 0, 1);
    set(RV_DRY, mix >= 0.999 ? 0 : interp(flip(RV_DRY_DB), 20 * Math.log10(1 - mix)));
    set(RV_WET, mix * RV_WET_FULL * clamp(manual(x?.MixDiffuse, 1), 0, 2));
    set(RV_EARLY, clamp(manual(x?.MixReflect, 1), 0, 2) * RV_LEVEL_FULL);
    if (manualBool(x?.FreezeOn)) notes.push('Freeze was on, which FL\'s reverb can\'t do');
    return { effects: [{ format: 'native', name: FRUITY_REEVERB_2, state: st }], notes };
}

// ── Utility → Fruity Balance ──────────────────────────────────────────────────
//
// State: i32 pan (-128 … 127), i32 volume (256 = 0 dB, up to 320 = +5.6 dB, on FL's volume law).

const FRUITY_BALANCE = 'Fruity Balance';
const BALANCE_UNITY = 256, BALANCE_MAX = 320;

function utility(d: ConvLiveEffect): LiveEffectResult {
    const x = d.xml;
    const notes: string[] = [];
    const gain = manualBool(x?.Mute) ? 0 : manual(x?.Gain, 1);
    const balance = manual(x?.Balance);
    const st = Buffer.alloc(8);
    st.writeInt32LE(Math.round(clamp(balance * 128, -128, 127)), 0);
    st.writeInt32LE(Math.round(clamp(BALANCE_UNITY * flLevel(gain), 0, BALANCE_MAX)), 4);
    if (Math.abs(manual(x?.StereoWidth, 1) - 1) > 0.01 || manualBool(x?.Mono)) {
        notes.push(manualBool(x?.Mono)
            ? 'it made the track mono — set that in FL (e.g. Fruity Stereo Shaper)'
            : `its stereo width (${Math.round(manual(x?.StereoWidth, 1) * 100)}%) isn't included — set it in FL (e.g. Fruity Stereo Shaper)`);
    }
    if (manualBool(x?.BassMono)) notes.push('Bass Mono was on, which isn\'t included');
    if (manualBool(x?.PhaseInvertL) || manualBool(x?.PhaseInvertR)) notes.push('its phase invert isn\'t included');
    if (gain > 1.9) notes.push('its gain was above +5.6 dB — Fruity Balance tops out there');
    // At unity gain and centred, Fruity Balance would do nothing — leave it out (and free the slot)
    const neutral = Math.abs(20 * Math.log10(Math.max(gain, 1e-6))) < 0.05 && Math.abs(balance) < 0.005;
    return { effects: neutral ? [] : [{ format: 'native', name: FRUITY_BALANCE, state: st }], notes };
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/** What a mapping may need to know about the song. */
export interface LiveEffectContext { bpm: number }

const CONVERTERS: Record<string, (d: ConvLiveEffect, ctx: LiveEffectContext) => LiveEffectResult | null> = {
    Eq8: eq8,
    Compressor2: compressor2,
    GlueCompressor: glueCompressor,
    Delay: delay,
    Reverb: reverb,
    StereoGain: utility,
};

/** FL's own effects for one Live effect, or null if there's no equivalent. */
export function liveEffectToFl(d: ConvLiveEffect, ctx: LiveEffectContext): LiveEffectResult | null {
    return CONVERTERS[d.device]?.(d, ctx) ?? null;
}

/** The FL plugin a Live effect becomes, for the report. */
export const LIVE_EFFECT_TARGETS: Record<string, string> = {
    Eq8: PEQ2,
    Compressor2: FRUITY_COMPRESSOR,
    GlueCompressor: FRUITY_COMPRESSOR,
    Delay: FRUITY_DELAY_3,
    Reverb: FRUITY_REEVERB_2,
    StereoGain: FRUITY_BALANCE,
};
