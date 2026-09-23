import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const r = convertAlsToFlp(fs.readFileSync(process.argv[2]), { projectName: 'test' });
for (const c of r.report.converted) if (/continuing on|Long effect chains/.test(c)) console.log('•', c);
for (const w of r.report.warnings) if (/left off|mixer is full/.test(w)) console.log('!', w);
