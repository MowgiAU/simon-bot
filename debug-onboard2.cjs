const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });
  console.log('enabled:', onboarding.enabled);
  console.log('mode:', onboarding.mode);
  console.log('below_requirements:', onboarding.below_requirements);
  console.log('default_channel_count:', onboarding.default_channel_ids?.length);
  
  // Check if verification channel is now in defaults
  const verificationId = '1489931890524684408';
  console.log('verification channel in defaults:', onboarding.default_channel_ids?.includes(verificationId));
  
  console.log('\nprompt count:', onboarding.prompts?.length);
  for (const p of onboarding.prompts || []) {
    console.log(`  prompt: "${p.title}" required=${p.required} options=${p.options?.length}`);
    for (const o of p.options || []) {
      console.log(`    - "${o.title}" roles=${JSON.stringify(o.role_ids)} channels=${JSON.stringify(o.channel_ids)}`);
    }
  }
}
main().catch(e => console.error(e.response?.data || e.message));
