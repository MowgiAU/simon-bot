import React, { useState } from 'react';
import { Wrench, HardDrive, GitMerge, Settings, Database, FileText, CheckCircle, Loader2, UserPlus } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';
import { OrphanedUploads } from './OrphanedUploads';
import { DuplicateProfilesPage } from './DuplicateProfiles';

type AdminTab = 'orphaned' | 'duplicates' | 'maintenance' | 'backfill' | 'sync-authors';

const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'orphaned',     label: 'Orphaned Uploads',   icon: <HardDrive size={15} /> },
    { key: 'duplicates',   label: 'Duplicate Profiles', icon: <GitMerge size={15} /> },
    { key: 'maintenance',  label: 'System Maintenance', icon: <Settings size={15} /> },
    { key: 'backfill',     label: 'Backfill Follows',   icon: <Database size={15} /> },
    { key: 'sync-authors', label: 'Sync Article Authors', icon: <FileText size={15} /> },
];

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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: 'rgba(16,185,129,0.04)', borderRadius: borderRadius.sm, border: '1px solid rgba(16,185,129,0.15)' }}>
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
        </div>
    );
};
