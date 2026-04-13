require('dotenv').config();
const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
p.welcomeGateSettings.findFirst({ where: { guildId: '955342751669551165' } })
  .then(s => {
    console.log('unverifiedRoleId=' + s.unverifiedRoleId);
    console.log('welcomeChannelId=' + s.welcomeChannelId);
    console.log('whitelistedChannelIds=' + JSON.stringify(s.whitelistedChannelIds));
    return p.$disconnect();
  })
  .catch(e => { console.error(e); return p.$disconnect(); });
