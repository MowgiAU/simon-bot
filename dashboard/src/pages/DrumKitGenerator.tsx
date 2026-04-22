import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Drum, Play, Pause as PauseIcon, Download, Shuffle, Package, Hash, Sparkles, Loader } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

// ────────────────────────────────────────────────────────────────────────────
// Fuji Studio – Procedural Drum Kit Generator
// 100% royalty-free synthesis. No external samples.
// ────────────────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;

// ─── PRNG (Mulberry32) ──────────────────────────────────────────────────────
function mulberry32(seed: number) {
    let t = seed >>> 0;
    return function () {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
type RNG = () => number;
const rangeR = (rng: RNG, lo: number, hi: number) => lo + rng() * (hi - lo);
const choiceR = <T,>(rng: RNG, arr: T[]) => arr[Math.floor(rng() * arr.length)];

// ─── Genre profiles ─────────────────────────────────────────────────────────
type GenreId =
    | 'trap' | 'techno' | 'lofi' | 'house' | 'dnb'
    | 'hiphop' | 'ambient' | 'pop' | 'rock' | 'edm' | 'generic';

interface GenreProfile {
    id: GenreId;
    label: string;
    blurb: string;
    kick:  { tuneLo: number; tuneHi: number; decayLo: number; decayHi: number; clickAmt: number; subAmt: number; drive: number; bitcrush?: number };
    snare: { toneLo: number; toneHi: number; decayLo: number; decayHi: number; noiseHpLo: number; noiseHpHi: number; toneAmt: number; drive: number; bitcrush?: number };
    hat:   { decayLo: number; decayHi: number; hpLo: number; hpHi: number; metallicAmt: number; bitcrush?: number };
    perc:  { mode: 'fm' | 'tonal' | 'noise' | 'mix'; freqLo: number; freqHi: number; decayLo: number; decayHi: number; drive: number; bitcrush?: number };
}

const GENRE_PROFILES: Record<GenreId, GenreProfile> = {
    trap: {
        id: 'trap', label: 'Trap', blurb: 'Long sub 808 kicks · snappy snares · airy hats',
        kick:  { tuneLo: 36, tuneHi: 52, decayLo: 1.4, decayHi: 2.6, clickAmt: 0.8, subAmt: 1.0, drive: 1.4 },
        snare: { toneLo: 180, toneHi: 230, decayLo: 0.18, decayHi: 0.32, noiseHpLo: 1500, noiseHpHi: 3200, toneAmt: 0.55, drive: 1.2 },
        hat:   { decayLo: 0.04, decayHi: 0.18, hpLo: 7000, hpHi: 11000, metallicAmt: 0.55 },
        perc:  { mode: 'mix', freqLo: 400, freqHi: 1800, decayLo: 0.08, decayHi: 0.4, drive: 1.1 },
    },
    techno: {
        id: 'techno', label: 'Techno', blurb: 'Punchy driven kicks · metallic FM percussion',
        kick:  { tuneLo: 50, tuneHi: 68, decayLo: 0.35, decayHi: 0.7, clickAmt: 1.0, subAmt: 0.55, drive: 2.5 },
        snare: { toneLo: 200, toneHi: 280, decayLo: 0.1, decayHi: 0.22, noiseHpLo: 2200, noiseHpHi: 4500, toneAmt: 0.4, drive: 1.6 },
        hat:   { decayLo: 0.03, decayHi: 0.12, hpLo: 8000, hpHi: 12000, metallicAmt: 0.85 },
        perc:  { mode: 'fm', freqLo: 320, freqHi: 1200, decayLo: 0.06, decayHi: 0.35, drive: 1.6 },
    },
    lofi: {
        id: 'lofi', label: 'Lo-Fi', blurb: 'Bit-crushed warmth · soft-clipped vintage feel',
        kick:  { tuneLo: 55, tuneHi: 75, decayLo: 0.3, decayHi: 0.55, clickAmt: 0.4, subAmt: 0.5, drive: 1.1, bitcrush: 8 },
        snare: { toneLo: 170, toneHi: 220, decayLo: 0.12, decayHi: 0.22, noiseHpLo: 1000, noiseHpHi: 2200, toneAmt: 0.5, drive: 1.0, bitcrush: 7 },
        hat:   { decayLo: 0.05, decayHi: 0.18, hpLo: 5000, hpHi: 8500, metallicAmt: 0.35, bitcrush: 8 },
        perc:  { mode: 'tonal', freqLo: 250, freqHi: 900, decayLo: 0.1, decayHi: 0.4, drive: 0.9, bitcrush: 7 },
    },
    house: {
        id: 'house', label: 'House', blurb: 'Classic 4-on-the-floor punch · open hats',
        kick:  { tuneLo: 55, tuneHi: 65, decayLo: 0.25, decayHi: 0.45, clickAmt: 0.7, subAmt: 0.7, drive: 1.4 },
        snare: { toneLo: 190, toneHi: 240, decayLo: 0.12, decayHi: 0.25, noiseHpLo: 1800, noiseHpHi: 3500, toneAmt: 0.5, drive: 1.2 },
        hat:   { decayLo: 0.05, decayHi: 0.25, hpLo: 6500, hpHi: 10500, metallicAmt: 0.6 },
        perc:  { mode: 'noise', freqLo: 600, freqHi: 2200, decayLo: 0.05, decayHi: 0.3, drive: 1.0 },
    },
    dnb: {
        id: 'dnb', label: 'Drum & Bass', blurb: 'Tight snares · fast hats · weighty subs',
        kick:  { tuneLo: 45, tuneHi: 60, decayLo: 0.3, decayHi: 0.6, clickAmt: 0.9, subAmt: 0.85, drive: 1.6 },
        snare: { toneLo: 220, toneHi: 320, decayLo: 0.18, decayHi: 0.32, noiseHpLo: 2400, noiseHpHi: 4500, toneAmt: 0.45, drive: 1.5 },
        hat:   { decayLo: 0.03, decayHi: 0.1, hpLo: 8500, hpHi: 12000, metallicAmt: 0.75 },
        perc:  { mode: 'fm', freqLo: 500, freqHi: 1800, decayLo: 0.05, decayHi: 0.2, drive: 1.4 },
    },
    hiphop: {
        id: 'hiphop', label: 'Hip-Hop', blurb: 'Warm boom-bap kicks · cracky snares',
        kick:  { tuneLo: 55, tuneHi: 78, decayLo: 0.35, decayHi: 0.7, clickAmt: 0.5, subAmt: 0.65, drive: 1.3 },
        snare: { toneLo: 180, toneHi: 240, decayLo: 0.18, decayHi: 0.32, noiseHpLo: 1200, noiseHpHi: 2800, toneAmt: 0.55, drive: 1.3, bitcrush: 10 },
        hat:   { decayLo: 0.05, decayHi: 0.16, hpLo: 5500, hpHi: 9000, metallicAmt: 0.4, bitcrush: 10 },
        perc:  { mode: 'mix', freqLo: 300, freqHi: 1400, decayLo: 0.08, decayHi: 0.35, drive: 1.1 },
    },
    ambient: {
        id: 'ambient', label: 'Ambient / Chill', blurb: 'Soft brushed textures · gentle attacks',
        kick:  { tuneLo: 60, tuneHi: 85, decayLo: 0.4, decayHi: 0.8, clickAmt: 0.2, subAmt: 0.55, drive: 0.9 },
        snare: { toneLo: 160, toneHi: 220, decayLo: 0.2, decayHi: 0.45, noiseHpLo: 800, noiseHpHi: 2000, toneAmt: 0.45, drive: 0.9 },
        hat:   { decayLo: 0.08, decayHi: 0.3, hpLo: 4500, hpHi: 8000, metallicAmt: 0.3 },
        perc:  { mode: 'tonal', freqLo: 220, freqHi: 900, decayLo: 0.2, decayHi: 0.7, drive: 0.85 },
    },
    pop: {
        id: 'pop', label: 'Pop', blurb: 'Polished tight kit · radio-ready snap',
        kick:  { tuneLo: 55, tuneHi: 72, decayLo: 0.25, decayHi: 0.5, clickAmt: 0.7, subAmt: 0.6, drive: 1.2 },
        snare: { toneLo: 200, toneHi: 270, decayLo: 0.14, decayHi: 0.26, noiseHpLo: 1600, noiseHpHi: 3500, toneAmt: 0.55, drive: 1.2 },
        hat:   { decayLo: 0.05, decayHi: 0.18, hpLo: 7000, hpHi: 10500, metallicAmt: 0.55 },
        perc:  { mode: 'mix', freqLo: 400, freqHi: 1600, decayLo: 0.08, decayHi: 0.3, drive: 1.0 },
    },
    rock: {
        id: 'rock', label: 'Rock', blurb: 'Big driven kicks · crisp acoustic-style snare',
        kick:  { tuneLo: 55, tuneHi: 70, decayLo: 0.35, decayHi: 0.6, clickAmt: 0.95, subAmt: 0.55, drive: 1.8 },
        snare: { toneLo: 200, toneHi: 280, decayLo: 0.18, decayHi: 0.35, noiseHpLo: 1400, noiseHpHi: 3000, toneAmt: 0.6, drive: 1.5 },
        hat:   { decayLo: 0.06, decayHi: 0.22, hpLo: 6500, hpHi: 10000, metallicAmt: 0.65 },
        perc:  { mode: 'noise', freqLo: 500, freqHi: 1800, decayLo: 0.08, decayHi: 0.3, drive: 1.3 },
    },
    edm: {
        id: 'edm', label: 'EDM', blurb: 'Loud festival-grade transients · driven hats',
        kick:  { tuneLo: 50, tuneHi: 65, decayLo: 0.3, decayHi: 0.55, clickAmt: 1.0, subAmt: 0.8, drive: 2.0 },
        snare: { toneLo: 210, toneHi: 290, decayLo: 0.14, decayHi: 0.28, noiseHpLo: 2000, noiseHpHi: 4200, toneAmt: 0.5, drive: 1.5 },
        hat:   { decayLo: 0.04, decayHi: 0.15, hpLo: 8000, hpHi: 11500, metallicAmt: 0.75 },
        perc:  { mode: 'fm', freqLo: 400, freqHi: 1500, decayLo: 0.06, decayHi: 0.25, drive: 1.5 },
    },
    generic: {
        id: 'generic', label: 'Generic', blurb: 'Balanced studio-style kit',
        kick:  { tuneLo: 55, tuneHi: 70, decayLo: 0.3, decayHi: 0.6, clickAmt: 0.7, subAmt: 0.65, drive: 1.3 },
        snare: { toneLo: 190, toneHi: 250, decayLo: 0.14, decayHi: 0.28, noiseHpLo: 1500, noiseHpHi: 3200, toneAmt: 0.5, drive: 1.2 },
        hat:   { decayLo: 0.05, decayHi: 0.2, hpLo: 6500, hpHi: 10000, metallicAmt: 0.55 },
        perc:  { mode: 'mix', freqLo: 400, freqHi: 1500, decayLo: 0.08, decayHi: 0.3, drive: 1.1 },
    },
};

// Map remote genre names → our profile ids (best-effort; falls back to generic)
function mapGenreNameToProfile(name: string): GenreId {
    const n = name.toLowerCase();
    if (/(trap|drill|phonk)/.test(n))                       return 'trap';
    if (/(techno|tech\s?house|industrial|minimal)/.test(n)) return 'techno';
    if (/(lo[\s-]?fi|chill\s?hop|jazzhop)/.test(n))         return 'lofi';
    if (/(deep\s?house|tropical\s?house|disco|funky)/.test(n)) return 'house';
    if (/(house)/.test(n))                                  return 'house';
    if (/(d&b|dnb|drum.?&.?bass|jungle|breakbeat|breakcore)/.test(n)) return 'dnb';
    if (/(hip[\s-]?hop|rap|boom.?bap)/.test(n))             return 'hiphop';
    if (/(ambient|chill|new\s?age|downtempo|cinematic)/.test(n)) return 'ambient';
    if (/(rock|metal|punk|grunge)/.test(n))                 return 'rock';
    if (/(pop|indie|r&b|rnb)/.test(n))                      return 'pop';
    if (/(edm|dance|electro|future\s?bass|dubstep|big\s?room|hardstyle)/.test(n)) return 'edm';
    return 'generic';
}

// ─── DSP helpers ────────────────────────────────────────────────────────────
function adsrEnv(samples: number, attack: number, decay: number, sustain: number, release: number, totalSec: number) {
    const env = new Float32Array(samples);
    const aN = Math.max(1, Math.floor(attack * SAMPLE_RATE));
    const dN = Math.max(1, Math.floor(decay  * SAMPLE_RATE));
    const rN = Math.max(1, Math.floor(release* SAMPLE_RATE));
    const sN = Math.max(0, samples - aN - dN - rN);
    for (let i = 0; i < samples; i++) {
        let v: number;
        if (i < aN) {
            v = i / aN;
        } else if (i < aN + dN) {
            const t = (i - aN) / dN;
            v = 1 - (1 - sustain) * t;
        } else if (i < aN + dN + sN) {
            v = sustain;
        } else {
            const t = (i - aN - dN - sN) / rN;
            v = sustain * (1 - t);
        }
        env[i] = v;
    }
    // gentle exponential shape across the lifetime to feel natural
    const totalN = totalSec * SAMPLE_RATE;
    for (let i = 0; i < samples; i++) {
        const t = i / totalN;
        env[i] *= Math.pow(1 - t * 0.95, 1.6);
    }
    return env;
}

// Asymmetric soft saturation: warmer than tanh, adds 2nd-order harmonics.
function softClip(x: number, drive: number) {
    const y = Math.tanh(x * drive) / Math.tanh(drive);
    // Subtle 2nd-harmonic warmth (asymmetric)
    return y - 0.04 * y * y;
}

function bitCrush(buf: Float32Array, bits: number, downsample = 1) {
    const steps = Math.pow(2, bits) / 2;
    let last = 0;
    for (let i = 0; i < buf.length; i++) {
        if (i % downsample === 0) last = Math.round(buf[i] * steps) / steps;
        buf[i] = last;
    }
}

// One-pole high-pass filter
function highPass(buf: Float32Array, cutoff: number) {
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / SAMPLE_RATE;
    const alpha = rc / (rc + dt);
    let prevX = 0, prevY = 0;
    for (let i = 0; i < buf.length; i++) {
        const x = buf[i];
        const y = alpha * (prevY + x - prevX);
        buf[i] = y;
        prevX = x; prevY = y;
    }
}

// One-pole low-pass filter
function lowPass(buf: Float32Array, cutoff: number) {
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / SAMPLE_RATE;
    const alpha = dt / (rc + dt);
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
        y = y + alpha * (buf[i] - y);
        buf[i] = y;
    }
}

// Cascade of HP then LP for a basic band-pass.
function bandPass(buf: Float32Array, lo: number, hi: number) {
    highPass(buf, lo);
    lowPass(buf, hi);
}

// Removes DC offset that filtering can introduce — keeps export clean.
function dcBlock(buf: Float32Array) {
    const R = 0.995;
    let prevX = 0, prevY = 0;
    for (let i = 0; i < buf.length; i++) {
        const x = buf[i];
        const y = x - prevX + R * prevY;
        buf[i] = y;
        prevX = x; prevY = y;
    }
}

// Apply a short cosine attack ramp so transients don't pop on sample 0.
function applyAttack(buf: Float32Array, ms = 0.6) {
    const n = Math.min(buf.length, Math.floor(ms * 0.001 * SAMPLE_RATE));
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
        buf[i] *= 0.5 - 0.5 * Math.cos(Math.PI * (i / n));
    }
}

// Apply a short cosine release ramp at the end so the tail doesn't click on cut.
function applyRelease(buf: Float32Array, ms = 4) {
    const n = Math.min(buf.length, Math.floor(ms * 0.001 * SAMPLE_RATE));
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
        buf[buf.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * (i / n));
    }
}

function normalize(buf: Float32Array, target = 0.95) {
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
    }
    if (peak > 0) {
        const g = target / peak;
        for (let i = 0; i < buf.length; i++) buf[i] *= g;
    }
}

// Render a high-passed noise click of length `ms` mixed into `buf` at offset 0.
function mixClick(buf: Float32Array, rng: RNG, ms: number, hp: number, amp: number) {
    const n = Math.min(buf.length, Math.floor(ms * 0.001 * SAMPLE_RATE));
    if (n < 2) return;
    const click = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        // exponential decay across the click length
        click[i] = (rng() * 2 - 1) * Math.exp(-i / (n * 0.3));
    }
    highPass(click, hp);
    for (let i = 0; i < n; i++) buf[i] += click[i] * amp;
}

// ─── Synthesis ──────────────────────────────────────────────────────────────
// Trap / 808-style kick: fast pitch sweep + sine body + filtered noise click.
function synthKick(rng: RNG, p: GenreProfile['kick'], totalSec: number): Float32Array {
    const N = Math.floor(totalSec * SAMPLE_RATE);
    const out = new Float32Array(N);
    const baseFreq = rangeR(rng, p.tuneLo, p.tuneHi);
    const decay    = rangeR(rng, p.decayLo, p.decayHi);

    // Pitch envelope: starts well above base and falls FAST (10–25ms) so it lands as a thump, not a tom.
    const pitchStart = baseFreq * rangeR(rng, 6, 9);
    const pitchTau   = 0.010 + rng() * 0.015;

    // Body: pitched sine via integrated phase
    let phase = 0;
    for (let i = 0; i < N; i++) {
        const t = i / SAMPLE_RATE;
        const f = baseFreq + (pitchStart - baseFreq) * Math.exp(-t / pitchTau);
        phase += (2 * Math.PI * f) / SAMPLE_RATE;
        const env  = Math.exp(-t / decay);
        const body = Math.sin(phase) * env;
        // Sub: pure low sine, longer tail for weight
        const sub  = Math.sin(2 * Math.PI * baseFreq * t) * Math.exp(-t / (decay * 1.6)) * p.subAmt * 0.55;
        out[i] = body + sub;
    }

    // Click: short 2ms hi-passed noise burst (gives the "tick"); plus a 1.5ms hi-sine snap for definition.
    if (p.clickAmt > 0) {
        mixClick(out, rng, 2.0, 1500, p.clickAmt * 0.7);
        const snapN = Math.min(N, Math.floor(0.0015 * SAMPLE_RATE));
        const snapFreq = 2400 + rng() * 1600;
        for (let i = 0; i < snapN; i++) {
            const t = i / SAMPLE_RATE;
            out[i] += Math.sin(2 * Math.PI * snapFreq * t) * Math.exp(-i / (snapN * 0.4)) * p.clickAmt * 0.35;
        }
    }

    // Drive: saturate the BODY but keep transient dynamics — apply gently overall.
    for (let i = 0; i < N; i++) out[i] = softClip(out[i], p.drive);
    if (p.bitcrush) bitCrush(out, p.bitcrush);
    dcBlock(out);
    applyAttack(out, 0.3);
    applyRelease(out, 8);
    normalize(out, 0.94);
    return out;
}

// Snare: 2-osc tone "shell" + band-passed noise body + hi-passed noise snap + click.
function synthSnare(rng: RNG, p: GenreProfile['snare'], totalSec: number): Float32Array {
    const N = Math.floor(totalSec * SAMPLE_RATE);
    const out = new Float32Array(N);
    const tone   = rangeR(rng, p.toneLo, p.toneHi);
    const tone2  = tone * rangeR(rng, 1.55, 1.78);                 // 2nd shell partial
    const decay  = rangeR(rng, p.decayLo, p.decayHi);
    const hp     = rangeR(rng, p.noiseHpLo, p.noiseHpHi);

    // Shell tone — short envelope (gives the "thock")
    const toneTau = decay * 0.35;
    for (let i = 0; i < N; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t / toneTau);
        out[i] += (Math.sin(2 * Math.PI * tone * t) * 0.7
                 + Math.sin(2 * Math.PI * tone2 * t) * 0.4) * env * p.toneAmt;
    }

    // Noise body — band-passed (200Hz–6kHz) gives the "weight" of the snare wires
    const body = new Float32Array(N);
    for (let i = 0; i < N; i++) body[i] = rng() * 2 - 1;
    bandPass(body, 200, 6000);
    for (let i = 0; i < N; i++) {
        const t = i / SAMPLE_RATE;
        body[i] *= Math.exp(-t / (decay * 0.7)) * 0.55;
    }

    // Noise snap — high-passed white noise, longer tail (the "shhh")
    const snap = new Float32Array(N);
    for (let i = 0; i < N; i++) snap[i] = rng() * 2 - 1;
    highPass(snap, hp);
    for (let i = 0; i < N; i++) {
        const t = i / SAMPLE_RATE;
        snap[i] *= Math.exp(-t / decay) * 0.85;
    }

    for (let i = 0; i < N; i++) out[i] += body[i] + snap[i];
    // Click for transient bite (1.5ms HP noise)
    mixClick(out, rng, 1.5, 4000, 0.6);

    for (let i = 0; i < N; i++) out[i] = softClip(out[i], p.drive);
    if (p.bitcrush) bitCrush(out, p.bitcrush);
    dcBlock(out);
    applyAttack(out, 0.3);
    applyRelease(out, 6);
    normalize(out, 0.93);
    return out;
}

// Classic 808/909-style hat: 6 inharmonic SQUARE waves through aggressive HP + dual envelope.
function synthHat(rng: RNG, p: GenreProfile['hat'], totalSec: number, open = false): Float32Array {
    const N = Math.floor(totalSec * SAMPLE_RATE);
    const out = new Float32Array(N);
    const decay = rangeR(rng, p.decayLo, p.decayHi) * (open ? 4.5 : 1);
    const hp    = rangeR(rng, p.hpLo, p.hpHi);

    // Six inharmonic ratios from the 808 hi-hat (Roland classic).
    // Using square waves (sign of sine) gives the characteristic metallic / ringing tone.
    const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
    const base = rangeR(rng, 200, 280);

    // Two-stage envelope: short attack snap (3ms) summed with slow body decay.
    const snapTau = 0.003;
    for (let i = 0; i < N; i++) {
        const t = i / SAMPLE_RATE;
        let metal = 0;
        for (const r of ratios) metal += Math.sign(Math.sin(2 * Math.PI * base * r * t));
        metal /= ratios.length;
        // Tiny noise overlay (hi-passed later) — adds airiness
        const noise = (rng() * 2 - 1) * 0.35;
        const sig = metal * p.metallicAmt + noise * (1 - p.metallicAmt);

        const envBody = Math.exp(-t / decay);
        const envSnap = Math.exp(-t / snapTau);
        out[i] = sig * (envBody + envSnap * 0.6);
    }

    // Hi-pass filter applied twice → effectively steeper rolloff (kills mud).
    highPass(out, hp);
    highPass(out, hp);
    if (p.bitcrush) bitCrush(out, p.bitcrush);
    dcBlock(out);
    applyAttack(out, 0.2);
    applyRelease(out, open ? 12 : 4);
    normalize(out, 0.82);
    return out;
}

// Percussion: clap (multi-burst) | tonal (pitched tom) | fm (metallic) | mix (random).
function synthPerc(rng: RNG, p: GenreProfile['perc'], totalSec: number): Float32Array {
    const N = Math.floor(totalSec * SAMPLE_RATE);
    const out = new Float32Array(N);
    const freq  = rangeR(rng, p.freqLo, p.freqHi);
    const decay = rangeR(rng, p.decayLo, p.decayHi);

    // Pick effective mode for this hit
    let mode: 'fm' | 'tonal' | 'noise' = p.mode === 'mix'
        ? choiceR(rng, ['fm', 'tonal', 'noise']) as any
        : (p.mode as any);

    if (mode === 'fm') {
        // FM perc — carrier + modulator with envelope on mod index
        const modRatio = choiceR(rng, [1.41, 1.73, 2.13, 2.79, 3.51]);
        const modFreq  = freq * modRatio;
        const modIdx   = 3 + rng() * 6;
        const modTau   = decay * 0.4;
        for (let i = 0; i < N; i++) {
            const t = i / SAMPLE_RATE;
            const env    = Math.exp(-t / decay);
            const envMod = Math.exp(-t / modTau);
            const mod    = Math.sin(2 * Math.PI * modFreq * t) * modIdx * envMod;
            out[i] = Math.sin(2 * Math.PI * freq * t + mod) * env;
        }
        // Subtle click for attack
        mixClick(out, rng, 1.0, 3000, 0.3);
    } else if (mode === 'tonal') {
        // Pitched tom-style: pitch envelope + sine body + harmonic
        const pitchStart = freq * rangeR(rng, 1.8, 3.0);
        const pitchTau   = 0.020 + rng() * 0.015;
        let phase = 0;
        for (let i = 0; i < N; i++) {
            const t = i / SAMPLE_RATE;
            const f = freq + (pitchStart - freq) * Math.exp(-t / pitchTau);
            phase += (2 * Math.PI * f) / SAMPLE_RATE;
            const env = Math.exp(-t / decay);
            out[i] = (Math.sin(phase) + Math.sin(phase * 2) * 0.25) * env;
        }
        mixClick(out, rng, 1.5, 1500, 0.35);
        lowPass(out, freq * 8);
    } else {
        // Clap-style: 3–4 noise bursts spaced 8–14ms apart, plus a longer tail
        const bursts = 3 + Math.floor(rng() * 2);
        const spacing = 0.008 + rng() * 0.006;
        const burstLen = 0.012;
        const noise = new Float32Array(N);
        for (let i = 0; i < N; i++) noise[i] = rng() * 2 - 1;
        bandPass(noise, freq, freq * 5);
        for (let b = 0; b < bursts; b++) {
            const start = Math.floor((b * spacing) * SAMPLE_RATE);
            const len = Math.floor(burstLen * SAMPLE_RATE);
            for (let i = 0; i < len && start + i < N; i++) {
                const env = Math.exp(-i / (len * 0.35));
                out[start + i] += noise[start + i] * env * (b === bursts - 1 ? 1.0 : 0.55);
            }
        }
        // Longer reverb-like tail
        const tailStart = Math.floor((bursts * spacing) * SAMPLE_RATE);
        for (let i = tailStart; i < N; i++) {
            const t = (i - tailStart) / SAMPLE_RATE;
            out[i] += noise[i] * Math.exp(-t / decay) * 0.25;
        }
    }
    for (let i = 0; i < N; i++) out[i] = softClip(out[i], p.drive);
    if (p.bitcrush) bitCrush(out, p.bitcrush);
    dcBlock(out);
    applyAttack(out, 0.3);
    applyRelease(out, 6);
    normalize(out, 0.88);
    return out;
}

// ─── 24-bit WAV encoder ─────────────────────────────────────────────────────
function encodeWav24(samples: Float32Array, sampleRate = SAMPLE_RATE): Blob {
    const bytesPerSample = 3;
    const numChannels = 1;
    const dataSize = samples.length * bytesPerSample * numChannels;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);              // PCM chunk size
    view.setUint16(20, 1, true);               // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 24, true);              // bits per sample
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let off = 44;
    for (let i = 0; i < samples.length; i++) {
        let v = Math.max(-1, Math.min(1, samples[i]));
        const intVal = Math.round(v * 8388607); // 2^23 - 1
        view.setUint8(off,     intVal        & 0xff);
        view.setUint8(off + 1, (intVal >> 8) & 0xff);
        view.setUint8(off + 2, (intVal >> 16) & 0xff);
        off += 3;
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

// Convert a Float32Array → AudioBuffer (for live preview via WebAudio)
function bufferToAudioBuffer(ctx: AudioContext, data: Float32Array): AudioBuffer {
    const ab = ctx.createBuffer(1, data.length, SAMPLE_RATE);
    ab.copyToChannel(data, 0);
    return ab;
}

// ─── Kit generation ────────────────────────────────────────────────────────
type KitSlot = 'kick' | 'snare' | 'hat' | 'openhat' | 'perc' | 'perc2';
const SLOT_ORDER: KitSlot[] = ['kick', 'snare', 'hat', 'openhat', 'perc', 'perc2'];
const SLOT_LABEL: Record<KitSlot, string> = {
    kick: 'Kick', snare: 'Snare', hat: 'Closed Hat', openhat: 'Open Hat', perc: 'Percussion', perc2: 'Perc / FX'
};

interface GeneratedSample {
    slot: KitSlot;
    label: string;
    data: Float32Array;
}

function generateKit(profile: GenreProfile, seed: number): GeneratedSample[] {
    const samples: GeneratedSample[] = [];
    // Each slot uses a derived seed so individual variations differ but kit is deterministic
    const slots: { slot: KitSlot; fn: (rng: RNG) => Float32Array }[] = [
        { slot: 'kick',    fn: r => synthKick(r,  profile.kick,  Math.max(0.4, profile.kick.decayHi + 0.2)) },
        { slot: 'snare',   fn: r => synthSnare(r, profile.snare, profile.snare.decayHi + 0.1) },
        { slot: 'hat',     fn: r => synthHat(r,   profile.hat,   profile.hat.decayHi + 0.05, false) },
        { slot: 'openhat', fn: r => synthHat(r,   profile.hat,   profile.hat.decayHi * 4 + 0.1, true) },
        { slot: 'perc',    fn: r => synthPerc(r,  profile.perc,  profile.perc.decayHi + 0.1) },
        { slot: 'perc2',   fn: r => synthPerc(r,  profile.perc,  profile.perc.decayHi + 0.1) },
    ];
    for (let i = 0; i < slots.length; i++) {
        const rng = mulberry32(seed + i * 9173);
        const data = slots[i].fn(rng);
        samples.push({ slot: slots[i].slot, label: SLOT_LABEL[slots[i].slot], data });
    }
    return samples;
}

// ─── React UI ──────────────────────────────────────────────────────────────
interface RemoteGenre { id: string; name: string; }

export const DrumKitGeneratorPage: React.FC = () => {
    const [remoteGenres, setRemoteGenres] = useState<RemoteGenre[]>([]);
    const [genreId, setGenreId] = useState<GenreId>('trap');
    const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 0xffffffff));
    const [seedInput, setSeedInput] = useState<string>('');
    const [kit, setKit] = useState<GeneratedSample[]>([]);
    const [busy, setBusy] = useState(false);
    const [playing, setPlaying] = useState<KitSlot | null>(null);

    const ctxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);

    const profile = GENRE_PROFILES[genreId] || GENRE_PROFILES.generic;

    // Pull live genres from the API (best-effort, optional)
    useEffect(() => {
        fetch('/api/musician/genres')
            .then(r => r.ok ? r.json() : [])
            .then((rows: any[]) => {
                if (!Array.isArray(rows)) return;
                const seen = new Set<string>();
                const list: RemoteGenre[] = [];
                for (const r of rows) {
                    if (!r?.name || seen.has(r.name)) continue;
                    seen.add(r.name);
                    list.push({ id: r.id, name: r.name });
                }
                setRemoteGenres(list);
            })
            .catch(() => { /* silent */ });
    }, []);

    // Auto-generate a starting kit on first mount
    useEffect(() => {
        regenerate(genreId, seed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const regenerate = (g: GenreId, s: number) => {
        setBusy(true);
        // Defer to next tick so the spinner can render
        setTimeout(() => {
            try {
                const p = GENRE_PROFILES[g] || GENRE_PROFILES.generic;
                const k = generateKit(p, s);
                setKit(k);
            } finally {
                setBusy(false);
            }
        }, 30);
    };

    const handleGenerate = () => {
        const ns = Math.floor(Math.random() * 0xffffffff);
        setSeed(ns);
        setSeedInput('');
        regenerate(genreId, ns);
    };

    const handleSeedApply = () => {
        const v = parseInt(seedInput, 10);
        if (!isNaN(v)) {
            setSeed(v >>> 0);
            regenerate(genreId, v >>> 0);
        }
    };

    const handleGenreChange = (g: GenreId) => {
        setGenreId(g);
        regenerate(g, seed);
    };

    const ensureCtx = () => {
        if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
        return ctxRef.current;
    };

    const playSample = (s: GeneratedSample) => {
        const ctx = ensureCtx();
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch { /* */ }
            sourceRef.current = null;
        }
        const ab = bufferToAudioBuffer(ctx, s.data);
        const src = ctx.createBufferSource();
        src.buffer = ab;
        src.connect(ctx.destination);
        src.onended = () => { setPlaying(p => (p === s.slot ? null : p)); };
        src.start();
        sourceRef.current = src;
        setPlaying(s.slot);
    };

    const stopPlayback = () => {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch { /* */ }
            sourceRef.current = null;
        }
        setPlaying(null);
    };

    const downloadOne = (s: GeneratedSample) => {
        const blob = encodeWav24(s.data);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${profile.id}_${s.slot}_${seed}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadKit = async () => {
        if (kit.length === 0) return;
        const zip = new JSZip();
        const folder = zip.folder(`fuji_${profile.id}_${seed}`)!;
        for (const s of kit) {
            const blob = encodeWav24(s.data);
            const arr = await blob.arrayBuffer();
            folder.file(`${s.slot}.wav`, arr);
        }
        folder.file('README.txt',
`Fuji Studio – Procedural Drum Kit
Genre : ${profile.label}
Seed  : ${seed}
Format: 24-bit / 44.1 kHz mono WAV

Every sample is procedurally synthesized in your browser
using oscillators, noise and envelopes. Royalty-free for
your own productions.`);
        const out = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(out);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fuji_${profile.id}_${seed}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Genre selector source: combine remote genres (mapped) with built-in profiles
    const genreOptions = useMemo(() => {
        const opts: { id: GenreId; label: string; sublabel?: string }[] =
            (Object.keys(GENRE_PROFILES) as GenreId[]).map(id => ({ id, label: GENRE_PROFILES[id].label }));
        // Add remote genres as auxiliary chips → they re-use the mapped profile
        const chips: { name: string; mapped: GenreId }[] = remoteGenres.slice(0, 24).map(g => ({
            name: g.name, mapped: mapGenreNameToProfile(g.name)
        }));
        return { opts, chips };
    }, [remoteGenres]);

    return (
        <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Drum size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Drum Kit Generator</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Procedurally synthesized, 100% royalty-free drum samples
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: 14, lineHeight: 1.6 }}>
                    Pick a genre, hit <b>Generate New Kit</b> and we'll synthesize a unique 6-piece drum kit
                    (kick, snare, closed hat, open hat, plus two percussion / FX pieces) entirely in your
                    browser — no external samples, nothing copyrighted. Export individual hits or the full
                    kit as 24-bit / 44.1 kHz WAV. Save the seed to recreate the same kit again any time.
                </p>
            </div>

            {/* Genre selector */}
            <div style={{ background: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: colors.textSecondary, marginBottom: 8 }}>GENRE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {genreOptions.opts.map(o => {
                        const active = o.id === genreId;
                        return (
                            <button key={o.id}
                                onClick={() => handleGenreChange(o.id)}
                                style={{
                                    background: active ? colors.primary : 'transparent',
                                    color: active ? '#fff' : colors.textPrimary,
                                    border: `1px solid ${active ? colors.primary : colors.border}`,
                                    borderRadius: 999,
                                    padding: '6px 14px',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                }}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
                {genreOptions.chips.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: colors.textTertiary, marginBottom: 6 }}>
                            FROM YOUR COMMUNITY GENRES
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {genreOptions.chips.map((c, i) => (
                                <button key={c.name + i}
                                    onClick={() => handleGenreChange(c.mapped)}
                                    title={`Synthesises using the ${GENRE_PROFILES[c.mapped].label} profile`}
                                    style={{
                                        background: 'transparent',
                                        color: colors.textSecondary,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 999,
                                        padding: '3px 10px',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                    }}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <p style={{ margin: '12px 0 0', color: colors.textTertiary, fontSize: 12, fontStyle: 'italic' }}>
                    {profile.blurb}
                </p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: spacing.md, alignItems: 'center' }}>
                <button onClick={handleGenerate} disabled={busy}
                    style={{
                        background: colors.primary, color: '#fff', border: 'none',
                        padding: '12px 20px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
                        fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                    {busy ? <Loader size={16} className="spin" /> : <Shuffle size={16} />}
                    Generate New Kit
                </button>
                <button onClick={downloadKit} disabled={busy || kit.length === 0}
                    style={{
                        background: 'transparent', color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        padding: '12px 20px', borderRadius: 8, cursor: 'pointer',
                        fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                    <Package size={16} />
                    Download Full Kit (.zip)
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    <Hash size={14} color={colors.textSecondary} />
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>SEED</span>
                    <code style={{
                        background: colors.background, color: colors.textPrimary,
                        padding: '4px 8px', borderRadius: 4, fontSize: 12, userSelect: 'all',
                    }}>{seed}</code>
                    <input
                        type="text"
                        placeholder="Recreate seed…"
                        value={seedInput}
                        onChange={e => setSeedInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSeedApply(); }}
                        style={{
                            background: colors.background, color: colors.textPrimary,
                            border: `1px solid ${colors.border}`, borderRadius: 6,
                            padding: '6px 10px', fontSize: 12, width: 130,
                        }} />
                    <button onClick={handleSeedApply} disabled={!seedInput}
                        style={{
                            background: 'transparent', color: colors.textSecondary,
                            border: `1px solid ${colors.border}`, padding: '6px 10px',
                            borderRadius: 6, cursor: seedInput ? 'pointer' : 'not-allowed', fontSize: 12,
                        }}>
                        Load
                    </button>
                </div>
            </div>

            {/* Sample grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: spacing.md,
            }}>
                {SLOT_ORDER.map(slot => {
                    const s = kit.find(k => k.slot === slot);
                    if (!s) {
                        return (
                            <div key={slot} style={{
                                background: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                                opacity: 0.5, minHeight: 110,
                            }}>
                                <div style={{ color: colors.textTertiary, fontSize: 13 }}>{SLOT_LABEL[slot]}</div>
                            </div>
                        );
                    }
                    const isPlaying = playing === slot;
                    return <SampleCard
                        key={slot}
                        sample={s}
                        isPlaying={isPlaying}
                        onPlay={() => isPlaying ? stopPlayback() : playSample(s)}
                        onDownload={() => downloadOne(s)}
                    />;
                })}
            </div>

            {/* Footer notes */}
            <div style={{ marginTop: spacing.lg, color: colors.textTertiary, fontSize: 12, textAlign: 'center' }}>
                <Sparkles size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                All samples are generated locally in your browser. Use them anywhere — they're yours.
            </div>

            <style>{`
                @keyframes drumkit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: drumkit-spin 0.8s linear infinite; }
            `}</style>
        </div>
    );
};

// ─── Sample card with waveform preview ──────────────────────────────────────
const SampleCard: React.FC<{
    sample: GeneratedSample;
    isPlaying: boolean;
    onPlay: () => void;
    onDownload: () => void;
}> = ({ sample, isPlaying, onPlay, onDownload }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth * dpr;
        const h = canvas.clientHeight * dpr;
        canvas.width = w; canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = colors.primary;
        const data = sample.data;
        const step = Math.max(1, Math.floor(data.length / w));
        const mid = h / 2;
        for (let x = 0; x < w; x++) {
            let peak = 0;
            const start = x * step;
            const end = Math.min(data.length, start + step);
            for (let i = start; i < end; i++) {
                const v = Math.abs(data[i]);
                if (v > peak) peak = v;
            }
            const barH = peak * mid * 0.95;
            ctx.fillRect(x, mid - barH, 1, barH * 2);
        }
    }, [sample]);

    return (
        <div style={{
            background: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
            display: 'flex', flexDirection: 'column', gap: 8,
            border: isPlaying ? `1px solid ${colors.primary}` : `1px solid transparent`,
            transition: 'border 0.15s',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, color: colors.textPrimary }}>{sample.label}</div>
                <div style={{ color: colors.textTertiary, fontSize: 11 }}>
                    {(sample.data.length / SAMPLE_RATE).toFixed(2)}s
                </div>
            </div>
            <canvas ref={canvasRef} style={{ width: '100%', height: 56, background: colors.background, borderRadius: 4 }} />
            <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={onPlay}
                    style={{
                        flex: 1, background: isPlaying ? colors.primary : colors.background,
                        color: isPlaying ? '#fff' : colors.textPrimary,
                        border: `1px solid ${isPlaying ? colors.primary : colors.border}`,
                        borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    {isPlaying ? <PauseIcon size={14} /> : <Play size={14} />}
                    {isPlaying ? 'Stop' : 'Play'}
                </button>
                <button onClick={onDownload}
                    title="Download as 24-bit WAV"
                    style={{
                        background: 'transparent', color: colors.textSecondary,
                        border: `1px solid ${colors.border}`, borderRadius: 6,
                        padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <Download size={14} />
                </button>
            </div>
        </div>
    );
};

export default DrumKitGeneratorPage;
