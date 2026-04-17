const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const rules = await p.autoResponderRule.findMany({
        where: { guildId: '955342751669551165', enabled: true },
        select: { name: true, response: true, embedJson: true, mentionUser: true }
    });
    for (const r of rules) {
        const resp = (r.response || '').slice(0, 80);
        const hasEmbed = r.embedJson ? 'YES' : 'no';
        console.log(`  [${r.name}] mentionUser=${r.mentionUser} resp="${resp}" embed=${hasEmbed}`);
    }
    await p.$disconnect();
})();
