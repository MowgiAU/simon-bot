/**
 * dawTheme — shared skin tokens for the Academy DAW simulator.
 *
 * Palette ported from the Stitch Mixer design, which tracks real FL Studio far
 * more closely than the earlier Material-style dark scheme: slate-green greys,
 * near-black recesses, a single green accent for LEDs and active controls.
 *
 * Lives here rather than in `theme/theme.ts` on purpose: this is a *simulated
 * FL Studio window*, not site chrome, so it deliberately doesn't inherit the
 * Fuji Studio palette. Every simulator component (ChannelRack, Mixer,
 * Transport, DAWSimulator, FLKnob) reads from this one file so the window
 * can't drift apart piece by piece.
 */

export const daw = {
    // ── Window chrome ──
    bg:        '#333b3f',  // window body / channel area
    panel:     '#414a51',  // raised surfaces: strips, inspector, instrument rows
    dark:      '#2a3135',  // title bars, footers, recessed grid area
    border:    '#22282b',
    well:      '#1a1f22',  // deepest recess: fader tracks, unlit LEDs, wells
    highlight: '#525a61',  // hover, scrollbar thumb, raised edge

    // ── Accent ──
    green:       '#80c040',
    greenBright: '#a0e050',
    greenDark:   '#70b030',
    greenEdge:   '#407010',

    // ── Text ──
    text:       '#98a0a5',
    textBright: '#d0d5d8',
    textDim:    '#6b7378',
    white:      '#ffffff',

    /**
     * Channel-rack step colours. Deliberately red rather than the scheme's
     * green: in real FL these sit alongside exactly this slate chrome, and
     * green is already spoken for by LEDs and active faders — a green "on"
     * step would collide with both.
     */
    stepOnEdge: '#5a2a22',
    stepAltEdge:'#2b3136',
    /** Playhead: bright neutral so it reads over lit (red) and unlit (slate) alike */
    playhead:   '#d0d5d8',
} as const;

export const dawFx = {
    // Knobs — radial highlight from upper-left, like the design's .knob
    knob:       'radial-gradient(circle at 30% 30%, #5a6368, #2a3135)',
    knobShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)',

    // Faders
    faderTrackShadow:  'inset 0 2px 5px rgba(0,0,0,0.5)',
    faderHandle:       'linear-gradient(to bottom, #d0d5d8, #a0a5a8)',
    faderHandleActive: 'linear-gradient(to bottom, #a0e050, #70b030)',
    faderHandleShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8)',

    // LEDs
    ledOff: 'inset 0 1px 2px rgba(0,0,0,0.5)',
    ledOn:  '0 0 5px #80c040, inset 0 1px 1px rgba(255,255,255,0.5)',

    // Channel-rack step pads. Beat groups 2 & 4 take `padAlt` so the 4/4 grid
    // reads through shading instead of extra gutters.
    padOff:    'linear-gradient(to bottom, #525a61 0%, #414a51 100%)',
    padAlt:    'linear-gradient(to bottom, #454d54 0%, #363d43 100%)',
    padOn:     'linear-gradient(to bottom, #a0524a 0%, #8a423a 55%, #78382f 100%)',
    padShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.4)',

    // Raised buttons (channel names, plugin slots)
    btnSurface: 'linear-gradient(to bottom, #525a61 0%, #414a51 100%)',
    btnShadow:  'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.4)',

    innerShadowWell: 'inset 0 2px 4px rgba(0,0,0,0.5)',
    windowShadow:    '0 10px 30px rgba(0,0,0,0.5)',
} as const;

/** The Stitch designs call for Segoe UI; keep a mono stack for numeric and caps
 *  labels. Neither needs a network request. */
export const dawFont = {
    sans: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/** Channel-rack geometry. The instruments and sequencer modules both open with
 *  a HEADER_H strip so their rows stay aligned across the gap. */
export const dawSize = {
    padW: 16,
    padH: 24,
    padGap: 4,
    rowH: 32,
    rowGap: 8,
    headerH: 14,
    knob: 24,
    led: 12,
    pluginW: 64,
    nameW: 128,
    modulePad: 12,
    moduleGap: 16,
    barH: 32,
} as const;
