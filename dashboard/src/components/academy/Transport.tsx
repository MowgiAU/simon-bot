/**
 * Transport — FL Studio 21 authentic toolbar transport.
 * Dark toolbar with recessed displays, classic play/stop/record buttons.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { Play, Square, SkipBack } from 'lucide-react';

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
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'linear-gradient(180deg, #3A3A3A 0%, #2E2E2E 50%, #2A2A2A 100%)',
            borderBottom: '1px solid #444',
            padding: '6px 12px',
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
        }}>
            {/* Transport buttons — FL style recessed button group */}
            <div style={{
                display: 'flex', gap: '2px',
                background: '#1A1A1A',
                borderRadius: '3px',
                padding: '3px',
                border: '1px solid #333',
            }}>
                {/* Stop */}
                <button onClick={() => stop()} style={{
                    width: 28, height: 24, border: 'none', borderRadius: '2px',
                    background: !playing ? '#3A3A3A' : '#2A2A2A',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Square size={10} color={!playing ? '#E8E8E8' : '#888'} fill={!playing ? '#E8E8E8' : '#888'} />
                </button>
                {/* Play */}
                <button onClick={handlePlay} style={{
                    width: 28, height: 24, border: 'none', borderRadius: '2px',
                    background: playing ? '#2A5A3A' : '#2A2A2A',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Play size={12} color={playing ? '#6FBF40' : '#888'} fill={playing ? '#6FBF40' : '#888'} />
                </button>
            </div>

            {/* Position display — FL recessed LCD */}
            <div style={{
                background: '#0A0A0A',
                border: '1px solid #333',
                borderRadius: '3px',
                padding: '3px 8px',
                display: 'flex', alignItems: 'baseline', gap: '2px',
                fontFamily: 'monospace',
                minWidth: 60,
            }}>
                <span style={{ fontSize: '14px', color: '#6FBF40', fontWeight: 700 }}>{pat}</span>
                <span style={{ fontSize: '10px', color: '#4A8A30' }}>:</span>
                <span style={{ fontSize: '14px', color: '#6FBF40', fontWeight: 700 }}>{beat}</span>
            </div>

            {/* Step indicator dots */}
            <div style={{
                display: 'flex', gap: '2px',
                background: '#1A1A1A',
                borderRadius: '3px',
                padding: '4px 6px',
                border: '1px solid #333',
            }}>
                {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: i === currentStep && playing
                            ? '#6FBF40'
                            : i % 4 === 0
                                ? '#555'
                                : '#333',
                        boxShadow: i === currentStep && playing ? '0 0 4px #6FBF40' : 'none',
                        transition: 'background 0.06s',
                    }} />
                ))}
            </div>

            {/* BPM display — FL tempo control */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: '#1A1A1A',
                borderRadius: '3px',
                padding: '3px 6px',
                border: highlightBpm ? '1px solid #10B981' : '1px solid #333',
                boxShadow: highlightBpm ? '0 0 6px #10B98140' : 'none',
            }}>
                <span style={{ fontSize: '9px', color: '#888', fontWeight: 600 }}>BPM</span>
                <input
                    type="number"
                    value={bpm}
                    min={40} max={300}
                    onChange={e => setBpm(Number(e.target.value) || 120)}
                    style={{
                        width: 44, background: '#0A0A0A', border: '1px solid #333',
                        borderRadius: '2px', padding: '2px 4px', color: '#6FBF40',
                        fontSize: '13px', fontFamily: 'monospace', textAlign: 'center',
                        outline: 'none',
                    }}
                />
            </div>

            {/* Swing knob */}
            <FLKnob value={swing} onChange={setSwing} size={24} label="Swing" color="#E88C3A" />
        </div>
    );
};
