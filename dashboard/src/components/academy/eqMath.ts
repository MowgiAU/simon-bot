/**
 * eqMath — analytic magnitude response for the EQ's filter bands.
 *
 * Deliberately not using BiquadFilterNode.getFrequencyResponse(): those nodes only
 * exist once the AudioContext has been created (which needs a user gesture), so the
 * plugin window would render a flat/blank curve until the student pressed Play.
 * Computing the response from the band settings means the curve is correct the
 * instant the window opens, and while the transport is stopped.
 *
 * Coefficients follow the RBJ Audio EQ Cookbook — the same formulas the Web Audio
 * spec defines BiquadFilterNode in terms of, so the drawn curve matches what's heard.
 */
import { EQBand } from './AudioEngine';

/** Nominal sample rate for display math. Real ctx rate is used when available. */
export const DISPLAY_SAMPLE_RATE = 48000;

export const EQ_MIN_FREQ = 20;
export const EQ_MAX_FREQ = 20000;
/** Vertical range of the curve display, in dB */
export const EQ_DB_RANGE = 18;

interface Coeffs { b0: number; b1: number; b2: number; a0: number; a1: number; a2: number; }

function bandCoeffs(band: EQBand, sampleRate: number): Coeffs | null {
    if (!band.enabled) return null;
    const f0 = Math.max(EQ_MIN_FREQ, Math.min(EQ_MAX_FREQ, band.freq));
    const w0 = (2 * Math.PI * f0) / sampleRate;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const Q = Math.max(0.0001, band.q);
    const alpha = sw / (2 * Q);
    const A = Math.pow(10, band.gain / 40);
    const sqA = Math.sqrt(A);

    switch (band.type) {
        case 'peaking':
            return {
                b0: 1 + alpha * A, b1: -2 * cw, b2: 1 - alpha * A,
                a0: 1 + alpha / A, a1: -2 * cw, a2: 1 - alpha / A,
            };
        case 'lowshelf':
            return {
                b0: A * ((A + 1) - (A - 1) * cw + 2 * sqA * alpha),
                b1: 2 * A * ((A - 1) - (A + 1) * cw),
                b2: A * ((A + 1) - (A - 1) * cw - 2 * sqA * alpha),
                a0: (A + 1) + (A - 1) * cw + 2 * sqA * alpha,
                a1: -2 * ((A - 1) + (A + 1) * cw),
                a2: (A + 1) + (A - 1) * cw - 2 * sqA * alpha,
            };
        case 'highshelf':
            return {
                b0: A * ((A + 1) + (A - 1) * cw + 2 * sqA * alpha),
                b1: -2 * A * ((A - 1) + (A + 1) * cw),
                b2: A * ((A + 1) + (A - 1) * cw - 2 * sqA * alpha),
                a0: (A + 1) - (A - 1) * cw + 2 * sqA * alpha,
                a1: 2 * ((A - 1) - (A + 1) * cw),
                a2: (A + 1) - (A - 1) * cw - 2 * sqA * alpha,
            };
        case 'lowpass':
            return {
                b0: (1 - cw) / 2, b1: 1 - cw, b2: (1 - cw) / 2,
                a0: 1 + alpha, a1: -2 * cw, a2: 1 - alpha,
            };
        case 'highpass':
            return {
                b0: (1 + cw) / 2, b1: -(1 + cw), b2: (1 + cw) / 2,
                a0: 1 + alpha, a1: -2 * cw, a2: 1 - alpha,
            };
        case 'bandpass':
            return {
                b0: alpha, b1: 0, b2: -alpha,
                a0: 1 + alpha, a1: -2 * cw, a2: 1 - alpha,
            };
        case 'notch':
            return {
                b0: 1, b1: -2 * cw, b2: 1,
                a0: 1 + alpha, a1: -2 * cw, a2: 1 - alpha,
            };
        default:
            return null;
    }
}

/** |H(e^jw)| in dB for one set of coefficients at frequency `f`. */
function magnitudeDb(c: Coeffs, f: number, sampleRate: number): number {
    const w = (2 * Math.PI * f) / sampleRate;
    const cos1 = Math.cos(w), sin1 = Math.sin(w);
    const cos2 = Math.cos(2 * w), sin2 = Math.sin(2 * w);

    const numRe = c.b0 + c.b1 * cos1 + c.b2 * cos2;
    const numIm = -(c.b1 * sin1 + c.b2 * sin2);
    const denRe = c.a0 + c.a1 * cos1 + c.a2 * cos2;
    const denIm = -(c.a1 * sin1 + c.a2 * sin2);

    const num = Math.sqrt(numRe * numRe + numIm * numIm);
    const den = Math.sqrt(denRe * denRe + denIm * denIm);
    if (den === 0) return 0;
    return 20 * Math.log10(Math.max(1e-9, num / den));
}

/**
 * Combined response of every band at `freq`, in dB. Filters in series multiply,
 * which is a sum once you're in dB.
 */
export function totalResponseDb(bands: EQBand[], freq: number, sampleRate = DISPLAY_SAMPLE_RATE): number {
    let db = 0;
    for (const band of bands) {
        const c = bandCoeffs(band, sampleRate);
        if (c) db += magnitudeDb(c, freq, sampleRate);
    }
    return db;
}

/** Response of a single band — used to draw each band's own faint curve. */
export function bandResponseDb(band: EQBand, freq: number, sampleRate = DISPLAY_SAMPLE_RATE): number {
    const c = bandCoeffs(band, sampleRate);
    return c ? magnitudeDb(c, freq, sampleRate) : 0;
}

// ---------- Log-frequency <-> pixel mapping ----------

/** Fraction 0..1 across the display for a frequency, on a log scale. */
export function freqToRatio(freq: number): number {
    const lo = Math.log10(EQ_MIN_FREQ), hi = Math.log10(EQ_MAX_FREQ);
    return (Math.log10(Math.max(EQ_MIN_FREQ, Math.min(EQ_MAX_FREQ, freq))) - lo) / (hi - lo);
}

export function ratioToFreq(ratio: number): number {
    const lo = Math.log10(EQ_MIN_FREQ), hi = Math.log10(EQ_MAX_FREQ);
    return Math.pow(10, lo + Math.max(0, Math.min(1, ratio)) * (hi - lo));
}

/** dB -> 0..1 from top of the display (0 dB sits in the middle). */
export function dbToRatio(db: number): number {
    return 0.5 - db / (EQ_DB_RANGE * 2);
}

export function ratioToDb(ratio: number): number {
    return (0.5 - ratio) * EQ_DB_RANGE * 2;
}

/** Gridlines FL draws behind the curve. */
export const EQ_GRID_FREQS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

export function formatFreq(freq: number): string {
    return freq >= 1000 ? `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}k` : `${Math.round(freq)}`;
}
