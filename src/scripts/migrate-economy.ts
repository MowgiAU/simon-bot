/**
 * One-time migration script: import legacy reputationData.json currency balances.
 *
 * The old bot stored economy balance in reputationData.json under:
 *   data.users[userId][guildId].balance
 *
 * Usage (from project root):
 *   npx tsx src/scripts/migrate-economy.ts [path/to/reputationData.json] [guildId]
 *
 * Both arguments are optional:
 *   - Defaults to data/reputationData.json
 *   - If guildId is omitted, ALL guilds in the file are imported
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const db = new PrismaClient();

async function main() {
    const filePath = process.argv[2] ?? path.join(process.cwd(), 'data', 'reputationData.json');
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
    let zeroed = 0;
    let errors = 0;

    for (const [userId, guilds] of userEntries) {
        for (const [gId, stats] of Object.entries(guilds)) {
            if (filterGuildId && gId !== filterGuildId) {
                skipped++;
                continue;
            }

            const balance: number = stats.balance ?? 0;

            if (balance === 0) {
                zeroed++;
                continue; // No point upserting a zero balance record
            }

            try {
                await db.member.upsert({
                    where: { guildId_userId: { guildId: gId, userId } },
                    update: { balance },
                    create: { guildId: gId, userId, balance },
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

    console.log(`\n✅ Economy migration complete!`);
    console.log(`   Migrated : ${migrated}`);
    console.log(`   Zeroed   : ${zeroed} (skipped — balance was 0)`);
    console.log(`   Skipped  : ${skipped} (different guild)`);
    console.log(`   Errors   : ${errors}`);

    await db.$disconnect();
}

main().catch(e => {
    console.error('Fatal error:', e);
    db.$disconnect();
    process.exit(1);
});
