/**
 * ChannelRack — step sequencer.
 *
 * Layout comes from the Stitch Channel Rack design: two side-by-side modules
 * (instruments | sequencer), with the 4/4 grid conveyed by alternating
 * warm/neutral pad groups rather than extra gutters. Colours come from the
 * Stitch Mixer design (see dawTheme), which tracks real FL Studio much more
 * closely than the original mockup's Material palette.
 *
 * Both modules open with a HEADER_H strip so their rows stay aligned across
 * the gap — see dawTheme.dawSize.
 */
import React from 'react';
import {
    ChevronDown, ChevronLeft, ChevronRight, Settings, Volume2,
    Undo2, BarChart3, Columns3, X, Plus,
} from 'lucide-react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { daw, dawFx, dawFont, dawSize as S } from './dawTheme';

interface ChannelRackProps {
    /** Channel the lesson engine wants emphasized (whole row), or null for none */
    highlightChannelId?: string | null;
    /** Specific step within highlightChannelId to emphasize, or null to just emphasize the row */
    highlightStepIndex?: number | null;
}

const capsLabel: React.CSSProperties = {
    fontFamily: dawFont.mono,
    fontSize: 10,
    lineHeight: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
};

const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', padding: 2, cursor: 'default',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export const ChannelRack: React.FC<ChannelRackProps> = ({ highlightChannelId, highlightStepIndex }) => {
    const channels = useDAWStore(s => s.state.channels);
    const currentStep = useDAWStore(s => s.state.transport.currentStep);
    const playing = useDAWStore(s => s.state.transport.playing);
    const toggleStep = useDAWStore(s => s.toggleStep);
    const setChannelVolume = useDAWStore(s => s.setChannelVolume);
    const setChannelPan = useDAWStore(s => s.setChannelPan);
    const toggleChannelMute = useDAWStore(s => s.toggleChannelMute);

    const isChannelHighlighted = (chId: string) => !!highlightChannelId && highlightChannelId === chId;
    const isStepHighlighted = (chId: string, idx: number) =>
        isChannelHighlighted(chId) && highlightStepIndex === idx;

    return (
        <div style={{
            background: daw.bg,
            fontFamily: dawFont.sans,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* ── Top app bar ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                height: S.barH, padding: `0 ${S.modulePad}px`,
                background: daw.dark,
                borderBottom: `1px solid ${daw.border}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <ChevronDown size={16} color={daw.text} />
                    <Settings size={16} color={daw.text} />
                    {/* Channel filter — decorative; the simulator always shows every channel */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 8px',
                        background: daw.well,
                        border: `1px solid ${daw.border}`, borderRadius: 3,
                    }}>
                        <span style={{ ...capsLabel, color: daw.white }}>All</span>
                        <ChevronDown size={14} color={daw.text} />
                    </div>
                    <div style={{ height: 16, borderRight: `1px solid ${daw.border}` }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Volume2 size={18} color={daw.textBright} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: daw.textBright }}>Channel rack</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Undo2 size={16} color={daw.text} />
                    <BarChart3 size={16} color={daw.text} />
                    <Columns3 size={16} color={daw.text} />
                    <X size={16} color={daw.text} />
                </div>
            </div>

            {/* ── Modules ── */}
            <div style={{
                display: 'flex', flexDirection: 'row', gap: S.moduleGap,
                padding: S.modulePad,
                background: daw.bg,
                flex: 1, overflowX: 'auto',
            }}>
                {/* Instruments */}
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: S.rowGap,
                    padding: S.modulePad, flexShrink: 0,
                    background: daw.panel,
                    border: `1px solid ${daw.border}`, borderRadius: 3,
                }}>
                    <div style={{ height: S.headerH, display: 'flex', alignItems: 'center' }}>
                        <span style={{ ...capsLabel, color: daw.textDim }}>CHANNEL</span>
                    </div>

                    {channels.map(ch => (
                        <div key={ch.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, height: S.rowH,
                        }}>
                            {/* Mute LED */}
                            <div
                                onClick={() => toggleChannelMute(ch.id)}
                                title={ch.muted ? 'Unmute' : 'Mute'}
                                style={{
                                    width: S.led, height: S.led, borderRadius: '50%', flexShrink: 0,
                                    cursor: 'pointer',
                                    background: ch.muted ? daw.well : daw.green,
                                    boxShadow: ch.muted ? dawFx.ledOff : dawFx.ledOn,
                                }}
                            />

                            {/* Volume / pan */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)}
                                    size={S.knob} color={daw.green} label="Volume" showLabel={false} />
                                <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)}
                                    size={S.knob} color={daw.green} label="Pan" showLabel={false} />
                            </div>

                            {/* Decorative — FL's plugin picker; the simulator has no plugin browser */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: S.pluginW, height: S.rowH, flexShrink: 0,
                                background: daw.well,
                                border: `1px solid ${daw.border}`, borderRadius: 3,
                                boxShadow: dawFx.innerShadowWell,
                            }}>
                                <span style={{ fontSize: 10, color: daw.textDim }}>---</span>
                            </div>

                            {/* Channel name */}
                            <div
                                data-academy-id={`channel-${ch.id}`}
                                style={{
                                    width: S.nameW, height: S.rowH, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: dawFx.btnSurface,
                                    borderRadius: 3,
                                    border: `1px solid ${isChannelHighlighted(ch.id) ? daw.green : daw.border}`,
                                    boxShadow: isChannelHighlighted(ch.id)
                                        ? `${dawFx.btnShadow}, 0 0 10px ${daw.green}99`
                                        : dawFx.btnShadow,
                                }}>
                                <span style={{
                                    fontSize: 12, fontWeight: 500,
                                    color: ch.muted ? daw.text : daw.textBright,
                                    opacity: ch.muted ? 0.6 : 1,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    padding: '0 8px',
                                }}>
                                    {ch.name}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sequencer */}
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: S.rowGap,
                    padding: S.modulePad, flex: 1, minWidth: 'max-content',
                    background: daw.dark,
                    border: `1px solid ${daw.border}`, borderRadius: 3,
                    boxShadow: dawFx.innerShadowWell,
                }}>
                    {/* Step-number ruler */}
                    <div style={{ display: 'flex', gap: S.padGap, height: S.headerH, alignItems: 'center' }}>
                        {Array.from({ length: 16 }, (_, i) => {
                            const isBeat = i % 4 === 0;
                            return (
                                <div key={i} style={{
                                    ...capsLabel,
                                    width: S.padW, textAlign: 'center',
                                    color: isBeat ? daw.green : daw.textDim,
                                }}>
                                    {i + 1}
                                </div>
                            );
                        })}
                    </div>

                    {channels.map(ch => (
                        <div key={ch.id} style={{
                            display: 'flex', gap: S.padGap, height: S.rowH, alignItems: 'center',
                        }}>
                            {ch.steps.map((on, i) => {
                                const isPlayhead = playing && currentStep === i;
                                const hl = isStepHighlighted(ch.id, i);
                                // Beat groups 2 & 4 take the darker shade — this is what conveys
                                // the 4/4 grid in this design, replacing wider group gutters.
                                const isAltGroup = Math.floor(i / 4) % 2 === 1;

                                let background: string;
                                let borderColor: string;
                                let boxShadow: string = dawFx.padShadow;
                                if (on) {
                                    background = dawFx.padOn;
                                    borderColor = daw.stepOnEdge;
                                } else if (isAltGroup) {
                                    background = dawFx.padAlt;
                                    borderColor = daw.stepAltEdge;
                                } else {
                                    background = dawFx.padOff;
                                    borderColor = daw.border;
                                }
                                if (isPlayhead) {
                                    background = daw.playhead;
                                    borderColor = daw.white;
                                    boxShadow = `0 0 8px ${daw.playhead}`;
                                }
                                // Ring via box-shadow, not a thicker border, so the moving
                                // lesson highlight can't nudge the grid's layout.
                                if (hl) {
                                    borderColor = daw.green;
                                    boxShadow = `0 0 0 2px ${daw.green}, 0 0 12px ${daw.green}AA`;
                                }

                                return (
                                    <button
                                        key={i}
                                        onClick={() => toggleStep(ch.id, i)}
                                        data-academy-id={`step-${ch.id}-${i}`}
                                        style={{
                                            width: S.padW, height: S.padH,
                                            borderRadius: 2, padding: 0, cursor: 'pointer',
                                            border: `1px solid ${borderColor}`,
                                            background, boxShadow,
                                            opacity: ch.muted ? 0.45 : 1,
                                            transition: 'background 0.05s, box-shadow 0.12s',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: S.barH, padding: `0 ${S.modulePad}px`,
                background: daw.dark,
                borderTop: `1px solid ${daw.border}`,
            }}>
                <button style={iconBtn} title="Add channel (available in the full app)">
                    <Plus size={18} color={daw.text} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, padding: '0 32px' }}>
                    <ChevronLeft size={14} color={daw.text} />
                    <div style={{
                        flex: 1, height: 8, borderRadius: 4, position: 'relative',
                        background: daw.well,
                        boxShadow: dawFx.innerShadowWell,
                    }}>
                        <div style={{
                            position: 'absolute', left: 40, width: 64, height: '100%',
                            background: daw.highlight, borderRadius: 4,
                        }} />
                    </div>
                    <ChevronRight size={14} color={daw.text} />
                </div>
            </div>
        </div>
    );
};
