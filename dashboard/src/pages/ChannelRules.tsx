import React, { useEffect, useState } from 'react';
import { 
    Save, 
    Plus, 
    Trash2, 
    Edit, 
    Shield, 
    FileText, 
    AlertTriangle, 
    CheckCircle,
    XCircle,
    Copy,
    Settings,
    RefreshCw
} from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../theme/theme';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';
import { PendingReviews } from '../components/PendingReviews';
import { useMobile } from '../hooks/useMobile';

interface Rule {
    id: string;
    name: string;
    targetChannelId: string;
    type: string;
    action: string;
    enabled: boolean;
    config: any;
    exemptRoles: string[];
    requiredRoles: string[];
}

interface RuleSettings {
    guildId: string;
    approvalChannelId: string | null;
    rules: Rule[];
}

const RULE_TYPES = [
    { value: 'BLOCK_FILE_TYPES', label: 'Block Specific Files', icon: <FileText size={16}/> },
    { value: 'BLOCK_ALL_FILES', label: 'Block All Attachments', icon: <FileText size={16}/> },
    { value: 'MUST_CONTAIN_ATTACHMENT', label: 'Must Have Attachment', icon: <FileText size={16}/> },
    { value: 'MIN_LENGTH', label: 'Minimum Length', icon: <FileText size={16}/> },
    { value: 'MAX_LENGTH', label: 'Maximum Length', icon: <FileText size={16}/> },
    { value: 'REGEX_MATCH', label: 'Regex Pattern', icon: <Copy size={16}/> },
    { value: 'CAPS_LIMIT', label: 'Caps Lock Limit', icon: <AlertTriangle size={16}/> },
    { value: 'BLOCK_DOMAINS', label: 'Block Domains', icon: <Shield size={16}/> }
];

export const ChannelRules: React.FC<{ guildId: string }> = ({ guildId }) => {
    const isMobile = useMobile();
    const [settings, setSettings] = useState<RuleSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingRule, setEditingRule] = useState<Partial<Rule> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'rules' | 'queue'>('rules');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        fetchSettings();
    }, [guildId]);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/channel-rules`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            // Ensure rules array exists even if backend returns partial object
            if (data && !data.rules) data.rules = [];
            setSettings(data);
        } catch (e) {
            console.error(e);
            // Set empty default to verify UI doesn't crash
            setSettings({ guildId, approvalChannelId: null, rules: [] });
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await fetch(`/api/guilds/${guildId}/channel-rules/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvalChannelId: settings.approvalChannelId }),
                credentials: 'include'
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const saveRule = async (rule: Partial<Rule>) => {
        if (!rule.name?.trim()) {
            showToast('Rule name is required', 'warning');
            return;
        }
        if (!rule.targetChannelId) {
            showToast('Target channel is required', 'warning');
            return;
        }

        setIsSaving(true);
        const isNew = !rule.id;
        const endpoint = isNew 
            ? `/api/guilds/${guildId}/channel-rules`
            : `/api/guilds/${guildId}/channel-rules/${rule.id}`;
        
        try {
            const res = await fetch(endpoint, {
                method: isNew ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule),
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error((await res.json()).error || 'Failed to save');
            }

            await fetchSettings();
            setEditingRule(null);
        } catch (e: any) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteRule = async (ruleId: string) => {
        setDeleteConfirm(ruleId);
    };

    const confirmDeleteRule = async (ruleId: string) => {
        setDeleteConfirm(null);
        try {
            await fetch(`/api/guilds/${guildId}/channel-rules/${ruleId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchSettings();
        } catch (e) {
            showToast('Failed to delete rule', 'error');
        }
    };

    if (loading) return <div style={{ color: colors.textPrimary }}>Loading Rules...</div>;

    const renderConfigInputs = (rule: Partial<Rule>) => {
        const config = rule.config || {};
        const updateConfig = (key: string, val: any) => {
            setEditingRule(prev => prev ? ({ ...prev, config: { ...prev.config, [key]: val } }) : null);
        };

        switch (rule.type) {
            case 'BLOCK_FILE_TYPES':
                return (
                    <div style={{ marginTop: spacing.sm }}>
                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Blocked Extensions (comma separated, e.g. .exe, .zip)</label>
                        <input 
                            style={styles.input} 
                            value={(config.extensions || []).join(', ')}
                            onChange={e => updateConfig('extensions', e.target.value.split(',').map(s => s.trim()))}
                            placeholder=".exe, .rar, .bat"
                        />
                    </div>
                );
            case 'MIN_LENGTH':
            case 'MAX_LENGTH':
                return (
                    <div style={{ marginTop: spacing.sm }}>
                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Character Count</label>
                        <input 
                            type="number"
                            style={styles.input} 
                            value={config.length || 0}
                            onChange={e => updateConfig('length', parseInt(e.target.value))}
                        />
                    </div>
                );
            case 'REGEX_MATCH':
                return (
                    <div style={{ marginTop: spacing.sm }}>
                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Regular Expression</label>
                        <input 
                            style={styles.input} 
                            value={config.pattern || ''}
                            onChange={e => updateConfig('pattern', e.target.value)}
                            placeholder="^badword.*"
                        />
                    </div>
                );
            case 'BLOCK_DOMAINS':
                return (
                    <div style={{ marginTop: spacing.sm }}>
                        <label style={{ color: colors.textSecondary, fontSize: '12px' }}>Domains (comma separated)</label>
                        <input 
                            style={styles.input} 
                            value={(config.domains || []).join(', ')}
                            onChange={e => updateConfig('domains', e.target.value.split(',').map(s => s.trim()))}
                            placeholder="badsite.com, scam.net"
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
        <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '8px' : '0' }}>
                    <FileText size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '28px' }}>Channel Gatekeeper</h1>
                </div>
                {!isMobile && (
                    <div style={{ marginLeft: '16px' }}>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Configure automated moderation rules per channel.</p>
                    </div>
                )}
            </div>
            {isMobile && <p style={{ margin: '0 0 16px', color: colors.textSecondary }}>Configure automated moderation rules per channel.</p>}

            <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '15px' }}>Set up per-channel rules to automatically moderate content — block file types, enforce message length, restrict domains, and more. Rules can be configured with exempt roles.</p>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <button 
                    onClick={() => setActiveTab('rules')}
                    style={{ 
                        padding: '10px 20px', 
                        background: activeTab === 'rules' ? colors.primary : 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', 
                        color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                    }}
                >
                    <Settings size={18} /> Rules Configuration
                </button>
                <button 
                    onClick={() => setActiveTab('queue')}
                    style={{ 
                        padding: '10px 20px', 
                        background: activeTab === 'queue' ? colors.primary : 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', 
                        color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                    }}
                >
                    <RefreshCw size={18} /> Pending Approvals
                </button>
            </div>

            {activeTab === 'queue' ? (
                <PendingReviews guildId={guildId} />
            ) : (
                <>
                {/* Global Settings */}
                <div style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', padding: spacing.lg, borderRadius: 8, marginBottom: spacing.lg, border: '1px solid #3E455633' }}>
                    <h3 style={{ ...typography.h3, color: colors.textPrimary, marginTop: 0 }}>Global Configuration</h3>
                    <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-end', marginTop: spacing.md }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs }}>
                                Approval Queue Channel (Review Intercepted Messages)
                            </label>
                            <ChannelSelect 
                                guildId={guildId}
                                value={settings?.approvalChannelId || ''}
                                onChange={(id) => setSettings(prev => prev ? ({ ...prev, approvalChannelId: id }) : null)}
                                placeholder="Select a Staff Channel"
                            />
                        </div>
                        <button onClick={saveSettings} style={styles.primaryBtn}>
                            {isSaving ? 'Saving...' : <><Save size={16} /> Save Config</>}
                        </button>
                    </div>
                </div>

                {/* Rules List */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                    <h3 style={{ ...typography.h3, color: colors.textPrimary }}>Active Rules</h3>
                    <button onClick={() => setEditingRule({ enabled: true, action: 'BLOCK', type: 'BLOCK_FILE_TYPES' })} style={styles.primaryBtn}>
                        <Plus size={16} /> Add Rule
                    </button>
                </div>

                <div style={{ display: 'grid', gap: spacing.md }}>
                    {settings?.rules.map(rule => (
                        <div key={rule.id} style={{ 
                            background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', 
                            padding: spacing.md, 
                            borderRadius: 8, 
                            border: '1px solid #3E455633',
                            display: 'flex', alignItems: 'center', gap: spacing.md
                        }}>
                            <div style={{ 
                                width: 3, height: 40, borderRadius: 4, 
                                background: rule.enabled ? colors.success : colors.textTertiary 
                            }} />
                            
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                    <span style={{ fontWeight: 600, color: colors.textPrimary }}>{rule.name}</span>
                                    <span style={{ 
                                        fontSize: '10px', padding: '2px 6px', borderRadius: 4,
                                        background: rule.action === 'REQUIRE_APPROVAL' ? colors.warning : colors.error,
                                        color: '#000', fontWeight: 'bold'
                                    }}>
                                        {rule.action === 'REQUIRE_APPROVAL' ? 'INTERCEPT' : 'BLOCK'}
                                    </span>
                                </div>
                                <div style={{ color: colors.textSecondary, fontSize: '13px', marginTop: 4 }}>
                                    {RULE_TYPES.find(t => t.value === rule.type)?.label} • Target: <ChannelSelect guildId={guildId} value={rule.targetChannelId} onChange={()=>{}} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: spacing.sm }}>
                                <button onClick={() => setEditingRule(rule)} style={styles.iconBtn}>
                                    <Edit size={18} />
                                </button>
                                <button onClick={() => deleteRule(rule.id)} style={{ ...styles.iconBtn, color: colors.error }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}

            {/* Edit Modal */}
            {editingRule && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', 
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 
                }}>
                    <div style={{ 
                        background: colors.surface, width: '600px', maxHeight: '90vh', overflowY: 'auto',
                        padding: spacing.xl, borderRadius: 12, border: `1px solid ${colors.border}` 
                    }}>
                        <h2 style={{ color: colors.textPrimary, marginTop: 0 }}>
                            {editingRule.id ? 'Edit Rule' : 'New Rule'}
                        </h2>
                        
                        <div style={{ display: 'grid', gap: spacing.md }}>
                            <div>
                                <label style={styles.label}>Rule Name</label>
                                <input 
                                    style={styles.input} 
                                    value={editingRule.name || ''} 
                                    onChange={e => setEditingRule(prev => ({ ...prev!, name: e.target.value }))}
                                    placeholder="e.g. No EXE In General"
                                />
                            </div>

                            <div>
                                <label style={styles.label}>Target Channel (Where rule applies)</label>
                                <ChannelSelect 
                                    guildId={guildId}
                                    value={editingRule.targetChannelId || ''}
                                    onChange={id => setEditingRule(prev => ({ ...prev!, targetChannelId: id }))}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                                <div>
                                    <label style={styles.label}>Rule Logic</label>
                                    <select 
                                        style={styles.select}
                                        value={editingRule.type}
                                        onChange={e => setEditingRule(prev => ({ ...prev!, type: e.target.value }))}
                                    >
                                        {RULE_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={styles.label}>Action</label>
                                    <select 
                                        style={styles.select}
                                        value={editingRule.action}
                                        onChange={e => setEditingRule(prev => ({ ...prev!, action: e.target.value }))}
                                    >
                                        <option value="BLOCK">Block & Delete</option>
                                        <option value="REQUIRE_APPROVAL">Intercept & Review</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* Dynamic Config */}
                            <div style={{ background: colors.background, padding: spacing.md, borderRadius: 6 }}>
                                <label style={styles.label}>Rule Configuration</label>
                                {renderConfigInputs(editingRule)}
                            </div>

                            <div>
                                <label style={styles.label}>Exempt Roles (Bypass)</label>
                                <RoleSelect 
                                    guildId={guildId}
                                    value={editingRule.exemptRoles || []}
                                    onChange={roles => setEditingRule(prev => ({ ...prev!, exemptRoles: roles as string[] }))}
                                    multiple
                                />
                            </div>

                             <div>
                                <label style={styles.label}>Required Roles (Only apply to)</label>
                                <RoleSelect 
                                    guildId={guildId}
                                    value={editingRule.requiredRoles || []}
                                    onChange={roles => setEditingRule(prev => ({ ...prev!, requiredRoles: roles as string[] }))}
                                    multiple
                                />
                            </div>

                             <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <input 
                                    type="checkbox" 
                                    checked={editingRule.enabled}
                                    onChange={e => setEditingRule(prev => ({ ...prev!, enabled: e.target.checked }))}
                                    style={{ width: 16, height: 16 }}
                                />
                                <label style={{ color: colors.textPrimary }}>Enable this rule</label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md }}>
                                <button onClick={() => setEditingRule(null)} style={styles.secondaryBtn}>Cancel</button>
                                <button onClick={() => saveRule(editingRule)} style={styles.primaryBtn}>Save Rule</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        <ConfirmModal
            open={!!deleteConfirm}
            title="Delete Rule"
            message="Are you sure you want to delete this rule? This cannot be undone."
            confirmLabel="Delete"
            danger
            onConfirm={() => deleteConfirm && confirmDeleteRule(deleteConfirm)}
            onCancel={() => setDeleteConfirm(null)}
        />
        </>
    );
};

const styles = {
    primaryBtn: {
        background: colors.primary, color: colors.textPrimary, border: 'none', padding: '8px 16px', borderRadius: borderRadius.sm,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600
    },
    secondaryBtn: {
        background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`, padding: '8px 16px', borderRadius: borderRadius.sm,
        cursor: 'pointer'
    },
    iconBtn: {
        background: 'transparent', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: 4
    },
    label: {
        display: 'block', color: colors.textSecondary, marginBottom: 4, fontSize: '13px'
    },
    input: {
        width: '100%', background: colors.background, border: `1px solid ${colors.border}`, 
        color: colors.textPrimary, padding: '8px', borderRadius: borderRadius.sm
    },
    select: {
        width: '100%', background: colors.background, border: `1px solid ${colors.border}`, 
        color: colors.textPrimary, padding: '8px', borderRadius: borderRadius.sm
    }
};
