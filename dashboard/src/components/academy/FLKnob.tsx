/**
 * FLKnob — Rotary control mimicking FL Studio 21 knob.
 * Authentic FL look: dark recessed well, orange/green arc, silver indicator.
 */
import React, { useCallback, useRef } from 'react';

interface FLKnobProps {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    size?: number;
    label?: string;
    color?: string;
    onChange: (value: number) => void;
    highlight?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const FLKnob: React.FC<FLKnobProps> = ({
    value, min = 0, max = 1, step = 0.01,
    size = 36, label, color = '#6B8A7A',
    onChange, highlight = false,
}) => {
    const startY = useRef(0);
    const startVal = useRef(0);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        startY.current = e.clientY;
        startVal.current = value;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }, [value]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!e.buttons) return;
        const delta = (startY.current - e.clientY) / 150;
        const range = max - min;
        let newVal = startVal.current + delta * range;
        newVal = Math.round(newVal / step) * step;
        newVal = clamp(newVal, min, max);
        onChange(newVal);
    }, [min, max, step, onChange]);

    const normalized = (value - min) / (max - min);
    const rotation = -135 + normalized * 270;
    // SVG arc for the value track
    const r = (size / 2) - 2;
    const cx = size / 2;
    const cy = size / 2;
    const startAngle = 225; // degrees (bottom-left)
    const sweepAngle = normalized * 270;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const arcStart = { x: cx + r * Math.cos(toRad(startAngle)), y: cy + r * Math.sin(toRad(startAngle)) };
    const arcEnd = { x: cx + r * Math.cos(toRad(startAngle + sweepAngle)), y: cy + r * Math.sin(toRad(startAngle + sweepAngle)) };
    const largeArc = sweepAngle > 180 ? 1 : 0;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            cursor: 'ns-resize', userSelect: 'none',
        }}>
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                style={{
                    width: size, height: size, position: 'relative',
                }}
                title={`${label ?? ''}: ${value.toFixed(2)}`}
            >
                {/* Background track SVG */}
                <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Inactive track */}
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A2A2A" strokeWidth={3}
                        strokeDasharray={`${(270/360) * 2 * Math.PI * r} ${(90/360) * 2 * Math.PI * r}`}
                        strokeDashoffset={-(90/360) * 2 * Math.PI * r - (45/360) * 2 * Math.PI * r}
                        strokeLinecap="round"
                    />
                    {/* Active arc */}
                    {sweepAngle > 0.5 && (
                        <path
                            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
                            fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
                        />
                    )}
                </svg>
                {/* Inner knob body */}
                <div style={{
                    position: 'absolute',
                    top: 4, left: 4,
                    width: size - 8, height: size - 8,
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg, #3D3D3D 0%, #282828 50%, #1E1E1E 100%)',
                    boxShadow: highlight
                        ? `0 0 10px ${color}80, inset 0 1px 2px rgba(255,255,255,0.08)`
                        : 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: highlight ? `1px solid ${color}60` : '1px solid #444',
                }}>
                    {/* Rotating indicator */}
                    <div style={{
                        width: '100%', height: '100%',
                        transform: `rotate(${rotation}deg)`,
                        display: 'flex', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 2, height: (size - 8) * 0.32,
                            background: '#C0C0C0',
                            borderRadius: 1,
                            marginTop: 3,
                        }} />
                    </div>
                </div>
            </div>
            {label && (
                <span style={{
                    fontSize: '9px', color: '#888',
                    textAlign: 'center', lineHeight: 1,
                    fontFamily: "'Segoe UI', Tahoma, sans-serif",
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                    {label}
                </span>
            )}
        </div>
    );
};
