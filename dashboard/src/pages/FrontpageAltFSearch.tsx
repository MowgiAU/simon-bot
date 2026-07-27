/**
 * Alt F — Sitewide search results (/search?q=...)
 * Powers the header search bar — combined tracks + artists + genres via /api/search.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_HIGH, PRIMARY, SECONDARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { Search, Music, User, Tag, Play } from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';
const fmtNum = (n?: number) => { n = n || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); };

export const FrontpageAltFSearch: React.FC = () => {
    const { player, setTrack } = usePlayer();
    const location = useLocation();
    const q = new URLSearchParams(location.search).get('q') || '';

    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<{ tracks: any[]; profiles: any[]; genres: any[] }>({ tracks: [], profiles: [], genres: [] });

    useEffect(() => {
        document.title = q ? `Fuji Studio | Search: ${q}` : 'Fuji Studio | Search';
        if (!q.trim()) { setResults({ tracks: [], profiles: [], genres: [] }); setLoading(false); return; }
        let on = true;
        setLoading(true);
        axios.get('/api/search', { params: { q } })
            .then(r => { if (on) setResults(r.data); })
            .catch(() => { if (on) setResults({ tracks: [], profiles: [], genres: [] }); })
            .finally(() => { if (on) setLoading(false); });
        return () => { on = false; };
    }, [q]);

    const playTrack = (t: any) => {
        setTrack({
            id: t.id, title: t.title,
            artist: t.profile?.displayName || t.profile?.username || 'Unknown',
            url: t.url, coverUrl: t.coverUrl,
            username: t.profile?.username, slug: t.slug,
        }, []);
    };

    const totalResults = results.tracks.length + results.profiles.length + results.genres.length;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Search' }, { label: q || '…' }]} />
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                        <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '32px', boxSizing: 'border-box' }}>
                            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>
                                {q ? <>Results for "{q}"</> : 'Search'}
                            </h1>

                            {!q.trim() ? (
                                <p style={{ color: SUB, fontSize: 14 }}>Type something into the search bar above to find tracks, artists, and genres.</p>
                            ) : loading ? (
                                <div style={{ padding: 80, textAlign: 'center', color: SUB }}><AltSpinner /></div>
                            ) : totalResults === 0 ? (
                                <div style={{ ...glass, borderRadius: 20, padding: '48px 24px', textAlign: 'center', marginTop: 20 }}>
                                    <Search size={32} color={SUB} style={{ marginBottom: 12 }} />
                                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No results found</div>
                                    <div style={{ fontSize: 13, color: SUB }}>Try a different search term</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 20 }}>
                                    {results.profiles.length > 0 && (
                                        <section>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                                <User size={16} color={SECONDARY} />
                                                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Artists</h2>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                                                {results.profiles.map((p: any) => (
                                                    <Link key={p.id} to={`/profile/${p.username}`} style={{ ...glass, borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                                                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={16} color={SUB} />}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName || p.username}</div>
                                                            <div style={{ fontSize: 11, color: SUB }}>@{p.username}</div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {results.tracks.length > 0 && (
                                        <section>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                                <Music size={16} color={PRIMARY} />
                                                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tracks</h2>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {results.tracks.map((t: any) => (
                                                    <div key={t.id} style={{ ...glass, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <button onClick={() => playTrack(t)} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, background: t.coverUrl ? `url(${t.coverUrl}) center/cover` : S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Play size={14} color="#fff" fill="#fff" />
                                                            </div>
                                                        </button>
                                                        <Link to={t.profile?.username ? `/profile/${t.profile.username}/${t.slug || t.id}` : '#'} style={{ minWidth: 0, flex: 1, textDecoration: 'none', color: 'inherit' }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                                            <div style={{ fontSize: 11, color: SUB }}>{t.profile?.displayName || t.profile?.username || 'Unknown'}</div>
                                                        </Link>
                                                        <span style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{fmtNum(t.playCount)} plays</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {results.genres.length > 0 && (
                                        <section>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                                <Tag size={16} color={SUB} />
                                                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Genres</h2>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {results.genres.map((g: any) => (
                                                    <Link key={g.id} to={`/genres/${g.slug}`} style={{ padding: '8px 16px', borderRadius: 9999, background: S_HIGH, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                                                        {g.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <AltActivitySidebar showCommunity />
                </div>
            </main>
        </div>
    );
};
