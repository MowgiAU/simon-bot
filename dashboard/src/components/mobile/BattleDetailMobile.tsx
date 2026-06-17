/**
 * Mobile Beat Battle detail view — the Stitch mockup design fed by the real
 * battle data + handlers from BattleDetailPage. Rendered only on mobile inside
 * DiscoveryLayout (header, bottom nav, GlobalPlayer come from the layout).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Timer, Music2, FileAudio, Download, Award, Flame, Play, Pause, Crown } from 'lucide-react';
import { usePlayer } from '../PlayerProvider';
import { SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, BG, waveHeights } from '../../pages/MobilePreviewChrome';

const API = import.meta.env.VITE_API_URL || '';
const abs = (u: string | null | undefined) => (!u ? '' : u.startsWith('http') ? u : `${API}${u}`);
const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };
const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

interface Props {
    battle: any;
    entries: any[];
    countdown: { days: number; hours: number; minutes: number; label: string } | null;
    statusLabel: string;
    statusColor: string;
    isVotingPhase: boolean;
    isCompleted: boolean;
    myRanks: Record<string, number>;
    votingId: string | null;
    onVote: (entryId: string) => void;
    onDownload: (url: string, name: string) => void;
    entryPoints: (e: any) => number;
}

export const BattleDetailMobile: React.FC<Props> = ({ battle, entries, countdown, statusLabel, statusColor, isVotingPhase, isCompleted, myRanks, votingId, onVote, onDownload, entryPoints }) => {
    const { player, setTrack, togglePlay } = usePlayer();

    const sampleKit: { name: string; url: string }[] = (battle.rulesData || []).flatMap((r: any) => r.samples || []);
    const ruleLines: string[] = (battle.rulesData || []).map((r: any) => r.text).filter(Boolean);
    const prizes: any[] = battle.prizes || [];

    const playEntry = (e: any) => {
        const id = e.trackId || e.id;
        if (player.currentTrack?.id === id) { togglePlay(); return; }
        setTrack({ id, title: e.trackTitle, artist: e.username, cover: abs(e.coverUrl || e.avatarUrl), url: abs(e.audioUrl), entryRoute: e.trackRoute || `/battles/entry/${e.id}` },
            entries.map((x: any) => ({ id: x.trackId || x.id, title: x.trackTitle, artist: x.username, cover: abs(x.coverUrl || x.avatarUrl), url: abs(x.audioUrl), entryRoute: x.trackRoute || `/battles/entry/${x.id}` })));
    };

    return (
        <div style={{ color: TEXT, paddingBottom: 24 }}>
            {/* Hero */}
            <section style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden' }}>
                {battle.bannerUrl
                    ? <img src={abs(battle.bannerUrl)} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${PRIMARY}33, ${BG})` }} />}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, transparent 60%, rgba(0,0,0,0.2))` }} />
                <Link to="/battles" aria-label="Back" style={{ position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: '50%', ...glass, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PRIMARY, textDecoration: 'none' }}><ArrowLeft size={22} /></Link>
                <div style={{ position: 'absolute', top: 16, right: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: statusColor, color: '#fff', padding: '4px 12px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', boxShadow: `0 0 15px ${statusColor}66` }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} /> {statusLabel}
                    </span>
                    {countdown && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...glass, padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                            <Timer size={14} color={CYAN} /> {countdown.label}: {countdown.days > 0 ? `${countdown.days}d ` : ''}{countdown.hours}h {countdown.minutes}m
                        </span>
                    )}
                </div>
                <div style={{ position: 'absolute', bottom: 20, left: 16, right: 16 }}>
                    {battle.sponsor && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Powered by</span>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: '0.1em' }}>{battle.sponsor.name}</span>
                        </span>
                    )}
                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{battle.title}</h2>
                    {battle.subtitle && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}><Music2 size={14} /> {battle.subtitle}</p>}
                </div>
            </section>

            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 0' }}>
                {/* Description (rich HTML — render markup, fix YouTube iframe allow attr) */}
                {battle.description && (
                    <div
                        className="battle-description-prose"
                        dangerouslySetInnerHTML={{
                            __html: (battle.description || '').replace(
                                /<iframe(?![^>]*\ballow\b)([^>]*?)>/gi,
                                '<iframe$1 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share">'
                            ),
                        }}
                        style={{ fontSize: 14, lineHeight: 1.6, color: SUB, margin: '0 0 20px', overflowWrap: 'anywhere' }}
                    />
                )}

                {(ruleLines.length > 0 || sampleKit.length > 0) && (
                    <div style={{ ...glass, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                        {ruleLines.length > 0 && (
                            <>
                                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>The Rules</h3>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {ruleLines.map((t, i) => (
                                        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: SUB }}><span style={{ color: PRIMARY }}>•</span> {t}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                        {sampleKit.length > 0 && (
                            <div style={{ marginTop: ruleLines.length ? 16 : 0, paddingTop: ruleLines.length ? 16 : 0, borderTop: ruleLines.length ? `1px solid ${BORDER}` : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: CYAN }}>Sample Kit</h4>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sampleKit.length} Samples</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {sampleKit.map((s, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                <FileAudio size={20} color={PRIMARY} style={{ flexShrink: 0 }} />
                                                <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                                            </div>
                                            <button onClick={() => onDownload(s.url, s.name)} aria-label="Download" style={{ background: 'none', border: 'none', color: CYAN, cursor: 'pointer', display: 'flex', flexShrink: 0 }}><Download size={20} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Prizes */}
                {prizes.length > 0 && (
                    <>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 12px' }}><Award size={20} /> Battle Prizes</h3>
                        <div style={{ ...glass, borderRadius: 16, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {prizes.map((p, i) => (
                                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', borderTop: i ? `1px solid ${BORDER}` : 'none', paddingTop: i ? 16 : 0 }}>
                                    {p.imageUrl && <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: `1px solid ${BORDER}` }}><img src={abs(p.imageUrl)} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <Crown size={16} color={MEDAL[i] || PRIMARY} />
                                            <span style={{ fontSize: 14, fontWeight: 600 }}>{p.place || `${i + 1}`} Place</span>
                                        </div>
                                        {p.title && <p style={{ margin: 0, fontSize: 13, color: PRIMARY, fontWeight: 700 }}>{p.title}</p>}
                                        {p.description && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{p.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Submissions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Submissions ({entries.length})</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {entries.map((e, i) => {
                        const id = e.trackId || e.id;
                        const isCur = player.currentTrack?.id === id;
                        const playing = isCur && player.isPlaying;
                        const voted = !!myRanks[e.id];
                        const isWinner = isCompleted && battle.winnerEntryId === e.id;
                        const bars = waveHeights(e.id, 40);
                        return (
                            <div key={e.id} style={{ ...glass, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, ...(isWinner ? { border: `1px solid ${PRIMARY}`, boxShadow: '0 0 15px rgba(242,120,10,0.3)' } : {}) }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Link to={`/profile/${e.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textDecoration: 'none', color: TEXT }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#1F2937', flexShrink: 0 }}>
                                            {e.avatarUrl && <img src={abs(e.avatarUrl)} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{isWinner && <Crown size={16} color={PRIMARY} />}{e.trackTitle}</h4>
                                            <span style={{ fontSize: 12, color: SUB }}>{e.username}</span>
                                        </div>
                                    </Link>
                                    {isVotingPhase ? (
                                        <button onClick={() => onVote(e.id)} disabled={votingId === e.id} aria-label="Vote" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: voted ? PRIMARY : SUB, opacity: votingId === e.id ? 0.5 : 1 }}>
                                            <Flame size={22} fill={voted ? PRIMARY : 'none'} />
                                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{voted ? 'Voted' : 'Vote'}</span>
                                        </button>
                                    ) : isCompleted ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: PRIMARY, fontWeight: 700, fontSize: 16 }}><Flame size={18} fill={PRIMARY} /> {entryPoints(e)}</span>
                                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Points</span>
                                        </div>
                                    ) : null}
                                </div>
                                <div onClick={() => playEntry(e)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: '10px 14px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 15px rgba(242,120,10,0.4)' }}>
                                        {playing ? <Pause size={20} fill="#fff" color="#fff" /> : <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />}
                                    </span>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, height: 32, overflow: 'hidden' }}>
                                        {bars.map((h, bi) => <div key={bi} style={{ flex: 1, height: `${h}%`, borderRadius: 1, background: isCur ? PRIMARY : 'rgba(6,182,212,0.4)' }} />)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {entries.length === 0 && <p style={{ textAlign: 'center', color: SUB, padding: '20px 0' }}>No submissions yet.</p>}
                </div>
            </div>
        </div>
    );
};
