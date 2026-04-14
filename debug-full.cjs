const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

const UNVERIFIED = '1487473716634980515';
const EVERYONE = guildId;
const FRUITS = '957213932655894528';
const RULE_READER = '1094935830893699082';

const targetChannels = [
  '957213994375069746',   // welcome
  '1489931890524684408',  // verification
  '1487687126798700675',  // rules
  '1388259179923505333',  // server-guide
  '957213968638836776',   // Information category
];

async function main() {
  const { data: guild } = await axios.get(`${base}/guilds/${guildId}`, { headers });
  const { data: channels } = await axios.get(`${base}/guilds/${guildId}/channels`, { headers });
  const { data: onboarding } = await axios.get(`${base}/guilds/${guildId}/onboarding`, { headers });

  const everyoneRole = guild.roles.find(r => r.id === EVERYONE);
  const fruitsRole = guild.roles.find(r => r.id === FRUITS);
  const unverifiedRole = guild.roles.find(r => r.id === UNVERIFIED);
  const ruleReaderRole = guild.roles.find(r => r.id === RULE_READER);

  console.log('=== BASE ROLE PERMISSIONS ===');
  console.log(`@everyone (${everyoneRole.id}): VIEW=${(BigInt(everyoneRole.permissions) & 1024n) ? 'YES' : 'NO'} raw=${everyoneRole.permissions}`);
  console.log(`Fruits    (${FRUITS}): VIEW=${(BigInt(fruitsRole.permissions) & 1024n) ? 'YES' : 'NO'}`);
  console.log(`Unverified(${UNVERIFIED}): VIEW=${(BigInt(unverifiedRole.permissions) & 1024n) ? 'YES' : 'NO'}`);
  console.log(`RuleReader(${RULE_READER}): VIEW=${ruleReaderRole ? (BigInt(ruleReaderRole.permissions) & 1024n) ? 'YES' : 'NO' : 'ROLE NOT FOUND'}`);

  console.log('\n=== CHANNEL OVERWRITES (RAW) ===');
  for (const id of targetChannels) {
    const ch = channels.find(c => c.id === id);
    if (!ch) { console.log(`${id}: NOT FOUND`); continue; }
    const cat = ch.parent_id ? channels.find(c => c.id === ch.parent_id) : null;
    console.log(`\n[${ch.name}] (type=${ch.type}, parent=${cat?.name || 'none'})`);
    const ows = ch.permission_overwrites || [];
    if (ows.length === 0) console.log('  (no overwrites)');
    for (const ow of ows) {
      const label = ow.id === EVERYONE ? '@everyone' : ow.id === UNVERIFIED ? 'UNVERIFIED' : ow.id === FRUITS ? 'FRUITS' : ow.id === RULE_READER ? 'RULE_READER' : `role:${ow.id}`;
      const aView = (BigInt(ow.allow) & 1024n) ? 'ALLOW_VIEW' : '';
      const dView = (BigInt(ow.deny) & 1024n) ? 'DENY_VIEW' : '';
      console.log(`  ${label}: ${aView || '-'} / ${dView || '-'} | raw allow=${ow.allow}, deny=${ow.deny}`);
    }

    // Simulated effective perms for @everyone alone (pending member, no roles assigned yet)
    console.log('  --- Simulation ---');
    for (const [label, roleIds] of [
      ['@everyone only', [EVERYONE]],
      ['@everyone + Fruits', [EVERYONE, FRUITS]],
      ['@everyone + Unverified', [EVERYONE, UNVERIFIED]],
      ['@everyone + RuleReader', [EVERYONE, RULE_READER]],
    ]) {
      // Base = union of role perms
      let perms = 0n;
      for (const rid of roleIds) {
        const r = guild.roles.find(ro => ro.id === rid);
        if (r) perms |= BigInt(r.permissions);
      }
      // Category overwrites
      if (cat) {
        const catOws = cat.permission_overwrites || [];
        // @everyone category
        const catEv = catOws.find(o => o.id === EVERYONE);
        if (catEv) perms = (perms & ~BigInt(catEv.deny)) | BigInt(catEv.allow);
        // Role-specific category overwrites
        for (const rid of roleIds.filter(r => r !== EVERYONE)) {
          const catRo = catOws.find(o => o.id === rid);
          if (catRo) perms = (perms & ~BigInt(catRo.deny)) | BigInt(catRo.allow);
        }
      }
      // Channel @everyone overwrite
      const chEv = ows.find(o => o.id === EVERYONE);
      if (chEv) perms = (perms & ~BigInt(chEv.deny)) | BigInt(chEv.allow);
      // Channel role-specific overwrites
      for (const rid of roleIds.filter(r => r !== EVERYONE)) {
        const chRo = ows.find(o => o.id === rid);
        if (chRo) perms = (perms & ~BigInt(chRo.deny)) | BigInt(chRo.allow);
      }
      console.log(`  ${(perms & 1024n) ? '✅ VISIBLE' : '❌ HIDDEN'} for ${label}`);
    }
  }

  console.log('\n=== ONBOARDING ===');
  console.log(`mode=${onboarding.mode}, enabled=${onboarding.enabled}`);
  const defaults = new Set(onboarding.default_channel_ids || []);
  for (const id of targetChannels) {
    const ch = channels.find(c => c.id === id);
    console.log(`  ${ch?.name || id}: ${defaults.has(id) ? '✅ in defaults' : '❌ NOT in defaults'}`);
  }
  console.log('\nPrompt option channel_ids (looking for conflicts):');
  for (const p of onboarding.prompts || []) {
    for (const opt of p.options || []) {
      if ((opt.channel_ids || []).some(id => targetChannels.includes(id))) {
        console.log(`  ⚠️  "${p.title}" > "${opt.title}": ${opt.channel_ids.filter(id => targetChannels.includes(id))}`);
      }
    }
  }
}
main().catch(e => console.error(e.response?.data || e.message));
