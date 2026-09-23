/**
 * Imports plugin promo images into the registry, and optionally corrects product links.
 *
 * Images are files named after the plugin (slugified), e.g. "valhalla-room.jpg" for
 * "ValhallaRoom". Each is copied into public/uploads/plugins and set as that plugin's imageUrl —
 * the same place and shape the dashboard's own upload uses. Entries that already have an image
 * are left alone unless --replace is passed.
 *
 *   npx tsx scripts/import-plugin-images.ts <imageDir> [--links links.json] [--replace] [--dry]
 *
 * links.json is { "Plugin name": "https://…", … } for fixing product pages that moved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const UPLOADS = path.join(PROJECT_ROOT, 'public/uploads/plugins');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
    const args = process.argv.slice(2);
    const dir = args.find((a) => !a.startsWith('--'));
    const dry = args.includes('--dry');
    const replace = args.includes('--replace');
    const linksFile = args[args.indexOf('--links') + 1];
    const links: Record<string, string> = args.includes('--links') ? JSON.parse(fs.readFileSync(linksFile, 'utf8')) : {};

    const db = new PrismaClient();
    try {
        const plugins = await db.knownPlugin.findMany();
        const bySlug = new Map(plugins.map((p) => [slug(p.name), p]));

        // Product pages that moved since the entry was written
        for (const [name, link] of Object.entries(links)) {
            const p = plugins.find((x) => x.name.toLowerCase() === name.toLowerCase());
            if (!p) { console.log(`  ? no plugin named "${name}"`); continue; }
            if (p.link === link) continue;
            console.log(`  link ${p.name}: ${p.link} → ${link}`);
            if (!dry) await db.knownPlugin.update({ where: { id: p.id }, data: { link } });
        }

        if (dir) {
            fs.mkdirSync(UPLOADS, { recursive: true });
            let done = 0, skipped = 0;
            for (const file of fs.readdirSync(dir)) {
                if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) continue;
                const p = bySlug.get(slug(path.basename(file, path.extname(file))));
                if (!p) { console.log(`  ? no plugin for image ${file}`); continue; }
                if (p.imageUrl && !replace) { skipped++; continue; }
                const target = `plugin-${slug(p.name)}-${Date.now()}${path.extname(file).toLowerCase()}`;
                console.log(`  image ${p.name} ← ${file}`);
                if (!dry) {
                    fs.copyFileSync(path.join(dir, file), path.join(UPLOADS, target));
                    await db.knownPlugin.update({ where: { id: p.id }, data: { imageUrl: `/uploads/plugins/${target}` } });
                }
                done++;
            }
            console.log(`\n${dry ? 'would import' : 'imported'} ${done} images (${skipped} already had one)`);
        }

        const left = await db.knownPlugin.findMany({ where: { imageUrl: null }, select: { name: true }, orderBy: { name: 'asc' } });
        console.log(`still without an image (${left.length}): ${left.map((p) => p.name).join(', ') || 'none'}`);
    } finally {
        await db.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
