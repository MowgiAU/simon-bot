/**
 * Alt F — Design preview index (/preview/alt_f_index)
 * Master hub linking to all built Alt F pages, with status badges and descriptions.
 * Not linked from the main nav — access by URL only.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import {
    Home, User, BarChart3, Music, Swords, Trophy, Users, Library,
    Rss, MessageCircle, Heart, List, BookOpen, Zap, Layers, Activity, MessageSquare, FileText,
} from 'lucide-react';

const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const DIVIDER = 'rgba(87,66,54,0.25)';

const PAGES = [
    {
        label: 'Battles Hub',
        route: '/preview/alt_f_battles',
        icon: Trophy,
        status: 'reference' as const,
        desc: 'The reference standard. Centred hero, stats pill, glass battle cards, wall of fame, history table.',
        gradient: 'linear-gradient(135deg, #1a2242 0%, #2a1040 100%)',
        accent: SECONDARY,
    },
    {
        label: 'Battle Detail',
        route: '/preview/alt_f_battle',
        icon: Swords,
        status: 'approved' as const,
        desc: 'Individual battle page. Centred 400px hero with challenge + rules, submissions table.',
        gradient: 'linear-gradient(135deg, #2a1040 0%, #1a0f1a 100%)',
        accent: TERTIARY,
    },
    {
        label: 'Track Detail',
        route: '/preview/alt_f_track',
        icon: Music,
        status: 'approved' as const,
        desc: 'Track page with waveform, timed comments, stems mixer, FL arrangement viewer, and comments.',
        gradient: 'linear-gradient(135deg, #0a1f2a 0%, #1a2242 100%)',
        accent: PRIMARY,
    },
    {
        label: 'Artist Profile',
        route: '/preview/alt_f_artist',
        icon: User,
        status: 'approved' as const,
        desc: 'Artist profile with banner hero, top tracks, battles, featured friends, and social links.',
        gradient: 'linear-gradient(135deg, #1a1a0a 0%, #2a2010 100%)',
        accent: '#F2C50A',
    },
    {
        label: 'Charts',
        route: '/preview/alt_f_charts',
        icon: BarChart3,
        status: 'approved' as const,
        desc: 'Weekly / daily / all-time charts. Hero #1 track, full chart table with rank movement.',
        gradient: 'linear-gradient(135deg, #0a2020 0%, #103030 100%)',
        accent: '#4ade80',
    },
    {
        label: 'Artists Directory',
        route: '/preview/alt_f_artists',
        icon: Users,
        status: 'approved' as const,
        desc: 'Browse and search all artists. Genre filters, sort, featured leaderboard, artist card grid.',
        gradient: 'linear-gradient(135deg, #1a0a2a 0%, #0a1a3a 100%)',
        accent: SECONDARY,
    },
    {
        label: 'Feed',
        route: '/preview/alt_f_feed',
        icon: Activity,
        status: 'approved' as const,
        desc: 'Activity feed — Discover tab (public events) and Following tab (tracks from followed artists, paginated).',
        gradient: 'linear-gradient(135deg, #0a2a1a 0%, #1a1a3a 100%)',
        accent: '#4ade80',
    },
    {
        label: 'Library',
        route: '/preview/alt_f_library',
        icon: Library,
        status: 'approved' as const,
        desc: 'Searchable track browser. Server-side sort + genre filter, client-side search, BPM/duration/plays columns.',
        gradient: 'linear-gradient(135deg, #1a0a2a 0%, #0a1a2a 100%)',
        accent: PRIMARY,
    },
    {
        label: 'Messages',
        route: '/preview/alt_f_messages',
        icon: MessageSquare,
        status: 'approved' as const,
        desc: 'E2E-encrypted 1:1 and group DMs. Conversation list, chat thread with bubbles, user search, optimistic send.',
        gradient: 'linear-gradient(135deg, #0a1a2a 0%, #1a2a1a 100%)',
        accent: SECONDARY,
    },
    {
        label: 'Articles',
        route: '/preview/alt_f_articles',
        icon: BookOpen,
        status: 'approved' as const,
        desc: 'Article archive with featured hero, category filter sidebar, paginated card grid, and article detail reader.',
        gradient: 'linear-gradient(135deg, #1a2a0a 0%, #2a1a0a 100%)',
        accent: '#ff9f43',
    },
    {
        label: 'Article Reader',
        route: '/preview/alt_f_article',
        icon: FileText,
        status: 'approved' as const,
        desc: 'Full reading view: cover hero, author strip, rich-text body, tags, author card, related articles.',
        gradient: 'linear-gradient(135deg, #2a1a0a 0%, #1a0a0a 100%)',
        accent: '#ff9f43',
    },
    {
        label: 'Home',
        route: '/preview/alt_f',
        icon: Home,
        status: 'wip' as const,
        desc: 'Discovery feed / landing page. Still needs structural work — hero and content TBD.',
        gradient: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        accent: SUB,
    },
];

const COMING_SOON = [
    { label: 'Arena', icon: Zap, desc: 'Head-to-head battle arena and matchups' },
    { label: 'Favourites', icon: Heart, desc: 'Liked tracks and saved content' },
    { label: 'My Tracks', icon: List, desc: 'Your uploaded tracks and drafts' },
    { label: 'Genres', icon: Music, desc: 'Genre exploration and discovery pages' },
    { label: 'My Playlists', icon: Layers, desc: 'Create and manage playlists' },
    { label: 'Learn', icon: BookOpen, desc: 'FL Studio tutorials and learning paths' },
];

const STATUS: Record<string, { label: string; color: string }> = {
    reference: { label: 'Reference', color: SECONDARY },
    approved:  { label: 'Approved',  color: '#4ade80' },
    wip:       { label: 'Needs Work', color: TERTIARY },
};

export const FrontpageAltFIndex: React.FC = () => {
    const { player } = usePlayer();
    const navigate = useNavigate();

    const built = PAGES;
    const approvedCount = PAGES.filter(p => p.status !== 'wip').length;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Design Preview' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>

                    {/* Page header */}
                    <div style={{ maxWidth: 1280, margin: '40px auto 0', padding: '0 32px 32px', borderBottom: `1px solid ${DIVIDER}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                            <div>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: PRIMARY, display: 'block', marginBottom: 6 }}>
                                    Alt F Suite
                                </span>
                                <h1 style={{ margin: '0 0 8px', fontSize: 40, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    Design Preview
                                </h1>
                                <p style={{ margin: 0, color: SUB, fontSize: 15 }}>
                                    All pages in the Alt F desktop redesign — click any card to open.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 24 }}>
                                {[
                                    { label: 'Built', value: PAGES.length, color: TEXT },
                                    { label: 'Approved', value: approvedCount, color: '#4ade80' },
                                    { label: 'Coming Soon', value: COMING_SOON.length, color: SUB },
                                ].map(s => (
                                    <div key={s.label} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Built pages grid */}
                    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px 0' }}>
                        <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Built Pages</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 48 }}>
                            {built.map(page => {
                                const Icon = page.icon;
                                const badge = STATUS[page.status];
                                return (
                                    <div
                                        key={page.route}
                                        onClick={() => navigate(page.route)}
                                        style={{
                                            ...glass, borderRadius: 20, overflow: 'hidden',
                                            cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                            transition: 'border-color 0.2s, transform 0.15s',
                                        }}
                                        onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        {/* Top gradient with icon */}
                                        <div style={{ height: 96, position: 'relative', background: page.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={44} color={`${page.accent}30`} strokeWidth={1.5} />
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(15,19,29,0.5) 100%)' }} />
                                            <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                                <span style={{
                                                    background: `${badge.color}22`, border: `1px solid ${badge.color}55`,
                                                    color: badge.color, padding: '3px 10px', borderRadius: 9999,
                                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                }}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Icon size={14} color={page.accent} />
                                                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{page.label}</span>
                                            </div>
                                        </div>

                                        {/* Card body */}
                                        <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <p style={{ margin: '0 0 16px', fontSize: 13, color: SUB, lineHeight: 1.55, flex: 1 }}>
                                                {page.desc}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <code style={{ fontSize: 11, color: SUB, background: S_HIGH, padding: '3px 8px', borderRadius: 6 }}>
                                                    {page.route}
                                                </code>
                                                <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 700 }}>Open →</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Coming soon */}
                        <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Coming Soon</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, paddingBottom: 60 }}>
                            {COMING_SOON.map(item => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} style={{ ...glass, borderRadius: 20, padding: '18px 18px', opacity: 0.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Icon size={15} color={SUB} />
                                            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.label}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.5 }}>{item.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};
