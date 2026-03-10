/**
 * Fuji Studio - Genre Seed Script
 * Run from the project root: node scripts/seed-genres.cjs
 * Safe to run multiple times - skips existing genres.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Genre data: [ [ParentName, [subgenre, subgenre, ...]], ... ]
const GENRES = [
    ['Electronic', [
        'House',
        'Deep House',
        'Tech House',
        'Progressive House',
        'Future House',
        'Techno',
        'Minimal Techno',
        'Industrial Techno',
        'Trance',
        'Progressive Trance',
        'Psytrance',
        'Drum & Bass',
        'Liquid DnB',
        'Neurofunk',
        'Jump Up',
        'Jungle',
        'Dubstep',
        'Riddim',
        'Brostep',
        'Future Bass',
        'Trap',
        'UK Garage',
        '2-Step',
        'Speed Garage',
        'Breakbeat',
        'Electro',
        'Electronica',
        'IDM',
        'Glitch',
        'Ambient',
        'Dark Ambient',
        'Drone',
        'Synthwave',
        'Retrowave',
        'Darksynth',
        'Outrun',
        'Lo-Fi',
        'Lo-Fi Hip Hop',
        'Chillwave',
        'Vaporwave',
        'Nu-Disco',
        'Disco',
        'Funk',
        'Hardcore',
        'Gabber',
        'Happy Hardcore',
        'EBM',
        'Industrial',
        'Noise',
        'Footwork',
        'Juke',
        'Grime',
        'Bass Music',
        'Wave',
        'Phonk',
        'Jersey Club',
    ]],
    ['Hip-Hop / Rap', [
        'Boom Bap',
        'Trap (Hip-Hop)',
        'Cloud Rap',
        'Emo Rap',
        'Drill',
        'UK Drill',
        'Brooklyn Drill',
        'Mumble Rap',
        'Conscious Hip-Hop',
        'East Coast Hip-Hop',
        'West Coast Hip-Hop',
        'Southern Hip-Hop',
        'Crunk',
        'G-Funk',
        'Gangsta Rap',
        'Jazz Rap',
        'Abstract Hip-Hop',
        'Alternative Hip-Hop',
        'Instrumental Hip-Hop',
        'Lofi Hip-Hop',
    ]],
    ['Pop', [
        'Synth-Pop',
        'Dream Pop',
        'Electropop',
        'Indie Pop',
        'Art Pop',
        'Dance-Pop',
        'K-Pop',
        'J-Pop',
        'Alternative Pop',
        'Hyperpop',
        'Bedroom Pop',
    ]],
    ['R&B / Soul', [
        'Contemporary R&B',
        'Neo-Soul',
        'Classic Soul',
        'Motown',
        'Funk',
        'Gospel',
        'Alternative R&B',
    ]],
    ['Rock', [
        'Alternative Rock',
        'Indie Rock',
        'Post-Rock',
        'Math Rock',
        'Shoegaze',
        'Dream Metal',
        'Metal',
        'Post-Metal',
        'Progressive Rock',
        'Psychedelic Rock',
        'Punk',
        'Post-Punk',
        'Garage Rock',
        'Grunge',
    ]],
    ['Jazz', [
        'Jazz Fusion',
        'Bebop',
        'Modal Jazz',
        'Avant-Garde Jazz',
        'Nu-Jazz',
        'Smooth Jazz',
    ]],
    ['Classical / Orchestral', [
        'Orchestral',
        'Piano',
        'Cinematic',
        'Neoclassical',
        'Minimalist Classical',
        'Chamber Music',
        'Choir / Choral',
    ]],
    ['World / Folk', [
        'Afrobeats',
        'Afro Fusion',
        'Latin',
        'Reggae',
        'Reggaeton',
        'Dancehall',
        'Cumbia',
        'Bossa Nova',
        'Samba',
        'Flamenco',
        'Celtic',
        'Balkan',
        'Middle Eastern',
    ]],
    ['Experimental', [
        'Noise',
        'Avant-Garde',
        'Musique Concrète',
        'Sound Design',
        'Generative',
        'Microsound',
        'Plunderphonics',
    ]],
];

function toSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function upsertGenre(name, parentId = null) {
    const slug = toSlug(name);
    const existing = await prisma.genre.findFirst({
        where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }] }
    });
    if (existing) {
        if (parentId && existing.parentId !== parentId) {
            await prisma.genre.update({ where: { id: existing.id }, data: { parentId } });
            console.log(`🔧 Updated parent: ${name}`);
        } else {
            console.log(`⏩ Exists: ${name}`);
        }
        return existing;
    }
    const created = await prisma.genre.create({ data: { name, slug, parentId } });
    console.log(`✅ Added: ${name}${parentId ? ' (sub)' : ''}`);
    return created;
}

async function main() {
    let added = 0;
    for (const [parentName, children] of GENRES) {
        const parent = await upsertGenre(parentName, null);
        if (!parent) continue;
        for (const child of children) {
            await upsertGenre(child, parent.id);
        }
    }
    const total = await prisma.genre.count();
    console.log(`\n✅ Done! Total genres in DB: ${total}`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
