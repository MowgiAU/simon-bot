/**
 * test-patcher-pipeline.ts — End-to-end test: download FLP, parse, verify Patcher data.
 */
import { readFileSync, writeFileSync } from 'fs';

// Import FLPParser
const { FLPParser } = await import('../src/bot/utils/FLPParser.js');

const FLP_URL = 'https://cdn.fujistud.io/tracks/cmngsrswp003z81uzuogesth4/project/project-1775093388834-668983257.flp';

console.log('Downloading FLP...');
const resp = await fetch(FLP_URL);
if (!resp.ok) throw new Error(`Failed to download: ${resp.status}`);
const flpBuf = Buffer.from(await resp.arrayBuffer());
console.log(`Downloaded ${flpBuf.length} bytes`);

console.log('Parsing FLP...');
const result = FLPParser.parse(flpBuf) as any;

console.log(`\nBPM: ${result.bpm}`);
console.log(`Channel Rack: ${result.channelRack.length} channels`);
console.log(`Mixer Tracks: ${result.mixerTracks.length} tracks`);
console.log(`Patcher Instances: ${result.patcherInstances?.length ?? 0}`);

if (result.patcherInstances && result.patcherInstances.length > 0) {
    for (const inst of result.patcherInstances) {
        console.log(`\n═══ Patcher: ${inst.label} (${inst.key}) ═══`);
        console.log(`  Nodes: ${inst.nodes.length}`);
        for (const node of inst.nodes) {
            console.log(`    [${node.type.padEnd(10)}] ${node.name} @ (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) id=${node.id}`);
        }
        console.log(`  Connections: ${inst.connections.length}`);
        for (const conn of inst.connections) {
            const fromNode = inst.nodes.find((n: any) => n.id === conn.from);
            const toNode = inst.nodes.find((n: any) => n.id === conn.to);
            console.log(`    ${fromNode?.name || conn.from} → ${toNode?.name || conn.to} [${conn.type}]`);
        }
    }
} else {
    console.log('\n❌ No Patcher instances found!');

    // Debug: check if any channels are Patcher
    const patcherChannels = result.channelRack.filter((ch: any) => ch.isPatcher);
    console.log(`Patcher channels in rack: ${patcherChannels.length}`);
    for (const ch of patcherChannels) {
        console.log(`  Channel ${ch.index}: ${ch.name} (${ch.pluginName})`);
    }
}

// Also write the full result to a file for inspection
writeFileSync('test-pipeline-output.json', JSON.stringify(result.patcherInstances, null, 2));
console.log('\nWrote patcherInstances to test-pipeline-output.json');
