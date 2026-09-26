/**
 * ConvertService — turns an uploaded Ableton project into a downloadable FL Studio bundle.
 *
 * Input:  a zipped Live project folder (ideally saved with File → Collect All and Save),
 *         or a bare .als (converted without samples).
 * Output: <outDir>/<id>.zip containing
 *           <Project>/<Project>.flp
 *           <Project>/Samples/…              every referenced sample found in the upload
 *           <Project>/Conversion report.txt
 *         plus <outDir>/<id>.json with the owner and report, used by the download route.
 *
 * Output files are temporary: sweepConversions() deletes anything older than RETENTION_MS.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { convertAlsToFlp } from './AbletonToFl.js';
import { trimAudio } from './SampleTrim.js';
import type { LibraryEntry } from './AbletonToFl.js';
import type { ConversionReport } from './types.js';
import { FLPParser } from '../../bot/utils/FLPParser.js';

export const RETENTION_MS = 60 * 60 * 1000;

export interface ConversionMeta {
    id: string;
    userId: string;
    projectName: string;
    downloadName: string;
    createdAt: number;
    report: ConversionReport;
    samplesIncluded: number;
    missingSamples: string[];
    /** Whether <id>.arrangement.json exists — the converted FLP read back for the viewer. */
    hasArrangement?: boolean;
}

function safeName(s: string): string {
    return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim().slice(0, 100) || 'Converted Project';
}

// Zips made by Windows Explorer store paths with backslashes, so every entry name is normalised
const slashes = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '');
const norm = (p: string) => slashes(p).toLowerCase();

/** The project's .als: skip Live's Backup folder and macOS resource forks; prefer the shallowest. */
function pickAls(entries: AdmZip.IZipEntry[]): AdmZip.IZipEntry | null {
    const candidates = entries.filter((e) => {
        const n = norm(e.entryName);
        return !e.isDirectory && n.endsWith('.als') && !n.includes('/backup/') && !n.startsWith('__macosx/')
            && !path.posix.basename(n).startsWith('._');
    });
    candidates.sort((a, b) => slashes(a.entryName).split('/').length - slashes(b.entryName).split('/').length || b.header.size - a.header.size);
    return candidates[0] ?? null;
}

/** Breaks a paragraph into lines of at most `width` characters, for the plain-text report. */
function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        if (line && line.length + 1 + word.length > width) { lines.push(line); line = word; }
        else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
}

function reportText(meta: Omit<ConversionMeta, 'id' | 'userId' | 'createdAt' | 'downloadName'>): string {
    const r = meta.report;
    const lines = [
        `Fuji Studio project converter — ${meta.projectName}`,
        `${r.source} → ${r.target}`,
        '',
        `Tracks: ${r.stats.tracks}   MIDI clips: ${r.stats.midiClips}   Audio clips: ${r.stats.audioClips}   Notes: ${r.stats.notes}`,
        `Samples: ${meta.samplesIncluded} of ${r.stats.samples} included`,
        '',
        'Open the .flp from inside this folder so FL Studio finds the Samples folder next to it.',
        '',
        'Converted with Fuji Studio — https://fujistud.io',
    ];
    if (r.converted.length) lines.push('', 'Converted instruments', ...r.converted.map((c) => `  • ${c}`));
    if (r.libraries.length) {
        lines.push('', 'Sample libraries these tracks need',
            'The player opens with its preset, but its sounds live in a library installed on your',
            'machine — without it you get a "content missing" message, in FL and in Live alike.',
            ...r.libraries.map((l) => `  • ${l.plugin} on "${l.track}" — ${l.library ? `library: ${l.library}` : 'library unknown (the player keeps that inside its own saved data)'}`),
            'Install or register the library (Kontakt: Native Access, or Libraries → Add Library and',
            'point it at the library folder), then open the project again.');
    }
    if (meta.missingSamples.length) {
        lines.push('', 'Samples not found in your upload (re-save in Live with File → Collect All and Save,',
            'with every "Collect files from" option ticked, then convert again):', ...meta.missingSamples.map((s) => `  • ${s}`));
    }
    if (r.warnings.length) lines.push('', 'Things to check in FL Studio', ...r.warnings.map((w) => `  • ${w}`));
    if (r.deviceNotes.length) {
        lines.push('', 'Why some devices couldn\'t come across');
        for (const n of r.deviceNotes) lines.push(`  • ${n.device}`, ...wrap(n.why, 86).map((l) => `      ${l}`));
    }
    return lines.join('\r\n') + '\r\n';
}

export function convertAbletonUpload(
    inputPath: string,
    originalName: string,
    userId: string,
    outDir: string,
    libraries: LibraryEntry[] = [],
    fingerprints: Record<string, string> = {},
): ConversionMeta {
    let alsBuffer: Buffer;
    let alsName: string;
    let zip: AdmZip | null = null;
    let alsDir = '';

    if (/\.als$/i.test(originalName)) {
        alsBuffer = fs.readFileSync(inputPath);
        alsName = originalName;
    } else {
        try {
            zip = new AdmZip(inputPath);
        } catch {
            throw new Error('That file isn’t a valid zip archive.');
        }
        const als = pickAls(zip.getEntries());
        if (!als) throw new Error('No Ableton Live Set (.als) was found in the zip.');
        alsBuffer = als.getData();
        alsName = path.posix.basename(slashes(als.entryName));
        alsDir = path.posix.dirname(norm(als.entryName));
        if (alsDir === '.') alsDir = '';
    }

    const projectName = safeName(alsName.replace(/\.als$/i, ''));
    const result = convertAlsToFlp(alsBuffer, { projectName, sampleFolder: 'Samples', libraries, fingerprints });

    // Match every referenced sample against the upload
    const out = new AdmZip();
    const root = `${projectName}/`;
    out.addFile(`${root}${projectName}.flp`, result.flp);

    const byPath = new Map<string, AdmZip.IZipEntry>();
    const byName = new Map<string, AdmZip.IZipEntry[]>();
    for (const e of zip?.getEntries() ?? []) {
        if (e.isDirectory || norm(e.entryName).startsWith('__macosx/')) continue;
        const n = norm(e.entryName);
        byPath.set(n, e);
        const base = path.posix.basename(n);
        byName.set(base, [...(byName.get(base) ?? []), e]);
    }

    const missingSamples: string[] = [];
    let samplesIncluded = 0;
    for (const s of result.samples) {
        const rel = norm(s.sourceRelPath);
        let entry = rel ? byPath.get(alsDir ? `${alsDir}/${rel}` : rel) : undefined;
        if (!entry && rel) entry = [...byPath.entries()].find(([p]) => p.endsWith(`/${rel}`))?.[1];
        if (!entry) {
            const same = byName.get(norm(path.posix.basename(s.sourcePath || s.sourceRelPath))) ?? [];
            if (same.length === 1) entry = same[0];
        }
        if (entry) {
            // Samples Live only played part of are shipped cut down to that part
            let data = entry.getData();
            if (s.trim) {
                const trimmed = trimAudio(data, s.trim.start, s.trim.end);
                if (trimmed) data = trimmed;
                else result.report.warnings.push(`"${s.fileName}" couldn't be trimmed (its audio format isn't supported) — it's included whole; set its start/end in FL's Sampler.`);
            }
            out.addFile(`${root}${s.outputPath}`, data);
            samplesIncluded++;
        } else {
            missingSamples.push(s.fileName);
        }
    }

    const meta = { projectName, report: result.report, samplesIncluded, missingSamples };
    out.addFile(`${root}Conversion report.txt`, Buffer.from(reportText(meta), 'utf8'));

    const id = crypto.randomUUID();
    fs.mkdirSync(outDir, { recursive: true });
    out.writeZip(path.join(outDir, `${id}.zip`));

    // Read the FLP we just wrote back through the same parser track pages use, so the
    // result page can show the converted arrangement. Kept in its own file: it carries
    // every note, and the meta json is read on every download and save.
    let hasArrangement = false;
    try {
        const arrangement = FLPParser.parse(result.flp);
        if (arrangement) {
            fs.writeFileSync(path.join(outDir, `${id}.arrangement.json`), JSON.stringify(arrangement));
            hasArrangement = true;
        }
    } catch { /* the download is what matters — a preview failure must not fail the conversion */ }

    const full: ConversionMeta = {
        ...meta,
        id,
        userId,
        downloadName: `${projectName} (FL Studio).zip`,
        createdAt: Date.now(),
        hasArrangement,
    };
    fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(full));
    return full;
}

export function readConversion(outDir: string, id: string): ConversionMeta | null {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
        const meta = JSON.parse(fs.readFileSync(path.join(outDir, `${id}.json`), 'utf8')) as ConversionMeta;
        return Date.now() - meta.createdAt < RETENTION_MS ? meta : null;
    } catch {
        return null;
    }
}

/** The parsed arrangement for a conversion, or null if it wasn't produced or has expired. */
export function readConversionArrangement(outDir: string, id: string): object | null {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
        return JSON.parse(fs.readFileSync(path.join(outDir, `${id}.arrangement.json`), 'utf8'));
    } catch {
        return null;
    }
}

/** Deletes finished conversions older than RETENTION_MS. */
export function sweepConversions(outDir: string): void {
    let files: string[];
    try { files = fs.readdirSync(outDir); } catch { return; }
    const cutoff = Date.now() - RETENTION_MS;
    for (const f of files) {
        const p = path.join(outDir, f);
        try {
            if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true });
        } catch { /* already gone */ }
    }
}
