/**
 * One-time migration: fix MusicianProfile rows where username = 'Unknown Musician'.
 *
 * For each such profile:
 *  1. Try the Discord API to get the user's real username.
 *  2. Fall back to the displayName, then to a producer-<suffix> slug.
 *  3. Update the row with a unique slugified username.
 *
 * Run: npx tsx scripts/fix-unknown-musician-profiles.ts
 */

import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function slugify(raw: string, suffix: string): string {
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return slug || `producer-${suffix}`;
}

async function discordUsername(userId: string): Promise<string | null> {
    try {
        const res = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
            timeout: 5000,
        });
        return res.data.username || null;
    } catch {
        return null;
    }
}

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
        const existing = await db.musicianProfile.findFirst({
            where: { username: slug, id: { not: excludeId } },
            select: { id: true },
        });
        if (!existing) return slug;
        attempt++;
        slug = `${base}-${attempt}`;
    }
}

async function main() {
    const profiles = await db.musicianProfile.findMany({
        where: { username: 'Unknown Musician' },
        select: { id: true, userId: true, displayName: true },
    });

    console.log(`Found ${profiles.length} profiles with username = 'Unknown Musician'`);
    if (profiles.length === 0) { console.log('Nothing to do.'); return; }

    for (const p of profiles) {
        const discordName = await discordUsername(p.userId);
        const raw = discordName || p.displayName || `producer-${p.userId.slice(-6)}`;
        const base = slugify(raw, p.userId.slice(-6));
        const slug = await uniqueSlug(base, p.id);

        await db.musicianProfile.update({
            where: { id: p.id },
            data: { username: slug },
        });
        console.log(`  Fixed ${p.id}: '${slug}' (was 'Unknown Musician', source: ${discordName ? 'discord' : p.displayName ? 'displayName' : 'generated'})`);
    }

    console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
