import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Swords, Trophy, Crown, Medal, Flame, Users,
    Zap, ChevronRight, Shield, Target, TrendingUp,
} from 'lucide-react';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { usePlayer } from '../components/PlayerProvider';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const TIERS = [
    { name: 'Unranked', min: 0,    color: '#7A8190', bg: 'rgba(122,129,144,0.12)' },
    { name: 'Bronze',   min: 1200, color: '#CD7F32', bg: 'rgba(205,127,50,0.12)'  },
    { name: 'Silver',   min: 1300, color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)' },
    { name: 'Gold',     min: 1450, color: '#FFD700', bg: 'rgba(255,215,0,0.12)'   },
    { name: 'Platinum', min: 1600, color: '#E5E4E2', bg: 'rgba(229,228,226,0.12)' },
    { name: 'Diamond',  min: 1750, color: '#5DD4FF', bg: 'rgba(93,212,255,0.12)'  },
    { name: 'Master',   min: 1900, color: '#A855F7', bg: 'rgba(168,85,247,0.12)'  },
    { name: 'Legend',   min: 2100, color: '#FF3D7F', bg: 'rgba(255,61,127,0.12)'  },
];

function tierFor(elo: number, played: number) {
    if (played === 0) return TIERS[0];
    return [...TIERS].reverse().find(t => elo >= t.min) || TIERS[0];
}

function pName(p: any, uid: string) {
    if (p?.anonymous) return 'Mystery Producer';
    return p?.displayName || p?.username || uid.slice(0, 8);
}

function fmtNum(n: number) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}

interface LeaderRow {
    rank: number;
    userId: string;
    elo: number;
    wins: number;
    losses: number;
    forfeits?: number;
    matchesPlayed: number;
    profile: { displayName?: string; username?: string; avatar?: string; anonymous?: boolean } | null;
    genreName: string | null;
}

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_LABEL  = ['1st', '2nd', '3rd'];

const HOW_IT_WORKS = [
    { icon: Target,    title: 'Challenge',  desc: 'Join the queue and get matched against a producer of similar Elo.' },
    { icon: Swords,    title: 'Produce',    desc: 'Both producers get the same sample pack. You have a set time window to make a beat.' },
    { icon: Users,     title: 'Vote',       desc: 'The community listens blind and votes. Win = Elo up. Lose = Elo down.' },
];

export const FrontpageAltFArena: React.FC = () => {
    const navigate  = useNavigate();
    const { player } = usePlayer();

    const [loading,  setLoading]  = useState(true);
    const [rows,     setRows]     = useState<LeaderRow[]>([]);
    const [enabled,  setEnabled]  = useState<boolean | null>(null);
    const [hovRow,   setHovRow]   = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            axios.get('/api/head-to-head/leaderboard').catch(() => ({ data: [] })),
            axios.get('/api/head-to-head/settings').catch(() => ({ data: null })),
        ]).then(([lRes, sRes]) => {
            setRows(lRes.data || []);
            setEnabled(sRes.data?.enabled ?? null);
            setLoading(false);
        });
    }, []);

    const totalMatches = Math.floor(rows.reduce((s, r) => s + r.matchesPlayed, 0) / 2);
    const top3         = rows.slice(0, 3);
    const rest         = rows.slice(3);
    const leader       = rows[0] || null;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Arena' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* ── HERO ── */}
                    <section style={{ position: 'relative', minHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {/* Background layers */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0d18 0%, #12102a 40%, #0f131d 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,61,127,0.12) 0%, transparent 70%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 40% at 80% 60%, rgba(168,85,247,0.08) 0%, transparent 60%)' }} />

                        {/* Large decorative swords */}
                        <div style={{ position: 'absolute', right: 80, top: 60, opacity: 0.04, transform: 'rotate(-20deg)' }}>
                            <Swords size={320} color="#fff" />
                        </div>

                        {/* Content */}
                        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1280, margin: '0 auto', padding: '0 32px', width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 120 }}>
                                {/* Status badge */}
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                    {enabled === null ? null : enabled ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,61,127,0.15)', border: '1px solid rgba(255,61,127,0.35)', color: '#FF3D7F', padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF3D7F', display: 'inline-block' }} />
                                            Arena Live
                                        </span>
                                    ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(154,163,178,0.12)', border: '1px solid rgba(154,163,178,0.25)', color: SUB, padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            Arena Offline
                                        </span>
                                    )}
                                </div>

                                <h1 style={{ margin: '0 0 12px', fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>
                                    Arena
                                </h1>
                                <p style={{ margin: 0, fontSize: 18, color: SUB, fontWeight: 500, maxWidth: 480 }}>
                                    1v1 producer battles. Same sample pack. Blind community vote. Your Elo on the line.
                                </p>
                            </div>

                            {/* Stats pill — absolutely pinned */}
                            <div style={{ position: 'absolute', bottom: 32, left: 32, right: 32 }}>
                                <div style={{ display: 'inline-flex', gap: 0, background: 'rgba(15,19,29,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                                    {[
                                        { label: 'Ranked Players', value: loading ? '—' : fmtNum(rows.length) },
                                        { label: 'Matches Played', value: loading ? '—' : fmtNum(totalMatches) },
                                        { label: 'Current Leader', value: loading ? '—' : leader ? pName(leader.profile, leader.userId) : '—' },
                                    ].map((s, i) => (
                                        <div key={s.label} style={{ padding: '12px 24px', borderRight: i < 2 ? `1px solid rgba(255,255,255,0.07)` : 'none', textAlign: 'center' }}>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em' }}>{s.value}</div>
                                            <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── BODY GRID ── */}
                    <div style={{ maxWidth: 1280, margin: '32px auto 0', padding: '0 32px 60px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 28, boxSizing: 'border-box' }}>

                        {/* ── LEFT: LEADERBOARD ── */}
                        <div>
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Trophy size={15} color="#FFD700" />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Leaderboard</span>
                                    {!loading && <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB }}>{rows.length} players</span>}
                                </div>

                                {loading ? (
                                    <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${PRIMARY}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                    </div>
                                ) : rows.length === 0 ? (
                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: SUB, fontSize: 13 }}>
                                        No ranked players yet — be the first.
                                    </div>
                                ) : (
                                    <>
                                        {/* Top 3 */}
                                        <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {top3.map((r, i) => {
                                                const mc  = MEDAL_COLORS[i];
                                                const t   = tierFor(r.elo, r.matchesPlayed);
                                                const wr  = r.matchesPlayed > 0 ? Math.round((r.wins / r.matchesPlayed) * 100) : 0;
                                                return (
                                                    <div key={r.userId} style={{
                                                        background: `linear-gradient(135deg, ${mc}12 0%, ${mc}05 100%)`,
                                                        border: `1px solid ${mc}30`,
                                                        borderRadius: 14,
                                                        padding: '14px 16px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        position: 'relative',
                                                    }}>
                                                        {/* Rank badge */}
                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${mc}22`, border: `1px solid ${mc}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            {i === 0 ? <Crown size={13} color={mc} /> : <Medal size={13} color={mc} />}
                                                        </div>
                                                        {/* Avatar */}
                                                        <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: `2px solid ${mc}55`, background: S_HIGH }}>
                                                            {r.profile?.avatar
                                                                ? <img src={r.profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: mc }}>
                                                                    {pName(r.profile, r.userId).slice(0, 2).toUpperCase()}
                                                                  </div>
                                                            }
                                                        </div>
                                                        {/* Name + tier */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {pName(r.profile, r.userId)}
                                                            </div>
                                                            <div style={{ fontSize: 10, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span style={{ color: t.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.name}</span>
                                                                <span style={{ color: SUB }}>{r.wins}W {r.losses}L</span>
                                                            </div>
                                                        </div>
                                                        {/* Elo */}
                                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                            <div style={{ fontSize: 16, fontWeight: 900, color: mc, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{r.elo}</div>
                                                            <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{wr}% WR</div>
                                                        </div>
                                                        {/* Position label */}
                                                        <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 9, fontWeight: 800, color: `${mc}88`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            {MEDAL_LABEL[i]}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Rest */}
                                        {rest.length > 0 && (
                                            <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
                                                {rest.map((r, i) => {
                                                    const t  = tierFor(r.elo, r.matchesPlayed);
                                                    const wr = r.matchesPlayed > 0 ? Math.round((r.wins / r.matchesPlayed) * 100) : 0;
                                                    const hov = hovRow === r.userId;
                                                    return (
                                                        <div key={r.userId}
                                                            onMouseEnter={() => setHovRow(r.userId)}
                                                            onMouseLeave={() => setHovRow(null)}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 10,
                                                                padding: '10px 20px',
                                                                borderBottom: i < rest.length - 1 ? `1px solid ${DIVIDER}` : 'none',
                                                                background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
                                                                transition: 'background 0.15s',
                                                            }}>
                                                            <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: SUB, textAlign: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{r.rank}</span>
                                                            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: `1.5px solid ${t.color}44`, background: S_HIGH }}>
                                                                {r.profile?.avatar
                                                                    ? <img src={r.profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: t.color }}>
                                                                        {pName(r.profile, r.userId).slice(0, 2).toUpperCase()}
                                                                      </div>
                                                                }
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {pName(r.profile, r.userId)}
                                                                </div>
                                                                <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{r.wins}W {r.losses}L · {wr}%</div>
                                                            </div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: '2px 6px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                                                                {t.name}
                                                            </span>
                                                            <span style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right', flexShrink: 0 }}>
                                                                {r.elo}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── RIGHT ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* How it works */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                {HOW_IT_WORKS.map((step, i) => {
                                    const Icon = step.icon;
                                    const accent = [TERTIARY, PRIMARY, SECONDARY][i];
                                    return (
                                        <div key={step.title} style={{ ...glass, borderRadius: 18, padding: '20px 20px 20px' }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}18`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                                <Icon size={20} color={accent} />
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
                                                <span style={{ color: `${accent}99`, marginRight: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Step {i + 1}</span>
                                                {step.title}
                                            </div>
                                            <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>{step.desc}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Enter Arena CTA */}
                            <div style={{
                                ...glass,
                                borderRadius: 20,
                                overflow: 'hidden',
                                background: `linear-gradient(135deg, rgba(255,61,127,0.12) 0%, rgba(168,85,247,0.08) 50%, rgba(93,212,255,0.06) 100%)`,
                                border: '1px solid rgba(255,61,127,0.2)',
                            }}>
                                <div style={{ padding: '32px 36px', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <Swords size={22} color="#FF3D7F" />
                                            <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>Ready to compete?</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 14, color: SUB, lineHeight: 1.6, maxWidth: 420 }}>
                                            Join the matchmaking queue and get paired with a producer at your level. Win matches to climb the Elo ladder and unlock higher tiers.
                                        </p>
                                        {enabled === false && (
                                            <p style={{ margin: '10px 0 0', fontSize: 12, color: TERTIARY }}>
                                                The arena is currently offline. Check back soon.
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                                        <button
                                            onClick={() => navigate('/head-to-head')}
                                            disabled={enabled === false}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '14px 28px', borderRadius: 14,
                                                background: enabled === false ? S_HIGH : 'linear-gradient(135deg, #FF3D7F, #A855F7)',
                                                border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                                                cursor: enabled === false ? 'not-allowed' : 'pointer',
                                                opacity: enabled === false ? 0.5 : 1,
                                                fontFamily: FONT,
                                            }}>
                                            <Swords size={18} />
                                            Enter Arena
                                            <ChevronRight size={16} />
                                        </button>
                                        <div style={{ fontSize: 11, color: SUB, textAlign: 'center' }}>
                                            Login required to compete
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tier progression */}
                            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={15} color={PRIMARY} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Tier Progression</span>
                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB }}>Starting Elo: 1200</span>
                                </div>
                                <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                                    {TIERS.slice(1).map(t => (
                                        <div key={t.name} style={{ background: t.bg, border: `1px solid ${t.color}30`, borderRadius: 12, padding: '12px 14px' }}>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: t.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t.name}</div>
                                            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{t.min}</div>
                                            <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>Elo required</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </main>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
