const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const base = 'https://discord.com/api/v10';

const IMPORTANT_CHANNELS = [
  '1489931890524684408', // verification
  '1487687126798700675', // rules
  '1388259179923505333', // server-guide
];

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });
  
  const prompt0 = onboarding.prompts[0];
  console.log(`Prompt 0: "${prompt0.title}"`);
  
  for (const opt of prompt0.options) {
    console.log(`  Option "${opt.title}": channels=${JSON.stringify(opt.channel_ids)}`);
  }

  // Add the important channels to BOTH options in prompt 0
  const updatedPrompts = onboarding.prompts.map((p, pi) => {
    if (pi !== 0) return p; // only touch prompt 0
    return {
      ...p,
      options: p.options.map(opt => {
        const existing = new Set(opt.channel_ids || []);
        for (const id of IMPORTANT_CHANNELS) existing.add(id);
        return { ...opt, channel_ids: [...existing] };
      }),
    };
  });

  console.log('\nUpdated prompt 0 options:');
  for (const opt of updatedPrompts[0].options) {
    console.log(`  "${opt.title}": channels=${JSON.stringify(opt.channel_ids)}`);
  }

  const patch = {
    prompts: updatedPrompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: onboarding.enabled,
    mode: onboarding.mode,
  };

  console.log('\nApplying patch...');
  const { data: result } = await axios.put(`${base}/guilds/${guildId}/onboarding`, patch, { headers });
  console.log('Done! mode=', result.mode);
  
  const p0after = result.prompts[0];
  for (const opt of p0after.options) {
    console.log(`  "${opt.title}": channels=${JSON.stringify(opt.channel_ids)}`);
  }
}
main().catch(e => console.error(JSON.stringify(e.response?.data, null, 2) || e.message));
