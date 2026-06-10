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
        // Small delay to let session initialise on first render
        const tid = setTimeout(() => {
            trackEvent('page_view', location.pathname);
        }, 100);
        return () => clearTimeout(tid);
    }, [location.pathname, location.search]);

    return (
        <AnalyticsContext.Provider value={{ trackEvent }}>
            {children}
        </AnalyticsContext.Provider>
    );
};
