import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const als = fs.readFileSync(process.argv[2]);
const a = convertAlsToFlp(als, { projectName: 'x' }).report.libraries;
const b = convertAlsToFlp(als, { projectName: 'x', fingerprints: { [a[2].fingerprint]: 'Test Library' } }).report.libraries;
for (const [i, l] of a.entries()) console.log(`${l.track.padEnd(14)} ${l.fingerprint}  run2: ${b[i].fingerprint === l.fingerprint ? 'same' : 'DIFFERENT'}  named: ${b[i].library ?? '-'}`);
