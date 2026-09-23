import fs from 'node:fs';
const depth = (l: string) => l.length - l.trimStart().length;
const tally = new Map<string, number>();
for (const f of process.argv.slice(2)) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const owner = new Map<string, string>();
  // the enclosing element one level up from a line
  const parentOf = (i: number) => { const d = depth(lines[i]); let j = i - 1; while (j > 0 && !(depth(lines[j]) < d && /^\s*<[A-Za-z]/.test(lines[j]))) j--; return j; };
  lines.forEach((l, i) => {
    const m = l.match(/<(AutomationTarget|ModulationTarget) Id="(\d+)">/); if (!m) return;
    const p = parentOf(i); const param = (lines[p].match(/<([A-Za-z0-9_.]+)/) ?? [])[1];
    let q = p, dev = ''; for (let n = 0; n < 12 && q > 0; n++) { q = parentOf(q); const t = (lines[q].match(/<([A-Za-z0-9_.]+)/) ?? [])[1] ?? ''; if (/Device$|^(Eq8|Compressor2|Reverb|Delay|AutoFilter|OriginalSimpler|MultiSampler|StereoGain|Saturator|Mixer|MixerDevice|PluginDevice|DrumGroupDevice|InstrumentGroupDevice|AudioEffectGroupDevice|GlueCompressor|Echo|Chorus2|AutoPan2?|Limiter|Overdrive|Redux2|Operator|UltraAnalog|InstrumentVector|Drift|Gate|Erosion|Roar)$/.test(t)) { dev = t; break; } }
    owner.set(m[2], `${m[1] === 'ModulationTarget' ? '(mod) ' : ''}${dev}.${param}`);
  });
  let inEnv = false;
  for (const l of lines) { if (l.includes('<ClipEnvelope Id')) inEnv = true; const m = inEnv && l.match(/<PointeeId Value="(\d+)"/); if (m) { const k = owner.get(m[1]) ?? '?'; tally.set(k, (tally.get(k) ?? 0) + 1); inEnv = false; } }
}
[...tally].sort((a, b) => b[1] - a[1]).filter(([k]) => /Mixer|StereoGain|SampleVolume|Volume|Pan/.test(k)).forEach(([k, n]) => console.log(String(n).padStart(5), k));
