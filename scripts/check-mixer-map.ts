import { FLPParser } from '../src/bot/utils/FLPParser.js';

const FLP_URL = 'https://cdn.fujistud.io/tracks/cmngsrswp003z81uzuogesth4/project/project-1775093388834-668983257.flp';
const resp = await fetch(FLP_URL);
const buf = Buffer.from(await resp.arrayBuffer());
const result = FLPParser.parse(buf) as any;

console.log('=== Channel Rack (Patcher channels) ===');
for (const ch of result.channelRack) {
    if (ch.isPatcher) console.log(`  Ch ${ch.index}: "${ch.name}" plugin="${ch.pluginName}" targetMixer=${ch.targetMixerTrack}`);
}

console.log('\n=== ALL Mixer Tracks ===');
for (const mt of result.mixerTracks) {
    console.log(`  Mixer ${mt.index}: "${mt.name}" slots=[${mt.slots.map((s: any) => s.pluginName).join(', ')}]`);
}

console.log('\n=== Patcher Instances ===');
for (const p of result.patcherInstances) {
    console.log(`  key="${p.key}" label="${p.label}" nodes=${p.nodes.length} conns=${p.connections.length}`);
}
