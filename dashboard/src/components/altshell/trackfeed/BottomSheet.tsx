/**
 * Bottom sheet used by the feed's comments and details panels.
 * Drag the handle down (or tap the scrim) to dismiss, the way native apps do.
 */
import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BORDER, TEXT, SUB, FONT } from '../AltSidebar';

interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    /** Fraction of the viewport the sheet occupies. */
    height?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const BottomSheet: React.FC<Props> = ({ open, title, onClose, height = '70vh', children, footer }) => {
    const [drag, setDrag] = useState(0);
    const startY = useRef<number | null>(null);

    if (!open) return null;

    const onPointerDown = (e: React.PointerEvent) => {
        startY.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (startY.current == null) return;
        setDrag(Math.max(0, e.clientY - startY.current));
    };
    const onPointerUp = () => {
        if (drag > 110) onClose();
        startY.current = null;
        setDrag(0);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', fontFamily: FONT }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', animation: 'fujiFade 0.2s ease-out' }} />
            <div style={{
                position: 'relative', height, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                background: '#12151f', borderTop: `1px solid ${BORDER}`,
                borderTopLeftRadius: 18, borderTopRightRadius: 18,
                boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
                transform: `translateY(${drag}px)`,
                transition: startY.current == null ? 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' : undefined,
                animation: 'fujiSheetIn 0.26s cubic-bezier(0.4,0,0.2,1)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}>
                <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                    style={{ padding: '10px 16px 8px', flexShrink: 0, touchAction: 'none', cursor: 'grab' }}>
                    <div style={{ width: 38, height: 4, borderRadius: 9999, background: 'rgba(255,255,255,0.25)', margin: '0 auto 10px' }} />
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: TEXT, flex: 1 }}>{title}</h3>
                        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, display: 'flex', padding: 4 }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 16px' }}>
                    {children}
                </div>

                {footer && (
                    <div style={{ flexShrink: 0, borderTop: `1px solid ${BORDER}`, padding: '10px 12px', background: '#0f121b' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
