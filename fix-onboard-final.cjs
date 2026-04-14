const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const base = 'https://discord.com/api/v10';

const RULE_READER = '1094935830893699082';
const PERMISSIONS_CHANNEL = '1388773895082872842'; // used by "Permissions" option, not a default

// Channels that must ONLY come from default_channel_ids, never from option channel_ids
const MUST_BE_DEFAULT = new Set([
  '1489931890524684408', // verification
  '1487687126798700675', // rules
  '1388259179923505333', // server-guide
  '957213994375069746',  // welcome
]);

async function main() {
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });

  const updatedPrompts = onboarding.prompts.map((p, pi) => ({
    ...p,
    options: p.options.map(opt => {
      const cleanedChannels = (opt.channel_ids || []).filter(id => !MUST_BE_DEFAULT.has(id));
      const roles = opt.role_ids || [];

      // Special replacements to keep at least one role or channel:
      // Prompt 0 "Verification" option: had only verification channel (now empty) → assign rule_reader role
      if (pi === 0 && opt.title === 'Verification' && cleanedChannels.length === 0 && roles.length === 0) {
        console.log('  → "Verification" option: assigning rule_reader role instead of channel');
        return { ...opt, channel_ids: [], role_ids: [RULE_READER] };
      }
      // Prompt 3 "Commands" option: had only server-guide (now empty) → assign rule_reader role
      if (pi === 3 && opt.title === 'Commands' && cleanedChannels.length === 0 && roles.length === 0) {
        console.log('  → "Commands" option: assigning rule_reader role instead of server-guide');
        return { ...opt, channel_ids: [], role_ids: [RULE_READER] };
      }

      return { ...opt, channel_ids: cleanedChannels };
    }),
  }));

  console.log('Final prompt 0 options:');
  for (const opt of updatedPrompts[0].options) {
    console.log(`  "${opt.title}": roles=${JSON.stringify(opt.role_ids)}, channels=${JSON.stringify(opt.channel_ids)}`);
  }
  console.log('Final prompt 3 options:');
  for (const opt of updatedPrompts[3].options) {
    console.log(`  "${opt.title}": roles=${JSON.stringify(opt.role_ids)}, channels=${JSON.stringify(opt.channel_ids)}`);
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
  
  // Verify none of the problematic channels remain in any option
  let found = false;
  for (const p of result.prompts) {
    for (const opt of p.options) {
      const bad = (opt.channel_ids || []).filter(id => MUST_BE_DEFAULT.has(id));
      if (bad.length) { console.log(`❌ Still found in "${p.title}" > "${opt.title}": ${bad}`); found = true; }
    }
  }
  if (!found) console.log('✅ No default channels remain in any prompt option channel_ids');
}
main().catch(e => console.error(JSON.stringify(e.response?.data, null, 2) || e.message));
