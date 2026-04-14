const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const base = 'https://discord.com/api/v10';

// We want to remove the 4 target channels from default_channel_ids,
// so that when we (or the user) re-adds them via Discord UI it triggers
// the "Apply to existing members?" prompt for the first time.

const TARGET = new Set([
  '1489931890524684408', // verification
  '1487687126798700675', // rules
  '1388259179923505333', // server-guide
  '957213994375069746',  // welcome
]);

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });
  console.log('Before: default_channel_count=', onboarding.default_channel_ids.length);
  
  const stripped = onboarding.default_channel_ids.filter(id => !TARGET.has(id));
  console.log('After strip: default_channel_count=', stripped.length);
  
  const patch = {
    prompts: onboarding.prompts,
    default_channel_ids: stripped,
    enabled: onboarding.enabled,
    mode: onboarding.mode,
  };

  const { data: result } = await axios.put(`${base}/guilds/${guildId}/onboarding`, patch, { headers });
  console.log('Done. default_channel_count now:', result.default_channel_ids.length);
  console.log('Any TARGET still in defaults?', result.default_channel_ids.filter(id => TARGET.has(id)));
}
main().catch(e => console.error(JSON.stringify(e.response?.data, null, 2) || e.message));
