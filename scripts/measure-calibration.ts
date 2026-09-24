/**
 * Measures Live's own devices from a frozen calibration set.
 *
 * Freezing renders each track through its device offline, so comparing a frozen track against the
 * dry one gives that device's real response. Point this at the frozen project (folder or zip) made
 * by make-calibration-set.ts and it prints the response of each track, plus the shelf corners and
 * bell widths read off those curves — the numbers that belong in LiveEffects.ts.
 *
 *   npx tsx scripts/measure-calibration.ts "D:/Projects/Ableton/EQ Calibration"
 */
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const FFT_SIZE = 16384;

function readWav(data: Buffer): { rate: number; channels: Float32Array[] } {
    let p = 12, fmt = 1, channels = 2, bits = 16, rate = 44100;
    let body: Buffer | null = null;
    while (p + 8 <= data.length) {
        const id = data.toString('ascii', p, p + 4), len = data.readUInt32LE(p + 4);
        if (id === 'fmt ') {
            fmt = data.readUInt16LE(p + 8); channels = data.readUInt16LE(p + 10);
            rate = data.readUInt32LE(p + 12); bits = data.readUInt16LE(p + 22);
            if (fmt === 0xfffe) fmt = data.readUInt16LE(p + 32);
        }
        if (id === 'data') body = data.subarray(p + 8, p + 8 + len);
        p += 8 + len + (len & 1);
    }
    if (!body) throw new Error('no audio in that wav');
    const bytes = bits / 8, frames = Math.floor(body.length / (bytes * channels));
    const out = Array.from({ length: channels }, () => new Float32Array(frames));
    for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
            const o = (i * channels + c) * bytes;
            out[c][i] = fmt === 3 ? body.readFloatLE(o)
                : bits === 16 ? body.readInt16LE(o) / 32768
                    : bits === 24 ? body.readIntLE(o, 3) / 8388608 : body.readInt32LE(o) / 2147483648;
        }
    }
    return { rate, channels: out };
}

function fft(re: Float64Array, im: Float64Array) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len) {
            for (let k = 0; k < len / 2; k++) {
                const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
                const ur = re[i + k], ui = im[i + k];
                const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
                const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
                re[i + k] = ur + vr; im[i + k] = ui + vi;
                re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
            }
        }
    }
}

/** Averaged magnitude spectrum over the steady part of the signal. */
function spectrum(x: Float32Array, rate: number): Float64Array {
    const skip = Math.floor(rate * 0.5);                 // let the first moments settle
    const usable = Math.max(0, x.length - skip - FFT_SIZE);
    const frames = Math.max(1, Math.min(60, Math.floor(usable / (FFT_SIZE / 2))));
    const acc = new Float64Array(FFT_SIZE / 2);
    for (let f = 0; f < frames; f++) {
        const re = new Float64Array(FFT_SIZE), im = new Float64Array(FFT_SIZE);
        const start = skip + f * (FFT_SIZE / 2);
        for (let i = 0; i < FFT_SIZE; i++) {
            const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));   // Hann
            re[i] = (x[start + i] ?? 0) * w;
        }
        fft(re, im);
        for (let i = 0; i < FFT_SIZE / 2; i++) acc[i] += Math.hypot(re[i], im[i]) / frames;
    }
    return acc;
}

/** The wet/dry response in dB, at 1/6-octave points. */
function response(wet: Float64Array, dry: Float64Array, rate: number): { hz: number; db: number }[] {
    const binHz = rate / FFT_SIZE;
    const out: { hz: number; db: number }[] = [];
    for (let hz = 20; hz <= 20000; hz *= 2 ** (1 / 6)) {
        // average the bins within a sixth of an octave, so noise doesn't dominate
        const lo = Math.max(1, Math.round((hz / 2 ** (1 / 12)) / binHz));
        const hi = Math.min(wet.length - 1, Math.round((hz * 2 ** (1 / 12)) / binHz));
        let w = 0, d = 0;
        for (let i = lo; i <= hi; i++) { w += wet[i] ** 2; d += dry[i] ** 2; }
        if (d > 0 && w > 0) out.push({ hz, db: 10 * Math.log10(w / d) });
    }
    return out;
}

/** Where a shelf reaches half its plateau gain — the corner frequency as a filter is specified. */
function shelfCorner(curve: { hz: number; db: number }[], low: boolean): { plateauDb: number; cornerHz: number } {
    const plateau = low
        ? curve.filter((p) => p.hz < 60).reduce((a, p) => a + p.db, 0) / Math.max(1, curve.filter((p) => p.hz < 60).length)
        : curve.filter((p) => p.hz > 12000).reduce((a, p) => a + p.db, 0) / Math.max(1, curve.filter((p) => p.hz > 12000).length);
    const half = plateau / 2;
    const ordered = low ? [...curve].reverse() : curve;
    for (let i = 1; i < ordered.length; i++) {
        const a = ordered[i - 1], b = ordered[i];
        if ((a.db - half) * (b.db - half) <= 0 && Math.abs(plateau) > 1) {
            const t = (half - a.db) / (b.db - a.db || 1e-9);
            return { plateauDb: plateau, cornerHz: a.hz * (b.hz / a.hz) ** t };
        }
    }
    return { plateauDb: plateau, cornerHz: NaN };
}

/** A bell's peak and its width in octaves at half the peak gain, which gives Q. */
function bellShape(curve: { hz: number; db: number }[]): { peakDb: number; peakHz: number; octaves: number; q: number } {
    const peak = curve.reduce((best, p) => (Math.abs(p.db) > Math.abs(best.db) ? p : best), curve[0]);
    const half = peak.db / 2;
    const edge = (dir: 1 | -1) => {
        const i0 = curve.indexOf(peak);
        for (let i = i0; i >= 0 && i < curve.length; i += dir) {
            const a = curve[i], b = curve[i + dir];
            if (!b) break;
            if ((a.db - half) * (b.db - half) <= 0) {
                const t = (half - a.db) / (b.db - a.db || 1e-9);
                return a.hz * (b.hz / a.hz) ** t;
            }
        }
        return NaN;
    };
    const lo = edge(-1), hi = edge(1);
    const octaves = Math.log2(hi / lo);
    return { peakDb: peak.db, peakHz: peak.hz, octaves, q: 1 / (2 * Math.sinh((Math.LN2 / 2) * octaves)) };
}

function main() {
    const input = process.argv[2];
    if (!input) { console.error('give me the frozen calibration project (folder or zip)'); process.exit(1); }

    // Collect the freeze renders: Live names them "Freeze <track> [date]-N.wav"
    const files: { name: string; data: Buffer }[] = [];
    if (/\.zip$/i.test(input)) {
        for (const e of new AdmZip(input).getEntries()) {
            if (/Processed[\\/]Freeze[\\/].*\.wav$/i.test(e.entryName)) files.push({ name: path.basename(e.entryName), data: e.getData() });
        }
    } else {
        const dir = fs.existsSync(path.join(input, 'Samples')) ? input : path.join(input, fs.readdirSync(input).find((d) => /Project$/i.test(d)) ?? '');
        const freezeDir = path.join(dir, 'Samples', 'Processed', 'Freeze');
        if (!fs.existsSync(freezeDir)) { console.error(`no freeze renders under ${freezeDir} — freeze the tracks in Live and save first`); process.exit(1); }
        for (const f of fs.readdirSync(freezeDir)) {
            if (/\.wav$/i.test(f)) files.push({ name: f, data: fs.readFileSync(path.join(freezeDir, f)) });
        }
    }
    if (!files.length) { console.error('no freeze renders found'); process.exit(1); }

    const track = (fileName: string) => fileName.replace(/^Freeze\s*/i, '').replace(/\s*\[[^\]]*\].*$/, '').trim();
    const rendered = files.map((f) => ({ track: track(f.name), ...readWav(f.data) }))
        .sort((a, b) => a.track.localeCompare(b.track));

    const dry = rendered.find((r) => /dry/i.test(r.track));
    if (!dry) { console.error(`no dry reference among: ${rendered.map((r) => r.track).join(', ')}`); process.exit(1); }
    const drySpectrum = spectrum(dry.channels[0], dry.rate);
    console.log(`dry reference: "${dry.track}" (${dry.rate} Hz)\n`);

    for (const r of rendered) {
        if (r === dry) continue;
        const curve = response(spectrum(r.channels[0], r.rate), drySpectrum, r.rate);
        console.log(`== ${r.track}`);
        const shown = curve.filter((_, i) => i % 3 === 0);
        console.log(`   ${shown.map((p) => `${p.hz < 1000 ? Math.round(p.hz) : `${(p.hz / 1000).toFixed(1)}k`}:${p.db.toFixed(1)}`).join('  ')}`);
        if (/low/i.test(r.track)) {
            const { plateauDb, cornerHz } = shelfCorner(curve, true);
            console.log(`   low shelf: ${plateauDb.toFixed(1)} dB plateau, corner ${cornerHz.toFixed(0)} Hz`);
        }
        if (/high [+-]/i.test(r.track)) {
            const { plateauDb, cornerHz } = shelfCorner(curve, false);
            console.log(`   high shelf: ${plateauDb.toFixed(1)} dB plateau, corner ${cornerHz.toFixed(0)} Hz`);
        }
        if (/mid/i.test(r.track)) {
            const { peakDb, peakHz, octaves, q } = bellShape(curve);
            console.log(`   bell: ${peakDb.toFixed(1)} dB at ${peakHz.toFixed(0)} Hz, ${octaves.toFixed(2)} octaves wide → Q ${q.toFixed(2)}`);
        }
        if (/highpass/i.test(r.track)) {
            const at = (hz: number) => curve.reduce((best, p) => (Math.abs(p.hz - hz) < Math.abs(best.hz - hz) ? p : best), curve[0]);
            const corner = curve.find((p) => p.db > -3.01) ?? curve[0];
            console.log(`   high-pass: -3 dB near ${corner.hz.toFixed(0)} Hz; ${at(40).db.toFixed(1)} dB at 40 Hz, ${at(80).db.toFixed(1)} dB at 80 Hz, ${at(160).db.toFixed(1)} dB at 160 Hz`);
        }
        console.log('');
    }
}

main();
