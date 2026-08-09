/**
 * Default album artwork for tracks an artist hasn't uploaded a cover for.
 *
 * Served from R2/Cloudflare (key `defaults/fujistudiothumbnail.png`) rather than
 * the local /public folder, so it comes off the CDN like every other cover.
 *
 * This is deliberately a fixed, well-known URL rather than an opaque one: it acts
 * as a sentinel, so `coverUrl === DEFAULT_TRACK_COVER_URL` is a reliable test for
 * "no real artwork". That keeps the distinction between artist-uploaded and
 * placeholder artwork intact even though the value is stored on the row, and it
 * makes the whole thing reversible — the backfill can be undone by matching it.
 *
 * Never overwrite a non-empty coverUrl with this: uploaded artwork always wins.
 */
export const DEFAULT_TRACK_COVER_URL = 'https://cdn.fujistud.io/defaults/fujistudiothumbnail.png';

/** True when a cover is absent or is our placeholder — i.e. the artist supplied nothing. */
export function isDefaultCover(coverUrl?: string | null): boolean {
    return !coverUrl || coverUrl === DEFAULT_TRACK_COVER_URL;
}

/** Artist artwork if present, otherwise the placeholder. Never downgrades a real cover. */
export function coverOrDefault(coverUrl?: string | null): string {
    return coverUrl && coverUrl.trim() ? coverUrl : DEFAULT_TRACK_COVER_URL;
}
