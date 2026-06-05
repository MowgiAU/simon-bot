import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { ConfirmModal } from '../components/ConfirmModal';
import { Settings, Plus, X, List, Music, Database, Edit3, Trash2, Star, Search, Tag, ExternalLink, ShieldOff, UserX, UserCheck, ChevronDown, ChevronUp, AlertTriangle, Swords, Compass, MonitorPlay, Newspaper, BookOpen, FileText, TrendingUp, Building2, UserPlus, Loader2, CheckCircle } from 'lucide-react';

interface Genre {
    id: string;
    name: string;
    parentId: string | null;
}

interface TrackResult {
    id: string;
    title: string;
    slug: string;
    artist: string | null;
    coverUrl: string | null;
    playCount: number;
    profile: { displayName: string | null; username: string };
}

interface DiscoveryConfig {
    featuredTrackId: string | null;
    featuredLabel: string | null;
    featuredTrack: TrackResult | null;
    featuredType: string;
    featuredArtistId: string | null;
    featuredArtist: { id: string; displayName: string | null; username: string; avatar: string | null } | null;
    featuredPlaylistId: string | null;
    featuredPlaylist: { id: string; name: string; coverUrl: string | null; _count: { tracks: number }; profile: { displayName: string | null; username: string } } | null;
    editorPicks?: { id: string; title: string; coverUrl: string | null; profile: { username: string; displayName: string | null } }[];
    featuredProducer?: { userId: string; username: string; displayName: string | null; avatar: string | null } | null;
    featuredProducerNote?: string | null;
    featuredTutorialUrl?: string | null;
    featuredTutorialTitle?: string | null;
    featuredTutorialDescription?: string | null;
    featuredTutorialThumbnail?: string | null;
    featuredTutorialAuthor?: string | null;
    featuredTutorialDate?: string | null;
    featuredContentType?: string | null;
    featuredArticleId?: string | null;
    featuredArticle?: { id: string; title: string; slug: string; excerpt: string | null; coverImageUrl: string | null; authorName: string; category: string; publishedAt: string | null } | null;
    featuredBattleDescription?: string | null;
    featuredBattle?: { id: string; title: string; status: string } | null;
}

export const MusicianProfileAdmin: React.FC = () => {
    const navigate = useNavigate();
    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGenreName, setNewGenreName] = useState('');
    const [newGenreParent, setNewGenreParent] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [adminTab, setAdminTab] = useState<'discover' | 'profiles' | 'genres' | 'settings'>('discover');

    // Auto-follow settings state
    const [autoFollowProfile, setAutoFollowProfile] = useState<{ id: string; username: string; displayName: string | null; avatar: string | null } | null>(null);
    const [autoFollowSearch, setAutoFollowSearch] = useState('');
    const [autoFollowResults, setAutoFollowResults] = useState<any[]>([]);
    const [searchingAutoFollow, setSearchingAutoFollow] = useState(false);
    const [savingAutoFollow, setSavingAutoFollow] = useState(false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Discovery settings state
    const [discoveryConfig, setDiscoveryConfig] = useState<DiscoveryConfig>({ featuredTrackId: null, featuredLabel: null, featuredTrack: null, featuredType: 'track', featuredArtistId: null, featuredArtist: null, featuredPlaylistId: null, featuredPlaylist: null });
    const [trackSearch, setTrackSearch] = useState('');
    const [trackResults, setTrackResults] = useState<TrackResult[]>([]);
    const [searchingTracks, setSearchingTracks] = useState(false);
    const [featuredLabel, setFeaturedLabel] = useState('');
    const [featuredHeroDesc, setFeaturedHeroDesc] = useState('');
    const [artistSearch, setArtistSearch] = useState('');
    const [artistResults, setArtistResults] = useState<any[]>([]);
    const [searchingArtists, setSearchingArtists] = useState(false);
    const [playlistSearch, setPlaylistSearch] = useState('');
    const [playlistResults, setPlaylistResults] = useState<any[]>([]);
    const [searchingPlaylists, setSearchingPlaylists] = useState(false);

    // Editor's Picks state
    const [editorPickSearch, setEditorPickSearch] = useState('');
    const [editorPickResults, setEditorPickResults] = useState<TrackResult[]>([]);
    const [searchingEditorPicks, setSearchingEditorPicks] = useState(false);

    // Featured Producer state
    const [producerSearch, setProducerSearch] = useState('');
    const [producerResults, setProducerResults] = useState<any[]>([]);
    const [searchingProducer, setSearchingProducer] = useState(false);
    const [featuredProducerNote, setFeaturedProducerNote] = useState('');

    // Trending Artist Override state
    const [trendingSearch, setTrendingSearch] = useState('');
    const [trendingResults, setTrendingResults] = useState<any[]>([]);
    const [searchingTrending, setSearchingTrending] = useState(false);

    // Global Brand Partners state
    const [allSponsors, setAllSponsors] = useState<any[]>([]);
    const [globalSponsorIds, setGlobalSponsorIds] = useState<string[]>([]);
    const [globalSponsorTitle, setGlobalSponsorTitle] = useState('Our Partners');
    const [sponsorPickSearch, setSponsorPickSearch] = useState('');

    // Featured Content state
    const [featuredContentType, setFeaturedContentType] = useState<'video' | 'news' | 'guide' | 'article'>('video');
    const [featuredTutorialUrl, setFeaturedTutorialUrl] = useState('');
    const [featuredTutorialTitle, setFeaturedTutorialTitle] = useState('');
    const [featuredTutorialDesc, setFeaturedTutorialDesc] = useState('');
    const [featuredTutorialThumbnail, setFeaturedTutorialThumbnail] = useState('');
    const [featuredTutorialAuthor, setFeaturedTutorialAuthor] = useState('');
    const [featuredTutorialDate, setFeaturedTutorialDate] = useState('');
    const [featuredArticleId, setFeaturedArticleId] = useState<string | null>(null);
    const [featuredArticle, setFeaturedArticle] = useState<any>(null);
    const [articleSearch, setArticleSearch] = useState('');
    const [articleResults, setArticleResults] = useState<any[]>([]);
    const [searchingArticles, setSearchingArticles] = useState(false);

    // Featured Battle state
    const [battleList, setBattleList] = useState<any[]>([]);
    const [featuredBattleDesc, setFeaturedBattleDesc] = useState('');

    // Admin wipe state
    const [adminSearch, setAdminSearch] = useState('');
    const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
    const [searchingProfiles, setSearchingProfiles] = useState(false);
    const [confirmWipe, setConfirmWipe] = useState<string | null>(null);
    const [wipeReason, setWipeReason] = useState('');
    const [wipeSendEmail, setWipeSendEmail] = useState(false);

    // Moderation section delete state
    const [confirmDeleteMod, setConfirmDeleteMod] = useState<{ id: string; name: string } | null>(null);
    const [deleteModReason, setDeleteModReason] = useState('');
    const [deleteModSendEmail, setDeleteModSendEmail] = useState(false);

    // Moderation state
    const [modSearch, setModSearch] = useState('');
    const [modProfiles, setModProfiles] = useState<any[]>([]);
    const [searchingMod, setSearchingMod] = useState(false);
    const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
    const [profileTracks, setProfileTracks] = useState<Record<string, any[]>>({});
    const [loadingTracks, setLoadingTracks] = useState<string | null>(null);
    const [statusReason, setStatusReason] = useState<Record<string, string>>({});

    // FLP reprocessing state

    // Admin track management state
    const [adminTrackSearch, setAdminTrackSearch] = useState('');
    const [adminTracks, setAdminTracks] = useState<TrackResult[]>([]);
    const [searchingAdminTracks, setSearchingAdminTracks] = useState(false);

    useEffect(() => {
        fetchGenres();
        fetchDiscoverySettings();
        fetchBattles();
        axios.get('/api/beat-battle/admin/sponsors', { withCredentials: true })
            .then(r => setAllSponsors(r.data || []))
            .catch(() => {});
        // Load auto-follow setting
        axios.get('/api/admin/site-settings', { withCredentials: true }).then(r => {
            const profileId = r.data?.auto_follow_profile_id;
            if (profileId) {
                axios.get(`/api/artists/${profileId}`, { withCredentials: true }).then(pr => {
                    if (pr.data) setAutoFollowProfile({ id: pr.data.id, username: pr.data.username, displayName: pr.data.displayName, avatar: pr.data.avatar });
                }).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    const handleSearchProfiles = async (query: string) => {
        setAdminSearch(query);
        if (query.length < 2) { setAdminProfiles([]); return; }
        setSearchingProfiles(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setAdminProfiles(res.data);
        } catch (err) {
            console.error('Failed to search profiles');
        } finally {
            setSearchingProfiles(false);
        }
    };

    const handleWipeProfile = async (id: string) => {
        setSaving(true);
        try {
            await axios.post(`/api/admin/musician/profile/${id}/wipe`, { reason: wipeReason || undefined, sendEmail: wipeSendEmail }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Profile and all associated content wiped successfully.' });
            setConfirmWipe(null);
            setWipeReason('');
            setWipeSendEmail(false);
            setAdminProfiles(adminProfiles.filter(p => p.id !== id));
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to wipe profile' });
        } finally {
            setSaving(false);
        }
    };

    const searchAutoFollowProfiles = async (q: string) => {
        setAutoFollowSearch(q);
        if (q.length < 2) { setAutoFollowResults([]); return; }
        setSearchingAutoFollow(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: q }, withCredentials: true });
            setAutoFollowResults(res.data || []);
        } catch { /* ignore */ } finally { setSearchingAutoFollow(false); }
    };

    const saveAutoFollowProfile = async (profile: { id: string; username: string; displayName: string | null; avatar: string | null }) => {
        setSavingAutoFollow(true);
        try {
            await axios.put('/api/admin/site-settings', { key: 'auto_follow_profile_id', value: profile.id }, { withCredentials: true });
            setAutoFollowProfile(profile);
            setAutoFollowSearch('');
            setAutoFollowResults([]);
            setMsg({ type: 'success', text: `Auto-follow profile set to @${profile.username}` });
        } catch { setMsg({ type: 'error', text: 'Failed to save setting' }); }
        finally { setSavingAutoFollow(false); }
    };

    const clearAutoFollowProfile = async () => {
        setSavingAutoFollow(true);
        try {
            await axios.put('/api/admin/site-settings', { key: 'auto_follow_profile_id', value: '' }, { withCredentials: true });
            setAutoFollowProfile(null);
            setMsg({ type: 'success', text: 'Auto-follow profile cleared' });
        } catch { setMsg({ type: 'error', text: 'Failed to clear setting' }); }
        finally { setSavingAutoFollow(false); }
    };

    const handleDeleteFromMod = async (id: string) => {
        setSaving(true);
        try {
            await axios.post(`/api/admin/musician/profile/${id}/wipe`, { reason: deleteModReason || undefined, sendEmail: deleteModSendEmail }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Profile and all associated content deleted successfully.' });
            setConfirmDeleteMod(null);
            setDeleteModReason('');
            setDeleteModSendEmail(false);
            setModProfiles(prev => prev.filter(p => p.id !== id));
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to delete profile' });
        } finally {
            setSaving(false);
        }
    };

    const fetchGenres = async () => {
        try {
            const res = await axios.get('/api/musician/genres', { withCredentials: true });
            // Sort by name for easier navigation
            const sorted = [...res.data].sort((a: Genre, b: Genre) => a.name.localeCompare(b.name));
            setGenres(sorted);
        } catch (err) {
            console.error('Failed to load genres');
        } finally {
            setLoading(false);
        }
    };

    const fetchDiscoverySettings = async () => {
        try {
            // cache-bust to bypass Cloudflare/browser stale cache after admin writes
            const res = await axios.get(`/api/discovery/settings?_=${Date.now()}`, { withCredentials: true });
            setDiscoveryConfig(res.data);
            setFeaturedLabel(res.data.featuredLabel || '');
            setFeaturedProducerNote(res.data.featuredProducerNote || '');
            setFeaturedContentType(res.data.featuredContentType || 'video');
            setFeaturedTutorialUrl(res.data.featuredTutorialUrl || '');
            setFeaturedTutorialTitle(res.data.featuredTutorialTitle || '');
            setFeaturedTutorialDesc(res.data.featuredTutorialDescription || '');
            setFeaturedTutorialThumbnail(res.data.featuredTutorialThumbnail || '');
            setFeaturedTutorialAuthor(res.data.featuredTutorialAuthor || '');
            setFeaturedTutorialDate(res.data.featuredTutorialDate || '');
            setFeaturedArticleId(res.data.featuredArticleId || null);
            setFeaturedArticle(res.data.featuredArticle || null);
            setFeaturedBattleDesc(res.data.featuredBattleDescription || '');
            setFeaturedHeroDesc(res.data.featuredDescription || '');
            setGlobalSponsorIds(res.data.globalSponsorIds || []);
            setGlobalSponsorTitle(res.data.globalSponsorTitle || 'Our Partners');
        } catch (err) {
            console.error('Failed to load discovery settings');
        }
    };

    const handleSearchTracks = async (query: string) => {
        setTrackSearch(query);
        if (query.length < 2) { setTrackResults([]); return; }
        setSearchingTracks(true);
        try {
            const res = await axios.get('/api/discovery/tracks/search', { params: { search: query }, withCredentials: true });
            setTrackResults(res.data);
        } catch (err) {
            console.error('Failed to search tracks');
        } finally {
            setSearchingTracks(false);
        }
    };

    const handleSetFeaturedTrack = async (trackId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredTrackId: trackId, 
                featuredLabel: featuredLabel || null,
                featuredType: 'track'
            }, { withCredentials: true });
            setMsg({ type: 'success', text: trackId ? 'Featured track updated!' : 'Featured track removed.' });
            fetchDiscoverySettings();
            setTrackSearch('');
            setTrackResults([]);
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Failed to update featured track' });
        } finally {
            setSaving(false);
        }
    };

    const handleSearchArtists = async (query: string) => {
        setArtistSearch(query);
        if (query.length < 2) { setArtistResults([]); return; }
        setSearchingArtists(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setArtistResults(res.data);
        } catch (err) {
            console.error('Failed to search artists');
        } finally {
            setSearchingArtists(false);
        }
    };

    const handleSetFeaturedArtist = async (artistId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredArtistId: artistId, 
                featuredLabel: featuredLabel || null,
                featuredType: 'artist'
            }, { withCredentials: true });
            setMsg({ type: 'success', text: artistId ? 'Featured artist updated!' : 'Featured artist removed.' });
            fetchDiscoverySettings();
            setArtistSearch('');
            setArtistResults([]);
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Failed to update featured artist' });
        } finally {
            setSaving(false);
        }
    };

    const handleSearchPlaylists = async (query: string) => {
        setPlaylistSearch(query);
        if (query.length < 2) { setPlaylistResults([]); return; }
        setSearchingPlaylists(true);
        try {
            const res = await axios.get('/api/playlists/popular', { params: { limit: 20 }, withCredentials: true });
            setPlaylistResults(res.data.filter((p: any) => p.name.toLowerCase().includes(query.toLowerCase())));
        } catch (err) {
            console.error('Failed to search playlists');
        } finally {
            setSearchingPlaylists(false);
        }
    };

    const handleSetFeaturedPlaylist = async (playlistId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredPlaylistId: playlistId, 
                featuredLabel: featuredLabel || null,
                featuredType: 'playlist'
            }, { withCredentials: true });
            setMsg({ type: 'success', text: playlistId ? 'Featured playlist updated!' : 'Featured playlist removed.' });
            fetchDiscoverySettings();
            setPlaylistSearch('');
            setPlaylistResults([]);
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Failed to update featured playlist' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangeFeaturedType = async (type: string) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredType: type, 
                featuredLabel: featuredLabel || null 
            }, { withCredentials: true });
            fetchDiscoverySettings();
            setMsg({ type: 'success', text: `Featured type changed to ${type}.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Failed to change featured type' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveFeaturedLabel = async () => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { 
                featuredTrackId: discoveryConfig.featuredTrackId, 
                featuredLabel: featuredLabel || null,
                featuredType: discoveryConfig.featuredType
            }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Featured label updated!' });
            fetchDiscoverySettings();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update label' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveFeaturedDescription = async () => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { featuredDescription: featuredHeroDesc || null }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Description saved!' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save description' });
        } finally {
            setSaving(false);
        }
    };

    // ── Editor's Picks handlers ──
    const handleSearchEditorPicks = async (query: string) => {
        setEditorPickSearch(query);
        if (query.length < 2) { setEditorPickResults([]); return; }
        setSearchingEditorPicks(true);
        try {
            const res = await axios.get('/api/discovery/tracks/search', { params: { search: query }, withCredentials: true });
            setEditorPickResults(res.data);
        } catch (err) {
            console.error('Failed to search tracks for editor picks');
        } finally {
            setSearchingEditorPicks(false);
        }
    };

    const handleAddEditorPick = async (trackId: string) => {
        const current = (discoveryConfig.editorPicks || []).map((t: any) => t.id);
        if (current.includes(trackId)) return;
        const updated = [...current, trackId];
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { editorPickTrackIds: updated }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Editor\'s pick added!' });
            fetchDiscoverySettings();
            setEditorPickSearch('');
            setEditorPickResults([]);
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update editor\'s picks' });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveEditorPick = async (trackId: string) => {
        const updated = (discoveryConfig.editorPicks || []).map((t: any) => t.id).filter((id: string) => id !== trackId);
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { editorPickTrackIds: updated }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Editor\'s pick removed.' });
            fetchDiscoverySettings();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update editor\'s picks' });
        } finally {
            setSaving(false);
        }
    };

    // ── Featured Producer handlers ──
    const handleSearchProducer = async (query: string) => {
        setProducerSearch(query);
        if (query.length < 2) { setProducerResults([]); return; }
        setSearchingProducer(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setProducerResults(res.data);
        } catch (err) {
            console.error('Failed to search producers');
        } finally {
            setSearchingProducer(false);
        }
    };

    const handleSetFeaturedProducer = async (userId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { featuredProducerId: userId }, { withCredentials: true });
            setMsg({ type: 'success', text: userId ? 'Featured producer updated!' : 'Featured producer removed.' });
            fetchDiscoverySettings();
            setProducerSearch('');
            setProducerResults([]);
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update featured producer' });
        } finally {
            setSaving(false);
        }
    };

    const handleSearchTrending = async (query: string) => {
        setTrendingSearch(query);
        if (query.length < 2) { setTrendingResults([]); return; }
        setSearchingTrending(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setTrendingResults(res.data);
        } catch { /* ignore */ } finally {
            setSearchingTrending(false);
        }
    };

    const handleSetTrendingOverride = async (userId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { trendingArtistOverrideId: userId }, { withCredentials: true });
            setMsg({ type: 'success', text: userId ? 'Trending artist overridden.' : 'Trending artist override cleared — auto mode.' });
            fetchDiscoverySettings();
            setTrendingSearch('');
            setTrendingResults([]);
        } catch {
            setMsg({ type: 'error', text: 'Failed to update trending override' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGlobalSponsors = async (ids: string[], title: string) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { globalSponsorIds: ids, globalSponsorTitle: title || null }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Brand partners saved.' });
            fetchDiscoverySettings();
        } catch {
            setMsg({ type: 'error', text: 'Failed to save brand partners' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProducerNote = async () => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', { featuredProducerNote: featuredProducerNote || null }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Producer note saved!' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save producer note' });
        } finally {
            setSaving(false);
        }
    };

    // ── Featured Content handler ──
    const handleSaveFeaturedContent = async () => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', {
                featuredContentType,
                featuredTutorialUrl: featuredTutorialUrl || null,
                featuredTutorialTitle: featuredTutorialTitle || null,
                featuredTutorialDescription: featuredTutorialDesc || null,
                featuredTutorialThumbnail: featuredTutorialThumbnail || null,
                featuredTutorialAuthor: featuredTutorialAuthor || null,
                featuredTutorialDate: featuredTutorialDate || null,
                featuredArticleId: featuredArticleId || null,
            }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Featured content saved!' });
            fetchDiscoverySettings();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save featured content' });
        } finally {
            setSaving(false);
        }
    };

    const handleSearchArticles = async (query: string) => {
        setArticleSearch(query);
        if (query.length < 2) { setArticleResults([]); return; }
        setSearchingArticles(true);
        try {
            const res = await axios.get('/api/discovery/articles/search', { params: { q: query }, withCredentials: true });
            setArticleResults(res.data.articles || []);
        } catch (err) {
            setArticleResults([]);
        } finally {
            setSearchingArticles(false);
        }
    };

    // ── Featured Battle handlers ──
    const fetchBattles = async () => {
        try {
            const res = await fetch('/api/beat-battle/battles?guildId=default-guild');
            if (res.ok) {
                const battles = await res.json();
                // Show all battles (including completed) so admins can feature any battle.
                // Sort: active phases first, then completed by most recent.
                const order: Record<string, number> = { voting: 0, sudden_death: 1, active: 2, upcoming: 3, completed: 4 };
                battles.sort((a: any, b: any) => {
                    const ord = (order[a.status] ?? 9) - (order[b.status] ?? 9);
                    if (ord !== 0) return ord;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setBattleList(battles);
            }
        } catch (err) {
            console.error('Failed to fetch battles');
        }
    };

    const handleSetFeaturedBattle = async (battleId: string | null) => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', {
                featuredBattleId: battleId,
            }, { withCredentials: true });
            setMsg({ type: 'success', text: battleId ? 'Featured battle updated!' : 'Featured battle removed.' });
            fetchDiscoverySettings();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update featured battle' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBattleDescription = async () => {
        setSaving(true);
        try {
            await axios.post('/api/discovery/settings', {
                featuredBattleDescription: featuredBattleDesc || null,
            }, { withCredentials: true });
            setMsg({ type: 'success', text: 'Battle description saved!' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save battle description' });
        } finally {
            setSaving(false);
        }
    };

    const trackSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchAdminTracks = (query: string) => {
        setAdminTrackSearch(query);
        if (query.length < 2) { setAdminTracks([]); return; }
        if (trackSearchDebounceRef.current) clearTimeout(trackSearchDebounceRef.current);
        trackSearchDebounceRef.current = setTimeout(async () => {
            setSearchingAdminTracks(true);
            try {
                const res = await axios.get('/api/admin/tracks', { params: { search: query }, withCredentials: true });
                setAdminTracks(res.data);
            } catch (err) {
                console.error('Failed to search tracks');
            } finally {
                setSearchingAdminTracks(false);
            }
        }, 300);
    };

    const handleSearchMod = async (query: string) => {
        setModSearch(query);
        if (query.length < 2) { setModProfiles([]); return; }
        setSearchingMod(true);
        try {
            const res = await axios.get('/api/admin/musician/profiles/search', { params: { search: query }, withCredentials: true });
            setModProfiles(res.data);
        } catch (err) {
            console.error('Failed to search profiles for moderation');
        } finally {
            setSearchingMod(false);
        }
    };

    const handleToggleProfileTracks = async (profileId: string) => {
        if (expandedProfileId === profileId) {
            setExpandedProfileId(null);
            return;
        }
        setExpandedProfileId(profileId);
        if (profileTracks[profileId]) return;
        setLoadingTracks(profileId);
        try {
            const res = await axios.get(`/api/admin/musician/profiles/${profileId}/tracks`, { withCredentials: true });
            setProfileTracks(prev => ({ ...prev, [profileId]: res.data }));
        } catch (err) {
            console.error('Failed to fetch tracks');
        } finally {
            setLoadingTracks(null);
        }
    };

    const handleSetProfileStatus = async (profileId: string, status: string) => {
        const reason = statusReason[profileId] || '';
        try {
            await axios.patch(`/api/admin/musician/profiles/${profileId}/status`, { status, reason }, { withCredentials: true });
            setModProfiles(prev => prev.map(p => p.id === profileId ? { ...p, status, statusReason: reason } : p));
            setMsg({ type: 'success', text: `Profile status set to "${status}".` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update status' });
        }
    };

    const handleSetTrackStatus = async (profileId: string, trackId: string, status: string) => {
        const reason = statusReason[trackId] || '';
        try {
            await axios.patch(`/api/admin/tracks/${trackId}/status`, { status, reason }, { withCredentials: true });
            setProfileTracks(prev => ({
                ...prev,
                [profileId]: (prev[profileId] || []).map((t: any) => t.id === trackId ? { ...t, status, statusReason: reason } : t)
            }));
            setMsg({ type: 'success', text: `Track status set to "${status}".` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update track status' });
        }
    };

    const handleAddGenre = async () => {
        if (!newGenreName) return;
        setSaving(true);
        try {
            await axios.post('/api/musician/genres', {
                name: newGenreName,
                parentId: newGenreParent || null
            }, { withCredentials: true });
            setNewGenreName('');
            setNewGenreParent('');
            setMsg({ type: 'success', text: 'Genre added successfully!' });
            fetchGenres();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to add genre' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGenre = (id: string) => {
        const genre = genres.find(g => g.id === id);
        setConfirmDialog({
            title: 'Delete Genre',
            message: `Are you sure you want to delete "${genre?.name || 'this genre'}"? This will affect all users with this genre!`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await axios.delete(`/api/musician/genres/${id}`, { withCredentials: true });
                    setMsg({ type: 'success', text: 'Genre deleted.' });
                    fetchGenres();
                } catch (err) {
                    setMsg({ type: 'error', text: 'Failed to delete genre' });
                }
            }
        });
    };

    if (loading) return <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading admin settings...</div>;

    // A "root" genre is any genre that does NOT have a parentId
    const rootGenres = genres.filter(g => !g.parentId);
    // A "sub" genre is any genre that DOES have a parentId
    const allSubGenres = genres.filter(g => !!g.parentId);

    return (
        <>
        <div style={{ padding: isMobile ? '24px 16px' : spacing.lg, maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Settings size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Discover & Profiles</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Discovery page settings, artist moderation, and genre management.</p>
                </div>
            </div>

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Configure the homepage discovery sections, manage artist profiles and tracks, and maintain the genre library.
                </p>
            </div>

            {msg && (
                <div style={{ padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, backgroundColor: msg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', color: msg.type === 'success' ? '#4caf50' : '#f44336' }}>
                    {msg.text}
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: spacing.lg, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, padding: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {([
                    { key: 'discover' as const, label: 'Discovery', icon: <Compass size={16} /> },
                    { key: 'profiles' as const, label: 'Profiles & Tracks', icon: <ShieldOff size={16} /> },
                    { key: 'genres' as const, label: 'Genres & Admin', icon: <List size={16} /> },
                    { key: 'settings' as const, label: 'Site Settings', icon: <Settings size={16} /> },
                ]).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setAdminTab(t.key)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: borderRadius.sm,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: adminTab === t.key ? 700 : 500,
                            backgroundColor: adminTab === t.key ? colors.primary : 'transparent',
                            color: adminTab === t.key ? '#fff' : colors.textSecondary,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {adminTab === 'discover' && (<>
            {/* Discovery Settings Section */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.xl }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.lg }}>
                    <Star size={20} color={colors.primary} /> Discovery Page Settings
                </h3>
                
                {/* Featured Type Selector */}
                <div style={{ marginBottom: spacing.lg }}>
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Featured Type (Hero Section)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {(['track', 'artist', 'playlist'] as const).map(type => (
                            <button key={type} onClick={() => handleChangeFeaturedType(type)}
                                style={{
                                    padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.sm, border: `1px solid ${discoveryConfig.featuredType === type ? colors.primary : 'rgba(255,255,255,0.1)'}`,
                                    backgroundColor: discoveryConfig.featuredType === type ? `${colors.primary}20` : 'transparent', color: discoveryConfig.featuredType === type ? colors.primary : colors.textSecondary,
                                    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize', transition: 'all 0.15s'
                                }}>
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Featured Track (shown when type = track) */}
                {discoveryConfig.featuredType === 'track' && (
                    <>
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Featured Track</label>
                            {discoveryConfig.featuredTrack ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {discoveryConfig.featuredTrack.coverUrl ? (
                                        <img src={discoveryConfig.featuredTrack.coverUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Music size={24} color={colors.textSecondary} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{discoveryConfig.featuredTrack.title}</div>
                                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
                                            by {discoveryConfig.featuredTrack.profile?.displayName || discoveryConfig.featuredTrack.profile?.username}
                                            {' '}&bull; {discoveryConfig.featuredTrack.playCount} plays
                                        </div>
                                    </div>
                                    <button onClick={() => handleSetFeaturedTrack(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginTop: '8px', color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                    No featured track set. The hero section will display a placeholder.
                                </div>
                            )}
                        </div>
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Search for a track to feature</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input type="text" value={trackSearch} onChange={(e) => handleSearchTracks(e.target.value)} placeholder="Search by track title, artist name..."
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none' }} />
                            </div>
                            {trackResults.length > 0 && (
                                <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '240px', overflowY: 'auto' }}>
                                    {trackResults.map(track => (
                                        <div key={track.id} onClick={() => handleSetFeaturedTrack(track.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            {track.coverUrl ? (
                                                <img src={track.coverUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={colors.textSecondary} /></div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{track.profile?.displayName || track.profile?.username} &bull; {track.playCount} plays</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchingTracks && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '8px' }}>Searching...</div>}
                        </div>
                    </>
                )}

                {/* Featured Artist (shown when type = artist) */}
                {discoveryConfig.featuredType === 'artist' && (
                    <>
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Featured Artist</label>
                            {discoveryConfig.featuredArtist ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {discoveryConfig.featuredArtist.avatar ? (
                                        <img src={discoveryConfig.featuredArtist.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Music size={24} color={colors.textSecondary} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{discoveryConfig.featuredArtist.displayName || discoveryConfig.featuredArtist.username}</div>
                                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>@{discoveryConfig.featuredArtist.username}</div>
                                    </div>
                                    <button onClick={() => handleSetFeaturedArtist(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginTop: '8px', color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                    No featured artist set.
                                </div>
                            )}
                        </div>
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Search for an artist to feature</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input type="text" value={artistSearch} onChange={(e) => handleSearchArtists(e.target.value)} placeholder="Search by artist name..."
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none' }} />
                            </div>
                            {artistResults.length > 0 && (
                                <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '240px', overflowY: 'auto' }}>
                                    {artistResults.map((artist: any) => (
                                        <div key={artist.id} onClick={() => handleSetFeaturedArtist(artist.userId)}
                                            style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            {artist.avatar ? (
                                                <img src={artist.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={colors.textSecondary} /></div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.displayName || artist.username}</div>
                                                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>@{artist.username}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchingArtists && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '8px' }}>Searching...</div>}
                        </div>
                    </>
                )}

                {/* Featured Playlist (shown when type = playlist) */}
                {discoveryConfig.featuredType === 'playlist' && (
                    <>
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Featured Playlist</label>
                            {discoveryConfig.featuredPlaylist ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {discoveryConfig.featuredPlaylist.coverUrl ? (
                                        <img src={discoveryConfig.featuredPlaylist.coverUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Music size={24} color={colors.textSecondary} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{discoveryConfig.featuredPlaylist.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
                                            by {discoveryConfig.featuredPlaylist.profile?.displayName || discoveryConfig.featuredPlaylist.profile?.username}
                                            {' '}&bull; {discoveryConfig.featuredPlaylist._count?.tracks ?? 0} tracks
                                        </div>
                                    </div>
                                    <button onClick={() => handleSetFeaturedPlaylist(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginTop: '8px', color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                    No featured playlist set.
                                </div>
                            )}
                        </div>
                        <div style={{ marginBottom: spacing.lg }}>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Search for a playlist to feature</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input type="text" value={playlistSearch} onChange={(e) => handleSearchPlaylists(e.target.value)} placeholder="Search by playlist name..."
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none' }} />
                            </div>
                            {playlistResults.length > 0 && (
                                <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '240px', overflowY: 'auto' }}>
                                    {playlistResults.map((pl: any) => (
                                        <div key={pl.id} onClick={() => handleSetFeaturedPlaylist(pl.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            {pl.coverUrl ? (
                                                <img src={pl.coverUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} color={colors.textSecondary} /></div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{pl.profile?.displayName || pl.profile?.username} &bull; {pl._count?.tracks ?? 0} tracks</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchingPlaylists && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '8px' }}>Searching...</div>}
                        </div>
                    </>
                )}

                {/* Featured Label */}
                <div style={{ marginBottom: spacing.lg }}>
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Hero Section Label (optional)</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <input
                            type="text"
                            value={featuredLabel}
                            onChange={(e) => setFeaturedLabel(e.target.value)}
                            placeholder='e.g. "Track of the Week"'
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none' }}
                        />
                        <button onClick={handleSaveFeaturedLabel} disabled={saving}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            Save
                        </button>
                    </div>
                </div>

                {/* Featured Description */}
                <div>
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Hero Description (shown under the title on the homepage)</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <textarea
                            value={featuredHeroDesc}
                            onChange={(e) => setFeaturedHeroDesc(e.target.value)}
                            rows={2}
                            placeholder='e.g. "A collection of our favourite summer vibes from the community..."'
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <button onClick={handleSaveFeaturedDescription} disabled={saving}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                            Save
                        </button>
                    </div>
                </div>


                {/* ── Trending Artist Override ── */}
                <div style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <TrendingUp size={16} color="#FBBF24" /> Trending Artist Override
                    </h4>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: colors.textSecondary }}>
                        Pin a specific artist as "Trending" on the front page. Invisible to the audience — they see the artist as naturally trending.
                    </p>
                    {/* Current override */}
                    {(discoveryConfig as any).trendingArtistOverride ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: borderRadius.sm, marginBottom: spacing.md, border: '1px solid rgba(251,191,36,0.2)' }}>
                            {(discoveryConfig as any).trendingArtistOverride.avatar ? (
                                <img src={(discoveryConfig as any).trendingArtistOverride.avatar.startsWith('http') ? (discoveryConfig as any).trendingArtistOverride.avatar : `https://cdn.discordapp.com/avatars/${(discoveryConfig as any).trendingArtistOverride.userId}/${(discoveryConfig as any).trendingArtistOverride.avatar}.png`} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={colors.textSecondary} /></div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{(discoveryConfig as any).trendingArtistOverride.displayName || (discoveryConfig as any).trendingArtistOverride.username}</div>
                                <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>@{(discoveryConfig as any).trendingArtistOverride.username} · <span style={{ color: '#FBBF24' }}>Pinned</span></div>
                            </div>
                            <button onClick={() => handleSetTrendingOverride(null)} title="Clear override" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginBottom: spacing.md, color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            Auto — showing highest-play artist.
                        </div>
                    )}
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: spacing.sm }}>
                        <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input type="text" value={trendingSearch} onChange={e => handleSearchTrending(e.target.value)} placeholder="Search artist to pin..."
                            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none' }} />
                    </div>
                    {trendingResults.length > 0 && (
                        <div style={{ marginBottom: spacing.md, border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '200px', overflowY: 'auto' }}>
                            {trendingResults.map((p: any) => (
                                <div key={p.id} onClick={() => handleSetTrendingOverride(p.userId)}
                                    style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    {p.avatar ? (
                                        <img src={p.avatar.startsWith('http') ? p.avatar : `https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png`} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={colors.textSecondary} /></div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.displayName || p.username}</div>
                                        <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>@{p.username}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {searchingTrending && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '8px' }}>Searching...</div>}
                </div>

                {/* ── Global Brand Partners ── */}
                <div style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <Building2 size={16} color={colors.primary} /> Brand Partners
                    </h4>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: colors.textSecondary }}>
                        Choose which sponsors appear on the front page and battles page, and drag them into the order you want.
                    </p>

                    {/* Section title */}
                    <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
                        <input
                            value={globalSponsorTitle}
                            onChange={e => setGlobalSponsorTitle(e.target.value)}
                            placeholder='Section title (e.g. "Our Partners")'
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', fontSize: '0.85rem' }}
                        />
                    </div>

                    {/* Current ordered list */}
                    {globalSponsorIds.length > 0 ? (
                        <div style={{ marginBottom: spacing.md, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {globalSponsorIds.map((id, idx) => {
                                const s = allSponsors.find(sp => sp.id === id);
                                if (!s) return null;
                                return (
                                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.08)' }}>
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt={s.name} style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
                                        ) : (
                                            <div style={{ width: 32, height: 32, borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: colors.textSecondary }}>{s.name[0]}</div>
                                        )}
                                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem' }}>{s.name}</span>
                                        {/* Reorder */}
                                        <button onClick={() => { const a = [...globalSponsorIds]; if (idx > 0) { [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; setGlobalSponsorIds(a); } }} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? colors.textTertiary : colors.textSecondary, cursor: idx === 0 ? 'default' : 'pointer', padding: '2px 4px' }}>↑</button>
                                        <button onClick={() => { const a = [...globalSponsorIds]; if (idx < a.length - 1) { [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; setGlobalSponsorIds(a); } }} disabled={idx === globalSponsorIds.length - 1} style={{ background: 'none', border: 'none', color: idx === globalSponsorIds.length - 1 ? colors.textTertiary : colors.textSecondary, cursor: idx === globalSponsorIds.length - 1 ? 'default' : 'pointer', padding: '2px 4px' }}>↓</button>
                                        <button onClick={() => setGlobalSponsorIds(globalSponsorIds.filter(i => i !== id))} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', padding: '2px 4px' }}><X size={14} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginBottom: spacing.md, color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            No sponsors selected. Pick from the list below.
                        </div>
                    )}

                    {/* Sponsor picker — shows all sponsors; already-added ones are marked */}
                    <div style={{ marginBottom: spacing.sm }}>
                        <input
                            value={sponsorPickSearch}
                            onChange={e => setSponsorPickSearch(e.target.value)}
                            placeholder="Search sponsors..."
                            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '200px', overflowY: 'auto', marginBottom: spacing.md }}>
                        {allSponsors.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: colors.textTertiary, fontSize: '0.8rem' }}>No sponsors found. Create sponsors in the Battles tab first.</div>
                        ) : (() => {
                            const filtered = allSponsors.filter(s => !sponsorPickSearch || s.name.toLowerCase().includes(sponsorPickSearch.toLowerCase()));
                            if (filtered.length === 0) return <div style={{ padding: '12px', textAlign: 'center', color: colors.textTertiary, fontSize: '0.8rem' }}>No sponsors match "{sponsorPickSearch}"</div>;
                            return filtered.map(s => {
                                const already = globalSponsorIds.includes(s.id);
                                return (
                                    <div key={s.id}
                                        onClick={() => { if (!already) setGlobalSponsorIds([...globalSponsorIds, s.id]); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: already ? 'default' : 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: already ? 0.45 : 1 }}
                                        onMouseOver={e => { if (!already) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                        onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt={s.name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
                                        ) : (
                                            <div style={{ width: 28, height: 28, borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: colors.textSecondary }}>{s.name[0]}</div>
                                        )}
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{s.name}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: already ? colors.textTertiary : colors.primary }}>{already ? 'Added' : '+ Add'}</span>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    <button onClick={() => handleSaveGlobalSponsors(globalSponsorIds, globalSponsorTitle)} disabled={saving}
                        style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        Save Brand Partners
                    </button>
                </div>

                {/* ── Featured Producer ── */}
                <div style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <Star size={16} color={colors.primary} /> Featured Producer
                    </h4>
                    {/* Current */}
                    {discoveryConfig.featuredProducer ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, marginBottom: spacing.md, border: '1px solid rgba(255,255,255,0.08)' }}>
                            {discoveryConfig.featuredProducer.avatar ? (
                                <img src={discoveryConfig.featuredProducer.avatar.startsWith('http') ? discoveryConfig.featuredProducer.avatar : `https://cdn.discordapp.com/avatars/${discoveryConfig.featuredProducer.userId}/${discoveryConfig.featuredProducer.avatar}.png`} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={colors.textSecondary} /></div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{discoveryConfig.featuredProducer.displayName || discoveryConfig.featuredProducer.username}</div>
                                <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>@{discoveryConfig.featuredProducer.username}</div>
                            </div>
                            <button onClick={() => handleSetFeaturedProducer(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginBottom: spacing.md, color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            No featured producer set.
                        </div>
                    )}
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: spacing.sm }}>
                        <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input type="text" value={producerSearch} onChange={(e) => handleSearchProducer(e.target.value)} placeholder="Search artist by name..."
                            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none' }} />
                    </div>
                    {producerResults.length > 0 && (
                        <div style={{ marginBottom: spacing.md, border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '200px', overflowY: 'auto' }}>
                            {producerResults.map((p: any) => (
                                <div key={p.id} onClick={() => handleSetFeaturedProducer(p.userId)}
                                    style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    {p.avatar ? (
                                        <img src={p.avatar.startsWith('http') ? p.avatar : `https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png`} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={colors.textSecondary} /></div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.displayName || p.username}</div>
                                        <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>@{p.username}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {searchingProducer && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '8px' }}>Searching...</div>}
                    {/* Note */}
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Producer Note (shown on homepage)</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <textarea value={featuredProducerNote} onChange={(e) => setFeaturedProducerNote(e.target.value)} placeholder='e.g. "Making beats since 2019..."'
                            rows={2}
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                        <button onClick={handleSaveProducerNote} disabled={saving}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                            Save
                        </button>
                    </div>
                </div>

                {/* ── Featured Content ── */}
                <div style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <MonitorPlay size={16} color={colors.primary} /> Featured Content Card
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, margin: `0 0 ${spacing.md}`, lineHeight: 1.6 }}>
                        Choose what type of content appears in the frontpage feature card. The card spans the full width of the lower grid on the discovery page.
                    </p>

                    {/* Content Type Selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: spacing.lg }}>
                        {([
                            { id: 'video' as const, icon: <MonitorPlay size={18} />, label: 'Video', color: colors.primary },
                            { id: 'news' as const, icon: <Newspaper size={18} />, label: 'News', color: '#A78BFA' },
                            { id: 'guide' as const, icon: <BookOpen size={18} />, label: 'Guide', color: '#FBBF24' },
                            { id: 'article' as const, icon: <FileText size={18} />, label: 'Article', color: '#F5A04A' },
                        ]).map(opt => (
                            <button key={opt.id} onClick={() => setFeaturedContentType(opt.id)}
                                style={{
                                    background: featuredContentType === opt.id ? `${opt.color}14` : 'rgba(255,255,255,0.03)',
                                    border: `1.5px solid ${featuredContentType === opt.id ? opt.color + '60' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: borderRadius.sm, padding: '12px', cursor: 'pointer', textAlign: 'left',
                                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
                                }}>
                                <span style={{ color: featuredContentType === opt.id ? opt.color : colors.textSecondary }}>{opt.icon}</span>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: featuredContentType === opt.id ? colors.textPrimary : colors.textSecondary }}>{opt.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Video / News / Guide Fields */}
                    {featuredContentType !== 'article' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>
                                    {featuredContentType === 'video' ? 'Video URL (YouTube or direct link)' : featuredContentType === 'news' ? 'News Link URL' : 'Guide Link URL'}
                                </label>
                                <input type="url" value={featuredTutorialUrl} onChange={(e) => setFeaturedTutorialUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Title</label>
                                <input type="text" value={featuredTutorialTitle} onChange={(e) => setFeaturedTutorialTitle(e.target.value)}
                                    placeholder='e.g. "How to Mix Bass in FL Studio"'
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Description (optional)</label>
                                <textarea value={featuredTutorialDesc} onChange={(e) => setFeaturedTutorialDesc(e.target.value)}
                                    placeholder="A short blurb shown under the title on the frontpage card..."
                                    rows={2}
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Thumbnail URL (optional — auto-detected from YouTube)</label>
                                <input type="url" value={featuredTutorialThumbnail} onChange={(e) => setFeaturedTutorialThumbnail(e.target.value)}
                                    placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg"
                                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Author (optional)</label>
                                    <input type="text" value={featuredTutorialAuthor} onChange={(e) => setFeaturedTutorialAuthor(e.target.value)}
                                        placeholder="e.g. Mowgi"
                                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Date (optional)</label>
                                    <input type="text" value={featuredTutorialDate} onChange={(e) => setFeaturedTutorialDate(e.target.value)}
                                        placeholder="e.g. March 23, 2026"
                                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Article Selection */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            {featuredArticle && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: spacing.md, background: 'rgba(245, 160, 74,0.06)', border: '1px solid rgba(245, 160, 74,0.2)', borderRadius: borderRadius.sm }}>
                                    {featuredArticle.coverImageUrl && (
                                        <img src={featuredArticle.coverImageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: borderRadius.sm, flexShrink: 0 }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featuredArticle.title}</div>
                                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>by {featuredArticle.authorName} · {featuredArticle.category}</div>
                                    </div>
                                    <button onClick={() => { setFeaturedArticleId(null); setFeaturedArticle(null); }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                            <div>
                                <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Search Published Articles</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input type="text" value={articleSearch} onChange={(e) => handleSearchArticles(e.target.value)}
                                        placeholder="Type to search articles by title..."
                                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                {searchingArticles && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '8px' }}>Searching...</div>}
                                {articleResults.length > 0 && (
                                    <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '200px', overflowY: 'auto' }}>
                                        {articleResults.map((a: any) => (
                                            <div key={a.id} onClick={() => { setFeaturedArticleId(a.id); setFeaturedArticle(a); setArticleSearch(''); setArticleResults([]); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                {a.coverImageUrl && (
                                                    <img src={a.coverImageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                                                    <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>{a.authorName} · {a.category}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {!featuredArticle && !articleSearch && (
                                <p style={{ margin: 0, fontSize: '0.8rem', color: colors.textSecondary, fontStyle: 'italic' }}>
                                    Search for a published article above to feature it on the frontpage.
                                </p>
                            )}
                        </div>
                    )}

                    <div style={{ marginTop: spacing.md }}>
                        <button onClick={handleSaveFeaturedContent} disabled={saving}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            Save Featured Content
                        </button>
                    </div>
                </div>

                {/* ── Featured Battle ── */}
                <div style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <Swords size={16} color={colors.primary} /> Featured Battle
                    </h4>
                    {/* Current */}
                    {discoveryConfig.featuredBattle ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.sm, marginBottom: spacing.md, border: '1px solid rgba(255,255,255,0.08)' }}>
                            <Swords size={20} color={colors.primary} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{discoveryConfig.featuredBattle.title}</div>
                                <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{discoveryConfig.featuredBattle.status}</div>
                            </div>
                            <button onClick={() => handleSetFeaturedBattle(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '8px' }}>
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginBottom: spacing.md, color: colors.textSecondary, fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            No featured battle set. Select one below.
                        </div>
                    )}
                    {/* Battle list */}
                    {battleList.length > 0 && (
                        <div style={{ marginBottom: spacing.md, border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.sm, maxHeight: '260px', overflowY: 'auto' }}>
                            {battleList.map((b: any) => {
                                const statusColors: Record<string, string> = { voting: '#F97316', sudden_death: '#F43F5E', active: '#F5A04A', upcoming: '#60A5FA', completed: '#6B7280' };
                                const statusLabels: Record<string, string> = { voting: 'VOTING', sudden_death: 'SUDDEN DEATH', active: 'OPEN', upcoming: 'UPCOMING', completed: 'ENDED' };
                                const sc = statusColors[b.status] || '#6B7280';
                                const sl = statusLabels[b.status] || b.status.toUpperCase();
                                const isSelected = discoveryConfig.featuredBattle?.id === b.id;
                                return (
                                    <div key={b.id} onClick={() => handleSetFeaturedBattle(b.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: isSelected ? 'rgba(43,140,113,0.1)' : 'transparent' }}
                                        onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseOut={e => e.currentTarget.style.backgroundColor = isSelected ? 'rgba(43,140,113,0.1)' : 'transparent'}>
                                        <Swords size={14} color={colors.textSecondary} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                                            <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>{b._count?.entries ?? 0} entries</div>
                                        </div>
                                        <span style={{ fontSize: '9px', fontWeight: 800, color: sc, backgroundColor: `${sc}20`, padding: '3px 7px', borderRadius: '999px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                            {sl}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {battleList.length === 0 && (
                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: spacing.md }}>No battles found. Create one in the Beat Battle plugin first.</div>
                    )}
                    {/* Description */}
                    <label style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>Battle Description (shown on homepage card)</label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <textarea value={featuredBattleDesc} onChange={(e) => setFeaturedBattleDesc(e.target.value)} placeholder='e.g. "Submit your best beats and compete for prizes!"'
                            rows={2}
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                        <button onClick={handleSaveBattleDescription} disabled={saving}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                            Save
                        </button>
                    </div>
                </div>

            </div>
            </>)}

            {adminTab === 'profiles' && (<>
            {/* Admin Track Management */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.xl }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.md }}>
                    <Edit3 size={20} color={colors.primary} /> Track Management
                </h3>
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>
                    Search for any track to view or edit it. You can modify metadata, re-upload files, or fix BPM on the track page.
                </p>
                <div style={{ position: 'relative', marginBottom: spacing.md }}>
                    <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={adminTrackSearch}
                        onChange={(e) => handleSearchAdminTracks(e.target.value)}
                        placeholder="Search tracks by title, artist, or username..."
                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {searchingAdminTracks && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '8px' }}>Searching...</div>}
                {adminTracks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {adminTracks.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.05)' }}>
                                {t.coverUrl ? (
                                    <img src={t.coverUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Music size={18} color={colors.textSecondary} />
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                                        by {t.profile?.displayName || t.profile?.username} &bull; {t.playCount} plays
                                    </div>
                                </div>
                                <a
                                    href={`/track/${t.profile?.username}/${t.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.primary, border: `1px solid ${colors.primary}33`, borderRadius: borderRadius.sm, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    <ExternalLink size={14} /> View & Edit
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Artist Moderation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.xl, border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: spacing.md }}>
                    <ShieldOff size={20} color="#ff9800" /> Artist Moderation
                </h3>
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>
                    Suspend or ban artists to hide their profile and all tracks from public view. Suspended accounts can be reinstated at any time. Banned accounts are treated the same but indicated as a permanent action.
                </p>
                <div style={{ position: 'relative', marginBottom: spacing.md }}>
                    <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={modSearch}
                        onChange={(e) => handleSearchMod(e.target.value)}
                        placeholder="Search by username, display name, or Discord ID..."
                        style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm, padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`, color: colors.textPrimary, outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {searchingMod && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '8px' }}>Searching...</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modProfiles.map(p => {
                        const isExpanded = expandedProfileId === p.id;
                        const statusColor = p.status === 'active' ? '#4caf50' : p.status === 'banned' ? '#f44336' : '#ff9800';
                        const statusBg = p.status === 'active' ? 'rgba(76,175,80,0.1)' : p.status === 'banned' ? 'rgba(244,67,54,0.1)' : 'rgba(255,152,0,0.1)';
                        return (
                            <div key={p.id} style={{ border: `1px solid rgba(255,255,255,0.07)`, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                                {/* Profile Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#242C3D', overflow: 'hidden', flexShrink: 0 }}>
                                        {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserX size={16} color={colors.textSecondary} /></div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {p.displayName || p.username}
                                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: statusBg, color: statusColor, textTransform: 'uppercase' }}>{p.status || 'active'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{p._count?.tracks ?? '?'} tracks • @{p.username}</div>
                                        {p.statusReason && <div style={{ fontSize: '0.7rem', color: '#ff9800', marginTop: '2px' }}>Reason: {p.statusReason}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                        <button onClick={() => navigate(`/profile/edit?adminTarget=${p.userId}`)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textPrimary, border: '1px solid rgba(255,255,255,0.12)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            <Edit3 size={13} /> Edit Profile
                                        </button>
                                        {(p.status !== 'active') && (
                                            <button onClick={() => handleSetProfileStatus(p.id, 'active')}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(76,175,80,0.1)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <UserCheck size={13} /> Reinstate
                                            </button>
                                        )}
                                        {(p.status !== 'suspended') && (
                                            <button onClick={() => handleSetProfileStatus(p.id, 'suspended')}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,152,0,0.1)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <ShieldOff size={13} /> Suspend
                                            </button>
                                        )}
                                        {(p.status !== 'banned') && (
                                            <button onClick={() => handleSetProfileStatus(p.id, 'banned')}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.3)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <UserX size={13} /> Ban
                                            </button>
                                        )}
                                        <button onClick={() => setConfirmDeleteMod({ id: p.id, name: p.displayName || p.username })}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.4)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            <Trash2 size={13} /> Delete
                                        </button>
                                        <button onClick={() => handleToggleProfileTracks(p.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Tracks
                                        </button>
                                    </div>
                                </div>
                                {/* Reason Input */}
                                <div style={{ padding: '6px 12px', backgroundColor: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <input
                                        type="text"
                                        placeholder="Optional reason / note for this action..."
                                        value={statusReason[p.id] || ''}
                                        onChange={(e) => setStatusReason(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        style={{ width: '100%', backgroundColor: 'transparent', border: 'none', outline: 'none', color: colors.textSecondary, fontSize: '12px', padding: '2px 0', boxSizing: 'border-box' }}
                                    />
                                </div>
                                {/* Expanded Tracks */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px' }}>
                                        {loadingTracks === p.id && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, padding: '8px 0' }}>Loading tracks...</div>}
                                        {profileTracks[p.id]?.length === 0 && <div style={{ fontSize: '0.8rem', color: colors.textSecondary, padding: '8px 0', fontStyle: 'italic' }}>No tracks.</div>}
                                        {(profileTracks[p.id] || []).map((t: any) => {
                                            const tStatusColor = t.status === 'active' ? '#4caf50' : t.status === 'deleted' ? '#f44336' : '#ff9800';
                                            const tStatusBg = t.status === 'active' ? 'rgba(76,175,80,0.1)' : t.status === 'deleted' ? 'rgba(244,67,54,0.1)' : 'rgba(255,152,0,0.1)';
                                            return (
                                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                    {t.coverUrl ? (
                                                        <img src={t.coverUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                                                    ) : (
                                                        <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Music size={14} color={colors.textSecondary} />
                                                        </div>
                                                    )}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {t.title}
                                                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 99, backgroundColor: tStatusBg, color: tStatusColor, textTransform: 'uppercase', flexShrink: 0 }}>{t.status || 'active'}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: colors.textSecondary }}>{t.playCount} plays</div>
                                                        {t.statusReason && <div style={{ fontSize: '0.7rem', color: '#ff9800' }}>Reason: {t.statusReason}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Reason..."
                                                            value={statusReason[t.id] || ''}
                                                            onChange={(e) => setStatusReason(prev => ({ ...prev, [t.id]: e.target.value }))}
                                                            style={{ width: '100px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', outline: 'none', color: colors.textSecondary, fontSize: '11px', padding: '3px 6px' }}
                                                        />
                                                        {t.status !== 'active' && (
                                                            <button onClick={() => handleSetTrackStatus(p.id, t.id, 'active')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(76,175,80,0.1)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                <UserCheck size={11} /> Reinstate
                                                            </button>
                                                        )}
                                                        {t.status !== 'suspended' && (
                                                            <button onClick={() => handleSetTrackStatus(p.id, t.id, 'suspended')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(255,152,0,0.1)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                <ShieldOff size={11} /> Suspend
                                                            </button>
                                                        )}
                                                        {t.status !== 'deleted' && (
                                                            <button onClick={() => handleSetTrackStatus(p.id, t.id, 'deleted')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                <Trash2 size={11} /> Soft Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            </>)}

            {adminTab === 'genres' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.xl }}>
                {/* Genre Library */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <List size={20} /> Current Library
                    </h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
                        {rootGenres.length === 0 && <p style={{ color: colors.textSecondary }}>No genres configured.</p>}
                        
                        {rootGenres.map(parent => (
                            <div key={parent.id} style={{ 
                                marginBottom: spacing.sm, 
                                border: '1px solid rgba(255,255,255,0.05)', 
                                borderRadius: borderRadius.sm,
                                backgroundColor: 'rgba(255,255,255,0.02)'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    fontWeight: 'bold', 
                                    padding: '10px 12px', 
                                    borderBottom: '1px solid rgba(255,255,255,0.05)' 
                                }}>
                                    <span style={{ color: colors.primary }}>{parent.name}</span>
                                    <Trash2 size={16} style={{ cursor: 'pointer', color: '#ff4444', opacity: 0.6 }} onClick={() => handleDeleteGenre(parent.id)} />
                                </div>
                                <div style={{ padding: '4px 0 8px 12px' }}>
                                    {genres.filter(g => g.parentId === parent.id).map(sub => (
                                        <div key={sub.id} style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            padding: '8px 12px', 
                                            fontSize: '0.9rem', 
                                            color: colors.textSecondary,
                                            borderBottom: '1px solid rgba(255,255,255,0.03)'
                                        }}>
                                            <span>• {sub.name}</span>
                                            <Trash2 size={14} style={{ cursor: 'pointer', color: '#ff4444', opacity: 0.4 }} onClick={() => handleDeleteGenre(sub.id)} />
                                        </div>
                                    ))}
                                    {genres.filter(g => g.parentId === parent.id).length === 0 && (
                                        <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: colors.textSecondary, fontStyle: 'italic', opacity: 0.5 }}>
                                            No sub-genres
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Orphans or Deeply Nested (Fallback) */}
                        {allSubGenres.filter(sub => !genres.some(p => p.id === sub.parentId)).length > 0 && (
                            <div style={{ marginTop: spacing.lg }}>
                                <h4 style={{ fontSize: '0.8rem', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Other Categories</h4>
                                {allSubGenres.filter(sub => !genres.some(p => p.id === sub.parentId)).map(sub => (
                                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, marginBottom: '4px' }}>
                                        <span style={{ color: colors.textSecondary }}>{sub.name} (ID: {sub.parentId})</span>
                                        <Trash2 size={14} style={{ cursor: 'pointer', color: '#ff4444' }} onClick={() => handleDeleteGenre(sub.id)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Add New Genre */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={20} /> Add New Genre
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Genre Name</label>
                            <input 
                                type="text" 
                                value={newGenreName} 
                                onChange={(e) => setNewGenreName(e.target.value)}
                                placeholder="e.g. Future Bass"
                                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: spacing.sm, color: colors.textPrimary, marginTop: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Parent Category (Optional)</label>
                            <select 
                                value={newGenreParent} 
                                onChange={(e) => setNewGenreParent(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    border: 'none', 
                                    borderRadius: borderRadius.sm, 
                                    padding: spacing.sm, 
                                    color: colors.textPrimary, 
                                    marginTop: '4px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>None (Top Level)</option>
                                {rootGenres.map(g => (
                                    <option key={g.id} value={g.id} style={{ backgroundColor: colors.surface, color: colors.textPrimary }}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleAddGenre}
                            disabled={saving || !newGenreName}
                            style={{ backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: borderRadius.sm, padding: spacing.md, cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {saving ? 'Saving...' : 'Create Genre'}
                        </button>
                    </div>
                </div>

                {/* --- Admin: User Cleanup & Wipe --- */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: '1px solid rgba(255, 68, 68, 0.2)' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444' }}>
                        <Trash2 size={20} /> Wipe Musician Profile
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: spacing.md }}>
                        Search for a musician to completely delete their profile, all tracks, album artwork, and profile photos. 
                        <strong> This action is irreversible and will be logged.</strong>
                    </p>
                    
                    <div style={{ position: 'relative', marginBottom: spacing.md }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} />
                        <input 
                            type="text" 
                            value={adminSearch} 
                            onChange={(e) => handleSearchProfiles(e.target.value)}
                            placeholder="Search by username, real name, or Discord ID..."
                            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: borderRadius.sm, padding: '10px 10px 10px 40px', color: colors.textPrimary }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {searchingProfiles && <p style={{ fontSize: '0.8rem', color: colors.textSecondary }}>Searching...</p>}
                        {adminProfiles.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#242C3D', overflow: 'hidden' }}>
                                        {p.avatar ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Search size={16} style={{ margin: '8px' }} />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{p.displayName || p.username}</div>
                                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{p._count.tracks} tracks • ID: {p.userId}</div>
                                    </div>
                                </div>
                                
                                {confirmWipe === p.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '260px' }}>
                                        <input
                                            type="text"
                                            placeholder="Reason (optional)"
                                            value={wipeReason}
                                            onChange={e => setWipeReason(e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: colors.textPrimary, fontSize: '12px' }}
                                        />
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textSecondary, cursor: 'pointer' }}>
                                            <input type="checkbox" checked={wipeSendEmail} onChange={e => setWipeSendEmail(e.target.checked)} style={{ accentColor: colors.error }} />
                                            Send termination email
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => handleWipeProfile(p.id)}
                                                style={{ backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                CONFIRM DELETE
                                            </button>
                                            <button
                                                onClick={() => { setConfirmWipe(null); setWipeReason(''); setWipeSendEmail(false); }}
                                                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                                CANCEL
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => navigate(`/profile/edit?adminTarget=${p.userId}`)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textPrimary, border: '1px solid rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            <Edit3 size={13} /> Edit
                                        </button>
                                        <button 
                                            onClick={() => setConfirmWipe(p.id)}
                                            style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', border: '1px solid rgba(255, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            WIPE PROFILE
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            </>)}

            {adminTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {/* Auto-follow Card */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: spacing.md }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserPlus size={18} color={colors.primary} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>Auto-Follow Profile</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textSecondary }}>This profile automatically follows every new musician that joins Fuji Studio.</p>
                        </div>
                    </div>

                    {autoFollowProfile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: spacing.md }}>
                            {autoFollowProfile.avatar ? (
                                <img src={autoFollowProfile.avatar.startsWith('http') || autoFollowProfile.avatar.startsWith('/') ? autoFollowProfile.avatar : `https://cdn.discordapp.com/avatars/${autoFollowProfile.id}/${autoFollowProfile.avatar}.png?size=64`}
                                    alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                                    {(autoFollowProfile.displayName || autoFollowProfile.username)[0].toUpperCase()}
                                </div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '14px' }}>{autoFollowProfile.displayName || autoFollowProfile.username}</div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary }}>@{autoFollowProfile.username}</div>
                            </div>
                            <button onClick={clearAutoFollowProfile} disabled={savingAutoFollow} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Remove
                            </button>
                        </div>
                    ) : (
                        <p style={{ margin: '0 0 12px', fontSize: '13px', color: colors.textSecondary }}>No auto-follow profile set. Search for a profile below to configure one.</p>
                    )}

                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: borderRadius.md, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                            {searchingAutoFollow ? <Loader2 size={14} color={colors.textSecondary} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} color={colors.textSecondary} />}
                            <input
                                value={autoFollowSearch}
                                onChange={e => searchAutoFollowProfiles(e.target.value)}
                                placeholder="Search profiles by username..."
                                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: '13px' }}
                            />
                        </div>
                        {autoFollowResults.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, zIndex: 10, marginTop: 4, overflow: 'hidden' }}>
                                {autoFollowResults.slice(0, 8).map(p => (
                                    <button key={p.id} onClick={() => saveAutoFollowProfile(p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        {p.avatar ? (
                                            <img src={p.avatar.startsWith('http') || p.avatar.startsWith('/') ? p.avatar : `https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png?size=64`}
                                                alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                                                {(p.displayName || p.username)[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: '13px' }}>{p.displayName || p.username}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>@{p.username}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
            )}

        </div>
        <ConfirmModal
            open={!!confirmDialog}
            title={confirmDialog?.title}
            message={confirmDialog?.message || ''}
            confirmLabel="Confirm"
            onConfirm={() => confirmDialog?.onConfirm()}
            onCancel={() => setConfirmDialog(null)}
        />
        <ConfirmModal
            open={!!confirmDeleteMod}
            title="Delete Profile"
            message={`Permanently delete ${confirmDeleteMod?.name}'s profile, all their tracks, artwork, and files? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            onConfirm={() => confirmDeleteMod && handleDeleteFromMod(confirmDeleteMod.id)}
            onCancel={() => { setConfirmDeleteMod(null); setDeleteModReason(''); setDeleteModSendEmail(false); }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#B9C3CE', marginBottom: '4px' }}>Reason (optional)</label>
                    <textarea
                        rows={2}
                        placeholder="e.g. AI-generated music, TOS violation..."
                        value={deleteModReason}
                        onChange={e => setDeleteModReason(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#F8FAFC', fontSize: '13px', resize: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B9C3CE', cursor: 'pointer' }}>
                    <input type="checkbox" checked={deleteModSendEmail} onChange={e => setDeleteModSendEmail(e.target.checked)} style={{ accentColor: '#EF4444', width: '15px', height: '15px' }} />
                    Send termination email to user
                </label>
            </div>
        </ConfirmModal>
        </>
    );
};
