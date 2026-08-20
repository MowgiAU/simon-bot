/**
 * LessonBubble — a coachmark-style speech bubble that points at whichever
 * DAW control the current lesson step cares about (a specific step cell, a
 * whole channel row, the play/stop button, or the simulator frame itself as
 * a fallback for plain instruction steps).
 *
 * Position is measured at runtime against `container` rather than computed
 * from layout constants, so it keeps working if the DAW's own styling
 * changes. `container` is plain state (set via a callback ref in the
 * parent), not a ref object — a plain ref's `.current` mutating does NOT
 * re-trigger effects, so if the container weren't ready on the very first
 * effect run, the bubble would never get another chance to measure it.
 */
import React, { useLayoutEffect, useState } from 'react';

interface LessonBubbleProps {
    container: HTMLElement | null;
    targetId: string | null;
    text: string;
    hint?: string;
    showHint?: boolean;
    /** Hide the bubble even if targetId resolves — used once a step's task is done */
    hidden?: boolean;
}

interface BubblePos {
    left: number;
    top: number;
    /** Bubble renders above the target by default; flip below if there's no room */
    below: boolean;
}

const HALF_WIDTH = 140; // half of maxWidth below, used to keep the bubble on-screen
const GAP = 20; // clearance between the bubble and the element it points at

export const LessonBubble: React.FC<LessonBubbleProps> = ({ container, targetId, text, hint, showHint, hidden }) => {
    const [pos, setPos] = useState<BubblePos | null>(null);

    useLayoutEffect(() => {
        if (!container || !targetId) { setPos(null); return; }

        const update = () => {
            const el = container.querySelector(`[data-academy-id="${targetId}"]`) as HTMLElement | null;
            if (!el) { setPos(null); return; }
            const cRect = container.getBoundingClientRect();
            const eRect = el.getBoundingClientRect();
            const top = eRect.top - cRect.top;
            const rawLeft = eRect.left - cRect.left + eRect.width / 2;
            // Clamp horizontally so the bubble body never spills past the container edges
            // (and so it can't drift over controls in an unrelated column).
            const left = Math.min(Math.max(rawLeft, HALF_WIDTH + 8), cRect.width - HALF_WIDTH - 8);
            setPos({
                left,
                top,
                below: top < 70, // not enough room above — flip the bubble under the target
            });
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(container);
        window.addEventListener('resize', update);
        return () => { ro.disconnect(); window.removeEventListener('resize', update); };
    }, [container, targetId]);

    if (!pos || hidden) return null;

    return (
        <div style={{
            position: 'absolute',
            left: pos.left,
            top: pos.top,
            // GAP clears the whole target row so the bubble never visually sits on top of it —
            // and pointerEvents:none means it can never intercept a click either way.
            transform: pos.below ? `translate(-50%, ${GAP}px)` : `translate(-50%, calc(-100% - ${GAP}px))`,
            zIndex: 50,
            pointerEvents: 'none',
            maxWidth: HALF_WIDTH * 2,
            transition: 'left 0.25s ease, top 0.25s ease',
        }}>
            {pos.below && <Pointer up />}
            <div style={{
                background: 'rgba(15,19,29,0.96)',
                border: '1px solid rgba(111,191,64,0.4)',
                borderRadius: 10,
                padding: '10px 14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                color: '#EDEFF3',
                fontSize: 13,
                lineHeight: 1.55,
            }}>
                {text}
                {showHint && hint && (
                    <div style={{ marginTop: 6, color: '#E88C3A', fontSize: 12 }}>
                        {hint}
                    </div>
                )}
            </div>
            {!pos.below && <Pointer />}
        </div>
    );
};

const Pointer: React.FC<{ up?: boolean }> = ({ up }) => (
    <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        ...(up ? { top: -6 } : { bottom: -6 }),
        width: 0, height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        ...(up
            ? { borderBottom: '7px solid rgba(15,19,29,0.96)' }
            : { borderTop: '7px solid rgba(15,19,29,0.96)' }),
    }} />
);
