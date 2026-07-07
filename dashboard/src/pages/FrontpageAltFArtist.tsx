/**
 * Test Artist Profile — Alt F (Stitch "social/community focus" desktop layout).
 * Hidden route: /preview/alt_f_artist — not linked from any nav.
 * Reuses the shared AltSidebar; reference user = Thomas. Live data, CSP-safe.
 * Carries over profile themes (accent colour, card background, styled name/avatar).
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { useAuth } from '../components/AuthProvider';
import { useChat } from '../components/ChatProvider';
import { StyledUsername, StyledAvatar } from '../components/StyledUsername';
import { CommentSection } from '../components/CommentSection';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import {
    BadgeCheck, Swords, MapPin, Mail,
    UserPlus, UserCheck, MessageCircle, Play, MoreVertical, Globe, Music, Youtube, Instagram, Headphones, Repeat2, Trophy, Edit3,
} from 'lucide-react';

const REF_USER = 'thomas';

const fmtDur = (s?: number) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };
function bars(seed: string, n = 60) { let h = 5381; for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0; return Array.from({ length: n }, () => { h = (h * 1664525 + 1013904223) >>> 0; return 10 + (h % 90); }); }
function parseGear(a: any[]): string[] { return (a || []).map((g) => { try { const o = typeof g === 'string' ? JSON.parse(g) : g; return o?.name || (typeof g === 'string' ? g : ''); } catch { return typeof g === 'string' ? g : ''; } }).filter(Boolean); }
const socialIcon: Record<string, any> = { website: Globe, spotify: Music, soundcloud: Music, youtube: Youtube, instagram: Instagram, discord: Headphones };

export const FrontpageAltFArtist: React.FC = () => {
    const { player, setTrack } = usePlayer();
    const navigate = useNavigate();
    const { user, mutualAdminGuilds } = useAuth();
    const { dropdownOpen: messengerOpen, setDropdownOpen: setMessengerOpen, unreadTotal: unreadMsgCount, startConversation } = useChat();
    const isAdmin = !!(mutualAdminGuilds && mutualAdminGuilds.length > 0);
    const bp = useAltBreakpoint();
    const isMobile = bp === 'xs';

    const [p, setP] = useState<any>(null);
    const [friends, setFriends] = useState<any[]>([]);
    const [featuredFriendIds, setFeaturedFriendIds] = useState<string[]>([]);
    const [battles, setBattles] = useState<any[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [startingChat, setStartingChat] = useState(false);

    useEffect(() => {
        let on = true;
        axios.get(`/api/musician/profile/${REF_USER}`).then(async r => {
            if (!on) return;
            const prof = r.data; setP(prof);
            const id = prof.id; const uid = prof.userId;
            axios.get(`/api/artists/${id}/friends`).then(f => { if (on) { setFriends(f.data?.friends || []); setFeaturedFriendIds(f.data?.featuredFriendIds || prof.featuredFriendIds || []); } }).catch(() => {});
            axios.get(`/api/beat-battle/user/${uid}/entries`).then(b => { if (on) setBattles(Array.isArray(b.data) ? b.data : (b.data?.entries || [])); }).catch(() => {});
            axios.get(`/api/artists/${id}/follower-count`).then(res => { if (on) setFollowerCount(res.data?.count ?? 0); }).catch(() => {});
            axios.get(`/api/artists/${id}/follow`, { withCredentials: true }).then(res => { if (on) setIsFollowing(res.data?.following ?? false); }).catch(() => {});
            axios.get(`/api/artists/${id}/following-count`).then(res => { if (on) setFollowingCount(res.data?.count ?? 0); }).catch(() => {});
        }).catch(() => {});
        return () => { on = false; };
    }, []);

    const toggleFollow = async () => {
        if (!p) return;
        try {
            const { data } = await axios.post(`/api/artists/${p.id}/follow`, {}, { withCredentials: true });
            setIsFollowing(data.following);
            setFollowerCount(prev => data.following ? prev + 1 : prev - 1);
        } catch { /* not logged in */ }
    };

    const startMessage = async () => {
        if (!p?.userId || startingChat) return;
        setStartingChat(true);
        try {
            await startConversation([p.userId]);
            setMessengerOpen(true);
        } catch { /* ignore */ } finally {
            setStartingChat(false);
        }
    };

    // ── Theme carry-over ──
    const accent = p?.accentColor || PRIMARY;
    const pageBg = p?.cardBgColor ? `color-mix(in srgb, ${p.cardBgColor} 55%, ${BG})` : BG;
    const DIVIDER = 'rgba(87,66,54,0.25)';
    const glass: React.CSSProperties = { background: p?.cardBgColor ? `color-mix(in srgb, ${p.cardBgColor} 70%, #11141d)` : 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' };

    // Only show public tracks
    const publicTracks: any[] = (p?.tracks || []).filter((t: any) => t.isPublic !== false);
    const reposts: any[] = p?.reposts || [];
    const featured = p?.featuredTrack || [...publicTracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))[0] || null;
    const gear = [p?.primaryDAW, ...parseGear(p?.vsts), ...parseGear(p?.hardware)].filter(Boolean);
    const joined = p?.createdAt ? new Date(p.createdAt).getFullYear() : '—';
    const heroBg = p?.bannerUrl || featured?.coverUrl || [...publicTracks].find(t => t.coverUrl)?.coverUrl || p?.avatar || null;
    const battleWins = battles.filter((b: any) => b.won || b.placement === 1 || b.rank === 1).length;
    const topFriends = featuredFriendIds.length
        ? featuredFriendIds.map(fid => friends.find((f: any) => f.userId === fid || f.profileId === fid || f.discordId === fid)).filter(Boolean).slice(0, 8)
        : friends.slice(0, 8);
    const arena = p?.h2hRating;

    // Own profile: user is viewing their own profile
    const isOwnProfile = !!user && (
        user.username === REF_USER ||
        (user as any).profileUsername === REF_USER ||
        (!!p && p.userId === user.id)
    );

    const mk = (t: any) => ({ id: t.id, title: t.title, artist: t.artist || p?.displayName || REF_USER, cover: t.coverUrl, url: t.url, profile: { username: REF_USER, displayName: p?.displayName, avatar: p?.avatar } });
    const open = (t: any) => { if (t?.url) setTrack(mk(t), publicTracks.map(mk)); else navigate(`/profile/${REF_USER}/${t.slug || t.id}`); };
    const playingId = player.currentTrack?.id;

    const sectionH: React.CSSProperties = { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#fff' };

    const TrackRow: React.FC<{ t: any; repost?: boolean }> = ({ t, repost }) => {
        const on = playingId === t.id;
        return (
            <div onClick={() => open(t)} style={{ ...glass, borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
                onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ width: 36, height: 36, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.coverUrl ? <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Play size={16} fill={on ? accent : SUB} color={on ? accent : SUB} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: on ? accent : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</h4>
                    {repost && <span style={{ fontSize: 11, color: SUB, display: 'flex', alignItems: 'center', gap: 4 }}><Repeat2 size={12} /> {t.artist || 'reposted'}</span>}
                </div>
                <div style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    {t.bpm ? <span>{t.bpm} BPM</span> : null}
                    {t.duration ? <span>{fmtDur(t.duration)}</span> : null}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={14} /> {fmtNum(t.playCount)}</span>
                    <MoreVertical size={18} />
                </div>
            </div>
        );
    };

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: pageBg, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Artists" />

            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader
                    breadcrumb={[
                        { label: 'Artists', to: '/artists' },
                        { label: p?.displayName || REF_USER },
                    ]}
                    accent={accent}
                />

                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    {/* Hero */}
                    <div style={{ position: 'relative', width: '100%', height: isMobile ? 200 : 400, overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                        {heroBg && <img src={heroBg} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />}
                        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${pageBg}, rgba(15,19,29,0.4), transparent)` }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 16px 16px' : '0 32px 32px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end', justifyContent: 'space-between', gap: isMobile ? 12 : 24, flexWrap: 'wrap', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: isMobile ? 12 : 24, minWidth: 0 }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <StyledAvatar userId={p?.userId}>
                                        <div style={{ width: isMobile ? 76 : 176, height: isMobile ? 76 : 176, borderRadius: '50%', overflow: 'hidden', border: `${isMobile ? 3 : 4}px solid ${BG}`, background: S_HIGH }}>
                                            {p?.avatar && <img src={p.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        </div>
                                    </StyledAvatar>
                                    <span style={{ position: 'absolute', bottom: isMobile ? -4 : -6, right: isMobile ? -4 : -6, display: 'flex', alignItems: 'center', gap: 4, background: accent, color: '#fff', padding: isMobile ? '2px 7px' : '4px 10px', borderRadius: 9999, fontSize: isMobile ? 9 : 12, fontWeight: 700, border: `2px solid ${BG}` }}><BadgeCheck size={isMobile ? 10 : 14} /> Pro</span>
                                </div>
                                <div style={{ minWidth: 0, paddingBottom: isMobile ? 0 : 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                        <StyledUsername userId={p?.userId} style={{ fontSize: isMobile ? 20 : 48, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{p?.displayName || REF_USER}</StyledUsername>
                                        {p?.showH2HRank && arena && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: S_HIGH, color: SUB, padding: isMobile ? '3px 8px' : '6px 12px', borderRadius: 8, fontSize: isMobile ? 10 : 12, border: `1px solid ${BORDER}` }}><Swords size={isMobile ? 12 : 16} color={TERTIARY} /> Arena {Math.round(arena.elo)}</span>
                                        )}
                                    </div>
                                    {/* Genre tags */}
                                    {(p?.genres || []).length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isMobile ? 6 : 10 }}>
                                            {(p.genres as any[]).slice(0, isMobile ? 3 : 4).map((g: any, i: number) => (
                                                <span key={i} style={{ background: i === 0 ? `${accent}33` : 'rgba(255,255,255,0.08)', color: i === 0 ? accent : SUB, padding: isMobile ? '2px 8px' : '3px 10px', borderRadius: 9999, fontSize: isMobile ? 10 : 11, fontWeight: 600, border: i === 0 ? `1px solid ${accent}55` : `1px solid ${BORDER}` }}>
                                                    {g.genre?.name || g.name || g}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {p?.location && <p style={{ margin: '0 0 10px', color: SUB, fontSize: isMobile ? 12 : 14, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={isMobile ? 13 : 16} /> {p.location}</p>}
                                    {!isMobile && (
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {!isOwnProfile && (
                                            <button onClick={toggleFollow} style={{ display: 'flex', alignItems: 'center', gap: 8, background: isFollowing ? 'transparent' : accent, color: isFollowing ? accent : '#fff', border: isFollowing ? `1px solid ${accent}` : 'none', padding: '10px 28px', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'all 0.2s' }}>
                                                {isFollowing ? <><UserCheck size={20} /> Following</> : <><UserPlus size={20} /> Follow</>}
                                            </button>
                                        )}
                                        {!isOwnProfile && user && (
                                            <button onClick={startMessage} disabled={startingChat} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: SECONDARY, border: `1px solid ${SECONDARY}`, padding: '10px 28px', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: startingChat ? 'default' : 'pointer', opacity: startingChat ? 0.6 : 1, transition: 'all 0.2s' }}>
                                                <Mail size={20} /> Message
                                            </button>
                                        )}
                                        {(isOwnProfile || isAdmin) && (
                                            <button
                                                onClick={() => isOwnProfile ? navigate('/profile/edit') : navigate(`/profile/edit?adminTarget=${p?.userId}`)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.1)' : `${accent}1A`, color: isAdmin && !isOwnProfile ? '#ff9800' : accent, border: `1px solid ${isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.5)' : `${accent}4D`}`, padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}
                                            >
                                                <Edit3 size={18} /> {isAdmin && !isOwnProfile ? 'Edit Profile (Admin)' : 'Edit Profile'}
                                            </button>
                                        )}
                                    </div>
                                    )}
                                </div>
                            </div>
                            {!isMobile && p?.showStatsBar !== false && (
                                <div style={{ ...glass, display: 'flex', textAlign: 'center', borderRadius: 12, padding: 16 }}>
                                    {[[fmtNum(followerCount), 'Followers'], [fmtNum(p?.totalPlays), 'Plays']].map(([n, l], i) => (
                                        <div key={l} style={{ padding: '0 20px', borderLeft: i ? `1px solid ${BORDER}` : 'none' }}>
                                            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff' }}>{n}</p>
                                            <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>
                    </div>

                    {/* Mobile: compact stats + action buttons (hidden from the hero above) */}
                    {isMobile && (
                        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {p?.showStatsBar !== false && (
                                <div style={{ ...glass, display: 'flex', textAlign: 'center', borderRadius: 12, padding: 10 }}>
                                    {[[fmtNum(followerCount), 'Followers'], [fmtNum(p?.totalPlays), 'Plays']].map(([n, l], i) => (
                                        <div key={l} style={{ flex: 1, padding: '0 10px', borderLeft: i ? `1px solid ${BORDER}` : 'none' }}>
                                            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>{n}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {!isOwnProfile && (
                                    <button onClick={toggleFollow} style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: isFollowing ? 'transparent' : accent, color: isFollowing ? accent : '#fff', border: isFollowing ? `1px solid ${accent}` : 'none', padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                                        {isFollowing ? <><UserCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
                                    </button>
                                )}
                                {!isOwnProfile && user && (
                                    <button onClick={startMessage} disabled={startingChat} style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', color: SECONDARY, border: `1px solid ${SECONDARY}`, padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: startingChat ? 'default' : 'pointer', opacity: startingChat ? 0.6 : 1 }}>
                                        <Mail size={15} /> Message
                                    </button>
                                )}
                                {(isOwnProfile || isAdmin) && (
                                    <button
                                        onClick={() => isOwnProfile ? navigate('/profile/edit') : navigate(`/profile/edit?adminTarget=${p?.userId}`)}
                                        style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.1)' : `${accent}1A`, color: isAdmin && !isOwnProfile ? '#ff9800' : accent, border: `1px solid ${isAdmin && !isOwnProfile ? 'rgba(255,152,0,0.5)' : `${accent}4D`}`, padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                                    >
                                        <Edit3 size={14} /> {isAdmin && !isOwnProfile ? 'Edit (Admin)' : 'Edit Profile'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Body */}
                    <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', boxSizing: 'border-box', padding: isMobile ? '16px 16px 24px' : '24px 32px 40px', display: isMobile ? 'flex' : 'grid', flexDirection: isMobile ? 'column' : undefined, gridTemplateColumns: isMobile ? undefined : '280px 1fr', gap: isMobile ? 24 : 24, alignItems: 'flex-start' }}>
                        {/* Left column: About, Friends, Gear */}
                        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, width: isMobile ? '100%' : undefined, boxSizing: 'border-box' }}>
                            <section>
                                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>About</h3>
                                    </div>
                                    <div style={{ padding: '16px 20px' }}>
                                        <p style={{ margin: 0, fontSize: 14, color: SUB, lineHeight: 1.6 }}>{p?.bio || 'No bio yet.'}</p>
                                        {p?.showSocialLinks !== false && (p?.socials || []).length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                                                {(p.socials || []).map((s: any, i: number) => { const Icon = socialIcon[s.platform] || Globe; return <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, color: SECONDARY, fontSize: 14, textDecoration: 'none', textTransform: 'capitalize' }}><Icon size={20} /> {s.platform}</a>; })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {p?.showFeaturedFriends !== false && topFriends.length > 0 && (
                                <section>
                                    <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Top Friends</h3>
                                        </div>
                                        <div style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                                                {topFriends.map((f: any) => (
                                                    <Link key={f.profileId || f.userId} to={`/profile/${f.username}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', minWidth: 0 }}>
                                                        <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: `1px solid ${BORDER}` }}>{f.avatar && <img src={f.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                                                        <span style={{ fontSize: 11, color: SUB, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.displayName || f.username}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {p?.showGearSection && gear.length > 0 && (
                                <section>
                                    <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DIVIDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Studio Gear</h3>
                                        </div>
                                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {gear.map((g, i) => <span key={i} style={{ background: S_HIGH, color: TEXT, padding: '8px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${BORDER}`, textAlign: 'center' }}>{g}</span>)}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </aside>

                        {/* Right column: tracks, battles, comments */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, minWidth: 0, width: isMobile ? '100%' : undefined, boxSizing: 'border-box' }}>
                            {featured && (
                                <section>
                                    <h2 style={{ margin: '0 0 16px', fontSize: isMobile ? 16 : 20, fontWeight: 700 }}>Featured</h2>
                                    <div style={{ ...glass, borderRadius: 20, padding: isMobile ? 12 : 16, display: 'flex', gap: isMobile ? 12 : 24, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div onClick={() => open(featured)} style={{ width: isMobile ? 72 : 176, height: isMobile ? 72 : 176, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: S_HIGH, cursor: 'pointer' }}>
                                            {featured.coverUrl ? <img src={featured.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={isMobile ? 22 : 48} color={SUB} /></div>}
                                            <span style={{ position: 'absolute', inset: 0, margin: 'auto', width: isMobile ? 32 : 64, height: isMobile ? 32 : 64, borderRadius: '50%', background: accent, opacity: 0.92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={isMobile ? 16 : 32} fill="#fff" color="#fff" style={{ marginLeft: isMobile ? 2 : 3 }} /></span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: 'inline-block', background: 'rgba(255,103,121,0.2)', color: TERTIARY, padding: '2px 8px', borderRadius: 4, fontSize: isMobile ? 10 : 12, marginBottom: 8 }}>Latest Release</span>
                                            <h4 style={{ margin: 0, fontSize: isMobile ? 15 : 26, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featured.title}</h4>
                                            <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.displayName}{p?.genres?.[0] ? ` • ${p.genres[0].genre?.name || p.genres[0].name}` : ''}</p>
                                            {!isMobile && (
                                            <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 2, marginTop: 16 }}>
                                                {bars(featured.id || featured.title).map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 9999, background: i < 18 ? SECONDARY : 'rgba(76,215,246,0.4)' }} />)}
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Public Tracks (private tracks excluded) */}
                            <section>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tracks ({publicTracks.length})</h2>
                                    <Link to={`/profile/${REF_USER}`} style={{ color: accent, fontSize: 12, textDecoration: 'none' }}>View All</Link>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {publicTracks.length === 0 ? <p style={{ color: SUB, fontSize: 14 }}>No tracks yet.</p> : publicTracks.map(t => <TrackRow key={t.id} t={t} />)}
                                </div>
                            </section>

                            {/* Reposts */}
                            {reposts.length > 0 && (
                                <section>
                                    <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Repeat2 size={18} color={accent} /> Reposts ({reposts.length})</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {reposts.map(t => <TrackRow key={t.id} t={t} repost />)}
                                    </div>
                                </section>
                            )}

                            {/* Battles */}
                            <section>
                                <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Swords size={18} color={TERTIARY} /> Battles{battleWins > 0 ? ` · ${battleWins} win${battleWins > 1 ? 's' : ''}` : ''}</h2>
                                {battles.length === 0 ? (
                                    <div style={{ ...glass, borderRadius: 20, padding: 20, color: SUB, fontSize: 14 }}>No battle submissions yet.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {battles.map((b: any, i: number) => {
                                            const won = b.won || b.placement === 1 || b.rank === 1;
                                            const title = b.battleTitle || b.battle?.title || b.title || 'Beat Battle';
                                            const slug = b.battleSlug || b.battle?.slug || b.slug;
                                            return (
                                                <Link key={b.id || i} to={slug ? `/battles/${slug}` : '/battles'} style={{ ...glass, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: TEXT, transition: 'border-color 0.2s, transform 0.15s' }}
                                                    onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                        <Swords size={18} color={won ? '#FFD700' : SUB} />
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.trackTitle || b.track?.title || 'Entry'}</div>
                                                            <div style={{ fontSize: 12, color: SUB }}>{title}</div>
                                                        </div>
                                                    </div>
                                                    {won ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#FFD700', fontSize: 12, fontWeight: 700 }}><Trophy size={14} /> Winner</span>
                                                        : (b.placement || b.rank) ? <span style={{ fontSize: 12, color: SUB }}>#{b.placement || b.rank}</span> : null}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Profile comments */}
                            <section>
                                <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><MessageCircle size={18} color={accent} /> Comments</h2>
                                <div style={{ ...glass, borderRadius: 20, padding: 20 }}>
                                    {p && <CommentSection profileId={p.id} ownerId={p.userId} />}
                                </div>
                            </section>
                        </div>

                    </div>
                    {!p && <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>}
                </div>
                <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
