import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Headphones, Layers } from 'lucide-react';
import { colors, spacing, borderRadius, typography } from '../theme/theme';

export interface StemData {
    id: string;
    label: string;
    url: string;
    mp3Url: string | null;
    peaks: number[] | null;
    duration: number | null;
}

interface ChannelUiState {
    muted: boolean;
    solo: boolean;
    volume: number; // 0..1
}

const canPlayOgg = (() => {
    try { return new Audio().canPlayType('audio/ogg; codecs=opus') !== ''; }
    catch { return false; }
})();

const pickStemUrl = (stem: StemData): string => {
    if (canPlayOgg) return stem.url || stem.mp3Url || '';
    return stem.mp3Url || stem.url || '';
};

const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

// Bar-based waveform — downsamples peaks to a fixed bar count and fills bars
// up to the playhead progress, matching the visual language used elsewhere
// (e.g. MiniWaveform in ArticleEmbeds.tsx).
const StemWaveform: React.FC<{ peaks: number[] | null; progress: number; color: string; height?: number }> = ({ peaks, progress, color, height = 40 }) => {
    const bars = 120;
    const sampled = useMemo(() => {
        if (!peaks || peaks.length === 0) return new Array(bars).fill(0.15);
        const step = Math.max(1, Math.floor(peaks.length / bars));
        return Array.from({ length: bars }, (_, i) => peaks[Math.min(i * step, peaks.length - 1)] || 0);
    }, [peaks]);
    const max = Math.max(...sampled, 0.01);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: `${height}px`, flex: 1, minWidth: 0 }}>
            {sampled.map((v, i) => {
                const h = Math.max(2, (v / max) * height);
                const filled = i / bars < progress;
                return (
                    <div
                        key={i}
                        style={{
                            width: '100%',
                            height: `${h}px`,
                            borderRadius: '1px',
                            background: filled ? color : colors.glassBorder,
                            transition: 'background 0.08s linear',
                        }}
                    />
                );
            })}
        </div>
    );
};

interface EngineChannel {
    id: string;
    buffer: AudioBuffer | null;
    gain: GainNode;
    source: AudioBufferSourceNode | null;
    error: boolean;
}

/**
 * Synced multi-stem mixer. Plays back several individually-rendered audio
 * stems in lockstep using the Web Audio API (AudioContext + per-stem GainNode),
 * with independent mute/solo/volume controls — something the site's global
 * single-<audio> PlayerProvider cannot do.
 */
export const StemsMixer: React.FC<{ stems: StemData[]; trackTitle: string }> = ({ stems, trackTitle }) => {
    const ctxRef = useRef<AudioContext | null>(null);
    const channelsRef = useRef<Map<string, EngineChannel>>(new Map());
    const startCtxTimeRef = useRef(0);   // audioContext.currentTime when playback last (re)started
    const startOffsetRef = useRef(0);    // playback position (seconds) at that start
    const rafRef = useRef<number | null>(null);
    const isPlayingRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [ui, setUi] = useState<Record<string, ChannelUiState>>(() =>
        Object.fromEntries(stems.map(s => [s.id, { muted: false, solo: false, volume: 1 }]))
    );
    const uiRef = useRef(ui);
    uiRef.current = ui;

    const anySolo = useMemo(() => Object.values(ui).some(c => c.solo), [ui]);

    // Compute the audible gain for a channel given current mute/solo/volume state
    const effectiveGain = useCallback((id: string): number => {
        const c = uiRef.current[id];
        if (!c) return 1;
        if (c.muted) return 0;
        if (anySolo && !c.solo) return 0;
        return c.volume;
    }, [anySolo]);

    // Apply gain values to all live GainNodes (called whenever mute/solo/volume changes)
    const applyGains = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        for (const [id, ch] of channelsRef.current) {
            ch.gain.gain.setTargetAtTime(effectiveGain(id), ctx.currentTime, 0.01);
        }
    }, [effectiveGain]);

    useEffect(() => { applyGains(); }, [ui, applyGains]);

    // ── Load + decode all stems into AudioBuffers ─────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AudioCtx();
        ctxRef.current = ctx;
        setLoading(true);
        setLoadError(null);

        (async () => {
            try {
                let maxDuration = 0;
                for (const stem of stems) {
                    const url = pickStemUrl(stem);
                    const gain = ctx.createGain();
                    gain.connect(ctx.destination);
                    const channel: EngineChannel = { id: stem.id, buffer: null, gain, source: null, error: false };
                    channelsRef.current.set(stem.id, channel);

                    if (!url) { channel.error = true; continue; }
                    try {
                        const res = await fetch(url);
                        const arrayBuffer = await res.arrayBuffer();
                        if (cancelled) return;
                        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                        if (cancelled) return;
                        channel.buffer = audioBuffer;
                        maxDuration = Math.max(maxDuration, audioBuffer.duration);
                    } catch {
                        channel.error = true;
                    }
                }
                if (cancelled) return;
                setDuration(maxDuration);
                setLoading(false);
            } catch (e: any) {
                if (!cancelled) {
                    setLoadError('Failed to load stems for playback.');
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            isPlayingRef.current = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            for (const ch of channelsRef.current.values()) {
                try { ch.source?.stop(); } catch {}
                try { ch.gain.disconnect(); } catch {}
            }
            channelsRef.current.clear();
            ctx.close().catch(() => {});
            ctxRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stems.map(s => s.id).join(',')]);

    // ── Playback engine ────────────────────────────────────────────────────────
    const stopSources = useCallback(() => {
        for (const ch of channelsRef.current.values()) {
            if (ch.source) {
                try { ch.source.stop(); } catch {}
                ch.source.disconnect();
                ch.source = null;
            }
        }
    }, []);

    const startPlaybackFrom = useCallback((offset: number) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        stopSources();
        const startAt = ctx.currentTime + 0.05; // small lookahead so all sources start in sync
        for (const ch of channelsRef.current.values()) {
            if (!ch.buffer) continue;
            if (offset >= ch.buffer.duration) continue;
            const source = ctx.createBufferSource();
            source.buffer = ch.buffer;
            source.connect(ch.gain);
            source.start(startAt, offset);
            ch.source = source;
        }
        startCtxTimeRef.current = startAt;
        startOffsetRef.current = offset;
        applyGains();
    }, [stopSources, applyGains]);

    const tick = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx || !isPlayingRef.current) return;
        const elapsed = Math.max(0, ctx.currentTime - startCtxTimeRef.current);
        const t = startOffsetRef.current + elapsed;
        if (t >= duration) {
            setCurrentTime(duration);
            setIsPlaying(false);
            isPlayingRef.current = false;
            stopSources();
            startOffsetRef.current = duration;
            return;
        }
        setCurrentTime(t);
        rafRef.current = requestAnimationFrame(tick);
    }, [duration, stopSources]);

    const play = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx || loading) return;
        if (ctx.state === 'suspended') ctx.resume();
        const offset = currentTime >= duration ? 0 : currentTime;
        startPlaybackFrom(offset);
        isPlayingRef.current = true;
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
    }, [loading, currentTime, duration, startPlaybackFrom, tick]);

    const pause = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const elapsed = Math.max(0, ctx.currentTime - startCtxTimeRef.current);
        const t = Math.min(duration, startOffsetRef.current + elapsed);
        isPlayingRef.current = false;
        setIsPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        stopSources();
        setCurrentTime(t);
        startOffsetRef.current = t;
    }, [duration, stopSources]);

    const togglePlay = useCallback(() => {
        if (isPlayingRef.current) pause(); else play();
    }, [play, pause]);

    const seek = useCallback((t: number) => {
        const clamped = Math.max(0, Math.min(duration, t));
        setCurrentTime(clamped);
        startOffsetRef.current = clamped;
        if (isPlayingRef.current) {
            startPlaybackFrom(clamped);
        }
    }, [duration, startPlaybackFrom]);

    // ── Per-channel control handlers ───────────────────────────────────────────
    const setChannel = (id: string, patch: Partial<ChannelUiState>) => {
        setUi(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };
    const toggleMute = (id: string) => setChannel(id, { muted: !uiRef.current[id]?.muted });
    const toggleSolo = (id: string) => setChannel(id, { solo: !uiRef.current[id]?.solo });
    const setVolume = (id: string, v: number) => setChannel(id, { volume: v });

    // Master scrubber click → seek
    const scrubberRef = useRef<HTMLDivElement>(null);
    const handleScrub = (e: React.MouseEvent) => {
        const el = scrubberRef.current;
        if (!el || duration <= 0) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(ratio * duration);
    };

    const progress = duration > 0 ? currentTime / duration : 0;

    return (
        <div style={{
            background: colors.cardBg,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            backdropFilter: 'blur(12px)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.md }}>
                <Layers size={20} color={colors.primary} style={{ marginRight: spacing.sm }} />
                <div>
                    <h3 style={{ margin: 0, ...typography.h3, color: colors.textPrimary }}>Stems</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        Mute, solo and adjust the volume of each stem from “{trackTitle}”
                    </p>
                </div>
            </div>

            {loadError && (
                <div style={{ color: colors.error, fontSize: '14px', padding: spacing.md }}>{loadError}</div>
            )}

            {!loadError && (
                <>
                    {/* Master transport */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                        <button
                            onClick={togglePlay}
                            disabled={loading}
                            style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                border: 'none', cursor: loading ? 'default' : 'pointer',
                                background: colors.primary, color: '#0B0F19',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: loading ? 0.5 : 1, flexShrink: 0,
                            }}
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
                        </button>

                        <span style={{ fontSize: '13px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums', minWidth: '38px' }}>
                            {formatTime(currentTime)}
                        </span>

                        <div
                            ref={scrubberRef}
                            onClick={handleScrub}
                            style={{
                                flex: 1, height: '8px', borderRadius: borderRadius.pill,
                                background: colors.surfaceLight, cursor: 'pointer', position: 'relative', overflow: 'hidden',
                            }}
                        >
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${progress * 100}%`,
                                background: colors.primary, borderRadius: borderRadius.pill,
                            }} />
                        </div>

                        <span style={{ fontSize: '13px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums', minWidth: '38px', textAlign: 'right' }}>
                            {formatTime(duration)}
                        </span>
                    </div>

                    {loading && (
                        <div style={{ color: colors.textSecondary, fontSize: '14px', padding: `${spacing.md} 0` }}>
                            Loading stems for playback…
                        </div>
                    )}

                    {/* Channel strips */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        {stems.map(stem => {
                            const c = ui[stem.id] || { muted: false, solo: false, volume: 1 };
                            const channel = channelsRef.current.get(stem.id);
                            const audible = !c.muted && (!anySolo || c.solo);
                            const waveColor = audible ? colors.accent : colors.textTertiary;

                            return (
                                <div key={stem.id} style={{
                                    display: 'flex', alignItems: 'center', gap: spacing.md,
                                    padding: spacing.md,
                                    background: colors.glass,
                                    border: `1px solid ${colors.glassBorder}`,
                                    borderRadius: borderRadius.md,
                                    opacity: audible ? 1 : 0.55,
                                }}>
                                    <div style={{ width: '120px', flexShrink: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {stem.label}
                                        </div>
                                        {channel?.error && (
                                            <div style={{ fontSize: '11px', color: colors.error, marginTop: '2px' }}>Failed to load</div>
                                        )}
                                    </div>

                                    <StemWaveform peaks={stem.peaks} progress={progress} color={waveColor} />

                                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
                                        <button
                                            onClick={() => toggleMute(stem.id)}
                                            title="Mute"
                                            style={{
                                                width: '30px', height: '30px', borderRadius: borderRadius.sm,
                                                border: `1px solid ${c.muted ? colors.error : colors.glassBorder}`,
                                                background: c.muted ? `${colors.error}26` : 'transparent',
                                                color: c.muted ? colors.error : colors.textSecondary,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '12px', fontWeight: 700,
                                            }}
                                        >
                                            M
                                        </button>
                                        <button
                                            onClick={() => toggleSolo(stem.id)}
                                            title="Solo"
                                            style={{
                                                width: '30px', height: '30px', borderRadius: borderRadius.sm,
                                                border: `1px solid ${c.solo ? colors.primary : colors.glassBorder}`,
                                                background: c.solo ? `${colors.primary}26` : 'transparent',
                                                color: c.solo ? colors.primary : colors.textSecondary,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '12px', fontWeight: 700,
                                            }}
                                        >
                                            S
                                        </button>

                                        {c.volume === 0 || c.muted
                                            ? <VolumeX size={16} color={colors.textSecondary} />
                                            : <Volume2 size={16} color={colors.textSecondary} />}
                                        <input
                                            type="range"
                                            min={0}
                                            max={1.5}
                                            step={0.01}
                                            value={c.volume}
                                            onChange={e => setVolume(stem.id, parseFloat(e.target.value))}
                                            style={{ width: '90px', accentColor: colors.primary }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {anySolo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, color: colors.primary, fontSize: '12px' }}>
                            <Headphones size={14} />
                            Soloing {Object.values(ui).filter(c => c.solo).length} stem(s) — others are silenced
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
