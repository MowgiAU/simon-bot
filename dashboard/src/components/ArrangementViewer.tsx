/**
 * Shared FLP Arrangement Viewer components.
 * Used by both TrackPage and BattleEntryPage.
 */
import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, borderRadius } from '../theme/theme';
import { Music, Zap, FileAudio, X, Play, Pause, Download, Layers, Maximize2, Minimize2 } from 'lucide-react';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface NoteData {
    key: number;
    position: number;
    length: number;
    velocity: number;
}

export interface AutomationPoint {
    position: number;  // 0-1 normalized
    value: number;     // 0-1
    tension: number;   // -1 to 1
}

export interface ArrangementClip {
    id: number;
    name: string;
    start: number;
    length: number;
    type?: 'pattern' | 'audio' | 'automation';
    notes?: NoteData[];
    sampleFileName?: string;
    automationPoints?: AutomationPoint[];
    oggUrl?: string;
    peaks?: number[];
    duration?: number;
}

export interface ArrangementTrack {
    id: number;
    name: string;
    clips: ArrangementClip[];
    enabled?: boolean;
    group?: number;
}

export interface ProjectInfo {
    plugins: string[];
    samples: string[];
}

export interface ArrangementData {
    bpm: number;
    hasTempoAutomation?: boolean;
    tracks: ArrangementTrack[];
    projectInfo?: ProjectInfo;
    markers?: Array<{ position: number; name: string }>;
    fileType?: 'flp' | 'als';
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TRACK_COLORS = [
    '#7C3AED', '#2563EB', '#C96208', '#D97706',
    '#DC2626', '#7C3AED', '#0891B2', '#65A30D',
];

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const keyToName = (k: number) => `${NOTE_NAMES[k % 12]}${Math.floor(k / 12) - 2}`;

// ── MiniPianoRoll ─────────────────────────────────────────────────────────────

export const MiniPianoRoll = React.memo<{ notes: NoteData[]; clipLength: number; color: string }>(({ notes, clipLength, color }) => {
    if (!notes.length) return null;
    // Downsample dense patterns — cap for mini preview performance
    const MAX_NOTES = 80;
    const displayNotes = notes.length > MAX_NOTES
        ? notes.filter((_, i) => i % Math.ceil(notes.length / MAX_NOTES) === 0)
        : notes;
    const keys = displayNotes.map(n => n.key);
    const minKey = Math.min(...keys);
    const maxKey = Math.max(...keys);
    const keyRange = Math.max(maxKey - minKey, 1);
    // Single <path> instead of individual <rect> elements — massive DOM reduction
    const pathData = displayNotes.map(note => {
        const x = note.position;
        const y = maxKey - note.key;
        const w = Math.max(note.length, clipLength * 0.008);
        return `M${x} ${y}h${w}v0.7h${-w}Z`;
    }).join('');
    return (
        <svg viewBox={`0 0 ${clipLength} ${keyRange + 1}`} preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.85 }}>
            <path d={pathData} fill={color} opacity={0.7} />
        </svg>
    );
});

// ── MiniAutomation ────────────────────────────────────────────────────────────

export const MiniAutomation = React.memo<{ points: AutomationPoint[]; color: string }>(({ points, color }) => {
    if (points.length < 2) return null;
    const w = 100, h = 20, pad = 0.5;
    const toX = (p: number) => pad + p * (w - pad * 2);
    const toY = (v: number) => h - pad - v * (h - pad * 2);
    let path = `M ${toX(points[0].position)} ${toY(points[0].value)}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1], curr = points[i];
        const x1 = toX(prev.position), y1 = toY(prev.value);
        const x2 = toX(curr.position), y2 = toY(curr.value);
        if (Math.abs(prev.tension) < 0.01) {
            path += ` L ${x2} ${y2}`;
        } else {
            const t = prev.tension;
            const cx1 = x1 + (x2 - x1) * (0.5 + t * 0.4);
            const cx2 = x2 - (x2 - x1) * (0.5 - t * 0.4);
            path += ` C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
        }
    }
    const fillPath = path + ` L ${toX(points[points.length - 1].position)} ${h} L ${toX(points[0].position)} ${h} Z`;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.85 }}>
            <path d={fillPath} fill={color} opacity={0.15} />
            <path d={path} stroke={color} fill="none" strokeWidth={0.8} opacity={0.9} />
        </svg>
    );
});

// ── MiniWaveform ──────────────────────────────────────────────────────────────

export const MiniWaveform = React.memo<{ color: string; clipId: number | string; peaks?: number[] }>(({ color, clipId, peaks }) => {
    if (peaks && peaks.length > 0) {
        const bars = 60;
        const step = peaks.length / bars;
        // Single <path> instead of individual <rect> elements
        let pathData = '';
        for (let i = 0; i < bars; i++) {
            const start = Math.floor(i * step);
            const end = Math.min(Math.ceil((i + 1) * step), peaks.length);
            let sum = 0;
            for (let j = start; j < end; j++) sum += peaks[j];
            const amp = sum / (end - start);
            const h = Math.max(amp * 18, 1);
            pathData += `M${i} ${10 - h / 2}h0.7v${h}h-0.7Z`;
        }
        return (
            <svg viewBox={`0 0 ${bars} 20`} preserveAspectRatio="none"
                style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.75 }}>
                <path d={pathData} fill={color} opacity={0.8} />
            </svg>
        );
    }
    const bars = 48;
    const seed = typeof clipId === 'string' ? clipId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : clipId;
    let pathData = '';
    for (let i = 0; i < bars; i++) {
        const amp = (Math.sin(seed * 0.1 + i * 0.7) * 0.4 + 0.5) * (Math.sin(i * 0.3 + seed * 0.05) * 0.3 + 0.7);
        const h = Math.max(amp * 18, 1);
        pathData += `M${i} ${10 - h / 2}h0.7v${h}h-0.7Z`;
    }
    return (
        <svg viewBox={`0 0 ${bars} 20`} preserveAspectRatio="none"
            style={{ position: 'absolute', top: '8px', left: 0, width: '100%', height: 'calc(100% - 9px)', opacity: 0.6 }}>
            <path d={pathData} fill={color} opacity={0.7} />
        </svg>
    );
});

// ── PianoRollModal ────────────────────────────────────────────────────────────

export const PianoRollModal: React.FC<{ clip: ArrangementClip; color: string; onClose: () => void }> = ({ clip, color, onClose }) => {
    const notes = clip.notes ?? [];
    if (!notes.length) return null;
    const keys = notes.map(n => n.key);
    const minKey = Math.max(0, Math.min(...keys) - 2);
    const maxKey = Math.min(131, Math.max(...keys) + 2);
    const keyRange = maxKey - minKey + 1;
    const ROW_H = 14;
    const ROLL_H = keyRange * ROW_H;
    const LABEL_W = 44;
    const maxPos = Math.max(...notes.map(n => n.position + n.length), clip.length);
    const FIT_WIDTH = 820;
    const autoZoom = Math.max(15, Math.min(80, Math.floor(FIT_WIDTH / Math.max(maxPos, 1))));
    const [zoomPx, setZoomPx] = React.useState(autoZoom);
    const BEAT_W = zoomPx;
    const svgW = Math.max(maxPos * BEAT_W, 240);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (!e.altKey) return;
            e.preventDefault();
            setZoomPx(z => Math.max(8, Math.min(200, Math.round(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))));
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);
    const isBlack = (k: number) => [1,3,6,8,10].includes(k % 12);
    const beatLines = [];
    for (let b = 0; b <= Math.ceil(maxPos); b++) beatLines.push(b);
    return createPortal(
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#0d1117', border: `1px solid ${color}44`, borderRadius: borderRadius.lg, maxWidth: '900px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px ${color}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color }} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{clip.name}</span>
                        <span style={{ fontSize: '0.75rem', color: colors.textSecondary, backgroundColor: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px' }}>
                            {notes.length} notes · {clip.length.toFixed(1)} beats
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button onClick={() => setZoomPx(z => Math.max(8, Math.round(z / 1.5)))} style={{ background: 'none', border: 'none', color: zoomPx <= 8 ? colors.textSecondary : colors.textPrimary, cursor: zoomPx <= 8 ? 'default' : 'pointer', padding: '0 6px', fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1 }}>−</button>
                            <span style={{ fontSize: '0.7rem', color: colors.textSecondary, minWidth: '36px', textAlign: 'center' }}>{zoomPx}px/b</span>
                            <button onClick={() => setZoomPx(z => Math.min(200, Math.round(z * 1.5)))} style={{ background: 'none', border: 'none', color: zoomPx >= 200 ? colors.textSecondary : colors.textPrimary, cursor: zoomPx >= 200 ? 'default' : 'pointer', padding: '0 6px', fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1 }}>+</button>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} /></button>
                    </div>
                </div>
                <div ref={scrollRef} style={{ display: 'flex', flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <div style={{ width: `${LABEL_W}px`, flexShrink: 0, backgroundColor: '#0d1117', borderRight: '1px solid rgba(255,255,255,0.07)', position: 'sticky', left: 0, zIndex: 2 }}>
                        {Array.from({ length: keyRange }, (_, i) => {
                            const k = maxKey - i;
                            const black = isBlack(k);
                            const isC = k % 12 === 0;
                            return (
                                <div key={k} style={{ height: `${ROW_H}px`, backgroundColor: black ? '#1a1f2b' : '#242938', borderBottom: '1px solid rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', fontSize: '0.6rem', color: isC ? '#a78bfa' : (black ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)'), fontWeight: isC ? 700 : 400 }}>
                                    {isC || black ? keyToName(k) : ''}
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0, width: `${svgW}px`, height: `${ROLL_H}px` }}>
                        {Array.from({ length: keyRange }, (_, i) => {
                            const k = maxKey - i;
                            return <div key={k} style={{ position: 'absolute', left: 0, right: 0, top: i * ROW_H, height: ROW_H, backgroundColor: isBlack(k) ? 'rgba(0,0,0,0.25)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }} />;
                        })}
                        {beatLines.map(b => (
                            <div key={b} style={{ position: 'absolute', top: 0, bottom: 0, left: `${b * BEAT_W}px`, width: '1px', backgroundColor: b % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)' }} />
                        ))}
                        {notes.map((note, i) => {
                            const rowIdx = maxKey - note.key;
                            if (rowIdx < 0 || rowIdx >= keyRange) return null;
                            const w = Math.max(note.length * BEAT_W - 2, 3);
                            return <div key={i} style={{ position: 'absolute', left: `${note.position * BEAT_W + 1}px`, top: `${rowIdx * ROW_H + 2}px`, width: `${w}px`, height: `${ROW_H - 4}px`, backgroundColor: color, opacity: 0.4 + (note.velocity / 128) * 0.6, borderRadius: '2px', boxShadow: `0 0 4px ${color}88` }} />;
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── SampleInfoModal ───────────────────────────────────────────────────────────

export const SampleInfoModal: React.FC<{ clip: ArrangementClip; color: string; peaks?: number[]; projectZipUrl?: string | null; trackId?: string; onClose: () => void }> = ({ clip, color, peaks, projectZipUrl, trackId, onClose }) => {
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [audioDuration, setAudioDuration] = React.useState<number>(clip.duration ?? 0);
    const hasPeaks = peaks && peaks.length > 0;
    const bars = 120;
    const step = hasPeaks ? peaks!.length / bars : 1;
    const playheadX = audioDuration > 0 ? (currentTime / audioDuration) * bars : 0;
    const togglePlay = () => {
        if (!audioRef.current) return;
        if (playing) audioRef.current.pause(); else audioRef.current.play().catch(() => {});
    };
    const seekClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !audioDuration) return;
        const r = e.currentTarget.getBoundingClientRect();
        audioRef.current.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audioDuration;
    };
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    return createPortal(
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#0d1117', border: `1px solid ${color}44`, borderRadius: borderRadius.lg, width: '480px', maxWidth: '100%', overflow: 'hidden', boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px ${color}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', backgroundColor: `${color}18` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileAudio size={16} color={color} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{clip.name}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} /></button>
                </div>
                {/* Only show waveform/seek box when there's real data to display */}
                {(hasPeaks || clip.oggUrl) && (
                    <div style={{ padding: '16px 16px 0' }}>
                        <div onClick={clip.oggUrl ? seekClick : undefined} style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: borderRadius.md, padding: '12px 8px', border: `1px solid ${color}22`, cursor: clip.oggUrl ? 'pointer' : 'default', position: 'relative' }}>
                            <svg viewBox={`0 0 ${bars} 40`} preserveAspectRatio="none" style={{ width: '100%', height: '64px', display: 'block' }}>
                                {hasPeaks
                                    ? Array.from({ length: bars }, (_, i) => {
                                        const start = Math.floor(i * step);
                                        const end = Math.min(Math.ceil((i + 1) * step), peaks!.length);
                                        let sum = 0;
                                        for (let j = start; j < end; j++) sum += peaks![j];
                                        const amp = sum / (end - start);
                                        const h = Math.max(amp * 36, 1);
                                        return <rect key={i} x={i} y={20 - h / 2} width={0.7} height={h} fill={color} opacity={0.85} />;
                                    })
                                    : Array.from({ length: bars }, (_, i) => {
                                        const seed = clip.id;
                                        const amp = (Math.sin(seed * 0.1 + i * 0.7) * 0.4 + 0.5) * (Math.sin(i * 0.3 + seed * 0.05) * 0.3 + 0.7);
                                        const h = Math.max(amp * 36, 1);
                                        return <rect key={i} x={i} y={20 - h / 2} width={0.7} height={h} fill={color} opacity={0.55} />;
                                    })
                                }
                                {audioDuration > 0 && <line x1={playheadX} y1={0} x2={playheadX} y2={40} stroke="white" strokeWidth="0.5" opacity="0.9" />}
                            </svg>
                        </div>
                    </div>
                )}
                {clip.oggUrl && (
                    <div style={{ padding: '10px 16px 0' }}>
                        <audio ref={audioRef} src={clip.oggUrl}
                            onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
                            onDurationChange={() => { if (audioRef.current) setAudioDuration(audioRef.current.duration); }}
                            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                            onEnded={() => { setPlaying(false); setCurrentTime(0); }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button onClick={togglePlay} style={{ background: `${color}22`, border: `1px solid ${color}55`, borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                                {playing ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <div onClick={seekClick} style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer', position: 'relative' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.05s linear' }} />
                            </div>
                            <span style={{ fontSize: '0.72rem', color: colors.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>{fmtTime(currentTime)} / {fmtTime(audioDuration)}</span>
                        </div>
                    </div>
                )}
                <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { label: 'File', value: clip.sampleFileName ?? clip.name },
                        { label: 'Clip length', value: `${clip.length.toFixed(2)} beats` },
                        { label: 'Sample duration', value: audioDuration > 0 ? fmtTime(audioDuration) : (clip.duration ? fmtTime(clip.duration) : '—') },
                    ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, fontSize: '0.82rem' }}>
                            <span style={{ color: colors.textSecondary }}>{label}</span>
                            <span style={{ color: colors.textPrimary, fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
                        </div>
                    ))}
                    {projectZipUrl && trackId && (
                        <a href={`/api/tracks/${trackId}/download-zip`}
                            download style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px', padding: '8px', backgroundColor: `${color}22`, border: `1px solid ${color}44`, borderRadius: borderRadius.md, color, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
                            <Download size={14} /> Download Loop Package
                        </a>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── ArrangementViewer ─────────────────────────────────────────────────────────

const EMPTY_SAMPLES_MAP: Record<string, number[]> = {};

export const ArrangementViewer: React.FC<{
    arrangement: ArrangementData;
    duration: number;
    currentTimeRef: React.MutableRefObject<number>;
    isPlayingRef: React.MutableRefObject<boolean>;
    projectFileUrl: string | null;
    projectZipUrl?: string | null;
    trackId?: string;
    zoom: number;
    setZoom: (v: number) => void;
    samplesMap?: Record<string, number[]>;
}> = React.memo(({ arrangement, duration, currentTimeRef, isPlayingRef, projectFileUrl, projectZipUrl, trackId, zoom, setZoom, samplesMap = EMPTY_SAMPLES_MAP }) => {
    const [selectedClip, setSelectedClip] = React.useState<{ clip: ArrangementClip; color: string } | null>(null);
    const [fullscreen, setFullscreen] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth < 640);
    const playheadRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const labelW = isMobile ? 84 : 140;

    // Close fullscreen on Escape
    React.useEffect(() => {
        if (!fullscreen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fullscreen]);

    const tempoWarning = arrangement.hasTempoAutomation === true;

    // Memoize heavy arrangement computations — only recompute when arrangement data changes
    const { totalBeats, activeTracks, markers, bpm, startBeat, spanBeats } = useMemo(() => {
        const lastClipEnd = arrangement.tracks.reduce((max, t) => {
            const trackMax = t.clips.reduce((tm, c) => Math.max(tm, c.start + c.length), 0);
            return Math.max(max, trackMax);
        }, 0);
        const totalBeats = lastClipEnd > 0 ? lastClipEnd : 32;
        const activeTracks = arrangement.tracks;
        const markers = arrangement.markers ?? [];
        const bpm = arrangement.bpm || 140;
        const minClipStart = activeTracks.reduce((min, t) => t.clips.reduce((tm, c) => Math.min(tm, c.start), min), Infinity);
        const startBeat = isFinite(minClipStart) ? minClipStart : 0;
        const spanBeats = totalBeats - startBeat;
        return { totalBeats, activeTracks, markers, bpm, startBeat, spanBeats };
    }, [arrangement]);

    // rAF-based playhead — updates DOM directly, no React re-renders during playback
    useEffect(() => {
        let animFrame: number;
        const beatsPerSec = bpm / 60;
        const update = () => {
            const currentTime = currentTimeRef.current;
            const isPlaying = isPlayingRef.current;
            const playheadBeat = duration > 0 && spanBeats > 0
                ? startBeat + (currentTime / duration) * spanBeats
                : currentTime * beatsPerSec;
            const pct = totalBeats > 0 ? (playheadBeat / totalBeats) * 100 : 0;

            if (playheadRef.current) {
                if (pct > 0) {
                    playheadRef.current.style.display = '';
                    playheadRef.current.style.left = `calc(${labelW}px + (100% - ${labelW}px) * ${pct / 100})`;
                } else {
                    playheadRef.current.style.display = 'none';
                }
            }

            // Auto-scroll during playback at zoom > 1
            if (isPlaying && scrollContainerRef.current && zoom > 1) {
                const container = scrollContainerRef.current;
                const timelineW = container.scrollWidth - labelW;
                const playheadX = (pct / 100) * timelineW + labelW;
                const viewportW = container.clientWidth;
                if (container.scrollWidth > viewportW + 10) {
                    const maxScroll = container.scrollWidth - viewportW;
                    container.scrollLeft = Math.max(0, Math.min(playheadX - viewportW / 2, maxScroll));
                }
            }

            animFrame = requestAnimationFrame(update);
        };
        animFrame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(animFrame);
    }, [bpm, duration, startBeat, spanBeats, totalBeats, zoom, currentTimeRef, isPlayingRef, labelW]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.altKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                setZoom(Math.min(10, Math.max(1, zoom + delta)));
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [setZoom, zoom]);

    const timelineWidth = `${100 * zoom}%`;

    // Subtle grid-line backdrop behind the timeline — gives the glass clips something to float over
    const timelineGridBg: React.CSSProperties = {
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
    };

    // Memoize beat ruler — only changes with zoom or total beat count
    const beatRuler = useMemo(() => {
        const barStep = zoom < 0.3 ? 40 : zoom < 0.6 ? 20 : zoom < 1.5 ? 10 : zoom < 3 ? 4 : zoom < 5 ? 2 : 1;
        const totalBars = Math.ceil(totalBeats / 4);
        const items = [];
        for (let bar = 1; bar <= totalBars; bar += barStep) {
            items.push(
                <div key={bar} style={{ position: 'absolute', left: `${((bar - 1) * 4 / totalBeats) * 100}%`, fontSize: '0.65rem', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '4px', paddingBottom: '4px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                    {bar}
                </div>
            );
        }
        return <div style={{ position: 'relative', width: '100%', height: '1.2rem' }}>{items}</div>;
    }, [zoom, totalBeats]);

    // Memoize track rows — the CRITICAL optimisation.
    // This is the most expensive part of the render: many clips × SVG sub-components.
    // Without this, every playhead tick (~4×/sec) re-renders ALL clip SVGs.
    const trackRows = useMemo(() => {
        const trackById = new Map(activeTracks.map(t => [t.id, t]));
        return activeTracks.map((t, ti) => {
            const isMuted = t.enabled === false;
            const isEmpty = t.clips.length === 0;
            let depth = 0, current = t;
            const seen = new Set<number>();
            while ((current.group ?? 0) > 0) {
                if (seen.has(current.id)) break;
                seen.add(current.id);
                depth++;
                const parent = trackById.get(current.group! - 1);
                if (!parent) break;
                current = parent;
            }
            const trackColor = isMuted ? '#6b7280' : TRACK_COLORS[ti % TRACK_COLORS.length];
            const indentPx = depth * 12;
            return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', height: isEmpty ? '28px' : '56px', marginBottom: isEmpty ? '2px' : '4px', opacity: isMuted ? 0.45 : 1 }}>
                    <div style={{ width: `${labelW}px`, flexShrink: 0, paddingRight: isMobile ? '8px' : '12px', paddingLeft: `${indentPx}px`, fontSize: isMobile ? (isEmpty ? '0.6rem' : '0.68rem') : (isEmpty ? '0.65rem' : '0.75rem'), color: isMuted ? '#6b7280' : (isEmpty ? 'rgba(255,255,255,0.35)' : colors.textSecondary), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', position: 'sticky', left: 0, backgroundColor: 'rgba(10,14,20,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 5, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        {depth > 0 && <span style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>╰</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: isEmpty ? 'italic' : 'normal' }}>{t.name}</span>
                        {isMuted && <span style={{ flexShrink: 0, fontSize: '0.6rem', backgroundColor: 'rgba(255,255,255,0.1)', color: '#9ca3af', padding: '1px 3px', borderRadius: '2px' }}>M</span>}
                        {!isEmpty && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: trackColor, boxShadow: isMuted ? 'none' : `0 0 6px ${trackColor}`, flexShrink: 0 }} />}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                        {t.clips.map((clip) => {
                            const isClickable = (clip.type === 'pattern' && clip.notes && clip.notes.length > 0) || clip.type === 'audio';
                            return (
                                <div key={clip.id} title={clip.name}
                                    onClick={isClickable ? (e) => { e.stopPropagation(); setSelectedClip({ clip, color: trackColor }); } : undefined}
                                    onMouseEnter={isClickable ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.09)'; } : undefined}
                                    onMouseLeave={isClickable ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; } : undefined}
                                    style={{ position: 'absolute', left: `${(clip.start / totalBeats) * 100}%`, width: `${(clip.length / totalBeats) * 100}%`, height: 'calc(100% - 6px)', top: '3px', backgroundColor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)', borderLeft: `3px solid ${trackColor}${isMuted ? '66' : 'ff'}`, boxSizing: 'border-box', minWidth: '3px', overflow: 'hidden', cursor: isClickable ? 'pointer' : 'default', contain: 'layout style paint', transition: 'background-color 0.15s' }}>
                                    <div style={{ position: 'absolute', top: '1px', left: '5px', fontSize: '0.55rem', color: trackColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'calc(100% - 8px)', lineHeight: 1, fontWeight: 600, opacity: 0.95 }}>
                                        {clip.name}
                                    </div>
                                    {clip.type === 'pattern' && clip.notes && clip.notes.length > 0 && (
                                        <MiniPianoRoll notes={clip.notes} clipLength={clip.length} color={trackColor} />
                                    )}
                                    {clip.type === 'automation' && clip.automationPoints && clip.automationPoints.length > 0 && (
                                        <MiniAutomation points={clip.automationPoints} color={trackColor} />
                                    )}
                                    {clip.type === 'audio' && (
                                        <MiniWaveform color={trackColor} clipId={clip.id}
                                            peaks={(() => { const m = clip.sampleFileName ? samplesMap[clip.sampleFileName.toLowerCase()] : undefined; return (m && m.length > 0) ? m : (clip.peaks && clip.peaks.length > 0) ? clip.peaks : undefined; })()} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        });
    }, [activeTracks, totalBeats, samplesMap, labelW, isMobile]);

    // Memoize timeline markers
    const markerElements = useMemo(() => markers.map((marker, mi) => {
        const pct = (marker.position / totalBeats) * 100;
        return (
            <div key={mi} style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${labelW}px + (100% - ${labelW}px) * ${pct / 100})`, width: '1px', backgroundColor: '#f59e0b', opacity: 0.25, pointerEvents: 'none', zIndex: 8 }}>
                <div style={{ position: 'absolute', top: '6px', left: '-4px', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #f59e0b' }} />
                <div style={{ position: 'absolute', top: '2px', left: '6px', fontSize: '0.6rem', color: '#f59e0b', whiteSpace: 'nowrap', fontWeight: 600, pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)', letterSpacing: '0.02em', backgroundColor: 'rgba(13,17,23,0.85)', padding: '1px 4px', borderRadius: '2px' }}>{marker.name}</div>
            </div>
        );
    }), [markers, totalBeats, labelW]);

    const toolbar = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
                <Music size={isMobile ? 17 : 20} color={colors.primary} />
                <h2 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.25rem' }}>Playlist</h2>
                <span style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: colors.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {arrangement.bpm} BPM
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', backgroundColor: 'rgba(255,255,255,0.05)', padding: isMobile ? '3px 6px' : '4px 8px', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} style={{ background: 'none', border: 'none', color: zoom <= 1 ? colors.textSecondary : colors.textPrimary, cursor: zoom <= 1 ? 'default' : 'pointer', padding: '2px 6px', fontSize: '1.1rem', fontWeight: 'bold' }}>-</button>
                    <span style={{ fontSize: isMobile ? '0.68rem' : '0.75rem', color: colors.textSecondary, minWidth: isMobile ? '34px' : '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(10, zoom + 0.5))} style={{ background: 'none', border: 'none', color: zoom >= 10 ? colors.textSecondary : colors.textPrimary, cursor: zoom >= 10 ? 'default' : 'pointer', padding: '2px 6px', fontSize: '1.1rem', fontWeight: 'bold' }}>+</button>
                </div>
                <button
                    onClick={() => setFullscreen(f => !f)}
                    title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textSecondary, flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.primary; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                    {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
            </div>
        </div>
    );

    const viewerContent = (
        <>
            {toolbar}
            {tempoWarning && (
                <div style={{ marginBottom: '10px', padding: '8px 14px', borderRadius: borderRadius.sm, backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <span>This project uses tempo automation — the playhead position is approximate and may drift from the audio.</span>
                </div>
            )}
        </>
    );

    if (fullscreen) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 8000, backgroundColor: '#0B0F19', display: 'flex', flexDirection: 'column', padding: isMobile ? '12px' : '20px 24px', overflowY: 'auto' }}>
                {viewerContent}
                <div ref={scrollContainerRef} style={{ flex: 1, overflowX: 'auto', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0a0e14', scrollBehavior: 'smooth', ...timelineGridBg }}>
                    <div style={{ width: timelineWidth, minWidth: '100%', position: 'relative', paddingTop: '28px', paddingBottom: '16px', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', marginLeft: `${labelW}px`, marginBottom: '8px', width: `calc(100% - ${labelW}px)` }}>{beatRuler}</div>
                        {trackRows}
                        <div ref={playheadRef} style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', backgroundColor: tempoWarning ? '#fbbf24' : colors.primary, boxShadow: tempoWarning ? 'none' : `0 0 14px ${colors.primary}99`, opacity: tempoWarning ? 0.5 : 1, pointerEvents: 'none', zIndex: 10, display: 'none', willChange: 'left' }}>
                            <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `6px solid ${tempoWarning ? '#fbbf24' : colors.primary}` }} />
                        </div>
                        {markerElements}
                    </div>
                </div>
                {selectedClip && selectedClip.clip.type === 'pattern' && selectedClip.clip.notes && selectedClip.clip.notes.length > 0 && (
                    <PianoRollModal clip={selectedClip.clip} color={selectedClip.color} onClose={() => setSelectedClip(null)} />
                )}
                {selectedClip && selectedClip.clip.type === 'audio' && (
                    <SampleInfoModal clip={selectedClip.clip} color={selectedClip.color}
                        peaks={(() => { const m = selectedClip.clip.sampleFileName ? samplesMap[selectedClip.clip.sampleFileName.toLowerCase()] : undefined; return (m && m.length > 0) ? m : (selectedClip.clip.peaks && selectedClip.clip.peaks.length > 0) ? selectedClip.clip.peaks : undefined; })()}
                        projectZipUrl={projectZipUrl} trackId={trackId} onClose={() => setSelectedClip(null)} />
                )}
            </div>
        );
    }

    return (
        <div style={{ marginTop: '40px', maxWidth: '100%', overflow: 'hidden' }}>
            {viewerContent}
            <div ref={scrollContainerRef} style={{ overflowX: 'auto', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0a0e14', scrollBehavior: 'smooth', ...timelineGridBg }}>
                <div style={{ width: timelineWidth, minWidth: '100%', position: 'relative', paddingTop: '28px', paddingBottom: '16px', boxSizing: 'border-box' }}>
                    {/* Beat ruler */}
                    <div style={{ display: 'flex', marginLeft: `${labelW}px`, marginBottom: '8px', width: `calc(100% - ${labelW}px)` }}>
                        {beatRuler}
                    </div>
                    {/* Track rows */}
                    {trackRows}
                    {/* Playhead — positioned via rAF, no React re-renders */}
                    <div ref={playheadRef} style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', backgroundColor: tempoWarning ? '#fbbf24' : colors.primary, boxShadow: tempoWarning ? 'none' : `0 0 14px ${colors.primary}99`, opacity: tempoWarning ? 0.5 : 1, pointerEvents: 'none', zIndex: 10, display: 'none', willChange: 'left' }}>
                        <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `6px solid ${tempoWarning ? '#fbbf24' : colors.primary}` }} />
                    </div>
                    {/* Timeline markers */}
                    {markerElements}
                </div>
            </div>
            {selectedClip && selectedClip.clip.type === 'pattern' && selectedClip.clip.notes && selectedClip.clip.notes.length > 0 && (
                <PianoRollModal clip={selectedClip.clip} color={selectedClip.color} onClose={() => setSelectedClip(null)} />
            )}
            {selectedClip && selectedClip.clip.type === 'audio' && (
                <SampleInfoModal clip={selectedClip.clip} color={selectedClip.color}
                    peaks={(() => { const m = selectedClip.clip.sampleFileName ? samplesMap[selectedClip.clip.sampleFileName.toLowerCase()] : undefined; return (m && m.length > 0) ? m : (selectedClip.clip.peaks && selectedClip.clip.peaks.length > 0) ? selectedClip.clip.peaks : undefined; })()}
                    projectZipUrl={projectZipUrl} trackId={trackId} onClose={() => setSelectedClip(null)} />
            )}
        </div>
    );
});

// ── Plugin registry cache (module-level so all panel instances share one fetch) ─

let registryCache: KnownPlugin[] | null = null;
let registryFetch: Promise<KnownPlugin[]> | null = null;

interface KnownPlugin {
    id: string;
    name: string;
    aliases: string[];
    displayName: string | null;
    imageUrl: string | null;
    link: string | null;
    category: string | null;
    developer: string | null;
    description: string | null;
}

export function getRegistry(): Promise<KnownPlugin[]> {
    if (registryCache !== null) return Promise.resolve(registryCache);
    if (!registryFetch) {
        registryFetch = fetch('/api/plugins/registry')
            .then(r => r.ok ? r.json() : [])
            .then(data => { registryCache = data; return data; })
            .catch(() => []);
    }
    return registryFetch;
}

export function matchPlugin(name: string, registry: KnownPlugin[]): KnownPlugin | undefined {
    const lower = name.toLowerCase();
    return registry.find(p =>
        p.name.toLowerCase() === lower ||
        (p.aliases || []).some((a: string) => a.toLowerCase() === lower)
    );
}

// ── Shared hook ──────────────────────────────────────────────────────────────

export function usePluginRegistry(): KnownPlugin[] {
    const [registry, setRegistry] = useState<KnownPlugin[]>(registryCache ?? []);
    useEffect(() => { getRegistry().then(setRegistry); }, []);
    return registry;
}

// ── Deduplicate plugin list (aliases collapse to the same registry entry) ───────

function deduplicatePlugins(names: string[], registry: KnownPlugin[]): Array<{ rawName: string; known: KnownPlugin | undefined }> {
    const seen = new Set<string>();
    const result: Array<{ rawName: string; known: KnownPlugin | undefined }> = [];
    for (const name of names) {
        const known = matchPlugin(name, registry);
        const key = known ? known.id : name.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ rawName: name, known });
        }
    }
    return result;
}

// ── Plugin detail popup ───────────────────────────────────────────────────────

export const PluginModal: React.FC<{ rawName: string; known: KnownPlugin | undefined; onClose: () => void }> = ({ rawName, known, onClose }) => {
    const label = known?.displayName || rawName;
    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: '24px' }}
            onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#13172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', position: 'relative' }}>

                {/* Close button */}
                <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '18px', lineHeight: 1, backdropFilter: 'blur(4px)' }}>×</button>

                {/* Image area — full width, tall, contain with dark bg */}
                <div style={{ width: '100%', height: '260px', backgroundColor: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                    {known?.imageUrl ? (
                        <img src={known.imageUrl} alt={label}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '28px', boxSizing: 'border-box' }} />
                    ) : (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, ${colors.primary}08 0%, transparent 70%)` }} />
                            <span style={{ fontSize: '56px', fontWeight: 900, color: 'rgba(255,255,255,0.08)', letterSpacing: '-0.04em', zIndex: 1 }}>
                                {label.slice(0, 2).toUpperCase()}
                            </span>
                        </>
                    )}
                </div>

                {/* Body */}
                <div style={{ padding: '22px 24px 26px' }}>
                    {/* Name + meta row */}
                    <div style={{ marginBottom: '14px' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>{label}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {known?.developer && (
                                <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{known.developer}</span>
                            )}
                            {known?.developer && known?.category && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>·</span>}
                            {known?.category && (
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '4px', backgroundColor: `${colors.primary}20`, color: colors.primary, border: `1px solid ${colors.primary}35` }}>
                                    {known.category}
                                </span>
                            )}
                        </div>
                    </div>

                    {known?.description && (
                        <p style={{ margin: '0 0 18px', fontSize: '0.875rem', color: colors.textSecondary, lineHeight: 1.7 }}>{known.description}</p>
                    )}

                    {known?.link ? (
                        <a href={known.link} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', backgroundColor: colors.primary, color: '#fff', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem', boxSizing: 'border-box', boxShadow: `0 4px 20px ${colors.primary}45`, letterSpacing: '0.01em' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                            Learn More &amp; Get {label} ↗
                        </a>
                    ) : !known ? (
                        <div style={{ fontSize: '0.82rem', color: colors.textTertiary, textAlign: 'center', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                            This plugin isn't in the registry yet.
                        </div>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── PluginBadge — kept for backward compat, delegates to PluginList internals ─

export const PluginBadge: React.FC<{ name: string; registry: KnownPlugin[]; fallbackStyle?: React.CSSProperties }> = ({ name, registry }) => {
    const [open, setOpen] = useState(false);
    const known = matchPlugin(name, registry);
    const label = known?.displayName || name;
    return (
        <>
            <button onClick={() => setOpen(true)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}>
                <PluginCard rawName={name} known={known} label={label} />
            </button>
            {open && <PluginModal rawName={name} known={known} onClose={() => setOpen(false)} />}
        </>
    );
};

// ── PluginCard — rich visual tile for known plugins ───────────────────────────

const PluginCard: React.FC<{ rawName: string; known: KnownPlugin | undefined; label: string }> = ({ known, label }) => (
    <div style={{
        width: '160px', flexShrink: 0,
        borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
        backgroundColor: '#0d1117',
        border: `1px solid ${known?.imageUrl ? colors.primary + '30' : 'rgba(255,255,255,0.08)'}`,
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}
        onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = 'translateY(-3px)';
            el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.5)`;
            el.style.borderColor = known ? colors.primary + '70' : 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = 'translateY(0)';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            el.style.borderColor = known?.imageUrl ? colors.primary + '30' : 'rgba(255,255,255,0.08)';
        }}
    >
        {/* Image area */}
        <div style={{ width: '160px', height: '140px', backgroundColor: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            {known?.imageUrl ? (
                <img src={known.imageUrl} alt={label}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '12px', boxSizing: 'border-box' }} />
            ) : (
                <>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }} />
                    <span style={{ fontSize: '32px', fontWeight: 900, color: 'rgba(255,255,255,0.12)', letterSpacing: '-0.05em', zIndex: 1 }}>
                        {label.slice(0, 2).toUpperCase()}
                    </span>
                </>
            )}
        </div>

        {/* Info */}
        <div style={{ padding: '10px 12px 12px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E2E8F0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
            {known?.developer && (
                <div style={{ fontSize: '0.7rem', color: colors.textTertiary, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{known.developer}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                {known?.category ? (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: '4px', backgroundColor: `${colors.primary}18`, color: colors.primary }}>
                        {known.category}
                    </span>
                ) : <span />}
                {known?.link && (
                    <span style={{ fontSize: '0.68rem', color: colors.primary, fontWeight: 600 }}>View ↗</span>
                )}
            </div>
        </div>
    </div>
);

// ── PluginList — deduplicated, known cards + unknown badges ───────────────────

export const PluginList: React.FC<{ plugins: string[]; registry: KnownPlugin[] }> = ({ plugins, registry }) => {
    const [active, setActive] = useState<{ rawName: string; known: KnownPlugin | undefined } | null>(null);
    const deduped = useMemo(() => deduplicatePlugins(plugins, registry), [plugins, registry]);

    const known = deduped.filter(p => p.known);
    const unknown = deduped.filter(p => !p.known);

    return (
        <>
            {/* Known plugins — rich cards */}
            {known.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: unknown.length > 0 ? '16px' : 0 }}>
                    {known.map(({ rawName, known: k }) => (
                        <button key={k!.id} onClick={() => setActive({ rawName, known: k })}
                            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}>
                            <PluginCard rawName={rawName} known={k} label={k!.displayName || rawName} />
                        </button>
                    ))}
                </div>
            )}

            {/* Unknown plugins — compact badges */}
            {unknown.length > 0 && (
                <div>
                    {known.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: colors.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                            Other Plugins
                        </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {unknown.map(({ rawName }) => (
                            <button key={rawName} onClick={() => setActive({ rawName, known: undefined })}
                                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                                <span style={{ display: 'block', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', transition: 'background-color 0.15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.09)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}>
                                    {rawName}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {active && <PluginModal rawName={active.rawName} known={active.known} onClose={() => setActive(null)} />}
        </>
    );
};

// ── ProjectInfoPanel ──────────────────────────────────────────────────────────

export const ProjectInfoPanel: React.FC<{ projectInfo: ProjectInfo }> = ({ projectInfo }) => {
    const registry = usePluginRegistry();

    return (
        <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Layers size={20} color={colors.primary} />
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Project Details</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {projectInfo.plugins.length > 0 && (
                    <div style={{ backgroundColor: '#0d1117', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Zap size={16} color={colors.primary} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plugins ({projectInfo.plugins.length})</span>
                        </div>
                        <PluginList plugins={projectInfo.plugins} registry={registry} />
                    </div>
                )}
                {projectInfo.samples.length > 0 && (
                    <div style={{ backgroundColor: '#0d1117', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <FileAudio size={16} color={colors.primary} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Samples ({projectInfo.samples.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {projectInfo.samples.map((sample, i) => (
                                <span key={i} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#CBD5E1', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
