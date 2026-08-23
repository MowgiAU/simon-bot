import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

// ── Platform detection ───────────────────────────────────────────────────────

function detectPlatform(): string {
    if (Capacitor.isNativePlatform()) return 'android_app';
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return 'mobile_browser';
    return 'desktop';
}

// ── Context ──────────────────────────────────────────────────────────────────

interface AnalyticsContextValue {
    trackEvent: (type: string, path?: string, metadata?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
    trackEvent: () => undefined,
});

export function useAnalytics(): AnalyticsContextValue {
    return useContext(AnalyticsContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const sessionIdRef = useRef<string | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const location = useLocation();
    // Track the previous path so we don't fire a page_view on mount twice
    const prevPathRef = useRef<string | null>(null);
    // The current page_view event's id and when it started, so time-on-page can be
    // reported against it once the visitor leaves — the duration isn't known until then.
    const pageViewIdRef = useRef<string | null>(null);
    const pageViewStartRef = useRef<number>(Date.now());

    // Fire-and-forget POST helper — never throws to caller
    const post = (url: string, body: unknown): void => {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).catch(() => undefined);
    };

    const patch = (url: string, body: unknown): void => {
        fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).catch(() => undefined);
    };

    // sendBeacon fires reliably during page unload where a normal fetch can get
    // cancelled mid-flight; falls back to a fire-and-forget PATCH when unavailable
    // (e.g. a plain route change, where there's no unload risk).
    const beaconPatch = (url: string, body: unknown): void => {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }));
        } else {
            patch(url, body);
        }
    };

    // Reports how long the visitor was on the page_view currently tracked in
    // pageViewIdRef, then clears it — called right before switching to a new page and
    // on unload, so every page_view except possibly the very last gets a duration.
    const flushPageViewDuration = (): void => {
        const id = pageViewIdRef.current;
        if (!id) return;
        const elapsed = Math.round((Date.now() - pageViewStartRef.current) / 1000);
        beaconPatch(`/api/analytics/event/${id}`, { durationSecs: elapsed });
        pageViewIdRef.current = null;
    };

    const trackEvent = (type: string, path?: string, metadata?: Record<string, unknown>): void => {
        const sid = sessionIdRef.current;
        if (!sid) return;
        post('/api/analytics/event', { sessionId: sid, type, path, metadata });
    };

    // Create session on mount
    useEffect(() => {
        const platform = detectPlatform();
        fetch('/api/analytics/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, userAgent: navigator.userAgent }),
        })
            .then(r => r.ok ? r.json() : null)
            .then((data: { sessionId: string } | null) => {
                if (data?.sessionId) {
                    sessionIdRef.current = data.sessionId;
                    startTimeRef.current = Date.now();
                }
            })
            .catch(() => undefined);

        // Heartbeat every 30s
        const interval = setInterval(() => {
            const sid = sessionIdRef.current;
            if (!sid) return;
            const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
            patch(`/api/analytics/session/${sid}`, { durationSecs: elapsed });
        }, 30_000);

        // End session on page unload via sendBeacon
        const handleUnload = () => {
            flushPageViewDuration();
            const sid = sessionIdRef.current;
            if (!sid) return;
            const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
            const blob = new Blob(
                [JSON.stringify({ durationSecs: elapsed })],
                { type: 'application/json' },
            );
            navigator.sendBeacon(`/api/analytics/session/${sid}`, blob);
        };

        window.addEventListener('beforeunload', handleUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, []);

    // Track page_view on route changes
    useEffect(() => {
        const currentPath = location.pathname + location.search;
        if (prevPathRef.current === currentPath) return;
        prevPathRef.current = currentPath;
        // The page being left (if any) is done being viewed the moment the path changes.
        flushPageViewDuration();
        // Small delay to let session initialise on first render
        const tid = setTimeout(() => {
            const sid = sessionIdRef.current;
            if (!sid) return;
            fetch('/api/analytics/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid, type: 'page_view', path: location.pathname }),
            })
                .then(r => r.ok ? r.json() : null)
                .then((data: { eventId?: string } | null) => {
                    if (data?.eventId) {
                        pageViewIdRef.current = data.eventId;
                        pageViewStartRef.current = Date.now();
                    }
                })
                .catch(() => undefined);
        }, 100);
        return () => clearTimeout(tid);
    }, [location.pathname, location.search]);

    return (
        <AnalyticsContext.Provider value={{ trackEvent }}>
            {children}
        </AnalyticsContext.Provider>
    );
};
