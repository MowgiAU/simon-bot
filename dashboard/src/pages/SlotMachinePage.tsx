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

interface SlotSymbol { emoji: string; label: string; weight: number; multiplier: number; imageUrl?: string; }
interface SlotSounds { spin?: string; win?: string; jackpot?: string; twoMatch?: string; loss?: string; }
interface SpinResult { reels: string[]; payout: number; multiplier: number; net: number; newBalance: number; currencyEmoji: string; }
interface HistoryEntry { reels: string[]; net: number; multiplier: number; id: number; }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function playSound(url?: string) { if (!url) return; try { new Audio(url).play(); } catch {} }

const STYLES = `
  @keyframes slots-pulse {
    0%, 100% { box-shadow: 0 0 28px rgba(16,185,129,0.5), 0 0 80px rgba(16,185,129,0.15); }
    50%       { box-shadow: 0 0 44px rgba(16,185,129,0.8), 0 0 100px rgba(16,185,129,0.25); }
  }
  @keyframes slots-win-flash {
    0%   { background: rgba(16,185,129,0); }
    25%  { background: rgba(16,185,129,0.22); }
    100% { background: rgba(16,185,129,0); }
  }
  @keyframes slots-jackpot-flash {
    0%   { background: rgba(245,158,11,0); }
    20%  { background: rgba(245,158,11,0.28); }
    50%  { background: rgba(245,158,11,0.1); }
    75%  { background: rgba(245,158,11,0.22); }
    100% { background: rgba(245,158,11,0); }
  }
  @keyframes slots-loss-shake {
    0%,100%{ transform:translateX(0); }
    20%    { transform:translateX(-7px); }
    40%    { transform:translateX(7px); }
    60%    { transform:translateX(-4px); }
    80%    { transform:translateX(4px); }
  }
  @keyframes slots-reel-blur {
    0%,100%{ filter:blur(0); }
    50%    { filter:blur(2.5px) brightness(0.75); }
  }
  @keyframes slots-result-in {
    from { opacity:0; transform:translateY(8px) scale(0.96); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes slots-balance-pop {
    0%   { transform:scale(1); }
    40%  { transform:scale(1.15); color:#10B981; }
    100% { transform:scale(1); }
  }
  @keyframes slots-history-in {
    from { opacity:0; transform:translateX(-10px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes slots-title-flicker {
    0%,94%,100%{ opacity:1; }
    95%{ opacity:0.75; }
    97%{ opacity:1; }
    98%{ opacity:0.8; }
  }
  @keyframes slots-orb-drift {
    0%,100%{ transform:translate(0,0) scale(1); }
    33%    { transform:translate(30px,-20px) scale(1.1); }
    66%    { transform:translate(-20px,15px) scale(0.95); }
  }
  @keyframes slots-payline-pulse {
    0%,100%{ opacity:0.4; }
    50%    { opacity:1; }
  }
  @keyframes slots-jackpot-text {
    0%,100%{ text-shadow:0 0 10px rgba(245,158,11,0.6); }
    50%    { text-shadow:0 0 24px rgba(245,158,11,1), 0 0 48px rgba(245,158,11,0.4); }
  }
  .slots-spin-btn-ready { animation: slots-pulse 1.8s ease-in-out infinite; }
  .slots-win-overlay    { animation: slots-win-flash 0.8s ease-out forwards; }
  .slots-jackpot-overlay{ animation: slots-jackpot-flash 1s ease-out forwards; }
  .slots-loss-shake     { animation: slots-loss-shake 0.45s ease-in-out; }
  .slots-reel-spinning  { animation: slots-reel-blur 0.14s ease-in-out infinite; }
  .slots-result-in      { animation: slots-result-in 0.35s ease-out forwards; }
  .slots-balance-pop    { animation: slots-balance-pop 0.4s ease-out; }
  .slots-history-in     { animation: slots-history-in 0.3s ease-out forwards; }
  .slots-title          { animation: slots-title-flicker 9s ease-in-out infinite; }
  .slots-jackpot-text   { animation: slots-jackpot-text 1.5s ease-in-out infinite; }
  .slots-payline        { animation: slots-payline-pulse 2s ease-in-out infinite; }
`;

export const SlotMachinePage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance]         = useState<number | null>(null);
  const [currencyEmoji, setCurrencyEmoji] = useState('🪙');
  const [currencyName, setCurrencyName]   = useState('Coins');
  const [symbols, setSymbols]         = useState<SlotSymbol[]>(DEFAULT_SYMBOLS);
  const [sounds, setSounds]           = useState<SlotSounds>({});
  const [bet, setBet]                 = useState(10);
  const [spinning, setSpinning]       = useState(false);
  const [displayReels, setDisplayReels] = useState(['🎵', '🎸', '🎹']);
  const [lockedReels, setLockedReels] = useState([false, false, false]);
  const [result, setResult]           = useState<SpinResult | null>(null);
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [cooldown, setCooldown]       = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [needsDiscord, setNeedsDiscord] = useState(false);
  const [flashClass, setFlashClass]   = useState('');
  const [shakeReels, setShakeReels]   = useState(false);
  const [balancePop, setBalancePop]   = useState(false);
  const [resultKey, setResultKey]     = useState(0);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 900);

  // Session stats
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

      await sleep(1400);
      clearInterval(spinIntervalRef.current!);

      setDisplayReels([sr.reels[0], rndEmoji(), rndEmoji()]); setLockedReels([true, false, false]); await sleep(300);
      setDisplayReels([sr.reels[0], sr.reels[1], rndEmoji()]); setLockedReels([true, true, false]); await sleep(300);
      setDisplayReels(sr.reels); setLockedReels([true, true, true]);

      const isJackpot = sr.multiplier >= 10;
      if (sr.net > 0) { setFlashClass(isJackpot ? 'slots-jackpot-overlay' : 'slots-win-overlay'); playSound(isJackpot ? (sounds.jackpot || sounds.win) : sounds.win); }
      else if (sr.net === 0) { playSound(sounds.twoMatch); }
      else { setShakeReels(true); setTimeout(() => setShakeReels(false), 500); playSound(sounds.loss); }

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
    if (a === b && b === c) return {
      borderColor: result.multiplier >= 10 ? '#F59E0B' : colors.primary,
      boxShadow: result.multiplier >= 10
        ? '0 0 32px rgba(245,158,11,0.65), inset 0 0 16px rgba(245,158,11,0.1)'
        : '0 0 32px rgba(16,185,129,0.6), inset 0 0 16px rgba(16,185,129,0.1)',
    };
    const pairs: Record<number, boolean> = { 0: a===b||a===c, 1: a===b||b===c, 2: a===c||b===c };
    if (pairs[i]) return { borderColor: '#F59E0B', boxShadow: '0 0 18px rgba(245,158,11,0.45)' };
    return { borderColor: 'rgba(255,255,255,0.05)' };
  };

  const resultColor = result
    ? result.net > 0 ? (result.multiplier >= 10 ? '#F59E0B' : colors.primary) : result.net === 0 ? '#F59E0B' : colors.tertiary
    : 'transparent';

  const spinLabel = spinning ? '◈  SPINNING' : cooldown > 0 ? `WAIT  ${cooldown}s` : balance !== null && balance < 10 ? 'NO COINS' : '◈  SPIN';

  const ReelSymbol = ({ emoji }: { emoji: string }) => imageMap.has(emoji)
    ? <img src={imageMap.get(emoji)} alt={emoji} style={{ width: '62%', height: '62%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
    : <span style={{ pointerEvents: 'none' }}>{emoji}</span>;

  const SymbolCell = ({ emoji, size = 18 }: { emoji: string; size?: number }) => imageMap.has(emoji)
    ? <img src={imageMap.get(emoji)} alt={emoji} style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }} />
    : <span>{emoji}</span>;

  return (
    <DiscoveryLayout>
      <style>{STYLES}</style>

      {/* ── Ambient background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)', top: '-10%', left: '20%', animation: 'slots-orb-drift 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', bottom: '10%', right: '10%', animation: 'slots-orb-drift 24s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)', top: '40%', left: '5%', animation: 'slots-orb-drift 20s ease-in-out infinite 4s' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '24px 12px 80px' : '36px 24px 80px', maxWidth: 980, margin: '0 auto' }}>

        {/* ── Page title ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 className="slots-title" style={{
            margin: 0, fontSize: isMobile ? 28 : 36, fontWeight: 900, letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'linear-gradient(90deg, #10B981 0%, #06B6D4 50%, #10B981 100%)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Fuji Slots
          </h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(148,163,184,0.5)', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Spend your server coins · Win big or go home
          </p>
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* ═══════════════════════════════════════
              LEFT — The Machine
          ════════════════════════════════════════ */}
          <div style={{ flex: '0 0 auto', width: isMobile ? '100%' : 440 }}>
            <div style={{
              background: 'linear-gradient(180deg, #131b2e 0%, #0b0f19 100%)',
              border: '1px solid rgba(16,185,129,0.28)',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(16,185,129,0.07), 0 32px 80px rgba(0,0,0,0.7)',
              position: 'relative',
            }}>
              <div className={flashClass} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, borderRadius: 24 }} />

              {/* ── Header strip ── */}
              <div style={{
                background: 'linear-gradient(90deg, rgba(16,185,129,0.14), rgba(6,182,212,0.14))',
                borderBottom: '1px solid rgba(16,185,129,0.22)',
                padding: '16px 22px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Balance</div>
                  <div className={balancePop ? 'slots-balance-pop' : ''} style={{ fontSize: 22, fontWeight: 800, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums', display: 'inline-block' }}>
                    {balance === null ? '—' : `${currencyEmoji} ${balance.toLocaleString()}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Max Win</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>{currencyEmoji} 5,000</div>
                </div>
              </div>

              {needsDiscord ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.6)', fontSize: 14 }}>
                  Link your Discord account to access your balance.
                </div>
              ) : loading || balance === null ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.3)', letterSpacing: '0.15em', fontSize: 12 }}>LOADING...</div>
              ) : (<>

                {/* ── Reel window ── */}
                <div style={{ padding: '20px 18px 16px', background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
                  {/* Top/bottom depth fades */}
                  <div style={{ position:'absolute', top:20, left:18, right:18, height:36, background:'linear-gradient(to bottom,rgba(11,15,25,0.75),transparent)', pointerEvents:'none', zIndex:2, borderRadius:'14px 14px 0 0' }} />
                  <div style={{ position:'absolute', bottom:16, left:18, right:18, height:36, background:'linear-gradient(to top,rgba(11,15,25,0.75),transparent)', pointerEvents:'none', zIndex:2, borderRadius:'0 0 14px 14px' }} />

                  {/* Lock dots */}
                  <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:10 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width:7, height:7, borderRadius:'50%', transition:'all 0.25s',
                        background: lockedReels[i] ? (result && result.reels[0]===result.reels[1]&&result.reels[1]===result.reels[2] ? (result.multiplier>=10?'#F59E0B':colors.primary) : '#F59E0B') : 'rgba(255,255,255,0.1)',
                        boxShadow: lockedReels[i] ? `0 0 8px rgba(16,185,129,0.9)` : 'none',
                      }} />
                    ))}
                  </div>

                  {/* Payline bar */}
                  <div className="slots-payline" style={{ position:'absolute', top:'50%', left:18, right:18, height:2, background:'linear-gradient(90deg, transparent, rgba(16,185,129,0.35), transparent)', pointerEvents:'none', zIndex:3, marginTop:10 }} />

                  {/* Reels */}
                  <div className={shakeReels ? 'slots-loss-shake' : ''} style={{ display:'flex', gap:10 }}>
                    {displayReels.map((emoji, i) => (
                      <div key={i} style={{
                        flex:1, aspectRatio:'1',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'rgba(0,0,0,0.4)',
                        border:'2px solid rgba(255,255,255,0.07)',
                        borderRadius:16, fontSize:52, lineHeight:1,
                        userSelect:'none', transition:'border-color 0.3s, box-shadow 0.3s',
                        position:'relative', overflow:'hidden',
                        ...reelGlow(i),
                      }}>
                        <div className={spinning && !lockedReels[i] ? 'slots-reel-spinning' : ''} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' }}>
                          <ReelSymbol emoji={emoji} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Result banner ── */}
                <div style={{
                  minHeight:48, display:'flex', alignItems:'center', justifyContent:'center',
                  borderBottom:'1px solid rgba(255,255,255,0.04)', padding:'0 20px',
                  background: result && !spinning
                    ? result.net > 0 ? 'rgba(16,185,129,0.07)' : result.net===0 ? 'rgba(245,158,11,0.07)' : 'rgba(244,63,94,0.07)'
                    : 'transparent',
                  transition:'background 0.5s',
                }}>
                  {result && !spinning && (
                    <div key={resultKey} className="slots-result-in" style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:22 }}>{result.net>0?(result.multiplier>=10?'🏆':'✨'):result.net===0?'🔄':'💨'}</span>
                      <span className={result.multiplier>=10&&result.net>0?'slots-jackpot-text':''} style={{ fontWeight:800, fontSize:15, color:resultColor, letterSpacing:'0.03em' }}>
                        {result.net > 0
                          ? `${result.multiplier>=10?'JACKPOT!  ':''}Won ${currencyEmoji} ${result.payout.toLocaleString()} — ${result.multiplier}×`
                          : result.net === 0
                          ? 'Two of a kind — coins back'
                          : `Lost ${currencyEmoji} ${bet.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  {error && <span style={{ color:colors.error, fontSize:13 }}>{error}</span>}
                </div>

                {/* ── Bet controls ── */}
                <div style={{ padding:'14px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:10, color:'rgba(148,163,184,0.4)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Bet Amount</span>
                    <span style={{ fontSize:10, color:'rgba(148,163,184,0.4)' }}>Max {currencyEmoji} {maxBet.toLocaleString()}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {(['MIN','-100','-10'] as const).map(lbl => (
                      <button key={lbl} onClick={() => lbl==='MIN'?setBet(10):adjustBet(lbl==='-100'?-100:-10)} disabled={spinning}
                        style={{ flex:1, padding:'9px 0', fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.04)', color:'rgba(148,163,184,0.65)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:spinning?'not-allowed':'pointer', opacity:spinning?0.35:1, letterSpacing:'0.04em' }}>
                        {lbl}
                      </button>
                    ))}
                    <div style={{ flex:2, textAlign:'center', fontWeight:900, fontSize:24, color:'#F8FAFC', fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }}>
                      {bet.toLocaleString()}
                    </div>
                    {(['+10','+100','MAX'] as const).map(lbl => (
                      <button key={lbl} onClick={() => lbl==='MAX'?setBet(maxBet):adjustBet(lbl==='+100'?100:10)} disabled={spinning}
                        style={{ flex:1, padding:'9px 0', fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.04)', color:'rgba(148,163,184,0.65)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:spinning?'not-allowed':'pointer', opacity:spinning?0.35:1, letterSpacing:'0.04em' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── SPIN ── */}
                <div style={{ padding:'0 18px 20px' }}>
                  <button onClick={spin} disabled={!canSpin} className={canSpin?'slots-spin-btn-ready':''}
                    style={{
                      width:'100%', padding:'20px', fontSize:17, fontWeight:900, letterSpacing:'0.22em', textTransform:'uppercase',
                      background: canSpin ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' : 'rgba(255,255,255,0.04)',
                      color: canSpin ? '#fff' : 'rgba(148,163,184,0.25)',
                      border: canSpin ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius:14, cursor:canSpin?'pointer':'not-allowed', transition:'background 0.3s, color 0.3s',
                    }}>
                    {spinLabel}
                  </button>
                </div>

                {/* ── Session stats ── */}
                {spinCount > 0 && (
                  <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', padding:'12px 18px', display:'flex', gap:0 }}>
                    {[
                      { label:'Spins',    value: spinCount.toString() },
                      { label:'Wagered',  value: `${currencyEmoji} ${sessionWagered.toLocaleString()}` },
                      { label:'Net',      value: `${sessionNet >= 0 ? '+' : ''}${sessionNet.toLocaleString()}`, color: sessionNet > 0 ? colors.primary : sessionNet < 0 ? colors.tertiary : 'rgba(148,163,184,0.6)' },
                    ].map((s, i, arr) => (
                      <div key={s.label} style={{ flex:1, textAlign:'center', borderRight: i < arr.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', padding:'2px 0' }}>
                        <div style={{ fontSize:10, color:'rgba(148,163,184,0.35)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:3 }}>{s.label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color: s.color || 'rgba(248,250,252,0.7)', fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>)}
            </div>
          </div>

          {/* ═══════════════════════════════════════
              RIGHT — Info panel
          ════════════════════════════════════════ */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16, minWidth:0 }}>

            {/* Paytable */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'16px 18px' }}>
              <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14 }}>Paytable</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[...symbols].reverse().map(s => {
                  const isJackpot = s.multiplier >= 10;
                  return (
                    <div key={s.emoji} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'8px 12px',
                      background: isJackpot ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isJackpot ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius:8,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:18 }}>
                        {[0,1,2].map(n => <SymbolCell key={n} emoji={s.emoji} size={22} />)}
                        <span style={{ fontSize:12, color:'rgba(148,163,184,0.5)', marginLeft:4 }}>{s.label}</span>
                      </div>
                      <span style={{ fontWeight:800, fontSize:15, color: isJackpot ? '#F59E0B' : colors.primary }}>
                        {s.multiplier}×
                      </span>
                    </div>
                  );
                })}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)', borderRadius:8 }}>
                  <span style={{ fontSize:13, color:'rgba(148,163,184,0.55)' }}>Any two matching</span>
                  <span style={{ fontWeight:700, fontSize:14, color:'#F59E0B' }}>Push</span>
                </div>
              </div>
            </div>

            {/* How it works — expanded by default */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'16px 18px' }}>
              <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14 }}>How It Works</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { title:'Getting Started', body: <>Use <code style={{ background:'rgba(255,255,255,0.08)', padding:'1px 6px', borderRadius:4, fontSize:12 }}>/slots</code> in Discord to get your link. You need a Discord account linked to your Fuji Studio profile to play.</> },
                  { title:'Placing a Bet',   body: <>Use the +/− buttons to set your wager. Minimum is <b>10 coins</b>, maximum is the lesser of <b>500 coins</b> or <b>half your balance</b> — you can never lose everything in one spin.</> },
                  { title:'Winning',         body: <>Three matching symbols pays the multiplier in the paytable. Two matching symbols returns your bet with no profit or loss. Wins are capped at <b>5,000 coins</b> per spin.</> },
                  { title:'Your Coins',      body: <>Wins and losses update your real server balance — the same coins you earn from chatting, daily rewards, and the shop. There is a <b>3-second cooldown</b> between spins.</> },
                  { title:'Fairness',        body: <>All rolls happen server-side before the animation starts. The spinning reels are purely visual — the outcome is already decided when you click Spin.</> },
                ].map(item => (
                  <div key={item.title}>
                    <div style={{ fontSize:13, fontWeight:700, color:'rgba(248,250,252,0.85)', marginBottom:4 }}>{item.title}</div>
                    <div style={{ fontSize:13, color:'rgba(148,163,184,0.7)', lineHeight:1.65 }}>{item.body}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent spins */}
            {history.length > 0 && (
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'16px 18px' }}>
                <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>Recent Spins</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {history.map((h, i) => (
                    <div key={h.id} className={i === 0 ? 'slots-history-in' : ''} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'8px 12px',
                      background: h.net>0?'rgba(16,185,129,0.07)':h.net===0?'rgba(245,158,11,0.07)':'rgba(244,63,94,0.06)',
                      border:`1px solid ${h.net>0?'rgba(16,185,129,0.18)':h.net===0?'rgba(245,158,11,0.18)':'rgba(244,63,94,0.14)'}`,
                      borderRadius:8,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:20 }}>
                        {h.reels.map((e, ri) => <SymbolCell key={ri} emoji={e} size={22} />)}
                        {h.multiplier > 1 && h.net > 0 && (
                          <span style={{ fontSize:11, color:'rgba(148,163,184,0.4)', marginLeft:4 }}>{h.multiplier}×</span>
                        )}
                      </div>
                      <span style={{ fontWeight:700, fontSize:13, color:h.net>0?colors.primary:h.net===0?'#F59E0B':colors.tertiary, fontVariantNumeric:'tabular-nums' }}>
                        {h.net>0?'+':''}{h.net.toLocaleString()}
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
