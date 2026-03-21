import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors } from '../theme/theme';
import { Play, Trophy, Clock, Repeat2, Crown, Flame, TrendingUp, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { FujiLogo } from '../components/FujiLogo';

interface ChartTrack {
    id: string;
    title: string;
    slug: string | null;
    url: string;
    coverUrl: string | null;
    playCount: number;
    profile: {
        userId: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
    };
}

interface ChartEntry {
    position: number;
    prevPosition: number | null;
    positionChange: number | null;
    peakPosition: number;
    weeksOnChart: number;
    playsInPeriod: number;
    track: ChartTrack;
}

interface ChartData {
    id: string;
    period: string;
    takenAt: string;
    entries: ChartEntry[];
}

const periodMeta: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
    daily: { label: 'Daily', icon: <Flame size={14} />, desc: 'Top tracks in the last 24 hours' },
    weekly: { label: 'Weekly', icon: <TrendingUp size={14} />, desc: 'Most played this week' },
    alltime: { label: 'All Time', icon: <Crown size={14} />, desc: 'The greatest of all time' },
};

const formatPlays = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
};

const CoverArt: React.FC<{ src: string | null; size: number; radius?: string }> = ({ src, size, radius = '8px' }) => (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.sidebarBg, flexShrink: 0 }}>
        {src ? (
            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" loading="lazy" />
        ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FujiLogo size={size * 0.4} color={colors.primary} opacity={0.15} />
            </div>
        )}
    </div>
);

const MovementBadge: React.FC<{ entry: ChartEntry }> = ({ entry }) => {
    const c = entry.positionChange;
    const isNew = entry.prevPosition == null;
    if (isNew) return <span style={{ fontSize: '9px', fontWeight: 800, color: colors.primary, letterSpacing: '0.5px' }}>NEW</span>;
    if (c != null && c > 0) return <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ADE80' }}>+{c}</span>;
    if (c != null && c < 0) return <span style={{ fontSize: '11px', fontWeight: 700, color: '#F87171' }}>{c}</span>;
    return <span style={{ fontSize: '11px', color: colors.textTertiary }}>—</span>;
};

// ─── Hero Card for #1 ───
const HeroCard: React.FC<{ entry: ChartEntry; onPlay: () => void; reposted: boolean; onRepost: () => void }> = ({ entry, onPlay, reposted, onRepost }) => {
    const artist = entry.track.profile.displayName || entry.track.profile.username;
    return (
        <div style={{
            position: 'relative', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
            background: `linear-gradient(135deg, rgba(43,140,113,0.25) 0%, rgba(37,44,60,0.9) 60%)`,
            border: '1px solid rgba(43,140,113,0.2)',
            marginBottom: '24px',
        }} onClick={onPlay}>
            {/* Background blur from cover art */}
            {entry.track.coverUrl && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 0,
                    backgroundImage: `url(${entry.track.coverUrl})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(60px) brightness(0.3)', transform: 'scale(1.2)',
                }} />
            )}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '24px', padding: '28px 32px' }}>
                {/* Cover */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <CoverArt src={entry.track.coverUrl} size={120} radius="12px" />
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.35)', opacity: 0, transition: 'opacity 0.2s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                    >
                        <Play size={36} fill="white" color="white" />
                    </div>
                    {/* Crown badge */}
                    <div style={{
                        position: 'absolute', top: '-8px', left: '-8px',
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(255,215,0,0.4)',
                    }}>
                        <Crown size={14} color="#fff" fill="#fff" />
                    </div>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFD700', textTransform: 'uppercase', letterSpacing: '1px' }}>#1 This Period</span>
                        <MovementBadge entry={entry} />
                    </div>
                    <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.track.title}
                    </h2>
                    <Link to={`/profile/${entry.track.profile.username}`} onClick={e => e.stopPropagation()}
                        style={{ fontSize: '14px', color: colors.textSecondary, textDecoration: 'none' }}
                    >
                        {artist}
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Headphones size={13} color={colors.primary} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: colors.textPrimary }}>{formatPlays(entry.playsInPeriod)}</span>
                            <span style={{ fontSize: '11px', color: colors.textTertiary }}>plays</span>
                        </div>
                        {entry.peakPosition === 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Trophy size={12} color="#FFD700" />
                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>Peak #1</span>
                            </div>
                        )}
                        {entry.weeksOnChart > 1 && (
                            <span style={{ fontSize: '11px', color: colors.textTertiary }}>{entry.weeksOnChart} weeks on chart</span>
                        )}
                        <button onClick={e => { e.stopPropagation(); onRepost(); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: reposted ? colors.primary : colors.textTertiary, padding: 0, transition: 'color 0.2s' }}>
                            <Repeat2 size={14} /> <span style={{ fontSize: '11px' }}>Repost</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Podium for #2 and #3 ───
const PodiumCard: React.FC<{ entry: ChartEntry; medal: string; medalColor: string; onPlay: () => void }> = ({ entry, medal, medalColor, onPlay }) => {
    const artist = entry.track.profile.displayName || entry.track.profile.username;
    return (
        <div onClick={onPlay} style={{
            flex: 1, minWidth: 0, padding: '20px', borderRadius: '14px', cursor: 'pointer',
            backgroundColor: colors.surface, border: '1px solid rgba(255,255,255,0.05)',
            transition: 'border-color 0.2s, transform 0.2s',
        }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <CoverArt src={entry.track.coverUrl} size={64} radius="10px" />
                    <div style={{
                        position: 'absolute', top: '-6px', left: '-6px',
                        width: '22px', height: '22px', borderRadius: '50%',
                        backgroundColor: medalColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 800, color: '#fff', boxShadow: `0 2px 6px ${medalColor}66`,
                    }}>
                        {medal}
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.track.title}
                    </p>
                    <Link to={`/profile/${entry.track.profile.username}`} onClick={e => e.stopPropagation()}
                        style={{ fontSize: '12px', color: colors.textSecondary, textDecoration: 'none' }}>
                        {artist}
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: colors.textPrimary }}>{formatPlays(entry.playsInPeriod)} <span style={{ fontWeight: 400, color: colors.textTertiary }}>plays</span></span>
                        <MovementBadge entry={entry} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Chart Row ───
const ChartRow: React.FC<{
    entry: ChartEntry; idx: number; isMobile: boolean; reposted: boolean;
    onPlay: () => void; onRepost: () => void;
}> = ({ entry, idx, isMobile, reposted, onPlay, onRepost }) => {
    const isTop10 = entry.position <= 10;
    const rankColor = entry.position <= 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][entry.position - 1] : (isTop10 ? colors.textPrimary : colors.textTertiary);

    return (
        <div onClick={onPlay}
            style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
                padding: isMobile ? '10px 12px' : '10px 16px',
                borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; const p = e.currentTarget.querySelector('[data-play-overlay]') as HTMLElement; if (p) p.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; const p = e.currentTarget.querySelector('[data-play-overlay]') as HTMLElement; if (p) p.style.opacity = '0'; }}
        >
            {/* Rank */}
            <span style={{ width: '28px', textAlign: 'center', fontSize: isTop10 ? '15px' : '13px', fontWeight: isTop10 ? 800 : 600, color: rankColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {entry.position}
            </span>

            {/* Movement */}
            <div style={{ width: '30px', textAlign: 'center', flexShrink: 0 }}>
                <MovementBadge entry={entry} />
            </div>

            {/* Cover */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <CoverArt src={entry.track.coverUrl} size={isMobile ? 38 : 44} radius="6px" />
                <div data-play-overlay="" style={{
                    position: 'absolute', inset: 0, borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.15s',
                }}>
                    <Play size={16} fill="white" color="white" />
                </div>
            </div>

            {/* Track Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: colors.textPrimary }}>
                    {entry.track.title}
                </p>
                <Link to={`/profile/${entry.track.profile.username}`} onClick={e => e.stopPropagation()}
                    style={{ fontSize: '11px', color: colors.textSecondary, textDecoration: 'none' }}>
                    {entry.track.profile.displayName || entry.track.profile.username}
                </Link>
            </div>

            {/* Stats — desktop */}
            {!isMobile && (
                <>
                    <div style={{ width: '50px', textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <Trophy size={10} color="#FFD700" style={{ opacity: 0.6 }} />
                        <span style={{ fontSize: '12px', color: colors.textTertiary }}>{entry.peakPosition}</span>
                    </div>
                    <div style={{ width: '40px', textAlign: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: colors.textTertiary }}>{entry.weeksOnChart}w</span>
                    </div>
                </>
            )}

            {/* Plays */}
            <div style={{ width: isMobile ? '50px' : '65px', textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{formatPlays(entry.playsInPeriod)}</span>
            </div>

            {/* Repost */}
            <button onClick={e => { e.stopPropagation(); onRepost(); }}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0,
                    color: reposted ? colors.primary : colors.textTertiary, transition: 'color 0.2s', display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => { if (!reposted) e.currentTarget.style.color = colors.primary; }}
                onMouseLeave={e => { if (!reposted) e.currentTarget.style.color = colors.textTertiary; }}
            >
                <Repeat2 size={15} />
            </button>
        </div>
    );
};

// ═══════════════════════════════════════
// Main Charts Page
// ═══════════════════════════════════════
export const ChartsPage: React.FC = () => {
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'alltime'>('daily');
    const [chart, setChart] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const { setTrack } = usePlayer();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    useEffect(() => {
        setLoading(true);
        axios.get(`/api/charts/${period}`)
            .then(res => {
                setChart(res.data);
                if (res.data?.entries?.length > 0) {
                    axios.post('/api/tracks/reposts/check', { trackIds: res.data.entries.map((e: any) => e.track.id) }, { withCredentials: true })
                        .then(r => setReposts(r.data)).catch(() => {});
                }
            })
            .catch(() => setChart(null))
            .finally(() => setLoading(false));
    }, [period]);

    const allTracks = chart?.entries.map(e => ({
        id: e.track.id, title: e.track.title, slug: e.track.slug,
        url: e.track.url, coverUrl: e.track.coverUrl, playCount: e.track.playCount,
        profile: e.track.profile,
    })) || [];

    const playFrom = (idx: number) => {
        if (allTracks.length > 0) setTrack(allTracks[idx], allTracks);
    };

    const toggleRepost = (trackId: string) => {
        axios.post(`/api/tracks/${trackId}/repost`, {}, { withCredentials: true })
            .then(res => setReposts(prev => ({ ...prev, [trackId]: res.data.reposted })))
            .catch(() => {});
    };

    const entries = chart?.entries || [];
    const hero = entries[0];
    const podium = entries.slice(1, 3);
    const rest = entries.slice(3);

    return (
        <DiscoveryLayout activeTab="charts">
            <div style={{ padding: isMobile ? '16px' : '28px 48px', maxWidth: '1200px', margin: '0 auto' }}>

                {/* ─── Header Row ─── */}
                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '20px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <TrendingUp size={24} color={colors.primary} /> Charts
                        </h1>
                        {chart?.takenAt && (
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={11} /> Updated {new Date(chart.takenAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <button onClick={() => playFrom(0)} disabled={allTracks.length === 0}
                        style={{
                            backgroundColor: colors.primary, color: '#fff', border: 'none', padding: '10px 22px',
                            borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '7px',
                            opacity: allTracks.length === 0 ? 0.4 : 1, transition: 'opacity 0.2s',
                        }}>
                        <Play size={14} fill="white" /> Play All
                    </button>
                </div>

                {/* ─── Period Switcher ─── */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
                    {(['daily', 'weekly', 'alltime'] as const).map(p => {
                        const active = period === p;
                        const meta = periodMeta[p];
                        return (
                            <button key={p} onClick={() => setPeriod(p)} style={{
                                padding: '9px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                backgroundColor: active ? colors.primary : 'rgba(255,255,255,0.06)',
                                color: active ? '#fff' : colors.textSecondary,
                                fontSize: '12px', fontWeight: 700, transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                {meta.icon} {meta.label}
                            </button>
                        );
                    })}
                </div>

                {/* ─── Loading ─── */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textTertiary }}>
                        <div style={{ width: '40px', height: '40px', border: `3px solid ${colors.surface}`, borderTopColor: colors.primary, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
                        <p style={{ fontSize: '14px' }}>Loading charts...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* ─── Empty ─── */}
                {!loading && entries.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textTertiary }}>
                        <TrendingUp size={48} style={{ opacity: 0.15, marginBottom: '16px' }} />
                        <p style={{ fontSize: '16px', fontWeight: 600, color: colors.textSecondary }}>No chart data yet</p>
                        <p style={{ fontSize: '13px' }}>Charts are generated automatically — check back soon!</p>
                    </div>
                )}

                {/* ─── Chart Content ─── */}
                {!loading && entries.length > 0 && (
                    <>
                        {/* Hero — #1 */}
                        {hero && (
                            <HeroCard
                                entry={hero}
                                onPlay={() => playFrom(0)}
                                reposted={!!reposts[hero.track.id]}
                                onRepost={() => toggleRepost(hero.track.id)}
                            />
                        )}

                        {/* Podium — #2 & #3 */}
                        {podium.length > 0 && (
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexDirection: isMobile ? 'column' : 'row' }}>
                                {podium.map((e, i) => (
                                    <PodiumCard
                                        key={e.track.id}
                                        entry={e}
                                        medal={String(i + 2)}
                                        medalColor={i === 0 ? '#C0C0C0' : '#CD7F32'}
                                        onPlay={() => playFrom(i + 1)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Rest of chart */}
                        {rest.length > 0 && (
                            <div style={{
                                backgroundColor: colors.surface, borderRadius: '14px',
                                border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden',
                            }}>
                                {/* Column headers */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
                                    padding: isMobile ? '12px 12px 8px' : '12px 16px 8px',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <span style={{ width: '28px', fontSize: '9px', color: colors.textTertiary, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>#</span>
                                    <span style={{ width: '30px', fontSize: '9px', color: colors.textTertiary, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>+/-</span>
                                    <span style={{ width: isMobile ? '38px' : '44px' }} />
                                    <span style={{ flex: 1, fontSize: '9px', color: colors.textTertiary, fontWeight: 700, textTransform: 'uppercase' }}>Track</span>
                                    {!isMobile && <span style={{ width: '50px', fontSize: '9px', color: colors.textTertiary, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Peak</span>}
                                    {!isMobile && <span style={{ width: '40px', fontSize: '9px', color: colors.textTertiary, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Wks</span>}
                                    <span style={{ width: isMobile ? '50px' : '65px', fontSize: '9px', color: colors.textTertiary, fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Plays</span>
                                    <span style={{ width: '23px' }} />
                                </div>

                                {/* Rows */}
                                {rest.map((entry, idx) => (
                                    <div key={entry.track.id} style={idx < rest.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.03)' } : undefined}>
                                        <ChartRow
                                            entry={entry}
                                            idx={idx + 3}
                                            isMobile={isMobile}
                                            reposted={!!reposts[entry.track.id]}
                                            onPlay={() => playFrom(idx + 3)}
                                            onRepost={() => toggleRepost(entry.track.id)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Period description footer */}
                        <p style={{ textAlign: 'center', fontSize: '12px', color: colors.textTertiary, marginTop: '20px', padding: '8px 0' }}>
                            {periodMeta[period].desc} — {entries.length} tracks ranked
                        </p>
                    </>
                )}
            </div>
        </DiscoveryLayout>
    );
};
