import React, { useEffect, useState, useCallback } from 'react';
import { Swords, Trophy, Clock, CheckCircle, Upload, Users, Loader, Play, Award, Vote } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = '';

interface Genre { id: string; name: string; sampleCount: number }
interface Settings {
    enabled: boolean;
    defaultProductionMinutes: number;
    defaultVotingMinutes: number;
    readyUpMinutes: number;
    samplesPerMatch: number;
    minVotesToFinalize: number;
}
interface Profile { userId: string; username: string | null; displayName: string | null; avatar: string | null }
interface Sample { id: string; name: string; fileUrl: string; fileType: string }
interface MatchInfo {
    id: string;
    status: string;
    challengerId: string;
    opponentId: string | null;
    productionMinutes: number;
    votingMinutes: number;
    sampleIds: string[] | null;
    samples?: Sample[];
    challengerReady: boolean;
    opponentReady: boolean;
    readyDeadline: string | null;
    producingDeadline: string | null;
    challengerSubmissionUrl: string | null;
    opponentSubmissionUrl: string | null;
    votingEnd: string | null;
    winnerId: string | null;
    loserId: string | null;
    forfeitReason: string | null;
    challengerProfile?: Profile | null;
    opponentProfile?: Profile | null;
    genre?: { name: string } | null;
    challengerEloAfter?: number | null;
    challengerEloBefore?: number | null;
    opponentEloAfter?: number | null;
    opponentEloBefore?: number | null;
}
interface MeData {
    userId: string;
    globalRating: { elo: number; wins: number; losses: number; forfeits: number; matchesPlayed: number };
    genreRatings: { genreId: string; genreName: string; elo: number; wins: number; losses: number }[];
    activeMatch: MatchInfo | null;
    recentMatches: MatchInfo[];
}
interface VotingMatch extends MatchInfo {
    myVote: string | null;
}
interface LeaderRow {
    rank: number;
    userId: string;
    elo: number;
    wins: number;
    losses: number;
    matchesPlayed: number;
    profile: Profile | null;
    genreName: string | null;
}

function timeLeft(iso: string | null): string {
    if (!iso) return '—';
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m ${secs}s`;
}

function profileName(p: Profile | null | undefined, fallbackId: string): string {
    return p?.displayName || p?.username || fallbackId.slice(0, 8);
}

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{
        background: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.lg, marginBottom: spacing.md,
        border: `1px solid ${colors.glassBorder}`,
        ...style,
    }}>{children}</div>
);

const PrimaryButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ onClick, disabled, children, style }) => (
    <button onClick={onClick} disabled={disabled} style={{
        background: disabled ? 'rgba(255,255,255,0.06)' : colors.primary,
        color: disabled ? colors.textSecondary : '#fff',
        border: 'none', padding: '10px 20px', borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style,
    }}>{children}</button>
);

export const HeadToHeadArenaPage: React.FC = () => {
    const [tab, setTab] = useState<'arena' | 'vote' | 'leaderboard'>('arena');
    const [settings, setSettings] = useState<Settings | null>(null);

    useEffect(() => {
        fetch(`${API}/api/head-to-head/settings`).then(r => r.json()).then(setSettings).catch(() => {});
    }, []);

    return (
        <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', color: colors.textPrimary }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Swords size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Head-to-Head Arena</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                        1v1 producer battles · curated samples · peer-judged · Elo ranked
                    </p>
                </div>
            </div>

            {settings && !settings.enabled && (
                <Card style={{ borderLeft: `4px solid ${colors.warning}` }}>
                    <p style={{ margin: 0 }}>Head-to-Head is currently disabled by an administrator. Check back soon.</p>
                </Card>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {([['arena', 'My Match', Swords], ['vote', 'Vote', Vote], ['leaderboard', 'Leaderboard', Trophy]] as const).map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        background: tab === id ? colors.primary : 'transparent',
                        color: tab === id ? '#fff' : colors.textSecondary,
                        border: `1px solid ${tab === id ? colors.primary : colors.glassBorder}`,
                        padding: '8px 16px', borderRadius: borderRadius.md,
                        cursor: 'pointer', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}><Icon size={16} /> {label}</button>
                ))}
            </div>

            {tab === 'arena' && <ArenaTab settings={settings} />}
            {tab === 'vote' && <VoteTab />}
            {tab === 'leaderboard' && <LeaderboardTab />}
        </div>
    );
};

// ─── Arena tab: queue + my match ───────────────────────────────────────────

const ArenaTab: React.FC<{ settings: Settings | null }> = ({ settings }) => {
    const [me, setMe] = useState<MeData | null>(null);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [genreId, setGenreId] = useState<string>('');
    const [prodMin, setProdMin] = useState<number>(60);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const [mRes, gRes] = await Promise.all([
            fetch(`${API}/api/head-to-head/me`, { credentials: 'include' }),
            fetch(`${API}/api/head-to-head/genres`),
        ]);
        if (mRes.ok) setMe(await mRes.json());
        if (gRes.ok) {
            const data = await gRes.json();
            setGenres(data.genres || []);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);
    useEffect(() => {
        const t = setInterval(reload, 15000);
        return () => clearInterval(t);
    }, [reload]);
    useEffect(() => { if (settings) setProdMin(settings.defaultProductionMinutes); }, [settings]);

    const joinQueue = async () => {
        setBusy(true); setError(null);
        const res = await fetch(`${API}/api/head-to-head/queue`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ genreId: genreId || null, productionMinutes: prodMin }),
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            setError(j.error || 'Failed to join queue');
        }
        setBusy(false);
        await reload();
    };

    const leaveQueue = async () => {
        setBusy(true);
        await fetch(`${API}/api/head-to-head/queue/leave`, { method: 'POST', credentials: 'include' });
        setBusy(false);
        await reload();
    };

    if (!me) return <Loader className="spin" />;

    return (
        <div>
            {/* Stats card */}
            <Card>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                        <div style={{ color: colors.textSecondary, fontSize: 12 }}>Your Elo</div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: colors.primary }}>{me.globalRating.elo}</div>
                    </div>
                    <div>
                        <div style={{ color: colors.textSecondary, fontSize: 12 }}>Record</div>
                        <div style={{ fontSize: 18 }}>{me.globalRating.wins}W · {me.globalRating.losses}L{me.globalRating.forfeits ? ` · ${me.globalRating.forfeits} forfeits` : ''}</div>
                    </div>
                    {me.genreRatings.length > 0 && (
                        <div>
                            <div style={{ color: colors.textSecondary, fontSize: 12 }}>Genre Elo</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {me.genreRatings.map(g => (
                                    <span key={g.genreId} style={{ background: colors.surfaceLight, padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                                        {g.genreName} <strong>{g.elo}</strong>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Active match panel */}
            {me.activeMatch ? (
                <ActiveMatchPanel match={me.activeMatch} myUserId={me.userId} onChange={reload} />
            ) : (
                <Card>
                    <h3 style={{ margin: '0 0 12px' }}>Join Queue</h3>
                    {error && <p style={{ color: colors.error, margin: '0 0 8px' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: colors.textSecondary }}>Genre</label>
                            <select value={genreId} onChange={e => setGenreId(e.target.value)}
                                style={{ width: '100%', padding: '8px', background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 }}>
                                <option value="">Any genre (global pool)</option>
                                {genres.map(g => <option key={g.id} value={g.id}>{g.name} ({g.sampleCount} samples)</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: colors.textSecondary }}>Production minutes</label>
                            <select value={prodMin} onChange={e => setProdMin(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px', background: colors.background, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 }}>
                                {[15, 30, 45, 60, 90, 120, 180, 240, 360, 720].map(n => <option key={n} value={n}>{n} minutes</option>)}
                            </select>
                        </div>
                    </div>
                    <PrimaryButton onClick={joinQueue} disabled={busy || (settings ? !settings.enabled : false)}>
                        <Play size={16} /> Join Queue
                    </PrimaryButton>
                </Card>
            )}

            {/* Recent */}
            {me.recentMatches.length > 0 && (
                <Card>
                    <h3 style={{ margin: '0 0 12px' }}>Recent Matches</h3>
                    {me.recentMatches.map(m => {
                        const won = m.winnerId === me.userId;
                        return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>
                                <span>{m.genre?.name || 'Global'} — vs {m.opponentId ? profileName(m.opponentProfile, m.opponentId === me.userId ? m.challengerId : m.opponentId) : '—'}</span>
                                <span style={{ color: won ? colors.success : colors.error, fontWeight: 600 }}>
                                    {m.status === 'forfeited' ? (won ? 'Forfeit Win' : 'Forfeit Loss') : (won ? 'Win' : 'Loss')}
                                </span>
                            </div>
                        );
                    })}
                </Card>
            )}
        </div>
    );
};

// ─── Active match panel ───────────────────────────────────────────────────

const ActiveMatchPanel: React.FC<{ match: MatchInfo; myUserId: string; onChange: () => void }> = ({ match, myUserId, onChange }) => {
    const [, force] = useState(0);
    useEffect(() => { const t = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(t); }, []);

    const [submitting, setSubmitting] = useState(false);
    const [readying, setReadying] = useState(false);

    const isCh = match.challengerId === myUserId;
    const meReady = isCh ? match.challengerReady : match.opponentReady;
    const oppReady = isCh ? match.opponentReady : match.challengerReady;
    const oppId = isCh ? match.opponentId : match.challengerId;
    const oppProf = isCh ? match.opponentProfile : match.challengerProfile;
    const mySubmitted = isCh ? !!match.challengerSubmissionUrl : !!match.opponentSubmissionUrl;
    const oppSubmitted = isCh ? !!match.opponentSubmissionUrl : !!match.challengerSubmissionUrl;

    const ready = async () => {
        setReadying(true);
        await fetch(`${API}/api/head-to-head/match/${match.id}/ready`, { method: 'POST', credentials: 'include' });
        setReadying(false);
        onChange();
    };

    const submit = async (file: File) => {
        setSubmitting(true);
        const fd = new FormData();
        fd.append('submission', file);
        const res = await fetch(`${API}/api/head-to-head/match/${match.id}/submit`, {
            method: 'POST', credentials: 'include', body: fd,
        });
        setSubmitting(false);
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            alert(j.error || 'Upload failed');
        }
        onChange();
    };

    return (
        <Card style={{ borderLeft: `4px solid ${colors.primary}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0 }}>Your Match · <span style={{ color: colors.primary }}>{match.status.replace('_', ' ').toUpperCase()}</span></h3>
                <span style={{ color: colors.textSecondary, fontSize: 13 }}>{match.genre?.name || 'Global'} · {match.productionMinutes}m</span>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200, background: colors.background, padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>You</div>
                    <div style={{ fontWeight: 600 }}>{profileName(isCh ? match.challengerProfile : match.opponentProfile, myUserId)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: colors.background, padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>Opponent</div>
                    <div style={{ fontWeight: 600 }}>{oppId ? profileName(oppProf, oppId) : 'Waiting…'}</div>
                </div>
            </div>

            {match.status === 'queued' && (
                <p style={{ margin: 0, color: colors.textSecondary }}>
                    <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Searching for an opponent in your bucket… The page will update automatically.
                </p>
            )}

            {match.status === 'ready_check' && (
                <div>
                    <p style={{ marginTop: 0 }}>
                        Ready up before <strong>{timeLeft(match.readyDeadline)}</strong> — both players must confirm to start the production timer.
                    </p>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <PrimaryButton onClick={ready} disabled={meReady || readying}>
                            <CheckCircle size={16} /> {meReady ? 'You are ready' : 'Ready Up'}
                        </PrimaryButton>
                        <span style={{ color: colors.textSecondary, fontSize: 13 }}>
                            Opponent: {oppReady ? '✓ Ready' : 'Not ready'}
                        </span>
                    </div>
                </div>
            )}

            {match.status === 'producing' && (
                <div>
                    <p style={{ marginTop: 0 }}>
                        <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Submission deadline: <strong>{timeLeft(match.producingDeadline)}</strong>
                    </p>
                    {match.samples && match.samples.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <h4 style={{ marginBottom: 8 }}>Your Samples</h4>
                            {match.samples.map(s => (
                                <a key={s.id} href={s.fileUrl} target="_blank" rel="noopener noreferrer" download style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: colors.background, color: colors.textPrimary, textDecoration: 'none',
                                    padding: '6px 10px', borderRadius: 6, marginRight: 8, marginBottom: 8, fontSize: 13,
                                    border: `1px solid ${colors.border}`,
                                }}>{s.name}</a>
                            ))}
                        </div>
                    )}
                    <div style={{ marginBottom: 8, color: mySubmitted ? colors.success : colors.textSecondary }}>
                        {mySubmitted ? '✓ Your track is submitted' : 'You have not submitted yet'} · Opponent: {oppSubmitted ? '✓' : 'pending'}
                    </div>
                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: colors.primary, color: '#fff', padding: '10px 20px',
                        borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: 600,
                    }}>
                        <Upload size={16} /> {submitting ? 'Uploading…' : (mySubmitted ? 'Replace Submission' : 'Submit Track')}
                        <input type="file" accept="audio/*" style={{ display: 'none' }}
                            disabled={submitting}
                            onChange={e => e.target.files?.[0] && submit(e.target.files[0])} />
                    </label>
                </div>
            )}

            {match.status === 'voting' && (
                <p style={{ marginTop: 0 }}>
                    <Vote size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Voting closes in <strong>{timeLeft(match.votingEnd)}</strong>. Other competitors are judging your match now.
                </p>
            )}
        </Card>
    );
};

// ─── Vote tab ──────────────────────────────────────────────────────────────

const VoteTab: React.FC = () => {
    const [data, setData] = useState<{ eligible: boolean; reason?: string; matches: VotingMatch[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const reload = async () => {
        setLoading(true);
        const res = await fetch(`${API}/api/head-to-head/voting/queue`, { credentials: 'include' });
        if (res.ok) setData(await res.json());
        setLoading(false);
    };

    useEffect(() => { reload(); }, []);

    const vote = async (matchId: string, voteFor: string) => {
        await fetch(`${API}/api/head-to-head/match/${matchId}/vote`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voteFor }),
        });
        await reload();
    };

    if (loading || !data) return <Loader className="spin" />;
    if (!data.eligible) return <Card><p style={{ margin: 0 }}>{data.reason}</p></Card>;
    if (data.matches.length === 0) return <Card><p style={{ margin: 0 }}>No matches need votes right now. Check back soon.</p></Card>;

    return (
        <div>
            {data.matches.map(m => {
                const chName = profileName(m.challengerProfile, m.challengerId);
                const opName = m.opponentId ? profileName(m.opponentProfile, m.opponentId) : '—';
                return (
                    <Card key={m.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <h4 style={{ margin: 0 }}>{m.genre?.name || 'Global'} battle</h4>
                            <span style={{ color: colors.textSecondary, fontSize: 13 }}>Closes in {timeLeft(m.votingEnd)}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                            {[{ id: m.challengerId, name: chName, url: m.challengerSubmissionUrl }, { id: m.opponentId!, name: opName, url: m.opponentSubmissionUrl }].map(side => (
                                <div key={side.id} style={{ background: colors.background, padding: 12, borderRadius: 8, border: m.myVote === side.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}` }}>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{side.name}</div>
                                    {side.url ? (
                                        <audio controls src={side.url} style={{ width: '100%', marginBottom: 8 }} />
                                    ) : <p style={{ color: colors.textSecondary, fontSize: 13 }}>No submission</p>}
                                    <PrimaryButton onClick={() => vote(m.id, side.id)} disabled={m.myVote === side.id}>
                                        <Award size={14} /> {m.myVote === side.id ? 'Your Vote' : 'Vote'}
                                    </PrimaryButton>
                                </div>
                            ))}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

// ─── Leaderboard tab ───────────────────────────────────────────────────────

const LeaderboardTab: React.FC = () => {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [genreId, setGenreId] = useState<string>('');
    const [rows, setRows] = useState<LeaderRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async (g: string) => {
        setLoading(true);
        const url = g ? `${API}/api/head-to-head/leaderboard?genreId=${g}` : `${API}/api/head-to-head/leaderboard`;
        const res = await fetch(url);
        if (res.ok) setRows(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetch(`${API}/api/head-to-head/genres`).then(r => r.json()).then(d => setGenres(d.genres || []));
    }, []);
    useEffect(() => { load(genreId); }, [genreId]);

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <select value={genreId} onChange={e => setGenreId(e.target.value)}
                    style={{ padding: '8px 12px', background: colors.surface, color: colors.textPrimary, border: `1px solid ${colors.border}`, borderRadius: 6 }}>
                    <option value="">Global</option>
                    {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>
            {loading ? <Loader className="spin" /> : rows.length === 0 ? (
                <Card><p style={{ margin: 0 }}>No ranked players in this category yet.</p></Card>
            ) : (
                <Card>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                                <th style={{ textAlign: 'left', padding: 8 }}>#</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Producer</th>
                                <th style={{ textAlign: 'right', padding: 8 }}>Elo</th>
                                <th style={{ textAlign: 'right', padding: 8 }}>W/L</th>
                                <th style={{ textAlign: 'right', padding: 8 }}>Matches</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={`${r.userId}-${r.rank}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                    <td style={{ padding: 8, fontWeight: 700, color: r.rank <= 3 ? colors.primary : colors.textPrimary }}>
                                        {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                                    </td>
                                    <td style={{ padding: 8 }}>{profileName(r.profile, r.userId)}</td>
                                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{r.elo}</td>
                                    <td style={{ padding: 8, textAlign: 'right', color: colors.textSecondary }}>{r.wins}/{r.losses}</td>
                                    <td style={{ padding: 8, textAlign: 'right', color: colors.textSecondary }}>{r.matchesPlayed}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
};

export default HeadToHeadArenaPage;
