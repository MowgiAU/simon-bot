import fs from 'node:fs';
import path from 'node:path';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
import { trimAudio } from '../src/services/projectConvert/SampleTrim.js';
const [als, outDir] = process.argv.slice(2);
const name = path.basename(als, '.als');
const r = convertAlsToFlp(fs.readFileSync(als), { projectName: name });
fs.mkdirSync(path.join(outDir, 'Samples'), { recursive: true });
fs.writeFileSync(path.join(outDir, `${name}.flp`), r.flp);
let copied = 0, missing = 0;
for (const s of r.samples) {
  const src = [s.sourcePath, path.join(path.dirname(als), s.sourceRelPath), path.join('C:/ProgramData/Ableton/Live 12 Suite/Resources/Core Library', s.sourceRelPath)].find((p) => p && fs.existsSync(p));
  if (src) { let d = fs.readFileSync(src); if (s.trim) d = trimAudio(d, s.trim.start, s.trim.end) ?? d; fs.writeFileSync(path.join(outDir, s.outputPath), d); copied++; } else missing++;
}
const rep = ['CONVERTED', ...r.report.converted.map((l) => '  + ' + l), 'WARNINGS', ...r.report.warnings.map((l) => '  ! ' + l)].join('\n');
fs.writeFileSync(path.join(outDir, 'Conversion report.txt'), rep);
console.log(`samples copied ${copied}, missing ${missing}\n` + rep);
