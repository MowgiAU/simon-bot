/**
 * Transport — FL Studio 21 toolbar.
 * Slate blue-gray, flat recessed controls, muted LCD.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { Play, Square } from 'lucide-react';
import { daw, dawFont } from './dawTheme';

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
            background: daw.surfaceContainerHigh,
            borderBottom: `1px solid ${daw.outlineVariant}`,
            padding: '5px 10px',
            fontFamily: dawFont.sans,
        }}>
            {/* Transport buttons */}
            <div style={{
                display: 'flex', gap: '1px',
                background: daw.surfaceContainerLowest,
                borderRadius: '3px',
                padding: '2px',
            }}>
                <button onClick={() => stop()} data-academy-id="transport-stop" style={{
                    width: 26, height: 22, border: 'none', borderRadius: '2px',
                    background: !playing ? daw.surfaceVariant : daw.surfaceContainer,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Square size={8}
                        color={!playing ? daw.onSurface : daw.onSurfaceVariant}
                        fill={!playing ? daw.onSurface : daw.onSurfaceVariant} />
                </button>
                <button onClick={handlePlay} data-academy-id="transport-play" style={{
                    width: 26, height: 22, border: 'none', borderRadius: '2px',
                    background: playing ? daw.onPrimary : daw.surfaceContainer,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Play size={10}
                        color={playing ? daw.primaryContainer : daw.onSurfaceVariant}
                        fill={playing ? daw.primaryContainer : 'none'} />
                </button>
            </div>

            {/* Position display */}
            <div style={{
                background: daw.surfaceContainerLowest,
                border: `1px solid ${daw.outlineVariant}`,
                borderRadius: '2px',
                padding: '2px 8px',
                display: 'flex', alignItems: 'baseline', gap: '2px',
                fontFamily: dawFont.mono,
                minWidth: 50,
            }}>
                <span style={{ fontSize: '13px', color: daw.primaryContainer, fontWeight: 700 }}>{pat}</span>
                <span style={{ fontSize: '9px', color: daw.outline }}>:</span>
                <span style={{ fontSize: '13px', color: daw.primaryContainer, fontWeight: 700 }}>{beat}</span>
            </div>

            {/* Step indicator dots */}
            <div style={{
                display: 'flex', gap: '2px',
                background: daw.surfaceContainerLowest,
                borderRadius: '2px',
                padding: '3px 5px',
            }}>
                {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: i === currentStep && playing
                            ? daw.primaryContainer
                            : i % 4 === 0
                                ? daw.outline
                                : daw.surfaceVariant,
                        boxShadow: i === currentStep && playing ? `0 0 3px ${daw.primaryContainer}` : 'none',
                        transition: 'background 0.05s',
                    }} />
                ))}
            </div>

            {/* BPM */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: daw.surfaceContainerLowest,
                borderRadius: '2px',
                padding: '2px 5px',
                border: `1px solid ${highlightBpm ? daw.primaryContainer : 'transparent'}`,
                boxShadow: highlightBpm ? `0 0 6px ${daw.primaryContainer}66` : 'none',
            }}>
                <span style={{ fontSize: '9px', color: daw.onSurfaceVariant, fontWeight: 600 }}>BPM</span>
                {/* Blink/WebKit render number inputs with a spinner stepper that ate most of
                    the 40px field and clipped the value. Those are pseudo-elements, so they
                    can't be switched off from the inline style object. */}
                <style>{`
                    input[data-daw-bpm]::-webkit-outer-spin-button,
                    input[data-daw-bpm]::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }
                `}</style>
                <input
                    type="number"
                    data-daw-bpm=""
                    value={bpm}
                    min={40} max={300}
                    onChange={e => setBpm(Number(e.target.value) || 120)}
                    style={{
                        width: 40, background: daw.surfaceContainerLowest,
                        border: `1px solid ${daw.outlineVariant}`,
                        borderRadius: '2px', padding: '1px 3px', color: daw.primaryContainer,
                        fontSize: '12px', fontFamily: dawFont.mono, textAlign: 'center',
                        outline: 'none',
                        // Firefox equivalent of the WebKit rule above
                        MozAppearance: 'textfield',
                        appearance: 'textfield',
                    }}
                />
            </div>

            {/* Swing knob */}
            <FLKnob value={swing} onChange={setSwing} size={22} label="Swing" color={daw.primaryContainer} />
        </div>
    );
};
