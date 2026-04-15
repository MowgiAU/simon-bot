/**
 * useProfileStyle — fetches and caches enhanced profile styles.
 *
 * Module-level cache means each userId is only fetched once per page session
 * regardless of how many components call this hook for the same user.
 */
import { useEffect, useState } from 'react';

export interface ProfileStyleData {
    gradient: string | null;
    animation: string;
    glowColor: string | null;
    glowIntensity: number;
    badgeLabel: string | null;
    badgeColor: string | null;
}

const API = import.meta.env.VITE_API_URL || '';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Shared across all hook instances — avoids N fetches per page for the same user
const cache = new Map<string, { style: ProfileStyleData | null; ts: number }>();

export function useProfileStyle(userId: string | null | undefined): ProfileStyleData | null {
    const [style, setStyle] = useState<ProfileStyleData | null>(() => {
        if (!userId) return null;
        const hit = cache.get(userId);
        return hit && Date.now() - hit.ts < CACHE_TTL ? hit.style : null;
    });

    useEffect(() => {
        if (!userId) { setStyle(null); return; }
        const hit = cache.get(userId);
        if (hit && Date.now() - hit.ts < CACHE_TTL) { setStyle(hit.style); return; }
        fetch(`${API}/api/profile-styles/${userId}`, { credentials: 'include' })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                const s: ProfileStyleData | null = data || null;
                cache.set(userId, { style: s, ts: Date.now() });
                setStyle(s);
            })
            .catch(() => {});
    }, [userId]);

    return style;
}
