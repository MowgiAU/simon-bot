import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
for (const t of p.tracks) {
    const i: any = t.instrument;
    if (i?.kind === 'plugin' && /kontakt/i.test(i.plugin.name)) {
        console.log(`${t.name}: label=${i.plugin.label ?? '-'} devices=[${t.devices.join(', ')}] clips=[${t.clips.slice(0, 3).map((c) => c.name).join(', ')}]`);
    }
}
