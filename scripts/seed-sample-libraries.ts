/**
 * Seeds sample libraries (Kontakt and friends) into the plugin registry, as category 'library'.
 *
 * A library isn't a plugin — Kontakt is the plugin, the library is the content it loads — but the
 * registry is where the converter looks them up: a Kontakt instance's saved state doesn't say which
 * library it wants, so the converter matches the names around it (track name, the user's rename of
 * the device, nearby preset names) against these entries, and the report names the library.
 *
 *   npx tsx scripts/seed-sample-libraries.ts [--dry]
 *
 * Adds what's missing and leaves existing entries alone.
 */
import { PrismaClient } from '@prisma/client';

interface Seed { name: string; aliases?: string[]; developer: string; link?: string; description: string }

const LIBRARIES: Seed[] = [
    // ── Native Instruments' own Kontakt content ──
    { name: 'Kontakt Factory Library', aliases: ['Factory Library', 'Kontakt Factory'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/samplers/kontakt-8/', description: 'The general-purpose bank that ships with Kontakt — band, orchestral, synth and vintage instruments.' },
    { name: 'Studio Drummer', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/drums/studio-drummer/', description: 'Three production-ready acoustic kits with multiple mic positions and a large groove library.' },
    { name: 'Abbey Road Drummer', aliases: ['Abbey Road 60s Drummer', 'Abbey Road 70s Drummer', 'Abbey Road 80s Drummer', 'Abbey Road Modern Drummer', 'Abbey Road Vintage Drummer'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/catalog/komplete/drums/', description: 'Decade-themed drum kits recorded in Abbey Road Studio Two, with era-correct mics and grooves.' },
    { name: 'Session Guitarist', aliases: ['Electric Sunburst', 'Electric Mint', 'Electric Vintage', 'Electric Neon', 'Picked Acoustic', 'Strummed Acoustic', 'Strummed Acoustic 2', 'Session Guitarist Electric Sunburst Deluxe'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/catalog/komplete/guitar/', description: 'Played-in guitar patterns and single notes — strums, picking and phrases that follow your chords.' },
    { name: 'Session Strings Pro 2', aliases: ['Session Strings', 'Session Strings Pro'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/cinematic/session-strings-pro-2/', description: 'A small string section for pop and film work, with animator phrases and close mic control.' },
    { name: 'Session Horns Pro', aliases: ['Session Horns'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/cinematic/session-horns-pro/', description: 'A brass section with arranger phrases, from tight funk stabs to full horn lines.' },
    { name: 'Scarbee', aliases: ['Scarbee Funk Guitarist', 'Scarbee MM-Bass', 'Scarbee Rickenbacker Bass', 'Scarbee Jay-Bass', 'Scarbee Pre-Bass', 'Scarbee Clavinet', 'Scarbee Mark I', 'Scarbee A-200'], developer: 'Scarbee / Native Instruments', link: 'https://www.native-instruments.com/en/catalog/komplete/bass/', description: 'Deeply sampled electric basses and vintage keys, known for their playability and fingering detail.' },
    { name: 'Noire', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/keys/noire/', description: 'A Yamaha CFX grand recorded with Nils Frahm, with a felt setting and particle effects.' },
    { name: 'Una Corda', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/keys/una-corda/', description: 'A single-string upright piano built with David Klavins — intimate, close and slightly fragile.' },
    { name: 'The Giant', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/keys/the-giant/', description: "The world's largest upright piano, sampled with both standard and prepared playing." },
    { name: "Alicia's Keys", developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/keys/alicias-keys/', description: "Alicia Keys' own Yamaha C3 Neo, sampled in her studio with her playing style in mind." },
    { name: 'Action Strikes', aliases: ['Action Strings', 'Action Strings 2'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/catalog/komplete/cinematic/', description: 'Cinematic ensemble percussion and string runs built for trailer-style rhythmic writing.' },
    { name: 'Ethereal Earth', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/cinematic/ethereal-earth/', description: 'Organic and electronic hybrids — acoustic instruments blended with processed textures.' },
    { name: 'Straylight', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/cinematic/straylight/', description: 'A granular engine for evolving pads and atmospheres built from sampled sources.' },
    { name: 'Pharlight', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/cinematic/pharlight/', description: 'Granular choir and voice textures, from airy beds to fractured vocal shards.' },
    { name: 'Mysteria', developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/cinematic/mysteria/', description: 'A choir-based tension instrument for eerie clusters, whispers and swells.' },
    { name: 'Battery Factory Library', aliases: ['Battery 4 Factory'], developer: 'Native Instruments', link: 'https://www.native-instruments.com/en/products/komplete/drums/battery-4/', description: "Battery's own kit library — the drum cells that ship with the sampler." },

    // ── Widely used third-party Kontakt libraries ──
    { name: 'UmanskyBass', aliases: ['Umansky Bass', 'Umansky'], developer: 'Submission Audio', link: 'https://www.submissionaudio.com/products/umanskybass', description: 'A Dingwall bass sampled by Jacob Umansky of Intervals — 17 articulations with clean, grit and heavy tones.' },
    { name: 'Appex - Modern Trailer Guitar', aliases: ['Appex', 'Modern Trailer Guitar'], developer: 'Keepforest', link: 'https://keepforest.com/', description: 'Aggressive processed guitar textures and rhythms built for trailer and hybrid scoring.' },
    { name: 'Damage 2', aliases: ['Damage'], developer: 'Heavyocity', link: 'https://heavyocity.com/product/damage-2/', description: 'Cinematic percussion and loops — distorted kits, risers and rhythmic suites.' },
    { name: 'Gravity', aliases: ['Heavyocity Gravity'], developer: 'Heavyocity', link: 'https://heavyocity.com/product/gravity/', description: 'Scoring toolkit of pads, stings, risers and hits for tension and impact.' },
    { name: 'Forzo', aliases: ['Forzo Modern Brass'], developer: 'Heavyocity', link: 'https://heavyocity.com/product/forzo-modern-brass/', description: 'Modern brass ensemble aimed at bold, rhythmic scoring rather than classical detail.' },
    { name: 'Novo', aliases: ['Novo Modern Strings'], developer: 'Heavyocity', link: 'https://heavyocity.com/product/novo/', description: 'Modern strings with a built-in rhythmic engine for evolving, processed string beds.' },
    { name: 'Shreddage 3', aliases: ['Shreddage', 'Shreddage 3 Hydra', 'Shreddage 3 Jupiter', 'Shreddage 3 Stratus', 'Shreddage 3 Abyss'], developer: 'Impact Soundworks', link: 'https://impactsoundworks.com/product-category/shreddage-3/', description: 'Deeply sampled electric guitars and basses built for metal and rock rhythm and lead writing.' },
    { name: 'Evolution Series Guitars', aliases: ['Evolution Dracus', 'Evolution Electric Guitar', 'Evolution Strawberry', 'Orange Tree Evolution'], developer: 'Orange Tree Samples', link: 'https://www.orangetreesamples.com/', description: 'The Evolution guitar range — highly playable acoustic, electric and bass instruments.' },
    { name: 'GGD Modern and Massive', aliases: ['GetGood Drums', 'GGD', 'Modern and Massive'], developer: 'GetGood Drums', link: 'https://getgooddrums.com/', description: 'Modern metal drum kit with tight, mix-ready samples and per-drum mic control.' },
    { name: 'Nucleus', aliases: ['Audio Imperia Nucleus'], developer: 'Audio Imperia', link: 'https://audioimperia.com/products/nucleus', description: 'A compact orchestra — strings, brass, woodwinds, choir and percussion in one instrument.' },
    { name: 'Jaeger', aliases: ['Audio Imperia Jaeger'], developer: 'Audio Imperia', link: 'https://audioimperia.com/products/jaeger', description: 'Cinematic orchestral library aimed at trailer writing, with ensemble patches and hits.' },
    { name: 'Cinematic Studio Strings', aliases: ['CSS', 'Cinematic Studio Solo Strings', 'Cinematic Studio Brass', 'Cinematic Studio Piano'], developer: 'Cinematic Studio Series', link: 'https://www.cinematicstudioseries.com/', description: 'Warm, playable orchestral strings recorded in Sydney, with natural legato transitions.' },
    { name: 'Symphobia', aliases: ['ProjectSAM Symphobia', 'True Strike', 'Orchestral Essentials'], developer: 'ProjectSAM', link: 'https://projectsam.com/', description: 'Orchestral ensemble library built around ready-made sections and cinematic effects.' },
    { name: 'Spitfire Kontakt libraries', aliases: ['Albion', 'Albion One', 'Spitfire Solo Violin', 'Hans Zimmer Strings', 'Spitfire Chamber Strings'], developer: 'Spitfire Audio', link: 'https://www.spitfireaudio.com/', description: 'Spitfire orchestral libraries that run in Kontakt (their newer ones use their own player).' },
    { name: '8Dio', aliases: ['8Dio Century', 'Century Strings', 'Anthology Strings', '8Dio Anthology'], developer: '8Dio', link: 'https://8dio.com/', description: 'Orchestral and experimental libraries, from the Century series to solo and choral instruments.' },
    { name: 'Soundiron', aliases: ['Soundiron Voices of Rapture', 'Olympus Choir', 'Requiem'], developer: 'Soundiron', link: 'https://soundiron.com/', description: 'Choirs, unusual acoustic instruments and heavily designed sound sources.' },
    { name: 'Sonokinetic', aliases: ['Sonokinetic Grosso', 'Capriccio', 'Minimal'], developer: 'Sonokinetic', link: 'https://www.sonokinetic.net/', description: 'Phrase-based orchestral libraries that follow your chords and tempo.' },
    { name: 'Embertone', aliases: ['Embertone Friedlander Violin', 'Joshua Bell Violin', 'Intimate Strings'], developer: 'Embertone', link: 'https://www.embertone.com/', description: 'Expressive solo instruments, especially solo strings, built for detailed performance control.' },
];

async function main() {
    const dry = process.argv.includes('--dry');
    const db = new PrismaClient();
    try {
        const existing = new Set((await db.knownPlugin.findMany({ select: { name: true } })).map((p) => p.name.toLowerCase()));
        let added = 0;
        for (const lib of LIBRARIES) {
            if (existing.has(lib.name.toLowerCase())) continue;
            console.log(`  + ${lib.name} (${lib.developer})`);
            if (!dry) {
                await db.knownPlugin.create({
                    data: {
                        name: lib.name,
                        aliases: lib.aliases ?? [],
                        displayName: lib.name,
                        link: lib.link ?? null,
                        category: 'library',
                        developer: lib.developer,
                        description: lib.description,
                    },
                });
            }
            added++;
        }
        console.log(`\n${dry ? 'would add' : 'added'} ${added} of ${LIBRARIES.length} libraries (${LIBRARIES.length - added} already there)`);
    } finally {
        await db.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
