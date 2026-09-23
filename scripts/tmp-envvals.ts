import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const x = fs.readFileSync(f, 'utf8');
  const ids = new Map<string, string>();
  for (const m of x.matchAll(/<(Volume|Pan|Send)>[\s\S]*?<(AutomationTarget|ModulationTarget) Id="(\d+)">[\s\S]*?<\/\1>/g)) {
    const block = m[0];
    for (const t of block.matchAll(/<(AutomationTarget|ModulationTarget) Id="(\d+)">/g)) ids.set(t[2], `${m[1]} ${t[1] === 'ModulationTarget' ? 'mod' : 'abs'}`);
  }
  for (const m of x.matchAll(/<ClipEnvelope Id="\d+">[\s\S]*?<PointeeId Value="(\d+)"[\s\S]*?<Events>([\s\S]*?)<\/Events>/g)) {
    const k = ids.get(m[1]); if (!k) continue;
    const vals = [...m[2].matchAll(/Time="([^"]+)" Value="([^"]+)"/g)].map((v) => `${(+v[1]).toFixed(2)}:${(+v[2]).toFixed(3)}`);
    console.log(k.padEnd(12), vals.slice(0, 8).join(' '));
  }
}
