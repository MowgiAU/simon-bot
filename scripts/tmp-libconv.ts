import fs from 'node:fs';
import path from 'node:path';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const root = 'C:/ProgramData/Ableton/Live 12 Suite/Resources/Core Library', out = process.argv[2];
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.als') ? [path.join(d, e.name)] : []);
const tally = new Map<string, number>(); let skipped = 0;
for (const f of walk(root)) {
  try {
    const name = path.basename(f, '.als').replace(/[^a-z0-9]+/gi, '_');
    const r = convertAlsToFlp(fs.readFileSync(f), { projectName: name });
    fs.writeFileSync(path.join(out, `${name}.flp`), r.flp);
    for (const line of r.report.converted) for (const m of line.matchAll(/\(as ([^)]+)\)/g)) tally.set(m[1], (tally.get(m[1]) ?? 0) + 1);
    for (const w of r.report.warnings) if (/devices not converted/.test(w)) skipped++;
  } catch (e: any) { console.log('FAIL', f, e.message); }
}
console.log([...tally].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} × ${k}`).join('\n'), '\ntracks with unconverted devices:', skipped);
