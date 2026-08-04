/**
 * Shared types + formatters for the track shorts feed.
 * Shape mirrors GET /api/tracks/feed (src/api/index.ts).
 */

export interface FeedProfile {
    id: string;
    userId?: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    totalPlays?: number;
}

export interface FeedGenre { id: string; name: string; slug: string; }

export interface FeedTrack {
    id: string;
    title: string;
    slug?: string | null;
    url: string;
    mp3Url?: string | null;
    coverUrl?: string | null;
    duration?: number;
    playCount?: number;
    bpm?: number | null;
    key?: string | null;
    description?: string | null;
    license?: string;
    youtubeUrl?: string | null;
    waveformPeaks?: number[] | null;
    lyrics?: string | null;
    lyricsSync?: { time: number; text: string }[] | null;
    allowAudioDownload?: boolean;
    allowProjectDownload?: boolean;
    allowStemsDownload?: boolean;
    projectFileUrl?: string | null;
    projectZipUrl?: string | null;
    createdAt: string;
    genres: FeedGenre[];
    profile: FeedProfile;
    likeCount: number;
    repostCount: number;
    commentCount: number;
    liked: boolean;
    reposted: boolean;
    following: boolean;
}

export interface FeedParams {
    genre?: string;
    search?: string;
    artist?: string;
    startTrackId?: string;
}

export const fmtNum = (n?: number) => {
    n = n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
};

export const fmtTime = (s?: number) => {
    if (!s || !isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const c = Math.floor(s % 60);
    return `${m}:${c.toString().padStart(2, '0')}`;
};

export const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 604800) return `${Math.floor(s / 86400)}d`;
    return new Date(d).toLocaleDateString();
};

export const trackAudioUrl = (t: FeedTrack) => t.mp3Url || t.url;

export const artistName = (t: FeedTrack) =>
    t.profile?.displayName || t.profile?.username || 'Unknown artist';

export const trackHref = (t: FeedTrack) =>
    t.profile?.username && t.slug ? `/profile/${t.profile.username}/${t.slug}` : '';

/** Deterministic accent per genre — same hash the rest of Alt F uses. */
export function genreAccent(name: string): string {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,65%)`;
}

export const LICENSE_LABELS: Record<string, string> = {
    'all-rights-reserved': 'All rights reserved',
    'cc-by': 'CC BY',
    'cc-by-sa': 'CC BY-SA',
    'cc-by-nc': 'CC BY-NC',
    'cc-by-nc-sa': 'CC BY-NC-SA',
    'cc-by-nd': 'CC BY-ND',
    'cc-by-nc-nd': 'CC BY-NC-ND',
    'cc0': 'CC0 — public domain',
};
