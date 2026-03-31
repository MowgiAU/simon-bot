import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    Mic, AlertTriangle, Play, Pause, Clock, Users, Shield, Hash,
    Volume2, Trash2, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight,
    SkipBack, SkipForward, ZoomIn, ZoomOut, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

const API = import.meta.env.VITE_API_URL || '';

interface VoiceMonitorSettings {
    guildId: string;
    enabled: boolean;
    retentionDays: number;
    monitoredChannelIds: string[];
    excludedRoleIds: string[];
    noticeChannelId: string | null;
    noticeSent: boolean;
}

interface VoiceSegmentSummary {
    id: string;
    userId: string;
    userName: string | null;
    durationMs: number;
    fileSize: number;
    startedAt: string;
    endedAt: string | null;
}

interface VoiceSession {
    id: string;
    guildId: string;
    channelId: string;
    channelName: string | null;
    startedAt: string;
    endedAt: string | null;
    segments: VoiceSegmentSummary[];
    _count: { segments: number; reports: number };
}

interface VoiceSegmentDetail {
    id: string;
    userId: string;
    userName: string | null;
    r2Key: string;
    r2Url: string;
    durationMs: number;
    fileSize: number;
    startedAt: string;
    endedAt: string | null;
}

interface VoiceSessionDetail {
    id: string;
    channelName: string | null;
    startedAt: string;
    endedAt: string | null;
    segments: VoiceSegmentDetail[];
    reports: VoiceReport[];
}

interface VoiceReport {
    id: string;
    sessionId: string | null;
    reporterId: string;
    reporterName: string | null;
    targetId: string | null;
    targetName: string | null;
    reason: string;
    status: string;
    notes: string | null;
    reviewedBy: string | null;
    createdAt: string;
    resolvedAt: string | null;
    session?: { id: string; channelName: string | null; startedAt: string; endedAt: string | null };
}

type Tab = 'sessions' | 'reports' | 'settings';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACK_COLORS = [
    '#7C3AED', '#2563EB', '#059669', '#D97706',
    '#DC2626', '#0891B2', '#65A30D', '#EC4899',
];

const CHUNK_DURATION_S = 600; // 10 minutes per chunk

// ── Utility ───────────────────────────────────────────────────────────────────

const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const formatDate = (d: string) => new Date(d).toLocaleString();

const fmtMmSs = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ── Procedural waveform SVG path ──────────────────────────────────────────────
function generateWaveformPath(segId: string, barCount: number, viewH: number): string {
    const seed = segId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    let path = '';
    for (let i = 0; i < barCount; i++) {
        const t = i / barCount;
        const env = Math.sin(t * Math.PI) * 0.3 + 0.7;
        const fast = Math.sin(seed * 0.17 + i * 1.3) * 0.35;
        const med = Math.sin(seed * 0.07 + i * 0.5) * 0.25;
        const slow = Math.sin(seed * 0.03 + i * 0.2) * 0.15;
        const amp = Math.max(0.08, Math.min(1, (0.5 + fast + med + slow) * env));
        const h = Math.max(1, amp * (viewH - 2));
        const y = (viewH - h) / 2;
        path += `M${i * 1.2} ${y}h0.8v${h}h-0.8Z`;
    }
    return path;
}

// ══════════════════════════════════════════════════════════════════════════════
// SegmentReviewTimeline — DAW-style multi-track audio reviewer
// ══════════════════════════════════════════════════════════════════════════════

interface TimelineProps {
    session: VoiceSessionDetail;
    onBack: () => void;
    onDeleteSegment: (id: string) => void;
}

function SegmentReviewTimeline({ session, onBack, onDeleteSegment }: TimelineProps) {
    const sessionStartMs = new Date(session.startedAt).getTime();
    const sessionEndMs = session.endedAt
        ? new Date(session.endedAt).getTime()
        : Math.max(sessionStartMs + CHUNK_DURATION_S * 1000,
            ...session.segments.map(s => s.endedAt ? new Date(s.endedAt).getTime() : new Date(s.startedAt).getTime() + s.durationMs));

    const totalDurationS = (sessionEndMs - sessionStartMs) / 1000;
    const chunkCount = Math.max(1, Math.ceil(totalDurationS / CHUNK_DURATION_S));

    const [currentChunk, setCurrentChunk] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
    const [soloUser, setSoloUser] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const playheadRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const animFrameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const activeSegIdsRef = useRef<Set<string>>(new Set());

    // Helper: get or create an Audio element for a segment
    const getAudio = useCallback((seg: VoiceSegmentDetail) => {
        let audio = audioRefs.current.get(seg.id);
        if (!audio) {
            audio = new Audio(seg.r2Url);
            audio.preload = 'auto';
            audioRefs.current.set(seg.id, audio);
        }
        return audio;
    }, []);

    // Helper: pause all currently playing segment audio
    const stopAllAudio = useCallback(() => {
        audioRefs.current.forEach(audio => {
            audio.pause();
        });
        activeSegIdsRef.current.clear();
    }, []);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const chunkStartS = currentChunk * CHUNK_DURATION_S;
    const chunkEndS = Math.min((currentChunk + 1) * CHUNK_DURATION_S, totalDurationS);
    const chunkLengthS = chunkEndS - chunkStartS;

    // Group segments by user
    const userTracks = useMemo(() => {
        const map = new Map<string, { userId: string; userName: string; segments: VoiceSegmentDetail[]; color: string }>();
        let colorIdx = 0;
        session.segments.forEach(seg => {
            if (!map.has(seg.userId)) {
                map.set(seg.userId, {
                    userId: seg.userId,
                    userName: seg.userName || seg.userId.slice(0, 8),
                    segments: [],
                    color: TRACK_COLORS[colorIdx % TRACK_COLORS.length],
                });
                colorIdx++;
            }
            map.get(seg.userId)!.segments.push(seg);
        });
        return Array.from(map.values());
    }, [session.segments]);

    // Segments visible in current chunk
    const visibleSegments = useMemo(() => {
        const chunkStartMs2 = sessionStartMs + chunkStartS * 1000;
        const chunkEndMs2 = sessionStartMs + chunkEndS * 1000;
        return session.segments.filter(seg => {
            const segStart = new Date(seg.startedAt).getTime();
            const segEnd = seg.endedAt ? new Date(seg.endedAt).getTime() : segStart + seg.durationMs;
            return segEnd > chunkStartMs2 && segStart < chunkEndMs2;
        });
    }, [session.segments, sessionStartMs, chunkStartS, chunkEndS]);

    // Playback animation loop
    useEffect(() => {
        if (!isPlaying) return;
        lastTimeRef.current = performance.now();
        const tick = (now: number) => {
            const dt = (now - lastTimeRef.current) / 1000;
            lastTimeRef.current = now;
            setPlaybackTime(prev => {
                const next = prev + dt;
                if (next >= chunkLengthS) {
                    if (currentChunk < chunkCount - 1) {
                        setCurrentChunk(c => c + 1);
                        return 0;
                    }
                    setIsPlaying(false);
                    return chunkLengthS;
                }
                return next;
            });
            animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isPlaying, chunkLengthS, currentChunk, chunkCount]);

    // Update playhead position via rAF
    useEffect(() => {
        let frame: number;
        const update = () => {
            if (playheadRef.current) {
                const pct = chunkLengthS > 0 ? (playbackTime / chunkLengthS) * 100 : 0;
                playheadRef.current.style.left = `${pct}%`;
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [playbackTime, chunkLengthS]);

    // Reset playback when chunk changes
    useEffect(() => {
        stopAllAudio();
        setPlaybackTime(0);
        setIsPlaying(false);
    }, [currentChunk, stopAllAudio]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => { stopAllAudio(); };
    }, [stopAllAudio]);

    // ── Audio sync: play/pause/seek segments as playhead moves ─────────
    useEffect(() => {
        if (!isPlaying) {
            stopAllAudio();
            return;
        }

        const absTimeMs = sessionStartMs + (chunkStartS + playbackTime) * 1000;

        // Determine which segments the playhead is currently inside
        const nowActive = new Set<string>();
        for (const seg of session.segments) {
            const segStartMs = new Date(seg.startedAt).getTime();
            const segEndMs = seg.endedAt ? new Date(seg.endedAt).getTime() : segStartMs + seg.durationMs;
            if (absTimeMs >= segStartMs && absTimeMs < segEndMs) {
                // Check mute/solo
                const isMuted = soloUser ? soloUser !== seg.userId : mutedUsers.has(seg.userId);
                if (!isMuted) {
                    nowActive.add(seg.id);
                }
            }
        }

        // Stop segments that are no longer active
        for (const id of activeSegIdsRef.current) {
            if (!nowActive.has(id)) {
                const audio = audioRefs.current.get(id);
                if (audio) audio.pause();
            }
        }

        // Start/sync segments that should be playing
        for (const seg of session.segments) {
            if (!nowActive.has(seg.id)) continue;
            const audio = getAudio(seg);
            const segStartMs = new Date(seg.startedAt).getTime();
            const offsetS = (absTimeMs - segStartMs) / 1000;

            // If this segment wasn't playing before, seek and play
            if (!activeSegIdsRef.current.has(seg.id)) {
                audio.currentTime = Math.max(0, offsetS);
                audio.play().catch(() => {});
            } else {
                // Already playing — only correct drift if > 0.5s off
                const drift = Math.abs(audio.currentTime - offsetS);
                if (drift > 0.5) {
                    audio.currentTime = offsetS;
                }
            }
        }

        activeSegIdsRef.current = nowActive;
    }, [isPlaying, playbackTime, chunkStartS, sessionStartMs, session.segments, mutedUsers, soloUser, getAudio, stopAllAudio]);

    const togglePlay = () => setIsPlaying(p => !p);
    const seekBackward = () => { stopAllAudio(); setPlaybackTime(t => Math.max(0, t - 10)); };
    const seekForward = () => { stopAllAudio(); setPlaybackTime(t => Math.min(chunkLengthS, t + 10)); };
    const seekToPosition = (e: React.MouseEvent<HTMLDivElement>) => {
        stopAllAudio();
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setPlaybackTime(pct * chunkLengthS);
    };

    const toggleMute = (userId: string) => {
        setMutedUsers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId); else next.add(userId);
            return next;
        });
        // Force audio re-evaluation by stopping all — sync effect will restart correct ones
        stopAllAudio();
    };
    const toggleSolo = (userId: string) => {
        setSoloUser(prev => prev === userId ? null : userId);
        stopAllAudio();
    };

    const isUserActive = useCallback((userId: string) => {
        const absTimeMs = sessionStartMs + (chunkStartS + playbackTime) * 1000;
        return session.segments.some(seg => {
            if (seg.userId !== userId) return false;
            const segStart = new Date(seg.startedAt).getTime();
            const segEnd = seg.endedAt ? new Date(seg.endedAt).getTime() : segStart + seg.durationMs;
            return absTimeMs >= segStart && absTimeMs <= segEnd;
        });
    }, [session.segments, sessionStartMs, chunkStartS, playbackTime]);

    // Zoom with Alt+Wheel
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (e.altKey) {
                e.preventDefault();
                setZoom(z => Math.max(1, Math.min(8, z + (e.deltaY < 0 ? 0.5 : -0.5))));
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    const LABEL_W = isMobile ? 100 : 160;
    const TRACK_H = 52;

    // Timeline ruler ticks
    const rulerTicks = useMemo(() => {
        const ticks: React.ReactNode[] = [];
        const interval = zoom >= 3 ? 15 : zoom >= 2 ? 30 : 60;
        for (let s = 0; s <= chunkLengthS; s += interval) {
            const pct = (s / chunkLengthS) * 100;
            const isMajor = s % 60 === 0;
            ticks.push(
                <div key={s} style={{
                    position: 'absolute', left: `${pct}%`, top: 0, height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                    <span style={{
                        fontSize: '0.6rem', color: isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                        fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: isMajor ? 600 : 400,
                        transform: 'translateX(-50%)',
                    }}>
                        {fmtMmSs(chunkStartS + s)}
                    </span>
                    <div style={{
                        width: '1px', flex: 1,
                        backgroundColor: isMajor ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                    }} />
                </div>
            );
        }
        return ticks;
    }, [chunkLengthS, chunkStartS, zoom]);

    // Track clip rows (memoized)
    const trackClipRows = useMemo(() => {
        return userTracks.map((track) => {
            const chunkStartMs2 = sessionStartMs + chunkStartS * 1000;
            const chunkEndMs2 = sessionStartMs + chunkEndS * 1000;

            return (
                <div key={track.userId} style={{
                    flex: 1, position: 'relative', height: '100%',
                    backgroundColor: 'rgba(255,255,255,0.015)',
                }}>
                    {/* Grid lines */}
                    {Array.from({ length: Math.ceil(chunkLengthS / 60) + 1 }, (_, i) => (
                        <div key={i} style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${(i * 60 / chunkLengthS) * 100}%`,
                            width: '1px', backgroundColor: 'rgba(255,255,255,0.04)',
                            pointerEvents: 'none',
                        }} />
                    ))}

                    {/* Segment blocks */}
                    {track.segments.map(seg => {
                        const segStartMs = new Date(seg.startedAt).getTime();
                        const segEndMs = seg.endedAt ? new Date(seg.endedAt).getTime() : segStartMs + seg.durationMs;
                        const visStart = Math.max(segStartMs, chunkStartMs2);
                        const visEnd = Math.min(segEndMs, chunkEndMs2);
                        if (visEnd <= visStart) return null;
                        const leftPct = ((visStart - chunkStartMs2) / (chunkEndMs2 - chunkStartMs2)) * 100;
                        const widthPct = ((visEnd - visStart) / (chunkEndMs2 - chunkStartMs2)) * 100;
                        if (widthPct < 0.05) return null;

                        const barCount = Math.max(8, Math.min(120, Math.round(widthPct * 1.2)));
                        const waveformPath = generateWaveformPath(seg.id, barCount, 36);

                        return (
                            <div key={seg.id} title={`${track.userName} · ${formatDuration(seg.durationMs)} · ${formatSize(seg.fileSize)}`}
                                style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: '4px', bottom: '4px',
                                    backgroundColor: `${track.color}30`,
                                    border: `1px solid ${track.color}70`,
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    minWidth: '4px',
                                    contain: 'layout style paint',
                                }}>
                                <svg viewBox={`0 0 ${barCount * 1.2} 36`} preserveAspectRatio="none"
                                    style={{ position: 'absolute', inset: '3px 2px', width: 'calc(100% - 4px)', height: 'calc(100% - 6px)' }}>
                                    <path d={waveformPath} fill={track.color} opacity={0.75} />
                                </svg>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                                    background: `linear-gradient(90deg, transparent, ${track.color}88, transparent)`,
                                }} />
                            </div>
                        );
                    })}
                </div>
            );
        });
    }, [userTracks, sessionStartMs, chunkStartS, chunkEndS, chunkLengthS]);

    const playSegmentAudio = (seg: VoiceSegmentDetail) => {
        stopAllAudio();
        setIsPlaying(false);
        const audio = getAudio(seg);
        audio.currentTime = 0;
        audio.play().catch(() => {});
    };

    return (
        <div>
            {/* Back button */}
            <button onClick={onBack} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', color: colors.primary,
                cursor: 'pointer', padding: 0, marginBottom: spacing.lg,
                fontSize: '13px', fontWeight: 600,
            }}>
                <ArrowLeft size={15} /> Back to sessions
            </button>

            {/* Session header card */}
            <div style={{
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, padding: '16px 20px', marginBottom: '16px',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: '12px',
                }}>
                    <div>
                        <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Hash size={18} color={colors.textTertiary} />
                            {session.channelName || 'Unknown Channel'}
                            {!session.endedAt && (
                                <span style={{
                                    backgroundColor: colors.success, color: '#fff', fontSize: '10px',
                                    padding: '2px 8px', borderRadius: borderRadius.pill, fontWeight: 700,
                                }}>LIVE</span>
                            )}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: colors.textSecondary, fontSize: '12px' }}>
                            <span><Clock size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />{formatDate(session.startedAt)}</span>
                            <span><Users size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />{userTracks.length} users</span>
                            <span><Mic size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />{session.segments.length} segments</span>
                        </div>
                    </div>

                    {/* Chunk selector */}
                    {chunkCount > 1 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            backgroundColor: colors.surfaceLight, padding: '4px 8px',
                            borderRadius: borderRadius.sm, border: `1px solid ${colors.glassBorder}`,
                        }}>
                            <button onClick={() => setCurrentChunk(c => Math.max(0, c - 1))} disabled={currentChunk === 0}
                                style={{ background: 'none', border: 'none', color: currentChunk === 0 ? colors.textTertiary : colors.textPrimary, cursor: currentChunk === 0 ? 'default' : 'pointer', padding: '2px', display: 'flex' }}>
                                <ChevronLeft size={14} />
                            </button>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, fontFamily: 'monospace', minWidth: '110px', textAlign: 'center' }}>
                                {fmtMmSs(chunkStartS)} — {fmtMmSs(chunkEndS)}
                            </span>
                            <button onClick={() => setCurrentChunk(c => Math.min(chunkCount - 1, c + 1))} disabled={currentChunk >= chunkCount - 1}
                                style={{ background: 'none', border: 'none', color: currentChunk >= chunkCount - 1 ? colors.textTertiary : colors.textPrimary, cursor: currentChunk >= chunkCount - 1 ? 'default' : 'pointer', padding: '2px', display: 'flex' }}>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Transport / Playback Controls */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, padding: '10px 16px', marginBottom: '2px',
                flexWrap: 'wrap', gap: '10px',
            }}>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: colors.textPrimary, fontWeight: 600, minWidth: '50px' }}>
                    {fmtMmSs(chunkStartS + playbackTime)}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={seekBackward} title="Rewind 10s" style={{
                        background: 'none', border: `1px solid ${colors.glassBorder}`,
                        borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer',
                        color: colors.textSecondary, display: 'flex',
                    }}><SkipBack size={14} /></button>
                    <button onClick={togglePlay} style={{
                        background: isPlaying ? `${colors.primary}22` : colors.primary,
                        border: isPlaying ? `1px solid ${colors.primary}` : 'none',
                        borderRadius: '50%', width: '36px', height: '36px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isPlaying ? colors.primary : '#fff',
                        boxShadow: isPlaying ? 'none' : `0 0 16px ${colors.primary}40`,
                    }}>
                        {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
                    </button>
                    <button onClick={seekForward} title="Forward 10s" style={{
                        background: 'none', border: `1px solid ${colors.glassBorder}`,
                        borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer',
                        color: colors.textSecondary, display: 'flex',
                    }}><SkipForward size={14} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ZoomOut size={13} color={colors.textTertiary} />
                    <input type="range" min={1} max={8} step={0.5} value={zoom}
                        onChange={e => setZoom(parseFloat(e.target.value))}
                        style={{ width: '80px', accentColor: colors.primary }} />
                    <ZoomIn size={13} color={colors.textTertiary} />
                    <span style={{ fontSize: '10px', color: colors.textTertiary, fontFamily: 'monospace', minWidth: '32px' }}>{Math.round(zoom * 100)}%</span>
                </div>
            </div>

            {/* Timeline Area */}
            <div style={{
                backgroundColor: '#0B0F19',
                border: `1px solid ${colors.border}`,
                borderRadius: `0 0 ${borderRadius.md} ${borderRadius.md}`,
                overflow: 'hidden',
            }}>
                <div ref={scrollContainerRef} style={{
                    overflowX: 'auto', overflowY: 'auto',
                    maxHeight: `${Math.min(600, userTracks.length * TRACK_H + 40 + 40)}px`,
                    scrollBehavior: 'smooth',
                }}>
                    <div style={{
                        width: `${100 * zoom}%`, minWidth: '100%',
                        position: 'relative',
                    }}>
                        {/* Ruler */}
                        <div style={{
                            display: 'flex', position: 'sticky', top: 0, zIndex: 20,
                            backgroundColor: '#0D1117', borderBottom: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            <div style={{
                                width: `${LABEL_W}px`, flexShrink: 0, position: 'sticky', left: 0,
                                zIndex: 25, backgroundColor: '#0D1117',
                                borderRight: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 8px',
                            }}>
                                <span style={{ fontSize: '9px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                                    {visibleSegments.length} clips
                                </span>
                            </div>
                            <div style={{ flex: 1, position: 'relative', height: '28px' }}>
                                {rulerTicks}
                            </div>
                        </div>

                        {/* Track Rows */}
                        {userTracks.map((track, ti) => {
                            const active = isUserActive(track.userId);
                            const isMuted = soloUser ? soloUser !== track.userId : mutedUsers.has(track.userId);

                            return (
                                <div key={track.userId} style={{
                                    display: 'flex', height: `${TRACK_H}px`,
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    opacity: isMuted ? 0.35 : 1,
                                    transition: 'opacity 0.2s',
                                }}>
                                    {/* Track Label Panel */}
                                    <div style={{
                                        width: `${LABEL_W}px`, flexShrink: 0,
                                        position: 'sticky', left: 0, zIndex: 15,
                                        backgroundColor: active ? `${track.color}18` : '#0D1117',
                                        borderRight: `2px solid ${active ? track.color : 'rgba(255,255,255,0.06)'}`,
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '0 8px',
                                        transition: 'background-color 0.15s, border-color 0.15s',
                                    }}>
                                        <div style={{
                                            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                                            background: `linear-gradient(135deg, ${track.color}60, ${track.color}30)`,
                                            border: `2px solid ${active ? track.color : `${track.color}50`}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '10px', fontWeight: 700, color: track.color,
                                            transition: 'border-color 0.15s',
                                            boxShadow: active ? `0 0 8px ${track.color}40` : 'none',
                                        }}>
                                            {track.userName.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{
                                            flex: 1, fontSize: '11px', fontWeight: 600,
                                            color: active ? colors.textPrimary : colors.textSecondary,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            transition: 'color 0.15s',
                                        }}>
                                            {track.userName}
                                        </span>
                                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                            <button onClick={() => toggleMute(track.userId)} title="Mute"
                                                style={{
                                                    width: '20px', height: '20px', borderRadius: '3px',
                                                    border: `1px solid ${mutedUsers.has(track.userId) ? colors.error + '80' : 'rgba(255,255,255,0.1)'}`,
                                                    backgroundColor: mutedUsers.has(track.userId) ? `${colors.error}22` : 'transparent',
                                                    color: mutedUsers.has(track.userId) ? colors.error : colors.textTertiary,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '9px', fontWeight: 700, padding: 0,
                                                }}>
                                                M
                                            </button>
                                            <button onClick={() => toggleSolo(track.userId)} title="Solo"
                                                style={{
                                                    width: '20px', height: '20px', borderRadius: '3px',
                                                    border: `1px solid ${soloUser === track.userId ? colors.highlight + '80' : 'rgba(255,255,255,0.1)'}`,
                                                    backgroundColor: soloUser === track.userId ? `${colors.highlight}22` : 'transparent',
                                                    color: soloUser === track.userId ? colors.highlight : colors.textTertiary,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '9px', fontWeight: 700, padding: 0,
                                                }}>
                                                S
                                            </button>
                                        </div>
                                    </div>

                                    {/* Audio Lane */}
                                    {trackClipRows[ti]}
                                </div>
                            );
                        })}

                        {/* Playhead */}
                        <div ref={playheadRef} style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: '0%', width: '2px',
                            marginLeft: `${LABEL_W}px`,
                            pointerEvents: 'none', zIndex: 30,
                            willChange: 'left',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: '-5px',
                                width: 0, height: 0,
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderTop: `6px solid ${colors.primary}`,
                            }} />
                            <div style={{
                                position: 'absolute', top: '6px', bottom: 0,
                                left: 0, width: '2px',
                                backgroundColor: colors.primary,
                                opacity: 0.9,
                                boxShadow: `0 0 6px ${colors.primary}60`,
                            }} />
                        </div>

                        {/* Clickable seek overlay */}
                        <div onClick={seekToPosition} style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${LABEL_W}px`, right: 0,
                            cursor: 'crosshair', zIndex: 12,
                        }} />
                    </div>
                </div>
            </div>

            {/* Segment list below timeline */}
            <div style={{ marginTop: '16px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Audio Segments ({session.segments.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {session.segments.map(seg => {
                        const track = userTracks.find(t => t.userId === seg.userId);
                        const segColor = track?.color || TRACK_COLORS[0];
                        return (
                            <div key={seg.id} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                                borderRadius: borderRadius.sm, padding: '8px 12px',
                            }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: segColor, flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textPrimary, minWidth: '80px' }}>
                                    {seg.userName || seg.userId.slice(0, 8)}
                                </span>
                                <span style={{ fontSize: '11px', color: colors.textTertiary, fontFamily: 'monospace', minWidth: '60px' }}>
                                    {formatDuration(seg.durationMs)}
                                </span>
                                <span style={{ fontSize: '11px', color: colors.textTertiary, minWidth: '50px' }}>
                                    {formatSize(seg.fileSize)}
                                </span>
                                <span style={{ fontSize: '11px', color: colors.textTertiary, flex: 1 }}>
                                    {formatDate(seg.startedAt)}
                                </span>
                                <button onClick={() => playSegmentAudio(seg)} style={{
                                    background: `${segColor}22`, border: `1px solid ${segColor}44`,
                                    borderRadius: '50%', width: '24px', height: '24px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: segColor, flexShrink: 0,
                                }}>
                                    <Play size={10} style={{ marginLeft: '1px' }} />
                                </button>
                                <button onClick={() => { if (confirm('Delete this audio segment? This cannot be undone.')) onDeleteSegment(seg.id); }}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: colors.textTertiary, padding: '4px', display: 'flex', flexShrink: 0,
                                    }} title="Delete segment">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Reports for this session */}
            {session.reports.length > 0 && (
                <div style={{ marginTop: spacing.lg }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Reports ({session.reports.length})
                    </h3>
                    {session.reports.map(report => (
                        <ReportCard key={report.id} report={report} onUpdate={() => {}} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ══════════════════════════════════════════════════════════════════════════════

export function VoiceMonitorPage() {
    const { selectedGuild } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('sessions');
    const [settings, setSettings] = useState<VoiceMonitorSettings | null>(null);
    const [sessions, setSessions] = useState<VoiceSession[]>([]);
    const [sessionsTotal, setSessionsTotal] = useState(0);
    const [sessionsPage, setSessionsPage] = useState(1);
    const [reports, setReports] = useState<VoiceReport[]>([]);
    const [selectedSession, setSelectedSession] = useState<VoiceSessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reportFilter, setReportFilter] = useState<string>('');

    const guildId = selectedGuild?.id;

    const fetchSettings = useCallback(async () => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/settings/${guildId}`, { credentials: 'include' });
            if (res.ok) setSettings(await res.json());
        } catch { /* ignore */ }
    }, [guildId]);

    const fetchSessions = useCallback(async (page = 1) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/sessions/${guildId}?page=${page}&limit=20`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions);
                setSessionsTotal(data.total);
                setSessionsPage(data.page);
            }
        } catch { /* ignore */ }
    }, [guildId]);

    const fetchReports = useCallback(async () => {
        if (!guildId) return;
        const q = reportFilter ? `?status=${reportFilter}` : '';
        try {
            const res = await fetch(`${API}/api/voice-monitor/reports/${guildId}${q}`, { credentials: 'include' });
            if (res.ok) setReports(await res.json());
        } catch { /* ignore */ }
    }, [guildId, reportFilter]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchSettings(), fetchSessions(), fetchReports()]).finally(() => setLoading(false));
    }, [fetchSettings, fetchSessions, fetchReports]);

    const saveSettings = async (updates: Partial<VoiceMonitorSettings>) => {
        if (!guildId) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/voice-monitor/settings/${guildId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });
            if (res.ok) setSettings(await res.json());
        } catch { /* ignore */ }
        setSaving(false);
    };

    const updateReport = async (reportId: string, updates: { status?: string; notes?: string }) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/reports/${guildId}/${reportId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });
            if (res.ok) fetchReports();
        } catch { /* ignore */ }
    };

    const viewSession = async (sessionId: string) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/sessions/${guildId}/${sessionId}`, { credentials: 'include' });
            if (res.ok) {
                setSelectedSession(await res.json());
                setActiveTab('sessions');
            }
        } catch { /* ignore */ }
    };

    const deleteSegment = async (segmentId: string) => {
        if (!guildId || !selectedSession) return;
        try {
            const res = await fetch(`${API}/api/voice-monitor/segments/${guildId}/${segmentId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                setSelectedSession(prev => prev ? {
                    ...prev,
                    segments: prev.segments.filter(s => s.id !== segmentId),
                } : null);
            }
        } catch { /* ignore */ }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: colors.textTertiary }}>
                Loading...
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Mic size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Voice Monitor</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Record and review voice channel audio for moderation</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Voice Monitor records per-user audio in voice channels for moderation purposes. Recordings are stored securely and automatically deleted after the retention period. A one-time notice is posted to your chosen information channel when enabled.
                </p>
            </div>

            {/* Tabs — Only show when NOT in session detail view */}
            {!selectedSession && (
                <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg }}>
                    {(['sessions', 'reports', 'settings'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedSession(null); }}
                            style={{
                                padding: `${spacing.sm} ${spacing.lg}`,
                                borderRadius: borderRadius.md,
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: activeTab === tab ? colors.primary : colors.surfaceLight,
                                color: activeTab === tab ? '#fff' : colors.textSecondary,
                                fontWeight: activeTab === tab ? 600 : 400,
                                fontSize: '14px',
                                textTransform: 'capitalize',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            )}

            {/* Session Detail — DAW Timeline View */}
            {activeTab === 'sessions' && selectedSession && (
                <SegmentReviewTimeline
                    session={selectedSession}
                    onBack={() => setSelectedSession(null)}
                    onDeleteSegment={deleteSegment}
                />
            )}

            {/* Sessions List */}
            {activeTab === 'sessions' && !selectedSession && (
                <div>
                    {sessions.length === 0 ? (
                        <div style={{ color: colors.textTertiary, textAlign: 'center', padding: '60px 0' }}>
                            <Volume2 size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                            <p>No voice sessions recorded yet.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => viewSession(session.id)}
                                        style={{
                                            backgroundColor: colors.surface,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: borderRadius.md,
                                            padding: spacing.md,
                                            cursor: 'pointer',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.primary)}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                                <Hash size={16} color={colors.textTertiary} />
                                                <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{session.channelName || 'Unknown Channel'}</span>
                                                {!session.endedAt && (
                                                    <span style={{ backgroundColor: colors.success, color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: borderRadius.pill, fontWeight: 600 }}>LIVE</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, color: colors.textSecondary, fontSize: '13px', flexWrap: 'wrap' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Users size={14} /> {session._count.segments} segments
                                                </span>
                                                {session._count.reports > 0 && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.warning }}>
                                                        <AlertTriangle size={14} /> {session._count.reports} reports
                                                    </span>
                                                )}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={14} /> {formatDate(session.startedAt)}
                                                </span>
                                            </div>
                                        </div>
                                        {session.segments.length > 0 && (
                                            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                                                {[...new Set(session.segments.map(s => s.userName || s.userId))].map((name, i) => (
                                                    <span key={name} style={{
                                                        backgroundColor: `${TRACK_COLORS[i % TRACK_COLORS.length]}22`,
                                                        color: TRACK_COLORS[i % TRACK_COLORS.length],
                                                        fontSize: '11px', padding: '2px 10px', borderRadius: borderRadius.pill,
                                                        border: `1px solid ${TRACK_COLORS[i % TRACK_COLORS.length]}44`,
                                                        fontWeight: 600,
                                                    }}>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {/* Pagination */}
                            {sessionsTotal > 20 && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
                                    <button
                                        disabled={sessionsPage <= 1}
                                        onClick={() => fetchSessions(sessionsPage - 1)}
                                        style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.surfaceLight, color: colors.textPrimary, cursor: sessionsPage <= 1 ? 'default' : 'pointer', opacity: sessionsPage <= 1 ? 0.5 : 1 }}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ color: colors.textSecondary, padding: spacing.sm }}>
                                        Page {sessionsPage} of {Math.ceil(sessionsTotal / 20)}
                                    </span>
                                    <button
                                        disabled={sessionsPage >= Math.ceil(sessionsTotal / 20)}
                                        onClick={() => fetchSessions(sessionsPage + 1)}
                                        style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', backgroundColor: colors.surfaceLight, color: colors.textPrimary, cursor: sessionsPage >= Math.ceil(sessionsTotal / 20) ? 'default' : 'pointer', opacity: sessionsPage >= Math.ceil(sessionsTotal / 20) ? 0.5 : 1 }}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && !selectedSession && (
                <div>
                    <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                        {['', 'open', 'reviewed', 'resolved', 'dismissed'].map(f => (
                            <button
                                key={f}
                                onClick={() => setReportFilter(f)}
                                style={{
                                    padding: `${spacing.xs} ${spacing.md}`,
                                    borderRadius: borderRadius.pill,
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: reportFilter === f ? colors.primary : colors.surfaceLight,
                                    color: reportFilter === f ? '#fff' : colors.textSecondary,
                                    fontSize: '13px',
                                }}
                            >
                                {f || 'All'}
                            </button>
                        ))}
                    </div>

                    {reports.length === 0 ? (
                        <div style={{ color: colors.textTertiary, textAlign: 'center', padding: '60px 0' }}>
                            <Shield size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                            <p>No reports found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {reports.map(report => (
                                <ReportCard key={report.id} report={report} onUpdate={updateReport} onViewSession={viewSession} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && !selectedSession && settings && (
                <SettingsPanel settings={settings} saving={saving} onSave={saveSettings} />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report Card Component
// ═══════════════════════════════════════════════════════════════════════════════

function ReportCard({ report, onUpdate, onViewSession }: {
    report: VoiceReport;
    onUpdate: (id: string, updates: { status?: string; notes?: string }) => void;
    onViewSession?: (sessionId: string) => void;
}) {
    const [notes, setNotes] = useState(report.notes || '');
    const [editing, setEditing] = useState(false);

    const statusColors: Record<string, string> = {
        open: colors.warning,
        reviewed: colors.info,
        resolved: colors.success,
        dismissed: colors.textTertiary,
    };

    return (
        <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: '4px' }}>
                        <span style={{
                            backgroundColor: statusColors[report.status] || colors.textTertiary,
                            color: '#fff',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: borderRadius.pill,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                        }}>
                            {report.status}
                        </span>
                        <span style={{ color: colors.textTertiary, fontSize: '12px' }}>
                            {new Date(report.createdAt).toLocaleString()}
                        </span>
                    </div>
                    <p style={{ margin: '4px 0', color: colors.textPrimary }}>{report.reason}</p>
                    <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                        Reported by: {report.reporterName || report.reporterId}
                        {report.targetName && ` · Target: ${report.targetName}`}
                        {report.session?.channelName && ` · Channel: #${report.session.channelName}`}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: spacing.xs }}>
                    {report.sessionId && onViewSession && (
                        <button
                            onClick={() => onViewSession(report.sessionId!)}
                            style={{ backgroundColor: colors.surfaceLight, border: 'none', borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer', color: colors.primary }}
                            title="View session"
                        >
                            <Eye size={14} />
                        </button>
                    )}
                    {report.status === 'open' && (
                        <>
                            <button
                                onClick={() => onUpdate(report.id, { status: 'resolved' })}
                                style={{ backgroundColor: colors.surfaceLight, border: 'none', borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer', color: colors.success }}
                                title="Resolve"
                            >
                                <CheckCircle size={14} />
                            </button>
                            <button
                                onClick={() => onUpdate(report.id, { status: 'dismissed' })}
                                style={{ backgroundColor: colors.surfaceLight, border: 'none', borderRadius: borderRadius.sm, padding: '6px', cursor: 'pointer', color: colors.error }}
                                title="Dismiss"
                            >
                                <XCircle size={14} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Staff Notes */}
            {(report.notes || editing) && (
                <div style={{ marginTop: spacing.sm }}>
                    {editing ? (
                        <div style={{ display: 'flex', gap: spacing.sm }}>
                            <input
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add staff notes..."
                                style={{
                                    flex: 1,
                                    padding: spacing.sm,
                                    borderRadius: borderRadius.sm,
                                    border: `1px solid ${colors.border}`,
                                    backgroundColor: colors.surfaceLight,
                                    color: colors.textPrimary,
                                    fontSize: '13px',
                                }}
                            />
                            <button
                                onClick={() => { onUpdate(report.id, { notes }); setEditing(false); }}
                                style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.sm, border: 'none', backgroundColor: colors.primary, color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                            >
                                Save
                            </button>
                        </div>
                    ) : (
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', fontStyle: 'italic' }}>
                            Note: {report.notes}
                        </p>
                    )}
                </div>
            )}
            {!editing && !report.notes && (
                <button
                    onClick={() => setEditing(true)}
                    style={{ backgroundColor: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: '12px', padding: '4px 0', marginTop: '4px' }}
                >
                    + Add note
                </button>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Settings Panel
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsPanel({ settings, saving, onSave }: {
    settings: VoiceMonitorSettings;
    saving: boolean;
    onSave: (updates: Partial<VoiceMonitorSettings>) => void;
}) {
    const [enabled, setEnabled] = useState(settings.enabled);
    const [retentionDays, setRetentionDays] = useState(settings.retentionDays);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {/* Enable Toggle */}
            <div style={{
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, padding: spacing.lg,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: colors.textPrimary }}>Voice Monitoring</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Enable recording of voice channel audio.</p>
                </div>
                <button
                    onClick={() => { setEnabled(!enabled); onSave({ enabled: !enabled }); }}
                    disabled={saving}
                    style={{
                        width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                        backgroundColor: enabled ? colors.primary : colors.surfaceLight,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        position: 'relative', transition: 'background-color 0.2s',
                    }}
                >
                    <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
                        position: 'absolute', top: '3px',
                        left: enabled ? '25px' : '3px',
                        transition: 'left 0.2s',
                    }} />
                </button>
            </div>

            {/* Retention */}
            <div style={{
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, padding: spacing.lg,
            }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: colors.textPrimary }}>Retention Period</h3>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: colors.textSecondary }}>How long recordings are stored before automatic deletion.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <input
                        type="number" min={1} max={365} value={retentionDays}
                        onChange={e => setRetentionDays(parseInt(e.target.value) || 30)}
                        style={{
                            width: '80px', padding: spacing.sm, borderRadius: borderRadius.sm,
                            border: `1px solid ${colors.border}`, backgroundColor: colors.surfaceLight,
                            color: colors.textPrimary, fontSize: '14px', textAlign: 'center',
                        }}
                    />
                    <span style={{ color: colors.textSecondary, fontSize: '13px' }}>days</span>
                    <button
                        onClick={() => onSave({ retentionDays })}
                        disabled={saving || retentionDays === settings.retentionDays}
                        style={{
                            marginLeft: 'auto', padding: `${spacing.sm} ${spacing.lg}`,
                            borderRadius: borderRadius.sm, border: 'none',
                            backgroundColor: colors.primary, color: '#fff',
                            cursor: saving || retentionDays === settings.retentionDays ? 'not-allowed' : 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            opacity: saving || retentionDays === settings.retentionDays ? 0.5 : 1,
                        }}
                    >
                        {saving ? 'Saving...' : 'Update'}
                    </button>
                </div>
            </div>
        </div>
    );
}
