import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, CheckCircle, XCircle, Shield, Link2, Trash2, KeyRound, RefreshCw, UserX, ShieldOff, Edit2, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';

interface AccountUser {
    id: string;
    username: string;
    displayName: string | null;
    email: string | null;
    emailVerified: string | null;
    totpEnabled: boolean;
    discordId: string | null;
    hasPassword: boolean;
    pendingEmail?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface AccountsResponse {
    users: AccountUser[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

const LIMIT = 20;

export const AccountManagementPage: React.FC = () => {
    const { selectedGuild } = useAuth();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<AccountsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [selected, setSelected] = useState<AccountUser | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');
    const [actionErr, setActionErr] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Edit fields
    const [editMode, setEditMode] = useState(false);
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editErr, setEditErr] = useState('');

    // Set password
    const [showSetPassword, setShowSetPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwErr, setPwErr] = useState('');

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const loadAccounts = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
            if (debouncedSearch) params.set('search', debouncedSearch);
            const res = await fetch(`/api/admin/accounts?${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            setData(await res.json());
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const selectUser = async (u: AccountUser) => {
        setSelected(null);
        setActionMsg(''); setActionErr(''); setConfirmDelete(false);
        setEditMode(false); setShowSetPassword(false);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/admin/accounts/${u.id}`, { credentials: 'include' });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            const detail: AccountUser = await res.json();
            setSelected(detail);
            setEditUsername(detail.username || '');
            setEditEmail(detail.email || '');
            setEditDisplayName(detail.displayName || '');
        } catch (e: any) {
            setActionErr(e.message);
        } finally {
            setDetailLoading(false);
        }
    };

    const doAction = async (path: string, body?: any) => {
        if (!selected) return;
        setActionMsg(''); setActionErr('');
        try {
            const res = await fetch(`/api/admin/accounts/${selected.id}/${path}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });
            const d = await res.json();
            if (!res.ok) { setActionErr(d.error || 'Failed'); return; }
            setActionMsg('Done!');
            await selectUser(selected);
            loadAccounts();
        } catch { setActionErr('Request failed'); }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected) return;
        setEditErr(''); setEditLoading(true);
        try {
            const body: any = {};
            if (editUsername !== selected.username) body.username = editUsername;
            if (editEmail !== (selected.email || '')) body.email = editEmail;
            if (editDisplayName !== (selected.displayName || '')) body.displayName = editDisplayName;
            if (Object.keys(body).length === 0) { setEditMode(false); setEditLoading(false); return; }

            const res = await fetch(`/api/admin/accounts/${selected.id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const d = await res.json();
            if (!res.ok) { setEditErr(d.error || 'Failed'); setEditLoading(false); return; }
            setEditMode(false);
            await selectUser(selected);
            loadAccounts();
        } catch { setEditErr('Request failed'); }
        finally { setEditLoading(false); }
    };

    const handleDelete = async () => {
        if (!selected) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/admin/accounts/${selected.id}`, {
                method: 'DELETE', credentials: 'include'
            });
            const d = await res.json();
            if (!res.ok) { setActionErr(d.error || 'Failed'); setDeleteLoading(false); return; }
            setSelected(null); setConfirmDelete(false);
            loadAccounts();
        } catch { setActionErr('Request failed'); }
        finally { setDeleteLoading(false); }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwErr(''); setPwLoading(true);
        try {
            const res = await fetch(`/api/admin/accounts/${selected!.id}/set-password`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword }),
            });
            const d = await res.json();
            if (!res.ok) { setPwErr(d.error || 'Failed'); setPwLoading(false); return; }
            setShowSetPassword(false); setNewPassword('');
            setActionMsg('Password updated.');
            await selectUser(selected!);
        } catch { setPwErr('Request failed'); }
        finally { setPwLoading(false); }
    };

    const panelStyle: React.CSSProperties = {
        background: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing['3xl'], border: `1px solid ${colors.border}`,
    };

    const badgeStyle = (active: boolean, color: string): React.CSSProperties => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
        background: active ? `${color}20` : `${colors.textTertiary}15`,
        color: active ? color : colors.textTertiary,
        border: `1px solid ${active ? `${color}40` : `${colors.textTertiary}20`}`,
    });

    const actionBtnStyle = (danger = false): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: spacing.sm,
        padding: '8px 16px', borderRadius: borderRadius.lg, fontWeight: 600, fontSize: '13px',
        cursor: 'pointer', border: 'none',
        background: danger ? `${colors.error}15` : colors.surfaceLight,
        color: danger ? colors.error : colors.textPrimary,
    });

    return (
        <div style={{ padding: `${spacing['3xl']} ${spacing.lg}`, maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Users size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Account Management</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>View and manage all user accounts</p>
                </div>
            </div>

            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>Search for accounts and click to view details. You can edit account fields, reset passwords, disable 2FA, remove Discord links, and delete accounts.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: spacing.xl, alignItems: 'start' }}>
                {/* Left — list */}
                <div>
                    {/* Search bar */}
                    <div style={{ position: 'relative', marginBottom: spacing.lg }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
                        <input
                            type="text" placeholder="Search by username, email, or display name…"
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 38px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, color: colors.textPrimary, fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>

                    {error && <p style={{ color: colors.error, fontSize: '13px' }}>{error}</p>}

                    <div style={panelStyle}>
                        {loading ? (
                            <p style={{ color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>Loading…</p>
                        ) : data && data.users.length === 0 ? (
                            <p style={{ color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>No accounts found.</p>
                        ) : data ? (
                            <>
                                <div style={{ marginBottom: spacing.sm, color: colors.textTertiary, fontSize: '12px' }}>
                                    {data.total} account{data.total !== 1 ? 's' : ''}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {data.users.map(u => (
                                        <button key={u.id} onClick={() => selectUser(u)}
                                            style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg, border: `1px solid ${selected?.id === u.id ? colors.primary : 'transparent'}`, background: selected?.id === u.id ? `${colors.primary}10` : 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.username}
                                                    {u.displayName && <span style={{ color: colors.textTertiary, fontWeight: 400, marginLeft: '6px' }}>({u.displayName})</span>}
                                                </div>
                                                <div style={{ color: colors.textTertiary, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || 'No email'}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                {u.emailVerified && <CheckCircle size={14} color={colors.success} />}
                                                {u.totpEnabled && <Shield size={14} color={colors.primary} />}
                                                {u.discordId && <Link2 size={14} color="#5865F2" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {data.pages > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.lg }}>
                                        <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                                            style={{ background: 'none', border: 'none', color: page <= 1 ? colors.textTertiary : colors.textPrimary, cursor: page <= 1 ? 'default' : 'pointer', display: 'flex' }}>
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span style={{ color: colors.textSecondary, fontSize: '13px' }}>Page {data.page} of {data.pages}</span>
                                        <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pages}
                                            style={{ background: 'none', border: 'none', color: page >= data.pages ? colors.textTertiary : colors.textPrimary, cursor: page >= data.pages ? 'default' : 'pointer', display: 'flex' }}>
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>

                {/* Right — detail panel */}
                {selected && (
                    <div style={panelStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl }}>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.textPrimary }}>{selected.username}</h2>
                            <div style={{ display: 'flex', gap: spacing.sm }}>
                                <button onClick={() => { setEditMode(e => !e); setEditErr(''); }} style={{ ...actionBtnStyle(), padding: '6px 10px' }} title="Edit account">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', display: 'flex' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {detailLoading ? (
                            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Loading…</p>
                        ) : (
                            <>
                                {/* Status badges */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: spacing.lg }}>
                                    <span style={badgeStyle(!!selected.emailVerified, colors.success)}>
                                        {selected.emailVerified ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                        {selected.emailVerified ? 'Email Verified' : 'Unverified'}
                                    </span>
                                    <span style={badgeStyle(selected.totpEnabled, colors.primary)}>
                                        <Shield size={11} />
                                        {selected.totpEnabled ? '2FA On' : '2FA Off'}
                                    </span>
                                    <span style={badgeStyle(!!selected.discordId, '#5865F2')}>
                                        <Link2 size={11} />
                                        {selected.discordId ? 'Discord Linked' : 'No Discord'}
                                    </span>
                                    <span style={badgeStyle(selected.hasPassword, colors.success)}>
                                        <KeyRound size={11} />
                                        {selected.hasPassword ? 'Has Password' : 'No Password'}
                                    </span>
                                </div>

                                {/* Edit form */}
                                {editMode ? (
                                    <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.xl, background: colors.background, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                                        <h3 style={{ margin: `0 0 ${spacing.sm}`, fontSize: '14px', color: colors.textPrimary }}>Edit Account</h3>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Username</label>
                                            <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} required
                                                style={{ width: '100%', padding: '8px 10px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Email</label>
                                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Display Name</label>
                                            <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Optional"
                                                style={{ width: '100%', padding: '8px 10px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} />
                                        </div>
                                        {editErr && <p style={{ color: colors.error, fontSize: '12px', margin: 0 }}>{editErr}</p>}
                                        <div style={{ display: 'flex', gap: spacing.sm }}>
                                            <button type="submit" disabled={editLoading}
                                                style={{ flex: 1, padding: '8px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '13px', cursor: editLoading ? 'wait' : 'pointer', opacity: editLoading ? 0.7 : 1 }}>
                                                {editLoading ? 'Saving…' : 'Save Changes'}
                                            </button>
                                            <button type="button" onClick={() => { setEditMode(false); setEditErr(''); }}
                                                style={{ padding: '8px 14px', background: colors.surfaceLight, color: colors.textSecondary, border: 'none', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    /* Info fields */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: spacing.xl }}>
                                        {[
                                            { label: 'ID', value: selected.id },
                                            { label: 'Username', value: selected.username },
                                            { label: 'Display Name', value: selected.displayName || '—' },
                                            { label: 'Email', value: selected.email || '—' },
                                            { label: 'Pending Email', value: selected.pendingEmail || '—' },
                                            { label: 'Discord ID', value: selected.discordId || '—' },
                                            { label: 'Joined', value: new Date(selected.createdAt).toLocaleDateString() },
                                        ].map(({ label, value }) => (
                                            <div key={label} style={{ display: 'flex', gap: spacing.sm, fontSize: '13px', alignItems: 'baseline' }}>
                                                <span style={{ color: colors.textTertiary, minWidth: '100px', flexShrink: 0 }}>{label}</span>
                                                <span style={{ color: colors.textPrimary, wordBreak: 'break-all' }}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Action messages */}
                                {actionMsg && <p style={{ color: colors.success, fontSize: '13px', margin: `0 0 ${spacing.md}` }}>{actionMsg}</p>}
                                {actionErr && <p style={{ color: colors.error, fontSize: '13px', margin: `0 0 ${spacing.md}` }}>{actionErr}</p>}

                                {/* Set password form */}
                                {showSetPassword && (
                                    <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.lg, background: colors.background, padding: spacing.md, borderRadius: borderRadius.lg }}>
                                        <label style={{ fontSize: '12px', color: colors.textSecondary }}>New Password (min 8 chars)</label>
                                        <div style={{ display: 'flex', gap: spacing.sm }}>
                                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="New password"
                                                style={{ flex: 1, padding: '8px 10px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: '13px' }} />
                                            <button type="submit" disabled={pwLoading}
                                                style={{ padding: '8px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 600, fontSize: '13px', cursor: pwLoading ? 'wait' : 'pointer' }}>
                                                {pwLoading ? '…' : 'Set'}
                                            </button>
                                            <button type="button" onClick={() => { setShowSetPassword(false); setNewPassword(''); setPwErr(''); }}
                                                style={{ padding: '8px 10px', background: colors.surfaceLight, color: colors.textSecondary, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {pwErr && <p style={{ color: colors.error, fontSize: '12px', margin: 0 }}>{pwErr}</p>}
                                    </form>
                                )}

                                {/* Action buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                                    {!selected.emailVerified && (
                                        <button onClick={() => doAction('force-verify')} style={actionBtnStyle()}>
                                            <CheckCircle size={14} color={colors.success} /> Force Verify Email
                                        </button>
                                    )}
                                    <button onClick={() => doAction('send-password-reset')} style={actionBtnStyle()}>
                                        <RefreshCw size={14} /> Send Password Reset Email
                                    </button>
                                    <button onClick={() => setShowSetPassword(v => !v)} style={actionBtnStyle()}>
                                        <KeyRound size={14} /> Set Password Directly
                                    </button>
                                    {selected.totpEnabled && (
                                        <button onClick={() => doAction('disable-2fa')} style={actionBtnStyle(true)}>
                                            <ShieldOff size={14} /> Disable 2FA
                                        </button>
                                    )}
                                    {selected.discordId && (
                                        <button onClick={() => doAction('remove-discord')} style={actionBtnStyle(true)}>
                                            <UserX size={14} /> Remove Discord Link
                                        </button>
                                    )}

                                    <div style={{ height: '1px', background: colors.border, margin: `${spacing.sm} 0` }} />

                                    {!confirmDelete ? (
                                        <button onClick={() => setConfirmDelete(true)} style={actionBtnStyle(true)}>
                                            <Trash2 size={14} /> Delete Account
                                        </button>
                                    ) : (
                                        <div style={{ background: `${colors.error}10`, padding: spacing.md, borderRadius: borderRadius.lg, border: `1px solid ${colors.error}30` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                                                <AlertTriangle size={14} color={colors.error} />
                                                <span style={{ color: colors.error, fontSize: '13px', fontWeight: 600 }}>This cannot be undone.</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: spacing.sm }}>
                                                <button onClick={handleDelete} disabled={deleteLoading}
                                                    style={{ flex: 1, padding: '8px', background: colors.error, color: '#fff', border: 'none', borderRadius: borderRadius.md, fontWeight: 700, fontSize: '13px', cursor: deleteLoading ? 'wait' : 'pointer' }}>
                                                    {deleteLoading ? 'Deleting…' : 'Confirm Delete'}
                                                </button>
                                                <button onClick={() => setConfirmDelete(false)}
                                                    style={{ padding: '8px 14px', background: colors.surfaceLight, color: colors.textSecondary, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            {/* Mobile: stack panels */}
            <style>{`@media (max-width: 768px) { .acct-grid { grid-template-columns: 1fr !important; } }`}</style>
        </div>
    );
};
