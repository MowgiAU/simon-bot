import fs from 'node:fs';
import zlib from 'node:zlib';
import { readAls } from '../src/services/projectConvert/AlsReader.js';

const p = readAls(fs.readFileSync(process.argv[2]), 'x');
const plugins: { track: string; pl: any }[] = [];
for (const t of p.tracks) {
    const i: any = t.instrument;
    if (i?.kind === 'plugin') plugins.push({ track: t.name, pl: i.plugin });
    if (i?.kind === 'layers') for (const l of i.layers) if (l.instrument.kind === 'plugin') plugins.push({ track: t.name, pl: (l.instrument as any).plugin });
    for (const e of t.effects as any[]) if (e.format !== 'live') plugins.push({ track: t.name, pl: e });
}

const dump = (b: Buffer, from: number, len: number) => {
    for (let o = from; o < Math.min(from + len, b.length); o += 32) {
        const row = b.subarray(o, o + 32);
        console.log(`  ${o.toString(16).padStart(6, '0')}  ${row.toString('hex').replace(/(.{8})/g, '$1 ')}  ${row.toString('latin1').replace(/[^ -~]/g, '.')}`);
    }
};

for (const { track, pl } of plugins.filter((x) => /kontakt/i.test(x.pl.name)).slice(0, 2)) {
    const state: Buffer = pl.processorState ?? pl.chunk ?? Buffer.alloc(0);
    console.log(`\n== ${track}: ${pl.name} ${state.length} bytes`);
    dump(state, 0, 256);
    // Anything readable anywhere? report offsets of long ASCII / UTF-16 runs
    const latin = state.toString('latin1');
    for (const m of latin.matchAll(/[ -~]{10,}/g)) console.log(`  ascii @${m.index}: ${m[0].slice(0, 120)}`);
    const u16 = state.toString('utf16le');
    for (const m of u16.matchAll(/[ -~]{6,}/g)) console.log(`  utf16 @${(m.index ?? 0) * 2}: ${m[0].slice(0, 120)}`);
    // try inflating from likely offsets
    for (let o = 0; o < Math.min(state.length, 4096); o++) {
        if (state[o] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(state[o + 1])) {
            try { const out = zlib.inflateSync(state.subarray(o)); console.log(`  zlib @${o} -> ${out.length} bytes: ${out.subarray(0, 200).toString('latin1').replace(/[^ -~]/g, '.')}`); break; } catch { /* keep looking */ }
        }
    }
}
