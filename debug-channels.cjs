const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const unverifiedRoleId = process.argv[2];
const headers = { Authorization: 'Bot ' + token };

async function main() {
  const { data: channels } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
  const whitelist = ['957213994375069746','1489931890524684408','1487687126798700675','1388259179923505333','957213968638836776'];
  
  console.log('=== WHITELISTED CHANNEL INFO ===');
  for (const id of whitelist) {
    const ch = channels.find(c => c.id === id);
    if (ch) {
      console.log(`${id} => name="${ch.name}", type=${ch.type}, parent_id=${ch.parent_id || 'none'}`);
      // Check permission overwrites for the unverified role
      if (unverifiedRoleId) {
        const overwrite = (ch.permission_overwrites || []).find(o => o.id === unverifiedRoleId);
        if (overwrite) {
          console.log(`  -> overwrite: allow=${overwrite.allow}, deny=${overwrite.deny}`);
        } else {
          console.log(`  -> NO overwrite for unverified role`);
        }
      }
    } else {
      console.log(`${id} => NOT FOUND`);
    }
  }

  // Also find which channels are actually visible (have allow=1024 for unverified role)
  if (unverifiedRoleId) {
    console.log('\n=== ALL CHANNELS WITH VIEW_CHANNEL ALLOWED ===');
    for (const ch of channels) {
      const ow = (ch.permission_overwrites || []).find(o => o.id === unverifiedRoleId);
      if (ow && (BigInt(ow.allow) & 1024n)) {
        console.log(`${ch.id} "${ch.name}" type=${ch.type} parent=${ch.parent_id || 'none'}`);
      }
    }
  }
}
main().catch(e => console.error(e));
