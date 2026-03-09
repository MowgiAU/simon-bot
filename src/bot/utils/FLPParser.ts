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

        while (offset < endOffset && offset < buffer.length) {
            const eventCode = buffer[offset++];
            const eventId = eventCode & 0x3F;
            const eventType = eventCode & 0xC0;

            let value: any;
            let length = 0;

            if (eventType === 0x00) { // Byte
                value = buffer[offset++];
            } else if (eventType === 0x40) { // Word
                value = buffer.readUInt16LE(offset);
                offset += 2;
            } else if (eventType === 0x80) { // DWord
                value = buffer.readUInt32LE(offset);
                offset += 4;
            } else if (eventType === 0xC0) { // Text/Variable
                // Variable length integer for text
                let result = 0;
                let shift = 0;
                let b;
                do {
                    b = buffer[offset++];
                    result |= (b & 0x7F) << shift;
                    shift += 7;
                } while (b & 0x80);
                length = result;
                value = buffer.slice(offset, offset + length);
                offset += length;
            }

            // Handle specific relevant events
            // NOTE: eventCode is the full byte (0-255); eventId is eventCode & 0x3F (0-63).
            // BPM event code is 104 (0x68), PLItem event code is 213 (0xD5).
            // Must check the full eventCode, NOT eventId.
            if (eventCode === 104) { // BPM (word event)
                // FL Studio stores BPM as BPM * 10 in a WORD event
                projectBpm = Math.round(value / 10);
            }

            if (eventCode === 213) { // PLItem (variable-length event)
                // PLItem data structure:
                // [4 bytes start position (ticks)] [4 bytes length (ticks)] [2 bytes unknown] [2 bytes track index]
                if (value && value.length >= 12) {
                    const startPos = value.readInt32LE(0);
                    const clipLen = value.readInt32LE(4);
                    const trackIdx = value.readInt16LE(10);
                    
                    clips.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: `Clip ${clips.length + 1}`,
                        start: startPos / 96, // Standard FL PPQ = 96
                        length: Math.max(clipLen / 96, 1), // Ensure minimum length of 1 beat
                        track: trackIdx,
                        type: 'clip' as const
                    });
                }
            }
        }

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
