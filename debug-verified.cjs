const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const verifiedRoleId = process.argv[2]; // pass as arg
const unverifiedRoleId = '1487473716634980515';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

async function main() {
  const { data: guild } = await axios.get(`${base}/guilds/${guildId}`, { headers });
  const { data: channels } = await axios.get(`${base}/guilds/${guildId}/channels`, { headers });
  
  // Find verified role if not provided
  let verRole = verifiedRoleId 
    ? guild.roles.find(r => r.id === verifiedRoleId)
    : guild.roles.find(r => r.name.toLowerCase().includes('verif') && r.id !== unverifiedRoleId);
  
  if (verRole) {
    console.log(`Verified role: "${verRole.name}" (${verRole.id}) perms=${verRole.permissions}`);
  } else {
    console.log('Could not find verified role');
    console.log('All roles:');
    for (const r of guild.roles.sort((a,b) => b.position - a.position)) {
      console.log(`  pos=${r.position} "${r.name}" (${r.id}) perms=${r.permissions}`);
    }
    return;
  }

  const everyoneRole = guild.roles.find(r => r.id === guildId);
  const basePerms = BigInt(everyoneRole.permissions) | BigInt(verRole.permissions);
  
  console.log('\n@everyone base perms: VIEW_CHANNEL=' + ((BigInt(everyoneRole.permissions) & 1024n) ? 'YES' : 'NO'));
  console.log(`Verified role base perms: VIEW_CHANNEL=${(BigInt(verRole.permissions) & 1024n) ? 'YES' : 'NO'}`);
  console.log(`Combined base: VIEW_CHANNEL=${(basePerms & 1024n) ? 'YES' : 'NO'}`);

  const testChannels = ['957213994375069746','1489931890524684408','1487687126798700675','1388259179923505333','957213968638836776'];
  
  console.log('\n=== VERIFIED MEMBER PERMISSIONS ===');
  for (const chId of testChannels) {
    const ch = channels.find(c => c.id === chId);
    if (!ch) { console.log(`${chId}: NOT FOUND`); continue; }
    
    const overwrites = ch.permission_overwrites || [];
    let perms = basePerms;
    
    // @everyone channel overwrite
    const evOW = overwrites.find(o => o.id === guildId);
    if (evOW) perms = (perms & ~BigInt(evOW.deny)) | BigInt(evOW.allow);
    
    // Verified role channel overwrite
    const vOW = overwrites.find(o => o.id === verRole.id);
    let note = '';
    if (vOW) {
      const vAllow = (BigInt(vOW.allow) & 1024n) ? 'ALLOW' : '-';
      const vDeny = (BigInt(vOW.deny) & 1024n) ? 'DENY' : '-';
      perms = (perms & ~BigInt(vOW.deny)) | BigInt(vOW.allow);
      note = ` [verified role OW: VIEW ${vAllow}/${vDeny}]`;
    }
    
    console.log(`[${(perms & 1024n) ? 'VISIBLE' : 'HIDDEN'}] ${ch.name}${note}`);
    if (!(perms & 1024n)) {
      console.log(`  @everyone OW: ${evOW ? `allow=${(BigInt(evOW.allow) & 1024n) ? 'YES' : 'no'}, deny=${(BigInt(evOW.deny) & 1024n) ? 'YES' : 'no'}` : 'none'}`);
      console.log('  All overwrites:');
      for (const ow of overwrites) {
        const label = ow.id === guildId ? '@everyone' : ow.id === unverifiedRoleId ? 'UNVERIFIED' : ow.id === verRole.id ? 'VERIFIED' : ow.id;
        console.log(`    ${label}: allow=${(BigInt(ow.allow) & 1024n) ? 'VIEW' : '-'}, deny=${(BigInt(ow.deny) & 1024n) ? 'VIEW' : '-'}`);
      }
    }
  }
}
main().catch(e => console.error(e.response?.data || e.message));
