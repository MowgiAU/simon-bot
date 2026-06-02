import React, { useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { LevelingSettings } from './LevelingSettings';
import { EconomyPluginPage } from './EconomyPlugin';
import { BeatMarketSettings } from './BeatMarketSettings';
import { TrendingUp, Coins, BarChart3 } from 'lucide-react';

const TABS = [
    { key: 'leveling', label: 'Leveling', icon: TrendingUp },
    { key: 'economy', label: 'Economy', icon: Coins },
    { key: 'beat-market', label: 'Beat Market', icon: BarChart3 },
] as const;

type Tab = typeof TABS[number]['key'];

export function ProgressionPage() {
    const { selectedGuild } = useAuth();
    const [tab, setTab] = useState<Tab>('leveling');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    if (!selectedGuild) return null;

    return (
        <div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '4px', margin: '0 32px', marginTop: '24px', background: colors.surface, borderRadius: borderRadius.md, padding: '4px', width: isMobile ? 'calc(100% - 64px)' : 'fit-content' }}>
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key)} style={{
                        flex: isMobile ? 1 : undefined,
                        padding: isMobile ? '10px 8px' : '10px 20px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer',
                        background: tab === key ? colors.primary : 'transparent',
                        color: tab === key ? '#fff' : colors.textSecondary,
                        fontWeight: 600, fontSize: isMobile ? '13px' : '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s',
                    }}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'leveling' && <LevelingSettings />}
            {tab === 'economy' && <EconomyPluginPage />}
            {tab === 'beat-market' && <BeatMarketSettings />}
        </div>
    );
}
