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
    }) {
        // 1. Validate Social URLs (Security / Data Integrity)
        const validatedSocials = (data.socials || []).filter(s => {
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
                    hardware: data.gearList || []
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
                    hardware: data.gearList
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
        return await this.prisma.musicianProfile.findFirst({
            where: {
                OR: [
                    { userId: identifier },
                    { username: identifier }
                ]
            },
            include: {
                genres: {
                    include: { genre: true }
                }
            }
        });
    }

    async getAllGenres() {
        return await this.prisma.genre.findMany({
            include: { children: true }
        });
    }
}
