import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
const plugins: any[] = [];
for (const t of p.tracks) {
  const i: any = t.instrument;
  if (i?.kind === 'plugin') plugins.push({ track: t.name, ...i.plugin });
  if (i?.kind === 'layers') for (const l of i.layers) if (l.instrument.kind === 'plugin') plugins.push({ track: t.name, ...(l.instrument as any).plugin });
  for (const e of t.effects) if ((e as any).format !== 'live') plugins.push({ track: t.name, ...(e as any) });
}
for (const pl of plugins.filter((x) => /kontakt/i.test(x.name))) {
  const state: Buffer = pl.processorState ?? pl.chunk ?? Buffer.alloc(0);
  console.log(`\n== ${pl.track}: ${pl.name} (${pl.format}) state ${state.length} bytes`);
  const txt = state.toString('latin1');
  const paths = [...new Set([...txt.matchAll(/[A-Za-z]:\[^\0"<>|]{4,120}|\/Volumes\/[^\0"<>|]{4,120}/g)].map((m) => m[0]))];
  const nki = [...new Set([...txt.matchAll(/[^\0"<>|\/]{3,60}\.(nki|nkm|nkx|nkc|nkr)/gi)].map((m) => m[0]))];
  console.log('  file paths:', paths.slice(0, 6).join(' | ') || '(none)');
  console.log('  instrument files:', nki.slice(0, 8).join(' | ') || '(none)');
}
