const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const unverifiedRoleId = '1487473716634980515';
const headers = { Authorization: 'Bot ' + token };

async function main() {
  const { data: channels } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
  const whitelist = ['957213994375069746','1489931890524684408','1487687126798700675','1388259179923505333','957213968638836776'];
  
  console.log('=== FULL PERMISSION OVERWRITES FOR WHITELISTED CHANNELS ===');
  for (const id of whitelist) {
    const ch = channels.find(c => c.id === id);
    if (!ch) { console.log(`${id} NOT FOUND`); continue; }
    console.log(`\n${ch.name} (${ch.id}) type=${ch.type} parent=${ch.parent_id || 'none'}`);
    for (const ow of (ch.permission_overwrites || [])) {
      const allow = BigInt(ow.allow);
      const deny = BigInt(ow.deny);
      const viewAllow = (allow & 1024n) ? 'YES' : 'no';
      const viewDeny = (deny & 1024n) ? 'YES' : 'no';
      const sendAllow = (allow & 2048n) ? 'YES' : 'no';
      const sendDeny = (deny & 2048n) ? 'YES' : 'no';
      const label = ow.id === guildId ? '@everyone' : ow.id === unverifiedRoleId ? 'UNVERIFIED' : ow.id;
      console.log(`  ${label} (type=${ow.type}): VIEW allow=${viewAllow} deny=${viewDeny} | SEND allow=${sendAllow} deny=${sendDeny} | raw allow=${ow.allow} deny=${ow.deny}`);
    }
  }

  // Check the parent category of whitelisted channels
  const parentId = '957213968638836776';
  const parent = channels.find(c => c.id === parentId);
  if (parent) {
    console.log('\n=== PARENT CATEGORY DETAILS ===');
    console.log(`${parent.name} (${parent.id}) type=${parent.type}`);
    for (const ow of (parent.permission_overwrites || [])) {
      const allow = BigInt(ow.allow);
      const deny = BigInt(ow.deny);
      const viewAllow = (allow & 1024n) ? 'YES' : 'no';
      const viewDeny = (deny & 1024n) ? 'YES' : 'no';
      const label = ow.id === guildId ? '@everyone' : ow.id === unverifiedRoleId ? 'UNVERIFIED' : ow.id;
      console.log(`  ${label} (type=${ow.type}): VIEW allow=${viewAllow} deny=${viewDeny} | raw allow=${ow.allow} deny=${ow.deny}`);
    }
  }

  // Check @everyone base server permissions
  const { data: guild } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}`, { headers });
  const everyoneRole = guild.roles.find(r => r.id === guildId);
  if (everyoneRole) {
    const perms = BigInt(everyoneRole.permissions);
    console.log('\n=== @everyone BASE PERMISSIONS ===');
    console.log(`VIEW_CHANNEL: ${(perms & 1024n) ? 'YES' : 'NO'}`);
    console.log(`raw permissions: ${everyoneRole.permissions}`);
  }

  // Check unverified role base permissions
  const unverified = guild.roles.find(r => r.id === unverifiedRoleId);
  if (unverified) {
    const perms = BigInt(unverified.permissions);
    console.log('\n=== UNVERIFIED ROLE BASE PERMISSIONS ===');
    console.log(`VIEW_CHANNEL: ${(perms & 1024n) ? 'YES' : 'NO'}`);
    console.log(`raw permissions: ${unverified.permissions}`);
  }
}
main().catch(e => console.error(e));
