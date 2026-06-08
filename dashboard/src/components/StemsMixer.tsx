import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Headphones, Layers } from 'lucide-react';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { usePlayer } from './PlayerProvider';

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
}> = ({ stems, trackTitle, masterDuration, playerTrack }) => {
    const { player, setTrack, togglePlay: globalTogglePlay, seek: globalSeek } = usePlayer();

    // Always-fresh refs to the global player API so the mode-handoff effect
    // (which must only fire on anyActive transitions, not on every player tick)
    // never closes over stale values.
    const playerRef = useRef(player); playerRef.current = player;
    const setTrackRef = useRef(setTrack); setTrackRef.current = setTrack;
    const globalTogglePlayRef = useRef(globalTogglePlay); globalTogglePlayRef.current = globalTogglePlay;
    const globalSeekRef = useRef(globalSeek); globalSeekRef.current = globalSeek;

    const ctxRef = useRef<AudioContext | null>(null);
    const channelsRef = useRef<Map<string, EngineChannel>>(new Map());
    const startCtxTimeRef = useRef(0);   // audioContext.currentTime when stems playback last (re)started
    const startOffsetRef = useRef(0);    // stems playback position (seconds) at that start
    const rafRef = useRef<number | null>(null);
    const isPlayingRef = useRef(false);  // is the *stems engine* currently playing

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [stemsDuration, setStemsDuration] = useState(0);
    const [ui, setUi] = useState<Record<string, ChannelUiState>>(() =>
        Object.fromEntries(stems.map(s => [s.id, { muted: false, solo: false, volume: 1 }]))
    );
    const uiRef = useRef(ui);
    uiRef.current = ui;

    const anySolo = useMemo(() => Object.values(ui).some(c => c.solo), [ui]);
    // The moment any stem is muted or soloed, we hand playback off from the
    // global player (full mix) to the individual stems engine — so soloing/
    // muting actually changes what's audible instead of just attenuating an
    // already-mixed track.
    const anyActive = useMemo(() => Object.values(ui).some(c => c.muted || c.solo), [ui]);

    const isThisTrackCurrent = player.currentTrack?.id === playerTrack?.id;
    const masterDurationLive = (isThisTrackCurrent && player.duration > 0) ? player.duration : masterDuration;

    // Unified transport state — sourced from whichever engine is currently driving audio
    const duration = anyActive ? (stemsDuration || masterDurationLive) : masterDurationLive;

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
                setStemsDuration(maxDuration);
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

    // ── Stems playback engine (only ever active while anyActive is true) ──────
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

    const playStems = useCallback((fromOffset?: number) => {
        const ctx = ctxRef.current;
        if (!ctx || loading) return;
        if (ctx.state === 'suspended') ctx.resume();
        const offset = fromOffset !== undefined ? fromOffset : (currentTime >= duration ? 0 : currentTime);
        startStemsFrom(offset);
        isPlayingRef.current = true;
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
    }, [loading, currentTime, duration, startStemsFrom, tick]);

    const pauseStems = useCallback((): number => {
        const ctx = ctxRef.current;
        if (!ctx || !isPlayingRef.current) return startOffsetRef.current;
        const elapsed = Math.max(0, ctx.currentTime - startCtxTimeRef.current);
        const t = Math.min(duration, startOffsetRef.current + elapsed);
        isPlayingRef.current = false;
        setIsPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        stopSources();
        setCurrentTime(t);
        startOffsetRef.current = t;
        return t;
    }, [duration, stopSources]);

    // ── Unified transport — proxies to the global player in full-mix mode, and
    // to the independent stems engine once any mute/solo is active ────────────
    const handleTogglePlay = useCallback(() => {
        if (anyActive) {
            if (isPlayingRef.current) {
                pauseStems();
            } else {
                // Starting stems playback becomes THE active playback on the site —
                // silence anything currently playing through the global player first.
                if (playerRef.current.isPlaying) globalTogglePlayRef.current();
                playStems();
            }
        } else if (isThisTrackCurrent) {
            globalTogglePlay();
        } else {
            setTrack(playerTrack, [playerTrack]);
        }
    }, [anyActive, isThisTrackCurrent, globalTogglePlay, setTrack, playerTrack, pauseStems, playStems]);

    const handleSeek = useCallback((t: number) => {
        const clamped = Math.max(0, Math.min(duration, t));
        if (anyActive) {
            setCurrentTime(clamped);
            startOffsetRef.current = clamped;
            if (isPlayingRef.current) startStemsFrom(clamped);
        } else if (isThisTrackCurrent) {
            globalSeek(clamped);
        }
    }, [duration, anyActive, isThisTrackCurrent, startStemsFrom, globalSeek]);

    // ── Hand off playback between the global player and the stems engine
    // whenever mute/solo activation flips, carrying position + play state across ──
    const prevAnyActiveRef = useRef(anyActive);
    useEffect(() => {
        if (anyActive === prevAnyActiveRef.current) return;
        const enteringStems = anyActive;
        prevAnyActiveRef.current = anyActive;

        if (enteringStems) {
            const wasCurrent = playerRef.current.currentTrack?.id === playerTrack?.id;
            const offset = wasCurrent ? playerRef.current.currentTime : 0;
            const wasPlaying = wasCurrent && playerRef.current.isPlaying;
            if (wasPlaying) globalTogglePlayRef.current(); // pause the global player so only one engine is audible
            startOffsetRef.current = offset;
            setCurrentTime(offset);
            if (wasPlaying && !loading) {
                playStems(offset);
            } else {
                isPlayingRef.current = false;
                setIsPlaying(false);
            }
        } else {
            const wasPlaying = isPlayingRef.current;
            const t = pauseStems();
            const isCurrent = playerRef.current.currentTrack?.id === playerTrack?.id;
            if (isCurrent) {
                globalSeekRef.current(t);
                if (wasPlaying !== playerRef.current.isPlaying) globalTogglePlayRef.current();
            } else {
                setTrackRef.current(playerTrack, [playerTrack]);
                setTimeout(() => {
                    globalSeekRef.current(t);
                    if (!wasPlaying) globalTogglePlayRef.current(); // setTrack auto-plays — pause back if it wasn't playing
                }, 200);
            }
            setCurrentTime(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anyActive]);

    // ── Per-channel control handlers ───────────────────────────────────────────
    const setChannel = (id: string, patch: Partial<ChannelUiState>) => {
        setUi(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };
    const toggleMute = (id: string) => setChannel(id, { muted: !uiRef.current[id]?.muted });
    const toggleSolo = (id: string) => setChannel(id, { solo: !uiRef.current[id]?.solo });
    const setVolume = (id: string, v: number) => setChannel(id, { volume: v });

    // Unified playback state — sourced from whichever engine is currently driving audio
    const displayIsPlaying = anyActive ? isPlaying : (isThisTrackCurrent && player.isPlaying);
    const displayCurrentTime = anyActive ? currentTime : (isThisTrackCurrent ? player.currentTime : currentTime);

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
    const playDisabled = anyActive && loading;

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
                    disabled={playDisabled}
                    style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        border: 'none', cursor: playDisabled ? 'default' : 'pointer',
                        background: colors.primary, color: '#0B0F19',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: playDisabled ? 0.5 : 1, flexShrink: 0,
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
