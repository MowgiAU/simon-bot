/**
 * DAWWindow — a free-moving, resizable window inside the FL workspace.
 *
 * Drag: pointer-down on any descendant marked `data-daw-drag` (each panel uses its
 * own FL title bar as the handle, so the chrome stays authentic). Panels that have
 * no title bar of their own — the Piano Roll — get one from `chrome`.
 *
 * Move/resize listeners live on `window`, not the element, so a fast drag that
 * outruns the pointer doesn't drop the gesture. Positions are clamped to the
 * workspace so a window can never be dragged somewhere it can't be grabbed back.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { daw, dawFx, dawFont, flPlaylist as fl } from './dawTheme';

export interface WindowRect { x: number; y: number; w: number; h: number; }

interface DAWWindowProps {
    title: string;
    rect: WindowRect;
    z: number;
    /** Render a title bar (for panels without their own) */
    chrome?: boolean;
    resizable?: boolean;
    minW?: number;
    minH?: number;
    onChange: (rect: WindowRect) => void;
    onFocus: () => void;
    onClose: () => void;
    /** Bounds to clamp within — the workspace canvas */
    bounds: { w: number; h: number };
    children: React.ReactNode;
}

const TITLE_H = 22;

export const DAWWindow: React.FC<DAWWindowProps> = ({
    title, rect, z, chrome = false, resizable = true,
    minW = 260, minH = 120,
    onChange, onFocus, onClose, bounds, children,
}) => {
    const [mode, setMode] = useState<'drag' | 'resize' | null>(null);
    const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

    const begin = useCallback((kind: 'drag' | 'resize', e: React.PointerEvent) => {
        origin.current = { px: e.clientX, py: e.clientY, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
        setMode(kind);
        onFocus();
    }, [rect, onFocus]);

    useEffect(() => {
        if (!mode) return;
        const move = (e: PointerEvent) => {
            const o = origin.current;
            const dx = e.clientX - o.px;
            const dy = e.clientY - o.py;
            if (mode === 'drag') {
                // Keep at least the title bar reachable inside the canvas
                const x = Math.max(-(rect.w - 80), Math.min(bounds.w - 80, o.x + dx));
                const y = Math.max(0, Math.min(Math.max(0, bounds.h - TITLE_H), o.y + dy));
                onChange({ ...rect, x, y });
            } else {
                onChange({
                    ...rect,
                    w: Math.max(minW, Math.min(bounds.w - rect.x, o.w + dx)),
                    h: Math.max(minH, Math.min(bounds.h - rect.y, o.h + dy)),
                });
            }
        };
        const up = () => setMode(null);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
    }, [mode, rect, bounds, minW, minH, onChange]);

    return (
        <div
            onPointerDown={e => {
                onFocus();
                // Any element tagged as a drag handle starts a move
                if ((e.target as HTMLElement).closest('[data-daw-drag]')) begin('drag', e);
            }}
            data-academy-id={`daw-window-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            style={{
                position: 'absolute',
                left: rect.x, top: rect.y, width: rect.w,
                zIndex: z,
                boxShadow: dawFx.windowShadow,
                border: `1px solid ${daw.border}`,
                borderRadius: 3,
                overflow: 'hidden',
                background: daw.bg,
                // While dragging, don't let the pointer land on inner controls
                userSelect: mode ? 'none' : undefined,
            }}>
            {chrome && (
                <div data-daw-drag style={{
                    height: TITLE_H, background: fl.windowBar,
                    borderBottom: `1px solid ${daw.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 8px', cursor: 'grab',
                }}>
                    <span style={{
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: fl.text, fontWeight: 600,
                    }}>{title}</span>
                    <button onClick={onClose} title="Close"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 1 }}>
                        <X size={11} color={fl.textDim} />
                    </button>
                </div>
            )}

            <div style={{ height: chrome ? rect.h - TITLE_H : rect.h, overflow: 'auto' }}>
                {children}
            </div>

            {resizable && (
                <div
                    onPointerDown={e => { e.preventDefault(); begin('resize', e); }}
                    title="Resize"
                    style={{
                        position: 'absolute', right: 0, bottom: 0,
                        width: 14, height: 14, cursor: 'nwse-resize',
                        // Two hairlines, the way FL draws its resize grip
                        background: `linear-gradient(135deg, transparent 45%, ${daw.textDim} 45%, ${daw.textDim} 55%, transparent 55%,`
                            + ` transparent 70%, ${daw.textDim} 70%, ${daw.textDim} 80%, transparent 80%)`,
                        zIndex: 2,
                    }}
                />
            )}
        </div>
    );
};

export { TITLE_H as DAW_WINDOW_TITLE_H };
