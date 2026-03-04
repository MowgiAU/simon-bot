import { PrismaClient } from '@prisma/client';

/**
 * Audio Service
 * Handles track uploads (metadata), play counting with anti-cheat, and leaderboards.
 */
export class AudioService {
    private prisma: PrismaClient;

    // Anti-cheat: Maximum amount of plays per IP per track in a 24-hour window
    private static readonly MAX_PLAYS_PER_IP_24H = 5;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Records a track play with anti-cheat verification.
     */
    async recordPlay(trackId: string, clientInfo: { ip: string, userAgent?: string, userId?: string, duration?: number }) {
        // 1. Check if the track exists
        const track = await this.prisma.track.findUnique({ where: { id: trackId } });
        if (!track) throw new Error('Track not found');

        // 2. Anti-cheat: Check if this IP has reached the daily limit for this specific track
        const startTime = new Date();
        startTime.setHours(0, 0, 0, 0); // Start of the current day

        const recentPlays = await this.prisma.trackPlay.count({
            where: {
                trackId,
                ipAddress: clientInfo.ip,
                playAt: { gte: startTime }
            }
        });

        if (recentPlays >= AudioService.MAX_PLAYS_PER_IP_24H) {
            return { recorded: false, reason: 'limit_reached' };
        }

        // 3. Record the play and increment counts in a transaction
        return await this.prisma.$transaction(async (tx) => {
            const play = await tx.trackPlay.create({
                data: {
                    trackId,
                    userId: clientInfo.userId,
                    ipAddress: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                    durationPlayed: clientInfo.duration
                }
            });

            // Increment individual track play count
            await tx.track.update({
                where: { id: trackId },
                data: { playCount: { increment: 1 } }
            });

            // Increment artist's total play count
            await tx.musicianProfile.update({
                where: { id: track.profileId },
                data: { totalPlays: { increment: 1 } }
            });

            return { recorded: true, playId: play.id };
        });
    }

    /**
     * Gets the top tracks globally based on play count.
     */
    async getTrackLeaderboard(limit = 10) {
        return await this.prisma.track.findMany({
            where: { isPublic: true },
            orderBy: { playCount: 'desc' },
            include: {
                profile: true
            },
            take: limit
        });
    }

    /**
     * Gets the top artists based on total play counts.
     */
    async getArtistLeaderboard(limit = 10) {
        return await this.prisma.musicianProfile.findMany({
            orderBy: { totalPlays: 'desc' },
            include: {
                _count: { select: { tracks: true } }
            },
            take: limit
        });
    }

    /**
     * Adds a new track to a profile.
     */
    async addTrack(userId: string, data: { title: string, url: string, coverUrl?: string, description?: string, duration?: number }) {
        const profile = await this.prisma.musicianProfile.findUnique({ where: { userId } });
        if (!profile) throw new Error('Profile not found');

        return await this.prisma.track.create({
            data: {
                profileId: profile.id,
                title: data.title,
                url: data.url,
                coverUrl: data.coverUrl,
                description: data.description,
                duration: data.duration ?? 0
            }
        });
    }
}
