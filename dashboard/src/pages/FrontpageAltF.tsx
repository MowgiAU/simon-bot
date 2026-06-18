/**
 * Test Frontpage — Alt F (Stitch "enhanced desktop" / Spotify-style 3-column layout).
 * Hidden route: /preview/alt_f — not linked from any nav; access by URL only.
 *
 * Standalone full-screen layout (own sidebars + player bar; does NOT use
 * DiscoveryLayout). CSP-safe: inline styles + lucide-react, live Fuji data.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import {
    Home, Search, User, Newspaper, BarChart3, Swords, Plus, Library, AudioLines,
    Users, Star, HelpCircle, LogOut, ChevronLeft, ChevronRight,
    Play, Pause, Heart, Shuffle, SkipBack, SkipForward, Repeat, Mic, ListMusic, Volume2, Music,
} from 'lucide-react';

// Palette (from the Stitch desktop mockup)
const BG = '#0f131d', S_LOWEST = '#0a0e18', S_CONT = '#1c1f2a', S_HIGH = '#262a35', S_HIGHEST = '#313540', S_VAR = '#313540';
const PRIMARY = '#F2780A', ACCENT_TXT = '#ffb689', SECONDARY = '#4cd7f6', TERTIARY = '#ff6779';
const TEXT = '#dfe2f1', SUB = '#9aa3b2', BORDER = 'rgba(255,255,255,0.06)';
const FONT = 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

const arr = (d: any): any[] => Array.isArray(d) ? d : (d?.tracks || d?.profiles || d?.battles || d?.entries || d?.playlists || d?.data || []);
const fmt = (s: number) => { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const c = Math.floor(s % 60); return `${m}:${c.toString().padStart(2, '0')}`; };
const trackName = (t: any) => t?.profile?.displayName || t?.profile?.username || t?.artist || 'Unknown';

const navItems = [
    { icon: Home, label: 'Home', to: '/', active: true },
    { icon: Search, label: 'Search', to: '/library' },
    { icon: User, label: 'Artists', to: '/artists' },
    { icon: Newspaper, label: 'News', to: '/articles' },
    { icon: BarChart3, label: 'Charts', to: '/charts' },
    { icon: Swords, label: 'Battles', to: '/battles' },
];

export const FrontpageAltF: React.FC = () => {
    const { player, setTrack, togglePlay, seek } = usePlayer();
    const [data, setData] = useState<{ hero: any; artists: any[]; drops: any[]; battles: any[]; playlists: any[]; activity: any[] } | null>(null);
    const [slideIdx, setSlideIdx] = useState(0);

    useEffect(() => {
        let on = true;
        (async () => {
            const [c, p, d, b, pl] = await Promise.all([
                axios.get('/api/charts/weekly').catch(() => ({ data: null })),
                axios.get('/api/musician/profiles?limit=12').catch(() => ({ data: [] })),
                axios.get('/api/discovery/tracks?limit=12').catch(() => ({ data: [] })),
                axios.get('/api/beat-battle/battles').catch(() => ({ data: [] })),
                axios.get('/api/playlists/popular').catch(() => ({ data: [] })),
            ]);
            if (!on) return;
            const ch = Array.isArray(c.data) ? c.data[0] : c.data;
            const hero = ch?.entries?.[0]?.track || null;
            const artists = arr(p.data).filter((x: any) => x.avatar).slice(0, 12);
            const drops = arr(d.data).filter((x: any) => x.coverUrl).slice(0, 12);
            const battles = arr(b.data).slice(0, 4);
            const playlists = arr(pl.data).slice(0, 6);
            const activity = arr(d.data).slice(0, 5);
            setData({ hero, artists, drops, battles, playlists, activity });
        })();
        return () => { on = false; };
    }, []);

    const playTrack = (t: any, queue: any[]) => {
        const mk = (x: any) => ({ id: x.id, title: x.title, artist: trackName(x), cover: x.coverUrl, url: x.url, profile: x.profile });
        setTrack(mk(t), queue.map(mk));
    };

    const cur = player.currentTrack;
    const isPlaying = player.isPlaying;
    const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

    const sectionTitle: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: TEXT, margin: 0, cursor: 'pointer' };
    const card: React.CSSProperties = { background: 'rgba(28,31,42,0.4)', padding: 16, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' };

    // ── Featured slider: rotate through track / artist / battle / playlist ──
    // Prefer items with a wide banner image so the full-bleed hero stays high quality
    // (avatars / battle card thumbnails are small and look soft when stretched).
    const fBattle = (data?.battles || []).find((b: any) => (b.status === 'active' || b.status === 'voting') && b.bannerUrl)
        || (data?.battles || []).find((b: any) => b.bannerUrl)
        || (data?.battles || []).find((b: any) => b.status === 'active' || b.status === 'voting')
        || data?.battles?.[0] || null;
    const fArtist = (data?.artists || []).find((a: any) => a.bannerUrl) || data?.artists?.[0] || null;
    const fPlaylist = data?.playlists?.[0] || null;
    const slides: any[] = [];
    if (data?.hero) slides.push({ key: 'track', eyebrow: '#1 This Week', title: trackName(data.hero), subtitle: `Latest: ${data.hero.title}`, bg: data.hero.coverUrl, icon: Play, onAction: () => playTrack(data.hero, [data.hero]), actionLabel: 'Play' });
    const fArtistTrackCover = fArtist ? (data?.drops || []).find((t: any) => (t.profile?.username || '') === fArtist.username)?.coverUrl : null;
    if (fArtist) slides.push({ key: 'artist', eyebrow: 'Featured Artist', title: fArtist.displayName || fArtist.username, subtitle: fArtist.genres?.[0]?.genre?.name || 'Producer', bg: fArtist.bannerUrl || fArtistTrackCover || fArtist.avatar, icon: User, to: `/profile/${fArtist.username}`, actionLabel: 'View Artist' });
    if (fBattle) slides.push({ key: 'battle', eyebrow: 'Featured Battle', title: fBattle.title, subtitle: fBattle.subtitle || (fBattle.status === 'completed' ? 'Battle ended' : 'Beat battle'), bg: fBattle.bannerUrl || fBattle.cardImageUrl, icon: Swords, to: `/battles/${fBattle.slug || fBattle.id}`, actionLabel: 'View Battle' });
    if (fPlaylist) slides.push({ key: 'playlist', eyebrow: 'Featured Playlist', title: fPlaylist.name || fPlaylist.title, subtitle: `${fPlaylist.trackCount ?? fPlaylist._count?.tracks ?? fPlaylist.tracks?.length ?? 0} tracks`, bg: fPlaylist.coverUrl || fPlaylist.cover || fPlaylist.tracks?.[0]?.coverUrl, icon: ListMusic, to: `/playlist/${fPlaylist.id}`, actionLabel: 'Open Playlist' });

    useEffect(() => {
        if (slides.length <= 1) return;
        const id = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 6000);
        return () => clearInterval(id);
    }, [slides.length]);

    const slide = slides.length ? slides[slideIdx % slides.length] : null;
    const SlideIcon = slide?.icon;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left sidebar (shared component) */}
                <AltSidebar active="Home" />

                {/* Center */}
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
                    <AltHeader
                        leftSlot={<>
                            <button aria-label="Previous featured" disabled={slides.length <= 1} onClick={() => setSlideIdx(i => (i - 1 + slides.length) % slides.length)} style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, cursor: slides.length > 1 ? 'pointer' : 'default', opacity: slides.length > 1 ? 1 : 0.4 }}><ChevronLeft size={20} /></button>
                            <button aria-label="Next featured" disabled={slides.length <= 1} onClick={() => setSlideIdx(i => (i + 1) % slides.length)} style={{ width: 32, height: 32, borderRadius: '50%', background: S_CONT, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, cursor: slides.length > 1 ? 'pointer' : 'default', opacity: slides.length > 1 ? 1 : 0.4 }}><ChevronRight size={20} /></button>
                        </>}
                    />

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 96px' }}>
                        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40, paddingTop: 16 }}>
                            {/* Featured slider — rotates track / artist / battle / playlist */}
                            {slide && (
                                <section style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 360 }}>
                                    {slide.bg && <img key={slide.key} src={slide.bg} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG}, rgba(15,19,29,0.4) 50%, transparent), linear-gradient(to right, rgba(15,19,29,0.8), transparent 60%)` }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, padding: 32, width: '100%' }}>
                                        <span style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(28,31,42,0.8)', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>{slide.eyebrow}</span>
                                        <h2 style={{ margin: '0 0 8px', fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slide.title}</h2>
                                        <p style={{ margin: '0 0 24px', fontSize: 18, color: SUB }}>{slide.subtitle}</p>
                                        {slide.onAction ? (
                                            <button onClick={slide.onAction} style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(242,120,10,0.4)' }}>{SlideIcon && <SlideIcon size={30} fill="#fff" style={{ marginLeft: 3 }} />}</button>
                                        ) : (
                                            <Link to={slide.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 9999, textDecoration: 'none', boxShadow: '0 0 20px rgba(242,120,10,0.4)' }}>{SlideIcon && <SlideIcon size={20} />} {slide.actionLabel}</Link>
                                        )}
                                    </div>
                                    {slides.length > 1 && (
                                        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6 }}>
                                            {slides.map((s, i) => {
                                                const on = i === (slideIdx % slides.length);
                                                return <button key={s.key} aria-label={s.eyebrow} onClick={() => setSlideIdx(i)} style={{ width: on ? 22 : 8, height: 8, borderRadius: 9999, background: on ? PRIMARY : 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />;
                                            })}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Trending Artists */}
                            {data && data.artists.length > 0 && (
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Link to="/artists" style={{ ...sectionTitle, textDecoration: 'none' }}>Trending Artists</Link>
                                        <Link to="/artists" style={{ color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none' }}>Show all</Link>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 20, overflow: 'hidden' }}>
                                        {data.artists.map((a: any) => (
                                            <Link key={a.id || a.username} to={`/profile/${a.username}`} style={{ ...card, width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', textDecoration: 'none', color: TEXT }}>
                                                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', background: S_HIGH }}>
                                                    {a.avatar && <img src={a.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                                <span style={{ fontSize: 16, fontWeight: 700, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.displayName || a.username}</span>
                                                <span style={{ fontSize: 12, color: SUB, marginTop: 4 }}>{a.genres?.[0]?.genre?.name || 'Producer'}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* New Drops */}
                            {data && data.drops.length > 0 && (
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Link to="/new" style={{ ...sectionTitle, textDecoration: 'none' }}>New Drops</Link>
                                        <Link to="/new" style={{ color: SUB, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none' }}>Show all</Link>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 20, overflow: 'hidden' }}>
                                        {data.drops.map((t: any) => (
                                            <div key={t.id} onClick={() => playTrack(t, data.drops)} style={{ ...card, width: 160, flexShrink: 0 }}>
                                                <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 6, overflow: 'hidden', marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', background: S_HIGH }}>
                                                    <img src={t.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <span style={{ position: 'absolute', bottom: 8, right: 8, width: 40, height: 40, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}><Play size={22} fill="#fff" color="#fff" style={{ marginLeft: 2 }} /></span>
                                                </div>
                                                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</h4>
                                                <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trackName(t)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            {!data && <div style={{ padding: 80, textAlign: 'center', color: SUB }}>Loading…</div>}
                        </div>
                    </div>
                </main>

                {/* Right sidebar */}
                <aside style={{ width: 288, background: BG, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', paddingBottom: cur ? 90 : 0 }}>
                    <div style={{ padding: '24px 16px', borderBottom: `1px solid ${BORDER}` }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Community Activity</h3>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {data && data.battles.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Swords size={20} color={TERTIARY} /><h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Battles</h4></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {data.battles.map((b: any) => {
                                        const live = b.status === 'active' || b.status === 'voting';
                                        return (
                                            <Link key={b.id} to={`/battles/${b.slug || b.id}`} style={{ position: 'relative', overflow: 'hidden', height: 112, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 12, textDecoration: 'none', color: '#fff', background: S_CONT }}>
                                                {b.cardImageUrl && <img src={b.cardImageUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2))' }} />
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: live ? TERTIARY : 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'uppercase' }}>{live ? 'Live' : (b.status === 'completed' ? 'Ended' : 'Upcoming')}</span>
                                                    <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700 }}>{b.title}</p>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {data && data.activity.length > 0 && (
                            <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Recent Activity</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {data.activity.map((t: any) => (
                                        <Link key={t.id} to={`/profile/${t.profile?.username || ''}`} style={{ display: 'flex', gap: 12, textDecoration: 'none', color: TEXT }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH }}>{t.profile?.avatar && <img src={t.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: 13 }}><strong>{trackName(t)}</strong> published a track</p>
                                                <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB, display: 'flex', alignItems: 'center', gap: 4 }}><Music size={12} /> {t.title}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* No custom player bar here — the global GlobalPlayer (mounted in App) handles playback. */}
        </div>
    );
};
