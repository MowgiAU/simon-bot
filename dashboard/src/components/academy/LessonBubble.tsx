/**
 * LessonBubble — a coachmark-style speech bubble that points at whichever
 * DAW control the current lesson step cares about (a specific step cell, a
 * whole channel row, the play/stop button, or the simulator frame itself as
 * a fallback for plain instruction steps).
 *
 * Position is measured at runtime against `containerRef` (which must be
 * `position: relative`) rather than computed from layout constants, so it
 * keeps working if the DAW's own styling changes.
 */
import React, { useLayoutEffect, useState } from 'react';

interface LessonBubbleProps {
    containerRef: React.RefObject<HTMLElement>;
    targetId: string | null;
    text: string;
    hint?: string;
    showHint?: boolean;
}

interface BubblePos {
    left: number;
    top: number;
    /** Bubble renders above the target by default; flip below if there's no room */
    below: boolean;
}

export const LessonBubble: React.FC<LessonBubbleProps> = ({ containerRef, targetId, text, hint, showHint }) => {
    const [pos, setPos] = useState<BubblePos | null>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !targetId) { setPos(null); return; }

        const update = () => {
            const el = container.querySelector(`[data-academy-id="${targetId}"]`) as HTMLElement | null;
            if (!el) { setPos(null); return; }
            const cRect = container.getBoundingClientRect();
            const eRect = el.getBoundingClientRect();
            const top = eRect.top - cRect.top;
            setPos({
                left: eRect.left - cRect.left + eRect.width / 2,
                top,
                below: top < 70, // not enough room above — flip the bubble under the target
            });
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(container);
        window.addEventListener('resize', update);
        return () => { ro.disconnect(); window.removeEventListener('resize', update); };
    }, [containerRef, targetId]);

    if (!pos) return null;

    return (
        <div style={{
            position: 'absolute',
            left: pos.left,
            top: pos.top,
            transform: pos.below ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 14px))',
            zIndex: 50,
            pointerEvents: 'none',
            maxWidth: 280,
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
