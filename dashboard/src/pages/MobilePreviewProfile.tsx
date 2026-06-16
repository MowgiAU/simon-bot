/**
 * Mobile redesign preview — Artist Profile (Stitch mockup rebuilt as CSP-safe React).
 * Hidden route: /preview/mobile-profile — not linked from any nav.
 * Live data from /api/musician/profile/elusive, with real fallback.
 */
import React from 'react';
import axios from 'axios';
import { ArrowLeft, MoreVertical, Music, Headphones, UserPlus, MessageCircle, Star, Play, ListMusic } from 'lucide-react';
import { BG, SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, FONT, MobileBottomNav, MiniPlayer, useLive } from './MobilePreviewChrome';

const TR = 'https://cdn.fujistud.io/tracks';
const AVATAR = 'https://cdn.fujistud.io/profiles/cmpopbjg200agqn2qos5wpo92/avatar/avatar-1779924885773-735817877.webp';
const NOOS = `${TR}/cmpor2qs200ppqn2q41rs4kae/artwork/artwork-1779927833913-718524149.webp`;
const DISTANT = `${TR}/cmq79sbza00ra1422mi4m2ihj/artwork/artwork-1781047652298-480549523.webp`;

type Tr = { title: string; plays: number; cover: string };
type Data = { name: string; avatar: string; banner: string; bio: string; plays: number; joined: string; tracks: Tr[]; featured: Tr | null };

const FALLBACK: Data = {
    name: 'ELUSiVE', avatar: AVATAR, banner: NOOS, bio: 'Hobbyist Music Producer', plays: 134, joined: '2026',
    tracks: [{ title: 'Distant Memories', plays: 39, cover: DISTANT }, { title: 'Noospheric Entry', plays: 103, cover: NOOS }],
    featured: { title: 'Noospheric Entry', plays: 103, cover: NOOS },
};

const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };

export const MobilePreviewProfile: React.FC = () => {
    const p = useLive<Data>(async () => {
        const r = await axios.get('/api/musician/profile/elusive');
        const prof = r.data?.profile || r.data;
        if (!prof?.displayName) return null;
        const tracks: Tr[] = (r.data?.tracks || prof.tracks || [])
            .filter((t: any) => t.coverUrl)
            .map((t: any) => ({ title: t.title, plays: t.playCount ?? 0, cover: t.coverUrl }));
        const featured = [...tracks].sort((a, b) => b.plays - a.plays)[0] || null;
        return {
            name: prof.displayName,
            avatar: prof.avatar || AVATAR,
            banner: prof.bannerUrl || tracks[0]?.cover || NOOS,
            bio: prof.bio || '',
            plays: prof.totalPlays ?? 0,
            joined: prof.createdAt ? String(new Date(prof.createdAt).getFullYear()) : '',
            tracks,
            featured,
        };
    }, FALLBACK);

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: FONT }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 30, ...glass, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <ArrowLeft size={24} color={SUB} />
                <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: PRIMARY }}>{p.name}</span>
                <MoreVertical size={24} color={SUB} />
            </header>

            <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 160px' }}>
                <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}`, marginTop: 12 }}>
                    <img src={p.banner} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, transparent)` }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -56 }}>
                    <div style={{ width: 112, height: 112, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${BG}`, position: 'relative', zIndex: 1 }}>
                        <img src={p.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <h2 style={{ margin: '12px 0 6px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F43F5E', color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999 }}>
                            <Music size={14} /> Producer
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: SUB, fontSize: 13 }}>
                            <Headphones size={14} color={CYAN} /> Hobbyist
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px rgba(242,120,10,0.15)' }}>
                        <UserPlus size={20} /> Follow
                    </button>
                    <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...glass, color: TEXT, borderRadius: 8, padding: '12px 0', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                        <MessageCircle size={20} /> Message
                    </button>
                </div>

                <div style={{ ...glass, borderRadius: 12, padding: 24, marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
                    {[[String(p.plays), 'Plays'], [String(p.tracks.length), 'Tracks'], [p.joined || '—', 'Joined']].map(([n, l], i) => (
                        <div key={l} style={{ borderLeft: i ? `1px solid ${BORDER}` : 'none' }}>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
                            <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{l}</div>
                        </div>
                    ))}
                </div>

                {p.bio && (
                    <div style={{ ...glass, borderRadius: 12, padding: 24, marginTop: 16 }}>
                        <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic', color: SUB, borderLeft: `2px solid ${PRIMARY}`, paddingLeft: 16 }}>"{p.bio}"</p>
                    </div>
                )}

                {p.featured && (
                    <>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, margin: '24px 0 12px' }}>
                            <Star size={20} color={CYAN} /> Featured Track
                        </h3>
                        <div style={{ ...glass, borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
                                <img src={p.featured.cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                                    <span style={{ width: 64, height: 64, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(242,120,10,0.25)' }}>
                                        <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                                    </span>
                                </div>
                            </div>
                            <div style={{ padding: 16 }}>
                                <div style={{ fontSize: 16, fontWeight: 600 }}>{p.featured.title}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13, color: SUB }}>
                                    <span>Top Track</span><span>{p.featured.plays} plays</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, margin: '24px 0 12px' }}>
                    <ListMusic size={20} color={PRIMARY} /> Recent Tracks
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {p.tracks.map((t, i) => (
                        <div key={t.title + i} style={{ ...glass, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                            <img src={t.cover} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: SUB, marginTop: 2 }}>
                                    <Play size={12} /> {t.plays} plays
                                </div>
                            </div>
                            <MoreVertical size={20} color={SUB} />
                        </div>
                    ))}
                </div>
            </div>

            <MiniPlayer title={p.featured?.title || p.name} artist={p.name} cover={p.featured?.cover || p.banner} />
            <MobileBottomNav active="profile" />
        </div>
    );
};
