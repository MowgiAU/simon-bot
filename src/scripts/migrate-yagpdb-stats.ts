/**
 * YAGPDB → Fuji Studio Stats Migration
 * =====================================
 * Merges historical YAGPDB server stats and per-member message counts into
 * the Fuji Studio database (sum strategy — adds on top of existing values).
 *
 * ── STEP 1: Export from your YAGPDB PostgreSQL database ────────────────────
 *
 * Connect to your YAGPDB DB (replace YOUR_GUILD_ID with your server's numeric ID):
 *
 *   psql -U yagpdb -d yagpdb
 *
 * Then run these three COPY commands:
 *
 *   -- Daily server message totals
 *   \COPY (
 *     SELECT date_trunc('day', started AT TIME ZONE 'UTC')::date AS day,
 *            SUM(message_count) AS message_count
 *     FROM server_stats_periods
 *     WHERE guild_id = YOUR_GUILD_ID
 *     GROUP BY 1 ORDER BY 1
 *   ) TO '/tmp/yagpdb_daily_messages.csv' CSV HEADER;
 *
 *   -- Per-member lifetime message counts
 *   \COPY (
 *     SELECT user_id, SUM(message_count) AS total_messages
 *     FROM server_stats_periods
 *     WHERE guild_id = YOUR_GUILD_ID AND user_id != 0
 *     GROUP BY user_id
 *   ) TO '/tmp/yagpdb_member_messages.csv' CSV HEADER;
 *
 *   -- Daily join / leave counts
 *   \COPY (
 *     SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
 *            SUM(joined) AS joins,
 *            SUM("left")  AS leaves,
 *            MAX(total)   AS member_count
 *     FROM server_stats_member_periods
 *     WHERE guild_id = YOUR_GUILD_ID
 *     GROUP BY 1 ORDER BY 1
 *   ) TO '/tmp/yagpdb_member_periods.csv' CSV HEADER;
 *
 *   -- Download them to your local machine, e.g.:
 *   scp root@<your-yagpdb-server>:/tmp/yagpdb_*.csv data/
 *
 * ── STEP 2: Run this script ─────────────────────────────────────────────────
 *
 *   npx tsx src/scripts/migrate-yagpdb-stats.ts \
 *     --guild  <GUILD_ID>  \
 *     --msgs   data/yagpdb_daily_messages.csv \
 *     --members data/yagpdb_member_messages.csv \
 *     --joins  data/yagpdb_member_periods.csv
 *
 * All three CSV flags are optional — omit any you don't have.
 * Pass --dry-run to preview changes without writing to the database.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const db = new PrismaClient();

// ── CLI argument parser ──────────────────────────────────────────────────────
function arg(flag: string): string | null {
    const idx = process.argv.indexOf(flag);
    if (idx === -1 || idx + 1 >= process.argv.length) return null;
    return process.argv[idx + 1];
}
function hasFlag(flag: string): boolean {
    return process.argv.includes(flag);
}

// ── CSV parser (header row + data rows) ─────────────────────────────────────
function parseCsv(raw: string): Record<string, string>[] {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
        return row;
    });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const guildId   = arg('--guild');
    const msgsFile  = arg('--msgs');
    const membFile  = arg('--members');
    const joinsFile = arg('--joins');
    const dryRun    = hasFlag('--dry-run');

    if (!guildId) {
        console.error('❌  --guild <GUILD_ID> is required');
        process.exit(1);
    }

    console.log(`\n🚀  YAGPDB → Fuji Studio stats migration`);
    console.log(`   Guild  : ${guildId}`);
    console.log(`   Mode   : ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

    // ── 1. Daily server message counts ─────────────────────────────────────
    if (msgsFile) {
        console.log(`📨  Processing daily message counts: ${msgsFile}`);
        const raw = await fs.readFile(msgsFile, 'utf8');
        const rows = parseCsv(raw);
        let done = 0, skipped = 0;

        for (const row of rows) {
            const day = row['day'];
            const count = parseInt(row['message_count'] ?? '0', 10);
            if (!day || isNaN(count) || count <= 0) { skipped++; continue; }

            const date = new Date(day);
            if (isNaN(date.getTime())) { skipped++; continue; }

            if (!dryRun) {
                await db.serverStats.upsert({
                    where: { guildId_date: { guildId, date } },
                    update: { messageCount: { increment: count } },
                    create: { guildId, date, messageCount: count, voiceMinutes: 0, newBans: 0, memberCount: 0 },
                });
            }
            done++;
        }
        console.log(`   ✅  ${done} days merged, ${skipped} skipped\n`);
    }

    // ── 2. Per-member lifetime message counts ───────────────────────────────
    if (membFile) {
        console.log(`👤  Processing per-member message counts: ${membFile}`);
        const raw = await fs.readFile(membFile, 'utf8');
        const rows = parseCsv(raw);
        let done = 0, skipped = 0;

        for (const row of rows) {
            const userId = row['user_id'];
            const count  = parseInt(row['total_messages'] ?? '0', 10);
            if (!userId || isNaN(count) || count <= 0) { skipped++; continue; }

            if (!dryRun) {
                await db.member.upsert({
                    where: { guildId_userId: { guildId, userId } },
                    update: { messagesCount: { increment: count } },
                    create: {
                        guildId, userId,
                        messagesCount: count,
                        level: 0, xp: 0, totalXp: 0,
                        voiceMinutes: 0, reactionsGiven: 0, reactionsReceived: 0,
                    },
                });
            }
            done++;
            if (done % 200 === 0) process.stdout.write(`   ⏳  ${done} members...\r`);
        }
        console.log(`   ✅  ${done} members merged, ${skipped} skipped\n`);
    }

    // ── 3. Daily joins / leaves → memberCount ──────────────────────────────
    if (joinsFile) {
        console.log(`🚪  Processing daily join/leave counts: ${joinsFile}`);
        const raw = await fs.readFile(joinsFile, 'utf8');
        const rows = parseCsv(raw);
        let done = 0, skipped = 0;

        for (const row of rows) {
            const day         = row['day'];
            const memberCount = parseInt(row['member_count'] ?? '0', 10);
            if (!day || isNaN(memberCount)) { skipped++; continue; }

            const date = new Date(day);
            if (isNaN(date.getTime())) { skipped++; continue; }

            if (!dryRun) {
                // For member count we use the MAX (whichever is larger wins) because
                // summing counts doesn't make sense — the snapshot value is absolute.
                const existing = await db.serverStats.findUnique({
                    where: { guildId_date: { guildId, date } },
                    select: { memberCount: true },
                });
                const newCount = Math.max(existing?.memberCount ?? 0, memberCount);

                await db.serverStats.upsert({
                    where: { guildId_date: { guildId, date } },
                    update: { memberCount: newCount },
                    create: { guildId, date, memberCount, messageCount: 0, voiceMinutes: 0, newBans: 0 },
                });
            }
            done++;
        }
        console.log(`   ✅  ${done} days merged, ${skipped} skipped\n`);
    }

    if (!msgsFile && !membFile && !joinsFile) {
        console.warn('⚠️   No CSV files provided. Nothing to import.');
        console.warn('    See script header for export instructions.\n');
    }

    console.log('🎉  Migration complete!');
    await db.$disconnect();
}

main().catch(async e => {
    console.error('❌  Fatal error:', e);
    await db.$disconnect();
    process.exit(1);
});
