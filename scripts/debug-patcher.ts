/**
 * Debug script: Download an FLP file and dump all event 213 payloads,
 * especially for Patcher channels, to reverse-engineer the binary format.
 */

import * as fs from 'fs';
import * as path from 'path';

const FLP_URL = process.argv[2] || 'https://cdn.fujistud.io/tracks/cmngs9f8u003p81uzhzreipyh/project/project-1775092529423-741971216.flp';

async function main() {
    console.log(`Fetching: ${FLP_URL}`);
    const resp = await fetch(FLP_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    console.log(`Downloaded ${buf.length} bytes\n`);

    // ── Parse FLP header ──
    const magic = buf.toString('ascii', 0, 4);
    if (magic !== 'FLhd') throw new Error('Not an FLP file');
    const headerLen = buf.readUInt32LE(4);
    const dataStart = 8 + headerLen;

    // Skip to FLdt chunk
    const fldt = buf.toString('ascii', dataStart, dataStart + 4);
    if (fldt !== 'FLdt') throw new Error('Missing FLdt chunk');
    const dataLen = buf.readUInt32LE(dataStart + 4);
    let pos = dataStart + 8;
    const end = pos + dataLen;

    // ── Track state (matching FLPParser.ts logic exactly) ──
    let currentChannelIID = 0;
    let currentMixerInsert = -1;
    let mixerInsertCounter = -1;
    let pendingPluginInternal = '';
    let pendingPluginDisplay = '';
    let channelNames: Map<number, string> = new Map();
    let channelPlugins: Map<number, string> = new Map();
    let channelDisplayNames: Map<number, string> = new Map();
    let eventIndex = 0;
    let pluginStatePayloads: Array<{
        eventIdx: number;
        context: string;
        channelIID: number;
        mixerInsert: number;
        pluginInternal: string;
        pluginDisplay: string;
        size: number;
        buf: Buffer;
    }> = [];

    // Also capture ALL channel event 213 payloads (instrument plugins)
    let channelPluginPayloads: Array<{
        eventIdx: number;
        channelIID: number;
        pluginInternal: string;
        pluginDisplay: string;
        size: number;
        buf: Buffer;
    }> = [];

    while (pos < end) {
        const code = buf[pos++];
        let num = 0;
        let dataBuf: Buffer | null = null;

        if (code <= 63) {
            // BYTE event
            if (pos >= end) break;
            num = buf[pos++];
        } else if (code <= 127) {
            // WORD event
            if (pos + 2 > end) break;
            num = buf.readUInt16LE(pos);
            pos += 2;
        } else if (code <= 191) {
            // DWORD event
            if (pos + 4 > end) break;
            num = buf.readUInt32LE(pos);
            pos += 4;
        } else {
            // TEXT/DATA event (variable length)
            let len = 0;
            let shift = 0;
            while (pos < end) {
                const b = buf[pos++];
                len |= (b & 0x7f) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7;
            }
            if (pos + len > end) break;
            dataBuf = buf.subarray(pos, pos + len);
            pos += len;
        }

        // ── Channel New (64 = WORD): marks start of new channel ──
        if (code === 64) {
            currentChannelIID = num;
            pendingPluginInternal = '';
            pendingPluginDisplay = '';
        }

        // ── Playlist items (233 = DATA+25): end of channel section ──
        if (code === 233 && dataBuf) {
            currentChannelIID = 0;
        }

        // ── Mixer insert state (236 = DATA+28): new mixer insert ──
        if (code === 236) {
            mixerInsertCounter++;
            currentMixerInsert = mixerInsertCounter;
            pendingPluginInternal = '';
            pendingPluginDisplay = '';
        }

        // ── Channel name legacy (192) ──
        if (code === 192 && dataBuf && currentChannelIID > 0) {
            const str = dataBuf.toString('utf8').replace(/\0+$/, '');
            if (!channelNames.has(currentChannelIID)) channelNames.set(currentChannelIID, str);
        }

        // ── Plugin internal name (201 = TEXT+9) ──
        if (code === 201 && dataBuf) {
            const str = dataBuf.toString('utf8').replace(/\0+$/, '');
            if (currentChannelIID > 0) {
                pendingPluginInternal = str;
                channelPlugins.set(currentChannelIID, str);
            } else if (currentMixerInsert >= 0) {
                pendingPluginInternal = str;
            }
        }

        // ── Plugin display name (203 = TEXT+11) ──
        if (code === 203 && dataBuf) {
            const str = dataBuf.toString('utf8').replace(/\0+$/, '');
            if (currentChannelIID > 0) {
                pendingPluginDisplay = str;
                channelNames.set(currentChannelIID, str);
                channelDisplayNames.set(currentChannelIID, str);
            } else if (currentMixerInsert >= 0) {
                pendingPluginDisplay = str;
            }
        }

        // ── Channel plugin state (213 in channel context) ──
        if (code === 213 && dataBuf && currentChannelIID > 0) {
            channelPluginPayloads.push({
                eventIdx: eventIndex,
                channelIID: currentChannelIID,
                pluginInternal: pendingPluginInternal,
                pluginDisplay: pendingPluginDisplay,
                size: dataBuf.length,
                buf: Buffer.from(dataBuf),
            });
        }

        // ── Mixer slot plugin state (213 in mixer context) ──
        if (code === 213 && dataBuf && currentChannelIID === 0 && currentMixerInsert >= 0) {
            pluginStatePayloads.push({
                eventIdx: eventIndex,
                context: 'mixer',
                channelIID: 0,
                mixerInsert: currentMixerInsert,
                pluginInternal: pendingPluginInternal,
                pluginDisplay: pendingPluginDisplay,
                size: dataBuf.length,
                buf: Buffer.from(dataBuf),
            });
            pendingPluginInternal = '';
            pendingPluginDisplay = '';
        }

        eventIndex++;
    }

    // ── Print summary ──
    console.log('=== ALL CHANNELS ===\n');
    for (const [iid, name] of channelNames) {
        const plugin = channelPlugins.get(iid) || '(no internal name)';
        const display = channelDisplayNames.get(iid) || '(no display name)';
        console.log(`  Channel ${iid}: name="${name}" internal="${plugin}" display="${display}"`);
    }

    console.log(`\n=== CHANNEL PLUGIN PAYLOADS (event 213 in channel context) === (${channelPluginPayloads.length} total)\n`);
    for (const p of channelPluginPayloads) {
        const isPatcher = p.pluginInternal === 'Patcher' || p.pluginDisplay.toLowerCase().includes('patcher');
        console.log(`[${p.eventIdx}] Channel IID: ${p.channelIID} | "${p.pluginInternal}" / "${p.pluginDisplay}" ${isPatcher ? '⭐ PATCHER' : ''} | ${p.size} bytes`);
        
        // Show strings for all payloads
        const strings = extractStrings(p.buf, 4);
        if (strings.length > 0) {
            console.log('  Strings:');
            for (const s of strings.slice(0, 15)) {
                console.log(`    @0x${s.offset.toString(16).padStart(4, '0')}: "${s.text}"`);
            }
            if (strings.length > 15) console.log(`    ... +${strings.length - 15} more`);
        }
        console.log();
    }

    console.log(`\n=== MIXER SLOT PAYLOADS (event 213 in mixer context) === (${pluginStatePayloads.length} total)\n`);
    for (const p of pluginStatePayloads) {
        const isPatcher = p.pluginInternal === 'Patcher' || p.pluginDisplay.toLowerCase().includes('patcher');
        console.log(`[${p.eventIdx}] Mixer Insert: ${p.mixerInsert} | "${p.pluginInternal}" / "${p.pluginDisplay}" ${isPatcher ? '⭐ PATCHER' : ''} | ${p.size} bytes`);
        
        const strings = extractStrings(p.buf, 4);
        if (strings.length > 0) {
            console.log('  Strings:');
            for (const s of strings.slice(0, 15)) {
                console.log(`    @0x${s.offset.toString(16).padStart(4, '0')}: "${s.text}"`);
            }
            if (strings.length > 15) console.log(`    ... +${strings.length - 15} more`);
        }
        console.log();
    }

    // ── Deep dive into Patcher payloads (both channel and mixer) ──
    const patcherPayloads = [
        ...channelPluginPayloads.filter(p => p.pluginInternal === 'Patcher'),
        ...pluginStatePayloads.filter(p => p.pluginInternal === 'Patcher'),
    ];

    console.log(`\n🔍 Found ${patcherPayloads.length} Patcher payload(s)\n`);

    if (patcherPayloads.length === 0) {
        console.log('❌ No Patcher channels found in this FLP file.');
        return;
    }

    for (const p of patcherPayloads) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`⭐ PATCHER DEEP DIVE: "${p.pluginDisplay}" (${p.size} bytes)`);
        console.log(`${'='.repeat(80)}\n`);

        // 1. Find all readable strings in the payload (ASCII)
        console.log('--- Readable strings (ASCII) ---');
        const strings = extractStrings(p.buf, 3);
        for (const s of strings) {
            console.log(`  @0x${s.offset.toString(16).padStart(4, '0')}: "${s.text}"`);
        }

        // 1b. Find UTF-16LE strings
        console.log('\n--- Readable strings (UTF-16LE) ---');
        const utf16Strings = extractUtf16Strings(p.buf, 3);
        for (const s of utf16Strings) {
            console.log(`  @0x${s.offset.toString(16).padStart(4, '0')}: "${s.text}"`);
        }

        // 2. Look for known FL plugin names
        console.log('\n--- Known plugin name occurrences ---');
        const knownPlugins = [
            'Patcher', 'Fruity Wrapper', 'Fruity Parametric EQ 2', 'Fruity Limiter',
            'Fruity Reeverb 2', 'Fruity Delay 3', 'Fruity Chorus', 'Fruity Filter',
            'Fruity Compressor', 'Fruity Soft Clipper', 'Fruity Send', 'Fruity Balance',
            'Soundgoodizer', 'Maximus', 'Gross Beat', 'Vocodex', 'Pitcher',
            'Sytrus', 'Harmor', 'Harmless', 'Serum', 'FLEX', 'GMS',
            '3x Osc', 'Sakura', 'PoiZone', 'Toxic Biohazard',
            'FL Keys', 'DirectWave', 'Morphine', 'Sawer',
            'From FL', 'To FL', // Patcher internal I/O nodes
        ];
        for (const name of knownPlugins) {
            let idx = 0;
            while (true) {
                idx = p.buf.indexOf(name, idx);
                if (idx === -1) break;
                // Show surrounding context
                const ctxStart = Math.max(0, idx - 16);
                const ctxEnd = Math.min(p.buf.length, idx + name.length + 32);
                const ctx = p.buf.subarray(ctxStart, ctxEnd);
                const hexStr = Array.from(ctx).map(b => b.toString(16).padStart(2, '0')).join(' ');
                console.log(`  "${name}" at offset 0x${idx.toString(16)}: ${hexStr}`);
                idx += name.length;
            }
        }

        // 3. Dump hex — full for small payloads, first 4096 for large
        const dumpLen = Math.min(p.size <= 4096 ? p.size : 4096, p.size);
        console.log(`\n--- Hex dump (${dumpLen} of ${p.size} bytes) ---`);
        for (let i = 0; i < dumpLen; i += 32) {
            const slice = p.buf.subarray(i, Math.min(i + 32, dumpLen));
            const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(slice).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
            console.log(`  ${i.toString(16).padStart(6, '0')}: ${hex.padEnd(96)} ${ascii}`);
        }

        // 4. Look for structural patterns (repeated byte sequences that might be node headers)
        console.log('\n--- Potential structural markers (repeated 4-byte patterns) ---');
        const fourBytePatterns = new Map<string, number[]>();
        for (let i = 0; i < p.size - 4; i++) {
            const key = p.buf.subarray(i, i + 4).toString('hex');
            if (!fourBytePatterns.has(key)) fourBytePatterns.set(key, []);
            fourBytePatterns.get(key)!.push(i);
        }
        // Show patterns that repeat 3+ times (likely structural)
        const repeats = [...fourBytePatterns.entries()]
            .filter(([, offsets]) => offsets.length >= 3 && offsets.length <= 50)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 30);
        for (const [hex, offsets] of repeats) {
            const preview = offsets.slice(0, 8).map(o => `0x${o.toString(16)}`).join(', ');
            console.log(`  ${hex} (${offsets.length}x): ${preview}${offsets.length > 8 ? '...' : ''}`);
        }

        // 5. Save full payload to disk for manual inspection
        const outPath = path.join(process.cwd(), `patcher-payload-${p.channelIID}.bin`);
        fs.writeFileSync(outPath, p.buf);
        console.log(`\n  Full payload saved to: ${outPath}`);
    }
}

function extractStrings(buf: Buffer, minLen: number): Array<{ offset: number; text: string }> {
    const results: Array<{ offset: number; text: string }> = [];
    let current = '';
    let startOffset = 0;
    for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b >= 32 && b < 127) {
            if (current === '') startOffset = i;
            current += String.fromCharCode(b);
        } else {
            if (current.length >= minLen) {
                results.push({ offset: startOffset, text: current });
            }
            current = '';
        }
    }
    if (current.length >= minLen) {
        results.push({ offset: startOffset, text: current });
    }
    return results;
}

function extractUtf16Strings(buf: Buffer, minLen: number): Array<{ offset: number; text: string }> {
    const results: Array<{ offset: number; text: string }> = [];
    // Scan for UTF-16LE: printable char followed by 0x00
    let current = '';
    let startOffset = 0;
    for (let i = 0; i < buf.length - 1; i += 2) {
        const lo = buf[i];
        const hi = buf[i + 1];
        if (hi === 0 && lo >= 32 && lo < 127) {
            if (current === '') startOffset = i;
            current += String.fromCharCode(lo);
        } else {
            if (current.length >= minLen) {
                results.push({ offset: startOffset, text: current });
            }
            current = '';
        }
    }
    if (current.length >= minLen) {
        results.push({ offset: startOffset, text: current });
    }
    // Also try odd-aligned
    current = '';
    for (let i = 1; i < buf.length - 1; i += 2) {
        const lo = buf[i];
        const hi = buf[i + 1];
        if (hi === 0 && lo >= 32 && lo < 127) {
            if (current === '') startOffset = i;
            current += String.fromCharCode(lo);
        } else {
            if (current.length >= minLen) {
                // Avoid duplicates from even-aligned scan
                const isDupe = results.some(r => r.offset === startOffset || (r.offset < startOffset && r.offset + r.text.length * 2 > startOffset));
                if (!isDupe) results.push({ offset: startOffset, text: current });
            }
            current = '';
        }
    }
    return results.sort((a, b) => a.offset - b.offset);
}

main().catch(e => { console.error(e); process.exit(1); });
