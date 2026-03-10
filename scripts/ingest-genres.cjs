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

    let currentParent = null;
    let addedCount = 0;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Sub-genre check (starting with -)
        if (line.startsWith('-')) {
            const genreName = line.substring(1).trim();
            if (genreName) {
                await addGenre(genreName, currentParent?.id);
            }
        } else {
            // Main category
            currentParent = await addGenre(line, null);
        }
    }

    async function addGenre(name, parentId = null) {
        try {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            let existing = await prisma.genre.findFirst({
                where: { 
                    OR: [
                        { name: { equals: name, mode: 'insensitive' } },
                        { slug: slug }
                    ]
                }
            });

            if (!existing) {
                existing = await prisma.genre.create({
                    data: { name, slug, parentId }
                });
                console.log(`✅ Added: ${name}${parentId ? ' (sub-genre)' : ' (main category)'}`);
                addedCount++;
            } else {
                // Update parentId if it exists but wasn't set correctly
                if (parentId && existing.parentId !== parentId) {
                    existing = await prisma.genre.update({
                        where: { id: existing.id },
                        data: { parentId }
                    });
                    console.log(`🔧 Updated parent for: ${name}`);
                } else {
                    console.log(`⏩ Skipped (exists): ${name}`);
                }
            }
            return existing;
        } catch (err) {
            console.error(`❌ Error adding ${name}:`, err.message);
            return null;
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
