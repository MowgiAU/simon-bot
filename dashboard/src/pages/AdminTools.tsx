import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, HardDrive, GitMerge, Settings, Database, FileText, CheckCircle, Loader2, UserPlus, ShieldOff, Search, UserX, UserCheck, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';
import { OrphanedUploads } from './OrphanedUploads';
import { DuplicateProfilesPage } from './DuplicateProfiles';

type AdminTab = 'orphaned' | 'duplicates' | 'maintenance' | 'backfill' | 'sync-authors' | 'appeal-block' | 'deletions';

const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'orphaned',     label: 'Orphaned Uploads',   icon: <HardDrive size={15} /> },
    { key: 'duplicates',   label: 'Duplicate Profiles', icon: <GitMerge size={15} /> },
    { key: 'maintenance',  label: 'System Maintenance', icon: <Settings size={15} /> },
    { key: 'backfill',     label: 'Backfill Follows',   icon: <Database size={15} /> },
    { key: 'sync-authors', label: 'Sync Article Authors', icon: <FileText size={15} /> },
    { key: 'appeal-block', label: 'Ban Appeals',        icon: <ShieldOff size={15} /> },
    { key: 'deletions',    label: 'Account Deletions',  icon: <Trash2 size={15} /> },
];

interface UserLookupResult {
    id: string;
    discordId: string | null;
    username: string;
    displayName: string | null;
    isAppealBlocked: boolean;
    isTicketBlocked: boolean;
}

const AppealBlockTab: React.FC = () => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<UserLookupResult | null>(null);
    const [searching, setSearching] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const search = async () => {
        const q = query.trim();
        if (!q) return;
        setSearching(true);
        setError(null);
        setResult(null);
        try {
            const res = await axios.get('/api/admin/users/lookup', { params: { q }, withCredentials: true });
            setResult(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'User not found');
        } finally { setSearching(false); }
    };

    const toggleBlock = async () => {
        if (!result?.discordId) return;
        setToggling(true);
        setError(null);
        try {
            const res = await axios.patch(`/api/web-tickets/appeal-block/${result.discordId}`, {}, { withCredentials: true });
            setResult(r => r ? { ...r, isAppealBlocked: res.data.isAppealBlocked } : r);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update block status');
        } finally { setToggling(false); }
    };

    return (
        <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: spacing.md }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldOff size={18} color="#ef4444" />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>Ban-Appeal Blocklist</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>Look up a user by Discord ID or site username and block them from submitting ban appeals via fujistud.io/appeal.</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') search(); }}
                    placeholder="Discord ID or username"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: borderRadius.md, border: `1px solid ${colors.glassBorder}`, backgroundColor: colors.background, color: colors.textPrimary, fontSize: '13px', outline: 'none' }}
                />
                <button onClick={search} disabled={searching || !query.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: borderRadius.md, backgroundColor: colors.primary, color: '#fff', border: 'none', cursor: searching ? 'default' : 'pointer', fontWeight: 700, fontSize: '13px', opacity: searching || !query.trim() ? 0.7 : 1 }}>
                    {searching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />} Search
                </button>
            </div>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: spacing.md, fontSize: '13px', color: '#ef4444' }}>
                    {error}
                </div>
            )}

            {result && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.background, border: `1px solid ${colors.glassBorder}` }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{result.displayName || result.username}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>@{result.username}{result.discordId ? ` · Discord ID ${result.discordId}` : ' · no Discord account linked'}</div>
                    </div>
                    <button onClick={toggleBlock} disabled={toggling || !result.discordId} title={!result.discordId ? 'User has no linked Discord account' : undefined}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: borderRadius.md, border: 'none', cursor: toggling || !result.discordId ? 'default' : 'pointer', fontWeight: 700, fontSize: '13px', background: result.isAppealBlocked ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: result.isAppealBlocked ? '#ef4444' : '#22c55e', opacity: toggling || !result.discordId ? 0.6 : 1 }}>
                        {result.isAppealBlocked ? <UserCheck size={14} /> : <UserX size={14} />}
                        {toggling ? 'Updating…' : result.isAppealBlocked ? 'Unblock from Appeals' : 'Block from Appeals'}
                    </button>
                </div>
            )}
        </div>
    );
};

const MaintenanceTab: React.FC = () => {
    const [reprocessing, setReprocessing] = useState(false);
    const [migratingR2, setMigratingR2] = useState(false);
    const [backfillingStorage, setBackfillingStorage] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleReprocessFlps = async () => {
        if (!window.confirm('Re-run the arrangement parser on all .flp files and re-inject waveform peaks into ZIP bundle tracks. This may take a minute and will overwrite existing arrangement data. Proceed?')) return;
        setReprocessing(true);
        setMsg({ type: 'success', text: 'Reprocessing started... Please wait.' });
        try {
            const res = await axios.post('/api/admin/reprocess-flps', {}, { withCredentials: true });
            const d = res.data;
            setMsg({
                type: 'success',
                text: `FLP: ${d.flpSuccess}/${d.flpTotal} re-parsed. ZIP: ${d.zipSuccess}/${d.zipTotal} enriched.${d.reextractQueued > 0 ? ` ${d.reextractQueued} track(s) queued for waveform re-extraction.` : ' All waveforms up to date.'}${d.failed > 0 || d.errors?.length ? ` Errors: ${d.errors?.slice(0, 2).join(' | ') || d.failed + ' failed'}` : ''}`,
            });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to re-process project files' });
        } finally { setReprocessing(false); }
    };

    const handleMigrateToR2 = async () => {
        if (!window.confirm('Upload all existing local track files (audio, artwork, project files) to Cloudflare R2 and update database URLs. This may take several minutes. Proceed?')) return;
        setMigratingR2(true);
        setMsg({ type: 'success', text: 'Migration started... This may take a minute.' });
        try {
            const res = await axios.post('/api/admin/migrate-uploads-to-r2', {}, { withCredentials: true });
            const d = res.data.tracks;
            setMsg({ type: 'success', text: `Migration complete! Audio: ${d.audio}, Artwork: ${d.artwork}, Projects: ${d.projectFile + d.projectZip}${d.errors.length ? ` (${d.errors.length} errors — check logs)` : ''}` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Migration failed' });
        } finally { setMigratingR2(false); }
    };

    const handleBackfillStorage = async () => {
        if (!window.confirm('Populate audioFileSizeBytes for all tracks that are missing it (uploaded before storage tracking was added). Uses R2 HeadObject for CDN tracks, fs.stat for local files. Safe to re-run. Proceed?')) return;
        setBackfillingStorage(true);
        setMsg({ type: 'success', text: 'Backfilling storage sizes... this may take a minute.' });
        try {
            const res = await axios.post('/api/admin/storage/backfill-track-sizes', {}, { withCredentials: true });
            const d = res.data;
            setMsg({ type: 'success', text: `Done. ${d.updated} track(s) updated, ${d.skipped} skipped (size unavailable), ${d.total} total checked.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Backfill failed' });
        } finally { setBackfillingStorage(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {msg && (
                <div style={{ padding: '10px 14px', borderRadius: borderRadius.md, backgroundColor: msg.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.3)'}`, fontSize: '13px', color: msg.type === 'success' ? '#22c55e' : '#ef4444' }}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: '16px', lineHeight: 1, verticalAlign: 'middle' }}>×</button>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: 'rgba(255,152,0,0.04)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,152,0,0.15)' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Re-parse / Re-enrich project files</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Re-run the arrangement parser on all .flp files, and re-inject waveform peaks from the database into all ZIP bundle tracks.</div>
                </div>
                <button onClick={handleReprocessFlps} disabled={reprocessing}
                    style={{ backgroundColor: 'transparent', color: reprocessing ? colors.textSecondary : '#ff9800', border: `1px solid ${reprocessing ? colors.textSecondary : '#ff9800'}`, borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: reprocessing ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: spacing.md }}>
                    {reprocessing ? 'Processing...' : 'Run'}
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: 'rgba(99,102,241,0.04)', borderRadius: borderRadius.sm, border: '1px solid rgba(99,102,241,0.2)' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Migrate files to R2 CDN</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Upload existing local track files to Cloudflare R2 and update database URLs.</div>
                </div>
                <button onClick={handleMigrateToR2} disabled={migratingR2}
                    style={{ backgroundColor: 'transparent', color: migratingR2 ? colors.textSecondary : '#6366f1', border: `1px solid ${migratingR2 ? colors.textSecondary : '#6366f1'}`, borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: migratingR2 ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: spacing.md }}>
                    {migratingR2 ? 'Migrating...' : 'Run'}
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: 'rgba(242, 120, 10,0.04)', borderRadius: borderRadius.sm, border: '1px solid rgba(242, 120, 10,0.15)' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Backfill track storage sizes</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Populate <code style={{ fontFamily: 'monospace', fontSize: '11px', color: colors.textSecondary }}>audioFileSizeBytes</code> for tracks uploaded before storage tracking was added. Uses R2 HeadObject for CDN tracks, disk stat for local files. Safe to re-run.</div>
                </div>
                <button onClick={handleBackfillStorage} disabled={backfillingStorage}
                    style={{ backgroundColor: 'transparent', color: backfillingStorage ? colors.textSecondary : colors.primary, border: `1px solid ${backfillingStorage ? colors.textSecondary : colors.primary}`, borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: backfillingStorage ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: spacing.md }}>
                    {backfillingStorage ? 'Running...' : 'Run'}
                </button>
            </div>
        </div>
    );
};

const BackfillTab: React.FC = () => {
    const [backfilling, setBackfilling] = useState(false);
    const [result, setResult] = useState<{ followed: number; skipped: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setBackfilling(true);
        setResult(null);
        setError(null);
        try {
            const res = await axios.post('/api/admin/auto-follow/backfill', {}, { withCredentials: true });
            setResult(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Backfill failed');
        } finally { setBackfilling(false); }
    };

    return (
        <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: spacing.md }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(234,179,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={18} color="#eab308" />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>Backfill Follows</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>Follow all existing profiles that the auto-follow account hasn't followed yet.</div>
                </div>
            </div>

            {result && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: spacing.md }}>
                    <CheckCircle size={16} color="#22c55e" />
                    <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>Followed {result.followed} new profiles — {result.skipped} already following.</span>
                </div>
            )}
            {error && (
                <div style={{ padding: '10px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: spacing.md, fontSize: '13px', color: '#ef4444' }}>
                    {error}
                </div>
            )}

            <button onClick={run} disabled={backfilling}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: borderRadius.md, backgroundColor: '#eab308', color: '#000', border: 'none', cursor: backfilling ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', opacity: backfilling ? 0.7 : 1 }}>
                {backfilling ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running backfill…</> : <><UserPlus size={14} /> Run Backfill</>}
            </button>
        </div>
    );
};

const SyncAuthorsTab: React.FC = () => {
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<{ updated: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setSyncing(true);
        setResult(null);
        setError(null);
        try {
            const res = await axios.post('/api/admin/articles/sync-authors', {}, { withCredentials: true });
            setResult(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Sync failed');
        } finally { setSyncing(false); }
    };

    return (
        <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.glassBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: spacing.md }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} color="#6366f1" />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>Sync Article Authors</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>Update all articles to reflect current profile names and avatars.</div>
                </div>
            </div>

            {result && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: spacing.md }}>
                    <CheckCircle size={16} color="#22c55e" />
                    <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>Updated {result.updated} articles.</span>
                </div>
            )}
            {error && (
                <div style={{ padding: '10px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: spacing.md, fontSize: '13px', color: '#ef4444' }}>
                    {error}
                </div>
            )}

            <button onClick={run} disabled={syncing}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: borderRadius.md, backgroundColor: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', opacity: syncing ? 0.7 : 1 }}>
                {syncing ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…</> : <><FileText size={14} /> Sync Now</>}
            </button>
        </div>
    );
};

// ─── Account deletions review ──────────────────────────────────────────────

interface DeletionRequest {
    id: string;
    userId: string;
    identityIds: string[];
    requestedAt: string;
    requestedBy: string;
    reason: string | null;
    purgeAfter: string;
    status: 'pending' | 'restored' | 'purged';
    purgedGroups: string[];
    snapshot: Record<string, number> | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    user: { id: string; username: string; email: string | null; discordId: string | null } | null;
    overdue: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    pending: colors.warning,
    restored: colors.success,
    purged: colors.error,
};

const DeletionsTab: React.FC = () => {
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [groups, setGroups] = useState<string[]>([]);
    const [labels, setLabels] = useState<Record<string, string>>({});
    const [graceDays, setGraceDays] = useState(30);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/admin/deletions', { withCredentials: true });
            setRequests(r.data.requests || []);
            setGroups(r.data.groups || []);
            setLabels(r.data.labels || {});
            setGraceDays(r.data.graceDays ?? 30);
        } catch { setError('Failed to load deletion requests'); }
        finally { setLoading(false); }
    }, []);

    const loadDetail = useCallback(async (id: string) => {
        try {
            const r = await axios.get(`/api/admin/deletions/${id}`, { withCredentials: true });
            setDetail(r.data);
        } catch { setDetail(null); }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (selectedId) loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

    const act = async (action: 'restore' | 'purge', group?: string) => {
        if (!selectedId || !detail) return;
        const name = detail.user?.username || 'this account';
        if (action === 'purge') {
            const what = group === 'all' ? 'EVERYTHING for' : `"${labels[group!] || group}" from`;
            const typed = window.prompt(`Permanently delete ${what} ${name}. This cannot be undone.\n\nType the username to confirm:`);
            if (typed !== detail.user?.username) { if (typed !== null) setError('Username did not match — nothing was deleted.'); return; }
        } else if (!window.confirm(`Restore ${name} and everything not already purged?`)) return;

        setBusy(group || action); setError('');
        try {
            await axios.post(`/api/admin/deletions/${selectedId}/${action}`,
                action === 'purge' ? { group } : {}, { withCredentials: true });
            await Promise.all([load(), loadDetail(selectedId)]);
        } catch (e: any) {
            setError(e?.response?.data?.error || `Failed to ${action}`);
        } finally { setBusy(''); }
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>;

    const purged: string[] = detail?.request?.purgedGroups || [];
    const counts: Record<string, number> = detail?.counts || {};
    const isPurged = detail?.request?.status === 'purged';
    const isRestored = detail?.request?.status === 'restored';

    return (
        <div>
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: 13, lineHeight: 1.6 }}>
                    Members who delete their account have everything soft-deleted and hidden from the site immediately, but nothing is destroyed until you act here.
                    Each component group is purged independently, in order, because tracks and battle entries cascade from the profile — purging out of order would
                    destroy them without cleaning up their audio files. Anything still pending after <strong>{graceDays} days</strong> is purged automatically.
                </p>
            </div>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: borderRadius.md, background: `${colors.error}18`, border: `1px solid ${colors.error}55`, color: colors.error, fontSize: 13, marginBottom: spacing.md }}>{error}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: spacing.md, alignItems: 'start' }}>
                {/* Queue */}
                <div style={{ background: colors.surface, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Requests ({requests.length})
                    </div>
                    {requests.length === 0 ? (
                        <p style={{ padding: '24px 14px', margin: 0, color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>No deletion requests.</p>
                    ) : requests.map(r => (
                        <button key={r.id} onClick={() => setSelectedId(r.id)}
                            style={{
                                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', cursor: 'pointer',
                                background: selectedId === r.id ? `${colors.primary}1e` : 'transparent',
                                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                borderLeft: `3px solid ${selectedId === r.id ? colors.primary : 'transparent'}`,
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{r.user?.username || r.userId.slice(0, 10)}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: STATUS_COLOR[r.status] || colors.textSecondary }}>{r.status}</span>
                            </div>
                            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {r.overdue && <AlertTriangle size={11} color={colors.error} />}
                                {new Date(r.requestedAt).toLocaleDateString()} · by {r.requestedBy === 'self' ? 'member' : 'admin'}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Detail */}
                <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, minHeight: 200 }}>
                    {!detail ? (
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Select a request to review it.</p>
                    ) : (
                        <>
                            <div style={{ marginBottom: spacing.md }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: 16, color: colors.textPrimary }}>{detail.user?.username || detail.request.userId}</h3>
                                <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary }}>
                                    {detail.user?.email || 'no email'} · requested {new Date(detail.request.requestedAt).toLocaleString()}
                                    {' · '}<span style={{ color: detail.overdue ? colors.error : colors.textSecondary, fontWeight: detail.overdue ? 700 : 400 }}>
                                        auto-purge {new Date(detail.request.purgeAfter).toLocaleDateString()}{detail.overdue ? ' (OVERDUE)' : ''}
                                    </span>
                                </p>
                                {detail.request.reason && (
                                    <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm }}>
                                        “{detail.request.reason}”
                                    </p>
                                )}
                            </div>

                            {/* Component groups */}
                            <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.md }}>
                                {groups.map((g, i) => {
                                    const done = purged.includes(g);
                                    const blockedBy = groups.slice(0, i).filter(p => !purged.includes(p));
                                    const blocked = blockedBy.length > 0;
                                    return (
                                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < groups.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: done ? 0.55 : 1 }}>
                                            <span style={{ fontSize: 13, color: colors.textPrimary, flex: 1 }}>{labels[g] || g}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, minWidth: 34, textAlign: 'right' }}>{counts[g] ?? 0}</span>
                                            {done ? (
                                                <span style={{ fontSize: 11, fontWeight: 700, color: colors.error, minWidth: 96, textAlign: 'right' }}>PURGED</span>
                                            ) : (
                                                <button onClick={() => act('purge', g)}
                                                    disabled={!!busy || blocked || isRestored}
                                                    title={blocked ? `Purge ${blockedBy.map(b => labels[b] || b).join(', ')} first` : isRestored ? 'Account was restored' : `Permanently delete ${labels[g] || g}`}
                                                    style={{
                                                        minWidth: 96, padding: '5px 10px', borderRadius: borderRadius.sm, fontSize: 11, fontWeight: 700,
                                                        border: `1px solid ${blocked || isRestored ? colors.border : colors.error}`,
                                                        background: 'transparent', color: blocked || isRestored ? colors.textTertiary : colors.error,
                                                        cursor: busy || blocked || isRestored ? 'not-allowed' : 'pointer',
                                                    }}>
                                                    {busy === g ? '…' : blocked ? 'Blocked' : 'Purge'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <p style={{ margin: `0 0 ${spacing.md}`, fontSize: 11.5, color: colors.textTertiary, lineHeight: 1.6 }}>
                                Left intact on purpose: battle and arena vote tallies, match results and Elo, and market ledger rows.
                                Deleting those would corrupt other members' history — they show as an anonymous placeholder once the profile is gone.
                            </p>

                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button onClick={() => act('restore')} disabled={!!busy || isPurged || isRestored}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: borderRadius.md, fontSize: 13, fontWeight: 700, border: `1px solid ${colors.success}`, background: 'transparent', color: colors.success, cursor: busy || isPurged || isRestored ? 'not-allowed' : 'pointer', opacity: isPurged || isRestored ? 0.45 : 1 }}>
                                    <RotateCcw size={14} /> Restore everything
                                </button>
                                <button onClick={() => act('purge', 'all')} disabled={!!busy || isPurged || isRestored}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: borderRadius.md, fontSize: 13, fontWeight: 700, border: 'none', background: colors.error, color: '#fff', cursor: busy || isPurged || isRestored ? 'not-allowed' : 'pointer', opacity: isPurged || isRestored ? 0.45 : 1 }}>
                                    <Trash2 size={14} /> {busy === 'all' ? 'Purging…' : 'Permanently delete everything'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export const AdminToolsPage: React.FC = () => {
    const [tab, setTab] = useState<AdminTab>('orphaned');

    return (
        <div style={{ padding: '24px 32px', maxWidth: '960px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Wrench size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Admin Tools</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>Maintenance utilities and data management tools.</p>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: colors.surface, padding: '4px', borderRadius: borderRadius.md, border: `1px solid ${colors.glassBorder}`, flexWrap: 'wrap' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.key ? 700 : 500, backgroundColor: tab === t.key ? colors.primary : 'transparent', color: tab === t.key ? '#fff' : colors.textSecondary, transition: 'all 0.15s' }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === 'orphaned'     && <OrphanedUploads />}
            {tab === 'duplicates'   && <DuplicateProfilesPage />}
            {tab === 'maintenance'  && <MaintenanceTab />}
            {tab === 'backfill'     && <BackfillTab />}
            {tab === 'sync-authors' && <SyncAuthorsTab />}
            {tab === 'appeal-block' && <AppealBlockTab />}
            {tab === 'deletions'    && <DeletionsTab />}
        </div>
    );
};
