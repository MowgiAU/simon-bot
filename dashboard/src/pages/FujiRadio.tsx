import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
  Radio, Play, Square, SkipForward, Volume2, Settings, History, Search, Plus, Trash2,
  Check, X, Megaphone, Music, Users, Clock, Disc3, GripVertical, Pause, Mic, MicOff,
  AlertCircle, Zap, ArrowUp, ArrowDown, RotateCcw,
} from 'lucide-react';
import { ChannelSelect } from '../components/ChannelSelect';

const API = import.meta.env.VITE_API_URL || '';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RadioSettings {
  guildId: string;
  voiceChannelId: string | null;
  textChannelId: string | null;
  autoEnabled: boolean;
  autoSource: string;
  autoGenreFilter: string | null;
  ttsAnnounce: boolean;
  adsEnabled: boolean;
  adFrequency: number;
  adTtsDefault: string | null;
  listenerXpEnabled: boolean;
  listenerXpPerMinute: number;
  listenerCoinEnabled: boolean;
  listenerCoinsPerMinute: number;
  tipEnabled: boolean;
  minTipAmount: number;
  defaultVolume: number;
  duckVolume: number;
  startRoleIds: string[];
  stopRoleIds: string[];
  skipRoleIds: string[];
  hostRoleIds: string[];
}

interface GuildRole {
  id: string;
  name: string;
  color: number;
}

interface QueueEntry {
  id: string;
  trackId: string;
  addedBy: string | null;
  position: number;
  track: {
    id: string;
    title: string;
    coverUrl: string | null;
    duration: number;
    profile: { displayName: string | null; username: string; avatar: string | null };
  };
}

interface HistoryEntry {
  id: string;
  trackTitle: string;
  artistName: string;
  coverUrl: string | null;
  duration: number;
  listenCount: number;
  isAd: boolean;
  playedAt: string;
}

interface TrackResult {
  id: string;
  title: string;
  coverUrl: string | null;
  duration: number;
  playCount: number;
  profile: { displayName: string | null; username: string; avatar: string | null };
}

interface AdSlot {
  id: string;
  userId: string;
  adType: string;
  adText: string | null;
  audioUrl: string | null;
  costPaid: number;
  playsLeft: number;
  approved: boolean;
  active: boolean;
  createdAt: string;
}

interface LiveState {
  online: boolean;
  nowPlaying: {
    trackTitle: string;
    artistName: string;
    coverUrl: string | null;
    duration: number;
    playedAt: string;
    listenCount: number;
  } | null;
  queueCount: number;
  settings: RadioSettings | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

type Tab = 'deck' | 'settings' | 'history' | 'ads';

export const FujiRadioPage: React.FC = () => {
  const { selectedGuild, token } = useAuth();
  const guildId = selectedGuild?.id;

  const [tab, setTab] = useState<Tab>('deck');
  const [settings, setSettings] = useState<RadioSettings | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ads, setAds] = useState<AdSlot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [defaultVolumeLocal, setDefaultVolumeLocal] = useState<number | null>(null);
  const [duckVolumeLocal, setDuckVolumeLocal] = useState<number | null>(null);
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const saveQueueRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Load data ──
  useEffect(() => {
    if (!guildId) return;
    setLoading(true);

    Promise.all([
      fetch(`${API}/api/radio/settings/${guildId}`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/api/radio/queue/${guildId}`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/api/radio/history/${guildId}`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/api/radio/ads/${guildId}`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/api/guilds/${guildId}/roles`, { headers: headers() }).then(r => r.json()),
    ]).then(([s, q, h, a, roles]) => {
      setSettings(s);
      setQueue(Array.isArray(q) ? q : []);
      setHistory(Array.isArray(h) ? h : []);
      setAds(Array.isArray(a) ? a : []);
      if (Array.isArray(roles)) setGuildRoles(roles.filter((r: GuildRole) => r.name !== '@everyone').sort((a: GuildRole, b: GuildRole) => b.color - a.color));
    }).catch(console.error).finally(() => setLoading(false));
  }, [guildId, headers]);

  // ── Save settings ──
  const saveSettings = useCallback(async (update: Partial<RadioSettings>) => {
    if (!guildId || !settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/radio/settings/${guildId}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to save radio settings:', data);
      } else {
        setSettings(data);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [guildId, settings, headers]);

  // ── Debounced save for text inputs ──
  const saveSettingsDebounced = useCallback((update: Partial<RadioSettings>) => {
    if (saveQueueRef.current) clearTimeout(saveQueueRef.current);
    saveQueueRef.current = setTimeout(() => saveSettings(update), 600);
  }, [saveSettings]);

  // ── Search tracks ──
  const searchTracks = async () => {
    if (!guildId || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API}/api/radio/tracks/search/${guildId}?q=${encodeURIComponent(searchQuery)}`, { headers: headers() });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  // ── Add to queue ──
  const addToQueue = async (trackId: string) => {
    if (!guildId) return;
    try {
      const res = await fetch(`${API}/api/radio/queue/${guildId}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ trackId }),
      });
      const entry = await res.json();
      if (entry.id) setQueue(prev => [...prev, entry]);
    } catch (e) { console.error(e); }
  };

  // ── Remove from queue ──
  const removeFromQueue = async (queueId: string) => {
    if (!guildId) return;
    try {
      await fetch(`${API}/api/radio/queue/${guildId}/${queueId}`, { method: 'DELETE', headers: headers() });
      setQueue(prev => prev.filter(q => q.id !== queueId));
    } catch (e) { console.error(e); }
  };

  // ── Reorder queue via drag ──
  const reorderQueue = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !guildId) return;
    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);
    setQueue(newQueue);

    try {
      const res = await fetch(`${API}/api/radio/queue/${guildId}/reorder`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ orderedIds: newQueue.map(q => q.id) }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (Array.isArray(updated)) setQueue(updated);
      }
    } catch (e) { console.error(e); }
  };

  // ── Move queue item up/down ──
  const moveQueueItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;
    reorderQueue(index, targetIndex);
  };

  // ── Poll live state + queue when on deck tab ──
  const fetchLiveData = useCallback(async () => {
    if (!guildId) return;
    try {
      const [stateRes, queueRes] = await Promise.all([
        fetch(`${API}/api/radio/state/${guildId}`, { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/radio/queue/${guildId}`, { headers: headers() }).then(r => r.json()),
      ]);
      setLiveState(stateRes);
      if (Array.isArray(queueRes)) setQueue(queueRes);
    } catch (e) { console.error(e); }
  }, [guildId, headers]);

  useEffect(() => {
    if (tab === 'deck' && guildId) {
      fetchLiveData();
      pollRef.current = setInterval(fetchLiveData, 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [tab, guildId, fetchLiveData]);

  // ── Approve/Toggle ad ──
  const toggleAdApproval = async (adId: string) => {
    if (!guildId) return;
    try {
      const res = await fetch(`${API}/api/radio/ads/${guildId}/${adId}/approve`, {
        method: 'POST',
        headers: headers(),
      });
      const updated = await res.json();
      setAds(prev => prev.map(a => a.id === adId ? updated : a));
    } catch (e) { console.error(e); }
  };

  // ── Delete ad ──
  const deleteAd = async (adId: string) => {
    if (!guildId) return;
    try {
      await fetch(`${API}/api/radio/ads/${guildId}/${adId}`, { method: 'DELETE', headers: headers() });
      setAds(prev => prev.filter(a => a.id !== adId));
    } catch (e) { console.error(e); }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!guildId) return <div style={{ color: colors.textSecondary, padding: spacing.lg }}>Select a server first.</div>;
  if (loading) return <div style={{ color: colors.textSecondary, padding: spacing.lg }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Radio size={32} color={colors.primary} style={{ marginRight: '16px' }} />
        <div>
          <h1 style={{ margin: 0 }}>Fuji FM</h1>
          <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Community radio — DJ deck, auto-pilot, ads &amp; more</p>
        </div>
      </div>

      {/* ── Explanation ── */}
      <div style={{
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderLeft: `4px solid ${colors.primary}`,
      }}>
        <p style={{ margin: 0, color: colors.textPrimary }}>
          Fuji FM streams community tracks over Discord voice. Use <strong>Auto-Pilot</strong> for 24/7 hands-free radio,
          or switch to <strong>Live Host</strong> mode with <code>/radio host</code> to DJ live. Listeners earn XP and
          can tip artists with economy coins.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        {([
          { key: 'deck' as Tab, label: 'DJ Deck', icon: Disc3 },
          { key: 'settings' as Tab, label: 'Settings', icon: Settings },
          { key: 'history' as Tab, label: 'History', icon: History },
          { key: 'ads' as Tab, label: 'Ads', icon: Megaphone },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px',
              background: tab === t.key ? colors.primary : colors.surface,
              color: tab === t.key ? '#fff' : colors.textSecondary,
              border: `1px solid ${tab === t.key ? colors.primary : colors.border}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              fontSize: 14, fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DJ Deck tab ── */}
      {tab === 'deck' && (
        <div>
          {/* ── Now Playing + Status Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: spacing.lg, marginBottom: spacing.lg }}>
            {/* Now Playing Card */}
            <div style={{
              background: liveState?.online
                ? `linear-gradient(135deg, ${colors.cardBg} 0%, rgba(16,185,129,0.08) 100%)`
                : colors.cardBg,
              border: `1px solid ${liveState?.online ? 'rgba(16,185,129,0.3)' : colors.border}`,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {liveState?.online && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${colors.primary}, #34D399)`,
                }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: liveState?.online ? '#10B981' : colors.tertiary,
                  boxShadow: liveState?.online ? '0 0 8px rgba(16,185,129,0.6)' : 'none',
                  animation: liveState?.online ? 'pulse 2s ease-in-out infinite' : 'none',
                }} />
                <span style={{ color: liveState?.online ? colors.primary : colors.textTertiary, fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {liveState?.online ? 'On Air' : 'Off Air'}
                </span>
                {liveState?.nowPlaying && (
                  <span style={{ marginLeft: 'auto', color: colors.textTertiary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} /> {liveState.nowPlaying.listenCount} listening
                  </span>
                )}
              </div>

              {liveState?.nowPlaying ? (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {liveState.nowPlaying.coverUrl ? (
                    <img
                      src={liveState.nowPlaying.coverUrl}
                      alt=""
                      style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 80, height: 80, borderRadius: 8,
                      background: colors.surfaceLight,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Music size={28} color={colors.textTertiary} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {liveState.nowPlaying.trackTitle}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 12 }}>
                      {liveState.nowPlaying.artistName}
                    </div>
                    {/* Progress bar */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: `linear-gradient(90deg, ${colors.primary}, #34D399)`,
                          borderRadius: 2,
                          width: `${Math.min(100, ((Date.now() - new Date(liveState.nowPlaying.playedAt).getTime()) / 1000) / liveState.nowPlaying.duration * 100)}%`,
                          transition: 'width 1s linear',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ color: colors.textTertiary, fontSize: 11 }}>
                          {formatDuration(Math.min(Math.floor((Date.now() - new Date(liveState.nowPlaying.playedAt).getTime()) / 1000), liveState.nowPlaying.duration))}
                        </span>
                        <span style={{ color: colors.textTertiary, fontSize: 11 }}>
                          {formatDuration(liveState.nowPlaying.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Radio size={32} color={colors.textTertiary} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ color: colors.textTertiary, fontSize: 14, margin: 0 }}>
                    Radio is offline. Use <code style={{ color: colors.primary }}>/radio start</code> in Discord to begin broadcasting.
                  </p>
                </div>
              )}
            </div>

            {/* Station Status Panel */}
            <div style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <h4 style={{ margin: 0, color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>Station Status</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: colors.surfaceLight, borderRadius: borderRadius.sm }}>
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>Mode</span>
                  <span style={{ color: colors.primary, fontSize: 12, fontWeight: 600 }}>
                    {settings?.autoEnabled ? 'Auto-Pilot' : 'Manual'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: colors.surfaceLight, borderRadius: borderRadius.sm }}>
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>Queue</span>
                  <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>{queue.length} tracks</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: colors.surfaceLight, borderRadius: borderRadius.sm }}>
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>Volume</span>
                  <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>{Math.round((settings?.defaultVolume ?? 0.5) * 100)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: colors.surfaceLight, borderRadius: borderRadius.sm }}>
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>Source</span>
                  <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{settings?.autoSource ?? 'trending'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: colors.surfaceLight, borderRadius: borderRadius.sm }}>
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>Ads</span>
                  <span style={{ color: settings?.adsEnabled ? colors.primary : colors.textTertiary, fontSize: 12, fontWeight: 600 }}>
                    {settings?.adsEnabled ? `Every ${settings.adFrequency} songs` : 'Disabled'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', padding: '8px 0 0', borderTop: `1px solid ${colors.border}` }}>
                <div style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center' }}>
                  Auto-refreshing every 5s
                </div>
              </div>
            </div>
          </div>

          {/* ── Host Controls Bar ── */}
          <div style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.lg,
            padding: '12px 20px',
            marginBottom: spacing.lg,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 600, marginRight: 4 }}>Discord Controls:</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { cmd: '/radio start', icon: Play, desc: 'Start broadcasting' },
                { cmd: '/radio stop', icon: Square, desc: 'Stop radio' },
                { cmd: '/radio skip', icon: SkipForward, desc: 'Skip current track' },
                { cmd: '/radio host', icon: Mic, desc: 'Go live as DJ host' },
                { cmd: '/radio unhost', icon: MicOff, desc: 'End host mode' },
              ].map(c => (
                <div
                  key={c.cmd}
                  title={c.desc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px',
                    background: colors.surfaceLight,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.sm,
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  <c.icon size={13} />
                  <code style={{ color: colors.primary, fontSize: 11 }}>{c.cmd}</code>
                </div>
              ))}
            </div>
          </div>

          {/* ── Search + Queue Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
            {/* Search Panel */}
            <div style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
            }}>
              <h3 style={{ margin: '0 0 12px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                <Search size={18} /> Search Tracks
              </h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchTracks()}
                  placeholder="Search by title or artist..."
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: colors.surfaceLight,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.sm,
                    color: colors.textPrimary, fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={searchTracks}
                  disabled={searching}
                  style={{
                    padding: '8px 16px',
                    background: colors.primary, color: '#fff',
                    border: 'none', borderRadius: borderRadius.sm,
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {searchResults.map(track => (
                  <div key={track.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px', borderRadius: borderRadius.sm,
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 4, background: colors.surfaceLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Music size={16} color={colors.textTertiary} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {track.title}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {track.profile.displayName || track.profile.username} • {formatDuration(track.duration)}
                      </div>
                    </div>
                    <button
                      onClick={() => addToQueue(track.id)}
                      style={{
                        padding: '4px 10px',
                        background: 'transparent',
                        border: `1px solid ${colors.primary}`,
                        color: colors.primary,
                        borderRadius: borderRadius.sm,
                        cursor: 'pointer', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && searchQuery && !searching && (
                  <p style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', margin: '16px 0' }}>
                    No tracks found. Try a different search.
                  </p>
                )}
              </div>
            </div>

            {/* Queue Panel with Drag-to-Reorder */}
            <div style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
            }}>
              <h3 style={{ margin: '0 0 12px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                <Music size={18} /> Queue
                <span style={{
                  marginLeft: 'auto', background: colors.surfaceLight,
                  padding: '2px 10px', borderRadius: 12, fontSize: 12, color: colors.textSecondary,
                }}>
                  {queue.length} track{queue.length !== 1 ? 's' : ''}
                </span>
              </h3>

              <div style={{ maxHeight: 450, overflowY: 'auto' }}>
                {queue.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <Music size={28} color={colors.textTertiary} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ color: colors.textTertiary, fontSize: 13, margin: 0 }}>
                      Queue is empty. Search and add tracks, or let auto-pilot fill it.
                    </p>
                  </div>
                ) : queue.map((entry, i) => (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(i);
                      e.dataTransfer.effectAllowed = 'move';
                      // Make drag image slightly transparent
                      if (e.currentTarget instanceof HTMLElement) {
                        e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverIndex(i);
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === i) setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null && dragIndex !== i) {
                        reorderQueue(dragIndex, i);
                      }
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 6px', borderRadius: borderRadius.sm,
                      borderBottom: `1px solid ${colors.border}`,
                      background: dragOverIndex === i ? 'rgba(16,185,129,0.1)' : dragIndex === i ? 'rgba(255,255,255,0.03)' : 'transparent',
                      opacity: dragIndex === i ? 0.5 : 1,
                      cursor: 'grab',
                      transition: 'background 0.15s ease',
                      borderTop: dragOverIndex === i ? `2px solid ${colors.primary}` : '2px solid transparent',
                    }}
                  >
                    {/* Drag handle */}
                    <GripVertical size={14} color={colors.textTertiary} style={{ cursor: 'grab', flexShrink: 0 }} />

                    {/* Position */}
                    <span style={{
                      color: i === 0 ? colors.primary : colors.textTertiary,
                      fontSize: 12, width: 20, textAlign: 'center', fontWeight: i === 0 ? 700 : 400, flexShrink: 0,
                    }}>{i + 1}</span>

                    {/* Cover */}
                    {entry.track?.coverUrl ? (
                      <img src={entry.track.coverUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 4, background: colors.surfaceLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Music size={16} color={colors.textTertiary} />
                      </div>
                    )}

                    {/* Track info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: i === 0 ? colors.textPrimary : colors.textPrimary,
                        fontSize: 13, fontWeight: i === 0 ? 600 : 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {i === 0 && <span style={{ color: colors.primary, marginRight: 4, fontSize: 11 }}>UP NEXT</span>}
                        {entry.track?.title || 'Unknown'}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {entry.track?.profile?.displayName || entry.track?.profile?.username || ''}
                        {entry.track?.duration ? ` • ${formatDuration(entry.track.duration)}` : ''}
                      </div>
                    </div>

                    {/* Reorder buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveQueueItem(i, 'up'); }}
                        disabled={i === 0}
                        style={{
                          padding: 2, background: 'transparent', border: 'none',
                          color: i === 0 ? 'transparent' : colors.textTertiary,
                          cursor: i === 0 ? 'default' : 'pointer', lineHeight: 0,
                        }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveQueueItem(i, 'down'); }}
                        disabled={i === queue.length - 1}
                        style={{
                          padding: 2, background: 'transparent', border: 'none',
                          color: i === queue.length - 1 ? 'transparent' : colors.textTertiary,
                          cursor: i === queue.length - 1 ? 'default' : 'pointer', lineHeight: 0,
                        }}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(entry.id); }}
                      style={{
                        padding: 4, background: 'transparent', border: 'none',
                        color: colors.tertiary, cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pulse animation for on-air indicator */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && settings && (
        <div style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
        }}>
          <h3 style={{ margin: '0 0 20px', color: colors.textPrimary }}>Radio Configuration</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
            {/* Voice Channel */}
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Voice Channel (radio broadcasts here)
              </label>
              <ChannelSelect
                guildId={guildId!}
                value={settings.voiceChannelId || ''}
                onChange={val => saveSettings({ voiceChannelId: (val as string) || null })}
                channelTypes={[2]}
              />
            </div>

            {/* Text Channel */}
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Text Channel (now-playing embed)
              </label>
              <ChannelSelect
                guildId={guildId!}
                value={settings.textChannelId || ''}
                onChange={val => saveSettings({ textChannelId: (val as string) || null })}
                channelTypes={[0]}
              />
            </div>

            {/* Auto Source */}
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Auto-Pilot Source
              </label>
              <select
                value={settings.autoSource}
                onChange={e => saveSettings({ autoSource: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: colors.surfaceLight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  color: colors.textPrimary, fontSize: 13,
                }}
              >
                <option value="trending">Trending (most played)</option>
                <option value="newest">Newest uploads</option>
                <option value="random">Random shuffle</option>
                <option value="genre">By genre</option>
              </select>
            </div>

            {/* Genre Filter */}
            {settings.autoSource === 'genre' && (
              <div>
                <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                  Genre Filter (slug)
                </label>
                <input
                  defaultValue={settings.autoGenreFilter || ''}
                  onBlur={e => saveSettingsDebounced({ autoGenreFilter: e.target.value || null })}
                  placeholder="e.g. hip-hop"
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: colors.surfaceLight,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.sm,
                    color: colors.textPrimary, fontSize: 13,
                  }}
                />
              </div>
            )}

            {/* Default Volume */}
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Default Volume ({Math.round((defaultVolumeLocal ?? settings.defaultVolume) * 100)}%)
              </label>
              <input
                type="range"
                min={0} max={100} step={5}
                value={Math.round((defaultVolumeLocal ?? settings.defaultVolume) * 100)}
                onChange={e => setDefaultVolumeLocal(parseInt(e.target.value) / 100)}
                onPointerUp={e => {
                  const val = parseInt((e.target as HTMLInputElement).value) / 100;
                  setDefaultVolumeLocal(null);
                  saveSettings({ defaultVolume: val });
                }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Duck Volume */}
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Host Duck Volume ({Math.round((duckVolumeLocal ?? settings.duckVolume) * 100)}%)
              </label>
              <input
                type="range"
                min={0} max={50} step={5}
                value={Math.round((duckVolumeLocal ?? settings.duckVolume) * 100)}
                onChange={e => setDuckVolumeLocal(parseInt(e.target.value) / 100)}
                onPointerUp={e => {
                  const val = parseInt((e.target as HTMLInputElement).value) / 100;
                  setDuckVolumeLocal(null);
                  saveSettings({ duckVolume: val });
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '24px 0' }} />

          <h4 style={{ margin: '0 0 16px', color: colors.textPrimary }}>Features</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Toggles */}
            {([
              { key: 'listenerXpEnabled', label: 'Listener XP (earn XP while listening)' },
              { key: 'listenerCoinEnabled', label: 'Listener Coins (earn coins while listening)' },
              { key: 'tipEnabled', label: 'Tipping (let listeners tip artists)' },
              { key: 'adsEnabled', label: 'Ads (inject sponsored messages between songs)' },
              { key: 'ttsAnnounce', label: 'TTS Announcements (announce track titles)' },
            ] as const).map(toggle => (
              <label key={toggle.key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: colors.surfaceLight,
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={(settings as any)[toggle.key]}
                  onChange={e => saveSettings({ [toggle.key]: e.target.checked } as any)}
                  style={{ accentColor: colors.primary }}
                />
                <span style={{ color: colors.textPrimary, fontSize: 13 }}>{toggle.label}</span>
              </label>
            ))}
          </div>

          {/* Numeric fields */}
          {settings.adsEnabled && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Ad Frequency (play ad every N songs)
              </label>
              <input
                type="number"
                min={1} max={100}
                value={settings.adFrequency}
                onChange={e => saveSettings({ adFrequency: parseInt(e.target.value) || 5 })}
                style={{
                  width: 120, padding: '8px 12px',
                  background: colors.surfaceLight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  color: colors.textPrimary, fontSize: 13,
                }}
              />
            </div>
          )}

          {settings.listenerXpEnabled && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                XP per minute for listeners
              </label>
              <input
                type="number"
                min={1} max={50}
                value={settings.listenerXpPerMinute}
                onChange={e => saveSettings({ listenerXpPerMinute: parseInt(e.target.value) || 1 })}
                style={{
                  width: 120, padding: '8px 12px',
                  background: colors.surfaceLight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  color: colors.textPrimary, fontSize: 13,
                }}
              />
            </div>
          )}

          {settings.listenerCoinEnabled && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Coins per minute for listeners
              </label>
              <input
                type="number"
                min={1} max={50}
                value={settings.listenerCoinsPerMinute}
                onChange={e => saveSettings({ listenerCoinsPerMinute: parseInt(e.target.value) || 1 })}
                style={{
                  width: 120, padding: '8px 12px',
                  background: colors.surfaceLight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  color: colors.textPrimary, fontSize: 13,
                }}
              />
            </div>
          )}

          {settings.tipEnabled && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Minimum tip amount
              </label>
              <input
                type="number"
                min={1} max={10000}
                value={settings.minTipAmount}
                onChange={e => saveSettings({ minTipAmount: parseInt(e.target.value) || 1 })}
                style={{
                  width: 120, padding: '8px 12px',
                  background: colors.surfaceLight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  color: colors.textPrimary, fontSize: 13,
                }}
              />
            </div>
          )}

          {saving && <p style={{ color: colors.primary, fontSize: 12, marginTop: 12 }}>Saving...</p>}

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '24px 0' }} />

          <h4 style={{ margin: '0 0 8px', color: colors.textPrimary }}>Command Permissions</h4>
          <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: 13 }}>
            Restrict commands to specific roles. Members with Manage Server always have access. Leave empty to allow everyone (or default Manage Server for admin commands).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
            {([
              { key: 'startRoleIds' as const, label: '/radio start', description: 'Who can start the radio' },
              { key: 'stopRoleIds' as const, label: '/radio stop', description: 'Who can stop the radio (default: Manage Server)' },
              { key: 'skipRoleIds' as const, label: '/radio skip', description: 'Who can skip tracks' },
              { key: 'hostRoleIds' as const, label: '/radio host', description: 'Who can go live host (default: Manage Server)' },
            ]).map(cmd => (
              <div key={cmd.key}>
                <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
                  <strong style={{ color: colors.textPrimary }}>{cmd.label}</strong>
                </label>
                <p style={{ margin: '0 0 8px', color: colors.textTertiary, fontSize: 11 }}>{cmd.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(settings[cmd.key] ?? []).map((roleId: string) => {
                    const role = guildRoles.find(r => r.id === roleId);
                    const roleColor = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : colors.primary;
                    return (
                      <span key={roleId} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 12,
                        background: `${roleColor}22`, border: `1px solid ${roleColor}66`,
                        color: roleColor, fontSize: 12, fontWeight: 500,
                      }}>
                        {role?.name ?? roleId}
                        <button
                          onClick={() => saveSettings({ [cmd.key]: (settings[cmd.key] ?? []).filter((id: string) => id !== roleId) } as any)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: roleColor, padding: 0, lineHeight: 1, fontSize: 14 }}
                        >×</button>
                      </span>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={e => {
                    const roleId = e.target.value;
                    if (!roleId) return;
                    const current = settings[cmd.key] ?? [];
                    if (current.includes(roleId)) return;
                    saveSettings({ [cmd.key]: [...current, roleId] } as any);
                  }}
                  style={{
                    width: '100%', padding: '7px 10px',
                    background: colors.surfaceLight,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.sm,
                    color: settings[cmd.key]?.length ? colors.textPrimary : colors.textTertiary,
                    fontSize: 13,
                  }}
                >
                  <option value="">+ Add role…</option>
                  {guildRoles
                    .filter(r => !(settings[cmd.key] ?? []).includes(r.id))
                    .map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))
                  }
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
        }}>
          <h3 style={{ margin: '0 0 16px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} /> Play History
          </h3>

          {history.length === 0 ? (
            <p style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', margin: '32px 0' }}>
              No history yet. Start the radio to see played tracks here.
            </p>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ textAlign: 'left', padding: '8px', color: colors.textSecondary, fontSize: 12, fontWeight: 500 }}>Track</th>
                    <th style={{ textAlign: 'left', padding: '8px', color: colors.textSecondary, fontSize: 12, fontWeight: 500 }}>Artist</th>
                    <th style={{ textAlign: 'center', padding: '8px', color: colors.textSecondary, fontSize: 12, fontWeight: 500 }}>Listeners</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: colors.textSecondary, fontSize: 12, fontWeight: 500 }}>Played</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 8px', color: h.isAd ? colors.highlight : colors.textPrimary, fontSize: 13 }}>
                        {h.isAd ? '📢 Ad' : h.trackTitle}
                      </td>
                      <td style={{ padding: '10px 8px', color: colors.textSecondary, fontSize: 13 }}>{h.artistName}</td>
                      <td style={{ padding: '10px 8px', color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Users size={12} /> {h.listenCount}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: colors.textTertiary, fontSize: 12, textAlign: 'right' }}>
                        {new Date(h.playedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Ads tab ── */}
      {tab === 'ads' && (
        <div style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
        }}>
          <h3 style={{ margin: '0 0 16px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={18} /> Ad Slots
          </h3>

          <p style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
            Community members can purchase ad slots with economy coins. Ads play between songs at the configured frequency.
            Approve ads below to activate them.
          </p>

          {ads.length === 0 ? (
            <p style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', margin: '32px 0' }}>
              No ad slots yet. Members can purchase ads through the bot.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ads.map(ad => (
                <div key={ad.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: colors.surfaceLight,
                  borderRadius: borderRadius.sm,
                  border: `1px solid ${ad.approved ? colors.primary : colors.border}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: ad.adType === 'tts' ? colors.accent : colors.highlight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}>
                    {ad.adType === 'tts' ? 'TTS' : 'AUD'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500 }}>
                      {ad.adText || '(Audio Ad)'}
                    </div>
                    <div style={{ color: colors.textTertiary, fontSize: 11 }}>
                      Plays left: {ad.playsLeft} • Paid: {ad.costPaid} coins • {ad.approved ? 'Approved' : 'Pending'}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAdApproval(ad.id)}
                    style={{
                      padding: '6px 12px',
                      background: ad.approved ? colors.surface : colors.primary,
                      color: ad.approved ? colors.textSecondary : '#fff',
                      border: `1px solid ${ad.approved ? colors.border : colors.primary}`,
                      borderRadius: borderRadius.sm,
                      cursor: 'pointer', fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {ad.approved ? <><X size={12} /> Revoke</> : <><Check size={12} /> Approve</>}
                  </button>
                  <button
                    onClick={() => deleteAd(ad.id)}
                    style={{
                      padding: 6, background: 'transparent', border: 'none',
                      color: colors.tertiary, cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Responsive adjustment */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 1fr 1fr"],
          div[style*="gridTemplateColumns: 1fr 320px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
