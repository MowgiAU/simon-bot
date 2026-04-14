const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

const checkIds = [
  ['1489931890524684408', 'verification'],
  ['1487687126798700675', 'rules'],
  ['1388259179923505333', 'server-guide'],
  ['957213994375069746',  'welcome'],
];

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });
  const defaults = new Set(onboarding.default_channel_ids || []);
  console.log('Total default_channel_ids:', defaults.size);
  for (const [id, name] of checkIds) {
    console.log(`  ${name} (${id}): ${defaults.has(id) ? '✅ IN defaults' : '❌ NOT in defaults'}`);
  }
}
main().catch(e => console.error(e.response?.data || e.message));
