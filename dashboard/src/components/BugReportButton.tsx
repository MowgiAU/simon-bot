import React, { useState, useRef } from 'react';
import { Bug, X, Send, Camera, ChevronDown, ChevronUp, Loader, CheckCircle } from 'lucide-react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from './AuthProvider';
import { getRecentErrors } from '../lib/errorCapture';

const MAX_DESC = 2000;

export const BugReportButton: React.FC = () => {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [desc, setDesc] = useState('');
    const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
    const [wantScreenshot, setWantScreenshot] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const errors = getRecentErrors();

    const openModal = () => {
        setOpen(true);
        setDone(false);
        setError('');
        setDesc('');
        setScreenshotBlob(null);
        setScreenshotPreview(null);
        setWantScreenshot(false);
        setShowErrors(false);
    };

    const captureScreen = async () => {
        setCapturing(true);
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await new Promise<void>(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
            await new Promise(res => requestAnimationFrame(res));
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1920;
            canvas.height = video.videoHeight || 1080;
            canvas.getContext('2d')!.drawImage(video, 0, 0);
            stream.getTracks().forEach(t => t.stop());
            const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.75));
            setScreenshotBlob(blob);
            setScreenshotPreview(URL.createObjectURL(blob));
        } catch {
            // user cancelled or browser denied — silently ignore
        } finally {
            setCapturing(false);
        }
    };

    const handleScreenshotToggle = async (checked: boolean) => {
        setWantScreenshot(checked);
        if (checked && !screenshotBlob) await captureScreen();
        if (!checked) { setScreenshotBlob(null); setScreenshotPreview(null); }
    };

    const handleSubmit = async () => {
        if (!desc.trim()) { setError('Please describe the bug.'); return; }
        if (!user) { setError('You must be logged in to submit a bug report.'); return; }
        setSubmitting(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('pageUrl', window.location.href);
            fd.append('description', desc.trim());
            fd.append('errors', JSON.stringify(getRecentErrors()));
            fd.append('userAgent', navigator.userAgent);
            fd.append('viewport', `${window.innerWidth}x${window.innerHeight}`);
            if (screenshotBlob) fd.append('screenshot', screenshotBlob, 'screenshot.jpg');

            const res = await fetch('/api/bug-reports', { method: 'POST', credentials: 'include', body: fd });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Server error ${res.status}`);
            }
            setDone(true);
            setTimeout(() => setOpen(false), 2500);
        } catch (e: any) {
            setError(e.message || 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* Floating trigger button */}
            <button
                onClick={openModal}
                title="Report a bug"
                style={{
                    position: 'fixed', bottom: 24, left: 24, zIndex: 9000,
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(30,35,50,0.92)', border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: colors.textTertiary, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.primary; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
            >
                <Bug size={18} />
            </button>

            {/* Modal overlay */}
            {open && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '0 0 80px 24px', pointerEvents: 'none' }}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            pointerEvents: 'all',
                            width: 380, maxWidth: 'calc(100vw - 48px)',
                            background: '#1a1e2e', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: borderRadius.lg, boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            maxHeight: 'calc(100vh - 120px)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Bug size={16} color={colors.primary} />
                                <span style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>Report a Bug</span>
                            </div>
                            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 2, display: 'flex' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {done ? (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <CheckCircle size={40} color={colors.success} style={{ marginBottom: 12 }} />
                                    <p style={{ margin: 0, fontWeight: 600, color: colors.textPrimary }}>Report submitted!</p>
                                    <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textSecondary }}>Thanks for helping improve Fuji Studio.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Auto-captured URL */}
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Page</label>
                                        <div style={{ fontSize: 12, color: colors.textSecondary, background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: borderRadius.sm, wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {window.location.href}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                                            What happened? <span style={{ color: colors.error }}>*</span>
                                        </label>
                                        <textarea
                                            value={desc}
                                            onChange={e => setDesc(e.target.value.slice(0, MAX_DESC))}
                                            placeholder="Describe the bug — what did you expect vs what happened?"
                                            rows={4}
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: '8px 10px', color: colors.textPrimary, fontSize: 13, resize: 'vertical', outline: 'none', minHeight: 80 }}
                                        />
                                        <div style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'right', marginTop: 2 }}>{desc.length}/{MAX_DESC}</div>
                                    </div>

                                    {/* Screenshot permission */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: borderRadius.sm, padding: '10px 12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={wantScreenshot}
                                                onChange={e => handleScreenshotToggle(e.target.checked)}
                                                disabled={capturing}
                                                style={{ marginTop: 2, accentColor: colors.primary, flexShrink: 0 }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Camera size={13} /> Attach a screenshot
                                                    {capturing && <Loader size={12} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />}
                                                </div>
                                                <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                                                    Your browser will ask you to select a tab to share. No audio is captured.
                                                </div>
                                            </div>
                                        </label>
                                        {screenshotPreview && (
                                            <div style={{ marginTop: 10, position: 'relative' }}>
                                                <img src={screenshotPreview} alt="Screenshot preview" style={{ width: '100%', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} />
                                                <button
                                                    onClick={() => { setScreenshotBlob(null); setScreenshotPreview(null); setWantScreenshot(false); }}
                                                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Recent errors (collapsible) */}
                                    {errors.length > 0 && (
                                        <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                                            <button
                                                onClick={() => setShowErrors(v => !v)}
                                                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: colors.textSecondary, fontSize: 12 }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.error, display: 'inline-block' }} />
                                                    {errors.length} recent error{errors.length !== 1 ? 's' : ''} captured
                                                </span>
                                                {showErrors ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </button>
                                            {showErrors && (
                                                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                                                    {errors.map((e, i) => (
                                                        <div key={i} style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                            <span style={{ color: colors.error }}>●</span> {e.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Error */}
                                    {error && (
                                        <div style={{ fontSize: 12, color: colors.error, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: borderRadius.sm, border: '1px solid rgba(239,68,68,0.2)' }}>
                                            {error}
                                        </div>
                                    )}

                                    {!user && (
                                        <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center' }}>
                                            You need to be <a href="/login" style={{ color: colors.primary }}>logged in</a> to submit a bug report.
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !user || !desc.trim()}
                                        style={{ padding: '10px', background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: (submitting || !user || !desc.trim()) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (submitting || !user || !desc.trim()) ? 0.6 : 1 }}
                                    >
                                        {submitting ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</> : <><Send size={14} /> Submit Report</>}
                                    </button>
                                    <p style={{ margin: 0, fontSize: 10, color: colors.textTertiary, textAlign: 'center' }}>Limited to 3 reports per hour.</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
