const fs = require('fs');
for (const f of process.argv.slice(2)) {
  let buf; try { buf = fs.readFileSync(f); } catch { continue; }
  const ds = 8 + buf.readUInt32LE(4); let p = ds + 8; const end = p + buf.readUInt32LE(ds + 4);
  let ver = '', inArr = false; const ids = {}; let itemLen = 0, items = 0;
  while (p < end) { const id = buf[p++]; let v;
    if (id < 64) v = buf[p++]; else if (id < 128) { v = buf.readUInt16LE(p); p += 2 } else if (id < 192) { v = buf.readUInt32LE(p); p += 4 }
    else { let l = 0, s = 0, b; do { b = buf[p++]; l |= (b & 127) << s; s += 7 } while (b & 128); v = buf.subarray(p, p + l); p += l }
    if (id === 199) ver = v.toString('utf16le').replace(/\0+$/, '');
    if (id === 233) { inArr = true; itemLen = v.length; continue; }
    if (id === 238) inArr = false;
    if (inArr) ids[id] = (ids[id] || 0) + 1;
  }
  console.log(f.split('/').pop().slice(0, 30).padEnd(30), 'v' + ver.slice(0, 8).padEnd(9), 'playlist', itemLen + 'B', '| between playlist & tracks:', JSON.stringify(ids));
}
