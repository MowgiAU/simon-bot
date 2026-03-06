import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import { 
    Library, 
    Play, 
    Pause, 
    Download, 
    Heart, 
    Search, 
    ArrowRight, 
    Music, 
    Hash, 
    ChevronRight,
    FolderPlus
} from 'lucide-react';

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
    pack?: { name: string };
}

interface Pack {
    id: string;
    name: string;
    _count: { samples: number };
}

export const FujiStudio: React.FC = () => {
    const [packs, setPacks] = useState<Pack[]>([]);
    const [samples, setSamples] = useState<Sample[]>([]);
    const [search, setSearch] = useState('');
    const [selectedPack, setSelectedPack] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Audio State
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audio] = useState(new Audio());

    useEffect(() => {
        fetchPacks();
        fetchSamples();

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    const fetchPacks = async () => {
        const res = await axios.get('/api/fuji/libraries');
        setPacks(res.data);
    };

    const fetchSamples = async (q = '', packId = null) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/fuji/samples/search`, {
                params: { q, packId }
            });
            setSamples(res.data);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (val: string) => {
        setSearch(val);
        fetchSamples(val, selectedPack as any);
    };

    const togglePlay = (sample: Sample) => {
        if (playingId === sample.id) {
            audio.pause();
            setPlayingId(null);
        } else {
            audio.pause();
            audio.src = `/api/fuji/stream/${sample.attachmentId}`;
            audio.play();
            setPlayingId(sample.id);
        }
    };

    const formatSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const sidebar = (
        <div style={{ color: colors.textPrimary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Library color={colors.primary} size={24} />
                <h2 style={{ margin: 0, fontSize: '18px' }}>LIBRARIES</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button 
                    onClick={() => { setSelectedPack(null); fetchSamples(search, null); }}
                    style={{
                        textAlign: 'left', padding: '10px 16px', borderRadius: '8px', border: 'none',
                        background: !selectedPack ? `${colors.primary}15` : 'transparent',
                        color: !selectedPack ? colors.primary : colors.textSecondary,
                        fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Music size={16} /> All Samples
                </button>
                {packs.map(pack => (
                    <button 
                        key={pack.id}
                        onClick={() => { setSelectedPack(pack.id); fetchSamples(search, pack.id as any); }}
                        style={{
                            textAlign: 'left', padding: '10px 16px', borderRadius: '8px', border: 'none',
                            background: selectedPack === pack.id ? `${colors.primary}15` : 'transparent',
                            color: selectedPack === pack.id ? colors.primary : colors.textSecondary,
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FolderPlus size={16} /> {pack.name}
                        </span>
                        <span style={{ fontSize: '10px', opacity: 0.6 }}>{pack._count.samples}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <DiscoveryLayout 
            sidebar={sidebar} 
            search={search} 
            onSearchChange={handleSearch}
            searchPlaceholder="Search 808s, Snares, Loops..."
            activeTab="fuji"
        >
            <div style={{ padding: '32px' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Fuji Studio <span style={{ color: colors.primary, fontSize: '14px', verticalAlign: 'middle', background: `${colors.primary}15`, padding: '4px 8px', borderRadius: '6px', marginLeft: '12px' }}>CLOUD</span></h1>
                    <p style={{ color: colors.textSecondary, marginTop: '8px' }}>Browse and preview your high-quality sample library from Discord.</p>
                </div>

                {/* Samples List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: colors.textSecondary, padding: '40px' }}>Loading samples...</p>
                    ) : samples.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <Search size={48} color={colors.textSecondary} style={{ marginBottom: '16px', opacity: 0.3 }} />
                            <h3 style={{ margin: 0 }}>No samples found</h3>
                            <p style={{ color: colors.textSecondary }}>Try a different search term or check another library.</p>
                        </div>
                    ) : (
                        samples.map(sample => (
                            <div 
                                key={sample.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '48px 1fr 100px 100px 100px 120px',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: playingId === sample.id ? 'rgba(43, 141, 112, 0.1)' : 'rgba(255,255,255,0.03)',
                                    borderRadius: '12px',
                                    border: playingId === sample.id ? `1px solid ${colors.primary}33` : '1px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <button 
                                    onClick={() => togglePlay(sample)}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                                        background: playingId === sample.id ? colors.primary : 'rgba(255,255,255,0.1)',
                                        color: playingId === sample.id ? 'white' : colors.textPrimary,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                >
                                    {playingId === sample.id ? <Pause size={14} fill="white" /> : <Play size={14} fill="currentColor" />}
                                </button>
                                
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600 }}>{sample.filename}</div>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary }}>{sample.pack?.name || 'Unknown Pack'}</div>
                                </div>

                                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
                                    {formatDuration(sample.duration)}
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {sample.bpm && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{sample.bpm} BPM</span>}
                                    {sample.key && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{sample.key}</span>}
                                </div>

                                <div style={{ color: colors.textSecondary, fontSize: '12px', textAlign: 'right' }}>
                                    {formatSize(sample.filesize)}
                                </div>

                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><Heart size={18} /></button>
                                    <a 
                                        href={`/api/fuji/stream/${sample.attachmentId}?download=true`} 
                                        download={sample.filename}
                                        style={{ color: colors.textSecondary }}
                                    >
                                        <Download size={18} />
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DiscoveryLayout>
    );
};
