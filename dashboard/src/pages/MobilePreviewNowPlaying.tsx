/**
 * Mobile redesign preview — Now Playing (Stitch mockup rebuilt as CSP-safe React).
 * Hidden route: /preview/mobile-now-playing — not linked from any nav.
 *
 * Inline styles + lucide-react only (no Tailwind/Material-Symbols CDNs, which the
 * site CSP blocks). Live track from /api/discovery/tracks with a real fallback.
 * Note: stems mixer / project player are desktop-only and intentionally omitted.
 */
import React from 'react';
import axios from 'axios';
import {
    ChevronDown, Share2, Heart, Shuffle, SkipBack, Play, SkipForward,
    Repeat, Repeat2, ListPlus, Download,
} from 'lucide-react';
import { BG, SURFACE, BORDER, PRIMARY, CYAN, TEXT, SUB, FONT, waveHeights, useLive, arr } from './MobilePreviewChrome';

type Track = { title: string; artist: string; cover: string; bpm: string; key: string };

const FALLBACK: Track = {
    title: 'ATTACK OF LIGHT',
    artist: 'Average Chemical',
    cover: 'https://cdn.fujistud.io/tracks/cmqfcux5e009adwt0oenl82xj/artwork/artwork-1781536541155-680351568.webp',
    bpm: '140 BPM',
    key: 'F Minor',
};
const COMMENT = {
    handle: '@logix',
    avatar: 'https://cdn.fujistud.io/profiles/cmpoougk7008w12pv1ofphwwm/avatar/avatar-1779924630328-648419436.webp',
    time: '1:24',
    text: 'Sick bassline right here — the glide is perfect.',
};
const ELAPSED = '1:24', DURATION = '3:45', PROGRESS = 0.36;

const iconBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: TEXT, cursor: 'pointer', padding: 0 };

export const MobilePreviewNowPlaying: React.FC = () => {
    const track = useLive<Track>(async () => {
        const r = await axios.get('/api/discovery/tracks?limit=40');
        const list = arr(r.data);
        const t = list.find((x: any) => x.bpm && x.key && x.coverUrl) || list.find((x: any) => x.coverUrl);
        if (!t) return null;
        return {
            title: t.title,
            artist: t.artist || t.profile?.displayName || 'Unknown',
            cover: t.coverUrl,
            bpm: t.bpm ? `${t.bpm} BPM` : '',
            key: t.key || '',
        };
    }, FALLBACK);

    const bars = waveHeights(track.title);
    const playedBars = Math.floor(bars.length * PROGRESS);
    const chips = [track.bpm, track.key].filter(Boolean);

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: FONT }}>
            <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 16px 32px' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                    <button aria-label="Dismiss" style={{ ...iconBtn, width: 40, height: 40 }}><ChevronDown size={28} /></button>
                    <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT, opacity: 0.85 }}>Now Playing</span>
                    <button aria-label="Share" style={{ ...iconBtn, width: 40, height: 40 }}><Share2 size={22} /></button>
                </header>

                <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}`, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', marginTop: 8 }}>
                    <img src={track.cover} alt={track.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 24 }}>
                    <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: TEXT, lineHeight: 1.15 }}>{track.title}</h2>
                        <button style={{ ...iconBtn, marginTop: 4, fontSize: 18, fontWeight: 600, color: CYAN }}>{track.artist}</button>
                    </div>
                    <button aria-label="Favourite" style={{ width: 48, height: 48, borderRadius: '50%', background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <Heart size={24} fill={PRIMARY} color={PRIMARY} />
                    </button>
                </div>

                {chips.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        {chips.map(c => (
                            <span key={c} style={{ padding: '4px 12px', borderRadius: 6, background: '#111827', color: CYAN, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', border: '1px solid #1E293B' }}>{c}</span>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 64 }}>
                        {bars.map((bh, i) => (
                            <div key={i} style={{
                                flex: 1, height: `${bh}%`, borderRadius: 2,
                                background: i === playedBars ? '#fff' : i < playedBars ? PRIMARY : 'rgba(6,182,212,0.3)',
                                boxShadow: i === playedBars ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
                            }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, letterSpacing: '0.1em' }}>
                        <span style={{ color: PRIMARY, fontWeight: 500 }}>{ELAPSED}</span>
                        <span style={{ color: SUB }}>{DURATION}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '20px 0' }}>
                    <button aria-label="Shuffle" style={{ ...iconBtn, color: SUB }}><Shuffle size={22} /></button>
                    <button aria-label="Previous" style={iconBtn}><SkipBack size={32} fill={TEXT} /></button>
                    <button aria-label="Play" style={{ width: 80, height: 80, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 0 30px rgba(242,120,10,0.4)' }}>
                        <Play size={36} fill="#fff" style={{ marginLeft: 4 }} />
                    </button>
                    <button aria-label="Next" style={iconBtn}><SkipForward size={32} fill={TEXT} /></button>
                    <button aria-label="Repeat" style={{ ...iconBtn, color: SUB }}><Repeat size={22} /></button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '16px 0', marginTop: 8 }}>
                    {[{ icon: Repeat2, label: 'Repost' }, { icon: ListPlus, label: 'Playlist' }, { icon: Download, label: 'Download' }].map(({ icon: Icon, label }) => (
                        <button key={label} style={{ ...iconBtn, flexDirection: 'column', gap: 4, color: SUB }}>
                            <Icon size={22} />
                            <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 12, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
                    <img src={COMMENT.avatar} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${BORDER}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: CYAN }}>{COMMENT.handle}</span>
                            <span style={{ fontSize: 11, color: SUB, opacity: 0.7 }}>{COMMENT.time}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT }}>{COMMENT.text}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
