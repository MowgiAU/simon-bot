// Shim: turns a "slim" BattleEntry (with `track` join) into a flat object that
// matches the legacy entry shape consumed by existing UI code. Falls back to
// legacy snapshot fields if the track join is missing (back-compat with cached
// responses or partial data).
//
// New code is encouraged to read `entry.track.*` directly.

export interface FlatBattleEntry {
    id: string;
    userId: string;
    voteCount: number;
    source?: string;
    createdAt?: string;
    trackId?: string;
    trackTitle: string;
    audioUrl: string;
    coverUrl?: string | null;
    username: string;
    avatarUrl?: string | null;
    description?: string | null;
    projectUrl?: string | null;
    duration?: number;
    bpm?: number | null;
    key?: string | null;
    artist?: string | null;
    arrangement?: any;
    waveformPeaks?: number[] | null;
    track?: any;
    firstPlaceVotes?: number;
    secondPlaceVotes?: number;
    thirdPlaceVotes?: number;
    /** Public route to the underlying Track page (preferred over /battles/entry/:id). */
    trackRoute: string;
}

/**
 * Compute the public Track route for a battle entry. Prefers the canonical
 * /musicians/<username>/<slug> URL; falls back to the track id if the slug
 * is missing, and finally to the legacy /battles/entry/:id URL if the track
 * relation is missing entirely.
 */
export function battleEntryRoute(e: any): string {
    const t = e?.track || {};
    const p = t?.profile || {};
    const username = p?.username;
    const slugOrId = t?.slug || t?.id;
    if (username && slugOrId) return `/track/${username}/${slugOrId}`;
    return `/battles/entry/${e?.id}`;
}

export function flattenBattleEntry(e: any): FlatBattleEntry {
    const t = e?.track || {};
    const p = t?.profile || {};
    return {
        id: e.id,
        userId: e.userId,
        voteCount: e.voteCount ?? 0,
        source: e.source,
        createdAt: e.createdAt,
        trackId: t.id ?? e.trackId,
        trackTitle: t.title ?? e.trackTitle ?? 'Untitled',
        audioUrl: t.url ?? e.audioUrl ?? '',
        coverUrl: t.coverUrl ?? e.coverUrl ?? null,
        username: p.displayName || p.username || e.username || 'Producer',
        avatarUrl: p.avatar ?? e.avatarUrl ?? null,
        description: t.description ?? e.description ?? null,
        projectUrl: t.projectFileUrl ?? t.projectZipUrl ?? e.projectUrl ?? null,
        duration: t.duration ?? e.duration ?? 0,
        bpm: t.bpm ?? e.bpm ?? null,
        key: t.key ?? e.key ?? null,
        artist: t.artist ?? e.artist ?? null,
        arrangement: t.arrangement ?? e.arrangement ?? null,
        waveformPeaks: t.waveformPeaks ?? e.waveformPeaks ?? null,
        track: t.id ? t : undefined,
        firstPlaceVotes: e.firstPlaceVotes ?? 0,
        secondPlaceVotes: e.secondPlaceVotes ?? 0,
        thirdPlaceVotes: e.thirdPlaceVotes ?? 0,
        trackRoute: battleEntryRoute(e),
    };
}

export function flattenBattleEntries(entries: any[] | undefined): FlatBattleEntry[] {
    if (!Array.isArray(entries)) return [];
    return entries.map(flattenBattleEntry);
}
