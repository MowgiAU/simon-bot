import fs from 'node:fs';
import zlib from 'node:zlib';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const buf = fs.readFileSync(process.argv[2]);
const p = readAls(buf);
const xml = zlib.gunzipSync(buf).toString();
console.log(`${p.source} | ${p.bpm} BPM ${p.numerator}/${p.denominator} | locators: ${p.locators.map(l => `${l.name}@bar${l.time / 4 + 1}`).join(', ')}`);
for (const t of p.tracks) {
  const inst = t.instrument ? `${t.instrument.kind}:${t.instrument.device}` : '—';
  const clips = t.clips.map(c => c.kind === 'midi' ? `midi(${c.notes.length}n${c.muted ? ',muted' : ''})` : `audio(${c.warped ? 'warp' : 'NOwarp'}${c.muted ? ',muted' : ''})`).join(' ');
  console.log(`  ${t.kind.padEnd(6)} ${t.name.padEnd(16)} vol=${t.volume.toFixed(2)} pan=${t.pan.toFixed(2)} mute=${t.muted} | inst ${inst} | fx ${t.effects.map(e => e.name).join(',') || '—'} | other ${t.devices.join(',') || '—'}\n         clips: ${clips || '—'}`);
}
const vals = (tag: string) => [...xml.matchAll(new RegExp(`<${tag}>\s*(?:<LomId[^>]*>\s*)?<Manual Value="([^"]*)"`, 'g'))].map(m => m[1]);
const count = (re: RegExp) => (xml.match(re) || []).length;
console.log('\nsends (non-min):', [...xml.matchAll(/<TrackSendHolder Id="\d+">\s*<Send>\s*<LomId[^>]*>\s*<Manual Value="([^"]*)"/g)].map(m => +m[1]).filter(v => v > 0.001).map(v => (20 * Math.log10(v)).toFixed(1) + 'dB').join(', '));
console.log('return pre/post (SendsPre):', [...xml.matchAll(/<SendPreBool Id="\d+" Value="(\w+)"/g)].map(m => m[1]).join(','), '| alt:', [...xml.matchAll(/<SendsPre>([\s\S]*?)<\/SendsPre>/g)].map(m => m[1].replace(/\s+/g, ' ').slice(0, 120)).join(' ; '));
console.log('choke groups:', [...xml.matchAll(/<ChokeGroup Value="(\d+)"/g)].map(m => m[1]).join(','));
console.log('simpler playback modes:', [...xml.matchAll(/<Globals>[\s\S]*?<PlaybackMode Value="(\d)"/g)].map(m => m[1]).join(','));
console.log('audio clips: warp', [...xml.matchAll(/<AudioClip[\s\S]*?<IsWarped Value="(\w+)"/g)].map(m => m[1]).join(','), '| pitch', [...xml.matchAll(/<PitchCoarse Value="(-?\d+)"/g)].map(m => m[1]).join(','), '| fadeIn', [...xml.matchAll(/<FadeInLength Value="([^"]*)"/g)].map(m => (+m[1]).toFixed(2)).join(','), '| reversed', count(/<IsReversed Value="true"/g) || [...xml.matchAll(/<SampleRef>[\s\S]{0,50}/g)].length && [...xml.matchAll(/Reverse[A-Za-z]* Value="true"/g)].map(m => m[0]).join(','));
console.log('clip loops on:', count(/<LoopOn Value="true"/g), '| disabled clips:', count(/<Disabled Value="true"/g));
console.log('tempo automation events:', (() => { const m = xml.match(/<Tempo>[\s\S]*?<AutomationTarget Id="(\d+)"/); if (!m) return 'n/a'; const id = m[1]; const env = xml.match(new RegExp(`<PointeeId Value="${id}" />[\s\S]*?<Events>([\s\S]*?)</Events>`)); return env ? [...env[1].matchAll(/<FloatEvent[^>]*Time="([^"]*)"[^>]*Value="([^"]*)"/g)].map(e => `${(+e[1] / 4 + 1).toFixed(2)}:${(+e[2]).toFixed(0)}`).join(' ') : 'none'; })());
console.log('time signatures:', [...xml.matchAll(/<RemoteableTimeSignature Id="\d+">\s*<Numerator Value="(\d+)" \/>\s*<Denominator Value="(\d+)" \/>\s*<Time Value="([^"]*)"/g)].map(m => `${m[1]}/${m[2]}@${m[3]}`).slice(0, 8).join(', '));
console.log('clip envelopes (pitch bend etc):', count(/<ClipEnvelope Id/g), '| sidechain on:', [...xml.matchAll(/<SideChain>[\s\S]*?<OnOff>[\s\S]*?<Manual Value="(\w+)"/g)].map(m => m[1]).join(','));
console.log('plugins off (On=false):', [...xml.matchAll(/<PluginDevice Id="\d+">[\s\S]*?<On>\s*<LomId[^>]*>\s*<Manual Value="(\w+)"/g)].map(m => m[1]).join(','));
