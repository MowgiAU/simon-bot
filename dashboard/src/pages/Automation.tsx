import React, { useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { WelcomeGatePluginPage } from './WelcomeGate';
import { AutoMessagesPage } from './AutoMessages';
import { AutoResponderPage } from './AutoResponder';
import { ChannelRules } from './ChannelRules';
import { AntiPiracySettings } from './AntiPiracySettings';
import { SpamGuardPage } from './SpamGuard';
import { AntiExternalForwardPage } from './AntiExternalForward';
import { Shield, Clock, Zap, FileText, ShieldOff, ShieldCheck, ShieldAlert } from 'lucide-react';

const TABS = [
    { key: 'welcome-gate', label: 'Welcome Gate', icon: Shield },
    { key: 'auto-messages', label: 'Auto Messages', icon: Clock },
    { key: 'auto-responder', label: 'Auto Responder', icon: Zap },
    { key: 'channel-rules', label: 'Channel Rules', icon: FileText },
    { key: 'anti-piracy', label: 'Anti-Piracy', icon: ShieldOff },
    { key: 'spam-guard', label: 'Spam Guard', icon: ShieldCheck },
    { key: 'anti-external-forward', label: 'Anti-Forward', icon: ShieldAlert },
] as const;

type Tab = typeof TABS[number]['key'];

export function AutomationPage() {
    const { selectedGuild } = useAuth();
    const [tab, setTab] = useState<Tab>('welcome-gate');
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
            <div style={{ display: 'flex', gap: '4px', margin: '0 32px', marginTop: '24px', background: colors.surface, borderRadius: borderRadius.md, padding: '4px', width: isMobile ? 'calc(100% - 64px)' : 'fit-content', flexWrap: 'wrap' }}>
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key)} style={{
                        padding: isMobile ? '8px 10px' : '10px 18px', borderRadius: borderRadius.sm, border: 'none', cursor: 'pointer',
                        background: tab === key ? colors.primary : 'transparent',
                        color: tab === key ? '#fff' : colors.textSecondary,
                        fontWeight: 600, fontSize: isMobile ? '12px' : '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                    }}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'welcome-gate' && <WelcomeGatePluginPage />}
            {tab === 'auto-messages' && <AutoMessagesPage />}
            {tab === 'auto-responder' && <AutoResponderPage />}
            {tab === 'channel-rules' && <ChannelRules guildId={selectedGuild.id} />}
            {tab === 'anti-piracy' && <AntiPiracySettings guildId={selectedGuild.id} />}
            {tab === 'spam-guard' && <SpamGuardPage />}
            {tab === 'anti-external-forward' && <AntiExternalForwardPage />}
        </div>
    );
}
