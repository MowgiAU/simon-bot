import { PrismaClient } from '@prisma/client';

/**
 * Musician Profile Service
 * Shared logic for Discord commands, Web API and Admin controls.
 */
export class ProfileService {
    private prisma: PrismaClient;

    // Standard allowed platforms for validation
    private static readonly ALLOWED_SOCIAL_DOMAINS = [
        'spotify.com', 'soundcloud.com', 'youtube.com', 
        'instagram.com', 'tiktok.com', 'beatstars.com',
        'bandcamp.com', 'twitter.com', 'x.com'
    ];

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Standardized profile update logic.
     * Validates social URLs and handles genre relationships.
     */
    async updateProfile(userId: string, data: {
        username: string;
        displayName?: string;
        avatar?: string;
        bio?: string;
        location?: string;
        collabStatus?: boolean;
        primaryDAW?: string;
        dawVersion?: string;
        contactEmail?: string;
        socials?: Array<{ platform: string, url: string }>;
        genreIds?: string[];
        gearList?: string[];
        featuredTrackId?: string | null;
        featuredPlaylistId?: string | null;
    }) {
        // 1. Validate Social URLs (Security / Data Integrity)
        // Discord handles are not URLs so they bypass URL validation
        const validatedSocials = (data.socials || []).filter(s => {
            if (s.platform === 'discord') return !!s.url && s.url.length <= 100;
            try {
                const domain = new URL(s.url).hostname.replace('www.', '');
                return ProfileService.ALLOWED_SOCIAL_DOMAINS.some(d => domain.includes(d));
            } catch { return false; }
        });

        // 2. Clear and re-set relations (Transaction-based)
        return await this.prisma.$transaction(async (tx) => {
            // Find or create the profile base
            const profile = await tx.musicianProfile.upsert({
                where: { userId },
                create: {
                    userId,
                    username: data.username,
                    displayName: data.displayName,
                    avatar: data.avatar,
                    bio: data.bio,
                    location: data.location,
                    collabStatus: data.collabStatus || false,
                    primaryDAW: data.primaryDAW,
                    dawVersion: data.dawVersion,
                    contactEmail: data.contactEmail,
                    socials: validatedSocials,
                    hardware: data.gearList || [],
                    featuredTrackId: data.featuredTrackId,
                    featuredPlaylistId: data.featuredPlaylistId
                },
                update: {
                    username: data.username,
                    displayName: data.displayName,
                    avatar: data.avatar,
                    bio: data.bio,
                    location: data.location,
                    collabStatus: data.collabStatus,
                    primaryDAW: data.primaryDAW,
                    dawVersion: data.dawVersion,
                    contactEmail: data.contactEmail,
                    socials: validatedSocials,
                    hardware: data.gearList,
                    featuredTrackId: data.featuredTrackId,
                    featuredPlaylistId: data.featuredPlaylistId
                }
            });

            // 3. Handle Genre Mapping (Sync many-to-many)
            if (data.genreIds) {
                // Delete existing genres
                await tx.profileGenre.deleteMany({
                    where: { profileId: profile.id }
                });

                // Batch insert new ones
                const validGenreIds = data.genreIds.filter(gid => !!gid);
                if (validGenreIds.length > 0) {
                    await tx.profileGenre.createMany({
                        data: validGenreIds.map(gid => ({
                            profileId: profile.id,
                            genreId: gid
                        }))
                    });
                }
            }

            return profile;
        });
    }

    async getProfile(identifier: string) {
        const profile = await this.prisma.musicianProfile.findFirst({
            where: {
                OR: [
                    { userId: identifier },
                    { username: { equals: identifier, mode: 'insensitive' } }
                ]
            },
            include: {
                genres: {
                    include: { genre: true }
                },
                tracks: {
                    where: { isPublic: true },
                    orderBy: { createdAt: 'desc' },
                    // Explicitly select only what the profile page needs.
                    // Critically EXCLUDES: arrangement (can be MBs of FL Studio JSON),
                    // waveformPeaks (200 floats × many tracks), projectZipUrl, samples.
                    select: {
                        id: true,
                        profileId: true,
                        title: true,
                        slug: true,
                        description: true,
                        url: true,
                        coverUrl: true,
                        duration: true,
                        playCount: true,
                        isPublic: true,
                        allowAudioDownload: true,
                        allowProjectDownload: true,
                        status: true,
                        statusReason: true,
                        bpm: true,
                        key: true,
                        artist: true,
                        album: true,
                        year: true,
                        projectFileUrl: true,
                        waveformPeaks: true, // included but downsampled to 60pts in API before sending
                        createdAt: true,
                        updatedAt: true,
                        genres: { include: { genre: true } },
                        _count: { select: { favourites: true, reposts: true, comments: true } },
                    },
                },
                featuredTrack: {
                    select: {
                        id: true, title: true, slug: true, url: true, coverUrl: true,
                        duration: true, playCount: true, bpm: true, key: true,
                        waveformPeaks: true, // needed for the featured player waveform
                        isPublic: true, status: true,
                        profileId: true, createdAt: true,
                    }
                },
                featuredPlaylist: {
                    select: {
                        id: true, name: true, slug: true, description: true,
                        coverUrl: true, releaseType: true, trackCount: true,
                        tracks: {
                            orderBy: { position: 'asc' },
                            take: 10,
                            select: {
                                track: {
                                    select: {
                                        id: true, title: true, slug: true, url: true,
                                        coverUrl: true, duration: true, playCount: true,
                                        bpm: true, key: true, artist: true,
                                        isPublic: true, status: true, profileId: true,
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // If the featured track has been privated, clear it from the response and DB
        if (profile && profile.featuredTrack && !profile.featuredTrack.isPublic) {
            await this.prisma.musicianProfile.update({
                where: { id: profile.id },
                data: { featuredTrackId: null }
            });
            profile.featuredTrackId = null;
            (profile as any).featuredTrack = null;
        }

        return profile;
    }

    async getAllGenres() {
        return await this.prisma.genre.findMany({
            include: { children: true }
        });
    }
}
