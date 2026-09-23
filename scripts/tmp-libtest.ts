import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
const libraries = [
    { name: 'UmanskyBass', aliases: ['Umansky Bass', 'Umansky'] },
    { name: 'Appex - Modern Trailer Guitar', aliases: ['Appex', 'Modern Trailer Guitar'] },
    { name: 'Shreddage 3', aliases: ['Shreddage'] },
];
const r = convertAlsToFlp(fs.readFileSync(process.argv[2]), { projectName: 'test', sampleFolder: 'Samples', libraries });
for (const l of r.report.libraries) console.log(`${l.plugin} on "${l.track}" -> ${l.library ?? '(unknown)'}`);
