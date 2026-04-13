const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const unverifiedRoleId = '1487473716634980515';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

async function main() {
  // 1. Find members with the unverified role
  console.log('=== Finding members with unverified role ===');
  const { data: members } = await axios.get(
    `${base}/guilds/${guildId}/members?limit=100`,
    { headers }
  );
  
  const unverifiedMembers = members.filter(m => m.roles.includes(unverifiedRoleId));
  console.log(`Found ${unverifiedMembers.length} members with unverified role out of ${members.length} checked`);
  
  if (unverifiedMembers.length === 0) {
    console.log('No members with unverified role found! The test user might not have the role.');
    return;
  }
  
  // Pick one
  const testMember = unverifiedMembers[0];
  console.log(`Test member: ${testMember.user.username}#${testMember.user.discriminator} (${testMember.user.id})`);
  console.log(`Roles: ${JSON.stringify(testMember.roles)}`);
  
  // 2. Get all guild roles
  const { data: guild } = await axios.get(`${base}/guilds/${guildId}`, { headers });
  const rolesMap = {};
  for (const role of guild.roles) {
    rolesMap[role.id] = role;
  }
  
  // 3. Compute base permissions for this member
  let basePerms = BigInt(rolesMap[guildId].permissions); // @everyone
  for (const roleId of testMember.roles) {
    if (rolesMap[roleId]) {
      basePerms |= BigInt(rolesMap[roleId].permissions);
    }
  }
  console.log(`\nBase permissions: ${basePerms.toString()}`);
  console.log(`Base VIEW_CHANNEL: ${(basePerms & 1024n) ? 'YES' : 'NO'}`);
  console.log(`Base ADMINISTRATOR: ${(basePerms & 8n) ? 'YES' : 'NO'}`);
  
  // 4. Get channels and compute per-channel permissions
  const { data: channels } = await axios.get(`${base}/guilds/${guildId}/channels`, { headers });
  
  const whitelist = ['957213994375069746','1489931890524684408','1487687126798700675','1388259179923505333'];
  const parentId = '957213968638836776';
  const testChannels = [...whitelist, parentId];
  
  console.log('\n=== EFFECTIVE PERMISSIONS PER CHANNEL ===');
  for (const chId of testChannels) {
    const ch = channels.find(c => c.id === chId);
    if (!ch) { console.log(`${chId}: NOT FOUND`); continue; }
    
    const overwrites = ch.permission_overwrites || [];
    
    // Step 1: Start with base
    let perms = basePerms;
    
    // Step 2: Apply @everyone channel overwrite
    const everyoneOW = overwrites.find(o => o.id === guildId);
    if (everyoneOW) {
      perms = (perms & ~BigInt(everyoneOW.deny)) | BigInt(everyoneOW.allow);
    }
    
    // Step 3: Apply role channel overwrites (all roles except @everyone)
    let roleAllow = 0n;
    let roleDeny = 0n;
    for (const roleId of testMember.roles) {
      const ow = overwrites.find(o => o.id === roleId);
      if (ow) {
        roleAllow |= BigInt(ow.allow);
        roleDeny |= BigInt(ow.deny);
      }
    }
    perms = (perms & ~roleDeny) | roleAllow;
    
    const canView = (perms & 1024n) ? 'YES' : 'NO';
    console.log(`${ch.name} (${ch.id}, type=${ch.type}): VIEW_CHANNEL=${canView}`);
    
    // Show detailed breakdown
    if (canView === 'NO') {
      console.log(`  Base VIEW: ${(basePerms & 1024n) ? 'YES' : 'NO'}`);
      if (everyoneOW) {
        console.log(`  @everyone OW: allow=${(BigInt(everyoneOW.allow) & 1024n) ? 'YES' : 'no'}, deny=${(BigInt(everyoneOW.deny) & 1024n) ? 'YES' : 'no'}`);
      }
      console.log(`  Role OW combined: allow=${(roleAllow & 1024n) ? 'YES' : 'no'}, deny=${(roleDeny & 1024n) ? 'YES' : 'no'}`);
      
      // Check each role's overwrite individually
      for (const roleId of testMember.roles) {
        const ow = overwrites.find(o => o.id === roleId);
        if (ow) {
          const rName = rolesMap[roleId]?.name || roleId;
          console.log(`  Role "${rName}" (${roleId}): allow=${(BigInt(ow.allow) & 1024n) ? 'VIEW' : '-'}, deny=${(BigInt(ow.deny) & 1024n) ? 'VIEW' : '-'}`);
        }
      }
    }
  }
  
  // 5. Also show some NON-whitelisted channels that SHOULD be hidden
  console.log('\n=== SAMPLE NON-WHITELISTED CHANNELS (should be hidden) ===');
  const nonWhitelisted = channels.filter(c => 
    !testChannels.includes(c.id) && c.type === 0 && c.parent_id === parentId
  ).slice(0, 3);
  
  for (const ch of nonWhitelisted) {
    const overwrites = ch.permission_overwrites || [];
    let perms = basePerms;
    const everyoneOW = overwrites.find(o => o.id === guildId);
    if (everyoneOW) perms = (perms & ~BigInt(everyoneOW.deny)) | BigInt(everyoneOW.allow);
    let roleAllow = 0n, roleDeny = 0n;
    for (const roleId of testMember.roles) {
      const ow = overwrites.find(o => o.id === roleId);
      if (ow) { roleAllow |= BigInt(ow.allow); roleDeny |= BigInt(ow.deny); }
    }
    perms = (perms & ~roleDeny) | roleAllow;
    console.log(`${ch.name} (${ch.id}): VIEW_CHANNEL=${(perms & 1024n) ? 'YES (BUG!)' : 'NO (correct)'}`);
  }
}
main().catch(e => console.error(e.response?.data || e.message));
