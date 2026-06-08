import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Headphones, Layers, Download } from 'lucide-react';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { usePlayer } from './PlayerProvider';
import { useAuth } from './AuthProvider';

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

const pickAudioSrc = (url: string, mp3Url?: string | null): string => {
    if (canPlayOgg) return url || mp3Url || '';
    return mp3Url || url || '';
};

const pickStemUrl = (stem: StemData): string => pickAudioSrc(stem.url, stem.mp3Url);

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
 * Synced multi-stem mixer. By default the full mix plays through the site's
 * shared global player (PlayerProvider) — so play/pause/seek/volume are the
 * exact same transport as everywhere else on the site, with no separate audio
 * stream. The instant a stem is muted or soloed, playback hands off to an
 * independent Web Audio engine (AudioContext + per-stem GainNode) — something
 * the single-<audio> global player can't do — picking up from the position the
 * global player was at, and hands back the same way when the last mute/solo is
 * cleared. Only one engine ever produces sound at a time.
 */
export const StemsMixer: React.FC<{
    stems: StemData[];
    trackTitle: string;
    masterDuration: number;
    playerTrack: any;
    allowDownload?: boolean;
}> = ({ stems, trackTitle, masterDuration, playerTrack, allowDownload = true }) => {
    const { user } = useAuth();
    const { player, setTrack, togglePlay: globalTogglePlay, seek: globalSeek, setMuted } = usePlayer();

    // Always-fresh refs to the global player so effects that must only run on
    // specific transitions (not on every player tick) never read stale values.
    const playerRef = useRef(player); playerRef.current = player;
    const setMutedRef = useRef(setMuted); setMutedRef.current = setMuted;

    const ctxRef = useRef<AudioContext | null>(null);
    const channelsRef = useRef<Map<string, EngineChannel>>(new Map());
    const startCtxTimeRef = useRef(0);   // audioContext.currentTime when the stems engine last (re)started
    const startOffsetRef = useRef(0);    // global-player position (seconds) it started shadowing from
    const isPlayingRef = useRef(false);  // is the *stems engine* currently producing audio

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [ui, setUi] = useState<Record<string, ChannelUiState>>(() =>
        Object.fromEntries(stems.map(s => [s.id, { muted: false, solo: false, volume: 1 }]))
    );
    const uiRef = useRef(ui);
    uiRef.current = ui;

    const anySolo = useMemo(() => Object.values(ui).some(c => c.solo), [ui]);
    // The moment any stem is muted or soloed, the stems engine becomes the
    // audible source (in lockstep with the global player, which keeps running
    // — muted — purely as the shared transport/clock) — so soloing/muting
    // actually changes what's audible instead of just attenuating an
    // already-mixed track.
    const anyActive = useMemo(() => Object.values(ui).some(c => c.muted || c.solo), [ui]);

    const isThisTrackCurrent = player.currentTrack?.id === playerTrack?.id;
    const duration = (isThisTrackCurrent && player.duration > 0) ? player.duration : masterDuration;

    // Compute the audible gain for a stem given current mute/solo/volume state,
    // additionally scaled by the global player's volume so the mini player's
    // volume slider keeps working while the stems engine is driving audio.
    const effectiveGain = useCallback((id: string): number => {
        if (!anyActive) return 0;
        const c = uiRef.current[id];
        if (!c) return 1;
        let g = 1;
        if (c.muted) g = 0;
        else if (anySolo && !c.solo) g = 0;
        else g = c.volume;
        return g * playerRef.current.volume;
    }, [anyActive, anySolo]);

    // Apply gain values to all live GainNodes (called whenever mute/solo/volume/global-volume changes)
    const applyGains = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        for (const [id, ch] of channelsRef.current) {
            ch.gain.gain.setTargetAtTime(effectiveGain(id), ctx.currentTime, 0.01);
        }
    }, [effectiveGain]);

    useEffect(() => { applyGains(); }, [ui, player.volume, applyGains]);

    // ── Load + decode all stems into AudioBuffers (the master/full-mix is never
    // independently decoded — it's always played through the shared global player) ──
    useEffect(() => {
        let cancelled = false;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AudioCtx();
        ctxRef.current = ctx;
        setLoading(true);
        setLoadError(null);

        (async () => {
            try {
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
                    } catch {
                        channel.error = true;
                    }
                }
                if (cancelled) return;
                setLoading(false);
            } catch {
                if (!cancelled) {
                    setLoadError('Failed to load stems for playback.');
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            isPlayingRef.current = false;
            for (const ch of channelsRef.current.values()) {
                try { ch.source?.stop(); } catch {}
                try { ch.gain.disconnect(); } catch {}
            }
            channelsRef.current.clear();
            ctx.close().catch(() => {});
            ctxRef.current = null;
            setMutedRef.current(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stems.map(s => s.id).join(',')]);

    // ── Stems engine — a "shadow" renderer that mirrors the global player's
    // play/pause/seek state sample-accurately via the Web Audio API, only
    // while it's the audible source (anyActive && isThisTrackCurrent) ────────
    const stopSources = useCallback(() => {
        for (const ch of channelsRef.current.values()) {
            if (ch.source) {
                try { ch.source.stop(); } catch {}
                ch.source.disconnect();
                ch.source = null;
            }
        }
    }, []);

    const startStemsFrom = useCallback((offset: number) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
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
        isPlayingRef.current = true;
        applyGains();
    }, [stopSources, applyGains]);

    const pauseStemsEngine = useCallback(() => {
        if (!isPlayingRef.current) return;
        isPlayingRef.current = false;
        stopSources();
    }, [stopSources]);

    // Should the stems engine currently be the audible source for this track?
    const stemsShouldDrive = anyActive && isThisTrackCurrent && !loading;

    // Start/stop the shadow engine in lockstep with the global player's play state
    useEffect(() => {
        if (stemsShouldDrive && player.isPlaying) {
            if (!isPlayingRef.current) startStemsFrom(playerRef.current.currentTime);
        } else if (isPlayingRef.current) {
            pauseStemsEngine();
        }
    }, [stemsShouldDrive, player.isPlaying, startStemsFrom, pauseStemsEngine]);

    // Mute the shared <audio> element while the stems engine is the audible
    // source — it keeps playing (silently) purely to drive the shared
    // transport clock, so the waveform/arrangement view never pauses or
    // desyncs. Restore on the way out and on unmount.
    useEffect(() => {
        setMutedRef.current(stemsShouldDrive);
    }, [stemsShouldDrive]);
    useEffect(() => () => { setMutedRef.current(false); }, []);

    // Periodically resync the stems engine to the global player's position —
    // catches user seeks/scrubs on the master transport while stems are driving.
    useEffect(() => {
        if (!(stemsShouldDrive && player.isPlaying)) return;
        const id = setInterval(() => {
            const ctx = ctxRef.current;
            if (!ctx || !isPlayingRef.current) return;
            const elapsed = Math.max(0, ctx.currentTime - startCtxTimeRef.current);
            const predicted = startOffsetRef.current + elapsed;
            if (Math.abs(playerRef.current.currentTime - predicted) > 0.75) {
                startStemsFrom(playerRef.current.currentTime);
            }
        }, 500);
        return () => clearInterval(id);
    }, [stemsShouldDrive, player.isPlaying, startStemsFrom]);

    // ── Unified transport — always proxies straight to the shared global
    // player; the stems engine silently shadows whatever it does ─────────────
    const handleTogglePlay = useCallback(() => {
        if (isThisTrackCurrent) globalTogglePlay();
        else setTrack(playerTrack, [playerTrack]);
    }, [isThisTrackCurrent, globalTogglePlay, setTrack, playerTrack]);

    const handleSeek = useCallback((t: number) => {
        const clamped = Math.max(0, Math.min(duration, t));
        if (isThisTrackCurrent) {
            globalSeek(clamped);
        } else {
            setTrack(playerTrack, [playerTrack]);
            setTimeout(() => globalSeek(clamped), 200);
        }
    }, [duration, isThisTrackCurrent, globalSeek, setTrack, playerTrack]);

    // ── Per-channel control handlers ───────────────────────────────────────────
    const setChannel = (id: string, patch: Partial<ChannelUiState>) => {
        setUi(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };
    const toggleMute = (id: string) => setChannel(id, { muted: !uiRef.current[id]?.muted });
    const toggleSolo = (id: string) => setChannel(id, { solo: !uiRef.current[id]?.solo });
    const setVolume = (id: string, v: number) => setChannel(id, { volume: v });

    // Unified playback state — always sourced from the global player (the
    // stems engine never drives the displayed transport, only the audio output)
    const displayIsPlaying = isThisTrackCurrent && player.isPlaying;
    const displayCurrentTime = isThisTrackCurrent ? player.currentTime : 0;

    // Master scrubber click → seek
    const scrubberRef = useRef<HTMLDivElement>(null);
    const handleScrub = (e: React.MouseEvent) => {
        const el = scrubberRef.current;
        if (!el || duration <= 0) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        handleSeek(ratio * duration);
    };

    const progress = duration > 0 ? displayCurrentTime / duration : 0;

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
                <span style={{
                    marginLeft: 'auto', fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: borderRadius.pill,
                    color: anyActive ? colors.primary : colors.textSecondary,
                    background: anyActive ? `${colors.primary}1f` : colors.surfaceLight,
                    border: `1px solid ${anyActive ? colors.primary : colors.glassBorder}`,
                }}>
                    {anyActive ? 'Playing stems' : 'Playing full mix'}
                </span>
            </div>

            {loadError && (
                <div style={{ color: colors.error, fontSize: '14px', padding: `0 0 ${spacing.md}` }}>{loadError}</div>
            )}

            {/* Master transport — proxies straight to the shared global player when
                playing the full mix, so play/pause/seek/volume are identical to the
                mini player everywhere else on the site. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                <button
                    onClick={handleTogglePlay}
                    style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        border: 'none', cursor: 'pointer',
                        background: colors.primary, color: '#0B0F19',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    {displayIsPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
                </button>

                <span style={{ fontSize: '13px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums', minWidth: '38px' }}>
                    {formatTime(displayCurrentTime)}
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

            {anyActive && loading && (
                <div style={{ color: colors.textSecondary, fontSize: '14px', padding: `0 0 ${spacing.md}` }}>
                    Loading stems for playback…
                </div>
            )}

            {!loadError && (
                <>
                    {/* Channel strips */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        {stems.map(stem => {
                            const c = ui[stem.id] || { muted: false, solo: false, volume: 1 };
                            const channel = channelsRef.current.get(stem.id);
                            const audible = anyActive && !c.muted && (!anySolo || c.solo);
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

                                        {allowDownload && (
                                            <button
                                                onClick={() => user ? window.open(`/api/downloads/stem/${stem.id}`, '_blank') : (window.location.href = '/login')}
                                                title={`Download ${stem.label}`}
                                                style={{
                                                    width: '30px', height: '30px', borderRadius: borderRadius.sm,
                                                    border: `1px solid ${colors.glassBorder}`,
                                                    background: 'transparent',
                                                    color: colors.textSecondary,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}
                                            >
                                                <Download size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {anyActive ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, color: colors.primary, fontSize: '12px' }}>
                            <Headphones size={14} />
                            {anySolo
                                ? `Soloing ${Object.values(ui).filter(c => c.solo).length} stem(s) — the full mix and other stems are silenced`
                                : 'Playing individual stems — the full mix is silenced while any stem is muted'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, color: colors.textTertiary, fontSize: '12px' }}>
                            <Headphones size={14} />
                            Playing the full mix through the main player — mute or solo a stem to switch to individual playback
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
