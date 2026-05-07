/**
 * AlsParser — parses Ableton Live Set (.als) files.
 *
 * .als files are gzip-compressed XML. This parser:
 *   1. Decompresses with zlib.gunzipSync
 *   2. Parses the XML with fast-xml-parser
 *   3. Extracts tempo, time signature, tracks (with colors and clips), and VST names
 *   4. Returns the same shape as FLPParser so the frontend needs no branching.
 */
import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

// Ableton uses integer color indices. Mapping to hex.
const ABLETON_COLORS: Record<number, string> = {
    0: '#FF4B36', 1: '#FFA529', 2: '#C2A000', 3: '#9BC740',
    4: '#73B04A', 5: '#30ACE1', 6: '#2B93CC', 7: '#9C57D2',
    8: '#D86BBB', 9: '#C8A96E', 10: '#AFCC7E', 11: '#7ABEB8',
    12: '#7DC8EF', 13: '#A5C8FE', 14: '#C2AFFE', 15: '#E5AFDC',
    16: '#7B7B7B', 17: '#FF7654', 18: '#FFCA61', 19: '#D2E498',
    20: '#A8CC74', 21: '#75D9D6', 22: '#88D9F5', 23: '#C5D5FE',
    24: '#D5B2FE', 25: '#F4AEE6', 26: '#BBBBBB', 27: '#FF8C00',
};

function colorFromIndex(idx: number | undefined): string {
    return ABLETON_COLORS[idx ?? 0] ?? '#30ACE1';
}

// Ableton stores values as XML attributes: <Manual Value="128"/> or text content.
function attrVal(node: any): string | undefined {
    if (node == null) return undefined;
    if (typeof node === 'object') {
        const v = node['@_Value'] ?? node['Manual']?.['@_Value'] ?? node['Value'];
        if (v !== undefined) return String(v);
    }
    return String(node);
}

function toNum(node: any, fallback = 0): number {
    const v = attrVal(node);
    const n = v !== undefined ? parseFloat(v) : NaN;
    return isNaN(n) ? fallback : n;
}

function toInt(node: any, fallback = 0): number {
    const v = attrVal(node);
    const n = v !== undefined ? parseInt(v, 10) : NaN;
    return isNaN(n) ? fallback : n;
}

// Ensure a value is always an array (fast-xml-parser collapses single items).
function asArray<T>(v: T | T[] | undefined | null): T[] {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

export class AlsParser {
    static parse(buffer: Buffer): Record<string, unknown> {
        // Decompress — .als is always gzip
        let xml: string;
        try {
            xml = zlib.gunzipSync(buffer).toString('utf8');
        } catch {
            throw new Error('Failed to decompress .als file — not a valid gzip stream');
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            // These element names should always be arrays even with one child
            isArray: (name) => [
                'AudioTrack', 'MidiTrack', 'GroupTrack', 'ReturnTrack',
                'AudioClip', 'MidiClip',
                'PluginDevice', 'AuPluginDevice',
            ].includes(name),
        });

        const doc = parser.parse(xml);
        const liveset = doc?.Ableton?.LiveSet;
        if (!liveset) throw new Error('Not a valid Ableton Live Set — missing <LiveSet> element');

        // ── Tempo ──────────────────────────────────────────────────────────────
        const tempoNode = liveset?.MasterTrack?.DeviceChain?.Mixer?.Tempo;
        const bpm = toNum(tempoNode?.Manual ?? tempoNode?.AutomationTarget, 120);

        // ── Time signature ─────────────────────────────────────────────────────
        const tsSrc = liveset?.MasterTrack?.DeviceChain?.Mixer?.TimeSignature
            ?.TimeSignatures?.RemoteableTimeSignature;
        const tsArr = asArray(tsSrc);
        const tsNode = tsArr[0] ?? {};
        const numerator = toInt(tsNode?.Numerator, 4);
        const denominator = toInt(tsNode?.Denominator, 4);

        // ── Tracks ─────────────────────────────────────────────────────────────
        const rawTracks = liveset?.Tracks ?? {};
        const typeMap: Record<string, string> = {
            AudioTrack: 'audio',
            MidiTrack: 'midi',
            GroupTrack: 'group',
            ReturnTrack: 'return',
        };
        const tracks: Record<string, unknown>[] = [];
        const plugins = new Set<string>();
        let trackIndex = 0;

        for (const [xmlType, trackType] of Object.entries(typeMap)) {
            for (const track of asArray(rawTracks[xmlType])) {
                const trackId = String(track['@_Id'] ?? trackIndex);
                const name = attrVal(track?.Name?.EffectiveName)
                    ?? attrVal(track?.Name?.UserName)
                    ?? `Track ${trackIndex + 1}`;
                const colorIdx = toInt(track?.ColorIndex);
                const color = colorFromIndex(colorIdx);

                // ── Clips from the arranger ────────────────────────────────────
                const events = track?.DeviceChain?.MainSequencer
                    ?.ClipTimeable?.ArrangerAutomation?.Events ?? {};
                const clips: Record<string, unknown>[] = [];

                for (const [clipType, isPatt] of [
                    ['AudioClip', false],
                    ['MidiClip', true],
                ] as [string, boolean][]) {
                    for (const clip of asArray(events[clipType])) {
                        const start = parseFloat(String(clip['@_Time'] ?? '0')) || 0;
                        // Duration = CurrentEnd - Time (Ableton stores absolute end)
                        const end = toNum(clip?.CurrentEnd, start + 4);
                        const length = Math.max(0.01, end - start);
                        const clipColor = colorFromIndex(toInt(clip?.ColorIndex, colorIdx));

                        clips.push({
                            id: String(clip['@_Id'] ?? clips.length),
                            name: attrVal(clip?.Name) ?? name,
                            start, // beats
                            length, // beats
                            track: trackIndex,
                            type: isPatt ? 'pattern' : 'audio',
                            color: clipColor,
                        });
                    }
                }

                // ── VST / AU plugins on this track ─────────────────────────────
                const devices = track?.DeviceChain?.Devices ?? {};
                for (const dev of asArray(devices['PluginDevice'])) {
                    const p = attrVal(dev?.VstPluginInfo?.PlugName);
                    if (p) plugins.add(p);
                }
                for (const dev of asArray(devices['AuPluginDevice'])) {
                    const p = attrVal(dev?.AuPluginInfo?.Name) ?? attrVal(dev?.Name);
                    if (p) plugins.add(p);
                }

                tracks.push({
                    id: trackId,
                    name,
                    color,
                    clips,
                    enabled: true,
                    group: null,
                    trackType,
                });
                trackIndex++;
            }
        }

        return {
            bpm,
            signature: [numerator, denominator],
            fileType: 'als',
            projectInfo: {
                plugins: Array.from(plugins),
                samples: [],
            },
            markers: [],
            tracks,
        };
    }
}
