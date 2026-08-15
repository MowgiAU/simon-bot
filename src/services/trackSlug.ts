/**
 * Track URL slugs.
 *
 * The slug is what /profile/:username/:slug resolves on. It only has to be unique within a
 * profile, but it does have to be unique there — two tracks sharing one slug means the page
 * serves whichever the query happens to return first, so the two songs appear to swap places
 * at random. Shared between the upload path (AudioService) and the edit routes (api/index)
 * so the rule can't drift between them.
 */

/**
 * Slugifies a title. Falls back to a timestamped slug when the title is entirely
 * non-ASCII (e.g. CJK, symbol-only) so slugs are never empty strings.
 */
export function safeTrackSlug(title: string): string {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return base || `track-${Date.now()}`;
}

/**
 * Slug for a track, guaranteed not to collide with another track on the same profile.
 * Suffixes with -2, -3, … on collision.
 *
 * Deliberately counts soft-deleted tracks as taken: they can be restored, and silently
 * stealing a restored track's URL would resurrect exactly the bug this prevents.
 */
export async function uniqueTrackSlug(
    prisma: any,
    profileId: string,
    title: string,
    excludeTrackId?: string,
): Promise<string> {
    const base = safeTrackSlug(title);
    const taken = await prisma.track.findMany({
        where: {
            profileId,
            slug: { startsWith: base },
            ...(excludeTrackId ? { id: { not: excludeTrackId } } : {}),
            OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
        },
        select: { slug: true },
    });
    const used = new Set(taken.map((t: any) => t.slug).filter(Boolean) as string[]);
    if (!used.has(base)) return base;
    for (let n = 2; n < 1000; n++) {
        const candidate = `${base}-${n}`;
        if (!used.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
}
