import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
for (const t of p.tracks) {
  console.log(`${t.kind} "${t.name}": automation ${t.automation.length} (${t.automation.map((a) => a.target.kind + (a.target.kind === 'plugin' ? ` ${a.target.plugin.name}/${a.target.paramName}#${a.target.param}` : '')).join(', ')}) other ${t.otherAutomation}`);
  for (const e of t.effects) if ((e as any).format === 'vst3') console.log(`    vst3 ${(e as any).name}: paramIds ${(e as any).paramIds.length} first ${(e as any).paramIds.slice(0, 6)}`);
}
