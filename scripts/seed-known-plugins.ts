/**
 * Seeds the plugin registry (KnownPlugin) with the plugins producers use most.
 *
 * Matching is by `name` or any `aliases` entry, case-insensitive, against the plugin name a
 * project reports — so aliases carry the spellings hosts use ("OTT_x64", "Kontakt 8",
 * "ValhallaSupermassive"). Descriptions are written for Fuji Studio, not copied from vendors.
 *
 * Existing entries are left alone: a plugin already in the registry is skipped, so anything
 * edited in the dashboard stays as it is. Images aren't set here — upload them on the
 * Plugin Registry page (the script prints which entries still need one).
 *
 *   npx tsx scripts/seed-known-plugins.ts           # add what's missing
 *   npx tsx scripts/seed-known-plugins.ts --dry     # just show what it would add
 */
import { PrismaClient } from '@prisma/client';

interface Seed {
    name: string;
    aliases?: string[];
    developer: string;
    category: string;
    link: string;
    description: string;
}

const PLUGINS: Seed[] = [
    // ── Synths ────────────────────────────────────────────────────────────────
    { name: 'Serum 2', aliases: ['Serum2'], developer: 'Xfer Records', category: 'synth', link: 'https://xferrecords.com/products/serum-2', description: 'The second generation of the wavetable synth that became a modern standard, adding new synthesis types and a deeper effects section.' },
    { name: 'Vital', aliases: ['Vital Audio Vital', 'Vitalium'], developer: 'Vital Audio', category: 'synth', link: 'https://vital.audio', description: 'A spectral wavetable synth with free and paid tiers, known for its visual modulation and warping tools.' },
    { name: 'Massive', developer: 'Native Instruments', category: 'synth', link: 'https://www.native-instruments.com/en/products/komplete/synths/massive/', description: 'The wavetable synth behind countless bass and lead sounds of the 2010s, still a staple for aggressive patches.' },
    { name: 'Massive X', developer: 'Native Instruments', category: 'synth', link: 'https://www.native-instruments.com/en/products/komplete/synths/massive-x/', description: 'The rebuilt Massive, with a flexible routing system and a much larger modulation engine.' },
    { name: 'Sylenth1', developer: 'LennarDigital', category: 'synth', link: 'https://www.lennardigital.com/sylenth1/', description: 'A four-oscillator virtual analog synth valued for its clean, powerful sound and low CPU use.' },
    { name: 'Spire', developer: 'Reveal Sound', category: 'synth', link: 'https://revealsound.com', description: 'A virtual analog and wavetable hybrid popular in trance, house and bass music.' },
    { name: 'Omnisphere', aliases: ['Omnisphere 2'], developer: 'Spectrasonics', category: 'synth', link: 'https://www.spectrasonics.net/products/omnisphere/', description: 'A huge hybrid synth and sample library, from cinematic textures to hardware synth recreations.' },
    { name: 'Diva', aliases: ['u-he Diva'], developer: 'u-he', category: 'synth', link: 'https://u-he.com/products/diva/', description: 'An analog-modelling synth that recreates circuits from classic hardware, at the cost of some CPU.' },
    { name: 'Hive', aliases: ['Hive 2'], developer: 'u-he', category: 'synth', link: 'https://u-he.com/products/hive/', description: 'A fast, light synth with a single-screen layout aimed at quick sound design.' },
    { name: 'Zebra', aliases: ['Zebra2', 'ZebraHZ'], developer: 'u-he', category: 'synth', link: 'https://u-he.com/products/zebra2/', description: 'A modular-feeling synth used widely in film scoring for its evolving, complex patches.' },
    { name: 'Pigments', developer: 'Arturia', category: 'synth', link: 'https://www.arturia.com/products/software-instruments/pigments/overview', description: 'A colourful multi-engine synth combining virtual analog, wavetable, sample and granular sound sources.' },
    { name: 'Phase Plant', developer: 'Kilohearts', category: 'synth', link: 'https://kilohearts.com/products/phase_plant', description: 'A modular synth built from snap-in generators and effects, so patches can be as simple or deep as you like.' },
    { name: 'Avenger', aliases: ['Avenger 2'], developer: 'Vengeance Sound', category: 'synth', link: 'https://vengeance-sound.com', description: 'A large preset-driven synth workstation with arps, sequencers and a big factory library.' },
    { name: 'Nexus', aliases: ['Nexus 4', 'reFX Nexus'], developer: 'reFX', category: 'synth', link: 'https://refx.com/nexus/', description: 'A ROMpler built for fast results, with a huge library of ready-made production sounds.' },
    { name: 'Sytrus', developer: 'Image-Line', category: 'synth', link: 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Sytrus.htm', description: 'FL Studio\'s FM and subtractive hybrid synth, capable of everything from bells to basses.' },
    { name: 'Harmor', developer: 'Image-Line', category: 'synth', link: 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Harmor.htm', description: 'An additive synth in FL Studio that can also resynthesize audio and images into sound.' },
    { name: 'TAL-U-NO-LX', developer: 'TAL Software', category: 'synth', link: 'https://tal-software.com/products/tal-u-no-lx', description: 'A faithful recreation of the Juno-60, including its much-loved chorus.' },
    { name: 'Analog Lab', aliases: ['Analog Lab V', 'Analog Lab Pro'], developer: 'Arturia', category: 'synth', link: 'https://www.arturia.com/products/software-instruments/analoglab/overview', description: 'A browser for Arturia\'s vintage keyboard and synth recreations, with the most useful controls on one page.' },

    // ── Samplers and instruments ──────────────────────────────────────────────
    { name: 'Kontakt', aliases: ['Kontakt 8', 'Kontakt 7', 'Kontakt 6', 'Kontakt 5'], developer: 'Native Instruments', category: 'sampler', link: 'https://www.native-instruments.com/en/products/komplete/samplers/kontakt-8/', description: 'The industry-standard sampler that hosts thousands of third-party libraries, from orchestras to drum kits.' },
    { name: 'Battery 4', aliases: ['Battery'], developer: 'Native Instruments', category: 'drums', link: 'https://www.native-instruments.com/en/products/komplete/drums/battery-4/', description: 'A cell-based drum sampler built for layering and shaping kits quickly.' },
    { name: 'Falcon', aliases: ['UVI Falcon'], developer: 'UVI', category: 'sampler', link: 'https://www.uvi.net/falcon', description: 'A hybrid instrument combining sampling with many synthesis engines and a deep modular layer.' },
    { name: 'LABS', aliases: ['Spitfire LABS'], developer: 'Spitfire Audio', category: 'instrument', link: 'https://labs.spitfireaudio.com', description: 'A free, growing collection of sampled instruments, from strings and choirs to unusual textures.' },
    { name: 'Addictive Drums 2', aliases: ['Addictive Drums'], developer: 'XLN Audio', category: 'drums', link: 'https://www.xlnaudio.com/products/addictive_drums_2', description: 'A drum instrument with studio-recorded kits and fast mixing controls.' },
    { name: 'Addictive Keys', developer: 'XLN Audio', category: 'instrument', link: 'https://www.xlnaudio.com/products/addictive_keys', description: 'Sampled pianos and keyboards with quick, musical mix presets.' },
    { name: 'Superior Drummer 3', developer: 'Toontrack', category: 'drums', link: 'https://www.toontrack.com/product/superior-drummer-3/', description: 'A large-format acoustic drum production tool with full multi-microphone control.' },
    { name: 'EZdrummer 3', aliases: ['EZdrummer'], developer: 'Toontrack', category: 'drums', link: 'https://www.toontrack.com/product/ezdrummer-3/', description: 'Acoustic drums with a simple workflow and a big library of playable grooves.' },
    { name: 'Sitala', developer: 'Decomposer', category: 'drums', link: 'https://decomposer.de/sitala/', description: 'A free, straightforward drum sampler with 16 pads and just the essential controls.' },
    { name: 'FPC', developer: 'Image-Line', category: 'drums', link: 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/FPC.htm', description: 'FL Studio\'s pad-based drum machine, with kits mapped across 16 pads.' },
    { name: 'Slicex', developer: 'Image-Line', category: 'sampler', link: 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Slicex.htm', description: 'Slices loops at their transients so each hit can be played, reordered or processed on its own.' },

    // ── Mixing: EQ, dynamics, mastering ───────────────────────────────────────
    { name: 'Pro-Q 4', aliases: ['FabFilter Pro-Q 4', 'Pro-Q 3', 'Pro-Q3', 'FabFilter Pro-Q 3'], developer: 'FabFilter', category: 'eq', link: 'https://www.fabfilter.com/products/pro-q-3-equalizer-plug-in', description: 'A precise, transparent EQ with dynamic bands and a display that makes problem frequencies easy to spot.' },
    { name: 'Pro-C 2', aliases: ['FabFilter Pro-C 2'], developer: 'FabFilter', category: 'compressor', link: 'https://www.fabfilter.com/products/pro-c-2-compressor-plug-in', description: 'A compressor with several character styles, clear metering and full sidechain control.' },
    { name: 'Pro-L 2', aliases: ['FabFilter Pro-L 2'], developer: 'FabFilter', category: 'compressor', link: 'https://www.fabfilter.com/products/pro-l-2-limiter-plug-in', description: 'A mastering limiter with multiple loudness styles and detailed level metering.' },
    { name: 'Pro-R 2', aliases: ['FabFilter Pro-R', 'Pro-R'], developer: 'FabFilter', category: 'reverb', link: 'https://www.fabfilter.com/products/pro-r-2-reverb-plug-in', description: 'A reverb controlled in musical terms, with EQ-style shaping of the tail.' },
    { name: 'Pro-MB', aliases: ['FabFilter Pro-MB'], developer: 'FabFilter', category: 'compressor', link: 'https://www.fabfilter.com/products/pro-mb-multiband-compressor-plug-in', description: 'Multiband compression and expansion with dynamic bands you can place only where needed.' },
    { name: 'Saturn 2', aliases: ['FabFilter Saturn 2', 'Saturn'], developer: 'FabFilter', category: 'distortion', link: 'https://www.fabfilter.com/products/saturn-2-multiband-distortion-saturation-plug-in', description: 'Multiband saturation and distortion, from gentle warmth to heavy destruction, with modulation.' },
    { name: 'soothe2', aliases: ['soothe 2', 'soothe2 '], developer: 'oeksound', category: 'effect', link: 'https://oeksound.com/plugins/soothe2/', description: 'A dynamic resonance suppressor that tames harshness as it happens, rather than with static EQ cuts.' },
    { name: 'spiff', developer: 'oeksound', category: 'effect', link: 'https://oeksound.com/plugins/spiff/', description: 'A transient processor that works per frequency band, for adding or removing attack surgically.' },
    { name: 'Trackspacer', developer: 'Wavesfactory', category: 'effect', link: 'https://www.wavesfactory.com/audio-plugins/trackspacer/', description: 'Carves space in one track using the live spectrum of another, a smarter form of ducking.' },
    { name: 'Ozone', aliases: ['Ozone 11', 'Ozone 10', 'iZotope Ozone'], developer: 'iZotope', category: 'effect', link: 'https://www.izotope.com/en/products/ozone.html', description: 'A mastering suite with EQ, dynamics, imaging and limiting, plus assistive starting points.' },
    { name: 'Neutron', aliases: ['Neutron 5', 'Neutron 4'], developer: 'iZotope', category: 'effect', link: 'https://www.izotope.com/en/products/neutron.html', description: 'A mixing suite that analyses tracks and suggests EQ, compression and balance moves.' },
    { name: 'RX', aliases: ['RX 11', 'RX 10', 'iZotope RX'], developer: 'iZotope', category: 'utility', link: 'https://www.izotope.com/en/products/rx.html', description: 'Audio repair for noise, clicks, hum and bleed — the standard tool for cleaning up recordings.' },
    { name: 'CLA-76', aliases: ['CLA-76 Stereo', 'CLA-76 Mono'], developer: 'Waves', category: 'compressor', link: 'https://www.waves.com/plugins/cla-76-compressor-limiter', description: 'A recreation of the classic FET compressor, known for fast, punchy results on drums and vocals.' },
    { name: 'CLA-2A', developer: 'Waves', category: 'compressor', link: 'https://www.waves.com/plugins/cla-2a-compressor-limiter', description: 'An optical compressor model that smooths vocals and bass with a gentle, musical response.' },
    { name: 'H-Delay', aliases: ['H-Delay Stereo'], developer: 'Waves', category: 'delay', link: 'https://www.waves.com/plugins/h-delay-hybrid-delay', description: 'A hybrid delay with analog-style character, plus lo-fi and modulation options.' },
    { name: 'smart:EQ', aliases: ['smart:EQ 4', 'smart:EQ 3'], developer: 'sonible', category: 'eq', link: 'https://www.sonible.com/smarteq4/', description: 'An EQ that profiles a track and evens out its tone automatically before you fine-tune.' },
    { name: 'Fresh Air', developer: 'Slate Digital', category: 'effect', link: 'https://slatedigital.com/fresh-air/', description: 'A free two-knob high-frequency exciter for adding air and presence.' },

    // ── Reverb, delay and space ───────────────────────────────────────────────
    { name: 'ValhallaVintageVerb', aliases: ['Valhalla VintageVerb', 'VintageVerb'], developer: 'Valhalla DSP', category: 'reverb', link: 'https://valhalladsp.com/shop/reverb/valhalla-vintage-verb/', description: 'A reverb modelled on classic digital units, with era modes that colour the tail.' },
    { name: 'ValhallaSupermassive', aliases: ['Valhalla Supermassive', 'Supermassive'], developer: 'Valhalla DSP', category: 'reverb', link: 'https://valhalladsp.com/shop/reverb/valhalla-supermassive/', description: 'A free delay and reverb for huge, washed-out spaces and long evolving tails.' },
    { name: 'ValhallaRoom', aliases: ['Valhalla Room'], developer: 'Valhalla DSP', category: 'reverb', link: 'https://valhalladsp.com/shop/reverb/valhalla-room/', description: 'A natural-sounding room and hall reverb suited to realistic spaces.' },
    { name: 'ValhallaDelay', aliases: ['Valhalla Delay'], developer: 'Valhalla DSP', category: 'delay', link: 'https://valhalladsp.com/shop/delay/valhalla-delay/', description: 'A delay covering tape, BBD, digital and pitch-shifted styles.' },
    { name: 'ValhallaFreqEcho', aliases: ['Valhalla FreqEcho', 'FreqEcho'], developer: 'Valhalla DSP', category: 'delay', link: 'https://valhalladsp.com/shop/delay/valhalla-freq-echo/', description: 'A free frequency-shifting echo for strange, spiralling repeats.' },
    { name: 'Raum', developer: 'Native Instruments', category: 'reverb', link: 'https://www.native-instruments.com/en/products/komplete/effects/raum/', description: 'A creative reverb ranging from tight rooms to enormous, unstable spaces.' },
    { name: 'Replika', aliases: ['Replika XT'], developer: 'Native Instruments', category: 'delay', link: 'https://www.native-instruments.com/en/products/komplete/effects/replika-xt/', description: 'A delay with several engines, from clean digital to diffused and analog-style repeats.' },
    { name: 'EchoBoy', developer: 'Soundtoys', category: 'delay', link: 'https://www.soundtoys.com/product/echoboy/', description: 'A delay with a deep collection of vintage echo styles and character controls.' },
    { name: 'Crystallizer', developer: 'Soundtoys', category: 'effect', link: 'https://www.soundtoys.com/product/crystallizer/', description: 'A granular echo and pitch shifter for shimmering, reversed and cascading textures.' },
    { name: 'MicroShift', developer: 'Soundtoys', category: 'effect', link: 'https://www.soundtoys.com/product/microshift/', description: 'A stereo widener based on classic pitch-shift doubling, often used on vocals.' },

    // ── Character, distortion and modulation ──────────────────────────────────
    { name: 'Decapitator', developer: 'Soundtoys', category: 'distortion', link: 'https://www.soundtoys.com/product/decapitator/', description: 'An analog saturation modeller offering five distinct styles of drive and colour.' },
    { name: 'RC-20 Retro Color', aliases: ['RC-20'], developer: 'XLN Audio', category: 'effect', link: 'https://www.xlnaudio.com/products/rc-20_retro_color', description: 'A character effect combining noise, wobble, distortion and other lo-fi textures.' },
    { name: 'OTT', aliases: ['OTT_x64', 'Xfer OTT'], developer: 'Xfer Records', category: 'compressor', link: 'https://xferrecords.com/freeware', description: 'A free multiband upward and downward compressor, a staple for aggressive, bright bass and drums.' },
    { name: 'LFOTool', aliases: ['LFO Tool', 'Xfer LFOTool'], developer: 'Xfer Records', category: 'modulation', link: 'https://xferrecords.com/products/lfo-tool', description: 'Shapes volume, filter and pan with drawable LFO curves — the usual way to build sidechain pumping.' },
    { name: 'ShaperBox', aliases: ['ShaperBox 3', 'ShaperBox 2', 'Cableguys ShaperBox'], developer: 'Cableguys', category: 'modulation', link: 'https://www.cableguys.com/shaperbox', description: 'A set of rhythmic shapers for volume, filter, pan, width and more, all driven by drawn curves.' },
    { name: 'VolumeShaper', aliases: ['VolumeShaper 6'], developer: 'Cableguys', category: 'modulation', link: 'https://www.cableguys.com/volumeshaper', description: 'A dedicated volume shaper for sidechain-style ducking and rhythmic gating.' },
    { name: 'Kickstart', aliases: ['Kickstart 2'], developer: 'Nicky Romero', category: 'modulation', link: 'https://www.nickyromero.com/kickstart/', description: 'A one-knob sidechain effect for instant pumping without routing a compressor.' },
    { name: 'Gross Beat', developer: 'Image-Line', category: 'effect', link: 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Gross%20Beat.htm', description: 'Real-time time and volume manipulation for stutters, scratches, gating and tape stops.' },
    { name: 'Effectrix', aliases: ['Effectrix 2'], developer: 'Sugar Bytes', category: 'effect', link: 'https://sugar-bytes.de/effectrix', description: 'A sequenced multi-effect that paints stutters, reverses, filters and more onto a grid.' },
    { name: 'Portal', developer: 'Output', category: 'effect', link: 'https://output.com/products/portal', description: 'A granular effect that shatters sounds into clouds, rhythms and textures.' },
    { name: 'Manipulator', developer: 'Polyverse', category: 'effect', link: 'https://polyversemusic.com/products/manipulator/', description: 'A vocal and sound transformer for extreme pitch, formant and character changes.' },
    { name: 'Gatekeeper', developer: 'Polyverse', category: 'modulation', link: 'https://polyversemusic.com/products/gatekeeper/', description: 'A precise volume gate driven by drawn envelopes, for sharp rhythmic chopping.' },
    { name: 'The Sausage Fattener', aliases: ['Sausage Fattener'], developer: 'Dada Life', category: 'distortion', link: 'https://www.dadalife.com/plugins/', description: 'Two knobs of fatness and colour for quick, loud, thick results.' },

    // ── Vocals and tuning ─────────────────────────────────────────────────────
    { name: 'Auto-Tune', aliases: ['Auto-Tune Pro', 'Auto-Tune Pro X', 'Antares Auto-Tune'], developer: 'Antares', category: 'utility', link: 'https://www.antarestech.com/products/auto-tune-pro', description: 'The best-known pitch correction tool, used both transparently and as the hard-tuned vocal effect.' },
    { name: 'Melodyne', aliases: ['Melodyne 5', 'Celemony Melodyne'], developer: 'Celemony', category: 'utility', link: 'https://www.celemony.com/en/melodyne/what-is-melodyne', description: 'Detailed pitch and timing editing, including separate notes inside chords.' },
    { name: 'Little AlterBoy', developer: 'Soundtoys', category: 'effect', link: 'https://www.soundtoys.com/product/little-alterboy/', description: 'Quick vocal pitch, formant and robot-voice transformations.' },
    { name: 'VocalSynth 2', aliases: ['VocalSynth'], developer: 'iZotope', category: 'effect', link: 'https://www.izotope.com/en/products/vocalsynth.html', description: 'Vocoder, talkbox and polyvox effects for stacked, synthetic vocal treatments.' },
    { name: 'Pro-DS', aliases: ['FabFilter Pro-DS'], developer: 'FabFilter', category: 'utility', link: 'https://www.fabfilter.com/products/pro-ds-de-esser-plug-in', description: 'A de-esser that targets sibilance while leaving the rest of the vocal alone.' },
];

async function main() {
    const dry = process.argv.includes('--dry');
    const db = new PrismaClient();
    try {
        const existing = await db.knownPlugin.findMany({ select: { name: true } });
        const have = new Set(existing.map((p) => p.name.trim().toLowerCase()));
        const missing = PLUGINS.filter((p) => !have.has(p.name.trim().toLowerCase()));

        console.log(`Registry has ${existing.length} plugins; ${missing.length} of ${PLUGINS.length} in this list are new.`);
        if (dry) {
            missing.forEach((p) => console.log(`  + ${p.name} (${p.developer})`));
            return;
        }
        for (const p of missing) {
            await db.knownPlugin.create({
                data: {
                    name: p.name,
                    aliases: p.aliases ?? [],
                    displayName: p.name,
                    developer: p.developer,
                    category: p.category,
                    link: p.link,
                    description: p.description,
                },
            });
            console.log(`  + ${p.name}`);
        }
        const noImage = await db.knownPlugin.findMany({ where: { imageUrl: null }, select: { name: true }, orderBy: { name: 'asc' } });
        console.log(`\nAdded ${missing.length}. Still without an image (${noImage.length}):`);
        console.log(noImage.map((p) => `  · ${p.name}`).join('\n'));
    } finally {
        await db.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
