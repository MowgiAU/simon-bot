import fs from 'node:fs';
const x = fs.readFileSync(process.argv[2], 'utf8');
for (const m of x.matchAll(/<Vst3PluginInfo[\s\S]*?<Name Value="([^"]*)"[\s\S]*?<ParameterList>([\s\S]*?)<\/ParameterList>/g)) {
  const named = [...m[2].matchAll(/<PluginFloatParameter Id="(\d+)">\s*<ParameterName Value="([^"]*)" \/>\s*<ParameterId Value="(-?\d+)"/g)].filter((p) => Number(p[3]) >= 0);
  if (named.length) console.log(`${m[1] || '(unnamed)'}: ` + named.map((p) => `${p[2]}=id ${p[3]}`).join(', '));
}
