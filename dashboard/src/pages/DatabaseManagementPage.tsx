import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, Download, RefreshCw, CheckCircle, AlertTriangle, Clock, X, Music } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = import.meta.env.VITE_API_URL || '';
const REMINDER_DAYS = 7; // warn if no manual backup for this many days
const DISMISSED_KEY = 'fuji_backup_reminder_dismissed';

interface BackupStatus {
    r2Configured: boolean;
    lastManualDownloadAt: string | null;
    lastScheduledAt: string | null;
}

function daysSince(iso: string | null): number | null {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString();
}

export const DatabaseManagementPage: React.FC = () => {
    const [status, setStatus] = useState<BackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [retranscoding, setRetranscoding] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [reminderDismissed, setReminderDismissed] = useState(
        () => sessionStorage.getItem(DISMISSED_KEY) === '1'
    );

    const fetchStatus = async () => {
        try {
            const res = await axios.get(`${API}/api/admin/backup/status`, { withCredentials: true });
            setStatus(res.data);
        } catch {
            setMessage({ type: 'error', text: 'Failed to load backup status.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStatus(); }, []);

    const handleDownload = async () => {
        setDownloading(true);
        setMessage(null);
        try {
            const res = await axios.get(`${API}/api/admin/backup/download`, {
                withCredentials: true,
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            const cd = res.headers['content-disposition'] || '';
            const match = cd.match(/filename="([^"]+)"/);
            a.href = url;
            a.download = match ? match[1] : 'fuji-backup.sql.gz';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setMessage({ type: 'success', text: 'Backup downloaded successfully. Store it somewhere safe!' });
            fetchStatus(); // refresh timestamps
        } catch (e: any) {
            const msg = e?.response?.data?.error || 'Download failed. Check that pg_dump is installed on the server.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setDownloading(false);
        }
    };

    const daysSinceManual = daysSince(status?.lastManualDownloadAt ?? null);
    const showReminder = !reminderDismissed &&
        status !== null &&
        (daysSinceManual === null || daysSinceManual >= REMINDER_DAYS);

    return (
        <div style={{ padding: spacing.lg, maxWidth: '720px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Database size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Database Management</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Manual backups, scheduled exports, and off-site retention
                    </p>
                </div>
            </div>

            {/* Reminder banner */}
            {showReminder && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '14px 16px', marginBottom: '20px',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: borderRadius.md,
                }}>
                    <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <p style={{ margin: 0, flex: 1, fontSize: '13px', color: '#FCD34D', lineHeight: 1.5 }}>
                        ⚠️ {daysSinceManual === null
                            ? "You haven't downloaded a manual backup yet."
                            : `It has been ${daysSinceManual} day${daysSinceManual !== 1 ? 's' : ''} since your last manual backup download.`
                        } Keep an off-site copy for safety.
                    </p>
                    <button
                        onClick={() => { sessionStorage.setItem(DISMISSED_KEY, '1'); setReminderDismissed(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0, flexShrink: 0 }}
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Explanation */}
            <div style={{
                backgroundColor: colors.surface, padding: spacing.md,
                borderRadius: borderRadius.md, marginBottom: spacing.lg,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    Fuji Studio runs <strong>automated backups every 6 hours</strong> to Cloudflare R2,
                    retaining the last 30 snapshots. Manual downloads give you an independent off-site copy
                    that doesn't depend on R2 availability. Backups are compressed <code>.sql.gz</code> files
                    you can restore with <code>pg_restore</code> or <code>psql</code>.
                </p>
            </div>

            {/* Status cards */}
            {loading ? (
                <p style={{ color: colors.textSecondary }}>Loading backup status…</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <StatusCard
                        label="R2 Remote Backup"
                        value={status?.r2Configured ? 'Configured' : 'Not configured'}
                        icon={status?.r2Configured ? <CheckCircle size={18} color={colors.primary} /> : <AlertTriangle size={18} color="#F59E0B" />}
                        sub={status?.r2Configured ? 'Uploading every 6 hours' : 'Set R2_* env vars to enable'}
                    />
                    <StatusCard
                        label="Last Scheduled Backup"
                        value={formatDate(status?.lastScheduledAt ?? null)}
                        icon={<Clock size={18} color={colors.textSecondary} />}
                        sub="Automatic, runs every 6 h"
                    />
                    <StatusCard
                        label="Last Manual Download"
                        value={formatDate(status?.lastManualDownloadAt ?? null)}
                        icon={<Download size={18} color={colors.textSecondary} />}
                        sub={daysSinceManual !== null ? `${daysSinceManual}d ago` : 'Never downloaded'}
                    />
                </div>
            )}

            {/* Message */}
            {message && (
                <div style={{
                    padding: '12px 16px', marginBottom: '20px', borderRadius: borderRadius.md,
                    backgroundColor: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: message.type === 'success' ? colors.primary : '#FCA5A5',
                    fontSize: '13px',
                }}>
                    {message.text}
                </div>
            )}

            {/* Download button */}
            <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 24px', backgroundColor: colors.primary, color: 'white',
                    border: 'none', borderRadius: borderRadius.md, cursor: downloading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '14px', opacity: downloading ? 0.6 : 1,
                }}
            >
                {downloading
                    ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating backup…</>
                    : <><Download size={16} /> Download Manual Backup</>
                }
            </button>
                    <p style={{ marginTop: '8px', fontSize: '12px', color: colors.textSecondary }}>
                Runs <code>pg_dump</code> live and streams a <code>.sql.gz</code> file directly to your browser.
            </p>

            {/* iOS MP3 re-transcode */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${colors.border}` }}>
                <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>iOS Audio Compatibility</h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.textSecondary }}>
                    Existing tracks only have an OGG stream. Run this once to generate MP3 fallbacks for all tracks — required for playback on iOS Safari.
                    The job runs in the background; check server logs for progress.
                </p>
                <button
                    onClick={async () => {
                        setRetranscoding(true);
                        setMessage(null);
                        try {
                            const res = await axios.post(`${API}/api/admin/retranscode-mp3`, {}, { withCredentials: true });
                            setMessage({ type: 'success', text: `MP3 re-transcode queued for ${res.data.queued} tracks. Running in background.` });
                        } catch (e: any) {
                            setMessage({ type: 'error', text: e?.response?.data?.error || 'Failed to start re-transcode job.' });
                        } finally {
                            setRetranscoding(false);
                        }
                    }}
                    disabled={retranscoding}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', backgroundColor: 'rgba(43,141,113,0.15)',
                        color: colors.primary, border: `1px solid ${colors.primary}40`,
                        borderRadius: borderRadius.md, cursor: retranscoding ? 'not-allowed' : 'pointer',
                        fontWeight: 600, fontSize: '13px', opacity: retranscoding ? 0.6 : 1,
                    }}
                >
                    {retranscoding
                        ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Starting…</>
                        : <><Music size={14} /> Generate MP3 Fallbacks for All Tracks</>
                    }
                </button>
            </div>
            <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
        </div>
    );
};

const StatusCard: React.FC<{ label: string; value: string; icon: React.ReactNode; sub: string }> = ({ label, value, icon, sub }) => (
    <div style={{
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: '16px', border: `1px solid ${colors.glassBorder}`,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            {icon}
            <span style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        </div>
        <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>{value}</p>
        <p style={{ margin: 0, fontSize: '11px', color: colors.textTertiary }}>{sub}</p>
    </div>
);
