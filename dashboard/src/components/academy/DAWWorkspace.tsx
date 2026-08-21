/**
 * DAWWorkspace — the full FL Studio shell.
 *
 * Chrome follows FL's actual layout rather than a generic toolbar: menus and the
 * transport share one top row, the hint panel sits on the left of a second row
 * beside the master controls and window toggles, the browser has its own nav and
 * category strips, and a status bar closes the frame.
 *
 * The canvas is the anchor for the lesson coachmark bubble, so it must stay
 * un-scrolled and position:relative — windows move within it, and the bubble
 * measures against it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Play, Square, Circle, ChevronDown, Folder, Star, Cloud, Globe,
    FileMusic, Package, Mic, Music, Minus, Plus, X,
    Grid3x3, ListMusic, SlidersVertical, Piano, PanelLeft,
    Files, Volume2, RefreshCw, ArrowUp, ShoppingCart, Trash2,
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

const MENUS = ['FILE', 'EDIT', 'ADD', 'PATTERNS', 'VIEW', 'OPTIONS', 'TOOLS', 'HELP'];

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

            {/* ── Top row: menus + transport + window controls, as one strip in FL ── */}
            <div
                // Narration steps with no named control anchor their bubble here.
                data-academy-id="daw-titlebar"
                style={{
                    display: 'flex', alignItems: 'center', gap: 9, height: 38, flexShrink: 0,
                    background: flChrome.bar, borderBottom: '1px solid #000', padding: '0 6px',
                    position: 'relative', zIndex: 40,
                }}>
                {/* Menus — one raised slate panel holding the whole set, as in FL */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 0, height: 26, padding: '0 3px',
                    background: flChrome.menuBg, borderRadius: 2,
                    border: `1px solid ${daw.border}`, borderTopColor: flChrome.menuEdge,
                }}>
                    {MENUS.map(m => (
                        <div key={m} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setOpenMenu(openMenu === m ? null : m)}
                                title={m === 'VIEW' ? 'Show or hide windows' : `${m} menu`}
                                style={{
                                    background: openMenu === m ? flChrome.menuHover : 'transparent',
                                    border: 'none', cursor: 'pointer', color: flChrome.menuText,
                                    fontFamily: dawFont.condensed,
                                    fontSize: 15, fontWeight: 400, letterSpacing: '0.01em',
                                    lineHeight: 1, padding: '4px 6px', borderRadius: 2,
                                }}>
                                {m}
                            </button>
                            {openMenu === m && (
                                <div onMouseLeave={() => setOpenMenu(null)} style={{
                                    position: 'absolute', top: '100%', left: 0, zIndex: 500,
                                    minWidth: 170, background: daw.panel,
                                    border: `1px solid ${daw.border}`, borderRadius: 3,
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
                                                padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                                                borderRadius: 2, color: fl.text,
                                            }}>
                                            <span style={{ width: 11, textAlign: 'center', color: daw.green, fontWeight: 700 }}>
                                                {w.open ? '✓' : ''}
                                            </span>
                                            {w.title}
                                        </div>
                                    )) : (
                                        <div style={{ padding: '6px 9px', fontSize: 11, color: fl.textDim, fontStyle: 'italic' }}>
                                            Not simulated
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* PAT / SONG */}
                <button
                    onClick={() => setMode(transport.mode === 'pat' ? 'song' : 'pat')}
                    data-academy-id="transport-mode"
                    title={transport.mode === 'pat'
                        ? 'Pattern mode — looping the Channel Rack bar. Click for Song mode.'
                        : 'Song mode — playing the playlist arrangement. Click for Pattern mode.'}
                    style={{
                        width: 34, height: 26, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                        background: '#d9741f', border: '1px solid #94500f', padding: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, fontWeight: 800,
                    }}>
                    <span style={{ fontSize: 8.5, color: transport.mode === 'pat' ? '#fff' : '#8a4d13' }}>PAT</span>
                    <span style={{ fontSize: 7, color: transport.mode === 'song' ? '#fff' : '#8a4d13' }}>SONG</span>
                </button>

                {/* Transport */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button onClick={handlePlay} data-academy-id="transport-play" title="Play / pause" style={flBtn()}>
                        <Play size={13} color={transport.playing ? '#7fd04a' : '#95a1ab'}
                            fill={transport.playing ? '#7fd04a' : '#95a1ab'} />
                    </button>
                    <button onClick={() => stop()} data-academy-id="transport-stop" title="Stop" style={flBtn()}>
                        <Square size={10} color="#95a1ab" fill="#95a1ab" />
                    </button>
                    <button data-academy-id="transport-record" title="Record (not simulated)" style={flBtn()}>
                        <Circle size={12} color="#c8483c" fill="#c8483c" />
                    </button>
                </div>

                {/* Tempo */}
                <div title="Tempo in beats per minute" style={lcd(86)}>
                    <input type="number" value={transport.bpm} min={40} max={300}
                        onChange={e => setBpm(Number(e.target.value) || 140)}
                        data-daw-bpm=""
                        style={{
                            width: 50, background: 'transparent', border: 'none', outline: 'none',
                            color: highlightBpm ? daw.green : '#e0a63c',
                            fontSize: 17, fontFamily: dawFont.mono, fontWeight: 700, textAlign: 'right',
                            appearance: 'textfield', MozAppearance: 'textfield',
                        }} />
                    <span style={{ fontSize: 11, color: '#a67a2c', fontFamily: dawFont.mono }}>.000</span>
                </div>

                {/* Song position */}
                <div title="Song position" style={{ ...lcd(98), position: 'relative' }}>
                    <span style={{
                        fontSize: 17, fontFamily: dawFont.mono, fontWeight: 700,
                        color: '#d7dee5', letterSpacing: '0.02em',
                    }}>
                        {transport.currentBar}:
                        {String(Math.floor(transport.currentStep / 4)).padStart(2, '0')}:
                        {String((transport.currentStep % 4) * 25).padStart(2, '0')}
                    </span>
                    <span style={{
                        position: 'absolute', top: 1, right: 4,
                        fontSize: 6.5, color: '#6f7c86', fontFamily: dawFont.mono, letterSpacing: '0.06em',
                    }}>M:S:CS</span>
                </div>

                <ChevronDown size={12} color={fl.textDim} />

                {/* Pattern selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div title="Selected pattern" style={{
                        display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 8px',
                        background: '#212a30', border: `1px solid ${daw.border}`, borderRadius: 2, minWidth: 96,
                    }}>
                        <span style={{ fontSize: 11.5, color: '#dfe6ec', flex: 1 }}>Pattern 1</span>
                        <ChevronDown size={11} color={fl.textDim} />
                    </div>
                    <button title="Add pattern (not simulated — the Academy has one pattern)" style={flBtn(20)}>
                        <Plus size={12} color={fl.textDim} />
                    </button>
                </div>

                {/* Window controls */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, color: fl.textDim }}>
                    <Minus size={12} /><Square size={9} /><X size={12} />
                </div>
            </div>

            {/* ── Second row: hint panel, master controls, window toggles ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 40, flexShrink: 0,
                background: flChrome.bar, borderBottom: '1px solid #000', padding: '0 8px',
            }}>
                {/* Hint panel — FL describes the hovered control here. Two lines: the project
                    code above, the hovered control's description below. */}
                <div style={{
                    width: 268, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center',
                    background: flChrome.hintBg, borderRadius: 2,
                    border: `1px solid ${daw.border}`, borderTopColor: flChrome.hintEdge,
                    boxShadow: dawFx.innerShadowWell, padding: '0 7px', gap: 7,
                }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Cloud size={11} color={flChrome.hintLabel} fill={flChrome.hintLabel} />
                            <span style={{
                                fontSize: 10, color: flChrome.hintLabel,
                                fontFamily: dawFont.condensed, letterSpacing: '0.02em',
                            }}>
                                [FUJI STUDIO]
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                            <span style={{
                                fontSize: 8, color: flChrome.hintLabel, flexShrink: 0,
                                fontFamily: dawFont.condensed, letterSpacing: '0.06em',
                            }}>
                                FREE
                            </span>
                            <span style={{
                                fontSize: 12, fontWeight: 700,
                                color: hint ? flChrome.hintText : flChrome.hintLabel,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {hint || 'Hint panel'}
                            </span>
                        </div>
                    </div>
                    <Trash2 size={14} color={flChrome.hintLabel} style={{ flexShrink: 0 }} />
                </div>

                {/* Master pitch + volume */}
                <div title="Master pitch (not simulated)" style={{
                    width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                    background: dawFx.knob, boxShadow: dawFx.knobShadow, border: `1px solid ${daw.well}`,
                }} />
                <div title="Master volume (not simulated)" style={{
                    width: 148, height: 5, flexShrink: 0, borderRadius: 3,
                    background: daw.well, boxShadow: dawFx.innerShadowWell, position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute', left: '72%', top: -5, width: 8, height: 15, borderRadius: 2,
                        background: dawFx.faderHandle, border: '1px solid #555',
                    }} />
                </div>

                {/* Window toggles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
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
                                style={{
                                    width: 27, height: 26, borderRadius: 2, cursor: 'pointer', padding: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: on ? '#3d4a53' : '#232b31',
                                    border: `1px solid ${on ? '#55656f' : daw.border}`,
                                }}>
                                <Icon size={13} color={on ? daw.green : '#8b969f'} />
                            </button>
                        );
                    })}
                </div>

                {/* Plugin picker + store */}
                <div title="Plugin picker (not simulated)" style={{
                    display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 8px',
                    background: '#212a30', border: `1px solid ${daw.border}`, borderRadius: 2, minWidth: 92,
                }}>
                    <span style={{ fontSize: 11, color: '#8b969f', flex: 1 }}>(none)</span>
                    <ChevronDown size={11} color={fl.textDim} />
                </div>
                <button title="Plugin store (not simulated)" style={flBtn(26)}>
                    <ShoppingCart size={13} color="#d9741f" />
                </button>
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

/** FL's small raised toolbar button */
const flBtn = (w = 26): React.CSSProperties => ({
    width: w, height: 26, borderRadius: 2, cursor: 'pointer', padding: 0,
    background: '#2a333a', border: `1px solid ${daw.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
});

/** Recessed LCD readout (tempo, song position) */
const lcd = (w: number): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1,
    width: w, height: 28, padding: '0 7px',
    background: '#12171b', border: `1px solid ${daw.border}`, borderRadius: 2,
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
});
