import React, { useState, useEffect, useCallback, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import { Database, Download, PlayCircle, Loader, CheckCircle, AlertTriangle, FileText, Upload, Paperclip, CornerDownRight, Search, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

interface ChannelScraperSettings {
    guildId: string;
    channelId: string | null;
    backfillStatus: 'idle' | 'running' | 'done' | 'error';
    backfillCount: number;
    backfillError: string | null;
    capturedMessageCount: number;
}

interface TranscriptRow {
    messageId?: string;
    authorId: string;
    authorUsername: string;
    content: string;
    replyToMessageId: string | null;
    attachments: { url: string; filename: string; contentType: string | null }[] | null;
    embeds: any[] | null;
    createdAt: string;
}

const TRANSCRIPT_PAGE_SIZE = 100;

/**
 * Turns an exported .jsonl file into a readable chat transcript, entirely in the browser — the
 * file is read locally via FileReader and never uploaded anywhere. Built because the raw file
 * (one bare JSON object per line) is meant for feeding a training pipeline, not for a person to
 * open and make sense of.
 */
const TranscriptReader: React.FC = () => {
    const [rows, setRows] = useState<TranscriptRow[] | null>(null);
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [skippedLines, setSkippedLines] = useState(0);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        setParseError(null);
        setFileName(file.name);
        setPage(0);
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const parsed: TranscriptRow[] = [];
            let skipped = 0;
            for (const line of lines) {
                try { parsed.push(JSON.parse(line)); } catch { skipped++; }
            }
            if (!parsed.length) {
                setParseError('No readable messages found in that file — is it the .jsonl export from this page?');
                setRows(null);
                return;
            }
            parsed.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            setRows(parsed);
            setSkippedLines(skipped);
        };
        reader.onerror = () => setParseError('Could not read that file.');
        reader.readAsText(file);
    };

    // Reply lookups: only meaningful for a file exported after messageId was added — an older
    // export or one lacking messageId still displays fine, replies just won't be linked.
    const byId = React.useMemo(() => {
        const map = new Map<string, TranscriptRow>();
        (rows || []).forEach(r => { if (r.messageId) map.set(r.messageId, r); });
        return map;
    }, [rows]);

    const filtered = React.useMemo(() => {
        if (!rows) return [];
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r => r.content.toLowerCase().includes(q) || r.authorUsername.toLowerCase().includes(q));
    }, [rows, search]);

    const uniqueAuthors = React.useMemo(() => new Set((rows || []).map(r => r.authorId)).size, [rows]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / TRANSCRIPT_PAGE_SIZE));
    const pageRows = filtered.slice(page * TRANSCRIPT_PAGE_SIZE, (page + 1) * TRANSCRIPT_PAGE_SIZE);

    const reset = () => { setRows(null); setFileName(''); setParseError(null); setSkippedLines(0); setSearch(''); setPage(0); if (fileInputRef.current) fileInputRef.current.value = ''; };

    return (
        <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <FileText size={18} color={colors.primary} />
                <h3 style={{ margin: 0, fontSize: '15px' }}>Read an exported file</h3>
            </div>
            <p style={{ margin: '4px 0 12px', fontSize: '12px', color: colors.textSecondary }}>
                Open a .jsonl file you've exported (from this or any capture) as a plain chat transcript. The file
                is read on your own computer — nothing is uploaded.
            </p>

            {!rows && (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px', border: `1px dashed ${colors.border}`, borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textSecondary }}>
                    <Upload size={16} />
                    <span>Click to choose a .jsonl file</span>
                    <input ref={fileInputRef} type="file" accept=".jsonl,.txt,.json" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
            )}

            {parseError && <p style={{ margin: '8px 0 0', fontSize: '12px', color: colors.error }}>{parseError}</p>}

            {rows && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.sm }}>
                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                            <strong style={{ color: colors.textPrimary }}>{fileName}</strong> — {rows.length.toLocaleString()} messages · {uniqueAuthors} people
                            {skippedLines > 0 && ` · ${skippedLines} line(s) skipped (unreadable)`}
                        </span>
                        <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '12px', padding: 0 }}>
                            <X size={13} /> Open a different file
                        </button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: spacing.sm }}>
                        <Search size={14} color={colors.textSecondary} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by text or username..."
                            style={{ width: '100%', padding: '8px 10px 8px 32px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textPrimary, boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ maxHeight: '520px', overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm }}>
                        {pageRows.length === 0 && (
                            <p style={{ padding: spacing.md, color: colors.textSecondary, fontSize: '13px', margin: 0 }}>No messages match that search.</p>
                        )}
                        {pageRows.map((r, i) => {
                            const replyTo = r.replyToMessageId ? byId.get(r.replyToMessageId) : null;
                            return (
                                <div key={i} style={{ padding: '10px 14px', borderBottom: i < pageRows.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                                    {replyTo && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: colors.textSecondary, marginBottom: 3 }}>
                                            <CornerDownRight size={11} />
                                            <span>Replying to <strong>{replyTo.authorUsername}</strong>: {replyTo.content.slice(0, 60) || '(no text)'}{replyTo.content.length > 60 ? '…' : ''}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                        <strong style={{ fontSize: '13px', color: colors.textPrimary }}>{r.authorUsername}</strong>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>{new Date(r.createdAt).toLocaleString()}</span>
                                    </div>
                                    {r.content && <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.content}</p>}
                                    {!!r.attachments?.length && (
                                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {r.attachments.map((a, ai) => (
                                                <a key={ai} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.primary, textDecoration: 'none' }}>
                                                    <Paperclip size={11} /> {a.filename}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textPrimary, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.5 : 1, fontSize: '12px' }}>
                                Previous
                            </button>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>Page {page + 1} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textPrimary, cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1, fontSize: '12px' }}>
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const ChannelScraperPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [settings, setSettings] = useState<ChannelScraperSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [startingBackfill, setStartingBackfill] = useState(false);
    const [maxMessages, setMaxMessages] = useState('5000');
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 4000);
    };

    const load = useCallback(async () => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/channel-scraper/settings/${guildId}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load settings');
            setSettings(data);
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { load(); }, [load]);

    // Poll while a backfill is running so progress updates without a manual refresh.
    useEffect(() => {
        if (settings?.backfillStatus === 'running') {
            pollRef.current = setInterval(load, 3000);
        } else if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [settings?.backfillStatus, load]);

    const updateChannel = async (channelId: string) => {
        if (!guildId) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/channel-scraper/settings/${guildId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channelId || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            showMsg('success', channelId ? 'Channel set — capturing new messages now.' : 'Capture disabled.');
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const startBackfill = async () => {
        if (!guildId) return;
        const n = parseInt(maxMessages, 10);
        setStartingBackfill(true);
        try {
            const res = await fetch(`${API}/api/channel-scraper/backfill/${guildId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxMessages: Number.isFinite(n) && n > 0 ? n : undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start backfill');
            showMsg('success', `Backfill started (up to ${data.maxMessages.toLocaleString()} messages).`);
            await load();
        } catch (e: any) {
            showMsg('error', e.message || 'Failed to start backfill');
        } finally {
            setStartingBackfill(false);
        }
    };

    const exportData = () => {
        if (!guildId) return;
        window.open(`${API}/api/channel-scraper/export/${guildId}`, '_blank');
    };

    if (!guildId) return null;
    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader className="spin" /></div>;
    }

    return (
        <div style={{ padding: spacing.lg, maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Database size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Channel Scraper</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Capture a channel's messages for later export</p>
                </div>
            </div>

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Pick one channel below and every message posted there is saved — author, content, timestamp, reply
                    context, and attachments. This is opt-in and captures real member content, so make sure the people
                    posting in that channel are aware of it before enabling this. Existing history can be pulled in
                    with a one-time backfill; going forward, new messages are captured automatically.
                </p>
            </div>

            {msg && (
                <div style={{ padding: '10px 14px', borderRadius: borderRadius.sm, marginBottom: spacing.md, backgroundColor: msg.type === 'success' ? `${colors.success}22` : `${colors.error}22`, color: msg.type === 'success' ? colors.success : colors.error, fontSize: '13px' }}>
                    {msg.text}
                </div>
            )}

            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>Channel to capture</label>
                <ChannelSelect
                    guildId={guildId}
                    value={settings?.channelId ?? ''}
                    onChange={v => updateChannel(Array.isArray(v) ? v[0] : v)}
                    placeholder="Select a channel to capture..."
                />
                {saving && <p style={{ margin: '8px 0 0', fontSize: '12px', color: colors.textSecondary }}>Saving…</p>}
            </div>

            {settings?.channelId && (
                <>
                    <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>Captured messages</div>
                            <div style={{ fontSize: '22px', fontWeight: 700, color: colors.textPrimary }}>{settings.capturedMessageCount.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>Backfill status</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {settings.backfillStatus === 'running' && <><Loader size={14} className="spin" /> Running — {settings.backfillCount.toLocaleString()} so far</>}
                                {settings.backfillStatus === 'done' && <><CheckCircle size={14} color={colors.success} /> Done — {settings.backfillCount.toLocaleString()} captured</>}
                                {settings.backfillStatus === 'error' && <><AlertTriangle size={14} color={colors.error} /> Failed</>}
                                {settings.backfillStatus === 'idle' && 'Not started'}
                            </div>
                            {settings.backfillStatus === 'error' && settings.backfillError && (
                                <div style={{ fontSize: '11px', color: colors.error, marginTop: 4 }}>{settings.backfillError}</div>
                            )}
                        </div>
                    </div>

                    <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, marginBottom: '4px' }}>Max messages to pull</label>
                            <input type="number" value={maxMessages} onChange={e => setMaxMessages(e.target.value)} min={1} max={20000}
                                style={{ width: '120px', padding: '8px 10px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textPrimary }} />
                        </div>
                        <button onClick={startBackfill} disabled={startingBackfill || settings.backfillStatus === 'running'}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', backgroundColor: colors.primary, border: 'none', borderRadius: borderRadius.sm, color: '#fff', cursor: settings.backfillStatus === 'running' ? 'default' : 'pointer', fontWeight: 600, opacity: settings.backfillStatus === 'running' ? 0.6 : 1 }}>
                            <PlayCircle size={16} /> {settings.backfillStatus === 'running' ? 'Backfill running…' : 'Start backfill'}
                        </button>
                        <button onClick={exportData} disabled={settings.capturedMessageCount === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, color: colors.textPrimary, cursor: settings.capturedMessageCount === 0 ? 'default' : 'pointer', opacity: settings.capturedMessageCount === 0 ? 0.5 : 1 }}>
                            <Download size={16} /> Export JSONL
                        </button>
                    </div>
                </>
            )}

            <TranscriptReader />
        </div>
    );
};
