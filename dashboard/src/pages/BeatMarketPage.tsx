import React from 'react';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    TrendingUp, Coins, Trophy, Zap, BarChart3,
    Music, MessageSquare, Heart, Swords, ChevronRight,
} from 'lucide-react';

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{
        background: colors.surface,
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: borderRadius.lg,
        padding: '24px',
        ...style,
    }}>
        {children}
    </div>
);

const StepCard: React.FC<{ number: number; title: string; description: string; icon: React.ReactNode }> = ({ number, title, description, icon }) => (
    <div style={{
        display: 'flex', gap: '16px', alignItems: 'flex-start',
        background: colors.surface,
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: borderRadius.lg,
        padding: '20px',
    }}>
        <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(16,232,122,0.12)',
            border: `2px solid rgba(16,232,122,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: colors.primary, fontWeight: 800, fontSize: '16px',
        }}>
            {number}
        </div>
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: colors.primary }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: '15px', color: colors.textPrimary }}>{title}</span>
            </div>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '14px', lineHeight: 1.6 }}>{description}</p>
        </div>
    </div>
);

const HypeSource: React.FC<{ icon: React.ReactNode; label: string; points: string }> = ({ icon, label, points }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: borderRadius.md,
        border: `1px solid rgba(255,255,255,0.05)`,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.textSecondary, fontSize: '14px' }}>
            <span style={{ color: colors.primary }}>{icon}</span>
            {label}
        </div>
        <span style={{
            background: 'rgba(16,232,122,0.12)', color: colors.primary,
            borderRadius: borderRadius.pill, padding: '3px 10px',
            fontSize: '12px', fontWeight: 700,
        }}>
            {points}
        </span>
    </div>
);

const PayoutRow: React.FC<{ rank: string; emoji: string; mult: string; color: string }> = ({ rank, emoji, mult, color }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: borderRadius.md,
        borderLeft: `3px solid ${color}`,
        marginBottom: 6,
    }}>
        <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{emoji} {rank}</span>
        <span style={{ color, fontWeight: 800, fontSize: '16px' }}>{mult}</span>
    </div>
);

export const BeatMarketPage: React.FC = () => {
    return (
        <DiscoveryLayout>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

                {/* Hero */}
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 20,
                        background: 'rgba(16,232,122,0.1)',
                        border: '2px solid rgba(16,232,122,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <TrendingUp size={32} color={colors.primary} />
                    </div>
                    <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
                        Beat Market
                    </h1>
                    <p style={{ margin: '0 auto', maxWidth: 560, color: colors.textSecondary, fontSize: 16, lineHeight: 1.7 }}>
                        Invest your server coins in music genre trends and earn based on what actually blows up in the community each week.
                    </p>
                </div>

                {/* How it works — steps */}
                <h2 style={{ color: colors.textPrimary, fontWeight: 700, fontSize: 20, marginBottom: 16, marginTop: 0 }}>
                    How It Works
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
                    <StepCard
                        number={1} icon={<TrendingUp size={16} />}
                        title="5 Trends Drop Every Week"
                        description="At the start of each season, 5 genre cards are randomly drawn from the genres producers on this server actually use — pulled from track uploads and musician profiles. Every season is different."
                    />
                    <StepCard
                        number={2} icon={<Coins size={16} />}
                        title="Stake Your Coins"
                        description='Use the /invest command to put your coins behind the genre you think will be hottest this week. You can invest in multiple trends, but each trend can only be bet on once.'
                    />
                    <StepCard
                        number={3} icon={<BarChart3 size={16} />}
                        title="Hype Builds Organically"
                        description="Trends gain Hype Points based on real server activity — every track uploaded, liked, or played in that genre adds to its score. The community decides the winner just by doing what they normally do."
                    />
                    <StepCard
                        number={4} icon={<Trophy size={16} />}
                        title="Payouts at Season End"
                        description="When the week ends, trends are ranked by total Hype Points. Investors in higher-ranked trends earn back more than they staked. Back the top trend and walk away with 1.6× your coins."
                    />
                </div>

                {/* Payout table + Hype sources side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 48 }}>
                    <Card>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary, fontWeight: 700, fontSize: 16 }}>
                            Payout Multipliers
                        </h3>
                        <PayoutRow rank="1st Place" emoji="🥇" mult="1.6×" color="#FFD700" />
                        <PayoutRow rank="2nd Place" emoji="🥈" mult="1.3×" color="#C0C0C0" />
                        <PayoutRow rank="3rd Place" emoji="🥉" mult="1.1×" color="#CD7F32" />
                        <PayoutRow rank="4th Place" emoji="4️⃣" mult="0.9×" color={colors.textTertiary} />
                        <PayoutRow rank="5th Place" emoji="5️⃣" mult="0.7×" color={colors.error} />
                        <p style={{ margin: '12px 0 0', color: colors.textTertiary, fontSize: '12px' }}>
                            Example: invest 🪙500 in the winning trend → receive 🪙800 back.
                        </p>
                    </Card>

                    <Card>
                        <h3 style={{ margin: '0 0 16px', color: colors.textPrimary, fontWeight: 700, fontSize: 16 }}>
                            What Generates Hype
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <HypeSource icon={<Music size={14} />} label="Track uploaded in genre" points="+10 hype" />
                            <HypeSource icon={<Zap size={14} />} label="Track played in genre" points="+1 per play" />
                            <HypeSource icon={<Heart size={14} />} label="Track liked in genre" points="+3 hype" />
                            <HypeSource icon={<Swords size={14} />} label="Battle entry in genre" points="+15 hype" />
                            <HypeSource icon={<MessageSquare size={14} />} label="Genre mentioned in chat" points="+1 hype" />
                        </div>
                        <p style={{ margin: '12px 0 0', color: colors.textTertiary, fontSize: '12px' }}>
                            Hype is updated every 30 minutes. Mentioning a genre by name in chat counts too.
                        </p>
                    </Card>
                </div>

                {/* Rules */}
                <Card style={{ marginBottom: 48 }}>
                    <h3 style={{ margin: '0 0 16px', color: colors.textPrimary, fontWeight: 700, fontSize: 16 }}>
                        Investment Rules
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            { emoji: '💰', rule: 'Minimum investment: 10 coins per trend' },
                            { emoji: '📊', rule: 'Max per trend: 25% of your current balance' },
                            { emoji: '🗓️', rule: 'Max total per season: 1,000 coins' },
                            { emoji: '🔒', rule: 'Investments are locked in — you cannot withdraw once placed' },
                            { emoji: '🎯', rule: 'One investment per trend per season — choose wisely' },
                        ].map(({ emoji, rule }) => (
                            <div key={rule} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>
                                <span style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: 1.5 }}>{rule}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Commands */}
                <h2 style={{ color: colors.textPrimary, fontWeight: 700, fontSize: 20, marginBottom: 16, marginTop: 0 }}>
                    Discord Commands
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 48 }}>
                    {[
                        { cmd: '/market-trends', desc: 'See the 5 active trends with live hype rankings and community investment totals' },
                        { cmd: '/invest <trend> <amount>', desc: 'Stake coins on a trend — autocomplete makes it easy to find the right one' },
                        { cmd: '/portfolio', desc: 'Check your active positions and see your earnings from past seasons' },
                        { cmd: '/market-history', desc: 'View the final results from any completed season' },
                    ].map(({ cmd, desc }) => (
                        <div key={cmd} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid rgba(255,255,255,0.06)`,
                            borderRadius: borderRadius.md,
                            padding: '16px',
                        }}>
                            <code style={{
                                display: 'block', marginBottom: 8,
                                color: colors.primary, fontFamily: 'monospace',
                                fontSize: '13px', fontWeight: 700,
                            }}>
                                {cmd}
                            </code>
                            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>{desc}</p>
                        </div>
                    ))}
                </div>

                {/* Tip box */}
                <div style={{
                    background: 'rgba(16,232,122,0.06)',
                    border: `1px solid rgba(16,232,122,0.2)`,
                    borderRadius: borderRadius.lg,
                    padding: '20px 24px',
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                }}>
                    <TrendingUp size={22} color={colors.primary} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <div style={{ fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>Pro Tip</div>
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '14px', lineHeight: 1.6 }}>
                            The 5 trends each week are drawn from genres producers on this server actually use — so pay attention to what people are making and uploading. If you see a wave of tracks in a certain style, that genre is probably in the pool and about to rack up hype. Being early pays off.
                        </p>
                    </div>
                </div>
            </div>
        </DiscoveryLayout>
    );
};
