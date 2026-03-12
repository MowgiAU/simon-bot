import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import { 
    Play, 
    Pause, 
    Download, 
    Heart, 
    Search, 
    Music, 
    FolderPlus,
    Volume2,
    SkipForward,
    SkipBack,
    MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

// Interfaces
interface Sample {
    id: string;
    attachmentId: string;
    filename: string;
    filesize: number;
    duration: number | null;
    bpm: number | null;
    key: string | null;
    mimetype: string;
    packId: string;
    isLoop: boolean;
    tags: string[];
    pack?: { name: string; author?: string; coverUrl?: string };
    isLiked?: boolean;
}

interface Pack {
    id: string;
    name: string;
    author: string;
    coverUrl?: string;
    sampleCount: number;
    tags: string[];
}

export const FujiStudio: React.FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const { selectedGuild } = useAuth();
    const [samples, setSamples] = useState<Sample[]>([]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [packs, setPacks] = useState<Pack[]>([]);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'browse' | 'packs' | 'likes'>('browse');
    const [loading, setLoading] = useState(false);
    
    // Audio Player State
    const [currentSample, setCurrentSample] = useState<Sample | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sampleCurrentTime, setSampleCurrentTime] = useState(0);
    const [sampleDuration, setSampleDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(new Audio());

    useEffect(() => {
        const audio = audioRef.current;
        
        const updateProgress = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
                setSampleCurrentTime(audio.currentTime);
                setSampleDuration(audio.duration);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setSampleCurrentTime(0);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleEnded);

        fetchInitialData();

        return () => {
            audio.pause();
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [selectedGuild?.id]);

    const fetchInitialData = async () => {
        // If no guild selected, we might want to fetch global samples or handled by backend
        setLoading(true);
        try {
            const [samplesRes, packsRes] = await Promise.all([
                axios.get(`/api/fuji/samples/search`, { params: { guildId: selectedGuild?.id } }),
                axios.get(`/api/fuji/libraries`, { params: { guildId: selectedGuild?.id } })
            ]);
            setSamples(samplesRes.data);
            setPacks(packsRes.data);
        } catch (err) {
            console.error('Failed to fetch Fuji data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayPause = (sample: Sample) => {
        const audio = audioRef.current;
        if (currentSample?.id === sample.id) {
            if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
            } else {
                audio.play();
                setIsPlaying(true);
            }
        } else {
            audio.pause();
            audio.src = `/api/fuji/stream/${sample.attachmentId}`;
            setCurrentSample(sample);
            audio.play();
            setIsPlaying(true);
        }
    };

    const toggleLike = async (sample: Sample) => {
        // Optimistic UI
        setSamples(prev => prev.map(s => s.id === sample.id ? { ...s, isLiked: !s.isLiked } : s));
        try {
            await axios.post(`/api/fuji/samples/${sample.id}/like`);
        } catch (err) {
            // Revert on error
            setSamples(prev => prev.map(s => s.id === sample.id ? { ...s, isLiked: sample.isLiked } : s));
        }
    };

    const downloadSample = (sample: Sample) => {
        window.open(`/api/fuji/download/${sample.attachmentId}`, '_blank');
    };

    const handleSampleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        audioRef.current.currentTime = time;
        setSampleCurrentTime(time);
    };

    const formatSampleTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <DiscoveryLayout activeTab="library" onSearchChange={setSearch} search={search} searchPlaceholder="Search loops, one-shots...">
            <div style={{ padding: isMobile ? '12px' : spacing.xl, color: colors.textPrimary, height: '100%', display: 'flex', flexDirection: 'column' }}>
                
                {/* Content Area */}
                <div style={{ display: 'flex', flex: 1, gap: isMobile ? '0px' : spacing.xl, overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
                    {/* Sidebar Navigation */}
                    <div style={{ width: isMobile ? '100%' : '200px', flexShrink: 0, marginBottom: isMobile ? '12px' : '0' }}>
                        <nav style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: spacing.xs, overflowX: isMobile ? 'auto' : 'visible' }}>
                            {[
                                { id: 'browse', icon: Music, label: 'Browse' },
                                { id: 'packs', icon: FolderPlus, label: 'Sample Packs' },
                                { id: 'likes', icon: Heart, label: 'Favorites' }
                            ].map(item => (
                                <div 
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as any)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: isMobile ? '8px 12px' : '12px 16px',
                                        borderRadius: borderRadius.md,
                                        cursor: 'pointer',
                                        backgroundColor: activeTab === item.id ? colors.primary + '20' : 'transparent',
                                        color: activeTab === item.id ? colors.primary : colors.textSecondary,
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <item.icon size={isMobile ? 16 : 18} style={{ marginRight: isMobile ? spacing.sm : spacing.md }} />
                                    <span style={{ fontWeight: 600, fontSize: isMobile ? '13px' : 'inherit' }}>{item.label}</span>
                                </div>
                            ))}
                        </nav>
                    </div>

                    {/* Main Grid */}
                    <div style={{ 
                        flex: 1, 
                        overflowY: 'auto', 
                        backgroundColor: isMobile ? 'transparent' : '#111', 
                        borderRadius: isMobile ? '0' : borderRadius.lg, 
                        padding: isMobile ? '0' : spacing.lg,
                        paddingBottom: currentSample && isMobile ? '96px' : undefined,
                        border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)' 
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ color: colors.textSecondary, fontSize: '12px', textAlign: 'left', borderBottom: `1px solid ${colors.border}22` }}>
                                    <th style={{ paddingBottom: spacing.md, width: isMobile ? '30px' : '40px' }}></th>
                                    <th style={{ paddingBottom: spacing.md }}>NAME</th>
                                    {!isMobile && <th style={{ paddingBottom: spacing.md }}>BPM</th>}
                                    <th style={{ paddingBottom: spacing.md }}>KEY</th>
                                    <th style={{ paddingBottom: spacing.md, textAlign: 'right' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: '#eee' }}>
                                {(activeTab === 'likes' ? samples.filter(s => s.isLiked) : samples).map(sample => (
                                    <tr 
                                        key={sample.id} 
                                        style={{ borderBottom: `1px solid ${colors.border}08`, transition: 'background 0.2s', cursor: 'pointer' }}
                                        onClick={() => handlePlayPause(sample)}
                                    >
                                        <td style={{ padding: '16px 0' }}>
                                            <div style={{ color: currentSample?.id === sample.id && isPlaying ? colors.primary : colors.textSecondary }}>
                                                {currentSample?.id === sample.id && isPlaying ? <Pause size={isMobile ? 16 : 18} /> : <Play size={18} />}
                                            </div>
                                        </td>
                                        <td style={{ maxWidth: isMobile ? '120px' : 'auto', overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, fontSize: isMobile ? '13px' : 'inherit', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sample.filename}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>{sample.isLoop ? 'Loop' : 'One-shot'} {sample.pack?.name ? `• ${sample.pack.name}` : ''}</div>
                                        </td>
                                        {!isMobile && <td style={{ color: colors.textSecondary }}>{sample.bpm || '--'}</td>}
                                        <td>
                                            <span style={{ backgroundColor: colors.primary + '15', color: colors.primary, padding: '2px 8px', borderRadius: '4px', fontSize: isMobile ? '10px' : '12px', fontWeight: 700 }}>
                                                {sample.key || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: isMobile ? spacing.sm : spacing.md, justifyContent: 'flex-end', color: colors.textSecondary }} onClick={e => e.stopPropagation()}>
                                                <Heart 
                                                    size={isMobile ? 16 : 18} 
                                                    onClick={() => toggleLike(sample)}
                                                    fill={sample.isLiked ? colors.error : 'none'} 
                                                    color={sample.isLiked ? colors.error : 'currentColor'}
                                                />
                                                <Download size={isMobile ? 16 : 18} onClick={() => downloadSample(sample)} style={{ cursor: 'pointer' }} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottom Player Bar */}
                {currentSample && (
                    <div style={{ 
                        position: 'fixed', 
                        bottom: isMobile ? '60px' : 0, 
                        left: 0, 
                        right: 0, 
                        height: isMobile ? '96px' : '80px',
                        backgroundColor: '#1A1E2E', 
                        borderTop: '1px solid rgba(255,255,255,0.05)', 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: isMobile ? '0 16px' : '0 24px', 
                        zIndex: 999,
                        boxShadow: '0 -10px 25px rgba(0,0,0,0.3)'
                    }}>
                        {/* Left: cover + info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px', width: isMobile ? '45%' : '30%', minWidth: 0 }}>
                            <div style={{ width: isMobile ? '44px' : '48px', height: isMobile ? '44px' : '48px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               {currentSample.pack?.coverUrl ? <img src={currentSample.pack.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="cover" /> : <Music size={isMobile ? 18 : 22} color={colors.primary} />}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{currentSample.filename}</p>
                                <p style={{ fontSize: '11px', color: '#B9C3CE', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSample.pack?.name || 'Fuji Local'}</p>
                            </div>
                        </div>

                        {/* Center: controls + scrubber */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '40%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '24px' }}>
                                {!isMobile && <SkipBack size={18} color="#B9C3CE" style={{ cursor: 'pointer' }} />}
                                <button
                                    onClick={() => handlePlayPause(currentSample)}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'transform 0.1s' }}
                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {isPlaying ? <Pause fill="#1A1E2E" color="#1A1E2E" size={isMobile ? 22 : 20} /> : <Play fill="#1A1E2E" color="#1A1E2E" size={isMobile ? 22 : 20} style={{ marginLeft: '2px' }} />}
                                </button>
                                {!isMobile && <SkipForward size={18} color="#B9C3CE" style={{ cursor: 'pointer' }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: isMobile ? '100%' : '400px' }}>
                                {!isMobile && <span style={{ fontSize: '10px', color: 'rgba(185,195,206,0.6)', width: '35px', textAlign: 'right' }}>{formatSampleTime(sampleCurrentTime)}</span>}
                                <input type="range" min="0" max={sampleDuration || 100} value={sampleCurrentTime} onChange={handleSampleSeek} style={{ flex: 1, cursor: 'pointer', accentColor: colors.primary, height: '4px', outline: 'none' }} />
                                {!isMobile && <span style={{ fontSize: '10px', color: 'rgba(185,195,206,0.6)', width: '35px' }}>{formatSampleTime(sampleDuration)}</span>}
                            </div>
                        </div>

                        {/* Right: volume + download */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', width: isMobile ? '10%' : '30%' }}>
                            {!isMobile ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Volume2 size={18} color="#B9C3CE" />
                                    <input type="range" min="0" max="1" step="0.01" defaultValue="0.7" onChange={e => { audioRef.current.volume = parseFloat(e.target.value); }} style={{ width: '96px', height: '4px', cursor: 'pointer', accentColor: colors.primary }} />
                                    <Download size={18} color={colors.primary} style={{ cursor: 'pointer' }} onClick={() => downloadSample(currentSample)} />
                                </div>
                            ) : (
                                <Download size={18} color={colors.primary} style={{ cursor: 'pointer' }} onClick={() => downloadSample(currentSample)} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};

export default FujiStudio;
