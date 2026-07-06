/**
 * Generic full-screen radial ("pie") menu — mirrors the mobile nav pattern already
 * shipped on the main site (layouts/DiscoveryLayout.tsx). Reused by AltMobileNav
 * (site navigation) and AltActivitySidebar (page content) so both pie menus share
 * one implementation.
 */
import React from 'react';
import { X } from 'lucide-react';
import { S_CONT, PRIMARY, TEXT, SUB, FONT } from './AltSidebar';

export interface PieItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
}

export const RadialPieMenu: React.FC<{ open: boolean; onClose: () => void; items: PieItem[]; radius?: number }> = ({ open, onClose, items, radius = 108 }) => {
    if (!open) return null;
    const n = items.length;
    const size = radius * 2 + 64;

    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(10,13,22,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}
        >
            <div style={{ position: 'relative', width: size, height: size }} onClick={ev => ev.stopPropagation()}>
                {/* Center close button */}
                <button
                    onClick={onClose}
                    aria-label="Close menu"
                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 56, height: 56, borderRadius: '50%', background: S_CONT, border: `2px solid ${PRIMARY}55`, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                >
                    <X size={22} />
                </button>

                {items.map((item, i) => {
                    // Evenly spaced, starting at the top (-90deg) going clockwise.
                    const angle = (360 / n) * i - 90;
                    const rad = angle * (Math.PI / 180);
                    const x = Math.cos(rad) * radius;
                    const y = Math.sin(rad) * radius;
                    return (
                        <button
                            key={item.key}
                            onClick={() => { item.onClick(); onClose(); }}
                            style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            <div style={{ width: 54, height: 54, borderRadius: '50%', background: item.active ? PRIMARY : 'rgba(255,255,255,0.07)', border: `2px solid ${item.active ? PRIMARY : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.active ? '#fff' : TEXT, boxShadow: item.active ? `0 0 20px ${PRIMARY}66` : 'none' }}>
                                {item.icon}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: item.active ? PRIMARY : SUB, textTransform: 'uppercase' }}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
