/**
 * Ableton Live (.als) → FL Studio (.flp) conversion.
 *
 * Mapping:
 *   MIDI track   → one playlist track; each arrangement MIDI clip becomes its own pattern on it.
 *     Drum Rack  → one Sampler channel per pad, loaded with the pad's sample (like an FL kit).
 *     Simpler    → one Sampler channel loaded with the sample; notes shifted to keep pitch.
 *     other      → one empty Sampler channel named after the track.
 *   Audio track  → one playlist track; each distinct sample becomes an audio-clip channel.
 *   Locators     → playlist time markers.
 *   Each converted track is routed to its own mixer insert, in track order.
 * Instruments and effects can't carry over — they're listed in the report instead.
 */
import { readAls } from './AlsReader.js';
import { CHANNEL_AUDIO_CLIP, CHANNEL_SAMPLER, writeFlp } from './FlpWriter.js';
import type { FlChannel, FlItem, FlPattern, FlTrack } from './FlpWriter.js';
import type { ConversionReport, ConvProject, ConvSampleRef, ConvSamplerZone } from './types.js';

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
        if (zone.mode === 'slice') {
            warnings.push(`"${track}": "${zone.name}" was a sliced Simpler — the whole sample is loaded; re-slice it in FL (e.g. Slicex).`);
        }
        if (zone.sampleCount > 1) {
            warnings.push(`"${track}": "${zone.name}" used ${zone.sampleCount} samples (round-robin / layers) — only "${zone.sample.file}" was loaded.`);
        }
        if (zone.sampleStart > 0) {
            warnings.push(`"${track}": "${zone.name}" had its sample start moved in Live — trim the start in FL's Sampler.`);
        }
    };

    const convertible = project.tracks.filter((t) => t.kind === 'midi' || t.kind === 'audio');
    if (convertible.length > MAX_TRACKS) {
        warnings.push(`Only the first ${MAX_TRACKS} tracks were converted (the set has ${convertible.length}).`);
    }

    convertible.slice(0, MAX_TRACKS).forEach((track, trackIdx) => {
        const insert = trackIdx + 1;
        tracks.push({ name: track.name, color: track.color });

        if (track.devices.length) {
            warnings.push(`"${track.name}": devices not converted — ${track.devices.join(', ')}.`);
        }

        if (track.kind === 'midi') {
            // route(liveKey) → which channel plays it, at which FL key
            let route: (key: number) => { channel: number; key: number } | null;
            const inst = track.instrument;

            if (inst?.kind === 'drumRack') {
                // One Sampler channel per pad, like an FL drum kit; every pad plays on C5
                const pads = new Map<number, { channel: number; key: number }>();
                for (const pad of inst.pads) {
                    pads.set(pad.triggerNote!, { channel: channels.length, key: flKey(pad.sendingNote ?? 60, pad) });
                    channels.push({ name: pad.name, color: track.color, type: CHANNEL_SAMPLER, insert, samplePath: registerSample(pad.sample) });
                    zoneWarnings(track.name, pad);
                }
                converted.push(`"${track.name}": ${inst.device} → ${inst.pads.length} Sampler channels, one per pad.`);
                route = (key) => pads.get(key) ?? null;
            } else if (inst?.kind === 'simpler') {
                const channel = channels.length;
                const zone = inst.zone;
                channels.push({ name: track.name, color: track.color, type: CHANNEL_SAMPLER, insert, samplePath: registerSample(zone.sample) });
                zoneWarnings(track.name, zone);
                converted.push(`"${track.name}": ${inst.device} → Sampler with "${zone.sample.file}".`);
                const shift = flKey(0, zone);
                if (shift !== 0) {
                    warnings.push(`"${track.name}": notes were shifted ${shift > 0 ? '+' : ''}${shift} semitones so "${zone.name}" plays at the same pitch as in Live.`);
                }
                route = (key) => ({ channel, key: flKey(key, zone) });
            } else {
                const channel = channels.length;
                channels.push({ name: track.name, color: track.color, type: CHANNEL_SAMPLER, insert });
                route = (key) => ({ channel, key });
            }

            let unmapped = 0;
            for (const clip of track.clips) {
                if (clip.kind !== 'midi' || clip.length <= 0) continue;
                const clipNotes: FlPattern['notes'] = [];
                for (const n of clip.notes) {
                    const r = route(n.key);
                    if (!r || r.key < 0 || r.key > 131) { unmapped++; continue; }
                    clipNotes.push({ channel: r.channel, pos: n.time, length: n.duration, key: r.key, velocity: n.velocity });
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
            let channel = audioChannels.get(outputPath);
            if (channel === undefined) {
                channel = channels.length;
                channels.push({ name: clip.sample.file.replace(/\.[^.]+$/, ''), color: clip.color, type: CHANNEL_AUDIO_CLIP, insert, samplePath: outputPath });
                audioChannels.set(outputPath, channel);
            }
            if (clip.warped) {
                warnings.push(`"${track.name}" @ bar ${Math.floor(clip.start / project.numerator) + 1}: "${clip.name}" was warped in Live — check its timing in FL.`);
            }
            // Live allows a clip to start before its sample (negative offset = leading silence); FL doesn't
            const lead = Math.max(0, -clip.sampleOffset);
            if (clip.length - lead <= 0) continue;
            items.push({
                kind: 'audio', channel, track: trackIdx, muted: clip.muted,
                start: clip.start + lead, length: clip.length - lead, offset: clip.sampleOffset + lead,
            });
            audioClips++;
        }
    });

    for (const t of project.tracks) {
        if (t.kind === 'return') warnings.push(`Return track "${t.name}" was not converted — rebuild sends on the FL mixer.`);
    }
    if (channels.length === 0) {
        channels.push({ name: 'Sampler', color: null, type: CHANNEL_SAMPLER, insert: 0 });
    }

    const flp = writeFlp({
        title: project.name,
        bpm: project.bpm,
        numerator: project.numerator,
        denominator: project.denominator,
        channels,
        patterns,
        items,
        tracks,
        markers: project.locators.map((l) => ({ pos: l.time, name: l.name })),
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
