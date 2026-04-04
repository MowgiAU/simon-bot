// Minimal test: find Patcher in FLP

/** Detects if buffer is UTF-16LE (every other byte is 0x00) and decodes accordingly */
function smartDecode(buf: Buffer): string {
    // Check if this looks like UTF-16LE: even length, and most odd-index bytes are 0x00
    if (buf.length >= 4 && buf.length % 2 === 0) {
        let nullCount = 0;
        for (let i = 1; i < buf.length; i += 2) {
            if (buf[i] === 0) nullCount++;
        }
        if (nullCount > buf.length / 4) {
            // Likely UTF-16LE
            return buf.toString('utf16le').replace(/\0+$/, '');
        }
    }
    return buf.toString('utf8').replace(/\0+$/, '');
}

async function main() {
    const url = 'https://cdn.fujistud.io/tracks/cmngsrswp003z81uzuogesth4/project/project-1775093388834-668983257.flp';
    const r = await fetch(url);
    const buf = Buffer.from(await r.arrayBuffer());
    console.log('Size:', buf.length);

    const headerLen = buf.readUInt32LE(4);
    const dataStart = 8 + headerLen;
    let pos = dataStart + 8;
    const end = pos + buf.readUInt32LE(dataStart + 4);

    let chIID = 0, mixCtr = -1, curMix = -1, plugInt = '', found = 0;
    let evtCount = 0;

    while (pos < end) {
        const code = buf[pos++];
        let data: Buffer | null = null;

        if (code <= 63) { pos++; }
        else if (code <= 127) { 
            if (code === 64) chIID = buf.readUInt16LE(pos); 
            pos += 2; 
        }
        else if (code <= 191) { pos += 4; }
        else {
            let len = 0, shift = 0;
            while (pos < end) { 
                const b = buf[pos++]; 
                len |= (b & 0x7f) << shift; 
                if (!(b & 0x80)) break; 
                shift += 7; 
            }
            data = buf.subarray(pos, pos + len);
            pos += len;
        }

        if (code === 233 && data) chIID = 0;
        if (code === 236) { mixCtr++; curMix = mixCtr; plugInt = ''; }
        if (code === 201 && data) { 
            // FL Studio native plugins store names as UTF-16LE, VSTs as ASCII
            const raw = smartDecode(data);
            plugInt = raw;
            if (raw.includes('atcher')) {
                console.log(`  evt 201: "${raw}" (decoded) chIID=${chIID} mixer=${curMix}`);
            }
        }
        if (code === 213 && data && plugInt === 'Patcher') { 
            found++; 
            const loc = chIID > 0 ? `channel ${chIID}` : `mixer ${curMix}`;
            console.log(`  FOUND Patcher payload: ${loc}, ${data.length} bytes`);
        }
        evtCount++;
    }
    // Search raw binary for "Patcher" string
    console.log('\nSearching raw binary for "Patcher"...');
    let searchIdx = 0;
    while ((searchIdx = buf.indexOf('Patcher', searchIdx)) !== -1) {
        const ctx = buf.subarray(Math.max(0, searchIdx - 16), Math.min(buf.length, searchIdx + 24));
        const hex = Array.from(ctx).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  Found "Patcher" at offset ${searchIdx} (0x${searchIdx.toString(16)}): ${hex}`);
        searchIdx++;
    }
    // Also search UTF-16LE
    const patcherU16 = Buffer.from('Patcher', 'utf16le');
    searchIdx = 0;
    while ((searchIdx = buf.indexOf(patcherU16, searchIdx)) !== -1) {
        const ctx = buf.subarray(Math.max(0, searchIdx - 16), Math.min(buf.length, searchIdx + 32));
        const hex = Array.from(ctx).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  Found UTF16 "Patcher" at offset ${searchIdx} (0x${searchIdx.toString(16)}): ${hex}`);
        searchIdx++;
    }

    console.log(`\nParsed ${evtCount} events, found ${found} Patcher payload(s)`);
}
main().catch(e => { console.error(e); process.exit(1); });
