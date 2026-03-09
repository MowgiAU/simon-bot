/**
 * FLPParser: Extracts arrangement metadata from FL Studio (.flp) binary files.
 * Supports FL Studio 12+ / 20+ / 21+ / 25+.
 *
 * Binary format reference (from PyFLP):
 *   Event bases: BYTE=0, WORD=64, DWORD=128, TEXT=192, DATA=208
 *   Key events:
 *     64  (WORD)     = ChannelID.New   — new channel (value = IID)
 *     65  (WORD+1)   = PatternID.New   — new pattern (value = IID)
 *     156 (DWORD+28) = BPM × 1000
 *     192 (TEXT)      = ChannelID._Name — legacy channel name
 *     193 (TEXT+1)    = PatternID.Name
 *     196 (TEXT+4)    = ChannelID.SamplePath
 *     203 (TEXT+11)   = PluginID.Name — channel/plugin display name
 *     224 (DATA+16)   = PatternID.Notes — 24 bytes per note
 *     233 (DATA+25)   = Playlist items (32 or 60 bytes each)
 *     238 (DATA+30)   = Track data
 *     239 (TEXT+47)   = Track name
 *
 *   Note struct (24 bytes):
 *     position: u32le@0, flags: u16le@4, rack_channel: u16le@6,
 *     length: u32le@8, key: u16le@12, velocity: u8@21
 *
 *   Playlist item struct:
 *     position: u32le@0, pattern_base: u16le@4 (always 20480),
 *     item_index: u16le@6, length: u32le@8, track_rvidx: u16le@12
 */

interface NoteData {
    key: number;       // 0-131 (C0=0, C#0=1, ..., B10=131)
    position: number;  // beats relative to pattern start
    length: number;    // beats
    velocity: number;  // 0-128
}

interface ClipData {
    id: string;
    name: string;
    start: number;     // beats
    length: number;    // beats
    track: number;
    type: 'pattern' | 'audio';
    notes?: NoteData[];
    sampleFileName?: string;
}

export class FLPParser {
    static parse(buffer: Buffer) {
        let offset = 0;

        // ── 1. FLhd header ──
        if (buffer.toString('ascii', 0, 4) !== 'FLhd') {
            throw new Error('Invalid FLP: missing FLhd header');
        }
        offset += 4;
        const headerLen = buffer.readUInt32LE(offset);
        offset += 4;
        const ppq = headerLen >= 6 ? buffer.readUInt16LE(offset + 4) : 96;
        offset += headerLen;

        // ── 2. FLdt data chunk ──
        if (buffer.toString('ascii', offset, offset + 4) !== 'FLdt') {
            throw new Error('Invalid FLP: missing FLdt chunk');
        }
        offset += 4;
        offset += 4; // skip dataLen

        // ── 3. Event loop ──
        let bpm = 140;
        let playlistBuf: Buffer | null = null;
        const trackNames: string[] = [];

        // Pattern tracking: keyed by pattern IID
        let currentPatternIID = 0;
        const patternNames = new Map<number, string>();
        const patternNotes = new Map<number, NoteData[]>();

        // Channel tracking: keyed by channel IID
        let currentChannelIID = 0;
        const channelNames = new Map<number, string>();
        const channelSamplePaths = new Map<number, string>();

        console.log(`[FLP] Parse started. PPQ=${ppq}, size=${buffer.length} bytes`);

        while (offset < buffer.length) {
            const code = buffer[offset++];
            let num = 0;
            let buf: Buffer | null = null;

            if (code <= 63) {
                if (offset >= buffer.length) break;
                num = buffer[offset++];
            } else if (code <= 127) {
                if (offset + 2 > buffer.length) break;
                num = buffer.readUInt16LE(offset);
                offset += 2;
            } else if (code <= 191) {
                if (offset + 4 > buffer.length) break;
                num = buffer.readUInt32LE(offset);
                offset += 4;
            } else {
                // Variable-length: VLQ-encoded length, then data
                let len = 0;
                let shift = 0;
                while (offset < buffer.length) {
                    const b = buffer[offset++];
                    len |= (b & 0x7F) << shift;
                    shift += 7;
                    if (!(b & 0x80)) break;
                }
                if (len < 0 || offset + len > buffer.length) break;
                buf = Buffer.from(buffer.subarray(offset, offset + len));
                offset += len;
            }

            // ── BPM (FL 12+): DWORD event 156, value = BPM × 1000 ──
            if (code === 156 && num > 0) {
                const tempo = num / 1000;
                if (tempo > 10 && tempo < 999) {
                    bpm = Math.round(tempo * 10) / 10;
                    console.log(`[FLP] Tempo: ${bpm} BPM`);
                }
            }

            // ── BPM (legacy): WORD event 66 ──
            if (code === 66 && num > 10 && num < 999) {
                bpm = num;
            }

            // ── Channel New (64): marks start of new channel ──
            if (code === 64) {
                currentChannelIID = num;
            }

            // ── Pattern New (65): marks start of new pattern ──
            if (code === 65) {
                currentPatternIID = num;
            }

            // ── Channel name legacy (192) ──
            if (code === 192 && buf && currentChannelIID > 0) {
                const name = FLPParser.readStringBuf(buf);
                if (name && !channelNames.has(currentChannelIID)) {
                    channelNames.set(currentChannelIID, name);
                }
            }

            // ── Pattern name (193) ──
            if (code === 193 && buf && currentPatternIID > 0) {
                const name = FLPParser.readStringBuf(buf);
                if (name) {
                    patternNames.set(currentPatternIID, name);
                }
            }

            // ── Channel sample path (196) ──
            if (code === 196 && buf && currentChannelIID > 0) {
                const samplePath = FLPParser.readStringBuf(buf);
                if (samplePath) {
                    channelSamplePaths.set(currentChannelIID, samplePath);
                }
            }

            // ── Channel/plugin display name (203) ──
            if (code === 203 && buf && currentChannelIID > 0) {
                const name = FLPParser.readStringBuf(buf);
                if (name) {
                    channelNames.set(currentChannelIID, name);
                }
            }

            // ── Pattern notes (224): 24 bytes per note ──
            if (code === 224 && buf && currentPatternIID > 0) {
                const notes: NoteData[] = [];
                const noteSize = 24;
                const noteCount = Math.floor(buf.length / noteSize);
                for (let ni = 0; ni < noteCount; ni++) {
                    const nb = ni * noteSize;
                    if (nb + noteSize > buf.length) break;
                    const position = buf.readUInt32LE(nb + 0);
                    const length   = buf.readUInt32LE(nb + 8);
                    const key      = buf.readUInt16LE(nb + 12);
                    const velocity = buf[nb + 21];
                    if (key <= 131 && position < 100_000_000) {
                        notes.push({
                            key,
                            position: position / ppq,
                            length: Math.max(length / ppq, 0.1),
                            velocity,
                        });
                    }
                }
                if (notes.length > 0) {
                    patternNotes.set(currentPatternIID, notes);
                }
            }

            // ── Playlist items: event 233 (DATA+25) ──
            if (code === 233 && buf) {
                playlistBuf = buf;
                console.log(`[FLP] Found playlist event (code 233), ${buf.length} bytes`);
            }

            // ── Track names: event 239 (TEXT+47) ──
            if (code === 239 && buf) {
                trackNames.push(FLPParser.readStringBuf(buf));
            }
        }

        console.log(`[FLP] Patterns: ${patternNames.size} named, ${patternNotes.size} with notes`);
        console.log(`[FLP] Channels: ${channelNames.size} named, ${channelSamplePaths.size} with samples`);

        // ── 4. Parse playlist items from event 233 ──
        const clips: ClipData[] = [];

        if (playlistBuf) {
            // Detect item size dynamically by scanning for pattern_base (20480 / 0x5000)
            let itemSize = 0;
            if (playlistBuf.length >= 36) {
                for (let trySize = 32; trySize <= 128; trySize += 4) {
                    if (trySize + 6 <= playlistBuf.length && playlistBuf.readUInt16LE(trySize + 4) === 20480) {
                        itemSize = trySize;
                        break;
                    }
                }
            }
            if (itemSize === 0) {
                if (playlistBuf.length % 60 === 0) itemSize = 60;
                else if (playlistBuf.length % 32 === 0) itemSize = 32;
                else itemSize = 60;
            }
            console.log(`[FLP] Detected item size: ${itemSize} bytes (data: ${playlistBuf.length}b)`);

            const itemCount = Math.floor(playlistBuf.length / itemSize);
            console.log(`[FLP] Playlist: ${itemCount} items, itemSize=${itemSize}b`);

            for (let i = 0; i < itemCount; i++) {
                const base = i * itemSize;
                if (base + 16 > playlistBuf.length) break;

                const position    = playlistBuf.readUInt32LE(base + 0);
                const patternBase = playlistBuf.readUInt16LE(base + 4);  // always 20480
                const itemIndex   = playlistBuf.readUInt16LE(base + 6);
                const length      = playlistBuf.readUInt32LE(base + 8);
                const trackRvIdx  = playlistBuf.readUInt16LE(base + 12); // reversed: Track 1 = 499
                const trackIdx    = 499 - trackRvIdx;

                if (position > 100_000_000 || length > 100_000_000) continue;

                const isChannel = itemIndex <= patternBase;
                let clipType: 'pattern' | 'audio';
                let itemLabel: string;
                let notes: NoteData[] | undefined;
                let sampleFileName: string | undefined;

                if (isChannel) {
                    // Audio/automation clip — itemIndex = channel IID
                    clipType = 'audio';
                    const channelName = channelNames.get(itemIndex);
                    const samplePath = channelSamplePaths.get(itemIndex);
                    itemLabel = channelName || (samplePath ? FLPParser.fileNameFromPath(samplePath) : `Audio ${itemIndex}`);
                    if (samplePath) {
                        sampleFileName = FLPParser.fileNameFromPath(samplePath);
                    }
                } else {
                    // Pattern clip — pattern IID = itemIndex - patternBase
                    clipType = 'pattern';
                    const patternIID = itemIndex - patternBase;
                    itemLabel = patternNames.get(patternIID) || `Pattern ${patternIID}`;
                    notes = patternNotes.get(patternIID);
                }

                clips.push({
                    id: `clip-${i}`,
                    name: itemLabel,
                    start: position / ppq,
                    length: Math.max(length / ppq, 0.25),
                    track: trackIdx,
                    type: clipType,
                    notes,
                    sampleFileName,
                });

                console.log(`[FLP] Item[${i}]: ${clipType} "${itemLabel}" pos=${position} len=${length} track=${trackIdx}`);
            }
        } else {
            console.log(`[FLP] No playlist event (code 233) found!`);
        }

        console.log(`[FLP] Done. BPM=${bpm}, clips=${clips.length}, uniqueTracks=${new Set(clips.map(c => c.track)).size}`);

        // ── 5. Group clips by track & renumber ──
        const trackMap = new Map<number, ClipData[]>();
        for (const clip of clips) {
            if (!trackMap.has(clip.track)) trackMap.set(clip.track, []);
            trackMap.get(clip.track)!.push(clip);
        }

        const sortedTrackIds = Array.from(trackMap.keys()).sort((a, b) => a - b);

        return {
            bpm,
            signature: [4, 4],
            tracks: sortedTrackIds.map((origId, idx) => ({
                id: idx,
                name: trackNames[origId] || `Track ${idx + 1}`,
                clips: trackMap.get(origId)!,
            })),
        };
    }

    /** Read a string from a buffer, handling UTF-16LE and ASCII with null terminators */
    private static readStringBuf(buf: Buffer): string {
        if (buf.length >= 2 && buf[1] === 0) {
            return buf.toString('utf16le').replace(/\0+$/, '');
        }
        return buf.toString('ascii').replace(/\0+$/, '');
    }

    /** Extract just the filename from a full path */
    private static fileNameFromPath(fullPath: string): string {
        const parts = fullPath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || fullPath;
    }
}
