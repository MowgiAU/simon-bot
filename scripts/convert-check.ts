/**
 * Regression check for the project converter.
 *
 * Converts a set of reference projects and compares the result against a stored snapshot: the
 * counts, what converted, what warned, and a hash of the .flp itself. A change in any of those
 * shows up as a diff, so a quiet degradation (an effect that stops loading, notes that vanish)
 * can't pass unnoticed the way the slot-index bug did.
 *
 *   npx tsx scripts/convert-check.ts            compare against the snapshots, exit 1 on a change
 *   npx tsx scripts/convert-check.ts --update   accept what it produces now as the snapshots
 *
 * The reference projects are listed in scripts/convert-projects.json (paths on this machine, since
 * the projects themselves are far too big to keep in the repository).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { convertAlsToFlp } from '../src/services/projectConvert/AbletonToFl.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const LIST = path.join(ROOT, 'scripts', 'convert-projects.json');
const SNAPSHOTS = path.join(ROOT, 'scripts', 'convert-snapshots');

interface Snapshot {
    stats: Record<string, number>;
    flpBytes: number;
    flpHash: string;
    converted: string[];
    warnings: string[];
    plugins: string[];
    libraries: string[];
}

function alsFrom(file: string): Buffer {
    if (!/\.zip$/i.test(file)) return fs.readFileSync(file);
    const entry = new AdmZip(file).getEntries()
        .find((e) => /\.als$/i.test(e.entryName) && !/backup\//i.test(e.entryName) && !e.entryName.startsWith('__MACOSX'));
    if (!entry) throw new Error('no .als inside the zip');
    return entry.getData();
}

function snapshot(file: string): Snapshot {
    const result = convertAlsToFlp(alsFrom(file), { projectName: path.basename(file).replace(/\.(als|zip)$/i, '') });
    const r = result.report;
    return {
        stats: r.stats as unknown as Record<string, number>,
        flpBytes: result.flp.length,
        flpHash: crypto.createHash('sha1').update(result.flp).digest('hex'),
        converted: r.converted,
        warnings: r.warnings,
        plugins: r.plugins,
        libraries: r.libraries.map((l) => `${l.plugin} on "${l.track}" → ${l.library ?? 'unknown'}`),
    };
}

/** Lines that differ between two snapshots, in a form that reads like a diff. */
function differences(before: Snapshot, after: Snapshot): string[] {
    const out: string[] = [];
    for (const [key, value] of Object.entries(after.stats)) {
        const was = before.stats[key];
        if (was !== value) out.push(`  ${key}: ${was} → ${value}`);
    }
    if (before.flpHash !== after.flpHash) out.push(`  .flp changed (${before.flpBytes} → ${after.flpBytes} bytes)`);
    for (const field of ['converted', 'warnings', 'plugins', 'libraries'] as const) {
        const gone = before[field].filter((l) => !after[field].includes(l));
        const added = after[field].filter((l) => !before[field].includes(l));
        for (const l of gone) out.push(`  - ${field}: ${l}`);
        for (const l of added) out.push(`  + ${field}: ${l}`);
    }
    return out;
}

function main() {
    const update = process.argv.includes('--update');
    if (!fs.existsSync(LIST)) {
        console.error(`No project list at ${LIST} — create it as ["C:/path/to/Project.als", …]`);
        process.exit(1);
    }
    const files: string[] = JSON.parse(fs.readFileSync(LIST, 'utf8'));
    fs.mkdirSync(SNAPSHOTS, { recursive: true });

    let changed = 0, missing = 0;
    for (const file of files) {
        const name = path.basename(file).replace(/\.(als|zip)$/i, '');
        if (!fs.existsSync(file)) { console.log(`? ${name}: not on this machine (${file})`); missing++; continue; }

        let now: Snapshot;
        try {
            now = snapshot(file);
        } catch (e: any) {
            console.log(`✗ ${name}: conversion threw — ${e?.message}`);
            changed++;
            continue;
        }

        const snapFile = path.join(SNAPSHOTS, `${name.replace(/[^A-Za-z0-9._-]+/g, '_')}.json`);
        if (update || !fs.existsSync(snapFile)) {
            fs.writeFileSync(snapFile, JSON.stringify(now, null, 2));
            console.log(`${update ? '↻' : '+'} ${name}: snapshot written (${now.stats.tracks} tracks, ${now.stats.notes} notes)`);
            continue;
        }
        const diff = differences(JSON.parse(fs.readFileSync(snapFile, 'utf8')), now);
        if (!diff.length) { console.log(`✓ ${name}`); continue; }
        console.log(`✗ ${name}`);
        for (const line of diff) console.log(line);
        changed++;
    }

    console.log(`\n${files.length - missing} checked, ${changed} changed${missing ? `, ${missing} not on this machine` : ''}`);
    if (changed && !update) {
        console.log('If the changes are what you intended, re-run with --update to accept them.');
        process.exit(1);
    }
}

main();
