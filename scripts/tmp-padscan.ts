import fs from 'node:fs';
import path from 'node:path';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const root = 'C:/ProgramData/Ableton/Live 12 Suite/Resources/Core Library';
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.als') ? [path.join(d, e.name)] : []);
for (const f of walk(root)) {
  const r = convertAlsToFlp(fs.readFileSync(f), {});
  const lines = [...r.report.converted, ...r.report.warnings].filter((l) => l.includes('›') || /Drum (pads|Rack return)/.test(l));
  if (lines.length) console.log('== ' + path.basename(f) + '\n' + lines.map((l) => '   ' + l).join('\n'));
}
