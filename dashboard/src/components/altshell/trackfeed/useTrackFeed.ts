/**
 * Data layer for the track shorts feed — paging plus the optimistic mutations
 * the slides fire (like / repost / follow / comment count).
 *
 * One instance per feed surface; every surface hits the same GET /api/tracks/feed
 * and differs only by params.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FeedParams, FeedTrack } from './types';
import { getSeenIds } from './seen';

export function useTrackFeed(params: FeedParams) {
    const [tracks, setTracks] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const cursorRef = useRef<string | null>(null);
    // The request currently open. Guards against firing the same page twice —
    // but never against a *new* filter run: params can resolve asynchronously
    // (e.g. a genre slug becoming known once the genre list loads) while the
    // first request is still in flight, and that run must be allowed through.
    const inFlight = useRef<{ run: number; cursor: string | null } | null>(null);
    // Serialises pages: a late response from a previous filter must not land.
    const runRef = useRef(0);

    const { genre, search, artist, startTrackId, sort } = params;

    const fetchPage = useCallback(async (cursor: string | null, run: number) => {
        if (inFlight.current && inFlight.current.run === run && inFlight.current.cursor === cursor) return;
        inFlight.current = { run, cursor };
        setLoading(true);
        try {
            const q: Record<string, string> = { limit: '12' };
            if (genre) q.genre = genre;
            if (search) q.search = search;
            if (artist) q.artist = artist;
            if (sort && sort !== 'feed') q.sort = sort;
            if (startTrackId && !cursor) q.startTrackId = startTrackId;
            if (cursor) q.cursor = cursor;
            if (!cursor) {
                // Open on something they haven't just watched
                const seen = getSeenIds();
                if (seen.length) q.exclude = seen.join(',');
            }

            const r = await axios.get('/api/tracks/feed', { params: q, withCredentials: true });
            if (run !== runRef.current) return; // superseded by a newer filter

            const incoming: FeedTrack[] = r.data?.tracks || [];
            setTracks(prev => {
                if (!cursor) return incoming;
                const seen = new Set(prev.map(t => t.id));
                return [...prev, ...incoming.filter(t => !seen.has(t.id))];
            });
            cursorRef.current = r.data?.nextCursor || null;
            setHasMore(!!r.data?.hasMore);
        } catch {
            if (run === runRef.current && !cursor) setTracks([]);
        } finally {
            if (inFlight.current?.run === run && inFlight.current?.cursor === cursor) inFlight.current = null;
            if (run === runRef.current) setLoading(false);
        }
    }, [genre, search, artist, startTrackId, sort]);

    useEffect(() => {
        const run = ++runRef.current;
        cursorRef.current = null;
        setTracks([]);
        setHasMore(false);
        fetchPage(null, run);
    }, [fetchPage]);

    const loadMore = useCallback(() => {
        if (!hasMore || inFlight.current || !cursorRef.current) return;
        fetchPage(cursorRef.current, runRef.current);
    }, [hasMore, fetchPage]);

    const patch = useCallback((id: string, changes: Partial<FeedTrack>) => {
        setTracks(prev => prev.map(t => (t.id === id ? { ...t, ...changes } : t)));
    }, []);

    const toggleLike = useCallback(async (t: FeedTrack) => {
        const next = !t.liked;
        patch(t.id, { liked: next, likeCount: Math.max(0, t.likeCount + (next ? 1 : -1)) });
        try {
            const r = await axios.post(`/api/tracks/${t.id}/favourite`, {}, { withCredentials: true });
            if (typeof r.data?.favourited === 'boolean' && r.data.favourited !== next) {
                patch(t.id, { liked: r.data.favourited, likeCount: t.likeCount });
            }
        } catch {
            patch(t.id, { liked: t.liked, likeCount: t.likeCount }); // revert
        }
    }, [patch]);

    const toggleRepost = useCallback(async (t: FeedTrack) => {
        const next = !t.reposted;
        patch(t.id, { reposted: next, repostCount: Math.max(0, t.repostCount + (next ? 1 : -1)) });
        try {
            await axios.post(`/api/tracks/${t.id}/repost`, {}, { withCredentials: true });
        } catch {
            patch(t.id, { reposted: t.reposted, repostCount: t.repostCount });
        }
    }, [patch]);

    // Follow state lives on the artist, so every track by them updates together.
    const toggleFollow = useCallback(async (t: FeedTrack) => {
        const profileId = t.profile?.id;
        if (!profileId) return;
        const next = !t.following;
        setTracks(prev => prev.map(x => (x.profile?.id === profileId ? { ...x, following: next } : x)));
        try {
            await axios.post(`/api/artists/${profileId}/follow`, {}, { withCredentials: true });
        } catch {
            setTracks(prev => prev.map(x => (x.profile?.id === profileId ? { ...x, following: !next } : x)));
        }
    }, []);

    const bumpCommentCount = useCallback((id: string, by = 1) => {
        setTracks(prev => prev.map(t => (t.id === id ? { ...t, commentCount: Math.max(0, t.commentCount + by) } : t)));
    }, []);

    return { tracks, loading, hasMore, loadMore, toggleLike, toggleRepost, toggleFollow, bumpCommentCount };
}
