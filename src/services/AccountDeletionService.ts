/**
 * Account deletion: self-service soft delete, admin-reviewed permanent purge.
 *
 * Flow: a member (or an admin on their behalf) requests deletion. Everything they own is
 * soft-deleted at once and vanishes from the public site, but nothing is destroyed. An admin
 * then reviews the request and permanently purges component groups individually, or restores
 * the lot. Anything still pending after the grace period is purged automatically.
 *
 * Two details drive most of the design here:
 *
 * 1. `MusicianProfile.userId` holds EITHER a Discord snowflake or a native `User.id`, depending
 *    on how the member signed up, and a member can end up with more than one profile. Every
 *    lookup therefore works off a list of identity ids, not a single one.
 *
 * 2. Purge order matters. `Track.profile` and `BattleEntry.track` are both `onDelete: Cascade`,
 *    so purging the profile first would destroy tracks and battle entries at the database level
 *    while skipping their R2 cleanup, orphaning every audio file in the bucket. PURGE_ORDER is
 *    enforced, not advisory.
 */
import { withHardDelete } from './softDelete.js';
import { deleteStoredFiles } from './storageCleanup.js';

/** Days a soft-deleted account is held before it is purged automatically. */
export const DELETION_GRACE_DAYS = 30;

export type DeletionGroup =
    | 'battle_entries'
    | 'tracks'
    | 'playlists'
    | 'comments'
    | 'profile'
    | 'account';

/**
 * Dependency order for permanent deletion. Each entry cascades rows belonging to the entries
 * before it, so purging out of order silently destroys data whose files never get cleaned up.
 */
export const PURGE_ORDER: DeletionGroup[] = [
    'battle_entries',
    'tracks',
    'playlists',
    'comments',
    'profile',
    'account',
];

export const GROUP_LABELS: Record<DeletionGroup, string> = {
    battle_entries: 'Battle entries',
    tracks: 'Tracks + audio files',
    playlists: 'Playlists',
    comments: 'Comments',
    profile: 'Profile + avatar/banner',
    account: 'Account / login record',
};

/**
 * Personal, non-integrity-bearing rows keyed by a plain `userId` string (not a foreign key, so
 * nothing cascades them). Purged alongside the User row.
 *
 * Deliberately NOT listed: BattleVote / H2HVote tallies, H2HMatch results and Elo, StockTrade
 * and StockHolding ledger rows, ActivityLog, ModerationWarning. Deleting those would corrupt
 * other members' data and site history; they already degrade to an anonymous placeholder once
 * the profile is gone.
 */
const ACCOUNT_SCOPED_MODELS = [
    'notification',
    'musicNotification',
    'notificationPreferences',
    'deviceToken',
    'economyAccount',
    'economyInventory',
    'feedbackProfile',
    'feedbackPoints',
    'studioGuideConversation',
    'userNote',
    'trackFavourite',
    'trackRepost',
    'trackPlay',
] as const;

export interface ComponentCounts {
    battle_entries: number;
    tracks: number;
    playlists: number;
    comments: number;
    profile: number;
    account: number;
}

/** Every id this member's content could be filed under. */
export function collectIdentityIds(user: { id: string; discordId?: string | null }): string[] {
    return [...new Set([user.id, user.discordId].filter(Boolean) as string[])];
}

/**
 * Matches every row regardless of soft-delete state.
 *
 * The middleware injects `deletedAt: null` into reads unless the caller already filtered on
 * `deletedAt` — so naming the field explicitly is how you opt out and see everything.
 */
const ANY_DELETE_STATE = { OR: [{ deletedAt: null }, { deletedAt: { not: null } }] };

/** All profile ids for these identities, including already soft-deleted ones. */
async function findProfileIds(db: any, identityIds: string[]): Promise<string[]> {
    const profiles = await db.musicianProfile.findMany({
        where: { userId: { in: identityIds }, ...ANY_DELETE_STATE },
        select: { id: true },
    });
    return profiles.map((p: any) => p.id);
}

/** Counts of soft-deleted content, for the admin review screen. */
export async function getComponentCounts(db: any, identityIds: string[]): Promise<ComponentCounts> {
    const profileIds = await findProfileIds(db, identityIds);
    const gone = { deletedAt: { not: null } };

    const [battle_entries, tracks, playlists, comments, profile, account] = await Promise.all([
        db.battleEntry.count({ where: { userId: { in: identityIds }, ...gone } }),
        db.track.count({ where: { profileId: { in: profileIds }, ...gone } }),
        // Playlists key off userId, not profileId — profileId is optional (SetNull) and can be
        // null, which would leave those playlists behind if we filtered on it.
        db.playlist.count({ where: { userId: { in: identityIds }, ...gone } }),
        db.comment.count({ where: { userId: { in: identityIds }, ...gone } }),
        db.musicianProfile.count({ where: { id: { in: profileIds }, ...gone } }),
        db.user.count({ where: { id: { in: identityIds }, ...gone } }),
    ]);

    return { battle_entries, tracks, playlists, comments, profile, account };
}

/**
 * Kills every logged-in session for this member.
 *
 * `requireAuth` only checks `req.session.user`, so without this an already-open tab keeps full
 * access after deletion. The connect-pg-simple `session` table is not a Prisma model, which is
 * why this is the one place raw SQL is genuinely unavoidable.
 */
export async function invalidateSessions(db: any, identityIds: string[]): Promise<void> {
    for (const id of identityIds) {
        try {
            await db.$executeRaw`DELETE FROM "session" WHERE "sess"::jsonb -> 'user' ->> 'id' = ${id}`;
        } catch { /* session table may be empty or shaped differently — never block deletion */ }
    }
}

/**
 * Soft-deletes everything this member owns and opens a review request.
 *
 * Every row gets the SAME `deletedAt` value (`marker`), which is what makes a later restore
 * precise: it can put back exactly what this request took down, without resurrecting tracks the
 * member had individually deleted months earlier.
 */
export async function requestDeletion(
    db: any,
    userId: string,
    requestedBy: string,
    reason?: string | null,
    source: 'self' | 'admin' | 'ban' = 'self',
): Promise<any> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const existing = await db.accountDeletionRequest.findFirst({
        where: { userId, status: 'pending' },
    });
    if (existing) return existing;

    const identityIds = collectIdentityIds(user);
    const profileIds = await findProfileIds(db, identityIds);

    const marker = new Date();
    const purgeAfter = new Date(marker.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    // deleteMany on a soft-delete model is rewritten by the middleware into "set deletedAt",
    // so these are all soft deletes. `deletedAt: null` keeps us from re-stamping rows that
    // were already deleted, which would corrupt the restore marker.
    await db.$transaction([
        db.battleEntry.updateMany({ where: { userId: { in: identityIds }, deletedAt: null }, data: { deletedAt: marker } }),
        db.track.updateMany({ where: { profileId: { in: profileIds }, deletedAt: null }, data: { deletedAt: marker } }),
        db.playlist.updateMany({ where: { userId: { in: identityIds }, deletedAt: null }, data: { deletedAt: marker } }),
        db.comment.updateMany({ where: { userId: { in: identityIds }, deletedAt: null }, data: { deletedAt: marker } }),
        db.musicianProfile.updateMany({ where: { id: { in: profileIds }, deletedAt: null }, data: { deletedAt: marker } }),
        db.user.updateMany({ where: { id: userId, deletedAt: null }, data: { deletedAt: marker } }),
    ]);

    const counts = await getComponentCounts(db, identityIds);

    const request = await db.accountDeletionRequest.create({
        data: {
            userId,
            identityIds,
            requestedAt: marker,
            requestedBy,
            source,
            reason: reason || null,
            purgeAfter,
            status: 'pending',
            snapshot: counts,
        },
    });

    await invalidateSessions(db, identityIds);
    return request;
}

/**
 * Puts back everything this request took down, minus any group already purged.
 *
 * Matching on the exact `requestedAt` marker is what keeps this from resurrecting content the
 * member had deleted themselves before requesting account deletion.
 */
export async function restoreAccount(db: any, requestId: string, reviewedBy: string): Promise<any> {
    const request = await db.accountDeletionRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Deletion request not found');
    if (request.status === 'purged') throw new Error('This account has already been permanently purged');

    const identityIds: string[] = request.identityIds || [];
    const purged: string[] = request.purgedGroups || [];
    const marker = request.requestedAt;
    const profileIds = await findProfileIds(db, identityIds);
    const canRestore = (g: DeletionGroup) => !purged.includes(g);

    const ops: any[] = [];
    if (canRestore('battle_entries')) ops.push(db.battleEntry.updateMany({ where: { userId: { in: identityIds }, deletedAt: marker }, data: { deletedAt: null } }));
    if (canRestore('tracks')) ops.push(db.track.updateMany({ where: { profileId: { in: profileIds }, deletedAt: marker }, data: { deletedAt: null } }));
    if (canRestore('playlists')) ops.push(db.playlist.updateMany({ where: { userId: { in: identityIds }, deletedAt: marker }, data: { deletedAt: null } }));
    if (canRestore('comments')) ops.push(db.comment.updateMany({ where: { userId: { in: identityIds }, deletedAt: marker }, data: { deletedAt: null } }));
    if (canRestore('profile')) ops.push(db.musicianProfile.updateMany({ where: { id: { in: profileIds }, deletedAt: marker }, data: { deletedAt: null } }));
    if (canRestore('account')) ops.push(db.user.updateMany({ where: { id: request.userId, deletedAt: marker }, data: { deletedAt: null } }));
    if (ops.length) await db.$transaction(ops);

    return db.accountDeletionRequest.update({
        where: { id: requestId },
        data: { status: 'restored', reviewedAt: new Date(), reviewedBy },
    });
}

/**
 * Reverses the deletion a ban raised, for use when that ban is lifted.
 *
 * Scoped to `source: 'ban'` on purpose: unbanning must never resurrect an account the member
 * deleted themselves, or one staff deleted deliberately from the review tab. Returns null when
 * there is nothing of that kind to restore.
 */
export async function restoreBanDeletion(db: any, userId: string, reviewedBy: string): Promise<any | null> {
    const request = await db.accountDeletionRequest.findFirst({
        where: { userId, status: 'pending', source: 'ban' },
        orderBy: { requestedAt: 'desc' },
    });
    if (!request) return null;
    return restoreAccount(db, request.id, reviewedBy);
}

/** Permanently destroys one component group. Irreversible. */
export async function purgeGroup(
    db: any,
    requestId: string,
    group: DeletionGroup,
    reviewedBy: string,
): Promise<any> {
    const request = await db.accountDeletionRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Deletion request not found');
    if (request.status === 'restored') throw new Error('This account was restored — delete it again before purging');

    const purged: string[] = request.purgedGroups || [];
    if (purged.includes(group)) return request;

    // Order guard: everything earlier in PURGE_ORDER cascades from this group, so skipping ahead
    // would destroy those rows without ever cleaning up their files.
    const idx = PURGE_ORDER.indexOf(group);
    const missing = PURGE_ORDER.slice(0, idx).filter(g => !purged.includes(g));
    if (missing.length) {
        throw new Error(
            `Purge ${missing.map(g => GROUP_LABELS[g]).join(', ')} first — ` +
            `${GROUP_LABELS[group]} cascades those rows and would leave their files orphaned.`,
        );
    }

    const identityIds: string[] = request.identityIds || [];
    const profileIds = await findProfileIds(db, identityIds);
    const gone = { deletedAt: { not: null } };

    await withHardDelete(async () => {
        switch (group) {
            case 'battle_entries': {
                const entries = await db.battleEntry.findMany({
                    where: { userId: { in: identityIds }, ...gone },
                    select: { id: true, audioUrl: true, coverUrl: true, avatarUrl: true, projectUrl: true },
                });
                await deleteStoredFiles(entries.flatMap((e: any) => [e.audioUrl, e.coverUrl, e.avatarUrl, e.projectUrl]));
                await db.battleEntry.deleteMany({ where: { id: { in: entries.map((e: any) => e.id) } } });
                break;
            }
            case 'tracks': {
                const tracks = await db.track.findMany({
                    where: { profileId: { in: profileIds }, ...gone },
                    select: {
                        id: true, url: true, mp3Url: true, coverUrl: true,
                        projectFileUrl: true, projectZipUrl: true,
                        stems: { select: { url: true, mp3Url: true } },
                    },
                });
                await deleteStoredFiles(tracks.flatMap((t: any) => [
                    t.url, t.mp3Url, t.coverUrl, t.projectFileUrl, t.projectZipUrl,
                    ...t.stems.flatMap((s: any) => [s.url, s.mp3Url]),
                ]));
                // Cascades plays, genres, favourites, reposts, playlist entries, collaborators,
                // stems and samples.
                await db.track.deleteMany({ where: { id: { in: tracks.map((t: any) => t.id) } } });
                break;
            }
            case 'playlists': {
                // PlaylistTrack cascades.
                await db.playlist.deleteMany({ where: { userId: { in: identityIds }, ...gone } });
                break;
            }
            case 'comments': {
                // CommentLike cascades.
                await db.comment.deleteMany({ where: { userId: { in: identityIds }, ...gone } });
                break;
            }
            case 'profile': {
                const profiles = await db.musicianProfile.findMany({
                    where: { id: { in: profileIds }, ...gone },
                    select: { id: true, avatar: true, bannerUrl: true },
                });
                await deleteStoredFiles(profiles.flatMap((p: any) => [p.avatar, p.bannerUrl]));
                await db.musicianProfile.deleteMany({ where: { id: { in: profiles.map((p: any) => p.id) } } });
                break;
            }
            case 'account': {
                for (const model of ACCOUNT_SCOPED_MODELS) {
                    try {
                        await (db as any)[model].deleteMany({ where: { userId: { in: identityIds } } });
                    } catch { /* model may not carry a userId on every deployment — keep going */ }
                }
                await invalidateSessions(db, identityIds);
                // Cascades Project, DesktopToken, DeviceToken, NotificationPreferences.
                await db.user.deleteMany({ where: { id: request.userId, ...gone } });
                break;
            }
        }
    });

    const nextPurged = [...purged, group];
    const allDone = PURGE_ORDER.every(g => nextPurged.includes(g));
    return db.accountDeletionRequest.update({
        where: { id: requestId },
        data: {
            purgedGroups: nextPurged,
            status: allDone ? 'purged' : 'pending',
            reviewedAt: new Date(),
            reviewedBy,
        },
    });
}

/** Purges every remaining group, in dependency order. */
export async function purgeAll(db: any, requestId: string, reviewedBy: string): Promise<any> {
    let request = await db.accountDeletionRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Deletion request not found');
    for (const group of PURGE_ORDER) {
        if ((request.purgedGroups || []).includes(group)) continue;
        request = await purgeGroup(db, requestId, group, reviewedBy);
    }
    return request;
}

/**
 * Hourly job: permanently purges anything whose grace period has lapsed with no admin decision.
 */
export async function runDeletionAutoPurge(db: any, logger?: any): Promise<number> {
    let purged = 0;
    try {
        const due = await db.accountDeletionRequest.findMany({
            where: { status: 'pending', purgeAfter: { lte: new Date() } },
            select: { id: true, userId: true },
        });
        for (const req of due) {
            try {
                await purgeAll(db, req.id, 'auto-purge');
                purged++;
                logger?.info?.(`[AccountDeletion] Auto-purged account ${req.userId} (request ${req.id})`);
            } catch (e: any) {
                logger?.error?.(`[AccountDeletion] Auto-purge failed for request ${req.id}`, e);
            }
        }
    } catch (e: any) {
        logger?.error?.('[AccountDeletion] Auto-purge sweep failed', e);
    }
    return purged;
}
