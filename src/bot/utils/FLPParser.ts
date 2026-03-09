/**
 * FLPParser: Extracts arrangement metadata from FL Studio (.flp) binary files.
 * Supports FL Studio 12+ / 20+ / 21+.
 *
 * Binary format:
 *   FLhd (4) | headerLen (4) | format(2) channels(2) ppq(2) | FLdt (4) | dataLen (4) | events...
 *   Event codes: 0-63 = BYTE (1b), 64-127 = WORD (2b), 128-191 = DWORD (4b), 192-255 = VAR (VLQ + data)
 *
 * Key events:
 *   156 (DWORD) = BPM × 1000
 *   225 (VAR)   = PlaylistItems — single blob with ALL playlist clips
 *   Each item: position(4) patBase(2) itemIdx(2) length(4) track(2) ...
 *   Track field stores (500 - actualTrackIndex).
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
        offset += 4; // skip dataLen — scan to EOF for robustness

        // ── 3. Event loop ──
        let bpm = 140;
        const clips: Array<{ id: string; name: string; start: number; length: number; track: number }> = [];

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

            // ── Event 225: PlaylistItems — THE clip data ──
            // This is a single large blob containing every clip placed on the playlist.
            // Each item is 32 bytes (FL 20+) or 28 bytes (FL 12-19).
            // Layout per item:
            //   [0]  uint32 position (ticks)
            //   [4]  uint16 patternBase
            //   [6]  uint16 itemIndex
            //   [8]  uint32 length (ticks)
            //   [12] uint16 track (stored as 500 - actualTrackIndex)
            //   [14+] flags, offsets, padding
            if (code === 225 && buf && buf.length >= 28) {
                // Auto-detect item size by trying 32 and 28
                const bestSize = this.detectItemSize(buf);
                const count = Math.floor(buf.length / bestSize);
                console.log(`[FLP] PlaylistItems blob: ${buf.length} bytes, itemSize=${bestSize}, itemCount=${count}`);

                for (let i = 0; i < count; i++) {
                    const o = i * bestSize;
                    if (o + 14 > buf.length) break;

                    const position  = buf.readUInt32LE(o);
                    const length    = buf.readUInt32LE(o + 8);
                    const rawTrack  = buf.readUInt16LE(o + 12);

                    // Skip empty / deleted items
                    if (position === 0 && length === 0) continue;
                    if (position > 50_000_000 || length > 50_000_000) continue;
                    if (rawTrack < 1 || rawTrack > 500) continue;

                    const actualTrack = 500 - rawTrack;

                    clips.push({
                        id: `pl-${i}`,
                        name: `Clip ${clips.length + 1}`,
                        start: Math.round(position / ppq),
                        length: Math.max(Math.round(length / ppq), 1),
                        track: actualTrack,
                    });
                }

                console.log(`[FLP] Extracted ${clips.length} valid clips from PlaylistItems`);
            }
        }

        console.log(`[FLP] Done. BPM=${bpm}, clips=${clips.length}, uniqueTracks=${new Set(clips.map(c => c.track)).size}`);

        // ── 4. Group clips by track & renumber ──
        const trackMap = new Map<number, typeof clips>();
        for (const clip of clips) {
            if (!trackMap.has(clip.track)) trackMap.set(clip.track, []);
            trackMap.get(clip.track)!.push(clip);
        }

        // Sort tracks by their original index and renumber from 0
        const sortedTrackIds = Array.from(trackMap.keys()).sort((a, b) => a - b);

        return {
            bpm,
            signature: [4, 4],
            tracks: sortedTrackIds.map((origId, idx) => ({
                id: idx,
                name: `Track ${idx + 1}`,
                clips: trackMap.get(origId)!,
            })),
        };
    }

    /** Try 32-byte and 28-byte item sizes; return whichever produces more valid track values. */
    private static detectItemSize(buf: Buffer): number {
        let best = 32;
        let bestScore = -1;

        for (const size of [32, 28]) {
            const n = Math.floor(buf.length / size);
            let score = 0;
            const limit = Math.min(n, 30);
            for (let i = 0; i < limit; i++) {
                const o = i * size;
                if (o + 14 > buf.length) break;
                const trk = buf.readUInt16LE(o + 12);
                const pos = buf.readUInt32LE(o);
                const len = buf.readUInt32LE(o + 8);
                if (trk >= 1 && trk <= 500) score += 3;
                if (pos > 0 && pos < 50_000_000) score += 1;
                if (len > 0 && len < 50_000_000) score += 1;
            }
            if (score > bestScore) {
                bestScore = score;
                best = size;
            }
        }

        return best;
    }
}
