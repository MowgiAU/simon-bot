/**
 * One-time migration script: import legacy levelingData.json into the database.
 *
 * Usage (from project root):
 *   npx tsx src/scripts/migrate-leveling.ts [path/to/levelingData.json] [guildId]
 *
 * Both arguments are optional:
 *   - Defaults to data/levelingData.json
 *   - If guildId is omitted, ALL guilds in the file are imported
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const db = new PrismaClient();

// ── XP formula (must match LevelingPlugin) ──────────────────────────────────
function xpForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(100 * Math.pow(level, 1.5) + 400);
}

function totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i <= level; i++) total += xpForLevel(i);
    return total;
}

function levelFromTotalXp(totalXp: number): number {
    let level = 0;
    let accumulated = 0;
    while (true) {
        const required = xpForLevel(level + 1);
        if (accumulated + required > totalXp) break;
        accumulated += required;
        level++;
    }
    return level;
}
// ────────────────────────────────────────────────────────────────────────────

async function main() {
    const filePath = process.argv[2] ?? path.join(process.cwd(), 'data', 'levelingData.json');
    const filterGuildId = process.argv[3] ?? null;

    console.log(`📂 Reading: ${filePath}`);
    if (filterGuildId) console.log(`🔎 Filtering to guild: ${filterGuildId}`);

    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (!data.users) {
        console.error('❌ Invalid file: missing top-level "users" key');
        process.exit(1);
    }

    const userEntries = Object.entries(data.users) as [string, Record<string, any>][];
    console.log(`👥 Found ${userEntries.length} users in file`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const [userId, guilds] of userEntries) {
        for (const [gId, stats] of Object.entries(guilds)) {
            if (filterGuildId && gId !== filterGuildId) {
                skipped++;
                continue;
            }

            try {
                const totalXp: number = stats.xp ?? 0;
                const level = levelFromTotalXp(totalXp);
                const xpProgress = totalXp - totalXpForLevel(level);

                await db.member.upsert({
                    where: { guildId_userId: { guildId: gId, userId } },
                    update: {
                        totalXp,
                        level,
                        xp: xpProgress,
                        voiceMinutes: stats.voiceTime ?? 0,
                        reactionsGiven: stats.reactionsGiven ?? 0,
                        reactionsReceived: stats.reactionsReceived ?? 0,
                        earnedRoles: stats.earnedRoles ?? [],
                    },
                    create: {
                        guildId: gId,
                        userId,
                        totalXp,
                        level,
                        xp: xpProgress,
                        voiceMinutes: stats.voiceTime ?? 0,
                        reactionsGiven: stats.reactionsGiven ?? 0,
                        reactionsReceived: stats.reactionsReceived ?? 0,
                        earnedRoles: stats.earnedRoles ?? [],
                    },
                });

                migrated++;
                if (migrated % 100 === 0) {
                    process.stdout.write(`  ⏳ ${migrated} records migrated...\r`);
                }
            } catch (e) {
                console.error(`  ❌ Error for user ${userId} in guild ${gId}:`, e);
                errors++;
            }
        }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Migrated : ${migrated}`);
    console.log(`   Skipped  : ${skipped}`);
    console.log(`   Errors   : ${errors}`);

    await db.$disconnect();
}

main().catch(e => {
    console.error('Fatal error:', e);
    db.$disconnect();
    process.exit(1);
});
