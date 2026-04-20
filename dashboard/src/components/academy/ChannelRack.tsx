/**
 * ChannelRack — FL Studio-style step sequencer grid.
 * Each channel has 16 toggleable step "LEDs" and volume/pan knobs.
 */
import React from 'react';
import { colors, borderRadius } from '../../theme/theme';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { Volume2, VolumeX } from 'lucide-react';

const STEP_SIZE = 28;
const STEP_GAP = 3;
const CHANNEL_HEIGHT = 44;

// FL Studio step LED colours by beat group
const beatColors = ['#F43F5E', '#F97316', '#FBBF24', '#34D399'];

interface ChannelRackProps {
    /** Optional set of step IDs to highlight (lesson guidance) */
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
            background: '#1a1d1f',
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            padding: '12px',
            overflowX: 'auto',
        }}>
            {/* Header row */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '8px', paddingLeft: '140px',
            }}>
                {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{
                        width: STEP_SIZE, textAlign: 'center',
                        fontSize: '9px', color: colors.textTertiary,
                        fontWeight: i % 4 === 0 ? 700 : 400,
                    }}>
                        {i + 1}
                    </div>
                ))}
            </div>

            {channels.map(ch => (
                <div key={ch.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    height: CHANNEL_HEIGHT, marginBottom: '4px',
                }}>
                    {/* Channel label + mute */}
                    <div style={{
                        width: 80, display: 'flex', alignItems: 'center', gap: '6px',
                        flexShrink: 0, overflow: 'hidden',
                    }}>
                        <button
                            onClick={() => toggleChannelMute(ch.id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                color: ch.muted ? colors.error : colors.textSecondary,
                                display: 'flex', alignItems: 'center',
                            }}
                            title={ch.muted ? 'Unmute' : 'Mute'}
                        >
                            {ch.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                        <span style={{
                            fontSize: '11px', color: ch.muted ? colors.textTertiary : colors.textPrimary,
                            fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                            {ch.name}
                        </span>
                    </div>

                    {/* Vol/Pan knobs */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)} size={22} label="" color="#34D399" />
                        <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)} size={22} label="" color="#F97316" />
                    </div>

                    {/* Step grid */}
                    <div style={{ display: 'flex', gap: `${STEP_GAP}px` }}>
                        {ch.steps.map((on, i) => {
                            const groupIdx = Math.floor(i / 4);
                            const isActive = playing && currentStep === i;
                            const hl = isHighlighted(ch.id, i);
                            return (
                                <button
                                    key={i}
                                    onClick={() => toggleStep(ch.id, i)}
                                    data-academy-id={`step-${ch.id}-${i}`}
                                    style={{
                                        width: STEP_SIZE, height: STEP_SIZE,
                                        borderRadius: '4px',
                                        border: hl
                                            ? `2px solid ${colors.primary}`
                                            : isActive
                                                ? `2px solid ${colors.accent}`
                                                : '1px solid rgba(255,255,255,0.08)',
                                        background: on ? beatColors[groupIdx % 4] : '#313537',
                                        opacity: ch.muted ? 0.35 : 1,
                                        cursor: 'pointer',
                                        transition: 'background 0.08s, border 0.1s',
                                        boxShadow: hl ? `0 0 8px ${colors.primary}` : isActive && on ? `0 0 6px ${beatColors[groupIdx % 4]}` : 'none',
                                        padding: 0,
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};
