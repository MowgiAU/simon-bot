/**
 * Public site page — /market
 * Fuji Markets: trade shares in artists and genre indexes, on the same coin
 * balance the Discord /stocks commands use (both go through MarketService).
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
    TrendingUp, TrendingDown, Minus, LineChart, Wallet, Loader2, Link2, Info, Headphones, BarChart3,
} from 'lucide-react';
import { AltSidebar, BG, PRIMARY, SECONDARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const GREEN = '#57F287';
const RED = '#ED4245';

interface Stock {
    id: string; type: string; ticker: string; name: string;
    price: number; prevClose: number; sharesOutstanding: number; status: string;
}
interface Holding {
    stockId: string; ticker: string; name: string; shares: number;
    avgCost: number; price: number; value: number; pnl: number;
}

/** Custom Discord emoji (<:name:id>) would render as literal text here. */
const coin = (e?: string) => (e && !e.startsWith('<') ? e : '🪙');

const changePct = (s: Stock) => (!s.prevClose ? 0 : ((s.price - s.prevClose) / s.prevClose) * 100);

function Spark({ points }: { points: { price: number }[] }) {
    if (points.length < 2) return <div style={{ height: 40, color: SUB, fontSize: 12 }}>Not enough price history yet.</div>;
    const vals = points.map(p => p.price);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const w = 320, h = 48;
    const d = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ');
    const up = vals[vals.length - 1] >= vals[0];
    return (
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={48} preserveAspectRatio="none" style={{ display: 'block' }}>
            <polyline points={d} fill="none" stroke={up ? GREEN : RED} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

export const MarketPage: React.FC = () => {
    const { player } = usePlayer();
    const { user, loading: authLoading } = useAuth();

    const [market, setMarket] = useState<{ enabled: boolean; sharesTotal: number; currencyEmoji: string; stocks: Stock[] } | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [history, setHistory] = useState<{ price: number }[]>([]);
    const [portfolio, setPortfolio] = useState<{ wallet: number; holdings: Holding[]; holdingsValue: number } | null>(null);
    const [linkRequired, setLinkRequired] = useState(false);
    const [qty, setQty] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const loadMarket = useCallback(async () => {
        try {
            const r = await axios.get('/api/market/stocks');
            setMarket(r.data);
            setSelected(prev => prev ?? (r.data.stocks[0]?.ticker ?? null));
        } catch { setError('Could not load the market.'); }
    }, []);

    const loadPortfolio = useCallback(async () => {
        if (!user) return;
        try {
            const r = await axios.get('/api/market/portfolio', { withCredentials: true });
            setPortfolio(r.data);
            setLinkRequired(false);
        } catch (e: any) {
            if (e.response?.data?.error === 'link_discord_required') setLinkRequired(true);
        }
    }, [user]);

    useEffect(() => { loadMarket(); }, [loadMarket]);
    useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

    useEffect(() => {
        if (!selected) return;
        axios.get(`/api/market/stocks/${selected}`)
            .then(r => setHistory(r.data.history || []))
            .catch(() => setHistory([]));
    }, [selected, market]);

    const trade = async (action: 'buy' | 'sell') => {
        if (!selected || !qty) return;
        setBusy(true); setError(null); setNotice(null);
        try {
            const r = await axios.post(`/api/market/${action}`, { ticker: selected, shares: Number(qty) }, { withCredentials: true });
            setNotice(action === 'buy'
                ? `Bought ${r.data.shares} ${selected} for ${coin(market?.currencyEmoji)} ${r.data.totalCharge.toLocaleString()}${r.data.partial ? ' (partial fill)' : ''}`
                : `Sold ${r.data.shares} ${selected} for ${coin(market?.currencyEmoji)} ${r.data.payout.toLocaleString()}`);
            setQty('');
            await Promise.all([loadMarket(), loadPortfolio()]);
        } catch (e: any) {
            setError(e.response?.data?.error || 'Trade failed.');
        } finally { setBusy(false); }
    };

    const em = coin(market?.currencyEmoji);
    const card: React.CSSProperties = { ...glass, borderRadius: 18, padding: '20px 22px' };
    const input: React.CSSProperties = { flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', minWidth: 0 };
    const btn = (bg: string): React.CSSProperties => ({ padding: '10px 18px', borderRadius: 10, border: 'none', background: bg, color: '#0a0d18', fontWeight: 800, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 });

    const sel = market?.stocks.find(s => s.ticker === selected) || null;
    const myHolding = portfolio?.holdings.find(h => h.ticker === selected);

    let tradePanel: React.ReactNode;
    if (authLoading) tradePanel = <div style={{ color: SUB, textAlign: 'center', padding: 20 }}><Loader2 size={20} /></div>;
    else if (!user) tradePanel = (
        <div style={{ textAlign: 'center' }}>
            <p style={{ color: SUB, fontSize: 13, margin: '0 0 14px' }}>Sign in to start trading.</p>
            <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`, color: '#0a0d18', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Sign In</a>
        </div>
    );
    else if (linkRequired) tradePanel = (
        <div style={{ textAlign: 'center' }}>
            <Link2 size={26} color={SECONDARY} style={{ marginBottom: 8 }} />
            <p style={{ color: SUB, fontSize: 13, margin: '0 0 14px' }}>Link your Discord account to trade with your coins.</p>
            <a href="/account" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`, color: '#0a0d18', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Account Settings</a>
        </div>
    );
    else tradePanel = (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: SUB, marginBottom: 12 }}>
                <span>Wallet</span>
                <strong style={{ color: TEXT }}>{em} {(portfolio?.wallet ?? 0).toLocaleString()}</strong>
            </div>
            {sel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: SUB, marginBottom: 12 }}>
                    <span>You hold</span>
                    <strong style={{ color: TEXT }}>{myHolding?.shares ?? 0} {sel.ticker}</strong>
                </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={input} type="number" min={1} placeholder="Shares" value={qty} onChange={e => setQty(e.target.value)} />
                <button style={btn(GREEN)} disabled={busy || !qty || !sel} onClick={() => trade('buy')}>Buy</button>
                <button style={btn(SECONDARY)} disabled={busy || !qty || !sel} onClick={() => trade('sell')}>Sell</button>
            </div>
            {notice && <div style={{ marginTop: 10, fontSize: 12, color: GREEN }}>{notice}</div>}
            {error && <div style={{ marginTop: 10, fontSize: 12, color: RED }}>{error}</div>}
        </>
    );

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Market" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Market' }]} />
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: 32, boxSizing: 'border-box' }}>
                        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <LineChart size={26} color={PRIMARY} /> Fuji Markets
                        </h1>
                        <p style={{ margin: '0 0 24px', color: SUB, fontSize: 14 }}>Back the producers and genres you think are rising.</p>

                        {!market ? (
                            <div style={{ ...card, textAlign: 'center', padding: 48, color: SUB }}><Loader2 size={22} /></div>
                        ) : !market.enabled ? (
                            <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                                <LineChart size={34} color={SECONDARY} style={{ opacity: 0.8, marginBottom: 10 }} />
                                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 6 }}>The market is closed</div>
                                <p style={{ color: SUB, fontSize: 13, margin: 0 }}>Trading hasn't opened in this server yet. Check back soon.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
                                {/* Board */}
                                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                                    <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}`, fontSize: 15, fontWeight: 800, color: '#fff' }}>
                                        Listings
                                    </div>
                                    {market.stocks.length === 0 ? (
                                        <div style={{ padding: 32, color: SUB, fontSize: 13, textAlign: 'center' }}>
                                            No artists are listed yet. Stocks appear once an artist meets the listing requirements.
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <tbody>
                                                    {market.stocks.map(s => {
                                                        const pct = changePct(s);
                                                        const Icon = pct > 0.05 ? TrendingUp : pct < -0.05 ? TrendingDown : Minus;
                                                        const col = pct > 0.05 ? GREEN : pct < -0.05 ? RED : SUB;
                                                        const active = s.ticker === selected;
                                                        return (
                                                            <tr key={s.id} onClick={() => setSelected(s.ticker)}
                                                                style={{ cursor: 'pointer', background: active ? 'rgba(255,255,255,0.05)' : 'transparent', borderBottom: `1px solid ${BORDER}` }}>
                                                                <td style={{ padding: '12px 22px', whiteSpace: 'nowrap' }}>
                                                                    {s.type === 'ETF' ? <BarChart3 size={13} color={SUB} style={{ verticalAlign: -2, marginRight: 6 }} /> : <Headphones size={13} color={SUB} style={{ verticalAlign: -2, marginRight: 6 }} />}
                                                                    <strong style={{ color: TEXT }}>{s.ticker}</strong>
                                                                    <span style={{ color: SUB, marginLeft: 8 }}>{s.name}</span>
                                                                </td>
                                                                <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: TEXT }}>{em} {s.price.toFixed(2)}</td>
                                                                <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: col }}>
                                                                    <Icon size={12} style={{ verticalAlign: -1 }} /> {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                                                </td>
                                                                <td style={{ padding: '12px 22px', textAlign: 'right', whiteSpace: 'nowrap', color: SUB }}>
                                                                    {market.sharesTotal - s.sharesOutstanding} free
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Right rail */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {sel && (
                                        <div style={card}>
                                            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{sel.ticker}</div>
                                            <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>{sel.name}</div>
                                            <Spark points={history} />
                                            <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: TEXT }}>{em} {sel.price.toFixed(2)}</div>
                                        </div>
                                    )}

                                    <div style={card}>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Trade</div>
                                        {tradePanel}
                                    </div>

                                    {portfolio && portfolio.holdings.length > 0 && (
                                        <div style={card}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
                                                <Wallet size={15} /> Portfolio
                                            </div>
                                            {portfolio.holdings.map(h => (
                                                <div key={h.stockId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                                                    <span style={{ color: TEXT }}><strong>{h.ticker}</strong> <span style={{ color: SUB }}>×{h.shares}</span></span>
                                                    <span style={{ color: h.pnl >= 0 ? GREEN : RED }}>{h.pnl >= 0 ? '+' : ''}{Math.round(h.pnl).toLocaleString()}</span>
                                                </div>
                                            ))}
                                            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: SUB }}>Value</span>
                                                <strong style={{ color: TEXT }}>{em} {Math.round(portfolio.holdingsValue).toLocaleString()}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Zero-sum is a real property of the design, not fine print — say it plainly. */}
                        <div style={{ ...card, marginTop: 20, background: 'rgba(76,215,246,0.06)', border: `1px solid ${SECONDARY}33` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Info size={16} color={SECONDARY} />
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>How Fuji Markets Works</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, fontSize: 13, color: SUB, lineHeight: 1.6 }}>
                                <div>
                                    <div style={{ color: TEXT, fontWeight: 700, marginBottom: 4 }}>What sets the price</div>
                                    Each artist's price tracks how many real listeners played their music recently, plus their following. Buying pushes a price up and selling pushes it down, so the price is part fundamentals and part demand.
                                </div>
                                <div>
                                    <div style={{ color: TEXT, fontWeight: 700, marginBottom: 4 }}>It's zero-sum</div>
                                    Coins are never created or destroyed here. The total value of the market is fixed, so one artist rising is funded by the others falling. The game is spotting who is rising <em>relative to everyone else</em>.
                                </div>
                                <div>
                                    <div style={{ color: TEXT, fontWeight: 700, marginBottom: 4 }}>The rules</div>
                                    Every stock has {market?.sharesTotal ?? 1000} shares. You can't trade your own stock, there's a small fee on each trade, a bigger one if you sell again quickly, and a minimum holding time before you can sell.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
