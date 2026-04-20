const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.beatBattle.findMany({ select: { id: true, slug: true, title: true, status: true }, orderBy: { createdAt: 'desc' }, take: 5 })
  .then(r => { console.log(JSON.stringify(r, null, 2)); return db.$disconnect(); })
  .catch(e => { console.error(e); return db.$disconnect(); });
