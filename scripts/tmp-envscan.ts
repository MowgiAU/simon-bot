import fs from 'node:fs';
import path from 'node:path';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const files = process.argv.slice(2).flatMap((d) => fs.statSync(d).isDirectory() ? (function walk(x: string): string[] { return fs.readdirSync(x, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(x, e.name)) : e.name.endsWith('.als') ? [path.join(x, e.name)] : []); })(d) : [d]);
for (const f of files) {
  try {
    const r = convertAlsToFlp(fs.readFileSync(f), {});
    const env = r.project.tracks.flatMap((t) => t.clipEnvelopes.map((e) => `${t.name}: ${e.target.kind}${e.target.kind === 'send' ? e.target.index : ''} ${e.mode} @${e.start.toFixed(0)}-${e.end.toFixed(0)} (${e.points.length} pts)`));
    if (env.length) console.log('== ' + path.basename(f) + '\n   ' + env.slice(0, 6).join('\n   '));
  } catch (e: any) { console.log('FAIL', path.basename(f), e.message); }
}
