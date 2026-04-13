const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const unverifiedRoleId = '1487473716634980515';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

async function main() {
  // Get guild roles
  const { data: guild } = await axios.get(`${base}/guilds/${guildId}`, { headers });
  const rolesMap = {};
  for (const role of guild.roles) rolesMap[role.id] = role;
  
  // Simulate member with ONLY @everyone + unverified role
  const memberRoles = [unverifiedRoleId];
  
  // Compute base permissions
  let basePerms = BigInt(rolesMap[guildId].permissions); // @everyone
  basePerms |= BigInt(rolesMap[unverifiedRoleId]?.permissions || '0');
  
  console.log(`@everyone perms: ${rolesMap[guildId].permissions}`);
  console.log(`Unverified role perms: ${rolesMap[unverifiedRoleId]?.permissions || 'NOT FOUND'}`);
  console.log(`Combined base: ${basePerms.toString()}`);
  console.log(`Base VIEW_CHANNEL: ${(basePerms & 1024n) ? 'YES' : 'NO'}`);
  
  // Get channels
  const { data: channels } = await axios.get(`${base}/guilds/${guildId}/channels`, { headers });
  
  const whitelist = ['957213994375069746','1489931890524684408','1487687126798700675','1388259179923505333'];
  const parentId = '957213968638836776';
  
  // Compute effective permissions for each channel
  function computePerms(ch) {
    const overwrites = ch.permission_overwrites || [];
    let perms = basePerms;
    
    // @everyone channel overwrite
    const evOW = overwrites.find(o => o.id === guildId);
    if (evOW) perms = (perms & ~BigInt(evOW.deny)) | BigInt(evOW.allow);
    
    // Role overwrites (non-@everyone)
    let rAllow = 0n, rDeny = 0n;
    for (const rid of memberRoles) {
      const ow = overwrites.find(o => o.id === rid);
      if (ow) { rAllow |= BigInt(ow.allow); rDeny |= BigInt(ow.deny); }
    }
    perms = (perms & ~rDeny) | rAllow;
    return perms;
  }
  
  console.log('\n=== WHITELISTED CHANNELS ===');
  for (const chId of [...whitelist, parentId]) {
    const ch = channels.find(c => c.id === chId);
    if (!ch) { console.log(`${chId}: NOT FOUND`); continue; }
    const perms = computePerms(ch);
    const view = (perms & 1024n) ? 'VISIBLE' : 'HIDDEN';
    console.log(`[${view}] ${ch.name} (${ch.id}) type=${ch.type}`);
  }
  
  // Count ALL visible channels
  let visibleCount = 0;
  let visibleChannels = [];
  for (const ch of channels) {
    if (![0, 2, 5, 13, 15, 16].includes(ch.type)) continue; // skip categories and other
    const perms = computePerms(ch);
    if (perms & 1024n) {
      visibleCount++;
      visibleChannels.push({ name: ch.name, id: ch.id, type: ch.type, parent: ch.parent_id });
    }
  }
  console.log(`\n=== ALL VISIBLE CHANNELS FOR UNVERIFIED USER (${visibleCount} total) ===`);
  for (const vc of visibleChannels) {
    const parentCh = channels.find(c => c.id === vc.parent);
    console.log(`  ${vc.name} (${vc.id}) type=${vc.type} in "${parentCh?.name || 'no category'}"`);
  }
  
  // Also check if the unverified role even exists
  const unvRole = rolesMap[unverifiedRoleId];
  if (unvRole) {
    console.log(`\nUnverified role: "${unvRole.name}" position=${unvRole.position} managed=${unvRole.managed}`);
  } else {
    console.log('\n!!! UNVERIFIED ROLE NOT FOUND IN GUILD !!!');
  }
}
main().catch(e => console.error(e.response?.data || e.message));
