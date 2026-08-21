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

/**
 * Playlist chrome, from the Stitch playlist mockup + the real FL screenshot.
 * Deeper and cooler than the mixer greys because that's what FL's arrangement
 * view actually looks like.
 */
export const flPlaylist = {
    windowBar:   '#101417',
    header:      '#171c1f',
    toolbar:     '#2c3338',
    browserBg:   '#1e2429',
    trackBg:     '#333b41',
    trackBgSel:  '#2d353a',
    trackEdge:   '#404a52',
    gridBg:      '#273138',
    gridLine:    '#1b2328',   // per beat
    gridLineBar: '#11171a',   // per bar, heavier
    rulerBg:     '#21292e',
    rulerTick:   '#3a444a',
    patternRed:  '#902c2c',
    patternRedEdge: '#a83636',
    automation:  '#2c6e8a',
    playhead:    '#dc2626',
    led:         '#a6e22e',
    text:        '#bdc9d2',
    textDim:     '#87929a',
    outline:     '#3c484f',
} as const;

/**
 * FL's top chrome — the menu strip and the hint panel below it.
 *
 * Deliberately lighter than every other token group here: these two sit *above*
 * the workspace rather than inside it, and in FL they read as raised slate
 * panels catching the light, not as the near-black recesses the playlist and
 * mixer are built from.
 */
export const flChrome = {
    bar:       '#55686d',  // the strip both panels sit on
    menuBg:    '#647b80',  // raised menu panel
    menuEdge:  '#8399a0',  // its lit top edge
    menuText:  '#d9e6e2',
    menuHover: '#7c9298',
    hintBg:    '#3d5055',  // recessed hint well
    hintEdge:  '#5f747a',
    hintLabel: '#8ca0a2',  // the [code] and FREE lines
    hintText:  '#eef5f2',
} as const;

/** Per-band colours for the EQ, from the Parametric EQ mockup */
export const eqBandColors = [
    '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa',
] as const;

/** The Stitch designs call for Segoe UI; keep a mono stack for numeric and caps
 *  labels. Neither needs a network request. */
export const dawFont = {
    sans: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    /** FL sets its menu bar in a narrow face; these all ship with the OS, so still no
     *  network request. Falls back to `sans` rather than a wide default if none match. */
    condensed: "'Arial Narrow', 'Helvetica Neue Condensed', 'Liberation Sans Narrow', 'Segoe UI', sans-serif",
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
