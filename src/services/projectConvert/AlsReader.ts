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
    ConvAudioClip, ConvAutomation, ConvAutomationTarget, ConvChain, ConvClip, ConvClipEnvelope, ConvEffect, ConvInstrument, ConvLayer, ConvMidiClip, ConvNote, ConvPlugin,
    ConvOtherPad, ConvProject, ConvSampleRef, ConvSamplerZone, ConvTrack, ConvZonePart, SampleTrimRange,
} from './types.js';
import { LIVE_EFFECTS } from './LiveEffects.js';

// Live's 70-colour clip/track palette, in index order (5 rows of 14 as shown in Live). Verified
// against the colour tables in Live 12's own controller scripts (MIDI Remote Scripts).
const LIVE_COLORS = [
    '#FF94A6', '#FFA529', '#CC9927', '#F7F47C', '#BFFB00', '#1AFF2F', '#25FFA8', '#5CFFE8', '#8BC5FF', '#5480E4', '#92A7FF', '#D86CE4', '#E553A0', '#FFFFFF',
    '#FF3636', '#F66C03', '#99724B', '#FFF034', '#87FF67', '#3DC300', '#00BFAF', '#19E9FF', '#10A4EE', '#007DC0', '#886CE4', '#B677C6', '#FF39D4', '#D0D0D0',
    '#E2675A', '#FFA374', '#D3AD71', '#EDFFAE', '#D2E498', '#BAD074', '#9BC48D', '#D4FDE1', '#CDF1F8', '#B9C1E3', '#CDBBE4', '#AE98E5', '#E5DCE1', '#A9A9A9',
    '#C6928B', '#B78256', '#99836A', '#BFBA69', '#A6BE00', '#7DB04D', '#88C2BA', '#9BB3C4', '#85A5C2', '#8393CC', '#A595B5', '#BF9FBE', '#BC7196', '#7B7B7B',
    '#AF3333', '#A95131', '#724F41', '#DBC300', '#85961F', '#539F31', '#0A9C8E', '#236384', '#1A2F96', '#2F52A2', '#624BAD', '#A34BAD', '#CC2E6E', '#3C3C3C',
];

const TRACK_TYPES: Record<string, ConvTrack['kind']> = {
    MidiTrack: 'midi', AudioTrack: 'audio', GroupTrack: 'group', ReturnTrack: 'return',
};

const ARRAY_TAGS = new Set([
    'MidiTrack', 'AudioTrack', 'GroupTrack', 'ReturnTrack',
    'MidiClip', 'AudioClip', 'KeyTrack', 'MidiNoteEvent', 'Locator', 'WarpMarker',
    'DrumBranch', 'InstrumentBranch', 'AudioEffectBranch', 'MultiSamplePart', 'TrackSendHolder', 'SendPreBool',
    'PluginFloatParameter', 'AutomationEnvelope', 'FloatEvent', 'EnumEvent', 'BoolEvent', 'SlicePoint',
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
    return Number.isFinite(idx) && idx >= 0 && idx < LIVE_COLORS.length ? LIVE_COLORS[idx] : null;
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
    const warped = bool(clip.IsWarped);
    return {
        kind: 'audio',
        name: val(clip.Name) ?? sample.file,
        start,
        length,
        color: color(clip) ?? trackColor,
        muted: bool(clip.Disabled),
        sample,
        sampleOffset: num(loop.LoopStart) + num(loop.StartRelative),
        warped,
        fadeIn: bool(clip.Fade, true) ? num(clip?.Fades?.FadeInLength) : 0,
        fadeOut: bool(clip.Fade, true) ? num(clip?.Fades?.FadeOutLength) : 0,
        gain: num(clip.SampleVolume, 1),
        ...(warped ? warpedLength(clip) : {}),
        // Looped warped clips repeat their loop region; FL audio clips don't loop, so keep the passes
        ...(warped && bool(loop.LoopOn)
            ? { loopPasses: contentSegments(clip, length).map((s) => ({ at: s.at, from: s.from, length: s.to - s.from })) }
            : {}),
    };
}

/**
 * A warped clip's whole-sample length in beats: Live's warp markers map seconds to beats; the
 * last segment's tempo is extended to the end of the file.
 */
function warpedLength(clip: any): Pick<ConvAudioClip, 'sampleBeats' | 'complexWarp'> {
    const markers = arr<any>(clip?.WarpMarkers?.WarpMarker)
        .map((m) => ({ sec: attrNum(m, 'SecTime'), beat: attrNum(m, 'BeatTime') }))
        .sort((a, b) => a.sec - b.sec);
    const ref = clip?.SampleRef;
    const duration = num(ref?.DefaultDuration) / (num(ref?.DefaultSampleRate, 44100) || 44100);
    if (markers.length < 2 || !(duration > 0)) return {};
    const tempo = (a: { sec: number; beat: number }, b: { sec: number; beat: number }) => (b.beat - a.beat) / (b.sec - a.sec || 1);
    const [a, b] = markers.slice(-2);
    const perSec = tempo(a, b);
    const beatAt = (sec: number) => b.beat + (sec - b.sec) * perSec;
    const sampleBeats = beatAt(duration) - beatAt(0);
    // Live keeps a helper marker right after the first; any other tempo change is a real warp curve
    const tempos = new Set(markers.slice(1).map((m, i) => tempo(markers[i], m).toFixed(2)));
    return { sampleBeats: sampleBeats > 0 ? sampleBeats : undefined, complexWarp: tempos.size > 1 };
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
    Compressor2: 'Compressor', MultibandDynamics: 'Multiband Dynamics', Redux2: 'Redux', AutoPan2: 'Auto Pan',
};

/** Device display name: plugin name, the user's rename, or Live's name for the device type. */
function deviceName(tag: string, dev: any): string {
    return val(dev?.PluginDesc?.VstPluginInfo?.PlugName)
        ?? val(dev?.PluginDesc?.Vst3PluginInfo?.Name)
        ?? val(dev?.PluginDesc?.AuPluginInfo?.Name)
        ?? (val(dev?.UserName) || DEVICE_LABELS[tag] || tag.replace(/([a-z])([A-Z0-9])/g, '$1 $2'));
}

/** Flatten a <Devices> node into [tag, node] pairs, in chain order. */
function deviceList(devices: any): [string, any][] {
    const out: [string, any][] = [];
    for (const [tag, list] of Object.entries<any>(devices ?? {})) {
        if (tag.startsWith('@_')) continue;
        for (const dev of arr<any>(list)) out.push([tag, dev]);
    }
    return out.sort((a, b) => Number(a[1]?.['@_seq'] ?? 0) - Number(b[1]?.['@_seq'] ?? 0));
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
const SLICE_STYLES = ['transient', 'beat', 'region', 'manual'] as const;
// Simpler's beat-slicing divisions, in beats (1/32 note … 4 bars)
const SLICE_BEAT_DIVISIONS = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
const MAX_SLICES = 128;

/** Seconds at a beat position, via the sample's warp markers (piecewise linear). */
function beatToSeconds(markers: { sec: number; beat: number }[], beat: number): number {
    if (markers.length < 2) return beat * 0.5;                    // 120 BPM if unwarped
    let i = 1;
    while (i < markers.length - 1 && markers[i].beat < beat) i++;
    const a = markers[i - 1], b = markers[i];
    return a.sec + ((beat - a.beat) * (b.sec - a.sec)) / (b.beat - a.beat || 1);
}

/**
 * Slice start times (seconds) for a Simpler in Slice mode. Live stores the transient points it
 * detected (InitialSlicePointsFromOnsets, filtered here by the Sensitivity setting), manual points,
 * or the grid/region settings to derive them from.
 */
function readSlices(part: any): Pick<ConvSamplerZone, 'slices' | 'sliceStyle' | 'sampleBeats' | 'sliceWarped' | 'sampleSeconds'> {
    const rate = num(part?.SampleRef?.DefaultSampleRate, 44100);
    const startSec = num(part?.SampleStart) / rate;
    const endSec = num(part?.SampleEnd, num(part?.SampleRef?.DefaultDuration)) / rate;
    const markers = arr<any>(part?.SampleWarpProperties?.WarpMarkers?.WarpMarker)
        .map((m) => ({ sec: attrNum(m, 'SecTime'), beat: attrNum(m, 'BeatTime') }))
        .sort((a, b) => a.sec - b.sec);
    const sampleBeats = markers.length > 1 ? markers[markers.length - 1].beat : undefined;
    const sliceWarped = bool(part?.SampleWarpProperties?.IsWarped);
    const style = SLICE_STYLES[num(part?.SlicingStyle)] ?? 'transient';
    const points = (list: any) => arr<any>(list?.SlicePoint).map((p) => ({ sec: attrNum(p, 'TimeInSeconds'), energy: attrNum(p, 'NormalizedEnergy', 1) }));

    let times: number[];
    if (style === 'manual') {
        times = points(part?.ManualSlicePoints).map((p) => p.sec);
    } else if (style === 'region') {
        const n = Math.max(1, num(part?.SlicingRegions, 8));
        times = Array.from({ length: n }, (_, i) => startSec + ((endSec - startSec) * i) / n);
    } else if (style === 'beat') {
        const step = SLICE_BEAT_DIVISIONS[num(part?.SlicingBeatGrid, 3)] ?? 1;
        times = [];
        for (let b = 0; times.length < MAX_SLICES; b += step) {
            const t = beatToSeconds(markers, b);
            if (t >= endSec) break;
            times.push(t);
        }
    } else {
        // Sensitivity 0–100: more sensitive keeps quieter transients
        const minEnergy = 1 - num(part?.SlicingThreshold, 100) / 100;
        times = points(part?.InitialSlicePointsFromOnsets).filter((p) => p.energy >= minEnergy - 1e-9).map((p) => p.sec);
    }
    const slices = [...new Set(times.filter((t) => t >= startSec - 1e-6 && t < endSec).map((t) => Math.max(startSec, t)))]
        .sort((a, b) => a - b)
        .slice(0, MAX_SLICES);
    if (!slices.length || slices[0] > startSec + 0.001) slices.unshift(startSec);
    return { slices, sliceStyle: style, sampleBeats, sliceWarped, sampleSeconds: endSec - startSec };
}

function readZone(sampler: any, name: string, triggerNote: number | null, sendingNote: number | null): ConvSamplerZone | null {
    const parts = arr<any>(sampler?.Player?.MultiSampleMap?.SampleParts?.MultiSamplePart)
        .filter((p) => readSampleRef(p?.SampleRef));
    // Multi-sample instruments collapse to one sample: the zone covering middle C, else the first
    const active = parts.filter((p) => bool(p?.IsActive, true));
    const covers = (p: any, key: number) => num(p?.KeyRange?.Min, 0) <= key && key <= num(p?.KeyRange?.Max, 127);
    const part = active.find((p) => covers(p, 60)) ?? active[0] ?? parts[0];
    const sample = part && readSampleRef(part.SampleRef);
    if (!sample) return null;
    const mode = PLAYBACK_MODES[num(sampler?.Globals?.PlaybackMode)] ?? 'classic';
    // Every active zone, for instruments that use more than one sample (key splits, velocity
    // layers, round-robin alternates)
    const zoneParts: ConvZonePart[] = active.flatMap((p) => {
        const ref = readSampleRef(p?.SampleRef);
        return ref ? [{
            sample: ref,
            name: val(p?.Name)?.replace(/\.[^.]+$/, '') || ref.file.replace(/\.[^.]+$/, ''),
            keyMin: num(p?.KeyRange?.Min, 0), keyMax: num(p?.KeyRange?.Max, 127),
            velMin: num(p?.VelocityRange?.Min, 1), velMax: num(p?.VelocityRange?.Max, 127),
            rootKey: num(p?.RootKey, 60),
            sampleStart: num(p?.SampleStart),
            trim: mode === 'slice' ? undefined : zoneTrim(p),
        }] : [];
    });
    const map = sampler?.Player?.MultiSampleMap;
    return {
        sampleCount: parts.length,
        parts: zoneParts.length > 1 ? zoneParts : undefined,
        roundRobin: bool(map?.RoundRobin) ? (num(map?.RoundRobinMode) === 0 ? 'sequential' : 'random') : undefined,
        name: name || val(part?.Name) || sample.file.replace(/\.[^.]+$/, ''),
        sample,
        triggerNote,
        sendingNote,
        rootKey: num(part?.RootKey, 60),
        transpose: num(sampler?.Pitch?.TransposeKey?.Manual),
        mode,
        sampleStart: num(part?.SampleStart),
        trim: mode === 'slice' ? undefined : zoneTrim(part),   // slice points are measured on the whole file
        sampleRate: num(part?.SampleRef?.DefaultSampleRate, 44100),
        ...(mode === 'slice' ? readSlices(part) : {}),
    };
}

/** The part of its file a zone plays, when its start or end marker was moved (else undefined). */
function zoneTrim(part: any): SampleTrimRange | undefined {
    const total = num(part?.SampleRef?.DefaultDuration, 0);
    const start = Math.max(0, num(part?.SampleStart));
    // Live's SampleEnd is the last frame played
    const end = num(part?.SampleEnd, total - 1) + 1;
    return start > 0 || (total > 0 && end < total) ? { start, end: total > 0 ? Math.min(end, total) : end } : undefined;
}

/** A rack chain's effects and mixer level (Live's pan is <Panorama>). */
function readChain(name: string, devices: any, mixer: any): ConvChain {
    const chain = readDeviceChain(deviceList(devices), name);
    return { name, effects: chain.effects, devices: chain.devices, volume: num(mixer?.Volume?.Manual, 1), pan: num(mixer?.Panorama?.Manual, 0) };
}

function readDrumRack(rack: any): { pads: ConvSamplerZone[]; otherPads: ConvOtherPad[]; returns: ConvChain[] } {
    const pads: ConvSamplerZone[] = [];
    const otherPads: ConvOtherPad[] = [];
    for (const branch of arr<any>(rack?.Branches?.DrumBranch)) {
        const info = branch?.BranchInfo;
        // Live stores the pad's trigger note inverted
        const receiving = num(info?.ReceivingNote, -1);
        if (receiving < 0) continue;
        const sampler = findSampler(branch?.DeviceChain);
        const name = val(branch?.Name?.EffectiveName) || val(branch?.Name?.UserName) || '';
        const zone = sampler && readZone(sampler, name, 128 - receiving, num(info?.SendingNote, 60));
        if (zone) {
            // The pad's own chain: effects after its sampler, its level, and its sends to the rack's returns
            zone.chain = {
                ...readChain(name, branch?.DeviceChain?.MidiToAudioDeviceChain?.Devices, branch?.MixerDevice),
                sends: arr<any>(branch?.MixerDevice?.SendInfos?.AudioBranchSendInfo).map((s) => num(s?.Send?.Manual, 0)),
            };
            pads.push(zone);
            continue;
        }
        const [tag, dev] = deviceList(branch?.DeviceChain?.MidiToAudioDeviceChain?.Devices)[0] ?? [];
        if (tag) otherPads.push({ triggerNote: 128 - receiving, name: name || deviceName(tag, dev), device: deviceName(tag, dev) });
    }
    pads.sort((a, b) => (a.triggerNote ?? 0) - (b.triggerNote ?? 0));
    // The rack's return chains, which pads send into
    const returns = arr<any>(rack?.ReturnBranches?.ReturnBranch).map((rb, i) =>
        readChain(val(rb?.Name?.EffectiveName) || `Return ${String.fromCharCode(65 + i)}`, rb?.DeviceChain?.AudioToAudioDeviceChain?.Devices, rb?.MixerDevice));
    return { pads, otherPads, returns };
}

const hexBytes = (v: unknown) => Buffer.from(String(v ?? '').replace(/\s/g, ''), 'hex');

/**
 * A VST3 PluginDevice → ConvPlugin. The Uid and state blobs are what any VST3 host
 * hands back to the plugin, so presets carry over. VST2/AU aren't supported yet.
 */
/** Live automation-target id → plugin parameter, from the device's ParameterList. */
function readParamTargets(dev: any): Record<string, { id: number; name: string }> {
    const out: Record<string, { id: number; name: string }> = {};
    for (const p of arr<any>(dev?.ParameterList?.PluginFloatParameter)) {
        const target = p?.ParameterValue?.AutomationTarget?.['@_Id'];
        const id = num(p?.ParameterId, -1);
        if (target != null && id >= 0) out[String(target)] = { id, name: val(p?.ParameterName) || `Parameter ${id}` };
    }
    return out;
}

/** The parameter ids Live exposes for a plugin, in its own order (its automatable slots). */
function readParamIds(dev: any): number[] {
    const ids = arr<any>(dev?.ParameterList?.PluginFloatParameter).map((p) => num(p?.ParameterId, -1)).filter((id) => id >= 0);
    return [...new Set(ids)];
}

function readPlugin(dev: any): ConvPlugin | null {
    const enabled = bool(dev?.On?.Manual, true);
    const paramTargets = readParamTargets(dev);
    // Live keeps the user's rename of the device here; for a sample player it often names the library
    const label = val(dev?.UserName) || undefined;

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
            label,
            kind: num(info.DeviceType ?? preset?.DeviceType) === 1 ? 'instrument' : 'effect',
            classId,
            processorState,
            controllerState: hexBytes(preset?.ControllerState),
            paramIds: readParamIds(dev),
            enabled,
        paramTargets,
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
        label,
        // VST2 category 2 = synth
        kind: num(v2.Category) === 2 ? 'instrument' : 'effect',
        uniqueId: uniqueId >>> 0,
        vstVersion: num(v2.VstVersion, 2400) || 2400,
        path: (val(v2.Path) ?? '').replace(/\//g, '\\'),
        chunk: isParamList ? undefined : buffer,
        params,
        enabled,
        paramTargets,
    };
}

interface ChainResult { instrument: ConvInstrument | null; effects: ConvEffect[]; devices: string[] }

/** Flattens nested layer racks into their individual layers, narrowing key zones as it goes. */
function toLayers(inst: ConvInstrument, base: Omit<ConvLayer, 'instrument'>): ConvLayer[] {
    if (inst.kind !== 'layers') return [{ ...base, instrument: inst }];
    return inst.layers.map((l) => ({
        name: l.name,
        volume: base.volume * l.volume,
        pan: Math.max(-1, Math.min(1, base.pan + l.pan)),
        keyMin: Math.max(base.keyMin, l.keyMin),
        keyMax: Math.min(base.keyMax, l.keyMax),
        velMin: Math.max(base.velMin, l.velMin),
        velMax: Math.min(base.velMax, l.velMax),
        instrument: l.instrument,
    }));
}

/**
 * Walks a device chain (a track's, or one inside a rack), descending into racks:
 *   - the first instrument found becomes the chain's instrument: a VST, a Drum Rack of samplers,
 *     a single-sample Simpler/Sampler, or an Instrument Rack (one chain is unwrapped; several
 *     become layers that all play the same notes, filtered by each chain's key zone)
 *   - VST effects and Live's own effects that FL has an equivalent for (LIVE_EFFECTS) are
 *     collected in order, including those inside single-chain Audio Effect Racks
 *   - everything else is listed by name for the report
 */
function readDeviceChain(list: [string, any][], where = ''): ChainResult {
    const out: ChainResult = { instrument: null, effects: [], devices: [] };
    const skip = (name: string) => out.devices.push(where ? `${name} (in ${where})` : name);
    const absorb = (inner: ChainResult) => { out.effects.push(...inner.effects); out.devices.push(...inner.devices); };

    for (const [tag, dev] of list) {
        const name = deviceName(tag, dev);

        if (tag === 'PluginDevice') {
            const plugin = readPlugin(dev);
            if (plugin?.kind === 'instrument' && !out.instrument) out.instrument = { kind: 'plugin', device: plugin.name, plugin };
            else if (plugin?.kind === 'effect') out.effects.push(plugin);
            else skip(name);
            continue;
        }
        if (tag === 'DrumGroupDevice' && !out.instrument) {
            const { pads, otherPads, returns } = readDrumRack(dev);
            if (pads.length || otherPads.length) { out.instrument = { kind: 'drumRack', device: name, pads, otherPads, returns }; continue; }
        }
        if (SAMPLER_TAGS.includes(tag) && !out.instrument) {
            const zone = readZone(dev, '', null, null);
            if (zone) { out.instrument = { kind: 'simpler', device: name, zone }; continue; }
        }
        if (tag === 'InstrumentGroupDevice' && !out.instrument) {
            const layers: ConvLayer[] = [];
            for (const br of arr<any>(dev?.Branches?.InstrumentBranch)) {
                if (!bool(br?.MixerDevice?.Speaker?.Manual, true)) continue;         // muted chain
                const inner = readDeviceChain(deviceList(br?.DeviceChain?.MidiToAudioDeviceChain?.Devices), name);
                absorb(inner);
                if (!inner.instrument) continue;
                const keys = br?.ZoneSettings?.KeyRange, vels = br?.ZoneSettings?.VelocityRange;
                layers.push(...toLayers(inner.instrument, {
                    name: val(br?.Name?.EffectiveName) || name,
                    keyMin: num(keys?.Min, 0),
                    keyMax: num(keys?.Max, 127),
                    velMin: num(vels?.Min, 1),
                    velMax: num(vels?.Max, 127),
                    volume: num(br?.MixerDevice?.Volume?.Manual, 1),
                    pan: num(br?.MixerDevice?.Panorama?.Manual, 0),
                }));
            }
            if (layers.length === 1) out.instrument = layers[0].instrument;
            else if (layers.length > 1) out.instrument = { kind: 'layers', device: name, layers };
            continue;
        }
        if (tag === 'AudioEffectGroupDevice') {
            const chains = arr<any>(dev?.Branches?.AudioEffectBranch);
            if (chains.length === 1) {
                absorb(readDeviceChain(deviceList(chains[0]?.DeviceChain?.AudioToAudioDeviceChain?.Devices), name));
            } else {
                skip(`${name} (${chains.length} parallel chains)`);
            }
            continue;
        }
        if (LIVE_EFFECTS.has(tag)) {
            out.effects.push({ format: 'live', device: tag, name, enabled: bool(dev?.On?.Manual, true), xml: dev });
            continue;
        }
        skip(name);
    }
    return out;
}

function readInstrument(track: any): ChainResult {
    return readDeviceChain(deviceList(track?.DeviceChain?.DeviceChain?.Devices ?? track?.DeviceChain?.Devices));
}

// ── Automation ─────────────────────────────────────────────────────────────────

/** Live's "value before the arrangement starts" event sits at this time. */
const PRE_ROLL_TIME = -63072000;

const targetId = (node: any): string | undefined => {
    const id = node?.AutomationTarget?.['@_Id'];
    return id == null ? undefined : String(id);
};

/** An envelope's breakpoints in beats, with the pre-roll value placed at time 0. */
function envelopePoints(env: any): { time: number; value: number }[] {
    const events = env?.Automation?.Events ?? {};
    const raw = [...arr<any>(events.FloatEvent), ...arr<any>(events.EnumEvent), ...arr<any>(events.BoolEvent)]
        .map((e) => ({
            time: attrNum(e, 'Time'),
            value: e['@_Value'] === 'true' ? 1 : e['@_Value'] === 'false' ? 0 : attrNum(e, 'Value'),
        }))
        .sort((a, b) => a.time - b.time);
    return raw.map((p) => (p.time <= PRE_ROLL_TIME + 1 ? { ...p, time: 0 } : p)).filter((p) => p.time >= 0);
}

/** Every VST plugin reachable from a chain result (instrument, layers and effects). */
function chainPlugins(chain: ChainResult): ConvPlugin[] {
    const inst = chain.instrument;
    const fromInst = inst?.kind === 'plugin' ? [inst.plugin]
        : inst?.kind === 'layers' ? inst.layers.flatMap((l) => (l.instrument.kind === 'plugin' ? [l.instrument.plugin] : []))
            : [];
    return [...fromInst, ...chain.effects.filter((e): e is ConvPlugin => e.format !== 'live')];
}

/** Resolves a track's arrangement envelopes against the targets we know how to carry over. */
function readAutomation(owner: any, targets: Map<string, ConvAutomationTarget>): { automation: ConvAutomation[]; otherAutomation: number } {
    const automation: ConvAutomation[] = [];
    let otherAutomation = 0;
    for (const env of arr<any>(owner?.AutomationEnvelopes?.Envelopes?.AutomationEnvelope)) {
        const points = envelopePoints(env);
        if (points.length < 2) continue;                    // a lone pre-roll value isn't automation
        const target = targets.get(String(env?.EnvelopeTarget?.PointeeId?.['@_Value']));
        if (target) automation.push({ target, points });
        else otherAutomation++;
    }
    return { automation, otherAutomation };
}

function trackTargets(mixer: any, chain: ChainResult): Map<string, ConvAutomationTarget> {
    const targets = new Map<string, ConvAutomationTarget>();
    const vol = targetId(mixer?.Volume);
    const pan = targetId(mixer?.Pan);
    if (vol) targets.set(vol, { kind: 'volume' });
    if (pan) targets.set(pan, { kind: 'pan' });
    arr<any>(mixer?.Sends?.TrackSendHolder)
        .sort((a, b) => attrNum(a, 'Id') - attrNum(b, 'Id'))
        .forEach((h, index) => { const id = targetId(h?.Send); if (id) targets.set(id, { kind: 'send', index }); });
    for (const plugin of chainPlugins(chain)) {
        for (const [id, p] of Object.entries(plugin.paramTargets)) {
            targets.set(id, { kind: 'plugin', plugin, param: p.id, paramName: p.name });
        }
    }
    return targets;
}

/** The track mixer's volume, pan and send targets a clip envelope can point at, by id and mode. */
function mixerEnvelopeTargets(mixer: any): Map<string, { target: ConvAutomationTarget; mode: 'set' | 'modulate' }> {
    const out = new Map<string, { target: ConvAutomationTarget; mode: 'set' | 'modulate' }>();
    const add = (param: any, target: ConvAutomationTarget) => {
        const set = param?.AutomationTarget?.['@_Id'], mod = param?.ModulationTarget?.['@_Id'];
        if (set != null) out.set(String(set), { target, mode: 'set' });
        if (mod != null) out.set(String(mod), { target, mode: 'modulate' });
    };
    add(mixer?.Volume, { kind: 'volume' });
    add(mixer?.Pan, { kind: 'pan' });
    arr<any>(mixer?.Sends?.TrackSendHolder)
        .sort((a, b) => attrNum(a, 'Id') - attrNum(b, 'Id'))
        .forEach((h, index) => add(h?.Send, { kind: 'send', index }));
    return out;
}

/**
 * A clip's mixer envelopes on the arrangement timeline. Envelope times are in the clip's content
 * beats (like its notes), so they follow the clip's start marker and loop like the notes do.
 */
function readClipEnvelopes(raw: any, clip: ConvClip, targets: ReturnType<typeof mixerEnvelopeTargets>): ConvClipEnvelope[] {
    const out: ConvClipEnvelope[] = [];
    for (const env of arr<any>(raw?.Envelopes?.Envelopes?.ClipEnvelope)) {
        const hit = targets.get(val(env?.EnvelopeTarget?.PointeeId) ?? '');
        if (!hit) continue;
        const events = arr<any>(env?.Automation?.Events?.FloatEvent)
            .map((e) => ({ time: attrNum(e, 'Time'), value: attrNum(e, 'Value') }))
            .sort((a, b) => a.time - b.time);
        if (!events.length) continue;
        // Value at content time t: linear between events; at a step (two events at one time) the later one
        const valueAt = (t: number) => {
            let i = -1;
            for (let k = 0; k < events.length; k++) if (events[k].time <= t) i = k;
            if (i < 0) return events[0].value;
            const a = events[i], b = events[i + 1];
            return !b || b.time === a.time ? a.value : a.value + ((b.value - a.value) * (t - a.time)) / (b.time - a.time);
        };
        const points: ConvClipEnvelope['points'] = [];
        for (const seg of contentSegments(raw, clip.length)) {
            const at = clip.start + seg.at;
            points.push({ time: at, value: valueAt(seg.from) });
            for (const e of events) if (e.time > seg.from && e.time < seg.to) points.push({ time: at + e.time - seg.from, value: e.value });
            points.push({ time: at + (seg.to - seg.from), value: valueAt(seg.to - 1e-6) });
        }
        out.push({ ...hit, start: clip.start, end: clip.start + clip.length, points });
    }
    return out;
}

/** Live packs a signature into one number: (numerator − 1) + 99 × log2(denominator). */
function decodeSignature(v: number): { numerator: number; denominator: number } {
    return { numerator: (Math.round(v) % 99) + 1, denominator: 2 ** Math.floor(Math.round(v) / 99) };
}

export function readAls(buffer: Buffer, projectName = 'Converted Project'): ConvProject {
    let xml: string;
    try {
        xml = zlib.gunzipSync(buffer).toString('utf8');
    } catch {
        throw new Error('Not a valid Ableton Live Set (.als is not gzip-compressed)');
    }

    let seq = 0;
    const doc = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: false,
        parseTagValue: false,   // keep plugin state hex as text (all-digit hex would become a number)
        isArray: (name) => ARRAY_TAGS.has(name),
        // Number every element in document order: the parser groups same-named siblings, which
        // would otherwise lose the order of a device chain that mixes device types
        updateTag: (tag, _path, attrs) => {
            if (attrs && Object.keys(attrs).length) attrs['@_seq'] = String(seq++);   // devices always have an Id
            return tag;
        },
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

            const envTargets = mixerEnvelopeTargets(tMixer);
            const clipEnvelopes: ConvClipEnvelope[] = [];
            let allClipEnvelopes = 0;
            const midiSrc = seq?.ClipTimeable?.ArrangerAutomation?.Events;
            for (const c of arr<any>(midiSrc?.MidiClip)) {
                const clip = readMidiClip(c, trackColor);
                clips.push(clip);
                if (!clip.muted) clipEnvelopes.push(...readClipEnvelopes(c, clip, envTargets));
                if (!clip.muted) allClipEnvelopes += arr(c?.Envelopes?.Envelopes?.ClipEnvelope).length;
            }

            const audioSrcs = [seq?.Sample?.ArrangerAutomation?.Events, midiSrc];
            for (const src of audioSrcs) {
                for (const c of arr<any>(src?.AudioClip)) {
                    const a = readAudioClip(c, trackColor);
                    if (!a) continue;
                    clips.push(a);
                    // Unwarped clips keep their envelopes in seconds, not beats — those are left out
                    if (!a.muted && a.warped) clipEnvelopes.push(...readClipEnvelopes(c, a, envTargets));
                    if (!a.muted) allClipEnvelopes += arr(c?.Envelopes?.Envelopes?.ClipEnvelope).length;
                }
            }
            clips.sort((a, b) => a.start - b.start);

            const chain = readInstrument(t);
            const groupId = val(t?.TrackGroupId);
            tracks.push({
                _order: order.get(`${tag}:${t['@_Id']}`) ?? 1e6,
                id: String(t['@_Id'] ?? ''),
                groupId: groupId && groupId !== '-1' ? groupId : null,
                sends: arr<any>(tMixer?.Sends?.TrackSendHolder)
                    .sort((a, b) => attrNum(a, 'Id') - attrNum(b, 'Id'))
                    .map((h) => num(h?.Send?.Manual, 0)),
                name: val(t?.Name?.EffectiveName) || val(t?.Name?.UserName) || `${kind} ${tracks.length + 1}`,
                kind,
                color: trackColor,
                // A track fed by another track's plugin output: "AudioIn/Track.15/DeviceOut.0.S1"
                // is that track's first device, stereo output 1 (Live shows it as "KT Out 2")
                pluginOutput: (() => {
                    const m = /AudioIn\/Track\.(\d+)\/DeviceOut\.(\d+)\.S(\d+)/.exec(val(t?.DeviceChain?.AudioInputRouting?.Target) ?? '');
                    return m ? { trackId: m[1], device: Number(m[2]), output: Number(m[3]) } : undefined;
                })(),
                muted: !bool(tMixer?.Speaker?.Manual, true),
                volume: num(tMixer?.Volume?.Manual, 1),
                pan: num(tMixer?.Pan?.Manual, 0),
                ...chain,
                ...readAutomation(t, trackTargets(tMixer, chain)),
                clips,
                clipEnvelopes,
                otherClipEnvelopes: allClipEnvelopes - clipEnvelopes.length,
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
        main: (({ effects, devices }) => ({ effects, devices }))(readInstrument(main)),
        returnsPre: arr<any>(set?.SendsPre?.SendPreBool)
            .sort((a, b) => attrNum(a, 'Id') - attrNum(b, 'Id'))
            .map((b) => b['@_Value'] === 'true'),
        ...readMainAutomation(main, mixer),
    };
}

/** Tempo automation and time-signature changes live on the Main track's envelopes. */
function readMainAutomation(main: any, mixer: any): Pick<ConvProject, 'tempoAutomation' | 'timeSignatures'> {
    const tempoId = targetId(mixer?.Tempo);
    const sigId = targetId(mixer?.TimeSignature);
    let tempoAutomation: ConvAutomation | null = null;
    const timeSignatures: ConvProject['timeSignatures'] = [];
    for (const env of arr<any>(main?.AutomationEnvelopes?.Envelopes?.AutomationEnvelope)) {
        const pointee = String(env?.EnvelopeTarget?.PointeeId?.['@_Value']);
        const points = envelopePoints(env);
        if (pointee === tempoId && points.length > 1) tempoAutomation = { target: { kind: 'tempo' }, points };
        if (pointee === sigId) {
            for (const p of points) if (p.time > 0) timeSignatures.push({ time: p.time, ...decodeSignature(p.value) });
        }
    }
    return { tempoAutomation, timeSignatures };
}
