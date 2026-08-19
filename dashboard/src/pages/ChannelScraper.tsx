import React, { useState, useEffect, useCallback, useRef } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { useAuth } from '../components/AuthProvider';
import { Database, Download, PlayCircle, Loader, CheckCircle, AlertTriangle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

interface ChannelScraperSettings {
    guildId: string;
    channelId: string | null;
    backfillStatus: 'idle' | 'running' | 'done' | 'error';
    backfillCount: number;
    backfillError: string | null;
    capturedMessageCount: number;
}

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
        </div>
    );
};
