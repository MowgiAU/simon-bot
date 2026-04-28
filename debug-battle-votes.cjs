const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
    const battles = await db.beatBattle.findMany({
        where: { status: 'completed' },
        select: { id: true, title: true, votingEnd: true, winnerEntryId: true },
        orderBy: { votingEnd: 'desc' },
        take: 3,
    });
    console.log('Recent completed battles:');
    for (const b of battles) {
        console.log('\n----', b.title, '(', b.id, ') voted_end:', b.votingEnd, 'winnerEntryId:', b.winnerEntryId);
        const ranks = await db.battleVote.groupBy({
            by: ['rank'],
            where: { battleId: b.id },
            _count: { _all: true },
        });
        console.log('  Rank distribution (battleId match):', ranks);
        // Also check votes joined via entry (in case battleId column wasn't denormalized)
        const viaEntry = await db.battleVote.count({ where: { entry: { battleId: b.id } } });
        console.log('  Total votes via entry.battleId:', viaEntry);
        const entries = await db.battleEntry.findMany({
            where: { battleId: b.id },
            select: {
                id: true, voteCount: true, trackTitle: true,
                track: { select: { title: true } },
                _count: { select: { votes: true } },
            },
        });
        for (const e of entries) {
            const perRank = await db.battleVote.groupBy({
                by: ['rank'],
                where: { entryId: e.id },
                _count: { _all: true },
            });
            console.log(`    Entry ${e.id} "${e.track?.title || e.trackTitle}" voteCount=${e.voteCount} totalVotes=${e._count.votes} perRank=${JSON.stringify(perRank)}`);
        }
    }
    await db.$disconnect();
})();
