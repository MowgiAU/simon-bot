/**
 * ChannelRack — FL Studio 21 step sequencer, styled to match the real thing.
 *
 * Palette and geometry are sampled from an actual FL Studio Channel Rack: a
 * mid slate-blue window, glossy raised step buttons (light top edge, darker
 * bottom), brick-red lit steps, an amber playhead, and the per-channel
 * LED / vol / pan / plugin-button cluster on the left.
 */
import React from 'react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';

// ── Window chrome ──
const PANEL      = '#4A5265';
const ROW_EVEN   = '#4A5265';
const ROW_ODD    = '#464E60';
const ROW_LINE   = '#3E4555';
const TITLE_BG   = '#3F4757';
const TITLE_LINE = '#333A48';
const INSET_BG   = '#3A4150';   // recessed wells (plugin button, separator)
const INSET_LINE = '#2E3440';

// ── Step buttons (glossy, top-lit) ──
const STEP_TOP  = '#818BA4';
const STEP_MID  = '#6E7891';
const STEP_BOT  = '#636C85';
const STEP_LINE = '#39404F';
const ON_TOP    = '#A64F53';
const ON_MID    = '#8C4044';
const ON_BOT    = '#7B373A';
const ON_LINE   = '#4E2527';
const PLAYHEAD  = '#D9AC4C';

// ── Channel name button ──
const NAME_TOP  = '#7A8399';
const NAME_BOT  = '#69728A';
const TEXT      = '#D4DAE6';
const TEXT_DIM  = '#8C94A8';
const LED_ON    = '#6FBF3F';
const LED_OFF   = '#39404F';
const ACCENT    = '#6FBF3F';

// ── Geometry ──
const STEP_W = 23;
const STEP_H = 21;
const STEP_GAP = 2;
const GROUP_GAP = 7;      // wider gap between groups of 4
const NAME_WIDTH = 108;
const LED_KNOBS_WIDTH = 88;
const NUM_WIDTH = 18;
const SEP_WIDTH = 14;
const ROW_H = 34;

const stepGradient = (on: boolean) => on
    ? `linear-gradient(180deg, ${ON_TOP} 0%, ${ON_MID} 48%, ${ON_BOT} 100%)`
    : `linear-gradient(180deg, ${STEP_TOP} 0%, ${STEP_MID} 48%, ${STEP_BOT} 100%)`;

// ── Small decorative title-bar glyphs (no icon dep; FL's own bar is dense) ──

const Caret: React.FC<{ color?: string }> = ({ color = '#AAB2C4' }) => (
    <svg width="8" height="5" viewBox="0 0 8 5" style={{ flexShrink: 0 }}>
        <polygon points="0,0 8,0 4,5" fill={color} />
    </svg>
);

/** FL's speaker-with-play glyph that sits beside the "Channel rack" label. */
const SpeakerPlay: React.FC = () => (
    <svg width="15" height="12" viewBox="0 0 15 12" style={{ flexShrink: 0 }}>
        <rect x="0.5" y="0.5" width="10" height="11" rx="2" fill="none" stroke={ACCENT} strokeWidth="1.1" />
        <polygon points="3.6,3.2 3.6,8.8 8,6" fill={ACCENT} />
        <path d="M12 3.4 Q14 6 12 8.6" stroke={ACCENT} strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
);

const GripDots: React.FC = () => (
    <svg width="3" height="12" viewBox="0 0 3 12" style={{ flexShrink: 0 }}>
        {[1.5, 4.5, 7.5, 10.5].map(cy => <circle key={cy} cx="1.5" cy={cy} r="0.9" fill="#6E7791" />)}
    </svg>
);

const UndoArrow: React.FC = () => (
    <svg width="13" height="12" viewBox="0 0 13 12" style={{ flexShrink: 0 }}>
        <path d="M3.5 4.5 H8 a3 3 0 0 1 0 6 H5" stroke="#AAB2C4" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <polygon points="4.6,1.6 4.6,7.4 1.2,4.5" fill="#AAB2C4" />
    </svg>
);

const BarsIcon: React.FC = () => (
    <svg width="13" height="12" viewBox="0 0 13 12" style={{ flexShrink: 0 }}>
        <rect x="0.5" y="6" width="2.6" height="6" fill="#E06A5A" />
        <rect x="4" y="2.5" width="2.6" height="9.5" fill="#E0B24A" />
        <rect x="7.5" y="4.5" width="2.6" height="7.5" fill="#6FBF3F" />
        <rect x="11" y="7.5" width="1.6" height="4.5" fill="#5A9FD6" />
    </svg>
);

const SwatchIcon: React.FC = () => (
    <svg width="14" height="12" viewBox="0 0 14 12" style={{ flexShrink: 0 }}>
        <rect x="0.5" y="1" width="3.6" height="10" fill="#E0B24A" />
        <rect x="5.2" y="1" width="3.6" height="10" fill="#6FBF3F" />
        <rect x="9.9" y="1" width="3.6" height="10" fill="#5A9FD6" />
    </svg>
);

const CloseIcon: React.FC = () => (
    <svg width="11" height="11" viewBox="0 0 11 11" style={{ flexShrink: 0 }}>
        <path d="M1 1 L10 10 M10 1 L1 10" stroke="#B6BCCA" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

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
            background: PANEL,
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
            overflow: 'hidden',
        }}>
            {/* ── Title bar ── */}
            <div style={{
                height: 30,
                background: TITLE_BG,
                borderBottom: `1px solid ${TITLE_LINE}`,
                display: 'flex', alignItems: 'center',
                padding: '0 9px', gap: '8px',
            }}>
                <Caret />
                {/* FL's orange plugin-menu bauble */}
                <div style={{
                    width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                    background: 'radial-gradient(circle at 35% 30%, #F2A93B, #BE5A16)',
                    boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.35)',
                }} />
                {/* "All" channel-filter dropdown */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    minWidth: 92, height: 18, padding: '0 6px',
                    background: INSET_BG, border: `1px solid ${INSET_LINE}`,
                    borderRadius: 2, flexShrink: 0,
                }}>
                    <span style={{ fontSize: 11, color: TEXT, flex: 1 }}>All</span>
                    <Caret color="#8C94A8" />
                </div>
                <GripDots />
                <SpeakerPlay />
                <span style={{ fontSize: 12, color: TEXT, fontWeight: 500 }}>Channel rack</span>

                {/* Right-hand control cluster */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                        width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(180deg, #5A6379 0%, #39404F 100%)',
                        border: `1px solid ${INSET_LINE}`,
                    }} />
                    <div style={{
                        minWidth: 30, height: 17, borderRadius: 2, flexShrink: 0,
                        background: INSET_BG, border: `1px solid ${INSET_LINE}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>···</span>
                    </div>
                    <UndoArrow />
                    <BarsIcon />
                    <SwatchIcon />
                    <CloseIcon />
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {/* ── Step-number ruler (spacers mirror the row layout below) ── */}
                <div style={{ display: 'flex', alignItems: 'center', height: 15 }}>
                    <div style={{ width: LED_KNOBS_WIDTH, flexShrink: 0 }} />
                    <div style={{ width: NUM_WIDTH, flexShrink: 0 }} />
                    <div style={{ width: NAME_WIDTH, flexShrink: 0 }} />
                    <div style={{ width: SEP_WIDTH, flexShrink: 0 }} />
                    <div style={{ display: 'flex', padding: '0 6px', alignItems: 'center' }}>
                        {Array.from({ length: 16 }, (_, i) => {
                            const afterGroup = i > 0 && i % 4 === 0;
                            const isBeatStart = i % 4 === 0;
                            return (
                                <div key={i} style={{
                                    width: STEP_W, textAlign: 'center',
                                    marginLeft: afterGroup ? GROUP_GAP : (i > 0 ? STEP_GAP : 0),
                                    fontSize: 9, fontFamily: 'monospace',
                                    fontWeight: isBeatStart ? 700 : 400,
                                    color: isBeatStart ? '#C2C9D6' : '#6E7791',
                                }}>
                                    {i + 1}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Channel rows ── */}
                {channels.map((ch, chIdx) => (
                    <div key={ch.id} style={{
                        display: 'flex', alignItems: 'center',
                        height: ROW_H,
                        borderBottom: `1px solid ${ROW_LINE}`,
                        background: chIdx % 2 === 0 ? ROW_EVEN : ROW_ODD,
                    }}>
                        {/* LED + knobs + plugin button */}
                        <div style={{
                            display: 'flex', alignItems: 'center',
                            width: LED_KNOBS_WIDTH, padding: '0 5px', gap: 4,
                            flexShrink: 0,
                        }}>
                            <div
                                onClick={() => toggleChannelMute(ch.id)}
                                style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: ch.muted ? LED_OFF : LED_ON,
                                    boxShadow: ch.muted
                                        ? `inset 0 0 2px rgba(0,0,0,0.6)`
                                        : `0 0 4px ${LED_ON}AA`,
                                    cursor: 'pointer', flexShrink: 0,
                                }}
                                title={ch.muted ? 'Unmute' : 'Mute'}
                            />
                            <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)}
                                size={19} color={ACCENT} label="Volume" showLabel={false} />
                            <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)}
                                size={19} color={ACCENT} label="Pan" showLabel={false} />
                            {/* Decorative — FL puts the instrument/plugin picker here; the
                                simulator has no plugin browser to open. */}
                            <div style={{
                                width: 26, height: 17, borderRadius: 2, flexShrink: 0,
                                background: INSET_BG, border: `1px solid ${INSET_LINE}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'default',
                            }}>
                                <span style={{ fontSize: 9, color: TEXT_DIM, letterSpacing: 0.5 }}>----</span>
                            </div>
                        </div>

                        {/* Channel number */}
                        <div style={{
                            width: NUM_WIDTH, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ fontSize: 10, color: TEXT_DIM, fontWeight: 600 }}>
                                {chIdx + 1}
                            </span>
                        </div>

                        {/* Channel name button */}
                        <div style={{
                            width: NAME_WIDTH, flexShrink: 0,
                            display: 'flex', alignItems: 'center',
                        }}>
                            <div
                                data-academy-id={`channel-${ch.id}`}
                                style={{
                                    width: '100%', height: 22,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: `linear-gradient(180deg, ${NAME_TOP} 0%, ${NAME_BOT} 100%)`,
                                    borderRadius: 3,
                                    border: isChannelHighlighted(ch.id)
                                        ? '1px solid #60C0A0'
                                        : '1px solid #8A93A9',
                                    boxShadow: isChannelHighlighted(ch.id)
                                        ? '0 0 7px rgba(96,192,160,0.65)'
                                        : 'inset 0 1px 0 rgba(255,255,255,0.22)',
                                }}>
                                <span style={{
                                    fontSize: 11.5,
                                    color: ch.muted ? '#98A0B2' : '#EDF0F6',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    padding: '0 6px',
                                }}>
                                    {ch.name}
                                </span>
                            </div>
                        </div>

                        {/* Vertical separator bar between the name column and the grid */}
                        <div style={{
                            width: SEP_WIDTH, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <div style={{
                                width: 5, height: 21, borderRadius: 1,
                                background: 'linear-gradient(180deg, #5E6779 0%, #454C5C 100%)',
                                border: `1px solid ${INSET_LINE}`,
                            }} />
                        </div>

                        {/* Step grid — groups of 4 with a wider gap between groups */}
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
                                            borderRadius: 3,
                                            border: hl
                                                ? '2px solid #60C0A0'
                                                : `1px solid ${on ? ON_LINE : STEP_LINE}`,
                                            background: isActive
                                                ? `linear-gradient(180deg, #E8C069 0%, ${PLAYHEAD} 50%, #BE9236 100%)`
                                                : stepGradient(on),
                                            opacity: ch.muted ? 0.45 : 1,
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'background 0.04s',
                                            boxShadow: hl
                                                ? '0 0 7px rgba(96,192,160,0.65)'
                                                : 'inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 1px rgba(0,0,0,0.25)',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* ── Bottom: add-channel affordance + FL's horizontal scroll rail ── */}
                <div style={{
                    height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: ROW_ODD,
                }}>
                    <span style={{ fontSize: 15, color: TEXT_DIM, cursor: 'default', lineHeight: 1 }}>+</span>
                </div>
                <div style={{
                    height: 13, background: TITLE_BG, borderTop: `1px solid ${TITLE_LINE}`,
                    display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6,
                }}>
                    <Caret color="#6E7791" />
                    <div style={{ flex: 1, height: 5, background: INSET_BG, borderRadius: 3 }}>
                        <div style={{ width: '38%', height: '100%', background: NAME_BOT, borderRadius: 3 }} />
                    </div>
                    <Caret color="#6E7791" />
                </div>
            </div>
        </div>
    );
};
