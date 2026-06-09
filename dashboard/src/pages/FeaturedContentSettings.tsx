import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius } from '../theme/theme';
import { MonitorPlay, Newspaper, BookOpen, FileText, Save, CheckCircle, AlertCircle, Search, X, ListMusic } from 'lucide-react';

type ContentType = 'video' | 'news' | 'guide' | 'article' | 'playlist';

interface FeaturedArticle {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    authorName: string;
    category: string;
    publishedAt: string | null;
}

interface FeaturedPlaylist {
    id: string;
    name: string;
    coverUrl: string | null;
    releaseType: string | null;
    trackCount: number;
    totalPlays: number;
    profile?: { username: string; displayName: string | null } | null;
    battle?: { id: string; title: string } | null;
}

interface FeaturedSettings {
    featuredContentType: ContentType;
    featuredTutorialUrl: string;
    featuredTutorialTitle: string;
    featuredTutorialDescription: string;
    featuredTutorialThumbnail: string;
    featuredTutorialAuthor: string;
    featuredTutorialDate: string;
    featuredArticleId: string | null;
    featuredArticle: FeaturedArticle | null;
    featuredPlaylistId: string | null;
    featuredPlaylist: FeaturedPlaylist | null;
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
    {
        id: 'article',
        icon: <FileText size={20} />,
        label: 'Featured Article',
        description: 'Showcase a published community article on the frontpage.',
        accentColor: '#F5A04A',
    },
    {
        id: 'playlist',
        icon: <ListMusic size={20} />,
        label: 'Featured Playlist',
        description: 'Feature a playlist, album, or EP release on the frontpage.',
        accentColor: '#22C55E',
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
        featuredArticleId: null,
        featuredArticle: null,
        featuredPlaylistId: null,
        featuredPlaylist: null,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [articleSearch, setArticleSearch] = useState('');
    const [articleResults, setArticleResults] = useState<FeaturedArticle[]>([]);
    const [searchingArticles, setSearchingArticles] = useState(false);
    const [playlistSearch, setPlaylistSearch] = useState('');
    const [playlistResults, setPlaylistResults] = useState<FeaturedPlaylist[]>([]);
    const [searchingPlaylists, setSearchingPlaylists] = useState(false);

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
                featuredArticleId: d.featuredArticleId || null,
                featuredArticle: d.featuredArticle || null,
                featuredPlaylistId: d.featuredPlaylistId || null,
                featuredPlaylist: d.featuredPlaylist || null,
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
                featuredArticleId: settings.featuredArticleId || null,
                featuredPlaylistId: settings.featuredPlaylistId || null,
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
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
                ) : settings.featuredContentType === 'article' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Selected article preview */}
                        {settings.featuredArticle && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px', background: '#F5A04A10', border: '1px solid #F5A04A30',
                                borderRadius: borderRadius.md,
                            }}>
                                {settings.featuredArticle.coverImageUrl && (
                                    <img src={settings.featuredArticle.coverImageUrl} alt="" style={{
                                        width: '60px', height: '60px', objectFit: 'cover', borderRadius: borderRadius.sm, flexShrink: 0,
                                    }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {settings.featuredArticle.title}
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '2px' }}>
                                        by {settings.featuredArticle.authorName} · {settings.featuredArticle.category}
                                    </div>
                                </div>
                                <button onClick={() => setSettings(s => ({ ...s, featuredArticleId: null, featuredArticle: null }))} style={{
                                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                                    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: colors.textSecondary, flexShrink: 0,
                                }}><X size={14} /></button>
                            </div>
                        )}

                        {/* Article search */}
                        <div>
                            <label style={labelStyle}>Search Published Articles</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    style={{ ...inputStyle, paddingLeft: '34px' }}
                                    placeholder="Type to search articles by title..."
                                    value={articleSearch}
                                    onChange={async (e) => {
                                        const q = e.target.value;
                                        setArticleSearch(q);
                                        if (q.length < 2) { setArticleResults([]); return; }
                                        setSearchingArticles(true);
                                        try {
                                            const res = await axios.get('/api/discovery/articles/search', { params: { q }, withCredentials: true });
                                            setArticleResults(res.data.articles || []);
                                        } catch { setArticleResults([]); }
                                        setSearchingArticles(false);
                                    }}
                                />
                            </div>
                            {searchingArticles && (
                                <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '6px' }}>Searching...</div>
                            )}
                            {articleResults.length > 0 && (
                                <div style={{
                                    marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: borderRadius.md, overflow: 'hidden', maxHeight: '240px', overflowY: 'auto',
                                }}>
                                    {articleResults.map(a => (
                                        <div key={a.id} onClick={() => {
                                            setSettings(s => ({ ...s, featuredArticleId: a.id, featuredArticle: a }));
                                            setArticleSearch('');
                                            setArticleResults([]);
                                        }} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '10px 12px', cursor: 'pointer',
                                            background: settings.featuredArticleId === a.id ? `${colors.primary}10` : 'transparent',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            transition: 'background 0.1s',
                                        }}>
                                            {a.coverImageUrl && (
                                                <img src={a.coverImageUrl} alt="" style={{
                                                    width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0,
                                                }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {a.title}
                                                </div>
                                                <div style={{ fontSize: '11px', color: colors.textTertiary }}>
                                                    {a.authorName} · {a.category}{a.publishedAt ? ` · ${new Date(a.publishedAt).toLocaleDateString()}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!settings.featuredArticle && !articleSearch && (
                            <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary, lineHeight: 1.6 }}>
                                Search for a published article above to feature it on the frontpage.
                            </p>
                        )}
                    </div>
                ) : settings.featuredContentType === 'playlist' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Selected playlist preview */}
                        {settings.featuredPlaylist && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#22C55E10', border: '1px solid #22C55E30', borderRadius: borderRadius.md }}>
                                {settings.featuredPlaylist.coverUrl
                                    ? <img src={settings.featuredPlaylist.coverUrl} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                                    : <div style={{ width: '52px', height: '52px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ListMusic size={20} color="rgba(255,255,255,0.3)" /></div>}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {settings.featuredPlaylist.name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '2px' }}>
                                        {settings.featuredPlaylist.profile?.displayName || settings.featuredPlaylist.profile?.username || 'Unknown'} · {settings.featuredPlaylist.trackCount} tracks
                                        {settings.featuredPlaylist.releaseType ? ` · ${settings.featuredPlaylist.releaseType.toUpperCase()}` : ''}
                                        {settings.featuredPlaylist.battle ? ` · from "${settings.featuredPlaylist.battle.title}"` : ''}
                                    </div>
                                </div>
                                <button onClick={() => setSettings(s => ({ ...s, featuredPlaylistId: null, featuredPlaylist: null }))} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.textSecondary, flexShrink: 0 }}><X size={14} /></button>
                            </div>
                        )}

                        {/* Playlist search */}
                        <div>
                            <label style={labelStyle}>Search Playlists</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    style={{ ...inputStyle, paddingLeft: '34px' }}
                                    placeholder="Type to search playlists by name…"
                                    value={playlistSearch}
                                    onChange={async (e) => {
                                        const q = e.target.value;
                                        setPlaylistSearch(q);
                                        setSearchingPlaylists(true);
                                        try {
                                            const res = await axios.get('/api/discovery/playlists/search', { params: { q }, withCredentials: true });
                                            setPlaylistResults(res.data.playlists || []);
                                        } catch { setPlaylistResults([]); }
                                        setSearchingPlaylists(false);
                                    }}
                                />
                            </div>
                            {searchingPlaylists && <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '6px' }}>Searching...</div>}
                            {playlistResults.length > 0 && (
                                <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: borderRadius.md, overflow: 'hidden', maxHeight: '240px', overflowY: 'auto' }}>
                                    {playlistResults.map(p => (
                                        <div key={p.id} onClick={() => { setSettings(s => ({ ...s, featuredPlaylistId: p.id, featuredPlaylist: p })); setPlaylistSearch(''); setPlaylistResults([]); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', background: settings.featuredPlaylistId === p.id ? `${colors.primary}10` : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}>
                                            {p.coverUrl
                                                ? <img src={p.coverUrl} alt="" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                                : <div style={{ width: '38px', height: '38px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ListMusic size={14} color="rgba(255,255,255,0.3)" /></div>}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                <div style={{ fontSize: '11px', color: colors.textTertiary }}>
                                                    {p.profile?.displayName || p.profile?.username || 'Unknown'} · {p.trackCount} tracks
                                                    {p.releaseType ? ` · ${p.releaseType.toUpperCase()}` : ''}
                                                    {p.battle ? ` · ${p.battle.title}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!settings.featuredPlaylist && !playlistSearch && (
                            <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary, lineHeight: 1.6 }}>
                                Search for a playlist above to feature it on the frontpage. Battle releases show up here too.
                            </p>
                        )}
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
