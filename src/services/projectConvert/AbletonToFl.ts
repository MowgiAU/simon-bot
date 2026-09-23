/**
 * Ableton Live (.als) → FL Studio (.flp) conversion.
 *
 * Mapping:
 *   MIDI track   → one playlist track; each arrangement MIDI clip becomes its own pattern on it.
 *     Drum Rack  → one Sampler channel per pad, loaded with the pad's sample (like an FL kit).
 *                  Pads with effects or sends, and the rack's return chains, get their own mixer
 *                  inserts routed into the drum track's insert.
 *     Simpler    → one Sampler channel loaded with the sample; notes shifted to keep pitch.
 *                  In Slice mode, a Fruity Slicer with the same slice points instead.
 *     VST2/VST3  → an FL plugin channel loaded with the plugin's saved state.
 *     other      → one empty Sampler channel named after the track.
 *   Audio track  → one playlist track; each distinct sample becomes an audio-clip channel.
 *   Locators     → playlist time markers.
 *   Mixer        → every track, group and return gets its own insert; tracks in a group route
 *                  to the group's insert, sends become routes to the return inserts.
 * VST2/VST3 effects go on the track's mixer insert with their saved state; Live's own effects
 * become FL's equivalents with matching settings where FL has one (LiveEffects.ts). Ableton's
 * own instruments, and effects without an FL equivalent, are listed in the report instead.
 */
import { readAls } from './AlsReader.js';
import { CHANNEL_AUDIO_CLIP, CHANNEL_SAMPLER, MIXER_PAN, MIXER_VOLUME, writeFlp } from './FlpWriter.js';
import type { FlAutomationPoint, FlAutomationTarget, FlChannel, FlInsert, FlInsertEffects, FlItem, FlPattern, FlTrack } from './FlpWriter.js';
import { FRUITY_SLICER, SLICER_FIRST_KEY, fruitySlicerState } from './FlNative.js';
import { LIVE_EFFECT_TARGETS, flLevel, liveEffectToFl } from './LiveEffects.js';
import { vst3ClassId } from './FlVst.js';
import type { FlPlugin } from './FlVst.js';
import type { ConversionReport, ConvAutomation, ConvAutomationTarget, ConvChain, ConvEffect, ConvInstrument, ConvPlugin, ConvProject, ConvSampleRef, ConvSamplerZone, ConvTrack, SampleTrimRange } from './types.js';

const MIXER_SLOTS = 10;
const FUJI_URL = 'https://fujistud.io';
const LIVE_FIRST_SLICE_KEY = 36;   // Simpler's Slice mode starts at C1
const SEND_OFF = 0.001;     // Live's send minimum is 0.000316 (−70 dB = off)

/**
 * FL's volume law (mixer faders, send levels, and its own volume knobs), measured by rendering:
 * a control at r (1 = 0 dB) gives gain = (11^r − 1) / 10 — so r = 0.5 is −12.7 dB and the
 * fader's top (16000, r = 1.25) +5.6 dB. flLevel (LiveEffects.ts) inverts it for Live's linear gains.
 */
const FL_FADER_UNITY = 12800;
const FL_FADER_MAX = 16000;
const FL_PAN_RANGE = 6400;
// Channel volume (event 219) uses the same law: 12800 = 0 dB; FL gives new channels 10000
const FL_CHANNEL_UNITY = 12800;
const FL_CHANNEL_DEFAULT_GAIN = (11 ** (10000 / FL_CHANNEL_UNITY) - 1) / 10;
const FL_TEMPO_MIN = 10, FL_TEMPO_SPAN = 512;   // FL tempo: 10–522 BPM
const flFader = (gain: number) => Math.min(FL_FADER_MAX, FL_FADER_UNITY * flLevel(gain));

export interface AlsToFlpOptions {
    projectName?: string;
    /** Folder (relative to the .flp) the samples will be shipped in, e.g. 'Samples'. */
    sampleFolder?: string;
    /** Known sample libraries, used to name the library a Kontakt-style player is loading. */
    libraries?: LibraryEntry[];
}

/** A sample library as the plugin registry knows it. */
export interface LibraryEntry { name: string; aliases?: string[] }

/**
 * Players whose sounds live in a library installed on the machine, not in the project. Their saved
 * state only references the library (and Kontakt's is compressed, so the name can't be read out of
 * it), which is why a project opens with "content missing" when the library isn't installed.
 */
const LIBRARY_HOSTS = /kontakt|battery|falcon|\bopus\b|\bplay\b|sine player|ezdrummer|superior drummer|\bengine\b|halion sonic/i;

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Why a device can't come across, for the devices where "not converted" on its own would leave the
 * user guessing. Keyed by the name the reader gives the device; matched against the names reported
 * per track (which may carry a "(in Audio Effect Rack)" suffix).
 */
const DEVICE_NOTES: Record<string, string> = {
    'Multiband Dynamics': [
        'Live splits the signal into three bands and each band can compress in two directions at once:',
        'downward above its upper threshold, and upward below its lower threshold, with its own ratio,',
        'attack and release for each direction, and with the crossover points wherever you put them.',
        'FL has no effect with that shape. Fruity Multiband Compressor compresses downward only, and',
        'Maximus is a multiband compressor/limiter driven by envelope curves rather than by Live\'s',
        'threshold-and-ratio pairs, so neither can be given settings that behave like the device you',
        'had — any mapping would be an invented setting that changes the mix rather than carries it.',
        'It is left out rather than approximated. If your Multiband Dynamics was only compressing',
        'downward, Fruity Multiband Compressor (or Maximus) set by ear on that track gets close; if it',
        'was using the upward stage — the "below" half, which lifts quiet passages — the usual stand-in',
        'is parallel compression: a send to a heavily compressed Fruity Compressor blended back in.',
    ].join(' '),
};

/** The library whose name (or alias) appears in the names around the instance — longest match wins. */
function libraryGuess(hints: (string | undefined)[], libraries: LibraryEntry[]): string | null {
    const text = ` ${hints.filter(Boolean).map((h) => plain(h!)).join(' | ')} `;
    let best: { name: string; len: number } | null = null;
    for (const lib of libraries) {
        for (const alias of [lib.name, ...(lib.aliases ?? [])]) {
            const n = plain(alias);
            if (n.length < 4) continue;
            if (!text.includes(` ${n} `) && !text.includes(` ${n} |`) && !text.includes(`| ${n} `)) continue;
            if (!best || n.length > best.len) best = { name: lib.name, len: n.length };
        }
    }
    return best?.name ?? null;
}

export interface AlsToFlpResult {
    flp: Buffer;
    project: ConvProject;
    report: ConversionReport;
    /** Samples referenced by the output, with where they were on the source machine. */
    samples: { fileName: string; outputPath: string; sourcePath: string; sourceRelPath: string; trim?: SampleTrimRange }[];
}

const MAX_TRACKS = 125; // mixer inserts available for 1:1 routing

export function convertAlsToFlp(als: Buffer, opts: AlsToFlpOptions = {}): AlsToFlpResult {
    const project = readAls(als, opts.projectName);
    const sampleFolder = opts.sampleFolder ?? 'Samples';
    const warnings: string[] = [];
    const converted: string[] = [];

    const channels: FlChannel[] = [];
    const patterns: FlPattern[] = [];
    const items: FlItem[] = [];
    const tracks: FlTrack[] = [];
    const audioChannels = new Map<string, number>();
    const samples: AlsToFlpResult['samples'] = [];
    const samplePaths = new Map<string, string>();
    let notes = 0, midiClips = 0, audioClips = 0;

    /**
     * Adds a sample to the output bundle once; returns its path relative to the .flp. A trimmed
     * sample (only part of it played in Live) is shipped as its own cut-down "(trimmed)" copy.
     */
    const registerSample = (ref: ConvSampleRef, trim?: SampleTrimRange): string => {
        const key = (ref.path || ref.relPath) + (trim ? `|${trim.start}-${trim.end}` : '');
        const existing = samplePaths.get(key);
        if (existing) return existing;
        const wanted = trim ? ref.file.replace(/(\.[^.]+)?$/, ' (trimmed)$1') : ref.file;
        // Disambiguate identical file names from different folders (or different trims)
        const taken = samples.filter((s) => s.fileName.toLowerCase() === wanted.toLowerCase()).length;
        const fileName = taken ? wanted.replace(/(\.[^.]+)?$/, ` (${taken + 1})$1`) : wanted;
        const outputPath = `${sampleFolder}/${fileName}`;
        samples.push({ fileName, outputPath, sourcePath: ref.path, sourceRelPath: ref.relPath, trim });
        samplePaths.set(key, outputPath);
        return outputPath;
    };

    /** FL's Sampler plays a sample at original pitch on C5 (60); Live plays it on rootKey. */
    const flKey = (liveKey: number, zone: ConvSamplerZone) => liveKey - zone.rootKey + 60 + zone.transpose;

    /**
     * A rack chain's level on the channels it made (channels[from, to)): its gain relative to FL's
     * default channel volume (10000 ≈ −5.2 dB on FL's volume law), and its pan. Unity chains are left alone.
     */
    const chainLevel = (from: number, to: number, gain: number, pan: number) => {
        const unity = Math.abs(gain - 1) < 0.001, centred = Math.abs(pan) < 0.005;
        for (let i = from; i < to; i++) {
            if (!unity) channels[i].volume = FL_CHANNEL_UNITY * flLevel(FL_CHANNEL_DEFAULT_GAIN * gain);
            if (!centred) channels[i].pan = FL_CHANNEL_UNITY / 2 * (1 + Math.max(-1, Math.min(1, pan)));
        }
    };

    const zoneWarnings = (track: string, zone: ConvSamplerZone) => {
        if (zone.mode === 'slice' && !zone.slices?.length) {
            warnings.push(`"${track}": "${zone.name}" was a sliced Simpler — the whole sample is loaded; re-slice it in FL (e.g. Slicex).`);
        }
        if (zone.sampleCount > 1 && !zone.parts) {
            warnings.push(`"${track}": "${zone.name}" used ${zone.sampleCount} samples (round-robin / layers) — only "${zone.sample.file}" was loaded.`);
        }
        if (zone.trim || zone.parts?.some((p) => p.trim)) {
            converted.push(`"${track}": "${zone.name}" played only part of its sample in Live — the sample is included trimmed to that part.`);
        }
    };

    const insertEffects: FlInsertEffects[] = [];
    const pluginsNeeded = new Set<string>();
    const knownLibraries = opts.libraries ?? [];
    const skippedDevices = new Set<string>();
    const librariesUsed: ConversionReport['libraries'] = [];
    const pluginChannel = new Map<ConvPlugin, number>();                      // instrument → channel
    const pluginSlot = new Map<ConvPlugin, { insert: number; slot: number }>(); // effect → insert slot

    /** FL finds VST3s by class ID, so their path is only a hint for its plugin database. */
    const flPlugin = (p: ConvPlugin): FlPlugin => {
        const kind = p.kind === 'instrument' ? 'generator' : 'effect';
        return p.format === 'vst3'
            ? {
                format: 'vst3', name: p.name, kind,
                path: `C:\\Program Files\\Common Files\\VST3\\${p.name}.vst3`,
                classId: vst3ClassId(p.classId),
                processorState: p.processorState,
                controllerState: p.controllerState,
                // FL numbers a plugin's parameters by their place in this list (see FlVst.ts), so
                // writing Live's own list makes an automation link land on the same parameter
                paramIds: p.paramIds,
            }
            : {
                format: 'vst2', name: p.name, kind, path: p.path,
                uniqueId: p.uniqueId, vstVersion: p.vstVersion, chunk: p.chunk, params: p.params,
            };
    };
    const notePlugin = (p: ConvPlugin, where: string, hints: string[] = []) => {
        pluginsNeeded.add(p.name);
        if (LIBRARY_HOSTS.test(p.name)) {
            librariesUsed.push({ plugin: p.name, track: where, library: libraryGuess([where, p.label, ...hints], knownLibraries) });
        }
        // Effects land on a bypassed slot when they were off; a switched-off instrument has no
        // equivalent in FL, so that one is worth saying out loud
        if (!p.enabled && p.kind === 'instrument') warnings.push(`${p.name} was switched off in Live — it plays in FL; mute its channel there if you want it silent.`);
    };

    /**
     * Puts a track's effects on its mixer insert, in chain order: VSTs as themselves, Live's own
     * effects as FL's equivalents (LiveEffects.ts). Reports the rest.
     */
    const placeEffects = (name: string, effects: ConvEffect[], devices: string[], insert: number) => {
        const skipped = [...devices];
        const placed: string[] = [];
        const leftOff: string[] = [];
        // An FL insert holds ten effects, so a longer chain continues on further inserts, each
        // feeding the next — the last one takes over where the track's insert used to route to.
        const chain: { insert: number; slots: FlInsertEffects['plugins'] }[] = [{ insert, slots: [] }];
        const room = (needed: number): FlInsertEffects['plugins'] | null => {
            const last = chain[chain.length - 1];
            if (last.slots.length + needed <= MIXER_SLOTS) return last.slots;
            const next = spillInsert(insert);
            if (next === null) return null;
            chain.push({ insert: next, slots: [] });
            return chain[chain.length - 1].slots;
        };
        for (const e of effects) {
            if (e.format === 'live') {
                const fl = liveEffectToFl(e, { bpm: project.bpm });
                if (!fl) { skipped.push(e.name); continue; }
                for (const note of fl.notes) warnings.push(`"${name}": ${e.name} — ${note}.`);
                if (!fl.effects.length) continue;               // does nothing at these settings
                const slots = room(fl.effects.length);
                if (!slots) { leftOff.push(e.name); continue; }
                // A device switched off in Live lands on a bypassed slot, as it sat in the set
                slots.push(...fl.effects.map((f) => (e.enabled ? f : { ...f, enabled: false })));
                placed.push(`${e.name} (as ${LIVE_EFFECT_TARGETS[e.device]}${e.enabled ? '' : ', bypassed'})`);
                continue;
            }
            const slots = room(1);
            if (!slots) { leftOff.push(e.name); continue; }
            pluginSlot.set(e, { insert: chain[chain.length - 1].insert, slot: slots.length });
            slots.push({ ...flPlugin(e), enabled: e.enabled });
            placed.push(e.enabled ? e.name : `${e.name} (bypassed)`);
            notePlugin(e, name);
        }
        if (skipped.length) {
            warnings.push(`"${name}": devices not converted — ${skipped.join(', ')}.`);
            for (const dev of skipped) skippedDevices.add(dev.replace(/\s*\(in .*\)$/, ''));
        }
        if (leftOff.length) {
            const what = `${leftOff.join(', ')} ${leftOff.length === 1 ? 'was' : 'were'} left off`;
            warnings.push(insert === 0
                ? `"${name}": FL's master holds ${MIXER_SLOTS} effects and nothing can follow it, so ${what} — put them on a track insert instead.`
                : `"${name}": FL's mixer has no free inserts left to continue this chain on, so ${what}.`);
        }
        for (const part of chain) if (part.slots.length) insertEffects.push({ insert: part.insert, plugins: part.slots });
        if (!placed.length) return;
        const extra = chain.length - 1;
        converted.push(`"${name}": ${placed.join(', ')} → ${insert ? `mixer insert ${insert}` : 'the master'}, with their settings${extra ? `, continuing on ${extra} more insert${extra === 1 ? '' : 's'} chained after it` : ''}.`);
    };

    // ── Mixer: every track gets an insert — tracks and groups in order, then returns ──
    // Tracks in a group route to the group's insert (groups nest the same way), everything
    // else to the master; sends become extra routes to the return inserts at the send level.
    const mixerTracks = [...project.tracks.filter((t) => t.kind !== 'return'), ...project.tracks.filter((t) => t.kind === 'return')];
    if (mixerTracks.length > MAX_TRACKS) {
        warnings.push(`Only the first ${MAX_TRACKS} tracks were converted (the set has ${mixerTracks.length}).`);
    }
    const insertOf = new Map<ConvTrack, number>();
    mixerTracks.slice(0, MAX_TRACKS).forEach((t, i) => insertOf.set(t, i + 1));
    const groupInserts = new Map([...insertOf].filter(([t]) => t.kind === 'group').map(([t, ins]) => [t.id, ins]));
    const returnInserts = project.tracks.filter((t) => t.kind === 'return').map((t) => insertOf.get(t));

    const inserts: FlInsert[] = [];
    // Inserts after the tracks' own are free: for chains of over ten effects, and for drum pads
    // that carry their own effects
    let nextInsert = insertOf.size + 1;
    const spillTail = new Map<number, number>();  // insert → the last insert its chain continues on
    let spillInserts = 0;

    /**
     * A further insert for a chain that has filled its ten slots: it takes over where the chain
     * currently routes to (its sends included — they stay at the end of the chain, as in Live), and
     * the insert it continues from feeds it instead. Null when the mixer is full, or for the master,
     * which has nothing after it.
     */
    const spillInsert = (insert: number): number | null => {
        const tail = inserts.find((i) => i.insert === (spillTail.get(insert) ?? insert));
        if (!tail || nextInsert > MAX_TRACKS) return null;
        const next = nextInsert++;
        inserts.push({ insert: next, name: `${tail.name} FX`, color: tail.color, routes: tail.routes });
        tail.routes = [{ to: next }];
        spillTail.set(insert, next);
        spillInserts++;
        return next;
    };

    let sendCount = 0;
    for (const [t, insert] of insertOf) {
        const routes: FlInsert['routes'] = [{ to: (t.groupId && groupInserts.get(t.groupId)) || 0 }];
        if (t.kind !== 'return') {
            t.sends.forEach((gain, i) => {
                const to = returnInserts[i];
                if (to && gain > SEND_OFF) { routes.push({ to, level: Math.min(1, flLevel(gain)) }); sendCount++; }
            });
        }
        inserts.push({ insert, name: t.name, color: t.color, routes, volume: flFader(t.volume), pan: t.pan * FL_PAN_RANGE });
        placeEffects(t.name, t.effects, t.devices, insert);
    }
    placeEffects('Main', project.main.effects, project.main.devices, 0);

    const groups = mixerTracks.filter((t) => t.kind === 'group').length;
    const returns = returnInserts.length;
    if (groups || returns) {
        converted.push(`Mixer: ${groups} group${groups === 1 ? '' : 's'} and ${returns} return${returns === 1 ? '' : 's'} routed as in Live${sendCount ? `, with ${sendCount} send${sendCount === 1 ? '' : 's'}` : ''}.`);
    }
    project.returnsPre.forEach((pre, i) => {
        if (pre && returnInserts[i]) {
            warnings.push(`Return "${project.tracks.filter((t) => t.kind === 'return')[i].name}" was pre-fader in Live — FL sends are post-fader, so its level now follows each track's fader.`);
        }
    });

    // Tracks fed by a plugin's extra outputs (Live's "KT Out 2" and friends): that output plays on
    // their insert, which FL stores on the plugin as an offset from its channel's insert
    const pluginOutputs = new Map<string, Map<number, number>>();
    for (const t of project.tracks) {
        const out = t.pluginOutput, ins = insertOf.get(t);
        if (!out || ins === undefined) continue;
        const outs = pluginOutputs.get(out.trackId) ?? new Map<number, number>();
        outs.set(out.output, ins);
        pluginOutputs.set(out.trackId, outs);
    }
    let outputTracks = 0;

    let padInserts = 0, rackReturnInserts = 0;

    const playable = project.tracks.filter((t) => (t.kind === 'midi' || t.kind === 'audio') && insertOf.has(t));
    playable.forEach((track, trackIdx) => {
        const insert = insertOf.get(track)!;
        tracks.push({ name: track.name, color: track.color });

        if (track.kind === 'midi') {
            // Creates the channel(s) for an instrument; returns route(liveKey, velocity) → the channels
            // that play that note, at which FL key (several for layered racks, none if unmapped)
            type Route = (key: number, velocity: number) => { channel: number; key: number }[];

            // A sampler's channels: one for a single sample; for multi-sample instruments one per
            // zone, with each note going to every zone covering its key and velocity (overlapping
            // zones layer in Live) — or to one of them in turn when Live round-robins them
            const zoneRoute = (zone: ConvSamplerZone, baseName: string, ins: number): Route => {
                const parts = zone.parts;
                if (!parts) {
                    const channel = channels.length;
                    channels.push({ name: baseName, color: track.color, type: CHANNEL_SAMPLER, insert: ins, samplePath: registerSample(zone.sample, zone.trim) });
                    return (key) => [{ channel, key: flKey(key, zone) }];
                }
                const partChannels = parts.map((p) => {
                    channels.push({ name: `${baseName} – ${p.name}`, color: track.color, type: CHANNEL_SAMPLER, insert: ins, samplePath: registerSample(p.sample, p.trim) });
                    return channels.length - 1;
                });
                let turn = 0, seed = 0x2545f491;
                return (key, velocity) => {
                    const hits = parts.flatMap((p, i) => (key >= p.keyMin && key <= p.keyMax && velocity >= p.velMin && velocity <= p.velMax ? [i] : []));
                    let chosen = hits;
                    if (zone.roundRobin && hits.length > 1) {
                        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                        chosen = [hits[zone.roundRobin === 'random' ? seed % hits.length : turn++ % hits.length]];
                    }
                    return chosen.map((i) => ({ channel: partChannels[i], key: key - parts[i].rootKey + 60 + zone.transpose }));
                };
            };

            const setup = (inst: ConvInstrument | null, name: string): Route => {
                if (inst?.kind === 'plugin') {
                    const channel = channels.length;
                    const fl = flPlugin(inst.plugin);
                    // Its extra outputs feed the inserts of the tracks that took them in Live
                    const outs = pluginOutputs.get(track.id);
                    if (outs?.size) {
                        const last = Math.max(...outs.keys());
                        fl.outputRouting = Array.from({ length: last + 1 }, (_, i) => (outs.get(i) ?? insert) - insert);
                        outputTracks += outs.size;
                        converted.push(`"${name}": ${outs.size} extra plugin output${outs.size === 1 ? '' : 's'} → the mixer inserts of the tracks that took them in Live.`);
                    }
                    channels.push({ name, color: track.color, type: CHANNEL_SAMPLER, insert, plugin: fl });
                    pluginChannel.set(inst.plugin, channel);
                    notePlugin(inst.plugin, name, [track.name, ...track.devices]);
                    converted.push(`"${name}": ${inst.plugin.name} → loaded with its preset.`);
                    return (key) => [{ channel, key }];
                }
                if (inst?.kind === 'drumRack') {
                    // One Sampler channel per pad, like an FL drum kit; every pad plays on C5
                    const pads = new Map<number, (velocity: number) => { channel: number; key: number }[]>();
                    // A rack chain (pad or return) as its own insert feeding the drum track's insert, at
                    // the chain's level — as the chain feeds the rack. Returns 0 when FL's mixer is full.
                    const chainInsert = (chain: ConvChain, extraRoutes: FlInsert['routes'] = []): number => {
                        if (nextInsert > MAX_TRACKS) return 0;
                        const ins = nextInsert++;
                        inserts.push({
                            insert: ins, name: `${name} – ${chain.name}`, color: track.color, routes: [{ to: insert }, ...extraRoutes],
                            volume: flFader(chain.volume), pan: chain.pan * FL_PAN_RANGE,
                        });
                        placeEffects(`${name} › ${chain.name}`, chain.effects, chain.devices, ins);
                        return ins;
                    };
                    // The rack's returns (Live shows them as the rack's return chains)
                    const rackReturns = inst.returns.map((r, i) => {
                        if (!r.effects.length) return 0;
                        const ins = chainInsert(r);
                        if (!ins) { warnings.push(`"${name} › ${r.name}": FL's mixer is full, so this return was left off.`); return 0; }
                        rackReturnInserts++;
                        if (!inst.pads.some((p) => (p.chain?.sends[i] ?? 0) > SEND_OFF)) {
                            warnings.push(`"${name} › ${r.name}": no pad sends to this return in Live either — route a pad's insert to insert ${ins} in FL to use it.`);
                        }
                        return ins;
                    });
                    for (const pad of inst.pads) {
                        // A pad with its own effects or sends gets its own insert: effects sit there, and
                        // sends leave from there (FL channels feed one insert; inserts can send)
                        let padInsert = insert;
                        const chain = pad.chain;
                        const sends: FlInsert['routes'] = (chain?.sends ?? []).flatMap((gain, i) =>
                            rackReturns[i] && gain > SEND_OFF ? [{ to: rackReturns[i], level: Math.min(1, flLevel(gain)) }] : []);
                        if (chain && (chain.effects.length || sends.length)) {
                            padInsert = chainInsert(chain, sends) || insert;
                            if (padInsert === insert) warnings.push(`"${name} › ${pad.name}": FL's mixer is full, so this pad's effects and sends were left off.`);
                            else padInserts++;
                        } else if (chain?.devices.length) {
                            placeEffects(`${name} › ${pad.name}`, [], chain.devices, insert);
                        }
                        // The pad's sampler hears the pad's sending note
                        const first = channels.length;
                        const padRoute = zoneRoute(pad, pad.name, padInsert);
                        // A pad on the drum track's insert takes its chain's level on its channel (pads
                        // with their own insert have it on that insert's fader)
                        if (chain && padInsert === insert) chainLevel(first, channels.length, chain.volume, chain.pan);
                        pads.set(pad.triggerNote!, (velocity) => padRoute(pad.sendingNote ?? 60, velocity));
                        zoneWarnings(name, pad);
                    }
                    // Pads holding a synth or Max device: an empty channel keeps their notes
                    for (const pad of inst.otherPads) {
                        const channel = channels.length;
                        pads.set(pad.triggerNote, () => [{ channel, key: 60 }]);
                        channels.push({ name: pad.name, color: track.color, type: CHANNEL_SAMPLER, insert });
                        warnings.push(`"${name}": pad "${pad.name}" used ${pad.device}, which can't come across — it has an empty channel with its notes; load a sound there in FL.`);
                    }
                    const multi = inst.pads.filter((p) => p.parts);
                    converted.push(multi.length
                        ? `"${name}": ${inst.device} → Sampler channels for ${inst.pads.length} pads; ${multi.map((p) => `"${p.name}"`).join(', ')} ${multi.length === 1 ? 'uses' : 'use'} several samples, each on its own channel${multi.some((p) => p.roundRobin) ? ' (round-robin as in Live)' : ''}.`
                        : `"${name}": ${inst.device} → ${inst.pads.length} Sampler channels, one per pad.`);
                    return (key, velocity) => pads.get(key)?.(velocity) ?? [];
                }
                if (inst?.kind === 'simpler' && inst.zone.mode === 'slice' && inst.zone.slices?.length) {
                    // Sliced Simpler → Fruity Slicer holding the loop at Live's slice points.
                    // Live plays slice n on C1 + n; Fruity Slicer on C5 + n.
                    const channel = channels.length;
                    const zone = inst.zone;
                    const slices = zone.slices!;
                    // Warp off in Live → slices at original speed: state the song's tempo so Auto-fit is a no-op.
                    // Warp on → the warped length, so Auto-fit stretches the slices as Live did.
                    const seconds = zone.sampleSeconds ?? 0;
                    const beats = zone.sliceWarped && zone.sampleBeats ? zone.sampleBeats : (seconds * project.bpm) / 60;
                    const state = fruitySlicerState({ samplePath: registerSample(zone.sample), sampleRate: zone.sampleRate, slices, beats, seconds });
                    channels.push({ name, color: track.color, type: CHANNEL_SAMPLER, insert, native: { name: FRUITY_SLICER, state } });
                    converted.push(`"${name}": sliced ${inst.device} → Fruity Slicer with the same ${slices.length} slices.`);
                    if (zone.sliceStyle === 'beat') warnings.push(`"${name}": slices were made on a beat grid in Live — check they line up in Fruity Slicer.`);
                    return (key) => {
                        const n = key - LIVE_FIRST_SLICE_KEY;
                        return n >= 0 && n < slices.length ? [{ channel, key: SLICER_FIRST_KEY + n }] : [];
                    };
                }
                if (inst?.kind === 'simpler') {
                    const zone = inst.zone;
                    zoneWarnings(name, zone);
                    if (zone.parts) {
                        converted.push(`"${name}": ${inst.device} → ${zone.parts.length} Sampler channels, one per sample zone${zone.roundRobin ? ', taking turns (round-robin) as in Live' : ''}.`);
                    } else {
                        converted.push(`"${name}": ${inst.device} → Sampler with "${zone.sample.file}".`);
                        const shift = flKey(0, zone);
                        if (shift !== 0) {
                            warnings.push(`"${name}": notes were shifted ${shift > 0 ? '+' : ''}${shift} semitones so "${zone.name}" plays at the same pitch as in Live.`);
                        }
                    }
                    return zoneRoute(zone, name, insert);
                }
                if (inst?.kind === 'layers') {
                    // Each rack chain becomes its own channel; notes go to every chain whose key and velocity zones hold them
                    const routes = inst.layers.map((layer) => {
                        const first = channels.length;
                        const route = setup(layer.instrument, `${track.name} – ${layer.name}`);
                        chainLevel(first, channels.length, layer.volume, layer.pan);
                        return { layer, route };
                    });
                    converted.push(`"${track.name}": ${inst.device} → ${inst.layers.length} layered channels (${inst.layers.map((l) => l.name).join(', ')}), at the chains' levels.`);
                    return (key, velocity) => routes.flatMap(({ layer, route }) =>
                        (key >= layer.keyMin && key <= layer.keyMax && velocity >= layer.velMin && velocity <= layer.velMax ? route(key, velocity) : []));
                }
                const channel = channels.length;
                channels.push({ name, color: track.color, type: CHANNEL_SAMPLER, insert });
                return (key) => [{ channel, key }];
            };
            const route = setup(track.instrument, track.name);

            let unmapped = 0;
            for (const clip of track.clips) {
                if (clip.kind !== 'midi' || clip.length <= 0) continue;
                const clipNotes: FlPattern['notes'] = [];
                for (const n of clip.notes) {
                    const targets = route(n.key, n.velocity).filter((r) => r.key >= 0 && r.key <= 131);
                    if (!targets.length) { unmapped++; continue; }
                    for (const r of targets) {
                        clipNotes.push({ channel: r.channel, pos: n.time, length: n.duration, key: r.key, velocity: n.velocity });
                    }
                }
                patterns.push({ name: clip.name || track.name, color: clip.color, notes: clipNotes });
                items.push({ kind: 'pattern', pattern: patterns.length, track: trackIdx, start: clip.start, length: clip.length, muted: clip.muted });
                notes += clipNotes.length;
                midiClips++;
            }
            if (unmapped) warnings.push(`"${track.name}": ${unmapped} notes had no drum pad or were out of FL's range and were dropped.`);
            return;
        }

        for (const clip of track.clips) {
            if (clip.kind !== 'audio' || clip.length <= 0) continue;
            const outputPath = registerSample(clip.sample);
            // Warped clips: FL stretches the channel's sample to the same length in beats as Live did.
            // Stretch is per channel, so one file used at two different stretches gets two channels.
            const stretch = clip.warped ? clip.sampleBeats : undefined;
            const key = stretch ? `${outputPath}|${stretch.toFixed(3)}` : outputPath;
            let channel = audioChannels.get(key);
            if (channel === undefined) {
                channel = channels.length;
                channels.push({ name: clip.sample.file.replace(/\.[^.]+$/, ''), color: track.color, type: CHANNEL_AUDIO_CLIP, insert, samplePath: outputPath, stretchBeats: stretch });
                audioChannels.set(key, channel);
            }
            const bar = Math.floor(clip.start / project.numerator) + 1;
            if (clip.warped && !stretch) {
                warnings.push(`"${track.name}" @ bar ${bar}: "${clip.name}" was warped in Live but its warp markers couldn't be read — check its timing in FL.`);
            } else if (clip.complexWarp) {
                warnings.push(`"${track.name}" @ bar ${bar}: "${clip.name}" had several warp markers in Live — FL stretches it evenly, so check its timing.`);
            }
            // Offsets in beats of (stretched) audio; unwarped clips store theirs in seconds
            const offsetBeats = clip.warped ? clip.sampleOffset : (clip.sampleOffset * project.bpm) / 60;
            // Live allows a clip to start before its sample (negative offset = leading silence); FL doesn't
            const lead = Math.max(0, -offsetBeats);
            if (clip.length - lead <= 0) continue;
            // Fades in ms (FL's unit): Live keeps them in beats for warped clips, seconds otherwise
            const toMs = (v: number) => (clip.warped ? (v * 60000) / project.bpm : v * 1000);
            const fade = { gain: clip.gain, fadeInMs: toMs(clip.fadeIn), fadeOutMs: toMs(clip.fadeOut) };
            if (clip.loopPasses && clip.loopPasses.length > 1) {
                // A looped clip becomes one playlist clip per pass through its loop; the clip's fade-in
                // goes on the first pass and its fade-out on the last
                const passes = clip.loopPasses.filter((pass) => pass.length - Math.max(0, -pass.from) > 0);
                passes.forEach((pass, n) => {
                    const skip = Math.max(0, -pass.from);
                    items.push({
                        kind: 'audio', channel, track: trackIdx, muted: clip.muted,
                        start: clip.start + pass.at + skip, length: pass.length - skip, offset: pass.from + skip,
                        gain: fade.gain,
                        fadeInMs: n === 0 ? fade.fadeInMs : 0,
                        fadeOutMs: n === passes.length - 1 ? fade.fadeOutMs : 0,
                    });
                });
            } else {
                items.push({
                    kind: 'audio', channel, track: trackIdx, muted: clip.muted,
                    start: clip.start + lead, length: clip.length - lead, offset: offsetBeats + lead,
                    ...fade,
                });
            }
            audioClips++;
        }
    });

    // ── Automation: one FL automation clip per automated lane, on its own playlist track ──
    const automationTargets: FlAutomationTarget[] = [];
    let automationClips = 0, vst3Params = 0, unsupported = 0;
    const automationOwner = new Map<number, number>();   // automation playlist track → the track it sits under
    const playlistTrackOf = new Map(playable.map((t, i) => [t, i]));
    const addClip = (name: string, color: string | null, points: FlAutomationPoint[], target: { param: number; dest: number }, owner?: ConvTrack) => {
        const channel = channels.length;
        channels.push({ name, color, type: CHANNEL_SAMPLER, insert: 0, automation: points });
        automationTargets.push({ channel, ...target });
        const track = tracks.length;
        tracks.push({ name, color });
        const ownerIdx = owner && playlistTrackOf.get(owner);
        if (ownerIdx !== undefined) automationOwner.set(track, ownerIdx);
        items.push({ kind: 'automation', channel, track, start: 0, length: Math.max(4, ...points.map((p) => p.time)) });
        automationClips++;
    };
    const mixerTarget = (insert: number, param: number) => ({ param: 0x1f00 | param, dest: 0x2000 + insert * 64 });

    /**
     * A track's automation with its volume/pan/send clip envelopes folded in: one lane per parameter
     * that follows the track's own automation (or its fixed setting) and, while a clip with an
     * envelope plays, the envelope — replacing the value ('set') or scaling volume/sends
     * (-1…1 = silent…unchanged) and offsetting pan ('modulate'). FL has no clip envelopes, so this is
     * where they can live.
     */
    let clipEnvelopeCount = 0;
    const withClipEnvelopes = (t: ConvTrack): ConvAutomation[] => {
        if (!t.clipEnvelopes.length) return t.automation;
        const same = (a: ConvAutomationTarget, b: ConvAutomationTarget) =>
            a.kind === b.kind && (a.kind !== 'send' || (b.kind === 'send' && a.index === b.index));
        // Linear interpolation over [{time, value}] points (held before the first and after the last)
        const at = (pts: { time: number; value: number }[], time: number) => {
            if (!pts.length) return 0;
            if (time <= pts[0].time) return pts[0].value;
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i];
                if (time <= b.time) return b.time === a.time ? b.value : a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time);
            }
            return pts[pts.length - 1].value;
        };
        const EDGE = 1 / 192;              // envelopes step in and out at the clip's edges
        const lanes = [...t.automation];
        const targets: ConvAutomationTarget[] = [];
        for (const e of t.clipEnvelopes) if (!targets.some((x) => same(x, e.target))) targets.push(e.target);
        for (const target of targets) {
            const idx = lanes.findIndex((a) => same(a.target, target));
            const fixed = target.kind === 'volume' ? t.volume : target.kind === 'pan' ? t.pan : target.kind === 'send' ? (t.sends[target.index] ?? 0) : 0;
            const base = idx >= 0 ? lanes[idx].points : [{ time: 0, value: fixed }];
            const envs = t.clipEnvelopes.filter((e) => same(e.target, target)).sort((a, b) => a.start - b.start);
            const combine = (mode: 'set' | 'modulate', b: number, v: number) =>
                mode === 'set' ? v : target.kind === 'pan' ? Math.max(-1, Math.min(1, b + v)) : b * Math.max(0, (v + 1) / 2);
            const inside = (time: number) => envs.some((e) => time >= e.start && time <= e.end);
            const out = base.filter((p) => !inside(p.time)).map((p) => ({ ...p }));
            for (const e of envs) {
                if (e.start > 0) out.push({ time: e.start - EDGE, value: at(base, e.start - EDGE) });
                // The envelope's own points in order (two at one time are a step — keep both), and the
                // track automation's points inside the clip, each combined with the other at that time
                const inner: { time: number; value: number }[] = [
                    ...e.points.map((p) => ({ time: p.time, value: combine(e.mode, at(base, p.time), p.value) })),
                    ...base.filter((p) => p.time > e.start && p.time < e.end).map((p) => ({ time: p.time, value: combine(e.mode, p.value, at(e.points, p.time)) })),
                ];
                out.push(...inner.map((p, i) => ({ ...p, order: i })).sort((a, b) => a.time - b.time || a.order - b.order).map(({ time, value }) => ({ time, value })));
                out.push({ time: e.end + EDGE, value: at(base, e.end + EDGE) });
            }
            out.sort((a, b) => a.time - b.time);
            if (idx >= 0) lanes[idx] = { target, points: out };
            else lanes.push({ target, points: out });
        }
        return lanes;
    };
    const scale = (a: ConvAutomation, f: (v: number) => number) => a.points.map((p) => ({ time: p.time, value: f(p.value) }));

    for (const [t, insert] of insertOf) {
        unsupported += t.otherAutomation;
        clipEnvelopeCount += t.clipEnvelopes.length;
        if (t.otherClipEnvelopes) {
            warnings.push(`"${t.name}": ${t.otherClipEnvelopes} envelope${t.otherClipEnvelopes === 1 ? '' : 's'} drawn inside clips on device settings or pitch bend ${t.otherClipEnvelopes === 1 ? 'was' : 'were'} not converted.`);
        }
        for (const a of withClipEnvelopes(t)) {
            const tg = a.target;
            if (tg.kind === 'volume') addClip(`${t.name} – Volume`, t.color, scale(a, (v) => flFader(v) / FL_FADER_MAX), mixerTarget(insert, MIXER_VOLUME), t);
            else if (tg.kind === 'pan') addClip(`${t.name} – Pan`, t.color, scale(a, (v) => (v + 1) / 2), mixerTarget(insert, MIXER_PAN), t);
            else if (tg.kind === 'send') {
                const to = returnInserts[tg.index];
                if (to) addClip(`${t.name} – Send ${String.fromCharCode(65 + tg.index)}`, t.color, scale(a, (v) => Math.min(1, flLevel(v))), mixerTarget(insert, 64 + to), t);
            } else if (tg.kind === 'plugin') {
                // VST2 parameter ids are already indices; a VST3's is its place in the id list we wrote
                let index = tg.param;
                if (tg.plugin.format === 'vst3') {
                    index = tg.plugin.paramIds.indexOf(tg.param);
                    if (index < 0) { vst3Params++; continue; }
                }
                const channel = pluginChannel.get(tg.plugin);
                const slot = pluginSlot.get(tg.plugin);
                const dest = channel !== undefined ? channel : slot ? 0x2000 + slot.insert * 64 + slot.slot : undefined;
                if (dest === undefined) { unsupported++; continue; }
                addClip(`${t.name} – ${tg.plugin.name} ${tg.paramName}`, t.color, a.points, { param: 0x8000 + index, dest }, t);
            }
        }
    }
    if (project.tempoAutomation) {
        const pts = project.tempoAutomation.points;
        // FL's tempo spans 10–522 BPM; the clip covers all of it (see the writer's automation range)
        addClip('Tempo', null, pts.map((p) => ({ time: p.time, value: Math.min(1, Math.max(0, (p.value - FL_TEMPO_MIN) / FL_TEMPO_SPAN)) })), { param: 0x0005, dest: 0x4000 });
    }
    if (spillInserts) converted.push(`Long effect chains: ${spillInserts} extra mixer insert${spillInserts === 1 ? '' : 's'} chained on, so chains of more than ${MIXER_SLOTS} effects carry over in full.`);
    if (rackReturnInserts) converted.push(`Drum Rack return chains: ${rackReturnInserts} → their own mixer inserts, fed by the pads that send to them.`);
    if (padInserts) converted.push(`Drum pads with their own effects or sends: ${padInserts} → their own mixer inserts, routed into their drum track.`);
    if (clipEnvelopeCount) converted.push(`Clip envelopes: ${clipEnvelopeCount} volume/pan/send envelope${clipEnvelopeCount === 1 ? '' : 's'} drawn inside clips → folded into the tracks' automation clips.`);
    if (automationClips) converted.push(`Automation: ${automationClips} lane${automationClips === 1 ? '' : 's'} → FL automation clips.`);
    if (project.timeSignatures.length) converted.push(`${project.timeSignatures.length} time-signature change${project.timeSignatures.length === 1 ? '' : 's'} → playlist markers.`);
    if (vst3Params) warnings.push(`${vst3Params} automated VST3 plugin parameter${vst3Params === 1 ? ' was' : 's were'} not converted — redraw ${vst3Params === 1 ? 'it' : 'them'} in FL.`);
    if (unsupported) warnings.push(`${unsupported} automated parameter${unsupported === 1 ? '' : 's'} on Ableton's own devices ha${unsupported === 1 ? 's' : 've'} no FL equivalent and ${unsupported === 1 ? 'was' : 'were'} skipped.`);

    if (automationOwner.size) {
        const order: number[] = [];
        playable.forEach((_, i) => {
            order.push(i);
            for (const [auto, owner] of automationOwner) if (owner === i) order.push(auto);
        });
        tracks.forEach((_, i) => { if (!order.includes(i)) order.push(i); });
        const newIndex = new Map(order.map((old, i) => [old, i]));
        const reordered = order.map((old) => ({ ...tracks[old], grouped: automationOwner.has(old) }));
        tracks.splice(0, tracks.length, ...reordered);
        for (const it of items) it.track = newIndex.get(it.track)!;
    }

    if (channels.length === 0) {
        channels.push({ name: 'Sampler', color: null, type: CHANNEL_SAMPLER, insert: 0 });
    }
    if (pluginsNeeded.size) {
        warnings.unshift(`Install these plugins for FL Studio before opening the project: ${[...pluginsNeeded].join(', ')}. Any that are missing will show FL's "plugin not found" message.`);
    }

    const flp = writeFlp({
        title: project.name,
        comments: `Converted from ${project.source} with Fuji Studio — ${FUJI_URL}`,
        url: FUJI_URL,
        bpm: project.bpm,
        numerator: project.numerator,
        denominator: project.denominator,
        channels,
        patterns,
        items,
        tracks,
        markers: project.locators.map((l) => ({ pos: l.time, name: l.name })),
        insertEffects,
        inserts,
        automationTargets,
        signatures: project.timeSignatures.map((s) => ({ pos: s.time, numerator: s.numerator, denominator: s.denominator })),
    });

    return {
        flp,
        project,
        samples,
        report: {
            source: project.source,
            target: 'FL Studio 21+',
            stats: { tracks: tracks.length, midiClips, audioClips, notes, samples: samples.length },
            plugins: [...pluginsNeeded].sort((a, b) => a.localeCompare(b)),
            libraries: librariesUsed,
            deviceNotes: [...skippedDevices].filter((d) => DEVICE_NOTES[d]).sort().map((device) => ({ device, why: DEVICE_NOTES[device] })),
            converted,
            warnings,
        },
    };
}
