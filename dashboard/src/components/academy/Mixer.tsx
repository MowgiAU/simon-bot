/**
 * Mixer — FL Studio 21 mixer console.
 * Slate blue-gray palette, segmented meters, flat faders.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';

// FL21 palette
const BG          = '#3A4050';
const STRIP_BG    = '#333A48';
const STRIP_MASTER= '#344038';
const BORDER      = '#2E3440';
const TITLE_BG    = '#333A48';
const LCD_BG      = '#1E2430';
const METER_BG    = '#1E2430';
const FADER_TRACK = '#1E2430';
const FADER_FILL  = '#4A6478';
const FADER_FILL_M= '#4A7858';
const FADER_THUMB = 'linear-gradient(180deg, #8090A0 0%, #606878 40%, #4A5268 100%)';
const LED_ON      = '#8ABF60';
const LED_MUTE    = '#BF5050';
const TEXT_DIM    = '#6A7080';
const TEXT_LIGHT  = '#B0B8C8';

/** Vertical fader */
const Fader: React.FC<{
    value: number; onChange: (v: number) => void;
    height?: number; highlight?: boolean; isMaster?: boolean;
}> = ({ value, onChange, height = 100, highlight, isMaster }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);

    const handlePointer = (e: React.PointerEvent) => {
        if (!trackRef.current || !e.buttons) return;
        const rect = trackRef.current.getBoundingClientRect();
        const y = 1 - (e.clientY - rect.top) / rect.height;
        onChange(Math.max(0, Math.min(1.25, y)));
    };

    const fillPct = Math.min(value / 1.25, 1) * 100;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
                ref={trackRef}
                onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); handlePointer(e); }}
                onPointerMove={handlePointer}
                style={{
                    width: 8, height, cursor: 'pointer',
                    background: FADER_TRACK,
                    borderRadius: 2, position: 'relative',
                    border: highlight ? '1px solid #60C0A0' : `1px solid ${BORDER}`,
                    boxShadow: highlight ? '0 0 4px rgba(96,192,160,0.3)' : 'none',
                }}
            >
                {/* Groove marks */}
                {[0.25, 0.5, 0.75, 1.0].map(mark => (
                    <div key={mark} style={{
                        position: 'absolute', left: -2, right: -2,
                        bottom: `${(mark / 1.25) * 100}%`,
                        height: 1, background: '#4A5268',
                    }} />
                ))}
                {/* Fill */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 1, right: 1,
                    height: `${fillPct}%`,
                    background: isMaster ? FADER_FILL_M : FADER_FILL,
                    borderRadius: '0 0 1px 1px',
                    transition: 'height 0.04s',
                }} />
                {/* Thumb */}
                <div style={{
                    position: 'absolute', left: '50%', bottom: `${fillPct}%`,
                    transform: 'translate(-50%, 50%)',
                    width: 16, height: 10, borderRadius: 2,
                    background: FADER_THUMB,
                    border: `1px solid #8090A0`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }} />
            </div>
        </div>
    );
};

/** Segmented peak meter */
const PeakMeter: React.FC<{ value: number }> = ({ value }) => {
    const segments = 16;
    const litCount = Math.round(Math.min(value, 1) * segments);
    return (
        <div style={{
            display: 'flex', flexDirection: 'column-reverse', gap: '1px',
            width: 4, height: 100,
        }}>
            {Array.from({ length: segments }, (_, i) => {
                const lit = i < litCount;
                const isRed = i >= 14;
                const isYellow = i >= 11 && i < 14;
                return (
                    <div key={i} style={{
                        flex: 1,
                        borderRadius: 0.5,
                        background: lit
                            ? isRed ? '#C05050' : isYellow ? '#B0A050' : '#5A9A50'
                            : '#2A3040',
                        transition: 'background 0.05s',
                    }} />
                );
            })}
        </div>
    );
};

interface MixerProps {
    highlightInserts?: number[];
}

export const Mixer: React.FC<MixerProps> = ({ highlightInserts }) => {
    const inserts = useDAWStore(s => s.state.mixerInserts);
    const masterVolume = useDAWStore(s => s.state.masterVolume);
    const setInsertVolume = useDAWStore(s => s.setInsertVolume);
    const setInsertPan = useDAWStore(s => s.setInsertPan);
    const toggleInsertMute = useDAWStore(s => s.toggleInsertMute);
    const setInsertReverb = useDAWStore(s => s.setInsertReverb);
    const setMasterVolume = useDAWStore(s => s.setMasterVolume);

    return (
        <div style={{
            background: BG,
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
            overflow: 'hidden',
        }}>
            {/* Title bar */}
            <div style={{
                height: 26,
                background: TITLE_BG,
                borderBottom: `1px solid #4A5060`,
                display: 'flex', alignItems: 'center',
                padding: '0 10px',
            }}>
                <span style={{ fontSize: '11px', color: TEXT_LIGHT, fontWeight: 500 }}>Mixer</span>
            </div>

            <div style={{
                display: 'flex', gap: '1px',
                overflowX: 'auto', padding: '4px',
                background: '#2E3440',
            }}>
                {inserts.map((ins, idx) => {
                    const isMaster = idx === 0;
                    const hl = highlightInserts?.includes(ins.id) ?? false;
                    const vol = isMaster ? masterVolume : ins.volume;
                    const dbVal = vol === 0 ? '-∞' : `${(20 * Math.log10(vol)).toFixed(1)}`;

                    return (
                        <div key={ins.id} data-academy-id={`mixer-insert-${ins.id}`} style={{
                            width: 52,
                            padding: '6px 3px',
                            background: isMaster ? STRIP_MASTER : STRIP_BG,
                            borderRadius: '2px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                            border: hl ? '1px solid #60C0A0' : `1px solid ${BORDER}`,
                            boxShadow: hl ? '0 0 6px rgba(96,192,160,0.3)' : 'none',
                        }}>
                            {/* Insert label */}
                            <span style={{
                                fontSize: '8px', fontWeight: 600,
                                color: isMaster ? LED_ON : TEXT_DIM,
                                letterSpacing: '0.03em',
                                whiteSpace: 'nowrap',
                            }}>
                                {ins.label}
                            </span>

                            {/* Pan */}
                            <FLKnob value={ins.pan} min={-1} max={1} onChange={v => setInsertPan(ins.id, v)}
                                size={16} color="#8A9AB0" />

                            {/* Fader + peak meter */}
                            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end' }}>
                                <PeakMeter value={vol} />
                                <Fader
                                    value={vol}
                                    onChange={v => isMaster ? setMasterVolume(v) : setInsertVolume(ins.id, v)}
                                    height={90}
                                    highlight={hl}
                                    isMaster={isMaster}
                                />
                            </div>

                            {/* dB readout */}
                            <span style={{
                                fontSize: '8px', color: TEXT_DIM, fontFamily: 'monospace',
                                background: LCD_BG, padding: '1px 3px', borderRadius: 1,
                            }}>
                                {dbVal}
                            </span>

                            {/* Mute LED */}
                            <div
                                onClick={() => toggleInsertMute(ins.id)}
                                style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: ins.muted ? LED_MUTE : LED_ON,
                                    boxShadow: `0 0 3px ${ins.muted ? LED_MUTE : LED_ON}50`,
                                    cursor: 'pointer',
                                }}
                                title={ins.muted ? 'Unmute' : 'Mute'}
                            />

                            {/* Reverb knob (non-master) */}
                            {!isMaster && (
                                <FLKnob value={ins.reverbWet} onChange={v => setInsertReverb(ins.id, v)}
                                    size={16} label="Rev" color="#6A8AAA" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
