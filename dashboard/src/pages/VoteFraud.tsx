import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import {
    ShieldAlert, RefreshCw, Trash2, UserX, ChevronDown, ChevronUp,
    AlertTriangle, CheckSquare, Square, UserCheck, Loader2,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

interface VoteRow {
    voteId: string | null;
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    email: string | null;
    banned: boolean;
    accountCreatedAt: string | null;
    rank: number;
    entryId: string;
    trackTitle: string;
    createdAt: string;
    ipSource: 'vote' | 'activity_log';
}

interface FraudGroup {
    battleId: string;
    battleTitle: string;
    ip: string;
    isCloudflareIp: boolean;
    votes: VoteRow[];
}

interface Battle {
    id: string;
    title: string;
    status: string;
}

function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
}

function rankLabel(r: number) {
    return r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `#${r}`;
}

export function VoteFraudPage() {
    const [battles, setBattles] = useState<Battle[]>([]);
    const [selectedBattleId, setSelectedBattleId] = useState('');
    const [groups, setGroups] = useState<FraudGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedVoteIds, setSelectedVoteIds] = useState<Set<string>>(new Set());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        axios.get(`${API}/api/beat-battle/battles?limit=100`)
            .then(r => {
                const list: Battle[] = Array.isArray(r.data) ? r.data : (r.data.battles || []);
                setBattles(list.sort((a: Battle, b: Battle) => a.title.localeCompare(b.title)));
            })
            .catch(() => {});
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setSelectedVoteIds(new Set());
        try {
            const params = selectedBattleId ? `?battleId=${selectedBattleId}` : '';
            const res = await axios.get(`${API}/api/admin/battles/vote-fraud${params}`);
            const data: FraudGroup[] = res.data;
            setGroups(data);
            // Auto-expand all groups
            setExpandedGroups(new Set(data.map(g => `${g.battleId}::${g.ip}`)));
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load fraud data');
        } finally {
            setLoading(false);
        }
    }, [selectedBattleId]);

    const allVoteIds = groups.flatMap(g => g.votes.map(v => v.voteId).filter((id): id is string => !!id));
    const allSelected = allVoteIds.length > 0 && allVoteIds.every(id => selectedVoteIds.has(id));

    function toggleAll() {
        if (allSelected) {
            setSelectedVoteIds(new Set());
        } else {
            setSelectedVoteIds(new Set(allVoteIds));
        }
    }

    function toggleVote(voteId: string | null) {
        if (!voteId) return;
        setSelectedVoteIds(prev => {
            const next = new Set(prev);
            if (next.has(voteId)) next.delete(voteId);
            else next.add(voteId);
            return next;
        });
    }

    function toggleGroup(key: string) {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function selectGroup(votes: VoteRow[]) {
        setSelectedVoteIds(prev => {
            const next = new Set(prev);
            votes.forEach(v => { if (v.voteId) next.add(v.voteId); });
            return next;
        });
    }

    async function removeVotes() {
        if (selectedVoteIds.size === 0) return;
        setActionLoading(true);
        setError(null);
        try {
            const res = await axios.delete(`${API}/api/admin/battles/votes`, {
                data: { voteIds: Array.from(selectedVoteIds) },
            });
            setSuccess(`Removed ${res.data.removed} vote${res.data.removed !== 1 ? 's' : ''}.`);
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to remove votes');
        } finally {
            setActionLoading(false);
        }
    }

    async function banUsers() {
        const userIds = [...new Set(
            groups.flatMap(g => g.votes.filter(v => v.voteId && selectedVoteIds.has(v.voteId)).map(v => v.userId))
        )];
        if (userIds.length === 0) return;
        setActionLoading(true);
        setError(null);
        try {
            const res = await axios.post(`${API}/api/admin/users/ban`, {
                userIds,
                reason: 'vote_fraud',
            });
            setSuccess(`Banned ${res.data.banned} account${res.data.banned !== 1 ? 's' : ''}.`);
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to ban users');
        } finally {
            setActionLoading(false);
        }
    }

    async function unbanUser(userId: string) {
        setActionLoading(true);
        setError(null);
        try {
            await axios.post(`${API}/api/admin/users/unban`, { userIds: [userId] });
            setSuccess('Account unbanned.');
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to unban user');
        } finally {
            setActionLoading(false);
        }
    }

    const selectedUsers = [...new Set(
        groups.flatMap(g => g.votes.filter(v => v.voteId && selectedVoteIds.has(v.voteId) && !v.banned).map(v => v.userId))
    )];

    return (
        <div style={{ padding: spacing.xxl, maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xxl }}>
                <ShieldAlert size={32} color={colors.error} style={{ marginRight: spacing.lg }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Vote Fraud Detection</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Identify and action suspicious votes from shared IP addresses
                    </p>
                </div>
            </div>

            {/* Info block */}
            <div style={{
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.xl,
                borderLeft: `4px solid ${colors.warning}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: 14 }}>
                    This tool surfaces battle votes where two or more different accounts voted from the same IP address.
                    Future votes are automatically blocked and logged when an IP conflict is detected — this page is for
                    reviewing historical votes and taking action on confirmed fraud.
                </p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center', marginBottom: spacing.xl, flexWrap: 'wrap' }}>
                <select
                    value={selectedBattleId}
                    onChange={e => setSelectedBattleId(e.target.value)}
                    style={{
                        background: colors.surface,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: borderRadius.md,
                        padding: '8px 12px',
                        fontSize: 14,
                        minWidth: 260,
                    }}
                >
                    <option value="">All battles</option>
                    {battles.map(b => (
                        <option key={b.id} value={b.id}>{b.title} ({b.status})</option>
                    ))}
                </select>

                <button
                    onClick={load}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: colors.primary, color: '#fff',
                        border: 'none', borderRadius: borderRadius.md,
                        padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: 14, fontWeight: 500,
                    }}
                >
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
                    {loading ? 'Loading...' : 'Check'}
                </button>

                {groups.length > 0 && (
                    <>
                        <button
                            onClick={removeVotes}
                            disabled={selectedVoteIds.size === 0 || actionLoading}
                            title={selectedVoteIds.size === 0 ? 'Select votes first' : `Remove ${selectedVoteIds.size} vote(s)`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: selectedVoteIds.size > 0 ? colors.error : colors.surfaceLight,
                                color: selectedVoteIds.size > 0 ? '#fff' : colors.textTertiary,
                                border: 'none', borderRadius: borderRadius.md,
                                padding: '8px 16px', cursor: selectedVoteIds.size > 0 && !actionLoading ? 'pointer' : 'not-allowed',
                                fontSize: 14, fontWeight: 500,
                            }}
                        >
                            <Trash2 size={16} />
                            Remove {selectedVoteIds.size > 0 ? `${selectedVoteIds.size} vote${selectedVoteIds.size !== 1 ? 's' : ''}` : 'votes'}
                        </button>

                        <button
                            onClick={banUsers}
                            disabled={selectedUsers.length === 0 || actionLoading}
                            title={selectedUsers.length === 0 ? 'Select unbanned accounts first' : `Ban ${selectedUsers.length} account(s)`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: selectedUsers.length > 0 ? '#7C3AED' : colors.surfaceLight,
                                color: selectedUsers.length > 0 ? '#fff' : colors.textTertiary,
                                border: 'none', borderRadius: borderRadius.md,
                                padding: '8px 16px', cursor: selectedUsers.length > 0 && !actionLoading ? 'pointer' : 'not-allowed',
                                fontSize: 14, fontWeight: 500,
                            }}
                        >
                            <UserX size={16} />
                            Ban {selectedUsers.length > 0 ? `${selectedUsers.length} account${selectedUsers.length !== 1 ? 's' : ''}` : 'accounts'}
                        </button>
                    </>
                )}
            </div>

            {/* Feedback */}
            {error && (
                <div style={{
                    background: `${colors.error}20`, border: `1px solid ${colors.error}40`,
                    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg,
                    color: colors.error, fontSize: 14,
                }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{
                    background: `${colors.success}20`, border: `1px solid ${colors.success}40`,
                    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg,
                    color: colors.success, fontSize: 14,
                }}>
                    {success}
                </div>
            )}

            {/* Results */}
            {groups.length === 0 && !loading && (
                <div style={{
                    background: colors.surface, borderRadius: borderRadius.lg,
                    padding: '48px', textAlign: 'center', color: colors.textTertiary,
                }}>
                    {selectedBattleId || groups.length === 0
                        ? 'No suspicious votes found. Press Check to scan.'
                        : 'No IP conflicts detected.'}
                </div>
            )}

            {groups.length > 0 && (
                <div>
                    {/* Select-all row */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: spacing.md,
                        padding: `${spacing.sm} ${spacing.md}`, marginBottom: spacing.sm,
                        color: colors.textSecondary, fontSize: 13,
                    }}>
                        <button
                            onClick={toggleAll}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: colors.textSecondary, display: 'flex', alignItems: 'center' }}
                        >
                            {allSelected ? <CheckSquare size={16} color={colors.primary} /> : <Square size={16} />}
                        </button>
                        <span>{allVoteIds.length} total suspicious vote{allVoteIds.length !== 1 ? 's' : ''} across {groups.length} IP group{groups.length !== 1 ? 's' : ''}</span>
                    </div>

                    {groups.map(group => {
                        const key = `${group.battleId}::${group.ip}`;
                        const expanded = expandedGroups.has(key);
                        const groupVoteIds = group.votes.map(v => v.voteId).filter((id): id is string => !!id);
                        const groupSelected = groupVoteIds.length > 0 && groupVoteIds.every(id => selectedVoteIds.has(id));
                        const distinctUsers = new Set(group.votes.map(v => v.userId)).size;

                        return (
                            <div key={key} style={{
                                background: colors.surface,
                                border: `1px solid ${colors.border}`,
                                borderRadius: borderRadius.lg,
                                marginBottom: spacing.md,
                                overflow: 'hidden',
                                boxShadow: shadows.sm,
                            }}>
                                {/* Group header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: spacing.md,
                                    padding: `${spacing.md} ${spacing.lg}`,
                                    cursor: 'pointer',
                                    borderBottom: expanded ? `1px solid ${colors.border}` : 'none',
                                }} onClick={() => toggleGroup(key)}>
                                    <button
                                        onClick={e => { e.stopPropagation(); selectGroup(group.votes); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: colors.textSecondary, display: 'flex', alignItems: 'center' }}
                                    >
                                        {groupSelected ? <CheckSquare size={16} color={colors.primary} /> : <Square size={16} />}
                                    </button>

                                    <AlertTriangle size={16} color={group.isCloudflareIp ? colors.textTertiary : colors.warning} />

                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600, color: colors.textPrimary, fontSize: 14 }}>
                                            {group.battleTitle}
                                        </span>
                                        <span style={{ margin: '0 8px', color: colors.textTertiary }}>·</span>
                                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: group.isCloudflareIp ? colors.textTertiary : colors.accent }}>{group.ip}</span>
                                        {group.isCloudflareIp && (
                                            <span style={{
                                                marginLeft: 6, fontSize: 11, fontWeight: 500,
                                                background: `${colors.warning}20`, color: colors.warning,
                                                borderRadius: borderRadius.sm, padding: '1px 6px',
                                            }}>
                                                Cloudflare IP — shared, review emails
                                            </span>
                                        )}
                                        <span style={{ margin: '0 8px', color: colors.textTertiary }}>·</span>
                                        <span style={{ fontSize: 13, color: colors.textSecondary }}>
                                            {distinctUsers} accounts, {group.votes.length} vote{group.votes.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {expanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                                </div>

                                {/* Vote rows */}
                                {expanded && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ color: colors.textTertiary, borderBottom: `1px solid ${colors.border}` }}>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, width: 36 }}></th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>User</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Email</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Account created</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Voted for</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Rank</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Voted at</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.votes.map((vote, i) => (
                                                <tr key={vote.voteId || `${vote.userId}-${i}`} style={{
                                                    background: vote.voteId && selectedVoteIds.has(vote.voteId)
                                                        ? `${colors.error}10`
                                                        : i % 2 === 0 ? 'transparent' : `${colors.surfaceLight}40`,
                                                    borderBottom: `1px solid ${colors.border}20`,
                                                }}>
                                                    <td style={{ padding: '8px 16px' }}>
                                                        {vote.voteId ? (
                                                            <button
                                                                onClick={() => toggleVote(vote.voteId)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: colors.textSecondary, display: 'flex', alignItems: 'center' }}
                                                            >
                                                                {selectedVoteIds.has(vote.voteId)
                                                                    ? <CheckSquare size={15} color={colors.primary} />
                                                                    : <Square size={15} />}
                                                            </button>
                                                        ) : (
                                                            <span title="Vote already cleared" style={{ color: colors.textTertiary, fontSize: 11 }}>cleared</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px 16px', color: colors.textPrimary, fontWeight: 500 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span>
                                                                {vote.displayName || vote.username}
                                                                {vote.displayName && vote.displayName !== vote.username && (
                                                                    <span style={{ color: colors.textTertiary, fontWeight: 400 }}> ({vote.username})</span>
                                                                )}
                                                            </span>
                                                            {vote.ipSource === 'activity_log' && (
                                                                <span title="IP sourced from activity log (historical vote)" style={{
                                                                    fontSize: 10, fontWeight: 500,
                                                                    background: `${colors.info}20`, color: colors.info,
                                                                    borderRadius: borderRadius.sm, padding: '1px 5px',
                                                                }}>
                                                                    hist.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px 16px', color: colors.textSecondary, fontFamily: 'monospace', fontSize: 12 }}>
                                                        {vote.email || '—'}
                                                    </td>
                                                    <td style={{ padding: '8px 16px', color: colors.textSecondary }}>
                                                        {fmtDate(vote.accountCreatedAt)}
                                                    </td>
                                                    <td style={{ padding: '8px 16px', color: colors.textPrimary }}>
                                                        {vote.trackTitle}
                                                    </td>
                                                    <td style={{ padding: '8px 16px' }}>
                                                        <span style={{
                                                            background: vote.rank === 1 ? `${colors.warning}30` : `${colors.secondary}30`,
                                                            color: vote.rank === 1 ? colors.warning : colors.textSecondary,
                                                            borderRadius: borderRadius.sm,
                                                            padding: '2px 8px', fontSize: 12, fontWeight: 600,
                                                        }}>
                                                            {rankLabel(vote.rank)}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '8px 16px', color: colors.textSecondary }}>
                                                        {fmtDate(vote.createdAt)}
                                                    </td>
                                                    <td style={{ padding: '8px 16px' }}>
                                                        {vote.banned ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span style={{
                                                                    background: `${colors.error}20`, color: colors.error,
                                                                    borderRadius: borderRadius.sm, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                                                                }}>
                                                                    Banned
                                                                </span>
                                                                <button
                                                                    onClick={() => unbanUser(vote.userId)}
                                                                    disabled={actionLoading}
                                                                    title="Unban this account"
                                                                    style={{
                                                                        background: 'none', border: `1px solid ${colors.border}`,
                                                                        borderRadius: borderRadius.sm, padding: '2px 6px',
                                                                        cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center',
                                                                    }}
                                                                >
                                                                    <UserCheck size={12} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{
                                                                background: `${colors.success}20`, color: colors.success,
                                                                borderRadius: borderRadius.sm, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                                                            }}>
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
