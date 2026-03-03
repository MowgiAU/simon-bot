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
        const parent = await prisma.genre.upsert({
            where: { name: genreData.name },
            update: {},
            create: { name: genreData.name }
        });

        for (const sub of genreData.subgenres) {
            await prisma.genre.upsert({
                where: { name: sub },
                update: { parentId: parent.id },
                create: { name: sub, parentId: parent.id }
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
