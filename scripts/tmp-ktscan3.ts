import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
for (const t of p.tracks) {
    const i: any = t.instrument;
    const pl = i?.kind === 'plugin' ? i.plugin : null;
    if (!pl || !/kontakt/i.test(pl.name)) continue;
    const c: Buffer = pl.controllerState ?? Buffer.alloc(0);
    console.log(`\n== ${t.name}: controller ${c.length} bytes`);
    for (const off of [0, 1]) for (const m of c.subarray(off).toString('utf16le').matchAll(/[ -~]{4,200}/g)) console.log(`  u16@${(m.index ?? 0) * 2 + off}: ${m[0]}`);
    for (const m of c.toString('latin1').matchAll(/[ -~]{6,200}/g)) console.log(`  ascii@${m.index}: ${m[0]}`);
}
