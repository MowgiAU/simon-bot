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
export const LIVE_EFFECTS = new Set(['Eq8', 'Compressor2', 'GlueCompressor']);

export interface LiveEffectResult {
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

    // Parametric EQ 2 has 7 bands; an EQ Eight using all 8 becomes two
    const effects: FlNativeEffect[] = [];
    for (let i = 0; i < Math.max(1, bands.length); i += PEQ2_BANDS) {
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

// ── Dispatch ─────────────────────────────────────────────────────────────────

const CONVERTERS: Record<string, (d: ConvLiveEffect) => LiveEffectResult | null> = {
    Eq8: eq8,
    Compressor2: compressor2,
    GlueCompressor: glueCompressor,
};

/** FL's own effects for one Live effect, or null if there's no equivalent. */
export function liveEffectToFl(d: ConvLiveEffect): LiveEffectResult | null {
    return CONVERTERS[d.device]?.(d) ?? null;
}

/** The FL plugin a Live effect becomes, for the report. */
export const LIVE_EFFECT_TARGETS: Record<string, string> = {
    Eq8: PEQ2,
    Compressor2: FRUITY_COMPRESSOR,
    GlueCompressor: FRUITY_COMPRESSOR,
};
