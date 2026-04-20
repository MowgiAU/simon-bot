/**
 * Mixer — FL Studio 21 authentic mixer console.
 * Dark recessed strips, green peak meters, silver faders.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';

/** Vertical fader — FL Studio style with grooved track and silver thumb */
const Fader: React.FC<{
    value: number; onChange: (v: number) => void;
    height?: number; highlight?: boolean; isMaster?: boolean;
}> = ({ value, onChange, height = 120, highlight, isMaster }) => {
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
                    width: 10, height, cursor: 'pointer',
                    background: '#1A1A1A',
                    borderRadius: 2, position: 'relative',
                    border: highlight ? '1px solid #10B981' : '1px solid #333',
                    boxShadow: highlight ? '0 0 6px #10B98140' : 'inset 0 1px 3px rgba(0,0,0,0.6)',
                }}
            >
                {/* Groove marks */}
                {[0.25, 0.5, 0.75, 1.0].map(mark => (
                    <div key={mark} style={{
                        position: 'absolute', left: 0, right: 0,
                        bottom: `${(mark / 1.25) * 100}%`,
                        height: 1, background: '#444',
                    }} />
                ))}
                {/* Fill */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 1, right: 1,
                    height: `${fillPct}%`,
                    background: isMaster
                        ? 'linear-gradient(to top, #3A7A50, #6FBF40)'
                        : 'linear-gradient(to top, #3A5A7A, #5A9ABF)',
                    borderRadius: '0 0 1px 1px',
                    transition: 'height 0.04s',
                }} />
                {/* Thumb — silver knurl */}
                <div style={{
                    position: 'absolute', left: '50%', bottom: `${fillPct}%`,
                    transform: 'translate(-50%, 50%)',
                    width: 20, height: 12, borderRadius: 2,
                    background: 'linear-gradient(180deg, #AAA 0%, #777 40%, #555 100%)',
                    border: '1px solid #999',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    // Knurl lines
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)',
                }} />
            </div>
        </div>
    );
};

/** Tiny peak meter beside fader */
const PeakMeter: React.FC<{ value: number }> = ({ value }) => {
    const h = Math.min(value, 1) * 100;
    return (
        <div style={{
            width: 4, height: 120, background: '#1A1A1A',
            borderRadius: 1, position: 'relative', overflow: 'hidden',
            border: '1px solid #333',
        }}>
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${h}%`,
                background: h > 85
                    ? 'linear-gradient(to top, #6FBF40, #BFD040 70%, #E84040 100%)'
                    : 'linear-gradient(to top, #3A7A50, #6FBF40)',
                transition: 'height 0.06s',
            }} />
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
            background: '#2B2B2B',
            border: '1px solid #3A3A3A',
            borderRadius: '4px',
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
            overflow: 'hidden',
        }}>
            {/* Title bar */}
            <div style={{
                height: 24,
                background: 'linear-gradient(180deg, #4A4A4A 0%, #3A3A3A 100%)',
                borderBottom: '1px solid #555',
                display: 'flex', alignItems: 'center',
                padding: '0 8px',
            }}>
                <span style={{ fontSize: '11px', color: '#CCC', fontWeight: 600 }}>Mixer</span>
            </div>

            <div style={{
                display: 'flex', gap: '1px',
                overflowX: 'auto', padding: '6px',
                background: '#222',
            }}>
                {inserts.map((ins, idx) => {
                    const isMaster = idx === 0;
                    const hl = highlightInserts?.includes(ins.id) ?? false;
                    const vol = isMaster ? masterVolume : ins.volume;
                    const dbVal = vol === 0 ? '-inf' : `${(20 * Math.log10(vol)).toFixed(1)}`;

                    return (
                        <div key={ins.id} data-academy-id={`mixer-insert-${ins.id}`} style={{
                            width: 56,
                            padding: '8px 4px',
                            background: isMaster ? '#2A3530' : '#252525',
                            borderRadius: '3px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            border: hl ? '1px solid #10B981' : isMaster ? '1px solid #3A5A4A' : '1px solid #333',
                            boxShadow: hl ? '0 0 8px #10B98140' : 'none',
                        }}>
                            {/* Insert label */}
                            <span style={{
                                fontSize: '9px', fontWeight: 700,
                                color: isMaster ? '#6FBF40' : '#888',
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                            }}>
                                {ins.label}
                            </span>

                            {/* Pan */}
                            <FLKnob value={ins.pan} min={-1} max={1} onChange={v => setInsertPan(ins.id, v)}
                                size={18} color="#E88C3A" />

                            {/* Fader + peak meter */}
                            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end' }}>
                                <PeakMeter value={vol} />
                                <Fader
                                    value={vol}
                                    onChange={v => isMaster ? setMasterVolume(v) : setInsertVolume(ins.id, v)}
                                    height={100}
                                    highlight={hl}
                                    isMaster={isMaster}
                                />
                            </div>

                            {/* dB readout */}
                            <span style={{
                                fontSize: '8px', color: '#777', fontFamily: 'monospace',
                                background: '#1A1A1A', padding: '1px 4px', borderRadius: 2,
                                border: '1px solid #333',
                            }}>
                                {dbVal}
                            </span>

                            {/* Mute button — FL style */}
                            <div
                                onClick={() => toggleInsertMute(ins.id)}
                                style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: ins.muted ? '#E84040' : '#6FBF40',
                                    boxShadow: ins.muted ? '0 0 4px #E8404060' : '0 0 4px #6FBF4060',
                                    cursor: 'pointer',
                                    border: '1px solid #555',
                                }}
                                title={ins.muted ? 'Unmute' : 'Mute'}
                            />

                            {/* Reverb knob (non-master) */}
                            {!isMaster && (
                                <FLKnob value={ins.reverbWet} onChange={v => setInsertReverb(ins.id, v)}
                                    size={18} label="Rev" color="#5AAFCF" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
