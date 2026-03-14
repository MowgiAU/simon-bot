import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Trophy, Users, Play, Calendar, Building2, ArrowLeft, Vote } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

interface Battle {
    id: string;
    title: string;
    description: string | null;
    status: string;
    winnerEntryId: string | null;
    submissionStart: string | null;
    votingEnd: string | null;
    updatedAt: string;
    sponsor: { name: string; logoUrl: string | null } | null;
    entries: { id: string; userId: string; username: string; trackTitle: string; audioUrl: string; coverUrl: string | null; voteCount: number }[];
    _count: { entries: number };
}

export const BattleArchivePage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [battles, setBattles] = useState<Battle[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBattle, setExpandedBattle] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/api/beat-battle/archive?guildId=default-guild`);
                if (res.ok) setBattles(await res.json());
            } catch {} finally { setLoading(false); }
        })();
    }, []);

    const cardStyle: React.CSSProperties = {
        backgroundColor: colors.surface,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        transition: 'border-color 0.2s',
        cursor: 'pointer',
    };

    if (loading) return <div style={{ padding: '40px', color: colors.textSecondary, textAlign: 'center' }}>Loading archive...</div>;

    return (
        <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
            {onBack && (
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '14px' }}>
                    <ArrowLeft size={16} /> Back
                </button>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Trophy size={32} color="#FFD700" style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Beat Battle Archive</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Past battles, winners, and sponsors</p>
                </div>
            </div>

            {battles.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', cursor: 'default', padding: '60px 40px' }}>
                    <Trophy size={48} style={{ opacity: 0.3, marginBottom: '12px', color: colors.textSecondary }} />
                    <p style={{ color: colors.textSecondary }}>No completed battles yet. Check back soon!</p>
                </div>
            ) : (
                battles.map(b => {
                    const winner = b.entries.find(e => e.id === b.winnerEntryId) || b.entries[0];
                    const isExpanded = expandedBattle === b.id;

                    return (
                        <div
                            key={b.id}
                            style={{ ...cardStyle, borderColor: isExpanded ? `${colors.primary}55` : 'rgba(255,255,255,0.06)' }}
                            onClick={() => setExpandedBattle(isExpanded ? null : b.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>{b.title}</h3>
                                    {b.description && <p style={{ margin: '6px 0', color: colors.textSecondary, fontSize: '13px' }}>{b.description}</p>}

                                    {/* Winner */}
                                    {winner && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                            <Trophy size={16} color="#FFD700" />
                                            <span style={{ color: '#FFD700', fontWeight: 600, fontSize: '14px' }}>{winner.username}</span>
                                            <span style={{ color: colors.textSecondary, fontSize: '13px' }}>— "{winner.trackTitle}" ({winner.voteCount} votes)</span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={12} /> {b._count.entries} entries
                                        </span>
                                        {b.votingEnd && (
                                            <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} /> {new Date(b.votingEnd).toLocaleDateString()}
                                            </span>
                                        )}
                                        {b.sponsor && (
                                            <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Building2 size={12} /> {b.sponsor.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {winner?.coverUrl && (
                                    <img src={`${API}${winner.coverUrl}`} alt="" style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                )}
                            </div>

                            {/* Expanded: Top 3 */}
                            {isExpanded && b.entries.length > 0 && (
                                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }} onClick={(e) => e.stopPropagation()}>
                                    <h4 style={{ margin: '0 0 10px', color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase' }}>Top Entries</h4>
                                    {b.entries.map((e, i) => (
                                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < b.entries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '14px', minWidth: '24px', color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }}>
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                                </span>
                                                <div>
                                                    <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>{e.trackTitle}</p>
                                                    <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '11px' }}>by {e.username}</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {e.audioUrl && (
                                                    <a href={`${API}${e.audioUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                        <Play size={12} /> Play
                                                    </a>
                                                )}
                                                <span style={{ color: colors.primary, fontWeight: 700, fontSize: '14px' }}>🔥 {e.voteCount}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};
