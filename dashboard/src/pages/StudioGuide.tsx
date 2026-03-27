import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { BookOpen, Save, RefreshCw, MessageSquare, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
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

interface KnowledgeEntry {
    id: string;
    guildId: string;
    title: string;
    content: string;
    category: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

const CATEGORY_OPTIONS = [
    { value: 'general', label: 'General' },
    { value: 'fl-studio', label: 'FL Studio' },
    { value: 'mixing', label: 'Mixing & Mastering' },
    { value: 'music-theory', label: 'Music Theory' },
    { value: 'sound-design', label: 'Sound Design' },
    { value: 'community', label: 'Community Rules' },
];

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
    const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'settings' | 'knowledge' | 'conversations'>('settings');

    // Knowledge form state
    const [newEntry, setNewEntry] = useState({ title: '', content: '', category: 'general' });
    const [addingEntry, setAddingEntry] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEntry, setEditEntry] = useState({ title: '', content: '', category: 'general' });
    const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!guildId) return;
        const controller = new AbortController();
        try {
            setLoading(true);
            setError(null);
            const [settingsRes, convoRes, knowRes] = await Promise.all([
                fetch(`${API}/api/studio-guide/settings/${guildId}`, { credentials: 'include', signal: controller.signal }),
                fetch(`${API}/api/studio-guide/conversations/${guildId}`, { credentials: 'include', signal: controller.signal }),
                fetch(`${API}/api/studio-guide/knowledge/${guildId}`, { credentials: 'include', signal: controller.signal }),
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
            if (knowRes.ok) setKnowledge(await knowRes.json());
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

    const addKnowledgeEntry = async () => {
        if (!guildId || !newEntry.title.trim() || !newEntry.content.trim()) return;
        setKnowledgeError(null);
        try {
            const res = await fetch(`${API}/api/studio-guide/knowledge/${guildId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newEntry),
            });
            if (!res.ok) throw new Error(`Failed to add entry (${res.status})`);
            const entry = await res.json();
            setKnowledge(k => [entry, ...k]);
            setNewEntry({ title: '', content: '', category: 'general' });
            setAddingEntry(false);
        } catch (err: any) {
            setKnowledgeError(err.message || 'Failed to add entry');
        }
    };

    const saveKnowledgeEdit = async (id: string) => {
        if (!guildId) return;
        setKnowledgeError(null);
        try {
            const res = await fetch(`${API}/api/studio-guide/knowledge/${guildId}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(editEntry),
            });
            if (!res.ok) throw new Error(`Failed to update entry (${res.status})`);
            const updated = await res.json();
            setKnowledge(k => k.map(e => e.id === id ? updated : e));
            setEditingId(null);
        } catch (err: any) {
            setKnowledgeError(err.message || 'Failed to update entry');
        }
    };

    const toggleKnowledgeEnabled = async (entry: KnowledgeEntry) => {
        if (!guildId) return;
        try {
            const res = await fetch(`${API}/api/studio-guide/knowledge/${guildId}/${entry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled: !entry.enabled }),
            });
            if (res.ok) {
                const updated = await res.json();
                setKnowledge(k => k.map(e => e.id === entry.id ? updated : e));
            }
        } catch { /* ignore */ }
    };

    const deleteKnowledgeEntry = async (id: string) => {
        if (!guildId || !confirm('Delete this knowledge entry?')) return;
        try {
            const res = await fetch(`${API}/api/studio-guide/knowledge/${guildId}/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) setKnowledge(k => k.filter(e => e.id !== id));
        } catch { /* ignore */ }
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
                {(['settings', 'knowledge', 'conversations'] as const).map(t => (
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
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        {t === 'knowledge' ? `Knowledge Base${knowledge.length > 0 ? ` (${knowledge.filter(k => k.enabled).length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
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

            {/* ─── Knowledge Base Tab ─── */}
            {tab === 'knowledge' && (
                <div>
                    <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                        <p style={{ margin: 0, color: colors.textPrimary, fontSize: '14px' }}>
                            Add specific facts, Q&amp;A pairs, or community-specific information here. These are injected directly into every AI response as authoritative knowledge, so the bot will always use them when relevant — even without the FAISS index.
                        </p>
                    </div>

                    {knowledgeError && (
                        <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md, color: '#ff4444' }}>
                            {knowledgeError}
                        </div>
                    )}

                    {/* Add new entry form */}
                    {addingEntry ? (
                        <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.md, border: `1px solid ${colors.primary}` }}>
                            <h4 style={{ margin: '0 0 12px', color: colors.textPrimary }}>New Knowledge Entry</h4>
                            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
                                <input
                                    type="text"
                                    value={newEntry.title}
                                    onChange={e => setNewEntry(n => ({ ...n, title: e.target.value }))}
                                    placeholder="Title / Topic (e.g. How to sidechain in FL Studio)"
                                    style={{ flex: 1, padding: spacing.sm, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, fontSize: '14px' }}
                                />
                                <select
                                    value={newEntry.category}
                                    onChange={e => setNewEntry(n => ({ ...n, category: e.target.value }))}
                                    style={{ padding: spacing.sm, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, fontSize: '13px' }}
                                >
                                    {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <textarea
                                value={newEntry.content}
                                onChange={e => setNewEntry(n => ({ ...n, content: e.target.value }))}
                                placeholder="The knowledge / answer text. Be as specific and detailed as you need."
                                rows={5}
                                style={{ width: '100%', padding: spacing.sm, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', marginBottom: spacing.sm }}
                            />
                            <div style={{ display: 'flex', gap: spacing.sm }}>
                                <button
                                    onClick={addKnowledgeEntry}
                                    disabled={!newEntry.title.trim() || !newEntry.content.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: `${spacing.sm} ${spacing.md}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: (!newEntry.title.trim() || !newEntry.content.trim()) ? 0.5 : 1 }}
                                >
                                    <Check size={14} /> Save Entry
                                </button>
                                <button
                                    onClick={() => { setAddingEntry(false); setNewEntry({ title: '', content: '', category: 'general' }); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: `${spacing.sm} ${spacing.md}`, background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: '14px' }}
                                >
                                    <X size={14} /> Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingEntry(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: `${spacing.sm} ${spacing.md}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}
                        >
                            <Plus size={16} /> Add Knowledge Entry
                        </button>
                    )}

                    {/* Entries list */}
                    {knowledge.length === 0 && !addingEntry ? (
                        <div style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>
                            <BookOpen size={40} style={{ marginBottom: spacing.sm, opacity: 0.4 }} />
                            <p>No custom knowledge yet. Add entries to teach the bot community-specific answers.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {knowledge.map(entry => (
                                <div key={entry.id} style={{ background: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, opacity: entry.enabled ? 1 : 0.5 }}>
                                    {editingId === entry.id ? (
                                        <div>
                                            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
                                                <input
                                                    type="text"
                                                    value={editEntry.title}
                                                    onChange={e => setEditEntry(n => ({ ...n, title: e.target.value }))}
                                                    style={{ flex: 1, padding: spacing.sm, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, fontSize: '14px' }}
                                                />
                                                <select
                                                    value={editEntry.category}
                                                    onChange={e => setEditEntry(n => ({ ...n, category: e.target.value }))}
                                                    style={{ padding: spacing.sm, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, fontSize: '13px' }}
                                                >
                                                    {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </select>
                                            </div>
                                            <textarea
                                                value={editEntry.content}
                                                onChange={e => setEditEntry(n => ({ ...n, content: e.target.value }))}
                                                rows={5}
                                                style={{ width: '100%', padding: spacing.sm, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', marginBottom: spacing.sm }}
                                            />
                                            <div style={{ display: 'flex', gap: spacing.sm }}>
                                                <button onClick={() => saveKnowledgeEdit(entry.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: `${spacing.xs} ${spacing.sm}`, background: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                                    <Check size={13} /> Save
                                                </button>
                                                <button onClick={() => setEditingId(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: `${spacing.xs} ${spacing.sm}`, background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: '13px' }}>
                                                    <X size={13} /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: '4px' }}>
                                                    <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px' }}>{entry.title}</span>
                                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', background: 'rgba(43,140,113,0.15)', color: colors.primary }}>{entry.category}</span>
                                                    {!entry.enabled && <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>disabled</span>}
                                                </div>
                                                <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>{entry.content}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => toggleKnowledgeEnabled(entry)}
                                                    title={entry.enabled ? 'Disable' : 'Enable'}
                                                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: entry.enabled ? 'rgba(43,140,113,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${entry.enabled ? colors.primary : colors.border}`, borderRadius: borderRadius.sm, cursor: 'pointer' }}
                                                >
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: entry.enabled ? colors.primary : colors.border }} />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingId(entry.id); setEditEntry({ title: entry.title, content: entry.content, category: entry.category }); }}
                                                    title="Edit"
                                                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textSecondary }}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteKnowledgeEntry(entry.id)}
                                                    title="Delete"
                                                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid rgba(255,68,68,0.3)`, borderRadius: borderRadius.sm, cursor: 'pointer', color: '#ff4444' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
