import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Users, GitMerge, RefreshCw, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

interface Profile {
    id: string;
    userId: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    createdAt: string;
    totalPlays: number;
    _count: { tracks: number };
}

interface DuplicateEntry {
    user: { id: string; discordId: string; username: string; email: string | null };
    profiles: Profile[];
}

export const DuplicateProfilesPage: React.FC = () => {
    const { user, refreshAccountStatus } = useAuth();
    const [data, setData] = useState<DuplicateEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [consolidating, setConsolidating] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/duplicate-profiles', { credentials: 'include' });
            if (res.ok) setData(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggle = (id: string) => setExpanded(s => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const consolidate = async (entry: DuplicateEntry) => {
        setConsolidating(entry.user.id);
        setConfirmId(null);
        try {
            const res = await fetch('/api/admin/consolidate-profile', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ internalUserId: entry.user.id }),
            });
            const d = await res.json();
            if (res.ok) {
                setResults(r => ({ ...r, [entry.user.id]: { ok: true, msg: `Merged — ${d.tracksKept} tracks kept on winning profile` } }));
                setData(prev => prev.filter(e => e.user.id !== entry.user.id));
                // If the admin just consolidated their own account, refresh auth so
                // profileUsername and profileAvatar reflect the merged profile immediately.
                if (user && (entry.user.id === user._localId || entry.user.discordId === user.id)) {
                    refreshAccountStatus();
                }
            } else {
                setResults(r => ({ ...r, [entry.user.id]: { ok: false, msg: d.error || 'Failed' } }));
            }
        } catch {
            setResults(r => ({ ...r, [entry.user.id]: { ok: false, msg: 'Request failed' } }));
        } finally {
            setConsolidating(null);
        }
    };

    const winner = (profiles: Profile[]) =>
        [...profiles].sort((a, b) => b._count.tracks !== a._count.tracks ? b._count.tracks - a._count.tracks : 0)[0];

    const cardStyle: React.CSSProperties = {
        background: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg, marginBottom: '12px', overflow: 'hidden',
    };

    return (
        <div style={{ padding: `${spacing['3xl']} ${spacing.lg}`, maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <GitMerge size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Duplicate Profiles</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Users with two MusicianProfile rows (Discord ID + internal ID). Consolidation moves all tracks, genres, follows, and comments to one profile — nothing is deleted until all data is safely transferred.
                    </p>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: '8px 14px', color: colors.textPrimary, cursor: 'pointer', fontSize: '13px' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: borderRadius.md, padding: '12px 16px', marginBottom: '24px', display: 'flex', gap: '10px' }}>
                <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                    <strong style={{ color: colors.textPrimary }}>Safe to run.</strong> Consolidation moves all data to the profile with the most tracks before deleting the empty duplicate. Each step is logged. The operation cannot be undone — verify the track counts look correct before confirming.
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>Scanning for duplicates…</div>
            ) : data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>
                    <CheckCircle size={32} color={colors.primary} style={{ display: 'block', margin: '0 auto 12px' }} />
                    No duplicate profiles found.
                </div>
            ) : (
                <>
                    <div style={{ marginBottom: '16px', color: colors.textSecondary, fontSize: '13px' }}>
                        {data.length} user{data.length !== 1 ? 's' : ''} with duplicate profiles
                    </div>

                    {data.map(entry => {
                        const w = winner(entry.profiles);
                        const isOpen = expanded.has(entry.user.id);
                        const result = results[entry.user.id];
                        const totalTracks = entry.profiles.reduce((s, p) => s + p._count.tracks, 0);

                        return (
                            <div key={entry.user.id} style={cardStyle}>
                                {/* Header row */}
                                <div
                                    onClick={() => toggle(entry.user.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
                                >
                                    <Users size={18} color={colors.textSecondary} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '14px' }}>{entry.user.username}</div>
                                        <div style={{ fontSize: '12px', color: colors.textTertiary }}>
                                            {entry.user.email || 'no email'} · {entry.profiles.length} profiles · {totalTracks} total tracks
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '99px', padding: '2px 8px', fontWeight: 600 }}>
                                            {entry.profiles.length} profiles
                                        </span>
                                        {isOpen ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                    <div style={{ borderTop: `1px solid ${colors.border}`, padding: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                            {entry.profiles.map(p => {
                                                const isWinner = p.id === w.id;
                                                return (
                                                    <div key={p.id} style={{ background: colors.background, borderRadius: borderRadius.md, padding: '12px', border: `1px solid ${isWinner ? 'rgba(242, 120, 10,0.3)' : colors.border}` }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                            {isWinner && <span style={{ fontSize: '10px', background: 'rgba(242, 120, 10,0.15)', color: colors.primary, border: '1px solid rgba(242, 120, 10,0.3)', borderRadius: '99px', padding: '1px 6px', fontWeight: 700 }}>WINNER (kept)</span>}
                                                            {!isWinner && <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '99px', padding: '1px 6px', fontWeight: 700 }}>DUPLICATE (removed)</span>}
                                                        </div>
                                                        {[
                                                            ['userId', p.userId],
                                                            ['Profile ID', p.id],
                                                            ['Username', p.username],
                                                            ['Display name', p.displayName || '—'],
                                                            ['Tracks', String(p._count.tracks)],
                                                            ['Total plays', p.totalPlays.toLocaleString()],
                                                            ['Created', new Date(p.createdAt).toLocaleDateString()],
                                                        ].map(([label, value]) => (
                                                            <div key={label} style={{ display: 'flex', gap: '8px', fontSize: '12px', marginBottom: '3px' }}>
                                                                <span style={{ color: colors.textTertiary, minWidth: '90px', flexShrink: 0 }}>{label}</span>
                                                                <span style={{ color: colors.textPrimary, fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '11px' }}>{value}</span>
                                                            </div>
                                                        ))}
                                                        {p.bio && <div style={{ marginTop: '6px', fontSize: '11px', color: colors.textSecondary, fontStyle: 'italic' }}>"{p.bio.slice(0, 80)}{p.bio.length > 80 ? '…' : ''}"</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '12px', background: colors.background, padding: '10px 12px', borderRadius: borderRadius.sm }}>
                                            <strong style={{ color: colors.textPrimary }}>What will happen:</strong> All {entry.profiles.find(p => p.id !== w.id)?._count.tracks ?? 0} tracks from the duplicate will move to the winning profile. Genres, collaborators, follows, and profile comments are transferred. Missing bio/avatar/DAW data is copied across. The empty duplicate is then deleted.
                                        </div>

                                        {result ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: borderRadius.md, background: result.ok ? 'rgba(242, 120, 10,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.ok ? 'rgba(242, 120, 10,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                                                {result.ok ? <CheckCircle size={14} color={colors.primary} /> : <AlertTriangle size={14} color="#f87171" />}
                                                <span style={{ fontSize: '13px', color: result.ok ? colors.primary : '#f87171', fontWeight: 600 }}>{result.msg}</span>
                                            </div>
                                        ) : confirmId === entry.user.id ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '13px', color: colors.textSecondary }}>Are you sure? This cannot be undone.</span>
                                                <button
                                                    onClick={() => consolidate(entry)}
                                                    disabled={consolidating === entry.user.id}
                                                    style={{ background: colors.primary, border: 'none', borderRadius: borderRadius.md, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                                                >
                                                    {consolidating === entry.user.id ? 'Merging…' : 'Confirm Merge'}
                                                </button>
                                                <button onClick={() => setConfirmId(null)} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: '8px 14px', color: colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmId(entry.user.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${colors.primary}15`, border: `1px solid ${colors.primary}40`, borderRadius: borderRadius.md, padding: '9px 18px', color: colors.primary, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                                            >
                                                <GitMerge size={15} /> Consolidate Profiles
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};
