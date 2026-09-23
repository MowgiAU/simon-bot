import fs from 'node:fs';
const x = fs.readFileSync(process.argv[2], 'utf8');
// OTT's "Out Gain" (id 3): find its AutomationTarget id, and the track it sits on
const i = x.indexOf('<ParameterName Value="Out Gain" />');
if (i < 0) { console.log('not found'); process.exit(1); }
const block = x.slice(i, i + 1200);
console.log('automation target:', block.match(/<AutomationTarget Id="(\d+)">/)?.[1], '| param id:', block.match(/<ParameterId Value="(-?\d+)"/)?.[1]);
const before = x.slice(0, i);
console.log('track:', [...before.matchAll(/<(MidiTrack|AudioTrack) Id="(\d+)"/g)].pop()?.[0]);
console.log('has AutomationEnvelopes after track start:', before.lastIndexOf('<AutomationEnvelopes>') > 0);
