import { PrismaClient } from './node_modules/@prisma/client/default.js';
const db = new PrismaClient();
try {
  const rows = await db.pluginSettings.findMany({ where: { pluginId: 'fuji-radio' } });
  console.log('Current rows:', JSON.stringify(rows));
  const result = await db.pluginSettings.updateMany({ where: { pluginId: 'fuji-radio' }, data: { enabled: true } });
  console.log('Updated count:', result.count);
  console.log('fuji-radio plugin re-enabled in all guilds');
} catch (e) {
  console.error(e);
} finally {
  await db.$disconnect();
}
