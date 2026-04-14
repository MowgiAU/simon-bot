const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const base = 'https://discord.com/api/v10';

const enable = process.argv[2] !== 'off'; // node this.cjs off = disable, no arg = enable

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });
  console.log('Current enabled:', onboarding.enabled, '→ setting to:', enable);

  const patch = {
    prompts: onboarding.prompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: enable,
    mode: onboarding.mode,
  };

  const { data: result } = await axios.put(`${base}/guilds/${guildId}/onboarding`, patch, { headers });
  console.log('Done. enabled=', result.enabled, 'mode=', result.mode);
}
main().catch(e => console.error(JSON.stringify(e.response?.data, null, 2) || e.message));
