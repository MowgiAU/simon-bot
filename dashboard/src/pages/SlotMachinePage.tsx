import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';

// ─── Neon palette (Stitch concept) ────────────────────────────────────────
const N = {
  green:   '#00e38b',
  greenBright: '#00ff9d',
  pink:    '#ffaaf6',
  cyan:    '#00daf3',
  dark:    '#0a0e14',
  surface: '#10141a',
  card:    '#1c2026',
  cardHi:  '#262a31',
  border:  '#3b4a3f',
  text:    '#dfe2eb',
  textDim: '#849587',
};

const DEFAULT_SYMBOLS = [
  { emoji: '🎵', label: 'Note',       weight: 40, multiplier: 3  },
  { emoji: '🎸', label: 'Guitar',     weight: 25, multiplier: 4  },
  { emoji: '🎹', label: 'Piano',      weight: 20, multiplier: 5  },
  { emoji: '🎧', label: 'Headphones', weight: 10, multiplier: 7  },
  { emoji: '💎', label: 'Diamond',    weight: 4,  multiplier: 10 },
  { emoji: '🔥', label: 'Fire',       weight: 1,  multiplier: 20 },
];

interface SlotSymbol { emoji: string; label: string; weight: number; multiplier: number; imageUrl?: string; }
interface SlotSounds { spin?: string; win?: string; jackpot?: string; twoMatch?: string; loss?: string; }
interface SpinResult { reels: string[]; payout: number; multiplier: number; net: number; newBalance: number; currencyEmoji: string; }
interface HistoryEntry { reels: string[]; net: number; multiplier: number; id: number; }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function playSound(url?: string) { if (!url) return; try { new Audio(url).play(); } catch {} }

const STYLES = `
  @keyframes neon-payline {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes spin-pulse {
    0%,100%{ box-shadow: 0 0 20px rgba(0,227,139,0.5), 0 0 60px rgba(0,227,139,0.15), inset 0 1px 0 rgba(255,255,255,0.15); }
    50%    { box-shadow: 0 0 40px rgba(0,227,139,0.85), 0 0 100px rgba(0,227,139,0.3), inset 0 1px 0 rgba(255,255,255,0.25); }
  }
  @keyframes win-flash-green {
    0%   { background: rgba(0,227,139,0); }
    20%  { background: rgba(0,227,139,0.22); }
    100% { background: rgba(0,227,139,0); }
  }
  @keyframes jackpot-flash {
    0%   { background: rgba(255,170,246,0); }
    20%  { background: rgba(255,170,246,0.28); }
    55%  { background: rgba(255,170,246,0.1); }
    75%  { background: rgba(255,170,246,0.24); }
    100% { background: rgba(255,170,246,0); }
  }
  @keyframes loss-shake {
    0%,100%{ transform:translateX(0); }
    15%{ transform:translateX(-8px); }
    35%{ transform:translateX(8px); }
    55%{ transform:translateX(-5px); }
    75%{ transform:translateX(5px); }
  }
  @keyframes cell-blur {
    0%,100%{ filter:blur(0) brightness(1); }
    50%    { filter:blur(3px) brightness(0.6); }
  }
  @keyframes result-pop {
    0%  { opacity:0; transform:scale(0.85) translateY(8px); }
    60% { transform:scale(1.06) translateY(-2px); }
    100%{ opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes balance-tick {
    0%  { transform:scale(1); }
    40% { transform:scale(1.16); color:${N.greenBright}; }
    100%{ transform:scale(1); }
  }
  @keyframes jackpot-text {
    0%,100%{ text-shadow:0 0 12px rgba(255,170,246,0.8), 0 0 30px rgba(255,170,246,0.3); color:${N.pink}; }
    50%    { text-shadow:0 0 28px rgba(255,170,246,1), 0 0 60px rgba(255,170,246,0.5); color:#fff; }
  }
  @keyframes win-banner {
    0%,100%{ opacity:0; transform:translate(-50%,-50%) scale(0.7); }
    15%,85%{ opacity:0.12; transform:translate(-50%,-50%) scale(1.1); }
    50%    { opacity:0.22; transform:translate(-50%,-50%) scale(1.2); }
  }
  @keyframes history-in {
    from{ opacity:0; transform:translateX(-12px); }
    to  { opacity:1; transform:translateX(0); }
  }
  @keyframes reel-lock-bounce {
    0%  { transform:scale(1.1); }
    100%{ transform:scale(1); }
  }
  @keyframes orb-float {
    0%,100%{ transform:translate(0,0); }
    50%    { transform:translate(25px,-18px); }
  }
  .spin-btn-ready     { animation: spin-pulse 1.6s ease-in-out infinite; }
  .win-overlay        { animation: win-flash-green 0.8s ease-out forwards; }
  .jackpot-overlay    { animation: jackpot-flash 1s ease-out forwards; }
  .loss-shake         { animation: loss-shake 0.45s ease-in-out; }
  .cell-spinning      { animation: cell-blur 0.12s ease-in-out infinite; }
  .result-pop         { animation: result-pop 0.38s ease-out forwards; }
  .balance-tick       { animation: balance-tick 0.38s ease-out; }
  .jackpot-text       { animation: jackpot-text 1.3s ease-in-out infinite; }
  .win-banner-txt     { animation: win-banner 3s ease-in-out forwards; }
  .history-in         { animation: history-in 0.3s ease-out forwards; }
  .reel-lock-bounce   { animation: reel-lock-bounce 0.2s ease-out; }
`;

// ─── Particle canvas ───────────────────────────────────────────────────────
const ParticleCanvas: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width  = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    const particles = Array.from({ length: active ? 55 : 30 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.5) * 0.7,
      opacity: Math.random() * 0.45 + 0.05,
      color: Math.random() > 0.6 ? N.pink : N.green,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
};

// ─── Component ─────────────────────────────────────────────────────────────
export const SlotMachinePage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance]             = useState<number | null>(null);
  const [currencyEmoji, setCurrencyEmoji] = useState('🪙');
  const [currencyName, setCurrencyName]   = useState('Coins');
  const [symbols, setSymbols]             = useState<SlotSymbol[]>(DEFAULT_SYMBOLS);
  const [sounds, setSounds]               = useState<SlotSounds>({});
  const [bet, setBet]                     = useState(10);
  const [spinning, setSpinning]           = useState(false);
  // 3×3 grid: [col0, col1, col2] each has [top, mid, bot]
  const [grid, setGrid]                   = useState<string[][]>([['🎵','🎸','🎹'],['🎸','🎹','🎵'],['🎹','🎵','🎸']]);
  const [lockedCols, setLockedCols]       = useState([false, false, false]);
  const [result, setResult]               = useState<SpinResult | null>(null);
  const [history, setHistory]             = useState<HistoryEntry[]>([]);
  const [cooldown, setCooldown]           = useState(0);
  const [error, setError]                 = useState<string | null>(null);
  const [needsDiscord, setNeedsDiscord]   = useState(false);
  const [flashClass, setFlashClass]       = useState('');
  const [shakeGrid, setShakeGrid]         = useState(false);
  const [balancePop, setBalancePop]       = useState(false);
  const [resultKey, setResultKey]         = useState(0);
  const [showWinBanner, setShowWinBanner] = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 900);

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
  const rnd       = () => emojiList[Math.floor(Math.random() * emojiList.length)] || '🎵';
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
    setError(null); setResult(null); setFlashClass(''); setShakeGrid(false);
    setShowWinBanner(false); setLockedCols([false, false, false]);
    setSpinning(true);
    playSound(sounds.spin);

    spinIntervalRef.current = setInterval(() => {
      setGrid([[rnd(),rnd(),rnd()],[rnd(),rnd(),rnd()],[rnd(),rnd(),rnd()]]);
    }, 70);

    try {
      const res = await fetch('/api/slots/spin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ bet }),
      });
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

      // Settle columns one by one (mid row = result, top/bot = random)
      for (let col = 0; col < 3; col++) {
        setGrid(g => g.map((c, i) => i === col ? [rnd(), sr.reels[col], rnd()] : c));
        setLockedCols(l => l.map((v, i) => i === col ? true : v));
        await sleep(300);
      }

      const isJackpot = sr.multiplier >= 10;
      if (sr.net > 0) {
        setFlashClass(isJackpot ? 'jackpot-overlay' : 'win-overlay');
        if (isJackpot) { setShowWinBanner(true); setTimeout(() => setShowWinBanner(false), 3000); }
        playSound(isJackpot ? (sounds.jackpot || sounds.win) : sounds.win);
      } else if (sr.net === 0) {
        playSound(sounds.twoMatch);
      } else {
        setShakeGrid(true); setTimeout(() => setShakeGrid(false), 500);
        playSound(sounds.loss);
      }

      setResult(sr); setResultKey(k => k + 1);
      setBalance(sr.newBalance); setCurrencyEmoji(sr.currencyEmoji);
      setBalancePop(true); setTimeout(() => setBalancePop(false), 450);
      setSessionWagered(w => w + bet);
      setSessionNet(n => n + sr.net);
      setSpinCount(c => c + 1);
      setHistory(prev => [{ reels: sr.reels, net: sr.net, multiplier: sr.multiplier, id: ++historyIdRef.current }, ...prev].slice(0, 10));
      startCooldown(3);
    } catch {
      clearInterval(spinIntervalRef.current!);
      setError('Connection error — try again.');
    } finally { setSpinning(false); }
  };

  // Per-cell glow for the middle row when result is known
  const cellGlow = (col: number): React.CSSProperties => {
    if (!result || spinning) return {};
    const [a, b, c] = result.reels;
    if (a === b && b === c) return {
      borderColor: result.multiplier >= 10 ? N.pink : N.green,
      boxShadow: result.multiplier >= 10
        ? `0 0 24px ${N.pink}99, inset 0 0 12px ${N.pink}15`
        : `0 0 24px ${N.green}99, inset 0 0 12px ${N.green}15`,
    };
    const pairs = { 0: a===b||a===c, 1: a===b||b===c, 2: a===c||b===c };
    if (pairs[col as 0|1|2]) return { borderColor: N.cyan, boxShadow: `0 0 16px ${N.cyan}70` };
    return { borderColor: 'rgba(255,255,255,0.06)' };
  };

  const resultColor = result
    ? result.net > 0 ? (result.multiplier >= 10 ? N.pink : N.green) : result.net === 0 ? N.cyan : '#ff6b6b'
    : 'transparent';

  const isJackpot = !!(result && result.multiplier >= 10 && result.net > 0);

  const SymEl = ({ emoji, size = 20 }: { emoji: string; size?: number }) =>
    imageMap.has(emoji)
      ? <img src={imageMap.get(emoji)} alt={emoji} style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }} />
      : <span>{emoji}</span>;

  const topMultiplier = Math.max(...symbols.map(s => s.multiplier));
  const topSymbol     = symbols.find(s => s.multiplier === topMultiplier);

  return (
    <DiscoveryLayout>
      <style>{STYLES}</style>

      {/* Ambient orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, ${N.green}0d 0%, transparent 65%)`, top: '-15%', left: '10%', animation: 'orb-float 22s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${N.pink}0a 0%, transparent 65%)`, bottom: '5%', right: '5%', animation: 'orb-float 28s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${N.cyan}08 0%, transparent 65%)`, top: '45%', left: '2%', animation: 'orb-float 18s ease-in-out infinite 5s' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '16px 10px 80px' : '32px 20px 80px', maxWidth: 1020, margin: '0 auto' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            margin: 0, fontSize: isMobile ? 28 : 44, fontWeight: 900,
            letterSpacing: '-0.04em', textTransform: 'uppercase',
            background: `linear-gradient(90deg, ${N.green}, ${N.cyan}, ${N.green})`,
            backgroundSize: '200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Fuji Slots
          </h1>
          <p style={{ margin: '6px 0 0', color: N.textDim, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Win Big · Play Fair · Real Coins
          </p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' }}>

          {/* ════ LEFT — Machine ════ */}
          <div style={{ flex: '0 0 auto', width: isMobile ? '100%' : 460 }}>

            {/* Cabinet */}
            <div style={{
              background: `linear-gradient(170deg, #141a24 0%, ${N.surface} 100%)`,
              border: `1px solid ${N.border}`,
              borderRadius: 28,
              overflow: 'visible',
              boxShadow: `0 0 0 1px ${N.green}15, 0 40px 100px rgba(0,0,0,0.8)`,
              position: 'relative',
            }}>

              {/* Flash overlay */}
              <div className={flashClass} style={{ position: 'absolute', inset: 0, borderRadius: 28, pointerEvents: 'none', zIndex: 10 }} />

              {/* Win banner */}
              {showWinBanner && (
                <div className="win-banner-txt" style={{
                  position: 'absolute', top: '40%', left: '50%', zIndex: 20,
                  fontSize: isMobile ? 72 : 100, fontWeight: 900, letterSpacing: '-0.05em',
                  color: N.pink, pointerEvents: 'none', whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  filter: `drop-shadow(0 0 20px ${N.pink})`,
                }}>
                  WIN!
                </div>
              )}

              {/* Header */}
              <div style={{
                background: `linear-gradient(90deg, ${N.green}18, ${N.cyan}18)`,
                borderBottom: `1px solid ${N.border}`,
                borderRadius: '28px 28px 0 0',
                padding: '14px 22px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: N.textDim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 3 }}>{currencyName}</div>
                  <div className={balancePop ? 'balance-tick' : ''} style={{
                    fontSize: 22, fontWeight: 800, color: N.text,
                    fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', display: 'inline-block',
                  }}>
                    {balance === null ? '———' : `${currencyEmoji} ${balance.toLocaleString()}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: N.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Max Win</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: N.pink, filter: `drop-shadow(0 0 6px ${N.pink}80)`, fontFamily: 'monospace' }}>{currencyEmoji} 5,000</div>
                </div>
              </div>

              {needsDiscord ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: N.textDim, fontSize: 14 }}>
                  Link your Discord account to play.
                </div>
              ) : loading || balance === null ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: `${N.textDim}60`, letterSpacing: '0.2em', fontSize: 11, textTransform: 'uppercase' }}>Loading...</div>
              ) : (<>

                {/* Bet control */}
                <div style={{ padding: '16px 22px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 10, color: N.textDim, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    <span>Bet Amount</span>
                    <span>Max {currencyEmoji} {maxBet.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: N.card, borderRadius: 14, padding: '6px 10px', border: `1px solid ${N.border}` }}>
                    {(['MIN', '-100', '-10'] as const).map(lbl => (
                      <button key={lbl} onClick={() => lbl==='MIN'?setBet(10):adjustBet(lbl==='-100'?-100:-10)} disabled={spinning}
                        style={{ flex:1, padding:'8px 0', fontSize:11, fontWeight:700, background:N.cardHi, color:N.textDim, border:`1px solid ${N.border}`, borderRadius:8, cursor:spinning?'not-allowed':'pointer', opacity:spinning?0.3:1 }}>
                        {lbl}
                      </button>
                    ))}
                    <div style={{ flex:2, textAlign:'center', fontWeight:900, fontSize:26, color:N.text, fontFamily:'monospace', letterSpacing:'-0.02em', filter:`drop-shadow(0 0 8px ${N.green}50)` }}>
                      {bet.toLocaleString()}
                    </div>
                    {(['+10', '+100', 'MAX'] as const).map(lbl => (
                      <button key={lbl} onClick={() => lbl==='MAX'?setBet(maxBet):adjustBet(lbl==='+100'?100:10)} disabled={spinning}
                        style={{ flex:1, padding:'8px 0', fontSize:11, fontWeight:700, background:N.cardHi, color:N.textDim, border:`1px solid ${N.border}`, borderRadius:8, cursor:spinning?'not-allowed':'pointer', opacity:spinning?0.3:1 }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── 3×3 Reel Grid ── */}
                <div style={{ padding: '8px 18px 0', position: 'relative' }}>
                  <div className={shakeGrid ? 'loss-shake' : ''} style={{ position: 'relative' }}>
                    <ParticleCanvas active={isJackpot} />

                    {/* Payline indicator */}
                    <div style={{
                      position: 'absolute', top: '50%', left: -2, right: -2,
                      height: 3, marginTop: -1,
                      background: `linear-gradient(90deg, transparent, ${N.green}50, ${N.green}, ${N.cyan}, ${N.green}, ${N.green}50, transparent)`,
                      backgroundSize: '200% 100%',
                      animation: 'neon-payline 3s linear infinite',
                      pointerEvents: 'none', zIndex: 5,
                    }} />
                    {/* Payline dots */}
                    <div style={{ position: 'absolute', top: '50%', left: -8, width: 12, height: 12, borderRadius: '50%', background: N.green, marginTop: -6, zIndex: 6, boxShadow: `0 0 8px ${N.green}` }} />
                    <div style={{ position: 'absolute', top: '50%', right: -8, width: 12, height: 12, borderRadius: '50%', background: N.green, marginTop: -6, zIndex: 6, boxShadow: `0 0 8px ${N.green}` }} />

                    {/* Grid: 3 columns, each with 3 cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, position: 'relative', zIndex: 2 }}>
                      {[0, 1, 2].map(col => (
                        <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {[0, 1, 2].map(row => {
                            const emoji = grid[col]?.[row] ?? '🎵';
                            const isMidRow = row === 1;
                            const isLocked = lockedCols[col];
                            const isSpinning = spinning && !isLocked;
                            return (
                              <div key={row} className={isLocked && isMidRow ? 'reel-lock-bounce' : ''} style={{
                                height: isMidRow ? 100 : 72,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isMidRow
                                  ? `linear-gradient(160deg, rgba(255,255,255,0.05), rgba(0,0,0,0.5))`
                                  : `rgba(0,0,0,0.3)`,
                                border: `2px solid ${isMidRow ? N.border : 'rgba(255,255,255,0.04)'}`,
                                borderRadius: isMidRow ? 16 : 12,
                                fontSize: isMidRow ? 48 : 28,
                                opacity: isMidRow ? 1 : 0.45,
                                userSelect: 'none',
                                transition: 'border-color 0.3s, box-shadow 0.3s',
                                position: 'relative', overflow: 'hidden',
                                ...(isMidRow ? cellGlow(col) : {}),
                              }}>
                                {isMidRow && (
                                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)', borderRadius: '14px 14px 0 0', pointerEvents: 'none' }} />
                                )}
                                <div className={isSpinning ? 'cell-spinning' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {imageMap.has(emoji)
                                    ? <img src={imageMap.get(emoji)} alt={emoji} style={{ width: isMidRow ? '62%' : '55%', height: isMidRow ? '62%' : '55%', objectFit: 'contain' }} />
                                    : emoji}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Result strip */}
                <div style={{
                  minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 22px 4px', transition: 'background 0.4s',
                }}>
                  {result && !spinning && (
                    <div key={resultKey} className="result-pop" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>
                        {result.net > 0 ? (isJackpot ? '🏆' : result.multiplier === 1.25 ? '✨' : '🎉') : '💨'}
                      </span>
                      <span className={isJackpot ? 'jackpot-text' : ''} style={{
                        fontWeight: 900, fontSize: 15, color: resultColor,
                        letterSpacing: '0.04em', fontFamily: 'monospace',
                      }}>
                        {result.net > 0
                          ? isJackpot
                            ? `★ JACKPOT! +${result.net.toLocaleString()} ${currencyEmoji} ★`
                            : result.multiplier === 1.25
                            ? `Two of a Kind — you receive ${currencyEmoji} ${result.net.toLocaleString()} bonus`
                            : `Win! +${result.net.toLocaleString()} ${currencyEmoji} — ${result.multiplier}×`
                          : `Lost ${currencyEmoji} ${bet.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  {error && <span style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</span>}
                </div>

                {/* ── CIRCULAR SPIN BUTTON ── */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 28px', position: 'relative' }}>
                  <button
                    onClick={spin} disabled={!canSpin}
                    className={canSpin ? 'spin-btn-ready' : ''}
                    style={{
                      width: 128, height: 128, borderRadius: '50%',
                      fontSize: 15, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase',
                      background: canSpin
                        ? `radial-gradient(circle at 40% 35%, ${N.greenBright}, ${N.green} 50%, #007a50 100%)`
                        : 'rgba(255,255,255,0.04)',
                      color: canSpin ? '#001a0e' : 'rgba(148,163,184,0.2)',
                      border: canSpin ? `2px solid ${N.green}80` : '1px solid rgba(255,255,255,0.06)',
                      cursor: canSpin ? 'pointer' : 'not-allowed',
                      transition: 'background 0.3s',
                      ...(canSpin ? { boxShadow: `inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.3)` } : {}),
                    }}>
                    {spinning ? '◈' : cooldown > 0 ? `${cooldown}s` : balance !== null && balance < 10 ? '—' : 'SPIN'}
                  </button>
                </div>

                {/* Session stats */}
                {spinCount > 0 && (
                  <div style={{ borderTop: `1px solid ${N.border}`, display: 'flex' }}>
                    {[
                      { label: 'Spins',   value: spinCount.toString() },
                      { label: 'Wagered', value: `${currencyEmoji} ${sessionWagered.toLocaleString()}` },
                      { label: 'Net',     value: `${sessionNet >= 0 ? '+' : ''}${sessionNet.toLocaleString()}`, color: sessionNet > 0 ? N.green : sessionNet < 0 ? '#ff6b6b' : N.textDim },
                    ].map((s, i, arr) => (
                      <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? `1px solid ${N.border}` : 'none', padding: '10px 0' }}>
                        <div style={{ fontSize: 9, color: N.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: s.color || `${N.text}90`, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>)}
            </div>
          </div>

          {/* ════ RIGHT — Info Panel ════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            {/* Paytable */}
            <div style={{ background: N.card, border: `1px solid ${N.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px 8px', borderBottom: `1px solid ${N.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: N.text }}>Paytable</span>
                <span style={{ fontSize: 10, color: N.textDim }}>multiplier × bet = total returned</span>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...symbols].sort((a, b) => b.multiplier - a.multiplier).map((s, i) => {
                  const accent = i === 0 ? N.pink : i === 1 ? N.cyan : N.green;
                  return (
                    <div key={s.emoji} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: `rgba(0,0,0,0.2)`,
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: '0 8px 8px 0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 20 }}>
                        {[0,1,2].map(n => <SymEl key={n} emoji={s.emoji} size={22} />)}
                        <span style={{ fontSize: 11, color: N.textDim, marginLeft: 4 }}>{s.label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: accent, fontFamily: 'monospace' }}>{s.multiplier}×</div>
                        <div style={{ fontSize: 10, color: N.textDim, fontFamily: 'monospace' }}>+{((s.multiplier - 1) * 100).toFixed(0)}% profit</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${N.cyan}60`, borderRadius: '0 8px 8px 0' }}>
                  <span style={{ fontSize: 13, color: N.textDim }}>Any two matching</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: N.cyan, fontFamily: 'monospace' }}>+5% bonus</div>
                    <div style={{ fontSize: 10, color: N.textDim, fontFamily: 'monospace' }}>min. +5 coins</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: `${N.textDim}60`, padding: '2px 2px', lineHeight: 1.5 }}>
                  e.g. bet 100 → hit {topSymbol?.emoji}{topSymbol?.emoji}{topSymbol?.emoji} → receive {((topSymbol?.multiplier ?? 3) * 100).toLocaleString()} back (+{(((topSymbol?.multiplier ?? 3) - 1) * 100).toLocaleString()} profit)
                </div>
              </div>
            </div>

            {/* How it works */}
            <div style={{ background: N.card, border: `1px solid ${N.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px 8px', borderBottom: `1px solid ${N.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: N.text }}>How It Works</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { num: '1', col: N.green,  title: 'Getting Started',  body: <>Use <code style={{ background: 'rgba(0,227,139,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 11, color: N.green }}>/slots</code> in Discord for your link. You need a Discord account linked to your Fuji Studio profile.</> },
                  { num: '2', col: N.pink,   title: 'Placing a Bet',    body: <>Min bet <b>10 coins</b>, max is the lesser of <b>500 coins</b> or <b>half your balance</b> — you can never lose everything in a single spin.</> },
                  { num: '3', col: N.cyan,   title: 'Winning',          body: <>Three matching symbols on the centre payline returns the multiplier × your bet. Two matching pays a <b>flat bonus</b> (5% of bet, minimum 5 coins). Wins capped at <b>5,000 coins</b>.</> },
                  { num: '4', col: N.green,  title: 'Your Coins',       body: <>Wins and losses use your real server balance. 3-second cooldown between spins. Daily limits reset at midnight UTC.</> },
                  { num: '5', col: N.textDim,title: 'Fairness',         body: <>All rolls happen server-side before the animation — the outcome is decided when you click Spin, not during the animation.</> },
                ].map(item => (
                  <div key={item.title} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${item.col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: item.col, flexShrink: 0 }}>{item.num}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: N.text, marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: N.textDim, lineHeight: 1.65 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent spins */}
            {history.length > 0 && (
              <div style={{ background: N.card, border: `1px solid ${N.border}`, borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px 8px', borderBottom: `1px solid ${N.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: N.text }}>Recent Spins</span>
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {history.map((h, i) => {
                    const accent = h.net > 0 ? N.green : '#ff6b6b';
                    return (
                      <div key={h.id} className={i === 0 ? 'history-in' : ''} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px',
                        background: 'rgba(0,0,0,0.2)',
                        borderLeft: `3px solid ${accent}60`,
                        borderRadius: '0 8px 8px 0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 20 }}>
                          {h.reels.map((e, ri) => <SymEl key={ri} emoji={e} size={22} />)}
                          {h.multiplier > 1 && h.net > 0 && <span style={{ fontSize: 10, color: N.textDim, marginLeft: 4, fontFamily: 'monospace' }}>{h.multiplier}×</span>}
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 13, color: accent, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                          {h.net > 0 ? '+' : ''}{h.net.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DiscoveryLayout>
  );
};
