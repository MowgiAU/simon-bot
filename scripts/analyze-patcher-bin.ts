/**
 * Focused Patcher binary payload analyzer.
 * Writes all output to patcher-analysis-output.txt.
 */
import * as fs from 'fs';

const FLP_URL = process.argv[2] || 'https://cdn.fujistud.io/tracks/cmngsrswp003z81uzuogesth4/project/project-1775093388834-668983257.flp';
const lines: string[] = [];
function L(s: string) { lines.push(s); }

/** Detects UTF-16LE (native FL plugins) vs ASCII/UTF-8 (VST wrappers) */
function smartDecode(buf: Buffer): string {
    if (buf.length >= 4 && buf.length % 2 === 0) {
        let nullCount = 0;
        for (let i = 1; i < buf.length; i += 2) {
            if (buf[i] === 0) nullCount++;
        }
        if (nullCount > buf.length / 4) {
            return buf.toString('utf16le').replace(/\0+$/, '');
        }
    }
    return buf.toString('utf8').replace(/\0+$/, '');
}

interface PPayload { label: string; size: number; buf: Buffer; }

async function main() {
    const resp = await fetch(FLP_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    L(`Downloaded ${buf.length} bytes`);

    const headerLen = buf.readUInt32LE(4);
    const dataStart = 8 + headerLen;
    let pos = dataStart + 8;
    const end = pos + buf.readUInt32LE(dataStart + 4);

    let chIID = 0, mixerCtr = -1, curMix = -1;
    let pluginInt = '', pluginDisp = '';
    const payloads: PPayload[] = [];

    while (pos < end) {
        const code = buf[pos++];
        let num = 0;
        let data: Buffer | null = null;

        if (code <= 63) { num = buf[pos++]; }
        else if (code <= 127) { num = buf.readUInt16LE(pos); pos += 2; }
        else if (code <= 191) { num = buf.readUInt32LE(pos); pos += 4; }
        else {
            let len = 0, shift = 0;
            while (pos < end) {
                const b = buf[pos++];
                len |= (b & 0x7f) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7;
            }
            data = buf.subarray(pos, pos + len);
            pos += len;
        }

        if (code === 64) { chIID = num; pluginInt = ''; pluginDisp = ''; }
        if (code === 233 && data) { chIID = 0; }
        if (code === 236) { mixerCtr++; curMix = mixerCtr; pluginInt = ''; pluginDisp = ''; }
        if (code === 201 && data) { pluginInt = smartDecode(data); }
        if (code === 203 && data) { pluginDisp = smartDecode(data); }

        if (code === 213 && data && pluginInt === 'Patcher') {
            const label = chIID > 0
                ? `Channel_${chIID}_${pluginDisp}`
                : `Mixer_${curMix}_${pluginDisp}`;
            payloads.push({ label, size: data.length, buf: Buffer.from(data) });
            L(`Found Patcher: ${label} (${data.length} bytes)`);
        }
    }

    L(`\nTotal Patcher payloads: ${payloads.length}\n`);

    for (const p of payloads) {
        L('='.repeat(80));
        L(`PATCHER: ${p.label} (${p.size} bytes)`);
        L('='.repeat(80));

        // Header - first 128 bytes as 32-bit LE fields
        L('\n--- HEADER (32-bit LE) ---');
        for (let i = 0; i < Math.min(128, p.size); i += 4) {
            if (i + 4 > p.size) break;
            const u32 = p.buf.readUInt32LE(i);
            const f32 = p.buf.readFloatLE(i);
            const hx = Array.from(p.buf.subarray(i, i + 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const asc = Array.from(p.buf.subarray(i, i + 4)).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
            L(`  ${i.toString(16).padStart(4, '0')}: ${hx}  u32=${String(u32).padStart(10)}  f32=${f32.toFixed(4).padStart(12)}  "${asc}"`);
        }

        // ASCII strings
        L('\n--- ASCII strings (>=3 chars) ---');
        for (const s of findAsciiStrings(p.buf, 3)) {
            L(`  @0x${s.off.toString(16).padStart(4, '0')}: "${s.text}"`);
        }

        // UTF-16LE strings
        L('\n--- UTF-16LE strings (>=3 chars) ---');
        for (const s of findUtf16Strings(p.buf, 3)) {
            L(`  @0x${s.off.toString(16).padStart(4, '0')}: "${s.text}"`);
        }

        // Patcher I/O markers
        L('\n--- Patcher markers ---');
        for (const marker of ['From FL', 'To FL', 'Patcher', 'Surface', 'Fruity', 'Wrapper', 'MIDI', 'Stereo', 'Mono']) {
            let idx = 0;
            while ((idx = p.buf.indexOf(marker, idx)) !== -1) {
                const ctx = p.buf.subarray(Math.max(0, idx - 8), Math.min(p.size, idx + marker.length + 16));
                L(`  ASCII "${marker}" @0x${idx.toString(16)}: ${hexStr(ctx)}`);
                idx += marker.length;
            }
            const u16 = Buffer.from(marker, 'utf16le');
            idx = 0;
            while ((idx = p.buf.indexOf(u16, idx)) !== -1) {
                const ctx = p.buf.subarray(Math.max(0, idx - 8), Math.min(p.size, idx + u16.length + 16));
                L(`  UTF16 "${marker}" @0x${idx.toString(16)}: ${hexStr(ctx)}`);
                idx += u16.length;
            }
        }

        // Small ints in header
        L('\n--- Small integers in first 64 bytes ---');
        for (let i = 0; i < Math.min(64, p.size - 3); i++) {
            const v = p.buf.readUInt32LE(i);
            if (v >= 2 && v <= 30) L(`  @0x${i.toString(16).padStart(4, '0')}: uint32=${v}`);
        }

        // Float coordinate pairs
        L('\n--- Float pairs (10-2000 range) ---');
        let cc = 0;
        for (let i = 0; i < p.size - 7; i += 4) {
            const f1 = p.buf.readFloatLE(i);
            const f2 = p.buf.readFloatLE(i + 4);
            if (f1 > 10 && f1 < 2000 && f2 > 10 && f2 < 2000 && isFinite(f1) && isFinite(f2)) {
                L(`  @0x${i.toString(16).padStart(4, '0')}: (${f1.toFixed(1)}, ${f2.toFixed(1)})`);
                if (++cc > 40) { L('  ...truncated'); break; }
            }
        }

        // Repeated 4-byte patterns
        L('\n--- Repeated 4-byte patterns (3+) ---');
        const pats = new Map<string, number[]>();
        for (let i = 0; i < p.size - 3; i++) {
            const key = p.buf.subarray(i, i + 4).toString('hex');
            if (!pats.has(key)) pats.set(key, []);
            pats.get(key)!.push(i);
        }
        [...pats.entries()]
            .filter(([, o]) => o.length >= 3 && o.length <= 50)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 20)
            .forEach(([hex, offs]) => {
                const preview = offs.slice(0, 6).map(o => '0x' + o.toString(16)).join(', ');
                L(`  ${hex} (${offs.length}x): ${preview}${offs.length > 6 ? '...' : ''}`);
            });

        // Hex dump
        if (p.size <= 4096) {
            L(`\n--- FULL HEX DUMP (${p.size} bytes) ---`);
            hexDump(p.buf, 0, p.size);
        } else {
            L(`\n--- HEX: first 512 ---`);
            hexDump(p.buf, 0, 512);
            L(`\n--- HEX: last 512 ---`);
            hexDump(p.buf, p.size - 512, p.size);
            for (const s of findUtf16Strings(p.buf, 3)) {
                const from = Math.max(0, s.off - 32);
                const to = Math.min(p.size, s.off + s.text.length * 2 + 64);
                L(`\n--- HEX around "${s.text}" @0x${s.off.toString(16)} ---`);
                hexDump(p.buf, from, to);
            }
        }

        // Save binary
        const outName = `patcher-${p.label.replace(/[^a-z0-9]/gi, '_')}.bin`;
        fs.writeFileSync(outName, p.buf);
        L(`\nSaved: ${outName}`);
    }

    fs.writeFileSync('patcher-analysis-output.txt', lines.join('\n'), 'utf8');
    console.log(`Done. Wrote ${lines.length} lines to patcher-analysis-output.txt`);
}

function hexDump(buf: Buffer, from: number, to: number) {
    for (let i = from; i < to; i += 32) {
        const slice = buf.subarray(i, Math.min(i + 32, to));
        const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const asc = Array.from(slice).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
        L(`  ${i.toString(16).padStart(6, '0')}: ${hex.padEnd(96)} ${asc}`);
    }
}

function findAsciiStrings(buf: Buffer, min: number): Array<{ off: number; text: string }> {
    const r: Array<{ off: number; text: string }> = [];
    let cur = '', start = 0;
    for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b >= 32 && b < 127) { if (!cur) start = i; cur += String.fromCharCode(b); }
        else { if (cur.length >= min) r.push({ off: start, text: cur }); cur = ''; }
    }
    if (cur.length >= min) r.push({ off: start, text: cur });
    return r;
}

function findUtf16Strings(buf: Buffer, min: number): Array<{ off: number; text: string }> {
    const r: Array<{ off: number; text: string }> = [];
    for (let align = 0; align <= 1; align++) {
        let cur = '', start = 0;
        for (let i = align; i < buf.length - 1; i += 2) {
            if (buf[i + 1] === 0 && buf[i] >= 32 && buf[i] < 127) {
                if (!cur) start = i; cur += String.fromCharCode(buf[i]);
            } else {
                if (cur.length >= min && !r.some(x => Math.abs(x.off - start) <= 1 && x.text === cur))
                    r.push({ off: start, text: cur });
                cur = '';
            }
        }
        if (cur.length >= min && !r.some(x => Math.abs(x.off - start) <= 1 && x.text === cur))
            r.push({ off: start, text: cur });
    }
    return r.sort((a, b) => a.off - b.off);
}

function hexStr(buf: Buffer): string {
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

main().catch(e => { console.error(e); process.exit(1); });
