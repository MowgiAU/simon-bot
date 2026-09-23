import fs from 'node:fs';
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';
import { LIVE_EFFECTS } from '../src/services/projectConvert/LiveEffects.js';
const counts = new Map<string, number>();
for (const f of process.argv.slice(2)) {
    let xml: string;
    if (/\.zip$/i.test(f)) {
        const e = new AdmZip(f).getEntries().find((x) => /\.als$/i.test(x.entryName) && !/backup/i.test(x.entryName));
        if (!e) continue;
        xml = zlib.gunzipSync(e.getData()).toString('utf8');
    } else xml = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8');
    for (const m of xml.matchAll(/<([A-Za-z][A-Za-z0-9]*) Id="\d+">/g)) {
        const tag = m[1];
        if (LIVE_EFFECTS.has(tag)) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
}
// Live's audio/midi devices look like these; ignore the XML scaffolding
const DEVICEISH = /^(MultibandDynamics|DrumBuss|Pedal|AmpDevice|Cabinet|Corpus|Resonator|Vocoder|Phaser|Flanger|PhaserNew|Redux2?|Erosion|Gate|ChannelEq|FilterEQ3|BeatRepeat|GrainDelay|FrequencyShifter|Spectral\w*|HybridReverb|Roar|Shifter|Tuner|Spectrum|Compressor|Saturator|Overdrive|Chorus\d?|AutoPan\d?|LFO|Looper|Utility|DrumRack|InstrumentGroupDevice|AudioEffectGroupDevice|MidiEffectGroupDevice|Operator|InstrumentVector|UltraAnalog|Collision|Tension|Sampler|Simpler|InstrumentImpulse|Meld|DrumSampler|MidiArpeggiator|MidiChord|MidiPitcher|MidiScale|MidiVelocity|MidiRandom|MidiNoteLength|StereoGain)$/;
const rows = [...counts].filter(([t]) => DEVICEISH.test(t)).sort((a, b) => b[1] - a[1]);
console.log(rows.map(([t, n]) => `${t}:${n}`).join('  ') || '(none)');
