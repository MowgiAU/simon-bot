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
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDown, ChevronLeft, ChevronRight, Settings, Volume2,
    Undo2, BarChart3, Columns3, X, Plus,
} from 'lucide-react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { daw, dawFx, dawFont, dawSize as S, flRack, flRackSize as RS } from './dawTheme';

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

/** Right-click fill options, mirroring FL Studio's channel context menu.
 *  `every: n` lights every nth step from step 1; 0 is used for "clear". */
const FILL_OPTIONS: { label: string; every: number }[] = [
    { label: 'Fill each 2 steps', every: 2 },
    { label: 'Fill each 3 steps', every: 3 },
    { label: 'Fill each 4 steps', every: 4 },
    { label: 'Fill each 6 steps', every: 6 },
    { label: 'Fill each 8 steps', every: 8 },
    { label: 'Fill all', every: 1 },
];

const MENU_W = 176;
const MENU_H = 210;

interface MenuState { x: number; y: number; channelId: string; channelName: string; }

export const ChannelRack: React.FC<ChannelRackProps> = ({ highlightChannelId, highlightStepIndex }) => {
    const channels = useDAWStore(s => s.state.channels);
    const currentStep = useDAWStore(s => s.state.transport.currentStep);
    const playing = useDAWStore(s => s.state.transport.playing);
    const toggleStep = useDAWStore(s => s.toggleStep);
    const setChannelSteps = useDAWStore(s => s.setChannelSteps);
    const setChannelVolume = useDAWStore(s => s.setChannelVolume);
    const setChannelPan = useDAWStore(s => s.setChannelPan);
    const toggleChannelMute = useDAWStore(s => s.toggleChannelMute);

    const isChannelHighlighted = (chId: string) => !!highlightChannelId && highlightChannelId === chId;
    const isStepHighlighted = (chId: string, idx: number) =>
        isChannelHighlighted(chId) && highlightStepIndex === idx;

    // ── Right-click fill menu ──
    const [menu, setMenu] = useState<MenuState | null>(null);

    const openMenu = (e: React.MouseEvent, chId: string, chName: string) => {
        e.preventDefault();   // suppress the browser's own context menu
        // Fixed positioning against the viewport, so the menu escapes the rack's
        // overflow:hidden / horizontal scroll containers instead of being clipped.
        setMenu({
            x: Math.min(e.clientX, window.innerWidth - MENU_W - 8),
            y: Math.min(e.clientY, window.innerHeight - MENU_H - 8),
            channelId: chId,
            channelName: chName,
        });
    };

    // `contextmenu` alone should be enough, but it's had reports of not firing
    // reliably in Firefox for some users on this page (couldn't reproduce locally
    // to confirm the exact cause). `mousedown` with the right button is about as
    // universally supported as pointer input gets, so it's wired as a second,
    // independent way to open the same menu rather than replacing the first —
    // whichever fires first wins, and a redundant second call is a harmless no-op
    // (same values, same result).
    const openMenuOnRightMouseDown = (e: React.MouseEvent, chId: string, chName: string) => {
        if (e.button === 2) openMenu(e, chId, chName);
    };

    const applyFill = useCallback((chId: string, every: number) => {
        const ch = channels.find(c => c.id === chId);
        if (ch) {
            setChannelSteps(chId, ch.steps.map((_, i) => every > 0 && i % every === 0));
        }
        setMenu(null);
    }, [channels, setChannelSteps]);

    // Dismiss on outside click, Escape, or anything that would move the anchor
    useEffect(() => {
        if (!menu) return;
        const close = () => setMenu(null);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        window.addEventListener('pointerdown', close);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('pointerdown', close);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [menu]);

    return (
        <div style={{
            background: daw.bg,
            fontFamily: dawFont.sans,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* ── Top app bar ── */}
            <div data-daw-drag style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                height: 32, padding: `0 ${S.modulePad}px`,
                background: flRack.header,
                borderBottom: `1px solid ${flRack.headerEdge}`,
                cursor: 'grab',
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

            {/* ── Channels ──
                One row per channel, as in the mockup: LED, volume/pan, plugin slot,
                name, meter, then the 16 steps. The earlier design split these across
                two side-by-side modules, which meant a row's controls and its steps
                could drift out of alignment when either module scrolled. */}
            <div style={{
                flex: 1, minHeight: 0, overflow: 'auto', padding: 10, background: flRack.bg,
            }}>
                <div style={{
                    minWidth: 'max-content', display: 'flex', flexDirection: 'column', gap: 10,
                    background: flRack.content, border: `1px solid ${flRack.contentEdge}`,
                    padding: '12px 10px',
                }}>
                    {/* Step-number ruler */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: RS.gap }}>
                        <div style={{ width: RS.leftW, flexShrink: 0 }} />
                        <div style={{ display: 'flex', gap: RS.stepGap }}>
                            {Array.from({ length: 16 }, (_, i) => (
                                <div key={i} style={{
                                    ...capsLabel, width: RS.step, textAlign: 'center',
                                    color: i % 4 === 0 ? daw.green : flRack.text,
                                }}>
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                    </div>

                    {channels.map(ch => (
                        <div key={ch.id}
                            onContextMenu={e => openMenu(e, ch.id, ch.name)}
                            onMouseDown={e => openMenuOnRightMouseDown(e, ch.id, ch.name)}
                            style={{ display: 'flex', alignItems: 'center', gap: RS.gap }}>

                            {/* Mute LED */}
                            <div
                                onClick={() => toggleChannelMute(ch.id)}
                                title={ch.muted ? 'Unmute' : 'Mute'}
                                style={{
                                    width: RS.led, height: RS.led, borderRadius: '50%', flexShrink: 0,
                                    cursor: 'pointer', border: `1px solid ${flRack.ledEdge}`,
                                    background: ch.muted ? daw.well : flRack.led,
                                    boxShadow: ch.muted
                                        ? 'inset 0 -1px 2px rgba(0,0,0,0.5)'
                                        : `inset 0 -1px 2px rgba(0,0,0,0.5), ${flRack.ledGlow}`,
                                }}
                            />

                            {/* Volume / pan */}
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <FLKnob value={ch.volume} onChange={v => setChannelVolume(ch.id, v)}
                                    size={RS.knob} color={daw.green} label="Volume" showLabel={false} />
                                <FLKnob value={ch.pan} min={-1} max={1} onChange={v => setChannelPan(ch.id, v)}
                                    size={RS.knob} color={daw.green} label="Pan" showLabel={false} />
                            </div>

                            {/* Decorative — FL's plugin slot; the simulator has no plugin browser */}
                            <div style={{
                                width: RS.slot, height: 24, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: flRack.slotFace, border: `1px solid ${flRack.headerEdge}`,
                                borderRadius: 3,
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.3)',
                            }}>
                                <span style={{ fontSize: 11, color: flRack.text, letterSpacing: '-0.5px' }}>
                                    -----
                                </span>
                            </div>

                            {/* Channel name */}
                            <div
                                data-academy-id={`channel-${ch.id}`}
                                onContextMenu={e => openMenu(e, ch.id, ch.name)}
                                onMouseDown={e => openMenuOnRightMouseDown(e, ch.id, ch.name)}
                                title={`${ch.name} — right-click to fill`}
                                style={{
                                    width: RS.name, height: 26, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: flRack.nameFace, borderRadius: 3,
                                    border: `1px solid ${isChannelHighlighted(ch.id) ? daw.green : flRack.headerEdge}`,
                                    boxShadow: isChannelHighlighted(ch.id)
                                        ? `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 10px ${daw.green}99`
                                        : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.3)',
                                }}>
                                <span style={{
                                    fontSize: 13, fontWeight: 500,
                                    color: ch.muted ? flRack.text : flRack.nameText,
                                    opacity: ch.muted ? 0.6 : 1,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    padding: '0 8px',
                                }}>
                                    {ch.name}
                                </span>
                            </div>

                            {/* Level meter — reads the channel's own volume rather than being
                                painted at a fixed height, so it actually means something */}
                            <div title={`${ch.name} level`} style={{
                                width: RS.meter, height: 30, flexShrink: 0, position: 'relative',
                                background: flRack.meterBg, border: `1px solid ${flRack.meterEdge}`,
                                borderRadius: 2, overflow: 'hidden',
                            }}>
                                <div style={{
                                    position: 'absolute', left: 0, right: 0, bottom: 0,
                                    height: `${Math.round((ch.muted ? 0 : ch.volume) * 100)}%`,
                                    background: flRack.meterFill,
                                }} />
                            </div>

                            {/* Steps */}
                            <div style={{ display: 'flex', gap: RS.stepGap }}>
                                {ch.steps.map((on, i) => {
                                    const isPlayhead = playing && currentStep === i;
                                    const hl = isStepHighlighted(ch.id, i);
                                    // Beat groups 2 & 4 take the darker shade — this is what
                                    // conveys the 4/4 grid, replacing wider group gutters.
                                    const isAltGroup = Math.floor(i / 4) % 2 === 1;

                                    let background: string;
                                    // Annotated: flRack is `as const`, so these would otherwise
                                    // narrow to their initial literal and reject the reassignments.
                                    let borderColor: string = flRack.stepEdge;
                                    let boxShadow: string = 'inset 0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.1)';
                                    if (on) background = flRack.stepOn;
                                    else background = isAltGroup ? flRack.stepAlt : flRack.stepOff;

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
                                                width: RS.step, height: RS.stepH, position: 'relative',
                                                borderRadius: 3, padding: 0, cursor: 'pointer',
                                                border: `1px solid ${borderColor}`,
                                                background, boxShadow,
                                                opacity: ch.muted ? 0.45 : 1,
                                                transition: 'background 0.05s, box-shadow 0.12s',
                                            }}>
                                            {/* The mockup's recessed cap across the top of each pad */}
                                            <span style={{
                                                position: 'absolute', top: 3, left: 3, right: 3, height: 4,
                                                borderRadius: 1, background: 'rgba(0,0,0,0.2)',
                                            }} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 30, padding: `0 ${S.modulePad}px`,
                background: flRack.bg,
                borderTop: `1px solid ${flRack.headerEdge}`,
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

            {/* ── Right-click fill menu ──
                Portaled straight to document.body rather than rendered in place. The
                lesson player wraps this whole simulator in a `backdrop-filter: blur()`
                glass panel, and per spec that makes the panel the containing block for
                any `position: fixed` descendant instead of the viewport — Firefox
                honours that (Chrome has historically been inconsistent about it), so a
                fixed-position menu using raw viewport coordinates would land far outside
                the panel and get clipped by its overflow:hidden, invisibly. A portal
                sidesteps the whole question by placing the menu outside any ancestor
                that could become its containing block. */}
            {menu && createPortal(
                <div
                    // Stop the window-level dismiss handler from firing before the
                    // item's onClick gets a chance to run.
                    onPointerDown={e => e.stopPropagation()}
                    onContextMenu={e => e.preventDefault()}
                    style={{
                        position: 'fixed', left: menu.x, top: menu.y, zIndex: 200,
                        width: MENU_W,
                        background: daw.panel,
                        border: `1px solid ${daw.border}`,
                        borderRadius: 3,
                        boxShadow: dawFx.windowShadow,
                        padding: 3,
                        fontFamily: dawFont.sans,
                    }}>
                    <div style={{
                        ...capsLabel, color: daw.textDim,
                        padding: '4px 8px 5px',
                        borderBottom: `1px solid ${daw.border}`,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {menu.channelName.toUpperCase()}
                    </div>

                    {FILL_OPTIONS.map(opt => (
                        <MenuItem key={opt.every}
                            label={opt.label}
                            onClick={() => applyFill(menu.channelId, opt.every)} />
                    ))}

                    <div style={{ borderTop: `1px solid ${daw.border}`, margin: '3px 0' }} />
                    <MenuItem label="Clear" onClick={() => applyFill(menu.channelId, 0)} />
                </div>,
                document.body,
            )}
        </div>
    );
};

const MenuItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
    const [hover, setHover] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                padding: '5px 8px', borderRadius: 2, cursor: 'pointer',
                fontSize: 12,
                color: hover ? daw.white : daw.textBright,
                background: hover ? daw.highlight : 'transparent',
            }}>
            {label}
        </div>
    );
};
