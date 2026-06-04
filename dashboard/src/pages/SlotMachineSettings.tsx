import React, { useState, useEffect, useRef } from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { Dices, Save, Upload, Trash2, Play, Plus, RotateCcw, TrendingDown, RefreshCw, Gift } from 'lucide-react';

interface LossEntry {
  discordId: string;
  username: string;
  avatar: string | null;
  grossLost: number;  // coins that left wallet in losing spins
  grossWon: number;   // coins won from slots
  netLoss: number;    // grossLost - grossWon — actual pre-session coins lost
  spinsLost: number;
}

interface SlotSymbol {
  emoji: string;
  label: string;
  weight: number;
  multiplier: number;
  imageUrl?: string;
}

interface SlotSounds {
  spin:     string | null;
  win:      string | null;
  jackpot:  string | null;
  twoMatch: string | null;
  loss:     string | null;
}

const DEFAULT_SYMBOLS: SlotSymbol[] = [
  { emoji: '🎵', label: 'Note',       weight: 40, multiplier: 3  },
  { emoji: '🎸', label: 'Guitar',     weight: 25, multiplier: 4  },
  { emoji: '🎹', label: 'Piano',      weight: 20, multiplier: 5  },
  { emoji: '🎧', label: 'Headphones', weight: 10, multiplier: 7  },
  { emoji: '💎', label: 'Diamond',    weight: 4,  multiplier: 10 },
  { emoji: '🔥', label: 'Fire',       weight: 1,  multiplier: 20 },
];

const SOUND_EVENTS: { key: keyof SlotSounds; label: string; description: string }[] = [
  { key: 'spin',     label: 'Spin',         description: 'Plays when the reels start spinning'      },
  { key: 'win',      label: 'Win',          description: 'Plays on a regular win (3 of a kind)'     },
  { key: 'jackpot',  label: 'Jackpot',      description: 'Plays on 💎 or 🔥 wins (high multiplier)' },
  { key: 'twoMatch', label: 'Two of a Kind',description: 'Plays when two symbols match (coins back)' },
  { key: 'loss',     label: 'Loss',         description: 'Plays when the spin results in a loss'    },
];

const inputStyle: React.CSSProperties = {
  background: colors.background,
  border: `1px solid ${colors.border}`,
  borderRadius: borderRadius.md,
  color: colors.textPrimary,
  padding: '8px 10px',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export const SlotMachineSettings: React.FC = () => {
  const { selectedGuild } = useAuth();
  const guildId = selectedGuild?.id;

  const [tab, setTab] = useState<'symbols' | 'sounds' | 'losses'>('symbols');
  const [losses, setLosses] = useState<LossEntry[]>([]);
  const [lossesLoading, setLossesLoading] = useState(false);
  const [potBalance, setPotBalance] = useState<number | null>(null);
  const [returnTarget, setReturnTarget] = useState<LossEntry | null>(null);
  const [returnAmount, setReturnAmount] = useState('');
  const [returning, setReturning] = useState(false);
  const [returnMsg, setReturnMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [symbols, setSymbols] = useState<SlotSymbol[]>(DEFAULT_SYMBOLS);
  const [sounds, setSounds] = useState<SlotSounds>({ spin: null, win: null, jackpot: null, twoMatch: null, loss: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<keyof SlotSounds | null>(null);
  const [uploadingIconIdx, setUploadingIconIdx] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const fileInputRefs = useRef<Partial<Record<keyof SlotSounds, HTMLInputElement | null>>>({});
  const iconInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const showMsg = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3500);
  };

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    fetch(`/api/slots/settings/${guildId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.symbols?.length) setSymbols(data.symbols);
        if (data.sounds) setSounds(data.sounds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const uploadIcon = async (idx: number, file: File) => {
    if (!guildId) return;
    setUploadingIconIdx(idx);
    const form = new FormData();
    form.append('slotIcon', file);
    try {
      const res = await fetch(`/api/slots/icon/${guildId}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) showMsg(data.error ?? 'Upload failed.', false);
      else { updateSymbol(idx, 'imageUrl', data.url); showMsg('Icon uploaded — save symbols to apply.', true); }
    } catch { showMsg('Upload failed.', false); }
    finally { setUploadingIconIdx(null); }
  };

  const saveSymbols = async () => {
    if (!guildId) return;
    // Validate
    for (const s of symbols) {
      if (!s.emoji.trim() && !s.imageUrl) return showMsg('Every symbol needs an emoji or uploaded icon.', false);
      if (s.weight < 1) return showMsg('Weights must be at least 1.', false);
      if (s.multiplier < 1) return showMsg('Multipliers must be at least 1.', false);
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/slots/settings/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbols }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.error ?? 'Failed to save.', false); }
      else showMsg('Symbols saved!', true);
    } catch { showMsg('Network error.', false); }
    finally { setSaving(false); }
  };

  const uploadSound = async (event: keyof SlotSounds, file: File) => {
    if (!guildId) return;
    setUploading(event);
    const form = new FormData();
    form.append('slotSound', file);
    try {
      const res = await fetch(`/api/slots/sounds/${guildId}/${event}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) showMsg(data.error ?? 'Upload failed.', false);
      else { setSounds(prev => ({ ...prev, [event]: data.url })); showMsg('Sound uploaded!', true); }
    } catch { showMsg('Upload failed.', false); }
    finally { setUploading(null); }
  };

  const removeSound = async (event: keyof SlotSounds) => {
    if (!guildId) return;
    try {
      await fetch(`/api/slots/sounds/${guildId}/${event}`, { method: 'DELETE', credentials: 'include' });
      setSounds(prev => ({ ...prev, [event]: null }));
      showMsg('Sound removed.', true);
    } catch { showMsg('Failed to remove.', false); }
  };

  const updateSymbol = (i: number, field: keyof SlotSymbol, value: string | number) => {
    setSymbols(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const addSymbol = () => {
    if (symbols.length >= 10) return;
    setSymbols(prev => [...prev, { emoji: '⭐', label: 'Star', weight: 5, multiplier: 6 }]);
  };

  const removeSymbol = (i: number) => {
    if (symbols.length <= 2) return;
    setSymbols(prev => prev.filter((_, idx) => idx !== i));
  };

  const fetchLosses = async () => {
    if (!guildId) return;
    setLossesLoading(true);
    try {
      const [lossRes, potRes] = await Promise.all([
        fetch(`/api/slots/losses/${guildId}`, { credentials: 'include' }),
        fetch(`/api/slots/pot/${guildId}`, { credentials: 'include' }),
      ]);
      if (lossRes.ok) setLosses(await lossRes.json());
      if (potRes.ok) { const p = await potRes.json(); setPotBalance(p.balance); }
    } catch { /* silent */ }
    finally { setLossesLoading(false); }
  };

  useEffect(() => {
    if (tab === 'losses') fetchLosses();
  }, [tab, guildId]);

  const returnCoins = async () => {
    if (!guildId || !returnTarget) return;
    const amount = parseInt(returnAmount);
    if (!amount || amount < 1) return;
    setReturning(true);
    try {
      const res = await fetch(`/api/economy/vault/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: returnTarget.discordId, amount, mode: 'add' }),
      });
      if (!res.ok) {
        const d = await res.json();
        setReturnMsg({ text: d.error ?? 'Failed to return coins.', ok: false });
      } else {
        setReturnMsg({ text: `Returned 🪙 ${amount.toLocaleString()} to ${returnTarget.username}`, ok: true });
        setReturnTarget(null);
        setReturnAmount('');
        setTimeout(() => setReturnMsg(null), 4000);
      }
    } catch { setReturnMsg({ text: 'Network error.', ok: false }); }
    finally { setReturning(false); }
  };

  const totalWeight = symbols.reduce((s, sym) => s + (sym.weight || 0), 0);

  if (!selectedGuild) return (
    <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Select a server first.</div>
  );
  if (loading) return (
    <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading...</div>
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Dices size={32} color={colors.primary} style={{ marginRight: '16px' }} />
        <div>
          <h1 style={{ margin: 0 }}>Slot Machine</h1>
          <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
            Customise the symbols and sound effects for the slot machine.
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div style={{
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderLeft: `4px solid ${colors.primary}`,
      }}>
        <p style={{ margin: 0, color: colors.textPrimary }}>
          The slot machine is accessible at <strong>fujistud.io/slots</strong> via the <strong>/slots</strong> Discord command.
          All wins and losses use the server's real coin balance — the same currency as the economy system.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['symbols', 'sounds', 'losses'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px',
            borderRadius: borderRadius.md,
            border: `1px solid ${tab === t ? colors.primary : colors.border}`,
            background: tab === t ? `rgba(16,185,129,0.12)` : colors.surface,
            color: tab === t ? colors.primary : colors.textSecondary,
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 16,
          borderRadius: borderRadius.md,
          background: message.ok ? `rgba(16,185,129,0.12)` : `rgba(239,68,68,0.12)`,
          border: `1px solid ${message.ok ? colors.primary : colors.error}`,
          color: message.ok ? colors.primary : colors.error,
          fontSize: '14px',
        }}>
          {message.text}
        </div>
      )}

      {/* Symbols Tab */}
      {tab === 'symbols' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px' }}>
              {symbols.length} symbol{symbols.length !== 1 ? 's' : ''} — total weight {totalWeight}. Higher weight = appears more often.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setSymbols(DEFAULT_SYMBOLS); }} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: '13px', cursor: 'pointer',
              }}>
                <RotateCcw size={14} /> Reset
              </button>
              <button onClick={addSymbol} disabled={symbols.length >= 10} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: '13px',
                cursor: symbols.length >= 10 ? 'not-allowed' : 'pointer', opacity: symbols.length >= 10 ? 0.5 : 1,
              }}>
                <Plus size={14} /> Add Symbol
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 100px 40px', gap: 8, padding: '0 4px' }}>
            {['Icon', 'Label', 'Weight', 'Multiplier (3×)', ''].map(h => (
              <span key={h} style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {symbols.map((sym, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 80px 100px 40px',
              gap: 8,
              alignItems: 'center',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              padding: '10px 12px',
            }}>
              {/* Icon cell: image preview OR emoji input + upload button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {sym.imageUrl ? (
                  <>
                    <img
                      src={sym.imageUrl}
                      alt={sym.label}
                      style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: borderRadius.sm, background: colors.background, flexShrink: 0 }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <button
                        onClick={() => iconInputRefs.current[i]?.click()}
                        disabled={uploadingIconIdx === i}
                        title="Replace image"
                        style={{ padding: '3px 6px', fontSize: '10px', background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: 4, color: colors.textSecondary, cursor: 'pointer' }}
                      >
                        {uploadingIconIdx === i ? '…' : 'Replace'}
                      </button>
                      <button
                        onClick={() => updateSymbol(i, 'imageUrl', '')}
                        title="Remove image"
                        style={{ padding: '3px 6px', fontSize: '10px', background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 4, color: colors.error, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      value={sym.emoji}
                      onChange={e => updateSymbol(i, 'emoji', e.target.value)}
                      style={{ ...inputStyle, fontSize: '22px', textAlign: 'center', padding: '4px', width: 46, flexShrink: 0 }}
                      maxLength={4}
                      title="Emoji"
                    />
                    <button
                      onClick={() => iconInputRefs.current[i]?.click()}
                      disabled={uploadingIconIdx === i}
                      title="Upload a custom image instead"
                      style={{ padding: '5px 7px', background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {uploadingIconIdx === i ? <span style={{ fontSize: 10 }}>…</span> : <Upload size={13} />}
                    </button>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={el => { iconInputRefs.current[i] = el; }}
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadIcon(i, file);
                    e.target.value = '';
                  }}
                />
              </div>
              <input
                value={sym.label}
                onChange={e => updateSymbol(i, 'label', e.target.value)}
                style={inputStyle}
                placeholder="Label"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={sym.weight}
                onChange={e => updateSymbol(i, 'weight', Math.max(1, parseInt(e.target.value) || 1))}
                style={{ ...inputStyle, textAlign: 'center' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={sym.multiplier}
                  onChange={e => updateSymbol(i, 'multiplier', Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
                <span style={{ color: colors.textTertiary, fontSize: '13px', whiteSpace: 'nowrap' }}>×</span>
              </div>
              <button
                onClick={() => removeSymbol(i)}
                disabled={symbols.length <= 2}
                style={{
                  background: 'none', border: 'none', cursor: symbols.length <= 2 ? 'not-allowed' : 'pointer',
                  color: colors.textTertiary, opacity: symbols.length <= 2 ? 0.3 : 1, padding: 4,
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {/* Probability preview */}
          <div style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            padding: '12px 14px',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Drop rate preview
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {symbols.map((s, i) => (
                <span key={i} style={{
                  fontSize: '13px',
                  color: colors.textSecondary,
                  background: colors.surfaceLight,
                  borderRadius: borderRadius.sm,
                  padding: '3px 8px',
                }}>
                  {s.emoji} {totalWeight > 0 ? ((s.weight / totalWeight) * 100).toFixed(1) : 0}%
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={saveSymbols}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', background: colors.primary, color: '#fff',
              border: 'none', borderRadius: borderRadius.md, fontWeight: 700, fontSize: '15px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Symbols'}
          </button>
        </div>
      )}

      {/* Sounds Tab */}
      {tab === 'sounds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: '0 0 4px', color: colors.textSecondary, fontSize: '13px' }}>
            Upload MP3, WAV, OGG, or AAC files (max 10MB). Sounds play in the player's browser.
          </p>
          {SOUND_EVENTS.map(({ key, label, description }) => (
            <div key={key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              padding: '14px 16px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: colors.textPrimary }}>{label}</div>
                <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: 2 }}>{description}</div>
                {sounds[key] && (
                  <div style={{ marginTop: 6, fontSize: '12px', color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sounds[key]!.split('/').pop()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {sounds[key] && (
                  <>
                    <button
                      onClick={() => { try { new Audio(sounds[key]!).play(); } catch {} }}
                      title="Preview"
                      style={{
                        display: 'flex', alignItems: 'center', padding: '7px',
                        background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                        borderRadius: borderRadius.md, color: colors.textSecondary, cursor: 'pointer',
                      }}
                    >
                      <Play size={14} />
                    </button>
                    <button
                      onClick={() => removeSound(key)}
                      title="Remove"
                      style={{
                        display: 'flex', alignItems: 'center', padding: '7px',
                        background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`,
                        borderRadius: borderRadius.md, color: colors.error, cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}

                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/aac,audio/m4a,.mp3,.wav,.ogg,.aac,.m4a"
                  ref={el => { fileInputRefs.current[key] = el; }}
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadSound(key, file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[key]?.click()}
                  disabled={uploading === key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                    background: sounds[key] ? colors.surface : `rgba(16,185,129,0.1)`,
                    border: `1px solid ${sounds[key] ? colors.border : colors.primary}`,
                    borderRadius: borderRadius.md,
                    color: sounds[key] ? colors.textSecondary : colors.primary,
                    fontSize: '13px', fontWeight: 600, cursor: uploading === key ? 'not-allowed' : 'pointer',
                    opacity: uploading === key ? 0.6 : 1,
                  }}
                >
                  <Upload size={13} />
                  {uploading === key ? 'Uploading...' : sounds[key] ? 'Replace' : 'Upload'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Losses Tab ── */}
      {tab === 'losses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pot summary */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: borderRadius.md, padding: '14px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingDown size={20} color={colors.tertiary} />
              <div>
                <div style={{ fontSize: '12px', color: colors.textTertiary, marginBottom: 2 }}>Total Pot (coins lost)</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                  {potBalance === null ? '—' : `🪙 ${potBalance.toLocaleString()}`}
                </div>
              </div>
            </div>
            <button
              onClick={fetchLosses}
              disabled={lossesLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: '13px', cursor: 'pointer', opacity: lossesLoading ? 0.5 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: lossesLoading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>

          {/* Table */}
          {lossesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textTertiary }}>Loading...</div>
          ) : losses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textTertiary }}>No losses recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 110px 70px 100px', gap: 10, padding: '10px 16px', background: colors.surfaceLight, borderBottom: `1px solid ${colors.border}` }}>
                {['#', 'Player', 'Net Lost', 'Gross Lost', 'Spins', ''].map(h => (
                  <span key={h} style={{ fontSize: '11px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              {losses.map((entry, i) => (
                <div key={entry.discordId} style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 110px 110px 70px 100px', gap: 10,
                  padding: '10px 16px', alignItems: 'center',
                  background: i % 2 === 0 ? colors.surface : 'transparent',
                  borderBottom: i < losses.length - 1 ? `1px solid ${colors.border}` : 'none',
                }}>
                  <span style={{ fontSize: '13px', color: colors.textTertiary, fontWeight: 600 }}>#{i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {entry.avatar
                      ? <img src={entry.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
                      : <div style={{ width: 30, height: 30, borderRadius: '50%', background: colors.surfaceLight, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>👤</div>
                    }
                    <span style={{ fontSize: '14px', color: colors.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.username}</span>
                  </div>
                  {/* Net loss (real coins from pre-session balance) */}
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: colors.tertiary, fontVariantNumeric: 'tabular-nums' }}>
                      🪙 {entry.netLoss.toLocaleString()}
                    </span>
                  </div>
                  {/* Gross lost / gross won breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: '12px', color: colors.tertiary, fontVariantNumeric: 'tabular-nums' }}>−{entry.grossLost.toLocaleString()}</span>
                    <span style={{ fontSize: '11px', color: colors.primary, fontVariantNumeric: 'tabular-nums' }}>+{entry.grossWon.toLocaleString()}</span>
                  </div>
                  <span style={{ fontSize: '13px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                    {entry.spinsLost.toLocaleString()}
                  </span>
                  <button
                    onClick={() => { setReturnTarget(entry); setReturnAmount(String(entry.netLoss)); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: borderRadius.md, color: colors.primary, fontSize: '12px',
                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Gift size={12} /> Return
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Return coins modal */}
          {returnTarget && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.xl, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                <h3 style={{ margin: '0 0 6px', color: colors.textPrimary }}>Return Coins</h3>
                <div style={{ margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: colors.surfaceLight, borderRadius: borderRadius.md, fontSize: 13 }}>
                    <span style={{ color: colors.textSecondary }}>Gross lost (all losing spins)</span>
                    <span style={{ color: colors.tertiary, fontWeight: 600 }}>🪙 {returnTarget.grossLost.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: colors.surfaceLight, borderRadius: borderRadius.md, fontSize: 13 }}>
                    <span style={{ color: colors.textSecondary }}>Won from slots (house money)</span>
                    <span style={{ color: colors.primary, fontWeight: 600 }}>🪙 {returnTarget.grossWon.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(244,63,94,0.07)', border: `1px solid rgba(244,63,94,0.2)`, borderRadius: borderRadius.md, fontSize: 13 }}>
                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>Net loss (pre-session coins)</span>
                    <span style={{ color: colors.tertiary, fontWeight: 700 }}>🪙 {returnTarget.netLoss.toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary }}>
                    The default amount below is their <strong>net loss</strong> — coins from their wallet before playing, not winnings they re-gambled.
                  </p>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: colors.textTertiary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      value={returnAmount}
                      onChange={e => setReturnAmount(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Enter amount"
                    />
                    <button
                      onClick={() => setReturnAmount(String(returnTarget.netLoss))}
                      style={{ padding: '8px 12px', background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Net ({returnTarget.netLoss.toLocaleString()})
                    </button>
                  </div>
                </div>

                {returnMsg && (
                  <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: borderRadius.md, background: returnMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${returnMsg.ok ? colors.primary : colors.error}`, color: returnMsg.ok ? colors.primary : colors.error, fontSize: 13 }}>
                    {returnMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setReturnTarget(null); setReturnAmount(''); setReturnMsg(null); }} style={{ padding: '9px 18px', background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: 14, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={returnCoins}
                    disabled={returning || !returnAmount || parseInt(returnAmount) < 1}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: colors.primary, border: 'none', borderRadius: borderRadius.md, color: '#fff', fontSize: 14, fontWeight: 700, cursor: returning ? 'not-allowed' : 'pointer', opacity: returning ? 0.7 : 1 }}
                  >
                    <Gift size={14} /> {returning ? 'Sending...' : 'Send Coins'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
