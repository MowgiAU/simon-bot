/**
 * AlsReader — reads an Ableton Live Set (.als) into the DAW-neutral ConvProject model.
 *
 * Unlike AlsParser (which only extracts what the project viewer draws), this reads
 * everything the converter needs: notes, loop settings, sample references, mixer state.
 *
 * Live arrangement clip anatomy (Live 10–12):
 *   <MidiClip Time=arrangementStart>
 *     <CurrentStart/CurrentEnd>  arrangement span (beats)
 *     <Loop> LoopStart/LoopEnd (content loop region), StartRelative (start marker
 *            offset from LoopStart), LoopOn
 *     <Notes><KeyTracks><KeyTrack><Notes><MidiNoteEvent Time Duration Velocity IsEnabled/>
 *            <MidiKey Value=pitch/>
 *   Audio clips live under MainSequencer.Sample.ArrangerAutomation (Live 11+) or
 *   MainSequencer.ClipTimeable.ArrangerAutomation (older), with a <SampleRef><FileRef>.
 */
import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import type {
    ConvAudioClip, ConvClip, ConvInstrument, ConvMidiClip, ConvNote, ConvPlugin, ConvProject, ConvSampleRef, ConvSamplerZone, ConvTrack,
} from './types.js';

// Live's clip/track colour palette (first 28 entries; later indices wrap).
const LIVE_COLORS = [
    '#FF94A6', '#FFA529', '#CC9927', '#F7F47C', '#BFFB00', '#1AFF2F', '#25FFA8', '#5CFFE8',
    '#8BC5FF', '#5480E4', '#92A7FF', '#D86CE4', '#E553A0', '#FFFFFF', '#FF3636', '#F66C03',
    '#99724B', '#FFF034', '#87FF67', '#3DC300', '#00BFAF', '#19E9FF', '#10A4EE', '#007DC0',
    '#886CE4', '#B677C6', '#FF39D4', '#D0D0D0',
];

const TRACK_TYPES: Record<string, ConvTrack['kind']> = {
    MidiTrack: 'midi', AudioTrack: 'audio', GroupTrack: 'group', ReturnTrack: 'return',
};

const ARRAY_TAGS = new Set([
    'MidiTrack', 'AudioTrack', 'GroupTrack', 'ReturnTrack',
    'MidiClip', 'AudioClip', 'KeyTrack', 'MidiNoteEvent', 'Locator', 'WarpMarker',
    'DrumBranch', 'InstrumentBranch', 'MultiSamplePart',
]);

function val(node: any): string | undefined {
    if (node == null) return undefined;
    const v = node['@_Value'];
    return v == null ? undefined : String(v);
}
function num(node: any, fallback = 0): number {
    const n = parseFloat(val(node) ?? '');
    return Number.isFinite(n) ? n : fallback;
}
function bool(node: any, fallback = false): boolean {
    const v = val(node);
    return v == null ? fallback : v === 'true';
}
function arr<T>(v: T | T[] | undefined | null): T[] {
    return v == null ? [] : Array.isArray(v) ? v : [v];
}
function attrNum(node: any, name: string, fallback = 0): number {
    const n = parseFloat(String(node?.[`@_${name}`] ?? ''));
    return Number.isFinite(n) ? n : fallback;
}
function color(node: any): string | null {
    // Live 11+: <Color Value=n/>; Live 10 and older: <ColorIndex Value=n/>
    const raw = val(node?.Color) ?? val(node?.ColorIndex);
    if (raw == null) return null;
    const idx = parseInt(raw, 10);
    return Number.isFinite(idx) && idx >= 0 ? LIVE_COLORS[idx % LIVE_COLORS.length] : null;
}

/**
 * Maps clip-relative time to content time segments, expanding loops.
 * Returns [{ at, from, to }]: content range [from, to) plays at clip offset `at`.
 */
function contentSegments(clip: any, clipLength: number) {
    const loop = clip?.Loop ?? {};
    const loopStart = num(loop.LoopStart);
    const loopEnd = num(loop.LoopEnd, loopStart + clipLength);
    const startMarker = loopStart + num(loop.StartRelative);
    const segs: { at: number; from: number; to: number }[] = [];

    if (!bool(loop.LoopOn) || loopEnd <= loopStart) {
        segs.push({ at: 0, from: startMarker, to: startMarker + clipLength });
        return segs;
    }
    let at = 0;
    let from = startMarker;
    while (at < clipLength - 1e-9 && segs.length < 10_000) {
        const span = Math.min(loopEnd - from, clipLength - at);
        if (span <= 0) break;
        segs.push({ at, from, to: from + span });
        at += span;
        from = loopStart;
    }
    return segs;
}

function readMidiClip(clip: any, trackColor: string | null): ConvMidiClip {
    const start = num(clip.CurrentStart, attrNum(clip, 'Time'));
    const length = Math.max(0, num(clip.CurrentEnd, start) - start);

    // Flatten KeyTracks into content-time notes
    const content: ConvNote[] = [];
    for (const kt of arr<any>(clip?.Notes?.KeyTracks?.KeyTrack)) {
        const key = num(kt.MidiKey, -1);
        if (key < 0 || key > 127) continue;
        for (const ev of arr<any>(kt?.Notes?.MidiNoteEvent)) {
            if (ev['@_IsEnabled'] === 'false') continue;
            content.push({
                time: attrNum(ev, 'Time'),
                duration: attrNum(ev, 'Duration'),
                key,
                velocity: Math.round(attrNum(ev, 'Velocity', 100)),
            });
        }
    }

    // Place each content note into every segment it falls in, trimmed to the segment
    const notes: ConvNote[] = [];
    for (const seg of contentSegments(clip, length)) {
        for (const n of content) {
            if (n.time < seg.from - 1e-9 || n.time >= seg.to - 1e-9) continue;
            const time = seg.at + (n.time - seg.from);
            const duration = Math.min(n.duration, seg.to - n.time);
            if (duration > 1e-6) notes.push({ ...n, time, duration });
        }
    }
    notes.sort((a, b) => a.time - b.time || a.key - b.key);

    return {
        kind: 'midi',
        name: val(clip.Name) ?? '',
        start,
        length,
        color: color(clip) ?? trackColor,
        muted: bool(clip.Disabled),
        notes,
    };
}

function readSampleRef(sampleRef: any): ConvSampleRef | null {
    const fileRef = sampleRef?.FileRef;
    const path = (val(fileRef?.Path) ?? '').replace(/\\/g, '/');
    const relPath = (val(fileRef?.RelativePath) ?? '').replace(/\\/g, '/');
    const file = (path || relPath).split('/').pop() ?? '';
    return file ? { file, path, relPath } : null;
}

function readAudioClip(clip: any, trackColor: string | null): ConvAudioClip | null {
    const sample = readSampleRef(clip?.SampleRef);
    if (!sample) return null;

    const start = num(clip.CurrentStart, attrNum(clip, 'Time'));
    const length = Math.max(0, num(clip.CurrentEnd, start) - start);
    const loop = clip?.Loop ?? {};
    return {
        kind: 'audio',
        name: val(clip.Name) ?? sample.file,
        start,
        length,
        color: color(clip) ?? trackColor,
        muted: bool(clip.Disabled),
        sample,
        sampleOffset: num(loop.LoopStart) + num(loop.StartRelative),
        warped: bool(clip.IsWarped),
    };
}

// ── Instruments ────────────────────────────────────────────────────────────────

const SAMPLER_TAGS = ['OriginalSimpler', 'MultiSampler'];
const PLAYBACK_MODES: ConvSamplerZone['mode'][] = ['classic', 'oneShot', 'slice'];

// XML tag → the name Live shows, where they differ
const DEVICE_LABELS: Record<string, string> = {
    DrumGroupDevice: 'Drum Rack', InstrumentGroupDevice: 'Instrument Rack',
    AudioEffectGroupDevice: 'Audio Effect Rack', MidiEffectGroupDevice: 'MIDI Effect Rack',
    OriginalSimpler: 'Simpler', MultiSampler: 'Sampler', StereoGain: 'Utility',
    MxDeviceMidiEffect: 'Max for Live MIDI effect', MxDeviceAudioEffect: 'Max for Live audio effect',
    MxDeviceInstrument: 'Max for Live instrument', MidiArpeggiator: 'Arpeggiator', MidiScale: 'Scale',
    MidiChord: 'Chord', MidiNoteLength: 'Note Length', MidiPitcher: 'Pitch', MidiRandom: 'Random',
    MidiVelocity: 'Velocity', Chorus2: 'Chorus-Ensemble', Eq8: 'EQ Eight', PingPongDelay: 'Ping Pong Delay',
    PluginDevice: 'VST plugin', AuPluginDevice: 'AU plugin', UltraAnalog: 'Analog', InstrumentVector: 'Wavetable',
    InstrumentImpulse: 'Impulse', LoungeLizard: 'Electric', StringStudio: 'Tension',
};

/** Device display name: plugin name, the user's rename, or Live's name for the device type. */
function deviceName(tag: string, dev: any): string {
    return val(dev?.PluginDesc?.VstPluginInfo?.PlugName)
        ?? val(dev?.PluginDesc?.Vst3PluginInfo?.Name)
        ?? val(dev?.PluginDesc?.AuPluginInfo?.Name)
        ?? (val(dev?.UserName) || DEVICE_LABELS[tag] || tag.replace(/([a-z])([A-Z0-9])/g, '$1 $2'));
}

/** Flatten a <Devices> node into [tag, node] pairs. */
function deviceList(devices: any): [string, any][] {
    const out: [string, any][] = [];
    for (const [tag, list] of Object.entries<any>(devices ?? {})) {
        if (tag.startsWith('@_')) continue;
        for (const dev of arr<any>(list)) out.push([tag, dev]);
    }
    return out;
}

/** Depth-limited search for the first sampler device (pads may nest it in a chain or rack). */
function findSampler(node: any, depth = 0): any | null {
    if (!node || typeof node !== 'object' || depth > 10) return null;
    for (const tag of SAMPLER_TAGS) {
        const found = arr<any>(node[tag])[0];
        if (found) return found;
    }
    for (const [k, child] of Object.entries<any>(node)) {
        if (k.startsWith('@_') || typeof child !== 'object') continue;
        for (const c of arr<any>(child)) {
            const hit = findSampler(c, depth + 1);
            if (hit) return hit;
        }
    }
    return null;
}

/**
 * A Simpler/Sampler → zone. Multi-sample instruments (round-robins, velocity layers,
 * key splits) collapse to their first active sample; `sampleCount` records how many there were.
 */
function readZone(sampler: any, name: string, triggerNote: number | null, sendingNote: number | null): ConvSamplerZone | null {
    const parts = arr<any>(sampler?.Player?.MultiSampleMap?.SampleParts?.MultiSamplePart)
        .filter((p) => readSampleRef(p?.SampleRef));
    const part = parts.find((p) => bool(p?.IsActive, true)) ?? parts[0];
    const sample = part && readSampleRef(part.SampleRef);
    if (!sample) return null;
    return {
        sampleCount: parts.length,
        name: name || val(part?.Name) || sample.file.replace(/\.[^.]+$/, ''),
        sample,
        triggerNote,
        sendingNote,
        rootKey: num(part?.RootKey, 60),
        transpose: num(sampler?.Pitch?.TransposeKey?.Manual),
        mode: PLAYBACK_MODES[num(sampler?.Globals?.PlaybackMode)] ?? 'classic',
        sampleStart: num(part?.SampleStart),
    };
}

function readDrumRack(rack: any): ConvSamplerZone[] {
    const pads: ConvSamplerZone[] = [];
    for (const branch of arr<any>(rack?.Branches?.DrumBranch)) {
        const info = branch?.BranchInfo;
        // Live stores the pad's trigger note inverted
        const receiving = num(info?.ReceivingNote, -1);
        if (receiving < 0) continue;
        const sampler = findSampler(branch?.DeviceChain);
        const name = val(branch?.Name?.EffectiveName) || val(branch?.Name?.UserName) || '';
        const zone = sampler && readZone(sampler, name, 128 - receiving, num(info?.SendingNote, 60));
        if (zone) pads.push(zone);
    }
    return pads.sort((a, b) => (a.triggerNote ?? 0) - (b.triggerNote ?? 0));
}

const hexBytes = (v: unknown) => Buffer.from(String(v ?? '').replace(/\s/g, ''), 'hex');

/**
 * A VST3 PluginDevice → ConvPlugin. The Uid and state blobs are what any VST3 host
 * hands back to the plugin, so presets carry over. VST2/AU aren't supported yet.
 */
function readPlugin(dev: any): ConvPlugin | null {
    const enabled = bool(dev?.On?.Manual, true);

    const info = dev?.PluginDesc?.Vst3PluginInfo;
    if (info) {
        const preset = info.Preset?.Vst3Preset;
        const uid = info.Uid ?? preset?.Uid;
        const classId = [0, 1, 2, 3].map((i) => parseInt(val(uid?.[`Fields.${i}`]) ?? '', 10));
        const processorState = hexBytes(preset?.ProcessorState);
        if (classId.some((n) => !Number.isFinite(n)) || !processorState.length) return null;
        return {
            format: 'vst3',
            name: val(info.Name) || 'VST3 plugin',
            kind: num(info.DeviceType ?? preset?.DeviceType) === 1 ? 'instrument' : 'effect',
            classId,
            processorState,
            controllerState: hexBytes(preset?.ControllerState),
            enabled,
        };
    }

    // VST2: <Buffer> holds either the plugin's own chunk, or (for plugins without one) a program
    // name followed by one f32 per parameter
    const v2 = dev?.PluginDesc?.VstPluginInfo;
    if (!v2) return null;
    const uniqueId = parseInt(val(v2.UniqueId) ?? '', 10);
    const buffer = hexBytes(v2.Preset?.VstPreset?.Buffer);
    if (!Number.isFinite(uniqueId) || !buffer.length) return null;
    const paramCount = num(v2.NumberOfParameters);
    const nameBytes = buffer.length - paramCount * 4;
    const isParamList = paramCount > 0 && nameBytes >= 0 && nameBytes <= 64
        && !/^(VC2!|CcnK)/.test(buffer.subarray(0, 4).toString('latin1'));
    const params = isParamList
        ? Array.from({ length: paramCount }, (_, i) => buffer.readFloatLE(nameBytes + i * 4))
        : undefined;
    return {
        format: 'vst2',
        name: val(v2.PlugName) || 'VST plugin',
        // VST2 category 2 = synth
        kind: num(v2.Category) === 2 ? 'instrument' : 'effect',
        uniqueId: uniqueId >>> 0,
        vstVersion: num(v2.VstVersion, 2400) || 2400,
        path: (val(v2.Path) ?? '').replace(/\//g, '\\'),
        chunk: isParamList ? undefined : buffer,
        params,
        enabled,
    };
}

/**
 * Picks the track's instrument if we can convert it (a VST3, a Drum Rack of samplers, or a
 * single-sample Simpler/Sampler, optionally wrapped in a one-chain Instrument Rack), and its
 * VST3 effects. Returns them and the names of every other device, for the report.
 */
function readInstrument(track: any): { instrument: ConvInstrument | null; effects: ConvPlugin[]; devices: string[] } {
    const top = deviceList(track?.DeviceChain?.DeviceChain?.Devices ?? track?.DeviceChain?.Devices);
    const devices: string[] = [];
    const effects: ConvPlugin[] = [];
    let instrument: ConvInstrument | null = null;

    for (const [tag, dev] of top) {
        const name = deviceName(tag, dev);
        if (tag === 'PluginDevice') {
            const plugin = readPlugin(dev);
            if (plugin?.kind === 'instrument' && !instrument) { instrument = { kind: 'plugin', device: plugin.name, plugin }; continue; }
            if (plugin?.kind === 'effect') { effects.push(plugin); continue; }
        }
        if (!instrument) {
            let target: [string, any] = [tag, dev];
            let rackExtras: string[] = [];   // other devices inside a one-chain rack (MIDI effects, FX)
            if (tag === 'InstrumentGroupDevice') {
                const chains = arr<any>(dev?.Branches?.InstrumentBranch);
                const inner = chains.length === 1 ? deviceList(chains[0]?.DeviceChain?.MidiToAudioDeviceChain?.Devices) : [];
                const hit = inner.find(([t]) => t === 'DrumGroupDevice' || SAMPLER_TAGS.includes(t));
                if (hit) {
                    target = hit;
                    rackExtras = inner.filter((d) => d !== hit).map(([t, d]) => `${deviceName(t, d)} (in ${name})`);
                }
            }
            if (target[0] === 'DrumGroupDevice') {
                const pads = readDrumRack(target[1]);
                if (pads.length) { instrument = { kind: 'drumRack', device: name, pads }; devices.push(...rackExtras); continue; }
            } else if (SAMPLER_TAGS.includes(target[0])) {
                const zone = readZone(target[1], '', null, null);
                if (zone) { instrument = { kind: 'simpler', device: name, zone }; devices.push(...rackExtras); continue; }
            }
        }
        devices.push(name);
    }
    return { instrument, effects, devices };
}

export function readAls(buffer: Buffer, projectName = 'Converted Project'): ConvProject {
    let xml: string;
    try {
        xml = zlib.gunzipSync(buffer).toString('utf8');
    } catch {
        throw new Error('Not a valid Ableton Live Set (.als is not gzip-compressed)');
    }

    const doc = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: false,
        parseTagValue: false,   // keep plugin state hex as text (all-digit hex would become a number)
        isArray: (name) => ARRAY_TAGS.has(name),
    }).parse(xml);

    const ableton = doc?.Ableton;
    const set = ableton?.LiveSet;
    if (!set) throw new Error('Not a valid Ableton Live Set (missing <LiveSet>)');

    // Live 12 renamed MasterTrack → MainTrack
    const main = set.MainTrack ?? set.MasterTrack;
    const mixer = main?.DeviceChain?.Mixer;
    const bpm = num(mixer?.Tempo?.Manual, 120);
    const ts = arr<any>(mixer?.TimeSignature?.TimeSignatures?.RemoteableTimeSignature)[0];

    // fast-xml-parser groups siblings by tag name, so recover the on-screen track order from the raw XML
    const order = new Map<string, number>();
    const orderRe = /<(MidiTrack|AudioTrack|GroupTrack|ReturnTrack) Id="(\d+)"/g;
    for (let m; (m = orderRe.exec(xml));) order.set(`${m[1]}:${m[2]}`, order.size);

    const tracks: (ConvTrack & { _order: number })[] = [];
    for (const [tag, kind] of Object.entries(TRACK_TYPES)) {
        for (const t of arr<any>(set.Tracks?.[tag])) {
            const trackColor = color(t);
            const tMixer = t?.DeviceChain?.Mixer;
            const seq = t?.DeviceChain?.MainSequencer;
            const clips: ConvClip[] = [];

            const midiSrc = seq?.ClipTimeable?.ArrangerAutomation?.Events;
            for (const c of arr<any>(midiSrc?.MidiClip)) clips.push(readMidiClip(c, trackColor));

            const audioSrcs = [seq?.Sample?.ArrangerAutomation?.Events, midiSrc];
            for (const src of audioSrcs) {
                for (const c of arr<any>(src?.AudioClip)) {
                    const a = readAudioClip(c, trackColor);
                    if (a) clips.push(a);
                }
            }
            clips.sort((a, b) => a.start - b.start);

            tracks.push({
                _order: order.get(`${tag}:${t['@_Id']}`) ?? 1e6,
                name: val(t?.Name?.EffectiveName) || val(t?.Name?.UserName) || `${kind} ${tracks.length + 1}`,
                kind,
                color: trackColor,
                muted: !bool(tMixer?.Speaker?.Manual, true),
                volume: num(tMixer?.Volume?.Manual, 1),
                pan: num(tMixer?.Pan?.Manual, 0),
                ...readInstrument(t),
                clips,
            });
        }
    }
    tracks.sort((a, b) => a._order - b._order);

    const locators = arr<any>(set?.Locators?.Locators?.Locator)
        .map((l) => ({ time: num(l.Time), name: val(l.Name) ?? '' }))
        .sort((a, b) => a.time - b.time);

    return {
        name: projectName,
        source: String(ableton['@_Creator'] ?? 'Ableton Live'),
        bpm,
        numerator: num(ts?.Numerator, 4),
        denominator: num(ts?.Denominator, 4),
        tracks: tracks.map(({ _order, ...t }) => t),
        locators,
    };
}
