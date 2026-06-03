import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { colors, borderRadius } from '../theme/theme';

const DEFAULT_SYMBOLS = [
  { emoji: '🎵', label: 'Note',       weight: 40, multiplier: 3  },
  { emoji: '🎸', label: 'Guitar',     weight: 25, multiplier: 4  },
  { emoji: '🎹', label: 'Piano',      weight: 20, multiplier: 5  },
  { emoji: '🎧', label: 'Headphones', weight: 10, multiplier: 7  },
  { emoji: '💎', label: 'Diamond',    weight: 4,  multiplier: 10 },
  { emoji: '🔥', label: 'Fire',       weight: 1,  multiplier: 20 },
];

interface SlotSymbol { emoji: string; label: string; weight: number; multiplier: number; }
interface SlotSounds { spin?: string; win?: string; jackpot?: string; twoMatch?: string; loss?: string; }
interface SpinResult { reels: string[]; payout: number; multiplier: number; net: number; newBalance: number; currencyEmoji: string; }
interface HistoryEntry { reels: string[]; net: number; }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function playSound(url?: string) { if (!url) return; try { new Audio(url).play(); } catch {} }

const STYLES = `
  @keyframes slots-pulse {
    0%, 100% { box-shadow: 0 0 24px rgba(16,185,129,0.45), 0 0 60px rgba(16,185,129,0.15); }
    50%       { box-shadow: 0 0 36px rgba(16,185,129,0.7),  0 0 80px rgba(16,185,129,0.3);  }
  }
  @keyframes slots-win-flash {
    0%   { background: rgba(16,185,129,0);   }
    30%  { background: rgba(16,185,129,0.18); }
    100% { background: rgba(16,185,129,0);   }
  }
  @keyframes slots-jackpot-flash {
    0%   { background: rgba(245,158,11,0);   }
    25%  { background: rgba(245,158,11,0.22); }
    50%  { background: rgba(245,158,11,0.08); }
    75%  { background: rgba(245,158,11,0.22); }
    100% { background: rgba(245,158,11,0);   }
  }
  @keyframes slots-loss-shake {
    0%, 100% { transform: translateX(0);  }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px);  }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px);  }
  }
  @keyframes slots-reel-blur {
    0%, 100% { filter: blur(0px); }
    50%      { filter: blur(2px) brightness(0.8); }
  }
  @keyframes slots-result-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes slots-coin-tick {
    0%   { transform: scale(1);    color: inherit; }
    50%  { transform: scale(1.12); color: #10B981; }
    100% { transform: scale(1);    color: inherit; }
  }
  @keyframes slots-neon-flicker {
    0%, 95%, 100% { opacity: 1; }
    96%           { opacity: 0.8; }
    97%           { opacity: 1; }
    98%           { opacity: 0.85; }
  }
  .slots-spin-btn-ready { animation: slots-pulse 2s ease-in-out infinite; }
  .slots-win-overlay    { animation: slots-win-flash 0.8s ease-out forwards; }
  .slots-jackpot-overlay{ animation: slots-jackpot-flash 0.9s ease-out forwards; }
  .slots-loss-shake     { animation: slots-loss-shake 0.4s ease-in-out; }
  .slots-reel-spinning  { animation: slots-reel-blur 0.15s ease-in-out infinite; }
  .slots-result-in      { animation: slots-result-in 0.3s ease-out forwards; }
  .slots-title          { animation: slots-neon-flicker 8s ease-in-out infinite; }
  .slots-balance-tick   { animation: slots-coin-tick 0.35s ease-out; }
`;

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
  const [flashClass, setFlashClass] = useState('');
  const [shakeReels, setShakeReels] = useState(false);
  const [balanceTick, setBalanceTick] = useState(false);
  const [resultKey, setResultKey] = useState(0);

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
    } catch { setError('Failed to load balance.'); }
  }, [navigate]);

  useEffect(() => {
    if (!loading && !user) { navigate('/login?return=/slots'); return; }
    if (!loading && user) fetchBalance();
  }, [user, loading, fetchBalance, navigate]);

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

  const adjustBet = (delta: number) => setBet(prev => Math.max(10, Math.min(maxBet, prev + delta)));

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldown(prev => { if (prev <= 1) { clearInterval(cooldownIntervalRef.current!); return 0; } return prev - 1; });
    }, 1000);
  };

  const spin = async () => {
    if (!canSpin) return;
    setError(null);
    setResult(null);
    setFlashClass('');
    setShakeReels(false);
    setLockedReels([false, false, false]);
    setSpinning(true);
    playSound(sounds.spin);

    spinIntervalRef.current = setInterval(() => {
      setDisplayReels([rndEmoji(), rndEmoji(), rndEmoji()]);
    }, 70);

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

      setDisplayReels([spinResult.reels[0], rndEmoji(), rndEmoji()]);
      setLockedReels([true, false, false]);
      await sleep(300);
      setDisplayReels([spinResult.reels[0], spinResult.reels[1], rndEmoji()]);
      setLockedReels([true, true, false]);
      await sleep(300);
      setDisplayReels(spinResult.reels);
      setLockedReels([true, true, true]);

      const isJackpot = spinResult.multiplier >= 10;
      if (spinResult.net > 0) {
        setFlashClass(isJackpot ? 'slots-jackpot-overlay' : 'slots-win-overlay');
        playSound(isJackpot ? (sounds.jackpot || sounds.win) : sounds.win);
      } else if (spinResult.net === 0) {
        playSound(sounds.twoMatch);
      } else {
        setShakeReels(true);
        setTimeout(() => setShakeReels(false), 500);
        playSound(sounds.loss);
      }

      setResult(spinResult);
      setResultKey(k => k + 1);
      setBalance(spinResult.newBalance);
      setCurrencyEmoji(spinResult.currencyEmoji);
      setBalanceTick(true);
      setTimeout(() => setBalanceTick(false), 400);
      setHistory(prev => [{ reels: spinResult.reels, net: spinResult.net }, ...prev].slice(0, 8));
      startCooldown(3);
    } catch {
      clearInterval(spinIntervalRef.current!);
      setError('Connection error — try again.');
    } finally {
      setSpinning(false);
    }
  };

  const reelGlow = (i: number): React.CSSProperties => {
    if (!result || spinning) return {};
    const [a, b, c] = result.reels;
    if (a === b && b === c) return {
      borderColor: result.multiplier >= 10 ? '#F59E0B' : colors.primary,
      boxShadow: result.multiplier >= 10
        ? '0 0 28px rgba(245,158,11,0.6), inset 0 0 12px rgba(245,158,11,0.08)'
        : '0 0 28px rgba(16,185,129,0.55), inset 0 0 12px rgba(16,185,129,0.08)',
    };
    const pairs: Record<number, boolean> = { 0: a === b || a === c, 1: a === b || b === c, 2: a === c || b === c };
    if (pairs[i]) return { borderColor: '#F59E0B', boxShadow: '0 0 16px rgba(245,158,11,0.4)' };
    return { borderColor: 'rgba(255,255,255,0.05)' };
  };

  const resultColor = result
    ? result.net > 0 ? (result.multiplier >= 10 ? '#F59E0B' : colors.primary) : result.net === 0 ? '#F59E0B' : colors.tertiary
    : 'transparent';

  const spinLabel = spinning ? '◈  SPINNING' : cooldown > 0 ? `WAIT  ${cooldown}s` : balance !== null && balance < 10 ? 'NO COINS' : '◈  SPIN';

  return (
    <DiscoveryLayout>
      <style>{STYLES}</style>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 80px',
        minHeight: '80vh',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 70%)',
      }}>

        {/* ── Cabinet ── */}
        <div style={{
          width: '100%',
          maxWidth: 480,
          background: 'linear-gradient(180deg, #111827 0%, #0B0F19 100%)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(16,185,129,0.08), 0 24px 64px rgba(0,0,0,0.6)',
        }}>

          {/* Flash overlay */}
          <div className={flashClass} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 24, zIndex: 1 }} />

          {/* ── Top bar ── */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.12) 100%)',
            borderBottom: '1px solid rgba(16,185,129,0.2)',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div className="slots-title" style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              background: 'linear-gradient(90deg, #10B981, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textTransform: 'uppercase',
            }}>
              Fuji Slots
            </div>
            {balance !== null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {currencyName}
                </div>
                <div
                  className={balanceTick ? 'slots-balance-tick' : ''}
                  style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums' }}
                >
                  {currencyEmoji} {balance.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {needsDiscord ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.7)' }}>
              Link your Discord account to access your coin balance.
            </div>
          ) : loading || balance === null ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.4)', letterSpacing: '0.1em' }}>
              LOADING...
            </div>
          ) : (
            <>
              {/* ── Reel area ── */}
              <div style={{
                padding: '24px 20px 20px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                position: 'relative',
              }}>
                {/* Top gradient overlay — simulates reel window */}
                <div style={{
                  position: 'absolute', top: 24, left: 20, right: 20, height: 40,
                  background: 'linear-gradient(to bottom, rgba(11,15,25,0.7), transparent)',
                  pointerEvents: 'none', zIndex: 2, borderRadius: '12px 12px 0 0',
                }} />
                <div style={{
                  position: 'absolute', bottom: 20, left: 20, right: 20, height: 40,
                  background: 'linear-gradient(to top, rgba(11,15,25,0.7), transparent)',
                  pointerEvents: 'none', zIndex: 2, borderRadius: '0 0 12px 12px',
                }} />

                {/* Payline indicator */}
                <div style={{
                  display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 12,
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: result && lockedReels[i] ? colors.primary : 'rgba(255,255,255,0.12)',
                      transition: 'background 0.2s',
                      boxShadow: result && lockedReels[i] ? '0 0 6px rgba(16,185,129,0.8)' : 'none',
                    }} />
                  ))}
                </div>

                {/* Reels */}
                <div className={shakeReels ? 'slots-loss-shake' : ''} style={{ display: 'flex', gap: 10 }}>
                  {displayReels.map((emoji, i) => (
                    <div key={i} style={{
                      flex: 1,
                      aspectRatio: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      border: `2px solid rgba(255,255,255,0.08)`,
                      borderRadius: 16,
                      fontSize: '54px',
                      lineHeight: 1,
                      userSelect: 'none',
                      transition: 'border-color 0.3s, box-shadow 0.3s',
                      position: 'relative',
                      overflow: 'hidden',
                      ...reelGlow(i),
                    }}>
                      <div className={spinning && !lockedReels[i] ? 'slots-reel-spinning' : ''} style={{ lineHeight: 1 }}>
                        {emoji}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Result strip ── */}
              <div style={{
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                padding: '0 24px',
                background: result && !spinning
                  ? result.net > 0
                    ? `rgba(16,185,129,0.06)`
                    : result.net === 0
                    ? `rgba(245,158,11,0.06)`
                    : `rgba(244,63,94,0.06)`
                  : 'transparent',
                transition: 'background 0.4s',
              }}>
                {result && !spinning && (
                  <div key={resultKey} className="slots-result-in" style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: '18px' }}>
                      {result.net > 0 ? (result.multiplier >= 10 ? '🏆' : '✨') : result.net === 0 ? '🔄' : '💨'}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '15px',
                      color: resultColor,
                      letterSpacing: '0.02em',
                    }}>
                      {result.net > 0
                        ? `${result.multiplier >= 10 ? 'JACKPOT! ' : ''}Won ${currencyEmoji} ${result.payout.toLocaleString()} — ${result.multiplier}×`
                        : result.net === 0
                        ? `Two of a kind — coins back`
                        : `Lost ${currencyEmoji} ${bet.toLocaleString()}`}
                    </span>
                  </div>
                )}
                {error && (
                  <span style={{ color: colors.error, fontSize: '13px' }}>{error}</span>
                )}
              </div>

              {/* ── Bet controls ── */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Bet</span>
                  <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.05em' }}>
                    Max {currencyEmoji} {maxBet.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {(['MIN', '-100', '-10'] as const).map(label => (
                    <button key={label} onClick={() => label === 'MIN' ? setBet(10) : adjustBet(label === '-100' ? -100 : -10)} disabled={spinning}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: '11px', fontWeight: 700,
                        background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.7)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                        cursor: spinning ? 'not-allowed' : 'pointer', opacity: spinning ? 0.4 : 1,
                        letterSpacing: '0.04em',
                      }}>
                      {label}
                    </button>
                  ))}
                  <div style={{
                    flex: 2, textAlign: 'center', fontWeight: 800, fontSize: '22px',
                    color: '#F8FAFC', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                  }}>
                    {bet.toLocaleString()}
                  </div>
                  {(['+10', '+100', 'MAX'] as const).map(label => (
                    <button key={label} onClick={() => label === 'MAX' ? setBet(maxBet) : adjustBet(label === '+100' ? 100 : 10)} disabled={spinning}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: '11px', fontWeight: 700,
                        background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.7)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                        cursor: spinning ? 'not-allowed' : 'pointer', opacity: spinning ? 0.4 : 1,
                        letterSpacing: '0.04em',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Spin button ── */}
              <div style={{ padding: '0 20px 20px' }}>
                <button
                  onClick={spin}
                  disabled={!canSpin}
                  className={canSpin ? 'slots-spin-btn-ready' : ''}
                  style={{
                    width: '100%',
                    padding: '18px',
                    fontSize: '16px',
                    fontWeight: 800,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    background: canSpin
                      ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)'
                      : 'rgba(255,255,255,0.04)',
                    color: canSpin ? '#fff' : 'rgba(148,163,184,0.3)',
                    border: canSpin ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    cursor: canSpin ? 'pointer' : 'not-allowed',
                    transition: 'background 0.3s, color 0.3s',
                  }}
                >
                  {spinLabel}
                </button>
              </div>

              {/* ── Payout table ── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '14px 20px' }}>
                <details>
                  <summary style={{
                    cursor: 'pointer', fontSize: '11px', color: 'rgba(148,163,184,0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', userSelect: 'none',
                    listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>▸</span> Paytable
                  </summary>
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {[...symbols].reverse().map(s => (
                      <div key={s.emoji} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 8px', background: 'rgba(255,255,255,0.02)',
                        borderRadius: 6, fontSize: '13px',
                      }}>
                        <span style={{ letterSpacing: '3px' }}>{s.emoji}{s.emoji}{s.emoji}</span>
                        <span style={{ color: colors.primary, fontWeight: 700 }}>{s.multiplier}×</span>
                      </div>
                    ))}
                    <div style={{
                      gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between',
                      padding: '5px 8px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, fontSize: '13px',
                    }}>
                      <span style={{ color: 'rgba(148,163,184,0.7)' }}>Any two matching</span>
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>Coins back</span>
                    </div>
                  </div>
                </details>
              </div>
            </>
          )}
        </div>

        {/* ── History ticker ── */}
        {history.length > 0 && (
          <div style={{ width: '100%', maxWidth: 480, marginTop: 8 }}>
            <div style={{ fontSize: '11px', color: 'rgba(148,163,184,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Recent
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: h.net > 0 ? 'rgba(16,185,129,0.08)' : h.net === 0 ? 'rgba(245,158,11,0.08)' : 'rgba(244,63,94,0.07)',
                  border: `1px solid ${h.net > 0 ? 'rgba(16,185,129,0.2)' : h.net === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(244,63,94,0.15)'}`,
                  borderRadius: 20,
                  fontSize: '14px',
                }}>
                  <span style={{ letterSpacing: '2px' }}>{h.reels.join('')}</span>
                  <span style={{
                    fontWeight: 700, fontSize: '12px',
                    color: h.net > 0 ? colors.primary : h.net === 0 ? '#F59E0B' : colors.tertiary,
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
