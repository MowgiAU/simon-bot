import fs from 'node:fs';
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';
import { readAls } from '../src/services/projectConvert/AlsReader.js';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';
for (const f of process.argv.slice(2)) {
    const als = /\.zip$/i.test(f)
        ? new AdmZip(f).getEntries().find((x) => /\.als$/i.test(x.entryName) && !/backup/i.test(x.entryName))!.getData()
        : fs.readFileSync(f);
    const p = readAls(als, 'x');
    console.log(`\n== ${f.split(/[\/]/).pop()}`);
    for (const t of p.tracks) {
        if (!t.midi) continue;
        const notes = t.clips.filter((c) => c.kind === 'midi').reduce((n, c: any) => n + c.notes.length, 0);
        console.log(`  ${t.name}: ${t.midi.zones.length} zones, transpose ${t.midi.transpose}, ${notes} notes in clips`);
        for (const z of t.midi.zones.slice(0, 4)) console.log(`     ${z.name}: keys ${z.keyMin}-${z.keyMax} vel ${z.velMin}-${z.velMax} +${z.transpose}`);
    }
    const r = convertAlsToFlp(als, { projectName: 'x' });
    console.log('  notes after shaping:', r.report.stats.notes);
    for (const c of r.report.converted) if (/MIDI devices/.test(c)) console.log('  •', c);
}
