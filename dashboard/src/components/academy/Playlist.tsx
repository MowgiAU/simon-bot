/**
 * Playlist — FL Studio's arrangement view.
 *
 * Built to the Stitch playlist mockup plus the real FL layout: a clip browser on
 * the far left, the NOTE/CHAN/PAT filter row above the track headers, a tool
 * strip, a bar ruler, and the grid with per-beat and per-bar lines.
 *
 * The tools are real. Draw places the browser's selected clip, Delete removes,
 * Mute silences a clip in place, and Select highlights — clicking the grid does
 * whatever the active tool says, rather than always toggling.
 */
import React, { useState } from 'react';
import {
    Pencil, Paintbrush, Ban, VolumeX, Move, Scissors,
    MousePointer2, Plus, Minus, Square, X, ChevronDown,
} from 'lucide-react';
import { useDAWStore } from './DAWStore';
import { daw, dawFx, dawFont, flPlaylist as fl } from './dawTheme';

const BEAT_W = 24;
const BAR_W = BEAT_W * 4;
const TRACK_H = 40;
const RULER_H = 22;
const BROWSER_W = 132;
const HEADER_W = 148;
const MAX_LANE_H = 336;

export type PlaylistTool = 'draw' | 'paint' | 'delete' | 'mute' | 'slip' | 'slice' | 'select';

const TOOLS: { id: PlaylistTool; icon: React.ElementType; label: string }[] = [
    { id: 'draw', icon: Pencil, label: 'Draw — place a clip' },
    { id: 'paint', icon: Paintbrush, label: 'Paint — drag to place many' },
    { id: 'delete', icon: Ban, label: 'Delete — remove a clip' },
    { id: 'mute', icon: VolumeX, label: 'Mute — silence a clip' },
    { id: 'slip', icon: Move, label: 'Slip (not simulated)' },
    { id: 'slice', icon: Scissors, label: 'Slice (not simulated)' },
    { id: 'select', icon: MousePointer2, label: 'Select' },
];

/** FL's clip-type filters above the track headers */
const CLIP_FILTERS: { id: 'note' | 'chan' | 'pat'; label: string }[] = [
    { id: 'note', label: 'NOTE' },
    { id: 'chan', label: 'CHAN' },
    { id: 'pat', label: 'PAT' },
];

interface PlaylistProps {
    highlightBars?: number[];
    highlightTrack?: number | null;
}

export const Playlist: React.FC<PlaylistProps> = ({ highlightBars, highlightTrack }) => {
    const playlist = useDAWStore(s => s.state.playlist);
    const transport = useDAWStore(s => s.state.transport);
    const addClip = useDAWStore(s => s.addPlaylistClip);
    const removeClip = useDAWStore(s => s.removePlaylistClip);
    const toggleClipMute = useDAWStore(s => s.togglePlaylistClipMute);
    const toggleTrackMute = useDAWStore(s => s.togglePlaylistTrackMute);

    const [tool, setTool] = useState<PlaylistTool>('draw');
    const [filters, setFilters] = useState({ note: true, chan: true, pat: true });
    const [selectedSource, setSelectedSource] = useState<string>('pattern:Pattern 1');
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [painting, setPainting] = useState(false);

    const { tracks, clips, barCount } = playlist;
    const gridW = barCount * BAR_W;
    const playheadX = (transport.currentBar + transport.currentStep / 16) * BAR_W;

    /** Clip sources in the browser: the Channel Rack pattern, plus any automation clips */
    const sources = [
        { key: 'pattern:Pattern 1', label: 'Pattern 1', type: 'pattern' as const },
        ...clips
            .filter(c => c.type === 'automation')
            .map(c => ({ key: `automation:${c.id}`, label: c.label ?? 'Automation', type: 'automation' as const })),
    ];

    const visible = (type: 'pattern' | 'automation') =>
        type === 'pattern' ? filters.pat : filters.chan;

    const clipAt = (track: number, bar: number) =>
        clips.find(c => c.track === track && bar >= c.startBar && bar < c.startBar + c.lengthBars);

    /** One place for "what does clicking a cell do", so every tool behaves consistently. */
    const actOnCell = (track: number, bar: number) => {
        const existing = clipAt(track, bar);
        switch (tool) {
            case 'draw':
            case 'paint':
                if (!existing) {
                    const [kind, label] = selectedSource.split(':');
                    addClip(track, bar, kind === 'automation' ? 'automation' : 'pattern', label);
                }
                break;
            case 'delete':
                if (existing) removeClip(existing.id);
                break;
            case 'mute':
                if (existing) toggleClipMute(existing.id);
                break;
            case 'select':
                setSelectedClipId(existing ? existing.id : null);
                break;
            default:
                break;  // slip / slice aren't simulated
        }
    };

    const iconBtn = (active: boolean): React.CSSProperties => ({
        width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? daw.green : 'transparent',
        border: `1px solid ${active ? daw.green : 'transparent'}`,
        padding: 0,
    });

    return (
        <div style={{
            background: fl.gridBg, fontFamily: dawFont.sans, color: fl.text,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            {/* ── Window bar ── */}
            <div data-daw-drag style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 24, padding: '0 8px', background: fl.windowBar,
                borderBottom: `1px solid #000`, cursor: 'grab',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={daw.green}>
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                    </svg>
                    <span style={{
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                        fontWeight: 600, color: fl.text,
                    }}>
                        Playlist — Arrangement
                    </span>
                    <ChevronDown size={11} color={fl.textDim} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: fl.textDim }}>
                    <Minus size={11} /><Square size={9} /><X size={11} />
                </div>
            </div>

            {/* ── Tool strip ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 2, height: 30, padding: '0 6px',
                background: fl.toolbar, borderBottom: `1px solid ${fl.outline}`,
            }}>
                {TOOLS.map(t => {
                    const Icon = t.icon;
                    const active = tool === t.id;
                    return (
                        <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                            data-academy-id={`playlist-tool-${t.id}`}
                            style={iconBtn(active)}>
                            <Icon size={13} color={active ? '#000' : fl.text} />
                        </button>
                    );
                })}
                <div style={{ width: 1, height: 18, background: fl.outline, margin: '0 6px' }} />
                {/* Selected clip source, mirroring FL's pattern selector */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, height: 20, padding: '0 8px',
                    background: daw.well, border: `1px solid ${fl.outline}`, borderRadius: 3,
                }}>
                    <span style={{ fontSize: 11, color: '#fff' }}>
                        {sources.find(s => s.key === selectedSource)?.label ?? 'Pattern 1'}
                    </span>
                    <ChevronDown size={11} color={fl.textDim} />
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
                {/* Clip browser */}
                <div style={{
                    width: BROWSER_W, flexShrink: 0, background: fl.browserBg,
                    borderRight: '1px solid #000', display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{
                        height: RULER_H, borderBottom: `1px solid ${fl.outline}`,
                        background: fl.rulerBg, display: 'flex', alignItems: 'center', padding: '0 8px',
                    }}>
                        <span style={{
                            fontSize: 9, letterSpacing: '0.08em', color: fl.textDim, fontWeight: 700,
                        }}>CLIPS</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: MAX_LANE_H, padding: 4 }}>
                        {sources.map(s => {
                            const isSel = s.key === selectedSource;
                            return (
                                <div key={s.key}
                                    onClick={() => setSelectedSource(s.key)}
                                    data-academy-id={`playlist-source-${s.key.replace(':', '-')}`}
                                    title={`Select ${s.label} — the Draw tool places this`}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '4px 6px', marginBottom: 3, borderRadius: 2,
                                        cursor: 'pointer', fontSize: 11,
                                        background: isSel ? '#2a3238' : 'transparent',
                                        border: `1px solid ${isSel ? daw.green : 'transparent'}`,
                                        color: isSel ? '#fff' : fl.text,
                                    }}>
                                    <span style={{
                                        width: 0, height: 0, flexShrink: 0,
                                        borderTop: '4px solid transparent',
                                        borderBottom: '4px solid transparent',
                                        borderLeft: `6px solid ${s.type === 'automation' ? fl.automation : fl.patternRed}`,
                                    }} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{
                        height: 26, borderTop: '1px solid #000', background: fl.toolbar,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span title="Automation clips appear here once created from a plugin control"
                            style={{ display: 'flex', color: fl.textDim, cursor: 'default' }}>
                            <Plus size={13} />
                        </span>
                    </div>
                </div>

                {/* Track headers */}
                <div style={{
                    width: HEADER_W, flexShrink: 0, background: fl.browserBg,
                    borderRight: '1px solid #000', display: 'flex', flexDirection: 'column',
                }}>
                    {/* + and the NOTE / CHAN / PAT filters */}
                    <div style={{
                        height: RULER_H, borderBottom: `1px solid ${fl.outline}`,
                        background: fl.rulerBg,
                        display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px',
                    }}>
                        <Plus size={12} color={fl.textDim} />
                        <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
                            {CLIP_FILTERS.map(f => {
                                const on = filters[f.id];
                                return (
                                    <button key={f.id}
                                        onClick={() => setFilters(p => ({ ...p, [f.id]: !p[f.id] }))}
                                        data-academy-id={`playlist-filter-${f.id}`}
                                        title={`${f.label} clips — click to show or hide`}
                                        style={{
                                            fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                                            fontFamily: dawFont.mono,
                                            padding: '2px 4px', borderRadius: 2, cursor: 'pointer',
                                            background: on ? daw.green : 'transparent',
                                            color: on ? '#000' : fl.textDim,
                                            border: `1px solid ${on ? daw.green : fl.outline}`,
                                        }}>
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ overflowY: 'auto', maxHeight: MAX_LANE_H }}>
                        {tracks.map(t => (
                            <div key={t.id}
                                data-academy-id={`playlist-track-${t.id}`}
                                style={{
                                    height: TRACK_H, boxSizing: 'border-box',
                                    display: 'flex', alignItems: 'center', gap: 7, padding: '0 7px',
                                    background: t.id === 0 ? fl.trackBgSel : fl.trackBg,
                                    borderBottom: '1px solid #000',
                                    borderTop: `1px solid ${fl.trackEdge}`,
                                    outline: highlightTrack === t.id ? `1px solid ${daw.green}` : 'none',
                                    outlineOffset: -1,
                                }}>
                                <div
                                    onClick={() => toggleTrackMute(t.id)}
                                    title={t.muted ? 'Unmute track' : 'Mute track'}
                                    style={{
                                        width: 11, height: 11, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                                        background: t.muted ? daw.well : fl.led,
                                        border: '1px solid #1b2328',
                                        boxShadow: t.muted ? dawFx.ledOff : `0 0 4px ${fl.led}88`,
                                    }}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 9, color: fl.textDim, lineHeight: 1 }}>...</div>
                                    <div style={{
                                        fontSize: 11, color: t.muted ? fl.textDim : '#fff',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {t.name}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div style={{ flex: 1, overflowX: 'auto' }}>
                    <div style={{ width: gridW, position: 'relative' }}>
                        {/* Ruler */}
                        <div style={{
                            display: 'flex', height: RULER_H, background: fl.rulerBg,
                            borderBottom: '1px solid #000',
                        }}>
                            {Array.from({ length: barCount }, (_, bar) => (
                                <div key={bar} style={{
                                    width: BAR_W, flexShrink: 0, boxSizing: 'border-box',
                                    borderLeft: `1px solid ${fl.rulerTick}`,
                                    display: 'flex', alignItems: 'flex-end', padding: '0 0 2px 4px',
                                    fontSize: 9, fontFamily: dawFont.mono, fontWeight: 500,
                                    color: highlightBars?.includes(bar) ? daw.green : fl.textDim,
                                }}>
                                    {bar + 1}
                                </div>
                            ))}
                        </div>

                        {/* Lanes */}
                        <div
                            onPointerUp={() => setPainting(false)}
                            onPointerLeave={() => setPainting(false)}
                            style={{
                                maxHeight: MAX_LANE_H, overflowY: 'auto', position: 'relative',
                                // Beat lines, with heavier lines on bar boundaries
                                backgroundColor: fl.gridBg,
                                backgroundImage:
                                    `linear-gradient(to right, ${fl.gridLineBar} 1px, transparent 1px),`
                                    + `linear-gradient(to right, ${fl.gridLine} 1px, transparent 1px)`,
                                backgroundSize: `${BAR_W}px 100%, ${BEAT_W}px 100%`,
                            }}>
                            {tracks.map(t => (
                                <div key={t.id} style={{ display: 'flex', height: TRACK_H, boxSizing: 'border-box' }}>
                                    {Array.from({ length: barCount }, (_, bar) => {
                                        const clip = clipAt(t.id, bar);
                                        const show = clip && visible(clip.type);
                                        const isSel = clip && clip.id === selectedClipId;
                                        const isAuto = clip?.type === 'automation';
                                        return (
                                            <div key={bar}
                                                onPointerDown={() => {
                                                    if (tool === 'paint') setPainting(true);
                                                    actOnCell(t.id, bar);
                                                }}
                                                onPointerEnter={() => { if (painting && tool === 'paint') actOnCell(t.id, bar); }}
                                                data-academy-id={`playlist-cell-${t.id}-${bar}`}
                                                title={clip ? `${clip.label}${clip.muted ? ' (muted)' : ''}` : `Bar ${bar + 1}`}
                                                style={{
                                                    width: BAR_W, height: '100%', flexShrink: 0, boxSizing: 'border-box',
                                                    borderBottom: '1px solid rgba(0,0,0,0.45)',
                                                    background: highlightBars?.includes(bar) && !show
                                                        ? `${daw.green}12` : 'transparent',
                                                    cursor: 'pointer', padding: 1,
                                                    opacity: t.muted ? 0.45 : 1,
                                                }}>
                                                {show && (
                                                    <div style={{
                                                        height: '100%', borderRadius: 1, overflow: 'hidden',
                                                        background: isAuto ? `${fl.automation}cc` : `${fl.patternRed}cc`,
                                                        border: `1px solid ${isSel ? '#fff' : isAuto ? fl.automation : fl.patternRedEdge}`,
                                                        opacity: clip!.muted ? 0.4 : 1,
                                                        display: 'flex', flexDirection: 'column',
                                                    }}>
                                                        <div style={{
                                                            height: 14, background: 'rgba(0,0,0,0.3)',
                                                            display: 'flex', alignItems: 'center', gap: 3, padding: '0 3px',
                                                        }}>
                                                            <ChevronDown size={9} color="#d6dde3" />
                                                            <span style={{
                                                                fontSize: 9, color: '#fff', fontWeight: 600,
                                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                            }}>
                                                                {clip!.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Playhead */}
                            <div data-academy-id="playlist-playhead" style={{
                                position: 'absolute', top: 0, bottom: 0, left: playheadX,
                                width: 1, background: fl.playhead,
                                boxShadow: `0 0 3px ${fl.playhead}`,
                                pointerEvents: 'none', zIndex: 5,
                                opacity: transport.playing ? 1 : 0.5,
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: -4,
                                    width: 9, height: 9, background: fl.playhead,
                                    borderRadius: '0 0 2px 2px',
                                }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status strip */}
            <div style={{
                height: 20, background: fl.windowBar, borderTop: `1px solid ${fl.outline}`,
                display: 'flex', alignItems: 'center', padding: '0 10px', gap: 12,
                fontSize: 10, color: fl.textDim,
            }}>
                <span>Tool: <span style={{ color: daw.green }}>{tool}</span></span>
                <span>Placing: <span style={{ color: daw.green }}>
                    {sources.find(s => s.key === selectedSource)?.label}
                </span></span>
            </div>
        </div>
    );
};
