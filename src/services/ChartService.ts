import { PrismaClient } from '@prisma/client';

/**
 * Chart Service
 * Generates periodic chart snapshots (daily/weekly) from real play data,
 * tracking position changes, peak positions, and weeks on chart.
 */
export class ChartService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Generate a chart snapshot for a given period.
     * - "daily": ranks tracks by plays in the last 24 hours
     * - "weekly": ranks tracks by plays in the last 7 days
     * - "alltime": ranks tracks by total play count
     */
    async generateSnapshot(period: 'daily' | 'weekly' | 'alltime', limit = 50): Promise<string> {
        const now = new Date();

        // Calculate the time window for play counting
        let since: Date | null = null;
        if (period === 'daily') {
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (period === 'weekly') {
            since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Get the previous snapshot for this period to calculate position changes
        const prevSnapshot = await this.prisma.chartSnapshot.findFirst({
            where: { period },
            orderBy: { takenAt: 'desc' },
            include: { entries: true },
        });

        // Build a map of trackId → previous position
        const prevPositionMap = new Map<string, number>();
        const prevWeeksMap = new Map<string, number>();
        const prevPeakMap = new Map<string, number>();
        if (prevSnapshot) {
            for (const entry of prevSnapshot.entries) {
                prevPositionMap.set(entry.trackId, entry.position);
                prevWeeksMap.set(entry.trackId, entry.weeksOnChart);
                prevPeakMap.set(entry.trackId, entry.peakPosition);
            }
        }

        let rankedTracks: { trackId: string; playCount: number; playsInPeriod: number }[];

        if (since) {
            // For daily/weekly: count plays in the period, then rank by that count
            const playCountsRaw = await this.prisma.trackPlay.groupBy({
                by: ['trackId'],
                where: { playAt: { gte: since } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: limit,
            });

            // Get trackIds that are public and active
            const trackIds = playCountsRaw.map(p => p.trackId);
            const validTracks = await this.prisma.track.findMany({
                where: { id: { in: trackIds }, isPublic: true, status: 'active' },
                select: { id: true, playCount: true },
            });
            const validMap = new Map(validTracks.map(t => [t.id, t.playCount]));

            rankedTracks = playCountsRaw
                .filter(p => validMap.has(p.trackId))
                .map(p => ({
                    trackId: p.trackId,
                    playCount: validMap.get(p.trackId) || 0,
                    playsInPeriod: p._count.id,
                }));
        } else {
            // All-time: rank by total play count
            const topTracks = await this.prisma.track.findMany({
                where: { isPublic: true, status: 'active' },
                orderBy: { playCount: 'desc' },
                take: limit,
                select: { id: true, playCount: true },
            });

            rankedTracks = topTracks.map(t => ({
                trackId: t.id,
                playCount: t.playCount,
                playsInPeriod: t.playCount, // For all-time, total plays IS the period
            }));
        }

        // Create the snapshot and entries in a transaction
        const snapshot = await this.prisma.$transaction(async (tx) => {
            const snap = await tx.chartSnapshot.create({
                data: { period, takenAt: now },
            });

            for (let i = 0; i < rankedTracks.length; i++) {
                const { trackId, playCount, playsInPeriod } = rankedTracks[i];
                const position = i + 1;
                const prevPos = prevPositionMap.get(trackId) ?? null;
                const prevWeeks = prevWeeksMap.get(trackId) ?? 0;
                const prevPeak = prevPeakMap.get(trackId) ?? position;
                const peakPosition = Math.min(prevPeak, position);

                await tx.chartEntry.create({
                    data: {
                        snapshotId: snap.id,
                        trackId,
                        position,
                        playCount,
                        playsInPeriod,
                        prevPosition: prevPos,
                        peakPosition,
                        weeksOnChart: prevWeeks + 1,
                    },
                });
            }

            return snap;
        });

        return snapshot.id;
    }

    /**
     * Get the latest chart for a given period, with track details.
     */
    async getLatestChart(period: 'daily' | 'weekly' | 'alltime', limit = 50) {
        const snapshot = await this.prisma.chartSnapshot.findFirst({
            where: { period },
            orderBy: { takenAt: 'desc' },
            include: {
                entries: {
                    orderBy: { position: 'asc' },
                    take: limit,
                },
            },
        });

        if (!snapshot) return null;

        // Fetch track details for entries
        const trackIds = snapshot.entries.map(e => e.trackId);
        const tracks = await this.prisma.track.findMany({
            where: { id: { in: trackIds } },
            include: {
                profile: {
                    select: { userId: true, username: true, displayName: true, avatar: true },
                },
            },
        });
        const trackMap = new Map(tracks.map(t => [t.id, t]));

        return {
            id: snapshot.id,
            period: snapshot.period,
            takenAt: snapshot.takenAt,
            entries: snapshot.entries
                .map(e => {
                    const track = trackMap.get(e.trackId);
                    if (!track) return null;
                    return {
                        position: e.position,
                        prevPosition: e.prevPosition,
                        positionChange: e.prevPosition != null ? e.prevPosition - e.position : null,
                        peakPosition: e.peakPosition,
                        weeksOnChart: e.weeksOnChart,
                        playsInPeriod: e.playsInPeriod,
                        track: {
                            id: track.id,
                            title: track.title,
                            slug: track.slug,
                            url: track.url,
                            coverUrl: track.coverUrl,
                            playCount: track.playCount,
                            profile: track.profile,
                        },
                    };
                })
                .filter(Boolean),
        };
    }

    /**
     * Get chart history for a specific track (all snapshots it appeared in).
     */
    async getTrackChartHistory(trackId: string, period: 'daily' | 'weekly' | 'alltime', limit = 30) {
        const entries = await this.prisma.chartEntry.findMany({
            where: {
                trackId,
                snapshot: { period },
            },
            orderBy: { snapshot: { takenAt: 'desc' } },
            take: limit,
            include: {
                snapshot: { select: { takenAt: true, period: true } },
            },
        });

        return entries.map(e => ({
            date: e.snapshot.takenAt,
            position: e.position,
            playCount: e.playCount,
            playsInPeriod: e.playsInPeriod,
        }));
    }

    /**
     * Clean up old snapshots, keeping the last N for each period.
     */
    async pruneSnapshots(keepPerPeriod = 90) {
        for (const period of ['daily', 'weekly', 'alltime'] as const) {
            const snapshots = await this.prisma.chartSnapshot.findMany({
                where: { period },
                orderBy: { takenAt: 'desc' },
                select: { id: true },
            });

            if (snapshots.length > keepPerPeriod) {
                const toDelete = snapshots.slice(keepPerPeriod).map(s => s.id);
                await this.prisma.chartEntry.deleteMany({
                    where: { snapshotId: { in: toDelete } },
                });
                await this.prisma.chartSnapshot.deleteMany({
                    where: { id: { in: toDelete } },
                });
            }
        }
    }
}
