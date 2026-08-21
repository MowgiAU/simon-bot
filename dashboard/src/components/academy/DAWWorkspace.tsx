/**
 * DAWWorkspace — the full FL Studio shell.
 *
 * Chrome follows FL's real toolbar: two compact rows, everything left-packed with
 * the row trailing off into empty space rather than stretching to fill it. Menus
 * over the hint panel on the left, then transport/tempo over the master fader, then
 * the time LCD and pattern selector over the window toggles. Below that, the browser
 * down the left and the free-moving windows on the canvas.
 *
 * Colours come from the three Stitch mockups via dawTheme's flChrome, which
 * reconciles the slightly different palette each one shipped.
 *
 * The canvas is the anchor for the lesson coachmark bubble, so it must stay
 * un-scrolled and position:relative — windows move within it, and the bubble
 * measures against it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Play, Square, ChevronDown, Folder, Star, Cloud, Globe,
    FileMusic, Package, Music, Minus, Plus, X,
    Grid3x3, ListMusic, SlidersVertical, Piano, PanelLeft,
    Files, Volume2, RefreshCw, ArrowUp, ShoppingCart, Trash2, Magnet,
} from 'lucide-react';
import { useDAWStore } from './DAWStore';
import { ChannelRack } from './ChannelRack';
import { Playlist } from './Playlist';
import { Mixer } from './Mixer';
import { PianoRoll } from './PianoRoll';
import { ParametricEQ } from './ParametricEQ';
import { DAWWindow, WindowRect } from './DAWWindow';
import { daw, dawFx, dawFont, flChrome, flBrowserInk, flRackWidth } from './dawTheme';

type WinId = 'rack' | 'playlist' | 'mixer' | 'piano' | 'eq';

interface WinDef { id: WinId; title: string; rect: WindowRect; open: boolean; z: number; }

interface Note { pitch: number; start: number; length: number; }

const MENUS = ['FILE', 'EDIT', 'ADD', 'PATTERNS', 'VIEW', 'OPTIONS', 'TOOLS', 'HELP'];

/** Floor for the menu/hint column; the real width is measured from the menus. */
const LEFT_COL_MIN = 292;
/** Horizontal padding on the menu/hint cells, added back onto the measured width. */
const MENU_PAD = 22;

/** FL's toolbar window toggles, in FL's own order */
const TOGGLES: { id: string; icon: React.ElementType; label: string }[] = [
    { id: 'playlist', icon: ListMusic, label: 'Playlist' },
    { id: 'rack', icon: Grid3x3, label: 'Channel rack' },
    { id: 'piano', icon: Piano, label: 'Piano roll' },
    { id: 'mixer', icon: SlidersVertical, label: 'Mixer' },
    { id: 'browser', icon: PanelLeft, label: 'Browser' },
];

/** Category strip above the browser tree */
const BROWSER_TABS: { icon: React.ElementType; label: string }[] = [
    { icon: Package, label: 'Plugin database' },
    { icon: Files, label: 'Project files' },
    { icon: Volume2, label: 'Audio' },
    { icon: Globe, label: 'Online content' },
    { icon: Cloud, label: 'FL Cloud' },
    { icon: Star, label: 'Favourites' },
];

/**
 * FL's browser tree. Decorative — the simulator has no file system behind it — but
 * colour-coded by folder kind as FL does, which is most of what makes the panel
 * readable at a glance. Colours from the browser mockup.
 */
const ink = flBrowserInk;
const BROWSER_ITEMS: { label: string; icon: React.ElementType; color: string }[] = [
    { label: 'Current project', icon: FileMusic, color: ink.orange },
    { label: 'Recent files', icon: Folder, color: ink.green },
    { label: 'Plugin database', icon: Package, color: ink.blue },
    { label: 'Plugin presets', icon: Package, color: ink.purple },
    { label: 'Channel presets', icon: Folder, color: ink.pink },
    { label: 'Mixer presets', icon: Folder, color: ink.pink },
    { label: 'Scores', icon: Music, color: ink.red },
    { label: 'Audio', icon: Folder, color: ink.cyan },
    { label: 'Backup', icon: Folder, color: ink.green },
    { label: 'Channel envelopes', icon: Folder, color: ink.cyan },
    { label: 'Clipboard files', icon: Folder, color: ink.cyan },
    { label: 'Demo projects', icon: Folder, color: ink.cyan },
    { label: 'Envelopes', icon: Folder, color: ink.cyan },
    { label: 'FL Cloud', icon: Cloud, color: ink.blue },
    { label: 'Impulses', icon: Folder, color: ink.cyan },
    { label: 'MIDI', icon: Folder, color: ink.cyan },
];

interface DAWWorkspaceProps {
    /** Windows this lesson uses. Empty/omitted shows the full studio. */
    visibleWindows?: WinId[];
    /**
     * Sample-backed channels this lesson wants loaded before the first Play. AudioEngine
     * can't fetch/decode a sample until it exists, and it can't exist before a user gesture
     * — so the earliest this can start is the first Play click, which is also the moment
     * that needs to wait for it. See handlePlay.
     */
    sampleAssets?: { name: string; url: string; type: string }[];
    highlightChannelId?: string | null;
    highlightStepIndex?: number | null;
    highlightInserts?: number[];
    highlightBpm?: boolean;
    highlightEQBand?: number | null;
    highlightBars?: number[];
    highlightTrack?: number | null;
}

export const DAWWorkspace: React.FC<DAWWorkspaceProps> = ({
    visibleWindows, sampleAssets,
    highlightChannelId, highlightStepIndex, highlightInserts, highlightBpm,
    highlightEQBand, highlightBars, highlightTrack,
}) => {
    const transport = useDAWStore(s => s.state.transport);
    const play = useDAWStore(s => s.play);
    const stop = useDAWStore(s => s.stop);
    const setBpm = useDAWStore(s => s.setBpm);
    const setMode = useDAWStore(s => s.setTransportMode);
    const initEngine = useDAWStore(s => s.initEngine);

    const canvasRef = useRef<HTMLDivElement>(null);
    const [bounds, setBounds] = useState({ w: 1200, h: 700 });
    const [hint, setHint] = useState('');
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [pianoNotes, setPianoNotes] = useState<Note[]>([]);
    const [eqInsertId, setEqInsertId] = useState<number>(1);
    const [zTop, setZTop] = useState(10);
    const [browserOpen, setBrowserOpen] = useState(true);

    // Width of the menu/hint column, measured rather than fixed. Oswald loads lazily
    // and is wider than the Arial Narrow fallback the menus render in until it lands,
    // so any hardcoded width fits one of those two and lets the other spill its text
    // across the transport controls.
    //
    // `menuRef` is the INNER max-content row, never the outer cell this sets the width
    // of. Measuring the outer cell fed its own padding back in on every pass -- width
    // is content-box but scrollWidth counts padding -- so the ResizeObserver drove it
    // wider and wider without bound. The inner row's width doesn't depend on the outer
    // cell's, which is what makes observing it safe.
    const menuRef = useRef<HTMLDivElement>(null);
    const [leftW, setLeftW] = useState(LEFT_COL_MIN);
    useEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const measure = () => setLeftW(Math.max(LEFT_COL_MIN, Math.ceil(el.offsetWidth) + MENU_PAD));
        measure();
        document.fonts.ready.then(measure).catch(() => { /* fallback metrics stand */ });
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const [wins, setWins] = useState<WinDef[]>(() => {
        const only = visibleWindows && visibleWindows.length ? new Set<WinId>(visibleWindows) : null;
        const open = (id: WinId, fallback: boolean) => only ? only.has(id) : fallback;
        return [
            // Widths come from each panel's real content width, so a window never opens
            // already clipped. The rack's comes from flRackWidth, computed from its own
            // row geometry — a hardcoded number here went stale the moment the rack was
            // redesigned and cut the last steps off.
            { id: 'rack', title: 'Channel rack', rect: { x: 14, y: 12, w: flRackWidth, h: 302 }, open: open('rack', true), z: 3 },
            { id: 'playlist', title: 'Playlist', rect: { x: 14, y: 330, w: 880, h: 340 }, open: open('playlist', true), z: 2 },
            { id: 'mixer', title: 'Mixer', rect: { x: flRackWidth + 28, y: 12, w: 600, h: 430 }, open: open('mixer', true), z: 1 },
            { id: 'piano', title: 'Piano roll', rect: { x: 260, y: 120, w: 640, h: 340 }, open: open('piano', false), z: 4 },
            { id: 'eq', title: 'Parametric EQ 2', rect: { x: 180, y: 70, w: 700, h: 380 }, open: open('eq', false), z: 5 },
        ];
    });

    // The chrome's three typefaces. Injected here rather than from index.html so only
    // Academy visitors pay for them — every other page in the app would otherwise fetch
    // three families it never renders. Left in place on unmount: the stylesheet is cheap
    // to keep, and removing it would re-fetch (and briefly re-flow) on the way back in.
    useEffect(() => {
        const ID = 'fuji-daw-fonts';
        if (document.getElementById(ID)) return;
        const link = document.createElement('link');
        link.id = ID;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500'
            + '&family=Roboto+Condensed:wght@400;700&family=Share+Tech+Mono&display=swap';
        document.head.appendChild(link);
    }, []);

    // Track the canvas size so windows can be clamped inside it
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const measure = () => setBounds({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Fit windows to the canvas once it's measured. Without this a window whose
    // natural size is bigger than the available area opens partly off-screen —
    // and on a lesson that shows a single window, centre it rather than leaving
    // it tucked in the corner with dead space beside it.
    const fitted = useRef(false);
    useEffect(() => {
        if (fitted.current || bounds.w < 50) return;
        fitted.current = true;
        setWins(ws => {
            const openCount = ws.filter(w => w.open).length;
            return ws.map(w => {
                const width = Math.min(w.rect.w, bounds.w - 24);
                const height = Math.min(w.rect.h, bounds.h - 24);
                const solo = openCount === 1 && w.open;
                return {
                    ...w,
                    rect: {
                        w: width,
                        h: height,
                        x: solo ? Math.max(12, (bounds.w - width) / 2) : Math.min(w.rect.x, Math.max(12, bounds.w - width - 12)),
                        y: solo ? Math.max(12, Math.min(w.rect.y, (bounds.h - height) / 2)) : Math.min(w.rect.y, Math.max(12, bounds.h - height - 12)),
                    },
                };
            });
        });
    }, [bounds]);

    const patch = useCallback((id: WinId, next: Partial<WinDef>) => {
        setWins(ws => ws.map(w => w.id === id ? { ...w, ...next } : w));
    }, []);

    const focus = useCallback((id: WinId) => {
        setZTop(z => {
            const next = z + 1;
            setWins(ws => ws.map(w => w.id === id ? { ...w, z: next } : w));
            return next;
        });
    }, []);

    const toggleWin = useCallback((id: WinId) => {
        setWins(ws => ws.map(w => w.id === id ? { ...w, open: !w.open } : w));
        focus(id);
    }, [focus]);

    const openEQ = useCallback((insertId: number) => {
        setEqInsertId(insertId);
        setWins(ws => ws.map(w => w.id === 'eq' ? { ...w, open: true } : w));
        focus('eq');
    }, [focus]);

    /**
     * Step the tempo. Reads the live store value rather than this render's `transport.bpm`:
     * clicking a spinner twice in quick succession fires both handlers against the same
     * render closure, so a closure-captured value would make the second click a no-op and
     * silently drop the increment.
     */
    const nudgeBpm = (delta: number) =>
        setBpm(clampBpm(useDAWStore.getState().state.transport.bpm + delta));

    const handlePlay = async () => {
        await initEngine();
        if (transport.playing) { stop(); return; }
        // useDAWStore.getState() rather than the hook-selected `engine`: initEngine's `set()`
        // above lands before this line runs, but a hook-bound value from this render can
        // still be the pre-init null — getState() always reads the live value.
        const eng = useDAWStore.getState().engine;
        // Loaded here, not just left to whatever reactive preload a lesson hook fires off
        // elsewhere: that preload can only ever start once the engine exists (same gate as
        // this line), so anything that only *waits* for pending loads risks checking before
        // that other loader has even registered one. Calling loadSample directly ties this
        // wait to loads it's certain were actually started -- AudioEngine.loadSample
        // deduplicates by name, so if the other loader got there first this just awaits it.
        if (eng && sampleAssets?.length) {
            await Promise.allSettled(
                sampleAssets
                    .filter(a => a.type === 'sample' && a.url)
                    .map(a => eng.loadSample(a.name, a.url)),
            );
        }
        play();
    };

    /** FL's hint panel: mirrors the title of whatever's under the pointer. */
    const onHover = (e: React.MouseEvent) => {
        const el = (e.target as HTMLElement).closest('[title]') as HTMLElement | null;
        setHint(el?.getAttribute('title') ?? '');
    };

    const winById = useMemo(() => Object.fromEntries(wins.map(w => [w.id, w])) as Record<WinId, WinDef>, [wins]);

    const renderWindow = (id: WinId, chrome: boolean, body: React.ReactNode) => {
        const w = winById[id];
        if (!w?.open) return null;
        return (
            <DAWWindow
                key={id}
                title={w.title}
                rect={w.rect}
                z={w.z}
                chrome={chrome}
                bounds={bounds}
                onChange={r => patch(id, { rect: r })}
                onFocus={() => focus(id)}
                onClose={() => patch(id, { open: false })}
            >
                {body}
            </DAWWindow>
        );
    };

    return (
        <div
            onMouseOver={onHover}
            onMouseLeave={() => setHint('')}
            style={{
                display: 'flex', flexDirection: 'column',
                height: '100%', minHeight: 0,
                background: daw.bg, fontFamily: dawFont.sans, color: flChrome.text,
                border: '1px solid #000', borderRadius: 3, overflow: 'hidden',
            }}>

            {/* ── Toolbar band ──
                Two compact rows. Everything is left-packed and the row ends in flexible
                empty space, which is how FL actually looks on a wide window — the controls
                do NOT stretch to fill it. */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0,
                height: 80, padding: 2, background: flChrome.shell,
                borderBottom: '1px solid #000', position: 'relative', zIndex: 40,
                overflow: 'hidden', boxSizing: 'border-box',
            }}>

                {/* Row 1's horizontal scrollbar (if content ever needs one) lives inside
                    row 1's own fixed-height box, so it can never eat into row 2's height --
                    the two rows no longer share one scroll container. */}
                {/* ══ Row 1: menus, transport, time, pattern ══ */}
                <div style={{
                    display: 'flex', alignItems: 'stretch', gap: 5, height: 37, flexShrink: 0,
                    overflowX: 'auto', overflowY: 'hidden',
                }}>
                    <div
                        // Narration steps with no named control anchor their bubble here.
                        data-academy-id="daw-titlebar"
                        style={{
                            width: leftW, flexShrink: 0, boxSizing: 'border-box',
                            display: 'flex', alignItems: 'center',
                            // Backstop: if the measure is ever wrong, menu text is clipped
                            // rather than drawn on top of the transport.
                            overflow: 'hidden', whiteSpace: 'nowrap',
                            background: flChrome.menuBg, padding: '0 10px',
                            borderTop: `1px solid ${flChrome.menuEdge}`,
                            borderBottom: `1px solid ${flChrome.menuUnder}`,
                            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)',
                        }}>
                      <div ref={menuRef} style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: 'max-content',
                      }}>
                        {MENUS.map(m => (
                            <div key={m} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setOpenMenu(openMenu === m ? null : m)}
                                    title={m === 'VIEW' ? 'Show or hide windows' : `${m} menu`}
                                    style={{
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        padding: 0, lineHeight: 1,
                                        fontFamily: dawFont.menu, fontSize: 16, fontWeight: 400,
                                        letterSpacing: '0.3px',
                                        color: openMenu === m ? flChrome.menuHover : flChrome.menuText,
                                        textShadow: '1px 1px 0px rgba(0,0,0,0.5)',
                                    }}>
                                    {m}
                                </button>
                                {openMenu === m && (
                                    <div onMouseLeave={() => setOpenMenu(null)} style={{
                                        position: 'absolute', top: '100%', left: 0, zIndex: 500,
                                        minWidth: 204, background: flChrome.panel,
                                        border: `1px solid ${flChrome.border}`, borderRadius: 3,
                                        boxShadow: '0 8px 22px rgba(0,0,0,0.6)', padding: 3,
                                    }}>
                                        {m === 'VIEW' ? wins.filter(w =>
                                            !visibleWindows?.length || visibleWindows.includes(w.id)
                                        ).map(w => (
                                            <div key={w.id}
                                                onClick={() => { toggleWin(w.id); setOpenMenu(null); }}
                                                data-academy-id={`daw-view-${w.id}`}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '6px 10px', fontSize: 14, cursor: 'pointer',
                                                    borderRadius: 2, color: flChrome.text,
                                                    fontFamily: dawFont.condensed,
                                                }}>
                                                <span style={{ width: 13, textAlign: 'center', color: daw.green, fontWeight: 700 }}>
                                                    {w.open ? '✓' : ''}
                                                </span>
                                                {w.title}
                                            </div>
                                        )) : (
                                            <div style={{
                                                padding: '7px 11px', fontSize: 14, color: flChrome.hintMuted,
                                                fontStyle: 'italic', fontFamily: dawFont.condensed,
                                            }}>
                                                Not simulated
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                      </div>
                    </div>

                    {/* Transport pill: PAT/SONG + play + stop share one rounded body */}
                    <div style={{
                        display: 'flex', alignItems: 'stretch', flexShrink: 0,
                        background: flChrome.pillBg, borderRadius: 9999,
                        border: `1px solid ${flChrome.pillBorder}`,
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.1)',
                        overflow: 'hidden',
                    }}>
                        {/* Mode — two half-height buttons, so each is directly selectable */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', width: 38,
                            borderRight: `1px solid ${flChrome.pillDivide}`,
                        }}>
                            {(['pat', 'song'] as const).map(m => {
                                const on = transport.mode === m;
                                return (
                                    <button key={m}
                                        onClick={() => setMode(m)}
                                        // Kept on the PAT half so lesson steps targeting
                                        // transport-mode still resolve to a real element.
                                        data-academy-id={m === 'pat' ? 'transport-mode' : undefined}
                                        title={m === 'pat'
                                            ? 'Pattern mode — loop the Channel Rack bar'
                                            : 'Song mode — play the playlist arrangement'}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: 'none', padding: 0, cursor: 'pointer',
                                            background: on ? flChrome.patOn : flChrome.songBg,
                                            boxShadow: on
                                                ? 'inset 0 1px 1px rgba(255,255,255,0.7)'
                                                : 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                        }}>
                                        <span style={{
                                            fontFamily: dawFont.condensed, fontWeight: 700,
                                            fontSize: 8, letterSpacing: '0.02em', lineHeight: 1,
                                            color: on ? flChrome.patOnText : flChrome.songText,
                                        }}>
                                            {m.toUpperCase()}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={handlePlay} data-academy-id="transport-play" title="Play / pause"
                            style={{
                                width: 31, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: flChrome.pillBg, cursor: 'pointer', padding: 0,
                                border: 'none', borderRight: `1px solid ${flChrome.pillDivide}`,
                            }}>
                            <Play size={13} style={{ marginLeft: 2 }}
                                color={transport.playing ? daw.green : flChrome.playIcon}
                                fill={transport.playing ? daw.green : flChrome.playIcon} />
                        </button>
                        <button onClick={() => stop()} data-academy-id="transport-stop" title="Stop"
                            style={{
                                width: 31, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: flChrome.pillBg, cursor: 'pointer',
                                border: 'none', padding: '0 3px 0 0',
                            }}>
                            <Square size={11} color={flChrome.playIcon} fill={flChrome.playIcon} />
                        </button>
                    </div>

                    {/* Record — a bezel with a lit dot in it */}
                    <button data-academy-id="transport-record" title="Record (not simulated)"
                        style={{
                            width: 25, height: 25, alignSelf: 'center', borderRadius: '50%',
                            flexShrink: 0, padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            background: flChrome.recBezel, border: `1px solid ${flChrome.recBezelEdge}`,
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08)',
                        }}>
                        <span style={{
                            width: 16, height: 16, borderRadius: '50%', background: flChrome.recDot,
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), 0 0 3px rgba(250,92,92,0.6)',
                        }} />
                    </button>

                    {/* Tempo */}
                    <div title="Tempo in beats per minute" style={{
                        display: 'flex', alignItems: 'center', height: 25, alignSelf: 'center',
                        flexShrink: 0, padding: '0 2px 0 6px', borderRadius: 3,
                        background: flChrome.tempoBg,
                        border: `1px solid ${highlightBpm ? daw.green : flChrome.tempoEdge}`,
                        boxShadow: highlightBpm
                            ? `0 0 0 2px ${daw.green}55`
                            : 'inset 0 1px 2px rgba(0,0,0,0.2)',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'baseline',
                            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                        }}>
                            <input type="number" value={transport.bpm} min={40} max={300}
                                onChange={e => setBpm(clampBpm(Number(e.target.value) || 140))}
                                data-daw-bpm=""
                                style={{
                                    width: 32, background: 'transparent', border: 'none', outline: 'none',
                                    color: flChrome.tempoText, fontSize: 17, fontWeight: 500,
                                    lineHeight: 1, textAlign: 'right', padding: 0,
                                    appearance: 'textfield', MozAppearance: 'textfield',
                                }} />
                            <span style={{
                                fontSize: 11, fontWeight: 500, lineHeight: 1, color: flChrome.tempoDim,
                            }}>
                                .000
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginLeft: 2 }}>
                            <button title="Increase tempo" onClick={() => nudgeBpm(1)} style={miniSpin}>
                                <Triangle up size={4} color={flChrome.tempoArrow} />
                            </button>
                            <button title="Decrease tempo" onClick={() => nudgeBpm(-1)} style={miniSpin}>
                                <Triangle size={4} color={flChrome.tempoArrow} />
                            </button>
                        </div>
                    </div>

                    {/* Time LCD */}
                    <div title="Song position" style={{
                        position: 'relative', width: 125, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: flChrome.timerFace, border: `1px solid ${flChrome.timerEdge}`,
                        borderRadius: 2, boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)',
                    }}>
                        <span style={{
                            position: 'absolute', top: 1, right: 4, fontSize: 7, fontWeight: 700,
                            color: flChrome.timerCyan, opacity: 0.85, letterSpacing: '-0.02em',
                        }}>
                            M:S:CS
                        </span>
                        <span style={{
                            fontFamily: dawFont.lcd, fontSize: 24, lineHeight: 1, marginTop: 2,
                            color: flChrome.timerCyan, letterSpacing: '-1px',
                            textShadow: '0 0 4px rgba(128,255,255,0.4)',
                        }}>
                            {transport.currentBar}:
                            {String(Math.floor(transport.currentStep / 4)).padStart(2, '0')}:
                            {String((transport.currentStep % 4) * 25).padStart(2, '0')}
                        </span>
                    </div>

                    {/* Pattern selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <button title="Previous pattern (not simulated)"
                            style={{ ...dawBtn(), width: 17, height: 25 }}>
                            <Triangle size={4} color={flChrome.text} />
                        </button>
                        <div title="Selected pattern" style={{
                            width: 103, height: 25, position: 'relative',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: flChrome.inputFace,
                            borderTop: `1px solid ${flChrome.inputEdge}`,
                            borderLeft: `1px solid ${flChrome.inputEdge}`,
                            borderRight: '1px solid #ffffff', borderBottom: '1px solid #ffffff',
                        }}>
                            <span style={{
                                color: flChrome.inputText, fontSize: 13, fontFamily: dawFont.condensed,
                            }}>
                                Pattern 1
                            </span>
                            <div style={{
                                position: 'absolute', right: 2, display: 'flex', flexDirection: 'column', gap: 2,
                            }}>
                                <Triangle up size={4} color={flChrome.inputArrow} />
                                <Triangle size={4} color={flChrome.inputArrow} />
                            </div>
                        </div>
                        <button title="Add pattern (not simulated — the Academy has one pattern)"
                            style={{
                                ...dawBtn(), width: 20, height: 25,
                                color: flChrome.text, fontSize: 16, fontWeight: 700,
                                fontFamily: dawFont.condensed, paddingBottom: 2,
                            }}>
                            +
                        </button>
                    </div>

                    {/* The empty space FL leaves on a wide window */}
                    <div style={{ flex: 1, minWidth: 14 }} />

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0,
                        paddingRight: 4, color: flChrome.hintMuted,
                    }}>
                        <Minus size={13} /><Square size={10} /><X size={13} />
                    </div>
                </div>

                {/* ══ Row 2: hint, master fader, window toggles, snap, store ══ */}
                <div style={{
                    display: 'flex', alignItems: 'stretch', gap: 5, height: 37, flexShrink: 0,
                    overflowX: 'auto', overflowY: 'hidden',
                }}>
                    {/* Hint panel — FL describes the hovered control here */}
                    <div style={{
                        width: leftW, flexShrink: 0, boxSizing: 'border-box',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 7, padding: '0 10px',
                        background: flChrome.hintBg,
                        border: `1px solid ${flChrome.hintBorder}`, borderTopColor: flChrome.hintEdge,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Cloud size={11} color={flChrome.hintIcon} fill={flChrome.hintIcon} />
                                <span style={{ fontSize: 11, color: flChrome.hintMuted, lineHeight: 1.1 }}>
                                    [FUJI STUDIO]
                                </span>
                            </div>
                            <div style={{
                                fontSize: 13, fontWeight: 700, color: flChrome.hintText, lineHeight: 1.1,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {hint || 'Hint panel'}
                            </div>
                        </div>
                        <Trash2 size={14} color={flChrome.hintIcon} style={{ flexShrink: 0 }} />
                    </div>

                    {/* Master fader */}
                    <div title="Master volume (not simulated)" style={{
                        width: 202, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 4px',
                    }}>
                        <div style={{
                            position: 'relative', flex: 1, height: 7, borderRadius: 3,
                            background: '#5b6268', border: '1px solid #3c444a',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.1)',
                        }}>
                            {/* Thumb, scaled down from the mockup's 48px to fit the row */}
                            <div style={{
                                position: 'absolute', left: 0, top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 23, height: 23, borderRadius: '50%',
                                background: 'linear-gradient(180deg, #535c65 0%, #32383e 100%)',
                                border: '1px solid #4a5259',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.1), 0 0 0 1px #2a2f34',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {/* The mockup's orange position tick */}
                                <span style={{
                                    width: 2, height: 11, borderRadius: 1,
                                    background: 'linear-gradient(180deg, #ffaa00 0%, #ff7700 100%)',
                                    boxShadow: '0 0 4px rgba(255,136,0,0.8)',
                                }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        {TOGGLES.map(t => {
                            const Icon = t.icon;
                            const isBrowser = t.id === 'browser';
                            const on = isBrowser ? browserOpen : !!wins.find(w => w.id === t.id)?.open;
                            // A lesson that limits its windows shouldn't offer toggles for the rest
                            const allowed = isBrowser
                                || !visibleWindows?.length
                                || visibleWindows.includes(t.id as WinId);
                            if (!allowed) return null;
                            return (
                                <button key={t.id}
                                    onClick={() => isBrowser ? setBrowserOpen(v => !v) : toggleWin(t.id as WinId)}
                                    data-academy-id={`daw-toggle-${t.id}`}
                                    title={t.label}
                                    style={{ ...dawBtn(on), width: 32, height: 28 }}>
                                    <Icon size={14} color={flChrome.btnIcon}
                                        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))' }} />
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <Magnet size={13} color="#ffffff" style={{ opacity: 0.4 }} />
                        <div title="Snap (not simulated)" style={{
                            width: 79, height: 23, padding: '0 6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: flChrome.dark, border: `1px solid ${flChrome.border}`,
                            borderRadius: 2, boxShadow: flChrome.innerPanel,
                        }}>
                            <span style={{ color: flChrome.snapText, fontSize: 12, fontFamily: dawFont.condensed }}>
                                (none)
                            </span>
                            <Triangle size={4} color={flChrome.snapText} />
                        </div>
                    </div>

                    <button title="Plugin store (not simulated)"
                        style={{ ...dawBtn(), width: 30, height: 28, alignSelf: 'center', background: flChrome.cartFace }}>
                        <ShoppingCart size={14} color={flChrome.btnIcon}
                            style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))' }} />
                    </button>

                    <div style={{ flex: 1, minWidth: 14 }} />
                </div>
            </div>

            {/* ── Body: browser + canvas ── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {browserOpen && (
                    <div style={{
                        width: 192, flexShrink: 0, background: flChrome.browserBg,
                        borderRight: `1px solid ${flChrome.browserEdge}`,
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Nav strip */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '3px 8px', flexShrink: 0,
                            background: flChrome.browserHeader, color: flChrome.browserIcon,
                            borderBottom: `1px solid ${flChrome.browserEdge}`,
                        }}>
                            <ChevronDown size={11} />
                            <ArrowUp size={11} />
                            <RefreshCw size={10} />
                            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>Browser</span>
                        </div>
                        {/* Category strip */}
                        <div style={{
                            height: 32, display: 'flex', alignItems: 'center', gap: 3, padding: '0 4px', flexShrink: 0,
                            background: flChrome.browserHeader,
                            borderTop: `1px solid ${flChrome.browserLight}`,
                            borderBottom: `1px solid ${flChrome.browserEdge}`,
                        }}>
                            {BROWSER_TABS.map((t, i) => {
                                const Icon = t.icon;
                                const active = i === 0;
                                return (
                                    <span key={t.label} title={t.label} style={{
                                        width: active ? 28 : 24, height: 24, borderRadius: 3,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: active ? '1px solid #f97316' : '1px solid transparent',
                                        background: active ? 'rgba(0,0,0,0.2)' : 'transparent',
                                    }}>
                                        <Icon size={13} color={active ? '#f97316' : flChrome.browserIcon} />
                                    </span>
                                );
                            })}
                        </div>
                        {/* Tree */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                            {BROWSER_ITEMS.map(item => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label}
                                        title={`${item.label} — the browser is illustrative; the Academy has no file system`}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '3px 8px 3px 22px', fontSize: 13.6, cursor: 'default',
                                            whiteSpace: 'nowrap', color: item.color, letterSpacing: '0.02em',
                                        }}>
                                        <Icon size={13} color={item.color} style={{ flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Canvas — windows live here; also the coachmark bubble's anchor */}
                <div ref={canvasRef} style={{
                    flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
                    background: daw.bg,
                    backgroundImage: `radial-gradient(${daw.border} 1px, transparent 1px)`,
                    backgroundSize: '22px 22px',
                }}>
                    {/* Fuji watermark. Its own element rather than a second background layer on
                        the canvas, so its opacity is independent of the dot grid. Sits below
                        every window (they start at z:1) and ignores the pointer, so it can
                        never intercept a drag. */}
                    <img src="/daw-watermark.png" alt="" aria-hidden="true" draggable={false}
                        style={{
                            position: 'absolute', left: '50%', top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 'min(34%, 300px)', height: 'auto',
                            opacity: 0.16, zIndex: 0, pointerEvents: 'none', userSelect: 'none',
                        }} />
                    {renderWindow('rack', false,
                        <ChannelRack highlightChannelId={highlightChannelId} highlightStepIndex={highlightStepIndex} />)}
                    {renderWindow('playlist', false,
                        <Playlist highlightBars={highlightBars} highlightTrack={highlightTrack ?? null} />)}
                    {renderWindow('mixer', false,
                        <Mixer highlightInserts={highlightInserts} onOpenEQ={openEQ} />)}
                    {renderWindow('piano', true,
                        <PianoRoll notes={pianoNotes} onChange={setPianoNotes} />)}
                    {renderWindow('eq', false,
                        <ParametricEQ insertId={eqInsertId} highlightBand={highlightEQBand ?? null}
                            onClose={() => patch('eq', { open: false })} />)}
                </div>
            </div>

            {/* ── Status bar ── */}
            <div style={{
                height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: flChrome.shell, borderTop: '1px solid #000',
            }}>
                <span style={{ fontSize: 10, color: '#5d6a74', letterSpacing: '0.02em' }}>
                    Fuji Studio Academy — Producer Edition (simulated)
                </span>
            </div>
        </div>
    );
};

const clampBpm = (n: number) => Math.max(40, Math.min(300, Math.round(n)));

/**
 * The mockups' raised button. Rendered with four separate border colours rather
 * than one, which is what gives the bevel its direction -- lit on the top/left,
 * shadowed on the bottom/right, and inverted when the button reads as pressed.
 */
const dawBtn = (down = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 2, cursor: 'pointer', padding: 0, flexShrink: 0,
    background: down ? flChrome.btnDown : flChrome.btnFace,
    borderTop: `1px solid ${down ? flChrome.btnEdgeBot : flChrome.btnEdgeTop}`,
    borderLeft: `1px solid ${down ? flChrome.btnEdgeBot : flChrome.btnEdgeLt}`,
    borderRight: `1px solid ${down ? flChrome.btnDownEdge : flChrome.btnEdgeRt}`,
    borderBottom: `1px solid ${down ? flChrome.btnDownEdge : flChrome.btnEdgeBot}`,
    boxShadow: down ? flChrome.btnDownFx : flChrome.btnUp,
});

const miniSpin: React.CSSProperties = {
    width: 11, height: 10, padding: 0, cursor: 'pointer',
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/** Small solid triangles. CSS borders rather than icons -- at this size an icon
 *  glyph turns to mush, while a border triangle stays crisp. */
const Triangle: React.FC<{ up?: boolean; color: string; size?: number }> = ({ up, color, size = 4 }) => (
    <span style={{
        width: 0, height: 0,
        borderLeft: `${size}px solid transparent`,
        borderRight: `${size}px solid transparent`,
        ...(up
            ? { borderBottom: `${size + 1}px solid ${color}` }
            : { borderTop: `${size + 1}px solid ${color}` }),
    }} />
);
