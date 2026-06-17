/**
 * Test Artist Profile — Alt F (Stitch "social/community focus" desktop layout).
 * Hidden route: /preview/alt_f_artist — not linked from any nav.
 * Reuses the shared AltSidebar; reference user = Thomas. Live data, CSP-safe.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import {
    ChevronRight, Search, Upload, MessageCircle, Bell, Settings, BadgeCheck, Swords, MapPin,
    UserPlus, Mail, Play, MoreVertical, Heart, Globe, Music, Youtube, Instagram, Headphones,
} from 'lucide-react';

const REF_USER = 'thomas';

const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
const glass: React.CSSProperties = { background: 'rgba(23,27,38,0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)' };

// deterministic decorative waveform
function bars(seed: string, n = 60) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }
function parseGear(arr: any[]): string[] {
    return (arr || []).map((g) => { try { const o = typeof g === 'string' ? JSON.parse(g) : g; return o?.name || (typeof g === 'string' ? g : ''); } catch { return typeof g === 'string' ? g : ''; } }).filter(Boolean);
}

export const FrontpageAltFArtist: React.FC = () => {
    const { player, setTrack, togglePlay } = usePlayer();
    const navigate = useNavigate();
    const [p, setP] = useState<any>(null);

    useEffect(() => {
        axios.get(`/api/musician/profile/${REF_USER}`).then(r => setP(r.data)).catch(() => {});
    }, []);

    const tracks: any[] = p?.tracks || [];
    const featured = p?.featuredTrack || [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))[0] || null;
    const gear = [p?.primaryDAW, ...parseGear(p?.vsts), ...parseGear(p?.hardware)].filter(Boolean);
    const joined = p?.createdAt ? new Date(p.createdAt).getFullYear() : '—';
    const rating = p?.h2hRating;

    const mk = (t: any) => ({ id: t.id, title: t.title, artist: p?.displayName || REF_USER, cover: t.coverUrl, url: t.url, profile: { username: REF_USER, displayName: p?.displayName, avatar: p?.avatar } });
    const open = (t: any) => { if (t?.url) setTrack(mk(t), tracks.map(mk)); else navigate(`/profile/${REF_USER}/${t.slug || t.id}`); };
    const playingId = player.currentTrack?.id;

    const socialIcon: Record<string, any> = { website: Globe, spotify: Music, soundcloud: Music, youtube: Youtube, instagram: Instagram, discord: Headphones };

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Artists" />

            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Top app bar */}
                <header style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB }}>
                            <Link to="/artists" style={{ color: SUB, textDecoration: 'none' }}>Artists</Link>
                            <ChevronRight size={16} />
                            <span style={{ color: TEXT }}>{p?.displayName || REF_USER}</span>
                        </div>
                        <div style={{ position: 'relative', maxWidth: 360, flex: 1 }}>
                            <Search size={18} color={SUB} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                            <input placeholder="Search producers, tracks…" style={{ width: '100%', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9999, padding: '8px 16px 8px 38px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Link to="/my-tracks" style={{ display: 'flex', alignItems: 'center', gap: 8, background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 9999, textDecoration: 'none' }}><Upload size={18} /> Upload</Link>
                        <MessageCircle size={20} color={SUB} /><Bell size={20} color={SUB} /><Settings size={20} color={SUB} />
                    </div>
                </header>

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {/* Hero */}
                    <div style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                        {p?.bannerUrl && <img src={p.bannerUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
                        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(15,19,29,0.4), transparent)` }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, minWidth: 0 }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <div style={{ width: 176, height: 176, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${BG}`, background: S_HIGH, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                                        {p?.avatar && <img src={p.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    </div>
                                    <span style={{ position: 'absolute', bottom: -6, right: -6, display: 'flex', alignItems: 'center', gap: 4, background: PRIMARY, color: '#fff', padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, border: `2px solid ${BG}` }}><BadgeCheck size={14} /> Pro</span>
                                </div>
                                <div style={{ minWidth: 0, paddingBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                                        <h2 style={{ margin: 0, fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{p?.displayName || REF_USER}</h2>
                                        {p?.showH2HRank && rating != null && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: S_HIGH, color: SUB, padding: '6px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${BORDER}` }}><Swords size={16} color={TERTIARY} /> Arena {Math.round(rating)}</span>
                                        )}
                                    </div>
                                    {p?.location && <p style={{ margin: '0 0 16px', color: PRIMARY, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={18} /> {p.location}</p>}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: PRIMARY, color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', boxShadow: '0 0 20px rgba(242,120,10,0.15)' }}><UserPlus size={20} /> Follow</button>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: SECONDARY, border: `1px solid ${SECONDARY}`, padding: '10px 28px', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}><Mail size={20} /> Message</button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ ...glass, display: 'flex', textAlign: 'center', borderRadius: 12, padding: 16 }}>
                                {[[fmtNum(p?.totalPlays), 'Plays'], [String(tracks.length), 'Tracks'], [String(joined), 'Joined']].map(([n, l], i) => (
                                    <div key={l} style={{ padding: '0 20px', borderLeft: i ? `1px solid ${BORDER}` : 'none' }}>
                                        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff' }}>{n}</p>
                                        <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Body: middle + right */}
                    <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', boxSizing: 'border-box', padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Featured */}
                            {featured && (
                                <div>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#fff' }}>Featured</h3>
                                    <div style={{ ...glass, borderRadius: 12, padding: 16, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div onClick={() => open(featured)} style={{ width: 176, height: 176, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: S_HIGH, cursor: 'pointer' }}>
                                            {featured.coverUrl ? <img src={featured.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={48} color={SUB} /></div>}
                                            <span style={{ position: 'absolute', inset: 0, margin: 'auto', width: 64, height: 64, borderRadius: '50%', background: 'rgba(242,120,10,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={32} fill="#fff" color="#fff" style={{ marginLeft: 3 }} /></span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 200 }}>
                                            <span style={{ display: 'inline-block', background: 'rgba(255,103,121,0.2)', color: TERTIARY, padding: '2px 8px', borderRadius: 4, fontSize: 12, marginBottom: 8 }}>Latest Release</span>
                                            <h4 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featured.title}</h4>
                                            <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB }}>{p?.displayName} {p?.genres?.[0] ? `• ${p.genres[0].genre?.name || p.genres[0].name}` : ''}</p>
                                            <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 2, marginTop: 16 }}>
                                                {bars(featured.id || featured.title).map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 9999, background: i < 18 ? SECONDARY : 'rgba(76,215,246,0.4)' }} />)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent tracks */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>Recent Tracks</h3>
                                    <Link to={`/profile/${REF_USER}`} style={{ color: PRIMARY, fontSize: 12, textDecoration: 'none' }}>View All</Link>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {tracks.length === 0 && <p style={{ color: SUB, fontSize: 14 }}>No tracks yet.</p>}
                                    {tracks.map((t) => {
                                        const on = playingId === t.id;
                                        return (
                                            <div key={t.id} onClick={() => open(t)} style={{ ...glass, borderRadius: 6, padding: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {t.coverUrl ? <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Play size={16} fill={on ? PRIMARY : SUB} color={on ? PRIMARY : SUB} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: on ? PRIMARY : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</h4>
                                                </div>
                                                <div style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                                    {(t.bpm || t.duration) && <span style={{ display: 'none' }} />}
                                                    {t.bpm ? <span>{t.bpm} BPM</span> : null}
                                                    {t.duration ? <span>{fmtDur(t.duration)}</span> : null}
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={14} /> {fmtNum(t.playCount)}</span>
                                                    {typeof t.likeCount === 'number' && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={14} /> {fmtNum(t.likeCount)}</span>}
                                                    <MoreVertical size={18} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right metadata */}
                        <aside style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ ...glass, borderRadius: 12, padding: 24 }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#fff' }}>About</h3>
                                <p style={{ margin: 0, fontSize: 14, color: SUB, lineHeight: 1.6 }}>{p?.bio || 'No bio yet.'}</p>
                                {(p?.socials || []).length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
                                        {(p.socials || []).map((s: any, i: number) => {
                                            const Icon = socialIcon[s.platform] || Globe;
                                            return <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, color: SECONDARY, fontSize: 14, textDecoration: 'none', textTransform: 'capitalize' }}><Icon size={20} /> {s.platform}</a>;
                                        })}
                                    </div>
                                )}
                            </div>
                            {p?.showGearSection && gear.length > 0 && (
                                <div style={{ ...glass, borderRadius: 12, padding: 24 }}>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#fff' }}>Studio Gear</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {gear.map((g, i) => <span key={i} style={{ background: S_HIGH, color: TEXT, padding: '8px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${BORDER}`, textAlign: 'center' }}>{g}</span>)}
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                    {!p && <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>}
                </div>
            </main>
        </div>
    );
};
