require('dotenv').config();
const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  const settings = await p.welcomeGateSettings.findMany({
    where: { enabled: true }
  });
  
  for (const s of settings) {
    console.log(`\nGuild: ${s.guildId}`);
    console.log(`  enabled: ${s.enabled}`);
    console.log(`  unverifiedRoleId: ${s.unverifiedRoleId}`);
    console.log(`  welcomeChannelId: ${s.welcomeChannelId}`);
    console.log(`  whitelistedChannelIds: ${JSON.stringify(s.whitelistedChannelIds)}`);
    console.log(`  whitelist count: ${s.whitelistedChannelIds?.length || 0}`);
  }
  
  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
