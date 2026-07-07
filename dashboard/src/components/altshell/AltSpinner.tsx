/**
 * Shared animated loading spinner for the Alt F suite — replaces plain
 * "Loading…" text wherever a page/section is waiting on data.
 * Reuses the global `spin` keyframe already defined in index.css.
 */
import React from 'react';
import { PRIMARY } from './AltSidebar';

export const AltSpinner: React.FC<{ size?: number; wrapperStyle?: React.CSSProperties }> = ({ size = 28, wrapperStyle }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...wrapperStyle }}>
        <div style={{
            width: size, height: size, borderRadius: '50%',
            border: `${Math.max(2, Math.round(size / 9))}px solid rgba(255,255,255,0.1)`,
            borderTopColor: PRIMARY,
            animation: 'spin 0.8s linear infinite',
        }} />
    </div>
);
