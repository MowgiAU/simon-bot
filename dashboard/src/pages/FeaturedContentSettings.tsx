import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { MonitorPlay, Newspaper, BookOpen, Save, CheckCircle, AlertCircle } from 'lucide-react';

type ContentType = 'video' | 'news' | 'guide';

interface FeaturedSettings {
    featuredContentType: ContentType;
    featuredTutorialUrl: string;
    featuredTutorialTitle: string;
    featuredTutorialDescription: string;
    featuredTutorialThumbnail: string;
    featuredTutorialAuthor: string;
    featuredTutorialDate: string;
}

const TYPE_OPTIONS: { id: ContentType; icon: React.ReactNode; label: string; description: string; accentColor: string }[] = [
    {
        id: 'video',
        icon: <MonitorPlay size={20} />,
        label: 'Featured Video',
        description: 'Highlight a YouTube tutorial or video for producers.',
        accentColor: colors.primary,
    },
    {
        id: 'news',
        icon: <Newspaper size={20} />,
        label: 'Featured News',
        description: 'Community updates, announcements, and stories.',
        accentColor: '#A78BFA',
    },
    {
        id: 'guide',
        icon: <BookOpen size={20} />,
        label: 'Featured Guide',
        description: 'In-depth production guides from experienced producers.',
        accentColor: '#FBBF24',
    },
];

export const FeaturedContentSettings: React.FC = () => {
    const [settings, setSettings] = useState<FeaturedSettings>({
        featuredContentType: 'video',
        featuredTutorialUrl: '',
        featuredTutorialTitle: '',
        featuredTutorialDescription: '',
        featuredTutorialThumbnail: '',
        featuredTutorialAuthor: '',
        featuredTutorialDate: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');

    useEffect(() => {
        axios.get('/api/discovery/settings').then(r => {
            const d = r.data;
            setSettings({
                featuredContentType: d.featuredContentType || 'video',
                featuredTutorialUrl: d.featuredTutorialUrl || '',
                featuredTutorialTitle: d.featuredTutorialTitle || '',
                featuredTutorialDescription: d.featuredTutorialDescription || '',
                featuredTutorialThumbnail: d.featuredTutorialThumbnail || '',
                featuredTutorialAuthor: d.featuredTutorialAuthor || '',
                featuredTutorialDate: d.featuredTutorialDate || '',
            });
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        setSaveStatus('idle');
        try {
            await axios.post('/api/discovery/settings', {
                featuredContentType: settings.featuredContentType,
                featuredTutorialUrl: settings.featuredTutorialUrl || null,
                featuredTutorialTitle: settings.featuredTutorialTitle || null,
                featuredTutorialDescription: settings.featuredTutorialDescription || null,
                featuredTutorialThumbnail: settings.featuredTutorialThumbnail || null,
                featuredTutorialAuthor: settings.featuredTutorialAuthor || null,
                featuredTutorialDate: settings.featuredTutorialDate || null,
            });
            setSaveStatus('ok');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: borderRadius.md,
        color: colors.textPrimary,
        fontSize: '13px',
        padding: '10px 14px',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '12px',
        fontWeight: 700,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '6px',
        display: 'block',
    };

    const currentType = TYPE_OPTIONS.find(t => t.id === settings.featuredContentType)!;

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: colors.textSecondary, fontSize: '13px' }}>
                Loading...
            </div>
        );
    }

    return (
        <div style={{ padding: spacing.lg, maxWidth: '760px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <MonitorPlay size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: colors.textPrimary }}>Featured Content</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '13px' }}>
                        Choose what type of content appears in the frontpage feature card.
                    </p>
                </div>
            </div>

            {/* Explanation block */}
            <div style={{
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.lg,
                borderLeft: `4px solid ${colors.primary}`,
            }}>
                <p style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6 }}>
                    The <strong>Featured Content</strong> card sits on the frontpage discovery page and spans the full width of the lower grid.
                    Select a content type below and fill in the details — the frontpage updates immediately after saving.
                </p>
            </div>

            {/* Content type selector */}
            <div style={{ marginBottom: spacing.lg }}>
                <span style={labelStyle}>Content Type</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {TYPE_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSettings(s => ({ ...s, featuredContentType: opt.id }))}
                            style={{
                                background: settings.featuredContentType === opt.id
                                    ? `${opt.accentColor}14`
                                    : 'rgba(255,255,255,0.03)',
                                border: `1.5px solid ${settings.featuredContentType === opt.id ? opt.accentColor + '60' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: borderRadius.md,
                                padding: '16px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                            }}
                        >
                            <span style={{ color: settings.featuredContentType === opt.id ? opt.accentColor : colors.textSecondary }}>
                                {opt.icon}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: settings.featuredContentType === opt.id ? colors.textPrimary : colors.textSecondary }}>
                                {opt.label}
                            </span>
                            <span style={{ fontSize: '11px', color: colors.textSecondary, lineHeight: 1.5 }}>
                                {opt.description}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Fields for the selected type */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: borderRadius.md,
                padding: '20px',
                marginBottom: spacing.lg,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                    <span style={{ color: currentType.accentColor }}>{currentType.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: colors.textPrimary }}>{currentType.label} — Settings</span>
                </div>

                {settings.featuredContentType === 'video' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Video URL <span style={{ color: colors.textSecondary, fontWeight: 400, textTransform: 'none' }}>(YouTube or direct link)</span></label>
                            <input
                                style={inputStyle}
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={settings.featuredTutorialUrl}
                                onChange={e => setSettings(s => ({ ...s, featuredTutorialUrl: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Title</label>
                            <input
                                style={inputStyle}
                                placeholder="e.g. How to Mix Bass in FL Studio"
                                value={settings.featuredTutorialTitle}
                                onChange={e => setSettings(s => ({ ...s, featuredTutorialTitle: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Description <span style={{ color: colors.textSecondary, fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                            <textarea
                                style={{ ...inputStyle, height: '80px', resize: 'vertical' } as React.CSSProperties}
                                placeholder="A short blurb shown under the title on the frontpage card..."
                                value={settings.featuredTutorialDescription}
                                onChange={e => setSettings(s => ({ ...s, featuredTutorialDescription: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Thumbnail URL <span style={{ color: colors.textSecondary, fontWeight: 400, textTransform: 'none' }}>(optional — auto-detected from YouTube)</span></label>
                            <input
                                style={inputStyle}
                                placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg"
                                value={settings.featuredTutorialThumbnail}
                                onChange={e => setSettings(s => ({ ...s, featuredTutorialThumbnail: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={labelStyle}>Author / Staff Member <span style={{ color: colors.textSecondary, fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                <input
                                    style={inputStyle}
                                    placeholder="e.g. Mowgi"
                                    value={settings.featuredTutorialAuthor}
                                    onChange={e => setSettings(s => ({ ...s, featuredTutorialAuthor: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Date <span style={{ color: colors.textSecondary, fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                <input
                                    style={inputStyle}
                                    placeholder="e.g. March 23, 2026"
                                    value={settings.featuredTutorialDate}
                                    onChange={e => setSettings(s => ({ ...s, featuredTutorialDate: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '12px', padding: '32px 20px', textAlign: 'center',
                    }}>
                        <span style={{ color: currentType.accentColor, opacity: 0.5 }}>
                            {settings.featuredContentType === 'news' ? <Newspaper size={36} /> : <BookOpen size={36} />}
                        </span>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: colors.textPrimary }}>
                            {settings.featuredContentType === 'news' ? 'News settings' : 'Guide settings'} coming soon
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary, maxWidth: '360px', lineHeight: 1.6 }}>
                            You can already set this as the active content type — the frontpage will show a
                            {settings.featuredContentType === 'news' ? ' Community News' : ' Community Guides'} card.
                            Article/guide management will be added in a future update.
                        </p>
                    </div>
                )}
            </div>

            {/* Save button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 24px', borderRadius: borderRadius.md,
                        background: saving ? 'rgba(255,255,255,0.05)' : colors.primary,
                        color: saving ? colors.textSecondary : '#0f1218',
                        border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                        fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                    }}
                >
                    <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saveStatus === 'ok' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.primary, fontSize: '12px', fontWeight: 600 }}>
                        <CheckCircle size={14} /> Saved!
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F87171', fontSize: '12px', fontWeight: 600 }}>
                        <AlertCircle size={14} /> Failed to save. Try again.
                    </div>
                )}
            </div>
        </div>
    );
};
