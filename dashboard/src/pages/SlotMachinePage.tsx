import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { colors, borderRadius } from '../theme/theme';

const DEFAULT_SYMBOLS = [
  { emoji: '🎵', label: 'Note',       weight: 40, multiplier: 3    },
  { emoji: '🎸', label: 'Guitar',     weight: 25, multiplier: 4    },
  { emoji: '🎹', label: 'Piano',      weight: 20, multiplier: 5    },
  { emoji: '🎧', label: 'Headphones', weight: 10, multiplier: 7    },
  { emoji: '💎', label: 'Diamond',    weight: 4,  multiplier: 10   },
  { emoji: '🔥', label: 'Fire',       weight: 1,  multiplier: 20   },
];

interface SlotSymbol { emoji: string; label: string; weight: number; multiplier: number; imageUrl?: string; }
interface SlotSounds { spin?: string; win?: string; jackpot?: string; twoMatch?: string; loss?: string; }
interface SpinResult { reels: string[]; payout: number; multiplier: number; net: number; newBalance: number; currencyEmoji: string; }
interface HistoryEntry { reels: string[]; net: number; multiplier: number; id: number; }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function playSound(url?: string) { if (!url) return; try { new Audio(url).play(); } catch {} }

const STYLES = `
  @keyframes slots-pulse-btn {
    0%,100%{ box-shadow:0 0 32px rgba(16,185,129,0.6),0 0 80px rgba(16,185,129,0.2),inset 0 1px 0 rgba(255,255,255,0.15); }
    50%    { box-shadow:0 0 52px rgba(16,185,129,0.9),0 0 120px rgba(16,185,129,0.35),inset 0 1px 0 rgba(255,255,255,0.25); }
  }
  @keyframes slots-win-flash {
    0%   { background:rgba(16,185,129,0); }
    20%  { background:rgba(16,185,129,0.28); }
    100% { background:rgba(16,185,129,0); }
  }
  @keyframes slots-small-win-flash {
    0%   { background:rgba(16,185,129,0); }
    30%  { background:rgba(16,185,129,0.14); }
    100% { background:rgba(16,185,129,0); }
  }
  @keyframes slots-jackpot-flash {
    0%   { background:rgba(245,158,11,0); }
    15%  { background:rgba(245,158,11,0.35); }
    40%  { background:rgba(245,158,11,0.12); }
    65%  { background:rgba(245,158,11,0.3); }
    100% { background:rgba(245,158,11,0); }
  }
  @keyframes slots-loss-shake {
    0%,100%{ transform:translateX(0); }
    15%  { transform:translateX(-8px); }
    35%  { transform:translateX(8px); }
    55%  { transform:translateX(-5px); }
    75%  { transform:translateX(5px); }
  }
  @keyframes slots-reel-scroll {
    0%   { transform:translateY(-8px); filter:blur(3px) brightness(0.7); }
    50%  { transform:translateY(8px);  filter:blur(4px) brightness(0.6); }
    100% { transform:translateY(-8px); filter:blur(3px) brightness(0.7); }
  }
  @keyframes slots-result-pop {
    0%   { opacity:0; transform:scale(0.8) translateY(8px); }
    60%  { transform:scale(1.05) translateY(-2px); }
    100% { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes slots-balance-pop {
    0%   { transform:scale(1); }
    40%  { transform:scale(1.18); color:#10B981; }
    100% { transform:scale(1); }
  }
  @keyframes slots-marquee {
    0%   { transform:translateX(0); }
    100% { transform:translateX(-50%); }
  }
  @keyframes slots-light-a {
    0%,100%{ background:#10B981; box-shadow:0 0 6px #10B981; opacity:1; }
    50%    { background:#059669; box-shadow:none; opacity:0.3; }
  }
  @keyframes slots-light-b {
    0%,100%{ background:#F59E0B; box-shadow:0 0 6px #F59E0B; opacity:1; }
    50%    { background:#B45309; box-shadow:none; opacity:0.3; }
  }
  @keyframes slots-coin-fall {
    0%   { transform:translateY(-20px) rotate(0deg) scale(1); opacity:1; }
    80%  { opacity:1; }
    100% { transform:translateY(140px) rotate(360deg) scale(0.5); opacity:0; }
  }
  @keyframes slots-win-float {
    0%   { opacity:0; transform:translateY(0) scale(0.8); }
    20%  { opacity:1; transform:translateY(-10px) scale(1.1); }
    80%  { opacity:1; transform:translateY(-40px) scale(1); }
    100% { opacity:0; transform:translateY(-60px) scale(0.9); }
  }
  @keyframes slots-jackpot-text {
    0%,100%{ text-shadow:0 0 12px rgba(245,158,11,0.8),0 0 30px rgba(245,158,11,0.4); color:#F59E0B; }
    50%    { text-shadow:0 0 24px rgba(255,215,0,1),0 0 60px rgba(245,158,11,0.6); color:#FDE68A; }
  }
  @keyframes slots-reel-lock {
    0%   { transform:scale(1.12); }
    100% { transform:scale(1); }
  }
  @keyframes slots-orb-drift {
    0%,100%{ transform:translate(0,0); }
    50%    { transform:translate(20px,-15px); }
  }
  @keyframes slots-title-glow {
    0%,100%{ text-shadow:0 0 20px rgba(16,185,129,0.5); }
    50%    { text-shadow:0 0 40px rgba(6,182,212,0.8),0 0 80px rgba(16,185,129,0.3); }
  }
  .slots-btn-ready   { animation:slots-pulse-btn 1.6s ease-in-out infinite; }
  .slots-win-overlay { animation:slots-win-flash 0.7s ease-out forwards; }
  .slots-small-overlay{ animation:slots-small-win-flash 0.7s ease-out forwards; }
  .slots-jackpot-overlay{ animation:slots-jackpot-flash 1s ease-out forwards; }
  .slots-shake       { animation:slots-loss-shake 0.4s ease-in-out; }
  .slots-spinning    { animation:slots-reel-scroll 0.12s ease-in-out infinite; }
  .slots-result-pop  { animation:slots-result-pop 0.4s ease-out forwards; }
  .slots-balance-pop { animation:slots-balance-pop 0.38s ease-out; }
  .slots-jackpot-text{ animation:slots-jackpot-text 1.2s ease-in-out infinite; }
  .slots-reel-lock   { animation:slots-reel-lock 0.2s ease-out; }
`;

// ---------- tiny sub-components ----------
const Light: React.FC<{ i: number }> = ({ i }) => (
  <div style={{
    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
    animation: `${i % 2 === 0 ? 'slots-light-a' : 'slots-light-b'} 0.8s ${(i * 0.12).toFixed(2)}s ease-in-out infinite`,
  }} />
);

const Lights: React.FC<{ count?: number }> = ({ count = 18 }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
    {Array.from({ length: count }, (_, i) => <Light key={i} i={i} />)}
  </div>
);

const Coin: React.FC<{ x: number; delay: number; size: number }> = ({ x, delay, size }) => (
  <div style={{
    position: 'absolute', top: 0, left: `${x}%`,
    width: size, height: size, borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #FDE68A, #F59E0B, #B45309)',
    border: '1px solid rgba(255,215,0,0.6)',
    fontSize: size * 0.6, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: `slots-coin-fall 1.2s ${delay}s ease-in both`,
    pointerEvents: 'none',
    zIndex: 20,
  }}>
    <span style={{ fontSize: size * 0.55 }}>🪙</span>
  </div>
);

export const SlotMachinePage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance]           = useState<number | null>(null);
  const [currencyEmoji, setCurrencyEmoji] = useState('🪙');
  const [currencyName, setCurrencyName]   = useState('Coins');
  const [symbols, setSymbols]           = useState<SlotSymbol[]>(DEFAULT_SYMBOLS);
  const [sounds, setSounds]             = useState<SlotSounds>({});
  const [bet, setBet]                   = useState(10);
  const [spinning, setSpinning]         = useState(false);
  const [displayReels, setDisplayReels] = useState(['🎵', '🎸', '🎹']);
  const [lockedReels, setLockedReels]   = useState([false, false, false]);
  const [result, setResult]             = useState<SpinResult | null>(null);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [cooldown, setCooldown]         = useState(0);
  const [error, setError]               = useState<string | null>(null);
  const [needsDiscord, setNeedsDiscord] = useState(false);
  const [flashClass, setFlashClass]     = useState('');
  const [shakeReels, setShakeReels]     = useState(false);
  const [balancePop, setBalancePop]     = useState(false);
  const [resultKey, setResultKey]       = useState(0);
  const [showCoins, setShowCoins]       = useState(false);
  const [floatWin, setFloatWin]         = useState<string | null>(null);
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 900);

  const [sessionWagered, setSessionWagered] = useState(0);
  const [sessionNet, setSessionNet]         = useState(0);
  const [spinCount, setSpinCount]           = useState(0);

  const spinIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyIdRef        = useRef(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const rndEmoji  = () => emojiList[Math.floor(Math.random() * emojiList.length)] || '🎵';
  const imageMap  = new Map(symbols.filter(s => s.imageUrl).map(s => [s.emoji, s.imageUrl!]));
  const maxBet    = balance === null ? 10 : Math.min(500, Math.max(10, Math.floor(balance / 2)));
  const canSpin   = !spinning && cooldown === 0 && balance !== null && balance >= 10 && balance >= bet;

  const adjustBet = (delta: number) => setBet(prev => Math.max(10, Math.min(maxBet, prev + delta)));

  const startCooldown = (sec: number) => {
    setCooldown(sec);
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
    setShowCoins(false);
    setFloatWin(null);
    setLockedReels([false, false, false]);
    setSpinning(true);
    playSound(sounds.spin);

    spinIntervalRef.current = setInterval(() => {
      setDisplayReels([rndEmoji(), rndEmoji(), rndEmoji()]);
    }, 70);

    try {
      const res  = await fetch('/api/slots/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ bet }) });
      const data = await res.json();

      if (!res.ok) {
        clearInterval(spinIntervalRef.current!);
        setSpinning(false);
        if (res.status === 429) startCooldown(data.retryAfter ?? 3);
        else setError(data.error ?? 'Something went wrong.');
        return;
      }

      const sr: SpinResult = data;

      await sleep(1200);
      clearInterval(spinIntervalRef.current!);

      // Settle reels one by one
      setDisplayReels([sr.reels[0], rndEmoji(), rndEmoji()]); setLockedReels([true, false, false]); await sleep(280);
      setDisplayReels([sr.reels[0], sr.reels[1], rndEmoji()]); setLockedReels([true, true, false]); await sleep(280);
      setDisplayReels(sr.reels); setLockedReels([true, true, true]);

      const isJackpot = sr.multiplier >= 10;
      const isSmallWin = sr.net > 0 && sr.multiplier < 3; // the 1.25× pair win

      if (sr.net > 0) {
        if (isJackpot) {
          setFlashClass('slots-jackpot-overlay');
          setShowCoins(true);
          setTimeout(() => setShowCoins(false), 2000);
        } else {
          setFlashClass(isSmallWin ? 'slots-small-overlay' : 'slots-win-overlay');
        }
        setFloatWin(`+${sr.net.toLocaleString()}`);
        setTimeout(() => setFloatWin(null), 1500);
        playSound(isJackpot ? (sounds.jackpot || sounds.win) : sounds.win);
      } else {
        setShakeReels(true);
        setTimeout(() => setShakeReels(false), 500);
        playSound(sounds.loss);
      }

      setResult(sr);
      setResultKey(k => k + 1);
      setBalance(sr.newBalance);
      setCurrencyEmoji(sr.currencyEmoji);
      setBalancePop(true); setTimeout(() => setBalancePop(false), 450);
      setSessionWagered(w => w + bet);
      setSessionNet(n => n + sr.net);
      setSpinCount(c => c + 1);
      const id = ++historyIdRef.current;
      setHistory(prev => [{ reels: sr.reels, net: sr.net, multiplier: sr.multiplier, id }, ...prev].slice(0, 12));
      startCooldown(3);
    } catch {
      clearInterval(spinIntervalRef.current!);
      setError('Connection error — try again.');
    } finally { setSpinning(false); }
  };

  const reelGlow = (i: number): React.CSSProperties => {
    if (!result || spinning) return {};
    const [a, b, c] = result.reels;
    if (a === b && b === c) {
      const isJackpot = result.multiplier >= 10;
      return {
        borderColor: isJackpot ? '#F59E0B' : '#10B981',
        boxShadow: isJackpot
          ? '0 0 40px rgba(245,158,11,0.8), inset 0 0 20px rgba(245,158,11,0.15)'
          : '0 0 36px rgba(16,185,129,0.7), inset 0 0 16px rgba(16,185,129,0.12)',
      };
    }
    const pairs: Record<number, boolean> = { 0: a===b||a===c, 1: a===b||b===c, 2: a===c||b===c };
    if (pairs[i]) return { borderColor: '#10B981', boxShadow: '0 0 20px rgba(16,185,129,0.5)' };
    return {};
  };

  const isWin     = result && result.net > 0;
  const isJackpot = result && result.multiplier >= 10 && result.net > 0;
  const resultColor = result
    ? result.net > 0 ? (isJackpot ? '#F59E0B' : '#10B981') : colors.tertiary
    : 'transparent';

  const SymbolEl = ({ emoji, size = 20 }: { emoji: string; size?: number }) => imageMap.has(emoji)
    ? <img src={imageMap.get(emoji)} alt={emoji} style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }} />
    : <span>{emoji}</span>;

  const spinLabel = spinning ? '⬤  SPINNING...' : cooldown > 0 ? `⏱  ${cooldown}s` : balance !== null && balance < 10 ? 'NO COINS' : '◈  SPIN';

  const marqueeText = `  FUJI SLOTS  ★  ${currencyEmoji} WIN UP TO 5,000  ★  JACKPOT ${symbols.find(s=>s.multiplier===Math.max(...symbols.map(x=>x.multiplier)))?.emoji || '🔥'} PAYS ${Math.max(...symbols.map(s=>s.multiplier))}×  ★  TWO OF A KIND WINS  ★  `;

  return (
    <DiscoveryLayout>
      <style>{STYLES}</style>

      {/* Ambient orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 65%)', top: '-15%', left: '15%', animation: 'slots-orb-drift 20s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 65%)', bottom: '5%', right: '5%', animation: 'slots-orb-drift 28s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 65%)', top: '45%', left: '2%', animation: 'slots-orb-drift 18s ease-in-out infinite 6s' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '16px 10px 80px' : '28px 20px 80px', maxWidth: 1000, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{
            margin: 0, fontSize: isMobile ? 30 : 42, fontWeight: 900, letterSpacing: '0.08em',
            textTransform: 'uppercase', display: 'inline-block',
            background: 'linear-gradient(90deg, #10B981, #06B6D4, #10B981)',
            backgroundSize: '200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'slots-title-glow 3s ease-in-out infinite',
          }}>
            Fuji Slots
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* ════════════════ MACHINE ════════════════ */}
          <div style={{ flex: '0 0 auto', width: isMobile ? '100%' : 448 }}>
            <div style={{
              background: 'linear-gradient(170deg, #1a2035 0%, #0d111e 60%, #111827 100%)',
              border: '2px solid rgba(16,185,129,0.35)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(16,185,129,0.1), 0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(16,185,129,0.08)',
              position: 'relative',
            }}>

              {/* Flash overlay */}
              <div className={flashClass} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, borderRadius: 18 }} />

              {/* Floating win text */}
              {floatWin && (
                <div key={floatWin + resultKey} style={{
                  position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 20, pointerEvents: 'none',
                  fontSize: 32, fontWeight: 900, color: isJackpot ? '#F59E0B' : '#10B981',
                  textShadow: isJackpot ? '0 0 20px rgba(245,158,11,0.9)' : '0 0 16px rgba(16,185,129,0.8)',
                  animation: 'slots-win-float 1.5s ease-out forwards',
                  whiteSpace: 'nowrap',
                }}>
                  {floatWin}
                </div>
              )}

              {/* Coin shower */}
              {showCoins && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 15 }}>
                  {Array.from({ length: 16 }, (_, i) => (
                    <Coin key={i} x={5 + i * 6 + Math.sin(i) * 5} delay={i * 0.08} size={20 + (i % 3) * 6} />
                  ))}
                </div>
              )}

              {/* ── Marquee ── */}
              <div style={{ background: 'linear-gradient(90deg, #0a1220, #10B981 20%, #06B6D4 50%, #10B981 80%, #0a1220)', padding: '6px 0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', animation: 'slots-marquee 14s linear infinite', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase', padding: '0 8px' }}>{marqueeText}{marqueeText}</span>
                </div>
              </div>

              {/* ── Top lights ── */}
              <div style={{ padding: '8px 12px 4px', background: 'rgba(0,0,0,0.4)' }}>
                <Lights count={20} />
              </div>

              {/* ── Header ── */}
              <div style={{ padding: '10px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>Balance</div>
                  <div className={balancePop ? 'slots-balance-pop' : ''} style={{
                    fontSize: 24, fontWeight: 900, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums',
                    fontFamily: '"Courier New", monospace', display: 'inline-block',
                    textShadow: '0 0 12px rgba(16,185,129,0.3)',
                  }}>
                    {balance === null ? '———' : `${currencyEmoji} ${balance.toLocaleString()}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Max Win</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#F59E0B', textShadow: '0 0 10px rgba(245,158,11,0.5)', fontFamily: '"Courier New", monospace' }}>{currencyEmoji} 5,000</div>
                </div>
              </div>

              {needsDiscord ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.6)', fontSize: 14 }}>
                  Link your Discord account to play.
                </div>
              ) : loading || balance === null ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.3)', letterSpacing: '0.2em', fontSize: 11 }}>LOADING...</div>
              ) : (<>

                {/* ── Reel window ── */}
                <div style={{ padding: '14px 16px 12px', background: 'rgba(0,0,0,0.5)', position: 'relative' }}>
                  {/* depth fades */}
                  <div style={{ position: 'absolute', top: 14, left: 16, right: 16, height: 44, background: 'linear-gradient(to bottom, rgba(8,10,18,0.9), transparent)', pointerEvents: 'none', zIndex: 3, borderRadius: '14px 14px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, height: 44, background: 'linear-gradient(to top, rgba(8,10,18,0.9), transparent)', pointerEvents: 'none', zIndex: 3, borderRadius: '0 0 14px 14px' }} />

                  {/* Payline */}
                  <div style={{ position: 'absolute', top: '50%', left: 16, right: 16, height: 3, marginTop: 6, background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.5) 20%, rgba(245,158,11,0.5) 50%, rgba(16,185,129,0.5) 80%, transparent 100%)', pointerEvents: 'none', zIndex: 4 }} />

                  {/* Lock dots */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%', transition: 'all 0.2s',
                        background: lockedReels[i]
                          ? (result && result.reels[0]===result.reels[1]&&result.reels[1]===result.reels[2] ? (result.multiplier>=10?'#F59E0B':'#10B981') : '#10B981')
                          : 'rgba(255,255,255,0.08)',
                        boxShadow: lockedReels[i] ? `0 0 10px ${(result?.multiplier ?? 0)>=10?'rgba(245,158,11,0.9)':'rgba(16,185,129,0.9)'}` : 'none',
                      }} />
                    ))}
                  </div>

                  {/* Reels */}
                  <div className={shakeReels ? 'slots-shake' : ''} style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 2 }}>
                    {displayReels.map((emoji, i) => (
                      <div key={i} style={{
                        flex: 1, aspectRatio: '1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(0,0,0,0.6))',
                        border: `2px solid rgba(255,255,255,0.07)`,
                        borderRadius: 16, fontSize: 56, lineHeight: 1,
                        userSelect: 'none', transition: 'border-color 0.3s, box-shadow 0.3s',
                        position: 'relative', overflow: 'hidden',
                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.03)',
                        ...reelGlow(i),
                      }}>
                        {/* chrome highlight strip */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)', borderRadius: '14px 14px 0 0', pointerEvents: 'none' }} />
                        <div className={spinning && !lockedReels[i] ? 'slots-spinning' : (lockedReels[i] && !spinning ? 'slots-reel-lock' : '')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                          {imageMap.has(emoji)
                            ? <img src={imageMap.get(emoji)} alt={emoji} style={{ width: '62%', height: '62%', objectFit: 'contain' }} />
                            : emoji}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Bottom lights ── */}
                <div style={{ padding: '4px 12px 8px', background: 'rgba(0,0,0,0.4)' }}>
                  <Lights count={20} />
                </div>

                {/* ── Result banner ── */}
                <div style={{
                  minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  padding: '0 20px',
                  background: result && !spinning
                    ? result.net > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.07)'
                    : 'transparent',
                  transition: 'background 0.5s',
                }}>
                  {result && !spinning && (
                    <div key={resultKey} className="slots-result-pop" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24 }}>
                        {result.net > 0 ? (isJackpot ? '🏆' : result.multiplier === 1.25 ? '✨' : '🎉') : '💨'}
                      </span>
                      <span className={isJackpot ? 'slots-jackpot-text' : ''} style={{
                        fontWeight: 900, fontSize: 16, color: resultColor, letterSpacing: '0.04em',
                        fontFamily: isJackpot ? '"Courier New", monospace' : 'inherit',
                      }}>
                        {result.net > 0
                          ? isJackpot
                            ? `★ JACKPOT! ${currencyEmoji} ${result.payout.toLocaleString()} ★`
                            : result.multiplier === 1.25
                            ? `Two of a Kind! ${currencyEmoji} +${result.net.toLocaleString()}`
                            : `Win! ${currencyEmoji} ${result.payout.toLocaleString()} — ${result.multiplier}×`
                          : `Lost ${currencyEmoji} ${bet.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  {error && <span style={{ color: colors.error, fontSize: 13 }}>{error}</span>}
                </div>

                {/* ── Bet controls ── */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Bet</span>
                    <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>Max {currencyEmoji} {maxBet.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(['MIN', '-100', '-10'] as const).map(lbl => (
                      <button key={lbl} onClick={() => lbl==='MIN'?setBet(10):adjustBet(lbl==='-100'?-100:-10)} disabled={spinning}
                        style={{ flex:1, padding:'9px 0', fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.04)', color:'rgba(148,163,184,0.6)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:spinning?'not-allowed':'pointer', opacity:spinning?0.3:1, letterSpacing:'0.04em' }}>
                        {lbl}
                      </button>
                    ))}
                    <div style={{ flex:2, textAlign:'center', fontWeight:900, fontSize:26, color:'#F8FAFC', fontVariantNumeric:'tabular-nums', fontFamily:'"Courier New",monospace', letterSpacing:'-0.02em', textShadow:'0 0 10px rgba(16,185,129,0.3)' }}>
                      {bet.toLocaleString()}
                    </div>
                    {(['+10', '+100', 'MAX'] as const).map(lbl => (
                      <button key={lbl} onClick={() => lbl==='MAX'?setBet(maxBet):adjustBet(lbl==='+100'?100:10)} disabled={spinning}
                        style={{ flex:1, padding:'9px 0', fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.04)', color:'rgba(148,163,184,0.6)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:spinning?'not-allowed':'pointer', opacity:spinning?0.3:1, letterSpacing:'0.04em' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── SPIN BUTTON ── */}
                <div style={{ padding: '4px 16px 18px' }}>
                  <button onClick={spin} disabled={!canSpin} className={canSpin ? 'slots-btn-ready' : ''}
                    style={{
                      width: '100%', padding: '20px', fontSize: 18, fontWeight: 900,
                      letterSpacing: '0.25em', textTransform: 'uppercase',
                      background: canSpin
                        ? 'linear-gradient(160deg, #22c55e 0%, #10B981 40%, #059669 70%, #0d9488 100%)'
                        : 'rgba(255,255,255,0.04)',
                      color: canSpin ? '#fff' : 'rgba(148,163,184,0.2)',
                      border: canSpin ? '2px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 14, cursor: canSpin ? 'pointer' : 'not-allowed',
                      transition: 'background 0.3s',
                      textShadow: canSpin ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                      ...(canSpin ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.3)' } : {}),
                    }}>
                    {spinLabel}
                  </button>
                </div>

                {/* Session stats */}
                {spinCount > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex' }}>
                    {[
                      { label:'Spins', value: spinCount.toString() },
                      { label:'Wagered', value: `${currencyEmoji} ${sessionWagered.toLocaleString()}` },
                      { label:'Net', value: `${sessionNet >= 0 ? '+' : ''}${sessionNet.toLocaleString()}`, color: sessionNet > 0 ? '#10B981' : sessionNet < 0 ? colors.tertiary : 'rgba(148,163,184,0.5)' },
                    ].map((s, i, arr) => (
                      <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none', padding: '10px 0' }}>
                        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: s.color || 'rgba(248,250,252,0.6)', fontVariantNumeric: 'tabular-nums', fontFamily: '"Courier New", monospace' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>)}
            </div>
          </div>

          {/* ════════════════ INFO PANEL ════════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            {/* Paytable */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Paytable</span>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[...symbols].reverse().map(s => {
                  const isTop = s.multiplier >= 10;
                  return (
                    <div key={s.emoji} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: isTop ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isTop ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 20 }}>
                        {[0,1,2].map(n => <SymbolEl key={n} emoji={s.emoji} size={22} />)}
                        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', marginLeft: 4 }}>{s.label}</span>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 15, color: isTop ? '#F59E0B' : '#10B981', fontFamily: '"Courier New",monospace' }}>{s.multiplier}×</span>
                    </div>
                  );
                })}
                {/* Two of a kind row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>Any two matching</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#10B981', fontFamily: '"Courier New",monospace' }}>1.25×</span>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>How It Works</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: '🎮', title: 'Getting Started', body: <>Use <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>/slots</code> in Discord for your link. You need a Discord account linked to your Fuji Studio profile.</> },
                  { icon: '🪙', title: 'Placing a Bet',   body: <>Min bet <b>10 coins</b>, max is the lesser of <b>500 coins</b> or <b>half your balance</b> — you can never lose everything in a single spin.</> },
                  { icon: '🏆', title: 'Winning',         body: <>Three matching symbols pays the multiplier shown. Two matching pays <b>1.25×</b> — a small profit every time two line up. Wins are capped at <b>5,000 coins</b>.</> },
                  { icon: '💬', title: 'Your Coins',      body: <>Wins and losses use your real server balance — the same coins earned from chatting, daily rewards, and the shop. 3-second cooldown between spins.</> },
                  { icon: '🎲', title: 'Fairness',        body: <>All rolls happen server-side before the animation — the outcome is decided when you click Spin, not during the animation.</> },
                ].map(item => (
                  <div key={item.title} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(248,250,252,0.85)', marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)', lineHeight: 1.6 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent spins */}
            {history.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Recent Spins</span>
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {history.map((h, i) => (
                    <div key={h.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: h.net > 0 ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.06)',
                      border: `1px solid ${h.net > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.15)'}`,
                      borderRadius: 8,
                      animation: i === 0 ? 'slots-result-pop 0.3s ease-out' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 20 }}>
                        {h.reels.map((e, ri) => <SymbolEl key={ri} emoji={e} size={22} />)}
                        {h.multiplier > 1 && h.net > 0 && (
                          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', marginLeft: 4, fontFamily: '"Courier New",monospace' }}>{h.multiplier}×</span>
                        )}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 13, color: h.net > 0 ? '#10B981' : colors.tertiary, fontVariantNumeric: 'tabular-nums', fontFamily: '"Courier New",monospace' }}>
                        {h.net > 0 ? '+' : ''}{h.net.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DiscoveryLayout>
  );
};
