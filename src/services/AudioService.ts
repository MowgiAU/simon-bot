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
        startTime.setUTCHours(0, 0, 0, 0); // Start of the current UTC day

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

        // Organic display multiplier — each real play increments counters by a random
        // amount so the site looks more active. TrackPlay rows are always 1:1 accurate.
        const multiplier = AudioService.playCountMultiplier();

        // 3. Record the play event, then increment counters independently so a profile
        //    lookup failure (e.g. post-consolidation profileId mismatch) can't roll back
        //    the track counter or the TrackPlay row.
        const play = await this.prisma.trackPlay.create({
            data: {
                trackId,
                userId: clientInfo.userId,
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                durationPlayed: clientInfo.duration
            }
        });

        await this.prisma.track.update({
            where: { id: trackId },
            data: { playCount: { increment: multiplier } }
        });

        // Best-effort: increment totalPlays on the profile. Uses updateMany so it
        // never throws even if profileId points to a deleted/consolidated profile.
        await this.prisma.musicianProfile.updateMany({
            where: { id: track.profileId },
            data: { totalPlays: { increment: multiplier } }
        });

        return { recorded: true, playId: play.id };
    }

    // Random 2–4× multiplier for a natural-looking play count boost.
    private static playCountMultiplier(): number {
        return 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
    }

    /**
     * Gets the top tracks globally based on play count.
     */
    async getTrackLeaderboard(limit = 10) {
        return await this.prisma.track.findMany({
            where: { isPublic: true, status: 'active' },
            orderBy: { playCount: 'desc' },
            select: {
                id: true, title: true, slug: true, url: true, coverUrl: true,
                playCount: true, duration: true, isPublic: true, status: true,
                allowAudioDownload: true, allowProjectDownload: true,
                artist: true, bpm: true, key: true, profileId: true, createdAt: true,
                genres: { include: { genre: true } },
                profile: {
                    select: {
                        id: true, userId: true, username: true, displayName: true,
                        avatar: true, totalPlays: true, status: true,
                    }
                }
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
    async addTrack(userId: string, data: {
        title: string, url: string, coverUrl?: string, description?: string, lyrics?: string, duration?: number,
        artist?: string, album?: string, year?: number, bpm?: number, key?: string, slug?: string,
        arrangement?: object, projectFileUrl?: string, projectZipUrl?: string,
        allowAudioDownload?: boolean, allowProjectDownload?: boolean, allowStemsDownload?: boolean,
        waveformPeaks?: number[], projectFileSizeBytes?: number, audioFileSizeBytes?: number, isPublic?: boolean,
        license?: string, trackType?: string,
    }) {
        // Try exact match first, then fall back to resolving via User table
        // (handles Discord snowflake vs cuid mismatch after profile consolidation)
        let profile = await this.prisma.musicianProfile.findUnique({ where: { userId } });
        if (!profile) {
            const linked = await this.prisma.user.findFirst({
                where: { OR: [{ id: userId }, { discordId: userId }] },
                select: { id: true, discordId: true },
            });
            if (linked) {
                const ids = [linked.id, linked.discordId].filter(Boolean) as string[];
                profile = await this.prisma.musicianProfile.findFirst({
                    where: { userId: { in: ids } },
                    orderBy: { totalPlays: 'desc' },
                });
            }
        }
        if (!profile) throw new Error('Profile not found');

        return await this.prisma.track.create({
            data: {
                profileId: profile.id,
                title: data.title,
                slug: data.slug,
                url: data.url,
                coverUrl: data.coverUrl,
                description: data.description,
                lyrics: data.lyrics,
                duration: data.duration ?? 0,
                artist: data.artist,
                album: data.album,
                year: data.year,
                bpm: data.bpm,
                key: data.key,
                isPublic: data.isPublic ?? true,
                allowAudioDownload: data.allowAudioDownload ?? true,
                allowProjectDownload: data.allowProjectDownload ?? true,
                allowStemsDownload: data.allowStemsDownload ?? true,
                license: data.license,
                trackType: data.trackType,
                arrangement: data.arrangement ?? undefined,
                projectFileUrl: data.projectFileUrl,
                projectZipUrl: data.projectZipUrl,
                waveformPeaks: data.waveformPeaks ?? undefined,
                projectFileSizeBytes: data.projectFileSizeBytes,
                audioFileSizeBytes: data.audioFileSizeBytes,
            }
        });
    }
}
