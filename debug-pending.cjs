const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const guildId = '955342751669551165';
const headers = { Authorization: `Bot ${token}` };
const base = 'https://discord.com/api/v10';

const UNVERIFIED = '1487473716634980515';
const EVERYONE = guildId;
const FRUITS = '957213932655894528'; // verified role
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

  const everyoneRole = guild.roles.find(r => r.id === EVERYONE);
  const basePerm = BigInt(everyoneRole.permissions);
  console.log('@everyone base VIEW_CHANNEL:', (basePerm & 1024n) ? 'YES' : 'NO');

  // Scenario: member only has @everyone (pending, pre-bot-assign)
  console.log('\n=== PENDING MEMBER (only @everyone, no unverified role yet) ===');
  for (const id of targetChannels) {
    const ch = channels.find(c => c.id === id);
    if (!ch) { console.log(`${id}: NOT FOUND`); continue; }
    const ows = ch.permission_overwrites || [];

    // Check category overwrites first
    let inheritedAllow = 0n, inheritedDeny = 0n;
    if (ch.parent_id) {
      const cat = channels.find(c => c.id === ch.parent_id);
      if (cat) {
        const catOws = cat.permission_overwrites || [];
        // Apply @everyone to category
        const catEv = catOws.find(o => o.id === EVERYONE);
        if (catEv) {
          inheritedAllow = BigInt(catEv.allow);
          inheritedDeny = BigInt(catEv.deny);
        }
      }
    }

    let perms = basePerm;
    // Category @everyone overwrite
    perms = (perms & ~inheritedDeny) | inheritedAllow;
    // Channel @everyone overwrite
    const chEv = ows.find(o => o.id === EVERYONE);
    if (chEv) perms = (perms & ~BigInt(chEv.deny)) | BigInt(chEv.allow);

    const visible = (perms & 1024n) ? 'VISIBLE' : 'HIDDEN';
    console.log(`[${visible}] ${ch.name} (type=${ch.type})`);
    console.log(`  cat @everyone ow: allow=${(inheritedAllow & 1024n) ? 'VIEW' : '-'}, deny=${(inheritedDeny & 1024n) ? 'VIEW' : '-'}`);
    if (chEv) console.log(`  ch @everyone ow: allow=${(BigInt(chEv.allow) & 1024n) ? 'VIEW' : '-'}, deny=${(BigInt(chEv.deny) & 1024n) ? 'VIEW' : '-'}`);
    else console.log(`  ch @everyone ow: none`);
    
    // Show all overwrites
    console.log('  ALL overwrites:');
    for (const ow of ows) {
      const label = ow.id === EVERYONE ? '@everyone' : ow.id === UNVERIFIED ? 'UNVERIFIED' : ow.id === FRUITS ? 'FRUITS' : ow.id === RULE_READER ? 'RULE_READER' : ow.id;
      console.log(`    ${label}: allow=${(BigInt(ow.allow) & 1024n) ? 'VIEW' : '0'}, deny=${(BigInt(ow.deny) & 1024n) ? 'VIEW' : '0'} | raw allow=${ow.allow}, deny=${ow.deny}`);
    }
    console.log();
  }

  // Also check "news" channel to see why it IS visible
  console.log('\n=== NEWS CHANNEL (visible to pending?) ===');
  const newsLike = channels.filter(c => c.name?.toLowerCase().includes('news') || c.name?.toLowerCase().includes('announcement'));
  for (const ch of newsLike.slice(0, 3)) {
    const ows = ch.permission_overwrites || [];
    const chEv = ows.find(o => o.id === EVERYONE);
    const cat = ch.parent_id ? channels.find(c => c.id === ch.parent_id) : null;
    const catEv = cat ? (cat.permission_overwrites || []).find(o => o.id === EVERYONE) : null;
    console.log(`${ch.name} (parent: ${cat?.name || 'none'})`);
    console.log(`  cat @everyone ow: ${catEv ? `allow=${(BigInt(catEv.allow)&1024n)?'VIEW':'-'}, deny=${(BigInt(catEv.deny)&1024n)?'VIEW':'-'}` : 'none'}`);
    console.log(`  ch  @everyone ow: ${chEv ? `allow=${(BigInt(chEv.allow)&1024n)?'VIEW':'-'}, deny=${(BigInt(chEv.deny)&1024n)?'VIEW':'-'}` : 'none'}`);
    const unvOw = ows.find(o => o.id === UNVERIFIED);
    console.log(`  ch  UNVERIFIED ow: ${unvOw ? `allow=${(BigInt(unvOw.allow)&1024n)?'VIEW':'-'}, deny=${(BigInt(unvOw.deny)&1024n)?'VIEW':'-'}` : 'none'}`);
    console.log();
  }
}
main().catch(e => console.error(e.response?.data || e.message));
