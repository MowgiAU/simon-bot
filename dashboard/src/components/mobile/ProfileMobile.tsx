/**
 * Mobile Artist Profile view — the Stitch mockup design fed by live profile data.
 * Rendered only on mobile inside DiscoveryLayout; desktop keeps MusicianProfilePublic.
 * Track rows link to the track page (which itself renders the mobile Now-Playing view).
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Music, Headphones, UserPlus, MessageCircle, Star, Play, ListMusic } from 'lucide-react';
import { SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, BG } from '../../pages/MobilePreviewChrome';

const glass: React.CSSProperties = { background: SURFACE, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${BORDER}` };

export const ProfileMobile: React.FC<{ identifier: string }> = ({ identifier }) => {
    const [p, setP] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let on = true;
        setLoading(true);
        axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true })
            .then(r => { if (on) setP(r.data); })
            .catch(() => {})
            .finally(() => { if (on) setLoading(false); });
        return () => { on = false; };
    }, [identifier]);

    if (loading) return <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: SUB }}>Loading…</div>;
    if (!p) return <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: SUB }}>Profile not found</div>;

    const username = p.username || identifier;
    const tracks: any[] = (p.tracks || []).filter((t: any) => t);
    const withCover = tracks.filter(t => t.coverUrl);
    const banner = p.bannerUrl || withCover[0]?.coverUrl || null;
    const featured = [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))[0] || null;
    const joined = p.createdAt ? String(new Date(p.createdAt).getFullYear()) : '—';
    const trackLink = (t: any) => `/profile/${username}/${t.slug || t.id}`;

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '4px 16px 24px', color: TEXT }}>
            {/* Banner + avatar */}
            <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                {banner
                    ? <img src={banner} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1F2937,#0B0F19)' }} />}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, transparent)` }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -56 }}>
                <div style={{ width: 112, height: 112, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${BG}`, position: 'relative', zIndex: 1, background: '#1F2937' }}>
                    {p.avatar && <img src={p.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <h2 style={{ margin: '12px 0 6px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.displayName || username}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F43F5E', color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999 }}>
                        <Music size={14} /> Producer
                    </span>
                    {p.genres?.[0] && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: SUB, fontSize: 13 }}><Headphones size={14} color={CYAN} /> {p.genres[0].genre?.name || p.genres[0].name}</span>}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px rgba(242,120,10,0.15)' }}>
                    <UserPlus size={20} /> Follow
                </button>
                <Link to={`/messages?to=${p.userId || ''}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...glass, color: TEXT, borderRadius: 8, padding: '12px 0', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                    <MessageCircle size={20} /> Message
                </Link>
            </div>

            {/* Stats */}
            <div style={{ ...glass, borderRadius: 12, padding: 24, marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
                {[[String(p.totalPlays ?? 0), 'Plays'], [String(tracks.length), 'Tracks'], [joined, 'Joined']].map(([n, l], i) => (
                    <div key={l} style={{ borderLeft: i ? `1px solid ${BORDER}` : 'none' }}>
                        <div style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
                        <div style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{l}</div>
                    </div>
                ))}
            </div>

            {/* Bio */}
            {p.bio && (
                <div style={{ ...glass, borderRadius: 12, padding: 24, marginTop: 16 }}>
                    <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic', color: SUB, borderLeft: `2px solid ${PRIMARY}`, paddingLeft: 16 }}>"{p.bio}"</p>
                </div>
            )}

            {/* Featured Track */}
            {featured && (
                <>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, margin: '24px 0 12px' }}><Star size={20} color={CYAN} /> Featured Track</h3>
                    <Link to={trackLink(featured)} style={{ ...glass, borderRadius: 12, overflow: 'hidden', display: 'block', textDecoration: 'none', color: TEXT }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#1F2937' }}>
                            {featured.coverUrl && <img src={featured.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                                <span style={{ width: 64, height: 64, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(242,120,10,0.25)' }}>
                                    <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                                </span>
                            </div>
                        </div>
                        <div style={{ padding: 16 }}>
                            <div style={{ fontSize: 16, fontWeight: 600 }}>{featured.title}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13, color: SUB }}>
                                <span>Top Track</span><span>{featured.playCount ?? 0} plays</span>
                            </div>
                        </div>
                    </Link>
                </>
            )}

            {/* Recent Tracks */}
            {tracks.length > 0 && (
                <>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, margin: '24px 0 12px' }}><ListMusic size={20} color={PRIMARY} /> Tracks</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tracks.map((t, i) => (
                            <Link key={t.id || i} to={trackLink(t)} style={{ ...glass, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', color: TEXT }}>
                                <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1F2937' }}>
                                    {t.coverUrl && <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: SUB, marginTop: 2 }}><Play size={12} /> {t.playCount ?? 0} plays</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
