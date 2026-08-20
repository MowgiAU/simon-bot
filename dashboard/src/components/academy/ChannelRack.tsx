/**
 * ChannelRack — step sequencer, styled after the Stitch Channel Rack design.
 *
 * Layout is two side-by-side modules (instruments | sequencer) rather than one
 * continuous row, with the 4/4 grid conveyed by alternating warm/neutral pad
 * groups instead of extra gutters. Both modules open with a HEADER_H strip so
 * their rows stay aligned across the gap — see dawTheme.dawSize.
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
            background: daw.surfaceContainer,
            fontFamily: dawFont.sans,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* ── Top app bar ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                height: S.barH, padding: `0 ${S.modulePad}px`,
                background: daw.surfaceContainerHigh,
                borderBottom: `1px solid ${daw.outlineVariant}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <ChevronDown size={16} color={daw.onSurfaceVariant} />
                    <Settings size={16} color={daw.onSurfaceVariant} />
                    {/* Channel filter — decorative; the simulator always shows every channel */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 8px',
                        background: daw.surfaceContainerLowest,
                        border: `1px solid ${daw.outlineVariant}`, borderRadius: 2,
                    }}>
                        <span style={{ ...capsLabel, color: daw.onSurface }}>All</span>
                        <ChevronDown size={14} color={daw.onSurfaceVariant} />
                    </div>
                    <div style={{ height: 16, borderRight: `1px solid ${daw.outlineVariant}` }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Volume2 size={18} color={daw.onSurface} />
                        <span style={{ fontSize: 16, fontWeight: 700, color: daw.onSurface }}>Channel rack</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Undo2 size={18} color={daw.onSurfaceVariant} />
                    <BarChart3 size={18} color={daw.onSurfaceVariant} />
                    <Columns3 size={18} color={daw.onSurfaceVariant} />
                    <X size={18} color={daw.onSurfaceVariant} />
                </div>
            </div>

            {/* ── Modules ── */}
            <div style={{
                display: 'flex', flexDirection: 'row', gap: S.moduleGap,
                padding: S.modulePad,
                background: daw.surface,
                boxShadow: dawFx.innerShadowWell,
                flex: 1, overflowX: 'auto',
            }}>
                {/* Instruments */}
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: S.rowGap,
                    padding: S.modulePad, flexShrink: 0,
                    background: daw.surfaceContainer,
                    border: `1px solid ${daw.outlineVariant}`, borderRadius: 4,
                }}>
                    <div style={{ height: S.headerH, display: 'flex', alignItems: 'center' }}>
                        <span style={{ ...capsLabel, color: daw.onSurfaceVariant, opacity: 0.7 }}>CHANNEL</span>
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
                                    border: `1px solid ${daw.ledRim}`,
                                    background: ch.muted ? daw.surfaceContainerLowest : daw.primaryContainer,
                                    boxShadow: ch.muted
                                        ? dawFx.innerShadowWell
                                        : `0 0 6px ${daw.primaryContainer}, inset 0 1px 2px rgba(255,255,255,0.8)`,
                                }}
                            />

                            {/* Volume / pan */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)}
                                    size={S.knob} color={daw.primaryContainer} label="Volume" showLabel={false} />
                                <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)}
                                    size={S.knob} color={daw.primaryContainer} label="Pan" showLabel={false} />
                            </div>

                            {/* Decorative — FL's plugin picker; the simulator has no plugin browser */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: S.pluginW, height: S.rowH, flexShrink: 0,
                                background: daw.surfaceContainerLow,
                                border: `1px solid ${daw.outlineVariant}`, borderRadius: 2,
                                boxShadow: dawFx.innerShadowWell,
                            }}>
                                <span style={{ fontSize: 10, color: daw.onSurfaceVariant }}>---</span>
                            </div>

                            {/* Channel name */}
                            <div
                                data-academy-id={`channel-${ch.id}`}
                                style={{
                                    width: S.nameW, height: S.rowH, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: dawFx.btnSurface,
                                    borderRadius: 2,
                                    border: `1px solid ${isChannelHighlighted(ch.id) ? daw.primaryContainer : daw.outlineVariant}`,
                                    boxShadow: isChannelHighlighted(ch.id)
                                        ? `${dawFx.btnShadow}, 0 0 10px ${daw.primaryContainer}88`
                                        : dawFx.btnShadow,
                                }}>
                                <span style={{
                                    fontFamily: dawFont.mono, fontSize: 12, fontWeight: 500,
                                    color: ch.muted ? daw.onSurfaceVariant : daw.onSurface,
                                    opacity: ch.muted ? 0.5 : 1,
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
                    background: daw.surfaceContainerLow,
                    border: `1px solid ${daw.outlineVariant}`, borderRadius: 4,
                }}>
                    {/* Step-number ruler */}
                    <div style={{ display: 'flex', gap: S.padGap, height: S.headerH, alignItems: 'center' }}>
                        {Array.from({ length: 16 }, (_, i) => {
                            const isBeat = i % 4 === 0;
                            return (
                                <div key={i} style={{
                                    ...capsLabel,
                                    width: S.padW, textAlign: 'center',
                                    color: isBeat ? daw.primaryContainer : daw.onSurfaceVariant,
                                    opacity: isBeat ? 1 : 0.45,
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
                                // Beat groups 2 & 4 get the warm tint — this is what conveys the
                                // 4/4 grid in this design, replacing the old wider group gutters.
                                const isAltGroup = Math.floor(i / 4) % 2 === 1;

                                let background: string;
                                let borderColor: string;
                                let boxShadow: string;
                                if (on) {
                                    background = daw.secondary;
                                    borderColor = daw.stepOnBorder;
                                    boxShadow = `0 0 8px ${daw.secondary}, inset 0 1px 2px rgba(255,255,255,0.5)`;
                                } else if (isAltGroup) {
                                    background = dawFx.padAlt;
                                    borderColor = daw.stepAltBorder;
                                    boxShadow = dawFx.padShadow;
                                } else {
                                    background = dawFx.padInactive;
                                    borderColor = daw.outlineVariant;
                                    boxShadow = dawFx.padShadow;
                                }
                                if (isPlayhead) {
                                    background = daw.tertiaryContainer;
                                    borderColor = daw.onTertiaryContainer;
                                    boxShadow = `0 0 8px ${daw.tertiaryContainer}`;
                                }
                                // Ring via box-shadow, not a thicker border, so the lesson
                                // highlight can't nudge the grid's layout as it moves.
                                if (hl) {
                                    borderColor = daw.primaryContainer;
                                    boxShadow = `0 0 0 2px ${daw.primaryContainer}, 0 0 12px ${daw.primaryContainer}AA`;
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
                background: daw.surfaceContainerHigh,
                borderTop: `1px solid ${daw.outlineVariant}`,
            }}>
                <button style={iconBtn} title="Add channel (available in the full app)">
                    <Plus size={18} color={daw.onSurfaceVariant} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, padding: '0 32px' }}>
                    <ChevronLeft size={14} color={daw.onSurfaceVariant} />
                    <div style={{
                        flex: 1, height: 8, borderRadius: 12, position: 'relative',
                        background: daw.surfaceContainerLowest,
                        boxShadow: dawFx.innerShadowWell,
                    }}>
                        <div style={{
                            position: 'absolute', left: 40, width: 64, height: '100%',
                            background: daw.surfaceVariant, borderRadius: 12,
                        }} />
                    </div>
                    <ChevronRight size={14} color={daw.onSurfaceVariant} />
                </div>
            </div>
        </div>
    );
};
