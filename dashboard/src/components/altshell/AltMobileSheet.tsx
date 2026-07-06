/**
 * Generic slide-up bottom sheet for mobile Alt F. Used to show page/content
 * detail when a radial-menu wedge is tapped (see AltActivitySidebar, AltMobileNav).
 */
import React from 'react';
import { S_LOWEST, TEXT, BORDER, FONT } from './AltSidebar';

export const AltMobileSheet: React.FC<{ open: boolean; onClose: () => void; title?: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
    if (!open) return null;
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.6)' }} />
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '78vh', overflowY: 'auto', background: S_LOWEST, borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 1301, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', fontFamily: FONT, color: TEXT }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                    <div style={{ width: 36, height: 4, borderRadius: 99, background: BORDER }} />
                </div>
                {title && (
                    <div style={{ padding: '4px 20px 12px', fontWeight: 800, fontSize: 16, borderBottom: `1px solid ${BORDER}` }}>
                        {title}
                    </div>
                )}
                <div style={{ padding: 16 }}>{children}</div>
            </div>
        </>
    );
};
