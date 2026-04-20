/**
 * Mixer — FL Studio-style mixer console.
 * Scrollable insert tracks with faders, pan knobs, and FX controls.
 */
import React from 'react';
import { colors, borderRadius } from '../../theme/theme';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { Volume2, VolumeX } from 'lucide-react';

/** Vertical fader mimicking FL mixer fader */
const Fader: React.FC<{
    value: number; onChange: (v: number) => void;
    height?: number; label?: string; highlight?: boolean;
}> = ({ value, onChange, height = 120, label, highlight }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);

    const handlePointer = (e: React.PointerEvent) => {
        if (!trackRef.current || !e.buttons) return;
        const rect = trackRef.current.getBoundingClientRect();
        const y = 1 - (e.clientY - rect.top) / rect.height;
        onChange(Math.max(0, Math.min(1, y)));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
                ref={trackRef}
                onPointerDown={handlePointer}
                onPointerMove={handlePointer}
                style={{
                    width: 8, height, cursor: 'pointer',
                    background: '#252729', borderRadius: 4, position: 'relative',
                    border: highlight ? `1px solid ${colors.primary}` : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: highlight ? `0 0 8px ${colors.primary}` : 'none',
                }}
            >
                {/* Fill */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${value * 100}%`,
                    background: `linear-gradient(to top, ${colors.primary}, ${colors.primaryLight})`,
                    borderRadius: 4, transition: 'height 0.05s',
                }} />
                {/* Thumb */}
                <div style={{
                    position: 'absolute', left: '50%', bottom: `${value * 100}%`,
                    transform: 'translate(-50%, 50%)',
                    width: 18, height: 10, borderRadius: 2,
                    background: '#555', border: '1px solid #888',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }} />
            </div>
            {label && (
                <span style={{ fontSize: '9px', color: colors.textSecondary, textAlign: 'center' }}>
                    {label}
                </span>
            )}
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
            background: '#1a1d1f',
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            padding: '12px',
            overflowX: 'auto',
        }}>
            <div style={{ display: 'flex', gap: '2px', minWidth: 'fit-content' }}>
                {inserts.map((ins, idx) => {
                    const isMaster = idx === 0;
                    const hl = highlightInserts?.includes(ins.id) ?? false;
                    return (
                        <div key={ins.id} data-academy-id={`mixer-insert-${ins.id}`} style={{
                            width: 60, padding: '8px 4px',
                            background: isMaster ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255,255,255,0.02)',
                            borderRadius: borderRadius.sm,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            border: hl ? `1px solid ${colors.primary}` : '1px solid transparent',
                            boxShadow: hl ? `0 0 10px ${colors.primary}40` : 'none',
                        }}>
                            {/* Label */}
                            <span style={{
                                fontSize: '9px', fontWeight: 700,
                                color: isMaster ? colors.primary : colors.textSecondary,
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>
                                {ins.label}
                            </span>

                            {/* Pan knob */}
                            <FLKnob value={ins.pan} min={-1} max={1} onChange={v => setInsertPan(ins.id, v)}
                                size={20} color="#F97316" />

                            {/* Volume fader */}
                            <Fader
                                value={isMaster ? masterVolume : ins.volume}
                                onChange={v => isMaster ? setMasterVolume(v) : setInsertVolume(ins.id, v)}
                                height={100}
                                highlight={hl}
                            />

                            {/* dB readout */}
                            <span style={{ fontSize: '9px', color: colors.textTertiary, fontFamily: 'monospace' }}>
                                {((isMaster ? masterVolume : ins.volume) === 0) ? '-inf' : `${(20 * Math.log10(isMaster ? masterVolume : ins.volume)).toFixed(1)}dB`}
                            </span>

                            {/* Mute button */}
                            <button
                                onClick={() => toggleInsertMute(ins.id)}
                                style={{
                                    background: ins.muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${ins.muted ? colors.error : colors.border}`,
                                    borderRadius: '4px', padding: '3px 6px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                title={ins.muted ? 'Unmute' : 'Mute'}
                            >
                                {ins.muted
                                    ? <VolumeX size={12} color={colors.error} />
                                    : <Volume2 size={12} color={colors.textSecondary} />}
                            </button>

                            {/* Reverb knob (non-master only) */}
                            {!isMaster && (
                                <FLKnob value={ins.reverbWet} onChange={v => setInsertReverb(ins.id, v)}
                                    size={20} label="Rev" color="#06B6D4" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
