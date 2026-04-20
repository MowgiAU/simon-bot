/**
 * FLKnob — Rotary control mimicking FL Studio 21 knob.
 * Uses mouse-delta tracking (vertical drag = value change).
 */
import React, { useCallback, useRef } from 'react';
import { colors } from '../../theme/theme';

interface FLKnobProps {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    size?: number;
    label?: string;
    color?: string;
    onChange: (value: number) => void;
    /** If true, highlight this knob (for lesson engine) */
    highlight?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const FLKnob: React.FC<FLKnobProps> = ({
    value, min = 0, max = 1, step = 0.01,
    size = 36, label, color = colors.primary,
    onChange, highlight = false,
}) => {
    const knobRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startVal = useRef(0);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        startY.current = e.clientY;
        startVal.current = value;
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
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

    // Rotation: map value to -135..135 degrees
    const normalized = (value - min) / (max - min);
    const rotation = -135 + normalized * 270;

    return (
        <div
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                cursor: 'ns-resize', userSelect: 'none',
            }}
        >
            <div
                ref={knobRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                style={{
                    width: size, height: size,
                    borderRadius: '50%',
                    background: `conic-gradient(from 225deg, ${color} ${normalized * 270}deg, ${colors.surfaceLight} 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: highlight
                        ? `0 0 12px ${colors.primary}, 0 0 4px ${colors.primary}`
                        : `0 2px 6px rgba(0,0,0,0.4)`,
                    border: `2px solid ${highlight ? colors.primary : colors.border}`,
                    transition: 'box-shadow 0.2s',
                }}
                title={`${label ?? ''}: ${value.toFixed(2)}`}
            >
                {/* Indicator dot */}
                <div style={{
                    width: size * 0.65, height: size * 0.65,
                    borderRadius: '50%',
                    background: '#313537',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.05s linear',
                }}>
                    <div style={{
                        width: 3, height: size * 0.22,
                        background: color,
                        borderRadius: 2,
                        marginTop: `-${size * 0.12}px`,
                    }} />
                </div>
            </div>
            {label && (
                <span style={{ fontSize: '10px', color: colors.textSecondary, textAlign: 'center', lineHeight: 1.2 }}>
                    {label}
                </span>
            )}
        </div>
    );
};
