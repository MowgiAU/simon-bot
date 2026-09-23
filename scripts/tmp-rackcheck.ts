import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const r = convertAlsToFlp(fs.readFileSync(process.argv[2]), { projectName: 'x' });
for (const c of r.report.converted) if (/parallel|Parallel/.test(c)) console.log('•', c);
for (const w of r.report.warnings) if (/rack|Rack/i.test(w)) console.log('!', w);
