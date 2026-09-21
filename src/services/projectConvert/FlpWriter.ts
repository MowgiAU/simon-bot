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
    TimeSigNum: 17, TimeSigDen: 18, ChannelType: 21, ChannelInsert: 22, PluginFlag: 41,
    ChannelNew: 64, PatternNew: 65, SlotIndex: 98, ArrangementNew: 99,
    ChannelColor: 128, ChannelFlags: 132, ChannelMisc: 143, PatternColor: 150, PluginIcon: 155,
    Tempo: 156, TimeMarker: 148,
    Title: 194, PatternName: 193, SamplePath: 196, InternalName: 201, PluginName: 203, TimeMarkerName: 205,
    SlotParams: 212, PluginData: 213, PatternNotes: 224, Playlist: 233, InsertParams: 236,
    TrackData: 238, TrackName: 239,
} as const;

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
}

/** VST effects for one mixer insert, filling its slots in order (FL has 10). */
export interface FlInsertEffects {
    insert: number;
    plugins: FlPlugin[];
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
    | { kind: 'audio'; channel: number; track: number; start: number; length: number; offset: number; muted?: boolean };

export interface FlTrack {
    name: string;
    color: string | null;
}

export interface FlProject {
    title: string;
    bpm: number;
    numerator: number;
    denominator: number;
    channels: FlChannel[];
    patterns: FlPattern[];
    items: FlItem[];
    tracks: FlTrack[];
    markers: { pos: number; name: string }[];
    insertEffects: FlInsertEffects[];
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
        b.writeUInt16LE(it.muted ? 0x2040 : 0x0040, o + 18);             // item flags (0x2000 = muted)
        b.writeUInt32LE(0x80806440, o + 20);
        if (it.kind === 'pattern') {
            b.writeInt32LE(0, o + 24);                                   // start offset (ticks)
            b.writeInt32LE(len, o + 28);                                 // end offset (ticks)
        } else {
            b.writeFloatLE(it.offset * msPerBeat, o + 24);               // start offset (ms)
            b.writeFloatLE((it.offset + it.length) * msPerBeat, o + 28); // end offset (ms)
        }
        b.writeUInt32LE(i + 1, o + 32);
        b.writeFloatLE(1, o + 52);
    });
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
        else if (e.id === EV.Title) out.push({ id: e.id, value: text(project.title) });
        else out.push(e);
    }

    // Pattern note data precedes the channel rack (pattern ids are 1-based)
    project.patterns.forEach((p, i) => {
        if (p.notes.length === 0) return;
        out.push({ id: EV.PatternNew, value: i + 1 });
        out.push({ id: EV.PatternNotes, value: notesPayload(p.notes) });
    });

    // A VST channel is the Sampler block with the plugin fields swapped in (values as FL 21.2 writes them)
    const channelEvents = (ch: FlChannel, iid: number): Ev[] => {
        const evs: Ev[] = [];
        const vst = ch.plugin;
        for (const e of channelTpl) {
            if (e.id === EV.ChannelNew) evs.push({ id: e.id, value: iid });
            else if (e.id === EV.ChannelType) evs.push({ id: e.id, value: vst ? CHANNEL_PLUGIN : ch.type });
            else if (e.id === EV.PluginName) evs.push({ id: e.id, value: text(ch.name) });
            else if (e.id === EV.ChannelColor) evs.push({ id: e.id, value: flColor(ch.color, e.value as number) });
            else if (e.id === EV.ChannelInsert) evs.push({ id: e.id, value: Math.min(125, ch.insert) });
            else if (e.id === EV.SamplePath) continue;
            else if (vst && e.id === EV.InternalName) evs.push({ id: e.id, value: text('Fruity Wrapper') });
            else if (vst && e.id === EV.SlotParams) evs.push({ id: e.id, value: pluginSlotParams('generator', 0) });
            else if (vst && e.id === EV.PluginFlag) {
                evs.push({ id: e.id, value: 1 });
                evs.push({ id: EV.PluginData, value: pluginWrapper(vst) });
            }
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
    let insertNo = -1;

    let trackNo = 0;
    for (let i = 0; i < rest.length; i++) {
        const e = rest[i];
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
                    { id: EV.PluginFlag, value: 0 },
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
            continue;
        }
        const track = e.id === EV.TrackData ? project.tracks[trackNo++] : undefined;
        if (!track) {
            out.push(e);
            continue;
        }
        // FL writes: track data (238), one flag event (43), then the name (239)
        const data = Buffer.from(e.value as Buffer);
        data.writeUInt32LE(flColor(track.color, data.readUInt32LE(4)), 4);
        out.push({ id: e.id, value: data });
        if (rest[i + 1]?.id !== EV.TrackData) out.push(rest[++i]);
        out.push({ id: EV.TrackName, value: text(track.name) });
    }

    const body = Buffer.concat(out.map(encodeEvent));
    const hdr = Buffer.from(tpl.subarray(0, dataStart + 8));
    hdr.writeUInt16LE(project.channels.length, 10);                      // channel count
    hdr.writeUInt32LE(body.length, dataStart + 4);
    return Buffer.concat([hdr, body]);
}
