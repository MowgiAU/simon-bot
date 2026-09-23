import fs from 'node:fs';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
import AdmZip from 'adm-zip';
const zip = new AdmZip(process.argv[2]);
const als = zip.getEntries().find((e) => /\.als$/i.test(e.entryName))!.getData();
const r = convertAlsToFlp(als, { projectName: 'st' });
console.log('CONVERTED:'); for (const c of r.report.converted) console.log('  •', c);
console.log('WARNINGS:'); for (const w of r.report.warnings) console.log('  !', w);
