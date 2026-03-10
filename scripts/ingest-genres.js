const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(process.cwd(), 'genres.txt');
    if (!fs.existsSync(filePath)) {
        console.error('genres.txt not found in the current directory.');
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let currentCategory = null;
    let addedCount = 0;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Sub-genre check (starting with -)
        if (line.startsWith('-')) {
            const genreName = line.substring(1).trim();
            if (genreName) {
                await addGenre(genreName);
            }
        } else {
            // Main category
            currentCategory = line;
            await addGenre(line);
        }
    }

    async function addGenre(name) {
        try {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const existing = await prisma.genre.findFirst({
                where: { 
                    OR: [
                        { name: { equals: name, mode: 'insensitive' } },
                        { slug: slug }
                    ]
                }
            });

            if (!existing) {
                await prisma.genre.create({
                    data: { name, slug }
                });
                console.log(`✅ Added: ${name}`);
                addedCount++;
            } else {
                console.log(`⏩ Skipped (exists): ${name}`);
            }
        } catch (err) {
            console.error(`❌ Error adding ${name}:`, err.message);
        }
    }

    console.log(`\nDone! Total new genres added: ${addedCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
