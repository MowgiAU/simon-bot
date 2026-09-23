import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const r = convertAlsToFlp(fs.readFileSync(process.argv[2]), {});
for (const s of r.samples.slice(0, 5)) console.log(JSON.stringify({ src: s.sourcePath, rel: s.sourceRelPath }));
