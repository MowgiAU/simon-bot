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

export function useTrackFeed(params: FeedParams) {
    const [tracks, setTracks] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const cursorRef = useRef<string | null>(null);
    const loadingRef = useRef(false);
    // Serialises pages: a late response from a previous filter must not land.
    const runRef = useRef(0);

    const { genre, search, artist, startTrackId } = params;

    const fetchPage = useCallback(async (cursor: string | null, run: number) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const q: Record<string, string> = { limit: '12' };
            if (genre) q.genre = genre;
            if (search) q.search = search;
            if (artist) q.artist = artist;
            if (startTrackId && !cursor) q.startTrackId = startTrackId;
            if (cursor) q.cursor = cursor;

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
            if (run === runRef.current) setLoading(false);
            loadingRef.current = false;
        }
    }, [genre, search, artist, startTrackId]);

    useEffect(() => {
        const run = ++runRef.current;
        cursorRef.current = null;
        setTracks([]);
        setHasMore(false);
        fetchPage(null, run);
    }, [fetchPage]);

    const loadMore = useCallback(() => {
        if (!hasMore || loadingRef.current || !cursorRef.current) return;
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
