import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../components/AuthProvider';
import { RichTextEditor } from '../components/RichTextEditor';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { ConfirmModal } from '../components/ConfirmModal';
import { useMobile } from '../hooks/useMobile';
import {
    Swords, Plus, Trophy, Users, BarChart2, BarChart3, Calendar,
    ChevronDown, ChevronUp, Trash2, Edit, Play, Vote,
    ExternalLink, Award, Archive, Upload, Clock, X, Save,
    Building2, Link2, FileDown, Settings, Gift, Megaphone,
    Image, Loader2, Music, Pause, Download, Search, Crown
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
    rulesData: { text: string; links: { label: string; url: string }[]; samples: { name: string; url: string }[] }[] | null;
    prizes: { place: string; title: string; description: string; imageUrl?: string; link?: string }[] | null;
    submissionStart: string | null;
    submissionEnd: string | null;
    votingStart: string | null;
    votingEnd: string | null;
    announcementChannelId: string | null;
    sponsorId: string | null;
    winnerEntryId: string | null;
    bannerUrl: string | null;
    cardImageUrl: string | null;
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
    showOnPage: boolean;
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

interface VoterInfo { userId: string; username: string; avatar: string | null; source: string; createdAt: string; }
interface VoteEntry {
    entryId: string;
    submitterUserId: string;
    submitterUsername: string;
    trackTitle: string;
    voteCount: number;
    pointTotal: number;
    firstPlaceVotes: VoterInfo[];
    secondPlaceVotes: VoterInfo[];
    thirdPlaceVotes: VoterInfo[];
}
interface VoteReport {
    battleId: string;
    battleTitle: string;
    totalVotes: number;
    uniqueVoters: number;
    entries: VoteEntry[];
}

interface BackfillEntry {
    trackId: string | null;
    trackTitle: string;
    artistName: string;
    coverUrl: string | null;
    userId: string;
    place: number; // 1=1st, 2=2nd, etc., 0=no placement
}

type Tab = 'battles' | 'sponsors' | 'backfill' | 'settings';

export const BeatBattlePage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const isMobile = useMobile();
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
    const [voteReport, setVoteReport] = useState<VoteReport | null>(null);
    const [votesFor, setVotesFor] = useState<string | null>(null);

    // Sponsor analytics modal
    const [sponsorAnalytics, setSponsorAnalytics] = useState<any | null>(null);
    const [sponsorAnalyticsFor, setSponsorAnalyticsFor] = useState<string | null>(null);
    const [loadingSponsorAnalytics, setLoadingSponsorAnalytics] = useState(false);

    // Form state
    const [form, setForm] = useState({
        title: '', subtitle: '', description: '',
        miniDescription: '',
        rulesData: [{ text: '', links: [] as { label: string; url: string }[], samples: [] as { name: string; url: string }[] }],
        submissionStart: '', submissionEnd: '', votingStart: '', votingEnd: '',
        sponsorId: '', announcementChannelId: '',
        prizes: [{ place: '1st Place', title: '', description: '', imageUrl: '', link: '' }] as { place: string; title: string; description: string; imageUrl: string; link: string }[],
        maxVotesPerUser: 0,
        requireProjectFile: false,
        pingOnSubmissions: false, pingOnVoting: false, pingOnWinners: false,
        entryFeeEnabled: false, entryFee: 0,
        prizePoolEnabled: false, prizeFirst: 0, prizeSecond: 0, prizeThird: 0,
        voterReward: 0,
        suddenDeathDurationMinutes: 60,
    });
    const [uploadingPrizeIdx, setUploadingPrizeIdx] = useState<number | null>(null);
    const [uploadingRuleIdx, setUploadingRuleIdx] = useState<number | null>(null);

    // Sponsor form
    const [showSponsorForm, setShowSponsorForm] = useState(false);
    const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
    const [sponsorForm, setSponsorForm] = useState({ name: '', logoUrl: '', websiteUrl: '', description: '', showOnPage: true, links: [{ label: '', url: '' }] });
    const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
    const [sponsorLogoPreview, setSponsorLogoPreview] = useState<string>('');
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string>('');
    const [cardImageFile, setCardImageFile] = useState<File | null>(null);
    const [cardImagePreview, setCardImagePreview] = useState<string>('');

    // Backfill form
    const [backfillForm, setBackfillForm] = useState({
        title: '', subtitle: '', description: '', sponsorId: '', completedAt: '',
        prizes: [{ place: '1st Place', title: '', description: '', imageUrl: '', link: '' }] as { place: string; title: string; description: string; imageUrl: string; link: string }[],
        entries: [] as BackfillEntry[],
    });
    const [backfillBannerFile, setBackfillBannerFile] = useState<File | null>(null);
    const [backfillBannerPreview, setBackfillBannerPreview] = useState('');
    const [backfillCardImageFile, setBackfillCardImageFile] = useState<File | null>(null);
    const [backfillCardImagePreview, setBackfillCardImagePreview] = useState('');
    const [uploadingBackfillPrizeIdx, setUploadingBackfillPrizeIdx] = useState<number | null>(null);
    const [backfillTrackSearch, setBackfillTrackSearch] = useState('');
    const [backfillTrackResults, setBackfillTrackResults] = useState<{ id: string; title: string; coverUrl: string | null; userId: string; artistName: string }[]>([]);
    const [backfillSearchLoading, setBackfillSearchLoading] = useState(false);

    // Settings state
    const [settings, setSettings] = useState({
        announcementChannelId: '', chatChannelId: '', discordInviteUrl: '', featuredBattleId: '', sponsorSectionTitle: '', requireMusicianProfile: false,
        suddenDeathDurationMinutes: 60,
    });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'battle' | 'sponsor'; id: string } | null>(null);
    const [settingsSaved, setSettingsSaved] = useState(false);
    const [announcingId, setAnnouncingId] = useState<string | null>(null);
    const [announceMsg, setAnnounceMsg] = useState<{ id: string; ok: boolean; message?: string } | null>(null);

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
                    announcementChannelId: data.announcementChannelId || '',
                    chatChannelId: data.chatChannelId || '',
                    discordInviteUrl: data.discordInviteUrl || '',
                    featuredBattleId: data.featuredBattleId || '',
                    sponsorSectionTitle: data.sponsorSectionTitle || '',
                    requireMusicianProfile: data.requireMusicianProfile ?? false,
                    suddenDeathDurationMinutes: typeof data.suddenDeathDurationMinutes === 'number' ? data.suddenDeathDurationMinutes : 60,
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

    useEffect(() => {
        if (backfillTrackSearch.length < 2) { setBackfillTrackResults([]); return; }
        const timer = setTimeout(async () => {
            setBackfillSearchLoading(true);
            try {
                const res = await fetch(`${API}/api/beat-battle/admin/track-search?q=${encodeURIComponent(backfillTrackSearch)}`, { credentials: 'include' });
                if (res.ok) setBackfillTrackResults(await res.json());
            } catch {} finally { setBackfillSearchLoading(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [backfillTrackSearch]);

    const resetForm = () => setForm({ title: '', subtitle: '', miniDescription: '', description: '', rulesData: [{ text: '', links: [], samples: [] }], submissionStart: '', submissionEnd: '', votingStart: '', votingEnd: '', sponsorId: '', announcementChannelId: '', prizes: [{ place: '1st Place', title: '', description: '', imageUrl: '', link: '' }], maxVotesPerUser: 0, requireProjectFile: false, pingOnSubmissions: false, pingOnVoting: false, pingOnWinners: false, entryFeeEnabled: false, entryFee: 0, prizePoolEnabled: false, prizeFirst: 0, prizeSecond: 0, prizeThird: 0, voterReward: 0, suddenDeathDurationMinutes: 60 });

    const handleCreateBattle = async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: form.title,
                    subtitle: form.subtitle,
                    miniDescription: form.miniDescription,
                    description: form.description,
                    rules: form.rulesData.map(r => r.text).filter(Boolean).join('\n'),
                    rulesData: form.rulesData,
                    prizes: form.prizes,
                    guildId,
                    submissionStart: localDTToISO(form.submissionStart),
                    submissionEnd: localDTToISO(form.submissionEnd),
                    votingStart: localDTToISO(form.votingStart),
                    votingEnd: localDTToISO(form.votingEnd),
                    sponsorId: form.sponsorId,
                    announcementChannelId: form.announcementChannelId,
                    maxVotesPerUser: form.maxVotesPerUser,
                    requireProjectFile: form.requireProjectFile,
                    pingOnSubmissions: form.pingOnSubmissions,
                    pingOnVoting: form.pingOnVoting,
                    pingOnWinners: form.pingOnWinners,
                    entryFeeEnabled: form.entryFeeEnabled,
                    entryFee: form.entryFee,
                    prizePoolEnabled: form.prizePoolEnabled,
                    prizeFirst: form.prizeFirst,
                    prizeSecond: form.prizeSecond,
                    prizeThird: form.prizeThird,
                    voterReward: form.voterReward,
                }),
            });
            if (res.ok) {
                const created = await res.json();
                if (bannerFile) {
                    const fd = new FormData();
                    fd.append('battleBanner', bannerFile);
                    await fetch(`${API}/api/beat-battle/admin/battles/${created.id}/banner`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
                }
                if (cardImageFile) {
                    const fd = new FormData();
                    fd.append('battleCardImage', cardImageFile);
                    await fetch(`${API}/api/beat-battle/admin/battles/${created.id}/card-image`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
                }
                setBattles(prev => [created, ...prev]);
                setShowCreate(false);
                setBannerFile(null);
                setBannerPreview('');
                setCardImageFile(null);
                setCardImagePreview('');
                resetForm();
            } else {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                alert(`Failed to create battle: ${err.error || res.status}`);
            }
        } catch (e: any) {
            alert(`Failed to create battle: ${e.message}`);
        }
    };

    const handleUpdateBattle = async () => {
        if (!editingBattle) return;
        try {
            if (bannerFile) {
                const fd = new FormData();
                fd.append('battleBanner', bannerFile);
                await fetch(`${API}/api/beat-battle/admin/battles/${editingBattle.id}/banner`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
            }
            if (cardImageFile) {
                const fd = new FormData();
                fd.append('battleCardImage', cardImageFile);
                await fetch(`${API}/api/beat-battle/admin/battles/${editingBattle.id}/card-image`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
            }
            const res = await fetch(`${API}/api/beat-battle/admin/battles/${editingBattle.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: form.title,
                    subtitle: form.subtitle,
                    miniDescription: form.miniDescription,
                    description: form.description,
                    rules: form.rulesData.map(r => r.text).filter(Boolean).join('\n'),
                    rulesData: form.rulesData,
                    prizes: form.prizes,
                    submissionStart: localDTToISO(form.submissionStart),
                    submissionEnd: localDTToISO(form.submissionEnd),
                    votingStart: localDTToISO(form.votingStart),
                    votingEnd: localDTToISO(form.votingEnd),
                    sponsorId: form.sponsorId,
                    announcementChannelId: form.announcementChannelId,
                    maxVotesPerUser: form.maxVotesPerUser,
                    requireProjectFile: form.requireProjectFile,
                    pingOnSubmissions: form.pingOnSubmissions,
                    pingOnVoting: form.pingOnVoting,
                    pingOnWinners: form.pingOnWinners,
                    entryFeeEnabled: form.entryFeeEnabled,
                    entryFee: form.entryFee,
                    prizePoolEnabled: form.prizePoolEnabled,
                    prizeFirst: form.prizeFirst,
                    prizeSecond: form.prizeSecond,
                    prizeThird: form.prizeThird,
                    voterReward: form.voterReward,
                    suddenDeathDurationMinutes: form.suddenDeathDurationMinutes,
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setBattles(prev => prev.map(b => b.id === updated.id ? updated : b));
                setEditingBattle(null);
                setBannerFile(null);
                setBannerPreview('');
                setCardImageFile(null);
                setCardImagePreview('');
                resetForm();
                // Re-fetch from server to ensure UI reflects latest DB state
                fetchBattles();
            } else {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                alert(`Failed to save battle: ${err.error || res.status}`);
            }
        } catch (e: any) {
            alert(`Failed to save battle: ${e.message}`);
        }
    };

    const handleDeleteBattle = async (id: string) => {
        setDeleteConfirm({ type: 'battle', id });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        const { type, id } = deleteConfirm;
        setDeleteConfirm(null);
        try {
            if (type === 'battle') {
                await fetch(`${API}/api/beat-battle/admin/battles/${id}`, { method: 'DELETE', credentials: 'include' });
                await fetchBattles();
            } else {
                await fetch(`${API}/api/beat-battle/admin/sponsors/${id}`, { method: 'DELETE', credentials: 'include' });
                await fetchSponsors();
            }
        } catch {}
    };

    const uploadPrizeImage = async (idx: number, file: File) => {
        setUploadingPrizeIdx(idx);
        try {
            const fd = new FormData();
            fd.append('prizeImage', file);
            const res = await fetch(`${API}/api/beat-battle/admin/prize-image`, { method: 'POST', credentials: 'include', body: fd });
            if (res.ok) {
                const { url } = await res.json();
                setForm(f => { const p = [...f.prizes]; p[idx] = { ...p[idx], imageUrl: url }; return { ...f, prizes: p }; });
            }
        } catch {} finally { setUploadingPrizeIdx(null); }
    };

    const uploadRuleSample = async (ruleIdx: number, file: File) => {
        setUploadingRuleIdx(ruleIdx);
        try {
            const fd = new FormData();
            fd.append('ruleSample', file);
            const res = await fetch(`${API}/api/beat-battle/admin/rule-sample`, { method: 'POST', credentials: 'include', body: fd });
            if (res.ok) {
                const { url, name } = await res.json();
                setForm(f => {
                    const rd = [...f.rulesData];
                    rd[ruleIdx] = { ...rd[ruleIdx], samples: [...rd[ruleIdx].samples, { name, url }] };
                    return { ...f, rulesData: rd };
                });
            }
        } catch {} finally { setUploadingRuleIdx(null); }
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
            const data = await res.json();
            setAnnounceMsg({ id, ok: res.ok, message: res.ok ? undefined : (data.error || 'Failed') });
            setTimeout(() => setAnnounceMsg(null), res.ok ? 3000 : 7000);
        } catch {
            setAnnounceMsg({ id, ok: false, message: 'Network error' });
            setTimeout(() => setAnnounceMsg(null), 7000);
        } finally { setAnnouncingId(null); }
    };

    const handleRecompute = async (id: string) => {
        const repost = confirm(
            'Recompute the podium for this battle using points-based ranking?\n\n' +
            'This re-ranks all entries by total points (3 pts for each rank-1 vote, 2 for rank-2, 1 for rank-3) and updates the winner.\n\n' +
            'Click OK to also re-post the winner announcement to Discord, or Cancel to skip the announcement.'
        );
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles/${id}/recompute-winners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ repostAnnouncement: repost }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Failed to recompute');
                return;
            }
            const podium = (data.podium || []).map((p: any, i: number) =>
                `${i + 1}. ${p.trackTitle} — ${p.points} pts (1st:${p.firstVotes}, 2nd:${p.secondVotes}, 3rd:${p.thirdVotes})`
            ).join('\n');
            alert(`Podium recomputed:\n\n${podium || '(no entries)'}` + (data.announcementPosted ? '\n\nAnnouncement posted to Discord ✓' : (data.announceError ? `\n\nAnnouncement error: ${data.announceError}` : '')));
            await fetchBattles();
        } catch {
            alert('Network error');
        }
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

    const fetchVotes = async (battleId: string) => {
        if (votesFor === battleId) { setVotesFor(null); setVoteReport(null); return; }
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/battles/${battleId}/votes`, { credentials: 'include' });
            if (res.ok) {
                setVoteReport(await res.json());
                setVotesFor(battleId);
            }
        } catch {}
    };

    const handleCreateSponsor = async () => {
        const payload = { ...sponsorForm, guildId, links: sponsorForm.links.filter(l => l.label && l.url) };
        let createdId: string | null = null;
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/sponsors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (!res.ok) return;
            const created = await res.json().catch(() => null);
            createdId = created?.id ?? null;
        } catch { return; }

        // Logo upload — best-effort, doesn't block list refresh
        if (createdId && sponsorLogoFile) {
            const fd = new FormData();
            fd.append('sponsorLogo', sponsorLogoFile);
            await fetch(`${API}/api/beat-battle/admin/sponsors/${createdId}/logo`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
        }

        // Always refresh + close form if POST succeeded
        await fetchSponsors();
        setShowSponsorForm(false);
        setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', showOnPage: true, links: [{ label: '', url: '' }] });
        setSponsorLogoFile(null);
        setSponsorLogoPreview('');
    };
    const handleUpdateSponsor = async () => {
        if (!editingSponsor) return;
        try {
            let uploadedLogoUrl: string | undefined;
            if (sponsorLogoFile) {
                const fd = new FormData();
                fd.append('sponsorLogo', sponsorLogoFile);
                const logoRes = await fetch(`${API}/api/beat-battle/admin/sponsors/${editingSponsor.id}/logo`, { method: 'POST', credentials: 'include', body: fd }).catch(() => null);
                if (logoRes?.ok) {
                    const logoData = await logoRes.json();
                    uploadedLogoUrl = logoData.url;
                }
            }
            const payload = {
                ...sponsorForm,
                ...(uploadedLogoUrl !== undefined ? { logoUrl: uploadedLogoUrl } : {}),
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
                setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', showOnPage: true, links: [{ label: '', url: '' }] });
                setSponsorLogoFile(null); setSponsorLogoPreview('');
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
            showOnPage: s.showOnPage,
            links: s.links.length > 0 ? s.links.map(l => ({ label: l.label, url: l.url })) : [{ label: '', url: '' }],
        });
        setSponsorLogoFile(null);
        setSponsorLogoPreview(s.logoUrl || '');
        setShowSponsorForm(true);
    };
    const handleDeleteSponsor = async (id: string) => {
        setDeleteConfirm({ type: 'sponsor', id });
    };

    const openSponsorAnalytics = async (sponsorId: string) => {
        setSponsorAnalyticsFor(sponsorId);
        setLoadingSponsorAnalytics(true);
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/sponsors/${sponsorId}/analytics`, { credentials: 'include' });
            if (res.ok) setSponsorAnalytics(await res.json());
        } catch {}
        setLoadingSponsorAnalytics(false);
    };

    const uploadBackfillPrizeImage = async (idx: number, file: File) => {
        setUploadingBackfillPrizeIdx(idx);
        try {
            const fd = new FormData();
            fd.append('prizeImage', file);
            const res = await fetch(`${API}/api/beat-battle/admin/prize-image`, { method: 'POST', credentials: 'include', body: fd });
            if (res.ok) {
                const { url } = await res.json();
                setBackfillForm(f => { const p = [...f.prizes]; p[idx] = { ...p[idx], imageUrl: url }; return { ...f, prizes: p }; });
            }
        } catch {} finally { setUploadingBackfillPrizeIdx(null); }
    };

    const handleBackfill = async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/admin/backfill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: backfillForm.title,
                    subtitle: backfillForm.subtitle,
                    description: backfillForm.description,
                    sponsorId: backfillForm.sponsorId || null,
                    completedAt: backfillForm.completedAt,
                    prizes: backfillForm.prizes,
                    entries: backfillForm.entries,
                    guildId,
                }),
            });
            if (res.ok) {
                const created = await res.json();
                if (backfillBannerFile) {
                    const fd = new FormData(); fd.append('battleBanner', backfillBannerFile);
                    await fetch(`${API}/api/beat-battle/admin/battles/${created.id}/banner`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
                }
                if (backfillCardImageFile) {
                    const fd = new FormData(); fd.append('battleCardImage', backfillCardImageFile);
                    await fetch(`${API}/api/beat-battle/admin/battles/${created.id}/card-image`, { method: 'POST', credentials: 'include', body: fd }).catch(() => {});
                }
                await fetchBattles();
                setBackfillForm({ title: '', subtitle: '', description: '', sponsorId: '', completedAt: '', prizes: [{ place: '1st Place', title: '', description: '', imageUrl: '', link: '' }], entries: [] });
                setBackfillBannerFile(null); setBackfillBannerPreview('');
                setBackfillCardImageFile(null); setBackfillCardImagePreview('');
                setBackfillTrackSearch(''); setBackfillTrackResults([]);
            }
        } catch {}
    };

    const startEdit = (b: Battle) => {
        setEditingBattle(b);
        setForm({
            title: b.title,
            subtitle: (b as any).subtitle || '',
            miniDescription: (b as any).miniDescription || '',
            description: b.description || '',
            rulesData: (b.rulesData && (b.rulesData as any[]).length > 0)
                ? (b.rulesData as any[]).map(r => ({ text: r.text || '', links: r.links || [], samples: r.samples || [] }))
                : (b.rules || '').split('\n').filter(Boolean).map(text => ({ text, links: [], samples: [] })),
            submissionStart: toLocalDTInput(b.submissionStart),
            submissionEnd: toLocalDTInput(b.submissionEnd),
            votingStart: toLocalDTInput(b.votingStart),
            votingEnd: toLocalDTInput(b.votingEnd),
            sponsorId: b.sponsorId || '',
            announcementChannelId: b.announcementChannelId || '',
            prizes: (b.prizes && (b.prizes as any[]).length > 0)
                ? (b.prizes as any[]).map(p => ({ place: p.place || '', title: p.title || '', description: p.description || '', imageUrl: p.imageUrl || '', link: p.link || '' }))
                : [{ place: '1st Place', title: '', description: '', imageUrl: '', link: '' }],
            maxVotesPerUser: (b as any).maxVotesPerUser || 0,
            requireProjectFile: (b as any).requireProjectFile || false,
            pingOnSubmissions: (b as any).pingOnSubmissions || false,
            pingOnVoting: (b as any).pingOnVoting || false,
            pingOnWinners: (b as any).pingOnWinners || false,
            entryFeeEnabled: (b as any).entryFeeEnabled || false,
            entryFee: (b as any).entryFee || 0,
            prizePoolEnabled: (b as any).prizePoolEnabled || false,
            prizeFirst: (b as any).prizeFirst || 0,
            prizeSecond: (b as any).prizeSecond || 0,
            prizeThird: (b as any).prizeThird || 0,
            voterReward: (b as any).voterReward || 0,
            suddenDeathDurationMinutes: (b as any).suddenDeathDurationMinutes || 60,
        });
        setBannerFile(null);
        setBannerPreview(b.bannerUrl ? `${API}${b.bannerUrl}` : '');
        setCardImageFile(null);
        setCardImagePreview(b.cardImageUrl ? `${API}${b.cardImageUrl}` : '');
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
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.md,
        color: colors.textPrimary,
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
        colorScheme: 'dark',
    };

    const btnPrimary: React.CSSProperties = {
        padding: '10px 20px',
        backgroundColor: colors.primary,
        color: colors.textPrimary,
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
        <>
        <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Swords size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, color: colors.textPrimary }}>Beat Battle</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Create and manage beat competitions</p>
                </div>
            </div>

            {/* Explanation */}
            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>
                    Beat Battles are hosted on the website. Create a battle here, and the bot will post announcements to Discord. All submissions and voting happen on the site.
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
                                    <label style={labelStyle}>Subtitle <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(shown under the title on both pages — max 200 chars)</span></label>
                                    <input
                                        style={inputStyle}
                                        value={form.subtitle}
                                        onChange={e => setForm({ ...form, subtitle: e.target.value.slice(0, 200) })}
                                        placeholder="e.g. Season 3 Finals · Trap Edition"
                                    />
                                    <div style={{ fontSize: '10px', color: colors.textTertiary, textAlign: 'right', marginTop: '2px' }}>{form.subtitle.length}/200</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Mini Description <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(for embeds, cards, and previews — max 300 chars)</span></label>
                                    <textarea
                                        style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                                        value={form.miniDescription}
                                        onChange={e => setForm({ ...form, miniDescription: e.target.value.slice(0, 300) })}
                                        placeholder="A short one or two sentence summary of this battle..."
                                    />
                                    <div style={{ fontSize: '10px', color: colors.textTertiary, textAlign: 'right', marginTop: '2px' }}>{(form.miniDescription || '').length}/300</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Full Description <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(shown on the individual battle page — supports rich text, images, and video embeds)</span></label>
                                    <RichTextEditor
                                        value={form.description}
                                        onChange={desc => setForm({ ...form, description: desc })}
                                        placeholder="Describe the battle in detail — supports headings, lists, links, images, YouTube embeds..."
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Rules</label>
                                    {form.rulesData.map((rule, ri) => (
                                        <div key={ri} style={{ marginBottom: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                <textarea
                                                    style={{ ...inputStyle, flex: 1, minHeight: '48px', resize: 'vertical' }}
                                                    value={rule.text}
                                                    onChange={(e) => { const rd = [...form.rulesData]; rd[ri] = { ...rd[ri], text: e.target.value }; setForm({ ...form, rulesData: rd }); }}
                                                    placeholder="Describe the rule..."
                                                />
                                                <button onClick={() => setForm({ ...form, rulesData: form.rulesData.filter((_, idx) => idx !== ri) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px', flexShrink: 0 }}><X size={14} /></button>
                                            </div>
                                            {/* Links */}
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px', fontWeight: 600 }}>Links</div>
                                                {rule.links.map((lnk, li) => (
                                                    <div key={li} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                                                        <input style={{ ...inputStyle, flex: '0 0 150px', padding: '6px 8px', fontSize: '12px' }} value={lnk.label} onChange={(e) => { const rd = [...form.rulesData]; rd[ri].links[li] = { ...rd[ri].links[li], label: e.target.value }; setForm({ ...form, rulesData: rd }); }} placeholder="Label (e.g. Plugin name)" />
                                                        <input style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: '12px' }} value={lnk.url} onChange={(e) => { const rd = [...form.rulesData]; rd[ri].links[li] = { ...rd[ri].links[li], url: e.target.value }; setForm({ ...form, rulesData: rd }); }} placeholder="https://..." />
                                                        <button onClick={() => { const rd = [...form.rulesData]; rd[ri] = { ...rd[ri], links: rd[ri].links.filter((_, idx) => idx !== li) }; setForm({ ...form, rulesData: rd }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '2px' }}><X size={12} /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => { const rd = [...form.rulesData]; rd[ri] = { ...rd[ri], links: [...rd[ri].links, { label: '', url: '' }] }; setForm({ ...form, rulesData: rd }); }} style={{ ...btnSecondary, fontSize: '11px', padding: '3px 8px' }}><Link2 size={11} /> Add Link</button>
                                            </div>
                                            {/* Samples */}
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px', fontWeight: 600 }}>Audio Samples (Optional)</div>
                                                {rule.samples.map((s, si) => (
                                                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <Music size={12} color={colors.textSecondary} />
                                                        <span style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textPrimary }}>{s.name}</span>
                                                        <button onClick={() => { const rd = [...form.rulesData]; rd[ri] = { ...rd[ri], samples: rd[ri].samples.filter((_, idx) => idx !== si) }; setForm({ ...form, rulesData: rd }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '2px' }}><X size={12} /></button>
                                                    </div>
                                                ))}
                                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.sm, cursor: uploadingRuleIdx === ri ? 'not-allowed' : 'pointer', fontSize: '11px', color: colors.textPrimary }}>
                                                    {uploadingRuleIdx === ri ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Music size={11} />}
                                                    {uploadingRuleIdx === ri ? 'Uploading...' : 'Add Sample'}
                                                    <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={uploadingRuleIdx === ri} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRuleSample(ri, f); e.target.value = ''; }} />
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setForm({ ...form, rulesData: [...form.rulesData, { text: '', links: [], samples: [] }] })} style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}>
                                        <Plus size={12} /> Add Rule
                                    </button>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Hero Banner Image</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>
                                            <Upload size={14} /> {bannerFile ? bannerFile.name : 'Upload Image'}
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (!f) return;
                                                setBannerFile(f);
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setBannerPreview(ev.target?.result as string);
                                                reader.readAsDataURL(f);
                                            }} />
                                        </label>
                                        {bannerPreview && (
                                            <img src={bannerPreview} alt="Banner preview" style={{ height: '60px', width: '120px', objectFit: 'cover', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }} />
                                        )}
                                        {bannerPreview && (
                                            <button onClick={() => { setBannerFile(null); setBannerPreview(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px' }} title="Remove"><X size={16} /></button>
                                        )}
                                    </div>
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textSecondary }}>Shown as the hero background on the public battles page. Recommended: 1920×600px.</p>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Homepage Card Image</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>
                                            <Upload size={14} /> {cardImageFile ? cardImageFile.name : 'Upload Image'}
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (!f) return;
                                                setCardImageFile(f);
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setCardImagePreview(ev.target?.result as string);
                                                reader.readAsDataURL(f);
                                            }} />
                                        </label>
                                        {cardImagePreview && (
                                            <img src={cardImagePreview} alt="Card image preview" style={{ height: '60px', width: '120px', objectFit: 'cover', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }} />
                                        )}
                                        {cardImagePreview && (
                                            <button onClick={() => { setCardImageFile(null); setCardImagePreview(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px' }} title="Remove"><X size={16} /></button>
                                        )}
                                    </div>
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textSecondary }}>Appears as a thumbnail in the homepage discovery card, between the title and description. Recommended: 16:9, min 600×340px.</p>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Prizes</label>
                                    {form.prizes.map((prize, i) => (
                                        <div key={i} style={{ marginBottom: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prize #{i + 1}</span>
                                                <button onClick={() => setForm({ ...form, prizes: form.prizes.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '2px' }}><X size={14} /></button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <div>
                                                    <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Place Label</label>
                                                    <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.place} onChange={(e) => { const p = [...form.prizes]; p[i] = { ...p[i], place: e.target.value }; setForm({ ...form, prizes: p }); }} placeholder="1st Place" />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Prize Title</label>
                                                    <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.title} onChange={(e) => { const p = [...form.prizes]; p[i] = { ...p[i], title: e.target.value }; setForm({ ...form, prizes: p }); }} placeholder="Splice Subscription" />
                                                </div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Description</label>
                                                    <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.description} onChange={(e) => { const p = [...form.prizes]; p[i] = { ...p[i], description: e.target.value }; setForm({ ...form, prizes: p }); }} placeholder="3 months of Splice + $100 cash" />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Link (Optional)</label>
                                                    <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.link} onChange={(e) => { const p = [...form.prizes]; p[i] = { ...p[i], link: e.target.value }; setForm({ ...form, prizes: p }); }} placeholder="https://splice.com" />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Image (Optional)</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.sm, cursor: uploadingPrizeIdx === i ? 'not-allowed' : 'pointer', fontSize: '12px', color: colors.textPrimary }}>
                                                            {uploadingPrizeIdx === i ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Image size={12} />}
                                                            {uploadingPrizeIdx === i ? 'Uploading...' : 'Upload'}
                                                            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingPrizeIdx === i} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPrizeImage(i, f); e.target.value = ''; }} />
                                                        </label>
                                                        {prize.imageUrl && (
                                                            <>
                                                                <img src={prize.imageUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                                <button onClick={() => { const p = [...form.prizes]; p[i] = { ...p[i], imageUrl: '' }; setForm({ ...form, prizes: p }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '2px' }}><X size={12} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setForm({ ...form, prizes: [...form.prizes, { place: `${form.prizes.length + 1}${['st','nd','rd'][form.prizes.length] || 'th'} Place`, title: '', description: '', imageUrl: '', link: '' }] })} style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}>
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
                                <div>
                                    <label style={labelStyle}>Sudden Death Duration (minutes)</label>
                                    <input type="number" min={1} style={inputStyle} value={form.suddenDeathDurationMinutes} onChange={(e) => setForm({ ...form, suddenDeathDurationMinutes: Number(e.target.value) || 60 })} placeholder="60" />
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textSecondary }}>How long the runoff stays open if entries are lex-tied at all 3 ranks</p>
                                </div>
                                <div>
                                    <label style={labelStyle}>Require Project File Upload</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                        <button
                                            onClick={() => setForm({ ...form, requireProjectFile: !form.requireProjectFile })}
                                            style={{
                                                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                                backgroundColor: form.requireProjectFile ? colors.primary : 'rgba(255,255,255,0.15)',
                                                position: 'relative', transition: 'background-color 0.2s',
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: colors.textPrimary,
                                                position: 'absolute', top: '3px', left: form.requireProjectFile ? '23px' : '3px',
                                                transition: 'left 0.2s',
                                            }} />
                                        </button>
                                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                                            {form.requireProjectFile ? 'Submitters must upload .flp or .zip project file' : 'Project files optional'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* @everyone Ping Settings */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px', marginTop: '8px' }}>
                                <h4 style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: '14px' }}>@everyone Pings</h4>
                                <p style={{ margin: '0 0 14px', color: colors.textSecondary, fontSize: '12px' }}>Choose which announcements ping @everyone in the announcement channel.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {([
                                        { key: 'pingOnSubmissions', label: 'Submissions open', desc: 'When the battle launches and entries are accepted' },
                                        { key: 'pingOnVoting', label: 'Voting opens', desc: 'When submission period ends and voting begins' },
                                        { key: 'pingOnWinners', label: 'Winners announced', desc: 'When the results are posted' },
                                    ] as { key: 'pingOnSubmissions' | 'pingOnVoting' | 'pingOnWinners'; label: string; desc: string }[]).map(({ key, label, desc }) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <button
                                                onClick={() => setForm({ ...form, [key]: !form[key] })}
                                                style={{
                                                    width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', flexShrink: 0,
                                                    backgroundColor: form[key] ? '#ef4444' : 'rgba(255,255,255,0.15)',
                                                    position: 'relative', transition: 'background-color 0.2s',
                                                }}
                                            >
                                                <div style={{
                                                    width: '18px', height: '18px', borderRadius: '50%', backgroundColor: colors.textPrimary,
                                                    position: 'absolute', top: '3px', left: form[key] ? '23px' : '3px',
                                                    transition: 'left 0.2s',
                                                }} />
                                            </button>
                                            <div>
                                                <span style={{ fontSize: '13px', color: form[key] ? colors.textPrimary : colors.textSecondary, fontWeight: form[key] ? 600 : 400 }}>
                                                    {label}
                                                </span>
                                                <span style={{ fontSize: '11px', color: colors.textTertiary, marginLeft: '6px' }}>{desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Economy Integration (per-battle) */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px', marginTop: '8px' }}>
                                <h4 style={{ margin: '0 0 6px', color: colors.textPrimary, fontSize: '14px' }}>Economy Integration</h4>
                                <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '12px' }}>Link coins to this battle. Charge entry fees, award prizes, and reward voters.</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {/* Entry Fee */}
                                    <div>
                                        <button
                                            onClick={() => setForm({ ...form, entryFeeEnabled: !form.entryFeeEnabled })}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: borderRadius.md, border: `1px solid ${form.entryFeeEnabled ? colors.primary : 'rgba(255,255,255,0.1)'}`, backgroundColor: form.entryFeeEnabled ? 'rgba(43,140,113,0.15)' : 'rgba(255,255,255,0.04)', color: colors.textPrimary, cursor: 'pointer', fontSize: '13px', fontWeight: 600, width: '100%' }}
                                        >
                                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: form.entryFeeEnabled ? colors.primary : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: colors.textPrimary, position: 'absolute', top: '2px', left: form.entryFeeEnabled ? '18px' : '2px', transition: 'left 0.2s' }} />
                                            </div>
                                            Entry Fee
                                        </button>
                                        {form.entryFeeEnabled && (
                                            <input type="number" min={0} style={{ ...inputStyle, marginTop: '8px', width: '120px' }} value={form.entryFee} onChange={e => setForm({ ...form, entryFee: parseInt(e.target.value) || 0 })} placeholder="Fee amount" />
                                        )}
                                    </div>
                                    {/* Voter Reward */}
                                    <div>
                                        <label style={labelStyle}>Voter Reward (coins per vote)</label>
                                        <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Coins awarded for each vote cast</p>
                                        <input type="number" min={0} style={{ ...inputStyle, width: '120px' }} value={form.voterReward} onChange={e => setForm({ ...form, voterReward: parseInt(e.target.value) || 0 })} placeholder="0 = disabled" />
                                    </div>
                                    {/* Prize Pool */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <button
                                            onClick={() => setForm({ ...form, prizePoolEnabled: !form.prizePoolEnabled })}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: borderRadius.md, border: `1px solid ${form.prizePoolEnabled ? colors.primary : 'rgba(255,255,255,0.1)'}`, backgroundColor: form.prizePoolEnabled ? 'rgba(43,140,113,0.15)' : 'rgba(255,255,255,0.04)', color: colors.textPrimary, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        >
                                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: form.prizePoolEnabled ? colors.primary : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: colors.textPrimary, position: 'absolute', top: '2px', left: form.prizePoolEnabled ? '18px' : '2px', transition: 'left 0.2s' }} />
                                            </div>
                                            Prize Pool (auto-award on completion)
                                        </button>
                                    </div>
                                    {form.prizePoolEnabled && (
                                        <>
                                            <div>
                                                <label style={labelStyle}>1st Place Prize</label>
                                                <input type="number" min={0} style={{ ...inputStyle, width: '120px' }} value={form.prizeFirst} onChange={e => setForm({ ...form, prizeFirst: parseInt(e.target.value) || 0 })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>2nd Place Prize</label>
                                                <input type="number" min={0} style={{ ...inputStyle, width: '120px' }} value={form.prizeSecond} onChange={e => setForm({ ...form, prizeSecond: parseInt(e.target.value) || 0 })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>3rd Place Prize</label>
                                                <input type="number" min={0} style={{ ...inputStyle, width: '120px' }} value={form.prizeThird} onChange={e => setForm({ ...form, prizeThird: parseInt(e.target.value) || 0 })} />
                                            </div>
                                        </>
                                    )}
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
                                                <span style={{ position: 'absolute', bottom: '110%', right: 0, fontSize: '11px', padding: '4px 8px', borderRadius: '6px', backgroundColor: announceMsg.ok ? colors.success : colors.error, color: colors.textPrimary, pointerEvents: 'none', maxWidth: '260px', lineHeight: '1.3', textAlign: 'center' }}>
                                                    {announceMsg.ok ? 'Posted ✓' : (announceMsg.message || 'Failed ✗')}
                                                </span>
                                            )}
                                        </button>
                                        <button onClick={() => fetchAnalytics(b.id)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Analytics">
                                            <BarChart3 size={14} />
                                        </button>
                                        <button onClick={() => fetchVotes(b.id)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Vote breakdown (who voted for what)">
                                            <Vote size={14} />
                                        </button>
                                        {b.status === 'completed' && (
                                            <button onClick={() => handleRecompute(b.id)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Recompute podium by total points (fix old vote-count winners)">
                                                <Trophy size={14} />
                                            </button>
                                        )}
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
                                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: colors.background, borderRadius: borderRadius.md, border: `1px solid ${colors.border}` }}>
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

                                {/* Vote Breakdown Inline */}
                                {votesFor === b.id && voteReport && (
                                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: colors.background, borderRadius: borderRadius.md, border: `1px solid ${colors.border}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <h4 style={{ margin: 0, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Vote size={16} color={colors.primary} /> Vote Breakdown
                                                <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 400 }}>
                                                    {voteReport.totalVotes} votes from {voteReport.uniqueVoters} unique voters
                                                </span>
                                            </h4>
                                            <button onClick={() => { setVotesFor(null); setVoteReport(null); }} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={16} /></button>
                                        </div>
                                        {voteReport.entries.length === 0 ? (
                                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0 }}>No entries yet.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {voteReport.entries.map((e, idx) => {
                                                    const tiers: { label: string; color: string; voters: VoterInfo[]; pts: number }[] = [
                                                        { label: '+3 pts', color: '#FFD700', voters: e.firstPlaceVotes, pts: 3 },
                                                        { label: '+2 pts', color: '#C0C0C0', voters: e.secondPlaceVotes, pts: 2 },
                                                        { label: '+1 pt',  color: '#CD7F32', voters: e.thirdPlaceVotes, pts: 1 },
                                                    ];
                                                    return (
                                                        <div key={e.entryId} style={{ padding: '12px', backgroundColor: colors.surface, borderRadius: borderRadius.md, border: `1px solid ${idx === 0 ? '#FFD70033' : 'rgba(255,255,255,0.05)'}` }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '14px' }}>{e.trackTitle}</div>
                                                                    <div style={{ color: colors.textSecondary, fontSize: '12px' }}>by @{e.submitterUsername}</div>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                                                                    <span style={{ color: colors.textSecondary }}>{e.voteCount} votes</span>
                                                                    <span style={{ color: colors.primary, fontWeight: 700 }}>{e.pointTotal} pts</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                                                                {tiers.map(tier => (
                                                                    <div key={tier.label} style={{ padding: '8px 10px', backgroundColor: `${tier.color}10`, borderRadius: '6px', borderLeft: `3px solid ${tier.color}` }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                            <span style={{ color: tier.color, fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em' }}>{tier.label}</span>
                                                                            <span style={{ color: colors.textSecondary, fontSize: '11px' }}>{tier.voters.length} voter{tier.voters.length === 1 ? '' : 's'}</span>
                                                                        </div>
                                                                        {tier.voters.length === 0 ? (
                                                                            <div style={{ color: colors.textSecondary, fontSize: '11px', fontStyle: 'italic' }}>—</div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                                {tier.voters.map(v => (
                                                                                    <div key={v.userId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textPrimary }}>
                                                                                        <span style={{ color: tier.color }}>•</span>
                                                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{v.username}</span>
                                                                                        {v.source === 'discord' && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#5865F222', color: '#7984F5' }}>discord</span>}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
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
                        <button onClick={() => { setEditingSponsor(null); setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', showOnPage: true, links: [{ label: '', url: '' }] }); setSponsorLogoFile(null); setSponsorLogoPreview(''); setShowSponsorForm(!showSponsorForm); }} style={btnPrimary}>
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
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Logo</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        {(sponsorLogoPreview || sponsorForm.logoUrl) && (
                                            <img src={sponsorLogoPreview || sponsorForm.logoUrl} alt="Preview" style={{ width: '80px', height: '40px', objectFit: 'contain', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                        )}
                                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: colors.textSecondary, fontSize: '13px' }}>
                                            <Upload size={14} /> Upload Logo
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) { setSponsorLogoFile(f); setSponsorLogoPreview(URL.createObjectURL(f)); }
                                            }} />
                                        </label>
                                        <div style={{ flex: 1, minWidth: '160px' }}>
                                            <input style={inputStyle} value={sponsorForm.logoUrl} onChange={(e) => { setSponsorForm({ ...sponsorForm, logoUrl: e.target.value }); setSponsorLogoPreview(''); }} placeholder="Or paste URL..." />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Copy / Tagline</label>
                                    <input style={inputStyle} value={sponsorForm.description} onChange={(e) => setSponsorForm({ ...sponsorForm, description: e.target.value })} placeholder="e.g. The #1 sample platform for producers" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
                                    <input type="checkbox" id="showOnPage" checked={sponsorForm.showOnPage} onChange={(e) => setSponsorForm({ ...sponsorForm, showOnPage: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: colors.primary }} />
                                    <label htmlFor="showOnPage" style={{ color: colors.textPrimary, fontSize: '13px', cursor: 'pointer' }}>Show on public battles page</label>
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
                                <button onClick={() => { setShowSponsorForm(false); setEditingSponsor(null); setSponsorForm({ name: '', logoUrl: '', websiteUrl: '', description: '', showOnPage: true, links: [{ label: '', url: '' }] }); setSponsorLogoFile(null); setSponsorLogoPreview(''); }} style={btnSecondary}>Cancel</button>
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
                                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>{s._count?.battles || 0} battles · {((s as any).websiteClicks || 0) + s.links.reduce((sum: number, l: SponsorLink) => sum + l.clicks, 0)} total clicks ({(s as any).websiteClicks || 0} site · {s.links.reduce((sum: number, l: SponsorLink) => sum + l.clicks, 0)} promo)</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => openSponsorAnalytics(s.id)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '12px' }} title="Analytics"><BarChart2 size={14} /></button>
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

                    {/* ── Sponsor Analytics Modal ── */}
                    {sponsorAnalyticsFor && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
                            onClick={() => { setSponsorAnalyticsFor(null); setSponsorAnalytics(null); }}>
                            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1a1e2e', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <BarChart2 size={20} color={colors.primary} />
                                        <h3 style={{ margin: 0, color: colors.textPrimary }}>Sponsor Analytics</h3>
                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                            {sponsors.find(s => s.id === sponsorAnalyticsFor)?.name}
                                        </span>
                                    </div>
                                    <button onClick={() => { setSponsorAnalyticsFor(null); setSponsorAnalytics(null); }} style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer' }}><X size={18} /></button>
                                </div>

                                {loadingSponsorAnalytics ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>Loading analytics...</div>
                                ) : sponsorAnalytics ? (
                                    <>
                                        {/* Stat cards */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                                            {[
                                                { label: 'Total Clicks', value: sponsorAnalytics.totalClicks, sub: `${sponsorAnalytics.totalWebClicks} site · ${sponsorAnalytics.totalPromoClicks} promo` },
                                                { label: 'Unique (30d)', value: sponsorAnalytics.uniqueClicks30d, sub: 'distinct visitors' },
                                                { label: 'Clicks (30d)', value: sponsorAnalytics.clicks30d, sub: 'last 30 days' },
                                                { label: 'Page Views', value: (sponsorAnalytics.viewCount || 0).toLocaleString(), sub: 'impressions' },
                                            ].map(card => (
                                                <div key={card.label} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px' }}>
                                                    <div style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{card.label}</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 800, color: colors.primary, lineHeight: 1 }}>{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
                                                    <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '4px' }}>{card.sub}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Daily clicks bar chart */}
                                        <div style={{ marginBottom: '20px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Daily Clicks — Last 30 Days</div>
                                            <div style={{ height: 180 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={sponsorAnalytics.dailyClicks} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                        <XAxis dataKey="date" tick={{ fill: colors.textTertiary, fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} interval={4} />
                                                        <YAxis tick={{ fill: colors.textTertiary, fontSize: 10 }} allowDecimals={false} />
                                                        <Tooltip contentStyle={{ backgroundColor: '#1a1e2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: colors.textPrimary }} labelStyle={{ color: colors.textSecondary, fontSize: 11 }} />
                                                        <Bar dataKey="clicks" fill={colors.primary} radius={[3, 3, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Promo link breakdown */}
                                        {sponsorAnalytics.promoLinks?.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Promo Link Breakdown</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {sponsorAnalytics.promoLinks.map((l: any) => (
                                                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                            <Link2 size={12} color={colors.textTertiary} />
                                                            <span style={{ flex: 1, fontSize: '13px', color: colors.textPrimary }}>{l.label}</span>
                                                            <span style={{ fontSize: '13px', fontWeight: 700, color: colors.primary }}>{l.clicks.toLocaleString()}</span>
                                                            <span style={{ fontSize: '11px', color: colors.textTertiary }}>clicks</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px', color: colors.textTertiary }}>No analytics data yet.</div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── BACKFILL TAB ─── */}
            {tab === 'backfill' && (
                <>
                    <h2 style={{ margin: '0 0 16px', color: colors.textPrimary, fontSize: '18px' }}>Backfill Past Battles</h2>
                    <div style={{ ...cardStyle, borderLeft: `4px solid ${colors.warning}` }}>
                        <p style={{ margin: '0 0 20px', color: colors.textSecondary, fontSize: '13px' }}>Add past beat battles that happened before this system was in place. They will appear in the archive.</p>

                        {/* ── Section 1: Basic Info ── */}
                        <h4 style={{ margin: '0 0 12px', color: colors.textPrimary, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>Basic Info</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Battle Title *</label>
                                <input style={inputStyle} value={backfillForm.title} onChange={(e) => setBackfillForm({ ...backfillForm, title: e.target.value })} placeholder="Beat Battle #0" />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Subtitle <span style={{ color: colors.textTertiary, fontWeight: 400 }}>(optional — max 200 chars)</span></label>
                                <input
                                    style={inputStyle}
                                    value={backfillForm.subtitle}
                                    onChange={(e) => setBackfillForm({ ...backfillForm, subtitle: e.target.value.slice(0, 200) })}
                                    placeholder="e.g. Season 1 · Lo-Fi Edition"
                                />
                                <div style={{ fontSize: '10px', color: colors.textTertiary, textAlign: 'right', marginTop: '2px' }}>{backfillForm.subtitle.length}/200</div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Description</label>
                                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={backfillForm.description} onChange={(e) => setBackfillForm({ ...backfillForm, description: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Sponsor (optional)</label>
                                <select style={inputStyle} value={backfillForm.sponsorId} onChange={(e) => setBackfillForm({ ...backfillForm, sponsorId: e.target.value })}>
                                    <option value="">— None —</option>
                                    {sponsors.filter(s => s.isActive).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Completed Date</label>
                                <input type="date" style={inputStyle} value={backfillForm.completedAt} onChange={(e) => setBackfillForm({ ...backfillForm, completedAt: e.target.value })} />
                            </div>
                        </div>

                        {/* ── Section 2: Images ── */}
                        <h4 style={{ margin: '0 0 12px', color: colors.textPrimary, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>Images</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            <div>
                                <label style={labelStyle}>Hero Banner Image</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>
                                        <Upload size={14} /> {backfillBannerFile ? backfillBannerFile.name : 'Upload Image'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            setBackfillBannerFile(f);
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setBackfillBannerPreview(ev.target?.result as string);
                                            reader.readAsDataURL(f);
                                        }} />
                                    </label>
                                    {backfillBannerPreview && (
                                        <>
                                            <img src={backfillBannerPreview} alt="Banner preview" style={{ height: '60px', width: '120px', objectFit: 'cover', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }} />
                                            <button onClick={() => { setBackfillBannerFile(null); setBackfillBannerPreview(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px' }} title="Remove"><X size={16} /></button>
                                        </>
                                    )}
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textSecondary }}>1920×600px recommended.</p>
                            </div>
                            <div>
                                <label style={labelStyle}>Homepage Card Image</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>
                                        <Upload size={14} /> {backfillCardImageFile ? backfillCardImageFile.name : 'Upload Image'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            setBackfillCardImageFile(f);
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setBackfillCardImagePreview(ev.target?.result as string);
                                            reader.readAsDataURL(f);
                                        }} />
                                    </label>
                                    {backfillCardImagePreview && (
                                        <>
                                            <img src={backfillCardImagePreview} alt="Card image preview" style={{ height: '60px', width: '120px', objectFit: 'cover', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.1)' }} />
                                            <button onClick={() => { setBackfillCardImageFile(null); setBackfillCardImagePreview(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px' }} title="Remove"><X size={16} /></button>
                                        </>
                                    )}
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textSecondary }}>16:9, min 600×340px recommended.</p>
                            </div>
                        </div>

                        {/* ── Section 3: Prizes ── */}
                        <h4 style={{ margin: '0 0 12px', color: colors.textPrimary, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>Prizes</h4>
                        <div style={{ marginBottom: '20px' }}>
                            {backfillForm.prizes.map((prize, i) => (
                                <div key={i} style={{ marginBottom: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prize #{i + 1}</span>
                                        <button onClick={() => setBackfillForm({ ...backfillForm, prizes: backfillForm.prizes.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '2px' }}><X size={14} /></button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                            <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Place Label</label>
                                            <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.place} onChange={(e) => { const p = [...backfillForm.prizes]; p[i] = { ...p[i], place: e.target.value }; setBackfillForm({ ...backfillForm, prizes: p }); }} placeholder="1st Place" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Prize Title</label>
                                            <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.title} onChange={(e) => { const p = [...backfillForm.prizes]; p[i] = { ...p[i], title: e.target.value }; setBackfillForm({ ...backfillForm, prizes: p }); }} placeholder="Splice Subscription" />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Description</label>
                                            <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.description} onChange={(e) => { const p = [...backfillForm.prizes]; p[i] = { ...p[i], description: e.target.value }; setBackfillForm({ ...backfillForm, prizes: p }); }} placeholder="3 months of Splice + $100 cash" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Link (Optional)</label>
                                            <input style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={prize.link} onChange={(e) => { const p = [...backfillForm.prizes]; p[i] = { ...p[i], link: e.target.value }; setBackfillForm({ ...backfillForm, prizes: p }); }} placeholder="https://splice.com" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', color: colors.textSecondary, display: 'block', marginBottom: '3px' }}>Image (Optional)</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: borderRadius.sm, cursor: uploadingBackfillPrizeIdx === i ? 'not-allowed' : 'pointer', fontSize: '12px', color: colors.textPrimary }}>
                                                    {uploadingBackfillPrizeIdx === i ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Image size={12} />}
                                                    {uploadingBackfillPrizeIdx === i ? 'Uploading...' : 'Upload'}
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingBackfillPrizeIdx === i} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackfillPrizeImage(i, f); e.target.value = ''; }} />
                                                </label>
                                                {prize.imageUrl && (
                                                    <>
                                                        <img src={prize.imageUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                        <button onClick={() => { const p = [...backfillForm.prizes]; p[i] = { ...p[i], imageUrl: '' }; setBackfillForm({ ...backfillForm, prizes: p }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '2px' }}><X size={12} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setBackfillForm({ ...backfillForm, prizes: [...backfillForm.prizes, { place: `${backfillForm.prizes.length + 1}${['st','nd','rd'][backfillForm.prizes.length] || 'th'} Place`, title: '', description: '', imageUrl: '', link: '' }] })} style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}>
                                <Gift size={12} /> Add Prize
                            </button>
                        </div>

                        {/* ── Section 4: Submissions ── */}
                        <h4 style={{ margin: '0 0 12px', color: colors.textPrimary, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>Submissions</h4>
                        <div style={{ marginBottom: '20px' }}>
                            {/* Track search */}
                            <div style={{ position: 'relative', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md }}>
                                    {backfillSearchLoading ? <Loader2 size={14} color={colors.textSecondary} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} /> : <Search size={14} color={colors.textSecondary} style={{ flexShrink: 0 }} />}
                                    <input
                                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: '14px' }}
                                        value={backfillTrackSearch}
                                        onChange={(e) => setBackfillTrackSearch(e.target.value)}
                                        placeholder="Search tracks by title or artist…"
                                    />
                                    {backfillTrackSearch && (
                                        <button onClick={() => { setBackfillTrackSearch(''); setBackfillTrackResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '2px', flexShrink: 0 }}><X size={14} /></button>
                                    )}
                                </div>
                                {backfillTrackResults.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                                        {backfillTrackResults.map((r) => (
                                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: `1px solid rgba(255,255,255,0.05)`, cursor: 'default' }}>
                                                {r.coverUrl
                                                    ? <img src={r.coverUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: borderRadius.sm, objectFit: 'cover', flexShrink: 0 }} />
                                                    : <div style={{ width: '40px', height: '40px', borderRadius: borderRadius.sm, backgroundColor: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={colors.textTertiary} /></div>
                                                }
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                                                    <div style={{ color: colors.textSecondary, fontSize: '11px' }}>{r.artistName}</div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setBackfillForm(f => ({
                                                            ...f,
                                                            entries: [...f.entries, { trackId: r.id, trackTitle: r.title, artistName: r.artistName, coverUrl: r.coverUrl, userId: r.userId, place: f.entries.length + 1 }],
                                                        }));
                                                        setBackfillTrackSearch('');
                                                        setBackfillTrackResults([]);
                                                    }}
                                                    style={{ ...btnPrimary, fontSize: '12px', padding: '5px 10px', flexShrink: 0 }}
                                                >
                                                    <Plus size={12} /> Add
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setBackfillForm(f => ({ ...f, entries: [...f.entries, { trackId: null, trackTitle: '', artistName: '', coverUrl: null, userId: '', place: f.entries.length + 1 }] }))}
                                style={{ ...btnSecondary, fontSize: '12px', padding: '5px 12px', marginBottom: '12px' }}
                            >
                                <Plus size={12} /> Add Manually
                            </button>

                            {/* Entries list */}
                            {backfillForm.entries.length === 0 && (
                                <p style={{ color: colors.textTertiary, fontSize: '13px', margin: '8px 0' }}>No submissions yet. Search for platform tracks or add manually.</p>
                            )}
                            {backfillForm.entries.map((entry, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${entry.place === 1 ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: borderRadius.md, marginBottom: '8px' }}>
                                    {/* Cover */}
                                    {entry.coverUrl
                                        ? <img src={entry.coverUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: borderRadius.sm, objectFit: 'cover', flexShrink: 0 }} />
                                        : <div style={{ width: '40px', height: '40px', borderRadius: borderRadius.sm, backgroundColor: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={colors.textTertiary} /></div>
                                    }
                                    {/* Track info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {entry.trackId ? (
                                            <>
                                                <div style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.trackTitle}</div>
                                                <div style={{ color: colors.textSecondary, fontSize: '11px' }}>{entry.artistName}</div>
                                            </>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                                <div>
                                                    <div style={{ fontSize: '10px', color: colors.textTertiary, marginBottom: '2px' }}>Track Title</div>
                                                    <input style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }} value={entry.trackTitle} onChange={(e) => { const es = [...backfillForm.entries]; es[i] = { ...es[i], trackTitle: e.target.value }; setBackfillForm({ ...backfillForm, entries: es }); }} placeholder="Track name" />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '10px', color: colors.textTertiary, marginBottom: '2px' }}>Artist / Username</div>
                                                    <input style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }} value={entry.artistName} onChange={(e) => { const es = [...backfillForm.entries]; es[i] = { ...es[i], artistName: e.target.value }; setBackfillForm({ ...backfillForm, entries: es }); }} placeholder="Producer123" />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '10px', color: colors.textTertiary, marginBottom: '2px' }}>Discord User ID</div>
                                                    <input style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }} value={entry.userId} onChange={(e) => { const es = [...backfillForm.entries]; es[i] = { ...es[i], userId: e.target.value }; setBackfillForm({ ...backfillForm, entries: es }); }} placeholder="123456789012345678" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Place selector */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        {entry.place === 1 && <span title="Winner" style={{ display: 'inline-flex' }}><Crown size={14} color="#FFD700" /></span>}
                                        <select
                                            value={entry.place}
                                            onChange={(e) => { const es = [...backfillForm.entries]; es[i] = { ...es[i], place: Number(e.target.value) }; setBackfillForm({ ...backfillForm, entries: es }); }}
                                            style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: '12px' }}
                                        >
                                            <option value={0}>No placement</option>
                                            <option value={1}>1st</option>
                                            <option value={2}>2nd</option>
                                            <option value={3}>3rd</option>
                                            <option value={4}>4th</option>
                                            <option value={5}>5th</option>
                                        </select>
                                    </div>
                                    {/* Remove */}
                                    <button onClick={() => setBackfillForm({ ...backfillForm, entries: backfillForm.entries.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, padding: '4px', flexShrink: 0 }}><X size={14} /></button>
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
                                <label style={labelStyle}>Announcements Channel</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Where battle announcements are posted to Discord</p>
                                <ChannelSelect guildId={guildId} value={settings.announcementChannelId} onChange={(v) => setSettings({ ...settings, announcementChannelId: v as string })} channelTypes={[0, 5]} placeholder="Select Channel" />
                            </div>
                            <div>
                                <label style={labelStyle}>Chat Channel</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>General chat channel for battle discussions</p>
                                <ChannelSelect guildId={guildId} value={settings.chatChannelId} onChange={(v) => setSettings({ ...settings, chatChannelId: v as string })} channelTypes={[0]} placeholder="Select Channel" />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Require Musician Profile to Submit</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>If enabled, users must have a musician profile before they can submit entries</p>
                                <button
                                    onClick={() => setSettings({ ...settings, requireMusicianProfile: !settings.requireMusicianProfile })}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: borderRadius.md, border: `1px solid ${settings.requireMusicianProfile ? colors.primary : 'rgba(255,255,255,0.1)'}`, backgroundColor: settings.requireMusicianProfile ? 'rgba(43,140,113,0.15)' : 'rgba(255,255,255,0.04)', color: colors.textPrimary, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                >
                                    <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: settings.requireMusicianProfile ? colors.primary : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background-color 0.2s' }}>
                                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: colors.textPrimary, position: 'absolute', top: '2px', left: settings.requireMusicianProfile ? '18px' : '2px', transition: 'left 0.2s' }} />
                                    </div>
                                    {settings.requireMusicianProfile ? 'Required' : 'Not Required'}
                                </button>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Default Sudden Death Duration (minutes)</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Default runoff window when battles end with a perfect lex tie at all 3 ranks. Per-battle overrides are available in each battle's settings.</p>
                                <input
                                    type="number"
                                    min={1}
                                    style={{ ...inputStyle, maxWidth: '200px' }}
                                    value={settings.suddenDeathDurationMinutes}
                                    onChange={(e) => setSettings({ ...settings, suddenDeathDurationMinutes: Number(e.target.value) || 60 })}
                                    placeholder="60"
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Discord Server Invite URL</label>
                                <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Shown on the public Beat Battles page for community links</p>
                                <input
                                    style={inputStyle}
                                    value={settings.discordInviteUrl}
                                    onChange={(e) => setSettings({ ...settings, discordInviteUrl: e.target.value })}
                                    placeholder="https://discord.gg/your-invite"
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px', marginTop: '4px' }}>
                                <h4 style={{ margin: '0 0 16px', color: colors.textPrimary, fontSize: '14px' }}>Public Page Settings</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Featured Battle (Hero)</label>
                                        <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Pin a specific battle to the hero card. Leave blank to auto-select the active one.</p>
                                        <select
                                            style={{ ...inputStyle, cursor: 'pointer' }}
                                            value={settings.featuredBattleId}
                                            onChange={(e) => setSettings({ ...settings, featuredBattleId: e.target.value })}
                                        >
                                            <option value="">Auto (active/voting/upcoming)</option>
                                            {battles.map(b => (
                                                <option key={b.id} value={b.id}>{b.title} [{b.status}]</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Sponsors Section Title</label>
                                        <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: '12px' }}>Label shown above the sponsors grid (e.g. "Official Partners", "Supported By")</p>
                                        <input
                                            style={inputStyle}
                                            value={settings.sponsorSectionTitle}
                                            onChange={(e) => setSettings({ ...settings, sponsorSectionTitle: e.target.value })}
                                            placeholder="Official Partners"
                                        />
                                    </div>
                                </div>
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
        <ConfirmModal
            open={!!deleteConfirm}
            title={deleteConfirm?.type === 'battle' ? 'Delete Battle' : 'Delete Sponsor'}
            message={deleteConfirm?.type === 'battle' ? 'Delete this battle? This cannot be undone.' : 'Delete this sponsor?'}
            confirmLabel="Delete"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteConfirm(null)}
        />
        </>
    );
};

// ─── Battle Entries Sub-component ───
const BattleEntries: React.FC<{ battleId: string }> = ({ battleId }) => {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchEntries = async () => {
        try {
            const res = await fetch(`${API}/api/beat-battle/battles/${battleId}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries || []);
            }
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => {
        fetchEntries();
    }, [battleId]);

    const deleteEntry = async (entryId: string, name: string) => {
        if (!window.confirm(`Delete submission "${name}"? This cannot be undone.`)) return;
        setDeletingId(entryId);
        try {
            const res = await fetch(`${API}/api/beat-battle/entries/${entryId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                setEntries(prev => prev.filter(e => e.id !== entryId));
            } else {
                const data = await res.json().catch(() => ({}));
                alert(`Failed to delete entry: ${data.error || res.statusText}`);
            }
        } catch (e: any) {
            alert(`Failed to delete entry: ${e.message}`);
        } finally { setDeletingId(null); }
    };

    if (loading) return <p style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '12px' }}>Loading entries...</p>;
    if (entries.length === 0) return <p style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '12px' }}>No submissions yet.</p>;

    return (
        <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 8px', color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase' }}>Entries ({entries.length})</h4>
            {entries.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: i % 2 === 0 ? colors.background : 'transparent', borderRadius: borderRadius.sm }}>
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
                        <button
                            onClick={() => deleteEntry(e.id, e.trackTitle)}
                            disabled={deletingId === e.id}
                            title="Delete submission"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '4px', opacity: deletingId === e.id ? 0.4 : 0.7, display: 'flex', alignItems: 'center' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
