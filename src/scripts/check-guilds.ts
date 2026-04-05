import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const guilds = await db.guild.findMany({ select: { id: true, name: true } });
console.log(JSON.stringify(guilds, null, 2));
await db.$disconnect();
