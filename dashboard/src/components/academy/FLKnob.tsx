/**
 * FLKnob — FL Studio 21 rotary control.
 * Slate dark knob body, colored arc track, muted indicator.
 */
import React, { useCallback, useRef } from 'react';
import { daw, dawFx, dawFont } from './dawTheme';

interface FLKnobProps {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    size?: number;
    label?: string;
    /** Render `label` as visible text under the knob. Off in the Channel Rack, where
     *  FL shows bare knobs and the row is only 34px tall — the label still names the
     *  control in the hover tooltip either way. */
    showLabel?: boolean;
    color?: string;
    onChange: (value: number) => void;
    highlight?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const FLKnob: React.FC<FLKnobProps> = ({
    value, min = 0, max = 1, step = 0.01,
    size = 36, label, showLabel = true, color = '#8ABF60',
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
        e.preventDefault();
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
                style={{ width: size, height: size, position: 'relative', touchAction: 'none' }}
                title={label ? `${label}: ${value.toFixed(2)}` : value.toFixed(2)}
            >
                <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Inactive track */}
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={daw.well} strokeWidth={2.5}
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
                    background: dawFx.knob,
                    boxShadow: highlight ? `0 0 8px ${color}80` : dawFx.knobShadow,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${highlight ? color : daw.well}`,
                }}>
                    <div style={{
                        width: '100%', height: '100%',
                        transform: `rotate(${rotation}deg)`,
                        display: 'flex', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 2, height: (size - 8) * 0.35,
                            background: daw.text,
                            borderRadius: 1,
                            marginTop: 2,
                        }} />
                    </div>
                </div>
            </div>
            {label && showLabel && (
                <span style={{
                    fontSize: '8px', color: daw.text,
                    textAlign: 'center', lineHeight: 1,
                    fontFamily: dawFont.mono,
                    letterSpacing: '0.02em',
                }}>
                    {label}
                </span>
            )}
        </div>
    );
};
