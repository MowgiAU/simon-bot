import fs from 'node:fs';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const p = readAls(fs.readFileSync(process.argv[2]), 'x');
for (const t of p.tracks) {
  const i: any = t.instrument;
  const pl = i?.kind === 'plugin' ? i.plugin : null;
  if (pl && /kontakt/i.test(pl.name)) {
    console.log(`${t.name}: processor ${pl.processorState.length}, controller ${pl.controllerState.length}, paramIds ${pl.paramIds.length}`);
  }
}
