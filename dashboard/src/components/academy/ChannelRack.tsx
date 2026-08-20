/**
 * ChannelRack — FL Studio 21 authentic step sequencer.
 * Slate blue-gray palette, subtle monochrome steps, button-style channel names.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';

// FL21 palette — matched against a real FL Studio Channel Rack screenshot: lighter
// slate-blue panel/steps (not near-black), brick-red lit steps, amber playhead.
const BG          = '#4D5567';   // panel background
const ROW_EVEN    = '#4D5567';
const ROW_ODD     = '#48505F';
const BORDER      = '#333A48';
const TITLE_BG    = '#3A4050';
const TITLE_BORDER= '#4A5060';
const STEP_OFF    = '#6B7590';   // unlit step — light slate button, not a dark recess
const STEP_OFF_BORDER = '#828CA6';
const STEP_ON     = '#8B3F42';   // lit step — brick red
const STEP_ON_BORDER = '#A8585C';
const PLAYHEAD    = '#D6A94A';   // current-step amber highlight
const NAME_BTN    = '#6B7590';   // channel name button bg
const LED_ON      = '#7FBF5F';   // green LED
const LED_OFF     = '#3F4657';

const STEP_W = 24;
const STEP_H = 22;
const STEP_GAP = 2;
const GROUP_GAP = 5;   // gap between groups of 4
const NAME_WIDTH = 110;

const LED_KNOBS_WIDTH = 80;

interface ChannelRackProps {
    /** Channel the lesson engine wants emphasized (whole row), or null for none */
    highlightChannelId?: string | null;
    /** Specific step within highlightChannelId to emphasize, or null to just emphasize the row */
    highlightStepIndex?: number | null;
}

export const ChannelRack: React.FC<ChannelRackProps> = ({ highlightChannelId, highlightStepIndex }) => {
    const channels = useDAWStore(s => s.state.channels);
    const currentStep = useDAWStore(s => s.state.transport.currentStep);
    const playing = useDAWStore(s => s.state.transport.playing);
    const toggleStep = useDAWStore(s => s.toggleStep);
    const setChannelVolume = useDAWStore(s => s.setChannelVolume);
    const setChannelPan = useDAWStore(s => s.setChannelPan);
    const toggleChannelMute = useDAWStore(s => s.toggleChannelMute);

    const isChannelHighlighted = (chId: string) => !!highlightChannelId && highlightChannelId === chId;
    const isHighlighted = (chId: string, idx: number) =>
        isChannelHighlighted(chId) && highlightStepIndex === idx;

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
                {/* FL Studio's speaker+play glyph, not a control — matches the real Channel
                    Rack title bar rather than functioning as another play/stop button
                    (Transport's Play/Stop buttons above already own that). */}
                <svg width="15" height="12" viewBox="0 0 15 12" style={{ flexShrink: 0 }}>
                    <rect x="0.5" y="1" width="8" height="10" rx="1.5" fill="none" stroke="#8ABF60" strokeWidth="1" />
                    <polygon points="3,3.3 3,8.7 7,6" fill="#8ABF60" />
                    <path d="M9.8 3 Q12.5 6 9.8 9" stroke="#8ABF60" strokeWidth="1" fill="none" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '11px', color: '#B0B8C8', fontWeight: 500 }}>
                    Channel rack
                </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {/* Step number ruler — aligned to the same columns as the step grid below */}
                <div style={{
                    display: 'flex', alignItems: 'center', height: 18,
                    borderBottom: `1px solid ${BORDER}`, background: TITLE_BG,
                }}>
                    <div style={{ width: LED_KNOBS_WIDTH, flexShrink: 0 }} />
                    <div style={{ width: 20, flexShrink: 0 }} />
                    <div style={{ width: NAME_WIDTH, flexShrink: 0 }} />
                    <div style={{ display: 'flex', padding: '0 6px', alignItems: 'center' }}>
                        {Array.from({ length: 16 }, (_, i) => {
                            const afterGroup = i > 0 && i % 4 === 0;
                            const isBeatStart = i % 4 === 0;
                            return (
                                <div key={i} style={{
                                    width: STEP_W, textAlign: 'center',
                                    marginLeft: afterGroup ? GROUP_GAP : (i > 0 ? STEP_GAP : 0),
                                    fontSize: '9px', fontFamily: 'monospace',
                                    fontWeight: isBeatStart ? 700 : 500,
                                    color: isBeatStart ? '#8ABF60' : '#5A6478',
                                }}>
                                    {i + 1}
                                </div>
                            );
                        })}
                    </div>
                </div>

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
                            width: LED_KNOBS_WIDTH, padding: '0 4px', gap: '3px',
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
                            {/* Decorative — matches the instrument-picker button real FL shows here;
                                there's no plugin browser to open in the simulator. */}
                            <div style={{
                                width: 20, height: 16, borderRadius: '2px',
                                background: '#3F4657', border: '1px solid #2E3440',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'default', flexShrink: 0,
                            }}>
                                <span style={{ fontSize: '9px', color: '#8890A4', letterSpacing: '1px' }}>···</span>
                            </div>
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
                            <div
                                data-academy-id={`channel-${ch.id}`}
                                style={{
                                    width: '100%',
                                    padding: '3px 8px',
                                    background: NAME_BTN,
                                    borderRadius: '2px',
                                    border: isChannelHighlighted(ch.id) ? '1px solid #60C0A0' : '1px solid #5A6478',
                                    boxShadow: isChannelHighlighted(ch.id) ? '0 0 6px rgba(96,192,160,0.5)' : 'none',
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
                                                : `1px solid ${on ? STEP_ON_BORDER : STEP_OFF_BORDER}`,
                                            background: isActive
                                                ? PLAYHEAD
                                                : on ? STEP_ON : STEP_OFF,
                                            opacity: ch.muted ? 0.4 : 1,
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'background 0.04s',
                                            boxShadow: hl
                                                ? '0 0 6px rgba(96,192,160,0.5)'
                                                : on
                                                    ? 'inset 0 1px 0 rgba(255,255,255,0.15)'
                                                    : 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 2px rgba(0,0,0,0.2)',
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
