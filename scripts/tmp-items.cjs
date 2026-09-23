const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f); const ds = 8 + buf.readUInt32LE(4); let p = ds + 8; const end = p + buf.readUInt32LE(ds + 4);
  let pl = null; let ver = '';
  while (p < end) { const id = buf[p++]; let v;
    if (id < 64) v = buf[p++]; else if (id < 128) { v = buf.readUInt16LE(p); p += 2 } else if (id < 192) { v = buf.readUInt32LE(p); p += 4 }
    else { let l = 0, s = 0, b; do { b = buf[p++]; l |= (b & 127) << s; s += 7 } while (b & 128); v = buf.subarray(p, p + l); p += l }
    if (id === 199) ver = v.toString('utf16le').replace(/\0+$/, ''); if (id === 233 && !pl) pl = v; }
  const size = [80, 64, 60].find((s) => pl.length % s === 0 && pl.readUInt16LE(4) === 0x5000 && (pl.length / s < 2 || pl.readUInt16LE(s + 4) === 0x5000));
  const rows = new Map();
  for (let o = 0; o + size <= pl.length; o += size) {
    if (pl.readUInt16LE(o + 6) >= 0x5000) continue;                 // audio/automation items only
    const tail = pl.subarray(o + 32, o + size);
    const key = tail.toString('hex').replace(/^.{8}/, '********');   // mask the running id
    rows.set(key, (rows.get(key) || 0) + 1);
  }
  console.log(`== ${f.split('/').pop().slice(0, 34)} item ${size}B, distinct audio-item tails (bytes 32..):`);
  for (const [k, n] of [...rows].slice(0, 5)) {
    const b = Buffer.from(k.replace(/\*/g, '0'), 'hex');
    const fl = []; for (let i = 4; i + 4 <= b.length; i += 4) fl.push(b.readFloatLE(i).toPrecision(3));
    console.log(`  x${n} ${k.replace(/(.{8})/g, '$1 ')}\n      f32s@36: ${fl.join(' ')}`);
  }
}
