/**
 * FLPParser: Extracts arrangement metadata from FL Studio (.flp) binary files.
 * Supports FL Studio 12+ (modern event IDs: BPM at code 156, playlist at code 236).
 *
 * Binary format overview:
 *   FLhd (4) | headerLen (4) | format(2) channels(2) ppq(2) | FLdt (4) | dataLen (4) | events...
 *   Event codes: 0-63 = BYTE (1b data), 64-127 = WORD (2b), 128-191 = DWORD (4b), 192-255 = VAR (VLQ len + data)
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

        // PPQ (pulses per quarter-note) sits at bytes 4-5 of header data
        const ppq = headerLen >= 6 ? buffer.readUInt16LE(offset + 4) : 96;
        offset += headerLen;

        // ── 2. FLdt data chunk ──
        if (buffer.toString('ascii', offset, offset + 4) !== 'FLdt') {
            throw new Error('Invalid FLP: missing FLdt chunk');
        }
        offset += 4;
        offset += 4; // skip dataLen – we scan to EOF for robustness

        // ── 3. Event loop ──
        let bpm = 140;
        const clips: Array<{ id: string; name: string; start: number; length: number; track: number }> = [];
        let playlistTrack = -1; // incremented by track-header events (code 235)

        console.log(`[FLP] Parse started. PPQ=${ppq}, size=${buffer.length} bytes`);

        while (offset < buffer.length) {
            const code = buffer[offset++];
            let num = 0;       // numeric value for BYTE / WORD / DWORD events
            let buf: Buffer | null = null; // buffer value for VARIABLE events

            if (code <= 63) {
                // ── BYTE event (1 byte of data) ──
                if (offset >= buffer.length) break;
                num = buffer[offset++];
            } else if (code <= 127) {
                // ── WORD event (2 bytes) ──
                if (offset + 2 > buffer.length) break;
                num = buffer.readUInt16LE(offset);
                offset += 2;
            } else if (code <= 191) {
                // ── DWORD event (4 bytes) ──
                if (offset + 4 > buffer.length) break;
                num = buffer.readUInt32LE(offset);
                offset += 4;
            } else {
                // ── VARIABLE-LENGTH event (VLQ length prefix + data) ──
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

            // ── BPM (legacy): WORD event 66, value = BPM ──
            if (code === 66 && num > 10 && num < 999) {
                bpm = num;
                console.log(`[FLP] Tempo (legacy): ${bpm} BPM`);
            }

            // ── Playlist track header (Variable event 235) ──
            // Each 235 event marks a new playlist track block; the 236 that
            // follows contains the clips belonging to that track.
            if (code === 235) {
                playlistTrack++;
            }

            // ── Playlist items: codes 236 (FL 20+), 228 (FL 12-19), 213 (legacy) ──
            if ((code === 236 || code === 228 || code === 213) && buf) {
                const ITEM = 12; // bytes per playlist item in this format
                const count = Math.floor(buf.length / ITEM);
                console.log(`[FLP] Playlist event: code=${code}, bytes=${buf.length}, items=${count}, track=${playlistTrack}`);

                for (let i = 0; i < count; i++) {
                    const o = i * ITEM;
                    const position = buf.readUInt32LE(o);     // absolute tick position
                    const lengthVal = buf.readUInt32LE(o + 8); // clip length in ticks

                    // Sanity: ignore items with absurd positions or lengths
                    if (position > 50_000_000) continue;
                    if (lengthVal > 50_000_000) continue;

                    clips.push({
                        id: `${playlistTrack}-${i}-${clips.length}`,
                        name: `Clip ${clips.length + 1}`,
                        start: Math.round(position / ppq),
                        length: Math.max(Math.round(lengthVal > 0 ? lengthVal / ppq : 4), 1),
                        track: playlistTrack >= 0 ? playlistTrack : 0,
                    });
                }
            }
        }

        console.log(`[FLP] Done. BPM=${bpm}, clips=${clips.length}, uniqueTracks=${new Set(clips.map(c => c.track)).size}`);

        // ── 4. Group clips by track ──
        const trackMap = new Map<number, typeof clips>();
        for (const clip of clips) {
            if (!trackMap.has(clip.track)) trackMap.set(clip.track, []);
            trackMap.get(clip.track)!.push(clip);
        }

        return {
            bpm,
            signature: [4, 4],
            tracks: Array.from(trackMap.entries()).map(([id, trackClips]) => ({
                id,
                name: `Track ${id + 1}`,
                clips: trackClips,
            })),
        };
    }
}
