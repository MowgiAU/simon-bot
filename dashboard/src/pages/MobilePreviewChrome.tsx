/**
 * Shared chrome + palette for the mobile redesign previews (Stitch mockups rebuilt
 * as CSP-safe React). Inline styles + lucide-react only — no Tailwind/font CDNs.
 */
import React, { useState, useEffect } from 'react';
import { Home, BarChart3, Flame, Rss, User, SkipBack, Play, SkipForward } from 'lucide-react';

/** Load JSON via a loader, falling back to a static value until/unless it resolves. */
export function useLive<T>(loader: () => Promise<T | null>, fallback: T): T {
    const [data, setData] = useState<T>(fallback);
    useEffect(() => {
        let on = true;
        loader().then(d => { if (on && d) setData(d); }).catch(() => { /* keep fallback */ });
        return () => { on = false; };
    }, []);
    return data;
}

/** Normalise an axios payload that may be an array or wrapped ({tracks|profiles|battles|data}). */
export function arr(d: any): any[] {
    if (Array.isArray(d)) return d;
    return d?.tracks || d?.profiles || d?.battles || d?.entries || d?.data || [];
}

export const BG = '#0B0F19';
export const SURFACE = 'rgba(17,24,39,0.7)';
export const SURFACE_SOLID = '#111827';
export const BORDER = 'rgba(255,255,255,0.08)';
export const PRIMARY = '#F2780A';
export const CYAN = '#06B6D4';
export const TEXT = '#F8FAFC';
export const SUB = '#94A3B8';
export const FONT = 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

/** Deterministic waveform bar heights (percent) from a seed string. */
export function waveHeights(seed: string, bars = 56): number[] {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0;
    return Array.from({ length: bars }, () => {
        h = (h * 1664525 + 1013904223) >>> 0;
        return 25 + (h % 75);
    });
}

type Tab = 'home' | 'charts' | 'battles' | 'feed' | 'profile';
const TABS: { id: Tab; label: string; icon: typeof Home; href: string }[] = [
    { id: 'home', label: 'Home', icon: Home, href: '/preview/mobile-home' },
    { id: 'charts', label: 'Charts', icon: BarChart3, href: '/preview/mobile-charts' },
    { id: 'battles', label: 'Battles', icon: Flame, href: '#' },
    { id: 'feed', label: 'Feed', icon: Rss, href: '#' },
    { id: 'profile', label: 'Profile', icon: User, href: '/preview/mobile-profile' },
];

export const MobileBottomNav: React.FC<{ active: Tab }> = ({ active }) => (
    <nav style={{
        position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 50,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${BORDER}`, borderTopLeftRadius: 12, borderTopRightRadius: 12,
        height: 72, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
        {TABS.map(({ id, label, icon: Icon, href }) => {
            const on = id === active;
            return (
                <a key={id} href={href} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, width: '20%', textDecoration: 'none',
                    color: on ? PRIMARY : SUB,
                    filter: on ? 'drop-shadow(0 0 10px rgba(242,120,10,0.5))' : 'none',
                }}>
                    <Icon size={22} fill={on ? PRIMARY : 'none'} />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
                </a>
            );
        })}
    </nav>
);

export const MiniPlayer: React.FC<{ title: string; artist: string; cover: string }> = ({ title, artist, cover }) => (
    <div style={{
        position: 'fixed', bottom: 72, left: 0, width: '100%', zIndex: 40, padding: '0 8px',
        boxSizing: 'border-box',
    }}>
        <div style={{
            maxWidth: 480, margin: '0 auto',
            background: 'rgba(17,24,39,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${BORDER}`, borderRadius: 12, padding: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <img src={cover} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                    <div style={{ fontSize: 11, color: PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist}</div>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 6 }}>
                <SkipBack size={20} color={SUB} />
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Play size={18} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
                </span>
                <SkipForward size={20} color={SUB} />
            </div>
        </div>
    </div>
);
