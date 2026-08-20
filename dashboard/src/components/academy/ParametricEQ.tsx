/**
 * ParametricEQ — an emulation of Fruity Parametric EQ 2.
 *
 * Seven bands over a log-frequency display: a live spectrum analyser behind, each
 * band's own faint curve, and the combined response on top. Band points are
 * draggable (X = frequency, Y = gain, wheel = Q), and the bottom strip mirrors
 * FL's per-band Freq / Gain / Width readouts.
 *
 * The curve is drawn from the band settings via eqMath rather than from the audio
 * nodes, so it's correct before the AudioContext exists. The analyser is the only
 * part that needs live audio, and it simply draws nothing until playback starts.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDAWStore } from './DAWStore';
import { EQBand, EQBandType } from './AudioEngine';
import { daw, dawFx, dawFont } from './dawTheme';
import {
    totalResponseDb, bandResponseDb,
    freqToRatio, ratioToFreq, dbToRatio, ratioToDb,
    EQ_GRID_FREQS, EQ_DB_RANGE, EQ_MIN_FREQ, EQ_MAX_FREQ,
    formatFreq, DISPLAY_SAMPLE_RATE,
} from './eqMath';

const GRAPH_H = 210;
const BAND_COLORS = ['#e0603c', '#e0913c', '#d6c840', '#6fc04a', '#48b6c0', '#5a7fd0', '#a86fd0'];

const BAND_TYPES: { value: EQBandType; label: string }[] = [
    { value: 'peaking', label: 'Peaking' },
    { value: 'lowshelf', label: 'Low shelf' },
    { value: 'highshelf', label: 'High shelf' },
    { value: 'lowpass', label: 'Low pass' },
    { value: 'highpass', label: 'High pass' },
    { value: 'bandpass', label: 'Band pass' },
    { value: 'notch', label: 'Notch' },
];

interface ParametricEQProps {
    insertId: number;
    onClose?: () => void;
    /** Band index a lesson wants emphasised, or null */
    highlightBand?: number | null;
}

export const ParametricEQ: React.FC<ParametricEQProps> = ({ insertId, onClose, highlightBand }) => {
    const insert = useDAWStore(s => s.state.mixerInserts.find(i => i.id === insertId));
    const setEQBand = useDAWStore(s => s.setEQBand);
    const engine = useDAWStore(s => s.engine);
    const playing = useDAWStore(s => s.state.transport.playing);

    const [selected, setSelected] = useState(0);
    const [dragBand, setDragBand] = useState<number | null>(null);
    const graphRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const bands = insert?.eqBands ?? [];

    // ── Spectrum analyser ──
    // Only runs while audio is actually playing; otherwise the canvas is cleared and
    // the rAF loop is torn down rather than spinning on a silent buffer.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;

        const analyser = engine?.getAnalyser(insertId) ?? null;
        if (!analyser || !playing) {
            ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const bins = new Uint8Array(analyser.frequencyBinCount);
        const sampleRate = engine?.audioContext?.sampleRate ?? DISPLAY_SAMPLE_RATE;
        let raf = 0;

        const draw = () => {
            const { width: w, height: h } = canvas;
            analyser.getByteFrequencyData(bins);
            ctx2d.clearRect(0, 0, w, h);
            ctx2d.beginPath();
            ctx2d.moveTo(0, h);
            // Bins are linear in frequency but the display is logarithmic, so walk the
            // display in pixels and sample the bin that lands on each column.
            for (let x = 0; x <= w; x++) {
                const freq = ratioToFreq(x / w);
                const bin = Math.round((freq / (sampleRate / 2)) * bins.length);
                const v = bins[Math.max(0, Math.min(bins.length - 1, bin))] / 255;
                ctx2d.lineTo(x, h - v * h);
            }
            ctx2d.lineTo(w, h);
            ctx2d.closePath();
            ctx2d.fillStyle = 'rgba(128, 192, 64, 0.16)';
            ctx2d.fill();
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [engine, insertId, playing]);

    // ── Band dragging ──
    const applyPointer = useCallback((bandIdx: number, clientX: number, clientY: number) => {
        const el = graphRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const freq = ratioToFreq((clientX - r.left) / r.width);
        const db = ratioToDb((clientY - r.top) / r.height);
        setEQBand(insertId, bandIdx, {
            freq: Math.round(Math.max(EQ_MIN_FREQ, Math.min(EQ_MAX_FREQ, freq))),
            gain: Math.max(-EQ_DB_RANGE, Math.min(EQ_DB_RANGE, Math.round(db * 10) / 10)),
        });
    }, [insertId, setEQBand]);

    useEffect(() => {
        if (dragBand === null) return;
        const move = (e: PointerEvent) => applyPointer(dragBand, e.clientX, e.clientY);
        const up = () => setDragBand(null);
        // Listeners go on window, not the point itself, so a fast drag that outruns
        // the cursor doesn't drop the gesture.
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
    }, [dragBand, applyPointer]);

    if (!insert) return null;

    const sel = bands[selected];

    // ── Curve paths ──
    const CURVE_STEPS = 160;
    const buildPath = (fn: (freq: number) => number) => {
        let d = '';
        for (let i = 0; i <= CURVE_STEPS; i++) {
            const ratio = i / CURVE_STEPS;
            const x = ratio * 100;
            const y = Math.max(0, Math.min(100, dbToRatio(fn(ratioToFreq(ratio))) * 100));
            d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
        }
        return d;
    };
    const totalPath = buildPath(f => totalResponseDb(bands, f));

    return (
        <div style={{
            background: daw.bg,
            border: `1px solid ${daw.border}`,
            borderRadius: 4,
            fontFamily: dawFont.sans,
            color: daw.text,
            overflow: 'hidden',
            boxShadow: dawFx.windowShadow,
        }}>
            {/* Title bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 28, padding: '0 10px',
                background: daw.dark, borderBottom: `1px solid ${daw.border}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: 'radial-gradient(circle at 35% 30%, #F2A93B, #BE5A16)',
                    }} />
                    <span style={{ fontSize: 12, color: daw.textBright, fontWeight: 600 }}>
                        Fruity Parametric EQ 2
                    </span>
                    <span style={{ fontSize: 11, color: daw.textDim }}>— {insert.label}</span>
                </div>
                {onClose && (
                    <button onClick={onClose} title="Close"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
                        <X size={14} color={daw.text} />
                    </button>
                )}
            </div>

            {/* Graph */}
            <div
                ref={graphRef}
                data-academy-id={`eq-graph-${insertId}`}
                style={{
                    position: 'relative', height: GRAPH_H,
                    background: daw.well,
                    boxShadow: dawFx.innerShadowWell,
                    cursor: dragBand !== null ? 'grabbing' : 'crosshair',
                    touchAction: 'none',
                }}>
                {/* Spectrum analyser */}
                <canvas ref={canvasRef} width={800} height={GRAPH_H}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

                {/* Grid + curves */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    {EQ_GRID_FREQS.map(f => (
                        <line key={f}
                            x1={freqToRatio(f) * 100} x2={freqToRatio(f) * 100} y1="0" y2="100"
                            stroke={daw.border} strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
                    ))}
                    {[-12, -6, 0, 6, 12].map(db => (
                        <line key={db}
                            x1="0" x2="100" y1={dbToRatio(db) * 100} y2={dbToRatio(db) * 100}
                            stroke={db === 0 ? daw.textDim : daw.border}
                            strokeWidth={db === 0 ? 0.3 : 0.15} vectorEffect="non-scaling-stroke" />
                    ))}

                    {/* Each band's own contribution, faint */}
                    {bands.map((b, i) => b.enabled && (
                        <path key={i} d={buildPath(f => bandResponseDb(b, f))}
                            fill="none" stroke={BAND_COLORS[i]} strokeOpacity={0.35}
                            strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    ))}

                    {/* Combined response */}
                    <path d={totalPath} fill="none" stroke={daw.green}
                        strokeWidth="1.8" vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round" />
                </svg>

                {/* Frequency labels */}
                {EQ_GRID_FREQS.map(f => (
                    <span key={f} style={{
                        position: 'absolute', left: `${freqToRatio(f) * 100}%`, bottom: 2,
                        transform: 'translateX(-50%)',
                        fontSize: 9, color: daw.textDim, fontFamily: dawFont.mono,
                        pointerEvents: 'none',
                    }}>{formatFreq(f)}</span>
                ))}

                {/* Band handles */}
                {bands.map((b, i) => {
                    const isSel = i === selected;
                    const isHl = highlightBand === i;
                    return (
                        <div
                            key={i}
                            data-academy-id={`eq-band-${insertId}-${i}`}
                            title={`Band ${i + 1} — ${formatFreq(b.freq)}Hz, ${b.gain > 0 ? '+' : ''}${b.gain.toFixed(1)}dB`}
                            onPointerDown={e => {
                                e.preventDefault();
                                setSelected(i);
                                setDragBand(i);
                            }}
                            onWheel={e => {
                                // Wheel adjusts Q (FL calls it width), like the real plugin
                                const next = Math.max(0.1, Math.min(18, b.q * (e.deltaY > 0 ? 0.9 : 1.1)));
                                setEQBand(insertId, i, { q: Math.round(next * 100) / 100 });
                            }}
                            style={{
                                position: 'absolute',
                                left: `${freqToRatio(b.freq) * 100}%`,
                                top: `${dbToRatio(b.gain) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                width: isSel ? 14 : 11, height: isSel ? 14 : 11,
                                borderRadius: '50%',
                                background: b.enabled ? BAND_COLORS[i] : daw.highlight,
                                border: `1.5px solid ${isHl ? daw.green : b.enabled ? '#0009' : daw.textDim}`,
                                boxShadow: isHl
                                    ? `0 0 0 3px ${daw.green}, 0 0 12px ${daw.green}`
                                    : isSel ? '0 0 6px rgba(0,0,0,0.6)' : 'none',
                                cursor: 'grab',
                                opacity: b.enabled ? 1 : 0.5,
                                zIndex: isSel ? 3 : 2,
                            }}
                        />
                    );
                })}
            </div>

            {/* Per-band controls */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', background: daw.panel,
                borderTop: `1px solid ${daw.border}`, flexWrap: 'wrap',
            }}>
                {/* Band selector */}
                <div style={{ display: 'flex', gap: 3 }}>
                    {bands.map((b, i) => (
                        <button key={i}
                            onClick={() => setSelected(i)}
                            data-academy-id={`eq-bandbtn-${insertId}-${i}`}
                            title={`Band ${i + 1}`}
                            style={{
                                width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
                                fontSize: 10, fontFamily: dawFont.mono, fontWeight: 700,
                                background: i === selected ? BAND_COLORS[i] : daw.dark,
                                color: i === selected ? '#000' : daw.text,
                                border: `1px solid ${highlightBand === i ? daw.green : daw.border}`,
                                boxShadow: highlightBand === i ? `0 0 8px ${daw.green}` : 'none',
                                opacity: b.enabled ? 1 : 0.45,
                                padding: 0,
                            }}>
                            {i + 1}
                        </button>
                    ))}
                </div>

                {sel && (
                    <>
                        <Readout label="FREQ" value={`${formatFreq(sel.freq)}Hz`} />
                        <Readout label="GAIN" value={`${sel.gain > 0 ? '+' : ''}${sel.gain.toFixed(1)}dB`} />
                        <Readout label="WIDTH" value={sel.q.toFixed(2)} />

                        <select
                            value={sel.type}
                            onChange={e => setEQBand(insertId, selected, { type: e.target.value as EQBandType })}
                            data-academy-id={`eq-bandtype-${insertId}`}
                            style={{
                                background: daw.well, color: daw.textBright,
                                border: `1px solid ${daw.border}`, borderRadius: 3,
                                fontSize: 11, padding: '3px 6px', outline: 'none',
                                fontFamily: dawFont.sans,
                            }}>
                            {BAND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>

                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, cursor: 'pointer',
                        }}>
                            <input type="checkbox" checked={sel.enabled}
                                onChange={e => setEQBand(insertId, selected, { enabled: e.target.checked })} />
                            On
                        </label>

                        <button
                            onClick={() => setEQBand(insertId, selected, { gain: 0 })}
                            title="Reset this band's gain to 0 dB"
                            style={{
                                marginLeft: 'auto',
                                background: daw.dark, color: daw.text,
                                border: `1px solid ${daw.border}`, borderRadius: 3,
                                fontSize: 11, padding: '4px 10px', cursor: 'pointer',
                            }}>
                            Reset gain
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const Readout: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 62 }}>
        <span style={{
            fontSize: 9, color: daw.textDim, fontFamily: dawFont.mono,
            letterSpacing: '0.08em', fontWeight: 700,
        }}>{label}</span>
        <span style={{
            fontSize: 12, color: daw.green, fontFamily: dawFont.mono,
            background: daw.well, border: `1px solid ${daw.border}`,
            borderRadius: 2, padding: '2px 6px', textAlign: 'center',
        }}>{value}</span>
    </div>
);
