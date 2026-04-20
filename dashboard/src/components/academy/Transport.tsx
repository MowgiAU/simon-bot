/**
 * Transport — FL Studio 21 toolbar.
 * Slate blue-gray, flat recessed controls, muted LCD.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { Play, Square } from 'lucide-react';

interface TransportProps {
    highlightBpm?: boolean;
}

export const Transport: React.FC<TransportProps> = ({ highlightBpm }) => {
    const playing = useDAWStore(s => s.state.transport.playing);
    const bpm = useDAWStore(s => s.state.transport.bpm);
    const swing = useDAWStore(s => s.state.transport.swing);
    const currentStep = useDAWStore(s => s.state.transport.currentStep);
    const play = useDAWStore(s => s.play);
    const stop = useDAWStore(s => s.stop);
    const setBpm = useDAWStore(s => s.setBpm);
    const setSwing = useDAWStore(s => s.setSwing);
    const initEngine = useDAWStore(s => s.initEngine);

    const handlePlay = async () => {
        await initEngine();
        if (playing) { stop(); } else { play(); }
    };

    const pat = `${Math.floor(currentStep / 4) + 1}`;
    const beat = `${(currentStep % 4) + 1}`;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#333A48',
            borderBottom: '1px solid #2E3440',
            padding: '5px 10px',
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
        }}>
            {/* Transport buttons */}
            <div style={{
                display: 'flex', gap: '1px',
                background: '#2A3040',
                borderRadius: '3px',
                padding: '2px',
            }}>
                <button onClick={() => stop()} style={{
                    width: 26, height: 22, border: 'none', borderRadius: '2px',
                    background: !playing ? '#4A5268' : '#363C4A',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Square size={8} color={!playing ? '#C0C8D8' : '#6A7080'} fill={!playing ? '#C0C8D8' : '#6A7080'} />
                </button>
                <button onClick={handlePlay} style={{
                    width: 26, height: 22, border: 'none', borderRadius: '2px',
                    background: playing ? '#3A5040' : '#363C4A',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Play size={10} color={playing ? '#8ABF60' : '#6A7080'} fill={playing ? '#8ABF60' : 'none'} />
                </button>
            </div>

            {/* Position display */}
            <div style={{
                background: '#1E2430',
                border: '1px solid #2A3040',
                borderRadius: '2px',
                padding: '2px 8px',
                display: 'flex', alignItems: 'baseline', gap: '2px',
                fontFamily: 'monospace',
                minWidth: 50,
            }}>
                <span style={{ fontSize: '13px', color: '#8ABF60', fontWeight: 700 }}>{pat}</span>
                <span style={{ fontSize: '9px', color: '#5A7050' }}>:</span>
                <span style={{ fontSize: '13px', color: '#8ABF60', fontWeight: 700 }}>{beat}</span>
            </div>

            {/* Step indicator dots */}
            <div style={{
                display: 'flex', gap: '2px',
                background: '#2A3040',
                borderRadius: '2px',
                padding: '3px 5px',
            }}>
                {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: i === currentStep && playing
                            ? '#8ABF60'
                            : i % 4 === 0
                                ? '#5A6478'
                                : '#3A4050',
                        boxShadow: i === currentStep && playing ? '0 0 3px #8ABF60' : 'none',
                        transition: 'background 0.05s',
                    }} />
                ))}
            </div>

            {/* BPM */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: '#2A3040',
                borderRadius: '2px',
                padding: '2px 5px',
                border: highlightBpm ? '1px solid #60C0A0' : '1px solid transparent',
                boxShadow: highlightBpm ? '0 0 4px rgba(96,192,160,0.3)' : 'none',
            }}>
                <span style={{ fontSize: '9px', color: '#6A7080', fontWeight: 600 }}>BPM</span>
                <input
                    type="number"
                    value={bpm}
                    min={40} max={300}
                    onChange={e => setBpm(Number(e.target.value) || 120)}
                    style={{
                        width: 40, background: '#1E2430', border: '1px solid #2A3040',
                        borderRadius: '2px', padding: '1px 3px', color: '#8ABF60',
                        fontSize: '12px', fontFamily: 'monospace', textAlign: 'center',
                        outline: 'none',
                    }}
                />
            </div>

            {/* Swing knob */}
            <FLKnob value={swing} onChange={setSwing} size={22} label="Swing" color="#8A9AB0" />
        </div>
    );
};
