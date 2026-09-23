/**
 * Fetches a promo image for every registry plugin that has none, from the product page already
 * stored on the entry (its Open Graph / Twitter card image — the picture the vendor publishes for
 * link previews). Saves them locally plus a manifest for scripts/import-plugin-images.ts.
 *
 *   npx tsx scripts/tmp-fetch-plugin-images.ts <outDir> [registryUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
// Some vendor sites refuse anything that doesn't look like a browser
const BROWSER_HEADERS: Record<string, string> = {
    'user-agent': UA,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-GB,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'upgrade-insecure-requests': '1',
};
const outDir = process.argv[2] ?? 'plugin-images';
const registryUrl = process.argv[3] ?? 'https://fujistud.io/api/plugins/registry';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function page(url: string): Promise<string | null> {
    try {
        const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(25000) });
        if (r.ok) return await r.text();
    } catch { /* fall through to curl */ }
    // Some sites turn away Node's fetch but not curl
    try {
        return execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA, url], { maxBuffer: 32 * 1024 * 1024 }).toString('utf8') || null;
    } catch { return null; }
}

const JUNK = /logo|icon|sprite|avatar|flag|badge|banner|placeholder|spacer|favicon|cart|star|arrow|social|facebook|twitter|instagram|youtube/i;

/** Candidate images on the page, best first: Open Graph, Twitter card, then likely product shots. */
function findImages(html: string, base: string, name: string): string[] {
    const out: string[] = [];
    const add = (raw?: string) => {
        if (!raw) return;
        try { const u = new URL(raw.trim().split(/\s+/)[0], base).href; if (!out.includes(u)) out.push(u); } catch { /* skip */ }
    };
    for (const re of [
        /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image[^"']*["'][^>]+content=["']([^"']+)["']/i,
    ]) add(re.exec(html)?.[1]);

    // Product shots in the page itself: prefer ones named after the plugin, then the rest in order
    const slugged = slug(name).replace(/-/g, '');
    const imgs: { url: string; score: number }[] = [];
    for (const m of html.matchAll(/<img[^>]+>/gi)) {
        const tag = m[0];
        const src = /(?:data-src|data-lazy-src|srcset|src)=["']([^"']+)["']/i.exec(tag)?.[1];
        if (!src || JUNK.test(src) || /^data:/i.test(src)) continue;
        if (!/\.(png|jpe?g|webp)(\?|$)/i.test(src.split(/\s+/)[0])) continue;
        const file = src.toLowerCase().replace(/[^a-z0-9]/g, '');
        const width = Number(/width=["'](\d+)["']/i.exec(tag)?.[1] ?? 0);
        imgs.push({ url: src, score: (file.includes(slugged) ? 1000 : 0) + (/product|screenshot|plugin|gui|hero/i.test(src) ? 200 : 0) + width });
    }
    imgs.sort((a, b) => b.score - a.score).slice(0, 6).forEach((i) => add(i.url));
    return out;
}

async function download(url: string, file: string, referer: string): Promise<{ ok: boolean; note: string }> {
    try {
        let type = '';
        let buf: Buffer;
        try {
            const r = await fetch(url, { headers: { ...BROWSER_HEADERS, accept: 'image/avif,image/webp,image/*,*/*;q=0.8', referer, 'sec-fetch-dest': 'image', 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'same-origin' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            type = r.headers.get('content-type') ?? '';
            buf = Buffer.from(await r.arrayBuffer());
        } catch {
            buf = execFileSync('curl', ['-sL', '--max-time', '30', '-A', UA, '-e', referer, url], { maxBuffer: 32 * 1024 * 1024 });
            type = /\.png(\?|$)/i.test(url) ? 'image/png' : /\.webp(\?|$)/i.test(url) ? 'image/webp' : /\.gif(\?|$)/i.test(url) ? 'image/gif' : 'image/jpeg';
            if (buf.subarray(0, 5).toString('latin1').startsWith('<')) return { ok: false, note: 'got a page, not an image' };
        }
        if (!/^image\//.test(type)) return { ok: false, note: `not an image (${type.split(';')[0] || 'unknown'})` };
        if (buf.length < 2000) return { ok: false, note: 'image too small' };
        if (buf.length > 6 * 1024 * 1024) return { ok: false, note: 'image over 6 MB' };
        const ext = /svg/.test(type) ? '.svg' : /png/.test(type) ? '.png' : /webp/.test(type) ? '.webp' : /gif/.test(type) ? '.gif' : '.jpg';
        fs.writeFileSync(file + ext, buf);
        return { ok: true, note: `${(buf.length / 1024).toFixed(0)} KB ${ext.slice(1)}` };
    } catch (e: any) { return { ok: false, note: e?.name === 'TimeoutError' ? 'image timed out' : 'image failed' }; }
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const registry: any[] = await (await fetch(registryUrl, { headers: { 'user-agent': UA } })).json();
    // Skip ones already fetched into this folder
    const done = new Set(fs.readdirSync(outDir).map((f) => f.replace(/\.[a-z]+$/i, '')));
    const todo = registry.filter((p) => !p.imageUrl && p.link && !done.has(slug(p.name)));
    console.log(`${registry.length} plugins, ${todo.length} without an image\n`);

    const manifest: { name: string; file: string; source: string }[] = [];
    const failed: string[] = [];
    for (const p of todo) {
        const link = p.link.startsWith('http') ? p.link : `https://${p.link}`;
        const html = await page(link);
        if (!html) { failed.push(`${p.name} — product page unreachable (${link})`); console.log(`  ✗ ${p.name}: page unreachable`); continue; }
        const candidates = findImages(html, link, p.name);
        if (!candidates.length) { failed.push(`${p.name} — no image found on ${link}`); console.log(`  ✗ ${p.name}: no image on the page`); continue; }
        let saved: { url: string; note: string } | null = null;
        for (const img of candidates) {
            const got = await download(img, path.join(outDir, slug(p.name)), link);
            if (got.ok) { saved = { url: img, note: got.note }; break; }
        }
        if (!saved) { failed.push(`${p.name} — could not download any of ${candidates.length} images from ${link}`); console.log(`  ✗ ${p.name}: downloads failed`); continue; }
        const file = fs.readdirSync(outDir).find((f) => f.startsWith(slug(p.name) + '.'))!;
        manifest.push({ name: p.name, file, source: saved.url });
        console.log(`  ✓ ${p.name}: ${saved.note}`);
    }
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(outDir, 'failed.txt'), failed.join('\n'));
    console.log(`\ngot ${manifest.length} images, ${failed.length} failed (see ${outDir}/failed.txt)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
