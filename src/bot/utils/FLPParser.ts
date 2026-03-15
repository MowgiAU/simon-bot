/**
 * FLPParser: Extracts arrangement metadata from FL Studio (.flp) binary files.
 * Supports FL Studio 12+ / 20+ / 21+ / 25+.
 *
 * Binary format reference (from PyFLP):
 *   Event bases: BYTE=0, WORD=64, DWORD=128, TEXT=192, DATA=208
 *   Key events:
 *     21  (BYTE+21)  = ChannelID.Type  — channel type (5 = automation)
 *     64  (WORD)     = ChannelID.New   — new channel (value = IID)
 *     65  (WORD+1)   = PatternID.New   — new pattern (value = IID)
 *     156 (DWORD+28) = BPM × 1000
 *     192 (TEXT)      = ChannelID._Name — legacy channel name
 *     193 (TEXT+1)    = PatternID.Name
 *     196 (TEXT+4)    = ChannelID.SamplePath
 *     203 (TEXT+11)   = PluginID.Name — channel/plugin display name
 *     224 (DATA+16)   = PatternID.Notes — 24 bytes per note
 *     233 (DATA+25)   = Playlist items (32 or 60 bytes each)
 *     234 (DATA+26)   = ChannelID.Automation — automation point data
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
 *
 *   Automation struct (event 234):
 *     header: denominator(u32) + lfo_type(u8) + art_speed(u32) +
 *             art_dir(u8) + art_flip(u8) + art_pulse(u32) = 15 bytes
 *     point_count: u32
 *     points: count × 24 bytes: position(f64) + value(f64) + tension(f32) + _u1(4 bytes)
 */

interface NoteData {
    key: number;       // 0-131 (C0=0, C#0=1, ..., B10=131)
    position: number;  // beats relative to pattern start
    length: number;    // beats
    velocity: number;  // 0-128
}

interface AutomationPoint {
    position: number;  // normalized 0-1 across the clip
    value: number;     // 0-1
    tension: number;   // -1 to 1
}

interface ClipData {
    id: string;
    name: string;
    start: number;     // beats
    length: number;    // beats
    track: number;
    type: 'pattern' | 'audio' | 'automation';
    notes?: NoteData[];
    sampleFileName?: string;
    automationPoints?: AutomationPoint[];
}

interface ProjectInfo {
    plugins: string[];
    samples: string[];
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
        let bpm = 0; // Initialize to 0 to check if we detect any tempo event
        let bpmLocked = false; // Only take the FIRST tempo event (FL Studio writes default 140 later)
        let playlistBuf: Buffer | null = null;

        // Track events: 238 = track data (one per track, sequential), 239 = track name (only for renamed tracks)
        // 239 appears immediately after the 238 for the track it names. Tracks with default names have no 239.
        const trackEvents238: Array<{ enabled: boolean; grouped: number }> = [];
        const trackNameMap = new Map<number, string>(); // trackIndex → name
        let lastTrack238Index = -1; // sequential index of the most recent 238 event

        // Pattern tracking: keyed by pattern IID
        let currentPatternIID = 0;
        const patternNames = new Map<number, string>();
        const patternNotes = new Map<number, NoteData[]>();

        // Channel tracking: keyed by channel IID
        let currentChannelIID = 0;
        const channelNames = new Map<number, string>();
        const channelSamplePaths = new Map<number, string>();
        const channelTypes = new Map<number, number>();  // IID → type (5 = automation)
        const channelAutomationPoints = new Map<number, AutomationPoint[]>();
        const channelInternalNames = new Map<number, string>();  // IID → internal name (e.g. "Fruity Wrapper")

        // Project-wide collection for plugin/sample list
        const allPluginNames = new Set<string>();
        const allSamplePaths = new Set<string>();
        // Mixer/effect plugin names (collected outside channel context)
        const mixerPluginNames = new Set<string>();

        // Markers (event 148 = position, event 203 in marker context = name)
        const markers: Array<{ position: number; name: string }> = [];
        let markerContextActive = false;
        let currentMarkerBeat = 0;

        // Track data (event 238): mute state + grouped flag, keyed by actual track index (0-based)
        const trackDataMap = new Map<number, { enabled: boolean; grouped: number }>();

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
            // FL Studio can write multiple event 156 entries: first is the actual project tempo,
            // later ones may be defaults (140). We only take the FIRST valid occurrence.
            if (code === 156 && num > 0) {
                const tempo = num / 1000;
                if (tempo > 10 && tempo < 999) {
                    const detectedBpm = Math.round(tempo * 10) / 10;
                    if (!bpmLocked) {
                        bpm = detectedBpm;
                        bpmLocked = true;
                    }
                }
            }

            // ── BPM (legacy): WORD event 66 ──
            if (code === 66 && num > 10 && num < 999 && !bpmLocked) {
                bpm = num;
                bpmLocked = true;
            }

            // ── Channel New (64): marks start of new channel ──
            if (code === 64) {
                currentChannelIID = num;
            }

            // ── Channel type (21): byte event, 5 = automation ──
            if (code === 21 && currentChannelIID > 0) {
                channelTypes.set(currentChannelIID, num);
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
                    allSamplePaths.add(samplePath);
                }
            }

            // ── Plugin internal name (201 = TEXT+9): "Fruity Wrapper" for VSTs, native plugin name, or empty ──
            if (code === 201 && buf && currentChannelIID > 0) {
                const internalName = FLPParser.readStringBuf(buf);
                if (internalName) {
                    channelInternalNames.set(currentChannelIID, internalName);
                }
            }

            // ── Channel/plugin display name (203) — also used as marker name when in marker context ──
            if (code === 203 && buf) {
                const name = FLPParser.readStringBuf(buf);
                if (markerContextActive) {
                    // This 203 event belongs to the active marker, not a channel
                    markers.push({ position: currentMarkerBeat, name: name || `Marker ${markers.length + 1}` });
                    markerContextActive = false;
                } else if (currentChannelIID > 0) {
                    if (name) channelNames.set(currentChannelIID, name);
                } else {
                    if (name) mixerPluginNames.add(name);
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

            // ── Automation data (234 = DATA+26): points for automation channels ──
            if (code === 234 && buf && currentChannelIID > 0) {
                // Header: 17 bytes (_u1:4, lfo.amount:i32, _u2:1, _u3:2, _u4:2, _u5:4)
                // Then: pointCount:u32 @17, points @21: count × 24 bytes
                // Each point: _offset:f64 (delta X), value:f64 (0-1 Y), tension:f32, _u1:4b
                const headerSize = 17;
                if (buf.length > headerSize + 4) {
                    const pointCount = buf.readUInt32LE(headerSize);
                    const pointStart = headerSize + 4; // = 21
                    const pointSize = 24;
                    const points: AutomationPoint[] = [];
                    let cumulativePos = 0;

                    for (let pi = 0; pi < pointCount; pi++) {
                        const pb = pointStart + pi * pointSize;
                        if (pb + pointSize > buf.length) break;
                        const delta = buf.readDoubleLE(pb + 0); // delta from previous point
                        const val = buf.readDoubleLE(pb + 8);
                        const ten = buf.readFloatLE(pb + 16);
                        cumulativePos += delta;
                        points.push({ position: cumulativePos, value: val, tension: ten });
                    }

                    if (points.length > 0) {
                        // Normalize positions to 0-1 range
                        const maxPos = points[points.length - 1].position;
                        if (maxPos > 0) {
                            for (const p of points) {
                                p.position = p.position / maxPos;
                            }
                        }
                        channelAutomationPoints.set(currentChannelIID, points);
                    }
                }
            }

            // ── Playlist items: event 233 (DATA+25) ──
            // After the playlist event, subsequent TEXT+11 (203) events belong to mixer effect slots,
            // not channel names. Reset currentChannelIID so they route to mixerPluginNames.
            if (code === 233 && buf) {
                playlistBuf = buf;
                currentChannelIID = 0;
            }

            // ── Track data: event 238 (DATA+30) — enabled flag + group ID ──
            // Layout (40-byte PyFLP): u32@0=number, u32@4=color, i32@8=icon, u8@12=enabled,
            //   f32@13=height, i32@17=locked_height, u8@21=locked_to_content,
            //   u32@22=motion, u32@26=press, u16@30=trigger_sync, u8@32=queued,
            //   u8@33=tolerant, u32@34=position_sync, i8@38=grouped, u8@39=locked
            // Note: FL 25+ has 70-byte events with additional fields after offset 40.
            if (code === 238 && buf && buf.length >= 13) {
                const enabled = buf[12] !== 0;
                // Note: group/grouped offset is unknown for 70-byte FL 25+ events.
                // Byte 38 (PyFLP's "grouped" for 40-byte events) reads 1 for ALL tracks in FL 25+.
                // Disabling grouping until we can identify the correct offset from a project with known groups.
                const trackNum = trackEvents238.length;
                lastTrack238Index = trackNum;
                trackEvents238.push({ enabled, grouped: 0 });
            }

            // ── Track names: event 239 — only emitted for renamed tracks, pairs with preceding 238 ──
            if (code === 239 && buf) {
                const name = FLPParser.readStringBuf(buf);
                if (lastTrack238Index >= 0) {
                    trackNameMap.set(lastTrack238Index, name);
                }
            }

            // ── Timeline marker: event 148 (DWORD+20) = position + action type ──
            // Upper byte (bits 24-31) = marker action: 0=none, 1=loop, 2=skip, 8=time_sig, 12=key_sig
            // Lower 24 bits = position in PPQ ticks
            if (code === 148) {
                const markerAction = (num >>> 24) & 0xFF;
                const tickPos = num & 0x00FFFFFF;
                currentMarkerBeat = tickPos / ppq;
                markerContextActive = true;
            }

            // ── Fallback marker name: any unhandled TEXT event (192-207) while in marker context ──
            // FL Studio versions differ on which TEXT event carries the marker name:
            //   - FL Studio 12-20: event 203 (handled above in the PluginID.Name block)
            //   - FL Studio 21+:   event 200 (TEXT+8) or others in this range
            // Timeline markers always appear at the end of the FLP after channel/track data,
            // so any unhandled TEXT event here is safe to treat as a marker name.
            if (markerContextActive && buf && code >= 192 && code <= 207
                && code !== 192   // ChannelID._Name
                && code !== 193   // PatternID.Name
                && code !== 196   // ChannelID.SamplePath
                && code !== 201   // PluginID internal name
                && code !== 203   // PluginID display name (handled above)
            ) {
                const name = FLPParser.readStringBuf(buf);
                markers.push({ position: currentMarkerBeat, name: name || `Marker ${markers.length + 1}` });
                markerContextActive = false;
            }
        }

        // ── 3b. Map track data from 238 events by sequential index ──
        // Playlist items use 0-based reversed index: trackBase = numTracks - 1.
        const trackBase = trackEvents238.length > 0 ? trackEvents238.length - 1 : 499;

        for (let i = 0; i < trackEvents238.length; i++) {
            const ev = trackEvents238[i];
            trackDataMap.set(i, { enabled: ev.enabled, grouped: ev.grouped });
        }

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
            const itemCount = Math.floor(playlistBuf.length / itemSize);

            for (let i = 0; i < itemCount; i++) {
                const base = i * itemSize;
                if (base + 16 > playlistBuf.length) break;

                const position    = playlistBuf.readUInt32LE(base + 0);
                const patternBase = playlistBuf.readUInt16LE(base + 4);  // always 20480
                const itemIndex   = playlistBuf.readUInt16LE(base + 6);
                const length      = playlistBuf.readUInt32LE(base + 8);
                const trackRvIdx  = playlistBuf.readUInt16LE(base + 12); // reversed index
                const trackIdx    = trackBase - trackRvIdx; // use auto-detected base

                if (position > 100_000_000 || length > 100_000_000) continue;

                const isChannel = itemIndex <= patternBase;
                let clipType: 'pattern' | 'audio' | 'automation';
                let itemLabel: string;
                let notes: NoteData[] | undefined;
                let sampleFileName: string | undefined;
                let automationPoints: AutomationPoint[] | undefined;

                if (isChannel) {
                    // Channel clip — check if it's an automation channel
                    const channelType = channelTypes.get(itemIndex);
                    const channelName = channelNames.get(itemIndex);
                    const samplePath = channelSamplePaths.get(itemIndex);

                    if (channelType === 5) {
                        // Automation clip
                        clipType = 'automation';
                        itemLabel = channelName || `Automation ${itemIndex}`;
                        automationPoints = channelAutomationPoints.get(itemIndex);
                    } else {
                        // Audio/sampler clip
                        clipType = 'audio';
                        itemLabel = channelName || (samplePath ? FLPParser.fileNameFromPath(samplePath) : `Audio ${itemIndex}`);
                        if (samplePath) {
                            sampleFileName = FLPParser.fileNameFromPath(samplePath);
                        }
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
                    automationPoints,
                });
            }
        }

        // ── 5. Build project info ──
        // Identify real plugins: channels with an internal name are plugins/instruments
        // "Fruity Wrapper" = VST plugin, other non-empty = native FL plugin
        // Channels without internal names are plain samplers/audio clips (not plugins)
        for (const [iid, internalName] of channelInternalNames) {
            const channelType = channelTypes.get(iid);
            if (channelType === 5) continue; // skip automation channels

            const displayName = channelNames.get(iid);
            if (internalName === 'Fruity Wrapper') {
                // VST plugin — use the display name (the VST's name)
                if (displayName) allPluginNames.add(displayName);
            } else {
                // Native FL plugin (e.g. "BooBass", "3x Osc", "FLEX")
                allPluginNames.add(displayName || internalName);
            }
        }

        // Add mixer effect plugin names
        for (const name of mixerPluginNames) {
            allPluginNames.add(name);
        }

        const plugins = Array.from(allPluginNames).sort();

        const samples = Array.from(allSamplePaths)
            .map(p => FLPParser.fileNameFromPath(p))
            .sort();

        const projectInfo: ProjectInfo = { plugins, samples };

        // ── 6. Build track list — include tracks from first used to last used ──
        // Collect clips by track index
        const trackMap = new Map<number, ClipData[]>();
        for (const clip of clips) {
            if (!trackMap.has(clip.track)) trackMap.set(clip.track, []);
            trackMap.get(clip.track)!.push(clip);
        }

        // Find first and last track indices that have content
        let firstUsedTrack = Infinity;
        let lastUsedTrack = 0;
        for (const tIdx of trackMap.keys()) {
            if (tIdx < firstUsedTrack) firstUsedTrack = tIdx;
            if (tIdx > lastUsedTrack) lastUsedTrack = tIdx;
        }
        if (firstUsedTrack === Infinity) firstUsedTrack = 0;

        // Also include any track that is a group parent of a used track
        // (Skip group parent expansion for now until we confirm the correct group byte offset)

        // Compute group parent for each track from the "grouped" boolean flag
        // In FL Studio: grouped=1 means "this track is grouped with the track above it"
        // grouped=0 means "this track starts a new section / is not grouped"
        // The parent of a grouped track is the nearest track above with grouped=0
        const trackGroupParent = new Map<number, number>(); // trackIdx → parent trackIdx (0 = no parent)
        for (let i = firstUsedTrack; i <= lastUsedTrack; i++) {
            const td = trackDataMap.get(i);
            if (td && td.grouped) {
                // Walk up to find the nearest non-grouped track
                let parent = i - 1;
                while (parent >= 0) {
                    const ptd = trackDataMap.get(parent);
                    if (!ptd || !ptd.grouped) break;
                    parent--;
                }
                if (parent >= 0) {
                    trackGroupParent.set(i, parent + 1); // store as 1-based for frontend compat (0 = no group)
                }
            }
        }

        // Include tracks from firstUsedTrack to lastUsedTrack (contiguous range)
        const outputTracks = [];
        for (let origId = firstUsedTrack; origId <= lastUsedTrack; origId++) {
            const td = trackDataMap.get(origId);
            outputTracks.push({
                id: origId,
                name: trackNameMap.get(origId) || `Track ${origId + 1}`,
                clips: trackMap.get(origId) || [],
                enabled: td?.enabled ?? true,
                group: trackGroupParent.get(origId) ?? 0, // 1-based parent track number, 0 = no group
            });
        }

        return {
            bpm: bpm || 140,
            signature: [4, 4],
            projectInfo,
            markers,
            tracks: outputTracks,
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
