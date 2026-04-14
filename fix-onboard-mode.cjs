const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const base = 'https://discord.com/api/v10';

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });
  console.log('Current mode:', onboarding.mode, '(1=Advanced, 0=Default)');
  
  if (onboarding.mode === 0) {
    console.log('Mode is already 0, nothing to fix.');
    return;
  }

  // PATCH with only required fields, setting mode back to 0
  const patch = {
    prompts: onboarding.prompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: onboarding.enabled,
    mode: 0,
  };
  
  console.log('Patching mode back to 0...');
  const { data: result } = await axios.put(`${base}/guilds/${guildId}/onboarding`, patch, { headers });
  console.log('Result mode:', result.mode);
  console.log('Result default_channel_count:', result.default_channel_ids?.length);
  console.log('Done!');
}
main().catch(e => {
  console.error('Error:', JSON.stringify(e.response?.data, null, 2) || e.message);
});
