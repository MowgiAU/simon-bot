/**
 * Alt F — Mobile home feed (/ on phones).
 *
 * Launching the app on a phone drops you straight into a full-screen, snap-scrolled
 * feed of music from every genre — the same shorts feed used inside a single genre,
 * but pulling `feed=all` so it works as a "For You" landing surface.
 *
 * Desktop/tablet keep the classic Alt F home page (App.tsx picks per breakpoint);
 * the classic home stays reachable on mobile via the Browse button (/home).
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AltSidebar, BG, TEXT, FONT, arr } from '../components/altshell/AltSidebar';
import { AltShortsFeed, ShortsPost } from '../components/altshell/AltShortsFeed';

export const FrontpageAltFHomeFeed: React.FC = () => {
    const [posts, setPosts] = useState<ShortsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [sort, setSort] = useState<'hot' | 'new' | 'top'>('hot');
    const [musicOnly, setMusicOnly] = useState(true);

    useEffect(() => { document.title = 'Fuji Studio | Feed'; }, []);

    const fetchPosts = useCallback(async (cursor?: string) => {
        setLoading(true);
        try {
            const params: Record<string, string> = { feed: 'all', sort };
            if (musicOnly) params.type = 'track';
            if (cursor) params.cursor = cursor;
            const r = await axios.get('/api/genre-posts', { params });
            const incoming = arr(r.data.posts) as ShortsPost[];
            if (cursor) {
                setPosts(prev => {
                    // A track tagged with several genres yields one post per genre —
                    // never show the same track twice in a row-less feed like this.
                    const seen = new Set(prev.map((p: any) => p.trackId).filter(Boolean));
                    return [...prev, ...incoming.filter((p: any) => !p.trackId || !seen.has(p.trackId))];
                });
            } else {
                setPosts(incoming);
            }
            setHasMore(!!r.data.hasMore);
            setNextCursor(r.data.nextCursor || null);
        } catch {}
        finally { setLoading(false); }
    }, [sort, musicOnly]);

    useEffect(() => {
        setPosts([]);
        setNextCursor(null);
        fetchPosts();
    }, [fetchPosts]);

    const handleVote = async (postId: string, type: 'up' | 'down') => {
        try {
            const isCommunityPost = !!posts.find(p => p.id === postId)?.communityId;
            const endpoint = isCommunityPost ? `/api/community-posts/${postId}/vote` : `/api/genre-posts/${postId}/vote`;
            const r = await axios.post(endpoint, { type }, { withCredentials: true });
            setPosts(prev => prev.map(p => p.id === postId
                ? { ...p, score: r.data.score, userVote: r.data.userVote }
                : p));
        } catch {}
    };

    // Native share sheet on mobile, clipboard everywhere else.
    const handleShare = async (post: ShortsPost) => {
        const url = `${window.location.origin}/post/${post.id}${post.communityId ? '?kind=community' : ''}`;
        const title = post.track?.title || post.title;
        try {
            if (navigator.share) await navigator.share({ title, url });
            else await navigator.clipboard.writeText(url);
        } catch {}
    };

    return (
        <div style={{ background: '#06080e', color: TEXT, fontFamily: FONT, minHeight: '100vh', backgroundColor: BG }}>
            <AltShortsFeed
                posts={posts}
                loading={loading}
                hasMore={hasMore}
                onLoadMore={() => { if (nextCursor) fetchPosts(nextCursor); }}
                onVote={handleVote}
                onShare={handleShare}
                title="Fuji Studio"
                browseTo="/home"
                createLink="/upload"
                musicOnly={musicOnly}
                onToggleMusicOnly={setMusicOnly}
                sort={sort}
                onSortChange={setSort}
            />
            <AltSidebar active="Home" />
        </div>
    );
};
