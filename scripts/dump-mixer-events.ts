import { readFileSync, writeFileSync, existsSync } from 'fs';

const localPath = 'test-project.flp';

if (!existsSync(localPath)) {
    console.log('Downloading FLP...');
    const resp = await fetch('https://cdn.fujistud.io/tracks/cmngsrswp003z81uzuogesth4/project/project-1775093388834-668983257.flp');
    const buf = Buffer.from(await resp.arrayBuffer());
    writeFileSync(localPath, buf);
    console.log(`Saved ${buf.length} bytes`);
}

const buffer = readFileSync(localPath);
console.log(`FLP size: ${buffer.length} bytes`);

let offset = 0;
if (buffer.toString('ascii', 0, 4) !== 'FLhd') throw new Error('Bad FLP');
offset = 4;
const headerLen = buffer.readUInt32LE(offset); offset += 4;
offset += headerLen;
if (buffer.toString('ascii', offset, offset + 4) !== 'FLdt') throw new Error('Bad FLdt');
offset += 4;
const dtLen = buffer.readUInt32LE(offset); offset += 4;
const dataEnd = offset + dtLen;

function readVLQ(): number {
    let len = 0, shift = 0;
    while (offset < dataEnd) {
        const b = buffer[offset++];
        len |= (b & 0x7F) << shift;
        shift += 7;
        if (!(b & 0x80)) break;
    }
    return len;
}

function readEvent(): { code: number; num: number; buf: Buffer | null } | null {
    if (offset >= dataEnd) return null;
    const code = buffer[offset++];
    let num = 0;
    let buf: Buffer | null = null;
    if (code <= 63) { num = buffer[offset++]; }
    else if (code <= 127) { num = buffer.readUInt16LE(offset); offset += 2; }
    else if (code <= 191) { num = buffer.readUInt32LE(offset); offset += 4; }
    else {
        const len = readVLQ();
        buf = Buffer.from(buffer.subarray(offset, offset + len));
        offset += len;
    }
    return { code, num, buf };
}

function readStr(buf: Buffer): string {
    if (buf.length >= 2 && buf[1] === 0) return buf.toString('utf16le').replace(/\0+$/, '');
    return buf.toString('ascii').replace(/\0+$/, '');
}

// First pass: count all event codes
const savedOffset = offset;
const codeCounts = new Map<number, number>();
while (offset < dataEnd) {
    const ev = readEvent();
    if (!ev) break;
    codeCounts.set(ev.code, (codeCounts.get(ev.code) || 0) + 1);
}

console.log('\n=== ALL EVENT CODES ===');
for (const [c, n] of [...codeCounts.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  code ${c}: ${n} times`);
}

// Reset for second pass
offset = savedOffset;

let mixerCounter = -1;
let eventIdx = 0;
console.log('\n=== MIXER EVENTS (first 11 inserts) ===');

while (offset < dataEnd) {
    const ev = readEvent();
    if (!ev) break;
    const { code, num, buf } = ev;

    if (code === 236) {
        mixerCounter++;
        console.log(`\n[${eventIdx}] === MIXER INSERT #${mixerCounter} (code 236) ===`);
    }
    if (mixerCounter >= 0 && mixerCounter <= 10) {
        if (code === 204 && buf) console.log(`  [${eventIdx}] 204 name: "${readStr(buf)}"`);
        if (code === 201 && buf) console.log(`  [${eventIdx}] 201 plugin: "${readStr(buf)}"`);
        if (code === 203 && buf) console.log(`  [${eventIdx}] 203 display: "${readStr(buf)}"`);
        if (code === 213 && buf) console.log(`  [${eventIdx}] 213 slot_data: ${buf.length} bytes`);
        if (code === 212 && buf) console.log(`  [${eventIdx}] 212 routing: ${buf.length} bytes`);
        if (code === 147) console.log(`  [${eventIdx}] 147 input: ${num}`);
    }

    eventIdx++;
    if (mixerCounter > 10) break;
}
