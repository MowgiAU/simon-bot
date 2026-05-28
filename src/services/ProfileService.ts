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
        primaryGenreId?: string | null;
        gearList?: string[];
        featuredTrackId?: string | null;
        featuredPlaylistId?: string | null;
        accentColor?: string | null;
        cardBgColor?: string | null;
        showH2HRank?: boolean;
        featuredFriendIds?: string[];
        headerLayout?: string;
        trackDisplayStyle?: string;
        showGearSection?: boolean;
        showSocialLinks?: boolean;
        showStatsBar?: boolean;
        showFeaturedFriends?: boolean;
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

        // 2. Upsert the core profile fields (featuredTrackId intentionally excluded —
        //    it's updated separately below to avoid P2002 from Prisma's upsert
        //    INSERT-first behaviour conflicting with the @unique constraint).
        const profile = await this.prisma.$transaction(async (tx) => {
            const p = await tx.musicianProfile.upsert({
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
                    primaryGenreId: data.primaryGenreId || null,
                    featuredPlaylistId: data.featuredPlaylistId,
                    accentColor: data.accentColor ?? null,
                    cardBgColor: data.cardBgColor ?? null,
                    showH2HRank: data.showH2HRank ?? false,
                    featuredFriendIds: data.featuredFriendIds ?? [],
                    headerLayout: data.headerLayout ?? 'left',
                    trackDisplayStyle: data.trackDisplayStyle ?? 'list',
                    showGearSection: data.showGearSection ?? true,
                    showSocialLinks: data.showSocialLinks ?? true,
                    showStatsBar: data.showStatsBar ?? true,
                    showFeaturedFriends: data.showFeaturedFriends ?? true,
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
                    primaryGenreId: data.primaryGenreId !== undefined ? (data.primaryGenreId || null) : undefined,
                    featuredPlaylistId: data.featuredPlaylistId,
                    accentColor: data.accentColor !== undefined ? (data.accentColor || null) : undefined,
                    cardBgColor: data.cardBgColor !== undefined ? (data.cardBgColor || null) : undefined,
                    showH2HRank: data.showH2HRank !== undefined ? data.showH2HRank : undefined,
                    featuredFriendIds: data.featuredFriendIds !== undefined ? data.featuredFriendIds : undefined,
                    headerLayout: data.headerLayout !== undefined ? data.headerLayout : undefined,
                    trackDisplayStyle: data.trackDisplayStyle !== undefined ? data.trackDisplayStyle : undefined,
                    showGearSection: data.showGearSection !== undefined ? data.showGearSection : undefined,
                    showSocialLinks: data.showSocialLinks !== undefined ? data.showSocialLinks : undefined,
                    showStatsBar: data.showStatsBar !== undefined ? data.showStatsBar : undefined,
                    showFeaturedFriends: data.showFeaturedFriends !== undefined ? data.showFeaturedFriends : undefined,
                }
            });

            // Handle Genre Mapping (Sync many-to-many)
            if (data.genreIds) {
                await tx.profileGenre.deleteMany({ where: { profileId: p.id } });
                const validGenreIds = data.genreIds.filter((gid: string) => !!gid);
                if (validGenreIds.length > 0) {
                    await tx.profileGenre.createMany({
                        data: validGenreIds.map((gid: string) => ({ profileId: p.id, genreId: gid }))
                    });
                }
            }

            return p;
        });

        // 3. Update featuredTrackId in a single raw SQL statement so PostgreSQL's
        //    end-of-statement unique-constraint check fires only once — after all rows
        //    have been updated. Two sequential Prisma calls (clear + set) leave a window
        //    where the constraint is re-checked between statements and P2002 fires.
        if (data.featuredTrackId !== undefined) {
            if (data.featuredTrackId) {
                // One statement: set our profile's featuredTrackId, null everyone else's.
                await this.prisma.$executeRaw`
                    UPDATE musician_profiles
                    SET "featuredTrackId" = CASE WHEN id = ${profile.id} THEN ${data.featuredTrackId} ELSE NULL END
                    WHERE "featuredTrackId" = ${data.featuredTrackId} OR id = ${profile.id}
                `;
            } else {
                // Clearing — no uniqueness concern, plain update is fine.
                await this.prisma.musicianProfile.update({
                    where: { id: profile.id },
                    data: { featuredTrackId: null },
                });
            }
            profile.featuredTrackId = data.featuredTrackId;
        }

        return profile;
    }

    async getProfile(identifier: string) {
        // Build the OR conditions. Always check username. For userId, include both
        // the identifier itself (works for cuid and old Discord-ID-as-userId profiles)
        // and, when the identifier looks like a Discord snowflake, also check the
        // internal cuid by resolving through the User table.
        const userIdConditions: string[] = [identifier];
        if (/^\d{17,19}$/.test(identifier)) {
            const discordUser = await this.prisma.user.findFirst({
                where: { discordId: identifier },
                select: { id: true },
            });
            if (discordUser) userIdConditions.push(discordUser.id);
        }

        // Use findMany so we can pick the profile with the most tracks when
        // duplicate username rows exist (duplicate-account edge case). findFirst
        // returns by insertion order which is often the empty placeholder profile.
        const profiles = await this.prisma.musicianProfile.findMany({
            where: {
                OR: [
                    { userId: { in: userIdConditions } },
                    { username: { equals: identifier, mode: 'insensitive' } }
                ]
            },
            include: {
                genres: {
                    include: { genre: true }
                },
                primaryGenre: true,
                tracks: {
                    where: { deletedAt: null },
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
                        projectZipUrl: true,
                        waveformPeaks: true, // included but downsampled to 60pts in API before sending
                        createdAt: true,
                        updatedAt: true,
                        genres: { include: { genre: true } },
                        projectLink: {
                            select: {
                                id: true,
                                projectId: true,
                                versionId: true,
                                version: { select: { versionNumber: true } },
                            },
                        },
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
                        deletedAt: true, // needed to filter soft-deleted tracks post-query
                    }
                },
                featuredPlaylist: {
                    select: {
                        id: true, name: true, slug: true, description: true,
                        coverUrl: true, releaseType: true, trackCount: true,
                        tracks: {
                            where: { track: { deletedAt: null } },
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

        // Pick the profile with the most tracks when duplicates share a username
        const profile = profiles.reduce<typeof profiles[0] | null>((best, p) => {
            if (!best) return p;
            return (p.tracks?.length ?? 0) >= (best.tracks?.length ?? 0) ? p : best;
        }, null);

        // If the featured track has been soft-deleted, clear the FK from the DB permanently.
        // If it's just private, leave the FK intact (owner may publish it later) but null it
        // in the response — the API layer hides it from non-owners.
        if (profile && profile.featuredTrack && (profile.featuredTrack as any).deletedAt) {
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
