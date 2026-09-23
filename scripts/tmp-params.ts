import fs from 'node:fs';
const x = fs.readFileSync(process.argv[2], 'utf8');
// Each plugin device: its name, then its ParameterList entries in order
for (const m of x.matchAll(/<Vst3PluginInfo[\s\S]*?<Name Value="([^"]*)"[\s\S]*?<ParameterList>([\s\S]*?)<\/ParameterList>/g)) {
  const list = [...m[2].matchAll(/<PluginFloatParameter Id="(\d+)">\s*<ParameterName Value="([^"]*)" \/>\s*<ParameterId Value="(-?\d+)"/g)];
  console.log(`${m[1]}: ${list.length} params`);
  console.log('   first:', list.slice(0, 6).map((p) => `${p[1]}[id ${p[3]}]`).join(', '));
  const ids = list.map((p) => Number(p[3]));
  console.log('   ids -1:', ids.filter((i) => i === -1).length, '| distinct ids:', new Set(ids).size);
}
