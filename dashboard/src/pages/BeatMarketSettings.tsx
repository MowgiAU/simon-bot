import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { showToast } from '../components/Toast';
import { TrendingUp, Save, Trophy, Zap } from 'lucide-react';
import { ChannelSelect } from '../components/ChannelSelect';

const DEFAULT_SETTINGS = {
    enabled: true,
    announcementChannelId: null,
    seasonDurationDays: 7,
    maxInvestPerSeason: 1000,
    maxInvestPct: 25,
    minInvest: 10,
    payoutRank1: 1.6,
    payoutRank2: 1.3,
    payoutRank3: 1.1,
    payoutRank4: 0.9,
    payoutRank5: 0.7,
};

export const BeatMarketSettings: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
    const [activeSeason, setActiveSeason] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!selectedGuild) return;
        setLoading(true);
        Promise.all([
            axios.get(`/api/guilds/${selectedGuild.id}/beat-market/settings`, { withCredentials: true }),
            axios.get(`/api/guilds/${selectedGuild.id}/beat-market/season/active`, { withCredentials: true }),
        ]).then(([s, season]) => {
            setSettings(s.data ?? DEFAULT_SETTINGS);
            setActiveSeason(season.data);
        }).catch(() => {}).finally(() => setLoading(false));
    }, [selectedGuild]);

    const save = async () => {
        if (!selectedGuild) return;
        setSaving(true);
        try {
            await axios.put(`/api/guilds/${selectedGuild.id}/beat-market/settings`, settings, { withCredentials: true });
            showToast('Beat Market settings saved', 'success');
        } catch {
            showToast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const manualSettle = async () => {
        if (!selectedGuild || !activeSeason) return;
        try {
            await axios.post(`/api/guilds/${selectedGuild.id}/beat-market/seasons/${activeSeason.id}/settle`, {}, { withCredentials: true });
            showToast('Season will settle on the next lifecycle tick (up to 10 minutes)', 'success');
        } catch {
            showToast('Failed to trigger settlement', 'error');
        }
    };

    const set = (key: string, value: any) => setSettings((prev: any) => ({ ...prev, [key]: value }));

    if (loading) return <div style={{ padding: 32, color: colors.textTertiary }}>Loading...</div>;

    const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

    return (
        <div style={{ padding: '32px', maxWidth: 800 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                <TrendingUp size={32} color={colors.primary} style={{ marginRight: 16 }} />
                <div>
                    <h1 style={{ margin: 0 }}>Beat Market</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        Weekly genre investment game — members stake coins on trending music styles
                    </p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Each week, 5 genre trend cards drop (Trap, Lo-fi, Drill, R&B, Phonk). Members invest coins and earn back more if their genre generates the most hype from track uploads, plays, favourites, and battle entries. Configure the announcement channel and investment limits below.
                </p>
            </div>

            {/* Active Season Status */}
            {activeSeason && (
                <div style={{
                    background: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.lg, padding: 20, marginBottom: 24,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: '50%', background: colors.primary,
                                display: 'inline-block', boxShadow: `0 0 6px ${colors.primary}`,
                            }} />
                            <span style={{ fontWeight: 700, color: colors.textPrimary }}>
                                Season #{activeSeason.number} — Active
                            </span>
                        </div>
                        <span style={{ fontSize: 12, color: colors.textTertiary }}>
                            Ends <strong style={{ color: colors.textSecondary }}>
                                {new Date(activeSeason.endsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </strong>
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {activeSeason.trends?.map((t: any, i: number) => {
                            const maxHype = Math.max(...activeSeason.trends.map((x: any) => x.hypePoints), 1);
                            const pct = Math.round((t.hypePoints / maxHype) * 100);
                            return (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ width: 24, fontSize: 14 }}>{rankEmojis[i]}</span>
                                    <span style={{ fontSize: 14, color: colors.textSecondary, width: 80 }}>{t.emoji} {t.name}</span>
                                    <div style={{ flex: 1, height: 6, background: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: colors.primary, borderRadius: 3, transition: 'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize: 12, color: colors.textTertiary, width: 60, textAlign: 'right' }}>
                                        {t.hypePoints} hype
                                    </span>
                                    <span style={{ fontSize: 12, color: colors.textTertiary, width: 70, textAlign: 'right' }}>
                                        🪙{t.totalInvested ?? 0} staked
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={manualSettle} style={{
                        marginTop: 16, padding: '8px 16px', fontSize: 12, fontWeight: 600,
                        background: 'transparent', border: `1px solid ${colors.border}`,
                        borderRadius: borderRadius.md, color: colors.textSecondary, cursor: 'pointer',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.error)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                    >
                        Force Settle Season
                    </button>
                </div>
            )}

            {/* Enable toggle */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: colors.textPrimary }}>Enable Beat Market</div>
                        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Turn the weekly investment game on or off</div>
                    </div>
                    <button onClick={() => set('enabled', !settings.enabled)} style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: settings.enabled ? colors.primary : colors.border,
                        position: 'relative', transition: 'background 0.2s',
                    }}>
                        <span style={{
                            position: 'absolute', top: 3, left: settings.enabled ? 23 : 3,
                            width: 18, height: 18, borderRadius: '50%', background: '#fff',
                            transition: 'left 0.2s',
                        }} />
                    </button>
                </div>
            </div>

            {/* Announcement channel */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: 20, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: colors.textPrimary, marginBottom: 4 }}>Announcement Channel</div>
                <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 12 }}>
                    Where new season starts and settlement results are posted
                </div>
                <ChannelSelect
                    guildId={selectedGuild?.id ?? ''}
                    value={settings.announcementChannelId ?? ''}
                    onChange={v => set('announcementChannelId', v || null)}
                />
            </div>

            {/* Investment limits */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: 20, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: colors.textPrimary, marginBottom: 16 }}>Investment Limits</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {[
                        { key: 'minInvest', label: 'Minimum per trend', help: 'Coins' },
                        { key: 'maxInvestPerSeason', label: 'Max per season', help: 'Coins total' },
                        { key: 'maxInvestPct', label: 'Max % of balance', help: '% per trend' },
                        { key: 'seasonDurationDays', label: 'Season length', help: 'Days' },
                    ].map(({ key, label, help }) => (
                        <div key={key}>
                            <label style={{ display: 'block', fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                                {label} <span style={{ color: colors.textTertiary }}>({help})</span>
                            </label>
                            <input
                                type="number"
                                value={settings[key]}
                                onChange={e => set(key, Number(e.target.value))}
                                style={{
                                    width: '100%', padding: '8px 12px', background: colors.background,
                                    border: `1px solid ${colors.border}`, borderRadius: borderRadius.md,
                                    color: colors.textPrimary, fontSize: 14, boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Payout multipliers */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Trophy size={16} color={colors.primary} />
                    <span style={{ fontWeight: 600, color: colors.textPrimary }}>Payout Multipliers</span>
                </div>
                <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 16 }}>
                    How much investors get back based on their trend's final rank. 1.0 = break even.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {['payoutRank1', 'payoutRank2', 'payoutRank3', 'payoutRank4', 'payoutRank5'].map((key, i) => {
                        const mult = settings[key];
                        const isProfit = mult >= 1;
                        return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ width: 28, fontSize: 18 }}>{rankEmojis[i]}</span>
                                <span style={{ width: 60, fontSize: 13, color: colors.textSecondary }}>Rank {i + 1}</span>
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    max="5"
                                    value={mult}
                                    onChange={e => set(key, parseFloat(e.target.value))}
                                    style={{
                                        width: 80, padding: '6px 10px', background: colors.background,
                                        border: `1px solid ${colors.border}`, borderRadius: borderRadius.md,
                                        color: colors.textPrimary, fontSize: 14, textAlign: 'center',
                                    }}
                                />
                                <span style={{ fontSize: 13, color: isProfit ? colors.primary : colors.error, fontWeight: 600 }}>
                                    {mult}× {isProfit ? `(+${Math.round((mult - 1) * 100)}%)` : `(-${Math.round((1 - mult) * 100)}%)`}
                                </span>
                                <div style={{ flex: 1, height: 4, background: colors.border, borderRadius: 2 }}>
                                    <div style={{
                                        width: `${Math.min((mult / 2) * 100, 100)}%`, height: '100%',
                                        background: isProfit ? colors.primary : colors.error,
                                        borderRadius: 2, transition: 'width 0.2s',
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button onClick={save} disabled={saving} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: colors.primary, color: '#000', border: 'none',
                borderRadius: borderRadius.md, padding: '10px 24px',
                fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
            }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
        </div>
    );
};
