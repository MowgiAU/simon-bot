/**
 * FLPParser: Extracts arrangement metadata from FL Studio (.flp) binary files.
 * Supports FL Studio 12+ / 20+ / 21+ / 25+.
 *
 * Binary format reference (from PyFLP):
 *   Event bases: BYTE=0, WORD=64, DWORD=128, TEXT=192, DATA=208
 *   Key events:
 *     156 (DWORD)   = BPM × 1000
 *     233 (DATA+25) = Playlist items (32 or 60 bytes each)
 *     238 (DATA+30) = Track data (properties blob)
 *     239 (TEXT+47)  = Track name
 *
 *   Playlist item struct (per PyFLP):
 *     position:     u32le  @ 0   (PPQ ticks)
 *     pattern_base: u16le  @ 4   (always 20480)
 *     item_index:   u16le  @ 6
 *     length:       u32le  @ 8   (PPQ ticks)
 *     track_rvidx:  u16le  @ 12  (reversed: Track 1 = 499)
 *     group:        u16le  @ 14
 *     _u1:          2 bytes @ 16
 *     item_flags:   u16le  @ 18
 *     _u2:          4 bytes @ 20
 *     start_offset: f32le  @ 24
 *     end_offset:   f32le  @ 28
 *     _u3:          28 bytes @ 32  (FL 21+ only, total = 60 bytes)
 */
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

            // ── Playlist items: event 233 (DATA+25) ──
            if (code === 233 && buf) {
                playlistBuf = buf;
                console.log(`[FLP] Found playlist event (code 233), ${buf.length} bytes`);
            }

            // ── Track names: event 239 (TEXT+47) ──
            if (code === 239 && buf) {
                // UTF-16LE or ASCII, null-terminated
                let name: string;
                if (buf.length >= 2 && buf[1] === 0) {
                    // UTF-16LE
                    name = buf.toString('utf16le').replace(/\0+$/, '');
                } else {
                    name = buf.toString('ascii').replace(/\0+$/, '');
                }
                trackNames.push(name);
            }
        }

        // ── 4. Parse playlist items from event 233 ──
        const clips: Array<{ id: string; name: string; start: number; length: number; track: number }> = [];

        if (playlistBuf) {
            // Determine item size: 60 bytes for FL 21+ (if divisible by 60), else 32 bytes
            let itemSize = 32;
            if (playlistBuf.length % 60 === 0) {
                itemSize = 60;
            } else if (playlistBuf.length % 32 === 0) {
                itemSize = 32;
            } else {
                console.log(`[FLP] Warning: playlist data ${playlistBuf.length}b not divisible by 32 or 60`);
                // Try 60 first, then 32
                itemSize = playlistBuf.length >= 60 ? 60 : 32;
            }

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

                // Actual track index (0-based): 499 - trackRvIdx
                const trackIdx = 499 - trackRvIdx;

                // Determine if it's a channel clip or pattern clip
                const isChannel = itemIndex <= patternBase;
                const itemLabel = isChannel
                    ? `Audio ${itemIndex}`
                    : `Pattern ${itemIndex - patternBase}`;

                // Skip items with absurd values
                if (position > 100_000_000 || length > 100_000_000) continue;

                clips.push({
                    id: `clip-${i}`,
                    name: itemLabel,
                    start: Math.round(position / ppq),
                    length: Math.max(Math.round(length / ppq), 1),
                    track: trackIdx,
                });

                console.log(`[FLP] Item[${i}]: pos=${position} len=${length} trackRv=${trackRvIdx} track=${trackIdx} patBase=${patternBase} idx=${itemIndex} → ${itemLabel}`);
            }
        } else {
            console.log(`[FLP] No playlist event (code 233) found!`);
        }

        console.log(`[FLP] Done. BPM=${bpm}, clips=${clips.length}, uniqueTracks=${new Set(clips.map(c => c.track)).size}`);

        // ── 5. Group clips by track & renumber ──
        const trackMap = new Map<number, typeof clips>();
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
}
