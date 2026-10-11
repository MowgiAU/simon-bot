/**
 * Image Vectoriser — admin-only staff tool.
 *
 * Upload a bitmap, trace it to SVG (VTracer, server-side), compare against the
 * original and download the result. Deliberately not linked anywhere on the
 * public site.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Shapes, Upload, Download, Copy, Check, RotateCcw, AlertCircle, Loader } from 'lucide-react';
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

const fmtBytes = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export const VectoriserPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>('colour');
    const [detail, setDetail] = useState<Detail>('balanced');
    const [maxSize, setMaxSize] = useState(1600);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [svgUrl, setSvgUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Object URLs are revoked on replacement so previews don't pile up in memory.
    useEffect(() => () => { if (originalUrl) URL.revokeObjectURL(originalUrl); }, [originalUrl]);
    useEffect(() => () => { if (svgUrl) URL.revokeObjectURL(svgUrl); }, [svgUrl]);

    const choose = useCallback((f: File) => {
        if (!f.type.startsWith('image/')) { setError('That isn’t an image. Use PNG, JPG, GIF or WEBP.'); return; }
        if (f.size > MAX_MB * 1024 * 1024) { setError(`That image is over the ${MAX_MB} MB limit.`); return; }
        setError('');
        setResult(null);
        setSvgUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
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
            const blob = new Blob([data.svg], { type: 'image/svg+xml' });
            setSvgUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Could not vectorise that image.');
        } finally {
            setBusy(false);
        }
    };

    const download = () => {
        if (!result || !svgUrl) return;
        const a = document.createElement('a');
        a.href = svgUrl;
        a.download = `${(file?.name || 'image').replace(/\.[^.]+$/, '')}.svg`;
        a.click();
    };

    const copy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.svg);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { setError('Could not copy — your browser blocked clipboard access.'); }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError('');
        setOriginalUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        setSvgUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
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
                        {preview('Vector', svgUrl,
                            result ? `${result.width} × ${result.height} · ${result.paths} shapes · ${fmtBytes(result.bytes)} · traced in ${(result.ms / 1000).toFixed(1)}s` : 'Not traced yet', true)}
                    </div>

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
