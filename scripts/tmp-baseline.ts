import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { convertAbletonUpload } from '../src/services/projectConvert/ConvertService.js';
const [projDir, work] = process.argv.slice(2);
// Zip the project folder the way a user would upload it
const z = new AdmZip();
z.addLocalFolder(projDir, path.basename(projDir), (p) => !/\.asd$/i.test(p) && !/Backup/i.test(p));
fs.mkdirSync(work, { recursive: true });
z.writeZip(path.join(work, 'upload.zip'));
const meta = convertAbletonUpload(path.join(work, 'upload.zip'), 'Converter Test Project.zip', 'me', path.join(work, 'out'));
new AdmZip(path.join(work, 'out', `${meta.id}.zip`)).extractAllTo(path.join(work, 'result'), true);
console.log('stats', JSON.stringify(meta.report.stats), '| samples included', meta.samplesIncluded, '| missing', meta.missingSamples.length, meta.missingSamples.join(', '));
console.log('CONVERTED'); meta.report.converted.forEach((c) => console.log('  +', c));
console.log('WARNINGS'); meta.report.warnings.forEach((w) => console.log('  !', w));
