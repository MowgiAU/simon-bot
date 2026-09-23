import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
for (const t of p.tracks) {
    const i: any = t.instrument;
    const pl = i?.kind === 'plugin' ? i.plugin : null;
    if (!pl || !/kontakt/i.test(pl.name)) continue;
    const s: Buffer = pl.processorState;
    const hits: string[] = [];
    for (const off of [0, 1]) {
        const u16 = s.subarray(off).toString('utf16le');
        for (const m of u16.matchAll(/[ -~]{4,200}/g)) hits.push(`u16+${off}@${(m.index ?? 0) * 2 + off}: ${m[0]}`);
    }
    console.log(`\n== ${t.name} (${s.length} bytes) — ${hits.length} utf16 runs`);
    console.log(hits.slice(0, 60).join('\n'));
}
