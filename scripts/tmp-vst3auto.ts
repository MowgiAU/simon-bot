import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
import { writeFlp, CHANNEL_AUDIO_CLIP, CHANNEL_SAMPLER } from '../src/services/projectConvert/FlpWriter.js';
import { vst3ClassId } from '../src/services/projectConvert/FlVst.js';
const DIR = 'C:/Users/te198/AppData/Local/Temp/claude/H--Simon-Bot-new-simon/8321b79f-c347-4df4-83e7-863adcf0f3b6/scratchpad/render';
const project = readAls(fs.readFileSync(process.argv[2]), 'x');
let ott: any = null;
for (const t of project.tracks) for (const e of t.effects) if ((e as any).name === 'OTT') ott = e;
if (!ott) { console.log('no OTT found'); process.exit(1); }
const build = (name: string, paramIds: number[] | undefined, index: number) => {
  const flp = path.join(DIR, `${name}.flp`);
  fs.writeFileSync(flp, writeFlp({
    title: name, bpm: 120, numerator: 4, denominator: 4,
    channels: [
      { name: 'sig', color: null, type: CHANNEL_AUDIO_CLIP, insert: 1, samplePath: path.win32.normalize(path.join(DIR, 'noise.wav')) },
      { name: 'p', color: null, type: CHANNEL_SAMPLER, insert: 0, automation: [{ time: 0, value: 0 }, { time: 8, value: 1 }] },
    ],
    patterns: [], items: [{ kind: 'audio', channel: 0, track: 0, start: 0, length: 8, offset: 0 }, { kind: 'automation', channel: 1, track: 1, start: 0, length: 8 }],
    tracks: [{ name: 'sig', color: null }, { name: 'p', color: null }], markers: [], signatures: [],
    insertEffects: [{ insert: 1, plugins: [{ format: 'vst3', name: ott.name, kind: 'effect', path: `C:\Program Files\Common Files\VST3\${ott.name}.vst3`, classId: vst3ClassId(ott.classId), processorState: ott.processorState, controllerState: ott.controllerState, paramIds }] }],
    inserts: [{ insert: 1, name: 'fx', color: null, routes: [{ to: 0 }] }],
    automationTargets: [{ channel: 1, param: 0x8000 + index, dest: 0x2000 + 64 }],
  } as any));
  const wav = path.join(DIR, `${name}.wav`);
  if (fs.existsSync(wav)) fs.unlinkSync(wav);
  try { execFileSync('C:/Program Files/Image-Line/FL Studio 21/FL64.exe', ['/R', '/Ewav', path.win32.normalize(flp)], { timeout: 180000 }); } catch { try { execFileSync('taskkill', ['/F', '/IM', 'FL64.exe']); } catch {} }
  return wav;
};
const ids = Array.from({ length: 21 }, (_, i) => i);
const permuted = [3, 0, 1, 2, ...ids.slice(4)];
console.log('A (no list, index 3):', build('ott_a', undefined, 3));
console.log('B (permuted list, index 0):', build('ott_b', permuted, 0));
console.log('C (permuted list, index 3):', build('ott_c', permuted, 3));
