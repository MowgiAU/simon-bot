const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f); const ds = 8 + buf.readUInt32LE(4); let p = ds + 8; const end = p + buf.readUInt32LE(ds + 4);
  let pl = null, bpm = 0, ppq = buf.readUInt16LE(12);
  while (p < end) { const id = buf[p++]; let v;
    if (id < 64) v = buf[p++]; else if (id < 128) { v = buf.readUInt16LE(p); p += 2 } else if (id < 192) { v = buf.readUInt32LE(p); p += 4 }
    else { let l = 0, s = 0, b; do { b = buf[p++]; l |= (b & 127) << s; s += 7 } while (b & 128); v = buf.subarray(p, p + l); p += l }
    if (id === 156) bpm = v / 1000; if (id === 233 && !pl) pl = v; }
  console.log(`== ${f.split('/').pop().slice(0, 30)} bpm ${bpm} ppq ${ppq}`);
  for (let o = 0; o + 80 <= pl.length; o += 80) {
    if (pl.readUInt16LE(o + 6) >= 0x5000) continue;
    const vals = [36, 40, 44, 48].map((k) => pl.readFloatLE(o + k)); const gain = pl.readFloatLE(o + 52), flags = pl.readUInt32LE(o + 56);
    if (vals.every((x) => x === 0) && gain === 1 && !flags) continue;
    const len = pl.readUInt32LE(o + 8), s = pl.readFloatLE(o + 24), e = pl.readFloatLE(o + 28);
    console.log(`  len ${len} ticks (${(len / ppq).toFixed(2)} beats, ${(len / ppq * 60000 / bpm).toFixed(0)} ms) offs ${s.toFixed(0)}..${e.toFixed(0)}ms | @36 ${vals[0].toFixed(3)} @40 ${vals[1].toFixed(3)} @44 ${vals[2].toFixed(3)} @48 ${vals[3].toFixed(3)} gain ${gain.toFixed(3)} flags ${flags}`);
  }
}
