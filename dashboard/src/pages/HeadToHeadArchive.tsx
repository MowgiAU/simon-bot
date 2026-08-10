/**
 * Alt F — Arena Battle Archive (/arena/history)
 * Public list of every completed/forfeited 1v1 battle: both producers, both tracks, the winner.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft, Calendar, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    AltSidebar, BG, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';
import { SubmissionPlayer } from './HeadToHeadArena';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';
const S_FALLBACK = 'rgba(255,255,255,0.1)';

interface Profile { userId: string; username: string | null; displayName: string | null; avatar: string | null; }
interface ArchiveMatch {
    id: string;
    genreId: string | null;
    genreName: string | null;
    productionMinutes: number;
    status: string;
    winnerId: string | null;
    loserId: string | null;
    forfeitReason: string | null;
    challengerProfile: Profile;
    opponentProfile: Profile;
    challengerEloBefore: number | null;
    challengerEloAfter: number | null;
    opponentEloBefore: number | null;
    opponentEloAfter: number | null;
    hasChallengerSubmission: boolean;
    hasOpponentSubmission: boolean;
    completedAt: string;
}

function pName(p: Profile) { return p.displayName || p.username || p.userId.slice(0, 8); }
function relTime(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

const PAGE_SIZE = 20;

export const HeadToHeadArchive: React.FC = () => {
    const { player } = usePlayer();
    const navigate = useNavigate();
    const [matches, setMatches] = useState<ArchiveMatch[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        axios.get('/api/head-to-head/archive', { params: { page, pageSize: PAGE_SIZE } })
            .then(r => {
                if (cancelled) return;
                setMatches(r.data.matches || []);
                setTotal(r.data.total || 0);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [page]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Arena" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Arena', to: '/arena' }, { label: 'Battle History' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 32px' }}>
                        <button onClick={() => navigate('/arena')} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13, padding: 0, fontFamily: FONT }}>
                            <ArrowLeft size={15} /> Back to Arena
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <Trophy size={28} color={TERTIARY} />
                            <div>
                                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>Battle History</h1>
                                <p style={{ margin: '4px 0 0', color: SUB, fontSize: 13 }}>Every finished 1v1 battle — tracks, winners, Elo changes.</p>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '60px 20px', textAlign: 'center', color: SUB, fontSize: 13 }}>Loading battles...</div>
                        ) : matches.length === 0 ? (
                            <div style={{ ...glass, borderRadius: 18, padding: '60px 20px', textAlign: 'center' }}>
                                <Trophy size={40} color={SUB} style={{ opacity: 0.4, marginBottom: 10 }} />
                                <p style={{ margin: 0, color: SUB, fontSize: 13 }}>No battles have finished yet. Check back soon!</p>
                            </div>
                        ) : (
                            <>
                                {matches.map(m => {
                                    const forfeit = m.status === 'forfeited';
                                    const sides = [
                                        { profile: m.challengerProfile, side: 'challenger' as const, has: m.hasChallengerSubmission, color: SECONDARY, eloBefore: m.challengerEloBefore, eloAfter: m.challengerEloAfter },
                                        { profile: m.opponentProfile, side: 'opponent' as const, has: m.hasOpponentSubmission, color: TERTIARY, eloBefore: m.opponentEloBefore, eloAfter: m.opponentEloAfter },
                                    ];
                                    return (
                                        <div key={m.id} style={{ ...glass, borderRadius: 16, padding: 18, marginBottom: 14 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: SECONDARY, background: `${SECONDARY}1e`, border: `1px solid ${SECONDARY}44`, borderRadius: 9999, padding: '3px 9px' }}>
                                                    {m.genreName || 'Global'}
                                                </span>
                                                {forfeit && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#F5A623', background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 9999, padding: '3px 9px' }}>
                                                        <Flag size={11} /> Won by forfeit
                                                    </span>
                                                )}
                                                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: SUB }}>
                                                    <Calendar size={12} /> {relTime(m.completedAt)}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                                                {sides.map(s => {
                                                    const won = m.winnerId === s.profile.userId;
                                                    const delta = (s.eloBefore != null && s.eloAfter != null) ? s.eloAfter - s.eloBefore : null;
                                                    return (
                                                        <div key={s.side} style={{
                                                            padding: 13, borderRadius: 12,
                                                            border: won ? `2px solid ${s.color}` : `1px solid ${BORDER}`,
                                                            background: won ? `${s.color}14` : 'rgba(255,255,255,0.03)',
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                                                {s.profile.avatar
                                                                    ? <img src={s.profile.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: 26, height: 26, borderRadius: '50%', background: S_FALLBACK }} />}
                                                                <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT }}>{pName(s.profile)}</span>
                                                                {won && <Trophy size={13} color={s.color} style={{ marginLeft: 2 }} />}
                                                                {delta != null && (
                                                                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: delta >= 0 ? '#57F287' : '#FF6B6B' }}>
                                                                        {delta >= 0 ? `+${delta}` : delta}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {s.has
                                                                ? <SubmissionPlayer matchId={m.id} side={s.side} color={s.color} />
                                                                : <p style={{ color: SUB, fontSize: 12, margin: 0 }}>No submission</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, background: 'transparent', color: page <= 1 ? SUB : TEXT, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12.5, fontFamily: FONT, opacity: page <= 1 ? 0.5 : 1 }}>
                                            <ChevronLeft size={14} /> Prev
                                        </button>
                                        <span style={{ fontSize: 12.5, color: SUB }}>Page {page} of {totalPages}</span>
                                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, background: 'transparent', color: page >= totalPages ? SUB : TEXT, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 12.5, fontFamily: FONT, opacity: page >= totalPages ? 0.5 : 1 }}>
                                            Next <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
