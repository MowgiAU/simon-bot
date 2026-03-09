/**
 * FLPParser: Extracts arrangement metadata from FL Studio (.flp) binary files.
 * Supports FL Studio 12+ / 20+ / 21+ / 25+.
 *
 * Binary format:
 *   FLhd (4) | headerLen (4) | format(2) channels(2) ppq(2) | FLdt (4) | dataLen (4) | events...
 *   Event codes: 0-63 = BYTE (1b), 64-127 = WORD (2b), 128-191 = DWORD (4b), 192-255 = VAR (VLQ + data)
 *
 * Key events:
 *   156 (DWORD) = BPM × 1000
 *   228 (VAR)   = Playlist clip items (16 bytes each in FL 20+/25+)
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
        const allVarEvents: Array<{ code: number; buf: Buffer }> = [];

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

            // Collect all variable-length events for analysis
            if (buf && (code === 228 || code === 225 || code === 236)) {
                allVarEvents.push({ code, buf });
            }
        }

        // ── 4. Analyze collected events ──
        const event228s = allVarEvents.filter(e => e.code === 228);
        const event236s = allVarEvents.filter(e => e.code === 236);
        const event225s = allVarEvents.filter(e => e.code === 225);

        console.log(`[FLP] Variable events: code228=${event228s.length}, code236=${event236s.length}, code225=${event225s.length}`);

        // Dump raw bytes of ALL code 228 events (these are the clip placements)
        event228s.forEach((e, i) => {
            const hex = e.buf.toString('hex').match(/.{1,2}/g)?.join(' ');
            console.log(`[FLP] Event228[${i}] (${e.buf.length}b): ${hex}`);
            if (e.buf.length >= 16) {
                console.log(`[FLP] Event228[${i}] fields: pos=${e.buf.readUInt32LE(0)} u16@4=${e.buf.readUInt16LE(4)} u16@6=${e.buf.readUInt16LE(6)} len=${e.buf.readUInt32LE(8)} track=${e.buf.readInt16LE(12)} flags=${e.buf.readUInt16LE(14)}`);
            }
        });

        // Also dump first 3 code 236 events
        event236s.slice(0, 3).forEach((e, i) => {
            const hex = e.buf.toString('hex').match(/.{1,2}/g)?.join(' ');
            console.log(`[FLP] Event236[${i}] (${e.buf.length}b): ${hex}`);
        });

        // ── 5. Extract clips from code 228 events ──
        // Each code 228 event = one playlist clip (16 bytes in FL 20+/25+)
        // Layout: position(4) patternBase(2) itemIdx(2) length(4) track(2) flags(2)
        const clips: Array<{ id: string; name: string; start: number; length: number; track: number }> = [];

        event228s.forEach((e, i) => {
            if (e.buf.length < 12) return;

            const position = e.buf.readUInt32LE(0);
            const length = e.buf.readUInt32LE(8);
            const rawTrack = e.buf.length >= 14 ? e.buf.readInt16LE(12) : 0;

            // Skip empty/garbage
            if (position > 50_000_000 || length > 50_000_000) return;

            // Track may be 0-indexed directly or use 499-track encoding
            const track = rawTrack >= 0 && rawTrack < 500 ? rawTrack : (rawTrack < 0 ? 499 + rawTrack : 0);

            clips.push({
                id: `clip-${i}`,
                name: `Clip ${i + 1}`,
                start: Math.round(position / ppq),
                length: Math.max(Math.round(length > 0 ? length / ppq : 4), 1),
                track,
            });
        });

        console.log(`[FLP] Clips from code228: ${clips.length}`);

        // If code 228 found nothing, try code 236 (one event per track block)
        if (clips.length === 0 && event236s.length > 0) {
            console.log(`[FLP] Falling back to code 236 events...`);
            event236s.forEach((e, i) => {
                if (e.buf.length < 8) return;
                const position = e.buf.readUInt32LE(0);
                const length = e.buf.length >= 8 ? e.buf.readUInt32LE(4) : 0;

                if (position > 50_000_000 || length > 50_000_000) return;
                if (position === 0 && length === 0) return;

                clips.push({
                    id: `clip236-${i}`,
                    name: `Clip ${i + 1}`,
                    start: Math.round(position / ppq),
                    length: Math.max(Math.round(length > 0 ? length / ppq : 4), 1),
                    track: i,
                });
            });
            console.log(`[FLP] Clips from code236 fallback: ${clips.length}`);
        }

        console.log(`[FLP] Done. BPM=${bpm}, clips=${clips.length}, uniqueTracks=${new Set(clips.map(c => c.track)).size}`);

        // ── 6. Group clips by track & renumber ──
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
                name: `Track ${idx + 1}`,
                clips: trackMap.get(origId)!,
            })),
        };
    }
}
