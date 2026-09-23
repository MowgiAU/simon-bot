import fs from 'node:fs';
import path from 'node:path';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const root = 'C:/ProgramData/Ableton/Live 12 Suite/Resources/Core Library';
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.als') ? [path.join(d, e.name)] : []);
for (const f of walk(root)) {
  try { const r = convertAlsToFlp(fs.readFileSync(f), {}); const l = r.report.converted.filter((x) => /several samples|sample zone/.test(x)); if (l.length) console.log(path.basename(f), '\n   ' + l.join('\n   ')); }
  catch (e: any) { console.log('FAIL', f, e.message); }
}
