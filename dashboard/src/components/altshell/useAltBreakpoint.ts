import { useState, useEffect } from 'react';

/** lg ≥ 1100 | md 900–1099 | sm 600–899 | xs < 600 */
export type AltBP = 'xs' | 'sm' | 'md' | 'lg';

function get(): AltBP {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    if (w >= 1100) return 'lg';
    if (w >= 900)  return 'md';
    if (w >= 600)  return 'sm';
    return 'xs';
}

export function useAltBreakpoint(): AltBP {
    const [bp, setBp] = useState<AltBP>(get);
    useEffect(() => {
        let t: ReturnType<typeof setTimeout>;
        const onResize = () => { clearTimeout(t); t = setTimeout(() => setBp(get()), 100); };
        window.addEventListener('resize', onResize);
        return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
    }, []);
    return bp;
}
