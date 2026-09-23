import fs from 'node:fs';
import zlib from 'node:zlib';
const [src, out] = process.argv.slice(2);
let x = zlib.gunzipSync(fs.readFileSync(src)).toString('utf8');
const t0 = x.indexOf('<AudioTrack Id="27"'); const t1 = x.indexOf('</AudioTrack>', t0);
const track = x.slice(t0, t1);
const c0 = track.indexOf('<AudioClip '); const c1 = track.indexOf('</AudioClip>', c0);
const clip = track.slice(c0, c1);
const m = clip.match(/<Envelopes>\s*<Envelopes\s*\/>\s*<\/Envelopes>/);
console.log('clip start', clip.match(/<CurrentStart Value="([^"]+)"/)?.[1], 'end', clip.match(/<CurrentEnd Value="([^"]+)"/)?.[1], 'warped', clip.match(/<IsWarped Value="([^"]+)"/)?.[1], 'empty envelopes:', !!m);
if (!m) process.exit(1);
const ev = (id: number, t: number, v: number) => `<FloatEvent Id="${id}" Time="${t}" Value="${v}" />`;
const env = (id: number, pointee: number, events: string) => `<ClipEnvelope Id="${id}"><EnvelopeTarget><PointeeId Value="${pointee}" /></EnvelopeTarget><Automation><Events>${events}</Events><AutomationTransformViewState><IsTransformPending Value="false" /><TimeAndValueTransforms /></AutomationTransformViewState></Automation><LoopSlot><Value /></LoopSlot><ScrollerTimePreserver><LeftTime Value="0" /><RightTime Value="0" /></ScrollerTimePreserver></ClipEnvelope>`;
// Volume modulation: unchanged, silent for content beats 1–2, unchanged again. Pan (set): centre → hard left at beat 4 → centre at 6
const vol = env(0, 28236, ev(9001, -63072000, 1) + ev(9002, 0, 1) + ev(9003, 1, 1) + ev(9004, 1, -1) + ev(9005, 2, -1) + ev(9006, 2, 1));
const pan = env(1, 28229, ev(9011, -63072000, 0) + ev(9012, 0, 0) + ev(9013, 4, -1) + ev(9014, 6, 0));
const newClip = clip.replace(m[0], `<Envelopes><Envelopes>${vol}${pan}</Envelopes></Envelopes>`);
x = x.slice(0, t0) + track.slice(0, c0) + newClip + track.slice(c1) + x.slice(t1);
// mute every other track so a render holds only this clip
// (each other track's own mixer speaker: the first <Speaker> after the track's <Mixer>)
for (const tag of ['MidiTrack', 'AudioTrack', 'GroupTrack']) {
  let from = 0;
  for (;;) {
    const a = x.indexOf(`<${tag} Id="`, from); if (a < 0) break;
    const b = x.indexOf(`</${tag}>`, a); from = b;
    if (x.startsWith('<AudioTrack Id="27"', a)) continue;
    const mixer = x.lastIndexOf('<Mixer>', b); if (mixer < a) continue;
    const sp = x.indexOf('<Speaker>', mixer); const man = x.indexOf('<Manual Value="true" />', sp);
    if (sp < 0 || man < 0 || man > b || man - sp > 200) continue;
    x = x.slice(0, man) + '<Manual Value="false" />' + x.slice(man + '<Manual Value="true" />'.length);
  }
}
fs.writeFileSync(out, zlib.gzipSync(Buffer.from(x, 'utf8')));
console.log('wrote', out);
