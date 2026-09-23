import fs from 'node:fs';
import crypto from 'node:crypto';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
const live = readAls(fs.readFileSync(process.argv[2]), 'x');
const want = new Map<string, string>();
for (const t of live.tracks) { const i: any = t.instrument; if (i?.kind === 'plugin' && /kontakt/i.test(i.plugin.name)) want.set(t.name, crypto.createHash('sha1').update(i.plugin.processorState).digest('hex').slice(0, 12)); }
// what the .flp holds
const b = fs.readFileSync(process.argv[3]); const ds = 8 + b.readUInt32LE(4); let p = ds + 8; const end = p + b.readUInt32LE(ds + 4);
let internal = '', name = ''; const got: string[] = [];
while (p < end) { const c = b[p++]; if (c < 64) p++; else if (c < 128) p += 2; else if (c < 192) p += 4; else {
  let len = 0, sh = 0, x; do { x = b[p++]; len |= (x & 0x7f) << sh; sh += 7; } while (x & 0x80);
  const d = b.subarray(p, p + len);
  if (c === 201) internal = d.toString('utf16le').replace(/\0+$/, '');
  if (c === 203) name = d.toString('utf16le').replace(/\0+$/, '');
  if (c === 213 && /Wrapper/i.test(internal) ) {
    let q = 4;
    while (q + 12 <= d.length) { const id = d.readUInt32LE(q); const l = Number(d.readBigUInt64LE(q + 4));
      if (id === 53) { const s = d.subarray(q + 12, q + 12 + l); let r = 80;
        while (r + 12 <= s.length) { const cid = s.readUInt32LE(r); const cl = Number(s.readBigUInt64LE(r + 4));
          if (cid === 3) got.push(`${name}: ${crypto.createHash('sha1').update(s.subarray(r + 12, r + 12 + cl)).digest('hex').slice(0, 12)} (${cl} bytes)`);
          r += 12 + cl; } }
      q += 12 + l; } }
  p += len; } }
console.log('Live:'); [...want].forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log('FLP:'); got.forEach((g) => console.log(`  ${g}`));
