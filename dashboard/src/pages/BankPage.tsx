/**
 * Public site page — /bank
 * Member-facing view of the bank feature (savings + loans) built on top of the
 * same EconomyAccount data the Discord /bank commands use (via BankService).
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
    Landmark, PiggyBank, TrendingUp, Wallet, ShieldCheck, ArrowDownToLine, ArrowUpFromLine,
    HandCoins, Loader2, Link2, Info,
} from 'lucide-react';
import { AltSidebar, BG, PRIMARY, SECONDARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const GREEN = '#57F287';
const RED = '#ED4245';
const YELLOW = '#FEE75C';

interface BankSummary {
    wallet: number;
    savings: number;
    creditScore: number;
    maxLoan: number;
    canBorrow: boolean;
    borrowBlockedReason: 'outstanding_loan' | 'credit_score' | 'activity' | null;
    isFirstLoan: boolean;
    activityEarned: number;
    activeLoan: { id: string; totalOwed: number; dueAt: string; status: string } | null;
    settings: { currencyEmoji: string; currencyName: string; savingsInterestRatePct: number; savingsInterestIntervalHours: number; loanFeePct: number; loanTermDays: number; minCreditScoreToBorrow: number; minEarnedToBorrow: number };
    recentTransactions: { id: string; type: string; amount: number; reason: string | null; createdAt: string }[];
}

const typeIcon: Record<string, React.ElementType> = { DEPOSIT: ArrowDownToLine, WITHDRAW: ArrowUpFromLine, LOAN: HandCoins, REPAY: ShieldCheck, INTEREST: TrendingUp };

function fmtDate(d: string) {
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const BankPage: React.FC = () => {
    const { player } = usePlayer();
    const { user, loading: authLoading } = useAuth();

    const [summary, setSummary] = useState<BankSummary | null>(null);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'link_required' | 'error'>('loading');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [depositAmt, setDepositAmt] = useState('');
    const [withdrawAmt, setWithdrawAmt] = useState('');
    const [loanAmt, setLoanAmt] = useState('');
    const [repayAmt, setRepayAmt] = useState('');

    const load = useCallback(async () => {
        try {
            const r = await axios.get('/api/bank/me', { withCredentials: true });
            setSummary(r.data);
            setLoadState('ready');
        } catch (e: any) {
            if (e.response?.data?.error === 'link_discord_required') setLoadState('link_required');
            else setLoadState('error');
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        load();
    }, [user, load]);

    const act = async (fn: () => Promise<any>, clearFn: () => void) => {
        setBusy(true); setError(null);
        try {
            await fn();
            clearFn();
            await load();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    const doDeposit = () => act(() => axios.post('/api/bank/deposit', { amount: Number(depositAmt) }, { withCredentials: true }), () => setDepositAmt(''));
    const doWithdraw = () => act(() => axios.post('/api/bank/withdraw', { amount: Number(withdrawAmt) }, { withCredentials: true }), () => setWithdrawAmt(''));
    const doLoan = () => act(() => axios.post('/api/bank/loan', { amount: Number(loanAmt) }, { withCredentials: true }), () => setLoanAmt(''));
    const doRepay = () => act(() => axios.post('/api/bank/repay', repayAmt ? { amount: Number(repayAmt) } : {}, { withCredentials: true }), () => setRepayAmt(''));

    const card: React.CSSProperties = { ...glass, borderRadius: 18, padding: '22px 24px' };
    const input: React.CSSProperties = { flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', minWidth: 0 };
    const btn = (bg: string): React.CSSProperties => ({ padding: '10px 18px', borderRadius: 10, border: 'none', background: bg, color: '#0a0d18', fontWeight: 800, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' });

    let body: React.ReactNode;

    if (authLoading || (user && loadState === 'loading')) {
        body = <div style={{ ...card, textAlign: 'center', padding: 48, color: SUB }}><Loader2 size={22} className="h2h-spin" /></div>;
    } else if (!user) {
        body = (
            <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <Landmark size={38} color={SECONDARY} style={{ opacity: 0.8, marginBottom: 12 }} />
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Sign in to use the Bank</div>
                <p style={{ margin: '0 auto 20px', color: SUB, fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>Save coins, earn interest, and borrow against your credit score.</p>
                <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`, color: '#0a0d18', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                    <Landmark size={16} /> Sign In
                </a>
            </div>
        );
    } else if (loadState === 'link_required') {
        body = (
            <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <Link2 size={38} color={SECONDARY} style={{ opacity: 0.8, marginBottom: 12 }} />
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Link your Discord account</div>
                <p style={{ margin: '0 auto 20px', color: SUB, fontSize: 14, maxWidth: 380, lineHeight: 1.6 }}>
                    The bank runs on the same coins you earn in Discord. Link your account from Settings → Connections to use it here.
                </p>
                <a href="/account" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`, color: '#0a0d18', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                    <Link2 size={16} /> Go to Account Settings
                </a>
            </div>
        );
    } else if (loadState === 'error' || !summary) {
        body = <div style={{ ...card, textAlign: 'center', padding: 48, color: SUB }}>Failed to load your bank account. Try refreshing.</div>;
    } else {
        const em = summary.settings.currencyEmoji;
        const loan = summary.activeLoan;
        body = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {error && (
                    <div style={{ ...card, padding: '12px 18px', border: `1px solid ${RED}55`, color: RED, fontSize: 13, fontWeight: 600 }}>{error}</div>
                )}

                {/* Overview cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}><Wallet size={14} /> Wallet</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{em} {summary.wallet.toLocaleString()}</div>
                    </div>
                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}><PiggyBank size={14} /> Savings</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: GREEN }}>{em} {summary.savings.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{summary.settings.savingsInterestRatePct}% every {summary.settings.savingsInterestIntervalHours}h</div>
                    </div>
                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}><ShieldCheck size={14} /> Credit Score</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: summary.creditScore >= 650 ? GREEN : summary.creditScore >= 500 ? YELLOW : RED }}>{summary.creditScore}</div>
                        <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>Max loan: {em} {summary.maxLoan.toLocaleString()}</div>
                    </div>
                </div>

                {/* How it works */}
                <div style={{ ...card, background: 'rgba(76,215,246,0.06)', border: `1px solid ${SECONDARY}33` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Info size={16} color={SECONDARY} />
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>How the Bank Works</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, fontSize: 13, color: SUB, lineHeight: 1.6 }}>
                        <div>
                            <div style={{ color: GREEN, fontWeight: 700, marginBottom: 4 }}>Savings</div>
                            Coins you deposit sit safely in savings and quietly earn <strong style={{ color: TEXT }}>{summary.settings.savingsInterestRatePct}% interest every {summary.settings.savingsInterestIntervalHours} hours</strong>, just for leaving them there. Withdraw back to your wallet anytime, no penalty.
                        </div>
                        <div>
                            <div style={{ color: YELLOW, fontWeight: 700, marginBottom: 4 }}>Loans</div>
                            Borrow up to your max loan amount instantly. You'll owe the amount borrowed plus a flat <strong style={{ color: TEXT }}>{summary.settings.loanFeePct}% fee</strong>, due in <strong style={{ color: TEXT }}>{summary.settings.loanTermDays} days</strong>. You can only have <strong style={{ color: TEXT }}>one loan out at a time</strong>, so repay it (in full or partial amounts) before borrowing again. Your <strong style={{ color: TEXT }}>first</strong> loan unlocks once you've earned <strong style={{ color: TEXT }}>{em} {summary.settings.minEarnedToBorrow.toLocaleString()}</strong> from your own activity in the server.
                        </div>
                        <div>
                            <div style={{ color: SECONDARY, fontWeight: 700, marginBottom: 4 }}>Credit Score</div>
                            Everyone starts at <strong style={{ color: TEXT }}>650</strong> (range 300 to 850). Repaying a loan <strong style={{ color: TEXT }}>on time</strong> gives <strong style={{ color: GREEN }}>+20</strong>; repaying <strong style={{ color: TEXT }}>late</strong> still gives <strong style={{ color: GREEN }}>+10</strong>. Missing the due date entirely marks the loan <strong style={{ color: RED }}>defaulted</strong> and costs <strong style={{ color: RED }}>-60</strong>. Nothing is taken from you by force, it's purely a credit hit, but a defaulted loan still has to be repaid before you can borrow again.
                        </div>
                        <div>
                            <div style={{ color: TEXT, fontWeight: 700, marginBottom: 4 }}>Your max loan</div>
                            Your credit score sets how much you can borrow. A higher score raises your limit, and you need at least <strong style={{ color: TEXT }}>{summary.settings.minCreditScoreToBorrow}</strong> credit to borrow at all. Right now your max is <strong style={{ color: TEXT }}>{em} {summary.maxLoan.toLocaleString()}</strong>.
                        </div>
                    </div>
                </div>

                {/* Deposit / Withdraw */}
                <div style={card}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Move Coins</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <input style={input} type="number" min={1} placeholder="Amount to deposit" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} />
                        <button style={btn(GREEN)} disabled={busy || !depositAmt} onClick={doDeposit}>Deposit</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <input style={input} type="number" min={1} placeholder="Amount to withdraw" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
                        <button style={btn(SECONDARY)} disabled={busy || !withdrawAmt} onClick={doWithdraw}>Withdraw</button>
                    </div>
                </div>

                {/* Loan */}
                <div style={card}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Loan</div>
                    {loan ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', background: loan.status === 'defaulted' ? `${RED}22` : `${YELLOW}22`, color: loan.status === 'defaulted' ? RED : YELLOW }}>
                                    {loan.status === 'defaulted' ? 'Defaulted' : 'Active'}
                                </span>
                                <span style={{ color: SUB, fontSize: 13 }}>
                                    Owe {em} <strong style={{ color: TEXT }}>{loan.totalOwed.toLocaleString()}</strong> · {loan.status === 'defaulted' ? 'was due' : 'due'} {fmtDate(loan.dueAt)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                <input style={input} type="number" min={1} placeholder={`Amount (default: full ${loan.totalOwed.toLocaleString()})`} value={repayAmt} onChange={e => setRepayAmt(e.target.value)} />
                                <button style={btn(GREEN)} disabled={busy} onClick={doRepay}>Repay</button>
                            </div>
                        </>
                    ) : summary.canBorrow ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            <input style={input} type="number" min={1} max={summary.maxLoan} placeholder={`Up to ${em} ${summary.maxLoan.toLocaleString()} · ${summary.settings.loanFeePct}% fee · ${summary.settings.loanTermDays}d term`} value={loanAmt} onChange={e => setLoanAmt(e.target.value)} />
                            <button style={btn(YELLOW)} disabled={busy || !loanAmt} onClick={doLoan}>Borrow</button>
                        </div>
                    ) : summary.borrowBlockedReason === 'activity' ? (
                        <div style={{ fontSize: 13, color: SUB }}>
                            <div style={{ marginBottom: 8 }}>
                                Before your first loan you need to earn <strong style={{ color: TEXT }}>{em} {summary.settings.minEarnedToBorrow.toLocaleString()}</strong> through your own activity in the server. You're at <strong style={{ color: TEXT }}>{em} {summary.activityEarned.toLocaleString()}</strong>.
                            </div>
                            <div style={{ height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
                                <div style={{ width: `${Math.min(100, (summary.activityEarned / Math.max(1, summary.settings.minEarnedToBorrow)) * 100)}%`, height: '100%', background: SECONDARY }} />
                            </div>
                            <div style={{ fontSize: 12 }}>Coins other members send you don't count toward this, only what you earn yourself by taking part.</div>
                        </div>
                    ) : (
                        <div style={{ color: SUB, fontSize: 13 }}>Your credit score is too low to borrow right now. Build it back up by repaying on time.</div>
                    )}
                </div>

                {/* Recent activity */}
                <div style={card}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Recent Activity</div>
                    {summary.recentTransactions.length === 0 ? (
                        <div style={{ color: SUB, fontSize: 13 }}>No bank activity yet.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {summary.recentTransactions.map(t => {
                                const Icon = typeIcon[t.type] || TrendingUp;
                                return (
                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                        <Icon size={14} color={SECONDARY} />
                                        <span style={{ fontWeight: 700, color: TEXT }}>{t.type}</span>
                                        <span style={{ color: SUB }}>{em} {t.amount.toLocaleString()}{t.reason ? ` · ${t.reason}` : ''}</span>
                                        <span style={{ marginLeft: 'auto', color: SUB, fontSize: 11 }}>{fmtDate(t.createdAt)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Bank" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Bank' }]} />
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                        <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '32px', boxSizing: 'border-box' }}>
                            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Landmark size={26} color={PRIMARY} /> Bank
                            </h1>
                            <p style={{ margin: '0 0 24px', color: SUB, fontSize: 14 }}>Save your coins, earn interest, and borrow against your credit score.</p>
                            {body}
                        </div>
                    </div>
                    <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
