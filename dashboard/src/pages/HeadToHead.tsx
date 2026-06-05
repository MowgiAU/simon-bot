import React, { useEffect, useState } from 'react';
import { Swords, Settings as SettingsIcon, Upload, Trash2, Plus, Trophy, Users, Loader, X } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = '';

interface Pool {
    id: string;
    name: string;
    description: string | null;
    genreId: string | null;
    isActive: boolean;
    genre?: { id: string; name: string } | null;
    samples: Sample[];
    _count?: { samples: number };
}
interface Sample {
    id: string;
    poolId: string;
    name: string;
    category: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
}

const SAMPLE_CATEGORIES = ['kick', 'snare', 'hat', 'percussion', 'fx', 'bass', 'melody', 'chords', 'other'] as const;
const CATEGORY_COLOR: Record<string, string> = {
    kick: '#FF3D7F', snare: '#FFD700', hat: '#00E5FF', percussion: '#F5A04A',
    fx: '#A855F7', bass: '#5DD4FF', melody: '#FF8A4C', chords: '#E879F9', other: '#7A8190',
};
interface Settings {
    enabled: boolean;
    announceQueueEnabled: boolean;
    announcementChannelId: string | null;
    defaultProductionMinutes: number;
    defaultVotingMinutes: number;
    readyUpMinutes: number;
    startingElo: number;
    kFactor: number;
    minVotesToFinalize: number;
    maxQueueWaitMinutes: number;
    samplesPerMatch: number;
}
interface Match {
    id: string;
    status: string;
    challengerId: string;
    opponentId: string | null;
    genreId: string | null;
    genre?: { name: string } | null;
    productionMinutes: number;
    createdAt: string;
    winnerId: string | null;
    forfeitReason: string | null;
    _count?: { votes: number };
}
interface GenreOpt { id: string; name: string }

const Header: React.FC = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Swords size={32} color={colors.primary} style={{ marginRight: '16px' }} />
        <div>
            <h1 style={{ margin: 0 }}>Head-to-Head Battles</h1>
            <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                Manage 1v1 producer matchmaking, sample pools and Elo settings
            </p>
        </div>
    </div>
);

const Explanation: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="settings-explanation" style={{
        backgroundColor: colors.surface, padding: spacing.md,
        borderRadius: borderRadius.md, marginBottom: spacing.lg,
        borderLeft: `4px solid ${colors.primary}`,
    }}>
        <p style={{ margin: 0, color: colors.textPrimary }}>{children}</p>
    </div>
);

const Tab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
        background: active ? colors.primary : 'transparent',
        color: active ? '#fff' : colors.textSecondary,
        border: `1px solid ${active ? colors.primary : 'rgba(255,255,255,0.08)'}`,
        padding: '8px 16px', borderRadius: borderRadius.md,
        cursor: 'pointer', fontWeight: 600,
    }}>{children}</button>
);

export const HeadToHeadAdminPage: React.FC = () => {
    const [tab, setTab] = useState<'pools' | 'settings' | 'matches'>('pools');
    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <Header />
            <Explanation>
                Head-to-Head is a 1v1 producer battle module separate from weekly Beat Battles.
                Players join a queue, ready up, get curated samples, produce, then peers vote.
                Wins/losses update an Elo-style leaderboard with global and genre-specific rankings.
            </Explanation>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <Tab active={tab === 'pools'} onClick={() => setTab('pools')}>Sample Pools</Tab>
                <Tab active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</Tab>
                <Tab active={tab === 'matches'} onClick={() => setTab('matches')}>Matches</Tab>
            </div>

            {tab === 'pools' && <PoolsTab />}
            {tab === 'settings' && <SettingsTab />}
            {tab === 'matches' && <MatchesTab />}
        </div>
    );
};

// ─── Pools tab ─────────────────────────────────────────────────────────────

const PoolsTab: React.FC = () => {
    const [pools, setPools] = useState<Pool[]>([]);
    const [genres, setGenres] = useState<GenreOpt[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newGenreId, setNewGenreId] = useState('');

    const load = async () => {
        setLoading(true);
        const [pRes, gRes] = await Promise.all([
            fetch(`${API}/api/head-to-head/admin/pools`, { credentials: 'include' }),
            fetch(`${API}/api/musician/genres`, { credentials: 'include' }),
        ]);
        if (pRes.ok) setPools(await pRes.json());
        if (gRes.ok) setGenres(await gRes.json());
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const createPool = async () => {
        if (!newName.trim()) return;
        const res = await fetch(`${API}/api/head-to-head/admin/pools`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, description: newDesc || null, genreId: newGenreId || null }),
        });
        if (res.ok) {
            setNewName(''); setNewDesc(''); setNewGenreId(''); setCreating(false);
            await load();
        }
    };

    const togglePool = async (p: Pool) => {
        await fetch(`${API}/api/head-to-head/admin/pools/${p.id}`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !p.isActive }),
        });
        await load();
    };

    const deletePool = async (p: Pool) => {
        if (!confirm(`Delete pool "${p.name}" and all its samples? This cannot be undone.`)) return;
        await fetch(`${API}/api/head-to-head/admin/pools/${p.id}`, { method: 'DELETE', credentials: 'include' });
        await load();
    };

    const uploadSamples = async (poolId: string, files: FileList, category: string) => {
        const fd = new FormData();
        Array.from(files).forEach(f => fd.append('samples', f));
        fd.append('category', category);
        await fetch(`${API}/api/head-to-head/admin/pools/${poolId}/samples`, {
            method: 'POST', credentials: 'include', body: fd,
        });
        await load();
    };

    const updateSampleCategory = async (id: string, category: string) => {
        await fetch(`${API}/api/head-to-head/admin/samples/${id}`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
        });
        await load();
    };

    const deleteSample = async (id: string) => {
        await fetch(`${API}/api/head-to-head/admin/samples/${id}`, { method: 'DELETE', credentials: 'include' });
        await load();
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader className="spin" /></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Sample Pools ({pools.length})</h3>
                <button onClick={() => setCreating(!creating)} style={{
                    background: colors.primary, color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: borderRadius.md, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
                }}>
                    <Plus size={16} /> New Pool
                </button>
            </div>

            {creating && (
                <div style={{ background: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: 16 }}>
                    <input placeholder="Pool name" value={newName} onChange={e => setNewName(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginBottom: 8, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 }} />
                    <input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginBottom: 8, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 }} />
                    <select value={newGenreId} onChange={e => setNewGenreId(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginBottom: 8, background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 }}>
                        <option value="">Global (any genre)</option>
                        {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={createPool} style={{ background: colors.primary, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Create</button>
                        <button onClick={() => setCreating(false)} style={{ background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`, padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}

            {pools.length === 0 && (
                <p style={{ color: colors.textSecondary, textAlign: 'center', padding: 40 }}>
                    No pools yet. Create one and upload samples to enable matchmaking.
                </p>
            )}

            {pools.map(p => (
                <PoolCard key={p.id} pool={p}
                    onToggle={() => togglePool(p)}
                    onDelete={() => deletePool(p)}
                    onUpload={(files, cat) => uploadSamples(p.id, files, cat)}
                    onChangeCategory={(id, cat) => updateSampleCategory(id, cat)}
                    onDeleteSample={deleteSample} />
            ))}
        </div>
    );
};

// ─── Pool card ─────────────────────────────────────────────────────────────

const PoolCard: React.FC<{
    pool: Pool;
    onToggle: () => void;
    onDelete: () => void;
    onUpload: (files: FileList, category: string) => void;
    onChangeCategory: (id: string, category: string) => void;
    onDeleteSample: (id: string) => void;
}> = ({ pool: p, onToggle, onDelete, onUpload, onChangeCategory, onDeleteSample }) => {
    const [uploadCategory, setUploadCategory] = useState<string>('kick');

    // Group samples by category for a cleaner overview
    const grouped: Record<string, Sample[]> = {};
    for (const s of p.samples) {
        const cat = (s.category || 'other').toLowerCase();
        (grouped[cat] = grouped[cat] || []).push(s);
    }
    const orderedCats = SAMPLE_CATEGORIES.filter(c => grouped[c]?.length);

    return (
        <div style={{ background: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <h4 style={{ margin: '0 0 4px' }}>{p.name} {!p.isActive && <span style={{ fontSize: 11, color: colors.textSecondary, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>DISABLED</span>}</h4>
                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13 }}>
                        {p.genre?.name || 'Global'} · {p._count?.samples ?? p.samples.length} sample(s)
                        {p.description && ` · ${p.description}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
                        style={{ background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 13, cursor: 'pointer' }}>
                        {SAMPLE_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                    </select>
                    <label style={{ background: colors.background, color: colors.textPrimary, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.border}` }}>
                        <Upload size={14} /> Upload
                        <input type="file" multiple accept="audio/*" style={{ display: 'none' }}
                            onChange={e => e.target.files && onUpload(e.target.files, uploadCategory)} />
                    </label>
                    <button onClick={onToggle} style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                        {p.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={onDelete} style={{ background: 'transparent', border: `1px solid ${colors.error}`, color: colors.error, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {p.samples.length === 0 ? (
                <p style={{ margin: '12px 0 0', color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>
                    Pick a category above and upload some samples.
                </p>
            ) : (
                <div style={{ marginTop: 12 }}>
                    {orderedCats.map(cat => {
                        const color = CATEGORY_COLOR[cat] || CATEGORY_COLOR.other;
                        return (
                            <div key={cat} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color, marginBottom: 4 }}>
                                    {cat.toUpperCase()} · {grouped[cat].length}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {grouped[cat].map(s => (
                                        <div key={s.id} style={{
                                            background: colors.background, padding: '4px 8px', borderRadius: 4, fontSize: 12,
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            border: `1px solid ${color}33`,
                                        }}>
                                            <span title={s.name} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                            <select value={cat} onChange={e => onChangeCategory(s.id, e.target.value)}
                                                title="Change category"
                                                style={{ background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: 3, padding: '0 4px', fontSize: 10, cursor: 'pointer' }}>
                                                {SAMPLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <button onClick={() => onDeleteSample(s.id)} style={{ background: 'transparent', border: 'none', color: colors.error, cursor: 'pointer', padding: 0, display: 'flex' }}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Settings tab ──────────────────────────────────────────────────────────

const SettingsTab: React.FC = () => {
    const [s, setS] = useState<Settings | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`${API}/api/head-to-head/admin/settings`, { credentials: 'include' })
            .then(r => r.json()).then(setS);
    }, []);

    const save = async () => {
        if (!s) return;
        setSaving(true);
        await fetch(`${API}/api/head-to-head/admin/settings`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
        });
        setSaving(false);
    };

    if (!s) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader className="spin" /></div>;

    const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, color: colors.textPrimary, fontWeight: 600 }}>{label}</label>
            {hint && <p style={{ margin: '0 0 6px', color: colors.textSecondary, fontSize: 12 }}>{hint}</p>}
            {children}
        </div>
    );

    const numStyle: React.CSSProperties = { width: '100%', padding: '8px', background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 };

    return (
        <div style={{ background: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, maxWidth: 700 }}>
            <Field label="Enabled" hint="Master switch for the entire Head-to-Head module.">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.textPrimary }}>
                    <input type="checkbox" checked={s.enabled} onChange={e => setS({ ...s, enabled: e.target.checked })} />
                    {s.enabled ? 'Module is active' : 'Module is disabled'}
                </label>
            </Field>
            <Field label="Announce queue entries" hint="Post a Discord message when someone is waiting for an opponent (after 2 minutes, to skip instant matches). Voting and winner announcements are unaffected by this toggle.">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.textPrimary }}>
                    <input type="checkbox" checked={s.announceQueueEnabled ?? true} onChange={e => setS({ ...s, announceQueueEnabled: e.target.checked })} />
                    {(s.announceQueueEnabled ?? true) ? 'Post "looking for opponent" messages' : 'Queue announcements off'}
                </label>
            </Field>
            <Field label="Default production minutes" hint="How long players have to produce after readying up.">
                <input type="number" value={s.defaultProductionMinutes} min={5} max={720}
                    onChange={e => setS({ ...s, defaultProductionMinutes: Number(e.target.value) })} style={numStyle} />
            </Field>
            <Field label="Default voting minutes" hint="Voting window after both submissions are in.">
                <input type="number" value={s.defaultVotingMinutes} min={5} max={1440}
                    onChange={e => setS({ ...s, defaultVotingMinutes: Number(e.target.value) })} style={numStyle} />
            </Field>
            <Field label="Ready-up minutes" hint="Time both players have to confirm Ready before forfeit.">
                <input type="number" value={s.readyUpMinutes} min={1} max={60}
                    onChange={e => setS({ ...s, readyUpMinutes: Number(e.target.value) })} style={numStyle} />
            </Field>
            <Field label="Samples per match" hint="Number of samples auto-distributed from the pool.">
                <input type="number" value={s.samplesPerMatch} min={1} max={20}
                    onChange={e => setS({ ...s, samplesPerMatch: Number(e.target.value) })} style={numStyle} />
            </Field>
            <Field label="Starting Elo" hint="New players start with this rating.">
                <input type="number" value={s.startingElo} min={100} max={3000}
                    onChange={e => setS({ ...s, startingElo: Number(e.target.value) })} style={numStyle} />
            </Field>
            <Field label="K-factor" hint="Higher = bigger Elo swings per match. 32 is standard.">
                <input type="number" value={s.kFactor} min={4} max={128}
                    onChange={e => setS({ ...s, kFactor: Number(e.target.value) })} style={numStyle} />
            </Field>
            <Field label="Minimum votes to finalize" hint="A match won't conclude until this many peer votes are cast (window auto-extends if not met).">
                <input type="number" value={s.minVotesToFinalize} min={1} max={50}
                    onChange={e => setS({ ...s, minVotesToFinalize: Number(e.target.value) })} style={numStyle} />
            </Field>

            <button onClick={save} disabled={saving} style={{
                background: colors.primary, color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: borderRadius.md, cursor: 'pointer',
                fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}>
                <SettingsIcon size={16} /> {saving ? 'Saving…' : 'Save Settings'}
            </button>
        </div>
    );
};

// ─── Matches tab ───────────────────────────────────────────────────────────

const MatchesTab: React.FC = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [filter, setFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const url = filter ? `${API}/api/head-to-head/admin/matches?status=${filter}` : `${API}/api/head-to-head/admin/matches`;
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) setMatches(await res.json());
        setLoading(false);
    };
    useEffect(() => { load(); }, [filter]);

    const cancel = async (id: string) => {
        if (!confirm('Cancel this match?')) return;
        await fetch(`${API}/api/head-to-head/admin/matches/${id}/cancel`, { method: 'POST', credentials: 'include' });
        await load();
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['', 'queued', 'ready_check', 'producing', 'voting', 'completed', 'forfeited', 'cancelled'].map(s => (
                    <Tab key={s} active={filter === s} onClick={() => setFilter(s)}>{s || 'All'}</Tab>
                ))}
            </div>
            {loading ? <Loader className="spin" /> : matches.length === 0 ? (
                <p style={{ color: colors.textSecondary, textAlign: 'center', padding: 40 }}>No matches.</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: colors.textPrimary }}>
                        <thead>
                            <tr style={{ background: colors.surface }}>
                                <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
                                <th style={{ padding: 8, textAlign: 'left' }}>Genre</th>
                                <th style={{ padding: 8, textAlign: 'left' }}>Challenger</th>
                                <th style={{ padding: 8, textAlign: 'left' }}>Opponent</th>
                                <th style={{ padding: 8, textAlign: 'left' }}>Votes</th>
                                <th style={{ padding: 8, textAlign: 'left' }}>Created</th>
                                <th style={{ padding: 8 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map(m => (
                                <tr key={m.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                    <td style={{ padding: 8, fontSize: 12 }}><span style={{ background: colors.surface, padding: '2px 6px', borderRadius: 4 }}>{m.status}</span></td>
                                    <td style={{ padding: 8, fontSize: 13 }}>{m.genre?.name || 'Global'}</td>
                                    <td style={{ padding: 8, fontSize: 12, fontFamily: 'monospace' }}>{m.challengerId.slice(0, 10)}…</td>
                                    <td style={{ padding: 8, fontSize: 12, fontFamily: 'monospace' }}>{m.opponentId ? m.opponentId.slice(0, 10) + '…' : '—'}</td>
                                    <td style={{ padding: 8, fontSize: 13 }}>{m._count?.votes ?? 0}</td>
                                    <td style={{ padding: 8, fontSize: 12, color: colors.textSecondary }}>{new Date(m.createdAt).toLocaleString()}</td>
                                    <td style={{ padding: 8 }}>
                                        {!['completed', 'forfeited', 'cancelled'].includes(m.status) && (
                                            <button onClick={() => cancel(m.id)} style={{ background: 'transparent', border: `1px solid ${colors.error}`, color: colors.error, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default HeadToHeadAdminPage;

