import fs from 'node:fs';
import zlib from 'node:zlib';
const [src, out, targetId] = process.argv.slice(2);
let x = zlib.gunzipSync(fs.readFileSync(src)).toString('utf8');
// Put a ramp on the given automation target, in the track that owns it
const i = x.indexOf(`<AutomationTarget Id="${targetId}">`);
if (i < 0) throw new Error('target not found');
const trackStart = Math.max(x.lastIndexOf('<MidiTrack Id=', i), x.lastIndexOf('<AudioTrack Id=', i));
const envs = x.indexOf('<AutomationEnvelopes>', trackStart);
// An empty track automation section is written as a self-closing <Envelopes />
const selfClosing = /<AutomationEnvelopes>\s*<Envelopes\s*\/>/.exec(x.slice(envs, envs + 200));
if (selfClosing) x = x.slice(0, envs) + x.slice(envs).replace(/<Envelopes\s*\/>/, '<Envelopes></Envelopes>');
const open = x.indexOf('<Envelopes>', envs);
const env = `<AutomationEnvelope Id="900"><EnvelopeTarget><PointeeId Value="${targetId}" /></EnvelopeTarget><Automation><Events>`
  + `<FloatEvent Id="9100" Time="-63072000" Value="0" /><FloatEvent Id="9101" Time="8" Value="0" /><FloatEvent Id="9102" Time="24" Value="1" />`
  + `</Events><AutomationTransformViewState><IsTransformPending Value="false" /><TimeAndValueTransforms /></AutomationTransformViewState></Automation></AutomationEnvelope>`;
x = x.slice(0, open + '<Envelopes>'.length) + env + x.slice(open + '<Envelopes>'.length);
fs.writeFileSync(out, zlib.gzipSync(Buffer.from(x, 'utf8')));
console.log('wrote', out, '| envelope inserted at', open);
