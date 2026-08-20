/**
 * DAWWorkspace — the full FL Studio shell.
 *
 * Replaces the old tabbed simulator: a menu bar, transport toolbar and hint panel
 * across the top, the browser down the left, and the Channel Rack / Playlist /
 * Mixer / Piano Roll as free-moving windows on the canvas, as in FL.
 *
 * The canvas is the anchor for the lesson coachmark bubble, so it must stay
 * un-scrolled and position:relative — windows move within it, and the bubble
 * measures against it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Play, Square, Circle, ChevronDown, Folder, Star, Cloud, Globe,
    FileMusic, Package, Mic, Music,
} from 'lucide-react';
import { useDAWStore } from './DAWStore';
import { ChannelRack } from './ChannelRack';
import { Playlist } from './Playlist';
import { Mixer } from './Mixer';
import { PianoRoll } from './PianoRoll';
import { ParametricEQ } from './ParametricEQ';
import { DAWWindow, WindowRect } from './DAWWindow';
import { daw, dawFont, flPlaylist as fl } from './dawTheme';

type WinId = 'rack' | 'playlist' | 'mixer' | 'piano' | 'eq';

interface WinDef { id: WinId; title: string; rect: WindowRect; open: boolean; z: number; }

interface Note { pitch: number; start: number; length: number; }

const MENUS = ['FILE', 'EDIT', 'ADD', 'PATTERNS', 'VIEW', 'OPTIONS', 'TOOLS', 'HELP'];

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
    highlightChannelId?: string | null;
    highlightStepIndex?: number | null;
    highlightInserts?: number[];
    highlightBpm?: boolean;
    highlightEQBand?: number | null;
    highlightBars?: number[];
    highlightTrack?: number | null;
}

export const DAWWorkspace: React.FC<DAWWorkspaceProps> = ({
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

    const [wins, setWins] = useState<WinDef[]>([
        { id: 'rack', title: 'Channel rack', rect: { x: 12, y: 10, w: 620, h: 250 }, open: true, z: 3 },
        { id: 'playlist', title: 'Playlist', rect: { x: 12, y: 274, w: 760, h: 330 }, open: true, z: 2 },
        { id: 'mixer', title: 'Mixer', rect: { x: 648, y: 10, w: 560, h: 250 }, open: true, z: 1 },
        { id: 'piano', title: 'Piano roll', rect: { x: 300, y: 120, w: 620, h: 320 }, open: false, z: 4 },
        { id: 'eq', title: 'Parametric EQ 2', rect: { x: 200, y: 60, w: 640, h: 330 }, open: false, z: 5 },
    ]);

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
        if (transport.playing) stop(); else play();
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
                border: `1px solid ${daw.border}`, borderRadius: 4, overflow: 'hidden',
            }}>

            {/* ── Menu bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 2, height: 22,
                background: fl.windowBar, borderBottom: `1px solid ${daw.border}`,
                padding: '0 6px', position: 'relative', flexShrink: 0,
            }}>
                {MENUS.map(m => (
                    <div key={m} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setOpenMenu(openMenu === m ? null : m)}
                            title={m === 'VIEW' ? 'Show or hide windows' : `${m} menu`}
                            style={{
                                background: openMenu === m ? daw.highlight : 'transparent',
                                border: 'none', cursor: 'pointer',
                                color: fl.text, fontSize: 10, fontWeight: 600,
                                letterSpacing: '0.04em', padding: '3px 7px', borderRadius: 2,
                            }}>
                            {m}
                        </button>
                        {openMenu === m && (
                            <div
                                onMouseLeave={() => setOpenMenu(null)}
                                style={{
                                    position: 'absolute', top: '100%', left: 0, zIndex: 500,
                                    minWidth: 168, background: daw.panel,
                                    border: `1px solid ${daw.border}`, borderRadius: 3,
                                    boxShadow: '0 8px 22px rgba(0,0,0,0.6)', padding: 3,
                                }}>
                                {m === 'VIEW' ? wins.map(w => (
                                    <div key={w.id}
                                        onClick={() => { toggleWin(w.id); setOpenMenu(null); }}
                                        data-academy-id={`daw-view-${w.id}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 7,
                                            padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                                            borderRadius: 2, color: fl.text,
                                        }}>
                                        <span style={{
                                            width: 11, textAlign: 'center', color: daw.green, fontWeight: 700,
                                        }}>{w.open ? '✓' : ''}</span>
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

            {/* ── Transport toolbar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 40,
                background: fl.toolbar, borderBottom: `1px solid ${daw.border}`,
                padding: '0 8px', flexShrink: 0,
            }}>
                {/* PAT / SONG */}
                <button
                    onClick={() => setMode(transport.mode === 'pat' ? 'song' : 'pat')}
                    data-academy-id="transport-mode"
                    title={transport.mode === 'pat'
                        ? 'PAT — looping the Channel Rack pattern. Click for SONG.'
                        : 'SONG — playing the playlist arrangement. Click for PAT.'}
                    style={{
                        width: 40, height: 26, borderRadius: 3, cursor: 'pointer',
                        background: '#e07a2a', border: '1px solid #a8551a',
                        color: '#1a1008', fontSize: 9, fontWeight: 800, lineHeight: 1.1,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <span style={{ opacity: transport.mode === 'pat' ? 1 : 0.45 }}>PAT</span>
                    <span style={{ opacity: transport.mode === 'song' ? 1 : 0.45 }}>SONG</span>
                </button>

                <div style={{ display: 'flex', gap: 3 }}>
                    <button onClick={handlePlay} data-academy-id="transport-play" title="Play / pause"
                        style={transportBtn(transport.playing)}>
                        <Play size={12} color={transport.playing ? daw.green : fl.text}
                            fill={transport.playing ? daw.green : 'none'} />
                    </button>
                    <button onClick={() => stop()} data-academy-id="transport-stop" title="Stop"
                        style={transportBtn(!transport.playing)}>
                        <Square size={9} color={fl.text} fill={fl.text} />
                    </button>
                    <button data-academy-id="transport-record" title="Record (not simulated)"
                        style={transportBtn(false)}>
                        <Circle size={10} color="#c0504a" fill="#c0504a" />
                    </button>
                </div>

                {/* BPM */}
                <div title="Tempo in beats per minute" style={lcd()}>
                    <input
                        type="number" value={transport.bpm} min={40} max={300}
                        onChange={e => setBpm(Number(e.target.value) || 140)}
                        data-daw-bpm=""
                        style={{
                            width: 58, background: 'transparent', border: 'none', outline: 'none',
                            color: highlightBpm ? daw.green : '#e0a040',
                            fontSize: 16, fontFamily: dawFont.mono, fontWeight: 700, textAlign: 'center',
                            appearance: 'textfield', MozAppearance: 'textfield',
                        }}
                    />
                </div>

                {/* Position */}
                <div title="Song position — bar : step" style={lcd()}>
                    <span style={{
                        fontSize: 16, fontFamily: dawFont.mono, fontWeight: 700, color: daw.green,
                        letterSpacing: '0.04em',
                    }}>
                        {String(transport.currentBar + 1).padStart(2, '0')}
                        <span style={{ color: fl.textDim }}>:</span>
                        {String(transport.currentStep + 1).padStart(2, '0')}
                    </span>
                </div>

                {/* Pattern selector */}
                <div title="Selected pattern" style={{
                    display: 'flex', alignItems: 'center', gap: 6, height: 24, padding: '0 8px',
                    background: daw.well, border: `1px solid ${daw.border}`, borderRadius: 3,
                }}>
                    <span style={{ fontSize: 11, color: '#fff' }}>Pattern 1</span>
                    <ChevronDown size={11} color={fl.textDim} />
                </div>
            </div>

            {/* ── Hint panel ── */}
            <div style={{
                height: 20, flexShrink: 0, display: 'flex', alignItems: 'center',
                background: daw.well, borderBottom: `1px solid ${daw.border}`, padding: '0 10px',
            }}>
                <span style={{ fontSize: 9, color: fl.textDim, letterSpacing: '0.08em', marginRight: 8 }}>HINT</span>
                <span style={{
                    fontSize: 11, color: hint ? daw.green : fl.textDim,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {hint || '—'}
                </span>
            </div>

            {/* ── Body: browser + canvas ── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <div style={{
                    width: 158, flexShrink: 0, background: fl.browserBg,
                    borderRight: `1px solid ${daw.border}`, display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{
                        height: 22, display: 'flex', alignItems: 'center', padding: '0 8px',
                        background: fl.rulerBg, borderBottom: `1px solid ${daw.border}`,
                    }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: fl.textDim }}>
                            BROWSER
                        </span>
                    </div>
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
                </div>

                {/* Canvas — windows live here; also the coachmark bubble's anchor */}
                <div ref={canvasRef} style={{
                    flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
                    background: `${daw.bg}`,
                    backgroundImage: `radial-gradient(${daw.border} 1px, transparent 1px)`,
                    backgroundSize: '22px 22px',
                }}>
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
        </div>
    );
};

const transportBtn = (active: boolean): React.CSSProperties => ({
    width: 28, height: 26, borderRadius: 3, cursor: 'pointer',
    background: active ? daw.highlight : daw.panel,
    border: `1px solid ${daw.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
});

const lcd = (): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', height: 26, padding: '0 6px',
    background: daw.well, border: `1px solid ${daw.border}`, borderRadius: 3,
});
