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
    const { selectedGuild } = useAuth();
    const [samples, setSamples] = useState<Sample[]>([]);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'browse' | 'packs' | 'likes'>('browse');
    const [loading, setLoading] = useState(false);
    
    // Audio Player State
    const [currentSample, setCurrentSample] = useState<Sample | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(new Audio());

    useEffect(() => {
        const audio = audioRef.current;
        
        const updateProgress = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
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
            await axios.post(`/api/fuji/samples/${sample.id}/like`, { guildId: selectedGuild?.id });
        } catch (err) {
            // Revert on error
            setSamples(prev => prev.map(s => s.id === sample.id ? { ...s, isLiked: s.isLiked } : s));
        }
    };

    const downloadSample = (sample: Sample) => {
        window.open(`/api/fuji/download/${sample.attachmentId}`, '_blank');
    };

    return (
        <DiscoveryLayout activeTab="samples" onSearchChange={setSearch} search={search} searchPlaceholder="Search loops, one-shots...">
            <div style={{ padding: spacing.xl, color: colors.textPrimary, height: '100%', display: 'flex', flexDirection: 'column' }}>
                
                {/* Content Area */}
                <div style={{ display: 'flex', flex: 1, gap: spacing.xl, overflow: 'hidden' }}>
                    {/* Sidebar Navigation */}
                    <div style={{ width: '200px', flexShrink: 0 }}>
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
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
                                        padding: '12px 16px',
                                        borderRadius: borderRadius.md,
                                        cursor: 'pointer',
                                        backgroundColor: activeTab === item.id ? colors.primary + '20' : 'transparent',
                                        color: activeTab === item.id ? colors.primary : colors.textSecondary,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <item.icon size={18} style={{ marginRight: spacing.md }} />
                                    <span style={{ fontWeight: 600 }}>{item.label}</span>
                                </div>
                            ))}
                        </nav>
                    </div>

                    {/* Main Grid */}
                    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#111', borderRadius: borderRadius.lg, padding: spacing.lg, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ color: colors.textSecondary, fontSize: '12px', textAlign: 'left', borderBottom: `1px solid ${colors.border}22` }}>
                                    <th style={{ paddingBottom: spacing.md, width: '40px' }}></th>
                                    <th style={{ paddingBottom: spacing.md }}>NAME</th>
                                    <th style={{ paddingBottom: spacing.md }}>BPM</th>
                                    <th style={{ paddingBottom: spacing.md }}>KEY</th>
                                    <th style={{ paddingBottom: spacing.md, textAlign: 'right' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: '#eee' }}>
                                {samples.map(sample => (
                                    <tr 
                                        key={sample.id} 
                                        style={{ borderBottom: `1px solid ${colors.border}08`, transition: 'background 0.2s', cursor: 'pointer' }}
                                        onClick={() => handlePlayPause(sample)}
                                    >
                                        <td style={{ padding: '16px 0' }}>
                                            <div style={{ color: currentSample?.id === sample.id && isPlaying ? colors.primary : colors.textSecondary }}>
                                                {currentSample?.id === sample.id && isPlaying ? <Pause size={18} /> : <Play size={18} />}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{sample.filename}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>{sample.isLoop ? 'Loop' : 'One-shot'} {sample.pack?.name ? `• ${sample.pack.name}` : ''}</div>
                                        </td>
                                        <td style={{ color: colors.textSecondary }}>{sample.bpm || '--'}</td>
                                        <td>
                                            <span style={{ backgroundColor: colors.primary + '15', color: colors.primary, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                                                {sample.key || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end', color: colors.textSecondary }} onClick={e => e.stopPropagation()}>
                                                <Heart 
                                                    size={18} 
                                                    onClick={() => toggleLike(sample)}
                                                    fill={sample.isLiked ? colors.error : 'none'} 
                                                    color={sample.isLiked ? colors.error : 'currentColor'}
                                                />
                                                <Download size={18} onClick={() => downloadSample(sample)} style={{ cursor: 'pointer' }} />
                                                <MoreHorizontal size={18} />
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
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        height: '90px', 
                        backgroundColor: '#111', 
                        borderTop: `1px solid ${colors.border}`, 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: `0 ${spacing.xl}`, 
                        zIndex: 100 
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `${colors.primary}20` }}>
                            <div style={{ height: '100%', background: colors.primary, width: `${progress}%`, transition: 'width 0.1s linear' }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', width: '30%' }}>
                            <div style={{ width: '56px', height: '56px', backgroundColor: '#222', borderRadius: borderRadius.md, marginRight: spacing.md, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               {currentSample.pack?.coverUrl ? <img src={currentSample.pack.coverUrl} style={{ width: '100%', borderRadius: borderRadius.md }} alt="cover" /> : <Music size={24} color={colors.primary} />}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{currentSample.filename}</div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary }}>{currentSample.pack?.name || 'Fuji Local'}</div>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: spacing.xl }}>
                            <SkipBack size={20} color={colors.textSecondary} />
                            <div 
                                onClick={() => handlePlayPause(currentSample)}
                                style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                {isPlaying ? <Pause color="black" fill="black" /> : <Play color="black" fill="black" style={{ marginLeft: '4px' }} />}
                            </div>
                            <SkipForward size={20} color={colors.textSecondary} />
                        </div>

                        <div style={{ width: '30%', display: 'flex', justifyContent: 'flex-end', gap: spacing.md, alignItems: 'center' }}>
                            <Volume2 size={20} color={colors.textSecondary} />
                            <div style={{ width: '100px', height: '4px', backgroundColor: `${colors.border}`, borderRadius: '2px' }}>
                                <div style={{ width: '70%', height: '100%', background: 'white', borderRadius: '2px' }} />
                            </div>
                            <Download 
                                size={20} 
                                color={colors.primary} 
                                style={{ cursor: 'pointer', marginLeft: spacing.md }}
                                onClick={() => downloadSample(currentSample)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </DiscoveryLayout>
    );
};

export default FujiStudio;
