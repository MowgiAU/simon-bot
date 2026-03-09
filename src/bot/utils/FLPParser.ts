/**
 * FLPParser: A basic utility to extract "PLItem" arrangement metadata 
 * from FL Studio (FLP) binary files.
 * 
 * Note: Full FLP parsing is complex. This is a simplified implementation 
 * for the Fuji Project Viewer.
 */
export class FLPParser {
    // Event IDs based on common FLP specifications
    static EVENTS = {
        BYTE: 0x00,
        WORD: 0x40,
        DWORD: 0x80,
        TEXT: 0xC0,
        
        // Specific identifiers
        PROJECT_FILE: 0,
        BPM_EVENT: 104,
        TRACK_NAME: 200,
        PLAY_LIST_ITEM: 213, // This holds clip coordinates
    };

    static parse(buffer: Buffer) {
        let offset = 0;
        
        // 1. Verify Header
        const header = buffer.toString('ascii', 0, 4);
        if (header !== 'FLhd') throw new Error('Invalid FLP header');
        
        offset += 4;
        const headerLen = buffer.readUInt32LE(offset);
        offset += 4 + headerLen;

        // 2. Read 'FLdt' chunk
        const dataHeader = buffer.toString('ascii', offset, offset + 4);
        if (dataHeader !== 'FLdt') throw new Error('Could not find data chunk');
        
        offset += 4;
        const dataLen = buffer.readUInt32LE(offset);
        offset += 4;

        const endOffset = offset + dataLen;
        
        // State for arrangement extraction
        const clips: any[] = [];
        let projectBpm = 140;

        console.log(`[FLP] Starting parse. Data length: ${dataLen}, End offset: ${endOffset}`);

        while (offset < buffer.length) {
            const eventCode = buffer[offset++];
            const eventType = eventCode & 0xC0;
            const eventId = eventCode & 0x3F;
            let value: any;
            let length = 0;

            if (eventCode === 0) continue; // Skip padding

            if (eventType === 0x00) { // Byte (0-63)
                value = buffer[offset++];
                // console.log(`[FLP] Byte Event: ${eventCode}, Value: ${value}`);
            } else if (eventType === 0x40) { // Word (64-127)
                if (offset + 2 > buffer.length) break;
                value = buffer.readUInt16LE(offset);
                offset += 2;
                // console.log(`[FLP] Word Event: ${eventCode}, Value: ${value}`);
            } else if (eventType === 0x80) { // DWord (128-191)
                if (offset + 4 > buffer.length) break;
                value = buffer.readUInt32LE(offset);
                offset += 4;
                // console.log(`[FLP] DWord Event: ${eventCode}, Value: ${value}`);
            } else if (eventType === 0xC0) { // Text/Variable (192-255)
                let result = 0;
                let shift = 0;
                let b;
                do {
                    if (offset >= buffer.length) break;
                    b = buffer[offset++];
                    result |= (b & 0x7F) << shift;
                    shift += 7;
                } while (b & 0x80);
                length = result;
                if (offset + length > buffer.length) break;
                value = buffer.slice(offset, offset + length);
                offset += length;
                // console.log(`[FLP] Text/Var Event: ${eventCode}, Length: ${length}`);
            }

            // Handle specific relevant events
            if (eventCode === 104) { // BPM (Word)
                projectBpm = value / 10;
                console.log(`[FLP] Found BPM: ${projectBpm}`);
            }

            if (eventCode === 213) { // PLItem (Text/Var)
                // PLItem data structure (~24 bytes in modern FL)
                if (value && value.length >= 12) {
                    const startPos = value.readInt32LE(0);
                    const clipLen = value.readInt32LE(4);
                    // In modern FL (20+), track index usually at offset 12-14
                    const trackIdx = value.readInt16LE(12) || value.readInt16LE(10);
                    
                    clips.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: `Clip ${clips.length + 1}`,
                        start: startPos / 96, 
                        length: Math.max(clipLen / 96, 1),
                        track: Math.abs(trackIdx % 500), // Safety cap for tracks
                        type: 'clip' as const
                    });
                }
            }
        }

        console.log(`[FLP] Finished loop. Clips found: ${clips.length}`);

        // Group clips into tracks
        const tracksMap = new Map<number, any>();
        clips.forEach(clip => {
            if (!tracksMap.has(clip.track)) {
                tracksMap.set(clip.track, {
                    id: clip.track,
                    name: `Track ${clip.track + 1}`,
                    clips: []
                });
            }
            tracksMap.get(clip.track).clips.push(clip);
        });

        return {
            bpm: projectBpm,
            signature: [4, 4],
            tracks: Array.from(tracksMap.values())
        };
    }
}
