import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import {
    Flag, AlertTriangle, CheckCircle, XCircle, Clock, Eye,
    ChevronLeft, ChevronRight, ExternalLink, User, MessageSquare,
    Music, UserCircle, Filter, Search, X, Trash2
} from 'lucide-react';

interface Report {
    id: string;
    reporterUserId: string;
    reporterName: string;
    targetType: 'track' | 'profile' | 'comment' | 'message';
    targetId: string;
    reportedUserId: string;
    reportedName: string;
    reason: string;
    details: string | null;
    contentSnapshot: string | null;
    status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
    resolvedByUserId: string | null;
    resolvedByName: string | null;
    resolvedAt: string | null;
    resolutionNote: string | null;
    createdAt: string;
    updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
    open: { label: 'Open', color: '#f59e0b', icon: <Clock size={14} />, bg: 'rgba(245,158,11,0.1)' },
    reviewing: { label: 'Reviewing', color: '#3b82f6', icon: <Eye size={14} />, bg: 'rgba(59,130,246,0.1)' },
    resolved: { label: 'Resolved', color: '#10b981', icon: <CheckCircle size={14} />, bg: 'rgba(16,185,129,0.1)' },
    dismissed: { label: 'Dismissed', color: '#6b7280', icon: <XCircle size={14} />, bg: 'rgba(107,114,128,0.1)' },
};

const REASON_LABELS: Record<string, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    copyright: 'Copyright',
    nsfw: 'NSFW',
    scam: 'Scam / Fraud',
    other: 'Other',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
    track: <Music size={14} />,
    profile: <UserCircle size={14} />,
    comment: <MessageSquare size={14} />,
    message: <MessageSquare size={14} />,
};

const buildContentLink = (report: Report): string | null => {
    try {
        const snap = report.contentSnapshot ? JSON.parse(report.contentSnapshot) : null;
        if (report.targetType === 'track' && snap?.profileUsername && snap?.slug) {
            return `/profile/${snap.profileUsername}/${snap.slug}`;
        }
        if (report.targetType === 'profile' && snap?.username) {
            return `/profile/${snap.username}`;
        }
    } catch {}
    return null;
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const ReportsPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('open');
    const [filterType, setFilterType] = useState<string>('');
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingComment, setDeletingComment] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 25 };
            if (filterStatus) params.status = filterStatus;
            if (filterType) params.targetType = filterType;
            const res = await axios.get('/api/admin/reports', { params, withCredentials: true });
            setReports(res.data.reports);
            setTotal(res.data.total);
            setPages(res.data.pages);
        } catch {
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, [page, filterStatus, filterType]);

    const handleStatusChange = async (reportId: string, newStatus: string) => {
        setSaving(true);
        try {
            const res = await axios.patch(`/api/admin/reports/${reportId}`, {
                status: newStatus,
                resolutionNote: resolutionNote.trim() || null,
            }, { withCredentials: true });
            setReports(reports.map(r => r.id === reportId ? res.data : r));
            if (selectedReport?.id === reportId) setSelectedReport(res.data);
            setResolutionNote('');
        } catch {}
        setSaving(false);
    };

    const handleDeleteComment = async (report: Report) => {
        if (!window.confirm('Permanently delete this comment? This cannot be undone.')) return;
        setDeletingComment(true);
        try {
            await axios.delete(`/api/comments/${report.targetId}`, { withCredentials: true });
            // Auto-resolve the report after deleting
            await handleStatusChange(report.id, 'resolved');
        } catch {
            // ignore
        } finally {
            setDeletingComment(false);
        }
    };

    const renderSnapshot = (report: Report) => {
        try {
            const snap = report.contentSnapshot ? JSON.parse(report.contentSnapshot) : null;
            if (!snap) return <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>No snapshot available</span>;

            if (report.targetType === 'track') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {snap.coverUrl && <img src={snap.coverUrl} alt="" style={{ width: '80px', height: '80px', borderRadius: borderRadius.sm, objectFit: 'cover' }} />}
                        <div><strong style={{ color: colors.textPrimary }}>Title:</strong> <span style={{ color: colors.textSecondary }}>{snap.title}</span></div>
                        {snap.artist && <div><strong style={{ color: colors.textPrimary }}>Artist:</strong> <span style={{ color: colors.textSecondary }}>{snap.artist}</span></div>}
                        {snap.description && <div><strong style={{ color: colors.textPrimary }}>Description:</strong> <span style={{ color: colors.textSecondary }}>{snap.description}</span></div>}
                    </div>
                );
            }
            if (report.targetType === 'profile') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {snap.avatar && <img src={snap.avatar} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />}
                        <div><strong style={{ color: colors.textPrimary }}>Username:</strong> <span style={{ color: colors.textSecondary }}>{snap.username}</span></div>
                        {snap.displayName && <div><strong style={{ color: colors.textPrimary }}>Display Name:</strong> <span style={{ color: colors.textSecondary }}>{snap.displayName}</span></div>}
                        {snap.bio && <div><strong style={{ color: colors.textPrimary }}>Bio:</strong> <span style={{ color: colors.textSecondary }}>{snap.bio}</span></div>}
                    </div>
                );
            }
            if (report.targetType === 'comment') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div><strong style={{ color: colors.textPrimary }}>Content:</strong> <span style={{ color: colors.textSecondary }}>{snap.content}</span></div>
                        {snap.gifUrl && <img src={snap.gifUrl} alt="gif" style={{ maxWidth: '200px', borderRadius: borderRadius.sm }} />}
                    </div>
                );
            }
            if (report.targetType === 'message') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ color: colors.textTertiary, fontSize: '12px', fontStyle: 'italic' }}>
                            Private messages are end-to-end encrypted. Content shown is the encrypted payload.
                        </div>
                        <div><strong style={{ color: colors.textPrimary }}>Conversation ID:</strong> <span style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: '12px' }}>{snap.conversationId}</span></div>
                    </div>
                );
            }
            return <pre style={{ color: colors.textSecondary, fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(snap, null, 2)}</pre>;
        } catch {
            return <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>Could not parse snapshot</span>;
        }
    };

    return (
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Flag size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Reports</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Review user-submitted reports for tracks, profiles, comments, and messages
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Reports are submitted by users when they encounter content that violates community guidelines.
                    Each report includes a snapshot of the content at the time it was filed, so even if the content is
                    later deleted or modified, you can still review what was reported.
                </p>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px',
                padding: '14px 16px', backgroundColor: colors.surface,
                borderRadius: borderRadius.md, border: `1px solid ${colors.glassBorder}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={14} color={colors.textSecondary} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase' }}>Status</span>
                    <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                        style={{ padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                        <option value="">All</option>
                        <option value="open">Open</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase' }}>Type</span>
                    <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                        style={{ padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, color: colors.textPrimary, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                        <option value="">All Types</option>
                        <option value="track">Tracks</option>
                        <option value="profile">Profiles</option>
                        <option value="comment">Comments</option>
                        <option value="message">Messages</option>
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '13px', color: colors.textTertiary, alignSelf: 'center' }}>
                    {total} report{total !== 1 ? 's' : ''} found
                </div>
            </div>

            {/* Main content: list + detail */}
            <div style={{ display: 'flex', gap: '20px', flexDirection: isMobile ? 'column' : 'row' }}>
                {/* Report list */}
                <div style={{ flex: selectedReport && !isMobile ? '0 0 400px' : '1 1 auto', minWidth: 0 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Loading reports...</div>
                    ) : reports.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: colors.textTertiary }}>
                            <Flag size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p>No reports found</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {reports.map(r => {
                                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.open;
                                const isSelected = selectedReport?.id === r.id;
                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => { setSelectedReport(r); setResolutionNote(r.resolutionNote || ''); }}
                                        style={{
                                            padding: '14px 16px', borderRadius: borderRadius.md,
                                            backgroundColor: isSelected ? `${colors.primary}15` : colors.surface,
                                            border: `1px solid ${isSelected ? `${colors.primary}40` : colors.glassBorder}`,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                                                    backgroundColor: sc.bg, color: sc.color,
                                                }}>{sc.icon} {sc.label}</span>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                                    backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary,
                                                }}>{TYPE_ICONS[r.targetType]} {r.targetType}</span>
                                            </div>
                                            <span style={{ fontSize: '11px', color: colors.textTertiary }}>{formatDate(r.createdAt)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                                                {REASON_LABELS[r.reason] || r.reason}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: colors.textTertiary }}>
                                            <User size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                                            <span style={{ color: colors.textSecondary }}>{r.reporterName}</span> reported <span style={{ color: colors.textSecondary }}>{r.reportedName}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {pages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                style={{ background: 'none', border: 'none', color: page <= 1 ? colors.textTertiary : colors.primary, cursor: page <= 1 ? 'default' : 'pointer', padding: '4px' }}>
                                <ChevronLeft size={20} />
                            </button>
                            <span style={{ fontSize: '13px', color: colors.textSecondary }}>Page {page} of {pages}</span>
                            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                                style={{ background: 'none', border: 'none', color: page >= pages ? colors.textTertiary : colors.primary, cursor: page >= pages ? 'default' : 'pointer', padding: '4px' }}>
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Report detail panel */}
                {selectedReport && (
                    <div style={{
                        flex: '1 1 auto', minWidth: 0,
                        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
                        border: `1px solid ${colors.glassBorder}`, padding: '20px',
                        position: isMobile ? 'static' : 'sticky', top: '20px', alignSelf: 'flex-start',
                    }}>
                        {/* Detail header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={18} color="#f59e0b" /> Report Details
                            </h3>
                            <button onClick={() => setSelectedReport(null)}
                                style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: '4px' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Status & Type */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {(() => { const sc = STATUS_CONFIG[selectedReport.status]; return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, backgroundColor: sc.bg, color: sc.color }}>
                                    {sc.icon} {sc.label}
                                </span>
                            ); })()}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary }}>
                                {TYPE_ICONS[selectedReport.targetType]} {selectedReport.targetType}
                            </span>
                            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                {REASON_LABELS[selectedReport.reason] || selectedReport.reason}
                            </span>
                        </div>

                        {/* Reporter */}
                        <DetailRow label="Reported by" value={selectedReport.reporterName} subValue={`Discord ID: ${selectedReport.reporterUserId}`} />
                        {/* Reported user */}
                        <DetailRow label="Reported user" value={selectedReport.reportedName} subValue={`Discord ID: ${selectedReport.reportedUserId}`} />
                        {/* Date */}
                        <DetailRow label="Filed" value={formatDate(selectedReport.createdAt)} />

                        {/* Link to content */}
                        {buildContentLink(selectedReport) && (
                            <div style={{ marginBottom: '14px' }}>
                                <a href={buildContentLink(selectedReport)!} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: colors.primary, fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                                    <ExternalLink size={13} /> View reported content
                                </a>
                            </div>
                        )}

                        {/* Reporter's details */}
                        {selectedReport.details && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Reporter's Description
                                </label>
                                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: borderRadius.sm, fontSize: '13px', color: colors.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {selectedReport.details}
                                </div>
                            </div>
                        )}

                        {/* Content snapshot */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                Content Snapshot (at time of report)
                            </label>
                            <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: borderRadius.sm, fontSize: '13px', lineHeight: 1.6 }}>
                                {renderSnapshot(selectedReport)}
                            </div>
                        </div>

                        {/* Resolution info (if resolved) */}
                        {selectedReport.resolvedAt && (
                            <div style={{ marginBottom: '16px', padding: '10px 12px', backgroundColor: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: borderRadius.sm }}>
                                <div style={{ fontSize: '12px', color: colors.textTertiary, marginBottom: '4px' }}>
                                    Resolved by <strong style={{ color: colors.textSecondary }}>{selectedReport.resolvedByName}</strong> on {formatDate(selectedReport.resolvedAt)}
                                </div>
                                {selectedReport.resolutionNote && (
                                    <div style={{ fontSize: '13px', color: colors.textSecondary, whiteSpace: 'pre-wrap' }}>{selectedReport.resolutionNote}</div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        {(selectedReport.status === 'open' || selectedReport.status === 'reviewing') && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Resolution Note (optional)
                                </label>
                                <textarea
                                    value={resolutionNote} onChange={e => setResolutionNote(e.target.value)}
                                    placeholder="Add a note about the action taken..."
                                    maxLength={2000}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: borderRadius.sm, padding: '10px 12px',
                                        color: colors.textPrimary, fontSize: '13px', minHeight: '60px',
                                        resize: 'vertical', outline: 'none', marginBottom: '12px',
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {selectedReport.status === 'open' && (
                                        <button onClick={() => handleStatusChange(selectedReport.id, 'reviewing')} disabled={saving}
                                            style={{ padding: '8px 16px', borderRadius: borderRadius.sm, border: '1px solid rgba(59,130,246,0.4)', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: saving ? 0.5 : 1 }}>
                                            <Eye size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Mark Reviewing
                                        </button>
                                    )}
                                    <button onClick={() => handleStatusChange(selectedReport.id, 'resolved')} disabled={saving}
                                        style={{ padding: '8px 16px', borderRadius: borderRadius.sm, border: `1px solid rgba(16,185,129,0.4)`, backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: saving ? 0.5 : 1 }}>
                                        <CheckCircle size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Resolve
                                    </button>
                                    <button onClick={() => handleStatusChange(selectedReport.id, 'dismissed')} disabled={saving}
                                        style={{ padding: '8px 16px', borderRadius: borderRadius.sm, border: '1px solid rgba(107,114,128,0.4)', backgroundColor: 'rgba(107,114,128,0.1)', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: saving ? 0.5 : 1 }}>
                                        <XCircle size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Dismiss
                                    </button>
                                    {selectedReport.targetType === 'comment' && (
                                        <button onClick={() => handleDeleteComment(selectedReport)} disabled={saving || deletingComment}
                                            style={{ padding: '8px 16px', borderRadius: borderRadius.sm, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: (saving || deletingComment) ? 0.5 : 1 }}>
                                            <Trash2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Delete Comment
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Reopen button for resolved/dismissed */}
                        {(selectedReport.status === 'resolved' || selectedReport.status === 'dismissed') && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                                <button onClick={() => handleStatusChange(selectedReport.id, 'open')} disabled={saving}
                                    style={{ padding: '8px 16px', borderRadius: borderRadius.sm, border: '1px solid rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: saving ? 0.5 : 1 }}>
                                    <Clock size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Reopen
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const DetailRow: React.FC<{ label: string; value: string; subValue?: string }> = ({ label, value, subValue }) => (
    <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
            {label}
        </label>
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>{value}</div>
        {subValue && <div style={{ fontSize: '11px', color: colors.textTertiary, fontFamily: 'monospace', marginTop: '2px' }}>{subValue}</div>}
    </div>
);
