import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Radio, Play, Square, SkipForward, Volume2, Settings, History, Search, Plus, Trash2, Check, X, Megaphone, Music, Users, Clock, Disc3 } from 'lucide-react';
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
  tipEnabled: boolean;
  minTipAmount: number;
  defaultVolume: number;
  duckVolume: number;
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
    ]).then(([s, q, h, a]) => {
      setSettings(s);
      setQueue(Array.isArray(q) ? q : []);
      setHistory(Array.isArray(h) ? h : []);
      setAds(Array.isArray(a) ? a : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [guildId, headers]);

  // ── Save settings ──
  const saveSettings = async (update: Partial<RadioSettings>) => {
    if (!guildId || !settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/radio/settings/${guildId}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(update),
      });
      const data = await res.json();
      setSettings(data);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

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
          {/* Status card */}
          <div style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.lg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: settings?.voiceChannelId ? colors.primary : colors.tertiary,
                boxShadow: settings?.voiceChannelId ? `0 0 8px ${colors.primary}` : 'none',
              }} />
              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 16 }}>
                {settings?.voiceChannelId ? 'Radio Configured' : 'Not Configured'}
              </span>
            </div>
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13 }}>
              Use <code>/radio start</code> in Discord to begin broadcasting. The dashboard will show live state once WebSocket support is enabled.
            </p>
          </div>

          {/* ── Search + Queue ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
            {/* Search */}
            <div style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
            }}>
              <h3 style={{ margin: '0 0 12px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
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

              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
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

            {/* Queue */}
            <div style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
            }}>
              <h3 style={{ margin: '0 0 12px', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Music size={18} /> Queue ({queue.length})
              </h3>

              <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                {queue.length === 0 ? (
                  <p style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', margin: '24px 0' }}>
                    Queue is empty. Search and add tracks, or use auto-pilot mode.
                  </p>
                ) : queue.map((entry, i) => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px', borderRadius: borderRadius.sm,
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    <span style={{ color: colors.textTertiary, fontSize: 12, width: 20, textAlign: 'center' }}>{i + 1}</span>
                    {entry.track?.coverUrl ? (
                      <img src={entry.track.coverUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 4, background: colors.surfaceLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Music size={16} color={colors.textTertiary} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.track?.title || 'Unknown'}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {entry.track?.profile?.displayName || entry.track?.profile?.username || ''}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromQueue(entry.id)}
                      style={{
                        padding: 4, background: 'transparent', border: 'none',
                        color: colors.tertiary, cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                  value={settings.autoGenreFilter || ''}
                  onChange={e => saveSettings({ autoGenreFilter: e.target.value || null })}
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
                Default Volume ({Math.round(settings.defaultVolume * 100)}%)
              </label>
              <input
                type="range"
                min={0} max={100} step={5}
                value={Math.round(settings.defaultVolume * 100)}
                onChange={e => saveSettings({ defaultVolume: parseInt(e.target.value) / 100 })}
                style={{ width: '100%' }}
              />
            </div>

            {/* Duck Volume */}
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Host Duck Volume ({Math.round(settings.duckVolume * 100)}%)
              </label>
              <input
                type="range"
                min={0} max={50} step={5}
                value={Math.round(settings.duckVolume * 100)}
                onChange={e => saveSettings({ duckVolume: parseInt(e.target.value) / 100 })}
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
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
