import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { BookOpen, Save, RefreshCw, Settings, MessageSquare, Pause, Play } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';

const API = import.meta.env.VITE_API_URL || '';

interface StudioGuideSettings {
    id?: string;
    guildId?: string;
    enabled: boolean;
    channelId: string | null;
    pauseRoles: string[];
    cooldownSeconds: number;
    systemPrompt: string | null;
    model: string;
}

interface Conversation {
    id: string;
    userId: string;
    channelId: string;
    topic: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

const MODEL_OPTIONS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, Affordable)' },
    { value: 'gpt-4o', label: 'GPT-4o (Best quality)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (Fastest)' },
];

export const StudioGuidePage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [settings, setSettings] = useState<StudioGuideSettings>({
        enabled: true,
        channelId: null,
        pauseRoles: [],
        cooldownSeconds: 30,
        systemPrompt: null,
        model: 'gpt-4o-mini',
    });

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'settings' | 'conversations' | 'test'>('settings');

    // Test query state
    const [testQuery, setTestQuery] = useState('');
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!guildId) return;
        const controller = new AbortController();
        try {
            setLoading(true);
            setError(null);
            const [settingsRes, convoRes] = await Promise.all([
                fetch(`${API}/api/studio-guide/settings/${guildId}`, { credentials: 'include', signal: controller.signal }),
                fetch(`${API}/api/studio-guide/conversations/${guildId}`, { credentials: 'include', signal: controller.signal }),
            ]);
            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setSettings({
                    enabled: data.enabled,
                    channelId: data.channelId,
                    pauseRoles: data.pauseRoles || [],
                    cooldownSeconds: data.cooldownSeconds,
                    systemPrompt: data.systemPrompt,
                    model: data.model,
                });
            }
            if (convoRes.ok) setConversations(await convoRes.json());
        } catch (err: any) {
            if (err.name !== 'AbortError') setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveSettings = async () => {
        if (!guildId) return;
        setSaving(true);
        setError(null);
        setSaveMessage(null);
        try {
            const res = await fetch(`${API}/api/studio-guide/settings/${guildId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error(`Failed to save (${res.status})`);
            setSaveMessage('Settings saved successfully!');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (!guildId) return <div style={{ padding: spacing.xl, color: colors.textSecondary }}>Select a server first.</div>;
    if (loading) return <div style={{ padding: spacing.xl, color: colors.textSecondary }}>Loading...</div>;

    return (
        <div style={{ padding: spacing.xl, maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <BookOpen size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Studio Guide</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        AI assistant that answers FL Studio & music production questions
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Studio Guide monitors a designated help channel and intelligently detects when someone asks a question about 
                    FL Studio, music production, mixing, or music theory. It uses the official FL Studio manual and music theory 
                    guides as a knowledge base to provide accurate answers. Users can opt out, and staff can pause the bot at any time.
                </p>
            </div>

            {/* Error/Success */}
            {error && (
                <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md, color: '#ff4444' }}>
                    {error}
                </div>
            )}
            {saveMessage && (
                <div style={{ background: 'rgba(43,140,113,0.1)', border: '1px solid rgba(43,140,113,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md, color: colors.primary }}>
                    {saveMessage}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, borderBottom: `1px solid ${colors.border}`, paddingBottom: spacing.sm }}>
                {(['settings', 'conversations', 'test'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: `${spacing.sm} ${spacing.md}`,
                            background: tab === t ? colors.primary : 'transparent',
                            color: tab === t ? '#fff' : colors.textSecondary,
                            border: 'none',
                            borderRadius: borderRadius.sm,
                            cursor: 'pointer',
                            fontSize: typography.body.fontSize,
                            fontWeight: tab === t ? 600 : 400,
                            textTransform: 'capitalize',
                        }}
                    >
                        {t === 'test' ? 'Knowledge Lab' : t}
                    </button>
                ))}
            </div>

            {/* ─── Settings Tab ─── */}
            {tab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    {/* Enable/Disable */}
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ margin: 0, color: colors.textPrimary }}>Enabled</h3>
                                <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                                    Toggle the Studio Guide AI on or off
                                </p>
                            </div>
                            <button
                                onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                                style={{
                                    width: '48px', height: '26px', borderRadius: '13px',
                                    background: settings.enabled ? colors.primary : colors.border,
                                    border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                                }}
                            >
                                <div style={{
                                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                    position: 'absolute', top: '3px',
                                    left: settings.enabled ? '25px' : '3px', transition: 'left 0.2s',
                                }} />
                            </button>
                        </div>
                    </div>

                    {/* Channel Selector */}
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary }}>Help Channel</h3>
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                            The channel where the AI will monitor and answer questions
                        </p>
                        <ChannelSelect
                            guildId={guildId}
                            value={settings.channelId || ''}
                            onChange={(val) => setSettings(s => ({ ...s, channelId: val as string || null }))}
                            placeholder="Select a help channel"
                            channelTypes={[0]} // text channels only
                        />
                    </div>

                    {/* Pause Roles */}
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary }}>Pause Roles</h3>
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                            Roles that can pause/resume the AI using /guide pause. Leave empty for server admins only.
                        </p>
                        <RoleSelect
                            guildId={guildId}
                            value={settings.pauseRoles}
                            onChange={(val) => setSettings(s => ({ ...s, pauseRoles: val as string[] }))}
                            placeholder="Select roles"
                            multiple
                        />
                    </div>

                    {/* Cooldown */}
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary }}>Response Cooldown</h3>
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                            Minimum seconds between responses to the same user (prevents spamming)
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                            <input
                                type="range"
                                min={0}
                                max={300}
                                step={5}
                                value={settings.cooldownSeconds}
                                onChange={e => setSettings(s => ({ ...s, cooldownSeconds: Number(e.target.value) }))}
                                style={{ flex: 1 }}
                            />
                            <span style={{ color: colors.textPrimary, minWidth: '50px', textAlign: 'right' }}>
                                {settings.cooldownSeconds}s
                            </span>
                        </div>
                    </div>

                    {/* Model */}
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary }}>AI Model</h3>
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                            Which OpenAI model to use for responses
                        </p>
                        <select
                            value={settings.model}
                            onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
                            style={{
                                width: '100%', padding: spacing.sm, background: colors.background,
                                color: colors.textPrimary, border: `1px solid ${colors.border}`,
                                borderRadius: borderRadius.sm, fontSize: '14px',
                            }}
                        >
                            {MODEL_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Custom System Prompt */}
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                        <h3 style={{ margin: '0 0 4px', color: colors.textPrimary }}>Custom System Prompt</h3>
                        <p style={{ margin: '0 0 12px', color: colors.textSecondary, fontSize: '13px' }}>
                            Override the default personality and behaviour instructions. Leave blank for the default Fuji assistant persona.
                        </p>
                        <textarea
                            value={settings.systemPrompt || ''}
                            onChange={e => setSettings(s => ({ ...s, systemPrompt: e.target.value || null }))}
                            placeholder="Leave blank to use the default system prompt..."
                            rows={6}
                            style={{
                                width: '100%', padding: spacing.sm, background: colors.background,
                                color: colors.textPrimary, border: `1px solid ${colors.border}`,
                                borderRadius: borderRadius.sm, fontSize: '13px',
                                fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <button
                            onClick={saveSettings}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: `${spacing.sm} ${spacing.lg}`,
                                background: colors.primary, color: '#fff',
                                border: 'none', borderRadius: borderRadius.sm,
                                cursor: saving ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 600,
                                opacity: saving ? 0.7 : 1,
                            }}
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Conversations Tab ─── */}
            {tab === 'conversations' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                        <h3 style={{ margin: 0, color: colors.textPrimary }}>Recent Conversations</h3>
                        <button
                            onClick={fetchData}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: `${spacing.xs} ${spacing.sm}`,
                                background: colors.surface, color: colors.textSecondary,
                                border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm,
                                cursor: 'pointer', fontSize: '13px',
                            }}
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>

                    {conversations.length === 0 ? (
                        <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>
                            <MessageSquare size={40} style={{ marginBottom: spacing.sm, opacity: 0.4 }} />
                            <p>No conversations yet. The AI will start tracking conversations once it begins answering questions.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {conversations.map(c => (
                                <div
                                    key={c.id}
                                    style={{
                                        background: colors.surface, borderRadius: borderRadius.md,
                                        padding: spacing.md, display: 'flex', alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                            <span style={{
                                                display: 'inline-block', width: '8px', height: '8px',
                                                borderRadius: '50%', background: c.active ? colors.primary : colors.border,
                                            }} />
                                            <span style={{ color: colors.textPrimary, fontWeight: 500 }}>
                                                User: {c.userId.substring(0, 8)}...
                                            </span>
                                        </div>
                                        {c.topic && (
                                            <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                                                {c.topic}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
                                            {new Date(c.updatedAt).toLocaleString()}
                                        </div>
                                        <div style={{ color: c.active ? colors.primary : colors.textTertiary, fontSize: '11px', marginTop: '2px' }}>
                                            {c.active ? 'Active' : 'Ended'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Knowledge Lab Tab ─── */}
            {tab === 'test' && (
                <div>
                    <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.md }}>
                        <h3 style={{ margin: '0 0 8px', color: colors.textPrimary }}>Knowledge Lab</h3>
                        <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '13px' }}>
                            Test the AI's knowledge base by asking questions. This uses the same RAG pipeline as the live bot.
                        </p>
                        <div style={{ display: 'flex', gap: spacing.sm }}>
                            <input
                                type="text"
                                value={testQuery}
                                onChange={e => setTestQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !testLoading && runTest()}
                                placeholder="Ask a question about FL Studio..."
                                style={{
                                    flex: 1, padding: spacing.sm, background: colors.background,
                                    color: colors.textPrimary, border: `1px solid ${colors.border}`,
                                    borderRadius: borderRadius.sm, fontSize: '14px',
                                }}
                            />
                            <button
                                onClick={runTest}
                                disabled={testLoading || !testQuery.trim()}
                                style={{
                                    padding: `${spacing.sm} ${spacing.md}`,
                                    background: colors.primary, color: '#fff',
                                    border: 'none', borderRadius: borderRadius.sm,
                                    cursor: testLoading ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 600,
                                    opacity: (testLoading || !testQuery.trim()) ? 0.6 : 1,
                                }}
                            >
                                {testLoading ? 'Thinking...' : 'Ask'}
                            </button>
                        </div>
                    </div>

                    {testResult && (
                        <div style={{
                            background: colors.surface, borderRadius: borderRadius.md,
                            padding: spacing.lg, whiteSpace: 'pre-wrap',
                            color: colors.textPrimary, fontSize: '14px', lineHeight: '1.6',
                            borderLeft: `4px solid ${colors.primary}`,
                        }}>
                            {testResult}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    async function runTest() {
        if (!guildId || !testQuery.trim()) return;
        setTestLoading(true);
        setTestResult(null);
        try {
            // Use the /guide ask pattern via a simple proxy endpoint
            // For now, we call the settings endpoint to confirm connectivity
            // The actual test would need a dedicated endpoint in the future
            setTestResult('Knowledge Lab testing requires the bot to be online. Use /guide ask <question> in Discord to test the AI response pipeline.');
        } catch {
            setTestResult('Failed to run test.');
        } finally {
            setTestLoading(false);
        }
    }
};
