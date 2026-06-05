import React from 'react';
import { Link } from 'react-router-dom';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    Music, User, BarChart3, Rss, Heart, ListMusic, Star, Mic2,
    Swords, Trophy, Radio, Ticket, BookOpen, Cpu, Zap,
    MessageCircle, Coins, TrendingUp, Headphones, Globe, Sparkles,
    Package, Award, Palette,
} from 'lucide-react';

interface Feature {
    icon: React.ReactNode;
    title: string;
    description: string;
    tags: string[];
    link?: string;
}

interface Section {
    heading: string;
    subheading: string;
    features: Feature[];
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
    'Website': { bg: 'rgba(242, 120, 10,0.15)', color: '#F5A04A' },
    'Discord': { bg: 'rgba(88,101,242,0.18)', color: '#818CF8' },
    'Free': { bg: 'rgba(245,158,11,0.15)', color: '#FCD34D' },
};

const Tag: React.FC<{ label: string }> = ({ label }) => {
    const style = TAG_COLORS[label] || { bg: 'rgba(255,255,255,0.08)', color: colors.textSecondary };
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: borderRadius.pill,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: style.bg,
            color: style.color,
        }}>
            {label}
        </span>
    );
};

const FeatureCard: React.FC<{ feature: Feature }> = ({ feature }) => (
    <div style={{
        background: colors.surface,
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: borderRadius.lg,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{
                width: 40, height: 40, borderRadius: borderRadius.md, flexShrink: 0,
                background: `rgba(242, 120, 10,0.12)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.primary,
            }}>
                {feature.icon}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {feature.tags.map(t => <Tag key={t} label={t} />)}
            </div>
        </div>
        <div>
            {feature.link ? (
                <Link to={feature.link} style={{ color: colors.textPrimary, textDecoration: 'none', fontWeight: 700, fontSize: '15px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = colors.primary)}
                    onMouseLeave={e => (e.currentTarget.style.color = colors.textPrimary)}
                >
                    {feature.title}
                </Link>
            ) : (
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: colors.textPrimary }}>{feature.title}</p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: colors.textSecondary, lineHeight: 1.55 }}>
                {feature.description}
            </p>
        </div>
    </div>
);

const SECTIONS: Section[] = [
    {
        heading: 'Music & Profiles',
        subheading: 'Share your music and build your presence in the community.',
        features: [
            {
                icon: <User size={20} />,
                title: 'Artist Profile',
                description: 'Create your public artist page with a bio, avatar, genres, links, and all your uploaded tracks. Discoverable by the whole community.',
                tags: ['Website', 'Discord'],
                link: '/profile/setup',
            },
            {
                icon: <Music size={20} />,
                title: 'Track Uploads',
                description: 'Upload your productions and share them with the community. Tracks appear on your profile and in the feed for people who follow you.',
                tags: ['Website'],
                link: '/my-tracks',
            },
            {
                icon: <Heart size={20} />,
                title: 'Favourites',
                description: 'Save tracks you love to your favourites list. Come back to them any time from your library.',
                tags: ['Website'],
                link: '/favourites',
            },
            {
                icon: <ListMusic size={20} />,
                title: 'Playlists',
                description: 'Create and curate playlists from any tracks on the platform. Share them with others or keep them for personal use.',
                tags: ['Website'],
                link: '/playlists',
            },
            {
                icon: <Rss size={20} />,
                title: 'Feed',
                description: 'Follow artists and see their new uploads, reposts, and activity in a personalised feed.',
                tags: ['Website'],
                link: '/feed',
            },
            {
                icon: <BarChart3 size={20} />,
                title: 'Charts',
                description: 'See the most played, most liked, and trending tracks across the whole community. Updated regularly.',
                tags: ['Website'],
                link: '/charts',
            },
        ],
    },
    {
        heading: 'Discovery',
        subheading: 'Find new music, samples, and knowledge.',
        features: [
            {
                icon: <Sparkles size={20} />,
                title: 'Artist Discovery',
                description: 'Browse trending artists, featured tracks, and new releases on the home page. A curated front page for the whole community.',
                tags: ['Website'],
                link: '/',
            },
            {
                icon: <Package size={20} />,
                title: 'Fuji Sample Library',
                description: 'A free library of community samples and sounds. Browse, preview, and download royalty-free.',
                tags: ['Website', 'Free'],
                link: '/fuji-studio',
            },
            {
                icon: <Globe size={20} />,
                title: 'Articles & News',
                description: 'Community-written articles covering FL Studio tips, production techniques, gear, and music industry news.',
                tags: ['Website'],
                link: '/articles',
            },
            {
                icon: <MessageCircle size={20} />,
                title: 'Comments',
                description: 'Leave timed comments on tracks at specific moments, reply to other producers, and react to comments.',
                tags: ['Website'],
            },
        ],
    },
    {
        heading: 'Competitions',
        subheading: 'Test your skills against the community.',
        features: [
            {
                icon: <Trophy size={20} />,
                title: 'Beat Battles',
                description: 'Community-wide beat making competitions. Submit a track to the current battle, then vote for your favourites. Winners are announced on Discord.',
                tags: ['Website', 'Discord'],
                link: '/battles',
            },
            {
                icon: <Swords size={20} />,
                title: '1v1 Arena',
                description: 'Head-to-head producer matchups with genre-based matchmaking. Produce to a sample pack, face an opponent, and let the community vote. Ranked with an Elo leaderboard.',
                tags: ['Website', 'Discord'],
                link: '/arena',
            },
        ],
    },
    {
        heading: 'Discord Bot',
        subheading: 'Commands and features available directly in the server.',
        features: [
            {
                icon: <Coins size={20} />,
                title: 'Economy & Shop',
                description: 'Earn and spend the server currency. Check your wallet with /wallet, view the leaderboard with /wealth, browse the shop with /market, and buy items with /buy.',
                tags: ['Discord'],
            },
            {
                icon: <TrendingUp size={20} />,
                title: 'Leveling & Ranks',
                description: 'Earn XP by being active in the server. Use /rank to see your level and /leaderboard to see where you stand. Level up to unlock new roles.',
                tags: ['Discord'],
            },
            {
                icon: <Star size={20} />,
                title: 'Production Feedback',
                description: 'Post your track in a dedicated feedback thread. Spend feedback points to open a thread, earn them back by giving quality feedback to others.',
                tags: ['Discord'],
            },
            {
                icon: <Radio size={20} />,
                title: 'Fuji FM Radio',
                description: 'Community radio playing in a voice channel. Use /nowplaying to see what\'s on, /like to upvote a track, and /tip to send appreciation to the artist.',
                tags: ['Discord'],
            },
            {
                icon: <Headphones size={20} />,
                title: 'Studio Guide AI',
                description: 'Ask any FL Studio or music theory question in the help channel and get an AI-powered answer sourced from official manuals. Use /guide to ask directly.',
                tags: ['Discord'],
            },
            {
                icon: <Ticket size={20} />,
                title: 'Support Tickets',
                description: 'Need help from the team? Use /ticket to open a private support thread. The moderation team will respond as soon as possible.',
                tags: ['Discord'],
            },
            {
                icon: <Award size={20} />,
                title: 'Server Booster Perks',
                description: 'Server boosters get exclusive perks including a custom name colour role. Use /booster to pick your colour.',
                tags: ['Discord'],
            },
        ],
    },
    {
        heading: 'Learning & Tools',
        subheading: 'Get better at making music.',
        features: [
            {
                icon: <BookOpen size={20} />,
                title: 'FL Studio Academy',
                description: 'Interactive lessons built inside a simulated FL Studio environment. Learn the mixer, piano roll, channel rack, and more without leaving your browser.',
                tags: ['Website', 'Discord'],
                link: '/learn',
            },
            {
                icon: <Cpu size={20} />,
                title: 'Drum Kit Generator',
                description: 'Generate royalty-free, procedurally synthesised drum kits in your browser. Kick, snare, hi-hats, and more — download instantly, no sign-up required.',
                tags: ['Website', 'Free'],
                link: '/drum-kit-generator',
            },
            {
                icon: <Zap size={20} />,
                title: 'Studio Guide (Discord)',
                description: 'The /guide command puts the AI studio assistant at your fingertips anywhere in the server. Answers FL Studio questions using the official manuals.',
                tags: ['Discord'],
            },
        ],
    },
    {
        heading: 'Your Account',
        subheading: 'Manage your Fuji Studio account.',
        features: [
            {
                icon: <Mic2 size={20} />,
                title: 'Account Settings',
                description: 'Update your email, change your password, enable two-factor authentication, and link your Discord account — all from one place.',
                tags: ['Website'],
                link: '/account',
            },
            {
                icon: <Palette size={20} />,
                title: 'Profile Customisation',
                description: 'Edit your artist name, avatar, banner, bio, genres, social links, and more. Make your profile your own.',
                tags: ['Website'],
                link: '/profile/edit',
            },
        ],
    },
];

export const FeaturesPage: React.FC = () => (
    <DiscoveryLayout>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 64px' }}>

            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: colors.textPrimary }}>
                    What can I do on Fuji Studio?
                </h1>
                <p style={{ margin: '14px auto 0', maxWidth: 560, fontSize: 16, color: colors.textSecondary, lineHeight: 1.6 }}>
                    Everything available to members — on the website and in the Discord server.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                    <Tag label="Website" />
                    <Tag label="Discord" />
                    <Tag label="Free" />
                    <span style={{ fontSize: 12, color: colors.textTertiary, alignSelf: 'center' }}>
                        — available everywhere these tags appear
                    </span>
                </div>
            </div>

            {/* Sections */}
            {SECTIONS.map(section => (
                <div key={section.heading} style={{ marginBottom: 52 }}>
                    <div style={{
                        borderLeft: `3px solid ${colors.primary}`,
                        paddingLeft: 14,
                        marginBottom: 24,
                    }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
                            {section.heading}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
                            {section.subheading}
                        </p>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 14,
                    }}>
                        {section.features.map(f => <FeatureCard key={f.title} feature={f} />)}
                    </div>
                </div>
            ))}

            {/* CTA */}
            <div style={{
                marginTop: 16,
                padding: '32px 24px',
                background: `linear-gradient(135deg, rgba(242, 120, 10,0.12) 0%, rgba(242, 120, 10,0.04) 100%)`,
                border: `1px solid rgba(242, 120, 10,0.2)`,
                borderRadius: borderRadius.xl,
                textAlign: 'center',
            }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>
                    Ready to get started?
                </h3>
                <p style={{ margin: '8px 0 20px', fontSize: 13, color: colors.textSecondary }}>
                    Join the FL Studio community and start sharing your music.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link to="/login" style={{
                        padding: '10px 20px', background: colors.primary, color: '#fff',
                        borderRadius: borderRadius.md, textDecoration: 'none', fontSize: 13, fontWeight: 700,
                    }}>
                        Create an account
                    </Link>
                    <a href="https://discord.gg/flstudio" target="_blank" rel="noreferrer" style={{
                        padding: '10px 20px', background: 'rgba(88,101,242,0.2)', color: '#818CF8',
                        border: '1px solid rgba(88,101,242,0.35)',
                        borderRadius: borderRadius.md, textDecoration: 'none', fontSize: 13, fontWeight: 700,
                    }}>
                        Join the Discord
                    </a>
                </div>
            </div>
        </div>
    </DiscoveryLayout>
);
