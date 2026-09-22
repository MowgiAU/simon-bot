/**
 * Ableton Live (.als) → FL Studio (.flp) conversion.
 *
 * Mapping:
 *   MIDI track   → one playlist track; each arrangement MIDI clip becomes its own pattern on it.
 *     Drum Rack  → one Sampler channel per pad, loaded with the pad's sample (like an FL kit).
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
import type { ConversionReport, ConvAutomation, ConvEffect, ConvInstrument, ConvPlugin, ConvProject, ConvSampleRef, ConvSamplerZone, ConvTrack } from './types.js';

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
const FL_TEMPO_MIN = 10, FL_TEMPO_SPAN = 512;   // FL tempo: 10–522 BPM
const flFader = (gain: number) => Math.min(FL_FADER_MAX, FL_FADER_UNITY * flLevel(gain));

export interface AlsToFlpOptions {
    projectName?: string;
    /** Folder (relative to the .flp) the samples will be shipped in, e.g. 'Samples'. */
    sampleFolder?: string;
}

export interface AlsToFlpResult {
    flp: Buffer;
    project: ConvProject;
    report: ConversionReport;
    /** Samples referenced by the output, with where they were on the source machine. */
    samples: { fileName: string; outputPath: string; sourcePath: string; sourceRelPath: string }[];
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

    /** Adds a sample to the output bundle once; returns its path relative to the .flp. */
    const registerSample = (ref: ConvSampleRef): string => {
        const key = ref.path || ref.relPath;
        const existing = samplePaths.get(key);
        if (existing) return existing;
        // Disambiguate identical file names from different folders
        const taken = samples.filter((s) => s.fileName.toLowerCase() === ref.file.toLowerCase()).length;
        const fileName = taken ? ref.file.replace(/(\.[^.]+)?$/, ` (${taken + 1})$1`) : ref.file;
        const outputPath = `${sampleFolder}/${fileName}`;
        samples.push({ fileName, outputPath, sourcePath: ref.path, sourceRelPath: ref.relPath });
        samplePaths.set(key, outputPath);
        return outputPath;
    };

    /** FL's Sampler plays a sample at original pitch on C5 (60); Live plays it on rootKey. */
    const flKey = (liveKey: number, zone: ConvSamplerZone) => liveKey - zone.rootKey + 60 + zone.transpose;

    const zoneWarnings = (track: string, zone: ConvSamplerZone) => {
        if (zone.mode === 'slice' && !zone.slices?.length) {
            warnings.push(`"${track}": "${zone.name}" was a sliced Simpler — the whole sample is loaded; re-slice it in FL (e.g. Slicex).`);
        }
        if (zone.sampleCount > 1) {
            warnings.push(`"${track}": "${zone.name}" used ${zone.sampleCount} samples (round-robin / layers) — only "${zone.sample.file}" was loaded.`);
        }
        if (zone.sampleStart > 0) {
            warnings.push(`"${track}": "${zone.name}" had its sample start moved in Live — trim the start in FL's Sampler.`);
        }
    };

    const insertEffects: FlInsertEffects[] = [];
    const pluginsNeeded = new Set<string>();
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
            }
            : {
                format: 'vst2', name: p.name, kind, path: p.path,
                uniqueId: p.uniqueId, vstVersion: p.vstVersion, chunk: p.chunk, params: p.params,
            };
    };
    const notePlugin = (p: ConvPlugin) => {
        pluginsNeeded.add(p.name);
        if (!p.enabled) warnings.push(`${p.name} was switched off in Live — it's active in FL; bypass it there if needed.`);
    };

    /**
     * Puts a track's effects on its mixer insert, in chain order: VSTs as themselves, Live's own
     * effects as FL's equivalents (LiveEffects.ts). Reports the rest.
     */
    const placeEffects = (name: string, effects: ConvEffect[], devices: string[], insert: number) => {
        const skipped = [...devices];
        const slots: FlInsertEffects['plugins'] = [];
        const placed: string[] = [];
        const leftOff: string[] = [];
        for (const e of effects) {
            if (e.format === 'live') {
                const fl = liveEffectToFl(e, { bpm: project.bpm });
                if (!fl) { skipped.push(e.name); continue; }
                for (const note of fl.notes) warnings.push(`"${name}": ${e.name} — ${note}.`);
                if (!fl.effects.length) continue;               // does nothing at these settings
                if (slots.length + fl.effects.length > MIXER_SLOTS) { leftOff.push(e.name); continue; }
                slots.push(...fl.effects);
                placed.push(`${e.name} (as ${LIVE_EFFECT_TARGETS[e.device]})`);
                if (!e.enabled) warnings.push(`"${name}": ${e.name} was switched off in Live — it's active in FL; bypass it there if needed.`);
                continue;
            }
            if (slots.length >= MIXER_SLOTS) { leftOff.push(e.name); continue; }
            pluginSlot.set(e, { insert, slot: slots.length });
            slots.push(flPlugin(e));
            placed.push(e.name);
            notePlugin(e);
        }
        if (skipped.length) warnings.push(`"${name}": devices not converted — ${skipped.join(', ')}.`);
        if (leftOff.length) warnings.push(`"${name}": an FL mixer insert holds ${MIXER_SLOTS} effects — ${leftOff.join(', ')} ${leftOff.length === 1 ? 'was' : 'were'} left off.`);
        if (!slots.length) return;
        insertEffects.push({ insert, plugins: slots });
        converted.push(`"${name}": ${placed.join(', ')} → ${insert ? `mixer insert ${insert}` : 'the master'}, with their settings.`);
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

    const playable = project.tracks.filter((t) => (t.kind === 'midi' || t.kind === 'audio') && insertOf.has(t));
    playable.forEach((track, trackIdx) => {
        const insert = insertOf.get(track)!;
        tracks.push({ name: track.name, color: track.color });

        if (track.kind === 'midi') {
            // Creates the channel(s) for an instrument; returns route(liveKey) → the channels
            // that play that note, at which FL key (several for layered racks, none if unmapped)
            type Route = (key: number) => { channel: number; key: number }[];
            const setup = (inst: ConvInstrument | null, name: string): Route => {
                if (inst?.kind === 'plugin') {
                    const channel = channels.length;
                    channels.push({ name, color: track.color, type: CHANNEL_SAMPLER, insert, plugin: flPlugin(inst.plugin) });
                    pluginChannel.set(inst.plugin, channel);
                    notePlugin(inst.plugin);
                    converted.push(`"${name}": ${inst.plugin.name} → loaded with its preset.`);
                    return (key) => [{ channel, key }];
                }
                if (inst?.kind === 'drumRack') {
                    // One Sampler channel per pad, like an FL drum kit; every pad plays on C5
                    const pads = new Map<number, { channel: number; key: number }>();
                    for (const pad of inst.pads) {
                        pads.set(pad.triggerNote!, { channel: channels.length, key: flKey(pad.sendingNote ?? 60, pad) });
                        channels.push({ name: pad.name, color: track.color, type: CHANNEL_SAMPLER, insert, samplePath: registerSample(pad.sample) });
                        zoneWarnings(name, pad);
                    }
                    // Pads holding a synth or Max device: an empty channel keeps their notes
                    for (const pad of inst.otherPads) {
                        pads.set(pad.triggerNote, { channel: channels.length, key: 60 });
                        channels.push({ name: pad.name, color: track.color, type: CHANNEL_SAMPLER, insert });
                        warnings.push(`"${name}": pad "${pad.name}" used ${pad.device}, which can't come across — it has an empty channel with its notes; load a sound there in FL.`);
                    }
                    converted.push(`"${name}": ${inst.device} → ${inst.pads.length} Sampler channels, one per pad.`);
                    return (key) => { const pad = pads.get(key); return pad ? [pad] : []; };
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
                    const channel = channels.length;
                    const zone = inst.zone;
                    channels.push({ name, color: track.color, type: CHANNEL_SAMPLER, insert, samplePath: registerSample(zone.sample) });
                    zoneWarnings(name, zone);
                    converted.push(`"${name}": ${inst.device} → Sampler with "${zone.sample.file}".`);
                    const shift = flKey(0, zone);
                    if (shift !== 0) {
                        warnings.push(`"${name}": notes were shifted ${shift > 0 ? '+' : ''}${shift} semitones so "${zone.name}" plays at the same pitch as in Live.`);
                    }
                    return (key) => [{ channel, key: flKey(key, zone) }];
                }
                if (inst?.kind === 'layers') {
                    // Each rack chain becomes its own channel; notes go to every chain whose key zone holds them
                    const routes = inst.layers.map((layer) => ({ layer, route: setup(layer.instrument, `${track.name} – ${layer.name}`) }));
                    converted.push(`"${track.name}": ${inst.device} → ${inst.layers.length} layered channels (${inst.layers.map((l) => l.name).join(', ')}).`);
                    if (inst.layers.some((l) => Math.abs(l.volume - inst.layers[0].volume) > 0.01)) {
                        warnings.push(`"${track.name}": the rack's chains had different volumes in Live — balance the layered channels in FL.`);
                    }
                    return (key) => routes.flatMap(({ layer, route }) => (key >= layer.keyMin && key <= layer.keyMax ? route(key) : []));
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
                    const targets = route(n.key).filter((r) => r.key >= 0 && r.key <= 131);
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
    const scale = (a: ConvAutomation, f: (v: number) => number) => a.points.map((p) => ({ time: p.time, value: f(p.value) }));

    for (const [t, insert] of insertOf) {
        unsupported += t.otherAutomation;
        for (const a of t.automation) {
            const tg = a.target;
            if (tg.kind === 'volume') addClip(`${t.name} – Volume`, t.color, scale(a, (v) => flFader(v) / FL_FADER_MAX), mixerTarget(insert, MIXER_VOLUME), t);
            else if (tg.kind === 'pan') addClip(`${t.name} – Pan`, t.color, scale(a, (v) => (v + 1) / 2), mixerTarget(insert, MIXER_PAN), t);
            else if (tg.kind === 'send') {
                const to = returnInserts[tg.index];
                if (to) addClip(`${t.name} – Send ${String.fromCharCode(65 + tg.index)}`, t.color, scale(a, (v) => Math.min(1, flLevel(v))), mixerTarget(insert, 64 + to), t);
            } else if (tg.kind === 'plugin') {
                // VST2 parameter ids are indices; a VST3's FL index can't be known without loading it
                if (tg.plugin.format !== 'vst2') { vst3Params++; continue; }
                const channel = pluginChannel.get(tg.plugin);
                const slot = pluginSlot.get(tg.plugin);
                const dest = channel !== undefined ? channel : slot ? 0x2000 + slot.insert * 64 + slot.slot : undefined;
                if (dest === undefined) { unsupported++; continue; }
                addClip(`${t.name} – ${tg.plugin.name} ${tg.paramName}`, t.color, a.points, { param: 0x8000 + tg.param, dest }, t);
            }
        }
    }
    if (project.tempoAutomation) {
        const pts = project.tempoAutomation.points;
        // FL's tempo spans 10–522 BPM; the clip covers all of it (see the writer's automation range)
        addClip('Tempo', null, pts.map((p) => ({ time: p.time, value: Math.min(1, Math.max(0, (p.value - FL_TEMPO_MIN) / FL_TEMPO_SPAN)) })), { param: 0x0005, dest: 0x4000 });
    }
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
            converted,
            warnings,
        },
    };
}
