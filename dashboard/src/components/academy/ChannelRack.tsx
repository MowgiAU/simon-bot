/**
 * ChannelRack — FL Studio 21 authentic step sequencer.
 * Fixed-width channel names, proper grid alignment, FL color scheme.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';

const STEP_W = 26;
const STEP_H = 24;
const STEP_GAP = 2;
const NAME_WIDTH = 100;
const KNOB_AREA = 56;

// FL Studio channel colours — each beat group has a distinct hue
const BEAT_COLORS = [
    { on: '#E8503A', off: '#4A2220' },  // Red group
    { on: '#E88C3A', off: '#4A3A20' },  // Orange group
    { on: '#E8D03A', off: '#4A4620' },  // Yellow group
    { on: '#3AE87A', off: '#204A2E' },  // Green group
];

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

    const gridWidth = 16 * (STEP_W + STEP_GAP);

    return (
        <div style={{
            background: '#2B2B2B',
            border: '1px solid #3A3A3A',
            borderRadius: '4px',
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
            overflow: 'hidden',
        }}>
            {/* Title bar — FL style */}
            <div style={{
                height: 24,
                background: 'linear-gradient(180deg, #4A4A4A 0%, #3A3A3A 100%)',
                borderBottom: '1px solid #555',
                display: 'flex', alignItems: 'center',
                padding: '0 8px',
            }}>
                <span style={{ fontSize: '11px', color: '#CCC', fontWeight: 600 }}>Channel Rack</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {/* Step number header */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    height: 20,
                    borderBottom: '1px solid #333',
                }}>
                    <div style={{ width: NAME_WIDTH + KNOB_AREA, flexShrink: 0 }} />
                    <div style={{ display: 'flex' }}>
                        {Array.from({ length: 16 }, (_, i) => (
                            <div key={i} style={{
                                width: STEP_W, marginRight: STEP_GAP,
                                textAlign: 'center',
                                fontSize: '8px',
                                color: i % 4 === 0 ? '#999' : '#555',
                                fontWeight: i % 4 === 0 ? 700 : 400,
                            }}>
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Channel rows */}
                {channels.map((ch, chIdx) => (
                    <div key={ch.id} style={{
                        display: 'flex', alignItems: 'center',
                        height: 36,
                        borderBottom: '1px solid #333',
                        background: chIdx % 2 === 0 ? '#2B2B2B' : '#272727',
                    }}>
                        {/* Channel name + mute LED */}
                        <div style={{
                            width: NAME_WIDTH, flexShrink: 0,
                            display: 'flex', alignItems: 'center',
                            padding: '0 6px', gap: '6px',
                            borderRight: '1px solid #3A3A3A',
                        }}>
                            {/* Green LED — FL style mute indicator */}
                            <div
                                onClick={() => toggleChannelMute(ch.id)}
                                style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: ch.muted ? '#333' : '#6FBF40',
                                    boxShadow: ch.muted ? 'none' : '0 0 4px #6FBF4080',
                                    cursor: 'pointer', flexShrink: 0,
                                    border: '1px solid #555',
                                }}
                                title={ch.muted ? 'Unmute' : 'Mute'}
                            />
                            <span style={{
                                fontSize: '11px',
                                color: ch.muted ? '#666' : '#CCC',
                                fontWeight: 500,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {ch.name}
                            </span>
                        </div>

                        {/* Vol/Pan mini-knobs */}
                        <div style={{
                            width: KNOB_AREA, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            borderRight: '1px solid #3A3A3A',
                        }}>
                            <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)}
                                size={20} color="#6FBF40" />
                            <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)}
                                size={20} color="#E88C3A" />
                        </div>

                        {/* Step grid */}
                        <div style={{ display: 'flex', padding: '0 4px' }}>
                            {ch.steps.map((on, i) => {
                                const groupIdx = Math.floor(i / 4);
                                const bc = BEAT_COLORS[groupIdx % 4];
                                const isActive = playing && currentStep === i;
                                const hl = isHighlighted(ch.id, i);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => toggleStep(ch.id, i)}
                                        data-academy-id={`step-${ch.id}-${i}`}
                                        style={{
                                            width: STEP_W, height: STEP_H,
                                            marginRight: i < 15 ? STEP_GAP : 0,
                                            borderRadius: '2px',
                                            border: hl
                                                ? '2px solid #10B981'
                                                : isActive
                                                    ? '1px solid #888'
                                                    : i % 4 === 0
                                                        ? '1px solid #444'
                                                        : '1px solid #383838',
                                            background: on ? bc.on : bc.off,
                                            opacity: ch.muted ? 0.35 : 1,
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'background 0.06s',
                                            boxShadow: hl
                                                ? '0 0 8px #10B98180'
                                                : isActive && on
                                                    ? `0 0 6px ${bc.on}80`
                                                    : on
                                                        ? `inset 0 1px 1px rgba(255,255,255,0.15)`
                                                        : 'inset 0 1px 2px rgba(0,0,0,0.3)',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
