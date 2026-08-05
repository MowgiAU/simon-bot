/**
 * Remembers which tracks the listener has already scrolled past, so reopening
 * the app doesn't replay the same opening run. Ids are sent back to the feed
 * endpoint, which skips them on the first page (and ignores the list entirely
 * if it would leave nothing to play).
 */
const KEY = 'fuji_feed_seen';
const TTL_MS = 12 * 60 * 60 * 1000; // a seen track becomes fair game again after half a day
const MAX = 50;                     // matches the server-side cap

type Entry = { id: string; t: number };

function read(): Entry[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const cutoff = Date.now() - TTL_MS;
        return parsed.filter((e: any) => e && typeof e.id === 'string' && typeof e.t === 'number' && e.t > cutoff);
    } catch {
        return [];
    }
}

export function getSeenIds(): string[] {
    return read().map(e => e.id).slice(0, MAX);
}

export function markSeen(id: string): void {
    if (!id) return;
    try {
        const entries = read().filter(e => e.id !== id);
        entries.unshift({ id, t: Date.now() });
        localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
    } catch {
        // private mode / storage full — the feed just repeats itself, no harm
    }
}
