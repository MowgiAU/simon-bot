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
    /** Bubble BODY center — may be clamped away from the target to stay on-screen */
    left: number;
    top: number;
    /** Pointer triangle's offset from the bubble's own center, so it still aims at the
     *  true target even when `left` above had to be clamped */
    pointerOffset: number;
    /** Bubble renders above the target by default; flip below if there's no room */
    below: boolean;
}

const HALF_WIDTH = 140; // half of maxWidth below, used to keep the bubble on-screen
const POINTER_MARGIN = 20; // keep the pointer from reaching all the way to the bubble's rounded corners
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
            // Clamp horizontally so the bubble BODY never spills past the container edges —
            // but keep pointing the triangle at the true (unclamped) target position, offset
            // from the body's own center, so it still aims at the right control instead of
            // drifting toward the middle whenever the body gets pushed in from an edge.
            const left = Math.min(Math.max(rawLeft, HALF_WIDTH + 8), cRect.width - HALF_WIDTH - 8);
            const maxOffset = HALF_WIDTH - POINTER_MARGIN;
            const pointerOffset = Math.min(Math.max(rawLeft - left, -maxOffset), maxOffset);
            setPos({
                left,
                top,
                pointerOffset,
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
            {pos.below && <Pointer up offset={pos.pointerOffset} />}
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
            {!pos.below && <Pointer offset={pos.pointerOffset} />}
        </div>
    );
};

const Pointer: React.FC<{ up?: boolean; offset: number }> = ({ up, offset }) => (
    <div style={{
        position: 'absolute', left: `calc(50% + ${offset}px)`, transform: 'translateX(-50%)',
        ...(up ? { top: -6 } : { bottom: -6 }),
        width: 0, height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        ...(up
            ? { borderBottom: '7px solid rgba(15,19,29,0.96)' }
            : { borderTop: '7px solid rgba(15,19,29,0.96)' }),
    }} />
);
