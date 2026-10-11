/**
 * Image Vectoriser — admin-only staff tool.
 *
 * Upload a bitmap, trace it to SVG (VTracer, server-side), compare against the
 * original and download the result. Deliberately not linked anywhere on the
 * public site.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Shapes, Upload, Download, Copy, Check, RotateCcw, AlertCircle, Loader, Eraser, Undo2 } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = import.meta.env.VITE_API_URL ?? '';
const MAX_MB = 25;

type Mode = 'colour' | 'bw';
type Detail = 'low' | 'balanced' | 'high';

interface Result {
    svg: string;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
    paths: number;
    bytes: number;
    ms: number;
}

/** One traced shape, pulled out of the SVG so it can be shown and removed individually. */
interface Shape {
    d: string;
    fill: string;
    transform: string | null;
}

/** Reads the tracer's flat list of <path> elements. Parsed as XML, never injected as HTML. */
function parseShapes(svg: string): Shape[] {
    try {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        if (doc.querySelector('parsererror')) return [];
        return [...doc.querySelectorAll('path')].map(p => ({
            d: p.getAttribute('d') || '',
            fill: p.getAttribute('fill') || '#000000',
            transform: p.getAttribute('transform'),
        })).filter(s => s.d);
    } catch {
        return [];
    }
}

function buildSvg(shapes: Shape[], width: number, height: number): string {
    const body = shapes
        .map(s => `<path d="${s.d}" fill="${s.fill}"${s.transform ? ` transform="${s.transform}"` : ''}/>`)
        .join('\n');
    // viewBox added so the exported file scales cleanly; the tracer only sets width/height.
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`;
}

const fmtBytes = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export const VectoriserPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>('colour');
    const [detail, setDetail] = useState<Detail>('balanced');
    const [maxSize, setMaxSize] = useState(1600);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Editing state: every traced shape, which ones are dropped, and enough history to undo.
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [removed, setRemoved] = useState<Set<number>>(new Set());
    const [history, setHistory] = useState<Set<number>[]>([]);
    const [hovered, setHovered] = useState<number | null>(null);

    const kept = shapes.filter((_, i) => !removed.has(i));
    const currentSvg = result ? buildSvg(kept, result.width, result.height) : '';

    const drop = (next: Set<number>) => {
        setHistory(h => [...h.slice(-29), new Set(removed)]);
        setRemoved(next);
    };
    const undo = () => {
        setHistory(h => {
            if (h.length === 0) return h;
            setRemoved(h[h.length - 1]);
            return h.slice(0, -1);
        });
    };
    const restoreAll = () => { if (removed.size) drop(new Set()); };
    const toggleShape = (i: number) => { const n = new Set(removed); n.add(i); drop(n); };
    const dropColour = (fill: string) => {
        const n = new Set(removed);
        shapes.forEach((s, i) => { if (s.fill.toLowerCase() === fill.toLowerCase()) n.add(i); });
        drop(n);
    };
    /** The background is the shape that covers (near enough) the whole canvas — usually the first. */
    const backgroundIndex = (() => {
        if (!result) return -1;
        const area = result.width * result.height;
        for (let i = 0; i < Math.min(shapes.length, 3); i++) {
            const nums = (shapes[i].d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
            const xs = nums.filter((_, k) => k % 2 === 0);
            const ys = nums.filter((_, k) => k % 2 === 1);
            if (!xs.length || !ys.length) continue;
            const w = Math.max(...xs) - Math.min(...xs);
            const h = Math.max(...ys) - Math.min(...ys);
            if (w * h >= area * 0.85) return i;
        }
        return -1;
    })();

    /** Distinct fills, most-used first, for removing a whole colour at once. */
    const palette = (() => {
        const counts = new Map<string, number>();
        shapes.forEach((s, i) => { if (!removed.has(i)) counts.set(s.fill, (counts.get(s.fill) || 0) + 1); });
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    })();

    // Object URLs are revoked on replacement so previews don't pile up in memory.
    useEffect(() => () => { if (originalUrl) URL.revokeObjectURL(originalUrl); }, [originalUrl]);

    const choose = useCallback((f: File) => {
        if (!f.type.startsWith('image/')) { setError('That isn’t an image. Use PNG, JPG, GIF or WEBP.'); return; }
        if (f.size > MAX_MB * 1024 * 1024) { setError(`That image is over the ${MAX_MB} MB limit.`); return; }
        setError('');
        setResult(null);
        setShapes([]);
        setRemoved(new Set());
        setHistory([]);
        setOriginalUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
        setFile(f);
    }, []);

    const run = async () => {
        if (!file) return;
        setBusy(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('mode', mode);
            fd.append('detail', detail);
            fd.append('maxSize', String(maxSize));
            const { data } = await axios.post<Result>(`${API}/api/admin/vectorize`, fd, { withCredentials: true });
            setResult(data);
            setShapes(parseShapes(data.svg));
            setRemoved(new Set());
            setHistory([]);
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Could not vectorise that image.');
        } finally {
            setBusy(false);
        }
    };

    const download = () => {
        if (!result) return;
        const url = URL.createObjectURL(new Blob([currentSvg], { type: 'image/svg+xml' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(file?.name || 'image').replace(/\.[^.]+$/, '')}.svg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const copy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(currentSvg);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { setError('Could not copy — your browser blocked clipboard access.'); }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setShapes([]);
        setRemoved(new Set());
        setHistory([]);
        setError('');
        setOriginalUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };

    const card: React.CSSProperties = { background: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, border: '1px solid rgba(255,255,255,0.06)' };
    const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: spacing.sm };

    const segmented = <T extends string>(value: T, set: (v: T) => void, options: [T, string][]) => (
        <div style={{ display: 'flex', gap: 4, background: colors.background, padding: 4, borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)' }}>
            {options.map(([v, text]) => (
                <button key={v} onClick={() => set(v)}
                    style={{
                        flex: 1, padding: '8px 10px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: 700,
                        background: value === v ? colors.primary : 'transparent',
                        color: value === v ? '#fff' : colors.textSecondary,
                    }}>
                    {text}
                </button>
            ))}
        </div>
    );

    const preview = (title: string, src: string | null, caption: string, checker: boolean) => (
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ ...label, marginBottom: spacing.sm }}>{title}</div>
            <div style={{
                borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
                height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checker
                    ? 'repeating-conic-gradient(#1b1f2b 0% 25%, #141821 0% 50%) 50% / 18px 18px'
                    : colors.background,
            }}>
                {src
                    ? <img src={src} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    : <span style={{ color: colors.textTertiary, fontSize: '0.85rem' }}>—</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.textTertiary, marginTop: 6 }}>{caption}</div>
        </div>
    );

    return (
        <div style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Shapes size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Image Vectoriser</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Trace a bitmap into a clean, infinitely scalable SVG.</p>
                </div>
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Works best on logos, icons and flat artwork. Photographs will trace, but produce large files with hundreds of shapes.
                    Nothing here is published — images are traced and handed straight back to you.
                </p>
            </div>

            <div style={{ ...card, marginBottom: spacing.lg }}>
                {/* Drop zone */}
                <div
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) choose(f); }}
                    style={{
                        border: `2px dashed ${dragging ? colors.primary : 'rgba(255,255,255,0.15)'}`,
                        background: dragging ? 'rgba(242,120,10,0.06)' : colors.background,
                        borderRadius: borderRadius.md, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                    }}>
                    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) choose(f); e.target.value = ''; }} />
                    <Upload size={26} color={file ? colors.primary : colors.textTertiary} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.95rem' }}>
                        {file ? file.name : 'Drop an image here, or click to choose'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: colors.textTertiary, marginTop: 4 }}>
                        {file ? `${fmtBytes(file.size)} — click to replace` : `PNG, JPG, GIF or WEBP · up to ${MAX_MB} MB`}
                    </div>
                </div>

                {/* Options */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing.lg, marginTop: spacing.lg }}>
                    <div>
                        <span style={label}>Colour</span>
                        {segmented<Mode>(mode, setMode, [['colour', 'Full colour'], ['bw', 'Black & white']])}
                    </div>
                    <div>
                        <span style={label}>Detail</span>
                        {segmented<Detail>(detail, setDetail, [['low', 'Simple'], ['balanced', 'Balanced'], ['high', 'Fine']])}
                    </div>
                    <div>
                        <span style={label}>Trace at</span>
                        <select value={maxSize} onChange={e => setMaxSize(Number(e.target.value))}
                            style={{ width: '100%', background: colors.background, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, padding: '10px 12px', color: colors.textPrimary, fontSize: '0.9rem' }}>
                            <option value={1000}>Up to 1000px — fastest</option>
                            <option value={1600}>Up to 1600px — recommended</option>
                            <option value={2400}>Up to 2400px</option>
                            <option value={4000}>Up to 4000px — slowest</option>
                        </select>
                    </div>
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.error, fontSize: '0.85rem', marginTop: spacing.md }}>
                        <AlertCircle size={15} /> {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.lg, flexWrap: 'wrap' }}>
                    <button onClick={run} disabled={!file || busy}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 700, fontSize: '0.9rem', cursor: (!file || busy) ? 'not-allowed' : 'pointer', opacity: (!file || busy) ? 0.55 : 1 }}>
                        {busy ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Tracing…</> : <><Shapes size={15} /> Vectorise</>}
                    </button>
                    {(file || result) && (
                        <button onClick={reset}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                            <RotateCcw size={15} /> Start over
                        </button>
                    )}
                </div>
            </div>

            {/* Before / after */}
            {(originalUrl || result) && (
                <div style={card}>
                    <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
                        {preview('Original', originalUrl,
                            result ? `${result.sourceWidth} × ${result.sourceHeight} · ${file ? fmtBytes(file.size) : ''}` : (file ? fmtBytes(file.size) : ''), false)}

                        {/* Vector — each shape is clickable so parts can be taken out */}
                        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                            <div style={{ ...label, marginBottom: spacing.sm }}>Vector {result && <span style={{ textTransform: 'none', letterSpacing: 0, color: colors.textTertiary, fontWeight: 500 }}>— click a shape to remove it</span>}</div>
                            <div style={{
                                borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
                                height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'repeating-conic-gradient(#1b1f2b 0% 25%, #141821 0% 50%) 50% / 18px 18px',
                            }}>
                                {result && shapes.length > 0 ? (
                                    <svg viewBox={`0 0 ${result.width} ${result.height}`} style={{ maxWidth: '100%', maxHeight: '100%' }}>
                                        {shapes.map((s, i) => removed.has(i) ? null : (
                                            <path key={i} d={s.d} fill={s.fill} transform={s.transform || undefined}
                                                onClick={() => toggleShape(i)}
                                                onMouseEnter={() => setHovered(i)}
                                                onMouseLeave={() => setHovered(h => (h === i ? null : h))}
                                                style={{ cursor: 'pointer', opacity: hovered === i ? 0.25 : 1, transition: 'opacity 0.1s' }} />
                                        ))}
                                    </svg>
                                ) : <span style={{ color: colors.textTertiary, fontSize: '0.85rem' }}>Not traced yet</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: colors.textTertiary, marginTop: 6 }}>
                                {result
                                    ? `${result.width} × ${result.height} · ${kept.length} of ${shapes.length} shapes · ${fmtBytes(new Blob([currentSvg]).size)} · traced in ${(result.ms / 1000).toFixed(1)}s`
                                    : 'Not traced yet'}
                            </div>
                        </div>
                    </div>

                    {/* Editing tools */}
                    {result && shapes.length > 0 && (
                        <div style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button onClick={() => backgroundIndex >= 0 && toggleShape(backgroundIndex)}
                                    disabled={backgroundIndex < 0 || removed.has(backgroundIndex)}
                                    title={backgroundIndex < 0 ? 'No full-canvas background shape found' : 'Remove the shape covering the whole canvas'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '0.85rem', cursor: (backgroundIndex < 0 || removed.has(backgroundIndex)) ? 'not-allowed' : 'pointer', opacity: (backgroundIndex < 0 || removed.has(backgroundIndex)) ? 0.45 : 1 }}>
                                    <Eraser size={14} /> Remove background
                                </button>
                                <button onClick={undo} disabled={history.length === 0}
                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '0.85rem', cursor: history.length ? 'pointer' : 'not-allowed', opacity: history.length ? 1 : 0.45 }}>
                                    <Undo2 size={14} /> Undo
                                </button>
                                <button onClick={restoreAll} disabled={removed.size === 0}
                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '0.85rem', cursor: removed.size ? 'pointer' : 'not-allowed', opacity: removed.size ? 1 : 0.45 }}>
                                    <RotateCcw size={14} /> Restore all
                                </button>
                                {removed.size > 0 && (
                                    <span style={{ fontSize: '0.8rem', color: colors.textTertiary }}>{removed.size} removed</span>
                                )}
                            </div>

                            <div style={{ marginTop: spacing.lg }}>
                                <span style={label}>Remove a whole colour</span>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {palette.map(([fill, count]) => (
                                        <button key={fill} onClick={() => dropColour(fill)} title={`Remove all ${count} ${fill} shape${count > 1 ? 's' : ''}`}
                                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px 6px 6px', background: colors.background, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, cursor: 'pointer', color: colors.textSecondary, fontSize: '0.78rem', fontWeight: 600 }}>
                                            <span style={{ width: 18, height: 18, borderRadius: '50%', background: fill, border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                                            {fill} <span style={{ color: colors.textTertiary }}>×{count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.lg, flexWrap: 'wrap' }}>
                            <button onClick={download}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                                <Download size={15} /> Download SVG
                            </button>
                            <button onClick={copy}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                                {copied ? <><Check size={15} color={colors.success} /> Copied</> : <><Copy size={15} /> Copy SVG code</>}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
