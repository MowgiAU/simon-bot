import React, { useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { Flag, X, Send, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface ReportButtonProps {
    targetType: 'track' | 'profile' | 'comment' | 'message';
    targetId: string;
    style?: React.CSSProperties;
    iconOnly?: boolean;
}

const REASONS = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'copyright', label: 'Copyright infringement' },
    { value: 'nsfw', label: 'NSFW / inappropriate content' },
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'other', label: 'Other' },
];

export const ReportButton: React.FC<ReportButtonProps> = ({ targetType, targetId, style, iconOnly }) => {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async () => {
        if (!reason) return;
        setSubmitting(true);
        setResult(null);
        try {
            await axios.post('/api/reports', { targetType, targetId, reason, details: details.trim() || null }, { withCredentials: true });
            setResult({ type: 'success', text: 'Report submitted. Our team will review it shortly.' });
            setTimeout(() => { setOpen(false); setResult(null); setReason(''); setDetails(''); }, 2500);
        } catch (e: any) {
            setResult({ type: 'error', text: e.response?.data?.error || 'Failed to submit report' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => { setOpen(true); setResult(null); setReason(''); setDetails(''); }}
                title="Report"
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', color: colors.textTertiary,
                    cursor: 'pointer', padding: '4px 8px', borderRadius: borderRadius.sm,
                    fontSize: '13px', transition: 'color 0.15s',
                    ...style,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = colors.textTertiary)}
            >
                <Flag size={14} />
                {!iconOnly && 'Report'}
            </button>

            {open && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    padding: '16px',
                }} onClick={() => setOpen(false)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            backgroundColor: colors.surface, borderRadius: borderRadius.lg,
                            border: `1px solid ${colors.glassBorder}`,
                            padding: '20px', width: '380px', maxWidth: '90vw',
                            maxHeight: '85vh', overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <AlertTriangle size={18} color="#ef4444" />
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>
                                    Report {targetType}
                                </h3>
                            </div>
                            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: '4px' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Reason select */}
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textSecondary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Reason
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {REASONS.map(r => (
                                    <label key={r.value} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '6px 10px', borderRadius: borderRadius.sm,
                                        backgroundColor: reason === r.value ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${reason === r.value ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                        cursor: 'pointer', fontSize: '13px', color: colors.textPrimary,
                                        transition: 'all 0.15s',
                                    }}>
                                        <input type="radio" name="report-reason" value={r.value}
                                            checked={reason === r.value} onChange={() => setReason(r.value)}
                                            style={{ accentColor: '#ef4444' }} />
                                        {r.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Details */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textSecondary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Additional details <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                            </label>
                            <textarea
                                value={details} onChange={e => setDetails(e.target.value)}
                                placeholder="Describe the issue..."
                                maxLength={2000}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: borderRadius.sm,
                                    padding: '8px 10px', color: colors.textPrimary,
                                    fontSize: '13px', minHeight: '60px', resize: 'vertical', outline: 'none',
                                }}
                            />
                        </div>

                        {/* Result message */}
                        {result && (
                            <div style={{
                                padding: '8px 10px', borderRadius: borderRadius.sm, marginBottom: '10px',
                                fontSize: '13px', fontWeight: 600,
                                backgroundColor: result.type === 'success' ? 'rgba(242, 120, 10,0.1)' : 'rgba(239,68,68,0.1)',
                                color: result.type === 'success' ? '#F2780A' : '#ef4444',
                                border: `1px solid ${result.type === 'success' ? 'rgba(242, 120, 10,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            }}>
                                {result.text}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setOpen(false)}
                                style={{
                                    flex: 1, padding: '9px',
                                    backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textSecondary, border: `1px solid rgba(255,255,255,0.1)`,
                                    borderRadius: borderRadius.md, cursor: 'pointer',
                                    fontWeight: 600, fontSize: '13px',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!reason || submitting || result?.type === 'success'}
                                style={{
                                    flex: 1, padding: '9px',
                                    backgroundColor: '#ef4444', color: 'white', border: 'none',
                                    borderRadius: borderRadius.md, cursor: (!reason || submitting) ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '13px',
                                    opacity: (!reason || submitting || result?.type === 'success') ? 0.5 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                }}
                            >
                                <Send size={13} />
                                {submitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
