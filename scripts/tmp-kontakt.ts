import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
import { writeFlp, CHANNEL_SAMPLER } from '../src/services/projectConvert/FlpWriter.js';
import { vst3ClassId } from '../src/services/projectConvert/FlVst.js';
const DIR = 'C:/Users/te198/AppData/Local/Temp/claude/H--Simon-Bot-new-simon/8321b79f-c347-4df4-83e7-863adcf0f3b6/scratchpad/render';
const project = readAls(fs.readFileSync(process.argv[2]), 'k');
const track = project.tracks.find((t) => t.instrument?.kind === 'plugin' && /Kontakt/i.test((t.instrument as any).plugin.name))!;
const p: any = (track.instrument as any).plugin;
const notes = (track.clips.find((c) => c.kind === 'midi') as any)?.notes ?? [];
console.log('Kontakt state', p.processorState.length, 'notes', notes.length);
const build = (name: string, paramIds: number[] | undefined, index: number | null) => {
  const flp = path.join(DIR, `${name}.flp`);
  fs.writeFileSync(flp, writeFlp({
    title: name, bpm: 120, numerator: 4, denominator: 4,
    channels: [
      { name: 'Kontakt', color: null, type: CHANNEL_SAMPLER, insert: 0, plugin: { format: 'vst3', name: p.name, kind: 'generator', path: 'C:\Program Files\Common Files\VST3\Kontakt 8.vst3', classId: vst3ClassId(p.classId), processorState: p.processorState, controllerState: p.controllerState, paramIds } },
      ...(index === null ? [] : [{ name: 'auto', color: null, type: CHANNEL_SAMPLER, insert: 0, automation: [{ time: 0, value: 1 }, { time: 16, value: 0 }] }]),
    ],
    patterns: [{ name: 'p', color: null, notes: [0, 4, 8, 12].map((pos) => ({ channel: 0, pos, length: 3.5, key: 60, velocity: 100 })) }],
    items: [{ kind: 'pattern', pattern: 1, track: 0, start: 0, length: 16 }, ...(index === null ? [] : [{ kind: 'automation', channel: 1, track: 1, start: 0, length: 16 }])],
    tracks: [{ name: 'k', color: null }, { name: 'a', color: null }], markers: [], signatures: [], insertEffects: [], inserts: [],
    automationTargets: index === null ? [] : [{ channel: 1, param: 0x8000 + index, dest: 0 }],
  } as any));
  const wav = path.join(DIR, `${name}.wav`);
  if (fs.existsSync(wav)) fs.unlinkSync(wav);
  try { execFileSync('C:/Program Files/Image-Line/FL Studio 21/FL64.exe', ['/R', '/Ewav', path.win32.normalize(flp)], { timeout: 240000 }); } catch { try { execFileSync('taskkill', ['/F', '/IM', 'FL64.exe']); } catch {} }
  console.log(name, fs.existsSync(wav) ? `rendered ${(fs.statSync(wav).size / 1048576).toFixed(1)} MB` : 'NO RENDER');
};
build('kt_plain', undefined, null);              // no list, no automation: does it still load?
build('kt_short', [0, 1, 2, 3], 0);              // short list + automation on its first id
