/**
 * Fuji Studio — Legacy Feedback Points Migration
 *
 * Reads feedbackPoints.json and upserts each record into the `feedback_points`
 * table. Existing balances are incremented rather than overwritten, so the
 * script is safe to run against a database that already has live data.
 *
 * Usage (dry run — no writes):
 *   npx tsx scripts/migrate-feedback.ts --dry-run
 *
 * Usage (live):
 *   npx tsx scripts/migrate-feedback.ts
 *
 * Source shape:
 *   { [guildId]: { [userId]: { points: number, approvedFeedbackCount: number } } }
 *
 * Target model: FeedbackPoints  (@@unique([guildId, userId]))
 *   balance     Int  — current spendable balance  → incremented by legacy `points`
 *   totalEarned Int  — lifetime total             → incremented by legacy `points`
 *
 * approvedFeedbackCount has no dedicated column in the new schema. It is
 * preserved in the FeedbackPointsTransaction reason string for audit purposes.
 *
 * Multi-guild behaviour:
 *   Each (guildId, userId) pair is an independent row. A user present in
 *   multiple guilds gets one FeedbackPoints row per guild — balances are never
 *   cross-guild accumulated. The script processes every guild in the JSON
 *   sequentially and validates each guild exists in the Guild table before
 *   writing any rows for it (avoids foreign-key violations for stale IDs).
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

interface LegacyUser {
    points: number;
    approvedFeedbackCount: number;
}

type LegacyData = Record<string, Record<string, LegacyUser>>;

const db = new PrismaClient();

async function main() {
    const jsonPath = path.resolve(__dirname, '..', 'feedbackPoints.json');
    if (!fs.existsSync(jsonPath)) {
        console.error(`feedbackPoints.json not found at: ${jsonPath}`);
        process.exit(1);
    }

    const data: LegacyData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const guildIds = Object.keys(data);

    console.log(`\nFuji Studio — Feedback Points Migration`);
    console.log(`Mode   : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log(`Guilds : ${guildIds.length}`);
    console.log(
        `Users  : ${Object.values(data).reduce((n, u) => n + Object.keys(u).length, 0)} total\n`
    );

    let upserted = 0;
    let skippedZero = 0;
    let skippedGuild = 0;
    let failed = 0;

    for (const guildId of guildIds) {
        const users = data[guildId];
        const userCount = Object.keys(users).length;

        // Validate the guild exists — FK constraint will reject inserts otherwise
        const guild = await db.guild.findUnique({ where: { id: guildId } });
        if (!guild) {
            console.warn(`  ⚠  Guild ${guildId} not found in Guild table — skipping ${userCount} users`);
            skippedGuild += userCount;
            continue;
        }

        console.log(`Guild ${guildId} (${guild.name ?? 'unnamed'}) — ${userCount} users`);

        let guildUpserted = 0;

        for (const [userId, raw] of Object.entries(users)) {
            // Math.trunc on every numeric value — guards against float-rounding
            // issues on Windows where JSON.parse can produce 2.9999999 etc.
            const points = Math.trunc(Number(raw.points));
            const approvedCount = Math.trunc(Number(raw.approvedFeedbackCount));

            // Sanity check: skip clearly corrupt rows
            if (!Number.isFinite(points) || !Number.isFinite(approvedCount)) {
                console.warn(`  ✗ Skipping user ${userId}: non-finite value (points=${raw.points})`);
                failed++;
                continue;
            }

            if (DRY_RUN) {
                console.log(
                    `  [dry] upsert user=${userId} +${points}pts (${approvedCount} approvals)`
                );
                guildUpserted++;
                upserted++;
                continue;
            }

            try {
                // Upsert the balance row — increment so live data is never overwritten
                await db.feedbackPoints.upsert({
                    where: { guildId_userId: { guildId, userId } },
                    create: {
                        guildId,
                        userId,
                        balance: points,
                        totalEarned: points,
                    },
                    update: {
                        balance: { increment: points },
                        totalEarned: { increment: points },
                    },
                });

                // Write a single audit transaction for every user regardless of
                // points value — zero-point users still have approved feedback
                // history worth preserving in the ledger.
                await db.feedbackPointsTransaction.create({
                    data: {
                        guildId,
                        userId,
                        amount: points,
                        type: 'BONUS',
                        reason: `Legacy migration: ${approvedCount} approved feedback${approvedCount !== 1 ? 's' : ''}, ${points} point${points !== 1 ? 's' : ''} carried over`,
                    },
                });

                guildUpserted++;
                upserted++;
            } catch (err) {
                console.error(`  ✗ Failed user=${userId} guild=${guildId}:`, err);
                failed++;
            }
        }

        console.log(`  → ${guildUpserted}/${userCount} upserted`);
    }

    console.log(`\n─────────────────────────────────────`);
    console.log(`Migration ${DRY_RUN ? 'simulation' : ''} complete`);
    console.log(`  Upserted       : ${upserted}`);
    console.log(`  Skipped (guild): ${skippedGuild}`);
    console.log(`  Failed         : ${failed}`);
    if (DRY_RUN) {
        console.log(`\nRun without --dry-run to apply changes.`);
    }
}

main()
    .catch((err) => {
        console.error('Fatal:', err);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
