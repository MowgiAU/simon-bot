import fs from 'node:fs';
import path from 'node:path';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
import { writeFlp, CHANNEL_SAMPLER } from '../src/services/projectConvert/FlpWriter.js';
import { vst3ClassId } from '../src/services/projectConvert/FlVst.js';
const [als, out, want] = process.argv.slice(2);
const project = readAls(fs.readFileSync(als), 'vst3 test');
const track = project.tracks.find((t) => t.instrument?.kind === 'plugin' && new RegExp(want).test((t.instrument as any).plugin.name));
const p: any = (track!.instrument as any).plugin;
console.log('plugin', p.name, 'state', p.processorState.length, 'targets', Object.entries(p.paramTargets).slice(0, 4));
// Identity list of 30 ids: if FL keeps it, an automation link's index is our own numbering
const paramIds = Array.from({ length: 30 }, (_, i) => i);
fs.writeFileSync(out, writeFlp({
  title: 'vst3 test', bpm: 120, numerator: 4, denominator: 4,
  channels: [
    { name: p.name, color: null, type: CHANNEL_SAMPLER, insert: 0, plugin: { format: 'vst3', name: p.name, kind: 'generator', path: `C:\Program Files\Common Files\VST3\${p.name}.vst3`, classId: vst3ClassId(p.classId), processorState: p.processorState, controllerState: p.controllerState, paramIds } },
    { name: 'Param', color: null, type: CHANNEL_SAMPLER, insert: 0, automation: [{ time: 0, value: 0.1 }, { time: 8, value: 0.9 }] },
  ],
  patterns: [], items: [{ kind: 'automation', channel: 1, track: 0, start: 0, length: 8 }],
  tracks: [{ name: 'auto', color: null }], markers: [], signatures: [], insertEffects: [], inserts: [],
  automationTargets: [{ channel: 1, param: 0x8000 + 3, dest: 0 }],
} as any));
console.log('wrote', out);
