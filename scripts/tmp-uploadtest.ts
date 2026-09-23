import fs from 'node:fs';
import { convertAbletonUpload } from '../src/services/projectConvert/ConvertService.js';
const [zip, out] = process.argv.slice(2);
const meta = convertAbletonUpload(zip, zip.split(/[\/]/).pop()!, 'testuser', out);
console.log('plugins:', JSON.stringify(meta.report.plugins));
console.log('projectName:', meta.projectName, '| download:', meta.downloadName, '| samples', meta.samplesIncluded + '/' + meta.report.stats.samples, '| missing', meta.missingSamples.length);
