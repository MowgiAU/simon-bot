import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { 
    Swords, Plus, Trophy, Users, BarChart3, Calendar, 
    ChevronDown, ChevronUp, Trash2, Edit, Play, Vote,
    ExternalLink, Award, Archive, Upload, Clock, X, Save,
    Building2, Link2, FileDown, Settings, Gift, Megaphone
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

/** Convert a UTC ISO string to a value suitable for a datetime-local input (local time). */
function toLocalDTInput(utcStr: string | null): string {
    if (!utcStr) return '';
    const d = new Date(utcStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local input value (local time) back to a UTC ISO string for the API. */
function localDTToISO(localStr: string): string | null {
    if (!localStr) return null;
    return new Date(localStr).toISOString();
}

interface Battle {
    id: string;
    title: string;
    description: string | null;
    status: string;
    rules: string | null;
    prizes: { place: string; description: string }[] | null;
    submissionStart: string | null;
    submissionEnd: string | null;
    votingStart: string | null;
    votingEnd: string | null;
    announcementChannelId: string | null;
    categoryId: string | null;
    sponsorId: string | null;
    winnerEntryId: string | null;
    createdAt: string;
    sponsor: Sponsor | null;
    entries?: Entry[];
    _count?: { entries: number };
}

interface Entry {
    id: string;
    userId: string;
    username: string;
    trackTitle: string;
    audioUrl: string;
    coverUrl: string | null;
    voteCount: number;
    source: string;
    createdAt: string;
}

interface Sponsor {
    id: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    description: string | null;
    isActive: boolean;
    links: SponsorLink[];
    _count?: { battles: number };
}

interface SponsorLink {
    id: string;
    label: string;
    url: string;
    clicks: number;
}

interface AnalyticsReport {
    battleTitle: string;
    status: string;
    totalEntries: number;
    totalVotesCast: number;
    pageViews: number;
    sponsorClicks: number;
    uniqueParticipants: number;
    sponsorLinkBreakdown: { label: string; url: string; clicks: number }[];
}

type Tab = 'battles' | 'sponsors' | 'backfill' | 'settings';

export const BeatBattlePage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id || 'default-guild';

    const [tab, setTab] = useState<Tab>('battles');
    const [battles, setBattles] = useState<Battle[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBattle, setExpandedBattle] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editingBattle, setEditingBattle] = useState<Battle | null>(null);
    const [analyticsReport, setAnalyticsReport] = useState<AnalyticsReport | null>(null);
    const [analyticsFor, setAnalyticsFor] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        title: '', description: '', rules: '',
        submissionStart: '', submissionEnd: '', votingStart: '', votingEnd: '',
        sponsorId: '', announcementChannelId: '', categoryId: '',
        prizes: [{ place: '1st Place', description: '' }] as { place: string; description: string }[],
    });

    // Sponsor form
    const [showSponsorForm, setShowSponsorForm] = useState(false);
    const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
    const [sponsorForm, setSponsorForm] = useState({ name: '', logoUrl: '', websiteUrl: '', description: '', links: [{ label: '', url: '' }] });

    // Backfill form
    const [backfillForm, setBackfillForm] = useState({
        title: '', description: '', sponsorName: '', completedAt: '',
        winners: [{ userId: '', username: '', trackTitle: '', audioUrl: '' }] as { userId: string; username: string; trackTitle: string; audioUrl: string }[],
    });

    // Settings state
    const [settings, setSettings] = useState({
        battleCategoryId: '', announcementChannelId: '', chatChannelId: '', submissionCategoryId: '', archiveCategoryId: '', discordInviteUrl: '',
    });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);
    const [announcingId, setAnnouncingId] = useState<string | null>(null);
    const [announceMsg, setAnnounceMsg] = useState<{ id: string; ok: boolean } | null>(null);

    const fetchBattles = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/battles?guildId=${guildId}`, { credentials: 'include' });
            if (res.ok) setBattles(await res.json());
        } catch {}
    }, [guildId]);

    const fetchSponsors = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/sponsors?guildId=${guildId}`, { credentials: 'include' });
            if (res.ok) setSponsors(await res.json());
        } catch {}
    }, [guildId]);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/guilds/${guildId}/beat-battle/settings`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    battleCategoryId: data.battleCategoryId || '',
                    announcementChannelId: data.announcementChannelId || '',
                    chatChannelId: data.chatChannelId || '',
                    submissionCategoryId: data.submissionCategoryId || '',
                    archiveCategoryId: data.archiveCategoryId || '',
                    discordInviteUrl: data.discordInviteUrl || '',
                });
            }
        } catch {}
    }, [guildId]);

    const saveSettings = async () => {
        setSettingsLoading(true);
        try {
            const res = await fetch(`${API}/api/guilds/${guildId}/beat-battle/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                setSettingsSaved(true);
                setTimeout(() => setSettingsSaved(false), 2000);
            }
        } catch {} finally { setSettingsLoading(false); }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchBattles(), fetchSponsors(), fetchSettings()]).finally(() => setLoading(false));
    }, [fetchBattles, fetchSponsors, fetchSettings]);

    const resetForm = () => setForm({ title: '', description: '', rules: '', submissionStart: '', submissionEnd: '', votingStart: '', votingEnd: '', sponsorId: '', announcementChannelId: '', categoryId: '', prizes: [{ place: '1st Place', description: '' }] });

    const handleCreateBattle = async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...form,
                    guildId,
                    submissionStart: localDTToISO(form.submissionStart),
                    submissionEnd: localDTToISO(form.submissionEnd),
                    votingStart: localDTToISO(form.votingStart),
                    votingEnd: localDTToISO(form.votingEnd),
                }),
            });
            if (res.ok) {
                await fetchBattles();
                setShowCreate(false);
                resetForm();
            }
        } catch {}
    };

    const handleUpdateBattle = async () => {
        if (!editingBattle) return;
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles/${editingBattle.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...form,
                    submissionStart: localDTToISO(form.submissionStart),
                    submissionEnd: localDTToISO(form.submissionEnd),
                    votingStart: localDTToISO(form.votingStart),
                    votingEnd: localDTToISO(form.votingEnd),
                }),
            });
            if (res.ok) {
                await fetchBattles();
                setEditingBattle(null);
                resetForm();
            }
        } catch {}
    };

    const handleDeleteBattle = async (id: string) => {
        if (!confirm('Delete this battle? This cannot be undone.')) return;
        try {
            await fetch(`${API}/api/beat-battle/admin/battles/${id}`, { method: 'DELETE', credentials: 'include' });
            await fetchBattles();
        } catch {}
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await fetch(`${API}/api/beat-battle/admin/battles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status }),
            });
            await fetchBattles();
        } catch {}
    };

    const handleAnnounce = async (id: string) => {
        setAnnouncingId(id);
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles/${id}/announce`, {
                method: 'POST',
                credentials: 'include',
            });
            setAnnounceMsg({ id, ok: res.ok });
            setTimeout(() => setAnnounceMsg(null), 3000);
        } catch {
            setAnnounceMsg({ id, ok: false });
            setTimeout(() => setAnnounceMsg(null), 3000);
        } finally { setAnnouncingId(null); }
    };

    const fetchAnalytics = async (battleId: string) => {
        if (analyticsFor === battleId) { setAnalyticsFor(null); setAnalyticsReport(null); return; }
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles/${battleId}/analytics`, { credentials: 'include' });
            if (res.ok) {
                setAnalyticsReport(await res.json());
                setAnalyticsFor(battleId);
            }
        } catch {}
    };

    const handleCreateSponsor = async () => {
        try {
            const payload = {
                ...sponsorForm,
                guildId,
                links: sponsorForm.links.filter(l => l.label && l.url),
            };
            const res = await fetch(`${API}/api/beat-battle/admin/sponsors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await fetchSponsors();
                setShowSponsorForm(false);
                setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', links: [{ label: '', url: '' }] });
            }
        } catch {}
    };
    const handleUpdateSponsor = async () => {
        if (!editingSponsor) return;
        try {
            const payload = {
                ...sponsorForm,
                links: sponsorForm.links.filter(l => l.label && l.url),
            };
            const res = await fetch(`${API}/api/beat-battle/admin/sponsors/${editingSponsor.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await fetchSponsors();
                setEditingSponsor(null);
                setShowSponsorForm(false);
                setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', links: [{ label: '', url: '' }] });
            }
        } catch {}
    };

    const startEditSponsor = (s: Sponsor) => {
        setEditingSponsor(s);
        setSponsorForm({
            name: s.name,
            logoUrl: s.logoUrl || '',
            websiteUrl: s.websiteUrl || '',
            description: s.description || '',
            links: s.links.length > 0 ? s.links.map(l => ({ label: l.label, url: l.url })) : [{ label: '', url: '' }],
        });
        setShowSponsorForm(true);
    };
    const handleDeleteSponsor = async (id: string) => {
        if (!confirm('Delete this sponsor?')) return;
        try {
            await fetch(`${API}/api/beat-battle/admin/sponsors/${id}`, { method: 'DELETE', credentials: 'include' });
            await fetchSponsors();
        } catch {}
    };

    const handleBackfill = async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/backfill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: backfillForm.title,
                    description: backfillForm.description,
                    sponsorName: backfillForm.sponsorName,
                    completedAt: backfillForm.completedAt,
                    winners: backfillForm.winners,
                    guildId,
                }),
            });
            if (res.ok) {
                await fetchBattles();
                setBackfillForm({ title: '', description: '', sponsorName: '', completedAt: '', winners: [{ userId: '', username: '', trackTitle: '', audioUrl: '' }] });
            }
        } catch {}
    };

    const startEdit = (b: Battle) => {
        setEditingBattle(b);
        setForm({
            title: b.title,
            description: b.description || '',
            rules: b.rules || '',
            submissionStart: toLocalDTInput(b.submissionStart),
            submissionEnd: toLocalDTInput(b.submissionEnd),
            votingStart: toLocalDTInput(b.votingStart),
            votingEnd: toLocalDTInput(b.votingEnd),
            sponsorId: b.sponsorId || '',
            announcementChannelId: b.announcementChannelId || '',
            categoryId: b.categoryId || '',
            prizes: (b.prizes && (b.prizes as any[]).length > 0)
                ? (b.prizes as { place: string; description: string }[])
                : [{ place: '1st Place', description: '' }],
        });
        setShowCreate(true);
    };

    const statusColor = (s: string) => {
        switch (s) {
            case 'upcoming': return colors.info;
            case 'active': return colors.success;
            case 'voting': return colors.warning;
            case 'completed': return colors.textSecondary;
            default: return colors.textSecondary;
        }
    };

    const cardStyle: React.CSSProperties = {
        backgroundColor: colors.surface,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        backgroundColor: '#1A1E2E',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: borderRadius.md,
        color: colors.textPrimary,
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const btnPrimary: React.CSSProperties = {
        padding: '10px 20px',
        backgroundColor: colors.primary,
        color: '#fff',
        border: 'none',
        borderRadius: borderRadius.md,
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
    };

    const btnSecondary: React.CSSProperties = {
        ...btnPrimary,
        backgroundColor: 'transparent',
        border: `1px solid ${colors.primary}`,
        color: colors.primary,
    };

    const btnDanger: React.CSSProperties = {
        ...btnPrimary,
        backgroundColor: colors.error,
    };

    const labelStyle: React.CSSProperties = { display: 'block', color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };

    if (loading) return <div style={{ padding: '40px', color: colors.textSecondary }}>Loading Beat Battle data...</div>;

    return (
        <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Swords size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Beat Battle</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Create and manage beat competitions</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Beat Battles sync between Discord and the website. Create a battle here, and the bot will handle announcements, channel creation, voting, and winner spotlighting automatically.
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {(['battles', 'sponsors', 'backfill', 'settings'] as Tab[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: borderRadius.md,
                            border: 'none',
                            backgroundColor: tab === t ? colors.primary : 'rgba(255,255,255,0.06)',
                            color: tab === t ? '#fff' : colors.textSecondary,
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '13px',
                            textTransform: 'capitalize',
                        }}
                    >
                        {t === 'battles' && <Swords size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />}
                        {t === 'sponsors' && <Building2 size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />}
                        {t === 'backfill' && <Archive size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />}
                        {t === 'settings' && <Settings size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />}
                        {t}
                    </button>
                ))}
            </div>

            {/* ─── BATTLES TAB ─── */}
            {tab === 'battles' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>All Battles</h2>
                        <button onClick={() => { resetForm(); setEditingBattle(null); setShowCreate(!showCreate); }} style={btnPrimary}>
                            <Plus size={16} /> New Battle
                        </button>
                    </div>

                    {/* Create/Edit Form */}
                    {showCreate && (
                        <div style={{ ...cardStyle, borderLeft: `4px solid ${colors.primary}` }}>
                            <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>{editingBattle ? 'Edit Battle' : 'Create New Battle'}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Title *</label>
                                    <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Beat Battle #1" />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Description</label>
                                    <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the battle theme..." />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Rules</label>
                                    <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="One entry per person..." />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Prizes</label>
                                    {form.prizes.map((prize, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                                            <input
                                                style={{ ...inputStyle, flex: '0 0 130px' }}
                                                value={prize.place}
                                                onChange={(e) => { const p = [...form.prizes]; p[i] = { ...p[i], place: e.target.value }; setForm({ ...form, prizes: p }); }}
                                                placeholder="1st Place"
                                            />
                                            <input
                                                style={{ ...inputStyle, flex: 1 }}
                                                value={prize.description}
                                                onChange={(e) => { const p = [...form.prizes]; p[i] = { ...p[i], description: e.target.value }; setForm({ ...form, prizes: p }); }}
                                                placeholder="$100 + Splice subscription"
                                            />
                                            <button onClick={() => setForm({ ...form, prizes: form.prizes.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px', flexShrink: 0 }} title="Remove">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => setForm({ ...form, prizes: [...form.prizes, { place: `${form.prizes.length + 1}${['st','nd','rd'][form.prizes.length] || 'th'} Place`, description: '' }] })} style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}>
                                        <Gift size={12} /> Add Prize
                                    </button>
                                </div>
                                <div>
                                    <label style={labelStyle}>Submissions Open</label>
                                    <input type="datetime-local" style={inputStyle} value={form.submissionStart} onChange={(e) => setForm({ ...form, submissionStart: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Submissions Close</label>
                                    <input type="datetime-local" style={inputStyle} value={form.submissionEnd} onChange={(e) => setForm({ ...form, submissionEnd: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Voting Starts</label>
                                    <input type="datetime-local" style={inputStyle} value={form.votingStart} onChange={(e) => setForm({ ...form, votingStart: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Voting Ends</label>
                                    <input type="datetime-local" style={inputStyle} value={form.votingEnd} onChange={(e) => setForm({ ...form, votingEnd: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Sponsor</label>
                                    <select style={inputStyle} value={form.sponsorId} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })}>
                                        <option value="">None</option>
                                        {sponsors.filter(s => s.isActive).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Announcement Channel ID</label>
                                    <input style={inputStyle} value={form.announcementChannelId} onChange={(e) => setForm({ ...form, announcementChannelId: e.target.value })} placeholder="Channel ID" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                <button onClick={editingBattle ? handleUpdateBattle : handleCreateBattle} style={btnPrimary}>
                                    <Save size={16} /> {editingBattle ? 'Save Changes' : 'Create Battle'}
                                </button>
                                <button onClick={() => { setShowCreate(false); setEditingBattle(null); }} style={btnSecondary}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* Battles List */}
                    {battles.length === 0 ? (
                        <div style={{ ...cardStyle, textAlign: 'center', color: colors.textSecondary, padding: '40px' }}>
                            <Swords size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p>No battles yet. Create your first one!</p>
                        </div>
                    ) : (
                        battles.map(b => (
                            <div key={b.id} style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                            <h3 style={{ margin: 0, color: colors.textPrimary }}>{b.title}</h3>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                                                padding: '2px 8px', borderRadius: '4px',
                                                backgroundColor: `${statusColor(b.status)}22`,
                                                color: statusColor(b.status),
                                            }}>
                                                {b.status}
                                            </span>
                                        </div>
                                        {b.description && <p style={{ margin: '4px 0', color: colors.textSecondary, fontSize: '13px' }}>{b.description}</p>}
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Users size={12} /> {b._count?.entries || 0} entries
                                            </span>
                                            {b.sponsor && (
                                                <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Building2 size={12} /> {b.sponsor.name}
                                                </span>
                                            )}
                                            {b.submissionEnd && (
                                                <span style={{ fontSize: '12px', color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> Closes {new Date(b.submissionEnd).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                        {b.status !== 'completed' && (
                                            <select
                                                value={b.status}
                                                onChange={(e) => handleStatusChange(b.id, e.target.value)}
                                                style={{ ...inputStyle, width: 'auto', fontSize: '12px', padding: '5px 8px' }}
                                            >
                                                <option value="upcoming">Upcoming</option>
                                                <option value="active">Active</option>
                                                <option value="voting">Voting</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        )}
                                        <button
                                            onClick={() => handleAnnounce(b.id)}
                                            disabled={announcingId === b.id}
                                            title="Post announcement for current stage"
                                            style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px', position: 'relative' }}
                                        >
                                            <Megaphone size={14} />
                                            {announceMsg?.id === b.id && (
                                                <span style={{ position: 'absolute', bottom: '110%', right: 0, whiteSpace: 'nowrap', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', backgroundColor: announceMsg.ok ? '#2B8C71' : '#EF4444', color: '#fff', pointerEvents: 'none' }}>
                                                    {announceMsg.ok ? 'Queued ✓' : 'Failed ✗'}
                                                </span>
                                            )}
                                        </button>
                                        <button onClick={() => fetchAnalytics(b.id)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Analytics">
                                            <BarChart3 size={14} />
                                        </button>
                                        <button onClick={() => startEdit(b)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Edit">
                                            <Edit size={14} />
                                        </button>
                                        <button onClick={() => setExpandedBattle(expandedBattle === b.id ? null : b.id)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Toggle entries">
                                            {expandedBattle === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        <button onClick={() => handleDeleteBattle(b.id)} style={{ ...btnDanger, padding: '6px 10px', fontSize: '12px' }} title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Analytics Report Inline */}
                                {analyticsFor === b.id && analyticsReport && (
                                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#1A1E2E', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <h4 style={{ margin: 0, color: colors.textPrimary }}>Analytics Report</h4>
                                            <button onClick={() => { setAnalyticsFor(null); setAnalyticsReport(null); }} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={16} /></button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                                            {[
                                                { label: 'Entries', value: analyticsReport.totalEntries, icon: <Upload size={16} /> },
                                                { label: 'Votes Cast', value: analyticsReport.totalVotesCast, icon: <Vote size={16} /> },
                                                { label: 'Page Views', value: analyticsReport.pageViews, icon: <BarChart3 size={16} /> },
                                                { label: 'Sponsor Clicks', value: analyticsReport.sponsorClicks, icon: <ExternalLink size={16} /> },
                                                { label: 'Unique Users', value: analyticsReport.uniqueParticipants, icon: <Users size={16} /> },
                                            ].map(s => (
                                                <div key={s.label} style={{ textAlign: 'center', padding: '12px', backgroundColor: colors.surface, borderRadius: borderRadius.md }}>
                                                    <div style={{ color: colors.primary, marginBottom: '4px' }}>{s.icon}</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 700, color: colors.textPrimary }}>{s.value}</div>
                                                    <div style={{ fontSize: '11px', color: colors.textSecondary, textTransform: 'uppercase' }}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {analyticsReport.sponsorLinkBreakdown.length > 0 && (
                                            <div style={{ marginTop: '12px' }}>
                                                <h5 style={{ color: colors.textSecondary, fontSize: '12px', margin: '0 0 8px', textTransform: 'uppercase' }}>Sponsor Link Breakdown</h5>
                                                {analyticsReport.sponsorLinkBreakdown.map((l, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                                                        <span style={{ color: colors.textPrimary }}>{l.label}</span>
                                                        <span style={{ color: colors.primary, fontWeight: 600 }}>{l.clicks} clicks</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Expanded Entries */}
                                {expandedBattle === b.id && (
                                    <BattleEntries battleId={b.id} />
                                )}
                            </div>
                        ))
                    )}
                </>
            )}

            {/* ─── SPONSORS TAB ─── */}
            {tab === 'sponsors' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>Sponsors</h2>
                        <button onClick={() => { setEditingSponsor(null); setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', links: [{ label: '', url: '' }] }); setShowSponsorForm(!showSponsorForm); }} style={btnPrimary}>
                            <Plus size={16} /> Add Sponsor
                        </button>
                    </div>

                    {showSponsorForm && (
                        <div style={{ ...cardStyle, borderLeft: `4px solid ${colors.primary}` }}>
                            <h3 style={{ margin: '0 0 16px', color: colors.textPrimary }}>{editingSponsor ? 'Edit Sponsor' : 'New Sponsor'}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Name *</label>
                                    <input style={inputStyle} value={sponsorForm.name} onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })} placeholder="Splice" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Website URL</label>
                                    <input style={inputStyle} value={sponsorForm.websiteUrl} onChange={(e) => setSponsorForm({ ...sponsorForm, websiteUrl: e.target.value })} placeholder="https://..." />
                                </div>
                                <div>
                                    <label style={labelStyle}>Logo URL</label>
                                    <input style={inputStyle} value={sponsorForm.logoUrl} onChange={(e) => setSponsorForm({ ...sponsorForm, logoUrl: e.target.value })} placeholder="https://..." />
                                </div>
                                <div>
                                    <label style={labelStyle}>Description</label>
                                    <input style={inputStyle} value={sponsorForm.description} onChange={(e) => setSponsorForm({ ...sponsorForm, description: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Promo Links</label>
                                    {sponsorForm.links.map((link, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                            <input style={{ ...inputStyle, flex: 1 }} value={link.label} onChange={(e) => {
                                                const newLinks = [...sponsorForm.links];
                                                newLinks[i].label = e.target.value;
                                                setSponsorForm({ ...sponsorForm, links: newLinks });
                                            }} placeholder="Label (e.g. Get 20% Off)" />
                                            <input style={{ ...inputStyle, flex: 2 }} value={link.url} onChange={(e) => {
                                                const newLinks = [...sponsorForm.links];
                                                newLinks[i].url = e.target.value;
                                                setSponsorForm({ ...sponsorForm, links: newLinks });
                                            }} placeholder="https://..." />
                                        </div>
                                    ))}
                                    <button onClick={() => setSponsorForm({ ...sponsorForm, links: [...sponsorForm.links, { label: '', url: '' }] })} style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}>
                                        <Plus size={12} /> Add Link
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                <button onClick={editingSponsor ? handleUpdateSponsor : handleCreateSponsor} style={btnPrimary}><Save size={16} /> {editingSponsor ? 'Save Changes' : 'Create Sponsor'}</button>
                                <button onClick={() => { setShowSponsorForm(false); setEditingSponsor(null); setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', links: [{ label: '', url: '' }] }); }} style={btnSecondary}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {sponsors.length === 0 ? (
                        <div style={{ ...cardStyle, textAlign: 'center', color: colors.textSecondary, padding: '40px' }}>
                            <Building2 size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p>No sponsors yet.</p>
                        </div>
                    ) : (
                        sponsors.map(s => (
                            <div key={s.id} style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {s.logoUrl && <img src={s.logoUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />}
                                        <div>
                                            <h3 style={{ margin: 0, color: colors.textPrimary }}>{s.name}</h3>
                                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>{s._count?.battles || 0} battles · {s.links.reduce((sum: number, l: SponsorLink) => sum + l.clicks, 0)} total clicks</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => startEditSponsor(s)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Edit"><Edit size={14} /></button>
                                        <button onClick={() => handleDeleteSponsor(s.id)} style={{ ...btnDanger, padding: '6px 10px', fontSize: '12px' }} title="Delete"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                {s.links.length > 0 && (
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {s.links.map(l => (
                                            <span key={l.id} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textSecondary, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Link2 size={10} /> {l.label} ({l.clicks} clicks)
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </>
            )}

            {/* ─── BACKFILL TAB ─── */}
            {tab === 'backfill' && (
                <>
                    <h2 style={{ margin: '0 0 16px', color: colors.textPrimary, fontSize: '18px' }}>Backfill Past Battles</h2>
                    <div style={{ ...cardStyle, borderLeft: `4px solid ${colors.warning}` }}>
                        <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '13px' }}>Add past beat battles that happened before this system was in place. They will appear in the archive.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Battle Title *</label>
                                <input style={inputStyle} value={backfillForm.title} onChange={(e) => setBackfillForm({ ...backfillForm, title: e.target.value })} placeholder="Beat Battle #0" />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Description</label>
                                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={backfillForm.description} onChange={(e) => setBackfillForm({ ...backfillForm, description: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Sponsor Name (optional)</label>
                                <input style={inputStyle} value={backfillForm.sponsorName} onChange={(e) => setBackfillForm({ ...backfillForm, sponsorName: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Completed Date</label>
                                <input type="date" style={inputStyle} value={backfillForm.completedAt} onChange={(e) => setBackfillForm({ ...backfillForm, completedAt: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Winners <span style={{ color: colors.textSecondary, fontWeight: 400, fontSize: '11px' }}>(listed in placement order — 1st, 2nd, 3rd…)</span></span>
                                <button
                                    onClick={() => setBackfillForm({ ...backfillForm, winners: [...backfillForm.winners, { userId: '', username: '', trackTitle: '', audioUrl: '' }] })}
                                    style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}
                                >
                                    <Plus size={12} /> Add Winner
                                </button>
                            </label>
                            {backfillForm.winners.map((w, i) => (
                                <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: borderRadius.md, padding: '12px', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : colors.textSecondary }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {i === 0 ? '1st Place' : i === 1 ? '2nd Place' : i === 2 ? '3rd Place' : `${i + 1}th Place`}
                                        </span>
                                        {backfillForm.winners.length > 1 && (
                                            <button onClick={() => setBackfillForm({ ...backfillForm, winners: backfillForm.winners.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '2px' }}>
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Discord User ID</label>
                                            <input style={inputStyle} value={w.userId} onChange={(e) => { const ws = [...backfillForm.winners]; ws[i] = { ...ws[i], userId: e.target.value }; setBackfillForm({ ...backfillForm, winners: ws }); }} placeholder="123456789012345678" />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Username</label>
                                            <input style={inputStyle} value={w.username} onChange={(e) => { const ws = [...backfillForm.winners]; ws[i] = { ...ws[i], username: e.target.value }; setBackfillForm({ ...backfillForm, winners: ws }); }} placeholder="Producer123" />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Track Title</label>
                                            <input style={inputStyle} value={w.trackTitle} onChange={(e) => { const ws = [...backfillForm.winners]; ws[i] = { ...ws[i], trackTitle: e.target.value }; setBackfillForm({ ...backfillForm, winners: ws }); }} placeholder="Fire Beat" />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Audio URL (optional)</label>
                                            <input style={inputStyle} value={w.audioUrl} onChange={(e) => { const ws = [...backfillForm.winners]; ws[i] = { ...ws[i], audioUrl: e.target.value }; setBackfillForm({ ...backfillForm, winners: ws }); }} placeholder="/uploads/battles/..." />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button onClick={handleBackfill} style={{ ...btnPrimary, marginTop: '8px' }}>
                            <Archive size={16} /> Add to Archive
                        </button>
                    </div>
                </>
            )}

            {/* ─── SETTINGS TAB ─── */}
            {tab === 'settings' && (
                <>
                    <h2 style={{ margin: '0 0 16px', color: colors.textPrimary, fontSize: '18px' }}>Beat Battle Settings</h2>
                    <div style={{ ...cardStyle, borderLeft: `4px solid ${colors.primary}` }}>
                        <p style={{ margin: '0 0 20px', color: colors.textSecondary, fontSize: '13px' }}>
                            Configure default channels and categories for Beat Battles. These will be used when creating new battles unless overridden per-battle.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Battle Channels Category</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Category where battle channels are created</p>
                                <ChannelSelect guildId={guildId} value={settings.battleCategoryId} onChange={(v) => setSettings({ ...settings, battleCategoryId: v as string })} channelTypes={[4]} placeholder="Select Category" />
                            </div>
                            <div>
                                <label style={labelStyle}>Announcements Channel</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Where battle announcements are posted</p>
                                <ChannelSelect guildId={guildId} value={settings.announcementChannelId} onChange={(v) => setSettings({ ...settings, announcementChannelId: v as string })} channelTypes={[0, 5]} placeholder="Select Channel" />
                            </div>
                            <div>
                                <label style={labelStyle}>Chat Channel</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>General chat channel for battle discussions</p>
                                <ChannelSelect guildId={guildId} value={settings.chatChannelId} onChange={(v) => setSettings({ ...settings, chatChannelId: v as string })} channelTypes={[0]} placeholder="Select Channel" />
                            </div>
                            <div>
                                <label style={labelStyle}>Submissions Category</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Category where submission channels are created</p>
                                <ChannelSelect guildId={guildId} value={settings.submissionCategoryId} onChange={(v) => setSettings({ ...settings, submissionCategoryId: v as string })} channelTypes={[4]} placeholder="Select Category" />
                            </div>
                            <div>
                                <label style={labelStyle}>Archived Submissions Category</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Category where completed battle channels are moved</p>
                                <ChannelSelect guildId={guildId} value={settings.archiveCategoryId} onChange={(v) => setSettings({ ...settings, archiveCategoryId: v as string })} channelTypes={[4]} placeholder="Select Category" />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Discord Server Invite URL</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Shown on the public Beat Battles page so participants know where to submit their tracks</p>
                                <input
                                    style={inputStyle}
                                    value={settings.discordInviteUrl}
                                    onChange={(e) => setSettings({ ...settings, discordInviteUrl: e.target.value })}
                                    placeholder="https://discord.gg/your-invite"
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button onClick={saveSettings} disabled={settingsLoading} style={btnPrimary}>
                                <Save size={16} /> {settingsLoading ? 'Saving...' : 'Save Settings'}
                            </button>
                            {settingsSaved && <span style={{ color: colors.success, fontSize: '13px', fontWeight: 600 }}>Saved!</span>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Battle Entries Sub-component ───
const BattleEntries: React.FC<{ battleId: string }> = ({ battleId }) => {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/api/beat-battle/battles/${battleId}`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setEntries(data.entries || []);
                }
            } catch {} finally { setLoading(false); }
        })();
    }, [battleId]);

    if (loading) return <p style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '12px' }}>Loading entries...</p>;
    if (entries.length === 0) return <p style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '12px' }}>No submissions yet.</p>;

    return (
        <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 8px', color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase' }}>Entries ({entries.length})</h4>
            {entries.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: i % 2 === 0 ? '#1A1E2E' : 'transparent', borderRadius: borderRadius.sm }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : colors.textSecondary, fontWeight: 700, fontSize: '14px', minWidth: '24px' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                        </span>
                        <div>
                            <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>{e.trackTitle}</p>
                            <p style={{ margin: '2px 0 0', color: colors.textSecondary, fontSize: '11px' }}>by {e.username} · via {e.source}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {e.audioUrl && (
                            <a href={`${API}${e.audioUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                <Play size={12} /> Play
                            </a>
                        )}
                        <span style={{ color: colors.primary, fontWeight: 700, fontSize: '14px' }}>🔥 {e.voteCount}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
