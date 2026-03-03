import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Genres...');

    const genres = [
        { name: 'Electronic', subgenres: ['House', 'Techno', 'Trance', 'Dubstep', 'Drum & Bass', 'Garage', 'Ambient', 'Future Bass'] },
        { name: 'Hip Hop', subgenres: ['Trap', 'Boom Bap', 'Lo-Fi', 'Phonk', 'Drill', 'Cloud Rap'] },
        { name: 'Pop', subgenres: ['Synthpop', 'Hyperpop', 'Indie Pop', 'R&B'] },
        { name: 'Rock', subgenres: ['Metal', 'Punk', 'Alternative', 'Indie Rock', 'Shoegaze'] },
        { name: 'Traditional', subgenres: ['Jazz', 'Classical', 'Blues', 'Funk', 'Soul'] }
    ];

    for (const genreData of genres) {
        const slug = genreData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const parent = await prisma.genre.upsert({
            where: { name: genreData.name },
            update: { slug },
            create: { name: genreData.name, slug }
        });

        for (const sub of genreData.subgenres) {
            const subSlug = sub.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            await prisma.genre.upsert({
                where: { name: sub },
                update: { parentId: parent.id, slug: subSlug },
                create: { name: sub, parentId: parent.id, slug: subSlug }
            });
        }
    }

    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
