import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const all = await db.welcomeGateSettings.findMany();
for (const s of all) {
  console.log(`Guild ${s.guildId}: whitelistedChannelIds=${JSON.stringify(s.whitelistedChannelIds)} (${s.whitelistedChannelIds?.length})`);
}
await db.$disconnect();
