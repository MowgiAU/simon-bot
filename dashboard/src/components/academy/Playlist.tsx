/**
 * Playlist — FL Studio's arrangement view.
 *
 * Tracks down the left, bars across the top, and clips placed on the grid. Click an
 * empty cell to place a pattern block, click a block to remove it. The playhead
 * tracks the transport's bar/step, so it sweeps smoothly rather than jumping per bar.
 *
 * Pattern blocks are real: AudioEngine only sounds the Channel Rack on bars a block
 * covers (see patternPlaysAt), so removing one genuinely silences that bar.
 */
import React from 'react';
import { Menu, Minus, Square, X } from 'lucide-react';
import { useDAWStore } from './DAWStore';
import { daw, dawFx, dawFont } from './dawTheme';

const TRACK_H = 34;
const TRACK_GAP = 2;
const HEADER_W = 110;
const BAR_W = 76;
const RULER_H = 20;

interface PlaylistProps {
    /** Bars a lesson wants emphasised */
    highlightBars?: number[];
    /** Track a lesson wants emphasised */
    highlightTrack?: number | null;
}

export const Playlist: React.FC<PlaylistProps> = ({ highlightBars, highlightTrack }) => {
    const playlist = useDAWStore(s => s.state.playlist);
    const transport = useDAWStore(s => s.state.transport);
    const togglePlaylistClip = useDAWStore(s => s.togglePlaylistClip);
    const toggleTrackMute = useDAWStore(s => s.togglePlaylistTrackMute);

    const { tracks, clips, barCount } = playlist;
    const gridW = barCount * BAR_W;

    // Fractional bar position, so the playhead glides through the bar instead of
    // snapping at bar boundaries.
    const playheadBars = transport.currentBar + transport.currentStep / 16;

    return (
        <div style={{
            background: daw.bg,
            fontFamily: dawFont.sans,
            color: daw.text,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Title bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 30, padding: '0 12px',
                background: daw.dark, borderBottom: `1px solid ${daw.border}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: daw.textBright }}>
                    <Menu size={12} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Playlist</span>
                    <span style={{ fontSize: 11, color: daw.textDim }}>
                        — {barCount} bars
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: daw.text }}>
                    <Minus size={12} /><Square size={10} /><X size={12} />
                </div>
            </div>

            <div style={{ display: 'flex', overflowX: 'auto' }}>
                {/* Track headers — sticky so they stay put while the grid scrolls */}
                <div style={{
                    width: HEADER_W, flexShrink: 0,
                    background: daw.panel,
                    borderRight: `1px solid ${daw.border}`,
                    position: 'sticky', left: 0, zIndex: 2,
                }}>
                    <div style={{
                        height: RULER_H, borderBottom: `1px solid ${daw.border}`,
                        background: daw.dark,
                    }} />
                    <div style={{ padding: `${TRACK_GAP}px 0`, display: 'flex', flexDirection: 'column', gap: TRACK_GAP }}>
                        {tracks.map(t => (
                            <div key={t.id}
                                data-academy-id={`playlist-track-${t.id}`}
                                style={{
                                    height: TRACK_H,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '0 8px',
                                    background: daw.panel,
                                    border: `1px solid ${highlightTrack === t.id ? daw.green : 'transparent'}`,
                                    boxShadow: highlightTrack === t.id ? `0 0 8px ${daw.green}88` : 'none',
                                    borderRadius: 2,
                                }}>
                                <div
                                    onClick={() => toggleTrackMute(t.id)}
                                    title={t.muted ? 'Unmute track' : 'Mute track'}
                                    style={{
                                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                                        background: t.muted ? daw.well : daw.green,
                                        boxShadow: t.muted ? dawFx.ledOff : dawFx.ledOn,
                                    }}
                                />
                                <span style={{
                                    fontSize: 11,
                                    color: t.muted ? daw.textDim : daw.textBright,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {t.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div style={{ position: 'relative', width: gridW, flexShrink: 0 }}>
                    {/* Bar ruler */}
                    <div style={{
                        display: 'flex', height: RULER_H,
                        background: daw.dark, borderBottom: `1px solid ${daw.border}`,
                    }}>
                        {Array.from({ length: barCount }, (_, bar) => (
                            <div key={bar} style={{
                                width: BAR_W, flexShrink: 0,
                                borderLeft: `1px solid ${daw.border}`,
                                display: 'flex', alignItems: 'center', paddingLeft: 5,
                                fontSize: 10, fontFamily: dawFont.mono,
                                fontWeight: 700,
                                color: highlightBars?.includes(bar) ? daw.green : daw.textDim,
                            }}>
                                {bar + 1}
                            </div>
                        ))}
                    </div>

                    {/* Track lanes */}
                    <div style={{ padding: `${TRACK_GAP}px 0`, display: 'flex', flexDirection: 'column', gap: TRACK_GAP }}>
                        {tracks.map(t => (
                            <div key={t.id} style={{ display: 'flex', height: TRACK_H }}>
                                {Array.from({ length: barCount }, (_, bar) => {
                                    const clip = clips.find(c =>
                                        c.track === t.id && bar >= c.startBar && bar < c.startBar + c.lengthBars);
                                    const isHlBar = highlightBars?.includes(bar);
                                    const isAutomation = clip?.type === 'automation';
                                    return (
                                        <div
                                            key={bar}
                                            onClick={() => togglePlaylistClip(t.id, bar)}
                                            data-academy-id={`playlist-cell-${t.id}-${bar}`}
                                            title={clip ? `${clip.label} — click to remove` : `Bar ${bar + 1} — click to place a pattern`}
                                            style={{
                                                width: BAR_W, height: '100%', flexShrink: 0,
                                                boxSizing: 'border-box',
                                                borderLeft: `1px solid ${daw.border}`,
                                                background: clip
                                                    ? (isAutomation ? daw.dark : dawFx.btnSurface)
                                                    : (isHlBar ? `${daw.green}14` : 'transparent'),
                                                borderTop: clip ? `1px solid ${isAutomation ? daw.green : daw.highlight}` : 'none',
                                                borderBottom: clip ? `1px solid ${daw.border}` : 'none',
                                                borderRight: clip ? `1px solid ${daw.border}` : 'none',
                                                opacity: t.muted ? 0.4 : 1,
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center',
                                                padding: '0 6px',
                                                overflow: 'hidden',
                                            }}>
                                            {clip && (
                                                <span style={{
                                                    fontSize: 10,
                                                    color: isAutomation ? daw.green : daw.textBright,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {clip.label}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Playhead */}
                    <div
                        data-academy-id="playlist-playhead"
                        style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: playheadBars * BAR_W,
                            width: 2, background: daw.green,
                            boxShadow: `0 0 6px ${daw.green}`,
                            pointerEvents: 'none',
                            opacity: transport.playing ? 1 : 0.45,
                            zIndex: 3,
                        }}
                    />
                </div>
            </div>

            {/* Footer hint */}
            <div style={{
                height: 22, background: daw.dark, borderTop: `1px solid ${daw.border}`,
                display: 'flex', alignItems: 'center', padding: '0 12px',
                fontSize: 10, color: daw.textDim,
            }}>
                Click a bar to place or remove a pattern block
            </div>
        </div>
    );
};
