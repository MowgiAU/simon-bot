/**
 * ChannelRack — FL Studio 21 authentic step sequencer.
 * Slate blue-gray palette, subtle monochrome steps, button-style channel names.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';

// FL21 palette
const BG          = '#3A4050';   // panel background
const ROW_EVEN    = '#3A4050';
const ROW_ODD     = '#363C48';
const BORDER      = '#2E3440';
const TITLE_BG    = '#333A48';
const TITLE_BORDER= '#4A5060';
const STEP_OFF    = '#2E3440';   // dark recessed step
const STEP_ON     = '#6A7A8A';   // lit step — neutral gray-blue
const STEP_ON_ALT = '#8A7A6A';   // slightly warm alternative (snare)
const PLAYHEAD    = '#A0B0C0';   // current step highlight
const NAME_BTN    = '#4A5060';   // channel name button bg
const LED_ON      = '#8ABF60';   // green LED
const LED_OFF     = '#3A4050';

const STEP_W = 24;
const STEP_H = 22;
const STEP_GAP = 2;
const GROUP_GAP = 5;   // gap between groups of 4
const NAME_WIDTH = 110;
const KNOB_AREA  = 52;

interface ChannelRackProps {
    highlightSteps?: { channelId: string; stepIndex: number }[];
}

export const ChannelRack: React.FC<ChannelRackProps> = ({ highlightSteps }) => {
    const channels = useDAWStore(s => s.state.channels);
    const currentStep = useDAWStore(s => s.state.transport.currentStep);
    const playing = useDAWStore(s => s.state.transport.playing);
    const toggleStep = useDAWStore(s => s.toggleStep);
    const setChannelVolume = useDAWStore(s => s.setChannelVolume);
    const setChannelPan = useDAWStore(s => s.setChannelPan);
    const toggleChannelMute = useDAWStore(s => s.toggleChannelMute);

    const isHighlighted = (chId: string, idx: number) =>
        highlightSteps?.some(h => h.channelId === chId && h.stepIndex === idx) ?? false;

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
                borderBottom: `1px solid ${TITLE_BORDER}`,
                display: 'flex', alignItems: 'center',
                padding: '0 10px',
                gap: '8px',
            }}>
                {/* Diamond / play icon */}
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                    <polygon points="2,0 10,5 2,10" fill="#8ABF60" />
                </svg>
                <span style={{ fontSize: '11px', color: '#B0B8C8', fontWeight: 500 }}>
                    Channel rack
                </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {/* Channel rows */}
                {channels.map((ch, chIdx) => (
                    <div key={ch.id} style={{
                        display: 'flex', alignItems: 'center',
                        height: 34,
                        borderBottom: `1px solid ${BORDER}`,
                        background: chIdx % 2 === 0 ? ROW_EVEN : ROW_ODD,
                    }}>
                        {/* LED + knobs */}
                        <div style={{
                            display: 'flex', alignItems: 'center',
                            padding: '0 4px', gap: '3px',
                            flexShrink: 0,
                        }}>
                            {/* Green LED mute indicator */}
                            <div
                                onClick={() => toggleChannelMute(ch.id)}
                                style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: ch.muted ? LED_OFF : LED_ON,
                                    boxShadow: ch.muted ? 'none' : `0 0 3px ${LED_ON}80`,
                                    cursor: 'pointer', flexShrink: 0,
                                }}
                                title={ch.muted ? 'Unmute' : 'Mute'}
                            />
                            {/* Vol knob */}
                            <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)}
                                size={18} color="#8ABF60" />
                            {/* Pan knob */}
                            <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)}
                                size={18} color="#8ABF60" />
                        </div>

                        {/* Channel number */}
                        <div style={{
                            width: 20, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{
                                fontSize: '10px', color: '#6A7080',
                                fontWeight: 600, fontFamily: 'monospace',
                            }}>
                                {chIdx + 1}
                            </span>
                        </div>

                        {/* Channel name button */}
                        <div style={{
                            width: NAME_WIDTH, flexShrink: 0,
                            display: 'flex', alignItems: 'center',
                            padding: '0 2px',
                        }}>
                            <div style={{
                                width: '100%',
                                padding: '3px 8px',
                                background: NAME_BTN,
                                borderRadius: '2px',
                                border: `1px solid #5A6478`,
                            }}>
                                <span style={{
                                    fontSize: '11px',
                                    color: ch.muted ? '#6A7080' : '#C0C8D8',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    display: 'block',
                                }}>
                                    {ch.name}
                                </span>
                            </div>
                        </div>

                        {/* Step grid — groups of 4 with extra gap */}
                        <div style={{ display: 'flex', padding: '0 6px', alignItems: 'center' }}>
                            {ch.steps.map((on, i) => {
                                const isActive = playing && currentStep === i;
                                const hl = isHighlighted(ch.id, i);
                                const afterGroup = i > 0 && i % 4 === 0;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => toggleStep(ch.id, i)}
                                        data-academy-id={`step-${ch.id}-${i}`}
                                        style={{
                                            width: STEP_W, height: STEP_H,
                                            marginLeft: afterGroup ? GROUP_GAP : (i > 0 ? STEP_GAP : 0),
                                            borderRadius: '2px',
                                            border: hl
                                                ? '2px solid #60C0A0'
                                                : `1px solid ${on ? '#5A6478' : '#353D4A'}`,
                                            background: isActive
                                                ? (on ? PLAYHEAD : '#4A5568')
                                                : on ? STEP_ON : STEP_OFF,
                                            opacity: ch.muted ? 0.4 : 1,
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'background 0.04s',
                                            boxShadow: hl
                                                ? '0 0 6px rgba(96,192,160,0.5)'
                                                : on
                                                    ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
                                                    : 'inset 0 1px 2px rgba(0,0,0,0.3)',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Bottom add channel button area */}
                <div style={{
                    height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderTop: `1px solid ${BORDER}`,
                    background: ROW_ODD,
                }}>
                    <span style={{ fontSize: '14px', color: '#6A7080', cursor: 'default' }}>+</span>
                </div>
            </div>
        </div>
    );
};
