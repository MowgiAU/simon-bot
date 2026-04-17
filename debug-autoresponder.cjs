const { PrismaClient } = require('./node_modules/@prisma/client');
const db = new PrismaClient();

(async () => {
  const settings = await db.autoResponderSettings.findMany();
  console.log('=== GLOBAL SETTINGS ===');
  for (const s of settings) {
    console.log(`  Guild: ${s.guildId}, globalCooldownSeconds: ${s.globalCooldownSeconds}`);
  }

  const cats = await db.autoResponderCategory.findMany({
    select: { id: true, guildId: true, name: true, cooldownSeconds: true, cooldownReactionEmoji: true }
  });
  console.log('\n=== CATEGORIES ===');
  for (const c of cats) {
    console.log(`  [${c.id}] "${c.name}" - cooldown: ${c.cooldownSeconds}s, emoji: ${c.cooldownReactionEmoji || 'none'}`);
  }

  const rules = await db.autoResponderRule.findMany({
    where: { enabled: true },
    select: { id: true, name: true, trigger: true, triggerType: true, categoryId: true, cooldownSeconds: true, cooldownReactionEmoji: true, reactionEmoji: true }
  });
  console.log('\n=== ENABLED RULES ===');
  for (const r of rules) {
    console.log(`  [${r.id}] "${r.name}" trigger="${r.trigger}" type=${r.triggerType} catId=${r.categoryId || 'none'} cooldown=${r.cooldownSeconds}s reactionEmoji=${r.reactionEmoji || 'none'} cdEmoji=${r.cooldownReactionEmoji || 'none'}`);
  }

  await db.$disconnect();
})();
