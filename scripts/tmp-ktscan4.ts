import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const needles: Record<string, string> = {
    'APPEX JDX': '9349BC42DF3B4647C70E3F1A33AE2085202B00FE6A391FE4D2A9432172D1C41B',
    'APPEX HU': '227A68BBFBB36039F3BF5A8B60EF4790',
};
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
for (const t of p.tracks) {
    const i: any = t.instrument;
    const pl = i?.kind === 'plugin' ? i.plugin : null;
    if (!pl || !/kontakt/i.test(pl.name)) continue;
    const s: Buffer = pl.processorState;
    const hits: string[] = [];
    for (const [name, hex] of Object.entries(needles)) {
        const raw = Buffer.from(hex, 'hex');
        for (const form of [['raw', raw], ['hex-ascii', Buffer.from(hex, 'latin1')], ['hex-lower', Buffer.from(hex.toLowerCase(), 'latin1')], ['hex-utf16', Buffer.from(hex, 'utf16le')]] as [string, Buffer][]) {
            const at = s.indexOf(form[1]);
            if (at >= 0) hits.push(`${name} as ${form[0]} @${at}`);
        }
    }
    console.log(`${t.name}: ${hits.join(', ') || 'no match'}`);
}
