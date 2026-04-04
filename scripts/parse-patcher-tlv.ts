/**
 * parse-patcher-tlv.ts — Scan a Patcher binary payload for TLV records.
 * Reads the .bin file saved by analyze-patcher-bin.ts
 * Finds all offsets where a 0x1388–0x139F type ID appears, then tries
 * to decode the record assuming [type:u32][length:u32][data:length].
 */
import { readFileSync } from 'fs';

const file = process.argv[2] || 'patcher-Mixer_0_Mid_side.bin';
const buf = readFileSync(file);
const len = buf.length;

function smartDecode(b: Buffer): string {
  const oddZeros = [...b].filter((_, i) => i % 2 === 1 && b[i] === 0).length;
  if (b.length >= 4 && oddZeros / Math.floor(b.length / 2) > 0.25) {
    return b.toString('utf16le').replace(/\0+$/, '');
  }
  return b.toString('utf8').replace(/\0+$/, '');
}

const TYPE_NAMES: Record<number, string> = {
  0x1388: 'NODE_HEADER',
  0x1389: 'NODE_END',
  0x138A: '?_138A',
  0x138B: '?_138B',
  0x138C: 'INTERNAL_NAME',
  0x138D: 'PLUGIN_STATE',
  0x138E: '?_138E',
  0x138F: 'UI_DATA',
  0x1390: 'DISPLAY_NAME',
  0x1391: 'PORT_DEF',
  0x1392: 'PRESET_NAME',
  0x0578: 'IO_HEADER',
  0x0579: 'IO_END',
  0x057A: 'IO_NAME',
  0x0514: 'CONNECTION',
  0x0515: 'CONNECTION_END',
  0x05DC: 'NODE_POS',
  0x0640: 'NODE_POS_DATA',
  0x03E8: '?_03E8',
  0x03EA: '?_03EA',
  0x03EB: '?_03EB',
};

// First, scan for ALL potential type IDs in the 0x1388-0x139F range and other known types
console.log(`=== Scanning ${file} (${len} bytes) for TLV type IDs ===\n`);

const typeRanges = [
  [0x1388, 0x139F],  // Patcher node records
  [0x0510, 0x051F],  // Connections?
  [0x0570, 0x057F],  // I/O nodes?
  [0x05D0, 0x05DF],  // Position?
  [0x0630, 0x064F],  // Position data?
];

// Find all type ID occurrences
const hits: { offset: number; type: number }[] = [];
for (let i = 0; i <= len - 4; i++) {
  const val = buf.readUInt32LE(i);
  for (const [lo, hi] of typeRanges) {
    if (val >= lo && val <= hi) {
      hits.push({ offset: i, type: val });
    }
  }
}

// Also scan for any recurring 4-byte value that could be a type ID
// by looking for values that appear multiple times and are followed by what looks like a length
const valueCounts = new Map<number, number[]>();
for (let i = 0; i <= len - 8; i += 4) {
  const val = buf.readUInt32LE(i);
  if (val >= 0x100 && val <= 0x2000) {
    if (!valueCounts.has(val)) valueCounts.set(val, []);
    valueCounts.get(val)!.push(i);
  }
}

console.log('--- Recurring type-like values (>= 2 occurrences, 4-byte aligned) ---');
for (const [val, offsets] of [...valueCounts.entries()].sort((a, b) => a[0] - b[0])) {
  if (offsets.length >= 2) {
    const name = TYPE_NAMES[val] || '';
    console.log(`  0x${val.toString(16).padStart(4, '0')} (${val}): ${offsets.length}x at [${offsets.map(o => '0x' + o.toString(16)).join(', ')}] ${name}`);
  }
}

console.log('\n--- All 0x13xx type occurrences (any alignment) ---');
for (const h of hits) {
  const name = TYPE_NAMES[h.type] || `?_${h.type.toString(16)}`;
  const nextU32 = h.offset + 4 <= len - 4 ? buf.readUInt32LE(h.offset + 4) : -1;
  console.log(`  @0x${h.offset.toString(16).padStart(4, '0')}: type=0x${h.type.toString(16)} (${name}), next_u32=${nextU32} (possible length)`);
}

// Now try to walk the TLV records starting from a known offset
// The 0x1388 records are node headers. Let's find the first one.
console.log('\n\n=== TLV RECORD WALK ===');

// Find first 0x1388 occurrence
let pos = 0;
for (let i = 0; i <= len - 4; i++) {
  if (buf.readUInt32LE(i) === 0x1388) {
    pos = i;
    break;
  }
}

console.log(`\nFirst 0x1388 found at offset 0x${pos.toString(16)}\n`);
console.log(`--- Header bytes (0x000 to 0x${(pos-1).toString(16)}) ---`);

// Print the header structure
for (let i = 0; i < Math.min(pos, 256); i += 4) {
  const u32 = buf.readUInt32LE(i);
  const f32 = buf.readFloatLE(i);
  if (u32 !== 0) {
    console.log(`  @0x${i.toString(16).padStart(4, '0')}: u32=${u32} (0x${u32.toString(16)})  f32=${f32.toFixed(4)}`);
  }
}

// Now walk TLV records from first 0x1388
// Format hypothesis: [type:u32][length:u32][data:length_bytes]
// OR: [type:u32][length:u32][reserved:u32][data:length_bytes]
// Let's test BOTH and see which one chains correctly

function walkTLV(startPos: number, overhead: number, label: string) {
  console.log(`\n--- Walk with ${label} (overhead=${overhead}) ---`);
  let p = startPos;
  let recordNum = 0;
  while (p + 8 <= len) {
    const type = buf.readUInt32LE(p);
    const typeHex = type.toString(16).padStart(4, '0');
    const name = TYPE_NAMES[type] || '';

    // Check if this looks like a valid type
    if (!((type >= 0x1388 && type <= 0x139F) || (type >= 0x0510 && type <= 0x065F))) {
      console.log(`  [${recordNum}] @0x${p.toString(16).padStart(4, '0')}: UNEXPECTED type=0x${typeHex} — stopping walk`);
      console.log(`    Bytes: ${[...buf.slice(p, Math.min(p + 32, len))].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      break;
    }

    const dataLen = buf.readUInt32LE(p + 4);
    const dataStart = p + overhead;
    const dataEnd = dataStart + dataLen;

    if (dataEnd > len) {
      console.log(`  [${recordNum}] @0x${p.toString(16).padStart(4, '0')}: type=0x${typeHex} (${name}), len=${dataLen} — DATA EXCEEDS FILE (ends at 0x${dataEnd.toString(16)}) — stopping`);
      break;
    }

    const data = buf.slice(dataStart, dataEnd);

    // Decode data
    let decoded = '';
    if (name.includes('NAME') && dataLen > 0) {
      decoded = ` → "${smartDecode(data)}"`;
    } else if (dataLen > 0 && dataLen <= 64) {
      const hex = [...data].map(b => b.toString(16).padStart(2, '0')).join(' ');
      decoded = ` → [${hex}]`;

      // Try to decode fields within node header
      if (type === 0x1388 && dataLen >= 24) {
        const fields = [];
        for (let fi = 0; fi < Math.min(dataLen, 40); fi += 4) {
          fields.push(data.readUInt32LE(fi));
        }
        decoded += `\n      fields: [${fields.join(', ')}]`;
      }
    } else if (dataLen > 64) {
      decoded = ` → [${dataLen} bytes of data]`;
    }

    console.log(`  [${recordNum}] @0x${p.toString(16).padStart(4, '0')}: type=0x${typeHex} (${name}), len=${dataLen}${decoded}`);

    p = dataEnd;
    recordNum++;

    if (recordNum > 200) {
      console.log('  ... too many records, stopping');
      break;
    }
  }
  console.log(`  Walk ended at offset 0x${p.toString(16)} (${p} / ${len}), ${recordNum} records`);
}

// The 12-byte overhead format works. Now do a full walk that skips inter-node gaps.
console.log('\n--- FULL FILE WALK (with gap skipping) ---');

const VALID_TYPES = new Set([
  0x1388, 0x1389, 0x138C, 0x138D, 0x138F, 0x1390, 0x1391, 0x1392,
  0x0578, 0x0579, 0x057A,
  0x0514, 0x0515,
  0x05DC, 0x0640,
]);

let p = pos;
let recNum = 0;
let nodeCount = 0;
let currentNodeName = '';

while (p < len) {
  const type = buf.readUInt32LE(p);
  
  if (!VALID_TYPES.has(type)) {
    // Try to find the next valid type
    let found = false;
    for (let scan = p; scan < Math.min(p + 64, len - 4); scan++) {
      const scanType = buf.readUInt32LE(scan);
      if (VALID_TYPES.has(scanType)) {
        const gapBytes = scan - p;
        const gapData = [...buf.slice(p, scan)].map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  [GAP] ${gapBytes} bytes at 0x${p.toString(16)}: ${gapData}`);
        p = scan;
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  [END] No more valid types found after 0x${p.toString(16)}`);
      // Check if there's more data to scan
      const remaining = len - p;
      if (remaining > 0 && remaining <= 128) {
        console.log(`  Remaining ${remaining} bytes: ${[...buf.slice(p, len)].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      }
      break;
    }
    continue;
  }

  const dataLen = buf.readUInt32LE(p + 4);
  const reserved = buf.readUInt32LE(p + 8);
  const dataStart = p + 12;
  const dataEnd = dataStart + dataLen;
  const name = TYPE_NAMES[type] || `?_${type.toString(16)}`;

  if (dataEnd > len) {
    console.log(`  [${recNum}] @0x${p.toString(16).padStart(4, '0')}: type=0x${type.toString(16)} (${name}), len=${dataLen} — EXCEEDS FILE`);
    break;
  }

  const data = buf.slice(dataStart, dataEnd);
  let decoded = '';

  switch (type) {
    case 0x1388: { // NODE_HEADER
      nodeCount++;
      if (dataLen >= 24) {
        const fields: number[] = [];
        for (let fi = 0; fi < Math.min(dataLen, 40); fi += 4) fields.push(data.readUInt32LE(fi));
        decoded = `  fields: [${fields.join(', ')}]`;
        decoded += `\n      field_0=${fields[0]} (unk), node_id=0x${fields[1].toString(16)} (${fields[1]}), field_4=${fields[4]}, node_type=${fields[5]} (${fields[5] === 5 ? 'effect' : fields[5] === 1 ? 'instrument?' : '?'})`;
      }
      console.log(`\n  === NODE ${nodeCount} ===`);
      break;
    }
    case 0x138C: { // INTERNAL_NAME
      const str = smartDecode(data);
      decoded = `  → "${str}"`;
      currentNodeName = str;
      break;
    }
    case 0x1390: { // DISPLAY_NAME
      decoded = `  → "${smartDecode(data)}"`;
      break;
    }
    case 0x1392: { // PRESET_NAME
      decoded = `  → "${smartDecode(data)}"`;
      break;
    }
    case 0x138D: { // PLUGIN_STATE
      decoded = `  [${dataLen} bytes of plugin state]`;
      break;
    }
    case 0x138F: { // UI_DATA
      if (dataLen >= 4) {
        const f0 = data.readFloatLE(0);
        const i0 = data.readInt32LE(0);
        const fields: string[] = [];
        for (let fi = 0; fi < Math.min(dataLen, 40); fi += 4) {
          const fv = data.readFloatLE(fi);
          const iv = data.readInt32LE(fi);
          fields.push(`${iv}/${fv.toFixed(2)}`);
        }
        decoded = `  → [${fields.join(', ')}]`;
      }
      break;
    }
    case 0x1391: { // PORT_DEF
      if (dataLen >= 20) {
        const portUnk0 = data.readUInt32LE(0);
        const portIndex = data.readUInt32LE(4);
        const portId = data.readUInt32LE(8);
        const portUnk3 = data.readUInt32LE(12);
        const portType = data.readUInt32LE(16);
        decoded = `  unk0=${portUnk0} index=${portIndex} id=0x${portId.toString(16)} (${portId}) unk3=${portUnk3} type=${portType} (${portType === 0 ? 'event?' : portType === 2 ? 'audio_in?' : portType === 3 ? 'audio_out?' : '?'})`;
      }
      break;
    }
    case 0x1389: { // NODE_END
      decoded = `  (end of ${currentNodeName})`;
      break;
    }
    case 0x0578: { // IO_HEADER
      if (dataLen >= 16) {
        const fields: number[] = [];
        for (let fi = 0; fi < Math.min(dataLen, 28); fi += 4) fields.push(data.readUInt32LE(fi));
        decoded = `  fields: [${fields.map(f => '0x' + f.toString(16)).join(', ')}]`;
      }
      console.log(`\n  === I/O NODE ===`);
      break;
    }
    case 0x057A: { // IO_NAME
      decoded = `  → "${smartDecode(data)}"`;
      break;
    }
    case 0x0579: { // IO_END
      break;
    }
    case 0x0514: { // CONNECTION
      if (dataLen >= 20) {
        const fields: number[] = [];
        for (let fi = 0; fi < Math.min(dataLen, 32); fi += 4) fields.push(data.readUInt32LE(fi));
        const srcId = fields[0];
        const dstPort = fields[2];
        const srcPort = fields[1];
        decoded = `  src_port=0x${srcPort?.toString(16)} (${srcPort}) → dst_port=0x${dstPort?.toString(16)} (${dstPort})`;
        decoded += `\n      raw_fields: [${fields.map(f => '0x' + f.toString(16)).join(', ')}]`;

        // Decode the float in the connection
        for (let fi = 0; fi < Math.min(dataLen, 32); fi += 4) {
          const fv = buf.readFloatLE(dataStart + fi);
          if (fv > 0.001 && fv < 1000) {
            decoded += `\n      float@${fi}: ${fv.toFixed(4)}`;
          }
        }
      }
      break;
    }
    case 0x0515: { // CONNECTION_END
      break;
    }
    case 0x05DC: { // NODE_POS
      if (dataLen >= 8) {
        const fields: string[] = [];
        for (let fi = 0; fi < Math.min(dataLen, 40); fi += 4) {
          const fv = data.readFloatLE(fi);
          const iv = data.readUInt32LE(fi);
          fields.push(`${iv}(${fv.toFixed(2)})`);
        }
        decoded = `  → [${fields.join(', ')}]`;
      }
      console.log(`\n  === POSITION DATA ===`);
      break;
    }
    case 0x0640: { // NODE_POS_DATA
      if (dataLen >= 12) {
        const nodeId = data.readUInt32LE(0);
        const x = data.readFloatLE(8);
        const y = data.readFloatLE(12);
        decoded = `  node_id=0x${nodeId.toString(16)} (${nodeId}), x=${x.toFixed(1)}, y=${y.toFixed(1)}`;
        if (dataLen >= 20) {
          const all: string[] = [];
          for (let fi = 0; fi < Math.min(dataLen, 24); fi += 4) {
            const fv = data.readFloatLE(fi);
            const iv = data.readUInt32LE(fi);
            all.push(`${iv}/f${fv.toFixed(2)}`);
          }
          decoded += `\n      raw: [${all.join(', ')}]`;
        }
      }
      break;
    }
  }

  console.log(`  [${recNum}] @0x${p.toString(16).padStart(4, '0')}: type=0x${type.toString(16)} (${name}), len=${dataLen}, rsv=${reserved}${decoded}`);

  p = dataEnd;
  recNum++;

  if (recNum > 300) {
    console.log('  ... too many records');
    break;
  }
}

console.log(`\nWalk complete: ${recNum} records, ${nodeCount} nodes, ended at 0x${p.toString(16)} (${p}/${len})`);

