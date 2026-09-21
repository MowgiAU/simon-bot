/**
 * FlpWriter — writes a ConvProject as an FL Studio project (.flp).
 *
 * FLP is an undocumented TLV event stream (see FLPParser for the reading side).
 * Rather than synthesising every event, we start from FL Studio 21's own empty
 * template (one Sampler channel, 500 playlist tracks, default mixer) and:
 *   - patch the header events (tempo, time signature, title)
 *   - insert pattern note data before the channel rack
 *   - clone the template's Sampler channel once per converted channel
 *   - replace the playlist (event 233), add time markers and name/colour tracks
 * Everything else (mixer, plugin state, window layout) is kept verbatim.
 *
 * The FL 21 template is used deliberately: it opens in FL 21, 2024, 2025 and newer,
 * whereas a template saved by a newer FL shows a version warning in older ones.
 *
 * Event encoding: id < 64 → 1-byte value, < 128 → u16, < 192 → u32,
 * otherwise a varint length followed by that many bytes. Text events are UTF-16LE.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginSlotParams, pluginWrapper } from './FlVst.js';
import type { FlPlugin } from './FlVst.js';

const TEMPLATE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates', 'Empty-FL21.flp');

const PPQ = 96;              // ticks per beat in the template header
const PLAYLIST_TRACKS = 500;
const PATTERN_BASE = 0x5000; // playlist item index offset for patterns

// Event ids (names from PyFLP)
const EV = {
    TimeSigNum: 17, TimeSigDen: 18, ChannelType: 21, ChannelInsert: 22, CustomColor: 41,
    ChannelNew: 64, PatternNew: 65, SlotIndex: 98, ArrangementNew: 99,
    ChannelColor: 128, ChannelFlags: 132, ChannelMisc: 143, PatternColor: 150, PluginIcon: 155,
    Tempo: 156, TimeMarker: 148,
    Title: 194, PatternName: 193, SamplePath: 196, InternalName: 201, PluginName: 203, TimeMarkerName: 205,
    SlotParams: 212, PluginData: 213, PatternNotes: 224, Playlist: 233, InsertParams: 236,
    TrackData: 238, TrackName: 239,
    InsertStart: 42, InsertColor: 149, InsertName: 204, InsertRouting: 235, MixerParams: 225,
    Controller: 227, AutomationData: 234, AutomationAfter: 145, MarkerNumerator: 33, MarkerDenominator: 34,
    ChannelParams: 215, TrackColorFlag: 43, Comments: 195, Url: 197,
} as const;

const CHANNEL_AUTOMATION = 5;
// Channel parameters (event 215): time-stretch length and mode (from an FL 21.2 reference)
const STRETCH_TIME_OFFSET = 96;
const STRETCH_MODE_OFFSET = 108;
const STRETCH_MODE = 5;
// The stretch length counts 192 units per beat (twice the project PPQ): a 16-beat loop fitted
// to tempo in FL stores 3072
const STRETCH_UNITS_PER_BEAT = 192;
const SIGNATURE_MARKER = 0x08000000;
// Track data (event 238): byte 46 = grouped with the track above
const TRACK_GROUPED_OFFSET = 46;
export const MIXER_VOLUME = 192;
export const MIXER_PAN = 193;

/**
 * Mixer parameters (event 225) are 12-byte records: u32 0, u8 param id, u8 0x1f,
 * u16 0x2000 + insert * 64 + slot, i32 value. Param 64 + n is the send level to insert n
 * (0–12800 = 0–100%); FL only stores levels that differ from 100%.
 */
const MIXER_ROUTE_PARAM = 64;
const MIXER_FULL = 12800;

function mixerParam(id: number, insert: number, value: number): Buffer {
    const b = Buffer.alloc(12);
    b[4] = id;
    b[5] = 0x1f;
    b.writeUInt16LE(0x2000 + insert * 64, 6);
    b.writeInt32LE(value, 8);
    return b;
}

const CHANNEL_PLUGIN = 2;
const DEFAULT_PLUGIN_COLOR = 6972764;  // FL's default slot/channel colour (#5C656A)
const MIXER_SLOTS = 10;

export const CHANNEL_SAMPLER = 0;
export const CHANNEL_AUDIO_CLIP = 4;

export interface FlChannel {
    name: string;
    color: string | null;
    type: number;               // CHANNEL_SAMPLER | CHANNEL_AUDIO_CLIP (ignored when `plugin` is set)
    insert: number;             // mixer insert (0 = master)
    samplePath?: string;
    plugin?: FlPlugin;          // VST instrument hosted in this channel
    /** Makes this an automation-clip channel with these points (see automationPayload). */
    automation?: FlAutomationPoint[];
    /** Audio clips: stretch the sample to this many beats at the project tempo (Live's warp). */
    stretchBeats?: number;
    /** One of FL's own generator plugins (e.g. Fruity Slicer) with its state. */
    native?: { name: string; state: Buffer };
}

/** An automation point: time in beats from the clip start, value normalised 0–1. */
export interface FlAutomationPoint { time: number; value: number }

/**
 * What an automation clip drives (event 227): param and destination codes.
 *   insert fader/pan/send:  param 0x1f00 | mixer param id, dest 0x2000 + insert * 64
 *   plugin parameter n:     param 0x8000 + n, dest = the channel, or 0x2000 + insert * 64 + slot
 *   tempo:                  param 0x0005, dest 0x4000
 */
export interface FlAutomationTarget { channel: number; param: number; dest: number }

/** VST effects for one mixer insert, filling its slots in order (FL has 10). */
export interface FlInsertEffects {
    insert: number;
    plugins: FlPlugin[];
}

/** A mixer insert's name, colour, fader and where it routes (insert 0 = master). */
export interface FlInsert {
    insert: number;
    name: string;
    color: string | null;
    volume?: number;            // fader value 0–16000 (12800 = 0 dB, FL's default)
    pan?: number;               // -6400 .. 6400
    /** Destinations; level is the send amount 0–1 (omitted = 100%, FL's default, not stored). */
    routes: { to: number; level?: number }[];
}

export interface FlNote {
    channel: number;            // index into channels[]
    pos: number;                // beats, relative to the pattern
    length: number;             // beats
    key: number;                // MIDI note number
    velocity: number;           // 0-127
}

export interface FlPattern {
    name: string;
    color: string | null;
    notes: FlNote[];
}

export type FlItem =
    | { kind: 'pattern'; pattern: number; track: number; start: number; length: number; muted?: boolean }
    | { kind: 'audio'; channel: number; track: number; start: number; length: number; offset: number; muted?: boolean }
    | { kind: 'automation'; channel: number; track: number; start: number; length: number };

export interface FlTrack {
    name: string;
    color: string | null;
    /** Grouped with the track above (FL folds it under that track). */
    grouped?: boolean;
}

export interface FlProject {
    title: string;
    /** Project info (F11): comments and web link. */
    comments?: string;
    url?: string;
    bpm: number;
    numerator: number;
    denominator: number;
    channels: FlChannel[];
    patterns: FlPattern[];
    items: FlItem[];
    tracks: FlTrack[];
    markers: { pos: number; name: string }[];
    insertEffects: FlInsertEffects[];
    inserts: FlInsert[];
    automationTargets: FlAutomationTarget[];
    signatures: { pos: number; numerator: number; denominator: number }[];
}

interface Ev { id: number; value: number | Buffer }

// ── Encoding helpers ───────────────────────────────────────────────────────────

function parseEvents(buf: Buffer, start: number, end: number): Ev[] {
    const out: Ev[] = [];
    let p = start;
    while (p < end) {
        const id = buf[p++];
        if (id < 64) { out.push({ id, value: buf[p] }); p += 1; }
        else if (id < 128) { out.push({ id, value: buf.readUInt16LE(p) }); p += 2; }
        else if (id < 192) { out.push({ id, value: buf.readUInt32LE(p) }); p += 4; }
        else {
            let len = 0, shift = 0, b: number;
            do { b = buf[p++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
            out.push({ id, value: Buffer.from(buf.subarray(p, p + len)) });
            p += len;
        }
    }
    return out;
}

function encodeEvent(e: Ev): Buffer {
    if (e.id < 192) {
        const size = e.id < 64 ? 1 : e.id < 128 ? 2 : 4;
        const b = Buffer.alloc(1 + size);
        b[0] = e.id;
        const v = e.value as number;
        if (size === 1) b.writeUInt8(v & 0xff, 1);
        else if (size === 2) b.writeUInt16LE(v & 0xffff, 1);
        else b.writeUInt32LE(v >>> 0, 1);
        return b;
    }
    const data = e.value as Buffer;
    const len: number[] = [];
    let n = data.length;
    do { let byte = n & 0x7f; n >>>= 7; if (n) byte |= 0x80; len.push(byte); } while (n);
    return Buffer.concat([Buffer.from([e.id, ...len]), data]);
}

function text(s: string): Buffer {
    return Buffer.from(`${s.replace(/\0/g, '')}\0`, 'utf16le');
}

const hex = (s: string) => Buffer.from(s, 'hex');

/** '#RRGGBB' → FL's 0x00BBGGRR */
function flColor(hex: string | null, fallback: number): number {
    const m = hex && /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return fallback;
    const rgb = parseInt(m[1], 16);
    return ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff);
}

const ticks = (beats: number) => Math.max(0, Math.round(beats * PPQ));

// ── Payload builders ───────────────────────────────────────────────────────────

function notesPayload(notes: FlNote[]): Buffer {
    const sorted = [...notes].sort((a, b) => a.pos - b.pos || a.key - b.key);
    const b = Buffer.alloc(sorted.length * 24);
    sorted.forEach((n, i) => {
        const o = i * 24;
        b.writeUInt32LE(ticks(n.pos), o);
        b.writeUInt16LE(0x4000, o + 4);                                  // flags
        b.writeUInt16LE(n.channel, o + 6);                               // rack channel
        b.writeUInt32LE(Math.max(1, ticks(n.length)), o + 8);
        b.writeUInt16LE(Math.min(131, Math.max(0, n.key)), o + 12);
        b.writeUInt16LE(0, o + 14);                                      // group
        b.writeUInt8(120, o + 16);                                       // fine pitch (centre)
        b.writeUInt8(0, o + 17);
        b.writeUInt8(64, o + 18);                                        // release
        b.writeUInt8(0, o + 19);                                         // MIDI channel
        b.writeUInt8(64, o + 20);                                        // pan (centre)
        b.writeUInt8(Math.min(128, Math.round((n.velocity / 127) * 128)), o + 21);
        b.writeUInt8(128, o + 22);                                       // mod X
        b.writeUInt8(128, o + 23);                                       // mod Y
    });
    return b;
}

/**
 * FL 21 playlist item = 60 bytes. Audio-clip items carry start/end offsets as
 * float milliseconds into the sample (-1/-1 = whole sample); pattern items carry int ticks.
 */
function playlistPayload(items: FlItem[], bpm: number): Buffer {
    const msPerBeat = 60000 / bpm;
    const sorted = [...items].sort((a, b) => a.start - b.start || a.track - b.track);
    const b = Buffer.alloc(sorted.length * 60);
    sorted.forEach((it, i) => {
        const o = i * 60;
        const len = Math.max(1, ticks(it.length));
        b.writeUInt32LE(ticks(it.start), o);
        b.writeUInt16LE(PATTERN_BASE, o + 4);
        b.writeUInt16LE(it.kind === 'pattern' ? PATTERN_BASE + it.pattern : it.channel, o + 6);
        b.writeUInt32LE(len, o + 8);
        b.writeUInt16LE(PLAYLIST_TRACKS - 1 - it.track, o + 12);
        b.writeUInt16LE(0, o + 14);                                      // group
        b.writeUInt16LE(0x0078, o + 16);
        b.writeUInt16LE('muted' in it && it.muted ? 0x2040 : 0x0040, o + 18); // item flags (0x2000 = muted)
        b.writeUInt32LE(0x80806440, o + 20);
        if (it.kind === 'pattern') {
            b.writeInt32LE(0, o + 24);                                   // start offset (ticks)
            b.writeInt32LE(len, o + 28);                                 // end offset (ticks)
        } else if (it.kind === 'automation') {
            b.writeFloatLE(-1, o + 24);                                  // whole clip
            b.writeFloatLE(-1, o + 28);
        } else {
            b.writeFloatLE(it.offset * msPerBeat, o + 24);               // start offset (ms)
            b.writeFloatLE((it.offset + it.length) * msPerBeat, o + 28); // end offset (ms)
        }
        b.writeUInt32LE(i + 1, o + 32);
        b.writeFloatLE(1, o + 52);
    });
    return b;
}

/**
 * Automation clip data (event 234, from FL 20–21 projects): a 17-byte header, u32 point count,
 * 24-byte points { f64 beats since the previous point, f64 value 0–1, f32 tension, u32 flags },
 * then a fixed 112-byte tail (LFO settings, identical across FL's own clips).
 */
const AUTOMATION_HEADER = hex('0100000040000000000400000003000000');
const AUTOMATION_TAIL = hex(
    '01000000ffffffffffffffffffffffffffffffff800000008000000000000000800000000500000003000000010000000000000000000000'
    + '000000000000f03f00000000000000000100000000000000fffffffffffffffffffffffffbb2000000000000000000000000000000000000');

function automationPayload(points: FlAutomationPoint[]): Buffer {
    const sorted = [...points].sort((a, b) => a.time - b.time);
    const b = Buffer.alloc(4 + sorted.length * 24);
    b.writeUInt32LE(sorted.length, 0);
    let prev = 0;
    sorted.forEach((pt, i) => {
        const o = 4 + i * 24;
        b.writeDoubleLE(Math.max(0, pt.time - prev), o);
        b.writeDoubleLE(Math.min(1, Math.max(0, pt.value)), o + 8);
        prev = pt.time;
    });
    return Buffer.concat([AUTOMATION_HEADER, b, AUTOMATION_TAIL]);
}

/** Event 227: links automation channel → target. */
function controllerPayload(t: FlAutomationTarget): Buffer {
    const b = Buffer.alloc(20);
    b.writeUInt16LE(t.channel, 2);
    b.writeUInt16LE(t.param, 8);
    b.writeUInt16LE(t.dest, 10);
    b.writeUInt32LE(8, 12);
    b.writeUInt32LE(469, 16);
    return b;
}

// ── Writer ─────────────────────────────────────────────────────────────────────

export function writeFlp(project: FlProject): Buffer {
    if (project.channels.length === 0) throw new Error('FLP needs at least one channel');
    if (project.tracks.length > PLAYLIST_TRACKS) throw new Error(`FLP supports at most ${PLAYLIST_TRACKS} playlist tracks`);

    const tpl = fs.readFileSync(TEMPLATE_PATH);
    const headerLen = tpl.readUInt32LE(4);
    const dataStart = 8 + headerLen;
    const events = parseEvents(tpl, dataStart + 8, dataStart + 8 + tpl.readUInt32LE(dataStart + 4));

    const chStart = events.findIndex((e) => e.id === EV.ChannelNew);
    const restStart = events.findIndex((e, i) => i > chStart && e.id === EV.ArrangementNew);
    if (chStart < 0 || restStart < 0) throw new Error('FLP template is missing the channel rack or arrangement');

    const header = events.slice(0, chStart);
    const channelTpl = events.slice(chStart, restStart);
    const rest = events.slice(restStart);
    const out: Ev[] = [];

    // Header: tempo, time signature, title
    for (const e of header) {
        if (e.id === EV.Tempo) out.push({ id: e.id, value: Math.round(project.bpm * 1000) });
        else if (e.id === EV.TimeSigNum) out.push({ id: e.id, value: project.numerator });
        else if (e.id === EV.TimeSigDen) out.push({ id: e.id, value: project.denominator });
        else if (e.id === EV.Title) {
            out.push({ id: e.id, value: text(project.title) });
            if (project.url) out.push({ id: EV.Url, value: text(project.url) });
        }
        else if (e.id === EV.Comments && project.comments) out.push({ id: e.id, value: text(project.comments) });
        else out.push(e);
    }

    // Pattern note data precedes the channel rack (pattern ids are 1-based)
    project.patterns.forEach((p, i) => {
        if (p.notes.length === 0) return;
        out.push({ id: EV.PatternNew, value: i + 1 });
        out.push({ id: EV.PatternNotes, value: notesPayload(p.notes) });
    });
    // Automation links sit with the pattern data, before the channel rack
    for (const t of project.automationTargets) out.push({ id: EV.Controller, value: controllerPayload(t) });

    // A VST channel is the Sampler block with the plugin fields swapped in (values as FL 21.2 writes them)
    const channelEvents = (ch: FlChannel, iid: number): Ev[] => {
        const evs: Ev[] = [];
        const vst = ch.plugin;
        const native = ch.native;
        for (const e of channelTpl) {
            if (e.id === EV.ChannelNew) evs.push({ id: e.id, value: iid });
            else if (e.id === EV.ChannelType) evs.push({ id: e.id, value: vst || native ? CHANNEL_PLUGIN : ch.automation ? CHANNEL_AUTOMATION : ch.type });
            else if (ch.stretchBeats && e.id === EV.ChannelParams) {
                // Time stretching: length in ticks, and mode 5, as FL sets them when fitting to tempo
                const params = Buffer.from(e.value as Buffer);
                params.writeInt32LE(Math.round(ch.stretchBeats * STRETCH_UNITS_PER_BEAT), STRETCH_TIME_OFFSET);
                params.writeInt32LE(STRETCH_MODE, STRETCH_MODE_OFFSET);
                // FL writes these on every audio clip it creates; with the Sampler defaults (-1, 1)
                // the stretch length is read in the wrong unit
                params.writeInt32LE(140, 0);
                params.writeInt32LE(3, 44);
                params.writeInt32LE(0, 48);
                evs.push({ id: e.id, value: params });
            }
            else if (native && e.id === EV.InternalName) evs.push({ id: e.id, value: text(native.name) });
            else if (native && e.id === EV.SlotParams) evs.push({ id: e.id, value: pluginSlotParams('generator', 0) });
            else if (native && e.id === EV.CustomColor) {
                evs.push({ id: e.id, value: ch.color ? 1 : 0 });
                evs.push({ id: EV.PluginData, value: native.state });
            }
            else if (ch.automation && e.id === EV.AutomationAfter) {
                evs.push(e);
                evs.push({ id: EV.AutomationData, value: automationPayload(ch.automation) });
            }
            else if (e.id === EV.PluginName) evs.push({ id: e.id, value: text(ch.name) });
            else if (e.id === EV.ChannelColor) evs.push({ id: e.id, value: flColor(ch.color, e.value as number) });
            else if (e.id === EV.ChannelInsert) evs.push({ id: e.id, value: Math.min(125, ch.insert) });
            else if (e.id === EV.SamplePath) continue;
            else if (vst && e.id === EV.InternalName) evs.push({ id: e.id, value: text('Fruity Wrapper') });
            else if (vst && e.id === EV.SlotParams) evs.push({ id: e.id, value: pluginSlotParams('generator', 0) });
            else if (vst && e.id === EV.CustomColor) {
                evs.push({ id: e.id, value: 1 });
                evs.push({ id: EV.PluginData, value: pluginWrapper(vst) });
            }
            // Event 41 is the channel's custom-colour flag: FL ignores the colour (128) unless it's 1
            else if (e.id === EV.CustomColor) evs.push({ id: e.id, value: ch.color ? 1 : e.value });
            else if (vst && e.id === EV.ChannelFlags) evs.push({ id: e.id, value: 131074 });
            else if (vst && e.id === EV.ChannelMisc) evs.push({ id: e.id, value: 10 });
            else evs.push(e);
        }
        if (ch.samplePath) evs.push({ id: EV.SamplePath, value: text(ch.samplePath) });
        return evs;
    };

    // FL writes pattern metadata right after the first channel — mirror that
    out.push(...channelEvents(project.channels[0], 0));
    project.patterns.forEach((p, i) => {
        out.push({ id: EV.PatternNew, value: i + 1 });
        out.push({ id: EV.PatternName, value: text(p.name) });
        if (p.color) out.push({ id: EV.PatternColor, value: flColor(p.color, 0) });
    });
    project.channels.slice(1).forEach((ch, i) => out.push(...channelEvents(ch, i + 1)));

    // Arrangement: playlist, markers, then track metadata
    // Mixer: the n-th insert-params event (236) opens insert n (0 = master); within an insert,
    // a slot's plugin events precede that slot's index event (98 k)
    const effectsByInsert = new Map(project.insertEffects.map((fx) => [fx.insert, fx.plugins.slice(0, MIXER_SLOTS)]));
    const insertsByIndex = new Map(project.inserts.map((ins) => [ins.insert, ins]));
    let insertNo = -1;

    let trackNo = 0;
    for (let i = 0; i < rest.length; i++) {
        const e = rest[i];

        // An insert opens with: colour (149), a custom-colour flag (42 — FL ignores the colour
        // unless it's 1), then its name (204), then its params (236)
        if (e.id === EV.InsertStart && rest[i + 1]?.id === EV.InsertParams) {
            const next = insertsByIndex.get(insertNo + 1);
            if (next?.color) out.push({ id: EV.InsertColor, value: flColor(next.color, 0) });
            out.push({ id: e.id, value: next?.color ? 1 : e.value });
            if (next?.name) out.push({ id: EV.InsertName, value: text(next.name) });
            continue;
        }
        if (e.id === EV.InsertRouting && insertsByIndex.has(insertNo)) {
            const routing = Buffer.alloc((e.value as Buffer).length);
            for (const r of insertsByIndex.get(insertNo)!.routes) if (r.to < routing.length) routing[r.to] = 1;
            out.push({ id: e.id, value: routing });
            continue;
        }
        if (e.id === EV.MixerParams) {
            // Faders and pans: patch the template's existing records in place
            const params = Buffer.from(e.value as Buffer);
            for (let o = 0; o + 12 <= params.length; o += 12) {
                const ins = insertsByIndex.get((params.readUInt16LE(o + 6) - 0x2000) >> 6);
                if (!ins || (params.readUInt16LE(o + 6) & 63) !== 0) continue;
                if (params[o + 4] === MIXER_VOLUME && ins.volume !== undefined) params.writeInt32LE(Math.round(ins.volume), o + 8);
                if (params[o + 4] === MIXER_PAN && ins.pan !== undefined) params.writeInt32LE(Math.round(ins.pan), o + 8);
            }
            const levels = project.inserts.flatMap((ins) => ins.routes
                .filter((r) => r.level !== undefined && r.level < 1)
                .map((r) => mixerParam(MIXER_ROUTE_PARAM + r.to, ins.insert, Math.round(Math.max(0, r.level!) * MIXER_FULL))));
            out.push({ id: e.id, value: Buffer.concat([params, ...levels]) });
            continue;
        }
        if (e.id === EV.InsertParams) insertNo++;
        if (e.id === EV.SlotIndex && insertNo >= 0) {
            const plugin = effectsByInsert.get(insertNo)?.[e.value as number];
            if (plugin) {
                out.push(
                    { id: EV.InternalName, value: text('Fruity Wrapper') },
                    { id: EV.SlotParams, value: pluginSlotParams('effect', insertNo) },
                    { id: EV.PluginName, value: text(plugin.name) },
                    { id: EV.PluginIcon, value: 0 },
                    { id: EV.ChannelColor, value: DEFAULT_PLUGIN_COLOR },
                    { id: EV.CustomColor, value: 0 },
                    { id: EV.PluginData, value: pluginWrapper(plugin) },
                );
            }
        }
        if (e.id === EV.Playlist) {
            out.push({ id: e.id, value: playlistPayload(project.items, project.bpm) });
            for (const m of project.markers) {
                out.push({ id: EV.TimeMarker, value: ticks(m.pos) });
                out.push({ id: EV.TimeMarkerName, value: text(m.name) });
            }
            // Time-signature markers: marker type 8 in the top byte, then numerator/denominator
            for (const s of project.signatures) {
                out.push({ id: EV.TimeMarker, value: (ticks(s.pos) | SIGNATURE_MARKER) >>> 0 });
                out.push({ id: EV.TimeMarkerName, value: text(`${s.numerator}/${s.denominator}`) });
                out.push({ id: EV.MarkerNumerator, value: s.numerator });
                out.push({ id: EV.MarkerDenominator, value: s.denominator });
            }
            continue;
        }
        const track = e.id === EV.TrackData ? project.tracks[trackNo++] : undefined;
        if (!track) {
            out.push(e);
            continue;
        }
        // FL writes: track data (238), its colour flag (43), then the name (239)
        const data = Buffer.from(e.value as Buffer);
        data.writeUInt32LE(flColor(track.color, data.readUInt32LE(4)), 4);
        if (track.grouped) data[TRACK_GROUPED_OFFSET] = 1;
        out.push({ id: e.id, value: data });
        // The event after track data (43) is its custom-colour flag: FL shows the colour only when it's 1
        if (rest[i + 1]?.id === EV.TrackColorFlag) {
            i++;
            out.push({ id: EV.TrackColorFlag, value: track.color ? 1 : rest[i].value });
        } else if (rest[i + 1]?.id !== EV.TrackData) {
            out.push(rest[++i]);
        }
        out.push({ id: EV.TrackName, value: text(track.name) });
    }

    const body = Buffer.concat(out.map(encodeEvent));
    const hdr = Buffer.from(tpl.subarray(0, dataStart + 8));
    hdr.writeUInt16LE(project.channels.length, 10);                      // channel count
    hdr.writeUInt32LE(body.length, dataStart + 4);
    return Buffer.concat([hdr, body]);
}
