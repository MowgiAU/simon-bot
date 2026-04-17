const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const rules = await p.autoResponderRule.findMany({
        where: { guildId: '955342751669551165', enabled: true, embedJson: { not: null } },
        select: { name: true, embedJson: true }
    });
    for (const r of rules) {
        console.log(`\n=== ${r.name} ===`);
        console.log(JSON.stringify(r.embedJson, null, 2));
    }
    await p.$disconnect();
})();
