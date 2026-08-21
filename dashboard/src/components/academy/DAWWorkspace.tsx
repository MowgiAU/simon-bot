/**
 * DAWWorkspace — the full FL Studio shell.
 *
 * Chrome follows FL's real toolbar: one band of three columns, each split into two
 * rows — menus over the hint panel, transport over the master fader, and the time
 * LCD plus pattern selector over the window toggles. Below that, the browser down
 * the left and the free-moving windows on the canvas.
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
    FileMusic, Package, Mic, Music, Minus, Plus, X,
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
import { daw, dawFx, dawFont, flPlaylist as fl, flChrome } from './dawTheme';

type WinId = 'rack' | 'playlist' | 'mixer' | 'piano' | 'eq';

interface WinDef { id: WinId; title: string; rect: WindowRect; open: boolean; z: number; }

interface Note { pitch: number; start: number; length: number; }

const MENUS = ['FILE', 'EDIT', 'ADD', 'PATTERNS', 'VIEW', 'OPTIONS', 'TOOLS'];

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

/** FL's browser tree. Decorative — the simulator has no file system behind it. */
const BROWSER_ITEMS: { label: string; icon: React.ElementType }[] = [
    { label: 'Current project', icon: FileMusic },
    { label: 'Recent files', icon: Folder },
    { label: 'Plugin database', icon: Package },
    { label: 'Plugin presets', icon: Package },
    { label: 'Channel presets', icon: Folder },
    { label: 'Mixer presets', icon: Folder },
    { label: 'Scores', icon: Music },
    { label: 'Audio', icon: Folder },
    { label: 'Backup', icon: Folder },
    { label: 'Clipboard files', icon: Folder },
    { label: 'Demo projects', icon: Folder },
    { label: 'Envelopes', icon: Folder },
    { label: 'FL Cloud', icon: Cloud },
    { label: 'Impulses', icon: Folder },
    { label: 'MIDI', icon: Folder },
    { label: 'My projects', icon: Star },
    { label: 'Packs', icon: Package },
    { label: 'Recorded', icon: Mic },
    { label: 'Rendered', icon: Folder },
    { label: 'Sample Library', icon: Globe },
    { label: 'Samples', icon: Folder },
    { label: 'Soundfonts', icon: Folder },
    { label: 'Speech', icon: Folder },
    { label: 'Templates', icon: Folder },
    { label: 'Wav', icon: Folder },
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

    const [wins, setWins] = useState<WinDef[]>(() => {
        const only = visibleWindows && visibleWindows.length ? new Set<WinId>(visibleWindows) : null;
        const open = (id: WinId, fallback: boolean) => only ? only.has(id) : fallback;
        return [
            // Widths come from each panel's real content width (the Channel Rack's two
            // modules add up to ~700px), so a window never opens already clipped.
            { id: 'rack', title: 'Channel rack', rect: { x: 14, y: 12, w: 716, h: 300 }, open: open('rack', true), z: 3 },
            { id: 'playlist', title: 'Playlist', rect: { x: 14, y: 328, w: 880, h: 340 }, open: open('playlist', true), z: 2 },
            { id: 'mixer', title: 'Mixer', rect: { x: 746, y: 12, w: 600, h: 430 }, open: open('mixer', true), z: 1 },
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
                background: daw.bg, fontFamily: dawFont.sans, color: fl.text,
                border: '1px solid #000', borderRadius: 3, overflow: 'hidden',
            }}>

            {/* ── Toolbar band: three columns, each split into two rows ── */}
            <div style={{
                display: 'flex', alignItems: 'stretch', gap: 2, flexShrink: 0,
                height: 98, padding: 2, background: flChrome.shell,
                borderBottom: '1px solid #000', overflowX: 'auto', position: 'relative', zIndex: 40,
            }}>

                {/* ══ Column 1: menus over the hint panel ══ */}
                <div style={{
                    width: 428, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                    <div
                        // Narration steps with no named control anchor their bubble here.
                        data-academy-id="daw-titlebar"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 11, height: 38, flexShrink: 0,
                            background: flChrome.menuBg, padding: '0 10px',
                            borderTop: `1px solid ${flChrome.menuEdge}`,
                            borderBottom: `2px solid ${flChrome.menuUnder}`,
                            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)',
                        }}>
                        {MENUS.map(m => (
                            <div key={m} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setOpenMenu(openMenu === m ? null : m)}
                                    title={m === 'VIEW' ? 'Show or hide windows' : `${m} menu`}
                                    style={{
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        padding: 0, lineHeight: 1,
                                        fontFamily: dawFont.menu, fontSize: 18, fontWeight: 400,
                                        letterSpacing: '0.5px',
                                        color: openMenu === m ? flChrome.menuHover : flChrome.menuText,
                                        textShadow: '1px 1px 0px rgba(0,0,0,0.5)',
                                    }}>
                                    {m}
                                </button>
                                {openMenu === m && (
                                    <div onMouseLeave={() => setOpenMenu(null)} style={{
                                        position: 'absolute', top: '100%', left: 0, zIndex: 500,
                                        minWidth: 170, background: flChrome.panel,
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
                                                    display: 'flex', alignItems: 'center', gap: 7,
                                                    padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                                                    borderRadius: 2, color: flChrome.text,
                                                    fontFamily: dawFont.condensed,
                                                }}>
                                                <span style={{ width: 11, textAlign: 'center', color: daw.green, fontWeight: 700 }}>
                                                    {w.open ? '✓' : ''}
                                                </span>
                                                {w.title}
                                            </div>
                                        )) : (
                                            <div style={{
                                                padding: '6px 9px', fontSize: 12, color: flChrome.hintMuted,
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

                    {/* Hint panel — FL describes the hovered control here */}
                    <div style={{
                        flex: 1, minHeight: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 8, padding: '0 10px',
                        background: flChrome.hintBg,
                        border: `1px solid ${flChrome.hintBorder}`, borderTopColor: flChrome.hintEdge,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <Cloud size={14} color={flChrome.hintIcon} fill={flChrome.hintIcon} />
                                <span style={{ fontSize: 13, color: flChrome.hintMuted, lineHeight: 1 }}>
                                    [FUJI STUDIO]
                                </span>
                            </div>
                            <div style={{
                                fontSize: 14, fontWeight: 500, color: flChrome.hintText, lineHeight: 1.1,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {hint || 'Hint panel'}
                            </div>
                        </div>
                        <Trash2 size={19} color={flChrome.hintIcon} style={{ flexShrink: 0 }} />
                    </div>
                </div>

                {/* ══ Column 2: transport over the master fader ══ */}
                <div style={{
                    width: 372, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '4px 8px', background: flChrome.panel,
                    border: `1px solid ${flChrome.border}`, boxShadow: flChrome.innerPanel,
                }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Transport pill: PAT/SONG + play + stop share one rounded body */}
                        <div style={{
                            display: 'flex', alignItems: 'stretch', height: 42, flexShrink: 0,
                            background: flChrome.pillBg, borderRadius: 9999,
                            border: `1px solid ${flChrome.pillBorder}`,
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                        }}>
                            {/* Mode — two half-height buttons, so each is directly selectable */}
                            <div style={{
                                display: 'flex', flexDirection: 'column', width: 58,
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
                                                    ? 'inset 0 1px 1px rgba(255,255,255,0.7), inset 0 2px 4px rgba(255,255,255,0.3)'
                                                    : 'inset 0 2px 3px rgba(0,0,0,0.4)',
                                            }}>
                                            <span style={{
                                                fontFamily: dawFont.condensed, fontWeight: 700,
                                                fontSize: m === 'pat' ? 11 : 10, letterSpacing: '0.03em',
                                                color: on ? flChrome.patOnText : flChrome.songText,
                                                textShadow: on ? '0 0 2px rgba(255,255,255,0.5)' : 'none',
                                            }}>
                                                {m.toUpperCase()}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <button onClick={handlePlay} data-academy-id="transport-play" title="Play / pause"
                                style={{
                                    width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: flChrome.pillBg, cursor: 'pointer', padding: 0,
                                    border: 'none', borderRight: `1px solid ${flChrome.pillDivide}`,
                                }}>
                                <Play size={18} style={{ marginLeft: 4 }}
                                    color={transport.playing ? daw.green : flChrome.playIcon}
                                    fill={transport.playing ? daw.green : flChrome.playIcon} />
                            </button>
                            <button onClick={() => stop()} data-academy-id="transport-stop" title="Stop"
                                style={{
                                    width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: flChrome.pillBg, cursor: 'pointer',
                                    border: 'none', padding: '0 4px 0 0',
                                }}>
                                <Square size={14} color={flChrome.playIcon} fill={flChrome.playIcon} />
                            </button>
                        </div>

                        {/* Record — a bezel with a lit dot in it */}
                        <button data-academy-id="transport-record" title="Record (not simulated)"
                            style={{
                                width: 34, height: 34, borderRadius: '50%', flexShrink: 0, padding: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                background: flChrome.recBezel, border: `1px solid ${flChrome.recBezelEdge}`,
                                boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08)',
                            }}>
                            <span style={{
                                width: 20, height: 20, borderRadius: '50%', background: flChrome.recDot,
                                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.2), 0 0 3px rgba(250,92,92,0.6)',
                            }} />
                        </button>

                        {/* Tempo */}
                        <div title="Tempo in beats per minute" style={{
                            display: 'flex', alignItems: 'center', height: 38, flexShrink: 0,
                            padding: '0 4px 0 10px', borderRadius: 6, background: flChrome.tempoBg,
                            border: `1px solid ${highlightBpm ? daw.green : flChrome.tempoEdge}`,
                            boxShadow: highlightBpm
                                ? `0 0 0 2px ${daw.green}55`
                                : 'inset 0 2px 4px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.15)',
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'baseline',
                                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                            }}>
                                <input type="number" value={transport.bpm} min={40} max={300}
                                    onChange={e => setBpm(clampBpm(Number(e.target.value) || 140))}
                                    data-daw-bpm=""
                                    style={{
                                        width: 44, background: 'transparent', border: 'none', outline: 'none',
                                        color: flChrome.tempoText, fontSize: 23, fontWeight: 500,
                                        lineHeight: 1, textAlign: 'right',
                                        appearance: 'textfield', MozAppearance: 'textfield',
                                    }} />
                                <span style={{
                                    fontSize: 14, fontWeight: 500, lineHeight: 1, color: flChrome.tempoDim,
                                }}>
                                    .000
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 4 }}>
                                <button title="Increase tempo" onClick={() => nudgeBpm(1)} style={spinBtn}>
                                    <Triangle up color={flChrome.tempoArrow} />
                                </button>
                                <button title="Decrease tempo" onClick={() => nudgeBpm(-1)} style={spinBtn}>
                                    <Triangle color={flChrome.tempoArrow} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Master fader */}
                    <div title="Master volume (not simulated)" style={{
                        height: 18, display: 'flex', alignItems: 'center', flexShrink: 0,
                    }}>
                        <div style={{
                            position: 'relative', flex: 1, height: 5, borderRadius: 3,
                            background: flChrome.dark, boxShadow: flChrome.innerPanel,
                        }}>
                            <div style={{
                                position: 'absolute', left: '2%', top: -6, width: 17, height: 17,
                                borderRadius: '50%', background: 'linear-gradient(to bottom, #cdd3d7, #8e979c)',
                                border: `1px solid ${flChrome.btnEdgeBot}`,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6)',
                            }} />
                        </div>
                    </div>
                </div>

                {/* ══ Column 3: time + pattern over the window toggles ══ */}
                <div style={{
                    flex: 1, minWidth: 470, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                    {/* Time LCD + pattern selector */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 4 }}>
                        <div title="Song position" style={{
                            position: 'relative', width: 226, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: flChrome.timerFace, border: `1px solid ${flChrome.timerEdge}`,
                            borderRadius: 2, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
                        }}>
                            <span style={{
                                position: 'absolute', top: 3, right: 5, fontSize: 8, fontWeight: 700,
                                color: flChrome.timerCyan, opacity: 0.85, letterSpacing: '-0.02em',
                            }}>
                                M:S:CS
                            </span>
                            <span style={{
                                fontFamily: dawFont.lcd, fontSize: 34, lineHeight: 1, marginTop: 4,
                                color: flChrome.timerCyan, letterSpacing: '-2px',
                                textShadow: '0 0 5px rgba(128,255,255,0.4)',
                            }}>
                                {transport.currentBar}:
                                {String(Math.floor(transport.currentStep / 4)).padStart(2, '0')}:
                                {String((transport.currentStep % 4) * 25).padStart(2, '0')}
                            </span>
                        </div>

                        <div style={{
                            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px',
                            background: flChrome.panel, border: `1px solid ${flChrome.border}`,
                            boxShadow: flChrome.innerPanel,
                        }}>
                            <button title="Previous pattern (not simulated)"
                                style={{ ...dawBtn(), width: 20, height: 34 }}>
                                <Triangle color={flChrome.text} />
                            </button>
                            <div title="Selected pattern" style={{
                                flex: 1, minWidth: 0, height: 34, position: 'relative',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: flChrome.inputFace,
                                borderTop: `1px solid ${flChrome.inputEdge}`,
                                borderLeft: `1px solid ${flChrome.inputEdge}`,
                                borderRight: '1px solid #ffffff', borderBottom: '1px solid #ffffff',
                            }}>
                                <span style={{
                                    color: flChrome.inputText, fontSize: 17, fontFamily: dawFont.condensed,
                                }}>
                                    Pattern 1
                                </span>
                                <div style={{
                                    position: 'absolute', right: 4, display: 'flex', flexDirection: 'column', gap: 3,
                                }}>
                                    <Triangle up color={flChrome.inputArrow} />
                                    <Triangle color={flChrome.inputArrow} />
                                </div>
                            </div>
                            <button title="Add pattern (not simulated — the Academy has one pattern)"
                                style={{
                                    ...dawBtn(), width: 26, height: 34,
                                    color: flChrome.text, fontSize: 19, fontWeight: 700,
                                    fontFamily: dawFont.condensed, paddingBottom: 3,
                                }}>
                                +
                            </button>
                        </div>
                    </div>

                    {/* Window toggles, snap, store */}
                    <div style={{
                        height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
                        padding: '0 4px', background: flChrome.panel,
                        border: `1px solid ${flChrome.border}`, boxShadow: flChrome.innerPanel,
                    }}>
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
                                    style={{ ...dawBtn(on), width: 42, height: 32 }}>
                                    <Icon size={16} color={flChrome.btnIcon}
                                        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))' }} />
                                </button>
                            );
                        })}

                        <div style={{
                            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'flex-end', gap: 8,
                        }}>
                            <Magnet size={14} color="#ffffff" style={{ opacity: 0.4, flexShrink: 0 }} />
                            <div title="Snap (not simulated)" style={{
                                width: 92, height: 26, padding: '0 8px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: flChrome.dark, border: `1px solid ${flChrome.border}`,
                                borderRadius: 2, boxShadow: flChrome.innerPanel,
                            }}>
                                <span style={{ color: flChrome.snapText, fontSize: 14, fontFamily: dawFont.condensed }}>
                                    (none)
                                </span>
                                <Triangle color={flChrome.snapText} />
                            </div>
                        </div>

                        <button title="Plugin store (not simulated)"
                            style={{ ...dawBtn(), width: 38, height: 32, background: flChrome.cartFace }}>
                            <ShoppingCart size={17} color={flChrome.btnIcon}
                                style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))' }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Body: browser + canvas ── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {browserOpen && (
                    <div style={{
                        width: 186, flexShrink: 0, background: fl.browserBg,
                        borderRight: '1px solid #000', display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Nav strip */}
                        <div style={{
                            height: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '0 7px',
                            background: fl.rulerBg, borderBottom: `1px solid ${daw.border}`, flexShrink: 0,
                        }}>
                            <ChevronDown size={10} color={fl.textDim} />
                            <ArrowUp size={10} color={fl.textDim} />
                            <RefreshCw size={9} color={fl.textDim} />
                            <span style={{ fontSize: 10.5, color: fl.text }}>Browser</span>
                        </div>
                        {/* Category strip */}
                        <div style={{
                            height: 26, display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px',
                            borderBottom: `1px solid ${daw.border}`, flexShrink: 0,
                        }}>
                            {BROWSER_TABS.map((t, i) => {
                                const Icon = t.icon;
                                return (
                                    <span key={t.label} title={t.label} style={{
                                        display: 'flex', padding: 2, borderRadius: 2,
                                        background: i === 0 ? '#d9741f' : 'transparent',
                                    }}>
                                        <Icon size={12} color={i === 0 ? '#1a1008' : '#8b969f'} />
                                    </span>
                                );
                            })}
                        </div>
                        {/* Tree */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '3px 0' }}>
                            {BROWSER_ITEMS.map(item => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label}
                                        title={`${item.label} — the browser is illustrative; the Academy has no file system`}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 7,
                                            padding: '3px 9px', fontSize: 11, color: fl.text, cursor: 'default',
                                            whiteSpace: 'nowrap',
                                        }}>
                                        <Icon size={11} color={daw.green} style={{ flexShrink: 0, opacity: 0.85 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Tag strip */}
                        <div style={{
                            height: 20, flexShrink: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', padding: '0 7px',
                            background: fl.rulerBg, borderTop: `1px solid ${daw.border}`,
                        }}>
                            <span style={{ fontSize: 9, letterSpacing: '0.06em', color: fl.textDim }}>TAGS</span>
                            <Star size={10} color={fl.textDim} />
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
                background: fl.windowBar, borderTop: '1px solid #000',
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

const spinBtn: React.CSSProperties = {
    width: 13, height: 11, padding: 0, cursor: 'pointer',
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/** Small solid triangles. CSS borders rather than icons -- at 5px an icon glyph
 *  turns to mush, while a border triangle stays crisp. */
const Triangle: React.FC<{ up?: boolean; color: string }> = ({ up, color }) => (
    <span style={{
        width: 0, height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        ...(up ? { borderBottom: `5px solid ${color}` } : { borderTop: `5px solid ${color}` }),
    }} />
);
