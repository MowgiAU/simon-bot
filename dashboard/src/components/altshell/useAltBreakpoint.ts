import { useState, useEffect } from 'react';

/** lg ≥ 1100 | md 900–1099 | sm 600–899 | xs < 600 */
export type AltBP = 'xs' | 'sm' | 'md' | 'lg';

function width(): number {
    if (typeof window === 'undefined') return 1200;
    // documentElement.clientWidth is laid out; innerWidth can still report the
    // pre-layout viewport on a cold start. Take the larger of the two so a
    // transiently tiny reading never wins.
    const doc = typeof document !== 'undefined' ? document.documentElement?.clientWidth || 0 : 0;
    const vv = window.visualViewport?.width || 0;
    return Math.max(window.innerWidth || 0, doc, vv) || 1200;
}

function get(): AltBP {
    const w = width();
    if (w >= 1100) return 'lg';
    if (w >= 900)  return 'md';
    if (w >= 600)  return 'sm';
    return 'xs';
}

export function useAltBreakpoint(): AltBP {
    const [bp, setBp] = useState<AltBP>(get);
    useEffect(() => {
        let t: ReturnType<typeof setTimeout>;
        const apply = () => setBp(prev => { const now = get(); return now === prev ? prev : now; });
        const onResize = () => { clearTimeout(t); t = setTimeout(apply, 100); };

        // Cold starts (Android WebView, restored/background tabs, embedded panes)
        // can paint before the viewport is sized and never fire a resize event —
        // which would strand a desktop user on the mobile layout, or vice versa.
        // Re-measure after paint, and once more when layout has definitely settled.
        const raf = requestAnimationFrame(apply);
        const settle = setTimeout(apply, 400);

        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        return () => {
            clearTimeout(t); clearTimeout(settle); cancelAnimationFrame(raf);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
        };
    }, []);
    return bp;
}
