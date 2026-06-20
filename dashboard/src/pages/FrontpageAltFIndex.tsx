import React from 'react';
import { usePlayer } from '../components/PlayerProvider';
import {
    AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import {
    Home, User, BarChart3, Music, Swords, Trophy, Users, Library,
    Activity, Heart, List, BookOpen, Zap, Layers, MessageSquare, FileText, ListMusic,
} from 'lucide-react';

const DIVIDER = 'rgba(255,255,255,0.06)';

interface Page {
    label: string;
    route: string;
    icon: React.ElementType;
    accent: string;
    reference?: boolean;
}

const SECTIONS: { title: string; pages: Page[] }[] = [
    {
        title: 'Core',
        pages: [
            { label: 'Home',           route: '/preview/alt_f',        icon: Home,        accent: PRIMARY },
            { label: 'Artist Profile', route: '/preview/alt_f_artist', icon: User,        accent: '#F2C50A' },
            { label: 'Track Detail',   route: '/preview/alt_f_track',  icon: Music,       accent: PRIMARY },
        ],
    },
    {
        title: 'Battles',
        pages: [
            { label: 'Battles Hub',   route: '/preview/alt_f_battles', icon: Trophy, accent: SECONDARY, reference: true },
            { label: 'Battle Detail', route: '/preview/alt_f_battle',  icon: Swords, accent: TERTIARY },
        ],
    },
    {
        title: 'Content',
        pages: [
            { label: 'Articles',       route: '/preview/alt_f_articles', icon: BookOpen, accent: '#ff9f43' },
            { label: 'Article Reader', route: '/preview/alt_f_article',  icon: FileText,  accent: '#ff9f43' },
        ],
    },
    {
        title: 'Community',
        pages: [
            { label: 'Arena',    route: '/preview/alt_f_arena',    icon: Zap,         accent: '#FF3D7F' },
            { label: 'Messages', route: '/preview/alt_f_messages', icon: MessageSquare, accent: SECONDARY },
            { label: 'Learn',    route: '/preview/alt_f_learn',    icon: BookOpen,    accent: '#6FBF40' },
        ],
    },
    {
        title: 'Discovery',
        pages: [
            { label: 'Charts',            route: '/preview/alt_f_charts',  icon: BarChart3, accent: '#4ade80' },
            { label: 'Feed',              route: '/preview/alt_f_feed',    icon: Activity,  accent: '#4ade80' },
            { label: 'Artists Directory', route: '/preview/alt_f_artists', icon: Users,     accent: SECONDARY },
            { label: 'Genres',            route: '/preview/alt_f_genres',  icon: List,      accent: '#a78bfa' },
        ],
    },
    {
        title: 'Library',
        pages: [
            { label: 'Library',          route: '/preview/alt_f_library',      icon: Library,   accent: PRIMARY },
            { label: 'My Playlists',     route: '/preview/alt_f_my_playlists', icon: Layers,    accent: '#7C3AED' },
            { label: 'Playlist Detail',  route: '/preview/alt_f_playlist',     icon: ListMusic, accent: SECONDARY },
            { label: 'My Tracks',        route: '/preview/alt_f_my_tracks',    icon: Music,     accent: PRIMARY },
            { label: 'Favourites',       route: '/preview/alt_f_favourites',   icon: Heart,     accent: TERTIARY },
        ],
    },
];

const LEFT_SECTIONS  = ['Core', 'Battles', 'Content', 'Community'];
const RIGHT_SECTIONS = ['Discovery', 'Library'];

function SectionBlock({ section }: { section: typeof SECTIONS[0] }) {
    return (
        <div style={{ marginBottom: 28 }}>
            <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                color: SUB, paddingBottom: 8, marginBottom: 4,
                borderBottom: `1px solid ${DIVIDER}`,
            }}>
                {section.title}
            </div>
            {section.pages.map(page => {
                const Icon = page.icon;
                return (
                    <a
                        key={page.route}
                        href={page.route}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 10px', borderRadius: 8,
                            textDecoration: 'none', color: TEXT,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background = S_CONT; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; }}
                    >
                        <Icon size={15} color={page.accent} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>
                            {page.label}
                        </span>
                        {page.reference && (
                            <span style={{
                                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.06em', color: SECONDARY,
                                background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}44`,
                                padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                            }}>
                                ref
                            </span>
                        )}
                        <code style={{
                            fontSize: 10, color: SUB, background: S_HIGH,
                            padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                            fontFamily: 'monospace',
                        }}>
                            {page.route.replace('/preview/', '')}
                        </code>
                    </a>
                );
            })}
        </div>
    );
}

export const FrontpageAltFIndex: React.FC = () => {
    const { player } = usePlayer();

    const leftSections  = SECTIONS.filter(s => LEFT_SECTIONS.includes(s.title));
    const rightSections = SECTIONS.filter(s => RIGHT_SECTIONS.includes(s.title));
    const totalPages    = SECTIONS.reduce((n, s) => n + s.pages.length, 0);

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Pages' }]} />

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 32px 60px' }}>

                        {/* Minimal header */}
                        <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: `1px solid ${DIVIDER}` }}>
                            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' }}>
                                Alt F
                            </h1>
                            <p style={{ margin: 0, fontSize: 13, color: SUB }}>
                                {totalPages} pages — click any row to open
                            </p>
                        </div>

                        {/* Two-column layout */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px', alignItems: 'start' }}>
                            <div>
                                {leftSections.map(s => <SectionBlock key={s.title} section={s} />)}
                            </div>
                            <div>
                                {rightSections.map(s => <SectionBlock key={s.title} section={s} />)}
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
};
