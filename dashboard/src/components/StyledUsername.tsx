/**
 * StyledUsername — renders a username with enhanced profile styles applied.
 *
 * Drop-in replacement for any `{displayName || username}` text node.
 * Fetches style once per userId (module-level cache), applies gradient/animation.
 * Falls back to plain text immediately while loading.
 *
 * Usage:
 *   <StyledUsername userId={track.profile.userId} style={{ fontWeight: 700 }}>
 *     {track.profile.displayName || track.profile.username}
 *   </StyledUsername>
 */
import React, { useEffect } from 'react';
import { useProfileStyle } from '../hooks/useProfileStyle';

const ANIM_CSS = `
@keyframes ps-shimmer-move { 0% { left: -70%; } 100% { left: 120%; } }
@keyframes ps-pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes ps-rainbow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
.ps-anim-shimmer { position: relative !important; overflow: hidden !important; display: inline-block !important; }
.ps-anim-shimmer::after {
  content: '';
  position: absolute;
  top: -20%;
  left: -70%;
  width: 45%;
  height: 140%;
  background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
  animation: ps-shimmer-move 2.2s ease-in-out infinite;
  pointer-events: none;
}
.ps-anim-pulse   { animation: ps-pulse 2s ease-in-out infinite !important; }
.ps-anim-rainbow { animation: ps-rainbow 4s linear infinite !important; }
`;

function injectAnimCSS() {
    if (document.getElementById('ps-anim-css')) return;
    const el = document.createElement('style');
    el.id = 'ps-anim-css';
    el.textContent = ANIM_CSS;
    document.head.appendChild(el);
}

interface StyledUsernameProps {
    userId: string | null | undefined;
    children: React.ReactNode;
    /** Extra inline styles merged on top of style overrides */
    style?: React.CSSProperties;
    className?: string;
    /** Optional badge beside the name */
    showBadge?: boolean;
}

export function StyledUsername({ userId, children, style: extraStyle, className, showBadge = true }: StyledUsernameProps) {
    useEffect(() => { injectAnimCSS(); }, []);

    const ps = useProfileStyle(userId);

    const gradientStyle: React.CSSProperties = ps?.gradient
        ? {
              background: ps.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block',
          }
        : {};

    const animClass = ps?.animation && ps.animation !== 'none' ? `ps-anim-${ps.animation}` : '';

    if (!ps) {
        // No style — render plain, preserve any caller styles
        return (
            <span className={className} style={extraStyle}>
                {children}
            </span>
        );
    }

    return (
        <>
            <span
                key={ps.gradient || 'none'}
                className={[animClass, className].filter(Boolean).join(' ')}
                style={{ ...gradientStyle, ...extraStyle }}
            >
                {children}
            </span>
            {showBadge && ps.badgeLabel && (
                <span style={{
                    display: 'inline-block',
                    marginLeft: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    backgroundColor: `${ps.badgeColor || '#FFD700'}22`,
                    border: `1px solid ${ps.badgeColor || '#FFD700'}55`,
                    color: ps.badgeColor || '#FFD700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    verticalAlign: 'middle',
                }}>
                    {ps.badgeLabel}
                </span>
            )}
        </>
    );
}

/**
 * Styled avatar border/glow wrapper.
 * Just wraps an <img> or placeholder div with glow CSS.
 */
export function StyledAvatar({ userId, children, style: extraStyle }: {
    userId: string | null | undefined;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    const ps = useProfileStyle(userId);

    const glowStyle: React.CSSProperties = ps?.glowColor
        ? {
              border: `2px solid ${ps.glowColor}66`,
              boxShadow: `0 0 ${ps.glowIntensity * 3}px ${ps.glowColor}88, 0 0 ${ps.glowIntensity * 6}px ${ps.glowColor}44`,
          }
        : {};

    return (
        <span style={{ display: 'inline-block', borderRadius: '50%', ...glowStyle, ...extraStyle }}>
            {children}
        </span>
    );
}
