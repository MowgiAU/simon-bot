import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors } from '../theme/theme';
import { BarChart3, Play, TrendingUp, TrendingDown, Minus, Clock, Trophy, ChevronDown, Repeat2 } from 'lucide-react';
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

const periodLabels: Record<string, string> = {
    daily: 'Today\'s Top 50',
    weekly: 'This Week\'s Top 50',
    alltime: 'All-Time Top 50',
};

const periodDescriptions: Record<string, string> = {
    daily: 'Ranked by plays in the last 24 hours',
    weekly: 'Ranked by plays in the last 7 days',
    alltime: 'Ranked by total play count',
};

export const ChartsPage: React.FC = () => {
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'alltime'>('daily');
    const [chart, setChart] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const { setTrack } = usePlayer();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [reposts, setReposts] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    const playAll = () => {
        if (!chart || chart.entries.length === 0) return;
        const tracks = chart.entries.map(e => ({
            id: e.track.id,
            title: e.track.title,
            slug: e.track.slug,
            url: e.track.url,
            coverUrl: e.track.coverUrl,
            playCount: e.track.playCount,
            profile: e.track.profile,
        }));
        setTrack(tracks[0], tracks);
    };

    const formatPlays = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toString();
    };

    return (
        <DiscoveryLayout activeTab="charts">
            <div style={{ padding: isMobile ? '16px' : '32px 48px', maxWidth: '1300px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '28px', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ backgroundColor: `${colors.primary}20`, borderRadius: '12px', padding: '10px', display: 'flex' }}>
                            <BarChart3 size={28} color={colors.primary} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Charts</h1>
                            <p style={{ margin: '2px 0 0', color: '#B9C3CE', fontSize: '13px' }}>{periodDescriptions[period]}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={playAll} disabled={!chart || chart.entries.length === 0} style={{
                            backgroundColor: colors.primary, color: 'white', border: 'none', padding: '10px 20px',
                            borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', opacity: !chart || chart.entries.length === 0 ? 0.5 : 1,
                        }}>
                            <Play size={14} fill="white" /> Play All
                        </button>
                    </div>
                </div>

                {/* Period Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {(['daily', 'weekly', 'alltime'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} style={{
                            flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            backgroundColor: period === p ? `${colors.primary}33` : 'transparent',
                            color: period === p ? colors.primary : '#B9C3CE',
                            fontSize: '12px', fontWeight: '700', textTransform: 'capitalize', transition: 'all 0.15s',
                        }}>
                            {p === 'alltime' ? 'All Time' : p === 'daily' ? 'Daily' : 'Weekly'}
                        </button>
                    ))}
                </div>

                {/* Chart Updated */}
                {chart?.takenAt && (
                    <p style={{ fontSize: '11px', color: '#B9C3CE', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={11} /> Updated {new Date(chart.takenAt).toLocaleString()}
                    </p>
                )}

                {/* Column Headers */}
                {!loading && chart && chart.entries.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px', gap: '12px' }}>
                        <span style={{ width: '32px', fontSize: '9px', color: '#B9C3CE', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>#</span>
                        <span style={{ width: '32px', fontSize: '9px', color: '#B9C3CE', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>+/-</span>
                        <span style={{ width: isMobile ? '36px' : '44px' }} />
                        <span style={{ flex: 1, fontSize: '9px', color: '#B9C3CE', fontWeight: 700, textTransform: 'uppercase' }}>Track</span>
                        {!isMobile && <span style={{ width: '60px', fontSize: '9px', color: '#B9C3CE', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Peak</span>}
                        {!isMobile && <span style={{ width: '50px', fontSize: '9px', color: '#B9C3CE', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Wks</span>}
                        <span style={{ width: '65px', fontSize: '9px', color: '#B9C3CE', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Plays</span>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#B9C3CE' }}>
                        <BarChart3 size={40} opacity={0.2} style={{ marginBottom: '12px' }} />
                        <p>Loading charts...</p>
                    </div>
                )}

                {/* Empty */}
                {!loading && (!chart || chart.entries.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#B9C3CE' }}>
                        <BarChart3 size={40} opacity={0.2} style={{ marginBottom: '12px' }} />
                        <p style={{ fontWeight: 600 }}>No chart data yet</p>
                        <p style={{ fontSize: '12px' }}>Charts are generated automatically — check back soon!</p>
                    </div>
                )}

                {/* Chart Entries */}
                {!loading && chart && chart.entries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {chart.entries.map((entry, idx) => {
                            const posChange = entry.positionChange;
                            const isUp = posChange != null && posChange > 0;
                            const isDown = posChange != null && posChange < 0;
                            const isNew = entry.prevPosition == null;
                            const isNo1 = entry.position === 1;

                            const badgeBg = isNew ? 'rgba(59,168,134,0.2)' : isUp ? 'rgba(74,222,128,0.15)' : isDown ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)';
                            const badgeColor = isNew ? colors.primary : isUp ? '#4ADE80' : isDown ? '#F87171' : '#B9C3CE';
                            const badgeText = isNew ? 'NEW' : isUp ? `+${posChange}` : isDown ? `${posChange}` : '—';

                            const rankColor = entry.position === 1 ? '#FFD700' : entry.position === 2 ? '#C0C0C0' : entry.position === 3 ? '#CD7F32' : '#B9C3CE';

                            return (
                                <div key={entry.track.id}
                                    onClick={() => {
                                        const tracks = chart.entries.map(e => ({
                                            id: e.track.id, title: e.track.title, slug: e.track.slug,
                                            url: e.track.url, coverUrl: e.track.coverUrl, playCount: e.track.playCount,
                                            profile: e.track.profile,
                                        }));
                                        setTrack(tracks[idx], tracks);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                                        borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s',
                                        backgroundColor: isNo1 ? 'rgba(255,215,0,0.04)' : 'transparent',
                                        borderLeft: isNo1 ? '3px solid #FFD700' : '3px solid transparent',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.backgroundColor = isNo1 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.04)';
                                        const overlay = e.currentTarget.querySelector('[data-play]') as HTMLElement;
                                        if (overlay) overlay.style.opacity = '1';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.backgroundColor = isNo1 ? 'rgba(255,215,0,0.04)' : 'transparent';
                                        const overlay = e.currentTarget.querySelector('[data-play]') as HTMLElement;
                                        if (overlay) overlay.style.opacity = '0';
                                    }}
                                >
                                    {/* Rank */}
                                    <span style={{ width: '32px', textAlign: 'center', fontSize: '15px', fontWeight: 800, color: rankColor, flexShrink: 0 }}>
                                        {entry.position}
                                    </span>

                                    {/* Position Change Badge */}
                                    <span style={{
                                        width: '32px', textAlign: 'center', fontSize: '9px', fontWeight: 700,
                                        backgroundColor: badgeBg, color: badgeColor,
                                        padding: '3px 0', borderRadius: '4px', flexShrink: 0,
                                    }}>
                                        {badgeText}
                                    </span>

                                    {/* Cover */}
                                    <div style={{ position: 'relative', width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#1A1E2E', flexShrink: 0 }}>
                                        {entry.track.coverUrl ? (
                                            <img src={entry.track.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FujiLogo size={18} color={colors.primary} opacity={0.2} />
                                            </div>
                                        )}
                                        <div data-play="" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}>
                                            <Play size={16} fill="white" color="white" />
                                        </div>
                                    </div>

                                    {/* Track Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {entry.track.title}
                                        </p>
                                        <Link to={`/profile/${entry.track.profile.username}`} onClick={e => e.stopPropagation()} style={{ fontSize: '11px', color: '#B9C3CE', textDecoration: 'none', margin: 0 }}>
                                            {entry.track.profile.displayName || entry.track.profile.username}
                                        </Link>
                                    </div>

                                    {/* Peak Position (desktop) */}
                                    {!isMobile && (
                                        <div style={{ width: '60px', textAlign: 'center', flexShrink: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                                <Trophy size={10} color="#FFD700" />
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#B9C3CE' }}>{entry.peakPosition}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Weeks on Chart (desktop) */}
                                    {!isMobile && (
                                        <div style={{ width: '50px', textAlign: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#B9C3CE' }}>{entry.weeksOnChart}</span>
                                        </div>
                                    )}

                                    {/* Play Count */}
                                    <div style={{ width: '65px', textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>{formatPlays(entry.playsInPeriod)}</p>
                                        <p style={{ fontSize: '8px', color: '#B9C3CE', margin: 0, textTransform: 'uppercase' }}>plays</p>
                                    </div>
                                    {/* Repost button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); axios.post(`/api/tracks/${entry.track.id}/repost`, {}, { withCredentials: true }).then(res => setReposts(prev => ({ ...prev, [entry.track.id]: res.data.reposted }))).catch(() => {}); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: reposts[entry.track.id] ? colors.primary : '#B9C3CE', padding: '4px', flexShrink: 0, transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={e => { if (!reposts[entry.track.id]) e.currentTarget.style.color = colors.primary; }}
                                        onMouseLeave={e => { if (!reposts[entry.track.id]) e.currentTarget.style.color = '#B9C3CE'; }}
                                    >
                                        <Repeat2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};
