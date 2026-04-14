const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const base = 'https://discord.com/api/v10';

// These channels should be universally visible (in default_channel_ids).
// They must NOT appear in any prompt option's channel_ids or Discord treats them as opt-in.
const DEFAULT_ONLY_CHANNELS = new Set([
  '1489931890524684408', // verification
  '1487687126798700675', // rules
  '1388259179923505333', // server-guide
  '957213994375069746',  // welcome
]);

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });

  console.log('Before:');
  for (const p of onboarding.prompts) {
    for (const opt of p.options) {
      const affected = (opt.channel_ids || []).filter(id => DEFAULT_ONLY_CHANNELS.has(id));
      if (affected.length) console.log(`  Prompt "${p.title}" > Option "${opt.title}" has: ${affected}`);
    }
  }

  // Strip default-only channels from ALL prompt option channel_ids
  const updatedPrompts = onboarding.prompts.map(p => ({
    ...p,
    options: p.options.map(opt => ({
      ...opt,
      channel_ids: (opt.channel_ids || []).filter(id => !DEFAULT_ONLY_CHANNELS.has(id)),
    })),
  }));

  console.log('\nAfter (affected options):');
  for (const p of updatedPrompts) {
    for (const opt of p.options) {
      console.log(`  "${p.title}" > "${opt.title}": channels=${JSON.stringify(opt.channel_ids)}`);
    }
  }

  const patch = {
    prompts: updatedPrompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: onboarding.enabled,
    mode: onboarding.mode,
  };

  console.log('\nApplying...');
  const { data: result } = await axios.put(`${base}/guilds/${guildId}/onboarding`, patch, { headers });
  console.log('Done! mode=', result.mode);
}
main().catch(e => console.error(JSON.stringify(e.response?.data, null, 2) || e.message));
