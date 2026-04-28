/**
 * FLKnob — FL Studio 21 rotary control.
 * Slate dark knob body, colored arc track, muted indicator.
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
    size = 36, label, color = '#8ABF60',
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
    const r = (size / 2) - 2;
    const cx = size / 2;
    const cy = size / 2;
    const startAngle = 225;
    const sweepAngle = normalized * 270;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const arcStart = { x: cx + r * Math.cos(toRad(startAngle)), y: cy + r * Math.sin(toRad(startAngle)) };
    const arcEnd = { x: cx + r * Math.cos(toRad(startAngle + sweepAngle)), y: cy + r * Math.sin(toRad(startAngle + sweepAngle)) };
    const largeArc = sweepAngle > 180 ? 1 : 0;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
            cursor: 'ns-resize', userSelect: 'none',
        }}>
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                style={{ width: size, height: size, position: 'relative' }}
                title={`${label ?? ''}: ${value.toFixed(2)}`}
            >
                <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Inactive track */}
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A3040" strokeWidth={2.5}
                        strokeDasharray={`${(270/360) * 2 * Math.PI * r} ${(90/360) * 2 * Math.PI * r}`}
                        strokeDashoffset={-(90/360) * 2 * Math.PI * r - (45/360) * 2 * Math.PI * r}
                        strokeLinecap="round"
                    />
                    {/* Active arc */}
                    {sweepAngle > 0.5 && (
                        <path
                            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
                            fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"
                        />
                    )}
                </svg>
                {/* Knob body */}
                <div style={{
                    position: 'absolute',
                    top: 4, left: 4,
                    width: size - 8, height: size - 8,
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg, #4A5268 0%, #363C4A 50%, #2E3440 100%)',
                    boxShadow: highlight
                        ? `0 0 8px ${color}60`
                        : '0 1px 3px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: highlight ? `1px solid ${color}50` : '1px solid #4A5268',
                }}>
                    <div style={{
                        width: '100%', height: '100%',
                        transform: `rotate(${rotation}deg)`,
                        display: 'flex', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 1.5, height: (size - 8) * 0.30,
                            background: '#B0B8C8',
                            borderRadius: 1,
                            marginTop: 2,
                        }} />
                    </div>
                </div>
            </div>
            {label && (
                <span style={{
                    fontSize: '8px', color: '#6A7080',
                    textAlign: 'center', lineHeight: 1,
                    fontFamily: "'Segoe UI', Tahoma, sans-serif",
                    letterSpacing: '0.02em',
                }}>
                    {label}
                </span>
            )}
        </div>
    );
};
