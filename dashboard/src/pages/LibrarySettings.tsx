import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useMobile } from '../hooks/useMobile';
import { useAuth } from '../components/AuthProvider';
import { Music, Package, ExternalLink } from 'lucide-react';
import axios from 'axios';

interface Pack {
    id: string;
    name: string;
    author: string;
    coverUrl?: string;
    sampleCount: number;
    tags: string[];
}

export const LibrarySettings: React.FC = () => {
    const isMobile = useMobile();
    const { selectedGuild } = useAuth();
    const [packs, setPacks] = useState<Pack[]>([]);
    const [sampleCount, setSampleCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [samplesRes, packsRes] = await Promise.all([
                    axios.get('/api/fuji/samples/search', { params: { guildId: selectedGuild?.id } }),
                    axios.get('/api/fuji/libraries', { params: { guildId: selectedGuild?.id } })
                ]);
                setSampleCount(samplesRes.data?.length || 0);
                setPacks(packsRes.data || []);
            } catch (err) {
                console.error('Failed to fetch library data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedGuild?.id]);

    const statCardStyle: React.CSSProperties = {
        background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))',
        border: '1px solid #3E455633',
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        textAlign: 'center',
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '16px' : '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '8px' : '0' }}>
                    <Music size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '32px' }}>Sample Library</h1>
                </div>
                {!isMobile && (
                    <div style={{ marginLeft: '16px' }}>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage your server's sample library and packs.</p>
                    </div>
                )}
            </div>
            {isMobile && <p style={{ margin: '0 0 16px', color: colors.textSecondary }}>Manage your server's sample library and packs.</p>}

            {/* Explanation Block */}
            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '15px' }}>
                    The sample library lets members browse, preview, and download loops and one-shots organized into packs. Members can access it from the public Library tab.
                </p>
            </div>

            {loading ? (
                <p style={{ color: colors.textSecondary, textAlign: 'center', padding: '32px' }}>Loading library data...</p>
            ) : (
                <>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
                        <div style={statCardStyle}>
                            <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 800, color: colors.primary }}>{sampleCount}</p>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Total Samples</p>
                        </div>
                        <div style={statCardStyle}>
                            <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 800, color: colors.primary }}>{packs.length}</p>
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Sample Packs</p>
                        </div>
                        <div style={{ ...statCardStyle, gridColumn: isMobile ? '1 / -1' : 'auto', cursor: 'pointer' }} onClick={() => window.open('/library', '_blank')}>
                            <ExternalLink size={28} color={colors.primary} style={{ margin: '0 auto 4px' }} />
                            <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>Open Public Library</p>
                        </div>
                    </div>

                    {/* Packs List */}
                    <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                            <Package size={18} color={colors.primary} /> Sample Packs
                        </h3>
                        {packs.length === 0 ? (
                            <p style={{ color: colors.textSecondary, textAlign: 'center', padding: '24px', fontSize: '14px' }}>
                                No sample packs found. Packs will appear here once audio files are uploaded.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {packs.map(pack => (
                                    <div key={pack.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {pack.coverUrl ? (
                                            <img src={pack.coverUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Music size={18} color={colors.textSecondary} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pack.name}</div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>by {pack.author} &bull; {pack.sampleCount} samples</div>
                                        </div>
                                        {pack.tags.length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {pack.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: colors.primary + '15', color: colors.primary, fontWeight: 600 }}>{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
