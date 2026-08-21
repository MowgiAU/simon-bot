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
    // ── Shell ──
    shell:  '#3b4347',   // toolbar container
    panel:  '#454c50',   // the recessed toolbar rows
    dark:   '#2a3135',
    border: '#22282b',
    text:   '#a8b0b5',

    // ── Menu bar ──
    menuBg:    '#4c5b59',
    menuEdge:  '#5a6b69',  // top highlight
    menuUnder: '#3a4544',  // 2px bottom rule
    menuText:  '#e0e0e0',
    menuHover: '#ffffff',

    // ── Hint panel ──
    hintBg:     '#383f43',
    hintBorder: '#2c3235',
    hintEdge:   '#485258',
    hintMuted:  '#8b979e',
    hintText:   '#f0f0f0',
    hintIcon:   '#727a7f',

    // ── Transport ──
    // One rounded pill holds PAT/SONG, play and stop; record is a separate bezel
    // with a small lit dot in it, not a solid red disc.
    pillBg:       '#333A3F',
    pillBorder:   '#1C2124',
    pillDivide:   '#1D2226',
    patOn:        'linear-gradient(to bottom, #FFC766, #EE8A18)',
    patOnText:    '#111111',
    songBg:       '#363E44',
    songText:     '#5B6A75',
    playIcon:     '#A2B1BC',
    recBezel:     '#394248',
    recBezelEdge: '#2A3135',
    recDot:       '#FA5C5C',

    // ── Tempo: the one pale panel in the window ──
    tempoBg:    '#CEDEE5',
    tempoEdge:  '#91A2AD',
    tempoText:  '#194C72',
    tempoDim:   '#467396',
    tempoArrow: '#849AA8',

    // ── Time LCD ──
    timerFace: 'linear-gradient(to bottom, #4a5d5f, #3a494a)',
    timerEdge: '#252b2e',
    timerCyan: '#80FFFF',

    // ── Raised buttons ──
    btnFace:    'linear-gradient(to bottom, #42494e, #31373a)',
    btnEdgeTop: '#545b60',
    btnEdgeLt:  '#4a5155',
    btnEdgeRt:  '#23282b',
    btnEdgeBot: '#1a1e21',
    btnDown:    '#2a3033',
    btnDownEdge:'#3a4145',
    btnIcon:    '#d0d6d9',

    // ── Pattern selector: a light Win95-style input ──
    inputFace:  'linear-gradient(to bottom, #d6d9da, #eaeced)',
    inputEdge:  '#a3a6a8',
    inputText:  '#2a3c46',
    inputArrow: '#7a8c96',

    // ── Misc ──
    snapText: '#6bb5dc',
    cartFace: 'linear-gradient(to bottom, #546a68, #425553)',

    // ── Browser ──
    browserBg:     '#1e2428',
    browserHeader: '#333a40',
    browserIcon:   '#828a92',
    browserEdge:   '#13181a',
    browserLight:  '#2b3338',

    // ── Shared depth ──
    innerPanel: 'inset 0 2px 4px rgba(0,0,0,0.4)',
    btnUp:      '0 2px 3px rgba(0,0,0,0.3)',
    btnDownFx:  'inset 0 2px 4px rgba(0,0,0,0.5)',
} as const;

/**
 * Channel Rack, from the "channel rack 2" mockup. That design puts every control for
 * a channel on ONE row — LED, knobs, plugin slot, name, meter, then the 16 steps —
 * rather than splitting instruments and sequencer into two side-by-side modules.
 */
export const flRack = {
    bg:          '#404851',
    border:      '#23282d',
    header:      'linear-gradient(to bottom, #444c56, #3b424b)',
    headerEdge:  '#282d33',
    content:     '#525b65',
    contentEdge: '#3c434b',
    text:        '#a0aab5',

    led:     'radial-gradient(circle at 30% 30%, #84cc16, #4d7c0f)',
    ledEdge: '#1a1e23',
    ledGlow: '0 0 5px rgba(132, 204, 22, 0.5)',

    slotFace: 'linear-gradient(to bottom, #505963, #434a53)',
    nameFace: 'linear-gradient(to bottom, #5b6571, #47505a)',
    nameText: '#e5e7eb',

    meterBg:   '#2b3036',
    meterEdge: '#1f2328',
    meterFill: '#84cc16',

    stepOff:  'linear-gradient(to bottom, #58626e, #47505a)',
    stepAlt:  'linear-gradient(to bottom, #4c5560, #3d454e)',
    stepOn:   'linear-gradient(to bottom, #7a5c5c, #5e4646)',
    stepEdge: '#282d33',
} as const;

/** Channel Rack row geometry, shared by the step ruler so its numbers line up. */
export const flRackSize = {
    led: 12, knob: 24, slot: 50, name: 140, meter: 8,
    step: 22, stepH: 32, stepGap: 2, gap: 8,
    /** Everything left of the step grid, so the ruler can offset by exactly that much */
    leftW: 12 + 8 + (24 + 4 + 24) + 8 + 50 + 8 + 140 + 8 + 8,
} as const;

/**
 * Natural width of a Channel Rack window — the row content plus every layer of
 * padding, border and window frame around it.
 *
 * Derived rather than hardcoded on purpose: the rack's default window size was a
 * fixed number that silently stopped matching when the row layout changed, leaving
 * the last steps clipped off the right edge. Computing it here means the two can't
 * drift apart again.
 */
export const flRackWidth =
    flRackSize.leftW                                              // controls
    + flRackSize.gap                                              // gap before the grid
    + (16 * flRackSize.step + 15 * flRackSize.stepGap)            // the 16 pads
    + 20 + 2                                                      // content panel padding + border
    + 20                                                          // scroll area padding
    + 8;                                                          // window frame

/**
 * FL colour-codes its browser tree by folder kind, which is most of what makes the
 * panel readable at a glance. From the browser mockup.
 */
export const flBrowserInk = {
    orange: '#d17c5b',
    green:  '#8bb06f',
    blue:   '#5b8fc6',
    purple: '#a06e90',
    pink:   '#b46d7e',
    red:    '#c06c6c',
    cyan:   '#66a2a0',
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
    /**
     * The mockups' three faces. DAWWorkspace injects the Google Fonts link on mount
     * rather than index.html doing it — every other page in the app would otherwise
     * pay for three families it never renders. Each falls back to a narrow OS face,
     * so the chrome still reads correctly if the request is blocked or slow.
     */
    menu:      "Oswald, 'Arial Narrow', 'Segoe UI', sans-serif",
    condensed: "'Roboto Condensed', 'Arial Narrow', 'Segoe UI', sans-serif",
    lcd:       "'Share Tech Mono', ui-monospace, Consolas, monospace",
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
