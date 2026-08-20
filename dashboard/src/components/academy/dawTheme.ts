/**
 * dawTheme — shared skin tokens for the Academy DAW simulator.
 *
 * Ported from the Stitch Channel Rack design (Material-style dark surfaces,
 * lime primary, peach active pads, cyan playhead). Lives here rather than in
 * `theme/theme.ts` on purpose: this is a *simulated FL Studio window*, not
 * site chrome, so it deliberately doesn't inherit the Fuji Studio palette.
 * Every simulator component (ChannelRack, Transport, DAWSimulator, FLKnob)
 * reads from this one file so the window stays visually coherent.
 */

export const daw = {
    // Surfaces, lightest-recessed → most-raised
    surfaceContainerLowest: '#0c0e10',
    surface:                '#121416',
    surfaceContainerLow:    '#1a1c1e',
    surfaceContainer:       '#1e2022',
    surfaceContainerHigh:   '#282a2c',
    surfaceVariant:         '#333537',
    surfaceBright:          '#37393b',

    // Lines & text
    outlineVariant:  '#444933',
    outline:         '#8e9379',
    onSurface:       '#e2e2e5',
    onSurfaceVariant:'#c4c9ac',

    // Accents
    primaryContainer:  '#c3f400',  // lime — LEDs, beat markers, lesson highlight
    onPrimary:         '#283500',
    ledRim:            '#161e00',
    secondary:         '#ffb59e',  // peach — lit step
    stepOnBorder:      '#852400',
    stepAltBorder:     '#3a0b00',
    tertiaryContainer: '#7df4ff',  // cyan — transport playhead
    onTertiaryContainer:'#006f77',
} as const;

export const dawFx = {
    innerShadowWell: 'inset 0 2px 4px rgba(0,0,0,0.5)',

    knobGradient: 'linear-gradient(135deg, #37393b 0%, #1e2022 100%)',
    knobShadow:   '0 1px 2px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)',

    /** Steps in beat groups 1 & 3 — neutral */
    padInactive: 'linear-gradient(to bottom, #333537 0%, #1e2022 100%)',
    /** Steps in beat groups 2 & 4 — warm tint, so the 4/4 grid reads without extra gaps */
    padAlt:      'linear-gradient(to bottom, #4a3b38 0%, #2a201e 100%)',
    padShadow:   'inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.8)',

    btnSurface: 'linear-gradient(to bottom, #37393b 0%, #282a2c 100%)',
    btnShadow:  'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.6)',
} as const;

/** The design calls for JetBrains Mono / Hanken Grotesk; neither is loaded by the
 *  app, so keep the typographic *roles* (mono for numeric + caps labels) using
 *  stacks that need no network request. */
export const dawFont = {
    sans: "'Segoe UI', Tahoma, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/** Shared geometry so the instruments module and the sequencer module stay
 *  row-aligned — both start with a HEADER_H strip, then ROW_H rows at ROW_GAP. */
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
