/**
 * Placeholder shown while the first page loads — the shape of a slide rather
 * than a spinner, so the layout doesn't jump when real tracks arrive.
 */
import React from 'react';
import { BORDER } from '../AltSidebar';

const shimmer: React.CSSProperties = {
    background: 'linear-gradient(100deg, rgba(255,255,255,0.045) 30%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0.045) 70%)',
    backgroundSize: '220% 100%',
    animation: 'fujiShimmer 1.5s ease-in-out infinite',
};

const Line: React.FC<{ w: string; h?: number; r?: number }> = ({ w, h = 12, r = 6 }) => (
    <div style={{ ...shimmer, width: w, height: h, borderRadius: r }} />
);

export const FeedSkeleton: React.FC<{ framed?: boolean }> = ({ framed }) => (
    <div style={{
        position: 'relative', height: '100%', width: '100%', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.05) 0%, #06080e 72%)',
        ...(framed ? { borderRadius: 18, border: `1px solid ${BORDER}` } : {}),
    }}>
        {/* Action rail */}
        <div style={{ position: 'absolute', right: 12, bottom: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ ...shimmer, width: 46, height: 46, borderRadius: '50%' }} />
            {[0, 1, 2, 3].map(i => <div key={i} style={{ ...shimmer, width: 30, height: 30, borderRadius: 9 }} />)}
        </div>
        {/* Caption */}
        <div style={{ position: 'absolute', left: 16, right: 78, bottom: 58, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Line w="42%" h={13} />
            <Line w="72%" h={17} />
            <Line w="58%" h={11} />
            <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <Line w={70 + 'px'} h={18} r={9999} />
                <Line w={54 + 'px'} h={18} r={9999} />
            </div>
        </div>
        {/* Scrubber */}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 18 }}>
            <Line w="100%" h={4} r={9999} />
        </div>
    </div>
);
