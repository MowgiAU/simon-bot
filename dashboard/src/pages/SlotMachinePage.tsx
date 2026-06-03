import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/theme';
import { Coins, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const DEFAULT_SYMBOLS = [
  { emoji: '🎵', label: 'Note',        weight: 40, multiplier: 3  },
  { emoji: '🎸', label: 'Guitar',      weight: 25, multiplier: 4  },
  { emoji: '🎹', label: 'Piano',       weight: 20, multiplier: 5  },
  { emoji: '🎧', label: 'Headphones',  weight: 10, multiplier: 7  },
  { emoji: '💎', label: 'Diamond',     weight: 4,  multiplier: 10 },
  { emoji: '🔥', label: 'Fire',        weight: 1,  multiplier: 20 },
];

interface SlotSymbol { emoji: string; label: string; weight: number; multiplier: number; }
interface SlotSounds { spin?: string; win?: string; jackpot?: string; twoMatch?: string; loss?: string; }

function playSound(url?: string) {
  if (!url) return;
  try { new Audio(url).play(); } catch { /* ignore autoplay policy errors */ }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

interface SpinResult {
  reels: string[];
  payout: number;
  multiplier: number;
  net: number;
  newBalance: number;
  currencyEmoji: string;
}

interface HistoryEntry {
  reels: string[];
  net: number;
  multiplier: number;
}

const BetButton: React.FC<{ label: string; onClick: () => void; disabled: boolean }> = ({ label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      flex: 1,
      padding: '8px 0',
      fontSize: '12px',
      fontWeight: 600,
      background: colors.surfaceLight,
      color: colors.textSecondary,
      border: `1px solid ${colors.border}`,
      borderRadius: borderRadius.md,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 0.15s',
    }}
  >
    {label}
  </button>
);

export const SlotMachinePage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance] = useState<number | null>(null);
  const [currencyEmoji, setCurrencyEmoji] = useState('🪙');
  const [currencyName, setCurrencyName] = useState('Coins');
  const [symbols, setSymbols] = useState<SlotSymbol[]>(DEFAULT_SYMBOLS);
  const [sounds, setSounds] = useState<SlotSounds>({});
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [displayReels, setDisplayReels] = useState(['🎵', '🎸', '🎹']);
  const [lockedReels, setLockedReels] = useState([false, false, false]);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsDiscord, setNeedsDiscord] = useState(false);

  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/slots/balance', { credentials: 'include' });
      if (res.status === 401) { navigate('/login?return=/slots'); return; }
      if (res.status === 403) { setNeedsDiscord(true); return; }
      const data = await res.json();
      setBalance(data.balance);
      setCurrencyEmoji(data.currencyEmoji);
      setCurrencyName(data.currencyName);
      if (data.symbols?.length) setSymbols(data.symbols);
      if (data.sounds) setSounds(data.sounds);
    } catch {
      setError('Failed to load balance.');
    }
  }, [navigate]);

  useEffect(() => {
    if (!loading && !user) { navigate('/login?return=/slots'); return; }
    if (!loading && user) fetchBalance();
  }, [user, loading, fetchBalance, navigate]);

  // Clamp bet when balance changes
  useEffect(() => {
    if (balance === null) return;
    const max = Math.min(500, Math.max(10, Math.floor(balance / 2)));
    setBet(prev => Math.max(10, Math.min(max, prev)));
  }, [balance]);

  useEffect(() => () => {
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
  }, []);

  const emojiList = symbols.map(s => s.emoji);
  const rndEmoji = () => emojiList[Math.floor(Math.random() * emojiList.length)] || '🎵';

  const maxBet = balance === null ? 10 : Math.min(500, Math.max(10, Math.floor(balance / 2)));
  const canSpin = !spinning && cooldown === 0 && balance !== null && balance >= 10 && balance >= bet;

  const adjustBet = (delta: number) =>
    setBet(prev => Math.max(10, Math.min(maxBet, prev + delta)));

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownIntervalRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const spin = async () => {
    if (!canSpin) return;
    setError(null);
    setResult(null);
    setLockedReels([false, false, false]);
    setSpinning(true);
    playSound(sounds.spin);

    spinIntervalRef.current = setInterval(() => {
      setDisplayReels([rndEmoji(), rndEmoji(), rndEmoji()]);
    }, 75);

    try {
      const res = await fetch('/api/slots/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bet }),
      });

      const data = await res.json();

      if (!res.ok) {
        clearInterval(spinIntervalRef.current!);
        setSpinning(false);
        if (res.status === 429) startCooldown(data.retryAfter ?? 3);
        else setError(data.error ?? 'Something went wrong.');
        return;
      }

      const spinResult: SpinResult = data;

      await sleep(1400);
      clearInterval(spinIntervalRef.current!);

      // Settle reels one by one
      setDisplayReels([spinResult.reels[0], rndEmoji(), rndEmoji()]);
      setLockedReels([true, false, false]);
      await sleep(300);
      setDisplayReels([spinResult.reels[0], spinResult.reels[1], rndEmoji()]);
      setLockedReels([true, true, false]);
      await sleep(300);
      setDisplayReels(spinResult.reels);
      setLockedReels([true, true, true]);

      // Play result sound
      const isJackpot = spinResult.multiplier >= 10;
      if (spinResult.net > 0) playSound(isJackpot ? (sounds.jackpot || sounds.win) : sounds.win);
      else if (spinResult.net === 0) playSound(sounds.twoMatch);
      else playSound(sounds.loss);

      setResult(spinResult);
      setBalance(spinResult.newBalance);
      setCurrencyEmoji(spinResult.currencyEmoji);
      setHistory(prev => [
        { reels: spinResult.reels, net: spinResult.net, multiplier: spinResult.multiplier },
        ...prev,
      ].slice(0, 8));

      startCooldown(3);
    } catch {
      clearInterval(spinIntervalRef.current!);
      setError('Connection error — try again.');
    } finally {
      setSpinning(false);
    }
  };

  // Reel border/glow based on result
  const reelStyle = (i: number): React.CSSProperties => {
    if (!result || spinning) return { borderColor: colors.border };
    const [a, b, c] = result.reels;
    if (a === b && b === c) {
      return { borderColor: colors.primary, boxShadow: `0 0 20px rgba(16,185,129,0.45)` };
    }
    const pairs: Record<number, boolean> = { 0: a === b || a === c, 1: a === b || b === c, 2: a === c || b === c };
    if (pairs[i]) return { borderColor: colors.highlight, boxShadow: `0 0 14px rgba(245,158,11,0.35)` };
    return { borderColor: colors.border };
  };

  const resultColor = result
    ? result.net > 0 ? colors.primary : result.net === 0 ? colors.highlight : colors.tertiary
    : colors.textSecondary;

  const spinButtonLabel = spinning
    ? 'Spinning...'
    : cooldown > 0
    ? `Wait ${cooldown}s`
    : balance !== null && balance < 10
    ? 'No Coins'
    : 'SPIN';

  return (
    <DiscoveryLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 16px 80px',
        gap: '24px',
        minHeight: '80vh',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ ...typography.h1, margin: 0, color: colors.textPrimary }}>Slot Machine</h1>
          <p style={{ margin: '6px 0 0', color: colors.textSecondary, fontSize: '14px' }}>
            Win big or go home — your server coins, real stakes.
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          width: '100%',
          maxWidth: 460,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.xl,
          padding: '28px 24px',
          boxShadow: shadows.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
        }}>
          {needsDiscord ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textSecondary }}>
              <p style={{ margin: 0 }}>Link your Discord account to access your coin balance.</p>
            </div>
          ) : loading || balance === null ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textTertiary }}>Loading...</div>
          ) : (
            <>
              {/* Balance row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Coins size={16} color={colors.highlight} />
                  <span style={{ color: colors.textTertiary, fontSize: '13px' }}>{currencyName}</span>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>
                  {currencyEmoji} {balance.toLocaleString()}
                </span>
              </div>

              {/* Reels */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {displayReels.map((emoji, i) => (
                  <div key={i} style={{
                    flex: 1,
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.background,
                    border: `2px solid ${colors.border}`,
                    borderRadius: borderRadius.lg,
                    fontSize: '52px',
                    lineHeight: 1,
                    userSelect: 'none',
                    filter: spinning && !lockedReels[i] ? 'blur(1.5px) brightness(0.85)' : 'none',
                    transition: 'border-color 0.25s, box-shadow 0.25s, filter 0.1s',
                    ...reelStyle(i),
                  }}>
                    {emoji}
                  </div>
                ))}
              </div>

              {/* Result banner */}
              <div style={{
                minHeight: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}>
                {result && !spinning && (
                  <>
                    {result.net > 0
                      ? <TrendingUp size={15} color={resultColor} />
                      : result.net === 0
                      ? <Minus size={15} color={resultColor} />
                      : <TrendingDown size={15} color={resultColor} />}
                    <span style={{ color: resultColor, fontWeight: 600, fontSize: '14px' }}>
                      {result.net > 0
                        ? `Won ${currencyEmoji} ${result.payout.toLocaleString()} — ${result.multiplier}×`
                        : result.net === 0
                        ? 'Two of a kind — coins back'
                        : `Lost ${currencyEmoji} ${bet.toLocaleString()}`}
                    </span>
                  </>
                )}
                {error && <span style={{ color: colors.error, fontSize: '13px' }}>{error}</span>}
              </div>

              {/* Bet controls */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: '12px',
                  color: colors.textTertiary,
                }}>
                  <span>Bet amount</span>
                  <span>Max {currencyEmoji} {maxBet.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <BetButton label="MIN" onClick={() => setBet(10)} disabled={spinning} />
                  <BetButton label="-100" onClick={() => adjustBet(-100)} disabled={spinning} />
                  <BetButton label="-10" onClick={() => adjustBet(-10)} disabled={spinning} />
                  <div style={{
                    flex: 2,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '20px',
                    color: colors.textPrimary,
                    padding: '8px 0',
                    letterSpacing: '-0.01em',
                  }}>
                    {bet.toLocaleString()}
                  </div>
                  <BetButton label="+10" onClick={() => adjustBet(10)} disabled={spinning} />
                  <BetButton label="+100" onClick={() => adjustBet(100)} disabled={spinning} />
                  <BetButton label="MAX" onClick={() => setBet(maxBet)} disabled={spinning} />
                </div>
              </div>

              {/* Spin button */}
              <button
                onClick={spin}
                disabled={!canSpin}
                style={{
                  width: '100%',
                  padding: '15px',
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  background: canSpin
                    ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`
                    : colors.surfaceLight,
                  color: canSpin ? '#fff' : colors.textTertiary,
                  border: 'none',
                  borderRadius: borderRadius.lg,
                  cursor: canSpin ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.2s',
                  opacity: canSpin ? 1 : 0.7,
                  boxShadow: canSpin ? `0 4px 20px rgba(16,185,129,0.3)` : 'none',
                }}
              >
                {spinButtonLabel}
              </button>

              {/* Payout table */}
              <details>
                <summary style={{ cursor: 'pointer', color: colors.textTertiary, fontSize: '12px', userSelect: 'none' }}>
                  Payout table
                </summary>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...symbols].reverse().map(s => (
                    <div key={s.emoji} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: `1px solid ${colors.border}`,
                      fontSize: '13px',
                    }}>
                      <span style={{ letterSpacing: '2px' }}>{s.emoji} {s.emoji} {s.emoji}</span>
                      <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{s.multiplier}×</span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '5px 0',
                    fontSize: '13px',
                  }}>
                    <span style={{ color: colors.textSecondary }}>Any two matching</span>
                    <span style={{ color: colors.highlight, fontWeight: 600 }}>Two of a kind — coins back</span>
                  </div>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Spin history */}
        {history.length > 0 && (
          <div style={{ width: '100%', maxWidth: 460 }}>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Recent Spins
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.md,
                }}>
                  <span style={{ fontSize: '20px', letterSpacing: '6px' }}>{h.reels.join('')}</span>
                  <span style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: h.net > 0 ? colors.primary : h.net === 0 ? colors.highlight : colors.tertiary,
                  }}>
                    {h.net > 0 ? '+' : ''}{h.net.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DiscoveryLayout>
  );
};
