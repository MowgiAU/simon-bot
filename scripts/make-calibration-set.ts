/**
 * Builds an Ableton Live set for measuring one of Live's own devices.
 *
 * Live has no command-line render, so the way to get its DSP offline is to freeze: each track
 * carries the same noise clip through one device at a known setting, and freezing renders it.
 * Open the generated set, select all the tracks, Freeze, save, and the renders land in
 * Samples/Processed/Freeze — from there measure-calibration.ts turns them into tables.
 *
 *   npx tsx scripts/make-calibration-set.ts "D:/Projects/Ableton/EQ Calibration"
 *
 * The set is made by surgery on a real Live set (tracks cloned, ids renumbered, device settings
 * replaced), so the file is one Live itself wrote rather than one invented here.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';

const BASE_SET = 'D:/Projects/Ableton/Converter Test/Converter Test Project/Converter Test.als';
const DEVICE_SOURCE = 'D:/Projects/Ableton/Freeze/freeze Project.zip';   // holds a Channel EQ to clone
const SR = 48000;
const NOISE_SECONDS = 12;

/** One track in the set: a name, and the device settings to measure (none = the dry reference). */
interface Measurement { name: string; params?: Record<string, string> }

const db = (x: number) => (10 ** (x / 20)).toFixed(7);

/** Channel EQ: each band measured on its own, so its corner, slope and Q can be read off. */
const CHANNEL_EQ: Measurement[] = [
    { name: '01 dry' },
    { name: '02 low +12', params: { LowShelfGain: db(12) } },
    { name: '03 low -12', params: { LowShelfGain: db(-12) } },
    { name: '04 high +12', params: { HighShelfGain: db(12) } },
    { name: '05 high -12', params: { HighShelfGain: db(-12) } },
    { name: '06 mid +12 @1k', params: { MidGain: db(12), MidFrequency: '1000' } },
    { name: '07 mid +12 @200', params: { MidGain: db(12), MidFrequency: '200' } },
    { name: '08 mid +12 @5k', params: { MidGain: db(12), MidFrequency: '5000' } },
    { name: '09 mid -12 @1k', params: { MidGain: db(-12), MidFrequency: '1000' } },
    { name: '10 highpass on', params: { HighpassOn: 'true' } },
];

function noiseWav(file: string) {
    const frames = SR * NOISE_SECONDS;
    const b = Buffer.alloc(44 + frames * 4);
    b.write('RIFF', 0); b.writeUInt32LE(36 + frames * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28);
    b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(frames * 4, 40);
    // The same noise in both channels, at a level with plenty of headroom for a +12 dB boost
    let seed = 12345;
    for (let i = 0; i < frames; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const v = Math.round(((seed / 0x7fffffff) * 2 - 1) * 0.15 * 32767);
        b.writeInt16LE(v, 44 + i * 4);
        b.writeInt16LE(v, 46 + i * 4);
    }
    fs.writeFileSync(file, b);
}

function readXml(file: string): string {
    const raw = /\.zip$/i.test(file)
        ? new AdmZip(file).getEntries().find((e) => /\.als$/i.test(e.entryName) && !/backup/i.test(e.entryName))!.getData()
        : fs.readFileSync(file);
    return zlib.gunzipSync(raw).toString('utf8');
}

/** The XML of one element, from its opening tag to its closing tag. */
function element(xml: string, tag: string, from = 0): string {
    const start = xml.indexOf(`<${tag} `, from);
    if (start < 0) throw new Error(`no <${tag}> in the source set`);
    const end = xml.indexOf(`</${tag}>`, start);
    return xml.slice(start, end + tag.length + 3);
}

/** Renumbers every id inside a cloned track so it can't collide with another clone's. */
const renumber = (block: string, offset: number) =>
    block.replace(/Id="(\d+)"/g, (_, id) => `Id="${Number(id) + offset}"`);

/**
 * Sets <Param>…<Manual Value="…"/>…</Param> inside a device block. The element is found by its
 * own open and close tags, so the value can't land in a later parameter's Manual.
 */
function setParam(block: string, param: string, value: string): string {
    const open = block.indexOf(`<${param}>`);
    const close = block.indexOf(`</${param}>`, open);
    if (open < 0 || close < 0) throw new Error(`device has no parameter ${param}`);
    const inner = block.slice(open, close);
    if (!/<Manual Value="/.test(inner)) throw new Error(`parameter ${param} has no value to set`);
    return block.slice(0, open) + inner.replace(/(<Manual Value=")[^"]*(")/, `$1${value}$2`) + block.slice(close);
}

function main() {
    const outDir = process.argv[2] ?? 'D:/Projects/Ableton/EQ Calibration';
    const projectDir = path.join(outDir, 'EQ Calibration Project');
    const samplesDir = path.join(projectDir, 'Samples', 'Imported');
    fs.mkdirSync(samplesDir, { recursive: true });

    const noisePath = path.join(samplesDir, 'calibration noise.wav');
    noiseWav(noisePath);

    const base = readXml(BASE_SET);
    const trackTemplate = element(base, 'AudioTrack');
    const device = element(readXml(DEVICE_SOURCE), 'ChannelEq');

    const bpm = Number(/<Tempo>[\s\S]*?<Manual Value="([^"]+)"/.exec(base)?.[1] ?? 120);
    const beats = Math.ceil(NOISE_SECONDS * (bpm / 60)) + 2;   // a little past the end of the noise
    const tracks = CHANNEL_EQ.map((m, i) => {
        let track = renumber(trackTemplate, 1000 * (i + 1));
        // Name it, point its clip at the noise, and play the file as it is
        track = track.replace(/<EffectiveName Value="[^"]*"/, `<EffectiveName Value="${m.name}"`)
            .replace(/<UserName Value="[^"]*"/, `<UserName Value="${m.name}"`)
            .replace(/<RelativePath Value="[^"]*"/g, '<RelativePath Value="Samples/Imported/calibration noise.wav"')
            .replace(/<Path Value="[^"]*"/g, `<Path Value="${path.join(samplesDir, 'calibration noise.wav').replace(/\\/g, '/')}"`)
            .replace(/<IsWarped Value="true"/g, '<IsWarped Value="false"')
            .replace(/<CurrentEnd Value="[^"]*"/g, `<CurrentEnd Value="${beats}"`)
            .replace(/<CurrentStart Value="[^"]*"/g, '<CurrentStart Value="0"');

        // The device under test, or nothing at all for the dry reference
        let deviceXml = '';
        if (m.params) {
            deviceXml = renumber(device, 1000 * (i + 1));
            for (const [param, value] of Object.entries(m.params)) deviceXml = setParam(deviceXml, param, value);
        }
        // An audio track with no devices writes <Devices />, so both shapes are handled
        return track.replace(/<Devices\s*\/>|<Devices>[\s\S]*?<\/Devices>/, `<Devices>${deviceXml}</Devices>`);
    });

    // Replace the set's tracks with ours, and leave its returns and main track alone
    const tracksStart = base.indexOf('<Tracks>');
    const tracksEnd = base.indexOf('</Tracks>') + '</Tracks>'.length;
    // No returns: a send would colour the measurement, and their plugins would have to be installed
    const out = `${base.slice(0, tracksStart)}<Tracks>${tracks.join('')}</Tracks>${base.slice(tracksEnd)}`
        // Keep Live from handing out ids our clones already used
        .replace(/<NextPointeeId Value="\d+"/, '<NextPointeeId Value="900000"');

    const alsPath = path.join(projectDir, 'EQ Calibration.als');
    fs.writeFileSync(alsPath, zlib.gzipSync(Buffer.from(out, 'utf8')));
    console.log(`${alsPath}\n  ${tracks.length} tracks, ${NOISE_SECONDS}s of noise, ${(fs.statSync(alsPath).size / 1024).toFixed(0)} KB`);
    for (const m of CHANNEL_EQ) console.log(`   ${m.name}${m.params ? `: ${Object.entries(m.params).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`);
}

main();
