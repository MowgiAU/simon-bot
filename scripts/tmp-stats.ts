import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const r = convertAlsToFlp(fs.readFileSync(process.argv[2]), {});
console.log(JSON.stringify(r.report.stats), 'channels', (r as any).project ? '' : '');
